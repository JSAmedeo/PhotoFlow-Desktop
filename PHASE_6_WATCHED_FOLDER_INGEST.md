# Phase 6 Watched Folder Ingest

Phase 6 adds a desktop-only watched-folder ingest path for PhotoFlow Desktop.

The watched folder is an intake point only. After import, PhotoFlow copies files into managed app-local storage and treats that managed storage plus SQLite metadata as the app-owned source of truth.

## Architecture

Tauri desktop mode:

```txt
watched folder
  -> watcher service
  -> stability check
  -> auto-import pipeline
  -> managed app-local storage organized by date/location/session
  -> SQLite metadata/import queue
  -> React UI
```

Browser mode:

```txt
manual import
  -> base64/data URL
  -> localStorage metadata
  -> React UI
```

## How To Configure

Run desktop mode:

```bash
npm run tauri:dev
```

Open Session Workshop and use the right panel:

```txt
Local Ingest -> Watched Folder
```

Use **Choose Folder** to select an intake directory, then enable the watcher. Browser mode shows the watcher as desktop-only and does not call Tauri folder APIs.

## Supported Files

Phase 6 watches for:

- `.jpg`
- `.jpeg`
- `.png`
- `.webp`

Unsupported files are ignored by the watcher before import. Manual import still uses the browser/native file picker path.

## File Stability

The watcher does not import immediately when a file event arrives. The app waits, checks file size and modified time, waits again, and imports only when both values stop changing.

Defaults:

```txt
file_settle_delay_ms = 2000
max_stability_attempts = 5
required_stable_checks = 2
```

This means a file must remain unchanged across two consecutive checks before import. With the default settings, PhotoFlow waits for roughly four seconds of unchanged size/modified time before reading the file.

This matters for FTP-based intake because a mobile capture app may still be transferring bytes into the watched folder when PhotoFlow first sees the file. If the file keeps changing, PhotoFlow waits and retries instead of importing the partial transfer.

## Source File Behavior

The watched folder is treated as an FTP/hot-folder intake queue. After a watched file is successfully copied into PhotoFlow managed storage and its metadata is recorded, PhotoFlow removes the original source file from the watched folder.

PhotoFlow does not:

- archive source files
- delete files that failed import
- delete skipped duplicate/unsupported files

Archive rules and failed-file cleanup are deferred to a future phase.

## Managed Storage

Watched-folder imports are copied to:

```txt
photos/
  imported/
    YYYY/
      MM/
        DD/
          {captureLocationSlug}/
            {sessionKey}/
              originals/
                {photoId}_{safeOriginalFilename}
```

Older Phase 4/5 managed file paths remain compatible because image resolution still uses the stored relative path.

## SQLite Metadata

Phase 6 extends SQLite metadata with optional source/import fields on photo and import queue records:

- source type
- source path
- managed original path
- imported timestamp
- watched-folder queue metadata

Watcher settings are stored in `app_state` using the existing Phase 5 metadata store.

## Session Assignment

Phase 6 uses the active selected session. Advanced routing, barcode parsing, and filename-based assignment are intentionally deferred.

## Duplicate Handling

Watched-folder duplicate detection uses the current practical import rule:

```txt
target session id + filename + file size + last modified time
```

Content hashing is deferred.

## Known Limitations

- Folder access may need to be reselected if OS/plugin scope rules change across sessions.
- Unsupported watched-folder files are ignored quietly.
- The source folder is not cleaned up.
- The `+` photo strip tile is still visual only.
- Imported originals are still reused as thumbnails.
