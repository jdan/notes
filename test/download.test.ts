import https from "https";
import os from "os";

import { vi, describe, expect, test, beforeAll, beforeEach, afterAll } from "vitest";

let useErrorMock = false;

vi.mock("https", () => ({
	default: {
		get: vi.fn((_url: string, callback: (res: any) => void) => {
			const finishOrError = {
				on: vi.fn((event: string, handler: () => void) => {
					if ((useErrorMock && event === "error") || (!useErrorMock && event === "finish")) {
						setImmediate(handler);
					}
					return finishOrError;
				}),
			};
			callback({
				headers: { "content-type": "image/png" },
				pipe: vi.fn(() => finishOrError),
			});
			return { on: vi.fn() };
		}),
	},
}));

import fs from "fs";
import path from "path";

import { downloadImage, saveFavicon, blockToHtml, settings } from "../index";

const originalBuild = process.env.BUILD;
const testBuildDir = fs.mkdtempSync(path.join(os.tmpdir(), "notes-download-"));

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

function cleanTestFiles() {
	const dir = settings.outputDir;
	for (const f of fs.readdirSync(dir)) {
		if (f.startsWith(`test-`)) {
			fs.unlinkSync(path.join(dir, f));
		}
	}
}

describe("downloadImage", () => {
	const unique = `test-dl-${Date.now()}`;

	beforeAll(() => cleanTestFiles());
	afterAll(() => cleanTestFiles());

	test("downloads image and returns filename", async () => {
		useErrorMock = false;
		const result = await downloadImage("https://example.com/img.png", unique);
		expect(result).toBe(`${unique}.png`);
	});

	test("handles download error gracefully", async () => {
		useErrorMock = true;
		const prefix = `test-error-${Date.now()}`;
		const result = await downloadImage("https://example.com/fail.png", prefix);
		expect(result).toBeUndefined();
	});

	test("returns cached filename when file exists", async () => {
		useErrorMock = false;
		const prefix = `test-cached-${Date.now()}`;
		const cachedName = `${prefix}.image.png`;
		const cachedPath = settings.output(cachedName);
		fs.writeFileSync(cachedPath, "fake");
		try {
			const result = await downloadImage("https://example.com/img.png", prefix);
			expect(result).toBe(cachedName);
		} finally {
			if (fs.existsSync(cachedPath)) fs.unlinkSync(cachedPath);
		}
	});
});

describe("image/file block (downloadImageBlock)", () => {
	beforeEach(() => cleanTestFiles());
	afterAll(() => cleanTestFiles());

	test("downloadImage returns undefined on error mock", async () => {
		useErrorMock = true;
		const result = await downloadImage("https://example.com/nonexistent.png", "test-dir-1.image");
		expect(result).toBeUndefined();
	});

	test("returns nothing when download fails", async () => {
		useErrorMock = true;
		const block = {
			id: "test-dir-2",
			type: "image",
			image: {
				type: "file",
				file: { url: "https://example.com/nonexistent.png", expiry_time: "" },
				caption: [{ type: "text", text: { content: "Alt" }, plain_text: "Alt" }],
			},
			children: [] as never[],
			has_children: false,
			archived: false,
			created_time: "",
			last_edited_time: "",
			object: "block",
			parent: { type: "page_id", page_id: "p1" },
		};
		const result = await blockToHtml(block as any, "page-1", []);
		expect(result).toBeUndefined();
	});
});

describe("saveFavicon", () => {
	beforeAll(() => cleanTestFiles());
	afterAll(() => cleanTestFiles());

	test("downloads file icon from url", async () => {
		useErrorMock = false;
		const prefix = `test-favicon-${Date.now()}`;
		const result = await saveFavicon(prefix, {
			type: "file",
			file: { url: "https://example.com/favicon.png" },
		});
		expect(result).toBe(`${prefix}.icon.png`);
	});

	test("saves emoji favicon for emoji icon", async () => {
		const result = await saveFavicon("emoji-page", {
			type: "emoji",
			emoji: "❤️",
		});
		expect(result).toBe("2764-fe0f.png");
	});

	test("returns undefined for null icon", async () => {
		const result = await saveFavicon("null-page", null);
		expect(result).toBeUndefined();
	});
});
