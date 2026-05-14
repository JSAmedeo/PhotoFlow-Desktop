import { convertFileSrc } from '@tauri-apps/api/core';
import { appLocalDataDir, join } from '@tauri-apps/api/path';
import { BaseDirectory, mkdir, remove, writeFile } from '@tauri-apps/plugin-fs';
import type { Photo } from '../data/models';
import type { PhotoStorageService, SavePhotoContext, SavedPhotoReference } from './photoStorage';
import { FALLBACK_PHOTO_SOURCE } from './photoStorage';

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

async function absoluteAppLocalPath(relativePath: string): Promise<string> {
  const parts = relativePath.split('/').filter(Boolean);
  return join(await appLocalDataDir(), ...parts);
}

async function displayUrlForRelativePath(relativePath: string): Promise<string> {
  return convertFileSrc(await absoluteAppLocalPath(relativePath));
}

export const tauriPhotoStorage: PhotoStorageService = {
  async saveImportedPhoto(file: File, context: SavePhotoContext): Promise<SavedPhotoReference> {
    const safeSession = sanitizePathPart(context.sessionKey);
    const safeFilename = sanitizePathPart(context.originalFilename);
    const locationSlug = sanitizePathPart(context.captureLocationSlug ?? 'manual-import');
    const [year, month, day] = datePathParts(context.importedAt ?? new Date().toISOString());
    const folder = `photos/imported/${year}/${month}/${day}/${locationSlug}/${safeSession}/originals`;
    const relativePath = `${folder}/${sanitizePathPart(context.photoId)}_${safeFilename}`;
    const bytes = new Uint8Array(await file.arrayBuffer());

    await mkdir(folder, { baseDir: BaseDirectory.AppLocalData, recursive: true });
    await writeFile(relativePath, bytes, { baseDir: BaseDirectory.AppLocalData });

    return {
      storageKind: 'tauri-managed-file',
      displayUrl: await displayUrlForRelativePath(relativePath),
      relativePath,
      managedOriginalPath: relativePath,
      originalFilename: context.originalFilename,
      sizeBytes: file.size,
    };
  },

  async resolvePhotoSource(photo: Photo): Promise<string> {
    if (photo.storageKind === 'tauri-managed-file' && photo.storagePath) {
      return displayUrlForRelativePath(photo.storagePath);
    }

    return photo.displayUrl || photo.thumbnailUrl || photo.beforeImageUrl || FALLBACK_PHOTO_SOURCE;
  },

  async deletePhotoSource(photo: Photo): Promise<void> {
    if (photo.storageKind !== 'tauri-managed-file' || !photo.storagePath) return;

    try {
      await remove(photo.storagePath, { baseDir: BaseDirectory.AppLocalData });
    } catch (error) {
      console.warn('[PhotoFlow] Could not remove managed photo file.', error);
    }
  },
};
