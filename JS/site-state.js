(function () {
  // Loads data/site-state.json (written by the admin dashboard) once per page.
  // window.AthensGIS.siteStateReady resolves to the parsed state object, or to
  // null when the request fails, the body is not valid JSON, the state has no
  // version 1, or nothing arrives within 3 seconds. It never rejects.
  var TIMEOUT_MS = 3000;

  var AthensGIS = window.AthensGIS = window.AthensGIS || {};

  function stateUrl() {
    var cfg = window.CONFIG || {};
    if (cfg.SITE_STATE_URL) return cfg.SITE_STATE_URL;
    return (cfg.R2_BASE_URL || '') + '/data/site-state.json';
  }

  AthensGIS.siteStateReady = new Promise(function (resolve) {
    var settled = false;
    var controller = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = null;

    function finish(value) {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(value);
    }

    timer = setTimeout(function () {
      finish(null);
      if (controller) controller.abort();
    }, TIMEOUT_MS);

    try {
      var options = { cache: 'no-cache' };
      if (controller) options.signal = controller.signal;

      fetch(stateUrl(), options)
        .then(function (response) {
          if (!response.ok) throw new Error('HTTP ' + response.status);
          return response.json();
        })
        .then(function (state) {
          var valid = state && typeof state === 'object' && state.version === 1;
          finish(valid ? state : null);
        })
        .catch(function () {
          finish(null);
        });
    } catch (err) {
      finish(null);
    }
  });
})();
