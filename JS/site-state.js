(function () {
  // Loads data/site-state.json (written by the admin dashboard) once per page.
  // window.AthensGIS.siteStateReady resolves to the parsed state object, or to
  // null when the request fails, the body is not valid JSON, the state has no
  // version 1, or nothing arrives within 3 seconds. It never rejects.
  //
  // It also holds the helpers that hide the layers the admin dashboard switched off
  // (state.inactiveLayers, a list of layer keys): layerKey, inactiveLayerSet and
  // filterLayerCategories. JS/layer-control.js sets AthensGIS.layersReady.
  var TIMEOUT_MS = 3000;

  var AthensGIS = window.AthensGIS = window.AthensGIS || {};

  function stateUrl() {
    var cfg = window.CONFIG || {};
    if (cfg.SITE_STATE_URL) return cfg.SITE_STATE_URL;
    return (cfg.R2_BASE_URL || '') + '/data/site-state.json';
  }

  AthensGIS.siteStateReady = new Promise(function (resolve) {
    var settled = false;
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = null;

    function finish(value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }

    timer = setTimeout(function () {
      finish(null);
      if (controller) controller.abort();
    }, TIMEOUT_MS);

    try {
      var options = { cache: 'no-cache' };
      if (controller) options.signal = controller.signal;

      fetch(stateUrl(), options)
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.json();
        })
        .then(function (state) {
          var valid = state && typeof state === 'object' && state.version === 1;
          finish(valid ? state : null);
        })
        .catch(function () {
          finish(null);
        });
    } catch (err) {
      finish(null);
    }
  });

  // A layer is identified by its original data file: geojson when it has one, else file
  // (paths relative to data/, e.g. 'Transportation/AICameras.json').
  AthensGIS.layerKey = function (layer) {
    return (layer && (layer.geojson || layer.file)) || '';
  };

  // The state's inactiveLayers as an object (key -> true); empty when there is no state.
  AthensGIS.inactiveLayerSet = function (state) {
    var set = {};
    var list = state && Array.isArray(state.inactiveLayers) ? state.inactiveLayers : [];
    for (var i = 0; i < list.length; i++) {
      if (typeof list[i] === 'string' && list[i]) set[list[i]] = true;
    }
    return set;
  };

  // Removes inactive layers, in place, from every _items and subcategory array of
  // layerCategories ({ Category: { _items: [...], 'Subcategory': [...] } }), deletes the
  // subcategories left empty and the categories left with no layers, and returns the same
  // object. inactiveKeys is the object from inactiveLayerSet (an array of keys also works).
  AthensGIS.filterLayerCategories = function (categories, inactiveKeys) {
    var inactive = inactiveKeys || {};
    if (Array.isArray(inactive)) inactive = AthensGIS.inactiveLayerSet({ inactiveLayers: inactive });
    if (!categories || typeof categories !== 'object') return categories;

    function isActive(layer) {
      var key = AthensGIS.layerKey(layer);
      return !(key && Object.prototype.hasOwnProperty.call(inactive, key));
    }
    function prune(list) {
      for (var i = list.length - 1; i >= 0; i--) {
        if (!isActive(list[i])) list.splice(i, 1);
      }
      return list.length;
    }

    Object.keys(categories).forEach(function (name) {
      var data = categories[name];
      if (Array.isArray(data)) {
        if (!prune(data)) delete categories[name];
        return;
      }
      if (!data || typeof data !== 'object') return;
      var remaining = 0;
      Object.keys(data).forEach(function (key) {
        if (!Array.isArray(data[key])) return;
        if (prune(data[key])) remaining += data[key].length;
        else delete data[key];
      });
      if (!remaining) delete categories[name];
    });
    return categories;
  };
})();
