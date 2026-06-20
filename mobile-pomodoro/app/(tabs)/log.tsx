import { Feather } from '@expo/vector-icons';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../../components/ThemeProvider';
import { focusSessions, workItems } from '../../lib/data';
import { formatDateJa, formatDuration, formatTimeJa, todayKey } from '../../lib/date';
import { useCollection } from '../../lib/store';
import { fonts, radius, spacing } from '../../lib/theme';
import type { FocusSession, SessionStatus, WorkItem } from '../../lib/types';

const STATUS_LABEL: Record<SessionStatus, string> = {
  completed: '完了',
  continued: '継続',
  aborted: '中断',
};

export default function LogScreen() {
  const c = useColors();
  const sessions = useCollection(focusSessions);
  const items = useCollection(workItems);

  const titleOf = useMemo(() => {
    const map = new Map<string, string>(items.map((w: WorkItem) => [w.id, w.title]));
    return (id: string | null) => (id ? map.get(id) ?? '（削除された作業）' : '作業なし');
  }, [items]);

  const today = sessions.filter((s) => s.date === todayKey() && s.status !== 'aborted');
  const todaySec = today.reduce((a, s) => a + s.duration, 0);
  const todayCount = today.length;

  // per-work breakdown for today
  const byWork = new Map<string, number>();
  for (const s of today) {
    const key = s.workItemId ?? '__none__';
    byWork.set(key, (byWork.get(key) ?? 0) + s.duration);
  }
  const breakdown = [...byWork.entries()].sort((a, b) => b[1] - a[1]);

  // recent sessions (any day), newest first
  const recent = [...sessions].sort((a, b) => (a.endTime < b.endTime ? 1 : -1)).slice(0, 15);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[styles.date, { color: c.muted }]}>{formatDateJa(todayKey())}</Text>
        <Text style={[styles.heading, { color: c.text }]}>Today Log</Text>

        {/* hero total */}
        <View style={[styles.hero, { backgroundColor: c.surface, borderColor: c.line }]}>
          <Text style={[styles.heroDur, { color: c.text }]}>{formatDuration(todaySec)}</Text>
          <Text style={[styles.heroSub, { color: c.muted }]}>{todayCount} sessions</Text>
        </View>

        {/* per-work breakdown */}
        <Text style={[styles.section, { color: c.muted }]}>作業別</Text>
        {breakdown.length === 0 ? (
          <Empty c={c} text="今日の集中はこれから。" />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {breakdown.map(([key, sec]) => (
              <View key={key} style={[styles.card, { backgroundColor: c.surface, borderColor: c.line }]}>
                <View style={[styles.dot, { backgroundColor: key === '__none__' ? c.muted : c.primary }]} />
                <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={1}>
                  {key === '__none__' ? '作業なし' : titleOf(key)}
                </Text>
                <Text style={[styles.cardDur, { color: c.text2 }]}>{formatDuration(sec)}</Text>
              </View>
            ))}
          </View>
        )}

        {/* recent log */}
        <Text style={[styles.section, { color: c.muted, marginTop: spacing.xl }]}>直近ログ</Text>
        {recent.length === 0 ? (
          <Empty c={c} text="まだ記録がありません。" />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {recent.map((s: FocusSession) => (
              <View key={s.id} style={[styles.logCard, { backgroundColor: c.surface, borderColor: c.line }]}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={[styles.cardTitle, { color: c.text }]} numberOfLines={1}>
                    {titleOf(s.workItemId)}
                  </Text>
                  <View style={styles.metaRow}>
                    <Text style={[styles.meta, { color: c.muted }]}>{formatTimeJa(s.endTime)}</Text>
                    <Text style={[styles.metaDot, { color: c.line2 }]}>·</Text>
                    <Text style={[styles.meta, { color: c.muted }]}>{statusLabel(s.status)}</Text>
                  </View>
                  {s.note ? (
                    <Text style={[styles.note, { color: c.text2 }]} numberOfLines={2}>
                      {s.note}
                    </Text>
                  ) : null}
                </View>
                <Text style={[styles.cardDur, { color: s.status === 'aborted' ? c.muted : c.primary }]}>
                  {formatDuration(s.duration)}
                </Text>
              </View>
            ))}
          </View>
        )}
        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function statusLabel(s: SessionStatus): string {
  return STATUS_LABEL[s];
}

function Empty({ c, text }: { c: ReturnType<typeof useColors>; text: string }) {
  return (
    <View style={[styles.empty, { borderColor: c.line }]}>
      <Feather name="inbox" size={20} color={c.line2} />
      <Text style={[styles.emptyText, { color: c.muted }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg },
  date: { fontFamily: fonts.gothicMed, fontSize: 12, letterSpacing: 0.5 },
  heading: { fontFamily: fonts.maru, fontSize: 22, marginTop: 2, marginBottom: spacing.lg },
  hero: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    paddingVertical: spacing.xl,
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.xl,
    shadowColor: '#16203A',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 2,
  },
  heroDur: { fontFamily: fonts.maruBlack, fontSize: 46, letterSpacing: 1 },
  heroSub: { fontFamily: fonts.gothicMed, fontSize: 13 },
  section: { fontFamily: fonts.gothicBold, fontSize: 11, letterSpacing: 1.5, marginBottom: spacing.sm },
  card: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingVertical: 14, paddingHorizontal: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4 },
  cardTitle: { flex: 1, fontFamily: fonts.gothicMed, fontSize: 15 },
  cardDur: { fontFamily: fonts.maru, fontSize: 15 },
  logCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: spacing.lg },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { fontFamily: fonts.gothic, fontSize: 12 },
  metaDot: { fontFamily: fonts.gothic, fontSize: 12 },
  note: { fontFamily: fonts.gothic, fontSize: 13, lineHeight: 18 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, borderStyle: 'dashed' },
  emptyText: { fontFamily: fonts.gothicMed, fontSize: 13 },
});
