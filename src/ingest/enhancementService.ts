import type { Photo, PhotoVersion } from '../data/models';
import { addPhotoVersion, updatePhotoMetadata } from '../data/repository';
import { isTauriRuntime } from '../runtime/runtime';

const SUPPORTED_ENHANCE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

// Enhancement holds several full-resolution pixel buffers in Rust at peak, so a
// 50-file burst must not spawn 50 concurrent jobs. Two in flight keeps memory
// bounded while still overlapping decode/encode with compute.
const MAX_CONCURRENT_ENHANCEMENTS = 2;

// Sanity ceiling: a source file this large is not a venue photo. Skip enhancement
// rather than decoding it into memory; the photo stays usable at its original.
const MAX_ENHANCE_FILE_MB = 100;

let activeJobs = 0;
const waitingJobs: Array<() => void> = [];

async function acquireEnhancementSlot(): Promise<void> {
  if (activeJobs < MAX_CONCURRENT_ENHANCEMENTS) {
    activeJobs += 1;
    return;
  }
  await new Promise<void>(resolve => waitingJobs.push(resolve));
}

function releaseEnhancementSlot(): void {
  const next = waitingJobs.shift();
  // Handing the slot to a waiter keeps activeJobs constant; only an idle release
  // decrements it.
  if (next) next();
  else activeJobs -= 1;
}

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

// Requested output path for an enhanced version. The Rust side may adjust the
// extension (alpha PNGs stay PNG) — always trust the path the command returns.
export function enhancedOutputPath(storagePath: string): string {
  const dot = storagePath.lastIndexOf('.');
  const stem = dot >= 0 ? storagePath.slice(0, dot) : storagePath;
  return `${stem}_enhanced.jpg`;
}

async function fileSizeMbOf(path: string): Promise<number> {
  try {
    const { stat } = await import('@tauri-apps/plugin-fs');
    const info = await stat(path);
    return Number((info.size / (1024 * 1024)).toFixed(2));
  } catch {
    return 0;
  }
}

export async function enhanceImportedPhoto(
  photo: Photo,
  storagePath: string,
  options?: { brightness?: number; contrast?: number; saturation?: number; sharpen?: number },
): Promise<void> {
  if (!isTauriRuntime()) return;

  const ext = extensionOf(photo.filename);
  if (!SUPPORTED_ENHANCE_EXTENSIONS.has(ext)) {
    console.warn(`[PhotoFlow] Skipping enhancement for unsupported format: ${photo.filename}`);
    return;
  }

  if (photo.fileSizeMb > MAX_ENHANCE_FILE_MB) {
    console.warn(`[PhotoFlow] Skipping enhancement for oversized file (${photo.fileSizeMb} MB): ${photo.filename}`);
    await updatePhotoMetadata(photo.id, { processingStatus: 'done' });
    return;
  }

  // Queued photos stay 'pending' until a slot frees up; runEnhancement flips them
  // to 'processing' when work actually starts, so the UI progresses tile by tile.
  await acquireEnhancementSlot();
  try {
    await runEnhancement(photo, storagePath, options);
  } finally {
    releaseEnhancementSlot();
  }
}

async function runEnhancement(
  photo: Photo,
  storagePath: string,
  options?: { brightness?: number; contrast?: number; saturation?: number; sharpen?: number },
): Promise<void> {
  await updatePhotoMetadata(photo.id, { processingStatus: 'processing' });

  try {
    const { invoke, convertFileSrc } = await import('@tauri-apps/api/core');

    // brightness/contrast are stored as -30..+30 integers (percent); Rust expects fractions (0.05 = 5%).
    // saturation is already a multiplier (1.08 = 8% boost); sharpen is already a fraction (0.25).
    // The returned path is authoritative: alpha PNG sources come back as _enhanced.png.
    const actualOutputPath = await invoke<string>('enhance_photo', {
      inputPath: storagePath,
      outputPath: enhancedOutputPath(storagePath),
      brightness: (options?.brightness ?? 0) / 100,
      contrast: (options?.contrast ?? 0) / 100,
      saturation: options?.saturation ?? 1.08,
      sharpen: options?.sharpen ?? 0.25,
    });

    const enhancedDisplayUrl = convertFileSrc(actualOutputPath);
    const originalDisplayUrl = photo.displayUrl;

    const now = new Date().toISOString();

    const originalVersion: PhotoVersion = {
      id: `pv-${photo.id}-original`,
      photoId: photo.id,
      kind: 'original',
      storagePath,
      displayUrl: originalDisplayUrl,
      createdAt: now,
      fileSizeMb: photo.fileSizeMb,
    };

    const enhancedVersion: PhotoVersion = {
      id: `pv-${photo.id}-enhanced`,
      photoId: photo.id,
      kind: 'enhanced',
      storagePath: actualOutputPath,
      displayUrl: enhancedDisplayUrl,
      createdAt: now,
      fileSizeMb: await fileSizeMbOf(actualOutputPath),
    };

    await addPhotoVersion(originalVersion);
    await addPhotoVersion(enhancedVersion);

    await updatePhotoMetadata(photo.id, {
      processingStatus: 'done',
      afterImageUrl: enhancedDisplayUrl,
      displayUrl: enhancedDisplayUrl,
      thumbnailUrl: enhancedDisplayUrl,
      activeVersionKind: 'enhanced',
    });
  } catch (error) {
    console.error('[PhotoFlow] Enhancement failed for', photo.filename, error);
    await updatePhotoMetadata(photo.id, { processingStatus: 'error' });
  }
}
