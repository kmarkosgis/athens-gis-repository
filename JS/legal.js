(function () {
  document.addEventListener("DOMContentLoaded", function () {
    var openBtn = document.getElementById("legal-btn");
    var modal = document.getElementById("legal-modal");
    var content = document.getElementById("legal-content");
    var closeBtn = document.getElementById("legal-close");

    if (!openBtn || !modal || !content || !closeBtn) return;

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
