# AGENTS.md

## Commands

- Install with `npm install`; this repo uses `package-lock.json`.
- Lint and typecheck: `npm run lint && npm run typecheck` (`oxlint` forbids production `any`; `tsc` uses `noEmit`, strict, `allowJs: false`).
- Test: `npm test`; focused snapshot test: `npx vitest run --globals test/render-snapshots.test.ts`.
- Coverage: `npm run test:coverage` (`vitest run --globals --coverage`).
- Build the site with `npm run build` (`tsx index.ts`), not `node index.js`.
- Build with cache and show deployment changes: `npm run build:cached-status`.
- Compare a no-cache fresh build against deployment output: `npm run build:compare-fresh`.

## Runtime And Config

- `index.ts` is the real entrypoint and also exports render helpers used by tests.
- The build reads Notion via `NOTION_SECRET` and `NOTION_DATABASE_ID`; env vars can come from `.env` or from `CONFIG=path/to/file.env`.
- When editing draft Notion pages, you can use `NOTION_SECRET` with the Notion API to inspect and modify blocks directly; for Val Town embeds, use the Val Town MCP to read the referenced val source and replace the embed block with a Notion `code` block when requested. Ask whether to also add useful output blocks for examples and format code blocks for mobile readability, commonly with `oxfmt` at `printWidth: 40`, trimming `Open in Val Town` headers and trailing newlines.
- `BUILD`, `BASE_URL`, `TWITTER_HANDLE`, `OG_IMAGE`, and `SQLITE_DB_FILE` are read in the `settings` class near the top of `index.ts`.
- `db.sqlite3` and `.env*` are ignored local artifacts; `npm run build` may touch them.

## Build Output

- `public/script.ts` is not emitted as a standalone browser file; `index.ts` reads it and transpiles it inline into generated HTML.
- `build/` is a nested deployment git repo, not a disposable ignored directory. Never delete `build/`.
- If a refactor should not change generated pages, run `npm run build:compare-fresh`; it builds into a temp output dir with a temp sqlite DB and compares against `build/` without touching the nested repo.
- To inspect cached generated changes, run `npm run build:cached-status` or use `git -C build status --short` and `git -C build diff`.
- Do not leave changes under `build/` while making codebase changes unless the user explicitly approves updating generated output. If `npm run build` changes `build/` unexpectedly, report it and leave the generated changes unstaged.

## Formatting And Linting

- Oxfmt is configured for tabs, double quotes, and import sorting in `.oxfmtrc.json`.
- For touched TypeScript files, use `npx oxfmt <files>`.

## Tests

- Snapshot fixtures live in `test/fixtures/posts.ts`; snapshots live in `test/__snapshots__/render-snapshots.test.ts.snap`.
- The snapshot test deep-clones fixtures, calls `renderPageContents`, and compares rendered HTML only; it does not hit Notion.
- Unit tests live in `test/unit.test.ts` and test individual exported helpers (`blockToHtml`, `textToHtml`, `groupAdjacentBlocksRecursively`, `concatenateText`, etc.) and their various branch paths.
- `coverage/` is gitignored; run `npm run test:coverage` to generate a report.
- When coverage is relevant or `npm run test:coverage` is run, report the resulting statement, branch, function, and line coverage, and call out material changes from the previous result when known.
