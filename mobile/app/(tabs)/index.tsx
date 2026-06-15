import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BuddySprite } from '../../components/BuddySprite';
import { QuickMemoSheet } from '../../components/QuickMemoSheet';
import { useColors } from '../../components/ThemeProvider';
import { useCoins } from '../../lib/credits';
import { useCosmetics } from '../../lib/cosmetics';
import { quickMemos, tasks, workLogs } from '../../lib/data';
import { parseKey, startOfWeekKey, todayKey } from '../../lib/date';
import { levelInfo, nextStage, stageForLevel } from '../../lib/leveling';
import { usePrefs } from '../../lib/prefs';
import { useProgress } from '../../lib/progress';
import { useCollection } from '../../lib/store';
import { colors, fonts, radius, shadow, spacing, type } from '../../lib/theme';
import type { WorkLog } from '../../lib/types';

const WD = ['日', '月', '火', '水', '木', '金', '土'];
const WEEK = ['月', '火', '水', '木', '金', '土', '日'];

export default function HomeScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const logs = useCollection(workLogs);
  const allTasks = useCollection(tasks);
  useCollection(quickMemos);
  const coins = useCoins();
  const prog = useProgress();
  const cos = useCosmetics();
  const { profession, buddyName } = usePrefs();
  const [memoOpen, setMemoOpen] = useState(false);

  const d = parseKey(todayKey());
  const weekStart = startOfWeekKey();
  const info = levelInfo(prog.xp);
  const stage = stageForLevel(info.level);
  const next = nextStage(info.level);

  const openTasks = allTasks.filter((t) => t.status !== 'done').length;
  const weekLogDates = useMemo(() => new Set(logs.filter((l) => l.date >= weekStart).map((l) => l.date)), [logs, weekStart]);
  const recent = useMemo(
    () => [...logs].sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : b.createdAt < a.createdAt ? -1 : 1)).slice(0, 3),
    [logs],
  );

  // week dots Mon..Sun
  const ws = parseKey(weekStart);
  const today = todayKey();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        {/* warm header */}
        <View style={[styles.header, { backgroundColor: c.primaryWeak, paddingTop: insets.top + spacing.lg }]}>
          <View style={styles.headTop}>
            <Text style={styles.wordmark}>BRIDGE WORKLOG</Text>
            <Pressable onPress={() => router.push('/coins')} style={styles.coinPill}>
              <View style={styles.coin} />
              <Text style={styles.coinText}>{coins}</Text>
            </Pressable>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.greeting}>おかえりなさい</Text>
              <Text style={styles.subtle}>
                {d.getMonth() + 1}月{d.getDate()}日 {WD[d.getDay()]}曜 — {profession ? `${profession}のきょう` : 'きょうもおつかれさま'}
              </Text>
            </View>
            <Pressable style={styles.buddyWrap} onPress={() => router.push('/closet')}>
              <BuddySprite stage={stage.art} size={92} outfit={cos.equipped} />
            </Pressable>
          </View>
          {/* speech bubble */}
          <Pressable onPress={() => router.push('/hub')} style={styles.bubble}>
            <Text style={[styles.bubbleTitle, { color: colors.leaf }]}>
              {next ? `あと少しで「${next.name}」` : `Lv.${info.level} ${stage.name}`}
            </Text>
            <Text style={styles.bubbleSub}>ログを書くと、{buddyName || '相棒'}が育つよ</Text>
          </Pressable>
        </View>

        <View style={styles.body}>
          {/* streak */}
          <View style={styles.streak}>
            <View style={[styles.flame, { backgroundColor: c.sparkWeak }]}>
              <Feather name="zap" size={16} color={colors.spark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={type.title}>{prog.streak}日連続</Text>
              <Text style={type.muted}>いい流れ。きょうでつなげよう</Text>
            </View>
            <View style={styles.dots}>
              {WEEK.map((lbl, i) => {
                const dk = todayKey(new Date(ws.getFullYear(), ws.getMonth(), ws.getDate() + i));
                const done = weekLogDates.has(dk);
                const isToday = dk === today;
                return (
                  <View key={i} style={{ alignItems: 'center', gap: 3 }}>
                    <View style={[styles.dot, done ? { backgroundColor: c.primary, borderColor: c.primary } : { borderColor: isToday ? c.primary : colors.line2 }]}>
                      {done ? <Feather name="check" size={9} color="#fff" /> : null}
                    </View>
                    <Text style={styles.dotLbl}>{lbl}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* BIG CTA */}
          <Pressable onPress={() => router.push('/log-edit')} style={({ pressed }) => [styles.cta, { backgroundColor: c.primary }, pressed && { opacity: 0.92 }]}>
            <View style={styles.ctaIcon}>
              <Feather name="plus" size={26} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaTitle}>きょうのログを書く</Text>
              <Text style={styles.ctaSub}>出来事・判断・学びを、ひとつだけでも</Text>
            </View>
            <Feather name="arrow-right" size={22} color="#fff" />
          </Pressable>

          {/* quick tiles */}
          <View style={styles.tileRow}>
            <Tile icon="edit-2" label="さっとメモ" tint={colors.leaf} bg={colors.leafWeak} onPress={() => setMemoOpen(true)} />
            <Tile icon="refresh-ccw" label="ふりかえり" tint={c.primary} bg={c.primaryWeak} onPress={() => router.push('/reflection')} />
          </View>

          {/* mini stats */}
          <View style={styles.stats}>
            <Pressable style={styles.stat} onPress={() => router.push('/tasks')}>
              <Text style={styles.statNum}>{openTasks}</Text>
              <Text style={type.muted}>未完了タスク</Text>
            </Pressable>
            <View style={styles.statDiv} />
            <Pressable style={styles.stat} onPress={() => router.push('/hub')}>
              <Text style={[styles.statNum, { color: c.primary }]}>Lv.{info.level}</Text>
              <Text style={type.muted}>{stage.name}</Text>
            </Pressable>
          </View>

          {/* recent */}
          <View style={styles.recentHead}>
            <Text style={type.title}>最近のログ</Text>
            <Pressable onPress={() => router.push('/timeline')}>
              <Text style={[type.muted, { color: c.primary }]}>すべて →</Text>
            </Pressable>
          </View>
          {recent.length === 0 ? (
            <Text style={[type.muted, { paddingVertical: spacing.md }]}>
              まだ仕事ログがありません。上の「きょうのログを書く」から、今日を少しだけ。
            </Text>
          ) : (
            recent.map((l) => <LogCard key={l.id} log={l} onPress={() => router.push(`/log/${l.id}`)} />)
          )}
        </View>
      </ScrollView>

      <QuickMemoSheet visible={memoOpen} onClose={() => setMemoOpen(false)} />
    </View>
  );
}

function Tile({ icon, label, tint, bg, onPress }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; tint: string; bg: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, { backgroundColor: bg }, pressed && { opacity: 0.7 }]}>
      <View style={styles.tileIcon}>
        <Feather name={icon} size={15} color={tint} />
      </View>
      <Text style={type.title}>{label}</Text>
    </Pressable>
  );
}

function LogCard({ log, onPress }: { log: WorkLog; onPress: () => void }) {
  const c = useColors();
  const dd = parseKey(log.date);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.logCard, pressed && { opacity: 0.7 }]}>
      <View style={[styles.logEdge, { backgroundColor: c.primary }]} />
      <View style={{ flex: 1 }}>
        <Text style={type.title} numberOfLines={1}>{log.title || '無題のログ'}</Text>
        {log.tags.length > 0 ? (
          <Text style={[type.muted, { marginTop: 2 }]} numberOfLines={1}>{log.tags.join(' ・ ')}</Text>
        ) : null}
      </View>
      <Text style={styles.logDate}>{`${dd.getMonth() + 1}.${dd.getDate()}`}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg, borderBottomLeftRadius: radius.xl + 4, borderBottomRightRadius: radius.xl + 4 },
  headTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  wordmark: { fontFamily: fonts.gothicBold, fontSize: 11, letterSpacing: 2, color: colors.primary },
  coinPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 12, height: 32 },
  coin: { width: 14, height: 14, borderRadius: 7, backgroundColor: colors.gold },
  coinText: { fontFamily: fonts.maru, fontSize: 14, color: colors.text },
  greeting: { fontFamily: fonts.maru, fontSize: 25, color: colors.text },
  subtle: { fontFamily: fonts.gothic, fontSize: 12.5, color: colors.text2, marginTop: 4 },
  buddyWrap: { width: 96, marginTop: -8, marginRight: -8 },
  bubble: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.md, marginTop: spacing.sm },
  bubbleTitle: { fontFamily: fonts.maru, fontSize: 14 },
  bubbleSub: { fontFamily: fonts.gothic, fontSize: 11.5, color: colors.muted, marginTop: 2 },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  streak: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: spacing.md },
  flame: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', gap: 7 },
  dot: { width: 17, height: 17, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  dotLbl: { fontFamily: fonts.gothic, fontSize: 8, color: colors.muted },
  cta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.xl, padding: spacing.lg, marginTop: spacing.md, ...shadow.card },
  ctaIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  ctaTitle: { fontFamily: fonts.maru, fontSize: 19, color: '#fff' },
  ctaSub: { fontFamily: fonts.gothic, fontSize: 12, color: 'rgba(255,255,255,0.92)', marginTop: 3 },
  tileRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.md },
  tile: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.lg, paddingVertical: 16, paddingHorizontal: spacing.md },
  tileIcon: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, marginTop: spacing.md, paddingVertical: spacing.md },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDiv: { width: StyleSheet.hairlineWidth, height: 34, backgroundColor: colors.line },
  statNum: { fontFamily: fonts.maruBlack, fontSize: 30, color: colors.text },
  recentHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.sm },
  logCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: spacing.md, marginBottom: spacing.sm, overflow: 'hidden' },
  logEdge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  logDate: { fontFamily: fonts.maruMed, fontSize: 16, color: colors.muted },
});
