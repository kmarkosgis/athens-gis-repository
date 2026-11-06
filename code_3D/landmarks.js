// Landmark models: real 3D models (glTF / GLB) of chosen buildings, drawn on the terrain
// in place of the plain extruded block. The list is in config3d.js (config.landmarks).
//
// Model file convention (as exported from Blender / SketchUp / etc. to glTF 2.0):
//   - units are metres, Y is up (glTF standard);
//   - the origin (0, 0, 0) is the middle of the building at ground level;
//   - the front of the building faces +Z (south in the viewer when rotate is 0).
//
// three.js is only downloaded when there is at least one model to draw.
(function () {
  var ns = window.Athens3D = window.Athens3D || {};
  var map = ns.map;
  if (!map) return;
  var cfg = (ns.config && ns.config.landmarks) || {};

  var THREE_URL = 'three', GLTF_URL = 'three/addons/loaders/GLTFLoader.js';
  var LAYER_ID = 'landmarks-3d';
  var THREE = null, GLTFLoader = null, libs = null;
  var renderer, scene, camera, ambient, hemi, sunLight;
  var layerAdded = false;
  var items = [];

  function loadLibs() {
    if (!libs) {
      libs = Promise.all([import(THREE_URL), import(GLTF_URL)]).then(function (m) {
        THREE = m[0];
        GLTFLoader = m[1].GLTFLoader;
      });
    }
    return libs;
  }

  function firstSymbolLayerId() {
    var layers = map.getStyle().layers || [];
    for (var i = 0; i < layers.length; i++) if (layers[i].type === 'symbol') return layers[i].id;
    return undefined;
  }

  // ---------- Hiding the plain block under a model ----------
  // A building is left out of the layer when its outline comes within hideRadius metres of
  // a model's lon/lat (the one the point is inside is always within).
  function updateHidden() {
    var b = ns.buildings;
    if (!b || !map.getLayer(b.layerId)) return;
    var keep = items.filter(function (it) { return it.hideRadius > 0; }).map(function (it) {
      return ['>', ['distance', { type: 'Point', coordinates: [it.lon, it.lat] }], it.hideRadius];
    });
    map.setFilter(b.layerId, keep.length ? ['all'].concat(keep) : null);
  }

  // ---------- three.js layer ----------
  var customLayer = {
    id: LAYER_ID, type: 'custom', renderingMode: '3d',
    onAdd: function (m, gl) {
      camera = new THREE.Camera();
      scene = new THREE.Scene();
      ambient = new THREE.AmbientLight(0xffffff, 0.6);
      hemi = new THREE.HemisphereLight(0xdfe9f5, 0x8c8478, 0.5);
      sunLight = new THREE.DirectionalLight(0xffffff, 2);
      scene.add(ambient, hemi, sunLight, sunLight.target);
      renderer = new THREE.WebGLRenderer({ canvas: m.getCanvas(), context: gl, antialias: true });
      renderer.autoClear = false;
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    },
    render: function (gl, matrix) {
      if (!items.length || map.getZoom() < (cfg.minZoom || 0)) return;
      var proj = new THREE.Matrix4().fromArray(matrix);
      var rotX = new THREE.Matrix4().makeRotationX(Math.PI / 2);
      var Y = new THREE.Vector3(0, 1, 0);
      var sunDir = sunDirection();
      var up = (map.transform && map.transform.elevation) || 0;

      renderer.resetState();
      items.forEach(function (it) { if (it.root) it.root.visible = false; });
      items.forEach(function (it) {
        if (!it.root) return;
        var theta = -it.rotate * Math.PI / 180;
        var mc = maplibregl.MercatorCoordinate.fromLngLat([it.lon, it.lat], 0);
        var mu = mc.meterInMercatorCoordinateUnits();
        var e = 0;
        try { e = map.queryTerrainElevation([it.lon, it.lat]) || 0; } catch (err) { e = 0; }
        var s = mu * it.scale;
        var l = new THREE.Matrix4()
          .makeTranslation(mc.x, mc.y, (e + (it.lift || 0)) * mu)
          .scale(new THREE.Vector3(s, -s, s))
          .multiply(rotX)
          .multiply(new THREE.Matrix4().makeRotationY(theta));
        camera.projectionMatrix = proj.clone().multiply(l);
        // Lights are in the model's own axes: turn the sun's direction into them.
        var d = new THREE.Vector3(sunDir.e, sunDir.u, -sunDir.n).applyAxisAngle(Y, -theta);
        sunLight.position.copy(d.multiplyScalar(100));
        sunLight.intensity = sunDir.u > 0 ? 1.2 + 1.6 * sunDir.u : 0.15;
        ambient.intensity = sunDir.u > 0 ? 0.55 : 0.25;
        it.root.visible = true;
        renderer.render(scene, camera);
        it.root.visible = false;
      });
      // Back to the map's own GL state for whatever it draws next.
      renderer.resetState();
    }
  };

  // The sun in east / north / up components (the viewer's sun when its lighting is on,
  // otherwise a fixed afternoon sun from the south-west).
  function sunDirection() {
    var az = 225, alt = 45;
    if (ns.sun && ns.sun.isEnabled && ns.sun.isEnabled()) {
      var p = ns.sun.position();
      az = p.azimuth; alt = p.altitude;
    }
    var a = az * Math.PI / 180, h = alt * Math.PI / 180;
    return { e: Math.sin(a) * Math.cos(h), n: Math.cos(a) * Math.cos(h), u: Math.sin(h) };
  }

  function ensureLayer() {
    if (layerAdded) return;
    layerAdded = true;
    map.addLayer(customLayer, firstSymbolLayerId());
  }

  // ---------- Adding a model ----------
  function add(spec) {
    var it = {
      name: spec.name || spec.file,
      lon: spec.lon, lat: spec.lat,
      rotate: spec.rotate || 0,      // degrees clockwise (seen from above)
      scale: spec.scale || 1,
      lift: spec.lift || 0,          // metres above the ground
      // metres; 0 = keep the plain block as well
      hideRadius: spec.hideRadius == null ? 1 : spec.hideRadius,
      root: null
    };
    items.push(it);
    updateHidden();
    var url = ns.dataUrl(spec.file);
    return loadLibs().then(function () {
      ensureLayer();
      return new Promise(function (resolve, reject) {
        new GLTFLoader().load(url, resolve, undefined, reject);
      });
    }).then(function (gltf) {
      it.root = gltf.scene;
      it.root.visible = false;
      scene.add(it.root);
      map.triggerRepaint();
      return it;
    }).catch(function (err) {
      console.warn('[3D] Landmark model not available:', url, err);
      items.splice(items.indexOf(it), 1);
      updateHidden();
      if (ns.notice) ns.notice('Landmark model "' + it.name + '" could not be loaded.');
    });
  }

  ns.landmarks = { add: add, items: items };

  document.addEventListener('athens3d:buildings', function () {
    (cfg.models || []).forEach(add);
  });
  document.addEventListener('athens3d:sun', function () { map.triggerRepaint(); });
})();
