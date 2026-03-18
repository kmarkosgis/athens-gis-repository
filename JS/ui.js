// UI logic for menu button, welcome modal, and mobile layer panel

// Menu button toggles layer panel and animates icon
document.getElementById('menuBtn').addEventListener('click', function() {
	var layerControl = document.getElementById('layerControl');
	var menuIcon = document.getElementById('menuIcon');
	if (layerControl.style.display === 'block') {
		layerControl.style.display = 'none';
		menuIcon.textContent = '☰';
		menuIcon.classList.remove('animated');
	} else {
		layerControl.style.display = 'block';
		menuIcon.textContent = '✕';
		menuIcon.classList.add('animated');
	}
});

// Ensure consistent vertical gaps between floating boxes:
// - `infoBox` bottom border is always 10px above top of `layerInfoBox`
// - `legend-bar` bottom is always 10px above top of `infoBox`
function updateFloatingBoxSpacing() {
	try {
		const layer = document.getElementById('layerInfoBox');
		const info = document.getElementById('infoBox');
		const legend = document.getElementById('legend-bar');
		if (!layer || !info || !legend) return;

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
	const ro = new ResizeObserver(updateFloatingBoxSpacing);
	const layerEl = document.getElementById('layerInfoBox');
	const infoEl = document.getElementById('infoBox');
	const legendEl = document.getElementById('legend-bar');
	if (layerEl) ro.observe(layerEl);
	if (infoEl) ro.observe(infoEl);
	if (legendEl) ro.observe(legendEl);
}

// Also re-run when DOM mutations may change heights (e.g., content injected)
const docObserver = new MutationObserver(updateFloatingBoxSpacing);
docObserver.observe(document.body, { childList: true, subtree: true, attributes: false });

// Hide layerControl when clicking outside (mobile)
document.addEventListener('click', function(e) {
	var layerControl = document.getElementById('layerControl');
	var menuBtn = document.getElementById('menuBtn');
	var menuIcon = document.getElementById('menuIcon');
	if (window.innerWidth <= 768 && layerControl.style.display === 'block') {
		if (!layerControl.contains(e.target) && !menuBtn.contains(e.target)) {
			layerControl.style.display = 'none';
			menuIcon.textContent = '☰';
			menuIcon.classList.remove('animated');
		}
	}
});

// Welcome modal logic
document.addEventListener("DOMContentLoaded", function () {
	const modal = document.getElementById("welcomeModal");
	const closeBtn = document.getElementById("closeWelcome");
	const openBtn = document.getElementById("openWelcome");

	// Check if already visited
	if (!localStorage.getItem("welcomeShown")) {
		modal.style.display = "flex";
	}

	// Close modal + mark as shown
	closeBtn.addEventListener("click", function () {
		modal.style.display = "none";
		localStorage.setItem("welcomeShown", "true");
	});

	// Allow reopening manually
	openBtn.addEventListener("click", function () {
		modal.style.display = "flex";
	});

	// Close modal on outside click
	window.addEventListener("click", function (e) {
		if (e.target === modal) {
			modal.style.display = "none";
			localStorage.setItem("welcomeShown", "true");
		}
	});
});

// Announcement box logic with a global 0/1 toggle and per-user dismissal.
document.addEventListener("DOMContentLoaded", function () {
	const box = document.getElementById("announcement-box");
	const closeBtn = document.getElementById("closeAnnouncementBtn");
	if (!box || !closeBtn) return;

	const announcementToggle = Number((window.AthensGIS || {}).announcementToggle);
	const dismissalStorageKey = "announcementDismissedSignature";
	const announcementSignature = Array.from(box.querySelectorAll("p"))
		.map(function (item) {
			return (item.textContent || "").replace(/\s+/g, " ").trim();
		})
		.join("|");

	function hideAnnouncement() {
		box.hidden = true;
		box.setAttribute("aria-hidden", "true");
	}

	function showAnnouncement() {
		box.hidden = false;
		box.setAttribute("aria-hidden", "false");
	}

	if (announcementToggle !== 1) {
		localStorage.removeItem(dismissalStorageKey);
		hideAnnouncement();
		return;
	}

	if (localStorage.getItem(dismissalStorageKey) === announcementSignature) {
		hideAnnouncement();
		return;
	}

	showAnnouncement();

	closeBtn.addEventListener("click", function () {
		localStorage.setItem(dismissalStorageKey, announcementSignature);
		hideAnnouncement();
	});
});

