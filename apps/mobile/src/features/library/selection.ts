import type { LibraryItem } from './query';

/** What the user has ticked in selection mode. Immutable: every change returns a new object. */
export interface Selection {
  files: ReadonlySet<string>;
  folders: ReadonlySet<string>;
}

export const EMPTY_SELECTION: Selection = { files: new Set(), folders: new Set() };

export function selectionCount(s: Selection): number {
  return s.files.size + s.folders.size;
}

export function isSelecting(s: Selection): boolean {
  return selectionCount(s) > 0;
}

function toggled(set: ReadonlySet<string>, id: string): Set<string> {
  const next = new Set(set);
  if (!next.delete(id)) next.add(id);
  return next;
}

export function toggleFile(s: Selection, id: string): Selection {
  return { files: toggled(s.files, id), folders: s.folders };
}

export function toggleFolder(s: Selection, id: string): Selection {
  return { files: s.files, folders: toggled(s.folders, id) };
}

export function toggleItem(s: Selection, item: LibraryItem): Selection {
  return item.kind === 'file' ? toggleFile(s, item.file.id) : toggleFolder(s, item.folder.id);
}

export function isItemSelected(s: Selection, item: LibraryItem): boolean {
  return item.kind === 'file' ? s.files.has(item.file.id) : s.folders.has(item.folder.id);
}

export function selectAll(items: readonly LibraryItem[]): Selection {
  return {
    files: new Set(items.flatMap((i) => (i.kind === 'file' ? [i.file.id] : []))),
    folders: new Set(items.flatMap((i) => (i.kind === 'folder' ? [i.folder.id] : []))),
  };
}

/** Drops ticks for items that no longer exist, for example after a delete. */
export function pruneSelection(s: Selection, items: readonly LibraryItem[]): Selection {
  const files = new Set(
    items.flatMap((i) => (i.kind === 'file' && s.files.has(i.file.id) ? [i.file.id] : [])),
  );
  const folders = new Set(
    items.flatMap((i) => (i.kind === 'folder' && s.folders.has(i.folder.id) ? [i.folder.id] : [])),
  );
  return files.size === s.files.size && folders.size === s.folders.size ? s : { files, folders };
}
