import type Database from '@tauri-apps/plugin-sql';
import { isTauriRuntime } from '../../runtime/runtime';
import { MIGRATIONS, type Migration } from './migrations';
import { DATABASE_URL } from './schema';

let databasePromise: Promise<Database> | null = null;

export async function getDatabase(): Promise<Database> {
  if (!isTauriRuntime()) {
    throw new Error('SQLite metadata store is only available in Tauri desktop mode.');
  }

  if (!databasePromise) {
    databasePromise = import('@tauri-apps/plugin-sql').then(module => module.default.load(DATABASE_URL));
  }

  return databasePromise;
}

async function hasMigration(db: Database, id: number): Promise<boolean> {
  try {
    const rows = await db.select<{ id: number }[]>('SELECT id FROM schema_migrations WHERE id = $1', [id]);
    return rows.length > 0;
  } catch {
    return false;
  }
}

// ── Legacy runner (migrations 1-12) ─────────────────────────────────────────
// Databases in the field may already be in half-applied states from the old
// non-transactional runner, so replaying these migrations must tolerate
// "already exists" from CREATE TABLE/INDEX IF NOT EXISTS. "duplicate column name"
// is intentionally NOT swallowed: after freezing the v1 schema a fresh DB replays
// with no duplicate-column errors, so any such error signals a real migration bug.
const LAST_LEGACY_MIGRATION_ID = 12;

function isBenignMigrationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already exists/i.test(message);
}

async function runLegacyMigration(db: Database, migration: Migration): Promise<void> {
  for (const statement of migration.statements) {
    try {
      await db.execute(statement);
    } catch (error) {
      if (!isBenignMigrationError(error)) throw error;
    }
  }
  await db.execute(
    'INSERT OR IGNORE INTO schema_migrations (id, name, applied_at) VALUES ($1, $2, $3)',
    [migration.id, migration.name, new Date().toISOString()],
  );
}

// ── Transactional runner (migrations 13+) ───────────────────────────────────
// The whole migration — statements plus its schema_migrations row — executes as
// ONE multi-statement string in ONE db.execute call. That matters: the plugin's
// sqlx pool holds multiple connections, so BEGIN/COMMIT issued as separate
// execute calls could land on different connections. A single call runs all
// statements sequentially on one handle, making the migration all-or-nothing.
// No benign-error swallowing here: a failed statement rolls back and surfaces.
async function runTransactionalMigration(db: Database, migration: Migration): Promise<void> {
  const record =
    'INSERT INTO schema_migrations (id, name, applied_at) VALUES '
    + `(${migration.id}, '${migration.name.replace(/'/g, "''")}', '${new Date().toISOString()}')`;
  const batch = ['BEGIN IMMEDIATE', ...migration.statements, record, 'COMMIT'].join(';\n') + ';';
  try {
    await db.execute(batch);
  } catch (error) {
    try {
      await db.execute('ROLLBACK');
    } catch {
      // No open transaction on this connection — nothing to roll back.
    }
    throw error;
  }
}

export async function runMigrations(): Promise<void> {
  const db = await getDatabase();

  for (const migration of MIGRATIONS) {
    if (await hasMigration(db, migration.id)) continue;

    try {
      if (migration.id <= LAST_LEGACY_MIGRATION_ID) {
        await runLegacyMigration(db, migration);
      } else {
        await runTransactionalMigration(db, migration);
      }
    } catch (error) {
      console.error(`[PhotoFlow] SQLite migration failed: ${migration.name}`, error);
      throw error;
    }
  }
}

export async function initializeDatabase(): Promise<void> {
  await runMigrations();
}
