// "Bold Block" header — a deep accent colour field with Mincho display type,
// designed to be overlapped by a white card below (use marginTop: -24 on it).

import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, spacing } from '../lib/theme';
import { useColors } from './ThemeProvider';

export function BlockHeader({
  wordmark,
  title,
  subtitle,
  right,
  pad = 44,
}: {
  wordmark?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  pad?: number;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.block, { backgroundColor: c.primary, paddingTop: insets.top + spacing.lg, paddingBottom: pad }]}>
      {right ? <View style={styles.right}>{right}</View> : null}
      {wordmark ? <Text style={styles.wordmark}>{wordmark}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: spacing.lg },
  right: { position: 'absolute', right: spacing.lg, top: 0, height: '100%', justifyContent: 'center' },
  wordmark: { fontFamily: fonts.gothicBold, fontSize: 11, letterSpacing: 3, color: 'rgba(245,242,234,0.62)', marginBottom: 8 },
  title: { fontFamily: fonts.mincho, fontSize: 50, color: colors.onAccent, lineHeight: 56 },
  sub: { fontFamily: fonts.gothicMed, fontSize: 14, color: 'rgba(245,242,234,0.85)', marginTop: 8 },
});
