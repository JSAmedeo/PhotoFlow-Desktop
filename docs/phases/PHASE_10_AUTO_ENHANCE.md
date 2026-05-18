# Phase 10 — Auto Image Enhancement

## Goal

Every photo imported through an image stream can be automatically enhanced immediately after save. The original file is always preserved. Operators can switch between the original and enhanced version at any time via a version switcher in the Gallery right panel.

## Scope

**In scope:**
- Rust image-processing pipeline: EXIF auto-orient, auto levels, vibrance boost, unsharp mask
- `enhance_photo` Tauri command backed by `spawn_blocking`
- `photo_versions` DB table (id, photo_id, kind, storage_path, display_url, created_at, file_size_mb)
- `PhotoVersion` TypeScript model
- `autoEnhanceEnabled` toggle on `ImageStream` and `Photo`
- `activeVersionKind` tracking on `Photo`
- `enhancementService.ts` TypeScript bridge
- Pipeline integration: fire-and-forget enhance after watched-folder import
- `StreamSetupDialog` Auto Enhance toggle
- Gallery right panel: Original / Enhanced pill switcher
- Photo tile enhancement status badge (spinner / sparkles / alert-triangle)

**Out of scope (Phase 11+ candidates):**
- Background removal
- RAW file support (CR2, NEF, ARW)
- Per-photo manual enhance trigger from UI
- Batch re-enhance existing photos
- Adjustable enhancement intensity slider
- Noise reduction
- AI/ML enhancement models
- EXIF metadata preservation in enhanced output

## Implementation Tasks

- [x] `enhance.rs` with 5-step pipeline (Step 0: auto-orient, Steps 1–3: levels/vibrance/sharpen, Step 4: save)
- [x] `enhance_photo` Tauri command in `lib.rs`
- [x] `PhotoVersion` model + DB migrations 8 + 9
- [x] `photo_versions` store methods (addPhotoVersion, getPhotoVersions, setActiveVersion, deletePhotoVersionsByPhotoId)
- [x] `enhancementService.ts`
- [x] `autoImportPipeline.ts` integration
- [x] `ImageStream.autoEnhanceEnabled` in model, migration, store, repository, StreamSetupDialog
- [x] Tile enhancement status badge (GalleryRight PreviewThumb)
- [x] GalleryRight version switcher
- [x] AppContext additions (getPhotoVersions, switchPhotoVersion)

## Validation Commands

```bash
cd src-tauri && cargo check          # Rust must compile cleanly
npm run typecheck                    # 0 TS errors
npm run lint                         # 0 lint errors
npm run test                         # 12/12 tests still passing
npm run dev                          # browser mode: no enhancement, UI handles gracefully
```

Manual Tauri mode checks:
- Create a stream with Auto Enhance toggled ON
- Drop a JPEG into the watch folder
- Photo appears immediately in session with `processingStatus: 'pending'`
- Tile spinner appears briefly, then sparkles icon
- GalleryRight version switcher appears with Original / Enhanced pills
- Switching to Original shows the unprocessed file
- Switching to Enhanced shows the enhanced file
- Workshop before/after slider shows original (left) vs enhanced (right)
- Drop a portrait JPEG taken with a phone or DSLR (EXIF orientation ≠ 1) — enhanced output appears upright
- Delete photo — enhanced file removed from disk along with original
- Create a stream with Auto Enhance toggled OFF — no enhancement runs

## Known Limitations

- Enhancement is JPEG/PNG only — RAW files are silently skipped with a console warning
- EXIF orientation is applied to pixels; the enhanced output JPEG does not preserve the original EXIF metadata block (camera model, GPS, shutter speed are stripped)
- The 2%/98% auto-levels clip may over-process intentionally low-key or high-key images; per-stream intensity setting is a Phase 11 candidate
- No undo beyond "switch to original" — destructive re-enhancement is prevented by always keeping the original
- Enhancement runs after import so the first moment the photo appears it will be at `processingStatus: 'pending'`; tile updates a second or two later
- Browser mode: `enhancementService` is a no-op; photos remain `processingStatus: 'pending'`

## Acceptance Criteria

- [ ] `cargo check` passes with no errors
- [ ] `npm run typecheck` returns 0 errors
- [ ] `npm run lint` returns 0 errors
- [ ] `npm run test` passes 12/12 tests
- [ ] JPEG dropped into an Auto Enhance stream produces `_enhanced.jpg` next to the original
- [ ] Gallery right panel shows version switcher for enhanced photos
- [ ] Original ↔ Enhanced toggle updates the displayed image
- [ ] Deleting an enhanced photo also removes the `_enhanced.jpg` from disk
- [ ] Stream with Auto Enhance OFF produces no version records
