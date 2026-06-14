import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BannerSlot } from '../../components/BannerSlot';
import { BlockHeader } from '../../components/BlockHeader';
import { QuickMemoSheet } from '../../components/QuickMemoSheet';
import { useColors } from '../../components/ThemeProvider';
import { useCoins } from '../../lib/credits';
import { quickMemos, tasks, workLogs } from '../../lib/data';
import { parseKey, startOfWeekKey, todayKey } from '../../lib/date';
import { usePrefs } from '../../lib/prefs';
import { useCollection } from '../../lib/store';
import { colors, fonts, radius, shadow, spacing, type } from '../../lib/theme';
import type { WorkLog } from '../../lib/types';

const WD = ['日', '月', '火', '水', '木', '金', '土'];

export default function HomeScreen() {
  const c = useColors();
  const logs = useCollection(workLogs);
  const allTasks = useCollection(tasks);
  useCollection(quickMemos);
  const coins = useCoins();
  const { profession } = usePrefs();
  const [memoOpen, setMemoOpen] = useState(false);

  const d = parseKey(todayKey());
  const weekStart = startOfWeekKey();
  const openTasks = allTasks.filter((t) => t.status !== 'done').length;
  const weekLogs = logs.filter((l) => l.date >= weekStart).length;
  const recent = useMemo(
    () => [...logs].sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : b.createdAt < a.createdAt ? -1 : 1)).slice(0, 4),
    [logs],
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }} showsVerticalScrollIndicator={false}>
        <BlockHeader
          wordmark="BRIDGE WORKLOG"
          title={`${d.getMonth() + 1}.${d.getDate()}`}
          subtitle={`${WD[d.getDay()]}曜日 — ${profession ? `${profession}のきょう` : 'きょうを記録する'}`}
          right={
            <Pressable onPress={() => router.push('/coins')} style={styles.coinPill}>
              <Feather name="circle" size={13} color={colors.onAccent} />
              <Text style={styles.coinText}>{coins}</Text>
            </Pressable>
          }
        />

        {/* overlapping primary action */}
        <Pressable onPress={() => router.push('/log-edit')} style={styles.cardWrap}>
          <View style={styles.actionCard}>
            <View style={[styles.actionIcon, { backgroundColor: colors.spark }]}>
              <Feather name="edit-3" size={22} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={type.h2}>仕事ログを書く</Text>
              <Text style={[type.muted, { marginTop: 2 }]}>今日の出来事・判断・学び</Text>
            </View>
            <Feather name="arrow-right" size={20} color={c.primary} />
          </View>
        </Pressable>

        <View style={styles.body}>
          {/* two quick tiles */}
          <View style={styles.tileRow}>
            <Tile icon="feather" label="クイックメモ" onPress={() => setMemoOpen(true)} />
            <Tile icon="bar-chart-2" label="今週をふりかえる" onPress={() => router.push('/reflection')} />
          </View>

          {/* stats */}
          <View style={styles.stats}>
            <Pressable style={styles.stat} onPress={() => router.push('/tasks')}>
              <Text style={[styles.statNum, { color: colors.text }]}>{openTasks}</Text>
              <Text style={type.muted}>未完了</Text>
            </Pressable>
            <Pressable style={styles.stat} onPress={() => router.push('/timeline')}>
              <Text style={[styles.statNum, { color: colors.spark }]}>{weekLogs}</Text>
              <Text style={type.muted}>今週ログ</Text>
            </Pressable>
            <Pressable style={styles.stat} onPress={() => router.push('/hub')}>
              <Text style={[styles.statNum, { color: colors.text }]}>{recent.length ? '›' : '＋'}</Text>
              <Text style={type.muted}>キャリア</Text>
            </Pressable>
          </View>

          <View style={styles.rule} />

          <Text style={[type.label, { marginBottom: spacing.xs }]}>最近のログ</Text>
          {recent.length === 0 ? (
            <Text style={[type.muted, { paddingVertical: spacing.md }]}>
              まだ仕事ログがありません。上の「仕事ログを書く」から、今日を少しだけ。
            </Text>
          ) : (
            recent.map((l) => <LogRow key={l.id} log={l} onPress={() => router.push(`/log/${l.id}`)} />)
          )}

          <View style={{ marginTop: spacing.lg }}>
            <BannerSlot />
          </View>
        </View>
      </ScrollView>

      <QuickMemoSheet visible={memoOpen} onClose={() => setMemoOpen(false)} />
    </View>
  );
}

function Tile({ icon, label, onPress }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; onPress: () => void }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && { opacity: 0.6 }]}>
      <Feather name={icon} size={16} color={c.primary} />
      <Text style={type.bodyMed}>{label}</Text>
    </Pressable>
  );
}

function LogRow({ log, onPress }: { log: WorkLog; onPress: () => void }) {
  const dd = parseKey(log.date);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.logRow, pressed && { opacity: 0.6 }]}>
      <View style={{ flex: 1 }}>
        <Text style={type.title} numberOfLines={1}>
          {log.title || '無題のログ'}
        </Text>
        {log.tags.length > 0 ? (
          <Text style={[type.muted, { marginTop: 2 }]} numberOfLines={1}>
            {log.tags.join(' ・ ')}
          </Text>
        ) : null}
      </View>
      <Text style={styles.logDate}>{`${dd.getMonth() + 1}.${dd.getDate()}`}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  coinPill: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(245,242,234,0.16)', borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  coinText: { fontFamily: fonts.gothicBold, fontSize: 13, color: colors.onAccent },
  cardWrap: { marginTop: -26, paddingHorizontal: spacing.lg },
  actionCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    backgroundColor: colors.surface, borderRadius: radius.lg, padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, ...shadow.card, shadowOpacity: 0.1, elevation: 3,
  },
  actionIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  tileRow: { flexDirection: 'row', gap: spacing.md },
  tile: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line2, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: spacing.md,
  },
  stats: { flexDirection: 'row', marginTop: spacing.xl },
  stat: { flex: 1, gap: 2 },
  statNum: { fontFamily: fonts.mincho, fontSize: 40, lineHeight: 46 },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginVertical: spacing.lg },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  logDate: { fontFamily: fonts.minchoReg, fontSize: 16, color: colors.muted },
});
