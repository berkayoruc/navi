const defaultOptions = {
	positionOptions: {
		enableHighAccuracy: false,
		maximumAge: 0,
		timeout: 6000 /* 6 sec */,
	},
	fitBoundsOptions: {
		maxZoom: 15,
	},
	trackUserLocation: false,
	showAccuracyCircle: true,
	showUserLocation: true,
	showUserHeading: false,
};

class CustomGeolocateControl extends CustomEvented {
	_map;
	options;
	_container;
	_dotElement;
	_circleElement;
	_geolocateButton;
	_geolocationWatchID;
	_timeoutId;
	_watchState;
	_lastKnownPosition;
	_userLocationDotMarker;
	_accuracyCircleMarker;
	_accuracy;
	_setup; // set to true once the control has been setup
	_heading;
	_updateMarkerRotationThrottled;

	_numberOfWatches;
	_noTimeout;
	_supportsGeolocation;

	constructor(options) {
		super();
		const geolocation = window.navigator.geolocation;
		this.options = extend({ geolocation }, defaultOptions, options);

		bindAll(
			[
				'_onSuccess',
				'_onError',
				'_onZoom',
				'_finish',
				'_setupUI',
				'_updateCamera',
				'_updateMarker',
				'_updateMarkerRotation',
				'_onDeviceOrientation',
			],
			this
		);

		this._updateMarkerRotationThrottled = throttle(
			this._updateMarkerRotation,
			20
		);
		this._numberOfWatches = 0;
	}

	onAdd(map) {
		this._map = map;
		this._container = document.createElement('div');
		this._container.className = 'maplibregl-ctrl maplibregl-ctrl-group';
		this._checkGeolocationSupport(this._setupUI);
		return this._container;
	}

	onRemove() {
		// clear the geolocation watch if exists
		if (this._geolocationWatchID !== undefined) {
			this.options.geolocation.clearWatch(this._geolocationWatchID);
			this._geolocationWatchID = undefined;
		}

		// clear the markers from the map
		if (this.options.showUserLocation && this._userLocationDotMarker) {
			this._userLocationDotMarker.remove();
		}
		if (this.options.showAccuracyCircle && this._accuracyCircleMarker) {
			this._accuracyCircleMarker.remove();
		}

		this._container.remove();
		this._map.off('zoom', this._onZoom);
		this._map = undefined;
		this._numberOfWatches = 0;
		this._noTimeout = false;
	}

	_checkGeolocationSupport(callback) {
		const updateSupport = (supported = !!this.options.geolocation) => {
			this._supportsGeolocation = supported;
			callback(supported);
		};

		if (this._supportsGeolocation !== undefined) {
			callback(this._supportsGeolocation);
		} else if (window.navigator.permissions !== undefined) {
			// navigator.permissions has incomplete browser support http://caniuse.com/#feat=permissions-api
			// Test for the case where a browser disables Geolocation because of an insecure origin;
			// in some environments like iOS16 WebView, permissions reject queries but still support geolocation
			window.navigator.permissions
				.query({ name: 'geolocation' })
				.then((p) => updateSupport(p.state !== 'denied'))
				.catch(() => updateSupport());
		} else {
			updateSupport();
		}
	}

	_isOutOfMapMaxBounds(position) {
		const bounds = this._map.getMaxBounds();
		const coordinates = position.coords;

		return (
			!!bounds &&
			(coordinates.longitude < bounds.getWest() ||
				coordinates.longitude > bounds.getEast() ||
				coordinates.latitude < bounds.getSouth() ||
				coordinates.latitude > bounds.getNorth())
		);
	}

	_setErrorState() {
		switch (this._watchState) {
			case 'WAITING_ACTIVE':
				this._watchState = 'ACTIVE_ERROR';
				this._geolocateButton.classList.remove(
					'maplibregl-ctrl-geolocate-active'
				);
				this._geolocateButton.classList.add(
					'maplibregl-ctrl-geolocate-active-error'
				);
				break;
			case 'ACTIVE_LOCK':
				this._watchState = 'ACTIVE_ERROR';
				this._geolocateButton.classList.remove(
					'maplibregl-ctrl-geolocate-active'
				);
				this._geolocateButton.classList.add(
					'maplibregl-ctrl-geolocate-active-error'
				);
				this._geolocateButton.classList.add(
					'maplibregl-ctrl-geolocate-waiting'
				);
				// turn marker grey
				break;
			case 'BACKGROUND':
				this._watchState = 'BACKGROUND_ERROR';
				this._geolocateButton.classList.remove(
					'maplibregl-ctrl-geolocate-background'
				);
				this._geolocateButton.classList.add(
					'maplibregl-ctrl-geolocate-background-error'
				);
				this._geolocateButton.classList.add(
					'maplibregl-ctrl-geolocate-waiting'
				);
				// turn marker grey
				break;
			case 'ACTIVE_ERROR':
				break;
			default:
				throw new Error(`Unexpected watchState ${this._watchState}`);
		}
	}

	_onSuccess(position) {
		if (!this._map) {
			// control has since been removed
			return;
		}

		if (this._isOutOfMapMaxBounds(position)) {
			this._setErrorState();

			this.fire(new CustomEvent('outofmaxbounds', position));
			this._updateMarker();
			this._finish();

			return;
		}

		if (this.options.trackUserLocation) {
			// keep a record of the position so that if the state is BACKGROUND and the user
			// clicks the button, we can move to ACTIVE_LOCK immediately without waiting for
			// watchPosition to trigger _onSuccess
			this._lastKnownPosition = position;

			switch (this._watchState) {
				case 'WAITING_ACTIVE':
				case 'ACTIVE_LOCK':
				case 'ACTIVE_ERROR':
					this._watchState = 'ACTIVE_LOCK';
					this._geolocateButton.classList.remove(
						'maplibregl-ctrl-geolocate-waiting'
					);
					this._geolocateButton.classList.remove(
						'maplibregl-ctrl-geolocate-active-error'
					);
					this._geolocateButton.classList.add(
						'maplibregl-ctrl-geolocate-active'
					);
					break;
				case 'BACKGROUND':
				case 'BACKGROUND_ERROR':
					this._watchState = 'BACKGROUND';
					this._geolocateButton.classList.remove(
						'maplibregl-ctrl-geolocate-waiting'
					);
					this._geolocateButton.classList.remove(
						'maplibregl-ctrl-geolocate-background-error'
					);
					this._geolocateButton.classList.add(
						'maplibregl-ctrl-geolocate-background'
					);
					break;
				default:
					throw new Error(`Unexpected watchState ${this._watchState}`);
			}
		}

		// if showUserLocation and the watch state isn't off then update the marker location
		if (this.options.showUserLocation && this._watchState !== 'OFF') {
			this._updateMarker(position);
		}

		// if in normal mode (not watch mode), or if in watch mode and the state is active watch
		// then update the camera
		if (!this.options.trackUserLocation || this._watchState === 'ACTIVE_LOCK') {
			this._updateCamera(position);
		}

		if (this.options.showUserLocation) {
			this._dotElement.classList.remove('maplibregl-user-location-dot-stale');
		}

		this.fire(new CustomEvent('geolocate', position));
		this._finish();
	}

	_updateCamera(position) {
		const center = new maplibregl.LngLat(
			position.coords.longitude,
			position.coords.latitude
		);
		const radius = position.coords.accuracy;
		const bearing = this._map.getBearing();
		const options = extend(
			{
				bearing,
			},
			this.options.fitBoundsOptions
		);

		this._map.fitBounds(center.toBounds(radius), options, {
			geolocateSource: true, // tag this camera change so it won't cause the control to change to background state
		});
	}

	_updateMarker(position) {
		if (position) {
			const center = new maplibregl.LngLat(
				position.coords.longitude,
				position.coords.latitude
			);
			this._accuracyCircleMarker.setLngLat(center).addTo(this._map);
			this._userLocationDotMarker.setLngLat(center).addTo(this._map);
			this._accuracy = position.coords.accuracy;
			if (this.options.showUserLocation && this.options.showAccuracyCircle) {
				this._updateCircleRadius();
			}
		} else {
			this._userLocationDotMarker.remove();
			this._accuracyCircleMarker.remove();
		}
	}

	_updateCircleRadius() {
		const y = this._map._container.clientHeight / 2;
		const a = this._map.unproject([0, y]);
		const b = this._map.unproject([1, y]);
		const metersPerPixel = a.distanceTo(b);
		const circleDiameter = Math.ceil((2.0 * this._accuracy) / metersPerPixel);
		this._circleElement.style.width = `${circleDiameter}px`;
		this._circleElement.style.height = `${circleDiameter}px`;
	}

	_onZoom() {
		if (this.options.showUserLocation && this.options.showAccuracyCircle) {
			this._updateCircleRadius();
		}
	}

	_updateMarkerRotation() {
		if (this._userLocationDotMarker && typeof this._heading === 'number') {
			this._userLocationDotMarker.setRotation(this._heading);
			this._dotElement.classList.add('maplibregl-user-location-show-heading');
		} else {
			this._dotElement.classList.remove(
				'maplibregl-user-location-show-heading'
			);
			this._userLocationDotMarker.setRotation(0);
		}
	}

	_onError(error) {
		if (!this._map) {
			// control has since been removed
			return;
		}

		if (this.options.trackUserLocation) {
			if (error.code === 1) {
				// PERMISSION_DENIED
				this._watchState = 'OFF';
				this._geolocateButton.classList.remove(
					'maplibregl-ctrl-geolocate-waiting'
				);
				this._geolocateButton.classList.remove(
					'maplibregl-ctrl-geolocate-active'
				);
				this._geolocateButton.classList.remove(
					'maplibregl-ctrl-geolocate-active-error'
				);
				this._geolocateButton.classList.remove(
					'maplibregl-ctrl-geolocate-background'
				);
				this._geolocateButton.classList.remove(
					'maplibregl-ctrl-geolocate-background-error'
				);
				this._geolocateButton.disabled = true;
				const title = this._map._getUIString(
					'GeolocateControl.LocationNotAvailable'
				);
				this._geolocateButton.setAttribute('aria-label', title);
				if (this._geolocateButton.firstElementChild)
					this._geolocateButton.firstElementChild.setAttribute('title', title);

				if (this._geolocationWatchID !== undefined) {
					this._clearWatch();
				}
			} else if (error.code === 3 && this._noTimeout) {
				// this represents a forced error state
				// this was triggered to force immediate geolocation when a watch is already present
				// see https://github.com/mapbox/mapbox-gl-js/issues/8214
				// and https://w3c.github.io/geolocation-api/#example-5-forcing-the-user-agent-to-return-a-fresh-cached-position
				return;
			} else {
				this._setErrorState();
			}
		}

		if (this._watchState !== 'OFF' && this.options.showUserLocation) {
			this._dotElement.classList.add('maplibregl-user-location-dot-stale');
		}

		this.fire(new CustomEvent('error', error));

		this._finish();
	}

	_finish() {
		if (this._timeoutId) {
			clearTimeout(this._timeoutId);
		}
		this._timeoutId = undefined;
	}

	_setupUI(supported) {
		if (this._map === undefined) {
			// This control was removed from the map before geolocation
			// support was determined.
			return;
		}
		this._container.addEventListener('contextmenu', (e) => e.preventDefault());
		this._geolocateButton = document.createElement('button');
		this._geolocateButton.className = 'maplibregl-ctrl-geolocate';
		this._container.appendChild(this._geolocateButton);
		const span = document.createElement('span');
		span.className = 'maplibregl-ctrl-icon';
		this._geolocateButton.appendChild(span);
		span.setAttribute('aria-hidden', 'true');

		this._geolocateButton.type = 'button';

		if (supported === false) {
			warnOnce(
				'Geolocation support is not available so the GeolocateControl will be disabled.'
			);
			const title = this._map._getUIString(
				'GeolocateControl.LocationNotAvailable'
			);
			this._geolocateButton.disabled = true;
			this._geolocateButton.setAttribute('aria-label', title);
			if (this._geolocateButton.firstElementChild)
				this._geolocateButton.firstElementChild.setAttribute('title', title);
		} else {
			const title = this._map._getUIString('GeolocateControl.FindMyLocation');
			this._geolocateButton.setAttribute('aria-label', title);
			if (this._geolocateButton.firstElementChild)
				this._geolocateButton.firstElementChild.setAttribute('title', title);
		}

		if (this.options.trackUserLocation) {
			this._geolocateButton.setAttribute('aria-pressed', 'false');
			this._watchState = 'OFF';
		}

		// when showUserLocation is enabled, keep the Geolocate button disabled until the device location marker is setup on the map
		if (this.options.showUserLocation) {
			this._dotElement = document.createElement('div');
			this._dotElement.className = 'maplibregl-user-location';
			const dotDiv = document.createElement('div');
			dotDiv.className = 'maplibregl-user-location-dot';
			this._dotElement.appendChild(dotDiv);
			const headingDiv = document.createElement('div');
			headingDiv.className = 'maplibregl-user-location-heading';
			this._dotElement.appendChild(headingDiv);

			this._userLocationDotMarker = new maplibregl.Marker({
				element: this._dotElement,
				rotationAlignment: 'map',
				pitchAlignment: 'map',
			});

			this._circleElement = document.createElement('div');
			this._circleElement.className =
				'maplibregl-user-location-accuracy-circle';
			this._accuracyCircleMarker = new maplibregl.Marker({
				element: this._circleElement,
				pitchAlignment: 'map',
			});

			if (this.options.trackUserLocation) this._watchState = 'OFF';

			this._map.on('zoom', this._onZoom);
		}

		this._geolocateButton.addEventListener('click', this.trigger.bind(this));

		this._setup = true;

		// when the camera is changed (and it's not as a result of the Geolocation Control) change
		// the watch mode to background watch, so that the marker is updated but not the camera.
		if (this.options.trackUserLocation) {
			this._map.on('movestart', (event) => {
				const fromResize =
					event.originalEvent && event.originalEvent.type === 'resize';
				if (
					!event.geolocateSource &&
					this._watchState === 'ACTIVE_LOCK' &&
					!fromResize
				) {
					this._watchState = 'BACKGROUND';
					this._geolocateButton.classList.add(
						'maplibregl-ctrl-geolocate-background'
					);
					this._geolocateButton.classList.remove(
						'maplibregl-ctrl-geolocate-active'
					);

					this.fire(new CustomEvent('trackuserlocationend'));
				}
			});
		}
	}

	_onDeviceOrientation(deviceOrientationEvent) {
		// absolute is true if the orientation data is provided as the difference between the Earth's coordinate frame and the device's coordinate frame, or false if the orientation data is being provided in reference to some arbitrary, device-determined coordinate frame.
		if (this._userLocationDotMarker) {
			if (deviceOrientationEvent.webkitCompassHeading) {
				// Safari
				this._heading = deviceOrientationEvent.webkitCompassHeading;
			} else if (deviceOrientationEvent.absolute === true) {
				// non-Safari alpha increases counter clockwise around the z axis
				this._heading = deviceOrientationEvent.alpha * -1;
			}
			this._updateMarkerRotationThrottled();
		}
	}

	trigger() {
		if (!this._setup) {
			warnOnce('Geolocate control triggered before added to a map');
			return false;
		}
		if (this.options.trackUserLocation) {
			// update watchState and do any outgoing state cleanup
			switch (this._watchState) {
				case 'OFF':
					// turn on the GeolocateControl
					this._watchState = 'WAITING_ACTIVE';

					this.fire(new CustomEvent('trackuserlocationstart'));
					break;
				case 'WAITING_ACTIVE':
				case 'ACTIVE_LOCK':
				case 'ACTIVE_ERROR':
				case 'BACKGROUND_ERROR':
					// turn off the Geolocate Control
					this._numberOfWatches--;
					this._noTimeout = false;
					this._watchState = 'OFF';
					this._geolocateButton.classList.remove(
						'maplibregl-ctrl-geolocate-waiting'
					);
					this._geolocateButton.classList.remove(
						'maplibregl-ctrl-geolocate-active'
					);
					this._geolocateButton.classList.remove(
						'maplibregl-ctrl-geolocate-active-error'
					);
					this._geolocateButton.classList.remove(
						'maplibregl-ctrl-geolocate-background'
					);
					this._geolocateButton.classList.remove(
						'maplibregl-ctrl-geolocate-background-error'
					);

					this.fire(new CustomEvent('trackuserlocationend'));
					break;
				case 'BACKGROUND':
					this._watchState = 'ACTIVE_LOCK';
					this._geolocateButton.classList.remove(
						'maplibregl-ctrl-geolocate-background'
					);
					// set camera to last known location
					if (this._lastKnownPosition)
						this._updateCamera(this._lastKnownPosition);

					this.fire(new CustomEvent('trackuserlocationstart'));
					break;
				default:
					throw new Error(`Unexpected watchState ${this._watchState}`);
			}

			// incoming state setup
			switch (this._watchState) {
				case 'WAITING_ACTIVE':
					this._geolocateButton.classList.add(
						'maplibregl-ctrl-geolocate-waiting'
					);
					this._geolocateButton.classList.add(
						'maplibregl-ctrl-geolocate-active'
					);
					break;
				case 'ACTIVE_LOCK':
					this._geolocateButton.classList.add(
						'maplibregl-ctrl-geolocate-active'
					);
					break;
				case 'ACTIVE_ERROR':
					this._geolocateButton.classList.add(
						'maplibregl-ctrl-geolocate-waiting'
					);
					this._geolocateButton.classList.add(
						'maplibregl-ctrl-geolocate-active-error'
					);
					break;
				case 'BACKGROUND':
					this._geolocateButton.classList.add(
						'maplibregl-ctrl-geolocate-background'
					);
					break;
				case 'BACKGROUND_ERROR':
					this._geolocateButton.classList.add(
						'maplibregl-ctrl-geolocate-waiting'
					);
					this._geolocateButton.classList.add(
						'maplibregl-ctrl-geolocate-background-error'
					);
					break;
				case 'OFF':
					break;
				default:
					throw new Error(`Unexpected watchState ${this._watchState}`);
			}

			// manage geolocation.watchPosition / geolocation.clearWatch
			if (
				this._watchState === 'OFF' &&
				this._geolocationWatchID !== undefined
			) {
				// clear watchPosition as we've changed to an OFF state
				this._clearWatch();
			} else if (this._geolocationWatchID === undefined) {
				// enable watchPosition since watchState is not OFF and there is no watchPosition already running

				this._geolocateButton.classList.add(
					'maplibregl-ctrl-geolocate-waiting'
				);
				this._geolocateButton.setAttribute('aria-pressed', 'true');

				this._numberOfWatches++;
				let positionOptions;
				if (this._numberOfWatches > 1) {
					positionOptions = { maximumAge: 600000, timeout: 0 };
					this._noTimeout = true;
				} else {
					positionOptions = this.options.positionOptions;
					this._noTimeout = false;
				}

				this._geolocationWatchID = this.options.geolocation.watchPosition(
					this._onSuccess,
					this._onError,
					positionOptions
				);

				if (this.options.showUserHeading) {
					this._addDeviceOrientationListener();
				}
			}
		} else {
			this.options.geolocation.getCurrentPosition(
				this._onSuccess,
				this._onError,
				this.options.positionOptions
			);

			// This timeout ensures that we still call finish() even if
			// the user declines to share their location in Firefox
			this._timeoutId = setTimeout(this._finish, 10000 /* 10sec */);
		}

		return true;
	}

	_addDeviceOrientationListener() {
		const addListener = () => {
			if ('ondeviceorientationabsolute' in window) {
				window.addEventListener(
					'deviceorientationabsolute',
					this._onDeviceOrientation
				);
			} else {
				window.addEventListener('deviceorientation', this._onDeviceOrientation);
			}
		};

		if (
			typeof window.DeviceMotionEvent !== 'undefined' &&
			typeof window.DeviceMotionEvent.requestPermission === 'function'
		) {
			// $FlowFixMe
			DeviceOrientationEvent.requestPermission()
				.then((response) => {
					if (response === 'granted') {
						addListener();
					}
				})
				.catch(console.error);
		} else {
			addListener();
		}
	}

	_clearWatch() {
		this.options.geolocation.clearWatch(this._geolocationWatchID);

		window.removeEventListener('deviceorientation', this._onDeviceOrientation);
		window.removeEventListener(
			'deviceorientationabsolute',
			this._onDeviceOrientation
		);

		this._geolocationWatchID = undefined;
		this._geolocateButton.classList.remove('maplibregl-ctrl-geolocate-waiting');
		this._geolocateButton.setAttribute('aria-pressed', 'false');

		if (this.options.showUserLocation) {
			this._updateMarker(null);
		}
	}
}
