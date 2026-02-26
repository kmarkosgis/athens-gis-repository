(function () {
  var STORAGE_KEY = "athensgis_cookie_consent_v2";
  var LEGACY_STORAGE_KEY = "athensgis_cookie_consent";
  var GA_MEASUREMENT_ID = "G-BSNF6CGQ5J";
  var POSTHOG_KEY = "phc_MHHcy6vbXCCiNqQcOlSEmTZvBPIXI4bTv36F4vvQyf6";
  var POSTHOG_API_HOST = "https://eu.i.posthog.com";
  var analyticsLoaded = false;

  function addMonths(date, months) {
    var next = new Date(date.getTime());
    next.setMonth(next.getMonth() + months);
    return next;
  }

  function readStoredConsent() {
    var raw = null;
    try {
      raw = localStorage.getItem(STORAGE_KEY);
    } catch (e) {
      return null;
    }
    if (!raw) return null;
    try {
      var parsed = JSON.parse(raw);
      if (!parsed || (parsed.status !== "accepted" && parsed.status !== "rejected")) return null;
      if (typeof parsed.expiresAt !== "number") return null;
      return parsed;
    } catch (e) {
      return null;
    }
  }

  function readLegacyConsent() {
    var raw = null;
    try {
      raw = localStorage.getItem(LEGACY_STORAGE_KEY);
    } catch (e) {
      return null;
    }
    if (raw !== "accepted" && raw !== "rejected") return null;
    return raw;
  }

  function clearLegacyConsent() {
    try {
      localStorage.removeItem(LEGACY_STORAGE_KEY);
    } catch (e) { }
  }

  function writeConsent(status) {
    var now = new Date();
    var expiresAt = addMonths(now, status === "accepted" ? 2 : 1).getTime();
    var payload = { status: status, expiresAt: expiresAt };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch (e) { }
    clearLegacyConsent();
    return payload;
  }

  function clearConsent() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) { }
    clearLegacyConsent();
  }

  function loadScript(src, id) {
    if (id && document.getElementById(id)) return;
    var script = document.createElement("script");
    if (id) script.id = id;
    script.async = true;
    script.src = src;
    document.head.appendChild(script);
  }

  function loadGoogleAnalytics() {
    if (window.__athensGaInitialized) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = window.gtag || function () {
      window.dataLayer.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", GA_MEASUREMENT_ID);
    loadScript("https://www.googletagmanager.com/gtag/js?id=" + encodeURIComponent(GA_MEASUREMENT_ID), "athens-ga-script");
    window.__athensGaInitialized = true;
  }

  function loadPosthog() {
    if (window.__athensPosthogInitialized) return;
    (function (t, e) {
      var o, n, p, r;
      if (e.__SV) return;
      window.posthog = e;
      e._i = [];
      e.init = function (i, s, a) {
        function g(target, key) {
          var parts = key.split(".");
          if (parts.length === 2) {
            target = target[parts[0]];
            key = parts[1];
          }
          target[key] = function () {
            target.push([key].concat(Array.prototype.slice.call(arguments, 0)));
          };
        }
        p = t.createElement("script");
        p.type = "text/javascript";
        p.async = true;
        p.id = "athens-posthog-script";
        p.src = s.api_host.replace(".i.posthog.com", "-assets.i.posthog.com") + "/static/array.js";
        r = t.getElementsByTagName("script")[0];
        r.parentNode.insertBefore(p, r);
        var u = e;
        if (a !== undefined) u = e[a] = [];
        else a = "posthog";
        u.people = u.people || [];
        u.toString = function (debug) {
          var name = "posthog";
          if (a !== "posthog") name += "." + a;
          if (!debug) name += " (stub)";
          return name;
        };
        u.people.toString = function () { return u.toString(1) + ".people (stub)"; };
        o = "init capture register register_once register_for_session unregister opt_out_capturing has_opted_out_capturing opt_in_capturing reset isFeatureEnabled getFeatureFlag getFeatureFlagPayload reloadFeatureFlags group identify setPersonProperties setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags resetGroups onFeatureFlags addFeatureFlagsHandler onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep".split(" ");
        for (n = 0; n < o.length; n += 1) g(u, o[n]);
        e._i.push([i, s, a]);
      };
      e.__SV = 1;
    })(document, window.posthog || []);

    window.posthog.init(POSTHOG_KEY, {
      api_host: POSTHOG_API_HOST,
      defaults: "2026-01-30"
    });
    window.__athensPosthogInitialized = true;
  }

  function loadAnalytics() {
    if (analyticsLoaded) return;
    loadGoogleAnalytics();
    loadPosthog();
    analyticsLoaded = true;
  }

  function shouldReprompt(consent) {
    if (!consent || typeof consent.expiresAt !== "number") return true;
    return Date.now() >= consent.expiresAt;
  }

  document.addEventListener("DOMContentLoaded", function () {
    var box = document.getElementById("cookie-consent-box");
    var acceptBtn = document.getElementById("cookie-accept-btn");
    var rejectBtn = document.getElementById("cookie-reject-btn");
    if (!box || !acceptBtn || !rejectBtn) return;

    var stored = readStoredConsent();
    if (!stored) {
      var legacy = readLegacyConsent();
      if (legacy) {
        stored = writeConsent(legacy);
      }
    }

    if (stored && shouldReprompt(stored)) {
      clearConsent();
      stored = null;
    }

    if (stored && stored.status === "accepted") {
      loadAnalytics();
      box.hidden = true;
    } else if (stored && stored.status === "rejected") {
      box.hidden = true;
    } else {
      box.hidden = false;
    }

    acceptBtn.addEventListener("click", function () {
      writeConsent("accepted");
      loadAnalytics();
      box.hidden = true;
    });

    rejectBtn.addEventListener("click", function () {
      writeConsent("rejected");
      box.hidden = true;
    });
  });
})();
