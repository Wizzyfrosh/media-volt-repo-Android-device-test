import { Directory, File, Paths } from 'expo-file-system';
import type { FileSystemPort } from '../ports';

/** FileSystemPort backed by expo-file-system. Library files live in the app's private document folder. */
export function createExpoFileSystem(): FileSystemPort {
  const library = new Directory(Paths.document, 'library');
  const thumbs = new Directory(Paths.document, 'thumbnails');
  const partial = new Directory(Paths.document, 'downloads');

  const isDirectory = (path: string) => Paths.info(path).isDirectory === true;

  return {
    libraryDir: () => library.uri,
    thumbnailDir: () => thumbs.uri,
    downloadsDir: () => partial.uri,

    async ensureDir(path) {
      const dir = new Directory(path);
      if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
    },

    async exists(path) {
      return Paths.info(path).exists;
    },

    async sizeOf(path) {
      return new File(path).size;
    },

    async move(from, to) {
      await new File(from).move(new File(to));
    },

    async copy(from, to) {
      await new File(from).copy(new File(to));
    },

    async remove(path) {
      const info = Paths.info(path);
      if (!info.exists) return;
      if (isDirectory(path)) new Directory(path).delete();
      else new File(path).delete();
    },

    async writeText(path, content) {
      const file = new File(path);
      file.create({ overwrite: true, intermediates: true });
      await file.write(content);
    },

    freeSpace: () => Paths.availableDiskSpace,
  };
}
