import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlockHeader } from '../../components/BlockHeader';
import { useColors } from '../../components/ThemeProvider';
import { colors, spacing, type } from '../../lib/theme';

type Item = { icon: ComponentProps<typeof Feather>['name']; label: string; desc: string; href: string };

const SECTIONS: { title: string; items: Item[] }[] = [
  {
    title: 'キャリア資産',
    items: [
      { icon: 'trending-up', label: '成果・実績', desc: '数字で語れる実績', href: '/m/achievements' },
      { icon: 'layers', label: 'スキル', desc: '保有スキルとレベル', href: '/m/skills' },
      { icon: 'flag', label: '目標・キャリアプラン', desc: 'これから取りに行く経験', href: '/m/goals' },
      { icon: 'file-text', label: 'キャリア変換', desc: '職務経歴書・自己PR・面接…', href: '/career' },
    ],
  },
  {
    title: '自己理解',
    items: [
      { icon: 'award', label: '強み', desc: '強みと根拠', href: '/m/strengths' },
      { icon: 'target', label: '弱み・課題', desc: '伸びしろと向き合い方', href: '/m/weaknesses' },
      { icon: 'user', label: '自己分析', desc: 'Will/Can/Must・SWOT', href: '/m/self' },
      { icon: 'cpu', label: '働き方タイプ', desc: 'ログから性格・働き方を分析', href: '/workstyle' },
      { icon: 'compass', label: '価値観', desc: '大事にしたいこと', href: '/m/values' },
      { icon: 'activity', label: 'モチベーション曲線', desc: '時期ごとの浮き沈み', href: '/m/motivation' },
    ],
  },
  {
    title: 'ふり返り・成長',
    items: [
      { icon: 'bar-chart-2', label: 'ふり返り', desc: '週次・月次の自動まとめ', href: '/reflection' },
      { icon: 'book-open', label: '学習・資格', desc: '学んだこと・取った資格', href: '/m/learning' },
      { icon: 'message-circle', label: 'もらった言葉', desc: '感謝・フィードバック', href: '/m/kudos' },
      { icon: 'users', label: '1on1・面談メモ', desc: '準備と記録', href: '/m/oneonone' },
    ],
  },
];

export default function HubScreen() {
  const c = useColors();
  return (
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 110 }}>
      <BlockHeader wordmark="CAREER" title="キャリア" subtitle="使うものだけ選んで、育てていく" pad={28} />
      <View style={{ height: spacing.lg }} />
      {SECTIONS.map((sec) => (
        <View key={sec.title} style={styles.section}>
          <Text style={[type.label, { paddingHorizontal: spacing.lg, marginBottom: spacing.xs }]}>{sec.title}</Text>
          {sec.items.map((it) => (
            <Pressable key={it.label} onPress={() => router.push(it.href as never)} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface2 }]}>
              <View style={[styles.icon, { backgroundColor: c.primaryWeak }]}>
                <Feather name={it.icon} size={18} color={c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={type.title}>{it.label}</Text>
                <Text style={[type.muted, { marginTop: 2 }]}>{it.desc}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.line2} />
            </Pressable>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  section: { marginBottom: spacing.lg },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.md,
    paddingHorizontal: spacing.lg, paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line,
  },
  icon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});
