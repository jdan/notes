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

const richText = (content: string, link: { url: string } | null = null) => ({
	type: "text",
	text: { content, link },
	annotations,
	plain_text: content,
	href: link?.url || null,
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
	const outputDir = path.join(tmpRoot, "output");
	process.env.BUILD = outputDir;
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
	const olderPage = {
		...page,
		id: "22222222-2222-4222-8222-222222222222",
		created_time: "2023-01-01T00:00:00.000Z",
		last_edited_time: "2024-01-01T00:00:00.000Z",
		properties: {
			...page.properties,
			Name: { title: [richText("Older Main Test")] },
			Filename: { rich_text: [richText("older-main-test.html")] },
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
							paragraph: {
								text: [richText("Built by main", { url: "/22222222222242228222222222222222" })],
							},
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
		await callback(olderPage, notion);
	});

	const { main } = await import("../index");
	await main();
	const feedPath = path.join(outputDir, "feed.atom");
	const firstFeedStat = fs.statSync(feedPath);
	const firstFeed = fs.readFileSync(feedPath, "utf8");
	await main();
	const secondFeedStat = fs.statSync(feedPath);
	const secondFeed = fs.readFileSync(feedPath, "utf8");

	expect(forEachRowMock).toHaveBeenCalledWith(
		{ token: "secret_123", database: "database_123" },
		expect.any(Function),
	);
	expect(notion.blocks.children.list).toHaveBeenCalledTimes(2);
	expect(fs.existsSync(outputDir)).toBe(true);
	expect(fs.readFileSync(path.join(outputDir, "main-test.html"), "utf8")).toContain(
		"Built by main",
	);
	const olderPageHtml = fs.readFileSync(path.join(outputDir, "older-main-test.html"), "utf8");
	expect(olderPageHtml.match(/href="\/main-test"/g) || []).toHaveLength(1);
	expect(secondFeed).toBe(firstFeed);
	expect(secondFeedStat.mtimeMs).toBe(firstFeedStat.mtimeMs);
	expect(secondFeed).toContain("<updated>2024-01-02T00:00:00.000Z</updated>");
	expect(secondFeed).toContain("Main Test");
	expect(secondFeed).toContain("Older Main Test");
});

test("main can debug a single page without a hardcoded source toggle", async () => {
	tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "notes-main-debug-"));
	const outputDir = path.join(tmpRoot, "output");
	process.env.BUILD = outputDir;
	process.env.SQLITE_DB_FILE = path.join(tmpRoot, "db.sqlite3");
	process.env.NOTION_SECRET = "secret_123";
	process.env.NOTION_DATABASE_ID = "database_123";
	process.env.BASE_URL = "/";

	const debugPage = {
		id: "33333333-3333-4333-8333-333333333333",
		created_time: "2024-01-01T00:00:00.000Z",
		last_edited_time: "2024-01-02T00:00:00.000Z",
		icon: null,
		properties: {
			Name: { title: [richText("Debug Main Test")] },
			Filename: { rich_text: [richText("debug-main-test.html")] },
			"og:image": { files: [] },
			"Publish to RSS": { checkbox: true },
		},
	};
	const skippedPage = {
		...debugPage,
		id: "44444444-4444-4444-8444-444444444444",
		properties: {
			...debugPage.properties,
			Name: { title: [richText("Skipped Main Test")] },
			Filename: { rich_text: [richText("skipped-main-test.html")] },
		},
	};
	const notion = {
		blocks: {
			children: {
				list: vi.fn().mockResolvedValue({
					results: [
						{
							id: "debug-block-1",
							type: "paragraph",
							has_children: false,
							paragraph: { text: [richText("Built in debug mode")] },
						},
					],
					has_more: false,
					next_cursor: null,
				}),
			},
		},
	};
	forEachRowMock.mockImplementation(async (_config, callback) => {
		await callback(skippedPage, notion);
		await callback(debugPage, notion);
	});
	const logger = { log: vi.fn() };

	const { main } = await import("../index");
	await main({ debugPageId: debugPage.id, logger });
	await main({ debugPageId: debugPage.id, logger });

	expect(notion.blocks.children.list).toHaveBeenCalledTimes(2);
	expect(fs.readFileSync(path.join(outputDir, "debug-main-test.html"), "utf8")).toContain(
		"Built in debug mode",
	);
	expect(fs.existsSync(path.join(outputDir, "skipped-main-test.html"))).toBe(false);
	expect(logger.log).toHaveBeenCalledWith("[DEBUG]", "paragraph", "debug-block-1");
});
