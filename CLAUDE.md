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
- **Desktop shell:** Not added yet — Tauri or Electron planned for Phase 5
- **Local data:** localStorage via layered repository (active since Phase 2) → SQLite planned for Phase 4+
- **Dev server:** `npm run dev` → localhost (port varies if 5173 is in use)
- **Typecheck:** `npm run typecheck` (`tsc --noEmit`)
- **No lint script yet** — planned for Phase 5

## Phase Status and Current Focus

| Phase | Goal | Status |
|-------|------|--------|
| 1 | Visual MVP Shell | **COMPLETE** |
| 2 | Local Data Foundation | **COMPLETE** |
| 3 | Basic Photo Ingest | **CURRENT** |
| 4 | Operator Correction Tools | Planned |
| 5 | Demo Hardening + Desktop Packaging | Planned |
| 6 | Platform Expansion | Future |

## Phase 3 — Current Focus

**Goal:** Allow a user to select local image files, import them into the active session, create real `Photo` records, show them in the existing Gallery and Workshop UI, and persist them across refreshes.

**Browser constraint:** This app is still a Vite browser app — no direct filesystem access. Use `<input type="file" multiple accept="image/*">` and object URLs. Do not add Electron/Tauri yet.

**What to build:**
- `ImportQueueItem` model and `ImportStatus` type in `models.ts`
- File picker wired to the active session
- `Photo` records created from selected files (object URL as `displayUrl`/`thumbnailUrl`)
- Imported photos shown in Gallery thumbnails and Workshop photo strip
- Basic duplicate detection (filename match within session)
- Import queue/status UI (queued → importing → complete/failed)
- Import success and error feedback visible in the UI
- Repository additions: `addPhoto()`, `addImportQueueItem()`, `updateImportStatus()`
- Context additions: import queue state, `importPhotos()` action
- localStorage persistence of photo metadata (not image binary — object URLs do not survive refresh; document this clearly)
- README updated

**Hard rules for Phase 3:**
- Do not build folder watchers, DSLR tethering, FTP ingest, or Canon integration
- Do not add Electron or Tauri
- Do not add AI/rembg processing
- Do not add cloud upload
- Do not add complex filesystem routing
- Preserve all existing UI — no visual regressions

## Design Source of Truth

The Claude Design handoff is already extracted at:

```
design-handoff/photo-processing-application/project/
```

Primary reference: `snapdesk.html` — open in browser to compare against the running app.

Do not delete or modify the handoff folder. Use it as ongoing visual direction for all phases.

## Project Structure (as of Phase 2)

```
src/
  components/        ← shared UI primitives
    Tile.tsx         ← colored SVG session thumbnail
    Slider.tsx       ← draggable range slider
    Select.tsx       ← dropdown
    Seg.tsx          ← segmented control
    Check.tsx        ← checkbox
    TopBar.tsx
    LeftPanel.tsx    ← reads hours/locations from context
    TabBar.tsx       ← reads/sets activeTab via context
    StatusBar.tsx    ← reads session data from context
  features/
    gallery/
      GalleryCenter.tsx
      GalleryRight.tsx
    workshop/
      CenterPanel.tsx
      RightPanel.tsx
      HourFilmstrip.tsx
  data/
    models.ts        ← all TypeScript interfaces and types
    seedData.ts      ← 14 seed sessions, generated photos, 4 locations, 12 hour buckets
    localStore.ts    ← raw localStorage helpers (only file that touches localStorage)
    repository.ts    ← public data API (getSessions, updatePhotoMetadata, resetDemoData, etc.)
  context/
    AppContext.tsx   ← data state only (sessions, selectedSessionId, photos, tab, hour, filter)
  styles/
    global.css       ← full CSS design system
  App.tsx            ← AppProvider wrapper; UI-only state (zoom, activeTool, split) stays here
  main.tsx
public/
  demo-assets/       ← before.jpg, after.png (demo photos)
design-handoff/      ← reference only, do not modify
```

## Data Layer Architecture (Phase 2 — implemented)

```
Components / context
      ↓
  repository.ts      ← public API only
      ↓
  localStore.ts      ← localStorage read/write (pf_ prefix)
      ↓
  localStorage
```

Components and context never call `localStore.ts` directly. `localStore.ts` never calls `repository.ts`.

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
  enhanceVersion, width, height, fileSizeMb, fileFormat
}

CaptureLocation { id, name, code, isActive }
HourBucket      { h, label, sub, count, flagged }
ProcessingStatus: 'pending' | 'processing' | 'done' | 'warn' | 'error'
PhotoFlag:        'none' | 'flagged' | 'rejected' | 'favorite'
SessionStatus:    'active' | 'complete' | 'flagged' | 'archived'
TabKey:           'gallery' | 'workshop' | 'streams' | 'print' | 'config'
FilterKey:        'All' | 'Flagged' | 'Processed' | 'Pending'
```

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

## Always-Deferred Items

Do not build these unless explicitly scoped into a phase:

- Full print management (Darkroom Core handles this)
- Cloud sync or cloud APIs
- SMS/guest gallery delivery
- Authentication or licensing
- Multi-tenant SaaS features
- Advanced analytics
- AI processing pipeline
- SQLite (Phase 4 earliest — Phase 3 uses browser file picker + object URLs)
- Tauri/Electron desktop shell (Phase 5)

## Communication Style

Be direct. Point out risks and bad assumptions early. If a direction could cause rework, say so and suggest a safer path.

When handing work back, include:
- What changed
- How to run it
- What to check visually
- Known limitations
- Recommended next step
