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
import { progress } from '../../lib/progress';
import { useCollection } from '../../lib/store';
import { colors, fonts, radius, spacing, type } from '../../lib/theme';
import type { Task } from '../../lib/types';

const ORDER: TaskStatus[] = ['doing', 'todo', 'hold', 'done'];

export default function TasksScreen() {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const all = useCollection(tasks);
  const [editing, setEditing] = useState<Task | null>(null);
  const [open, setOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const groups = useMemo(() => {
    return ORDER.map((status) => ({
      status,
      label: TASK_STATUSES.find((s) => s.key === status)!.label,
      items: all
        .filter((t) => t.status === status)
        .sort((a, b) => {
          if (!!a.dueDate !== !!b.dueDate) return a.dueDate ? -1 : 1;
          if (a.dueDate && b.dueDate && a.dueDate !== b.dueDate) return a.dueDate < b.dueDate ? -1 : 1;
          return b.createdAt < a.createdAt ? -1 : 1;
        }),
    })).filter((g) => g.items.length > 0);
  }, [all]);

  function quickComplete(t: Task) {
    const toDone = t.status !== 'done';
    if (toDone) {
      tapSuccess();
      void progress.recordActivity('task');
      const rep = t.repeat ?? 'none';
      if (rep !== 'none') {
        // Spawn the next occurrence; the completed one stays as history.
        const today = todayKey();
        const base = t.dueDate && t.dueDate >= today ? t.dueDate : today;
        void tasks.upsert({
          title: t.title,
          memo: t.memo,
          status: 'todo',
          dueDate: addPeriod(base, rep),
          repeat: rep,
          relatedLogId: t.relatedLogId,
          doneAt: null,
        } as Partial<Task>);
      }
    }
    void tasks.upsert({ id: t.id, status: toDone ? 'done' : 'todo', doneAt: toDone ? new Date().toISOString() : null } as Partial<Task>);
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 110 }}>
        <BlockHeader wordmark="TASKS" title="タスク" subtitle={`未完了 ${all.filter((t) => t.status !== 'done').length}・全 ${all.length}`} pad={24} />
        <View style={{ paddingHorizontal: spacing.lg, gap: spacing.md, paddingTop: spacing.lg }}>
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
                      <Pressable style={{ flex: 1 }} onPress={() => { setEditing(t); setOpen(true); }}>
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
  aiBtn: { flexDirection: 'row', gap: 8, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' },
  aiBtnText: { fontSize: 14, fontFamily: fonts.gothicMed },
  sectionHead: { ...type.label, color: colors.text2 },
  count: { fontFamily: fonts.maruMed, color: colors.muted },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: 14, backgroundColor: colors.bg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  checkbox: { width: 24, height: 24, borderRadius: 12, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  doneText: { color: colors.muted, textDecorationLine: 'line-through' },
  meta: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginTop: spacing.sm, flexWrap: 'wrap' },
  repeat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
