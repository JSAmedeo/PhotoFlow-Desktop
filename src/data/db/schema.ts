export const DATABASE_URL = 'sqlite:photoflow.db';

export const INITIAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  session_code TEXT NOT NULL UNIQUE,
  barcode TEXT NOT NULL,
  capture_location_id TEXT NOT NULL,
  capture_location_label TEXT NOT NULL,
  handler TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  photo_count INTEGER NOT NULL,
  status TEXT NOT NULL,
  notes TEXT NOT NULL,
  linked_session_ids_json TEXT NOT NULL,
  tint_json TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS photos (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  filename TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  display_url TEXT NOT NULL,
  before_image_url TEXT NOT NULL,
  after_image_url TEXT NOT NULL,
  created_at TEXT NOT NULL,
  capture_location_id TEXT NOT NULL,
  processing_status TEXT NOT NULL,
  flag TEXT NOT NULL,
  is_favorite INTEGER NOT NULL,
  is_hidden INTEGER NOT NULL,
  operator_notes TEXT NOT NULL,
  enhance_version TEXT NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  file_size_mb REAL NOT NULL,
  file_format TEXT NOT NULL,
  original_path TEXT,
  storage_kind TEXT,
  storage_path TEXT,
  original_filename TEXT,
  size_bytes INTEGER,
  last_modified INTEGER,
  imported_file_json TEXT,
  FOREIGN KEY (session_id) REFERENCES sessions(id)
);

CREATE TABLE IF NOT EXISTS capture_locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  is_active INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS image_streams (
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
  processing_preset TEXT,
  printer_name TEXT,
  auto_print_enabled INTEGER,
  auto_print_items_json TEXT,
  file_renaming_enabled INTEGER,
  file_naming_fields_json TEXT,
  file_naming_separator TEXT,
  file_naming_extension TEXT,
  capture_location_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS hour_buckets (
  h TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  sub TEXT NOT NULL,
  count INTEGER NOT NULL,
  flagged INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS import_queue (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  session_id TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER NOT NULL,
  file_size INTEGER,
  last_modified INTEGER,
  error TEXT,
  created_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS app_state (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_session_code ON sessions(session_code);
CREATE INDEX IF NOT EXISTS idx_photos_session_id ON photos(session_id);
CREATE INDEX IF NOT EXISTS idx_photos_created_at ON photos(created_at);
CREATE INDEX IF NOT EXISTS idx_photos_storage_kind ON photos(storage_kind);
CREATE INDEX IF NOT EXISTS idx_image_streams_slug ON image_streams(slug);
CREATE INDEX IF NOT EXISTS idx_image_streams_enabled ON image_streams(enabled);
CREATE INDEX IF NOT EXISTS idx_import_queue_session_id ON import_queue(session_id);
`;
