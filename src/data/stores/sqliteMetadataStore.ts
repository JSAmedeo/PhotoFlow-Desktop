import { initializeDatabase, getDatabase } from '../db/database';
import type {
  CaptureLocation,
  HourBucket,
  ImportedFileMetadata,
  ImportQueueItem,
  Photo,
  PhotoFlag,
  PhotoStorageKind,
  ProcessingStatus,
  Session,
  SessionStatus,
  TabKey,
  WatchedFolderSettings,
} from '../models';
import {
  DEFAULT_SELECTED_HOUR,
  DEFAULT_SELECTED_SESSION_ID,
  SEED_HOURS,
  SEED_LOCATIONS,
  SEED_PHOTOS,
  SEED_SESSIONS,
} from '../seedData';
import type { MetadataStore } from './metadataStore';

const DEFAULT_WATCHED_FOLDER_SETTINGS: WatchedFolderSettings = {
  watchEnabled: false,
  watchedImportFolder: null,
  fileSettleDelayMs: 2000,
  defaultCaptureLocationId: 'loc-2',
  defaultSessionAssignmentMode: 'active-session',
};

function isPhoto(value: Photo | undefined): value is Photo {
  return value !== undefined;
}

type SessionRow = {
  id: string;
  session_code: string;
  barcode: string;
  capture_location_id: string;
  capture_location_label: string;
  handler: string;
  created_at: string;
  updated_at: string;
  photo_count: number;
  status: SessionStatus;
  notes: string;
  linked_session_ids_json: string;
  tint_json: string;
};

type PhotoRow = {
  id: string;
  session_id: string;
  filename: string;
  thumbnail_url: string;
  display_url: string;
  before_image_url: string;
  after_image_url: string;
  created_at: string;
  capture_location_id: string;
  processing_status: ProcessingStatus;
  flag: PhotoFlag;
  is_favorite: number;
  is_hidden: number;
  operator_notes: string;
  enhance_version: string;
  width: number;
  height: number;
  file_size_mb: number;
  file_format: string;
  original_path?: string | null;
  storage_kind?: PhotoStorageKind | null;
  storage_path?: string | null;
  original_filename?: string | null;
  size_bytes?: number | null;
  last_modified?: number | null;
  source_type?: Photo['sourceType'] | null;
  source_path?: string | null;
  managed_original_path?: string | null;
  imported_at?: string | null;
  imported_file_json?: string | null;
};

type LocationRow = {
  id: string;
  name: string;
  code: string;
  is_active: number;
};

type HourRow = {
  h: string;
  label: string;
  sub: string;
  count: number;
  flagged: number;
};

type ImportQueueRow = {
  id: string;
  filename: string;
  session_id: string;
  status: ImportQueueItem['status'];
  progress: number;
  file_size?: number | null;
  last_modified?: number | null;
  source_type?: ImportQueueItem['sourceType'] | null;
  source_path?: string | null;
  source_filename?: string | null;
  destination_path?: string | null;
  photo_id?: string | null;
  detected_at?: string | null;
  imported_at?: string | null;
  error?: string | null;
  created_at: string;
  completed_at?: string | null;
};

type AppStateRow = {
  value_json: string;
};

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function boolToInt(value: boolean): number {
  return value ? 1 : 0;
}

function rowToSession(row: SessionRow): Session {
  return {
    id: row.id,
    sessionCode: row.session_code,
    barcode: row.barcode,
    captureLocationId: row.capture_location_id,
    captureLocationLabel: row.capture_location_label,
    handler: row.handler,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    photoCount: row.photo_count,
    status: row.status,
    notes: row.notes,
    linkedSessionIds: parseJson<string[]>(row.linked_session_ids_json, []),
    tint: parseJson<[string, string]>(row.tint_json, ['#3a5f78', '#1f3a4a']),
  };
}

function rowToPhoto(row: PhotoRow): Photo {
  const importedFile = parseJson<ImportedFileMetadata | undefined>(row.imported_file_json, undefined);

  return {
    id: row.id,
    sessionId: row.session_id,
    filename: row.filename,
    thumbnailUrl: row.thumbnail_url,
    displayUrl: row.display_url,
    beforeImageUrl: row.before_image_url,
    afterImageUrl: row.after_image_url,
    createdAt: row.created_at,
    captureLocationId: row.capture_location_id,
    processingStatus: row.processing_status,
    flag: row.flag,
    isFavorite: row.is_favorite === 1,
    isHidden: row.is_hidden === 1,
    operatorNotes: row.operator_notes,
    enhanceVersion: row.enhance_version,
    width: row.width,
    height: row.height,
    fileSizeMb: row.file_size_mb,
    fileFormat: row.file_format,
    originalPath: row.original_path ?? undefined,
    storageKind: row.storage_kind ?? undefined,
    storagePath: row.storage_path ?? undefined,
    sourceType: row.source_type ?? undefined,
    sourcePath: row.source_path ?? undefined,
    managedOriginalPath: row.managed_original_path ?? undefined,
    importedAt: row.imported_at ?? undefined,
    originalFilename: row.original_filename ?? undefined,
    sizeBytes: row.size_bytes ?? undefined,
    lastModified: row.last_modified ?? undefined,
    importedFile,
  };
}

function rowToLocation(row: LocationRow): CaptureLocation {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    isActive: row.is_active === 1,
  };
}

function rowToHour(row: HourRow): HourBucket {
  return {
    h: row.h,
    label: row.label,
    sub: row.sub,
    count: row.count,
    flagged: row.flagged,
  };
}

function rowToImportQueueItem(row: ImportQueueRow): ImportQueueItem {
  return {
    id: row.id,
    filename: row.filename,
    sessionId: row.session_id,
    status: row.status,
    progress: row.progress,
    fileSize: row.file_size ?? undefined,
    lastModified: row.last_modified ?? undefined,
    sourceType: row.source_type ?? undefined,
    sourcePath: row.source_path ?? undefined,
    sourceFilename: row.source_filename ?? undefined,
    destinationPath: row.destination_path ?? undefined,
    photoId: row.photo_id ?? undefined,
    detectedAt: row.detected_at ?? undefined,
    importedAt: row.imported_at ?? undefined,
    error: row.error ?? undefined,
    createdAt: row.created_at,
    completedAt: row.completed_at ?? undefined,
  };
}

async function upsertSession(session: Session): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO sessions (
      id, session_code, barcode, capture_location_id, capture_location_label, handler,
      created_at, updated_at, photo_count, status, notes, linked_session_ids_json, tint_json
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    ON CONFLICT(id) DO UPDATE SET
      session_code = excluded.session_code,
      barcode = excluded.barcode,
      capture_location_id = excluded.capture_location_id,
      capture_location_label = excluded.capture_location_label,
      handler = excluded.handler,
      created_at = excluded.created_at,
      updated_at = excluded.updated_at,
      photo_count = excluded.photo_count,
      status = excluded.status,
      notes = excluded.notes,
      linked_session_ids_json = excluded.linked_session_ids_json,
      tint_json = excluded.tint_json`,
    [
      session.id,
      session.sessionCode,
      session.barcode,
      session.captureLocationId,
      session.captureLocationLabel,
      session.handler,
      session.createdAt,
      session.updatedAt,
      session.photoCount,
      session.status,
      session.notes,
      JSON.stringify(session.linkedSessionIds),
      JSON.stringify(session.tint),
    ],
  );
}

async function upsertPhoto(photo: Photo): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO photos (
      id, session_id, filename, thumbnail_url, display_url, before_image_url, after_image_url,
      created_at, capture_location_id, processing_status, flag, is_favorite, is_hidden,
      operator_notes, enhance_version, width, height, file_size_mb, file_format, original_path,
      storage_kind, storage_path, original_filename, size_bytes, last_modified,
      source_type, source_path, managed_original_path, imported_at, imported_file_json
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
    ON CONFLICT(id) DO UPDATE SET
      session_id = excluded.session_id,
      filename = excluded.filename,
      thumbnail_url = excluded.thumbnail_url,
      display_url = excluded.display_url,
      before_image_url = excluded.before_image_url,
      after_image_url = excluded.after_image_url,
      created_at = excluded.created_at,
      capture_location_id = excluded.capture_location_id,
      processing_status = excluded.processing_status,
      flag = excluded.flag,
      is_favorite = excluded.is_favorite,
      is_hidden = excluded.is_hidden,
      operator_notes = excluded.operator_notes,
      enhance_version = excluded.enhance_version,
      width = excluded.width,
      height = excluded.height,
      file_size_mb = excluded.file_size_mb,
      file_format = excluded.file_format,
      original_path = excluded.original_path,
      storage_kind = excluded.storage_kind,
      storage_path = excluded.storage_path,
      original_filename = excluded.original_filename,
      size_bytes = excluded.size_bytes,
      last_modified = excluded.last_modified,
      source_type = excluded.source_type,
      source_path = excluded.source_path,
      managed_original_path = excluded.managed_original_path,
      imported_at = excluded.imported_at,
      imported_file_json = excluded.imported_file_json`,
    [
      photo.id,
      photo.sessionId,
      photo.filename,
      photo.thumbnailUrl,
      photo.displayUrl,
      photo.beforeImageUrl,
      photo.afterImageUrl,
      photo.createdAt,
      photo.captureLocationId,
      photo.processingStatus,
      photo.flag,
      boolToInt(photo.isFavorite),
      boolToInt(photo.isHidden),
      photo.operatorNotes,
      photo.enhanceVersion,
      photo.width,
      photo.height,
      photo.fileSizeMb,
      photo.fileFormat,
      photo.originalPath ?? null,
      photo.storageKind ?? null,
      photo.storagePath ?? null,
      photo.originalFilename ?? null,
      photo.sizeBytes ?? null,
      photo.lastModified ?? null,
      photo.sourceType ?? null,
      photo.sourcePath ?? null,
      photo.managedOriginalPath ?? null,
      photo.importedAt ?? null,
      photo.importedFile ? JSON.stringify(photo.importedFile) : null,
    ],
  );
}

async function upsertLocation(location: CaptureLocation): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO capture_locations (id, name, code, is_active)
    VALUES ($1, $2, $3, $4)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      code = excluded.code,
      is_active = excluded.is_active`,
    [location.id, location.name, location.code, boolToInt(location.isActive)],
  );
}

async function upsertHour(hour: HourBucket): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO hour_buckets (h, label, sub, count, flagged)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT(h) DO UPDATE SET
      label = excluded.label,
      sub = excluded.sub,
      count = excluded.count,
      flagged = excluded.flagged`,
    [hour.h, hour.label, hour.sub, hour.count, hour.flagged],
  );
}

async function setAppState<T>(key: string, value: T): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO app_state (key, value_json, updated_at)
    VALUES ($1, $2, $3)
    ON CONFLICT(key) DO UPDATE SET
      value_json = excluded.value_json,
      updated_at = excluded.updated_at`,
    [key, JSON.stringify(value), new Date().toISOString()],
  );
}

async function getAppState<T>(key: string, fallback: T): Promise<T> {
  const db = await getDatabase();
  const rows = await db.select<AppStateRow[]>('SELECT value_json FROM app_state WHERE key = $1', [key]);
  return rows[0] ? parseJson<T>(rows[0].value_json, fallback) : fallback;
}

async function seedDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM import_queue');
  await db.execute('DELETE FROM photos');
  await db.execute('DELETE FROM sessions');
  await db.execute('DELETE FROM capture_locations');
  await db.execute('DELETE FROM hour_buckets');
  await db.execute('DELETE FROM app_state');

  for (const location of SEED_LOCATIONS) await upsertLocation(location);
  for (const hour of SEED_HOURS) await upsertHour(hour);
  for (const session of SEED_SESSIONS) await upsertSession(session);
  for (const photo of SEED_PHOTOS) await upsertPhoto(photo);
  await setAppState('selectedSessionId', DEFAULT_SELECTED_SESSION_ID);
  await setAppState('selectedPhotoId', `${DEFAULT_SELECTED_SESSION_ID}-p1`);
  await setAppState('activeTab', 'gallery');
  await setAppState('selectedHour', DEFAULT_SELECTED_HOUR);
}

async function seedIfEmpty(): Promise<void> {
  const db = await getDatabase();
  const rows = await db.select<{ count: number }[]>('SELECT COUNT(*) as count FROM sessions');
  if ((rows[0]?.count ?? 0) === 0) await seedDatabase();
}

export const sqliteMetadataStore: MetadataStore = {
  async initialize() {
    await initializeDatabase();
    await seedIfEmpty();
  },

  async getSessions() {
    const db = await getDatabase();
    const rows = await db.select<SessionRow[]>('SELECT * FROM sessions ORDER BY created_at');
    return rows.map(rowToSession);
  },

  async getSessionById(id) {
    const db = await getDatabase();
    const rows = await db.select<SessionRow[]>('SELECT * FROM sessions WHERE id = $1', [id]);
    return rows[0] ? rowToSession(rows[0]) : undefined;
  },

  async updateSessionMetadata(id, changes) {
    const session = await this.getSessionById(id);
    if (!session) return undefined;

    const updated = { ...session, ...changes, updatedAt: new Date().toISOString() };
    await upsertSession(updated);
    return updated;
  },

  async getPhotos() {
    const db = await getDatabase();
    const rows = await db.select<PhotoRow[]>('SELECT * FROM photos ORDER BY created_at, id');
    return rows.map(rowToPhoto);
  },

  async getPhotosBySessionId(sessionId) {
    const db = await getDatabase();
    const rows = await db.select<PhotoRow[]>('SELECT * FROM photos WHERE session_id = $1 ORDER BY created_at, id', [sessionId]);
    return rows.map(rowToPhoto);
  },

  async getPhotoById(id) {
    const db = await getDatabase();
    const rows = await db.select<PhotoRow[]>('SELECT * FROM photos WHERE id = $1', [id]);
    return rows[0] ? rowToPhoto(rows[0]) : undefined;
  },

  async updatePhotoMetadata(id, changes) {
    const photo = await this.getPhotoById(id);
    if (!photo) return undefined;

    const updated = { ...photo, ...changes };
    await upsertPhoto(updated);
    return updated;
  },

  async addPhotoToSession(sessionId, photo) {
    const session = await this.getSessionById(sessionId);
    if (!session) throw new Error('No active session found for import.');

    const updatedSession = {
      ...session,
      photoCount: session.photoCount + 1,
      updatedAt: new Date().toISOString(),
    };

    await upsertPhoto(photo);
    await upsertSession(updatedSession);
    return photo;
  },

  async deletePhotos(photoIds) {
    if (photoIds.length === 0) return;

    const db = await getDatabase();
    const photos = (await Promise.all(photoIds.map(id => this.getPhotoById(id)))).filter(isPhoto);
    const sessionIds = Array.from(new Set(photos.map(photo => photo.sessionId)));

    for (const photoId of photoIds) {
      await db.execute('DELETE FROM photos WHERE id = $1', [photoId]);
    }

    for (const sessionId of sessionIds) {
      const rows = await db.select<Array<{ count: number }>>(
        'SELECT COUNT(*) as count FROM photos WHERE session_id = $1',
        [sessionId],
      );
      const count = Number(rows[0]?.count ?? 0);
      await db.execute(
        'UPDATE sessions SET photo_count = $1, updated_at = $2 WHERE id = $3',
        [count, new Date().toISOString(), sessionId],
      );
    }
  },

  async getImportQueue() {
    const db = await getDatabase();
    const rows = await db.select<ImportQueueRow[]>('SELECT * FROM import_queue ORDER BY created_at');
    return rows.map(rowToImportQueueItem);
  },

  async addImportQueueItem(item) {
    const db = await getDatabase();
    await db.execute(
      `INSERT INTO import_queue (
        id, filename, session_id, status, progress, file_size, last_modified,
        source_type, source_path, source_filename, destination_path, photo_id, detected_at, imported_at,
        error, created_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
      ON CONFLICT(id) DO UPDATE SET
        filename = excluded.filename,
        session_id = excluded.session_id,
        status = excluded.status,
        progress = excluded.progress,
        file_size = excluded.file_size,
        last_modified = excluded.last_modified,
        source_type = excluded.source_type,
        source_path = excluded.source_path,
        source_filename = excluded.source_filename,
        destination_path = excluded.destination_path,
        photo_id = excluded.photo_id,
        detected_at = excluded.detected_at,
        imported_at = excluded.imported_at,
        error = excluded.error,
        created_at = excluded.created_at,
        completed_at = excluded.completed_at`,
      [
        item.id,
        item.filename,
        item.sessionId,
        item.status,
        item.progress,
        item.fileSize ?? null,
        item.lastModified ?? null,
        item.sourceType ?? null,
        item.sourcePath ?? null,
        item.sourceFilename ?? null,
        item.destinationPath ?? null,
        item.photoId ?? null,
        item.detectedAt ?? null,
        item.importedAt ?? null,
        item.error ?? null,
        item.createdAt,
        item.completedAt ?? null,
      ],
    );
  },

  async updateImportQueueItem(itemId, changes) {
    const queue = await this.getImportQueue();
    const item = queue.find(candidate => candidate.id === itemId);
    if (!item) return;
    await this.addImportQueueItem({ ...item, ...changes });
  },

  async clearCompletedImports() {
    const db = await getDatabase();
    await db.execute("DELETE FROM import_queue WHERE status NOT IN ('queued', 'importing')");
  },

  async clearImportQueue() {
    const db = await getDatabase();
    await db.execute('DELETE FROM import_queue');
  },

  async getLocations() {
    const db = await getDatabase();
    const rows = await db.select<LocationRow[]>('SELECT * FROM capture_locations ORDER BY id');
    return rows.map(rowToLocation);
  },

  async getHours() {
    const db = await getDatabase();
    const rows = await db.select<HourRow[]>('SELECT * FROM hour_buckets ORDER BY h');
    return rows.map(rowToHour);
  },

  async getSelectedSessionId() {
    return getAppState('selectedSessionId', DEFAULT_SELECTED_SESSION_ID);
  },

  async setSelectedSessionId(id) {
    await setAppState('selectedSessionId', id);
  },

  async getSelectedPhotoId() {
    return getAppState('selectedPhotoId', `${DEFAULT_SELECTED_SESSION_ID}-p1`);
  },

  async setSelectedPhotoId(id) {
    await setAppState('selectedPhotoId', id);
  },

  async getActiveTab() {
    return getAppState<TabKey>('activeTab', 'gallery');
  },

  async setActiveTab(tab) {
    await setAppState('activeTab', tab);
  },

  async getSelectedHour() {
    return getAppState('selectedHour', DEFAULT_SELECTED_HOUR);
  },

  async setSelectedHour(h) {
    await setAppState('selectedHour', h);
  },

  async getWatchedFolderSettings() {
    return getAppState<WatchedFolderSettings>('watchedFolderSettings', DEFAULT_WATCHED_FOLDER_SETTINGS);
  },

  async setWatchedFolderSettings(settings) {
    await setAppState('watchedFolderSettings', settings);
  },

  async resetDemoData() {
    await seedDatabase();
    return this.getSessions();
  },
};
