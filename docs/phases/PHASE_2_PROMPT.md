# PhotoFlow Desktop — Development Framework + Phase 2 Prompt

You are working inside the PhotoFlow Desktop project.

This project is being developed intentionally using a UI-first, workflow-first methodology.

The user is highly visual and needs to see visible progress from the beginning of each phase. The UI is not secondary — it is the operational map of the product.

The goal is not to rapidly build backend complexity.
The goal is to iteratively transform a polished visual prototype into a real operational desktop system.

You must preserve this philosophy throughout development.

---

# PROJECT VISION

PhotoFlow Desktop is a local-first operational photography management system for high-volume attraction photography environments such as:

- zoos
- aquariums
- amusement venues
- tourism attractions
- seasonal photography operations

The software is designed for:

- operators
- editors
- print staff
- deployment/support staff

Core concepts include:

- session-based photo organization
- barcode/session workflows
- gallery management
- operator correction tools
- local reliability
- live operational visibility
- future cloud expansion

The application must feel:

- modern
- operational
- fast
- visually impressive
- trustworthy
- clean
- professional

The software should resemble a real commercial product from very early stages.

---

# DEVELOPMENT PHILOSOPHY

## UI-First Development

The user mentally processes progress through visible UI.

Each phase should:
- preserve visual polish
- preserve operational workflows
- avoid breaking the UI
- visibly evolve the product

Do not strip functionality for engineering convenience.

The UI is the anchor.

---

## Local-First Architecture

The MVP should function locally without cloud dependency.

Prioritize:
- reliability
- understandable structure
- local persistence
- maintainability
- operational clarity

Avoid premature enterprise architecture.

---

## Beginner-Friendly Structure

The project owner is newer to several development stacks.

Code should therefore be:
- understandable
- structured
- documented
- discoverable
- clearly named

Avoid unnecessary abstraction.

Prefer:
- readable code
- explicit naming
- clean folder structure
- comments where useful

---

# HIGH LEVEL ROADMAP

This roadmap defines the intended order of operations for the project.

---

# Phase 1 — Visual MVP Shell
STATUS: COMPLETE

Goal:
Create a polished operational desktop shell demonstrating the intended workflow.

Completed:
- polished dark UI
- gallery screen
- session workshop
- before/after compare
- mock sessions/photos
- status indicators
- operator affordances
- processing panels
- design handoff integration
- README/run instructions

This phase established the visual direction.

---

# Phase 2 — Local Data Foundation
STATUS: CURRENT PHASE

Goal:
Replace hardcoded mock data with a real local data foundation while preserving the polished UI.

This phase should:
- introduce structured models
- create local persistence
- centralize app state
- preserve existing visuals
- support future ingest workflows

This is NOT a backend/cloud phase.

---

# Phase 3 — Basic Photo Ingest

Future phase.

Goal:
Allow real local image ingestion into sessions.

Planned features:
- watch/import folder
- photo import pipeline
- thumbnail generation
- session assignment
- basic file safety
- ingest queue visibility

Still local-first.

---

# Phase 4 — Operator Correction System

Future phase.

Goal:
Implement real operational correction tools.

Planned features:
- move photo between sessions
- merge sessions
- relink barcode/session
- hide/reject photos
- operator audit history
- correction workflows

This is a major value phase.

---

# Phase 5 — Demo Hardening

Future phase.

Goal:
Make the MVP reliable and impressive enough for external demos.

Planned features:
- better empty states
- demo reset tooling
- logging
- failure handling
- recovery flows
- startup validation
- installer/bootstrap improvements

---

# Phase 6 — Platform Expansion

Future phase.

Potential features:
- cloud sync
- licensing
- remote monitoring
- SMS gallery delivery
- analytics
- multi-venue support
- AI processing pipeline
- print workflow expansion

Not part of current implementation scope.

---

# CURRENT TASK — PHASE 2

## OBJECTIVE

Replace hardcoded mock data with a real local data layer while preserving the current polished UI experience.

The application should still visually feel like the completed Phase 1 demo.

However:
- sessions
- photos
- selected state
- metadata
- persistence

should now come through structured local data management.

---

# IMPORTANT SCOPE RULES

DO:
- preserve the UI
- preserve the design language
- improve project structure
- add local persistence
- improve maintainability

DO NOT:
- redesign the UI
- over-engineer
- add cloud architecture
- add authentication
- add licensing
- add print systems
- add AI systems
- convert to enterprise architecture
- build future roadmap items early

---

# DESIGN HANDOFF

A design handoff zip already exists in the repository.

Requirements:
- preserve the handoff files
- do not delete extracted assets
- use the handoff as ongoing visual direction
- maintain visual consistency with the established prototype

---

# PHASE 2 IMPLEMENTATION REQUIREMENTS

## 1. Inspect Existing Project

Review:
- folder structure
- existing components
- current mock data
- package configuration
- README
- design handoff assets

Understand the current architecture before modifying anything.

---

# 2. Create Structured Data Models

Add clear TypeScript models/interfaces for:

```ts
Session
Photo
CaptureLocation
ProcessingStatus
PhotoFlag
SessionStatus
```

Sessions should support:
- id
- sessionCode
- barcode
- createdAt
- updatedAt
- captureLocations
- photoCount
- status
- notes
- linkedSessionIds placeholder

Photos should support:
- id
- sessionId
- filename
- thumbnailUrl
- displayUrl
- createdAt
- captureLocation
- processingStatus
- isFavorite
- isFlagged
- isHidden
- operatorNotes
- beforeImageUrl
- afterImageUrl

---

# 3. Create Local Repository Layer

Create a clean local data structure such as:

```txt
src/
  data/
    models.ts
    seedData.ts
    localStore.ts
    photoFlowRepository.ts
```

Names may vary slightly if justified.

The structure should remain understandable for a beginner/intermediate developer.

Repository functions should include:

```ts
getSessions()
getSessionById(id)
getPhotosBySessionId(sessionId)
getPhotoById(id)
updatePhotoMetadata(photoId, changes)
updateSessionMetadata(sessionId, changes)
resetDemoData()
```

`resetDemoData()` must:
1. Clear all PhotoFlow app keys from localStorage (use a key prefix like `pf_` to scope them)
2. Re-seed from `seedData.ts` — write fresh seed records into localStorage
3. Return the fresh session list so the caller can reset UI state (selected session, tab) to defaults
4. Not reload the page — the context should react to the returned data and update in place

---

# 4. Replace Hardcoded Mock Data

The existing file `src/data/mockData.ts` must be fully replaced — do not leave it alongside the new files or the UI will have two competing data sources.

Migration:
- Move all TypeScript types and interfaces from `mockData.ts` into `models.ts`
- Move all data arrays (SESSIONS, HOURS, ACTIVE_PHOTOS, LOCATIONS, TINTS, HOUR_SHORT) into `seedData.ts` as the seed records
- Delete `mockData.ts` once all imports have been updated to the new files
- Update every component that currently imports from `../data/mockData` to import from the repository or context instead

The UI should no longer rely on scattered hardcoded arrays.

Seed/demo data should initialize automatically if no local data exists.

---

# 5. Add Local Persistence

Use localStorage only. Do not introduce SQLite or any other local DB in this phase.

Layer responsibilities:
- `localStore.ts` — raw localStorage read/write helpers (get, set, remove, clear by key prefix). This is the only file that touches `localStorage` directly.
- `repository.ts` — calls `localStore.ts` internally. Exposes the clean data API to the rest of the app. Components and context must never call `localStore.ts` directly.

Persistence should survive page refreshes.

Persist:
- favorite toggles per photo
- flag state per photo
- operator notes per photo
- selected session and selected photo
- active tab

Do not persist purely visual UI state (zoom level, tool selection, before/after split position).

---

# 6. Add Centralized App State

Add a React context (`src/context/AppContext.tsx`) that owns **data state** only:
- sessions list
- selected session ID
- selected photo ID
- active tab
- loading state
- active filter (All / Flagged / Processed / Pending)

**Do not move UI-only state into context.** The following stay as local component state in `App.tsx` or the component that needs them:
- zoom level
- active tool (brush, lasso, etc.)
- before/after split position
- dropdown open/closed states

`App.tsx` currently holds a mix of both. Migrate only the data state items listed above into context. Leave the rest where they are.

Prefer:
- React hooks/context
- simple patterns

Avoid:
- Redux unless already installed and justified

---

# 7. Preserve UI Polish

The current UI quality must remain intact.

Do not:
- simplify layouts
- remove effects
- remove before/after compare
- remove status indicators
- remove operator affordances
- reduce visual quality

Visual continuity matters.

---

# 8. Add Developer Quality Improvements

Improve:
- folder organization
- naming consistency
- comments where useful
- beginner readability

Avoid:
- clever abstractions
- hidden logic
- confusing architecture

---

# 9. Update README

README should explain:
- how to run the app
- local architecture
- seed/demo data
- persistence approach
- reset flow
- intentionally unimplemented features
- roadmap awareness

README should help a newer developer understand the project quickly.

---

# 10. Validation

Run and validate:

```bash
npm install
npm run typecheck
npm run dev
```

`npm run typecheck` runs `tsc --noEmit` — sufficient for this phase. Do not run `npm run build` (produces an unused `dist/` folder) and do not run `npm run lint` (no lint script is configured in this project yet — it will be added in Phase 5).

Fix:
- TypeScript errors reported by typecheck
- broken imports from the mockData.ts migration
- any runtime errors visible in the browser console after `npm run dev`

---

# PHASE 2 DEFINITION OF DONE

Phase 2 is complete when:

- app launches successfully
- polished UI remains intact
- mock data is fully centralized
- local persistence works
- sessions/photos load through repository layer
- selected state works correctly
- project structure is understandable
- README is updated
- design handoff remains preserved
- build succeeds
- future ingest workflows are easier to implement

---

# IMPORTANT ENGINEERING PHILOSOPHY

This project is intentionally avoiding premature backend complexity.

The priority is:
1. operational workflow clarity
2. visual polish
3. understandable architecture
4. reliable local behavior

Not:
- scalability
- distributed systems
- enterprise abstractions

Build the simplest professional solution that supports the roadmap.

---

# FINAL RESPONSE FORMAT

When complete, provide:

1. Summary of changes
2. Files created/modified
3. How to run/test
4. What Phase 2 now supports
5. Known limitations
6. Suggested Phase 3 implementation approach

