(function () {
  // Set to 1 to show the announcement box, 0 to hide it for everyone.
  var ANNOUNCEMENT_ENABLED = 1;

  // Add new announcements at the top. Newest entry first.
  var ANNOUNCEMENTS = [
    { date: '14/10/2026', text: 'Dominant leaf type and Street Trees added (Environment - Vegetation & Urban Planning - Land Cover).' },
    { date: '30/09/2026', text: '2021 Population Census Density added (Population and social conditions).' },
    { date: '16/09/2026', text: 'AI assistant "Athena" added. Shaded Relief layer added. Major performance improvements.' },
    { date: '09/09/2026', text: 'Charging stations added (Points of Interest - Commerce).' },
        
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
      document.body.classList.add('announcement-hidden');
    }

    function show() {
      box.hidden = false;
      box.setAttribute('aria-hidden', 'false');
      document.body.classList.remove('announcement-hidden');
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
