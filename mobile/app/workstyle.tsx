import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../components/ThemeProvider';
import { Button, Card } from '../components/ui';
import { AiError, generateWorkStyle, localWorkStyle } from '../lib/ai';
import { credits, GEN_COST } from '../lib/credits';
import { workLogs } from '../lib/data';
import { moduleCollection } from '../lib/modules';
import { activeAiKey, prefs, usePrefs } from '../lib/prefs';
import { useCollection } from '../lib/store';
import { colors, spacing, type } from '../lib/theme';

export default function WorkStyleScreen() {
  const c = useColors();
  const p = usePrefs();
  const apiKey = activeAiKey(p);
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
    if (!apiKey && !(await credits.spend(GEN_COST))) {
      Alert.alert('コインが足りません', 'AI分析にはコイン購入か、APIキー登録が必要です。', [
        { text: '閉じる', style: 'cancel' },
        { text: 'コインを見る', onPress: () => router.push('/coins') },
      ]);
      return;
    }
    setBusy(true);
    try {
      const result = apiKey ? await generateWorkStyle(mat, { provider: p.aiProvider, apiKey }) : localWorkStyle(mat);
      await prefs.set({ workStyleResult: result });
    } catch (e) {
      Alert.alert('分析に失敗', e instanceof AiError ? e.message : '予期しないエラーが発生しました。');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
      <Stack.Screen options={{ title: '働き方タイプ' }} />
      <Text style={type.muted}>
        日々の仕事ログ・強み・価値観から、あなたの「働き方タイプ」を分析します。記録が増えるほど深まります。
      </Text>

      {p.workStyleResult ? (
        <Card style={{ marginTop: spacing.lg, gap: spacing.xs }}>
          <Text style={type.body}>{p.workStyleResult}</Text>
        </Card>
      ) : null}

      <View style={{ marginTop: spacing.lg }}>
        {busy ? (
          <View style={styles.loading}>
            <ActivityIndicator color={c.primary} />
            <Text style={type.muted}>分析しています…</Text>
          </View>
        ) : (
          <>
            <Button label={p.workStyleResult ? '分析し直す' : apiKey ? '分析する' : '分析する（1コイン）'} onPress={analyze} />
            {!apiKey ? <Text style={[type.muted, { textAlign: 'center', marginTop: spacing.sm }]}>キー登録で無料・コインでも利用可</Text> : null}
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  loading: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.md },
});
