# PhotoFlow Desktop

Local-first desktop application for operational photo workflows at high-volume souvenir photography venues.

## Current Stage: Phase 3 — Basic Local Photo Ingest

The app runs as a Vite/React browser application. A desktop shell (Tauri or Electron) is planned for Phase 5.

## How to run

Use Node `18.15.0` or newer within the supported engine range in `package.json`. The repo includes `.nvmrc` for `nvm` users.

```bash
npm install
npm run dev
```

Then open [http://localhost:5173](http://localhost:5173).

## Other commands

```bash
npm install         # install dependencies
npm run typecheck   # type check without building (tsc --noEmit)
npm run lint        # ESLint baseline for TypeScript/React hooks
npm run build       # typecheck + production build
npm run preview     # preview the production build
```

## Local data architecture

Phase 2 introduced a real local data layer. All data is persisted in `localStorage` and survives page refreshes.

```
src/
  data/
    models.ts       ← TypeScript interfaces (Session, Photo, CaptureLocation, etc.)
    seedData.ts     ← demo seed records — loaded on first run
    localStore.ts   ← raw localStorage helpers (only file that touches localStorage)
    repository.ts   ← public data access API (getSessions, updatePhotoMetadata, etc.)
  context/
    AppContext.tsx  ← React context: sessions, selected session/photo, tab, hour, filter
```

**Layer rules:**
- Components → `AppContext` only
- `AppContext` → `repository.ts` only
- `repository.ts` → `localStore.ts` only
- `localStore.ts` → `localStorage` directly

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

## Phase 3 local import workflow

Open the **Session Workshop** tab, choose the destination session, then use **Local Ingest → Import Photos** in the right panel. The picker accepts multiple `image/*` files.

When photos are imported:
- each valid file becomes a `Photo` record in the active session
- imported thumbnails appear in Gallery, Workshop thumbnails, the selected preview, and the before/after compare area
- exact duplicates in the same session are skipped by filename, file size, and last modified time
- unsupported files and storage failures are shown in the import queue
- the active session photo count is updated immediately

For Phase 3, imported images are stored as base64/data URLs in browser `localStorage`. This is intentionally demo-scale storage so refresh persistence works before the desktop shell exists. Large batches or large photos can hit browser storage limits. Production storage is deferred to Electron/Tauri filesystem paths, SQLite metadata, and a managed thumbnail cache.

## Resetting to demo state

Call `resetDemoData()` from `repository.ts` — it clears all `pf_` keys from localStorage and re-seeds. The context's `resetDemo()` action calls this and refreshes UI state without a page reload, including clearing imported photos and the import queue.

## What to check visually

- **Gallery tab:** Session list updates reflect real data; flag/favorite toggles persist on refresh
- **Session Workshop tab:** Photo strip shows real photo count per session; active session header shows real metadata
- **Left panel:** Hour counts and flagged counts come from seed data
- **Status bar:** Session code and photo count reflect the selected session

## Intentionally not implemented yet

| Feature | Planned phase |
|---------|--------------|
| Folder watcher / tethered ingest | Future |
| Move/merge/relink sessions | Phase 4 |
| Operator audit history | Phase 4 |
| SQLite local database | Phase 4+ |
| Tauri/Electron desktop shell | Phase 5 |
| Lint configuration | Phase 5 |
| Cloud sync | Phase 6 |

## Project structure

```
PHASE_1_PROMPT.md    ← implementation prompt/archive for Phase 1
PHASE_2_PROMPT.md    ← implementation prompt/archive for Phase 2
PHASE_3_PROMPT.md    ← implementation prompt/archive for Phase 3
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
| 3 | Basic photo ingest | **Current** |
| 4 | Operator correction tools | Planned |
| 5 | Demo hardening + desktop packaging | Planned |
| 6 | Platform expansion | Future |
