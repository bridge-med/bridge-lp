import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { BlockHeader } from '../components/BlockHeader';
import { useColors } from '../components/ThemeProvider';
import { Button, Card, Chip, EmptyState } from '../components/ui';
import { AiError, generateCareerOutput } from '../lib/ai';
import { CAREER_OUTPUTS, type CareerOutputType } from '../lib/constants';
import { credits, GEN_COST, useCoins } from '../lib/credits';
import { careerOutputs, workLogs } from '../lib/data';
import { formatDateJa } from '../lib/date';
import { usePrefs } from '../lib/prefs';
import { useCollection } from '../lib/store';
import { colors, spacing, type } from '../lib/theme';
import type { CareerOutput } from '../lib/types';

export default function CareerScreen() {
  const c = useColors();
  const logs = useCollection(workLogs);
  const outputs = useCollection(careerOutputs);
  const coins = useCoins();
  const { profession, role, purpose } = usePrefs();
  const [outputType, setOutputType] = useState<CareerOutputType>('resume');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const sortedLogs = useMemo(() => [...logs].sort((a, b) => (a.date < b.date ? 1 : -1)), [logs]);
  const sortedOutputs = useMemo(() => [...outputs].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [outputs]);

  function toggle(idv: string) {
    setSelected((s) => (s.includes(idv) ? s.filter((x) => x !== idv) : [...s, idv]));
  }

  async function generate() {
    const chosen = sortedLogs.filter((l) => selected.includes(l.id));
    if (chosen.length === 0) {
      Alert.alert('ログを選択してください', '変換のもとにする仕事ログを1つ以上選んでください。');
      return;
    }
    if (!(await credits.spend(GEN_COST))) {
      Alert.alert('コインが足りません', '生成にはコインが必要です。', [
        { text: '閉じる', style: 'cancel' },
        { text: 'コインを見る', onPress: () => router.push('/coins') },
      ]);
      return;
    }
    setBusy(true);
    try {
      const content = await generateCareerOutput(chosen, outputType, { profession, role, purpose }, null);
      await careerOutputs.upsert({
        outputType,
        sourceLogIds: chosen.map((l) => l.id),
        content,
        aiGenerated: true,
      } as Partial<CareerOutput>);
      setSelected([]);
    } catch (e) {
      Alert.alert('生成に失敗', e instanceof AiError ? e.message : '予期しないエラーが発生しました。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xl }}>
      <BlockHeader wordmark="CAREER" title="キャリア変換" onBack pad={24} />
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
      <Card style={{ gap: spacing.md }}>
        <Text style={type.h2}>形式を選ぶ</Text>
        <View style={styles.chips}>
          {CAREER_OUTPUTS.map((o) => (
            <Chip key={o.key} label={o.label} tone="primary" active={outputType === o.key} onPress={() => setOutputType(o.key)} />
          ))}
        </View>
        <Text style={type.muted}>{CAREER_OUTPUTS.find((o) => o.key === outputType)?.desc}</Text>
      </Card>

      <View style={{ gap: spacing.sm }}>
        <Text style={type.label}>もとにする仕事ログ（{selected.length}件選択）</Text>
        {sortedLogs.length === 0 ? (
          <EmptyState icon="file-text" title="仕事ログがありません" hint="まずホームから仕事ログを残しましょう。" />
        ) : (
          sortedLogs.map((l) => (
            <Pressable key={l.id} onPress={() => toggle(l.id)}>
              <Card style={[styles.logRow, selected.includes(l.id) && { backgroundColor: c.primaryWeak, borderColor: c.primary }]}>
                <Text style={[styles.check, { color: selected.includes(l.id) ? c.primary : c.muted }]}>{selected.includes(l.id) ? '☑' : '☐'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[type.body, { fontWeight: '600' }]} numberOfLines={1}>{l.title || '無題のログ'}</Text>
                  <Text style={type.muted}>{formatDateJa(l.date)}</Text>
                </View>
              </Card>
            </Pressable>
          ))
        )}
      </View>

      {busy ? (
        <View style={styles.loading}>
          <ActivityIndicator color={c.primary} />
          <Text style={type.muted}>生成しています…</Text>
        </View>
      ) : (
        <Button label="生成する（1コイン）" onPress={generate} disabled={selected.length === 0} />
      )}
      <Text style={type.muted}>選んだ仕事ログから下書きを生成します。1回1コイン・残り {coins} コイン。</Text>

      {sortedOutputs.length > 0 ? (
        <View style={{ gap: spacing.sm, marginTop: spacing.sm }}>
          <Text style={type.label}>生成履歴</Text>
          {sortedOutputs.map((o) => (
            <Card key={o.id} style={{ gap: spacing.sm }}>
              <View style={styles.head}>
                <Chip label={CAREER_OUTPUTS.find((x) => x.key === o.outputType)?.label ?? ''} tone="primary" />
                <Text style={type.muted}>{formatDateJa(o.createdAt.slice(0, 10))}</Text>
              </View>
              <Text style={type.body}>{o.content}</Text>
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 1 }}>
                  <Button label="共有" variant="ghost" onPress={() => void Share.share({ message: o.content })} />
                </View>
                <View style={{ flex: 1 }}>
                  <Button label="削除" variant="danger" onPress={() => void careerOutputs.remove(o.id)} />
                </View>
              </View>
            </Card>
          ))}
        </View>
      ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  logRow: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  check: { fontSize: 20 },
  loading: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
