/** Downloads allowed at the same time. Free: 1, Pro: 5 (see PRD, section 6). */
export const FREE_CONCURRENCY = 1;
export const PRO_CONCURRENCY = 5;

export function concurrencyFor(isPro: boolean): number {
  return isPro ? PRO_CONCURRENCY : FREE_CONCURRENCY;
}
