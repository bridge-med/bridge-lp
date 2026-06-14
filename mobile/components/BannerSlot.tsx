// Subtle banner ad slot. Shown on list screens only (never in the journal).
//
// Placeholder UI for now — at ship time, replace the inner content with a real
// AdMob banner (react-native-google-mobile-ads <BannerAd/>), which needs an
// EAS dev build + AdMob account. Hidden entirely once the user removes ads.

import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAdFree } from '../lib/entitlement';
import { radius, spacing, type } from '../lib/theme';
import { useColors } from './ThemeProvider';

export function BannerSlot() {
  const adFree = useAdFree();
  const c = useColors();
  if (adFree) return null;
  return (
    <View style={[styles.wrap, { borderColor: c.line }]}>
      <View>
        <Text style={styles.tag}>広告</Text>
        <Text style={type.muted}>ここにバナー広告が表示されます</Text>
      </View>
      <Pressable onPress={() => router.push('/paywall')} hitSlop={8}>
        <Text style={[styles.remove, { color: c.primary }]}>広告を消す</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    minHeight: 64,
  },
  tag: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: '#9aa7b4' },
  remove: { fontSize: 13, fontWeight: '700' },
});
