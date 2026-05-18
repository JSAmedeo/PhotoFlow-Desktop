# PhotoFlow Desktop

Local-first desktop application for operational photo workflows at high-volume souvenir photography venues.

## Current Stage: Security hardening complete — Phase 10 next

Phase 9 (stream ingest hardening and activity visibility) is complete. A targeted security hardening pass was completed before Phase 10 feature work begins — see `docs/phases/SECURITY_HARDENING_CHECKLIST.md`.

The app now supports two runtime modes:

- Browser Dev Mode through Vite
- Tauri Desktop Mode through a native desktop shell

Tauri is the desktop wrapper around the existing React app. React still renders the UI, Vite still builds the frontend, and Tauri adds controlled desktop capabilities such as app-managed local file storage.

## Browser mode

Use Node `18.15.0` or newer within the supported engine range in `package.json`. The repo includes `.nvmrc` for `nvm` users.

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

Browser mode keeps the Phase 3 fallback behavior: imported images are stored as base64/data URLs and metadata is stored in browser `localStorage`.

## Tauri desktop mode

Tauri mode requires Rust/Cargo and the platform prerequisites from the official Tauri v2 setup guide.

```bash
npm install
npm run tauri:dev
```

This launches PhotoFlow Desktop in a native desktop window. In this mode, imported image files are copied into the support-friendly managed storage folder at `C:\PhotoFlow Desktop` and metadata is stored in SQLite through the Tauri SQL plugin.

## Image streams and watched folder ingest

Phase 8 adds an **Image Streams** page for configuring and monitoring inbound local-folder photo pathways. A stream represents where photos come from, such as Giraffes, Main Gate, Pandas, or Carousel. The page starts with no stream cards; operators add photo ops/streams and those records persist. Streams populate the Capture Location selector/list once configured; filename-based session routing still decides which guest/session receives each photo.

Current supported stream type:

```txt
local-folder
```

Future stream types such as API, cloud, or mobile upload streams are placeholders only and are not implemented yet.

Watched-folder configuration is managed from the **Image Streams** page. Each local-folder stream has its own watch path, enable/disable toggle, and live folder view. The Session Workshop right panel no longer has a Local Ingest section.

Supported watched-folder file types:

```txt
.jpg, .jpeg, .png, .webp
```

The watcher waits for a detected file to become stable before importing, which protects FTP transfers that are still writing into the watched folder. By default, a file must keep the same size and modified time across two consecutive checks before PhotoFlow reads it. After a watched file is successfully copied into managed PhotoFlow storage and metadata is recorded, PhotoFlow removes the original source file from the watched intake folder.

## Security hardening (pre-Phase 10)

Applied before Phase 10 feature work. No UI changes.

**`list_folder_files` path guard (`src-tauri/src/lib.rs`):** The Tauri command that the live folder view uses to list files in a watched directory now calls `canonicalize()` and checks the resolved path against a blocked-roots list (`C:\Windows`, `C:\Program Files`, `/etc`, `/proc`, etc.) before calling `read_dir`. A crafted `watchPath` pointing at system directories returns an empty result instead of enumerating sensitive paths.

**`watchPath` validation (`src/data/repository.ts`):** `createImageStream` and `updateImageStream` now call `validateWatchPath()` before writing to SQLite. Empty strings, UNC/network paths (`\\server\share`), relative paths, and system-reserved roots are rejected with a descriptive error. `StreamSetupDialog` catches the thrown error and shows it in the dialog footer.

**Native destructive dialogs (`src/utils/confirm.ts`):** All `window.confirm` and `window.prompt` calls in Gallery, Workshop, and the stream setup dialog are replaced with Tauri's native `ask()` dialog (rendered outside the WebView by the OS). A shared `confirmDestructive(message, title)` utility handles the Tauri/browser runtime split — in browser mode it falls back to `window.confirm`.

**Watcher deletion-event fix (`src/ingest/autoImportPipeline.ts`):** After a file is successfully imported, `remove()` deletes it from the watch folder. This triggered a new FS watcher event for the same path. Because successful imports were not added to `recentlyHandled`, the event went through the full pipeline until `stat()` failed with "file not found", logging a spurious FAIL. The pipeline now checks file existence before adding a queue item; deletion events are swallowed silently.

## Other commands

```bash
npm install         # install dependencies
npm run typecheck   # type check without building (tsc --noEmit)
npm run lint        # ESLint baseline for TypeScript/React hooks
npm run build       # typecheck + production build
npm run preview     # preview the production build
npm run tauri:build # build the Tauri desktop app
```

## Local data architecture

Phase 2 introduced a real local data layer. Phase 5 keeps the same repository/context shape while choosing a metadata store by runtime.

```
src/
  data/
    models.ts       ← TypeScript interfaces (Session, Photo, CaptureLocation, etc.)
    seedData.ts     ← demo seed records — loaded on first run
    localStore.ts   ← raw browser localStorage helpers
    repository.ts   ← public data access API (getSessions, updatePhotoMetadata, etc.)
    stores/          ← browser localStorage store + Tauri SQLite store
    db/              ← SQLite connection, schema, and migrations
  context/
    AppContext.tsx  ← React context: sessions, selected session/photo, tab, hour, filter
```

**Layer rules:**
- Components → `AppContext` only
- `AppContext` → `repository.ts` only
- `repository.ts` → active metadata store only
- Browser metadata store → `localStorage`
- Tauri metadata store → SQLite

## Seed and demo data

On first launch (or after reset), the app auto-seeds from `src/data/seedData.ts`:
- 14 sessions across 4 capture locations
- 4 photos per session (some flagged, one processing, one with a warning)
- 12 hourly time buckets
- 4 capture locations

## Persisted state

The following survives page refresh:
- Selected session and photo
- Active tab
- Selected hour
- Per-photo favorite and flag toggles
- Operator notes
- Imported photo records
- Imported image display data for demo-scale images
- Import queue history

Not persisted (resets on refresh): zoom level, active tool, before/after split position.

## Import workflow

Current production import work is driven by configured **Image Streams** watched folders in Tauri desktop mode. The old Session Workshop **Local Ingest** right-panel controls were removed during operational UI cleanup.

When photos are imported:
- each valid routed file becomes a `Photo` record in the parsed filename session
- imported thumbnails appear in Gallery, Workshop thumbnails, the selected preview, and the before/after compare area
- re-dropped files are imported as additional photos using a unique filename suffix such as `_2` or `_3`; only an identical source path already recorded as successfully imported is skipped
- unsupported files and storage failures are shown in the import queue
- the routed session photo count is updated immediately

In browser mode, imported images are stored as base64/data URLs in browser `localStorage`. Browser metadata also uses `localStorage`. This is intentionally demo-scale storage. Large batches or large photos can hit browser storage limits.

In Tauri desktop mode, imported image bytes are copied into managed storage under `C:\PhotoFlow Desktop`. Photo/session metadata is stored in SQLite using `sqlite:photoflow.db`. SQLite stores metadata and file references only, not original image blobs.

Image stream metadata is stored in the same runtime-selected metadata layer: localStorage in browser mode and SQLite in Tauri mode. Stream-aware import queue/photo records can identify the stream that detected or imported a file where practical.

Phase 7 adds filename-based session routing. Filenames containing the first valid `[A-Z]{3}\d{6}` session ID are routed automatically, with lowercase keys normalized to uppercase. Supported sequence patterns near the session ID, such as `XYZ123456_01.jpg`, `XYZ123456-001.jpg`, and `IMG_4021_XYZ123456_05.jpg`, preserve sequence metadata for display ordering. Operators should not manually create sessions from selected imported photos; sessions are created automatically from parsed filename session IDs.

Files with a valid session code route to that session. Files without a recognizable session code are fallback-routed into a derived session based on the filename stem, allowing operators to review and correct them later.

Hourly folders in the left panel are based on current-day import time, not photo capture metadata. The panel starts empty for a day with no imports, creates/fills hour folders as photos import, filters by selected capture location unless **All Locations** is selected, and shows the session count in each folder badge. Today at a glance uses the same current-day hourly folder data, constrained to 7 AM through 10 PM with standard-time labels.

Watched-folder imports use the organized managed path:

```txt
C:\PhotoFlow Desktop\photos\{streamName}\{mm_yyyy}\{dd}\{hh}\{sessionKey}\{filename}
```

- `streamName` = sanitized stream name, or `captureLocationSlug`, or `manual-import` fallback
- `mm_yyyy` = zero-padded month + underscore + 4-digit year (e.g. `05_2026`)
- `dd` / `hh` = zero-padded day and hour of import

This root-level folder is intentional. It gives support staff a predictable location for checking imported originals, backup behavior, and troubleshooting storage issues. Previous app-local imports are intentionally disregarded for the fresh storage start.

Tauri's asset protocol is scoped to `C:\PhotoFlow Desktop\**` so stored originals can be rendered in `<img>` tags inside the desktop webview.

## Phase 5 SQLite metadata

Desktop mode uses the official Tauri SQL plugin with SQLite enabled. SQLite is a local database file managed by the desktop app; it does not require a separate server.

Current SQLite tables:
- `schema_migrations`
- `sessions`
- `photos`
- `capture_locations`
- `hour_buckets`
- `import_queue`
- `image_streams`
- `app_state`

Migrations run safely during startup. If the SQLite database has no sessions, the app seeds the same demo data used by browser mode.

## Resetting to demo state

Call `resetDemoData()` from `repository.ts`. In browser mode it clears PhotoFlow `localStorage` metadata and re-seeds. In Tauri mode it clears and re-seeds SQLite metadata. The context's `resetDemo()` action calls this and refreshes UI state without a page reload, including clearing imported photo metadata and the import queue.

The previous Fresh desktop reset control was removed in Phase 7 after session/photo delete flows were added. Operators should delete unwanted sessions from Gallery instead of wiping the managed desktop storage root.

## What to check visually

- **Gallery tab:** Session list updates reflect real data; preview/open/delete actions operate on the selected session
- **Session Workshop tab:** Session strip appears above the compare view, active-session thumbnails appear below the toolbar, and active-session metadata appears below the thumbnails
- **Left panel:** Hourly folders reflect today's import-time sessions/photos, respect the selected capture location, and show session-count badges
- **Operating date:** Chevrons navigate by day and the date control opens the calendar popover

## Intentionally not implemented yet

| Feature | Planned phase |
|---------|--------------|
| Move/merge/relink sessions | Phase 9+ |
| Operator audit history | Phase 9+ |
| Full processing queue / AI processing | Phase 9+ |
| LocalStorage-to-SQLite migration | Future |
| Cloud sync | Future |

## Project structure

```
docs/
  phases/             ← all phase prompts, plans, and acceptance checklists
    PHASE_1_PROMPT.md
    PHASE_2_PROMPT.md
    PHASE_3_PROMPT.md
    PHASE_4_ACCEPTANCE_CHECKLIST.md
    PHASE_4_DESKTOP_RUNTIME.md
    PHASE_5_ACCEPTANCE_CHECKLIST.md
    PHASE_5_LOCAL_DATABASE.md
    PHASE_6_ACCEPTANCE_CHECKLIST.md
    PHASE_6_WATCHED_FOLDER_INGEST.md
    PHASE_7_ACCEPTANCE_CHECKLIST.md
    PHASE_7_FILENAME_SESSION_ROUTING.md
    PHASE_8_ACCEPTANCE_CHECKLIST.md
    PHASE_8_IMAGE_STREAMS.md
    PHASE_9_ACCEPTANCE_CHECKLIST.md
    SECURITY_HARDENING_CHECKLIST.md
src-tauri/            ← Tauri v2 desktop runtime shell
src/
  components/         ← shared UI primitives
  features/
    gallery/           ← Gallery tab
    workshop/          ← Session Workshop tab
    streams/           ← Image Streams tab
  data/               ← models, seed data, storage, repository
  context/            ← AppContext (centralized data state)
  ingest/             ← filename parser, session routing, watcher, import pipeline
  storage/            ← photo storage interface + Tauri/browser implementations
  runtime/            ← isTauriRuntime() helper
  utils/
    slugify.ts         ← shared slug utility
    confirm.ts         ← confirmDestructive() — native dialog with browser fallback
  styles/
    global.css         ← design system CSS
  App.tsx             ← root layout, scale-to-fit, UI-only state
  main.tsx
public/
  demo-assets/         ← demo photos (before.jpg, after.png)
design-handoff/        ← Claude Design reference (do not modify)
archive/               ← ignored original handoff zip/archive files
```

## Phase plan

| Phase | Goal | Status |
|-------|------|--------|
| 1 | Visual MVP shell | Complete |
| 2 | Local data foundation | Complete |
| 3 | Basic photo ingest | Complete |
| 4 | Desktop runtime foundation | Complete |
| 5 | Local database foundation | Complete |
| 6 | Watched folder ingest | Complete |
| 7 | Filename-based session routing | Complete |
| 8 | Image streams foundation | Complete |
| 9 | Stream ingest hardening and activity visibility | Complete |
| — | Security hardening (pre-Phase 10) | Complete |
| 10 | (TBD) | **Next** |

## Phase checklist rule

Every development phase must include a dedicated `docs/phases/PHASE_X_ACCEPTANCE_CHECKLIST.md` file covering the goal, scope, tasks, validation commands, acceptance criteria, known limitations, and deferred items. Put all future phase prompts, implementation plans, and phase notes in `docs/phases/` using the existing `PHASE_X_*.md` naming pattern. No phase is complete until its checklist is reviewed and all required items are completed or explicitly deferred with a reason.
