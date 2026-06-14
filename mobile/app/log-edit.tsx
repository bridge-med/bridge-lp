import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TagPicker } from '../components/TagPicker';
import { Button, Field } from '../components/ui';
import { workLogs } from '../lib/data';
import { todayKey } from '../lib/date';
import { tapSuccess } from '../lib/haptics';
import { colors, spacing } from '../lib/theme';
import type { WorkLog } from '../lib/types';

export default function LogEditScreen() {
  const insets = useSafeAreaInsets();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = id ? workLogs.getSnapshot().find((l) => l.id === id) ?? null : null;

  const [date, setDate] = useState(existing?.date ?? todayKey());
  const [title, setTitle] = useState(existing?.title ?? '');
  const [did, setDid] = useState(existing?.did ?? '');
  const [problem, setProblem] = useState(existing?.problem ?? '');
  const [devised, setDevised] = useState(existing?.devised ?? '');
  const [decision, setDecision] = useState(existing?.decision ?? '');
  const [people, setPeople] = useState(existing?.people ?? '');
  const [result, setResult] = useState(existing?.result ?? '');
  const [learning, setLearning] = useState(existing?.learning ?? '');
  const [nextAction, setNextAction] = useState(existing?.nextAction ?? '');
  const [memo, setMemo] = useState(existing?.memo ?? '');
  const [tags, setTags] = useState<string[]>(existing?.tags ?? []);

  function save() {
    void workLogs.upsert({
      id: existing?.id,
      date: date.trim() || todayKey(),
      title: title.trim(),
      did: did.trim(),
      problem: problem.trim(),
      devised: devised.trim(),
      decision: decision.trim(),
      people: people.trim(),
      result: result.trim(),
      learning: learning.trim(),
      nextAction: nextAction.trim(),
      memo: memo.trim(),
      tags,
    } as Partial<WorkLog>);
    tapSuccess();
    router.back();
  }

  const empty =
    !title.trim() && !did.trim() && !problem.trim() && !devised.trim() && !decision.trim() &&
    !people.trim() && !result.trim() && !learning.trim() && !nextAction.trim() && !memo.trim();

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ title: existing ? '仕事ログを編集' : '仕事ログ' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl, gap: spacing.md }} keyboardShouldPersistTaps="handled">
        <Field label="日付" value={date} onChangeText={setDate} autoCapitalize="none" placeholder="2026-06-14" />
        <Field label="タイトル" value={title} onChangeText={setTitle} placeholder="今日の仕事をひとことで" />
        <Field label="今日やったこと" value={did} onChangeText={setDid} multiline placeholder="" />
        <Field label="困ったこと" value={problem} onChangeText={setProblem} multiline />
        <Field label="工夫したこと" value={devised} onChangeText={setDevised} multiline />
        <Field label="自分の判断" value={decision} onChangeText={setDecision} multiline />
        <Field label="誰と関わったか" value={people} onChangeText={setPeople} placeholder="A院長、リハ科スタッフ など" />
        <Field label="結果" value={result} onChangeText={setResult} multiline />
        <Field label="学び" value={learning} onChangeText={setLearning} multiline />
        <Field label="次にやること" value={nextAction} onChangeText={setNextAction} multiline />
        <Field label="自由メモ" value={memo} onChangeText={setMemo} multiline />
        <TagPicker value={tags} onChange={setTags} />

        <View style={{ height: spacing.sm }} />
        <Button label={existing ? '保存' : '保存する'} onPress={save} disabled={empty} />
        {existing ? (
          <Button label="削除" variant="danger" onPress={() => { void workLogs.remove(existing.id); router.back(); }} />
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
});
