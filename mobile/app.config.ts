import type { ConfigContext, ExpoConfig } from 'expo/config';

// Dynamic config so EAS project id, AdMob ids, etc. can come from env without
// committing secrets. With no env set, this is identical to the previous
// app.json and the AdMob plugin is omitted (keeps Expo Go / web export working).

const ADMOB_ANDROID_APP_ID = process.env.ADMOB_ANDROID_APP_ID ?? '';
const ADMOB_IOS_APP_ID = process.env.ADMOB_IOS_APP_ID ?? '';
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? 'c05ffae5-4415-417a-ae5c-053edb27acc4';
const EAS_OWNER = process.env.EAS_OWNER ?? 'wataru1531s-team';

export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins: NonNullable<ExpoConfig['plugins']> = [
    'expo-router',
    ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 200, backgroundColor: '#FBF3E8' }],
    'expo-notifications',
  ];

  // Only add the AdMob native plugin when app ids are provided (production EAS
  // build). Requires `npx expo install react-native-google-mobile-ads` first.
  if (ADMOB_ANDROID_APP_ID || ADMOB_IOS_APP_ID) {
    plugins.push([
      'react-native-google-mobile-ads',
      {
        androidAppId: ADMOB_ANDROID_APP_ID || undefined,
        iosAppId: ADMOB_IOS_APP_ID || undefined,
      },
    ]);
  }

  const result = {
    ...config,
    name: 'キャリアログ',
    slug: 'bridge-worklog',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'bridgeworklog',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    updates: { url: 'https://u.expo.dev/c05ffae5-4415-417a-ae5c-053edb27acc4' },
    runtimeVersion: { policy: 'appVersion' },
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.bridgemed.worklog',
      infoPlist: {
        // Only standard encryption (HTTPS) — exempt from export compliance.
        ITSAppUsesNonExemptEncryption: false,
      },
    },
    android: {
      package: 'com.bridgemed.worklog',
      adaptiveIcon: {
        backgroundColor: '#E27D34',
        foregroundImage: './assets/android-icon-foreground.png',
        backgroundImage: './assets/android-icon-background.png',
        monochromeImage: './assets/android-icon-monochrome.png',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      favicon: './assets/favicon.png',
      bundler: 'metro',
      output: 'static',
    },
    plugins,
    experiments: {
      typedRoutes: true,
      // Served at https://bridge-med.github.io/bridge-lp/daily-app/ for the
      // web preview. Remove/adjust for any other host.
      baseUrl: '/bridge-lp/daily-app',
    },
    owner: EAS_OWNER || undefined,
    extra: {
      eas: EAS_PROJECT_ID ? { projectId: EAS_PROJECT_ID } : undefined,
    },
  };
  return result as ExpoConfig;
};
