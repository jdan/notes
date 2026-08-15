# Shader/Stack embeds

Shader/Stack embeds render a live Stack shader from a Notion Embed block. The shader runs in a lightweight cross-origin iframe, while the notes page renders the collapsible **View code** section itself.

## Authoring in Notion

1. Open the shader in [Shader/Stack](https://shaders.jordanscales.com).
2. Use a local or shared shader so the sharing controls are available.
3. Click **EMBED** to copy its embed URL.
4. Paste the URL into Notion and choose **Create embed**.
5. Publish or rebuild the notes site normally.

An embed URL has this form:

```text
https://shaders.jordanscales.com/embed#share=<payload>
```

To update a published shader, edit it in Shader/Stack, copy a new embed URL, and replace the URL or Embed block in Notion. The source is stored in the URL, so an old URL remains an immutable snapshot of the old shader.

## URL payload

The `#share=` fragment contains URL-safe base64-encoded JSON:

```json
{
	"version": 1,
	"filename": "mandelbrot.stack",
	"source": ": main\n  ...\n;"
}
```

The fragment is decoded entirely in the browser and is not sent to the Shader/Stack server in HTTP requests. It is still public: the URL appears in the generated page and the source is deliberately exposed by **View code**. Do not put secrets in a shader.

The current format accepts version 1 payloads with at most 200,000 source characters. Filenames are normalized by Shader/Stack.

## Notes rendering

The Notion block is handled by the `embed` branch of `blockToHtml()` in `index.ts`.

`parseShaderStackEmbed()`:

1. Requires the exact `https://shaders.jordanscales.com` origin.
2. Validates and decodes the versioned `#share=` payload.
3. Rewrites normal share URLs and embed URLs to the canonical `/embed` route.
4. Emits a lazy-loading iframe.
5. Escapes the decoded source into a native `<details>` element beneath the iframe.

The resulting structure is approximately:

```html
<figure class="shader-stack-embed">
	<iframe src="https://shaders.jordanscales.com/embed#share=..." loading="lazy"></iframe>
	<details class="shader-stack-code">
		<summary>View code</summary>
		<pre><code class="language-stack">...</code></pre>
	</details>
</figure>
```

The iframe is not given a `sandbox` attribute. A sandboxed iframe has an opaque origin, which prevents Shader/Stack's JavaScript modules from loading unless the production asset responses opt into cross-origin access. The separate `shaders.jordanscales.com` origin still isolates the application from the notes page.

Styles for the responsive 4:3 iframe and code disclosure live in `public/style.css` under `.shader-stack-embed` and `.shader-stack-code`.

## Shader/Stack implementation

The Shader/Stack repository lives at `~/Projects/shader-stack`.

- `app/embed/page.tsx` defines the lightweight route and its metadata.
- `app/playground-client.tsx` contains `ShaderEmbed`, the compiler, the shared WebGL canvas and the **EMBED** link generator.
- `app/globals.css` contains the embed shell and error-state styles.
- `tests/rendered-html.test.mjs` verifies that `/embed` renders without the editor interface.

The embed reads the hash after hydration, compiles the Stack source, and fills the iframe with the WebGL canvas. Invalid payloads, compiler failures and WebGL errors produce a compact error state. Rendering pauses when the document is hidden or the reader prefers reduced motion.

## Deployment order

When changing the embed contract or runtime:

1. Deploy Shader/Stack first so `/embed` understands the new payload.
2. Deploy the notes renderer.
3. Rebuild the notes site from Notion.
4. Verify both the live canvas and **View code** on a published page.

This order prevents newly generated posts from pointing at a Shader/Stack route that is not live yet.

## Testing changes

In `~/Projects/shader-stack`:

```sh
npm run lint
npm test
```

In the notes repository:

```sh
npm run lint
npm run typecheck
npm test
```

The notes unit test named `Shader/Stack embed renders a live preview and collapsible source` covers payload decoding, canonical URL generation and HTML escaping.

## Troubleshooting

- **The full editor appears inside Notion:** use the URL copied by **EMBED**, not the normal **SHARE** URL.
- **The published post omits the embed:** confirm that the block is a Notion Embed block and that its URL uses the production Shader/Stack origin with a valid `#share=` fragment.
- **The canvas shows an error:** open the same URL directly to distinguish a Stack compilation error from a notes rendering problem.
- **The post shows an old shader:** the source is embedded in the URL; replace the Notion embed with a newly copied URL and rebuild.
