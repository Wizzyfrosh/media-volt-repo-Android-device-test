import type { ConfigContext, ExpoConfig } from 'expo/config';

/**
 * One codebase, two flavors. APP_VARIANT is set by the EAS build profile
 * (see eas.json) or on the command line: APP_VARIANT=direct pnpm start
 *
 * Package IDs and the brand name are placeholders: change them here, once,
 * before the first store upload. They cannot be changed after publishing.
 */
const BRAND = 'MediaVault';
const PACKAGE_BASE = 'com.wizzyfrosh.mediavault';

const VARIANTS = {
  store: {
    name: BRAND,
    scheme: 'mediavault',
    packageId: PACKAGE_BASE,
  },
  direct: {
    name: `${BRAND} Direct`,
    scheme: 'mediavault-direct',
    packageId: `${PACKAGE_BASE}.direct`,
  },
} as const;

type Variant = keyof typeof VARIANTS;

function resolveVariant(): Variant {
  return process.env.APP_VARIANT === 'direct' ? 'direct' : 'store';
}

export default ({ config }: ConfigContext): ExpoConfig => {
  const variant = resolveVariant();
  const v = VARIANTS[variant];

  return {
    ...config,
    name: v.name,
    slug: 'mediavault',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: v.scheme,
    userInterfaceStyle: 'automatic',
    ios: {
      bundleIdentifier: v.packageId,
      supportsTablet: false,
    },
    android: {
      package: v.packageId,
      adaptiveIcon: {
        backgroundColor: '#0B0D12',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      predictiveBackGestureEnabled: false,
      // Permissions are added per feature, in the phase that needs them.
      permissions: [],
      // The media library plugin adds broad read permissions we never use.
      // We only save files out to the gallery, which needs no read access.
      blockedPermissions: [
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.READ_MEDIA_VISUAL_USER_SELECTED',
      ],
    },
    plugins: [
      'expo-router',
      'expo-sqlite',
      [
        'expo-media-library',
        {
          // Save-only: MediaVault never reads the user's photo library.
          photosPermission: false,
          savePhotosPermission:
            'MediaVault saves videos, images and audio you choose to your photo library.',
          granularPermissions: [],
        },
      ],
      [
        'expo-splash-screen',
        {
          backgroundColor: '#0B0D12',
          image: './assets/images/splash-icon.png',
          imageWidth: 120,
        },
      ],
    ],
    experiments: {
      // Turn on once `expo customize` generated types are committed or generated in CI.
      typedRoutes: false,
    },
    extra: {
      variant,
    },
  };
};
