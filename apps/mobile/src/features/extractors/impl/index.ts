import type { ExtractorModule } from '../types';

/**
 * Direct flavor only. The real resolver client arrives in Phase 2b.
 * The marker string below is checked by scripts/check-store-bundle.mjs:
 * it must be present in the direct bundle and absent from the store bundle.
 */
const impl: ExtractorModule & { readonly marker: string } = {
  marker: 'MV_EXTRACTORS_IMPL_PRESENT',
  enabled: true,
  supportedSources: ['instagram', 'tiktok', 'facebook', 'twitter', 'youtube', 'snapchat'],
};

export default impl;
