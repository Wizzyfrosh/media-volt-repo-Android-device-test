import { loadExtractors } from '@/features/extractors/load';
import { resolveExtractorsImpl } from '../metro.extractors';

const direct = process.env.APP_VARIANT === 'direct';

describe('extractor loading follows the build flavor', () => {
  it(`loads the ${direct ? 'real client' : 'no-op'} for APP_VARIANT=${direct ? 'direct' : 'store'}`, async () => {
    const mod = await loadExtractors();
    expect(mod.enabled).toBe(direct);
    expect(mod.supportedSources.length > 0).toBe(direct);
  });

  it('metro alias points the store build at the no-op and direct at the real module', () => {
    expect(resolveExtractorsImpl('store', '/app')).toMatch(/impl\.noop\.ts$/);
    expect(resolveExtractorsImpl('direct', '/app')).toMatch(/impl[\\/]index\.ts$/);
  });
});
