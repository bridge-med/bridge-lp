import { Feather } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../components/ThemeProvider';
import { Button, Card } from '../components/ui';
import { COIN_PACKS, GEN_COST, credits, useCoins } from '../lib/credits';
import { activeAiKey, usePrefs } from '../lib/prefs';
import { colors, fonts, radius, spacing, type } from '../lib/theme';

export default function CoinsScreen() {
  const c = useColors();
  const coins = useCoins();
  const prefs = usePrefs();
  const hasKey = !!activeAiKey(prefs);

  function buy(coinsToAdd: number, price: string) {
    // TODO: replace with consumable IAP (RevenueCat) + server-verified credit.
    Alert.alert('コインを購入', `${coinsToAdd}コイン（${price}）を購入しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '購入（デモ）', onPress: () => void credits.add(coinsToAdd) },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
      <Stack.Screen options={{ title: 'コイン' }} />

      <View style={styles.balance}>
        <Feather name="circle" size={20} color={c.primary} />
        <Text style={styles.balanceNum}>{coins}</Text>
        <Text style={type.muted}>コイン</Text>
      </View>
      <Text style={[type.muted, { textAlign: 'center', marginBottom: spacing.xl }]}>
        AIでの生成 1回につき {GEN_COST} コイン。キー登録は不要、買ったコインで使えます。
      </Text>

      <Text style={type.label}>コインを買う</Text>
      <View style={{ gap: spacing.md, marginTop: spacing.sm }}>
        {COIN_PACKS.map((p) => (
          <Card key={p.id} style={[styles.pack, p.best && { borderColor: c.primary, borderWidth: 1.2 }]}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                <Text style={styles.packCoins}>{p.coins}</Text>
                <Text style={type.muted}>コイン</Text>
                {p.best ? <Text style={[styles.badge, { color: c.primary, borderColor: c.primary }]}>おすすめ</Text> : null}
              </View>
              <Text style={type.muted}>{p.perGen}</Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 6 }}>
              <Text style={styles.price}>{p.price}</Text>
              <Button label="購入" onPress={() => buy(p.coins, p.price)} />
            </View>
          </Card>
        ))}
      </View>

      <View style={styles.note}>
        <Text style={type.label}>使い方は2通り</Text>
        <Text style={[type.body, { marginTop: spacing.sm }]}>
          ① コインで使う（かんたん・キー不要）{'\n'}② 自分のAPIキーを登録（無料・上級者向け）
        </Text>
        {hasKey ? (
          <Text style={[type.muted, { marginTop: spacing.sm, color: c.good }]}>✓ APIキー登録済み。AIは無料で使えます。</Text>
        ) : (
          <View style={{ marginTop: spacing.md }}>
            <Button label="自分のAPIキーを登録する" variant="ghost" onPress={() => router.push('/settings')} />
          </View>
        )}
      </View>

      <Text style={[type.muted, { marginTop: spacing.xl, fontSize: 11 }]}>
        ※ 現在はデモ購入です。リリース時はアプリ内課金（消費型）＋サーバ生成に接続します。
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  balance: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: spacing.sm, paddingTop: spacing.lg },
  balanceNum: { fontFamily: fonts.mincho, fontSize: 56, color: colors.text, lineHeight: 60 },
  pack: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  packCoins: { fontFamily: fonts.minchoSemi, fontSize: 28, color: colors.text },
  badge: { fontFamily: fonts.gothicBold, fontSize: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  price: { fontFamily: fonts.minchoSemi, fontSize: 20, color: colors.text },
  note: { marginTop: spacing.xl, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
});
