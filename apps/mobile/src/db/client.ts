import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { configureConnection, runMigrations } from './migrations';
import type { Db } from './types';

const DB_NAME = 'mediavault.db';

/** Adapts expo-sqlite to the small Db interface the repositories use. */
export function wrapExpoDatabase(native: SQLiteDatabase): Db {
  return {
    execAsync: (sql) => native.execAsync(sql),
    runAsync: async (sql, params = []) => {
      const r = await native.runAsync(sql, params);
      return { changes: r.changes, lastInsertRowId: r.lastInsertRowId };
    },
    getFirstAsync: <T>(sql: string, params: (string | number | null)[] = []) =>
      native.getFirstAsync<T>(sql, params),
    getAllAsync: <T>(sql: string, params: (string | number | null)[] = []) =>
      native.getAllAsync<T>(sql, params),
    withTransactionAsync: (task) => native.withTransactionAsync(task),
  };
}

/** Opens the on-device database and brings its schema up to date. */
export async function openAppDatabase(): Promise<Db> {
  const db = wrapExpoDatabase(await openDatabaseAsync(DB_NAME));
  await configureConnection(db);
  await runMigrations(db);
  return db;
}
