import type { FolderRecord } from '@/db/types';

export interface FolderOption {
  folder: FolderRecord;
  /** 0 for top-level folders. */
  depth: number;
}

/**
 * Every folder in tree order (a folder, then its children), for the "Move to" picker.
 * `exclude` removes folders and everything inside them, so a folder cannot be moved into itself.
 */
export function flattenFolderTree(
  all: readonly FolderRecord[],
  exclude: ReadonlySet<string> = new Set(),
): FolderOption[] {
  const byParent = new Map<string | null, FolderRecord[]>();
  for (const f of all) {
    const list = byParent.get(f.parentId) ?? [];
    list.push(f);
    byParent.set(f.parentId, list);
  }
  const out: FolderOption[] = [];
  const walk = (parentId: string | null, depth: number) => {
    const children = [...(byParent.get(parentId) ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }),
    );
    for (const folder of children) {
      if (exclude.has(folder.id)) continue;
      out.push({ folder, depth });
      walk(folder.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

/** "Trips / Italy / 2026" style path for a folder. */
export function folderPath(all: readonly FolderRecord[], id: string | null): string {
  const byId = new Map(all.map((f) => [f.id, f]));
  const names: string[] = [];
  let cursor = id ? byId.get(id) : undefined;
  while (cursor && names.length < 50) {
    names.unshift(cursor.name);
    cursor = cursor.parentId ? byId.get(cursor.parentId) : undefined;
  }
  return names.length > 0 ? names.join(' / ') : 'Library';
}
