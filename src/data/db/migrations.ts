import { INITIAL_SCHEMA_STATEMENTS } from './schema';

export interface Migration {
  id: number;
  name: string;
  statements: string[];
}

// Migrations 1-12 predate the transactional runner and replay under the legacy
// lenient runner (see database.ts). Migrations 13+ run as a single atomic batch:
// keep each statement free of string literals containing `;` (the batch is joined
// on `;` and executed as one multi-statement transaction).
export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: 'initial_metadata_schema',
    statements: INITIAL_SCHEMA_STATEMENTS,
  },
  {
    id: 2,
    name: 'watched_folder_ingest_metadata',
    statements: [
      'ALTER TABLE photos ADD COLUMN source_type TEXT',
      'ALTER TABLE photos ADD COLUMN source_path TEXT',
      'ALTER TABLE photos ADD COLUMN managed_original_path TEXT',
      'ALTER TABLE photos ADD COLUMN imported_at TEXT',
      'ALTER TABLE import_queue ADD COLUMN source_type TEXT',
      'ALTER TABLE import_queue ADD COLUMN source_path TEXT',
      'ALTER TABLE import_queue ADD COLUMN source_filename TEXT',
      'ALTER TABLE import_queue ADD COLUMN destination_path TEXT',
      'ALTER TABLE import_queue ADD COLUMN photo_id TEXT',
      'ALTER TABLE import_queue ADD COLUMN detected_at TEXT',
      'ALTER TABLE import_queue ADD COLUMN imported_at TEXT',
      'CREATE INDEX IF NOT EXISTS idx_photos_source_type ON photos(source_type)',
      'CREATE INDEX IF NOT EXISTS idx_import_queue_source_type ON import_queue(source_type)',
      'CREATE INDEX IF NOT EXISTS idx_import_queue_source_path ON import_queue(source_path)',
    ],
  },
  {
    id: 3,
    name: 'filename_session_routing_metadata',
    statements: [
      'ALTER TABLE photos ADD COLUMN source_filename TEXT',
      'ALTER TABLE photos ADD COLUMN session_key TEXT',
      'ALTER TABLE photos ADD COLUMN sequence_number INTEGER',
      'ALTER TABLE photos ADD COLUMN sequence_label TEXT',
      'ALTER TABLE photos ADD COLUMN routing_status TEXT',
      'ALTER TABLE photos ADD COLUMN routing_reason TEXT',
      'ALTER TABLE import_queue ADD COLUMN parsed_session_key TEXT',
      'ALTER TABLE import_queue ADD COLUMN parsed_sequence_number INTEGER',
      'ALTER TABLE import_queue ADD COLUMN routing_status TEXT',
      'ALTER TABLE import_queue ADD COLUMN routing_reason TEXT',
      'CREATE INDEX IF NOT EXISTS idx_photos_session_key ON photos(session_key)',
      'CREATE INDEX IF NOT EXISTS idx_photos_sequence_number ON photos(sequence_number)',
      'CREATE INDEX IF NOT EXISTS idx_import_queue_routing_status ON import_queue(routing_status)',
    ],
  },
  {
    id: 4,
    name: 'image_streams_foundation',
    statements: [
      `CREATE TABLE IF NOT EXISTS image_streams (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        code TEXT,
        type TEXT NOT NULL,
        enabled INTEGER NOT NULL,
        watch_path TEXT,
        status TEXT NOT NULL,
        last_activity_at TEXT,
        last_detected_filename TEXT,
        last_imported_filename TEXT,
        total_detected INTEGER NOT NULL,
        total_imported INTEGER NOT NULL,
        total_skipped INTEGER NOT NULL,
        total_failed INTEGER NOT NULL,
        files_per_minute REAL,
        capture_location_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      'ALTER TABLE photos ADD COLUMN image_stream_id TEXT',
      'ALTER TABLE photos ADD COLUMN image_stream_name TEXT',
      'ALTER TABLE import_queue ADD COLUMN image_stream_id TEXT',
      'ALTER TABLE import_queue ADD COLUMN image_stream_name TEXT',
      'ALTER TABLE import_queue ADD COLUMN stream_type TEXT',
      'CREATE INDEX IF NOT EXISTS idx_image_streams_slug ON image_streams(slug)',
      'CREATE INDEX IF NOT EXISTS idx_image_streams_enabled ON image_streams(enabled)',
      'CREATE INDEX IF NOT EXISTS idx_photos_image_stream_id ON photos(image_stream_id)',
      'CREATE INDEX IF NOT EXISTS idx_import_queue_image_stream_id ON import_queue(image_stream_id)',
    ],
  },
  {
    id: 5,
    name: 'image_stream_setup_fields',
    statements: [
      'ALTER TABLE image_streams ADD COLUMN processing_preset TEXT',
      'ALTER TABLE image_streams ADD COLUMN printer_name TEXT',
      'ALTER TABLE image_streams ADD COLUMN auto_print_enabled INTEGER',
    ],
  },
  {
    id: 6,
    name: 'image_stream_file_naming',
    statements: [
      'ALTER TABLE image_streams ADD COLUMN file_renaming_enabled INTEGER',
      'ALTER TABLE image_streams ADD COLUMN file_naming_fields_json TEXT',
      'ALTER TABLE image_streams ADD COLUMN file_naming_separator TEXT',
      'ALTER TABLE image_streams ADD COLUMN file_naming_extension TEXT',
    ],
  },
  {
    id: 7,
    name: 'image_stream_auto_print_items',
    statements: [
      'ALTER TABLE image_streams ADD COLUMN auto_print_items_json TEXT',
    ],
  },
  {
    id: 8,
    name: 'photo_versions_table',
    statements: [
      `CREATE TABLE IF NOT EXISTS photo_versions (
        id TEXT PRIMARY KEY,
        photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
        kind TEXT NOT NULL,
        storage_path TEXT NOT NULL,
        display_url TEXT NOT NULL,
        created_at TEXT NOT NULL,
        file_size_mb REAL NOT NULL DEFAULT 0
      )`,
      'CREATE INDEX IF NOT EXISTS idx_photo_versions_photo_id ON photo_versions(photo_id)',
    ],
  },
  {
    id: 9,
    name: 'photo_auto_enhance_fields',
    statements: [
      'ALTER TABLE photos ADD COLUMN auto_enhance_enabled INTEGER DEFAULT 0',
      "ALTER TABLE photos ADD COLUMN active_version_kind TEXT DEFAULT 'original'",
      'ALTER TABLE image_streams ADD COLUMN auto_enhance_enabled INTEGER DEFAULT 0',
    ],
  },
  {
    id: 10,
    name: 'stream_enhance_params',
    statements: [
      'ALTER TABLE image_streams ADD COLUMN enhance_saturation REAL DEFAULT 1.08',
      'ALTER TABLE image_streams ADD COLUMN enhance_sharpen REAL DEFAULT 0.25',
    ],
  },
  {
    id: 11,
    name: 'stream_enhance_tonal',
    statements: [
      'ALTER TABLE image_streams ADD COLUMN enhance_brightness REAL DEFAULT 0',
      'ALTER TABLE image_streams ADD COLUMN enhance_contrast REAL DEFAULT 0',
    ],
  },
  {
    id: 12,
    name: 'photo_content_hash',
    statements: [
      'ALTER TABLE photos ADD COLUMN content_hash TEXT',
      'CREATE INDEX IF NOT EXISTS idx_photos_content_hash ON photos(content_hash)',
    ],
  },
];
