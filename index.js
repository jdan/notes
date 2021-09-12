const fs = require("fs").promises;
const path = require("path");
const forEachRow = require("notion-for-each-row");

function concatenateTitle(arr) {
  return arr.map((i) => i.text.content).join("");
}

function textToHtml(text) {
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

async function savePage({ id, title, content, filename }) {
  filename = filename || `${id}.html`;

  const body = `
    <!doctype html>
    <html>
    <head>
      <title>${title}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="/style.css">
    </head>
    <body>
      <main>
        <h1>${title}</h1>
        ${content}
      </main>
    </body>
    </html>
  `;
  await fs.writeFile(path.join(outputDir, filename), body);
}

function blockToHtml(block) {
  if (block.type === "bulleted_list_item") {
    // TODO: join <li>s under a single <ul>?
    return `<li>${block.bulleted_list_item.text.map(textToHtml).join("")}</li>`;
  } else if (block.type === "unsupported") {
    return "[unsupported]";
  } else if (block.type === "paragraph") {
    return `<p>${block.paragraph.text.map(textToHtml).join("")}</p>`;
  } else if (block.type === "heading_3") {
    return `<h3>${block.heading_3.text.map(textToHtml).join("")}</h3>`;
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
  const index = "0e7f88242f2a44c3b724d159a339aebc";

  await forEachRow(
    {
      token: process.env["NOTION_SECRET"],
      database: process.env["NOTION_DATABASE_ID"],
    },
    async ({ id, properties }, notion) => {
      const title = concatenateTitle(properties.Name.title);
      const blocks = await notion.blocks.children.list({ block_id: id });

      const groups = groupBulletedItems(blocks.results);
      const content = groups
        .map((entry) =>
          entry.type === "single"
            ? blockToHtml(entry.block)
            : `<ul>${entry.items.map(blockToHtml).join("")}</ul>`
        )
        .join("");

      pages.push({
        id,
        title,
        content,
      });

      if (id.replace(/-/g, "") === index) {
        pages.push({
          id,
          title,
          content,
          filename: "index.html",
        });
      }
    }
  );

  Promise.all([...pages.map(savePage), copyStaticAssets()]);
})();
