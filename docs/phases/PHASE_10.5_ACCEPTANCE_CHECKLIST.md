# Phase 10.5 (Bug Fix) Acceptance Checklist — Concurrency safety, scope hardening, doc reconciliation

## Goal

Address external code-review findings: close the concurrent session-creation race, stop
losing stream-activity counter increments, remove the wildcard filesystem scope, make
SQLite migrations honest, and reconcile the stale public docs with intended behavior. No
new user-facing features. App remains visually intact and runnable after every change.

## Scope

| Item | In scope |
|------|----------|
| Serialize get-or-create in `routePhotoToSession` (per-key async lock) | ✅ |
| Defensive UNIQUE-collision handling in both stores' `addSession` | ✅ |
| Serialize `recordImageStreamActivity` to prevent lost-update counters | ✅ |
| Remove `{ "path": "**" }` from `fs:scope`; runtime scope for validated watch paths | ✅ |
| Make migrations replay clean on a fresh DB (no swallowed duplicate-column errors) | ✅ |
| Reconcile `README.md` + `CLAUDE.md`/`README.md` phase tables with intended behavior | ✅ |
| Concurrency regression tests | ✅ |
| `filesPerMinute` accuracy, unused `hour_buckets`, CSP revisit | Optional — see below |

## Out of Scope

- Any feature work beyond this bug-fix pass (processing queue, AI processing,
  move/merge/relink, operator audit history, cloud sync)
- Unrouted-quarantine behavior (product decision 5a — user chose to keep auto-create; not built)

*(Content-hash de-duplication was originally listed here as out-of-scope pending a product
decision; the user confirmed it on 2026-05-29, so it moved IN scope and is implemented — see
the Decisions section.)*
- Removing `unsafe-inline` from `style-src` (large refactor, previously scoped out)
- localStorage-to-SQLite migration

## Do NOT change (intentional Phase 9 behavior)

- [x] Route-everything routing left intact (`routePhotoToSession` still always routes;
      fallback keys still create sessions). Reconciled in docs only.
- [x] `_2`/`_3` duplicate-suffix import via `resolveUniqueFilename` left intact.
      Reconciled in docs only.

---

## Implementation Tasks

### Fix 1 — Serialize session creation (`sessionRoutingService.ts` + both stores)

- [x] Add `sessionCreationLocks` map keyed by uppercased session key in `sessionRoutingService.ts`
- [x] Fast path returns an existing session without locking
- [x] Slow path serializes get-or-create per key; re-checks existence inside the lock
- [x] Lock entry cleared in `.finally()` after creation settles
- [x] Extract a `routedResult(session, parsed, created)` helper so fast/slow paths share return shape and `reason` text
- [x] `sqliteMetadataStore.addSession`: try/catch around `upsertSession`; on UNIQUE error, re-fetch by code and return existing (already present; verified)
- [x] `browserMetadataStore.addSession`: confirm existing-by-code check runs first and returns the match (already present; verified)

### Fix 2 — Serialize stream-activity counters (`repository.ts`)

- [x] Move body of `recordImageStreamActivity` into `applyStreamActivity(...)`
- [x] Chain all calls through a module-level `streamActivityChain` tail promise (rejections swallowed on the chain so one failure can't wedge later increments)
- [x] Public signature stays `Promise<void>`; existing `await` call sites unaffected
- [x] (Optional) Atomic-SQL `UPDATE ... total_x = total_x + 1` noted as a future improvement — deferred

### Fix 3 — Filesystem scope hardening (`src-tauri/capabilities/default.json` + watch-path access)

- [x] Remove the bare `{ "path": "**" }` scope entry
- [x] Keep managed-storage + `$APPLOCALDATA` scopes
- [x] **Runtime scope extension (preferred path used):** `allow_watch_path` Tauri command calls `app.fs_scope().allow_directory(dir, true)` for validated watch paths; frontend `grantWatchPathAccess()` invokes it before `watch()`/`remove()`. Guarded-Rust-IO fallback NOT needed.
- [x] `fs:allow-remove` never granted over `**`; removal limited to managed root (static scope) + validated watch paths (runtime grant)
- [x] Mechanism documented in handoff + Known Limitations

### Fix 4 — Honest migrations (`schema.ts`, `migrations.ts`, `database.ts`)

- [x] **Froze `INITIAL_SCHEMA_SQL` to its true v1 shape** (preferred): removed forward-edited `image_streams` table + its two indexes; migrations 4–11 now own `image_streams`
- [x] Tightened `isBenignMigrationError` so it no longer swallows `"duplicate column name"` (only `"already exists"` for idempotent CREATE replays)
- [ ] Verify: delete the dev SQLite DB, start fresh → migration log is clean (no swallowed errors) — *user to confirm in Tauri mode*

### Task 5 — Documentation reconciliation (`README.md`, `CLAUDE.md`)

- [x] README routing section rewritten to describe route-everything + fallback-key behavior
- [x] README duplicate section rewritten to describe `_2`/`_3` suffix; removed the unimplemented skip-by-size/mtime/path claim
- [x] README header phase status updated (Phase 10 complete; Phase 10.5 bug-fix done)
- [x] Phase tables in `CLAUDE.md` and `README.md` updated and consistent
- [x] Phase 10.5 (Bug Fix) row added to the phase tables in CLAUDE.md and README.md

### Task 6 — Regression tests (`sessionRoutingService.test.ts` + new)

- [x] Concurrent `routePhotoToSession` for one new key → `addSession` called exactly once, all callers get the same session
- [x] Concurrent `recordImageStreamActivity` × N for one stream → final `totalDetected` === N (new file `repository.streamActivity.test.ts`)
- [x] Existing 12 tests still pass (15 total now)

### Optional / minor

- [ ] `filesPerMinute` made accurate or renamed — **deferred**, logged in Known Limitations
- [ ] `hour_buckets` table dropped — **deferred**, noted as intentionally vestigial
- [x] CSP dev/prod split re-confirmed as deferred (Tauri v2 limitation); dev build not broken

---

## Validation Commands

```bash
cd src-tauri && cargo check        # 0 errors required
npm run typecheck                  # 0 TS errors required        
npm run lint                       # 0 lint errors required
npm run test                       # existing 12 + new concurrency tests pass
npm run dev                        # browser mode renders + degrades gracefully
```

**Results (run 2026-05-29):**

| Command | Result |
|---------|--------|
| `cargo check` | ✅ Finished, 0 errors |
| `npm run typecheck` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors |
| `npm run test` | ✅ 15 passed (12 prior + 3 new) |

## Manual Checks (Tauri mode — `npm run tauri:dev`)

- [ ] Burst of files sharing one NEW session code (e.g. `XYZ123456_01..10.jpg`) → exactly one session, all photos under it, no session-creation failures
- [ ] Stream `DET` / `OK` / `SKIP` / `FAIL` counters total correctly after a burst (no undercount)
- [ ] Watched-folder import copies into managed storage AND removes the source file
- [ ] Managed-storage images still render in the gallery (`asset:` protocol intact)
- [ ] Listing/reading a system directory (`C:\Windows`) still returns nothing
- [ ] Stream create with valid absolute path saves; UNC (`\\server\share`) and relative (`../intake`) rejected with error
- [ ] Content dedup: drop a file, let it import, then drop a byte-identical copy → second one is marked "Duplicate content — already imported as …" in the queue, no new photo is created, and the duplicate source file is removed. A *different* image with the same filename still imports as `_2`.

---

## Acceptance Criteria

- `cargo check`, `npm run typecheck`, `npm run lint` all exit 0
- All tests pass (existing 12 + new concurrency regressions)
- Burst of same-key files yields one session + N photos, zero session-creation failures
- Stream counters are accurate under concurrent import
- Bare `**` fs scope removed; watched-folder import + source removal still work for a validated path; system dirs still blocked
- Fresh SQLite DB migrates with no swallowed errors
- README reconciled with intended behavior; phase tables consistent
- No new UI features; app visually intact in both modes
- Intentional Phase 9 behaviors (route-everything, `_2`/`_3` suffix) preserved

---

## Decisions — RESOLVED by user (2026-05-29)

| # | Decision | User answer | Action taken |
|---|----------|-------------|--------------|
| 5a | Unrecognized-filename files: auto-create sessions vs. quarantine bucket? | **Keep auto-creating** | No code change; current route-everything behavior reconfirmed and documented |
| 5b | Add content-hash de-duplication so re-sent identical captures are skipped? | **Yes, include SHA-256** | **Implemented** (see below) |

### Content de-duplication (5b) — implemented

- [x] `Photo.contentHash` field added (`models.ts`); migration 12 adds `content_hash TEXT` +
  `idx_photos_content_hash`.
- [x] `MetadataStore.getPhotoByContentHash` added to the interface and both stores; SQLite store
  persists/reads `content_hash` in `upsertPhoto`/`rowToPhoto`.
- [x] `src/ingest/contentHash.ts` — `sha256Hex(bytes)` via Web Crypto (`crypto.subtle`),
  available in the Tauri WebView secure context.
- [x] `autoImportPipeline.autoImportWatchedFile` computes the hash from the read bytes, looks up
  an existing photo by hash, and on a match marks the queue item skipped
  ("Duplicate content — already imported as …"), records a `skipped` stream activity, and removes
  the redundant source file. Otherwise the hash is threaded through
  `importWatchedPhotoToSession` → `makeImportedPhoto` and stored on the new photo.
- [x] Regression test `src/ingest/contentHash.test.ts` (known SHA-256 vectors + subarray range).
- Scope: applies to **watched-folder imports** (the re-send scenario). Manual file-picker imports
  are unchanged and carry no hash. Dedup lookup is global across hashed (watched) photos.

---

## Known Limitations

| Item | Reason |
|------|--------|
| In-process session lock only | Concurrency model is a single webview/JS context; cross-process locking is not applicable |
| CSP dev/prod split | Tauri v2 has no native per-environment CSP in `tauri.conf.json`; `ws://localhost:*` required for Vite HMR |
| `style-src 'unsafe-inline'` remains | Removing requires eliminating all inline styles — large refactor, out of scope |
| Browser mode | Fallback only; not a production target. Fixes applied for correctness but browser mode is not scaled |
