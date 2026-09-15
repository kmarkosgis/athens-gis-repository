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
	var measurePending = false; // prompt shown, waiting on OK before drawing starts
	var measureControl = null;
	var measureLayer = null;
	var drawingGuideLine = null;
	var tempMarkers = [];
	var measureHandlers = null;

	function getMeasureModalEl(){
		return document.getElementById('measureMsgModal');
	}

	function handlePromptEsc(ev){
		if(ev.key === 'Escape' || ev.key === 'Esc'){
			if(ev.preventDefault) ev.preventDefault();
			hideMeasurePrompt();
		}
	}

	// Shown once, up front, when the tool is opened - drawing itself starts only
	// after the user confirms with OK (see beginMeasureDrawing).
	function showMeasurePrompt(){
		var el = getMeasureModalEl();
		if(!el) return;
		measurePending = true;
		el.style.display = 'flex';
		window.addEventListener('keydown', handlePromptEsc);
	}

	function hideMeasurePrompt(){
		var el = getMeasureModalEl();
		if(el) el.style.display = 'none';
		measurePending = false;
		window.removeEventListener('keydown', handlePromptEsc);
	}

	function getMeasureResultModalEl(){
		return document.getElementById('measureResultModal');
	}

	function handleResultEsc(ev){
		if(ev.key === 'Escape' || ev.key === 'Esc'){
			if(ev.preventDefault) ev.preventDefault();
			hideMeasureResult();
		}
	}

	// Shown once drawing finishes, in the same style as the instructions
	// prompt (see .measure-modal / .measure-modal-content in style.css), rather
	// than a Leaflet popup pinned to the last point.
	function showMeasureResult(distanceKm){
		var el = getMeasureResultModalEl();
		if(!el) return;
		var textEl = document.getElementById('measureResultText');
		if(textEl) textEl.textContent = 'Distance: ' + distanceKm.toFixed(2) + ' km';
		el.style.display = 'flex';
		window.addEventListener('keydown', handleResultEsc);
	}

	// Dismissing the result (OK, overlay click, or ESC) is what clears the
	// drawn line - mirrors the old "click map to clear" behaviour, just tied to
	// the modal instead of the map.
	function hideMeasureResult(){
		var el = getMeasureResultModalEl();
		if(el) el.style.display = 'none';
		window.removeEventListener('keydown', handleResultEsc);
		clearMeasurementArtifacts();
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
		disableMeasureMode();
		showMeasureResult(total/1000);
	}

	// leaflet-draw only wires click-to-finish onto the single most-recently
	// placed vertex marker (L.Draw.Polyline._updateFinishHandler) - clicking an
	// earlier one does nothing. This extends "finish here" to every placed
	// vertex, gated behind a double-click so it doesn't collide with that
	// built-in single-click behaviour on the latest marker. Called from the
	// 'draw:drawvertex' handler, whose payload is {layers: <LayerGroup of all
	// vertex markers so far>} - so this runs on every vertex add and skips
	// markers it has already bound.
	function bindFinishOnDblClick(e){
		if(!e || !e.layers || typeof e.layers.eachLayer !== 'function') return;
		e.layers.eachLayer(function(marker){
			if(marker._measureFinishBound) return;
			marker._measureFinishBound = true;
			marker.on('dblclick', function(ev){
				if(ev && ev.originalEvent){
					L.DomEvent.stopPropagation(ev.originalEvent);
					if(ev.originalEvent.preventDefault) ev.originalEvent.preventDefault();
				}
				// The last marker may already have finished (and disabled) the
				// control on the double-click's first single click.
				if(!measureControl || !measureControl.enabled()) return;
				try{ finishAtMarker(marker); }catch(_){}
			});
		});
	}

	// Ends the measurement at `marker`, dropping any vertices placed after it -
	// so double-clicking an earlier node measures up to that node, and its
	// final segment is against the node right before it, not whatever was
	// drawn afterwards. Goes straight through the same finalizeFromLatLngs()
	// used by the normal finish path, rather than leaflet-draw's own private
	// _finishShape() - that rebuilds its result from the control's internal
	// state right as disable()/removeHooks() is tearing that same state down,
	// which was silently swallowing the result before the modal ever showed.
	function finishAtMarker(marker){
		var markers = measureControl._markers;
		var idx = markers ? markers.indexOf(marker) : -1;
		if(idx < 0) return;
		var poly = measureControl._poly;
		var latlngs = poly ? poly.getLatLngs().slice(0, idx + 1) : null;
		finalizeFromLatLngs(latlngs);
	}

	// Entry point for the toolbar button: shows the instructions prompt and waits
	// for OK before touching the draw control (see beginMeasureDrawing).
	function startMeasure(){
		if(measureEnabled || measurePending) return;
		showMeasurePrompt();
	}

	function beginMeasureDrawing(){
		if(measureEnabled) return;
		measureControl = new L.Draw.Polyline(mapRef, {
			shapeOptions:{ color:'grey', weight:3 },
			// Round vertex markers instead of leaflet-draw's default 8x8 (20x20
			// on touch) squares. Keeping the original leaflet-div-icon /
			// leaflet-editing-icon classes preserves their default look (white
			// fill, grey border) and any library behaviour keyed off them;
			// .measure-vertex-icon (style.css) just rounds the corners.
			icon: new L.DivIcon({
				iconSize: new L.Point(8, 8),
				className: 'leaflet-div-icon leaflet-editing-icon measure-vertex-icon'
			}),
			touchIcon: new L.DivIcon({
				iconSize: new L.Point(16, 16),
				className: 'leaflet-div-icon leaflet-editing-icon leaflet-touch-icon measure-vertex-icon'
			})
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

		measureHandlers.drawVertex = function(e){
			if(measureControl && measureControl._poly) drawingGuideLine = measureControl._poly;
			bindFinishOnDblClick(e);
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
			if(measureEnabled){ cancelMeasure(); }
			else if(measurePending){ hideMeasurePrompt(); }
			else {
				// Starting fresh while a previous result is still showing: dismiss
				// it (clearing that old line) rather than leaving it stranded.
				if(resultModal && resultModal.style.display === 'flex'){ hideMeasureResult(); }
				startMeasure();
			}
		});
	}

	var msgModal = getMeasureModalEl();
	var msgOkBtn = document.getElementById('measureMsgOk');
	if(msgOkBtn){
		msgOkBtn.addEventListener('click', function(){
			hideMeasurePrompt();
			beginMeasureDrawing();
		});
	}
	if(msgModal){
		// Clicking the dark overlay (not the box itself) cancels, same as #welcomeModal.
		msgModal.addEventListener('click', function(e){
			if(e.target === msgModal) hideMeasurePrompt();
		});
	}

	var resultModal = getMeasureResultModalEl();
	var resultOkBtn = document.getElementById('measureResultOk');
	if(resultOkBtn){
		resultOkBtn.addEventListener('click', function(){ hideMeasureResult(); });
	}
	if(resultModal){
		resultModal.addEventListener('click', function(e){
			if(e.target === resultModal) hideMeasureResult();
		});
	}
})();
