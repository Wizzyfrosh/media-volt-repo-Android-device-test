import type { Repositories } from '@/db/repositories';
import type { Db, FileCategory } from '@/db/types';

export const PERF_SOURCE = 'perf-test';

const KINDS: { category: FileCategory; prefix: string; ext: string; mime: string }[] = [
  { category: 'videos', prefix: 'Clip', ext: 'mp4', mime: 'video/mp4' },
  { category: 'audio', prefix: 'Track', ext: 'mp3', mime: 'audio/mpeg' },
  { category: 'images', prefix: 'IMG', ext: 'jpg', mime: 'image/jpeg' },
  { category: 'documents', prefix: 'Report', ext: 'pdf', mime: 'application/pdf' },
  { category: 'archives', prefix: 'Backup', ext: 'zip', mime: 'application/zip' },
  { category: 'other', prefix: 'Data', ext: 'bin', mime: 'application/octet-stream' },
];

/**
 * Adds database rows that look like files (no bytes on disk) so scrolling and search can be checked with a big library.
 * Development builds only. Remove them with removePerfFiles.
 */
export async function seedPerfFiles(
  db: Db,
  repos: Pick<Repositories, 'files'>,
  count: number,
): Promise<number> {
  await db.withTransactionAsync(async () => {
    for (let i = 0; i < count; i++) {
      const k = KINDS[i % KINDS.length]!;
      await repos.files.insert({
        folderId: null,
        name: `${k.prefix} ${i + 1}${i % 9 === 0 ? ' holiday' : ''}.${k.ext}`,
        path: `/perf/${i}.${k.ext}`,
        mime: k.mime,
        category: k.category,
        sizeBytes: ((i + 1) * 7919) % 900_000_000,
        source: PERF_SOURCE,
        durationSec: k.category === 'videos' || k.category === 'audio' ? 30 + (i % 600) : null,
      });
    }
  });
  return count;
}

export async function removePerfFiles(repos: Pick<Repositories, 'files'>): Promise<number> {
  return repos.files.deleteBySource(PERF_SOURCE);
}
