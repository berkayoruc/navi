let map = new maplibregl.Map({
	container: 'map', // container id
	center: [28.787520307356175, 40.97431939329584], // starting position [lng, lat]
	zoom: 17.5, // starting zoom
	style: 'https://openmaptiles.github.io/positron-gl-style/style-cdn.json',
});

let geolocateControl = new maplibregl.GeolocateControl({
	positionOptions: {
		enableHighAccuracy: true,
	},
	trackUserLocation: true,
	showUserLocation: true,
});
map.addControl(geolocateControl, 'bottom-left');
geolocateControl.on('geolocate', (e) => {
	console.log('A geolocate event has occurred.');
	console.log('lng:' + e.coords.longitude + ', lat:' + e.coords.latitude);
	const locationInfo = document.getElementById('locationInfo');
	locationInfo.innerHTML =
		'lng:' + e.coords.longitude + ', lat:' + e.coords.latitude;
});
