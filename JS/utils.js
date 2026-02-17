// Utility: Update opacity for all active (vector) layers registered in AthensGIS.geojsonLayers
function updateLayerOpacity() {
	var ag = window.AthensGIS || {};
	var op = ag.currentOpacity != null ? ag.currentOpacity : 1;
	Object.keys(ag.geojsonLayers || {}).forEach(function(key){
		var lyr = ag.geojsonLayers[key];
		if(!lyr) return;
		if(typeof lyr.setStyle === 'function') {
			try {
				lyr.setStyle(function(feature){
					// Attempt to preserve existing style colors
					var base = {};
					if(feature && feature.properties && lyr.options && typeof lyr.options.style === 'function') {
						try { base = lyr.options.style(feature) || {}; } catch(e) { base = {}; }
					}
					base.fillOpacity = op;
					if(base.opacity !== undefined) base.opacity = op; else base.opacity = op; // ensure stroke opacity
					return base;
				});
			} catch(err){ /* fallback to layer.eachLayer */
				if(lyr.eachLayer) {
					lyr.eachLayer(function(fl){ if(fl.setStyle) fl.setStyle({ fillOpacity: op, opacity: op }); });
				}
			}
		} else if(lyr.eachLayer) {
			lyr.eachLayer(function(fl){ if(fl.setStyle) fl.setStyle({ fillOpacity: op, opacity: op }); });
		}
	});
}

// Wire opacity slider
(function(){
	function initOpacitySlider(){
		var slider = document.getElementById('opacityRange');
		if(!slider) return;
		var ag = window.AthensGIS || (window.AthensGIS = {});
		// Initialize display spans if exist
		var minSpan = document.getElementById('opacityValueMin');
		var maxSpan = document.getElementById('opacityValueMax');
		function updateDisplay(val){
			if(minSpan) minSpan.textContent = '0%';
			if(maxSpan) maxSpan.textContent = Math.round(val*100) + '%';
		}
		updateDisplay(slider.value);
		slider.addEventListener('input', function(){
			ag.currentOpacity = parseFloat(this.value);
			updateDisplay(this.value);
			updateLayerOpacity();
		});
	}
	if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', initOpacitySlider); else initOpacitySlider();
})();

// Remove highlight from selected feature and hide info box
(function bindClearSelectionOnMapClick(){
	var ag = window.AthensGIS || (window.AthensGIS = {});
	var mapRef = ag.map || (typeof window.map !== 'undefined' ? window.map : null);
	if(!mapRef || typeof mapRef.on !== 'function') return;

	mapRef.on('click', function () {
		// Remove highlight from all features and reset their style
		Object.keys(ag.geojsonLayers || {}).forEach(function(key){
			var layer = ag.geojsonLayers[key];
			if (layer && layer.eachLayer) {
				layer.eachLayer(function(featureLayer) {
					// Remove highlight class if present
					if (featureLayer._path) {
						featureLayer._path.classList.remove("feature-highlight");
					}
					// Reset style if possible
					if (layer.resetStyle) {
						try { layer.resetStyle(featureLayer); } catch(_){}
					}
				});
			}
		});

		ag.selectedFeature = null;

		// Hide info box
		var infoBox = document.getElementById("infoBox");
		if (infoBox) infoBox.style.display = "none";
	});
})();
