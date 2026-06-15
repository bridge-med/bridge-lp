import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlockHeader } from '../components/BlockHeader';
import { BuddySprite } from '../components/BuddySprite';
import { useColors } from '../components/ThemeProvider';
import { useCoins } from '../lib/credits';
import { CAT_LABEL, COSMETICS, cosmetics, useCosmetics, type CosmeticCat } from '../lib/cosmetics';
import { levelInfo, stageForLevel } from '../lib/leveling';
import { useProgress } from '../lib/progress';
import { colors, fonts, radius, spacing, type } from '../lib/theme';

const CATS: CosmeticCat[] = ['hat', 'pot', 'bg', 'acc'];

export default function ClosetScreen() {
  const c = useColors();
  const coins = useCoins();
  const cos = useCosmetics();
  const prog = useProgress();
  const [cat, setCat] = useState<CosmeticCat>('hat');
  const stage = stageForLevel(levelInfo(prog.xp).level);

  const items = COSMETICS.filter((i) => i.cat === cat);

  function onPick(id: string, price: number, owned: boolean) {
    if (owned) {
      void cosmetics.equip(id);
      return;
    }
    if (coins < price) {
      Alert.alert('コインが足りません', `この${CAT_LABEL[cat]}には ${price} コイン必要です。`);
      return;
    }
    Alert.alert('購入する', `${price} コインで手に入れますか？`, [
      { text: 'やめる', style: 'cancel' },
      {
        text: '購入する',
        onPress: async () => {
          const ok = await cosmetics.buy(id);
          if (!ok) Alert.alert('購入できませんでした', 'コインが足りないかもしれません。');
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xl }}>
      <BlockHeader
        wordmark="CLOSET"
        title="きせかえ"
        onBack
        pad={24}
        right={
          <View style={styles.coinPill}>
            <View style={styles.coin} />
            <Text style={styles.coinText}>{coins}</Text>
          </View>
        }
      />

      {/* big preview */}
      <View style={[styles.preview, { backgroundColor: c.primaryWeak }]}>
        <BuddySprite stage={stage.art} size={168} outfit={cos.equipped} />
      </View>

      {/* category chips */}
      <View style={styles.cats}>
        {CATS.map((k) => {
          const on = k === cat;
          return (
            <Pressable key={k} onPress={() => setCat(k)} style={[styles.catChip, on ? { backgroundColor: c.primary } : { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line }]}>
              <Text style={[styles.catText, { color: on ? '#fff' : colors.text2 }]}>{CAT_LABEL[k]}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* grid */}
      <View style={styles.grid}>
        {items.map((item) => {
          const owned = cos.owned.includes(item.id);
          const equipped = cos.equipped[item.cat] === item.id;
          return (
            <Pressable key={item.id} onPress={() => onPick(item.id, item.price, owned)} style={styles.cell}>
              <View style={[styles.tile, { borderColor: equipped ? c.primary : colors.line, borderWidth: equipped ? 2 : StyleSheet.hairlineWidth, backgroundColor: colors.surface }]}>
                <BuddySprite stage={stage.art} size={68} outfit={{ ...cos.equipped, [item.cat]: item.id }} />
                {equipped ? (
                  <View style={[styles.badge, { backgroundColor: c.primary }]}>
                    <Text style={styles.badgeText}>装着中</Text>
                  </View>
                ) : null}
              </View>
              <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
              {owned ? (
                <Text style={[styles.meta, { color: equipped ? c.primary : colors.muted }]}>{equipped ? '装着中' : '所持・タップで装着'}</Text>
              ) : (
                <View style={styles.priceRow}>
                  <View style={styles.coinSm} />
                  <Text style={styles.price}>{item.price}</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </View>

      <Text style={styles.note}>記録を続けて貯めたコインで、相棒をきせかえできます。節目のごほうびでもコインがもらえます。</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  coinPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,253,248,0.2)', borderRadius: radius.pill, paddingHorizontal: 12, height: 30 },
  coin: { width: 13, height: 13, borderRadius: 7, backgroundColor: colors.gold },
  coinText: { fontFamily: fonts.maru, fontSize: 13, color: colors.onAccent },
  preview: { alignItems: 'center', marginHorizontal: spacing.lg, marginTop: spacing.lg, borderRadius: radius.xl + 4, paddingVertical: spacing.md },
  cats: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  catChip: { paddingHorizontal: 16, height: 36, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  catText: { fontFamily: fonts.maru, fontSize: 13 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg - 2, marginTop: spacing.md },
  cell: { width: '33.33%', alignItems: 'center', padding: spacing.xs, paddingVertical: spacing.sm },
  tile: { width: '100%', alignItems: 'center', borderRadius: radius.lg, paddingVertical: spacing.sm },
  badge: { position: 'absolute', top: 6, right: 6, paddingHorizontal: 6, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontFamily: fonts.gothicBold, fontSize: 8, color: '#fff' },
  name: { fontFamily: fonts.maru, fontSize: 12, color: colors.text, marginTop: 6 },
  meta: { fontFamily: fonts.gothic, fontSize: 10, marginTop: 1 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  coinSm: { width: 11, height: 11, borderRadius: 6, backgroundColor: colors.gold },
  price: { fontFamily: fonts.maru, fontSize: 12, color: colors.text },
  note: { fontFamily: fonts.gothic, fontSize: 12, color: colors.muted, lineHeight: 18, paddingHorizontal: spacing.lg, marginTop: spacing.lg },
});
