# PhotoFlow Desktop — Phase 9 Acceptance Checklist

## Phase Goal

Harden the Phase 8 codebase against security risks, resilience failures, and code quality issues; establish a unit-test foundation; improve import activity visibility; and make file handling robust enough for real operator use — including unrecognised filenames, duplicate drops, and watch folders on any drive.

---

## In Scope

- Narrow `fs:scope` from `**` to app-data paths (then restore `**` for watch-folder flexibility — see Known Limitations)
- Guard `reveal_in_explorer` against arbitrary paths
- Fix deterministic session ID collision
- Scope duplicate-import photo fetch to the target session
- Cap `waitForStableFile` settle delay
- Remove redundant `/i` flag from filename parser
- Extract `slugify` to a shared utility
- Lazy-load Tauri imports in `watchedFolderService.ts`
- Vitest unit tests for filename parser and session routing
- FOLDER / ACTIVITY tab toggle on each stream card
- Loosen filename acceptance — any image file routes to a session via fallback key derivation
- Change duplicate handling — re-dropped files import with `_2`, `_3`, … suffix instead of being skipped
- Fix Tauri string error visibility in catch blocks
- Restore `**` in `fs:scope` so watch folders on non-C: drives work

## Out Of Scope

- New UI features or layout changes
- localStorage-to-SQLite migration
- Dynamic per-path `fs:scope` injection for user-chosen watch folders
- Processing queue activation
- AI / rembg processing
- Cloud sync or API stream ingestion
- Print workflows

---

## Implementation Checklist

### Security

- [x] `src-tauri/capabilities/default.json` — scoped paths added for `C:\PhotoFlow Desktop\**` and `$APPLOCALDATA/PhotoFlow Desktop/**`
- [x] `src-tauri/capabilities/default.json` — `**` restored to support arbitrary operator watch-folder paths (see Known Limitations)
- [x] `src-tauri/src/lib.rs` — `reveal_in_explorer` guards: path must exist and be under `C:\PhotoFlow Desktop` or `$LOCALAPPDATA` (Windows) / `$HOME` (other platforms); returns `Err` otherwise

### Resilience

- [x] `src/ingest/sessionRoutingService.ts` — auto-created session IDs include a base-36 timestamp suffix; prevents silent collision with seed data
- [x] `src/data/repository.ts` — `isDuplicateImport` fifth-arg default narrowed to `getPhotosBySessionId(sessionId)` (was all photos)
- [x] `src/ingest/fileStability.ts` — settle delay capped at 5 s per check via `Math.min(settleDelayMs, 5_000)`

### Code Quality

- [x] `src/ingest/filenameParser.ts` — `/i` flag removed; stem uppercased before matching
- [x] `src/utils/slugify.ts` — `slugify` extracted to shared utility; `repository.ts` imports from it
- [x] `src/ingest/watchedFolderService.ts` — Tauri imports lazy-loaded inside runtime-guarded functions; no top-level Tauri imports remain

### Test Foundation

- [x] `vitest@2` installed; `"test": "vitest run"` added to `package.json`
- [x] `src/ingest/filenameParser.test.ts` — 9 test cases
- [x] `src/ingest/sessionRoutingService.test.ts` — 3 test cases
- [x] All 12 unit tests pass (`npm run test`)

### Activity Visibility

- [x] `src/features/streams/ImageStreamsCenter.tsx` — FOLDER / ACTIVITY tab toggle on each stream card
- [x] ACTIVITY tab shows last 12 import queue items per stream: filename, OK / SKIP / FAIL badge, error reason
- [x] Amber numeric badge on ACTIVITY tab when skipped or failed items are present

### Loose Filename Acceptance

- [x] `src/ingest/filenameParser.ts` — `sessionKey` is always non-null; `deriveFallbackKey()` produces a sanitised uppercase key from the filename stem when no `[A-Z]{3}\d{6}` pattern is found
- [x] `routingConfidence` changed from `'matched' | 'unmatched'` to `'matched' | 'fallback'`
- [x] `src/ingest/sessionRoutingService.ts` — null-sessionKey early return removed; all files now reach `status: 'routed'`; fallback sessions noted "Auto-created — no recognizable session code in filename."

### Duplicate Handling

- [x] `src/data/repository.ts` — `isDuplicateImport` boolean removed; replaced with `resolveUniqueFilename()` which appends `_2`, `_3`, … until the stored filename is unique
- [x] Duplicate drops import as a new photo rather than being skipped; no error in the ACTIVITY tab
- [x] `isSourcePathDuplicate` guard removed; `recentlyHandled` (10 s window) handles the watcher re-fire guard

### Error Visibility

- [x] `src/ingest/autoImportPipeline.ts` — catch block surfaces Tauri string errors directly (not always "Watched-folder import failed.")
- [x] `src/data/repository.ts` — `describeImportError()` helper used in both import catch blocks

---

## Validation Commands

```
npm run typecheck     # 0 errors required
npm run lint          # 0 new errors
npm run test          # 12 tests pass
npm run build         # production build succeeds
```

---

## Manual Validation Checklist

All steps run in Tauri desktop mode (`npm run tauri:dev`). Reference: `PHASE_9_MANUAL_TEST.md`.

### Standard Session Code Routing

- [ ] `SAZ482823_01.jpg` dropped → OK, session `SAZ482823` created or matched
- [ ] Second file with same session code routes to existing session, not a new one
- [ ] Lowercase filename (`saz482823_01.jpg`) normalised to `SAZ482823`, same session
- [ ] Session code embedded mid-filename (`IMG_4021_XYZ123456_03.jpg`) extracted correctly

### Fallback Routing

- [ ] `holiday_photo.jpg` dropped → OK, session key `HOLIDAY-PHOTO` created
- [ ] `io31erhfuinl_33_2dfds.jpg` dropped → OK, session key `IO31ERHFUINL-33-2DFDS` created
- [ ] `test.jpg` dropped → OK, session key `TEST` created
- [ ] Fallback-routed files show **OK** in ACTIVITY tab (not SKIP)
- [ ] Fallback sessions visible in Gallery

### Duplicate Handling

- [ ] Drop `SAZ482823_01.jpg` → OK
- [ ] Drop same file again → second entry in ACTIVITY shows **OK**, not SKIP
- [ ] Session contains two photos; second is named with `_2` suffix
- [ ] Third drop → `_3` suffix, still OK

### Fallback Duplicate Handling

- [ ] Drop `test.jpg` → OK
- [ ] Drop `test.jpg` again → OK, stored as `test_2.jpg`

### Watch Folder on Secondary Drive

- [ ] Stream configured with watch path on non-C: drive (e.g. `D:\test-watcher`)
- [ ] No "forbidden path" error in console
- [ ] Files dropped on secondary drive import correctly

### ACTIVITY Tab

- [ ] ACTIVITY tab shows per-stream import history
- [ ] Skipped / failed items shown with error reason
- [ ] Amber badge count matches number of non-OK items
- [ ] Unsupported file type (e.g. `.pdf`) shows SKIP with reason

### Stream Stats and Gallery

- [ ] IN / OK / ERR counters increment correctly after imports
- [ ] Gallery filters by stream when a stream is selected in the left panel location dropdown
- [ ] Workshop loads photos for an imported session without errors

### reveal_in_explorer Guard

- [ ] Reveal button works for files inside `C:\PhotoFlow Desktop`
- [ ] Reveal button on a stream with watch folder outside managed root shows a graceful error (no crash)

---

## Acceptance Criteria

- [ ] `npm run typecheck` — 0 errors
- [ ] `npm run lint` — 0 new errors
- [ ] `npm run test` — all 12 tests pass
- [ ] `npm run build` — succeeds
- [ ] Any image file dropped into a watched folder imports without a SKIP; a session is created if none exists
- [ ] Re-dropping a file that was already imported produces a `_2`-suffixed import, not a skip
- [ ] ACTIVITY tab shows real-time OK / SKIP / FAIL status with error detail for each file
- [ ] Watch folders on non-C: drives work without "forbidden path" errors
- [ ] `reveal_in_explorer` returns a graceful error for paths outside the allowed root
- [ ] Session IDs are unique; no silent collision with seed sessions

---

## Known Limitations

- **`fs:scope` broad entry:** `{ "path": "**" }` was restored because Tauri v2 has no `fs:allow-watch-all` permission that bypasses scope checks independently of read/write. Narrowing to `C:\PhotoFlow Desktop\**` broke watch folders on other drives. A future phase should implement runtime per-path scope injection (`Manager::add_scope`) and remove the broad entry.
- **Remove failure loop:** If `remove()` fails on a watched file (file locked or permission error), the watcher will re-import it every ~10 seconds as `_2`, `_3`, etc. This is visible in the ACTIVITY tab. The operator can identify and resolve the underlying cause. A future phase can add a remove-retry mechanism or a "stuck file" alert.
- **`reveal_in_explorer` on non-managed paths:** Watch folders outside `C:\PhotoFlow Desktop` and `%LOCALAPPDATA%` cannot be revealed in Explorer due to the path guard introduced in 1b.

## Deferred Items

- Dynamic `fs:scope` injection when operator selects a watch folder
- Processing queue activation
- AI / rembg processing
- Print workflow
- Cloud sync / API stream ingestion
- Remove-failure alerting or retry mechanism

---

## Final Completion Review

- [ ] All automated validation commands pass
- [ ] Manual validation checklist completed by operator
- [ ] Known limitations documented and accepted
- [ ] Deferred items recorded for future phases
