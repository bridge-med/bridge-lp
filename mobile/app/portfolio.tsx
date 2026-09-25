// Career Portfolio — これまでの記録から自動生成する「あなたのキャリアの現在地」。
// Key Achievements / Skills / Career Stories / Knowledge Assets を集計し、
// テキスト書き出し（職務経歴書・面接準備・LinkedIn等の下書き）に展開できる。

import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { BlockHeader } from '../components/BlockHeader';
import { useColors } from '../components/ThemeProvider';
import { Button, Chip, EmptyState } from '../components/ui';
import { areaStats, ASSET_KIND_LABEL, skillStats } from '../lib/assetize';
import { ASSET_KIND_COLOR } from './assets';
import { assetCandidates, logInsights, workLogs } from '../lib/data';
import { usePrefs } from '../lib/prefs';
import { useCollection } from '../lib/store';
import { colors, fonts, radius, spacing, type } from '../lib/theme';

export default function PortfolioScreen() {
  const c = useColors();
  const logs = useCollection(workLogs);
  const insights = useCollection(logInsights);
  const candidates = useCollection(assetCandidates);
  const { userName, profession } = usePrefs();

  const logById = useMemo(() => new Map(logs.map((l) => [l.id, l])), [logs]);

  const keyAchievements = useMemo(() => {
    const ranked = [...insights]
      .filter((i) => i.strength !== 'weak')
      .sort((a, b) => {
        const s = (x: typeof a) => (x.strength === 'strong' ? 2 : 1) + (x.outcome || !x.star.resultMissing ? 1 : 0);
        return s(b) - s(a) || (a.createdAt < b.createdAt ? 1 : -1);
      });
    return ranked.slice(0, 6);
  }, [insights]);

  const skills = useMemo(() => skillStats(insights).slice(0, 12), [insights]);
  const areas = useMemo(() => areaStats(insights, candidates).slice(0, 8), [insights, candidates]);

  const stories = useMemo(
    () => insights.filter((i) => i.star.s && i.star.a && !i.star.resultMissing).slice(0, 5),
    [insights],
  );

  const assetSummary = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of candidates) {
      if (a.status === 'archived') continue;
      counts.set(a.kind, (counts.get(a.kind) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [candidates]);

  function exportText() {
    const lines: string[] = [];
    lines.push(`■ キャリアポートフォリオ${userName ? ` — ${userName}` : ''}${profession ? `（${profession}）` : ''}`);
    lines.push('');
    if (keyAchievements.length) {
      lines.push('【主な実績】');
      for (const i of keyAchievements) lines.push(`・${i.achievement}${i.outcome ? `（成果: ${i.outcome.note}）` : ''}`);
      lines.push('');
    }
    if (skills.length) {
      lines.push('【スキル】');
      lines.push(skills.map((s) => `${s.name}(${s.count})`).join(' / '));
      lines.push('');
    }
    if (stories.length) {
      lines.push('【エピソード（STAR）】');
      for (const i of stories) {
        const l = logById.get(i.logId);
        lines.push(`▼ ${l?.title || i.achievement}`);
        lines.push(`  状況: ${i.star.s}`);
        if (i.star.t) lines.push(`  課題: ${i.star.t}`);
        lines.push(`  行動: ${i.star.a}`);
        lines.push(`  成果: ${i.star.r}`);
      }
      lines.push('');
    }
    if (assetSummary.length) {
      lines.push('【ナレッジ資産】');
      for (const [kind, n] of assetSummary) lines.push(`・${ASSET_KIND_LABEL[kind as keyof typeof ASSET_KIND_LABEL]}: ${n}件`);
    }
    void Share.share({ message: lines.join('\n') });
  }

  const empty = insights.length === 0;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <BlockHeader wordmark="PORTFOLIO" title="ポートフォリオ" subtitle="記録から育つ、キャリアの現在地" onBack pad={24} />

        <View style={{ padding: spacing.lg, gap: spacing.lg }}>
          {empty ? (
            <EmptyState
              icon="briefcase"
              title="まだ材料がありません"
              hint={'仕事ログを書いて分析すると、\n実績・スキル・エピソードがここに積み上がります。'}
            />
          ) : (
            <>
              {/* Key Achievements */}
              <View>
                <Text style={styles.secTitle}>Key Achievements</Text>
                {keyAchievements.length ? (
                  keyAchievements.map((i) => (
                    <Pressable key={i.id} onPress={() => router.push(`/log/${i.logId}`)} style={styles.achRow}>
                      <Feather name="award" size={15} color={colors.gold} style={{ marginTop: 3 }} />
                      <View style={{ flex: 1 }}>
                        <Text style={type.body}>{i.achievement}</Text>
                        {i.outcome ? <Text style={[type.muted, { marginTop: 2 }]}>成果: {i.outcome.note}</Text> : null}
                      </View>
                    </Pressable>
                  ))
                ) : (
                  <Text style={type.muted}>実績はまだ抽出されていません。</Text>
                )}
              </View>

              {/* Skills */}
              <View>
                <Text style={styles.secTitle}>Skills</Text>
                {skills.length ? (
                  <View style={styles.chips}>
                    {skills.map((s) => (
                      <View key={s.name} style={[styles.skill, { borderColor: c.primaryWeak }]}>
                        <Text style={styles.skillName}>{s.name}</Text>
                        <Text style={[styles.skillCount, { color: c.primary }]}>{s.count}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={type.muted}>スキルはまだ抽出されていません。</Text>
                )}
              </View>

              {/* Knowledge Areas */}
              {areas.length ? (
                <View>
                  <Text style={styles.secTitle}>Knowledge Areas</Text>
                  <View style={styles.chips}>
                    {areas.map((a) => (
                      <Chip key={a.name} label={`${a.name} ${a.count}`} tone="primary" active />
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Career Stories */}
              <View>
                <Text style={styles.secTitle}>Career Stories（STAR）</Text>
                {stories.length ? (
                  stories.map((i) => {
                    const l = logById.get(i.logId);
                    return (
                      <Pressable key={i.id} onPress={() => router.push(`/log/${i.logId}`)} style={styles.storyCard}>
                        <Text style={type.title} numberOfLines={1}>{l?.title || i.achievement}</Text>
                        <Text style={[type.muted, { marginTop: 2 }]} numberOfLines={2}>{i.star.r}</Text>
                      </Pressable>
                    );
                  })
                ) : (
                  <Text style={type.muted}>成果まで揃ったエピソードがまだありません。「成果の追記」で完成します。</Text>
                )}
              </View>

              {/* Knowledge Assets */}
              <View>
                <Text style={styles.secTitle}>Knowledge Assets</Text>
                {assetSummary.length ? (
                  <View style={styles.chips}>
                    {assetSummary.map(([kind, n]) => (
                      <Pressable key={kind} onPress={() => router.push('/assets')} style={[styles.assetPill, { borderColor: ASSET_KIND_COLOR[kind as keyof typeof ASSET_KIND_COLOR] }]}>
                        <Text style={[styles.assetPillTxt, { color: ASSET_KIND_COLOR[kind as keyof typeof ASSET_KIND_COLOR] }]}>
                          {ASSET_KIND_LABEL[kind as keyof typeof ASSET_KIND_LABEL]} {n}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={type.muted}>資産候補はまだありません。</Text>
                )}
              </View>

              <View style={{ gap: spacing.sm }}>
                <Button label="テキストで書き出す（職務経歴書・面接準備に）" onPress={exportText} />
                <Button label="AIで職務経歴書に変換する" variant="ghost" onPress={() => router.push('/career')} />
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
  secTitle: { fontFamily: fonts.maru, fontSize: 16, color: colors.text, marginBottom: spacing.sm },
  achRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, paddingVertical: 7 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  skill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: colors.surface },
  skillName: { fontFamily: fonts.gothicMed, fontSize: 13, color: colors.text },
  skillCount: { fontFamily: fonts.maruBlack, fontSize: 12 },
  storyCard: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: spacing.md, marginBottom: spacing.sm },
  assetPill: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  assetPillTxt: { fontFamily: fonts.gothicBold, fontSize: 12.5 },
});
