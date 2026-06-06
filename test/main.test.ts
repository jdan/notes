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

let tmpRoot: string | null = null;
const originalEnv = { ...process.env };

afterEach(() => {
	forEachRowMock.mockReset();
	process.env = { ...originalEnv };
	if (tmpRoot) {
		fs.rmSync(tmpRoot, { force: true, recursive: true });
		tmpRoot = null;
	}
	vi.resetModules();
});

test("main builds pages and feed from Notion rows", async () => {
	tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "notes-main-"));
	process.env.BUILD = tmpRoot;
	process.env.SQLITE_DB_FILE = path.join(tmpRoot, "db.sqlite3");
	process.env.NOTION_SECRET = "secret_123";
	process.env.NOTION_DATABASE_ID = "database_123";
	process.env.BASE_URL = "/";

	const page = {
		id: "11111111-1111-4111-8111-111111111111",
		created_time: "2024-01-01T00:00:00.000Z",
		last_edited_time: "2024-01-02T00:00:00.000Z",
		icon: { type: "emoji", emoji: "❤️" },
		properties: {
			Name: { title: [richText("Main Test")] },
			Filename: { rich_text: [richText("main-test.html")] },
			"og:image": { files: [] },
			"Publish to RSS": { checkbox: true },
		},
	};
	const notion = {
		blocks: {
			children: {
				list: vi.fn().mockResolvedValue({
					results: [
						{
							id: "block-1",
							type: "paragraph",
							has_children: false,
							paragraph: { text: [richText("Built by main")] },
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

	const { main } = await import("../index");
	await main();

	expect(forEachRowMock).toHaveBeenCalledWith(
		{ token: "secret_123", database: "database_123" },
		expect.any(Function),
	);
	expect(fs.readFileSync(path.join(tmpRoot, "main-test.html"), "utf8")).toContain("Built by main");
	expect(fs.readFileSync(path.join(tmpRoot, "feed.atom"), "utf8")).toContain("Main Test");
});
