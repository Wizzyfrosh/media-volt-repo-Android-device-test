import type { Db, SqlParam } from '@/db/types';
import { configureConnection, runMigrations } from '@/db/migrations';

// Node's built-in SQLite stands in for the native module. getBuiltinModule bypasses Jest's resolver.
const { DatabaseSync } = (
  process as unknown as { getBuiltinModule: (id: string) => typeof import('node:sqlite') }
).getBuiltinModule('node:sqlite');

/** A Db backed by real SQLite. Pass a file path to test data surviving a reopen. */
export function createTestDb(file = ':memory:'): Db & { close: () => void } {
  const raw = new DatabaseSync(file);
  const bind = (p?: SqlParam[]) => (p ?? []) as (string | number | null)[];

  return {
    close: () => raw.close(),
    execAsync: async (sql) => {
      raw.exec(sql);
    },
    runAsync: async (sql, params) => {
      const r = raw.prepare(sql).run(...bind(params));
      return { changes: Number(r.changes), lastInsertRowId: Number(r.lastInsertRowid) };
    },
    getFirstAsync: async <T>(sql: string, params?: SqlParam[]) => {
      const row = raw.prepare(sql).get(...bind(params));
      return (row ? { ...row } : null) as T | null;
    },
    getAllAsync: async <T>(sql: string, params?: SqlParam[]) =>
      raw
        .prepare(sql)
        .all(...bind(params))
        .map((r) => ({ ...r })) as T[],
    withTransactionAsync: async (task) => {
      raw.exec('BEGIN');
      try {
        await task();
        raw.exec('COMMIT');
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      }
    },
  };
}

/** A migrated, ready-to-use database. */
export async function createMigratedDb(file?: string) {
  const db = createTestDb(file);
  await configureConnection(db);
  await runMigrations(db);
  return db;
}
