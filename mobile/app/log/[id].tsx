import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TaskSheet } from '../../components/TaskSheet';
import { useColors } from '../../components/ThemeProvider';
import { Button, Chip, EmptyState } from '../../components/ui';
import { tasks, workLogs } from '../../lib/data';
import { parseKey } from '../../lib/date';
import { TASK_STATUS_LABEL } from '../../lib/constants';
import { useCollection } from '../../lib/store';
import { colors, fonts, spacing, type } from '../../lib/theme';
import type { WorkLog } from '../../lib/types';

const WD = ['日', '月', '火', '水', '木', '金', '土'];

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
  const dd = parseKey(log.date);

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: '仕事ログ' }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
        <View style={styles.hero}>
          <Text style={[styles.weekday, { color: c.primary }]}>{WD[dd.getDay()]}</Text>
          <Text style={styles.date}>{dd.getMonth() + 1}月{dd.getDate()}日</Text>
        </View>
        <Text style={styles.title}>{log.title || '無題のログ'}</Text>
        {log.tags.length > 0 ? (
          <View style={styles.tags}>
            {log.tags.map((t) => (
              <Chip key={t} label={t} tone="primary" active />
            ))}
          </View>
        ) : null}
        <View style={styles.rule} />

        {FIELDS.filter((f) => (log[f.key] as string)?.trim?.()).map((f) => (
          <View key={f.key} style={styles.field}>
            <Text style={[type.label, { color: c.primary }]}>{f.label}</Text>
            <Text style={[type.body, { marginTop: 4 }]}>{log[f.key] as string}</Text>
          </View>
        ))}

        <View style={[styles.field, { paddingTop: spacing.lg }]}>
          <Text style={type.label}>関連タスク</Text>
          {related.length === 0 ? (
            <Text style={[type.muted, { marginTop: 4 }]}>まだありません</Text>
          ) : (
            related.map((t) => (
              <View key={t.id} style={styles.taskRow}>
                <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>
                  {t.title}
                </Text>
                <Chip label={TASK_STATUS_LABEL[t.status]} tone={t.status === 'done' ? 'accent' : 'neutral'} active />
              </View>
            ))
          )}
          <View style={{ marginTop: spacing.md }}>
            <Button label="このログからタスク作成" variant="ghost" onPress={() => setTaskOpen(true)} />
          </View>
        </View>

        <View style={{ marginTop: spacing.xl }}>
          <Button label="編集する" onPress={() => router.push({ pathname: '/log-edit', params: { id: log.id } })} />
        </View>
      </ScrollView>

      <TaskSheet visible={taskOpen} defaultLogId={log.id} onClose={() => setTaskOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  hero: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  weekday: { fontFamily: fonts.minchoSemi, fontSize: 22 },
  date: { fontFamily: fonts.mincho, fontSize: 32, color: colors.text },
  title: { fontFamily: fonts.gothicBold, fontSize: 22, color: colors.text, lineHeight: 32, marginTop: spacing.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginTop: spacing.lg },
  field: { paddingTop: spacing.lg },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
});
