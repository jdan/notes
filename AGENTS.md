# AGENTS.md

## Commands

- Install with `npm install`; this repo uses `package-lock.json`.
- Typecheck: `npm run typecheck` (`tsc`, `noEmit`, strict, `allowJs: false`).
- Test: `npm test`; focused snapshot test: `npx vitest run --globals test/render-snapshots.test.ts`.
- Coverage: `npm run test:coverage` (`vitest run --globals --coverage`).
- Build the site with `npm run build` (`tsx index.ts`), not `node index.js`.

## Runtime And Config

- `index.ts` is the real entrypoint and also exports render helpers used by tests.
- The build reads Notion via `NOTION_SECRET` and `NOTION_DATABASE_ID`; env vars can come from `.env` or from `CONFIG=path/to/file.env`.
- `BUILD`, `BASE_URL`, `TWITTER_HANDLE`, `OG_IMAGE`, and `SQLITE_DB_FILE` are read in the `settings` class near the top of `index.ts`.
- `db.sqlite3`, `.env*`, and `build/` are ignored local artifacts; `npm run build` may touch them.

## Build Output

- `public/script.ts` is not emitted as a standalone browser file; `index.ts` reads it and transpiles it inline into generated HTML.
- If a refactor should not change generated pages, run `npm run build` and verify `git status --short -- build` stays empty.

## Formatting And Linting

- Oxfmt is configured for tabs, double quotes, and import sorting in `.oxfmtrc.json`.
- For touched TypeScript files, use `npx oxfmt <files>`.

## Tests

- Snapshot fixtures live in `test/fixtures/posts.ts`; snapshots live in `test/__snapshots__/render-snapshots.test.ts.snap`.
- The snapshot test deep-clones fixtures, calls `renderPageContents`, and compares rendered HTML only; it does not hit Notion.
- Unit tests live in `test/unit.test.ts` and test individual exported helpers (`blockToHtml`, `textToHtml`, `groupAdjacentBlocksRecursively`, `concatenateText`, etc.) and their various branch paths.
- `coverage/` is gitignored; run `npm run test:coverage` to generate a report.
