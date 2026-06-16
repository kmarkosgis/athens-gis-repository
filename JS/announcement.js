(function () {
  // Set to 1 to show the announcement box, 0 to hide it for everyone.
  var ANNOUNCEMENT_ENABLED = 1;

  // Add new announcements at the top. Newest entry first.
  var ANNOUNCEMENTS = [
    { date: '17/06/2026', text: 'Athens GIS Repository 1 year anniversary!' },
    { date: '16/06/2026', text: 'Domain change : athensgis.gr' },
    { date: '15/06/2026', text: 'Street Network layers added for all sectors (Road Network - Transportation).' },
    { date: '12/06/2026', text: '5 new KAEK layers added (KAEK - Urban Planning).' }
  ];

  function buildContent(box) {
    var h3 = document.createElement('h3');
    h3.textContent = 'NEWS - ANNOUNCEMENTS';
    var closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.id = 'closeAnnouncementBtn';
    closeBtn.innerHTML = '&times;';
    h3.appendChild(closeBtn);
    box.appendChild(h3);

    ANNOUNCEMENTS.forEach(function (item) {
      var p = document.createElement('p');
      var strong = document.createElement('strong');
      strong.textContent = item.date + ':';
      p.appendChild(strong);
      p.appendChild(document.createTextNode(' ' + item.text));
      box.appendChild(p);
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    var box = document.getElementById('announcement-box');
    if (!box) return;

    buildContent(box);

    var closeBtn = document.getElementById('closeAnnouncementBtn');
    if (!closeBtn) return;

    var STORAGE_KEY = 'announcementDismissedSignature';
    var signature = ANNOUNCEMENTS.map(function (item) {
      return item.date + '\x1f' + item.text;
    }).join('|');

    function hide() {
      box.hidden = true;
      box.setAttribute('aria-hidden', 'true');
    }

    function show() {
      box.hidden = false;
      box.setAttribute('aria-hidden', 'false');
    }

    if (ANNOUNCEMENT_ENABLED !== 1) {
      localStorage.removeItem(STORAGE_KEY);
      hide();
      return;
    }

    if (localStorage.getItem(STORAGE_KEY) === signature) {
      hide();
      return;
    }

    show();

    closeBtn.addEventListener('click', function () {
      localStorage.setItem(STORAGE_KEY, signature);
      hide();
    });
  });
})();
