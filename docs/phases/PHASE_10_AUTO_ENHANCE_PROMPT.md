# Phase 10 — Auto Image Enhancement

## Context and goals

You are implementing the auto image enhancement feature for PhotoFlow Desktop. This is the highest-priority stakeholder request and must produce something demonstrably working at the end of this phase.

Read `CLAUDE.md` fully before starting. Create `docs/phases/PHASE_10_AUTO_ENHANCE.md` following the Phase Checklist Rule.

---

## First step — create a feature branch

Before touching any code or files, create and check out a new branch:

```bash
git checkout main
git pull
git checkout -b feature/phase-10-auto-enhance
```

All work for this phase happens on `feature/phase-10-auto-enhance`. Do not commit directly to `main`. Make logical, incremental commits as you complete each section — for example, one commit for the Rust pipeline, one for the data model and migrations, one for the TypeScript service and pipeline integration, and one for the UI changes. Commit messages should follow the project's existing convention.

When the phase is complete and all validation checks pass, the branch is ready for review and merge into `main`.

**The core workflow:**
- Each image stream gets a new toggle: **Auto Enhance**
- When enabled, every photo imported through that stream is automatically enhanced after the original is saved
- The original file is always preserved — operators can revert at any time
- Photos show a single thumbnail in the session (not two). Enhancement is tracked as a **version history** on the photo, not as a separate photo record
- The UI reflects enhancement state (pending, processing, done, failed) inline on the photo tile

---

## Processing stack — use these specific libraries

All image processing runs in Rust inside the Tauri backend. No JavaScript image processing.

Add to `src-tauri/Cargo.toml`:

```toml
image = "0.25"
imageproc = "0.25"
rayon = "1.10"
kamadak-exif = "0.5"
```

`image` handles decode/encode for JPEG, PNG, WebP. `imageproc` provides the algorithmic primitives. `rayon` provides multi-threaded pixel iteration where needed. `kamadak-exif` reads EXIF orientation tags — the `image` crate does not apply EXIF orientation automatically on decode, so without this, portrait shots from DSLRs and camera phones arrive rotated 90°.

**Do not add** `photon`, `fast_image_resize`, or any ML/ONNX dependency for this phase. The enhancement pipeline is classical signal processing only.

---

## Enhancement pipeline — implement exactly this sequence

The Rust function `enhance_image(input_path, output_path)` applies these steps in order:

### Step 0 — Auto-orient (EXIF rotation)

Read the EXIF `Orientation` tag from the file before decoding the full image. If the orientation indicates the image is rotated or flipped, apply the corresponding transform to the decoded pixels so the output is always correctly upright.

```rust
use kamadak_exif::{In, Tag, Reader};

fn read_exif_orientation(path: &str) -> u32 {
    let file = std::fs::File::open(path).ok()?;
    let mut bufreader = std::io::BufReader::new(file);
    let exif = Reader::new().read_from_container(&mut bufreader).ok()?;
    exif.get_field(Tag::Orientation, In::PRIMARY)
        .and_then(|f| f.value.get_uint(0))
        .unwrap_or(1)
}
```

Map orientation values to `image::imageops` transforms:

| EXIF value | Transform |
|------------|-----------|
| 1 | None (already upright) |
| 2 | Flip horizontal |
| 3 | Rotate 180° |
| 4 | Flip vertical |
| 5 | Rotate 90° CW + flip horizontal |
| 6 | Rotate 90° CW |
| 7 | Rotate 90° CCW + flip horizontal |
| 8 | Rotate 90° CCW |

Apply using `imageops::rotate90`, `imageops::rotate180`, `imageops::rotate270`, and `imageops::flip_horizontal` from the `image` crate. For the compound cases (5, 7), apply the rotation first then the flip.

This step is mandatory regardless of whether the file needs any colour correction. A portrait shot that appears sideways in the app is a hard blocker for stakeholder demos. Files without EXIF data (orientation = 1) pass through this step unchanged.

### Step 1 — Auto levels (per-channel stretch)

For each RGB channel independently:
1. Build a histogram of the channel's pixel values (0–255)
2. Find the 2nd percentile value (low clip) and 98th percentile value (high clip) — this clips 2% of pixels at each end, ignoring noise and blown highlights
3. Apply a linear stretch: `output = clamp((input - low) / (high - low) * 255, 0, 255)`

This corrects flat, washed-out, or colour-cast images and is the single highest-impact operation for souvenir photography.

Implementation note: operate on `image::DynamicImage` decoded to `RgbImage`. Iterate pixels with `rayon::par_iter_mut` on the raw buffer for performance. A 12 MP image should complete Step 1 in under 200 ms on a modern laptop CPU.

### Step 2 — Vibrance boost (selective saturation)

Convert to HSV. For pixels where the existing saturation (S channel) is below 0.7, increase saturation by a multiplier of `1.25`, clamped to 1.0. Pixels that are already highly saturated are left alone — this is the key difference from flat saturation increase, which over-saturates skies and grass.

Implementation note: process pixel-by-pixel in HSV space. Use `image`'s `Rgb<u8>` to HSV conversion. This step is deliberately light — it lifts muted skin tones and clothing without making the image look processed.

### Step 3 — Gentle sharpening

Apply a 3×3 unsharp mask with `sigma = 1.0` and `amount = 0.4`:
1. Gaussian blur the image with sigma 1.0 (use `imageproc::filter::gaussian_blur_f32`)
2. For each pixel: `output = clamp(original + amount * (original - blurred), 0, 255)`

This recovers detail lost in JPEG compression from camera sensors. Keep `amount` at 0.4 — stronger values introduce halos on portrait subjects.

### Step 4 — Save enhanced output

- Save as JPEG quality 92 to a path derived from the original:
  `<original_dir>/<original_stem>_enhanced.jpg`
- Return the output path as a `String` on success, or an error string on failure

### What this does NOT do
- No cropping or composition change (out of scope — no reliable way to do this locally without ML)
- No noise reduction (adds significant processing time and complexity, Phase 11 candidate)
- No face detection or skin-tone awareness (Phase 11 candidate)
- No RAW file support — JPEG and PNG only for this phase

---

## Data model changes

### 1. `PhotoVersion` — new model in `src/data/models.ts`

```ts
export type PhotoVersionKind = 'original' | 'enhanced' | 'bg-removed';

export interface PhotoVersion {
  id: string;           // e.g. "pv-<photoId>-original", "pv-<photoId>-enhanced"
  photoId: string;
  kind: PhotoVersionKind;
  storagePath: string;  // absolute path on disk
  displayUrl: string;   // asset:// URL for display
  createdAt: string;
  fileSizeMb: number;
}
```

### 2. `Photo` model additions in `src/data/models.ts`

Add these fields to the `Photo` interface:

```ts
autoEnhanceEnabled?: boolean;         // whether this photo was imported with enhance toggled on
activeVersionKind?: PhotoVersionKind; // which version is currently displayed ('original' | 'enhanced')
```

Note: `processingStatus` already exists on `Photo` (`'pending' | 'processing' | 'done' | 'warn' | 'error'`). Use it — do not add a separate enhance status field.

### 3. `ImageStream` model addition in `src/data/models.ts`

```ts
autoEnhanceEnabled?: boolean;
```

### 4. New `photo_versions` table — add migration in `src/data/db/migrations.ts`

Follow the exact same pattern as existing migrations. Add a new migration entry:

```ts
{
  name: 'photo_versions_table',
  up: [
    `CREATE TABLE IF NOT EXISTS photo_versions (
      id TEXT PRIMARY KEY,
      photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
      kind TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      display_url TEXT NOT NULL,
      created_at TEXT NOT NULL,
      file_size_mb REAL NOT NULL DEFAULT 0
    )`,
    'CREATE INDEX IF NOT EXISTS idx_photo_versions_photo_id ON photo_versions(photo_id)',
  ],
},
{
  name: 'photo_auto_enhance_fields',
  up: [
    'ALTER TABLE photos ADD COLUMN auto_enhance_enabled INTEGER DEFAULT 0',
    'ALTER TABLE photos ADD COLUMN active_version_kind TEXT DEFAULT \'original\'',
    'ALTER TABLE image_streams ADD COLUMN auto_enhance_enabled INTEGER DEFAULT 0',
  ],
},
```

### 5. `sqliteMetadataStore.ts` additions

Add row type `PhotoVersionRow` and implement these four methods on the metadata store interface and SQLite implementation:

```ts
addPhotoVersion(version: PhotoVersion): Promise<void>
getPhotoVersions(photoId: string): Promise<PhotoVersion[]>
setActiveVersion(photoId: string, kind: PhotoVersionKind): Promise<void>
deletePhotoVersionsByPhotoId(photoId: string): Promise<void>   // called on photo delete
```

Also update `upsertPhoto` to persist `auto_enhance_enabled` and `active_version_kind`, and update `rowToPhoto` to read them back.

Update `deletePhoto` to call `deletePhotoVersionsByPhotoId` before deleting the photo row — the `ON DELETE CASCADE` handles it at DB level, but also remove the enhanced file from disk using `std::fs::remove_file` via a new Rust command (see below) or the existing `remove` from `tauri-plugin-fs`.

---

## New Rust command — `enhance_photo`

**File:** `src-tauri/src/lib.rs`

```rust
#[tauri::command]
async fn enhance_photo(input_path: String, output_path: String) -> Result<String, String> {
    tokio::task::spawn_blocking(move || {
        enhance_image(&input_path, &output_path)
            .map_err(|e| e.to_string())
    })
    .await
    .map_err(|e| e.to_string())?
}
```

The `enhance_image` function lives in a new file `src-tauri/src/enhance.rs` (use `mod enhance;` in `lib.rs`). It takes `input_path: &str` and `output_path: &str`, applies the five-step pipeline above (Step 0 through Step 4), and returns `Result<String, Box<dyn std::error::Error>>`.

`spawn_blocking` is mandatory — the image processing is CPU-bound and must not block the Tauri async executor.

Register `enhance_photo` in `invoke_handler`.

---

## TypeScript enhancement service — `src/ingest/enhancementService.ts`

Create this new file. It bridges the import pipeline to the Rust command and updates the database.

```ts
export async function enhanceImportedPhoto(
  photo: Photo,
  storagePath: string,
): Promise<void>
```

**What it does:**
1. Derives the output path: same directory as `storagePath`, filename `<stem>_enhanced.jpg`
2. Updates `photo.processingStatus` to `'processing'` via `updatePhoto`
3. Invokes the Rust command: `invoke('enhance_photo', { inputPath: storagePath, outputPath })`
4. On success:
   - Calls `convertFileSrc(outputPath)` to get the display URL
   - Creates a `PhotoVersion` record for the original: `{ kind: 'original', storagePath, displayUrl: photo.displayUrl }`
   - Creates a `PhotoVersion` record for the enhanced: `{ kind: 'enhanced', storagePath: outputPath, displayUrl: convertFileSrc(outputPath) }`
   - Updates the photo: `processingStatus: 'done'`, `afterImageUrl: enhancedDisplayUrl`, `displayUrl: enhancedDisplayUrl`, `thumbnailUrl: enhancedDisplayUrl`, `activeVersionKind: 'enhanced'`
   - Calls `addPhotoVersion` for both versions
5. On failure:
   - Updates `photo.processingStatus` to `'error'`
   - Does not create version records — the original is still accessible

Keep this service Tauri-only. Guard the `invoke` call with `isTauriRuntime()` and return early (no-op) in browser mode.

---

## Integration into the import pipeline

**File:** `src/ingest/autoImportPipeline.ts`

The `imageStream` object passed to `autoImportWatchedFile` needs to carry `autoEnhanceEnabled`. Update its type to include this field.

After a successful `importWatchedPhotoToSession` call, if `imageStream.autoEnhanceEnabled` and the returned photo has a valid `storagePath`, call `enhancementService.enhanceImportedPhoto(photo, photo.storagePath)` — fire and forget with `void`:

```ts
if (imageStream.autoEnhanceEnabled && photo?.storagePath) {
  void enhancementService.enhanceImportedPhoto(photo, photo.storagePath);
}
```

The enhancement runs after the import completes, so the photo appears in the session immediately at `processingStatus: 'pending'`, then updates to `'processing'`, then `'done'`. The queue item shows `'complete'` as soon as the file is saved — enhancement is a separate async step.

Also update `importWatchedPhotoToSession`'s `imageStream` parameter type to include `autoEnhanceEnabled`, and pass it through `makeImportedPhoto` so `photo.autoEnhanceEnabled` is set correctly in the DB.

---

## Stream settings UI — `autoEnhanceEnabled` toggle

**File:** `src/features/streams/StreamSetupDialog.tsx`

Add an `autoEnhanceEnabled` boolean state (default `false`). Add a toggle in the stream settings form, in the same style as the existing `fileRenamingEnabled` toggle. Place it in its own section, directly above the File Renaming section:

```
AUTO ENHANCE
Automatically improve white balance, exposure and saturation on import
[Toggle]
```

Pass it through `createImageStream` / `updateImageStream` in the `save()` call.

---

## Photo version history UI

### Version badge on photo tiles

**File:** `src/components/Tile.tsx` (or wherever `processingStatus` is currently rendered on tiles)

Add visual state for enhancement:
- `processingStatus === 'processing'` — show a small animated spinner icon (`ti-loader-2` spinning) in the tile corner
- `processingStatus === 'done'` and `activeVersionKind === 'enhanced'` — show a small `ti-sparkles` icon in the tile corner (indicates enhanced version is active)
- `processingStatus === 'error'` — show `ti-alert-triangle` in amber

These are subtle indicators, not overlays — small icon in the bottom-right corner of the tile, 12px, with a semi-transparent dark background pill.

### Version switcher in the photo detail panel

**File:** `src/features/gallery/GalleryRight.tsx`

When a selected photo has `processingStatus === 'done'` and has version history (check `photoVersions.length > 0`), show a version switcher below the photo display. Load versions via a new `getPhotoVersions(photoId)` call in `AppContext` or directly in `GalleryRight`.

```
[Original]  [Enhanced ✦]   ← pill toggle, Enhanced active by default after processing
```

Clicking a pill calls a new `switchPhotoVersion(photoId, kind)` function in `AppContext` which:
1. Calls `setActiveVersion(photoId, kind)` on the metadata store
2. Updates the photo in local state: `displayUrl`, `thumbnailUrl`, and `activeVersionKind` to match the selected version's `displayUrl`

The Workshop before/after view already uses `beforeImageUrl` / `afterImageUrl`. After enhancement, `beforeImageUrl` = original `displayUrl`, `afterImageUrl` = enhanced `displayUrl`. These should already display correctly in Workshop without UI changes.

---

## `AppContext` additions

Add:
- `getPhotoVersions(photoId: string): Promise<PhotoVersion[]>` — called by GalleryRight on photo select
- `switchPhotoVersion(photoId: string, kind: PhotoVersionKind): Promise<void>` — updates store + local photo state

Expose these via the context value.

---

## `importWatchedPhotoToSession` stream parameter type

Update the `imageStream` parameter's `Pick<ImageStream, ...>` type to include `'autoEnhanceEnabled'`:

```ts
imageStream?: Pick<ImageStream, 'id' | 'name' | 'slug' | 'code' | 'type' | 'captureLocationId' |
  'fileRenamingEnabled' | 'fileNamingFields' | 'fileNamingSeparator' | 'fileNamingExtension' |
  'autoEnhanceEnabled'>
```

---

## Capabilities

**File:** `src-tauri/capabilities/default.json`

No new permissions are needed. The `fs:allow-write-file` and `fs:allow-read-file` permissions already cover writing the enhanced file next to the original. The broad `fs:scope` covers any path. The `enhance_photo` command is invoked via `core:default`.

---

## Phase checklist structure

Create `docs/phases/PHASE_10_AUTO_ENHANCE.md` with:

- Goal
- Scope
- Implementation tasks (tick as you go):
  - [ ] `enhance.rs` with 5-step pipeline (Step 0: auto-orient, Steps 1–3: levels/vibrance/sharpen, Step 4: save)
  - [ ] `enhance_photo` Tauri command in `lib.rs`
  - [ ] `PhotoVersion` model + DB migration
  - [ ] `photo_versions` store methods
  - [ ] `enhancementService.ts`
  - [ ] `autoImportPipeline.ts` integration
  - [ ] `ImageStream.autoEnhanceEnabled` in model, migration, store, repository, StreamSetupDialog
  - [ ] Tile enhancement status badge
  - [ ] GalleryRight version switcher
  - [ ] AppContext additions
- Known limitations (see below)
- Acceptance criteria

---

## Known limitations to document

- Enhancement is JPEG/PNG only — RAW files (CR2, NEF, ARW) are silently skipped; `enhancementService` should check the extension and return early with a logged warning. Note: auto-orient (Step 0) also only applies to formats that carry EXIF data — PNG files without EXIF pass through Step 0 unchanged
- EXIF orientation is read before decode and applied to pixels; the enhanced output JPEG does not preserve the original EXIF metadata block (tags such as camera model, GPS, shutter speed are stripped). If EXIF preservation is needed it is a Phase 11 task using the `rexiv2` or `little_exif` crate
- The 2%/98% auto-levels clip may over-process images that are intentionally low-key or high-key; a per-stream intensity setting is a Phase 11 candidate
- No undo beyond "switch to original" — destructive re-enhancement is prevented by always keeping the original
- Enhancement runs after import, so the first moment the photo appears in the session it will be at `processingStatus: 'pending'`; operators may notice the tile update a second or two later
- Browser mode: `enhancementService` is a no-op; photos remain `processingStatus: 'pending'` and no version records are created

---

## Validation sequence

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
- Drop a portrait JPEG taken with a phone or DSLR (EXIF orientation ≠ 1) — enhanced output appears upright, not rotated
- Delete photo — enhanced file removed from disk along with original
- Create a stream with Auto Enhance toggled OFF — no enhancement runs, no version records created

---

## Out of scope for this phase

- Background removal (Phase 11)
- RAW file support
- Per-photo manual enhancement trigger from the UI (Phase 11)
- Batch re-enhance existing photos
- Adjustable enhancement intensity slider
- Noise reduction
- AI/ML enhancement models
