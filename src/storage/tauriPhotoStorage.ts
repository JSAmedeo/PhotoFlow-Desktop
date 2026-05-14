import { convertFileSrc } from '@tauri-apps/api/core';
import { join } from '@tauri-apps/api/path';
import { mkdir, remove, writeFile } from '@tauri-apps/plugin-fs';
import type { Photo } from '../data/models';
import type { PhotoStorageService, SavePhotoContext, SavedPhotoReference } from './photoStorage';
import { FALLBACK_PHOTO_SOURCE } from './photoStorage';

const WINDOWS_SUPPORT_STORAGE_ROOT = 'C:\\PhotoFlow Desktop';

function sanitizePathPart(value: string): string {
  const cleaned = value
    .replace(/\.[/\\]/g, '')
    .split('')
    .map(char => (char.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(char) ? '-' : char))
    .join('')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .slice(0, 120);

  return cleaned || 'photo';
}

function datePathParts(value: string): string[] {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return datePathParts(new Date().toISOString());
  return [
    String(date.getFullYear()),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ];
}

function isAbsoluteWindowsPath(path: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(path);
}

function isAbsoluteUnixPath(path: string): boolean {
  return path.startsWith('/');
}

function isSupportedManagedPath(path: string): boolean {
  return isAbsoluteWindowsPath(path) || isAbsoluteUnixPath(path);
}

export const tauriPhotoStorage: PhotoStorageService = {
  async saveImportedPhoto(file: File, context: SavePhotoContext): Promise<SavedPhotoReference> {
    const safeSession = sanitizePathPart(context.sessionKey);
    const safeFilename = sanitizePathPart(context.originalFilename);
    const locationSlug = sanitizePathPart(context.captureLocationSlug ?? 'manual-import');
    const [year, month, day] = datePathParts(context.importedAt ?? new Date().toISOString());
    const folder = await join(
      WINDOWS_SUPPORT_STORAGE_ROOT,
      'photos',
      'imported',
      year,
      month,
      day,
      locationSlug,
      safeSession,
      'originals',
    );
    const storagePath = await join(folder, `${sanitizePathPart(context.photoId)}_${safeFilename}`);
    const bytes = new Uint8Array(await file.arrayBuffer());

    await mkdir(folder, { recursive: true });
    await writeFile(storagePath, bytes);

    return {
      storageKind: 'tauri-managed-file',
      displayUrl: convertFileSrc(storagePath),
      relativePath: storagePath,
      managedOriginalPath: storagePath,
      originalFilename: context.originalFilename,
      sizeBytes: file.size,
    };
  },

  async resolvePhotoSource(photo: Photo): Promise<string> {
    if (photo.storageKind === 'tauri-managed-file' && photo.storagePath && isSupportedManagedPath(photo.storagePath)) {
      return convertFileSrc(photo.storagePath);
    }

    return photo.displayUrl || photo.thumbnailUrl || photo.beforeImageUrl || FALLBACK_PHOTO_SOURCE;
  },

  async deletePhotoSource(photo: Photo): Promise<void> {
    if (photo.storageKind !== 'tauri-managed-file' || !photo.storagePath || !isSupportedManagedPath(photo.storagePath)) return;

    try {
      await remove(photo.storagePath);
    } catch (error) {
      console.warn('[PhotoFlow] Could not remove managed photo file.', error);
    }
  },

  async clearManagedPhotoStorage(): Promise<void> {
    try {
      await remove(WINDOWS_SUPPORT_STORAGE_ROOT, { recursive: true });
    } catch (error) {
      console.warn('[PhotoFlow] Could not remove managed storage root. It may not exist yet.', error);
    }
  },
};
