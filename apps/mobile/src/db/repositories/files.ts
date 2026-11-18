import { newId } from '../ids';
import type { Db, FileCategory, FileRecord, SqlParam } from '../types';
import { chunk, escapeLike, placeholders } from './util';

interface FileRow {
  id: string;
  folder_id: string | null;
  name: string;
  path: string;
  mime: string | null;
  category: FileCategory;
  size_bytes: number;
  source: string | null;
  thumbnail_path: string | null;
  duration_sec: number | null;
  is_favorite: number;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
}

const toFile = (r: FileRow): FileRecord => ({
  id: r.id,
  folderId: r.folder_id,
  name: r.name,
  path: r.path,
  mime: r.mime,
  category: r.category,
  sizeBytes: r.size_bytes,
  source: r.source,
  thumbnailPath: r.thumbnail_path,
  durationSec: r.duration_sec,
  isFavorite: r.is_favorite === 1,
  deletedAt: r.deleted_at,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export interface NewFile {
  id?: string;
  folderId: string | null;
  name: string;
  path: string;
  mime: string | null;
  category: FileCategory;
  sizeBytes: number;
  source?: string | null;
  thumbnailPath?: string | null;
  durationSec?: number | null;
}

export type FileSort = 'name' | 'date' | 'size';

export interface FileQuery {
  /** undefined = any folder, null = top level only, string = that folder. */
  folderId?: string | null;
  category?: FileCategory;
  /** Substring match on the name, case-insensitive. */
  search?: string;
  favoritesOnly?: boolean;
  /** true = trash only. Default false = everything outside the trash. */
  trashed?: boolean;
  sort?: FileSort;
  direction?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface FilePatch {
  name?: string;
  folderId?: string | null;
  thumbnailPath?: string | null;
  durationSec?: number | null;
  isFavorite?: boolean;
  sizeBytes?: number;
}

const SORT_COLUMN: Record<FileSort, string> = {
  name: 'name COLLATE NOCASE',
  date: 'created_at',
  size: 'size_bytes',
};

export class FilesRepo {
  constructor(
    private readonly db: Db,
    private readonly now: () => number = Date.now,
  ) {}

  async insert(input: NewFile): Promise<FileRecord> {
    const t = this.now();
    const rec: FileRecord = {
      id: input.id ?? newId(t),
      folderId: input.folderId,
      name: input.name,
      path: input.path,
      mime: input.mime,
      category: input.category,
      sizeBytes: input.sizeBytes,
      source: input.source ?? null,
      thumbnailPath: input.thumbnailPath ?? null,
      durationSec: input.durationSec ?? null,
      isFavorite: false,
      deletedAt: null,
      createdAt: t,
      updatedAt: t,
    };
    await this.db.runAsync(
      `INSERT INTO files (id, folder_id, name, path, mime, category, size_bytes, source, thumbnail_path,
                          duration_sec, is_favorite, deleted_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?)`,
      [
        rec.id,
        rec.folderId,
        rec.name,
        rec.path,
        rec.mime,
        rec.category,
        rec.sizeBytes,
        rec.source,
        rec.thumbnailPath,
        rec.durationSec,
        rec.createdAt,
        rec.updatedAt,
      ],
    );
    return rec;
  }

  async getById(id: string): Promise<FileRecord | null> {
    const r = await this.db.getFirstAsync<FileRow>('SELECT * FROM files WHERE id = ?', [id]);
    return r ? toFile(r) : null;
  }

  async getByIds(ids: readonly string[]): Promise<FileRecord[]> {
    const out: FileRecord[] = [];
    for (const part of chunk(ids)) {
      const rows = await this.db.getAllAsync<FileRow>(
        `SELECT * FROM files WHERE id IN (${placeholders(part.length)})`,
        part,
      );
      out.push(...rows.map(toFile));
    }
    return out;
  }

  async list(q: FileQuery = {}): Promise<FileRecord[]> {
    const where: string[] = [q.trashed ? 'deleted_at IS NOT NULL' : 'deleted_at IS NULL'];
    const params: SqlParam[] = [];

    if (q.folderId !== undefined) {
      where.push('folder_id IS ?');
      params.push(q.folderId);
    }
    if (q.category) {
      where.push('category = ?');
      params.push(q.category);
    }
    if (q.favoritesOnly) where.push('is_favorite = 1');
    if (q.search?.trim()) {
      where.push("name LIKE ? ESCAPE '\\'");
      params.push(`%${escapeLike(q.search.trim())}%`);
    }

    const column = SORT_COLUMN[q.sort ?? 'date'];
    const dir = (q.direction ?? (q.sort === 'name' ? 'asc' : 'desc')) === 'asc' ? 'ASC' : 'DESC';
    let sql = `SELECT * FROM files WHERE ${where.join(' AND ')} ORDER BY ${column} ${dir}, id ASC`;

    if (q.limit !== undefined) {
      sql += ' LIMIT ? OFFSET ?';
      params.push(Math.max(0, Math.floor(q.limit)), Math.max(0, Math.floor(q.offset ?? 0)));
    }
    const rows = await this.db.getAllAsync<FileRow>(sql, params);
    return rows.map(toFile);
  }

  async findByName(
    folderId: string | null,
    name: string,
    excludeId?: string,
  ): Promise<FileRecord | null> {
    const r = await this.db.getFirstAsync<FileRow>(
      `SELECT * FROM files
       WHERE folder_id IS ? AND name = ? COLLATE NOCASE AND deleted_at IS NULL AND id != ? LIMIT 1`,
      [folderId, name, excludeId ?? ''],
    );
    return r ? toFile(r) : null;
  }

  async update(id: string, patch: FilePatch): Promise<void> {
    const sets: string[] = [];
    const params: SqlParam[] = [];
    const add = (col: string, value: SqlParam) => {
      sets.push(`${col} = ?`);
      params.push(value);
    };
    if (patch.name !== undefined) add('name', patch.name);
    if (patch.folderId !== undefined) add('folder_id', patch.folderId);
    if (patch.thumbnailPath !== undefined) add('thumbnail_path', patch.thumbnailPath);
    if (patch.durationSec !== undefined) add('duration_sec', patch.durationSec);
    if (patch.isFavorite !== undefined) add('is_favorite', patch.isFavorite ? 1 : 0);
    if (patch.sizeBytes !== undefined) add('size_bytes', patch.sizeBytes);
    if (sets.length === 0) return;
    add('updated_at', this.now());
    await this.db.runAsync(`UPDATE files SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  }

  /** Sets (or clears, with null) the trash timestamp. */
  async setDeletedAt(ids: readonly string[], deletedAt: number | null): Promise<void> {
    for (const part of chunk(ids)) {
      await this.db.runAsync(
        `UPDATE files SET deleted_at = ?, updated_at = ? WHERE id IN (${placeholders(part.length)})`,
        [deletedAt, this.now(), ...part],
      );
    }
  }

  async deleteMany(ids: readonly string[]): Promise<void> {
    for (const part of chunk(ids)) {
      await this.db.runAsync(`DELETE FROM files WHERE id IN (${placeholders(part.length)})`, part);
    }
  }

  /** Files in trash since before the cutoff. */
  async listTrashedBefore(cutoff: number): Promise<FileRecord[]> {
    const rows = await this.db.getAllAsync<FileRow>(
      'SELECT * FROM files WHERE deleted_at IS NOT NULL AND deleted_at < ?',
      [cutoff],
    );
    return rows.map(toFile);
  }

  /** Non-trashed files that sit directly in any of the given folders. */
  async listInFolders(folderIds: readonly string[]): Promise<FileRecord[]> {
    const out: FileRecord[] = [];
    for (const part of chunk(folderIds)) {
      const rows = await this.db.getAllAsync<FileRow>(
        `SELECT * FROM files WHERE deleted_at IS NULL AND folder_id IN (${placeholders(part.length)})`,
        part,
      );
      out.push(...rows.map(toFile));
    }
    return out;
  }

  async countByCategory(): Promise<Record<FileCategory, number>> {
    const rows = await this.db.getAllAsync<{ category: FileCategory; n: number }>(
      'SELECT category, COUNT(*) AS n FROM files WHERE deleted_at IS NULL GROUP BY category',
    );
    const out: Record<FileCategory, number> = {
      videos: 0,
      audio: 0,
      images: 0,
      documents: 0,
      archives: 0,
      other: 0,
    };
    for (const r of rows) out[r.category] = r.n;
    return out;
  }

  async sizeByCategory(): Promise<Record<FileCategory, number>> {
    const rows = await this.db.getAllAsync<{ category: FileCategory; s: number }>(
      'SELECT category, COALESCE(SUM(size_bytes), 0) AS s FROM files WHERE deleted_at IS NULL GROUP BY category',
    );
    const out: Record<FileCategory, number> = {
      videos: 0,
      audio: 0,
      images: 0,
      documents: 0,
      archives: 0,
      other: 0,
    };
    for (const r of rows) out[r.category] = r.s;
    return out;
  }

  /** Removes every row created by a given source. Used to clean up generated test data. */
  async deleteBySource(source: string): Promise<number> {
    const r = await this.db.runAsync('DELETE FROM files WHERE source = ?', [source]);
    return r.changes;
  }

  async count(trashed = false): Promise<number> {
    const r = await this.db.getFirstAsync<{ n: number }>(
      `SELECT COUNT(*) AS n FROM files WHERE deleted_at IS ${trashed ? 'NOT NULL' : 'NULL'}`,
    );
    return r?.n ?? 0;
  }
}
