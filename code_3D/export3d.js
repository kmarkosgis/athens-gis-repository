// Export for the 3D map: the same Landscape 5:4 / Portrait 4:5 menu as the main page.
// Builds a PNG page from the current 3D view: a header band with the logo and title,
// the map (cropped from the WebGL canvas to fit), a north arrow that follows the
// bearing, the building-height legend when coloring is on, and the attribution.
(function () {
  var ns = window.Athens3D = window.Athens3D || {};
  var map = ns.map;
  var btn = document.getElementById('exportBtn');
  if (!map || !btn) return;

  var FONT = '"Avenir Next", Avenir, "Helvetica Neue", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  var SLATE = 'rgb(55, 65, 81)';
  var PAGE = { long: 1300, short: 1040 };   // same page size as the main page's export
  var MARGIN = 16, HEADER = 84, FOOTER = 34;

  // ---------- Menu ----------
  var menu = document.createElement('ul');
  menu.id = 'exportSizeMenu';
  [
    { id: 'landscape', title: 'Landscape 5:4', icon: '<svg width="27" height="22" viewBox="0 0 27 22" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="1" y="1" width="25" height="20" rx="2" ry="2" fill="#ffffff" stroke="#2c3e50" stroke-width="1.5"/><line x1="4" y1="5" x2="23" y2="5" stroke="#2c3e50" stroke-width="1" stroke-linecap="round"/></svg>' },
    { id: 'portrait', title: 'Portrait 4:5', icon: '<svg width="22" height="27" viewBox="0 0 22 27" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="1" y="1" width="20" height="25" rx="2" ry="2" fill="#ffffff" stroke="#2c3e50" stroke-width="1.5"/><line x1="4" y1="6" x2="18" y2="6" stroke="#2c3e50" stroke-width="1" stroke-linecap="round"/></svg>' }
  ].forEach(function (m) {
    var li = document.createElement('li');
    li.title = m.title;
    li.setAttribute('aria-label', m.title);
    li.innerHTML = m.icon;
    li.addEventListener('click', function (e) {
      e.stopPropagation();
      hideMenu();
      runExport(m.id);
    });
    menu.appendChild(li);
  });
  document.body.appendChild(menu);

  function showMenu() {
    var r = btn.getBoundingClientRect();
    menu.classList.add('open');
    var mr = menu.getBoundingClientRect();
    var left = Math.max(8, r.left + r.width / 2 - mr.width / 2);
    var top = r.top - mr.height - 8;
    if (top < 8) top = r.bottom + 8;
    menu.style.left = left + 'px';
    menu.style.top = top + 'px';
  }
  function hideMenu() { menu.classList.remove('open'); }

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    if (ns.loading.isLocked()) return;
    if (menu.classList.contains('open')) hideMenu(); else showMenu();
  });
  document.addEventListener('click', hideMenu);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideMenu(); });

  // ---------- Helpers ----------
  function loadImage(src) {
    return new Promise(function (resolve) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  function whenIdle() {
    return new Promise(function (resolve) {
      if (map.loaded() && map.areTilesLoaded()) { resolve(); return; }
      map.once('idle', resolve);
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function setSpacing(ctx, px) { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; }

  // The map doesn't keep its drawing buffer between frames, so the canvas is only
  // readable right after a render: copy it then, in the same task.
  function snapshotMap() {
    return new Promise(function (resolve) {
      var done = false;
      function grab() {
        if (done) return;
        done = true;
        map.off('render', grab);
        var src = map.getCanvas();
        var copy = document.createElement('canvas');
        copy.width = src.width;
        copy.height = src.height;
        copy.getContext('2d').drawImage(src, 0, 0);
        resolve(copy);
      }
      map.on('render', grab);
      map.triggerRepaint();
    });
  }

  // Draws the map snapshot into the frame, cropped from its centre to the frame's shape.
  function drawMap(ctx, frame, src) {
    var sw = src.width, sh = src.height;
    var frameAspect = frame.w / frame.h;
    var cw = sw, ch = sw / frameAspect;
    if (ch > sh) { ch = sh; cw = sh * frameAspect; }
    var cx = (sw - cw) / 2, cy = (sh - ch) / 2;
    ctx.save();
    roundRect(ctx, frame.x, frame.y, frame.w, frame.h, 10);
    ctx.clip();
    ctx.drawImage(src, cx, cy, cw, ch, frame.x, frame.y, frame.w, frame.h);
    ctx.restore();
  }

  function drawHeader(ctx, W, logo) {
    var g = ctx.createLinearGradient(0, 0, W, HEADER);
    g.addColorStop(0, 'rgb(75, 86, 105)');
    g.addColorStop(0.5, SLATE);
    g.addColorStop(1, 'rgb(40, 48, 61)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, HEADER);

    var x = MARGIN + 4;
    if (logo) {
      var lh = 56, lw = logo.naturalWidth * (lh / logo.naturalHeight);
      ctx.drawImage(logo, x, (HEADER - lh) / 2, lw, lh);
      x += lw + 18;
    }
    ctx.fillStyle = '#f6f7f5';
    ctx.textBaseline = 'middle';
    ctx.font = '500 26px ' + FONT;
    setSpacing(ctx, 2);
    ctx.fillText('ATHENS GIS REPOSITORY 3D VIEWER', x, HEADER / 2);

    ctx.font = '400 14px ' + FONT;
    setSpacing(ctx, 1);
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(246, 247, 245, 0.8)';
    ctx.fillText(new Date().toLocaleDateString('en-GB'), W - MARGIN - 4, HEADER / 2);
    ctx.textAlign = 'left';
    setSpacing(ctx, 0);
  }

  function drawNorthArrow(ctx, frame) {
    var r = 24, cx = frame.x + frame.w - r - 14, cy = frame.y + r + 14;
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.shadowColor = 'rgba(0,0,0,0.3)';
    ctx.shadowBlur = 6;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.translate(cx, cy);
    ctx.rotate(-map.getBearing() * Math.PI / 180);
    ctx.fillStyle = '#c0392b';
    ctx.beginPath(); ctx.moveTo(0, -17); ctx.lineTo(6, 0); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = SLATE;
    ctx.beginPath(); ctx.moveTo(0, 17); ctx.lineTo(6, 0); ctx.lineTo(-6, 0); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.fillStyle = SLATE;
    ctx.font = '600 11px ' + FONT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('N', cx, cy + r + 4);
    ctx.restore();
  }

  function drawLegend(ctx, frame) {
    var style = ns.buildingsStyle;
    if (!style || !style.isColored()) return;
    var items = style.legendItems().reverse();
    var pad = 12, row = 22, sw = 26, title = 26;
    ctx.font = '400 14px ' + FONT;
    var textW = 0;
    items.forEach(function (it) { textW = Math.max(textW, ctx.measureText(it.label).width); });
    var w = Math.max(170, pad * 2 + sw + 10 + textW);
    var h = pad * 2 + title + items.length * row;
    var x = frame.x + 14, y = frame.y + frame.h - h - 14;

    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.25)';
    ctx.shadowBlur = 6;
    ctx.fillStyle = 'rgba(255,255,255,0.93)';
    roundRect(ctx, x, y, w, h, 10);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = SLATE;
    ctx.textBaseline = 'middle';
    ctx.font = '600 14px ' + FONT;
    setSpacing(ctx, 1);
    ctx.fillText('BUILDING HEIGHT', x + pad, y + pad + 9);
    setSpacing(ctx, 0);
    ctx.font = '400 14px ' + FONT;
    items.forEach(function (it, i) {
      var ry = y + pad + title + i * row;
      ctx.fillStyle = it.color;
      ctx.fillRect(x + pad, ry + 3, sw, row - 6);
      ctx.strokeStyle = 'rgba(55,65,81,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(x + pad + 0.5, ry + 3.5, sw - 1, row - 7);
      ctx.fillStyle = 'rgb(17, 24, 39)';
      ctx.fillText(it.label, x + pad + sw + 10, ry + row / 2);
    });
  }

  function drawFooter(ctx, W, H) {
    var attrEl = document.getElementById('map-attribution');
    var attr = attrEl ? attrEl.textContent.replace(/\s+/g, ' ').trim() : '';
    ctx.fillStyle = SLATE;
    ctx.textBaseline = 'middle';
    ctx.font = '400 13px ' + FONT;
    var y = H - FOOTER / 2 - 2;
    var left = '© ' + new Date().getFullYear() + ' Athens GIS Repository | CC-BY 4.0 | athensgis.gr';
    ctx.textAlign = 'left';
    ctx.fillText(left, MARGIN, y);
    // Shrink the attribution until it fits beside the copyright line.
    var room = W - 2 * MARGIN - ctx.measureText(left).width - 24;
    var size = 13;
    while (size > 8 && ctx.measureText(attr).width > room) {
      size -= 1;
      ctx.font = '400 ' + size + 'px ' + FONT;
    }
    ctx.textAlign = 'right';
    ctx.fillText(attr, W - MARGIN, y);
    ctx.textAlign = 'left';
  }

  function download(canvas, name) {
    return new Promise(function (resolve) {
      canvas.toBlob(function (blob) {
        if (!blob) { resolve(); return; }
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(function () { URL.revokeObjectURL(url); }, 2000);
        resolve();
      }, 'image/png');
    });
  }

  // ---------- Export ----------
  function runExport(mode) {
    var landscape = mode !== 'portrait';
    var W = landscape ? PAGE.long : PAGE.short;
    var H = landscape ? PAGE.short : PAGE.long;
    ns.loading.start('export');

    Promise.all([whenIdle(), loadImage('images/63.png')]).then(function (r) {
      return snapshotMap().then(function (shot) { return [shot, r[1]]; });
    }).then(function (r) {
      var shot = r[0], logo = r[1];
      var canvas = document.createElement('canvas');
      canvas.width = W;
      canvas.height = H;
      var ctx = canvas.getContext('2d');

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, W, H);
      drawHeader(ctx, W, logo);

      var frame = { x: MARGIN, y: HEADER + MARGIN, w: W - 2 * MARGIN, h: H - HEADER - 2 * MARGIN - FOOTER + 8 };
      drawMap(ctx, frame, shot);
      drawNorthArrow(ctx, frame);
      drawLegend(ctx, frame);
      drawFooter(ctx, W, H);

      return download(canvas, 'Athens_3D_' + (landscape ? 'Landscape' : 'Portrait') + '.png');
    }).catch(function (err) {
      console.error('[3D] Export failed', err);
      if (ns.notice) ns.notice('Export failed - please try again.');
    }).then(function () {
      ns.loading.stop('export');
    });
  }

  ns.exportMap = runExport;
})();
