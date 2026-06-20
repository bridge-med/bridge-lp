import { ZenKakuGothicNew_400Regular, ZenKakuGothicNew_500Medium, ZenKakuGothicNew_700Bold } from '@expo-google-fonts/zen-kaku-gothic-new';
import { ZenMaruGothic_400Regular, ZenMaruGothic_500Medium, ZenMaruGothic_700Bold, ZenMaruGothic_900Black } from '@expo-google-fonts/zen-maru-gothic';
import { Feather } from '@expo/vector-icons';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { ThemeProvider, useColors } from '../components/ThemeProvider';
import { loadAll } from '../lib/data';
import { scheduleDaily } from '../lib/notifications';
import { prefs } from '../lib/prefs';
import { colors, fonts } from '../lib/theme';

void SplashScreen.preventAutoHideAsync();

function Navigator() {
  const c = useColors();
  return (
    <>
      <StatusBar style="dark" />
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
    ZenMaruGothic_400Regular,
    ZenMaruGothic_500Medium,
    ZenMaruGothic_700Bold,
    ZenMaruGothic_900Black,
    // Preload the icon font through the asset pipeline so it resolves under a
    // subpath deploy (e.g. GitHub Pages /bridge-lp/pomodoro-app/) on web too.
    ...Feather.font,
  });

  useEffect(() => {
    void loadAll().catch((e) => console.warn('loadAll failed', e?.message));
    void prefs.load().then(() => {
      const p = prefs.getSnapshot();
      if (p.reminderEnabled) void scheduleDaily(p.reminderHour, p.reminderMinute);
    });
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
