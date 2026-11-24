# tools/build-pmtiles.mjs

Generates `.pmtiles` archives for the site's larger vector layers and
`data/dataset-manifest.json` (per-dataset field/attribute-value/feature-count/bbox
metadata used by the search bar and Athena) from the live `layerCategories` /
`layerFilterConfigs` config in `JS/layer-control.js` / `JS/layer-filter.js` - it reads
those files directly rather than duplicating the layer list, so it can't drift out of
sync.

## 1. Get `tippecanoe` on PATH

Pick whichever is easiest on your machine - the script just runs `tippecanoe ...`:

- **Native (Mac/Linux)**: `brew install tippecanoe` (macOS) or build from
  [felt/tippecanoe](https://github.com/felt/tippecanoe) (the maintained fork).
- **WSL (Windows)**: open your WSL distro and run
  `sudo apt update && sudo apt install -y tippecanoe`, then run the script from
  *inside* WSL (`node` needs to be available there too, or run the script from Windows
  and only shell out to `wsl tippecanoe ...` - simplest is just doing the whole run
  inside WSL).
- **Docker (any OS)**: no official image is required - any image with tippecanoe
  installed works, e.g.
  ```sh
  docker run --rm -v "$PWD":/data ghcr.io/felt/tippecanoe:latest tippecanoe ...
  ```
  wrap that in a shell function/alias named `tippecanoe` on your PATH so the script
  can call it transparently, e.g. in `~/.bashrc`:
  ```sh
  tippecanoe() { docker run --rm -v "$PWD":/work -w /work ghcr.io/felt/tippecanoe:latest tippecanoe "$@"; }
  ```

Verify with `tippecanoe --version` before running the script.

## 2. Run it

From the repo root:

```sh
node tools/build-pmtiles.mjs
```

The largest source file is ~180MB of JSON text - if you hit an out-of-memory error,
increase Node's heap:

```sh
node --max-old-space-size=4096 tools/build-pmtiles.mjs
```

Useful flags:

- `--manifest-only` - skip tippecanoe entirely (no tippecanoe needed), just rebuild
  `data/dataset-manifest.json`. Handy after editing a small (non-tiled) dataset.
- `--tiles-only` - skip the manifest step, just run tippecanoe.
- `--force` - re-tile even if the `.pmtiles` output looks newer than its source
  (normally skipped as an incremental optimization).
- A trailing plain argument filters to matching entries, e.g.
  `node tools/build-pmtiles.mjs Streets_Center` tiles/manifests only that one layer -
  useful for trying a single dataset before running the full batch.

The script is safe to re-run - it skips anything already up to date (unless
`--force`) and reports per-file success/failure without aborting the rest of the batch.

## 3. Upload to R2

There's no CI/sync pipeline in this repo - upload `data/` (the new/changed `.pmtiles`
files and `data/dataset-manifest.json`, alongside the untouched `.geojson`/`.json`)
the same way you already do today.

## 4. Deploying site code (JS/CSS) - cache busting

Cloudflare keeps `JS/*.js` for about 31 days (CSS for 4 hours), so a changed file only
reaches visitors if its URL changes. Before deploying any JS/CSS change, run:

```sh
node tools/bump-versions.mjs            # or --dry-run to preview
```

It rewrites the `?v=` on every local `<script>`/`<link>` in `index.html` / `about.html`
to a hash of the file's current contents, so it changes exactly when the file does. No
Cloudflare purge or hard refresh needed afterwards. `JS/config.js` is skipped (the local
copy isn't the deployed one) - bump its `?v=` by hand if the live copy changes.

Data files (`.geojson`/`.json`/`.txt`/`.pmtiles` on R2) don't need this: the site
revalidates them on every load, so re-uploading under the same name shows up right away.

## 5. tools/build-attica-outline.mjs

Builds `JS/attica-outline.js`, the small simplified Attica outline that the map export draws
in its locator inset (the mini-map next to the logo, with the exported area marked on it). It
reads the 8 Attica regional units from `data/Boundaries/GrRegions.geojson`. It also builds
`JS/greece-outline.js` from every unit in that file: the export draws Greece instead when an
active layer's extent spans at least half of Greece's width or height.

```sh
node tools/build-attica-outline.mjs
```

The generated file is committed with the site and loaded by `index.html` - re-run the script
only if that boundary data changes, then run `bump-versions.mjs` as in step 4.

## 6. tools/build-attribute-report.mjs

Builds `JS/attribute-report.js`, which the metadata score reads for its "Empty attribute fields"
factor (on the map and on the About page). For every vector layer in `layerCategories` it reads the
layer's data file from `data/` and records how many of its attribute values (every field of every
feature) are empty, plus each incomplete field's percentage of filled values - a to-do list for
improving the data. The report is a few KB and ships with the site, so the score never has to read
the layer data itself and does not depend on `data/dataset-manifest.json`.

```sh
node --max-old-space-size=4096 tools/build-attribute-report.mjs            # every vector layer (seconds)
node --max-old-space-size=4096 tools/build-attribute-report.mjs Streets    # only layers matching "Streets"
```

Re-run it after changing a layer's data (a layer that has not been measured simply has this factor
left out of its score), then run `bump-versions.mjs` as in step 4. A layer whose data file is
missing from `data/` or is not a GeoJSON FeatureCollection keeps its previous entry and is reported.

## 7. 3D Viewer data (`3d-viewer.html`, `code_3D/`)

The 3D Viewer reads two PMTiles archives, both set in `code_3D/config3d.js`. Until a file is
uploaded the page still opens: missing buildings are skipped with a notice, and missing terrain
falls back to the public AWS terrain tiles (set `terrain.fallback` to `null` to turn that off).
To try a file before uploading it, open
`3d-viewer.html?buildings=<url or data path>&terrain=<url or data path>`.

**Terrain** - `data/Environment/Terrain_DEM.pmtiles`, built from the `data/Environment/terrain`
GeoTIFF (GGRS87 / EPSG:2100, ~22 m, float32) by `tools/build-terrain-pmtiles.sh` (GDAL +
rio-rgbify + the `pmtiles` CLI; setup steps are in the script header, easiest in WSL):

```sh
bash tools/build-terrain-pmtiles.sh
```

It writes Mapbox Terrain-RGB PNG tiles (`terrain.encoding: 'mapbox'` in the config). The viewer
reads the tile size from the file itself.

**Buildings** - `data/UrbanPlanning/Buildings3D.pmtiles`: polygons with a height attribute in
metres. The viewer uses the archive's first vector layer and finds the height field by name
(`height`, `HEIGHT`, `height_m`, ... see `heightFieldCandidates`). Set `sourceLayer` /
`heightField` in the config if your names differ. Keep every building at every zoom, since
dropped polygons leave gaps in the 3D city:

```sh
tippecanoe -o data/UrbanPlanning/Buildings3D.pmtiles -l buildings -Z 13 -z 16 \
  -y height --no-feature-limit --no-tile-size-limit --force Buildings.geojson
```

The buildings are drawn from the archive's minimum zoom (`-Z`) and over-zoomed past its maximum.
