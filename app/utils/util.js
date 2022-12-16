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
