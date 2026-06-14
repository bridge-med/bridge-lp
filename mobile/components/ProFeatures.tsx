// Shared list of what Pro unlocks. Used by the paywall and settings.

import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../lib/theme';

export const PRO_FEATURES: { icon: string; title: string; desc: string }[] = [
  { icon: '📊', title: 'ふりかえり', desc: 'ストリーク・気分グラフ・月次サマリーで継続を可視化' },
  { icon: '⏰', title: '複数リマインダー', desc: 'タスクに複数・繰り返しの通知（無料は1件まで）' },
  { icon: '🏷️', title: 'タグ & 検索', desc: 'メモ・タスクをタグ付けして素早く絞り込み' },
  { icon: '📤', title: '整形エクスポート', desc: 'Markdown / PDF で読みやすく書き出し' },
  { icon: '🎨', title: 'テーマ & アイコン', desc: '配色・アプリアイコンをカスタマイズ' },
];

export function ProFeatureList() {
  return (
    <View style={{ gap: spacing.md }}>
      {PRO_FEATURES.map((f) => (
        <View key={f.title} style={styles.row}>
          <Text style={styles.icon}>{f.icon}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>{f.title}</Text>
            <Text style={type.muted}>{f.desc}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  icon: { fontSize: 22, width: 28, textAlign: 'center' },
  title: { ...type.body, fontWeight: '700', color: colors.text },
});
