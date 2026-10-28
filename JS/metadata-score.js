// Metadata score - how completely a layer is documented and made available, as a number from 0 to
// 100 and one of five classes (Bad ... Excellent). Shared by the map (the "Metadata score" line in
// the Layer information box, via JS/layer-control.js) and the About page (Data structure and
// metadata > Metadata score), so the two always agree.
//
// What is scored: the layer's description file (info/**/*.txt: a description line followed by
// "<p>Key: value<p/>" lines - the format JS/dataset-search.js also reads), how the layer is offered
// (download, format, search) and, for vector layers, which attribute fields of the data are empty
// (JS/attribute-report.js, which tools/build-attribute-report.mjs generates from the data files).
// It measures documentation and access only, not whether the data is accurate.
//
// Every factor earns a credit from 0 to 1 of its points: most are all or nothing, a few are graded
// (description, keywords, download format, empty fields). The points a factor earns are always a
// whole number, and so are the score of a layer and every average. A factor that cannot be assessed
// for a layer - the attribute fields of a raster, or of a layer the report has no entry for -
// returns null, is left out, and the score is scaled to the points that remain.
//
// A layer is described to this module as { name, file, geojson?, type?, infoFile? }, the same shape
// as an entry of layerCategories in JS/layer-control.js.
(function () {
  function hasText(value) { return typeof value === 'string' && value.length > 0; }

  // True for d-m-yyyy (also with / or . between the parts) and yyyy-mm-dd, if it is a real date.
  function isValidDate(value) {
    var year, month, day;
    var m = /^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/.exec(value);
    if (m) {
      day = +m[1]; month = +m[2]; year = +m[3];
    } else {
      m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);
      if (!m) return false;
      year = +m[1]; month = +m[2]; day = +m[3];
    }
    var d = new Date(year, month - 1, day);
    return d.getFullYear() === year && d.getMonth() === month - 1 && d.getDate() === day;
  }

  // A number with a unit: "12 MB", "950 KB", "1.2 GB", "340 bytes".
  function isFileSize(value) {
    return /\d+(?:[.,]\d+)?\s*(?:bytes?|[KMGT]?i?B)\b/i.test(value);
  }

  // Any year in the text counts: "2021", "2015-2025", "January 2023 - May 2025", "19-12-2025". The name of the EU
  // network "Natura 2000" is not a year.
  function hasYear(value) {
    return /\b(?:1[89]|20)\d{2}\b/.test(String(value || '').replace(/natura\s*2000/gi, ' '));
  }

  function wordCount(text) {
    return String(text || '').replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length;
  }

  // The longer the description, the more it earns: in proportion to its words, up to the full points at this length
  // (30 words is two or three sentences; the layers' descriptions run from 3 to 50 words).
  var DESCRIPTION_FULL_WORDS = 30;

  // What tools/build-attribute-report.mjs recorded about a layer's data (JS/attribute-report.js), or null.
  function attributeEntry(layer) {
    var report = window.AthensAttributeReport;
    return (report && report.layers && report.layers[layer.geojson || layer.file]) || null;
  }

  // Credit of a graded factor, one per class. Poor is not used by any factor yet.
  var GRADE = { bad: 0, poor: 0.25, fair: 0.5, good: 0.75, excellent: 1 };

  // Keywords: none is Bad, one or two Fair, three Good, four or more Excellent.
  function keywordGrade(count) {
    if (count >= 4) return GRADE.excellent;
    if (count >= 3) return GRADE.good;
    if (count >= 1) return GRADE.fair;
    return GRADE.bad;
  }

  function extensionOf(path) {
    var m = /\.([^.\/]+)$/.exec(String(path || ''));
    return m ? m[1].toLowerCase() : '';
  }

  // What the DOWNLOAD button in the layer list hands out, as JS/layer-control.js downloadLayerAsZip() picks it:
  // the original geojson of a tiled layer, else the layer file itself. Terrain and Shaded Relief are drawn outside
  // layerCategories (no row, so no button) and exist only as PMTiles, which cannot be downloaded.
  function downloadSource(layer) { return layer.geojson || layer.file; }
  function isDownloadable(layer) {
    var ext = extensionOf(downloadSource(layer));
    return !!ext && ext !== 'pmtiles';
  }

  // Formats that earn full credit; any other downloadable format earns half.
  var OPEN_FORMATS = { geojson: true, json: true, tif: true, tiff: true };
  var OTHER_FORMAT_CREDIT = GRADE.fair;

  // The factors, in the order the About page lists them. Points add up to 100. credit(c) gives 0-1, or
  // null when the factor cannot be assessed; c is { layer, meta (parseInfoText), entry (attribute report) }.
  var FACTORS = [
    { key: 'description', label: 'Description', short: 'Descr.', points: 15,
      rule: 'Longer descriptions earn more points, up to 30 words.',
      credit: function (c) { return Math.min(1, wordCount(c.meta.description) / DESCRIPTION_FULL_WORDS); } },
    { key: 'downloadable', label: 'Downloadable layer', short: 'Download', points: 10,
      rule: 'The layer is available for download.',
      credit: function (c) { return isDownloadable(c.layer) ? 1 : 0; } },
    { key: 'source', label: 'Source', short: 'Source', points: 15,
      rule: 'The source of the data is stated.',
      credit: function (c) { return hasText(c.meta.source) ? 1 : 0; } },
    { key: 'license', label: 'License', short: 'License', points: 15,
      rule: 'The license of the data is stated.',
      credit: function (c) { return hasText(c.meta.license) ? 1 : 0; } },
    { key: 'fileSize', label: 'File size', short: 'Size', points: 5,
      rule: 'The file size is stated.',
      credit: function (c) { return isFileSize(c.meta.fileSize) ? 1 : 0; } },
    { key: 'uploaded', label: 'Upload date', short: 'Uploaded', points: 5,
      rule: 'The upload date is stated.',
      credit: function (c) { return isValidDate(c.meta.uploaded) ? 1 : 0; } },
    { key: 'reference', label: 'Reference date', short: 'Ref. date', points: 5,
      rule: 'The year or period the data refers to is given, in the title or the description.',
      credit: function (c) { return hasYear(String(c.layer.name || '') + ' ' + c.meta.referenceText) ? 1 : 0; } },
    { key: 'keywords', label: 'Keywords', short: 'Keywords', points: 5,
      rule: 'Keywords are listed; more keywords earn more points, up to four.',
      credit: function (c) { return keywordGrade(c.meta.keywords.length); } },
    { key: 'searchable', label: 'Searchable in database search', short: 'Search', points: 5,
      rule: 'The layer can be found in the database search.',
      credit: function (c) { return hasText(c.layer.name) && hasText(c.layer.file) ? 1 : 0; } },
    { key: 'format', label: 'Downloadable format', short: 'Format', points: 10,
      rule: 'The download is GeoJSON, JSON or GeoTIFF; other formats earn half.',
      credit: function (c) {
        if (!isDownloadable(c.layer)) return 0;
        return OPEN_FORMATS[extensionOf(downloadSource(c.layer))] ? 1 : OTHER_FORMAT_CREDIT;
      } },
    { key: 'emptyFields', label: 'Empty attribute fields', short: 'Fields', points: 10,
      rule: 'Attribute values are filled in; empty values lower the points.',
      credit: function (c) {
        var e = c.entry;
        if (c.layer.type === 'raster' || !e || !(e.fieldCount > 0) || !(e.featureCount > 0) || typeof e.emptyValues !== 'number') return null;
        return Math.max(0, 1 - e.emptyValues / (e.fieldCount * e.featureCount));
      } }
  ];

  // Five equal classes over 0-100.
  var CLASSES = [
    { label: 'Bad', min: 0, max: 19 },
    { label: 'Poor', min: 20, max: 39 },
    { label: 'Fair', min: 40, max: 59 },
    { label: 'Good', min: 60, max: 79 },
    { label: 'Excellent', min: 80, max: 100 }
  ];

  function classify(score) {
    for (var i = CLASSES.length - 1; i >= 0; i--) {
      if (score >= CLASSES[i].min) return CLASSES[i];
    }
    return CLASSES[0];
  }

  // Description text -> the fields the factors look at. Same layout JS/dataset-search.js parses:
  // the lines before the first "<p>" line are the description, then one "<p>Key: value<p/>" each.
  function parseInfoText(raw) {
    var meta = { description: '', source: '', license: '', uploaded: '', fileSize: '', referenceText: '', keywords: [] };
    var descriptionLines = [];
    var otherLines = [];   // every line but the upload/update dates: where a reference date may be given
    var inTags = false;
    String(raw || '').split(/\r?\n/).forEach(function (line) {
      line = line.trim();
      if (!line) return;
      if (!inTags && line.charAt(0) !== '<') { descriptionLines.push(line); return; }
      inTags = true;
      var stripped = line.replace(/<\/?[^>]*>/g, '').trim();
      var idx = stripped.indexOf(':');
      var key = idx === -1 ? '' : stripped.slice(0, idx).trim().toLowerCase().replace(/\s+/g, ' ');
      // The dates the entry was uploaded or updated are not the date the data refers to.
      if (key !== 'uploaded' && key !== 'updated') otherLines.push(stripped);
      if (idx === -1) return;
      var value = stripped.slice(idx + 1).trim();
      if (!value) return;
      if (key === 'source') meta.source = value;
      else if (key === 'license' || key === 'license') meta.license = value;
      else if (key === 'uploaded') meta.uploaded = value;
      else if (key === 'file size' || key === 'filesize') meta.fileSize = value;
      else if (key === 'keywords') {
        meta.keywords = value.split(',').map(function (k) { return k.trim(); }).filter(function (k) { return k.length > 0; });
      }
    });
    meta.description = descriptionLines.join(' ');
    meta.referenceText = descriptionLines.concat(otherLines).join(' ');
    return meta;
  }

  // Where a layer's description file lives under info/ (the path JS/layer-control.js loads it from).
  function infoPathFor(layer) {
    return layer.infoFile || String(layer.file).replace(/\.[^/.]+$/, '') + '.txt';
  }

  // Scores one layer from its description text and the attribute report (JS/attribute-report.js). Returns
  // { score, label, factors: [{ key, label, short, points, applies, credit, earned }] } - per factor, the points
  // it is worth, whether it applied to the layer (false: left out), the share of them earned (0-1) and the points
  // earned: points * credit rounded to a whole number (the epsilon keeps an exact .5 from falling just below it).
  // The score is the earned points over the points of the factors that applied, as a whole percentage.
  function scoreLayer(layer, infoText) {
    var ctx = {
      layer: layer,
      meta: parseInfoText(infoText),
      entry: attributeEntry(layer)
    };
    var earned = 0, possible = 0;
    var factors = FACTORS.map(function (f) {
      var credit = f.credit(ctx);
      var applies = credit !== null;
      var points = applies ? Math.round(f.points * credit + 1e-9) : 0;
      if (applies) {
        possible += f.points;
        earned += points;
      }
      return { key: f.key, label: f.label, short: f.short, points: f.points, applies: applies,
               credit: applies ? credit : 0, earned: points };
    });
    var score = possible ? Math.round(earned / possible * 100) : 0;
    return { score: score, label: classify(score).label, factors: factors };
  }

  // Score for a group of layers (a category, or the whole app): the mean of their scores, plus how
  // many of them fall in each class. `results` are scoreLayer() results.
  function summarize(results) {
    var byClass = {};
    CLASSES.forEach(function (c) { byClass[c.label] = 0; });
    var sum = 0;
    results.forEach(function (r) { sum += r.score; byClass[r.label]++; });
    var score = results.length ? Math.round(sum / results.length) : 0;
    return { score: score, label: classify(score).label, count: results.length, byClass: byClass };
  }

  window.AthensMetadataScore = {
    factors: FACTORS.map(function (f) { return { key: f.key, label: f.label, short: f.short, points: f.points, rule: f.rule }; }),
    classes: CLASSES.map(function (c) { return { label: c.label, min: c.min, max: c.max }; }),
    classify: classify,
    parseInfoText: parseInfoText,
    infoPathFor: infoPathFor,
    scoreLayer: scoreLayer,
    summarize: summarize
  };
})();
