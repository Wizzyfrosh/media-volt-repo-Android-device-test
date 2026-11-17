import { createFeatures } from '@/config/features';

describe('feature flags per flavor', () => {
  it('store flavor has no social extraction, browser detection or self updater', () => {
    const f = createFeatures('store', false);
    expect(f.socialExtraction).toBe(false);
    expect(f.inAppBrowserDetection).toBe(false);
    expect(f.selfUpdater).toBe(false);
    expect(f.billing).toBe('iap');
  });

  it('direct flavor enables extraction, browser detection and updater', () => {
    const f = createFeatures('direct', false);
    expect(f.socialExtraction).toBe(true);
    expect(f.inAppBrowserDetection).toBe(true);
    expect(f.selfUpdater).toBe(true);
    expect(f.billing).toBe('license');
  });

  it('demo data is only on in development builds', () => {
    expect(createFeatures('store', true).demoData).toBe(true);
    expect(createFeatures('direct', false).demoData).toBe(false);
  });
});
