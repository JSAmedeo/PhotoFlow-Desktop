import type { Photo } from '../data/models';
import type { PhotoStorageService, SavePhotoContext, SavedPhotoReference } from './photoStorage';
import { FALLBACK_PHOTO_SOURCE } from './photoStorage';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result);
      else reject(new Error('FileReader returned an unsupported result.'));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

export const browserPhotoStorage: PhotoStorageService = {
  async saveImportedPhoto(file: File, context: SavePhotoContext): Promise<SavedPhotoReference> {
    const dataUrl = await readFileAsDataUrl(file);

    return {
      storageKind: 'browser-data-url',
      displayUrl: dataUrl,
      originalFilename: context.originalFilename,
      sizeBytes: file.size,
    };
  },

  async resolvePhotoSource(photo: Photo): Promise<string> {
    return photo.displayUrl || photo.thumbnailUrl || photo.beforeImageUrl || FALLBACK_PHOTO_SOURCE;
  },

  async deletePhotoSource() {
    // Browser imports are embedded in metadata as data URLs, so deleting metadata removes the payload.
  },

  async clearManagedPhotoStorage() {
    // Browser mode has no managed filesystem storage.
  },
};
