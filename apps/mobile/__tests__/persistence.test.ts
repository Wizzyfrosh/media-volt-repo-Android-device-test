import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRepositories } from '@/db/repositories';
import { runMigrations, configureConnection } from '@/db/migrations';
import { FileService } from '@/services/file-service';
import { createMemoryFs } from './helpers/memory-fs';
import { createTestDb } from './helpers/test-db';

describe('data survives an app restart', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mv-db-'));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('reopening the database file shows the same folders, files and settings', async () => {
    const file = join(dir, 'app.db');
    const fs = createMemoryFs();

    // first launch
    const db1 = createTestDb(file);
    await configureConnection(db1);
    await runMigrations(db1);
    const repos1 = createRepositories(db1);
    const svc = new FileService({ repos: repos1, fs });
    const folder = await svc.createFolder('Trips');
    fs.seed('/tmp/a.mp4', 321);
    const f = await svc.importFile({ sourcePath: '/tmp/a.mp4', folderId: folder.id });
    await repos1.settings.set('lastFolder', folder.id);
    db1.close();

    // second launch: new connection, migrations run again and change nothing
    const db2 = createTestDb(file);
    await configureConnection(db2);
    expect(await runMigrations(db2)).toEqual([]);
    const repos2 = createRepositories(db2);
    expect((await repos2.folders.listChildren(null)).map((x) => x.name)).toEqual(['Trips']);
    expect(await repos2.files.getById(f.id)).toEqual(f);
    expect(await repos2.settings.get('lastFolder')).toBe(folder.id);
    db2.close();
  });
});
