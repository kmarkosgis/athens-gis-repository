// Mobile only: keeps the DOI badge, the PeekWell badge and the live basemap
// attribution on one line - #footer .footer-credits in style.css, sitting between
// the toolbar and the footer's copyright line. CSS alone can size that row for a
// given phone width, but not for the attribution text, whose length changes with
// the basemap/active layers (JS/map-init.js on the main page, code_3D/map3d.js on
// the 3D Viewer, both just copy it in live) - so this measures the row's natural,
// unscaled width and shrinks it down (never up) to fit, however narrow the phone
// or however long that text currently is. Shared by index.html and 3d-viewer.html.
(function () {
  var mq = window.matchMedia('(max-width: 900px)');
  var SIDE_MARGIN = 16; // kept clear on each side of the viewport

  function strip() { return document.querySelector('#footer .footer-credits'); }

  function fit() {
    var el = strip();
    if (!el) return;
    if (!mq.matches) {
      // Desktop: no scaling. Leaving a stale transform here would turn this
      // element into a containing block for its children's desktop
      // position:absolute (any transform other than none does that), displacing
      // them from #footer's corners - so this must be cleared, not just unused.
      el.style.transform = '';
      return;
    }
    // offsetWidth is the row's own laid-out width, unaffected by any transform
    // already on it - safe to read without resetting first. Its children are
    // flex: 0 0 auto and the row itself doesn't wrap, so this is the row's
    // true, unshrunk width, even past what's currently visible.
    var natural = el.offsetWidth;
    if (!natural) return;
    var available = document.documentElement.clientWidth - SIDE_MARGIN;
    var scale = Math.min(1, available / natural);
    el.style.transform = 'translateX(-50%) scale(' + scale.toFixed(3) + ')';
  }

  function schedule() {
    if (window.requestAnimationFrame) requestAnimationFrame(fit); else fit();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', schedule);
  else schedule();

  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', function () { setTimeout(schedule, 150); });
  if (mq.addEventListener) mq.addEventListener('change', schedule);
  else if (mq.addListener) mq.addListener(schedule); // Safari < 14

  var attr = document.getElementById('map-attribution');
  if (attr && window.MutationObserver) {
    new MutationObserver(schedule).observe(attr, { childList: true, subtree: true, characterData: true });
  }
})();
