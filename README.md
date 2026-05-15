# PhotoFlow Desktop

Local-first desktop application for operational photo workflows at high-volume souvenir photography venues.

## Current Stage: Phase 8 — Image Streams Foundation

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

In Tauri desktop mode, Session Workshop now includes a compact **Watched Folder** control in the **Local Ingest** panel.

Use it to:

- choose an intake folder
- enable or disable watching
- see watcher status
- see the last detected file and last import result

Supported watched-folder file types:

```txt
.jpg, .jpeg, .png, .webp
```

The watcher waits for a detected file to become stable before importing, which protects FTP transfers that are still writing into the watched folder. By default, a file must keep the same size and modified time across two consecutive checks before PhotoFlow reads it. After a watched file is successfully copied into managed PhotoFlow storage and metadata is recorded, PhotoFlow removes the original source file from the watched intake folder.

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

## Local import workflow

Open the **Session Workshop** tab, then use **Local Ingest → Import Photos** in the right panel. The picker accepts multiple `image/*` files.

When photos are imported:
- each valid routed file becomes a `Photo` record in the parsed filename session
- imported thumbnails appear in Gallery, Workshop thumbnails, the selected preview, and the before/after compare area
- exact duplicates in the same routed session are skipped by filename, file size, last modified time, watched source path, and sequence number where available
- unsupported files and storage failures are shown in the import queue
- the routed session photo count is updated immediately

In browser mode, imported images are stored as base64/data URLs in browser `localStorage`. Browser metadata also uses `localStorage`. This is intentionally demo-scale storage. Large batches or large photos can hit browser storage limits.

In Tauri desktop mode, imported image bytes are copied into managed storage under `C:\PhotoFlow Desktop`. Photo/session metadata is stored in SQLite using `sqlite:photoflow.db`. SQLite stores metadata and file references only, not original image blobs.

Image stream metadata is stored in the same runtime-selected metadata layer: localStorage in browser mode and SQLite in Tauri mode. Stream-aware import queue/photo records can identify the stream that detected or imported a file where practical.

Phase 7 adds filename-based session routing. Filenames containing the first valid `[A-Z]{3}\d{6}` session ID are routed automatically, with lowercase keys normalized to uppercase. Supported sequence patterns near the session ID, such as `XYZ123456_01.jpg`, `XYZ123456-001.jpg`, and `IMG_4021_XYZ123456_05.jpg`, preserve sequence metadata for display ordering. Operators should not manually create sessions from selected imported photos; sessions are created automatically from parsed filename session IDs.

Files without a valid session ID are treated as unrouted exceptions and are skipped/marked for review instead of silently attaching to the wrong session.

Hourly folders in the left panel are based on current-day import time, not photo capture metadata. The panel starts empty for a day with no imports, creates/fills hour folders as photos import, shows skipped hours between import hours as no-photo gaps, and reports both session and photo totals. Today at a glance uses the same current-day hourly folder data.

Watched-folder imports use the organized managed path:

```txt
C:\PhotoFlow Desktop\photos\imported\YYYY\MM\DD\{captureLocationSlug}\{sessionKey}\originals\{photoId}_{safeOriginalFilename}
```

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

- **Gallery tab:** Session list updates reflect real data; flag/favorite toggles persist on refresh
- **Session Workshop tab:** Photo strip shows real photo count per session; active session header shows real metadata
- **Left panel:** Hourly folders reflect today's import-time sessions/photos; skipped import hours show as empty
- **Status bar:** Session code and photo count reflect the selected session

## Intentionally not implemented yet

| Feature | Planned phase |
|---------|--------------|
| Folder watcher / tethered ingest | Future |
| Move/merge/relink sessions | Future |
| Operator audit history | Future |
| LocalStorage-to-SQLite migration | Future |
| Cloud sync | Phase 6 |

## Project structure

```
PHASE_1_PROMPT.md    ← implementation prompt/archive for Phase 1
PHASE_2_PROMPT.md    ← implementation prompt/archive for Phase 2
PHASE_3_PROMPT.md    ← implementation prompt/archive for Phase 3
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
src-tauri/            ← Tauri v2 desktop runtime shell
src/
  components/         ← shared UI primitives
  features/
    gallery/           ← Gallery tab
    workshop/          ← Session Workshop tab
  data/               ← models, seed data, storage, repository
  context/            ← AppContext (centralized data state)
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
| 6 | Watched folder ingest | **Current** |

## Phase checklist rule

Every development phase must include a dedicated `PHASE_X_ACCEPTANCE_CHECKLIST.md` file covering the goal, scope, tasks, validation commands, acceptance criteria, known limitations, and deferred items. No phase is complete until that checklist is reviewed and all required items are completed or explicitly deferred with a reason.
