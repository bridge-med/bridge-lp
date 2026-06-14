import { ShipporiMincho_400Regular, ShipporiMincho_600SemiBold, ShipporiMincho_800ExtraBold } from '@expo-google-fonts/shippori-mincho';
import { ZenKakuGothicNew_400Regular, ZenKakuGothicNew_500Medium, ZenKakuGothicNew_700Bold } from '@expo-google-fonts/zen-kaku-gothic-new';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Onboarding } from '../components/Onboarding';
import { ThemeProvider, useColors } from '../components/ThemeProvider';
import { credits } from '../lib/credits';
import { loadAll } from '../lib/data';
import { entitlement } from '../lib/entitlement';
import { prefs, usePrefs } from '../lib/prefs';
import { colors, fonts } from '../lib/theme';

void SplashScreen.preventAutoHideAsync();

function Navigator() {
  const c = useColors();
  const { onboardingDone } = usePrefs();
  const showOnboarding = prefs.isLoaded() && !onboardingDone;

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
        <Stack.Screen name="log-edit" options={{ title: '仕事ログ', headerBackTitle: '戻る' }} />
        <Stack.Screen name="log/[id]" options={{ title: '仕事ログ', headerBackTitle: '戻る' }} />
        <Stack.Screen name="career" options={{ title: 'キャリア変換', headerBackTitle: '戻る' }} />
        <Stack.Screen name="m/[key]" options={{ title: '', headerBackTitle: '戻る' }} />
        <Stack.Screen name="coins" options={{ title: 'コイン', headerBackTitle: '戻る' }} />
        <Stack.Screen name="workstyle" options={{ title: '働き方タイプ', headerBackTitle: '戻る' }} />
        <Stack.Screen name="paywall" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
      <Onboarding visible={showOnboarding} />
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    ShipporiMincho_400Regular,
    ShipporiMincho_600SemiBold,
    ShipporiMincho_800ExtraBold,
    ZenKakuGothicNew_400Regular,
    ZenKakuGothicNew_500Medium,
    ZenKakuGothicNew_700Bold,
  });

  useEffect(() => {
    void loadAll();
    void entitlement.load();
    void prefs.load();
    void credits.load();
  }, []);

  useEffect(() => {
    if (fontsLoaded) void SplashScreen.hideAsync();
  }, [fontsLoaded]);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <Navigator />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
