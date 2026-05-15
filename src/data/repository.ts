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
import { parsePhotoFilename, type ParsedPhotoFilename } from '../ingest/filenameParser';
import { routePhotoToSession, type SessionRoutingResult } from '../ingest/sessionRoutingService';

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

export async function getSessionByCode(sessionCode: string): Promise<Session | undefined> {
  return (await getMetadataStore()).getSessionByCode(sessionCode);
}

export async function updateSessionMetadata(
  id: string,
  changes: Partial<Pick<Session, 'status' | 'notes' | 'linkedSessionIds' | 'updatedAt'>>,
): Promise<Session | undefined> {
  return (await getMetadataStore()).updateSessionMetadata(id, changes);
}

export async function deleteSession(sessionId: string): Promise<void> {
  const store = await getMetadataStore();
  const photos = await store.getPhotosBySessionId(sessionId);
  await store.deleteSession(sessionId);

  const storage = getPhotoStorageService();
  await Promise.all(photos.map(photo => storage.deletePhotoSource(photo)));
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

async function isDuplicateImport(
  sessionId: string,
  file: File,
  parsed?: ParsedPhotoFilename,
  sourcePath?: string,
  photos = getPhotos(),
): Promise<boolean> {
  const resolvedPhotos = await photos;
  return resolvedPhotos.some(photo => {
    if (photo.sessionId !== sessionId) return false;
    if (sourcePath && photo.sourcePath === sourcePath) return true;
    if (
      parsed?.sessionKey &&
      parsed.sequenceNumber != null &&
      photo.sessionKey === parsed.sessionKey &&
      photo.sequenceNumber === parsed.sequenceNumber &&
      (photo.originalFilename === file.name || photo.sourceFilename === file.name)
    ) {
      return true;
    }
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
  routing: SessionRoutingResult,
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
    sourceFilename: file.name,
    sessionKey: routing.sessionKey ?? session.sessionCode,
    sequenceNumber: routing.sequenceNumber ?? null,
    sequenceLabel: routing.sequenceLabel ?? null,
    routingStatus: routing.status === 'routed' ? 'routed' : 'unrouted',
    routingReason: routing.reason,
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

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function hourLabel(hour: number): string {
  const next = (hour + 1) % 24;
  const format = (value: number) => {
    const period = value >= 12 ? 'PM' : 'AM';
    const twelveHour = value % 12 || 12;
    return `${twelveHour} ${period}`;
  };
  return `${format(hour)} - ${format(next)}`;
}

function buildHourlyImportBuckets(photos: Photo[]): HourBucket[] {
  const today = startOfToday();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const buckets = new Map<number, { sessions: Set<string>; photoCount: number }>();

  for (const photo of photos) {
    if (!photo.importedAt) continue;
    const importedAt = new Date(photo.importedAt);
    if (Number.isNaN(importedAt.getTime())) continue;
    if (importedAt < today || importedAt >= tomorrow) continue;

    const hour = importedAt.getHours();
    const bucket = buckets.get(hour) ?? { sessions: new Set<string>(), photoCount: 0 };
    bucket.sessions.add(photo.sessionId);
    bucket.photoCount += 1;
    buckets.set(hour, bucket);
  }

  if (buckets.size === 0) return [];

  const sortedHours = Array.from(buckets.keys()).sort((a, b) => a - b);
  const firstHour = sortedHours[0];
  const lastHour = sortedHours[sortedHours.length - 1];
  const result: HourBucket[] = [];

  for (let hour = firstHour; hour <= lastHour; hour += 1) {
    const bucket = buckets.get(hour);
    result.push({
      h: `${String(hour).padStart(2, '0')}:00`,
      label: hourLabel(hour),
      count: bucket?.sessions.size ?? 0,
      photoCount: bucket?.photoCount ?? 0,
      isEmpty: !bucket,
    });
  }

  return result;
}

export async function addPhotoToSession(sessionId: string, photo: Photo): Promise<Photo> {
  return (await getMetadataStore()).addPhotoToSession(sessionId, photo);
}

export async function importPhotosToSession(sessionId: string, files: File[]): Promise<Photo[]> {
  const fallbackSession = await getSessionById(sessionId);
  if (!fallbackSession) throw new Error('No active session selected.');

  const imported: Photo[] = [];

  for (const file of files) {
    const parsed = parsePhotoFilename(file.name);
    const queueItem: ImportQueueItem = {
      id: `iq-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      filename: file.name,
      sessionId,
      status: 'queued',
      progress: 0,
      fileSize: file.size,
      lastModified: file.lastModified,
      sourceFilename: file.name,
      parsedSessionKey: parsed.sessionKey ?? undefined,
      parsedSequenceNumber: parsed.sequenceNumber,
      routingStatus: parsed.sessionKey ? undefined : 'unrouted',
      routingReason: parsed.sessionKey ? undefined : parsed.reason,
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

    const routing = await routePhotoToSession({ parsed, fallbackSessionId: sessionId });
    await updateImportQueueItem(queueItem.id, {
      sessionId: routing.sessionId ?? sessionId,
      routingStatus: routing.status === 'routed' ? 'routed' : 'unrouted',
      routingReason: routing.reason,
    });

    if (routing.status !== 'routed' || !routing.session) {
      await updateImportQueueItem(queueItem.id, {
        status: 'skipped',
        progress: 100,
        routingStatus: 'unrouted',
        routingReason: routing.reason,
        error: routing.reason ?? 'Filename did not contain a routable session ID.',
        completedAt: new Date().toISOString(),
      });
      continue;
    }

    if (await isDuplicateImport(routing.session.id, file, parsed)) {
      await updateImportQueueItem(queueItem.id, {
        status: 'skipped',
        progress: 100,
        routingStatus: 'routed',
        routingReason: routing.reason,
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
        sessionKey: routing.session.sessionCode || routing.session.id,
        photoId,
        originalFilename: file.name,
        sourceType: 'manual-picker',
        captureLocationSlug: slugify(routing.session.captureLocationLabel || routing.session.captureLocationId),
        importedAt,
      });
      await updateImportQueueItem(queueItem.id, { progress: 65 });
      const dimensions = await readImageDimensions(savedPhoto.displayUrl);
      await updateImportQueueItem(queueItem.id, { progress: 80 });
      const photo = await addPhotoToSession(routing.session.id, makeImportedPhoto(routing.session, file, photoId, savedPhoto, dimensions, {
        sourceType: 'manual-picker',
        importedAt,
      }, routing));
      imported.push(photo);
      await updateImportQueueItem(queueItem.id, {
        status: 'complete',
        progress: 100,
        photoId,
        destinationPath: savedPhoto.managedOriginalPath ?? savedPhoto.relativePath,
        importedAt,
        routingStatus: 'routed',
        routingReason: routing.reason,
        completedAt: new Date().toISOString(),
      });
    } catch (error) {
      await updateImportQueueItem(queueItem.id, {
        status: 'failed',
        progress: 100,
        routingStatus: 'routing_failed',
        routingReason: error instanceof Error ? error.message : 'Import failed.',
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
  const fallbackSession = await getSessionById(sessionId);
  if (!fallbackSession) throw new Error('No active session selected.');
  const parsed = parsePhotoFilename(file.name);
  const routing = await routePhotoToSession({ parsed, fallbackSessionId: sessionId });
  const targetSessionId = routing.sessionId ?? sessionId;

  const queueItem: ImportQueueItem = {
    id: queueItemId ?? `iq-watch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    filename: file.name,
    sessionId: targetSessionId,
    status: queueItemId ? 'importing' : 'queued',
    progress: queueItemId ? 25 : 0,
    fileSize: file.size,
    lastModified: file.lastModified,
    sourceType: 'watched-folder',
    sourcePath,
    sourceFilename: file.name,
    parsedSessionKey: parsed.sessionKey ?? undefined,
    parsedSequenceNumber: parsed.sequenceNumber,
    routingStatus: routing.status === 'routed' ? 'routed' : 'unrouted',
    routingReason: routing.reason,
    detectedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(),
  };
  if (queueItemId) await updateImportQueueItem(queueItem.id, queueItem);
  else await addImportQueueItem(queueItem);

  if (routing.status !== 'routed' || !routing.session) {
    await updateImportQueueItem(queueItem.id, {
      status: 'skipped',
      progress: 100,
      routingStatus: 'unrouted',
      routingReason: routing.reason,
      error: routing.reason ?? 'Filename did not contain a routable session ID.',
      completedAt: new Date().toISOString(),
    });
    return undefined;
  }

  if (await isDuplicateImport(routing.session.id, file, parsed, sourcePath)) {
    await updateImportQueueItem(queueItem.id, {
      status: 'skipped',
      progress: 100,
      routingStatus: 'routed',
      routingReason: routing.reason,
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
      sessionKey: routing.session.sessionCode || routing.session.id,
      photoId,
      originalFilename: file.name,
      sourceType: 'watched-folder',
      captureLocationSlug: slugify(routing.session.captureLocationLabel || routing.session.captureLocationId),
      importedAt,
    });
    await updateImportQueueItem(queueItem.id, { progress: 65 });
    const dimensions = await readImageDimensions(savedPhoto.displayUrl);
    await updateImportQueueItem(queueItem.id, { progress: 80 });
    const photo = await addPhotoToSession(routing.session.id, makeImportedPhoto(routing.session, file, photoId, savedPhoto, dimensions, {
      sourceType: 'watched-folder',
      sourcePath,
      importedAt,
    }, routing));
    await updateImportQueueItem(queueItem.id, {
      status: 'complete',
      progress: 100,
      photoId,
      destinationPath: savedPhoto.managedOriginalPath ?? savedPhoto.relativePath,
      importedAt,
      routingStatus: 'routed',
      routingReason: routing.reason,
      completedAt: new Date().toISOString(),
    });
    return photo;
  } catch (error) {
    await updateImportQueueItem(queueItem.id, {
      status: 'failed',
      progress: 100,
      routingStatus: 'routing_failed',
      routingReason: error instanceof Error ? error.message : 'Watched-folder import failed.',
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
  return buildHourlyImportBuckets(await getPhotos());
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
