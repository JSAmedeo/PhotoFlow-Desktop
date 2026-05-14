# Phase 4 Desktop Runtime Foundation

Phase 4 added the first real desktop runtime foundation for PhotoFlow Desktop while keeping the existing browser demo working.

Phase 5 later added SQLite metadata persistence for Tauri desktop mode. This document remains as the Phase 4 desktop runtime reference.

## Runtime Modes

### Browser Dev Mode

Run:

```bash
npm run dev
```

This starts the Vite development server in a normal browser tab. Browser mode continues to store imported images as base64/data URLs in `localStorage`, which is useful for demos but not production-scale storage.

### Tauri Desktop Mode

Run:

```bash
npm run tauri:dev
```

Tauri wraps the Vite/React app in a native desktop window. In desktop mode, imported images are copied into managed app-local storage under:

```txt
photos/imported/{sessionCode}/{photoId}-{safe-filename}
```

The app stores a relative reference in the photo record and resolves that reference into a webview-safe image URL for `<img>` tags.

## What Tauri Does Here

Tauri is the desktop shell. React still owns the UI, Vite still runs the frontend dev server, and Tauri provides controlled access to desktop capabilities such as app-local filesystem storage.

This phase uses Tauri v2 capabilities to allow only the filesystem access needed for app-managed imported photos. It does not ask the user to choose folders and does not watch folders yet.

## Storage Behavior

Browser mode:

- Uses the existing `localStorage` repository.
- Saves imported images as base64/data URLs.
- Keeps Phase 3 refresh persistence for demo-sized imports.
- Can hit browser storage limits with large images or large batches.

Tauri desktop mode:

- Uses the same metadata repository for now.
- Copies imported image bytes into Tauri app-local data.
- Stores `storageKind: "tauri-managed-file"` and a relative `storagePath`.
- Resolves managed files through Tauri's asset protocol so existing UI image tags can display them.

As of Phase 5, Tauri desktop mode stores photo/session metadata in SQLite instead of browser localStorage.

## Current Architecture

```txt
photo storage service -> repository -> AppContext -> components
```

The UI still receives normal displayable image URLs. Components do not import Tauri filesystem APIs.

## Required Local Setup

To run Tauri mode, install:

- Node.js in the range supported by `package.json`
- Rust and Cargo from `rustup`
- The platform prerequisites listed in the official Tauri v2 setup guide

Browser mode does not require Rust.

## Known Limitations

- Phase 4 originally used `localStorage` metadata; Phase 5 added SQLite for Tauri desktop metadata.
- Imported originals are reused as thumbnails.
- No folder watcher, DSLR/tethering, print workflow, AI processing, cloud sync, updater, or installer polish is included.
- If metadata persistence fails after a Tauri file write, the copied file may remain as an orphaned app-local file.
