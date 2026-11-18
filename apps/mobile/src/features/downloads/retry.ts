export const MAX_RETRIES = 3;
const BASE_DELAY_MS = 2_000;
const MAX_DELAY_MS = 30_000;

/** Wait before retry number `attempt` (0 = first retry): 2s, 4s, 8s, capped at 30s. */
export function backoffDelayMs(attempt: number): number {
  return Math.min(BASE_DELAY_MS * 2 ** Math.max(0, attempt), MAX_DELAY_MS);
}

/** Code stored on a failed download and mapped to plain language in the UI. */
export type FailureCode =
  | 'NO_SPACE'
  | 'LINK_EXPIRED'
  | 'NOT_FOUND'
  | 'ACCESS_DENIED'
  | 'SERVER_ERROR'
  | 'NETWORK'
  | 'INCOMPLETE'
  | 'IMPORT_FAILED'
  | 'UNKNOWN';

export interface Classification {
  code: FailureCode;
  retryable: boolean;
}

export const USER_CANCELED_CODE = -1;

// android.app.DownloadManager ERROR_* constants
const ANDROID_INSUFFICIENT_SPACE = 1006;
const ANDROID_DEVICE_NOT_FOUND = 1007;
const ANDROID_FILE_ERROR = 1001;
const ANDROID_FILE_ALREADY_EXISTS = 1009;

/**
 * Decides whether a failed transfer is worth retrying. Native libraries report errors as a numeric
 * code plus free text, and the code space differs per platform, so this looks at both.
 * Unknown errors are retried (up to MAX_RETRIES) because most real failures are network blips.
 */
export function classifyFailure(input: { code: number | null; message: string }): Classification {
  const { code } = input;
  const text = input.message.toLowerCase();

  if (
    code === ANDROID_INSUFFICIENT_SPACE ||
    code === ANDROID_DEVICE_NOT_FOUND ||
    /no space|insufficient|disk full|not enough (storage|space)/.test(text)
  ) {
    return { code: 'NO_SPACE', retryable: false };
  }
  if (code === ANDROID_FILE_ERROR || code === ANDROID_FILE_ALREADY_EXISTS) {
    return { code: 'IMPORT_FAILED', retryable: false };
  }

  const http = httpStatus(code, text);
  if (http !== null) {
    if (http === 404) return { code: 'NOT_FOUND', retryable: false };
    if (http === 410) return { code: 'LINK_EXPIRED', retryable: false };
    if (http === 401 || http === 403) return { code: 'ACCESS_DENIED', retryable: false };
    if (http === 408 || http === 429) return { code: 'SERVER_ERROR', retryable: true };
    if (http >= 500) return { code: 'SERVER_ERROR', retryable: true };
    if (http >= 400) return { code: 'ACCESS_DENIED', retryable: false };
  }

  if (/timed? ?out|connection|network|offline|unreachable|reset|lost|dns|ssl|host/.test(text)) {
    return { code: 'NETWORK', retryable: true };
  }
  // iOS NSURLError codes for connectivity problems: -1001 timeout, -1004 cannot connect, -1005 connection lost,
  // -1009 offline, -1200..-1206 TLS
  if (code !== null && [-1001, -1003, -1004, -1005, -1009].includes(code)) {
    return { code: 'NETWORK', retryable: true };
  }
  return { code: 'UNKNOWN', retryable: true };
}

function httpStatus(code: number | null, text: string): number | null {
  if (code !== null && code >= 400 && code <= 599) return code;
  const m = /\bhttp(?: status)?(?: code)?[: ]+(\d{3})\b|\b(4\d\d|5\d\d)\b/.exec(text);
  const n = Number(m?.[1] ?? m?.[2]);
  return n >= 400 && n <= 599 ? n : null;
}

const MESSAGES: Record<FailureCode, string> = {
  NO_SPACE: 'Not enough space on your phone. Free up some space and try again.',
  LINK_EXPIRED: 'This link has expired. Get a fresh link and try again.',
  NOT_FOUND: 'The file was not found at this link.',
  ACCESS_DENIED: 'The site did not allow this download.',
  SERVER_ERROR: 'The server had a problem. Try again in a few minutes.',
  NETWORK: 'The connection was lost. Check your internet and try again.',
  INCOMPLETE: 'The file did not finish downloading. Try again.',
  IMPORT_FAILED: 'The file could not be saved to your library.',
  UNKNOWN: 'The download stopped unexpectedly. Try again.',
};

/** Plain-language explanation for the queue screen. */
export function describeFailure(code: string | null): string {
  if (code === 'WAITING_FOR_WIFI') return 'Waiting for Wi-Fi';
  if (code === 'WAITING_FOR_NETWORK') return 'Waiting for a connection';
  return MESSAGES[(code ?? 'UNKNOWN') as FailureCode] ?? MESSAGES.UNKNOWN;
}
