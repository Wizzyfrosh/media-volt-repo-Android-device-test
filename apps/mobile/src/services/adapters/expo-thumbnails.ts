import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as VideoThumbnails from 'expo-video-thumbnails';
import type { FileSystemPort, ThumbnailPort } from '../ports';
import { joinPath } from '../naming';

const THUMB_WIDTH = 320;

/** Small JPEG previews for images and videos. Other types have no thumbnail. */
export function createExpoThumbnails(fs: FileSystemPort): ThumbnailPort {
  return {
    async create({ id, path, category }) {
      if (category !== 'images' && category !== 'videos') return null;

      await fs.ensureDir(fs.thumbnailDir());
      const dest = joinPath(fs.thumbnailDir(), `${id}.jpg`);

      let tempUri: string;
      if (category === 'images') {
        const ref = await ImageManipulator.manipulate(path)
          .resize({ width: THUMB_WIDTH })
          .renderAsync();
        tempUri = (await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.7 })).uri;
      } else {
        tempUri = (await VideoThumbnails.getThumbnailAsync(path, { time: 1000, quality: 0.6 })).uri;
      }

      await fs.move(tempUri, dest);
      return dest;
    },
  };
}
