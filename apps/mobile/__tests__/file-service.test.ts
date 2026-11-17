import { createRepositories, type Repositories } from '@/db/repositories';
import { FileService, FileServiceError, TRASH_RETENTION_MS } from '@/services/file-service';
import { createMigratedDb } from './helpers/test-db';
import { createMemoryFs, fakeMedia, fakeThumbnails, type MemoryFs } from './helpers/memory-fs';

let repos: Repositories;
let fs: MemoryFs;
let svc: FileService;
let media: ReturnType<typeof fakeMedia>;
let clock: number;
let n: number;

beforeEach(async () => {
  clock = 1_700_000_000_000;
  n = 0;
  const now = () => (clock += 1);
  repos = createRepositories(await createMigratedDb(), now);
  fs = createMemoryFs();
  media = fakeMedia();
  svc = new FileService({
    repos,
    fs,
    thumbnails: fakeThumbnails(fs),
    media,
    now,
    newId: () => `id${++n}`,
  });
});

const drop = (path: string, size = 100) => fs.seed(path, size);

describe('importing', () => {
  it('moves the file into the library under its id and records it', async () => {
    drop('/tmp/My Clip.mp4', 2048);
    const f = await svc.importFile({ sourcePath: '/tmp/My Clip.mp4', source: 'web' });

    expect(f).toMatchObject({
      name: 'My Clip.mp4',
      category: 'videos',
      mime: 'video/mp4',
      sizeBytes: 2048,
      source: 'web',
    });
    expect(f.path).toBe('/data/library/id1.mp4');
    expect(fs.files.has('/tmp/My Clip.mp4')).toBe(false);
    expect(fs.files.has(f.path)).toBe(true);
    expect(f.thumbnailPath).toBe('/data/thumbs/id1.jpg');
    expect((await repos.files.getById(f.id))?.thumbnailPath).toBe(f.thumbnailPath);
  });

  it('copies instead of moving when asked to keep the source', async () => {
    drop('/picked/doc.pdf');
    const f = await svc.importFile({ sourcePath: '/picked/doc.pdf', keepSource: true });
    expect(fs.files.has('/picked/doc.pdf')).toBe(true);
    expect(f.category).toBe('documents');
    expect(f.thumbnailPath).toBeNull();
  });

  it('gives duplicates a numbered name', async () => {
    drop('/t/1/a.mp4');
    drop('/t/2/a.mp4');
    const first = await svc.importFile({ sourcePath: '/t/1/a.mp4' });
    const second = await svc.importFile({ sourcePath: '/t/2/a.mp4' });
    expect([first.name, second.name]).toEqual(['a.mp4', 'a (1).mp4']);
  });

  it('cleans unsafe names', async () => {
    drop('/t/x.mp4');
    const f = await svc.importFile({ sourcePath: '/t/x.mp4', name: '../../evil/name.mp4' });
    expect(f.name).not.toMatch(/[\\/]/);
    expect(f.path.startsWith('/data/library/')).toBe(true);
  });

  it('fails clearly when the source is missing', async () => {
    await expect(svc.importFile({ sourcePath: '/nope.mp4' })).rejects.toMatchObject({
      code: 'SOURCE_MISSING',
    });
  });

  it('refuses an unknown folder before touching the disk', async () => {
    drop('/t/a.mp4');
    await expect(
      svc.importFile({ sourcePath: '/t/a.mp4', folderId: 'ghost' }),
    ).rejects.toMatchObject({ code: 'FOLDER_NOT_FOUND' });
    expect(fs.files.has('/t/a.mp4')).toBe(true);
  });

  it('does not leave an orphan file when the database insert fails', async () => {
    drop('/t/a.mp4');
    jest.spyOn(repos.files, 'insert').mockRejectedValueOnce(new Error('disk full'));
    await expect(svc.importFile({ sourcePath: '/t/a.mp4' })).rejects.toThrow('disk full');
    expect([...fs.files.keys()].filter((k) => k.startsWith('/data/library/'))).toEqual([]);
  });

  it('still imports when thumbnail generation fails', async () => {
    drop('/t/a.png');
    const failing = new FileService({
      repos,
      fs,
      thumbnails: { create: async () => Promise.reject(new Error('codec')) },
      newId: () => 'x1',
    });
    const f = await failing.importFile({ sourcePath: '/t/a.png' });
    expect(f.thumbnailPath).toBeNull();
    expect(await repos.files.getById('x1')).not.toBeNull();
  });

  it('creates a text file in the library', async () => {
    const f = await svc.createTextFile('note.txt', 'hello');
    expect(f).toMatchObject({ name: 'note.txt', category: 'documents', sizeBytes: 5 });
    expect(fs.files.get(f.path)?.text).toBe('hello');
    expect([...fs.files.keys()].some((k) => k.includes('.tmp-'))).toBe(false);
  });
});

describe('folders', () => {
  it('numbers duplicate folder names among siblings', async () => {
    const a = await svc.createFolder('Movies');
    const b = await svc.createFolder('movies');
    expect([a.name, b.name]).toEqual(['Movies', 'movies (1)']);
    const inner = await svc.createFolder('Movies', a.id);
    expect(inner.name).toBe('Movies');
  });

  it('renames with conflict handling', async () => {
    await svc.createFolder('A');
    const b = await svc.createFolder('B');
    expect((await svc.renameFolder(b.id, 'a')).name).toBe('a (1)');
  });

  it('moves a folder and blocks cycles', async () => {
    const a = await svc.createFolder('A');
    const b = await svc.createFolder('B', a.id);
    const c = await svc.createFolder('C', b.id);
    await expect(svc.moveFolder(a.id, c.id)).rejects.toMatchObject({ code: 'FOLDER_CYCLE' });
    await expect(svc.moveFolder(a.id, a.id)).rejects.toMatchObject({ code: 'FOLDER_CYCLE' });
    const moved = await svc.moveFolder(c.id, null);
    expect(moved.parentId).toBeNull();
  });

  it('deleting a folder trashes its files, and restore brings them to the top level', async () => {
    const a = await svc.createFolder('A');
    const b = await svc.createFolder('B', a.id);
    drop('/t/1.mp4');
    drop('/t/2.mp4');
    const f1 = await svc.importFile({ sourcePath: '/t/1.mp4', folderId: a.id });
    const f2 = await svc.importFile({ sourcePath: '/t/2.mp4', folderId: b.id });

    await svc.deleteFolder(a.id);
    expect(await repos.folders.count()).toBe(0);
    expect(await repos.files.list()).toEqual([]);
    expect((await repos.files.list({ trashed: true })).map((f) => f.id).sort()).toEqual(
      [f1.id, f2.id].sort(),
    );
    expect(fs.files.has(f1.path)).toBe(true); // bytes stay until the trash is purged

    await svc.restoreFiles([f1.id, f2.id]);
    expect((await repos.files.list({ folderId: null })).map((f) => f.id).sort()).toEqual(
      [f1.id, f2.id].sort(),
    );
  });
});

describe('renaming, moving, copying', () => {
  it('renames a file in the database only', async () => {
    drop('/t/a.mp4');
    const f = await svc.importFile({ sourcePath: '/t/a.mp4' });
    const before = [...fs.files.keys()];
    const renamed = await svc.renameFile(f.id, 'Holiday.mp4');
    expect(renamed.name).toBe('Holiday.mp4');
    expect([...fs.files.keys()]).toEqual(before);
  });

  it('numbers a rename that clashes with a sibling', async () => {
    drop('/t/a.mp4');
    drop('/t/b.mp4');
    await svc.importFile({ sourcePath: '/t/a.mp4' });
    const b = await svc.importFile({ sourcePath: '/t/b.mp4' });
    expect((await svc.renameFile(b.id, 'A.mp4')).name).toBe('A (1).mp4');
  });

  it('moves files between folders and renames clashes at the destination', async () => {
    const folder = await svc.createFolder('F');
    drop('/t/a.mp4');
    drop('/t/b.mp4');
    const top = await svc.importFile({ sourcePath: '/t/a.mp4' });
    await svc.importFile({ sourcePath: '/t/b.mp4', name: 'a.mp4', folderId: folder.id });

    await svc.moveFiles([top.id], folder.id);
    const moved = (await repos.files.getById(top.id))!;
    expect(moved.folderId).toBe(folder.id);
    expect(moved.name).toBe('a (1).mp4');
    await expect(svc.moveFiles([top.id], 'ghost')).rejects.toMatchObject({
      code: 'FOLDER_NOT_FOUND',
    });
  });

  it('copies a file with its own bytes and a new name', async () => {
    drop('/t/a.png', 500);
    const f = await svc.importFile({ sourcePath: '/t/a.png' });
    const copy = await svc.copyFile(f.id);
    expect(copy.id).not.toBe(f.id);
    expect(copy.path).not.toBe(f.path);
    expect(copy.name).toBe('a (1).png');
    expect(copy.sizeBytes).toBe(500);
    expect(fs.files.has(copy.path)).toBe(true);
    expect(fs.files.has(f.path)).toBe(true);
  });

  it('toggles favorite', async () => {
    drop('/t/a.mp4');
    const f = await svc.importFile({ sourcePath: '/t/a.mp4' });
    expect(await svc.toggleFavorite(f.id)).toBe(true);
    expect(await svc.toggleFavorite(f.id)).toBe(false);
  });

  it('reports a missing file', async () => {
    await expect(svc.renameFile('ghost', 'x')).rejects.toBeInstanceOf(FileServiceError);
    await expect(svc.copyFile('ghost')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('trash', () => {
  it('trash hides files, restore brings them back, and nothing is deleted from disk', async () => {
    drop('/t/a.mp4');
    const f = await svc.importFile({ sourcePath: '/t/a.mp4' });
    await svc.trashFiles([f.id]);
    expect(await repos.files.list()).toEqual([]);
    expect(fs.files.has(f.path)).toBe(true);
    await svc.restoreFiles([f.id]);
    expect((await repos.files.list()).map((x) => x.id)).toEqual([f.id]);
  });

  it('restoring renames a file whose name was taken in the meantime', async () => {
    drop('/t/a.mp4');
    drop('/t/b.mp4');
    const old = await svc.importFile({ sourcePath: '/t/a.mp4' });
    await svc.trashFiles([old.id]);
    await svc.importFile({ sourcePath: '/t/b.mp4', name: 'a.mp4' });
    await svc.restoreFiles([old.id]);
    expect((await repos.files.getById(old.id))?.name).toBe('a (1).mp4');
  });

  it('purges only items older than 30 days, removing bytes and thumbnails', async () => {
    drop('/t/old.png');
    drop('/t/new.png');
    const oldF = await svc.importFile({ sourcePath: '/t/old.png' });
    const newF = await svc.importFile({ sourcePath: '/t/new.png' });
    await svc.trashFiles([oldF.id]);
    clock += TRASH_RETENTION_MS + 1000;
    await svc.trashFiles([newF.id]);

    expect(await svc.purgeExpiredTrash()).toBe(1);
    expect(await repos.files.getById(oldF.id)).toBeNull();
    expect(fs.files.has(oldF.path)).toBe(false);
    expect(fs.files.has(oldF.thumbnailPath!)).toBe(false);
    expect(await repos.files.getById(newF.id)).not.toBeNull();
    expect(fs.files.has(newF.path)).toBe(true);
  });

  it('empties the whole trash on request', async () => {
    drop('/t/a.mp4');
    drop('/t/b.mp4');
    const a = await svc.importFile({ sourcePath: '/t/a.mp4' });
    const b = await svc.importFile({ sourcePath: '/t/b.mp4' });
    await svc.trashFiles([a.id, b.id]);
    expect(await svc.emptyTrash()).toBe(2);
    expect(await repos.files.count(true)).toBe(0);
    expect(fs.files.has(a.path)).toBe(false);
  });
});

describe('gallery export', () => {
  it('exports media with its display name', async () => {
    drop('/t/a.mp4');
    const f = await svc.importFile({ sourcePath: '/t/a.mp4', name: 'Holiday.mp4' });
    await svc.exportToGallery(f.id);
    expect(media.calls).toEqual([{ path: f.path, displayName: 'Holiday.mp4', category: 'videos' }]);
  });

  it('refuses documents and unavailable export', async () => {
    drop('/t/a.pdf');
    const f = await svc.importFile({ sourcePath: '/t/a.pdf' });
    await expect(svc.exportToGallery(f.id)).rejects.toMatchObject({ code: 'NOT_EXPORTABLE' });

    drop('/t/b.mp4');
    const bare = new FileService({ repos, fs, newId: () => 'bare1' });
    const v = await bare.importFile({ sourcePath: '/t/b.mp4' });
    await expect(bare.exportToGallery(v.id)).rejects.toMatchObject({ code: 'EXPORT_UNAVAILABLE' });
  });
});
