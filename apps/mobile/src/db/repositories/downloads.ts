import { newId } from '../ids';
import type { Db, DownloadRecord, DownloadStatus, SqlParam } from '../types';
import { placeholders } from './util';

interface DownloadRow {
  id: string;
  file_id: string | null;
  source_url: string;
  direct_url: string | null;
  title: string | null;
  status: DownloadStatus;
  bytes_total: number | null;
  bytes_done: number;
  retries: number;
  error_code: string | null;
  created_at: number;
  updated_at: number;
}

const toDownload = (r: DownloadRow): DownloadRecord => ({
  id: r.id,
  fileId: r.file_id,
  sourceUrl: r.source_url,
  directUrl: r.direct_url,
  title: r.title,
  status: r.status,
  bytesTotal: r.bytes_total,
  bytesDone: r.bytes_done,
  retries: r.retries,
  errorCode: r.error_code,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export interface DownloadPatch {
  fileId?: string | null;
  directUrl?: string | null;
  title?: string | null;
  status?: DownloadStatus;
  bytesTotal?: number | null;
  bytesDone?: number;
  retries?: number;
  errorCode?: string | null;
}

/** Storage for the download queue. The queue state machine itself arrives in Phase 1c. */
export class DownloadsRepo {
  constructor(
    private readonly db: Db,
    private readonly now: () => number = Date.now,
  ) {}

  async insert(input: {
    id?: string;
    sourceUrl: string;
    directUrl?: string | null;
    title?: string | null;
    status?: DownloadStatus;
  }): Promise<DownloadRecord> {
    const t = this.now();
    const rec: DownloadRecord = {
      id: input.id ?? newId(t),
      fileId: null,
      sourceUrl: input.sourceUrl,
      directUrl: input.directUrl ?? null,
      title: input.title ?? null,
      status: input.status ?? 'queued',
      bytesTotal: null,
      bytesDone: 0,
      retries: 0,
      errorCode: null,
      createdAt: t,
      updatedAt: t,
    };
    await this.db.runAsync(
      `INSERT INTO downloads (id, file_id, source_url, direct_url, title, status, bytes_total, bytes_done,
                              retries, error_code, created_at, updated_at)
       VALUES (?, NULL, ?, ?, ?, ?, NULL, 0, 0, NULL, ?, ?)`,
      [rec.id, rec.sourceUrl, rec.directUrl, rec.title, rec.status, t, t],
    );
    return rec;
  }

  async getById(id: string): Promise<DownloadRecord | null> {
    const r = await this.db.getFirstAsync<DownloadRow>('SELECT * FROM downloads WHERE id = ?', [
      id,
    ]);
    return r ? toDownload(r) : null;
  }

  async update(id: string, patch: DownloadPatch): Promise<void> {
    const sets: string[] = [];
    const params: SqlParam[] = [];
    const add = (col: string, value: SqlParam) => {
      sets.push(`${col} = ?`);
      params.push(value);
    };
    if (patch.fileId !== undefined) add('file_id', patch.fileId);
    if (patch.directUrl !== undefined) add('direct_url', patch.directUrl);
    if (patch.title !== undefined) add('title', patch.title);
    if (patch.status !== undefined) add('status', patch.status);
    if (patch.bytesTotal !== undefined) add('bytes_total', patch.bytesTotal);
    if (patch.bytesDone !== undefined) add('bytes_done', patch.bytesDone);
    if (patch.retries !== undefined) add('retries', patch.retries);
    if (patch.errorCode !== undefined) add('error_code', patch.errorCode);
    if (sets.length === 0) return;
    add('updated_at', this.now());
    await this.db.runAsync(`UPDATE downloads SET ${sets.join(', ')} WHERE id = ?`, [...params, id]);
  }

  async listByStatus(statuses: readonly DownloadStatus[]): Promise<DownloadRecord[]> {
    if (statuses.length === 0) return [];
    const rows = await this.db.getAllAsync<DownloadRow>(
      `SELECT * FROM downloads WHERE status IN (${placeholders(statuses.length)}) ORDER BY created_at ASC, id ASC`,
      [...statuses],
    );
    return rows.map(toDownload);
  }

  async listAll(): Promise<DownloadRecord[]> {
    const rows = await this.db.getAllAsync<DownloadRow>(
      'SELECT * FROM downloads ORDER BY created_at DESC, id DESC',
    );
    return rows.map(toDownload);
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM downloads WHERE id = ?', [id]);
  }

  async countByStatus(): Promise<Partial<Record<DownloadStatus, number>>> {
    const rows = await this.db.getAllAsync<{ status: DownloadStatus; n: number }>(
      'SELECT status, COUNT(*) AS n FROM downloads GROUP BY status',
    );
    return Object.fromEntries(rows.map((r) => [r.status, r.n]));
  }
}
