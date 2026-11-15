# Performance audit

This document records mobile Lighthouse audits of [notes.jordanscales.com](https://notes.jordanscales.com) performed on September 6, 2026 (baseline) and November 15, 2026 (follow-up). They are dated measurements rather than permanent performance guarantees: the site content, third-party embeds, browser, network, and Lighthouse scoring model can all change.

## Method

- Lighthouse 13.0.1 with Chrome 152.
- Mobile simulation and cold page loads.
- Three runs per page unless noted otherwise.
- Scores and timings below are medians; ranges are called out when variance was material.
- Transfer sizes include page resources observed by Lighthouse, including third-party embeds.

## November 15, 2026

Measured against production before the November fixes below were deployed, so the changes since September reflect the WebP emoji, KaTeX font path, and BMP conversion work.

| Page | Performance | FCP | LCP | Transfer / requests | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| [Home](https://notes.jordanscales.com/) | 100 | 1.25 s | 1.61 s | 91 KiB / 34 | Down from 199 KiB. Three Notion page icons are still PNG; Lighthouse estimates 33 KiB of image savings. |
| [Rogue agents](https://notes.jordanscales.com/rogue) | 100 | 1.25 s | 1.25 s | 17 KiB / 8 | No material bottleneck. |
| [Estimates](https://notes.jordanscales.com/estimates) | 100 | 1.24 s | 1.24 s | 15 KiB / 8 | No material bottleneck. |
| [Game of Life Tower](https://notes.jordanscales.com/gol-tower) | 100 median | 1.27 s | 1.27 s | 243 KiB / 26 | Scores 77–100. One run had 1,097 ms of TBT in the Shader/Stack framework bundle. |
| [Reactivity](https://notes.jordanscales.com/reactivity) | 83 median | 1.87 s | 1.87 s | 80 KiB / 15 | Scores 83–98. **Regression:** CLS 0.297 from late-loading KaTeX fonts (see finding 9). |
| [French House](https://notes.jordanscales.com/french-house) | 94 median | 2.51 s | 2.62 s | 1.44 MiB / 85 | Scores 82–95. Five eager YouTube iframes account for 1.41 MiB of third-party transfer. |
| [When code is data](https://notes.jordanscales.com/when-code-is-data) | 100 | 1.23 s | 1.52 s | 36 KiB / 10 | Down from 518 KiB after the BMP conversion. |
| [Large numbers](https://notes.jordanscales.com/large-numbers) | 97 | 1.96 s | 2.10 s | 128 KiB / 12 | Still 10,473 DOM nodes; Lighthouse estimates 600 ms of render-blocking savings. |
| [What comes next](https://notes.jordanscales.com/what-comes-next) | 99 | 1.39 s | 1.56 s | 58 KiB / 17 | Up from 96. |

After deploying findings 7–9, three runs of Reactivity scored 100, 99, and 100 with CLS 0 and FCP 1.24–1.27 s.

## September 6, 2026 baseline

| Page | Performance | FCP | LCP | Transfer / requests | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| [Home](https://notes.jordanscales.com/) | 100 | 1.25 s | 1.57 s | 199 KiB / 34 | TBT 0 ms and CLS 0. The page requested 29 unique emoji PNGs. |
| [Rogue agents](https://notes.jordanscales.com/rogue) | 100 | 1.21 s | 1.36 s | 27 KiB / 8 | Small, static post with no material bottleneck. |
| [Estimates](https://notes.jordanscales.com/estimates) | 100 | 1.21 s | 1.36 s | 27 KiB / 8 | Small, static post with no material bottleneck. |
| [Game of Life Tower](https://notes.jordanscales.com/gol-tower) | 100 median | — | — | 260 KiB / 26 | One run scored 76 after 1,211 ms of TBT in the Shader/Stack framework bundle. |
| [Reactivity](https://notes.jordanscales.com/reactivity) | 99 | 1.67 s | 1.67 s | 84 KiB / 19 | KaTeX CSS requested fonts below `/fonts/`, but deployment flattened them into the site root. |
| [French House](https://notes.jordanscales.com/french-house) | 97 median | — | — | 1.38 MiB / 93–96 | Scores ranged from 57 to 98. Five eager YouTube iframes dominated payload and variance. |
| [When code is data](https://notes.jordanscales.com/when-code-is-data) | 100 | — | — | 518 KiB / 10 | One run. A 493,254-byte BMP accounted for nearly the entire payload; Lighthouse estimated 467 KiB of image savings. |
| [Large numbers](https://notes.jordanscales.com/large-numbers) | 97 | — | — | — | 10,473 DOM nodes, 394 KiB of uncompressed HTML, and 679 ms of main-thread work. |
| [What comes next](https://notes.jordanscales.com/what-comes-next) | 96 | — | — | 121 KiB / 20 | No single large payload; the score reflects cumulative rendering and scripting cost. |

## Findings and status

### 1. Replace eager YouTube embeds with a facade

**Status: pending.** French House is the clearest remaining network bottleneck. Loading five complete YouTube players on initial navigation produces roughly 1.4 MiB across more than 80 requests and causes highly variable scores.

Render a lightweight poster and play button first, then create the YouTube iframe after interaction. Preserve the video title for accessible labeling and provide a normal YouTube link as a fallback. A prototype was written in November but discarded before deployment.

### 2. Serve KaTeX fonts at the paths used by KaTeX CSS

**Status: complete.** Commit `c0c347d` preserves the `fonts/` directory when copying KaTeX assets and removes the production and local-server path-flattening workarounds. The deployed URL `/fonts/KaTeX_Main-Regular.woff2` now responds successfully.

Because the fonts now actually load, this exposed the layout shift addressed in finding 9.

### 3. Reduce the front-page emoji payload

**Status: complete.** The home page previously loaded 29 unique 64-pixel Apple emoji PNGs totaling about 181 KiB of source data. Commit `fc05f79` converts emoji assets to WebP during the build and emits the correct favicon MIME type. In November the home page transferred 91 KiB in total, down from 199 KiB.

### 4. Convert BMP images to browser-friendly formats

**Status: complete.** Commit `b7cbac2` adds 24- and 32-bit BMP decoding to the image pipeline. BMP sources now receive intrinsic dimensions and responsive AVIF/WebP variants; the fallback image also uses WebP instead of the original BMP. In November When code is data transferred 36 KiB, down from 518 KiB.

### 5. Reduce large DOM output

**Status: pending.** Large numbers renders more than 10,000 DOM nodes and nearly 400 KiB of HTML. Consider representing repeated visual data with canvas, SVG, CSS backgrounds, or a progressively enhanced compact data model instead of emitting every element into the initial document.

Any rewrite should preserve readable fallback content and avoid moving a large amount of equivalent work into blocking JavaScript.

### 6. Investigate Shader/Stack startup variance

**Status: pending.** Game of Life Tower was fast in most runs but occasionally spent more than a second in total blocking time inside the embedded Shader/Stack framework bundle. This reproduced in November (one of three runs).

Profile the iframe independently, reduce its initial JavaScript, and defer compilation or rendering until the embed approaches the viewport. Continue honoring `prefers-reduced-motion` and pause rendering while the document is hidden.

### 7. Cache static assets in browsers

**Status: complete.** Production served every response with `cache-control: public, max-age=0, must-revalidate`; the cache rules in `public/serve.json` only apply to the local server. Commit `a5ffcd5` adds `public/_headers` for Cloudflare Pages:

- `/fonts/*`: one year.
- Images: one day plus a week of `stale-while-revalidate`. Filenames derive from Notion block IDs rather than content hashes, so a replaced image keeps its URL and must not be treated as immutable.
- Prism and KaTeX CSS: one week.
- HTML and `style.css` keep the platform default so deploys appear immediately.

### 8. Load Prism themes only where needed

**Status: complete.** Every page preloaded both Prism themes (which Cloudflare also sent as 103 Early Hints) and loaded the light theme, then dark-mode readers swapped it after the page script ran. Commit `e5863bb` emits a single Prism stylesheet only on pages with highlighted code and switches it to the dark theme from an inline script before first paint.

### 9. Preload KaTeX fonts on math pages

**Status: complete.** KaTeX fonts were discovered only after `katex.min.css` parsed; when `KaTeX_Math-Italic` and `KaTeX_Main-Regular` swapped in they shifted the surrounding text, producing CLS 0.297 and a score of 83 on Reactivity in two of three runs. Commit `e5863bb` preloads both fonts on pages containing KaTeX output. After deployment Reactivity measured CLS 0 and scores of 99–100.

### 10. Convert Notion page icons to modern formats

**Status: pending.** Uploaded Notion page icons (`*.icon.png`, up to 128×128 and about 14 KiB each) are still served as PNG and are the largest requests on the home page. Converting them like emoji assets would save an estimated 33 KiB there.

## Implementation checks

For the November changes:

- Lint, TypeScript, and all 141 tests passed after each commit, including new tests for `_headers` and page-head asset selection.
- `_headers` was validated with `wrangler pages dev` before deployment.
- A local A/B of Reactivity with and without the font preloads measured CLS 0.030–0.297 before and 0 in all three runs after.
- After deployment, production returned the expected `Cache-Control` values for fonts, images, Prism CSS, HTML, and `style.css`; the home page no longer references Prism stylesheets or sends a `Link` early-hint header.

## Re-running the audit

Use at least three cold mobile Lighthouse runs per page and report the median. Keep the browser and Lighthouse versions with the results, and record score ranges for pages with third-party or interactive content. Re-test the pages above after changes to the renderer, image pipeline, embed behavior, or deployment headers.

For renderer changes, run:

```sh
npm run lint
npm run typecheck
npm test
```

Use `npm run build:compare-fresh` when a refactor should not change generated pages. Use `npm run build:cached-status` when intentionally inspecting deployment-output changes.
