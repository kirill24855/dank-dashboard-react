let cache = {};

export default async function loadShp(filePath) {
	if (cache[filePath]) return cache[filePath];

	let response = await fetch(filePath);
	cache[filePath] = await response.json();

	return cache[filePath];
}
