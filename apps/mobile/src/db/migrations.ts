import type { Db } from './types';

export interface Migration {
  version: number;
  name: string;
  sql: string;
}

/**
 * Append-only. Never edit a migration that has shipped: add a new one.
 * Versions must be 1, 2, 3, ... with no gaps.
 */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    name: 'initial schema',
    sql: `
      CREATE TABLE folders (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        parent_id TEXT REFERENCES folders(id) ON DELETE CASCADE,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX idx_folders_parent ON folders(parent_id);

      CREATE TABLE files (
        id TEXT PRIMARY KEY NOT NULL,
        folder_id TEXT REFERENCES folders(id) ON DELETE SET NULL,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        mime TEXT,
        category TEXT NOT NULL,
        size_bytes INTEGER NOT NULL DEFAULT 0,
        source TEXT,
        thumbnail_path TEXT,
        duration_sec INTEGER,
        is_favorite INTEGER NOT NULL DEFAULT 0,
        deleted_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX idx_files_category ON files(category, deleted_at);
      CREATE INDEX idx_files_folder ON files(folder_id, deleted_at);
      CREATE INDEX idx_files_name ON files(name COLLATE NOCASE);
      CREATE INDEX idx_files_deleted ON files(deleted_at);

      CREATE TABLE downloads (
        id TEXT PRIMARY KEY NOT NULL,
        file_id TEXT REFERENCES files(id) ON DELETE SET NULL,
        source_url TEXT NOT NULL,
        direct_url TEXT,
        title TEXT,
        status TEXT NOT NULL,
        bytes_total INTEGER,
        bytes_done INTEGER NOT NULL DEFAULT 0,
        retries INTEGER NOT NULL DEFAULT 0,
        error_code TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE INDEX idx_downloads_status ON downloads(status);

      CREATE TABLE vault_items (
        id TEXT PRIMARY KEY NOT NULL,
        file_id TEXT,
        encrypted_path TEXT NOT NULL,
        iv TEXT NOT NULL,
        original_name TEXT,
        added_at INTEGER NOT NULL
      );

      CREATE TABLE settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT
      );
    `,
  },
];

/** Connection settings applied every time the database is opened. */
export async function configureConnection(db: Db): Promise<void> {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
}

function validate(migrations: readonly Migration[]): void {
  migrations.forEach((m, i) => {
    if (m.version !== i + 1) {
      throw new Error(
        `Migration versions must be sequential from 1. Found ${m.version} at position ${i + 1}.`,
      );
    }
  });
}

/** Applies pending migrations, each in its own transaction. Returns the versions applied. */
export async function runMigrations(
  db: Db,
  migrations: readonly Migration[] = MIGRATIONS,
  now: () => number = Date.now,
): Promise<number[]> {
  validate(migrations);

  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS schema_version (version INTEGER PRIMARY KEY NOT NULL, name TEXT, applied_at INTEGER NOT NULL)',
  );
  const row = await db.getFirstAsync<{ v: number | null }>(
    'SELECT MAX(version) AS v FROM schema_version',
  );
  const current = row?.v ?? 0;
  const latest = migrations.length;

  if (current > latest) {
    throw new Error(
      `This database is at version ${current} but the app only knows up to ${latest}. Update the app.`,
    );
  }

  const applied: number[] = [];
  for (const m of migrations.slice(current)) {
    await db.withTransactionAsync(async () => {
      await db.execAsync(m.sql);
      await db.runAsync('INSERT INTO schema_version (version, name, applied_at) VALUES (?, ?, ?)', [
        m.version,
        m.name,
        now(),
      ]);
    });
    applied.push(m.version);
  }
  return applied;
}

export async function currentSchemaVersion(db: Db): Promise<number> {
  const row = await db.getFirstAsync<{ v: number | null }>(
    'SELECT MAX(version) AS v FROM schema_version',
  );
  return row?.v ?? 0;
}
