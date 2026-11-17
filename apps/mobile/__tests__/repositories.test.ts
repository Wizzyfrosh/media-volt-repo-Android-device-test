import { createRepositories, type Repositories } from '@/db/repositories';
import { newId } from '@/db/ids';
import { createMigratedDb } from './helpers/test-db';

let repos: Repositories;
let clock = 1_000;
const tick = () => (clock += 10);

beforeEach(async () => {
  clock = 1_000;
  repos = createRepositories(await createMigratedDb(), tick);
});

const addFile = (over: Partial<Parameters<Repositories['files']['insert']>[0]> = {}) =>
  repos.files.insert({
    folderId: null,
    name: 'clip.mp4',
    path: '/lib/x.mp4',
    mime: 'video/mp4',
    category: 'videos',
    sizeBytes: 100,
    ...over,
  });

describe('newId', () => {
  it('does not collide across many ids', () => {
    const ids = new Set(Array.from({ length: 20_000 }, () => newId()));
    expect(ids.size).toBe(20_000);
  });
});

describe('folders', () => {
  it('lists children by parent, sorted case-insensitively', async () => {
    const a = await repos.folders.insert({ name: 'beta', parentId: null });
    await repos.folders.insert({ name: 'Alpha', parentId: null });
    await repos.folders.insert({ name: 'inner', parentId: a.id });
    expect((await repos.folders.listChildren(null)).map((f) => f.name)).toEqual(['Alpha', 'beta']);
    expect((await repos.folders.listChildren(a.id)).map((f) => f.name)).toEqual(['inner']);
  });

  it('finds siblings by name ignoring case, and can exclude itself', async () => {
    const f = await repos.folders.insert({ name: 'Movies', parentId: null });
    expect((await repos.folders.findByName(null, 'movies'))?.id).toBe(f.id);
    expect(await repos.folders.findByName(null, 'movies', f.id)).toBeNull();
  });

  it('returns a folder and every folder below it', async () => {
    const a = await repos.folders.insert({ name: 'a', parentId: null });
    const b = await repos.folders.insert({ name: 'b', parentId: a.id });
    const c = await repos.folders.insert({ name: 'c', parentId: b.id });
    const other = await repos.folders.insert({ name: 'other', parentId: null });
    const ids = await repos.folders.descendantIds(a.id);
    expect(ids.sort()).toEqual([a.id, b.id, c.id].sort());
    expect(ids).not.toContain(other.id);
  });

  it('deleting a folder removes the folders inside it and detaches files', async () => {
    const a = await repos.folders.insert({ name: 'a', parentId: null });
    const b = await repos.folders.insert({ name: 'b', parentId: a.id });
    const file = await addFile({ folderId: b.id });
    await repos.folders.delete(a.id);
    expect(await repos.folders.getById(b.id)).toBeNull();
    expect((await repos.files.getById(file.id))?.folderId).toBeNull();
  });

  it('counts non-trashed files per folder', async () => {
    const f = await repos.folders.insert({ name: 'f', parentId: null });
    await addFile({ folderId: f.id, name: 'a.mp4' });
    const gone = await addFile({ folderId: f.id, name: 'b.mp4' });
    await repos.files.setDeletedAt([gone.id], 5);
    expect(await repos.folders.itemCounts()).toEqual({ [f.id]: 1 });
  });
});

describe('files', () => {
  it('round-trips a record', async () => {
    const f = await addFile({ source: 'tiktok', durationSec: 42 });
    expect(await repos.files.getById(f.id)).toEqual(f);
  });

  it('filters by folder: undefined = any, null = top level, id = that folder', async () => {
    const folder = await repos.folders.insert({ name: 'f', parentId: null });
    await addFile({ name: 'root.mp4' });
    await addFile({ name: 'inside.mp4', folderId: folder.id });
    expect(await repos.files.list()).toHaveLength(2);
    expect((await repos.files.list({ folderId: null })).map((f) => f.name)).toEqual(['root.mp4']);
    expect((await repos.files.list({ folderId: folder.id })).map((f) => f.name)).toEqual([
      'inside.mp4',
    ]);
  });

  it('filters by category and favorites', async () => {
    await addFile({ name: 'a.mp4' });
    const pic = await addFile({ name: 'b.png', category: 'images', mime: 'image/png' });
    await repos.files.update(pic.id, { isFavorite: true });
    expect((await repos.files.list({ category: 'images' })).map((f) => f.name)).toEqual(['b.png']);
    expect((await repos.files.list({ favoritesOnly: true })).map((f) => f.id)).toEqual([pic.id]);
  });

  it('searches names literally, so % and _ are not wildcards', async () => {
    await addFile({ name: '100%_done.mp4' });
    await addFile({ name: 'other.mp4' });
    expect(await repos.files.list({ search: '100%' })).toHaveLength(1);
    expect(await repos.files.list({ search: '_' })).toHaveLength(1);
    expect(await repos.files.list({ search: 'OTHER' })).toHaveLength(1);
    expect(await repos.files.list({ search: '  ' })).toHaveLength(2);
  });

  it('sorts by name, size and date and pages results', async () => {
    await addFile({ name: 'b.mp4', sizeBytes: 5 });
    await addFile({ name: 'A.mp4', sizeBytes: 50 });
    await addFile({ name: 'c.mp4', sizeBytes: 20 });
    const names = async (q: Parameters<Repositories['files']['list']>[0]) =>
      (await repos.files.list(q)).map((f) => f.name);
    expect(await names({ sort: 'name' })).toEqual(['A.mp4', 'b.mp4', 'c.mp4']);
    expect(await names({ sort: 'size' })).toEqual(['A.mp4', 'c.mp4', 'b.mp4']);
    expect(await names({ sort: 'date' })).toEqual(['c.mp4', 'A.mp4', 'b.mp4']);
    expect(await names({ sort: 'name', limit: 2, offset: 1 })).toEqual(['b.mp4', 'c.mp4']);
  });

  it('keeps trashed files out of normal lists and counts', async () => {
    const a = await addFile({ name: 'a.mp4' });
    await addFile({ name: 'b.mp4' });
    await repos.files.setDeletedAt([a.id], 99);
    expect(await repos.files.list()).toHaveLength(1);
    expect((await repos.files.list({ trashed: true })).map((f) => f.id)).toEqual([a.id]);
    expect(await repos.files.count()).toBe(1);
    expect(await repos.files.count(true)).toBe(1);
    expect((await repos.files.countByCategory()).videos).toBe(1);
  });

  it('finds the same name only among live files in the same folder', async () => {
    const f = await addFile({ name: 'Clip.mp4' });
    expect((await repos.files.findByName(null, 'clip.MP4'))?.id).toBe(f.id);
    expect(await repos.files.findByName(null, 'clip.mp4', f.id)).toBeNull();
    await repos.files.setDeletedAt([f.id], 1);
    expect(await repos.files.findByName(null, 'clip.mp4')).toBeNull();
  });

  it('updates only the fields given and bumps updated_at', async () => {
    const f = await addFile();
    await repos.files.update(f.id, { name: 'new.mp4' });
    const after = (await repos.files.getById(f.id))!;
    expect(after.name).toBe('new.mp4');
    expect(after.sizeBytes).toBe(f.sizeBytes);
    expect(after.updatedAt).toBeGreaterThan(f.updatedAt);
  });

  it('handles id lists larger than one SQL chunk', async () => {
    const ids: string[] = [];
    for (let i = 0; i < 1200; i++)
      ids.push((await addFile({ name: `f${i}.mp4`, path: `/p/${i}` })).id);
    await repos.files.setDeletedAt(ids, 7);
    expect(await repos.files.count(true)).toBe(1200);
    await repos.files.deleteMany(ids);
    expect(await repos.files.count(true)).toBe(0);
  });

  it('sums sizes per category', async () => {
    await addFile({ sizeBytes: 10 });
    await addFile({ name: 'b.mp4', sizeBytes: 15 });
    await addFile({ name: 'c.pdf', category: 'documents', sizeBytes: 3 });
    const s = await repos.files.sizeByCategory();
    expect([s.videos, s.documents, s.audio]).toEqual([25, 3, 0]);
  });
});

describe('downloads', () => {
  it('stores and updates a download', async () => {
    const d = await repos.downloads.insert({ sourceUrl: 'https://example.com/a.mp4', title: 'A' });
    expect(d.status).toBe('queued');
    await repos.downloads.update(d.id, { status: 'downloading', bytesDone: 50, bytesTotal: 100 });
    const after = (await repos.downloads.getById(d.id))!;
    expect([after.status, after.bytesDone, after.bytesTotal]).toEqual(['downloading', 50, 100]);
  });

  it('lists by status and counts', async () => {
    const a = await repos.downloads.insert({ sourceUrl: 'https://e.com/1' });
    await repos.downloads.insert({ sourceUrl: 'https://e.com/2', status: 'failed' });
    expect((await repos.downloads.listByStatus(['queued'])).map((d) => d.id)).toEqual([a.id]);
    expect(await repos.downloads.listByStatus([])).toEqual([]);
    expect(await repos.downloads.countByStatus()).toEqual({ queued: 1, failed: 1 });
  });

  it('keeps the download when its file is deleted', async () => {
    const file = await addFile();
    const d = await repos.downloads.insert({ sourceUrl: 'https://e.com/1' });
    await repos.downloads.update(d.id, { fileId: file.id });
    await repos.files.deleteMany([file.id]);
    expect((await repos.downloads.getById(d.id))?.fileId).toBeNull();
  });
});

describe('settings', () => {
  it('sets, overwrites, reads and deletes values', async () => {
    expect(await repos.settings.get('k')).toBeNull();
    await repos.settings.set('k', 'v1');
    await repos.settings.set('k', 'v2');
    expect(await repos.settings.get('k')).toBe('v2');
    await repos.settings.delete('k');
    expect(await repos.settings.get('k')).toBeNull();
  });

  it('round-trips JSON and tolerates corrupt values', async () => {
    await repos.settings.setJson('j', { a: [1, 2] });
    expect(await repos.settings.getJson('j')).toEqual({ a: [1, 2] });
    await repos.settings.set('bad', '{nope');
    expect(await repos.settings.getJson('bad')).toBeNull();
  });
});
