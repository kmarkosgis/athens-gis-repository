// Keeps the cookie-consent box 10px below the header's actual bottom edge.
// JS/cookies.js positions it relative to #announcement-box (main page only) and
// falls back to a fixed 50px otherwise - too little here, where the header holds a
// longer title and the "3D Viewer" badge and so is taller. Runs after cookies.js
// (later in the HTML, so its own update always lands last) and keeps watching the
// header's height with a ResizeObserver, since it changes at the mobile breakpoint.
(function () {
  var box = document.getElementById('cookie-consent-box');
  var header = document.querySelector('header');
  if (!box || !header) return;

  function update() {
    var top = Math.round(header.getBoundingClientRect().bottom + 10);
    box.style.setProperty('--cookie-top', top + 'px');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', update);
  } else {
    update();
  }
  window.addEventListener('resize', update);
  if (window.ResizeObserver) new ResizeObserver(update).observe(header);
})();
