import type { FileSystemPort, MediaExportPort, ThumbnailPort } from '@/services/ports';

export interface MemoryFs extends FileSystemPort {
  files: Map<string, { size: number; text?: string }>;
  /** Test helper: put a file on the fake disk. */
  seed(path: string, size?: number, text?: string): void;
}

/** An in-memory FileSystemPort so FileService can be tested without a device. */
export function createMemoryFs(): MemoryFs {
  const files = new Map<string, { size: number; text?: string }>();
  const dirs = new Set<string>();
  const need = (p: string) => {
    const f = files.get(p);
    if (!f) throw new Error(`ENOENT: ${p}`);
    return f;
  };
  return {
    files,
    seed: (path, size = 100, text) => void files.set(path, { size, text }),
    libraryDir: () => '/data/library/',
    thumbnailDir: () => '/data/thumbs/',
    downloadsDir: () => '/data/downloads/',
    ensureDir: async (p) => void dirs.add(p),
    exists: async (p) => files.has(p) || dirs.has(p),
    sizeOf: async (p) => need(p).size,
    move: async (from, to) => {
      files.set(to, need(from));
      files.delete(from);
    },
    copy: async (from, to) => void files.set(to, { ...need(from) }),
    remove: async (p) => void files.delete(p),
    writeText: async (p, content) => void files.set(p, { size: content.length, text: content }),
    freeSpace: () => 1_000_000,
  };
}

export const fakeThumbnails = (fs: MemoryFs): ThumbnailPort => ({
  create: async ({ id, category }) => {
    if (category !== 'images' && category !== 'videos') return null;
    const p = `/data/thumbs/${id}.jpg`;
    fs.seed(p, 10);
    return p;
  },
});

export const fakeMedia = (): MediaExportPort & { calls: unknown[] } => {
  const calls: unknown[] = [];
  return { calls, exportToGallery: async (input) => void calls.push(input) };
};
