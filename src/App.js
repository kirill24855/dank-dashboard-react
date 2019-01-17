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
		this.setState({sticks: [...this.state.sticks, {
				id: 2,
				type: "error",
				size: 0.2,
				lat: coords.lat,
				lng: coords.lng,
		}]});
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
