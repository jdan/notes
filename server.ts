import fs from "fs";
import http from "http";
import path from "path";

import { config } from "dotenv";
import mimeTypes from "mime-types";

config({
	path: process.env.CONFIG,
	debug: Boolean(process.env.CONFIG),
});

const fsPromises = fs.promises;
const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || "127.0.0.1";
const outputDir = path.resolve(process.env.BUILD || path.join(__dirname, "site"));
const webhookPath = process.env.WEBHOOK_PATH || "/webhook/notion";
const webhookSecret = process.env.WEBHOOK_SECRET;

process.env.BUILD = outputDir;

let buildPromise: Promise<void> | null = null;
let lastBuild: { startedAt: string; finishedAt?: string; error?: string } | null = null;

function sendJson(res: http.ServerResponse, statusCode: number, body: unknown) {
	res.writeHead(statusCode, { "Content-Type": "application/json" });
	res.end(JSON.stringify(body));
}

function hasValidSecret(req: http.IncomingMessage, url: URL) {
	if (!webhookSecret) {
		return false;
	}

	const headerSecret = req.headers["x-webhook-secret"];
	const token = Array.isArray(headerSecret) ? headerSecret[0] : headerSecret;
	return token === webhookSecret || url.searchParams.get("secret") === webhookSecret;
}

async function runBuild() {
	if (buildPromise) {
		return buildPromise;
	}

	lastBuild = { startedAt: new Date().toISOString() };
	buildPromise = (async () => {
		try {
			const { main } = await import("./index");
			await main();
			lastBuild = { ...lastBuild!, finishedAt: new Date().toISOString() };
		} catch (error) {
			lastBuild = {
				...lastBuild!,
				finishedAt: new Date().toISOString(),
				error: error instanceof Error ? error.message : String(error),
			};
			throw error;
		} finally {
			buildPromise = null;
		}
	})();

	return buildPromise;
}

async function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, url: URL) {
	let pathname = decodeURIComponent(url.pathname);
	if (pathname.endsWith("/")) {
		pathname += "index.html";
	}

	const filepath = path.resolve(outputDir, pathname.replace(/^\/+/, ""));
	const relativePath = path.relative(outputDir, filepath);
	if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
		res.writeHead(403);
		res.end("Forbidden");
		return;
	}

	try {
		const stat = await fsPromises.stat(filepath);
		if (stat.isDirectory()) {
			res.writeHead(301, { Location: `${url.pathname.replace(/\/$/, "")}/` });
			res.end();
			return;
		}

		const etag = `"${stat.mtimeMs.toString(36)}-${stat.size.toString(36)}"`;
		if (req.headers["if-none-match"] === etag) {
			res.writeHead(304);
			res.end();
			return;
		}

		const ext = path.extname(filepath).toLowerCase();
		let cacheControl = "no-cache";
		if (/\.(jpg|jpeg|gif|png|ttf|woff|woff2|ico|svg)$/.test(ext)) {
			cacheControl = "public, max-age=604800, immutable";
		} else if (/\.(css|js|json)$/.test(ext)) {
			cacheControl = "public, max-age=3600, immutable";
		} else if (/\.html$/.test(ext)) {
			cacheControl = "no-cache";
		}

		res.writeHead(200, {
			"Content-Type": mimeTypes.lookup(filepath) || "application/octet-stream",
			"Cache-Control": cacheControl,
			ETag: etag,
		});
		fs.createReadStream(filepath).pipe(res);
	} catch (error) {
		res.writeHead(404, { "Content-Type": "text/plain" });
		res.end("Not found");
	}
}

const server = http.createServer(async (req, res) => {
	const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

	if (url.pathname === "/healthz") {
		sendJson(res, 200, {
			ok: true,
			building: Boolean(buildPromise),
			lastBuild,
		});
		return;
	}

	if (url.pathname === webhookPath) {
		if (req.method !== "GET" && req.method !== "POST") {
			res.writeHead(405, { Allow: "GET, POST" });
			res.end("Method not allowed");
			return;
		}

		if (!hasValidSecret(req, url)) {
			sendJson(res, 401, { ok: false, error: "Invalid webhook secret" });
			return;
		}

		const alreadyBuilding = Boolean(buildPromise);
		runBuild().catch((error) => console.error("Build failed", error));
		sendJson(res, alreadyBuilding ? 200 : 202, {
			ok: true,
			building: true,
			message: alreadyBuilding ? "Build already running" : "Build started",
		});
		return;
	}

	await serveStatic(req, res, url);
});

server.listen(port, host, () => {
	console.log(`notes server listening on http://${host}:${port}`);
	console.log(`serving ${outputDir}`);
});
