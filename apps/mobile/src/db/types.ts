/**
 * The small slice of expo-sqlite's SQLiteDatabase that the app uses.
 * Repositories depend on this interface, so tests can run them on Node's
 * built-in SQLite instead of the native module.
 */
export type SqlParam = string | number | null;

export interface RunResult {
  changes: number;
  lastInsertRowId: number;
}

export interface Db {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params?: SqlParam[]): Promise<RunResult>;
  getFirstAsync<T>(sql: string, params?: SqlParam[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: SqlParam[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export type FileCategory = 'videos' | 'audio' | 'images' | 'documents' | 'archives' | 'other';

export const FILE_CATEGORIES: readonly FileCategory[] = [
  'videos',
  'audio',
  'images',
  'documents',
  'archives',
  'other',
];

export interface FolderRecord {
  id: string;
  name: string;
  parentId: string | null;
  createdAt: number;
}

export interface FileRecord {
  id: string;
  folderId: string | null;
  name: string;
  /** Where the bytes live on disk. Unique per file, independent of the display name. */
  path: string;
  mime: string | null;
  category: FileCategory;
  sizeBytes: number;
  source: string | null;
  thumbnailPath: string | null;
  durationSec: number | null;
  isFavorite: boolean;
  /** Set when the file is in the trash (ms since epoch). */
  deletedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export type DownloadStatus =
  | 'queued'
  | 'resolving'
  | 'downloading'
  | 'paused'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'canceled';

export interface DownloadRecord {
  id: string;
  fileId: string | null;
  sourceUrl: string;
  directUrl: string | null;
  title: string | null;
  status: DownloadStatus;
  bytesTotal: number | null;
  bytesDone: number;
  retries: number;
  errorCode: string | null;
  createdAt: number;
  updatedAt: number;
}
