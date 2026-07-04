import { initializeDatabase, getDatabase } from '../db/database';
import type {
  CaptureLocation,
  HourBucket,
  ImageStream,
  FileNamingField,
  AutoPrintItem,
  ImportedFileMetadata,
  ImportQueueItem,
  Photo,
  PhotoFlag,
  PhotoStorageKind,
  PhotoVersion,
  PhotoVersionKind,
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

const LEGACY_DEFAULT_STREAM_IDS = [
  'stream-giraffes',
  'stream-main-gate',
  'stream-pandas',
  'stream-statue',
  'stream-lion-cubs',
  'stream-sea-lions',
  'stream-carousel',
];

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
  source_filename?: string | null;
  session_key?: string | null;
  sequence_number?: number | null;
  sequence_label?: string | null;
  routing_status?: Photo['routingStatus'] | null;
  routing_reason?: string | null;
  size_bytes?: number | null;
  last_modified?: number | null;
  content_hash?: string | null;
  source_type?: Photo['sourceType'] | null;
  source_path?: string | null;
  managed_original_path?: string | null;
  imported_at?: string | null;
  image_stream_id?: string | null;
  image_stream_name?: string | null;
  imported_file_json?: string | null;
  auto_enhance_enabled?: number | null;
  active_version_kind?: PhotoVersionKind | null;
};

type PhotoVersionRow = {
  id: string;
  photo_id: string;
  kind: PhotoVersionKind;
  storage_path: string;
  display_url: string;
  created_at: string;
  file_size_mb: number;
};

type LocationRow = {
  id: string;
  name: string;
  code: string;
  is_active: number;
};

type ImageStreamRow = {
  id: string;
  name: string;
  slug: string;
  code?: string | null;
  type: ImageStream['type'];
  enabled: number;
  watch_path?: string | null;
  status: ImageStream['status'];
  last_activity_at?: string | null;
  last_detected_filename?: string | null;
  last_imported_filename?: string | null;
  total_detected: number;
  total_imported: number;
  total_skipped: number;
  total_failed: number;
  files_per_minute?: number | null;
  processing_preset?: string | null;
  printer_name?: string | null;
  auto_print_enabled?: number | null;
  auto_print_items_json?: string | null;
  file_renaming_enabled?: number | null;
  file_naming_fields_json?: string | null;
  file_naming_separator?: ImageStream['fileNamingSeparator'] | null;
  file_naming_extension?: ImageStream['fileNamingExtension'] | null;
  capture_location_id?: string | null;
  auto_enhance_enabled?: number | null;
  enhance_brightness?: number | null;
  enhance_contrast?: number | null;
  enhance_saturation?: number | null;
  enhance_sharpen?: number | null;
  created_at: string;
  updated_at: string;
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
  parsed_session_key?: string | null;
  parsed_sequence_number?: number | null;
  routing_status?: ImportQueueItem['routingStatus'] | null;
  routing_reason?: string | null;
  destination_path?: string | null;
  photo_id?: string | null;
  detected_at?: string | null;
  imported_at?: string | null;
  image_stream_id?: string | null;
  image_stream_name?: string | null;
  stream_type?: ImportQueueItem['streamType'] | null;
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
    imageStreamId: row.image_stream_id ?? undefined,
    imageStreamName: row.image_stream_name ?? undefined,
    importedAt: row.imported_at ?? undefined,
    originalFilename: row.original_filename ?? undefined,
    sourceFilename: row.source_filename ?? undefined,
    sessionKey: row.session_key ?? undefined,
    sequenceNumber: row.sequence_number ?? undefined,
    sequenceLabel: row.sequence_label ?? undefined,
    routingStatus: row.routing_status ?? undefined,
    routingReason: row.routing_reason ?? undefined,
    sizeBytes: row.size_bytes ?? undefined,
    lastModified: row.last_modified ?? undefined,
    contentHash: row.content_hash ?? undefined,
    importedFile,
    autoEnhanceEnabled: row.auto_enhance_enabled === 1,
    activeVersionKind: row.active_version_kind ?? 'original',
  };
}

function rowToPhotoVersion(row: PhotoVersionRow): PhotoVersion {
  return {
    id: row.id,
    photoId: row.photo_id,
    kind: row.kind,
    storagePath: row.storage_path,
    displayUrl: row.display_url,
    createdAt: row.created_at,
    fileSizeMb: row.file_size_mb,
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

function rowToImageStream(row: ImageStreamRow): ImageStream {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    code: row.code ?? undefined,
    type: row.type,
    enabled: row.enabled === 1,
    watchPath: row.watch_path ?? null,
    status: row.status,
    lastActivityAt: row.last_activity_at ?? null,
    lastDetectedFilename: row.last_detected_filename ?? null,
    lastImportedFilename: row.last_imported_filename ?? null,
    totalDetected: row.total_detected,
    totalImported: row.total_imported,
    totalSkipped: row.total_skipped,
    totalFailed: row.total_failed,
    filesPerMinute: row.files_per_minute ?? undefined,
    processingPreset: row.processing_preset ?? null,
    printerName: row.printer_name ?? null,
    autoPrintEnabled: row.auto_print_enabled === 1,
    autoPrintItems: parseJson<AutoPrintItem[]>(row.auto_print_items_json, []),
    fileRenamingEnabled: row.file_renaming_enabled === 1,
    fileNamingFields: parseJson<FileNamingField[]>(row.file_naming_fields_json, []),
    fileNamingSeparator: row.file_naming_separator ?? '_',
    fileNamingExtension: row.file_naming_extension ?? 'JPG',
    captureLocationId: row.capture_location_id ?? null,
    autoEnhanceEnabled: row.auto_enhance_enabled === 1,
    enhanceBrightness: row.enhance_brightness ?? 0,
    enhanceContrast: row.enhance_contrast ?? 0,
    enhanceSaturation: row.enhance_saturation ?? 1.08,
    enhanceSharpen: row.enhance_sharpen ?? 0.25,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function streamsToLocations(streams: ImageStream[]): CaptureLocation[] {
  return streams.map(stream => ({
    id: stream.captureLocationId ?? stream.id,
    name: stream.name,
    code: stream.code ?? stream.slug.toUpperCase(),
    isActive: stream.enabled || stream.status !== 'disabled',
  }));
}

function rowToHour(row: HourRow): HourBucket {
  return {
    h: row.h,
    label: row.label,
    sub: row.sub,
    count: row.count,
    photoCount: row.count,
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
    imageStreamId: row.image_stream_id ?? undefined,
    imageStreamName: row.image_stream_name ?? undefined,
    streamType: row.stream_type ?? undefined,
    parsedSessionKey: row.parsed_session_key ?? undefined,
    parsedSequenceNumber: row.parsed_sequence_number ?? undefined,
    routingStatus: row.routing_status ?? undefined,
    routingReason: row.routing_reason ?? undefined,
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
      storage_kind, storage_path, original_filename, source_filename, session_key, sequence_number,
      sequence_label, routing_status, routing_reason, size_bytes, last_modified, source_type,
      source_path, managed_original_path, image_stream_id, image_stream_name, imported_at,
      imported_file_json, auto_enhance_enabled, active_version_kind, content_hash
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41)
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
      source_filename = excluded.source_filename,
      session_key = excluded.session_key,
      sequence_number = excluded.sequence_number,
      sequence_label = excluded.sequence_label,
      routing_status = excluded.routing_status,
      routing_reason = excluded.routing_reason,
      size_bytes = excluded.size_bytes,
      last_modified = excluded.last_modified,
      source_type = excluded.source_type,
      source_path = excluded.source_path,
      managed_original_path = excluded.managed_original_path,
      image_stream_id = excluded.image_stream_id,
      image_stream_name = excluded.image_stream_name,
      imported_at = excluded.imported_at,
      imported_file_json = excluded.imported_file_json,
      auto_enhance_enabled = excluded.auto_enhance_enabled,
      active_version_kind = excluded.active_version_kind,
      content_hash = excluded.content_hash`,
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
      photo.sourceFilename ?? photo.originalFilename ?? null,
      photo.sessionKey ?? null,
      photo.sequenceNumber ?? null,
      photo.sequenceLabel ?? null,
      photo.routingStatus ?? null,
      photo.routingReason ?? null,
      photo.sizeBytes ?? null,
      photo.lastModified ?? null,
      photo.sourceType ?? null,
      photo.sourcePath ?? null,
      photo.managedOriginalPath ?? null,
      photo.imageStreamId ?? null,
      photo.imageStreamName ?? null,
      photo.importedAt ?? null,
      photo.importedFile ? JSON.stringify(photo.importedFile) : null,
      boolToInt(photo.autoEnhanceEnabled ?? false),
      photo.activeVersionKind ?? 'original',
      photo.contentHash ?? null,
    ],
  );
}

async function upsertImageStream(stream: ImageStream): Promise<void> {
  const db = await getDatabase();
  await db.execute(
    `INSERT INTO image_streams (
      id, name, slug, code, type, enabled, watch_path, status, last_activity_at,
      last_detected_filename, last_imported_filename, total_detected, total_imported,
      total_skipped, total_failed, files_per_minute, processing_preset, printer_name,
      auto_print_enabled, auto_print_items_json, file_renaming_enabled, file_naming_fields_json,
      file_naming_separator, file_naming_extension, capture_location_id, auto_enhance_enabled,
      enhance_brightness, enhance_contrast, enhance_saturation, enhance_sharpen,
      created_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      slug = excluded.slug,
      code = excluded.code,
      type = excluded.type,
      enabled = excluded.enabled,
      watch_path = excluded.watch_path,
      status = excluded.status,
      last_activity_at = excluded.last_activity_at,
      last_detected_filename = excluded.last_detected_filename,
      last_imported_filename = excluded.last_imported_filename,
      total_detected = excluded.total_detected,
      total_imported = excluded.total_imported,
      total_skipped = excluded.total_skipped,
      total_failed = excluded.total_failed,
      files_per_minute = excluded.files_per_minute,
      processing_preset = excluded.processing_preset,
      printer_name = excluded.printer_name,
      auto_print_enabled = excluded.auto_print_enabled,
      auto_print_items_json = excluded.auto_print_items_json,
      file_renaming_enabled = excluded.file_renaming_enabled,
      file_naming_fields_json = excluded.file_naming_fields_json,
      file_naming_separator = excluded.file_naming_separator,
      file_naming_extension = excluded.file_naming_extension,
      capture_location_id = excluded.capture_location_id,
      auto_enhance_enabled = excluded.auto_enhance_enabled,
      enhance_brightness = excluded.enhance_brightness,
      enhance_contrast = excluded.enhance_contrast,
      enhance_saturation = excluded.enhance_saturation,
      enhance_sharpen = excluded.enhance_sharpen,
      updated_at = excluded.updated_at`,
    [
      stream.id,
      stream.name,
      stream.slug,
      stream.code ?? null,
      stream.type,
      boolToInt(stream.enabled),
      stream.watchPath ?? null,
      stream.status,
      stream.lastActivityAt ?? null,
      stream.lastDetectedFilename ?? null,
      stream.lastImportedFilename ?? null,
      stream.totalDetected,
      stream.totalImported,
      stream.totalSkipped,
      stream.totalFailed,
      stream.filesPerMinute ?? null,
      stream.processingPreset ?? null,
      stream.printerName ?? null,
      boolToInt(stream.autoPrintEnabled ?? false),
      JSON.stringify(stream.autoPrintItems ?? []),
      boolToInt(stream.fileRenamingEnabled ?? false),
      JSON.stringify(stream.fileNamingFields ?? []),
      stream.fileNamingSeparator ?? '_',
      stream.fileNamingExtension ?? 'JPG',
      stream.captureLocationId ?? null,
      boolToInt(stream.autoEnhanceEnabled ?? false),
      stream.enhanceBrightness ?? 0,
      stream.enhanceContrast ?? 0,
      stream.enhanceSaturation ?? 1.08,
      stream.enhanceSharpen ?? 0.25,
      stream.createdAt,
      stream.updatedAt,
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
  await db.execute('DELETE FROM image_streams');
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
  for (const streamId of LEGACY_DEFAULT_STREAM_IDS) {
    await db.execute(
      `DELETE FROM image_streams
      WHERE id = $1
        AND watch_path IS NULL
        AND total_detected = 0
        AND total_imported = 0
        AND total_skipped = 0
        AND total_failed = 0`,
      [streamId],
    );
  }
  await db.execute(
    `DELETE FROM image_streams
    WHERE name LIKE 'New Stream%'
      AND watch_path IS NULL
      AND total_detected = 0
      AND total_imported = 0
      AND total_skipped = 0
      AND total_failed = 0`,
  );
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

  async getSessionByCode(sessionCode) {
    const db = await getDatabase();
    const rows = await db.select<SessionRow[]>('SELECT * FROM sessions WHERE session_code = $1', [sessionCode.toUpperCase()]);
    return rows[0] ? rowToSession(rows[0]) : undefined;
  },

  async addSession(session) {
    const existing = await this.getSessionByCode(session.sessionCode);
    if (existing) return existing;
    try {
      await upsertSession(session);
      return session;
    } catch (error) {
      // Race condition: a concurrent import created this session between our
      // getSessionByCode check and the upsertSession call. Re-fetch the winner.
      const raced = await this.getSessionByCode(session.sessionCode);
      if (raced) return raced;
      throw error;
    }
  },

  async updateSessionMetadata(id, changes) {
    const session = await this.getSessionById(id);
    if (!session) return undefined;

    const updated = { ...session, ...changes, updatedAt: new Date().toISOString() };
    await upsertSession(updated);
    return updated;
  },

  async deleteSession(sessionId) {
    const db = await getDatabase();
    await db.execute('DELETE FROM import_queue WHERE session_id = $1', [sessionId]);
    await db.execute('DELETE FROM photos WHERE session_id = $1', [sessionId]);
    await db.execute('DELETE FROM sessions WHERE id = $1', [sessionId]);
  },

  async getPhotos() {
    const db = await getDatabase();
    const rows = await db.select<PhotoRow[]>('SELECT * FROM photos ORDER BY session_id, sequence_number IS NULL, sequence_number, created_at, filename, id');
    return rows.map(rowToPhoto);
  },

  async getPhotosBySessionId(sessionId) {
    const db = await getDatabase();
    const rows = await db.select<PhotoRow[]>('SELECT * FROM photos WHERE session_id = $1 ORDER BY sequence_number IS NULL, sequence_number, created_at, filename, id', [sessionId]);
    return rows.map(rowToPhoto);
  },

  async getPhotoById(id) {
    const db = await getDatabase();
    const rows = await db.select<PhotoRow[]>('SELECT * FROM photos WHERE id = $1', [id]);
    return rows[0] ? rowToPhoto(rows[0]) : undefined;
  },

  async getPhotoByContentHash(contentHash) {
    const db = await getDatabase();
    const rows = await db.select<PhotoRow[]>(
      'SELECT * FROM photos WHERE content_hash = $1 ORDER BY created_at LIMIT 1',
      [contentHash],
    );
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

    // Best-effort cleanup of enhanced version files from disk (Tauri only).
    try {
      const versionRows = (await Promise.all(
        photoIds.map(id =>
          db.select<{ storage_path: string }[]>(
            "SELECT storage_path FROM photo_versions WHERE photo_id = $1 AND kind = 'enhanced'",
            [id],
          ),
        ),
      )).flat();
      if (versionRows.length > 0) {
        const { remove } = await import('@tauri-apps/plugin-fs');
        for (const row of versionRows) {
          try { await remove(row.storage_path); } catch { /* best effort */ }
        }
      }
    } catch { /* not in Tauri or photo_versions table not yet migrated */ }

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

  async addPhotoVersion(version) {
    const db = await getDatabase();
    await db.execute(
      `INSERT INTO photo_versions (id, photo_id, kind, storage_path, display_url, created_at, file_size_mb)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT(id) DO UPDATE SET
         storage_path = excluded.storage_path,
         display_url = excluded.display_url`,
      [version.id, version.photoId, version.kind, version.storagePath, version.displayUrl, version.createdAt, version.fileSizeMb],
    );
  },

  async getPhotoVersions(photoId) {
    const db = await getDatabase();
    const rows = await db.select<PhotoVersionRow[]>(
      'SELECT * FROM photo_versions WHERE photo_id = $1 ORDER BY created_at',
      [photoId],
    );
    return rows.map(rowToPhotoVersion);
  },

  async setActiveVersion(photoId, kind) {
    const photo = await this.getPhotoById(photoId);
    if (!photo) return;
    const versions = await this.getPhotoVersions(photoId);
    const target = versions.find(v => v.kind === kind);
    if (!target) return;
    await upsertPhoto({
      ...photo,
      activeVersionKind: kind,
      displayUrl: target.displayUrl,
      thumbnailUrl: target.displayUrl,
    });
  },

  async deletePhotoVersionsByPhotoId(photoId) {
    const db = await getDatabase();
    await db.execute('DELETE FROM photo_versions WHERE photo_id = $1', [photoId]);
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
        source_type, source_path, source_filename, image_stream_id, image_stream_name, stream_type,
        parsed_session_key, parsed_sequence_number,
        routing_status, routing_reason, destination_path, photo_id, detected_at, imported_at,
        error, created_at, completed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
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
        image_stream_id = excluded.image_stream_id,
        image_stream_name = excluded.image_stream_name,
        stream_type = excluded.stream_type,
        parsed_session_key = excluded.parsed_session_key,
        parsed_sequence_number = excluded.parsed_sequence_number,
        routing_status = excluded.routing_status,
        routing_reason = excluded.routing_reason,
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
        item.imageStreamId ?? null,
        item.imageStreamName ?? null,
        item.streamType ?? null,
        item.parsedSessionKey ?? null,
        item.parsedSequenceNumber ?? null,
        item.routingStatus ?? null,
        item.routingReason ?? null,
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

  async removeImportQueueItem(id: string) {
    const db = await getDatabase();
    await db.execute('DELETE FROM import_queue WHERE id = $1', [id]);
  },

  async clearCompletedImports() {
    const db = await getDatabase();
    await db.execute("DELETE FROM import_queue WHERE status NOT IN ('queued', 'stabilizing', 'importing')");
  },

  async clearImportQueue() {
    const db = await getDatabase();
    await db.execute('DELETE FROM import_queue');
  },

  async getLocations() {
    const streams = await this.getImageStreams();
    if (streams.length > 0) return streamsToLocations(streams);

    const db = await getDatabase();
    const rows = await db.select<LocationRow[]>('SELECT * FROM capture_locations ORDER BY id');
    return rows.map(rowToLocation);
  },

  async getImageStreams() {
    const db = await getDatabase();
    const rows = await db.select<ImageStreamRow[]>('SELECT * FROM image_streams ORDER BY name');
    return rows.map(rowToImageStream);
  },

  async getImageStreamById(id) {
    const db = await getDatabase();
    const rows = await db.select<ImageStreamRow[]>('SELECT * FROM image_streams WHERE id = $1', [id]);
    return rows[0] ? rowToImageStream(rows[0]) : undefined;
  },

  async addImageStream(stream) {
    const existing = await this.getImageStreamById(stream.id);
    if (existing) return existing;
    await upsertImageStream(stream);
    return stream;
  },

  async updateImageStream(id, changes) {
    const stream = await this.getImageStreamById(id);
    if (!stream) return undefined;
    const updated: ImageStream = { ...stream, ...changes, updatedAt: new Date().toISOString() };
    await upsertImageStream(updated);
    return updated;
  },

  async deleteImageStream(id) {
    const db = await getDatabase();
    await db.execute('DELETE FROM image_streams WHERE id = $1', [id]);
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
