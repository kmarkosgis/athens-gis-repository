// The tippecanoe options for the site's vector tiles, in one place: tools/build-pmtiles.mjs (run by hand)
// and tools/tile-one.mjs (run by the GitHub job after an upload from the dashboard) both build their
// command from here, so the two cannot drift apart.
//
// Two sets of options exist:
//   'live'   what every .pmtiles on the site was built with up to November 2026 (read from the files' own
//            metadata): guess the max zoom, drop the densest features when a tile is too big.
//   'script' what tools/build-pmtiles.mjs was later changed to use: the same, plus stable feature ids,
//            every point kept at every zoom, and no limits for the layers the attribute filter reads whole.
// The job uses PROFILE below. Change that one word to switch every future build.

/** The tippecanoe release the site's tiles are built with (recorded in each file as "tippecanoe v2.49.0"). */
export const TIPPECANOE_VERSION = '2.49.0';

/** Files under this size are drawn straight from the geojson and get no tiles. */
export const TILE_THRESHOLD_BYTES = 1024 * 1024;

export const PROFILE = 'live';

/**
 * The arguments for one tippecanoe run.
 *   src, dest: the geojson to read and the .pmtiles to write
 *   layerName: the name of the layer inside the tiles (the file's name without its extension)
 *   geom: 'point' | 'line' | 'polygon' | null; noDrop: the attribute filter reads this layer whole
 *   profile: 'live' or 'script' (see above)
 */
export function tileArgs({ src, dest, layerName, geom = null, noDrop = false, profile = PROFILE }) {
  const args = ['-zg', '--drop-densest-as-needed', '--extend-zooms-if-still-dropping', '-q', '-f'];
  if (profile === 'script') {
    args.push('--generate-ids'); // stable per-feature ids, for features that straddle a tile boundary
    if (geom === 'point') args.push('--drop-rate=1'); // keep every point at every zoom; the site clusters them itself
    if (noDrop) args.push('--no-feature-limit', '--no-tile-size-limit');
  }
  args.push('-l', layerName, '-n', layerName, '-o', dest, src);
  return args;
}

/** "Environment/attica_trees.geojson" -> "attica_trees": the layer's name inside its tiles. */
export function layerNameOf(key) {
  const base = String(key).split('/').pop();
  return base.replace(/\.[^.]+$/, '');
}

/** "Environment/attica_trees.geojson" -> "Environment/attica_trees.pmtiles". */
export const tilesKeyOf = (key) => String(key).replace(/\.[^./]+$/, '') + '.pmtiles';

/** True for a source the job may tile: a clean relative path under data/ ending in .geojson or .json. */
export function isTileSource(key) {
  return typeof key === 'string' && /^[A-Za-z0-9 _.()-]+(\/[A-Za-z0-9 _.()-]+)+\.(geojson|json)$/i.test(key) && !key.split('/').some((part) => part.startsWith('.'));
}
