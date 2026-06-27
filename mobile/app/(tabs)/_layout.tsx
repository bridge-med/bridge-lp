import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '../../components/ThemeProvider';

type FeatherName = ComponentProps<typeof Feather>['name'];

function icon(name: FeatherName) {
  return ({ color }: { color: ColorValue }) => <Feather name={name} size={21} color={color as string} />;
}

export default function TabsLayout() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        // Add the bottom safe-area (home indicator) so labels aren't clipped.
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line, height: 58 + insets.bottom, paddingTop: 6, paddingBottom: insets.bottom },
        tabBarLabelStyle: { fontSize: 10.5, fontFamily: 'ZenKakuGothicNew_500Medium' },
        headerShown: false,
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'ホーム', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="timeline" options={{ title: '記録', tabBarIcon: icon('clock') }} />
      <Tabs.Screen name="tasks" options={{ title: 'タスク', tabBarIcon: icon('check-square') }} />
      <Tabs.Screen name="hub" options={{ title: 'そだち', tabBarIcon: icon('sun') }} />
      <Tabs.Screen name="settings" options={{ title: '設定', tabBarIcon: icon('settings') }} />
      <Tabs.Screen name="reflection" options={{ href: null }} />
    </Tabs>
  );
}
