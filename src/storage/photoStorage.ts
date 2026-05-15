import type { Photo, PhotoStorageKind } from '../data/models';

export interface SavePhotoContext {
  sessionKey: string;
  photoId: string;
  originalFilename: string;
  sourceType?: 'manual-picker' | 'watched-folder';
  streamName?: string;
  captureLocationSlug?: string;
  importedAt?: string;
}

export interface SavedPhotoReference {
  storageKind: PhotoStorageKind;
  displayUrl: string;
  relativePath?: string;
  managedOriginalPath?: string;
  originalFilename: string;
  sizeBytes: number;
}

export interface PhotoStorageService {
  saveImportedPhoto(file: File, context: SavePhotoContext): Promise<SavedPhotoReference>;
  resolvePhotoSource(photo: Photo): Promise<string>;
  deletePhotoSource(photo: Photo): Promise<void>;
}

export const FALLBACK_PHOTO_SOURCE = '/demo-assets/before.jpg';

export function readImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({ width: 0, height: 0 });
    image.src = src;
  });
}
