// 3D Viewer settings - the one place to change data paths, the start view and the
// building color ramp. Loaded after JS/config.js (window.CONFIG.R2_BASE_URL).
//
// Data paths are relative to data/ (same as the main page's layer list) and are
// served from R2 when CONFIG.R2_BASE_URL is set, otherwise from the local data/ folder.
// For testing a file before it is uploaded, override either one in the page URL:
//   3d-viewer.html?buildings=<url or data path>&terrain=<url or data path>
// (&height=<field> and &encoding=mapbox|terrarium can be added too.)
(function () {
  var ns = window.Athens3D = window.Athens3D || {};

  ns.config = {
    // Light vector basemap (the same CARTO Positron look as the main page's "Light Basemap").
    basemapStyle: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',

    view: {
      center: [23.7275, 37.9750],  // Athens centre (Acropolis / Syntagma)
      zoom: 15,
      pitch: 60,
      bearing: -20,
      minZoom: 8,
      maxZoom: 19,
      // Steep tilts show the horizon, which loads and draws a huge number of far tiles.
      maxPitch: 75,
      maxPixelRatio: 1.5,     // the map is drawn at no more than this many pixels per CSS pixel
      phoneTileCache: 30      // tiles each source keeps in memory on phones (null = MapLibre's default)
    },

    // 3D buildings: PMTiles vector archive of polygons with a height attribute.
    buildings: {
      file: '3D/athens_buildings.pmtiles',
      // Vector layer name inside the archive. null = use the first layer in its metadata.
      sourceLayer: null,
      // Height attribute (metres). null = detect it from the archive's field list,
      // trying these names in order.
      heightField: null,
      heightFieldCandidates: ['height', 'Height', 'HEIGHT', 'height_m', 'HEIGHT_M', 'bldg_height', 'building_height', 'hgt', 'h'],
      // Optional attribute for the base height (e.g. a building part raised off the ground).
      baseField: null,
      // Light, so walls facing the sun read clearly against the shaded ones.
      // Buildings are only drawn (and their tiles only downloaded) from this zoom in:
      // the archive's lower-zoom tiles hold every building and are ~1 MB each.
      minZoom: 14,
      // Height (metres) of a building with no usable height (missing, empty, not a
      // number, or 0 or less), so it is still drawn - and casts a shadow.
      defaultHeight: 1,
      neutralColor: '#eceef1',
      opacity: 1,
      // Light-to-dark ramp used when "Color by height" is switched on.
      // Each class covers [from, next from) metres; the last one is open-ended.
      ramp: [
        { from: 0,  color: '#e3e9f0' },
        { from: 6,  color: '#c3d0de' },
        { from: 12, color: '#9db1c8' },
        { from: 18, color: '#7690b0' },
        { from: 25, color: '#566f92' },
        { from: 35, color: '#3a4d6b' },
        { from: 50, color: '#232f45' }
      ]
    },

    // Landmark models: real 3D models (glTF / GLB) drawn in place of the plain block of
    // chosen buildings (code_3D/landmarks.js). Files are paths under data/ (R2) or full URLs.
    // Model files: units in metres, Y up, origin at the middle of the building at ground
    // level, front of the building toward +Z (south when rotate is 0).
    //   name        label (for messages)
    //   file        e.g. '3D/models/parthenon.glb'
    //   lon, lat    where the model's origin goes (WGS84)
    //   rotate      degrees clockwise, seen from above (default 0)
    //   scale       multiplier (default 1 = true size)
    //   lift        metres above the ground (default 0)
    //   hideRadius  metres: any building whose outline comes within this distance of
    //               lon/lat is not drawn as a plain block (default 1 = just the building
    //               the point is in; 0 = hide nothing; a large value also hides neighbours)
    landmarks: {
      minZoom: 14,
      models: [
        // { name: 'Parthenon', file: '3D/models/parthenon.glb', lon: 23.72675, lat: 37.97150, rotate: 0 }
      ]
    },

    // Parks and gardens painted green on the ground (same files as the main page's
    // Parks / Gardens layers). A missing file is skipped quietly.
    greens: {
      color: '#6cc24a',
      opacity: 0.9,
      parks: { file: 'UrbanPlanning/Parks.pmtiles', sourceLayer: null },   // null = first layer in the archive
      gardens: { file: 'UrbanPlanning/Gardens.geojson' }
    },

    // Trees: a PMTiles archive of points with a height attribute (metres). Each point
    // becomes a small 3D tree (trunk + tiered crown) while zoomed in close.
    trees: {
      file: '3D/athens_trees.pmtiles',
      sourceLayer: null,            // null = first layer in the archive
      heightField: 'height',
      familyField: 'family',
      minZoom: 15,                  // trees are drawn from this zoom in
      extentBuffer: 500,            // trees only within the buildings data's extent + this many metres
      maxTrees: 11000,             // most trees built at once (the nearest to the view centre)
      ringSides: 10,                 // corners of each tree slice's outline (fewer = lighter geometry)
      slices: { round: 7, conifer: 7, palm: 5 },   // stacked tiers in a crown (fewer = lighter geometry)
      defaultHeight: 6,             // for a tree with no usable height
      conifers: ['Cupressaceae', 'Pinaceae', 'Araucariaceae', 'Taxaceae'],
      palms: ['Arecaceae', 'Palmaceae'],
      trunkColor: '#8a6a4f',
      crownColors: ['#6fae62', '#5f9f58', '#7bb56b', '#68a85d'],   // varied per tree
      coniferColors: ['#3f7d4e', '#488756'],
      palmColors: ['#5d9a4c', '#6aa656']
    },

    // Terrain. file = a custom PMTiles raster-DEM archive on R2; null = use the public
    // terrain under `fallback` below. Current file: FABDEM V1-2 (University of Bristol,
    // Copernicus GLO-30 with buildings and forests removed, 30 m), Terrarium PNG tiles,
    // zoom 6-12. FABDEM is licensed CC BY-NC-SA 4.0 (non-commercial).
    // Other files on R2: '3D/terrain_gedtm30.pmtiles' (GEDTM30, CC BY 4.0) and
    // '3D/terrain_glo30.pmtiles' (Copernicus GLO-30, a surface model that includes roofs
    // and tree canopy).
    terrain: {
      file: '3D/terrain_fabdem.pmtiles',
      attribution: 'Terrain: FABDEM © <a href="https://data.bris.ac.uk/data/dataset/s5hqmjcdj8yo2ibzi9b4ew3sn">University of Bristol</a> (CC BY-NC-SA 4.0), from Copernicus DEM GLO-30',
      encoding: 'terrarium',       // how heights are stored in a custom file: 'terrarium' or 'mapbox' (rio-rgbify output)
      exaggeration: 1,             // 1 = true scale, so buildings and hills match
      hillshade: true,
      // Hillshade look with the sun lighting switched off (code_3D/sun.js changes
      // these with the sun's direction and height while it's on).
      hillshadePaint: {
        'hillshade-exaggeration': 0.35,
        'hillshade-shadow-color': '#5b6678',
        'hillshade-highlight-color': '#ffffff',
        'hillshade-accent-color': '#8a94a6'
      },
      // Public terrain, used when file is null or the custom file can't be loaded.
      // Mapterhorn: Copernicus DEM GLO-30 over Greece, 512 px Terrarium WebP tiles up to
      // zoom 12 here (~15 m per pixel at Athens). It matched known summit heights better
      // than the older Mapzen / AWS Terrain Tiles ('https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
      // 256 px, maxzoom 15). Set to null to show no terrain instead.
      fallback: {
        tiles: ['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
        encoding: 'terrarium',
        tileSize: 512,
        maxzoom: 12,
        attribution: 'Terrain: <a href="https://mapterhorn.com/attribution">© Mapterhorn</a> (Copernicus DEM GLO-30)'
      }
    },

    // Streets a touch darker than the light land behind them (the basemap draws them
    // white on near-white). Set to null for the basemap's own colours.
    streets: {
      fill: '#e2e4e8',         // road surface
      casing: '#cfd3d9',       // thin outline around it
      bridgeCasing: '#c2c7ce'
    },

    // Daytime sky (also the look with the sun lighting switched off).
    sky: {
      'sky-color': '#c9dbee',
      'horizon-color': '#eef2f7',
      'fog-color': '#f3f5f8',
      'sky-horizon-blend': 0.6,
      'horizon-fog-blend': 0.7,
      'fog-ground-blend': 0.85
    },

    // Sun panel (code_3D/sun.js): the sun is computed for this point, and the
    // panel's date/time fields are in this time zone, whatever the viewer's own.
    sun: {
      location: [23.7275, 37.9750],   // Athens
      timeZone: 'Europe/Athens',
      speeds: [1, 5, 15, 30, 60, 180, 1440],  // simulated minutes per second for Play
      defaultSpeed: 30
    },

    // Sun shadows (code_3D/shadows.js): a shadow map of the area in view, cast by the
    // buildings and the terrain.
    shadows: {
      radius: 1500,            // metres around the map centre with building shadows
      extentBuffer: 1000,      // shadows only within the buildings data's extent + this many metres
      extentFade: 150,         // metres over which they fade out at that edge
      terrainRadius: 9000,     // hill shadows only for what's on screen, at most this far from the centre
      casterMargin: 1500,      // metres around the view still read for hills shading into it
      terrainMinPixel: 8,      // metres: hill-shadow detail when zoomed in
      minZoom: 14.6,           // building shadows from this zoom in
      terrainMinZoom: 10,      // hill shadows from this zoom in
      maxSize: 2048,           // shadow map size, pixels (desktop)
      maxSizePhone: 1024,
      playMaxSize: 1024,       // shadow map size while the sun plays (full size again on pause)
      playCoarse: 500,         // hill-shadow model size while the sun plays
      playGapMs: 300,          // least time between shadow updates while the sun plays
      color: '#1d2a48',        // cool blue-grey shade
      groundOpacity: 0.22,     // strength on the ground and terrain
      buildingOpacity: 0.3     // strength on roofs and walls
    },

    // Route shade tool (code_3D/route-shade.js): a route drawn on the map, and how
    // much of it is in the shade through the day shown in the sun panel.
    routeShade: {
      minZoom: 15,             // drawing a route needs this zoom (buildings and trees loaded)
      spacing: 5,              // metres between the points tested along the route
      maxSamples: 1500,        // most points tested (spaced out more on a long route)
      stepMinutes: 10,         // time step of the chart
      elevSmooth: 30,          // metres: the elevation profile is smoothed this much before ascent/descent are added up
      eyeHeight: 1.5,         // metres above the ground tested for sun (a walker's head)
      margin: 400,             // metres around the route read for buildings and trees casting shade on it
      pixel: 1,                // metres: detail of that height model (coarser for a long route)
      maxSize: 2048,           // largest height model, pixels a side
      hillMargin: 6000,        // metres around the route read for hills casting shade on it
      hillPixel: 20,           // metres: detail of the hill model
      hillMaxSize: 600,
      sunColor: '#f2b632',
      shadeColor: '#33476e',
      nightColor: '#8a93a3'
    },

    // Buffer before the loading circle can show: never while the user is still
    // panning/zooming/rotating, and even then only after this many ms of them
    // being still, so a quick adjustment or a fast tile load never flashes it.
    loadingDelayMs: 350,
    // Never keep the map locked longer than this, even if a request hangs.
    loadingMaxMs: 25000
  };

  // Turns a data path ("UrbanPlanning/x.pmtiles") or a full URL into the URL to fetch.
  ns.dataUrl = function (pathOrUrl) {
    if (!pathOrUrl) return null;
    if (/^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
    var rel = String(pathOrUrl).replace(/^\.?\/?(data\/)?/, '');
    var encoded = rel.split('/').map(encodeURIComponent).join('/');
    var r2 = window.CONFIG && window.CONFIG.R2_BASE_URL ? String(window.CONFIG.R2_BASE_URL).replace(/\/+$/, '') : null;
    if (r2) return r2 + '/data/' + encoded;
    return new URL('data/' + encoded, window.location.href).href;
  };

  // ?buildings= / ?terrain= overrides for testing.
  try {
    var params = new URLSearchParams(window.location.search);
    if (params.get('buildings')) ns.config.buildings.file = params.get('buildings');
    if (params.get('terrain')) ns.config.terrain.file = params.get('terrain');
    if (params.get('parks')) ns.config.greens.parks.file = params.get('parks');
    if (params.get('gardens')) ns.config.greens.gardens.file = params.get('gardens');
    if (params.get('trees')) ns.config.trees.file = params.get('trees');
    if (params.get('encoding')) ns.config.terrain.encoding = params.get('encoding');
    if (params.get('height')) ns.config.buildings.heightField = params.get('height');
  } catch (e) { /* old browser - keep defaults */ }
})();
