// 3D Viewer map: MapLibre with a light vector basemap, custom terrain (raster-DEM
// PMTiles) and the 3D buildings (vector PMTiles, extruded from their height attribute).
//
// Start-up: the page opens locked (code_3D/loading.js). Both PMTiles archives are
// checked first - a missing one is reported in a notice, never blocks the page - then
// terrain and buildings are added and the lock is released once the map is idle
// (every tile in view loaded). After that, any slow data load locks it again.
(function () {
  var ns = window.Athens3D = window.Athens3D || {};
  var cfg = ns.config;

  var BUILDINGS_SOURCE = 'buildings';
  var BUILDINGS_LAYER = 'buildings-3d';
  var DEM_SOURCE = 'terrain-dem';
  var HILLSHADE_SOURCE = 'hillshade-dem';   // MapLibre wants a separate source for hillshade
  var HILLSHADE_LAYER = 'terrain-hillshade';

  var protocol = new pmtiles.Protocol();
  maplibregl.addProtocol('pmtiles', sharedTile);

  // The 3D terrain and its hillshade are two sources reading the same DEM tiles, so
  // MapLibre asks for every terrain tile twice. This downloads each tile once and
  // hands both a copy, and keeps the last few in memory for when the other one asks
  // a moment later. A download is still cancelled once nobody wants it any more
  // (e.g. after a fast pan), as MapLibre does on its own.
  var TILE_KEEP = 64;           // recently loaded tiles kept (~70 KB each for terrain)
  var tileJobs = new Map();     // pmtiles://.../z/x/y -> { promise, ctrl, waiters }
  function copyTile(r) {
    // Each caller gets its own buffer: MapLibre may hand the data to a worker,
    // which leaves the original empty.
    return Object.assign({}, r, { data: r.data && r.data.slice ? r.data.slice(0) : r.data });
  }
  function sharedTile(params, abortController) {
    var key = params.url;
    if (!/\/\d+\/\d+\/\d+$/.test(key)) return protocol.tile(params, abortController); // TileJSON
    var job = tileJobs.get(key);
    if (job) { tileJobs.delete(key); tileJobs.set(key, job); } // most recently used last
    else {
      job = { waiters: 0, ctrl: new AbortController() };
      job.promise = protocol.tile(params, job.ctrl).then(function (r) {
        job.done = true;
        while (tileJobs.size > TILE_KEEP) tileJobs.delete(tileJobs.keys().next().value);
        return r;
      }, function (err) {
        if (tileJobs.get(key) === job) tileJobs.delete(key);
        throw err;
      });
      tileJobs.set(key, job);
    }
    job.waiters++;
    return new Promise(function (resolve, reject) {
      var settled = false;
      var signal = abortController && abortController.signal;
      function finish() { settled = true; job.waiters--; if (signal) signal.removeEventListener('abort', onAbort); }
      function onAbort() {
        if (settled) return;
        finish();
        if (!job.done && job.waiters <= 0) {
          if (tileJobs.get(key) === job) tileJobs.delete(key);
          job.ctrl.abort();
        }
        var e = new Error('Aborted'); e.name = 'AbortError';
        reject(e);
      }
      if (signal) {
        if (signal.aborted) { onAbort(); return; }
        signal.addEventListener('abort', onAbort);
      }
      job.promise.then(function (r) {
        if (settled) return; finish(); resolve(copyTile(r));
      }, function (err) {
        if (settled) return; finish(); reject(err);
      });
    });
  }

  var phone = !!(window.matchMedia && window.matchMedia('(max-width: 900px)').matches);
  var mapOptions = {
    container: 'map',
    style: cfg.basemapStyle,
    center: cfg.view.center,
    zoom: cfg.view.zoom,
    pitch: cfg.view.pitch,
    bearing: cfg.view.bearing,
    minZoom: cfg.view.minZoom,
    maxZoom: cfg.view.maxZoom,
    maxPitch: cfg.view.maxPitch,
    attributionControl: false,
    // High-density screens would draw 4-9x the pixels for little visible gain.
    pixelRatio: Math.min(window.devicePixelRatio || 1, cfg.view.maxPixelRatio || 1.5),
    // No cross-fade: tiles and labels would be drawn twice while it runs.
    fadeDuration: 0,
    // MSAA costs fill rate and memory; phones go without. (The export reads the
    // canvas during a render instead of keeping the drawing buffer - see export3d.js.)
    antialias: !phone
  };
  if (phone && cfg.view.phoneTileCache) mapOptions.maxTileCacheSize = cfg.view.phoneTileCache;
  var map = new maplibregl.Map(mapOptions);
  // Hidden by CSS - its live text is copied into the footer (see below).
  map.addControl(new maplibregl.AttributionControl({ compact: false }), 'bottom-right');

  ns.map = map;
  // Layer ids other scripts restyle (code_3D/sun.js).
  ns.layers = { buildings: BUILDINGS_LAYER, hillshade: HILLSHADE_LAYER };
  ns.handlers.sync();

  // ---------- Notices (non-blocking messages under the header) ----------
  function notice(text) {
    var box = document.getElementById('notice3d');
    if (!box) return;
    var item = document.createElement('div');
    item.className = 'notice3d-item';
    item.textContent = text;
    box.appendChild(item);
    setTimeout(function () { item.classList.add('leaving'); }, 9000);
    setTimeout(function () { item.remove(); }, 9600);
  }
  ns.notice = notice;

  // ---------- PMTiles checks ----------
  function openArchive(url) {
    var archive = new pmtiles.PMTiles(url);
    return archive.getHeader().then(function (header) {
      protocol.add(archive);
      return { url: url, archive: archive, header: header };
    });
  }

  function lonLatToTile(lon, lat, z) {
    var n = Math.pow(2, z);
    var x = Math.floor((lon + 180) / 360 * n);
    var r = lat * Math.PI / 180;
    var y = Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n);
    return { x: Math.min(n - 1, Math.max(0, x)), y: Math.min(n - 1, Math.max(0, y)) };
  }

  // The DEM tiles' pixel size isn't in the PMTiles header, so decode one tile to read it
  // (rio-rgbify writes 256 or 512 px tiles depending on version/options).
  function detectTileSize(info) {
    var h = info.header;
    var z = h.minZoom;
    var lon = (h.minLon + h.maxLon) / 2, lat = (h.minLat + h.maxLat) / 2;
    var t = lonLatToTile(lon, lat, z);
    return info.archive.getZxy(z, t.x, t.y).then(function (resp) {
      if (!resp || !resp.data || typeof createImageBitmap !== 'function') return 512;
      return createImageBitmap(new Blob([resp.data])).then(function (bmp) {
        var size = bmp.width || 512;
        if (bmp.close) bmp.close();
        return size;
      });
    }).catch(function () { return 512; });
  }

  function probeTerrain() {
    var url = ns.dataUrl(cfg.terrain.file);
    if (!url) return Promise.resolve(null);
    return openArchive(url).then(function (info) {
      return detectTileSize(info).then(function (size) { info.tileSize = size; return info; });
    }).catch(function (err) {
      console.warn('[3D] Custom terrain not available:', url, err);
      return null;
    });
  }

  function probeBuildings() {
    var url = ns.dataUrl(cfg.buildings.file);
    if (!url) return Promise.resolve(null);
    return openArchive(url).then(function (info) {
      return info.archive.getMetadata().then(function (meta) {
        info.metadata = meta || {};
        return info;
      }).catch(function () { info.metadata = {}; return info; });
    }).catch(function (err) {
      console.warn('[3D] 3D buildings layer not available:', url, err);
      return null;
    });
  }

  // ---------- Terrain ----------
  function firstSymbolLayerId() {
    var layers = map.getStyle().layers || [];
    for (var i = 0; i < layers.length; i++) if (layers[i].type === 'symbol') return layers[i].id;
    return undefined;
  }

  function addTerrain(info) {
    var t = cfg.terrain;
    var demSpec;
    if (info) {
      demSpec = {
        type: 'raster-dem',
        url: 'pmtiles://' + info.url,
        encoding: t.encoding || 'mapbox',
        tileSize: info.tileSize || 512
      };
      if (t.attribution) demSpec.attribution = t.attribution;
    } else if (t.fallback) {
      demSpec = {
        type: 'raster-dem',
        tiles: t.fallback.tiles,
        encoding: t.fallback.encoding,
        tileSize: t.fallback.tileSize,
        maxzoom: t.fallback.maxzoom,
        attribution: t.fallback.attribution
      };
      if (t.file) notice('Custom terrain not found - showing default terrain for now.');
    } else {
      notice('Terrain layer is not available yet.');
      return;
    }

    map.addSource(DEM_SOURCE, demSpec);
    if (t.hillshade) {
      map.addSource(HILLSHADE_SOURCE, Object.assign({}, demSpec));
      map.addLayer({
        id: HILLSHADE_LAYER,
        type: 'hillshade',
        source: HILLSHADE_SOURCE,
        paint: Object.assign({}, t.hillshadePaint)
      }, firstSymbolLayerId());
    }
    map.setTerrain({ source: DEM_SOURCE, exaggeration: t.exaggeration || 1 });
    ns.terrainSource = info ? 'custom' : 'fallback';
    // The same elevation tiles, for the sun shadows (code_3D/shadows.js) to read.
    ns.dem = info ? {
      archive: info.archive,
      minzoom: info.header.minZoom,
      maxzoom: info.header.maxZoom,
      encoding: t.encoding || 'mapbox',
      exaggeration: t.exaggeration || 1
    } : {
      tiles: t.fallback.tiles,
      minzoom: 0,
      maxzoom: t.fallback.maxzoom,
      encoding: t.fallback.encoding,
      exaggeration: t.exaggeration || 1
    };
  }

  // ---------- Buildings ----------
  function pickSourceLayer(meta) {
    var b = cfg.buildings;
    var layers = (meta && meta.vector_layers) || [];
    if (b.sourceLayer) {
      for (var i = 0; i < layers.length; i++) if (layers[i].id === b.sourceLayer) return layers[i];
      return { id: b.sourceLayer, fields: {} };
    }
    return layers[0] || null;
  }

  function pickHeightField(layerMeta) {
    var b = cfg.buildings;
    if (b.heightField) return b.heightField;
    var fields = (layerMeta && layerMeta.fields) || {};
    for (var i = 0; i < b.heightFieldCandidates.length; i++) {
      if (Object.prototype.hasOwnProperty.call(fields, b.heightFieldCandidates[i])) return b.heightFieldCandidates[i];
    }
    // Last resort: any field whose name contains "height".
    var names = Object.keys(fields);
    for (var j = 0; j < names.length; j++) if (/height/i.test(names[j])) return names[j];
    return null;
  }

  function numberExpr(field) {
    return ['max', 0, ['to-number', ['get', field], 0]];
  }
  // Building height in metres: the attribute, or the default for a building with none.
  function heightExprFor(field) {
    return ['let', 'h', ['to-number', ['get', field], 0],
      ['case', ['>', ['var', 'h'], 0], ['var', 'h'], cfg.buildings.defaultHeight || 1]];
  }
  // The same rule for a feature's properties (shadows, elevation readout).
  ns.buildingHeight = function (props) {
    var v = ns.buildings && props ? Number(props[ns.buildings.heightField]) : NaN;
    return v > 0 ? v : (cfg.buildings.defaultHeight || 1);
  };

  function addBuildings(info) {
    if (!info) {
      notice('The 3D buildings layer is not available yet.');
      return null;
    }
    var b = cfg.buildings;
    var layerMeta = pickSourceLayer(info.metadata);
    if (!layerMeta) {
      notice('The 3D buildings file has no vector layer.');
      return null;
    }
    var heightField = pickHeightField(layerMeta);
    if (!heightField) {
      notice('No height attribute found in the 3D buildings file.');
      console.warn('[3D] Buildings fields:', layerMeta.fields, '- set config.buildings.heightField in code_3D/config3d.js');
      return null;
    }

    // No attribution line: the footer already credits Athens GIS Repository.
    // Tile URLs + an explicit minzoom rather than the archive's own description
    // (which says zoom 0): this way tiles below b.minZoom are never requested, not
    // even for the far part of a tilted view.
    var h = info.header;
    map.addSource(BUILDINGS_SOURCE, {
      type: 'vector',
      tiles: ['pmtiles://' + info.url + '/{z}/{x}/{y}'],
      minzoom: Math.max(h.minZoom || 0, b.minZoom || 0),
      maxzoom: h.maxZoom,
      bounds: [h.minLon, h.minLat, h.maxLon, h.maxLat]
    });

    var heightExpr = heightExprFor(heightField);
    map.addLayer({
      id: BUILDINGS_LAYER,
      type: 'fill-extrusion',
      source: BUILDINGS_SOURCE,
      'source-layer': layerMeta.id,
      minzoom: Math.max(info.header.minZoom || 0, b.minZoom || 0),
      paint: {
        'fill-extrusion-color': b.neutralColor,
        'fill-extrusion-height': heightExpr,
        'fill-extrusion-base': b.baseField ? numberExpr(b.baseField) : 0,
        'fill-extrusion-opacity': b.opacity,
        // Off: it darkens the lower part of every wall, which hides the sun/shade contrast.
        'fill-extrusion-vertical-gradient': false
      }
    }, firstSymbolLayerId());

    // The basemap's own flat building footprints would show through the extrusions.
    (map.getStyle().layers || []).forEach(function (l) {
      if (l.id !== BUILDINGS_LAYER && l['source-layer'] === 'building') {
        map.setLayoutProperty(l.id, 'visibility', 'none');
      }
    });

    var result = {
      layerId: BUILDINGS_LAYER,
      sourceLayer: layerMeta.id,
      heightField: heightField,
      heightExpr: heightExpr,
      // [west, south, east, north] of the buildings data (the sun shadows stay near it).
      bounds: [info.header.minLon, info.header.minLat, info.header.maxLon, info.header.maxLat]
    };
    ns.buildings = result;
    return result;
  }

  // ---------- Parks and gardens (green on the ground) ----------
  var PARKS_SOURCE = 'parks', GARDENS_SOURCE = 'gardens';
  var PARKS_LAYER = 'parks-fill', GARDENS_LAYER = 'gardens-fill';

  function probeParks() {
    var url = ns.dataUrl(cfg.greens.parks.file);
    if (!url) return Promise.resolve(null);
    return openArchive(url).then(function (info) {
      return info.archive.getMetadata().then(function (meta) {
        info.metadata = meta || {};
        return info;
      }).catch(function () { info.metadata = {}; return info; });
    }).catch(function (err) {
      console.warn('[3D] Parks layer not available:', url, err);
      return null;
    });
  }

  // Flat fills lie on the terrain like the basemap's own: under the hill shading,
  // roads, labels and buildings, above the basemap's land colours.
  function greenBefore() {
    return map.getLayer(HILLSHADE_LAYER) ? HILLSHADE_LAYER : firstSymbolLayerId();
  }
  function greenPaint() {
    return { 'fill-color': cfg.greens.color, 'fill-opacity': cfg.greens.opacity, 'fill-antialias': true };
  }

  // The basemap's streets are white on near-white land: tint them slightly darker so
  // the street network reads against the background. Only the car roads (surface and
  // outline); paths, rail and tunnels keep the basemap's own look.
  function styleStreets() {
    var st = cfg.streets;
    if (!st) return;
    (map.getStyle().layers || []).forEach(function (l) {
      if (l.type !== 'line' || l['source-layer'] !== 'roads') return;
      var id = l.id, color = null;
      if (/^(road|bridge)_.*_fill/.test(id)) color = st.fill;
      else if (/^bridge_.*_case/.test(id)) color = st.bridgeCasing || st.casing;
      else if (/^road_.*_case/.test(id)) color = st.casing;
      if (color) map.setPaintProperty(id, 'line-color', color);
    });
  }

  function addParks(info) {
    if (!info) return;
    var layers = (info.metadata && info.metadata.vector_layers) || [];
    var id = cfg.greens.parks.sourceLayer || (layers[0] && layers[0].id);
    if (!id) { console.warn('[3D] Parks file has no vector layer'); return; }
    var h = info.header;
    map.addSource(PARKS_SOURCE, {
      type: 'vector',
      tiles: ['pmtiles://' + info.url + '/{z}/{x}/{y}'],
      minzoom: h.minZoom || 0,
      maxzoom: h.maxZoom,
      bounds: [h.minLon, h.minLat, h.maxLon, h.maxLat]
    });
    map.addLayer({ id: PARKS_LAYER, type: 'fill', source: PARKS_SOURCE, 'source-layer': id, paint: greenPaint() }, greenBefore());
  }

  function addGardens() {
    var url = ns.dataUrl(cfg.greens.gardens.file);
    if (!url) return;
    map.addSource(GARDENS_SOURCE, { type: 'geojson', data: url });
    map.addLayer({ id: GARDENS_LAYER, type: 'fill', source: GARDENS_SOURCE, paint: greenPaint() }, greenBefore());
  }

  // ---------- Trees (3D models built from points) ----------
  var TREES_SOURCE = 'trees', TREES_PTS_LAYER = 'trees-points';
  var TREES_MODEL_SOURCE = 'trees-3d', TREES_MODEL_LAYER = 'trees-3d';

  function probeTrees() {
    var url = ns.dataUrl(cfg.trees.file);
    if (!url) return Promise.resolve(null);
    return openArchive(url).then(function (info) {
      return info.archive.getMetadata().then(function (meta) {
        info.metadata = meta || {};
        return info;
      }).catch(function () { info.metadata = {}; return info; });
    }).catch(function (err) {
      console.warn('[3D] Trees layer not available:', url, err);
      return null;
    });
  }

  // Tiny deterministic hash (0..1) so every tree keeps the same look between rebuilds.
  function hash01(x, y) {
    var s = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    return s - Math.floor(s);
  }

  function addTrees(info) {
    if (!info) return;
    var t = cfg.trees;
    var layers = (info.metadata && info.metadata.vector_layers) || [];
    var id = t.sourceLayer || (layers[0] && layers[0].id);
    if (!id) { console.warn('[3D] Trees file has no vector layer'); return; }
    var h = info.header;
    // Only the points are read from here (queried, not drawn): a fully transparent
    // circle layer keeps MapLibre loading the tiles.
    map.addSource(TREES_SOURCE, {
      type: 'vector',
      tiles: ['pmtiles://' + info.url + '/{z}/{x}/{y}'],
      minzoom: Math.max(h.minZoom || 0, 0),
      maxzoom: h.maxZoom,
      bounds: [h.minLon, h.minLat, h.maxLon, h.maxLat]
    });
    map.addLayer({
      id: TREES_PTS_LAYER, type: 'circle', source: TREES_SOURCE, 'source-layer': id,
      minzoom: t.minZoom,
      paint: { 'circle-radius': 1, 'circle-opacity': 0 }
    });
    map.addSource(TREES_MODEL_SOURCE, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    map.addLayer({
      id: TREES_MODEL_LAYER, type: 'fill-extrusion', source: TREES_MODEL_SOURCE,
      minzoom: t.minZoom,
      paint: {
        'fill-extrusion-color': ['get', 'color'],
        'fill-extrusion-height': ['get', 'top'],
        'fill-extrusion-base': ['get', 'base'],
        'fill-extrusion-opacity': 1,
        'fill-extrusion-vertical-gradient': false
      }
    }, firstSymbolLayerId());

    function ring(lon, lat, r) {
      var n = t.ringSides || 8, c = [], dLat = r / 111320, dLon = r / (111320 * Math.cos(lat * Math.PI / 180));
      for (var i = 0; i < n; i++) {
        var a = i / n * 2 * Math.PI;
        c.push([lon + Math.cos(a) * dLon, lat + Math.sin(a) * dLat]);
      }
      c.push(c[0]);
      return [c];
    }
    function part(lon, lat, r, base, top, color) {
      return {
        type: 'Feature',
        properties: { base: base, top: top, color: color },
        geometry: { type: 'Polygon', coordinates: ring(lon, lat, r) }
      };
    }
    function pick(list, v) { return list[Math.floor(v * list.length) % list.length]; }

    // Thin horizontal slices from y0 to y1 (fractions of the tree's height), each as
    // wide as profile(m) says at its middle m (0 = bottom, 1 = top): stacked closely
    // enough to read as a smooth shape.
    function slices(n, y0, y1, profile) {
      var out = [];
      for (var i = 0; i < n; i++) {
        out.push([profile((i + 0.5) / n), y0 + (y1 - y0) * i / n, y0 + (y1 - y0) * (i + 1) / n]);
      }
      return out;
    }
    // Ellipsoid outline.
    function oval(m) { var u = 2 * m - 1; return Math.max(0.12, Math.sqrt(1 - u * u)); }

    // One tree: a trunk and a crown of stacked tiers. Conifers narrow to a point,
    // palms are a tall thin trunk with a small head, the rest are rounded.
    var sl = { round: 5, conifer: 5, palm: 3 };
    if (t.slices) for (var sk in sl) if (t.slices[sk] > 0) sl[sk] = t.slices[sk];
    function buildTree(tr, out) {
      var lon = tr.lon, lat = tr.lat, height = tr.h, family = tr.f, first = out.length;
      var v = hash01(lon * 1000, lat * 1000);
      var conifer = t.conifers.indexOf(family) >= 0, palm = t.palms.indexOf(family) >= 0;
      var k, tiers, r;
      tr.kind = conifer ? 'conifer' : palm ? 'palm' : 'round';
      if (conifer) {
        r = Math.min(Math.max(height * 0.17, 0.8), 3);
        out.push(part(lon, lat, 0.25, 0, height * 0.2, t.trunkColor));
        tiers = slices(sl.conifer, 0.15, 1, function (m) { return Math.max(0.06, Math.pow(1 - m, 0.85)); });
        k = pick(t.coniferColors, v);
      } else if (palm) {
        r = Math.min(Math.max(height * 0.22, 1), 2.8);
        out.push(part(lon, lat, 0.22, 0, height * 0.88, t.trunkColor));
        tiers = slices(sl.palm, 0.8, 1, oval);
        k = pick(t.palmColors, v);
      } else {
        r = Math.min(Math.max(height * (0.28 + 0.1 * v), 1.2), 6);
        out.push(part(lon, lat, Math.max(0.2, r * 0.1), 0, height * 0.45, t.trunkColor));
        tiers = slices(sl.round, 0.3, 1, oval);
        k = pick(t.crownColors, v);
      }
      tr.r = r;   // crown radius, for the shadows
      for (var i = 0; i < tiers.length; i++) {
        out.push(part(lon, lat, r * tiers[i][0], height * tiers[i][1], height * tiers[i][2], k));
      }
      // Every part knows its tree, so a click on it can find the tree's attributes.
      for (var q = first; q < out.length; q++) out[q].properties.id = tr.id;
    }

    // Order-independent fingerprint of a tree list (position + height of each): the
    // model below is only rebuilt, and re-tiled by the worker, when it changes.
    function signature(list) {
      var s = 0;
      for (var i = 0; i < list.length; i++) {
        var tr = list[i];
        s = (s + (Math.imul(Math.round(tr.lon * 1e6), 73856093) ^ Math.imul(Math.round(tr.lat * 1e6), 19349663) ^ Math.imul(Math.round(tr.h * 10), 83492791))) | 0;
      }
      return list.length + ':' + s;
    }
    var builtSig = signature([]);

    function rebuild() {
      if (map.getZoom() < t.minZoom) { apply([]); return; }
      var b = map.getBounds(), c = map.getCenter();
      var padLon = (b.getEast() - b.getWest()) * 0.1, padLat = (b.getNorth() - b.getSouth()) * 0.1;
      var raw = map.querySourceFeatures(TREES_SOURCE, { sourceLayer: id });
      // Only within the buildings data's extent + a buffer (none when there are no buildings).
      var ext = ns.buildings && ns.buildings.bounds, eLon0 = -180, eLon1 = 180, eLat0 = -90, eLat1 = 90;
      if (ext) {
        var midLat = (ext[1] + ext[3]) / 2, bLat = t.extentBuffer / 111320, bLon = t.extentBuffer / (111320 * Math.cos(midLat * Math.PI / 180));
        eLon0 = ext[0] - bLon; eLon1 = ext[2] + bLon; eLat0 = ext[1] - bLat; eLat1 = ext[3] + bLat;
      }
      var seen = {}, list = [];
      for (var i = 0; i < raw.length; i++) {
        var g = raw[i].geometry;
        if (!g || g.type !== 'Point') continue;
        var lon = g.coordinates[0], lat = g.coordinates[1];
        if (lon < b.getWest() - padLon || lon > b.getEast() + padLon || lat < b.getSouth() - padLat || lat > b.getNorth() + padLat) continue;
        if (lon < eLon0 || lon > eLon1 || lat < eLat0 || lat > eLat1) continue;
        var key = lon.toFixed(6) + ',' + lat.toFixed(6);
        if (seen[key]) continue;   // the same tree can sit in two tiles' edge buffers
        seen[key] = 1;
        var p = raw[i].properties || {};
        var hgt = Number(p[t.heightField]);
        list.push({ lon: lon, lat: lat, id: key, p: p, hasH: hgt > 0, h: hgt > 0 ? hgt : t.defaultHeight, f: p[t.familyField] || '',
          d: (lon - c.lng) * (lon - c.lng) + (lat - c.lat) * (lat - c.lat) });
      }
      if (list.length > t.maxTrees) { list.sort(function (a, b2) { return a.d - b2.d; }); list.length = t.maxTrees; }
      apply(list);
    }

    // Draws these trees and hands them to the shadows - only when they differ from
    // the ones already drawn.
    function apply(list) {
      var sig = signature(list);
      if (sig === builtSig) return;
      builtSig = sig;
      var feats = [];
      for (var j = 0; j < list.length; j++) buildTree(list[j], feats);
      map.getSource(TREES_MODEL_SOURCE).setData({ type: 'FeatureCollection', features: feats });
      var byId = {};
      for (var n = 0; n < list.length; n++) byId[list[n].id] = list[n];
      ns.trees = { count: list.length, list: list, byId: byId, layerId: TREES_MODEL_LAYER };
      document.dispatchEvent(new CustomEvent('athens3d:trees'));
    }

    var timer = null;
    function schedule() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(function () { timer = null; try { rebuild(); } catch (e) { console.warn('[3D] Trees build failed', e); } }, 200);
    }
    map.on('moveend', schedule);
    map.on('sourcedata', function (e) {
      if (e.sourceId === TREES_SOURCE && e.isSourceLoaded) schedule();
    });
    schedule();
    ns.trees = { count: 0, layerId: TREES_MODEL_LAYER };
  }

  // ---------- Start-up sequence ----------
  function whenIdle() {
    return new Promise(function (resolve) {
      if (map.loaded() && map.areTilesLoaded()) { resolve(); return; }
      map.once('idle', resolve);
    });
  }

  var styleLoaded = new Promise(function (resolve) { map.once('load', resolve); });

  Promise.all([styleLoaded, probeTerrain(), probeBuildings(), probeParks(), probeTrees()]).then(function (r) {
    try { addTerrain(r[1]); } catch (e) { console.error('[3D] Terrain setup failed', e); }
    try { styleStreets(); } catch (e) { console.error('[3D] Street colours failed', e); }
    try { addParks(r[3]); } catch (e) { console.error('[3D] Parks setup failed', e); }
    try { addGardens(); } catch (e) { console.error('[3D] Gardens setup failed', e); }
    var b = null;
    try { b = addBuildings(r[2]); } catch (e) { console.error('[3D] Buildings setup failed', e); }
    try { addTrees(r[4]); } catch (e) { console.error('[3D] Trees setup failed', e); }
    try { map.setSky(Object.assign({}, cfg.sky)); } catch (e) { /* sky not supported - fine */ }
    document.dispatchEvent(new CustomEvent('athens3d:buildings', { detail: b }));
    return whenIdle();
  }).catch(function (err) {
    console.error('[3D] Start-up failed', err);
  }).then(function () {
    ns.loading.stop('init');
    watchDataLoading();
    document.dispatchEvent(new CustomEvent('athens3d:ready'));
  });

  // ---------- Loading circle on later data loads ----------
  // Only the page's own data (terrain + buildings) triggers it; basemap tiles load
  // quietly in the background.
  var WATCHED = {};
  WATCHED[BUILDINGS_SOURCE] = true;
  WATCHED[DEM_SOURCE] = true;
  WATCHED[HILLSHADE_SOURCE] = true;
  WATCHED[PARKS_SOURCE] = true;
  WATCHED[GARDENS_SOURCE] = true;
  WATCHED[TREES_SOURCE] = true;

  function watchDataLoading() {
    var pending = null;
    // Pan, zoom and rotate all fire 'movestart'/'moveend' (so do the zoom/compass
    // buttons' animated moves) - while any of them is in progress, the lock never
    // engages, so a drag or a zoom never gets cut short mid-gesture. Once the user
    // settles the view, there's still a cfg.loadingDelayMs gap before the lock can
    // show at all, so a quick adjustment right afterwards isn't interrupted either.
    var interacting = false;

    function clearPending() {
      if (pending) { clearTimeout(pending); pending = null; }
    }

    function maybeShowLoading() {
      if (interacting || pending || ns.loading.isLocked()) return;
      pending = setTimeout(function () {
        pending = null;
        if (interacting || map.areTilesLoaded()) return;
        ns.loading.start('data');
        whenIdle().then(function () { ns.loading.stop('data'); });
      }, cfg.loadingDelayMs || 350);
    }

    map.on('movestart', function () {
      interacting = true;
      clearPending();
    });
    map.on('moveend', function () {
      interacting = false;
      maybeShowLoading();
    });
    map.on('dataloading', function (e) {
      if (e.dataType !== 'source' || !WATCHED[e.sourceId]) return;
      maybeShowLoading();
    });
  }

  // ---------- Zoom + compass buttons ----------
  (function () {
    var zin = document.getElementById('zoom-in');
    var zout = document.getElementById('zoom-out');
    var compass = document.getElementById('rotate-btn');
    var needle = compass ? compass.querySelector('.compass-needle') : null;

    function setDisabled(btn, off) {
      if (!btn) return;
      btn.disabled = off;
      btn.style.opacity = off ? 0.5 : 1;
      btn.style.cursor = off ? 'not-allowed' : 'pointer';
    }
    function updateZoomButtons() {
      var z = map.getZoom();
      setDisabled(zout, z <= map.getMinZoom() + 1e-6);
      setDisabled(zin, z >= map.getMaxZoom() - 1e-6);
    }
    function updateCompass() {
      if (!needle) return;
      // Turn with the bearing and lean back with the tilt, like a compass lying on the map.
      needle.style.transform = 'rotateX(' + (map.getPitch() * 0.5) + 'deg) rotate(' + (-map.getBearing()) + 'deg)';
    }

    if (zin) zin.addEventListener('click', function (e) {
      e.preventDefault();
      if (zin.disabled || ns.loading.isLocked()) return;
      map.zoomIn({ duration: 300 });
    });
    if (zout) zout.addEventListener('click', function (e) {
      e.preventDefault();
      if (zout.disabled || ns.loading.isLocked()) return;
      map.zoomOut({ duration: 300 });
    });
    if (compass) compass.addEventListener('click', function (e) {
      e.preventDefault();
      if (ns.loading.isLocked()) return;
      map.easeTo({ bearing: 0, pitch: cfg.view.pitch, duration: 700 });
    });

    // Tilt: tilted (the start tilt, or the last tilt the user chose) <-> straight down.
    var tilt = document.getElementById('tilt-btn');
    var tiltLabel = tilt ? tilt.querySelector('.tilt-label') : null;
    var lastTilt = cfg.view.pitch;
    function isFlat() { return map.getPitch() < 5; }
    function updateTilt() {
      if (!tilt) return;
      var flat = isFlat();
      if (!flat) lastTilt = map.getPitch();
      if (tiltLabel) tiltLabel.textContent = flat ? '3D' : '2D';
      tilt.title = flat ? 'Tilt the view (3D)' : 'Top-down view (2D)';
      tilt.setAttribute('aria-label', flat ? 'Tilt the view' : 'Switch to top-down view');
    }
    if (tilt) tilt.addEventListener('click', function (e) {
      e.preventDefault();
      if (ns.loading.isLocked()) return;
      map.easeTo({ pitch: isFlat() ? Math.max(lastTilt, 30) : 0, duration: 700 });
    });

    map.on('zoom', updateZoomButtons);
    map.on('rotate', updateCompass);
    map.on('pitch', updateCompass);
    map.on('pitchend', updateTilt);
    updateZoomButtons();
    updateCompass();
    updateTilt();
  })();

  // ---------- Attribution copy in the footer (same as the main page) ----------
  (function () {
    var copy = document.getElementById('map-attribution');
    if (!copy) return;
    function sync() {
      var src = map.getContainer().querySelector('.maplibregl-ctrl-attrib-inner');
      if (!src) return;
      copy.innerHTML = src.innerHTML;
      Array.prototype.forEach.call(copy.querySelectorAll('a'), function (a) {
        a.target = '_blank';
        a.rel = 'noopener';
      });
    }
    var attached = false;
    function attach() {
      var src = map.getContainer().querySelector('.maplibregl-ctrl-attrib-inner');
      if (!src || attached) { sync(); return; }
      attached = true;
      new MutationObserver(sync).observe(src, { childList: true, subtree: true, characterData: true });
      sync();
    }
    map.on('styledata', attach);
    map.on('sourcedata', function (e) { if (e.isSourceLoaded) sync(); });
    attach();
  })();

  // ---------- Scale ratio + eye altitude label (at the map centre) ----------
  (function () {
    var scaleEl = document.getElementById('scale-text');
    var altSep = document.getElementById('eye-alt-sep');
    var altEl = document.getElementById('eye-alt-text');
    if (!scaleEl) return;
    function fmt(v) { return String(v).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

    // Camera altitude above sea level, same reading as "Eye alt" in Earth viewers.
    // Fails quietly if a future MapLibre version moves/renames this internal.
    function eyeAltitudeMeters() {
      try {
        var pos = map.transform.getCameraPosition();
        return pos ? pos.altitude : null;
      } catch (e) { return null; }
    }
    function fmtAlt(m) {
      if (m == null || !isFinite(m)) return null;
      return (m >= 1000 ? (m / 1000).toFixed(1) + ' km' : m.toFixed(1) + ' m');
    }

    function update() {
      var c = map.getCenter();
      // MapLibre's world is 512 px wide at zoom 0.
      var mpp = 40075016.686 * Math.cos(c.lat * Math.PI / 180) / (512 * Math.pow(2, map.getZoom()));
      var scale = Math.max(1, Math.round((mpp * 96 / 0.0254) / 100) * 100);
      scaleEl.textContent = 'Scale 1 : ' + fmt(scale);

      var altText = fmtAlt(eyeAltitudeMeters());
      if (altEl) altEl.textContent = altText ? 'Eye alt ' + altText : '';
      if (altSep) altSep.style.display = altText ? '' : 'none';
    }
    map.on('move', update);
    update();

    // ---------- Elevation under the pointer ----------
    // Terrain height (metres above sea level) where the pointer is; on a building, the
    // roof too (ground + building height, as drawn). With no pointer on the map yet,
    // or after it leaves, the map centre. A tap shows that spot on touch screens.
    var elevEl = document.getElementById('elev-text');
    var elevSep = document.getElementById('elev-sep');
    if (!elevEl) return;
    var pointer = null, queued = false;

    function fmtM(v) { return v.toFixed(1) + ' m'; }
    function centroid(g) {
      var ring = g.type === 'Polygon' ? g.coordinates[0] : g.type === 'MultiPolygon' ? g.coordinates[0][0] : null;
      if (!ring || !ring.length) return null;
      var x = 0, y = 0, n = ring.length - 1 || 1;
      for (var i = 0; i < n; i++) { x += ring[i][0]; y += ring[i][1]; }
      return [x / n, y / n];
    }
    function terrainAt(ll) {
      // queryTerrainElevation is relative to the elevation at the view centre.
      try {
        var e = map.queryTerrainElevation(ll);
        return (e == null || !isFinite(e)) ? null : e + (map.transform.elevation || 0);
      } catch (err) { return null; }
    }
    function refreshElevation() {
      queued = false;
      var ll = pointer ? map.unproject(pointer) : map.getCenter();
      var ground = terrainAt(ll), text = null;
      if (ground != null) {
        text = 'Elev ' + fmtM(ground);
        if (pointer && ns.buildings && map.getLayer(ns.buildings.layerId)) {
          var hits = map.queryRenderedFeatures(pointer, { layers: [ns.buildings.layerId] });
          if (hits.length) {
            var h = ns.buildingHeight(hits[0].properties);
            // MapLibre lifts a building to the ground height at its own centroid.
            var c = centroid(hits[0].geometry);
            var base = c ? terrainAt(c) : null;
            text = 'Elev ' + fmtM(ground) + ' (roof ' + fmtM((base == null ? ground : base) + h) + ')';
          }
        }
      }
      elevEl.textContent = text || '';
      if (elevSep) elevSep.style.display = text ? '' : 'none';
    }
    function queue() {
      if (queued) return;
      queued = true;
      requestAnimationFrame(refreshElevation);
    }
    map.on('mousemove', function (e) { pointer = e.point; queue(); });
    map.on('click', function (e) { pointer = e.point; queue(); });
    map.on('mouseout', function () { pointer = null; queue(); });
    // The map moving under a still pointer changes what it points at; elevation
    // tiles arriving fills in a value that wasn't available yet.
    map.on('move', queue);
    map.on('idle', queue);
    queue();
  })();
})();
