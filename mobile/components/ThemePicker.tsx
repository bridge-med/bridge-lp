import { Pressable, StyleSheet, Text, View } from 'react-native';
import { prefs, usePrefs } from '../lib/prefs';
import { ACCENTS, type AccentKey, spacing, type } from '../lib/theme';

const KEYS = Object.keys(ACCENTS) as AccentKey[];

export function ThemePicker() {
  const { accent } = usePrefs();

  return (
    <View style={styles.row}>
      {KEYS.map((key) => {
        const a = ACCENTS[key];
        const selected = accent === key;
        return (
          <Pressable key={key} onPress={() => void prefs.set({ accent: key })} style={styles.item}>
            <View style={[styles.swatch, { backgroundColor: a.primary }, selected && styles.swatchSelected]}>
              {selected ? <Text style={styles.check}>✓</Text> : null}
            </View>
            <Text style={[type.muted, selected && { color: a.primary, fontWeight: '700' }]}>{a.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  item: { alignItems: 'center', gap: spacing.xs },
  swatch: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  swatchSelected: { borderColor: '#14293d' },
  check: { color: '#fff', fontWeight: '800', fontSize: 16 },
});
