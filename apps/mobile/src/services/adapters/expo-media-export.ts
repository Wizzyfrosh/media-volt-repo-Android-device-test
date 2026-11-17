import { Directory, File, Paths } from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import { FileServiceError } from '../file-service';
import type { MediaExportPort } from '../ports';
import { sanitizeName } from '../naming';

/**
 * Saves a copy into the shared gallery (MediaStore on Android) under the file's display name.
 * Asks only for write access, never for permission to read the user's photos.
 */
export function createExpoMediaExport(): MediaExportPort {
  return {
    async exportToGallery({ path, displayName }) {
      const permission = await MediaLibrary.requestPermissionsAsync(true);
      if (!permission.granted) {
        throw new FileServiceError(
          'PERMISSION_DENIED',
          'Allow MediaVault to save to your gallery, then try again.',
        );
      }

      // Library files are stored under an id, so copy to a temp file with the real name first.
      const staging = new Directory(Paths.cache, 'export');
      if (!staging.exists) staging.create({ intermediates: true, idempotent: true });
      const temp = new File(staging, sanitizeName(displayName));
      if (temp.exists) temp.delete();

      await new File(path).copy(temp);
      try {
        await MediaLibrary.Asset.create(temp.uri);
      } finally {
        if (temp.exists) temp.delete();
      }
    },
  };
}
