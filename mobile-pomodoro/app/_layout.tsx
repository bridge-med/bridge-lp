import { ZenKakuGothicNew_400Regular, ZenKakuGothicNew_500Medium, ZenKakuGothicNew_700Bold } from '@expo-google-fonts/zen-kaku-gothic-new';
import { Feather } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ThemeProvider, useColors, useIsDark } from '../components/ThemeProvider';
import { refreshStaleSample, seedSampleData } from '../lib/data';
import { prefs } from '../lib/prefs';
import { colors, fonts } from '../lib/theme';

// Bump when the built-in sample content changes; untouched old samples refresh.
const SAMPLE_VERSION = 2;

void SplashScreen.preventAutoHideAsync();

function Navigator() {
  const c = useColors();
  const isDark = useIsDark();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.bg },
          headerTitleStyle: { color: c.text, fontFamily: fonts.gothicBold },
          headerTintColor: c.primary,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ZenKakuGothicNew_400Regular,
    ZenKakuGothicNew_500Medium,
    ZenKakuGothicNew_700Bold,
    // Preload the icon font through the asset pipeline so it resolves under a
    // subpath deploy (e.g. GitHub Pages) on web too.
    ...Feather.font,
  });

  useEffect(() => {
    void (async () => {
      await prefs.load();
      const p = prefs.getSnapshot();
      if (!p.seeded) {
        await seedSampleData();
        await prefs.set({ seeded: true, sampleVersion: SAMPLE_VERSION });
      } else if (p.sampleVersion < SAMPLE_VERSION) {
        // One-time refresh of an untouched older sample set.
        const cleared = await refreshStaleSample();
        if (cleared) await seedSampleData();
        await prefs.set({ sampleVersion: SAMPLE_VERSION });
      }
    })().catch((e) => console.warn('init failed', e?.message));
  }, []);

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <ThemeProvider>
          <Navigator />
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
