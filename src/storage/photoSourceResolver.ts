import type { Photo } from '../data/models';
import { getPhotoStorageService } from './photoStorageFactory';

export async function resolvePhotoSource(photo: Photo): Promise<string> {
  return getPhotoStorageService().resolvePhotoSource(photo);
}

export async function resolvePhotoSources(photos: Photo[]): Promise<Photo[]> {
  // Browser-mode photos already have their URLs embedded — skip the async map entirely.
  if (photos.length === 0 || !photos.some(p => p.storageKind === 'tauri-managed-file')) {
    return photos;
  }

  return Promise.all(photos.map(async photo => {
    if (photo.storageKind === 'tauri-managed-file') {
      // storagePath is always the original file. beforeImageUrl must always point to it.
      // displayUrl/afterImageUrl/thumbnailUrl may already be correct Tauri asset URLs
      // (e.g. enhanced version path written by enhancementService) — trust them if set.
      const originalUrl = await resolvePhotoSource(photo);
      return {
        ...photo,
        beforeImageUrl: originalUrl,
        thumbnailUrl: photo.thumbnailUrl || originalUrl,
        displayUrl: photo.displayUrl || originalUrl,
        afterImageUrl: photo.afterImageUrl || originalUrl,
      };
    }

    return photo;
  }));
}
