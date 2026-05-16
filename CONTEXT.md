# CONTEXT.md — PhotoFlow Desktop Project Context

## Product Summary

**PhotoFlow Desktop** is a local-first desktop application for managing operational photo workflows at souvenir photography venues such as zoos, aquariums, attractions, holiday photo sets, and other high-volume photo environments.

The app is intended to help operators ingest photos, organize them into guest sessions, correct session mistakes, link or relink barcodes, and prepare photo workflows for viewing, fulfillment, or future printing/output systems.

This is not currently a generic cloud gallery product. The first useful product is an operational desktop tool.

## Current Strategic Direction

The project uses a **UI-first, workflow-first methodology**.

Each phase preserves visual polish while adding one layer of real behavior. The UI is not secondary — it is the operational map of the product.

The correct framing is:

> Workflow-first, expressed through a visible UI, then wired to real local behavior — one phase at a time.

## Phase Status

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

## Phase 1 — Visual MVP Shell (COMPLETE)

Completed 2026-05-13. What was built:

- Polished dark operational desktop UI (1440×900, scale-to-fit)
- Gallery tab: searchable/filterable session grid, photo thumbnails, session preview panel
- Session Workshop tab: interactive before/after compare slider, photo strip, tool toolbar, processing controls
- Left panel: location selector, date navigation, hourly folders, daily stats bar chart
- Tab bar: Gallery, Session Workshop (Streams/Output/Config show Phase 3+ placeholders)
- Status bar: venue, session, frame, queue, GPU readouts
- 14 mock sessions, 12 hourly time blocks, 4 capture locations
- Design handoff extracted and matched visually

**Tech stack used:**
- React 18 + TypeScript + Vite 6
- lucide-react for icons
- Custom CSS design system (CSS custom properties — no Tailwind; the design's own system was more precise)
- `npm run dev` → localhost:5173

**Key files from Phase 1:**
- `src/styles/global.css` — full CSS design system (colors, layout, components)
- `src/App.tsx` — root layout, scale-to-fit, tab routing, app-level state
- `src/features/gallery/` — Gallery tab components
- `src/features/workshop/` — Workshop tab components
- `src/components/` — shared primitives (Tile, Slider, Select, Seg, Check, TopBar, etc.)
- `public/demo-assets/` — demo photos (before.jpg, after.png)
- `design-handoff/` — extracted Claude Design zip (reference, do not delete)
- *(Note: `src/data/mockData.ts` was deleted in Phase 2 and replaced by the real data layer)*

## Phase 2 — Local Data Foundation (COMPLETE)

Completed 2026-05-13. Replaced all hardcoded mock data with a real local data layer. Visual UI unchanged.

**What was built:**
- `src/data/models.ts` — TypeScript interfaces: `Session`, `Photo`, `CaptureLocation`, `HourBucket`, `ProcessingStatus`, `PhotoFlag`, `SessionStatus`, `TabKey`, `FilterKey`, plus `HOUR_SHORT` and `TINTS` constants
- `src/data/seedData.ts` — 14 seed sessions across 4 capture locations, 4 photos per session, 12 hourly buckets; auto-seeds on first run
- `src/data/localStore.ts` — raw browser localStorage helpers (`storeGet`, `storeSet`, `storeRemove`, `storeClearAll`); all keys prefixed `pf_`
- `src/data/repository.ts` — public data API: `initStore`, `getSessions`, `getPhotosBySessionId`, `updatePhotoMetadata`, `resetDemoData`, persisted UI state getters/setters; calls `seedStore()` automatically on first run
- `src/context/AppContext.tsx` — React context + `useApp()` hook; owns all data state (`sessions`, `photos`, `locations`, `hours`, selection, `filter`, `isLoading`); App.tsx keeps UI-only state (zoom, split, activeTool)
- `src/data/mockData.ts` — **deleted**

**Original Phase 2 data layer architecture:**
```
Components → AppContext → repository.ts → localStore.ts → localStorage
```

**Current Phase 5 data layer architecture:**
```
Components → AppContext → repository.ts → metadata store

Browser metadata store → localStorage
Tauri metadata store   → SQLite
```

## Phase 3 — Basic Photo Ingest (COMPLETE)

Allow real local image files to be imported into sessions via the browser file picker.

**Scope constraints (browser-only — no Electron yet):**
- File picker (`<input type="file" multiple accept="image/*">`) — no folder watcher
- Base64/data URLs for demo-scale preview persistence — no file system writes
- No production thumbnail generation pipeline yet (browser renders from persisted data URLs directly)
- No file safety copy/move (no disk access in browser phase)

**What to build:**
- Import button that opens file picker
- `ImportQueueItem` model (filename, status, assigned session, progress/error metadata)
- Photo records created in repository from selected files
- Import queue panel showing pending/done/error per file
- Basic duplicate detection (session + filename + size + lastModified)
- Session assignment during or after import
- Ingest queue visibility in UI

Still local-first. No cloud.

## Phase 4 — Desktop Runtime Foundation (COMPLETE)

Add Tauri v2 while preserving browser mode and the existing UI:

- Tauri native window for desktop mode
- Centralized browser vs Tauri runtime detection
- Storage service boundary for imported photos
- Browser fallback storage using base64/data URLs
- Tauri managed file storage for imported images under `C:\PhotoFlow Desktop`
- Photo source resolver so UI components receive displayable image URLs

## Phase 5 — Local Database Foundation (COMPLETE)

Add SQLite metadata persistence for Tauri desktop mode while preserving browser localStorage fallback:

- Official Tauri SQL plugin with SQLite enabled
- `sqlite:photoflow.db` for desktop metadata
- Metadata store boundary under the repository
- Browser metadata store backed by existing localStorage helpers
- SQLite metadata store for sessions, photos, locations, hour buckets, import queue, and app state
- Phase 4 file storage remains responsible for imported image files
- SQLite stores metadata and file references only, not original image blobs

## Phase 6 — Watched Folder Ingest (COMPLETE)

Add desktop-only watched-folder ingest:

- Tauri dialog folder selection
- Tauri filesystem watching
- file stability checks before import
- supported image files copied into managed storage under `C:\PhotoFlow Desktop`
- managed path organized by date/location/session
- SQLite photo/import queue metadata for watched-folder imports
- visible watcher controls in the Local Ingest panel
- browser mode remains manual-import only and shows watcher as desktop-only

The Fresh desktop reset control was removed in Phase 7 after Gallery session deletion became available. Operators should delete unwanted sessions/photos through Gallery instead of wiping the managed desktop storage root. Previous app-local imported photo path compatibility was intentionally removed and should not be reintroduced unless explicitly requested.

## Phase 7 — Filename-Based Session Routing (COMPLETE)

Add deterministic filename-based session routing:

- parse the first valid `[A-Z]{3}\d{6}` session ID from import filenames
- normalize parsed session keys to uppercase
- parse nearby sequence numbers such as `_01`, `-001`, or ` 03`
- automatically find/create sessions from parsed filename session IDs
- route browser manual import, Tauri manual import, and Tauri watched-folder import through the same routing service
- persist route/sequence metadata in browser localStorage and SQLite metadata stores
- sort photos in sessions by sequence number where present, then created/imported time and filename
- keep unrouted files visible as skipped/unrouted exceptions instead of assigning them to the active session
- derive hourly folders and Today at a glance from current-day import timestamps, not photo capture metadata
- keep skipped import hours visible as empty no-photo hours between active import hours

Capture location parsing and manual capture-location assignment are deferred. Future mobile app metadata should supply capture-location data.

The Processing Queue panel exists, but full processing queue logic and AI/rembg/background processing are deferred.

## Phase 8 — Image Streams Foundation (COMPLETE)

Build the Image Streams page and data foundation for multiple inbound photo pathways.

**What was built:**

- `ImageStream` model with `id`, `name`, `slug`, `code`, `captureLocationId`, `watchPath`, `enabled`, `fileNaming`, `autoPrint`, `createdAt`, `updatedAt`
- `AutoPrintItem` model: `id`, `streamId`, `label`, `qty`, `size`, `templateId`, `printerRoute`
- `FileNamingField` and `FileNamingConfig` for per-stream filename renaming configuration
- `image_streams` and `auto_print_items` SQLite tables + browser localStorage fallback
- Image Streams tab (`src/features/streams/ImageStreamsCenter.tsx`) with:
  - Left rail listing all streams with status indicator, file count, and click-to-focus
  - Stream cards showing watch path, watcher directory items, live sparkline of recent import activity
  - Real per-minute sparkline computed from `importQueue` timestamps (30-bucket rolling 30-min window)
  - "Open in Explorer" button (Tauri desktop only) for each stream's watch path via `reveal_in_explorer` native command
  - Per-item delete button on watcher directory rows (calls `removeImportQueueItem`)
  - Watcher row layout: filename · created time · file size · delete
  - Settings modal for stream configuration (name, watch path, enable/disable)
  - File Renaming panel: configurable field order per stream; disabled = keep source filenames
  - Auto-Print Setup modal: print item list with qty steppers, size select, template picker, printer route; actual print workflow deferred
- `removeImportQueueItem(id)` threaded from store interface → browser store → SQLite store → repository → AppContext
- `getLocations()` returns active streams as `CaptureLocation[]` when streams exist; falls back to seed locations when no streams are configured
- Gallery `selectedLocationId` filter: selecting a stream in LeftPanel shows only that stream's sessions
- `selectedLocationId` and `setLocationId` added to AppContext
- LeftPanel `LocationSelect` rewired to use context `selectedLocationId`/`setLocationId` with "All Locations" option
- Import pipeline guard removed: watched-folder import no longer requires a pre-existing fallback session (filename routing auto-creates sessions)
- `streamName` passed to `saveImportedPhoto` and used in storage path construction

**Storage path structure (revised in Phase 8):**
```
C:\PhotoFlow Desktop\photos\{streamName}\{mm_yyyy}\{dd}\{hh}\{sessionKey}\{filename}
```
- `streamName` = sanitized stream name (or `captureLocationSlug` or `manual-import` fallback)
- `mm_yyyy` = zero-padded month + underscore + 4-digit year (e.g. `05_2026`)
- `dd` = zero-padded day of month
- `hh` = zero-padded hour of import
- `sessionKey` = sanitized parsed session key from filename
- `filename` = original filename (no longer prefixed with photoId)
- `storage_path` in SQLite is an opaque TEXT column — no migration needed for path structure changes

**Key architectural notes:**
- `getLocations()` in `repository.ts` queries streams first; if any exist, maps them to `CaptureLocation[]` using `stream.captureLocationId` as the ID. Session records created during watched-folder import store this same `captureLocationId`, enabling gallery filtering.
- UI components never directly call Tauri SQL or filesystem APIs.
- `reveal_in_explorer` Tauri command registered in `src-tauri/src/lib.rs` using `std::process::Command` (cross-platform: explorer/open/xdg-open).

**Deferred (Phase 8 hard rules, still out of scope):**
- Full Processing Queue activation
- AI/rembg/model execution
- API stream ingestion
- DSLR SDK / Canon SDK / tethering
- Face matching
- Print package routing
- Source folder cleanup/archive movement
- Cloud sync

## Browser Mode Status

Browser mode (`npm run dev`) is retained for fast UI iteration but is **not a production target**. All real import, watcher, and data-at-scale work runs in Tauri desktop mode only. Do not add new features that require browser mode to work, and do not block Tauri-mode work on browser-mode compatibility.

Root cause: browser mode stored full-resolution images as base64 data URLs inside `localStorage` photo records. At 50+ real photos this JSON blob becomes tens of MB, parsed on every data read. This model cannot scale. Tauri mode stores photos as files on disk and metadata in SQLite — photo records are lightweight and image URLs are cheap `convertFileSrc()` pointers.

## Post-Phase 8 — Loose End Fixes (COMPLETE)

A series of targeted fixes applied after Phase 8, before Phase 9 was scoped.

**Stream card watcher directory (ImageStreamsCenter):**
- Watcher directory now shows a live view of what is physically in the watched folder, not import queue history
- New Tauri command `list_folder_files(path)` in `src-tauri/src/lib.rs` reads the directory and returns file name, size, and modified timestamp
- `StreamCard` polls every 2 seconds; files disappear from the view as soon as the watcher pipeline processes them
- Per-row delete button removed — it was deleting import queue records, not actual files, which was misleading
- Browser mode and streams without a configured folder show a placeholder

**Gallery and Workshop hour filtering:**
- Gallery (`GalleryCenter`) now filters sessions to only those with photos imported in the selected hour
- Workshop session filmstrip (`HourFilmstrip`) applies the same hour filter
- Both also apply the `selectedLocationId` location filter
- Hour filtering is skipped in seed/demo mode (`hours.length === 0` — no real import activity today)

**Hourly folders panel (LeftPanel):**
- Empty gap hours between active import hours are now hidden from the folder list
- "Today at a glance" bar chart still shows all hours including gaps for visual context
- Auto-selects the most recent active hour on load if the persisted selection is empty or stale

**Operating date selector (LeftPanel + AppContext + repository):**
- Left/right chevrons in the Operating Date section navigate backward and forward by day
- Right chevron is disabled when viewing today (no future data exists)
- Calendar icon accents when viewing today
- `operatingDate: Date` added to AppContext as a midnight-normalized `Date` value
- `hours` changed from a fetched state to a derived `useMemo(buildHourlyImportBuckets(allPhotos, operatingDate))` — no extra fetch needed when the date changes
- Gallery, Workshop filmstrip, and hourly folders all respond to date navigation automatically
- `buildHourlyImportBuckets` is now exported from `repository.ts` and accepts an optional `date?` parameter

**Workshop session filmstrip (HourFilmstrip):**
- Each session now shows only its first 2 thumbnails
- A `+N` badge indicates additional photos not shown
- Sessions with no visible photos show a color tile placeholder
- Horizontal footprint is now consistent regardless of session photo count

**Workshop right panel (RightPanel):**
- Local Ingest section removed (Import Photos button, watched folder controls, queue status)
- `importPhotosToActiveSession` remains in context for future use; nothing calls it from this panel
- Processing Queue demo section remains

## Performance Patterns Established (Post-Phase 8)

Responsiveness degraded noticeably after importing 50 real photos. The root causes were identified and fixed before Phase 9. These patterns are now rules — do not regress them.

**Data loading — only reload what changed:**
- `refreshData` (5-collection full reload) is now called only when data genuinely changes: after an import, after a delete, or after a watcher callback. It is never called on session selection, tab switching, or photo selection.
- `selectSession` fetches only the newly selected session's photos via `getPhotosBySessionId` + `resolvePhotoSources`. Sessions, locations, streams, and import queue are already in memory and are not reloaded.
- `toggleFavorite` and `toggleFlag` use optimistic in-place updates on `allPhotos`/`photos` state. They find the target photo in existing state (not from storage), update it locally, then persist asynchronously. No full reload.

**Photo URL resolution:**
- `resolvePhotoSources` short-circuits when no photos have `storageKind: 'tauri-managed-file'`. The full `Promise.all` map is skipped, returning the array directly.

**Render loop efficiency:**
- `GalleryCenter` and `HourFilmstrip` both precompute a `Map<sessionId, Photo[]>` via `useMemo` (indexed once per `allPhotos` change). The render loop uses O(1) map lookups instead of O(sessions × photos) filters.
- `SessionPhotoMini` in the Workshop photo strip is wrapped in `React.memo`. Only the 1–2 thumbnails whose props changed re-render when selection changes, not all 50.
- The `useEffect` that attaches mouse listeners for the compare-view drag handle uses `useCallback` on `updateSplit` and lists it as a dependency, so listeners attach once per mount instead of every render.

**Tab persistence:**
- Gallery and Workshop panels stay mounted across Gallery↔Workshop tab switches. CSS `display: contents` makes the active panel's children participate in the flex layout; `display: none` removes the inactive panel from layout without unmounting it. This keeps the browser's image decode cache warm — switching back to a tab is instant after the first load.
- The Streams tab remains conditionally mounted (it runs a 2-second polling loop that should not run in the background).

## Future — Operator Correction Tools

Make the correction affordances already visible in the UI actually work:

- Move photo between sessions
- Merge sessions
- Relink barcode/session code
- Hide/reject/favorite photos
- Operator audit history

This is the major value-add phase.

## Future — Demo Hardening

- Better empty and error states
- Demo reset tooling
- Logging and failure handling
- Startup validation
- Installer/bootstrap improvements
- Installer packaging polish

## Future — Platform Expansion

Cloud sync, licensing, remote monitoring, SMS gallery delivery, analytics, multi-venue support, AI processing pipeline, print workflow expansion. Not in current scope.

## User Context

The user processes progress visually. Each phase must preserve a visible, polished, runnable app.

The user is newer to: Vite, React project structure, TypeScript conventions, Electron/Tauri, SQLite, desktop packaging, state management patterns. Give brief primers when introducing new stack elements.

## Core Workflow Model

1. Photos are captured or imported
2. Photos are grouped into a guest session
3. A session is tied to a barcode/session code
4. The gallery shows sessions and photos clearly
5. Operators correct problems (wrong session, missing barcode, duplicate, merge needed, hide/reject)
6. Clean session data feeds print output, guest galleries, or cloud sync later

## Design Reference

The Claude Design handoff is extracted at:

```
design-handoff/photo-processing-application/project/
```

Primary reference file: `snapdesk.html` — open in browser to compare against the running app.

Do not delete or modify the handoff folder. Use it as ongoing visual direction for all phases.

## Always-Deferred Items

Do not build these until explicitly scoped:

- Full print management (Darkroom Core handles this for now)
- Cloud sync
- SMS/guest galleries
- Authentication/licensing
- Multi-tenant SaaS features
- Advanced analytics
- AI processing suite
- Advanced file routing rules

## Desired Agent Behavior

Act as an implementation partner. Make progress but identify bad assumptions early. Use small milestones. Keep the app runnable at every step. Prioritize visible operational workflow over theoretical completeness.

## Phase Checklist Rule

Every development phase must include a dedicated phase checklist document.

For each phase:

- Create a checklist file named `PHASE_X_ACCEPTANCE_CHECKLIST.md`
- Define the phase goal
- Define what is in scope
- Define what is out of scope
- List implementation tasks
- List validation commands
- List acceptance criteria
- Update the checklist as work progresses
- Use the checklist as the final source of truth before declaring the phase complete

No phase should be considered complete until its checklist has been reviewed and all required items are either completed or explicitly marked as deferred with a reason.
