// === Layer Control Module (Single Clean Implementation) ===
// Purpose: Render layer categories, handle loading/removal, info & legend updates, Relief merge, search & zoom.

// 1. Category definitions
var layerCategories = {
  "Administrative Boundaries": {
    "_items": [
      { name: "Regions of Greece", file: "Boundaries/GrRegions.geojson" }
    ],
    "Regional Units of Attica": [
      { name: "Cental Sector", file: "Boundaries/AthensCenterSector.json" },
      { name: "North Sector", file: "Boundaries/AthensNorthSector.json" },
      { name: "South Sector", file: "Boundaries/AthensSouthSector.json" },
      { name: "West Sector", file: "Boundaries/AthensWestSector.json" },
      { name: "East Attica", file: "Boundaries/AthensEast.json" },
      { name: "Islands of Attica", file: "Boundaries/AthensIslands.json" },
      { name: "Piraeus", file: "Boundaries/Piraeus.json" },
      { name: "West Attica", file: "Boundaries/AthensWest.json" },
    ],
    "Municipalities": [
      { name: "Municipal Communities of Athens", file: "Boundaries/AthensCom.geojson" }
    ]    
    },
  "Energy": {
    "Wind": [
      { name: "Wind Farms", file: "Energy/WindFarms.json" }
    ]
  },
  "Environment": {
    "Geology": [
      { name: "Soil Groups", file: "Geo/SoilGroups.geojson" }
    ],
    "Hydrology": [
      { name: "Rivers and Streams", file: "Environment/Rivers.geojson" },
    ],
    "Protection Zones": [
      { name: "Natura 2000 sites", file: "Environment/Natura.geojson" },
    ],
    "Vegetation": [
      { name: "Vegetation Index (Center Sector)", file: "Environment/AthensGreenCenter.geojson" },
      { name: "Vegetation Index (North Sector)", file: "Environment/AthensGreenNorth.geojson" },
      { name: "Vegetation Index (South Sector)", file: "Environment/AthensGreenSouth.geojson" },
      { name: "Vegetation Index (West Sector)", file: "Environment/AthensGreenWest.geojson" },
      { name: "Vegetation Index (Piraeus)", file: "Environment/PiraeusGreen.geojson" }
    ]
  },
  "Natural Hazards": {
    "Wildfires": [
      { name: "Wildfires Attica 2015-2025", file: "Disasters/WildfiresAttica2015-2025.geojson" },
    ],
      "Earthquakes": [
        { name: "Earthquakes Attica 2006-2026", file: "Disasters/EarthquakesAttica2006-2026.json" },
        { name: "Seismic Hazard Zones", file: "Disasters/Seismiczones.json" }
      ],
      "Floods": [
        { name: "Flood Risk Zones 50T", file: "Disasters/Floods50T.geojson" },
        { name: "Flood Risk Zones 100T", file: "Disasters/Floods100T.geojson" },
        { name: "Flood Risk Zones 1000T", file: "Disasters/Floods1000T.geojson" }
      ]
  },
  "Points of Interest": {
    "City Services": [
      { name: "Banks", file: "Amenities/Banks.geojson" },
      { name: "Police Stations", file: "Amenities/Police.geojson" },
    ],
    "Commerce": [
      { name: "Fuel Stations", file: "Amenities/Fuel.geojson" },
    ],
    "Education": [
      { name: "Schools", file: "Amenities/Schools.geojson" },
      { name: "Universities", file: "Amenities/Universities.geojson" }
    ],
    "Entertainment and Leisure": [
      { name: "Cinemas", file: "Amenities/Cinemas.json" },
      { name: "Theaters", file: "Amenities/Theater.json" },
      { name: "Restaurants, Bars, and Cafe", file: "Amenities/RestBarCafe.json" }
    ],
    "Healthcare": [
      { name: "Hospitals", file: "Amenities/Hospitals.geojson" },
      { name: "Pharmacies", file: "Amenities/Pharmacies.geojson" },
    ],
  },
  "Population and social conditions": {
    "Population Census": [
      { name: "2021 Population Census", file: "Social/Population2021.json" },
      { name: "2011 Population Census", file: "Social/Population2011.json" }
    ]
  },
  "Urban Planning": {
    "KAEK": [
      { name: "KAEK Central Sector", file: "UrbanPlanning/KAEKcenter.geojson" },
      { name: "KAEK North Sector", file: "UrbanPlanning/KAEKnorth.geojson" },
      { name: "KAEK South Sector", file: "UrbanPlanning/KAEKsouth.geojson" },
      { name: "KAEK West Sector", file: "UrbanPlanning/KAEKwest.geojson" },
      { name: "KAEK Piraeus", file: "UrbanPlanning/KAEKpiraeus.geojson" }
    ],  
    "Land Uses": [
      { name: "Land Cover and Land Use (2021)", file: "UrbanPlanning/Land_Cover_2021.json" },
      { name: "Land Cover and Land Use (2018)", file: "UrbanPlanning/AthensCorine2018.json" },
      { name: "Municipality of Athens Urban Plan (2012)", file: "UrbanPlanning/Athens Urban Plan 2012.geojson" }
    ],
    "Public Spaces": [
      { name: "Archaeological Sites", file: "UrbanPlanning/Arch_sites.geojson" },
      { name: "Gardens", file: "UrbanPlanning/Gardens.geojson" },
      { name: "Parks", file: "UrbanPlanning/Parks.geojson" },
      { name: "Playgrounds", file: "UrbanPlanning/Playgrounds.geojson" }
    ]

  },
  "Transportation Systems": {
    "Road Network": [
      { name: "Avenues", file: "Transportation/AthensAvenues.json" },
      { name: "Highways (Greece)", file: "Transportation/GreeceHighways.geojson" },
      { name: "Street Network Central Sector", file: "Transportation/Streets_Center.geojson" },
      { name: "Street Network North Sector", file: "Transportation/Streets_North.geojson" },
      { name: "Street Network South Sector", file: "Transportation/Streets_South.geojson" },
      { name: "Street Network West Sector", file: "Transportation/Streets_West.geojson" },
      { name: "Street Network Piraeus", file: "Transportation/Streets_Piraeus.geojson" }
    ],
    "Road Transport": [
      { name: "AI Traffic Cameras", file: "Transportation/AICameras.json" },
      { name: "OASA Bus Lanes", file: "Transportation/Bus_Lanes.geojson" },
      { name: "OASA Bus Stops", file: "Transportation/AthensBusStops.geojson" },
      { name: "Toll Stations", file: "Transportation/TollStations.geojson" }, 
      { name: "Traffic Accidents 2023-2025", file: "Transportation/TrAccidents.json" },
      { name: "Traffic Lights", file: "Transportation/TrLights.geojson" }
    ],
    "Rail Transport": [
      { name: "Metro Stations of Lines 1, 2 and 3", file: "Transportation/AthensMetro123.geojson" },
      { name: "Metro Stations of Line 4", file: "Transportation/AthensMetro4.geojson" },
      { name: "Metro Lines 1, 2 and 3", file: "Transportation/AthensMetroNet.geojson" },
      { name: "Extended Metro Lines network", file: "Transportation/AthensMetroExtended.json" },
      { name: "Metro Boarding Platforms of Line 1", file: "Transportation/MetroPlatforms.geojson" },
      { name: "Railway Network (Greece)", file: "Transportation/GreeceRail.geojson" },
      { name: "Suburban Railway Stations", file: "Transportation/AthensTrain.geojson" },
      { name: "Tram Stations", file: "Transportation/TramStations.json" },  
      { name: "Tram Lines", file: "Transportation/TramLines.geojson" },
      { name: "Tram Boarding Platforms", file: "Transportation/TramPlatforms.geojson" }
    ]
  }
};

// 2. Global state wiring
const AthensGIS = window.AthensGIS = window.AthensGIS || {};
AthensGIS.layerCategories = layerCategories;
AthensGIS.geojsonLayers = AthensGIS.geojsonLayers || {};
AthensGIS.activeLayerInfos = AthensGIS.activeLayerInfos || {};
AthensGIS.selectedFeature = null;
AthensGIS.layerOpacities  = AthensGIS.layerOpacities  || {};
AthensGIS.activeLayerOrder = AthensGIS.activeLayerOrder || [];
AthensGIS.layerKeyByName   = AthensGIS.layerKeyByName   || {};
AthensGIS.customLayerColors = AthensGIS.customLayerColors || {};
const GITHUB_SITE_ROOT_URL = 'https://kmarkosgis.github.io/athens-gis-repository/';
const FIXED_ASSET_ROOTS = { data: 'data', info: 'info' };

function getMap(){ return AthensGIS.map; }

function encodePathSegments(path){
  return String(path || '')
    .split('/')
    .map(function(seg){ return encodeURIComponent(seg); })
    .join('/');
}

function normalizeAssetBase(base){
  var raw = String(base || '').trim();
  if(!raw) return '';
  raw = raw.replace(/\\/g, '/');
  // Convert same-host absolute URLs to path-only form.
  try{
    var parsed = new URL(raw, window.location.href);
    if(parsed.origin === window.location.origin){
      raw = parsed.pathname;
    }
  }catch(e){}
  // Force relative paths so GitHub project pages keep the repo prefix.
  raw = raw.replace(/^\/+/, '');
  raw = raw.replace(/\/+$/, '');
  return raw;
}

function normalizeRootUrl(input){
  try{
    var parsed = new URL(String(input || ''), window.location.href);
    parsed.hash = '';
    parsed.search = '';
    var path = (parsed.pathname || '/').replace(/\\/g, '/').replace(/\/{2,}/g, '/');
    if(path.toLowerCase().endsWith('/index.html')){
      path = path.slice(0, -'/index.html'.length);
    } else if(path && !path.endsWith('/')){
      var lastSeg = path.split('/').pop() || '';
      if(lastSeg.indexOf('.') !== -1){
        path = path.slice(0, path.lastIndexOf('/') + 1);
      }
    }
    if(!path.endsWith('/')) path += '/';
    parsed.pathname = path;
    return parsed.toString();
  }catch(e){
    return '';
  }
}

function getSiteRootUrl(){
  var host = String(window.location.hostname || '').toLowerCase();
  if(host === 'kmarkosgis.github.io'){
    return GITHUB_SITE_ROOT_URL;
  }
  var configured = AthensGIS && AthensGIS.siteRootUrl;
  var normalizedConfigured = normalizeRootUrl(configured);
  if(normalizedConfigured) return normalizedConfigured;
  var fallback = normalizeRootUrl(window.location.href);
  if(fallback) return fallback;
  return './';
}

function getAssetBaseCandidates(kind){
  return [kind === 'data' ? FIXED_ASSET_ROOTS.data : FIXED_ASSET_ROOTS.info];
}

function buildAssetUrl(kind, relativePath, base){
  var root = kind === 'data' ? FIXED_ASSET_ROOTS.data : FIXED_ASSET_ROOTS.info;
  var r2Base = window.CONFIG && window.CONFIG.R2_BASE_URL ? String(window.CONFIG.R2_BASE_URL).replace(/\/+$/, '') : null;
  if(r2Base){
    return r2Base + '/' + root + '/' + encodePathSegments(relativePath);
  }
  var runtimeBase = getSiteRootUrl();
  var url = new URL(root + '/' + encodePathSegments(relativePath), runtimeBase);
  url.pathname = url.pathname.replace(/(\/athens-gis-repository\/)+/ig, '/athens-gis-repository/');
  return url.toString();
}

function fetchAssetWithFallback(kind, relativePath, parser){
  var bases = getAssetBaseCandidates(kind);
  var attempts = [];
  function tryBase(index){
    if(index >= bases.length){
      return Promise.reject(new Error('Failed to load "' + relativePath + '" from ' + attempts.join(' | ')));
    }
    var url = buildAssetUrl(kind, relativePath, bases[index]);
    return fetch(url).then(function(resp){
      if(!resp.ok){
        throw new Error(resp.status + ' ' + resp.statusText + ' @ ' + url);
      }
      return parser(resp);
    }).catch(function(err){
      attempts.push((err && err.message) ? err.message : String(err));
      return tryBase(index + 1);
    });
  }
  return tryBase(0);
}

function loadLayerData(relativePath){
  return fetchAssetWithFallback('data', relativePath, function(resp){ return resp.json(); });
}

function loadLayerInfo(relativePath){
  return fetchAssetWithFallback('info', relativePath, function(resp){ return resp.text(); });
}

// ── Viewport-based rendering ──────────────────────────────────────────────────
// Pre-compute flat [minLng, minLat, maxLng, maxLat] for each feature once on load.
function _computeFeatureBbox(feature){
  var mn0=Infinity,mn1=Infinity,mx0=-Infinity,mx1=-Infinity;
  function v(c){ if(c[0]<mn0)mn0=c[0]; if(c[0]>mx0)mx0=c[0]; if(c[1]<mn1)mn1=c[1]; if(c[1]>mx1)mx1=c[1]; }
  function g(geom){
    if(!geom) return;
    var t=geom.type,co=geom.coordinates;
    if(t==='Point'){ v(co); }
    else if(t==='LineString'||t==='MultiPoint'){ co.forEach(v); }
    else if(t==='Polygon'||t==='MultiLineString'){ co.forEach(function(r){ r.forEach(v); }); }
    else if(t==='MultiPolygon'){ co.forEach(function(p){ p.forEach(function(r){ r.forEach(v); }); }); }
    else if(t==='GeometryCollection'){ (geom.geometries||[]).forEach(g); }
  }
  g(feature.geometry);
  return [mn0,mn1,mx0,mx1];
}

function indexLayerData(cacheKey, data){
  AthensGIS._layerCache = AthensGIS._layerCache || {};
  var features = (data && data.features) || [];
  AthensGIS._layerCache[cacheKey] = {
    features: features,
    bboxes: features.map(_computeFeatureBbox)
  };
}

function getViewportData(cacheKey, mapBounds){
  var cache = AthensGIS._layerCache && AthensGIS._layerCache[cacheKey];
  if(!cache) return { type:'FeatureCollection', features:[] };
  var sw=mapBounds.getSouthWest(), ne=mapBounds.getNorthEast();
  var wLng=sw.lng, eLng=ne.lng, sLat=sw.lat, nLat=ne.lat;
  var out=[], features=cache.features, bboxes=cache.bboxes;
  for(var i=0;i<features.length;i++){
    var b=bboxes[i];
    if(b[0]<=eLng && b[2]>=wLng && b[1]<=nLat && b[3]>=sLat) out.push(features[i]);
  }
  return { type:'FeatureCollection', features:out };
}

function setupViewportUpdateHandler(){
  if(AthensGIS._viewportHandlerBound) return;
  AthensGIS._viewportHandlerBound = true;
  getMap().on('moveend zoomend', function(){
    var bounds = getMap().getBounds();
    var vl = AthensGIS._viewportLayers || {};
    Object.keys(vl).forEach(function(cacheKey){
      var group = vl[cacheKey];
      if(group && typeof group.updateViewportData === 'function'){
        group.updateViewportData(getViewportData(cacheKey, bounds));
      }
    });
  });
}
// ── End viewport helpers ──────────────────────────────────────────────────────

// Resolve a legend class by exact match or numeric range (e.g. "2.5-3.5", "6.5+").
function getLegendClassForValue(legendConfig, value){
  if(!legendConfig || !legendConfig.classes) return null;
  var classes = legendConfig.classes;
  if(Object.prototype.hasOwnProperty.call(classes, value)) return classes[value];
  var num = Number(value);
  if(!Number.isFinite(num)) return null;
  for(var key in classes){
    if(!Object.prototype.hasOwnProperty.call(classes, key)) continue;
    var style = classes[key];
    if(!style) continue;
    var rangeMatch = key.match(/^\s*(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)\s*$/);
    if(rangeMatch){
      var min = parseFloat(rangeMatch[1]);
      var max = parseFloat(rangeMatch[2]);
      if(num >= min && num <= max) return style;
      continue;
    }
    var lowerMatch = key.match(/^\s*(-?\d+(?:\.\d+)?)\s*\+\s*$/);
    if(lowerMatch){
      var lower = parseFloat(lowerMatch[1]);
      if(num >= lower) return style;
    }
  }
  return null;
}

var DEFAULT_LAYER_FILL_COLOR = '#8392AA';
var DEFAULT_LAYER_BORDER_COLOR = '#55647C';
var LAYER_COLOR_SWATCHES = [
  { name: 'Red', hex: '#E53935' },
  { name: 'Orange', hex: '#FB8C00' },
  { name: 'Yellow', hex: '#FDD835' },
  { name: 'Green', hex: '#43A047' },
  { name: 'Cyan', hex: '#00ACC1' },
  { name: 'Blue', hex: '#1E88E5' },
  { name: 'Indigo', hex: '#3949AB' },
  { name: 'Purple', hex: '#8E24AA' },
  { name: 'Brown', hex: '#6D4C41' }
];

function clampChannel(value){
  return Math.max(0, Math.min(255, Math.round(value)));
}

function normalizeHexColor(hex){
  var raw = String(hex || '').trim();
  if(!/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(raw)) return null;
  if(raw.length === 4){
    return '#' + raw[1] + raw[1] + raw[2] + raw[2] + raw[3] + raw[3];
  }
  return raw.toUpperCase();
}

function lightenHexColor(hex, amount){
  var normalized = normalizeHexColor(hex);
  if(!normalized) return DEFAULT_LAYER_FILL_COLOR;
  var pct = Number(amount);
  if(!Number.isFinite(pct)) pct = 0.28;
  pct = Math.max(0, Math.min(1, pct));
  var r = parseInt(normalized.slice(1, 3), 16);
  var g = parseInt(normalized.slice(3, 5), 16);
  var b = parseInt(normalized.slice(5, 7), 16);
  var nr = clampChannel(r + (255 - r) * pct);
  var ng = clampChannel(g + (255 - g) * pct);
  var nb = clampChannel(b + (255 - b) * pct);
  return '#' + [nr, ng, nb].map(function(v){
    var s = v.toString(16).toUpperCase();
    return s.length === 1 ? '0' + s : s;
  }).join('');
}

function getReadableTextColor(bgHex){
  var normalized = normalizeHexColor(bgHex);
  if(!normalized) return '#FFFFFF';
  var r = parseInt(normalized.slice(1, 3), 16);
  var g = parseInt(normalized.slice(3, 5), 16);
  var b = parseInt(normalized.slice(5, 7), 16);
  var luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? '#111827' : '#FFFFFF';
}

function getLayerColorState(layerName){
  var store = AthensGIS.customLayerColors = AthensGIS.customLayerColors || {};
  var existing = store[layerName];
  if(existing && existing.border && existing.fill){
    return existing;
  }
  var state = {
    border: DEFAULT_LAYER_BORDER_COLOR,
    fill: DEFAULT_LAYER_FILL_COLOR
  };
  store[layerName] = state;
  return state;
}

function setLayerColorState(layerName, borderColor){
  var normalizedBorder = normalizeHexColor(borderColor) || DEFAULT_LAYER_BORDER_COLOR;
  var next = {
    border: normalizedBorder,
    fill: lightenHexColor(normalizedBorder, 0.34)
  };
  AthensGIS.customLayerColors = AthensGIS.customLayerColors || {};
  AthensGIS.customLayerColors[layerName] = next;
  return next;
}

function resetLayerColorState(layerName){
  var next = {
    border: DEFAULT_LAYER_BORDER_COLOR,
    fill: DEFAULT_LAYER_FILL_COLOR
  };
  AthensGIS.customLayerColors = AthensGIS.customLayerColors || {};
  AthensGIS.customLayerColors[layerName] = next;
  return next;
}

// 3. Helper to build property table
function buildPropertyTable(feature){
  if(!feature || !feature.properties) return '';
  var rows='';
  var keyAliases = {
    'Κωδι_1': 'Code',
    'Επιπέ': 'Education Level',
    'Τύπος': 'Type',
    'Ονομα': 'Name (GR)',
    'Νομός': 'Regional Unit (GR)',
    'Δήμος': 'Municipality (GR)'
  };
  for(var key in feature.properties){
    if(!Object.prototype.hasOwnProperty.call(feature.properties,key)) continue;
    var v = feature.properties[key];
    var k = String(key || '').toLowerCase();
    var d = key;
    if(Object.prototype.hasOwnProperty.call(keyAliases, key)) d = keyAliases[key];
    else if(Object.prototype.hasOwnProperty.call(keyAliases, k)) d = keyAliases[k];

    if(k==='shapeleng_'){ v=Number(v).toFixed(2); d='Shape Length (km)'; }
    else if(k==='shapearea'){ v=Number(v).toFixed(4); d='Shape Area (km²)'; }
    else if(['shapeleng_m','shapelengm','length','shape_leng'].includes(k)){ v=Number(v).toFixed(2); d='Shape Length (m)'; }
    else if(['shapearea_m','shapeaream'].includes(k)){ v=Number(v).toFixed(2); d='Shape Area (m²)'; }
    else if(['name','name_el','name_place','gname','uses_gr'].includes(k)){ d='Name (GR)'; }
    else if(['ename','name_pl_en','name_en','uses_en','name:en','class_2021'].includes(k)){ d='Name (ENG)'; }
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
    else if(k==='highway' || k=='historic') d='Type';
    else if(k==='oneway') d='One-Way Road';
    else if(k==='surface') d='Surface Type';
    else if(k==='fid' || k==='objectid'|| k==='full_id') d='Feature ID';
    else if(k==='code_2021' || k==='code_18') d='Reference Code';
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
    else if(k==='mag') {v=Number(v).toFixed(1); d='Magnitude';}
    else if(k==='place') d='Place';
    else if(k==='amenity') d='Amenity';
    else if(k==='leisure') d='Public space type';
    else if(k==='period') d='Return Period (years)';
    rows += '<tr><th>'+d+'</th><td>'+v+'</td></tr>';
  }
  return '<table class="feature-properties-table">'+rows+'</table>';
}
var _layerInfoBox = null;
var _layerInfoBoxListenerAttached = false;
var _infoBox = null;
var _infoContent = null;

function ensureInfoBoxUpdate(){
  if(!_layerInfoBox) _layerInfoBox = document.getElementById('layerInfoBox');
  var infoBox = _layerInfoBox; if(!infoBox) return;
  var contentEl = document.getElementById('layerInfoContent'); if(!contentEl) contentEl = infoBox;

  // Attach delegated click handler once — survives innerHTML replacements
  if(!_layerInfoBoxListenerAttached){
    _layerInfoBoxListenerAttached = true;
    infoBox.addEventListener('click', function(e){
      var id = e.target && e.target.id;
      if(id === 'prevTabBtn'){
        if(AthensGIS.tabState && AthensGIS.tabState.currentTab > 0){
          AthensGIS.tabState.currentTab--;
          ensureInfoBoxUpdate();
        }
      } else if(id === 'nextTabBtn'){
        var names = Object.keys(AthensGIS.activeLayerInfos);
        if(AthensGIS.tabState && AthensGIS.tabState.currentTab < names.length - 1){
          AthensGIS.tabState.currentTab++;
          ensureInfoBoxUpdate();
        }
      }
    });
  }
  
  var layerNames = Object.keys(AthensGIS.activeLayerInfos);
  
  if(layerNames.length === 0){
    infoBox.style.display='none';
    return;
  }
  
  // Initialize tab state if not exists
  if(!AthensGIS.tabState){
    AthensGIS.tabState = { currentTab: 0 };
  }
  
  // Ensure current tab is within bounds
  if(AthensGIS.tabState.currentTab >= layerNames.length){
    AthensGIS.tabState.currentTab = layerNames.length - 1;
  }
  
  // Build compact tabs container: show only the active layer title and arrows
  var activeName = layerNames[AthensGIS.tabState.currentTab] || '';
  var countLabel = '';
  if(layerNames.length > 1){ countLabel = ' <span style="font-size:11px; color:#555;">(' + (AthensGIS.tabState.currentTab + 1) + '/' + layerNames.length + ')</span>'; }
  var tabsHtml = '<div id="tabsContainer" style="position:sticky; top:55px; display:flex; gap:8px; align-items:center; padding:8px 10px; border-bottom:1px solid #ccc; background-color:white;">';
  tabsHtml += '<button id="prevTabBtn" style="background:rgba(55, 65, 81, 0.85); color:white; border:none; padding:6px 10px; border-radius:8px; cursor:pointer; font-size:14px;">❮</button>';
  tabsHtml += '<div id="activeLayerTitle" style="flex:1; text-align:center; font-weight:500; font-size:14px; color:#222;">' + activeName + countLabel + '</div>';
  tabsHtml += '<button id="nextTabBtn" style="background:rgba(55, 65, 81, 0.85); color:white; border:none; padding:6px 10px; border-radius:8px; cursor:pointer; font-size:14px;">❯</button>';
  tabsHtml += '</div>';
  
  // Build content areas (only show active tab)
  var contentHtml = '<div id="contentContainer" style="padding:10px; max-height:250px; overflow-y:auto;">';
  layerNames.forEach(function(name, idx){
    var isActive = idx === AthensGIS.tabState.currentTab;
    var display = isActive ? 'block' : 'none';
    contentHtml += '<div class="layer-tab-content" data-tab-index="'+idx+'" style="display:'+display+';">'+AthensGIS.activeLayerInfos[name]+'</div>';
  });
  contentHtml += '</div>';
  
  // Combine all HTML
  var html = tabsHtml + contentHtml;
  contentEl.innerHTML = html;
  infoBox.style.display = 'block';
  
}

  // 4. Factory for geojson options
var _highlightRenderer = null;
var _highlightOverlayLayer = null;

function applyHighlightOverlay(map, geojsonFeature, highlightStyle){
  if(_highlightOverlayLayer){ try{ _highlightOverlayLayer.remove(); }catch(_){} _highlightOverlayLayer = null; }
  if(!map || !geojsonFeature) return;
  if(!_highlightRenderer){
    try{
      if(!map.getPane('highlight-pane')){
        map.createPane('highlight-pane');
        map.getPane('highlight-pane').style.zIndex = 655;
        map.getPane('highlight-pane').style.pointerEvents = 'none';
      }
    }catch(e){}
    _highlightRenderer = L.svg({ pane: 'highlight-pane' });
  }
  var s = highlightStyle || {};
  _highlightOverlayLayer = L.geoJSON(geojsonFeature, {
    renderer: _highlightRenderer,
    style: function(){ return { color: s.color||'#333', weight: s.weight||2, fillColor: s.fillColor||s.color||'#333', opacity: s.opacity||1, fillOpacity: s.fillOpacity||1 }; },
    pointToLayer: function(f, latlng){
      return L.circleMarker(latlng, { renderer: _highlightRenderer, radius: s.radius||6, color: s.color||'#333', weight: s.weight||2, fillColor: s.fillColor||s.color||'#333', opacity: s.opacity||1, fillOpacity: s.fillOpacity||1 });
    }
  }).addTo(map);
  _highlightOverlayLayer.eachLayer(function(l){
    if(l._path){
      l._path.style.pointerEvents = 'none';
      l._path.style.transition = 'filter 0.15s ease';
      l._path.style.filter = 'drop-shadow(0 6px 18px rgba(0,0,0,0.65)) drop-shadow(0 2px 5px rgba(0,0,0,0.5))';
    }
  });
}

function resetFeatureHighlight(){
  if(_highlightOverlayLayer){ try{ _highlightOverlayLayer.remove(); }catch(_){} _highlightOverlayLayer = null; }
  if(AthensGIS.selectedFeature){
    var sf = AthensGIS.selectedFeature;
    AthensGIS.selectedFeature = null;
    Object.keys(AthensGIS.geojsonLayers).forEach(function(key){
      var lyr = AthensGIS.geojsonLayers[key];
      if(lyr && typeof lyr.resetStyle === 'function'){
        try{ lyr.resetStyle(sf); }catch(_){}
      }
    });
  }
}

function geojsonOptions(layerName, legendConfig){
  return {
    style: function(feature){
      var baseWeight =1;
      var fillOpacity = (AthensGIS.layerOpacities && AthensGIS.layerOpacities[layerName] !== undefined) ? AthensGIS.layerOpacities[layerName] : 1;
      var layerColors = (!legendConfig) ? getLayerColorState(layerName) : null;
      // Special styling for Terrain/Relief: scale-aware contour visibility
      if(layerName==='Terrain' || layerName==='Relief'){
        try{
          var geomType = feature && feature.geometry && feature.geometry.type;
          var contourRaw = feature && feature.properties && (feature.properties.Contour || feature.properties.contour || feature.properties.CONTOUR);
          var contourVal = (typeof contourRaw !== 'undefined' && contourRaw !== null && contourRaw !== '') ? Number(contourRaw) : NaN;
          var terrainLegend = legendConfig || ((window.legendConfigs||{}).Terrain || null);
          if((typeof contourRaw === 'undefined' || contourRaw === null || contourRaw === '') && terrainLegend && terrainLegend.field && feature && feature.properties){
            contourRaw = feature.properties[terrainLegend.field];
          }
          var contourStyle = getLegendClassForValue(terrainLegend, contourRaw);
          var contourColor = contourStyle && contourStyle.color ? contourStyle.color : null;
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
              if(isHeavy){
                var heavyStyle = { weight: baseWeight, opacity: fillOpacity, fillOpacity: fillOpacity };
                if(contourColor){ heavyStyle.color = contourColor; }
                return heavyStyle;
              }
              var hiddenStyle = { weight: baseWeight, opacity: 0, fillOpacity: 0 };
              if(contourColor){ hiddenStyle.color = contourColor; }
              return hiddenStyle;
            } else {
              // At smaller scales (denominator >= 100000): show all contours, heavy ones emphasised
              if(isHeavy){
                var emphStyle = { weight: baseWeight * 2, opacity: fillOpacity, fillOpacity: fillOpacity };
                if(contourColor){ emphStyle.color = contourColor; }
                return emphStyle;
              }
              var normalStyle = { weight: baseWeight, opacity: fillOpacity, fillOpacity: fillOpacity };
              if(contourColor){ normalStyle.color = contourColor; }
              return normalStyle;
            }
          }

          // Non-line geometries (polygons, points): render normally
          var terrainStyle = { weight: baseWeight, opacity: fillOpacity, fillOpacity: fillOpacity };
          if(contourColor){ terrainStyle.color = contourColor; terrainStyle.fillColor = contourColor; }
          return terrainStyle;
        }catch(e){
          return { weight: baseWeight, opacity: fillOpacity, fillOpacity: fillOpacity };
        }
      }
      if(legendConfig && feature.properties && legendConfig.field in feature.properties){
        var cv = feature.properties[legendConfig.field];
        var cs = getLegendClassForValue(legendConfig, cv);
        if(cs) return { color: cs.color, weight: baseWeight, fillColor: cs.color, opacity: fillOpacity, fillOpacity: fillOpacity };
      }
      return {
        color: (layerColors && layerColors.border) || DEFAULT_LAYER_BORDER_COLOR,
        weight: baseWeight,
        fillColor: (layerColors && layerColors.fill) || DEFAULT_LAYER_FILL_COLOR,
        opacity: fillOpacity,
        fillOpacity: fillOpacity
      };
    },
    pointToLayer: function(feature, latlng){
      var radius = 4;
      var layerColors = (!legendConfig) ? getLayerColorState(layerName) : null;
      var fillColor = (layerColors && layerColors.fill) || DEFAULT_LAYER_FILL_COLOR;
      var color = (layerColors && layerColors.border) || DEFAULT_LAYER_BORDER_COLOR;
      if(legendConfig && feature.properties && legendConfig.field in feature.properties){
        var cvp = feature.properties[legendConfig.field];
        var csp = getLegendClassForValue(legendConfig, cvp);
        if(csp){
          if(Number.isFinite(csp.radius)) radius = csp.radius;
          if(csp.color){ fillColor = csp.color; color = csp.color; }
        }
      }
      var lyrOpacity = (AthensGIS.layerOpacities && AthensGIS.layerOpacities[layerName] !== undefined) ? AthensGIS.layerOpacities[layerName] : 1;
      return L.circleMarker(latlng,{ radius: radius, fillColor: fillColor, color: color, weight:1, opacity:lyrOpacity, fillOpacity:lyrOpacity });
    },
    onEachFeature: function(feature, layer){
      if(!_infoBox) _infoBox = document.getElementById('infoBox');
      if(!_infoContent) _infoContent = document.getElementById('infoContent');
      var infoParent = _infoBox;
      var infoContent = _infoContent;
      var html = (layerName !== 'Terrain' && layerName !== 'Relief') ? buildPropertyTable(feature) : null;
      layer.on('click', function(e){
        L.DomEvent.stopPropagation(e);
        resetFeatureHighlight();
        AthensGIS.selectedFeature = e.target;
        var lc = (window.legendConfigs||{})[layerName];
        if(!lc && (layerName==='Terrain' || layerName==='Relief')) lc = (window.legendConfigs||{}).Terrain;
        var lyrHighlightOpacity = (AthensGIS.layerOpacities && AthensGIS.layerOpacities[layerName] !== undefined) ? AthensGIS.layerOpacities[layerName] : 1;
        var highlight = { weight: 2, opacity: lyrHighlightOpacity, fillOpacity: lyrHighlightOpacity };
        if(lc && feature.properties){
          var cv2 = (lc.field && lc.field in feature.properties) ? feature.properties[lc.field] : undefined;
          if((typeof cv2 === 'undefined' || cv2 === null || cv2 === '') && (layerName==='Terrain' || layerName==='Relief')){
            cv2 = feature.properties.Contour || feature.properties.contour || feature.properties.CONTOUR;
          }
          var cs2 = getLegendClassForValue(lc, cv2);
          if(cs2){
            highlight.color = cs2.color;
            highlight.fillColor = cs2.color;
          } else {
            var fallbackLegendColors = getLayerColorState(layerName);
            highlight.color = fallbackLegendColors.border;
            highlight.fillColor = fallbackLegendColors.fill;
          }
        } else {
          var fallbackColors = getLayerColorState(layerName);
          highlight.color = fallbackColors.border;
          highlight.fillColor = fallbackColors.fill;
        }
        e.target.setStyle(highlight);
        if(layerName !== 'Terrain' && layerName !== 'Relief' && e.target.feature){
          if(e.target.options && Number.isFinite(e.target.options.radius)) highlight.radius = e.target.options.radius;
          applyHighlightOverlay(getMap(), e.target.feature, highlight);
        }
        e.target.bringToFront();
        if(html && infoContent){
          infoContent.innerHTML = html;
          if(infoParent) infoParent.style.display = 'block';
        }
      });
    }
  };
}
// 5. Render Layer Control UI
// Helper: create map panes for vector ordering and build a layer (or layerGroup) that
// places polygon geometries in a lower pane and point/line geometries in a higher pane.
function createLayerFromGeoJSON(data, layerName, legendConfig){
  var map = getMap();
  if(!map) return null;
  function hasValidCoordinates(type, coordinates){
    function isPosition(pos){
      if(!Array.isArray(pos) || pos.length < 2) return false;
      var lon = Number(pos[0]);
      var lat = Number(pos[1]);
      return Number.isFinite(lon) && Number.isFinite(lat) && lon >= -180 && lon <= 180 && lat >= -90 && lat <= 90;
    }
    if(!type) return false;
    if(type === 'Point') return isPosition(coordinates);
    if(type === 'MultiPoint' || type === 'LineString'){
      return Array.isArray(coordinates) && coordinates.length > 0 && coordinates.every(isPosition);
    }
    if(type === 'MultiLineString' || type === 'Polygon'){
      return Array.isArray(coordinates) && coordinates.length > 0 &&
        coordinates.every(function(segment){
          return Array.isArray(segment) && segment.length > 0 && segment.every(isPosition);
        });
    }
    if(type === 'MultiPolygon'){
      return Array.isArray(coordinates) && coordinates.length > 0 &&
        coordinates.every(function(polygon){
          return Array.isArray(polygon) && polygon.length > 0 &&
            polygon.every(function(ring){
              return Array.isArray(ring) && ring.length > 0 && ring.every(isPosition);
            });
        });
    }
    return false;
  }
  // Ensure panes exist
  try{
    if(!map.getPane('vector-bottom')){ map.createPane('vector-bottom'); map.getPane('vector-bottom').style.zIndex = 450; }
    if(!map.getPane('vector-top')){ map.createPane('vector-top'); map.getPane('vector-top').style.zIndex = 650; }
  }catch(e){}

  var features = (data && data.features) ? data.features.filter(function(f){
    return f && f.geometry && hasValidCoordinates(f.geometry.type, f.geometry.coordinates);
  }) : [];
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
                // Keep contour labels horizontal for readability.
                var html = '<div style="font-size:10px; color:white; background:rgba(55, 65, 81, 0.75); padding:2px 4px; border-radius:6px; border:none; z-index:9999; letter-spacing:0.5px; font-weight:500; display:inline-block;">'+String(contour)+'</div>';
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

  // Capture native resetStyle references before overwriting (prevents infinite recursion when group===polyLayer or group===vecLayer)
  var _polyReset = (polyLayer && typeof polyLayer.resetStyle === 'function') ? polyLayer.resetStyle.bind(polyLayer) : null;
  var _vecReset  = (vecLayer  && typeof vecLayer.resetStyle  === 'function') ? vecLayer.resetStyle.bind(vecLayer)   : null;
  group.resetStyle = function(feature){
    if(_polyReset) try{ _polyReset(feature); }catch(_){}
    if(_vecReset)  try{ _vecReset(feature);  }catch(_){}
  };

  group.updateViewportData = function(filteredData){
    var fts = filteredData && filteredData.features || [];
    var pFts = fts.filter(function(f){ return f&&f.geometry&&(f.geometry.type==='Polygon'||f.geometry.type==='MultiPolygon'); });
    var vFts = fts.filter(function(f){ return f&&f.geometry&&f.geometry.type!=='Polygon'&&f.geometry.type!=='MultiPolygon'; });
    if(polyLayer){ try{ polyLayer.clearLayers(); if(pFts.length) polyLayer.addData({type:'FeatureCollection',features:pFts}); }catch(_){} }
    if(vecLayer){  try{ vecLayer.clearLayers();  if(vFts.length) vecLayer.addData({type:'FeatureCollection',features:vFts});   }catch(_){} }
  };

  return group;
}
function startLoadingSpinner(label){
  var el = document.createElement('span');
  el.className = 'layer-loading-spinner';
  label.appendChild(el);
  var timer = setTimeout(function(){ el.classList.add('visible'); }, 1000);
  return function stopSpinner(){
    clearTimeout(timer);
    if(el.parentNode) el.parentNode.removeChild(el);
  };
}

function renderLayerControl(){
  if(!getMap()) return setTimeout(renderLayerControl,50);
  var controlDiv = document.getElementById('layerControl'); if(!controlDiv) return;

  if(!controlDiv.querySelector('#layerSearch')){
    var wrap=document.createElement('div'); wrap.id='searchZoomContainer'; wrap.style.display='flex'; wrap.style.flexDirection='column'; wrap.style.alignItems='center'; wrap.style.gap='8px';
    var title = document.createElement('div'); title.textContent = 'LAYERS'; title.style.fontSize = '14px'; title.style.fontWeight = '500'; title.style.margin = '2px 0 8px 0'; title.style.padding = '6px 10px'; title.style.background = 'rgba(55, 65, 81, 0.85)'; title.style.color = 'white'; title.style.borderRadius = '10px'; title.style.textAlign = 'center'; title.style.letterSpacing = '2px'; title.style.width='93%';
    var inp=document.createElement('input'); inp.type='text'; inp.id='layerSearch'; inp.placeholder='Search layers...'; inp.style.width='93%'; inp.style.height='10px'; inp.style.padding='4px 4px'; inp.style.marginBottom='6px'; inp.style.borderRadius='12px'; inp.style.border='1px solid #ccc'; inp.style.fontSize='13px';
    // The zoom-to-selected button was moved to the main toolbar (index.html). Keep only the search input here.
    wrap.appendChild(title);
    wrap.appendChild(inp);
    controlDiv.appendChild(wrap);
    // Search behavior: show flat list without category titles
    var _searchTimer;
    inp.addEventListener('input', function(){
      var val = this.value;
      clearTimeout(_searchTimer);
      _searchTimer = setTimeout(function(){
      var term=val.toLowerCase().trim();
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
      }, 200);
    });
    // Attach the zoom-to-selected behavior to the toolbar button if present
    (function(){ var extBtn = document.getElementById('zoomSelectedBtn'); if(!extBtn) return; extBtn.addEventListener('click', function(){ var group=L.featureGroup(); Object.keys(AthensGIS.geojsonLayers).forEach(function(k){ var lyr=AthensGIS.geojsonLayers[k]; if(lyr && getMap().hasLayer(lyr)) group.addLayer(lyr); }); if(group.getLayers().length) getMap().fitBounds(group.getBounds().pad(0.05)); }); })();
  }

  while(controlDiv.children.length>1) controlDiv.removeChild(controlDiv.lastChild);

  function closeOpenColorPanels(exceptPanel){
    controlDiv.querySelectorAll('.layer-color-panel.open').forEach(function(panel){
      if(panel !== exceptPanel) panel.classList.remove('open');
    });
  }

  function refreshLayerStylesForKey(layerKey){
    if(!layerKey) return;
    var target = AthensGIS.geojsonLayers && AthensGIS.geojsonLayers[layerKey];
    if(!target) return;
    try{
      if(typeof target.setStyle === 'function' && target.options && typeof target.options.style === 'function'){
        target.setStyle(target.options.style);
      }
    }catch(e){}
    try{
      if(target._polyLayer && typeof target._polyLayer.setStyle === 'function' && target._polyLayer.options && typeof target._polyLayer.options.style === 'function'){
        target._polyLayer.setStyle(target._polyLayer.options.style);
      }
    }catch(e){}
    try{
      if(target._vecLayer && typeof target._vecLayer.setStyle === 'function' && target._vecLayer.options && typeof target._vecLayer.options.style === 'function'){
        target._vecLayer.setStyle(target._vecLayer.options.style);
      }
    }catch(e){}
  }

  function updateColorButtonPreview(buttonEl, layerName){
    if(!buttonEl || !layerName) return;
    var colors = getLayerColorState(layerName);
    // Keep border styling identical to the shared button CSS; only tint the button fill.
    buttonEl.style.backgroundColor = colors.border;
    buttonEl.style.color = getReadableTextColor(colors.border);
    buttonEl.style.boxShadow = 'inset 0 0 0 1px rgba(255,255,255,0.15)';
  }

  function applyLayerRowColorSelection(layerName, layerKey, borderColor, colorButton, colorPanel){
    if(!layerName) return;
    setLayerColorState(layerName, borderColor);
    updateColorButtonPreview(colorButton, layerName);
    if(colorPanel) colorPanel.classList.remove('open');
    refreshLayerStylesForKey(layerKey);
  }

  function resetLayerRowColorSelection(layerName, layerKey, colorButton, colorPanel){
    if(!layerName) return;
    resetLayerColorState(layerName);
    updateColorButtonPreview(colorButton, layerName);
    if(colorPanel) colorPanel.classList.remove('open');
    refreshLayerStylesForKey(layerKey);
  }

  if(!AthensGIS._layerColorPickerDocHandlerAdded){
    document.addEventListener('click', function(evt){
      var lc = document.getElementById('layerControl');
      if(!lc) return;
      if(lc.contains(evt.target)) return;
      lc.querySelectorAll('.layer-color-panel.open').forEach(function(panel){
        panel.classList.remove('open');
      });
    });
    AthensGIS._layerColorPickerDocHandlerAdded = true;
  }

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
    row.appendChild(cb); row.appendChild(label);
    // Tag parent for search restore
    row.dataset.parentId = commonWrap.id;
    commonWrap.appendChild(row);

    cb.addEventListener('change', function(){
  var layerName=this.dataset.layername; var dEl=this.parentElement.querySelector('.download-button');
      if(this.checked){
        row.classList.add('selected');
        if(dEl) dEl.style.display='inline-block';
        var stopTerrainSpinner = startLoadingSpinner(label);
        row._stopSpinner = stopTerrainSpinner;
        AthensGIS.activeLayerInfos[layerName]='<em>Loading info...</em>';
        ensureInfoBoxUpdate();
        // Show legend immediately
        if(typeof window.updateLegendBar==='function' && (window.legendConfigs||{})[layerName]){
          window.updateLegendBar(layerName);
        }
        loadLayerData('Environment/Relief.json')
            .then(function(data){
            stopTerrainSpinner();
            var lc=(window.legendConfigs||{})[layerName];
            if(typeof window.updateLegendBar==='function') window.updateLegendBar(layerName);
            var lyr=createLayerFromGeoJSON(data, layerName, lc);
            // Keep internal key as 'Relief' for cleanup compatibility
            AthensGIS.geojsonLayers['Relief']=lyr;
          }).catch(function(err){
            stopTerrainSpinner();
            console.error('Failed to load Terrain layer data:', err);
            AthensGIS.activeLayerInfos[layerName]='<em>Could not load layer data.</em>';
            ensureInfoBoxUpdate();
          });
        loadLayerInfo('Environment/Relief.txt').then(function(t){ AthensGIS.activeLayerInfos[layerName]=t; ensureInfoBoxUpdate(); })
          .catch(()=>{ AthensGIS.activeLayerInfos[layerName]='<em>No extra info available for this layer.</em>'; ensureInfoBoxUpdate(); });
        if(AthensGIS.activeLayerOrder.indexOf(layerName)===-1) AthensGIS.activeLayerOrder.push(layerName);
        AthensGIS.layerKeyByName[layerName]='Relief';
        if(typeof AthensGIS.refreshOpacityPopup==='function') AthensGIS.refreshOpacityPopup();
      } else {
        if(typeof row._stopSpinner==='function'){ row._stopSpinner(); row._stopSpinner=null; }
        resetFeatureHighlight();
        row.classList.remove('selected');
        if(dEl) dEl.style.display='none';
        if(AthensGIS.geojsonLayers['Relief']){ getMap().removeLayer(AthensGIS.geojsonLayers['Relief']); delete AthensGIS.geojsonLayers['Relief']; }
        // Update legend to remove this layer's entry
        if(typeof window.updateLegendBar==='function') window.updateLegendBar(layerName,'remove');
        delete AthensGIS.activeLayerInfos[layerName];
        ensureInfoBoxUpdate();
        var idx=(AthensGIS.activeLayerOrder||[]).indexOf(layerName); if(idx!==-1) AthensGIS.activeLayerOrder.splice(idx,1);
        delete AthensGIS.layerKeyByName[layerName];
        if(typeof AthensGIS.refreshOpacityPopup==='function') AthensGIS.refreshOpacityPopup();
        if(!_infoBox) _infoBox = document.getElementById('infoBox'); if(_infoBox) _infoBox.style.display='none';
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

  function slugify(text){
    return String(text || '')
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9\-]/g, '');
  }

   function normalizeSubcategories(catData){
    if(Array.isArray(catData)) return { "General": catData };
    if(!catData || typeof catData !== 'object') return {};
    return Object.keys(catData).reduce(function(acc, key){
      if(key === '_items') return acc;
      acc[key] = catData[key];
      return acc;
    }, {});
  }

  function getCategoryItems(catData){
    if(!catData || typeof catData !== 'object' || Array.isArray(catData)) return [];
    return Array.isArray(catData._items) ? catData._items : [];
  }

  function countCheckedByDataset(key, value){
    return Array.from(controlDiv.querySelectorAll('.layer-item')).reduce(function(acc, r){
      try{
        if(r.dataset && r.dataset[key] === value){
          var cbx = r.querySelector('input[type=checkbox]');
          if(cbx && cbx.checked) return acc + 1;
        }
      }catch(e){}
      return acc;
    }, 0);
  }

  function updateCountBadge(countSpan, count, arrowEl){
    if(!countSpan) return;
    if(count > 0){
      countSpan.textContent = count;
      countSpan.style.display = 'inline-flex';
      if(arrowEl) arrowEl.style.marginLeft = '2px';
    } else {
      countSpan.textContent = '';
      countSpan.style.display = 'none';
      if(arrowEl) arrowEl.style.marginLeft = 'auto';
    }
  }

  function sanitizeDownloadFilePart(value){
    var cleaned = String(value || 'Layer').replace(/[\\/:*?"<>|]/g, '').trim();
    cleaned = cleaned.replace(/\s+/g, ' ');
    return cleaned || 'Layer';
  }

  function getLayerZipFileName(layerName){
    return 'AthensGISRepository_' + sanitizeDownloadFilePart(layerName) + '.zip';
  }

  function setDownloadButtonBusy(buttonEl, isBusy){
    if(!buttonEl) return;
    if(isBusy){
      if(!buttonEl.dataset.originalLabel) buttonEl.dataset.originalLabel = buttonEl.textContent || 'DOWNLOAD';
      buttonEl.textContent = 'PREPARING...';
      buttonEl.style.pointerEvents = 'none';
      buttonEl.style.opacity = '0.85';
      return;
    }
    buttonEl.textContent = buttonEl.dataset.originalLabel || 'DOWNLOAD';
    buttonEl.style.pointerEvents = '';
    buttonEl.style.opacity = '';
  }

  function downloadLayerAsZip(info, categoryName, subcategoryName, buttonEl){
    if(!info || !info.file) return Promise.resolve();
    if(typeof JSZip === 'undefined'){
      console.error('JSZip is not available.');
      return Promise.resolve();
    }
    var sourceFile = String(info.file);
    var sourceName = sourceFile.split('/').pop() || 'layer.geojson';
    var baseName = sourceName.replace(/\.[^/.]+$/, '') || 'layer';
    var txtRelativePath = sourceFile.replace(/\.[^/.]+$/, '') + '.txt';
    var geojsonFilename = baseName + '.geojson';
    var txtFilename = baseName + '.txt';
    var zipFilename = getLayerZipFileName(info.name);

    setDownloadButtonBusy(buttonEl, true);
    return Promise.all([
      loadLayerData(sourceFile),
      loadLayerInfo(txtRelativePath)
    ]).then(function(results){
      var data = results[0];
      var infoText = results[1];
      var zip = new JSZip();
      zip.file(geojsonFilename, JSON.stringify(data, null, 2));
      zip.file(txtFilename, infoText || '');
      return zip.generateAsync({ type: 'blob' });
    }).then(function(blob){
      if(typeof saveAs === 'function'){
        saveAs(blob, zipFilename);
      } else {
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = zipFilename;
        a.click();
        setTimeout(function(){ URL.revokeObjectURL(url); }, 1500);
      }
      trackLayerDownload({
        name: info.name,
        file: zipFilename,
        sourceFile: info.file
      }, categoryName, subcategoryName);
    }).catch(function(err){
      console.error('Failed to create zip for layer "' + (info.name || sourceFile) + '":', err);
      alert('Could not create the zip file for "' + (info.name || sourceFile) + '". Please try again.');
    }).then(function(){
      setDownloadButtonBusy(buttonEl, false);
    });
  }

  function trackLayerDownload(info, categoryName, subcategoryName){
    if(!info || !window.posthog || typeof window.posthog.capture !== 'function') return;
    var props = {
      layer_name: info.name,
      layer_file: info.file || getLayerZipFileName(info.name),
      download_type: 'zip'
    };
    if(info.sourceFile) props.source_layer_file = info.sourceFile;
    if(categoryName) props.category = categoryName;
    if(subcategoryName) props.subcategory = subcategoryName;
    try{ window.posthog.capture('layer_download', props); }catch(e){}
  }

  function createLayerRow(info, parentEl, categoryContent, countSpan, arrowEl, subcategoryContent, categoryName, subcategoryName){
    if(!info || !parentEl || !categoryContent) return;
    var id=info.name.replace(/\s+/g,'_');
    var hasLegend = !!((window.legendConfigs||{})[info.name]);
    var row=document.createElement('div'); row.className='layer-item';
    var cb=document.createElement('input'); cb.type='checkbox'; cb.id=id; cb.dataset.layername=info.name; if(info.file) cb.dataset.filename=info.file;
    var label=document.createElement('label'); label.htmlFor=id; label.textContent=info.name;
    var actions = null;
    var dl = null;
    if(info.name!=='Relief'){
      dl=document.createElement('a'); dl.href='#'; dl.innerHTML='DOWNLOAD'; dl.className='download-button'; dl.style.display='none'; dl.title='Download the selected layer as ZIP';
      dl.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        downloadLayerAsZip(info, categoryName, subcategoryName, dl);
      });
    }
    var colorBtn = null;
    var colorPanel = null;
    if(!hasLegend){
      getLayerColorState(info.name);
      colorBtn = document.createElement('button');
      colorBtn.type = 'button';
      colorBtn.className = 'color-button';
      colorBtn.textContent = 'COLOR';
      colorBtn.title = 'Choose layer color';
      colorPanel = document.createElement('div');
      colorPanel.className = 'layer-color-panel';
      var defaultBtn = document.createElement('button');
      defaultBtn.type = 'button';
      defaultBtn.className = 'layer-color-default';
      defaultBtn.textContent = 'DEFAULT';
      defaultBtn.title = 'Reset layer color to default';
      defaultBtn.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        resetLayerRowColorSelection(info.name, info.file, colorBtn, colorPanel);
      });
      colorPanel.appendChild(defaultBtn);
      LAYER_COLOR_SWATCHES.forEach(function(swatchDef){
        var hex = swatchDef && swatchDef.hex ? swatchDef.hex : String(swatchDef || '');
        var colorName = (swatchDef && swatchDef.name) ? swatchDef.name : hex;
        var swatch = document.createElement('button');
        swatch.type = 'button';
        swatch.className = 'layer-color-swatch';
        swatch.title = colorName + ' (' + hex + ')';
        swatch.setAttribute('aria-label', 'Set layer color ' + colorName);
        swatch.dataset.color = hex;
        swatch.style.backgroundColor = hex;
        swatch.addEventListener('click', function(e){
          e.preventDefault();
          e.stopPropagation();
          applyLayerRowColorSelection(info.name, info.file, hex, colorBtn, colorPanel);
        });
        colorPanel.appendChild(swatch);
      });
      colorBtn.addEventListener('click', function(e){
        e.preventDefault();
        e.stopPropagation();
        var willOpen = !colorPanel.classList.contains('open');
        closeOpenColorPanels(willOpen ? colorPanel : null);
        colorPanel.classList.toggle('open', willOpen);
      });
      colorPanel.addEventListener('click', function(e){ e.stopPropagation(); });
      updateColorButtonPreview(colorBtn, info.name);
    }
    if(dl || colorBtn){
      actions = document.createElement('div');
      actions.className = 'layer-item-actions';
      if(dl) actions.appendChild(dl);
      if(colorBtn) actions.appendChild(colorBtn);
    }
    row.appendChild(cb);
    row.appendChild(label);
    if(actions) row.appendChild(actions);
    if(colorPanel) row.appendChild(colorPanel);
    parentEl.appendChild(row);
    // Tag original parents for flat-search restore and counting
    row.dataset.parentId = parentEl.id;
    row.dataset.categoryId = categoryContent.id;
    if(subcategoryContent && subcategoryContent.id){
      row.dataset.subcategoryId = subcategoryContent.id;
    }
    if(categoryName) row.dataset.categoryName = categoryName;
    if(subcategoryName) row.dataset.subcategoryName = subcategoryName;
    cb.addEventListener('change', function(){
      var layerName=this.dataset.layername; var file=this.dataset.filename; var dEl=this.parentElement.querySelector('.download-button');
      if(this.checked){
        // Visually mark row as selected so .layer-item.selected CSS applies
        row.classList.add('selected');
        if(dEl) dEl.style.display='inline-block';
        if(colorBtn) updateColorButtonPreview(colorBtn, layerName);
        var stopRowSpinner = startLoadingSpinner(label);
        row._stopSpinner = stopRowSpinner;
        AthensGIS.activeLayerInfos[layerName]='<em>Loading info...</em>'; ensureInfoBoxUpdate();
        // Trigger legend update immediately (so user sees legend without waiting for fetch)
        if(typeof window.updateLegendBar==='function' && (window.legendConfigs||{})[layerName]){
          window.updateLegendBar(layerName);
        }
        if(layerName==='Relief'){
          Promise.all(['relief1.json','relief2.json','relief3.json','relief4.json'].map(function(f){ return loadLayerData('Environment/'+f); })).then(function(parts){
            stopRowSpinner();
            var merged={type:'FeatureCollection',features:parts.flatMap(function(p){ return p.features||[]; })};
            var lc=(window.legendConfigs||{})[layerName];
            if(typeof window.updateLegendBar==='function') window.updateLegendBar(layerName);
            indexLayerData('Relief', merged);
            var viewportData = getViewportData('Relief', getMap().getBounds());
            var lyr=createLayerFromGeoJSON(viewportData, layerName, lc);
            AthensGIS.geojsonLayers['Relief']=lyr;
            AthensGIS._viewportLayers = AthensGIS._viewportLayers || {};
            AthensGIS._viewportLayers['Relief'] = lyr;
            setupViewportUpdateHandler();
          }).catch(function(err){ stopRowSpinner(); console.error('Failed to load Relief layer data:', err); AthensGIS.activeLayerInfos[layerName]='<em>Could not load layer data.</em>'; ensureInfoBoxUpdate(); });
          loadLayerInfo('Environment/Relief.txt').then(function(t){ AthensGIS.activeLayerInfos[layerName]=t; ensureInfoBoxUpdate(); }).catch(function(){ AthensGIS.activeLayerInfos[layerName]='<em>No extra info available for this layer.</em>'; ensureInfoBoxUpdate(); });
        } else if(file){
          loadLayerData(file).then(function(data){
            stopRowSpinner();
            var lc2=(window.legendConfigs||{})[layerName];
            if(typeof window.updateLegendBar==='function') window.updateLegendBar(layerName);
            indexLayerData(file, data);
            var viewportData2 = getViewportData(file, getMap().getBounds());
            var lyr2=createLayerFromGeoJSON(viewportData2, layerName, lc2);
            AthensGIS.geojsonLayers[file]=lyr2;
            AthensGIS._viewportLayers = AthensGIS._viewportLayers || {};
            AthensGIS._viewportLayers[file] = lyr2;
            setupViewportUpdateHandler();
          }).catch(function(err){ stopRowSpinner(); console.error('Failed to load layer data for "' + layerName + '":', err); AthensGIS.activeLayerInfos[layerName]='<em>Could not load layer data.</em>'; ensureInfoBoxUpdate(); });
          var txt=file.replace(/\.[^/.]+$/, '')+'.txt'; loadLayerInfo(txt).then(function(t){ AthensGIS.activeLayerInfos[layerName]=t; ensureInfoBoxUpdate(); }).catch(function(){ AthensGIS.activeLayerInfos[layerName]='<em>No extra info available for this layer.</em>'; ensureInfoBoxUpdate(); });
        }
        if(AthensGIS.activeLayerOrder.indexOf(layerName)===-1) AthensGIS.activeLayerOrder.push(layerName);
        AthensGIS.layerKeyByName[layerName]=(layerName==='Relief') ? 'Relief' : (file||layerName);
        if(typeof AthensGIS.refreshOpacityPopup==='function') AthensGIS.refreshOpacityPopup();
      } else {
        if(typeof row._stopSpinner==='function'){ row._stopSpinner(); row._stopSpinner=null; }
        resetFeatureHighlight();
        // Remove selected visual style
        row.classList.remove('selected');
        if(dEl) dEl.style.display='none';
        if(colorPanel) colorPanel.classList.remove('open');
        if(layerName==='Relief'){
          if(AthensGIS.geojsonLayers['Relief']){ getMap().removeLayer(AthensGIS.geojsonLayers['Relief']); delete AthensGIS.geojsonLayers['Relief']; }
          if(AthensGIS._viewportLayers) delete AthensGIS._viewportLayers['Relief'];
        } else if(file && AthensGIS.geojsonLayers[file]){
          getMap().removeLayer(AthensGIS.geojsonLayers[file]); delete AthensGIS.geojsonLayers[file];
          if(AthensGIS._viewportLayers) delete AthensGIS._viewportLayers[file];
        }
        delete AthensGIS.activeLayerInfos[layerName]; ensureInfoBoxUpdate(); if(!_infoBox) _infoBox = document.getElementById('infoBox'); if(_infoBox) _infoBox.style.display='none';
        // Update legend to remove this layer's entry (after state updated)
        if(typeof window.updateLegendBar==='function') window.updateLegendBar(layerName,'remove');
        var idx2=(AthensGIS.activeLayerOrder||[]).indexOf(layerName); if(idx2!==-1) AthensGIS.activeLayerOrder.splice(idx2,1);
        delete AthensGIS.layerKeyByName[layerName];
        if(typeof AthensGIS.refreshOpacityPopup==='function') AthensGIS.refreshOpacityPopup();
      }
      // Update category header count badge: show number of active layers in this category
      try{
        var catCount = countCheckedByDataset('categoryId', categoryContent.id);
        updateCountBadge(countSpan, catCount, arrowEl);
      }catch(e){}
    });
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
    header.style.background = 'rgba(255, 255, 255, 1)';
    header.style.borderRadius = '10px';
    header.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.18)';
    

  var title = document.createElement('h4');
    title.textContent = cat;
    // Balanced margins so vertical centering of the arrow looks correct
    title.style.fontWeight = '500';
    title.style.margin = '2px 0';

    var arrow = document.createElement('span');
    arrow.className = 'category-arrow';
    arrow.setAttribute('aria-hidden','true');
  // Use a down arrow by default; rotate to point up when expanded
  arrow.textContent = '❮';
  // The arrow should sit to the right of the count badge; badge will push it to the far right
  arrow.style.marginLeft = 'auto';
  arrow.style.paddingRight = '16px';
  arrow.style.transition = 'transform 0.2s ease';
  // Rotate around the right-center so the arrow hinges from the right edge
  arrow.style.transformOrigin = '20% 55%'; // vertical-horizontal tweak
  arrow.style.fontSize = '1.2em';
  // Ensure vertical centering relative to header height
  arrow.style.rotate = '-90deg';
  arrow.style.display = 'inline-flex';
  arrow.style.alignItems = 'top';


    header.appendChild(title);
    // Active layers count badge (appears when any checkbox in the category is checked)
    var countSpan = document.createElement('span');
    countSpan.className = 'category-count';
    // Keep the arrow at the far right; place the count slightly left of the arrow
    countSpan.style.marginLeft = 'auto';
    countSpan.style.display = 'none';
    countSpan.style.minWidth = '7px';
    countSpan.style.padding = '3px 8px 2px 9px';
    countSpan.style.borderRadius = '9999px';
    countSpan.style.border = 'none';
    countSpan.style.fontSize = '11px';
    countSpan.style.fontWeight = '500';
    countSpan.style.color = 'white';
    countSpan.style.background = 'rgba(55, 65, 81, 0.85)';
    countSpan.style.textAlign = 'center';
    countSpan.style.lineHeight = '19px';
    countSpan.setAttribute('aria-hidden','true');
    header.appendChild(countSpan);
    header.appendChild(arrow);

    // Content container (collapsed by default)
    var content = document.createElement('div');
    content.className = 'category-content';
    // Start collapsed: hidden, with smooth transition on expand/collapse
    content.style.display = 'none';
    content.style.overflow = 'hidden';
    content.style.maxHeight = '0';
    content.style.opacity = '0';
    content.style.transition = 'max-height 0.3s ease, opacity 0.2s ease';
    // Accessibility wiring
    var contentId = 'cat-content-' + slugify(cat);
    content.id = contentId;
    header.setAttribute('aria-controls', contentId);
    header.setAttribute('aria-expanded', 'false');

    var catData = layerCategories[cat];
    var rootItems = getCategoryItems(catData);
    if(rootItems.length){
      rootItems.forEach(function(info){
        createLayerRow(info, content, content, countSpan, arrow, null, cat, null);
      });
    }

    var subcategories = normalizeSubcategories(catData);
    Object.keys(subcategories).forEach(function(subcat){
      // Subcategory wrapper
      var subSection = document.createElement('div');
      subSection.className = 'subcategory-section';

      // Subcategory header
      var subHeader = document.createElement('div');
      subHeader.className = 'subcategory-header';
      subHeader.tabIndex = 0;
      subHeader.setAttribute('role','button');
      subHeader.style.display = 'flex';
      subHeader.style.alignItems = 'center';
      subHeader.style.width = '95%';
      subHeader.style.height = '26px';
      subHeader.style.gap = '8px';
      subHeader.style.marginTop = '6px';
      subHeader.style.marginBottom = '8px';
      subHeader.style.marginLeft = '2px';  
      subHeader.style.paddingLeft = '10px';
      subHeader.style.cursor = 'pointer';
      subHeader.style.border = '0px solid rgba(204, 204, 204, 0.4)';
      subHeader.style.background = 'rgba(255, 255, 255, 1)';
      subHeader.style.borderRadius = '10px';
      subHeader.style.boxShadow = '0 1px 4px rgba(0, 0, 0, 0.1)';
      

      var subTitle = document.createElement('h5');
      subTitle.textContent = subcat;
      subTitle.style.fontSize = '13px';
      subTitle.style.fontWeight = '400';
      subTitle.style.fontStyle = 'italic';
      subTitle.style.letterSpacing = '0.5px';
      subTitle.style.margin = '2px 0';

      var subArrow = document.createElement('span');
      subArrow.className = 'subcategory-arrow';
      subArrow.setAttribute('aria-hidden','true');
      subArrow.textContent = arrow.textContent;
      subArrow.style.marginLeft = 'auto';
      subArrow.style.paddingRight = '12px';
      subArrow.style.transition = 'transform 0.2s ease';
      subArrow.style.transformOrigin = '20% 55%';
      subArrow.style.fontSize = '1.05em';
      subArrow.style.rotate = '-90deg';
      subArrow.style.display = 'inline-flex';
      subArrow.style.alignItems = 'top';

      subHeader.appendChild(subTitle);
      subHeader.appendChild(subArrow);

      // Subcategory content (collapsed by default)
      var subContent = document.createElement('div');
      subContent.className = 'subcategory-content';
      subContent.style.display = 'none';
      subContent.style.overflow = 'hidden';
      subContent.style.maxHeight = '0';
      subContent.style.opacity = '0';
      subContent.style.transition = 'max-height 0.3s ease, opacity 0.2s ease';
      var subContentId = 'subcat-content-' + slugify(cat) + '-' + slugify(subcat);
      subContent.id = subContentId;
      subHeader.setAttribute('aria-controls', subContentId);
      subHeader.setAttribute('aria-expanded', 'false');

      // Build rows into subcategory content
      (subcategories[subcat] || []).forEach(function(info){
        createLayerRow(info, subContent, content, countSpan, arrow, subContent, cat, subcat);
      });

      function setSubOpen(open){
        if(open){
          subContent.style.display = 'block';
          void subContent.offsetHeight;
          subContent.style.maxHeight = subContent.scrollHeight + '1px';
          subContent.style.opacity = '1';
          subHeader.classList.add('open');
          subArrow.style.transform = 'rotate(180deg)';
          subHeader.setAttribute('aria-expanded','true');
          subContent.setAttribute('aria-hidden','false');
          var onSubExpandEnd = function(e){
            if(e.propertyName === 'max-height'){
              subContent.style.maxHeight = 'none';
              subContent.removeEventListener('transitionend', onSubExpandEnd);
            }
          };
          subContent.addEventListener('transitionend', onSubExpandEnd);
        } else {
          subContent.style.maxHeight = subContent.scrollHeight + 'px';
          subContent.style.opacity = '1';
          void subContent.offsetHeight;
          subContent.style.maxHeight = '0';
          subContent.style.opacity = '0';
          subHeader.classList.remove('open');
          subArrow.style.transform = 'rotate(0deg)';
          subHeader.setAttribute('aria-expanded','false');
          subContent.setAttribute('aria-hidden','true');
          var onSubEnd = function(e){
            if(e.propertyName === 'max-height'){
              subContent.style.display = 'none';
              subContent.removeEventListener('transitionend', onSubEnd);
            }
          };
          subContent.addEventListener('transitionend', onSubEnd);
        }
      }
      subHeader.addEventListener('click', function(){ setSubOpen(subContent.style.display==='none'); });
      subHeader.addEventListener('keydown', function(e){ if(e.key==='Enter' || e.key===' '){ e.preventDefault(); setSubOpen(subContent.style.display==='none'); } });

      subSection.appendChild(subHeader);
      subSection.appendChild(subContent);
      content.appendChild(subSection);
    });

    // Toggle logic
    function setOpen(open){
      if(open){
        // Prepare for animation from collapsed to expanded
        content.style.display = 'block';
        // Force a reflow so the next changes transition
        void content.offsetHeight;
        content.style.maxHeight = content.scrollHeight + '1px';
        content.style.opacity = '1';
        header.classList.add('open');
        // Rotate to point up smoothly
        arrow.style.transform = 'rotate(180deg)';
        header.setAttribute('aria-expanded','true');
        content.setAttribute('aria-hidden','false');
        var onExpandEnd = function(e){
          if(e.propertyName === 'max-height'){
            content.style.maxHeight = 'none';
            content.removeEventListener('transitionend', onExpandEnd);
          }
        };
        content.addEventListener('transitionend', onExpandEnd);
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
