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
