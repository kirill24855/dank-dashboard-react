import React, { Component } from 'react';
import PropTypes from 'prop-types';
import * as THREE from "three";
import loadBorders from "../shpLoader";
import "./Globe.css";

/*
 * Done with globe and country borders
 * TODO Now, looking for a higher-res globe texture, maybe
 * Also need to get data for all states of the US, and maybe other large countries like Russia, Canada, etc
 * Gotta configure some type of networking and listening for data from a server, so as to update the sticks in real time
 * 		actually no, bad idea. the super component should do that, and just give the globe what it needs. eNcApSuLaTiOn
 * TODO Add labels to countries and sticks?
 * TODO Make sticks' length represent a number (people or some such)
 * 		already kinda happening, the size/length is decided by the super so its up to that component
 * Change appearance of sticks to signify important notifications (errors, closed deals, etc)
 * TODO Border glow? maybe sticks too
 * Stick animations - go away from traditional actual sticks and instead to like circles emanating from the globe
 * 		TODO Now make it actually look good
 *
 * Write functionality for the FOCUS POINT, to rotate the globe to given coordinates in response to an event (errors, closed deals, etc)
 *
 * Return the (lat, lng) of a click to the parent, maybe along with the country name
 */

let defaultMarkerColor = 0x9ff9ff;
let defaultBorderColor = 0x4cc4ff;

let defaultStickColor = defaultBorderColor;
let defaultNewStickColor = 0x51e85b;
let defaultWarningStickColor = 0xffe759;
let defaultErrorStickColor = 0xff6e59;

let defaultEarthGlowColor = defaultMarkerColor;
//let defaultBorderGlowColor = defaultWarningStickColor;

export default class Globe extends Component {

	static propTypes = {
		backgroundColor: PropTypes.number,
		borderColor: PropTypes.number,
		markerColor: PropTypes.number,
		//countryFillColor: PropTypes.string,

		earthGlowColor: PropTypes.number,
		borderGlowColor: PropTypes.number,

		fovY: PropTypes.number,
		zoom: PropTypes.number,
		mouseRotationSensitivity: PropTypes.number,
		ambientRotationRate: PropTypes.number,

		sticks: PropTypes.array,
		stickWidth: PropTypes.number,

		normalStickColor: PropTypes.number,
		newStickColor: PropTypes.number,
		warningStickColor: PropTypes.number,
		errorStickColor: PropTypes.number,

		eventDisplayType: PropTypes.string,

		focusPoint: PropTypes.object,
		focusDuration: PropTypes.number,

		newStickAnimationDuration: PropTypes.number,

		onChange: PropTypes.func.isRequired,
		onGlobeClick: PropTypes.func.isRequired,
	};

	state = {
		markerMaterial: new THREE.LineBasicMaterial({color: this.props.markerColor || defaultMarkerColor}),
		borderMaterial: new THREE.LineBasicMaterial({color: this.props.borderColor || defaultBorderColor}),
		normalStickMaterial: new THREE.MeshPhongMaterial({color: this.props.normalStickColor || defaultStickColor}),
		newStickMaterial: new THREE.MeshPhongMaterial({color: this.props.newStickColor || defaultNewStickColor}),
		warningStickMaterial: new THREE.MeshPhongMaterial({color: this.props.warningStickColor || defaultWarningStickColor}),
		errorStickMaterial: new THREE.MeshPhongMaterial({color: this.props.errorStickColor || defaultErrorStickColor}),

		stickWidth: this.props.stickWidth || 0.005,

		eventDisplayType: this.props.eventDisplayType || "sticks",

		xAxis: new THREE.Vector3(1, 0, 0),
		yAxis: new THREE.Vector3(0, 1, 0),
		zAxis: new THREE.Vector3(0, 0, 1),
		origin: new THREE.Vector3(0, 0, 0),

		focusing: false,
	};

	constructor(props) {
		super(props);
		this.draw = this.draw.bind(this);
		this.animate = this.animate.bind(this);
	}

	// equator, parallels, and meridians
	addMarkersToScene(numParallels, numMeridians, earth) {
		let equatorGeometry = new THREE.CircleGeometry(1, 360);
		equatorGeometry.vertices.shift();

		// equator
		let equatorMesh = new THREE.LineLoop(equatorGeometry, this.state.markerMaterial);
		equatorMesh.rotation.x = Math.PI/2;
		earth.add(equatorMesh);

		// parallels
		for (let i = 0; i < Math.PI/2; i+= Math.PI/2/(numParallels+1)) {
			let parallelGeometry = new THREE.CircleGeometry(Math.cos(i), 360);
			parallelGeometry.vertices.shift();
			let parallelMesh = new THREE.LineLoop(parallelGeometry, this.state.markerMaterial);
			parallelMesh.rotation.x = Math.PI/2;
			parallelMesh.position.y = Math.sin(i);
			earth.add(parallelMesh);

			parallelMesh = new THREE.LineLoop(parallelGeometry, this.state.markerMaterial);
			parallelMesh.rotation.x = Math.PI/2;
			parallelMesh.position.y = -Math.sin(i);
			earth.add(parallelMesh);
		}

		// meridians
		for (let i = 0; i < 2*Math.PI; i += 2*Math.PI/numMeridians) {
			let meridianMesh = new THREE.LineLoop(equatorGeometry, this.state.markerMaterial);
			meridianMesh.rotation.y = i;
			earth.add(meridianMesh);
		}
	}

	addBordersToScene(geojson, earth) {
		// use to find buggy countries
		//geojson.features = geojson.features.filter(rec => rec.properties.NAME === "Greenland");
		//debugger;

		//let glowMaterial = this.getGlowMaterial(0.4, 6, this.props.borderGlowColor || defaultBorderGlowColor);

		// every country
		for (let i = 0; i < geojson.features.length; i++) {
			//let i = 144;
			let country = geojson.features[i];

			// every unconnected part of the country
			for (let j = 0; j < country.geometry.coordinates.length; j++) {
				let part;
				if (country.geometry.coordinates[0][0][0] instanceof Array) part = country.geometry.coordinates[j][0];
				else part = country.geometry.coordinates[j];
				let coordinates = [];

				// every point of the border of the part
				// change the increment in k to skip points when creating borders - improves performance, but hurts straight-line borders like Egypt, Alaska, etc
				for (let k = 0; k < part.length; k++) {
					//if ((k !== 0 && k !== part.length-1) && (Globe.skipSecondPoint(part[k-1], part[k], part[k+1], 0.00005))) continue; // 0.00001

					let coords = part[k];
					let lat = coords[1] * Math.PI / 180;
					let lng = coords[0] * Math.PI / 180;
					let point = new THREE.Vector3(Math.sin(lng) * Math.cos(lat), Math.sin(lat), Math.cos(lng) * Math.cos(lat));
					coordinates.push(point);
				}

				let geometry = new THREE.Geometry();
				geometry.vertices = coordinates;
				let line = new THREE.Line(geometry, this.state.borderMaterial);
				earth.add(line);

				//let glow = new THREE.Line(geometry, glowMaterial);
				//glow.scale.multiplyScalar(1.01);
				//earth.add(glow);
			}
		}
	}

	static skipSecondPoint(p1, p2, p3, threshold) {
		let x1 = p1[0];
		let y1 = p1[1];
		let x2 = p2[0];
		let y2 = p2[1];
		let x3 = p3[0];
		let y3 = p3[1];
		let x4 = (x2*(x1-x3)/(y3-y1) - x1*(y3-y1)/(x3-x1) + y1 - y2) / ((x1-x3)/(y3-y1) - (y3-y1)/(x3-x1));
		let y4 = (y3-y1)/(x3-x1) * (x4-x1) + y1;
		let hSquared = (x4-x2)*(x4-x2) + (y4-y2)*(y4-y2);
		//let bSquared = (x3-x1)*(x3-x1) + (y3-y1)*(y3-y1);
		return hSquared/*/bSquared*/ < threshold;
	}

	getGlowMaterial(c, p, color) {
		return new THREE.ShaderMaterial({
			uniforms: {
				"c": {type: "f", value: c},
				"p": {type: "f", value: p},
				glowColor: {type: "c", value: new THREE.Color(color)},
				viewVector: {type: "v3", value: this.gCamera.position}
			},
			vertexShader: `
					uniform vec3 viewVector;
					uniform float c;
					uniform float p;
					varying float intensity;
					void main() 
					{
						vec3 vNormal = normalize( normalMatrix * normal );
						vec3 vNormel = normalize( normalMatrix * viewVector );
						intensity = pow( c - dot(vNormal, vNormel), p );
						
						gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
					}
			`,
			fragmentShader: `
					uniform vec3 glowColor;
					varying float intensity;
					void main() 
					{
						vec3 glow = glowColor * intensity;
						gl_FragColor = vec4( glow, 1.0 );
					}
			`,
			side: THREE.BackSide,
			blending: THREE.AdditiveBlending,
			transparent: true,
		});
	}

	// OLD - creates an actual stick, use spawnCircle instead to form imaginary sticks
	addStick(lat, lng, length, type) {
		let material = this.state.normalStickMaterial;
		if (type === "error") material = this.state.errorStickMaterial;

		let geometry = new THREE.BoxGeometry(this.state.stickWidth, this.state.stickWidth, length);
		let stickMesh = new THREE.Mesh(geometry, material);
		let pivot = new THREE.Object3D();
		pivot.add(stickMesh);
		stickMesh.position.set(0, 0, 1 - length/2);

		this.rotateObjAroundOrigin(pivot, lat, lng);

		this.gSticks.toRender.add(pivot);

		return pivot;
	}

	spawnCircle(lat, lng, size, type) {
		let material = this.state.normalStickMaterial;
		if (type === "error") material = this.state.errorStickMaterial;

		let geometry = new THREE.SphereGeometry(size/10, 10, 10);
		let mesh = new THREE.Mesh(geometry, material);
		let pivot = new THREE.Object3D();
		pivot.add(mesh);
		pivot.userData.mesh = mesh;
		mesh.position.set(0, 0, 1);
		mesh.userData.spawnTime = Date.now();

		this.rotateObjAroundOrigin(pivot, lat, lng);

		this.gSticks.toRender.add(pivot);
	}

	addSticks(sticks) {
		for (let i = 0; i < sticks.length; i++) { // add new sticks
			let stick = sticks[i];

			if (this.gSticks.fromSource.some(s => s.lat === stick.lat && s.lng === stick.lng && s.size === stick.size && s.type === stick.type)) continue;

			if (this.state.eventDisplayType === "sticks") {
				let p = this.addStick(stick.lat, stick.lng, stick.size, stick.type);
				this.gSticks.fromSource.push(Object.assign(stick, {toRender: p, addTime: Date.now()}));
			} else if (this.state.eventDisplayType === "circles") {
				let id = setInterval(() => this.spawnCircle(stick.lat, stick.lng, stick.size, stick.type), 100);
				this.gSticks.fromSource.push(Object.assign(stick, {intervalID: id, addTime: Date.now()}));
			}
		}

		for (let i = sticks.length-1; i >= 0; i--) { // remove old sticks
			let stick = this.gSticks.fromSource[i];

			if (sticks.some(s => s.lat === stick.lat && s.lng === stick.lng && s.size === stick.size && s.type === stick.type)) continue;

			if (this.state.eventDisplayType === "circles") {
				console.log(stick.intervalID);
				clearInterval(stick.intervalID); // TODO figure out why the fuck intervalID isnt purple
			} else if (this.state.eventDisplayType === "sticks") {
				let index = this.gSticks.toRender.children.indexOf(stick.toRender);
				this.gSticks.toRender.children.splice(index, 1);
			}
			this.gSticks.fromSource.splice(i, 1);
		}
	}

	rotateObjAroundOrigin(pivot, lat, lng) {
		Globe.rotateAroundWorldAxis(pivot, this.state.xAxis, -lat * Math.PI / 180, false);
		Globe.rotateAroundWorldAxis(pivot, this.state.yAxis,  lng * Math.PI / 180, true);
	}

	static rotateAroundWorldAxis(object, axisNorm, radians, second) {
		let rotWorldMatrix = new THREE.Matrix4();
		rotWorldMatrix.makeRotationAxis(axisNorm, radians);
		if (second) rotWorldMatrix.multiply(object.matrix); // pre-multiply
		object.matrix = rotWorldMatrix;
		object.rotation.setFromRotationMatrix(object.matrix);
	}

	rotateCamera() {
		let lng = this.gCamera.rot.lng * Math.PI / 180;
		let lat = this.gCamera.rot.lat * Math.PI / 180;

		this.gCamera.position.x = Math.sin(lng) * Math.cos(lat) * this.gCamera.distance;
		this.gCamera.position.y = Math.sin(lat) * this.gCamera.distance;
		this.gCamera.position.z = Math.cos(lng) * Math.cos(lat) * this.gCamera.distance;
		this.gCamera.lookAt(this.state.origin);

		//this.rotateObjAroundOrigin(this.gCamera.userData.pivot, lat, lng); // this is faster, but it doesn't update camera.position, which is necessary for the glow


		this.gScene.userData.earth.userData.glow.material.uniforms.viewVector.value = this.gCamera.position;
	}

	static screenToGlobeCoords(mouseX, mouseY, camera, earth) {
		let mouse = new THREE.Vector2();
		mouse.x = mouseX*2-1;
		mouse.y = mouseY*2-1;

		let raycaster = new THREE.Raycaster();
		raycaster.setFromCamera(mouse, camera);
		let intersects = raycaster.intersectObject(earth);
		if (intersects == null || intersects.length === 0) return;

		let spherePoint = new THREE.Vector3();
		spherePoint.x = intersects[0].point.x;
		spherePoint.y = intersects[0].point.y;
		spherePoint.z = intersects[0].point.z;

		let lat = 90 - Math.acos(spherePoint.y) * 180 / Math.PI;
		let lng = ((180 + Math.atan2(spherePoint.x, spherePoint.z) * 180 / Math.PI) % 360) - 180;
		return {lat: lat, lng: lng};
	}

	async init() {
		let width = this.mount.clientWidth;
		let height = this.mount.clientHeight;

		this.gScene = new THREE.Scene();
		this.gScene.matrixAutoUpdate = false;
		this.gCamera = new THREE.PerspectiveCamera(this.props.fovY || 75, width/height, 0.1, 10); // set the far value at 1.55 to not render the back of the globe

		this.gCamera.distance = this.props.zoom + 1 || 2;
		this.gCamera.position.z = this.gCamera.distance;
		this.gCamera.rot = {lng: 0, lat: 0};
		this.gCamera.userData.pivot = new THREE.Object3D();
		this.gCamera.userData.pivot.add(this.gCamera);
		this.gScene.add(this.gCamera.userData.pivot);

		this.gRenderer = new THREE.WebGLRenderer({antialias: true});
		this.gRenderer.setPixelRatio(window.devicePixelRatio);
		this.gRenderer.setSize(width, height);
		this.gRenderer.setClearColor(this.props.backgroundColor || 0x000000, 1);

		this.mouseRotationSensitivity = this.props.mouseRotationSensitivity || 0.1;
		this.ambientRotationRate = this.props.ambientRotationRate || 1;

		// my own orbitControls, without the problem of unexposed rotate methods
		this.isDragging = false;
		this.dragPrev = {x: 0, y: 0};

		this.gRenderer.domElement.addEventListener("click", e => {
			let coords = Globe.screenToGlobeCoords(e.offsetX/width, (height-e.offsetY)/height, this.gCamera, this.gScene.userData.earth);
			if (coords == null) return;
			if (this.mouseCoords.x !== e.offsetX || this.mouseCoords.y !== e.offsetY) return;
			this.props.onGlobeClick(coords);
		});
		this.gRenderer.domElement.addEventListener("mousedown", e => {
			this.isDragging = true;
			this.mouseCoords = {x: e.offsetX, y: e.offsetY};
		});
		this.gRenderer.domElement.addEventListener("mousemove", e => {
			if (this.isDragging) {
				this.gCamera.rot.lng -= (e.offsetX-this.dragPrev.x)*this.mouseRotationSensitivity;
				this.gCamera.rot.lat += (e.offsetY-this.dragPrev.y)*this.mouseRotationSensitivity;

				if (this.gCamera.rot.lat > 90) this.gCamera.rot.lat = 90;
				if (this.gCamera.rot.lat < -90) this.gCamera.rot.lat = -90;
				if (this.gCamera.rot.lng > 180) this.gCamera.rot.lng -= 360;
				if (this.gCamera.rot.lng < -180) this.gCamera.rot.lng += 360;

				//this.rotateCamera(); // uncomment if not animating by default
				//this.draw();
			}

			this.dragPrev = {x: e.offsetX, y: e.offsetY};
		});

		// not sure if this is anti-pattern TODO figure out if this is anti-pattern
		document.addEventListener("mouseup", () => this.isDragging = false);

		this.gSticks = {};
		this.gSticks.toRender = new THREE.Group();
		this.gScene.add(this.gSticks.toRender);
		this.gSticks.fromSource = [];

		this.gScene.add(new THREE.AmbientLight(0xffffff, 1));

		this.gFocus = {
			duration: this.props.focusDuration || 1000,
			startTime: 0,
			startLoc: {
				lat: 0,
				lng: 0
			},
			curProgress: 0,
		};

		// earth texture
		let earth = new THREE.Group();
		this.gScene.add(earth);
		new THREE.TextureLoader().load("data/img/earthnight8k.jpg", tex => {
			let geometry = new THREE.SphereGeometry(0.999, 360, 180); // at 0.995, markers are at 32km above sea level
			let material = new THREE.MeshBasicMaterial({map: tex, overdraw: 0.5/*color: 0x050505*/});
			let mesh = new THREE.Mesh(geometry, material);
			mesh.rotateY(3*Math.PI/2);
			mesh.doubleSided = false;
			earth.add(mesh);

			// earth glow
			let glowMaterial = this.getGlowMaterial(0.4, 6, this.props.earthGlowColor || defaultEarthGlowColor);
			let earthGlow = new THREE.Mesh(geometry, glowMaterial);
			earthGlow.scale.multiplyScalar(1.55);
			earth.add(earthGlow);

			earth.userData.object = mesh;
			earth.userData.glow = earthGlow;

			//this.draw();
		});

		// load borders
		this.addBordersToScene(await loadBorders("data/maps/worldBorders.json"), earth);
		this.addBordersToScene(await loadBorders("data/maps/state/stateBorders.json"), earth);

		this.addMarkersToScene(2, 12, earth);

		this.gScene.userData.earth = earth;

		window.setInterval(() => console.log(this.gSticks.toRender.children.length), 1000);

		this.mount.appendChild(this.gRenderer.domElement);
	}

	async componentDidMount() {
		await this.init();
		this.animate();
	}

	/*shouldComponentUpdate(nextProps, nextState) {
		/!*return (this.props.focusPoint !== nextProps.focusPoint && nextProps.focusPoint != null)
			|| (this.props.sticks !== nextProps.sticks);*!/
		return true;
	}*/

	componentDidUpdate(prevProps) {
		if (this.props.focusPoint !== prevProps.focusPoint && this.props.focusPoint != null) {
			this.setState({focusing: true});
			this.gFocus.startTime = Date.now();

			let startLat = this.gCamera.rot.lat;
			let startLng = this.gCamera.rot.lng;
			let stdDist = this.props.focusPoint.lng - startLng;

			// just works, no reason to try to figure it out
			if (Math.abs(stdDist) > 180) startLng -= 360;
			stdDist = this.props.focusPoint.lng - startLng;
			if (Math.abs(stdDist) > 180) startLng += 720;

			this.gFocus.startLoc = {lat: startLat, lng: startLng};
			//requestAnimationFrame(this.animate);
		}

		if (this.props.sticks !== prevProps.sticks) {
			this.addSticks(this.props.sticks);
		}
	}

	animate(timestamp) {
		if (!timestamp) {
			requestAnimationFrame(this.animate);
			return;
		}

		if (this.state.focusing) this.focus();
		else {
			if (!this.gCamera.userData.lastRenderTime) this.gCamera.userData.lastRenderTime = timestamp;
			this.gCamera.rot.lng += this.ambientRotationRate*(timestamp - this.gCamera.userData.lastRenderTime)/1000;
			if (this.gCamera.rot.lng > 180) this.gCamera.rot.lng -= 360;
			this.rotateCamera();
		}

		this.animateSticks();

		this.draw();
		this.gCamera.userData.lastRenderTime = timestamp;
		requestAnimationFrame(this.animate);
	}

	focus() {
		let curTime = Date.now();
		this.gFocus.curProgress = curTime - this.gFocus.startTime;
		if (this.gFocus.curProgress > this.gFocus.duration) {
			this.setState({focusing: false});
			this.gFocus.curProgress = this.gFocus.duration;
		}

		let progress = this.gFocus.curProgress / this.gFocus.duration;
		this.gCamera.rot.lat = (this.props.focusPoint.lat - this.gFocus.startLoc.lat) * Globe.d(progress) + this.gFocus.startLoc.lat;
		this.gCamera.rot.lng = (this.props.focusPoint.lng - this.gFocus.startLoc.lng) * Globe.d(progress) + this.gFocus.startLoc.lng;

		this.rotateCamera();
	}

	// Animates by moving the sticks out of the globe. Doesn't work if the sticks are long.
	// https://threejs.org/docs/#manual/en/introduction/How-to-update-things
	animateSticks() {
		let curTime = Date.now();

		if (this.state.eventDisplayType === "sticks") {
			for (let i in this.gSticks.fromSource) {
				let stick = this.gSticks.fromSource[i];

				let lifeLength = curTime - stick.addTime;
				if (lifeLength > 1000) continue;

				stick.toRender.children[0].position.z = 1 + stick.size * (Globe.d(lifeLength/1000)-0.5);
			}
		} else if (this.state.eventDisplayType === "circles") {
			for (let i = this.gSticks.toRender.children.length-1; i >= 0; i--) {
				let circle = this.gSticks.toRender.children[i].userData.mesh;

				let lifeLength = curTime - circle.userData.spawnTime;
				if (lifeLength > 1000) this.gSticks.toRender.children.splice(i, 1);
				else circle.position.z = 1 + Globe.d(lifeLength/1000)*0.1;
			}
		}
	}

	// TODO find a better name - mathematical functions usually have 1-letter names, but that's discouraged in JS
	static d(t) {return -2*t*t*(t-1.5);} // cubic relation, maybe experiment with different functions here?

	draw() {
		this.gRenderer.render(this.gScene, this.gCamera);
	}

	render() {
		return (
			<div className="globe-rootDiv"
				ref={(r) => this.mount = r}
			/>
		)
	}
}
