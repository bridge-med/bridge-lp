import { Feather } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';
import { useColors } from '../../components/ThemeProvider';

type FeatherName = ComponentProps<typeof Feather>['name'];

function icon(name: FeatherName) {
  return ({ color }: { color: ColorValue }) => <Feather name={name} size={21} color={color as string} />;
}

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line, height: 58, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 10.5, fontFamily: 'ZenKakuGothicNew_500Medium' },
        headerShown: false,
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Focus', tabBarIcon: icon('target') }} />
      <Tabs.Screen name="log" options={{ title: 'Log', tabBarIcon: icon('bar-chart-2') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: icon('settings') }} />
    </Tabs>
  );
}
