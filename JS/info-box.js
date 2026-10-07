
// Info box formatting function for all layers
function formatFeatureProperties(properties) {
	var popupContent = '<table class="feature-properties-table">';
	var keyAliases = {
		'Κωδι_1': 'Code',
		'Επιπέ': 'Education Level',
		'Τύπος': 'Type',
		'Ονομα': 'Name (GR)',
		'Νομός': 'Regional Unit (GR)',
		'Δήμος': 'Municipality (GR)'
	};
	for (var key in properties) {
		var value = properties[key];
		var lowerKey = String(key || '').toLowerCase();
		var displayKey = key;
		if (Object.prototype.hasOwnProperty.call(keyAliases, key)) displayKey = keyAliases[key];
		else if (Object.prototype.hasOwnProperty.call(keyAliases, lowerKey)) displayKey = keyAliases[lowerKey];
		else if (lowerKey === 'shapeleng_') {
			value = Number(value).toFixed(2);
			displayKey = 'Shape Length (km)';
		} else if (lowerKey === 'shapearea') {
			value = Number(value).toFixed(2);
			displayKey = 'Shape Area (km²)';
		} else if (lowerKey === 'shapeleng_m' || lowerKey === 'shapelengm') {
			value = Number(value).toFixed(2);
			displayKey = 'Shape Length (m)';
		} else if (lowerKey === 'shapearea_m') {
			value = Number(value).toFixed(2);
			displayKey = 'Shape Area (m²)';
		} else if (lowerKey === 'name' || lowerKey === 'gname' || lowerKey === 'uses_gr') {
			displayKey = 'Name (GR)';
		} else if (lowerKey === 'name_en' || lowerKey === 'uses_en' || lowerKey === 'ename' || lowerKey === 'name:en') {
			displayKey = 'Name (ENG)';
		} else if (lowerKey === 'sectionnam') {
			displayKey = 'Section Name';
		} else if (lowerKey === 'metroline') {
			displayKey = 'Metro Line';
		} else if (lowerKey === 'highway') {
			displayKey = 'Type';
		} else if (lowerKey === 'oneway') {
			displayKey = 'One-Way Road';
		} else if (lowerKey === 'surface') {
			displayKey = 'Surface Type';
		} else if (lowerKey === 'fid' || lowerKey === 'objectid') {
			displayKey = 'Feature ID';
		} else if (lowerKey === 'popul2011') {
			displayKey = 'Population';
		} else if (lowerKey === 'wt') {
			displayKey = 'Wind Turbine';
		} else if (lowerKey === 'power_anem') {
			displayKey = 'Power (MW)';
		} else if (lowerKey === 'max_power') {
			displayKey = 'Max Power (MW)';
		} else if (lowerKey === 'diametros_') {
			displayKey = 'Diameter (m)';
		} else if (lowerKey === 'ypsos_pylo') {
			displayKey = 'Height (m)';
		} else if (lowerKey === 'initialdat') {
			displayKey = 'Initial Date';
		} else if (lowerKey === 'finaldate') {
			displayKey = 'Final Date';
		}
		popupContent += '<tr><th>' + displayKey + '</th><td>' + value + '</td></tr>';
	}
	popupContent += '</table>';
	return popupContent;
}
window.formatFeatureProperties = formatFeatureProperties;

// Provide a global updateInfoBox function for cross-module use
// Delegate update of the layer info UI to the newer tabbed implementation
window.updateInfoBox = function() {
	// If the tabbed ensureInfoBoxUpdate exists, use it
	if (typeof ensureInfoBoxUpdate === 'function') {
		try { ensureInfoBoxUpdate(); return; } catch (e) { /* fallthrough to fallback */ }
	}

	// Fallback: simple concatenation (kept for backwards compatibility)
	var infoBox = document.getElementById('layerInfoBox');
	var AthensGIS = window.AthensGIS || {};
	var activeLayerInfos = AthensGIS.activeLayerInfos || {};
	var content = '';
	for (var key in activeLayerInfos) {
		if (!Object.prototype.hasOwnProperty.call(activeLayerInfos, key)) continue;
		content += '<strong>' + key + '</strong><br>' + activeLayerInfos[key] + '<hr>';
	}
	if (content) {
		// Ensure the expected content container exists
		var contentEl = document.getElementById('layerInfoContent');
		if (contentEl) {
			contentEl.innerHTML = content;
		} else if (infoBox) {
			infoBox.innerHTML = content;
		}
		if (infoBox) infoBox.style.display = 'block';
	} else {
		if (infoBox) infoBox.style.display = 'none';
	}
};

// === Expandable attributes box (desktop only) ===
// Pairs with the .info-* rules in style.css. Above 900px #infoBox no longer scrolls:
// attributes that don't fit its max-height are hidden (whole rows only, never cut off
// mid-row) and an arrow appears at the left edge of the ATTRIBUTES title bar. Clicking
// it widens the box to the left and lays every attribute out in up to 3 columns; the
// arrow then sits at the right edge, facing right, and closes it again. At 900px and
// below nothing here applies - the original scrolling bottom-sheet is left as it was.
//
// Nothing writes to this module: whoever fills #infoContent (a feature click or a
// raster click in JS/layer-control.js) just sets its innerHTML as before, and the
// MutationObserver below picks the new table up and lays it out.
(function () {
	var DESKTOP = window.matchMedia('(min-width: 901px)');
	var MAX_COLS = 3;
	var COL_GAP = 18;               // keep in sync with .info-columns in style.css
	var COL_MAX_WIDTH = 300;        // px per column when there's room for it
	var COL_MIN_WIDTH = 230;        // narrower than this is cramped - use fewer columns instead
	var LAYER_PANEL_GAP = 10;       // clearance between the expanded box and the layer panel on its left
	var VIEWPORT_TOP_RESERVE = 60;  // header strip the expanded box must not climb into

	var box, content, btn, contentObserver, boxObserver;
	var baseTable = null;   // the table written into #infoContent
	var bodyEl = null;      // ...and the element its rows live in
	var rows = [];          // its <tr> nodes, in source order
	var colsEl = null;      // the 2-3 column wrapper while expanded
	var wantExpanded = false; // user's choice: survives clicking another feature, cleared when the box is hidden
	var dirty = false;      // content changed while the box was hidden - lay it out once it's shown
	var rafId = 0;

	function isHidden() { return getComputedStyle(box).display === 'none'; }

	function observe() {
		contentObserver.observe(content, { childList: true });
		boxObserver.observe(box, { attributes: true, attributeFilter: ['style'] });
	}
	function unobserve() {
		contentObserver.disconnect();
		boxObserver.disconnect();
	}

	function setButtonState(expanded, count) {
		// ❮ / ❯ are the same glyphs as the layer-info carousel's prev/next buttons
		btn.textContent = expanded ? '❯' : '❮';
		btn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
		var label = expanded ? 'Collapse attributes' : 'Show all ' + (count ? count + ' ' : '') + 'attributes';
		btn.title = label;
		btn.setAttribute('aria-label', label);
	}

	// New content = whatever sits in #infoContent isn't our own table / column wrapper.
	function adopt() {
		colsEl = null;
		var t = content.querySelector('table.feature-properties-table');
		baseTable = (t && content.children.length === 1) ? t : null;
		bodyEl = baseTable ? (baseTable.tBodies[0] || baseTable) : null;
		rows = baseTable ? Array.prototype.slice.call(baseTable.rows) : [];
	}

	function resetBox() {
		box.classList.remove('info-expanded', 'info-overflowing', 'info-scroll');
		box.style.width = '';
		box.style.maxHeight = '';
		setButtonState(false);
	}

	// Back to the plain one-table layout with every row visible, in source order.
	function showAllRowsInBase() {
		if (colsEl && colsEl.parentNode === content) content.replaceChild(baseTable, colsEl);
		colsEl = null;
		rows.forEach(function (r) {
			r.classList.remove('info-row-hidden');
			bodyEl.appendChild(r);
		});
	}

	// How many rows fit in the box's max-height, and each row's height (for balancing columns).
	function measure() {
		var boxRect = box.getBoundingClientRect();
		// #infoBox pops in with a scale() animation - work in the box's own unscaled units
		var scale = box.offsetHeight ? boxRect.height / box.offsetHeight : 1;
		var limit = box.clientHeight - (parseFloat(getComputedStyle(box).paddingBottom) || 0);
		var heights = [];
		var visible = 0;
		var overflow = false;
		rows.forEach(function (r) {
			var rect = r.getBoundingClientRect();
			heights.push(rect.height / scale);
			if ((rect.bottom - boxRect.top) / scale <= limit + 0.5) visible++;
			else overflow = true;
		});
		return { heights: heights, visible: Math.max(1, visible), overflow: overflow };
	}

	// Sequential, height-balanced split: column i holds the rows whose midpoint falls in
	// the i-th slice of the total height, so reading order stays top-to-bottom, left-to-right.
	function splitRows(heights, n) {
		var total = heights.reduce(function (a, b) { return a + b; }, 0);
		var target = total / n || 1;
		var groups = [];
		var acc = 0;
		heights.forEach(function (h, i) {
			var c = Math.min(n - 1, Math.max(0, Math.ceil((acc + h / 2) / target) - 1));
			while (groups.length <= c) groups.push([]);
			groups[c].push(i);
			acc += h;
		});
		return groups.filter(function (g) { return g.length; });
	}

	function collapse(fit) {
		for (var i = fit.visible; i < rows.length; i++) rows[i].classList.add('info-row-hidden');
		box.classList.add('info-overflowing');
		setButtonState(false, rows.length);
	}

	function expand(fit) {
		var cs = getComputedStyle(box);
		var contentPad = parseFloat(getComputedStyle(content).paddingLeft) || 0;
		var chrome = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0) +
			(parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0) + contentPad;
		var panel = document.getElementById('layerControl');
		var leftEdge = (panel && getComputedStyle(panel).display !== 'none') ? panel.getBoundingClientRect().right : 0;
		var rightGap = parseFloat(cs.right) || 10;
		var inner = window.innerWidth - rightGap - (leftEdge + LAYER_PANEL_GAP) - chrome;
		function colWidth(n) { return Math.floor((inner - (n - 1) * COL_GAP) / n); }

		// As many columns as it takes for the rows to fit the collapsed height (never fewer
		// than 2, never more than 3), fewer if the viewport has no room for them.
		var cols = Math.min(MAX_COLS, Math.max(2, Math.ceil(rows.length / fit.visible)));
		while (cols > 2 && colWidth(cols) < COL_MIN_WIDTH) cols--;
		var groups = splitRows(fit.heights, cols);
		cols = groups.length;
		var colW = Math.min(COL_MAX_WIDTH, colWidth(cols));

		var heightCap = Math.max(parseFloat(cs.maxHeight) || 0,
			window.innerHeight - (parseFloat(cs.bottom) || 0) - VIEWPORT_TOP_RESERVE);

		colsEl = document.createElement('div');
		colsEl.className = 'info-columns';
		colsEl.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
		groups.forEach(function (idxs) {
			var t = document.createElement('table');
			t.className = baseTable.className;
			idxs.forEach(function (i) { t.appendChild(rows[i]); });
			colsEl.appendChild(t);
		});
		content.replaceChild(colsEl, baseTable);

		// The split above used heights measured at the collapsed width; wrapped values reflow once
		// the columns are narrower, so re-balance once at the real column width. Only relative
		// heights matter here, so the pop-in scale() animation doesn't need compensating for.
		box.style.width = (cols * colW + (cols - 1) * COL_GAP + contentPad) + 'px';
		var fine = splitRows(rows.map(function (r) { return r.getBoundingClientRect().height; }), cols);
		if (fine.length === cols) {
			fine.forEach(function (idxs, c) {
				idxs.forEach(function (i) { colsEl.children[c].appendChild(rows[i]); });
			});
		}

		box.classList.add('info-expanded');
		box.style.maxHeight = heightCap + 'px';
		// Only ever true if even the widest layout is taller than the viewport allows
		if (box.scrollHeight > box.clientHeight + 1) box.classList.add('info-scroll');
		setButtonState(true, rows.length);
	}

	function layout() {
		if (!baseTable || isHidden()) { resetBox(); return; }
		unobserve(); // our own DOM/style changes below must not re-trigger the observers
		try {
			showAllRowsInBase();
			resetBox();
			if (!DESKTOP.matches) return; // 900px and below: the original box, untouched
			var fit = measure();
			if (!fit.overflow) return;    // everything fits - no arrow, no hidden rows
			if (wantExpanded) expand(fit); else collapse(fit);
		} finally {
			observe();
		}
	}

	function sync() {
		var first = content.firstElementChild;
		if (first !== baseTable && first !== colsEl) adopt();
		if (isHidden()) { dirty = true; return; }
		layout();
	}

	function onBoxStyle() {
		if (isHidden()) { wantExpanded = false; return; }
		if (dirty) { dirty = false; layout(); }
	}

	function init() {
		box = document.getElementById('infoBox');
		content = document.getElementById('infoContent');
		var title = box && box.querySelector('h3');
		if (!box || !content || !title || !window.MutationObserver) return;

		btn = document.createElement('button');
		btn.type = 'button';
		btn.id = 'infoExpandBtn';
		btn.className = 'info-expand-btn';
		btn.setAttribute('aria-controls', 'infoContent');
		title.appendChild(btn);
		setButtonState(false);
		btn.addEventListener('click', function () {
			wantExpanded = !wantExpanded;
			layout();
		});

		contentObserver = new MutationObserver(sync);
		boxObserver = new MutationObserver(onBoxStyle);
		observe();

		window.addEventListener('resize', function () {
			cancelAnimationFrame(rafId);
			rafId = requestAnimationFrame(function () {
				if (baseTable && !isHidden()) layout();
			});
		});
	}

	if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
	else init();
})();
