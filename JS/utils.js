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
			if (lyr._vecLayer)  refreshSingleLayer(lyr._vecLayer);
		}
	}
	ag.setLayerOpacity = setLayerOpacity;

	function buildOpacityPopup() {
		var popup = document.getElementById('opacity-popup');
		if (!popup) return;
		var layers = (ag.activeLayerOrder || []).slice();

		var html = '<div class="opacity-popup-header">OPACITY</div>';

		if (layers.length === 0) {
			html += '<div class="opacity-popup-empty">No active layers</div>';
		} else {
			html += '<ul id="opacity-layer-list">';
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
		}

		popup.innerHTML = html;

		popup.querySelectorAll('.opacity-layer-slider').forEach(function (slider) {
			slider.addEventListener('input', function () {
				var name = this.dataset.layer;
				var val  = parseFloat(this.value) / 100;
				setLayerOpacity(name, val);
				var valSpan = this.parentElement.querySelector('.opacity-layer-value');
				if (valSpan) valSpan.textContent = this.value + '%';
			});
		});
	}

	// Only rebuild if the popup is currently visible
	function refreshOpacityPopupIfOpen() {
		var popup = document.getElementById('opacity-popup');
		if (popup && !popup.hidden) buildOpacityPopup();
	}
	ag.refreshOpacityPopup = refreshOpacityPopupIfOpen;

	function initOpacityButton() {
		var btn   = document.getElementById('opacityBtn');
		var popup = document.getElementById('opacity-popup');
		if (!btn || !popup) return;

		btn.addEventListener('click', function (e) {
			e.stopPropagation();
			var isOpen = !popup.hidden;
			popup.hidden = isOpen;
			btn.classList.toggle('active', !isOpen);
			if (!isOpen) buildOpacityPopup();
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
