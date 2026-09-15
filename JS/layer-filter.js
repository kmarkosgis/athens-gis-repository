// === Layer Feature Filter Module ===
// Controls a per-layer dropdown that lets the user show only features matching
// a specific attribute value.
//
// To add filtering to a new layer, add an entry to window.layerFilterConfigs:
//
//   "Layer Name": {
//     filterField:   "propertyName",          // GeoJSON property used to filter features
//     displayFields: ["fieldA", "fieldB"],    // properties shown in each dropdown item
//     separator:     " – "                    // joins displayFields (default: " – ")
//   }

(function () {

  // ── Config ───────────────────────────────────────────────────────────────────
  window.layerFilterConfigs = window.layerFilterConfigs || {};

  Object.assign(window.layerFilterConfigs, {
    "OASA Bus Routes": {
      filterField:   "line_id",
      displayFields: ["line_id", "descr"],
      separator:     " – "
    },
    "Wildfires Attica 2015-2025": {
      filterField:   "Year",
      displayFields: ["Year"],
      separator:     " – "
    }
  });

  // ── Module state ─────────────────────────────────────────────────────────────
  // _refs[layerName] = { btn, dropdown, file, cfg }
  var _refs = {};

  // ── Public API ───────────────────────────────────────────────────────────────
  window.LayerFilter = {
    getConfig:     getConfig,
    buildButton:   buildButton,
    onLayerLoaded: onLayerLoaded,
    onLayerRemoved: onLayerRemoved,
    applyByValue:  applyByValue
  };

  // Exposed so the AI assistant can apply a filter without a real dropdown click -
  // reuses _pickItem so the button label/selected state stay in sync with a real
  // click. value=null (or omitted) clears the filter, same as picking "All features".
  // Returns false if this layer was never given a filter config, or its row/dropdown
  // haven't been built yet (layer not present in the current manifest UI).
  function applyByValue(layerName, value) {
    var ref = _refs[layerName];
    var cfg = getConfig(layerName);
    if (!ref || !cfg) return false;
    _pickItem(layerName, ref.file, ref.dropdown, ref.btn, cfg, value == null || value === '' ? '__all__' : String(value));
    return true;
  }

  function getConfig(layerName) {
    return (window.layerFilterConfigs || {})[layerName] || null;
  }

  // Creates the "Filter" button and its floating dropdown, attaches them
  // to the layer row's actions container. Called from createLayerRow.
  function buildButton(layerName, file, row, actions) {
    var cfg = getConfig(layerName);
    if (!cfg) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'filter-button';
    btn.textContent = 'FILTER';
    btn.title = 'Filter layer features by attribute';
    btn.disabled = true;

    // Dropdown is appended to body so it escapes overflow:hidden on layer panel
    var dropdown = document.createElement('div');
    dropdown.className = 'layer-filter-dropdown';
    document.body.appendChild(dropdown);

    // Close button — only visible in mobile view (see style.css)
    var closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'filter-dropdown-close';
    closeBtn.setAttribute('aria-label', 'Close filter list');
    closeBtn.textContent = '✕';
    closeBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      _closeAll();
    });
    dropdown.appendChild(closeBtn);

    // "All" option is always first
    _appendItem(dropdown, '__all__', 'All features', true);

    btn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      var isOpen = dropdown.classList.contains('open');
      _closeAll();
      if (!isOpen) _positionAndOpen(dropdown, btn);
    });

    dropdown.addEventListener('click', function (e) {
      var item = e.target.closest('.filter-dropdown-item');
      if (!item) return;
      _pickItem(layerName, file, dropdown, btn, cfg, item.dataset.value);
    });

    // Store ref for later use (populate, reset)
    _refs[layerName] = { btn: btn, dropdown: dropdown, file: file, cfg: cfg };
    row._filterDropdown = dropdown;

    actions.appendChild(btn);
  }

  // Populates dropdown options from loaded GeoJSON data. Called after the layer's
  // fetch resolves. `geojsonPath` is only passed for pmtiles-backed layers (see
  // JS/layer-control.js's checkbox handler) - `data` is null there, since rendering
  // never fetches the full dataset for those; options come from the precomputed
  // manifest instead (tools/build-pmtiles.mjs).
  function onLayerLoaded(layerName, file, data, geojsonPath) {
    var ref = _refs[layerName];
    if (!ref) return;
    ref.file = file;

    if (!data && typeof isPmtilesFile === 'function' && isPmtilesFile(file)) {
      _populateFilterOptionsPmtiles(layerName, file, geojsonPath);
      return;
    }

    _renderFilterOptions(ref, computeFilterOptions((data && data.features) || [], ref.cfg));
  }

  // Distinct filterField values + display labels for a filter dropdown - dedupe by
  // value, sort numerically when possible (else alphabetically), join displayFields
  // for the label. Shared by the plain-layer path above (full feature array already
  // in hand) and the pmtiles fallback below (same computation, run over whatever
  // feature array it ends up with) - and mirrors tools/build-pmtiles.mjs's
  // computeFilterOptions(), which precomputes the same thing offline.
  function computeFilterOptions(features, cfg) {
    var seen = Object.create(null);
    var items = [];
    (features || []).forEach(function (f) {
      var props = (f && f.properties) || {};
      var key = props[cfg.filterField];
      if (key == null || seen[key]) return;
      seen[key] = true;
      items.push(props);
    });
    items.sort(function (a, b) {
      var va = a[cfg.filterField], vb = b[cfg.filterField];
      var na = Number(va), nb = Number(vb);
      if (isFinite(na) && isFinite(nb)) return na - nb;
      return String(va || '').localeCompare(String(vb || ''));
    });
    var sep = cfg.separator || ' – ';
    var dFields = cfg.displayFields || [cfg.filterField];
    return items.map(function (props) {
      var val = props[cfg.filterField];
      var label = dFields.map(function (f) { return props[f] != null ? String(props[f]) : ''; }).join(sep);
      return { value: val, label: label };
    });
  }

  function _renderFilterOptions(ref, options) {
    var dropdown = ref.dropdown, btn = ref.btn;
    var stale = dropdown.querySelectorAll('.filter-dropdown-item:not([data-value="__all__"])');
    for (var i = 0; i < stale.length; i++) dropdown.removeChild(stale[i]);
    options.forEach(function (opt) { _appendItem(dropdown, opt.value, opt.label, false); });
    btn.disabled = false;
  }

  // Populates the dropdown for a pmtiles-backed layer. Prefers
  // AthensGIS.datasetManifest[geojsonPath].filterOptions - a {value,label} list
  // already computed offline (tools/build-pmtiles.mjs) - but that only exists once
  // data/dataset-manifest.json has actually been generated and uploaded. Until then
  // (or for any dataset it doesn't cover), falls back to computing the same list live
  // from AthensGIS.pmtiles.getAllFeatures() - the same exhaustive (maxZoom-based, see
  // JS/pmtiles-loader.js) read _applyFilter() below already needs for this layer - so
  // the dropdown is never left empty just because the manifest hasn't caught up yet.
  function _populateFilterOptionsPmtiles(layerName, file, geojsonPath) {
    var ref = _refs[layerName];
    if (!ref) return;
    var ag = window.AthensGIS || {};
    var ready = ag.datasetManifestReady || Promise.resolve();
    ready.then(function () {
      // The layer may have been unchecked again before the manifest resolved.
      if (_refs[layerName] !== ref) return;
      var entry = geojsonPath && ag.datasetManifest && ag.datasetManifest[geojsonPath];
      var options = entry && entry.filterOptions;
      if (options && options.length) { _renderFilterOptions(ref, options); return; }

      if (!(ag.pmtiles && typeof ag.pmtiles.getAllFeatures === 'function' && typeof buildAssetUrl === 'function')) return;
      var fileUrl = buildAssetUrl('data', file);
      ag.pmtiles.getAllFeatures(fileUrl).then(function (fc) {
        if (_refs[layerName] !== ref) return;
        _renderFilterOptions(ref, computeFilterOptions((fc && fc.features) || [], ref.cfg));
      }).catch(function () {});
    });
  }

  // Resets the dropdown and button when the layer is unchecked.
  function onLayerRemoved(layerName) {
    var ref = _refs[layerName];
    if (!ref) return;

    ref.dropdown.classList.remove('open');
    var stale = ref.dropdown.querySelectorAll('.filter-dropdown-item:not([data-value="__all__"])');
    for (var i = 0; i < stale.length; i++) ref.dropdown.removeChild(stale[i]);

    var allItem = ref.dropdown.querySelector('.filter-dropdown-item');
    if (allItem) allItem.classList.add('selected');

    ref.btn.textContent = 'FILTER';
    ref.btn.classList.remove('filter-active');
    ref.btn.disabled = true;
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  function _appendItem(dropdown, value, label, isSelected) {
    var el = document.createElement('div');
    el.className = 'filter-dropdown-item' + (isSelected ? ' selected' : '');
    el.dataset.value = value;
    el.textContent   = label;
    el.title         = label;
    dropdown.appendChild(el);
  }

  function _pickItem(layerName, file, dropdown, btn, cfg, value) {
    var items = dropdown.querySelectorAll('.filter-dropdown-item');
    for (var i = 0; i < items.length; i++) {
      items[i].classList.toggle('selected', items[i].dataset.value === value);
    }
    _closeAll();

    var isAll = (value === '__all__');
    if (isAll) {
      btn.textContent = 'FILTER';
      btn.classList.remove('filter-active');
    } else {
      var selEl    = dropdown.querySelector('[data-value="' + CSS.escape(value) + '"]');
      var selLabel = selEl ? selEl.textContent : String(value);
      var short    = selLabel.length > 16 ? selLabel.slice(0, 14) + '…' : selLabel;
      btn.textContent = short;
      btn.classList.add('filter-active');
    }

    _applyFilter(file, layerName, cfg, isAll ? null : { field: cfg.filterField, value: String(value) });
  }

  function _applyFilter(file, layerName, cfg, filter) {
    if (typeof isPmtilesFile === 'function' && isPmtilesFile(file)) {
      _applyFilterPmtiles(file, layerName, filter);
      return;
    }

    var cache = AthensGIS._layerCache && AthensGIS._layerCache[file];
    if (!cache) return;

    var allFeatures = cache.features || [];
    var filtered = filter
      ? allFeatures.filter(function (f) {
          return String((f.properties || {})[filter.field]) === String(filter.value);
        })
      : allFeatures;

    var lc           = (window.legendConfigs || {})[layerName];
    var filteredFC   = { type: 'FeatureCollection', features: filtered };

    // Remove the existing layer from the map
    var oldLayer = AthensGIS.geojsonLayers[file];
    if (oldLayer) getMap().removeLayer(oldLayer);

    // Build a fresh layer from the filtered feature set
    var newLayer = createLayerFromGeoJSON(filteredFC, layerName, lc);
    AthensGIS.geojsonLayers[file] = newLayer;

    // For viewport-partitioned layers: update the reference and wrap
    // updateViewportData so that future pan/zoom events re-apply the filter.
    if (AthensGIS._viewportLayers && AthensGIS._viewportLayers[file]) {
      AthensGIS._viewportLayers[file] = newLayer;
      if (newLayer && typeof newLayer.updateViewportData === 'function' && filter) {
        var _orig = newLayer.updateViewportData.bind(newLayer);
        var _f = filter.field, _v = String(filter.value);
        newLayer.updateViewportData = function (data) {
          var fs = (data.features || []).filter(function (feat) {
            return String((feat.properties || {})[_f]) === _v;
          });
          _orig({ type: 'FeatureCollection', features: fs });
        };
      }
    }
  }

  // pmtiles-backed equivalent of _applyFilter above - there's no full in-memory
  // feature array to filter synchronously, so:
  //  - "All features" re-fetches the real viewport tiles for the current
  //    bounds/zoom, exactly like a fresh toggle-on (JS/layer-control.js).
  //  - a specific value decodes the WHOLE archive once via
  //    AthensGIS.pmtiles.getAllFeatures() (reads at maxZoom precisely so it's
  //    exhaustive regardless of how the archive was tiled - see the comment on
  //    getAllFeatures() in JS/pmtiles-loader.js), filters that in memory, and keeps
  //    reusing that same filtered subset on every later pan/zoom (small enough for
  //    these two datasets that re-fetching per view isn't needed).
  // A per-file request counter discards a stale response if the filter is changed
  // again before the previous one finishes loading.
  var _filterApplySeq = {};

  function _applyFilterPmtiles(file, layerName, filter) {
    var ag = window.AthensGIS;
    var seq = (_filterApplySeq[file] = (_filterApplySeq[file] || 0) + 1);
    var lc = (window.legendConfigs || {})[layerName];
    // .pmtiles archives are fetched straight from R2 like any other data asset - the
    // loader needs the full resolved URL, not the bare cache-key path.
    var fileUrl = buildAssetUrl('data', file);

    function swapLayer(featureCollection, fixedFeatures) {
      if (_filterApplySeq[file] !== seq) return; // superseded by a newer filter pick
      var oldLayer = ag.geojsonLayers[file];
      if (oldLayer) getMap().removeLayer(oldLayer);
      var newLayer = createLayerFromGeoJSON(featureCollection, layerName, lc);
      ag.geojsonLayers[file] = newLayer;
      if (!(ag._viewportLayers && ag._viewportLayers[file])) return;
      ag._viewportLayers[file] = newLayer;
      var _applyToSublayers = newLayer.updateViewportData.bind(newLayer);
      if (fixedFeatures) {
        newLayer.updateViewportData = function () {
          _applyToSublayers({ type: 'FeatureCollection', features: fixedFeatures });
        };
      } else {
        var _debounce = null;
        newLayer.updateViewportData = function () {
          clearTimeout(_debounce);
          _debounce = setTimeout(function () {
            if (_filterApplySeq[file] !== seq) return;
            ag.pmtiles.getFeaturesForBounds(fileUrl, getMap().getBounds(), getMap().getZoom()).then(function (freshFc) {
              if (freshFc && _filterApplySeq[file] === seq) _applyToSublayers(freshFc);
            });
          }, 150);
        };
      }
    }

    if (!filter) {
      ag.pmtiles.getFeaturesForBounds(fileUrl, getMap().getBounds(), getMap().getZoom()).then(function (fc) {
        swapLayer(fc || { type: 'FeatureCollection', features: [] }, null);
      });
      return;
    }

    ag.pmtiles.getAllFeatures(fileUrl).then(function (fc) {
      var allFeatures = (fc && fc.features) || [];
      var filtered = allFeatures.filter(function (f) {
        return String((f.properties || {})[filter.field]) === String(filter.value);
      });
      swapLayer({ type: 'FeatureCollection', features: filtered }, filtered);
    });
  }

  function _positionAndOpen(dropdown, anchorEl) {
    // Anchor to the right edge of the layer panel, vertically aligned with the button
    var panel     = document.getElementById('layerControl');
    var panelRect = panel ? panel.getBoundingClientRect() : anchorEl.getBoundingClientRect();
    var btnRect   = anchorEl.getBoundingClientRect();
    var isMobile  = window.matchMedia('(max-width: 900px)').matches;

    dropdown.style.left = (panelRect.right + 8) + 'px';
    // On mobile the dropdown is centered horizontally by CSS; drop it a bit
    // below the layer row instead of aligning flush with its top edge.
    dropdown.style.top  = (isMobile ? btnRect.bottom + 8 : btnRect.top) + 'px';
    dropdown.classList.add('open');

    // Clamp vertically: shift up if it overflows the bottom
    var ddRect = dropdown.getBoundingClientRect();
    if (ddRect.bottom > window.innerHeight - 8) {
      dropdown.style.top = Math.max(8, window.innerHeight - ddRect.height - 8) + 'px';
    }

    // Disable layer panel scroll while dropdown is open
    if (panel) panel.style.overflowY = 'hidden';
  }

  function _closeAll() {
    var open = document.querySelectorAll('.layer-filter-dropdown.open');
    for (var i = 0; i < open.length; i++) open[i].classList.remove('open');

    // Restore layer panel scroll
    var panel = document.getElementById('layerControl');
    if (panel) panel.style.overflowY = '';
  }

  // Close dropdown on outside click
  document.addEventListener('click', function (e) {
    if (!e.target.closest('.layer-filter-dropdown') && !e.target.closest('.filter-button')) {
      _closeAll();
    }
  });

})();
