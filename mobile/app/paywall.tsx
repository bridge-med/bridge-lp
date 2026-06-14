import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdFreeBenefits } from '../components/ProFeatures';
import { useColors } from '../components/ThemeProvider';
import { Button } from '../components/ui';
import { ADFREE, purchaseAdFree, restorePurchases, useAdFree } from '../lib/entitlement';
import { colors, fonts, radius, spacing, type } from '../lib/theme';

export default function Paywall() {
  const adFree = useAdFree();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  async function buy() {
    setBusy(true);
    try {
      await purchaseAdFree();
      Alert.alert('ありがとうございます！', '広告を非表示にしました。', [{ text: 'OK', onPress: () => router.back() }]);
    } catch {
      Alert.alert('購入できませんでした', 'もう一度お試しください。');
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    const ok = await restorePurchases();
    Alert.alert(ok ? '復元しました' : '購入が見つかりません', ok ? '広告は表示されません。' : '対象の購入履歴がありませんでした。');
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
        <View style={styles.hero}>
          <Text style={styles.badge}>BRIDGE WORKLOG</Text>
          <Text style={styles.heroTitle}>広告を消す</Text>
          <Text style={[type.body, { color: colors.text2, textAlign: 'center' }]}>
            機能はすべて無料のまま。{'\n'}広告だけをオフにできます。
          </Text>
        </View>

        <View style={styles.card}>
          <AdFreeBenefits />
        </View>

        {adFree ? (
          <View style={[styles.card, styles.ownedCard]}>
            <Text style={styles.ownedText}>✓ 広告は表示されません</Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{ADFREE.priceLabel}</Text>
              <Text style={type.muted}>買い切り・サブスクなし</Text>
            </View>
            <Button label={busy ? '処理中…' : '広告を消す'} onPress={buy} disabled={busy} />
            <Pressable onPress={restore} hitSlop={8} style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
              <Text style={[styles.link, { color: c.primary }]}>購入を復元</Text>
            </Pressable>
          </View>
        )}

        <Text style={[type.muted, { textAlign: 'center' }]}>
          購入はApp Store / Google Playアカウントに請求されます。買い切り（1回のみ）で、自動更新はありません。
        </Text>
      </ScrollView>

      <Pressable onPress={() => router.back()} style={[styles.close, { top: insets.top + spacing.sm }]} hitSlop={12}>
        <Text style={styles.closeText}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  hero: { alignItems: 'center', gap: spacing.sm, paddingTop: spacing.xl },
  badge: { ...type.label, letterSpacing: 3 },
  heroTitle: { fontFamily: fonts.mincho, fontSize: 38, color: colors.text, lineHeight: 46 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.lg,
  },
  ownedCard: { backgroundColor: colors.accentWeak, borderColor: colors.accentWeak, alignItems: 'center' },
  ownedText: { ...type.h2, color: colors.good },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: spacing.sm },
  price: { fontFamily: fonts.minchoSemi, fontSize: 32, color: colors.text },
  link: { fontSize: 15, fontFamily: fonts.gothicMed },
  close: {
    position: 'absolute',
    right: spacing.lg,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  closeText: { color: colors.text2, fontSize: 16, fontWeight: '600' },
});
