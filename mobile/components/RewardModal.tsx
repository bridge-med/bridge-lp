// Celebrates growth moments (level up, streak milestone, badge unlock) pushed
// onto the progress reward queue. Shows one at a time with a little confetti.

import { useEffect, useRef } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { stageForLevel, levelInfo } from '../lib/leveling';
import { progress, useProgress, useRewardHead } from '../lib/progress';
import { colors, fonts, radius, spacing, type } from '../lib/theme';
import { BuddySprite } from './BuddySprite';

const CONFETTI = [
  [44, 70, colors.spark], [96, 48, colors.primary], [150, 36, colors.leaf], [206, 52, colors.gold],
  [262, 78, colors.spark], [74, 120, colors.primary], [246, 132, colors.leaf], [30, 170, colors.gold],
  [280, 150, colors.primary], [128, 96, colors.spark], [190, 150, colors.gold], [60, 210, colors.leaf],
] as const;

export function RewardModal() {
  const reward = useRewardHead();
  const prog = useProgress();
  const pop = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reward) {
      pop.setValue(0);
      Animated.spring(pop, { toValue: 1, useNativeDriver: true, friction: 6, tension: 80 }).start();
    }
  }, [reward, pop]);

  if (!reward) return null;

  const level = reward.kind === 'levelup' ? reward.level : levelInfo(prog.xp).level;
  const stage = stageForLevel(level);

  let title = '';
  let sub = '';
  if (reward.kind === 'levelup') {
    title = reward.stageChanged ? `「${reward.stageName}」になった！` : `Lv.${reward.level} に上がった！`;
    sub = reward.stageChanged ? '相棒がひとつ成長したよ' : 'この調子で続けよう';
  } else if (reward.kind === 'streak') {
    title = `${reward.days}日連続、達成！`;
    sub = 'きょうも記録できました。えらい。';
  } else {
    title = `称号「${reward.label}」`;
    sub = '新しい称号を手に入れた！';
  }

  const scale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  return (
    <Modal visible transparent animationType="fade" onRequestClose={progress.dismissReward}>
      <Pressable style={styles.backdrop} onPress={progress.dismissReward}>
        {CONFETTI.map(([x, y, c], i) => (
          <View
            key={i}
            style={[
              { position: 'absolute', left: x, top: y, backgroundColor: c },
              i % 2 ? styles.confSquare : styles.confDot,
              i % 2 ? { transform: [{ rotate: `${i * 33}deg` }] } : null,
            ]}
          />
        ))}
        <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
          <View style={styles.sparkleRow}>
            <Text style={[styles.sparkle, { color: colors.gold }]}>✦</Text>
            <BuddySprite stage={stage.art} size={120} />
            <Text style={[styles.sparkle, { color: colors.primary }]}>✦</Text>
          </View>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>{sub}</Text>
          <View style={styles.chips}>
            {reward.kind !== 'badge' && reward.coins > 0 ? <Chip leaf={false} label={`+${reward.coins} コイン`} /> : null}
            {reward.kind === 'badge' && reward.coins > 0 ? <Chip leaf={false} label={`+${reward.coins} コイン`} /> : null}
            {reward.kind === 'levelup' && reward.stageChanged ? <Chip leaf label={`称号「${reward.stageName}」`} /> : null}
            {reward.kind === 'streak' ? <Chip leaf label={`Lv.${level} / ${stage.name}`} /> : null}
            {reward.kind === 'badge' ? <Chip leaf label="コレクション更新" /> : null}
          </View>
          <Pressable style={styles.btn} onPress={progress.dismissReward}>
            <Text style={styles.btnText}>やったね！</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

function Chip({ label, leaf }: { label: string; leaf: boolean }) {
  return (
    <View style={[styles.chip, { backgroundColor: leaf ? colors.leafWeak : colors.primaryWeak }]}>
      {!leaf ? <View style={styles.coin} /> : null}
      <Text style={[styles.chipText, { color: leaf ? colors.leaf : colors.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(59,48,38,0.45)', alignItems: 'center', justifyContent: 'center' },
  confDot: { width: 10, height: 10, borderRadius: 5 },
  confSquare: { width: 10, height: 10, borderRadius: 2 },
  card: { width: 300, backgroundColor: colors.surface, borderRadius: radius.xl + 6, padding: spacing.xl, alignItems: 'center' },
  sparkleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sparkle: { fontFamily: fonts.maru, fontSize: 18 },
  title: { ...type.h1, fontSize: 22, textAlign: 'center', marginTop: spacing.sm },
  sub: { ...type.muted, textAlign: 'center', marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm, marginTop: spacing.lg },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 36, borderRadius: radius.pill },
  chipText: { fontFamily: fonts.maru, fontSize: 13 },
  coin: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.gold },
  btn: { marginTop: spacing.xl, backgroundColor: colors.primary, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: 64 },
  btnText: { fontFamily: fonts.maru, fontSize: 16, color: '#fff' },
});
