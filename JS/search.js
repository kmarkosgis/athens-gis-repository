// Address search logic
function searchAddress() {
	var address = document.getElementById('address').value;
	if (!address) return;

	fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`)
		.then(response => response.json())
		.then(data => {
			if (data.length > 0) {
				var lat = parseFloat(data[0].lat);
				var lon = parseFloat(data[0].lon);

				// Remove old marker if exists
				if (window.marker) {
					map.removeLayer(window.marker);
				}

				// Add new marker
				window.marker = L.marker([lat, lon]).addTo(map)
					.bindPopup(`<b>${data[0].display_name}</b>`).openPopup();

				// Zoom to location
				map.setView([lat, lon], 14);
			} else {
				alert("Address not found!");
			}
		})
		.catch(err => console.error(err));
}

document.getElementById('search-btn').addEventListener('click', searchAddress);

document.getElementById('address').addEventListener('keydown', function(e) {
	if (e.key === 'Enter') {
		searchAddress();
	}
});

const addressInput = document.getElementById('address');
const suggestionsList = document.getElementById('suggestions');

// Show suggestions as user types
addressInput.addEventListener('input', function() {
	const query = addressInput.value.trim();
	if (query.length < 3) {
		suggestionsList.innerHTML = '';
		suggestionsList.style.display = 'none';
		return;
	}
	fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&addressdetails=1&limit=5`)
		.then(response => response.json())
		.then(data => {
			suggestionsList.innerHTML = '';
			if (data.length === 0) {
				suggestionsList.style.display = 'none';
				return;
			}
			data.forEach(item => {
				const li = document.createElement('li');
				li.textContent = item.display_name;
				li.style.cursor = 'pointer';
				li.style.padding = '4px 8px';
				li.style.background = '#fff';
				li.style.borderBottom = '1px solid #eee';
				li.addEventListener('mousedown', function(e) {
					addressInput.value = item.display_name;
					suggestionsList.innerHTML = '';
					suggestionsList.style.display = 'none';
					searchAddress();
				});
				suggestionsList.appendChild(li);
			});
			suggestionsList.style.display = 'block';
		});
});

// Hide suggestions when clicking outside
document.addEventListener('click', function(e) {
	if (!addressInput.contains(e.target) && !suggestionsList.contains(e.target)) {
		suggestionsList.innerHTML = '';
		suggestionsList.style.display = 'none';
	}
});

// Remove marker when clicking elsewhere on the map
map.on('click', function() {
	if (window.marker) {
		map.removeLayer(window.marker);
		window.marker = null;
	}
});
