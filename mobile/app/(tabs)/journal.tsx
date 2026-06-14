import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sheet } from '../../components/Sheet';
import { useColors } from '../../components/ThemeProvider';
import { Button, Card, EmptyState, Fab, Field } from '../../components/ui';
import { journal } from '../../lib/data';
import { formatDateJa, todayKey } from '../../lib/date';
import { useCollection } from '../../lib/store';
import { colors, radius, spacing, type } from '../../lib/theme';
import type { JournalEntry, Mood } from '../../lib/types';

const MOODS: { value: Mood; emoji: string }[] = [
  { value: 1, emoji: '😞' },
  { value: 2, emoji: '😕' },
  { value: 3, emoji: '😐' },
  { value: 4, emoji: '🙂' },
  { value: 5, emoji: '😄' },
];

export default function JournalScreen() {
  const all = useCollection(journal);
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState<JournalEntry | null>(null);
  const [open, setOpen] = useState(false);

  const sorted = useMemo(
    () => [...all].sort((a, b) => (b.date < a.date ? -1 : b.date > a.date ? 1 : b.createdAt < a.createdAt ? -1 : 1)),
    [all],
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}>
        <Pressable onPress={() => router.push('/review')}>
          <Card style={styles.reviewRow}>
            <Text style={{ fontSize: 22 }}>📊</Text>
            <View style={{ flex: 1 }}>
              <Text style={[type.body, { fontWeight: '700' }]}>ふりかえり</Text>
              <Text style={type.muted}>ストリーク・気分グラフ・月次サマリー</Text>
            </View>
            <Text style={[styles.reviewArrow, { color: c.primary }]}>›</Text>
          </Card>
        </Pressable>

        {sorted.length === 0 ? (
          <EmptyState icon="🌿" title="今日の一日を残そう" hint="気分と、心に残ったことを一言だけでも。続けるほど振り返りが楽しくなります。" />
        ) : (
          sorted.map((e) => (
            <Pressable
              key={e.id}
              onPress={() => {
                setEditing(e);
                setOpen(true);
              }}
            >
              <Card style={styles.entry}>
                <View style={styles.entryHead}>
                  <Text style={[styles.entryDate, { color: c.primary }]}>{formatDateJa(e.date)}</Text>
                  {e.mood ? <Text style={styles.entryMood}>{MOODS.find((m) => m.value === e.mood)?.emoji}</Text> : null}
                </View>
                <Text style={[type.body, { color: colors.text2 }]}>{e.body}</Text>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>

      <View style={{ position: 'absolute', right: 0, bottom: insets.bottom }}>
        <Fab
          onPress={() => {
            setEditing(null);
            setOpen(true);
          }}
        />
      </View>

      <JournalFormSheet visible={open} entry={editing} onClose={() => setOpen(false)} />
    </View>
  );
}

function JournalFormSheet({ visible, entry, onClose }: { visible: boolean; entry: JournalEntry | null; onClose: () => void }) {
  const [date, setDate] = useState(todayKey());
  const [mood, setMood] = useState<Mood | null>(null);
  const [body, setBody] = useState('');
  const [seed, setSeed] = useState<string | null>(null);

  const key = (visible ? 'open' : 'closed') + ':' + (entry?.id ?? 'new');
  if (key !== seed && visible) {
    setSeed(key);
    setDate(entry?.date ?? todayKey());
    setMood(entry?.mood ?? null);
    setBody(entry?.body ?? '');
  }

  function save() {
    if (!body.trim()) {
      onClose();
      return;
    }
    void journal.upsert({
      id: entry?.id,
      date: date.trim() || todayKey(),
      mood,
      body: body.trim(),
    } as Partial<JournalEntry>);
    onClose();
  }
  function del() {
    if (entry) void journal.remove(entry.id);
    onClose();
  }

  return (
    <Sheet visible={visible} title={entry ? '日記を編集' : '今日の日記'} onClose={onClose}>
      <Field label="日付" value={date} onChangeText={setDate} autoCapitalize="none" placeholder="2026-06-14" />
      <View style={{ gap: spacing.xs }}>
        <Text style={type.label}>気分</Text>
        <View style={styles.moodRow}>
          {MOODS.map((m) => (
            <Pressable
              key={m.value}
              onPress={() => setMood((cur) => (cur === m.value ? null : m.value))}
              style={[styles.moodBtn, mood === m.value && styles.moodBtnOn]}
            >
              <Text style={styles.moodEmoji}>{m.emoji}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      <Field
        label="今日のできごと"
        placeholder="心に残ったこと、感謝したこと、学んだこと…"
        value={body}
        onChangeText={setBody}
        multiline
        autoFocus={!entry}
      />
      <Button label={entry ? '保存' : '記録する'} onPress={save} />
      {entry ? <Button label="削除" variant="danger" onPress={del} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.md },
  reviewArrow: { color: colors.primary, fontSize: 16, fontWeight: '800' },
  entry: { gap: spacing.sm },
  entryHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  entryDate: { ...type.label, color: colors.primary, fontSize: 14 },
  entryMood: { fontSize: 22 },
  moodRow: { flexDirection: 'row', gap: spacing.sm },
  moodBtn: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodBtnOn: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primaryWeak },
  moodEmoji: { fontSize: 26 },
});
