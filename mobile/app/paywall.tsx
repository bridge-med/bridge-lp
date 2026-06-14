import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProFeatureList } from '../components/ProFeatures';
import { Button } from '../components/ui';
import { PRO, purchasePro, restorePurchases, usePro } from '../lib/entitlement';
import { colors, radius, spacing, type } from '../lib/theme';

export default function Paywall() {
  const isPro = usePro();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState(false);

  async function buy() {
    setBusy(true);
    try {
      await purchasePro();
      Alert.alert('Proを解放しました', 'すべての機能が使えるようになりました。ありがとうございます！', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch {
      Alert.alert('購入できませんでした', 'もう一度お試しください。');
    } finally {
      setBusy(false);
    }
  }

  async function restore() {
    const ok = await restorePurchases();
    Alert.alert(ok ? '復元しました' : '購入が見つかりません', ok ? 'Proが有効です。' : '対象の購入履歴がありませんでした。');
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.lg }}>
        <View style={styles.hero}>
          <Text style={styles.badge}>BRIDGE Daily</Text>
          <Text style={styles.heroTitle}>Pro</Text>
          <Text style={[type.body, { color: colors.text2, textAlign: 'center' }]}>
            一度の購入で、ずっと使える。{'\n'}記録を続ける力をひとまとめに。
          </Text>
        </View>

        <View style={styles.card}>
          <ProFeatureList />
        </View>

        {isPro ? (
          <View style={[styles.card, styles.ownedCard]}>
            <Text style={styles.ownedText}>✓ Pro を利用中です</Text>
          </View>
        ) : (
          <View style={{ gap: spacing.sm }}>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{PRO.priceLabel}</Text>
              <Text style={type.muted}>買い切り・サブスクなし</Text>
            </View>
            <Button label={busy ? '処理中…' : 'Pro を購入する'} onPress={buy} disabled={busy} />
            <Pressable onPress={restore} hitSlop={8} style={{ alignItems: 'center', paddingVertical: spacing.sm }}>
              <Text style={styles.link}>購入を復元</Text>
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
  hero: { alignItems: 'center', gap: spacing.xs, paddingTop: spacing.xl },
  badge: { ...type.label, color: colors.primary, letterSpacing: 1 },
  heroTitle: { fontSize: 44, fontWeight: '800', color: colors.text, lineHeight: 48 },
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
  price: { fontSize: 30, fontWeight: '800', color: colors.text },
  link: { color: colors.primary, fontSize: 15, fontWeight: '600' },
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
