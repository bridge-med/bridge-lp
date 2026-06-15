import { Feather } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CalendarModal } from '../components/DatePicker';
import { TagPicker } from '../components/TagPicker';
import { useColors } from '../components/ThemeProvider';
import { Button } from '../components/ui';
import { workLogs } from '../lib/data';
import { parseKey, todayKey } from '../lib/date';
import { tapSuccess } from '../lib/haptics';
import { progress } from '../lib/progress';
import { wordbank } from '../lib/wordbank';
import { colors, fonts, spacing, type } from '../lib/theme';
import type { WorkLog } from '../lib/types';

const WD = ['日', '月', '火', '水', '木', '金', '土'];

export default function LogEditScreen() {
  const insets = useSafeAreaInsets();
  const c = useColors();
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
  const [calOpen, setCalOpen] = useState(false);

  function save() {
    const logDate = date.trim() || todayKey();
    void workLogs.upsert({
      id: existing?.id,
      date: logDate,
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
    if (!existing) void progress.recordActivity('log', logDate);
    void wordbank.collectFrom([title, did, problem, devised, decision, people, result, learning, nextAction, memo].join(' '));
    tapSuccess();
    router.back();
  }

  const empty =
    !title.trim() && !did.trim() && !problem.trim() && !devised.trim() && !decision.trim() &&
    !people.trim() && !result.trim() && !learning.trim() && !nextAction.trim() && !memo.trim();

  const dd = parseKey(date.trim() || todayKey());

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }} keyboardShouldPersistTaps="handled">
        {/* top bar */}
        <View style={[styles.bar, { paddingTop: insets.top + spacing.sm }]}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <Feather name="arrow-left" size={22} color={colors.text} />
          </Pressable>
          <Text style={type.label}>{existing ? 'EDIT LOG' : 'NEW LOG'}</Text>
        </View>

        {/* notebook hero — tap the date to pick / back-date */}
        <Pressable style={styles.hero} onPress={() => setCalOpen(true)} hitSlop={8}>
          <Text style={[styles.weekday, { color: c.primary }]}>{WD[dd.getDay()]}</Text>
          <Text style={styles.date}>
            {dd.getMonth() + 1}月{dd.getDate()}日
          </Text>
          <Feather name="chevron-down" size={20} color={colors.muted} />
        </Pressable>
        <CalendarModal visible={calOpen} value={date} onClose={() => setCalOpen(false)} onSelect={setDate} />

        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="今日の仕事を、ひとことで"
          placeholderTextColor={colors.line2}
          multiline
        />
        <View style={styles.rule} />

        <Note label="今日やったこと" value={did} onChangeText={setDid} c={c} />
        <Note label="困ったこと" value={problem} onChangeText={setProblem} c={c} />
        <Note label="工夫したこと" value={devised} onChangeText={setDevised} c={c} />
        <Note label="自分の判断" value={decision} onChangeText={setDecision} c={c} />
        <Note label="誰と関わったか" value={people} onChangeText={setPeople} c={c} placeholder="A院長、リハ科スタッフ など" single />
        <Note label="結果" value={result} onChangeText={setResult} c={c} />
        <Note label="学び" value={learning} onChangeText={setLearning} c={c} />
        <Note label="次にやること" value={nextAction} onChangeText={setNextAction} c={c} />
        <Note label="自由メモ" value={memo} onChangeText={setMemo} c={c} />

        <View style={styles.tagWrap}>
          <TagPicker value={tags} onChange={setTags} />
        </View>

        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.sm, marginTop: spacing.lg }}>
          <Button label={existing ? '保存する' : '保存する'} onPress={save} disabled={empty} />
          {existing ? (
            <Button label="削除" variant="danger" onPress={() => { void workLogs.remove(existing.id); router.back(); }} />
          ) : null}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Note({
  label,
  value,
  onChangeText,
  c,
  placeholder,
  single,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  c: ReturnType<typeof useColors>;
  placeholder?: string;
  single?: boolean;
}) {
  const filled = value.trim().length > 0;
  return (
    <View style={styles.note}>
      <Text style={[styles.noteLabel, filled && { color: c.primary }]}>{label}</Text>
      <TextInput
        style={styles.noteInput}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder ?? '—'}
        placeholderTextColor={colors.line2}
        multiline={!single}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  hero: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, flexDirection: 'row', alignItems: 'baseline', gap: spacing.md },
  weekday: { fontFamily: fonts.maruMed, fontSize: 24 },
  date: { fontFamily: fonts.maruBlack, fontSize: 38, color: colors.text },
  titleInput: {
    fontFamily: fonts.gothicBold,
    fontSize: 22,
    color: colors.text,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    lineHeight: 32,
  },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginHorizontal: spacing.lg, marginTop: spacing.md },
  note: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  noteLabel: { fontFamily: fonts.gothicBold, fontSize: 11, letterSpacing: 1, color: colors.muted },
  noteInput: {
    fontFamily: fonts.gothic,
    fontSize: 16,
    color: colors.text,
    lineHeight: 25,
    paddingTop: 6,
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
    minHeight: 40,
  },
  tagWrap: { paddingHorizontal: spacing.lg, paddingTop: spacing.xl },
});
