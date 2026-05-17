# Phase 8 - Image Streams Foundation

## What Image Streams Are

Image Streams are configured inbound photo pathways. In Phase 8 the supported stream type is `local-folder`, which represents a desktop/FTP drop folder watched by PhotoFlow Desktop in Tauri mode.

The conceptual split is:

- Image Stream = inbound source / capture location pathway
- Session = customer/barcode grouping parsed from filename
- Processing Queue = future journey/status view across import and AI processing

Streams are not sessions. A stream such as Giraffes says where the photo came from. A filename such as `XYZ123456_001.jpg` says which guest/session the photo belongs to.

## Stream Types

Current:

- `local-folder`: a configured folder on disk, intended for FTP/drop-folder workflows

Future placeholder:

- `api-placeholder`: reserved for future API/cloud/mobile stream concepts; Phase 8 does not implement API ingestion

## Starting State

Phase 8 starts with no stream cards. Operators add photo ops/streams from the Image Streams page, and those user-created streams persist in localStorage for browser mode or SQLite for Tauri mode. The Add New Photo Op action opens a setup dialog for name, watched folder, File Renaming, processing preset, printer, auto-print, and initial enabled state.

Typical stream names are Giraffes, Main Gate, Pandas, Statue, Lion Cubs, Sea Lions, and Carousel, but they are not pre-created.

## Persistence

Browser mode stores stream configuration in localStorage through the existing metadata store abstraction.

Tauri desktop mode stores stream configuration in SQLite in the `image_streams` table. Phase 8 also adds stream linkage fields to `photos` and `import_queue` so future queue views can answer which stream detected or imported a file.

SQLite stores metadata only. Original image files are not stored as SQLite blobs.

## File Renaming

Each photo op can keep incoming filenames unchanged or rename watched-folder imports.

When File Renaming is disabled, the imported managed file keeps the detected source filename.

When File Renaming is enabled, operators can compose the filename from ordered fields such as custom text, barcode/session key, sequence number, photo-op name, photo-op code, original filename, and date. The configured separator and extension are saved with the stream. The extension setting changes the stored filename extension only; Phase 8 does not convert image formats.

## Capture Location Behavior

Configured streams populate the existing capture location selector/list. For Phase 8, a stream itself is enough to represent the source/capture location.

When a local-folder stream imports a photo, PhotoFlow records stream metadata on the import queue item and photo record where practical. Filename-based session routing still decides the destination session.

Metadata-based capture-location parsing is deferred.

## Watched-Folder Behavior

In Tauri desktop mode, enabled local-folder streams with a folder path can be watched. When a file is detected:

1. The stream watcher tags the candidate with stream context.
2. The existing file stability check waits for the file to finish copying.
3. Filename session routing runs.
4. The photo is copied into managed storage under `C:\PhotoFlow Desktop`.
5. Metadata is written to SQLite.
6. Stream counts/status fields are updated.
7. A successfully imported watched source file is removed from the watched intake folder.

Failed, skipped, duplicate, or unrouted files remain in the source folder for recovery/review.

Browser mode does not call Tauri watcher APIs. Folder selection and watching are marked desktop-only there.

## Managed Storage

The managed desktop storage root remains:

```txt
C:\PhotoFlow Desktop
```

Phase 8 does not reintroduce old app-local imported path compatibility.

Stream-aware imports use the stream slug as the storage location slug when stream context is available. Existing Phase 7 imports remain valid because photo records continue to store their managed file paths directly.

## Image Streams Page

The Image Streams tab now renders:

- stream/Photo Ops rail
- active stream, folder, and imported-today counts
- stream cards for each configured stream
- status, enabled toggle, watched folder label, folder actions
- detected/imported/error counts
- recent queue records per stream
- desktop-only indication in browser mode

The page follows the existing dark PhotoFlow operational UI style and keeps the bottom tabs/status bar intact.

## Stream Management

Phase 8 supports:

- create stream
- edit stream name and configuration
- enable/disable stream
- choose folder in Tauri mode
- clear folder safely
- delete streams from the settings dialog after a typed confirmation warning
- configure File Renaming
- configure Auto-Print item setup per photo op, including quantities, print sizes, templates, and printer routing metadata

Disabling or deleting a stream never deletes managed photo files and never deletes watched FTP/intake folders.

## Deferred

- full Processing Queue activation
- AI/rembg/model execution
- API stream ingestion
- mobile upload streams
- metadata-based capture-location parsing
- print workflow
- DSLR/tethered camera integrations
- archive movement/restore workflow

## Manual Validation

Browser mode:

```bash
npm run dev
```

Check Gallery, Session Workshop, and Image Streams. Confirm the page starts empty until a stream is added and folder watching is desktop-only.

Tauri desktop mode:

```bash
npm run tauri:dev
```

Check Image Streams, confirm no cards exist before a stream is added, create/edit/enable streams, choose a folder, restart, and confirm stream metadata persists. For watched-folder validation, drop a routed image filename into an enabled stream folder and confirm it routes to the parsed session, records stream context, copies into `C:\PhotoFlow Desktop`, and removes the source file only after success.
