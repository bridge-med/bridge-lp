// Page hero for card-based screens: small label + Mincho title, on paper.

import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing, type } from '../lib/theme';

export function Hero({ label, title, subtitle }: { label: string; title: string; subtitle?: string }) {
  return (
    <View style={styles.wrap}>
      <Text style={type.label}>{label}</Text>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={[type.muted, { marginTop: 4 }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.lg, paddingTop: 56, paddingBottom: spacing.lg },
  title: { fontFamily: fonts.mincho, fontSize: 34, color: colors.text, lineHeight: 42, marginTop: 4 },
});
