import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlockHeader } from '../components/BlockHeader';
import { useColors } from '../components/ThemeProvider';
import { Button, Card } from '../components/ui';
import { AiError, localWorkStyle } from '../lib/ai';
import { credits, GEN_COST_HEAVY, useCoins } from '../lib/credits';
import { workLogs } from '../lib/data';
import { moduleCollection } from '../lib/modules';
import { prefs, usePrefs } from '../lib/prefs';
import { useCollection } from '../lib/store';
import { colors, spacing, type } from '../lib/theme';

export default function WorkStyleScreen() {
  const c = useColors();
  const p = usePrefs();
  const coins = useCoins();
  const logs = useCollection(workLogs);
  const strengths = useCollection(moduleCollection('strengths'));
  const values = useCollection(moduleCollection('values'));
  const [busy, setBusy] = useState(false);

  function material(): string {
    const lg = [...logs]
      .sort((a, b) => (b.date < a.date ? -1 : 1))
      .slice(0, 12)
      .map((l) => `${l.title} ${l.did} ${l.learning} ${l.tags.join(' ')}`.trim())
      .filter(Boolean)
      .join('\n');
    const st = strengths.map((s) => `強み: ${s.title ?? ''}`).join('\n');
    const va = values.map((v) => `価値観: ${v.title ?? ''}`).join('\n');
    return [lg, st, va].filter(Boolean).join('\n');
  }

  async function analyze() {
    const mat = material();
    if (!mat.trim()) {
      Alert.alert('材料が足りません', '仕事ログや強みを少し記録すると、精度が上がります。');
      return;
    }
    if (!(await credits.spend(GEN_COST_HEAVY))) {
      Alert.alert('コインが足りません', '分析には2コイン必要です。', [
        { text: '閉じる', style: 'cancel' },
        { text: 'コインを見る', onPress: () => router.push('/coins') },
      ]);
      return;
    }
    setBusy(true);
    try {
      const result = localWorkStyle(mat);
      await prefs.set({ workStyleResult: result });
    } catch (e) {
      Alert.alert('分析に失敗', e instanceof AiError ? e.message : '予期しないエラーが発生しました。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <BlockHeader wordmark="ANALYSIS" title="働き方タイプ" onBack pad={24} />
        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <Text style={type.muted}>
            日々の仕事ログ・強み・価値観から、あなたの「働き方タイプ」をまとめます。記録が増えるほど深まります。1回2コイン・残り {coins} コイン。
          </Text>

          {p.workStyleResult ? (
            <Card style={{ gap: spacing.xs }}>
              <Text style={type.body}>{p.workStyleResult}</Text>
            </Card>
          ) : null}

          {busy ? (
            <View style={styles.loading}>
              <ActivityIndicator color={c.primary} />
              <Text style={type.muted}>分析しています…</Text>
            </View>
          ) : (
            <Button label={p.workStyleResult ? '分析し直す（2コイン）' : '分析する（2コイン）'} onPress={analyze} />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md },
});
