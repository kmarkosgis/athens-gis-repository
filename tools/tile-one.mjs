#!/usr/bin/env node
// Builds the .pmtiles of ONE layer file that is already on R2, and stores it beside its source.
// Run by .github/workflows/build-pmtiles.yml after an upload from the dashboard (or by hand from the
// Actions tab). The options come from tools/tile-options.mjs, the same file tools/build-pmtiles.mjs uses.
//
//   node tools/tile-one.mjs "Environment/attica_trees.geojson"      build and upload
//   node tools/tile-one.mjs "Environment/attica_trees.geojson" --dry-run   only print what would run
//   node tools/tile-one.mjs "Environment/attica_trees.geojson" --test      store as attica_trees.test.pmtiles,
//                                                                          leaving the live tiles alone
//
// Needs on PATH: tippecanoe (the version in tile-options.mjs) and the `aws` CLI. Needs in the environment:
// R2_ACCOUNT_ID, R2_BUCKET, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY (an R2 token that may read and write
// the bucket). The file is read through the R2 API, not from data.athensgis.gr: that address refuses
// requests that do not come from a browser.

import { spawnSync } from 'node:child_process';
import { closeSync, mkdtempSync, openSync, readSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { TILE_THRESHOLD_BYTES, TIPPECANOE_VERSION, isTileSource, layerNameOf, tileArgs, tilesKeyOf } from './tile-options.mjs';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const TEST = args.includes('--test');
const key = args.find((a) => !a.startsWith('--'));

function fail(message) {
  console.error('ERROR: ' + message);
  process.exit(1);
}

if (!isTileSource(key)) fail('Give one layer file as "Folder/Name.geojson" or "Folder/Name.json" (the path under data/).');

const env = process.env;
const bucket = env.R2_BUCKET || 'athens-gis-data';
if (!DRY_RUN) {
  for (const name of ['R2_ACCOUNT_ID', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY']) if (!env[name]) fail(name + ' is not set.');
  if (!/^[0-9a-f]{32}$/i.test(env.R2_ACCOUNT_ID)) fail('R2_ACCOUNT_ID does not look like a Cloudflare account id.');
}
const endpoint = 'https://' + (env.R2_ACCOUNT_ID || 'ACCOUNT_ID') + '.r2.cloudflarestorage.com';

const work = DRY_RUN ? path.join(tmpdir(), 'tiles-dry-run') : mkdtempSync(path.join(tmpdir(), 'tiles-'));
const src = path.join(work, 'source.' + key.split('.').pop().toLowerCase());
const dest = path.join(work, 'out.pmtiles');
// A test build is stored under another name, so the tiles the site is using are not replaced.
const tilesKey = TEST ? tilesKeyOf(key).replace(/\.pmtiles$/, '.test.pmtiles') : tilesKeyOf(key);

// Every command is run as a list of arguments, never through a shell, so a file name cannot become a command.
function run(command, list, { capture = false } = {}) {
  console.log('> ' + command + ' ' + list.map((a) => (/[^A-Za-z0-9_./:=-]/.test(a) ? JSON.stringify(a) : a)).join(' '));
  if (DRY_RUN) return '';
  const res = spawnSync(command, list, { stdio: capture ? ['ignore', 'pipe', 'inherit'] : 'inherit', encoding: 'utf8' });
  if (res.error) fail(command + ' could not be started: ' + res.error.message);
  if (res.status !== 0) fail(command + ' ended with code ' + res.status + '.');
  return capture ? res.stdout : '';
}
const s3 = (...list) => ['s3', ...list, '--endpoint-url', endpoint, '--region', 'auto', '--only-show-errors'];

/** 'point' when the file's first geometries are points, else null. Reads only the start of the file. */
function geomOf(file) {
  const fd = openSync(file, 'r');
  try {
    const buffer = Buffer.alloc(2 * 1024 * 1024);
    const text = buffer.toString('utf8', 0, readSync(fd, buffer, 0, buffer.length, 0));
    const match = text.match(/"geometry"\s*:\s*\{\s*"type"\s*:\s*"([A-Za-z]+)"/) || text.match(/"type"\s*:\s*"(Point|MultiPoint|LineString|MultiLineString|Polygon|MultiPolygon)"/);
    return match && /Point$/.test(match[1]) ? 'point' : null;
  } finally {
    closeSync(fd);
  }
}

// 1. tippecanoe must be the version the site's tiles are built with.
if (!DRY_RUN) {
  const version = spawnSync('tippecanoe', ['--version'], { encoding: 'utf8' });
  const text = (version.stdout || '') + (version.stderr || '');
  if (version.error) fail('tippecanoe was not found on PATH.');
  if (!text.includes('v' + TIPPECANOE_VERSION)) fail('tippecanoe is "' + text.trim() + '", but the site\'s tiles are built with v' + TIPPECANOE_VERSION + '.');
}

// 2. The source, from R2.
run('aws', s3('cp', 's3://' + bucket + '/data/' + key, src));
const size = DRY_RUN ? TILE_THRESHOLD_BYTES : statSync(src).size;
if (size < TILE_THRESHOLD_BYTES) {
  console.log('The file is ' + size + ' bytes, under ' + TILE_THRESHOLD_BYTES + ': it is drawn from the geojson and needs no tiles. Nothing built.');
  process.exit(0);
}

// 3. The tiles.
const geom = DRY_RUN ? null : geomOf(src);
run('tippecanoe', tileArgs({ src, dest, layerName: layerNameOf(key), geom }));
if (!DRY_RUN && statSync(dest).size === 0) fail('tippecanoe wrote an empty file.');

// 4. Beside the source on R2. The dashboard sees the new object and marks the tiles as ready.
run('aws', s3('cp', dest, 's3://' + bucket + '/data/' + tilesKey, '--content-type', 'application/octet-stream'));
console.log((DRY_RUN ? 'Would store ' : 'Stored ') + 'data/' + tilesKey + (DRY_RUN ? '' : ' (' + statSync(dest).size + ' bytes, from ' + size + ')') + '.');
