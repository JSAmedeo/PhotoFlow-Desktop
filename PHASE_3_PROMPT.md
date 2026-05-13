# PhotoFlow Desktop — Phase 3 Prompt

You are working inside the existing PhotoFlow Desktop project.

Phase 1 and Phase 2 are complete.

The app currently has:

- polished dark desktop UI shell
- Gallery screen
- Session Workshop screen
- before/after compare UI
- typed local data models
- seed data
- localStorage persistence
- repository layer
- React context for data state
- selected session/photo/tab persistence
- resetDemoData()
- no TypeScript errors

---

# Phase 3 Goal

Implement **basic local photo ingest**.

This phase is not about advanced automation.

The goal is:

> Allow a user to select local image files, import them into the active session, generate usable photo records, show them in the existing UI, and persist them across refreshes.

Keep this controlled, simple, and demo-ready.

---

# Development Philosophy

This project is UI-first and workflow-first.

The user needs to see visible UI progress from the beginning. The UI is not secondary. It is the operational map of the product.

Do not break, simplify, or de-polish the existing interface.

Phase 3 should make the current application feel more real without jumping into full production infrastructure too early.

---

# Current Phase 3 Scope

## Build

- manual image import via file picker
- import into the currently selected session
- create new `Photo` records
- show imported photos in Gallery and Session Workshop
- persist imported photo metadata
- persist imported image display data in local browser storage if practical
- basic thumbnail/display handling
- basic duplicate detection
- basic import queue/status UI
- import success/error feedback
- README update

## Do Not Build Yet

- folder watcher
- DSLR tethering
- Canon integration
- FTP ingest
- Darkroom Core integration
- AI/rembg processing
- cloud upload
- background worker system
- Electron/Tauri conversion
- complex filesystem routing
- production image storage architecture
- printer management

---

# Important Browser Constraint

This project is currently still a browser/Vite-style app.

Browser apps cannot freely manage the local filesystem like a true desktop app.

Therefore, implement Phase 3 as a **controlled browser-compatible MVP** using:

- `<input type="file" multiple accept="image/*">`
- `FileReader`
- object URLs or base64/data URLs
- localStorage, unless IndexedDB is already present and easy to use

Preferred for this phase:

- store imported image display data as base64/data URLs for small demo-scale imports
- clearly document that this is not final production storage
- treat this prompt as superseding older project notes that mention object URLs for persisted imports

Do not migrate to Electron or Tauri in this phase.

---

# Required Implementation Steps

---

## 1. Inspect Existing Project

Review the current structure before changing anything.

Inspect:

- `src/data/models.ts`
- `src/data/seedData.ts`
- `src/data/localStore.ts`
- repository layer
- `AppContext.tsx`
- Gallery components
- Session Workshop components
- import/processing placeholder UI
- README
- package scripts

Understand the current data flow:

```txt
localStore → repository → AppContext → components
```

Preserve this architecture.

---

## 2. Add Import/Ingest Types

Add or update models for import tracking.

Suggested types:

```ts
export type ImportStatus =
  | "queued"
  | "importing"
  | "complete"
  | "skipped"
  | "failed";

export interface ImportQueueItem {
  id: string;
  filename: string;
  sessionId: string;
  status: ImportStatus;
  progress: number;
  error?: string;
  createdAt: string;
  completedAt?: string;
}
```

If useful, also add:

```ts
export interface ImportedFileMetadata {
  filename: string;
  fileSize: number;
  lastModified: number;
  mimeType: string;
}
```

Keep the model simple and readable.

---

## 3. Extend the Photo Model if Needed

Ensure the existing `Photo` model can represent imported images.

Photos should support, or already support:

- `id`
- `sessionId`
- `filename`
- `displayUrl`
- `thumbnailUrl`
- `originalPath` or equivalent placeholder
- `createdAt`
- `captureLocation`
- `processingStatus`
- `isFavorite`
- `isFlagged`
- `isHidden`
- `operatorNotes`
- `beforeImageUrl`
- `afterImageUrl`
- original filename/size/lastModified metadata for duplicate detection

For browser-demo imports:

- `displayUrl`, `thumbnailUrl`, `beforeImageUrl`, and `afterImageUrl` may all point to the same imported data URL.
- Add comments noting that this will later be replaced by managed filesystem paths or thumbnail cache records.
- Use the closest existing `ProcessingStatus` value unless the union is intentionally expanded. If not expanding it, imported-but-unprocessed photos should use `"pending"` and the UI should label that state clearly.

---

## 4. Add Repository Functions

Extend the repository with clear import functions.

Suggested API:

```ts
importPhotosToSession(sessionId: string, files: File[]): Promise<Photo[]>;

addPhotoToSession(sessionId: string, photo: Photo): Photo;

getImportQueue(): ImportQueueItem[];

addImportQueueItem(item: ImportQueueItem): void;

updateImportQueueItem(
  itemId: string,
  changes: Partial<ImportQueueItem>
): void;

clearCompletedImports(): void;

clearImportQueue(): void;
```

Exact names may vary, but the intent must remain clear.

Repository responsibilities:

- create photo records
- detect duplicates
- update session photo counts
- persist imported photo records
- persist import queue state if appropriate
- expose simple functions to context/components
- handle localStorage write failures explicitly; do not silently report success if persisted data could not be written
- avoid count/photo mismatches if a batch partially fails

Do not put raw localStorage calls directly inside UI components.

---

## 5. Add Context Actions

Extend `AppContext.tsx` with import-related state/actions.

Suggested additions:

```ts
importQueue: ImportQueueItem[];

importPhotosToActiveSession(files: File[]): Promise<void>;

clearCompletedImports(): void;

clearImportQueue(): void;
```

The context should:

- know the active selected session
- call repository functions
- update React state
- refresh selected photo/session data if needed
- expose enough photo data for Gallery, Workshop, previews, and filmstrips to render real imported images
- synchronize selected photo state with any local workshop index state, or replace the local index where practical
- expose clean actions to components

Keep UI-only state inside components.

Do not move zoom level, slider position, active tool UI state, or visual-only controls into global context unless already there for a reason.

---

## 6. Add File Picker UI

Wire the import workflow into the existing ingest/import placeholder area.

The UI should include:

- polished “Import Photos” button
- hidden file input
- multiple image selection
- accepted formats note
- active session label
- disabled state when no session is selected
- recent import status
- queue/progress display
- skipped duplicate count if applicable
- failed import count if applicable

The import area must match the existing dark visual style.

Do not use an unstyled default browser file input as the main visible UI.

Accept:

```html
<input type="file" multiple accept="image/*" />
```

but visually trigger it from a styled button.

---

## 7. Import Flow

When a user selects files:

1. Confirm an active session exists.
2. Add each file to the import queue as `queued`.
3. Validate file type starts with `image/`.
4. Skip unsupported files with a friendly queue error.
5. Check for duplicates.
6. Read valid files with `FileReader`.
7. Convert to data URL for display/persistence.
8. Create a new `Photo` record.
9. Assign it to the active session.
10. Preserve original filename.
11. Store file size and last modified metadata if model supports it.
12. Set capture location to `"Imported"` or the current selected capture location if one exists.
13. Set processing status to `"imported"` or the closest existing valid status.
14. Use the imported image for display/thumbnail/before/after placeholders.
15. Update session photo count.
16. Persist data.
17. Update selected photo if appropriate.
18. Mark queue item as `complete`, `skipped`, or `failed`.
19. Refresh the visible UI without requiring a page reload.

---

## 8. Duplicate Detection

Add basic duplicate protection.

At minimum, compare:

- `sessionId`
- `filename`
- `fileSize`
- `lastModified`

If exact file metadata is unavailable, fall back to:

- `sessionId`
- `filename`

If duplicate is detected:

- skip the file
- mark queue item as `skipped`
- show a friendly warning/status
- do not crash
- do not create a duplicate photo record

Do not implement hash-based dedupe in Phase 3.

---

## 9. Persistence Requirements

Imported photo records must survive page refresh.

For image display persistence:

Preferred Phase 3 approach:

- store imported images as base64/data URLs in localStorage

Important:

- Add a clear code comment and README note that this is demo-scale storage.
- Mention that production storage will move to Electron/Tauri filesystem paths, SQLite metadata, and thumbnail cache.

If localStorage quota errors occur:

- fail gracefully
- show a useful error
- do not corrupt existing session data
- document the limitation

---

## 10. UI Integration Requirements

Imported photos should appear in:

- Gallery view
- active session photo grid
- selected photo preview
- Session Workshop thumbnail panel
- before/after compare area

Important current-code integration note:

- Replace hardcoded `/demo-assets/before.jpg` and `/demo-assets/after.png` render paths in Gallery/Workshop surfaces with the selected `Photo` record URLs where appropriate.
- Replace placeholder thumbnail loops based only on `session.photoCount` with real `Photo` records wherever imported image visibility is required.
- Existing seed/demo photos should still render using their seeded URLs.

If no processed version exists:

- use the same image for before/after
- or show a clear “No processed version yet” placeholder

Do not break seed/demo photos.

Do not remove the existing mock/demo visual richness.

---

## 11. Status Indicators

Update the existing status/import panels to show useful Phase 3 state.

Include some or all of:

- imported photo count
- last import time
- active session receiving imports
- queue count
- completed count
- skipped duplicate count
- failed count
- storage limitation warning if triggered
- replacement of stale mock queue counts/status labels where they conflict with real import state

Keep this polished and compact.

This should look like part of PhotoFlow, not a debug panel.

---

## 12. Reset Demo Data Behavior

`resetDemoData()` must:

- remove imported photos
- restore original seed sessions/photos
- clear import queue
- reset selected session/photo/tab to sensible defaults
- require no page reload

The app should immediately return to the clean demo state.

---

## 13. Error Handling

Handle common cases:

- no session selected
- user cancels file picker
- unsupported file type
- duplicate file
- FileReader failure
- localStorage quota exceeded
- partial import success

Do not let one failed file crash the full import batch.

---

## 14. README Update

Update README with a Phase 3 section.

Explain:

- how to run the app
- how to import photos
- where the import UI lives
- what happens when photos are imported
- how imported photos are stored
- browser/localStorage limitations
- how to reset demo data
- what is intentionally not implemented yet
- why Electron/Tauri is deferred

Include the run commands:

```bash
npm install
npm run dev
npm run build
```

If lint exists:

```bash
npm run lint
```

If lint does not exist, state that clearly.

---

# Validation

Run:

```bash
npm install
npm run dev
npm run build
npm run lint
```

If `npm run lint` does not exist:

- say so clearly
- do not invent the script unless specifically asked

Fix:

- TypeScript errors
- broken imports
- failed builds
- runtime errors from the import flow

---

# Phase 3 Definition of Done

Phase 3 is complete when:

- app launches locally
- existing polished UI is preserved
- user can select image files manually
- imported photos are added to the active session
- imported photos appear in Gallery
- imported photos appear in Session Workshop
- imported photos appear in the selected photo preview
- imported photos work in the before/after compare area or show an intentional placeholder
- imported photo records persist across refresh
- imported image display works across refresh for demo-scale usage
- duplicate imports are handled safely
- invalid files are handled safely
- resetDemoData() clears imported photos and restores seed data
- import queue/status feedback is visible
- README explains the workflow and limitations
- `npm run build` succeeds
- zero TypeScript errors remain

---

# Known Boundary

This is not the final production ingest system.

This phase proves the workflow.

Future phases may replace browser-based storage with:

- Electron filesystem APIs
- Tauri filesystem APIs
- SQLite
- managed app storage folders
- thumbnail cache
- watch folders
- real ingest queue workers
- DSLR tether integration
- Darkroom Core output integration

Do not solve those problems in Phase 3.

---

# Final Response Format

When complete, report:

1. Summary of changes
2. Files created/modified
3. How to run/test
4. How to import photos
5. What now persists
6. Known limitations
7. Validation results
8. Recommended next phase
