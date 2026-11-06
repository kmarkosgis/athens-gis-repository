// The NOTE button (next to CITE): opens a small window with the data sources, how precise
// the datasets are, and a note on performance. Closes on the X, ESC or a click outside.
(function () {
  var btn = document.getElementById('note-btn');
  var popup = document.getElementById('note-popup');
  var closeBtn = document.getElementById('note-close');
  if (!btn || !popup || !closeBtn) return;

  function setOpen(open) {
    popup.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
  }

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    setOpen(popup.hidden);
  });
  closeBtn.addEventListener('click', function () { setOpen(false); });
  popup.addEventListener('click', function (e) { e.stopPropagation(); });
  document.addEventListener('click', function () { if (!popup.hidden) setOpen(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });

  // Open when the page loads (the performance note is most useful before the map starts).
  setOpen(true);
})();
