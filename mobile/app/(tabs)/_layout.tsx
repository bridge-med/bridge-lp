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
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: c.surface },
        headerTitleStyle: { color: c.text, fontWeight: '700', fontSize: 18 },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'ホーム', tabBarIcon: icon('home') }} />
      <Tabs.Screen name="timeline" options={{ title: 'タイムライン', tabBarIcon: icon('clock') }} />
      <Tabs.Screen name="tasks" options={{ title: 'タスク', tabBarIcon: icon('check-square') }} />
      <Tabs.Screen name="reflection" options={{ title: '振り返り', tabBarIcon: icon('bar-chart-2') }} />
      <Tabs.Screen name="settings" options={{ title: '設定', tabBarIcon: icon('settings') }} />
    </Tabs>
  );
}
