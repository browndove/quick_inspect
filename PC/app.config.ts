import type { ConfigContext, ExpoConfig } from 'expo/config';

/** Production API (Railway). Override with EXPO_PUBLIC_API_URL for local FastAPI. */
const DEFAULT_API_ORIGIN = 'https://pc-server-production.up.railway.app';

/**
 * Production-oriented defaults. Override bundle IDs with env at build time if needed:
 *   IOS_BUNDLE_ID=com.yourorg.quikinspect ANDROID_PACKAGE=com.yourorg.quikinspect
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const raw = (process.env.EXPO_PUBLIC_API_URL ?? '').trim();
  const apiUrl = (raw || DEFAULT_API_ORIGIN).replace(/\/$/, '');
  const allowCleartext = apiUrl.startsWith('http://');

  return {
    ...config,
    name: 'Quik Inspect',
    slug: 'quik-inspect',
    extra: {
      ...config.extra,
      /** Fallback when Metro env injection differs from native manifest (EAS / rebuilds). */
      apiUrl,
    },
    ios: {
      ...config.ios,
      bundleIdentifier: process.env.IOS_BUNDLE_ID ?? 'com.quikinspect.app',
      infoPlist: {
        ...config.ios?.infoPlist,
        NSAllowsLocalNetworking: true,
      },
    },
    android: {
      ...config.android,
      package: process.env.ANDROID_PACKAGE ?? 'com.quikinspect.app',
      softwareKeyboardLayoutMode: 'resize',
      ...(allowCleartext ? { usesCleartextTraffic: true } : {}),
    } as ExpoConfig['android'],
  };
};
