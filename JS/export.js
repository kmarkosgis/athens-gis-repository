// Initialize EasyPrint printer and attach export handler (no watermark)
(function(){
  var printBrandOverlay = null;
  var printScaleOverlay = null;
  var printLegendOverlay = null;
  var exportMapStyleBackup = null;
  var EXPORT_LEGEND_MAX_CLASSES = 25;
  var A4_BASE_WIDTH = 1045;
  var A4_BASE_HEIGHT = 715;
  var EXPORT_RESOLUTION_MULTIPLIER = 1.5;

  function formatScale(value){
    return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function getCurrentScaleText(map){
    if(!map || !map.getCenter || !map.getZoom) return 'Scale 1 : -';
    var center = map.getCenter();
    var zoom = map.getZoom();
    var metersPerPixel = 156543.03392804097 * Math.cos(center.lat * Math.PI / 180) / Math.pow(2, zoom);
    var rawScale = (metersPerPixel * 96) / 0.0254;
    var roundedScale = Math.max(1, Math.round(rawScale / 100) * 100);
    return 'Scale 1 : ' + formatScale(roundedScale);
  }

  function getActiveBaseTileLayer(){
    var ag = window.AthensGIS || {};
    var bases = ag.baseLayers || {};
    var key = ag.currentBaseLayerKey;
    var layer = key ? bases[key] : null;
    if(layer && typeof layer.isLoading === 'function') return layer;
    return null;
  }

  function ensurePrintOverlays(map){
    if(printBrandOverlay && printScaleOverlay && printLegendOverlay) return;
    if(!map || !map.getContainer) return null;
    var container = map.getContainer();
    if(!container) return null;

    // Keep overlays anchored to the map so EasyPrint captures them in the exported image.
    if(getComputedStyle(container).position === 'static'){
      container.style.position = 'relative';
    }

    if(!printBrandOverlay){
      var brand = document.createElement('div');
      brand.id = 'exportPrintBrandOverlay';
      brand.style.position = 'absolute';
      brand.style.top = '10px';
      brand.style.left = '10px';
      brand.style.display = 'none';
      brand.style.alignItems = 'center';
      brand.style.gap = '10px';
      brand.style.padding = '6px 10px';
      brand.style.borderRadius = '12px';
      brand.style.background = 'rgba(55, 65, 81, 0.5)';
      brand.style.border = '0px solid rgba(171, 199, 222, 0.9)';
      brand.style.boxShadow = '0 1px 3px rgba(0,0,0,0.25)';
      brand.style.color = 'black';
      brand.style.pointerEvents = 'none';
      brand.style.zIndex = '1200';

      var logo = document.createElement('img');
      logo.src = 'images/41.png';
      logo.alt = 'Athens GIS Repository';
      logo.style.width = 'auto';
      logo.style.height = '42px';
      logo.style.objectFit = 'contain';
      logo.style.flex = '0 0 auto';

      var title = document.createElement('span');
      title.textContent = '';
      title.style.color = 'rgba(17, 24, 39, 1)';
      title.style.fontFamily = '"Avenir Next", Avenir, "Helvetica Neue", "Segoe UI", Roboto, "Helvetica", Arial, sans-serif';
      title.style.fontSize = '18px';
      title.style.fontWeight = '600';
      title.style.letterSpacing = '0.7px';
      title.style.lineHeight = '1.1';
      title.style.whiteSpace = 'nowrap';

      brand.appendChild(logo);
      brand.appendChild(title);
      container.appendChild(brand);
      printBrandOverlay = brand;
    }

    if(!printScaleOverlay){
      var scale = document.createElement('div');
      scale.id = 'exportPrintScaleOverlay';
      scale.style.position = 'absolute';
      scale.style.left = '10px';
      scale.style.bottom = '10px';
      scale.style.display = 'none';
      scale.style.width = 'fit-content';
      scale.style.padding = '3px 8px';
      scale.style.borderRadius = '8px';
      scale.style.background = 'rgba(255,255,255,0.9)';
      scale.style.border = '0px solid rgba(171, 199, 222, 0.85)';
      scale.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';
      scale.style.color = 'rgba(31, 41, 55, 1)';
      scale.style.fontFamily = '"Avenir Next", Avenir, "Helvetica Neue", "Segoe UI", Roboto, "Helvetica", Arial, sans-serif';
      scale.style.fontSize = '11px';
      scale.style.fontWeight = '500';
      scale.style.whiteSpace = 'nowrap';
      scale.style.pointerEvents = 'none';
      scale.style.zIndex = '1200';
      container.appendChild(scale);
      printScaleOverlay = scale;
    }

    if(!printLegendOverlay){
      var legend = document.createElement('div');
      legend.id = 'exportPrintLegendOverlay';
      legend.style.position = 'absolute';
      legend.style.top = '10px';
      legend.style.right = '10px';
      legend.style.display = 'none';
      legend.style.maxWidth = '280px';
      legend.style.maxHeight = '44%';
      legend.style.overflowY = 'auto';
      legend.style.padding = '8px 10px';
      legend.style.borderRadius = '10px';
      legend.style.background = 'rgba(255,255,255,0.95)';
      legend.style.border = '0px solid rgba(171, 199, 222, 0.85)';
      legend.style.boxShadow = '0 1px 4px rgba(0,0,0,0.2)';
      legend.style.color = 'rgba(17, 24, 39, 1)';
      legend.style.fontFamily = '"Avenir Next", Avenir, "Helvetica Neue", "Segoe UI", Roboto, "Helvetica", Arial, sans-serif';
      legend.style.fontSize = '10px';
      legend.style.lineHeight = '1.3';
      legend.style.pointerEvents = 'none';
      legend.style.zIndex = '1200';
      container.appendChild(legend);
      printLegendOverlay = legend;
    }
  }

  function updatePrintScaleOverlay(map){
    if(!printScaleOverlay) return;
    printScaleOverlay.textContent = getCurrentScaleText(map);
  }

  function getExportLegendGroups(){
    var activeLayers = window.activeLegendLayers;
    var legendConfigs = window.legendConfigs || {};
    var groups = [];
    if(!activeLayers || !activeLayers.forEach) return groups;

    activeLayers.forEach(function(name){
      var cfg = legendConfigs[name];
      if(!cfg || !cfg.classes) return;
      var title = cfg.title || name;
      var group = null;
      for(var i = 0; i < groups.length; i++){
        if(groups[i].title === title){
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
    if(classCount === 0 || classCount > EXPORT_LEGEND_MAX_CLASSES){
      printLegendOverlay.style.display = 'none';
      printLegendOverlay.innerHTML = '';
      return;
    }

    var html = '<div style="font-size:11px; font-weight:700; letter-spacing:0.3px; margin-bottom:6px;">Legend</div>';
    groups.forEach(function(group){
      html += '<div style="font-size:10px; font-weight:600; margin:6px 0 3px;">' + group.title + '</div>';
      group.order.forEach(function(key){
        var item = group.items[key];
        html += '<div style="display:flex; align-items:flex-start; gap:6px; margin:2px 0;">';
        html += '<span style="width:10px; height:10px; min-width:10px; border-radius:2px; margin-top:2px; background:' + item.color + ';"></span>';
        html += '<span>' + item.label + '</span>';
        html += '</div>';
      });
    });

    printLegendOverlay.innerHTML = html;
    printLegendOverlay.style.display = 'block';
  }

  function showPrintOverlays(map){
    ensurePrintOverlays(map);
    updatePrintScaleOverlay(map);
    updatePrintLegendOverlay();
    if(printBrandOverlay) printBrandOverlay.style.display = 'flex';
    if(printScaleOverlay) printScaleOverlay.style.display = 'inline-block';
  }

  function hidePrintOverlays(){
    if(printBrandOverlay) printBrandOverlay.style.display = 'none';
    if(printScaleOverlay) printScaleOverlay.style.display = 'none';
    if(printLegendOverlay) printLegendOverlay.style.display = 'none';
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
          {
            name: 'A4 Landscape',
            className: 'A4Landscape page',
            width: A4_BASE_WIDTH * EXPORT_RESOLUTION_MULTIPLIER,
            height: A4_BASE_HEIGHT * EXPORT_RESOLUTION_MULTIPLIER
          },
          {
            name: 'A4 Portrait',
            className: 'A4Portrait page',
            width: A4_BASE_HEIGHT * EXPORT_RESOLUTION_MULTIPLIER,
            height: A4_BASE_WIDTH * EXPORT_RESOLUTION_MULTIPLIER
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
      // Wire the overlay to EasyPrint lifecycle events so we always show feedback while printing
      try {
        map.on('easyPrint-start', function(){ setExportMapLayoutOverrides(map); showOverlay(); showPrintOverlays(map); });
        map.on('easyPrint-finished', function(){ hideOverlay(); hidePrintOverlays(); clearExportMapLayoutOverrides(map); });
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

  // Populate menu from expected sizeModes. Use icons for A4 items.
  var modes = [
    { id: 'A4Landscape', icon: '<svg width="28" height="20" viewBox="0 0 28 20" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="1" y="1" width="26" height="18" rx="2" ry="2" fill="#ffffff" stroke="#2c3e50" stroke-width="1.5"/><line x1="4" y1="5" x2="24" y2="5" stroke="#2c3e50" stroke-width="1" stroke-linecap="round"/></svg>', title: 'A4 Landscape' },
    { id: 'A4Portrait', icon: '<svg width="20" height="28" viewBox="0 0 20 28" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="1" y="1" width="18" height="26" rx="2" ry="2" fill="#ffffff" stroke="#2c3e50" stroke-width="1.5"/><line x1="4" y1="6" x2="16" y2="6" stroke="#2c3e50" stroke-width="1" stroke-linecap="round"/></svg>', title: 'A4 Portrait' }
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
    // show overlay immediately for feedback (also handled by easyPrint-start event)
    setExportMapLayoutOverrides(map);
    showOverlay();
    showPrintOverlays(map);
    try { printer.printMap(targetClass, 'Map_Print'); }
    catch(e){ console.error('printMap error', e); hideOverlay(); hidePrintOverlays(); clearExportMapLayoutOverrides(map); return; }
    // wait for image and download; always hide overlay afterwards
    waitForAndDownloadImage().then(function(){ /* success */ }).catch(function(err){ console.error('Export failed', err); }).finally(function(){ hideOverlay(); hidePrintOverlays(); clearExportMapLayoutOverrides(map); });
  }

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
