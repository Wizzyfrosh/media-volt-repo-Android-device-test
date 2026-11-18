import { detectCategory } from '@/services/file-types';
import { categoryColors } from '@/theme/tokens';
import { formatBytes, formatEta, formatSpeed } from '@/utils/format';
import { parseHttpUrl } from '@/utils/url';
import type { DownloadView } from './engine';
import { describeFailure, MAX_RETRIES } from './retry';

/** Name shown for a download. */
export function displayName(d: Pick<DownloadView, 'targetName' | 'title' | 'sourceUrl'>): string {
  return d.targetName ?? d.title ?? parseHttpUrl(d.sourceUrl)?.host ?? 'Download';
}

/** Color of the file's category, for the thumbnail placeholder. */
export function tintFor(
  d: Pick<DownloadView, 'mime' | 'targetName' | 'title' | 'sourceUrl'>,
): string {
  return categoryColors[detectCategory({ mime: d.mime, name: displayName(d) })];
}

/** The small line under the title: what is happening, in plain words. */
export function describeProgress(d: DownloadView): string {
  switch (d.status) {
    case 'downloading': {
      const done =
        d.bytesTotal && d.bytesTotal > 0
          ? `${formatBytes(d.bytesDone)} of ${formatBytes(d.bytesTotal)}`
          : formatBytes(d.bytesDone);
      return [
        done,
        d.speedBps ? formatSpeed(d.speedBps) : null,
        d.etaSec !== null ? formatEta(d.etaSec) : null,
      ]
        .filter(Boolean)
        .join(' · ');
    }
    case 'paused':
      return d.errorCode?.startsWith('WAITING_FOR_')
        ? describeFailure(d.errorCode)
        : `Paused${d.progress !== null ? ` at ${Math.round(d.progress * 100)}%` : ''}`;
    case 'queued':
      return d.retries > 0 ? `Retrying (${d.retries} of ${MAX_RETRIES})` : 'Waiting to start';
    case 'resolving':
      return 'Checking the link';
    case 'verifying':
      return 'Saving to your library';
    case 'completed':
      return formatBytes(d.bytesTotal ?? d.bytesDone);
    case 'failed':
      return describeFailure(d.errorCode);
    case 'canceled':
      return 'Canceled';
  }
}
