#!/usr/bin/env node
// Builds the two small, simplified outlines used by the map export's locator inset (the little
// "you are here" map in the export's side panel):
//
//  JS/attica-outline.js (window.ATTICA_OUTLINE): the 8 Attica regional units in
//    data/Boundaries/GrRegions.geojson (the 4 Athens sectors, East Attica, West Attica, Piraeus,
//    Islands). Far-off islands (Kythira, Antikythera) are left out so the mainland and the
//    Saronic islands get the space in the inset.
//  JS/greece-outline.js (window.GREECE_OUTLINE): every unit in the same file, i.e. all of Greece,
//    simplified much harder. The export uses it instead when an active layer covers Greece.
//
// Usage (run from anywhere):
//   node tools/build-attica-outline.mjs
//
// Re-run it only if the boundary data changes - the output is committed with the site.

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(REPO_ROOT, 'data', 'Boundaries', 'GrRegions.geojson');

const UNIT_PREFIX = 'ΠΕΡΙΦΕΡΕΙΑΚΗ ΕΝΟΤΗΤΑ ';
const ATTICA_UNITS = new Set([
  'ΚΕΝΤΡΙΚΟΥ ΤΟΜΕΑ ΑΘΗΝΩΝ', 'ΒΟΡΕΙΟΥ ΤΟΜΕΑ ΑΘΗΝΩΝ', 'ΔΥΤΙΚΟΥ ΤΟΜΕΑ ΑΘΗΝΩΝ', 'ΝΟΤΙΟΥ ΤΟΜΕΑ ΑΘΗΝΩΝ',
  'ΑΝΑΤΟΛΙΚΗΣ ΑΤΤΙΚΗΣ', 'ΔΥΤΙΚΗΣ ΑΤΤΙΚΗΣ', 'ΠΕΙΡΑΙΩΣ', 'ΝΗΣΩΝ'
]);

const OUTLINES = [
  {
    name: 'Attica',
    output: path.join(REPO_ROOT, 'JS', 'attica-outline.js'),
    globalName: 'ATTICA_OUTLINE',
    units: ATTICA_UNITS,       // only these regional units
    minLat: 37.2,              // polygons entirely south of this are dropped (Kythira & co.)
    tolerance: 0.0015,         // Douglas-Peucker tolerance, degrees (~170 m)
    minArea: 2.5e-5,           // drop islets smaller than this, square degrees (<1 px in the inset)
    decimals: 3
  },
  {
    name: 'Greece',
    output: path.join(REPO_ROOT, 'JS', 'greece-outline.js'),
    globalName: 'GREECE_OUTLINE',
    units: null,               // every feature in the file
    minLat: -Infinity,
    tolerance: 0.02,           // ~2 km: Greece is ~10 degrees across in a ~300 px inset
    minArea: 3e-3,             // drop islands under ~2 px in the inset (Kastellorizo, Gavdos & co.)
    decimals: 2
  }
];

// Douglas-Peucker on an open polyline of [x, y] points.
function simplify(points, tol) {
  if (points.length < 3) return points;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let maxD = 0, idx = -1;
    const [ax, ay] = points[a], [bx, by] = points[b];
    const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = points[i];
      let d;
      if (len2 === 0) d = Math.hypot(px - ax, py - ay);
      else {
        const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
        d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
      }
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > tol) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return points.filter((_, i) => keep[i]);
}

function ringArea(ring) {
  let s = 0;
  for (let i = 0; i < ring.length - 1; i++) s += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  return Math.abs(s) / 2;
}

const geojson = JSON.parse(readFileSync(SOURCE, 'utf8'));

function buildOutline(cfg) {
  const units = geojson.features.filter((f) => {
    if (!cfg.units) return true;
    const name = String(f.properties?.name || '');
    return name.startsWith(UNIT_PREFIX) && cfg.units.has(name.slice(UNIT_PREFIX.length));
  });
  if (cfg.units && units.length !== cfg.units.size) {
    console.error(`Expected ${cfg.units.size} ${cfg.name} units in ${SOURCE}, found ${units.length}`);
    process.exit(1);
  }

  const polygons = [];
  let sourceRings = 0;
  for (const f of units) {
    const geoms = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    for (const poly of geoms) {
      const outer = poly[0];                       // holes are irrelevant for a silhouette
      sourceRings++;
      if (Math.max(...outer.map((p) => p[1])) < cfg.minLat) continue;
      if (ringArea(outer) < cfg.minArea) continue;
      const simple = simplify(outer.slice(0, -1), cfg.tolerance);   // drop the closing duplicate point
      const flat = [];
      let last = null;
      for (const [x, y] of simple) {
        const key = x.toFixed(cfg.decimals) + ',' + y.toFixed(cfg.decimals);
        if (key === last) continue;
        last = key;
        flat.push(+x.toFixed(cfg.decimals), +y.toFixed(cfg.decimals));
      }
      if (flat.length >= 6) polygons.push(flat);
    }
  }

  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity;
  for (const flat of polygons) {
    for (let i = 0; i < flat.length; i += 2) {
      minLon = Math.min(minLon, flat[i]); maxLon = Math.max(maxLon, flat[i]);
      minLat = Math.min(minLat, flat[i + 1]); maxLat = Math.max(maxLat, flat[i + 1]);
    }
  }

  const out = {
    bbox: [minLon, minLat, maxLon, maxLat],
    polygons
  };
  const header = [
    '// Generated by tools/build-attica-outline.mjs from data/Boundaries/GrRegions.geojson - do not edit by hand.',
    `// Simplified ${cfg.name} outline for the map export locator inset: bbox is [minLon, minLat, maxLon, maxLat],`,
    '// each polygon is one flat [lon, lat, lon, lat, ...] outer ring (degrees).',
    ''
  ].join('\n');
  const text = header + 'window.' + cfg.globalName + ' = ' + JSON.stringify(out) + ';\n';
  writeFileSync(cfg.output, text);

  const vertices = polygons.reduce((n, p) => n + p.length / 2, 0);
  console.log(`Wrote ${path.relative(REPO_ROOT, cfg.output)}: ${polygons.length}/${sourceRings} polygons, ${vertices} vertices, ${text.length} bytes, bbox ${out.bbox.join(', ')}`);
}

OUTLINES.forEach(buildOutline);
