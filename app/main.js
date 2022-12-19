let originSetted = false;

let map = new maplibregl.Map({
	container: 'map', // container id
	center: [28.787520307356175, 40.97431939329584], // starting position [lng, lat]
	zoom: 17.5, // starting zoom
	style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
	attributionControl: false,
});

const directions = new MapboxDirections({
	accessToken:
		'pk.eyJ1Ijoib3J1Y2JlIiwiYSI6ImNsYnIwN29qejBpaHQzcXMzMGVucW5kMm4ifQ.cfLaAkNuzD0p4XUcCY7H1Q',
	unit: 'metric',
	profile: 'mapbox/driving',
	alternatives: true,
	geometries: 'geojson',
	controls: { instructions: true },
	flyTo: false,
	unit: 'metric',
});

// map.addControl(directions, 'bottom-right');

let geolocateControl = new CustomGeolocateControl({
	positionOptions: {
		enableHighAccuracy: true,
	},
	trackUserLocation: true,
	showUserLocation: true,
	fitBoundsOptions: {
		maxZoom: 20,
	},
	showUserHeading: true,
});
map.addControl(geolocateControl, 'bottom-left');
geolocateControl.on('geolocate', (e) => {
	console.log('A geolocate event has occurred.');
	console.log('lng:' + e.coords.longitude + ', lat:' + e.coords.latitude);
	const locationInfo = document.getElementById('locationInfo');
	locationInfo.innerHTML =
		'lng:' + e.coords.longitude + ', lat:' + e.coords.latitude;
	// if (!originSetted) {
	// 	directions.setOrigin([e.coords.longitude, e.coords.latitude]);
	// 	originSetted = true;
	// }
});
