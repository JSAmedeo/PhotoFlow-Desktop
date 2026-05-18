import type { Photo, PhotoVersion } from '../data/models';
import { addPhotoVersion, updatePhotoMetadata } from '../data/repository';
import { isTauriRuntime } from '../runtime/runtime';

const SUPPORTED_ENHANCE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png']);

function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot >= 0 ? filename.slice(dot).toLowerCase() : '';
}

function enhancedOutputPath(storagePath: string): string {
  const dot = storagePath.lastIndexOf('.');
  const stem = dot >= 0 ? storagePath.slice(0, dot) : storagePath;
  return `${stem}_enhanced.jpg`;
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

  const outputPath = enhancedOutputPath(storagePath);

  await updatePhotoMetadata(photo.id, { processingStatus: 'processing' });

  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const { convertFileSrc } = await import('@tauri-apps/api/core');

    await invoke<string>('enhance_photo', {
      inputPath: storagePath,
      outputPath,
      brightness: options?.brightness ?? 0,
      contrast: options?.contrast ?? 0,
      saturation: options?.saturation ?? 1.08,
      sharpen: options?.sharpen ?? 0.25,
    });

    const enhancedDisplayUrl = convertFileSrc(outputPath);
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
      storagePath: outputPath,
      displayUrl: enhancedDisplayUrl,
      createdAt: now,
      fileSizeMb: 0,
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
