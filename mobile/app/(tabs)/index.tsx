import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AiTaskSheet } from '../../components/AiTaskSheet';
import { SearchBar } from '../../components/SearchBar';
import { Sheet } from '../../components/Sheet';
import { SwipeRow } from '../../components/SwipeRow';
import { TagFilter } from '../../components/TagFilter';
import { TagInput } from '../../components/TagInput';
import { useColors } from '../../components/ThemeProvider';
import { Button, Card, Chip, EmptyState, Fab, Field } from '../../components/ui';
import { tasks } from '../../lib/data';
import { dueLabel, todayKey } from '../../lib/date';
import { usePro } from '../../lib/entitlement';
import { tapLight, tapSuccess } from '../../lib/haptics';
import { useCollection } from '../../lib/store';
import { collectTags, matchesQuery } from '../../lib/tags';
import { colors, radius, spacing, type } from '../../lib/theme';
import type { Priority, Task } from '../../lib/types';

const PRIORITY_META: Record<Priority, { label: string }> = {
  low: { label: '低' },
  normal: { label: '中' },
  high: { label: '高' },
};
const PRIORITY_RANK: Record<Priority, number> = { high: 0, normal: 1, low: 2 };

type Section = { key: string; title: string; items: Task[] };

export default function TasksScreen() {
  const all = useCollection(tasks);
  const isPro = usePro();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  function openAi() {
    if (!isPro) {
      router.push('/paywall');
      return;
    }
    setAiOpen(true);
  }

  const today = todayKey();
  const openCount = all.filter((t) => t.status === 'todo').length;
  const overdue = all.filter((t) => t.status === 'todo' && t.due && t.due < today).length;
  const dueToday = all.filter((t) => t.status === 'todo' && t.due === today).length;
  const allTags = useMemo(() => collectTags(all), [all]);

  const filtered = useMemo(() => {
    return all.filter((t) => {
      if (!matchesQuery(query, [t.title, t.notes, ...(t.tags ?? [])])) return false;
      if (tagFilter && !(t.tags ?? []).includes(tagFilter)) return false;
      return true;
    });
  }, [all, query, tagFilter]);

  const sections = useMemo(() => buildSections(filtered, today), [filtered, today]);
  const doneItems = useMemo(
    () => filtered.filter((t) => t.status === 'done').sort((a, b) => (b.doneAt ?? '') < (a.doneAt ?? '') ? -1 : 1),
    [filtered],
  );
  const hasOpen = sections.some((s) => s.items.length > 0);

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }
  function openEdit(t: Task) {
    setEditing(t);
    setSheetOpen(true);
  }
  function toggle(t: Task) {
    const toDone = t.status !== 'done';
    if (toDone) tapSuccess();
    else tapLight();
    void tasks.upsert({
      id: t.id,
      status: toDone ? 'done' : 'todo',
      doneAt: toDone ? new Date().toISOString() : null,
    } as Partial<Task>);
  }

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
        <Card style={styles.summary}>
          <Stat value={openCount} label="未完了" />
          <Divider />
          <Stat value={dueToday} label="今日が期限" tone={dueToday ? 'primary' : 'muted'} />
          <Divider />
          <Stat value={overdue} label="期限超過" tone={overdue ? 'danger' : 'muted'} />
        </Card>

        <SearchBar value={query} onChangeText={setQuery} placeholder="タスクを検索" />
        {isPro ? <TagFilter tags={allTags} selected={tagFilter} onSelect={setTagFilter} /> : null}

        <Pressable onPress={openAi} style={[styles.aiBtn, { borderColor: c.primary, backgroundColor: c.primaryWeak }]}>
          <Text style={[styles.aiBtnText, { color: c.primary }]}>✨ AIでまとめて追加{isPro ? '' : '（Pro）'}</Text>
        </Pressable>

        {!hasOpen && doneItems.length === 0 ? (
          <EmptyState
            icon="🗒️"
            title={query || tagFilter ? '該当するタスクがありません' : 'タスクはありません'}
            hint={query || tagFilter ? undefined : '右下の＋ボタンから、今日やることを1つ追加してみましょう。'}
          />
        ) : null}

        {sections.map((s) =>
          s.items.length === 0 ? null : (
            <View key={s.key} style={{ gap: spacing.sm }}>
              <Text style={styles.sectionHead}>
                {s.title} <Text style={styles.sectionCount}>{s.items.length}</Text>
              </Text>
              {s.items.map((t) => (
                <SwipeRow key={t.id} onDelete={() => void tasks.remove(t.id)}>
                  <TaskRow task={t} onToggle={() => toggle(t)} onPress={() => openEdit(t)} />
                </SwipeRow>
              ))}
            </View>
          ),
        )}

        {doneItems.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Pressable onPress={() => setShowDone((v) => !v)} style={styles.doneToggle}>
              <Text style={styles.sectionHead}>
                完了済み <Text style={styles.sectionCount}>{doneItems.length}</Text>
              </Text>
              <Text style={[styles.doneChevron, { color: c.primary }]}>{showDone ? '隠す' : '表示'}</Text>
            </Pressable>
            {showDone
              ? doneItems.map((t) => (
                  <SwipeRow key={t.id} onDelete={() => void tasks.remove(t.id)}>
                    <TaskRow task={t} onToggle={() => toggle(t)} onPress={() => openEdit(t)} />
                  </SwipeRow>
                ))
              : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={{ position: 'absolute', right: 0, bottom: insets.bottom }}>
        <Fab onPress={openNew} />
      </View>

      <TaskFormSheet visible={sheetOpen} task={editing} isPro={isPro} onClose={() => setSheetOpen(false)} />
      <AiTaskSheet visible={aiOpen} onClose={() => setAiOpen(false)} onNeedKey={() => router.push('/settings')} />
    </View>
  );
}

function buildSections(items: Task[], today: string): Section[] {
  const open = items.filter((t) => t.status === 'todo');
  const byPriority = (a: Task, b: Task) =>
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] || (b.createdAt < a.createdAt ? -1 : 1);
  return [
    { key: 'overdue', title: '期限切れ', items: open.filter((t) => t.due && t.due < today).sort((a, b) => (a.due! < b.due! ? -1 : 1)) },
    { key: 'today', title: '今日', items: open.filter((t) => t.due === today).sort(byPriority) },
    { key: 'upcoming', title: '今後', items: open.filter((t) => t.due && t.due > today).sort((a, b) => (a.due! < b.due! ? -1 : 1)) },
    { key: 'nodue', title: '期限なし', items: open.filter((t) => !t.due).sort(byPriority) },
  ];
}

function Stat({ value, label, tone = 'text' }: { value: number; label: string; tone?: 'text' | 'primary' | 'danger' | 'muted' }) {
  const c = useColors();
  const color =
    tone === 'primary' ? c.primary : tone === 'danger' ? colors.danger : tone === 'muted' ? colors.muted : colors.text;
  return (
    <View style={styles.stat}>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      <Text style={type.muted}>{label}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.vDivider} />;
}

function TaskRow({ task, onToggle, onPress }: { task: Task; onToggle: () => void; onPress: () => void }) {
  const due = dueLabel(task.due);
  const done = task.status === 'done';
  const dueTone =
    due?.tone === 'overdue' ? 'danger' : due?.tone === 'today' ? 'primary' : due?.tone === 'soon' ? 'warn' : 'neutral';
  const tags = task.tags ?? [];
  return (
    <Card style={[styles.row, done && styles.rowDone]}>
      <Pressable onPress={onToggle} hitSlop={10} style={[styles.checkbox, done && styles.checkboxOn]}>
        {done ? <Text style={styles.checkMark}>✓</Text> : null}
      </Pressable>
      <Pressable style={{ flex: 1 }} onPress={onPress}>
        <Text style={[styles.rowTitle, done && styles.rowTitleDone]} numberOfLines={2}>
          {task.title}
        </Text>
        {task.notes ? (
          <Text style={[type.muted, { marginTop: 2 }]} numberOfLines={1}>
            {task.notes}
          </Text>
        ) : null}
        {(due && !done) || (task.priority === 'high' && !done) || tags.length > 0 ? (
          <View style={styles.rowMeta}>
            {task.priority === 'high' && !done ? <Chip label="優先度 高" tone="danger" /> : null}
            {due && !done ? <Chip label={due.text} tone={dueTone} /> : null}
            {tags.map((t) => (
              <Chip key={t} label={`#${t}`} tone="neutral" />
            ))}
          </View>
        ) : null}
      </Pressable>
    </Card>
  );
}

function TaskFormSheet({
  visible,
  task,
  isPro,
  onClose,
}: {
  visible: boolean;
  task: Task | null;
  isPro: boolean;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [due, setDue] = useState<string | null>(null);
  const [tags, setTags] = useState<string[]>([]);
  const [seed, setSeed] = useState<string | null>(null);

  const key = (visible ? 'open' : 'closed') + ':' + (task?.id ?? 'new');
  if (key !== seed && visible) {
    setSeed(key);
    setTitle(task?.title ?? '');
    setNotes(task?.notes ?? '');
    setPriority(task?.priority ?? 'normal');
    setDue(task?.due ?? null);
    setTags(task?.tags ?? []);
  }

  function save() {
    const trimmed = title.trim();
    if (!trimmed) return;
    void tasks.upsert({
      id: task?.id,
      title: trimmed,
      notes: notes.trim(),
      priority,
      due,
      tags,
      status: task?.status ?? 'todo',
      doneAt: task?.doneAt ?? null,
    } as Partial<Task>);
    onClose();
  }
  function del() {
    if (task) void tasks.remove(task.id);
    onClose();
  }
  function goPaywall() {
    onClose();
    router.push('/paywall');
  }

  return (
    <Sheet visible={visible} title={task ? 'タスクを編集' : '新しいタスク'} onClose={onClose}>
      <Field label="タイトル" placeholder="やることを入力" value={title} onChangeText={setTitle} autoFocus={!task} />
      <Field label="メモ（任意）" placeholder="補足・リンクなど" value={notes} onChangeText={setNotes} multiline />

      <View style={{ gap: spacing.xs }}>
        <Text style={type.label}>優先度</Text>
        <View style={styles.chipRow}>
          {(['low', 'normal', 'high'] as Priority[]).map((p) => (
            <Chip
              key={p}
              label={PRIORITY_META[p].label}
              tone={p === 'high' ? 'danger' : 'primary'}
              active={priority === p}
              onPress={() => setPriority(p)}
            />
          ))}
        </View>
      </View>

      <DuePicker value={due} onChange={setDue} />
      <TagInput value={tags} onChange={setTags} enabled={isPro} onLocked={goPaywall} />

      <Button label={task ? '保存' : '追加'} onPress={save} disabled={!title.trim()} />
      {task ? <Button label="削除" variant="danger" onPress={del} /> : null}
    </Sheet>
  );
}

function DuePicker({ value, onChange }: { value: string | null; onChange: (v: string | null) => void }) {
  const today = todayKey();
  const plus = (n: number) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return todayKey(d);
  };
  const options: { label: string; value: string | null }[] = [
    { label: 'なし', value: null },
    { label: '今日', value: today },
    { label: '明日', value: plus(1) },
    { label: '+3日', value: plus(3) },
    { label: '+7日', value: plus(7) },
  ];
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={type.label}>期限</Text>
      <View style={styles.chipRow}>
        {options.map((o) => (
          <Chip key={o.label} label={o.label} tone="primary" active={value === o.value} onPress={() => onChange(o.value)} />
        ))}
      </View>
      <Field
        placeholder="または日付を入力（例 2026-06-20）"
        value={value && !options.some((o) => o.value === value) ? value : ''}
        onChangeText={(t) => onChange(t.trim() ? t.trim() : null)}
        autoCapitalize="none"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', paddingVertical: spacing.lg },
  stat: { alignItems: 'center', gap: 2, flex: 1 },
  statValue: { fontSize: 28, fontWeight: '700' },
  vDivider: { width: StyleSheet.hairlineWidth, height: 36, backgroundColor: colors.line },
  sectionHead: { ...type.label, color: colors.text2, fontSize: 14 },
  sectionCount: { color: colors.muted, fontWeight: '600' },
  doneToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  doneChevron: { color: colors.primary, fontSize: 13, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, padding: spacing.md },
  rowDone: { backgroundColor: colors.surface2 },
  checkbox: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: colors.line2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkMark: { color: colors.white, fontSize: 16, fontWeight: '700' },
  rowTitle: { ...type.body, fontWeight: '600' },
  rowTitleDone: { color: colors.muted, textDecorationLine: 'line-through' },
  rowMeta: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, flexWrap: 'wrap' },
  chipRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  aiBtn: { borderWidth: 1, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center' },
  aiBtnText: { fontSize: 15, fontWeight: '700' },
});
