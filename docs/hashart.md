# Hashart embeds

Hashart pieces are interactive canvas applications assembled from trusted Notion code blocks. They are not Notion Embed blocks and do not use an iframe. The build inserts their HTML and JavaScript directly into the generated post.

## Authoring in Notion

Each executable code block must have the exact caption:

```text
preview=true
```

Set the block language to **HTML** or **JavaScript** as appropriate. The blocks are emitted in page order, so definitions must appear before code that uses them.

A complete piece normally has these parts:

1. Shared helpers such as `_`, `project`, and `bigIntOfBuffer`.
2. The `#hashart-ui` HTML shell containing the seed input, explanation area, canvas, and description.
3. The shared browser runtime that hashes the seed, updates the URL fragment and renders the piece.
4. The shared `Art` base class.
5. A piece-specific subclass implementing `draw()` and usually `getDescription()`.
6. A final block that constructs the piece and calls `render()`.

The smallest final block looks like:

```javascript
const art = new MyPiece();
render();
```

The easiest way to author a new piece is to duplicate a working Hashart post in Notion, keep the shared blocks in the same order, and replace the piece-specific class and constructor.

## HTML contract

The shared runtime expects these elements beneath `#hashart-ui`:

```html
<div class="hashart" id="hashart-ui">
	<input class="bytes" value="Hello, world!" />
	<div class="explanation inner"></div>
	<canvas class="canvas" width="1320" height="990"></canvas>
	<aside></aside>
</div>
```

Working posts may use additional wrappers and labels, but the classes and ID queried by the runtime must remain available. There should only be one `#hashart-ui` on a page.

The canvas has a logical size of 1320×990. `public/style.css` displays it at 660×495 on desktop and preserves its 4:3 aspect ratio on smaller screens.

## Runtime behavior

- The seed input is hashed with SHA-256.
- The resulting 32 bytes are divided according to the piece's `Art` template.
- Typing updates the URL fragment so a seed can be linked directly.
- The Open Graph image URL is updated to the corresponding `hashpng.jordanscales.com` rendering.
- The piece's source link is derived from `art.filename` and points to the `jdan/hashart` repository.

## Rendering implementation

Code-block handling lives in `index.ts`:

- A caption containing `preview=true` routes the block through `renderPreview()`.
- HTML is returned verbatim.
- JavaScript is wrapped in a `<script>` element.
- TypeScript is transpiled before being wrapped in a `<script>` element.

Hashart presentation rules live under the `.hashart` selectors in `public/style.css`. The `turing` fixture in `test/fixtures/posts.ts` and its render snapshot exercise the inline-preview path.

## Security and limitations

`preview=true` code runs with the same origin and privileges as the published notes page. It can read and modify the page DOM. Only use it with code authored in the trusted private Notion database; never pass user-supplied code through this mechanism.

Because globals are shared across all inline scripts, block order and unique names matter. A runtime error in one block can prevent later parts of the piece from initializing.

## Testing changes

From the notes repository:

```sh
npm run lint
npm run typecheck
npm test
```

For renderer refactors that should not change existing Hashart output, also run:

```sh
npm run build:compare-fresh
```
