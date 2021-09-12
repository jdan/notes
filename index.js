const fs = require("fs").promises;
const path = require("path");
const forEachRow = require("notion-for-each-row");

function concatenateTitle(arr) {
  return arr.map((i) => i.text.content).join("");
}

function textToHtml(text) {
  if (text.type === "text") {
    const content = text.text.content
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
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

async function savePage({ id, title, content }) {
  const outputDir = path.join(__dirname, "build");
  const body = `
    <!doctype html>
    <html>
    <head>
      <title>${title}</title>
      <meta name="viewport" content="width=device-width, initial-scale=1">
    </head>
    <body>
      <main>
        <h1>${title}</h1>
        ${content}
      </main>
    </body>
    </html>
  `;
  await fs.writeFile(path.join(outputDir, `${id}.html`), body);
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

(async () => {
  const pages = [];

  await forEachRow(
    {
      token: process.env["NOTION_SECRET"],
      database: process.env["NOTION_DATABSE_ID"],
    },
    async ({ id, properties }, notion) => {
      const blocks = await notion.blocks.children.list({ block_id: id });
      pages.push({
        id,
        title: concatenateTitle(properties.Name.title),
        content: blocks.results.map(blockToHtml).join(""),
      });
    }
  );

  Promise.all(pages.map(savePage));
})();
