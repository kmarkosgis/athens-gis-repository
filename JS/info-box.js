
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
