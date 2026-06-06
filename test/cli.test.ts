// @ts-nocheck
import fs from "fs";
import os from "os";
import path from "path";

import { afterEach, expect, test, vi } from "vitest";

const forEachRowMock = vi.hoisted(() => vi.fn());

vi.mock("notion-for-each-row", () => ({
	default: forEachRowMock,
}));

const annotations = {
	bold: false,
	italic: false,
	strikethrough: false,
	underline: false,
	code: false,
	color: "default",
};

const richText = (content: string) => ({
	type: "text",
	text: { content, link: null },
	annotations,
	plain_text: content,
	href: null,
});

const originalArgv = [...process.argv];
const originalEnv = { ...process.env };
let tmpRoot: string | null = null;

const waitForFile = async (filename: string) => {
	for (let i = 0; i < 100; i++) {
		if (fs.existsSync(filename)) return;
		await new Promise((resolve) => setTimeout(resolve, 10));
	}
	throw new Error(`Timed out waiting for ${filename}`);
};

afterEach(() => {
	forEachRowMock.mockReset();
	process.argv = [...originalArgv];
	process.env = { ...originalEnv };
	if (tmpRoot) {
		fs.rmSync(tmpRoot, { force: true, recursive: true });
		tmpRoot = null;
	}
	vi.resetModules();
});

test("runs main when index.ts is executed directly", async () => {
	tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "notes-cli-"));
	const outputDir = path.join(tmpRoot, "output");
	process.argv = [process.argv[0], path.resolve("index.ts")];
	process.env.BUILD = outputDir;
	process.env.SQLITE_DB_FILE = path.join(tmpRoot, "db.sqlite3");
	process.env.NOTION_SECRET = "secret_123";
	process.env.NOTION_DATABASE_ID = "database_123";
	process.env.BASE_URL = "/";

	const page = {
		id: "33333333-3333-4333-8333-333333333333",
		created_time: "2024-01-01T00:00:00.000Z",
		last_edited_time: "2024-01-02T00:00:00.000Z",
		icon: null,
		properties: {
			Name: { title: [richText("CLI Test")] },
			Filename: { rich_text: [richText("cli-test.html")] },
			"og:image": { files: [] },
			"Publish to RSS": { checkbox: false },
		},
	};
	const notion = {
		blocks: {
			children: {
				list: vi.fn().mockResolvedValue({
					results: [
						{
							id: "cli-block-1",
							type: "paragraph",
							has_children: false,
							paragraph: { text: [richText("Built by CLI")] },
						},
					],
					has_more: false,
					next_cursor: null,
				}),
			},
		},
	};
	forEachRowMock.mockImplementation(async (_config, callback) => {
		await callback(page, notion);
	});

	await import("../index");
	await waitForFile(path.join(outputDir, "feed.atom"));

	expect(fs.readFileSync(path.join(outputDir, "cli-test.html"), "utf8")).toContain("Built by CLI");
});

test("exits with an error when direct execution fails", async () => {
	tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "notes-cli-error-"));
	const outputDir = path.join(tmpRoot, "output");
	process.argv = [process.argv[0], path.resolve("index.ts")];
	process.env.BUILD = outputDir;
	process.env.SQLITE_DB_FILE = path.join(tmpRoot, "db.sqlite3");
	process.env.NOTION_SECRET = "secret_123";
	process.env.NOTION_DATABASE_ID = "database_123";
	process.env.BASE_URL = "/";
	const error = new Error("notion failed");
	const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
	const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
	forEachRowMock.mockRejectedValue(error);

	try {
		await import("../index");
		for (let i = 0; i < 100; i++) {
			if (exitSpy.mock.calls.length) break;
			await new Promise((resolve) => setTimeout(resolve, 10));
		}

		expect(errorSpy).toHaveBeenCalledWith(error);
		expect(exitSpy).toHaveBeenCalledWith(1);
	} finally {
		errorSpy.mockRestore();
		exitSpy.mockRestore();
	}
});
