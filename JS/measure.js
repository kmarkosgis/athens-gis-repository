// Measurement tool logic with robust ESC cancel handling
(function(){
	var ag = window.AthensGIS || (window.AthensGIS = {});
	var mapRef = ag.map || (typeof map !== 'undefined' ? map : null);
	if(!mapRef){
		// Retry after DOM / map init
		if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', arguments.callee); else setTimeout(arguments.callee, 100);
		return;
	}

	var measureEnabled = false;
	var measureControl = null;
	var measureLayer = null;
	var drawingGuideLine = null;
	var tempMarkers = [];
	var measureHandlers = null;

	function getMeasureMsgEl(){
		return document.getElementById('measure-msg');
	}

	function updateMeasureMessage(){
		var el = getMeasureMsgEl();
		if(!el) return;
		el.textContent = 'Click on the map to draw your measurement. Double click to finish. Press ESC to cancel.';
	}

	function showMeasureMessage(){
		var el = getMeasureMsgEl();
		if(!el) return;
		updateMeasureMessage();
		el.style.display = 'block';
	}

	function hideMeasureMessage(){
		var el = getMeasureMsgEl();
		if(el) el.style.display = 'none';
	}

	function cleanupMeasureListeners(){
		if(!measureHandlers) return;
		if(measureHandlers.esc) window.removeEventListener('keydown', measureHandlers.esc);
		if(measureHandlers.drawVertex) mapRef.off('draw:drawvertex', measureHandlers.drawVertex);
		if(measureHandlers.drawStop) mapRef.off('draw:drawstop', measureHandlers.drawStop);
		if(measureHandlers.created) mapRef.off(L.Draw.Event.CREATED, measureHandlers.created);
		measureHandlers = null;
	}

	function clearMeasurementArtifacts(){
		if(measureLayer){ try{ mapRef.removeLayer(measureLayer); }catch(_){} measureLayer = null; }
		if(drawingGuideLine){ try{ mapRef.removeLayer(drawingGuideLine); }catch(_){} drawingGuideLine = null; }
		tempMarkers.forEach(function(m){ try{ mapRef.removeLayer(m);}catch(_){} });
		tempMarkers = [];
		try{
			if(measureControl && measureControl._markerGroup){ mapRef.removeLayer(measureControl._markerGroup); }
		}catch(_){}
		mapRef.closePopup();
	}

	function disableMeasureMode(){
		cleanupMeasureListeners();
		measureEnabled = false;
		hideMeasureMessage();
		var ctrl = measureControl;
		measureControl = null;
		if(ctrl && ctrl.disable){ try{ ctrl.disable(); }catch(_){} }
	}

	function cancelMeasure(){
		disableMeasureMode();
		clearMeasurementArtifacts();
	}

	function finalizeFromLatLngs(latlngs){
		if(!latlngs || latlngs.length < 2){
			cancelMeasure();
			return;
		}
		measureLayer = L.polyline(latlngs, { color:'grey', weight:3 });
		mapRef.addLayer(measureLayer);
		var total = 0;
		for(var i=1;i<latlngs.length;i++) total += latlngs[i-1].distanceTo(latlngs[i]);
		L.popup()
			.setLatLng(latlngs[latlngs.length-1])
			.setContent('Distance: ' + (total/1000).toFixed(2) + ' km')
			.openOn(mapRef);
		disableMeasureMode();
		mapRef.once('click', function(){ clearMeasurementArtifacts(); });
	}

	function startMeasure(){
		if(measureEnabled) return;
		showMeasureMessage();
		measureControl = new L.Draw.Polyline(mapRef, {
			shapeOptions:{ color:'grey', weight:3 }
		});
		measureControl.enable();
		measureEnabled = true;
		drawingGuideLine = null;

		var createdFired = false;
		measureHandlers = {};

		measureHandlers.esc = function(ev){
			if(ev.key === 'Escape' || ev.key === 'Esc'){
				if(ev.preventDefault) ev.preventDefault();
				cancelMeasure();
			}
		};

		measureHandlers.drawVertex = function(){
			if(measureControl && measureControl._poly) drawingGuideLine = measureControl._poly;
		};

		measureHandlers.created = function(e){
			if(!measureEnabled) return;
			createdFired = true;
			var latlngs = (e && e.layer && typeof e.layer.getLatLngs === 'function') ? e.layer.getLatLngs() : null;
			finalizeFromLatLngs(latlngs);
		};

		measureHandlers.drawStop = function(){
			window.setTimeout(function(){
				if(!measureEnabled) return;
				if(createdFired) return;
				cancelMeasure();
			}, 0);
		};

		window.addEventListener('keydown', measureHandlers.esc);
		mapRef.on('draw:drawvertex', measureHandlers.drawVertex);
		mapRef.on('draw:drawstop', measureHandlers.drawStop);
		mapRef.on(L.Draw.Event.CREATED, measureHandlers.created);
	}

	var btn = document.getElementById('measureBtn');
	if(btn){
		btn.addEventListener('click', function(){
			if(!measureEnabled){ startMeasure(); }
			else { cancelMeasure(); }
		});
	}
})();
