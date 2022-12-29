let map = new maplibregl.Map({
	container: 'map', // container id
	center: [28.787520307356175, 40.97431939329584], // starting position [lng, lat]
	zoom: 17.5, // starting zoom
	style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json',
	attributionControl: false,
});

// const directions = new MapboxDirections({
// 	accessToken: accessToken,
// 	unit: 'metric',
// 	profile: 'mapbox/driving',
// 	alternatives: true,
// 	geometries: 'geojson',
// 	controls: { instructions: true },
// 	flyTo: false,
// 	unit: 'metric',
// });

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
	const locationInfoText = document.getElementById('locationInfoText');
	locationInfoText.innerHTML =
		'lng:' + e.coords.longitude + ', lat:' + e.coords.latitude;
	if (rawRoute) {
		updateNavigationInfo({
			map,
			step: rawRoute.routes[0].legs[0].steps[stepIndex],
			navigationInfo: document.getElementById('navigationInfoText'),
			userLocation: [e.coords.longitude, e.coords.latitude],
		});
	}
	// if (!originSetted) {
	// 	directions.setOrigin([e.coords.longitude, e.coords.latitude]);
	// 	originSetted = true;
	// }
});

map.on('load', () => {
	map.addSource('route-source', {
		type: 'geojson',
		data: {
			type: 'Feature',
			properties: {},
			geometry: {
				type: 'LineString',
				coordinates: [],
			},
		},
	});

	map.addLayer({
		id: 'route',
		type: 'line',
		source: 'route-source',
		layout: {
			'line-join': 'round',
			'line-cap': 'round',
		},
		paint: {
			'line-color': '#888',
			'line-width': 8,
		},
	});
	fetch(
		'https://cbsibbmap.ibb.gov.tr/ibbkbs/rest/services/BilirkisiTakip/MapServer/7/query?where=1%3D1&text=&objectIds=&time=&geometry=&geometryType=esriGeometryEnvelope&inSR=&spatialRel=esriSpatialRelIntersects&distance=&units=esriSRUnit_Foot&relationParam=&outFields=*&returnGeometry=true&returnTrueCurves=false&maxAllowableOffset=&geometryPrecision=&outSR=4326&havingClause=&returnIdsOnly=false&returnCountOnly=false&orderByFields=&groupByFieldsForStatistics=&outStatistics=&returnZ=false&returnM=false&gdbVersion=&historicMoment=&returnDistinctValues=false&resultOffset=&resultRecordCount=&returnExtentOnly=false&datumTransformation=&parameterValues=&rangeValues=&quantizationParameters=&featureEncoding=esriDefault&f=pjson'
	)
		.then((response) => response.json())
		.then((data) => console.log(data))
		.catch((error) => console.error(error));

	map.addSource('try', {
		type: 'geojson',
		data: 'https://cbsibbmap.ibb.gov.tr/ibbkbs/rest/services/BilirkisiTakip/MapServer/7/query?where=1%3D1&text=&objectIds=&time=&geometry=&geometryType=esriGeometryEnvelope&inSR=&spatialRel=esriSpatialRelIntersects&distance=&units=esriSRUnit_Foot&relationParam=&outFields=*&returnGeometry=true&returnTrueCurves=false&maxAllowableOffset=&geometryPrecision=&outSR=4326&havingClause=&returnIdsOnly=false&returnCountOnly=false&orderByFields=&groupByFieldsForStatistics=&outStatistics=&returnZ=false&returnM=false&gdbVersion=&historicMoment=&returnDistinctValues=false&resultOffset=&resultRecordCount=&returnExtentOnly=false&datumTransformation=&parameterValues=&rangeValues=&quantizationParameters=&featureEncoding=esriDefault&f=geojson',
	});

	map.addLayer({
		id: 'try',
		type: 'circle',
		source: 'try',
		paint: {
			'circle-color': '#f00',
			'circle-radius': 6,
			'circle-stroke-color': '#fff',
			'circle-stroke-width': 2,
		},
	});

	const solveRouteButton = document.getElementById('solveRoute');
	const navigateButton = document.getElementById('navigate');
	solveRouteButton.style.display = 'none';
	navigateButton.style.display = 'none';
	solveRouteButton.addEventListener('click', async (e) => {
		if (e.target.className === 'enabled') {
			const origin = geolocateControl._lastKnownPosition.coords;
			// -74.253496%2C40.847629%3B-74.331185%2C40.809193
			const routeRequest = await axios.get(
				'https://api.mapbox.com/directions/v5/mapbox/walking/' +
					origin.longitude +
					',' +
					origin.latitude +
					';' +
					destination.lng +
					',' +
					destination.lat +
					'?alternatives=false&continue_straight=true&geometries=geojson&language=en&overview=simplified&steps=true&access_token=' +
					accessToken
				// '28.90914917%2C41.01954191+%3B29.07909393+%2C+41.00814351'
			);
			rawRoute = routeRequest.data;
			console.log(rawRoute);
			const route = rawRoute.routes[0];
			console.log(route);
			stepsLength = route.legs[0].steps.length;
			map.getSource('route-source').setData({
				type: 'Feature',
				properties: {},
				geometry: {
					type: 'LineString',
					coordinates: route.geometry.coordinates,
				},
			});
			navigateButton.className = 'enabled';
		}
	});
	navigateButton.addEventListener('click', (e) => {
		if (e.target.className === 'enabled') {
			updateNavigationInfo({
				map,
				step: rawRoute.routes[0].legs[0].steps[stepIndex],
				navigationInfo: document.getElementById('navigationInfoText'),
				userLocation: [
					geolocateControl._lastKnownPosition.coords.longitude,
					geolocateControl._lastKnownPosition.coords.latitude,
				],
			});
		}
	});

	map.on('click', (e) => {
		destination = e.lngLat;
		if (geolocateControl._lastKnownPosition) {
			solveRouteButton.className = 'enabled';
		}
	});
});
