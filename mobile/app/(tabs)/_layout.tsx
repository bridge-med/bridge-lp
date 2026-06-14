import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { useColors } from '../../components/ThemeProvider';

function TabIcon({ icon, color }: { icon: string; color: ColorValue }) {
  return <Text style={{ fontSize: 20, color }}>{icon}</Text>;
}

export default function TabsLayout() {
  const c = useColors();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.muted,
        tabBarStyle: { backgroundColor: c.surface, borderTopColor: c.line },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: c.surface },
        headerTitleStyle: { color: c.text, fontWeight: '700', fontSize: 18 },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: c.bg },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'ホーム', tabBarIcon: ({ color }) => <TabIcon icon="🏠" color={color} /> }} />
      <Tabs.Screen name="timeline" options={{ title: 'タイムライン', tabBarIcon: ({ color }) => <TabIcon icon="🕘" color={color} /> }} />
      <Tabs.Screen name="tasks" options={{ title: 'タスク', tabBarIcon: ({ color }) => <TabIcon icon="✓" color={color} /> }} />
      <Tabs.Screen name="reflection" options={{ title: '振り返り', tabBarIcon: ({ color }) => <TabIcon icon="📊" color={color} /> }} />
      <Tabs.Screen name="settings" options={{ title: '設定', tabBarIcon: ({ color }) => <TabIcon icon="⚙" color={color} /> }} />
    </Tabs>
  );
}
