// Building and tree info: click a building or a tree to see its attributes (every field
// in its archive) in a popup, with its footprint outlined on the map. Clicks that belong to a
// drawing tool (measure, route shade) are left to that tool.
(function () {
  var ns = window.Athens3D = window.Athens3D || {};
  var map = ns.map;
  if (!map) return;

  var SRC = 'building-info-src', OUTLINE = 'building-info-outline';
  var popup = null;

  // The tools that draw on the map register a function that says whether they are drawing.
  ns.drawingTools = ns.drawingTools || [];
  function toolDrawing() {
    return ns.drawingTools.some(function (fn) { return fn(); });
  }

  function empty() { return { type: 'FeatureCollection', features: [] }; }

  function ensureLayers() {
    if (map.getSource(SRC)) return;
    map.addSource(SRC, { type: 'geojson', data: empty() });
    map.addLayer({ id: OUTLINE, type: 'line', source: SRC,
      layout: { 'line-join': 'round' },
      paint: { 'line-color': '#c0392b', 'line-width': 3 } });
  }
  function outline(feature) {
    var src = map.getSource(SRC);
    if (!src) return;
    src.setData(feature ? { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: feature.geometry }] } : empty());
  }

  function fmt(v) {
    if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100);
    return String(v);
  }

  function scroll(table) {
    var d = document.createElement('div');
    d.className = 'bldg-scroll';
    d.appendChild(table);
    return d;
  }

  // A table of the building's attributes: the height first (with the default noted when
  // the building has none), then every other field that has a value.
  function content(props, heading, firstRows, skip) {
    var box = document.createElement('div');
    box.className = 'bldg-info';
    var title = document.createElement('h3');
    title.textContent = heading;
    box.appendChild(title);
    var table = document.createElement('table');
    function row(k, v) {
      var tr = document.createElement('tr'), th = document.createElement('th'), td = document.createElement('td');
      th.textContent = k;
      td.textContent = v;
      tr.appendChild(th);
      tr.appendChild(td);
      table.appendChild(tr);
    }
    firstRows.forEach(function (r) { row(r[0], r[1]); });
    var n = 0;
    Object.keys(props).sort().forEach(function (k) {
      var v = props[k];
      if (k === skip || v === null || v === undefined || v === '') return;
      row(k, fmt(v));
      n++;
    });
    if (!n) {
      var none = document.createElement('p');
      none.className = 'bldg-none';
      none.textContent = 'No other attributes in the data.';
      box.appendChild(scroll(table));
      box.appendChild(none);
    } else {
      box.appendChild(scroll(table));
    }
    return box;
  }

  function close() {
    if (popup) { var p = popup; popup = null; p.remove(); }
    outline(null);
  }

  // The clickable layers that exist now (the buildings, the trees).
  function layers() {
    var out = [];
    if (ns.buildings && map.getLayer(ns.buildings.layerId)) out.push(ns.buildings.layerId);
    if (ns.trees && ns.trees.byId && map.getLayer(ns.trees.layerId)) out.push(ns.trees.layerId);
    return out;
  }

  // Crown outline of a tree, on the ground.
  function crown(tr) {
    var r = tr.r || 1.5, c = [], dLat = r / 111320, dLon = r / (111320 * Math.cos(tr.lat * Math.PI / 180));
    for (var i = 0; i < 24; i++) { var a = i / 24 * 2 * Math.PI; c.push([tr.lon + Math.cos(a) * dLon, tr.lat + Math.sin(a) * dLat]); }
    c.push(c[0]);
    return { geometry: { type: 'Polygon', coordinates: [c] } };
  }

  function onClick(e) {
    var ls = layers();
    if (!ls.length || toolDrawing()) return;
    var hits = map.queryRenderedFeatures(e.point, { layers: ls });
    if (!hits.length) { close(); return; }
    var f = hits[0], box, shape = f;
    if (ns.buildings && f.layer.id === ns.buildings.layerId) {
      var hf = ns.buildings.heightField, raw = Number((f.properties || {})[hf]), h = ns.buildingHeight(f.properties);
      box = content(f.properties || {}, 'BUILDING',
        [['Height', h.toFixed(1) + ' m' + (raw > 0 ? '' : ' (no height in the data - default)')]], hf);
    } else {
      var tr = ns.trees.byId[(f.properties || {}).id];
      if (!tr) { close(); return; }
      var hft = ns.config.trees.heightField;
      box = content(tr.p || {}, 'TREE',
        [['Height', tr.h.toFixed(1) + ' m' + (tr.hasH ? '' : ' (no height in the data - default)')],
         ['Crown', (tr.kind || 'round') + ', about ' + (2 * (tr.r || 0)).toFixed(1) + ' m wide']], hft);
      shape = crown(tr);
    }
    close();
    ensureLayers();
    outline(shape);
    popup = new maplibregl.Popup({ closeButton: true, closeOnClick: false, maxWidth: '320px', className: 'bldg-popup' })
      .setLngLat(e.lngLat)
      .setDOMContent(box)
      .addTo(map);
    popup.on('close', function () { if (popup) { popup = null; outline(null); } });
  }

  map.on('click', onClick);

  // Pointer cursor over a building or tree, unless a tool is drawing (it sets its own cursor).
  map.on('mousemove', function (e) {
    var ls = layers();
    if (!ls.length || toolDrawing()) return;
    var over = map.queryRenderedFeatures(e.point, { layers: ls }).length > 0;
    map.getCanvas().style.cursor = over ? 'pointer' : '';
  });

  window.addEventListener('keydown', function (e) {
    if ((e.key === 'Escape' || e.key === 'Esc') && popup) close();
  });
})();
