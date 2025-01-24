import http from 'node:http';
import fs from 'node:fs/promises';

import { Response } from './index.ts';

async function getResults() {
	let results: Response[] = [];
	const folders = await fs.readdir('./results');

	for (const folder of folders) {
		const route = await fs.readFile(`./results/${folder}`);
		const parsed: Response = JSON.parse(route.toString());

		results.push(parsed);
	}

	return results;
}

const server = http.createServer(async (_req, res) => {
	const results = await getResults();

	res.writeHead(200, {
		'Content-Type': 'application/json',
		'Access-Control-Allow-Origin': '*',
	});
	res.end(JSON.stringify(results));
});

const PORT = process.env.PORT || 3000;

server.listen(PORT, () => {
	console.log(`Server listening at http://localhost:${PORT}`);
});
