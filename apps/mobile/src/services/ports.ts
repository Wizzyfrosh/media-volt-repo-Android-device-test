import type { FileCategory } from '@/db/types';

/**
 * What FileService needs from the device. Real implementations live in ./adapters,
 * and tests use an in-memory version.
 */
export interface FileSystemPort {
  /** Folder that holds every library file. Files are stored as <id><ext>, never by display name. */
  libraryDir(): string;
  /** Folder for generated thumbnails. */
  thumbnailDir(): string;
  /** Folder for unfinished downloads (<id>.part). Finished files are moved into the library. */
  downloadsDir(): string;
  ensureDir(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  sizeOf(path: string): Promise<number>;
  move(from: string, to: string): Promise<void>;
  copy(from: string, to: string): Promise<void>;
  /** Deletes a file. Does nothing if it is already gone. */
  remove(path: string): Promise<void>;
  writeText(path: string, content: string): Promise<void>;
  /** Free space on the device in bytes. */
  freeSpace(): number;
}

export interface ThumbnailPort {
  /** Returns the path of a generated thumbnail, or null if this type has none. */
  create(input: { id: string; path: string; category: FileCategory }): Promise<string | null>;
}

export interface MediaExportPort {
  /** Copies a file into the phone's shared gallery or music library under its display name. */
  exportToGallery(input: {
    path: string;
    displayName: string;
    category: FileCategory;
  }): Promise<void>;
}
