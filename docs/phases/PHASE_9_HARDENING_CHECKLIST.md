# Phase 9 Hardening — Acceptance Checklist

## Goal

Harden the Phase 8 codebase against security risks, resilience failures, and code quality issues before Phase 9 feature work begins. No new UI features. The app must remain visually intact and runnable in both browser mode (`npm run dev`) and Tauri mode (`npm run tauri:dev`) after every change.

---

## Scope

### In scope

- Narrow Tauri `fs:scope` from `**` to app data paths
- Sanitize `reveal_in_explorer` Rust command against arbitrary paths
- Fix deterministic session ID collision in `sessionRoutingService.ts`
- Scope duplicate-import photo fetch to the target session
- Cap `waitForStableFile` settle delay to prevent unbounded stalls
- Remove redundant `/i` flag from filename parser
- Extract `slugify` to a shared utility
- Lazy-load Tauri imports in `watchedFolderService.ts` to clean up browser bundle
- Add Vitest + unit tests for filename parser and session routing

### Out of scope

- New UI features or layout changes
- localStorage-to-SQLite migration
- Dynamic Tauri `fs:scope` injection for user-chosen watch folders
- Processing queue activation
- Any Phase 9 feature work beyond the items listed above

---

## Implementation Tasks

### Priority 1 — Security

- [x] **1a** — `src-tauri/capabilities/default.json`: Replace `{ "path": "**" }` with scoped paths covering both storage roots:
  - `C:\PhotoFlow Desktop\**` and `C:\PhotoFlow Desktop` — managed photo storage, watch folders, and import paths (hardcoded Windows root)
  - `$APPLOCALDATA/PhotoFlow Desktop/**` and `$APPLOCALDATA/PhotoFlow Desktop` — SQLite database (Tauri SQL plugin stores it under `$APPLOCALDATA`)
  - Preserve `fs:scope-applocaldata-recursive`, `fs:allow-applocaldata-read-recursive`, `fs:allow-applocaldata-write-recursive`
  - **Note:** `$APPLOCALDATA/PhotoFlow Desktop` resolves to `C:\Users\{user}\AppData\Local\PhotoFlow Desktop`, NOT the managed photo root. Both entries are needed. If the managed storage root ever moves to `$APPLOCALDATA`, the hardcoded `C:\PhotoFlow Desktop` entries can be removed.

- [x] **1b** — `src-tauri/src/lib.rs`: Guard `reveal_in_explorer` before spawning: (1) path must exist on disk, (2) path must be under `C:\PhotoFlow Desktop` (Windows) or `$LOCALAPPDATA` / `$HOME` (other platforms). Return `Err(String)` if either check fails. JS caller updated with try/catch to gracefully surface the error.

### Priority 2 — Resilience

- [x] **2a** — `src/ingest/sessionRoutingService.ts`: Changed auto-created session ID to include a base-36 timestamp suffix: `session-${sessionKey}-${Date.now().toString(36)}`. Prevents silent insert conflict if a seed session with the same key already exists.

- [x] **2b** — `src/data/repository.ts`: Changed `isDuplicateImport` fifth-arg default from `getPhotos()` (all photos) to `getPhotosBySessionId(sessionId)` (target session only). Reduces unnecessary full-table reads in SQLite mode during the import loop.

- [x] **2c** — `src/ingest/fileStability.ts`: Added `effectiveDelay = Math.min(settleDelayMs, 5_000)` cap. Max per-check wait is now 5 s regardless of user-configured settle delay. Max total wait remains `maxAttempts × effectiveDelay` (5 × 5 s = 25 s).

### Priority 3 — Code Quality

- [x] **3a** — `src/ingest/filenameParser.ts`: Removed `/i` flag from `SESSION_PATTERN`. Pre-uppercase the stem before matching so the intent is explicit and the manual normalization is redundant-free.

- [x] **3b** — `src/data/repository.ts` + new `src/utils/slugify.ts`: Extracted `slugify` to shared utility. `repository.ts` now imports from `../utils/slugify`.

- [x] **3c** — `src/ingest/watchedFolderService.ts`: Top-level `import { join }` and `import { readDir, watch }` replaced with dynamic `await import(...)` calls inside the functions that use them, placed after the `isTauriRuntime()` guard. `import type { UnwatchFn }` retained as a type-only import (erased at runtime).

- [x] **3c-followup** — `src/ingest/autoImportPipeline.ts`: Lazy-load `readFile`/`remove` in `autoImportPipeline.ts`. Top-level `import { readFile, remove }` removed; replaced with dynamic `await import('@tauri-apps/plugin-fs')` calls at each use site inside the Tauri-only execution path.

### Priority 4 — Test Foundation

- [x] **4a** — Vitest installed as dev dependency. `"test": "vitest run"` added to `package.json`. Tests written:
  - `src/ingest/filenameParser.test.ts` — 8 cases covering standard IDs, sequences, embedded IDs, lowercase normalization, mixed-case, extension stripping, and no-match
  - `src/ingest/sessionRoutingService.test.ts` — 3 cases: unrouted on null sessionKey, sequence passthrough, routed result with existing session

---

## Validation Commands

```bash
npm run validate:filename-parser   # filename parser logic
npm run typecheck                   # 0 errors required
npm run lint                        # 0 new errors
npm run test                        # all tests pass
npm run build                       # production build succeeds
```

Browser mode check: `npm run dev` → Gallery, Workshop, Streams tabs functional.

---

## Acceptance Criteria

- [ ] `npm run typecheck` passes with 0 errors
- [ ] `npm run lint` passes with 0 new errors
- [ ] `npm run test` — all 11 test cases pass
- [ ] `npm run build` succeeds
- [ ] `npm run validate:filename-parser` — 12 cases pass
- [ ] `npm run dev` — browser mode loads, Gallery/Workshop/Streams tabs functional
- [ ] `src-tauri/capabilities/default.json` — `{ "path": "**" }` entry is gone
- [x] `reveal_in_explorer` — returns `Err` for non-existent paths and paths outside allowed roots
- [ ] Session routing — new sessions get unique IDs with timestamp suffix
- [ ] File stability — settle delay is capped at 5 s per check

---

### Import Activity Visibility (added to scope during testing)

- [x] **5a** — `src/features/streams/ImageStreamsCenter.tsx`: Added FOLDER / ACTIVITY tab toggle to each stream card's lower section.
  - **FOLDER** tab: existing live folder view (files currently sitting in the watched directory, 2 s poll)
  - **ACTIVITY** tab: last 12 import queue items for this stream, newest first — shows filename, outcome (OK / SKIP / FAIL), and error reason for skipped/failed items. Skipped items get a yellow background tint; failed items get the warn color.
  - A numeric badge on the ACTIVITY tab lights up amber when skipped or failed items are present, giving operators an at-a-glance signal without switching tabs.
  - Issue identified during testing: `SAZ482846-2.jpg` sat silently in the watched folder with no UI feedback. With this change, the ACTIVITY tab would have shown `SKIP · Filename did not contain a routable session ID.` immediately.

---

### Loose Filename Acceptance + Duplicate Handling (added to scope during testing)

- [x] **6a** — `src/ingest/filenameParser.ts`: Changed `routingConfidence` from `'matched' | 'unmatched'` to `'matched' | 'fallback'`. `sessionKey` is now always a non-null `string`. When no three-letter/six-digit session code is found, `deriveFallbackKey()` produces a sanitized uppercase key from the filename stem (e.g. `io31erhfuinl_33_2dfds.jpg` → `IO31ERHFUINL-33-2DFDS`). Any image file dropped into a watcher folder now routes to a session.

- [x] **6b** — `src/ingest/sessionRoutingService.ts`: Removed the `if (!parsed.sessionKey)` early-return that produced `status: 'unrouted'`. All files now reach `status: 'routed'`. Fallback-routed sessions are created with a note: "Auto-created — no recognizable session code in filename." The `makeSession` function received a `routingConfidence` parameter to set the note appropriately.

- [x] **6c** — `src/data/repository.ts`: Replaced `isDuplicateImport` (boolean) with two new helpers:
  - `isSourcePathDuplicate(sessionId, sourcePath)` — hard skip only when the exact filesystem path was already successfully imported (prevents re-importing the same physical file when `remove()` fails).
  - `resolveUniqueFilename(sessionId, filename)` — returns a collision-free filename by appending `_2`, `_3`, … until unique. Applied in both `importWatchedPhotoToSession` and `importPhotosToSession`, so duplicate drops are imported rather than skipped.
  - Also fixed Tauri error string handling in catch blocks: `describeImportError(error)` now surfaces string errors (Tauri API failures) in addition to `Error` objects.

- [x] **6d** — `src/ingest/autoImportPipeline.ts`: Fixed catch block to surface Tauri string errors rather than always showing "Watched-folder import failed."

- [x] **6e** — Tests updated: `filenameParser.test.ts` now tests fallback routing for `holiday_photo.jpg` and `io31erhfuinl_33_2dfds.jpg`. `sessionRoutingService.test.ts` replaced the three null-sessionKey tests with three fallback-routing tests. Total test count: 12 (9 filename parser + 3 routing).

---

### Component Structure

- [x] **7a** — `src/features/streams/ImageStreamsCenter.tsx` split into focused component files:
  - `streamUiHelpers.ts` — pure helpers, constants, and shared interfaces (`FolderFileEntry`, template types, `statusLabel`, `statusColor`, `fmtTime`, `computeSparkline`, `codeFromName`, `sanitizePreview`, `previewFilename`, `makeField`, `makePrintItem`)
  - `StreamActivityTab.tsx` — ACTIVITY tab content; receives `streamQueue` + `issueCount` as props; no `useApp` call
  - `StreamFolderTab.tsx` — FOLDER tab content; receives `folderFiles`, `watchPath`, `isDesktop`, `deletingFile`, `onDelete` as props; no poll ownership
  - `AutoPrintSetupDialog.tsx` — auto-print dialog + `TemplatePicker`, `PrintSizeSelect`, `PrinterSelect`, `TemplateThumb`, `PrintSizeChip`, `useClickOutside`
  - `StreamCard.tsx` — stream card + `Toggle` (exported), `Sparkline`, `openInExplorer`, folder poll `useEffect`, `streamQueue`/`issueCount` memos
  - `StreamSetupDialog.tsx` — create/edit dialog (renamed from `PhotoOpDialog`); imports `Toggle` from `StreamCard.tsx`
  - `ImageStreamsCenter.tsx` — root layout only (~100 lines); `useApp` for `imageStreams` + `importQueue` only
  - `npm run typecheck` and `npm run lint` pass with 0 errors after split

---

### Documentation

- [x] **8a** — README and docs accuracy pass:
  - Fallback routing description updated (unrouted → fallback-routed into derived session)
  - Duplicate behavior updated (skip by many fields → re-imported with unique `_2`/`_3` suffix; only exact source path is skipped)
  - Phase heading updated to "Stream ingest hardening and activity visibility"
  - Phase plan table updated to "In progress"
  - Known Limitations `reveal_in_explorer` entry updated to reflect current root-check guard behavior

---

## Known Limitations / Future Work

- **Watch-path reveal for external drives:** `reveal_in_explorer` will return an error (and log a console warning) for watch folders configured outside `C:\PhotoFlow Desktop` or `%LOCALAPPDATA%`. Operators who place watch folders on other drives (e.g. `D:\test-watcher`) will see no crash but will not be able to use the Reveal button for those folders. Future fix: Tauri runtime scope API per-path injection, or constrain watch-folder selection to within the allowed roots.
- **fs:scope watch-folder regression (re-opened):** The Phase 9 narrowed scope (`C:\PhotoFlow Desktop\**` + `$APPLOCALDATA\...`) blocked `fs:allow-watch` and `fs:allow-read-dir` on user-configured watch folders outside those roots (e.g. `D:\test-watcher`). Tauri v2 does not expose a `fs:allow-watch-all` permission that bypasses scope checks independently of read/write scope, and dynamic scope injection (`Manager::add_scope`) requires non-trivial Rust infrastructure. The `**` entry has been restored to `fs:scope` so operators can place watch folders on any drive. The `reveal_in_explorer` guard (1b) and the specific managed-storage path entries are retained and remain effective. A future phase should implement runtime scope injection when the user selects a watch folder and remove the broad `**` entry.
- **Dynamic fs:scope for watch folders:** The `fs:scope` capability entry includes `**` to support arbitrary watch folder paths. A future phase should replace this with per-path scope injection at the time the user configures a watch folder, and remove the broad entry.
