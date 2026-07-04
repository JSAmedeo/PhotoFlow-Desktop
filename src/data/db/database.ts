import type Database from '@tauri-apps/plugin-sql';
import { isTauriRuntime } from '../../runtime/runtime';
import { MIGRATIONS } from './migrations';
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

// Only "already exists" (from CREATE TABLE/INDEX IF NOT EXISTS replays) is swallowed.
// "duplicate column name" is intentionally NOT swallowed any more: after freezing the v1
// schema, a fresh DB replays with no duplicate-column errors, so any such error now signals
// a real migration bug that must surface instead of being hidden.
function isBenignMigrationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /already exists/i.test(message);
}

export async function runMigrations(): Promise<void> {
  const db = await getDatabase();

  for (const migration of MIGRATIONS) {
    if (await hasMigration(db, migration.id)) continue;

    try {
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
    } catch (error) {
      console.error(`[PhotoFlow] SQLite migration failed: ${migration.name}`, error);
      throw error;
    }
  }
}

export async function initializeDatabase(): Promise<void> {
  await runMigrations();
}
