function _addEventListener(type, listener, listenerList) {
	const listenerExists =
		listenerList[type] && listenerList[type].indexOf(listener) !== -1;
	if (!listenerExists) {
		listenerList[type] = listenerList[type] || [];
		listenerList[type].push(listener);
	}
}

function _removeEventListener(type, listener, listenerList) {
	if (listenerList && listenerList[type]) {
		const index = listenerList[type].indexOf(listener);
		if (index !== -1) {
			listenerList[type].splice(index, 1);
		}
	}
}

class CustomEvent {
	type;

	constructor(type, data = {}) {
		extend(this, data);
		this.type = type;
	}
}

class CustomErrorEvent extends CustomEvent {
	error;

	constructor(error, data = {}) {
		super('error', extend({ error }, data));
	}
}

class CustomEvented {
	_listeners;
	_oneTimeListeners;
	_eventedParent;
	_eventedParentData;

	on(type, listener) {
		this._listeners = this._listeners || {};
		_addEventListener(type, listener, this._listeners);

		return this;
	}

	off(type, listener) {
		_removeEventListener(type, listener, this._listeners);
		_removeEventListener(type, listener, this._oneTimeListeners);

		return this;
	}

	once(type, listener) {
		if (!listener) {
			return new Promise((resolve) => this.once(type, resolve));
		}
		this._oneTimeListeners = this._oneTimeListeners || {};
		_addEventListener(type, listener, this._oneTimeListeners);

		return this;
	}

	fire(event, properties) {
		// Compatibility with (type: string, properties: Object) signature from previous versions.
		// See https://github.com/mapbox/mapbox-gl-js/issues/6522,
		//     https://github.com/mapbox/mapbox-gl-draw/issues/766
		if (typeof event === 'string') {
			event = new CustomEvent(event, properties || {});
		}

		const type = event.type;

		if (this.listens(type)) {
			event.target = this;

			// make sure adding or removing listeners inside other listeners won't cause an infinite loop
			const listeners =
				this._listeners && this._listeners[type]
					? this._listeners[type].slice()
					: [];
			for (const listener of listeners) {
				listener.call(this, event);
			}

			const oneTimeListeners =
				this._oneTimeListeners && this._oneTimeListeners[type]
					? this._oneTimeListeners[type].slice()
					: [];
			for (const listener of oneTimeListeners) {
				_removeEventListener(type, listener, this._oneTimeListeners);
				listener.call(this, event);
			}

			const parent = this._eventedParent;
			if (parent) {
				extend(
					event,
					typeof this._eventedParentData === 'function'
						? this._eventedParentData()
						: this._eventedParentData
				);
				parent.fire(event);
			}

			// To ensure that no error events are dropped, print them to the
			// console if they have no listeners.
		} else if (event instanceof CustomErrorEvent) {
			console.error(event.error);
		}

		return this;
	}

	listens(type) {
		return (
			(this._listeners &&
				this._listeners[type] &&
				this._listeners[type].length > 0) ||
			(this._oneTimeListeners &&
				this._oneTimeListeners[type] &&
				this._oneTimeListeners[type].length > 0) ||
			(this._eventedParent && this._eventedParent.listens(type))
		);
	}

	setEventedParent(parent, data) {
		this._eventedParent = parent;
		this._eventedParentData = data;

		return this;
	}
}
