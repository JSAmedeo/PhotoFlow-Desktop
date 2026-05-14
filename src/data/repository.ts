// Data access layer for PhotoFlow Desktop.
// Components and context import from here; storage details stay behind metadata stores.

import type {
  CaptureLocation,
  HourBucket,
  ImportedFileMetadata,
  ImportQueueItem,
  Photo,
  Session,
  TabKey,
  WatchedFolderSettings,
} from './models';
import { getPhotoStorageService } from '../storage/photoStorageFactory';
import { readImageDimensions, type SavedPhotoReference } from '../storage/photoStorage';
import { initializeMetadataStore, getMetadataStore } from './stores/metadataStoreFactory';

function isPhoto(value: Photo | undefined): value is Photo {
  return value !== undefined;
}

// ----- Initialization --------------------------------------------------------

export async function initStore(): Promise<void> {
  await initializeMetadataStore();
}

// Clears all metadata and re-seeds from scratch.
// In Tauri mode this resets SQLite metadata only; managed imported files are not deleted.
export async function resetDemoData(): Promise<Session[]> {
  return (await getMetadataStore()).resetDemoData();
}

// ----- Sessions --------------------------------------------------------------

export async function getSessions(): Promise<Session[]> {
  return (await getMetadataStore()).getSessions();
}

export async function getSessionById(id: string): Promise<Session | undefined> {
  return (await getMetadataStore()).getSessionById(id);
}

export async function updateSessionMetadata(
  id: string,
  changes: Partial<Pick<Session, 'status' | 'notes' | 'linkedSessionIds' | 'updatedAt'>>,
): Promise<Session | undefined> {
  return (await getMetadataStore()).updateSessionMetadata(id, changes);
}

// ----- Photos ----------------------------------------------------------------

export async function getPhotos(): Promise<Photo[]> {
  return (await getMetadataStore()).getPhotos();
}

export async function getPhotosBySessionId(sessionId: string): Promise<Photo[]> {
  return (await getMetadataStore()).getPhotosBySessionId(sessionId);
}

export async function getPhotoById(id: string): Promise<Photo | undefined> {
  return (await getMetadataStore()).getPhotoById(id);
}

export async function updatePhotoMetadata(
  id: string,
  changes: Partial<Pick<Photo, 'flag' | 'isFavorite' | 'isHidden' | 'operatorNotes' | 'processingStatus'>>,
): Promise<Photo | undefined> {
  return (await getMetadataStore()).updatePhotoMetadata(id, changes);
}

export async function deletePhotos(photoIds: string[]): Promise<void> {
  const uniqueIds = Array.from(new Set(photoIds));
  if (uniqueIds.length === 0) return;

  const store = await getMetadataStore();
  const photos = (await Promise.all(uniqueIds.map(id => store.getPhotoById(id)))).filter(isPhoto);
  await store.deletePhotos(uniqueIds);

  const storage = getPhotoStorageService();
  await Promise.all(photos.map(photo => storage.deletePhotoSource(photo)));
}

// ----- Import / ingest -------------------------------------------------------

export async function getImportQueue(): Promise<ImportQueueItem[]> {
  return (await getMetadataStore()).getImportQueue();
}

export async function addImportQueueItem(item: ImportQueueItem): Promise<void> {
  await (await getMetadataStore()).addImportQueueItem(item);
}

export async function updateImportQueueItem(
  itemId: string,
  changes: Partial<ImportQueueItem>,
): Promise<void> {
  await (await getMetadataStore()).updateImportQueueItem(itemId, changes);
}

export async function getWatchedFolderSettings(): Promise<WatchedFolderSettings> {
  return (await getMetadataStore()).getWatchedFolderSettings();
}

export async function setWatchedFolderSettings(settings: WatchedFolderSettings): Promise<void> {
  await (await getMetadataStore()).setWatchedFolderSettings(settings);
}

export async function clearCompletedImports(): Promise<void> {
  await (await getMetadataStore()).clearCompletedImports();
}

export async function clearImportQueue(): Promise<void> {
  await (await getMetadataStore()).clearImportQueue();
}

async function isDuplicateImport(sessionId: string, file: File, photos = getPhotos()): Promise<boolean> {
  const resolvedPhotos = await photos;
  return resolvedPhotos.some(photo => {
    if (photo.sessionId !== sessionId) return false;
    if (photo.importedFile) {
      return (
        photo.importedFile.filename === file.name &&
        photo.importedFile.fileSize === file.size &&
        photo.importedFile.lastModified === file.lastModified
      );
    }
    return photo.filename === file.name;
  });
}

function makeImportedPhoto(
  session: Session,
  file: File,
  photoId: string,
  savedPhoto: SavedPhotoReference,
  dimensions: { width: number; height: number },
  source: {
    sourceType: Photo['sourceType'];
    sourcePath?: string;
    importedAt: string;
  },
): Photo {
  const metadata: ImportedFileMetadata = {
    filename: file.name,
    fileSize: file.size,
    lastModified: file.lastModified,
    mimeType: file.type,
  };
  const extension = file.name.split('.').pop()?.toUpperCase() || file.type.replace('image/', '').toUpperCase() || 'IMAGE';

  return {
    id: photoId,
    sessionId: session.id,
    filename: file.name,
    thumbnailUrl: savedPhoto.displayUrl,
    displayUrl: savedPhoto.displayUrl,
    beforeImageUrl: savedPhoto.displayUrl,
    afterImageUrl: savedPhoto.displayUrl,
    createdAt: source.importedAt,
    captureLocationId: session.captureLocationId,
    processingStatus: 'pending',
    flag: 'none',
    isFavorite: false,
    isHidden: false,
    operatorNotes: 'Imported via file picker.',
    enhanceVersion: 'unprocessed',
    width: dimensions.width,
    height: dimensions.height,
    fileSizeMb: Number((file.size / (1024 * 1024)).toFixed(2)),
    fileFormat: extension,
    originalPath: savedPhoto.relativePath ?? `Imported/${file.name}`,
    storageKind: savedPhoto.storageKind,
    storagePath: savedPhoto.relativePath,
    sourceType: source.sourceType,
    sourcePath: source.sourcePath,
    managedOriginalPath: savedPhoto.managedOriginalPath ?? savedPhoto.relativePath,
    importedAt: source.importedAt,
    originalFilename: savedPhoto.originalFilename,
    sizeBytes: savedPhoto.sizeBytes,
    lastModified: file.lastModified,
    importedFile: metadata,
  };
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'watched-folder';
}

export async function addPhotoToSession(sessionId: string, photo: Photo): Promise<Photo> {
  return (await getMetadataStore()).addPhotoToSession(sessionId, photo);
}

export async function importPhotosToSession(sessionId: string, files: File[]): Promise<Photo[]> {
  const session = await getSessionById(sessionId);
  if (!session) throw new Error('No active session selected.');

  const imported: Photo[] = [];

  for (const file of files) {
    const queueItem: ImportQueueItem = {
      id: `iq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      filename: file.name,
      sessionId,
      status: 'queued',
      progress: 0,
      fileSize: file.size,
      lastModified: file.lastModified,
      createdAt: new Date().toISOString(),
    };
    await addImportQueueItem(queueItem);

    if (!file.type.startsWith('image/')) {
      await updateImportQueueItem(queueItem.id, {
        status: 'failed',
        progress: 100,
        error: 'Unsupported file type. Choose an image file.',
        completedAt: new Date().toISOString(),
      });
      continue;
    }

    if (await isDuplicateImport(sessionId, file)) {
      await updateImportQueueItem(queueItem.id, {
        status: 'skipped',
        progress: 100,
        error: 'Already imported for this session.',
        completedAt: new Date().toISOString(),
      });
      continue;
    }

    try {
      await updateImportQueueItem(queueItem.id, { status: 'importing', progress: 35 });
      const photoId = `imp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const importedAt = new Date().toISOString();
      const savedPhoto = await getPhotoStorageService().saveImportedPhoto(file, {
        sessionKey: session.sessionCode || session.id,
        photoId,
        originalFilename: file.name,
        sourceType: 'manual-picker',
        captureLocationSlug: slugify(session.captureLocationLabel || session.captureLocationId),
        importedAt,
      });
      await updateImportQueueItem(queueItem.id, { progress: 65 });
      const dimensions = await readImageDimensions(savedPhoto.displayUrl);
      await updateImportQueueItem(queueItem.id, { progress: 80 });
      const photo = await addPhotoToSession(sessionId, makeImportedPhoto(session, file, photoId, savedPhoto, dimensions, {
        sourceType: 'manual-picker',
        importedAt,
      }));
      imported.push(photo);
      await updateImportQueueItem(queueItem.id, {
        status: 'complete',
        progress: 100,
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      await updateImportQueueItem(queueItem.id, {
        status: 'failed',
        progress: 100,
        error: error instanceof Error ? error.message : 'Import failed.',
        completedAt: new Date().toISOString(),
      });
    }
  }

  return imported;
}

export async function importWatchedPhotoToSession(
  sessionId: string,
  file: File,
  sourcePath: string,
  queueItemId?: string,
): Promise<Photo | undefined> {
  const session = await getSessionById(sessionId);
  if (!session) throw new Error('No active session selected.');

  const queueItem: ImportQueueItem = {
    id: queueItemId ?? `iq-watch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    filename: file.name,
    sessionId,
    status: 'queued',
    progress: 0,
    fileSize: file.size,
    lastModified: file.lastModified,
    sourceType: 'watched-folder',
    sourcePath,
    sourceFilename: file.name,
    detectedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  await addImportQueueItem(queueItem);

  if (await isDuplicateImport(sessionId, file)) {
    await updateImportQueueItem(queueItem.id, {
      status: 'skipped',
      progress: 100,
      error: 'Already imported for this session.',
      completedAt: new Date().toISOString(),
    });
    return undefined;
  }

  try {
    await updateImportQueueItem(queueItem.id, { status: 'importing', progress: 35 });
    const photoId = `watch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const importedAt = new Date().toISOString();
    const savedPhoto = await getPhotoStorageService().saveImportedPhoto(file, {
      sessionKey: session.sessionCode || session.id,
      photoId,
      originalFilename: file.name,
      sourceType: 'watched-folder',
      captureLocationSlug: slugify(session.captureLocationLabel || session.captureLocationId),
      importedAt,
    });
    await updateImportQueueItem(queueItem.id, { progress: 65 });
    const dimensions = await readImageDimensions(savedPhoto.displayUrl);
    await updateImportQueueItem(queueItem.id, { progress: 80 });
    const photo = await addPhotoToSession(sessionId, makeImportedPhoto(session, file, photoId, savedPhoto, dimensions, {
      sourceType: 'watched-folder',
      sourcePath,
      importedAt,
    }));
    await updateImportQueueItem(queueItem.id, {
      status: 'complete',
      progress: 100,
      photoId,
      destinationPath: savedPhoto.managedOriginalPath ?? savedPhoto.relativePath,
      importedAt,
      completedAt: new Date().toISOString(),
    });
    return photo;
  } catch (error) {
    await updateImportQueueItem(queueItem.id, {
      status: 'failed',
      progress: 100,
      error: error instanceof Error ? error.message : 'Watched-folder import failed.',
      completedAt: new Date().toISOString(),
    });
    return undefined;
  }
}

// ----- Locations & Hours -----------------------------------------------------

export async function getLocations(): Promise<CaptureLocation[]> {
  return (await getMetadataStore()).getLocations();
}

export async function getHours(): Promise<HourBucket[]> {
  return (await getMetadataStore()).getHours();
}

// ----- Persisted UI state ----------------------------------------------------

export async function getSelectedSessionId(): Promise<string> {
  return (await getMetadataStore()).getSelectedSessionId();
}

export async function setSelectedSessionId(id: string): Promise<void> {
  await (await getMetadataStore()).setSelectedSessionId(id);
}

export async function getSelectedPhotoId(): Promise<string> {
  return (await getMetadataStore()).getSelectedPhotoId();
}

export async function setSelectedPhotoId(id: string): Promise<void> {
  await (await getMetadataStore()).setSelectedPhotoId(id);
}

export async function getActiveTab(): Promise<TabKey> {
  return (await getMetadataStore()).getActiveTab();
}

export async function setActiveTab(tab: TabKey): Promise<void> {
  await (await getMetadataStore()).setActiveTab(tab);
}

export async function getSelectedHour(): Promise<string> {
  return (await getMetadataStore()).getSelectedHour();
}

export async function setSelectedHour(h: string): Promise<void> {
  await (await getMetadataStore()).setSelectedHour(h);
}
