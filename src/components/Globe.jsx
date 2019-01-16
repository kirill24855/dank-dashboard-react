import React, { Component } from 'react';
import PropTypes from 'prop-types';
import * as THREE from "three";
import loadBorders from "../shpLoader";
import GlobeStyle from "./Globe.css";

/*
 * Done with globe and country borders
 * TODO Now, looking for a higher-res globe texture, maybe
 * Also need to get data for all states of the US, and maybe other large countries like Russia, Canada, etc
 * TODO Gotta configure some type of networking and listening for data from a server, so as to update the sticks in real time
 * TODO Add labels to countries and sticks?
 * TODO Make sticks' length represent a number (people or some such)
 * TODO Change appearance of sticks to signify important notifications (errors, closed deals, etc)
 *
 * Write functionality for the FOCUS POINT, to rotate the globe to given coordinates in response to an event (errors, closed deals, etc)
 *
 * TODO return the (lat, lng) of a click to the parent, maybe along with the country name
 */

let defaultMarkerColor = 0x9ff9ff;
let defaultBorderColor = 0x4cc4ff;
let defaultStickColor = 0x4cc4ff;

export default class Globe extends Component {

	static propTypes = {
		backgroundColor: PropTypes.number,
		borderColor: PropTypes.number,
		markerColor: PropTypes.number,
		//countryFillColor: PropTypes.string,

		fovY: PropTypes.number,
		zoom: PropTypes.number,
		rotationRate: PropTypes.number,

		stickWidth: PropTypes.number,
		stickColor: PropTypes.string,
		sticks: PropTypes.array,

		focusPoint: PropTypes.object,
		animationDuration: PropTypes.number,

		onChange: PropTypes.func.isRequired,
	};

	state = {
		markerMaterial: new THREE.LineBasicMaterial({color: this.props.markerColor || defaultMarkerColor}),
		borderMaterial: new THREE.LineBasicMaterial({color: this.props.borderColor || defaultBorderColor}),
		stickMaterial: new THREE.MeshNormalMaterial({color: this.props.stickColor || defaultStickColor}),

		stickWidth: this.props.stickWidth || 0.005,

		xAxis: new THREE.Vector3(1, 0, 0),
		yAxis: new THREE.Vector3(0, 1, 0),
		zAxis: new THREE.Vector3(0, 0, 1),
		origin: new THREE.Vector3(0, 0, 0),

		animating: false,
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

	// TODO refactor this method to listen to the super object for adding sticks, rather than giving it the power to do it by itself
	addStick(lat, lng, length) {
		let geometry = new THREE.BoxGeometry(this.state.stickWidth, this.state.stickWidth, length, 1, 1, 1);
		let stickMesh = new THREE.Mesh(geometry, this.state.stickMaterial);
		let pivot = new THREE.Object3D();
		pivot.add(stickMesh);
		stickMesh.userData.pivot = pivot;
		stickMesh.position.set(0, 0, 1 + length/2);

		this.rotateObjAroundOrigin(stickMesh.userData.pivot, lat, lng);

		this.gSticks.push({
			lat: lat,
			lng: lng,
			length: length,
			mesh: stickMesh
		});

		this.gScene.add(pivot);
		this.draw();
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

	rotateCamera(camera) {
		let lng = camera.rot.lng;
		let lat = camera.rot.lat;

		this.rotateObjAroundOrigin(camera.userData.pivot, lat, lng);

		/*camera.position.x = Math.sin(lng) * Math.cos(lat) * camera.distance;
		camera.position.y = Math.sin(lat) * camera.distance;
		camera.position.z = Math.cos(lng) * Math.cos(lat) * camera.distance;
		camera.lookAt(this.state.origin);*/
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
		this.gCamera = new THREE.PerspectiveCamera(this.props.fovY || 75, width/height, 0.9, 10); // set the far value at 1.55 to not render the back of the globe
		this.gCamera.fovX = 2 * Math.atan(Math.tan(this.gCamera.fov / 2 * Math.PI / 180) * this.gCamera.aspect) * 180 / Math.PI;

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

		this.rotationRate = this.props.rotationRate || 0.1;

		// my own orbitControls, without the problem of unexposed rotate methods
		this.isDragging = false;
		this.dragPrev = {x: 0, y: 0};

		this.gRenderer.domElement.addEventListener("click", e => {
			let coords = Globe.screenToGlobeCoords(e.offsetX/width, (height-e.offsetY)/height, this.gCamera, this.gScene.userData.earth);
			if (coords == null) return;
			this.addStick(
				coords.lat,
				coords.lng,
				0.1
			);
		});

		this.gRenderer.domElement.addEventListener("mousedown", () => this.isDragging = true);
		this.gRenderer.domElement.addEventListener("mousemove", e => {
			if (this.isDragging) {
				this.gCamera.rot.lng -= (e.offsetX-this.dragPrev.x)*this.rotationRate;
				this.gCamera.rot.lat += (e.offsetY-this.dragPrev.y)*this.rotationRate;

				if (this.gCamera.rot.lat > 90) this.gCamera.rot.lat = 90;
				if (this.gCamera.rot.lat < -90) this.gCamera.rot.lat = -90;
				if (this.gCamera.rot.lng > 180) this.gCamera.rot.lng -= 360;
				if (this.gCamera.rot.lng < -180) this.gCamera.rot.lng += 360;

				this.rotateCamera(this.gCamera);
				this.draw();
			}

			this.dragPrev = {x: e.offsetX, y: e.offsetY};
		});

		// not sure if this is anti-pattern TODO figure out if this is anti-pattern
		document.addEventListener("mouseup", () => this.isDragging = false);

		this.gSticks = [];

		this.gAnimation = {
			duration: this.props.animationDuration || 1000,
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
		new THREE.TextureLoader().load("/data/img/earthnight8k.jpg", tex => {
			let geometry = new THREE.SphereGeometry(0.999, 360, 180); // at 0.995, markers are at 32km above sea level
			let material = new THREE.MeshBasicMaterial({map: tex, overdraw: 0.5/*color: 0x050505*/});
			let mesh = new THREE.Mesh(geometry, material);
			mesh.rotateY(3*Math.PI/2);
			earth.add(mesh);

			earth.userData.object = mesh;
		});

		// load borders
		this.addBordersToScene(await loadBorders("/data/maps/worldBorders.json"), earth);
		this.addBordersToScene(await loadBorders("/data/maps/state/stateBorders.json"), earth);

		this.addMarkersToScene(2, 12, earth);

		this.gScene.userData.earth = earth.userData.object;

		this.mount.appendChild(this.gRenderer.domElement);
	}

	async componentDidMount() {
		await this.init();
		this.draw();
	}

	shouldComponentUpdate(nextProps, nextState) {
		this.draw();
		return (this.props.focusPoint !== nextProps.focusPoint && nextProps.focusPoint != null);
	}

	componentDidUpdate(prevProps, prevState, snapshot) {
		if (this.props.focusPoint !== prevProps.focusPoint && this.props.focusPoint != null) {
			this.setState({animating: true});
			this.gAnimation.startTime = Date.now();

			let startLat = this.gCamera.rot.lat;
			let startLng = this.gCamera.rot.lng;
			let stdDist = this.props.focusPoint.lng - startLng;

			// black magic, do not disturb
			if (Math.abs(stdDist) > 180) startLng -= 360;
			stdDist = this.props.focusPoint.lng - startLng;
			if (Math.abs(stdDist) > 180) startLng += 720;

			this.gAnimation.startLoc = {lat: startLat, lng: startLng};
			requestAnimationFrame(this.animate);
		}
	}

	animate() {
		let curTime = Date.now();
		this.gAnimation.curProgress = curTime - this.gAnimation.startTime;
		if (this.gAnimation.curProgress > this.gAnimation.duration) {
			this.setState({animating: false});
			this.gAnimation.curProgress = this.gAnimation.duration;
		}
		if (this.state.animating) requestAnimationFrame(this.animate);

		let progress = this.gAnimation.curProgress / this.gAnimation.duration;
		this.gCamera.rot.lat = (this.props.focusPoint.lat - this.gAnimation.startLoc.lat) * Globe.d(progress) + this.gAnimation.startLoc.lat;
		this.gCamera.rot.lng = (this.props.focusPoint.lng - this.gAnimation.startLoc.lng) * Globe.d(progress) + this.gAnimation.startLoc.lng;

		this.rotateCamera(this.gCamera);

		this.draw();
	}

	// TODO find a better name - mathematical functions usually have 1-letter names, but that's discouraged in JS
	static d(t) {return -2*t*t*(t-1.5);}

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
