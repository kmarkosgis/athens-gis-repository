// === Layer Control Module (Single Clean Implementation) ===
// Purpose: Render layer categories, handle loading/removal, info & legend updates, Terrain layer, search & zoom.

// 1. Category definitions
// Layers whose source file is at or above the tiling threshold (~1MB) render from a
// pre-tiled `.pmtiles` archive instead of the full `.geojson`/`.json` (see
// tools/build-pmtiles.mjs); `file` below is the render source for those and
// `geojson` is the original, kept only for the DOWNLOAD button (and, when present,
// AthensGIS.datasetManifest lookups) - see JS/pmtiles-loader.js and the toggle
// handler in createLayerRow() below. Layers under the threshold are unchanged: `file`
// is still the plain source, rendered exactly as before.
var layerCategories = {
  "Administrative Boundaries": {
    "_items": [
      { name: "Regions of Greece", file: "Boundaries/GrRegions.pmtiles", geojson: "Boundaries/GrRegions.geojson" }
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
      { name: "Soil Groups", file: "Geo/SoilGroups.pmtiles", geojson: "Geo/SoilGroups.geojson" }
    ],
    "Hydrology": [
      { name: "Rivers and Streams", file: "Environment/Rivers.pmtiles", geojson: "Environment/Rivers.geojson" },
    ],
    "Protection Zones": [
      { name: "Natura 2000 sites", file: "Environment/Natura.pmtiles", geojson: "Environment/Natura.geojson" },
    ],
    "Vegetation": [ 
      { name: "Vegetation Index (Center Sector)", file: "Environment/AthensGreenCenter.pmtiles", geojson: "Environment/AthensGreenCenter.geojson" },
      { name: "Vegetation Index (North Sector)", file: "Environment/AthensGreenNorth.pmtiles", geojson: "Environment/AthensGreenNorth.geojson" },
      { name: "Vegetation Index (South Sector)", file: "Environment/AthensGreenSouth.pmtiles", geojson: "Environment/AthensGreenSouth.geojson" },
      { name: "Vegetation Index (West Sector)", file: "Environment/AthensGreenWest.pmtiles", geojson: "Environment/AthensGreenWest.geojson" },
      { name: "Vegetation Index (Piraeus)", file: "Environment/PiraeusGreen.pmtiles", geojson: "Environment/PiraeusGreen.geojson" }
    ]
  },
  "Natural Hazards": {
    "Wildfires": [
      { name: "Wildfires Attica 2015-2025", file: "Disasters/WildfiresAttica2015-2025.pmtiles", geojson: "Disasters/WildfiresAttica2015-2025.geojson" },
    ],
      "Earthquakes": [
        { name: "Earthquakes Attica 2006-2026", file: "Disasters/EarthquakesAttica2006-2026.json" },
        { name: "Seismic Hazard Zones", file: "Disasters/Seismiczones.json" }
      ],
      "Floods": [
        { name: "Flood Risk Zones 50T", file: "Disasters/Floods50T.pmtiles", geojson: "Disasters/Floods50T.geojson" },
        { name: "Flood Risk Zones 100T", file: "Disasters/Floods100T.pmtiles", geojson: "Disasters/Floods100T.geojson" },
        { name: "Flood Risk Zones 1000T", file: "Disasters/Floods1000T.pmtiles", geojson: "Disasters/Floods1000T.geojson" }
      ]
  },
  "Points of Interest": {
    "City Services": [
      { name: "Banks", file: "Amenities/Banks.geojson" },
      { name: "Police Stations", file: "Amenities/Police.geojson" },
    ],
    "Commerce": [
      { name : "Charging Stations", file: "Amenities/charging_stations.geojson" },
      { name: "Food Shops", file: "Amenities/foodshops.geojson" },
      { name: "Fuel Stations", file: "Amenities/Fuel.geojson" },
      { name: "Supermarkets", file: "Amenities/markets.geojson" }
    ],
    "Education": [
      { name: "Schools", file: "Amenities/Schools.pmtiles", geojson: "Amenities/Schools.geojson" },
      { name: "Universities", file: "Amenities/Universities.geojson" }
    ],
    "Entertainment and Leisure": [
      { name: "Cinemas", file: "Amenities/Cinemas.json" },
      { name: "Theaters", file: "Amenities/Theater.json" },
      { name: "Restaurants, Bars, and Cafe", file: "Amenities/RestBarCafe.pmtiles", geojson: "Amenities/RestBarCafe.json" }
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
  "Urban Planning and Land Cover": {
    "KAEK": [
      { name: "KAEK Central Sector", file: "UrbanPlanning/KAEKcenter.pmtiles", geojson: "UrbanPlanning/KAEKcenter.geojson" },
      { name: "KAEK North Sector", file: "UrbanPlanning/KAEKnorth.pmtiles", geojson: "UrbanPlanning/KAEKnorth.geojson" },
      { name: "KAEK South Sector", file: "UrbanPlanning/KAEKsouth.pmtiles", geojson: "UrbanPlanning/KAEKsouth.geojson" },
      { name: "KAEK West Sector", file: "UrbanPlanning/KAEKwest.pmtiles", geojson: "UrbanPlanning/KAEKwest.geojson" },
      { name: "KAEK Piraeus", file: "UrbanPlanning/KAEKpiraeus.pmtiles", geojson: "UrbanPlanning/KAEKpiraeus.geojson" }
    ],
    "Land Cover": [
      { name: "Buildings height (2021)", file: "UrbanPlanning/Building_height.tif", type: "raster" },
      { name: "Land Cover and Land Use (2021)", file: "UrbanPlanning/Land_Cover_2021.pmtiles", geojson: "UrbanPlanning/Land_Cover_2021.json" },
      { name: "Land Cover and Land Use (2018)", file: "UrbanPlanning/AthensCorine2018.pmtiles", geojson: "UrbanPlanning/AthensCorine2018.json" },
      { name: "Municipality of Athens Urban Plan (2012)", file: "UrbanPlanning/Athens Urban Plan 2012.pmtiles", geojson: "UrbanPlanning/Athens Urban Plan 2012.geojson" },
      { name: "Tree Cover Density (2024)", file: "UrbanPlanning/tree_density.tif", type: "raster" }
    ],
    "Public Spaces": [
      { name: "Archaeological Sites", file: "UrbanPlanning/Arch_sites.geojson" },
      { name: "Gardens", file: "UrbanPlanning/Gardens.geojson" },
      { name: "Parks", file: "UrbanPlanning/Parks.pmtiles", geojson: "UrbanPlanning/Parks.geojson" },
      { name: "Playgrounds", file: "UrbanPlanning/Playgrounds.geojson" }
    ]

  },
  "Transportation Systems": {
    "Road Network": [
      { name: "Avenues", file: "Transportation/AthensAvenues.pmtiles", geojson: "Transportation/AthensAvenues.json" },
      { name: "Highways (Greece)", file: "Transportation/GreeceHighways.pmtiles", geojson: "Transportation/GreeceHighways.geojson" },
      { name: "Street Network Central Sector", file: "Transportation/Streets_Center.pmtiles", geojson: "Transportation/Streets_Center.geojson" },
      { name: "Street Network North Sector", file: "Transportation/Streets_North.pmtiles", geojson: "Transportation/Streets_North.geojson" },
      { name: "Street Network South Sector", file: "Transportation/Streets_South.pmtiles", geojson: "Transportation/Streets_South.geojson" },
      { name: "Street Network West Sector", file: "Transportation/Streets_West.pmtiles", geojson: "Transportation/Streets_West.geojson" },
      { name: "Street Network Piraeus", file: "Transportation/Streets_Piraeus.pmtiles", geojson: "Transportation/Streets_Piraeus.geojson" }
    ],
    "Road Transport": [
      { name: "AI Traffic Cameras", file: "Transportation/AICameras.json" },
      { name: "OASA Bus Lanes", file: "Transportation/Bus_Lanes.geojson" },
      { name: "OASA Bus Routes", file: "Transportation/bus_lines.pmtiles", geojson: "Transportation/bus_lines.geojson" },
      { name: "OASA Bus Stops", file: "Transportation/AthensBusStops.pmtiles", geojson: "Transportation/AthensBusStops.geojson" },
      { name: "Toll Stations", file: "Transportation/TollStations.geojson" },
      { name: "Traffic Accidents 2023-2025", file: "Transportation/TrAccidents.pmtiles", geojson: "Transportation/TrAccidents.json" },
      { name: "Traffic Lights", file: "Transportation/TrLights.geojson" }
    ],
    "Rail Transport": [
      { name: "Metro Stations of Lines 1, 2 and 3", file: "Transportation/AthensMetro123.geojson" },
      { name: "Metro Stations of Line 4", file: "Transportation/AthensMetro4.geojson" },
      { name: "Metro Lines 1, 2 and 3", file: "Transportation/AthensMetroNet.geojson" },
      { name: "Extended Metro Lines network", file: "Transportation/AthensMetroExtended.json" },
      { name: "Metro Boarding Platforms of Line 1", file: "Transportation/MetroPlatforms.geojson" },
      { name: "Railway Network (Greece)", file: "Transportation/GreeceRail.pmtiles", geojson: "Transportation/GreeceRail.geojson" },
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
AthensGIS.rasterLayers = AthensGIS.rasterLayers || {};
AthensGIS.activeLayerInfos = AthensGIS.activeLayerInfos || {};
AthensGIS.selectedFeature = null;
AthensGIS.layerOpacities  = AthensGIS.layerOpacities  || {};
AthensGIS.activeLayerOrder = AthensGIS.activeLayerOrder || [];
AthensGIS.layerKeyByName   = AthensGIS.layerKeyByName   || {};
AthensGIS.customLayerColors = AthensGIS.customLayerColors || {};
const GITHUB_SITE_ROOT_URL = 'https://athensgis.gr/';
const FIXED_ASSET_ROOTS = { data: 'data', info: 'info' };

// Precomputed per-dataset metadata (fields/attributeValues/featureCount/bbox, plus
// filterOptions for the two JS/layer-filter.js datasets) built offline by
// tools/build-pmtiles.mjs, keyed by the dataset's original geojson/json path. Loaded
// once at startup; JS/dataset-search.js and JS/layer-filter.js read it directly
// rather than waiting on/scanning a full in-memory feature cache. A missing manifest
// (not yet generated) degrades gracefully - consumers fall back to their older
// per-layer-load behavior, see each file's fallback path.
AthensGIS.datasetManifest = AthensGIS.datasetManifest || {};
AthensGIS.datasetManifestReady = fetchAssetWithFallback('data', 'dataset-manifest.json', function(resp){ return resp.json(); })
  .then(function(manifest){ AthensGIS.datasetManifest = manifest || {}; return AthensGIS.datasetManifest; })
  .catch(function(){ return AthensGIS.datasetManifest; });

function isPmtilesFile(file){
  return typeof file === 'string' && /\.pmtiles$/i.test(file);
}

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
  if(host === 'athensgis.gr'){
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

function fetchAssetWithFallback(kind, relativePath, parser, signal){
  var bases = getAssetBaseCandidates(kind);
  var attempts = [];
  function tryBase(index){
    if(index >= bases.length){
      return Promise.reject(new Error('Failed to load "' + relativePath + '" from ' + attempts.join(' | ')));
    }
    var url = buildAssetUrl(kind, relativePath, bases[index]);
    var opts = signal ? { signal: signal } : undefined;
    return fetch(url, opts).then(function(resp){
      if(!resp.ok){
        throw new Error(resp.status + ' ' + resp.statusText + ' @ ' + url);
      }
      return parser(resp);
    }).catch(function(err){
      if(err && err.name === 'AbortError') return Promise.reject(err);
      attempts.push((err && err.message) ? err.message : String(err));
      return tryBase(index + 1);
    });
  }
  return tryBase(0);
}

function loadLayerData(relativePath, signal){
  return fetchAssetWithFallback('data', relativePath, function(resp){ return resp.json(); }, signal);
}

function loadLayerInfo(relativePath, signal){
  return fetchAssetWithFallback('info', relativePath, function(resp){ return resp.text(); }, signal);
}

function loadRasterArrayBuffer(relativePath, signal){
  return fetchAssetWithFallback('data', relativePath, function(resp){ return resp.arrayBuffer(); }, signal);
}

function loadRasterData(relativePath, signal){
  return loadRasterArrayBuffer(relativePath, signal).then(function(arrayBuffer){
    return parseGeoraster(arrayBuffer);
  });
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

// Full (non-viewport-clipped) extent of a cached layer, reusing the per-feature
// bboxes indexLayerData() already computed. The rendered Leaflet layer for a
// vector dataset only ever contains the CURRENT viewport's slice of
// features (see getViewportData above), so its own .getBounds() would only
// cover what's presently visible, not the whole dataset - this is what
// "zoom to extent" (zoomSelectedBtn) needs instead.
function boundsForCachedLayer(cacheKey){
  var cache = AthensGIS._layerCache && AthensGIS._layerCache[cacheKey];
  if(cache && cache.bboxes && cache.bboxes.length){
    var minLng=Infinity, minLat=Infinity, maxLng=-Infinity, maxLat=-Infinity;
    cache.bboxes.forEach(function(b){
      if(b[0]<minLng) minLng=b[0]; if(b[2]>maxLng) maxLng=b[2];
      if(b[1]<minLat) minLat=b[1]; if(b[3]>maxLat) maxLat=b[3];
    });
    if(isFinite(minLng)&&isFinite(minLat)&&isFinite(maxLng)&&isFinite(maxLat)){
      return L.latLngBounds([[minLat,minLng],[maxLat,maxLng]]);
    }
  }
  // pmtiles-backed layers never populate _layerCache (they render tile-decoded
  // viewport slices, not a full in-memory dataset) - fall back to the build-time
  // manifest's precomputed bbox instead (AthensGIS.pmtilesDownloadSource maps the
  // .pmtiles cacheKey back to its manifest key; set in createLayerRow() below).
  var geojsonKey = AthensGIS.pmtilesDownloadSource && AthensGIS.pmtilesDownloadSource[cacheKey];
  var manifestEntry = geojsonKey && AthensGIS.datasetManifest && AthensGIS.datasetManifest[geojsonKey];
  var bb = manifestEntry && manifestEntry.bbox;
  if(Array.isArray(bb) && bb.length === 4 && bb.every(isFinite)){
    return L.latLngBounds([[bb[1],bb[0]],[bb[3],bb[2]]]);
  }
  return null;
}

// Async wrapper around boundsForCachedLayer() for "zoom to extent"
// (zoomSelectedBtn): a pmtiles-backed layer only has a bbox to report there once
// data/dataset-manifest.json has actually been generated and uploaded (see
// tools/build-pmtiles.mjs) - until then, boundsForCachedLayer() returns null for it
// and this falls back to reading the .pmtiles archive's OWN header bounds directly
// (a few bytes, no full download, no manifest dependency - works the moment the
// archive itself is uploaded). Only reached for a layer neither path covers; a
// raster layer (no cache, no manifest entry, not pmtiles) falls through to its own
// live getBounds() same as before.
function resolveExtentBounds(cacheKey){
  var sync = boundsForCachedLayer(cacheKey);
  if(sync) return Promise.resolve(sync);

  if(isPmtilesFile(cacheKey) && AthensGIS.pmtiles && typeof AthensGIS.pmtiles.getHeaderBounds === 'function'){
    var url = buildAssetUrl('data', cacheKey);
    return AthensGIS.pmtiles.getHeaderBounds(url).then(function(bb){
      if(!Array.isArray(bb) || bb.length !== 4 || !bb.every(isFinite)) return null;
      return L.latLngBounds([[bb[1],bb[0]],[bb[3],bb[2]]]);
    }).catch(function(){ return null; });
  }

  var lyr = AthensGIS.geojsonLayers[cacheKey];
  if(lyr && typeof lyr.getBounds === 'function'){
    try{
      var b = lyr.getBounds();
      return Promise.resolve((b && b.isValid()) ? b : null);
    }catch(e){ return Promise.resolve(null); }
  }
  return Promise.resolve(null);
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
    else if(['shapeleng_m','shapelengm','length','shape_leng','distance_meters'].includes(k)){ v=Number(v).toFixed(2); d='Shape Length (m)'; }
    else if(['shapearea_m','shapeaream'].includes(k)){ v=Number(v).toFixed(2); d='Shape Area (m²)'; }
    else if(['name','name_el','name_place','gname','uses_gr','descr'].includes(k)){ d='Name (GR)'; }
    else if(['ename','name_pl_en','name_en','uses_en','name:en','class_2021','descr_eng'].includes(k)){ d='Name (ENG)'; }
    else if(k==='address') d='Address';
    else if(k==='bridge') d='Bridge';
    else if(k==='tunnel') d='Tunnel';
    else if(k==='ref'|| k==='line_id') d='Route';
    else if(k==='operator') d='Operator';
    else if(k==='owner') d='Owner';
    else if(k==='charge') d='Toll Charge';
    else if(k==='int_ref') d='International Route';
    else if(k==='geitonia' || k==='city') d='Neighborhood (GR)';
    else if(k==='geiton_en') d='Neighborhood (ENG)';
    else if(k==='dk'|| k==='attica_municipal_unit') d='Municipal Community (GR)';
    else if(k==='dk_en') d='Municipal Community (ENG)';
    else if(k==='sectionnam'|| k==='attica_section') d='Section Name';
    else if(k==='postal_code') d='Postal Code';
    else if(k==='country') d='Country';
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
    else if(k==='evse_count') d='EVSE Count';
    else if(k==='connector_count') d='Connector Count';
    else if(k==='max_power_kw') d='Max Power (KW)';
    else if(k==='initialdat') d='Initial Date';
    else if(k==='finaldate') d='Final Date';
    else if(k==='stop_id') d='Stop ID';
    else if(k==='route_ref') d='Bus Route';
    else if(k==='rwb_id') d='River/Stream ID';
    else if(k==='basinid_fd') d='Basin ID';
    else if(k==='mag') {v=Number(v).toFixed(1); d='Magnitude';}
    else if(k==='place') d='Place';
    else if(k==='amenity' || k==='shop') d='Type';
    else if(k==='leisure') d='Public space type';
    else if(k==='period') d='Return Period (years)';
    else if(k==='twentyfourseven') d='24/7 Access';
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
    // #map-scale-ratio (style.css) reads this to know whether to make room
    // for the (now hidden) layer info box or sit in its usual bottom-right spot.
    document.body.classList.remove('layer-info-open');
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
  document.body.classList.add('layer-info-open');

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
    if(l._path) l._path.style.pointerEvents = 'none';
  });
  // The glow goes on the whole highlight PANE, not on each path individually - a
  // multi-fragment feature (findSiblingFragments() above passes all its fragments
  // in as one FeatureCollection) needs ONE shadow around their combined silhouette.
  // A per-path filter would instead shadow every fragment's own edges separately,
  // including the seam where two adjacent fragments touch - visible as a hard
  // vertical crease with a shadow cast right down the middle of one shape.
  try{
    var pane = map.getPane('highlight-pane');
    if(pane){
      pane.style.transition = 'filter 0.15s ease';
      pane.style.filter = 'drop-shadow(0 6px 18px rgba(0,0,0,0.65)) drop-shadow(0 2px 5px rgba(0,0,0,0.5))';
    }
  }catch(e){}
}

// A pmtiles-backed polygon/line feature that spans multiple tiles renders as several
// separate fragments (see tools/build-pmtiles.mjs / JS/pmtiles-loader.js's tile-edge
// clipping) that all share the original feature's id but are otherwise ordinary,
// independent Leaflet layers - clicking just one would only highlight/select that
// one fragment, making a single feature look "cut in half". This finds every
// currently-rendered sibling fragment (same layer, same geometry tier, same id) so
// the click handler can highlight/select all of them together instead. Returns null
// when there's nothing to merge (no id, or only one fragment) - the plain
// single-feature path.
function findSiblingFragments(layerName, feature){
  if(!feature || feature.id == null) return null;
  var key = AthensGIS.layerKeyByName[layerName] || layerName;
  var group = AthensGIS.geojsonLayers[key];
  if(!group) return null;
  var gt = feature.geometry && feature.geometry.type;
  var sub = (gt==='Polygon' || gt==='MultiPolygon') ? (group._polyLayer || group)
    : (gt==='LineString' || gt==='MultiLineString') ? (group._lineLayer || group)
    : (group._vecLayer || group);
  if(!sub || typeof sub.eachLayer !== 'function') return null;
  var matches = [];
  sub.eachLayer(function(sl){
    if(sl && sl.feature && sl.feature.id === feature.id) matches.push(sl);
  });
  return matches.length > 1 ? matches : null;
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

// ── Raster (GeoTIFF) layer support ─────────────────────────────────────────────
function createRasterLayer(georaster, layerName, legendConfig){
  var map = getMap();
  if(!map || typeof GeoRasterLayer === 'undefined') return null;
  var opacity = (AthensGIS.layerOpacities && AthensGIS.layerOpacities[layerName] !== undefined) ? AthensGIS.layerOpacities[layerName] : 1;
  var hasNoData = georaster.noDataValue !== null && typeof georaster.noDataValue !== 'undefined';
  // Normally created by createLayerFromGeoJSON the first time a vector layer
  // loads - a raster opened before any vector layer needs it created here too.
  try{ if(!map.getPane('vector-bottom')){ map.createPane('vector-bottom'); map.getPane('vector-bottom').style.zIndex = 450; } }catch(e){}
  // Shares the polygon pane (rather than Leaflet's default tile pane) so
  // JS/draw-order.js can group and reorder rasters together with polygon
  // layers - see its explicit z-index handling for this pane, since a
  // GridLayer's own bringToFront()/bringToBack() doesn't actually compete
  // correctly against the polygon renderer's shared canvas.
  var layer = new GeoRasterLayer({
    georaster: georaster,
    opacity: opacity,
    resolution: 128,
    pane: 'vector-bottom',
    pixelValuesToColorFn: function(values){
      var v = values[0];
      if(v === null || typeof v === 'undefined') return null;
      if(hasNoData && v === georaster.noDataValue) return null;
      var cs = legendConfig ? getLegendClassForValue(legendConfig, v) : null;
      return (cs && cs.color) || DEFAULT_LAYER_FILL_COLOR;
    }
  });
  layer.addTo(map);
  return layer;
}

// Converts a map click (WGS84 lat/lng) into the raster's native pixel row/col and reads its value.
function getRasterPixelInfo(entry, latlng){
  var georaster = entry.georaster;
  var proj4fn = entry.layer && entry.layer.proj4;
  var projCode = 'EPSG:' + georaster.projection;
  var xy = (Number(georaster.projection) === 4326 || typeof proj4fn !== 'function')
    ? [latlng.lng, latlng.lat]
    : proj4fn('EPSG:4326', projCode, [latlng.lng, latlng.lat]);
  var x = xy[0], y = xy[1];
  if(x < georaster.xmin || x > georaster.xmax || y < georaster.ymin || y > georaster.ymax) return null;
  var col = Math.min(georaster.width - 1, Math.floor((x - georaster.xmin) / georaster.pixelWidth));
  var row = Math.min(georaster.height - 1, Math.floor((georaster.ymax - y) / georaster.pixelHeight));
  if(row < 0 || col < 0) return null;
  var value = georaster.values[0][row][col];
  var hasNoData = georaster.noDataValue !== null && typeof georaster.noDataValue !== 'undefined';
  if(hasNoData && value === georaster.noDataValue) return null;
  return { value: value, row: row, col: col, projCode: projCode, proj4fn: proj4fn };
}

// Builds a WGS84 polygon for the clicked pixel's footprint so it can reuse the standard highlight overlay.
function buildRasterCellFeature(georaster, row, col, projCode, proj4fn){
  var x0 = georaster.xmin + col * georaster.pixelWidth;
  var x1 = x0 + georaster.pixelWidth;
  var y1 = georaster.ymax - row * georaster.pixelHeight;
  var y0 = y1 - georaster.pixelHeight;
  var corners = [[x0,y0],[x1,y0],[x1,y1],[x0,y1],[x0,y0]];
  var isWgs84 = Number(georaster.projection) === 4326 || typeof proj4fn !== 'function';
  var ring = corners.map(function(c){ return isWgs84 ? c : proj4fn(projCode, 'EPSG:4326', c); });
  return { type:'Feature', properties:{}, geometry:{ type:'Polygon', coordinates:[ring] } };
}

function buildRasterPixelHTML(valueLabel, value){
  return '<table class="feature-properties-table"><tr><th>' + valueLabel + '</th><td>' + value + '</td></tr></table>';
}

// Called from the map's global click handler before it resets the info box/highlight.
// Returns true if the click landed on an active raster layer's pixel, in which case the
// caller should skip its own reset logic (mirrors how vector feature clicks stop propagation).
function handleRasterClickIfAny(e){
  var registry = AthensGIS.rasterLayers || {};
  var keys = Object.keys(registry);
  for(var i=0;i<keys.length;i++){
    var entry = registry[keys[i]];
    if(!entry || !entry.layer || !entry.georaster) continue;
    var pixel = getRasterPixelInfo(entry, e.latlng);
    if(!pixel) continue;
    resetFeatureHighlight();
    AthensGIS.selectedFeature = null;
    if(!_infoBox) _infoBox = document.getElementById('infoBox');
    if(!_infoContent) _infoContent = document.getElementById('infoContent');
    if(_infoContent) _infoContent.innerHTML = buildRasterPixelHTML(entry.valueLabel, pixel.value);
    if(_infoBox) _infoBox.style.display = 'block';
    var cellFeature = buildRasterCellFeature(entry.georaster, pixel.row, pixel.col, pixel.projCode, pixel.proj4fn);
    var classStyle = entry.legendConfig ? getLegendClassForValue(entry.legendConfig, pixel.value) : null;
    var color = (classStyle && classStyle.color) || DEFAULT_LAYER_BORDER_COLOR;
    applyHighlightOverlay(getMap(), cellFeature, { color: color, weight: 2, fillColor: color, opacity: 1, fillOpacity: 0.35 });
    AthensGIS._rasterClickActive = true;
    return true;
  }
  AthensGIS._rasterClickActive = false;
  return false;
}
// ── End raster layer support ───────────────────────────────────────────────────

// ── Point clustering ─────────────────────────────────────────────────────────────
// Grid-based clustering, applied as a plain pre-processing step on the point-feature
// bucket right before it's rendered (see createLayerFromGeoJSON below) - a cluster
// bubble is just another Point feature (flagged via properties.__cluster) flowing
// through the exact same L.geoJSON/pointToLayer/onEachFeature pipeline as any real
// point, so it needs no special handling from panes, draw-order, opacity, or the
// viewport-refresh machinery; those already treat the whole point bucket uniformly.
// Deliberately not Leaflet.markercluster: that plugin manages its own pane/DOM layer
// outside this app's shared per-tier canvas panes, which JS/draw-order.js's
// bringToFront()-based reordering and JS/utils.js's opacity refresh both depend on.
var CLUSTER_MIN_FEATURES = 60;   // below this, clustering isn't worth the visual indirection
var CLUSTER_CELL_PX = 70;        // grid cell size in screen pixels at the render zoom
var CLUSTER_MAX_SCALE_DENOM = 30000; // stop clustering at scales larger than 1:30000 - points read fine unclustered by then

// Same scale-denominator formula used elsewhere in this file (geojsonOptions' Terrain/
// Relief styling, shouldShowReliefLabels) and in JS/map-init.js's scale-ratio label -
// not extracted into a shared helper, just following the existing convention of
// recomputing it inline wherever it's needed.
function getMapScaleDenominator(map, zoom){
  var center = map.getCenter();
  var latRad = (center.lat || 0) * Math.PI / 180;
  var metersPerPixel = 156543.03392 * Math.cos(latRad) / Math.pow(2, zoom);
  return metersPerPixel * 96 * 39.3700787; // dpi * inches-per-meter
}

function clusterPointFeatures(features){
  if(!features || features.length < CLUSTER_MIN_FEATURES) return features;
  var map = getMap();
  if(!map) return features;
  var zoom = map.getZoom();
  if(!Number.isFinite(zoom)) return features;
  var scaleDenominator = getMapScaleDenominator(map, zoom);
  // A smaller denominator (e.g. 1:10000) is a LARGER scale (more zoomed in) than a
  // bigger one (e.g. 1:100000) - clustering should stop once the scale is larger
  // than 1:30000, i.e. once the denominator drops below 30000.
  if(scaleDenominator < CLUSTER_MAX_SCALE_DENOM) return features;

  var cells = Object.create(null);
  var order = [];
  var passthrough = []; // MultiPoint / malformed geometry - not grid-bucketed, rendered as-is
  features.forEach(function(f){
    // Only plain Point features are grid-bucketed by [lng,lat]; anything else
    // passes through unclustered.
    if(!f || !f.geometry || f.geometry.type !== 'Point'){ if(f) passthrough.push(f); return; }
    var coords = f.geometry.coordinates;
    var lng = coords && coords[0], lat = coords && coords[1];
    if(!Number.isFinite(lng) || !Number.isFinite(lat)) return;
    var px;
    try{ px = map.project(L.latLng(lat, lng), zoom); }catch(e){ return; }
    var key = Math.floor(px.x / CLUSTER_CELL_PX) + ':' + Math.floor(px.y / CLUSTER_CELL_PX);
    var cell = cells[key];
    if(!cell){
      cell = cells[key] = { count:0, sumLng:0, sumLat:0, minLng:Infinity, minLat:Infinity, maxLng:-Infinity, maxLat:-Infinity, feature:f };
      order.push(key);
    }
    cell.count++;
    cell.sumLng += lng; cell.sumLat += lat;
    if(lng < cell.minLng) cell.minLng = lng;
    if(lng > cell.maxLng) cell.maxLng = lng;
    if(lat < cell.minLat) cell.minLat = lat;
    if(lat > cell.maxLat) cell.maxLat = lat;
  });

  var out = passthrough;
  order.forEach(function(key){
    var cell = cells[key];
    if(cell.count === 1){ out.push(cell.feature); return; }
    out.push({
      type: 'Feature',
      properties: {
        __cluster: true,
        __clusterCount: cell.count,
        __clusterBBox: [cell.minLng, cell.minLat, cell.maxLng, cell.maxLat]
      },
      geometry: { type: 'Point', coordinates: [cell.sumLng / cell.count, cell.sumLat / cell.count] }
    });
  });
  return out;
}

function makeClusterMarker(feature, latlng){
  var count = feature.properties.__clusterCount || 0;
  var size = count < 10 ? 30 : (count < 100 ? 38 : 46);
  var fontSize = size <= 30 ? 12 : (size <= 38 ? 13 : 14);
  var html = '<div style="' +
    'width:' + size + 'px;height:' + size + 'px;line-height:' + size + 'px;' +
    'border-radius:50%;text-align:center;font-weight:600;font-size:' + fontSize + 'px;' +
    'color:#fff;background:rgba(55, 65, 81, 0.88);border:2px solid rgba(255,255,255,0.9);' +
    'box-shadow:0 2px 6px rgba(0,0,0,0.35);">' + count + '</div>';
  var icon = L.divIcon({ className: 'point-cluster-icon', html: html, iconSize: [size, size] });
  return L.marker(latlng, { icon: icon, pane: 'vector-top', interactive: true });
}
// ── End point clustering ────────────────────────────────────────────────────────

function geojsonOptions(layerName, legendConfig){
  return {
    style: function(feature){
      var baseWeight =1;
      var fillOpacity = (AthensGIS.layerOpacities && AthensGIS.layerOpacities[layerName] !== undefined) ? AthensGIS.layerOpacities[layerName] : 1;
      var layerColors = (!legendConfig) ? getLayerColorState(layerName) : null;
      // Special styling for Terrain: scale-aware contour visibility
      if(layerName==='Terrain'){
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
      if(feature.properties && feature.properties.__cluster){
        return makeClusterMarker(feature, latlng);
      }
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
      var isCluster = !!(feature.properties && feature.properties.__cluster);
      var html = (!isCluster && layerName !== 'Terrain') ? buildPropertyTable(feature) : null;
      layer.on('click', function(e){
        L.DomEvent.stopPropagation(e);
        // A cluster bubble isn't a real feature (see clusterPointFeatures()) - it
        // has no properties table or highlight state of its own, just zoom in on
        // the area it summarizes, same as clicking a cluster on any other map.
        if(isCluster){
          var bb = feature.properties.__clusterBBox;
          if(bb && getMap()){
            try{ getMap().fitBounds(L.latLngBounds([[bb[1],bb[0]],[bb[3],bb[2]]]).pad(0.3), { maxZoom: 18 }); }catch(err){}
          }
          return;
        }
        resetFeatureHighlight();
        AthensGIS.selectedFeature = e.target;
        var lc = (window.legendConfigs||{})[layerName];
        if(!lc && layerName==='Terrain') lc = (window.legendConfigs||{}).Terrain;
        var lyrHighlightOpacity = (AthensGIS.layerOpacities && AthensGIS.layerOpacities[layerName] !== undefined) ? AthensGIS.layerOpacities[layerName] : 1;
        var highlight = { weight: 2, opacity: lyrHighlightOpacity, fillOpacity: lyrHighlightOpacity };
        if(lc && feature.properties){
          var cv2 = (lc.field && lc.field in feature.properties) ? feature.properties[lc.field] : undefined;
          if((typeof cv2 === 'undefined' || cv2 === null || cv2 === '') && layerName==='Terrain'){
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
        // If this feature was split into multiple fragments by tile clipping, treat
        // every fragment sharing its id as one feature - see findSiblingFragments().
        var siblings = findSiblingFragments(layerName, feature);
        if(siblings){
          siblings.forEach(function(sl){
            try{ sl.setStyle(highlight); }catch(err){}
            try{ sl.bringToFront(); }catch(err){}
          });
        } else {
          e.target.setStyle(highlight);
          e.target.bringToFront();
        }
        if(layerName !== 'Terrain' && e.target.feature){
          if(e.target.options && Number.isFinite(e.target.options.radius)) highlight.radius = e.target.options.radius;
          var highlightInput = siblings
            ? { type:'FeatureCollection', features: siblings.map(function(sl){ return sl.feature; }) }
            : e.target.feature;
          applyHighlightOverlay(getMap(), highlightInput, highlight);
        }
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
  // Ensure panes exist. Three tiers give the default draw order requested for
  // JS/draw-order.js: polygons always render behind lines, which always render
  // behind points, regardless of which layer/dataset they belong to or which
  // order layers were opened in. This is a hard rule enforced by pane z-index -
  // the draw-order popup can only reorder layers that share the same tier (e.g.
  // two point datasets that overlap), never a polygon above a point.
  try{
    if(!map.getPane('vector-bottom')){ map.createPane('vector-bottom'); map.getPane('vector-bottom').style.zIndex = 450; }
    if(!map.getPane('vector-line')){ map.createPane('vector-line'); map.getPane('vector-line').style.zIndex = 550; }
    if(!map.getPane('vector-top')){ map.createPane('vector-top'); map.getPane('vector-top').style.zIndex = 650; }
  }catch(e){}

  // Factories (not just one-shot construction) so updateViewportData() below can
  // lazily create a sub-layer that didn't exist yet - e.g. a pure-point dataset
  // opened while the map view has zero of its features never gets a pointLayer at
  // construction time, and without a way to create one later, panning/flying to
  // the data afterward would still show nothing (clearLayers()/addData() on a
  // layer that was never created is a no-op).
  function makeSubLayer(featureCollection, pane){
    var baseOpts = geojsonOptions(layerName, legendConfig);
    var opts = Object.assign({}, baseOpts);
    var baseOnEach = baseOpts.onEachFeature;
    opts.onEachFeature = function(feature, layer){
      try{ if(layer && layer.options) layer.options.pane = pane; }catch(e){}
      if(typeof baseOnEach === 'function') baseOnEach(feature, layer);
    };
    opts.pane = pane;
    return L.geoJSON(featureCollection, opts);
  }
  function makePolyLayer(featureCollection){ return makeSubLayer(featureCollection, 'vector-bottom'); }
  function makeLineLayer(featureCollection){ return makeSubLayer(featureCollection, 'vector-line'); }
  function makePointLayer(featureCollection){ return makeSubLayer(featureCollection, 'vector-top'); }

  // Terrain only: repeated contour-value labels placed every 15 km along each
  // contour line. Rebuilt on every viewport change (see updateViewportData below)
  // because the tiled data is re-fetched per viewport - so it can only ever label
  // the contours currently loaded. Returns an L.layerGroup, or null when there's
  // nothing to label.
  function buildContourLabelLayer(lineFeats){
    if(layerName!=='Terrain' || typeof turf === 'undefined') return null;
    var lg = L.layerGroup();
    (lineFeats||[]).forEach(function(f){
      if(!f || !f.geometry) return;
      var contour = (f.properties && (f.properties.Contour || f.properties.contour || f.properties.CONTOUR)) || '';
      var lengthKm = 0;
      try{ lengthKm = turf.length(f, {units:'kilometers'}) || 0; }catch(e){ lengthKm = 0; }
      if(lengthKm<=0) return;
      for(var d=0; d<=lengthKm; d+=15){
        try{
          var pt = turf.along(f, d, {units:'kilometers'});
          if(pt && pt.geometry && pt.geometry.coordinates){
            var c = pt.geometry.coordinates;
            var html = '<div style="font-size:10px; color:white; background:rgba(55, 65, 81, 0.75); padding:2px 4px; border-radius:6px; border:none; z-index:9999; letter-spacing:0.5px; font-weight:500; display:inline-block;">'+String(contour)+'</div>';
            var ic = L.divIcon({className:'relief-label', html:html});
            lg.addLayer(L.marker([c[1], c[0]], {icon:ic, pane:'vector-top', interactive:false}));
          }
        }catch(e){}
      }
    });
    return lg.getLayers().length ? lg : null;
  }

  // Contour labels are only legible zoomed in close (~1:35000 or larger).
  function shouldShowContourLabels(){
    try{
      var mapCenter = map.getCenter(); var zoom = map.getZoom();
      var latRad = (mapCenter.lat || 0) * Math.PI / 180;
      var metersPerPixel = 156543.03392 * Math.cos(latRad) / Math.pow(2, zoom);
      var scaleDenominator = metersPerPixel * 96 * 39.3700787;
      return scaleDenominator < 35000;
    }catch(e){ return false; }
  }

  var features = (data && data.features) ? data.features.filter(function(f){
    return f && f.geometry && hasValidCoordinates(f.geometry.type, f.geometry.coordinates);
  }) : [];
  var polyFeatures = { type: 'FeatureCollection', features: features.filter(function(f){ return f && f.geometry && (f.geometry.type==='Polygon' || f.geometry.type==='MultiPolygon'); }) };
  var lineFeatures = { type: 'FeatureCollection', features: features.filter(function(f){ return f && f.geometry && (f.geometry.type==='LineString' || f.geometry.type==='MultiLineString'); }) };
  var pointFeatures = { type: 'FeatureCollection', features: clusterPointFeatures(features.filter(function(f){ return f && f.geometry && (f.geometry.type==='Point' || f.geometry.type==='MultiPoint'); })) };

  var layers = [];
  var polyLayer = null, lineLayer = null, pointLayer = null;
  if(polyFeatures.features.length){
    polyLayer = makePolyLayer(polyFeatures);
    layers.push(polyLayer);
  }
  if(lineFeatures.features.length){
    lineLayer = makeLineLayer(lineFeatures);
    layers.push(lineLayer);
  }
  var _preparedLabelLayer = buildContourLabelLayer(lineFeatures.features);
  if(pointFeatures.features.length){
    pointLayer = makePointLayer(pointFeatures);
    layers.push(pointLayer);
  }

  var group = null;
  if(layers.length===1){
    group = layers[0];
    group.addTo(map);
  } else {
    group = L.layerGroup(layers).addTo(map);
  }
  // Attach convenience references regardless of how the group was assembled, so
  // setLayerOpacity() (JS/utils.js), JS/draw-order.js, and updateViewportData()
  // below can always find (or lazily create) the poly/line/point sub-layers off
  // the group itself.
  group._polyLayer = polyLayer;
  group._lineLayer = lineLayer;
  group._vecLayer = pointLayer;

  // Terrain contour labels: attach the (possibly null) label layer and wire a
  // scale-gated visibility toggle. updateViewportData() rebuilds group._labelLayer
  // as the tiled data changes, then calls group._updateContourLabelVisibility().
  if(layerName==='Terrain'){
    group._labelLayer = _preparedLabelLayer || null;
    var updateLabelVisibility = function(){
      try{
        var ll = group._labelLayer;
        if(ll && shouldShowContourLabels()){
          if(!group.hasLayer(ll)) group.addLayer(ll);
        } else if(ll && group.hasLayer(ll)){
          group.removeLayer(ll);
        }
      }catch(e){}
    };
    updateLabelVisibility();
    map.on('zoomend moveend', updateLabelVisibility);
    group._updateContourLabelVisibility = updateLabelVisibility;
    group._detachContourLabels = function(){
      try{ map.off('zoomend moveend', updateLabelVisibility); }catch(e){}
      try{ if(group._labelLayer && group.hasLayer(group._labelLayer)) group.removeLayer(group._labelLayer); }catch(e){}
    };
  }

  // Capture native resetStyle references before overwriting (prevents infinite recursion when group===one of the sub-layers)
  var _polyReset  = (polyLayer  && typeof polyLayer.resetStyle  === 'function') ? polyLayer.resetStyle.bind(polyLayer)   : null;
  var _lineReset  = (lineLayer  && typeof lineLayer.resetStyle  === 'function') ? lineLayer.resetStyle.bind(lineLayer)   : null;
  var _pointReset = (pointLayer && typeof pointLayer.resetStyle === 'function') ? pointLayer.resetStyle.bind(pointLayer) : null;
  group.resetStyle = function(feature){
    if(_polyReset)  try{ _polyReset(feature);  }catch(_){}
    if(_lineReset)  try{ _lineReset(feature);  }catch(_){}
    if(_pointReset) try{ _pointReset(feature); }catch(_){}
  };

  group.updateViewportData = function(filteredData){
    var fts = filteredData && filteredData.features || [];
    var pFts = fts.filter(function(f){ return f&&f.geometry&&(f.geometry.type==='Polygon'||f.geometry.type==='MultiPolygon'); });
    var lFts = fts.filter(function(f){ return f&&f.geometry&&(f.geometry.type==='LineString'||f.geometry.type==='MultiLineString'); });
    var vFts = clusterPointFeatures(fts.filter(function(f){ return f&&f.geometry&&(f.geometry.type==='Point'||f.geometry.type==='MultiPoint'); }));
    if(polyLayer){
      try{ polyLayer.clearLayers(); if(pFts.length) polyLayer.addData({type:'FeatureCollection',features:pFts}); }catch(_){}
    } else if(pFts.length){
      // No polygon sub-layer existed yet (none were in view at construction time) - create
      // one now so panning/flying into the data afterward actually renders it.
      try{
        polyLayer = makePolyLayer({type:'FeatureCollection',features:pFts});
        group.addLayer(polyLayer);
        group._polyLayer = polyLayer;
        _polyReset = polyLayer.resetStyle.bind(polyLayer);
      }catch(_){}
    }
    if(lineLayer){
      try{ lineLayer.clearLayers(); if(lFts.length) lineLayer.addData({type:'FeatureCollection',features:lFts}); }catch(_){}
    } else if(lFts.length){
      try{
        lineLayer = makeLineLayer({type:'FeatureCollection',features:lFts});
        group.addLayer(lineLayer);
        group._lineLayer = lineLayer;
        _lineReset = lineLayer.resetStyle.bind(lineLayer);
      }catch(_){}
    }
    if(pointLayer){
      try{ pointLayer.clearLayers(); if(vFts.length) pointLayer.addData({type:'FeatureCollection',features:vFts}); }catch(_){}
    } else if(vFts.length){
      try{
        pointLayer = makePointLayer({type:'FeatureCollection',features:vFts});
        group.addLayer(pointLayer);
        group._vecLayer = pointLayer;
        _pointReset = pointLayer.resetStyle.bind(pointLayer);
      }catch(_){}
    }
    // Terrain: rebuild contour labels for the features now in view.
    if(layerName==='Terrain'){
      try{
        if(group._labelLayer && group.hasLayer(group._labelLayer)) group.removeLayer(group._labelLayer);
        group._labelLayer = buildContourLabelLayer(lFts);
        if(typeof group._updateContourLabelVisibility === 'function') group._updateContourLabelVisibility();
      }catch(_){}
    }
    if(typeof AthensGIS.applyDrawOrder === 'function'){ try{ AthensGIS.applyDrawOrder(); }catch(_){} }
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

function countTotalLayers(){
  var count = 0;
  Object.keys(layerCategories).forEach(function(cat){
    var catData = layerCategories[cat];
    Object.keys(catData).forEach(function(key){
      var val = catData[key];
      if(Array.isArray(val)) count += val.length;
    });
  });
  return count + 2; // +2 for the common layers (Terrain, Shaded Relief)
}

function renderLayerControl(){
  if(!getMap()) return setTimeout(renderLayerControl,50);
  var controlDiv = document.getElementById('layerControl'); if(!controlDiv) return;

  if(!controlDiv.querySelector('#collapseAllBtn')){
    var wrap=document.createElement('div'); wrap.id='layerControlContainer'; wrap.style.display='flex'; wrap.style.flexDirection='column'; wrap.style.alignItems='center'; wrap.style.gap='8px';
    var title = document.createElement('div'); title.style.fontSize = '14px'; title.style.fontWeight = '500'; title.style.margin = '2px 0 8px 0'; title.style.padding = '6px 10px'; title.style.background = 'rgba(55, 65, 81, 0.85)'; title.style.color = 'white'; title.style.borderRadius = '10px'; title.style.letterSpacing = '2px'; title.style.width='93%'; title.style.display='flex'; title.style.alignItems='center'; title.style.justifyContent='center'; title.style.position='relative';
    var titleText = document.createElement('span'); titleText.textContent = 'LAYERS';
    var countBadge = document.createElement('span'); countBadge.textContent = countTotalLayers(); countBadge.style.position='absolute'; countBadge.style.right='7px'; countBadge.style.fontSize='12px'; countBadge.style.fontWeight='500'; countBadge.style.letterSpacing='0'; countBadge.style.background='rgba(255,255,255,0.2)'; countBadge.style.borderRadius='6px'; countBadge.style.padding='1px 10px';
    title.appendChild(titleText); title.appendChild(countBadge);

    // Shared look for the panel's action buttons (colors/hover live in style.css
    // under .layer-panel-btn / .is-active); this only wires up the shared layout.
    function createLayerPanelButton(id, text){
      var btn=document.createElement('button'); btn.type='button'; btn.id=id; btn.className='layer-panel-btn'; btn.textContent=text;
      btn.style.width='93%'; btn.style.padding='3px 4px'; btn.style.marginBottom='6px'; btn.style.borderRadius='12px'; btn.style.fontSize='10px'; btn.style.fontWeight='500'; btn.style.letterSpacing='1px'; btn.style.cursor='pointer';
      return btn;
    }

    var collapseAllBtn = createLayerPanelButton('collapseAllBtn', 'COLLAPSE ALL');
    collapseAllBtn.style.marginBottom='0'; // spacing to the button below comes from wrap's own flex gap
    function updateCollapseAllButtonState(){
      var anyOpen = !!controlDiv.querySelector('.category-header.open, .subcategory-header.open');
      collapseAllBtn.classList.toggle('is-active', anyOpen);
    }
    collapseAllBtn.addEventListener('click', function(){
      // Re-use each header's own click handler (which toggles + animates it closed)
      controlDiv.querySelectorAll('.category-header.open').forEach(function(h){ h.click(); });
      controlDiv.querySelectorAll('.subcategory-header.open').forEach(function(h){ h.click(); });
      updateCollapseAllButtonState();
    });
    // Any category/subcategory header click (expand or collapse, including the
    // programmatic ones dataset-search.js uses to reveal a row) can change whether
    // anything is open, so re-check the button's active state after every one.
    controlDiv.addEventListener('click', function(e){
      if(e.target.closest && e.target.closest('.category-header, .subcategory-header')){
        updateCollapseAllButtonState();
      }
    });
    updateCollapseAllButtonState();

    var closeAllLayersBtn = createLayerPanelButton('closeAllLayersBtn', 'CLOSE ALL LAYERS');
    function updateCloseAllLayersButtonState(){
      var anyActive = !!(AthensGIS.activeLayerOrder && AthensGIS.activeLayerOrder.length);
      closeAllLayersBtn.classList.toggle('is-active', anyActive);
    }
    closeAllLayersBtn.addEventListener('click', function(){
      // Uncheck + dispatch 'change' so each row's own handler does the real
      // cleanup (map layer removal, legend/info-box, activeLayerOrder, etc.)
      controlDiv.querySelectorAll('.layer-item input[type=checkbox]:checked').forEach(function(cb){
        cb.checked = false;
        cb.dispatchEvent(new Event('change', { bubbles: true }));
      });
      updateCloseAllLayersButtonState();
    });
    // Any layer checkbox toggling (manual or programmatic, e.g. dataset-search.js
    // checking a layer) can change whether anything is active - re-check after each.
    controlDiv.addEventListener('change', function(e){
      if(e.target && e.target.matches && e.target.matches('input[type=checkbox]')){
        updateCloseAllLayersButtonState();
      }
    });
    updateCloseAllLayersButtonState();

    wrap.appendChild(title);
    wrap.appendChild(collapseAllBtn);
    wrap.appendChild(closeAllLayersBtn);
    controlDiv.appendChild(wrap);
    // Attach the zoom-to-selected behavior to the toolbar button if present
    (function(){
      var extBtn = document.getElementById('zoomSelectedBtn');
      if(!extBtn) return;
      extBtn.addEventListener('click', function(){
        var activeKeys = Object.keys(AthensGIS.geojsonLayers).filter(function(k){
          var lyr = AthensGIS.geojsonLayers[k];
          return !!(lyr && getMap().hasLayer(lyr));
        });
        if(!activeKeys.length) return;
        // Vector layers only ever render the current viewport's slice of features
        // (pmtiles-backed layers included - one that's toggled on but currently
        // outside the view can have ZERO features rendered right now), so this needs
        // each layer's true full extent, not the live layer's own (viewport-clipped,
        // possibly empty) getBounds() - see resolveExtentBounds() above. That can
        // require a tiny async read (manifest or archive header), hence Promise.all
        // instead of a plain synchronous loop.
        extBtn.style.pointerEvents = 'none';
        extBtn.style.opacity = '0.7';
        Promise.all(activeKeys.map(resolveExtentBounds)).then(function(boundsList){
          var combined = null;
          boundsList.forEach(function(b){
            if(!b || !b.isValid()) return;
            combined = combined ? combined.extend(b) : L.latLngBounds(b.getSouthWest(), b.getNorthEast());
          });
          if(combined && combined.isValid()) getMap().fitBounds(combined.pad(0.05));
        }).finally(function(){
          extBtn.style.pointerEvents = '';
          extBtn.style.opacity = '';
        });
      });
    })();
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

  // Exposed so the AI assistant can set a layer's color by swatch name (Red, Orange,
  // Yellow, Green, Cyan, Blue, Indigo, Purple, Brown - matches LAYER_COLOR_SWATCHES
  // exactly, since those are the only choices the real color panel offers) or
  // "default"/"reset" to clear it. No colorButton/colorPanel is passed through -
  // both call sites null-guard on them, so the on-map restyle still happens; only
  // the button's own swatch preview stays stale until the panel is next opened.
  // Returns false (no-op) for a layer with no color state at all - i.e. one with a
  // legend config, which is styled by class instead of a single border/fill color.
  function setLayerColorByName(layerName, swatchName){
    if(!layerName) return false;
    var layerKey = AthensGIS.layerKeyByName[layerName] || layerName;
    var normalized = String(swatchName || '').trim().toLowerCase();
    if(normalized === 'default' || normalized === 'reset'){
      resetLayerRowColorSelection(layerName, layerKey, null, null);
      return true;
    }
    var swatch = LAYER_COLOR_SWATCHES.find(function(s){ return s.name.toLowerCase() === normalized; });
    if(!swatch) return false;
    applyLayerRowColorSelection(layerName, layerKey, swatch.hex, null, null);
    return true;
  }
  AthensGIS.setLayerColorByName = setLayerColorByName;

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

  // Render Terrain as a common layer at the very top (outside categories)
  (function renderReliefCommon(){
    // The Terrain (elevation contour) layer renders exclusively from this pre-tiled
    // vector archive on R2 - fetched viewport-by-viewport like every other .pmtiles
    // layer (see the isPmtilesFile() branch in createLayerRow() and JS/pmtiles-loader.js).
    var TERRAIN_PMTILES = 'Environment/Relief0.pmtiles';
    // Matches the name.replace(/\s+/g,'_') convention every other layer's checkbox id
    // follows (see createLayerRow), so JS/dataset-search.js's
    // document.getElementById(entry.name.replace(...)) lookup finds this one too -
    // this "common" layer lives outside layerCategories, but its checkbox id doesn't
    // need to know that.
    var id='Terrain';
    var commonWrap = document.getElementById('common-layers-wrap');
    if(!commonWrap){
      commonWrap = document.createElement('div');
      commonWrap.id = 'common-layers-wrap';
      controlDiv.appendChild(commonWrap);
    }
    var row=document.createElement('div'); row.className='layer-item';
    var cb=document.createElement('input'); cb.type='checkbox'; cb.id=id;
    cb.dataset.layername='Terrain'; cb.dataset.filename=TERRAIN_PMTILES;
    var label=document.createElement('label'); label.htmlFor=id; label.textContent='Terrain';
    row.appendChild(cb); row.appendChild(label);
    commonWrap.appendChild(row);

    cb.addEventListener('change', function(){
      var layerName=this.dataset.layername;
      if(this.checked){
        row.classList.add('selected');
        var stopTerrainSpinner = startLoadingSpinner(label);
        row._stopSpinner = stopTerrainSpinner;
        var _terrainAbortCtrl = new AbortController();
        row._abortController = _terrainAbortCtrl;
        var _terrainSignal = _terrainAbortCtrl.signal;
        AthensGIS.activeLayerInfos[layerName]='<em>Loading info...</em>';
        ensureInfoBoxUpdate();
        // Show legend immediately
        if(typeof window.updateLegendBar==='function' && (window.legendConfigs||{})[layerName]){
          window.updateLegendBar(layerName);
        }
        var terrainUrl = buildAssetUrl('data', TERRAIN_PMTILES);
        AthensGIS.pmtiles.getFeaturesForBounds(terrainUrl, getMap().getBounds(), getMap().getZoom())
          .then(function(fc){
            stopTerrainSpinner();
            if(!cb.checked) return;
            var lc=(window.legendConfigs||{})[layerName];
            if(typeof window.updateLegendBar==='function') window.updateLegendBar(layerName);
            var lyr=createLayerFromGeoJSON(fc || {type:'FeatureCollection',features:[]}, layerName, lc);
            AthensGIS.geojsonLayers[TERRAIN_PMTILES]=lyr;
            AthensGIS._viewportLayers = AthensGIS._viewportLayers || {};
            // Re-fetch the tiles covering the new bounds/zoom on pan/zoom (debounced,
            // race-guarded by pmtiles-loader.js) instead of re-filtering an in-memory
            // array - same approach as the pmtiles branch in createLayerRow().
            var _applyTerrainViewport = lyr.updateViewportData.bind(lyr);
            var _terrainViewportDebounce = null;
            lyr.updateViewportData = function(){
              clearTimeout(_terrainViewportDebounce);
              _terrainViewportDebounce = setTimeout(function(){
                if(!cb.checked) return;
                AthensGIS.pmtiles.getFeaturesForBounds(terrainUrl, getMap().getBounds(), getMap().getZoom()).then(function(freshFc){
                  if(!freshFc || !cb.checked) return; // null = superseded by a newer pan/zoom
                  _applyTerrainViewport(freshFc);
                });
              }, 150);
            };
            AthensGIS._viewportLayers[TERRAIN_PMTILES] = lyr;
            setupViewportUpdateHandler();
          }).catch(function(err){
            stopTerrainSpinner();
            if(err && err.name==='AbortError') return;
            console.error('Failed to load Terrain layer data:', err);
            AthensGIS.activeLayerInfos[layerName]='<em>Could not load layer data.</em>';
            ensureInfoBoxUpdate();
          });
        loadLayerInfo('Environment/Relief.txt', _terrainSignal).then(function(t){ if(!cb.checked) return; AthensGIS.activeLayerInfos[layerName]=t; ensureInfoBoxUpdate(); })
          .catch(function(err){ if(err && err.name==='AbortError') return; AthensGIS.activeLayerInfos[layerName]='<em>No extra info available for this layer.</em>'; ensureInfoBoxUpdate(); });
        if(AthensGIS.activeLayerOrder.indexOf(layerName)===-1) AthensGIS.activeLayerOrder.push(layerName);
        AthensGIS.layerKeyByName[layerName]=TERRAIN_PMTILES;
        if(typeof AthensGIS.refreshOpacityPopup==='function') AthensGIS.refreshOpacityPopup();
      } else {
        if(row._abortController){ row._abortController.abort(); row._abortController = null; }
        if(typeof row._stopSpinner==='function'){ row._stopSpinner(); row._stopSpinner=null; }
        resetFeatureHighlight();
        row.classList.remove('selected');
        var _terrainLyr = AthensGIS.geojsonLayers[TERRAIN_PMTILES];
        if(_terrainLyr){
          if(typeof _terrainLyr._detachContourLabels === 'function') _terrainLyr._detachContourLabels();
          getMap().removeLayer(_terrainLyr);
          delete AthensGIS.geojsonLayers[TERRAIN_PMTILES];
        }
        if(AthensGIS._viewportLayers) delete AthensGIS._viewportLayers[TERRAIN_PMTILES];
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

  // Render Shaded Relief as a common layer directly below Terrain (outside categories)
  (function renderHillshadeCommon(){
    // Coloured shaded-relief (hypsometric tint + hillshade), a PNG tile pyramid on
    // R2. Rendered in its own pane just above the basemap, so it always sits
    // beneath the Terrain contours and every other data layer - see
    // ensureHillshadePane() below.
    var SHADED_RELIEF_PMTILES = 'Environment/shadedrelief.pmtiles';
    // Matches 'Shaded Relief'.replace(/\s+/g,'_') - see the comment on Terrain's id above.
    var id='Shaded_Relief';
    var commonWrap = document.getElementById('common-layers-wrap');
    if(!commonWrap){
      commonWrap = document.createElement('div');
      commonWrap.id = 'common-layers-wrap';
      controlDiv.appendChild(commonWrap);
    }
    var row=document.createElement('div'); row.className='layer-item';
    var cb=document.createElement('input'); cb.type='checkbox'; cb.id=id;
    cb.dataset.layername='Shaded Relief'; cb.dataset.filename=SHADED_RELIEF_PMTILES;
    var label=document.createElement('label'); label.htmlFor=id; label.textContent='Shaded Relief';
    row.appendChild(cb); row.appendChild(label);
    commonWrap.appendChild(row); // appended after the Terrain row => sits below it

    function ensureHillshadePane(){
      var map=getMap(); if(!map) return;
      try{
        if(!map.getPane('hillshade-pane')){
          map.createPane('hillshade-pane');
          // Above the basemap tilePane (z 200), below overlayPane (400) and every
          // vector pane (vector-bottom 450, vector-line 550, vector-top 650).
          map.getPane('hillshade-pane').style.zIndex = 250;
          map.getPane('hillshade-pane').style.pointerEvents = 'none';
        }
      }catch(e){}
    }

    cb.addEventListener('change', function(){
      var layerName=this.dataset.layername;
      if(this.checked){
        row.classList.add('selected');
        var stopHsSpinner = startLoadingSpinner(label);
        row._stopSpinner = stopHsSpinner;
        var _hsAbortCtrl = new AbortController();
        row._abortController = _hsAbortCtrl;
        var _hsSignal = _hsAbortCtrl.signal;
        AthensGIS.activeLayerInfos[layerName]='<em>Loading info...</em>';
        ensureInfoBoxUpdate();
        // Show the elevation legend immediately (independent of tile loading).
        if(typeof window.updateLegendBar==='function' && (window.legendConfigs||{})[layerName]){
          window.updateLegendBar(layerName);
        }
        ensureHillshadePane();
        var hillshadeUrl = buildAssetUrl('data', SHADED_RELIEF_PMTILES);
        var hsOpacity = (AthensGIS.layerOpacities && AthensGIS.layerOpacities[layerName] !== undefined) ? AthensGIS.layerOpacities[layerName] : 1;
        // The raster bakes its out-of-DEM nodata as a flat opaque #aad3df (rgb 170,211,223);
        // knock that colour out so the basemap shows through around Attica and over the sea.
        AthensGIS.pmtiles.getRasterLayer(hillshadeUrl, { pane:'hillshade-pane', opacity:hsOpacity, attribution:'', transparentRGB:[170,211,223], transparentTolerance:10 })
          .then(function(lyr){
            stopHsSpinner();
            if(!cb.checked){ return; }
            lyr.addTo(getMap());
            AthensGIS.geojsonLayers[SHADED_RELIEF_PMTILES]=lyr;
          }).catch(function(err){
            stopHsSpinner();
            if(err && err.name==='AbortError') return;
            console.error('Failed to load Shaded Relief layer data:', err);
            AthensGIS.activeLayerInfos[layerName]='<em>Could not load layer data.</em>';
            ensureInfoBoxUpdate();
          });
        loadLayerInfo('Environment/Hillshade.txt', _hsSignal).then(function(t){ if(!cb.checked) return; AthensGIS.activeLayerInfos[layerName]=t; ensureInfoBoxUpdate(); })
          .catch(function(err){ if(err && err.name==='AbortError') return; AthensGIS.activeLayerInfos[layerName]='<em>No extra info available for this layer.</em>'; ensureInfoBoxUpdate(); });
        if(AthensGIS.activeLayerOrder.indexOf(layerName)===-1) AthensGIS.activeLayerOrder.push(layerName);
        AthensGIS.layerKeyByName[layerName]=SHADED_RELIEF_PMTILES;
        if(typeof AthensGIS.refreshOpacityPopup==='function') AthensGIS.refreshOpacityPopup();
      } else {
        if(row._abortController){ row._abortController.abort(); row._abortController = null; }
        if(typeof row._stopSpinner==='function'){ row._stopSpinner(); row._stopSpinner=null; }
        row.classList.remove('selected');
        var _hsLyr = AthensGIS.geojsonLayers[SHADED_RELIEF_PMTILES];
        if(_hsLyr){ getMap().removeLayer(_hsLyr); delete AthensGIS.geojsonLayers[SHADED_RELIEF_PMTILES]; }
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

  var SUBCATEGORY_HEADER_BG = 'rgba(255, 255, 255, 1)';
  var SUBCATEGORY_HEADER_BG_ACTIVE = 'linear-gradient(135deg, rgba(55, 65, 81, 0.16) 0%, rgba(255, 255, 255, 1) 70%)';

  // Give the subcategory title box a soft gradient fill while at least one
  // of its layers is checked on, so an active subcategory reads at a glance.
  function updateSubcategoryActiveState(subHeader, subContentId){
    if(!subHeader || !subContentId) return;
    var count = countCheckedByDataset('subcategoryId', subContentId);
    subHeader.style.background = count > 0 ? SUBCATEGORY_HEADER_BG_ACTIVE : SUBCATEGORY_HEADER_BG;
    subHeader.classList.toggle('has-active-layer', count > 0);
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
    var isRaster = info.type === 'raster';
    // info.geojson (the original file) is the download source for pmtiles-backed
    // layers - info.file is the .pmtiles render source there, which loadLayerData()
    // (JSON-parses the response) can't read. Plain/raster layers have no .geojson
    // field, so this falls back to info.file exactly as before.
    var sourceFile = String(info.geojson || info.file);
    var sourceName = sourceFile.split('/').pop() || 'layer.geojson';
    var sourceExt = (sourceName.match(/\.[^/.]+$/) || ['.geojson'])[0];
    var baseName = sourceName.replace(/\.[^/.]+$/, '') || 'layer';
    var txtRelativePath = sourceFile.replace(/\.[^/.]+$/, '') + '.txt';
    var dataFilename = baseName + (isRaster ? sourceExt : '.geojson');
    var txtFilename = baseName + '.txt';
    var zipFilename = getLayerZipFileName(info.name);

    setDownloadButtonBusy(buttonEl, true);
    return Promise.all([
      isRaster ? loadRasterArrayBuffer(sourceFile) : loadLayerData(sourceFile),
      loadLayerInfo(txtRelativePath)
    ]).then(function(results){
      var data = results[0];
      var infoText = results[1];
      var zip = new JSZip();
      zip.file(dataFilename, isRaster ? data : JSON.stringify(data, null, 2));
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
        sourceFile: sourceFile
      }, categoryName, subcategoryName);
    }).catch(function(err){
      console.error('Failed to create zip for layer "' + (info.name || sourceFile) + '":', err);
      alert('Could not create the zip file for "' + (info.name || sourceFile) + '". Please try again.');
    }).then(function(){
      setDownloadButtonBusy(buttonEl, false);
    });
  }
  // Exposed so the AI assistant can trigger a download without a real click event -
  // buttonEl/categoryName/subcategoryName are optional (see null-guards above).
  AthensGIS.downloadLayerAsZip = downloadLayerAsZip;

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

  function createLayerRow(info, parentEl, categoryContent, countSpan, arrowEl, subcategoryContent, categoryName, subcategoryName, subHeaderEl){
    if(!info || !parentEl || !categoryContent) return;
    var id=info.name.replace(/\s+/g,'_');
    var hasLegend = !!((window.legendConfigs||{})[info.name]);
    var row=document.createElement('div'); row.className='layer-item';
    var cb=document.createElement('input'); cb.type='checkbox'; cb.id=id; cb.dataset.layername=info.name; if(info.file) cb.dataset.filename=info.file;
    var label=document.createElement('label'); label.htmlFor=id; label.textContent=info.name;
    var actions = null;
    var dl=document.createElement('a'); dl.href='#'; dl.innerHTML='DOWNLOAD'; dl.className='download-button'; dl.style.display='none'; dl.title='Download the selected layer as ZIP';
    dl.addEventListener('click', function(e){
      e.preventDefault();
      e.stopPropagation();
      downloadLayerAsZip(info, categoryName, subcategoryName, dl);
    });
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
    var hasFilterConfig = !!(window.LayerFilter && window.LayerFilter.getConfig(info.name));
    if(dl || colorBtn || hasFilterConfig){
      actions = document.createElement('div');
      actions.className = 'layer-item-actions';
      if(dl) actions.appendChild(dl);
      if(colorBtn) actions.appendChild(colorBtn);
      if(hasFilterConfig) window.LayerFilter.buildButton(info.name, info.file || null, row, actions);
    }
    row.appendChild(cb);
    row.appendChild(label);
    if(actions) row.appendChild(actions);
    if(colorPanel) row.appendChild(colorPanel);
    parentEl.appendChild(row);
    // Tag category/subcategory for active-layer counting
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
        var _abortCtrl = new AbortController();
        row._abortController = _abortCtrl;
        var _signal = _abortCtrl.signal;
        AthensGIS.activeLayerInfos[layerName]='<em>Loading info...</em>'; ensureInfoBoxUpdate();
        // Trigger legend update immediately (so user sees legend without waiting for fetch)
        if(typeof window.updateLegendBar==='function' && (window.legendConfigs||{})[layerName]){
          window.updateLegendBar(layerName);
        }
        if(info.type==='raster'){
          loadRasterData(file, _signal).then(function(georaster){
            stopRowSpinner();
            if(!cb.checked) return;
            var lcRaster=(window.legendConfigs||{})[layerName];
            if(typeof window.updateLegendBar==='function') window.updateLegendBar(layerName);
            var rasterLyr=createRasterLayer(georaster, layerName, lcRaster);
            AthensGIS.geojsonLayers[file]=rasterLyr;
            AthensGIS.rasterLayers=AthensGIS.rasterLayers || {};
            AthensGIS.rasterLayers[file]={ layer: rasterLyr, georaster: georaster, legendConfig: lcRaster, layerName: layerName, valueLabel: (lcRaster && lcRaster.title) || layerName };
          }).catch(function(err){ stopRowSpinner(); if(err && err.name==='AbortError') return; console.error('Failed to load raster layer data for "' + layerName + '":', err); AthensGIS.activeLayerInfos[layerName]='<em>Could not load layer data.</em>'; ensureInfoBoxUpdate(); });
          var txtRaster=file.replace(/\.[^/.]+$/, '')+'.txt'; loadLayerInfo(txtRaster, _signal).then(function(t){ if(!cb.checked) return; AthensGIS.activeLayerInfos[layerName]=t; ensureInfoBoxUpdate(); }).catch(function(err){ if(err && err.name==='AbortError') return; AthensGIS.activeLayerInfos[layerName]='<em>No extra info available for this layer.</em>'; ensureInfoBoxUpdate(); });
        } else if(file && isPmtilesFile(file)){
          // Tiled rendering: fetch only the tiles covering the current viewport at
          // the current zoom (JS/pmtiles-loader.js), decode them to a GeoJSON
          // FeatureCollection, and hand that to the same createLayerFromGeoJSON()
          // used by the plain-file branch below - styling/click/legend/highlight are
          // identical either way. info.geojson (the original file) is untouched here;
          // it's only used for downloads and manifest lookups.
          var geojsonPath3 = info.geojson || null;
          // .pmtiles archives are fetched straight from R2 like any other data asset -
          // AthensGIS.pmtiles (JS/pmtiles-loader.js) needs the full resolved URL, not
          // the bare "Category/Name.pmtiles" path used elsewhere as a cache key.
          var fileUrl3 = buildAssetUrl('data', file);
          AthensGIS.pmtilesDownloadSource = AthensGIS.pmtilesDownloadSource || {};
          AthensGIS.pmtilesDownloadSource[file] = geojsonPath3;
          AthensGIS.pmtiles.getFeaturesForBounds(fileUrl3, getMap().getBounds(), getMap().getZoom()).then(function(fc){
            stopRowSpinner();
            if(!cb.checked) return;
            var lc3=(window.legendConfigs||{})[layerName];
            if(typeof window.updateLegendBar==='function') window.updateLegendBar(layerName);
            var lyr3=createLayerFromGeoJSON(fc || {type:'FeatureCollection',features:[]}, layerName, lc3);
            AthensGIS.geojsonLayers[file]=lyr3;
            AthensGIS._viewportLayers = AthensGIS._viewportLayers || {};
            // Re-bind updateViewportData to re-fetch tiles for the new bounds/zoom
            // (async) instead of re-filtering an in-memory array (sync) - debounced
            // so a fast sequence of pan/zoom events doesn't stack up overlapping
            // fetches, and guarded against races by pmtiles-loader.js itself
            // (a stale in-flight fetch resolves to null and is discarded there).
            var _applyViewport3 = lyr3.updateViewportData.bind(lyr3);
            var _viewportDebounce3 = null;
            lyr3.updateViewportData = function(){
              clearTimeout(_viewportDebounce3);
              _viewportDebounce3 = setTimeout(function(){
                if(!cb.checked) return;
                AthensGIS.pmtiles.getFeaturesForBounds(fileUrl3, getMap().getBounds(), getMap().getZoom()).then(function(freshFc){
                  if(!freshFc || !cb.checked) return; // null = superseded by a newer pan/zoom
                  _applyViewport3(freshFc);
                });
              }, 150);
            };
            AthensGIS._viewportLayers[file] = lyr3;
            setupViewportUpdateHandler();
            if(window.LayerFilter) window.LayerFilter.onLayerLoaded(layerName, file, null, geojsonPath3);
          }).catch(function(err){ stopRowSpinner(); console.error('Failed to load tiled layer data for "' + layerName + '":', err); AthensGIS.activeLayerInfos[layerName]='<em>Could not load layer data.</em>'; ensureInfoBoxUpdate(); });
          var txt3=file.replace(/\.[^/.]+$/, '')+'.txt'; loadLayerInfo(txt3, _signal).then(function(t){ if(!cb.checked) return; AthensGIS.activeLayerInfos[layerName]=t; ensureInfoBoxUpdate(); }).catch(function(err){ if(err && err.name==='AbortError') return; AthensGIS.activeLayerInfos[layerName]='<em>No extra info available for this layer.</em>'; ensureInfoBoxUpdate(); });
        } else if(file){
          loadLayerData(file, _signal).then(function(data){
            stopRowSpinner();
            if(!cb.checked) return;
            var lc2=(window.legendConfigs||{})[layerName];
            if(typeof window.updateLegendBar==='function') window.updateLegendBar(layerName);
            indexLayerData(file, data);
            var viewportData2 = getViewportData(file, getMap().getBounds());
            var lyr2=createLayerFromGeoJSON(viewportData2, layerName, lc2);
            AthensGIS.geojsonLayers[file]=lyr2;
            AthensGIS._viewportLayers = AthensGIS._viewportLayers || {};
            AthensGIS._viewportLayers[file] = lyr2;
            setupViewportUpdateHandler();
            if(window.LayerFilter) window.LayerFilter.onLayerLoaded(layerName, file, data);
          }).catch(function(err){ stopRowSpinner(); if(err && err.name==='AbortError') return; console.error('Failed to load layer data for "' + layerName + '":', err); AthensGIS.activeLayerInfos[layerName]='<em>Could not load layer data.</em>'; ensureInfoBoxUpdate(); });
          var txt=file.replace(/\.[^/.]+$/, '')+'.txt'; loadLayerInfo(txt, _signal).then(function(t){ if(!cb.checked) return; AthensGIS.activeLayerInfos[layerName]=t; ensureInfoBoxUpdate(); }).catch(function(err){ if(err && err.name==='AbortError') return; AthensGIS.activeLayerInfos[layerName]='<em>No extra info available for this layer.</em>'; ensureInfoBoxUpdate(); });
        }
        if(AthensGIS.activeLayerOrder.indexOf(layerName)===-1) AthensGIS.activeLayerOrder.push(layerName);
        AthensGIS.layerKeyByName[layerName]=file||layerName;
        if(typeof AthensGIS.refreshOpacityPopup==='function') AthensGIS.refreshOpacityPopup();
      } else {
        if(row._abortController){ row._abortController.abort(); row._abortController = null; }
        if(typeof row._stopSpinner==='function'){ row._stopSpinner(); row._stopSpinner=null; }
        resetFeatureHighlight();
        // Remove selected visual style
        row.classList.remove('selected');
        if(dEl) dEl.style.display='none';
        if(colorPanel) colorPanel.classList.remove('open');
        if(file && AthensGIS.geojsonLayers[file]){
          getMap().removeLayer(AthensGIS.geojsonLayers[file]); delete AthensGIS.geojsonLayers[file];
          if(AthensGIS._viewportLayers) delete AthensGIS._viewportLayers[file];
          if(AthensGIS.rasterLayers) delete AthensGIS.rasterLayers[file];
        }
        delete AthensGIS.activeLayerInfos[layerName]; ensureInfoBoxUpdate(); if(!_infoBox) _infoBox = document.getElementById('infoBox'); if(_infoBox) _infoBox.style.display='none';
        // Update legend to remove this layer's entry (after state updated)
        if(typeof window.updateLegendBar==='function') window.updateLegendBar(layerName,'remove');
        var idx2=(AthensGIS.activeLayerOrder||[]).indexOf(layerName); if(idx2!==-1) AthensGIS.activeLayerOrder.splice(idx2,1);
        delete AthensGIS.layerKeyByName[layerName];
        if(window.LayerFilter) window.LayerFilter.onLayerRemoved(layerName);
        if(typeof AthensGIS.refreshOpacityPopup==='function') AthensGIS.refreshOpacityPopup();
      }
      // Update category header count badge: show number of active layers in this category
      try{
        var catCount = countCheckedByDataset('categoryId', categoryContent.id);
        updateCountBadge(countSpan, catCount, arrowEl);
      }catch(e){}
      // Update subcategory header gradient: highlight when any of its layers are active
      try{
        if(subHeaderEl && subcategoryContent && subcategoryContent.id){
          updateSubcategoryActiveState(subHeaderEl, subcategoryContent.id);
        }
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
        createLayerRow(info, subContent, content, countSpan, arrow, subContent, cat, subcat, subHeader);
      });

      var _subRafId = null;
      function setSubOpen(open){
        if(_subRafId !== null){ cancelAnimationFrame(_subRafId); _subRafId = null; }
        if(open){
          var _p = document.getElementById('layerControl');
          subContent.style.display = 'block';
          void subContent.offsetHeight;
          subContent.style.maxHeight = subContent.scrollHeight + '1px';
          subContent.style.opacity = '1';
          subHeader.classList.add('open');
          subArrow.style.transform = 'rotate(180deg)';
          subHeader.setAttribute('aria-expanded','true');
          subContent.setAttribute('aria-hidden','false');
          // Track expansion frame-by-frame: nudge panel scrollTop upward whenever
          // the growing content would overflow the panel's bottom edge.
          if(_p)(function _track(){
            var _pp = _p.getBoundingClientRect();
            var _cb = subContent.getBoundingClientRect().bottom;
            var _ht = subHeader.getBoundingClientRect().top;
            if(_cb > _pp.bottom - 4){
              var _budget = _ht - _pp.top - 4;
              if(_budget > 0) _p.scrollTop += Math.min(_cb - _pp.bottom + 4, _budget);
            }
            _subRafId = requestAnimationFrame(_track);
          })();
          var onSubExpandEnd = function(e){
            if(e.propertyName === 'max-height'){
              subContent.style.maxHeight = 'none';
              subContent.removeEventListener('transitionend', onSubExpandEnd);
              if(_subRafId !== null){ cancelAnimationFrame(_subRafId); _subRafId = null; }
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
    var _catRafId = null;
    function setOpen(open){
      if(_catRafId !== null){ cancelAnimationFrame(_catRafId); _catRafId = null; }
      if(open){
        var _p = document.getElementById('layerControl');
        content.style.display = 'block';
        void content.offsetHeight;
        content.style.maxHeight = content.scrollHeight + '1px';
        content.style.opacity = '1';
        header.classList.add('open');
        arrow.style.transform = 'rotate(180deg)';
        header.setAttribute('aria-expanded','true');
        content.setAttribute('aria-hidden','false');
        // Track expansion frame-by-frame: nudge panel scrollTop upward whenever
        // the growing content would overflow the panel's bottom edge.
        if(_p)(function _track(){
          var _pp = _p.getBoundingClientRect();
          var _cb = content.getBoundingClientRect().bottom;
          var _ht = header.getBoundingClientRect().top;
          if(_cb > _pp.bottom - 4){
            var _budget = _ht - _pp.top - 4;
            if(_budget > 0) _p.scrollTop += Math.min(_cb - _pp.bottom + 4, _budget);
          }
          _catRafId = requestAnimationFrame(_track);
        })();
        var onExpandEnd = function(e){
          if(e.propertyName === 'max-height'){
            content.style.maxHeight = 'none';
            content.removeEventListener('transitionend', onExpandEnd);
            if(_catRafId !== null){ cancelAnimationFrame(_catRafId); _catRafId = null; }
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
