import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { BuddySprite } from '../../components/BuddySprite';
import { useColors } from '../../components/ThemeProvider';
import { useCoins } from '../../lib/credits';
import { useCosmetics } from '../../lib/cosmetics';
import { levelInfo, nextStage, stageForLevel } from '../../lib/leveling';
import { BADGES, useProgress } from '../../lib/progress';
import { colors, fonts, radius, spacing, type } from '../../lib/theme';

type Item = { icon: ComponentProps<typeof Feather>['name']; label: string; desc: string; href: string };

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'キャリア資産',
    items: [
      { icon: 'trending-up', label: '成果・実績', desc: '数字で語れる実績', href: '/m/achievements' },
      { icon: 'layers', label: 'スキル', desc: '保有スキルとレベル', href: '/m/skills' },
      { icon: 'flag', label: '目標・キャリアプラン', desc: 'これから取りに行く経験', href: '/m/goals' },
      { icon: 'file-text', label: 'キャリア変換', desc: '職務経歴書・自己PR・面接…', href: '/career' },
    ],
  },
  {
    title: '自己理解',
    items: [
      { icon: 'award', label: '強み', desc: '強みと根拠', href: '/m/strengths' },
      { icon: 'target', label: '弱み・課題', desc: '伸びしろと向き合い方', href: '/m/weaknesses' },
      { icon: 'user', label: '自己分析', desc: 'Will/Can/Must・SWOT', href: '/m/self' },
      { icon: 'cpu', label: '働き方タイプ', desc: 'ログから性格・働き方を分析', href: '/workstyle' },
      { icon: 'compass', label: '価値観', desc: '大事にしたいこと', href: '/m/values' },
      { icon: 'activity', label: 'モチベーション曲線', desc: '時期ごとの浮き沈み', href: '/m/motivation' },
    ],
  },
  {
    title: 'ふり返り・成長',
    items: [
      { icon: 'bar-chart-2', label: 'ふり返り', desc: '週次・月次の自動まとめ', href: '/reflection' },
      { icon: 'book-open', label: '学習・資格', desc: '学んだこと・取った資格', href: '/m/learning' },
      { icon: 'message-circle', label: 'もらった言葉', desc: '感謝・フィードバック', href: '/m/kudos' },
      { icon: 'users', label: '1on1・面談メモ', desc: '準備と記録', href: '/m/oneonone' },
    ],
  },
];

function Ring({ progress, size = 96 }: { progress: number; size?: number }) {
  const c = useColors();
  const sw = 9;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(59,48,38,0.10)" strokeWidth={sw} fill="none" />
      <Circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={c.primary}
        strokeWidth={sw}
        fill="none"
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={circ * (1 - Math.max(0.02, progress))}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

export default function GrowthScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const prog = useProgress();
  const coins = useCoins();
  const cos = useCosmetics();
  const info = levelInfo(prog.xp);
  const stage = stageForLevel(info.level);
  const next = nextStage(info.level);
  const earned = new Set(prog.badges);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 110 }}>
      <View style={{ height: insets.top + spacing.md }} />
      {/* header */}
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={type.h1}>そだち</Text>
          <Text style={[type.muted, { marginTop: 2 }]}>記録が、相棒とキャリアを育てる</Text>
        </View>
        <Pressable onPress={() => router.push('/coins')} style={[styles.coinPill, { backgroundColor: c.primaryWeak }]}>
          <View style={styles.coin} />
          <Text style={styles.coinNum}>{coins}</Text>
        </Pressable>
      </View>

      {/* hero — buddy + level */}
      <View style={[styles.hero, { backgroundColor: c.primaryWeak }]}>
        <Pressable style={{ alignItems: 'center', width: 130 }} onPress={() => router.push('/closet')}>
          <BuddySprite stage={stage.art} size={116} outfit={cos.equipped} />
          <Text style={[type.muted, { color: c.primary, marginTop: -2 }]}>きせかえ →</Text>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center' }}>
            <Ring progress={info.progress} />
            <View style={styles.ringCenter}>
              <Text style={styles.lvNum}>Lv.{info.level}</Text>
              <Text style={styles.lvSub}>{info.atCap ? 'カンスト' : `あと${info.toNext}`}</Text>
            </View>
          </View>
          <Text style={styles.stageName}>{stage.name}</Text>
          <Text style={type.muted}>{next ? `次は「${next.name}」へ` : stage.tagline}</Text>
        </View>
      </View>

      {/* streak strip */}
      <View style={styles.streak}>
        <View style={[styles.flame, { backgroundColor: c.sparkWeak }]}>
          <Feather name="zap" size={16} color={colors.spark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={type.title}>{prog.streak}日連続</Text>
          <Text style={type.muted}>最高記録 {prog.bestStreak}日 ・ きょうも記録してつなげよう</Text>
        </View>
      </View>

      {/* quick actions */}
      <View style={styles.quick}>
        <Pressable style={[styles.quickCard, { backgroundColor: colors.leafWeak }]} onPress={() => router.push('/lang')}>
          <Feather name="globe" size={18} color={colors.leaf} />
          <View style={{ flex: 1 }}>
            <Text style={type.title}>語学で学ぶ</Text>
            <Text style={type.muted}>ログを英語・韓国語に</Text>
          </View>
        </Pressable>
        <Pressable style={[styles.quickCard, { backgroundColor: c.primaryWeak }]} onPress={() => router.push('/closet')}>
          <Feather name="gift" size={18} color={c.primary} />
          <View style={{ flex: 1 }}>
            <Text style={type.title}>きせかえ</Text>
            <Text style={type.muted}>相棒をカスタム</Text>
          </View>
        </Pressable>
      </View>

      {/* badges */}
      <Text style={[type.label, styles.secLabel]}>獲得した称号 {earned.size}/{BADGES.length}</Text>
      <View style={styles.badgeGrid}>
        {BADGES.map((b) => {
          const got = earned.has(b.id);
          return (
            <View key={b.id} style={styles.badge}>
              <View style={[styles.badgeIcon, { backgroundColor: got ? c.primary : colors.surface2 }]}>
                <Feather name={got ? 'star' : 'lock'} size={18} color={got ? '#fff' : colors.line2} />
              </View>
              <Text style={[styles.badgeLabel, { color: got ? colors.text : colors.muted }]} numberOfLines={1}>
                {got ? b.label : '???'}
              </Text>
            </View>
          );
        })}
      </View>

      {/* career / self modules */}
      <View style={{ height: spacing.md }} />
      {SECTIONS.map((sec) => (
        <View key={sec.title} style={styles.section}>
          <Text style={[type.label, { paddingHorizontal: spacing.lg, marginBottom: spacing.xs }]}>{sec.title}</Text>
          {sec.items.map((it) => (
            <Pressable key={it.label} onPress={() => router.push(it.href as never)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface2 }]}>
              <View style={[styles.icon, { backgroundColor: c.primaryWeak }]}>
                <Feather name={it.icon} size={18} color={c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={type.title}>{it.label}</Text>
                <Text style={[type.muted, { marginTop: 2 }]}>{it.desc}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.line2} />
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.md },
  coinPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: radius.pill },
  coin: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.gold },
  coinNum: { fontFamily: fonts.maru, fontSize: 14, color: colors.text },
  hero: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, borderRadius: radius.xl + 4, padding: spacing.md, gap: spacing.sm },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  lvNum: { fontFamily: fonts.maru, fontSize: 22, color: colors.text },
  lvSub: { fontFamily: fonts.gothic, fontSize: 10, color: colors.muted },
  stageName: { fontFamily: fonts.maru, fontSize: 17, color: colors.text, marginTop: spacing.sm },
  streak: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, marginTop: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: spacing.md },
  flame: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  quick: { flexDirection: 'row', gap: spacing.md, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  quickCard: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, padding: spacing.md },
  secLabel: { paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.sm },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg - 4, gap: 0 },
  badge: { width: '25%', alignItems: 'center', paddingVertical: spacing.sm },
  badgeIcon: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  badgeLabel: { fontFamily: fonts.gothicMed, fontSize: 10, marginTop: 6, textAlign: 'center' },
  section: { marginBottom: spacing.lg },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line,
  },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
