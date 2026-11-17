import Constants from 'expo-constants';

export type Variant = 'store' | 'direct';

/**
 * The only place that reads the build flavor.
 * UI code must use FEATURES (config/features.ts), never VARIANT directly.
 * Defaults to `store`, the more restrictive flavor, if nothing is set.
 */
function readVariant(): Variant {
  const fromConfig = (Constants.expoConfig?.extra as { variant?: string } | undefined)?.variant;
  const raw = fromConfig ?? process.env.APP_VARIANT;
  return raw === 'direct' ? 'direct' : 'store';
}

export const VARIANT: Variant = readVariant();
