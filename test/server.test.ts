import fs from "fs";
import http from "http";
import os from "os";
import path from "path";

import { afterEach, describe, expect, test, vi } from "vitest";

import { createNotesServer, runBuild } from "../server";

let server: http.Server | null = null;
let tmpRoot: string | null = null;

const startServer = async (options: Parameters<typeof createNotesServer>[0]) => {
	server = createNotesServer(options);
	await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (!address || typeof address === "string") {
		throw new Error("Expected an ephemeral TCP server address");
	}
	return `http://127.0.0.1:${address.port}`;
};

afterEach(async () => {
	if (server) {
		await new Promise<void>((resolve, reject) => {
			server!.close((error) => (error ? reject(error) : resolve()));
		});
		server = null;
	}

	if (tmpRoot) {
		fs.rmSync(tmpRoot, { force: true, recursive: true });
		tmpRoot = null;
	}

	vi.restoreAllMocks();
});

describe("createNotesServer", () => {
	test("serves static files with cache headers, etags, redirects, and font aliases", async () => {
		tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "notes-server-static-"));
		const outputDir = path.join(tmpRoot, "site");
		fs.mkdirSync(path.join(outputDir, "blog"), { recursive: true });
		fs.writeFileSync(path.join(outputDir, "index.html"), "<h1>Home</h1>");
		fs.writeFileSync(path.join(outputDir, "app.js"), "console.log('ok');");
		fs.writeFileSync(path.join(outputDir, "font.woff2"), "font");

		const baseUrl = await startServer({ outputDir });
		const html = await fetch(`${baseUrl}/`);
		const etag = html.headers.get("etag");

		expect(html.status).toBe(200);
		expect(html.headers.get("content-type")).toContain("text/html");
		expect(html.headers.get("cache-control")).toBe("no-cache");
		expect(etag).toBeTruthy();
		expect(await html.text()).toBe("<h1>Home</h1>");

		const notModified = await fetch(`${baseUrl}/`, { headers: { "If-None-Match": etag! } });
		expect(notModified.status).toBe(304);

		const script = await fetch(`${baseUrl}/app.js`);
		expect(script.status).toBe(200);
		expect(script.headers.get("cache-control")).toBe("public, max-age=3600, immutable");

		const font = await fetch(`${baseUrl}/fonts/font.woff2`);
		expect(font.status).toBe(200);
		expect(font.headers.get("cache-control")).toBe("public, max-age=604800, immutable");

		const directory = await fetch(`${baseUrl}/blog`, { redirect: "manual" });
		expect(directory.status).toBe(301);
		expect(directory.headers.get("location")).toBe("/blog/");
	});

	test("rejects traversal attempts and returns 404 for missing files", async () => {
		tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "notes-server-paths-"));
		const outputDir = path.join(tmpRoot, "site");
		fs.mkdirSync(outputDir, { recursive: true });

		const baseUrl = await startServer({ outputDir });

		const traversal = await fetch(`${baseUrl}/%2e%2e%2fpackage.json`);
		expect(traversal.status).toBe(403);
		expect(await traversal.text()).toBe("Forbidden");

		const missing = await fetch(`${baseUrl}/missing.txt`);
		expect(missing.status).toBe(404);
		expect(await missing.text()).toBe("Not found");
	});

	test("reports health and coalesces authenticated webhook builds", async () => {
		tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "notes-server-webhook-"));
		const outputDir = path.join(tmpRoot, "site");
		fs.mkdirSync(outputDir, { recursive: true });

		let finishBuild!: () => void;
		const build = vi.fn(
			() =>
				new Promise<void>((resolve) => {
					finishBuild = resolve;
				}),
		);

		const baseUrl = await startServer({ build, outputDir, webhookSecret: "secret" });

		const initialHealth = await fetch(`${baseUrl}/healthz`);
		expect(initialHealth.status).toBe(200);
		expect(await initialHealth.json()).toMatchObject({
			ok: true,
			building: false,
			lastBuild: null,
		});

		const wrongSecret = await fetch(`${baseUrl}/webhook/notion`);
		expect(wrongSecret.status).toBe(401);
		expect(await wrongSecret.json()).toEqual({ ok: false, error: "Invalid webhook secret" });

		const wrongMethod = await fetch(`${baseUrl}/webhook/notion?secret=secret`, { method: "PUT" });
		expect(wrongMethod.status).toBe(405);
		expect(wrongMethod.headers.get("allow")).toBe("GET, POST");

		const started = await fetch(`${baseUrl}/webhook/notion?secret=secret`);
		expect(started.status).toBe(202);
		expect(await started.json()).toEqual({ ok: true, building: true, message: "Build started" });

		const coalesced = await fetch(`${baseUrl}/webhook/notion`, {
			method: "POST",
			headers: { "x-webhook-secret": "secret" },
		});
		expect(coalesced.status).toBe(200);
		expect(await coalesced.json()).toEqual({
			ok: true,
			building: true,
			message: "Build already running",
		});
		expect(build).toHaveBeenCalledTimes(1);

		const buildingHealth = await fetch(`${baseUrl}/healthz`);
		expect(await buildingHealth.json()).toMatchObject({ ok: true, building: true });

		finishBuild();
		await vi.waitFor(async () => {
			const finishedHealth = await fetch(`${baseUrl}/healthz`);
			const body = await finishedHealth.json();
			expect(body.building).toBe(false);
			expect(body.lastBuild.finishedAt).toEqual(expect.any(String));
		});
	});
});

test("runBuild records failures and clears in-flight state", async () => {
	const state = { buildPromise: null, lastBuild: null };
	const error = new Error("build failed");

	await expect(runBuild(() => Promise.reject(error), state)).rejects.toThrow("build failed");

	expect(state.buildPromise).toBeNull();
	expect(state.lastBuild).toMatchObject({
		startedAt: expect.any(String),
		finishedAt: expect.any(String),
		error: "build failed",
	});
});
