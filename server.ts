import { spawn } from "child_process";
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

type NotesServerOptions = {
	build?: () => Promise<void>;
	deploy?: () => Promise<void>;
	outputDir?: string;
	webhookPath?: string;
	webhookSecret?: string;
};

type LastBuild = { startedAt: string; finishedAt?: string; error?: string } | null;

type CloudflarePagesConfig = {
	projectName?: string;
	branch?: string;
	outputDir: string;
};

function sendJson(res: http.ServerResponse, statusCode: number, body: unknown) {
	res.writeHead(statusCode, { "Content-Type": "application/json" });
	res.end(JSON.stringify(body));
}

function hasValidSecret(req: http.IncomingMessage, url: URL, webhookSecret?: string) {
	if (!webhookSecret) {
		return false;
	}

	const headerSecret = req.headers["x-webhook-secret"];
	const token = Array.isArray(headerSecret) ? headerSecret[0] : headerSecret;
	return token === webhookSecret || url.searchParams.get("secret") === webhookSecret;
}

async function runBuild(
	build: () => Promise<void>,
	state: { buildPromise: Promise<void> | null; lastBuild: LastBuild },
) {
	if (state.buildPromise) {
		return state.buildPromise;
	}

	state.lastBuild = { startedAt: new Date().toISOString() };
	state.buildPromise = (async () => {
		try {
			await build();
			state.lastBuild = { ...state.lastBuild!, finishedAt: new Date().toISOString() };
		} catch (error) {
			state.lastBuild = {
				...state.lastBuild!,
				finishedAt: new Date().toISOString(),
				error: error instanceof Error ? error.message : String(error),
			};
			throw error;
		} finally {
			state.buildPromise = null;
		}
	})();

	return state.buildPromise;
}

async function mainBuild() {
	const { main } = await import("./index");
	await main();
}

function deployToCloudflarePages({ projectName, branch, outputDir }: CloudflarePagesConfig) {
	if (!projectName) {
		return Promise.resolve();
	}

	const args = ["wrangler", "pages", "deploy", outputDir, "--project-name", projectName];
	if (branch) {
		args.push("--branch", branch);
	}

	return new Promise<void>((resolve, reject) => {
		const child = spawn("npx", args, { stdio: "inherit" });
		child.on("error", reject);
		child.on("close", (code) => {
			if (code === 0) {
				resolve();
				return;
			}

			reject(new Error(`Cloudflare Pages deploy failed with exit code ${code}`));
		});
	});
}

async function serveStatic(
	req: http.IncomingMessage,
	res: http.ServerResponse,
	url: URL,
	outputDir: string,
) {
	let pathname = decodeURIComponent(url.pathname);
	if (pathname.startsWith("/fonts/")) {
		pathname = pathname.replace(/^\/fonts/, "");
	}
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

function createNotesServer(options: NotesServerOptions = {}) {
	const outputDir = path.resolve(
		options.outputDir || process.env.BUILD || path.join(__dirname, "site"),
	);
	const webhookPath = options.webhookPath || process.env.WEBHOOK_PATH || "/webhook/notion";
	const webhookSecret = options.webhookSecret ?? process.env.WEBHOOK_SECRET;
	const build = options.build || mainBuild;
	const deploy =
		options.deploy ||
		(options.build
			? () => Promise.resolve()
			: () =>
					deployToCloudflarePages({
						projectName: process.env.CLOUDFLARE_PAGES_PROJECT_NAME,
						branch: process.env.CLOUDFLARE_PAGES_BRANCH,
						outputDir,
					}));
	const buildAndDeploy = async () => {
		await build();
		await deploy();
	};
	const state: { buildPromise: Promise<void> | null; lastBuild: LastBuild } = {
		buildPromise: null,
		lastBuild: null,
	};

	process.env.BUILD = outputDir;

	return http.createServer(async (req, res) => {
		const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

		if (url.pathname === "/healthz") {
			sendJson(res, 200, {
				ok: true,
				building: Boolean(state.buildPromise),
				lastBuild: state.lastBuild,
			});
			return;
		}

		if (url.pathname === webhookPath) {
			if (req.method !== "GET" && req.method !== "POST") {
				res.writeHead(405, { Allow: "GET, POST" });
				res.end("Method not allowed");
				return;
			}

			if (!hasValidSecret(req, url, webhookSecret)) {
				sendJson(res, 401, { ok: false, error: "Invalid webhook secret" });
				return;
			}

			const alreadyBuilding = Boolean(state.buildPromise);
			runBuild(buildAndDeploy, state).catch((error) => console.error("Build failed", error));
			sendJson(res, alreadyBuilding ? 200 : 202, {
				ok: true,
				building: true,
				message: alreadyBuilding ? "Build already running" : "Build started",
			});
			return;
		}

		await serveStatic(req, res, url, outputDir);
	});
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
	const port = Number(process.env.PORT || 3000);
	const host = process.env.HOST || "127.0.0.1";
	const server = createNotesServer();

	server.listen(port, host, () => {
		console.log(`notes server listening on http://${host}:${port}`);
		console.log(`serving ${process.env.BUILD}`);
	});
}

export { createNotesServer, hasValidSecret, runBuild, serveStatic };
