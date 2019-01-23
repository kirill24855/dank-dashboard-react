import React, { Component } from 'react';
import './App.css';
import Globe from "./components/Globe";

class App extends Component {

	state = {
		sticks: [],
		focusPoint: null
	};

	handleGlobeChange() {}

	onGlobeClick(coords) {
		/*this.setState({sticks: [...this.state.sticks, { // add stick at click location
				id: 2,
				type: "error",
				size: 0.2,
				lat: coords.lat,
				lng: coords.lng,
		}]});*/
	}

	static shuffle(b) {
		let a = b.slice(0);
		for (let i = a.length-1; i > 0; i--) {
			const j = Math.floor(Math.random() * (i+1));
			if (i === j) continue;
			[a[i], a[j]] = [a[j], a[i]];
		}
		return a;
	}

	static randomizeSticks(sticks, total, count) {
		sticks = App.shuffle(sticks).slice(0, count);
		sticks = [...sticks, ...App.generateSticks(total-count)];

		return sticks;
	}

	static generateStick() {
		return {
			type: Math.random() < 0.2 ? "error" : "normal",
			size: Math.random() * 0.3,
			lat: Math.random() * 180 - 90,
			lng: Math.random() * 360 - 180,
		};
	}

	static generateSticks(count) {
		const sticks = [];
		for (let i = 0; i < count; i++) {
			sticks.push(App.generateStick());
		}
		return sticks;
	}

	setupTestEnvironment() {
		setInterval(() => {
			let sticks = App.randomizeSticks(this.state.sticks, 100, 50);
			this.setState({sticks});
		}, 1000);
	}

	componentDidMount() {
		this.setupTestEnvironment();
	}

	render() {
		return (
			<div style={{width:"100%", height:"100%", position:"absolute", top:"0", left:"0"}}>

				<button onClick={()=>{this.setState({focusPoint: {lat: 44.6, lng: 33.5}})}}>focus</button>
				<div style={{width:"100%", height:"100%", display:"inline-block"}}>
					<Globe
						focusPoint={this.state.focusPoint}
						sticks={this.state.sticks}
						onChange={this.handleGlobeChange.bind(this)}
						onGlobeClick={this.onGlobeClick.bind(this)}
					/>
				</div>
			</div>
		);
	}
}

export default App;
