// The signature layout primitive: a left "gutter" (dates / index numerals) and
// a content column whose left border forms one continuous vertical rule down the
// page. Horizontal hairlines separate entries — an editorial ledger.

import { Pressable, StyleSheet, View } from 'react-native';
import { colors } from '../lib/theme';

export function Ledger({
  gutter,
  children,
  onPress,
  divider = true,
  last = false,
}: {
  gutter?: React.ReactNode;
  children: React.ReactNode;
  onPress?: () => void;
  divider?: boolean;
  last?: boolean;
}) {
  const inner = (
    <View style={styles.row}>
      <View style={styles.gutter}>{gutter}</View>
      <View style={[styles.content, divider && !last && styles.divider]}>{children}</View>
    </View>
  );
  if (!onPress) return inner;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.55 }}>
      {inner}
    </Pressable>
  );
}

const GUTTER = 76;

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  gutter: { width: GUTTER, alignItems: 'flex-end', paddingRight: 14, paddingTop: 20 },
  content: {
    flex: 1,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.line,
    paddingLeft: 18,
    paddingRight: 24,
    paddingVertical: 18,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
