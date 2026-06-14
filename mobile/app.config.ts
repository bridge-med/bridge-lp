import type { ConfigContext, ExpoConfig } from 'expo/config';

// Dynamic config so EAS project id, AdMob ids, etc. can come from env without
// committing secrets. With no env set, this is identical to the previous
// app.json and the AdMob plugin is omitted (keeps Expo Go / web export working).

const ADMOB_ANDROID_APP_ID = process.env.ADMOB_ANDROID_APP_ID ?? '';
const ADMOB_IOS_APP_ID = process.env.ADMOB_IOS_APP_ID ?? '';
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? '';
const EAS_OWNER = process.env.EAS_OWNER ?? '';

export default ({ config }: ConfigContext): ExpoConfig => {
  const plugins: NonNullable<ExpoConfig['plugins']> = ['expo-router'];

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
    name: 'BRIDGE Worklog',
    slug: 'bridge-worklog',
    version: '0.1.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'bridgeworklog',
    userInterfaceStyle: 'light',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.bridgemed.worklog',
    },
    android: {
      package: 'com.bridgemed.worklog',
      adaptiveIcon: {
        backgroundColor: '#E8F1F8',
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
