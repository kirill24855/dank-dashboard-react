const fs = require("fs");
const shp = require("shp2json");

async function f() {
	let geojson = await shp.fromShpFile("./TM_WORLD_BORDERS-0.3.shp").catch(e => console.log(e));
	console.log(geojson);

	console.log("1done");
	fs.writeFileSync("./worldBorders.json", JSON.stringify(geojson, null, 2), "utf-8");
	console.log("2done");
}

f();