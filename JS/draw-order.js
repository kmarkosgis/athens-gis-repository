// === Draw Order Module ===
// Adds a "draw order" button/popup that lets the user control which currently
// open layer renders above another. The polygon-behind/line-middle/point-in-
// front tiering is a hard default enforced by dedicated Leaflet panes in
// JS/layer-control.js (createLayerFromGeoJSON) - this module can only reorder
// layers that share a tier (e.g. two point datasets that overlap), it can never
// put a polygon above a point.
//
// Also owns the popup "shell" shared with the opacity popup (JS/utils.js):
// one popup box, one panel visible at a time, with arrows to cycle between
// them. Both opacityBtn and drawOrderBtn open the same popup element.

(function () {
  var ag = window.AthensGIS = window.AthensGIS || {};

  // ── Shared popup shell (opacity + draw order) ───────────────────────────────
  var panels = {};      // id -> { label, render(container) }
  var panelOrder = [];  // cycle order for the header arrows
  var activePanel = null;
  var popupEl, titleEl, bodyEl, prevBtn, nextBtn;

  function ensureRefs() {
    if (popupEl) return true;
    popupEl = document.getElementById('layer-popup');
    titleEl = document.getElementById('layerPopupTitle');
    bodyEl = document.getElementById('layerPopupBody');
    prevBtn = document.getElementById('layerPopupPrev');
    nextBtn = document.getElementById('layerPopupNext');
    return !!(popupEl && titleEl && bodyEl);
  }

  function setActiveTriggerButton(id) {
    document.querySelectorAll('.layer-popup-trigger').forEach(function (btn) {
      btn.classList.toggle('active', btn.dataset.panel === id);
    });
  }

  function renderPanel(id) {
    var panel = panels[id];
    if (!panel) return;
    activePanel = id;
    titleEl.textContent = panel.label;
    bodyEl.innerHTML = '';
    panel.render(bodyEl);
    var showArrows = panelOrder.length > 1;
    if (prevBtn) prevBtn.style.visibility = showArrows ? 'visible' : 'hidden';
    if (nextBtn) nextBtn.style.visibility = showArrows ? 'visible' : 'hidden';
    setActiveTriggerButton(id);
  }

  function open(id) {
    if (!ensureRefs() || !panels[id]) return;
    popupEl.hidden = false;
    renderPanel(id);
  }

  function close() {
    if (!ensureRefs()) return;
    popupEl.hidden = true;
    activePanel = null;
    setActiveTriggerButton(null);
  }

  function toggle(id) {
    if (!ensureRefs() || !panels[id]) return;
    if (!popupEl.hidden && activePanel === id) { close(); return; }
    open(id);
  }

  // Rebuilds the panel's content in place, but only if it's the one on screen -
  // callers use this after data changes (a layer opened/closed, opacity moved)
  // so an already-open-but-different panel isn't disturbed.
  function refreshIfOpen(id) {
    if (!ensureRefs()) return;
    if (!popupEl.hidden && activePanel === id) renderPanel(id);
  }

  function step(delta) {
    if (!panelOrder.length) return;
    var idx = panelOrder.indexOf(activePanel);
    if (idx === -1) idx = 0;
    idx = (idx + delta + panelOrder.length) % panelOrder.length;
    renderPanel(panelOrder[idx]);
  }

  function registerPanel(id, def) {
    panels[id] = def;
    if (panelOrder.indexOf(id) === -1) panelOrder.push(id);
  }

  ag.layerPopup = {
    registerPanel: registerPanel,
    open: open,
    close: close,
    toggle: toggle,
    refreshIfOpen: refreshIfOpen
  };

  function initShell() {
    if (!ensureRefs()) return;
    if (prevBtn) prevBtn.addEventListener('click', function (e) { e.stopPropagation(); step(-1); });
    if (nextBtn) nextBtn.addEventListener('click', function (e) { e.stopPropagation(); step(1); });
  }

  // ── Draw order: reorderable list of active layers ──────────────────────────
  // Back-to-front list of layer names; last entry renders frontmost within
  // whichever pane(s) its features fall into.
  ag.drawOrder = ag.drawOrder || [];

  function syncDrawOrderWithActiveLayers() {
    var active = ag.activeLayerOrder || [];
    ag.drawOrder = ag.drawOrder.filter(function (n) { return active.indexOf(n) !== -1; });
    active.forEach(function (n) { if (ag.drawOrder.indexOf(n) === -1) ag.drawOrder.push(n); });
  }

  // A layer's rendered object is either a poly/line/point split (see
  // createLayerFromGeoJSON) or, for rasters and anything else, a single layer.
  function subLayersOf(entryLayer) {
    var subs = [];
    if (!entryLayer) return subs;
    if (entryLayer._polyLayer) subs.push(entryLayer._polyLayer);
    if (entryLayer._lineLayer) subs.push(entryLayer._lineLayer);
    if (entryLayer._vecLayer) subs.push(entryLayer._vecLayer);
    if (!subs.length) subs.push(entryLayer);
    return subs;
  }

  // Rasters (and anything else placed directly in the polygon pane without a
  // poly/line/point split) paint through their own DOM element rather than
  // the shared vector-bottom canvas, and their native bringToFront()/
  // bringToBack() (a GridLayer z-index mechanism) doesn't actually out-rank
  // that canvas either way - verified empirically, not just per Leaflet's
  // docs. So they're grouped with polygons in the UI, but reordering them
  // needs the explicit z-index handling in applyDrawOrder() below instead.
  function isRasterLikeLayer(lyr) {
    return !!(lyr && !lyr._polyLayer && !lyr._lineLayer && !lyr._vecLayer && lyr.options && lyr.options.pane === 'vector-bottom');
  }

  function findPaneCanvas(paneName) {
    var map = ag.map;
    if (!map || typeof map.getPane !== 'function') return null;
    var pane = map.getPane(paneName);
    if (!pane) return null;
    return pane.querySelector('canvas.leaflet-zoom-animated') || pane.querySelector('canvas');
  }

  function applyDrawOrder() {
    syncDrawOrderWithActiveLayers();
    // Shared running counter: both the one polygon canvas (which every vector
    // polygon layer paints through) and each raster's own container get an
    // explicit z-index from this same sequence, so they interleave correctly
    // even though they don't otherwise compete on equal terms (see
    // isRasterLikeLayer above).
    var polyZIndex = 0;
    var polyCanvas = null;
    ag.drawOrder.forEach(function (layerName) {
      var key = ag.layerKeyByName[layerName] || layerName;
      var lyr = ag.geojsonLayers && ag.geojsonLayers[key];
      if (!lyr) return;
      subLayersOf(lyr).forEach(function (sub) {
        try { if (typeof sub.bringToFront === 'function') sub.bringToFront(); } catch (e) {}
      });
      if (lyr._polyLayer) {
        polyZIndex++;
        if (!polyCanvas) polyCanvas = findPaneCanvas('vector-bottom');
        if (polyCanvas) polyCanvas.style.zIndex = polyZIndex;
      } else if (isRasterLikeLayer(lyr)) {
        polyZIndex++;
        try {
          var container = (typeof lyr.getContainer === 'function') ? lyr.getContainer() : null;
          if (container) container.style.zIndex = polyZIndex;
        } catch (e) {}
      }
    });
  }
  ag.applyDrawOrder = applyDrawOrder;

  // Whether a layer currently has a rendered sub-layer for the given tier.
  // Only meaningful once the layer has finished loading (ag.geojsonLayers[key]
  // exists) - unloaded layers report false for every tier and fall into the
  // "OTHER" group below until they finish loading and get refreshed. Rasters
  // count as "poly" tier - see isRasterLikeLayer.
  function layerHasTier(layerName, tierId) {
    var key = ag.layerKeyByName[layerName] || layerName;
    var lyr = ag.geojsonLayers && ag.geojsonLayers[key];
    if (!lyr) return false;
    if (tierId === 'point') return !!lyr._vecLayer;
    if (tierId === 'line') return !!lyr._lineLayer;
    if (tierId === 'poly') return !!lyr._polyLayer || isRasterLikeLayer(lyr);
    return false;
  }
  function layerHasAnyTier(layerName) {
    return layerHasTier(layerName, 'point') || layerHasTier(layerName, 'line') || layerHasTier(layerName, 'poly');
  }

  // Reorders a layer relative only to OTHER layers that share the same tier
  // (tierId null = the "OTHER" bucket: rasters, or layers not loaded yet).
  // Swapping within ag.drawOrder's full positions - rather than a plain
  // adjacent-index swap - is what makes this correctly skip over interleaved
  // layers of a different geometry type instead of getting stuck against them.
  function moveLayerWithinTier(layerName, tierId, delta) {
    syncDrawOrderWithActiveLayers();
    var test = tierId ? function (n) { return layerHasTier(n, tierId); } : function (n) { return !layerHasAnyTier(n); };
    var tierIndices = [];
    ag.drawOrder.forEach(function (n, idx) { if (test(n)) tierIndices.push(idx); });
    var posInTier = -1;
    for (var i = 0; i < tierIndices.length; i++) {
      if (ag.drawOrder[tierIndices[i]] === layerName) { posInTier = i; break; }
    }
    if (posInTier === -1) return;
    var targetPos = posInTier + delta;
    if (targetPos < 0 || targetPos >= tierIndices.length) return;
    var idxA = tierIndices[posInTier];
    var idxB = tierIndices[targetPos];
    var tmp = ag.drawOrder[idxA];
    ag.drawOrder[idxA] = ag.drawOrder[idxB];
    ag.drawOrder[idxB] = tmp;
    applyDrawOrder();
    refreshIfOpen('draw-order');
  }

  // Exposed so the AI assistant can move a layer without knowing about the
  // point/line/poly tier system - auto-detects the layer's own tier(s) and moves it
  // within each, same as clicking its ▲/▼ button. direction: 1 = forward, -1 = back.
  function moveLayerInDrawOrder(layerName, direction) {
    var delta = direction < 0 ? -1 : 1;
    var moved = false;
    ['point', 'line', 'poly'].forEach(function (tierId) {
      if (layerHasTier(layerName, tierId)) { moveLayerWithinTier(layerName, tierId, delta); moved = true; }
    });
    if (!moved) moveLayerWithinTier(layerName, null, delta); // rasters / still-loading layers (the "OTHER" bucket)
  }
  ag.moveLayerInDrawOrder = moveLayerInDrawOrder;

  // Front-to-back tiers, matching the pane z-index hierarchy in layer-control.js.
  var TIER_DEFS = [
    { id: 'point', label: 'POINTS' },
    { id: 'line', label: 'LINES' },
    { id: 'poly', label: 'POLYGONS' }
  ];

  function buildTierGroup(label, tierId, namesBackToFront) {
    var group = document.createElement('div');
    group.className = 'draw-order-group';

    var header = document.createElement('div');
    header.className = 'draw-order-group-header';
    header.textContent = label;
    group.appendChild(header);

    var list = document.createElement('ul');
    list.className = 'draw-order-list';

    // Displayed front-most first, like a typical layer panel; ag.drawOrder
    // itself stays back-to-front (see applyDrawOrder/bringToFront above).
    var displayNames = namesBackToFront.slice().reverse();
    displayNames.forEach(function (layerName, i) {
      var li = document.createElement('li');
      li.className = 'draw-order-item';

      var nameEl = document.createElement('span');
      nameEl.className = 'draw-order-name';
      nameEl.title = layerName;
      nameEl.textContent = layerName;

      var controls = document.createElement('div');
      controls.className = 'draw-order-controls';

      var upBtn = document.createElement('button');
      upBtn.type = 'button';
      upBtn.className = 'draw-order-arrow-btn';
      upBtn.title = 'Bring forward';
      upBtn.textContent = '▲';
      upBtn.disabled = (i === 0);
      upBtn.addEventListener('click', function () { moveLayerWithinTier(layerName, tierId, 1); });

      var downBtn = document.createElement('button');
      downBtn.type = 'button';
      downBtn.className = 'draw-order-arrow-btn';
      downBtn.title = 'Send backward';
      downBtn.textContent = '▼';
      downBtn.disabled = (i === displayNames.length - 1);
      downBtn.addEventListener('click', function () { moveLayerWithinTier(layerName, tierId, -1); });

      controls.appendChild(upBtn);
      controls.appendChild(downBtn);
      li.appendChild(nameEl);
      li.appendChild(controls);
      list.appendChild(li);
    });
    group.appendChild(list);
    return group;
  }

  function renderDrawOrderPanel(container) {
    syncDrawOrderWithActiveLayers();
    if (!ag.drawOrder.length) {
      var empty = document.createElement('div');
      empty.className = 'layer-popup-empty';
      empty.textContent = 'No active layers';
      container.appendChild(empty);
      return;
    }

    var hint = document.createElement('div');
    hint.className = 'draw-order-hint';
    hint.textContent = 'Reordering only applies within the same shape type - points always draw above lines, which always draw above polygons.';
    container.appendChild(hint);

    var renderedAny = false;
    TIER_DEFS.forEach(function (tier) {
      var namesBackToFront = ag.drawOrder.filter(function (n) { return layerHasTier(n, tier.id); });
      if (!namesBackToFront.length) return;
      renderedAny = true;
      container.appendChild(buildTierGroup(tier.label, tier.id, namesBackToFront));
    });

    // Rasters, or layers still loading (no sub-layer determined yet).
    var otherNames = ag.drawOrder.filter(function (n) { return !layerHasAnyTier(n); });
    if (otherNames.length) {
      renderedAny = true;
      container.appendChild(buildTierGroup('OTHER', null, otherNames));
    }

    if (!renderedAny) {
      var loading = document.createElement('div');
      loading.className = 'layer-popup-empty';
      loading.textContent = 'Loading layers…';
      container.appendChild(loading);
    }
  }

  function initDrawOrderButton() {
    var btn = document.getElementById('drawOrderBtn');
    if (!btn) return;

    registerPanel('draw-order', { label: 'DRAW ORDER', render: renderDrawOrderPanel });

    btn.classList.add('layer-popup-trigger');
    btn.dataset.panel = 'draw-order';
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      toggle('draw-order');
    });
  }

  // A layer's Leaflet object is only set once its data finishes loading
  // (asynchronously), so poll briefly rather than assuming it exists the
  // instant its checkbox is checked.
  function waitForLayerObject(key, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var waited = 0, interval = 150;
      (function poll() {
        var lyr = ag.geojsonLayers && ag.geojsonLayers[key];
        if (lyr) { resolve(lyr); return; }
        waited += interval;
        if (waited >= timeoutMs) { reject(new Error('timeout')); return; }
        setTimeout(poll, interval);
      })();
    });
  }

  // Keeps ag.drawOrder in sync with every layer toggle, from any source
  // (sidebar checkbox or the dataset-search widget both dispatch a real
  // 'change' event on the checkbox), without needing layer-control.js itself
  // to know draw-order.js exists.
  function initChangeWatcher() {
    document.addEventListener('change', function (e) {
      var cb = e.target;
      if (!cb || cb.tagName !== 'INPUT' || cb.type !== 'checkbox' || !cb.dataset || !cb.dataset.layername) return;
      var layerName = cb.dataset.layername;
      if (cb.checked) {
        var key = cb.dataset.filename || layerName;
        waitForLayerObject(key, 20000).then(function () {
          applyDrawOrder();
          refreshIfOpen('draw-order');
        }).catch(function () {});
      } else {
        applyDrawOrder();
        refreshIfOpen('draw-order');
      }
    });
  }

  function init() {
    initShell();
    initDrawOrderButton();
    initChangeWatcher();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
