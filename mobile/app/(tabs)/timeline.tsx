import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlockHeader } from '../../components/BlockHeader';
import { Ledger } from '../../components/Ledger';
import { QuickMemoSheet } from '../../components/QuickMemoSheet';
import { useColors } from '../../components/ThemeProvider';
import { Chip, EmptyState, Fab } from '../../components/ui';
import { quickMemos, reflections, tasks, workLogs } from '../../lib/data';
import { parseKey } from '../../lib/date';
import { useCollection } from '../../lib/store';
import { colors, fonts, spacing, type } from '../../lib/theme';
import type { QuickMemo } from '../../lib/types';

type Kind = 'log' | 'memo' | 'task' | 'reflection';
type Item = {
  id: string;
  kind: Kind;
  ts: string; // ISO for sorting
  dateKey: string;
  title: string;
  body: string;
  onPress: () => void;
};

const KIND_META: Record<Kind, { label: string; tone: 'primary' | 'neutral' | 'accent' | 'warn' }> = {
  log: { label: '仕事ログ', tone: 'primary' },
  memo: { label: 'クイックメモ', tone: 'neutral' },
  task: { label: 'タスク完了', tone: 'accent' },
  reflection: { label: '振り返り', tone: 'warn' },
};

export default function TimelineScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const logs = useCollection(workLogs);
  const memos = useCollection(quickMemos);
  const allTasks = useCollection(tasks);
  const refs = useCollection(reflections);
  const [filter, setFilter] = useState<Kind | 'all'>('all');
  const [memoOpen, setMemoOpen] = useState(false);
  const [editMemo, setEditMemo] = useState<QuickMemo | null>(null);

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    for (const l of logs) {
      out.push({
        id: 'log:' + l.id,
        kind: 'log',
        ts: l.date + 'T' + l.createdAt.slice(11),
        dateKey: l.date,
        title: l.title || '無題のlog',
        body: l.did,
        onPress: () => router.push(`/log/${l.id}`),
      });
    }
    for (const m of memos) {
      out.push({
        id: 'memo:' + m.id,
        kind: 'memo',
        ts: m.createdAt,
        dateKey: m.createdAt.slice(0, 10),
        title: m.content.split('\n')[0].slice(0, 40) || 'メモ',
        body: '',
        onPress: () => {
          setEditMemo(m);
          setMemoOpen(true);
        },
      });
    }
    for (const t of allTasks) {
      if (t.status === 'done' && t.doneAt) {
        out.push({
          id: 'task:' + t.id,
          kind: 'task',
          ts: t.doneAt,
          dateKey: t.doneAt.slice(0, 10),
          title: t.title,
          body: '',
          onPress: () => router.push('/tasks'),
        });
      }
    }
    for (const r of refs) {
      out.push({
        id: 'ref:' + r.id,
        kind: 'reflection',
        ts: r.createdAt,
        dateKey: r.createdAt.slice(0, 10),
        title: r.periodType === 'week' ? '週次の振り返り' : '月次の振り返り',
        body: r.content.did,
        onPress: () => router.push('/reflection'),
      });
    }
    return out.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  }, [logs, memos, allTasks, refs]);

  const visible = filter === 'all' ? items : items.filter((i) => i.kind === filter);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <BlockHeader wordmark="RECORD" title="記録" pad={20} />
        <View style={styles.filters}>
          {(['all', 'log', 'memo', 'task'] as const).map((f) => (
            <Chip
              key={f}
              label={f === 'all' ? 'すべて' : f === 'log' ? 'ログ' : f === 'memo' ? 'メモ' : 'タスク'}
              tone="primary"
              active={filter === f}
              onPress={() => setFilter(f)}
            />
          ))}
        </View>

        {visible.length === 0 ? (
          <Ledger>
            <EmptyState icon="clock" title="まだ履歴がありません" hint="仕事ログやメモを残すと、ここに時系列で積み上がります。" />
          </Ledger>
        ) : (
          visible.map((it) => {
            const dd = parseKey(it.dateKey);
            const m = KIND_META[it.kind];
            const tint = m.tone === 'primary' ? c.primary : m.tone === 'accent' ? c.good : m.tone === 'warn' ? c.warn : c.muted;
            return (
              <Ledger key={it.id} onPress={it.onPress} gutter={<Text style={[styles.gdate, { color: tint }]}>{`${dd.getMonth() + 1}.${dd.getDate()}`}</Text>}>
                <Text style={[styles.kind, { color: tint }]}>{m.label}</Text>
                <Text style={[type.title, { marginTop: 2 }]} numberOfLines={1}>
                  {it.title}
                </Text>
                {it.body ? (
                  <Text style={[type.muted, { marginTop: 2 }]} numberOfLines={2}>
                    {it.body}
                  </Text>
                ) : null}
              </Ledger>
            );
          })
        )}
      </ScrollView>

      <View style={{ position: 'absolute', right: 0, bottom: insets.bottom }}>
        <Fab
          icon="edit-3"
          onPress={() => {
            setEditMemo(null);
            setMemoOpen(true);
          }}
        />
      </View>

      <QuickMemoSheet visible={memoOpen} memo={editMemo} onClose={() => setMemoOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  filters: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  gdate: { fontFamily: fonts.minchoReg, fontSize: 16 },
  kind: { fontFamily: fonts.gothicMed, fontSize: 11, letterSpacing: 1 },
});
