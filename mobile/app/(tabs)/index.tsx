import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { type ComponentProps, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BannerSlot } from '../../components/BannerSlot';
import { QuickMemoSheet } from '../../components/QuickMemoSheet';
import { useColors } from '../../components/ThemeProvider';
import { Card, Chip, EmptyState } from '../../components/ui';
import { quickMemos, tasks, workLogs } from '../../lib/data';
import { formatDateJa, startOfWeekKey, todayKey } from '../../lib/date';
import { usePrefs } from '../../lib/prefs';
import { useCollection } from '../../lib/store';
import { colors, radius, spacing, type } from '../../lib/theme';
import type { WorkLog } from '../../lib/types';

export default function HomeScreen() {
  const c = useColors();
  const logs = useCollection(workLogs);
  const allTasks = useCollection(tasks);
  useCollection(quickMemos); // keep counts fresh
  const { profession } = usePrefs();
  const [memoOpen, setMemoOpen] = useState(false);

  const weekStart = startOfWeekKey();
  const openTasks = allTasks.filter((t) => t.status !== 'done').length;
  const weekLogs = logs.filter((l) => l.date >= weekStart).length;
  const recent = useMemo(
    () => [...logs].sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : b.createdAt < a.createdAt ? -1 : 1)).slice(0, 5),
    [logs],
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110, gap: spacing.md }}>
        <View style={{ gap: 2 }}>
          <Text style={type.muted}>{formatDateJa(todayKey())}</Text>
          <Text style={styles.h1}>今日のことを残そう</Text>
          {profession ? <Text style={type.muted}>{profession}としての記録が積み上がります</Text> : null}
        </View>

        <View style={styles.actionRow}>
          <Action label="今日の一言" sub="クイックメモ" icon="edit-3" color={c.primary} onPress={() => setMemoOpen(true)} />
          <Action label="仕事ログ" sub="今日の記録" icon="plus" color={c.primary} onPress={() => router.push('/log-edit')} />
        </View>

        <View style={styles.statRow}>
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/tasks')}>
            <Card style={styles.statCard}>
              <Text style={[styles.statValue, { color: openTasks ? c.primary : colors.muted }]}>{openTasks}</Text>
              <Text style={type.muted}>未完了タスク</Text>
            </Card>
          </Pressable>
          <Pressable style={{ flex: 1 }} onPress={() => router.push('/timeline')}>
            <Card style={styles.statCard}>
              <Text style={[styles.statValue, { color: c.primary }]}>{weekLogs}</Text>
              <Text style={type.muted}>今週のログ</Text>
            </Card>
          </Pressable>
        </View>

        <Pressable onPress={() => router.push('/reflection')}>
          <Card style={[styles.reflectCard, { backgroundColor: c.primaryWeak, borderColor: c.primaryWeak }]}>
            <Feather name="bar-chart-2" size={22} color={c.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { fontWeight: '700', color: c.primary }]}>今週の振り返りをつくる</Text>
              <Text style={type.muted}>1週間のログから自動でまとめ</Text>
            </View>
            <Text style={[styles.arrow, { color: c.primary }]}>›</Text>
          </Card>
        </Pressable>

        <View style={{ gap: spacing.sm }}>
          <Text style={type.label}>最近の仕事ログ</Text>
          {recent.length === 0 ? (
            <EmptyState icon="📝" title="まだ仕事ログがありません" hint="「仕事ログ」から、今日やったことを少しだけ残してみましょう。" />
          ) : (
            recent.map((l) => <LogRow key={l.id} log={l} onPress={() => router.push(`/log/${l.id}`)} />)
          )}
        </View>

        <BannerSlot />
      </ScrollView>

      <QuickMemoSheet visible={memoOpen} onClose={() => setMemoOpen(false)} />
    </View>
  );
}

function Action({
  label,
  sub,
  icon,
  color,
  onPress,
}: {
  label: string;
  sub: string;
  icon: ComponentProps<typeof Feather>['name'];
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={{ flex: 1 }} onPress={onPress}>
      <Card style={styles.actionCard}>
        <View style={[styles.actionIcon, { backgroundColor: color }]}>
          <Feather name={icon} size={20} color="#fff" />
        </View>
        <Text style={[type.body, { fontWeight: '700' }]}>{label}</Text>
        <Text style={type.muted}>{sub}</Text>
      </Card>
    </Pressable>
  );
}

function LogRow({ log, onPress }: { log: WorkLog; onPress: () => void }) {
  return (
    <Pressable onPress={onPress}>
      <Card style={{ gap: spacing.xs }}>
        <View style={styles.logHead}>
          <Text style={[type.body, { fontWeight: '700', flex: 1 }]} numberOfLines={1}>
            {log.title || '無題のログ'}
          </Text>
          <Text style={type.muted}>{formatDateJa(log.date)}</Text>
        </View>
        {log.did ? (
          <Text style={[type.muted]} numberOfLines={2}>
            {log.did}
          </Text>
        ) : null}
        {log.tags.length > 0 ? (
          <View style={styles.tags}>
            {log.tags.slice(0, 4).map((t) => (
              <Chip key={t} label={t} tone="neutral" />
            ))}
          </View>
        ) : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  h1: { fontSize: 24, fontWeight: '800', color: colors.text },
  actionRow: { flexDirection: 'row', gap: spacing.md },
  actionCard: { gap: 4, alignItems: 'flex-start' },
  actionIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  actionIconText: { color: '#fff', fontSize: 22, fontWeight: '700' },
  statRow: { flexDirection: 'row', gap: spacing.md },
  statCard: { alignItems: 'center', gap: 2, paddingVertical: spacing.lg },
  statValue: { fontSize: 28, fontWeight: '800' },
  reflectCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  arrow: { fontSize: 22, fontWeight: '800' },
  logHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tags: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: 2 },
});
