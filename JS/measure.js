// Measurement tool logic (robust toggle version)
(function(){
	var ag = window.AthensGIS || (window.AthensGIS = {});
	var mapRef = ag.map || (typeof map !== 'undefined' ? map : null);
	if(!mapRef){
		// Retry after DOM / map init
		if(document.readyState==='loading') document.addEventListener('DOMContentLoaded', arguments.callee); else setTimeout(arguments.callee, 100);
		return;
	}

	// Internal state
	var measureEnabled = false;
	var measureControl = null;
	var measureLayer = null;          // finalized polyline layer
	var drawingGuideLine = null;      // reference to in-progress polyline
	var tempMarkers = [];             // store vertex markers if Leaflet.draw creates them

	function clearMeasurementArtifacts(){
		if(measureLayer){ try{ mapRef.removeLayer(measureLayer);}catch(_){} measureLayer=null; }
		tempMarkers.forEach(function(m){ try{ mapRef.removeLayer(m);}catch(_){} });
		tempMarkers=[];
		mapRef.closePopup();
			// Also remove any in-progress temporary draw polyline (Leaflet.draw keeps it without feature prop)
			Object.keys(mapRef._layers || {}).forEach(function(id){
				var lyr = mapRef._layers[id];
				if(lyr instanceof L.Polyline && !lyr.feature && lyr.options && lyr.options.color==='grey' && lyr.options.weight===3){
					try{ mapRef.removeLayer(lyr);}catch(_){}
				}
			});
	}

	function disableMeasureMode(){
		if(measureControl && measureControl.disable) { try{ measureControl.disable(); }catch(_){} }
		measureEnabled=false;
		document.getElementById('measure-msg').style.display='none';
	}

	function finalizeFromLatLngs(latlngs, opts){
		opts = opts || {};
		if(!latlngs || latlngs.length < 2){ disableMeasureMode(); clearMeasurementArtifacts(); return; }
		// Only add a permanent line if not asked to remove immediately
		if(!opts.removeLine){
			measureLayer = L.polyline(latlngs, { color:'grey', weight:3 });
			mapRef.addLayer(measureLayer);
		}
		var total=0; for(var i=1;i<latlngs.length;i++){ total += latlngs[i-1].distanceTo(latlngs[i]); }
		L.popup().setLatLng(latlngs[latlngs.length-1]).setContent('Distance: '+(total/1000).toFixed(2)+' km').openOn(mapRef);
		disableMeasureMode();
		// If we did not keep the line, clear temp artifacts now; else wait for next click
		if(opts.removeLine){
			clearMeasurementArtifacts();
		}else{
			mapRef.once('click', function(){ clearMeasurementArtifacts(); });
		}
	}

	function extractDrawingLatLngs(){
		var latlngs=null;
		Object.keys(mapRef._layers||{}).forEach(function(id){
			var lyr = mapRef._layers[id];
			if(!latlngs && lyr instanceof L.Polyline && !lyr.feature && lyr.options && lyr.options.color==='grey' && lyr.options.weight===3){
				try { latlngs = lyr.getLatLngs().slice(); drawingGuideLine = lyr; } catch(_){}
			}
		});
		return latlngs;
	}

	function startMeasure(){
		document.getElementById('measure-msg').style.display='block';
		measureControl = new L.Draw.Polyline(mapRef, {
			shapeOptions:{ color:'grey', weight:3 }
		});
		measureControl.enable();
		measureEnabled=true;

		// ESC finalizes drawing
		function escHandler(ev){
			if(ev.key==='Escape'){
				var pts = extractDrawingLatLngs();
				window.removeEventListener('keydown', escHandler);
				// Finalize and remove line immediately on ESC
				finalizeFromLatLngs(pts, { removeLine:true });
			}
		}
		window.addEventListener('keydown', escHandler);

		// draw:drawstop now handled by CREATED or ESC finalize
		mapRef.once('draw:drawstop', function(){});

		// Created event
		mapRef.once(L.Draw.Event.CREATED, function(e){
			measureLayer = e.layer; // finalized by double-click, keep visible until next click
			finalizeFromLatLngs(measureLayer.getLatLngs(), { removeLine:false });
		});

		// If user clicks elsewhere before finishing (first click already consumed by drawing start), hide guidance after a delay
		mapRef.once('click', function(){ if(measureEnabled){ /* user started drawing */ } else { document.getElementById('measure-msg').style.display='none'; } });
	}

	var btn = document.getElementById('measureBtn');
	if(btn){
		btn.addEventListener('click', function(){
			if(!measureEnabled){ startMeasure(); }
			else { // toggle off mid-draw
				disableMeasureMode(); clearMeasurementArtifacts();
			}
		});
	}
})();
