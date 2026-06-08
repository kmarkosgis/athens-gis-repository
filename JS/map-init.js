  // === Initialize map ===
  var map = L.map('map', {
    preferCanvas: true, // better performance for many features
    zoomControl: false,  // turn off default zoom control
    zoomDelta: 0.5,      // smaller zoom step
    zoomSnap: 0.5        // allow half-step zoom levels
  }).setView([37.98, 23.72], 12);
  if (window.AthensGIS) { window.AthensGIS.map = map; }

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

  var positron = L.tileLayer(
    "https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=ddbe6f28-1e48-473a-8155-c9669166a43e" ,
  { attribution: "© OpenMapTiles © Stadia Maps" }
  ).addTo(map);

  var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap'
  });

  var esriSat = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri'
  });
  

  var maptilerStreetsDark = L.tileLayer(
    "https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png?api_key=ddbe6f28-1e48-473a-8155-c9669166a43e",
  { attribution: "© OpenMapTiles © Stadia Maps" }
  );

  var baseMaps = {
    "Light": positron,
    "Dark": maptilerStreetsDark,
    "Open Street Map": osm,
    "Satellite": esriSat
  };

  // Expose individual base layers & a direct keyed map for custom switcher
  window.AthensGIS = window.AthensGIS || {};
  window.AthensGIS.baseLayers = {
    positron: positron,
    maptilerStreetsDark: maptilerStreetsDark,
    osm: osm,
    esriSat: esriSat
  };
  window.AthensGIS.currentBaseLayerKey = 'positron';

  // OPTIONAL: keep Leaflet default control (can be removed if only custom desired)
  L.control.layers(baseMaps, null, { position: 'bottomright' }).addTo(map);

  // === Custom Basemap Dropdown Switcher Logic ===
  (function(){
    var btn = document.getElementById('basemap-btn');
    var dropdown = document.getElementById('basemap-dropdown');
    if(!btn || !dropdown) return; // safety

    // Toggle dropdown visibility
    btn.addEventListener('click', function(e){
      e.stopPropagation();
      var isOpen = dropdown.style.display === 'block';
      dropdown.style.display = isOpen ? 'none' : 'block';
    });

    // Close when clicking outside
    document.addEventListener('click', function(e){
      if(!dropdown.contains(e.target) && e.target !== btn){
        dropdown.style.display='none';
      }
    });

    // Switch layer when clicking list items
    dropdown.querySelectorAll('li[data-basemap]').forEach(function(item){
      item.style.cursor='pointer';
      item.addEventListener('click', function(){
        var key = this.getAttribute('data-basemap');
        var bases = window.AthensGIS.baseLayers || {};
        if(!bases[key]) return;
        var currentKey = window.AthensGIS.currentBaseLayerKey;
        if(currentKey === key){ dropdown.style.display='none'; return; }
        if(currentKey && bases[currentKey]){ map.removeLayer(bases[currentKey]); }
        bases[key].addTo(map); window.AthensGIS.currentBaseLayerKey = key;

        // Active item highlight
        dropdown.querySelectorAll('li[data-basemap]').forEach(function(li){ li.classList.remove('active-basemap'); });
        this.classList.add('active-basemap');
        // Close dropdown
        dropdown.style.display='none';
      });
    });
    // Mark initial active
    var initial = dropdown.querySelector('li[data-basemap="positron"]');
    if(initial) initial.classList.add('active-basemap');
  })();
  // === End Custom Basemap Dropdown Switcher Logic ===

  // === Global map click to clear highlighted feature & info box ===
  map.on('click', function(e){
    var ag = window.AthensGIS || {};
    if(!ag.selectedFeature) return; // nothing to clear
    // Extra guard: if the original target is a vector path, skip (feature click handled separately)
    if(e.originalEvent && e.originalEvent.target && e.originalEvent.target.tagName && e.originalEvent.target.tagName.toLowerCase()==='path') return;
    try {
      Object.keys(ag.geojsonLayers||{}).forEach(function(key){
        var lyr = ag.geojsonLayers[key];
        if(lyr && typeof lyr.resetStyle==='function'){
          try { lyr.resetStyle(ag.selectedFeature); } catch(_){}
        }
      });
      // Remove any lingering highlight classes
      document.querySelectorAll('path.feature-highlight').forEach(function(p){ p.classList.remove('feature-highlight'); });
    } catch(_){}
    ag.selectedFeature = null;
    var infoBox = document.getElementById('infoBox');
    if(infoBox) infoBox.style.display='none';
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

    var zoomStep = 0.5;
    zin.addEventListener('click', function(e){ e.preventDefault(); if(zin.disabled) return; map.zoomIn(zoomStep); });
    zout.addEventListener('click', function(e){ e.preventDefault(); if(zout.disabled) return; map.zoomOut(zoomStep); });

    map.on('zoomend', updateDisabled);
    updateDisabled();
  })();
  // === End Custom Zoom Control Buttons Logic ===

