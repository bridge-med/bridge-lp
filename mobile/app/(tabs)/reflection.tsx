import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BannerSlot } from '../../components/BannerSlot';
import { useColors } from '../../components/ThemeProvider';
import { Button, Card, EmptyState } from '../../components/ui';
import { AiError, generateReflection } from '../../lib/ai';
import { reflections, workLogs } from '../../lib/data';
import { formatDateJa, monthRangeKeys, startOfWeekKey, todayKey } from '../../lib/date';
import { usePrefs } from '../../lib/prefs';
import { useCollection } from '../../lib/store';
import { colors, spacing, type } from '../../lib/theme';
import type { Reflection, ReflectionContent, ReflectionPeriod } from '../../lib/types';

const FIELDS: { key: keyof ReflectionContent; label: string }[] = [
  { key: 'did', label: '今週やったこと' },
  { key: 'impressive', label: '印象に残った出来事' },
  { key: 'issues', label: '課題' },
  { key: 'improved', label: '改善したこと' },
  { key: 'next', label: '次にやること' },
  { key: 'strengths', label: '強みとして見えてきたこと' },
  { key: 'achievements', label: '職務経歴書に使えそうな実績候補' },
];

export default function ReflectionScreen() {
  const c = useColors();
  const logs = useCollection(workLogs);
  const refs = useCollection(reflections);
  const { geminiApiKey } = usePrefs();
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const sorted = useMemo(() => [...refs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [refs]);

  async function generate(period: ReflectionPeriod) {
    const { start, end } =
      period === 'week' ? { start: startOfWeekKey(), end: todayKey() } : monthRangeKeys();
    const inRange = logs.filter((l) => l.date >= start && l.date <= end);
    if (inRange.length === 0) {
      Alert.alert('ログがありません', `${period === 'week' ? '今週' : '今月'}の仕事ログがありません。まずログを残しましょう。`);
      return;
    }
    setBusy(true);
    try {
      const content = await generateReflection(inRange, geminiApiKey || null);
      const saved = await reflections.upsert({
        periodType: period,
        startDate: start,
        endDate: end,
        content,
        aiGenerated: !!geminiApiKey,
      } as Partial<Reflection>);
      setExpanded(saved.id);
    } catch (e) {
      Alert.alert('生成に失敗', e instanceof AiError ? e.message : '予期しないエラーが発生しました。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, paddingBottom: 110, gap: spacing.md }}>
      <Card style={{ gap: spacing.md }}>
        <Text style={type.h2}>振り返りをつくる</Text>
        <Text style={type.muted}>
          期間の仕事ログから自動でまとめます。{geminiApiKey ? 'AI（Gemini）で生成します。' : 'AIキー未設定のため、ログを整理したモックで生成します（設定で精度UP）。'}
        </Text>
        {busy ? (
          <View style={styles.loading}>
            <ActivityIndicator color={c.primary} />
            <Text style={type.muted}>まとめています…</Text>
          </View>
        ) : (
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Button label="今週" onPress={() => generate('week')} />
            </View>
            <View style={{ flex: 1 }}>
              <Button label="今月" variant="ghost" onPress={() => generate('month')} />
            </View>
          </View>
        )}
      </Card>

      {sorted.length === 0 ? (
        <EmptyState icon="📊" title="まだ振り返りがありません" hint="上のボタンで、今週の振り返りをつくってみましょう。" />
      ) : (
        sorted.map((r) => (
          <Pressable key={r.id} onPress={() => setExpanded(expanded === r.id ? null : r.id)}>
            <Card style={{ gap: spacing.sm }}>
              <View style={styles.head}>
                <Text style={[type.body, { fontWeight: '700' }]}>
                  {r.periodType === 'week' ? '週次' : '月次'}の振り返り
                </Text>
                <Text style={type.muted}>
                  {formatDateJa(r.startDate)}〜{formatDateJa(r.endDate)}
                </Text>
              </View>
              {expanded === r.id ? (
                <View style={{ gap: spacing.md, marginTop: spacing.xs }}>
                  {FIELDS.map((f) => (
                    <View key={f.key} style={{ gap: 2 }}>
                      <Text style={[type.label, { color: c.primary }]}>{f.label}</Text>
                      <Text style={type.body}>{r.content[f.key] || '—'}</Text>
                    </View>
                  ))}
                  <Button label="削除" variant="danger" onPress={() => void reflections.remove(r.id)} />
                </View>
              ) : (
                <Text style={type.muted} numberOfLines={2}>
                  {r.content.did || 'タップして表示'}
                </Text>
              )}
            </Card>
          </Pressable>
        ))
      )}

      <BannerSlot />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
