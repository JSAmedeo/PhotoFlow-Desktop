# CLAUDE.md — PhotoFlow Desktop Coding Agent Instructions

## Project Identity

**PhotoFlow Desktop** is a local-first desktop application for operational photo workflows at high-volume souvenir photography venues. It is not a SaaS platform. It is a polished, working desktop demo that proves the core gallery/session/operator workflow and grows into a real operational system phase by phase.

The user is building this project UI-first. Treat the UI and workflow as the development map. Every phase must preserve or improve a visible running app.

## Agent Autonomy and Permission Rules

Proceed without prompting for:
- Reading files, searching the codebase, inspecting assets
- Editing or creating source files (components, styles, data, config)
- Running `npm install`, `npm run dev`, `npx tsc --noEmit`, `vite build`
- Extracting zips, creating folders, writing documentation
- Making decisions about file structure, component names, and data shape

Stop and confirm with the user before:
- Deleting files or directories that may contain user work
- Force-overwriting existing files that are not clearly auto-generated
- Making architectural changes that affect the entire project (switching frameworks, replacing the build system)
- Running any command with destructive flags (`--force`, `--hard`, `-rf`, etc.)
- Pushing to remote repositories or modifying CI/CD configuration
- Installing packages that add major new dependencies not already in scope

When uncertain whether an action is moderate or high-level, briefly state the action and proceed unless it is clearly destructive.

## User Working Style

The user processes progress visually. Do not start with hidden infrastructure. Every implementation stage must preserve a visible, polished, runnable app.

The user is newer to many development stacks. When introducing a new stack element, tool, or pattern, give a short plain-language primer before asking them to run commands or make decisions.

Prefer concrete implementation over abstract explanation. Work in small, verifiable stages with visible results.

## Actual Tech Stack (do not change without discussion)

- **Runtime:** React 18 + TypeScript + Vite 6
- **Icons:** lucide-react
- **Styling:** Custom CSS design system via `src/styles/global.css` using CSS custom properties — **no Tailwind**
- **Desktop shell:** Tauri v2 — this is the **only production target**
- **Local data:** SQLite metadata via the Tauri SQL plugin; imported image files stored on disk under `C:\PhotoFlow Desktop`
- **Dev server:** `npm run dev` → localhost (browser mode, for UI iteration only — not for data or import features)
- **Typecheck:** `npm run typecheck` (`tsc --noEmit`)
- **Lint:** `npm run lint`

**Browser mode status:** Browser mode (`npm run dev`) exists for fast UI iteration only. It is **not a production target** and not required to support real photo import, watched-folder ingest, or large datasets. Do not add new features that only work in browser mode, and do not block Tauri-mode work on browser-mode compatibility. The localStorage data layer is retained as a compile-time fallback but is explicitly not scaled or maintained for production use.

## Phase Status and Current Focus

| Phase | Goal | Status |
|-------|------|--------|
| 1 | Visual MVP Shell | **COMPLETE** |
| 2 | Local Data Foundation | **COMPLETE** |
| 3 | Basic Photo Ingest | **COMPLETE** |
| 4 | Desktop Runtime Foundation | **COMPLETE** |
| 5 | Local Database Foundation | **COMPLETE** |
| 6 | Watched Folder Ingest | **COMPLETE** |
| 7 | Filename-Based Session Routing | **COMPLETE** |
| 8 | Image Streams Foundation | **COMPLETE** |
| 9 | (TBD) | **NEXT** |

## Phase 8 — Previous Focus (COMPLETE)

**Goal:** Build the Image Streams page and data foundation for multiple inbound local-folder photo pathways while preserving browser mode, Tauri mode, manual import, watched-folder import, filename session routing, and managed storage under `C:\PhotoFlow Desktop`.

**What was built:**
- `ImageStream`, `AutoPrintItem`, `FileNamingField`, `FileNamingConfig` data models
- `image_streams` + `auto_print_items` SQLite tables and browser localStorage fallback
- Image Streams tab (`src/features/streams/ImageStreamsCenter.tsx`): stream rail, stream cards, watcher directory rows, live sparkline, settings modal, File Renaming panel, Auto-Print Setup modal
- `removeImportQueueItem` through the full store/repository/context stack
- `reveal_in_explorer` Tauri native command (cross-platform: explorer/open/xdg-open)
- `getLocations()` returns streams as `CaptureLocation[]` when streams exist; falls back to seed data when none configured
- Gallery location filtering: `selectedLocationId` + `setLocationId` in AppContext; LeftPanel `LocationSelect` wired to context
- Import pipeline guard removed — watched-folder import no longer requires a pre-existing session
- Revised managed storage path: `C:\PhotoFlow Desktop\photos\{streamName}\{mm_yyyy}\{dd}\{hh}\{sessionKey}\{filename}`

**Key architectural rules established in Phase 8:**
- `getLocations()` queries streams first. If any exist, they are returned as the location list. Sessions created during import store the stream's `captureLocationId`, enabling gallery filtering.
- `storage_path` in SQLite is opaque TEXT — the path structure can change without DB migrations.
- UI components must not import Tauri SQL or filesystem APIs directly.
- Streams populate the capture location dropdown; they are not the same concept as filename-based session routing.

**Still deferred (Phase 8 hard rules remain):**
- Full Processing Queue activation
- AI/rembg processing
- API/cloud/mobile stream ingestion
- DSLR SDK, Canon SDK, tethering, face matching
- Print package routing and archive movement
- Cloud sync

## Phase 7 — Previous Focus

**Goal:** Route imported photos to sessions automatically from filename session IDs while preserving browser mode, manual import, Tauri managed file storage, watched-folder ingest, Gallery delete flows, and SQLite metadata.

**Runtime modes:**
- Browser mode: `npm run dev`
- Tauri desktop mode: `npm run tauri:dev`

**Current persistence direction:**
- Browser mode keeps localStorage metadata and base64/data URL imported images.
- Tauri mode stores imported image files in managed storage under `C:\PhotoFlow Desktop`.
- Tauri mode stores sessions/photos/import queue/app state metadata in SQLite.
- UI components should not import Tauri SQL or filesystem APIs.
- Watched-folder service owns file watching and hands stable candidates to the auto-import pipeline.
- Filename parsing belongs in `src/ingest/filenameParser.ts`, not UI components.
- Session auto-routing belongs in `src/ingest/sessionRoutingService.ts` and the repository/metadata-store boundary.
- Hourly folders are derived from current-day import timestamps, start empty before imports, and do not use photo capture metadata.
- Old app-local imported photo path compatibility was intentionally removed; keep the fresh storage root at `C:\PhotoFlow Desktop`.
- Fresh desktop reset was removed in Phase 7; use Gallery session/photo deletion for cleanup instead of wiping `C:\PhotoFlow Desktop`.

**Hard rules for Phase 7:**
- Build only filename-based session routing.
- Operators should not manually create sessions from selected imported photos.
- Do not implement capture-location parsing or manual capture-location assignment.
- Do not activate full Processing Queue logic.
- Do not build DSLR SDK, Canon SDK, tethering, face matching, print package routing, archive movement, or old app-local path compatibility.
- Do not add AI/rembg processing.
- Do not add cloud upload.
- Do not add print workflows.
- Do not redesign the UI.
- Preserve browser fallback mode.

## Design Source of Truth

The Claude Design handoff is already extracted at:

```
design-handoff/photo-processing-application/project/
```

Primary reference: `snapdesk.html` — open in browser to compare against the running app.

Do not delete or modify the handoff folder. Use it as ongoing visual direction for all phases.

## Project Structure (as of Phase 8 + operational UI cleanup)

```
src/
  components/        ← shared UI primitives
    Tile.tsx         ← colored SVG session thumbnail
    Slider.tsx       ← draggable range slider
    Select.tsx       ← dropdown
    Seg.tsx          ← segmented control
    Check.tsx        ← checkbox
    TopBar.tsx
    LeftPanel.tsx    ← location select, date navigator/calendar popover, hourly folders, Today at a glance
    TabBar.tsx       ← reads/sets activeTab via context
  features/
    gallery/
      GalleryCenter.tsx  ← filters sessions by location + hour + operatingDate from context
      GalleryRight.tsx   ← preview, session info, open/delete actions; no processing/favorite/flag controls
    workshop/
      CenterPanel.tsx    ← session strip, compare view, toolbar, thumbnails, active-session info
      HourFilmstrip.tsx  ← filtered by hour + location + operatingDate; 2 thumbnails per session + badge
    streams/
      ImageStreamsCenter.tsx  ← stream rail, cards, live folder view (2s poll), sparkline, modals
  data/
    models.ts        ← all TypeScript interfaces and types
    seedData.ts      ← 14 seed sessions, generated photos, 4 locations, 12 hour buckets
    localStore.ts    ← raw browser localStorage helpers
    repository.ts    ← public data API; getLocations() returns streams when any exist
    stores/          ← metadata store interface, browser store, SQLite store, store factory
    db/              ← SQLite connection, schema, and migrations
  ingest/
    filenameParser.ts         ← parses session key + sequence from filenames
    sessionRoutingService.ts  ← finds or creates sessions from parsed filename data
    autoImportPipeline.ts     ← orchestrates file → session → photo creation
    watchedFolderService.ts   ← Tauri filesystem watcher, stability checks
    watchedFolderTypes.ts     ← watcher types
  storage/
    photoStorage.ts           ← PhotoStorageService interface + SavePhotoContext
    tauriPhotoStorage.ts      ← writes files to C:\PhotoFlow Desktop\photos\...
    browserPhotoStorage.ts    ← base64 data URL fallback for browser mode
  context/
    AppContext.tsx   ← data state: sessions, photos, tab, hour, filter, selectedLocationId, operatingDate; hours is a derived useMemo
  styles/
    global.css       ← full CSS design system
  App.tsx            ← AppProvider wrapper; UI-only state (zoom, activeTool, split) stays here
  main.tsx
src-tauri/
  src/
    lib.rs           ← Tauri commands: reveal_in_explorer, list_folder_files
public/
  demo-assets/       ← before.jpg, after.png (demo photos)
design-handoff/      ← reference only, do not modify
```

## Data Layer Architecture (Phase 5)

```
Components / context
      ↓
  repository.ts      ← public API only
      ↓
  metadata store     ← runtime-selected persistence adapter
      ↓
  browser: localStorage
  tauri:   SQLite
```

Components and context never call `localStore.ts`, SQLite, or Tauri filesystem APIs directly.

## Implemented Data Models

```ts
Session {
  id, sessionCode, barcode, captureLocationId, captureLocationLabel,
  handler, createdAt, updatedAt, photoCount, status, notes, linkedSessionIds, tint
}

Photo {
  id, sessionId, filename, thumbnailUrl, displayUrl,
  beforeImageUrl, afterImageUrl, createdAt, captureLocationId,
  processingStatus, flag, isFavorite, isHidden, operatorNotes,
  enhanceVersion, width, height, fileSizeMb, fileFormat,
  storageKind, storagePath, imageStreamId
}

ImportQueueItem {
  id, filename, status, sessionId, imageStreamId,
  detectedAt, importedAt, createdAt, fileSize, error
}

CaptureLocation { id, name, code, isActive }
HourBucket      { h, label, sub, count, flagged }

// Phase 8 additions
ImageStream {
  id, name, slug, code, captureLocationId, watchPath,
  enabled, fileNaming, autoPrint, createdAt, updatedAt
}

FileNamingField: 'sessionKey' | 'sequence' | 'date' | 'streamCode' | 'original'
FileNamingConfig { enabled: boolean; fields: FileNamingField[] }

AutoPrintItem {
  id, streamId, label, qty, size, templateId, printerRoute
}

ProcessingStatus: 'pending' | 'processing' | 'done' | 'warn' | 'error'
PhotoFlag:        'none' | 'flagged' | 'rejected' | 'favorite'
SessionStatus:    'active' | 'complete' | 'flagged' | 'archived'
TabKey:           'gallery' | 'workshop' | 'streams' | 'print' | 'config'
FilterKey:        'All' | 'Flagged' | 'Processed' | 'Pending'
```

## Managed Storage Path (Phase 8)

Tauri desktop mode writes imported files to:
```
C:\PhotoFlow Desktop\photos\{streamName}\{mm_yyyy}\{dd}\{hh}\{sessionKey}\{filename}
```
- `streamName` = sanitized stream name, or `captureLocationSlug`, or `manual-import` fallback
- `mm_yyyy` = e.g. `05_2026`
- `storage_path` in SQLite is opaque TEXT — the path layout can change without a DB migration
- `resolvePhotoSource()` in `tauriPhotoStorage.ts` converts the stored absolute path to a displayable `convertFileSrc()` URL at runtime

## Location / Stream Relationship

`getLocations()` in `repository.ts` returns streams as `CaptureLocation[]` when any streams exist. If no streams are configured, it falls back to seed locations. Session records created during watched-folder import store the stream's `captureLocationId`, which is what `GalleryCenter` uses to filter sessions by selected location. This is the mechanism that wires "select a stream in the left panel → see only that stream's sessions in the gallery."

## Coding Rules

- Preserve a running, visually intact app at every step.
- Prefer clear folder structure over clever abstractions.
- Use TypeScript throughout. Keep types close to the data they describe.
- Write understandable code — the project owner is learning the stack.
- Comments only where the WHY is non-obvious.
- No cloud dependencies in the local MVP.
- No secrets in source files.
- Do not build for phases beyond the current one.

## Reliability Rules

- App must not crash on missing images — use `onError` fallbacks.
- Empty states must be clear, not blank.
- Failed data operations must surface as errors, not silent no-ops.
- Seed data must always produce a working demo state.

## Performance Rules

This app is intended for production use in high-volume photo venues. Responsiveness is a hard requirement, not a polish item. Apply these rules whenever touching data flow or rendering.

**State and data loading:**
- `refreshData` (full 5-collection reload) must only run when data has genuinely changed: after an import, after a delete, or after a watcher callback. Never call it on a user interaction that doesn't write data (session click, tab switch, photo selection).
- `selectSession` must fetch only the selected session's photos via `getPhotosBySessionId` — not trigger a full reload.
- Single-field metadata changes (`toggleFavorite`, `toggleFlag`) must use optimistic in-place state updates on the existing `allPhotos`/`photos` arrays. Do not read from storage or call `refreshData` for these.
- Do not fetch all photos to find one photo. Use the `allPhotos` state already in memory.

**Photo URL resolution:**
- `resolvePhotoSources` must short-circuit for non-Tauri photos. If no photos have `storageKind: 'tauri-managed-file'`, return the array as-is without mapping.

**Component rendering:**
- Components that render lists of photos must precompute a `Map<sessionId, Photo[]>` via `useMemo` — never filter `allPhotos` inside a render loop.
- Strip/filmstrip thumbnail components with many items (`SessionPhotoMini` etc.) must be wrapped in `React.memo` so only the items whose props changed re-render.
- `useEffect` hooks that attach global event listeners must have a proper dependency array. Missing deps = listeners added and removed on every render.

**Tab persistence:**
- Gallery and Workshop panels must stay mounted across Gallery↔Workshop tab switches using CSS `display: contents` / `display: none`. This preserves the browser's image decode cache so switching back is instant. Do not revert to conditional rendering for these two tabs.
- The Streams tab may remain conditionally mounted because it runs a background polling loop.

**Current operational UI cleanup rules:**
- `StatusBar.tsx` and Workshop `RightPanel.tsx` were intentionally removed. `App.tsx` keeps an empty right-side placeholder panel in Workshop to preserve compare-view proportions.
- Gallery no longer exposes the old status filter tabs, processing details, Favorite session, Flag for review, Handler, Status, or stream-code suffix rows.
- Workshop no longer exposes background-removal/enhancement/upscaling placeholder controls, frame metadata, overlay camera/color chips, or shortcut-helper text.
- Workshop order is session strip above the compare view, toolbar, current-session thumbnails, then active-session metadata.
- Hourly folder badges show session counts. Today at a glance is 7 AM through 10 PM with standard-time labels.
- Location filtering applies to hourly folders and session strips unless "All Locations" is selected.

**What not to do:**
- Do not trigger any storage read or context refresh in response to a click that only changes selection.
- Do not store full-resolution image data in React state that gets spread or copied on every render.
- Do not pass large arrays as props to memoized components if the reference changes every render.

## Always-Deferred Items

Do not build these unless explicitly scoped into a phase:

- Full print management (Darkroom Core handles this)
- Cloud sync or cloud APIs
- SMS/guest gallery delivery
- Authentication or licensing
- Multi-tenant SaaS features
- Advanced analytics
- AI processing pipeline
- Additional stream types beyond local-folder watching
- Browser mode feature work — browser mode exists for UI iteration only; do not add import, watcher, or data features that only work in browser mode

## Communication Style

Be direct. Point out risks and bad assumptions early. If a direction could cause rework, say so and suggest a safer path.

When handing work back, include:
- What changed
- How to run it
- What to check visually
- Known limitations
- Recommended next step

## Phase Checklist Rule

Every development phase must include a dedicated phase checklist document under `docs/phases/`.

For each phase:

- Create a checklist file named `docs/phases/PHASE_X_ACCEPTANCE_CHECKLIST.md`
- Put any phase prompt, implementation plan, or phase-specific notes in `docs/phases/` using the existing `PHASE_X_*.md` naming pattern
- Define the phase goal
- Define what is in scope
- Define what is out of scope
- List implementation tasks
- List validation commands
- List acceptance criteria
- Update the checklist as work progresses
- Use the checklist as the final source of truth before declaring the phase complete

No phase should be considered complete until its checklist has been reviewed and all required items are either completed or explicitly marked as deferred with a reason.
