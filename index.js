const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const https = require("https");
const path = require("path");
const emoji = require("node-emoji");
const emojiUnicode = require("emoji-unicode");
const forEachRow = require("notion-for-each-row");
const katex = require("katex");
const Prism = require("prismjs");
const loadLanguages = require("prismjs/components/");

const fsPromises = fs.promises;

loadLanguages(["ocaml", "scheme", "diff", "shell", "docker", "typescript"]);

const sha = childProcess.execSync("git rev-parse HEAD").toString().trim();
let id = 1;
function getDeterministicUUID() {
  const shasum = crypto.createHash("sha1");
  shasum.update(sha);
  shasum.update("" + id++);
  return addDashes(shasum.digest("hex"));
}

function addDashes(id) {
  return [
    id.slice(0, 8),
    id.slice(8, 12),
    id.slice(12, 16),
    id.slice(16, 20),
    id.slice(20, 32),
  ].join("-");
}

function concatenateText(arr) {
  return arr.map((i) => i.text.content).join("");
}

function relativeDate(str) {
  const [year, month, day] = str.split("-").map((i) => parseInt(i));

  const date = new Date();
  date.setFullYear(year);
  date.setMonth(month - 1);
  date.setDate(day);

  const deltaDays = Math.round(
    (date.getTime() - Date.now()) / (1000 * 3600 * 24)
  );

  const relative = new Intl.RelativeTimeFormat("en", {
    numeric: "auto",
  });

  const formatted = relative.format(deltaDays, "days");
  return formatted[0].toUpperCase() + formatted.slice(1);
}

async function textToHtml(pageId, text, allPages) {
  if (text.type === "text") {
    const codeFriendly = text.text.content
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const emojiToLoad = new Set([]);
    let content = emoji.replace(codeFriendly, ({ emoji }) => {
      emojiToLoad.add(emoji);
      return emoji;
    });

    await Promise.all(
      [...emojiToLoad].map(async (emoji) => {
        const filename = await saveFavicon(emoji);
        // Hmmmm safe?
        content = content.replace(
          new RegExp(emoji, "ug"),
          `<img class="emoji" alt="${emoji}" src="${filename}" />`
        );
      })
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
        return `<a href="${text.text.link.url}">${content}</a>`;
      }
    } else {
      return content;
    }
  } else if (text.type === "mention") {
    if (text.mention.type === "page") {
      registerBacklink(pageId, text.mention.page.id);
      return linkOfId(allPages, text.mention.page.id);
    } else if (text.mention.type === "date") {
      return relativeDate(text.mention.date.start);
    } else {
      console.log("Unrecognized mention --", text);
    }
  } else if (text.type === "equation") {
    return katex.renderToString(text.equation.expression);
  } else {
    console.log("Unrecognized text --", text);
  }
}

const outputDir = path.join(__dirname, "build");

async function copyStaticAssets() {
  const assets = [
    path.join(__dirname, "public/style.css"),
    path.join(__dirname, "public/me.png"),
    path.join(__dirname, "node_modules/prismjs/themes/prism-coy.css"),
    path.join(__dirname, "node_modules/prismjs/themes/prism-tomorrow.css"),
    path.join(__dirname, "node_modules/katex/dist/katex.min.css"),
  ];
  return Promise.all(
    assets.map(async (asset) =>
      fsPromises.copyFile(asset, path.join(outputDir, path.basename(asset)))
    )
  );
}

const linkOfId = (allPages, id, args = {}) => {
  const page = allPages.find((entry) => entry.id === id);
  if (page) {
    return `<a href="/${page.filename}"${
      page.emoji ? ` class="with-emoji"` : ""
    }>
      ${page.emoji ? `<img class="emoji" alt="" src="/${page.favicon}">` : ""}
      ${args.overwriteTitle || page.title}</a>`;
  } else {
    return `[${id}]`;
  }
};

async function savePage(
  { id, title, favicon, headingIcon, content, filename },
  backlinks,
  allPages
) {
  const footer = backlinks[id]
    ? `<footer><label>mentioned in</label><ul>${backlinks[id]
        .sort()
        .map((id) => `<li>${linkOfId(allPages, id)}</li>`)
        .join("\n")}</ul></footer>`
    : "";

  const script = await fsPromises.readFile(
    path.join(__dirname, "public/script.js")
  );

  const body = `
    <!doctype html>
    <html lang="en">
    <head>
      <title>${title}</title>
      <link rel="Shortcut Icon" type="image/x-icon" href="/${favicon}" />
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">

      <meta property="og:title" content="${title}" />
      <meta property="og:image" content="https://cards.jordanscales.com/me.png" />

      <meta name="twitter:card" content="summary" />
      <meta name="twitter:site" content="@jdan" />
      <meta name="twitter:title" content="${title}" />

      <link rel="stylesheet" href="/style.css">
      <link rel="preload" href="/prism-coy.css" as="style">
      <link rel="preload" href="/prism-tomorrow.css" as="style">
      <link id="prism" rel="stylesheet" href="/prism-coy.css">
      <link rel="stylesheet" href="/katex.min.css">
    </head>
    <body>
      <script>0</script>
      <main>
        <header>
          <a href="/">Home</a>
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
      <script>${script}</script>
    </body>
    </html>
  `;
  await fsPromises.writeFile(path.join(outputDir, filename), body);
}

function downloadImageBlock(block, blockId) {
  const filename = `${block.id}.png`;
  const dest = fs.createWriteStream(
    path.join(__dirname, "build", `${block.id}.png`)
  );

  return new Promise((resolve) => {
    const caption = concatenateText(block.image.caption);
    const html = `<figure id="${blockId}">
      <img alt="${caption}" src="/${filename}">
      <figcaption>${caption}</figcaption>
    </figure>`;

    if (fs.existsSync(dest)) {
      resolve(html);
    } else {
      https.get(block.image.file.url, (res) => {
        res
          .pipe(dest)
          .on("finish", () => {
            resolve(html);
          })
          .on("error", () => {
            console.log("Image failed to write", block);
            resolve();
          });
      });
    }
  });
}

async function blockToHtml(block, pageId, allPages) {
  const textToHtml_ = async (texts) => {
    const converts = await Promise.all(
      texts.map((text) => textToHtml(pageId, text, allPages))
    );
    return converts.join("");
  };
  const blockId = "b" + block.id.replace(/-/g, "").slice(0, 8);
  const children = await Promise.all(
    block.children.map((block) => blockToHtml(block, pageId, allPages))
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
    return `<p id="${blockId}">${await textToHtml_(block.paragraph.text)}</p>`;
  } else if (block.type === "heading_1") {
    return `<h1 id="${blockId}">${await textToHtml_(
      block.heading_1.text
    )}</h1>`;
  } else if (block.type === "heading_2") {
    return `<h2 id="${blockId}">${await textToHtml_(
      block.heading_2.text
    )}</h2>`;
  } else if (block.type === "heading_3") {
    return `<h3 id="${blockId}">${await textToHtml_(
      block.heading_3.text
    )}</h3>`;
  } else if (block.type === "toggle") {
    return `<details id="${blockId}"><summary>${await textToHtml_(
      block.toggle.text
    )}</summary>${children.join("\n")}</details>`;
  } else if (block.type === "code") {
    const language = block.code.language.toLowerCase();
    if (language !== "plain text" && !Prism.languages[language]) {
      console.log("Unrecognized language --", language);
    }
    const code = Prism.languages[language]
      ? Prism.highlight(
          concatenateText(block.code.text),
          Prism.languages[language],
          language
        )
      : concatenateText(block.code.text);
    return `<pre id="${blockId}"><code class="language-${language.replace(
      /\s/g,
      "-"
    )}">${code}</code></pre>`;
  } else if (block.type === "equation") {
    return katex.renderToString(block.equation.expression, {
      displayMode: true,
    });
  } else if (block.type === "image") {
    if (block.image.type === "file") {
      return downloadImageBlock(block, blockId);
    } else if (block.image.type === "external") {
      const caption = concatenateText(block.image.caption);
      return `<figure id="${blockId}">
        <img alt="${caption}" src="${block.image.external.url}">
        <figcaption>${caption}</figcaption>
      </figure>`;
    } else {
      console.log("Unrecognized image", block);
    }
  } else if (block.type === "to_do") {
    return `<div><label>
      <input type="checkbox" onclick="return false" ${
        block.to_do.checked ? "checked" : ""
      }>
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
  } else {
    console.log("Unrecognized block --", block);
  }
}

function groupBy(blocks, type, result_type) {
  let result = [];
  let currentList = [];
  blocks.forEach((block) => {
    if (block.has_children) {
      block.children = groupBy(block.children, type, result_type);
    }

    if (block.type === type) {
      currentList.push(block);
    } else {
      if (currentList.length) {
        result.push({
          id: getDeterministicUUID(),
          has_children: true,
          type: result_type,
          children: currentList,
        });
        currentList = [];
      }

      result.push(block);
    }
  });

  if (currentList.length) {
    result.push({
      id: getDeterministicUUID(),
      has_children: true,
      type: result_type,
      children: currentList,
    });
  }

  return result;
}

const backlinks = {};
const registerBacklink = (sourceId, destinationId) => {
  if (backlinks[destinationId]) {
    backlinks[destinationId].push(sourceId);
  } else {
    backlinks[destinationId] = [sourceId];
  }
};

async function getChildren(notion, id) {
  // TODO: Paginate?
  const req = await notion.blocks.children.list({ block_id: id });
  const blocks = req.results;
  return Promise.all(
    blocks.map(async (block) => {
      if (block.has_children) {
        block.children = await getChildren(notion, block.id);
      } else {
        block.children = [];
      }
      return block;
    })
  );
}

async function saveFavicon(emoji) {
  const codepoints = emojiUnicode(emoji).split(" ").join("-");
  const basename = `${codepoints}.png`;
  const filename = path.join(
    __dirname,
    "node_modules/emoji-datasource-apple/img/apple/64",
    basename
  );
  if (!fs.existsSync(filename)) {
    console.log("Unknown emoji --", emoji, codepoints);
  }
  const dest = path.join(outputDir, basename);
  if (!fs.existsSync(dest)) {
    await fsPromises.copyFile(filename, dest);
  }
  return basename;
}

(async () => {
  const pages = [];

  // Make sure outputDir exists
  if (!fs.existsSync(outputDir)) {
    await fsPromises.mkdir(outputDir);
  }

  // Load all the pages
  await forEachRow(
    {
      token: process.env["NOTION_SECRET"],
      database: process.env["NOTION_DATABASE_ID"],
    },
    async (page, notion) => {
      const { id, icon, properties } = page;

      const emoji = icon && icon.emoji;
      const title = concatenateText(properties.Name.title);
      const children = await getChildren(notion, id);
      const favicon = await saveFavicon(emoji || "💡");
      const headingIcon = icon
        ? `<img width="32" height="32" alt="${icon.emoji}" src="/${favicon}" />`
        : null;
      const filename =
        (properties.Filename
          ? concatenateText(properties.Filename.rich_text)
          : "") || `${id.replace(/-/g, "").slice(0, 8)}.html`;

      const blocks = groupBy(
        groupBy(children, "numbered_list_item", "numbered_list"),
        "bulleted_list_item",
        "bulleted_list"
      );

      pages.push({
        id,
        headingIcon,
        favicon,
        emoji,
        title,
        blocks,
        filename,
      });
    }
  );

  await Promise.all(
    pages.map(async (page) => {
      const renderedBlocks = await Promise.all(
        page.blocks.map(async (block) => blockToHtml(block, page.id, pages))
      );
      page.content = renderedBlocks.join("");
    })
  );

  Promise.all([
    ...pages.map((page) => savePage(page, backlinks, pages)),
    copyStaticAssets(),
  ]);
})();
