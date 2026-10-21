import { Feather } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '../../components/Sheet';
import { TaskSheet } from '../../components/TaskSheet';
import { useColors } from '../../components/ThemeProvider';
import { Button, Chip, EmptyState, Field } from '../../components/ui';
import { addOutcome, analyzeLog, ASSET_KIND_LABEL, RISK_LABEL, worthAnalyzing } from '../../lib/assetize';
import { assetCandidates, logInsights, tasks, workLogs } from '../../lib/data';
import { parseKey } from '../../lib/date';
import { TASK_STATUS_LABEL } from '../../lib/constants';
import { progress } from '../../lib/progress';
import { useCollection } from '../../lib/store';
import { colors, fonts, radius, spacing, type } from '../../lib/theme';
import type { InsightStrength, RiskLevel, WorkLog } from '../../lib/types';

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

const STRENGTH_META: Record<InsightStrength, { label: string; tone: 'neutral' | 'primary' | 'accent' }> = {
  weak: { label: '実績としては弱め', tone: 'neutral' },
  normal: { label: '実績', tone: 'primary' },
  strong: { label: '強い実績', tone: 'accent' },
};

const RISK_TONE: Record<RiskLevel, 'accent' | 'warn' | 'danger'> = { low: 'accent', medium: 'warn', high: 'danger' };

export default function LogDetailScreen() {
  const c = useColors();
  const { id, fresh } = useLocalSearchParams<{ id: string; fresh?: string }>();
  const logs = useCollection(workLogs);
  const allTasks = useCollection(tasks);
  const insights = useCollection(logInsights);
  const candidates = useCollection(assetCandidates);
  const [taskOpen, setTaskOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [outcomeOpen, setOutcomeOpen] = useState(false);
  const [outcomeDraft, setOutcomeDraft] = useState('');
  const autoFired = useRef(false);

  const log = logs.find((l) => l.id === id);
  const insight = insights.find((i) => i.logId === id);
  const related = candidates.filter((a) => a.sourceLogIds.includes(id ?? ''));

  async function runAnalysis(l: WorkLog) {
    setBusy(true);
    try {
      await analyzeLog(l);
    } catch (e) {
      Alert.alert('分析に失敗しました', e instanceof Error ? e.message : '時間をおいて再度お試しください。');
    } finally {
      setBusy(false);
    }
  }

  // 保存直後（fresh=1）は自動で資産化分析を開始する（入力は1回だけ）。
  useEffect(() => {
    if (fresh === '1' && log && !insight && !autoFired.current) {
      autoFired.current = true;
      void runAnalysis(log);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh, log?.id, insight?.id]);

  if (!log) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: '仕事ログ' }} />
        <EmptyState icon="alert-circle" title="ログが見つかりません" />
      </View>
    );
  }

  const relatedTasks = allTasks.filter((t) => t.relatedLogId === log.id);
  const dd = parseKey(log.date);

  async function saveOutcome() {
    if (!insight) return;
    await addOutcome(insight, outcomeDraft);
    void progress.recordActivity('outcome');
    setOutcomeOpen(false);
    setOutcomeDraft('');
  }

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

        {/* ===== AI資産化分析 ===== */}
        <View style={[styles.insightCard, { borderColor: c.primaryWeak }]}>
          <View style={styles.insightHead}>
            <Feather name="zap" size={16} color={c.primary} />
            <Text style={[styles.insightTitle, { color: c.primary }]}>資産化分析</Text>
            {insight?.source === 'local' ? <Text style={[type.muted, { fontSize: 10 }]}>簡易分析</Text> : null}
          </View>

          {busy ? (
            <View style={{ alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm }}>
              <ActivityIndicator color={c.primary} />
              <Text style={type.muted}>この経験の資産化ポイントを分析中…</Text>
            </View>
          ) : !insight ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={[type.muted, { color: colors.text2 }]}>
                この経験から「実績・スキル・面接エピソード・発信ネタ」をAIが抽出します。
              </Text>
              <Button label="資産化ポイントを分析する" onPress={() => void runAnalysis(log)} disabled={!worthAnalyzing(log)} />
              {!worthAnalyzing(log) ? <Text style={type.muted}>内容が少ないため分析できません。もう少し記録すると分析できます。</Text> : null}
            </View>
          ) : (
            <View style={{ gap: spacing.md }}>
              {/* 実績表現 */}
              <View>
                <View style={styles.rowBetween}>
                  <Text style={type.label}>キャリア実績</Text>
                  <Chip label={STRENGTH_META[insight.strength].label} tone={STRENGTH_META[insight.strength].tone} active />
                </View>
                <Text style={[type.bodyMed, { marginTop: 4 }]}>{insight.achievement}</Text>
                {insight.strengthNote ? <Text style={[type.muted, { marginTop: 2 }]}>{insight.strengthNote}</Text> : null}
              </View>

              {/* スキル */}
              {insight.skills.length ? (
                <View>
                  <Text style={type.label}>スキル</Text>
                  <View style={[styles.tags, { marginTop: 6 }]}>
                    {insight.skills.map((s) => (
                      <Chip key={s} label={s} tone="accent" active />
                    ))}
                  </View>
                </View>
              ) : null}

              {/* STAR */}
              <View>
                <Text style={type.label}>面接で話すなら（STAR）</Text>
                {(
                  [
                    ['S 状況', insight.star.s],
                    ['T 課題', insight.star.t],
                    ['A 行動', insight.star.a],
                  ] as const
                ).map(([lbl, val]) =>
                  val ? (
                    <View key={lbl} style={styles.starRow}>
                      <Text style={[styles.starKey, { color: c.primary }]}>{lbl}</Text>
                      <Text style={[type.body, { flex: 1 }]}>{val}</Text>
                    </View>
                  ) : null,
                )}
                <View style={styles.starRow}>
                  <Text style={[styles.starKey, { color: c.primary }]}>R 成果</Text>
                  {insight.star.resultMissing ? (
                    <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                      <Chip label="成果未入力" tone="warn" active />
                      <Pressable onPress={() => setOutcomeOpen(true)} hitSlop={6}>
                        <Text style={[type.bodyMed, { color: c.primary }]}>成果を追記 →</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={[type.body, { flex: 1 }]}>{insight.star.r}</Text>
                  )}
                </View>
                {insight.outcome ? (
                  <Text style={[type.muted, { marginTop: 4 }]}>成果追記: {insight.outcome.addedAt.slice(0, 10)}</Text>
                ) : null}
              </View>

              {/* 公開リスク */}
              <View>
                <View style={styles.rowBetween}>
                  <Text style={type.label}>公開リスク</Text>
                  <Chip label={`リスク ${RISK_LABEL[insight.risk.level]}`} tone={RISK_TONE[insight.risk.level]} active />
                </View>
                {insight.risk.notes.map((n, i) => (
                  <Text key={i} style={[type.muted, { marginTop: 2 }]}>・{n}</Text>
                ))}
                <Text style={[type.muted, { marginTop: 4, fontSize: 10 }]}>
                  ※公開前確認の支援です。最終的な公開可否はご自身でご判断ください。
                </Text>
              </View>

              {/* 資産候補 */}
              {related.length ? (
                <View>
                  <Text style={type.label}>この経験から生まれた資産候補</Text>
                  {related.map((a) => (
                    <Pressable key={a.id} onPress={() => router.push(`/asset/${a.id}`)} style={[styles.assetRow, { borderColor: colors.line }]}>
                      <Chip label={ASSET_KIND_LABEL[a.kind]} tone="primary" active />
                      <Text style={[type.bodyMed, { flex: 1 }]} numberOfLines={1}>{a.title}</Text>
                      <Feather name="chevron-right" size={16} color={colors.line2} />
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <Button label="再分析する" variant="ghost" onPress={() => void runAnalysis(log)} />
            </View>
          )}
        </View>

        <View style={[styles.field, { paddingTop: spacing.lg }]}>
          <Text style={type.label}>関連タスク</Text>
          {relatedTasks.length === 0 ? (
            <Text style={[type.muted, { marginTop: 4 }]}>まだありません</Text>
          ) : (
            relatedTasks.map((t) => (
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

        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <Button label="このログを語学で学ぶ" variant="ghost" onPress={() => router.push({ pathname: '/lang', params: { logId: log.id } })} />
          <Button label="編集する" onPress={() => router.push({ pathname: '/log-edit', params: { id: log.id } })} />
        </View>
      </ScrollView>

      <TaskSheet visible={taskOpen} defaultLogId={log.id} onClose={() => setTaskOpen(false)} />

      <Sheet visible={outcomeOpen} title="成果を追記" onClose={() => setOutcomeOpen(false)}>
        <Text style={[type.muted, { color: colors.text2 }]}>
          この仕事、その後どうなりましたか？（例: 作業時間が30%減った / 手順が標準化された）
        </Text>
        <Field placeholder="結果・成果を入力" value={outcomeDraft} onChangeText={setOutcomeDraft} multiline autoFocus />
        <Button label="保存する" onPress={() => void saveOutcome()} disabled={!outcomeDraft.trim()} />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  hero: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  weekday: { fontFamily: fonts.maruMed, fontSize: 22 },
  date: { fontFamily: fonts.maruBlack, fontSize: 32, color: colors.text },
  title: { fontFamily: fonts.gothicBold, fontSize: 22, color: colors.text, lineHeight: 32, marginTop: spacing.sm },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.md },
  rule: { height: StyleSheet.hairlineWidth, backgroundColor: colors.line, marginTop: spacing.lg },
  field: { paddingTop: spacing.lg },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  insightCard: { marginTop: spacing.xl, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, padding: spacing.md },
  insightHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing.sm },
  insightTitle: { fontFamily: fonts.maru, fontSize: 16 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  starRow: { flexDirection: 'row', gap: spacing.sm, marginTop: 6, alignItems: 'flex-start' },
  starKey: { fontFamily: fonts.gothicBold, fontSize: 12, width: 44, marginTop: 2 },
  assetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 4 },
});
