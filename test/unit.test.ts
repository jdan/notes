// @ts-nocheck
import { describe, expect, test } from "vitest";

import {
	addDashes,
	blockToHtml,
	concatenateText,
	groupAdjacentBlocksRecursively,
	longDate,
	registerBacklink,
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
});

describe("blockToHtml", () => {
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
});
