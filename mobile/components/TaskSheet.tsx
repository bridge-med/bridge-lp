import { useState } from 'react';
import { Text, View } from 'react-native';
import { TASK_REPEATS, TASK_STATUSES, type TaskRepeat, type TaskStatus } from '../lib/constants';
import { tasks } from '../lib/data';
import { todayKey } from '../lib/date';
import { CategoryPicker } from './CategoryPicker';
import { wordbank } from '../lib/wordbank';
import { spacing, type } from '../lib/theme';
import type { Task } from '../lib/types';
import { Sheet } from './Sheet';
import { Button, Chip, Field } from './ui';

export function TaskSheet({
  visible,
  task,
  defaultLogId,
  onClose,
}: {
  visible: boolean;
  task?: Task | null;
  defaultLogId?: string | null;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [due, setDue] = useState<string | null>(null);
  const [repeat, setRepeat] = useState<TaskRepeat>('none');
  const [importance, setImportance] = useState<'high' | 'low' | undefined>(undefined);
  const [urgency, setUrgency] = useState<'high' | 'low' | undefined>(undefined);
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [memo, setMemo] = useState('');
  const [seed, setSeed] = useState<string | null>(null);

  const key = (visible ? 'open' : 'closed') + ':' + (task?.id ?? 'new');
  if (key !== seed && visible) {
    setSeed(key);
    setTitle(task?.title ?? '');
    setStatus(task?.status ?? 'todo');
    setDue(task?.dueDate ?? null);
    setRepeat(task?.repeat ?? 'none');
    setImportance(task?.importance);
    setUrgency(task?.urgency);
    setCategory(task?.category);
    setMemo(task?.memo ?? '');
  }

  function save() {
    if (!title.trim()) return;
    void tasks.upsert({
      id: task?.id,
      title: title.trim(),
      status,
      dueDate: due,
      repeat,
      importance,
      urgency,
      category,
      memo: memo.trim(),
      relatedLogId: task?.relatedLogId ?? defaultLogId ?? null,
      doneAt: status === 'done' ? task?.doneAt ?? new Date().toISOString() : null,
    } as Partial<Task>);
    void wordbank.collectFrom(title + ' ' + memo);
    onClose();
  }
  function del() {
    if (task) void tasks.remove(task.id);
    onClose();
  }

  return (
    <Sheet visible={visible} title={task ? 'タスクを編集' : '新しいタスク'} onClose={onClose}>
      <Field label="タスク名" placeholder="やること" value={title} onChangeText={setTitle} autoFocus={!task} />

      <View style={{ gap: spacing.xs }}>
        <Text style={type.label}>ステータス</Text>
        <View style={styles.row}>
          {TASK_STATUSES.map((s) => (
            <Chip key={s.key} label={s.label} tone={s.tone} active={status === s.key} onPress={() => setStatus(s.key)} />
          ))}
        </View>
      </View>

      <DuePicker value={due} onChange={setDue} />

      <View style={{ flexDirection: 'row', gap: spacing.md }}>
        <AxisPicker label="重要度" value={importance} onChange={setImportance} />
        <AxisPicker label="緊急度" value={urgency} onChange={setUrgency} />
      </View>
      <Text style={type.muted}>
        重要度を入れるとマトリクス（A〜D）に自動で並びます。緊急度は未指定なら期限から自動判定（今日・明日・期限切れ＝高）。
      </Text>

      <View style={{ gap: spacing.xs }}>
        <Text style={type.label}>繰り返し</Text>
        <View style={styles.row}>
          {TASK_REPEATS.map((r) => (
            <Chip key={r.key} label={r.label} tone="primary" active={repeat === r.key} onPress={() => setRepeat(r.key)} />
          ))}
        </View>
        {repeat !== 'none' ? (
          <Text style={type.muted}>完了すると、次の{repeat === 'daily' ? '日' : repeat === 'weekly' ? '週' : '月'}のタスクが自動で作られます。</Text>
        ) : null}
      </View>

      <CategoryPicker value={category} onChange={setCategory} />

      <Field label="メモ（任意）" placeholder="補足" value={memo} onChangeText={setMemo} multiline />

      <Button label={task ? '保存' : '追加'} onPress={save} disabled={!title.trim()} />
      {task ? <Button label="削除" variant="danger" onPress={del} /> : null}
    </Sheet>
  );
}

function AxisPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: 'high' | 'low' | undefined;
  onChange: (v: 'high' | 'low' | undefined) => void;
}) {
  const toggle = (v: 'high' | 'low') => onChange(value === v ? undefined : v);
  return (
    <View style={{ flex: 1, gap: spacing.xs }}>
      <Text style={type.label}>{label}</Text>
      <View style={styles.row}>
        <Chip label="高" tone="primary" active={value === 'high'} onPress={() => toggle('high')} />
        <Chip label="低" tone="neutral" active={value === 'low'} onPress={() => toggle('low')} />
      </View>
    </View>
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
      <View style={styles.row}>
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

const styles = {
  row: { flexDirection: 'row' as const, gap: spacing.sm, flexWrap: 'wrap' as const },
};
