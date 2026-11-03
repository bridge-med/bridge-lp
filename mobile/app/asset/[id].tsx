// Asset Candidate detail — 内容・公開リスク・ステータス管理・元ログへのリンク。

import { Feather } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useColors } from '../../components/ThemeProvider';
import { Button, Chip, EmptyState } from '../../components/ui';
import { ASSET_KIND_LABEL, ASSET_STATUS_LABEL, ASSET_STATUS_ORDER, RISK_LABEL } from '../../lib/assetize';
import { ASSET_KIND_COLOR } from '../assets';
import { assetCandidates, workLogs } from '../../lib/data';
import { useCollection } from '../../lib/store';
import { colors, fonts, radius, spacing, type } from '../../lib/theme';
import type { AssetCandidate, AssetStatus, RiskLevel } from '../../lib/types';

const RISK_TONE: Record<RiskLevel, 'accent' | 'warn' | 'danger'> = { low: 'accent', medium: 'warn', high: 'danger' };

export default function AssetDetailScreen() {
  const c = useColors();
  const { id } = useLocalSearchParams<{ id: string }>();
  const all = useCollection(assetCandidates);
  const logs = useCollection(workLogs);
  const asset = all.find((a) => a.id === id);

  if (!asset) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: '資産候補' }} />
        <EmptyState icon="alert-circle" title="見つかりませんでした" />
      </View>
    );
  }

  const sources = logs.filter((l) => asset.sourceLogIds.includes(l.id));
  const kindColor = ASSET_KIND_COLOR[asset.kind];

  function setStatus(s: AssetStatus) {
    void assetCandidates.upsert({ id: asset!.id, status: s } as Partial<AssetCandidate>);
  }

  function onShare() {
    void Share.share({ message: `【${ASSET_KIND_LABEL[asset!.kind]}】${asset!.title}\n\n${asset!.summary}\n\n${asset!.detail}` });
  }

  function onDelete() {
    Alert.alert('この資産候補を削除', '取り消せません。よろしいですか？', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除する', style: 'destructive', onPress: () => { void assetCandidates.remove(asset!.id); router.back(); } },
    ]);
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: ASSET_KIND_LABEL[asset.kind] }} />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <View style={[styles.kindBadge, { backgroundColor: kindColor }]}>
            <Text style={styles.kindBadgeTxt}>{ASSET_KIND_LABEL[asset.kind]}</Text>
          </View>
          {asset.areas.map((a) => (
            <Text key={a} style={[type.muted, { fontSize: 11 }]}>#{a}</Text>
          ))}
        </View>
        <Text style={styles.title}>{asset.title}</Text>
        {asset.summary ? <Text style={[type.body, { color: colors.text2, marginTop: 4 }]}>{asset.summary}</Text> : null}

        {/* ステータス */}
        <Text style={[type.label, { marginTop: spacing.lg }]}>ステータス</Text>
        <View style={styles.chips}>
          {ASSET_STATUS_ORDER.map((s) => (
            <Chip key={s} label={ASSET_STATUS_LABEL[s]} tone={s === 'published' ? 'accent' : 'primary'} active={asset.status === s} onPress={() => setStatus(s)} />
          ))}
        </View>

        {/* 内容 */}
        <View style={[styles.card, { marginTop: spacing.lg }]}>
          <Text style={type.label}>内容</Text>
          <Text style={[type.body, { marginTop: 6, lineHeight: 24 }]}>{asset.detail || '（詳細なし）'}</Text>
        </View>

        {/* 公開リスク */}
        {asset.risk ? (
          <View style={[styles.card, { marginTop: spacing.md, borderColor: asset.risk.level === 'high' ? c.danger : colors.line }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={type.label}>公開リスク</Text>
              <Chip label={`リスク ${RISK_LABEL[asset.risk.level]}`} tone={RISK_TONE[asset.risk.level]} active />
            </View>
            {asset.risk.notes.length ? (
              <View style={{ marginTop: 6 }}>
                <Text style={[type.muted, { fontSize: 11 }]}>注意箇所</Text>
                {asset.risk.notes.map((n, i) => (
                  <Text key={i} style={[type.body, { marginTop: 2 }]}>・{n}</Text>
                ))}
              </View>
            ) : null}
            {asset.risk.anonymized.length ? (
              <View style={{ marginTop: spacing.sm }}>
                <Text style={[type.muted, { fontSize: 11 }]}>一般化案</Text>
                {asset.risk.anonymized.map((n, i) => (
                  <Text key={i} style={[type.body, { marginTop: 2 }]}>・{n}</Text>
                ))}
              </View>
            ) : null}
            <Text style={[type.muted, { marginTop: spacing.sm, fontSize: 10 }]}>
              ※AIによる公開前確認の支援です。安全を保証するものではありません。最終判断はご自身で行ってください。
            </Text>
          </View>
        ) : null}

        {/* 元ログ */}
        {sources.length ? (
          <View style={{ marginTop: spacing.lg }}>
            <Text style={type.label}>もとになった記録</Text>
            {sources.map((l) => (
              <Pressable key={l.id} onPress={() => router.push(`/log/${l.id}`)} style={styles.srcRow}>
                <Feather name="file-text" size={14} color={c.primary} />
                <Text style={[type.body, { flex: 1 }]} numberOfLines={1}>{l.title || l.did.slice(0, 30) || '無題のログ'}</Text>
                <Feather name="chevron-right" size={16} color={colors.line2} />
              </Pressable>
            ))}
          </View>
        ) : null}

        <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
          <Button label="内容を共有・コピー" onPress={onShare} />
          <Button label="削除" variant="danger" onPress={onDelete} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  kindBadge: { borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4 },
  kindBadgeTxt: { fontFamily: fonts.gothicBold, fontSize: 11, color: '#fff' },
  title: { fontFamily: fonts.maruBlack, fontSize: 24, color: colors.text, lineHeight: 34, marginTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 6 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: spacing.md },
  srcRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
});
