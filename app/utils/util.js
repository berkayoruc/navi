let destination,
	rawRoute,
	legIndex = 0,
	stepIndex = 0,
	stepsLength = 0;

const accessToken =
	'pk.eyJ1Ijoib3J1Y2JlIiwiYSI6ImNsYnIwN29qejBpaHQzcXMzMGVucW5kMm4ifQ.cfLaAkNuzD0p4XUcCY7H1Q';

function extend(dest, ...sources) {
	for (const src of sources) {
		for (const k in src) {
			dest[k] = src[k];
		}
	}
	return dest;
}

function bindAll(fns, context) {
	fns.forEach((fn) => {
		if (!context[fn]) {
			return;
		}
		context[fn] = context[fn].bind(context);
	});
}

const warnOnceHistory = {};
function warnOnce(message) {
	if (!warnOnceHistory[message]) {
		// console isn't defined in some WebWorkers, see #2558
		if (typeof console !== 'undefined') console.warn(message);
		warnOnceHistory[message] = true;
	}
}

function throttle(fn, time) {
	let pending = false;
	let timerId = null;

	const later = () => {
		timerId = null;
		if (pending) {
			fn();
			timerId = setTimeout(later, time);
			pending = false;
		}
	};

	return () => {
		pending = true;
		if (!timerId) {
			later();
		}
		return timerId;
	};
}

const getBearing = (params) => {
	const { start, end } = params,
		point1 = turf.point(start),
		point2 = turf.point(end);
	return turf.bearing(point1, point2);
};

const updateNavigationInfo = (params) => {
	const { map, step, navigationInfo, userLocation } = params;
	navigationInfo.innerHTML = `Distance: ${step.distance.toFixed(
		2
	)}m, Duration: ${step.duration.toFixed(2)}sec\n${step.maneuver.instruction}`;
	const buffer = turf.buffer(
		turf.point(step.geometry.coordinates[step.geometry.coordinates.length - 1]),
		5,
		{ units: 'meters' }
	);
	const turfUserLocation = turf.point(userLocation);

	if (
		stepIndex < stepsLength - 1 &&
		turf.booleanPointInPolygon(turfUserLocation, buffer)
	) {
		stepIndex++;
	}
};
