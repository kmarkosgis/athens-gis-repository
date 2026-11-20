// Layer list: the layers the map offers are listed in a file the admin dashboard writes (data/layers.json).
// This script fetches it and checks it, and layer-control.js then uses it in place of the list it carries in
// its own code (var layerCategories there), which stays as the backup.
//
//   AthensGIS.layerListFromFile(file)   the list in the shape layer-control.js builds its panel from,
//                                       { Category: { _items: [layer], Subcategory: [layer] } } in file order,
//                                       or null unless the WHOLE file passes. A file with one bad entry is
//                                       refused as a whole: half a list would hide layers without a word.
//   AthensGIS.replaceLayerCategories(target, next)
//                                       empties target and fills it with next's keys in order; it is the same
//                                       object afterwards, so everything that holds it sees the new list.
//   AthensGIS.layerListReady            a promise that gives the list, or null (no file, a file that fails the
//                                       checks, or nothing within 3 s). It never rejects.
//   AthensGIS.layerIdOf(name)           the id the page gives a layer's checkbox (the trimmed name with each run of
//                                       white space as one underscore); two layers may not share one.
//
// The rules in layerListFromFile are the same as validateLayerList in the dashboard's
// public/js/lib/layer-list-format.js, written again here because this script is plain ES5 and cannot import
// it. A test (test/node/site-layer-list.test.js) runs both over the same files, so keep the two together.
(function () {
  var TIMEOUT_MS = 3000;
  var SAFETY_MS = 10000;
  var MAX_LAYERS = 500;
  var MAX_CATEGORIES = 60;
  var MAX_NAME = 100;
  var has = Object.prototype.hasOwnProperty;
  var AthensGIS = window.AthensGIS = window.AthensGIS || {};

  function isObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  // Own properties only: a file is data, so a name such as "constructor" must never find a method.
  function own(obj, key) { return has.call(obj, key) ? obj[key] : undefined; }
  // Sets an own property even for the name __proto__, which a plain assignment would take for the prototype.
  function setOwn(obj, key, value) {
    Object.defineProperty(obj, key, { value: value, writable: true, enumerable: true, configurable: true });
  }

  // The form a name is compared in: trimmed, runs of spaces as one, lower-cased.
  function nameKey(name) { return String(name).trim().replace(/\s+/g, ' ').toLowerCase(); }

  // The id layer-control.js gives a layer's checkbox, and that JS/dataset-search.js finds a layer by: the trimmed name
  // with each run of white space as one underscore (case is kept: ids are case-sensitive). Two layers whose ids are
  // equal cannot both be on the page, so the file is refused for them.
  function layerIdOf(name) { return String(name).trim().replace(/\s+/g, '_'); }
  AthensGIS.layerIdOf = layerIdOf;

  // The ids layer-control.js gives its two fixed layers, Terrain and Shaded Relief, which it draws outside the list: a
  // layer in the list may not have either. The same as FIXED_LAYER_IDS in the dashboard's
  // public/js/lib/layer-list-format.js (a test compares the two, id for id).
  var FIXED_LAYER_IDS = ['Terrain', 'Shaded_Relief'];

  // Sets of names and keys. The entries are stored under "#" + the text, so a name such as __proto__ or
  // constructor is an ordinary entry and never reaches the object's own machinery.
  function remembers(set, text) { return has.call(set, '#' + text); }
  function remember(set, text) { set['#' + text] = true; }

  // The layer names that are refused because every plain object already has a property of that name. The site looks a
  // layer up by its name on plain objects (window.legendConfigs[name], window.layerFilterConfigs[name]), so a layer
  // with one of these names would look as if it had a legend and a filter. Only these exact names are refused (case
  // matters, the lookups are exact). Category and subcategory names are read with own-property loops and may be
  // named like this.
  // A fixed list, the same as RESERVED_LAYER_NAMES in the dashboard's public/js/lib/layer-list-format.js (a test
  // compares the two, name for name). It is not read from Object.prototype: browsers differ in what that carries and a
  // page script can add to it, and a name refused here but not by the dashboard would silently leave a visitor with
  // the old list.
  var RESERVED_LAYER_NAMES = [
    'constructor',
    '__proto__',
    'hasOwnProperty',
    'isPrototypeOf',
    'propertyIsEnumerable',
    'toLocaleString',
    'toString',
    'valueOf',
    '__defineGetter__',
    '__defineSetter__',
    '__lookupGetter__',
    '__lookupSetter__'
  ];

  // A category or subcategory name: text of 1 to 100 characters once trimmed, not _items, not __proto__ and not
  // only digits (_items is the category's own layers, and a name of digits would jump to the front of the object).
  function isGroupName(name) {
    if (typeof name !== 'string') return false;
    var t = name.trim();
    if (t.length < 1 || t.length > MAX_NAME) return false;
    if (t === '_items' || t === '__proto__') return false;
    return !/^[0-9]+$/.test(t);
  }

  var SEGMENT_RE = /^[A-Za-z0-9 _.()-]+$/;
  var EXTENSION_RE = /\.(geojson|json|pmtiles|tif)$/i;

  // A layer key: a clean path relative to data/ (written without the data/ prefix) to a layer file.
  function isKey(path) {
    if (typeof path !== 'string' || path.indexOf('data/') === 0 || !EXTENSION_RE.test(path)) return false;
    var segments = path.split('/');
    for (var i = 0; i < segments.length; i++) {
      var segment = segments[i];
      if (segment === '' || segment.charAt(0) === '.' || !SEGMENT_RE.test(segment)) return false;
    }
    return true;
  }

  // The number of layers, counted without trusting the shape, so a file past the limit is refused before the walk.
  function countLayers(categories) {
    var total = 0;
    for (var ci = 0; ci < categories.length; ci++) {
      var groups = isObject(categories[ci]) ? own(categories[ci], 'groups') : undefined;
      if (!Array.isArray(groups)) continue;
      for (var gi = 0; gi < groups.length; gi++) {
        var layers = isObject(groups[gi]) ? own(groups[gi], 'layers') : undefined;
        if (Array.isArray(layers)) total += layers.length;
      }
    }
    return total;
  }

  // One layer -> the layer as the panel wants it (name, file, geojson, geom, type "raster"; anything else the
  // file carries is dropped), or null. Records its name and key in the sets shared by the whole file.
  function cleanLayer(raw, names, ids, keys) {
    if (!isObject(raw)) return null;
    var rawName = own(raw, 'name');
    var name = typeof rawName === 'string' ? rawName.trim() : '';
    if (name.length < 1 || name.length > MAX_NAME) return null;
    if (RESERVED_LAYER_NAMES.indexOf(name) !== -1) return null;
    if (FIXED_LAYER_IDS.indexOf(layerIdOf(name)) !== -1) return null;
    if (remembers(names, nameKey(name))) return null;
    if (remembers(ids, layerIdOf(name))) return null;
    remember(names, nameKey(name));
    remember(ids, layerIdOf(name));

    var isRaster = own(raw, 'type') === 'raster';
    var file = own(raw, 'file');
    var geojson = own(raw, 'geojson');
    var geom = own(raw, 'geom');

    if (!isKey(file)) return null;
    // null counts as present: a geojson of null is a fault, not a layer without one.
    if (geojson !== undefined) {
      if (isRaster || !isKey(geojson) || !/\.pmtiles$/i.test(file)) return null;
    }
    if (isRaster) {
      if (geom !== undefined) return null;
    } else if (geom !== 'point' && geom !== 'line' && geom !== 'polygon') {
      return null;
    }

    // The layer's key is its geojson, else its file.
    var key = geojson === undefined ? file : geojson;
    if (remembers(keys, key)) return null;
    remember(keys, key);

    var out = { name: name, file: file };
    if (geojson !== undefined) out.geojson = geojson;
    if (isRaster) out.type = 'raster';
    else out.geom = geom;
    return out;
  }

  // Checks the whole file { version: 1, updatedAt, categories: [{ name, groups: [{ name | null, layers }] }] }
  // and returns the site's object, or null at the first fault. Same result as toSiteShape(validateLayerList(file).value)
  // in the dashboard's public/js/lib/layer-list-format.js, and null where its validateLayerList refuses the file.
  AthensGIS.layerListFromFile = function (file) {
    try {
      if (!isObject(file) || own(file, 'version') !== 1) return null;
      var categories = own(file, 'categories');
      if (!Array.isArray(categories) || categories.length === 0 || categories.length > MAX_CATEGORIES) return null;
      if (countLayers(categories) > MAX_LAYERS) return null;

      var categoryNames = {};
      var layerNames = {};
      var layerIds = {};
      var layerKeys = {};
      var list = {};

      for (var ci = 0; ci < categories.length; ci++) {
        var category = categories[ci];
        if (!isObject(category)) return null;
        var categoryName = own(category, 'name');
        if (!isGroupName(categoryName) || remembers(categoryNames, nameKey(categoryName))) return null;
        remember(categoryNames, nameKey(categoryName));

        var groups = own(category, 'groups');
        if (!Array.isArray(groups) || groups.length === 0) return null;

        var groupNames = {};
        var hasOwnLayers = false;
        var shaped = {};
        for (var gi = 0; gi < groups.length; gi++) {
          var group = groups[gi];
          if (!isObject(group)) return null;
          var groupName = own(group, 'name');
          var shapedName;
          if (groupName === null) {
            // Only one group can have no name: the category's own layers.
            if (hasOwnLayers) return null;
            hasOwnLayers = true;
            shapedName = '_items';
          } else {
            if (!isGroupName(groupName) || remembers(groupNames, nameKey(groupName))) return null;
            remember(groupNames, nameKey(groupName));
            shapedName = groupName.trim();
          }

          var layers = own(group, 'layers');
          if (!Array.isArray(layers) || layers.length === 0) return null;
          var cleaned = [];
          for (var li = 0; li < layers.length; li++) {
            var layer = cleanLayer(layers[li], layerNames, layerIds, layerKeys);
            if (!layer) return null;
            cleaned.push(layer);
          }
          setOwn(shaped, shapedName, cleaned);
        }
        setOwn(list, categoryName.trim(), shaped);
      }
      return list;
    } catch (err) {
      return null;
    }
  };

  // Empties target (every own key) and puts next's keys into it in next's order; target stays the same object,
  // which layer-control.js keeps as var layerCategories and as AthensGIS.layerCategories. Anything that is not an
  // object leaves target as it is, so a bad call can never empty the list.
  AthensGIS.replaceLayerCategories = function (target, next) {
    if (!isObject(target) || !isObject(next)) return target;
    var old = Object.keys(target);
    var i;
    for (i = 0; i < old.length; i++) delete target[old[i]];
    var keys = Object.keys(next);
    for (i = 0; i < keys.length; i++) setOwn(target, keys[i], next[keys[i]]);
    return target;
  };

  function layerListUrl() {
    var cfg = window.CONFIG || {};
    if (cfg.LAYER_LIST_URL) return cfg.LAYER_LIST_URL;
    return (cfg.R2_BASE_URL || '') + '/data/layers.json';
  }

  // Without Promise there is nothing to build a real promise from: a minimal thenable that says null.
  function resolvedNull() {
    if (typeof Promise === 'function') return Promise.resolve(null);
    return { then: function (done) { if (typeof done === 'function') { try { done(null); } catch (err) { /* ignore */ } } } };
  }

  function makeReady() {
    if (typeof Promise !== 'function' || typeof fetch !== 'function') return resolvedNull();
    return new Promise(function (resolve) {
      var settled = false;
      var started = false;
      var controller = null;
      var timer = null;
      var safety = null;

      function finish(value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearTimeout(safety);
        resolve(value);
      }

      function start() {
        if (started || settled) return;
        started = true;
        timer = setTimeout(function () {
          finish(null);
          try { if (controller) controller.abort(); } catch (err) { /* ignore */ }
        }, TIMEOUT_MS);
        try {
          var options = { cache: 'no-cache' };
          if (typeof AbortController === 'function') {
            controller = new AbortController();
            options.signal = controller.signal;
          }
          fetch(layerListUrl(), options)
            .then(function (response) {
              if (!response.ok) throw new Error('HTTP ' + response.status);
              return response.json();
            })
            .then(function (file) {
              if (settled) return; // arrived after the timeout: the list in layer-control.js stays
              finish(AthensGIS.layerListFromFile(file));
            })
            .catch(function () { finish(null); });
        } catch (err) {
          finish(null);
        }
      }

      // Fallback for a cached older page that still loads this script before config.js (all deferred,
      // in page order): CONFIG may not exist yet.
      // Then wait until every deferred script has run (DOMContentLoaded; load as a second chance),
      // and give up after SAFETY_MS so the layer panel can never wait for ever.
      var doc = window.document;
      if (window.CONFIG || !doc || typeof doc.addEventListener !== 'function' || doc.readyState === 'complete') {
        start();
      } else {
        safety = setTimeout(function () { finish(null); }, SAFETY_MS);
        doc.addEventListener('DOMContentLoaded', start);
        if (typeof window.addEventListener === 'function') window.addEventListener('load', start);
      }
    });
  }

  try {
    AthensGIS.layerListReady = makeReady();
  } catch (err) {
    AthensGIS.layerListReady = resolvedNull();
  }
})();
