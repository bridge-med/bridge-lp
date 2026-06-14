import { router, Stack } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { ProFeatureList } from '../components/ProFeatures';
import { Button, Card, EmptyState } from '../components/ui';
import { journal } from '../lib/data';
import { usePro } from '../lib/entitlement';
import { useCollection } from '../lib/store';
import { averageMood, currentStreak, lastNDays, monthlyCounts, moodDistribution } from '../lib/stats';
import { colors, radius, spacing, type } from '../lib/theme';

const MOOD_EMOJI = ['😞', '😕', '😐', '🙂', '😄'];

export default function ReviewScreen() {
  const isPro = usePro();
  const entries = useCollection(journal);

  if (!isPro) {
    return (
      <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
        <Stack.Screen options={{ title: 'ふりかえり' }} />
        <Card style={{ gap: spacing.md, alignItems: 'center' }}>
          <Text style={{ fontSize: 40 }}>📊</Text>
          <Text style={type.h2}>ふりかえりは Pro 機能です</Text>
          <Text style={[type.muted, { textAlign: 'center' }]}>
            続けた日数（ストリーク）、気分の傾向、月ごとの記録数を可視化して、習慣化を後押しします。
          </Text>
        </Card>
        <Card>
          <ProFeatureList />
        </Card>
        <Button label="Pro を見る" onPress={() => router.push('/paywall')} />
      </ScrollView>
    );
  }

  if (entries.length === 0) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'ふりかえり' }} />
        <EmptyState icon="🌿" title="まだ記録がありません" hint="日記を書くと、ここに継続の記録が表示されます。" />
      </View>
    );
  }

  const streak = currentStreak(entries);
  const avg = averageMood(entries);
  const dist = moodDistribution(entries);
  const distMax = Math.max(1, ...dist);
  const days = lastNDays(entries, 14);
  const months = monthlyCounts(entries).slice(0, 6);
  const monthMax = Math.max(1, ...months.map((m) => m.count));

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <Stack.Screen options={{ title: 'ふりかえり' }} />

      <View style={styles.statRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{streak}</Text>
          <Text style={type.muted}>連続日数</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{entries.length}</Text>
          <Text style={type.muted}>総記録数</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statValue}>{avg ?? '—'}</Text>
          <Text style={type.muted}>平均の気分</Text>
        </Card>
      </View>

      <Card style={{ gap: spacing.md }}>
        <Text style={type.h2}>気分の傾向</Text>
        <View style={styles.moodChart}>
          {dist.map((count, i) => (
            <View key={i} style={styles.moodCol}>
              <Text style={type.muted}>{count}</Text>
              <View style={styles.barTrack}>
                <View style={[styles.bar, { height: `${(count / distMax) * 100}%` }]} />
              </View>
              <Text style={{ fontSize: 20 }}>{MOOD_EMOJI[i]}</Text>
            </View>
          ))}
        </View>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text style={type.h2}>直近14日</Text>
        <View style={styles.daysRow}>
          {days.map((d) => (
            <View key={d.key} style={[styles.dayDot, d.count > 0 && styles.dayDotOn]} />
          ))}
        </View>
        <Text style={type.muted}>記録した日が青く表示されます</Text>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text style={type.h2}>月別の記録数</Text>
        {months.map((m) => (
          <View key={m.month} style={styles.monthRow}>
            <Text style={[type.label, { width: 64 }]}>{m.month}</Text>
            <View style={styles.monthTrack}>
              <View style={[styles.monthBar, { width: `${(m.count / monthMax) * 100}%` }]} />
            </View>
            <Text style={[type.muted, { width: 28, textAlign: 'right' }]}>{m.count}</Text>
          </View>
        ))}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  statRow: { flexDirection: 'row', gap: spacing.md },
  statCard: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.lg },
  statValue: { fontSize: 26, fontWeight: '800', color: colors.primary },
  moodChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', height: 140, gap: spacing.sm },
  moodCol: { flex: 1, alignItems: 'center', gap: spacing.xs, height: '100%', justifyContent: 'flex-end' },
  barTrack: { flex: 1, width: 22, justifyContent: 'flex-end', backgroundColor: colors.surface2, borderRadius: radius.sm },
  bar: { width: '100%', backgroundColor: colors.primary2, borderRadius: radius.sm, minHeight: 4 },
  daysRow: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  dayDot: { width: 18, height: 18, borderRadius: 5, backgroundColor: colors.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line2 },
  dayDotOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  monthTrack: { flex: 1, height: 14, backgroundColor: colors.surface2, borderRadius: radius.pill, overflow: 'hidden' },
  monthBar: { height: '100%', backgroundColor: colors.accent, borderRadius: radius.pill, minWidth: 6 },
});
