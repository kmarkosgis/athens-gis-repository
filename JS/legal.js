(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var openBtn = document.getElementById("legal-btn");
    if (!openBtn) return;

    // The policy has its own page (privacy.html, which reads info/legal.txt). It opens in a new tab,
    // the same as the "about" button, so the map and its layers stay as they are.
    openBtn.addEventListener("click", function (event) {
      event.stopPropagation();
      var win = window.open("privacy.html", "_blank");
      if (win) win.opener = null;
    });
  });
})();
