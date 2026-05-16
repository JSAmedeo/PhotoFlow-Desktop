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
    const resolved = await resolvePhotoSource(photo);

    if (photo.storageKind === 'tauri-managed-file') {
      return {
        ...photo,
        thumbnailUrl: resolved,
        displayUrl: resolved,
        beforeImageUrl: resolved,
        afterImageUrl: resolved,
      };
    }

    return photo;
  }));
}
