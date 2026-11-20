// UI logic for menu button, welcome modal, and mobile layer panel

// The two sheets of the narrow layout (900px and below, the breakpoint in style.css):
// the Layers sheet behind #menuBtn, and the Legend + Layer information sheet (#keyPanels)
// behind #keyPanelsBtn. They share one spot on screen, so opening one closes the other.
var NARROW_LAYOUT = window.matchMedia('(max-width: 900px)');

function isLayersSheetOpen() {
	return document.getElementById('layerControl').style.display === 'block';
}
function setLayersSheet(open) {
	var layerControl = document.getElementById('layerControl');
	var menuBtn = document.getElementById('menuBtn');
	var menuIcon = document.getElementById('menuIcon');
	layerControl.style.display = open ? 'block' : 'none';
	menuIcon.textContent = open ? '✕' : '☰';
	menuIcon.classList.toggle('animated', open);
	menuBtn.setAttribute('aria-expanded', String(open));
	menuBtn.setAttribute('aria-label', open ? 'Hide layers' : 'Show layers');
}
function isKeyPanelsOpen() {
	var panels = document.getElementById('keyPanels');
	return !!panels && panels.classList.contains('open');
}
function setKeyPanels(open) {
	var panels = document.getElementById('keyPanels');
	var btn = document.getElementById('keyPanelsBtn');
	if (!panels || !btn) return;
	panels.classList.toggle('open', open);
	btn.setAttribute('aria-expanded', String(open));
}

// Leaving the narrow layout (a window widened, a tablet turned): the Layers panel is
// always shown there, so drop the sheet's inline display and reset both buttons.
(function () {
	function onLayoutChange(e) {
		if (e.matches) return;
		setLayersSheet(false);
		document.getElementById('layerControl').style.display = '';
		setKeyPanels(false);
	}
	if (NARROW_LAYOUT.addEventListener) NARROW_LAYOUT.addEventListener('change', onLayoutChange);
	else if (NARROW_LAYOUT.addListener) NARROW_LAYOUT.addListener(onLayoutChange);
})();

// Menu button toggles the Layers sheet and animates its icon
document.getElementById('menuBtn').addEventListener('click', function() {
	var open = !isLayersSheetOpen();
	if (open) setKeyPanels(false);
	setLayersSheet(open);
});

(function () {
	var btn = document.getElementById('keyPanelsBtn');
	if (!btn) return;
	btn.addEventListener('click', function () {
		var open = !isKeyPanelsOpen();
		if (open && isLayersSheetOpen()) setLayersSheet(false);
		setKeyPanels(open);
	});
	// The button only exists while a layer is on (body.layer-info-open, set by
	// ensureInfoBoxUpdate() in JS/layer-control.js); close the sheet with the last layer.
	if (window.MutationObserver) {
		new MutationObserver(function () {
			if (!document.body.classList.contains('layer-info-open')) setKeyPanels(false);
		}).observe(document.body, { attributes: true, attributeFilter: ['class'] });
	}
	document.addEventListener('keydown', function (e) {
		if (e.key !== 'Escape' || !isKeyPanelsOpen() || document.querySelector('dialog[open]')) return;
		setKeyPanels(false);
		btn.focus();
	});
})();

// For JS/layer-control.js: a layer that failed to load says so in its row, which on the
// narrow layout is inside the Layers sheet - open it so the note is seen.
window.AthensGIS = window.AthensGIS || {};
window.AthensGIS.showLayersSheet = function () {
	if (!NARROW_LAYOUT.matches || isLayersSheetOpen()) return;
	setKeyPanels(false);
	setLayersSheet(true);
};

// Ensure consistent vertical gaps between floating boxes:
// - `infoBox` bottom border is always 10px above top of `layerInfoBox`
// - `legend-bar` bottom is always 10px above top of `infoBox`
var _spacingTimer;
function updateFloatingBoxSpacing() {
	clearTimeout(_spacingTimer);
	_spacingTimer = setTimeout(_doUpdateFloatingBoxSpacing, 100);
}
function _doUpdateFloatingBoxSpacing() {
	try {
		const layer = document.getElementById('layerInfoBox');
		const info = document.getElementById('infoBox');
		const legend = document.getElementById('legend-bar');
		if (!layer || !info || !legend) return;
		// Narrow layout: the legend and layer information sit inside the #keyPanels sheet and
		// the attributes box has its own fixed spot (style.css), so nothing is stacked here.
		if (NARROW_LAYOUT.matches) {
			info.style.bottom = '';
			legend.style.maxHeight = '';
			return;
		}

		const layerCS = getComputedStyle(layer);
		const layerBottom = parseFloat(layerCS.bottom) || 30; // px
		const layerHeight = layer.offsetHeight;

		// Position infoBox so its bottom border sits 10px above layerInfoBox top
		const infoBottomPx = Math.max(10, layerHeight + layerBottom + 10);
		info.style.bottom = infoBottomPx + 'px';

		// Now compute infoBox top coordinate
		const infoCS = getComputedStyle(info);
		const infoBottom = parseFloat(infoCS.bottom) || infoBottomPx;
		const infoHeight = info.offsetHeight;
		const infoTop = window.innerHeight - infoHeight - infoBottom;

		// Compute available vertical space for legend-bar: keep its bottom 10px above infoBox top
		const legendCS = getComputedStyle(legend);
		const legendTop = parseFloat(legendCS.top) || 120;
		let available = infoTop - 10 - legendTop;
		// account for legend padding so content doesn't overflow its rounded corners
		const legendPaddingTop = parseFloat(legendCS.paddingTop) || 0;
		const legendPaddingBottom = parseFloat(legendCS.paddingBottom) || 0;
		let maxHeight = Math.max(60, available - legendPaddingTop - legendPaddingBottom);
		// Fallback to previously-used max (in case calculation yields absurd values)
		if (!isFinite(maxHeight) || maxHeight < 60) maxHeight = 60;
		legend.style.maxHeight = maxHeight + 'px';
	} catch (e) {
		// fail silently
		console.warn('updateFloatingBoxSpacing error', e);
	}
}

// Run on load and on resize / content changes
document.addEventListener('DOMContentLoaded', updateFloatingBoxSpacing);
window.addEventListener('resize', updateFloatingBoxSpacing);

// Observe size changes of the boxes and update spacing accordingly
if (window.ResizeObserver) {
	const ro = new ResizeObserver(function() {
		requestAnimationFrame(updateFloatingBoxSpacing);
	});
	const layerEl = document.getElementById('layerInfoBox');
	const infoEl = document.getElementById('infoBox');
	const legendEl = document.getElementById('legend-bar');
	if (layerEl) ro.observe(layerEl);
	if (infoEl) ro.observe(infoEl);
	if (legendEl) ro.observe(legendEl);
}

// Close a sheet when clicking outside it (narrow layout)
document.addEventListener('click', function(e) {
	if (!NARROW_LAYOUT.matches) return;
	// A control that removed itself while handling this click (the Retry in a failed
	// layer's row) is no longer inside anything; that is not a click outside.
	if (!document.contains(e.target)) return;
	var layerControl = document.getElementById('layerControl');
	var menuBtn = document.getElementById('menuBtn');
	if (isLayersSheetOpen() && !layerControl.contains(e.target) && !menuBtn.contains(e.target)) {
		setLayersSheet(false);
	}
	var panels = document.getElementById('keyPanels');
	var keyBtn = document.getElementById('keyPanelsBtn');
	if (isKeyPanelsOpen() && !panels.contains(e.target) && !keyBtn.contains(e.target)) {
		setKeyPanels(false);
	}
});

// "Skip to layers" (index.html): move focus into the layer panel without putting
// #layerControl into the address bar, so a copied link stays clean.
(function () {
	var skip = document.querySelector('.skip-link');
	var target = document.getElementById('layerControl');
	if (!skip || !target) return;
	skip.addEventListener('click', function (e) {
		e.preventDefault();
		target.focus();
	});
})();

// Welcome dialog: moved to JS/welcome.js (shared with the 3D Viewer).


