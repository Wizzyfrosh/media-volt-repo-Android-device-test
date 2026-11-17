import type { Db } from '../types';

/** Key-value settings stored in SQLite. Not for secrets. */
export class SettingsRepo {
  constructor(private readonly db: Db) {}

  async get(key: string): Promise<string | null> {
    const r = await this.db.getFirstAsync<{ value: string | null }>(
      'SELECT value FROM settings WHERE key = ?',
      [key],
    );
    return r?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
      [key, value],
    );
  }

  async getJson<T>(key: string): Promise<T | null> {
    const raw = await this.get(key);
    if (raw === null) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  }

  async setJson(key: string, value: unknown): Promise<void> {
    await this.set(key, JSON.stringify(value));
  }

  async delete(key: string): Promise<void> {
    await this.db.runAsync('DELETE FROM settings WHERE key = ?', [key]);
  }
}
