const fs = require("fs");
const https = require("https");
const path = require("path");
const forEachRow = require("notion-for-each-row");
const katex = require("katex");
const Prism = require("prismjs");
const loadLanguages = require("prismjs/components/");

const fsPromises = fs.promises;

loadLanguages(["ocaml", "scheme"]);

function concatenateText(arr) {
  return arr.map((i) => i.text.content).join("");
}

function textToHtml(text, registerBacklink, allPages) {
  if (text.type === "text") {
    let content = text.text.content.replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

    return text.text.link
      ? `<a href="${text.text.link.url}">${content}</a>`
      : content;
  } else if (text.type === "mention") {
    registerBacklink(text.mention.page.id);
    return linkOfId(allPages, text.mention.page.id);
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

const linkOfId = (allPages, id) => {
  const page = allPages.find((entry) => entry.id === id);
  if (page) {
    return `<a href="/${page.filename}">${page.title}</a>`;
  } else {
    return `[${id}]`;
  }
};

async function savePage({ id, title, content, filename }, backlinks, allPages) {
  const footer = backlinks[id]
    ? `<footer><label>mentioned in</label><ul>${backlinks[id]
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
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
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
        <h1>${title}</h1>
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
    https.get(block.image.file.url, (res) => {
      res
        .pipe(dest)
        .on("finish", () => {
          const caption = concatenateText(block.image.caption);
          resolve(
            `<figure id="${blockId}">
              <img alt="${caption}" src="/${filename}">
              <figcaption>${caption}</figcaption>
            </figure>`
          );
        })
        .on("error", () => {
          console.log("Image failed to write", block);
          resolve();
        });
    });
  });
}

async function blockToHtml(block, registerBacklink, allPages) {
  const textToHtml_ = (text) => textToHtml(text, registerBacklink, allPages);
  const blockId = "b" + block.id.replace(/-/g, "").slice(0, 8);

  if (block.type === "bulleted_list_item") {
    // TODO: join <li>s under a single <ul>?
    return `<li id="${blockId}">${block.bulleted_list_item.text
      .map(textToHtml_)
      .join("")}</li>`;
  } else if (block.type === "unsupported") {
    return "[unsupported]";
  } else if (block.type === "paragraph") {
    return `<p id="${blockId}">${block.paragraph.text
      .map(textToHtml_)
      .join("")}</p>`;
  } else if (block.type === "heading_1") {
    return `<h1 id="${blockId}">${block.heading_1.text
      .map(textToHtml_)
      .join("")}</h1>`;
  } else if (block.type === "heading_2") {
    return `<h2 id="${blockId}">${block.heading_2.text
      .map(textToHtml_)
      .join("")}</h2>`;
  } else if (block.type === "heading_3") {
    return `<h3 id="${blockId}">${block.heading_3.text
      .map(textToHtml_)
      .join("")}</h3>`;
  } else if (block.type === "toggle") {
    return `<details id="${blockId}"><summary>${block.toggle.text
      .map(textToHtml_)
      .join("")}</summary>TODO</details>`;
  } else if (block.type === "code") {
    const language = block.code.language.toLowerCase();
    const code = Prism.highlight(
      concatenateText(block.code.text),
      Prism.languages[language],
      language
    );
    return `<pre id="${blockId}"><code class="language-${language}">${code}</code></pre>`;
  } else if (block.type === "equation") {
    return katex.renderToString(block.equation.expression, {
      displayMode: true,
    });
  } else if (block.type === "image") {
    if (block.image.type !== "file") {
      console.log("Unrecognized image", block);
    } else {
      return downloadImageBlock(block, blockId);
    }
  } else {
    console.log("Unrecognized block --", block);
  }
}

function groupBulletedItems(blocks) {
  let result = [];
  let currentList = [];
  blocks.forEach((block) => {
    if (block.type === "bulleted_list_item") {
      currentList.push(block);
    } else {
      if (currentList.length) {
        result.push({
          type: "bulleted_list",
          items: currentList,
        });
        currentList = [];
      }

      result.push({
        type: "single",
        block,
      });
    }
  });

  if (currentList.length) {
    result.push({
      type: "bulleted_list",
      items: currentList,
    });
  }

  return result;
}

(async () => {
  const pages = [];
  const backlinks = {};

  // Load all the pages
  await forEachRow(
    {
      token: process.env["NOTION_SECRET"],
      database: process.env["NOTION_DATABASE_ID"],
    },
    async ({ id, properties }, notion) => {
      const title = concatenateText(properties.Name.title);
      const blocks = await notion.blocks.children.list({ block_id: id });
      const filename =
        (properties.Filename
          ? concatenateText(properties.Filename.rich_text)
          : "") || `${id.replace(/-/g, "").slice(0, 8)}.html`;

      const groups = groupBulletedItems(blocks.results);

      pages.push({
        id,
        title,
        groups,
        filename,
      });
    }
  );

  // Populate the page content and backlinks
  await Promise.all(
    pages.map(async (page) => {
      const parts = await Promise.all(
        page.groups.map(async (entry) => {
          const registerBacklink = (destinationId) => {
            if (backlinks[destinationId]) {
              backlinks[destinationId].push(page.id);
            } else {
              backlinks[destinationId] = [page.id];
            }
          };

          if (entry.type === "single") {
            return blockToHtml(entry.block, registerBacklink, pages);
          } else {
            const items = await Promise.all(
              entry.items.map((item) =>
                blockToHtml(item, registerBacklink, pages)
              )
            );
            return `<ul>${items.join("")}</ul>`;
          }
        })
      );
      page.content = parts.join("");
    })
  );

  try {
    await fsPromises.access(outputDir);
  } catch {
    await fsPromises.mkdir(outputDir);
  }

  Promise.all([
    ...pages.map((page) => savePage(page, backlinks, pages)),
    copyStaticAssets(),
  ]);
})();
