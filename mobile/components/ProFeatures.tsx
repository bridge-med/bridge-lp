// What removing ads gives you. Used by the paywall. (All features are free.)

import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, type } from '../lib/theme';

const BENEFITS: { icon: string; title: string; desc: string }[] = [
  { icon: '🚫', title: '広告が消える', desc: 'タスク・メモ一覧のバナーが非表示に' },
  { icon: '🎯', title: '集中できる', desc: '余計な表示のないすっきりした画面' },
  { icon: '💛', title: '開発の応援', desc: '個人開発の継続を支えられます' },
  { icon: '🆓', title: '機能はぜんぶ無料のまま', desc: '自動整理・ふりかえり・タグ・テーマは元から無料' },
];

export function AdFreeBenefits() {
  return (
    <View style={{ gap: spacing.md }}>
      {BENEFITS.map((f) => (
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
