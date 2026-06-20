import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlockHeader } from '../../components/BlockHeader';
import { Ledger } from '../../components/Ledger';
import { QuickMemoSheet } from '../../components/QuickMemoSheet';
import { useColors } from '../../components/ThemeProvider';
import { Button, Chip, EmptyState, Fab } from '../../components/ui';
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
  search: string; // lowercased haystack
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
  const [query, setQuery] = useState('');
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
        search: [l.title, l.did, l.problem, l.devised, l.decision, l.people, l.result, l.learning, l.nextAction, l.memo, l.tags.join(' ')].join(' ').toLowerCase(),
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
        search: (m.content + ' ' + m.tags.join(' ')).toLowerCase(),
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
          search: (t.title + ' ' + t.memo).toLowerCase(),
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
        search: Object.values(r.content).join(' ').toLowerCase(),
        onPress: () => router.push('/reflection'),
      });
    }
    return out.sort((a, b) => (a.ts < b.ts ? 1 : -1));
  }, [logs, memos, allTasks, refs]);

  const q = query.trim().toLowerCase();
  const byKind = filter === 'all' ? items : items.filter((i) => i.kind === filter);
  const visible = q ? byKind.filter((i) => i.search.includes(q)) : byKind;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        <BlockHeader wordmark="RECORD" title="記録" pad={20} />

        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <Feather name="search" size={16} color={colors.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="ログ・メモ・タグを検索"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {query ? (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Feather name="x" size={16} color={colors.muted} />
              </Pressable>
            ) : null}
          </View>
        </View>

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
            {q ? (
              <EmptyState icon="search" title="見つかりませんでした" hint={`「${query}」に一致する記録はありません。`} />
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: spacing.lg }}>
                <EmptyState
                  icon="book-open"
                  title="まだ記録がありません"
                  hint={'最初は1行だけで大丈夫。\n今日の「やったこと」を残すと、\nあとで職務経歴書・1on1・面接の材料になります。'}
                />
                <View style={{ alignSelf: 'stretch', paddingHorizontal: spacing.lg, gap: spacing.sm, marginTop: spacing.md }}>
                  <Button label="今日のログを書く" onPress={() => router.push('/log-edit')} />
                  <Button label="さっとメモする" variant="ghost" onPress={() => { setEditMemo(null); setMemoOpen(true); }} />
                </View>
              </View>
            )}
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
        {items.length > 0 ? (
          <Fab
            icon="edit-3"
            onPress={() => {
              setEditMemo(null);
              setMemoOpen(true);
            }}
          />
        ) : null}
      </View>

      <QuickMemoSheet visible={memoOpen} memo={editMemo} onClose={() => setMemoOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  searchWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, paddingHorizontal: spacing.md, height: 44 },
  searchInput: { flex: 1, fontFamily: fonts.gothic, fontSize: 15, color: colors.text, padding: 0 },
  filters: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm },
  gdate: { fontFamily: fonts.maruMed, fontSize: 16 },
  kind: { fontFamily: fonts.gothicMed, fontSize: 11, letterSpacing: 1 },
});
