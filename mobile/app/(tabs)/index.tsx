import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BuddySprite } from '../../components/BuddySprite';
import { QuickMemoSheet } from '../../components/QuickMemoSheet';
import { TaskSheet } from '../../components/TaskSheet';
import { useColors } from '../../components/ThemeProvider';
import { useCoins } from '../../lib/credits';
import { useCosmetics } from '../../lib/cosmetics';
import { quickMemos, tasks, workLogs } from '../../lib/data';
import { dueLabel, parseKey, startOfWeekKey, todayKey } from '../../lib/date';
import { tapLight, tapSuccess } from '../../lib/haptics';
import { levelInfo, stageForLevel } from '../../lib/leveling';
import { usePrefs } from '../../lib/prefs';
import { progress, useProgress } from '../../lib/progress';
import { useCollection } from '../../lib/store';
import { colors, fonts, radius, shadow, spacing, type } from '../../lib/theme';
import type { Task, WorkLog } from '../../lib/types';

const WD = ['日', '月', '火', '水', '木', '金', '土'];

export default function HomeScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const logs = useCollection(workLogs);
  const allTasks = useCollection(tasks);
  useCollection(quickMemos);
  const coins = useCoins();
  const prog = useProgress();
  const cos = useCosmetics();
  const { userName, buddyName } = usePrefs();
  const [memoOpen, setMemoOpen] = useState(false);
  const [taskOpen, setTaskOpen] = useState(false);

  const d = parseKey(todayKey());
  const today = todayKey();
  const weekStart = startOfWeekKey();
  const info = levelInfo(prog.xp);
  const stage = stageForLevel(info.level);

  const openTasks = allTasks.filter((t) => t.status !== 'done').length;
  const weekLogs = useMemo(() => logs.filter((l) => l.date >= weekStart).length, [logs, weekStart]);
  const weekTasksDone = useMemo(
    () => allTasks.filter((t) => t.status === 'done' && t.doneAt && t.doneAt.slice(0, 10) >= weekStart).length,
    [allTasks, weekStart],
  );
  const loggedToday = useMemo(() => logs.some((l) => l.date === today), [logs, today]);
  const dueTasks = useMemo(
    () => allTasks.filter((t) => t.status !== 'done' && t.dueDate && t.dueDate <= today).sort((a, b) => (a.dueDate! < b.dueDate! ? -1 : 1)).slice(0, 4),
    [allTasks, today],
  );

  function completeTask(t: Task) {
    tapSuccess();
    void progress.recordActivity('task');
    void tasks.upsert({ id: t.id, status: 'done', doneAt: new Date().toISOString() } as Partial<Task>);
  }
  const recent = useMemo(
    () => [...logs].sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : b.createdAt < a.createdAt ? -1 : 1)).slice(0, 3),
    [logs],
  );

  const buddy = buddyName || '相棒';
  const buddyLine = loggedToday
    ? `ちゃんと積み上がったね。未来の材料がひとつ増えたよ`
    : prog.streak > 0
      ? `今日は“やったこと”だけでも残そう`
      : `今日の記録が未来のあなたの力になるよ`;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
        {/* greeting header */}
        <View style={[styles.header, { backgroundColor: c.primaryWeak, paddingTop: insets.top + spacing.lg }]}>
          <View style={styles.headTop}>
            <Text style={styles.wordmark}>キャリアログ</Text>
            <Pressable onPress={() => router.push('/coins')} style={styles.coinPill}>
              <View style={styles.coin} />
              <Text style={styles.coinText}>{coins}</Text>
            </Pressable>
          </View>
          <Text style={styles.greeting}>おかえりなさい{userName ? `、${userName}さん` : ''}！</Text>
          <Text style={styles.subtle}>
            {d.getMonth() + 1}月{d.getDate()}日 {WD[d.getDay()]}曜 — 今日も一歩ずつ、いっしょに
          </Text>
        </View>

        <View style={styles.body}>
          {/* buddy card */}
          <Pressable onPress={() => router.push('/hub')} style={styles.buddyCard}>
            <BuddySprite stage={stage.art} size={84} outfit={cos.equipped} />
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                <Text style={styles.lv}>Lv.{info.level}</Text>
                <Text style={type.muted}>{info.atCap ? 'カンスト' : `あと${info.toNext} XPでレベルアップ`}</Text>
              </View>
              <View style={styles.buddyMeta}>
                <View style={styles.metaItem}>
                  <Feather name="zap" size={13} color={colors.spark} />
                  <Text style={styles.metaText}>連続 {prog.streak}日</Text>
                </View>
                <View style={styles.metaItem}>
                  <View style={styles.coinSm} />
                  <Text style={styles.metaText}>{coins}</Text>
                </View>
              </View>
              <View style={[styles.bubble, { backgroundColor: c.accentWeak }]}>
                <Text style={styles.bubbleText} numberOfLines={2}>{buddy}：{buddyLine}</Text>
              </View>
            </View>
          </Pressable>

          {/* BIG CTA */}
          <Pressable onPress={() => { tapLight(); router.push('/log-edit'); }} style={({ pressed }) => [styles.cta, { backgroundColor: c.primary }, pressed && { opacity: 0.92, transform: [{ scale: 0.99 }] }]}>
            <View style={styles.ctaIcon}>
              <Feather name="edit-3" size={24} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.ctaTitle}>今日の仕事ログを書く</Text>
              <Text style={styles.ctaSub}>3分でOK。あとで職務経歴書・面接・1on1の材料になります</Text>
            </View>
            <Feather name="arrow-right" size={22} color="#fff" />
          </Pressable>

          {/* quick tiles (3) */}
          <View style={styles.tileRow}>
            <Tile icon="edit-2" label="さっとメモ" sub="1行で残す" tint={colors.leaf} bg={colors.leafWeak} onPress={() => setMemoOpen(true)} />
            <Tile icon="check-square" label="タスク追加" sub="次にやること" tint={c.primary} bg={c.primaryWeak} onPress={() => setTaskOpen(true)} />
            <Tile icon="refresh-ccw" label="ふりかえり" sub="学びをまとめ" tint={colors.gold} bg={colors.warnWeak} onPress={() => router.push('/reflection')} />
          </View>

          {/* weekly tally (4) */}
          <Text style={[type.label, { marginTop: spacing.lg, marginBottom: spacing.sm }]}>今週の積み上げ</Text>
          <View style={styles.tally}>
            <Tally num={weekLogs} label="ログ" />
            <View style={styles.tDiv} />
            <Tally num={weekTasksDone} label="タスク" />
            <View style={styles.tDiv} />
            <Tally num={prog.xp} label="XP" tint={c.primary} />
            <View style={styles.tDiv} />
            <Tally num={coins} label="コイン" tint={colors.gold} />
          </View>

          {/* today's tasks */}
          {dueTasks.length > 0 ? (
            <>
              <View style={styles.recentHead}>
                <Text style={type.title}>今日のタスク</Text>
                <Pressable onPress={() => router.push('/tasks')} hitSlop={8}>
                  <Text style={[type.muted, { color: c.primary }]}>すべて →</Text>
                </Pressable>
              </View>
              <View style={styles.todoCard}>
                {dueTasks.map((t, i) => {
                  const due = dueLabel(t.dueDate);
                  const overdue = due?.tone === 'overdue';
                  return (
                    <View key={t.id} style={[styles.todoRow, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line }]}>
                      <Pressable onPress={() => completeTask(t)} hitSlop={8} style={[styles.todoCheck, { borderColor: c.line2 }]} />
                      <Pressable style={{ flex: 1 }} onPress={() => router.push('/tasks')}>
                        <Text style={type.bodyMed} numberOfLines={1}>{t.title}</Text>
                      </Pressable>
                      {due ? <Text style={[styles.todoDue, { color: overdue ? c.danger : c.primary }]}>{due.text}</Text> : null}
                    </View>
                  );
                })}
              </View>
            </>
          ) : null}

          {/* recent */}
          <View style={styles.recentHead}>
            <Text style={type.title}>最近のログ</Text>
            <Pressable onPress={() => router.push('/timeline')} hitSlop={8}>
              <Text style={[type.muted, { color: c.primary }]}>すべて →</Text>
            </Pressable>
          </View>
          {recent.length === 0 ? (
            <Text style={[type.muted, { paddingVertical: spacing.md, color: colors.text2 }]}>
              まだ仕事ログがありません。上の「今日の仕事ログを書く」から、今日を少しだけ。
            </Text>
          ) : (
            recent.map((l) => <LogCard key={l.id} log={l} onPress={() => router.push(`/log/${l.id}`)} />)
          )}
        </View>
      </ScrollView>

      <QuickMemoSheet visible={memoOpen} onClose={() => setMemoOpen(false)} />
      <TaskSheet visible={taskOpen} onClose={() => setTaskOpen(false)} />
    </View>
  );
}

function Tile({ icon, label, sub, tint, bg, onPress }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; sub: string; tint: string; bg: string; onPress: () => void }) {
  return (
    <Pressable onPress={() => { tapLight(); onPress(); }} style={({ pressed }) => [styles.tile, { backgroundColor: bg }, pressed && { opacity: 0.85, transform: [{ scale: 0.97 }] }]}>
      <View style={styles.tileIcon}>
        <Feather name={icon} size={16} color={tint} />
      </View>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={styles.tileSub} numberOfLines={1}>{sub}</Text>
    </Pressable>
  );
}

function Tally({ num, label, tint }: { num: number; label: string; tint?: string }) {
  return (
    <View style={styles.tallyCell}>
      <Text style={[styles.tallyNum, tint ? { color: tint } : null]}>{num}</Text>
      <Text style={styles.tallyLbl}>{label}</Text>
    </View>
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
  greeting: { fontFamily: fonts.maruBlack, fontSize: 26, color: colors.text },
  subtle: { fontFamily: fonts.gothic, fontSize: 12.5, color: colors.text2, marginTop: 4 },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  buddyCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: spacing.md },
  lv: { fontFamily: fonts.maruBlack, fontSize: 22, color: colors.text },
  buddyMeta: { flexDirection: 'row', gap: spacing.md, marginTop: 4 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: fonts.maruMed, fontSize: 13, color: colors.text2 },
  coinSm: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.gold },
  bubble: { borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 7, marginTop: spacing.sm },
  bubbleText: { fontFamily: fonts.gothicMed, fontSize: 11.5, color: colors.text2, lineHeight: 16 },
  cta: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.xl, padding: spacing.lg, marginTop: spacing.md, ...shadow.card },
  ctaIcon: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  ctaTitle: { fontFamily: fonts.maruBlack, fontSize: 18, color: '#fff' },
  ctaSub: { fontFamily: fonts.gothicMed, fontSize: 11.5, color: 'rgba(255,255,255,0.95)', marginTop: 3, lineHeight: 16 },
  tileRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  tile: { flex: 1, borderRadius: radius.lg, paddingVertical: 14, paddingHorizontal: 10, gap: 4 },
  tileIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  tileLabel: { fontFamily: fonts.maru, fontSize: 13.5, color: colors.text, marginTop: 2 },
  tileSub: { fontFamily: fonts.gothic, fontSize: 10.5, color: colors.text2 },
  tally: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, paddingVertical: spacing.md },
  tallyCell: { flex: 1, alignItems: 'center', gap: 2 },
  tallyNum: { fontFamily: fonts.maruBlack, fontSize: 24, color: colors.text },
  tallyLbl: { fontFamily: fonts.gothic, fontSize: 11, color: colors.text2 },
  tDiv: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: colors.line },
  todoCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, paddingHorizontal: spacing.md },
  todoRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 13 },
  todoCheck: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5 },
  todoDue: { fontFamily: fonts.gothicMed, fontSize: 12 },
  recentHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.xl, marginBottom: spacing.sm },
  logCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: spacing.md, marginBottom: spacing.sm, overflow: 'hidden' },
  logEdge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  logDate: { fontFamily: fonts.maruMed, fontSize: 16, color: colors.muted },
});
