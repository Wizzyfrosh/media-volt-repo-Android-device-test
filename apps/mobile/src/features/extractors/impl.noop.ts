import type { ExtractorModule } from './types';

/**
 * Store flavor stand-in. Metro resolves `@extractors-impl` to this file
 * for the store build, so ./impl/ is never reachable and never bundled.
 */
const noop: ExtractorModule = {
  enabled: false,
  supportedSources: [],
};

export default noop;
