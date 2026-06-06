import { describe, expect, test } from "vitest";
import pages from "./fixtures/posts";
import { renderPageContents } from "../index";

describe("rendered post snapshots", () => {
	test.each(pages)("$title", async (fixture) => {
		const allPages = JSON.parse(JSON.stringify(pages));
		const page = allPages.find(
			(page: (typeof pages)[number]) => page.id === fixture.id,
		);

		await renderPageContents(allPages);

		expect(page.content).toMatchSnapshot();
	});
});
