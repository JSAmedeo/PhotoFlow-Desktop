# Phase 5 Acceptance Checklist

## Phase Goal

Add SQLite-backed metadata persistence for Tauri desktop mode while preserving the existing UI, browser localStorage fallback, Phase 4 Tauri runtime, and Phase 4 photo file storage abstraction.

## In Scope

- Add the official Tauri SQL plugin with SQLite support.
- Preserve browser mode with localStorage metadata and base64/data URL image fallback.
- Add a metadata store boundary so the repository can use localStorage in browser mode and SQLite in Tauri mode.
- Initialize SQLite safely in Tauri mode.
- Add a repeatable migration strategy and initial schema.
- Seed demo data into SQLite when the desktop database is empty.
- Persist sessions, photos, locations, hour buckets, import queue, and selected workflow state through the active metadata store.
- Keep imported desktop images in Phase 4 managed app-local file storage and store only metadata/file references in SQLite.
- Update documentation with beginner-friendly SQLite/persistence notes.

## Out of Scope

- Folder watching.
- DSLR tethering.
- Canon SDK integration.
- FTP ingest.
- Darkroom Core integration.
- Print Center workflow.
- AI/background-removal processing.
- Cloud sync.
- Licensing/authentication.
- Auto-updater or installer polish.
- Guest-facing gallery or SMS delivery.
- Session merge/repair tooling.
- Major UI redesign.
- Storing original image binaries as SQLite blobs.

## Implementation Checklist

- [x] Inspect project structure, scripts, Phase 4 Tauri setup, runtime detection, photo storage, models, repository, localStorage use, import flow, docs, and Phase 4 checklist.
- [x] Run baseline validation commands before implementation.
- [x] Confirm Phase Checklist Rule exists in `CONTEXT.md`.
- [x] Confirm Phase Checklist Rule exists in `CLAUDE.md`.
- [x] Add Tauri SQL plugin JavaScript dependency.
- [x] Add Tauri SQL plugin Rust dependency and registration.
- [x] Add SQLite permissions/capabilities.
- [x] Add database initialization layer.
- [x] Add migration strategy.
- [x] Add initial SQLite schema.
- [x] Add metadata store interface.
- [x] Add browser localStorage metadata store.
- [x] Add Tauri SQLite metadata store.
- [x] Add metadata store factory.
- [x] Update repository to use the selected metadata store.
- [x] Update AppContext for async repository operations.
- [x] Preserve Phase 4 photo storage abstraction.
- [x] Update import metadata persistence.
- [x] Update README and Phase 5 documentation.
- [x] Update `CONTEXT.md` and `CLAUDE.md`.

## Validation Commands

- [x] `npm install`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `npm audit`
- [x] `npm run dev`
- [x] `npm run tauri:dev`
- [x] `cargo check`
- [x] `npm run tauri:build` attempted; release executable built, installer bundling failed because the environment could not download WiX.

## Acceptance Criteria

- [x] Actual repo state has been inspected.
- [x] Baseline validation has been run or documented.
- [x] `PHASE_5_ACCEPTANCE_CHECKLIST.md` exists.
- [x] Phase checklist rule exists in `CONTEXT.md`.
- [x] Phase checklist rule exists in `CLAUDE.md`.
- [x] SQLite support is added for Tauri desktop mode.
- [x] Database initialization exists for Tauri mode.
- [x] Migrations are safe to run repeatedly.
- [x] Initial schema exists.
- [x] Metadata store abstraction exists.
- [x] Browser mode still uses localStorage metadata.
- [x] Tauri mode uses SQLite metadata.
- [x] Existing UI remains intact.
- [x] Existing browser import workflow still builds.
- [x] Existing desktop import workflow still builds.
- [x] Phase 4 managed file storage remains intact.
- [x] Desktop photo metadata writes to SQLite through the metadata store.
- [x] Demo assets still display through existing image fields.
- [x] Gallery data loads through the repository in both runtime modes.
- [x] Session Workshop data loads through the repository in both runtime modes.
- [x] Duplicate detection still checks session, filename, file size, and last modified date.
- [x] Unsupported file handling remains in the import queue.
- [x] Favorite, flag, and notes persistence routes through the active metadata store.
- [x] Selected workflow state persistence routes through the active metadata store.
- [x] Reset demo data behavior is implemented and documented.
- [x] README and Phase 5 docs explain the persistence model.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.
- [x] `npm audit` has no vulnerabilities.
- [x] `npm run dev` launches successfully.
- [x] `npm run tauri:dev` launches successfully after Phase 5 SQL integration.

## Known Limitations

- LocalStorage-to-SQLite migration is deferred; a new Tauri SQLite database seeds demo data when empty.
- Reset demo data resets metadata only; it does not delete imported files from managed app-local storage.
- Imported originals are still reused as thumbnails.
- The `+` photo strip tile remains visual only.
- `npm run tauri:build` creates the release executable, but installer bundling requires WiX availability/network access on Windows.

## Deferred Items

- [ ] LocalStorage-to-SQLite migration. Reason: useful later, but not required to establish SQLite metadata persistence safely.
- [ ] Delete orphaned managed image files on reset. Reason: needs a carefully scoped file cleanup policy.
- [ ] Folder watching/real ingest. Reason: outside Phase 5 scope.
- [ ] Local installer bundling validation. Reason: release executable builds, but WiX download is blocked in this environment.

## Final Completion Review

- [x] Review this checklist before declaring Phase 5 complete.
- [x] Confirm all required items are completed or explicitly deferred with a reason.
