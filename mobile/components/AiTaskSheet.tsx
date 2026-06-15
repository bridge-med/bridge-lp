import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { AiError, localExtractTasks, type DraftTask } from '../lib/ai';
import { credits, GEN_COST, useCoins } from '../lib/credits';
import { tasks } from '../lib/data';
import { dueLabel } from '../lib/date';
import { tapSuccess } from '../lib/haptics';
import { spacing, type } from '../lib/theme';
import { wordbank } from '../lib/wordbank';
import type { Task } from '../lib/types';
import { Sheet } from './Sheet';
import { useColors } from './ThemeProvider';
import { Button, Chip, Field } from './ui';

type Draft = DraftTask & { include: boolean };

export function AiTaskSheet({ visible, onClose }: { visible: boolean; onClose: () => void; onNeedKey?: () => void }) {
  const c = useColors();
  const coins = useCoins();
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [drafts, setDrafts] = useState<Draft[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setText('');
    setDrafts(null);
    setError(null);
    setLoading(false);
  }
  function close() {
    reset();
    onClose();
  }

  async function run() {
    if (!text.trim()) return;
    if (!(await credits.spend(GEN_COST))) {
      Alert.alert('コインが足りません', 'AIで整理するにはコインが必要です。', [
        { text: '閉じる', style: 'cancel' },
        { text: 'コインを見る', onPress: () => { close(); router.push('/coins'); } },
      ]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = localExtractTasks(text);
      if (result.length === 0) setError('タスクを抽出できませんでした。文章を具体的にしてみてください。');
      else setDrafts(result.map((d) => ({ ...d, include: true })));
    } catch (e) {
      setError(e instanceof AiError ? e.message : '予期しないエラーが発生しました。');
    } finally {
      setLoading(false);
    }
  }

  async function add() {
    void wordbank.collectFrom(text);
    for (const d of (drafts ?? []).filter((d) => d.include)) {
      await tasks.upsert({
        title: d.title,
        relatedLogId: null,
        dueDate: d.dueDate,
        status: 'todo',
        memo: '',
        tags: d.tags,
        doneAt: null,
      } as Partial<Task>);
    }
    tapSuccess();
    close();
  }

  return (
    <Sheet visible={visible} title="まとめて追加" onClose={close}>
      {drafts === null ? (
        <>
          <Text style={type.muted}>やること・予定を思いつくまま書いてください。自動でタスクに整理します。</Text>
          <Field placeholder={'例) 明日までに請求書送る。来週A院に連絡。資料の見直し。'} value={text} onChangeText={setText} multiline autoFocus />
          {error ? <Text style={[type.body, { color: '#b91c1c' }]}>{error}</Text> : null}
          {loading ? (
            <View style={styles.loading}>
              <ActivityIndicator color={c.primary} />
              <Text style={type.muted}>整理しています…</Text>
            </View>
          ) : (
            <>
              <Button label="整理する（1コイン）" onPress={run} disabled={!text.trim()} />
              <Text style={[type.muted, { textAlign: 'center' }]}>残り {coins} コイン</Text>
            </>
          )}
        </>
      ) : (
        <>
          <Text style={type.muted}>追加するタスクを選んでください（{drafts.filter((d) => d.include).length}件）。</Text>
          {drafts.map((d, i) => {
            const due = dueLabel(d.dueDate);
            return (
              <Pressable
                key={i}
                onPress={() => setDrafts((arr) => arr!.map((x, j) => (j === i ? { ...x, include: !x.include } : x)))}
                style={[styles.draft, { borderColor: d.include ? c.primary : c.line, backgroundColor: d.include ? c.primaryWeak : c.surface }]}
              >
                <Text style={[styles.check, { color: d.include ? c.primary : c.muted }]}>{d.include ? '☑' : '☐'}</Text>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={type.body}>{d.title}</Text>
                  <View style={styles.meta}>
                    {due ? <Chip label={due.text} tone="primary" /> : null}
                    {d.tags.map((t) => (
                      <Chip key={t} label={`#${t}`} tone="neutral" />
                    ))}
                  </View>
                </View>
              </Pressable>
            );
          })}
          <Button label={`${drafts.filter((d) => d.include).length}件を追加`} onPress={add} disabled={!drafts.some((d) => d.include)} />
          <Button label="やり直す" variant="ghost" onPress={() => setDrafts(null)} />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  loading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center', paddingVertical: spacing.md },
  draft: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', borderWidth: 1.5, borderRadius: 12, padding: spacing.md },
  check: { fontSize: 20, marginTop: 1 },
  meta: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
});
