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

export async function runMigrations(): Promise<void> {
  const db = await getDatabase();

  for (const migration of MIGRATIONS) {
    if (await hasMigration(db, migration.id)) continue;

    try {
      for (const statement of migration.statements) {
        await db.execute(statement);
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
