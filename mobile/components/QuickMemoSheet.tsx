import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AiError, tidyMemo } from '../lib/ai';
import { credits, GEN_COST } from '../lib/credits';
import { quickMemos, tasks } from '../lib/data';
import { progress } from '../lib/progress';
import { wordbank } from '../lib/wordbank';
import { spacing, type } from '../lib/theme';
import type { QuickMemo, Task } from '../lib/types';
import { CategoryPicker } from './CategoryPicker';
import { Sheet } from './Sheet';
import { TagPicker } from './TagPicker';
import { useColors } from './ThemeProvider';
import { Button, Field } from './ui';

export function QuickMemoSheet({ visible, memo, onClose }: { visible: boolean; memo?: QuickMemo | null; onClose: () => void }) {
  const c = useColors();
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [seed, setSeed] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const key = (visible ? 'open' : 'closed') + ':' + (memo?.id ?? 'new');
  if (key !== seed && visible) {
    setSeed(key);
    setContent(memo?.content ?? '');
    setTags(memo?.tags ?? []);
    setCategory(memo?.category);
  }

  async function runAi() {
    if (!content.trim()) return;
    if (!(await credits.spend(GEN_COST))) {
      Alert.alert('コインが足りません', 'AIで整えるにはコインが必要です。', [
        { text: '閉じる', style: 'cancel' },
        { text: 'コインを見る', onPress: () => router.push('/coins') },
      ]);
      return;
    }
    setAiBusy(true);
    try {
      setContent(await tidyMemo(content));
    } catch (e) {
      void credits.add(GEN_COST); // refund on failure
      Alert.alert('整理に失敗', e instanceof AiError ? e.message : '予期しないエラーが発生しました。');
    } finally {
      setAiBusy(false);
    }
  }

  function save() {
    if (!content.trim()) {
      onClose();
      return;
    }
    void quickMemos.upsert({
      id: memo?.id,
      content: content.trim(),
      tags,
      category,
      convertedToLogId: memo?.convertedToLogId ?? null,
    } as Partial<QuickMemo>);
    if (!memo) void progress.recordActivity('memo');
    void wordbank.collectFrom(content);
    onClose();
  }
  function del() {
    if (memo) void quickMemos.remove(memo.id);
    onClose();
  }

  // Turn this memo into a task (first line = title, rest = memo).
  function toTask() {
    if (!content.trim()) return;
    const lines = content.trim().split('\n');
    void tasks.upsert({
      title: lines[0].slice(0, 80),
      memo: lines.slice(1).join('\n').trim(),
      status: 'todo',
      dueDate: null,
      repeat: 'none',
      relatedLogId: null,
      doneAt: null,
    } as Partial<Task>);
    void progress.recordActivity('task');
    onClose();
    Alert.alert('タスクにしました', '「タスク」タブで期限などを設定できます。');
  }

  // Promote this memo into a full work log (prefilled in the log editor).
  async function toLog() {
    if (!content.trim()) return;
    let memoId = memo?.id;
    if (!memoId) {
      const saved = await quickMemos.upsert({ content: content.trim(), tags, convertedToLogId: null } as Partial<QuickMemo>);
      memoId = saved.id;
      void progress.recordActivity('memo');
    }
    onClose();
    router.push({ pathname: '/log-edit', params: { seed: content.trim(), memoId } });
  }

  return (
    <Sheet visible={visible} title={memo ? 'メモを編集' : 'クイックメモ'} onClose={onClose}>
      <Field
        placeholder="1行でもOK。気づき・違和感・あとで整理したいこと…"
        value={content}
        onChangeText={setContent}
        multiline
        autoFocus={!memo}
      />
      <Pressable onPress={runAi} disabled={aiBusy} style={{ alignSelf: 'flex-start' }} hitSlop={6}>
        {aiBusy ? (
          <ActivityIndicator color={c.primary} />
        ) : (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Feather name="feather" size={15} color={c.primary} />
            <Text style={[type.label, { color: c.primary }]}>整える</Text>
          </View>
        )}
      </Pressable>
      <CategoryPicker value={category} onChange={setCategory} />
      <TagPicker value={tags} onChange={setTags} />

      {content.trim() ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Pressable onPress={toTask} style={[styles.route, { borderColor: c.primary }]}>
            <Feather name="check-square" size={15} color={c.primary} />
            <Text style={[type.label, { color: c.primary }]}>タスクにする</Text>
          </Pressable>
          <Pressable onPress={() => void toLog()} style={[styles.route, { borderColor: c.primary }]}>
            <Feather name="file-text" size={15} color={c.primary} />
            <Text style={[type.label, { color: c.primary }]}>ログにする</Text>
          </Pressable>
        </View>
      ) : null}

      <Button label="保存" onPress={save} />
      {memo ? <Button label="削除" variant="danger" onPress={del} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  route: {
    flex: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingVertical: 12,
  },
});
