import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BannerSlot } from '../../components/BannerSlot';
import { Ledger } from '../../components/Ledger';
import { QuickMemoSheet } from '../../components/QuickMemoSheet';
import { useColors } from '../../components/ThemeProvider';
import { EmptyState } from '../../components/ui';
import { quickMemos, tasks, workLogs } from '../../lib/data';
import { parseKey, startOfWeekKey, todayKey } from '../../lib/date';
import { usePrefs } from '../../lib/prefs';
import { useCollection } from '../../lib/store';
import { colors, fonts, spacing, type } from '../../lib/theme';
import type { WorkLog } from '../../lib/types';

const WD = ['日', '月', '火', '水', '木', '金', '土'];

export default function HomeScreen() {
  const c = useColors();
  const logs = useCollection(workLogs);
  const allTasks = useCollection(tasks);
  useCollection(quickMemos);
  const { profession } = usePrefs();
  const [memoOpen, setMemoOpen] = useState(false);

  const today = todayKey();
  const d = parseKey(today);
  const weekStart = startOfWeekKey();
  const openTasks = allTasks.filter((t) => t.status !== 'done').length;
  const weekLogs = logs.filter((l) => l.date >= weekStart).length;
  const recent = useMemo(
    () => [...logs].sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : b.createdAt < a.createdAt ? -1 : 1)).slice(0, 4),
    [logs],
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingTop: 56, paddingBottom: 120 }}>
        <Ledger gutter={<Text style={[styles.weekday, { color: c.primary }]}>{WD[d.getDay()]}</Text>}>
          <Text style={styles.wordmark}>BRIDGE WORKLOG</Text>
          <Text style={styles.date}>
            {d.getMonth() + 1}月{d.getDate()}日
          </Text>
          <Text style={[type.muted, { marginTop: 4 }]}>
            {profession ? `${profession}として、きょうを書き留める` : 'きょうのことを、書き留める'}
          </Text>
        </Ledger>

        <ActionRow n="02" title="仕事ログを書く" desc="今日の出来事・判断・学びを残す" accent onPress={() => router.push('/log-edit')} c={c} />
        <ActionRow n="03" title="クイックメモ" desc="1行の気づきをすばやく" onPress={() => setMemoOpen(true)} c={c} />
        <ActionRow n="04" title="今週をふりかえる" desc={`${weekLogs}件のログからまとめる`} onPress={() => router.push('/reflection')} c={c} />

        <Ledger>
          <Text style={[type.label, { marginBottom: spacing.sm }]}>いま</Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: spacing.xl }}>
            <Pressable style={styles.stat} onPress={() => router.push('/tasks')}>
              <Text style={[styles.statNum, { color: openTasks ? c.primary : colors.muted }]}>{openTasks}</Text>
              <Text style={type.muted}>未完了</Text>
            </Pressable>
            <Pressable style={styles.stat} onPress={() => router.push('/timeline')}>
              <Text style={[styles.statNum, { color: colors.text }]}>{weekLogs}</Text>
              <Text style={type.muted}>今週ログ</Text>
            </Pressable>
          </View>
        </Ledger>

        <Ledger>
          <Text style={type.label}>最近のログ</Text>
        </Ledger>
        {recent.length === 0 ? (
          <Ledger>
            <EmptyState icon="file-text" title="まだ仕事ログがありません" hint="「仕事ログを書く」から、今日やったことを少しだけ残してみましょう。" />
          </Ledger>
        ) : (
          recent.map((l) => <LogRow key={l.id} log={l} c={c} onPress={() => router.push(`/log/${l.id}`)} />)
        )}

        <Ledger last>
          <BannerSlot />
        </Ledger>
      </ScrollView>

      <QuickMemoSheet visible={memoOpen} onClose={() => setMemoOpen(false)} />
    </View>
  );
}

function ActionRow({
  n,
  title,
  desc,
  accent,
  onPress,
  c,
}: {
  n: string;
  title: string;
  desc: string;
  accent?: boolean;
  onPress: () => void;
  c: ReturnType<typeof useColors>;
}) {
  return (
    <Ledger gutter={<Text style={styles.index}>{n}</Text>} onPress={onPress}>
      <View style={styles.actionRow}>
        <View style={{ flex: 1 }}>
          <Text style={type.title}>{title}</Text>
          <Text style={[type.muted, { marginTop: 3 }]}>{desc}</Text>
        </View>
        <Feather name="arrow-right" size={18} color={accent ? c.primary : colors.muted} />
      </View>
    </Ledger>
  );
}

function LogRow({ log, c, onPress }: { log: WorkLog; c: ReturnType<typeof useColors>; onPress: () => void }) {
  const dd = parseKey(log.date);
  return (
    <Ledger
      gutter={<Text style={[styles.logDate, { color: c.primary }]}>{`${dd.getMonth() + 1}.${dd.getDate()}`}</Text>}
      onPress={onPress}
    >
      <Text style={type.title} numberOfLines={1}>
        {log.title || '無題のログ'}
      </Text>
      {log.tags.length > 0 ? (
        <Text style={[type.muted, { marginTop: 3 }]} numberOfLines={1}>
          {log.tags.join(' ・ ')}
        </Text>
      ) : log.did ? (
        <Text style={[type.muted, { marginTop: 3 }]} numberOfLines={1}>
          {log.did}
        </Text>
      ) : null}
    </Ledger>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  wordmark: { ...type.label, letterSpacing: 3, marginBottom: 6 },
  weekday: { fontFamily: fonts.minchoSemi, fontSize: 28 },
  date: { fontFamily: fonts.mincho, fontSize: 44, color: colors.text, lineHeight: 50 },
  index: { fontFamily: fonts.minchoReg, fontSize: 14, color: colors.muted },
  actionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  stat: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  statNum: { fontFamily: fonts.minchoSemi, fontSize: 40 },
  logDate: { fontFamily: fonts.minchoReg, fontSize: 16 },
});
