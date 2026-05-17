# Phase 9 — Final pre-phase fixes (combined)

Paste this prompt into Claude Code from the root of the PhotoFlow-Desktop repo.

---

## Context

Phase 9 hardening is nearly complete. This session closes all remaining open items before Phase 9 feature work begins. There are four tasks: two code fixes, one component split, and one documentation pass. No new features.

Read `CLAUDE.md` fully before starting. Update `docs/phases/PHASE_9_HARDENING_CHECKLIST.md` as each item is completed.

---

## Fix 1 — Add allowed-root check to `reveal_in_explorer`

**File:** `src-tauri/src/lib.rs`

The current command guards on path existence (`p.exists()`) but does not validate that the path is under an allowed root. A path that happens to exist anywhere on the filesystem would still be spawned. Add the root check now.

**Current code (lines 38–60):**

```rust
#[tauri::command]
fn reveal_in_explorer(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);
    if !p.exists() {
        return Err(format!("Path does not exist: {path}"));
    }
    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}
```

**Replace with:**

```rust
#[tauri::command]
fn reveal_in_explorer(path: String) -> Result<(), String> {
    let p = std::path::Path::new(&path);

    // Guard 1: path must exist on disk.
    if !p.exists() {
        return Err(format!("Path does not exist: {path}"));
    }

    // Guard 2: path must be under an allowed root.
    // Windows: C:\PhotoFlow Desktop  or  %LOCALAPPDATA%\PhotoFlow Desktop
    // macOS/Linux: $HOME/PhotoFlow Desktop
    let canonical = std::fs::canonicalize(p).map_err(|e| e.to_string())?;

    let allowed = {
        let mut roots: Vec<std::path::PathBuf> = vec![
            std::path::PathBuf::from(r"C:\PhotoFlow Desktop"),
        ];
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            roots.push(std::path::PathBuf::from(local).join("PhotoFlow Desktop"));
        }
        if let Ok(home) = std::env::var("HOME") {
            roots.push(std::path::PathBuf::from(home).join("PhotoFlow Desktop"));
        }
        roots
    };

    if !allowed.iter().any(|root| canonical.starts_with(root)) {
        return Err(format!(
            "Path is outside the allowed PhotoFlow Desktop directories: {path}"
        ));
    }

    #[cfg(target_os = "windows")]
    std::process::Command::new("explorer")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "macos")]
    std::process::Command::new("open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;
    #[cfg(target_os = "linux")]
    std::process::Command::new("xdg-open")
        .arg(&path)
        .spawn()
        .map_err(|e| e.to_string())?;

    Ok(())
}
```

**Important note on operator behavior:** With this guard in place, the reveal button will silently fail (console warning only) for watch folders configured on drives outside `C:\PhotoFlow Desktop` or `%LOCALAPPDATA%` — for example, `D:\test-watcher`. This is a known limitation documented in the checklist. The JS call site in `src/features/streams/ImageStreamsCenter.tsx` (`openInExplorer`) already wraps the `invoke` call in a try/catch and logs `[PhotoFlow] Could not reveal path in explorer:` — verify this is still the case, but no JS changes should be needed.

After the Rust change:

```bash
cd src-tauri && cargo check 2>&1
```

If `cargo check` is unavailable in this environment, note it in the checklist — the compile check must be run locally before shipping.

---

## Fix 2 — Lazy-load Tauri imports in `autoImportPipeline.ts`

**File:** `src/ingest/autoImportPipeline.ts`

`readFile` and `remove` from `@tauri-apps/plugin-fs` are imported at module level (line 1). The browser bundle resolves these at load time even though this file is only ever called from Tauri-mode execution paths. This is the same issue already fixed in `watchedFolderService.ts`.

**Current line 1:**

```ts
import { readFile, remove } from '@tauri-apps/plugin-fs';
```

Remove this import entirely. Then inside `autoImportWatchedFile`, replace the two use sites with dynamic imports:

Replace:
```ts
const bytes = await readFile(candidate.path);
```
With:
```ts
const { readFile } = await import('@tauri-apps/plugin-fs');
const bytes = await readFile(candidate.path);
```

Replace:
```ts
await remove(candidate.path);
```
With:
```ts
const { remove } = await import('@tauri-apps/plugin-fs');
await remove(candidate.path);
```

Both `await import(...)` calls sit inside the Tauri-only execution path, so browser mode never reaches them.

---

## Fix 3 — Split `ImageStreamsCenter.tsx`

**Current state:** `src/features/streams/ImageStreamsCenter.tsx` is 1,299 lines / ~62 KB. Phase 9 added the ACTIVITY tab and changed import semantics, making this the primary maintainability risk before the next feature phase. The Processing Queue must not be added to this file in its current form.

**Target structure:**

```
src/features/streams/
  ImageStreamsCenter.tsx       ← root page layout only (~100 lines after split)
  StreamCard.tsx               ← StreamCard component + folder poll logic
  StreamActivityTab.tsx        ← ACTIVITY tab contents (queue items, status icons)
  StreamFolderTab.tsx          ← FOLDER tab contents (live folder file list, delete)
  StreamSetupDialog.tsx        ← PhotoOpDialog (create/edit stream settings)
  AutoPrintSetupDialog.tsx     ← AutoPrintSetupDialog
  streamUiHelpers.ts           ← pure helpers: statusLabel, statusColor, fmtTime,
                                  computeSparkline, codeFromName, sanitizePreview,
                                  previewFilename, and constants (PRINT_SIZES,
                                  NAMING_FIELD_OPTIONS, TEMPLATE_COLLECTIONS, etc.)
```

**Boundaries to respect:**

- `streamUiHelpers.ts` must be pure — no React, no hooks, no imports from `AppContext`. Only functions and constants that take plain values and return plain values or JSX-free strings.
- `StreamCard.tsx` owns the `useEffect` folder poll, `refreshFolder`, `deleteWatchedFile`, sparkline memo, and the `streamQueue`/`issueCount` memos. It receives `stream`, `isSelected`, and `onSelect` as props — same as today.
- `StreamActivityTab.tsx` receives `streamQueue: ImportQueueItem[]` and `issueCount: number` as props. It renders the activity rows, status icons, and color logic. It does not call `useApp()`.
- `StreamFolderTab.tsx` receives `folderFiles: FolderFileEntry[]`, `watchPath: string | null`, `deletingFile: string | null`, and `onDelete: (filename: string) => void` as props. It does not own the poll — `StreamCard` owns the poll and passes the data down.
- `StreamSetupDialog.tsx` (rename of `PhotoOpDialog`) owns all the form state for create/edit. It calls `useApp()` for `createImageStream`, `updateImageStream`, `deleteImageStream`.
- `AutoPrintSetupDialog.tsx` owns its own state and calls `useApp()` for `updateImageStream`.
- `ImageStreamsCenter.tsx` after the split contains only: the `ImageStreamsCenter` export, the stream rail, the grid, and the two `StreamSetupDialog` mount points. It calls `useApp()` for `imageStreams` and `importQueue` only.

**Shared types:** The `FolderFileEntry` interface and any interfaces that cross file boundaries should move to `streamUiHelpers.ts`.

**Imports:** Each new file imports only what it uses. Lucide icons are imported per-file. `useApp` is only imported in files that call it.

**Do not change any behavior, styling, or logic during this split.** The only changes are file boundaries and import paths. The visual result must be identical before and after. Run the app in browser mode (`npm run dev`) and confirm the Streams tab looks and behaves the same.

---

## Fix 4 — README and docs accuracy pass

Make targeted edits only — do not rewrite sections wholesale.

### 4a. README: stale unrouted/fallback language

**File:** `README.md`

Find and replace this sentence (in the Import workflow section):

> Files without a valid session ID are treated as unrouted exceptions and are skipped/marked for review instead of silently attaching to the wrong session.

Replace with:

> Files with a valid session code route to that session. Files without a recognizable session code are fallback-routed into a derived session based on the filename stem, allowing operators to review and correct them later.

### 4b. README: stale duplicate-skip language

**File:** `README.md`

Find and replace this bullet (in the Import workflow section):

> - exact duplicates in the same routed session are skipped by filename, file size, last modified time, watched source path, and sequence number where available

Replace with:

> - re-dropped files are imported as additional photos using a unique filename suffix such as `_2` or `_3`; only an identical source path already recorded as successfully imported is skipped

### 4c. README: phase status

**File:** `README.md`

Update the top heading:

```
## Current Stage: Phase 9 — TBD (Phase 8 complete)
```

Replace with:

```
## Current Stage: Phase 9 — Stream ingest hardening and activity visibility
```

Update the phase plan table row:

```
| 9 | TBD | **Next** |
```

Replace with:

```
| 9 | Stream ingest hardening and activity visibility | **In progress** |
```

### 4d. Hardening checklist: `reveal_in_explorer` known limitations

**File:** `docs/phases/PHASE_9_HARDENING_CHECKLIST.md`

The Known Limitations section currently describes the `D:\` drive case from before the root check was removed. After Fix 1 in this session restores the root check, update that entry to read:

> **Watch-path reveal for external drives:** `reveal_in_explorer` will return an error (and log a console warning) for watch folders configured outside `C:\PhotoFlow Desktop` or `%LOCALAPPDATA%`. Operators who place watch folders on other drives (e.g. `D:\test-watcher`) will see no crash but will not be able to use the Reveal button for those folders. Future fix: Tauri runtime scope API per-path injection, or constrain watch-folder selection to within the allowed roots.

---

## Checklist updates

In `docs/phases/PHASE_9_HARDENING_CHECKLIST.md`:

- Mark **1b** fully complete: both path-existence and allowed-root checks are now implemented.
- Add **3c-followup**: "Lazy-load `readFile`/`remove` in `autoImportPipeline.ts`." Mark complete.
- Add **7a**: "Split `ImageStreamsCenter.tsx` into focused component files." Mark complete.
- Add **8a**: "README and docs accuracy pass — fallback routing, duplicate behavior, phase name, reveal limitations." Mark complete.
- In Acceptance Criteria, check off:
  - `reveal_in_explorer` returns `Err` for paths outside allowed roots
  - `ImageStreamsCenter.tsx` split complete — typecheck and lint pass

---

## Validation sequence

Run in this order:

```bash
cd src-tauri && cargo check           # Rust compile check (run locally if unavailable here)
npm run typecheck                     # 0 errors required — critical after component split
npm run lint                          # 0 errors required
npm run test                          # 12/12 tests must still pass
npm run dev                           # Streams tab must look and behave identically after split
```

---

## Out of scope

- No new UI features or layout changes
- Do not touch `fs:scope` in `capabilities/default.json` — the broad `**` entry is intentional and documented
- Do not change `recentlyHandled` Set persistence — deferred
- Do not migrate ESLint to flat config — deferred
- Do not activate the Processing Queue

---

## Handoff format

When done, provide:

1. `cargo check` result (or note it needs local verification)
2. `npm run typecheck`, `npm run lint`, and `npm run test` output
3. File list for the `src/features/streams/` split with line counts per new file
4. Confirmation the checklist and README are updated
5. Statement that Phase 9 hardening is complete and Phase 10 feature work can begin
