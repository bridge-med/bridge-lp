import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sheet } from '../../components/Sheet';
import { Button, Card, Chip, EmptyState, Fab, Field } from '../../components/ui';
import { tasks } from '../../lib/data';
import { dueLabel, todayKey } from '../../lib/date';
import { useCollection } from '../../lib/store';
import { colors, radius, spacing, type } from '../../lib/theme';
import type { Priority, Task } from '../../lib/types';

type Filter = 'open' | 'today' | 'all';

const PRIORITY_META: Record<Priority, { label: string; tone: 'neutral' | 'warn' | 'danger' }> = {
  low: { label: '低', tone: 'neutral' },
  normal: { label: '中', tone: 'neutral' },
  high: { label: '高', tone: 'danger' },
};
const PRIORITY_RANK: Record<Priority, number> = { high: 0, normal: 1, low: 2 };

export default function TasksScreen() {
  const all = useCollection(tasks);
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState<Filter>('open');
  const [editing, setEditing] = useState<Task | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  const today = todayKey();
  const openCount = all.filter((t) => t.status === 'todo').length;
  const overdue = all.filter((t) => t.status === 'todo' && t.due && t.due < today).length;
  const dueToday = all.filter((t) => t.status === 'todo' && t.due === today).length;

  const visible = useMemo(() => {
    let list = [...all];
    if (filter === 'open') list = list.filter((t) => t.status === 'todo');
    else if (filter === 'today')
      list = list.filter((t) => t.status === 'todo' && t.due && t.due <= today);
    return list.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'todo' ? -1 : 1;
      if (!!a.due !== !!b.due) return a.due ? -1 : 1;
      if (a.due && b.due && a.due !== b.due) return a.due < b.due ? -1 : 1;
      if (PRIORITY_RANK[a.priority] !== PRIORITY_RANK[b.priority])
        return PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
      return b.createdAt < a.createdAt ? -1 : 1;
    });
  }, [all, filter, today]);

  function openNew() {
    setEditing(null);
    setSheetOpen(true);
  }
  function openEdit(t: Task) {
    setEditing(t);
    setSheetOpen(true);
  }
  function toggle(t: Task) {
    void tasks.upsert({
      id: t.id,
      status: t.status === 'done' ? 'todo' : 'done',
      doneAt: t.status === 'done' ? null : new Date().toISOString(),
    } as Partial<Task>);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}>
        <Card style={styles.summary}>
          <Stat value={openCount} label="未完了" />
          <Divider />
          <Stat value={dueToday} label="今日が期限" tone={dueToday ? 'primary' : 'muted'} />
          <Divider />
          <Stat value={overdue} label="期限超過" tone={overdue ? 'danger' : 'muted'} />
        </Card>

        <View style={styles.filters}>
          <Chip label="未完了" active={filter === 'open'} tone="primary" onPress={() => setFilter('open')} />
          <Chip label="今日まで" active={filter === 'today'} tone="primary" onPress={() => setFilter('today')} />
          <Chip label="すべて" active={filter === 'all'} tone="primary" onPress={() => setFilter('all')} />
        </View>

        {visible.length === 0 ? (
          <EmptyState
            icon="🗒️"
            title="タスクはありません"
            hint="右下の＋ボタンから、今日やることを1つ追加してみましょう。"
          />
        ) : (
          visible.map((t) => <TaskRow key={t.id} task={t} onToggle={() => toggle(t)} onPress={() => openEdit(t)} />)
        )}
      </ScrollView>

      <View style={{ position: 'absolute', right: 0, bottom: insets.bottom }}>
        <Fab onPress={openNew} />
      </View>

      <TaskFormSheet
        visible={sheetOpen}
        task={editing}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

function Stat({ value, label, tone = 'text' }: { value: number; label: string; tone?: 'text' | 'primary' | 'danger' | 'muted' }) {
  const color =
    tone === 'primary' ? colors.primary : tone === 'danger' ? colors.danger : tone === 'muted' ? colors.muted : colors.text;
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
        <View style={styles.rowMeta}>
          {task.priority === 'high' && !done ? <Chip label="優先度 高" tone="danger" /> : null}
          {due && !done ? <Chip label={due.text} tone={dueTone} /> : null}
        </View>
      </Pressable>
    </Card>
  );
}

function TaskFormSheet({ visible, task, onClose }: { visible: boolean; task: Task | null; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState<Priority>('normal');
  const [due, setDue] = useState<string | null>(null);
  const [seed, setSeed] = useState<string | null>(null);

  // Re-seed form fields whenever a different record is opened.
  const key = (visible ? 'open' : 'closed') + ':' + (task?.id ?? 'new');
  if (key !== seed && visible) {
    setSeed(key);
    setTitle(task?.title ?? '');
    setNotes(task?.notes ?? '');
    setPriority(task?.priority ?? 'normal');
    setDue(task?.due ?? null);
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
      status: task?.status ?? 'todo',
      doneAt: task?.doneAt ?? null,
    } as Partial<Task>);
    onClose();
  }
  function del() {
    if (task) void tasks.remove(task.id);
    onClose();
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
          <Chip
            key={o.label}
            label={o.label}
            tone="primary"
            active={value === o.value}
            onPress={() => onChange(o.value)}
          />
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
  filters: { flexDirection: 'row', gap: spacing.sm },
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
});
