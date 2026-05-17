# Phase 4 Acceptance Checklist

## Phase Goal

Establish the PhotoFlow Desktop runtime foundation with Tauri v2 while preserving the existing Vite/React/TypeScript UI and browser-compatible import workflow.

## In Scope

- Add Tauri v2 project files and npm scripts.
- Preserve `npm run dev` browser mode.
- Add centralized runtime detection.
- Add a storage service boundary for browser data URLs vs Tauri-managed files.
- Route the existing import flow through the storage service.
- Store imported files in app-managed local storage in Tauri mode.
- Resolve stored photo references into displayable image sources for the existing UI.
- Update documentation with beginner-friendly Tauri and storage notes.
- Add the permanent phase checklist rule to `CONTEXT.md` and `CLAUDE.md`.

## Out of Scope

- Folder watching.
- DSLR/tethered ingest.
- Canon SDK integration.
- FTP ingest.
- Print management.
- AI/background-removal processing.
- Cloud sync.
- Licensing/authentication.
- Auto-updater or installer polish.
- SQLite metadata migration.
- Major UI redesign.

## Implementation Checklist

- [x] Inspect project structure, scripts, Vite config, TypeScript config, data models, repository/import flow, image rendering paths, localStorage usage, README, and prompt files.
- [x] Run baseline validation commands before implementation.
- [x] Add Tauri v2 dependencies and `src-tauri` project files.
- [x] Configure Tauri for the existing Vite frontend.
- [x] Add `tauri:dev` and `tauri:build` scripts.
- [x] Add centralized runtime detection.
- [x] Add browser photo storage service.
- [x] Add Tauri managed file photo storage service.
- [x] Add photo source resolver.
- [x] Extend the photo model with minimal storage metadata.
- [x] Update import flow to use the storage abstraction.
- [x] Preserve duplicate detection and unsupported file handling.
- [x] Update README and Phase 4 documentation.
- [x] Add Phase Checklist Rule to `CONTEXT.md`.
- [x] Add Phase Checklist Rule to `CLAUDE.md`.

## Validation Commands

- [x] `npm install`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `npm audit`
- [x] `npm run dev`
- [x] `npm run tauri:dev` launches on the developer machine after adding required Tauri icons. Confirmed by user on 2026-05-13.

## Acceptance Criteria

- [x] Actual repo state has been inspected.
- [x] Baseline assumptions have been checked.
- [x] Tauri v2 foundation is present.
- [x] Browser mode still builds and launches.
- [x] Existing UI remains intact.
- [x] Existing browser import workflow remains available.
- [x] Import workflow uses a storage abstraction.
- [x] Tauri mode has code to store imported images in managed app-local storage.
- [x] Stored Tauri image references can be resolved into displayable asset URLs.
- [x] Demo assets still display through existing image fields.
- [x] Gallery, Session Workshop, and before/after compare continue using displayable photo URLs.
- [x] Duplicate detection still uses session, filename, file size, and last modified date.
- [x] Unsupported file handling remains in the import queue.
- [x] Documentation explains browser mode vs desktop mode.
- [x] Documentation includes Rust/Tauri setup notes.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.
- [x] `npm audit` has no vulnerabilities.
- [x] Tauri desktop mode launches on the developer machine. Confirmed by user on 2026-05-13.

## Known Limitations

- Tauri desktop launch could not be validated inside the sandbox because Rust/Cargo is not installed there; it was confirmed on the developer machine.
- Metadata still persists through the existing `localStorage` repository in both modes; Phase 4 does not add SQLite.
- Tauri file storage may leave an orphaned copied image if the later metadata write to `localStorage` fails.
- No thumbnail-generation pipeline exists yet; imported original images are reused for thumbnails and previews.

## Deferred Items

- [x] Validate `npm run tauri:dev` after installing Rust and platform Tauri prerequisites. Confirmed by user on 2026-05-13.
- [ ] Move metadata persistence from `localStorage` to SQLite or another desktop-grade local database. Reason: intentionally deferred to a later data foundation phase.
- [ ] Add folder watching/real ingest. Reason: explicitly outside Phase 4 scope.
