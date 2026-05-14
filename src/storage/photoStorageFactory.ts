import { getRuntimeMode } from '../runtime/runtime';
import { browserPhotoStorage } from './browserPhotoStorage';
import type { PhotoStorageService } from './photoStorage';
import { tauriPhotoStorage } from './tauriPhotoStorage';

export function getPhotoStorageService(): PhotoStorageService {
  return getRuntimeMode() === 'tauri' ? tauriPhotoStorage : browserPhotoStorage;
}
