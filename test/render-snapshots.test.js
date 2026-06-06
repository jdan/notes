/// <reference types="vitest/globals" />

const pages = require("./fixtures/posts");
const { renderPageContents } = require("../index");

describe("rendered post snapshots", () => {
	test.each(pages)("$title", async (fixture) => {
		const allPages = JSON.parse(JSON.stringify(pages));
		const page = allPages.find(
			(/** @type {any} */ page) => page.id === fixture.id,
		);

		await renderPageContents(allPages);

		expect(page.content).toMatchSnapshot();
	});
});
