// Route shade: the user draws a route along the streets (click to add points,
// double-click to finish, ESC cancels) and gets a chart of how much of it is in the
// shade - and how much in the sun - through the day shown in the sun panel.
//
// Shade is cast by the buildings, the trees and the hills, tested the way the map's
// shadows are (code_3D/shadows.js): every few metres along the route, a look toward
// the sun over a height model of the area around it. Below the horizon counts as shade.
//
// The route is coloured on the map for the time shown (sun / shade). The chart follows
// the sun panel: another date recomputes it, and a click on the chart sets the time.
(function () {
  var ns = window.Athens3D = window.Athens3D || {};
  var map = ns.map, core = ns.shadowsCore, sun = ns.sun;
  if (!map || !core || !sun) return;
  var cfg = ns.config, rc = cfg.routeShade;

  var SRC = 'route-shade-src', SRC_DRAW = 'route-shade-draw', SRC_HOVER = 'route-shade-hover';
  var FINISH_PX = 10;   // clicking this close to the last point finishes the route

  function $(id) { return document.getElementById(id); }
  var btn = $('routeShadeBtn'), promptModal = $('routeMsgModal'), promptOk = $('routeMsgOk');
  var panel = $('route-panel'), chart = $('route-chart'), closeBtn = $('route-close');
  var dlBtn = $('route-download'), csvBtn = $('route-csv'), heatBtn = $('route-heat-btn');
  // The exports (and the sun map) need a finished chart.
  function setExports(on) { dlBtn.disabled = csvBtn.disabled = heatBtn.disabled = !on; }
  var subEl = $('route-sub'), readout = $('route-readout'), summary = $('route-summary');
  var elevWrap = $('route-elev-wrap'), elevChart = $('route-elev'), elevSub = $('route-elev-sub'), elevReadout = $('route-elev-readout');
  var noteEl = $('route-note');
  var sunWrap = $('route-sun-wrap'), sunChart = $('route-sun'), sunSub = $('route-sun-sub'), sunReadout = $('route-sun-readout');

  var mode = 'idle';    // idle | prompt | drawing | result
  var points = [], cursor = null;
  var route = null;     // { R, model, series, job }
  // Clicks on the map belong to this tool while it is drawing (see building-info.js).
  (ns.drawingTools = ns.drawingTools || []).push(function () { return mode === 'drawing'; });

  // ---------- Map layers ----------
  function empty() { return { type: 'FeatureCollection', features: [] }; }
  function ensureLayers() {
    if (map.getSource(SRC)) return;
    map.addSource(SRC, { type: 'geojson', data: empty() });
    map.addSource(SRC_DRAW, { type: 'geojson', data: empty() });
    map.addSource(SRC_HOVER, { type: 'geojson', data: empty() });
    map.addLayer({ id: 'route-shade-casing', type: 'line', source: SRC,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.9 } });
    map.addLayer({ id: 'route-shade-line', type: 'line', source: SRC,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-width': 5,
        'line-color': ['match', ['get', 's'], 0, rc.sunColor, 1, rc.shadeColor, rc.nightColor] } });
    map.addLayer({ id: 'route-shade-rubber', type: 'line', source: SRC_DRAW,
      filter: ['all', ['==', ['geometry-type'], 'LineString'], ['==', ['get', 'rubber'], true]],
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': '#6b7280', 'line-width': 2, 'line-dasharray': [2, 2] } });
    map.addLayer({ id: 'route-shade-draw-line', type: 'line', source: SRC_DRAW,
      filter: ['all', ['==', ['geometry-type'], 'LineString'], ['!=', ['get', 'rubber'], true]],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': rc.shadeColor, 'line-width': 3 } });
    map.addLayer({ id: 'route-shade-vertices', type: 'circle', source: SRC_DRAW,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: { 'circle-radius': 4.5, 'circle-color': '#ffffff', 'circle-stroke-color': rc.shadeColor,
        'circle-stroke-width': 1.5, 'circle-pitch-alignment': 'viewport' } });
    // The spot of the route under the pointer on the elevation chart.
    map.addLayer({ id: 'route-shade-hover', type: 'circle', source: SRC_HOVER,
      paint: { 'circle-radius': 6, 'circle-color': '#ffffff', 'circle-stroke-color': '#c0392b',
        'circle-stroke-width': 2.5, 'circle-pitch-alignment': 'viewport' } });
  }

  function showHoverSpot(lon, lat) {
    var src = map.getSource(SRC_HOVER);
    if (!src) return;
    src.setData(lon == null ? empty() : { type: 'FeatureCollection', features: [
      { type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: [lon, lat] } }] });
  }

  function redrawDrawing() {
    var src = map.getSource(SRC_DRAW);
    if (!src) return;
    var fc = empty();
    if (mode === 'drawing') {
      if (points.length >= 2) fc.features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points.slice() } });
      if (points.length && cursor) fc.features.push({ type: 'Feature', properties: { rubber: true }, geometry: { type: 'LineString', coordinates: [points[points.length - 1], cursor] } });
      points.forEach(function (p) { fc.features.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } }); });
    }
    src.setData(fc);
  }

  // ---------- Route geometry ----------
  function haversine(a, b) {
    var R = 6371008.8, toRad = Math.PI / 180;
    var dLat = (b[1] - a[1]) * toRad, dLon = (b[0] - a[0]) * toRad;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  // The route with its running length, cut into n equal pieces - one test point each.
  function prepareRoute(coords) {
    var cum = [0];
    for (var i = 1; i < coords.length; i++) cum.push(cum[i - 1] + haversine(coords[i - 1], coords[i]));
    var total = cum[cum.length - 1];
    var n = Math.max(1, Math.min(rc.maxSamples, Math.ceil(total / rc.spacing)));
    return { coords: coords, cum: cum, total: total, n: n, step: total / n };
  }
  function pointAt(R, d) {
    var c = R.coords, cum = R.cum, i = 1;
    while (i < cum.length - 1 && cum[i] < d) i++;
    var seg = cum[i] - cum[i - 1], f = seg > 0 ? (d - cum[i - 1]) / seg : 0;
    return [c[i - 1][0] + (c[i][0] - c[i - 1][0]) * f, c[i - 1][1] + (c[i][1] - c[i - 1][1]) * f];
  }
  // The part of the route between two distances along it.
  function piece(R, d0, d1) {
    var out = [pointAt(R, d0)];
    for (var i = 1; i < R.cum.length - 1; i++) if (R.cum[i] > d0 && R.cum[i] < d1) out.push(R.coords[i]);
    out.push(pointAt(R, d1));
    return out;
  }

  // The streets around the route, from the basemap's vector tiles. Read when the route is
  // drawn (what is loaded then), for the plan of the route in the sun map's download.
  function readStreets(R) {
    var style = map.getStyle(), layer = style && (style.layers || []).filter(function (l) { return l['source-layer'] === 'roads'; })[0];
    if (!layer) return [];
    var lo0 = Infinity, lo1 = -Infinity, la0 = Infinity, la1 = -Infinity;
    R.coords.forEach(function (c) { lo0 = Math.min(lo0, c[0]); lo1 = Math.max(lo1, c[0]); la0 = Math.min(la0, c[1]); la1 = Math.max(la1, c[1]); });
    // A margin wide enough for the plan's frame, which is wider than it is tall.
    var cosLat = Math.cos((la0 + la1) / 2 * Math.PI / 180), span = Math.max((lo1 - lo0) * cosLat, la1 - la0);
    var m = span * 1.6 + 0.003, mLon = m / cosLat;
    var out = [];
    map.querySourceFeatures(layer.source, { sourceLayer: 'roads' }).forEach(function (f) {
      var g = f.geometry, p = f.properties || {};
      if (p.kind === 'rail') return;
      var lines = g.type === 'LineString' ? [g.coordinates] : g.type === 'MultiLineString' ? g.coordinates : null;
      if (!lines) return;
      lines.forEach(function (ln) {
        var near = ln.some(function (c) { return c[0] >= lo0 - mLon && c[0] <= lo1 + mLon && c[1] >= la0 - m && c[1] <= la1 + m; });
        if (near) out.push({ c: ln, k: p.kind === 'path' ? 'path' : String(p.kind_detail || p.kind).replace(/_link$/, ''), tunnel: !!p.is_tunnel });
      });
    });
    return out;
  }

  // ---------- Height model around the route ----------
  // A fine model (terrain + buildings + tree crowns) for the route plus a margin, and a
  // coarse terrain-only one over a much wider area for the hills.
  var FLAT = { at: function () { return 0; }, load: function () { return Promise.resolve(); } };

  function buildModel(R, job) {
    var S = [], i;
    for (i = 0; i < R.n; i++) {
      var ll = pointAt(R, (i + 0.5) * R.step);
      S.push({ x: core.mx(ll[0]), y: core.my(ll[1]), lon: ll[0], lat: ll[1], d: (i + 0.5) * R.step });
    }
    var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    S.forEach(function (s) { x0 = Math.min(x0, s.x); x1 = Math.max(x1, s.x); y0 = Math.min(y0, s.y); y1 = Math.max(y1, s.y); });
    var mpu = core.metresPerUnit(core.latOf((y0 + y1) / 2));

    var m = rc.margin / mpu, fw = x1 - x0 + 2 * m, fh = y1 - y0 + 2 * m;
    var F = { x0: x0 - m, y0: y0 - m, pm: Math.max(rc.pixel / mpu, Math.max(fw, fh) / rc.maxSize) };
    F.W = Math.max(3, Math.ceil(fw / F.pm)); F.H = Math.max(3, Math.ceil(fh / F.pm)); F.mpp = F.pm * mpu;

    var hm = rc.hillMargin / mpu, cw = x1 - x0 + 2 * hm, chh = y1 - y0 + 2 * hm;
    var C = { x0: x0 - hm, y0: y0 - hm, pm: Math.max(rc.hillPixel / mpu, Math.max(cw, chh) / rc.hillMaxSize) };
    C.W = Math.max(3, Math.ceil(cw / C.pm)); C.H = Math.max(3, Math.ceil(chh / C.pm)); C.mpp = C.pm * mpu;

    var d = ns.dem;
    var demF = d ? new core.Dem(Math.max(d.minzoom || 0, Math.min(d.maxzoom, Math.floor(map.getZoom()) - 1))) : FLAT;
    var demC = d ? new core.Dem(core.demZoom(Math.log2(mpu / (256 * C.mpp)))) : FLAT;

    // Read the map now: what is loaded around the route at the moment of drawing.
    var src = ns.buildings ? map.querySourceFeatures('buildings', { sourceLayer: ns.buildings.sourceLayer }) : [];
    var trees = ((ns.trees && ns.trees.list) || []).slice();

    var W = F.W, H = F.H, Q = 4, Wq = Math.ceil(W / Q) + 2, Hq = Math.ceil(H / Q) + 2;
    var tq = new Float32Array(Wq * Hq), h = new Float32Array(W * H), roof = new Uint8Array(W * H);
    C.h = new Float32Array(C.W * C.H);
    function toPx(p) { return [(core.mx(p[0]) - F.x0) / F.pm, (core.my(p[1]) - F.y0) / F.pm]; }
    function inF(x, y) { return x >= F.x0 && y >= F.y0 && x <= F.x0 + W * F.pm && y <= F.y0 + H * F.pm; }

    return Promise.all([
      demF.load(F.x0, F.y0, F.x0 + W * F.pm, F.y0 + H * F.pm),
      demC.load(C.x0, C.y0, C.x0 + C.W * C.pm, C.y0 + C.H * C.pm)
    ]).then(function () {
      // Terrain on a 4x coarser grid, then stretched (as the map's shadows do).
      return core.sliced(Hq, function (j) {
        for (var i = 0; i < Wq; i++) tq[j * Wq + i] = demF.at(F.x0 + i * Q * F.pm, F.y0 + j * Q * F.pm);
      }, job);
    }).then(function () {
      return core.sliced(H, function (j) {
        var gy = (j + 0.5) / Q, iy = Math.floor(gy), fy = gy - iy;
        for (var i = 0; i < W; i++) {
          var gx = (i + 0.5) / Q, ix = Math.floor(gx), fx = gx - ix, o = iy * Wq + ix;
          h[j * W + i] = (tq[o] * (1 - fx) + tq[o + 1] * fx) * (1 - fy) + (tq[o + Wq] * (1 - fx) + tq[o + Wq + 1] * fx) * fy;
        }
      }, job);
    }).then(function () {
      tq = null;
      return core.sliced(src.length, function (s) {
        var hb = ns.buildingHeight(src[s].properties), polys = core.polygonsOf(src[s].geometry);
        for (var p = 0; p < polys.length; p++) {
          if (!polys[p][0] || polys[p][0].length < 4) continue;
          var c = core.centroidOf(polys[p]);
          if (!c || !inF(c[0], c[1])) continue;
          core.fillPolygon(h, roof, W, H, polys[p].map(function (rg) { return rg.map(toPx); }), demF.at(c[0], c[1]) + hb);
        }
      }, job);
    }).then(function () {
      src = null;
      // Tree crowns' top surface (the same shapes as the map's 3D trees).
      return core.sliced(trees.length, function (n) {
        var tr = trees[n], x = core.mx(tr.lon), y = core.my(tr.lat);
        if (!tr.r || !inF(x, y)) return;
        var E = demF.at(x, y), cx = (x - F.x0) / F.pm, cy = (y - F.y0) / F.pm, rp = Math.max(tr.r / F.mpp, 0.7);
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
      var maxH = -1e9;
      for (var k = 0; k < h.length; k++) if (h[k] > maxH) maxH = h[k];
      // A point drawn a little off the street, inside a building, moves to the
      // nearest open ground (up to 4 m away) - not onto the roof.
      var reach = Math.max(1, Math.ceil(4 / F.mpp));
      S.forEach(function (s) {
        var px = (s.x - F.x0) / F.pm, py = (s.y - F.y0) / F.pm, ix = Math.floor(px), iy = Math.floor(py);
        if (roof[iy * W + ix] === 1) {
          var best = Infinity, bx = ix, by = iy;
          for (var dy = -reach; dy <= reach; dy++) for (var dx = -reach; dx <= reach; dx++) {
            var qx = ix + dx, qy = iy + dy, dd = dx * dx + dy * dy;
            if (qx < 0 || qy < 0 || qx >= W || qy >= H || dd >= best || roof[qy * W + qx] === 1) continue;
            best = dd; bx = qx; by = qy;
          }
          if (best < Infinity) { px = bx + 0.5; py = by + 0.5; }
        }
        s.px = px; s.py = py;
        s.z = demF.at(F.x0 + px * F.pm, F.y0 + py * F.pm) + rc.eyeHeight;
        s.cx = (F.x0 + px * F.pm - C.x0) / C.pm;
        s.cy = (F.y0 + py * F.pm - C.y0) / C.pm;
      });
      roof = null;
      F.maxH = maxH;
      return core.sliced(C.H, function (j) {
        for (var i = 0; i < C.W; i++) C.h[j * C.W + i] = demC.at(C.x0 + (i + 0.5) * C.pm, C.y0 + (j + 0.5) * C.pm);
      }, job);
    }).then(function () {
      var maxHC = -1e9;
      for (var k = 0; k < C.h.length; k++) if (C.h[k] > maxHC) maxHC = C.h[k];
      C.maxH = maxHC;
      return { F: F, h: h, C: C, S: S };
    });
  }

  // ---------- Shade test ----------
  // From the point toward the sun: anything higher than the line of sight shades it -
  // first over the fine model (buildings, trees, near ground), then over the hills.
  function shaded(M, s, sx, sy, tanAlt) {
    var F = M.F, W = F.W, H = F.H, h = M.h, k = F.mpp * tanAlt, z = s.z, d, qx, qy, rz;
    for (d = 1; ; d += Math.max(1, d * 0.012)) {
      qx = s.px + sx * d; qy = s.py + sy * d;
      if (qx < 0 || qy < 0 || qx >= W || qy >= H) break;
      rz = z + d * k;
      if (rz > F.maxH) break;
      if (h[Math.floor(qy) * W + Math.floor(qx)] > rz + 0.3) return true;
    }
    var C = M.C, CW = C.W, CH = C.H, ch = C.h;
    k = C.mpp * tanAlt;
    var ci = Math.floor(s.cx), cj = Math.floor(s.cy);
    if (ci >= 0 && cj >= 0 && ci < CW && cj < CH) z = Math.max(z, ch[cj * CW + ci]);
    for (d = 1.5; ; d += Math.max(1, d * 0.03)) {
      qx = s.cx + sx * d; qy = s.cy + sy * d;
      if (qx < 0 || qy < 0 || qx >= CW || qy >= CH) return false;
      rz = z + d * k;
      if (rz > C.maxH) return false;
      if (ch[Math.floor(qy) * CW + Math.floor(qx)] > rz + 3) return true;
    }
  }

  function sunAt(ms) {
    var p = sun.position(ms), a = p.azimuth * Math.PI / 180;
    return { up: p.altitude > 0, sx: Math.sin(a), sy: -Math.cos(a), tanAlt: Math.tan(Math.max(p.altitude, 0.01) * Math.PI / 180) };
  }

  // Each point at one time: 0 sun, 1 shade, 2 sun below the horizon.
  function statesAt(M, ms) {
    var S = M.S, out = new Uint8Array(S.length), v = sunAt(ms);
    if (!v.up) { out.fill(2); return out; }
    for (var i = 0; i < S.length; i++) out[i] = shaded(M, S[i], v.sx, v.sy, v.tanAlt) ? 1 : 0;
    return out;
  }

  // The share of the route in shade at every chart step from sunrise to sunset, and for
  // every point along the route the share of the daylight it spends in sun.
  function daySeries(M, ms, job) {
    var day = sun.day(ms);
    if (!day) return Promise.reject(new Error('No sunrise/sunset'));
    var step = rc.stepMinutes * 60000, times = [day.sunrise];
    for (var t = Math.ceil(day.sunrise / step) * step; t < day.sunset; t += step) if (t > day.sunrise) times.push(t);
    times.push(day.sunset);
    var nS = M.S.length, vecs = times.map(sunAt), counts = new Float64Array(times.length);
    // Each step stands for the time halfway to its neighbours.
    var nT = times.length, wt = [], sunMs = new Float64Array(nS), lit = new Uint8Array(nT * nS), i;
    for (i = 0; i < nT; i++) wt.push(((times[Math.min(nT - 1, i + 1)] - times[Math.max(0, i - 1)]) / 2));
    // One (time, point) pair per call, so the slices stay short even on a long route.
    return core.sliced(nT * nS, function (idx) {
      var ti = Math.floor(idx / nS), pt = idx % nS, v = vecs[ti];
      if (pt === 0) showProgress(ti / nT);
      if (!v.up || shaded(M, M.S[pt], v.sx, v.sy, v.tanAlt)) counts[ti]++;
      else { sunMs[pt] += wt[ti]; lit[idx] = 1; }
    }, job).then(function () {
      var shade = [], dayMs = times[nT - 1] - times[0], along = { d: [], lon: [], lat: [], sun: [], hours: [], daylight: dayMs / 36e5 };
      for (i = 0; i < nT; i++) shade.push(counts[i] / nS);
      for (i = 0; i < nS; i++) {
        along.d.push(M.S[i].d); along.lon.push(M.S[i].lon); along.lat.push(M.S[i].lat);
        along.sun.push(Math.min(1, sunMs[i] / dayMs)); along.hours.push(sunMs[i] / 36e5);
      }
      // lit[ti * nS + pt]: 1 when point pt is in sun at times[ti]
      return { times: times, shade: shade, along: along, lit: lit, date: sun.dateLabel(ms) };
    });
  }

  // ---------- Panel ----------
  function pct(f) { return Math.round(f * 100) + '%'; }
  function km(m) { return m >= 1000 ? (m / 1000).toFixed(2) + ' km' : Math.round(m) + ' m'; }

  function showProgress(f) {
    if (summary) summary.textContent = 'Calculating… ' + Math.round(f * 100) + '%';
  }

  var CW = 400, CH = 170, PL = 36, PR = 10, PT = 12, PB = 24, PW = CW - PL - PR, PH = CH - PT - PB;
  function tRange() { var t = route.series.times; return [t[0], t[t.length - 1]]; }
  function X(t) { var r = tRange(); return PL + (t - r[0]) / (r[1] - r[0]) * PW; }
  function Y(f) { return PT + (1 - f) * PH; }

  function drawChart() {
    var s = route.series, r = tRange(), parts = [];
    parts.push('<rect x="' + PL + '" y="' + PT + '" width="' + PW + '" height="' + PH + '" fill="' + rc.sunColor + '" opacity="0.55"/>');
    var d = 'M' + X(r[0]).toFixed(1) + ',' + Y(0).toFixed(1);
    for (var i = 0; i < s.times.length; i++) d += ' L' + X(s.times[i]).toFixed(1) + ',' + Y(s.shade[i]).toFixed(1);
    d += ' L' + X(r[1]).toFixed(1) + ',' + Y(0).toFixed(1) + ' Z';
    parts.push('<path d="' + d + '" fill="' + rc.shadeColor + '" opacity="0.88"/>');
    [0, 0.5, 1].forEach(function (f) {
      parts.push('<line class="rc-grid" x1="' + PL + '" x2="' + (PL + PW) + '" y1="' + Y(f) + '" y2="' + Y(f) + '"/>');
      parts.push('<text class="rc-label" x="' + (PL - 5) + '" y="' + (Y(f) + 3.5) + '" text-anchor="end">' + pct(f) + '</text>');
    });
    // Whole hours (Athens is a whole number of hours off UTC), labelled every 2 h.
    var hour = 36e5, every = (r[1] - r[0]) > 10 * hour ? 2 : 1;
    for (var t = Math.ceil(r[0] / hour) * hour; t <= r[1]; t += hour) {
      var x = X(t).toFixed(1), label = sun.hhmm(t);
      parts.push('<line class="rc-tick" x1="' + x + '" x2="' + x + '" y1="' + (PT + PH) + '" y2="' + (PT + PH + 4) + '"/>');
      if (parseInt(label, 10) % every === 0) parts.push('<text class="rc-label" x="' + x + '" y="' + (CH - 6) + '" text-anchor="middle">' + label + '</text>');
    }
    parts.push('<g id="route-now"></g><g id="route-hover"></g>');
    chart.innerHTML = parts.join('');
  }

  function marker(id, t, cls) {
    var g = chart.querySelector('#' + id);
    if (!g || !route || !route.series) return;
    var r = tRange();
    if (t == null || t < r[0] || t > r[1]) { g.innerHTML = ''; return; }
    var x = X(t).toFixed(1);
    g.innerHTML = '<line class="' + cls + '" x1="' + x + '" x2="' + x + '" y1="' + PT + '" y2="' + (PT + PH) + '"/>';
  }

  function shadeAtTime(t) {
    var s = route.series, i = 1;
    while (i < s.times.length - 1 && s.times[i] < t) i++;
    var t0 = s.times[i - 1], t1 = s.times[i], f = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 0;
    return s.shade[i - 1] + (s.shade[i] - s.shade[i - 1]) * f;
  }

  function writeSummary() {
    var s = route.series, sum = 0, maxI = 0, minI = 0;
    // Every step but the two ends (sunrise/sunset, always shade) weighs the same.
    var inner = s.shade.slice(1, -1);
    if (!inner.length) inner = s.shade;
    for (var i = 0; i < inner.length; i++) {
      sum += inner[i];
      if (inner[i] > inner[maxI]) maxI = i;
      if (inner[i] < inner[minI]) minI = i;
    }
    var off = inner === s.shade ? 0 : 1, avg = sum / inner.length;
    summary.textContent = 'Through the day: ' + pct(avg) + ' in shade, ' + pct(1 - avg) + ' in sun. ' +
      'Shadiest ' + sun.hhmm(s.times[maxI + off]) + ' (' + pct(inner[maxI]) + '), sunniest ' +
      sun.hhmm(s.times[minI + off]) + ' (' + pct(1 - inner[minI]) + ' in sun).';
  }

  var hovering = false;
  // The route on the map and the readout, for the time shown in the sun panel.
  function showTime(ms) {
    if (!route || !route.model) return;
    var M = route.model, R = route.R, st = statesAt(M, ms), feats = [], n = st.length, i = 0, shade = 0;
    while (i < n) {
      var j = i;
      while (j + 1 < n && st[j + 1] === st[i]) j++;
      feats.push({ type: 'Feature', properties: { s: st[i] }, geometry: { type: 'LineString', coordinates: piece(R, i * R.step, (j + 1) * R.step) } });
      if (st[i] !== 0) shade += j - i + 1;
      i = j + 1;
    }
    var src = map.getSource(SRC);
    if (src) src.setData({ type: 'FeatureCollection', features: feats });
    if (!route.series) return;
    marker('route-now', ms, 'rc-now');
    drawHeat();
    if (!hovering) {
      readout.textContent = st[0] === 2 ? sun.hhmm(ms) + ' (on the map): the sun is below the horizon'
        : sun.hhmm(ms) + ' (on the map): ' + pct(shade / n) + ' in shade, ' + pct(1 - shade / n) + ' in sun';
    }
  }

  // ---------- Elevation profile ----------
  // Ground height at every test point (the terrain model the shade is tested over,
  // without the walking height), with the total ascent/descent from a smoothed copy:
  // the terrain model is steppy at this scale, and adding up every step would
  // overstate both.
  function elevationProfile(M, R) {
    if (!ns.dem) return null;
    var ex = ns.dem.exaggeration || 1, S = M.S, n = S.length, z = [], i;
    for (i = 0; i < n; i++) z.push((S[i].z - rc.eyeHeight) / ex);
    var k = Math.max(1, Math.round((rc.elevSmooth || 30) / 2 / R.step)), sm = [];
    for (i = 0; i < n; i++) {
      var a = Math.max(0, i - k), b = Math.min(n - 1, i + k), t = 0;
      for (var j = a; j <= b; j++) t += z[j];
      sm.push(t / (b - a + 1));
    }
    var up = 0, down = 0, lo = Infinity, hi = -Infinity;
    for (i = 1; i < n; i++) { var dz = sm[i] - sm[i - 1]; if (dz > 0) up += dz; else down -= dz; }
    for (i = 0; i < n; i++) { if (z[i] < lo) lo = z[i]; if (z[i] > hi) hi = z[i]; }
    return { d: S.map(function (s) { return s.d; }), lon: S.map(function (s) { return s.lon; }), lat: S.map(function (s) { return s.lat; }),
      z: z, ascent: up, descent: down, min: lo, max: hi, total: R.total };
  }

  function niceStep(span, target) {
    var raw = span / target, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
  }
  function fmtDist(m, step) { return step >= 1000 || m >= 1000 ? (m / 1000).toFixed(step < 100 ? 2 : 1) + ' km' : Math.round(m) + ' m'; }
  function elevText(e) {
    return 'Elevation ' + Math.round(e.min) + '–' + Math.round(e.max) + ' m · ascent ' + Math.round(e.ascent) + ' m · descent ' + Math.round(e.descent) + ' m';
  }

  // Shared by the panel and the downloaded image: axis ticks for an elevation profile.
  function elevAxes(e) {
    var span = Math.max(e.max - e.min, 10), mid = (e.max + e.min) / 2;
    var ys = niceStep(span, 3), y0 = Math.floor((mid - span * 0.55) / ys) * ys, y1 = Math.ceil((mid + span * 0.55) / ys) * ys;
    var xs = niceStep(e.total, 4);
    return { y0: y0, y1: y1, ys: ys, xs: xs };
  }

  var EW = 400, EH = 120, EL = 36, ER = 10, ET = 8, EB = 22, EPW = EW - EL - ER, EPH = EH - ET - EB, eAx = null;
  function eX(d) { return EL + d / route.elev.total * EPW; }
  function eY(z) { return ET + (1 - (z - eAx.y0) / (eAx.y1 - eAx.y0)) * EPH; }

  function drawElevation() {
    var e = route && route.elev;
    elevWrap.hidden = !e;
    if (!e) return;
    eAx = elevAxes(e);
    var parts = [], i, t;
    for (t = eAx.y0; t <= eAx.y1 + 1e-6; t += eAx.ys) {
      parts.push('<line class="rc-grid" x1="' + EL + '" x2="' + (EL + EPW) + '" y1="' + eY(t).toFixed(1) + '" y2="' + eY(t).toFixed(1) + '"/>');
      parts.push('<text class="rc-label" x="' + (EL - 5) + '" y="' + (eY(t) + 3.5).toFixed(1) + '" text-anchor="end">' + Math.round(t) + ' m</text>');
    }
    var line = '';
    for (i = 0; i < e.d.length; i++) line += (i ? ' L' : 'M') + eX(e.d[i]).toFixed(1) + ',' + eY(e.z[i]).toFixed(1);
    parts.push('<path class="rc-elev-area" d="' + line + ' L' + eX(e.d[e.d.length - 1]).toFixed(1) + ',' + (ET + EPH) + ' L' + eX(e.d[0]).toFixed(1) + ',' + (ET + EPH) + ' Z"/>');
    parts.push('<path class="rc-elev-line" d="' + line + '"/>');
    for (t = 0; t <= e.total + 1e-6; t += eAx.xs) {
      var x = eX(t).toFixed(1);
      parts.push('<line class="rc-tick" x1="' + x + '" x2="' + x + '" y1="' + (ET + EPH) + '" y2="' + (ET + EPH + 4) + '"/>');
      parts.push('<text class="rc-label" x="' + x + '" y="' + (EH - 6) + '" text-anchor="' + (t === 0 ? 'start' : 'middle') + '">' + (t === 0 ? '0' : fmtDist(t, eAx.xs)) + '</text>');
    }
    parts.push('<g id="route-elev-hover"></g>');
    elevChart.innerHTML = parts.join('');
    elevSub.textContent = elevText(e);
    elevReadout.textContent = '';
  }

  elevChart.addEventListener('pointermove', function (ev) {
    var e = route && route.elev;
    if (!e) return;
    var box = elevChart.getBoundingClientRect(), x = (ev.clientX - box.left) / box.width * EW;
    var d = Math.min(1, Math.max(0, (x - EL) / EPW)) * e.total, i = 0, best = Infinity;
    for (var j = 0; j < e.d.length; j++) { var dd = Math.abs(e.d[j] - d); if (dd < best) { best = dd; i = j; } }
    var g = elevChart.querySelector('#route-elev-hover');
    if (g) g.innerHTML = '<line class="rc-hover" x1="' + eX(e.d[i]).toFixed(1) + '" x2="' + eX(e.d[i]).toFixed(1) + '" y1="' + ET + '" y2="' + (ET + EPH) + '"/>';
    elevReadout.textContent = fmtDist(e.d[i], 1) + ' along the route: ' + e.z[i].toFixed(1) + ' m';
    showHoverSpot(e.lon[i], e.lat[i]);
  });
  elevChart.addEventListener('pointerleave', function () {
    var g = elevChart.querySelector('#route-elev-hover');
    if (g) g.innerHTML = '';
    elevReadout.textContent = '';
    showHoverSpot(null);
  });

  // ---------- Sun along the route ----------
  // For each spot on the route, the share of the daylight (sunrise to sunset) it is in
  // sun on the date shown. Same frame as the elevation profile.
  function sX(d) { return EL + d / route.R.total * EPW; }
  function sY(f) { return ET + (1 - f) * EPH; }
  function sunAlongText(a) {
    var avg = 0;
    for (var i = 0; i < a.sun.length; i++) avg += a.sun[i];
    avg /= a.sun.length;
    return 'Sun along the route: ' + pct(avg) + ' of the daylight on average (' + (avg * a.daylight).toFixed(1) + ' of ' + a.daylight.toFixed(1) + ' h)';
  }

  function drawSunAlong() {
    var a = route && route.series && route.series.along;
    sunWrap.hidden = !a;
    if (!a) return;
    var parts = [], i, t, last = a.d.length - 1;
    parts.push('<rect x="' + EL + '" y="' + ET + '" width="' + EPW + '" height="' + EPH + '" fill="' + rc.shadeColor + '" opacity="0.88"/>');
    var line = '';
    for (i = 0; i <= last; i++) line += (i ? ' L' : 'M') + sX(a.d[i]).toFixed(1) + ',' + sY(a.sun[i]).toFixed(1);
    parts.push('<path d="' + line + ' L' + sX(a.d[last]).toFixed(1) + ',' + (ET + EPH) + ' L' + sX(a.d[0]).toFixed(1) + ',' + (ET + EPH) + ' Z" fill="' + rc.sunColor + '" opacity="0.8"/>');
    parts.push('<path class="rc-sun-line" d="' + line + '"/>');
    [0, 0.5, 1].forEach(function (f) {
      parts.push('<line class="rc-grid" x1="' + EL + '" x2="' + (EL + EPW) + '" y1="' + sY(f).toFixed(1) + '" y2="' + sY(f).toFixed(1) + '"/>');
      parts.push('<text class="rc-label" x="' + (EL - 5) + '" y="' + (sY(f) + 3.5).toFixed(1) + '" text-anchor="end">' + pct(f) + '</text>');
    });
    var xs = niceStep(route.R.total, 4);
    for (t = 0; t <= route.R.total + 1e-6; t += xs) {
      var x = sX(t).toFixed(1);
      parts.push('<line class="rc-tick" x1="' + x + '" x2="' + x + '" y1="' + (ET + EPH) + '" y2="' + (ET + EPH + 4) + '"/>');
      parts.push('<text class="rc-label" x="' + x + '" y="' + (EH - 6) + '" text-anchor="' + (t === 0 ? 'start' : 'middle') + '">' + (t === 0 ? '0' : fmtDist(t, xs)) + '</text>');
    }
    parts.push('<g id="route-sun-hover"></g>');
    sunChart.innerHTML = parts.join('');
    sunSub.textContent = sunAlongText(a);
    sunReadout.textContent = '';
  }

  sunChart.addEventListener('pointermove', function (ev) {
    var a = route && route.series && route.series.along;
    if (!a) return;
    var box = sunChart.getBoundingClientRect(), x = (ev.clientX - box.left) / box.width * EW;
    var d = Math.min(1, Math.max(0, (x - EL) / EPW)) * route.R.total, i = 0, best = Infinity;
    for (var j = 0; j < a.d.length; j++) { var dd = Math.abs(a.d[j] - d); if (dd < best) { best = dd; i = j; } }
    var g = sunChart.querySelector('#route-sun-hover');
    if (g) g.innerHTML = '<line class="rc-hover" x1="' + sX(a.d[i]).toFixed(1) + '" x2="' + sX(a.d[i]).toFixed(1) + '" y1="' + ET + '" y2="' + (ET + EPH) + '"/>';
    sunReadout.textContent = fmtDist(a.d[i], 1) + ' along the route: ' + pct(a.sun[i]) + ' of the daylight in sun (' + a.hours[i].toFixed(1) + ' h)';
    showHoverSpot(a.lon[i], a.lat[i]);
  });
  sunChart.addEventListener('pointerleave', function () {
    var g = sunChart.querySelector('#route-sun-hover');
    if (g) g.innerHTML = '';
    sunReadout.textContent = '';
    showHoverSpot(null);
  });

  // ---------- Following the sun panel ----------
  var lastMs = null, queued = false, dayTimer = null;
  document.addEventListener('athens3d:sun', function (e) {
    if (!route || !route.model) return;
    lastMs = e.detail.ms;
    if (route.series && sun.dateLabel(lastMs) !== route.series.date) {
      clearTimeout(dayTimer);
      dayTimer = setTimeout(computeDay, 350);   // a new date: a new chart (once the fields settle)
    }
    if (queued) return;
    queued = true;
    requestAnimationFrame(function () { queued = false; showTime(lastMs); });
  });

  function computeDay() {
    if (!route || !route.model) return;
    if (route.job) route.job.stale = true;
    var job = route.job = { stale: false }, ms = sun.time();
    setExports(false);
    showProgress(0);
    daySeries(route.model, ms, job).then(function (series) {
      if (job.stale) return;
      route.series = series;
      subEl.textContent = km(route.R.total) + ' · ' + series.date + ' · sunrise ' + sun.hhmm(series.times[0]) +
        ', sunset ' + sun.hhmm(series.times[series.times.length - 1]);
      drawChart();
      drawSunAlong();
      writeSummary();
      showTime(sun.time());
      setExports(true);
    }).catch(fail);
  }

  // ---------- Download ----------
  // The chart as a PNG page (header band, chart, legend, summary), in the style of the
  // map export. Drawn on a canvas from the data, not copied from the panel.
  var FONT = '"Avenir Next", Avenir, "Helvetica Neue", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  var SLATE = 'rgb(55, 65, 81)';

  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }
  function wrapLines(ctx, text, maxW) {
    var words = text.split(' '), lines = [], line = '';
    words.forEach(function (w) {
      var test = line ? line + ' ' + w : w;
      if (line && ctx.measureText(test).width > maxW) { lines.push(line); line = w; } else line = test;
    });
    if (line) lines.push(line);
    return lines;
  }

  function downloadChart() {
    if (!route || !route.series) return;
    var s = route.series, r = tRange(), W = 1000, SC = 2, PADX = 36, e = route.elev;
    loadImage('images/63.png').then(function (logo) {
      // The page is as tall as its text needs: measure the wrapped lines first.
      var HEADER = 76, cy0 = HEADER + 78, cy1 = cy0 + 300, ly = cy1 + 46, sy = ly + 40;
      var mctx = document.createElement('canvas').getContext('2d');
      mctx.font = '400 15px ' + FONT;
      var sumLines = wrapLines(mctx, summary.textContent, W - 2 * PADX);
      mctx.font = '400 12px ' + FONT;
      var noteLines = wrapLines(mctx, noteEl.textContent, W - 2 * PADX);
      var sa = s.along;
      var sy2 = sy + sumLines.length * 22 + 16;                // sun along the route block (title, chart, axis)
      var ey = sy2 + (sa ? 190 : 0);                           // elevation block (title, chart, axis)
      var ny = ey + (e ? 190 : 0) + 6;                         // note
      var H = ny + noteLines.length * 17 + 46;

      var canvas = pageCanvas(W, H, SC), ctx = canvas.getContext('2d');
      pageHeader(ctx, W, HEADER, PADX, logo, 'ROUTE SHADE');

      // What it is
      ctx.fillStyle = SLATE;
      ctx.font = '600 16px ' + FONT;
      ctx.fillText(km(route.R.total) + ' route · ' + s.date, PADX, HEADER + 30);
      ctx.font = '400 14px ' + FONT;
      ctx.fillText('Sunrise ' + sun.hhmm(r[0]) + ' · sunset ' + sun.hhmm(r[1]) + ' (Athens time) · share of the route in shade', PADX, HEADER + 54);

      // Chart
      var cx0 = 86, cx1 = W - PADX, cw = cx1 - cx0, chh = cy1 - cy0;
      function cX(t) { return cx0 + (t - r[0]) / (r[1] - r[0]) * cw; }
      function cY(f) { return cy0 + (1 - f) * chh; }
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = rc.sunColor;
      ctx.fillRect(cx0, cy0, cw, chh);
      ctx.globalAlpha = 0.88;
      ctx.fillStyle = rc.shadeColor;
      ctx.beginPath();
      ctx.moveTo(cX(r[0]), cY(0));
      for (var i = 0; i < s.times.length; i++) ctx.lineTo(cX(s.times[i]), cY(s.shade[i]));
      ctx.lineTo(cX(r[1]), cY(0));
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.font = '400 13px ' + FONT;
      ctx.fillStyle = SLATE;
      ctx.strokeStyle = 'rgba(55, 65, 81, 0.3)';
      ctx.lineWidth = 1;
      ctx.textAlign = 'right';
      [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
        ctx.beginPath(); ctx.moveTo(cx0, cY(f)); ctx.lineTo(cx1, cY(f)); ctx.stroke();
        ctx.fillText(pct(f), cx0 - 8, cY(f));
      });
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      var hour = 36e5;
      for (var t = Math.ceil(r[0] / hour) * hour; t <= r[1]; t += hour) {
        ctx.strokeStyle = 'rgba(55, 65, 81, 0.5)';
        ctx.beginPath(); ctx.moveTo(cX(t), cy1); ctx.lineTo(cX(t), cy1 + 5); ctx.stroke();
        ctx.fillText(sun.hhmm(t), cX(t), cy1 + 9);
      }
      // The time on the map when it was downloaded
      var now = sun.time();
      if (now >= r[0] && now <= r[1]) {
        ctx.strokeStyle = '#c0392b';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(cX(now), cy0); ctx.lineTo(cX(now), cy1); ctx.stroke();
      }
      ctx.strokeStyle = SLATE;
      ctx.lineWidth = 1.2;
      ctx.strokeRect(cx0, cy0, cw, chh);

      // Legend
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      var lx = cx0;
      [[rc.sunColor, 'Sun'], [rc.shadeColor, 'Shade']].forEach(function (it) {
        ctx.fillStyle = it[0];
        ctx.fillRect(lx, ly - 6, 26, 12);
        ctx.strokeStyle = 'rgba(55, 65, 81, 0.35)';
        ctx.strokeRect(lx + 0.5, ly - 5.5, 25, 11);
        ctx.fillStyle = SLATE;
        ctx.font = '400 14px ' + FONT;
        ctx.fillText(it[1], lx + 34, ly);
        lx += 34 + ctx.measureText(it[1]).width + 28;
      });
      if (now >= r[0] && now <= r[1]) {
        ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(lx, ly - 7); ctx.lineTo(lx, ly + 7); ctx.stroke();
        ctx.fillStyle = SLATE;
        ctx.fillText('Time on the map: ' + sun.hhmm(now), lx + 10, ly);
      }

      // Summary
      ctx.font = '400 15px ' + FONT;
      ctx.fillStyle = SLATE;
      sumLines.forEach(function (line, k) { ctx.fillText(line, PADX, sy + k * 22); });

      // Sun along the route
      if (sa) {
        var sx0 = cx0, sx1 = cx1, sw = sx1 - sx0, sy0 = sy2 + 34, sy1 = sy0 + 110, sh = sy1 - sy0;
        var qX = function (d) { return sx0 + d / route.R.total * sw; };
        var qY = function (f) { return sy0 + (1 - f) * sh; };
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = SLATE;
        ctx.font = '600 15px ' + FONT;
        ctx.fillText('Sun along the route', PADX, sy2 + 6);
        ctx.font = '400 13px ' + FONT;
        ctx.fillText(sunAlongText(sa).replace('Sun along the route: ', 'Share of the daylight in sun: '), PADX, sy2 + 24);
        ctx.globalAlpha = 0.88;
        ctx.fillStyle = rc.shadeColor;
        ctx.fillRect(sx0, sy0, sw, sh);
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = rc.sunColor;
        ctx.beginPath();
        ctx.moveTo(qX(sa.d[0]), sy1);
        for (var k4 = 0; k4 < sa.d.length; k4++) ctx.lineTo(qX(sa.d[k4]), qY(sa.sun[k4]));
        ctx.lineTo(qX(sa.d[sa.d.length - 1]), sy1);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.beginPath();
        for (var k5 = 0; k5 < sa.d.length; k5++) { if (k5) ctx.lineTo(qX(sa.d[k5]), qY(sa.sun[k5])); else ctx.moveTo(qX(sa.d[k5]), qY(sa.sun[k5])); }
        ctx.strokeStyle = SLATE;
        ctx.lineWidth = 1.4;
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = SLATE;
        ctx.textAlign = 'right';
        [0, 0.5, 1].forEach(function (f) {
          ctx.strokeStyle = 'rgba(55, 65, 81, 0.25)';
          ctx.beginPath(); ctx.moveTo(sx0, qY(f)); ctx.lineTo(sx1, qY(f)); ctx.stroke();
          ctx.fillText(pct(f), sx0 - 8, qY(f));
        });
        ctx.textBaseline = 'top';
        var sxs = niceStep(route.R.total, 4);
        for (var sv = 0; sv <= route.R.total + 1e-6; sv += sxs) {
          ctx.strokeStyle = 'rgba(55, 65, 81, 0.5)';
          ctx.beginPath(); ctx.moveTo(qX(sv), sy1); ctx.lineTo(qX(sv), sy1 + 5); ctx.stroke();
          ctx.textAlign = sv === 0 ? 'left' : 'center';
          ctx.fillText(sv === 0 ? '0' : fmtDist(sv, sxs), qX(sv), sy1 + 9);
        }
        ctx.strokeStyle = SLATE;
        ctx.strokeRect(sx0, sy0, sw, sh);
      }

      // Elevation profile
      if (e) {
        var ax = elevAxes(e), ex0 = cx0, ex1 = cx1, ew = ex1 - ex0, ey0 = ey + 34, ey1 = ey0 + 110, eh = ey1 - ey0;
        var pX = function (d) { return ex0 + d / e.total * ew; };
        var pY = function (z) { return ey0 + (1 - (z - ax.y0) / (ax.y1 - ax.y0)) * eh; };
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = SLATE;
        ctx.font = '600 15px ' + FONT;
        ctx.fillText('Elevation profile', PADX, ey + 6);
        ctx.font = '400 13px ' + FONT;
        ctx.fillText(elevText(e), PADX, ey + 24);
        ctx.lineWidth = 1;
        ctx.textAlign = 'right';
        for (var yv = ax.y0; yv <= ax.y1 + 1e-6; yv += ax.ys) {
          ctx.strokeStyle = 'rgba(55, 65, 81, 0.25)';
          ctx.beginPath(); ctx.moveTo(ex0, pY(yv)); ctx.lineTo(ex1, pY(yv)); ctx.stroke();
          ctx.fillText(Math.round(yv) + ' m', ex0 - 8, pY(yv));
        }
        ctx.beginPath();
        ctx.moveTo(pX(e.d[0]), ey1);
        for (var k2 = 0; k2 < e.d.length; k2++) ctx.lineTo(pX(e.d[k2]), pY(e.z[k2]));
        ctx.lineTo(pX(e.d[e.d.length - 1]), ey1);
        ctx.closePath();
        ctx.fillStyle = 'rgba(55, 65, 81, 0.18)';
        ctx.fill();
        ctx.beginPath();
        for (var k3 = 0; k3 < e.d.length; k3++) { if (k3) ctx.lineTo(pX(e.d[k3]), pY(e.z[k3])); else ctx.moveTo(pX(e.d[k3]), pY(e.z[k3])); }
        ctx.strokeStyle = SLATE;
        ctx.lineWidth = 1.8;
        ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillStyle = SLATE;
        ctx.textBaseline = 'top';
        for (var xv = 0; xv <= e.total + 1e-6; xv += ax.xs) {
          ctx.strokeStyle = 'rgba(55, 65, 81, 0.5)';
          ctx.beginPath(); ctx.moveTo(pX(xv), ey1); ctx.lineTo(pX(xv), ey1 + 5); ctx.stroke();
          ctx.textAlign = xv === 0 ? 'left' : 'center';
          ctx.fillText(xv === 0 ? '0' : fmtDist(xv, ax.xs), pX(xv), ey1 + 9);
        }
        ctx.strokeStyle = SLATE;
        ctx.strokeRect(ex0, ey0, ew, eh);
      }

      // Note on precision
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(55, 65, 81, 0.85)';
      ctx.font = '400 12px ' + FONT;
      noteLines.forEach(function (line, k) { ctx.fillText(line, PADX, ny + 8 + k * 17); });

      // Footer
      ctx.fillStyle = SLATE;
      ctx.font = '400 13px ' + FONT;
      ctx.fillText('© ' + new Date().getFullYear() + ' Athens GIS Repository | CC-BY 4.0 | athensgis.gr', PADX, H - 20);

      return saveCanvas(canvas, 'Athens_3D_RouteShade.png');
    }).catch(function (e) {
      console.error('[3D] Route shade download failed', e);
      ns.notice('Download failed - please try again.');
    });
  }
  if (dlBtn) dlBtn.addEventListener('click', downloadChart);

  // A white page of W x H at SC times the resolution.
  function pageCanvas(W, H, SC) {
    var canvas = document.createElement('canvas');
    canvas.width = W * SC;
    canvas.height = H * SC;
    var ctx = canvas.getContext('2d');
    ctx.scale(SC, SC);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    return canvas;
  }

  // The header band of the downloaded pages: logo, title, viewer name.
  function pageHeader(ctx, W, HEADER, PADX, logo, title) {
    var g = ctx.createLinearGradient(0, 0, W, HEADER);
    g.addColorStop(0, 'rgb(75, 86, 105)'); g.addColorStop(0.5, SLATE); g.addColorStop(1, 'rgb(40, 48, 61)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, HEADER);
    var x = PADX;
    if (logo) {
      var lh = 52, lw = logo.naturalWidth * (lh / logo.naturalHeight);
      ctx.drawImage(logo, x, (HEADER - lh) / 2, lw, lh);
      x += lw + 16;
    }
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f6f7f5';
    ctx.font = '500 24px ' + FONT;
    if ('letterSpacing' in ctx) ctx.letterSpacing = '2px';
    ctx.fillText(title, x, HEADER / 2);
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.textAlign = 'right';
    ctx.font = '400 14px ' + FONT;
    ctx.fillStyle = 'rgba(246, 247, 245, 0.8)';
    ctx.fillText('Athens GIS Repository 3D Viewer', W - PADX, HEADER / 2);
    ctx.textAlign = 'left';
  }

  function saveCanvas(canvas, name) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) {
        if (!blob) { resolve(); return; }
        var url = URL.createObjectURL(blob), a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        resolve();
      }, 'image/png');
    });
  }

  // The chart data as CSV, in two tables (lines starting with # are comments):
  //  - shade_by_time: one row per step from sunrise to sunset, with the sun's position
  //    and the share of the route in shade and in sun;
  //  - sun_along_route: one row per test point along the route, with the share of the
  //    daylight it is in sun;
  //  - elevation_profile: one row per test point along the route.
  function downloadCsv() {
    if (!route || !route.series) return;
    var s = route.series, e = route.elev, rows = [];
    var date = (function () {
      var p = new Date(s.times[0] + 3 * 36e5);   // Athens is UTC+2 / +3: the day is the same around noon
      return p.getUTCFullYear() + '-' + ('0' + (p.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + p.getUTCDate()).slice(-2);
    })();
    rows.push('# Athens GIS Repository 3D Viewer - route shade (athensgis.gr, CC-BY 4.0)');
    rows.push('# Route length ' + Math.round(route.R.total) + ' m; date ' + date + '; times in Athens local time');
    rows.push('# ' + noteEl.textContent.replace(/\s+/g, ' ').trim());
    rows.push('# shade_by_time');
    rows.push('date,time_athens,sun_azimuth_deg,sun_altitude_deg,shade_percent,sun_percent,route_length_m');
    for (var i = 0; i < s.times.length; i++) {
      var pos = sun.position(s.times[i]), f = s.shade[i];
      rows.push([date, sun.hhmm(s.times[i]), pos.azimuth.toFixed(1), pos.altitude.toFixed(1),
        (f * 100).toFixed(1), ((1 - f) * 100).toFixed(1), Math.round(route.R.total)].join(','));
    }
    var al = s.along;
    if (al) {
      rows.push('');
      rows.push('# sun_along_route (share of the daylight, sunrise to sunset, each point is in sun; daylight ' + al.daylight.toFixed(2) + ' h)');
      rows.push('distance_m,longitude,latitude,sun_percent,shade_percent,sun_hours');
      for (var q = 0; q < al.d.length; q++) {
        rows.push([al.d[q].toFixed(1), al.lon[q].toFixed(6), al.lat[q].toFixed(6),
          (al.sun[q] * 100).toFixed(1), ((1 - al.sun[q]) * 100).toFixed(1), al.hours[q].toFixed(2)].join(','));
      }
    }
    if (e) {
      rows.push('');
      rows.push('# elevation_profile (ground height above sea level; ascent ' + Math.round(e.ascent) + ' m, descent ' + Math.round(e.descent) + ' m, smoothed over ' + (rc.elevSmooth || 30) + ' m)');
      rows.push('distance_m,longitude,latitude,elevation_m');
      for (var k = 0; k < e.d.length; k++) {
        rows.push([e.d[k].toFixed(1), e.lon[k].toFixed(6), e.lat[k].toFixed(6), e.z[k].toFixed(1)].join(','));
      }
    }
    var blob = new Blob([rows.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob), a = document.createElement('a');
    a.href = url;
    a.download = 'Athens_3D_RouteShade_' + date + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
  }
  if (csvBtn) csvBtn.addEventListener('click', downloadCsv);

  // ---------- Sun map ----------
  // Three axes in one picture: the time of day across, the distance along the route up,
  // and each cell coloured by the share of that stretch of the route in sun at that time.
  var heatPanel = $('route-heat'), heatCanvas = $('route-heat-chart'), heatSub = $('route-heat-sub'), heatReadout = $('route-heat-readout');
  var HEAT_BINS = 60;   // stretches along the route (fewer on a short route)
  var HM = { l: 52, r: 10, t: 8, b: 22 };

  var heatRgb = null;
  function heatColor(f) {
    function rgb(hex) { var n = parseInt(hex.slice(1), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; }
    var a = (heatRgb = heatRgb || [rgb(rc.shadeColor), rgb(rc.sunColor)])[0], b = heatRgb[1];
    return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * f) + ',' + Math.round(a[1] + (b[1] - a[1]) * f) + ',' + Math.round(a[2] + (b[2] - a[2]) * f) + ')';
  }

  // The share in sun of each stretch at each time step: g[ti * nb + b] (kept with the series).
  function heatGrid(s) {
    if (s.heat) return s.heat;
    var nT = s.times.length, nS = s.along.d.length, nb = Math.min(HEAT_BINS, nS), g = new Float32Array(nT * nb);
    for (var ti = 0; ti < nT; ti++) for (var b = 0; b < nb; b++) {
      var p0 = Math.floor(b * nS / nb), p1 = Math.floor((b + 1) * nS / nb), n = 0;
      for (var p = p0; p < p1; p++) n += s.lit[ti * nS + p];
      g[ti * nb + b] = n / (p1 - p0);
    }
    return (s.heat = { g: g, nb: nb, nT: nT });
  }
  // The first and last test point of stretch b.
  function heatPoints(H, b) {
    var nS = route.series.along.d.length;
    return [Math.floor(b * nS / H.nb), Math.floor((b + 1) * nS / H.nb) - 1];
  }

  // The map in the box (x0, y0, w, h) with its axes around it, for the panel and the
  // download alike; fs is the label size, now the time on the map (a red line).
  function paintHeat(ctx, x0, y0, w, h, fs, now) {
    var s = route.series, H = heatGrid(s), t = s.times, nT = H.nT, nb = H.nb, total = route.R.total;
    var ta = t[0], tb = t[nT - 1], ti, b;
    function px(tt) { return x0 + (tt - ta) / (tb - ta) * w; }
    function py(d) { return y0 + h - d / total * h; }
    for (ti = 0; ti < nT; ti++) {
      var xa = px(ti ? (t[ti - 1] + t[ti]) / 2 : ta), xb = px(ti < nT - 1 ? (t[ti] + t[ti + 1]) / 2 : tb);
      for (b = 0; b < nb; b++) {
        var ya = py((b + 1) / nb * total), yb = py(b / nb * total);
        ctx.fillStyle = heatColor(H.g[ti * nb + b]);
        ctx.fillRect(xa, ya, xb - xa + 0.6, yb - ya + 0.6);   // overlap a little: no seams
      }
    }
    ctx.font = '400 ' + fs + 'px ' + FONT;
    ctx.fillStyle = SLATE;
    ctx.strokeStyle = 'rgba(55, 65, 81, 0.5)';
    ctx.lineWidth = 1;
    // Distance up the left side
    var ds = niceStep(total, h > 250 ? 5 : 4);
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (var d = 0; d <= total + 1e-6; d += ds) {
      ctx.beginPath(); ctx.moveTo(x0 - 4, py(d)); ctx.lineTo(x0, py(d)); ctx.stroke();
      ctx.fillText(d === 0 ? '0' : fmtDist(d, ds), x0 - 7, py(d));
    }
    // Whole hours along the bottom, every 2 h when the day is long and the map narrow
    var hour = 36e5, every = (tb - ta) > 10 * hour && w < 600 ? 2 : 1;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    for (var tt = Math.ceil(ta / hour) * hour; tt <= tb; tt += hour) {
      var label = sun.hhmm(tt);
      ctx.beginPath(); ctx.moveTo(px(tt), y0 + h); ctx.lineTo(px(tt), y0 + h + 4); ctx.stroke();
      if (parseInt(label, 10) % every === 0) ctx.fillText(label, px(tt), y0 + h + 7);
    }
    if (now != null && now >= ta && now <= tb) {
      ctx.strokeStyle = '#c0392b';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px(now), y0); ctx.lineTo(px(now), y0 + h); ctx.stroke();
      ctx.lineWidth = 1;
    }
    ctx.strokeStyle = SLATE;
    ctx.strokeRect(x0, y0, w, h);
  }

  function drawHeat() {
    if (heatPanel.hidden || !route || !route.series) return;
    var dpr = window.devicePixelRatio || 1, cw = heatCanvas.clientWidth, ch = heatCanvas.clientHeight;
    heatCanvas.width = Math.round(cw * dpr);
    heatCanvas.height = Math.round(ch * dpr);
    var ctx = heatCanvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);
    paintHeat(ctx, HM.l, HM.t, cw - HM.l - HM.r, ch - HM.t - HM.b, 10, sun.time());
    heatSub.textContent = km(route.R.total) + ' · ' + route.series.date + ' · across: time of day · up: distance along the route · colour: % in sun';
  }

  // The cell under the pointer, or null off the map.
  function heatCell(e) {
    var box = heatCanvas.getBoundingClientRect(), s = route.series, H = heatGrid(s), t = s.times;
    var fx = (e.clientX - box.left - HM.l) / (box.width - HM.l - HM.r);
    var fy = 1 - (e.clientY - box.top - HM.t) / (box.height - HM.t - HM.b);
    if (fx < 0 || fx > 1 || fy < 0 || fy > 1) return null;
    var tt = t[0] + fx * (t[t.length - 1] - t[0]), ti = 0;
    for (var i = 1; i < t.length; i++) if (Math.abs(t[i] - tt) < Math.abs(t[ti] - tt)) ti = i;
    var b = Math.min(H.nb - 1, Math.floor(fy * H.nb));
    return { t: tt, ti: ti, b: b, f: H.g[ti * H.nb + b], H: H };
  }

  var heatDragging = false;
  heatCanvas.addEventListener('pointermove', function (e) {
    if (!route || !route.series) return;
    var c = heatCell(e);
    if (!c) { heatReadout.textContent = ''; showHoverSpot(null); return; }
    var total = route.R.total, a = route.series.along, pp = heatPoints(c.H, c.b), mid = Math.floor((pp[0] + pp[1]) / 2);
    heatReadout.textContent = sun.hhmm(route.series.times[c.ti]) + ', ' + fmtDist(c.b / c.H.nb * total, 1) + '–' +
      fmtDist((c.b + 1) / c.H.nb * total, 1) + ' along the route: ' + pct(c.f) + ' in sun';
    showHoverSpot(a.lon[mid], a.lat[mid]);
    if (heatDragging) sun.setTime(c.t);
  });
  heatCanvas.addEventListener('pointerleave', function () {
    heatDragging = false;
    heatReadout.textContent = '';
    showHoverSpot(null);
  });
  heatCanvas.addEventListener('pointerdown', function (e) {
    if (!route || !route.series) return;
    var c = heatCell(e);
    if (!c) return;
    heatDragging = true;
    if (heatCanvas.setPointerCapture) heatCanvas.setPointerCapture(e.pointerId);
    sun.setTime(c.t);
  });
  heatCanvas.addEventListener('pointerup', function () { heatDragging = false; });

  function setHeat(on) {
    heatPanel.hidden = !on;
    heatBtn.classList.toggle('active', on);
    heatReadout.textContent = '';
    if (on) drawHeat(); else showHoverSpot(null);
  }
  heatBtn.addEventListener('click', function () { setHeat(heatPanel.hidden); });
  $('route-heat-close').addEventListener('click', function () { setHeat(false); });
  window.addEventListener('resize', drawHeat);
  $('route-heat-scale').style.background = 'linear-gradient(to right, ' + rc.shadeColor + ', ' + rc.sunColor + ')';

  // Street widths on the plan by road type (Protomaps kind_detail), in pixels.
  var STREET_W = { motorway: 5, trunk: 5, primary: 4.2, secondary: 3.6, tertiary: 3, residential: 2.4, unclassified: 2.4,
    living_street: 2, service: 1.6, pedestrian: 1.6, path: 1 };
  function streetWidth(s) { return STREET_W[s.k] || 1.6; }

  // The route as a plain line in the box (x0, y0, w, h) over the streets around it,
  // north up, with a mark every `step` metres, its start and end, a scale bar and a
  // north arrow.
  function paintRoute(ctx, x0, y0, w, h, fs, step) {
    var R = route.R, c = R.coords, pad = 48;
    var xs = c.map(function (p) { return core.mx(p[0]); }), ys = c.map(function (p) { return core.my(p[1]); });
    var ax = Math.min.apply(null, xs), bx = Math.max.apply(null, xs), ay = Math.min.apply(null, ys), by = Math.max.apply(null, ys);
    var k = Math.min((w - 2 * pad) / Math.max(bx - ax, 1e-12), (h - 2 * pad) / Math.max(by - ay, 1e-12));
    var ox = x0 + (w - (bx - ax) * k) / 2, oy = y0 + (h - (by - ay) * k) / 2;
    function P(p) { return [ox + (core.mx(p[0]) - ax) * k, oy + (core.my(p[1]) - ay) * k]; }   // y grows southward
    function halo(text, x, y) {
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 4; ctx.lineJoin = 'round';
      ctx.strokeText(text, x, y);
      ctx.fillText(text, x, y);
    }

    ctx.fillStyle = '#f6f7f5';
    ctx.fillRect(x0, y0, w, h);

    // The streets around it (grey casing, white fill; paths and tunnels dashed), in the box
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, y0, w, h); ctx.clip();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    function streetPath(s) {
      ctx.beginPath();
      s.c.forEach(function (p, j) { var q = P(p); if (j) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
    }
    var streets = (route.streets || []).slice().sort(function (a, b) { return streetWidth(a) - streetWidth(b); });
    var thin = streets.filter(function (s) { return s.tunnel || streetWidth(s) <= 1; });
    var full = streets.filter(function (s) { return thin.indexOf(s) < 0; });
    ctx.strokeStyle = '#b9bfc9';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    thin.forEach(function (s) { streetPath(s); ctx.stroke(); });
    ctx.setLineDash([]);
    ctx.strokeStyle = '#c3c8d0';
    full.forEach(function (s) { ctx.lineWidth = streetWidth(s) + 1.8; streetPath(s); ctx.stroke(); });
    ctx.strokeStyle = '#ffffff';
    full.forEach(function (s) { ctx.lineWidth = streetWidth(s); streetPath(s); ctx.stroke(); });
    ctx.restore();

    // The line
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    [['#ffffff', 8], [SLATE, 3.5]].forEach(function (st) {
      ctx.strokeStyle = st[0];
      ctx.lineWidth = st[1];
      ctx.beginPath();
      c.forEach(function (p, j) { var q = P(p); if (j) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); });
      ctx.stroke();
    });

    // Distance marks: a dot on the line, the label off to the side
    ctx.font = '600 ' + fs + 'px ' + FONT;
    for (var d = step; d < R.total - step * 0.25; d += step) {
      var p = P(pointAt(R, d)), pa = P(pointAt(R, Math.max(0, d - 2))), pb = P(pointAt(R, Math.min(R.total, d + 2)));
      var dx = pb[0] - pa[0], dy = pb[1] - pa[1], len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = SLATE;
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(p[0], p[1], 4, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      ctx.textAlign = nx > 0.35 ? 'left' : nx < -0.35 ? 'right' : 'center';
      ctx.textBaseline = ny > 0.35 ? 'top' : ny < -0.35 ? 'bottom' : 'middle';
      ctx.fillStyle = SLATE;
      halo(fmtDist(d, step), p[0] + nx * 9, p[1] + ny * 9);
    }

    // Start and end
    [[c[0], '#2e7d32', 'Start'], [c[c.length - 1], '#c0392b', 'End · ' + km(R.total)]].forEach(function (it) {
      var q = P(it[0]);
      ctx.fillStyle = it[1];
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(q[0], q[1], 7, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      halo(it[2], q[0] + 12, q[1]);
    });

    // Scale bar (bottom left) and north arrow (top right)
    var mpp = core.metresPerUnit(core.latOf((ay + by) / 2)) / k, bar = niceStep(mpp * w * 0.18, 1), bl = bar / mpp;
    var sx = x0 + 14, sy = y0 + h - 14;
    ctx.strokeStyle = SLATE;
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'butt';
    ctx.beginPath(); ctx.moveTo(sx, sy - 5); ctx.lineTo(sx, sy); ctx.lineTo(sx + bl, sy); ctx.lineTo(sx + bl, sy - 5); ctx.stroke();
    ctx.fillStyle = SLATE;
    ctx.font = '400 ' + fs + 'px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(fmtDist(bar, bar), sx + bl / 2, sy - 4);
    var nx0 = x0 + w - 22, ny0 = y0 + 14;
    ctx.beginPath(); ctx.moveTo(nx0, ny0); ctx.lineTo(nx0 + 7, ny0 + 20); ctx.lineTo(nx0, ny0 + 15); ctx.lineTo(nx0 - 7, ny0 + 20); ctx.closePath(); ctx.fill();
    ctx.textBaseline = 'top';
    ctx.font = '600 ' + fs + 'px ' + FONT;
    ctx.fillText('N', nx0, ny0 + 23);

    ctx.strokeStyle = SLATE;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x0, y0, w, h);
    ctx.lineWidth = 1;
  }

  // The sun map as a PNG page, in the style of the chart download.
  function downloadHeat() {
    if (!route || !route.series) return;
    var s = route.series, r = tRange(), W = 1000, SC = 2, PADX = 36, HEADER = 76;
    loadImage('images/63.png').then(function (logo) {
      var mctx = document.createElement('canvas').getContext('2d');
      mctx.font = '400 12px ' + FONT;
      var noteLines = wrapLines(mctx, noteEl.textContent, W - 2 * PADX);
      var x0 = 120, y0 = HEADER + 96, w = W - PADX - x0, h = 420, ly = y0 + h + 66;
      var ry = ly + 40, rh = 360, ny = ry + 44 + rh + 18;      // route block (title, plan), then the note
      var H = ny + noteLines.length * 17 + 46;
      var canvas = pageCanvas(W, H, SC), ctx = canvas.getContext('2d');
      pageHeader(ctx, W, HEADER, PADX, logo, 'SUN MAP');

      // What it is
      ctx.textBaseline = 'middle';
      ctx.fillStyle = SLATE;
      ctx.font = '600 16px ' + FONT;
      ctx.fillText(km(route.R.total) + ' route · ' + s.date, PADX, HEADER + 30);
      ctx.font = '400 14px ' + FONT;
      ctx.fillText('Share of the route in sun by distance along it and time of day · sunrise ' + sun.hhmm(r[0]) +
        ' · sunset ' + sun.hhmm(r[1]) + ' (Athens time)', PADX, HEADER + 54);

      var now = sun.time();
      paintHeat(ctx, x0, y0, w, h, 13, now);

      // Axis titles
      ctx.fillStyle = SLATE;
      ctx.font = '600 13px ' + FONT;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Time of day (Athens)', x0 + w / 2, y0 + h + 40);
      ctx.save();
      ctx.translate(PADX + 8, y0 + h / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillText('Distance along the route (start at the bottom)', 0, 0);
      ctx.restore();

      // Colour scale and the time on the map
      ctx.textAlign = 'left';
      ctx.font = '400 14px ' + FONT;
      var lx = x0;
      ctx.fillText('Shade 0%', lx, ly);
      lx += ctx.measureText('Shade 0%').width + 10;
      var grad = ctx.createLinearGradient(lx, 0, lx + 200, 0);
      grad.addColorStop(0, rc.shadeColor); grad.addColorStop(1, rc.sunColor);
      ctx.fillStyle = grad;
      ctx.fillRect(lx, ly - 6, 200, 12);
      ctx.strokeStyle = 'rgba(55, 65, 81, 0.35)';
      ctx.strokeRect(lx + 0.5, ly - 5.5, 199, 11);
      lx += 210;
      ctx.fillStyle = SLATE;
      ctx.fillText('100% Sun', lx, ly);
      lx += ctx.measureText('100% Sun').width + 28;
      if (now >= r[0] && now <= r[1]) {
        ctx.strokeStyle = '#c0392b'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(lx, ly - 7); ctx.lineTo(lx, ly + 7); ctx.stroke();
        ctx.lineWidth = 1;
        ctx.fillText('Time on the map: ' + sun.hhmm(now), lx + 10, ly);
      }

      // The route itself, marked at the same distances as the map's axis
      var step = niceStep(route.R.total, 5);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = SLATE;
      ctx.font = '600 15px ' + FONT;
      ctx.fillText('The route', PADX, ry + 6);
      ctx.font = '400 13px ' + FONT;
      ctx.fillText('North up · streets from the basemap (© OpenStreetMap contributors, © Protomaps) · a mark every ' + fmtDist(step, step) + ' along the route, as on the distance axis above', PADX, ry + 24);
      paintRoute(ctx, PADX, ry + 44, W - 2 * PADX, rh, 12, step);

      // Note on precision
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(55, 65, 81, 0.85)';
      ctx.font = '400 12px ' + FONT;
      noteLines.forEach(function (line, k) { ctx.fillText(line, PADX, ny + 8 + k * 17); });

      // Footer
      ctx.fillStyle = SLATE;
      ctx.font = '400 13px ' + FONT;
      ctx.fillText('© ' + new Date().getFullYear() + ' Athens GIS Repository | CC-BY 4.0 | athensgis.gr', PADX, H - 20);

      return saveCanvas(canvas, 'Athens_3D_RouteSunMap.png');
    }).catch(function (e) {
      console.error('[3D] Sun map download failed', e);
      ns.notice('Download failed - please try again.');
    });
  }
  $('route-heat-download').addEventListener('click', downloadHeat);

  // Minimize: only the header row stays (the route and its colours stay on the map).
  var minBtn = $('route-min');
  function setMinimized(on) {
    panel.classList.toggle('min', on);
    minBtn.title = on ? 'Show the chart' : 'Minimize the chart';
    minBtn.setAttribute('aria-label', minBtn.title);
    minBtn.setAttribute('aria-expanded', String(!on));
  }
  if (minBtn) minBtn.addEventListener('click', function () { setMinimized(!panel.classList.contains('min')); });

  // Dock: the arrow on the panel's edge moves it to the right side of the screen and back.
  var dockBtn = $('route-dock'), bldPanel = $('buildings-panel');
  // Docked, it ends 10 px above the 3D buildings panel (which grows with its legend).
  function fitDocked() {
    var docked = panel.classList.contains('docked') && !window.matchMedia('(max-width: 900px)').matches;
    var top = docked && bldPanel && getComputedStyle(bldPanel).display !== 'none' ? bldPanel.getBoundingClientRect().top : 0;
    panel.style.maxHeight = top ? Math.max(120, top - 10 - panel.getBoundingClientRect().top) + 'px' : '';
  }
  if (dockBtn) dockBtn.addEventListener('click', function () {
    var on = !panel.classList.contains('docked');
    panel.classList.toggle('docked', on);
    dockBtn.title = on ? 'Move back to the centre' : 'Move to the right';
    dockBtn.setAttribute('aria-label', dockBtn.title);
    fitDocked();
  });
  window.addEventListener('resize', fitDocked);
  if (bldPanel && window.ResizeObserver) new ResizeObserver(fitDocked).observe(bldPanel);

  function fail(e) {
    if (e === core.STALE) return;
    console.warn('[3D] Route shade failed', e);
    if (summary) summary.textContent = 'The calculation failed - please draw the route again.';
  }

  // Chart: hover reads a time, click (or drag) sets the sun panel to it.
  function timeFromEvent(e) {
    var box = chart.getBoundingClientRect(), r = tRange();
    var x = (e.clientX - box.left) / box.width * CW;
    return r[0] + Math.min(1, Math.max(0, (x - PL) / PW)) * (r[1] - r[0]);
  }
  var dragging = false;
  chart.addEventListener('pointermove', function (e) {
    if (!route || !route.series) return;
    var t = timeFromEvent(e);
    hovering = true;
    marker('route-hover', t, 'rc-hover');
    var f = shadeAtTime(t);
    readout.textContent = sun.hhmm(t) + ': ' + pct(f) + ' in shade, ' + pct(1 - f) + ' in sun';
    if (dragging) sun.setTime(t);
  });
  chart.addEventListener('pointerleave', function () {
    hovering = false;
    dragging = false;
    marker('route-hover', null);
    if (route && route.model) showTime(sun.time());
  });
  chart.addEventListener('pointerdown', function (e) {
    if (!route || !route.series) return;
    dragging = true;
    if (chart.setPointerCapture) chart.setPointerCapture(e.pointerId);
    sun.setTime(timeFromEvent(e));
  });
  chart.addEventListener('pointerup', function () { dragging = false; });

  // ---------- Drawing ----------
  function onClick(e) {
    if (mode !== 'drawing') return;
    var p = [e.lngLat.lng, e.lngLat.lat];
    if (points.length) {
      var last = map.project(points[points.length - 1]);
      if (Math.hypot(last.x - e.point.x, last.y - e.point.y) <= FINISH_PX) {
        if (points.length >= 2) finish();
        return;
      }
    }
    points.push(p);
    redrawDrawing();
  }
  function onDblClick(e) {
    if (mode !== 'drawing') return;
    e.preventDefault();
    if (points.length >= 2) finish();
  }
  function onMove(e) {
    if (mode !== 'drawing') return;
    cursor = [e.lngLat.lng, e.lngLat.lat];
    redrawDrawing();
  }
  function bindDrawing() {
    map.on('click', onClick);
    map.on('dblclick', onDblClick);
    map.on('mousemove', onMove);
    ns.handlers.disable('route-shade', ['doubleClickZoom']);
    map.getCanvas().style.cursor = 'crosshair';
  }
  function unbindDrawing() {
    map.off('click', onClick);
    map.off('dblclick', onDblClick);
    map.off('mousemove', onMove);
    ns.handlers.enable('route-shade');
    map.getCanvas().style.cursor = '';
  }

  // ---------- Flow ----------
  function setActive(on) { if (btn) btn.classList.toggle('active', on); }

  function showPrompt() {
    mode = 'prompt';
    setActive(true);
    promptModal.style.display = 'flex';
  }
  function hidePrompt() {
    promptModal.style.display = 'none';
    mode = 'idle';
    setActive(false);
  }
  function begin() {
    promptModal.style.display = 'none';
    ensureLayers();
    points = [];
    cursor = null;
    mode = 'drawing';
    setActive(true);
    bindDrawing();
    redrawDrawing();
  }

  function finish() {
    unbindDrawing();
    mode = 'result';
    var R = prepareRoute(points.slice());
    points = [];
    cursor = null;
    redrawDrawing();
    route = { R: R, model: null, series: null, elev: null, streets: [], job: { stale: false } };
    try { route.streets = readStreets(R); } catch (err) { console.warn('[3D] Route shade: no streets', err); }
    elevWrap.hidden = true;
    sunWrap.hidden = true;

    // The buildings and trees come from what the map has loaded: warn when part of
    // the route is off screen, where they may be missing.
    var b = map.getBounds();
    if (R.coords.some(function (c) { return !b.contains(c); })) {
      ns.notice('Part of the route is off screen - buildings and trees there may be missing.');
    }

    chart.innerHTML = '';
    readout.textContent = '';
    subEl.textContent = km(R.total);
    summary.textContent = 'Reading the buildings, trees and terrain…';
    setMinimized(false);
    panel.hidden = false;
    var job = route.job;
    buildModel(R, job).then(function (M) {
      if (job.stale) return;
      route.model = M;
      route.elev = elevationProfile(M, route.R);
      drawElevation();
      showTime(sun.time());
      computeDay();
    }).catch(fail);
  }

  function cancel() {
    unbindDrawing();
    points = [];
    cursor = null;
    redrawDrawing();
    mode = 'idle';
    setActive(false);
  }

  // Closing the panel clears the route and lets go of its height model.
  function clear() {
    if (route && route.job) route.job.stale = true;
    clearTimeout(dayTimer);
    route = null;
    setExports(false);
    panel.hidden = true;
    hovering = dragging = false;
    elevWrap.hidden = true;
    sunWrap.hidden = true;
    setHeat(false);
    showHoverSpot(null);
    var src = map.getSource(SRC);
    if (src) src.setData(empty());
    mode = 'idle';
    setActive(false);
  }

  // Quitting a finished route asks first: the route, its chart and its calculation go.
  var quitModal = $('routeQuitModal');
  function askQuit() {
    if (!route) return;
    quitModal.style.display = 'flex';
    $('routeQuitNo').focus();
  }
  function hideQuit() { quitModal.style.display = 'none'; }
  $('routeQuitYes').addEventListener('click', function () { hideQuit(); clear(); });
  $('routeQuitNo').addEventListener('click', hideQuit);
  quitModal.addEventListener('click', function (e) { if (e.target === quitModal) hideQuit(); });

  window.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    if (quitModal.style.display === 'flex') { hideQuit(); return; }
    if (!heatPanel.hidden) { setHeat(false); return; }
    if (mode === 'drawing') cancel();
    else if (mode === 'prompt') hidePrompt();
  });

  if (btn) btn.addEventListener('click', function () {
    if (ns.loading.isLocked()) return;
    if (mode === 'drawing') { cancel(); return; }
    if (mode === 'prompt') { hidePrompt(); return; }
    if (mode === 'result') { askQuit(); return; }
    var measure = $('measureBtn');
    if (measure && measure.classList.contains('active')) { ns.notice('Finish the measurement first.'); return; }
    if (map.getZoom() < rc.minZoom) { ns.notice('Zoom in closer to draw a route (the buildings and trees are needed).'); return; }
    showPrompt();
  });
  if (promptOk) promptOk.addEventListener('click', begin);
  if (promptModal) promptModal.addEventListener('click', function (e) { if (e.target === promptModal) hidePrompt(); });
  if (closeBtn) closeBtn.addEventListener('click', askQuit);

  // Legend colours from the config.
  Array.prototype.forEach.call(document.querySelectorAll('.route-sw-sun'), function (el) { el.style.background = rc.sunColor; });
  Array.prototype.forEach.call(document.querySelectorAll('.route-sw-shade'), function (el) { el.style.background = rc.shadeColor; });
  // The test height from the config, so the note never disagrees with the calculation.
  var heightNote = $('route-height-note');
  if (heightNote) heightNote.textContent = 'Shade is calculated at ' + rc.eyeHeight + ' m above the ground (a walker\'s head).';
})();
