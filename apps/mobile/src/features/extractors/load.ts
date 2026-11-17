import type { ExtractorModule } from './types';

/**
 * Single entry point for platform extraction.
 * `@extractors-impl` is aliased per flavor (see metro.config.js), so the
 * store build gets the no-op and the real code never ships in it.
 * Kept async so the real client can load lazily or fetch its manifest later.
 */
export async function loadExtractors(): Promise<ExtractorModule> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require('@extractors-impl') as { default: ExtractorModule };
  return mod.default;
}
