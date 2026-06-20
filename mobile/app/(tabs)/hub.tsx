import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { type ComponentProps, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { BuddySprite } from '../../components/BuddySprite';
import { Sheet } from '../../components/Sheet';
import { useColors } from '../../components/ThemeProvider';
import { Button, Field } from '../../components/ui';
import { useCoins } from '../../lib/credits';
import { useCosmetics } from '../../lib/cosmetics';
import { levelInfo, nextStage, stageForLevel } from '../../lib/leveling';
import { prefs, usePrefs } from '../../lib/prefs';
import { BADGES, useProgress } from '../../lib/progress';
import { colors, fonts, radius, spacing, type } from '../../lib/theme';

type Item = { icon: ComponentProps<typeof Feather>['name']; label: string; desc: string; href: string };

// キャリアに変える — このアプリのキラー機能。
const CAREER: Item[] = [
  { icon: 'trending-up', label: '成果・実績', desc: '数字で語れる実績をまとめる', href: '/m/achievements' },
  { icon: 'layers', label: 'スキル', desc: '保有スキルとレベルを整理', href: '/m/skills' },
  { icon: 'award', label: '強み', desc: 'あなたの強みと根拠を見つける', href: '/m/strengths' },
  { icon: 'user', label: '自己分析', desc: 'Will/Can/Must・SWOT', href: '/m/self' },
  { icon: 'flag', label: '目標・キャリアプラン', desc: 'これから取りに行く経験', href: '/m/goals' },
];

// 自己理解・ふり返り（補助）
const MORE: Item[] = [
  { icon: 'bar-chart-2', label: 'ふり返り', desc: '週次・月次の自動まとめ', href: '/reflection' },
  { icon: 'cpu', label: '働き方タイプ', desc: 'ログから性格・働き方を分析', href: '/workstyle' },
  { icon: 'target', label: '弱み・課題', desc: '伸びしろと向き合い方', href: '/m/weaknesses' },
  { icon: 'compass', label: '価値観', desc: '大事にしたいこと', href: '/m/values' },
  { icon: 'activity', label: 'モチベーション曲線', desc: '時期ごとの浮き沈み', href: '/m/motivation' },
  { icon: 'book-open', label: '学習・資格', desc: '学んだこと・取った資格', href: '/m/learning' },
  { icon: 'message-circle', label: 'もらった言葉', desc: '感謝・フィードバック', href: '/m/kudos' },
  { icon: 'users', label: '1on1・面談メモ', desc: '準備と記録', href: '/m/oneonone' },
];

function Ring({ progress, size = 96 }: { progress: number; size?: number }) {
  const c = useColors();
  const sw = 9;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <Svg width={size} height={size}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(59,48,38,0.10)" strokeWidth={sw} fill="none" />
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.primary} strokeWidth={sw} fill="none" strokeLinecap="round"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - Math.max(0.02, progress))} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </Svg>
  );
}

export default function GrowthScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const prog = useProgress();
  const coins = useCoins();
  const cos = useCosmetics();
  const { buddyName } = usePrefs();
  const [nameOpen, setNameOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const info = levelInfo(prog.xp);
  const stage = stageForLevel(info.level);
  const next = nextStage(info.level);
  const earned = new Set(prog.badges);
  const buddy = buddyName || '相棒';
  const buddyLine = prog.streak >= 3
    ? `${prog.streak}日連続！小さな積み上げ、ちゃんと残ってるよ`
    : `いいペースだね！今日の記録が未来のあなたの力になるよ`;

  function openName() { setNameDraft(buddyName); setNameOpen(true); }
  function saveName() { void prefs.set({ buddyName: nameDraft.trim().slice(0, 12) }); setNameOpen(false); }

  return (
    <>
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 100 }}>
      <View style={{ height: insets.top + spacing.md }} />
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={type.h1}>そだち</Text>
          <Text style={[type.muted, { marginTop: 2, color: colors.text2 }]}>記録が、相棒とキャリアを育てる</Text>
        </View>
        <Pressable onPress={() => router.push('/coins')} style={[styles.coinPill, { backgroundColor: c.primaryWeak }]}>
          <View style={styles.coin} />
          <Text style={styles.coinNum}>{coins}</Text>
        </Pressable>
      </View>

      {/* ===== 1. 相棒の成長 ===== */}
      <Text style={styles.blockLabel}>相棒の成長</Text>
      <View style={[styles.hero, { backgroundColor: c.primaryWeak }]}>
        <Pressable style={{ alignItems: 'center', width: 124 }} onPress={() => router.push('/closet')}>
          <BuddySprite stage={stage.art} size={110} outfit={cos.equipped} />
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
          <Pressable onPress={openName} style={{ alignItems: 'center', marginTop: spacing.sm }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={styles.stageName}>{buddyName || '名前をつける'}</Text>
              <Feather name="edit-2" size={12} color={colors.muted} />
            </View>
            <Text style={[type.muted, { color: colors.text2 }]}>{`${stage.name}${next ? `（次は${next.name}）` : ''}`}</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.statStrip}>
        <View style={styles.statCell}><Feather name="star" size={14} color={c.primary} /><Text style={styles.statTxt}>{prog.xp} XP</Text></View>
        <View style={styles.statCell}><Feather name="zap" size={14} color={colors.spark} /><Text style={styles.statTxt}>連続 {prog.streak}日</Text></View>
        <View style={styles.statCell}><View style={styles.coinSm} /><Text style={styles.statTxt}>{coins} 枚</Text></View>
      </View>
      <View style={[styles.bubble, { backgroundColor: c.accentWeak }]}>
        <Text style={styles.bubbleText}>{buddy}：{buddyLine}</Text>
      </View>

      <View style={styles.badgeRow}>
        <Text style={[type.label, { color: colors.text2 }]}>称号 {earned.size}/{BADGES.length}</Text>
      </View>
      <View style={styles.badgeGrid}>
        {BADGES.map((b) => {
          const got = earned.has(b.id);
          return (
            <View key={b.id} style={styles.badge}>
              <View style={[styles.badgeIcon, { backgroundColor: got ? c.primary : colors.surface2 }]}>
                <Feather name={got ? 'star' : 'lock'} size={16} color={got ? '#fff' : colors.line2} />
              </View>
              <Text style={[styles.badgeLabel, { color: got ? colors.text : colors.muted }]} numberOfLines={1}>{got ? b.label : '???'}</Text>
            </View>
          );
        })}
      </View>

      {/* ===== 2. 今日の小さな成長 ===== */}
      <Text style={styles.blockLabel}>今日の小さな成長</Text>
      <Text style={styles.blockHint}>仕事ログとつながる“ながら学習”。3分から。</Text>
      <View style={styles.learnRow}>
        <LearnCard icon="award" label="英語" sub="3分から" tint={colors.leaf} bg={colors.leafWeak} onPress={() => router.push('/vocab')} />
        <LearnCard icon="award" label="韓国語" sub="3分から" tint={c.primary} bg={c.primaryWeak} onPress={() => router.push('/vocab-ko')} />
        <LearnCard icon="book-open" label="単語帳" sub="ログから自動" tint={colors.gold} bg={colors.warnWeak} onPress={() => router.push('/words')} />
        <LearnCard icon="gift" label="きせかえ" sub="相棒を飾る" tint={c.primary} bg={c.primaryWeak} onPress={() => router.push('/closet')} />
      </View>
      <Pressable onPress={() => router.push('/lang')} style={styles.langLink}>
        <Feather name="globe" size={15} color={c.primary} />
        <Text style={[type.bodyMed, { color: c.primary }]}>書いた仕事ログを、英語・韓国語のカードにする →</Text>
      </Pressable>

      {/* ===== 3. キャリアに変える ===== */}
      <Text style={styles.blockLabel}>キャリアに変える</Text>
      <Pressable onPress={() => router.push('/career')} style={({ pressed }) => [styles.careerHero, { backgroundColor: c.primary }, pressed && { opacity: 0.92 }]}>
        <View style={styles.careerIcon}><Feather name="file-text" size={24} color="#fff" /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.careerTitle}>キャリア変換</Text>
          <Text style={styles.careerSub}>ログを、職務経歴書・自己PR・面接回答へ</Text>
        </View>
        <Feather name="arrow-right" size={22} color="#fff" />
      </Pressable>
      <View style={styles.modCard}>
        {CAREER.map((it, i) => <ModRow key={it.label} it={it} first={i === 0} c={c} />)}
      </View>

      <Text style={[styles.blockLabel, { fontSize: 13, color: colors.text2 }]}>自己理解・ふり返り</Text>
      <View style={styles.modCard}>
        {MORE.map((it, i) => <ModRow key={it.label} it={it} first={i === 0} c={c} />)}
      </View>
    </ScrollView>

    <Sheet visible={nameOpen} title="相棒の名前" onClose={() => setNameOpen(false)}>
      <Text style={[type.muted, { color: colors.text2 }]}>あなたの相棒に名前をつけましょう（12文字まで）。</Text>
      <Field placeholder="例）もりもり、ブリッジくん…" value={nameDraft} onChangeText={setNameDraft} autoFocus />
      <Button label="決定" onPress={saveName} disabled={!nameDraft.trim()} />
    </Sheet>
    </>
  );
}

function LearnCard({ icon, label, sub, tint, bg, onPress }: { icon: ComponentProps<typeof Feather>['name']; label: string; sub: string; tint: string; bg: string; onPress: () => void }) {
  return (
    <Pressable style={[styles.learnCard, { backgroundColor: bg }]} onPress={onPress}>
      <Feather name={icon} size={19} color={tint} />
      <Text style={styles.learnLabel}>{label}</Text>
      <Text style={styles.learnSub} numberOfLines={1}>{sub}</Text>
    </Pressable>
  );
}

function ModRow({ it, first, c }: { it: Item; first: boolean; c: ReturnType<typeof useColors> }) {
  return (
    <Pressable onPress={() => router.push(it.href as never)} style={({ pressed }) => [styles.row, !first && styles.rowBorder, pressed && { backgroundColor: colors.surface2 }]}>
      <View style={[styles.icon, { backgroundColor: c.primaryWeak }]}>
        <Feather name={it.icon} size={18} color={c.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={type.title}>{it.label}</Text>
        <Text style={[type.muted, { marginTop: 2, color: colors.text2 }]}>{it.desc}</Text>
      </View>
      <Feather name="chevron-right" size={20} color={colors.line2} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  head: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.lg, marginBottom: spacing.sm },
  coinPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, height: 32, borderRadius: radius.pill },
  coin: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.gold },
  coinNum: { fontFamily: fonts.maru, fontSize: 14, color: colors.text },
  blockLabel: { fontFamily: fonts.maru, fontSize: 17, color: colors.text, paddingHorizontal: spacing.lg, marginTop: spacing.xl, marginBottom: spacing.sm },
  blockHint: { fontFamily: fonts.gothic, fontSize: 12, color: colors.text2, paddingHorizontal: spacing.lg, marginTop: -4, marginBottom: spacing.sm },
  hero: { flexDirection: 'row', alignItems: 'center', marginHorizontal: spacing.lg, borderRadius: radius.xl + 4, padding: spacing.md, gap: spacing.sm },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  lvNum: { fontFamily: fonts.maru, fontSize: 22, color: colors.text },
  lvSub: { fontFamily: fonts.gothic, fontSize: 10, color: colors.text2 },
  stageName: { fontFamily: fonts.maru, fontSize: 17, color: colors.text, marginTop: spacing.sm },
  statStrip: { flexDirection: 'row', marginHorizontal: spacing.lg, marginTop: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, paddingVertical: spacing.sm },
  statCell: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  statTxt: { fontFamily: fonts.maruMed, fontSize: 13, color: colors.text },
  coinSm: { width: 13, height: 13, borderRadius: 7, backgroundColor: colors.gold },
  bubble: { marginHorizontal: spacing.lg, marginTop: spacing.sm, borderRadius: radius.md, paddingHorizontal: spacing.md, paddingVertical: 10 },
  bubbleText: { fontFamily: fonts.gothicMed, fontSize: 12.5, color: colors.text2, lineHeight: 18 },
  badgeRow: { paddingHorizontal: spacing.lg, marginTop: spacing.lg },
  badgeGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: spacing.lg - 4, marginTop: spacing.xs },
  badge: { width: '25%', alignItems: 'center', paddingVertical: spacing.sm },
  badgeIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  badgeLabel: { fontFamily: fonts.gothicMed, fontSize: 10, marginTop: 6, textAlign: 'center' },
  learnRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.lg },
  learnCard: { width: '47%', flexGrow: 1, alignItems: 'flex-start', gap: 4, borderRadius: radius.lg, padding: spacing.md },
  learnLabel: { fontFamily: fonts.maru, fontSize: 15, color: colors.text, marginTop: 2 },
  learnSub: { fontFamily: fonts.gothic, fontSize: 11, color: colors.text2 },
  langLink: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing.lg, marginTop: spacing.md },
  careerHero: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginHorizontal: spacing.lg, borderRadius: radius.xl, padding: spacing.lg },
  careerIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  careerTitle: { fontFamily: fonts.maruBlack, fontSize: 18, color: '#fff' },
  careerSub: { fontFamily: fonts.gothicMed, fontSize: 12, color: 'rgba(255,255,255,0.95)', marginTop: 3 },
  modCard: { marginHorizontal: spacing.lg, marginTop: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md, paddingVertical: 13 },
  rowBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
