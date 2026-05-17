# Phase 7 Acceptance Checklist - Filename-Based Session Routing

## Phase Goal

Add deterministic filename-based session routing so supported imports parse a session ID from the filename, automatically find or create that session, preserve nearby sequence metadata, and display routed photos under the correct session in Gallery and Session Workshop.

## In Scope

- Central filename parser for browser and desktop import paths.
- Automatic session find/create from parsed `[A-Z]{3}\d{6}` session IDs.
- Routing metadata on photos and import queue records.
- Manual import routing in browser and Tauri modes.
- Watched-folder routing in Tauri mode.
- Duplicate detection that accounts for parsed target session and sequence where available.
- Photo display ordering by sequence number where available, then import time and filename.
- Documentation for routing behavior, storage behavior, and deferrals.

## Out of Scope

- Capture-location parsing or manual capture-location assignment.
- Full Processing Queue activation or AI processing.
- DSLR/Canon SDK, tethered camera control, face matching, print workflows, cloud sync, archive workflows, authentication, updater, installer polish, or old app-local imported path compatibility.
- Manual session creation from selected imported photos, move-to-session, merge tooling, or recycle-bin behavior.

## Implementation Checklist

- [x] Inspect package scripts, Tauri setup, runtime detection, storage root, Fresh desktop reset, manual import, watched import, photo storage, metadata stores, models, migrations, duplicate detection, delete selected behavior, Gallery, Session Workshop, Local Ingest, Processing Queue placeholder, `CONTEXT.md`, `CLAUDE.md`, and prior checklists.
- [x] Run baseline validation or document baseline failures.
- [x] Confirm permanent phase checklist rule exists in `CONTEXT.md`.
- [x] Confirm permanent phase checklist rule exists in `CLAUDE.md`.
- [x] Add centralized filename parser.
- [x] Add parser tests or lightweight validation.
- [x] Add centralized session routing service.
- [x] Add minimal model fields for routing and sequence metadata.
- [x] Add SQLite migration for Phase 7 fields if needed.
- [x] Update browser metadata store defensively.
- [x] Update SQLite metadata store defensively.
- [x] Update manual import routing.
- [x] Update watched-folder import routing.
- [x] Preserve watched-folder stability checks and source deletion after successful import.
- [x] Remove Fresh desktop reset button/functionality after Gallery delete flows were added.
- [x] Update duplicate detection for parsed route target.
- [x] Update photo sorting by sequence where practical.
- [x] Inspect delete safety and improve only if needed.
- [x] Add import-time hourly folder logic for the current day.
- [x] Remove hourly folder subtext categories and flag counts from the left panel.
- [x] Add session and photo totals to hourly folders and Today at a glance.
- [x] Preserve Processing Queue placeholder.
- [x] Add Phase 7 documentation.
- [x] Update context docs concisely.

## Validation Commands

Baseline results before Phase 7 implementation:

- [x] `npm install` - passed; 0 vulnerabilities.
- [x] `npm run lint` - passed.
- [x] `npm run build` - passed.
- [x] `npm audit` - passed; 0 vulnerabilities.
- [x] `npm run dev` - launched and was stopped after startup check.
- [x] `npm run tauri:dev` - launched and was stopped after startup check.
- [x] `cargo check` - passed from `src-tauri`.
- [x] `npm run tauri:build` - release executable builds, but Windows bundling fails because the bundler cannot find a `.ico` icon. First run also needed network access to download WiX; after approval, WiX downloaded and the remaining failure is packaging configuration.
- [x] `npm test` / `npm run test` - not available; package currently has no test script.

Post-implementation validation:

- [x] `npm run validate:filename-parser` - passed; 12 parser cases validated.
- [x] `npm run lint` - passed.
- [x] `npm run build` - passed.
- [x] `npm audit` - passed; 0 vulnerabilities.
- [x] `npm run dev` - launched and was stopped after startup check.
- [x] `npm run tauri:dev` - launched and was stopped after startup check.
- [x] `cargo check` - passed from `src-tauri`.
- [x] `npm run tauri:build` - release executable built; Windows bundling still fails with `Couldn't find a .ico icon`.

## Manual Validation Checklist

- [x] Parser handles `XYZ123456_01.jpg`.
- [x] Parser handles `XYZ123456_001.jpg`.
- [x] Parser handles `XYZ123456-02.jpg`.
- [x] Parser handles `XYZ123456 03.jpg`.
- [x] Parser handles `XYZ123456_04_IMG_4021.jpg`.
- [x] Parser handles `IMG_4021_XYZ123456_05.jpg`.
- [x] Parser normalizes `abc123456_06.jpg` to `ABC123456`.
- [x] Parser returns unmatched for `IMG_4021.jpg`.
- [x] Parser returns unmatched for `XYZ12345.jpg`.
- [x] Parser returns unmatched for `XY123456.jpg`.
- [x] Parser handles `XYZ123456.jpg` without sequence.
- [x] Parser handles `XYZ123456_final.jpg` without sequence.
- [x] Browser mode launches.
- [ ] Browser manual import routes `XYZ123456_01.jpg` and `XYZ123456_02.jpg` to session `XYZ123456`.
- [ ] Browser imported photos persist after refresh.
- [ ] Browser unsupported and duplicate files behave safely.
- [ ] Tauri manual import routes sequenced files to parsed session.
- [ ] Tauri manual imports store files under `C:\PhotoFlow Desktop`.
- [ ] Tauri manual routed photos persist after restart.
- [ ] Watched folder routes sequenced files to parsed session.
- [ ] Watched folder deletes source only after successful import.
- [ ] Unrouted watched file remains recoverable where practical.
- [x] Browser manual import successfully created a new routed session during user smoke testing.
- [ ] Gallery session deletion removes the manually imported session and refreshes selection.
- [x] Delete selected photos shows confirmation with selected count in existing Gallery, Gallery preview, and Session Workshop actions; metadata removal and best-effort managed file cleanup are handled by repository/storage services.
- [ ] Hourly folder panel starts empty when no photos have been imported today.
- [ ] Imported photos create/fill the corresponding current-day import hour.
- [ ] Skipped hours between import hours show as no-photo hours.
- [ ] Today at a glance totals match the current day's hourly folders.

## Acceptance Criteria

- [x] Filename parser is pure, centralized, deterministic, browser-safe, and desktop-safe.
- [x] First valid session ID found left-to-right is used when multiple valid IDs appear.
- [x] Session keys are normalized to uppercase.
- [x] Sequence labels and numeric values are preserved where found.
- [x] Sessions auto-create from parsed session IDs.
- [x] Photos assign to parsed sessions in manual and watched imports.
- [x] Unmatched filenames do not silently route to the wrong session.
- [x] Routing metadata persists through localStorage and SQLite stores.
- [x] Gallery and Session Workshop show routed photos under the correct session.
- [ ] Routed photos persist after restart in Tauri desktop mode.
- [x] Browser mode remains useful for UI development.
- [x] `C:\PhotoFlow Desktop` remains the desktop managed storage root.
- [x] Old app-local imported path compatibility is not reintroduced.
- [x] Capture-location parsing remains deferred.
- [x] Processing Queue full logic remains deferred.

## Known Limitations

- Content hashing is deferred unless implementation reveals a low-risk need.
- Capture location is inherited from existing fallback/default behavior; filename capture-location parsing is deferred.
- Processing Queue remains a placeholder except for existing/basic import queue status display.
- `npm run tauri:build` currently fails during Windows bundling because the bundle step cannot find a `.ico` icon.

## Deferred Items

- Phase 8 should likely activate the existing Processing Queue around ingest/routing statuses without adding AI model processing yet.
- Capture-location metadata should come from future mobile app metadata.
- Content hashing and richer manual review/recovery workflows are deferred.

## Final Completion Review

- [x] Checklist reviewed after implementation.
- [x] All required items completed or explicitly deferred with a reason.
- [x] Validation results recorded.
- [x] Manual smoke test results recorded.
- [ ] Phase 7 is only declared complete if this checklist supports that claim.
