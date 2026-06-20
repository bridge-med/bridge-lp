import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/ui';
import { useColors } from '../../components/ThemeProvider';
import { sessions } from '../../lib/data';
import { formatShort, todayKey } from '../../lib/date';
import { useCollection } from '../../lib/store';
import { fonts, radius, spacing, type } from '../../lib/theme';

function lastNDays(n: number): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(todayKey(d));
  }
  return out;
}

export default function StatsScreen() {
  const c = useColors();
  const all = useCollection(sessions);

  const byDay = new Map<string, number>();
  let totalMin = 0;
  for (const s of all) {
    byDay.set(s.date, (byDay.get(s.date) ?? 0) + 1);
    totalMin += s.minutes;
  }

  const days = lastNDays(7);
  const counts = days.map((d) => byDay.get(d) ?? 0);
  const max = Math.max(1, ...counts);

  const today = byDay.get(todayKey()) ?? 0;
  const todayMin = all.filter((s) => s.date === todayKey()).reduce((a, s) => a + s.minutes, 0);
  const week = counts.reduce((a, b) => a + b, 0);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[type.h1, { marginBottom: spacing.lg }]}>記録</Text>

        <View style={styles.statRow}>
          <Stat label="今日" value={`${today}`} unit="本" tone={c.primary} />
          <Stat label="今日の集中" value={`${todayMin}`} unit="分" tone={c.text} />
          <Stat label="累計" value={`${all.length}`} unit="本" tone={c.text} />
        </View>

        <Card style={{ marginTop: spacing.lg }}>
          <Text style={[type.label, { marginBottom: spacing.md }]}>この7日間 — {week}本</Text>
          <View style={styles.chart}>
            {days.map((d, i) => {
              const h = 96 * (counts[i] / max);
              const isToday = d === todayKey();
              return (
                <View key={d} style={styles.barCol}>
                  <Text style={[styles.barNum, { color: c.muted }]}>{counts[i] || ''}</Text>
                  <View style={[styles.barTrack, { backgroundColor: c.surface2 }]}>
                    <View
                      style={{
                        height: Math.max(counts[i] > 0 ? 6 : 0, h),
                        backgroundColor: isToday ? c.primary : c.primary2,
                        borderRadius: 6,
                      }}
                    />
                  </View>
                  <Text style={[styles.barLabel, { color: isToday ? c.text : c.muted }]}>{formatShort(d)}</Text>
                </View>
              );
            })}
          </View>
        </Card>

        <Card style={{ marginTop: spacing.lg }}>
          <Text style={[type.label, { marginBottom: spacing.sm }]}>合計</Text>
          <Text style={[type.body, { color: c.text2 }]}>
            これまでに <Text style={{ fontFamily: fonts.maru, color: c.text }}>{all.length}</Text> 本の集中、
            のべ <Text style={{ fontFamily: fonts.maru, color: c.text }}>{totalMin}</Text> 分。
          </Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ label, value, unit, tone }: { label: string; value: string; unit: string; tone: string }) {
  const c = useColors();
  return (
    <View style={[styles.statCard, { backgroundColor: c.surface, borderColor: c.line }]}>
      <Text style={[styles.statLabel, { color: c.muted }]}>{label}</Text>
      <Text style={[styles.statValue, { color: tone }]}>
        {value}
        <Text style={[styles.statUnit, { color: c.muted }]}> {unit}</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    gap: 6,
  },
  statLabel: { fontFamily: fonts.gothicMed, fontSize: 11 },
  statValue: { fontFamily: fonts.maruBlack, fontSize: 26 },
  statUnit: { fontFamily: fonts.gothicMed, fontSize: 12 },
  chart: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 6, height: 140 },
  barCol: { flex: 1, alignItems: 'center', gap: 6 },
  barNum: { fontFamily: fonts.gothicMed, fontSize: 11, height: 14 },
  barTrack: { width: '100%', height: 96, borderRadius: 6, justifyContent: 'flex-end' },
  barLabel: { fontFamily: fonts.gothicMed, fontSize: 10 },
});
