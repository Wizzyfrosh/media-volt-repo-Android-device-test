import type { DownloadStatus } from '@/db/types';

/** Every legal move between download states. Anything else is a bug and throws. */
const ALLOWED: Record<DownloadStatus, readonly DownloadStatus[]> = {
  queued: ['resolving', 'downloading', 'failed', 'canceled'],
  resolving: ['downloading', 'queued', 'failed', 'canceled'],
  downloading: ['paused', 'verifying', 'queued', 'failed', 'canceled'],
  paused: ['downloading', 'queued', 'failed', 'canceled'],
  verifying: ['completed', 'queued', 'failed', 'canceled'],
  failed: ['queued', 'canceled'],
  completed: [],
  canceled: [],
};

export class InvalidTransitionError extends Error {
  constructor(
    readonly from: DownloadStatus,
    readonly to: DownloadStatus,
  ) {
    super(`A download cannot go from "${from}" to "${to}".`);
    this.name = 'InvalidTransitionError';
  }
}

export function canTransition(from: DownloadStatus, to: DownloadStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function assertTransition(from: DownloadStatus, to: DownloadStatus): void {
  if (!canTransition(from, to)) throw new InvalidTransitionError(from, to);
}

/** Finished for good: no further work, and no way back. */
export function isTerminal(status: DownloadStatus): boolean {
  return status === 'completed' || status === 'canceled';
}

/** Uses one of the concurrent download slots. */
export function usesSlot(status: DownloadStatus): boolean {
  return status === 'resolving' || status === 'downloading' || status === 'verifying';
}

/** Still has work to do or can be resumed. Failed downloads are not open: they wait for a manual retry. */
export function isOpen(status: DownloadStatus): boolean {
  return status === 'queued' || status === 'paused' || usesSlot(status);
}

export const STATUS_GROUP = {
  active: ['queued', 'resolving', 'downloading', 'paused', 'verifying'],
  completed: ['completed'],
  failed: ['failed', 'canceled'],
} as const satisfies Record<string, readonly DownloadStatus[]>;
