// Measure tool for the 3D map - same flow as the main page (JS/measure.js):
// instructions dialog -> click points on the map -> double-click (or click the last
// point again) to finish -> result dialog; ESC cancels. Points are picked on the
// terrain surface and the line is draped over it. The distance is the horizontal
// (map) distance, as on the main page.
(function () {
  var ns = window.Athens3D = window.Athens3D || {};
  var map = ns.map;
  if (!map) return;

  var SRC = 'measure-src';
  var SRC_RUBBER = 'measure-rubber-src';
  var FINISH_PX = 10;   // clicking this close to the last point finishes the line

  var state = 'idle';   // idle | prompt | drawing | result
  var points = [];      // [[lng, lat], ...]
  var cursor = null;

  var btn = document.getElementById('measureBtn');
  var promptModal = document.getElementById('measureMsgModal');
  var promptOk = document.getElementById('measureMsgOk');
  var resultModal = document.getElementById('measureResultModal');
  var resultOk = document.getElementById('measureResultOk');
  var resultText = document.getElementById('measureResultText');

  // Clicks on the map belong to this tool while it is drawing (see building-info.js).
  (ns.drawingTools = ns.drawingTools || []).push(function () { return state === 'drawing'; });

  function empty() { return { type: 'FeatureCollection', features: [] }; }

  function ensureLayers() {
    if (map.getSource(SRC)) return;
    map.addSource(SRC, { type: 'geojson', data: empty() });
    map.addSource(SRC_RUBBER, { type: 'geojson', data: empty() });
    map.addLayer({
      id: 'measure-rubber', type: 'line', source: SRC_RUBBER,
      layout: { 'line-cap': 'round' },
      paint: { 'line-color': '#6b7280', 'line-width': 2, 'line-dasharray': [2, 2] }
    });
    map.addLayer({
      id: 'measure-line', type: 'line', source: SRC,
      filter: ['==', ['geometry-type'], 'LineString'],
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': 'grey', 'line-width': 3 }
    });
    map.addLayer({
      id: 'measure-vertices', type: 'circle', source: SRC,
      filter: ['==', ['geometry-type'], 'Point'],
      paint: {
        'circle-radius': 4.5,
        'circle-color': '#ffffff',
        'circle-stroke-color': '#666666',
        'circle-stroke-width': 1.5,
        'circle-pitch-alignment': 'viewport'
      }
    });
  }

  function redraw() {
    if (!map.getSource(SRC)) return;
    var fc = empty();
    if (points.length >= 2) fc.features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: points.slice() } });
    points.forEach(function (p) { fc.features.push({ type: 'Feature', properties: {}, geometry: { type: 'Point', coordinates: p } }); });
    map.getSource(SRC).setData(fc);

    var rubber = empty();
    if (state === 'drawing' && points.length && cursor) {
      rubber.features.push({ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [points[points.length - 1], cursor] } });
    }
    map.getSource(SRC_RUBBER).setData(rubber);
  }

  function haversine(a, b) {
    var R = 6371008.8, toRad = Math.PI / 180;
    var dLat = (b[1] - a[1]) * toRad, dLon = (b[0] - a[0]) * toRad;
    var s = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  function totalMeters() {
    var t = 0;
    for (var i = 1; i < points.length; i++) t += haversine(points[i - 1], points[i]);
    return t;
  }

  // ---------- Map handlers while drawing ----------
  function onClick(e) {
    if (state !== 'drawing') return;
    var p = [e.lngLat.lng, e.lngLat.lat];
    if (points.length) {
      var last = map.project(points[points.length - 1]);
      var near = Math.hypot(last.x - e.point.x, last.y - e.point.y) <= FINISH_PX;
      if (near) {
        if (points.length >= 2) finish();
        return;   // a repeat click on the only point - ignore
      }
    }
    points.push(p);
    redraw();
  }
  function onDblClick(e) {
    if (state !== 'drawing') return;
    e.preventDefault();
    if (points.length >= 2) finish();
  }
  function onMove(e) {
    if (state !== 'drawing') return;
    cursor = [e.lngLat.lng, e.lngLat.lat];
    redraw();
  }
  function onKey(e) {
    if (e.key !== 'Escape' && e.key !== 'Esc') return;
    if (state === 'drawing') cancel();
    else if (state === 'prompt') hidePrompt();
    else if (state === 'result') hideResult();
  }

  function bindDrawing() {
    map.on('click', onClick);
    map.on('dblclick', onDblClick);
    map.on('mousemove', onMove);
    ns.handlers.disable('measure', ['doubleClickZoom']);
    map.getCanvas().style.cursor = 'crosshair';
  }
  function unbindDrawing() {
    map.off('click', onClick);
    map.off('dblclick', onDblClick);
    map.off('mousemove', onMove);
    ns.handlers.enable('measure');
    map.getCanvas().style.cursor = '';
  }

  // ---------- Flow ----------
  function setActive(on) { if (btn) btn.classList.toggle('active', on); }

  function showPrompt() {
    state = 'prompt';
    setActive(true);
    if (promptModal) promptModal.style.display = 'flex';
  }
  function hidePrompt() {
    if (promptModal) promptModal.style.display = 'none';
    state = 'idle';
    setActive(false);
  }
  function begin() {
    if (promptModal) promptModal.style.display = 'none';
    ensureLayers();
    points = [];
    cursor = null;
    state = 'drawing';
    setActive(true);
    bindDrawing();
    redraw();
  }
  function finish() {
    unbindDrawing();
    state = 'result';
    cursor = null;
    redraw();
    if (resultText) resultText.textContent = 'Distance: ' + (totalMeters() / 1000).toFixed(2) + ' km';
    if (resultModal) resultModal.style.display = 'flex';
  }
  function clearLine() {
    points = [];
    cursor = null;
    redraw();
  }
  function cancel() {
    unbindDrawing();
    clearLine();
    state = 'idle';
    setActive(false);
  }
  // Dismissing the result clears the line, as on the main page.
  function hideResult() {
    if (resultModal) resultModal.style.display = 'none';
    clearLine();
    state = 'idle';
    setActive(false);
  }

  window.addEventListener('keydown', onKey);

  if (btn) btn.addEventListener('click', function () {
    if (ns.loading.isLocked()) return;
    if (state === 'drawing') cancel();
    else if (state === 'prompt') hidePrompt();
    else {
      if (state === 'result') hideResult();
      var routeBtn = document.getElementById('routeShadeBtn');
      if (routeBtn && routeBtn.classList.contains('active') && ns.notice) { ns.notice('Close the route shade tool first.'); return; }
      showPrompt();
    }
  });
  if (promptOk) promptOk.addEventListener('click', begin);
  if (promptModal) promptModal.addEventListener('click', function (e) { if (e.target === promptModal) hidePrompt(); });
  if (resultOk) resultOk.addEventListener('click', hideResult);
  if (resultModal) resultModal.addEventListener('click', function (e) { if (e.target === resultModal) hideResult(); });
})();
