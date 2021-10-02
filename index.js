const fs = require("fs").promises;
const path = require("path");
const forEachRow = require("notion-for-each-row");
const katex = require("katex");
const Prism = require("prismjs");
const loadLanguages = require("prismjs/components/");

loadLanguages(["ocaml"]);

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
    path.join(__dirname, "node_modules/katex/dist/katex.min.css"),
  ];
  return Promise.all(
    assets.map(async (asset) =>
      fs.copyFile(asset, path.join(outputDir, path.basename(asset)))
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

  const body = `
    <!doctype html>
    <html lang="en">
    <head>
      <title>${title}</title>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="/style.css">
      <link rel="stylesheet" href="/prism-coy.css">
      <link rel="stylesheet" href="/katex.min.css">
    </head>
    <body>
      <script>0</script>
      <main>
        <h1>${title}</h1>
        ${content}
        ${footer}
      </main>
    </body>
    </html>
  `;
  await fs.writeFile(path.join(outputDir, filename), body);
}

function blockToHtml(block, registerBacklink, allPages) {
  const textToHtml_ = (text) => textToHtml(text, registerBacklink, allPages);

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
  } else if (block.type === "code") {
    const language = block.code.language.toLowerCase();
    const code = Prism.highlight(
      concatenateText(block.code.text),
      Prism.languages[language],
      language
    );
    return `<pre><code class="language-${language}">${code}</code></pre>`;
  } else if (block.type === "equation") {
    return katex.renderToString(block.equation.expression, {
      displayMode: true,
    });
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
  pages.forEach((page) => {
    page.content = page.groups
      .map((entry) => {
        const registerBacklink = (destinationId) => {
          if (backlinks[destinationId]) {
            backlinks[destinationId].push(page.id);
          } else {
            backlinks[destinationId] = [page.id];
          }
        };

        return entry.type === "single"
          ? blockToHtml(entry.block, registerBacklink, pages)
          : `<ul>${entry.items
              .map((item) => blockToHtml(item, registerBacklink, pages))
              .join("")}</ul>`;
      })
      .join("");
  });

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
