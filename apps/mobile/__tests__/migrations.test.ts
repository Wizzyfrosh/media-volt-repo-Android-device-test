import { MIGRATIONS, runMigrations, currentSchemaVersion, type Migration } from '@/db/migrations';
import { createMigratedDb, createTestDb } from './helpers/test-db';

const tableNames = async (db: ReturnType<typeof createTestDb>) =>
  (
    await db.getAllAsync<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    )
  ).map((r) => r.name);

describe('migrations', () => {
  it('creates the full schema on a fresh database', async () => {
    const db = await createMigratedDb();
    expect(await tableNames(db)).toEqual(
      expect.arrayContaining([
        'folders',
        'files',
        'downloads',
        'vault_items',
        'settings',
        'schema_version',
      ]),
    );
    expect(await currentSchemaVersion(db)).toBe(MIGRATIONS.length);
  });

  it('is idempotent: a second run applies nothing', async () => {
    const db = await createMigratedDb();
    expect(await runMigrations(db)).toEqual([]);
    const rows = await db.getAllAsync('SELECT * FROM schema_version');
    expect(rows).toHaveLength(MIGRATIONS.length);
  });

  it('applies only the pending migrations, in order', async () => {
    const db = createTestDb();
    const m1: Migration = { version: 1, name: 'one', sql: 'CREATE TABLE a (id INTEGER)' };
    const m2: Migration = { version: 2, name: 'two', sql: 'CREATE TABLE b (id INTEGER)' };
    expect(await runMigrations(db, [m1])).toEqual([1]);
    expect(await runMigrations(db, [m1, m2])).toEqual([2]);
    expect(await currentSchemaVersion(db)).toBe(2);
  });

  it('rolls a failing migration back completely', async () => {
    const db = createTestDb();
    const ok: Migration = { version: 1, name: 'ok', sql: 'CREATE TABLE a (id INTEGER)' };
    const bad: Migration = {
      version: 2,
      name: 'bad',
      sql: 'CREATE TABLE b (id INTEGER); THIS IS NOT SQL;',
    };
    await expect(runMigrations(db, [ok, bad])).rejects.toThrow();
    expect(await currentSchemaVersion(db)).toBe(1);
    expect(await tableNames(db)).not.toContain('b');
  });

  it('rejects gaps in version numbers', async () => {
    const db = createTestDb();
    await expect(runMigrations(db, [{ version: 2, name: 'x', sql: 'SELECT 1' }])).rejects.toThrow(
      /sequential/,
    );
  });

  it('refuses a database that is newer than the app', async () => {
    const db = await createMigratedDb();
    await db.runAsync('INSERT INTO schema_version (version, name, applied_at) VALUES (99, ?, 0)', [
      'future',
    ]);
    await expect(runMigrations(db)).rejects.toThrow(/Update the app/);
  });

  it('enforces foreign keys', async () => {
    const db = await createMigratedDb();
    await expect(
      db.runAsync(
        "INSERT INTO folders (id, name, parent_id, created_at) VALUES ('a', 'x', 'missing', 0)",
      ),
    ).rejects.toThrow();
  });
});
