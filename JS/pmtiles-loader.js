// === PMTiles Rendering Loader ===
// Fetches only the vector tiles that intersect the current viewport (at a zoom level
// clamped to the archive's own [minZoom,maxZoom]) from a .pmtiles archive over HTTP
// range requests (window.pmtiles, JS/vendor/vector-tile.js's window.VectorTile,
// window.Pbf), decodes them from Mapbox Vector Tile protobuf into plain lng/lat
// GeoJSON features, and hands the merged/deduplicated FeatureCollection back. This is
// the only thing that changes about how a layer's data arrives - JS/layer-control.js's
// styling/click/legend/highlight pipeline (createLayerFromGeoJSON) is unchanged and
// doesn't know or care whether its input FeatureCollection came from one big fetch or
// from decoded tiles.
//
// Each zoom level's tiles were pre-simplified at build time (see
// tools/build-pmtiles.mjs), so picking the tile zoom nearest the current map zoom is
// what gives "simplified geometry at low zoom, full detail at high zoom"; only
// fetching tiles that intersect the current viewport is what gives "only render
// features currently in view" at the network level (not just client-side filtering
// of an already-downloaded dataset, as JS/layer-control.js's older
// getViewportData()/indexLayerData() path still does for layers under the tiling
// size threshold).
(function () {
  var AthensGIS = window.AthensGIS = window.AthensGIS || {};

  var _archives = {};   // url -> pmtiles.PMTiles instance (one per archive, reused)
  var _headers = {};    // url -> Promise<header>, so getHeader() is only awaited once
  var _requestSeq = {}; // url -> latest getFeaturesForBounds() request id

  function getArchive(url) {
    if (!_archives[url]) _archives[url] = new window.pmtiles.PMTiles(url);
    return _archives[url];
  }

  function delay(ms) {
    return new Promise(function (resolve) { setTimeout(resolve, ms); });
  }

  // Caching a REJECTED promise here would permanently break this archive for the
  // rest of the page's lifetime after a single transient failure (page load is the
  // highest-contention moment for this - see decodeTile()'s retry below for the same
  // reasoning applied to individual tiles) - one retry, and only cache a header once
  // it actually resolves.
  function getHeader(url) {
    if (_headers[url]) return _headers[url];
    var p = getArchive(url).getHeader().catch(function (err) {
      return delay(250).then(function () { return getArchive(url).getHeader(); });
    });
    _headers[url] = p.catch(function (err) {
      delete _headers[url]; // still failed after the retry - let the next caller try fresh, don't wedge it
      throw err;
    });
    return _headers[url];
  }

  // [minLng, minLat, maxLng, maxLat] straight from the archive header - a few bytes,
  // no tile data - used for "zoom to extent" instead of scanning cached features.
  function getHeaderBounds(url) {
    return getHeader(url).then(function (h) {
      return [h.minLon, h.minLat, h.maxLon, h.maxLat];
    });
  }

  // ── Slippy-map tile math (standard Web Mercator; same formulas Leaflet uses) ──────
  function lngLatToTile(lng, lat, z) {
    var n = Math.pow(2, z);
    var latRad = lat * Math.PI / 180;
    var x = Math.floor((lng + 180) / 360 * n);
    var y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
    return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
  }

  function tilesForBounds(bounds, z) {
    var nw = lngLatToTile(bounds.getWest(), bounds.getNorth(), z);
    var se = lngLatToTile(bounds.getEast(), bounds.getSouth(), z);
    var tiles = [];
    for (var x = nw.x; x <= se.x; x++) {
      for (var y = nw.y; y <= se.y; y++) tiles.push({ x: x, y: y, z: z });
    }
    return tiles;
  }

  function clampZoom(z, header) {
    var min = Number.isFinite(header.minZoom) ? header.minZoom : 0;
    var max = Number.isFinite(header.maxZoom) ? header.maxZoom : 18;
    return Math.max(min, Math.min(max, Math.round(z)));
  }

  // Inverse of lngLatToTile: a tile's own true (unbuffered) lng/lat bounding box -
  // [west, south, east, north]. Used to clip each tile's decoded features back down
  // to exactly what that tile owns (see clipFeatureToTile below).
  function tileBoundsLngLat(z, x, y) {
    var n = Math.pow(2, z);
    function lng(tx) { return tx / n * 360 - 180; }
    function lat(ty) {
      var rad = Math.PI - 2 * Math.PI * ty / n;
      return 180 / Math.PI * Math.atan(0.5 * (Math.exp(rad) - Math.exp(-rad)));
    }
    return [lng(x), lat(y + 1), lng(x + 1), lat(y)];
  }

  // Tippecanoe buffers each tile with a slice of geometry from its neighbors (so
  // things like line dashing and label placement aren't cut off mid-shape at the
  // seam) - a LineString/Polygon feature that spans a tile boundary is therefore
  // NOT simply duplicated whole in each tile, it's clipped differently per tile
  // (each tile's copy carries that tile's true portion plus a bit of overlapping
  // buffer). Naively deduping those by id (as if they were exact duplicates, like a
  // Point sitting on a boundary can genuinely be) throws away every fragment but
  // one, leaving a grid of gaps along every tile edge for anything that crosses a
  // boundary. Re-clipping each feature to its OWN tile's true (unbuffered) bounds
  // here - before it ever reaches the merge/dedupe step - makes adjacent tiles'
  // fragments exactly complementary instead of overlapping duplicates, so they can
  // all be kept and simply tile back together seamlessly.
  var CLIPPABLE_TYPES = { LineString: 1, MultiLineString: 1, Polygon: 1, MultiPolygon: 1 };
  function clipFeatureToTile(feature, tileBBox) {
    var geom = feature && feature.geometry;
    if (!geom || !CLIPPABLE_TYPES[geom.type] || typeof window.turf === 'undefined') return feature;
    try {
      var clipped = window.turf.bboxClip(feature, tileBBox);
      var coords = clipped && clipped.geometry && clipped.geometry.coordinates;
      if (!coords || !coords.length) return null; // fully outside this tile's true bounds
      clipped.id = feature.id; // turf.bboxClip doesn't carry the top-level Feature id over
      return clipped;
    } catch (e) {
      return feature; // malformed geometry - keep the unclipped fragment rather than drop it
    }
  }

  // ── Tile fetch + MVT decode ────────────────────────────────────────────────────────
  var TILE_FETCH_RETRIES = 2;
  var TILE_FETCH_RETRY_DELAY_MS = 250;

  // A page load is the highest-contention moment for tile requests - dozens of other
  // assets (CSS, JS, fonts, the basemap, every other layer's own tiles) are
  // competing for the same connection pool right then, so a transient fetch failure
  // (a bad response code - see pmtiles' FetchSource - or a dropped connection) is far
  // more likely there than during ordinary panning. Without a retry, a single failed
  // tile request would silently be treated as empty forever, since nothing re-fetches
  // it until the next pan/zoom happens to cover that same tile again - matching a
  // report of features missing right after first load specifically.
  function fetchTileWithRetry(url, z, x, y, attempt) {
    return getArchive(url).getZxy(z, x, y).catch(function (err) {
      if ((attempt || 0) >= TILE_FETCH_RETRIES) throw err;
      return delay(TILE_FETCH_RETRY_DELAY_MS * ((attempt || 0) + 1))
        .then(function () { return fetchTileWithRetry(url, z, x, y, (attempt || 0) + 1); });
    });
  }

  function decodeTile(url, z, x, y) {
    return fetchTileWithRetry(url, z, x, y, 0).then(function (result) {
      // undefined = sparse tile pyramid, no features fall in this tile - expected,
      // not an error.
      if (!result || !result.data) return [];
      var tile;
      try {
        // pbf@5's browser build exposes window.Pbf as a {PbfReader, PbfWriter}
        // namespace (no default export) - PbfReader is the reader class
        // VectorTile's constructor expects (readVarint/readString/skip/... + pos).
        tile = new window.VectorTile(new window.Pbf.PbfReader(result.data));
      } catch (e) {
        return [];
      }
      var tileBBox = tileBoundsLngLat(z, x, y);
      var features = [];
      Object.keys(tile.layers).forEach(function (layerName) {
        var layer = tile.layers[layerName];
        for (var i = 0; i < layer.length; i++) {
          try {
            var f = clipFeatureToTile(layer.feature(i).toGeoJSON(x, y, z), tileBBox);
            if (f) features.push(f);
          } catch (e) { /* skip one malformed feature rather than failing the tile */ }
        }
      });
      return features;
    }).catch(function () { return []; });
  }

  // Only Point/MultiPoint features get deduped by id: a point sitting exactly on a
  // tile boundary can genuinely be included whole in both neighboring tiles (no
  // clipping applies to points), so one copy needs discarding. LineString/Polygon
  // fragments are pre-clipped to their own tile's true bounds in decodeTile() above,
  // so - even though they share their original feature's id - every fragment is
  // distinct geometry that must be kept for the shape to render without gaps.
  var DEDUPE_BY_ID_TYPES = { Point: 1, MultiPoint: 1 };
  function featureKey(f) {
    var t = f && f.geometry && f.geometry.type;
    if (!DEDUPE_BY_ID_TYPES[t]) return null; // never deduped - always kept
    if (f.id != null) return 'id:' + f.id;
    try {
      return t + ':' + JSON.stringify(f.properties) + ':' + JSON.stringify(f.geometry.coordinates);
    } catch (e) {
      return 'rnd:' + Math.random();
    }
  }

  function dedupe(features) {
    var seen = Object.create(null);
    var out = [];
    features.forEach(function (f) {
      var k = featureKey(f);
      if (k === null) { out.push(f); return; } // not a dedupe-eligible type - always kept
      if (seen[k]) return;
      seen[k] = true;
      out.push(f);
    });
    return out;
  }

  // Best-effort: dissolve same-id Polygon/MultiPolygon fragments (tile-clipped pieces
  // of one feature that spans multiple tiles - see decodeTile()'s clipping above)
  // back into one seamless shape, so the fill/border doesn't show a visible seam
  // along whichever tile boundary split it. Requires turf.union, which can fail on
  // some real-world geometries (self-intersections, etc., confirmed against this
  // project's own data) - falls back to keeping the fragments separate (today's
  // behavior - complete since decodeTile()'s clipping, just seamed - not worse)
  // rather than losing the feature. Not attempted for LineString: a line has no fill,
  // so there's no seam to hide (JS/layer-control.js's findSiblingFragments() covers
  // the one thing that still needs fixing for lines - which fragment a click lands
  // on - without needing geometry merging at all).
  function mergePolygonFragments(features) {
    if (typeof window.turf === 'undefined' || typeof window.turf.union !== 'function') return features;
    var byId = Object.create(null);
    var order = [];
    var out = [];
    features.forEach(function (f) {
      var t = f && f.geometry && f.geometry.type;
      if ((t !== 'Polygon' && t !== 'MultiPolygon') || f.id == null) { out.push(f); return; }
      var key = 'id:' + f.id;
      if (!byId[key]) { byId[key] = []; order.push(key); }
      byId[key].push(f);
    });
    order.forEach(function (key) {
      var group = byId[key];
      if (group.length === 1) { out.push(group[0]); return; }
      try {
        var merged = group.reduce(function (acc, f) { return acc ? window.turf.union(acc, f) : f; });
        if (merged && merged.geometry) {
          merged.id = group[0].id;
          merged.properties = group[0].properties;
          out.push(merged);
        } else {
          group.forEach(function (f) { out.push(f); });
        }
      } catch (e) {
        group.forEach(function (f) { out.push(f); });
      }
    });
    return out;
  }

  function mergeTileLists(tileFeatureLists) {
    var merged = [];
    tileFeatureLists.forEach(function (list) { merged = merged.concat(list); });
    return mergePolygonFragments(dedupe(merged));
  }

  // Decodes every tile intersecting `bounds` at a zoom clamped to the archive's own
  // range. Superseded requests (a newer pan/zoom already started for the same url)
  // resolve to null so the caller can discard a stale result instead of racing it
  // onto the map.
  function getFeaturesForBounds(url, bounds, mapZoom) {
    var seq = (_requestSeq[url] = (_requestSeq[url] || 0) + 1);
    return getHeader(url).then(function (header) {
      var z = clampZoom(mapZoom, header);
      var tiles = tilesForBounds(bounds, z);
      return Promise.all(tiles.map(function (t) { return decodeTile(url, t.z, t.x, t.y); }));
    }).then(function (tileFeatureLists) {
      if (_requestSeq[url] !== seq) return null; // a newer request has since started
      return { type: 'FeatureCollection', features: mergeTileLists(tileFeatureLists) };
    });
  }

  // Decodes every tile at the archive's MAXZOOM, covering the whole extent - used by
  // JS/layer-filter.js for the two datasets configured in window.layerFilterConfigs,
  // which need every feature, not just what's currently in view. Deliberately
  // maxZoom, not minZoom: tippecanoe's feature/tiny-polygon dropping is a low-zoom
  // optimization (keeping a tile covering a huge area from being oversized), so a
  // low-zoom tile can easily be missing most of the dataset even when the archive
  // was built with default flags - confirmed against this project's own already-
  // uploaded archives, where reading at minZoom recovered as few as 3 of 86 real
  // features. Max zoom tiles are geographically tiny, so density/size limits rarely
  // kick in there regardless of how the archive was tiled - it costs more tiles (more
  // requests), which is negligible for the small datasets this is actually used for.
  // tools/build-pmtiles.mjs still tiles these two with feature-dropping disabled too,
  // as a belt-and-suspenders measure, but this no longer depends on that.
  function getAllFeatures(url) {
    return getHeader(url).then(function (header) {
      var z = Number.isFinite(header.maxZoom) ? header.maxZoom : 0;
      var bounds = L.latLngBounds(
        [header.minLat, header.minLon],
        [header.maxLat, header.maxLon]
      );
      var tiles = tilesForBounds(bounds, z);
      return Promise.all(tiles.map(function (t) { return decodeTile(url, t.z, t.x, t.y); }));
    }).then(function (tileFeatureLists) {
      return { type: 'FeatureCollection', features: mergeTileLists(tileFeatureLists) };
    });
  }

  // Raster .pmtiles archive (PNG/JPEG/WebP tile pyramid, e.g. a shaded relief) -> a
  // Leaflet GridLayer that pulls image tiles straight from the archive over HTTP
  // range requests. Nothing is decoded here (unlike the vector path above) - the
  // browser paints the image tiles directly. Resolves once the archive header is
  // read, so the layer can be clamped to the archive's real native zoom range and
  // geographic bounds (avoids requesting tiles that don't exist).
  //
  // `options` is passed through to L.GridLayer (pane, opacity, attribution, ...),
  // plus one extra: `transparentRGB` ([r,g,b], with optional `transparentTolerance`,
  // default 8) knocks that colour out to fully transparent per tile - used when the
  // source raster baked its nodata as a flat opaque fill instead of an alpha channel
  // (e.g. shadedrelief.pmtiles paints everything outside the DEM as #aad3df). When
  // it's not set we just delegate to pmtiles' own leafletRasterLayer.
  var TILE_MIME = { 1: 'application/x-protobuf', 2: 'image/png', 3: 'image/jpeg', 4: 'image/webp', 5: 'image/avif' };
  function getRasterLayer(url, options) {
    options = options || {};
    if (!(window.pmtiles && typeof window.pmtiles.leafletRasterLayer === 'function')) {
      return Promise.reject(new Error('pmtiles.leafletRasterLayer unavailable'));
    }
    return getHeader(url).then(function (header) {
      var baseOpts = {
        minNativeZoom: Number.isFinite(header.minZoom) ? header.minZoom : undefined,
        maxNativeZoom: Number.isFinite(header.maxZoom) ? header.maxZoom : undefined,
        bounds: L.latLngBounds([header.minLat, header.minLon], [header.maxLat, header.maxLon])
      };
      var key = options.transparentRGB;
      if (!Array.isArray(key)) {
        return window.pmtiles.leafletRasterLayer(getArchive(url), Object.assign(baseOpts, options));
      }
      var tol = options.transparentTolerance != null ? options.transparentTolerance : 8;
      var mime = TILE_MIME[header.tileType] || 'image/png';
      var passOpts = Object.assign(baseOpts, options);
      delete passOpts.transparentRGB;
      delete passOpts.transparentTolerance;
      var Keyed = L.GridLayer.extend({
        createTile: function (coord, done) {
          var canvas = document.createElement('canvas');
          getArchive(url).getZxy(coord.z, coord.x, coord.y).then(function (res) {
            if (!res || !res.data) { done(null, canvas); return; }
            return createImageBitmap(new Blob([res.data], { type: mime })).then(function (bmp) {
              canvas.width = bmp.width;
              canvas.height = bmp.height;
              var ctx = canvas.getContext('2d');
              ctx.drawImage(bmp, 0, 0);
              try {
                var img = ctx.getImageData(0, 0, canvas.width, canvas.height);
                var d = img.data, kr = key[0], kg = key[1], kb = key[2];
                for (var i = 0; i < d.length; i += 4) {
                  if (Math.abs(d[i] - kr) <= tol && Math.abs(d[i + 1] - kg) <= tol && Math.abs(d[i + 2] - kb) <= tol) d[i + 3] = 0;
                }
                ctx.putImageData(img, 0, 0);
              } catch (e) { /* tainted canvas shouldn't happen for blob URLs - fall back to raw tile */ }
              done(null, canvas);
            });
          }).catch(function (e) { done(e, canvas); });
          return canvas;
        }
      });
      return new Keyed(passOpts);
    });
  }

  AthensGIS.pmtiles = {
    getFeaturesForBounds: getFeaturesForBounds,
    getHeaderBounds: getHeaderBounds,
    getAllFeatures: getAllFeatures,
    getRasterLayer: getRasterLayer
  };
})();
