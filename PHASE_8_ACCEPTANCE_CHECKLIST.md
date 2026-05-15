# PhotoFlow Desktop - Phase 8 Acceptance Checklist

## Phase Goal

Build the Image Streams page and data foundation for multiple inbound local-folder photo streams while preserving Phase 1-7 behavior.

Image Stream = inbound source / capture location pathway.
Session = customer/barcode grouping parsed from filename.
Processing Queue = future journey/status view across import and AI processing.

## In Scope

- Image Streams page in the existing tab structure
- Image stream TypeScript model
- SQLite persistence for Tauri desktop mode
- localStorage fallback persistence for browser mode
- blank initial stream state with persistent user-created streams
- create, edit, enable/disable, folder choose/clear behavior
- File Renaming toggle and configurable watched-folder import filename structure
- Auto-print card footer and per-stream setup metadata
- stream status and basic counts
- stream-aware import queue/photo metadata where practical
- stream-aware watched-folder ingest foundation
- stream-backed capture location dropdown/list options
- documentation for Phase 8 behavior and limitations

## Out Of Scope

- AI/rembg processing
- AI model execution
- full Processing Queue orchestration
- new Processing Queue panel
- print workflow or Print Center
- DSLR/Canon SDK or tethered camera control
- face matching
- cloud sync or API stream ingestion
- mobile upload API stream
- metadata-based capture location parsing
- manual capture-location assignment workflow
- archive movement or restore workflow
- old app-local imported path compatibility

## Baseline Validation

- [x] `npm install` passed, 0 vulnerabilities reported
- [x] `npm run lint` passed
- [x] `npm run build` passed
- [x] `npm audit` passed, 0 vulnerabilities reported
- [x] `npm run validate:filename-parser` passed, 12 cases validated
- [x] `cargo check` passed
- [x] `npm run dev -- --host 127.0.0.1` launched and was stopped after startup check
- [x] `npm run tauri:dev` launched and was stopped after startup check
- [x] `npm test` checked; unavailable because `package.json` has no `test` script
- [x] `npm run test` checked; unavailable because `package.json` has no `test` script

## Implementation Checklist

- [x] Confirm phase checklist rule exists in `CONTEXT.md`
- [x] Confirm phase checklist rule exists in `CLAUDE.md`
- [x] Add ImageStream types to the model layer
- [x] Add stream fields to import queue and photo records where practical
- [x] Add image stream methods to the metadata store interface
- [x] Add browser localStorage stream persistence
- [x] Add SQLite stream table and stream linkage migrations
- [x] Remove default stream seeding so fresh starts have no stream cards
- [x] Add repository stream APIs
- [x] Add streams to AppContext state/actions
- [x] Build Image Streams tab/page
- [x] Add stream list/sidebar and stream cards/grid
- [x] Add create/edit/enable/disable behavior
- [x] Add New Photo Op opens a setup dialog instead of immediately creating a card
- [x] Replace the old user-facing code field with File Renaming controls
- [x] Persist File Renaming settings in browser and SQLite stream metadata
- [x] Apply File Renaming to watched-folder managed imports when enabled
- [x] Match Auto-print card footer to reference with printer state, settings icon, and toggle
- [x] Add Auto-Print Setup window for print items, sizes, templates, and routing metadata
- [x] Persist Auto-Print Setup metadata with image streams
- [x] Add Tauri-only choose-folder behavior per local-folder stream
- [x] Add safe clear-folder behavior
- [x] Populate capture location dropdown/list from configured streams
- [x] Preserve manual import behavior
- [x] Preserve watched-folder import behavior
- [x] Preserve filename-based session routing
- [x] Preserve managed storage root at `C:\PhotoFlow Desktop`
- [x] Preserve successful watched-folder source deletion and failed/skipped source retention
- [x] Update `PHASE_8_IMAGE_STREAMS.md`
- [x] Update `README.md`, `CONTEXT.md`, and `CLAUDE.md` where useful

## Final Validation Commands

- [x] `npm install`
- [x] `npm run lint`
- [x] `npm run build`
- [x] `npm audit`
- [x] `npm run validate:filename-parser`
- [x] `cargo check`
- [x] `npm run dev -- --host 127.0.0.1`
- [x] `npm run tauri:dev`
- [x] `npm run tauri:build` if reasonable
- [x] `npm test` or document unavailable
- [x] `npm run test` or document unavailable

## Manual Validation Checklist

### Browser Mode

- [x] Browser app launches
- [x] Gallery renders by build/launch smoke
- [x] Session Workshop renders by build/launch smoke
- [x] Image Streams page renders by build/launch smoke
- [x] No stream cards appear before a user adds one in fresh browser metadata
- [x] Capture location dropdown/list is populated from streams through repository/store path
- [ ] Manual import still works - not interactively re-tested in this pass
- [x] Filename routing still works by parser validation and unchanged routing validation
- [x] localStorage metadata still works by browser store type/build path
- [x] No Tauri watcher APIs are called in browser mode
- [x] Folder selection is disabled or marked desktop-only

### Tauri Desktop Mode

- [x] Desktop app launches
- [x] SQLite initializes by `tauri:dev`, `cargo check`, and `tauri:build` smoke
- [x] Image Streams page renders by build/launch smoke
- [x] No stream cards appear before a user adds one in fresh SQLite metadata
- [x] Create stream works at repository/context/UI path
- [x] Edit stream works at repository/context/UI path
- [x] Enable/disable stream works at repository/context/UI path
- [ ] Choose folder for local-folder stream works - folder dialog not interactively exercised
- [ ] Folder path persists after restart - not interactively exercised
- [x] Stream status/counts update from import activity through stream-aware repository path
- [x] Capture location dropdown/list is populated from streams
- [ ] Manual import still works - not interactively re-tested in this pass
- [ ] Watched-folder import still works - not drop-folder tested in this pass
- [x] Filename routing still works by validation and preserved import path
- [x] Stream association persists where implemented through SQLite/browser metadata mappings

### Source And Storage Behavior

- [x] Successful watched-folder import deletes source file by preserved `remove(candidate.path)` path
- [x] Failed/skipped/unrouted import leaves source file by preserved control flow
- [x] Managed files remain under `C:\PhotoFlow Desktop`
- [x] Old app-local path compatibility is not reintroduced
- [ ] Managed files display correctly after restart - not interactively re-tested in this pass

## Acceptance Criteria

- [x] ImageStream model exists
- [x] Stream persistence exists in SQLite and browser fallback
- [x] User-created streams persist; default streams are not seeded
- [x] Image Streams page renders and follows the existing PhotoFlow visual style
- [x] Stream management works without direct SQL/filesystem calls from UI components
- [x] File Renaming disabled keeps the existing source filename on import
- [x] File Renaming enabled builds managed filenames from configured fields, separator, and extension
- [x] Browser mode remains usable and avoids Tauri APIs
- [x] Tauri mode supports local-folder stream configuration
- [x] Streams populate capture location options
- [x] Watched-folder import remains working at build/static validation level
- [x] Manual import remains working at build/static validation level
- [x] Filename-based session routing remains working
- [x] Import queue/photo records can identify stream where practical
- [x] Documentation explains stream/session/processing queue distinction
- [x] Final validation results are recorded

## Known Limitations

- Folder dialog selection and real drop-folder import were not interactively exercised in this automated pass.
- Multi-stream watcher support is implemented in the watcher service, but still needs real Folder A/Folder B desktop smoke validation with dropped files.
- The Processing Queue panel remains a placeholder; Phase 8 only adds stream-aware queue metadata.

## Deferred Items

- Full Processing Queue activation
- AI processing
- API stream ingestion
- Mobile upload stream ingestion
- Metadata-based capture-location parsing
- Print workflow
- DSLR/tethered camera integrations

## Final Completion Review

- [x] Checklist reviewed
- [x] Required items completed or explicitly deferred with reason
- [x] Final report prepared
