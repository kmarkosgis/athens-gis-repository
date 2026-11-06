// Loading circle + interaction lock.
//
// Athens3D.loading.start(key) shows the spinner in the centre of the map and blocks
// every way of moving it (mouse, touch, wheel, keyboard and the on-screen buttons);
// Athens3D.loading.stop(key) releases it. Several keys can be held at once - the map
// is unlocked only when all of them are released. Every lock auto-releases after
// config.loadingMaxMs so a hung request can never freeze the page.
//
// Athens3D.handlers lets other tools (e.g. measure turning off double-click zoom)
// switch map handlers off without the loading lock switching them back on.
(function () {
  var ns = window.Athens3D = window.Athens3D || {};
  var cfg = ns.config || {};

  var HANDLERS = ['dragPan', 'dragRotate', 'scrollZoom', 'boxZoom', 'keyboard', 'doubleClickZoom', 'touchZoomRotate', 'touchPitch'];
  var disabledBy = {};   // handler name -> { ownerKey: true }

  function mapRef() { return ns.map || null; }

  function applyHandler(name) {
    var map = mapRef();
    if (!map || !map[name]) return;
    var owners = disabledBy[name];
    var off = owners && Object.keys(owners).length > 0;
    if (off && map[name].isEnabled()) map[name].disable();
    else if (!off && !map[name].isEnabled()) map[name].enable();
  }

  ns.handlers = {
    disable: function (owner, names) {
      (names || HANDLERS).forEach(function (n) {
        (disabledBy[n] = disabledBy[n] || {})[owner] = true;
        applyHandler(n);
      });
    },
    enable: function (owner) {
      HANDLERS.forEach(function (n) {
        if (disabledBy[n]) delete disabledBy[n][owner];
        applyHandler(n);
      });
    },
    // Called once the map exists, to apply locks taken before it was created.
    sync: function () { HANDLERS.forEach(applyHandler); }
  };

  var overlay = null;
  var held = {};        // key -> safety timer id

  function ensureOverlay() {
    if (overlay) return overlay;
    overlay = document.getElementById('loading3d');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'loading3d';
      overlay.innerHTML = '<div class="loading3d-spinner" role="status" aria-label="Loading"></div>';
      document.body.appendChild(overlay);
    }
    // Swallow anything aimed at the map or the controls while loading.
    ['wheel', 'mousedown', 'touchstart', 'pointerdown', 'contextmenu', 'dblclick', 'click'].forEach(function (type) {
      overlay.addEventListener(type, function (e) { e.preventDefault(); e.stopPropagation(); }, { passive: false });
    });
    return overlay;
  }

  function isLocked() { return Object.keys(held).length > 0; }

  function render() {
    var el = ensureOverlay();
    var locked = isLocked();
    el.classList.toggle('active', locked);
    el.setAttribute('aria-hidden', locked ? 'false' : 'true');
    document.body.classList.toggle('map-loading', locked);
    // The overlay covers the zoom/rotate buttons and the toolbar, but disable them
    // too so keyboard focus can't trigger them.
    document.querySelectorAll('[data-lock-while-loading]').forEach(function (b) {
      if (locked) b.setAttribute('data-locked', '1'); else b.removeAttribute('data-locked');
    });
  }

  ns.loading = {
    start: function (key) {
      key = key || 'default';
      if (held[key]) return;
      var map = mapRef();
      if (map) { try { map.stop(); } catch (e) { } }
      ns.handlers.disable('loading:' + key);
      held[key] = setTimeout(function () { ns.loading.stop(key); }, cfg.loadingMaxMs || 25000);
      render();
    },
    stop: function (key) {
      key = key || 'default';
      if (!held[key]) return;
      clearTimeout(held[key]);
      delete held[key];
      ns.handlers.enable('loading:' + key);
      render();
    },
    isLocked: isLocked
  };

  // Keyboard shortcuts (+/-/arrows) go to the map canvas; block them while locked.
  document.addEventListener('keydown', function (e) {
    if (isLocked() && e.target && e.target.closest && e.target.closest('#map')) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // Lock straight away - the page always opens loading.
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { ns.loading.start('init'); });
  } else {
    ns.loading.start('init');
  }
})();
