# Phase 10.5 (Bug Fix) — Concurrency safety, scope hardening, and doc reconciliation

Paste this prompt into your coding agent (Opus 4.8 in VS Code) from the root of the
PhotoFlow-Desktop repo.

---

## Context

Phase 9 (stream ingest hardening) and the pre-Phase-10 security hardening pass are
complete. This phase addresses findings from an external code review. It is a
correctness-and-hardening phase: **no new user-facing features.** The app must remain
visually intact and runnable after every change.

Read `CLAUDE.md` fully before starting. Follow the Phase Checklist Rule: create
`docs/phases/PHASE_10.5_ACCEPTANCE_CHECKLIST.md` and tick items as you go.

> Note on phase numbering: this is a **bug-fix interphase (10.5)**, not a feature phase.
> It sits between Phase 10 and Phase 11 and changes no feature surface. Before finishing,
> add a Phase 10.5 row to the phase tables in both `CLAUDE.md` and `README.md`, marked as
> a bug-fix/hardening pass.

### CRITICAL — do not revert these intentional Phase 9 decisions

The external review was performed against the **public `README.md`**, which is stale.
Two review "issues" describe behavior that is *intentional* per `CLAUDE.md` and the
Phase 9 work log. **Do not change this behavior. Do not treat it as a bug.**

1. **Route-everything routing.** Every image routes. Files without a standard
   `[A-Z]{3}\d{6}` session code get a `deriveFallbackKey()` session key and create a
   session. `routePhotoToSession` intentionally never returns `'unrouted'`. This was a
   deliberate Phase 9 change ("no more silent SKIP for unrecognized filenames").
2. **`_2`/`_3` duplicate handling.** Re-dropped files import with a `_2`/`_3` filename
   suffix via `resolveUniqueFilename` instead of being skipped. This is intentional.

For both, the fix in this phase is **documentation reconciliation** (Task 5), plus
surfacing an explicit product decision for the user — NOT a behavior change.

---

## Fix 1 — Serialize session creation to close the concurrent-create race (highest priority)

**Files:** `src/ingest/sessionRoutingService.ts`, `src/data/stores/sqliteMetadataStore.ts`,
`src/data/stores/browserMetadataStore.ts`

**Why:** The watched-folder watcher fires imports fire-and-forget
(`void processCandidate(...)` per path in `watchedFolderService.ts`, plus
`scanExistingFiles` running concurrently). The only dedup guard is `inFlight`, keyed by
**file path**. When two files for the *same new session ID* arrive together — e.g.
`XYZ123456_01.jpg` and `XYZ123456_02.jpg`, which is the normal case for an FTP burst at a
high-volume venue — both reach `routePhotoToSession`, both `getSessionByCode()` return
`undefined`, and both call `addSession()`.

`addSession` is a non-atomic check-then-insert in both stores, so the guard does not hold
across the `await`:

- **SQLite:** the two racing sessions get different `id`s, so `upsertSession`'s
  `ON CONFLICT(id)` does not fire, but `sessions.session_code` is `UNIQUE` — the second
  INSERT throws, the photo is marked failed and rethrows. Result: sporadic import
  failures during exactly the bursts the app exists to handle.
- **Browser (fallback only, but fix anyway):** no unique constraint, so you get two
  sessions with the same `sessionCode`, photos split across them, and because `storeSet`
  is last-write-wins one append can clobber the other.

**Primary fix — an in-process per-key async lock around get-or-create in
`routePhotoToSession`.** This is the single chokepoint for both manual and watched
imports, so fixing it here covers every path. Add a module-level promise map keyed by the
uppercased session key:

```ts
// src/ingest/sessionRoutingService.ts

// Serializes get-or-create for a given session key within this JS context, so a burst of
// files for the same brand-new session creates exactly one session instead of racing.
const sessionCreationLocks = new Map<string, Promise<Session>>();

export async function routePhotoToSession(input: RoutePhotoInput): Promise<SessionRoutingResult> {
  const { parsed, fallbackSessionId, captureLocation } = input;
  const store = await getMetadataStore();
  const key = parsed.sessionKey.toUpperCase();

  // Fast path: session already exists.
  const existing = await store.getSessionByCode(key);
  if (existing) return routedResult(existing, parsed, /* created */ false);

  // Slow path: serialize creation per key so concurrent callers don't double-create.
  let creation = sessionCreationLocks.get(key);
  if (!creation) {
    creation = (async () => {
      // Re-check inside the lock — another caller may have created it while we waited.
      const again = await store.getSessionByCode(key);
      if (again) return again;
      return store.addSession(
        await makeSession(parsed.sessionKey, parsed.routingConfidence, fallbackSessionId, captureLocation),
      );
    })();
    creation.finally(() => sessionCreationLocks.delete(key));
    sessionCreationLocks.set(key, creation);
  }

  const session = await creation;
  return routedResult(session, parsed, /* created */ !existing);
}
```

Extract the existing return-object construction into a small `routedResult(session, parsed, created)`
helper so both the fast and slow paths reuse it and the `reason` string stays accurate
("Matched existing session." vs the create messages).

**Defense in depth — make `addSession` tolerate a lost race in both stores.** Even with
the lock, harden the stores so a `session_code` collision never throws up the stack:

- `sqliteMetadataStore.addSession`: wrap `upsertSession` in try/catch; on a UNIQUE /
  constraint error, re-fetch by code and return the existing row instead of throwing.
- `browserMetadataStore.addSession`: it already returns an existing match by id or code;
  keep that, and confirm the existing-by-code check is the first thing it does.

**Acceptance for Fix 1:** a burst of N files sharing one new session key produces exactly
one session and N photos under it, with zero failed imports attributable to session
creation. Cover this with a unit test (see Task 6).

---

## Fix 2 — Stop losing stream-activity counter increments under concurrency

**File:** `src/data/repository.ts` (`recordImageStreamActivity`)

**Why:** `recordImageStreamActivity` is a read-modify-write: it `getImageStreamById`,
computes `total* + 1`, then `updateImageStream`. Concurrent imports (the same
fire-and-forget burst as Fix 1) interleave their reads and writes, so increments are lost
and `totalDetected` / `totalImported` / `totalSkipped` / `totalFailed` undercount.

**Recommended fix (store-agnostic, simplest): serialize all activity writes through a
single tail-promise chain** so the read-modify-write never interleaves:

```ts
// src/data/repository.ts
let streamActivityChain: Promise<void> = Promise.resolve();

export function recordImageStreamActivity(
  streamId: string | undefined,
  event: 'detected' | 'imported' | 'skipped' | 'failed',
  filename: string,
): Promise<void> {
  // Chain every call so increments apply one at a time, regardless of caller concurrency.
  streamActivityChain = streamActivityChain.then(() => applyStreamActivity(streamId, event, filename));
  return streamActivityChain;
}

async function applyStreamActivity(streamId, event, filename): Promise<void> {
  // ...existing body of recordImageStreamActivity moves here unchanged...
}
```

**Optional stronger alternative (do only if straightforward):** add an atomic
`incrementStreamActivity` method to the SQLite store using
`UPDATE image_streams SET total_detected = total_detected + 1, ... WHERE id = ?`, so the
increment happens in the database rather than in JS. The serialized-chain approach above
is sufficient for this phase; document the atomic-SQL option as a future improvement if
you don't implement it.

Keep the public signature `Promise<void>` so existing `await recordImageStreamActivity(...)`
call sites are unaffected.

---

## Fix 3 — Remove the wildcard from the filesystem capability scope

**File:** `src-tauri/capabilities/default.json`

**Why:** `fs:scope` currently includes `{ "path": "**" }`. Combined with
`fs:allow-read-file`, `fs:allow-write-file`, and `fs:allow-remove`, this grants the fs
plugin full-filesystem read/write/remove and silently defeats every guard already written
(`blocked_roots` in `list_folder_files`, the allow-list in `reveal_in_explorer`, and
`validateWatchPath`). It is also broader than the `SECURITY_HARDENING_CHECKLIST.md` claims
("broad (`C:\PhotoFlow Desktop\**`)") — the real scope is everything. The pre-Phase-10
hardening pass explicitly deferred "runtime `fs:scope` injection" to "Phase 10+
architectural work"; this is that work.

**Do:**

1. Remove the bare `{ "path": "**" }` entry. Keep the managed-storage and applocaldata
   scopes:
   ```json
   { "path": "C:\\PhotoFlow Desktop\\**" },
   { "path": "C:\\PhotoFlow Desktop" },
   { "path": "$APPLOCALDATA/PhotoFlow Desktop/**" },
   { "path": "$APPLOCALDATA/PhotoFlow Desktop" }
   ```
2. Watch folders are arbitrary operator-chosen directories, so they need scope access
   that a static manifest can't fully express. Implement **runtime scope extension** for
   configured watch paths: when a stream's `watchPath` is set/enabled, grant the fs scope
   for that specific path at runtime rather than statically allowing `**`. In Tauri v2 the
   path is already validated by `validateWatchPath`; use that as the gate. Investigate the
   v2 mechanism (e.g. `tauri_plugin_fs` scope APIs / `fs_scope` on the app handle, or a
   small Rust command that adds the validated path to the plugin scope on stream
   enable). If a clean runtime-extension mechanism is genuinely unavailable, fall back to
   reading watched files through the **existing Rust commands** (extend the
   `list_folder_files`-style guarded command set with a guarded `read_file` + `remove`),
   so all watched-folder IO goes through Rust guards instead of a wildcard JS scope.
3. **Never grant `fs:allow-remove` over `**`.** Removal (the post-import source cleanup in
   `autoImportPipeline.ts`) must be scoped to the managed root and validated watch paths
   only.

**Acceptance for Fix 3:** the bare `**` scope is gone; managed-storage rendering and
SQLite still work; watched-folder import + post-import source removal still works for a
validated watch path; reads against a system directory remain blocked. Run the full
manual ingest checks below in Tauri mode.

---

## Fix 4 — Make SQLite migrations honest instead of relying on swallowed errors

**Files:** `src/data/db/schema.ts`, `src/data/db/migrations.ts`, `src/data/db/database.ts`

**Why:** `INITIAL_SCHEMA_SQL` (migration 1) has been edited forward to the *final*
`image_streams` shape, while migrations 4–7 re-create a narrower `image_streams` and then
`ALTER TABLE ... ADD COLUMN` columns that already exist on any fresh database. Every fresh
install therefore throws "duplicate column name" on migrations 5–7, surviving only because
`isBenignMigrationError` swallows them. It works, but it hides real migration failures of
the same shape.

**Choose one approach and document it:**

- **Preferred:** freeze `INITIAL_SCHEMA_SQL` back to its true v1 shape (the columns that
  existed when migration 1 was first written), so migrations 2–7 are the sole source of
  later columns and replay cleanly on a fresh DB with no duplicate-column errors. Verify
  by deleting the dev SQLite DB and starting fresh — migration log should be clean.
- **Alternative (smaller):** keep `INITIAL_SCHEMA_SQL` as-is but make migrations 4–7
  genuinely idempotent — guard each `ADD COLUMN` with a pragma/`table_info` existence
  check so nothing throws, and then **tighten `isBenignMigrationError` to only swallow
  `"already exists"` for `CREATE`, not `"duplicate column name"`**, so real ADD-COLUMN
  failures surface.

Either way, the end state is: a fresh DB migrates with no swallowed errors, and
`isBenignMigrationError` is no longer load-bearing for normal operation.

---

## Task 5 — Reconcile documentation with intended behavior (NOT a behavior change)

**Files:** `README.md` (root), and the phase table in `CLAUDE.md`.

The public `README.md` is stale relative to `CLAUDE.md` and the shipped code. Update it so
it matches **intended, implemented** behavior. Specifically:

1. **Routing.** The README states files without a valid session ID are "treated as
   unrouted exceptions and are skipped/marked for review instead of silently attaching."
   This contradicts the intentional Phase 9 route-everything behavior. Rewrite the README
   to describe what the app actually does: every image routes; files without a standard
   `[A-Z]{3}\d{6}` code get a session created from a sanitized filename-derived key, noted
   as auto-created.
2. **Duplicates.** The README claims duplicates are "skipped by filename, file size, last
   modified time, watched source path, and sequence number." No such dedup exists — the
   implemented behavior is `_2`/`_3` re-import. Rewrite the README to describe the actual
   suffix behavior, and remove the unimplemented skip-by-size/mtime/path claim.
3. **Phase status.** The README header still says "Phase 9 — TBD (Phase 8 complete)".
   Update it to reflect Phase 9 + security hardening complete and this Phase 10.5 bug-fix pass.
4. Keep `CLAUDE.md` as the source of truth; make `README.md` consistent with it. Add a
   Phase 10.5 (Bug Fix) row to the phase table.

**Surface two product decisions for the user (add to the checklist's "Decisions needed"
section — do not implement unless the user confirms):**

- **(a) Unrouted quarantine.** Is auto-creating filename-keyed sessions for unrecognized
  files actually desired at an operational venue, or should such files instead land in a
  review/quarantine bucket? Current behavior is intentional but worth re-confirming.
- **(b) Content de-duplication.** With the watched-folder source file removed after a
  successful import and no content hashing, a genuinely re-sent identical capture imports
  as a separate `_2` photo. If true dedup is wanted, it needs a content hash (e.g. size +
  SHA-256) recorded per photo and checked at import — a real feature, out of scope here
  unless the user requests it.

---

## Task 6 — Add regression tests for the concurrency fixes

**Files:** `src/ingest/sessionRoutingService.test.ts` (extend), and a new test as needed.

Current coverage is 12 tests over filename parsing and routing happy paths — nothing
exercises concurrency or the import pipeline. Add:

- A test that fires `routePhotoToSession` concurrently (e.g. `Promise.all([...])`) for the
  **same new session key** against a mock store whose `getSessionByCode` returns
  `undefined` until `addSession` is called, and asserts `addSession` is invoked **exactly
  once** and all callers receive the same session. This is the direct regression test for
  Fix 1.
- A test that fires `recordImageStreamActivity` concurrently N times for one stream
  against a mock store and asserts the final `totalDetected` equals N (regression for
  Fix 2's lost-update).

Keep the existing 12 tests passing.

---

## Minor / optional (do if quick; otherwise log in Known Limitations)

- **`filesPerMinute`** in `recordImageStreamActivity` is `Math.max(1, …)` on detect and
  never decays — it's a "≥1 once seen" flag, not a rate. Either compute a real
  rolling rate or rename the field/label so it isn't misleading.
- **`hour_buckets` table** is seeded but unused — `buildHourlyImportBuckets` computes
  everything in memory from photos. Either drop the table in a migration or note it as
  intentionally vestigial.
- **CSP dev/prod split** remains deferred (Tauri v2 limitation already documented in
  `SECURITY_HARDENING_CHECKLIST.md`). Re-confirm there's still no clean mechanism; leave
  unchanged if not. Do not break `npm run tauri:dev`.

---

## Validation sequence

```bash
cd src-tauri && cargo check        # Rust compile check — 0 errors required
npm run typecheck                  # 0 TS errors required
npm run lint                       # 0 lint errors required
npm run test                       # existing 12 + new concurrency tests must pass
npm run dev                        # browser mode still renders and degrades gracefully
```

Manual checks in **Tauri mode** (`npm run tauri:dev`):

- Drop a burst of files sharing one **new** session code into a watched folder
  (e.g. `XYZ123456_01..10.jpg`) → exactly one session is created with all photos under it,
  no failed imports from session creation.
- Stream activity counters (`DET` / `OK` / `SKIP` / `FAIL`) total correctly after a burst.
- Watched-folder import still copies into managed storage and removes the source file.
- Managed-storage images still render in the gallery (`asset:` protocol intact).
- Reading/listing a system directory (`C:\Windows`) still returns nothing.
- Creating a stream with a valid absolute path still saves; UNC/relative still rejected.

---

## Out of scope

- Any feature work beyond this bug-fix pass (processing queue, AI processing,
  move/merge/relink, operator audit history, cloud sync).
- Implementing content-hash de-duplication (product decision 5b) unless the user confirms.
- Implementing unrouted-quarantine (product decision 5a) unless the user confirms.
- Removing `unsafe-inline` from `style-src` (large refactor, previously scoped out).
- localStorage-to-SQLite migration.

---

## Handoff format

When done, report:

1. `cargo check`, `npm run typecheck`, `npm run lint`, `npm run test` output.
2. Which fixes (1–4) and tasks (5–6) were completed, deferred, or need a user decision.
3. For Fix 3, state exactly which runtime-scope mechanism was used (or the guarded-Rust-IO
   fallback) and confirm `**` is gone.
4. The two product decisions from Task 5 surfaced for the user to answer.
5. `docs/phases/PHASE_10.5_ACCEPTANCE_CHECKLIST.md` created and accurate; phase tables in
   `CLAUDE.md` and `README.md` updated with a Phase 10.5 (Bug Fix) row.
