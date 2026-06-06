// @ts-nocheck
import fs from "fs";
import os from "os";
import path from "path";

import { describe, expect, test, vi } from "vitest";

import {
	addDashes,
	blockToHtml,
	concatenateText,
	copyStaticAssets,
	downloadImage,
	getAllChildBlocks,
	getChildren,
	getPageModel,
	groupAdjacentBlocksRecursively,
	longDate,
	registerBacklink,
	saveEmojiFavicon,
	saveFavicon,
	savePage,
	settings,
	sluggify,
	textToHtml,
} from "../index";

const annotations = {
	bold: false,
	italic: false,
	strikethrough: false,
	underline: false,
	code: false,
	color: "default",
};

const richText = (content: string, overrides = {}) => ({
	type: "text",
	text: { content, link: overrides.link || null },
	annotations: { ...annotations, ...(overrides.annotations || {}) },
	plain_text: content,
	href: overrides.link ? overrides.link.url : null,
});

const an = (overrides: Record<string, boolean>) => ({
	...annotations,
	...overrides,
});

const page = {
	id: "cd2cb8c2-dcc6-4da4-bb02-5fa71513b780",
	title: "Test Page",
	filename: "test-page.html",
	favicon: "",
	blocks: [],
} as any;

const pages = [page];

const originalBuild = process.env.BUILD;
const testBuildDir = fs.mkdtempSync(path.join(os.tmpdir(), "notes-unit-"));

beforeAll(() => {
	process.env.BUILD = testBuildDir;
});

afterAll(() => {
	if (originalBuild === undefined) {
		delete process.env.BUILD;
	} else {
		process.env.BUILD = originalBuild;
	}
	fs.rmSync(testBuildDir, { force: true, recursive: true });
});

describe("addDashes", () => {
	test("formats a 32-char hex string with dashes", () => {
		expect(addDashes("cd2cb8c2dcc64da4bb025fa71513b780")).toBe(
			"cd2cb8c2-dcc6-4da4-bb02-5fa71513b780",
		);
	});
});

describe("concatenateText", () => {
	test("joins rich text array", () => {
		const arr = [richText("hello "), richText("world")];
		expect(concatenateText(arr)).toBe("hello world");
	});

	test("returns empty string for undefined", () => {
		expect(concatenateText(undefined)).toBe("");
	});
});

describe("sluggify", () => {
	test("lowercases and replaces non-alphanumeric with hyphens", () => {
		expect(sluggify("Hello World!")).toBe("hello-world-");
	});

	test("handles multiple spaces/special chars", () => {
		expect(sluggify("A   B___C:::D")).toBe("a-b-c-d");
	});
});

describe("longDate", () => {
	test("formats a date-only string", () => {
		expect(longDate("2024-01-15")).toBe("January 15, 2024");
	});
});

describe("registerBacklink", () => {
	test("registers a new backlink entry", () => {
		registerBacklink("source-1", "dest-1");
		// call again to hit the append path
		registerBacklink("source-2", "dest-1");
	});
});

describe("groupAdjacentBlocksRecursively", () => {
	test("groups adjacent list items with nested children", () => {
		const blocks = [
			{
				id: "a",
				type: "numbered_list_item",
				has_children: true,
				children: [
					{
						id: "a1",
						type: "bulleted_list_item",
						has_children: false,
						children: [],
						bulleted_list_item: { text: [] },
					},
				],
				numbered_list_item: { text: [] },
			},
		];
		const result = groupAdjacentBlocksRecursively(
			blocks as any,
			"numbered_list_item",
			"numbered_list",
		);
		expect(result).toHaveLength(1);
		expect(result[0].type).toBe("numbered_list");
		expect((result[0] as any).children[0].children).toHaveLength(1);
	});

	test("handles non-list blocks between list items", () => {
		const blocks = [
			{
				id: "a",
				type: "numbered_list_item",
				has_children: false,
				children: [],
				numbered_list_item: { text: [] },
			},
			{ id: "b", type: "paragraph", has_children: false, children: [], paragraph: { text: [] } },
			{
				id: "c",
				type: "numbered_list_item",
				has_children: false,
				children: [],
				numbered_list_item: { text: [] },
			},
		];
		const result = groupAdjacentBlocksRecursively(
			blocks as any,
			"numbered_list_item",
			"numbered_list",
		);
		expect(result).toHaveLength(3);
		expect(result[0].type).toBe("numbered_list");
		expect(result[1].type).toBe("paragraph");
		expect(result[2].type).toBe("numbered_list");
	});

	test("creates trailing group for list items at end", () => {
		const blocks = [
			{ id: "a", type: "paragraph", has_children: false, children: [], paragraph: { text: [] } },
			{
				id: "b",
				type: "bulleted_list_item",
				has_children: false,
				children: [],
				bulleted_list_item: { text: [] },
			},
			{
				id: "c",
				type: "bulleted_list_item",
				has_children: false,
				children: [],
				bulleted_list_item: { text: [] },
			},
		];
		const result = groupAdjacentBlocksRecursively(
			blocks as any,
			"bulleted_list_item",
			"bulleted_list",
		);
		expect(result).toHaveLength(2);
		expect(result[0].type).toBe("paragraph");
		expect(result[1].type).toBe("bulleted_list");
		expect((result[1] as any).children).toHaveLength(2);
	});
});

describe("textToHtml", () => {
	test("plain text", async () => {
		const result = await textToHtml("page-1", richText("hello"), pages);
		expect(result).toBe("hello");
	});

	test("bold annotation", async () => {
		const result = await textToHtml(
			"page-1",
			richText("bold", { annotations: an({ bold: true }) }),
			pages,
		);
		expect(result).toBe("<strong>bold</strong>");
	});

	test("italic annotation", async () => {
		const result = await textToHtml(
			"page-1",
			richText("italic", { annotations: an({ italic: true }) }),
			pages,
		);
		expect(result).toBe("<em>italic</em>");
	});

	test("underline annotation", async () => {
		const result = await textToHtml(
			"page-1",
			richText("underline", { annotations: an({ underline: true }) }),
			pages,
		);
		expect(result).toBe("<u>underline</u>");
	});

	test("strikethrough annotation", async () => {
		const result = await textToHtml(
			"page-1",
			richText("strike", { annotations: an({ strikethrough: true }) }),
			pages,
		);
		expect(result).toBe("<strike>strike</strike>");
	});

	test("code annotation", async () => {
		const result = await textToHtml(
			"page-1",
			richText("code", { annotations: an({ code: true }) }),
			pages,
		);
		expect(result).toBe("<code>code</code>");
	});

	test("external link", async () => {
		const result = await textToHtml(
			"page-1",
			richText("click", { link: { url: "https://example.com" } }),
			pages,
		);
		expect(result).toBe('<a href="https://example.com">click</a>');
	});

	test("mastodon link gets rel=me", async () => {
		const result = await textToHtml(
			"page-1",
			richText("mastodon", { link: { url: "https://mastodon.xyz/@jordan" } }),
			pages,
		);
		expect(result).toBe('<a rel="me" href="https://mastodon.xyz/@jordan">mastodon</a>');
	});

	test("backlink starting with / resolves to page link", async () => {
		const result = await textToHtml(
			"source-id",
			richText("link text", { link: { url: "/cd2cb8c2dcc64da4bb025fa71513b780" } }),
			pages,
		);
		expect(result).toContain('href="/test-page.html"');
		expect(result).toContain("link text");
	});

	test("backlink with no matching page shows bracketed id", async () => {
		const result = await textToHtml(
			"source-id",
			richText("x", { link: { url: "/123456789012345678901234567890123456" } }),
			pages,
		);
		expect(result).toBe("[12345678-9012-3456-7890-123456789012]");
	});

	test("backlink respects BASE_URL env", async () => {
		const orig = process.env.BASE_URL;
		process.env.BASE_URL = "/prefix/";
		try {
			const result = await textToHtml(
				"source-id",
				richText("link text", { link: { url: "/cd2cb8c2dcc64da4bb025fa71513b780" } }),
				pages,
			);
			expect(result).toContain('href="/prefix/test-page.html"');
		} finally {
			process.env.BASE_URL = orig;
		}
	});

	test("page mention", async () => {
		const result = await textToHtml(
			"source-id",
			{
				type: "mention",
				mention: {
					type: "page",
					page: { id: "cd2cb8c2-dcc6-4da4-bb02-5fa71513b780" },
				},
				annotations,
				plain_text: "Test Page",
				href: null,
			},
			pages,
		);
		expect(result).toContain('href="/test-page.html"');
	});

	test("date-only mention", async () => {
		const result = await textToHtml(
			"page-1",
			{
				type: "mention",
				mention: {
					type: "date",
					date: { start: "2024-06-15", end: null, time_zone: null },
				},
				annotations,
				plain_text: "2024-06-15",
				href: null,
			},
			pages,
		);
		expect(result).toBe("June 15, 2024");
	});

	test("datetime mention", async () => {
		const result = await textToHtml(
			"page-1",
			{
				type: "mention",
				mention: {
					type: "date",
					date: { start: "2024-06-15T14:30:00.000Z", end: null, time_zone: null },
				},
				annotations,
				plain_text: "2024-06-15T14:30:00.000Z",
				href: null,
			},
			pages,
		);
		expect(result).toMatch(/June \d{1,2}, 2024 - 14:30/);
	});

	test("template mention returns empty string", async () => {
		const result = await textToHtml(
			"page-1",
			{
				type: "mention",
				mention: { type: "template_mention" as any, date: null },
				annotations,
				plain_text: "",
				href: null,
			},
			pages,
		);
		expect(result).toBe("");
	});

	test("equation", async () => {
		const result = await textToHtml(
			"page-1",
			{
				type: "equation",
				equation: { expression: "E = mc^2" },
				annotations,
				plain_text: "E = mc^2",
				href: null,
			},
			pages,
		);
		expect(result).toContain("E = mc");
	});

	test("escapes HTML in text content", async () => {
		const result = await textToHtml("page-1", richText("<script>alert('xss')</script>"), pages);
		expect(result).not.toContain("<script>");
		expect(result).toContain("&lt;script&gt;");
	});

	test("emoji in text is replaced with img tag", async () => {
		const result = await textToHtml("page-1", richText("hello ❤️ world"), pages);
		expect(result).toBe('hello <img class="emoji" alt="❤️" src="2764-fe0f.png" /> world');
	});

	test("unrecognized mention type returns undefined", async () => {
		const result = await textToHtml(
			"page-1",
			{
				type: "mention",
				mention: { type: "user" },
				annotations,
				plain_text: "@user",
				href: null,
			} as any,
			pages,
		);
		expect(result).toBeUndefined();
	});

	test("unrecognized text type returns undefined", async () => {
		const result = await textToHtml(
			"page-1",
			{
				type: "unknown_type",
				annotations,
				plain_text: "",
				href: null,
			} as any,
			pages,
		);
		expect(result).toBeUndefined();
	});

	test("backlink with favicon page renders emoji in link", async () => {
		const favPages = [
			{
				id: "cd2cb8c2-dcc6-4da4-bb02-5fa71513b780",
				title: "Test Page",
				filename: "test-page.html",
				favicon: "2764-fe0f.png",
				blocks: [],
			} as any,
		];
		const result = await textToHtml(
			"source-id",
			richText("link text", { link: { url: "/cd2cb8c2dcc64da4bb025fa71513b780" } }),
			favPages,
		);
		expect(result).toContain('class="with-emoji"');
		expect(result).toContain('alt=""');
	});
});

describe("settings", () => {
	const save = (key: string) => {
		const v = process.env[key];
		return () => {
			if (v === undefined) {
				delete process.env[key];
			} else {
				process.env[key] = v;
			}
		};
	};

	test("twitterHandle", () => {
		const restore = save("TWITTER_HANDLE");
		process.env.TWITTER_HANDLE = "@test";
		expect(settings.twitterHandle).toBe("@test");
		delete process.env.TWITTER_HANDLE;
		expect(settings.twitterHandle).toBe("jdan");
		restore();
	});

	test("ogImage", () => {
		const restore = save("OG_IMAGE");
		process.env.OG_IMAGE = "https://example.com/img.png";
		expect(settings.ogImage).toBe("https://example.com/img.png");
		delete process.env.OG_IMAGE;
		expect(settings.ogImage).toBe("https://notes.jordanscales.com/me.png");
		restore();
	});

	test("baseUrl", () => {
		const restore = save("BASE_URL");
		process.env.BASE_URL = "/prefix/";
		expect(settings.baseUrl).toBe("/prefix/");
		delete process.env.BASE_URL;
		expect(settings.baseUrl).toBe("/");
		restore();
	});

	test("dbFile defaults", () => {
		const restore = save("SQLITE_DB_FILE");
		delete process.env.SQLITE_DB_FILE;
		expect(settings.dbFile).toBe("db.sqlite3");
		restore();
	});

	test("outputDir uses BUILD when set", () => {
		const restore = save("BUILD");
		process.env.BUILD = "/tmp/custom-build";
		expect(settings.outputDir).toBe("/tmp/custom-build");
		restore();
	});

	test("outputDir handles non-slash base URL", () => {
		const restoreBuild = save("BUILD");
		const restoreBaseUrl = save("BASE_URL");
		delete process.env.BUILD;
		process.env.BASE_URL = "notes";
		expect(settings.outputDir).toMatch(/\/build$/);
		restoreBuild();
		restoreBaseUrl();
	});

	test("output joins paths inside outputDir", () => {
		const restore = save("BUILD");
		process.env.BUILD = "/tmp/custom-build";
		expect(settings.output("page.html")).toBe("/tmp/custom-build/page.html");
		restore();
	});

	test("notionSecret throws when missing", () => {
		const restore = save("NOTION_SECRET");
		delete process.env.NOTION_SECRET;
		expect(() => settings.notionSecret).toThrow("Missing NOTION_SECRET");
		restore();
	});

	test("notionSecret returns when set", () => {
		const restore = save("NOTION_SECRET");
		process.env.NOTION_SECRET = "secret_123";
		expect(settings.notionSecret).toBe("secret_123");
		restore();
	});

	test("notionDatabaseId throws when missing", () => {
		const restore = save("NOTION_DATABASE_ID");
		delete process.env.NOTION_DATABASE_ID;
		expect(() => settings.notionDatabaseId).toThrow("Missing NOTION_DATABASE_ID");
		restore();
	});

	test("notionDatabaseId returns when set", () => {
		const restore = save("NOTION_DATABASE_ID");
		process.env.NOTION_DATABASE_ID = "db_123";
		expect(settings.notionDatabaseId).toBe("db_123");
		restore();
	});

	test("url method", () => {
		const restore = save("BASE_URL");
		process.env.BASE_URL = "/";
		expect(settings.url("test.html")).toBe("/test.html");
		process.env.BASE_URL = "/prefix";
		expect(settings.url("test.html")).toBe("/prefix/test.html");
		process.env.BASE_URL = "/prefix/";
		expect(settings.url("test.html")).toBe("/prefix/test.html");
		expect(settings.url("/test.html")).toBe("/prefix/test.html");
		expect(settings.url("/")).toBe("/prefix/");
		restore();
	});

	test("info returns correct object", () => {
		const restore1 = save("BASE_URL");
		const restore2 = save("NOTION_DATABASE_ID");
		const restore3 = save("TWITTER_HANDLE");
		const restore4 = save("OG_IMAGE");
		process.env.BASE_URL = "/";
		process.env.NOTION_DATABASE_ID = "db_123";
		process.env.TWITTER_HANDLE = "@t";
		process.env.OG_IMAGE = "https://example.com/og.png";
		const result = settings.info();
		expect(result.baseUrl).toBe("/");
		expect(result.notionDatabaseId).toBe("db_123");
		expect(result.twitterHandle).toBe("@t");
		expect(result.ogImage).toBe("https://example.com/og.png");
		restore1();
		restore2();
		restore3();
		restore4();
	});
});

describe("saveEmojiFavicon", () => {
	const createdFiles: string[] = [];

	afterAll(() => {
		const fs = require("fs");
		const path = require("path");
		for (const f of createdFiles) {
			const dest = path.join(settings.outputDir, f);
			if (fs.existsSync(dest)) {
				fs.unlinkSync(dest);
			}
		}
	});

	test("returns basename for known emoji", async () => {
		const result = await saveEmojiFavicon("❤️");
		expect(result).toBe("2764-fe0f.png");
		createdFiles.push("2764-fe0f.png");
	});

	test("logs for emoji without datasource file", async () => {
		const fs = await import("fs");
		const dest = settings.output("2764.png");
		if (!fs.existsSync(dest)) {
			fs.writeFileSync(dest, "");
		}
		const result = await saveEmojiFavicon("❤");
		expect(result).toBe("2764.png");
		createdFiles.push("2764.png");
	});

	test("copies emoji file when dest does not exist", async () => {
		const fs = await import("fs");
		const dest = settings.output("2764-fe0f.png");

		const exists = fs.existsSync(dest);
		if (exists) {
			fs.unlinkSync(dest);
		}
		const result = await saveEmojiFavicon("❤️");
		expect(result).toBe("2764-fe0f.png");
		expect(fs.existsSync(dest)).toBe(true);
	});
});

describe("saveFavicon", () => {
	test("returns undefined for missing icon", async () => {
		await expect(saveFavicon("page-id", null)).resolves.toBeUndefined();
	});

	test("saves emoji icon", async () => {
		await expect(saveFavicon("page-id", { type: "emoji", emoji: "❤️" })).resolves.toBe(
			"2764-fe0f.png",
		);
	});

	test("returns cached file icon", async () => {
		const fs = await import("fs");
		const path = await import("path");
		const filename = "test-file-icon.icon.png";
		const dest = path.join(settings.outputDir, filename);
		try {
			fs.writeFileSync(dest, "fake-png");
			await expect(
				saveFavicon("test-file-icon", {
					type: "file",
					file: { url: "https://example.com/icon.png" },
				}),
			).resolves.toBe(filename);
		} finally {
			if (fs.existsSync(dest)) fs.unlinkSync(dest);
		}
	});
});

describe("downloadImage", () => {
	test("downloads image when no cached file exists", async () => {
		const https = await import("https");
		const fs = await import("fs");
		const dest = settings.output("test-download.image.png");
		const stream = {
			on: vi.fn((event, callback) => {
				if (event === "finish") callback();
				return stream;
			}),
		};
		const response = {
			headers: { "content-type": "image/png" },
			pipe: vi.fn(() => stream),
		};
		const spy = vi.spyOn(https.default, "get").mockImplementation((_url, callback) => {
			callback(response as any);
			return {} as any;
		});

		try {
			if (fs.existsSync(dest)) fs.unlinkSync(dest);
			await expect(
				downloadImage("https://example.com/pic.png", "test-download.image"),
			).resolves.toBe("test-download.image.png");
			expect(response.pipe).toHaveBeenCalled();
		} finally {
			spy.mockRestore();
			if (fs.existsSync(dest)) fs.unlinkSync(dest);
		}
	});

	test("returns undefined when image write fails", async () => {
		const https = await import("https");
		const fs = await import("fs");
		const dest = settings.output("test-download-fail.image.png");
		const stream = {
			on: vi.fn((event, callback) => {
				if (event === "error") callback();
				return stream;
			}),
		};
		const response = {
			headers: { "content-type": "image/png" },
			pipe: vi.fn(() => stream),
		};
		const spy = vi.spyOn(https.default, "get").mockImplementation((_url, callback) => {
			callback(response as any);
			return {} as any;
		});

		try {
			if (fs.existsSync(dest)) fs.unlinkSync(dest);
			await expect(
				downloadImage("https://example.com/pic.png", "test-download-fail.image"),
			).resolves.toBeUndefined();
		} finally {
			spy.mockRestore();
			if (fs.existsSync(dest)) fs.unlinkSync(dest);
		}
	});
});

describe("blockToHtml", () => {
	test("logs debug output to console by default", async () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});

		try {
			await blockToHtml(
				{
					id: "debug-block",
					type: "paragraph",
					has_children: false,
					paragraph: { text: [richText("Debug block")] },
					children: [],
				} as any,
				"page-1",
				pages,
				{ debugPageId: "page-1" },
			);
			expect(spy).toHaveBeenCalledWith("[DEBUG]", "paragraph", "debug-block");
		} finally {
			spy.mockRestore();
		}
	});

	test("heading_1", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "heading_1",
				has_children: false,
				heading_1: { text: [richText("My Heading")] },
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toContain("<h1");
		expect(result).toContain("my-heading");
		expect(result).toContain("My Heading");
	});

	test("heading_2", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "heading_2",
				has_children: false,
				heading_2: { text: [richText("Sub")] },
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toContain("<h2");
	});

	test("heading_3", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "heading_3",
				has_children: false,
				heading_3: { text: [richText("Subsub")] },
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toContain("<h3");
	});

	test("toggle renders details/summary", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "toggle",
				has_children: false,
				toggle: { text: [richText("Click me")] },
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toContain("<details");
		expect(result).toContain("<summary>Click me</summary>");
	});

	test("toggle with !hide renders children directly", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "toggle",
				has_children: false,
				toggle: { text: [richText("!hide spoiler")] },
				children: [
					{
						id: "child-1",
						type: "paragraph",
						has_children: false,
						paragraph: { text: [richText("hidden content")] },
						children: [],
					},
				],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toContain("hidden content");
		expect(result).not.toContain("<details");
	});

	test("code without prism language outputs plain text", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "code",
				has_children: false,
				code: {
					caption: [],
					language: "plain text",
					text: [richText("some plain code")],
				},
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toContain("some plain code");
	});

	test("code with custom language via caption", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "code",
				has_children: false,
				code: {
					caption: [richText("lang=python")],
					language: "plain text",
					text: [richText("print('hello')")],
				},
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toContain("python");
		expect(result).toContain("print");
	});

	test("code block with preview=true renders inline script", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "code",
				has_children: false,
				code: {
					caption: [richText("preview=true")],
					language: "javascript",
					text: [richText("console.log('hi')")],
				},
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toContain("<script>");
	});

	test("image external", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "image",
				has_children: false,
				image: {
					type: "external",
					external: { url: "https://example.com/pic.png" },
					caption: [],
				},
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toContain("<figure");
		expect(result).toContain("https://example.com/pic.png");
	});

	test("to_do unchecked", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "to_do",
				has_children: false,
				to_do: { text: [richText("task")], checked: false },
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toContain("task");
		expect(result).not.toContain("checked");
	});

	test("to_do checked", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "to_do",
				has_children: false,
				to_do: { text: [richText("done")], checked: true },
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toContain("checked");
	});

	test("quote", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "quote",
				has_children: false,
				quote: { text: [richText("cited")] },
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toContain("<blockquote>");
		expect(result).toContain("cited");
	});

	test("divider", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "divider",
				has_children: false,
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toBe("<hr />");
	});

	test("unsupported", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "unsupported",
				has_children: false,
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toBe("[unsupported]");
	});

	test("synced_block renders children", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "synced_block",
				has_children: false,
				children: [
					{
						id: "c1",
						type: "divider",
						has_children: false,
						children: [],
					},
				],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toContain("<hr />");
	});

	test("template renders empty", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "template",
				has_children: false,
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toBe("");
	});

	test("embed with val.town URL", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "embed",
				has_children: false,
				embed: { url: "https://www.val.town/v/jdan.coupleHoldingHands" },
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toContain("val.town/embed/jdan.coupleHoldingHands");
	});

	test("video with youtube URL", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "video",
				has_children: false,
				video: {
					type: "external",
					external: { url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" },
				},
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toContain("youtube.com/embed/dQw4w9WgXcQ");
	});

	test("bulleted_list renders ul", async () => {
		const result = await blockToHtml(
			{
				id: "p-list",
				type: "bulleted_list",
				has_children: true,
				children: [
					{
						id: "item-1",
						type: "bulleted_list_item",
						has_children: false,
						bulleted_list_item: { text: [richText("item")] },
						children: [],
					},
				],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toContain("<ul");
		expect(result).toContain("item");
	});

	test("numbered_list renders ol", async () => {
		const result = await blockToHtml(
			{
				id: "p-list",
				type: "numbered_list",
				has_children: true,
				children: [
					{
						id: "item-1",
						type: "numbered_list_item",
						has_children: false,
						numbered_list_item: { text: [richText("first")] },
						children: [],
					},
				],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toContain("<ol");
		expect(result).toContain("first");
	});

	test("paragraph renders children div", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "paragraph",
				has_children: true,
				paragraph: { text: [richText("parent")] },
				children: [
					{
						id: "c1",
						type: "divider",
						has_children: false,
						children: [],
					},
				],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toContain("parent");
		expect(result).toContain("children");
		expect(result).toContain("<hr />");
	});

	test("equation block renders with display mode", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "equation",
				has_children: false,
				equation: { expression: "\\sum_{i=1}^n i" },
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toContain("\\sum");
	});

	test("code with unrecognized language", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "code",
				has_children: false,
				code: {
					caption: [],
					language: "boguslang",
					text: [richText("raw code")],
				},
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toContain("raw code");
	});

	test("image with unrecognized type", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "image",
				has_children: false,
				image: { type: "garbage", caption: [] },
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toBeUndefined();
	});

	test("embed with non-val-town URL", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "embed",
				has_children: false,
				embed: { url: "https://example.com" },
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toBeUndefined();
	});

	test("video with non-youtube external URL", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "video",
				has_children: false,
				video: {
					type: "external",
					external: { url: "https://vimeo.com/123" },
				},
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toBeUndefined();
	});

	test("unrecognized block type", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "garbage_block",
				has_children: false,
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toBeUndefined();
	});

	test("code preview=true with html", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "code",
				has_children: false,
				code: {
					caption: [richText("preview=true")],
					language: "html",
					text: [richText("<div>hello</div>")],
				},
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toContain("<div>hello</div>");
	});

	test("code preview=true with typescript", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "code",
				has_children: false,
				code: {
					caption: [richText("preview=true")],
					language: "typescript",
					text: [richText("const x: number = 1")],
				},
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toContain("<script>");
	});

	test("code preview=true with unrecognized language", async () => {
		const result = await blockToHtml(
			{
				id: "aaa-bbb-ccc",
				type: "code",
				has_children: false,
				code: {
					caption: [richText("preview=true")],
					language: "python",
					text: [richText("print('hi')")],
				},
				children: [],
			} as any,
			"page-1",
			pages,
		);
		expect(result).toBeUndefined();
	});
});

test("image/file block renders with cached download", async () => {
	const block = {
		id: "test-cached-image",
		type: "image",
		image: {
			type: "file",
			file: { url: "https://example.com/img.png", expiry_time: "" },
			caption: [{ type: "text", text: { content: "Alt text" }, plain_text: "Alt text" }],
		},
		children: [],
		has_children: false,
	};

	try {
		fs.writeFileSync(settings.output("test-cached-image.image.png"), "fake-png");
		const result = await blockToHtml(block as any, "page-1", pages);
		expect(result).toContain("<figure");
		expect(result).toContain("test-cached-image.image.png");
	} finally {
		const f = settings.output("test-cached-image.image.png");
		if (fs.existsSync(f)) fs.unlinkSync(f);
	}
});

describe("copyStaticAssets", () => {
	test("copies asset files", async () => {
		await copyStaticAssets();
		const fs = await import("fs");
		const path = await import("path");
		const dest = settings.output("style.css");
		expect(fs.existsSync(dest)).toBe(true);
	});
});

describe("savePage", () => {
	afterAll(() => {
		const fs = require("fs");
		const path = require("path");
		const dir = settings.outputDir;
		for (const f of fs.readdirSync(dir)) {
			if (f.startsWith("test-") && f.endsWith(".html")) {
				fs.unlinkSync(path.join(dir, f));
			}
		}
	});

	test("writes html file and returns null when publishToRss is false", async () => {
		const fs = await import("fs");
		const path = await import("path");
		const filename = "test-save-page.html";

		await savePage(
			{
				id: "test-id",
				title: "Test",
				created: "2024-01-01T00:00:00.000Z",
				favicon: "",
				headingIcon: null,
				content: "<p>Hello</p>",
				filename,
				publishToRss: false,
				ogImage: null,
			},
			{},
			[],
		);

		const dest = settings.output(filename);
		expect(fs.existsSync(dest)).toBe(true);
		const content = fs.readFileSync(dest, "utf8");
		expect(content).toContain("<title>Test</title>");
		expect(content).toContain("<p>Hello</p>");
	});

	test("returns rss item when publishToRss is true", async () => {
		const filename = "test-rss-page.html";

		const result = await savePage(
			{
				id: "rss-id",
				title: "RSS Test",
				created: "2024-01-02T00:00:00.000Z",
				favicon: "",
				headingIcon: null,
				content: "<p>RSS</p>",
				filename,
				publishToRss: true,
				ogImage: null,
			},
			{},
			[],
		);

		expect(result).not.toBeNull();
		expect(result.title).toBe("RSS Test");
		expect(result.author).toHaveLength(1);
	});

	test("renders footer with backlinks", async () => {
		const fs = await import("fs");
		const filename = "test-backlinks.html";

		await savePage(
			{
				id: "bl-page",
				title: "Backlinks",
				created: "2024-01-01T00:00:00.000Z",
				favicon: "",
				headingIcon: null,
				content: "<p>Hello</p>",
				filename,
				publishToRss: false,
				ogImage: null,
			},
			{ "bl-page": ["other-ref"] },
			[],
		);

		const dest = settings.output(filename);
		const content = fs.readFileSync(dest, "utf8");
		expect(content).toContain("mentioned in");
		expect(content).toContain("other-ref");
	});

	test("renders heading icon when provided", async () => {
		const fs = await import("fs");
		const filename = "test-heading-icon.html";

		await savePage(
			{
				id: "hi-page",
				title: "Icon Page",
				created: "2024-01-01T00:00:00.000Z",
				favicon: "",
				headingIcon: '<img width="32" height="32" alt="📝" src="icon.png" />',
				content: "<p>Content</p>",
				filename,
				publishToRss: false,
				ogImage: null,
			},
			{},
			[],
		);

		const dest = settings.output(filename);
		const content = fs.readFileSync(dest, "utf8");
		expect(content).toContain("title-row");
		expect(content).toContain("icon.png");
	});

	test("renders og:image when provided", async () => {
		const fs = await import("fs");
		const filename = "test-og-image.html";

		await savePage(
			{
				id: "og-page",
				title: "OG Page",
				created: "2024-01-01T00:00:00.000Z",
				favicon: "",
				headingIcon: null,
				content: "<p>OG</p>",
				filename,
				publishToRss: false,
				ogImage: "custom-og.png",
			},
			{},
			[],
		);

		const dest = settings.output(filename);
		const content = fs.readFileSync(dest, "utf8");
		expect(content).toContain("summary_large_image");
		expect(content).toContain("custom-og.png");
	});
});

describe("getPageModel", () => {
	test("creates and syncs a page model", async () => {
		const path = require("path");
		const os = require("os");
		const origDb = process.env.SQLITE_DB_FILE;
		const tmpDb = path.join(os.tmpdir(), `test-notes-${Date.now()}.sqlite`);
		process.env.SQLITE_DB_FILE = tmpDb;
		try {
			const fs = await import("fs");
			const PageModel = await getPageModel();
			expect(PageModel).toBeDefined();
			expect(fs.existsSync(tmpDb)).toBe(true);
			await PageModel.sequelize.close();
		} finally {
			const fs = await import("fs");
			if (fs.existsSync(tmpDb)) {
				fs.unlinkSync(tmpDb);
			}
			process.env.SQLITE_DB_FILE = origDb;
		}
	});
});

describe("getAllChildBlocks", () => {
	test("returns blocks from Notion API", async () => {
		const mockNotion = {
			blocks: {
				children: {
					list: vi.fn().mockResolvedValue({
						results: [{ id: "a" }, { id: "b" }],
						has_more: false,
						next_cursor: null,
					}),
				},
			},
		};
		const result = await getAllChildBlocks(mockNotion, "page-1");
		expect(result).toHaveLength(2);
		expect(mockNotion.blocks.children.list).toHaveBeenCalledWith({
			block_id: "page-1",
			start_cursor: undefined,
		});
	});

	test("handles pagination", async () => {
		const mockNotion = {
			blocks: {
				children: {
					list: vi
						.fn()
						.mockResolvedValueOnce({
							results: [{ id: "page1" }],
							has_more: true,
							next_cursor: "c2",
						})
						.mockResolvedValueOnce({
							results: [{ id: "page2" }],
							has_more: false,
							next_cursor: null,
						}),
				},
			},
		};
		const result = await getAllChildBlocks(mockNotion, "page-2");
		expect(result).toHaveLength(2);
		expect(result[0].id).toBe("page1");
		expect(result[1].id).toBe("page2");
	});
});

describe("getChildren", () => {
	test("recursively fetches child blocks", async () => {
		const mockList = vi
			.fn()
			.mockResolvedValueOnce({
				results: [
					{
						id: "parent",
						has_children: true,
						type: "column_list",
					},
				],
				has_more: false,
				next_cursor: null,
			})
			.mockResolvedValueOnce({
				results: [{ id: "child1", has_children: false, type: "column" }],
				has_more: false,
				next_cursor: null,
			});

		const mockNotion = {
			blocks: { children: { list: mockList } },
		};

		const result = await getChildren(mockNotion, "root");
		expect(result).toHaveLength(1);
		expect(result[0].id).toBe("parent");
		expect(result[0].children).toHaveLength(1);
		expect(result[0].children[0].id).toBe("child1");
	});

	test("assigns empty children array to leaf blocks", async () => {
		const mockNotion = {
			blocks: {
				children: {
					list: vi.fn().mockResolvedValue({
						results: [{ id: "leaf", has_children: false, type: "text" }],
						has_more: false,
						next_cursor: null,
					}),
				},
			},
		};
		const result = await getChildren(mockNotion, "leaf-parent");
		expect(result).toHaveLength(1);
		expect(result[0].children).toEqual([]);
	});
});
