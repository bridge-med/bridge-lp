import { Tabs } from 'expo-router';
import { Text, type ColorValue } from 'react-native';
import { colors } from '../../lib/theme';

function TabIcon({ icon, color }: { icon: string; color: ColorValue }) {
  return <Text style={{ fontSize: 22, color }}>{icon}</Text>;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
        headerStyle: { backgroundColor: colors.surface },
        headerTitleStyle: { color: colors.text, fontWeight: '700', fontSize: 18 },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'タスク',
          headerTitle: 'タスク',
          tabBarIcon: ({ color }) => <TabIcon icon="✓" color={color} />,
        }}
      />
      <Tabs.Screen
        name="memo"
        options={{
          title: 'メモ',
          headerTitle: 'メモ',
          tabBarIcon: ({ color }) => <TabIcon icon="✎" color={color} />,
        }}
      />
      <Tabs.Screen
        name="journal"
        options={{
          title: '日記',
          headerTitle: '日記',
          tabBarIcon: ({ color }) => <TabIcon icon="❀" color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '設定',
          headerTitle: '設定',
          tabBarIcon: ({ color }) => <TabIcon icon="⚙" color={color} />,
        }}
      />
    </Tabs>
  );
}
