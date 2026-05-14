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
];
