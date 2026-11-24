# Athens GIS Repository

An open-access, browser-based GIS for the Athens Metropolitan Area, the Attica region and
selected nationwide layers of Greece. It brings public data from ministries, regional and
municipal authorities, transport operators, European agencies and community mapping into one
map. Every layer can be viewed in the browser, comes with a description of its source,
coverage and date, and can be downloaded in an open format (GeoJSON, or GeoTIFF for rasters).
No account or install is needed.

Live site: [athensgis.gr](https://athensgis.gr)

Copyright © 2026 Athens GIS Repository. Licensed under Creative Commons Attribution 4.0
International (CC BY 4.0).

[![DOI](https://zenodo.org/badge/DOI/10.5281/zenodo.18727779.svg)](https://doi.org/10.5281/zenodo.18727779)
[![PeekWell accreditation](https://app.peekwell.org/a/8OnXqKbIfiS26HnDFCt8msgfQkbnHxAH/badge.svg)](https://app.peekwell.org/a/8OnXqKbIfiS26HnDFCt8msgfQkbnHxAH/)

## The map

`index.html` is a Leaflet map with these tools:

- **Layers panel**: close to 90 layers in eight categories: Administrative Boundaries,
  Transportation Systems, Environment, Points of Interest, Population and Social Conditions,
  Natural Hazards, Urban Planning and Land Cover, and Energy. Each layer can be recoloured,
  filtered by an attribute value and downloaded as a ZIP. A Terrain layer (contour lines) is
  always available.
- **Layer information**: the description of each open layer (source, coverage, date,
  contributors) and a metadata score from 0 to 100 that rates how completely the layer is
  documented. Clicking a feature shows its attributes.
- **Legend** for every open layer.
- **Database search** by layer name, description or attribute value, and **Athena** (beta), an
  assistant that finds, opens and closes layers from a plain-language request.
- **Address search**, **basemaps** (light, dark, OpenStreetMap, satellite), **opacity** and
  **draw order** controls, **zoom to the open layers** and **distance measurement**.
- **Export**: a landscape or portrait PNG of the current view, with a title band, the open
  layers, a legend, a scale bar and a locator inset. The inset shows Attica, or all of Greece
  when an open layer covers the whole country.
- **Citation**: a ready-made reference to the repository, ready to copy.
- A welcome dialog, a short guided tour and site announcements.

## The 3D Viewer

`3d-viewer.html` shows buildings at their real height, trees and terrain, with the sun and
shadows for any date and time, measurement and image export. Its Route Shade tool charts how
much of a walking route is in shade through the day. The model is geometric: it cannot see
arcades, awnings, the transparency of foliage or roof shapes, and it says so on the page.

## How it is built

- A static site (HTML, CSS and plain JavaScript) with no server-side database, hosted on GitHub.
- Datasets (`data/`) and layer descriptions (`info/`) are served from Cloudflare R2 at
  `data.athensgis.gr`. Large vector layers are stored as PMTiles, and the browser fetches only
  the tiles covering the current view.
- The list of layers, the legends, the attribute names and the site announcements are read from
  JSON files on R2 (`layers.json`, `legends.json`, `attribute-names.json`, `site-state.json`).
  The layer list and attribute names written in the code are kept as a backup in case those
  files cannot be loaded.
- Athena runs as a Cloudflare Worker (`athens-gis-worker/`) on Workers AI. It answers only
  requests from athensgis.gr, with rate limiting. Messages and a short description of the
  catalogue are sent to the service, so users are asked not to enter personal information.
- Libraries: Leaflet, Leaflet.draw, Turf.js, PMTiles, JSZip, FileSaver.js and Fuse.js, plus
  georaster-layer-for-leaflet for rasters.

## Repository structure

- `index.html`: the main map.
- `3d-viewer.html` and `code_3D/`: the 3D Viewer.
- `about.html`: the About page, with the sources and the data structure.
- `privacy.html`: the privacy and cookie policy (text in `info/legal.txt`).
- `style.css`: styles for all pages.
- `JS/`: map behaviour. Among the main scripts are `map-init.js` (map and basemaps),
  `layer-control.js` (layers panel, loading and styling), `pmtiles-loader.js`, `legend.js`,
  `info-box.js`, `metadata-score.js`, `layer-filter.js`, `dataset-search.js` (database search
  and Athena), `export.js` (map export, with `attica-outline.js` and `greece-outline.js` for its
  locator inset), `measure.js`, `citation.js`, `welcome.js` and `tour.js`.
- `images/`: logo, favicon and other images.
- `tools/`: build scripts for vector tiles, the export outlines, the attribute report and the
  `?v=` version stamps that make browsers load new copies of changed scripts. See
  [tools/README.md](tools/README.md).
- `athens-gis-worker/`: the Cloudflare Worker behind Athena (a separate npm project, deployed
  with `wrangler deploy`).
- `CITATION.cff`: citation metadata.

## About the data

- Coverage is Athens and Attica, plus selected nationwide layers.
- Data is provided as-is. Completeness varies, especially for layers based on OpenStreetMap.
  Hazard and planning layers are general, not site-specific or legally binding. Cadastral
  parcels are for visualisation only.
- Layers and features are added over time.

## Citation

Please cite the repository through its Zenodo DOI,
[10.5281/zenodo.18727779](https://doi.org/10.5281/zenodo.18727779), or use the metadata in
`CITATION.cff`. The citation button on the map gives a ready-made reference.

## Licence

Creative Commons Attribution 4.0 International (CC BY 4.0).
