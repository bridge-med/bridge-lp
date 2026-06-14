import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Onboarding } from '../components/Onboarding';
import { ThemeProvider, useColors } from '../components/ThemeProvider';
import { loadAll } from '../lib/data';
import { entitlement } from '../lib/entitlement';
import { prefs, usePrefs } from '../lib/prefs';

function Navigator() {
  const c = useColors();
  const { onboardingDone } = usePrefs();
  const showOnboarding = prefs.isLoaded() && !onboardingDone;

  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: c.surface },
          headerTitleStyle: { color: c.text, fontWeight: '700' },
          headerTintColor: c.primary,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: c.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="review" options={{ title: 'ふりかえり', headerBackTitle: '戻る' }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
      <Onboarding visible={showOnboarding} />
    </>
  );
}

export default function RootLayout() {
  useEffect(() => {
    void loadAll();
    void entitlement.load();
    void prefs.load();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Navigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
