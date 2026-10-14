#!/usr/bin/env node
// Builds .pmtiles archives for every large vector layer and data/dataset-manifest.json
// for every vector layer, from JS/layer-control.js's live `layerCategories` config -
// see the "Migrate map rendering from GeoJSON to PMTiles" plan for the full picture.
//
// Requires a `tippecanoe` command on PATH (native install, WSL, or a shell alias
// wrapping Docker - your choice; see tools/README.md). Run from anywhere - paths are
// resolved relative to this file.
//
// Usage:
//   node tools/build-pmtiles.mjs                 tile everything that needs it + rebuild the manifest
//   node tools/build-pmtiles.mjs --manifest-only  skip tippecanoe entirely, just (re)build the manifest
//   node tools/build-pmtiles.mjs --tiles-only     skip the manifest, just run tippecanoe
//   node tools/build-pmtiles.mjs --force          re-tile even if the .pmtiles output looks up to date
//   node tools/build-pmtiles.mjs "Streets_Center" tile/manifest only entries whose file/name contains this
//
// Large sources (Land_Cover_2021_0.geojson is ~180MB) parse into a lot of JS heap -
// if you hit an out-of-memory error, re-run with:
//   node --max-old-space-size=4096 tools/build-pmtiles.mjs

import { readFileSync, writeFileSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(REPO_ROOT, 'data');
const LAYER_CONTROL_PATH = path.join(REPO_ROOT, 'JS', 'layer-control.js');
const LAYER_FILTER_PATH = path.join(REPO_ROOT, 'JS', 'layer-filter.js');
const MANIFEST_PATH = path.join(DATA_DIR, 'dataset-manifest.json');

const args = process.argv.slice(2);
const FLAG_MANIFEST_ONLY = args.includes('--manifest-only');
const FLAG_TILES_ONLY = args.includes('--tiles-only');
const FLAG_FORCE = args.includes('--force');
const FILTER_ARG = args.find((a) => !a.startsWith('--')) || null;

const ATTR_VALUE_CARDINALITY_CAP = 40; // must match JS/dataset-search.js's cap

// ── Extract layerCategories / layerFilterConfigs straight out of the live JS ────────
// Keeps this script from drifting out of sync with the actual site config: it reads
// the same object literals the browser uses, rather than a hand-maintained copy.

function extractBalancedObjectLiteral(source, afterMarker) {
  const markerIdx = source.indexOf(afterMarker);
  if (markerIdx === -1) throw new Error('Could not find "' + afterMarker + '"');
  const braceStart = source.indexOf('{', markerIdx + afterMarker.length);
  if (braceStart === -1) throw new Error('Could not find opening "{" after "' + afterMarker + '"');

  let depth = 0;
  let inString = null; // active quote char, or null
  let i = braceStart;
  for (; i < source.length; i++) {
    const ch = source[i];
    if (inString) {
      if (ch === '\\') { i++; continue; } // skip escaped char
      if (ch === inString) inString = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === '`') { inString = ch; continue; }
    if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) { i++; break; }
    }
  }
  if (depth !== 0) throw new Error('Unbalanced braces reading object literal after "' + afterMarker + '"');
  return source.slice(braceStart, i);
}

function loadLayerCategories() {
  const src = readFileSync(LAYER_CONTROL_PATH, 'utf8');
  const literal = extractBalancedObjectLiteral(src, 'var layerCategories =');
  // eslint-disable-next-line no-new-func
  return new Function('return (' + literal + ');')();
}

function loadLayerFilterConfigs() {
  const src = readFileSync(LAYER_FILTER_PATH, 'utf8');
  const literal = extractBalancedObjectLiteral(src, 'Object.assign(window.layerFilterConfigs,');
  // eslint-disable-next-line no-new-func
  return new Function('return (' + literal + ');')();
}

function flattenCategories(layerCategories) {
  const out = [];
  for (const catName of Object.keys(layerCategories)) {
    const catData = layerCategories[catName];
    if (!catData || typeof catData !== 'object') continue;
    for (const key of Object.keys(catData)) {
      const items = catData[key] || [];
      items.forEach((info) => out.push({ info, category: catName, subcategory: key === '_items' ? null : key }));
    }
  }
  return out;
}

// ── Feature-collection helpers (mirrors JS/dataset-search.js / JS/layer-control.js) ──

function walkBbox(features) {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  function visit(coords) {
    if (typeof coords[0] === 'number') {
      const lng = coords[0], lat = coords[1];
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    } else {
      for (const c of coords) visit(c);
    }
  }
  for (const f of features) {
    const g = f && f.geometry;
    if (!g) continue;
    if (g.type === 'GeometryCollection') {
      (g.geometries || []).forEach((gg) => { if (gg && gg.coordinates) visit(gg.coordinates); });
    } else if (g.coordinates) {
      visit(g.coordinates);
    }
  }
  if (![minLng, minLat, maxLng, maxLat].every(Number.isFinite)) return null;
  return [minLng, minLat, maxLng, maxLat];
}

function sampleFieldNames(features) {
  const fieldSet = new Set();
  for (const f of features) {
    const props = f && f.properties;
    if (props && typeof props === 'object') Object.keys(props).forEach((k) => fieldSet.add(k));
  }
  return Array.from(fieldSet).sort();
}

function getAttributeValues(features) {
  const valueSets = {};
  const disqualified = {};
  for (const f of features) {
    const props = f && f.properties;
    if (!props || typeof props !== 'object') continue;
    for (const key of Object.keys(props)) {
      if (disqualified[key]) continue;
      const v = props[key];
      if (v === null || v === undefined || v === '') continue;
      const set = valueSets[key] || (valueSets[key] = new Set());
      set.add(String(v));
      if (set.size > ATTR_VALUE_CARDINALITY_CAP) { disqualified[key] = true; delete valueSets[key]; }
    }
  }
  const out = {};
  for (const key of Object.keys(valueSets)) {
    const values = Array.from(valueSets[key]).sort();
    if (values.length) out[key] = values;
  }
  return out;
}

// Same value+label computation JS/layer-filter.js's onLayerLoaded() does client-side,
// run once here over the complete dataset instead - see JS/layer-filter.js's
// _populateFromManifest().
function computeFilterOptions(features, cfg) {
  const seen = new Set();
  const items = [];
  for (const f of features) {
    const props = (f && f.properties) || {};
    const key = props[cfg.filterField];
    if (key == null || seen.has(key)) continue;
    seen.add(key);
    items.push(props);
  }
  items.sort((a, b) => {
    const va = a[cfg.filterField], vb = b[cfg.filterField];
    const na = Number(va), nb = Number(vb);
    if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
    return String(va || '').localeCompare(String(vb || ''));
  });
  const sep = cfg.separator || ' – ';
  const dFields = cfg.displayFields || [cfg.filterField];
  return items.map((props) => ({
    value: props[cfg.filterField],
    label: dFields.map((f) => (props[f] != null ? String(props[f]) : '')).join(sep)
  }));
}

// ── Tiling ────────────────────────────────────────────────────────────────────────

function checkTippecanoe() {
  const res = spawnSync('tippecanoe', ['--version'], { encoding: 'utf8' });
  if (res.error || res.status !== 0) {
    console.error(
      '\ntippecanoe was not found on PATH. See tools/README.md for three ways to get it\n' +
      '(native install, WSL + apt, or a Docker-wrapping shell alias), or re-run with\n' +
      '--manifest-only to just rebuild data/dataset-manifest.json without tiling.\n'
    );
    return false;
  }
  console.log('Using ' + res.stdout.trim());
  return true;
}

function tileOne(entry, isNoDropLayer) {
  const srcPath = path.join(DATA_DIR, ...entry.info.geojson.split('/'));
  const destPath = path.join(DATA_DIR, ...entry.info.file.split('/'));

  if (!existsSync(srcPath)) {
    console.warn('  SKIP (source missing): ' + entry.info.geojson);
    return;
  }
  if (!FLAG_FORCE && existsSync(destPath) && statSync(destPath).mtimeMs >= statSync(srcPath).mtimeMs) {
    console.log('  up to date: ' + entry.info.file);
    return;
  }

  mkdirSync(path.dirname(destPath), { recursive: true });
  const args = [
    '-o', destPath,
    '-f', // overwrite
    '-zg', // guess an appropriate max zoom from feature density
    '--drop-densest-as-needed',
    '--extend-zooms-if-still-dropping',
    '--generate-ids', // stable per-feature ids, used by JS/pmtiles-loader.js to dedupe features that straddle a tile boundary
  ];
  if (entry.info.geom === 'point') {
    // tippecanoe's default --drop-rate is 2.5: below the max zoom every point layer
    // keeps only 1/2.5 (40%) of the previous zoom's points - measured on the existing
    // archives (TrAccidents: 14231 -> 5712 -> 2288 -> 915 at consecutive zooms below
    // the top one). That left most points missing at city scale and made the client's
    // cluster counts (JS/layer-control.js clusterPointFeatures) undercount, since it
    // clusters whatever the tiles contain. The client already does the visual
    // thinning for points (clustering), so keep them all; --drop-densest-as-needed
    // above is still the safety valve for tiles that would exceed the size limit.
    args.push('--drop-rate=1');
  }
  if (isNoDropLayer) {
    // JS/layer-filter.js's getAllFeatures() path needs these two datasets to be
    // exhaustive, not just visually-representative - see tools/README.md.
    args.push('--no-feature-limit', '--no-tile-size-limit');
  }
  args.push(srcPath);

  const srcSize = statSync(srcPath).size;
  console.log('  tiling ' + entry.info.geojson + ' (' + (srcSize / 1048576).toFixed(1) + 'MB) -> ' + entry.info.file + (isNoDropLayer ? ' [no-drop]' : '') + ' ...');
  const res = spawnSync('tippecanoe', args, { stdio: 'inherit' });
  if (res.status !== 0) {
    console.error('  FAILED: ' + entry.info.file);
    return;
  }
  const destSize = statSync(destPath).size;
  console.log('  done: ' + entry.info.file + ' (' + (destSize / 1048576).toFixed(1) + 'MB)');
}

// ── Manifest ──────────────────────────────────────────────────────────────────────

function manifestOne(entry, filterCfgByName) {
  const relPath = entry.info.geojson || entry.info.file;
  const srcPath = path.join(DATA_DIR, ...relPath.split('/'));
  if (!existsSync(srcPath)) {
    console.warn('  SKIP (source missing): ' + relPath);
    return null;
  }

  let data;
  try {
    data = JSON.parse(readFileSync(srcPath, 'utf8'));
  } catch (e) {
    console.warn('  SKIP (failed to parse): ' + relPath + ' - ' + e.message);
    return null;
  }
  const features = (data && data.features) || [];

  const out = {
    fields: sampleFieldNames(features),
    attributeValues: getAttributeValues(features),
    featureCount: features.length,
    bbox: walkBbox(features)
  };

  const filterCfg = filterCfgByName[entry.info.name];
  if (filterCfg) out.filterOptions = computeFilterOptions(features, filterCfg);

  return { key: relPath, value: out };
}

// ── Main ──────────────────────────────────────────────────────────────────────────

function main() {
  const layerCategories = loadLayerCategories();
  const layerFilterConfigs = loadLayerFilterConfigs();
  let entries = flattenCategories(layerCategories).filter((e) => e.info && e.info.name && e.info.file);

  if (FILTER_ARG) {
    const needle = FILTER_ARG.toLowerCase();
    entries = entries.filter((e) => e.info.file.toLowerCase().includes(needle) || e.info.name.toLowerCase().includes(needle));
    console.log('Filtered to ' + entries.length + ' entr' + (entries.length === 1 ? 'y' : 'ies') + ' matching "' + FILTER_ARG + '"');
  }

  const tiledEntries = entries.filter((e) => e.info.type !== 'raster' && e.info.geojson);
  const vectorEntries = entries.filter((e) => e.info.type !== 'raster');

  if (!FLAG_MANIFEST_ONLY) {
    console.log('\n=== Tiling ' + tiledEntries.length + ' layer(s) ===');
    if (tiledEntries.length && checkTippecanoe()) {
      tiledEntries.forEach((e) => {
        const isNoDropLayer = !!layerFilterConfigs[e.info.name];
        tileOne(e, isNoDropLayer);
      });
    }
  }

  if (!FLAG_TILES_ONLY) {
    console.log('\n=== Building manifest for ' + vectorEntries.length + ' layer(s) ===');
    const manifest = existsSync(MANIFEST_PATH)
      ? JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
      : {};
    let built = 0, skipped = 0;
    vectorEntries.forEach((e) => {
      const result = manifestOne(e, layerFilterConfigs);
      if (result) { manifest[result.key] = result.value; built++; }
      else skipped++;
    });
    writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
    console.log('Wrote ' + MANIFEST_PATH + ' (' + built + ' updated, ' + skipped + ' skipped, ' + Object.keys(manifest).length + ' total entries)');
  }

  console.log('\nDone. Upload data/ (including any new/changed .pmtiles and dataset-manifest.json) to R2 the same way you do today.');
}

main();
