import React, { Component } from 'react';
import './App.css';
import Globe from "./components/Globe";

class App extends Component {

	state = {
		sticks: [
			{
				id: 1,
				size: 654
			}
		],
		rotationAngleLat: 0,
		focusPoint: null
	};

	handleGlobeChange() {}

	render() {
		return (
			<div style={{width:"100%", height:"100%", position:"absolute", top:"0", left:"0"}}>

				<button onClick={()=>{this.setState({focusPoint: {lat: 10, lng: -170}})}}>focus</button>
				<div style={{width:"100%", height:"100%", display:"inline-block"}}>
					<Globe
						focusPoint={this.state.focusPoint}
						onChange={this.handleGlobeChange.bind(this)}
					/>
				</div>
			</div>
		);
	}
}

export default App;
