  // === Initialize map ===
  var map = L.map('map', {
    preferCanvas: true, // better performance for many features
    zoomControl: false,  // turn off default zoom control
    zoomDelta: 1  ,      // smaller zoom step
    zoomSnap: 1        // allow half-step zoom levels
  }).setView([37.98, 23.72], 12);
  if (window.AthensGIS) { window.AthensGIS.map = map; }

  // === Attribution in front of the footer ===
  // Leaflet's attribution lives in the map's own stacking context, which is under the footer,
  // so the opaque footer hides it. Keep it where it is (JS/export.js reads it from the map
  // container for the exports) and show a live copy inside #footer, in front of the bar.
  (function(){
    var src = map.attributionControl && map.attributionControl.getContainer();
    var copy = document.getElementById('map-attribution');
    if(!src || !copy) return;

    function sync(){
      copy.innerHTML = src.innerHTML;
      Array.prototype.forEach.call(copy.querySelectorAll('a'), function(a){
        a.target = '_blank';
        a.rel = 'noopener';
      });
    }

    // Leaflet rewrites the control's content whenever a basemap/layer with an attribution is added or removed.
    new MutationObserver(sync).observe(src, { childList: true, subtree: true, characterData: true });
    sync();
  })();
  // === End attribution copy ===

  // Keep Leaflet canvas aligned with mobile viewport changes.
  window.addEventListener('resize', function () {
    map.invalidateSize();
  });
  window.addEventListener('orientationchange', function () {
    setTimeout(function () { map.invalidateSize(); }, 150);
  });

  // === Fixed scale ratio label (example: 1:100.000) ===
  (function(){
    var scaleEl = document.getElementById('map-scale-ratio');
    if(!scaleEl) return;

    function formatScale(value){
      return String(value).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    }

    function updateScaleRatio(){
      var center = map.getCenter();
      var zoom = map.getZoom();
      var metersPerPixel = 156543.03392804097 * Math.cos(center.lat * Math.PI / 180) / Math.pow(2, zoom);
      var rawScale = (metersPerPixel * 96) / 0.0254;
      var roundedScale = Math.max(1, Math.round(rawScale / 100) * 100);
      scaleEl.textContent = 'Scale 1 : ' + formatScale(roundedScale);
    }

    map.on('zoomend moveend resize', updateScaleRatio);
    updateScaleRatio();
  })();
  // === End fixed scale ratio label ===

  var positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/light_all/{z}/{x}/{y}.png?key=cb1_335x_1_4a62ad4f60fcab22da74db28', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: 'abcd', maxZoom: 20
}).addTo(map);

  var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  });

  var esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri'
  });
  

  var maptilerStreetsDark = L.tileLayer(
    'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png?key=cb1_335x_1_4a62ad4f60fcab22da74db28', {
  attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>, &copy; <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: 'abcd', maxZoom: 20}
  );

  var baseMaps = {
    "Light": positron,
    "Dark": maptilerStreetsDark,
    "Open Street Map": osm,
    "Satellite": esriSat
  };

  // Expose individual base layers & a direct keyed map for custom switcher
  window.AthensGIS = window.AthensGIS || {};
  // True when the visitor's system asks for less motion. The CSS side is the
  // "Reduced motion" block at the end of style.css; scripts that scroll smoothly or fly
  // the map ask this and move at once instead.
  window.AthensGIS.prefersReducedMotion = function(){
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };
  window.AthensGIS.baseLayers = {
    positron: positron,
    maptilerStreetsDark: maptilerStreetsDark,
    osm: osm,
    esriSat: esriSat
  };
  window.AthensGIS.currentBaseLayerKey = 'positron';

  // OPTIONAL: keep Leaflet default control (can be removed if only custom desired)
  var defaultLayersControl = L.control.layers(baseMaps, null, { position: 'bottomright' }).addTo(map);
  // style.css pushes this control below the bottom edge of the map (the custom BASEMAPS
  // button replaces it), but it was still a keyboard stop and read out by screen readers.
  // inert takes it out of both without removing the control.
  var defaultLayersEl = defaultLayersControl.getContainer && defaultLayersControl.getContainer();
  if(defaultLayersEl){
    defaultLayersEl.setAttribute('inert', '');
    defaultLayersEl.setAttribute('aria-hidden', 'true');
  }

  // === Custom Basemap Dropdown Switcher Logic ===
  (function(){
    var btn = document.getElementById('basemap-btn');
    var dropdown = document.getElementById('basemap-dropdown');
    if(!btn || !dropdown) return; // safety

    var options = Array.prototype.slice.call(dropdown.querySelectorAll('li[data-basemap]'));
    function isOpen(){ return dropdown.style.display === 'block'; }
    // returnFocus: put keyboard focus back on the button (Esc, or a choice made by keyboard).
    function setOpen(open, returnFocus){
      var hadFocus = dropdown.contains(document.activeElement);
      dropdown.style.display = open ? 'block' : 'none';
      btn.setAttribute('aria-expanded', String(open));
      if(!open && (returnFocus || hadFocus)) btn.focus();
    }
    function markActive(activeItem){
      options.forEach(function(li){
        var on = li === activeItem;
        li.classList.toggle('active-basemap', on);
        li.setAttribute('aria-pressed', String(on));
      });
    }

    // Toggle dropdown visibility
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      setOpen(!isOpen());
    });
    // Down arrow on the button opens the list and moves into it.
    btn.addEventListener('keydown', function(e){
      if(e.key === 'ArrowDown' && options.length){
        e.preventDefault();
        setOpen(true);
        options[0].focus();
      }
    });

    // Close when clicking outside
    document.addEventListener('click', function(e){
      if(isOpen() && !dropdown.contains(e.target) && !btn.contains(e.target)){
        setOpen(false);
      }
    });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape' && isOpen()) setOpen(false, dropdown.contains(document.activeElement));
    });

    // Switch layer when an option is clicked, or chosen with Enter / Space
    options.forEach(function(item, index){
      item.style.cursor='pointer';
      item.addEventListener('click', function(){
        var key = this.getAttribute('data-basemap');
        var bases = window.AthensGIS.baseLayers || {};
        if(!bases[key]) return;
        var currentKey = window.AthensGIS.currentBaseLayerKey;
        if(currentKey === key){ setOpen(false); return; }
        if(currentKey && bases[currentKey]){ map.removeLayer(bases[currentKey]); }
        bases[key].addTo(map); window.AthensGIS.currentBaseLayerKey = key;

        // Active item highlight
        markActive(this);
        // Close dropdown
        setOpen(false);
      });
      item.addEventListener('keydown', function(e){
        if(e.key === 'Enter' || e.key === ' '){
          e.preventDefault();
          this.click();
        } else if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
          e.preventDefault();
          var next = options[(index + (e.key === 'ArrowDown' ? 1 : options.length - 1)) % options.length];
          next.focus();
        }
      });
    });
    // Mark initial active
    var initial = dropdown.querySelector('li[data-basemap="positron"]');
    if(initial) markActive(initial);
  })();
  // === End Custom Basemap Dropdown Switcher Logic ===

  // === Global map click to clear highlighted feature & info box ===
  map.on('click', function(e){
    if(typeof handleRasterClickIfAny === 'function' && handleRasterClickIfAny(e)) return;
    if(typeof resetFeatureHighlight === 'function') resetFeatureHighlight();
    var infoBox = document.getElementById('infoBox');
    if(infoBox) infoBox.style.display = 'none';
  });
  // === End clear highlight logic ===

  // === Custom Zoom Control Buttons Logic ===
  (function(){
    var zin = document.getElementById('zoom-in');
    var zout = document.getElementById('zoom-out');
    if(!zin || !zout) return; // buttons not present

    function updateDisabled(){
      var z = map.getZoom();
      var min = map.getMinZoom ? map.getMinZoom() : 0;
      var max = map.getMaxZoom ? map.getMaxZoom() : 18;
      if(z <= min){
        zout.disabled = true; zout.style.opacity = 0.5; zout.style.cursor='not-allowed';
      } else { zout.disabled = false; zout.style.opacity = 1; zout.style.cursor='pointer'; }
      if(z >= max){
        zin.disabled = true; zin.style.opacity = 0.5; zin.style.cursor='not-allowed';
      } else { zin.disabled = false; zin.style.opacity = 1; zin.style.cursor='pointer'; }
    }

    var zoomStep = 0.3;
    zin.addEventListener('click', function(e){ e.preventDefault(); if(zin.disabled) return; map.zoomIn(zoomStep); });
    zout.addEventListener('click', function(e){ e.preventDefault(); if(zout.disabled) return; map.zoomOut(zoomStep); });

    map.on('zoomend', updateDisabled);
    updateDisabled();
  })();
  // === End Custom Zoom Control Buttons Logic ===

