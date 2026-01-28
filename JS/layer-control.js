// === Layer Control Module (Single Clean Implementation) ===
// Purpose: Render layer categories, handle loading/removal, info & legend updates, Relief merge, search & zoom.

// 1. Category definitions
var layerCategories = {
  "Administrative Boundaries": [
    { name: "Regions of Greece", file: "Boundaries/GrRegions.geojson" },
    { name: "Athens Center Sector", file: "Boundaries/AthensCenterSector.json" },
    { name: "Athens North Sector", file: "Boundaries/AthensNorthSector.json" },
    { name: "Athens South Sector", file: "Boundaries/AthensSouthSector.json" },
    { name: "Athens West Sector", file: "Boundaries/AthensWestSector.json" },
    { name: "Municipal Communities of Athens", file: "Boundaries/AthensCom.geojson" },
    { name: "West Attica", file: "Boundaries/AthensWest.json" },
    { name: "East Attica", file: "Boundaries/AthensEast.json" },
    { name: "Piraeus", file: "Boundaries/Piraeus.json" },
    { name: "Islands of Attica region", file: "Boundaries/AthensIslands.json" }
  ],
  "Amenities": [
    { name: "Banks", file: "Amenities/Banks.geojson" },
    { name: "Fuel Stations", file: "Amenities/Fuel.geojson" },
    { name: "Hospitals", file: "Amenities/Hospitals.geojson" },
    { name: "Pharmacies", file: "Amenities/Pharmacies.geojson" },
    { name: "Police Stations", file: "Amenities/Police.geojson" },
    { name: "Schools", file: "Amenities/Schools.geojson" },
    { name: "Universities", file: "Amenities/Universities.geojson" }
  ],
  "Energy": [ 
    { name: "Wind Farms", file: "Energy/WindFarms.json" } 
  ],
  "Environment": [
    { name: "Natura 2000", file: "Environment/Natura.geojson" },
    { name: "Rivers", file: "Environment/Rivers.geojson" },
    { name: "Center Sector Green Spaces", file: "Environment/AthensGreenCenter.geojson" },
    { name: "North Sector Green Spaces", file: "Environment/AthensGreenNorth.geojson" },
    { name: "South Sector Green Spaces", file: "Environment/AthensGreenSouth.geojson" },
    { name: "West Sector Green Spaces", file: "Environment/AthensGreenWest.geojson" },
    { name: "Piraeus Green Spaces", file: "Environment/PiraeusGreen.geojson" }
  ],
  "Natural Hazards": [
    { name: "Wildfires Attica 2015-2025", file: "Disasters/WildfiresAttica2015-2025.geojson" },
  ],
  "Population and social conditions": [
    { name: "2021 Population Census", file: "Social/Population2021.json" },
    { name: "2011 Population Census", file: "Social/Population2011.json" }
  ],
  "Urban Planning": [
    { name: "Corine Land Cover (2018)", file: "UrbanPlanning/AthensCorine2018.json" },
    { name: "Municipality of Athens Urban Plan (2012)", file: "UrbanPlanning/Athens Urban Plan 2012.geojson" }
  ],
  "Transportation Systems": [
    { name: "AI Cameras", file: "Transportation/AICameras.json" },
    { name: "Avenues", file: "Transportation/AthensAvenues.json" },
    { name: "Bus Stops", file: "Transportation/AthensBusStops.geojson" },
    { name: "Highways of Greece", file: "Transportation/GreeceHighways.geojson" },
    { name: "Metro Stations 1, 2 & 3", file: "Transportation/AthensMetro123.geojson" },
    { name: "Metro Stations 4", file: "Transportation/AthensMetro4.geojson" },
    { name: "Rail Network of Greece", file: "Transportation/GreeceRail.geojson" },
    { name: "Street Network", file: "Transportation/AthStreets.geojson" },
    { name: "Toll Stations", file: "Transportation/TollStations.geojson" },
    { name: "Train Stations", file: "Transportation/AthensTrain.geojson" },
    { name: "Tram Stations", file: "Transportation/AthensTram.geojson" },
    { name: "Traffic Accidents", file: "Transportation/TrAccidents2025.geojson"},
    { name: "Traffic Lights", file: "Transportation/TrLights.geojson" },
  ]
};

// 2. Global state wiring
const AthensGIS = window.AthensGIS = window.AthensGIS || {};
AthensGIS.layerCategories = layerCategories;
AthensGIS.geojsonLayers = AthensGIS.geojsonLayers || {};
AthensGIS.activeLayerInfos = AthensGIS.activeLayerInfos || {};
AthensGIS.selectedFeature = null;
AthensGIS.currentOpacity = AthensGIS.currentOpacity || 1;

function getMap(){ return AthensGIS.map; }

// 3. Helper to build property table
function buildPropertyTable(feature){
  if(!feature || !feature.properties) return '';
  var rows='';
  for(var key in feature.properties){
    if(!Object.prototype.hasOwnProperty.call(feature.properties,key)) continue;
    var v = feature.properties[key];
    var d = key; var k = key.toLowerCase();
    if(k==='shapeleng_'){ v=Number(v).toFixed(2); d='Shape Length (km)'; }
    else if(k==='shapearea'){ v=Number(v).toFixed(2); d='Shape Area (km²)'; }
    else if(['shapeleng_m','shapelengm','length'].includes(k)){ v=Number(v).toFixed(2); d='Shape Length (m)'; }
    else if(['shapearea_m','shapeaream'].includes(k)){ v=Number(v).toFixed(2); d='Shape Area (m²)'; }
    else if(['name','name_el','name_place','gname','uses_gr'].includes(k)){ d='Name (GR)'; }
    else if(['ename','name_pl_en','name_en','uses_en'].includes(k)){ d='Name (ENG)'; }
    else if(k==='bridge') d='Bridge';
    else if(k==='tunnel') d='Tunnel';
    else if(k==='ref') d='Route';
    else if(k==='operator') d='Operator';
    else if(k==='charge') d='Toll Charge';
    else if(k==='int_ref') d='International Route';
    else if(k==='geitonia') d='Neighborhood (GR)';
    else if(k==='geiton_en') d='Neighborhood (ENG)';
    else if(k==='dk') d='Municipal Community (GR)';
    else if(k==='dk_en') d='Municipal Community (ENG)';
    else if(k==='sectionnam') d='Section Name';
    else if(k==='metroline') d='Metro Line';
    else if(k==='highway') d='Type';
    else if(k==='oneway') d='One-Way Road';
    else if(k==='surface') d='Surface Type';
    else if(k==='fid' || k==='objectid') d='Feature ID';
    else if(k==='popul2011') d='Population';
    else if(k==='wt') d='Wind Turbine';
    else if(k==='power_anem') d='Power (MW)';
    else if(k==='max_power') d='Max Power (MW)';
    else if(k==='diametros_') d='Diameter (m)';
    else if(k==='ypsos_pylo') d='Height (m)';
    else if(k==='initialdat') d='Initial Date';
    else if(k==='finaldate') d='Final Date';
    else if(k==='stop_id') d='Stop ID';
    else if(k==='route_ref') d='Bus Route';
    else if(k==='rwb_id') d='River/Stream ID';
    else if(k==='basinid_fd') d='Basin ID';
    rows += '<tr><th style="text-align:left; padding:5px; width:115px; border-bottom:1px solid #ccc; word-wrap:break-word; max-width:115px;">'+d+'</th><td style="border-bottom:1px solid #ccc; width:115px; word-wrap:break-word; max-width:115px;">'+v+'</td></tr>';
    }
    return '<table style="table-layout:fixed; width:230px;">'+rows+'</table>';
}

function ensureInfoBoxUpdate(){
    if(typeof window.updateInfoBox==='function'){ window.updateInfoBox(); return; }
    var infoBox = document.getElementById('layerInfoBox'); if(!infoBox) return;
    var html='';
    for(var k in AthensGIS.activeLayerInfos){ html+='<strong>'+k+'</strong><br>'+AthensGIS.activeLayerInfos[k]+'<hr>'; }
    if(html){ infoBox.innerHTML=html; infoBox.style.display='block'; } else infoBox.style.display='none';
}

  // 4. Factory for geojson options
function geojsonOptions(layerName, legendConfig){
  return {
    style: function(feature){
      var baseWeight = 1;
      var fillOpacity = AthensGIS.currentOpacity;
      // Special styling for Terrain/Relief: scale-aware contour visibility
      if(layerName==='Terrain' || layerName==='Relief'){
        var color = '#C4C4C4';
        var fillColor = '#d9d9d9';
        try{
          var geomType = feature && feature.geometry && feature.geometry.type;
          var contourRaw = feature && feature.properties && (feature.properties.Contour || feature.properties.contour || feature.properties.CONTOUR);
          var contourVal = (typeof contourRaw !== 'undefined' && contourRaw !== null && contourRaw !== '') ? Number(contourRaw) : NaN;
          var heavyContours = [200,400,600,800,1000,1200,1400,1600];

          // approximate current map scale denominator
          var mapObj = getMap();
          var isLargeScale = true; // denominator < 100000
          if(mapObj){
            try{
              var center = mapObj.getCenter(); var zoom = mapObj.getZoom();
              var latRad = (center.lat || 0) * Math.PI / 180;
              var metersPerPixel = 156543.03392 * Math.cos(latRad) / Math.pow(2, zoom);
              var dpi = 96; var inchesPerMeter = 39.3700787;
              var scaleDenominator = metersPerPixel * dpi * inchesPerMeter;
              isLargeScale = (scaleDenominator > 130000);
            }catch(e){ isLargeScale = true; }
          }

          // Line geometries: enforce heavy-only visibility at large scales
          if(geomType === 'LineString' || geomType === 'MultiLineString'){
            var isHeavy = heavyContours.indexOf(contourVal) !== -1;
            if(isLargeScale){
              // At scales larger than 1:100000 (denominator < 100000): show only heavy contours
              if(isHeavy) return { color: color, weight: baseWeight, opacity: 1, fillOpacity: fillOpacity };
              return { color: color, weight: baseWeight, opacity: 0, fillOpacity: 0 };
            } else {
              // At smaller scales (denominator >= 100000): show all contours, heavy ones emphasised
              if(isHeavy) return { color: color, weight: baseWeight * 2, opacity: 1, fillOpacity: fillOpacity };
              return { color: color, weight: baseWeight, opacity: 1, fillOpacity: fillOpacity };
            }
          }

          // Non-line geometries (polygons, points): render normally
          return { color: color, weight: baseWeight, fillColor: fillColor, fillOpacity: fillOpacity };
        }catch(e){
          return { color: color, weight: baseWeight, fillColor: fillColor, fillOpacity: fillOpacity };
        }
      }
      if(legendConfig && feature.properties && legendConfig.field in feature.properties){
        var cv = feature.properties[legendConfig.field];
        var cs = legendConfig.classes[cv];
        if(cs) return { color: cs.color, weight: baseWeight, fillColor: cs.color, fillOpacity: AthensGIS.currentOpacity };
      }
      return { color:'#699bc4', weight: baseWeight, fillColor:'#4682B4', fillOpacity: AthensGIS.currentOpacity };
    },
    pointToLayer: function(feature, latlng){
      return L.circleMarker(latlng,{ radius:4, fillColor:'#4682B4', color:'#40b3ff', weight:1, opacity:AthensGIS.currentOpacity, fillOpacity:AthensGIS.currentOpacity });
    },
    onEachFeature: function(feature, layer){
      layer.on('click', function(e){
        if(AthensGIS.selectedFeature){
          Object.keys(AthensGIS.geojsonLayers).forEach(function(key){
            var lyr = AthensGIS.geojsonLayers[key];
            if(lyr && typeof lyr.resetStyle==='function'){
              try{ lyr.resetStyle(AthensGIS.selectedFeature); }catch(_){}}
          });
        }
        AthensGIS.selectedFeature = e.target;
        var lc = (window.legendConfigs||{})[layerName];
        var highlight = { weight:1, fillOpacity: AthensGIS.currentOpacity };
        // Keep Terrain highlight in grey tones as well
        if(layerName==='Terrain' || layerName==='Relief'){
          highlight.color = '#C4C4C4';
          highlight.fillColor = '#d9d9d9';
        } else if(lc && feature.properties && lc.field in feature.properties){
          var cv2 = feature.properties[lc.field]; var cs2 = lc.classes[cv2];
          if(cs2){ highlight.color=cs2.color; highlight.fillColor=cs2.color; } else { highlight.color='#699bc4'; highlight.fillColor='#4682B4'; }
        } else { highlight.color='#699bc4'; highlight.fillColor='#4682B4'; }
        e.target.setStyle(highlight);
        if(e.target._path){
          e.target._path.classList.add('feature-highlight');
          document.querySelectorAll('path.feature-highlight').forEach(function(p){ if(p!==e.target._path) p.classList.remove('feature-highlight'); });
        }
        e.target.bringToFront();
      });
      var infoSide = document.getElementById('infoBox');
      var html = buildPropertyTable(feature);
      // Only attach the infoBox update for non-Relief layers
      if(layerName!=='Terrain' && layerName!=='Relief'){
        layer.on('click', function(ev){ if(infoSide){ infoSide.innerHTML=html; infoSide.style.display='block'; L.DomEvent.stopPropagation(ev);} });
      }
    }
  };
}
// 5. Render Layer Control UI
// Helper: create map panes for vector ordering and build a layer (or layerGroup) that
// places polygon geometries in a lower pane and point/line geometries in a higher pane.
function createLayerFromGeoJSON(data, layerName, legendConfig){
  var map = getMap();
  if(!map) return null;
  // Ensure panes exist
  try{
    if(!map.getPane('vector-bottom')){ map.createPane('vector-bottom'); map.getPane('vector-bottom').style.zIndex = 450; }
    if(!map.getPane('vector-top')){ map.createPane('vector-top'); map.getPane('vector-top').style.zIndex = 650; }
  }catch(e){}

  var features = (data && data.features) ? data.features : [];
  var polyFeatures = { type: 'FeatureCollection', features: features.filter(function(f){ return f && f.geometry && (f.geometry.type==='Polygon' || f.geometry.type==='MultiPolygon'); }) };
  var vecFeatures = { type: 'FeatureCollection', features: features.filter(function(f){ return f && f.geometry && (f.geometry.type==='Point' || f.geometry.type==='MultiPoint' || f.geometry.type==='LineString' || f.geometry.type==='MultiLineString'); }) };

  var layers = [];
  var polyLayer = null, vecLayer = null;
  if(polyFeatures.features.length){
    var baseOpts = geojsonOptions(layerName, legendConfig);
    var polyOpts = Object.assign({}, baseOpts);
    // ensure pane is applied to each created feature before it's added to the map
    var baseOnEach = baseOpts.onEachFeature;
    polyOpts.onEachFeature = function(feature, layer){
      try{ if(layer && layer.options) layer.options.pane = 'vector-bottom'; }catch(e){}
      if(typeof baseOnEach === 'function') baseOnEach(feature, layer);
    };
    polyOpts.pane = 'vector-bottom';
    polyLayer = L.geoJSON(polyFeatures, polyOpts);
    layers.push(polyLayer);
  }
  if(vecFeatures.features.length){
    var baseOpts2 = geojsonOptions(layerName, legendConfig);
    var vecOpts = Object.assign({}, baseOpts2);
    var baseOnEach2 = baseOpts2.onEachFeature;
    vecOpts.onEachFeature = function(feature, layer){
      try{ if(layer && layer.options) layer.options.pane = 'vector-top'; }catch(e){}
      if(typeof baseOnEach2 === 'function') baseOnEach2(feature, layer);
    };
    vecOpts.pane = 'vector-top';
    vecLayer = L.geoJSON(vecFeatures, vecOpts);
    layers.push(vecLayer);

    // If this is the Relief/Terrain layer, create repeated contour labels along line features
    if((layerName==='Relief' || layerName==='Terrain') && typeof turf !== 'undefined'){
      try{
        var labelLayer = L.layerGroup();
        // iterate line features and place a label every 5 km
        vecFeatures.features.forEach(function(f){
          if(!f || !f.geometry) return;
          var gtype = f.geometry.type;
          if(gtype!=='LineString' && gtype!=='MultiLineString') return;
          // contour value from properties
          var contour = (f.properties && (f.properties.Contour || f.properties.contour || f.properties.CONTOUR)) || '';
          // compute length in kilometers
          var lengthKm = 0;
          try{ lengthKm = turf.length(f, {units:'kilometers'}) || 0; }catch(e){ lengthKm = 0; }
          if(lengthKm<=0) return;
          // place a label every 10 km along the line (0,10,20,... km)
          for(var d=0; d<=lengthKm; d+=15){
            try{
              var pt = turf.along(f, d, {units:'kilometers'});
              if(pt && pt.geometry && pt.geometry.coordinates){
                var c = pt.geometry.coordinates; var latlng = [c[1], c[0]];
                // compute a small forward point to get bearing and rotate the label
                var forwardDist = Math.min(d + 0.1, lengthKm);
                var bearing = 0;
                try{
                  var nextPt = turf.along(f, forwardDist, {units:'kilometers'});
                  if(nextPt && nextPt.geometry && nextPt.geometry.coordinates){
                    bearing = turf.bearing(pt, nextPt) || 0;
                  }
                }catch(e){ bearing = 0; }
                // transparent background, slight text-shadow for contrast, rotated to follow line direction
                var html = '<div style="font-size:10px; color:#2c3e50; background:rgba(121, 121, 121, 0.15); padding:2px; border-radius:4px; border:none; text-shadow:0 0 3px rgba(255,255,255,0.9); transform:rotate('+bearing+'deg); transform-origin:center; display:inline-block;">'+String(contour)+'</div>';
                var ic = L.divIcon({className:'relief-label', html:html});
                var m = L.marker(latlng, {icon:ic, pane:'vector-top', interactive:false});
                labelLayer.addLayer(m);
              }
            }catch(e){}
          }
        });
        if(labelLayer.getLayers().length){ var _preparedLabelLayer = labelLayer; }
      }catch(e){}
    }
  }

  var group = null;
  if(layers.length===1){
    group = layers[0];
    group.addTo(map);
  } else {
    group = L.layerGroup(layers).addTo(map);
    // attach convenience references
    group._polyLayer = polyLayer;
    group._vecLayer = vecLayer;
  }

  // If we prepared a label layer for Relief, attach it to the group and toggle visibility
  try{
    if(typeof _preparedLabelLayer !== 'undefined' && _preparedLabelLayer){
      group._labelLayer = _preparedLabelLayer;
      // compute whether to show labels: show when map scale is larger than 1/35000 (denominator < 35000)
      var shouldShowReliefLabels = function(){
        try{
          var mapCenter = map.getCenter(); var zoom = map.getZoom();
          var latRad = (mapCenter.lat || 0) * Math.PI / 180;
          var metersPerPixel = 156543.03392 * Math.cos(latRad) / Math.pow(2, zoom);
          var dpi = 96; // assumed screen DPI
          var inchesPerMeter = 39.3700787;
          var scaleDenominator = metersPerPixel * dpi * inchesPerMeter;
          return scaleDenominator < 35000;
        }catch(e){ return false; }
      };

      var updateLabelVisibility = function(){
        try{
          if(shouldShowReliefLabels()){
            if(!group.hasLayer(group._labelLayer)) group.addLayer(group._labelLayer);
          } else {
            if(group.hasLayer(group._labelLayer)) group.removeLayer(group._labelLayer);
          }
        }catch(e){}
      };

      // initial sync and listeners
      updateLabelVisibility();
      map.on('zoomend moveend', updateLabelVisibility);
      group._updateReliefLabelVisibility = updateLabelVisibility;
    }
  }catch(e){}

  // Add helper resetStyle to be compatible with existing code that calls resetStyle on stored layers
  group.resetStyle = function(feature){
    try{ if(polyLayer && typeof polyLayer.resetStyle==='function') polyLayer.resetStyle(feature); }catch(_){}
    try{ if(vecLayer && typeof vecLayer.resetStyle==='function') vecLayer.resetStyle(feature); }catch(_){}
  };

  return group;
}
function renderLayerControl(){
  if(!getMap()) return setTimeout(renderLayerControl,50);
  var controlDiv = document.getElementById('layerControl'); if(!controlDiv) return;

  if(!controlDiv.querySelector('#layerSearch')){
    var wrap=document.createElement('div'); wrap.id='searchZoomContainer'; wrap.style.display='flex'; wrap.style.alignItems='center'; wrap.style.gap='8px';
    var inp=document.createElement('input'); inp.type='text'; inp.id='layerSearch'; inp.placeholder='Search layers...'; inp.style.width='80%'; inp.style.padding='3px'; inp.style.marginBottom='6px'; inp.style.borderRadius='6px'; inp.style.border='1px solid #ccc';
    var btn=document.createElement('button'); btn.id='zoomSelectedBtn'; btn.textContent='🔎'; btn.title='Zoom to selected layers'; btn.style.marginLeft='2px'; btn.style.padding='2px 6px'; btn.style.marginBottom='6px'; btn.style.borderRadius='6px'; btn.style.border='1px solid #ccc'; btn.style.background='white'; btn.style.cursor='pointer';
    btn.addEventListener('mouseenter',()=> btn.style.background='rgba(70,130,180,0.1)'); btn.addEventListener('mouseleave',()=> btn.style.background='white');
  wrap.appendChild(inp); wrap.appendChild(btn); controlDiv.appendChild(wrap);
    // Search behavior: show flat list without category titles
    inp.addEventListener('input', function(){
      var term=this.value.toLowerCase().trim();
      var resultsDiv = controlDiv.querySelector('#searchResults');
      if(!resultsDiv){
        resultsDiv = document.createElement('div');
        resultsDiv.id='searchResults';
        resultsDiv.style.display='none';
        resultsDiv.style.margin='4px 0 6px';
        controlDiv.appendChild(resultsDiv);
      }
      // Restore any previously moved rows (elements only) and clear any message
      var movedRows = Array.from(resultsDiv.querySelectorAll('.layer-item'));
      movedRows.forEach(function(row){
        var pid = row.dataset.parentId; var parent = pid && document.getElementById(pid);
        if(parent){ parent.appendChild(row); }
      });
      resultsDiv.innerHTML = '';
      var sections = controlDiv.querySelectorAll('.category-section');
      if(term){
        // Hide category sections and show only flat results
        sections.forEach(function(sec){ sec.style.display='none'; });
        var matches = [];
        controlDiv.querySelectorAll('.layer-item').forEach(function(li){
          var lab=li.querySelector('label');
          if(lab && lab.textContent.toLowerCase().includes(term)) matches.push(li);
        });
        if(matches.length){
          matches.forEach(function(li){ resultsDiv.appendChild(li); });
          resultsDiv.style.display='block';
          resultsDiv.setAttribute('data-has-results','true');
        } else {
          resultsDiv.style.display='block';
          resultsDiv.setAttribute('data-has-results','false');
          resultsDiv.textContent = 'No layers match your search';
        }
      } else {
        // No term: show categories again and hide flat results
        sections.forEach(function(sec){ sec.style.display=''; });
        resultsDiv.style.display='none';
        resultsDiv.textContent = '';
      }
    });
    btn.addEventListener('click', function(){ var group=L.featureGroup(); Object.keys(AthensGIS.geojsonLayers).forEach(function(k){ var lyr=AthensGIS.geojsonLayers[k]; if(lyr && getMap().hasLayer(lyr)) group.addLayer(lyr); }); if(group.getLayers().length) getMap().fitBounds(group.getBounds().pad(0.05)); });
  }

  while(controlDiv.children.length>1) controlDiv.removeChild(controlDiv.lastChild);

  // Render Relief as a common layer at the very top (outside categories)
  (function renderReliefCommon(){
    var id='Ground_Relief';
    // Ensure a wrapper container exists so search can move/restore this row
    var commonWrap = document.getElementById('common-layers-wrap');
    if(!commonWrap){
      commonWrap = document.createElement('div');
      commonWrap.id = 'common-layers-wrap';
      controlDiv.appendChild(commonWrap);
    }
    var row=document.createElement('div'); row.className='layer-item';
    var cb=document.createElement('input'); cb.type='checkbox'; cb.id=id; cb.dataset.layername='Terrain';
    var label=document.createElement('label'); label.htmlFor=id; label.textContent='Terrain';
    var dl=document.createElement('button'); dl.innerHTML='&#129035;'; dl.className='download-button'; dl.style.display='none'; dl.title='Download as ZIP';
    dl.addEventListener('click', function(){ var zip=new JSZip(); var files=['relief1.json','relief2.json','relief3.json','relief4.json']; Promise.all(files.map(f=>fetch('data/Environment/'+f).then(r=>r.blob()).then(b=>zip.file(f,b)))).then(()=>zip.generateAsync({type:'blob'})).then(c=>saveAs(c,'Ground_Relief_layers.zip')); });
    row.appendChild(cb); row.appendChild(label); row.appendChild(dl);
    // Tag parent for search restore
    row.dataset.parentId = commonWrap.id;
    commonWrap.appendChild(row);

    cb.addEventListener('change', function(){
  var layerName=this.dataset.layername; var dEl=this.parentElement.querySelector('.download-button');
      if(this.checked){
        row.classList.add('selected');
        if(dEl) dEl.style.display='inline-block';
        AthensGIS.activeLayerInfos[layerName]='<em>Loading info...</em>';
        ensureInfoBoxUpdate();
        // Show legend immediately
        if(typeof window.updateLegendBar==='function' && (window.legendConfigs||{})[layerName]){
          window.updateLegendBar(layerName);
        }
        Promise.all(['relief1.json','relief2.json','relief3.json','relief4.json'].map(f=>fetch('data/Environment/'+f).then(r=>r.json())))
            .then(parts=>{
            var merged={type:'FeatureCollection', features:parts.flatMap(p=>p.features||[])};
            var lc=(window.legendConfigs||{})[layerName];
            if(typeof window.updateLegendBar==='function') window.updateLegendBar(layerName);
            var lyr=createLayerFromGeoJSON(merged, layerName, lc);
            // Keep internal key as 'Relief' for cleanup compatibility
            AthensGIS.geojsonLayers['Relief']=lyr;
          });
        fetch('info/Environment/Relief.txt').then(r=>r.ok?r.text():Promise.reject())
          .then(t=>{ AthensGIS.activeLayerInfos[layerName]=t; ensureInfoBoxUpdate(); })
          .catch(()=>{ AthensGIS.activeLayerInfos[layerName]='<em>No extra info available for this layer.</em>'; ensureInfoBoxUpdate(); });
      } else {
        row.classList.remove('selected');
        if(dEl) dEl.style.display='none';
        if(AthensGIS.geojsonLayers['Relief']){ getMap().removeLayer(AthensGIS.geojsonLayers['Relief']); delete AthensGIS.geojsonLayers['Relief']; }
        // Update legend to remove this layer's entry
        if(typeof window.updateLegendBar==='function') window.updateLegendBar(layerName,'remove');
        delete AthensGIS.activeLayerInfos[layerName];
        ensureInfoBoxUpdate();
        var infoDiv=document.getElementById('infoBox'); if(infoDiv) infoDiv.style.display='none';
      }
    });
  })();
  // Ensure search results container exists right after the search bar
  if(!controlDiv.querySelector('#searchResults')){
    var _results=document.createElement('div');
    _results.id='searchResults';
    _results.style.display='none';
    _results.style.margin='4px 0 6px';
    controlDiv.appendChild(_results);
  }

  Object.keys(layerCategories).forEach(function(cat){
    // Category wrapper
    var section = document.createElement('div');
    section.className = 'category-section';

    // Header with title and arrow
    var header = document.createElement('div');
    header.className = 'category-header';
    header.tabIndex = 0; // keyboard focusable
    header.setAttribute('role','button');
    // Row layout so title and arrow are in the same line, arrow on the right
    header.style.display = 'flex';
    header.style.alignItems = 'center';
    header.style.height = '30px';
    header.style.gap = '8px';
    header.style.marginTop = '10px';
    header.style.marginBottom = '10px';
    header.style.paddingLeft = '6px';
    header.style.cursor = 'pointer';
    header.style.border = '0px solid rgba(204, 204, 204, 0.4)';
    header.style.borderRadius = '8px';
    header.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.18)';
    

  var title = document.createElement('h4');
    title.textContent = cat;
    // Balanced margins so vertical centering of the arrow looks correct
    title.style.margin = '2px 0';

    var arrow = document.createElement('span');
    arrow.className = 'category-arrow';
    arrow.setAttribute('aria-hidden','true');
  // Use a down arrow by default; rotate to point up when expanded
  arrow.textContent = '🢐';
  arrow.style.marginLeft = 'auto';
  arrow.style.paddingRight = '14px';
  arrow.style.transition = 'transform 0.2s ease';
  // Rotate around the right-center so the arrow hinges from the right edge
  arrow.style.transformOrigin = '25% 55%';
  arrow.style.fontSize = '1.6em';
  // Ensure vertical centering relative to header height
  arrow.style.display = 'inline-flex';
  arrow.style.alignItems = 'top';


    header.appendChild(title);
    header.appendChild(arrow);

    // Content container (collapsed by default)
  var content = document.createElement('div');
    content.className = 'category-content';
  // Start collapsed: hidden, with smooth transition on expand/collapse
  content.style.display = 'none';
  content.style.overflow = 'hidden';
  content.style.maxHeight = '0';
  content.style.opacity = '0';
  content.style.transition = 'max-height 0.25s ease, opacity 0.2s ease';
  // Accessibility wiring
  var contentId = 'cat-content-' + cat.replace(/\s+/g,'-').toLowerCase();
  content.id = contentId;
  header.setAttribute('aria-controls', contentId);
  header.setAttribute('aria-expanded', 'false');

    // Build rows into content
    layerCategories[cat].forEach(function(info){
      var id=info.name.replace(/\s+/g,'_');
  var row=document.createElement('div'); row.className='layer-item';
      var cb=document.createElement('input'); cb.type='checkbox'; cb.id=id; cb.dataset.layername=info.name; if(info.file) cb.dataset.filename=info.file;
      var label=document.createElement('label'); label.htmlFor=id; label.textContent=info.name;
      var dl;
      if(info.name==='Relief'){
        dl=document.createElement('button'); dl.innerHTML='&#129035;'; dl.className='download-button'; dl.style.display='none'; dl.title='Download as ZIP';
        dl.addEventListener('click', function(){ var zip=new JSZip(); var files=['relief1.json','relief2.json','relief3.json','relief4.json']; Promise.all(files.map(f=>fetch('data/Environment/'+f).then(r=>r.blob()).then(b=>zip.file(f,b)))).then(()=>zip.generateAsync({type:'blob'})).then(c=>saveAs(c,'Relief_layers.zip')); });
      } else {
        dl=document.createElement('a'); dl.href='data/'+info.file; dl.download=info.file; dl.innerHTML='&#129035;'; dl.className='download-button'; dl.style.display='none'; dl.title='Download the selected layer';
      }
  row.appendChild(cb); row.appendChild(label); row.appendChild(dl); content.appendChild(row);
  // Tag original parent for flat-search restore
  row.dataset.parentId = content.id;
      cb.addEventListener('change', function(){
        var layerName=this.dataset.layername; var file=this.dataset.filename; var dEl=this.parentElement.querySelector('.download-button');
        if(this.checked){
          // Visually mark row as selected so .layer-item.selected CSS applies
          row.classList.add('selected');
          if(dEl) dEl.style.display='inline-block';
          AthensGIS.activeLayerInfos[layerName]='<em>Loading info...</em>'; ensureInfoBoxUpdate();
          // Trigger legend update immediately (so user sees legend without waiting for fetch)
          if(typeof window.updateLegendBar==='function' && (window.legendConfigs||{})[layerName]){
            window.updateLegendBar(layerName);
          }
          if(layerName==='Relief'){
            Promise.all(['relief1.json','relief2.json','relief3.json','relief4.json'].map(f=>fetch('data/Environment/'+f).then(r=>r.json()))).then(parts=>{ var merged={type:'FeatureCollection', features:parts.flatMap(p=>p.features||[])}; var lc=(window.legendConfigs||{})[layerName]; if(typeof window.updateLegendBar==='function') window.updateLegendBar(layerName); var lyr=L.geoJSON(merged, geojsonOptions(layerName, lc)).addTo(getMap()); AthensGIS.geojsonLayers['Relief']=lyr; });
            fetch('info/Environment/Relief.txt').then(r=>r.ok?r.text():Promise.reject()).then(t=>{ AthensGIS.activeLayerInfos[layerName]=t; ensureInfoBoxUpdate(); }).catch(()=>{ AthensGIS.activeLayerInfos[layerName]='<em>No extra info available for this layer.</em>'; ensureInfoBoxUpdate(); });
          } else if(file){
            fetch('data/'+file).then(r=>r.json()).then(data=>{ var lc2=(window.legendConfigs||{})[layerName]; if(typeof window.updateLegendBar==='function') window.updateLegendBar(layerName); var lyr2=createLayerFromGeoJSON(data, layerName, lc2); AthensGIS.geojsonLayers[file]=lyr2; });
            var txt=file.replace(/\.[^/.]+$/, '')+'.txt'; fetch('info/'+txt).then(r=>r.ok?r.text():Promise.reject()).then(t=>{ AthensGIS.activeLayerInfos[layerName]=t; ensureInfoBoxUpdate(); }).catch(()=>{ AthensGIS.activeLayerInfos[layerName]='<em>No extra info available for this layer.</em>'; ensureInfoBoxUpdate(); });
          }
        } else {
          // Remove selected visual style
          row.classList.remove('selected');
          if(dEl) dEl.style.display='none';
          if(layerName==='Relief'){ if(AthensGIS.geojsonLayers['Relief']){ getMap().removeLayer(AthensGIS.geojsonLayers['Relief']); delete AthensGIS.geojsonLayers['Relief']; } }
          else if(file && AthensGIS.geojsonLayers[file]){ getMap().removeLayer(AthensGIS.geojsonLayers[file]); delete AthensGIS.geojsonLayers[file]; }
          delete AthensGIS.activeLayerInfos[layerName]; ensureInfoBoxUpdate(); var infoDiv=document.getElementById('infoBox'); if(infoDiv) infoDiv.style.display='none';
          // Update legend to remove this layer's entry (after state updated)
          if(typeof window.updateLegendBar==='function') window.updateLegendBar(layerName,'remove');
        }
        // Update category header style: if any checkbox in this category is active, highlight the header
        try{
          var anyChecked = content.querySelectorAll('input[type=checkbox]:checked').length > 0;
          if(anyChecked){
            header.style.background = 'linear-gradient(90deg, rgba(64, 179, 255, 0.1), rgba(64, 179, 255, 0.4))';
            
          } else {
            header.style.background = '';
            header.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.18)';
          }
        }catch(e){}
      });
    });

    // Toggle logic
    function setOpen(open){
      if(open){
        // Prepare for animation from collapsed to expanded
        content.style.display = 'block';
        // Force a reflow so the next changes transition
        void content.offsetHeight;
        content.style.maxHeight = content.scrollHeight + 'px';
        content.style.opacity = '1';
        header.classList.add('open');
        // Rotate to point up smoothly
        arrow.style.transform = 'rotate(-90deg)';
        header.setAttribute('aria-expanded','true');
        content.setAttribute('aria-hidden','false');
      } else {
        // Animate from current height to 0, then hide display after transition
        content.style.maxHeight = content.scrollHeight + 'px';
        content.style.opacity = '1';
        // Force reflow then collapse
        void content.offsetHeight;
        content.style.maxHeight = '0';
        content.style.opacity = '0';
        header.classList.remove('open');
        // Default state is pointing down
        arrow.style.transform = 'rotate(0deg)';
        header.setAttribute('aria-expanded','false');
        content.setAttribute('aria-hidden','true');
        var onEnd = function(e){
          if(e.propertyName === 'max-height'){
            content.style.display = 'none';
            content.removeEventListener('transitionend', onEnd);
          }
        };
        content.addEventListener('transitionend', onEnd);
      }
    }
    header.addEventListener('click', function(){ setOpen(content.style.display==='none'); });
    header.addEventListener('keydown', function(e){ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); setOpen(content.style.display==='none'); } });

    // Append to control
    section.appendChild(header);
    section.appendChild(content);
    controlDiv.appendChild(section);
  });
}

// 6. Init
// Ensure geojson styles update when the map zoom or moves (so contour visibility reacts live)
function refreshGeoJSONStyles(){
  var map = getMap(); if(!map) return;
  try{
    Object.keys(AthensGIS.geojsonLayers||{}).forEach(function(k){
      var lyr = AthensGIS.geojsonLayers[k]; if(!lyr) return;
      // If it's a GeoJSON/L.GeoJSON with a style function, call setStyle to re-evaluate styles
      try{ if(typeof lyr.setStyle==='function' && lyr.options && typeof lyr.options.style==='function'){ lyr.setStyle(lyr.options.style); } }catch(e){}
      // If group-like wrapper with internal poly/vec layers, refresh those
      try{ if(lyr._polyLayer && typeof lyr._polyLayer.setStyle==='function' && lyr._polyLayer.options && typeof lyr._polyLayer.options.style==='function'){ lyr._polyLayer.setStyle(lyr._polyLayer.options.style); } }catch(e){}
      try{ if(lyr._vecLayer && typeof lyr._vecLayer.setStyle==='function' && lyr._vecLayer.options && typeof lyr._vecLayer.options.style==='function'){ lyr._vecLayer.setStyle(lyr._vecLayer.options.style); } }catch(e){}
      // For generic LayerGroups, iterate child layers and refresh any with setStyle
      try{ if(typeof lyr.eachLayer==='function'){ lyr.eachLayer(function(s){ try{ if(s && typeof s.setStyle==='function'){ if(s.options && typeof s.options.style==='function') s.setStyle(s.options.style); else s.setStyle(s.options||{}); } }catch(e){} }); } }catch(e){}
    });
  }catch(e){}
}

function ensureGeoJSONStyleRefreshListener(){
  var map = getMap(); if(!map) return;
  if(AthensGIS._layerStyleRefresherAdded) return; AthensGIS._layerStyleRefresherAdded = true;
  map.on('zoomend moveend', function(){ try{ refreshGeoJSONStyles(); }catch(e){} });
}

if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', function(){ renderLayerControl(); ensureGeoJSONStyleRefreshListener(); }); } else { renderLayerControl(); ensureGeoJSONStyleRefreshListener(); }

// === End Layer Control Module ===