// Buildings panel: buildings are drawn in one neutral color by default; the
// "Color by height" switch applies the light-to-dark ramp from config3d.js and shows
// its legend. The panel appears only once the buildings layer has loaded.
(function () {
  var ns = window.Athens3D = window.Athens3D || {};
  var cfg = ns.config.buildings;

  var panel = document.getElementById('buildings-panel');
  var toggle = document.getElementById('colorByHeight');
  var legend = document.getElementById('height-legend');
  if (!panel || !toggle || !legend) return;

  function classLabel(i) {
    var from = cfg.ramp[i].from;
    var next = cfg.ramp[i + 1];
    return next ? from + ' – ' + next.from + ' m' : from + '+ m';
  }

  // [{ color, label }] for the legend here and in the export.
  function legendItems() {
    return cfg.ramp.map(function (c, i) { return { color: c.color, label: classLabel(i) }; });
  }

  function rampExpr(heightExpr) {
    var expr = ['step', heightExpr, cfg.ramp[0].color];
    for (var i = 1; i < cfg.ramp.length; i++) expr.push(cfg.ramp[i].from, cfg.ramp[i].color);
    return expr;
  }

  function buildLegend() {
    legend.innerHTML = '';
    // Tallest first, so the list reads like the buildings: dark on top.
    legendItems().reverse().forEach(function (item) {
      var li = document.createElement('li');
      var sw = document.createElement('span');
      sw.className = 'height-swatch';
      sw.style.background = item.color;
      var tx = document.createElement('span');
      tx.textContent = item.label;
      li.appendChild(sw);
      li.appendChild(tx);
      legend.appendChild(li);
    });
  }

  function apply(on) {
    var b = ns.buildings, map = ns.map;
    if (!b || !map || !map.getLayer(b.layerId)) return;
    map.setPaintProperty(b.layerId, 'fill-extrusion-color', on ? rampExpr(b.heightExpr) : cfg.neutralColor);
    legend.hidden = !on;
    panel.classList.toggle('colored', on);
  }

  ns.buildingsStyle = {
    isColored: function () { return !!toggle.checked && !!ns.buildings; },
    legendItems: legendItems
  };

  buildLegend();
  toggle.addEventListener('change', function () { apply(toggle.checked); });

  document.addEventListener('athens3d:buildings', function (e) {
    if (!e.detail) return;   // no buildings layer - keep the panel hidden
    panel.hidden = false;
    apply(toggle.checked);
  });
})();
