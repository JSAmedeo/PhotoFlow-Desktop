# Security Hardening Checklist

## Goal

Harden three targeted security gaps before Phase 10 feature work begins. No new UI features. App remains visually intact and runnable after every change.

## Scope

| Item | In scope |
|------|----------|
| `list_folder_files` path guard (Rust) | ✅ |
| `watchPath` validation in `repository.ts` | ✅ |
| `window.confirm` / `window.prompt` → Tauri native dialogs | ✅ |
| CSP dev/prod split (bonus) | Deferred — see Known Limitations |

## Out of Scope

- Runtime `fs:scope` injection (Phase 10+ architectural work)
- Removing `unsafe-inline` from `style-src` (requires eliminating all inline styles — large refactor)
- `recentlyHandled` Set persistence
- ESLint flat config migration
- Any Phase 10 feature work

---

## Implementation Tasks

### Fix 1 — `list_folder_files` path guard (`src-tauri/src/lib.rs`)

- [x] Add `std::fs::canonicalize()` call at the top of `list_folder_files`
- [x] Add `blocked_roots` slice covering Windows system directories and Unix system paths
- [x] Return `vec![]` if canonical path starts with any blocked root
- [x] Return `vec![]` if canonicalize fails (symlink loops, permission errors)
- [x] Leave all code after the `read_dir` call unchanged

### Fix 2 — `watchPath` validation (`src/data/repository.ts` + `StreamSetupDialog.tsx`)

- [x] Add `validateWatchPath(path)` helper that rejects: empty strings, UNC paths (`\\server\share`, `//...`), relative paths, system-reserved roots
- [x] Call `validateWatchPath` in `createImageStream` before constructing the stream object
- [x] Call `validateWatchPath` in `updateImageStream` before updating
- [x] Wrap `save()` in `StreamSetupDialog.tsx` with try/catch and pipe thrown errors to `setError`

### Fix 3 — Native dialogs (`src/utils/confirm.ts` + 4 components)

- [x] Create `src/utils/confirm.ts` with `confirmDestructive(message, title)` that uses `@tauri-apps/plugin-dialog` in Tauri mode and falls back to `window.confirm` in browser mode
- [x] `GalleryCenter.tsx` — photo delete button (async IIFE pattern)
- [x] `GalleryCenter.tsx` — session delete button (async IIFE pattern)
- [x] `GalleryRight.tsx` — "Delete selected" button (async IIFE pattern)
- [x] `GalleryRight.tsx` — "Delete session" button (async IIFE pattern)
- [x] `CenterPanel.tsx` — session photo delete button (async IIFE pattern)
- [x] `StreamSetupDialog.tsx` — `confirmDelete()` replaces `window.prompt` with two-step native `ask()` via `confirmDestructive`

### Bonus — CSP tightening (`src-tauri/tauri.conf.json`)

- [ ] **Deferred** — Tauri v2 does not support separate dev/production CSP in a single `tauri.conf.json`. The `ws://localhost:*` and `http://localhost:*` directives are required for Vite HMR during `npm run tauri:dev`. Removing them would break the dev build. Document as a known improvement; leave unchanged until a clean split mechanism is available.

---

## Validation Commands

```bash
cd src-tauri && cargo check        # Rust compile check — 0 errors required
npm run typecheck                  # 0 TS errors required
npm run lint                       # 0 lint errors required
npm run test                       # 12/12 tests must pass
npm run dev                        # Browser mode: confirm dialogs fall back to window.confirm
```

## Manual Checks (Tauri mode)

- [ ] Delete a photo → native OS warning dialog appears (not browser confirm)
- [ ] Delete a session from Gallery → native OS warning dialog appears
- [ ] Delete a session from GalleryRight panel → native OS warning dialog appears
- [ ] Delete photos from Workshop → native OS warning dialog appears
- [ ] Delete a Photo Op stream → native OS "Delete / Cancel" dialog appears (no text-input prompt)
- [ ] Create a stream with UNC path (`\\server\share`) → error shown in dialog footer, stream not saved
- [ ] Create a stream with relative path (`../intake`) → error shown in dialog footer, stream not saved
- [ ] Create a stream with valid absolute path → saves normally

---

## Acceptance Criteria

- `cargo check` exits 0
- `npm run typecheck` exits 0
- `npm run lint` exits 0
- `npm run test` reports 12/12 pass
- All three fixes implemented and manually verified in Tauri mode
- Browser mode degrades gracefully (falls back to `window.confirm`)
- No new UI features introduced; app visually intact

---

## Known Limitations

| Item | Reason deferred |
|------|----------------|
| `fs:scope` is broad (`C:\PhotoFlow Desktop\**`) | Enforcing a per-stream allow-list requires runtime Tauri config injection — architectural work scoped to Phase 10+ |
| `style-src 'unsafe-inline'` in CSP | Removing it requires eliminating all inline styles across the component tree — large refactor, not scoped here |
| CSP dev/prod split | Tauri v2 has no native mechanism to apply different CSP strings for dev vs production in `tauri.conf.json` |
