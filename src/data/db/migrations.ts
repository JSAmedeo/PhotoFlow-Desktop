import { INITIAL_SCHEMA_SQL } from './schema';

export interface Migration {
  id: number;
  name: string;
  statements: string[];
}

function splitSqlStatements(sql: string): string[] {
  return sql
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean);
}

export const MIGRATIONS: Migration[] = [
  {
    id: 1,
    name: 'initial_metadata_schema',
    statements: splitSqlStatements(INITIAL_SCHEMA_SQL),
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
];
