import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { loadAll } from '../lib/data';
import { entitlement } from '../lib/entitlement';
import { colors } from '../lib/theme';

export default function RootLayout() {
  useEffect(() => {
    void loadAll();
    void entitlement.load();
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { color: colors.text, fontWeight: '700' },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="review" options={{ title: 'ふりかえり', headerBackTitle: '戻る' }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
    </SafeAreaProvider>
  );
}
