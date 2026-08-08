import { useState } from 'react';
import { Share, Text, View } from 'react-native';
import { TASK_REPEATS, TASK_STATUSES, type Ownership, type TaskRepeat, type TaskStatus } from '../lib/constants';
import { tasks } from '../lib/data';
import { todayKey } from '../lib/date';
import { CategoryPicker } from './CategoryPicker';
import { composeRequest, DRAFT_TONES, HOLD_HINT, OWNERSHIPS, type DraftTone } from '../lib/ownership';
import { wordbank } from '../lib/wordbank';
import { spacing, type } from '../lib/theme';
import type { Task } from '../lib/types';
import { Sheet } from './Sheet';
import { Button, Chip, Field } from './ui';

export function TaskSheet({
  visible,
  task,
  defaultLogId,
  defaultImportance,
  defaultUrgency,
  onClose,
}: {
  visible: boolean;
  task?: Task | null;
  defaultLogId?: string | null;
  defaultImportance?: 'high' | 'low';
  defaultUrgency?: 'high' | 'low';
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
  const [ownership, setOwnership] = useState<Ownership | undefined>(undefined);
  const [ballHolder, setBallHolder] = useState('');
  const [nextCheck, setNextCheck] = useState<string | null>(null);
  const [criteria, setCriteria] = useState('');
  const [draftTone, setDraftTone] = useState<DraftTone>('polite');
  const [seed, setSeed] = useState<string | null>(null);

  // Key includes the defaults so opening "add to A" then "add to B" re-seeds.
  const key = (visible ? 'open' : 'closed') + ':' + (task?.id ?? 'new') + ':' + (defaultImportance ?? '') + (defaultUrgency ?? '');
  if (key !== seed && visible) {
    setSeed(key);
    setTitle(task?.title ?? '');
    setStatus(task?.status ?? 'todo');
    setDue(task?.dueDate ?? null);
    setRepeat(task?.repeat ?? 'none');
    setImportance(task?.importance ?? defaultImportance);
    setUrgency(task?.urgency ?? defaultUrgency);
    setCategory(task?.category);
    setMemo(task?.memo ?? '');
    setOwnership(task?.ownership);
    setBallHolder(task?.ballHolder ?? '');
    setNextCheck(task?.nextCheckDate ?? null);
    setCriteria(task?.completionCriteria ?? '');
    setDraftTone('polite');
  }

  const holding = status === 'hold';
  const handsOff = ownership === 'ask' || ownership === 'delegate';
  // C象限（緊急 高 × 重要 低）は「任せる」候補。片方向の提案だけで、上書きはしない。
  const suggestDelegate = !ownership && importance === 'low' && urgency === 'high';

  function pickOwnership(k: Ownership) {
    if (ownership === k) {
      setOwnership(undefined);
      return;
    }
    setOwnership(k);
    if (status === 'hold') setStatus('todo');
  }

  function toggleHold() {
    setStatus(holding ? 'todo' : 'hold');
  }

  function shareDraft() {
    const t = {
      title: title.trim(),
      memo: memo.trim(),
      ownership,
      ballHolder: ballHolder.trim(),
      completionCriteria: criteria.trim(),
      dueDate: due,
    } as Task;
    void Share.share({ message: composeRequest(t, draftTone) });
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
      ownership,
      ballHolder: ballHolder.trim() || undefined,
      nextCheckDate: nextCheck,
      completionCriteria: criteria.trim() || undefined,
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

      {/* 4分類: 自分で実行するかを先に決める。「今はやらない」は保留ステータスと同じもの */}
      <View style={{ gap: spacing.xs }}>
        <Text style={type.label}>どう扱うか</Text>
        <View style={styles.row}>
          {OWNERSHIPS.map((o) => (
            <Chip key={o.key} label={o.label} tone={o.tone} active={ownership === o.key && !holding} onPress={() => pickOwnership(o.key)} />
          ))}
          <Chip label="今はやらない" tone="neutral" active={holding} onPress={toggleHold} />
        </View>
        <Text style={type.muted}>
          {holding
            ? HOLD_HINT
            : ownership
              ? OWNERSHIPS.find((o) => o.key === ownership)?.hint
              : suggestDelegate
                ? '緊急だけれど重要度が低いタスクは、「誰かに任せる」の候補です。'
                : '責任を持つことと、自分で実行することは分けられます。'}
        </Text>
      </View>

      {handsOff && !holding ? (
        <>
          <Field
            label={ownership === 'ask' ? '聞く相手' : '任せる相手'}
            placeholder="名前（渡したらこの人がボールを持ちます）"
            value={ballHolder}
            onChangeText={setBallHolder}
          />
          <Field
            label="完了条件（任意）"
            placeholder="「〜の状態になっていること」の形だと渡しやすい"
            value={criteria}
            onChangeText={setCriteria}
            multiline
          />
        </>
      ) : null}

      {handsOff || holding ? (
        <DatePickerRow
          label={holding ? '再確認する日' : '次回確認日'}
          hint={holding ? undefined : '次にこのタスクを見る日。催促のタイミングになります。'}
          value={nextCheck}
          onChange={setNextCheck}
        />
      ) : null}

      {handsOff && !holding && ballHolder.trim() && title.trim() ? (
        <View style={{ gap: spacing.xs }}>
          <Text style={type.label}>{ownership === 'ask' ? '質問文の下書き' : '依頼文の下書き'}</Text>
          <View style={styles.row}>
            {DRAFT_TONES.map((tn) => (
              <Chip key={tn.key} label={tn.label} tone="primary" active={draftTone === tn.key} onPress={() => setDraftTone(tn.key)} />
            ))}
          </View>
          <Button label="下書きを共有・コピー" variant="ghost" onPress={shareDraft} />
          <Text style={type.muted}>下書きです。相手との関係に合わせて直してから送ってください。</Text>
        </View>
      ) : null}

      <View style={{ gap: spacing.xs }}>
        <Text style={type.label}>ステータス</Text>
        <View style={styles.row}>
          {TASK_STATUSES.map((s) => (
            <Chip key={s.key} label={s.label} tone={s.tone} active={status === s.key} onPress={() => setStatus(s.key)} />
          ))}
        </View>
      </View>

      <DatePickerRow label="期限" value={due} onChange={setDue} />

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

function DatePickerRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
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
      <Text style={type.label}>{label}</Text>
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
      {hint ? <Text style={type.muted}>{hint}</Text> : null}
    </View>
  );
}

const styles = {
  row: { flexDirection: 'row' as const, gap: spacing.sm, flexWrap: 'wrap' as const },
};
