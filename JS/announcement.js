(function () {
  // The announcements come from data/site-state.json, which the admin dashboard
  // writes. JS/site-state.js loads it and exposes window.AthensGIS.siteStateReady.

  function buildContent(box, items) {
    var h3 = document.createElement('h3');
    h3.textContent = 'NEWS - ANNOUNCEMENTS';
    var closeBtn = document.createElement('button');
    closeBtn.className = 'close-btn';
    closeBtn.id = 'closeAnnouncementBtn';
    closeBtn.innerHTML = '&times;';
    h3.appendChild(closeBtn);
    box.appendChild(h3);

    items.forEach(function (item) {
      var p = document.createElement('p');
      var strong = document.createElement('strong');
      strong.textContent = item.date + ':';
      p.appendChild(strong);
      p.appendChild(document.createTextNode(' ' + item.text));
      box.appendChild(p);
    });
  }

  // Keep only entries that have text; date falls back to an empty string.
  function cleanItems(list) {
    if (!Array.isArray(list)) return [];
    return list.filter(function (item) {
      return item && typeof item === 'object' && typeof item.text === 'string' && item.text !== '';
    }).map(function (item) {
      return { date: typeof item.date === 'string' ? item.date : '', text: item.text };
    });
  }

  var domReady = new Promise(function (resolve) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { resolve(); });
    } else {
      resolve();
    }
  });

  var AthensGIS = window.AthensGIS || {};
  var stateReady = AthensGIS.siteStateReady || Promise.resolve(null);

  Promise.all([domReady, stateReady]).then(function (results) {
    var state = results[1];
    var box = document.getElementById('announcement-box');
    if (!box) return;

    var STORAGE_KEY = 'announcementDismissedSignature';

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

    var announcements = state && state.announcements;

    if (announcements && announcements.enabled === false) {
      localStorage.removeItem(STORAGE_KEY);
      hide();
      return;
    }

    var items = announcements && announcements.enabled === true ? cleanItems(announcements.items) : [];
    if (items.length === 0) {
      hide();
      return;
    }

    buildContent(box, items);

    var closeBtn = document.getElementById('closeAnnouncementBtn');
    if (!closeBtn) return;

    var signature = items.map(function (item) {
      return item.date + '\x1f' + item.text;
    }).join('|');

    if (localStorage.getItem(STORAGE_KEY) === signature) {
      hide();
      return;
    }

    show();

    closeBtn.addEventListener('click', function () {
      localStorage.setItem(STORAGE_KEY, signature);
      hide();
    });
  }).catch(function () {
    // Announcements are optional; a failure here must not affect the page.
  });
})();
