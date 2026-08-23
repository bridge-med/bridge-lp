// Asset Library — 経験から抽出された資産候補の一覧。
// 「自分には何の知識が溜まっているのか」が見えることを最優先にした設計。

import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlockHeader } from '../components/BlockHeader';
import { useColors } from '../components/ThemeProvider';
import { EmptyState } from '../components/ui';
import { areaStats, ASSET_KIND_LABEL, ASSET_STATUS_LABEL } from '../lib/assetize';
import { assetCandidates, logInsights } from '../lib/data';
import { useCollection } from '../lib/store';
import { colors, fonts, radius, spacing, type } from '../lib/theme';
import type { AssetKind, AssetStatus } from '../lib/types';

export const ASSET_KIND_COLOR: Record<AssetKind, string> = {
  x: '#5B83A6',
  note: '#6FA86A',
  template: '#E0A640',
  product: '#E8654E',
  career_story: '#9A6A86',
};

const KINDS: (AssetKind | 'all')[] = ['all', 'x', 'note', 'template', 'product', 'career_story'];
const STATUS_GROUPS: { key: 'active' | 'published' | 'archived' | 'all'; label: string; match: (s: AssetStatus) => boolean }[] = [
  { key: 'active', label: '進行中', match: (s) => s === 'candidate' || s === 'developing' || s === 'ready' },
  { key: 'published', label: '公開済み', match: (s) => s === 'published' },
  { key: 'archived', label: 'アーカイブ', match: (s) => s === 'archived' },
  { key: 'all', label: 'すべて', match: () => true },
];

export default function AssetLibraryScreen() {
  const c = useColors();
  const all = useCollection(assetCandidates);
  const insights = useCollection(logInsights);
  const [kind, setKind] = useState<AssetKind | 'all'>('all');
  const [statusGroup, setStatusGroup] = useState<(typeof STATUS_GROUPS)[number]['key']>('active');
  const [area, setArea] = useState<string | null>(null);

  const areas = useMemo(() => areaStats(insights, all).slice(0, 10), [insights, all]);

  const visible = useMemo(() => {
    const g = STATUS_GROUPS.find((s) => s.key === statusGroup)!;
    return [...all]
      .filter((a) => g.match(a.status))
      .filter((a) => (kind === 'all' ? true : a.kind === kind))
      .filter((a) => (area ? a.areas.includes(area) : true))
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [all, kind, statusGroup, area]);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <BlockHeader wordmark="ASSETS" title="資産ライブラリ" subtitle="経験から生まれた、あなたの資産" onBack pad={24} />

        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {/* Knowledge Areas — 何の知識が溜まっているか */}
          {areas.length ? (
            <View>
              <Text style={type.label}>たまっている知識</Text>
              <View style={styles.chips}>
                {areas.map((a) => (
                  <Pressable
                    key={a.name}
                    onPress={() => setArea(area === a.name ? null : a.name)}
                    style={[styles.areaChip, { borderColor: area === a.name ? c.primary : colors.line2, backgroundColor: area === a.name ? c.primaryWeak : 'transparent' }]}
                  >
                    <Text style={[styles.areaTxt, { color: area === a.name ? c.primary : colors.text2 }]}>
                      {a.name} <Text style={{ fontFamily: fonts.maruMed }}>{a.count}</Text>
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          {/* 種類フィルタ */}
          <View style={styles.chips}>
            {KINDS.map((k) => {
              const on = kind === k;
              const col = k === 'all' ? c.primary : ASSET_KIND_COLOR[k];
              return (
                <Pressable key={k} onPress={() => setKind(k)} style={[styles.kindChip, { borderColor: on ? col : colors.line2, backgroundColor: on ? col + '22' : 'transparent' }]}>
                  {k !== 'all' ? <View style={[styles.dot, { backgroundColor: col }]} /> : null}
                  <Text style={[styles.kindTxt, { color: on ? colors.text : colors.text2 }]}>{k === 'all' ? 'すべて' : ASSET_KIND_LABEL[k]}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* ステータス */}
          <View style={styles.chips}>
            {STATUS_GROUPS.map((s) => (
              <Pressable key={s.key} onPress={() => setStatusGroup(s.key)} style={[styles.statusChip, { backgroundColor: statusGroup === s.key ? c.primary : colors.surface2 }]}>
                <Text style={[styles.statusTxt, { color: statusGroup === s.key ? '#fff' : colors.text2 }]}>{s.label}</Text>
              </Pressable>
            ))}
          </View>

          {/* 一覧 */}
          {visible.length === 0 ? (
            <EmptyState
              icon="package"
              title="ここに資産が貯まります"
              hint={'仕事ログを書くと、AIが発信ネタ・テンプレ・\nプロダクトの種を自動で抽出します。'}
            />
          ) : (
            visible.map((a) => (
              <Pressable key={a.id} onPress={() => router.push(`/asset/${a.id}`)} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
                <View style={[styles.edge, { backgroundColor: ASSET_KIND_COLOR[a.kind] }]} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={[styles.kindLabel, { color: ASSET_KIND_COLOR[a.kind] }]}>{ASSET_KIND_LABEL[a.kind]}</Text>
                    <Text style={[type.muted, { fontSize: 11 }]}>{ASSET_STATUS_LABEL[a.status]}</Text>
                  </View>
                  <Text style={type.title} numberOfLines={1}>{a.title}</Text>
                  {a.summary ? <Text style={[type.muted, { marginTop: 2 }]} numberOfLines={2}>{a.summary}</Text> : null}
                </View>
                <Feather name="chevron-right" size={18} color={colors.line2} />
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 6 },
  areaChip: { borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 11, paddingVertical: 6 },
  areaTxt: { fontFamily: fonts.gothicMed, fontSize: 12.5 },
  kindChip: { flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingVertical: 6 },
  kindTxt: { fontFamily: fonts.gothicMed, fontSize: 12.5 },
  dot: { width: 9, height: 9, borderRadius: 5 },
  statusChip: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  statusTxt: { fontFamily: fonts.gothicMed, fontSize: 12.5 },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: spacing.md, overflow: 'hidden' },
  edge: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 5 },
  kindLabel: { fontFamily: fonts.gothicBold, fontSize: 11, letterSpacing: 0.5 },
});
