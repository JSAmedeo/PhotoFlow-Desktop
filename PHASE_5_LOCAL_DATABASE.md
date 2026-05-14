# Phase 5 Local Database Foundation

Phase 5 adds SQLite-backed metadata persistence for Tauri desktop mode.

The UI is intentionally unchanged. The new database layer sits underneath the existing repository/context flow so Gallery, Session Workshop, imports, favorites, flags, and selected workflow state keep using the same app-level data path.

## Why SQLite Was Added

Phase 4 stored imported desktop image files in managed Tauri app-local storage, but metadata still lived in browser `localStorage`. SQLite fixes that mismatch for desktop mode:

```txt
desktop image files -> managed Tauri app-local storage
photo/session metadata -> SQLite
```

SQLite is a small local database stored on the user's machine. It is a good fit here because PhotoFlow Desktop is local-first and needs durable metadata without running a separate database server.

## Runtime Modes

Browser mode:

```txt
file import -> base64/data URL -> localStorage metadata -> React UI
```

Tauri desktop mode:

```txt
file import -> managed app-local file storage -> SQLite metadata -> React UI
```

## Database

Database connection:

```txt
sqlite:photoflow.db
```

The Tauri SQL plugin stores SQLite paths relative to Tauri's app configuration area. The exact operating system path varies by platform, so application code uses the plugin connection string rather than hardcoded absolute paths.

## Tables

Phase 5 creates these tables:

- `schema_migrations`
- `sessions`
- `photos`
- `capture_locations`
- `hour_buckets`
- `import_queue`
- `app_state`

The tables mirror the current TypeScript models and workflow state. SQLite stores metadata and file references only; original image binaries are not stored as database blobs.

## Migrations

Migrations are TypeScript-defined and run during metadata store initialization in Tauri mode.

The initial migration creates tables and indexes with `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS`, then records the applied migration in `schema_migrations`. This makes startup safe to run repeatedly.

## Seed Data

If the SQLite database has no sessions, PhotoFlow seeds the same demo sessions, photos, locations, and hour buckets used by browser mode.

LocalStorage-to-SQLite migration is deferred. A new desktop database starts from demo seed data unless future migration tooling is added.

## Reset Behavior

Reset demo data clears and reseeds metadata:

- sessions
- photos
- capture locations
- hour buckets
- import queue
- selected workflow state

Reset does not delete managed imported image files from app-local storage. That cleanup needs a future, explicit file-retention policy.

## Known Limitations

- Imported originals are still reused as thumbnails.
- The `+` photo strip tile is still visual only.
- No folder watching, print workflow, AI workflow, cloud sync, or session repair tooling is included.
- LocalStorage-to-SQLite migration is deferred.
