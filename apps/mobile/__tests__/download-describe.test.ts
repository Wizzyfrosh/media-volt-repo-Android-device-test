import { describeProgress, displayName, tintFor } from '@/features/downloads/describe';
import type { DownloadView } from '@/features/downloads/engine';
import { categoryColors } from '@/theme/tokens';
import { formatEta, formatSpeed } from '@/utils/format';

const base: DownloadView = {
  id: 'd1',
  fileId: null,
  sourceUrl: 'https://www.example.com/a/clip.mp4',
  directUrl: null,
  title: null,
  targetName: null,
  folderId: null,
  mime: null,
  source: 'web',
  status: 'queued',
  bytesTotal: null,
  bytesDone: 0,
  retries: 0,
  errorCode: null,
  createdAt: 1,
  updatedAt: 1,
  progress: null,
  speedBps: null,
  etaSec: null,
};
const MB = 1024 * 1024;

describe('download wording', () => {
  it('names a download from its file name, title, or host', () => {
    expect(displayName({ ...base, targetName: 'Clip.mp4' })).toBe('Clip.mp4');
    expect(displayName({ ...base, title: 'A title' })).toBe('A title');
    expect(displayName(base)).toBe('example.com');
  });

  it('colors by file category', () => {
    expect(tintFor({ ...base, targetName: 'a.mp3' })).toBe(categoryColors.audio);
    expect(tintFor({ ...base, mime: 'application/pdf' })).toBe(categoryColors.documents);
  });

  it('describes a running download with size, speed and time left', () => {
    const text = describeProgress({
      ...base,
      status: 'downloading',
      bytesDone: 5 * MB,
      bytesTotal: 10 * MB,
      progress: 0.5,
      speedBps: MB,
      etaSec: 5,
    });
    expect(text).toBe('5.00 MB of 10.0 MB · 1.00 MB/s · 5 s left');
    expect(describeProgress({ ...base, status: 'downloading', bytesDone: 2 * MB })).toBe('2.00 MB');
  });

  it('describes waiting, retrying, paused, failed and finished states', () => {
    expect(describeProgress(base)).toBe('Waiting to start');
    expect(describeProgress({ ...base, retries: 2, errorCode: 'NETWORK' })).toBe(
      'Retrying (2 of 3)',
    );
    expect(describeProgress({ ...base, status: 'paused', progress: 0.42 })).toBe('Paused at 42%');
    expect(describeProgress({ ...base, status: 'paused', errorCode: 'WAITING_FOR_WIFI' })).toBe(
      'Waiting for Wi-Fi',
    );
    expect(describeProgress({ ...base, status: 'failed', errorCode: 'NO_SPACE' })).toContain(
      'space',
    );
    expect(describeProgress({ ...base, status: 'completed', bytesTotal: 3 * MB })).toBe('3.00 MB');
    expect(describeProgress({ ...base, status: 'canceled' })).toBe('Canceled');
    expect(describeProgress({ ...base, status: 'verifying' })).toBe('Saving to your library');
  });

  it('formats speed and time left', () => {
    expect(formatSpeed(2.5 * MB)).toBe('2.50 MB/s');
    expect([formatEta(8), formatEta(150), formatEta(4000)]).toEqual([
      '8 s left',
      '3 min left',
      '1 h 7 min left',
    ]);
  });
});
