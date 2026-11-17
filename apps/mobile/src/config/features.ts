import { VARIANT, type Variant } from './variant';

export interface Features {
  /** Download from social platforms through the remote extractor. Direct flavor only. */
  readonly socialExtraction: boolean;
  /** Detect downloadable media in the in-app browser. Direct flavor only. */
  readonly inAppBrowserDetection: boolean;
  /** In-app APK updater with signature check. Direct flavor only. */
  readonly selfUpdater: boolean;
  /** Which billing system the paywall talks to. */
  readonly billing: 'iap' | 'license';
  /** Show sample data in screens until the data layer lands. Development builds only. */
  readonly demoData: boolean;
}

export function createFeatures(variant: Variant, isDev: boolean): Features {
  const direct = variant === 'direct';
  return {
    socialExtraction: direct,
    inAppBrowserDetection: direct,
    selfUpdater: direct,
    billing: direct ? 'license' : 'iap',
    demoData: isDev,
  };
}

export const FEATURES: Features = createFeatures(VARIANT, __DEV__);
