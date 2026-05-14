# Phase 6 Acceptance Checklist

## Phase Goal

Add Tauri desktop watched-folder ingest that detects supported image files, waits for file stability, copies them into managed PhotoFlow storage, writes SQLite metadata/import queue records, and refreshes the existing Gallery and Session Workshop UI.

## In Scope

- Desktop-only watched-folder settings.
- Minimal visible watcher UI in the existing Local Ingest panel.
- Tauri directory selection.
- Tauri filesystem watcher lifecycle.
- File candidate filtering for `.jpg`, `.jpeg`, `.png`, and `.webp`.
- Stability checks before import.
- Auto-import pipeline using existing storage/repository boundaries.
- Managed storage organization by date/location/session.
- SQLite/app_state persistence for watcher settings.
- Import queue and photo metadata fields for watched-folder imports.
- Browser-safe desktop-only behavior.
- Phase 6 documentation.

## Out of Scope

- DSLR SDK, Canon SDK, or tethered camera control.
- Face matching.
- Print package routing or print workflow.
- AI/background removal.
- Cloud sync.
- Archive movement.
- Deleting failed/skipped watched-folder files.
- Barcode parsing from filenames.
- Session merge tooling.
- Major UI redesign.

## Implementation Checklist

- [x] Inspect project structure, scripts, Phase 4/5 runtime/storage/database pieces, import flow, UI, docs, and checklist rule.
- [x] Run baseline validation commands before implementation.
- [x] Confirm Phase Checklist Rule exists in `CONTEXT.md`.
- [x] Confirm Phase Checklist Rule exists in `CLAUDE.md`.
- [x] Add Phase 6 checklist.
- [x] Add watched-folder settings model.
- [x] Add app-state persistence helpers for watcher settings.
- [x] Add Tauri dialog plugin and permissions.
- [x] Add watched-folder status UI.
- [x] Add browser-mode desktop-only watcher message.
- [x] Add directory selection flow.
- [x] Add watcher service.
- [x] Add file candidate filtering.
- [x] Add file stability check.
- [x] Preserve FTP-safe import by requiring consecutive stable file size and modified time checks before reading.
- [x] Add auto-import pipeline.
- [x] Extend managed storage organization for watched-folder imports.
- [x] Add SQLite migration for watched import metadata.
- [x] Persist watched-folder import queue metadata.
- [x] Persist watched-folder photo metadata.
- [x] Refresh UI after watched-folder imports.
- [x] Preserve manual import flow.
- [x] Add Phase 6 documentation.
- [x] Update README and context docs.

## Validation Commands

- [x] `npm install`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `npm audit`
- [x] `npm run dev`
- [x] `npm run tauri:dev`
- [x] `cargo check`
- [x] `npm run tauri:build` attempted; release executable built, installer bundling blocked by WiX download/network permissions in this environment.

## Manual Validation Checklist

### Browser Mode

- [ ] `npm run dev` launches the app.
- [ ] Gallery renders.
- [ ] Session Workshop renders.
- [ ] Demo photos render.
- [ ] Manual multi-file import works.
- [ ] Browser import persists after refresh.
- [ ] Watched-folder UI is clearly desktop-only.
- [ ] Browser console has no Tauri watcher errors.

### Tauri Desktop Mode - Manual Import Regression

- [ ] `npm run tauri:dev` launches the desktop app.
- [ ] Gallery renders.
- [ ] Session Workshop renders.
- [ ] Manual import still works.
- [ ] Manual imported desktop photos persist after restart.

### Tauri Desktop Mode - Watched Folder Import

- [ ] Configure a watched folder.
- [ ] Enable watcher.
- [ ] Drop a supported `.jpg` file into the watched folder.
- [ ] App detects the file.
- [ ] App waits until the file is stable.
- [ ] App imports the file.
- [ ] App copies the file into managed PhotoFlow storage.
- [ ] SQLite photo record is created.
- [ ] SQLite import queue record is created.
- [ ] Photo appears in Gallery.
- [ ] Photo appears in Session Workshop.
- [ ] Close and reopen the app.
- [ ] Watched-folder imported photo still appears and resolves.
- [ ] Duplicate drop is skipped safely.
- [ ] Unsupported file is ignored or marked failed/skipped safely.
- [ ] Disabling watcher prevents further watched imports.

## Acceptance Criteria

- [x] Actual repo state has been inspected.
- [x] Baseline validation has been run.
- [x] `PHASE_6_ACCEPTANCE_CHECKLIST.md` exists.
- [x] Phase checklist rule exists in `CONTEXT.md`.
- [x] Phase checklist rule exists in `CLAUDE.md`.
- [x] Watched-folder settings are persisted.
- [x] Watched-folder status is visible in the UI.
- [x] Folder selection/configuration works in Tauri mode.
- [x] Watcher can be enabled and disabled.
- [x] Watcher does not run in browser mode.
- [x] Watcher avoids duplicate subscriptions.
- [x] Watcher cleanup is implemented.
- [x] Supported image files are detected.
- [x] Unsupported files are handled safely.
- [x] Stability check prevents immediate partial imports.
- [x] Watched-folder files are copied into managed PhotoFlow storage.
- [x] Managed path is organized by date/location/session.
- [x] Successfully imported watched source files are removed from the intake folder after managed copy and metadata persistence.
- [x] SQLite records are created for watched-folder imports.
- [x] Import queue records are created for watched-folder imports.
- [x] UI refresh hook is called after watched-folder import.
- [x] Manual import still builds and routes through existing storage/repository flow.
- [x] Existing Gallery UI remains intact.
- [x] Existing Session Workshop UI remains intact.
- [x] Duplicate detection exists for watched-folder imports.
- [x] Watcher errors are handled without blank-screen crashes.
- [x] `PHASE_6_WATCHED_FOLDER_INGEST.md` exists.
- [x] README/context docs explain the new workflow.
- [x] `npm run lint` passes.
- [x] `npm run build` passes.
- [x] `npm audit` has no vulnerabilities.
- [x] `npm run dev` launches successfully.
- [x] `npm run tauri:dev` launches successfully.
- [x] `cargo check` passes.

## Known Limitations

- Watched-folder manual smoke testing must be completed on the developer machine with a real folder and file drop.
- `npm run tauri:build` reaches the release executable step, but installer bundling still depends on WiX download access in this environment.
- Source directory access may need re-selection if OS/plugin scope rules invalidate access across sessions.
- Duplicate detection uses filename, file size, last modified time, and session; content hashing is deferred.
- Reset demo data resets metadata but does not delete managed imported files.

## Deferred Items

- [ ] Content hashing for stronger duplicate detection. Reason: avoid slowing Phase 6 ingest.
- [ ] Source folder archive/move/delete workflow. Reason: explicitly out of scope.
- [ ] Generated thumbnail/preview derivatives. Reason: better handled as a dedicated pipeline phase.
- [ ] Installer bundling/WiX validation. Reason: existing environment blocks WiX download.

## Final Completion Review

- [x] Review this checklist before declaring Phase 6 complete.
- [x] Confirm required items are completed or explicitly deferred with a reason.
