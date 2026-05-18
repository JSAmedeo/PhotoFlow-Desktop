# Security hardening — small and medium effort items

Paste this prompt into Claude Code from the root of the PhotoFlow-Desktop repo.

---

## Context

Phase 9 hardening is complete. This session implements three targeted security improvements before Phase 10 feature work begins. No new UI features. The app must remain visually intact and runnable after every change.

Read `CLAUDE.md` fully before starting. Create `docs/phases/SECURITY_HARDENING_CHECKLIST.md` as you go, following the Phase Checklist Rule from `CLAUDE.md`.

---

## Fix 1 — Add path guard to `list_folder_files`

**File:** `src-tauri/src/lib.rs`

**Why:** `list_folder_files` accepts any path string from JS and calls `read_dir()` on it with no validation. Unlike `reveal_in_explorer`, it has no guards at all. A stream with a crafted `watchPath` could be used to enumerate files in system directories (`C:\Windows\System32`, `/etc`, `/proc`, etc.). It should reject system-reserved roots while still allowing legitimate operator watch folders on any drive.

**Current code:**

```rust
#[tauri::command]
fn list_folder_files(path: String) -> Vec<FolderFileEntry> {
    let dir = std::path::Path::new(&path);
    if !dir.is_dir() {
        return vec![];
    }
    let Ok(read_dir) = std::fs::read_dir(dir) else {
        return vec![];
    };
    // ... rest of function
```

**Replace the guard block at the top with:**

```rust
#[tauri::command]
fn list_folder_files(path: String) -> Vec<FolderFileEntry> {
    let dir = std::path::Path::new(&path);

    // Must be an existing directory.
    if !dir.is_dir() {
        return vec![];
    }

    // Reject system-reserved roots. Operators may place watch folders on any
    // drive, so we can't enforce an allow-list here the way reveal_in_explorer
    // can. Instead, block the most dangerous system paths explicitly.
    let canonical = match std::fs::canonicalize(dir) {
        Ok(p) => p,
        Err(_) => return vec![],
    };
    let blocked_roots: &[&str] = &[
        r"C:\Windows",
        r"C:\Program Files",
        r"C:\Program Files (x86)",
        r"C:\ProgramData",
        r"C:\System Volume Information",
        "/etc",
        "/sys",
        "/proc",
        "/dev",
        "/boot",
        "/bin",
        "/sbin",
        "/usr/bin",
        "/usr/sbin",
    ];
    if blocked_roots.iter().any(|root| canonical.starts_with(root)) {
        return vec![];
    }

    let Ok(read_dir) = std::fs::read_dir(dir) else {
        return vec![];
    };
    // ... rest of function unchanged
```

Leave everything after the `read_dir` call exactly as it is — only the guard block at the top changes.

After this change:

```bash
cd src-tauri && cargo check 2>&1
```

---

## Fix 2 — Validate `watchPath` before it is stored

**File:** `src/data/repository.ts`

**Why:** The stream setup dialog has a freeform text input for the watch path alongside the OS file picker. A manually typed path is not validated before being stored in SQLite and passed to the watcher. Paths like `\\server\share` (UNC), `../relative`, or an empty string after trimming should be rejected with a clear error returned to the caller, not silently stored.

**Add a validation helper near the top of `repository.ts`** (after the imports, before `createImageStream`):

```ts
// Returns null if the path is acceptable, or an error string if it should be rejected.
function validateWatchPath(path: string): string | null {
  const trimmed = path.trim();
  if (!trimmed) return 'Watch path cannot be empty.';

  // Reject UNC paths (\\server\share) — network paths are not supported as watch folders.
  if (trimmed.startsWith('\\\\') || trimmed.startsWith('//')) {
    return 'Network (UNC) paths are not supported as watch folders. Use a local drive path.';
  }

  // Reject relative paths — watch paths must be absolute.
  const isAbsoluteWindows = /^[A-Za-z]:[\\/]/.test(trimmed);
  const isAbsoluteUnix = trimmed.startsWith('/');
  if (!isAbsoluteWindows && !isAbsoluteUnix) {
    return 'Watch path must be an absolute path (e.g. C:\\PhotoFlow Intake\\Lions or /Users/operator/intake).';
  }

  // Reject paths that are clearly system roots (no operator should watch these).
  const blockedPrefixes = [
    'C:\\Windows', 'C:\\Program Files', 'C:\\Program Files (x86)',
    'C:\\ProgramData', 'C:\\System Volume Information',
    '/etc', '/sys', '/proc', '/dev', '/boot', '/bin', '/sbin',
  ];
  const upper = trimmed.toUpperCase();
  if (blockedPrefixes.some(p => upper.startsWith(p.toUpperCase()))) {
    return 'This path is a system-reserved directory and cannot be used as a watch folder.';
  }

  return null;
}
```

**Then update `createImageStream`** to validate before creating:

```ts
export async function createImageStream(input: { ... }): Promise<ImageStream> {
  // Validate watch path if provided.
  if (input.watchPath) {
    const pathError = validateWatchPath(input.watchPath);
    if (pathError) throw new Error(pathError);
  }
  // ... rest of function unchanged
```

**And update `updateImageStream`** to validate when `watchPath` is being changed:

```ts
export async function updateImageStream(id: string, changes: Partial<ImageStream>): Promise<ImageStream | undefined> {
  // Validate watch path if it is being changed.
  if (changes.watchPath) {
    const pathError = validateWatchPath(changes.watchPath);
    if (pathError) throw new Error(pathError);
  }
  const store = await getMetadataStore();
  // ... rest of function unchanged
```

**Then update `StreamSetupDialog.tsx`** to catch and display the validation error. The `save()` function currently calls `createImageStream`/`updateImageStream` without error handling for thrown errors. Wrap the call:

```ts
const save = async () => {
  if (!canCreate) {
    setError('Fill name and a folder path.');
    return;
  }
  try {
    if (stream) {
      await updateImageStream(stream.id, { ... });
    } else {
      await createImageStream({ ... });
    }
  } catch (err) {
    setError(err instanceof Error ? err.message : 'Could not save stream.');
    return;
  }
  // ... reset fields and close as before
};
```

The `error` state variable and its display element already exist in `StreamSetupDialog.tsx` — just wire the catch to `setError`.

---

## Fix 3 — Replace `window.confirm` and `window.prompt` with Tauri native dialogs

**Why:** `window.confirm` and `window.prompt` use the WebView's built-in browser dialogs. In Tauri's WebView these can be visually inconsistent and are technically overridable by the page's JS context. Tauri's `dialog` plugin provides native OS dialogs (the same ones used by the Browse button) that render outside the WebView and cannot be intercepted.

**Pattern to use for confirms:**

```ts
// Instead of:
if (window.confirm('Are you sure?')) { ... }

// Use:
const { ask } = await import('@tauri-apps/plugin-dialog');
const confirmed = await ask('Are you sure?', { title: 'Confirm', kind: 'warning' });
if (confirmed) { ... }
```

**Pattern to use for the DELETE text prompt:**

```ts
// Instead of:
if (window.prompt('Type DELETE to confirm') !== 'DELETE') return;

// Tauri has no native text-input dialog. Use a two-step confirm instead:
const { ask } = await import('@tauri-apps/plugin-dialog');
const confirmed = await ask(
  'This will permanently remove this Photo Op from PhotoFlow. Photo files and already-imported sessions will NOT be deleted.',
  { title: `Delete Photo Op: ${stream.name}`, kind: 'warning', okLabel: 'Delete', cancelLabel: 'Cancel' }
);
if (!confirmed) return;
```

The `window.prompt` DELETE-typing pattern is a UX compromise that doesn't work well on touch or accessibility devices anyway. A clearly labelled native warning dialog with a destructive "Delete" button is equivalent protection in a local desktop app.

**Files to update — apply the pattern to every `window.confirm` and `window.prompt` call:**

### `src/features/gallery/GalleryCenter.tsx`

Two `window.confirm` calls. Both are inside `onClick` handlers that are already synchronous — change each to an async arrow function. Example:

```ts
// Before (line ~88):
onClick={() => {
  if (selectedPhotoIds.length === 0) return;
  const label = selectedPhotoIds.length === 1 ? 'this photo' : `${selectedPhotoIds.length} photos`;
  if (window.confirm(`Delete ${label} from PhotoFlow? Imported files will also be removed from managed storage.`)) {
    void deleteSelectedPhotos();
  }
}}

// After:
onClick={() => void (async () => {
  if (selectedPhotoIds.length === 0) return;
  const label = selectedPhotoIds.length === 1 ? 'this photo' : `${selectedPhotoIds.length} photos`;
  const { ask } = await import('@tauri-apps/plugin-dialog');
  const confirmed = await ask(
    `Imported files will also be removed from managed storage.`,
    { title: `Delete ${label} from PhotoFlow?`, kind: 'warning', okLabel: 'Delete', cancelLabel: 'Cancel' }
  );
  if (confirmed) void deleteSelectedPhotos();
})()}
```

Apply the same pattern to the second `window.confirm` call in this file (the session delete, line ~148).

### `src/features/gallery/GalleryRight.tsx`

Two `window.confirm` calls (lines ~163 and ~174). Apply the same async-IIFE + `ask()` pattern. Each is already inside an `onClick` that calls `e.stopPropagation()` — keep that line, just replace the `window.confirm` block.

### `src/features/workshop/CenterPanel.tsx`

One `window.confirm` call (line ~204). Apply the same pattern.

### `src/features/streams/StreamSetupDialog.tsx`

One `window.prompt` call inside `confirmDelete()`. This is already an `async` function, so no IIFE needed. Replace with the two-step `ask()` pattern described above. Remove the multiline `warning` string construction — the title and message params of `ask()` replace it.

**Important:** These calls use `await import('@tauri-apps/plugin-dialog')`. In browser mode, this module is not available. Wrap each usage in an `isTauriRuntime()` guard with a `window.confirm`/`window.prompt` fallback:

```ts
async function confirmDestructive(message: string, title: string): Promise<boolean> {
  if (isTauriRuntime()) {
    const { ask } = await import('@tauri-apps/plugin-dialog');
    return ask(message, { title, kind: 'warning', okLabel: 'Delete', cancelLabel: 'Cancel' });
  }
  return window.confirm(`${title}\n\n${message}`);
}
```

Add this helper to each file that needs it, or extract it to `src/utils/confirm.ts` and import it across all four files. The extracted utility approach is cleaner — one file, one import.

---

## CSP tightening (bonus — do if straightforward)

**File:** `src-tauri/tauri.conf.json`

The `connect-src` directive currently includes `ws://localhost:*` and `http://localhost:*` (wildcard port). This is only needed in dev mode for the Vite HMR websocket. In production the app loads from `frontendDist` and has no Vite dev server.

If Tauri v2 supports separate CSP configs for dev and production, tighten the production CSP by removing `ws://localhost:*` and `http://localhost:*`. If there's no clean way to have a dev-only CSP without risking breaking `npm run tauri:dev`, document this in the checklist as a known improvement and leave it unchanged. Do not break the dev build trying to fix this.

---

## Checklist

Create `docs/phases/SECURITY_HARDENING_CHECKLIST.md` with:

- Goal: harden three targeted security gaps before Phase 10 feature work
- Scope: `list_folder_files` path guard, `watchPath` validation, native dialog replacement, optional CSP tightening
- Implementation tasks (tick each as complete)
- Validation commands
- Known limitations (broad `fs:scope` remains; `unsafe-inline` style-src remains; CSP dev/prod split deferred if not straightforward)

---

## Validation sequence

```bash
cd src-tauri && cargo check           # Rust compile check
npm run typecheck                     # 0 errors required
npm run lint                          # 0 errors required
npm run test                          # 12/12 tests must still pass
npm run dev                           # browser mode: confirm dialogs degrade gracefully to window.confirm
```

Manual checks in Tauri mode:
- Delete a photo — native OS dialog appears instead of browser confirm
- Delete a session — native OS dialog appears
- Delete a Photo Op stream — native OS "Delete" / "Cancel" dialog appears (no text-input prompt)
- Create a stream with a UNC path (`\\server\share`) — error message shown in dialog, stream not saved
- Create a stream with a relative path (`../intake`) — error message shown, stream not saved
- Create a stream with a valid absolute path — saves normally

---

## Out of scope

- Runtime `fs:scope` injection (Phase 10+ architectural work)
- Removing `unsafe-inline` from `style-src` (requires eliminating all inline styles — large refactor)
- `recentlyHandled` Set persistence
- ESLint flat config migration
- Any Phase 10 feature work

---

## Handoff format

When done:

1. `cargo check` result
2. `npm run typecheck`, `npm run lint`, `npm run test` output
3. Confirm which of the three fixes + optional CSP tightening were completed
4. Confirm checklist created and accurate
5. Updated security posture score estimate
