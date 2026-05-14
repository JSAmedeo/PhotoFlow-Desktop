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
| 6 | Watched Folder Ingest | **CURRENT** |

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
- Tauri managed app-local file storage for imported images
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

## Phase 6 — Watched Folder Ingest (CURRENT)

Add desktop-only watched-folder ingest:

- Tauri dialog folder selection
- Tauri filesystem watching
- file stability checks before import
- supported image files copied into managed app-local storage
- managed path organized by date/location/session
- SQLite photo/import queue metadata for watched-folder imports
- visible watcher controls in the Local Ingest panel
- browser mode remains manual-import only and shows watcher as desktop-only

Still out of scope unless explicitly reintroduced:

- DSLR SDK / Canon SDK / tethering
- face matching
- print package routing
- source folder cleanup/archive movement
- cloud sync

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
