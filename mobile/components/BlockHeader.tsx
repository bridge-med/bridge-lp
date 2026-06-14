// "Bold Block" header — a deep accent colour field with Mincho display type.
// Use across screens. `onBack` shows a back chevron (for pushed screens);
// overlap it with a card below via marginTop:-26.

import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, spacing } from '../lib/theme';
import { useColors } from './ThemeProvider';

export function BlockHeader({
  wordmark,
  title,
  subtitle,
  right,
  onBack,
  pad = 44,
}: {
  wordmark?: string;
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onBack?: boolean;
  pad?: number;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.block, { backgroundColor: c.primary, paddingTop: insets.top + (onBack ? spacing.sm : spacing.lg), paddingBottom: pad }]}>
      {onBack ? (
        <Pressable onPress={() => router.back()} hitSlop={12} style={styles.back}>
          <Feather name="chevron-left" size={24} color={colors.onAccent} />
        </Pressable>
      ) : null}
      {right ? <View style={styles.right}>{right}</View> : null}
      {wordmark ? <Text style={styles.wordmark}>{wordmark}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.sub}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  block: { paddingHorizontal: spacing.lg },
  back: { marginBottom: spacing.xs, marginLeft: -6, alignSelf: 'flex-start' },
  right: { position: 'absolute', right: spacing.lg, top: 0, height: '100%', justifyContent: 'center' },
  wordmark: { fontFamily: fonts.gothicBold, fontSize: 11, letterSpacing: 3, color: 'rgba(245,242,234,0.62)', marginBottom: 8 },
  title: { fontFamily: fonts.mincho, fontSize: 46, color: colors.onAccent, lineHeight: 52 },
  sub: { fontFamily: fonts.gothicMed, fontSize: 14, color: 'rgba(245,242,234,0.85)', marginTop: 8 },
});
