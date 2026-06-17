import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AiTaskSheet } from '../../components/AiTaskSheet';
import { BlockHeader } from '../../components/BlockHeader';
import { SwipeRow } from '../../components/SwipeRow';
import { TaskSheet } from '../../components/TaskSheet';
import { useColors } from '../../components/ThemeProvider';
import { Chip, EmptyState, Fab } from '../../components/ui';
import { TASK_REPEATS, TASK_STATUSES, type TaskStatus } from '../../lib/constants';
import { tasks } from '../../lib/data';
import { addPeriod, dueLabel, todayKey } from '../../lib/date';
import { tapSuccess } from '../../lib/haptics';
import { QUADRANTS, quadrantOf, type Quadrant } from '../../lib/matrix';
import { progress } from '../../lib/progress';
import { useCollection } from '../../lib/store';
import { colors, fonts, radius, spacing, type } from '../../lib/theme';
import type { Task } from '../../lib/types';

const ORDER: TaskStatus[] = ['doing', 'todo', 'hold', 'done'];

const byDue = (a: Task, b: Task) => {
  if (!!a.dueDate !== !!b.dueDate) return a.dueDate ? -1 : 1;
  if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
  return b.createdAt < a.createdAt ? -1 : 1;
};

export default function TasksScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const all = useCollection(tasks);
  const [editing, setEditing] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [view, setView] = useState<'list' | 'matrix'>('list');

  const groups = useMemo(() => {
    return ORDER.map((status) => ({
      status,
      label: TASK_STATUSES.find((s) => s.key === status)!.label,
      items: all.filter((t) => t.status === status).sort(byDue),
    })).filter((g) => g.items.length > 0);
  }, [all]);

  const matrix = useMemo(() => {
    const byQ: Record<Quadrant, Task[]> = { A: [], B: [], C: [], D: [] };
    const unclassified: Task[] = [];
    for (const t of all) {
      if (t.status === 'done') continue;
      const q = quadrantOf(t);
      if (q) byQ[q].push(t);
      else unclassified.push(t);
    }
    (Object.keys(byQ) as Quadrant[]).forEach((k) => byQ[k].sort(byDue));
    unclassified.sort(byDue);
    return { byQ, unclassified };
  }, [all]);

  function quickComplete(t: Task) {
    const toDone = t.status !== 'done';
    if (toDone) {
      tapSuccess();
      void progress.recordActivity('task');
      const rep = t.repeat ?? 'none';
      if (rep !== 'none') {
        const today = todayKey();
        const base = t.dueDate && t.dueDate >= today ? t.dueDate : today;
        void tasks.upsert({
          title: t.title,
          memo: t.memo,
          status: 'todo',
          dueDate: addPeriod(base, rep),
          repeat: rep,
          importance: t.importance,
          urgency: t.urgency,
          relatedLogId: t.relatedLogId,
          doneAt: null,
        } as Partial<Task>);
      }
    }
    void tasks.upsert({ id: t.id, status: toDone ? 'done' : 'todo', doneAt: toDone ? new Date().toISOString() : null } as Partial<Task>);
  }

  function edit(t: Task) {
    setEditing(t);
    setOpen(true);
  }

  const toneColor = (tone: (typeof QUADRANTS)[number]['tone']) =>
    tone === 'danger' ? { tint: c.danger, weak: c.dangerWeak }
    : tone === 'primary' ? { tint: c.primary, weak: c.primaryWeak }
    : tone === 'warn' ? { tint: c.warn, weak: c.warnWeak }
    : { tint: c.muted, weak: c.surface2 };

  function CompactRow({ t }: { t: Task }) {
    const due = dueLabel(t.dueDate);
    const dueColor = due?.tone === 'overdue' ? c.danger : due?.tone === 'today' ? c.primary : c.muted;
    return (
      <View style={styles.mrow}>
        <Pressable onPress={() => quickComplete(t)} hitSlop={6} style={[styles.mcheck, { borderColor: c.line2 }]} />
        <Pressable style={{ flex: 1 }} onPress={() => edit(t)}>
          <Text style={styles.mtitle} numberOfLines={2}>{t.title}</Text>
          {t.memo ? <Text style={styles.mmemo} numberOfLines={2}>{t.memo}</Text> : null}
          {due ? <Text style={[styles.mdue, { color: dueColor }]}>🕒 {due.text}</Text> : null}
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        <BlockHeader wordmark="TASKS" title="タスク" subtitle={`未完了 ${all.filter((t) => t.status !== 'done').length}・全 ${all.length}`} pad={24} />

        <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.lg }}>
          <View style={styles.seg}>
            {(['list', 'matrix'] as const).map((m) => (
              <Pressable key={m} onPress={() => setView(m)} style={[styles.segBtn, view === m && { backgroundColor: c.primary }]}>
                <Feather name={m === 'list' ? 'list' : 'grid'} size={14} color={view === m ? '#fff' : colors.text2} />
                <Text style={[styles.segText, { color: view === m ? '#fff' : colors.text2 }]}>{m === 'list' ? 'リスト' : 'マトリクス'}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        {view === 'list' ? (
          <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingTop: spacing.md }}>
            <Pressable onPress={() => setAiOpen(true)} style={[styles.aiBtn, { borderColor: c.primary }]}>
              <Feather name="zap" size={15} color={c.primary} />
              <Text style={[styles.aiBtnText, { color: c.primary }]}>文章からまとめて追加</Text>
            </Pressable>

            {all.length === 0 ? (
              <EmptyState icon="check-square" title="タスクはありません" hint="右下の＋から追加。「まとめて追加」で文章から一括登録もできます。" />
            ) : (
              groups.map((g) => (
                <View key={g.status} style={{ gap: spacing.sm }}>
                  <Text style={styles.sectionHead}>
                    {g.label} <Text style={styles.count}>{g.items.length}</Text>
                  </Text>
                  {g.items.map((t) => {
                    const due = dueLabel(t.dueDate);
                    const done = t.status === 'done';
                    const dueTone = due?.tone === 'overdue' ? 'danger' : due?.tone === 'today' ? 'primary' : 'warn';
                    const rep = t.repeat ?? 'none';
                    const repLabel = rep !== 'none' ? TASK_REPEATS.find((r) => r.key === rep)?.label : null;
                    return (
                      <SwipeRow key={t.id} onDelete={() => void tasks.remove(t.id)}>
                        <View style={styles.row}>
                          <Pressable onPress={() => quickComplete(t)} hitSlop={8} style={[styles.checkbox, { borderColor: c.line2 }, done && { backgroundColor: c.primary, borderColor: c.primary }]}>
                            {done ? <Feather name="check" size={14} color="#fff" /> : null}
                          </Pressable>
                          <Pressable style={{ flex: 1 }} onPress={() => edit(t)}>
                            <Text style={[type.bodyMed, done && styles.doneText]} numberOfLines={2}>
                              {t.title}
                            </Text>
                            {(due && !done) || repLabel || t.memo ? (
                              <View style={styles.meta}>
                                {due && !done ? <Chip label={due.text} tone={dueTone} /> : null}
                                {repLabel ? (
                                  <View style={styles.repeat}>
                                    <Feather name="repeat" size={11} color={c.primary} />
                                    <Text style={[type.muted, { color: c.primary }]}>{repLabel}</Text>
                                  </View>
                                ) : null}
                                {t.memo ? <Text style={type.muted} numberOfLines={1}>{t.memo}</Text> : null}
                              </View>
                            ) : null}
                          </Pressable>
                        </View>
                      </SwipeRow>
                    );
                  })}
                </View>
              ))
            )}
          </View>
        ) : (
          <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
            <Text style={[type.muted, { marginBottom: spacing.sm }]}>重要度を設定すると自動で振り分け（緊急度は期限から自動判定／手動指定も可）。</Text>
            <View style={styles.grid}>
              {QUADRANTS.map((q) => {
                const items = matrix.byQ[q.key];
                const { tint, weak } = toneColor(q.tone);
                return (
                  <View key={q.key} style={[styles.cell, { borderColor: tint }]}>
                    <View style={[styles.cellHead, { backgroundColor: weak }]}>
                      <View style={[styles.qBadge, { backgroundColor: tint }]}>
                        <Text style={styles.qLetter}>{q.key}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.qLabel, { color: tint }]}>{q.label}</Text>
                        <Text style={[type.muted, { fontSize: 10 }]}>{q.sub}</Text>
                      </View>
                      <Text style={[styles.qCount, { color: tint }]}>{items.length}</Text>
                    </View>
                    <View style={styles.cellBody}>
                      {items.length ? items.map((t) => <CompactRow key={t.id} t={t} />) : <Text style={styles.cellEmpty}>なし</Text>}
                    </View>
                  </View>
                );
              })}
            </View>

            {matrix.unclassified.length ? (
              <View style={{ marginTop: spacing.lg, gap: spacing.sm }}>
                <Text style={styles.sectionHead}>
                  未分類 <Text style={styles.count}>{matrix.unclassified.length}</Text>
                </Text>
                <Text style={[type.muted, { fontSize: 11 }]}>タップして「重要度」を設定すると、上の表に自動で並びます。</Text>
                {matrix.unclassified.map((t) => (
                  <Pressable key={t.id} onPress={() => edit(t)} style={styles.uRow}>
                    <Feather name="circle" size={14} color={colors.line2} />
                    <Text style={type.bodyMed} numberOfLines={1}>{t.title}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {all.filter((t) => t.status !== 'done').length === 0 ? (
              <EmptyState icon="grid" title="未完了タスクなし" hint="タスクを追加して、緊急度×重要度で整理しましょう。" />
            ) : null}
          </View>
        )}
      </ScrollView>

      <View style={{ position: 'absolute', right: 0, bottom: insets.bottom }}>
        <Fab onPress={() => { setEditing(null); setOpen(true); }} />
      </View>

      <TaskSheet visible={open} task={editing} onClose={() => setOpen(false)} />
      <AiTaskSheet visible={aiOpen} onClose={() => setAiOpen(false)} onNeedKey={() => router.push('/settings')} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  seg: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.pill, padding: 3, gap: 3 },
  segBtn: { flex: 1, flexDirection: 'row', gap: 6, alignItems: 'center', justifyContent: 'center', height: 36, borderRadius: radius.pill },
  segText: { fontFamily: fonts.gothicMed, fontSize: 13 },
  aiBtn: { flexDirection: 'row', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  aiBtnText: { fontSize: 14, fontFamily: fonts.gothicMed },
  sectionHead: { ...type.label, color: colors.text2 },
  count: { fontFamily: fonts.maruMed, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: 14, backgroundColor: colors.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  doneText: { color: colors.muted, textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.sm, flexWrap: 'wrap' },
  repeat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  // matrix
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { width: '48%', flexGrow: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, overflow: 'hidden', minHeight: 120 },
  cellHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm },
  qBadge: { width: 26, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  qLetter: { fontFamily: fonts.maruBlack, fontSize: 15, color: '#fff' },
  qLabel: { fontFamily: fonts.maru, fontSize: 13 },
  qCount: { fontFamily: fonts.maruBlack, fontSize: 16 },
  cellBody: { padding: spacing.sm, gap: 2 },
  mrow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, paddingVertical: 6 },
  mcheck: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, marginTop: 1 },
  mtitle: { fontFamily: fonts.gothicMed, fontSize: 13, color: colors.text },
  mmemo: { fontFamily: fonts.gothic, fontSize: 11, color: colors.text2, marginTop: 1, lineHeight: 15 },
  mdue: { fontFamily: fonts.gothicMed, fontSize: 10, marginTop: 2 },
  cellEmpty: { fontFamily: fonts.gothic, fontSize: 12, color: colors.muted, paddingVertical: spacing.sm, textAlign: 'center' },
  uRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
