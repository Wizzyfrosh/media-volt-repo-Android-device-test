import { newId } from '@/db/ids';
import type { Repositories } from '@/db/repositories';
import type { FileRecord, FolderRecord } from '@/db/types';
import { detectCategory, extensionOf, mimeFromExtension } from './file-types';
import { baseName, joinPath, sanitizeName, uniqueName } from './naming';
import type { FileSystemPort, MediaExportPort, ThumbnailPort } from './ports';

export const TRASH_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export type FileServiceErrorCode =
  | 'SOURCE_MISSING'
  | 'NOT_FOUND'
  | 'FOLDER_NOT_FOUND'
  | 'FOLDER_CYCLE'
  | 'NOT_EXPORTABLE'
  | 'EXPORT_UNAVAILABLE'
  | 'PERMISSION_DENIED';

export class FileServiceError extends Error {
  constructor(
    readonly code: FileServiceErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FileServiceError';
  }
}

export interface FileServiceDeps {
  repos: Pick<Repositories, 'files' | 'folders'>;
  fs: FileSystemPort;
  thumbnails?: ThumbnailPort;
  media?: MediaExportPort;
  now?: () => number;
  newId?: () => string;
}

export interface ImportInput {
  /** Where the file is now (a finished download, a picked document, a scan). */
  sourcePath: string;
  /** Display name. Defaults to the source file's name. */
  name?: string;
  folderId?: string | null;
  source?: string | null;
  mime?: string | null;
  durationSec?: number | null;
  /** Copy instead of move, for files the user picked from elsewhere. */
  keepSource?: boolean;
}

/**
 * Everything that changes the library goes through here, so the database and the
 * disk cannot drift apart. Display names and folders live only in the database
 * (a rename or move never touches the disk); bytes live at <libraryDir>/<id><ext>.
 */
export class FileService {
  private readonly repos: FileServiceDeps['repos'];
  private readonly fs: FileSystemPort;
  private readonly thumbnails?: ThumbnailPort;
  private readonly media?: MediaExportPort;
  private readonly now: () => number;
  private readonly makeId: () => string;
  private version = 0;
  private readonly listeners = new Set<() => void>();

  constructor(deps: FileServiceDeps) {
    this.repos = deps.repos;
    this.fs = deps.fs;
    this.thumbnails = deps.thumbnails;
    this.media = deps.media;
    this.now = deps.now ?? Date.now;
    this.makeId = deps.newId ?? (() => newId(this.now()));
  }

  // ---------- change notifications ----------

  /** Lets screens refresh when anything in the library changes. Works with useSyncExternalStore. */
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Goes up by one after every change to files or folders. */
  getVersion = (): number => this.version;

  /** For code that changes the database directly (such as test-data tools), so screens reload. */
  refresh(): void {
    this.changed();
  }

  private changed(): void {
    this.version += 1;
    for (const l of this.listeners) l();
  }

  // ---------- folders ----------

  async createFolder(name: string, parentId: string | null = null): Promise<FolderRecord> {
    await this.assertFolderExists(parentId);
    const unique = await uniqueName(
      sanitizeName(name),
      async (n) => (await this.repos.folders.findByName(parentId, n)) !== null,
    );
    const folder = await this.repos.folders.insert({ name: unique, parentId });
    this.changed();
    return folder;
  }

  async renameFolder(id: string, name: string): Promise<FolderRecord> {
    const folder = await this.requireFolder(id);
    const clean = sanitizeName(name);
    if (clean.toLowerCase() === folder.name.toLowerCase() && clean === folder.name) return folder;
    const unique = await uniqueName(
      clean,
      async (n) => (await this.repos.folders.findByName(folder.parentId, n, id)) !== null,
    );
    await this.repos.folders.rename(id, unique);
    this.changed();
    return { ...folder, name: unique };
  }

  async moveFolder(id: string, newParentId: string | null): Promise<FolderRecord> {
    const folder = await this.requireFolder(id);
    await this.assertFolderExists(newParentId);
    if (newParentId !== null) {
      const below = await this.repos.folders.descendantIds(id);
      if (below.includes(newParentId)) {
        throw new FileServiceError(
          'FOLDER_CYCLE',
          'A folder cannot be moved into itself or a folder inside it.',
        );
      }
    }
    const unique = await uniqueName(
      folder.name,
      async (n) => (await this.repos.folders.findByName(newParentId, n, id)) !== null,
    );
    await this.repos.folders.rename(id, unique);
    await this.repos.folders.move(id, newParentId);
    this.changed();
    return { ...folder, name: unique, parentId: newParentId };
  }

  /** Deletes the folder tree. Files inside go to the trash and come back at the top level on restore. */
  async deleteFolder(id: string): Promise<void> {
    await this.requireFolder(id);
    const ids = await this.repos.folders.descendantIds(id);
    const inside = await this.repos.files.listInFolders(ids);
    await this.repos.files.setDeletedAt(
      inside.map((f) => f.id),
      this.now(),
    );
    await this.repos.folders.delete(id);
    this.changed();
  }

  // ---------- files ----------

  async importFile(input: ImportInput): Promise<FileRecord> {
    if (!(await this.fs.exists(input.sourcePath))) {
      throw new FileServiceError('SOURCE_MISSING', 'The file to import could not be found.');
    }
    const folderId = input.folderId ?? null;
    await this.assertFolderExists(folderId);

    const desired = sanitizeName(input.name ?? baseName(input.sourcePath));
    const name = await uniqueName(
      desired,
      async (n) => (await this.repos.files.findByName(folderId, n)) !== null,
    );
    const ext = extensionOf(name);
    const id = this.makeId();
    const dest = joinPath(this.fs.libraryDir(), ext ? `${id}.${ext}` : id);

    await this.fs.ensureDir(this.fs.libraryDir());
    if (input.keepSource) await this.fs.copy(input.sourcePath, dest);
    else await this.fs.move(input.sourcePath, dest);

    try {
      const mime = input.mime ?? mimeFromExtension(ext);
      let record = await this.repos.files.insert({
        id,
        folderId,
        name,
        path: dest,
        mime,
        category: detectCategory({ mime, name }),
        sizeBytes: await this.fs.sizeOf(dest),
        source: input.source ?? null,
        durationSec: input.durationSec ?? null,
      });
      record = await this.attachThumbnail(record);
      this.changed();
      return record;
    } catch (e) {
      // Do not leave an orphan file behind if the database refused the row.
      await this.fs.remove(dest).catch(() => undefined);
      throw e;
    }
  }

  /** Creates a small text file directly in the library. Used by diagnostics and notes. */
  async createTextFile(
    name: string,
    content: string,
    folderId: string | null = null,
  ): Promise<FileRecord> {
    const id = this.makeId();
    const tmp = joinPath(this.fs.libraryDir(), `.tmp-${id}`);
    await this.fs.ensureDir(this.fs.libraryDir());
    await this.fs.writeText(tmp, content);
    return this.importFile({ sourcePath: tmp, name, folderId, source: 'app', mime: 'text/plain' });
  }

  async renameFile(id: string, name: string): Promise<FileRecord> {
    const file = await this.requireFile(id);
    const clean = sanitizeName(name);
    if (clean === file.name) return file;
    const unique = await uniqueName(
      clean,
      async (n) => (await this.repos.files.findByName(file.folderId, n, id)) !== null,
    );
    await this.repos.files.update(id, { name: unique });
    this.changed();
    return { ...file, name: unique };
  }

  /** Moves files to a folder (null = top level). Names that clash get a number suffix. */
  async moveFiles(ids: readonly string[], folderId: string | null): Promise<void> {
    await this.assertFolderExists(folderId);
    for (const file of await this.repos.files.getByIds(ids)) {
      if (file.folderId === folderId) continue;
      const unique = await uniqueName(
        file.name,
        async (n) => (await this.repos.files.findByName(folderId, n, file.id)) !== null,
      );
      await this.repos.files.update(file.id, { folderId, name: unique });
    }
    this.changed();
  }

  async copyFile(id: string, folderId?: string | null): Promise<FileRecord> {
    const file = await this.requireFile(id);
    const target = folderId === undefined ? file.folderId : folderId;
    await this.assertFolderExists(target);

    const name = await uniqueName(
      file.name,
      async (n) => (await this.repos.files.findByName(target, n)) !== null,
    );
    const newFileId = this.makeId();
    const ext = extensionOf(file.path.slice(file.path.lastIndexOf('/') + 1));
    const dest = joinPath(this.fs.libraryDir(), ext ? `${newFileId}.${ext}` : newFileId);

    await this.fs.copy(file.path, dest);
    try {
      const copy = await this.repos.files.insert({
        id: newFileId,
        folderId: target,
        name,
        path: dest,
        mime: file.mime,
        category: file.category,
        sizeBytes: file.sizeBytes,
        source: file.source,
        durationSec: file.durationSec,
      });
      const done = await this.attachThumbnail(copy);
      this.changed();
      return done;
    } catch (e) {
      await this.fs.remove(dest).catch(() => undefined);
      throw e;
    }
  }

  async toggleFavorite(id: string): Promise<boolean> {
    const file = await this.requireFile(id);
    await this.repos.files.update(id, { isFavorite: !file.isFavorite });
    this.changed();
    return !file.isFavorite;
  }

  /** Sets favorite on many files at once. */
  async setFavorite(ids: readonly string[], value: boolean): Promise<void> {
    for (const id of ids) await this.repos.files.update(id, { isFavorite: value });
    this.changed();
  }

  // ---------- trash ----------

  async trashFiles(ids: readonly string[]): Promise<void> {
    await this.repos.files.setDeletedAt(ids, this.now());
    this.changed();
  }

  /** Brings files back to their folder, or to the top level if that folder is gone. Clashing names get a suffix. */
  async restoreFiles(ids: readonly string[]): Promise<void> {
    for (const file of await this.repos.files.getByIds(ids)) {
      if (file.deletedAt === null) continue;
      const folder = file.folderId ? await this.repos.folders.getById(file.folderId) : null;
      const target = folder ? folder.id : null;
      const unique = await uniqueName(
        file.name,
        async (n) => (await this.repos.files.findByName(target, n, file.id)) !== null,
      );
      await this.repos.files.update(file.id, { folderId: target, name: unique });
      await this.repos.files.setDeletedAt([file.id], null);
    }
    this.changed();
  }

  /** Permanently deletes trashed files older than the retention period. Returns how many were removed. */
  async purgeExpiredTrash(): Promise<number> {
    return this.purge(await this.repos.files.listTrashedBefore(this.now() - TRASH_RETENTION_MS));
  }

  /** Permanently deletes the given files, which must already be in the trash. */
  async deleteForever(ids: readonly string[]): Promise<number> {
    const trashed = (await this.repos.files.getByIds(ids)).filter((f) => f.deletedAt !== null);
    return this.purge(trashed);
  }

  /** Permanently deletes everything in the trash. */
  async emptyTrash(): Promise<number> {
    return this.purge(await this.repos.files.list({ trashed: true }));
  }

  // ---------- gallery ----------

  /** Saves a copy to the phone's gallery or music library so other apps can see it. */
  async exportToGallery(id: string): Promise<void> {
    const file = await this.requireFile(id);
    if (!['images', 'videos', 'audio'].includes(file.category)) {
      throw new FileServiceError(
        'NOT_EXPORTABLE',
        'Only photos, videos and audio can be saved to the gallery.',
      );
    }
    if (!this.media)
      throw new FileServiceError(
        'EXPORT_UNAVAILABLE',
        'Saving to the gallery is not available here.',
      );
    await this.media.exportToGallery({
      path: file.path,
      displayName: file.name,
      category: file.category,
    });
  }

  // ---------- internals ----------

  private async purge(files: FileRecord[]): Promise<number> {
    for (const f of files) {
      await this.fs.remove(f.path).catch(() => undefined);
      if (f.thumbnailPath) await this.fs.remove(f.thumbnailPath).catch(() => undefined);
    }
    await this.repos.files.deleteMany(files.map((f) => f.id));
    if (files.length > 0) this.changed();
    return files.length;
  }

  /** Thumbnails are a nicety: a failure here must never fail the import. */
  private async attachThumbnail(record: FileRecord): Promise<FileRecord> {
    if (!this.thumbnails) return record;
    try {
      const thumb = await this.thumbnails.create({
        id: record.id,
        path: record.path,
        category: record.category,
      });
      if (!thumb) return record;
      await this.repos.files.update(record.id, { thumbnailPath: thumb });
      return { ...record, thumbnailPath: thumb };
    } catch {
      return record;
    }
  }

  private async requireFile(id: string): Promise<FileRecord> {
    const file = await this.repos.files.getById(id);
    if (!file) throw new FileServiceError('NOT_FOUND', 'That file no longer exists.');
    return file;
  }

  private async requireFolder(id: string): Promise<FolderRecord> {
    const folder = await this.repos.folders.getById(id);
    if (!folder) throw new FileServiceError('FOLDER_NOT_FOUND', 'That folder no longer exists.');
    return folder;
  }

  private async assertFolderExists(id: string | null): Promise<void> {
    if (id !== null) await this.requireFolder(id);
  }
}
