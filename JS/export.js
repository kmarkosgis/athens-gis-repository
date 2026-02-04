// Initialize EasyPrint printer and attach export handler (no watermark)
(function(){
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
        sizeModes: [ 'A4Landscape', 'A4Portrait'],
        filename: 'Map_Print',
        exportOnly: true,
        hidden: true,
        hideControlContainer: false
      }).addTo(map);
      window.AthensGIS._easyPrinter = printer;
      // Wire the overlay to EasyPrint lifecycle events so we always show feedback while printing
      try {
        map.on('easyPrint-start', function(){ showOverlay(); });
        map.on('easyPrint-finished', function(){ hideOverlay(); });
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
    var targetClass = (mode === 'Current') ? 'CurrentSize' : (mode === 'A4Landscape' ? 'A4Landscape page' : 'A4Portrait page');
    // show overlay immediately for feedback (also handled by easyPrint-start event)
    showOverlay();
    try { printer.printMap(targetClass, 'Map_Print'); }
    catch(e){ console.error('printMap error', e); hideOverlay(); return; }
    // wait for image and download; always hide overlay afterwards
    waitForAndDownloadImage().then(function(){ /* success */ }).catch(function(err){ console.error('Export failed', err); }).finally(function(){ hideOverlay(); });
  }

  // Wait for the EasyPrint image to appear, then try to fetch and save it using FileSaver (if available).
  // If fetch/save fails (CORS), open the image in a new tab as a fallback.
  function waitForAndDownloadImage(){
    return new Promise(function(resolve, reject){
      var start = performance.now();
      var timeoutMs = 8000;
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
