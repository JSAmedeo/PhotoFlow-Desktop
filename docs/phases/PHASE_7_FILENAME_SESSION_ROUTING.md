# Phase 7 - Filename Session Routing

Phase 7 adds deterministic filename-based session routing for imports that expose filenames.

```txt
manual import or watched-folder import
  -> filename parser
  -> session routing service
  -> find/create session
  -> photo storage service
  -> metadata store
  -> Gallery / Session Workshop
```

## Filename Format

The parser accepts the first valid session ID found from left to right:

```txt
[A-Z]{3}\d{6}
```

Parsing is case-insensitive and normalized to uppercase, so `abc123456_06.jpg` routes to `ABC123456`.

If multiple valid session IDs appear in one filename, the first valid session ID from left to right wins.

## Sequence Numbers

The parser looks for a sequence number immediately after the session ID, separated by an underscore, hyphen, or space.

Examples:

```txt
XYZ123456_01.jpg          -> XYZ123456, sequence 1, label 01
XYZ123456_001.jpg         -> XYZ123456, sequence 1, label 001
XYZ123456-02.jpg          -> XYZ123456, sequence 2, label 02
XYZ123456 03.jpg          -> XYZ123456, sequence 3, label 03
XYZ123456_04_IMG_4021.jpg -> XYZ123456, sequence 4, label 04
IMG_4021_XYZ123456_05.jpg -> XYZ123456, sequence 5, label 05
```

`XYZ123456.jpg` routes to `XYZ123456` without sequence metadata. `XYZ123456_final.jpg` also routes without a sequence because `final` is not numeric.

## Session Auto-Creation

Operators should not manually create sessions from selected imported photos.

When an imported filename contains a valid session ID, PhotoFlow finds the existing session by `sessionCode`. If it does not exist, PhotoFlow automatically creates it with the parsed session ID as the session code and barcode.

Capture location parsing is deferred. Auto-created sessions inherit existing fallback/default capture-location behavior until future mobile app metadata supplies capture-location data.

## Manual Import Routing

Browser and Tauri manual imports parse each selected filename before storage. Supported image files route to the parsed session, and unmatched filenames are skipped as unrouted instead of silently attaching to the active session.

Browser mode still stores image data as base64/data URLs and metadata in `localStorage`. Tauri mode still copies image bytes into managed desktop storage and persists metadata in SQLite.

## Watched-Folder Routing

The watched-folder flow still waits for FTP-safe file stability before reading the file. After stability passes, PhotoFlow parses the filename, finds or creates the target session, stores the file in managed storage, writes photo/import queue metadata, and deletes the watched source file only after successful import.

If no valid session ID is found, the import queue marks the file as unrouted/skipped and the watched source file remains in place where practical.

## Duplicate Handling

Duplicate detection now considers the parsed target session, original filename, file size, last modified time, watched source path, and sequence number where present. Content hashing is deferred.

## Photo Sorting

Photo lists sort by sequence number when present, then by created/imported time, filename, and id. This keeps sequenced imports stable in Gallery and Session Workshop without changing the UI layout.

## Hourly Folders

Hourly folders are derived from the current day's import activity. Seed/demo sessions do not populate today's hourly folders.

When photos import, PhotoFlow uses the photo import timestamp to place the session into the corresponding hour. It does not use EXIF/photo capture metadata for hourly folder placement. If an hour between import hours has no photos, the left panel shows that hour as an empty gap with no-photo wording.

The hourly folder panel shows session counts and total photo counts. The morning/afternoon subtext and flagged counts are not used here. Today at a glance is calculated from the same current-day hourly folder data.

## Storage And Cleanup

`C:\PhotoFlow Desktop` is the current managed desktop storage root.

Old app-local imported photo path compatibility was intentionally removed before Phase 7 and is not reintroduced.

The Fresh desktop reset control was removed in Phase 7 after Gallery session/photo deletion became available. Operators should clean up unwanted imports by deleting selected photos or whole sessions from Gallery. Session deletion removes metadata/import queue records and best-effort managed files for that session without deleting the watched FTP/intake folder.

## Deferred

Capture location parsing, manual capture-location assignment, full Processing Queue logic, AI/background removal processing, content hashing, and manual review workflows are deferred. The existing Processing Queue panel remains a placeholder except for natural import/routing statuses in the import queue.

## Manual Validation

1. Run `npm run validate:filename-parser`.
2. Run `npm run dev` and manually import `XYZ123456_01.jpg` and `XYZ123456_02.jpg`.
3. Confirm session `XYZ123456` is created and both photos appear under it in Gallery and Session Workshop.
4. Run `npm run tauri:dev` and repeat manual import.
5. Configure a watched folder, drop `XYZ123456_01.jpg`, and confirm the source is removed only after successful import.
6. Drop `IMG_4021.jpg` and confirm it is skipped/unrouted and remains recoverable.
7. Delete the routed session from Gallery and confirm metadata is removed and managed file cleanup is attempted.
