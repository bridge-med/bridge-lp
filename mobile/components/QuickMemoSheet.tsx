import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { AiError, tidyMemo } from '../lib/ai';
import { credits, GEN_COST } from '../lib/credits';
import { quickMemos } from '../lib/data';
import { progress } from '../lib/progress';
import { wordbank } from '../lib/wordbank';
import { spacing, type } from '../lib/theme';
import type { QuickMemo } from '../lib/types';
import { Sheet } from './Sheet';
import { TagPicker } from './TagPicker';
import { useColors } from './ThemeProvider';
import { Button, Field } from './ui';

export function QuickMemoSheet({ visible, memo, onClose }: { visible: boolean; memo?: QuickMemo | null; onClose: () => void }) {
  const c = useColors();
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [seed, setSeed] = useState<string | null>(null);
  const [aiBusy, setAiBusy] = useState(false);

  const key = (visible ? 'open' : 'closed') + ':' + (memo?.id ?? 'new');
  if (key !== seed && visible) {
    setSeed(key);
    setContent(memo?.content ?? '');
    setTags(memo?.tags ?? []);
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
      <TagPicker value={tags} onChange={setTags} />
      <Button label={memo ? '保存' : '保存'} onPress={save} />
      {memo ? <Button label="削除" variant="danger" onPress={del} /> : null}
    </Sheet>
  );
}
