import { Feather } from '@expo/vector-icons';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlockHeader } from '../components/BlockHeader';
import { useColors } from '../components/ThemeProvider';
import { Button, Card } from '../components/ui';
import { COIN_PACKS, GEN_COST, credits, useCoins } from '../lib/credits';
import { iapEnabled, purchasePack, restorePurchases } from '../lib/iap';
import { colors, fonts, radius, spacing, type } from '../lib/theme';

export default function CoinsScreen() {
  const c = useColors();
  const coins = useCoins();

  function buy(id: string, coinsToAdd: number, price: string) {
    if (iapEnabled()) {
      void (async () => {
        try {
          const ok = await purchasePack(id);
          if (ok) await credits.add(coinsToAdd);
        } catch (e) {
          Alert.alert('購入に失敗しました', e instanceof Error ? e.message : '時間をおいて再度お試しください。');
        }
      })();
      return;
    }
    // Demo path (web preview / before IAP is wired).
    Alert.alert('コインを購入（デモ）', `${coinsToAdd}コイン（${price}）を購入しますか？`, [
      { text: 'キャンセル', style: 'cancel' },
      { text: '購入（デモ）', onPress: () => void credits.add(coinsToAdd) },
    ]);
  }

  function restore() {
    void (async () => {
      try {
        await restorePurchases();
        Alert.alert('購入を復元しました', '反映されない場合は時間をおいて再度お試しください。');
      } catch {
        Alert.alert('復元に失敗しました', '時間をおいて再度お試しください。');
      }
    })();
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xl }}>
      <BlockHeader wordmark="COIN" title="コイン" onBack pad={24} />
      <View style={{ padding: spacing.lg }}>
      <View style={styles.balance}>
        <Feather name="circle" size={20} color={c.primary} />
        <Text style={styles.balanceNum}>{coins}</Text>
        <Text style={type.muted}>コイン</Text>
      </View>
      <Text style={[type.muted, { textAlign: 'center', marginBottom: spacing.xl }]}>
        AIでの生成は内容により {GEN_COST}〜2コイン（タスク化・メモ整理=1／ふり返り・キャリア変換・分析=2）。記録を続けるとボーナスでも貯まります。
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
              <Button label="購入" onPress={() => buy(p.id, p.coins, p.price)} />
            </View>
          </Card>
        ))}
      </View>

      <View style={styles.note}>
        <Text style={type.label}>登録特典</Text>
        <Text style={[type.body, { marginTop: spacing.sm }]}>
          はじめての方には無料コインをお渡ししています。まずは気になる機能を試してみてください。
        </Text>
      </View>

      {iapEnabled() ? (
        <Button label="購入を復元" variant="ghost" onPress={restore} />
      ) : null}

      <Text style={[type.muted, { marginTop: spacing.xl, fontSize: 11 }]}>
        {iapEnabled() ? '※ アプリ内課金（消費型）で購入します。価格は地域により異なります。' : '※ プレビューではデモ購入です。製品版ではアプリ内課金に接続します。'}
      </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  balance: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', gap: spacing.sm, paddingTop: spacing.lg },
  balanceNum: { fontFamily: fonts.maruBlack, fontSize: 56, color: colors.text, lineHeight: 60 },
  pack: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  packCoins: { fontFamily: fonts.maru, fontSize: 28, color: colors.text },
  badge: { fontFamily: fonts.gothicBold, fontSize: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  price: { fontFamily: fonts.maru, fontSize: 20, color: colors.text },
  note: { marginTop: spacing.xl, padding: spacing.lg, borderRadius: radius.md, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
});
