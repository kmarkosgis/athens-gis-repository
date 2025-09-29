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

// Hide layerControl when clicking outside (mobile)
document.addEventListener('click', function(e) {
	var layerControl = document.getElementById('layerControl');
	var menuBtn = document.getElementById('menuBtn');
	var menuIcon = document.getElementById('menuIcon');
	if (window.innerWidth <= 600 && layerControl.style.display === 'block') {
		if (!layerControl.contains(e.target) && e.target !== menuBtn) {
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
