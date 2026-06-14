import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TaskSheet } from '../../components/TaskSheet';
import { useColors } from '../../components/ThemeProvider';
import { Button, Card, Chip, EmptyState } from '../../components/ui';
import { tasks, workLogs } from '../../lib/data';
import { formatDateJa } from '../../lib/date';
import { TASK_STATUS_LABEL } from '../../lib/constants';
import { useCollection } from '../../lib/store';
import { colors, spacing, type } from '../../lib/theme';
import type { WorkLog } from '../../lib/types';

const FIELDS: { key: keyof WorkLog; label: string }[] = [
  { key: 'did', label: '今日やったこと' },
  { key: 'problem', label: '困ったこと' },
  { key: 'devised', label: '工夫したこと' },
  { key: 'decision', label: '自分の判断' },
  { key: 'people', label: '誰と関わったか' },
  { key: 'result', label: '結果' },
  { key: 'learning', label: '学び' },
  { key: 'nextAction', label: '次にやること' },
  { key: 'memo', label: '自由メモ' },
];

export default function LogDetailScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const logs = useCollection(workLogs);
  const allTasks = useCollection(tasks);
  const [taskOpen, setTaskOpen] = useState(false);
  const log = logs.find((l) => l.id === id);

  if (!log) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: '仕事ログ' }} />
        <EmptyState icon="alert-circle" title="ログが見つかりません" />
      </View>
    );
  }

  const related = allTasks.filter((t) => t.relatedLogId === log.id);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '仕事ログ' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl }}>
        <View style={{ gap: 4 }}>
          <Text style={type.muted}>{formatDateJa(log.date)}</Text>
          <Text style={styles.title}>{log.title || '無題のログ'}</Text>
        </View>

        {log.tags.length > 0 ? (
          <View style={styles.tags}>
            {log.tags.map((t) => (
              <Chip key={t} label={t} tone="primary" />
            ))}
          </View>
        ) : null}

        {FIELDS.filter((f) => (log[f.key] as string)?.trim?.()).map((f) => (
          <Card key={f.key} style={{ gap: 4 }}>
            <Text style={[type.label, { color: c.primary }]}>{f.label}</Text>
            <Text style={type.body}>{log[f.key] as string}</Text>
          </Card>
        ))}

        <View style={{ gap: spacing.sm }}>
          <Text style={type.label}>関連タスク</Text>
          {related.length === 0 ? (
            <Text style={type.muted}>まだありません</Text>
          ) : (
            related.map((t) => (
              <Card key={t.id} style={styles.taskRow}>
                <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>
                  {t.title}
                </Text>
                <Chip label={TASK_STATUS_LABEL[t.status]} tone={t.status === 'done' ? 'accent' : 'neutral'} />
              </Card>
            ))
          )}
          <Button label="このログからタスク作成" variant="ghost" onPress={() => setTaskOpen(true)} />
        </View>

        <View style={{ height: spacing.sm }} />
        <Button label="編集" onPress={() => router.push({ pathname: '/log-edit', params: { id: log.id } })} />
      </ScrollView>

      <TaskSheet visible={taskOpen} defaultLogId={log.id} onClose={() => setTaskOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
