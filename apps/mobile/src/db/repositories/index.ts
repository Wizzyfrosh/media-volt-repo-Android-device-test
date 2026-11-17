import type { Db } from '../types';
import { DownloadsRepo } from './downloads';
import { FilesRepo } from './files';
import { FoldersRepo } from './folders';
import { SettingsRepo } from './settings';

export { DownloadsRepo, FilesRepo, FoldersRepo, SettingsRepo };
export type { FilePatch, FileQuery, FileSort, NewFile } from './files';
export type { DownloadPatch } from './downloads';

export interface Repositories {
  folders: FoldersRepo;
  files: FilesRepo;
  downloads: DownloadsRepo;
  settings: SettingsRepo;
}

export function createRepositories(db: Db, now: () => number = Date.now): Repositories {
  return {
    folders: new FoldersRepo(db, now),
    files: new FilesRepo(db, now),
    downloads: new DownloadsRepo(db, now),
    settings: new SettingsRepo(db),
  };
}
