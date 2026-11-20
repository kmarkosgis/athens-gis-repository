// Attribute names: the names the attribute table of a clicked feature shows for its fields, and how
// a number in a field is rounded. AthensGIS.attributeName(layerKey, field, value) gives { label, value }.
//
// The list below is the built-in list: what the site showed before the names moved to the admin
// dashboard. The dashboard's file (data/attribute-names.json) REPLACES it, it is not merged with it, so
// a name removed in the dashboard is really gone, even the last one: a valid file with no entries is used,
// and every field then shows under its own name. A missing, invalid or late (3 s) file leaves the
// built-in list, and so does a file that has entries of which none can be used.
// AthensGIS.attributeNamesReady never rejects: it resolves true (file used) or false
// (built-in list kept). The layer panel does not wait for it: the table is built on a click, long after
// the file has arrived, and a click that comes first simply uses the built-in list.
//
// The dashboard's download rewrites the object assigned to AthensGIS.builtInAttributeNames below: it
// finds that line and the balanced { } after it. That object must stay a plain JSON object literal
// (double-quoted keys, no comments, no trailing commas, nothing computed), and that line must stay the
// only one that assigns it.
window.AthensGIS = window.AthensGIS || {};

AthensGIS.builtInAttributeNames = {
  "names": {
    "shapeleng_": {
      "label": "Shape Length (km)",
      "decimals": 2
    },
    "shapearea": {
      "label": "Shape Area (km²)",
      "decimals": 4
    },
    "shapeleng_m": {
      "label": "Shape Length (m)",
      "decimals": 2
    },
    "shapelengm": {
      "label": "Shape Length (m)",
      "decimals": 2
    },
    "length": {
      "label": "Shape Length (m)",
      "decimals": 2
    },
    "shape_leng": {
      "label": "Shape Length (m)",
      "decimals": 2
    },
    "distance_meters": {
      "label": "Shape Length (m)",
      "decimals": 2
    },
    "shapearea_m": {
      "label": "Shape Area (m²)",
      "decimals": 2
    },
    "shapeaream": {
      "label": "Shape Area (m²)",
      "decimals": 2
    },
    "name": {
      "label": "Name (GR)"
    },
    "name_el": {
      "label": "Name (GR)"
    },
    "name_place": {
      "label": "Name (GR)"
    },
    "gname": {
      "label": "Name (GR)"
    },
    "uses_gr": {
      "label": "Name (GR)"
    },
    "descr": {
      "label": "Name (GR)"
    },
    "ονομα": {
      "label": "Name (GR)"
    },
    "ename": {
      "label": "Name (ENG)"
    },
    "name_pl_en": {
      "label": "Name (ENG)"
    },
    "name_en": {
      "label": "Name (ENG)"
    },
    "uses_en": {
      "label": "Name (ENG)"
    },
    "name:en": {
      "label": "Name (ENG)"
    },
    "class_2021": {
      "label": "Name (ENG)"
    },
    "descr_eng": {
      "label": "Name (ENG)"
    },
    "address": {
      "label": "Address"
    },
    "bridge": {
      "label": "Bridge"
    },
    "tunnel": {
      "label": "Tunnel"
    },
    "ref": {
      "label": "Route"
    },
    "line_id": {
      "label": "Route"
    },
    "operator": {
      "label": "Operator"
    },
    "owner": {
      "label": "Owner"
    },
    "charge": {
      "label": "Toll Charge"
    },
    "int_ref": {
      "label": "International Route"
    },
    "geitonia": {
      "label": "Neighborhood (GR)"
    },
    "city": {
      "label": "Neighborhood (GR)"
    },
    "geiton_en": {
      "label": "Neighborhood (ENG)"
    },
    "dk": {
      "label": "Municipal Community (GR)"
    },
    "attica_municipal_unit": {
      "label": "Municipal Community (GR)"
    },
    "dk_en": {
      "label": "Municipal Community (ENG)"
    },
    "sectionnam": {
      "label": "Section Name"
    },
    "attica_section": {
      "label": "Section Name"
    },
    "postal_code": {
      "label": "Postal Code"
    },
    "country": {
      "label": "Country"
    },
    "metroline": {
      "label": "Metro Line"
    },
    "highway": {
      "label": "Type"
    },
    "historic": {
      "label": "Type"
    },
    "amenity": {
      "label": "Type"
    },
    "shop": {
      "label": "Type"
    },
    "τύπος": {
      "label": "Type"
    },
    "oneway": {
      "label": "One-Way Road"
    },
    "surface": {
      "label": "Surface Type"
    },
    "fid": {
      "label": "Feature ID"
    },
    "objectid": {
      "label": "Feature ID"
    },
    "full_id": {
      "label": "Feature ID"
    },
    "code_2021": {
      "label": "Reference Code"
    },
    "code_18": {
      "label": "Reference Code"
    },
    "popul2011": {
      "label": "Population"
    },
    "wt": {
      "label": "Wind Turbine"
    },
    "power_anem": {
      "label": "Power (MW)"
    },
    "max_power": {
      "label": "Max Power (MW)"
    },
    "diametros_": {
      "label": "Diameter (m)"
    },
    "ypsos_pylo": {
      "label": "Height (m)"
    },
    "evse_count": {
      "label": "EVSE Count"
    },
    "connector_count": {
      "label": "Connector Count"
    },
    "max_power_kw": {
      "label": "Max Power (KW)"
    },
    "initialdat": {
      "label": "Initial Date"
    },
    "finaldate": {
      "label": "Final Date"
    },
    "stop_id": {
      "label": "Stop ID"
    },
    "route_ref": {
      "label": "Bus Route"
    },
    "rwb_id": {
      "label": "River/Stream ID"
    },
    "basinid_fd": {
      "label": "Basin ID"
    },
    "mag": {
      "label": "Magnitude",
      "decimals": 1
    },
    "place": {
      "label": "Place"
    },
    "leisure": {
      "label": "Public space type"
    },
    "period": {
      "label": "Return Period (years)"
    },
    "twentyfourseven": {
      "label": "24/7 Access"
    },
    "desc": {
      "label": "Species"
    },
    "species": {
      "label": "Species"
    },
    "genus": {
      "label": "Species"
    },
    "family": {
      "label": "Species"
    },
    "taxon": {
      "label": "Species"
    },
    "leaf_type": {
      "label": "Leaf type"
    },
    "leaf_cycle": {
      "label": "Leaf type"
    },
    "κωδι_1": {
      "label": "Code"
    },
    "επιπέ": {
      "label": "Education Level"
    },
    "νομός": {
      "label": "Regional Unit (GR)"
    },
    "δήμος": {
      "label": "Municipality (GR)"
    }
  },
  "layers": {}
};

(function () {
  var TIMEOUT_MS = 3000;
  var SAFETY_MS = 10000;
  var MAX_LABEL = 100;
  var MAX_DECIMALS = 6;
  var has = Object.prototype.hasOwnProperty;
  var AthensGIS = window.AthensGIS;
  var loaded = null; // { names, layers } from the file, once it has arrived and been accepted

  function isObject(v) { return v !== null && typeof v === 'object' && !Array.isArray(v); }
  function hasKeys(o) { return Object.keys(o).length > 0; }
  function isDecimals(d) { return typeof d === 'number' && isFinite(d) && Math.floor(d) === d && d >= 0 && d <= MAX_DECIMALS; }

  // One entry { label, decimals? } -> a clean copy, or null when it is not usable.
  function cleanEntry(entry) {
    if (!isObject(entry) || typeof entry.label !== 'string') return null;
    var label = entry.label.trim();
    if (label === '' || label.length > MAX_LABEL) return null;
    var out = { label: label };
    if (entry.decimals !== undefined) {
      if (!isDecimals(entry.decimals)) return null;
      out.decimals = entry.decimals;
    }
    return out;
  }

  // One list of entries (the main list, or one layer's exceptions) -> field name (lower-cased) -> entry.
  // Entries that are not usable are skipped one by one; when two names are the same once lower-cased,
  // the first one wins. A field called __proto__ is never kept.
  function cleanList(list) {
    var out = {};
    if (!isObject(list)) return out;
    var keys = Object.keys(list);
    for (var i = 0; i < keys.length; i++) {
      var field = keys[i].toLowerCase();
      if (field === '__proto__' || has.call(out, field)) continue;
      var entry = cleanEntry(list[keys[i]]);
      if (entry) out[field] = entry;
    }
    return out;
  }

  // The file -> { names, layers } for a valid file (version 1, names an object), skipping any entry
  // the site cannot use; null for anything else, and for a file that has entries of which none can be
  // used (a wrong file: the built-in list then stays). A valid file with no entries at all (names empty,
  // layers missing or empty) is an owner who removed every name: it is used, as { names: {}, layers: {} }.
  // Field names are lower-cased, layer keys are kept as they are, and a missing layers counts as none.
  // Same rules as the dashboard's public/js/lib/attribute-format.js.
  AthensGIS.attributeNamesFromFile = function (file) {
    try {
      if (!isObject(file) || file.version !== 1 || !isObject(file.names)) return null;
      var hadEntries = hasKeys(file.names);
      var names = cleanList(file.names);
      var layers = {};
      if (isObject(file.layers)) {
        var keys = Object.keys(file.layers);
        if (keys.length > 0) hadEntries = true;
        for (var i = 0; i < keys.length; i++) {
          if (keys[i] === '__proto__') continue;
          var entries = cleanList(file.layers[keys[i]]);
          if (hasKeys(entries)) layers[keys[i]] = entries;
        }
      }
      if (hadEntries && !hasKeys(names) && !hasKeys(layers)) return null;
      return { names: names, layers: layers };
    } catch (err) {
      return null;
    }
  };

  // Rounds to the given decimals, as text. Only a finite number, or a non-empty string that converts
  // to one, is rounded; anything else (empty, text, true, an array) comes back as it is.
  function round(value, decimals) {
    if (!isDecimals(decimals)) return value;
    var n;
    if (typeof value === 'number') n = value;
    else if (typeof value === 'string' && value.trim() !== '') n = Number(value);
    else return value;
    return isFinite(n) ? n.toFixed(decimals) : value;
  }

  // The shown name and value of one field: the layer's exception first, then the main list, then the
  // field's own name with the value unchanged. Uses the file once it has arrived, else the built-in
  // list. Lookups use own properties only, so a field called "constructor" or "toString" finds nothing.
  AthensGIS.attributeName = function (layerKey, field, value) {
    var list = loaded || AthensGIS.builtInAttributeNames;
    var key = String(field).toLowerCase();
    var entry = null;
    if (isObject(list)) {
      // A null layer key must not look up a layer called "null".
      if (layerKey !== null && layerKey !== undefined && isObject(list.layers) && has.call(list.layers, layerKey)) {
        var layer = list.layers[layerKey];
        if (isObject(layer) && has.call(layer, key)) entry = layer[key];
      }
      if (!entry && isObject(list.names) && has.call(list.names, key)) entry = list.names[key];
    }
    if (!entry) return { label: String(field), value: value };
    return { label: entry.label, value: round(value, entry.decimals) };
  };

  function attributeNamesUrl() {
    var cfg = window.CONFIG || {};
    if (cfg.ATTRIBUTE_NAMES_URL) return cfg.ATTRIBUTE_NAMES_URL;
    return (cfg.R2_BASE_URL || '') + '/data/attribute-names.json';
  }

  // Without Promise there is nothing to build a real promise from: a minimal thenable that says false.
  function resolvedFalse() {
    if (typeof Promise === 'function') return Promise.resolve(false);
    return { then: function (done) { if (typeof done === 'function') { try { done(false); } catch (err) { /* ignore */ } } } };
  }

  function makeReady() {
    if (typeof Promise !== 'function' || typeof fetch !== 'function') return resolvedFalse();
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
          finish(false);
          try { if (controller) controller.abort(); } catch (err) { /* ignore */ }
        }, TIMEOUT_MS);
        try {
          var options = { cache: 'no-cache' };
          if (typeof AbortController === 'function') {
            controller = new AbortController();
            options.signal = controller.signal;
          }
          fetch(attributeNamesUrl(), options)
            .then(function (response) {
              if (!response.ok) throw new Error('HTTP ' + response.status);
              return response.json();
            })
            .then(function (file) {
              if (settled) return; // arrived after the timeout: the built-in list stays
              var list = AthensGIS.attributeNamesFromFile(file);
              if (list) loaded = list;
              finish(!!list);
            })
            .catch(function () { finish(false); });
        } catch (err) {
          finish(false);
        }
      }

      // Fallback for a cached older page that still loads this script before config.js (all deferred,
      // in page order): CONFIG may not exist yet.
      // Then wait until every deferred script has run (DOMContentLoaded; load as a second chance),
      // and give up after SAFETY_MS so nothing can wait for ever.
      var doc = window.document;
      if (window.CONFIG || !doc || typeof doc.addEventListener !== 'function' || doc.readyState === 'complete') {
        start();
      } else {
        safety = setTimeout(function () { finish(false); }, SAFETY_MS);
        doc.addEventListener('DOMContentLoaded', start);
        if (typeof window.addEventListener === 'function') window.addEventListener('load', start);
      }
    });
  }

  try {
    AthensGIS.attributeNamesReady = makeReady();
  } catch (err) {
    AthensGIS.attributeNamesReady = resolvedFalse();
  }
})();
