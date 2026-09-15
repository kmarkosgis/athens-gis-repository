// Per-layer opacity management and popup
(function () {
	var ag = window.AthensGIS = window.AthensGIS || {};
	ag.layerOpacities  = ag.layerOpacities  || {};
	ag.activeLayerOrder = ag.activeLayerOrder || [];
	ag.layerKeyByName   = ag.layerKeyByName   || {};

	function getLayerOpacity(layerName) {
		var op = ag.layerOpacities[layerName];
		return (op !== undefined && op !== null) ? op : 1;
	}
	ag.getLayerOpacity = getLayerOpacity;

	function refreshSingleLayer(lyr) {
		if (!lyr) return;
		try {
			if (typeof lyr.setStyle === 'function' && lyr.options && typeof lyr.options.style === 'function') {
				lyr.setStyle(lyr.options.style);
				return;
			}
		} catch (e) {}
		try {
			if (typeof lyr.eachLayer === 'function') {
				lyr.eachLayer(function (sub) {
					if (sub && typeof sub.setStyle === 'function') {
						try {
							if (sub.options && typeof sub.options.style === 'function') sub.setStyle(sub.options.style);
						} catch (e) {}
					}
				});
			}
		} catch (e) {}
	}

	function setLayerOpacity(layerName, opacity) {
		ag.layerOpacities[layerName] = opacity;
		var key = ag.layerKeyByName[layerName] || layerName;
		var lyr = ag.geojsonLayers && ag.geojsonLayers[key];
		if (lyr) {
			var isVectorStyled = lyr.options && typeof lyr.options.style === 'function';
			if (!isVectorStyled && typeof lyr.setOpacity === 'function') {
				try { lyr.setOpacity(opacity); } catch (e) {}
				return;
			}
			refreshSingleLayer(lyr);
			if (lyr._polyLayer) refreshSingleLayer(lyr._polyLayer);
			if (lyr._lineLayer) refreshSingleLayer(lyr._lineLayer);
			if (lyr._vecLayer)  refreshSingleLayer(lyr._vecLayer);
		}
	}
	ag.setLayerOpacity = setLayerOpacity;

	// Renders into the shared opacity/draw-order popup body (JS/draw-order.js
	// owns the popup shell itself - the header, the arrows to cycle panels, and
	// which panel is currently showing).
	function buildOpacityPopup(container) {
		var layers = (ag.activeLayerOrder || []).slice();

		if (layers.length === 0) {
			var empty = document.createElement('div');
			empty.className = 'layer-popup-empty';
			empty.textContent = 'No active layers';
			container.appendChild(empty);
			return;
		}

		var html = '<ul id="opacity-layer-list">';
		layers.forEach(function (layerName) {
			var op  = getLayerOpacity(layerName);
			var pct = Math.round(op * 100);
			var safeId = layerName.replace(/\s+/g, '_').replace(/[^a-zA-Z0-9_]/g, '');
			var safeAttr = layerName.replace(/"/g, '&quot;');
			html += '<li class="opacity-layer-item">';
			html += '<span class="opacity-layer-name" title="' + safeAttr + '">' + layerName + '</span>';
			html += '<input type="range" class="opacity-layer-slider" id="osl-' + safeId + '" data-layer="' + safeAttr + '" min="0" max="100" step="5" value="' + pct + '">';
			html += '<span class="opacity-layer-value" id="osv-' + safeId + '">' + pct + '%</span>';
			html += '</li>';
		});
		html += '</ul>';

		container.innerHTML = html;

		container.querySelectorAll('.opacity-layer-slider').forEach(function (slider) {
			slider.addEventListener('input', function () {
				var name = this.dataset.layer;
				var val  = parseFloat(this.value) / 100;
				setLayerOpacity(name, val);
				var valSpan = this.parentElement.querySelector('.opacity-layer-value');
				if (valSpan) valSpan.textContent = this.value + '%';
			});
		});
	}

	// Only rebuild if the opacity panel is the one currently visible
	function refreshOpacityPopupIfOpen() {
		if (ag.layerPopup) ag.layerPopup.refreshIfOpen('opacity');
	}
	ag.refreshOpacityPopup = refreshOpacityPopupIfOpen;

	function initOpacityButton() {
		var btn = document.getElementById('opacityBtn');
		if (!btn || !ag.layerPopup) return;

		ag.layerPopup.registerPanel('opacity', { label: 'OPACITY', render: buildOpacityPopup });

		btn.classList.add('layer-popup-trigger');
		btn.dataset.panel = 'opacity';
		btn.addEventListener('click', function (e) {
			e.stopPropagation();
			ag.layerPopup.toggle('opacity');
		});
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initOpacityButton);
	} else {
		initOpacityButton();
	}
})();

// Remove highlight from selected feature and hide info box on map click
(function bindClearSelectionOnMapClick() {
	var ag     = window.AthensGIS || (window.AthensGIS = {});
	var mapRef = ag.map || (typeof window.map !== 'undefined' ? window.map : null);
	if (!mapRef || typeof mapRef.on !== 'function') return;

	mapRef.on('click', function () {
		if (ag._rasterClickActive) return;
		Object.keys(ag.geojsonLayers || {}).forEach(function (key) {
			var layer = ag.geojsonLayers[key];
			if (layer && layer.eachLayer) {
				layer.eachLayer(function (featureLayer) {
					if (featureLayer._path) {
						featureLayer._path.classList.remove('feature-highlight');
					}
					if (layer.resetStyle) {
						try { layer.resetStyle(featureLayer); } catch (_) {}
					}
				});
			}
		});

		ag.selectedFeature = null;

		var infoBox = document.getElementById('infoBox');
		if (infoBox) infoBox.style.display = 'none';
	});
})();
