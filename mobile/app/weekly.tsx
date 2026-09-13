// Weekly Review — 1週間の記録を自動で棚卸しする画面。
// ローカル集計（無料）＋ 横断AI提案（コイン・週ごとにキャッシュ）。

import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlockHeader } from '../components/BlockHeader';
import { useColors } from '../components/ThemeProvider';
import { Button, Chip, EmptyState } from '../components/ui';
import {
  ASSET_KIND_LABEL,
  generateWeeklySuggestions,
  getCachedWeeklySuggestions,
  newSkillsInRange,
  weeklyDigest,
} from '../lib/assetize';
import { ASSET_KIND_COLOR } from './assets';
import { credits, GEN_COST, useCoins } from '../lib/credits';
import { assetCandidates, logInsights, workLogs } from '../lib/data';
import { formatShort, parseKey, startOfWeekKey, todayKey } from '../lib/date';
import { useCollection } from '../lib/store';
import { colors, fonts, radius, spacing, type } from '../lib/theme';

function shiftKey(key: string, days: number): string {
  const d = parseKey(key);
  d.setDate(d.getDate() + days);
  return todayKey(d);
}

export default function WeeklyReviewScreen() {
  const c = useColors();
  const logs = useCollection(workLogs);
  const insights = useCollection(logInsights);
  const candidates = useCollection(assetCandidates);
  const coins = useCoins();
  const [week, setWeek] = useState<'this' | 'last'>('this');
  const [suggestions, setSuggestions] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);

  const thisStart = startOfWeekKey();
  const start = week === 'this' ? thisStart : shiftKey(thisStart, -7);
  const endExclusive = week === 'this' ? shiftKey(thisStart, 7) : thisStart;

  const weekLogs = useMemo(
    () => logs.filter((l) => l.date >= start && l.date < endExclusive).sort((a, b) => (a.date < b.date ? 1 : -1)),
    [logs, start, endExclusive],
  );
  const weekInsights = useMemo(() => {
    const ids = new Set(weekLogs.map((l) => l.id));
    return insights.filter((i) => ids.has(i.logId));
  }, [insights, weekLogs]);
  const newSkills = useMemo(() => newSkillsInRange(insights, start, endExclusive), [insights, start, endExclusive]);
  const achievements = useMemo(
    () => weekInsights.filter((i) => i.strength !== 'weak').map((i) => ({ id: i.logId, text: i.achievement })),
    [weekInsights],
  );
  const weekCandidates = useMemo(
    () => candidates.filter((a) => a.createdAt.slice(0, 10) >= start && a.createdAt.slice(0, 10) < endExclusive).slice(0, 3),
    [candidates, start, endExclusive],
  );

  // 週キーごとのAI提案キャッシュを読む
  useEffect(() => {
    let alive = true;
    setSuggestions(null);
    void getCachedWeeklySuggestions(start).then((s) => {
      if (alive) setSuggestions(s);
    });
    return () => {
      alive = false;
    };
  }, [start]);

  async function onSuggest() {
    if (weekLogs.length < 2) {
      Alert.alert('記録が足りません', '提案には2件以上のログが必要です。');
      return;
    }
    if (!(await credits.spend(GEN_COST))) {
      Alert.alert('コインが足りません', `提案の生成には${GEN_COST}コイン必要です。`, [
        { text: '閉じる', style: 'cancel' },
        { text: 'コインを見る', onPress: () => router.push('/coins') },
      ]);
      return;
    }
    setBusy(true);
    try {
      const s = await generateWeeklySuggestions(start, weeklyDigest(weekLogs, weekInsights, weekCandidates));
      setSuggestions(s);
    } catch (e) {
      void credits.add(GEN_COST); // refund on failure
      Alert.alert('生成に失敗', e instanceof Error ? e.message : '時間をおいて再度お試しください。');
    } finally {
      setBusy(false);
    }
  }

  const rangeLabel = `${formatShort(start)} 〜 ${formatShort(shiftKey(endExclusive, -1))}`;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <BlockHeader wordmark="WEEKLY" title="週間レビュー" subtitle={rangeLabel} onBack pad={24} />

        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          <View style={styles.seg}>
            {(['this', 'last'] as const).map((w) => (
              <Pressable key={w} onPress={() => setWeek(w)} style={[styles.segBtn, week === w && { backgroundColor: c.primary }]}>
                <Text style={[styles.segTxt, { color: week === w ? '#fff' : colors.text2 }]}>{w === 'this' ? '今週' : '先週'}</Text>
              </Pressable>
            ))}
          </View>

          {weekLogs.length === 0 ? (
            <EmptyState icon="calendar" title="この週の記録がありません" hint="仕事ログを書くと、ここに自動で棚卸しされます。" />
          ) : (
            <>
              {/* 今週やったこと */}
              <View>
                <Text style={styles.secTitle}>やったこと <Text style={styles.count}>{weekLogs.length}件</Text></Text>
                {weekLogs.slice(0, 7).map((l) => (
                  <Pressable key={l.id} onPress={() => router.push(`/log/${l.id}`)} style={styles.logRow}>
                    <Text style={[styles.logDate, { color: c.primary }]}>{formatShort(l.date)}</Text>
                    <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>{l.title || l.did.slice(0, 30) || '無題'}</Text>
                    <Feather name="chevron-right" size={14} color={colors.line2} />
                  </Pressable>
                ))}
              </View>

              {/* 増えたスキル */}
              <View>
                <Text style={styles.secTitle}>この週に増えたスキル</Text>
                {newSkills.length ? (
                  <View style={styles.chips}>
                    {newSkills.map((s) => (
                      <Chip key={s} label={s} tone="accent" active />
                    ))}
                  </View>
                ) : (
                  <Text style={type.muted}>新しいスキルの記録はありません（分析済みログから集計）。</Text>
                )}
              </View>

              {/* 実績 */}
              <View>
                <Text style={styles.secTitle}>職務経歴書に残せそうな実績</Text>
                {achievements.length ? (
                  achievements.map((a) => (
                    <Pressable key={a.id} onPress={() => router.push(`/log/${a.id}`)} style={styles.achRow}>
                      <Feather name="award" size={14} color={colors.gold} />
                      <Text style={[type.body, { flex: 1 }]}>{a.text}</Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={type.muted}>まだありません。ログを分析すると抽出されます。</Text>
                )}
              </View>

              {/* 資産候補 */}
              <View>
                <Text style={styles.secTitle}>注目の資産候補</Text>
                {weekCandidates.length ? (
                  weekCandidates.map((a) => (
                    <Pressable key={a.id} onPress={() => router.push(`/asset/${a.id}`)} style={[styles.assetRow]}>
                      <View style={[styles.dot, { backgroundColor: ASSET_KIND_COLOR[a.kind] }]} />
                      <Text style={[styles.assetKind, { color: ASSET_KIND_COLOR[a.kind] }]}>{ASSET_KIND_LABEL[a.kind]}</Text>
                      <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>{a.title}</Text>
                    </Pressable>
                  ))
                ) : (
                  <Text style={type.muted}>この週の候補はありません。</Text>
                )}
                <Pressable onPress={() => router.push('/assets')} hitSlop={8} style={{ marginTop: 6 }}>
                  <Text style={[type.bodyMed, { color: c.primary }]}>資産ライブラリを見る →</Text>
                </Pressable>
              </View>

              {/* AI提案 */}
              <View style={[styles.aiCard, { borderColor: c.primaryWeak }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Feather name="zap" size={15} color={c.primary} />
                  <Text style={[styles.secTitle, { marginBottom: 0, color: c.primary }]}>AIからの提案</Text>
                </View>
                {busy ? (
                  <View style={{ alignItems: 'center', paddingVertical: spacing.md }}>
                    <ActivityIndicator color={c.primary} />
                  </View>
                ) : suggestions?.length ? (
                  suggestions.map((s, i) => (
                    <Text key={i} style={[type.body, { marginTop: spacing.sm, lineHeight: 22 }]}>・{s}</Text>
                  ))
                ) : (
                  <Text style={[type.muted, { marginTop: 4 }]}>
                    1週間のログを横断して「まとめて1本のnoteに」「テンプレ化できそう」等の提案を出します。
                  </Text>
                )}
                {!busy ? (
                  <View style={{ marginTop: spacing.md }}>
                    <Button
                      label={suggestions?.length ? `提案を作り直す（${GEN_COST}コイン）` : `提案を生成（${GEN_COST}コイン・残${coins}）`}
                      variant={suggestions?.length ? 'ghost' : 'primary'}
                      onPress={() => void onSuggest()}
                    />
                  </View>
                ) : null}
              </View>
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  seg: { flexDirection: 'row', backgroundColor: colors.surface2, borderRadius: radius.pill, padding: 3, gap: 3 },
  segBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', height: 34, borderRadius: radius.pill },
  segTxt: { fontFamily: fonts.gothicMed, fontSize: 13 },
  secTitle: { fontFamily: fonts.maru, fontSize: 16, color: colors.text, marginBottom: spacing.sm },
  count: { fontFamily: fonts.gothic, fontSize: 12, color: colors.muted },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 9, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  logDate: { fontFamily: fonts.maruMed, fontSize: 13, width: 40 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  achRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 7 },
  assetRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  dot: { width: 9, height: 9, borderRadius: 5 },
  assetKind: { fontFamily: fonts.gothicBold, fontSize: 11 },
  aiCard: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: 1, padding: spacing.md },
});
