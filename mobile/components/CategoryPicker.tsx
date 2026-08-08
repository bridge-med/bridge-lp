import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useCategories } from '../lib/categories';
import { prefs } from '../lib/prefs';
import { colors, fonts, radius, spacing, type } from '../lib/theme';
import { Button, Field } from './ui';
import { Sheet } from './Sheet';

export function CategoryPicker({
  value,
  onChange,
  label = '分類（色ラベル）',
}: {
  value?: string;
  onChange: (v?: string) => void;
  label?: string;
}) {
  const cats = useCategories();
  const [editOpen, setEditOpen] = useState(false);
  return (
    <View style={{ gap: spacing.xs }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={type.label}>{label}</Text>
        <Pressable onPress={() => setEditOpen(true)} hitSlop={8}>
          <Text style={[type.label, { color: colors.primary }]}>名前を編集</Text>
        </Pressable>
      </View>
      <View style={styles.wrap}>
        {cats.map((cat) => {
          const active = value === cat.id;
          return (
            <Pressable
              key={cat.id}
              onPress={() => onChange(active ? undefined : cat.id)}
              style={[styles.chip, { borderColor: active ? cat.color : colors.line2, backgroundColor: active ? cat.color + '22' : 'transparent' }]}
            >
              <View style={[styles.dot, { backgroundColor: cat.color }]} />
              <Text style={[styles.chipTxt, { color: active ? colors.text : colors.text2 }]} numberOfLines={1}>{cat.name}</Text>
            </Pressable>
          );
        })}
      </View>
      <CategoryEditSheet visible={editOpen} onClose={() => setEditOpen(false)} />
    </View>
  );
}

export function CategoryEditSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const cats = useCategories();
  const [names, setNames] = useState<string[]>([]);
  const [seed, setSeed] = useState(false);
  if (visible && !seed) {
    setSeed(true);
    setNames(cats.map((c) => c.name));
  }
  if (!visible && seed) setSeed(false);

  function save() {
    void prefs.set({ categoryNames: cats.map((c, i) => (names[i]?.trim() || c.id).slice(0, 10)) });
    onClose();
  }

  return (
    <Sheet visible={visible} title="分類（色ラベル）の名前" onClose={onClose}>
      <Text style={[type.muted, { color: colors.text2 }]}>色はそのまま、名前だけ自由に変えられます。</Text>
      {cats.map((cat, i) => (
        <View key={cat.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
          <View style={[styles.dotLg, { backgroundColor: cat.color }]} />
          <View style={{ flex: 1 }}>
            <Field placeholder={`例：${cat.id}（連絡, 記録 など）`} value={names[i] ?? ''} onChangeText={(t) => setNames((prev) => prev.map((v, idx) => (idx === i ? t : v)))} />
          </View>
        </View>
      ))}
      <Button label="保存" onPress={save} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.pill, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 11, paddingVertical: 6, maxWidth: '47%' },
  dot: { width: 11, height: 11, borderRadius: 6 },
  chipTxt: { fontFamily: fonts.gothicMed, fontSize: 13 },
  dotLg: { width: 16, height: 16, borderRadius: 8 },
});
