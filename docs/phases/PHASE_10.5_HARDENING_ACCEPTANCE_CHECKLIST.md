# Phase 10.5 (Hardening) Acceptance Checklist — Security & Reliability Pass

## Goal

Implement `PHASE_10.5_HARDENING_PROMPT.md`: path validation on the Rust image commands,
PNG alpha preservation, non-destructive workshop saves with EXIF orientation, bounded
enhancement concurrency, atomic SQL for session creation and stream counters,
transactional migrations, and the batch of minor fixes. Fixes only — no new features,
no UI redesign.

**Base state note:** this pass landed on top of commit `132cc4d` (the Phase 10.5 bug-fix
pass), which had already completed Workstream E (wildcard `fs:scope` removed, runtime
`allow_watch_path` grant) and parts of F/G. Deltas below are relative to that commit.

## Workstream status

### A — Path validation on Rust image commands ✅

- [x] Shared `allowed_roots()` / `assert_within_allowed_roots()` helpers in `lib.rs`
      (extracted from `reveal_in_explorer`); canonicalized path returned and used for
      all subsequent file operations (TOCTOU hygiene), `\\?\` prefix stripped.
- [x] `enhance_photo`: input must exist, be a file, live under an allowed root; output
      parent canonicalized + validated, filename must be plain (no separators, not `..`).
- [x] `apply_photo_adjustments`: same input validation; optional `output_path` parameter
      validated the same way (in-place only when output == input).
- [x] `reveal_in_explorer` now spawns explorer/open/xdg-open with the **canonicalized**
      path, not the raw input.
- [x] All failures return `Err(String)` — no panics/`unwrap()` in command handlers.

### B — PNG alpha preservation ✅ (preferred path, not the fallback)

- [x] `enhance_image` detects alpha (`img.color().has_alpha()`); alpha path converts to
      RGBA, runs brightness/contrast/saturation pointwise on RGB channels only.
- [x] Unsharp mask on alpha images runs on **premultiplied** color (premultiply → blur →
      sharpen → unpremultiply) so transparent-pixel RGB can't bleed into edges; fully
      transparent pixels untouched.
- [x] Alpha output encodes PNG to `{stem}_enhanced.png`; command returns the actual path.
- [x] `enhancementService.ts` stops hardcoding `.jpg` — trusts the returned path for the
      `PhotoVersion` row and `convertFileSrc` URL.
- [x] No-alpha path unchanged: RGB → JPEG q92 → `_enhanced.jpg`.
- [x] EXIF orientation now applied via `DynamicImage` transforms (`fliph`/`rotate90`/…)
      which preserve the pixel format, replacing the `to_rgb8()`-based version.

### C — Workshop save: EXIF orientation + non-destructive ✅

- [x] `apply_adjustments` reads and bakes EXIF orientation exactly as `enhance_image`
      does (shared helpers).
- [x] `apply_adjustments` handles alpha inputs (pointwise adjust, PNG out) so saving on
      an enhanced cutout PNG doesn't flatten it.
- [x] `CenterPanel.saveAdjustments`: with an enhanced version → in-place bake on the
      derived file (original untouched, unchanged behavior). Without one → writes
      `{stem}_enhanced.*`, creates `original` + `enhanced` PhotoVersion rows via the
      idempotent `addPhotoVersion` flow, sets `activeVersionKind: 'enhanced'`. The
      original file is never opened for writing.
- [x] Generation-loss comment added in `apply_adjustments` (repeated q92 recompress
      accepted for this pass).
- [x] Compare slider: ORIGINAL pane keeps showing `beforeImageUrl` (untouched original).

### D — Bounded enhancement concurrency ✅

- [x] In-module FIFO slot queue in `enhancementService.ts`, concurrency limit **2**,
      no new dependencies.
- [x] Call site in `autoImportPipeline.ts` unchanged (`void enhanceImportedPhoto(...)`);
      imports never block on enhancement (Ground rule 6 preserved).
- [x] Queued photos stay `pending`; `processing` is set only when a slot is acquired,
      so tiles progress one by one.
- [x] Per-job failure caught inside the runner (`processingStatus: 'error'`); slot
      released in `finally` — a failing file can't poison the queue.
- [x] Sanity ceiling: files over 100 MB skip enhancement (`processingStatus: 'done'`,
      no version rows).

### E — `**` filesystem scope ✅ (carried in from commit `132cc4d`)

- [x] `{ "path": "**" }` already removed; managed-storage + `$APPLOCALDATA` scopes kept.
- [x] Runtime grant via `allow_watch_path` command + `grantWatchPathAccess()` before
      every `watch()` (both single-folder and per-stream paths, and re-arm on launch).
- [x] This pass: blocked-roots check inside `allow_watch_path` is now **case-insensitive
      and component-wise** (shared `is_blocked_system_root(Path)` helper).

### F — Atomic SQL ✅ (with one intentional deviation)

- [x] `sqliteMetadataStore.addSession` → `INSERT … ON CONFLICT(session_code) DO NOTHING`
      then select-by-code; returned row is authoritative. No check-then-insert window.
- [x] Browser store `addSession` already had insert-if-absent/return-winner semantics.
- [x] New `MetadataStore.recordStreamActivity(streamId, event, filename)`:
      SQLite implementation is a single `UPDATE … SET total_x = total_x + $n` statement
      (status derived in TS from a pre-read of the non-racing `enabled`/`watch_path`);
      browser implementation is the equivalent read-modify-write.
- [x] `repository.recordImageStreamActivity` delegates to the store method; the
      tail-promise chain is retained for browser-mode RMW safety and deterministic
      status/last-filename ordering. The pipeline-outer-catch → `totalFailed` contract
      is preserved.
- [x] `filesPerMinute` keeps its `MAX(1, …)` placeholder, folded into the same UPDATE.
- **Deviation — no dedupe migration:** the prompt's migration ("dedupe duplicate
  session_code rows, then CREATE UNIQUE INDEX") is unnecessary: `session_code TEXT NOT
  NULL UNIQUE` **and** `idx_sessions_session_code` have been in the v1 schema since the
  first SQLite commit (`3544a42`), so no database in the field can contain duplicates.
  Verified against git history before skipping.

### G — Transactional migrations ✅

- [x] Migrations **13+** run through a transactional runner: `BEGIN IMMEDIATE` +
      statements + the `schema_migrations` INSERT + `COMMIT` are joined into **one
      multi-statement string executed in one `db.execute` call**. This is required for
      correctness: the plugin's sqlx pool holds multiple connections, so BEGIN/COMMIT as
      separate calls could land on different connections. (sqlx's SQLite driver
      explicitly supports multi-statement strings — `VirtualStatement` splits on `;` and
      runs them sequentially on one handle; verified in sqlx-sqlite 0.8.6 source.)
- [x] `isBenignMigrationError` scoped to migrations 1–12 only (`LAST_LEGACY_MIGRATION_ID`),
      with the cutover documented in `database.ts`. No error swallowing for 13+.
- [x] `splitSqlStatements` deleted; `INITIAL_SCHEMA_SQL` inlined as
      `INITIAL_SCHEMA_STATEMENTS: string[]` in `schema.ts` — statement-for-statement
      equivalent to what the splitter produced (7 tables + 5 indexes).
- [x] `deleteSession` (SQLite store): the three DELETEs run as one multi-statement
      transactional batch (session id inlined via SQL-escaped literal).

### H — Minor fixes

- [x] **H1** Enhanced version rows record real `fileSizeMb` via `stat` on the output.
- [x] **H2** Cache-buster no longer persisted: DB stores clean `convertFileSrc` URLs;
      `CenterPanel` applies `?t=` at render time from a local `saveStamp` state that
      resets on photo change.
- [x] **H3** `blocked_roots` comparison is lowercase + component-wise (`c:\windows`
      no longer bypasses; `C:\PhotoFlow Desktop2` doesn't match `C:\PhotoFlow Desktop`).
- [x] **H4** CSP split: `tauri.conf.json` production CSP has no `localhost` connect-src;
      `tauri.conf.dev.json` re-adds `ws://localhost:*` / `http://localhost:*` and
      `npm run tauri:dev` passes `--config src-tauri/tauri.conf.dev.json`.
- [x] **H5** 200 MB import ceiling in `autoImportPipeline` after `waitForStableFile`,
      before `readFile` — skipped with an explanatory message + `skipped` activity.
- [ ] **H6** `design-handoff/` archive — **deferred**: CLAUDE.md marks the handoff
      folder as the design source of truth, not to be moved or modified.

## Ground rules — verified unchanged

- [x] Deletion-event `stat()` guard in `autoImportWatchedFile` intact.
- [x] `recentlyHandled` 5 s / 10 s split intact.
- [x] `waitForStableFile` cap untouched.
- [x] Idempotent `addPhotoVersion` (deterministic `pv-{photoId}-{kind}` IDs) — now also
      reused by the workshop first-save path.
- [x] `spawn_blocking` on both image commands; validation happens before spawn.
- [x] Fire-and-forget dispatch UX preserved (queue bounds concurrency, doesn't block imports).
- [x] Parameter-unit contracts + boundary comments preserved (`enhance_photo` gets
      fractions from TS; `apply_photo_adjustments` gets raw −50..+50, Rust ÷100).
- [x] All new Tauri API usage behind dynamic imports + `isTauriRuntime()` guards.

## Validation (run 2026-07-04)

| Command | Result |
|---------|--------|
| `cargo check` | ✅ 0 errors |
| `npm run typecheck` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors |
| `npm run test` | ✅ 19 passed (4 files) |

## Manual checks (Tauri mode — user to confirm)

- [ ] Normal auto-enhance flow end-to-end (JPEG in watch folder → enhanced tile).
- [ ] Transparent PNG cutout + auto-enhance ON → `_enhanced.png`, transparency intact.
- [ ] Camera JPEG with EXIF orientation 6 → workshop save → result upright.
- [ ] Save on photo with no enhanced version → original bytes untouched, `_enhanced`
      file + both version rows created, compare slider still shows untouched original.
- [ ] 20+ file burst into auto-enhance stream → at most 2 jobs in flight, tiles go
      pending→done progressively; one truncated JPEG shows `error` without stalling.
- [ ] Watch folder on non-app path works (detect → stabilize → import → remove);
      `readFile` on `C:\Windows\win.ini` from devtools denied.
- [ ] Burst of same-key files → one session; DET/OK/SKIP/FAIL totals exact.
- [ ] Fresh DB migrates cleanly; existing Phase 9/10 DB no-op replays.
- [ ] `photos.display_url` in DB contains no `?t=` after a save.
- [ ] `npm run tauri:dev` still works with the dev CSP config (HMR connects).
- [ ] Release build (`npm run tauri:build`) CSP contains no localhost entries.

## Out of scope (per prompt)

- Adjustment layers beyond the version-file split
- Enhancement algorithm changes
- Phase 11 feature work
- Rewriting migration history 1–11
