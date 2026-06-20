import type { ConfigContext, ExpoConfig } from 'expo/config';

// Dynamic config so the EAS project id / owner can come from env without
// committing them. With no env set, this stays Expo Go / web-export friendly.
// No ads / tracking SDKs — privacy "data not collected".

const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? '';
const EAS_OWNER = process.env.EAS_OWNER ?? '';

export default ({ config }: ConfigContext): ExpoConfig => {
  const result = {
    ...config,
    name: 'BRIDGE Focus',
    slug: 'bridge-focus',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    scheme: 'bridgefocus',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.bridgemed.focus',
    },
    android: {
      package: 'com.bridgemed.focus',
      adaptiveIcon: {
        backgroundColor: '#F6F7F9',
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
    plugins: [
      'expo-router',
      ['expo-splash-screen', { image: './assets/splash-icon.png', imageWidth: 200, backgroundColor: '#F6F7F9' }],
      'expo-notifications',
    ],
    experiments: {
      typedRoutes: true,
      // Served at https://bridge-med.github.io/bridge-lp/pomodoro-app/ for the
      // web preview. Adjust for any other host.
      baseUrl: '/bridge-lp/pomodoro-app',
    },
    owner: EAS_OWNER || undefined,
    extra: {
      eas: EAS_PROJECT_ID ? { projectId: EAS_PROJECT_ID } : undefined,
    },
  };
  return result as ExpoConfig;
};
