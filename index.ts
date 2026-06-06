import fs from "fs";
import https from "https";
import path from "path";

import type { Client as NotionClient } from "@notionhq/client";
import type { GetBlockResponse } from "@notionhq/client/build/src/api-endpoints";
import { config } from "dotenv";
import emojiUnicode from "emoji-unicode";
import { Feed } from "feed";
import katex from "katex";
import mimeTypes from "mime-types";
import emoji from "node-emoji";
import forEachRow from "notion-for-each-row";
import Prism from "prismjs";
import loadLanguages from "prismjs/components/";
import { DataTypes, Sequelize } from "sequelize";
import ts from "typescript";

config({
	path: process.env.CONFIG,
	debug: Boolean(process.env.CONFIG),
});

const fsPromises = fs.promises;

type Block = Extract<GetBlockResponse, { type: string }>;
type RichText = Extract<Block, { type: "paragraph" }>["paragraph"]["text"][number];
type BuildOptions = {
	debugPageId?: string;
	logger?: Pick<Console, "log">;
};
type RecursiveBranch<Branch, Leaf = never> = Branch & {
	children: Array<Leaf | RecursiveBranch<Branch, Leaf>>;
};
type RecursiveTree<Branch, Leaf = never> = RecursiveBranch<Branch, Leaf> | Leaf;
type GroupedBlockType = "numbered_list_item" | "bulleted_list_item";
interface CardBlockBase {
	id: string;
	type: Block["type"];
	has_children: boolean;
	children: CardBlock[];
	[key: string]: any;
}
type BlockGroup<BlockType extends Block["type"], GroupType extends string> = {
	id: string;
	type: GroupType;
	has_children: true;
	children: Array<CardBlockBase & { type: BlockType }>;
};
type CardBlockGroup =
	| BlockGroup<"numbered_list_item", "numbered_list">
	| BlockGroup<"bulleted_list_item", "bulleted_list">;
type CardBlock = CardBlockBase | CardBlockGroup;
type CardPage = {
	id: string;
	headingIcon: string | null;
	favicon: string;
	title: string;
	blocks: CardBlock[];
	filename: string;
	ogImage: string | null;
	content?: string;
	created: string;
	updated?: string;
	publishToRss: boolean;
};
type PageIcon = { type: "file"; file: { url: string } } | { type: "emoji"; emoji: string } | null;
type ImageDimensions = { width: number; height: number };

loadLanguages([
	"ocaml",
	"scheme",
	"diff",
	"shell",
	"docker",
	"typescript",
	"prolog",
	"j",
	"python",
	"sql",
	"bqn",
	"ruby",
]);

/**
 * Accessors for our env var configurations
 * Override these!
 */
const settings = new (class Settings {
	get twitterHandle() {
		return process.env.TWITTER_HANDLE || "jdan";
	}

	get ogImage() {
		return process.env.OG_IMAGE || "https://notes.jordanscales.com/me.png";
	}

	get baseUrl() {
		return process.env.BASE_URL || "/";
	}

	get outputDir() {
		return (
			process.env.BUILD ||
			path.join(__dirname, "build", this.baseUrl[0] === "/" ? this.baseUrl.slice(1) : ".")
		);
	}

	get notionSecret() {
		const { NOTION_SECRET } = process.env;
		if (!NOTION_SECRET) {
			throw new Error("Missing NOTION_SECRET env variable");
		}
		return NOTION_SECRET;
	}

	get notionDatabaseId() {
		const { NOTION_DATABASE_ID } = process.env;
		if (!NOTION_DATABASE_ID) {
			throw new Error("Missing NOTION_DATABASE_ID env variable");
		}
		return NOTION_DATABASE_ID;
	}

	get dbFile() {
		return process.env.SQLITE_DB_FILE || "db.sqlite3";
	}

	url(part: string) {
		const baseUrl = this.baseUrl.endsWith("/") ? this.baseUrl : `${this.baseUrl}/`;
		return new URL(part.replace(/^\/+/, ""), new URL(baseUrl, "https://example.com")).pathname;
	}

	output(part: string) {
		const outputDir = path.resolve(this.outputDir);
		const outputPath = path.resolve(outputDir, part);
		const relativePath = path.relative(outputDir, outputPath);

		if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
			throw new Error(`Output path escapes build directory: ${part}`);
		}

		return outputPath;
	}

	info() {
		return {
			outputDir: this.outputDir,
			baseUrl: this.baseUrl,
			notionDatabaseId: this.notionDatabaseId,
			twitterHandle: this.twitterHandle,
			ogImage: this.ogImage,
		};
	}
})();

// We preload all blocks in every page then transform the block data model so
// that each block has a children array containing its children.
//
// We also group some kinds of blocks together into new synthetic block groups.
// This allows more straightforward rendering of ordered and unordered list
// blocks.

async function getPageModel() {
	const sequelize = new Sequelize({
		dialect: "sqlite",
		storage: settings.dbFile,
		logging: false,
	});

	const PageModel = sequelize.define("page", {
		id: {
			type: DataTypes.STRING,
			primaryKey: true,
		},
		body: {
			type: DataTypes.JSON,
		},
		createdAt: {
			type: DataTypes.DATE,
		},
		updatedAt: {
			type: DataTypes.DATE,
		},
	});

	await PageModel.sync();
	return PageModel;
}

function addDashes(id: string) {
	return [
		id.slice(0, 8),
		id.slice(8, 12),
		id.slice(12, 16),
		id.slice(16, 20),
		id.slice(20, 32),
	].join("-");
}

function concatenateText(arr: RichText[] | undefined) {
	if (arr) {
		return arr.map((i) => i.plain_text).join("");
	} else {
		return "";
	}
}

function escapeHtmlAttribute(str: string) {
	return str
		.replace(/&/g, "&amp;")
		.replace(/"/g, "&quot;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;");
}

function decodeBasicHtmlEntities(str: string) {
	return str
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&amp;/g, "&");
}

function pageMetaDescription(title: string, content = "") {
	const plainText = decodeBasicHtmlEntities(content.replace(/<[^>]*>/g, " "))
		.replace(/\s+/g, " ")
		.replace(/\s+([.,;:!?])/g, "$1")
		.trim();
	const description = plainText || `Jordan's working notes: ${title}`;
	const maxLength = 160;
	const truncated =
		description.length > maxLength
			? `${description.slice(0, maxLength - 3).trimEnd()}...`
			: description;

	return escapeHtmlAttribute(truncated);
}

function sluggify(str: string) {
	return str.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function longDate(str: string) {
	// Notion date-only mentions should render as the stored calendar date, not UTC-shifted by local timezone.
	// TODO: Add tests for date-only and datetime mention formatting.
	const [year, month, day] = str.split("-").map((i) => parseInt(i));

	const date = new Date();
	date.setFullYear(year);
	date.setMonth(month - 1);
	date.setDate(day);

	return new Intl.DateTimeFormat("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
	}).format(date);
}

async function textToHtml(pageId: string, text: RichText, allPages: CardPage[]) {
	if (text.type === "text") {
		const codeFriendly = text.text.content.replace(/</g, "&lt;").replace(/>/g, "&gt;");

		const emojiToLoad = new Set<string>([]);
		let content = emoji.replace(codeFriendly, ({ emoji }: { emoji: string }) => {
			emojiToLoad.add(emoji);
			return emoji;
		});

		await Promise.all(
			[...emojiToLoad].map(async (emoji) => {
				const filename = await saveEmojiFavicon(emoji);
				// Hmmmm safe?
				content = content.replace(
					new RegExp(emoji, "ug"),
					`<img class="emoji" alt="${emoji}" src="${filename}" />`,
				);
			}),
		);

		if (text.annotations.bold) {
			content = `<strong>${content}</strong>`;
		}
		if (text.annotations.italic) {
			content = `<em>${content}</em>`;
		}
		if (text.annotations.underline) {
			content = `<u>${content}</u>`;
		}
		if (text.annotations.strikethrough) {
			content = `<strike>${content}</strike>`;
		}
		if (text.annotations.code) {
			content = `<code>${content}</code>`;
		}

		if (text.text.link) {
			// Links to other pages (not mentions), should also get back-linked
			if (/^\//.test(text.text.link.url)) {
				const id = text.text.link.url.slice(1);
				// Hack: format into "c3d85220-62aa-457a-b414-90c5e9929790"

				const backlinkFriendlyId = addDashes(id);

				registerBacklink(pageId, backlinkFriendlyId);
				return linkOfId(allPages, backlinkFriendlyId, {
					overwriteTitle: content,
				});
			} else {
				// rel="me" for mastodon
				return "https://mastodon.xyz/@jordan" === text.text.link.url
					? `<a rel="me" href="${text.text.link.url}">${content}</a>`
					: `<a href="${text.text.link.url}">${content}</a>`;
			}
		} else {
			return content;
		}
	} else if (text.type === "mention") {
		if (text.mention.type === "page") {
			registerBacklink(pageId, text.mention.page.id);
			return linkOfId(allPages, text.mention.page.id);
		} else if (text.mention.type === "date") {
			const { start } = text.mention.date;

			if (start && /^\d{4}-\d{2}-\d{2}$/.test(start)) {
				return longDate(start);
			} else if (start) {
				const [date, time] = start.slice(0, 16).split("T");
				const [year, month, day] = date.split("-").map((i) => parseInt(i));
				const localDate = new Date();
				localDate.setFullYear(year);
				localDate.setMonth(month - 1);
				localDate.setDate(day);

				const options = {
					month: "long",
					day: "numeric",
					year: "numeric",
				} as const;
				const longDate = new Intl.DateTimeFormat("en-US", options).format(localDate);
				return `${longDate} - ${time}`;
			}
		} else if ((text.mention as any).type === "template_mention") {
			// Template mentions are a no-op
			return "";
		} else {
			console.log(pageId, "Unrecognized mention --", text.mention);
		}
	} else if (text.type === "equation") {
		return katex.renderToString(text.equation.expression, { strict: false });
	} else {
		console.log(pageId, "Unrecognized text --", text);
	}
}

async function copyStaticAssets() {
	const assets = [
		path.join(__dirname, "public/style.css"),
		path.join(__dirname, "public/me.png"),
		path.join(__dirname, "public/serve.json"),
		path.join(__dirname, "node_modules/prismjs/themes/prism-coy.css"),
		path.join(__dirname, "node_modules/prismjs/themes/prism-tomorrow.css"),
		path.join(__dirname, "node_modules/katex/dist/katex.min.css"),
		path.join(__dirname, "node_modules/katex/dist/fonts/KaTeX_Math-Italic.woff2"),
		path.join(__dirname, "node_modules/katex/dist/fonts/KaTeX_Main-Regular.woff2"),
		path.join(__dirname, "node_modules/katex/dist/fonts/KaTeX_Size4-Regular.woff2"),
		path.join(__dirname, "node_modules/katex/dist/fonts/KaTeX_Math-Italic.woff"),
		path.join(__dirname, "node_modules/katex/dist/fonts/KaTeX_Main-Regular.woff"),
		path.join(__dirname, "node_modules/katex/dist/fonts/KaTeX_Size4-Regular.woff"),
		path.join(__dirname, "node_modules/katex/dist/fonts/KaTeX_Math-Italic.ttf"),
		path.join(__dirname, "node_modules/katex/dist/fonts/KaTeX_Main-Regular.ttf"),
		path.join(__dirname, "node_modules/katex/dist/fonts/KaTeX_Size4-Regular.ttf"),
		path.join(__dirname, "node_modules/react/umd/react.production.min.js"),
		path.join(__dirname, "node_modules/react-dom/umd/react-dom.production.min.js"),
	];
	return Promise.all(
		assets.map(async (asset) => fsPromises.copyFile(asset, settings.output(path.basename(asset)))),
	);
}

async function writeFileIfChanged(filename: string, content: string) {
	if (fs.existsSync(filename) && (await fsPromises.readFile(filename, "utf8")) === content) {
		return;
	}

	await fsPromises.writeFile(filename, content);
}

const linkOfId = (allPages: CardPage[], id: string, args: { overwriteTitle?: string } = {}) => {
	const page = allPages.find((entry) => entry.id === id);
	if (page) {
		return `<a href="${settings.url(page.filename)}"${page.favicon ? ` class="with-emoji"` : ""}>
      ${page.favicon ? `<img class="emoji" alt="" src="${settings.url(page.favicon)}">` : ""}
      ${args.overwriteTitle || page.title}</a>`;
	} else {
		return `[${id}]`;
	}
};

async function savePage(
	{ id, title, created, favicon, headingIcon, content, filename, publishToRss, ogImage }: CardPage,
	backlinks: Backlinks,
	allPages: CardPage[],
) {
	const icon = favicon || (await saveEmojiFavicon("💡"));

	const footer = backlinks[id]
		? `<footer><label>mentioned in</label><ul>${backlinks[id]
				.sort()
				.map((id) => `<li>${linkOfId(allPages, id)}</li>`)
				.join("\n")}</ul></footer>`
		: "";

	const script = await fsPromises.readFile(path.join(__dirname, "public/script.ts"), "utf8");
	const { outputText: browserScript } = ts.transpileModule(script, {
		compilerOptions: { target: ts.ScriptTarget.ES2016 },
	});

	const metaImage = ogImage ? settings.url(ogImage) : settings.ogImage;
	const metaDescription = pageMetaDescription(title, content);
	const twitterCard = ogImage ? "summary_large_image" : "summary";
	const katexStylesheet = (content || "").includes('class="katex')
		? `<link rel="stylesheet" href="${settings.url("katex.min.css")}">`
		: "";
	const themeAssets = JSON.stringify({
		prismCoy: settings.url("prism-coy.css"),
		prismTomorrow: settings.url("prism-tomorrow.css"),
	});

	const body = `
    <!doctype html>
    <html lang="en">
    <head>
      <title>${title}</title>
      <link rel="Shortcut Icon" type="image/x-icon" href="${settings.url(icon)}" />
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">

      <link rel="alternate" type="application/atom+xml" title="Feed" href="https://notes.jordanscales.com/feed.atom">

      <meta property="og:title" content="${title}" />
      <meta property="og:description" content="${metaDescription}" />
      <meta property="og:image" content="${metaImage}" />
      <meta name="description" content="${metaDescription}" />

      <meta name="twitter:card" content="${twitterCard}" />
      <meta name="twitter:site" content="${settings.twitterHandle}" />
      <meta name="twitter:title" content="${title}" />
      <meta name="twitter:description" content="${metaDescription}" />

      <link rel="stylesheet" href="${settings.url("style.css")}">
      <link rel="preload" href="${settings.url("prism-coy.css")}" as="style">
      <link rel="preload" href="${settings.url("prism-tomorrow.css")}" as="style">
      <link id="prism" rel="stylesheet" href="${settings.url("prism-coy.css")}">
      ${katexStylesheet}
    </head>
    <body>
      <script>0</script>
      <main class="p${id.slice(0, 8)}">
        <header>
          <a href="${settings.baseUrl}">Home</a>
          <button id="toggle-btn" aria-label="enable dark theme">🌙</button>
        </header>
        ${
					headingIcon
						? `<div class="title-row">
                ${headingIcon}
                <h1>${title}</h1>
              </div>`
						: `<h1>${title}</h1>`
				}
        ${content}
        ${footer}
      </main>
		<script>window.__themeAssets = ${themeAssets}</script>
		<script>${browserScript}</script>
    </body>
    </html>
  `;
	await writeFileIfChanged(settings.output(filename), body);

	if (publishToRss) {
		return {
			title,
			id: settings.url(filename),
			link: settings.url(filename),
			content: body,
			author: [
				{
					name: "Jordan Scales",
					email: "me@jordanscales.com",
					link: "https://jordanscales.com",
				},
			],
			date: new Date(created),
			image: metaImage,
		};
	}

	return null;
}

async function downloadImage(url: string, filenamePrefix: string): Promise<string | undefined> {
	const files = await fsPromises.readdir(settings.outputDir);
	let filename = files.find((name: string) => name.startsWith(filenamePrefix));

	if (!filename) {
		return new Promise<string | undefined>((resolve) => {
			const request = https.get(url, (res: any) => {
				const ext = mimeTypes.extension(res.headers["content-type"] || "image/png");
				const dest = `${filenamePrefix}.${ext}`;
				const destStream = fs.createWriteStream(settings.output(dest));
				res
					.pipe(destStream)
					.on("finish", () => {
						resolve(dest);
					})
					.on("error", () => {
						console.log("Image failed to write", dest);
						resolve(undefined);
					});
			});
			request.on("error", () => {
				console.log("Image failed to download", url);
				resolve(undefined);
			});
		});
	} else {
		return filename;
	}
}

async function getImageDimensions(filename: string): Promise<ImageDimensions | undefined> {
	const file = await fsPromises.readFile(settings.output(filename));

	if (file.length >= 24 && file.toString("ascii", 1, 4) === "PNG") {
		return {
			width: file.readUInt32BE(16),
			height: file.readUInt32BE(20),
		};
	}

	if (file.length >= 4 && file[0] === 0xff && file[1] === 0xd8) {
		let offset = 2;
		while (offset < file.length) {
			if (file[offset] !== 0xff) {
				break;
			}

			const marker = file[offset + 1];
			const length = file.readUInt16BE(offset + 2);
			if (
				marker >= 0xc0 &&
				marker <= 0xcf &&
				marker !== 0xc4 &&
				marker !== 0xc8 &&
				marker !== 0xcc
			) {
				return {
					width: file.readUInt16BE(offset + 7),
					height: file.readUInt16BE(offset + 5),
				};
			}

			offset += 2 + length;
		}
	}
}

async function imageSizeAttributes(filename: string): Promise<string> {
	try {
		const dimensions = await getImageDimensions(filename);
		return dimensions ? ` width="${dimensions.width}" height="${dimensions.height}"` : "";
	} catch {
		return "";
	}
}

async function downloadImageBlock(
	block: CardBlockBase & { type: "image" },
	blockId: string,
): Promise<string | undefined> {
	const filename = await downloadImage(
		block.image.type === "file" ? block.image.file.url : block.image.external.url,
		`${block.id}.image`,
	);

	if (!filename) {
		return;
	}

	const caption = concatenateText(block.image.caption);
	const sizeAttributes = await imageSizeAttributes(filename);
	const html = `<figure id="${blockId}">
      <img alt="${caption}" src="${settings.url(filename)}" loading="lazy" decoding="async"${sizeAttributes}>
      <figcaption>${caption}</figcaption>
    </figure>`;

	return html;
}

async function blockToHtml(
	block: CardBlock,
	pageId: string,
	allPages: CardPage[],
	options: BuildOptions = {},
): Promise<string | undefined> {
	if (pageId === options.debugPageId) {
		(options.logger || console).log("[DEBUG]", block.type, block.id);
	}

	const textToHtml_ = async (texts: RichText[]) => {
		const converts = await Promise.all(texts.map((text) => textToHtml(pageId, text, allPages)));
		return converts.join("");
	};
	const blockId = "b" + block.id.replace(/-/g, "").slice(0, 8);
	const children = await Promise.all(
		block.children.map((block: CardBlock) => blockToHtml(block, pageId, allPages, options)),
	);

	if (block.type === "bulleted_list") {
		return `<ul id="${blockId}">${children.join("\n")}</ul>`;
	} else if (block.type === "numbered_list") {
		return `<ol id="${blockId}">${children.join("\n")}</ol>`;
	} else if (block.type === "bulleted_list_item") {
		return `<li id="${blockId}">
      <div class="list-item">
        ${await textToHtml_(block.bulleted_list_item.text)}
      </div>
      ${children.join("\n")}
    </li>`;
	} else if (block.type === "numbered_list_item") {
		return `<li id="${blockId}">
      <div class="list-item">
        ${await textToHtml_(block.numbered_list_item.text)}
      </div>
      ${children.join("\n")}
    </li>`;
	} else if (block.type === "paragraph") {
		return `<div class="text" id="${blockId}">
      ${await textToHtml_(block.paragraph.text)}
      <div class="children">${children.join("\n")}</div>
    </div>`;
	} else if (block.type === "heading_1") {
		const text = await textToHtml_(block.heading_1.text);
		const id = sluggify(text);

		return `<h1 id="${id}">
      <a href="#${id}" class="link">🔗</a>
      ${text}
    </h1>`;
	} else if (block.type === "heading_2") {
		const text = await textToHtml_(block.heading_2.text);
		const id = sluggify(text);

		return `<h2 id="${id}">
      <a href="#${id}" class="link">🔗</a>
      ${text}
    </h2>`;
	} else if (block.type === "heading_3") {
		const text = await textToHtml_(block.heading_3.text);
		const id = sluggify(text);

		return `<h3 id="${id}">
      <a href="#${id}" class="link">🔗</a>
      ${text}
    </h3>`;
	} else if (block.type === "toggle") {
		// Toggles that start with !hide don't render as a summary
		// and just display their contents
		const toggleText = concatenateText(block.toggle.text);
		if (/^!hide/.test(toggleText)) {
			return children.join("\n");
		}

		return `<details id="${blockId}"><summary>${await textToHtml_(
			block.toggle.text,
		)}</summary>${children.join("\n")}</details>`;
	} else if (block.type === "code") {
		const isPreview = /preview=true/.test(concatenateText(block.code.caption));
		if (isPreview) {
			return await renderPreview(pageId, block as CardBlockBase & { type: "code" });
		}

		const hasCustomLanguage =
			block.code.language === "plain text" && /^lang=/.test(concatenateText(block.code.caption));

		const language = hasCustomLanguage
			? concatenateText(block.code.caption).slice("lang=".length)
			: block.code.language.toLowerCase();
		if (language !== "plain text" && !Prism.languages[language]) {
			console.log(pageId, "Unrecognized language --", language);
		}
		const code = Prism.languages[language]
			? Prism.highlight(concatenateText(block.code.text), Prism.languages[language], language)
			: concatenateText(block.code.text);
		return `<pre id="${blockId}"><code class="language-${language.replace(
			/\s/g,
			"-",
		)}">${code}</code></pre>`;
	} else if (block.type === "equation") {
		return katex.renderToString(block.equation.expression, {
			displayMode: true,
			strict: false,
		});
	} else if (block.type === "image") {
		if (block.image.type === "file") {
			return downloadImageBlock(block as CardBlockBase & { type: "image" }, blockId);
		} else if (block.image.type === "external") {
			const caption = concatenateText(block.image.caption);
			return `<figure id="${blockId}">
        <img alt="${caption}" src="${block.image.external.url}" loading="lazy" decoding="async">
        <figcaption>${caption}</figcaption>
      </figure>`;
		} else {
			console.log(pageId, "Unrecognized image", block);
		}
	} else if (block.type === "to_do") {
		return `<div><label>
      <input type="checkbox" onclick="return false" ${block.to_do.checked ? "checked" : ""}>
      ${await textToHtml_(block.to_do.text)}
    </label></div>`;
	} else if (block.type === "quote") {
		return `<blockquote>
      <p>${await textToHtml_(block.quote.text)}</p>
      ${children.join("\n")}
    </blockquote>`;
	} else if (block.type === "divider") {
		return "<hr />";
	} else if (block.type === "unsupported") {
		return "[unsupported]";
	} else if (block.type === "synced_block") {
		// TODO: synced_from instead of children: []
		// not sure what the difference is
		return children.join("\n");
	} else if (block.type === "template") {
		// templates are using in pages, but no-ops when rendering
		return "";
	} else if (block.type === "embed") {
		const prefix = "https://www.val.town/v/";
		if (block.embed.url.startsWith(prefix)) {
			// extract an id
			// https://www.val.town/v/jdan.coupleHoldingHands -> jdan.coupleHoldingHands
			const id = block.embed.url.slice(prefix.length);
			return `<iframe src="https://www.val.town/embed/${id}" frameborder="0" allowfullscreen style="width: 100%; height: 400px"></iframe>`;
		} else {
			console.log(pageId, "Unrecognized embed --", block.embed.url);
		}
	} else if (block.type === "video") {
		const prefix = "https://www.youtube.com/watch?v=";
		if (block.video.type === "external" && block.video.external.url.startsWith(prefix)) {
			const id = block.video.external.url.slice(prefix.length);
			return `<iframe width="100%" height="400" src="https://www.youtube.com/embed/${id}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
		} else {
			console.log(pageId, "Unrecognized video --", block.video);
		}
	} else {
		console.log(pageId, "Unrecognized block --", block.type);
	}
}

async function renderPreview(pageId: string, block: CardBlockBase & { type: "code" }) {
	const code = concatenateText(block.code.text);
	const language = block.code.language.toLowerCase();

	if (language === "html") {
		return code;
	} else if (language === "javascript") {
		return `
      <script>${code}</script>
    `;
	} else if (language === "typescript") {
		const result = ts.transpileModule(code, {
			compilerOptions: {
				target: ts.ScriptTarget.ES2015,
				// module: ts.ModuleKind.ES2015,
				jsx: ts.JsxEmit.React,
				jsxFactory: "React.createElement",
			},
		});
		return `
      <script>${result.outputText}</script>
    `;
	} else {
		console.log(pageId, "Unrecognized preview language --", language);
	}
}

function groupAdjacentBlocksRecursively<
	BlockType extends GroupedBlockType,
	GroupType extends CardBlockGroup["type"],
>(
	blocks: RecursiveTree<Block>[] | CardBlock[],
	type: BlockType,
	result_type: GroupType,
): CardBlock[] {
	type ResultGroup = BlockGroup<BlockType, GroupType>;
	type BlockToGroup = ResultGroup["children"][number];
	let result: CardBlock[] = [];
	let currentList: BlockToGroup[] = [];
	const blocksAsCardBlocks = blocks as CardBlock[];

	blocks.forEach((block, i) => {
		if (block.has_children) {
			// Recursively apply grouping to each block's children.
			blocksAsCardBlocks[i].children = groupAdjacentBlocksRecursively(
				block.children,
				type,
				result_type,
			);
		}

		if (block.type === type) {
			// This kind of generic type constraint is impossible to express in TS
			// since there's no way to declare that { type: XXXX } is a discriminated
			// union (it could always be declared as `string`).
			// See https://stackoverflow.com/questions/50870423/discriminated-union-of-generic-type
			currentList.push(block as BlockToGroup);
		} else {
			if (currentList.length) {
				const group: ResultGroup = {
					id: "p-" + currentList[0].id,
					has_children: true,
					type: result_type,
					children: currentList,
				};
				result.push(group as CardBlock);
				currentList = [];
			}

			result.push(blocksAsCardBlocks[i]);
		}
	});

	if (currentList.length) {
		const group: ResultGroup = {
			id: "p-" + currentList[0].id,
			has_children: true,
			type: result_type,
			children: currentList,
		};
		result.push(group as CardBlock);
	}

	return result;
}

type Backlinks = Record<string, string[]>;

const backlinks: Backlinks = {};
const registerBacklink = (sourceId: string, destinationId: string) => {
	if (backlinks[destinationId]) {
		backlinks[destinationId].push(sourceId);
	} else {
		backlinks[destinationId] = [sourceId];
	}
};

async function renderPageContents(pages: CardPage[], options: BuildOptions = {}) {
	for (const id of Object.keys(backlinks)) {
		delete backlinks[id];
	}

	await Promise.all(
		pages.map(async (page) => {
			const renderedBlocks = await Promise.all(
				page.blocks.map(async (block) => blockToHtml(block, page.id, pages, options)),
			);
			page.content = renderedBlocks.join("");
		}),
	);
}

async function getAllChildBlocks(notion: NotionClient, id: string) {
	const blocks: GetBlockResponse[] = [];

	let next_cursor: string | undefined = undefined;
	let has_more = true;
	let results: GetBlockResponse[];

	while (has_more) {
		const response = await notion.blocks.children.list({
			block_id: id,
			start_cursor: next_cursor || undefined,
		});
		({ results, has_more } = response);
		next_cursor = response.next_cursor || undefined;
		blocks.push(...results);
	}

	return blocks;
}

async function getChildren(notion: NotionClient, id: string) {
	const blocks = (await getAllChildBlocks(notion, id)) as RecursiveTree<Block>[];
	return Promise.all(
		blocks.map(async (block) => {
			if (block.has_children) {
				block.children = await getChildren(notion, block.id);
			} else {
				block.children = [];
			}
			return block;
		}),
	);
}

async function saveFavicon(pageId: string, icon: PageIcon): Promise<string | undefined> {
	if (icon && icon.type === "file") {
		return await downloadImage(icon.file.url, `${pageId}.icon`);
	} else if (icon && icon.type === "emoji") {
		return await saveEmojiFavicon(icon.emoji);
	}
}

async function saveEmojiFavicon(emoji: string) {
	const codepoints = emojiUnicode(emoji).split(" ").join("-");
	const basename =
		// TODO: unsure why we're looking for 31-, or why emoji-datasource has 0031-
		codepoints === "31-fe0f-20e3" ? "0031-fe0f-20e3.png" : `${codepoints}.png`;
	const filename = path.join(
		__dirname,
		"node_modules/emoji-datasource-apple/img/apple/64",
		basename,
	);
	if (!fs.existsSync(filename)) {
		console.log("Unknown emoji --", emoji, codepoints);
	}
	const dest = settings.output(basename);
	if (!fs.existsSync(dest)) {
		await fsPromises.copyFile(filename, dest);
	}
	return basename;
}

const main = async function main(options: BuildOptions = {}) {
	console.log("\n\n", new Date(), "\n", settings.info());

	const pages: CardPage[] = [];
	const PageModel = (await getPageModel()) as any;

	// Make sure settings.outputDir exists
	if (!fs.existsSync(settings.outputDir)) {
		await fsPromises.mkdir(settings.outputDir, { recursive: true });
	}

	// Load all the pages
	await forEachRow(
		{
			token: settings.notionSecret,
			database: settings.notionDatabaseId,
		},
		async (page: any, notion: NotionClient) => {
			const { id, created_time, last_edited_time, icon, properties } = page;
			if (options.debugPageId && id !== options.debugPageId) {
				return;
			}

			let existingPage = await PageModel.findByPk(id);
			const existingPageHasUpdates =
				new Date(last_edited_time).getTime() > new Date(existingPage?.updatedAt).getTime();

			if (options.debugPageId || !existingPage || existingPageHasUpdates) {
				existingPage =
					existingPage ||
					PageModel.build({
						id,
						createdAt: created_time,
					});

				const title = concatenateText(properties.Name.title);
				const children = await getChildren(notion, id);
				const favicon = (await saveFavicon(id, icon)) || "";

				// headingIcon is generated here so it can have the
				// emoji character as its alt text.
				//
				// Probably better to just send the emoji down.
				const headingIcon = icon
					? `<img width="32" height="32" alt="${
							icon.type === "emoji" ? icon.emoji : ""
						}" src="${settings.url(favicon)}" />`
					: null;

				const filename =
					(properties.Filename ? concatenateText(properties.Filename.rich_text) : "") ||
					`${id.replace(/-/g, "").slice(0, 8)}.html`;

				const ogImage = properties["og:image"].files[0]
					? await downloadImage(properties["og:image"].files[0].file.url, `${id}.ogImage`)
					: null;

				const publishToRss = properties["Publish to RSS"].checkbox;

				const blocks = groupAdjacentBlocksRecursively(
					groupAdjacentBlocksRecursively(children, "numbered_list_item", "numbered_list"),
					"bulleted_list_item",
					"bulleted_list",
				);

				const pageInstance: CardPage = {
					id,
					headingIcon,
					favicon,
					title,
					blocks,
					filename,
					ogImage: ogImage || null,
					created: created_time,
					updated: last_edited_time,
					publishToRss,
				};

				pages.push(pageInstance);
				existingPage.body = JSON.stringify(pageInstance);

				console.log("Updating page", id);
				await existingPage.save();
			} else {
				// Use the cached page
				pages.push(JSON.parse(existingPage.body));
			}
		},
	);

	await renderPageContents(pages, options);

	const rssItems = await Promise.all(pages.map((page) => savePage(page, backlinks, pages)));
	await copyStaticAssets();

	const publishedItems = [];
	for (const item of rssItems) {
		if (item) {
			publishedItems.push(item);
		}
	}
	const publishedPages = pages.filter((page) => page.publishToRss);
	const feedUpdated = new Date(
		Math.max(0, ...publishedPages.map((page) => new Date(page.updated || page.created).getTime())),
	);
	const favicon = await saveEmojiFavicon("👋");
	const feed = new Feed({
		title: "notes.jordanscales.com",
		description: "Jordan's working notes",
		id: settings.url("/"),
		link: settings.url(""),
		updated: feedUpdated,
		language: "en",
		image: settings.ogImage,
		favicon: settings.url(favicon),
		copyright: "CC BY-NC 4.0 Jordan Scales",
		feedLinks: {
			atom: settings.url("feed.atom"),
		},
		author: {
			name: "Jordan Scales",
			email: "me@jordanscales.com",
			link: "https://jordanscales.com",
		},
	});

	publishedItems
		.sort((a, b) => b.date.getTime() - a.date.getTime())
		.forEach((item) => {
			feed.addItem(item);
		});

	await writeFileIfChanged(settings.output("feed.atom"), feed.atom1());
};

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
	(async () => {
		try {
			await main();
		} catch (error) {
			console.error(error);
			process.exit(1);
		}
	})();
}

export {
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
	main,
	pageMetaDescription,
	registerBacklink,
	renderPageContents,
	saveEmojiFavicon,
	saveFavicon,
	savePage,
	settings,
	sluggify,
	textToHtml,
};
