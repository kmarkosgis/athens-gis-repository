// Guided tour of the main map: five short tasks, started from the welcome dialog's
// "Take the tour" button. A small card sits beside the control each step is about,
// an ochre ring marks that control, and the map stays usable the whole time - the card
// moves on by itself once the visitor has done the task (Next / Back / Skip are always
// there too). Esc or the X closes it.
//
// Clicks are watched in the capture phase: several of the targets (DOWNLOAD, CITE, the
// toolbar buttons) stop their click from bubbling. The ring is a fixed overlay on <body>
// rather than an outline on the target, because the layer panel clips anything drawn
// outside its rows.
(function () {
  var startBtn = document.getElementById('startTour');
  if (!startBtn) return;

  function q(sel) { return document.querySelector(sel); }
  function visible(el) {
    if (!el) return false;
    var r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  }

  // ── Steps ────────────────────────────────────────────────────────────────
  // target(): the element to ring and place the card beside.
  // status(): an optional progress line. done(): true once the task is complete.
  var layersOnThisStep = {};
  var STEPS = [
    {
      title: 'Switch on three layers',
      text: 'Open a category in the Layers panel and switch on any three layers with their switches. Each one is drawn on the map as it loads.',
      target: function () { return q('#layerControl'); },
      enter: function () { layersOnThisStep = {}; },
      status: function () {
        var n = Object.keys(layersOnThisStep).length;
        return Math.min(n, 3) + ' of 3 layers on';
      },
      done: function () { return Object.keys(layersOnThisStep).length >= 3; }
    },
    {
      title: 'Search for a layer',
      text: 'Type a word in the search box at the bottom of the map, such as "metro" or "parks", and pick a result. The layer is switched on and the map moves to it.',
      target: function () { return q('#datasetSearchWidget'); },
      // The results list opens upward from the box; keep the card clear of it.
      also: function () { var r = q('#datasetSearchResults'); return r && r.classList.contains('open') ? r : null; },
      enter: function () {
        // The box also has a second mode; make sure it is searching.
        var toggle = q('#datasetSearchModeToggle');
        if (toggle && toggle.getAttribute('aria-pressed') === 'true') toggle.click();
      }
    },
    {
      title: 'Change opacity or draw order',
      text: 'In the Toolbar, open Opacity to make a layer see-through, or Draw order to choose which layer sits on top.',
      target: function () { return q('.toolbar-row2') || q('#toolbar'); }
    },
    {
      title: 'Download a layer',
      text: 'Every layer that is on shows a DOWNLOAD button on its card in the Layers panel. Press it to save that layer as a ZIP file.',
      target: function () {
        var btns = document.querySelectorAll('.layer-item.selected .download-button');
        for (var i = 0; i < btns.length; i++) if (visible(btns[i])) return btns[i];
        return q('#layerControl');
      },
      // The button is inside the panel; put the card beside the panel, not over it.
      beside: function () { return q('#layerControl'); },
      status: function () {
        return document.querySelector('.layer-item.selected') ? '' : 'Switch a layer on first, then press DOWNLOAD on its card.';
      }
    },
    {
      title: 'Cite the repository',
      text: 'Using the data in your work? Press CITE for a ready-made citation in the style you need, with a button to copy it.',
      target: function () { return q('#citation-btn'); },
      // Keep the card clear of the citation window once it opens.
      also: function () { var p = q('#citation-popup'); return p && !p.hidden ? p : null; }
    }
  ];

  // ── Markup ───────────────────────────────────────────────────────────────
  var ring = document.createElement('div');
  ring.className = 'tour-ring';
  ring.setAttribute('aria-hidden', 'true');
  ring.hidden = true;

  var card = document.createElement('section');
  card.className = 'tour-card';
  card.setAttribute('role', 'dialog');
  card.setAttribute('aria-modal', 'false');
  card.setAttribute('aria-labelledby', 'tourTitle');
  card.hidden = true;
  card.innerHTML =
    '<div class="tour-head">' +
      '<p class="tour-count" id="tourCount"></p>' +
      '<ol class="tour-progress" aria-hidden="true">' + STEPS.map(function () { return '<li></li>'; }).join('') + '</ol>' +
      '<button type="button" class="tour-close" aria-label="Close the tour">' +
        '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="M6 6l12 12M18 6 6 18"/></svg>' +
      '</button>' +
    '</div>' +
    '<h2 class="tour-title" id="tourTitle" tabindex="-1"></h2>' +
    '<p class="tour-text"></p>' +
    '<p class="tour-status" aria-live="polite"></p>' +
    '<div class="tour-foot">' +
      '<button type="button" class="tour-back">Back</button>' +
      '<button type="button" class="tour-next">Next</button>' +
    '</div>';
  document.body.appendChild(ring);
  document.body.appendChild(card);

  var countEl = card.querySelector('.tour-count');
  var dots = card.querySelectorAll('.tour-progress li');
  var titleEl = card.querySelector('.tour-title');
  var textEl = card.querySelector('.tour-text');
  var statusEl = card.querySelector('.tour-status');
  var backBtn = card.querySelector('.tour-back');
  var nextBtn = card.querySelector('.tour-next');

  // Clicks inside the card must not reach the page's "click outside" handlers, which
  // would close the citation or draw-order window the visitor has just opened.
  card.addEventListener('click', function (e) { e.stopPropagation(); });
  card.querySelector('.tour-close').addEventListener('click', stop);
  backBtn.addEventListener('click', function () { go(index - 1); });
  nextBtn.addEventListener('click', function () {
    if (index >= STEPS.length - 1) stop(); else go(index + 1);
  });

  // ── State ────────────────────────────────────────────────────────────────
  var index = -1;
  var completed = false;
  var advanceTimer = null;
  var raf = null;

  function running() { return index >= 0; }

  // What the tour changes but shouldn't keep: the recent-layers list and the search
  // box's mode. Saved when the tour starts, put back when it ends.
  var RECENT_KEY = 'athensgis.recentLayers';
  var before = null;

  function snapshot() {
    var recent = null;
    try { recent = localStorage.getItem(RECENT_KEY); } catch (e) { /* storage blocked */ }
    var toggle = q('#datasetSearchModeToggle');
    before = { recent: recent, otherMode: !!(toggle && toggle.getAttribute('aria-pressed') === 'true') };
  }

  // Put the map back as it was on arrival, so the visitor starts exploring from a clean
  // slate: every layer off (which also clears legends and the info box), opacity back to
  // 100%, groups collapsed, windows closed, search cleared, the starting view.
  function resetMap() {
    var ag = window.AthensGIS || {};

    var closeAll = q('#closeAllLayersBtn');
    if (closeAll && document.querySelector('.layer-item input[type=checkbox]:checked')) closeAll.click();

    if (ag.layerOpacities) {
      Object.keys(ag.layerOpacities).forEach(function (k) { delete ag.layerOpacities[k]; });
    }
    if (ag.layerPopup && ag.layerPopup.close) ag.layerPopup.close();

    var cite = q('#citation-popup');
    if (cite && !cite.hidden) { var citeClose = q('#citation-close'); if (citeClose) citeClose.click(); }

    var collapse = q('#collapseAllBtn');
    if (collapse && collapse.classList.contains('is-active')) collapse.click();
    var panel = q('#layerControl');
    if (panel) panel.scrollTop = 0;

    var input = q('#datasetSearchInput');
    var clear = q('#datasetSearchClear');
    if (input && input.value && clear) { clear.click(); input.blur(); }

    if (before) {
      var toggle = q('#datasetSearchModeToggle');
      var nowOther = !!(toggle && toggle.getAttribute('aria-pressed') === 'true');
      if (toggle && nowOther !== before.otherMode) toggle.click();
      try {
        if (before.recent === null) localStorage.removeItem(RECENT_KEY);
        else localStorage.setItem(RECENT_KEY, before.recent);
      } catch (e) { /* storage blocked */ }
      if (window.AthensGISRecentLayers && window.AthensGISRecentLayers.render) window.AthensGISRecentLayers.render();
      before = null;
    }

    if (ag.map && ag.map.setView) ag.map.setView([37.98, 23.72], 12); // the view the map opens on (map-init.js)
  }

  function start() {
    if (!running()) snapshot();
    var welcome = window.AthensGISWelcome;
    if (welcome && welcome.isOpen()) welcome.close();
    // Next tick: the dialog's close handler hands focus back first.
    setTimeout(function () {
      card.hidden = false;
      ring.hidden = false;
      go(0);
      if (!raf) track(); // already following targets if the tour was restarted
    }, 0);
  }

  function stop() {
    if (!running()) return;
    clearTimeout(advanceTimer);
    if (raf) cancelAnimationFrame(raf);
    raf = null;
    index = -1;
    card.hidden = true;
    ring.hidden = true;
    resetMap();
  }

  function go(i) {
    clearTimeout(advanceTimer);
    index = Math.max(0, Math.min(STEPS.length - 1, i));
    completed = false;
    var step = STEPS[index];
    if (step.enter) step.enter();

    countEl.textContent = 'Step ' + (index + 1) + ' of ' + STEPS.length;
    for (var d = 0; d < dots.length; d++) {
      dots[d].className = d < index ? 'is-past' : (d === index ? 'is-now' : '');
    }
    titleEl.textContent = step.title;
    textEl.textContent = step.text;
    backBtn.hidden = index === 0;
    nextBtn.textContent = index === STEPS.length - 1 ? 'Finish' : 'Next';
    card.classList.remove('is-done');
    refreshStatus();
    place();
    titleEl.focus({ preventScroll: true });
  }

  function refreshStatus() {
    var step = STEPS[index];
    if (completed) return;
    var msg = step.status ? step.status() : '';
    if (statusEl.textContent !== msg) statusEl.textContent = msg; // no repeat announcements
    if (step.done && step.done()) complete();
  }

  // The task for this step is done: say so, then move on after a short beat.
  function complete() {
    if (!running() || completed) return;
    completed = true;
    card.classList.add('is-done');
    var last = index === STEPS.length - 1;
    statusEl.textContent = last ? 'Done. You have finished the tour.' : 'Done';
    if (last) { nextBtn.textContent = 'Finish'; return; }
    var from = index;
    advanceTimer = setTimeout(function () { if (index === from) go(index + 1); }, 1100);
  }

  // ── Watching what the visitor does ──────────────────────────────────────
  document.addEventListener('change', function (e) {
    if (!running()) return;
    var cb = e.target;
    if (!cb || cb.type !== 'checkbox' || !cb.closest || !cb.closest('.layer-item')) return;
    if (index === 0) {
      if (cb.checked) layersOnThisStep[cb.id] = true; else delete layersOnThisStep[cb.id];
    }
    refreshStatus();
    place();
  }, true);

  document.addEventListener('athensgis:dataset-selected', function () {
    if (running() && index === 1) complete();
  });

  document.addEventListener('click', function (e) {
    if (!running() || !e.target.closest) return;
    var t = e.target;
    if (index === 2 && t.closest('#opacityBtn, #drawOrderBtn')) complete();
    else if (index === 3 && t.closest('.download-button')) complete();
    else if (index === 4 && t.closest('#citation-btn')) complete();
  }, true);

  // Esc closes the tour only while focus is in the card, so Esc in the search box or
  // the citation window keeps doing its own job.
  card.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' || e.key === 'Esc') { e.stopPropagation(); stop(); }
  });

  // ── Placement ───────────────────────────────────────────────────────────
  // Ring around the target; card beside it - right, left, above or below, the first
  // side with room - kept inside the window.
  var GAP = 14, EDGE = 10;
  var lastKey = '';

  function place() {
    if (!running()) return;
    var step = STEPS[index];
    var target = step.target();
    if (!visible(target)) {
      // Target hidden (e.g. a panel closed on a small screen): park the card at the bottom.
      ring.hidden = true;
      lastKey = '';
      card.style.left = Math.max(10, Math.round((window.innerWidth - card.offsetWidth) / 2)) + 'px';
      card.style.top = Math.max(50, window.innerHeight - card.offsetHeight - 40) + 'px';
      return;
    }
    var r = target.getBoundingClientRect();
    var extra = step.also && step.also();
    if (visible(extra)) {
      var e = extra.getBoundingClientRect();
      r = {
        left: Math.min(r.left, e.left), top: Math.min(r.top, e.top),
        right: Math.max(r.right, e.right), bottom: Math.max(r.bottom, e.bottom)
      };
      r.width = r.right - r.left; r.height = r.bottom - r.top;
    }
    var vw = window.innerWidth, vh = window.innerHeight;
    var cw = card.offsetWidth, ch = card.offsetHeight;

    var key = [index, Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height), vw, vh, cw, ch].join(',');
    if (key === lastKey) return;
    lastKey = key;

    ring.hidden = false;
    var pad = 4;
    ring.style.left = (r.left - pad) + 'px';
    ring.style.top = (r.top - pad) + 'px';
    ring.style.width = (r.width + pad * 2) + 'px';
    ring.style.height = (r.height + pad * 2) + 'px';

    var side = step.beside && step.beside();
    if (visible(side)) {
      var s = side.getBoundingClientRect();
      r = { left: Math.min(r.left, s.left), right: Math.max(r.right, s.right), top: r.top, bottom: r.bottom };
      r.width = r.right - r.left; r.height = r.bottom - r.top;
    }

    var x, y;
    if (r.right + GAP + cw <= vw - EDGE) {
      x = r.right + GAP; y = r.top;
    } else if (r.left - GAP - cw >= EDGE) {
      x = r.left - GAP - cw; y = r.top;
    } else if (r.top - GAP - ch >= EDGE) {
      x = r.left + r.width / 2 - cw / 2; y = r.top - GAP - ch;
    } else {
      x = r.left + r.width / 2 - cw / 2; y = r.bottom + GAP;
    }
    x = Math.max(EDGE, Math.min(x, vw - cw - EDGE));
    y = Math.max(EDGE + 40, Math.min(y, vh - ch - EDGE - 20));
    card.style.left = Math.round(x) + 'px';
    card.style.top = Math.round(y) + 'px';
  }

  // Targets move (panels scroll, groups open, rows expand), so follow them each frame
  // while the tour runs; place() returns early when nothing changed.
  function track() {
    if (!running()) return;
    place();
    if (index === 3 && !completed) refreshStatus();
    raf = requestAnimationFrame(track);
  }

  startBtn.addEventListener('click', function (e) { e.stopPropagation(); start(); });
  window.AthensGISTour = { start: start, stop: stop };
})();
