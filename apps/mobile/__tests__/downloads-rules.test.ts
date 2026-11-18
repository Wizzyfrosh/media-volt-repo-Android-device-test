import {
  backoffDelayMs,
  classifyFailure,
  describeFailure,
  MAX_RETRIES,
} from '@/features/downloads/retry';
import {
  assertTransition,
  canTransition,
  InvalidTransitionError,
  isOpen,
  isTerminal,
  usesSlot,
} from '@/features/downloads/state-machine';
import { concurrencyFor } from '@/features/downloads/limits';
import type { DownloadStatus } from '@/db/types';

const ALL: DownloadStatus[] = [
  'queued',
  'resolving',
  'downloading',
  'paused',
  'verifying',
  'completed',
  'failed',
  'canceled',
];

describe('state machine', () => {
  it('allows the normal happy path', () => {
    expect(canTransition('queued', 'downloading')).toBe(true);
    expect(canTransition('downloading', 'verifying')).toBe(true);
    expect(canTransition('verifying', 'completed')).toBe(true);
  });

  it('allows pause, resume and retry loops', () => {
    expect(canTransition('downloading', 'paused')).toBe(true);
    expect(canTransition('paused', 'queued')).toBe(true);
    expect(canTransition('downloading', 'queued')).toBe(true);
    expect(canTransition('failed', 'queued')).toBe(true);
  });

  it('never leaves completed or canceled', () => {
    for (const to of ALL) {
      expect(canTransition('completed', to)).toBe(false);
      expect(canTransition('canceled', to)).toBe(false);
    }
  });

  it('rejects shortcuts that would skip work', () => {
    expect(canTransition('queued', 'completed')).toBe(false);
    expect(canTransition('queued', 'paused')).toBe(false);
    expect(canTransition('paused', 'completed')).toBe(false);
    expect(canTransition('failed', 'downloading')).toBe(false);
    expect(() => assertTransition('completed', 'queued')).toThrow(InvalidTransitionError);
  });

  it('groups statuses', () => {
    expect(ALL.filter(usesSlot)).toEqual(['resolving', 'downloading', 'verifying']);
    expect(ALL.filter(isTerminal)).toEqual(['completed', 'canceled']);
    expect(ALL.filter(isOpen)).toEqual([
      'queued',
      'resolving',
      'downloading',
      'paused',
      'verifying',
    ]);
  });

  it('free users get 1 slot and Pro gets 5', () => {
    expect([concurrencyFor(false), concurrencyFor(true)]).toEqual([1, 5]);
  });
});

describe('retry policy', () => {
  it('backs off 2s, 4s, 8s and caps at 30s', () => {
    expect([0, 1, 2].map(backoffDelayMs)).toEqual([2000, 4000, 8000]);
    expect(backoffDelayMs(10)).toBe(30000);
    expect(backoffDelayMs(-1)).toBe(2000);
    expect(MAX_RETRIES).toBe(3);
  });
});

describe('classifyFailure', () => {
  const cases: [string, { code: number | null; message: string }, string, boolean][] = [
    ['android out of space', { code: 1006, message: 'x' }, 'NO_SPACE', false],
    ['out of space by text', { code: null, message: 'No space left on device' }, 'NO_SPACE', false],
    ['android file error', { code: 1001, message: 'x' }, 'IMPORT_FAILED', false],
    ['http 404 code', { code: 404, message: '' }, 'NOT_FOUND', false],
    ['http 404 text', { code: 0, message: 'HTTP status 404' }, 'NOT_FOUND', false],
    ['http 410 gone', { code: 410, message: '' }, 'LINK_EXPIRED', false],
    ['http 403 forbidden', { code: 403, message: '' }, 'ACCESS_DENIED', false],
    ['http 401', { code: 401, message: '' }, 'ACCESS_DENIED', false],
    ['http 429 rate limit', { code: 429, message: '' }, 'SERVER_ERROR', true],
    ['http 503', { code: 503, message: '' }, 'SERVER_ERROR', true],
    ['timeout text', { code: null, message: 'The request timed out.' }, 'NETWORK', true],
    ['ios offline', { code: -1009, message: '' }, 'NETWORK', true],
    ['ios connection lost', { code: -1005, message: '' }, 'NETWORK', true],
    ['unknown', { code: 7, message: 'weird' }, 'UNKNOWN', true],
  ];

  it.each(cases)('%s', (_name, input, code, retryable) => {
    expect(classifyFailure(input)).toEqual({ code, retryable });
  });

  it('explains every code in plain language', () => {
    for (const c of [
      'NO_SPACE',
      'LINK_EXPIRED',
      'NOT_FOUND',
      'ACCESS_DENIED',
      'SERVER_ERROR',
      'NETWORK',
      'INCOMPLETE',
      'IMPORT_FAILED',
      'UNKNOWN',
    ]) {
      expect(describeFailure(c).length).toBeGreaterThan(10);
    }
    expect(describeFailure('WAITING_FOR_WIFI')).toBe('Waiting for Wi-Fi');
    expect(describeFailure(null)).toContain('stopped');
    expect(describeFailure('SOMETHING_NEW')).toContain('stopped');
  });
});
