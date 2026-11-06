// Sun shadows for the 3D Viewer: a real shadow map of the area in view, cast by the
// buildings AND the terrain, recomputed as the sun moves.
//
// How it works:
//  1. A height model is built for the area around the map centre: the terrain (from
//     the same elevation tiles the map uses) with every building's roof on top, at
//     the exact height MapLibre draws it. A coarser terrain-only model covers a much
//     wider area, so far hills can shade the view too.
//  2. On the GPU (a hidden WebGL canvas), every point of both models looks toward the
//     sun: if anything higher is in the way, it's in shadow.
//  3. The result is shown three ways:
//     - ground + hill shadows: two images draped on the terrain (MapLibre canvas
//       sources), under the buildings;
//     - roofs: drawn over each roof, darkened where a taller neighbour's shadow (or a
//       hill's) falls on it;
//     - walls (only with "3D shade" on): each wall point facing the sun looks toward
//       it the same way, so a neighbour's shadow climbs up the facade.
//     Walls facing away from the sun are left to the map's lighting.
(function () {
  var ns = window.Athens3D = window.Athens3D || {};
  var cfg = ns.config;
  var scfg = cfg.shadows;

  var EARTH = 40075016.686;
  var phone = window.matchMedia && window.matchMedia('(max-width: 900px)').matches;
  var MAX = phone ? scfg.maxSizePhone : scfg.maxSize;
  // Image sizes are kept off powers of two: MapLibre asks for mipmaps on a power-of-two
  // canvas image without making them, and the GPU then reads it as solid black.
  function notPow2(n) { return (n & (n - 1)) === 0 ? n + 1 : n; }
  var COARSE = phone ? 500 : 1000;

  var COARSE_ID = 'sun-shade-terrain', FINE_ID = 'sun-shade-ground', LAYER3D_ID = 'sun-shade-buildings';

  // ---------- Web Mercator (0..1, y down) ----------
  function mx(lng) { return (lng + 180) / 360; }
  function my(lat) { var s = Math.sin(lat * Math.PI / 180); return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI); }
  function lngOf(x) { return x * 360 - 180; }
  function latOf(y) { return 360 / Math.PI * Math.atan(Math.exp((0.5 - y) * 2 * Math.PI)) - 90; }
  function metresPerUnit(lat) { return EARTH * Math.cos(lat * Math.PI / 180); }
  function hexRgb(c) { return [parseInt(c.substr(1, 2), 16) / 255, parseInt(c.substr(3, 2), 16) / 255, parseInt(c.substr(5, 2), 16) / 255]; }

  // ---------- Elevation tiles ----------
  var demCache = new Map();
  var DEM_KEEP = 48;
  function demTile(z, x, y) {
    var n = 1 << z;
    if (y < 0 || y >= n) return Promise.resolve(null);
    x = ((x % n) + n) % n;
    var key = z + '/' + x + '/' + y;
    var p = demCache.get(key);
    if (p) return p;
    p = loadDem(z, x, y).catch(function () { return null; });
    demCache.set(key, p);
    // Decoded tiles are Float32 (~1 MB for 512 px): one view needs only a handful,
    // and a Dem keeps its own references while a region is built.
    if (demCache.size > DEM_KEEP) demCache.delete(demCache.keys().next().value);
    return p;
  }
  function loadDem(z, x, y) {
    var d = ns.dem;
    var blob = d.archive
      ? d.archive.getZxy(z, x, y).then(function (r) { return r && r.data ? new Blob([r.data]) : null; })
      : fetch(d.tiles[0].replace('{z}', z).replace('{x}', x).replace('{y}', y)).then(function (r) { return r.ok ? r.blob() : null; });
    return blob.then(function (b) {
      return b ? createImageBitmap(b, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' }) : null;
    }).then(function (bmp) {
      if (!bmp) return null;
      var c = document.createElement('canvas');
      c.width = bmp.width; c.height = bmp.height;
      var g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(bmp, 0, 0);
      var px = g.getImageData(0, 0, c.width, c.height).data;
      if (bmp.close) bmp.close();
      var n = c.width * c.height, out = new Float32Array(n);
      var terrarium = d.encoding === 'terrarium', ex = d.exaggeration || 1;
      for (var i = 0, j = 0; i < n; i++, j += 4) {
        out[i] = ex * (terrarium
          ? px[j] * 256 + px[j + 1] + px[j + 2] / 256 - 32768
          : -10000 + (px[j] * 65536 + px[j + 1] * 256 + px[j + 2]) * 0.1);
      }
      return { size: c.width, data: out };
    });
  }

  // Bilinear elevation at one zoom level, sampled the way MapLibre's terrain does.
  function Dem(z) { this.z = z; this.n = Math.pow(2, z); this.tiles = {}; this.size = 256; }
  Dem.prototype.load = function (x0, y0, x1, y1) {
    var self = this, n = this.n, jobs = [];
    var tx0 = Math.floor(x0 * n - 0.01), tx1 = Math.floor(x1 * n + 0.01);
    var ty0 = Math.floor(y0 * n - 0.01), ty1 = Math.floor(y1 * n + 0.01);
    for (var ty = ty0; ty <= ty1; ty++) {
      for (var tx = tx0; tx <= tx1; tx++) {
        (function (tx, ty) {
          jobs.push(demTile(self.z, tx, ty).then(function (t) {
            if (t) { self.tiles[tx + ',' + ty] = t; self.size = t.size; }
          }));
        })(tx, ty);
      }
    }
    return Promise.all(jobs);
  };
  Dem.prototype.px = function (gx, gy) {
    var S = this.size, tx = Math.floor(gx / S), ty = Math.floor(gy / S);
    var t = this.tiles[tx + ',' + ty];
    if (!t) return 0; // no tile (sea / outside the data): sea level
    return t.data[(gy - ty * S) * S + (gx - tx * S)];
  };
  Dem.prototype.at = function (x, y) {
    var S = this.size, gx = x * this.n * S, gy = y * this.n * S;
    var ix = Math.floor(gx), iy = Math.floor(gy), fx = gx - ix, fy = gy - iy;
    return (this.px(ix, iy) * (1 - fx) + this.px(ix + 1, iy) * fx) * (1 - fy) +
           (this.px(ix, iy + 1) * (1 - fx) + this.px(ix + 1, iy + 1) * fx) * fy;
  };
  function demZoom(z) {
    var d = ns.dem;
    return Math.max(d.minzoom || 0, Math.min(d.maxzoom, Math.round(z)));
  }

  // ---------- Height model ----------
  // Heights go to the GPU as RGB (centimetres + 1000 m offset, 24 bits); alpha marks roofs.
  function encodeRow(h, roof, out, j, W) {
    for (var i = j * W, e = i + W; i < e; i++) {
      var v = Math.max(0, Math.min(16777215, Math.round((h[i] + 1000) * 100))), o = i * 4;
      out[o] = (v >> 16) & 255; out[o + 1] = (v >> 8) & 255; out[o + 2] = v & 255;
      // alpha: 255 roof, 150 tree crown, 128 ground
      out[o + 3] = roof && roof[i] ? (roof[i] === 2 ? 150 : 255) : 128;
    }
  }

  // ---------- Working in slices ----------
  // The model's long loops run in ~10 ms slices with a break in between, so the page
  // keeps drawing and reacting while a big area is modelled. A build that a newer
  // move has made outdated stops at its next slice.
  var STALE = { stale: true };
  var SLICE_MS = 10;
  var nextTask = (function () {
    if (typeof MessageChannel === 'undefined') return function () { return new Promise(function (r) { setTimeout(r, 0); }); };
    var ch = new MessageChannel(), waiting = [];
    ch.port1.onmessage = function () { var f = waiting.shift(); if (f) f(); };
    return function () { return new Promise(function (r) { waiting.push(r); ch.port2.postMessage(0); }); };
  })();
  function sliced(n, fn, job) {
    var i = 0;
    return new Promise(function (resolve, reject) {
      (function step() {
        if (job.stale) { reject(STALE); return; }
        var end = performance.now() + SLICE_MS;
        while (i < n) {
          fn(i++);
          if ((i & 7) === 0 && performance.now() > end) break;
        }
        if (i < n) nextTask().then(step); else resolve();
      })();
    });
  }
  var currentJob = null;

  function encode(h, roof) {
    var n = h.length, out = new Uint8Array(n * 4);
    for (var i = 0, j = 0; i < n; i++, j += 4) {
      var v = Math.max(0, Math.min(16777215, Math.round((h[i] + 1000) * 100)));
      out[j] = (v >> 16) & 255; out[j + 1] = (v >> 8) & 255; out[j + 2] = v & 255;
      out[j + 3] = roof && roof[i] ? 255 : 128;
    }
    return out;
  }

  // Polygon fill (even-odd, pixel centres) - keeps the highest value per pixel.
  function fillPolygon(h, roof, W, H, rings, v) {
    var ymin = Infinity, ymax = -Infinity, i, k;
    for (i = 0; i < rings.length; i++) for (k = 0; k < rings[i].length; k++) {
      var y = rings[i][k][1];
      if (y < ymin) ymin = y;
      if (y > ymax) ymax = y;
    }
    var r0 = Math.max(0, Math.ceil(ymin - 0.5)), r1 = Math.min(H - 1, Math.floor(ymax - 0.5));
    var xs = [];
    for (var row = r0; row <= r1; row++) {
      var yc = row + 0.5;
      xs.length = 0;
      for (i = 0; i < rings.length; i++) {
        var ring = rings[i];
        for (k = 0; k < ring.length - 1; k++) {
          var a = ring[k], b = ring[k + 1];
          if ((a[1] <= yc) !== (b[1] <= yc)) xs.push(a[0] + (yc - a[1]) * (b[0] - a[0]) / (b[1] - a[1]));
        }
      }
      xs.sort(function (p, q) { return p - q; });
      for (i = 0; i + 1 < xs.length; i += 2) {
        var c0 = Math.max(0, Math.ceil(xs[i] - 0.5)), c1 = Math.min(W - 1, Math.floor(xs[i + 1] - 0.5));
        for (var c = c0; c <= c1; c++) {
          var idx = row * W + c;
          if (v > h[idx]) { h[idx] = v; roof[idx] = 1; }
        }
      }
    }
  }

  function polygonsOf(g) {
    return g.type === 'Polygon' ? [g.coordinates] : g.type === 'MultiPolygon' ? g.coordinates : [];
  }
  // Same point MapLibre lifts a building to: the average of all its corners.
  function centroidOf(poly) {
    var sx = 0, sy = 0, n = 0;
    for (var i = 0; i < poly.length; i++) {
      for (var k = 0; k < poly[i].length - 1; k++) { sx += mx(poly[i][k][0]); sy += my(poly[i][k][1]); n++; }
    }
    return n ? [sx / n, sy / n] : null;
  }

  // Grid sizes for the next build: smaller while the sun plays (each update marches
  // every pixel toward the sun, so 1024 instead of 2048 is ~4x cheaper), full on pause.
  function quality() {
    var play = state.playing;
    return {
      fine: play ? Math.min(MAX, scfg.playMaxSize || MAX) : MAX,
      coarse: play ? Math.min(COARSE, scfg.playCoarse || COARSE) : COARSE
    };
  }

  var region = null;      // the current height models + geometry
  var building = false, buildAgain = false;

  function buildRegion() {
    var map = ns.map;
    if (!map || !ns.dem) return Promise.resolve(null);
    var c = map.getCenter(), zoom = map.getZoom();
    var cx = mx(c.lng), cy = my(c.lat), mpu = metresPerUnit(c.lat);
    var r = { q: quality() };

    // Shadows are only shown within the buildings data's extent + a buffer (Mercator
    // box [west, north, east, south]); with no buildings layer, anywhere.
    var bb = ns.buildings && ns.buildings.bounds, buf = scfg.extentBuffer / mpu;
    r.clip = bb ? [mx(bb[0]) - buf, my(bb[3]) - buf, mx(bb[2]) + buf, my(bb[1]) + buf] : [-1, -1, 2, 2];

    // What's on screen (capped for tilted views that reach the horizon), within the
    // shadow extent. Only this area is modelled and shaded - plus a margin around
    // it, since a hill just outside the view can still shade into it.
    var b = map.getBounds(), Rv = scfg.terrainRadius / mpu;
    var vx0 = Math.max(mx(b.getWest()), cx - Rv, r.clip[0]), vx1 = Math.min(mx(b.getEast()), cx + Rv, r.clip[2]);
    var vy0 = Math.max(my(b.getNorth()), cy - Rv, r.clip[1]), vy1 = Math.min(my(b.getSouth()), cy + Rv, r.clip[3]);
    var inView = vx1 > vx0 && vy1 > vy0;
    if (!inView) { vx0 = cx - 100 / mpu; vx1 = cx + 100 / mpu; vy0 = cy - 100 / mpu; vy1 = cy + 100 / mpu; }

    // Coarse terrain model (hill shadows): the view + caster margin, as detailed as
    // the zoom needs (no finer than terrainMinPixel).
    var Mc = scfg.casterMargin / mpu;
    var cx0 = vx0 - Mc, cy0 = vy0 - Mc, cw = vx1 - vx0 + 2 * Mc, chh = vy1 - vy0 + 2 * Mc;
    var pmC = Math.max(Math.max(cw, chh) / r.q.coarse, scfg.terrainMinPixel / mpu);
    r.c = { x0: cx0, y0: cy0, pm: pmC, W: notPow2(Math.max(3, Math.ceil(cw / pmC))), H: notPow2(Math.max(3, Math.ceil(chh / pmC))) };
    r.c.mpp = r.c.pm * mpu;
    r.terrainOn = inView && zoom >= scfg.terrainMinZoom;
    var demC = new Dem(demZoom(Math.log2(mpu / (256 * r.c.mpp))));

    // Fine model (buildings): the same view, also capped to the radius.
    r.buildingsOn = !!(inView && ns.buildings && zoom >= scfg.minZoom);
    var R = scfg.radius / mpu, M = 150 / mpu;
    var x0 = Math.max(vx0, cx - R) - M, x1 = Math.min(vx1, cx + R) + M;
    var y0 = Math.max(vy0, cy - R) - M, y1 = Math.min(vy1, cy + R) + M;
    if (x1 <= x0 || y1 <= y0) { r.buildingsOn = false; x0 = vx0; x1 = vx1; y0 = vy0; y1 = vy1; }
    var pm = Math.max(Math.max(x1 - x0, y1 - y0) / r.q.fine, 0.5 / mpu);
    r.f = { x0: x0, y0: y0, pm: pm, W: notPow2(Math.max(3, Math.ceil((x1 - x0) / pm))), H: notPow2(Math.max(3, Math.ceil((y1 - y0) / pm))) };
    r.f.mpp = pm * mpu;
    // The terrain zoom MapLibre itself uses near the centre, so roofs match exactly.
    var demF = new Dem(Math.max(ns.dem.minzoom || 0, Math.min(ns.dem.maxzoom, Math.floor(zoom) - 1)));

    var jobs = [r.terrainOn || r.buildingsOn ? demC.load(r.c.x0, r.c.y0, r.c.x0 + r.c.W * r.c.pm, r.c.y0 + r.c.H * r.c.pm) : null];
    if (r.buildingsOn) jobs.push(demF.load(x0, y0, x1, y1));
    // Read the map now, while it still shows this view - the rest runs over many
    // slices, and the map could move in between.
    var job = currentJob = { stale: false };
    var T = ns.shadows.timings = { start: performance.now() };
    var src = null, feats = null;
    if (r.buildingsOn) {
      src = map.querySourceFeatures('buildings', { sourceLayer: ns.buildings.sourceLayer });
      feats = map.queryRenderedFeatures({ layers: [ns.buildings.layerId] });
      T.query = Math.round(performance.now() - T.start);
      T.sourceFeatures = src.length;
      T.renderedFeatures = feats.length;
    }
    var C = r.c, ch = new Float32Array(C.W * C.H), maxC = -1e9;
    return Promise.all(jobs).then(function () {
      T.dem = Math.round(performance.now() - T.start);
      // Coarse terrain heights at pixel centres.
      return sliced(C.H, function (j) {
        var yy = C.y0 + (j + 0.5) * C.pm;
        for (var i = 0; i < C.W; i++) {
          var v = demC.at(C.x0 + (i + 0.5) * C.pm, yy);
          ch[j * C.W + i] = v;
          if (v > maxC) maxC = v;
        }
      }, job);
    }).then(function () {
      C.maxH = maxC;
      C.bytes = new Uint8Array(C.W * C.H * 4);
      return sliced(C.H, function (j) { encodeRow(ch, null, C.bytes, j, C.W); }, job);
    }).then(function () {
      T.coarse = Math.round(performance.now() - T.start - T.dem);
      if (!r.buildingsOn) return null;
      // Handed over, not kept here: buildFine lets go of them as soon as it is done
      // with each (this scope would otherwise hold both until the whole build ends).
      var s = src, f = feats;
      src = feats = null;
      return buildFine(r, demF, s, f, job, T);
    }).then(function () {
      T.total = Math.round(performance.now() - T.start);
      return r;
    });
  }

  function buildFine(r, dem, src, feats, job, T) {
    var t0 = performance.now(), lap = function (k) { var n = performance.now(); T[k] = Math.round(n - t0); t0 = n; };
    var F = r.f, W = F.W, H = F.H;
    // Terrain on a 4x coarser grid, then stretched (the elevation data is ~15 m/px anyway).
    var Q = 4, Wq = Math.ceil(W / Q) + 2, Hq = Math.ceil(H / Q) + 2, tq = new Float32Array(Wq * Hq);
    var h = new Float32Array(W * H), roof = new Uint8Array(W * H), maxH = -1e9;
    function toPx(p) { return [(mx(p[0]) - F.x0) / F.pm, (my(p[1]) - F.y0) / F.pm]; }
    var hf = ns.buildings.heightField;
    // Wall geometry (the heavy part) is only built when the walls are shaded.
    var withWalls = state.walls3d;
    var roofV = new FloatList(), wallV = new FloatList(), wallN = new FloatList(), seen = {};

    return sliced(Hq, function (j) {
      for (var i = 0; i < Wq; i++) tq[j * Wq + i] = dem.at(F.x0 + i * Q * F.pm, F.y0 + j * Q * F.pm);
    }, job).then(function () {
      return sliced(H, function (j) {
        var gy = (j + 0.5) / Q, iy = Math.floor(gy), fy = gy - iy;
        for (var i = 0; i < W; i++) {
          var gx = (i + 0.5) / Q, ix = Math.floor(gx), fx = gx - ix, o = iy * Wq + ix;
          h[j * W + i] = (tq[o] * (1 - fx) + tq[o + 1] * fx) * (1 - fy) + (tq[o + Wq] * (1 - fx) + tq[o + Wq + 1] * fx) * fy;
        }
      }, job);
    }).then(function () {
      lap('fineTerrain');
      // Every building loaded around the view (also just off screen) casts shadows.
      return sliced(src.length, function (s) {
        var hb = ns.buildingHeight(src[s].properties);
        var polys = polygonsOf(src[s].geometry);
        for (var p = 0; p < polys.length; p++) {
          var ring0 = polys[p][0];
          if (!ring0 || ring0.length < 4) continue;
          var c = centroidOf(polys[p]);
          if (!c || c[0] < F.x0 || c[1] < F.y0 || c[0] > F.x0 + W * F.pm || c[1] > F.y0 + H * F.pm) continue;
          fillPolygon(h, roof, W, H, polys[p].map(function (rg) { return rg.map(toPx); }), dem.at(c[0], c[1]) + hb);
        }
      }, job);
    }).then(function () {
      src = null;   // every building is on the height grid now
      // Trees (from the 3D trees layer): the crown's top surface, so they shade the
      // ground, buildings and each other.
      var trees = (ns.trees && ns.trees.list) || [];
      return sliced(trees.length, function (n) {
        var tr = trees[n], x = mx(tr.lon), y = my(tr.lat);
        if (x < F.x0 || y < F.y0 || x > F.x0 + W * F.pm || y > F.y0 + H * F.pm) return;
        var E = dem.at(x, y), cx = (x - F.x0) / F.pm, cy = (y - F.y0) / F.pm, rp = Math.max(tr.r / F.mpp, 0.7);
        var r0 = Math.max(0, Math.floor(cy - rp)), r1 = Math.min(H - 1, Math.ceil(cy + rp));
        var c0 = Math.max(0, Math.floor(cx - rp)), c1 = Math.min(W - 1, Math.ceil(cx + rp));
        for (var row = r0; row <= r1; row++) for (var col = c0; col <= c1; col++) {
          var dx = col + 0.5 - cx, dy = row + 0.5 - cy, rho = Math.sqrt(dx * dx + dy * dy) / rp;
          if (rho >= 1) continue;
          var top = tr.kind === 'conifer' ? tr.h * (0.15 + 0.85 * (1 - Math.pow(rho, 1 / 0.85)))
            : tr.kind === 'palm' ? tr.h * (0.9 + 0.1 * Math.sqrt(1 - rho * rho))
            : tr.h * (0.65 + 0.35 * Math.sqrt(1 - rho * rho));
          var idx = row * W + col, v = E + top;
          if (v > h[idx]) { h[idx] = v; roof[idx] = 2; }
        }
      }, job);
    }).then(function () {
      F.bytes = new Uint8Array(W * H * 4);
      return sliced(H, function (j) {
        for (var i = j * W, e = i + W; i < e; i++) if (h[i] > maxH) maxH = h[i];
        encodeRow(h, roof, F.bytes, j, W);
      }, job);
    }).then(function () {
      F.maxH = maxH;
      lap('rasterize');
      // Geometry for the shade drawn on the buildings themselves: the pieces on screen
      // (exactly the ones MapLibre draws), at the height MapLibre gives them.
      return sliced(feats.length, function (f) {
        var hh = ns.buildingHeight(feats[f].properties);
        var pl = polygonsOf(feats[f].geometry);
        for (var q = 0; q < pl.length; q++) {
          var poly = pl[q];
          if (!poly[0] || poly[0].length < 4) continue;
          var key = poly[0][0][0].toFixed(7) + ',' + poly[0][0][1].toFixed(7) + ',' + poly[0].length + ',' + hh;
          if (seen[key]) continue;
          seen[key] = 1;
          var cc = centroidOf(poly);
          addBuilding(poly.map(function (rg) { return rg.map(toPx); }), dem.at(cc[0], cc[1]), hh, roofV, withWalls ? wallV : null, wallN);
        }
      }, job);
    }).then(function () {
      r.roofs = roofV.finish();
      r.walls = wallV.finish();
      r.wallNormals = wallN.finish();
      r.hasWalls = withWalls;
      feats = null;
      lap('geometry');
      T.grid = [W, H];
    });
  }

  // A growing list of floats in one typed array (a plain array costs 8 bytes a number
  // and is copied again at the end).
  function FloatList() { this.a = new Float32Array(1 << 14); this.n = 0; }
  FloatList.prototype.add = function (v) {
    if (this.n === this.a.length) {
      var bigger = new Float32Array(this.a.length * 2);
      bigger.set(this.a);
      this.a = bigger;
    }
    this.a[this.n++] = v;
  };
  FloatList.prototype.finish = function () { var out = this.a.slice(0, this.n); this.a = null; return out; };

  // wallV null = no walls (roofs only).
  function addBuilding(rings, E, h, roofV, wallV, wallN) {
    // Roof: triangulated, a hair above MapLibre's roof.
    var flat = [], holes = [], i, k;
    for (i = 0; i < rings.length; i++) {
      if (i > 0) holes.push(flat.length / 2);
      for (k = 0; k < rings[i].length - 1; k++) flat.push(rings[i][k][0], rings[i][k][1]);
    }
    var tri = window.earcut ? window.earcut(flat, holes.length ? holes : null, 2) : [];
    var zr = E + h + 0.15;
    for (i = 0; i < tri.length; i++) { roofV.add(flat[tri[i] * 2]); roofV.add(flat[tri[i] * 2 + 1]); roofV.add(zr); }
    if (!wallV) return;

    // Walls: from MapLibre's 10 m "basement" up to the roof, with outward normals.
    var zb = E - 10, zt = E + h;
    for (i = 0; i < rings.length; i++) {
      var ring = rings[i], area = 0;
      for (k = 0; k < ring.length - 1; k++) area += ring[k][0] * ring[k + 1][1] - ring[k + 1][0] * ring[k][1];
      var sgn = area > 0 ? 1 : -1;
      for (k = 0; k < ring.length - 1; k++) {
        var a = ring[k], b = ring[k + 1], dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
        if (len < 1e-6) continue;
        var nx = sgn * dy / len, ny = -sgn * dx / len;
        var wv = [a[0], a[1], zb, b[0], b[1], zb, b[0], b[1], zt, a[0], a[1], zb, b[0], b[1], zt, a[0], a[1], zt];
        for (var w = 0; w < 18; w++) wallV.add(wv[w]);
        for (var v = 0; v < 6; v++) { wallN.add(nx); wallN.add(ny); wallN.add(1); }
      }
    }
  }

  // ---------- GPU: shared shader code ----------
  var COMMON = [
    'precision highp float;',
    'uniform sampler2D u_dsm; uniform vec2 u_dsmSize;',
    'uniform sampler2D u_ter; uniform vec2 u_terSize;',
    'uniform vec2 u_sun; uniform float u_tanAlt;',
    'uniform float u_mpp; uniform float u_mppC; uniform float u_maxH; uniform float u_maxHC;',
    'uniform vec2 u_f2cS; uniform vec2 u_f2cO;',
    'float decodeH(vec4 t) { return dot(floor(t.rgb * 255.0 + 0.5), vec3(65536.0, 256.0, 1.0)) / 100.0 - 1000.0; }',
    'float hFine(vec2 p) { return decodeH(texture2D(u_dsm, (floor(p) + 0.5) / u_dsmSize)); }',
    'float hTerPx(vec2 i) { return decodeH(texture2D(u_ter, (i + 0.5) / u_terSize)); }',
    'float hTer(vec2 q) {',
    '  vec2 g = q - 0.5; vec2 i = floor(g); vec2 f = g - i;',
    '  return mix(mix(hTerPx(i), hTerPx(i + vec2(1.0, 0.0)), f.x), mix(hTerPx(i + vec2(0.0, 1.0)), hTerPx(i + vec2(1.0, 1.0)), f.x), f.y);',
    '}',
    // Buildings + nearby ground: 1-pixel steps near the point, longer further away.
    'float marchFine(vec2 p, float z) {',
    '  float d = 1.0;',
    '  for (int i = 0; i < 480; i++) {',
    '    vec2 q = p + u_sun * d;',
    '    if (q.x < 0.0 || q.y < 0.0 || q.x >= u_dsmSize.x || q.y >= u_dsmSize.y) return 0.0;',
    '    float rz = z + d * u_mpp * u_tanAlt;',
    '    if (rz > u_maxH) return 0.0;',
    '    if (hFine(q) > rz + 0.3) return 1.0;',
    '    d += max(1.0, d * 0.012);',
    '  }',
    '  return 0.0;',
    '}',
    // Hills, over the wide terrain model.
    'float marchTer(vec2 q, float z) {',
    '  z = max(z, hTer(q));',
    '  float d = 1.5;',
    '  for (int i = 0; i < 400; i++) {',
    '    vec2 s = q + u_sun * d;',
    '    if (s.x < 0.0 || s.y < 0.0 || s.x >= u_terSize.x || s.y >= u_terSize.y) return 0.0;',
    '    float rz = z + d * u_mppC * u_tanAlt;',
    '    if (rz > u_maxHC) return 0.0;',
    '    if (hTer(s) > rz + 3.0) return 1.0;',
    '    d += max(1.0, d * 0.03);',               // far hills are big: longer steps out there
    '  }',
    '  return 0.0;',
    '}'
  ].join('\n');

  function compile(gl, vs, fs) {
    function sh(type, src) {
      var s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    }
    var p = gl.createProgram();
    gl.attachShader(p, sh(gl.VERTEX_SHADER, vs));
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    p.u = {};
    var n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) {
      var info = gl.getActiveUniform(p, i);
      p.u[info.name] = gl.getUniformLocation(p, info.name);
    }
    return p;
  }
  function makeTex(gl, linear) {
    var t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, linear ? gl.LINEAR : gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  function upload(gl, tex, W, H, data, source) {
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
    if (source) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
  }
  function commonUniforms(gl, p, r) {
    var s = state.sunVec;
    gl.uniform2f(p.u.u_dsmSize, r.buildingsOn ? r.f.W : 1, r.buildingsOn ? r.f.H : 1);
    gl.uniform2f(p.u.u_terSize, r.c.W, r.c.H);
    gl.uniform2f(p.u.u_sun, s[0], s[1]);
    gl.uniform1f(p.u.u_tanAlt, state.tanAlt);
    gl.uniform1f(p.u.u_mpp, r.f.mpp);
    gl.uniform1f(p.u.u_mppC, r.c.mpp);
    gl.uniform1f(p.u.u_maxH, r.f.maxH || 0);
    gl.uniform1f(p.u.u_maxHC, r.c.maxH);
    gl.uniform2f(p.u.u_f2cS, r.f.pm / r.c.pm, r.f.pm / r.c.pm);
    gl.uniform2f(p.u.u_f2cO, (r.f.x0 - r.c.x0) / r.c.pm, (r.f.y0 - r.c.y0) / r.c.pm);
    gl.uniform1i(p.u.u_dsm, 0);
    gl.uniform1i(p.u.u_ter, 1);
  }

  // ---------- GPU: the shadow passes (hidden canvas) ----------
  var GPU = null;
  function gpu() {
    if (GPU) return GPU;
    var canvas = document.createElement('canvas');
    var gl = canvas.getContext('webgl', { premultipliedAlpha: false, preserveDrawingBuffer: true, antialias: false, depth: false, stencil: false });
    if (!gl) throw new Error('WebGL not available for shadows');
    var VS = 'attribute vec2 a_xy; void main() { gl_Position = vec4(a_xy, 0.0, 1.0); }';
    // Pixel in the model, counted from the north-west corner (like the uploaded data).
    var FROM_TOP_F = 'vec2 pf() { return vec2(gl_FragCoord.x, u_dsmSize.y - gl_FragCoord.y); }';
    var FROM_TOP_C = 'vec2 pc() { return vec2(gl_FragCoord.x, u_terSize.y - gl_FragCoord.y); }';
    // 1 inside the buildings' extent + buffer, fading to 0 at its edge (box and fade
    // in the pixels of whichever model is being drawn).
    var CLIP = 'uniform vec4 u_clip; uniform float u_clipFade;' +
      'float inClip(vec2 p) { vec2 d = min(p - u_clip.xy, u_clip.zw - p); return smoothstep(0.0, u_clipFade, min(d.x, d.y)); }';
    var g = {
      canvas: canvas, gl: gl,
      quad: gl.createBuffer(),
      // Terrain-only shadow, wide area.
      coarse: compile(gl, VS, COMMON + FROM_TOP_C +
        'void main() { vec2 q = pc(); gl_FragColor = vec4(marchTer(q, hTer(q)), 0.0, 0.0, 1.0); }'),
      // On the fine model: r = shadow from buildings/nearby ground, g = 1 on roofs,
      // b = hill shadow traced from this exact point (sharp edges up close).
      // (The hill shadow is only traced again near the coarse result's edges; well
      // inside or outside a hill shadow the coarse answer is used as is.)
      fine: compile(gl, VS, COMMON + FROM_TOP_F + 'uniform sampler2D u_cs;' +
        'float hill(vec2 q, float z) {' +
        '  vec2 c = floor(q); float lo = 1.0, hi = 0.0;' +
        '  for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {' +
        '    vec2 k = c + vec2(float(x), float(y)) + 0.5;' +
        '    float v = texture2D(u_cs, vec2(k.x, u_terSize.y - k.y) / u_terSize).r;' +
        '    lo = min(lo, v); hi = max(hi, v); }' +
        '  if (hi < 0.5) return 0.0;' +
        '  if (lo > 0.5) return 1.0;' +
        '  return marchTer(q, z); }' +
        'void main() { vec2 p = pf(); vec4 t = texture2D(u_dsm, p / u_dsmSize); float z = decodeH(t);' +
        // Under a tree's crown (alpha ~0.59) it is always shade.
        ' float tree = step(0.55, t.a) * step(t.a, 0.65);' +
        ' gl_FragColor = vec4(max(marchFine(p, z), tree), step(0.75, t.a), hill(p * u_f2cS + u_f2cO, z), 1.0); }'),
      // Hill shadow image for the map (alpha = shade). Fades out at its own edges and
      // into the detailed area, which draws its own. (Strength is baked into the
      // image: MapLibre ignores raster-opacity for images draped on terrain.)
      coarseShow: compile(gl, VS, COMMON + CLIP + 'uniform sampler2D u_cs; uniform vec3 u_color; uniform float u_opacity;' +
        'uniform vec4 u_fineBox; uniform float u_c2fPx;' +
        'void main() { vec2 q = vec2(gl_FragCoord.x, u_terSize.y - gl_FragCoord.y);' +
        ' if (inClip(q) <= 0.0) { gl_FragColor = vec4(0.0); return; }' +
        ' float t = texture2D(u_cs, gl_FragCoord.xy / u_terSize).r;' +
        ' vec2 e = min(gl_FragCoord.xy, u_terSize - gl_FragCoord.xy);' +
        ' vec2 fi = min(q - u_fineBox.xy, u_fineBox.zw - q);' +
        ' float inside = u_fineBox.z > u_fineBox.x ? smoothstep(0.0, 40.0, min(fi.x, fi.y) * u_c2fPx) : 0.0;' +
        ' gl_FragColor = vec4(u_color, u_opacity * t * inClip(q) * (1.0 - inside) * smoothstep(0.0, 24.0, min(e.x, e.y))); }'),
      // Ground shadow image for the detailed area: buildings + hills, softened by a
      // pixel, nothing under roofs (the roofs get their own), edges faded out.
      fineShow: compile(gl, VS, COMMON + CLIP + FROM_TOP_F + 'uniform sampler2D u_fs; uniform vec3 u_color; uniform float u_opacity;' +
        'void main() { float s = 0.0, w = 0.0; float clip = inClip(pf());' +
        ' if (clip <= 0.0) { gl_FragColor = vec4(0.0); return; }' +
        ' for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {' +
        '   vec4 c = texture2D(u_fs, (gl_FragCoord.xy + vec2(float(x), float(y))) / u_dsmSize);' +
        '   s += max(c.r, c.b) * (1.0 - c.g); w += 1.0 - c.g; }' +
        ' float roof = texture2D(u_fs, gl_FragCoord.xy / u_dsmSize).g;' +
        ' float b = w > 0.0 ? s / w : 0.0;' +
        ' vec2 e = min(gl_FragCoord.xy, u_dsmSize - gl_FragCoord.xy);' +
        ' gl_FragColor = vec4(u_color, u_opacity * b * clip * (1.0 - roof) * smoothstep(0.0, 40.0, min(e.x, e.y))); }'),
      // For the buildings layer, top row = north: red = shade on roofs, green = hill
      // shadow (used for walls).
      roofShow: compile(gl, VS, COMMON + 'uniform sampler2D u_fs;' +
        'void main() { vec4 c = texture2D(u_fs, gl_FragCoord.xy / u_dsmSize);' +
        ' gl_FragColor = vec4(max(c.r, c.b) * c.g, c.b, 0.0, 1.0); }'),
      dsm: makeTex(gl, false), ter: makeTex(gl, false),
      csTex: makeTex(gl, true), fsTex: makeTex(gl, false),
      csFbo: gl.createFramebuffer(), fsFbo: gl.createFramebuffer(),
      coarseCanvas: document.createElement('canvas'),
      fineCanvas: document.createElement('canvas'),
      roofCanvas: document.createElement('canvas')
    };
    gl.bindBuffer(gl.ARRAY_BUFFER, g.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
    GPU = g;
    return g;
  }

  function target(g, fbo, tex, W, H) {
    var gl = g.gl;
    if (tex) {
      gl.bindTexture(gl.TEXTURE_2D, tex);
      if (tex._w !== W || tex._h !== H) {
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        tex._w = W; tex._h = H;
      }
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    } else {
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (g.canvas.width !== W || g.canvas.height !== H) { g.canvas.width = W; g.canvas.height = H; }
    }
    gl.viewport(0, 0, W, H);
  }
  function run(g, prog, r, extra) {
    var gl = g.gl;
    gl.useProgram(prog);
    commonUniforms(gl, prog, r);
    if (extra) extra(gl, prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, g.quad);
    var loc = gl.getAttribLocation(prog, 'a_xy');
    gl.enableVertexAttribArray(loc);
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  // GPU result -> a plain 2D canvas, through raw pixels. (drawImage from the WebGL
  // canvas loses the transparency once MapLibre uploads the copy.)
  function copyTo(g, dest, W, H) {
    var gl = g.gl, row = W * 4, n = row * H;
    // One scratch buffer for all three images (grown when needed, never reallocated
    // for a smaller one): no 16 MB array per call.
    if (!g.px || g.px.length < n) g.px = new Uint8Array(n);
    if (!g.rowTmp || g.rowTmp.length < row) g.rowTmp = new Uint8Array(row);
    var px = g.px.subarray(0, n), tmp = g.rowTmp;
    gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, px);
    // GL rows run bottom-up: flip them in place.
    for (var y = 0, half = H >> 1; y < half; y++) {
      var a = y * row, b = (H - 1 - y) * row;
      tmp.set(px.subarray(a, a + row));
      px.copyWithin(a, b, b + row);
      px.set(tmp.subarray(0, row), b);
    }
    if (dest.width !== W || dest.height !== H) { dest.width = W; dest.height = H; }
    // The ImageData looks at the same bytes: nothing is copied but into the canvas.
    dest.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px.buffer, px.byteOffset, n), W, H), 0, 0);
  }

  // The height models' bytes are copies of what is now in the GPU textures (the hidden
  // canvas' and the map's own): once both have them, the CPU copies can go.
  function releaseBytes(r) {
    if (!r.gpuDone || (r.buildingsOn && !r.layerDone)) return;
    r.c.bytes = null;
    r.f.bytes = null;
  }

  function computeShadows() {
    var r = region;
    if (!r) return false;
    var g = gpu(), gl = g.gl;
    if (r !== g.uploaded) {
      upload(gl, g.ter, r.c.W, r.c.H, r.c.bytes);
      if (r.buildingsOn) upload(gl, g.dsm, r.f.W, r.f.H, r.f.bytes);
      g.uploaded = r;
      r.gpuDone = true;
      releaseBytes(r);
    }
    var color = hexRgb(scfg.color);
    function bind(gl) {
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, g.dsm);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, g.ter);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, g.csTex);
      gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, g.fsTex);
    }
    function showUniforms(gl, p) {
      if (p.u.u_cs) gl.uniform1i(p.u.u_cs, 2);
      if (p.u.u_fs) gl.uniform1i(p.u.u_fs, 3);
      if (p.u.u_color) gl.uniform3f(p.u.u_color, color[0], color[1], color[2]);
      if (p.u.u_opacity) gl.uniform1f(p.u.u_opacity, scfg.groundOpacity * state.strength);
      if (p.u.u_clip) {
        // The clip box in this model's pixels (coarse model for the hill image, fine
        // model for the ground image).
        var m = p === g.coarseShow ? r.c : r.f, cl = r.clip;
        gl.uniform4f(p.u.u_clip, (cl[0] - m.x0) / m.pm, (cl[1] - m.y0) / m.pm, (cl[2] - m.x0) / m.pm, (cl[3] - m.y0) / m.pm);
        gl.uniform1f(p.u.u_clipFade, Math.max(1, scfg.extentFade / m.mpp));
      }
      if (p.u.u_fineBox) {
        // The detailed area in hill-model pixels (empty when there is none).
        var k = r.f.pm / r.c.pm, ox = (r.f.x0 - r.c.x0) / r.c.pm, oy = (r.f.y0 - r.c.y0) / r.c.pm;
        if (r.buildingsOn) gl.uniform4f(p.u.u_fineBox, ox, oy, ox + r.f.W * k, oy + r.f.H * k);
        else gl.uniform4f(p.u.u_fineBox, 0, 0, 0, 0);
        gl.uniform1f(p.u.u_c2fPx, r.c.pm / r.f.pm);
      }
    }
    gl.disable(gl.BLEND);

    // Hills.
    target(g, g.csFbo, g.csTex, r.c.W, r.c.H);
    bind(gl);
    if (r.terrainOn) run(g, g.coarse, r);
    else { gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); }
    target(g, null, null, r.c.W, r.c.H);
    bind(gl);
    run(g, g.coarseShow, r, showUniforms);
    copyTo(g, g.coarseCanvas, r.c.W, r.c.H);

    // Buildings.
    if (r.buildingsOn) {
      target(g, g.fsFbo, g.fsTex, r.f.W, r.f.H);
      bind(gl);
      run(g, g.fine, r, showUniforms);
      target(g, null, null, r.f.W, r.f.H);
      bind(gl);
      run(g, g.fineShow, r, showUniforms);
      copyTo(g, g.fineCanvas, r.f.W, r.f.H);
      run(g, g.roofShow, r, showUniforms);
      copyTo(g, g.roofCanvas, r.f.W, r.f.H);
    }
    return true;
  }

  // ---------- On the map ----------
  function corners(x0, y0, x1, y1) {
    return [[lngOf(x0), latOf(y0)], [lngOf(x1), latOf(y0)], [lngOf(x1), latOf(y1)], [lngOf(x0), latOf(y1)]];
  }
  // Ground shadows go above every flat map layer (land, roads, ...) so streets get
  // shaded too, but below the labels that follow them.
  var FLAT = { background: 1, fill: 1, line: 1, raster: 1, hillshade: 1 };
  function groundShadowBefore(map) {
    var layers = map.getStyle().layers || [], last = -1;
    for (var i = 0; i < layers.length; i++) {
      if (FLAT[layers[i].type] && layers[i].id !== COARSE_ID && layers[i].id !== FINE_ID) last = i;
    }
    return layers[last + 1] ? layers[last + 1].id : undefined;
  }
  function afterBuildings(map) {
    var layers = map.getStyle().layers || [];
    for (var i = 0; i < layers.length; i++) {
      if (layers[i].id === (ns.layers && ns.layers.buildings)) return layers[i + 1] ? layers[i + 1].id : undefined;
    }
    return undefined;
  }

  var nudge = false;
  function showOnMap() {
    var map = ns.map, g = GPU, r = region;
    if (!map || !g || !r) return;
    var cc = corners(r.c.x0, r.c.y0, r.c.x0 + r.c.W * r.c.pm, r.c.y0 + r.c.H * r.c.pm);
    var fc = corners(r.f.x0, r.f.y0, r.f.x0 + r.f.W * r.f.pm, r.f.y0 + r.f.H * r.f.pm);
    var before = groundShadowBefore(map);
    // The draped images.
    [[COARSE_ID, g.coarseCanvas, cc, true], [FINE_ID, g.fineCanvas, fc, r.buildingsOn]].forEach(function (s) {
      var src = map.getSource(s[0]);
      if (!s[3] && !src) return;
      if (!src) {
        map.addSource(s[0], { type: 'canvas', canvas: s[1], coordinates: s[2], animate: false });
        map.addLayer({ id: s[0], type: 'raster', source: s[0],
          // Not exactly 1: at 1 MapLibre draws the image as opaque (depth-writing).
          paint: { 'raster-opacity': 0.99, 'raster-fade-duration': 0, 'raster-resampling': 'linear' } }, before);
        src = map.getSource(s[0]);
      } else if (JSON.stringify(src.coordinates) !== JSON.stringify(s[2])) {
        src.setCoordinates(s[2]);
      }
      if (src.play) { src.play(); src.pause(); }
    });
    // The roofs/walls layer.
    if (ns.buildings && !map.getLayer(LAYER3D_ID)) map.addLayer(layer3d, afterBuildings(map));
    layer3d.dirtyTextures = true;
    if (r !== layer3d.geomFor) layer3d.dirtyGeometry = true;
    applyOpacity();
    // Re-drape: the terrain caches what's drawn on it and redraws it after any style
    // change - a tiny opacity nudge is that change.
    nudge = !nudge;
    [COARSE_ID, FINE_ID].forEach(function (id) {
      if (map.getLayer(id)) map.setPaintProperty(id, 'raster-opacity', nudge ? 0.99 : 0.985);
    });
    map.triggerRepaint();
  }

  function applyOpacity() {
    var map = ns.map;
    if (!map) return;
    var on = state.enabled && state.alt > 0.5 && !!region;
    function vis(id, show) {
      if (!map.getLayer(id)) return;
      var v = show ? 'visible' : 'none';
      if (map.getLayoutProperty(id, 'visibility') !== v) map.setLayoutProperty(id, 'visibility', v);
    }
    vis(COARSE_ID, on && region.terrainOn);
    vis(FINE_ID, on && region.buildingsOn);
    map.triggerRepaint();
  }

  // Custom layer: the shade drawn on roofs (always) and walls (3D shade on).
  var layer3d = {
    id: LAYER3D_ID, type: 'custom', renderingMode: '3d',
    onAdd: function (map, gl) {
      this.gl = gl;
      var VS = [
        'attribute vec3 a_pos; attribute vec3 a_nrm;',
        'uniform mat4 u_matrix;',
        'varying vec3 v_pos; varying vec3 v_nrm;',
        'void main() { v_pos = a_pos; v_nrm = a_nrm; gl_Position = u_matrix * vec4(a_pos, 1.0); }'
      ].join('\n');
      var FS = COMMON + [
        'uniform sampler2D u_roof;',
        'uniform vec3 u_color; uniform float u_alpha;',
        'varying vec3 v_pos; varying vec3 v_nrm;',
        'void main() {',
        '  float shade;',
        '  if (v_nrm.z < 0.5) {',
        '    shade = texture2D(u_roof, v_pos.xy / u_dsmSize).r;',
        '  } else {',
        '    vec2 n = normalize(v_nrm.xy);',
        '    if (dot(n, u_sun) <= 0.0) discard;',       // facing away: the lighting shades it
        '    vec2 p = v_pos.xy + n * 0.75;',
        '    shade = max(marchFine(p, v_pos.z), texture2D(u_roof, p / u_dsmSize).g);',
        '  }',
        '  if (shade < 0.03) discard;',
        '  float a = u_alpha * shade;',
        '  gl_FragColor = vec4(u_color * a, a);',
        '}'
      ].join('\n');
      this.prog = compile(gl, VS, FS);
      this.roofBuf = gl.createBuffer();
      this.wallBuf = gl.createBuffer();
      this.wallNrmBuf = gl.createBuffer();
      this.dsm = makeTex(gl, false);
      this.ter = makeTex(gl, false);
      this.roofTex = makeTex(gl, true);
      this.dirtyGeometry = this.dirtyTextures = true;
    },
    render: function (gl, matrix) {
      var r = region, map = ns.map;
      if (!r || !r.buildingsOn || !state.enabled || state.alt <= 0.5 || !GPU) return;
      if (this.dirtyGeometry) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.roofBuf);
        gl.bufferData(gl.ARRAY_BUFFER, r.roofs, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.wallBuf);
        gl.bufferData(gl.ARRAY_BUFFER, r.walls, gl.STATIC_DRAW);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.wallNrmBuf);
        gl.bufferData(gl.ARRAY_BUFFER, r.wallNormals, gl.STATIC_DRAW);
        if (r.f.bytes && r.c.bytes) {
          upload(gl, this.dsm, r.f.W, r.f.H, r.f.bytes);
          upload(gl, this.ter, r.c.W, r.c.H, r.c.bytes);
        }
        r.layerDone = true;
        releaseBytes(r);
        this.geomFor = r;
        this.dirtyGeometry = false;
      }
      if (this.dirtyTextures) {
        upload(gl, this.roofTex, 0, 0, null, GPU.roofCanvas);
        this.dirtyTextures = false;
      }

      // Model pixels (x east, y south, z = metres above sea) -> clip space. MapLibre's
      // custom-layer matrix works in Mercator units and leaves out the terrain lift, so
      // the centre elevation is taken off here, as MapLibre does for its own layers.
      var tr = map.transform;
      var lat = map.getCenter().lat;
      var zs = 1 / metresPerUnit(lat);
      var elev = tr.elevation || 0;
      var m = matrix, P = r.f.pm, out = new Float32Array(16);
      for (var i = 0; i < 4; i++) {
        out[i] = m[i] * P;
        out[4 + i] = m[4 + i] * P;
        out[8 + i] = m[8 + i] * zs;
        out[12 + i] = m[i] * r.f.x0 + m[4 + i] * r.f.y0 + m[8 + i] * (-elev * zs) + m[12 + i];
      }

      var p = this.prog;
      gl.useProgram(p);
      commonUniforms(gl, p, r);
      gl.uniformMatrix4fv(p.u.u_matrix, false, out);
      gl.uniform1i(p.u.u_roof, 2);
      var col = hexRgb(scfg.color);
      gl.uniform3f(p.u.u_color, col[0], col[1], col[2]);
      gl.uniform1f(p.u.u_alpha, scfg.buildingOpacity * state.strength);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.dsm);
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.ter);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.roofTex);

      // Drawn over MapLibre's own roofs/walls (depth-tested against them, so hidden
      // parts stay hidden), each pixel shaded once even where two tile pieces of a
      // building overlap.
      gl.enable(gl.DEPTH_TEST);
      gl.depthFunc(gl.LEQUAL);
      gl.depthMask(false);
      gl.enable(gl.POLYGON_OFFSET_FILL);
      gl.polygonOffset(-1, -4);
      gl.disable(gl.CULL_FACE);
      gl.enable(gl.STENCIL_TEST);
      gl.stencilMask(0xff);
      gl.clearStencil(0);
      gl.clear(gl.STENCIL_BUFFER_BIT);
      gl.stencilFunc(gl.EQUAL, 0, 0xff);
      gl.stencilOp(gl.KEEP, gl.KEEP, gl.INCR);

      var aPos = gl.getAttribLocation(p, 'a_pos'), aNrm = gl.getAttribLocation(p, 'a_nrm');
      gl.enableVertexAttribArray(aPos);
      gl.disableVertexAttribArray(aNrm);
      gl.vertexAttrib3f(aNrm, 0, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.roofBuf);
      gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, r.roofs.length / 3);

      if (state.walls3d && r.walls.length) {
        gl.bindBuffer(gl.ARRAY_BUFFER, this.wallBuf);
        gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aNrm);
        gl.bindBuffer(gl.ARRAY_BUFFER, this.wallNrmBuf);
        gl.vertexAttribPointer(aNrm, 3, gl.FLOAT, false, 0, 0);
        gl.drawArrays(gl.TRIANGLES, 0, r.walls.length / 3);
        gl.disableVertexAttribArray(aNrm);
      }
      gl.disableVertexAttribArray(aPos);
      gl.disable(gl.STENCIL_TEST);
      gl.disable(gl.POLYGON_OFFSET_FILL);
      gl.depthMask(true);
      gl.bindBuffer(gl.ARRAY_BUFFER, null);
      try { map.painter.currentStencilSource = undefined; } catch (e) { /* internal */ }
    }
  };

  // ---------- Scheduling ----------
  var state = { enabled: false, playing: false, walls3d: false, alt: -90, az: 0, strength: 1, sunVec: [0, -1], tanAlt: 1 };
  var dirty = true, timer = null, last = 0, started = false;

  function refresh() {
    if (building) { buildAgain = true; return; }
    if (!state.enabled) return;
    building = true;
    buildRegion().then(function (r) {
      if (r) { region = r; recompute(true); }
    }).catch(function (e) {
      // Outdated by a newer move: the next idle map builds the new view.
      if (e !== STALE) console.warn('[3D] Shadow map failed', e);
    }).then(function () {
      building = false;
      if (buildAgain) { buildAgain = false; refresh(); }
    });
  }

  function recompute(now) {
    if (timer) return;
    // Up to ~5 updates a second while the sun is moved by hand, ~3 while it plays,
    // fewer on a device that needs longer to compute one.
    var gap = Math.max(state.playing ? (scfg.playGapMs || 300) : 180, 3 * (ns.shadows.lastMs || 0));
    var wait = now ? 0 : Math.max(0, gap - (performance.now() - last));
    timer = setTimeout(function () {
      timer = null;
      last = performance.now();
      if (!region || !state.enabled || state.alt <= 0.5) { applyOpacity(); return; }
      try {
        var t0 = performance.now();
        if (computeShadows()) showOnMap();
        ns.shadows.lastMs = Math.round(performance.now() - t0);
      } catch (e) {
        console.warn('[3D] Shadows off:', e);
        state.enabled = false;
        applyOpacity();
      }
    }, wait);
  }

  function start() {
    var map = ns.map;
    if (started || !map || !ns.dem) return;
    started = true;
    map.on('moveend', function () { dirty = true; });
    // A new move makes a build in progress outdated - stop it rather than finish it.
    map.on('movestart', function () { if (currentJob) currentJob.stale = true; });
    map.on('sourcedata', function (e) {
      if (e.sourceId === 'buildings' && e.isSourceLoaded && e.sourceDataType !== 'metadata') dirty = true;
    });
    // The trees in view changed (they are modelled too).
    document.addEventListener('athens3d:trees', function () { dirty = true; });
    map.on('idle', function () {
      if (!dirty || !state.enabled) return;
      dirty = false;
      refresh();
    });
    dirty = true;
    map.triggerRepaint();
  }

  // The height-model building blocks, for the route shade tool (code_3D/route-shade.js).
  ns.shadowsCore = {
    mx: mx, my: my, lngOf: lngOf, latOf: latOf, metresPerUnit: metresPerUnit,
    Dem: Dem, demZoom: demZoom, fillPolygon: fillPolygon, polygonsOf: polygonsOf,
    centroidOf: centroidOf, sliced: sliced, STALE: STALE
  };

  ns.shadows = {
    start: start,
    // pos: { azimuth, altitude } in degrees; strength 0..1 (fades with the sun).
    setSun: function (pos, strength) {
      state.alt = pos.altitude;
      state.az = pos.azimuth;
      state.strength = strength;
      var a = pos.azimuth * Math.PI / 180;
      state.sunVec = [Math.sin(a), -Math.cos(a)];   // toward the sun: x east, y south
      state.tanAlt = Math.tan(Math.max(pos.altitude, 1.5) * Math.PI / 180);
      applyOpacity();
      recompute(false);
    },
    // The sun is playing (true) or paused (false): the model is rebuilt at the matching
    // resolution, unless the current one is already that size.
    setPlaying: function (on) {
      if (state.playing === on) return;
      state.playing = on;
      var q = quality();
      if (!started || !state.enabled || (region && region.q.fine === q.fine && region.q.coarse === q.coarse)) return;
      refresh();
    },
    setEnabled: function (on) {
      var was = state.enabled;
      if (was === on) return;   // also keeps the start-up call (off) from touching a style still loading
      state.enabled = on;
      if (on && !was) { dirty = true; refresh(); }
      if (!on) {
        // Nothing is drawn any more: stop a build in progress and let go of the model
        // (it is built again when the shadows come back).
        if (currentJob) currentJob.stale = true;
        region = null;
        if (GPU) GPU.uploaded = null;
        layer3d.geomFor = null;
      }
      applyOpacity();
    },
    set3D: function (on) {
      state.walls3d = on;
      // The wall geometry is only built when wanted: build it now if it isn't there.
      if (on && started && state.enabled && region && region.buildingsOn && !region.hasWalls) refresh();
      if (ns.map) ns.map.triggerRepaint();
    }
  };
})();
