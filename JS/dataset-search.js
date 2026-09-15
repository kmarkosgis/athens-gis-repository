// === Dataset Search Module ===
// Client-side fuzzy search over a manifest built at runtime from
// AthensGIS.layerCategories (JS/layer-control.js) plus each dataset's info/*.txt
// metadata file - no build step, so a new layer entry + its .txt is searchable
// immediately. Per-feature enrichment (attribute values, field names, feature
// count) is filled in lazily the first time a dataset is actually loaded onto
// the map, reusing data already fetched to render it - see enrichLoadedEntry().
// Selecting a result checks the matching layer checkbox (reusing the existing
// load path in layer-control.js), expands its category/subcategory panel, and
// flies the map to its extent.

(function () {

  var manifest = [];
  var entryByCheckboxId = {};
  var fuse = null;
  var input = null;
  var resultsEl = null;
  var lastMatches = [];
  var activeIndex = -1;
  var debounceTimer = null;
  var aiInFlight = false;
  var chatHistory = [];
  var chartInstance = null;
  var pendingActions = [];
  var resultsMinimized = false;
  var mode = 'search'; // 'search' (fuzzy database search, the default) | 'athena' (ask the AI assistant) - see #datasetSearchModeToggle
  var modeToggleBtn = null;
  var MODE_STORAGE_KEY = 'datasetSearchMode';

  function init() {
    input = document.getElementById('datasetSearchInput');
    resultsEl = document.getElementById('datasetSearchResults');
    if (!input || !resultsEl) return;

    manifest = buildManifest();
    manifest.forEach(function (entry) {
      entryByCheckboxId[entry.name.replace(/\s+/g, '_')] = entry;
    });
    manifest.forEach(enrichWithSearchableValues);
    rebuildFuseIndex();

    // .txt metadata is small and fetched in parallel, but never blocks search -
    // name/category/tag matching already works from the manifest built above.
    loadMetadataForEntries(manifest).then(function () {
      manifest.forEach(enrichWithSearchableValues);
      rebuildFuseIndex();
    });

    // Fields/attributeValues/featureCount/bbox, precomputed offline over each
    // dataset's complete data by tools/build-pmtiles.mjs (data/dataset-manifest.json)
    // and loaded once at startup by JS/layer-control.js. Applying it here means every
    // dataset is searchable/chartable by attribute value from page load - including
    // ones never toggled on this session, and pmtiles-backed ones the render path no
    // longer fully downloads. enrichLoadedEntry() below remains as a fallback for
    // whatever the manifest doesn't cover (not yet regenerated, a brand-new layer).
    var ag = window.AthensGIS || {};
    (ag.datasetManifestReady || Promise.resolve({})).then(function (manifestData) {
      var any = false;
      manifest.forEach(function (entry) {
        if (applyManifestEntry(entry, manifestData)) any = true;
      });
      if (any) rebuildFuseIndex();
    });

    // Lazily enriches a dataset's fields/attributeValues/featureCount the first
    // time it's actually loaded onto the map (checked here, in the sidebar, or
    // via selectDataset below) - reusing data already fetched to render it, so
    // no dataset is ever fetched solely to build the search index. Skipped for any
    // entry the manifest above already covered.
    document.addEventListener('change', function (e) {
      var cb = e.target;
      if (!cb || cb.tagName !== 'INPUT' || cb.type !== 'checkbox' || !cb.checked) return;
      var entry = entryByCheckboxId[cb.id];
      if (entry) enrichLoadedEntry(entry);
    });

    input.addEventListener('input', function () {
      // Typing a new prompt always means the user wants to see what happens next
      // (suggestions/thinking/answer) - a minimized history would hide that, so
      // expand immediately rather than waiting on the search debounce below.
      if (resultsMinimized) setResultsMinimized(false);
      autoGrowInput();
      clearTimeout(debounceTimer);
      // Athena mode is for asking a question, not browsing dataset-name matches -
      // fuzzy suggestions would just be noise until Enter actually asks it, so
      // fall back to the same "nothing live yet" view an empty query gets.
      if (mode === 'athena') { showHistoryOnly(); return; }
      var q = input.value.trim();
      debounceTimer = setTimeout(function () { runSearch(q); }, 200);
    });
    input.addEventListener('keydown', onKeyDown);
    input.addEventListener('focus', function () {
      if (input.value.trim() && lastMatches.length) resultsEl.classList.add('open');
    });
    window.addEventListener('resize', positionResults);
    autoGrowInput();
    // Clicking outside the widget no longer auto-closes the results/history box
    // (search suggestions or Athena's reply) - it stays open until explicitly
    // dismissed: Escape (onKeyDown below), picking a result (selectDataset),
    // the clear button, or the minimize toggle.

    var clearBtn = document.getElementById('datasetSearchClear');
    if (clearBtn) {
      clearBtn.addEventListener('click', function (e) {
        e.preventDefault();
        clearTimeout(debounceTimer);
        input.value = '';
        autoGrowInput();
        closeResults();
        input.focus();
      });
    }

    modeToggleBtn = document.getElementById('datasetSearchModeToggle');
    if (modeToggleBtn) {
      var storedMode = null;
      try { storedMode = localStorage.getItem(MODE_STORAGE_KEY); } catch (e) { /* private mode etc. - just default to 'search' */ }
      mode = (storedMode === 'athena') ? 'athena' : 'search';
      applyMode();

      modeToggleBtn.addEventListener('click', function (e) {
        e.preventDefault();
        mode = (mode === 'athena') ? 'search' : 'athena';
        try { localStorage.setItem(MODE_STORAGE_KEY, mode); } catch (e2) { /* not persisted this session - harmless */ }
        applyMode();
        // Reflect the new mode immediately rather than leaving a stale suggestions
        // list up (search -> athena) or the box sitting empty despite existing
        // text (athena -> search).
        var q = input.value.trim();
        if (mode === 'athena' || !q) showHistoryOnly();
        else runSearch(q);
        input.focus();
      });
    }

    var chartModal = document.getElementById('chartModal');
    var chartCloseBtn = document.getElementById('chartModalClose');
    if (chartModal && chartCloseBtn) {
      chartCloseBtn.addEventListener('click', closeChartModal);
      chartModal.addEventListener('click', function (e) {
        if (e.target === chartModal) closeChartModal();
      });
    }
  }

  // ── Search / Athena mode toggle ─────────────────────────────────────────────
  // Updates everything that reflects the current mode: the toggle button's
  // icon/title/aria state, its "on" styling, and the input's placeholder.
  // Persisted across reloads via localStorage (best-effort - see the try/catch
  // around the read/write at each call site).
  function applyMode() {
    if (!modeToggleBtn) return;
    var athena = mode === 'athena';
    // Icon swap is pure CSS now (search-icon/athena-icon opacity keyed off
    // .athena-mode below) - toggling that one class handles it.
    modeToggleBtn.title = athena ? 'Switch to database search' : 'Switch to Athena assistant';
    modeToggleBtn.setAttribute('aria-label', modeToggleBtn.title);
    modeToggleBtn.setAttribute('aria-pressed', athena ? 'true' : 'false');
    modeToggleBtn.classList.toggle('athena-mode', athena);
    if (input) input.placeholder = athena ? 'Ask Athena...' : 'Search database...';
  }

  // ── Growable input box ──────────────────────────────────────────────────────
  // A single-line input can't wrap long prompts, so #datasetSearchInput is a
  // <textarea> instead. Rather than following scrollHeight continuously (which
  // reflows on every keystroke), height is quantized to whole lines - it grows
  // one line at a time, up to LINE_LIMIT, then scrolls internally past that.
  var LINE_HEIGHT = 20;   // must match line-height in style.css
  var V_PADDING = 14;     // must match padding-top + padding-bottom in style.css
  var LINE_LIMIT = 6;

  function autoGrowInput() {
    input.style.height = (V_PADDING + LINE_HEIGHT) + 'px'; // collapse to 1 line to re-measure scrollHeight
    var neededLines = Math.max(1, Math.ceil((input.scrollHeight - V_PADDING) / LINE_HEIGHT));
    var lines = Math.min(neededLines, LINE_LIMIT);
    input.style.height = (V_PADDING + lines * LINE_HEIGHT) + 'px';
    input.style.overflowY = neededLines > LINE_LIMIT ? 'auto' : 'hidden';
    positionResults();
  }

  // Keeps the results/reply dropdown flush above the input regardless of how
  // many lines it has grown to. Minimized sits flush against the input's top
  // border (no gap); expanded keeps a small gap so it doesn't look glued to it.
  var RESULTS_GAP_OPEN = 6;
  function positionResults() {
    var gap = resultsMinimized ? 0 : RESULTS_GAP_OPEN;
    resultsEl.style.bottom = (input.offsetHeight + gap) + 'px';
  }

  // ── Manifest: built at runtime from AthensGIS.layerCategories ───────────────────
  // Mirrors the app's own category-flattening (JS/layer-control.js's
  // normalizeSubcategories()/getCategoryItems()): a category value that's an
  // array is a flat, subcategory-less list; an object's "_items" key is also
  // subcategory-less, and every other key names a subcategory holding its own
  // list of {name, file[, type]} entries.
  function flattenCategory(catData) {
    var entries = [];
    if (Array.isArray(catData)) {
      catData.forEach(function (info) { entries.push({ info: info, subcategory: null }); });
      return entries;
    }
    if (!catData || typeof catData !== 'object') return entries;
    Object.keys(catData).forEach(function (key) {
      if (key === '_items') {
        (catData[key] || []).forEach(function (info) { entries.push({ info: info, subcategory: null }); });
      } else {
        (catData[key] || []).forEach(function (info) { entries.push({ info: info, subcategory: key }); });
      }
    });
    return entries;
  }

  function slugify(text) {
    return String(text || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  var TAG_STOPWORDS = { and: 1, of: 1, the: 1, in: 1, for: 1, '1': 1, '2': 1, '3': 1, '4': 1 };
  function buildTags(name, category, subcategory) {
    var words = (name + ' ' + category + ' ' + (subcategory || '')).toLowerCase().match(/[a-z0-9]+/g) || [];
    var seen = {};
    var tags = [];
    words.forEach(function (w) {
      if (TAG_STOPWORDS[w] || seen[w]) return;
      seen[w] = true;
      tags.push(w);
    });
    return tags;
  }

  // Shared by both the normal per-category layers below and the two "common" layers
  // (Terrain, Shaded Relief) - those are rendered outside layerCategories entirely,
  // by dedicated code in JS/layer-control.js (renderReliefCommon/renderHillshadeCommon),
  // so they'd otherwise be invisible to search/Athena - see buildManifest() below.
  function buildManifestEntry(info, catName, subcategory, usedIds) {
    var id = slugify(info.name) || slugify(info.file);
    if (usedIds[id]) {
      var n = 2;
      while (usedIds[id + '-' + n]) n++;
      id = id + '-' + n;
    }
    usedIds[id] = true;

    // colorable/filterField mirror the exact conditions layer-control.js uses to
    // decide whether to render a COLOR button (no legend config - legend-styled
    // layers are colored by class, not a single border/fill) and a FILTER button
    // (an entry in window.layerFilterConfigs - see JS/layer-filter.js). Read here
    // so the assistant only ever proposes these actions for a dataset the real UI
    // actually offers them for.
    var hasLegend = !!((window.legendConfigs || {})[info.name]);
    var filterCfg = (window.layerFilterConfigs || {})[info.name];

    return {
      id: id,
      name: info.name,
      description: null,
      category: catName,
      subcategory: subcategory,
      file: info.file,
      // Original .geojson/.json path, set only for pmtiles-backed layers (see
      // JS/layer-control.js's layerCategories). Used to look up this dataset's
      // AthensGIS.datasetManifest entry and as the download/chart source - .file
      // is the .pmtiles render source there, not a fetchable JSON document.
      geojson: info.geojson || null,
      type: info.type === 'raster' ? 'raster' : 'vector',
      source: null,
      contributors: null,
      uploaded: null,
      updated: null,
      license: null,
      coverage: null,
      updateFrequency: null,
      keywords: [],
      bbox: null,
      fields: [],
      attributeValues: {},
      featureCount: null,
      tags: buildTags(info.name, catName, subcategory),
      colorable: !hasLegend,
      filterField: (filterCfg && filterCfg.filterField) || null
    };
  }

  // The two "common" layers rendered outside layerCategories - kept minimal and
  // matched exactly to what JS/layer-control.js actually renders (name, file, and
  // whether it's raster) so selectDataset()/closeDataset()'s
  // document.getElementById(name.replace(/\s+/g,'_')) lookup finds the real
  // checkbox: its id was aligned to that same convention ('Terrain', 'Shaded_Relief')
  // specifically so these need no special-case lookup.
  var COMMON_LAYERS = [
    { name: 'Terrain', file: 'Environment/Relief0.pmtiles', geojson: null, type: 'vector' },
    { name: 'Shaded Relief', file: 'Environment/shadedrelief.pmtiles', geojson: null, type: 'raster' }
  ];

  function buildManifest() {
    var layerCategories = (window.AthensGIS && AthensGIS.layerCategories) || window.layerCategories || {};
    var usedIds = {};
    var entries = [];

    Object.keys(layerCategories).forEach(function (catName) {
      flattenCategory(layerCategories[catName]).forEach(function (flat) {
        var info = flat.info;
        if (!info || !info.name || !info.file) return;
        entries.push(buildManifestEntry(info, catName, flat.subcategory, usedIds));
      });
    });

    COMMON_LAYERS.forEach(function (info) {
      entries.push(buildManifestEntry(info, 'Common Layers', null, usedIds));
    });

    return entries;
  }

  function rebuildFuseIndex() {
    if (typeof Fuse === 'undefined') {
      console.warn('[dataset-search] Fuse.js failed to load; search is disabled.');
      return;
    }
    fuse = new Fuse(manifest, {
      includeScore: true,
      includeMatches: true,
      threshold: 0.35,
      ignoreLocation: true,
      minMatchCharLength: 2,
      keys: [
        { name: 'name', weight: 0.5 },
        { name: 'tags', weight: 0.2 },
        { name: '_searchValues', weight: 0.18 },
        { name: 'description', weight: 0.06 },
        { name: 'source', weight: 0.02 },
        { name: 'category', weight: 0.03 },
        { name: 'subcategory', weight: 0.01 }
      ]
    });
  }

  // ── Manifest: description/source/contributors/uploaded from info/*.txt ─────────
  // Format (see e.g. info/Amenities/foodshops.txt): a free-text description line,
  // followed by "<p>Key: value<p/>" lines. Mirrors what info-box.js already
  // expects when it renders AthensGIS.activeLayerInfos.
  function txtPathForFile(relFile) {
    return relFile.replace(/\.[^/.]+$/, '') + '.txt';
  }

  function parseMetadataTxtContent(raw) {
    var result = {
      description: null, uploaded: null, updated: null, contributors: null, source: null,
      license: null, coverage: null, updateFrequency: null, keywords: []
    };
    var lines = String(raw || '').split(/\r?\n/).map(function (l) { return l.trim(); }).filter(function (l) { return l.length > 0; });
    var kvLines = [];
    lines.forEach(function (line) {
      if (result.description === null && line.indexOf('<') !== 0) {
        result.description = line;
      } else {
        kvLines.push(line);
      }
    });
    kvLines.forEach(function (line) {
      var stripped = line.replace(/<\/?[^>]*>/g, '').trim();
      if (!stripped) return;
      var idx = stripped.indexOf(':');
      if (idx === -1) return;
      var key = stripped.slice(0, idx).trim().toLowerCase().replace(/\s+/g, ' ');
      var value = stripped.slice(idx + 1).trim();
      if (!value) return;
      if (key === 'uploaded') result.uploaded = value;
      else if (key === 'updated') result.updated = value;
      else if (key === 'contributors') result.contributors = value;
      else if (key === 'source') result.source = value;
      else if (key === 'license') result.license = value;
      else if (key === 'coverage') result.coverage = value;
      else if (key === 'update frequency') result.updateFrequency = value;
      else if (key === 'keywords') {
        result.keywords = value.split(',').map(function (k) { return k.trim(); }).filter(function (k) { return k.length > 0; });
      }
    });
    return result;
  }

  // Goes through the app's own CDN-aware asset loader (JS/layer-control.js) when
  // available, so metadata resolves the same way on athensgis.gr / R2 as it does
  // for the info box; falls back to a plain relative fetch otherwise.
  function loadMetadataForEntries(entries) {
    var loader = (typeof window.loadLayerInfo === 'function')
      ? window.loadLayerInfo
      : function (rel) {
        return fetch('info/' + rel).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        });
      };

    return Promise.all(entries.map(function (entry) {
      return loader(txtPathForFile(entry.file)).then(function (raw) {
        var meta = parseMetadataTxtContent(raw);
        entry.description = meta.description;
        entry.uploaded = meta.uploaded;
        entry.contributors = meta.contributors;
        entry.source = meta.source;
      }).catch(function () {
        console.warn('[dataset-search] No metadata .txt found for "' + entry.name + '" (info/' + txtPathForFile(entry.file) + ').');
      });
    }));
  }

  // ── Lazy per-feature enrichment ──────────────────────────────────────────────
  // Fields/attribute-values/feature-count require scanning a dataset's actual
  // GeoJSON, which is only ever fetched (by layer-control.js) once the layer is
  // checked. Rather than eagerly downloading every dataset up front just to
  // build the search index (data/ is over a gigabyte across ~100 files), this
  // reuses that same fetch the moment it happens, the first time each dataset
  // is opened - free, and it's when its attributes matter most anyway.
  var ATTR_VALUE_CARDINALITY_CAP = 40; // fields with more distinct values than this are free-text/IDs, not categories
  var FIELD_SAMPLE_LIMIT = 25; // features scanned to collect property names

  function sampleFieldNames(features) {
    var fieldSet = {};
    for (var i = 0; i < Math.min(features.length, FIELD_SAMPLE_LIMIT); i++) {
      var props = features[i] && features[i].properties;
      if (props && typeof props === 'object') {
        Object.keys(props).forEach(function (k) { fieldSet[k] = true; });
      }
    }
    return Object.keys(fieldSet).sort();
  }

  function getAttributeValues(features) {
    var valueSets = {};
    var disqualified = {};
    features.forEach(function (f) {
      var props = f && f.properties;
      if (!props || typeof props !== 'object') return;
      Object.keys(props).forEach(function (key) {
        if (disqualified[key]) return;
        var v = props[key];
        if (v === null || v === undefined || v === '') return;
        var set = valueSets[key] || (valueSets[key] = {});
        set[String(v)] = true;
        if (Object.keys(set).length > ATTR_VALUE_CARDINALITY_CAP) {
          disqualified[key] = true;
          delete valueSets[key];
        }
      });
    });
    var out = {};
    Object.keys(valueSets).forEach(function (key) {
      var values = Object.keys(valueSets[key]).sort();
      if (values.length) out[key] = values;
    });
    return out;
  }

  // Applies one data/dataset-manifest.json entry (see tools/build-pmtiles.mjs) to a
  // manifest entry built by buildManifest(). Returns true if there was anything to
  // apply, so callers only pay for a Fuse rebuild when something actually changed.
  function applyManifestEntry(entry, manifestData) {
    if (!entry || entry.type === 'raster') return false;
    var key = entry.geojson || entry.file;
    var m = manifestData && manifestData[key];
    if (!m) return false;
    entry._enriched = true;
    if (typeof m.featureCount === 'number') entry.featureCount = m.featureCount;
    if (Array.isArray(m.fields)) entry.fields = m.fields;
    if (m.attributeValues && typeof m.attributeValues === 'object') entry.attributeValues = m.attributeValues;
    if (Array.isArray(m.bbox) && m.bbox.length === 4) entry.bbox = m.bbox;
    enrichWithSearchableValues(entry);
    return true;
  }

  function enrichLoadedEntry(entry) {
    if (entry._enriched || entry.type === 'raster') return;
    if (typeof isPmtilesFile === 'function' && isPmtilesFile(entry.file)) {
      enrichLoadedEntryPmtiles(entry);
      return;
    }
    waitForLayerCache(entry.file, 20000).then(function (features) {
      entry._enriched = true;
      entry.featureCount = features.length;
      entry.fields = sampleFieldNames(features);
      entry.attributeValues = getAttributeValues(features);
      var bounds = bboxFromCachedFeatures(entry.geojson || entry.file);
      if (bounds && bounds.isValid()) {
        entry.bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
      }
      enrichWithSearchableValues(entry);
      rebuildFuseIndex();
    }).catch(function () { /* load failed/timed out - next check attempt retries */ });
  }

  // pmtiles-backed layers never populate _layerCache - rendering only ever holds
  // whatever tiles cover the CURRENT viewport (JS/pmtiles-loader.js), not the full
  // dataset - so waitForLayerCache() above would just time out for these. This
  // samples fields/attributeValues from whatever's actually rendered right now
  // instead: same "reuse data already fetched to render it" spirit as the plain-
  // layer path, just scoped to the current view rather than the whole dataset. It's
  // a sample, not the truth - applyManifestEntry() (data/dataset-manifest.json,
  // exact, whole-dataset) is still tried first at init() and overrides this once it
  // exists; featureCount is deliberately left unset here rather than reporting the
  // in-view count as if it were the total. bbox comes from the archive's own header
  // instead (exact, a few bytes, no relation to what's currently in view).
  function enrichLoadedEntryPmtiles(entry) {
    var ag = window.AthensGIS || {};
    var fileUrl = (typeof buildAssetUrl === 'function') ? buildAssetUrl('data', entry.file) : null;
    var bboxPromise = (fileUrl && ag.pmtiles && typeof ag.pmtiles.getHeaderBounds === 'function')
      ? ag.pmtiles.getHeaderBounds(fileUrl).catch(function () { return null; })
      : Promise.resolve(null);

    waitForRenderedFeatures(entry.file, 20000).then(function (features) {
      return bboxPromise.then(function (bb) {
        entry._enriched = true;
        entry.fields = sampleFieldNames(features);
        entry.attributeValues = getAttributeValues(features);
        if (Array.isArray(bb) && bb.length === 4 && bb.every(isFinite)) entry.bbox = bb;
        enrichWithSearchableValues(entry);
        rebuildFuseIndex();
      });
    }).catch(function () { /* load failed/timed out - next check attempt retries */ });
  }

  // Every feature currently rendered for a layer, across whichever poly/line/point
  // sub-layer(s) it has (see createLayerFromGeoJSON in JS/layer-control.js) - the
  // pmtiles equivalent of scanning AthensGIS._layerCache, just necessarily limited to
  // the current viewport instead of the whole dataset.
  function collectRenderedFeatures(file) {
    var group = window.AthensGIS && AthensGIS.geojsonLayers && AthensGIS.geojsonLayers[file];
    if (!group) return [];
    var out = [];
    function collect(sub) {
      if (sub && typeof sub.eachLayer === 'function') {
        sub.eachLayer(function (sl) { if (sl && sl.feature) out.push(sl.feature); });
      }
    }
    if (group._polyLayer || group._lineLayer || group._vecLayer) {
      collect(group._polyLayer); collect(group._lineLayer); collect(group._vecLayer);
    } else {
      collect(group);
    }
    return out;
  }

  function waitForRenderedFeatures(file, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var waited = 0, interval = 150;
      (function poll() {
        var features = collectRenderedFeatures(file);
        if (features.length) { resolve(features); return; }
        waited += interval;
        if (waited >= timeoutMs) { reject(new Error('timeout')); return; }
        setTimeout(poll, interval);
      })();
    });
  }

  // Flattens attributeValues ({field: [values]}) plus, when a legend config
  // exists for this dataset, its class keys/labels, into one searchable array.
  // Lets a query like "bakery" match "Food Shops" even though "bakery" never appears
  // in that dataset's name/description - it only exists as a value of its "shop" field.
  function enrichWithSearchableValues(entry) {
    var out = [];
    var attrValues = entry.attributeValues;
    if (attrValues && typeof attrValues === 'object') {
      Object.keys(attrValues).forEach(function (field) {
        var vals = attrValues[field];
        if (Array.isArray(vals)) out = out.concat(vals);
      });
    }
    var legendConfig = (window.legendConfigs || {})[entry.name];
    if (legendConfig && legendConfig.classes) {
      Object.keys(legendConfig.classes).forEach(function (key) {
        out.push(key);
        var label = legendConfig.classes[key] && legendConfig.classes[key].label;
        if (label) out.push(label);
      });
    }
    entry._searchValues = out;
  }

  // ── Public API ───────────────────────────────────────────────────────────────
  window.searchDatasets = searchDatasets;

  // Fuse's fuzzy-distance scoring is normalized against how long each field is,
  // so a short query - down to a single letter, which plainly *does* appear in
  // most datasets' names - still reads as "too different" from a long name/tag
  // string and gets excluded by Fuse's own threshold before it ever reaches the
  // `limit` cap (e.g. "a" was matching almost nothing, not just being trimmed to
  // one result). This pass finds every entry that literally contains the query
  // text first - name match ranked above an attribute-value match, ranked above
  // every other field - so those are never at Fuse's mercy. Fuse then only fills
  // in whatever isn't a plain substring match at all (typos, reordered words),
  // appended after every substring hit rather than replacing them.
  function searchDatasets(query, limit) {
    if (!query) return [];
    var max = limit || 10;
    var q = query.toLowerCase();
    var seen = {};
    var results = [];

    manifest.forEach(function (entry) {
      var nameIdx = (entry.name || '').toLowerCase().indexOf(q);
      if (nameIdx !== -1) {
        seen[entry.id] = true;
        results.push({ item: entry, score: nameIdx / 1000, matches: null });
        return;
      }

      // Checked individually (not just joined into one haystack) so a hit here
      // can still carry a "matched: <value>" hint, same as a genuine Fuse match.
      if (Array.isArray(entry._searchValues)) {
        for (var i = 0; i < entry._searchValues.length; i++) {
          var v = entry._searchValues[i];
          if (typeof v === 'string' && v.toLowerCase().indexOf(q) !== -1) {
            seen[entry.id] = true;
            results.push({ item: entry, score: 1, matches: [{ key: '_searchValues', value: v }] });
            return;
          }
        }
      }

      var otherHay = [entry.category, entry.subcategory, entry.description, entry.source]
        .concat(Array.isArray(entry.tags) ? entry.tags : [])
        .filter(function (val) { return typeof val === 'string' && val; })
        .join('  ')
        .toLowerCase();
      if (otherHay.indexOf(q) !== -1) {
        seen[entry.id] = true;
        results.push({ item: entry, score: 1.5, matches: null });
      }
    });

    if (fuse) {
      fuse.search(query, { limit: max }).forEach(function (m) {
        if (seen[m.item.id]) return;
        seen[m.item.id] = true;
        results.push({ item: m.item, score: 2 + (m.score || 0), matches: m.matches });
      });
    }

    results.sort(function (a, b) { return a.score - b.score; });
    return results.slice(0, max);
  }

  // If a result matched via an attribute value rather than its name, surface which
  // value triggered the match (e.g. "matched: bakery") so it isn't a mystery why a
  // dataset with an unrelated-looking name showed up.
  function matchHintFor(fuseMatch) {
    if (!fuseMatch || !fuseMatch.matches) return null;
    for (var i = 0; i < fuseMatch.matches.length; i++) {
      var m = fuseMatch.matches[i];
      if (m.key === '_searchValues' && typeof m.value === 'string') return m.value;
    }
    return null;
  }

  // ── Search + render ──────────────────────────────────────────────────────────
  function runSearch(query) {
    if (!query) { showHistoryOnly(); return; }
    // The live list scrolls on its own (.dataset-live-scroll), so there's no
    // need to cap this hard the way buildAIContext() does for prompt size -
    // a common letter/word should be able to surface everything that has it.
    renderResults(searchDatasets(query, 50));
  }

  // Persistent log of this session's prior chat turns - always shown, capped to
  // the last few prompts, never persisted (chatHistory is a plain in-memory
  // array, so a reload clears it same as before). Pass excludeLatest=true when
  // the most recent turn is about to be rendered separately as the live
  // reply/confirm card, so it isn't shown twice.
  var HISTORY_MAX_PROMPTS = 5;

  function renderHistoryPreview(container, excludeLatest) {
    if (!chatHistory.length) return;
    var pairs = [];
    for (var i = 0; i < chatHistory.length; i += 2) {
      pairs.push({ user: chatHistory[i], assistant: chatHistory[i + 1] });
    }
    if (excludeLatest) pairs = pairs.slice(0, -1);

    pairs.slice(-HISTORY_MAX_PROMPTS).forEach(function (pair) {
      var card = document.createElement('div');
      card.className = 'dataset-ai-history-turn';

      var userLine = document.createElement('div');
      userLine.className = 'dataset-ai-history-line user';
      userLine.textContent = pair.user ? pair.user.content : '';
      userLine.title = userLine.textContent;
      card.appendChild(userLine);

      if (pair.assistant) {
        var aiLine = document.createElement('div');
        aiLine.className = 'dataset-ai-history-line assistant';
        aiLine.textContent = pair.assistant.content;
        aiLine.title = aiLine.textContent;
        card.appendChild(aiLine);
      }

      container.appendChild(card);
    });
  }

  // Sticky handle bar, re-added as the first child on every render (innerHTML
  // resets wipe it otherwise). Collapsing #datasetSearchResults to just this bar's
  // height (via the .minimized class in style.css) is what turns it into the "lip"
  // sitting on the input's top border - the box's bottom stays pinned just above
  // the input regardless of height, so shrinking it always collapses upward into
  // that lip rather than moving the input. Persists across re-renders (typing,
  // new replies) until explicitly toggled again - classList isn't touched by the
  // innerHTML resets that clear the rest of the box's content.
  function applyToggleLabel(btn) {
    btn.textContent = resultsMinimized ? '↗' : '−'; // expand (arrow) vs minimize (dash)
    btn.title = resultsMinimized ? 'Show chat history' : 'Minimize chat history';
  }

  // Shared by the toggle button's click handler and the "typing while minimized"
  // auto-expand below, so both stay in sync (class toggles, icon, input corners,
  // gap) instead of duplicating that logic in two places.
  function setResultsMinimized(minimized) {
    if (resultsMinimized === minimized) return;
    resultsMinimized = minimized;
    resultsEl.classList.toggle('minimized', resultsMinimized);
    input.classList.toggle('results-minimized', resultsMinimized); // squares the input's top corners to match the flush lip
    var btn = resultsEl.querySelector('.dataset-results-toggle');
    if (btn) applyToggleLabel(btn);
    positionResults(); // gap collapses to 0 (minimized) or reopens (expanded)
  }

  function renderResultsToggle() {
    // Only visible when #datasetSearchResults has .minimized (see style.css) -
    // always created so it's there the instant the box collapses, same reasoning
    // as the toggle button itself.
    var label = document.createElement('div');
    label.className = 'dataset-results-minimized-label';
    label.textContent = 'Chat history is minimized';
    resultsEl.appendChild(label);

    var btn = document.createElement('div');
    btn.className = 'dataset-results-toggle';
    applyToggleLabel(btn);
    btn.addEventListener('click', function (e) {
      e.stopPropagation();
      setResultsMinimized(!resultsMinimized);
    });
    resultsEl.appendChild(btn);
  }

  // The toggle button/label are appended directly to #datasetSearchResults (kept
  // outside both scrolling panes - see style.css), while chat history goes in
  // its own .dataset-history-scroll pane, created here. Whatever's "live" right
  // now (suggestions/thinking/reply/confirm) gets its own separate
  // .dataset-live-scroll pane via createLiveScroll() below, when there is any -
  // keeping the two apart is what lets a long suggestions list scroll on its
  // own without dragging chat history along with it, and vice versa. Keeping the
  // toggle out of both is what keeps it fixed in the same corner regardless.
  function resetResultsBox() {
    resultsEl.innerHTML = '';
    renderResultsToggle();
    var history = document.createElement('div');
    history.className = 'dataset-history-scroll';
    resultsEl.appendChild(history);
    return history;
  }

  // Called after resetResultsBox() only by renderers that have live content to
  // show alongside history (renderResults/renderThinking/renderAIMessage/
  // renderAIConfirm) - showHistoryOnly() never calls this, since it has nothing
  // live to show.
  function createLiveScroll() {
    var live = document.createElement('div');
    live.className = 'dataset-live-scroll';
    resultsEl.appendChild(live);
    return live;
  }

  // The latest history turn is always appended last, so scrolling the history
  // pane to its own bottom after every render is what keeps it in view instead
  // of leaving the user parked wherever they'd previously scrolled to. The live
  // pane deliberately does NOT get this treatment - suggestions are ordered by
  // relevance (best match first), so it should stay scrolled to its top.
  function scrollResultsToBottom(scroll) {
    scroll.scrollTop = scroll.scrollHeight;
  }

  // Resets the results box back to just the persistent history (dropping any
  // live search matches / AI reply) - used whenever the "active" interaction
  // ends (Escape, click-outside, picking a result), while keeping history
  // visible per its "always shown" behavior. Fully hides the box only if
  // there's no history yet either (nothing at all to show).
  function showHistoryOnly() {
    var history = resetResultsBox();
    history.classList.add('full'); // no live pane alongside it - let it use the full box height
    renderHistoryPreview(history, false);
    if (history.children.length > 0) {
      resultsEl.classList.add('open');
    } else {
      resultsEl.classList.remove('open');
    }
    scrollResultsToBottom(history);
  }

  function renderResults(matches, emptyMsg) {
    lastMatches = matches;
    activeIndex = -1;
    var history = resetResultsBox();
    renderHistoryPreview(history, false);
    if (history.children.length) history.classList.add('has-history');
    scrollResultsToBottom(history);

    var live = createLiveScroll();

    if (!matches.length) {
      var empty = document.createElement('div');
      empty.className = 'dataset-result-empty';
      empty.textContent = emptyMsg || 'No datasets found.';
      live.appendChild(empty);
      resultsEl.classList.add('open');
      return;
    }

    matches.forEach(function (m) {
      var entry = m.item;
      var el = document.createElement('div');
      el.className = 'dataset-result-item';

      var nameEl = document.createElement('div');
      nameEl.className = 'dataset-result-name';
      nameEl.textContent = entry.name;

      var metaEl = document.createElement('div');
      metaEl.className = 'dataset-result-meta';
      metaEl.textContent = entry.category + (entry.subcategory ? ' › ' + entry.subcategory : '');

      el.appendChild(nameEl);
      el.appendChild(metaEl);

      var hint = matchHintFor(m);
      if (hint) {
        var hintEl = document.createElement('div');
        hintEl.className = 'dataset-result-hint';
        hintEl.textContent = 'matched: ' + hint;
        el.appendChild(hintEl);
      }

      el.addEventListener('click', function () { selectDataset(entry); });
      live.appendChild(el);
    });
    resultsEl.classList.add('open');
  }

  function closeResults() {
    activeIndex = -1;
    showHistoryOnly();
  }

  function onKeyDown(e) {
    if (e.key === 'Escape') { closeResults(); input.blur(); return; }
    var items = resultsEl.querySelectorAll('.dataset-result-item');
    if (e.key === 'ArrowDown' && items.length) {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
      updateActive(items);
    } else if (e.key === 'ArrowUp' && items.length) {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
      updateActive(items);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (mode === 'athena') {
        // This box is dedicated to asking Athena right now - always treat Enter
        // as the question, regardless of any leftover arrow-key selection.
        askAI(input.value.trim());
        return;
      }
      // Search mode: an explicit arrow-key selection picks that result; otherwise
      // Enter goes to the top suggestion, like a normal search box.
      if (activeIndex >= 0 && lastMatches[activeIndex]) {
        selectDataset(lastMatches[activeIndex].item);
      } else if (lastMatches.length) {
        selectDataset(lastMatches[0].item);
      }
    }
  }

  function updateActive(items) {
    items.forEach(function (it, i) { it.classList.toggle('active', i === activeIndex); });
    if (activeIndex >= 0 && items[activeIndex]) items[activeIndex].scrollIntoView({ block: 'nearest' });
  }

  // ── Selecting a result: load the layer, reveal its row, fly to its extent ─────
  function selectDataset(entry) {
    closeResults();
    input.value = entry.name;
    autoGrowInput();

    var cb = document.getElementById(entry.name.replace(/\s+/g, '_'));
    if (!cb) { console.warn('[dataset-search] No layer checkbox found for "' + entry.name + '".'); return; }

    revealRow(cb.closest('.layer-item'));

    if (!cb.checked) {
      cb.checked = true;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    }
    flyToDataset(entry);
  }

  // Unchecks the layer's checkbox, reusing the exact same uncheck path as clicking it
  // manually (map layer removal, legend/info-box cleanup, activeLayerOrder update -
  // all handled by the existing change handler in layer-control.js).
  function closeDataset(entry) {
    var cb = document.getElementById(entry.name.replace(/\s+/g, '_'));
    if (!cb) { console.warn('[dataset-search] No layer checkbox found for "' + entry.name + '".'); return; }
    if (cb.checked) {
      cb.checked = false;
      cb.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  // ── The 6 newer action types - each just forwards to the real function the
  // matching button already calls, exposed on AthensGIS/LayerFilter for exactly
  // this purpose (see JS/layer-control.js, JS/layer-filter.js, JS/draw-order.js,
  // JS/export.js). All require the dataset to already be active - server-enforced,
  // same as close_dataset - so entry is guaranteed loaded already; no waiting needed.
  function downloadDatasetEntry(entry) {
    var ag = window.AthensGIS;
    if (!ag || typeof ag.downloadLayerAsZip !== 'function') return;
    ag.downloadLayerAsZip({ file: entry.file, geojson: entry.geojson, type: entry.type, name: entry.name }, entry.category, entry.subcategory, null);
  }

  function setOpacityForEntry(entry, percent) {
    var ag = window.AthensGIS;
    if (!ag || typeof ag.setLayerOpacity !== 'function') return;
    var pct = Math.max(0, Math.min(100, Number(percent)));
    ag.setLayerOpacity(entry.name, pct / 100);
    if (typeof ag.refreshOpacityPopup === 'function') ag.refreshOpacityPopup();
  }

  function setColorForEntry(entry, colorName) {
    var ag = window.AthensGIS;
    if (!ag || typeof ag.setLayerColorByName !== 'function') return;
    ag.setLayerColorByName(entry.name, colorName);
  }

  function filterEntryByValue(entry, value) {
    if (!window.LayerFilter || typeof window.LayerFilter.applyByValue !== 'function') return;
    window.LayerFilter.applyByValue(entry.name, value || null);
  }

  function reorderEntry(entry, direction) {
    var ag = window.AthensGIS;
    if (!ag || typeof ag.moveLayerInDrawOrder !== 'function') return;
    ag.moveLayerInDrawOrder(entry.name, direction === 'backward' ? -1 : 1);
  }

  function exportCurrentMap(format) {
    var ag = window.AthensGIS;
    if (!ag || typeof ag.exportMap !== 'function') return;
    ag.exportMap(format === 'a4-portrait' ? 'A4Portrait' : 'A4Landscape');
  }

  // European-style thousands separator, matching the "Scale 1 : 100.000" label
  // map-init.js already shows on the map itself.
  function formatScaleValue(value) {
    return String(Math.round(Number(value))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  // Inverse of the scale-denominator formula map-init.js uses for the on-map label
  // (metersPerPixel = 156543.034 * cos(lat) / 2^zoom; scale = metersPerPixel * 96 / 0.0254)
  // - solved for zoom given a target scale, at the map's current latitude.
  function zoomForScale(map, targetScale) {
    var lat = map.getCenter().lat;
    var metersPerPixelAtZ0 = 156543.03392804097 * Math.cos(lat * Math.PI / 180);
    var neededMetersPerPixel = (targetScale * 0.0254) / 96;
    return Math.log2(metersPerPixelAtZ0 / neededMetersPerPixel);
  }

  // value is "in"/"out" (one step, matching the +/- zoom buttons' own step in
  // map-init.js) or a target scale denominator (e.g. 5000 for a scale of 1:5,000).
  function zoomMap(value) {
    var map = window.AthensGIS && window.AthensGIS.map;
    if (!map) return;
    if (value === 'in') { map.zoomIn(0.3); return; }
    if (value === 'out') { map.zoomOut(0.3); return; }
    var target = Number(value);
    if (!Number.isFinite(target) || target <= 0) return;
    var min = map.getMinZoom ? map.getMinZoom() : 0;
    var max = map.getMaxZoom ? map.getMaxZoom() : 20;
    var zoom = Math.max(min, Math.min(max, zoomForScale(map, target)));
    map.setZoom(zoom);
  }

  // Expands the row's category/subcategory panels (via the existing header click
  // handlers in layer-control.js) if collapsed, then scrolls to and flashes the row.
  function revealRow(row) {
    if (!row) return;

    var catContent = row.dataset.categoryId ? document.getElementById(row.dataset.categoryId) : null;
    var catHeader = catContent && catContent.previousElementSibling;
    var openedCat = !!(catContent && catContent.style.display === 'none' && catHeader);
    if (openedCat) catHeader.click();

    var subContent = row.dataset.subcategoryId ? document.getElementById(row.dataset.subcategoryId) : null;
    var subHeader = subContent && subContent.previousElementSibling;
    var openedSub = !!(subContent && subContent.style.display === 'none' && subHeader);
    if (openedSub) subHeader.click();

    var delay = (openedCat || openedSub) ? 380 : 0;
    setTimeout(function () {
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      row.classList.add('dataset-search-highlight');
      setTimeout(function () { row.classList.remove('dataset-search-highlight'); }, 1400);
    }, delay);
  }

  // ── Flying to a dataset's extent ────────────────────────────────────────────────
  function boundsFromBBox(bbox) {
    if (!bbox) return null;
    return L.latLngBounds([[bbox[1], bbox[0]], [bbox[3], bbox[2]]]);
  }

  // Full (non-viewport-clipped) extent from the cached feature set — the rendered
  // layer may only contain features inside the current map view on first load.
  function bboxFromCachedFeatures(file) {
    var cache = window.AthensGIS && AthensGIS._layerCache && AthensGIS._layerCache[file];
    if (!cache || !cache.features || !cache.features.length) return null;

    var minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
    function walk(coords) {
      if (typeof coords[0] === 'number') {
        var lng = coords[0], lat = coords[1];
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      } else {
        for (var i = 0; i < coords.length; i++) walk(coords[i]);
      }
    }
    cache.features.forEach(function (f) {
      var g = f && f.geometry;
      if (!g) return;
      if (g.type === 'GeometryCollection') {
        (g.geometries || []).forEach(function (gg) { if (gg && gg.coordinates) walk(gg.coordinates); });
      } else if (g.coordinates) {
        walk(g.coordinates);
      }
    });
    if (!isFinite(minLng) || !isFinite(minLat) || !isFinite(maxLng) || !isFinite(maxLat)) return null;
    return L.latLngBounds([[minLat, minLng], [maxLat, maxLng]]);
  }

  function flyToDataset(entry) {
    var map = typeof getMap === 'function' ? getMap() : (window.AthensGIS && AthensGIS.map);
    if (!map) return;

    // Fast path: entry.bbox is precomputed by the manifest for essentially every
    // vector dataset from page load (applyManifestEntry()), so this usually skips
    // the poll below entirely - important for pmtiles-backed layers, whose render
    // path never populates _layerCache with the full dataset the poll looks for.
    if (entry.type !== 'raster') {
      var fastBounds = boundsFromBBox(entry.bbox);
      if (fastBounds && fastBounds.isValid()) {
        map.flyToBounds(fastBounds.pad(0.1), { maxZoom: 17 });
        return;
      }
    }

    var attempts = 0;
    var maxAttempts = 100; // ~15s at 150ms

    (function poll() {
      var bounds = null;
      if (entry.type === 'raster') {
        var lyr = AthensGIS.geojsonLayers && AthensGIS.geojsonLayers[entry.file];
        if (lyr && typeof lyr.getBounds === 'function') {
          try { bounds = lyr.getBounds(); } catch (e) { bounds = null; }
        }
      } else {
        bounds = bboxFromCachedFeatures(entry.geojson || entry.file);
      }

      if (bounds && bounds.isValid()) {
        map.flyToBounds(bounds.pad(0.1), { maxZoom: 17 });
        return;
      }

      attempts++;
      if (attempts >= maxAttempts) {
        var fallback = boundsFromBBox(entry.bbox);
        if (fallback && fallback.isValid()) map.flyToBounds(fallback.pad(0.1), { maxZoom: 17 });
        return;
      }
      setTimeout(poll, 150);
    })();
  }

  // Generic verbs/fillers in a natural-language prompt ("find bars", "show me the
  // bus routes") dilute Fuse's whole-string fuzzy match against short values like a
  // tag or attribute value ("bars"), since Fuse matches the query as one continuous
  // pattern. Stripping them and also searching each remaining word individually
  // (unioned with the full-phrase search) lets "find bars" still surface a dataset
  // whose only correspondence is the single word "bars".
  var AI_QUERY_FILLER_WORDS = ['find', 'show', 'me', 'open', 'load', 'display', 'get', 'search',
    'chart', 'graph', 'tell', 'about', 'give', 'the', 'a', 'an', 'is', 'are', 'what', 'which',
    'please', 'can', 'you', 'i', 'want', 'to', 'see', 'for', 'of', 'in', 'on', 'from', 'with',
    'by', 'near', 'and', 'that', 'this', 'layers', 'layer', 'dataset', 'datasets'];

  // Resolves AthensGIS.activeLayerOrder (names of currently checked layers,
  // maintained by layer-control.js) to their manifest entries.
  function getActiveLayerEntries() {
    var names = (window.AthensGIS && AthensGIS.activeLayerOrder) || [];
    var out = [];
    names.forEach(function (name) {
      for (var i = 0; i < manifest.length; i++) {
        if (manifest[i].name === name) { out.push(manifest[i]); return; }
      }
    });
    return out;
  }

  function buildAIContext(query) {
    var seen = {};
    var combined = [];
    function addAll(matches) {
      matches.forEach(function (m) {
        if (!seen[m.item.id]) { seen[m.item.id] = true; combined.push(m.item); }
      });
    }

    addAll(searchDatasets(query, 15));

    var words = query.toLowerCase().match(/[a-z0-9]+/g) || [];
    var meaningful = words.filter(function (w) {
      return w.length >= 3 && AI_QUERY_FILLER_WORDS.indexOf(w) === -1;
    });
    meaningful.forEach(function (word) { addAll(searchDatasets(word, 8)); });

    // Always include currently-open layers regardless of fuzzy match strength, so a
    // request like "close all layers" (which has no dataset-specific keywords at all)
    // still has something for the model to act on.
    getActiveLayerEntries().forEach(function (entry) {
      if (!seen[entry.id]) { seen[entry.id] = true; combined.push(entry); }
    });

    return combined.slice(0, 20).map(trimForContext);
  }

  // ── AI chat fallback ─────────────────────────────────────────────────────────
  // Triggered on Enter when the user hasn't explicitly arrow-selected a fuzzy
  // match — lets a full natural-language request ("chart food shops by shop
  // type") reach the Worker backend, which decides what to load/chart.
  function askAI(query) {
    if (!query || aiInFlight) return;

    var workerUrl = window.CONFIG && window.CONFIG.CHAT_WORKER_URL;
    if (!workerUrl) {
      renderAIMessage('AI chat is not configured yet.');
      return;
    }

    aiInFlight = true;
    renderThinking();

    var context = fuse ? buildAIContext(query) : [];
    var activeLayers = getActiveLayerEntries().map(function (e) { return e.id; });

    fetch(workerUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: query,
        manifestContext: context,
        history: chatHistory.slice(-6),
        activeLayers: activeLayers
      })
    })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (result) { handleAIResponse(query, result); })
      .catch(function (err) {
        console.warn('[dataset-search] AI request failed:', err);
        renderAIMessage("Sorry, I couldn't reach the assistant. Please try again.");
      })
      .finally(function () { aiInFlight = false; });
  }

  function trimForContext(entry) {
    return {
      id: entry.id,
      name: entry.name,
      description: entry.description,
      source: entry.source,
      category: entry.category,
      subcategory: entry.subcategory,
      type: entry.type,
      fields: entry.fields,
      attributeValues: entry.attributeValues,
      featureCount: entry.featureCount,
      tags: entry.tags,
      colorable: entry.colorable,
      filterField: entry.filterField
    };
  }

  function handleAIResponse(query, result) {
    // The question just got answered - clear the box so it's ready for the next
    // one. Left alone on failure (see askAI's .catch) so the user can retry it.
    input.value = '';
    autoGrowInput();

    chatHistory.push({ role: 'user', content: query });
    chatHistory.push({ role: 'assistant', content: (result && result.reply) || '' });
    if (chatHistory.length > 12) chatHistory = chatHistory.slice(-12);

    var actions = (result && Array.isArray(result.actions)) ? result.actions : [];
    var replyText = (result && result.reply) || "Sorry, I couldn't process that.";

    if (!actions.length) {
      renderAIMessage(replyText, true);
      return;
    }

    // Resolve datasetIds to manifest entries up front; only ask to open the ones
    // that actually exist. export_map is the one action type with no datasetId at
    // all (it acts on the whole current map view) - let it through with entry=null
    // rather than dropping it for failing to match anything.
    var resolved = [];
    actions.forEach(function (action) {
      if (action.type === 'export_map' || action.type === 'zoom_map') { resolved.push({ action: action, entry: null }); return; }
      var entry = null;
      for (var j = 0; j < manifest.length; j++) {
        if (manifest[j].id === action.datasetId) { entry = manifest[j]; break; }
      }
      if (entry) resolved.push({ action: action, entry: entry });
    });

    if (!resolved.length) {
      renderAIMessage(replyText, true);
      return;
    }

    renderAIConfirm(replyText, resolved);
  }

  // Runs the resolved actions the user confirmed with "Yes".
  function runPendingActions(resolved) {
    // Only one chart modal exists. If more than one dataset asked for a chart, only
    // the last one gets rendered - earlier ones still get loaded onto the map, they
    // just don't get a chart of their own.
    var lastChartIndex = -1;
    resolved.forEach(function (r, i) { if (r.action.type === 'build_chart') lastChartIndex = i; });

    resolved.forEach(function (r, i) {
      var action = r.action, entry = r.entry;
      if (action.type === 'close_dataset') {
        closeDataset(entry);
      } else if (action.type === 'build_chart' && action.field && i === lastChartIndex) {
        loadThenChart(entry, action.field, action.aggregation || 'count', action.chartType || 'bar');
      } else if (action.type === 'download_dataset') {
        downloadDatasetEntry(entry);
      } else if (action.type === 'set_opacity') {
        setOpacityForEntry(entry, action.value);
      } else if (action.type === 'set_color') {
        setColorForEntry(entry, action.value);
      } else if (action.type === 'filter_dataset') {
        filterEntryByValue(entry, action.value);
      } else if (action.type === 'reorder_layer') {
        reorderEntry(entry, action.value);
      } else if (action.type === 'export_map') {
        exportCurrentMap(action.value);
      } else if (action.type === 'zoom_map') {
        zoomMap(action.value);
      } else {
        selectDataset(entry);
      }
    });
  }

  function renderThinking() {
    var history = resetResultsBox();
    renderHistoryPreview(history, false); // the in-flight question isn't in chatHistory yet
    if (history.children.length) history.classList.add('has-history');
    scrollResultsToBottom(history);

    var live = createLiveScroll();
    var el = document.createElement('div');
    el.className = 'dataset-ai-message thinking';

    var owl = document.createElement('img');
    owl.className = 'dataset-ai-thinking-owl';
    owl.setAttribute('aria-hidden', 'true');
    owl.alt = '';
    owl.src = 'https://data.athensgis.gr/knowledge.gif'; // Athena's owl (replaces the emoji)
    el.appendChild(owl);

    var label = document.createElement('span');
    label.textContent = 'Thinking...';
    el.appendChild(label);

    live.appendChild(el);
    resultsEl.classList.add('open');
  }

  // excludeLatest: pass true when `text` is the reply to the pair just pushed
  // onto chatHistory, so the history preview above it doesn't repeat it.
  function renderAIMessage(text, excludeLatest) {
    pendingActions = [];
    var history = resetResultsBox();
    renderHistoryPreview(history, !!excludeLatest);
    if (history.children.length) history.classList.add('has-history');
    scrollResultsToBottom(history);

    var live = createLiveScroll();
    var el = document.createElement('div');
    el.className = 'dataset-ai-message';
    el.textContent = text;
    live.appendChild(el);
    resultsEl.classList.add('open');
  }

  // Shows the AI's reply plus a Yes/No prompt describing what's about to happen
  // ("Open this layer?" / "Close these layers?" / a mix of both). Nothing is loaded
  // or closed until the user confirms with Yes.
  function renderAIConfirm(text, resolved) {
    pendingActions = resolved;
    var history = resetResultsBox();
    renderHistoryPreview(history, true); // this exchange is already in chatHistory - don't repeat it below
    if (history.children.length) history.classList.add('has-history');
    scrollResultsToBottom(history);

    var live = createLiveScroll();
    var card = document.createElement('div');
    card.className = 'dataset-ai-card';

    var msgEl = document.createElement('div');
    msgEl.className = 'dataset-ai-message';
    msgEl.textContent = text;
    card.appendChild(msgEl);

    var confirmEl = document.createElement('div');
    confirmEl.className = 'dataset-ai-confirm';

    var toOpen = resolved.filter(function (r) { return r.action.type === 'load_dataset' || r.action.type === 'build_chart'; }).map(function (r) { return r.entry.name; });
    var toClose = resolved.filter(function (r) { return r.action.type === 'close_dataset'; }).map(function (r) { return r.entry.name; });
    var toDownload = resolved.filter(function (r) { return r.action.type === 'download_dataset'; }).map(function (r) { return r.entry.name; });
    var toOpacity = resolved.filter(function (r) { return r.action.type === 'set_opacity'; });
    var toColor = resolved.filter(function (r) { return r.action.type === 'set_color'; });
    var toFilter = resolved.filter(function (r) { return r.action.type === 'filter_dataset'; });
    var toReorder = resolved.filter(function (r) { return r.action.type === 'reorder_layer'; });
    var toExport = resolved.filter(function (r) { return r.action.type === 'export_map'; });
    var toZoom = resolved.filter(function (r) { return r.action.type === 'zoom_map'; });

    var parts = [];
    if (toOpen.length) parts.push((toOpen.length > 1 ? 'Open these layers' : 'Open this layer') + '? (' + toOpen.join(', ') + ')');
    if (toClose.length) parts.push((toClose.length > 1 ? 'Close these layers' : 'Close this layer') + '? (' + toClose.join(', ') + ')');
    if (toDownload.length) parts.push('Download ' + toDownload.join(', ') + '?');
    toOpacity.forEach(function (r) { parts.push('Set ' + r.entry.name + ' opacity to ' + r.action.value + '%?'); });
    toColor.forEach(function (r) { parts.push('Set ' + r.entry.name + ' color to ' + r.action.value + '?'); });
    toFilter.forEach(function (r) { parts.push(r.action.value ? ('Filter ' + r.entry.name + ' to "' + r.action.value + '"?') : ('Clear the filter on ' + r.entry.name + '?')); });
    toReorder.forEach(function (r) { parts.push('Move ' + r.entry.name + ' ' + (r.action.value === 'backward' ? 'backward' : 'forward') + '?'); });
    if (toExport.length) parts.push('Export the map as ' + (toExport[0].action.value === 'a4-portrait' ? 'A4 Portrait' : 'A4 Landscape') + '?');
    toZoom.forEach(function (r) {
      var v = r.action.value;
      if (v === 'in') parts.push('Zoom in?');
      else if (v === 'out') parts.push('Zoom out?');
      else parts.push('Zoom the map to a scale of 1:' + formatScaleValue(v) + '?');
    });

    var q = document.createElement('div');
    q.className = 'dataset-ai-confirm-text';
    q.textContent = parts.join(' ');
    confirmEl.appendChild(q);

    var btnRow = document.createElement('div');
    btnRow.className = 'dataset-ai-confirm-actions';

    var yesBtn = document.createElement('button');
    yesBtn.type = 'button';
    yesBtn.className = 'dataset-ai-confirm-btn yes';
    yesBtn.textContent = 'Yes';
    yesBtn.addEventListener('click', function () {
      var toRun = pendingActions;
      pendingActions = [];
      renderAIMessage(text, true);
      runPendingActions(toRun);
    });

    var noBtn = document.createElement('button');
    noBtn.type = 'button';
    noBtn.className = 'dataset-ai-confirm-btn no';
    noBtn.textContent = 'No';
    noBtn.addEventListener('click', function () {
      pendingActions = [];
      renderAIMessage(text, true);
    });

    btnRow.appendChild(yesBtn);
    btnRow.appendChild(noBtn);
    confirmEl.appendChild(btnRow);
    card.appendChild(confirmEl);
    live.appendChild(card);
    resultsEl.classList.add('open');
  }

  // ── Chart requests: ensure the dataset is loaded, then aggregate + render ─────
  function loadThenChart(entry, field, aggregation, chartType) {
    selectDataset(entry);
    getFeaturesForChart(entry, 15000)
      .then(function (features) {
        var agg = aggregateFeatures(features, field, aggregation);
        renderChart(entry.name + ' by ' + field, agg, chartType);
      })
      .catch(function () {
        renderAIMessage('Loaded "' + entry.name + '" but could not build the chart in time.');
      });
  }

  // Chart aggregation needs every feature's exact property values (a numeric
  // "sum"/"average" chart buckets the true min-max range) - the manifest's
  // attributeValues are capped at 40 distinct values and the on-map render only
  // ever holds the current viewport's tiles, so neither is a complete enough
  // source here. Plain (small, non-pmtiles) layers reuse the render cache as
  // before; pmtiles-backed layers fetch the original full file directly instead -
  // the only place the exact per-feature data exists - but only now, on an actual
  // chart request, not on every layer toggle.
  function getFeaturesForChart(entry, timeoutMs) {
    if (entry.geojson && typeof isPmtilesFile === 'function' && isPmtilesFile(entry.file) && typeof loadLayerData === 'function') {
      return loadLayerData(entry.geojson).then(function (data) { return (data && data.features) || []; });
    }
    return waitForLayerCache(entry.file, timeoutMs);
  }

  function waitForLayerCache(file, timeoutMs) {
    return new Promise(function (resolve, reject) {
      var waited = 0;
      var interval = 150;
      (function poll() {
        var cache = window.AthensGIS && AthensGIS._layerCache && AthensGIS._layerCache[file];
        if (cache && cache.features && cache.features.length) { resolve(cache.features); return; }
        waited += interval;
        if (waited >= timeoutMs) { reject(new Error('timeout')); return; }
        setTimeout(poll, interval);
      })();
    });
  }

  // Groups features by a property's value. "count" tallies frequency per distinct
  // value (works for any field). For a numeric field with "sum"/"average", there's
  // no second value field in the action schema to aggregate, so we fall back to a
  // histogram-style distribution (count/average count per value range) instead.
  function aggregateFeatures(features, field, aggregation) {
    var isNumeric = true;
    var sampled = 0;
    for (var i = 0; i < features.length && sampled < 25; i++) {
      var v = features[i].properties ? features[i].properties[field] : undefined;
      if (v === undefined || v === null || v === '') continue;
      sampled++;
      if (!isFinite(Number(v))) { isNumeric = false; break; }
    }

    if (aggregation === 'count' || !isNumeric) {
      var counts = {};
      features.forEach(function (f) {
        var val = f.properties ? f.properties[field] : undefined;
        if (val === undefined || val === null || val === '') return;
        var key = String(val);
        counts[key] = (counts[key] || 0) + 1;
      });
      var entries = Object.keys(counts).map(function (k) { return [k, counts[k]]; });
      entries.sort(function (a, b) { return b[1] - a[1]; });
      var top = entries.slice(0, 12);
      var restTotal = entries.slice(12).reduce(function (s, e) { return s + e[1]; }, 0);
      if (restTotal > 0) top.push(['Other', restTotal]);
      return { labels: top.map(function (e) { return e[0]; }), values: top.map(function (e) { return e[1]; }) };
    }

    // Numeric field: bucket into ranges.
    var nums = [];
    features.forEach(function (f) {
      var val = f.properties ? Number(f.properties[field]) : NaN;
      if (isFinite(val)) nums.push(val);
    });
    if (!nums.length) return { labels: [], values: [] };

    var min = Math.min.apply(null, nums), max = Math.max.apply(null, nums);
    var binCount = 7;
    var binSize = ((max - min) || 1) / binCount;
    var binSums = new Array(binCount).fill(0);
    var binCounts = new Array(binCount).fill(0);
    nums.forEach(function (n) {
      var idx = Math.min(binCount - 1, Math.floor((n - min) / binSize));
      binSums[idx] += n;
      binCounts[idx]++;
    });
    var values = (aggregation === 'average')
      ? binSums.map(function (sum, i) { return binCounts[i] ? +(sum / binCounts[i]).toFixed(2) : 0; })
      : binCounts;
    var labels = binCounts.map(function (_, i) {
      var lo = min + i * binSize, hi = lo + binSize;
      return lo.toFixed(1) + '-' + hi.toFixed(1);
    });
    return { labels: labels, values: values };
  }

  var CHART_PALETTE = ['#37414f', '#5b7cc4', '#e07b2a', '#3a8c3f', '#b22222', '#7d3c98', '#1a6e9e', '#d4a017', '#2e6b4f', '#c8702a', '#8e44ad', '#17202a', '#e8c84a'];

  function renderChart(title, agg, chartType) {
    var modal = document.getElementById('chartModal');
    var canvas = document.getElementById('chartCanvas');
    var titleEl = document.getElementById('chartModalTitle');
    if (!modal || !canvas || !titleEl) return;
    if (typeof Chart === 'undefined') { renderAIMessage('Chart library failed to load.'); return; }

    titleEl.textContent = title;
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }

    chartInstance = new Chart(canvas.getContext('2d'), {
      type: chartType,
      data: {
        labels: agg.labels,
        datasets: [{
          label: title,
          data: agg.values,
          backgroundColor: agg.labels.map(function (_, i) { return CHART_PALETTE[i % CHART_PALETTE.length]; }),
          borderColor: 'rgba(55,65,81,0.85)',
          borderWidth: chartType === 'line' ? 2 : 1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: chartType === 'pie' } },
        scales: chartType === 'pie' ? {} : { y: { beginAtZero: true } }
      }
    });

    modal.style.display = 'flex';
  }

  function closeChartModal() {
    var modal = document.getElementById('chartModal');
    if (modal) modal.style.display = 'none';
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
