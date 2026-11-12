// Welcome dialog, shared by the main map (index.html) and the 3D Viewer (3d-viewer.html).
// A native <dialog> opened with showModal(): it sits in the browser's top layer, above
// every other panel, and the page behind it is inert until it closes. Opens on every page
// load. Closes on the close buttons, ESC or a click on the dimmed backdrop; the info button
// (#openWelcome) opens it again. Focus returns to whatever had it before.
// When it closes, it fires "athensgis:welcome-closed" on document (the 3D Viewer's NOTE
// waits for it, so the two windows don't open on top of each other).
(function () {
  var modal = document.getElementById('welcomeModal');
  if (!modal) return;
  var box = document.getElementById('welcomeContent');
  var openBtn = document.getElementById('openWelcome');
  var lastFocus = null;
  var native = typeof modal.showModal === 'function';

  // The About page is served at /about in production and as about.html locally, the same
  // swap the footer's About link uses (isProductionSite comes from the inline script in <head>).
  if (typeof isProductionSite !== 'undefined' && !isProductionSite) {
    var aboutLinks = modal.querySelectorAll('.js-about-link');
    for (var i = 0; i < aboutLinks.length; i++) aboutLinks[i].setAttribute('href', 'about.html');
  }

  function isOpen() { return modal.hasAttribute('open'); }

  function open() {
    if (isOpen()) return;
    lastFocus = document.activeElement;
    if (native) modal.showModal(); else modal.setAttribute('open', '');
    if (openBtn) openBtn.setAttribute('aria-expanded', 'true');
    // Focus the dialog box itself (not a button), so screen readers start at its title and
    // mouse users don't get a focus ring on load; Tab then moves through its controls.
    if (box) box.focus({ preventScroll: true });
  }

  function close() {
    if (!isOpen()) return;
    if (native) modal.close(); else { modal.removeAttribute('open'); onClosed(); }
  }

  function onClosed() {
    if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
    if (lastFocus && typeof lastFocus.focus === 'function' && document.contains(lastFocus)) {
      lastFocus.focus({ preventScroll: true });
    }
    lastFocus = null;
    // Deferred, so the click or key that closed the dialog has finished before anything
    // else (the 3D NOTE) opens in response; otherwise its own "click outside" handler
    // would close it again straight away.
    setTimeout(function () {
      document.dispatchEvent(new CustomEvent('athensgis:welcome-closed'));
    }, 0);
  }
  modal.addEventListener('close', onClosed);

  var closers = modal.querySelectorAll('[data-welcome-close]');
  for (var c = 0; c < closers.length; c++) {
    closers[c].addEventListener('click', function (e) { e.stopPropagation(); close(); });
  }

  // The dialog fills the window and the box sits in its middle, so a click that lands on
  // the dialog element itself is a click on the dimmed area around the box.
  modal.addEventListener('click', function (e) {
    if (e.target === modal) close();
    e.stopPropagation();
  });

  // ESC: close through the same path, and keep the key from reaching other ESC handlers
  // (e.g. the 3D NOTE), so one press closes one window.
  modal.addEventListener('cancel', function (e) { e.preventDefault(); close(); });
  document.addEventListener('keydown', function (e) {
    if (!isOpen() || (e.key !== 'Escape' && e.key !== 'Esc')) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    close();
  }, true);

  if (openBtn) {
    openBtn.addEventListener('click', function (e) { e.stopPropagation(); open(); });
  }

  window.AthensGISWelcome = { open: open, close: close, isOpen: isOpen };

  // Every visit starts with the welcome - including a return with the Back button, where the
  // browser can restore the page from its cache without running this script again.
  open();
  window.addEventListener('pageshow', function (e) { if (e.persisted) open(); });
})();
