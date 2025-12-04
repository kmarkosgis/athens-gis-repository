
// Info box formatting function for all layers
function formatFeatureProperties(properties) {
	var popupContent = '<table>';
	for (var key in properties) {
		var value = properties[key];
		var displayKey = key;
		if (key.toLowerCase() === 'shapeleng_') {
			value = Number(value).toFixed(2);
			displayKey = 'Shape Length (km)';
		} else if (key.toLowerCase() === 'shapearea') {
			value = Number(value).toFixed(2);
			displayKey = 'Shape Area (km²)';
		} else if (key.toLowerCase() === 'shapeleng_m') {
			value = Number(value).toFixed(2);
			displayKey = 'Shape Length (m)';
		} else if (key.toLowerCase() === 'shapelengm') {
			value = Number(value).toFixed(2);
			displayKey = 'Shape Length (m)';
		} else if (key.toLowerCase() === 'shapearea_m') {
			value = Number(value).toFixed(2);
			displayKey = 'Shape Area (m²)';
		} else if (key.toLowerCase() === 'name') {
			displayKey = 'Name (GR)';
		} else if (key.toLowerCase() === 'gname') {
			displayKey = 'Name (GR)';
		} else if (key.toLowerCase() === 'uses_gr') {
			displayKey = 'Name (GR)';
		} else if (key.toLowerCase() === 'name_en') {
			displayKey = 'Name (ENG)';
		} else if (key.toLowerCase() === 'uses_en') {
			displayKey = 'Name (ENG)';
		} else if (key.toLowerCase() === 'ename') {
			displayKey = 'Name (ENG)';
		} else if (key.toLowerCase() === 'sectionnam') {
			displayKey = 'Section Name';
		} else if (key.toLowerCase() === 'metroline') {
			displayKey = 'Metro Line';
		} else if (key.toLowerCase() === 'highway') {
			displayKey = 'Type';
		} else if (key.toLowerCase() === 'oneway') {
			displayKey = 'One-Way Road';
		} else if (key.toLowerCase() === 'surface') {
			displayKey = 'Surface Type';
		} else if (key.toLowerCase() === 'fid') {
			displayKey = 'Feature ID';
		} else if (key.toLowerCase() === 'objectid') {
			displayKey = 'Feature ID';
		} else if (key.toLowerCase() === 'popul2011') {
			displayKey = 'Population';
		} else if (key.toLowerCase() === 'wt') {
			displayKey = 'Wind Turbine';
		} else if (key.toLowerCase() === 'power_anem') {
			displayKey = 'Power (MW)';
		} else if (key.toLowerCase() === 'max_power') {
			displayKey = 'Max Power (MW)';
		} else if (key.toLowerCase() === 'diametros_') {
			displayKey = 'Diameter (m)';
		} else if (key.toLowerCase() === 'ypsos_pylo') {
			displayKey = 'Height (m)';
		} else if (key.toLowerCase() === 'initialdat') {
			displayKey = 'Initial Date';
		} else if (key.toLowerCase() === 'finaldate') {
			displayKey = 'Final Date';
		}
		popupContent += '<tr><th style="text-align:left; padding:5px; width: 115px; border-bottom: 1px solid #ccc;">'
			+ displayKey + '</th><td style="border-bottom: 1px solid #ccc;width: 115px;">' + value + '</td></tr>';
	}
	popupContent += '</table>';
	return popupContent;
}

// Expose globally for other modules
window.formatFeatureProperties = formatFeatureProperties;

// Provide a global updateInfoBox function for cross-module use
window.updateInfoBox = function() {
	var infoBox = document.getElementById('layerInfoBox');
	var AthensGIS = window.AthensGIS || {};
	var activeLayerInfos = AthensGIS.activeLayerInfos || {};
	var content = '';
	for (var key in activeLayerInfos) {
		content += '<strong>' + key + '</strong><br>' + activeLayerInfos[key] + '<hr>';
	}
	if (content) {
		infoBox.innerHTML = content;
		infoBox.style.display = 'block';
	} else {
		infoBox.style.display = 'none';
	}
};
