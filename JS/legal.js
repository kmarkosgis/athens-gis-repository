(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var openBtn = document.getElementById("legal-btn");
    var modal = document.getElementById("legal-modal");
    var content = document.getElementById("legal-content");
    var closeBtn = document.getElementById("legal-close");
    var body = document.getElementById("legal-body");

    if (!openBtn || !modal || !content || !closeBtn || !body) return;

    // Goes through the app's own CDN-aware asset loader (JS/layer-control.js)
    // when available, same as every dataset's info/*.txt, so this resolves the
    // same way on athensgis.gr/R2 as it does locally.
    var loadInfo = (typeof window.loadLayerInfo === 'function')
      ? window.loadLayerInfo
      : function (rel) {
        return fetch('info/' + rel).then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        });
      };
    loadInfo('legal.txt').then(function (html) {
      body.innerHTML = html;
    }).catch(function () {
      body.innerHTML = '<p>Legal information is temporarily unavailable.</p>';
    });

    function openModal() {
      modal.hidden = false;
      modal.setAttribute("aria-hidden", "false");
    }

    function closeModal() {
      modal.hidden = true;
      modal.setAttribute("aria-hidden", "true");
    }

    openBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      openModal();
    });

    closeBtn.addEventListener("click", function () {
      closeModal();
    });

    modal.addEventListener("click", function (event) {
      if (event.target === modal) closeModal();
    });

    content.addEventListener("click", function (event) {
      event.stopPropagation();
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && !modal.hidden) closeModal();
    });
  });
})();
