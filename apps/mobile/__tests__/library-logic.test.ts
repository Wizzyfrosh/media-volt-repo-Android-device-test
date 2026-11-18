import { createRepositories, type Repositories } from '@/db/repositories';
import type { FileCategory } from '@/db/types';
import {
  buildItems,
  isFlat,
  loadLibrary,
  toFileQuery,
  type LibraryQuery,
} from '@/features/library/query';
import {
  EMPTY_SELECTION,
  isItemSelected,
  isSelecting,
  pruneSelection,
  selectAll,
  selectionCount,
  toggleFile,
  toggleFolder,
  toggleItem,
} from '@/features/library/selection';
import { flattenFolderTree, folderPath } from '@/features/library/folder-tree';
import { removePerfFiles, seedPerfFiles } from '@/dev/seed';
import { FileService } from '@/services/file-service';
import { formatShortDate } from '@/utils/format';
import { useAppStore } from '@/stores/app-store';
import { createMemoryFs } from './helpers/memory-fs';
import { createMigratedDb } from './helpers/test-db';

let repos: Repositories;
let clock = 1_000;
beforeEach(async () => {
  clock = 1_000;
  repos = createRepositories(await createMigratedDb(), () => (clock += 10));
});

const q = (over: Partial<LibraryQuery> = {}): LibraryQuery => ({
  folderId: null,
  filter: 'all',
  search: '',
  sort: 'name',
  direction: 'asc',
  ...over,
});
const add = (name: string, category: FileCategory, over: Record<string, unknown> = {}) =>
  repos.files.insert({
    folderId: null,
    name,
    path: `/p/${name}`,
    mime: null,
    category,
    sizeBytes: 10,
    ...over,
  });

describe('loadLibrary', () => {
  it('browses one folder at a time, with folders listed and counted', async () => {
    const trips = await repos.folders.insert({ name: 'Trips', parentId: null });
    await add('root.mp4', 'videos');
    await add('inside.mp4', 'videos', { folderId: trips.id });

    const root = await loadLibrary(repos, q());
    expect(root.flat).toBe(false);
    expect(root.folders.map((f) => f.name)).toEqual(['Trips']);
    expect(root.folderCounts).toEqual({ [trips.id]: 1 });
    expect(root.files.map((f) => f.name)).toEqual(['root.mp4']);

    const inside = await loadLibrary(repos, q({ folderId: trips.id }));
    expect(inside.files.map((f) => f.name)).toEqual(['inside.mp4']);
  });

  it('a category filter lists matching files from every folder, without folders', async () => {
    const f = await repos.folders.insert({ name: 'F', parentId: null });
    await add('a.mp4', 'videos');
    await add('b.mp4', 'videos', { folderId: f.id });
    await add('c.pdf', 'documents');

    const data = await loadLibrary(repos, q({ filter: 'videos' }));
    expect(data.flat).toBe(true);
    expect(data.folders).toEqual([]);
    expect(data.files.map((x) => x.name)).toEqual(['a.mp4', 'b.mp4']);
  });

  it('shows favorites across folders', async () => {
    const a = await add('a.mp4', 'videos');
    await add('b.mp4', 'videos');
    await repos.files.update(a.id, { isFavorite: true });
    expect((await loadLibrary(repos, q({ filter: 'favorites' }))).files.map((x) => x.name)).toEqual(
      ['a.mp4'],
    );
  });

  it('searches names everywhere, even with a category open, and treats blank text as no search', async () => {
    await add('Holiday.mp4', 'videos');
    await add('holiday notes.txt', 'documents');
    await add('other.mp4', 'videos');
    expect((await loadLibrary(repos, q({ search: 'holiday' }))).files).toHaveLength(2);
    expect(
      (await loadLibrary(repos, q({ search: 'holiday', filter: 'videos' }))).files.map(
        (x) => x.name,
      ),
    ).toEqual(['Holiday.mp4']);
    expect(isFlat(q({ search: '   ' }))).toBe(false);
  });

  it('sorts by name, size and date in both directions', async () => {
    await add('b', 'other', { sizeBytes: 5 });
    await add('a', 'other', { sizeBytes: 50 });
    await add('c', 'other', { sizeBytes: 20 });
    const names = async (o: Partial<LibraryQuery>) =>
      (await loadLibrary(repos, q(o))).files.map((f) => f.name);
    expect(await names({ sort: 'name', direction: 'asc' })).toEqual(['a', 'b', 'c']);
    expect(await names({ sort: 'name', direction: 'desc' })).toEqual(['c', 'b', 'a']);
    expect(await names({ sort: 'size', direction: 'desc' })).toEqual(['a', 'c', 'b']);
    expect(await names({ sort: 'date', direction: 'desc' })).toEqual(['c', 'a', 'b']);
  });

  it('reports totals, per-category counts and the trash size, ignoring trashed files', async () => {
    const gone = await add('x.mp4', 'videos');
    await add('y.mp4', 'videos');
    await add('z.pdf', 'documents');
    await repos.files.setDeletedAt([gone.id], 5);
    const data = await loadLibrary(repos, q());
    expect(data.categoryCounts).toMatchObject({ videos: 1, documents: 1, audio: 0 });
    expect(data.totalFiles).toBe(2);
    expect(data.trashedCount).toBe(1);
  });

  it('turns screen choices into a database query', () => {
    expect(toFileQuery(q({ folderId: 'x' }))).toMatchObject({ folderId: 'x' });
    expect(toFileQuery(q({ filter: 'audio' }))).toMatchObject({ category: 'audio' });
    expect(toFileQuery(q({ filter: 'favorites' }))).toMatchObject({
      favoritesOnly: true,
      category: undefined,
    });
  });

  it('builds one list with folders first', async () => {
    await repos.folders.insert({ name: 'F', parentId: null });
    await add('a.mp4', 'videos');
    const items = buildItems(await loadLibrary(repos, q()));
    expect(items.map((i) => i.kind)).toEqual(['folder', 'file']);
    expect(new Set(items.map((i) => i.key)).size).toBe(2);
  });
});

describe('selection', () => {
  it('toggles files and folders independently', async () => {
    const folder = await repos.folders.insert({ name: 'F', parentId: null });
    const file = await add('a.mp4', 'videos');
    const items = buildItems(await loadLibrary(repos, q()));

    let s = EMPTY_SELECTION;
    expect(isSelecting(s)).toBe(false);
    s = toggleItem(s, items[0]!);
    s = toggleItem(s, items[1]!);
    expect([s.folders.has(folder.id), s.files.has(file.id), selectionCount(s)]).toEqual([
      true,
      true,
      2,
    ]);
    expect(isItemSelected(s, items[1]!)).toBe(true);
    s = toggleFile(s, file.id);
    expect(isItemSelected(s, items[1]!)).toBe(false);
    s = toggleFolder(s, folder.id);
    expect(isSelecting(s)).toBe(false);
  });

  it('does not change the old selection when toggling', () => {
    const a = toggleFile(EMPTY_SELECTION, 'x');
    const b = toggleFile(a, 'y');
    expect([a.files.size, b.files.size, EMPTY_SELECTION.files.size]).toEqual([1, 2, 0]);
  });

  it('selects all and prunes items that disappeared', async () => {
    await repos.folders.insert({ name: 'F', parentId: null });
    await add('a.mp4', 'videos');
    await add('b.mp4', 'videos');
    const items = buildItems(await loadLibrary(repos, q()));
    const all = selectAll(items);
    expect(selectionCount(all)).toBe(3);
    const pruned = pruneSelection(all, items.slice(0, 2));
    expect(selectionCount(pruned)).toBe(2);
    expect(pruneSelection(all, items)).toBe(all); // nothing changed, same object
  });
});

describe('folder tree', () => {
  it('lists folders in tree order with depth, and can exclude a branch', async () => {
    const a = await repos.folders.insert({ name: 'A', parentId: null });
    const a1 = await repos.folders.insert({ name: 'A1', parentId: a.id });
    await repos.folders.insert({ name: 'A1x', parentId: a1.id });
    await repos.folders.insert({ name: 'B', parentId: null });
    const all = await repos.folders.listAll();

    expect(flattenFolderTree(all).map((o) => `${o.depth}:${o.folder.name}`)).toEqual([
      '0:A',
      '1:A1',
      '2:A1x',
      '0:B',
    ]);
    expect(flattenFolderTree(all, new Set([a.id])).map((o) => o.folder.name)).toEqual(['B']);
    expect(folderPath(all, a1.id)).toBe('A / A1');
    expect(folderPath(all, null)).toBe('Library');
  });
});

describe('dates', () => {
  const now = new Date(2026, 10, 18, 15, 0).getTime();
  it('says Today, Yesterday, or the date', () => {
    expect(formatShortDate(new Date(2026, 10, 18, 1, 0).getTime(), now)).toBe('Today');
    expect(formatShortDate(new Date(2026, 10, 17, 23, 0).getTime(), now)).toBe('Yesterday');
    expect(formatShortDate(new Date(2026, 9, 3).getTime(), now)).toBe('Oct 3');
    expect(formatShortDate(new Date(2025, 11, 25).getTime(), now)).toBe('Dec 25, 2025');
  });
});

describe('library change events', () => {
  it('bump the version and notify listeners after every kind of change', async () => {
    const fs = createMemoryFs();
    let n = 0;
    const svc = new FileService({ repos, fs, newId: () => `id${++n}` });
    const calls: number[] = [];
    const off = svc.subscribe(() => calls.push(svc.getVersion()));

    fs.seed('/t/a.mp4');
    const folder = await svc.createFolder('F');
    const file = await svc.importFile({ sourcePath: '/t/a.mp4' });
    await svc.renameFile(file.id, 'b.mp4');
    await svc.moveFiles([file.id], folder.id);
    await svc.setFavorite([file.id], true);
    await svc.toggleFavorite(file.id);
    await svc.copyFile(file.id);
    await svc.renameFolder(folder.id, 'G');
    await svc.trashFiles([file.id]);
    await svc.restoreFiles([file.id]);
    await svc.trashFiles([file.id]);
    await svc.deleteForever([file.id]);
    await svc.deleteFolder(folder.id);

    expect(calls.length).toBeGreaterThanOrEqual(12);
    expect(calls).toEqual([...calls].sort((a, b) => a - b));
    off();
    await svc.createFolder('after unsubscribe');
    expect(calls.length).toBeGreaterThanOrEqual(12);
  });

  it('deleteForever only removes files that are already in the trash', async () => {
    const fs = createMemoryFs();
    const svc = new FileService({ repos, fs, newId: () => 'id1' });
    fs.seed('/t/a.mp4');
    const f = await svc.importFile({ sourcePath: '/t/a.mp4' });
    expect(await svc.deleteForever([f.id])).toBe(0);
    expect(fs.files.has(f.path)).toBe(true);
    await svc.trashFiles([f.id]);
    expect(await svc.deleteForever([f.id])).toBe(1);
    expect(fs.files.has(f.path)).toBe(false);
  });

  it('does not notify when a purge removes nothing', async () => {
    const svc = new FileService({ repos, fs: createMemoryFs() });
    let calls = 0;
    svc.subscribe(() => calls++);
    await svc.purgeExpiredTrash();
    expect(calls).toBe(0);
  });
});

describe('library preferences', () => {
  it('start as newest-first grid and can be changed', () => {
    const s = useAppStore.getState();
    expect([s.libraryView, s.librarySort, s.libraryDirection]).toEqual(['grid', 'date', 'desc']);
    s.setLibraryView('list');
    s.setLibrarySort('size', 'asc');
    const after = useAppStore.getState();
    expect([after.libraryView, after.librarySort, after.libraryDirection]).toEqual([
      'list',
      'size',
      'asc',
    ]);
  });
});

describe('scale: 5,000 files', () => {
  it('loads and filters a big library quickly (database side only)', async () => {
    const folders = [];
    for (let i = 0; i < 20; i++)
      folders.push(await repos.folders.insert({ name: `Folder ${i}`, parentId: null }));
    const cats: FileCategory[] = ['videos', 'audio', 'images', 'documents', 'archives', 'other'];
    for (let i = 0; i < 5000; i++) {
      await repos.files.insert({
        folderId: i % 5 === 0 ? folders[i % 20]!.id : null,
        name: `File ${i} ${i % 7 === 0 ? 'holiday' : 'misc'}.dat`,
        path: `/p/${i}`,
        mime: null,
        category: cats[i % 6]!,
        sizeBytes: (i * 7919) % 1_000_000,
      });
    }
    const time = async (label: string, fn: () => Promise<unknown>) => {
      const t0 = Date.now();
      await fn();
      const ms = Date.now() - t0;
      console.warn(`[perf] ${label}: ${ms} ms`);
      return ms;
    };

    const all = await time('all files, flat, sorted by name', () =>
      loadLibrary(repos, q({ filter: 'videos', sort: 'name' })),
    );
    const search = await time('search "holiday" across 5,000', () =>
      loadLibrary(repos, q({ search: 'holiday', sort: 'size', direction: 'desc' })),
    );
    const root = await time('root view (folders + top-level files + counts)', () =>
      loadLibrary(repos, q({ sort: 'date', direction: 'desc' })),
    );
    const items = buildItems(await loadLibrary(repos, q()));

    expect(all).toBeLessThan(1000);
    expect(search).toBeLessThan(1000);
    expect(root).toBeLessThan(1000);
    expect((await loadLibrary(repos, q({ filter: 'videos' }))).files).toHaveLength(
      Math.ceil(5000 / 6),
    );
    expect(items.length).toBeGreaterThan(3000);
  }, 60_000);
});

describe('test-data tool', () => {
  it('adds many rows in one go and removes only its own', async () => {
    const db = await createMigratedDb();
    const r = createRepositories(db);
    await r.files.insert({
      folderId: null,
      name: 'mine.pdf',
      path: '/p/mine',
      mime: null,
      category: 'documents',
      sizeBytes: 1,
      source: 'web',
    });
    await seedPerfFiles(db, r, 1200);
    expect(await r.files.count()).toBe(1201);
    expect(await removePerfFiles(r)).toBe(1200);
    expect((await r.files.list()).map((f) => f.name)).toEqual(['mine.pdf']);
  });
});
