const fs = require("fs").promises;
const path = require("path");
const forEachRow = require("notion-for-each-row");

function concatenateTitle(arr) {
  return arr.map((i) => i.text.content).join("");
}

function textToHtml(text, registerBacklink) {
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

    const content = text.plain_text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    return `<a href="/${text.mention.page.id}.html">${content}</a>`;
  } else {
    console.log("Unrecognized text --", text);
  }
}

const outputDir = path.join(__dirname, "build");

async function copyStaticAssets() {
  const assets = ["style.css"];
  return Promise.all(
    assets.map(async (asset) =>
      fs.copyFile(
        path.join(__dirname, "public", asset),
        path.join(outputDir, asset)
      )
    )
  );
}

async function savePage({ id, title, content, filename }, backlinks, allPages) {
  const linkOfId = (id) => {
    const page = allPages.find((entry) => entry.id === id);
    if (page) {
      return `<a href="/${page.filename}">${page.title}</a>`;
    } else {
      return `[${id}]`;
    }
  };
  const footer = backlinks[id]
    ? `<footer>Mentioned in:<ul>${backlinks[id]
        .map((id) => `<li>${linkOfId(id)}</li>`)
        .join("\n")}</ul></footer>`
    : "";

  const body = `
    <!doctype html>
    <html lang="en">
    <head>
      <title>${title}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="/style.css">
    </head>
    <body>
      <script>0</script>
      <main>
        <h1>${title}</h1>
        ${content}
      </main>
      ${footer}
    </body>
    </html>
  `;
  await fs.writeFile(path.join(outputDir, filename), body);
}

function blockToHtml(block, registerBacklink) {
  const textToHtml_ = (text) => textToHtml(text, registerBacklink);

  if (block.type === "bulleted_list_item") {
    // TODO: join <li>s under a single <ul>?
    return `<li>${block.bulleted_list_item.text
      .map(textToHtml_)
      .join("")}</li>`;
  } else if (block.type === "unsupported") {
    return "[unsupported]";
  } else if (block.type === "paragraph") {
    return `<p>${block.paragraph.text.map(textToHtml_).join("")}</p>`;
  } else if (block.type === "heading_3") {
    return `<h3>${block.heading_3.text.map(textToHtml_).join("")}</h3>`;
  } else if (block.type === "toggle") {
    return `<details><summary>${block.toggle.text
      .map(textToHtml_)
      .join("")}</summary>TODO</details>`;
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

  await forEachRow(
    {
      token: process.env["NOTION_SECRET"],
      database: process.env["NOTION_DATABASE_ID"],
    },
    async ({ id, properties }, notion) => {
      const title = concatenateTitle(properties.Name.title);
      const blocks = await notion.blocks.children.list({ block_id: id });
      const filename =
        concatenateTitle(properties.Filename.rich_text) || `${id}.html`;

      const registerBacklink = (pageId) => {
        if (backlinks[pageId]) {
          backlinks[pageId].push(id);
        } else {
          backlinks[pageId] = [id];
        }
      };

      const groups = groupBulletedItems(blocks.results);
      const content = groups
        .map((entry) =>
          entry.type === "single"
            ? blockToHtml(entry.block, registerBacklink)
            : `<ul>${entry.items
                .map((item) => blockToHtml(item, registerBacklink))
                .join("")}</ul>`
        )
        .join("");

      pages.push({
        id,
        title,
        content,
        filename,
      });
    }
  );

  try {
    await fs.access(outputDir);
  } catch {
    await fs.mkdir(outputDir);
  }

  Promise.all([
    ...pages.map((page) => savePage(page, backlinks, pages)),
    copyStaticAssets(),
  ]);
})();
