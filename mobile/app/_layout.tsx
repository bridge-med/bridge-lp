import { ShipporiMincho_400Regular, ShipporiMincho_600SemiBold, ShipporiMincho_800ExtraBold } from '@expo-google-fonts/shippori-mincho';
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
import { Onboarding } from '../components/Onboarding';
import { RewardModal } from '../components/RewardModal';
import { ThemeProvider, useColors } from '../components/ThemeProvider';
import { credits } from '../lib/credits';
import { cosmetics } from '../lib/cosmetics';
import { loadAll } from '../lib/data';
import { configureIap } from '../lib/iap';
import { scheduleDaily } from '../lib/notifications';
import { prefs, usePrefs } from '../lib/prefs';
import { progress } from '../lib/progress';
import { wordbank } from '../lib/wordbank';
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
        <Stack.Screen name="career" options={{ headerShown: false }} />
        <Stack.Screen name="m/[key]" options={{ headerShown: false }} />
        <Stack.Screen name="coins" options={{ headerShown: false }} />
        <Stack.Screen name="workstyle" options={{ headerShown: false }} />
        <Stack.Screen name="closet" options={{ headerShown: false }} />
        <Stack.Screen name="lang" options={{ headerShown: false }} />
        <Stack.Screen name="words" options={{ headerShown: false }} />
      </Stack>
      <Onboarding visible={showOnboarding} />
      <RewardModal />
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
    ZenMaruGothic_400Regular,
    ZenMaruGothic_500Medium,
    ZenMaruGothic_700Bold,
    ZenMaruGothic_900Black,
    // Preload the icon font through the asset pipeline so it resolves under a
    // subpath deploy (e.g. GitHub Pages /bridge-lp/daily-app/) on web too.
    ...Feather.font,
  });

  useEffect(() => {
    void loadAll();
    void prefs.load().then(() => {
      const p = prefs.getSnapshot();
      if (p.reminderEnabled) void scheduleDaily(p.reminderHour, p.reminderMinute);
    });
    void credits.load();
    void progress.load();
    void cosmetics.load();
    void wordbank.load();
    configureIap();
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
