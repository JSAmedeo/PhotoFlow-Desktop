// Data access layer for PhotoFlow Desktop.
// All reads and writes go through this file.
// Components and context import from here — never from localStore.ts directly.

import {
  storeGet, storeSet, storeClearAll, STORE_KEYS,
} from './localStore';
import {
  SEED_SESSIONS, SEED_PHOTOS, SEED_LOCATIONS, SEED_HOURS,
  DEFAULT_SELECTED_SESSION_ID, DEFAULT_SELECTED_HOUR,
} from './seedData';
import type {
  Session, Photo, CaptureLocation, HourBucket, TabKey, ImportQueueItem, ImportedFileMetadata,
} from './models';

// ----- Initialization --------------------------------------------------------

// Called once on app start. Writes seed data if localStorage is empty.
export function initStore(): void {
  if (storeGet(STORE_KEYS.sessions) === null) {
    seedStore();
  }
}

function seedStore(): void {
  storeSet(STORE_KEYS.sessions,          SEED_SESSIONS);
  storeSet(STORE_KEYS.photos,            SEED_PHOTOS);
  storeSet(STORE_KEYS.locations,         SEED_LOCATIONS);
  storeSet(STORE_KEYS.hours,             SEED_HOURS);
  storeSet(STORE_KEYS.importQueue,       []);
  storeSet(STORE_KEYS.selectedSessionId, DEFAULT_SELECTED_SESSION_ID);
  storeSet(STORE_KEYS.selectedPhotoId,   `${DEFAULT_SELECTED_SESSION_ID}-p1`);
  storeSet(STORE_KEYS.activeTab,         'gallery');
  storeSet(STORE_KEYS.selectedHour,      DEFAULT_SELECTED_HOUR);
}

// Clears all app data and re-seeds from scratch.
// Returns the fresh session list so the caller can reset UI state.
export function resetDemoData(): Session[] {
  storeClearAll();
  seedStore();
  return getSessions();
}

// ----- Sessions --------------------------------------------------------------

export function getSessions(): Session[] {
  return storeGet<Session[]>(STORE_KEYS.sessions) ?? [];
}

export function getSessionById(id: string): Session | undefined {
  return getSessions().find(s => s.id === id);
}

export function updateSessionMetadata(
  id: string,
  changes: Partial<Pick<Session, 'status' | 'notes' | 'linkedSessionIds' | 'updatedAt'>>,
): Session | undefined {
  const sessions = getSessions();
  const idx = sessions.findIndex(s => s.id === id);
  if (idx === -1) return undefined;
  sessions[idx] = { ...sessions[idx], ...changes, updatedAt: new Date().toISOString() };
  storeSet(STORE_KEYS.sessions, sessions);
  return sessions[idx];
}

// ----- Photos ----------------------------------------------------------------

export function getPhotos(): Photo[] {
  return storeGet<Photo[]>(STORE_KEYS.photos) ?? [];
}

export function getPhotosBySessionId(sessionId: string): Photo[] {
  return getPhotos().filter(p => p.sessionId === sessionId);
}

export function getPhotoById(id: string): Photo | undefined {
  return getPhotos().find(p => p.id === id);
}

export function updatePhotoMetadata(
  id: string,
  changes: Partial<Pick<Photo, 'flag' | 'isFavorite' | 'isHidden' | 'operatorNotes' | 'processingStatus'>>,
): Photo | undefined {
  const photos = getPhotos();
  const idx = photos.findIndex(p => p.id === id);
  if (idx === -1) return undefined;
  photos[idx] = { ...photos[idx], ...changes };
  storeSet(STORE_KEYS.photos, photos);
  return photos[idx];
}

// ----- Import / ingest -------------------------------------------------------

export function getImportQueue(): ImportQueueItem[] {
  return storeGet<ImportQueueItem[]>(STORE_KEYS.importQueue) ?? [];
}

export function addImportQueueItem(item: ImportQueueItem): void {
  storeSet(STORE_KEYS.importQueue, [...getImportQueue(), item]);
}

export function updateImportQueueItem(
  itemId: string,
  changes: Partial<ImportQueueItem>,
): void {
  const queue = getImportQueue().map(item => (
    item.id === itemId ? { ...item, ...changes } : item
  ));
  storeSet(STORE_KEYS.importQueue, queue);
}

export function clearCompletedImports(): void {
  const active = getImportQueue().filter(item => item.status === 'queued' || item.status === 'importing');
  storeSet(STORE_KEYS.importQueue, active);
}

export function clearImportQueue(): void {
  storeSet(STORE_KEYS.importQueue, []);
}

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

function readImageDimensions(src: string): Promise<{ width: number; height: number }> {
  return new Promise(resolve => {
    const image = new Image();
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => resolve({ width: 0, height: 0 });
    image.src = src;
  });
}

function isDuplicateImport(sessionId: string, file: File, photos = getPhotos()): boolean {
  return photos.some(photo => {
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
  dataUrl: string,
  dimensions: { width: number; height: number },
): Photo {
  const now = new Date().toISOString();
  const metadata: ImportedFileMetadata = {
    filename: file.name,
    fileSize: file.size,
    lastModified: file.lastModified,
    mimeType: file.type,
  };
  const extension = file.name.split('.').pop()?.toUpperCase() || file.type.replace('image/', '').toUpperCase() || 'IMAGE';

  return {
    id: `imp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    sessionId: session.id,
    filename: file.name,
    // Demo-scale browser storage: these data URLs will later become managed app file paths and thumbnail cache records.
    thumbnailUrl: dataUrl,
    displayUrl: dataUrl,
    beforeImageUrl: dataUrl,
    afterImageUrl: dataUrl,
    createdAt: now,
    captureLocationId: session.captureLocationId,
    processingStatus: 'pending',
    flag: 'none',
    isFavorite: false,
    isHidden: false,
    operatorNotes: 'Imported via browser file picker.',
    enhanceVersion: 'unprocessed',
    width: dimensions.width,
    height: dimensions.height,
    fileSizeMb: Number((file.size / (1024 * 1024)).toFixed(2)),
    fileFormat: extension,
    originalPath: `Imported/${file.name}`,
    importedFile: metadata,
  };
}

export function addPhotoToSession(sessionId: string, photo: Photo): Photo {
  const sessions = getSessions();
  const photos = getPhotos();
  const idx = sessions.findIndex(s => s.id === sessionId);
  if (idx === -1) throw new Error('No active session found for import.');

  const nextPhotos = [...photos, photo];
  const nextSessions = sessions.map((session, i) => (
    i === idx
      ? { ...session, photoCount: session.photoCount + 1, updatedAt: new Date().toISOString() }
      : session
  ));

  const wrotePhotos = storeSet(STORE_KEYS.photos, nextPhotos);
  const wroteSessions = wrotePhotos && storeSet(STORE_KEYS.sessions, nextSessions);
  if (!wrotePhotos || !wroteSessions) {
    storeSet(STORE_KEYS.photos, photos);
    storeSet(STORE_KEYS.sessions, sessions);
    throw new Error('Browser storage is full. The imported photo was not saved.');
  }

  return photo;
}

export async function importPhotosToSession(sessionId: string, files: File[]): Promise<Photo[]> {
  const session = getSessionById(sessionId);
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
    addImportQueueItem(queueItem);

    if (!file.type.startsWith('image/')) {
      updateImportQueueItem(queueItem.id, {
        status: 'failed',
        progress: 100,
        error: 'Unsupported file type. Choose an image file.',
        completedAt: new Date().toISOString(),
      });
      continue;
    }

    if (isDuplicateImport(sessionId, file)) {
      updateImportQueueItem(queueItem.id, {
        status: 'skipped',
        progress: 100,
        error: 'Already imported for this session.',
        completedAt: new Date().toISOString(),
      });
      continue;
    }

    try {
      updateImportQueueItem(queueItem.id, { status: 'importing', progress: 35 });
      const dataUrl = await readFileAsDataUrl(file);
      updateImportQueueItem(queueItem.id, { progress: 65 });
      const dimensions = await readImageDimensions(dataUrl);
      updateImportQueueItem(queueItem.id, { progress: 80 });
      const photo = addPhotoToSession(sessionId, makeImportedPhoto(session, file, dataUrl, dimensions));
      imported.push(photo);
      updateImportQueueItem(queueItem.id, {
        status: 'complete',
        progress: 100,
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      updateImportQueueItem(queueItem.id, {
        status: 'failed',
        progress: 100,
        error: error instanceof Error ? error.message : 'Import failed.',
        completedAt: new Date().toISOString(),
      });
    }
  }

  return imported;
}

// ----- Locations & Hours -----------------------------------------------------

export function getLocations(): CaptureLocation[] {
  return storeGet<CaptureLocation[]>(STORE_KEYS.locations) ?? SEED_LOCATIONS;
}

export function getHours(): HourBucket[] {
  return storeGet<HourBucket[]>(STORE_KEYS.hours) ?? SEED_HOURS;
}

// ----- Persisted UI state ----------------------------------------------------

export function getSelectedSessionId(): string {
  return storeGet<string>(STORE_KEYS.selectedSessionId) ?? DEFAULT_SELECTED_SESSION_ID;
}

export function setSelectedSessionId(id: string): void {
  storeSet(STORE_KEYS.selectedSessionId, id);
}

export function getSelectedPhotoId(): string {
  return storeGet<string>(STORE_KEYS.selectedPhotoId) ?? `${DEFAULT_SELECTED_SESSION_ID}-p1`;
}

export function setSelectedPhotoId(id: string): void {
  storeSet(STORE_KEYS.selectedPhotoId, id);
}

export function getActiveTab(): TabKey {
  return storeGet<TabKey>(STORE_KEYS.activeTab) ?? 'gallery';
}

export function setActiveTab(tab: TabKey): void {
  storeSet(STORE_KEYS.activeTab, tab);
}

export function getSelectedHour(): string {
  return storeGet<string>(STORE_KEYS.selectedHour) ?? DEFAULT_SELECTED_HOUR;
}

export function setSelectedHour(h: string): void {
  storeSet(STORE_KEYS.selectedHour, h);
}
