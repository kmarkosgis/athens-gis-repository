// Initialize EasyPrint printer and attach export handler (no watermark)
(function(){
  // Export page layout (see layoutPrintOverlays), in the style of the 3D viewer's export
  // (code_3D/export3d.js): a slate gradient header band with the logo, title and date on top, a
  // footer line (copyright + the map's attribution) at the bottom, and between them a rectangular
  // map with rounded corners (frame) plus a panel with the Attica locator, a box per layer shown
  // in the map, and the legend.
  //  Landscape: panel on the right, top to bottom: locator, layer boxes, legend (stretched
  //  to fill the rest) - all the same width.
  //  Portrait: below the map, top to bottom: layer boxes, then one row of locator | legend.
  // The panel is kept as small as its content allows and the map takes all the rest of the page,
  // so nothing is left blank (bar the end of the layer boxes' last row).
  // Everything keeps EXPORT_PAGE_MARGIN from the page border and EXPORT_GAP from its neighbours,
  // and text wraps inside its box.
  var printBackdropOverlay = null;
  var printBackdropStrips = [];
  var printFrameOverlay = null;
  var printPanelOverlay = null;
  var printHeaderOverlay = null;
  var printBrandOverlay = null;
  var printBandOverlay = null;
  var printBandDate = null;
  var printFooterOverlay = null;
  var printFooterAttr = null;
  var printLocatorOverlay = null;
  var printLayersOverlay = null;
  var printScaleOverlay = null;
  var printLegendOverlay = null;
  var printLegendFills = [];
  var printLegendHost = null;
  var exportMapStyleBackup = null;
  var exportOriginalView = null;
  var exportClusteringSuspended = false;
  var exportRunId = 0;
  var exportGeo = null;
  var exportTheme = null;
  var exportLegendItems = null;
  var legendMetricsCache = {};
  var exportLegendCount = 0;
  var exportLegendTooMany = false;
  var EXPORT_LEGEND_MAX_CLASSES = 120;   // above this the legend isn't even attempted - just the message
  var EXPORT_FONT_FAMILY = '"Avenir Next", Avenir, "Helvetica Neue", "Segoe UI", Roboto, "Helvetica", Arial, sans-serif';
  var EXPORT_PAGE_MARGIN = 16;           // as in the 3D viewer's export
  var EXPORT_GAP = 12;
  var EXPORT_BORDER = '1px solid transparent';
  // The 3D viewer export's look (code_3D/export3d.js): same page, margin, header and footer sizes.
  var EXPORT_BAND_HEIGHT = 84;           // header band
  var EXPORT_FOOTER_HEIGHT = 34;
  var EXPORT_RADIUS = 10;                // rounded corners of the map and the boxes
  var EXPORT_SLATE = 'rgb(55, 65, 81)';  // the app's own dark grey: text, and the middle of the band
  var EXPORT_BAND_GRADIENT = [[0, 'rgb(75, 86, 105)'], [0.5, EXPORT_SLATE], [1, 'rgb(40, 48, 61)']];
  var EXPORT_BAND_TITLE = 'ATHENS GIS REPOSITORY';
  var EXPORT_BAND_LOGO = 'images/63.png';
  // The page is always white, whatever the basemap, with the boxes and legend a shade darker.
  var EXPORT_THEME = {
    page: '#ffffff',
    fill: '#eef2f6',
    text: 'rgba(17, 24, 39, 1)',
    locator: { land: '#d9e1ea', outline: '#475569', label: '#475569', rect: '#dc2626', rectFill: 'rgba(220,38,38,0.15)' }
  };
  var EXPORT_HEADER_MIN_WIDTH = 320;     // logo + locator width: this when the content is light...
  var EXPORT_HEADER_MAX_WIDTH = 400;     // ...up to this in a landscape column when a long legend needs the room
  var EXPORT_HEADER_STEP = 8;            // width steps tried between the two
  var EXPORT_LAYERS_MAX_PAGE_SHARE = 0.2;   // portrait: layer boxes never take more than this share of the page height
  var EXPORT_LOCATOR_PADDING = 8;
  var EXPORT_LOCATOR_MAX_SPAN = 3;       // zoomed far out: stop shrinking Attica beyond this many Attica-widths
  var EXPORT_LAYERS_SHARES = [0.4, 0.28, 0.18, 0.1];   // landscape: the share of the room under the header the layer boxes may take - the first, unless a long legend needs the room
  var EXPORT_LAYER_GAP = 6;
  var EXPORT_FONT_LAYER = 20;            // layer names
  var EXPORT_FONT_LEGEND = 15;           // legend group titles and entries
  var EXPORT_FONT_LEGEND_HEADING = 18;   // the "Legend" heading
  var EXPORT_FONT_LABEL = 13;            // scale bar, locator label, map attribution
  var EXPORT_DEFAULT_LAYER_FILL = '#8392AA';     // a layer with no legend config: the colours layer-control.js
  var EXPORT_DEFAULT_LAYER_BORDER = '#55647C';   // gives it until its COLOR button is used
  var EXPORT_LEGEND_PADDING = 8;
  var EXPORT_LEGEND_COLUMN_WIDTH = 178;
  var EXPORT_LEGEND_COLUMN_GAP = 14;    
  // Legend column widths, as designed first, then narrower ones that wrap the labels to fit more columns.
  var EXPORT_LEGEND_WIDTHS = [EXPORT_LEGEND_COLUMN_WIDTH, 150, 128, 110, 96];
  var EXPORT_HEADER_FLOOR_WIDTH = 208;   // portrait: logo + locator can shrink this far to give the legend room
  var EXPORT_ROW_GROW_STEP = 24;         // portrait: how much the bottom row grows, at most, to fit a long legend
  var EXPORT_ROW_MAX_PAGE_SHARE = 0.3;   // ...and its tallest, as a share of the page height
  var EXPORT_SCALE_MAX_WIDTH = 170;      // longest graphic scale bar, px
  var EXPORT_SCALE_SEGMENTS = 4;
  // Export page: 5:4 landscape, 4:5 portrait - the long and short side (CSS px) at the base size,
  // scaled by EXPORT_RESOLUTION_MULTIPLIER (1.25 gives whole pixels: 1300 x 1040).
  var EXPORT_BASE_LONG = 1040;
  var EXPORT_BASE_SHORT = 832;
  var EXPORT_RESOLUTION_MULTIPLIER = 1.25;

  function getActiveBaseTileLayer(){
    var ag = window.AthensGIS || {};
    var bases = ag.baseLayers || {};
    var key = ag.currentBaseLayerKey;
    var layer = key ? bases[key] : null;
    if(layer && typeof layer.isLoading === 'function') return layer;
    return null;
  }

  function ensurePrintOverlays(map){
    if(printFrameOverlay && printPanelOverlay) return;
    if(!map || !map.getContainer) return null;
    var container = map.getContainer();
    if(!container) return null;

    // Keep overlays anchored to the map so EasyPrint captures them in the exported image.
    if(getComputedStyle(container).position === 'static'){
      container.style.position = 'relative';
    }

    // Page background: four strips around the square map window (the window itself stays open to
    // the map). Each strip shows its own piece of one page-sized background, so a gradient runs
    // through all of them seamlessly. Sized and coloured in layoutPrintOverlays().
    var backdrop = document.createElement('div');
    backdrop.id = 'exportPrintBackdropOverlay';
    backdrop.style.position = 'absolute';
    backdrop.style.left = '0';
    backdrop.style.top = '0';
    backdrop.style.display = 'none';
    backdrop.style.pointerEvents = 'none';
    backdrop.style.zIndex = '1200';
    for(var i = 0; i < 4; i++){
      var strip = document.createElement('div');
      strip.style.position = 'absolute';
      strip.style.backgroundRepeat = 'no-repeat';
      backdrop.appendChild(strip);
      printBackdropStrips.push(strip);
    }
    container.appendChild(backdrop);
    printBackdropOverlay = backdrop;

    // Square map window. It hosts the scale, which keeps its bottom-left spot inside the map view.
    var frame = document.createElement('div');
    frame.id = 'exportPrintFrameOverlay';
    frame.style.position = 'absolute';
    frame.style.display = 'none';
    frame.style.boxSizing = 'border-box';
    frame.style.border = EXPORT_BORDER;
    // Rounded corners: the page colour, spread just past the window, covers the map's square corners.
    frame.style.borderRadius = EXPORT_RADIUS + 'px';
    frame.style.boxShadow = '0 0 0 ' + EXPORT_PAGE_MARGIN + 'px ' + EXPORT_THEME.page;
    frame.style.pointerEvents = 'none';
    frame.style.zIndex = '1200';
    container.appendChild(frame);
    printFrameOverlay = frame;

    // Remaining page area (transparent: the backdrop strips already cover it).
    var panel = document.createElement('div');
    panel.id = 'exportPrintPanelOverlay';
    panel.style.position = 'absolute';
    panel.style.display = 'none';
    panel.style.boxSizing = 'border-box';
    panel.style.overflow = 'hidden';
    panel.style.pointerEvents = 'none';
    panel.style.zIndex = '1200';
    container.appendChild(panel);
    printPanelOverlay = panel;

    // The Attica locator (the logo now sits in the header band).
    var header = document.createElement('div');
    header.id = 'exportPrintHeaderOverlay';
    header.style.display = 'flex';
    header.style.alignItems = 'flex-start';
    header.style.gap = EXPORT_GAP + 'px';
    header.style.position = 'absolute';
    header.style.left = '0';
    header.style.top = '0';
    panel.appendChild(header);
    printHeaderOverlay = header;

    // Not shown any more: kept so the layout code that sizes it still has an element.
    var brand = document.createElement('div');
    brand.id = 'exportPrintBrandOverlay';
    brand.style.display = 'none';
    printBrandOverlay = brand;
    header.appendChild(brand);

    // Area shown in the map relative to Attica: outline + extent rectangle, drawn in updatePrintLocatorOverlay().
    var locator = document.createElement('div');
    locator.id = 'exportPrintLocatorOverlay';
    locator.style.display = 'none';
    locator.style.position = 'relative';
    locator.style.flex = '0 0 auto';
    locator.style.boxSizing = 'border-box';
    locator.style.overflow = 'hidden';
    locator.style.border = EXPORT_BORDER;
    locator.style.borderRadius = EXPORT_RADIUS + 'px';
    header.appendChild(locator);
    printLocatorOverlay = locator;

    // One box per layer shown in the map, wrapping; filled by fitLayerBoxes().
    var layers = document.createElement('div');
    layers.id = 'exportPrintLayersOverlay';
    layers.style.display = 'none';
    layers.style.position = 'absolute';
    layers.style.left = '0';
    layers.style.flexWrap = 'wrap';
    layers.style.alignContent = 'flex-start';
    layers.style.gap = EXPORT_LAYER_GAP + 'px';
    panel.appendChild(layers);
    printLayersOverlay = layers;

    // Legend. The element is the whole area it may use; its fill is one or two rectangles (two when
    // it wraps around the header, see applyLegendBox) and its entries are placed column by column
    // by placeLegend(), so they can flow around the header.
    var legend = document.createElement('div');
    legend.id = 'exportPrintLegendOverlay';
    legend.style.display = 'none';
    legend.style.position = 'absolute';
    legend.style.boxSizing = 'border-box';
    legend.style.overflow = 'hidden';
    legend.style.fontFamily = EXPORT_FONT_FAMILY;
    legend.style.lineHeight = '1.1';
    printLegendFills = [document.createElement('div'), document.createElement('div')];
    printLegendFills.forEach(function(fill){
      fill.style.position = 'absolute';
      legend.appendChild(fill);
    });
    printLegendHost = document.createElement('div');
    printLegendHost.style.position = 'absolute';
    printLegendHost.style.left = '0';
    printLegendHost.style.top = '0';
    legend.appendChild(printLegendHost);
    panel.appendChild(legend);
    printLegendOverlay = legend;

    var scale = document.createElement('div');
    scale.id = 'exportPrintScaleOverlay';
    scale.style.position = 'absolute';
    scale.style.left = '10px';
    scale.style.bottom = '10px';
    scale.style.display = 'none';
    scale.style.width = 'fit-content';
    scale.style.padding = '5px 24px 6px';   // side room for the end label, centred on its tick
    scale.style.borderRadius = '8px';
    scale.style.background = 'rgba(255,255,255,0.9)';
    scale.style.border = '0px solid rgba(171, 199, 222, 0.85)';
    scale.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
    scale.style.color = 'rgba(31, 41, 55, 1)';
    scale.style.fontFamily = EXPORT_FONT_FAMILY;
    scale.style.fontSize = EXPORT_FONT_LABEL + 'px';
    scale.style.fontWeight = '500';
    scale.style.whiteSpace = 'nowrap';
    scale.style.pointerEvents = 'none';
    scale.style.zIndex = '1200';
    frame.appendChild(scale);
    printScaleOverlay = scale;

    // Header band (as in the 3D viewer's export): logo, title and the date, on a slate gradient.
    // Added after the panel, so it paints over the page and the map. Sized in layoutBandAndFooter().
    var band = document.createElement('div');
    band.id = 'exportPrintBandOverlay';
    band.style.position = 'absolute';
    band.style.left = '0';
    band.style.top = '0';
    band.style.display = 'none';
    band.style.alignItems = 'center';
    band.style.boxSizing = 'border-box';
    band.style.padding = '0 ' + (EXPORT_PAGE_MARGIN + 4) + 'px';
    band.style.gap = '18px';
    band.style.overflow = 'hidden';
    band.style.pointerEvents = 'none';
    band.style.zIndex = '1200';
    band.style.fontFamily = EXPORT_FONT_FAMILY;
    var bandLogo = document.createElement('img');
    bandLogo.src = EXPORT_BAND_LOGO;
    bandLogo.alt = 'Athens GIS Repository';
    bandLogo.style.display = 'block';
    bandLogo.style.height = '56px';
    bandLogo.style.width = 'auto';
    var bandTitle = document.createElement('span');
    bandTitle.textContent = EXPORT_BAND_TITLE;
    bandTitle.style.flex = '1 1 auto';
    bandTitle.style.minWidth = '0';
    bandTitle.style.whiteSpace = 'nowrap';
    bandTitle.style.color = '#f6f7f5';
    bandTitle.style.fontSize = '26px';
    bandTitle.style.fontWeight = '500';
    bandTitle.style.letterSpacing = '2px';
    printBandDate = document.createElement('span');
    printBandDate.style.flex = '0 0 auto';
    printBandDate.style.color = 'rgba(246, 247, 245, 0.8)';
    printBandDate.style.fontSize = '14px';
    printBandDate.style.fontWeight = '400';
    printBandDate.style.letterSpacing = '1px';
    band.appendChild(bandLogo);
    band.appendChild(bandTitle);
    band.appendChild(printBandDate);
    container.appendChild(band);
    printBandOverlay = band;

    // Footer line: the copyright on the left, the map's attribution on the right (shrunk to fit).
    var footer = document.createElement('div');
    footer.id = 'exportPrintFooterOverlay';
    footer.style.position = 'absolute';
    footer.style.display = 'none';
    footer.style.alignItems = 'center';
    footer.style.boxSizing = 'border-box';
    footer.style.height = EXPORT_FOOTER_HEIGHT + 'px';
    footer.style.color = EXPORT_SLATE;
    footer.style.fontFamily = EXPORT_FONT_FAMILY;
    footer.style.fontSize = EXPORT_FONT_LABEL + 'px';
    footer.style.fontWeight = '400';
    footer.style.pointerEvents = 'none';
    footer.style.zIndex = '1200';
    var footerLeft = document.createElement('span');
    footerLeft.style.flex = '0 0 auto';
    footerLeft.style.whiteSpace = 'nowrap';
    footerLeft.textContent = '© ' + new Date().getFullYear() + ' Athens GIS Repository | CC-BY 4.0 | athensgis.gr';
    printFooterAttr = document.createElement('span');
    printFooterAttr.style.flex = '1 1 0';
    printFooterAttr.style.minWidth = '0';
    printFooterAttr.style.marginLeft = '24px';
    printFooterAttr.style.textAlign = 'right';
    printFooterAttr.style.whiteSpace = 'nowrap';
    printFooterAttr.style.overflow = 'hidden';
    footer.appendChild(footerLeft);
    footer.appendChild(printFooterAttr);
    container.appendChild(footer);
    printFooterOverlay = footer;
  }

  // Size of the image EasyPrint will capture (it reads the container's inline size, truncated).
  function getExportImageSize(map){
    var container = map.getContainer();
    return {
      w: parseInt(container.style.width, 10) || container.clientWidth,
      h: parseInt(container.style.height, 10) || container.clientHeight
    };
  }

  function mercatorX(lng){ return lng * Math.PI / 180; }
  function mercatorY(lat){
    var s = Math.sin(lat * Math.PI / 180);
    return 0.5 * Math.log((1 + s) / (1 - s));
  }

  // The locator header, for a given total width: the locator box is the full width, as tall as the
  // logo + locator pair used to be (the logo moved to the header band), with Attica drawn at its
  // natural proportions inside it.
  // Without the outline data (JS/attica-outline.js) there is no locator, so no header at all.
  function getHeaderMetrics(headerWidth){
    var outline = window.ATTICA_OUTLINE;
    if(!outline || !outline.bbox || !outline.polygons || !outline.polygons.length){
      return { logo: 0, locatorW: 0, width: 0, height: 0 };
    }
    var b = outline.bbox;
    var aspect = (mercatorX(b[2]) - mercatorX(b[0])) / (mercatorY(b[3]) - mercatorY(b[1]));
    var chrome = 2 + 2 * EXPORT_LOCATOR_PADDING;            // locator border and padding
    var height = Math.floor((headerWidth - EXPORT_GAP - chrome * (1 - aspect)) / (1 + aspect));
    return { logo: 0, locatorW: headerWidth, width: headerWidth, height: height };
  }

  // Header widths to try, narrowest first: from the compact default up to the roomy width a
  // landscape column gets when a long legend needs it.
  function getHeaderWidths(){
    var widths = [];
    for(var w = EXPORT_HEADER_MIN_WIDTH; w < EXPORT_HEADER_MAX_WIDTH; w += EXPORT_HEADER_STEP) widths.push(w);
    widths.push(EXPORT_HEADER_MAX_WIDTH);
    return widths;
  }

  // Layout of the current export (set by layoutPrintOverlays): the page size, the map window
  // (frame: left, top, w, h) and the header sizes. Everything that works on the map view reads it.
  function getExportGeometry(){
    return exportGeo;
  }

  // Names of the layers currently shown in the map (kept up to date by layer-control.js).
  function getExportLayerNames(){
    var order = window.AthensGIS && window.AthensGIS.activeLayerOrder;
    return (order || []).filter(function(name){ return typeof name === 'string' && name; });
  }

  function createLayerBox(text){
    var box = document.createElement('div');
    box.textContent = text;
    box.style.boxSizing = 'border-box';
    box.style.maxWidth = '100%';
    box.style.padding = '6px 11px';
    box.style.border = EXPORT_BORDER;
    box.style.borderRadius = EXPORT_RADIUS + 'px';
    box.style.background = exportTheme.fill;
    box.style.color = exportTheme.text;
    box.style.fontFamily = EXPORT_FONT_FAMILY;
    box.style.fontSize = EXPORT_FONT_LAYER + 'px';
    box.style.fontWeight = '500';
    box.style.lineHeight = '1.2';
    box.style.overflowWrap = 'anywhere';
    return box;
  }

  // Fills the layer boxes container (its width must already be set and the panel displayed, since
  // the height is measured). Shows as many boxes as fit in maxHeight - the rest collapse into a
  // "+N more" box. Returns the height used, 0 when there are no layers.
  function fitLayerBoxes(names, maxHeight){
    var el = printLayersOverlay;
    el.innerHTML = '';
    if(!names.length){ el.style.display = 'none'; return 0; }
    el.style.display = 'flex';
    var shown = names.length;
    for(;;){
      el.innerHTML = '';
      for(var i = 0; i < shown; i++) el.appendChild(createLayerBox(names[i]));
      if(shown < names.length) el.appendChild(createLayerBox('+' + (names.length - shown) + ' more'));
      if(shown <= 1 || el.offsetHeight <= maxHeight) return el.offsetHeight;
      shown--;
    }
  }

  function getExportTheme(){
    return EXPORT_THEME;
  }

  // Page background (the four strips around the map window) and the theme's box/text colours.
  function applyExportTheme(geo){
    var f = geo.frame;
    var rects = [
      [0, 0, geo.width, f.top],                                   // top
      [0, f.top + f.h, geo.width, geo.height - f.top - f.h],      // bottom
      [0, f.top, f.left, f.h],                                    // left
      [f.left + f.w, f.top, geo.width - f.left - f.w, f.h]        // right
    ];
    printBackdropStrips.forEach(function(strip, i){
      var r = rects[i];
      strip.style.left = r[0] + 'px';
      strip.style.top = r[1] + 'px';
      strip.style.width = r[2] + 'px';
      strip.style.height = r[3] + 'px';
      strip.style.background = exportTheme.page;     // shorthand: size and position go after it
      strip.style.backgroundSize = geo.width + 'px ' + geo.height + 'px';
      strip.style.backgroundPosition = (-r[0]) + 'px ' + (-r[1]) + 'px';
      strip.style.backgroundRepeat = 'no-repeat';
    });
    printPanelOverlay.style.color = exportTheme.text;
    printLocatorOverlay.style.background = exportTheme.fill;
    printLegendFills.forEach(function(fill){ fill.style.background = exportTheme.fill; });
    printLegendOverlay.style.color = exportTheme.text;
  }

  // ---- Legend ---------------------------------------------------------------------------------
  // The legend is a list of entries placed column by column, top to bottom, inside a box. The box
  // may have a "notch": the header's rectangle in its top-left corner. Columns that run under the
  // header start below it, so the legend can use the room around the logo and locator.

  // Entries in reading order: a heading, then each group's title and its classes. A layer drawn in
  // a single colour (no legend config) is just one bold row - its name beside its symbol.
  function buildLegendItems(groups){
    var items = [{ kind: 'heading', html: 'Legend' }];
    groups.forEach(function(group){
      if(group.single){
        var only = group.items[group.order[0]];
        items.push({ kind: 'row', strong: true, html: only.label, color: only.color, border: only.border, geom: only.geom });
        return;
      }
      items.push({ kind: 'title', html: group.title });
      group.order.forEach(function(key){
        var item = group.items[key];
        items.push({ kind: 'row', html: item.label, color: item.color });
      });
    });
    return items;
  }

  // Swatch of a legend row. A class colour from a legend config is a plain square. A layer drawn
  // in a single colour gets the symbol it has on the map: a line, or an outlined point/polygon.
  function legendSwatchHtml(item, size){
    var base = 'width:' + size + 'px; height:' + size + 'px; min-width:' + size + 'px; margin-top:4px;';
    if(!item.border){
      return '<span style="' + base + ' border-radius:3px; background:' + item.color + ';"></span>';
    }
    if(item.geom === 'line'){
      return '<span style="' + base + ' position:relative;"><span style="position:absolute; left:0; right:0; top:50%; height:3px; margin-top:-1.5px; border-radius:2px; background:' + item.border + ';"></span></span>';
    }
    return '<span style="' + base + ' box-sizing:border-box; border:2px solid ' + item.border + '; border-radius:' + (item.geom === 'point' ? '50%' : '3px') + '; background:' + item.color + ';"></span>';
  }

  function createLegendItem(item, width){
    var f = EXPORT_FONT_LEGEND;
    var el = document.createElement('div');
    el.style.position = 'absolute';
    el.style.left = '0';
    el.style.top = '0';
    el.style.width = width + 'px';
    el.style.boxSizing = 'border-box';
    el.style.fontSize = f + 'px';
    if(item.kind === 'heading'){
      el.style.fontSize = EXPORT_FONT_LEGEND_HEADING + 'px';
      el.style.fontWeight = '700';
      el.style.letterSpacing = '0.3px';
      el.style.paddingBottom = '2px';
      el.innerHTML = item.html;
    } else if(item.kind === 'title'){
      el.style.fontWeight = '600';
      el.style.padding = '6px 0 3px';
      el.innerHTML = item.html;
    } else {
      var swatch = f - 2;
      el.style.display = 'flex';
      el.style.alignItems = 'flex-start';
      el.style.gap = '8px';
      el.style.padding = item.strong ? '6px 0 3px' : '2px 0';
      if(item.strong) el.style.fontWeight = '600';
      el.innerHTML =
        legendSwatchHtml(item, swatch) +
        '<span style="min-width:0; overflow-wrap:anywhere; line-height:1.2;">' + item.html + '</span>';
    }
    return el;
  }

  // Where the entries may go in a legend box. With `around` (and a notch) that is the whole box,
  // the columns under the header starting below it - an L shape. Without, just the part of the
  // box to the right of the header (or all of it when there is no notch): a plain rectangle.
  function legendRegion(box, notch, around){
    var pad = EXPORT_LEGEND_PADDING;
    var x0 = notch && !around ? notch.width + pad : pad;
    return { x0: x0, innerWidth: Math.max(1, box.width - x0 - pad), bottom: box.height - pad, notch: around ? notch : null };
  }

  // Builds the entries for a column width and measures them. The region is split into as many
  // columns as fit at that width, sharing the space, so labels only wrap when columns get narrower.
  function prepareLegend(columnWidth, innerWidth){
    var gap = EXPORT_LEGEND_COLUMN_GAP;
    var count = Math.max(1, Math.floor((innerWidth + gap) / (columnWidth + gap)));
    var width = Math.max(1, Math.floor((innerWidth - gap * (count - 1)) / count));
    printLegendHost.innerHTML = '';
    var els = exportLegendItems.map(function(item){
      var el = createLegendItem(item, width);
      printLegendHost.appendChild(el);
      return el;
    });
    return { els: els, heights: els.map(function(el){ return el.offsetHeight; }), count: count, width: width };
  }

  // Entry measurements for a column width and region width, measured once per layout.
  function legendMetrics(columnWidth, innerWidth){
    var key = columnWidth + '|' + innerWidth;
    if(!legendMetricsCache[key]){
      var prep = prepareLegend(columnWidth, innerWidth);
      legendMetricsCache[key] = { width: prep.width, count: prep.count, heights: prep.heights };
    }
    return legendMetricsCache[key];
  }

  // Where each entry goes in a region, or null if they don't all fit. A heading or title stays
  // with the entry after it; no entry is split.
  function legendSpots(prep, region){
    var pad = EXPORT_LEGEND_PADDING, gap = EXPORT_LEGEND_COLUMN_GAP;
    var bottom = region.bottom, notch = region.notch;
    function left(c){ return region.x0 + c * (prep.width + gap); }
    function top(c){ return notch && left(c) < notch.width ? notch.height + pad : pad; }
    var col = 0, y = top(0), spots = [];
    for(var i = 0; i < prep.heights.length; i++){
      var need = prep.heights[i] + (exportLegendItems[i].kind !== 'row' && i + 1 < prep.heights.length ? prep.heights[i + 1] : 0);
      while(y + need > bottom){
        col++;
        if(col >= prep.count) return null;
        y = top(col);
      }
      spots.push({ left: left(col), top: y });
      y += prep.heights[i];
    }
    return spots;
  }

  function placeLegend(prep, spots){
    prep.els.forEach(function(el, i){
      el.style.left = spots[i].left + 'px';
      el.style.top = spots[i].top + 'px';
    });
  }

  // Shown in the legend box when the legend can't be fitted in full.
  function renderPrintLegendMessage(box, notch){
    var pad = EXPORT_LEGEND_PADDING, indent = notch ? notch.width : 0;
    printLegendHost.innerHTML = '';
    var message = document.createElement('div');
    message.textContent = 'Legend not shown: too many classes (' + exportLegendCount + ')';
    message.style.position = 'absolute';
    message.style.left = (indent + pad) + 'px';
    message.style.top = pad + 'px';
    message.style.width = Math.max(0, box.width - indent - 2 * pad) + 'px';
    message.style.fontSize = EXPORT_FONT_LEGEND + 'px';
    message.style.fontWeight = '600';
    message.style.lineHeight = '1.25';
    printLegendHost.appendChild(message);
  }

  // Positions the legend element and its fill: one rectangle (everything right of the notch, if
  // any), or - with `around` - an L: that, plus the part under the notch.
  function applyLegendBox(box, notch, around){
    var legend = printLegendOverlay.style;
    legend.left = box.left + 'px';
    legend.top = box.top + 'px';
    legend.width = box.width + 'px';
    legend.height = box.height + 'px';
    var nw = notch ? notch.width : 0, nh = notch ? notch.height : 0;
    var right = printLegendFills[0].style, under = printLegendFills[1].style;
    right.left = nw + 'px';
    right.top = '0';
    right.width = Math.max(0, box.width - nw) + 'px';
    right.height = box.height + 'px';
    under.left = '0';
    under.top = nh + 'px';
    under.width = around ? nw + 'px' : '0';
    under.height = Math.max(0, box.height - nh) + 'px';
    // Rounded outer corners; where the two rectangles meet (the L's inside) they stay square.
    var r = EXPORT_RADIUS + 'px';
    right.borderRadius = around && nw ? r + ' ' + r + ' ' + r + ' 0' : r;
    under.borderRadius = r + ' 0 0 ' + r;
  }

  // ---- Page layout ----------------------------------------------------------------------------
  // Lays out the page. Every box keeps EXPORT_PAGE_MARGIN from the page border and EXPORT_GAP
  // from its neighbours, text wraps inside its box, and nothing is left empty: the map is a
  // rectangle that takes all the room the other elements don't need, so those are kept as small as
  // their content allows.
  //  Landscape: a column on the right (header = logo + locator, layer boxes, legend stretched to
  //  the bottom), all as wide as the header; the map fills the rest. The column is the narrowest
  //  one (from EXPORT_HEADER_MIN_WIDTH up) where the legend fits; failing that the legend text is
  //  wrapped into narrower columns, then the layer boxes give up room.
  //  Portrait: the layer boxes sit between the map and a bottom row of logo | locator | legend, the
  //  row as tall as the header; the map fills everything above. The legend spans the row, flowing
  //  around the header. If it doesn't fit it expands toward the logo and locator first (they
  //  shrink, and the legend takes the room they leave), then wraps its text into more, narrower
  //  columns, and only then makes the row taller (at the map's expense).
  // A legend that still can't be shown in full is replaced by a short message - never cut off.
  // Needs the panel displayed and the page-sized map container, since boxes are measured.
  function layoutPrintOverlays(map){
    if(!printFrameOverlay || !printPanelOverlay) return;
    var size = getExportImageSize(map);
    var m = EXPORT_PAGE_MARGIN, gap = EXPORT_GAP;
    var landscape = size.w >= size.h;
    var names = getExportLayerNames();
    var widths = getHeaderWidths();
    // Everything sits between the header band and the footer (+8: the footer's text has room to spare).
    var top0 = EXPORT_BAND_HEIGHT + m;
    var contentW = size.w - 2 * m, contentH = size.h - top0 - m - EXPORT_FOOTER_HEIGHT + 8;
    var textWidths = EXPORT_LEGEND_WIDTHS;                // as designed first, then narrower ones that wrap the labels
    var hasLegend = !!exportLegendItems;
    var mustFit = hasLegend && !exportLegendTooMany;      // too many classes: straight to the message
    var legendFits = false;
    var header, frame, panel, legend, notch = null, around = false;
    var headerPos = { left: 0, top: 0 };
    var i, prep, spots, region;
    legendMetricsCache = {};

    if(landscape){
      // Layer boxes (capped to a share of the column) and the legend box below them, for a column width.
      var arrange = function(column, share){
        var hdr = getHeaderMetrics(column);
        var boxesTop = hdr.height + gap;
        printLayersOverlay.style.left = '0';
        printLayersOverlay.style.top = boxesTop + 'px';
        printLayersOverlay.style.width = column + 'px';
        var boxesHeight = fitLayerBoxes(names, Math.floor((contentH - boxesTop) * share));
        var top = boxesTop + (boxesHeight ? boxesHeight + gap : 0);
        return { column: column, header: hdr, legend: { left: 0, top: top, width: column, height: Math.max(0, contentH - top) } };
      };
      var chosen = null;
      if(mustFit){
        // The legend comes before the layer boxes: if it can't fit even at the widest column with
        // wrapped text, the boxes get a smaller share of the column (more fold into "+N more").
        search:
        for(var s = 0; s < EXPORT_LAYERS_SHARES.length; s++){
          var candidate = null;
          for(i = 0; i < widths.length; i++){
            candidate = arrange(widths[i], EXPORT_LAYERS_SHARES[s]);
            region = legendRegion(candidate.legend, null, false);
            prep = prepareLegend(textWidths[0], region.innerWidth);
            if((spots = legendSpots(prep, region))){ placeLegend(prep, spots); chosen = candidate; break search; }
          }
          for(var t = 1; t < textWidths.length; t++){
            prep = prepareLegend(textWidths[t], region.innerWidth);
            if((spots = legendSpots(prep, region))){ placeLegend(prep, spots); chosen = candidate; break search; }
          }
        }
        legendFits = !!chosen;
      }
      if(!chosen) chosen = arrange(widths[0], EXPORT_LAYERS_SHARES[0]);   // no legend, or just its message
      header = chosen.header;
      legend = chosen.legend;
      frame = { left: m, top: top0, w: contentW - gap - chosen.column, h: contentH };
      panel = { left: m + frame.w + gap, top: top0, width: chosen.column, height: contentH };
    } else {
      printLayersOverlay.style.left = '0';
      printLayersOverlay.style.top = '0';
      printLayersOverlay.style.width = contentW + 'px';
      var namesHeight = fitLayerBoxes(names, Math.floor(size.h * EXPORT_LAYERS_MAX_PAGE_SHARE));
      var rowTop = namesHeight ? namesHeight + gap : 0;
      var boxFor = function(height){ return { left: 0, top: rowTop, width: contentW, height: height }; };
      var notchFor = function(hdr){ return { width: hdr.width + gap, height: hdr.height + gap }; };
      var base = getHeaderMetrics(widths[0]);               // the header when nothing is tight
      header = base;
      var rowH = base.height;
      if(mustFit){
        // Cheapest first: the row stays as tall as the header, the header shrinks step by step
        // (the legend takes its room), with the text as designed, then wrapped narrower; only
        // when none of that fits does the row grow, and then the same options are tried again.
        // At each try the legend first flows around the header (an L: it uses the room under the
        // header, if the row is tall enough for that), then just beside it.
        var rowMax = Math.floor(size.h * EXPORT_ROW_MAX_PAGE_SHARE);
        var found = null;
        search1:
        for(var rh = base.height; rh <= rowMax; rh += EXPORT_ROW_GROW_STEP){
          for(var w = 0; w < textWidths.length; w++){
            for(var hw = widths[0]; hw >= EXPORT_HEADER_FLOOR_WIDTH; hw -= EXPORT_HEADER_STEP){
              var hdr = getHeaderMetrics(hw);
              var hdrNotch = notchFor(hdr);
              for(var mode = 0; mode < 2; mode++){
                region = legendRegion(boxFor(rh), hdrNotch, mode === 0);
                spots = legendSpots(legendMetrics(textWidths[w], region.innerWidth), region);
                // Flowing around the header only counts if the legend starts in the first column
                // (under the header) - otherwise the box would just have an empty corner.
                if(spots && (mode === 1 || spots[0].left === region.x0)){
                  found = { rowH: rh, text: w, header: hdr, around: mode === 0 };
                  break search1;
                }
              }
            }
          }
        }
        if(found){
          header = found.header;
          rowH = found.rowH;
          around = found.around;
          notch = notchFor(header);
          region = legendRegion(boxFor(rowH), notch, around);
          prep = prepareLegend(textWidths[found.text], region.innerWidth);
          placeLegend(prep, legendSpots(prep, region));
          legendFits = true;
        }
      }
      if(!legendFits) notch = notchFor(header);              // no legend, or just its message
      legend = boxFor(rowH);
      frame = { left: m, top: top0, w: contentW, h: contentH - gap - rowTop - rowH };
      panel = { left: m, top: top0 + frame.h + gap, width: contentW, height: rowTop + rowH };
      headerPos.top = rowTop;
    }

    if(hasLegend){
      applyLegendBox(legend, notch, around);
      if(!legendFits) renderPrintLegendMessage(legend, notch);
    }

    exportGeo = { width: size.w, height: size.h, frame: frame, header: header, landscape: landscape };

    var logoPx = header.logo + 'px';
    printBrandOverlay.style.width = logoPx;
    printBrandOverlay.style.height = logoPx;
    printLocatorOverlay.style.display = header.locatorW ? 'block' : 'none';
    printLocatorOverlay.style.width = header.locatorW + 'px';
    printLocatorOverlay.style.height = header.height + 'px';

    printFrameOverlay.style.left = frame.left + 'px';
    printFrameOverlay.style.top = frame.top + 'px';
    printFrameOverlay.style.width = frame.w + 'px';
    printFrameOverlay.style.height = frame.h + 'px';

    printPanelOverlay.style.left = panel.left + 'px';
    printPanelOverlay.style.top = panel.top + 'px';
    printPanelOverlay.style.width = panel.width + 'px';
    printPanelOverlay.style.height = panel.height + 'px';

    printHeaderOverlay.style.left = headerPos.left + 'px';
    printHeaderOverlay.style.top = headerPos.top + 'px';

    applyExportTheme(exportGeo);
    layoutBandAndFooter(map, size);
  }

  // The header band (full width, at the top) and the footer line (between the page margins, at
  // the bottom). The attribution text is the map's own (its control is hidden in the export, see
  // placeControlCorners), shrunk until it fits beside the copyright.
  function layoutBandAndFooter(map, size){
    var m = EXPORT_PAGE_MARGIN;
    var band = printBandOverlay.style;
    band.width = size.w + 'px';
    band.height = EXPORT_BAND_HEIGHT + 'px';
    // The same gradient line as the 3D export's canvas one: from the top-left corner to the
    // bottom-right one of the band.
    var angle = Math.atan2(size.w, -EXPORT_BAND_HEIGHT) * 180 / Math.PI;
    band.background = 'linear-gradient(' + angle.toFixed(1) + 'deg, ' +
      EXPORT_BAND_GRADIENT.map(function(s){ return s[1] + ' ' + (s[0] * 100) + '%'; }).join(', ') + ')';
    printBandDate.textContent = new Date().toLocaleDateString('en-GB');

    var footer = printFooterOverlay.style;
    footer.left = m + 'px';
    footer.width = (size.w - 2 * m) + 'px';
    footer.top = (size.h - EXPORT_FOOTER_HEIGHT - 2) + 'px';
    var attribution = map.getContainer().querySelector('.leaflet-control-attribution');
    printFooterAttr.textContent = attribution ? attribution.textContent.replace(/\s+/g, ' ').trim() : '';
    var fontSize = EXPORT_FONT_LABEL;
    printFooterAttr.style.fontSize = fontSize + 'px';
    while(fontSize > 8 && printFooterAttr.scrollWidth > printFooterAttr.clientWidth){
      fontSize--;
      printFooterAttr.style.fontSize = fontSize + 'px';
    }
  }

  // Leaflet controls (notably the tile attribution) live in the corners of the map container.
  // Move those corners onto the map window so they stay inside the map view instead of ending up
  // under the page margin or the panel.
  function placeControlCorners(map){
    var geo = getExportGeometry(), f = geo.frame;
    var right = geo.width - f.left - f.w;
    var bottom = geo.height - f.top - f.h;
    Array.prototype.forEach.call(map.getContainer().querySelectorAll('.leaflet-top, .leaflet-bottom'), function(corner){
      var cls = corner.classList;
      if(cls.contains('leaflet-top')) corner.style.top = f.top + 'px';
      if(cls.contains('leaflet-bottom')) corner.style.bottom = bottom + 'px';
      if(cls.contains('leaflet-left')) corner.style.left = f.left + 'px';
      if(cls.contains('leaflet-right')) corner.style.right = right + 'px';
    });
    // The attribution moves into the page footer (layoutBandAndFooter), so the map's own is hidden.
    Array.prototype.forEach.call(map.getContainer().querySelectorAll('.leaflet-control-attribution'), function(el){
      el.style.display = 'none';
    });
  }

  function resetControlCorners(){
    var container = printFrameOverlay && printFrameOverlay.parentNode;
    if(!container) return;
    Array.prototype.forEach.call(container.querySelectorAll('.leaflet-top, .leaflet-bottom'), function(corner){
      corner.style.top = corner.style.right = corner.style.bottom = corner.style.left = '';
    });
    Array.prototype.forEach.call(container.querySelectorAll('.leaflet-control-attribution'), function(el){
      el.style.display = '';
    });
  }

  // EasyPrint centres the original view in the whole (resized) map container, but the visible
  // map is only the map window - shift the view so the window shows what the user was looking at.
  function recenterMapOnFrame(map){
    var f = getExportGeometry().frame;
    var mapSize = map.getSize();
    var dx = mapSize.x / 2 - (f.left + f.w / 2);
    var dy = mapSize.y / 2 - (f.top + f.h / 2);
    if(!dx && !dy) return;
    var zoom = map.getZoom();
    var target = map.unproject(map.project(map.getCenter(), zoom).add([dx, dy]), zoom);
    map.setView(target, zoom, { animate: false });
  }

  // Locator inset: Attica's outline with the area covered by the map window drawn on it.
  // Needs the final (recentred) view, so it runs after recenterMapOnFrame().
  function updatePrintLocatorOverlay(map){
    var geo = getExportGeometry(), f = geo.frame;
    var header = geo.header;
    if(!printLocatorOverlay || !header.locatorW) return;
    var size = { w: header.locatorW, h: header.height };
    var outline = window.ATTICA_OUTLINE;
    var b = outline.bbox;

    // Map extent of the window, in Web Mercator units like the outline.
    var nw = map.containerPointToLatLng([f.left, f.top]);
    var se = map.containerPointToLatLng([f.left + f.w, f.top + f.h]);
    var ex0 = mercatorX(nw.lng), ex1 = mercatorX(se.lng), ey0 = mercatorY(se.lat), ey1 = mercatorY(nw.lat);

    // View window = Attica plus the map extent, so an extent bigger than Attica still shows in full -
    // but clamped, so zooming far out can't shrink Attica to a dot.
    var ax0 = mercatorX(b[0]), ax1 = mercatorX(b[2]), ay0 = mercatorY(b[1]), ay1 = mercatorY(b[3]);
    var cx = (ax0 + ax1) / 2, cy = (ay0 + ay1) / 2;
    var limX = EXPORT_LOCATOR_MAX_SPAN * (ax1 - ax0) / 2, limY = EXPORT_LOCATOR_MAX_SPAN * (ay1 - ay0) / 2;
    function clamp(v, c, lim){ return Math.min(Math.max(v, c - lim), c + lim); }
    var x0 = Math.min(ax0, clamp(ex0, cx, limX)), x1 = Math.max(ax1, clamp(ex1, cx, limX));
    var y0 = Math.min(ay0, clamp(ey0, cy, limY)), y1 = Math.max(ay1, clamp(ey1, cy, limY));

    // Fit the window into the box (inside border and padding), centred.
    var innerW = size.w - 2, innerH = size.h - 2;
    var scale = Math.min((innerW - 2 * EXPORT_LOCATOR_PADDING) / (x1 - x0), (innerH - 2 * EXPORT_LOCATOR_PADDING) / (y1 - y0));
    var offsetX = (innerW - scale * (x1 - x0)) / 2;
    var offsetY = (innerH - scale * (y1 - y0)) / 2;
    function sx(mx){ return offsetX + (mx - x0) * scale; }
    function sy(my){ return offsetY + (y1 - my) * scale; }

    var d = '';
    outline.polygons.forEach(function(flat){
      for(var i = 0; i < flat.length; i += 2){
        d += (i ? 'L' : 'M') + sx(mercatorX(flat[i])).toFixed(1) + ' ' + sy(mercatorY(flat[i + 1])).toFixed(1);
      }
      d += 'Z';
    });

    // Never let the extent shrink to an invisible speck when zoomed in far.
    var rx0 = sx(ex0), rx1 = sx(ex1), ry0 = sy(ey1), ry1 = sy(ey0);
    var minSide = 7;
    if(rx1 - rx0 < minSide){ var mx = (rx0 + rx1) / 2; rx0 = mx - minSide / 2; rx1 = mx + minSide / 2; }
    if(ry1 - ry0 < minSide){ var my = (ry0 + ry1) / 2; ry0 = my - minSide / 2; ry1 = my + minSide / 2; }

    // The outline is stroked first and filled (opaque) on top, so only the outer edge of the stroke
    // survives: the Attica silhouette gets an outline without the borders between its units.
    var c = exportTheme.locator;
    printLocatorOverlay.innerHTML =
      '<svg xmlns="http://www.w3.org/2000/svg" width="' + innerW + '" height="' + innerH + '" viewBox="0 0 ' + innerW + ' ' + innerH + '" style="display:block;">' +
        '<path d="' + d + '" fill="none" stroke="' + c.outline + '" stroke-width="2.4" stroke-linejoin="round"/>' +
        '<path d="' + d + '" fill="' + c.land + '" stroke="' + c.land + '" stroke-width="0.6" stroke-linejoin="round"/>' +
        '<rect x="' + rx0.toFixed(1) + '" y="' + ry0.toFixed(1) + '" width="' + (rx1 - rx0).toFixed(1) + '" height="' + (ry1 - ry0).toFixed(1) + '" fill="' + c.rectFill + '" stroke="' + c.rect + '" stroke-width="2"/>' +
      '</svg>' +
      '<div style=\'position:absolute; right:6px; bottom:4px; font-family:' + EXPORT_FONT_FAMILY + '; font-size:' + EXPORT_FONT_LABEL + 'px; font-weight:600; line-height:1; color:' + c.label + ';\'>Attica</div>';
  }

  // EasyPrint's own restore only works when the centre never moved: its animated pan back is
  // cancelled by the setZoom() right after it. So put the user's view back ourselves.
  function restoreOriginalView(map){
    if(!exportOriginalView) return;
    var view = exportOriginalView;
    exportOriginalView = null;
    map.setView(view.center, view.zoom, { animate: false });
  }

  // Point clustering (layer-control.js) folds points into numbered bubbles; an exported map should
  // show the real points. layer-control.js skips clustering while AthensGIS.clusteringDisabled is
  // set, and re-clusters on every pan/zoom, so the export view gets plain points.
  function refreshPointClusters(){
    if(typeof window.recomputeSharedPointClusters !== 'function') return;
    try { window.recomputeSharedPointClusters(); }
    catch(e){ console.warn('Point refresh failed', e); }
  }

  function suspendPointClustering(){
    if(exportClusteringSuspended || !window.AthensGIS) return;
    exportClusteringSuspended = true;
    window.AthensGIS.clusteringDisabled = true;
  }

  // Safe to call any time (no-op unless an export suspended clustering), so every way an export
  // can end - finished, failed, or timed out - can call it.
  function resumePointClustering(){
    if(!exportClusteringSuspended) return;
    exportClusteringSuspended = false;
    window.AthensGIS.clusteringDisabled = false;
    refreshPointClusters();
  }

  // Largest "round" distance (1, 2 or 5 x a power of ten) not above maxMeters.
  function niceDistance(maxMeters){
    var pow = Math.pow(10, Math.floor(Math.log(maxMeters) / Math.LN10));
    var steps = [5, 2, 1];
    for(var i = 0; i < steps.length; i++){
      if(steps[i] * pow <= maxMeters) return steps[i] * pow;
    }
    return pow;
  }

  // Graphic scale bar: alternating dark/white segments, labelled at 0, the middle and the end.
  // Uses the metres per pixel at the view centre, and the exported image is 1 CSS px per px.
  function updatePrintScaleOverlay(map){
    if(!printScaleOverlay) return;
    var metersPerPixel = 156543.03392804097 * Math.cos(map.getCenter().lat * Math.PI / 180) / Math.pow(2, map.getZoom());
    var meters = niceDistance(EXPORT_SCALE_MAX_WIDTH * metersPerPixel);
    var width = Math.max(1, Math.round(meters / metersPerPixel));
    var unit = meters >= 1000 ? 'km' : 'm';
    var divisor = meters >= 1000 ? 1000 : 1;
    function label(fraction){ return String(+(meters * fraction / divisor).toFixed(2)); }
    function tick(fraction, text){
      return '<span style="position:absolute; top:0; left:' + Math.round(width * fraction) + 'px; width:56px; margin-left:-28px; text-align:center; line-height:1;">' + text + '</span>';
    }

    var segments = '';
    for(var i = 0; i < EXPORT_SCALE_SEGMENTS; i++){
      segments += '<div style="flex:1 1 0; background:' + (i % 2 ? '#ffffff' : 'rgba(31, 41, 55, 1)') + ';"></div>';
    }
    printScaleOverlay.innerHTML =
      '<div style="position:relative; width:' + width + 'px; height:' + (EXPORT_FONT_LABEL + 12) + 'px;">' +
        tick(0, label(0)) + tick(0.5, label(0.5)) + tick(1, label(1) + ' ' + unit) +
        '<div style="position:absolute; left:0; bottom:0; width:' + width + 'px; height:8px; box-sizing:border-box; display:flex; border:1px solid rgba(31, 41, 55, 1);">' + segments + '</div>' +
      '</div>';
  }

  function escapeLegendHtml(text){
    return String(text).replace(/[&<>"']/g, function(c){
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // A layer with no legend config (JS/legend.js) is drawn in one colour - the outline/fill pair
  // the layer's COLOR button changes (AthensGIS.customLayerColors) - so its legend entry is that
  // colour beside the layer's name. Null for a raster, which has no single colour to show.
  function getSingleColorLegendGroup(name){
    var ag = window.AthensGIS || {};
    var geom = ag.layerGeomByName && ag.layerGeomByName[name];
    if(geom === 'raster') return null;
    var colors = ag.customLayerColors && ag.customLayerColors[name];
    var fill = (colors && colors.fill) || EXPORT_DEFAULT_LAYER_FILL;
    var border = (colors && colors.border) || EXPORT_DEFAULT_LAYER_BORDER;
    var key = name + '|' + fill;
    var items = {};
    items[key] = { label: escapeLegendHtml(name), color: fill, border: border, geom: geom };
    return { title: name, single: true, order: [key], items: items };
  }

  // The legend covers every layer shown in the map, in the order they were switched on: one with a
  // legend config contributes its classes, any other one a single entry in its own colour.
  function getExportLegendGroups(){
    var activeLayers = window.activeLegendLayers;
    var legendConfigs = window.legendConfigs || {};
    var groups = [];
    var names = getExportLayerNames();
    if(activeLayers && activeLayers.forEach){
      activeLayers.forEach(function(name){
        if(names.indexOf(name) === -1) names.push(name);
      });
    }

    names.forEach(function(name){
      var cfg = legendConfigs[name];
      if(!cfg){
        var single = getSingleColorLegendGroup(name);
        if(single) groups.push(single);
        return;
      }
      if(!cfg.classes) return;
      var title = cfg.title || name;
      var group = null;
      for(var i = 0; i < groups.length; i++){
        if(!groups[i].single && groups[i].title === title){
          group = groups[i];
          break;
        }
      }
      if(!group){
        group = { title: title, order: [], items: {} };
        groups.push(group);
      }

      Object.entries(cfg.classes).forEach(function(entry){
        var clsName = entry[0];
        var style = entry[1] || {};
        var label = style.label || clsName;
        var color = style.color || '#d1d5db';
        var key = label + '|' + color;
        if(!Object.prototype.hasOwnProperty.call(group.items, key)){
          group.items[key] = { label: label, color: color };
          group.order.push(key);
        }
      });
    });

    return groups.filter(function(g){ return g.order.length > 0; });
  }

  function getExportLegendClassCount(groups){
    return groups.reduce(function(total, group){
      return total + group.order.length;
    }, 0);
  }

  function updatePrintLegendOverlay(){
    if(!printLegendOverlay) return;

    var groups = getExportLegendGroups();
    var classCount = getExportLegendClassCount(groups);
    printLegendHost.innerHTML = '';
    if(classCount === 0){
      exportLegendItems = null;
      exportLegendCount = 0;
      exportLegendTooMany = false;
      printLegendOverlay.style.display = 'none';
      return;
    }

    exportLegendItems = buildLegendItems(groups);
    exportLegendCount = classCount;
    exportLegendTooMany = classCount > EXPORT_LEGEND_MAX_CLASSES;
    printLegendOverlay.style.display = 'block';   // filled by layoutPrintOverlays(), once the box has its size
  }

  function showPrintOverlays(map){
    ensurePrintOverlays(map);
    exportTheme = getExportTheme();   // by the basemap in use, fixed for the whole export
    updatePrintScaleOverlay(map);
    updatePrintLegendOverlay();
    // Displayed before the layout, which measures the layer boxes.
    if(printBackdropOverlay) printBackdropOverlay.style.display = 'block';
    if(printFrameOverlay) printFrameOverlay.style.display = 'block';
    if(printPanelOverlay) printPanelOverlay.style.display = 'block';
    if(printScaleOverlay) printScaleOverlay.style.display = 'inline-block';
    if(printBandOverlay) printBandOverlay.style.display = 'flex';
    if(printFooterOverlay) printFooterOverlay.style.display = 'flex';
    layoutPrintOverlays(map);
    placeControlCorners(map);
  }

  function hidePrintOverlays(){
    if(printBackdropOverlay) printBackdropOverlay.style.display = 'none';
    if(printFrameOverlay) printFrameOverlay.style.display = 'none';
    if(printPanelOverlay) printPanelOverlay.style.display = 'none';
    if(printScaleOverlay) printScaleOverlay.style.display = 'none';
    if(printBandOverlay) printBandOverlay.style.display = 'none';
    if(printFooterOverlay) printFooterOverlay.style.display = 'none';
    if(printLayersOverlay) printLayersOverlay.style.display = 'none';
    if(printLegendOverlay) printLegendOverlay.style.display = 'none';
    resetControlCorners();
  }

  function setExportMapLayoutOverrides(map){
    if(!map || !map.getContainer || exportMapStyleBackup) return;
    var container = map.getContainer();
    if(!container || !container.style) return;
    exportMapStyleBackup = {
      position: container.style.position,
      inset: container.style.inset,
      top: container.style.top,
      right: container.style.right,
      bottom: container.style.bottom,
      left: container.style.left,
      maxWidth: container.style.maxWidth,
      maxHeight: container.style.maxHeight,
      minWidth: container.style.minWidth,
      minHeight: container.style.minHeight
    };
    // The app map is fixed/inset in normal UI. EasyPrint re-parents the map container,
    // so force it to normal absolute positioning while exporting.
    container.style.setProperty('position', 'absolute', 'important');
    container.style.setProperty('inset', 'auto', 'important');
    container.style.setProperty('top', '0', 'important');
    container.style.setProperty('left', '0', 'important');
    container.style.setProperty('right', 'auto', 'important');
    container.style.setProperty('bottom', 'auto', 'important');
    // Remove viewport clamps so EasyPrint can grow the map to export dimensions.
    container.style.setProperty('max-width', 'none', 'important');
    container.style.setProperty('max-height', 'none', 'important');
    container.style.setProperty('min-width', '0', 'important');
    container.style.setProperty('min-height', '0', 'important');
  }

  function clearExportMapLayoutOverrides(map){
    if(!map || !map.getContainer || !exportMapStyleBackup) return;
    var container = map.getContainer();
    if(!container || !container.style) return;
    container.style.position = exportMapStyleBackup.position;
    container.style.inset = exportMapStyleBackup.inset;
    container.style.top = exportMapStyleBackup.top;
    container.style.right = exportMapStyleBackup.right;
    container.style.bottom = exportMapStyleBackup.bottom;
    container.style.left = exportMapStyleBackup.left;
    container.style.maxWidth = exportMapStyleBackup.maxWidth;
    container.style.maxHeight = exportMapStyleBackup.maxHeight;
    container.style.minWidth = exportMapStyleBackup.minWidth;
    container.style.minHeight = exportMapStyleBackup.minHeight;
    exportMapStyleBackup = null;
  }

  function initPrinter(){
    if(!window.AthensGIS || !window.AthensGIS.map || !L.easyPrint) {
      return setTimeout(initPrinter, 150);
    }
    if(window.AthensGIS._easyPrinter) return; // already created
    try {
      var map = window.AthensGIS.map;
      var printer = L.easyPrint({
        title: 'Print map',
        position: 'topleft',
        sizeModes: [
          // The class names keep their old "A4" spelling: they are internal ids (see
          // triggerPrintForMode and the AI assistant's export_map format), not what the page looks like.
          {
            name: 'Landscape 5:4',
            className: 'A4Landscape page',
            width: EXPORT_BASE_LONG * EXPORT_RESOLUTION_MULTIPLIER,
            height: EXPORT_BASE_SHORT * EXPORT_RESOLUTION_MULTIPLIER
          },
          {
            name: 'Portrait 4:5',
            className: 'A4Portrait page',
            width: EXPORT_BASE_SHORT * EXPORT_RESOLUTION_MULTIPLIER,
            height: EXPORT_BASE_LONG * EXPORT_RESOLUTION_MULTIPLIER
          }
        ],
        filename: 'Map_Print',
        exportOnly: true,
        tileLayer: getActiveBaseTileLayer(),
        hidden: true,
        hideControlContainer: false
      }).addTo(map);
      ensurePrintOverlays(map);
      window.AthensGIS._easyPrinter = printer;
      // The export layout needs the page-sized map, so it is applied right after EasyPrint resizes
      // the map container (the snapshot EasyPrint takes before that stays a plain map view).
      var resizeAndPrintMap = printer._resizeAndPrintMap;
      if(typeof resizeAndPrintMap === 'function'){
        printer._resizeAndPrintMap = function(){
          resizeAndPrintMap.apply(this, arguments);
          try {
            showPrintOverlays(map);   // reads the scale at the original view centre, so it goes first
            recenterMapOnFrame(map);
            updatePrintLocatorOverlay(map);   // needs the recentred view
          } catch(e){ console.warn('Export layout failed', e); }
          refreshPointClusters();   // draw the plain points for the final export view
        };
      } else {
        console.warn('EasyPrint._resizeAndPrintMap not found; export layout disabled');
      }
      // Wire the overlay to EasyPrint lifecycle events so we always show feedback while printing
      try {
        map.on('easyPrint-start', function(){ exportOriginalView = { center: map.getCenter(), zoom: map.getZoom() }; suspendPointClustering(); setExportMapLayoutOverrides(map); showOverlay(); });
        map.on('easyPrint-finished', function(){ hideOverlay(); hidePrintOverlays(); clearExportMapLayoutOverrides(map); restoreOriginalView(map); resumePointClustering(); });
      } catch(e){ /* ignore if map/event not available */ }
    } catch(e){
      console.warn('EasyPrint init failed', e);
    }
  }
  initPrinter();

  // Export button wiring: show vertical size menu above the button
  var btn = document.getElementById('exportBtn');
  
  if(!btn) return;

  // create the floating menu element (hidden by default)
  var sizeMenu = document.createElement('ul');
  sizeMenu.id = 'exportSizeMenu';
  sizeMenu.style.position = 'absolute';
  sizeMenu.style.minWidth = '70px';
  sizeMenu.style.minHeight = '80px';
  sizeMenu.style.padding = '4px';
  sizeMenu.style.marginTop = '-1px';
  sizeMenu.style.gap = '2px';
  sizeMenu.style.listStyle = 'none';
  sizeMenu.style.background = 'rgba(255,255,255,1)';
  sizeMenu.style.border = '0px solid';
  sizeMenu.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
  sizeMenu.style.borderRadius = '14px';
  sizeMenu.style.zIndex = '9999';
  sizeMenu.style.display = 'none';
  sizeMenu.style.flexDirection = 'column';
  sizeMenu.style.fontFamily = 'Newsreader, Arial, sans-serif';
  sizeMenu.style.fontSize = '16px';
  // enable smooth show/hide transition
  sizeMenu.style.transitionDuration = '0.2s';
  

  // Helper to add an item. Accepts either a string label or an object {id, label, icon, title}
  function addMenuItem(itemDef){
    var li = document.createElement('li');
    li.style.padding = '0px';
    li.style.cursor = 'pointer';
    li.style.border = '2px solid rgba(255,255,255,0.1)';
    li.style.borderRadius = '12px';
    li.style.transition = 'border 0.2s';
    li.onmouseenter = function(){ li.style.border = '2px solid rgba(55, 65, 81, 0.85)'; li.style.boxShadow = '0 1px 4px rgba(0,0,0,0.3)'; };
    li.onmouseleave = function(){ li.style.border = '2px solid rgba(255,255,255,0.1)'; li.style.boxShadow = 'none';};

    if(typeof itemDef === 'string'){
      li.textContent = itemDef;
      li.setAttribute('data-id', itemDef);
    } else if(typeof itemDef === 'object'){
      li.setAttribute('data-id', itemDef.id || '');
      if(itemDef.icon){
        li.style.display = 'flex';
        li.style.alignItems = 'center';
        li.style.justifyContent = 'center';
        li.style.padding = '10px';
        li.innerHTML = itemDef.icon;
      } else {
        li.textContent = itemDef.label || '';
      }
      if(itemDef.title) li.title = itemDef.title;
      if(!li.textContent && itemDef.title) li.setAttribute('aria-label', itemDef.title);
    }

    sizeMenu.appendChild(li);
    return li;
  }

  // Populate menu from expected sizeModes. Use icons drawn at the export proportions (5:4 / 4:5).
  var modes = [
    { id: 'A4Landscape', icon: '<svg width="27" height="22" viewBox="0 0 27 22" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="1" y="1" width="25" height="20" rx="2" ry="2" fill="#ffffff" stroke="#2c3e50" stroke-width="1.5"/><line x1="4" y1="5" x2="23" y2="5" stroke="#2c3e50" stroke-width="1" stroke-linecap="round"/></svg>', title: 'Landscape 5:4' },
    { id: 'A4Portrait', icon: '<svg width="22" height="27" viewBox="0 0 22 27" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="1" y="1" width="20" height="25" rx="2" ry="2" fill="#ffffff" stroke="#2c3e50" stroke-width="1.5"/><line x1="4" y1="6" x2="18" y2="6" stroke="#2c3e50" stroke-width="1" stroke-linecap="round"/></svg>', title: 'Portrait 4:5' }
  ];
  modes.forEach(function(m){
    var item = addMenuItem(m);
    item.addEventListener('click', function(e){
      e.stopPropagation();
      hideMenu();
      triggerPrintForMode(m.id);
    });
  });

  document.body.appendChild(sizeMenu);

  // Create a loading overlay (hidden by default)
  var loadingOverlay = document.createElement('div');
  loadingOverlay.id = 'exportLoadingOverlay';
  loadingOverlay.style.position = 'fixed';
  loadingOverlay.style.left = '0';
  loadingOverlay.style.top = '0';
  loadingOverlay.style.width = '100%';
  loadingOverlay.style.height = '100%';
  loadingOverlay.style.display = 'none';
  loadingOverlay.style.alignItems = 'center';
  loadingOverlay.style.justifyContent = 'center';
  loadingOverlay.style.zIndex = '10000';
  loadingOverlay.style.background = 'rgba(255,255,255,0.7)';

  // spinner container
  var spinner = document.createElement('div');
  spinner.id = 'exportSpinner';
  spinner.style.width = '64px';
  spinner.style.height = '64px';
  spinner.style.border = '6px solid rgba(0,0,0,0.08)';
  spinner.style.borderTop = '6px solid #2c3e50';
  spinner.style.borderRadius = '50%';
  spinner.style.boxSizing = 'border-box';
  spinner.style.animation = 'export-spin 1s linear infinite';
  loadingOverlay.appendChild(spinner);

  // inject keyframes for spinner
  (function(){
    var s = document.createElement('style');
    s.type = 'text/css';
    s.appendChild(document.createTextNode('@keyframes export-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }'));
    document.head.appendChild(s);
  })();

  document.body.appendChild(loadingOverlay);

  function showOverlay(){ loadingOverlay.style.display = 'flex'; }
  function hideOverlay(){ loadingOverlay.style.display = 'none'; }

  // Position and show/hide helpers
  // Show menu with a smooth transition
  function showMenu(){
    var rect = btn.getBoundingClientRect();
    // make it layout so we can measure
    sizeMenu.style.display = 'flex';
    // ensure it's invisible and slightly shifted before measuring
    sizeMenu.style.opacity = '0';
    sizeMenu.style.transform = 'translateY(6px)';
    var menuRect = sizeMenu.getBoundingClientRect();
    var left = rect.left + (rect.width / 2) - (menuRect.width / 2);
    left = Math.max(8, left); // don't go off left edge
    var top = rect.top - menuRect.height - 8; // 8px gap above button
    if(top < 8){ // not enough space above, place below
      top = rect.bottom + 8;
    }
    sizeMenu.style.left = left + 'px';
    sizeMenu.style.top = top + 'px';
    // force reflow then animate to visible
    // eslint-disable-next-line no-unused-expressions
    sizeMenu.offsetHeight;
    sizeMenu.style.opacity = '1';
    sizeMenu.style.transform = 'translateY(0)';
  }

  // Hide menu with transition; set display:none after transition completes
  function hideMenu(){
    sizeMenu.style.opacity = '0';
    sizeMenu.style.transform = 'translateY(6px)';
  }

  // After hide transition, remove from layout
  sizeMenu.addEventListener('transitionend', function(e){
    if(e.propertyName === 'opacity' && sizeMenu.style.opacity === '0'){
      sizeMenu.style.display = 'none';
    }
  });

  // Click export button toggles menu
  btn.addEventListener('click', function(e){
    e.stopPropagation();
    if(sizeMenu.style.display === 'flex'){
      hideMenu();
    } else {
      showMenu();
    }
  });

  // Close menu on outside click or Esc
  document.addEventListener('click', function(){ hideMenu(); });
  document.addEventListener('keydown', function(ev){ if(ev.key === 'Escape') hideMenu(); });

  // Map a friendly mode to the class/name easyPrint expects and trigger print + download
  function triggerPrintForMode(mode){
    var map = (window.AthensGIS && window.AthensGIS.map) ? window.AthensGIS.map : null;
    if(!map){ console.warn('Map not ready'); return; }
    var printer = window.AthensGIS && window.AthensGIS._easyPrinter;
    if(!printer){
      console.warn('Printer not ready yet, retrying shortly...');
      return setTimeout(function(){ triggerPrintForMode(mode); }, 250);
    }
    var activeBaseLayer = getActiveBaseTileLayer();
    if(activeBaseLayer){
      printer.options.tileLayer = activeBaseLayer;
    }
    var targetClass = (mode === 'Current') ? 'CurrentSize' : (mode === 'A4Landscape' ? 'A4Landscape page' : 'A4Portrait page');
    var runId = ++exportRunId;
    // show overlay immediately for feedback (also handled by easyPrint-start event)
    setExportMapLayoutOverrides(map);
    showOverlay();
    try { printer.printMap(targetClass, 'Map_Print'); }
    catch(e){ console.error('printMap error', e); hideOverlay(); hidePrintOverlays(); clearExportMapLayoutOverrides(map); resumePointClustering(); return; }
    // wait for image and download; always hide overlay afterwards. Clustering is normally back
    // already (easyPrint-finished) - this is the net for an export that never finishes, and it
    // must not touch an export started since.
    waitForAndDownloadImage().then(function(){ /* success */ }).catch(function(err){ console.error('Export failed', err); }).finally(function(){ hideOverlay(); hidePrintOverlays(); clearExportMapLayoutOverrides(map); if(runId === exportRunId) resumePointClustering(); });
  }
  // Exposed so the AI assistant can trigger a map export - mode: 'A4Landscape' |
  // 'A4Portrait'. Retries itself if the printer isn't ready yet, same as a real click.
  (window.AthensGIS = window.AthensGIS || {}).exportMap = triggerPrintForMode;

  // Wait for the EasyPrint image to appear, then try to fetch and save it using FileSaver (if available).
  // If fetch/save fails (CORS), open the image in a new tab as a fallback.
  function waitForAndDownloadImage(){
    return new Promise(function(resolve, reject){
      var start = performance.now();
      var timeoutMs = 20000;
      (function waitImg(){
        var img = document.querySelector('.leaflet-print img, .leaflet-print > img');
        if(img && (img.naturalWidth || img.complete)){
          var src = img.src;
          // Try to fetch the image blob (CORS) and save via saveAs (FileSaver.js is included in index.html).
          fetch(src, { mode: 'cors' }).then(function(resp){
            if(!resp.ok) throw new Error('fetch failed');
            return resp.blob();
          }).then(function(blob){
            if(typeof saveAs === 'function'){
              saveAs(blob, 'Map_Print.png');
            } else {
              var url = URL.createObjectURL(blob);
              var a = document.createElement('a'); a.href = url; a.download = 'Map_Print.png'; a.click();
              setTimeout(function(){ URL.revokeObjectURL(url); }, 1500);
            }
            resolve();
          }).catch(function(err){
            console.warn('Fetch/save failed (likely CORS). Opening image in new tab as fallback.', err);
            try{ window.open(src, '_blank'); resolve(); } catch(e){ reject(e); }
          });
          return;
        }
        if(performance.now() - start < timeoutMs){ return setTimeout(waitImg, 150); }
        reject(new Error('timeout'));
      })();
    });
  }

})();
