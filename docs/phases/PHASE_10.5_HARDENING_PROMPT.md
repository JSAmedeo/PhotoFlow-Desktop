# Phase 10.5 — Security & Reliability Hardening Pass

**Target branch:** `feature/phase-10-auto-enhance` (base commit `a5abfb3`)
**Scope:** Fixes only. No new features, no UI redesign, no refactors beyond what each fix requires.
**Consolidates:** The four carried-forward Phase 9 issues (fs scope, session race, counter lost-updates, migration replay) plus all findings from the Phase 10 branch review.

---

## Ground rules — intentional behaviors that MUST NOT change

These were deliberate design decisions. Do not "fix" them:

1. **Deletion-event guard in `autoImportWatchedFile`** (`src/ingest/autoImportPipeline.ts`): the pre-queue `stat()` check that silently returns `'skipped'` when the file is gone exists to absorb FS watcher events fired by our own post-import `remove()`. Keep it.
2. **`recentlyHandled` timing in `watchedFolderService.ts`**: 5 s suppression for complete imports, 10 s for failed/skipped. This split is intentional (covers the deletion-event window and `scanExistingFiles` on watcher restart). Keep the values and the always-guard behavior.
3. **`waitForStableFile` effectiveDelay cap** (5 s per check, ~25 s max total): intentional stall protection. Keep.
4. **Idempotent `addPhotoVersion`** (`ON CONFLICT(id) DO UPDATE` with deterministic `pv-{photoId}-{kind}` IDs): intentional — re-enhancement must remain safe. Keep.
5. **`spawn_blocking` wrappers on both Rust image commands**: keep. All new Rust work must also stay off the main thread.
6. **Fire-and-forget enhancement dispatch** (photo visible immediately, tile updates when done): the *UX* is intentional. Workstream D bounds concurrency but must not make imports block on enhancement completion.
7. **Enhancement parameter units at the invoke boundary**: TS sends fractions to `enhance_photo` (percent ÷ 100 done in `enhancementService.ts`); `apply_photo_adjustments` receives raw −50..+50 slider values and Rust divides by 100. Preserve these contracts and their boundary comments — commit `a5abfb3` exists because this went wrong once already.
8. **Dynamic `@tauri-apps/*` imports** behind `isTauriRuntime()` guards: required so the browser bundle never resolves Tauri modules. Any new imports of Tauri APIs must follow the same pattern.

---

## Workstream A — Path validation on Rust image commands (CRITICAL)

**Files:** `src-tauri/src/lib.rs`, `src-tauri/src/enhance.rs`

**Problem:** `enhance_photo` and `apply_photo_adjustments` accept arbitrary `input_path`/`output_path` strings from the webview with zero validation. `apply_photo_adjustments` overwrites its input in place. A compromised webview can overwrite any writable file on disk with JPEG bytes, or use `enhance_photo` as an arbitrary read→transcode→write primitive. Compare `reveal_in_explorer`, which already enforces an allowlist.

**Fix:**
1. Extract the allowed-roots logic from `reveal_in_explorer` into a shared helper, e.g.:
   ```rust
   fn allowed_roots() -> Vec<std::path::PathBuf> { /* C:\PhotoFlow Desktop, %LOCALAPPDATA%\PhotoFlow Desktop, $HOME/PhotoFlow Desktop */ }
   fn assert_within_allowed_roots(path: &std::path::Path) -> Result<std::path::PathBuf, String> // returns canonicalized path
   ```
2. In `enhance_photo`: canonicalize and validate `input_path` (must exist, must be a file, must be under an allowed root). For `output_path`, the file does not exist yet — canonicalize its **parent directory** and validate that, then require the filename component to contain no path separators and not be `..`.
3. In `apply_photo_adjustments`: validate `input_path` the same way.
4. Use the canonicalized paths for all subsequent file operations (open, create) — do not re-use the raw strings after validation (TOCTOU hygiene). Apply the same `\\?\` prefix handling already used in `list_folder_files`.
5. `reveal_in_explorer` currently validates the canonical path but passes the **original** `path` string to `explorer`/`open`/`xdg-open`. Change it to pass the canonicalized path.
6. Return errors as `Err(String)` so the TS side surfaces them through the existing `processingStatus: 'error'` path — no panics, no `unwrap()`.

**Guard:** Photo storage lives under `$APPLOCALDATA/PhotoFlow Desktop` (and `C:\PhotoFlow Desktop`). Verify the exact directories `tauriPhotoStorage.ts` writes to and make sure every legitimate enhancement/adjustment path passes the new validation before merging — do not break the happy path.

---

## Workstream B — PNG alpha destruction in enhancement (CRITICAL, product-facing)

**Files:** `src-tauri/src/enhance.rs`, `src/ingest/enhancementService.ts`

**Problem:** `SUPPORTED_ENHANCE_EXTENSIONS` includes `.png`, but `enhance_image` calls `to_rgb8()` and always encodes JPEG. A background-removed cutout PNG run through auto-enhance loses its alpha channel — transparent regions flatten (typically to black) and the output is `_enhanced.jpg`. For streams carrying rembg cutouts this is a visible product failure.

**Fix (preferred — preserve alpha):**
1. In `enhance_image`, detect whether the decoded image has an alpha channel (`img.color().has_alpha()`).
2. **Alpha path:** convert to `Rgba8`. Split alpha out, run brightness/contrast/saturation/unsharp on the RGB planes only (do not touch alpha; do not let the blur bleed color across fully-transparent pixels — either premultiply before blur and unpremultiply after, or restrict unsharp to pixels with alpha > 0). Recombine and encode **PNG** to `{stem}_enhanced.png`.
3. **No-alpha path:** existing RGB→JPEG q92 behavior, unchanged.
4. Return the actual output path from the command (it already returns `Ok(output_path)`) and have `enhancementService.ts` stop hardcoding `.jpg`: compute the expected extension from the source, or better, trust the returned path when building the `PhotoVersion` and `convertFileSrc` URL.

**Fallback (acceptable if the alpha pipeline is too invasive for this pass):** exclude PNG from auto-enhance entirely — remove `.png` from `SUPPORTED_ENHANCE_EXTENSIONS`, keep the existing console-warn skip path, and record the photo as `processingStatus: 'done'` with no enhanced version rather than `'error'`. Choose one approach and note it in the commit message; do not ship the current silent-flatten behavior.

**Guard:** JPEG inputs must produce byte-for-byte-equivalent behavior to today (same q92, same `_enhanced.jpg` naming).

---

## Workstream C — Workshop save-changes: EXIF orientation + non-destructive writes (HIGH)

**Files:** `src-tauri/src/enhance.rs` (`apply_adjustments`), `src/features/workshop/CenterPanel.tsx` (`saveAdjustments`), `src/ingest/enhancementService.ts` (path helper reuse)

**Problem (two related bugs):**
1. `apply_adjustments` skips the EXIF orientation read/bake that `enhance_image` performs. Re-encoding strips the EXIF orientation tag, so saving adjustments on an unrotated camera JPEG (orientation 6/8) produces a sideways image.
2. `saveAdjustments` falls back to `currentPhoto.storagePath` when no enhanced version exists — meaning it **overwrites the original file in place**, permanently destroying the original and contradicting the PhotoVersion original/enhanced history design. Repeated saves also compound JPEG q92 generation loss.

**Fix:**
1. In `apply_adjustments`: read EXIF orientation and bake it exactly as `enhance_image` does (reuse `read_exif_orientation` / `apply_exif_orientation`).
2. Make the save non-destructive:
   - If an **enhanced version exists**: read from the enhanced file, write to the same enhanced path (in-place on the derived file is acceptable — the original remains untouched). Current behavior, kept.
   - If **no enhanced version exists**: read from the original, write to `{stem}_enhanced.jpg` (reuse the `enhancedOutputPath` naming), then create `original` and `enhanced` `PhotoVersion` rows via the same idempotent `addPhotoVersion` flow `enhancementService.ts` uses, and set `activeVersionKind: 'enhanced'`. The original file is never opened for writing.
3. In `CenterPanel.saveAdjustments`, update the metadata/URL wiring to point at the actual output path (see Workstream H item 2 for the cache-buster handling).
4. Generation-loss note: multiple saves onto the enhanced file still recompress. Acceptable for this pass; add a code comment acknowledging it. Do **not** build a full adjustment-layer system — out of scope.

**Guard:** The compare slider must keep working: ORIGINAL pane keeps showing the untouched original, right pane shows the saved result. The CSS-filter live preview before save is unaffected.

---

## Workstream D — Bound enhancement concurrency (HIGH)

**Files:** `src/ingest/enhancementService.ts` (queue lives here), `src/ingest/autoImportPipeline.ts` (call site unchanged)

**Problem:** `void enhanceImportedPhoto(...)` gives unbounded concurrency. A 50-file burst into an auto-enhance stream spawns 50 concurrent `spawn_blocking` jobs; `unsharp_mask` holds ~3 full-resolution RGB buffers at peak (~72 MB each at 24 MP), so memory can spike into the gigabytes. Rayon's shared pool bounds CPU but not memory.

**Fix:**
1. Add a small in-module promise queue (FIFO, concurrency limit **2**) inside `enhancementService.ts`. Simplest form: a chained-promise / counter pattern; no new dependencies.
2. `enhanceImportedPhoto` enqueues and returns immediately from the caller's perspective — the `void`-dispatch call site in `autoImportPipeline.ts` does not change, and imports never block on enhancement (Ground rule 6).
3. Queue failures must not poison the queue: each job's rejection is caught inside the queue runner (the existing per-photo try/catch already sets `processingStatus: 'error'`).
4. Optional, cheap insurance while in this file: skip enhancement (log + `processingStatus: 'done'`, no version rows) for source files above a sanity ceiling, e.g. 100 MB, using the `fileSizeMb` already on the photo record.

**Guard:** Photos must still appear in the UI immediately at pending status; enhanced tiles appear as jobs drain.

---

## Workstream E — Replace the `**` filesystem scope (CRITICAL, carried from Phase 9)

**Files:** `src-tauri/capabilities/default.json`, `src/ingest/watchedFolderService.ts`, `src/ingest/autoImportPipeline.ts`, possibly `src-tauri/src/lib.rs`

**Problem:** `fs:scope` includes `{ "path": "**" }`, granting the webview read/write/remove/watch across the entire filesystem. This makes the specific PhotoFlow path entries decorative and neutralizes the `blocked_roots` denylist in `list_folder_files` (the frontend can call `readDir`/`readFile`/`remove` on any path directly through the fs plugin).

**Fix (choose the runtime-scope approach — it matches the operator requirement):**
1. Remove `{ "path": "**" }` from the capability. Keep the app-managed entries (`C:\PhotoFlow Desktop\**`, `$APPLOCALDATA/PhotoFlow Desktop/**`, and the applocaldata recursive permissions).
2. Watch folders are operator-chosen and can live on any drive, so grant them at runtime: when a watch path is configured/loaded, extend the fs scope programmatically for that directory. In Tauri v2 this is done from Rust — add a small command (e.g. `allow_watch_folder(path: String)`) that validates the path (exists, is a directory, reuse the `blocked_roots` list from `list_folder_files`, case-insensitive per Workstream H item 3) and then extends the fs plugin scope for that directory subtree via the plugin's scope API (`FsExt` / `fs_scope().allow_directory(...)`). Call it from `watchedFolderService.ts` before starting each watcher (both the single-folder path and the per-stream path), and on app startup when persisted streams are re-armed.
3. If the scope-extension API proves unavailable in the pinned plugin version, fallback: route watched-folder reads/removes through new validated Rust commands instead (`read_watched_file`, `remove_watched_file`) and keep the capability tight. Prefer option 2; document whichever lands.

**Guard:** All Phase 6–9 acceptance behaviors must survive: watcher start/stop, `scanExistingFiles` on restart, stabilize→import→remove flow, streams on non-C: drives. Test with a watch folder outside the app directories — that is the entire point of the runtime grant.

---

## Workstream F — Atomic SQL for session creation and stream counters (HIGH, carried from Phase 9)

**Files:** `src/data/stores/sqliteMetadataStore.ts`, `src/data/repository.ts`, `src/data/db/schema.ts` or a new migration, `src/data/stores/metadataStore.ts` + `browserMetadataStore.ts` (interface parity)

**Problem 1 — session check-then-insert race:** `routePhotoToSession` → `addSession` does `getSessionByCode` then upsert. Two interleaved imports for the same new session key can both pass the check; session IDs differ (`Date.now()` suffix), so duplicate sessions result.

**Fix 1:**
1. Add migration **12**: `CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_session_code ON sessions(session_code)`. Pre-step in the same migration: dedupe any existing duplicate `session_code` rows first (keep the oldest `created_at`; re-point `photos.session_id` and `import_queue.session_id` from losers to the keeper; delete losers) so the index can build on dirty databases.
2. Change `sqliteMetadataStore.addSession` to `INSERT ... ON CONFLICT(session_code) DO NOTHING`, then `SELECT` by `session_code` and return that row. The returned session is authoritative — callers must use it (they already do; `routePhotoToSession` uses the return value).
3. Mirror the semantic (insert-if-absent, return winner) in `browserMetadataStore` so dev mode behaves identically.

**Problem 2 — counter lost updates:** `recordImageStreamActivity` (`repository.ts` ~line 264) reads the stream, then writes `totalDetected: stream.totalDetected + 1` etc. Interleaved events lose increments.

**Fix 2:**
1. Add a dedicated store method, e.g. `recordStreamActivity(streamId, event, filename)`, whose SQLite implementation is a single statement:
   ```sql
   UPDATE image_streams SET
     total_detected = total_detected + $detected,
     total_imported = total_imported + $imported,
     total_skipped  = total_skipped  + $skipped,
     total_failed   = total_failed   + $failed,
     last_activity_at = $now,
     last_detected_filename = COALESCE($detectedName, last_detected_filename),
     last_imported_filename = COALESCE($importedName, last_imported_filename),
     status = $status
   WHERE id = $id
   ```
2. Keep the existing status derivation logic (`failed→error`, `skipped→review`, else `watching`/`idle` based on enabled+watchPath) — compute it in TS before the UPDATE; a pre-read for `enabled`/`watch_path` only is fine since those fields aren't racing.
3. `repository.recordImageStreamActivity` delegates to the new method. Preserve the existing comment/contract that the pipeline's outer catch drives `totalFailed` (see repository.ts ~line 693 comment).
4. `filesPerMinute` keeps its current `Math.max(1, ...)` placeholder behavior — fold into the same UPDATE.

---

## Workstream G — Transactional migrations, drop the benign-error heuristic (MEDIUM, carried from Phase 9)

**Files:** `src/data/db/database.ts`, `src/data/db/migrations.ts`

**Problem:** `isBenignMigrationError` swallows "duplicate column" / "already exists", which papers over partial replays but can mask real drift. Migrations run without transactions. `splitSqlStatements` splits on `;`, which breaks on triggers or semicolons in string literals.

**Fix:**
1. Wrap each migration in `BEGIN IMMEDIATE` / `COMMIT` (with `ROLLBACK` on error), and insert the `schema_migrations` row **inside the same transaction**. A migration is then all-or-nothing and re-runnable.
2. Remove `isBenignMigrationError` and its per-statement try/catch for migrations **13+**. For migrations 1–12, keep the heuristic (databases in the field may already be in half-applied states from the old runner; the transactional runner + recorded rows prevents new ones). Add a comment marking the cutover.
3. Replace `splitSqlStatements` string-splitting: `MIGRATIONS` already stores `statements: string[]` — migration 1 is the only caller of the splitter. Inline `INITIAL_SCHEMA_SQL` as an explicit statement array in `schema.ts` and delete the splitter. Verify statement-for-statement equivalence against the current `INITIAL_SCHEMA_SQL` before deleting.
4. Wrap `deleteSession`'s three DELETEs (`import_queue`, `photos`, `sessions`) in a single transaction while you're in this layer.

**Guard:** Upgrading a real Phase 9/10 database (migrations 1–11 applied) must be a no-op pass. Test: fresh DB, Phase-9 DB, and a DB with a manually half-applied old migration.

---

## Workstream H — Minor fixes (LOW, batch into one commit)

1. **Enhanced version file size** (`enhancementService.ts`): after `enhance_photo` returns, `stat` the output and record real `fileSizeMb` instead of `0`.
2. **Cache-buster persisted to DB** (`CenterPanel.saveAdjustments`): don't store `?t=Date.now()` into `displayUrl`/`afterImageUrl`. Store the clean `convertFileSrc` URL; apply the cache-buster only at render time (append in the component or bump a local state key).
3. **Case-insensitive `blocked_roots`** (`lib.rs::list_folder_files`): on Windows, compare lowercased path against lowercased roots (`c:\windows` currently bypasses). Reuse the hardened list in Workstream E's validation.
4. **CSP dev endpoints in production** (`tauri.conf.json`): `connect-src` allows `ws://localhost:*` and `http://localhost:*`. Move these to a dev-only config (`tauri.conf.dev.json` merge or build-time patch) so release builds ship without them.
5. **Large-file ceiling on import** (`autoImportPipeline.ts`): after `waitForStableFile` returns size, skip (status `skipped`, error text explaining size limit) files above a configurable ceiling (default 200 MB) before `readFile` loads them into memory.
6. **Repo hygiene** (separate commit, optional): `design-handoff/` is 8.8 MB of prototype HTML/screenshots. Move to an archive branch or release asset; do not delete history.

---

## Acceptance checklist

**A — Path validation**
- [ ] `enhance_photo` rejects input paths outside allowed roots (test: `C:\Windows\System32\config\SAM`, `/etc/passwd`) with `Err`, no panic
- [ ] `enhance_photo` rejects output paths whose parent is outside allowed roots, and filenames containing separators or `..`
- [ ] `apply_photo_adjustments` rejects out-of-root input paths
- [ ] Normal auto-enhance and workshop save flows still succeed end-to-end
- [ ] `reveal_in_explorer` spawns with the canonicalized path

**B — PNG alpha**
- [ ] Cutout PNG with transparency + auto-enhance ON → output preserves transparency (or PNG cleanly skipped, per chosen approach — state which)
- [ ] JPEG enhancement output unchanged (q92, `_enhanced.jpg`)
- [ ] `PhotoVersion.storagePath` / `displayUrl` match the actual output extension

**C — Save changes**
- [ ] Camera JPEG with EXIF orientation 6: save adjustments → result upright
- [ ] Save on photo with no enhanced version → original file bytes untouched; new `_enhanced.jpg` created; both version rows exist; `activeVersionKind = 'enhanced'`
- [ ] Save on photo with existing enhanced version → writes enhanced file only
- [ ] Compare slider: ORIGINAL pane still shows untouched original after save

**D — Concurrency**
- [ ] Drop 20+ images into an auto-enhance stream: at most 2 enhancement jobs in flight; all complete; UI shows pending→done progressively
- [ ] One failing file (e.g. truncated JPEG) does not stall the queue; its photo shows `error`

**E — fs scope**
- [ ] `{ "path": "**" }` removed from `default.json`
- [ ] Watch folder on a non-app path (e.g. `D:\WatchTest`) works: detect, stabilize, import, remove
- [ ] Persisted streams re-arm correctly after app restart (runtime scope re-granted)
- [ ] `readFile` via devtools on an unscoped path (e.g. `C:\Windows\win.ini`) is denied

**F — Atomicity**
- [ ] Migration 12 dedupes pre-existing duplicate session codes and builds the unique index on a dirty DB
- [ ] Two rapid imports with the same new session code → exactly one session row; both photos routed to it
- [ ] Burst of N files → `total_detected` increases by exactly N (no lost increments)
- [ ] Browser dev mode still routes/creates sessions identically

**G — Migrations**
- [ ] Fresh DB: all migrations apply in one pass, each recorded transactionally
- [ ] Phase 9/10 DB upgrade: no-op replay, no errors
- [ ] A migration that fails mid-way leaves no partial schema and no `schema_migrations` row
- [ ] `deleteSession` is atomic (kill mid-delete leaves no orphaned photos/queue rows)

**H — Minor**
- [ ] Enhanced versions record real file sizes
- [ ] `photos.display_url` in DB contains no `?t=` params after save
- [ ] `list_folder_files("c:\\windows")` (lowercase) returns empty
- [ ] Release build CSP contains no `localhost` connect-src entries
- [ ] 250 MB file in watch folder → skipped with size-limit message, app memory stable

**Global**
- [ ] `npm run typecheck`, `npm run lint`, `npx vitest run` all clean
- [ ] `cargo check` clean; no new `unwrap()`/`expect()` on fallible paths in command handlers
- [ ] All Ground-rule behaviors verified unchanged

---

## Out of scope for this pass

- Adjustment layers / non-destructive editing beyond the version-file split in Workstream C
- Enhancement algorithm changes (kernel, quality, parameters)
- Any Phase 11 feature work
- Rewriting the migration history for migrations 1–11
