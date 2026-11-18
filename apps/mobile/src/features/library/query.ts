import type { FileQuery, FileSort, Repositories } from '@/db/repositories';
import type { FileCategory, FileRecord, FolderRecord } from '@/db/types';

export type LibraryFilter = 'all' | 'favorites' | FileCategory;

export interface LibraryQuery {
  /** Folder being browsed. Null = the top of the library. */
  folderId: string | null;
  filter: LibraryFilter;
  search: string;
  sort: FileSort;
  direction: 'asc' | 'desc';
}

export interface LibraryData {
  /** True when results are a flat list across all folders (a filter or search is active). */
  flat: boolean;
  folders: FolderRecord[];
  /** Number of files directly inside each folder. */
  folderCounts: Record<string, number>;
  files: FileRecord[];
  categoryCounts: Record<FileCategory, number>;
  totalFiles: number;
  trashedCount: number;
}

export type LibraryItem =
  | { kind: 'folder'; key: string; folder: FolderRecord; count: number }
  | { kind: 'file'; key: string; file: FileRecord };

export function isFlat(q: Pick<LibraryQuery, 'filter' | 'search'>): boolean {
  return q.filter !== 'all' || q.search.trim() !== '';
}

/** Translates what the user picked on screen into a database query for files. */
export function toFileQuery(q: LibraryQuery): FileQuery {
  const base = { sort: q.sort, direction: q.direction } as const;
  if (!isFlat(q)) return { ...base, folderId: q.folderId };
  return {
    ...base,
    search: q.search,
    favoritesOnly: q.filter === 'favorites' ? true : undefined,
    category: q.filter === 'all' || q.filter === 'favorites' ? undefined : q.filter,
  };
}

export async function loadLibrary(
  repos: Pick<Repositories, 'files' | 'folders'>,
  q: LibraryQuery,
): Promise<LibraryData> {
  const flat = isFlat(q);
  const [files, folders, folderCounts, categoryCounts, trashedCount] = await Promise.all([
    repos.files.list(toFileQuery(q)),
    flat ? Promise.resolve<FolderRecord[]>([]) : repos.folders.listChildren(q.folderId),
    flat ? Promise.resolve<Record<string, number>>({}) : repos.folders.itemCounts(),
    repos.files.countByCategory(),
    repos.files.count(true),
  ]);
  const totalFiles = Object.values(categoryCounts).reduce((a, b) => a + b, 0);
  return { flat, folders, folderCounts, files, categoryCounts, totalFiles, trashedCount };
}

/** Folders first, then files, as one list for the screen. */
export function buildItems(
  data: Pick<LibraryData, 'folders' | 'folderCounts' | 'files'>,
): LibraryItem[] {
  const items: LibraryItem[] = [];
  for (const folder of data.folders) {
    items.push({
      kind: 'folder',
      key: `d:${folder.id}`,
      folder,
      count: data.folderCounts[folder.id] ?? 0,
    });
  }
  for (const file of data.files) items.push({ kind: 'file', key: `f:${file.id}`, file });
  return items;
}
