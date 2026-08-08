import { Stack, useLocalSearchParams } from 'expo-router';
import { Text, View } from 'react-native';
import { ModuleScreen } from '../../components/ModuleScreen';
import { moduleByKey } from '../../lib/modules';
import { colors, type } from '../../lib/theme';

export default function ModuleRoute() {
  const { key } = useLocalSearchParams<{ key: string }>();
  const cfg = moduleByKey(String(key));
  if (!cfg) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24 }}>
        <Stack.Screen options={{ title: '—' }} />
        <Text style={type.muted}>見つかりませんでした。</Text>
      </View>
    );
  }
  return <ModuleScreen config={cfg} />;
}
