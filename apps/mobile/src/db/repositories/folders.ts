import { newId } from '../ids';
import type { Db, FolderRecord } from '../types';
import { placeholders } from './util';

interface FolderRow {
  id: string;
  name: string;
  parent_id: string | null;
  created_at: number;
}

const toFolder = (r: FolderRow): FolderRecord => ({
  id: r.id,
  name: r.name,
  parentId: r.parent_id,
  createdAt: r.created_at,
});

export class FoldersRepo {
  constructor(
    private readonly db: Db,
    private readonly now: () => number = Date.now,
  ) {}

  async insert(input: {
    id?: string;
    name: string;
    parentId: string | null;
  }): Promise<FolderRecord> {
    const rec: FolderRecord = {
      id: input.id ?? newId(this.now()),
      name: input.name,
      parentId: input.parentId,
      createdAt: this.now(),
    };
    await this.db.runAsync(
      'INSERT INTO folders (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)',
      [rec.id, rec.name, rec.parentId, rec.createdAt],
    );
    return rec;
  }

  async getById(id: string): Promise<FolderRecord | null> {
    const r = await this.db.getFirstAsync<FolderRow>('SELECT * FROM folders WHERE id = ?', [id]);
    return r ? toFolder(r) : null;
  }

  /** Direct children of a folder, or top-level folders when parentId is null. */
  async listChildren(parentId: string | null): Promise<FolderRecord[]> {
    const rows = await this.db.getAllAsync<FolderRow>(
      'SELECT * FROM folders WHERE parent_id IS ? ORDER BY name COLLATE NOCASE',
      [parentId],
    );
    return rows.map(toFolder);
  }

  async listAll(): Promise<FolderRecord[]> {
    const rows = await this.db.getAllAsync<FolderRow>(
      'SELECT * FROM folders ORDER BY name COLLATE NOCASE',
    );
    return rows.map(toFolder);
  }

  /** Case-insensitive name lookup among siblings. */
  async findByName(
    parentId: string | null,
    name: string,
    excludeId?: string,
  ): Promise<FolderRecord | null> {
    const r = await this.db.getFirstAsync<FolderRow>(
      'SELECT * FROM folders WHERE parent_id IS ? AND name = ? COLLATE NOCASE AND id != ? LIMIT 1',
      [parentId, name, excludeId ?? ''],
    );
    return r ? toFolder(r) : null;
  }

  async rename(id: string, name: string): Promise<void> {
    await this.db.runAsync('UPDATE folders SET name = ? WHERE id = ?', [name, id]);
  }

  async move(id: string, parentId: string | null): Promise<void> {
    await this.db.runAsync('UPDATE folders SET parent_id = ? WHERE id = ?', [parentId, id]);
  }

  /** Deletes the folder and, through the foreign key, all folders inside it. */
  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM folders WHERE id = ?', [id]);
  }

  /** The folder itself plus every folder below it. */
  async descendantIds(id: string): Promise<string[]> {
    const rows = await this.db.getAllAsync<{ id: string }>(
      `WITH RECURSIVE tree(id) AS (
         SELECT id FROM folders WHERE id = ?
         UNION ALL
         SELECT f.id FROM folders f JOIN tree t ON f.parent_id = t.id
       )
       SELECT id FROM tree`,
      [id],
    );
    return rows.map((r) => r.id);
  }

  /** Number of non-trashed files directly inside each folder. */
  async itemCounts(): Promise<Record<string, number>> {
    const rows = await this.db.getAllAsync<{ folder_id: string; n: number }>(
      'SELECT folder_id, COUNT(*) AS n FROM files WHERE folder_id IS NOT NULL AND deleted_at IS NULL GROUP BY folder_id',
    );
    return Object.fromEntries(rows.map((r) => [r.folder_id, r.n]));
  }

  async count(): Promise<number> {
    const r = await this.db.getFirstAsync<{ n: number }>('SELECT COUNT(*) AS n FROM folders');
    return r?.n ?? 0;
  }

  /** Used by tests and diagnostics. */
  async existing(ids: string[]): Promise<string[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.getAllAsync<{ id: string }>(
      `SELECT id FROM folders WHERE id IN (${placeholders(ids.length)})`,
      ids,
    );
    return rows.map((r) => r.id);
  }
}
