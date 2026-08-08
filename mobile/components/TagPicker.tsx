import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { TAG_PRESETS } from '../lib/constants';
import { normalizeTag } from '../lib/tags';
import { colors, radius, spacing, type } from '../lib/theme';
import { Chip } from './ui';
import { useColors } from './ThemeProvider';

// Multi-select tags: preset career tags + free-form custom tags.
export function TagPicker({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const c = useColors();
  const [draft, setDraft] = useState('');

  function toggle(tag: string) {
    onChange(value.includes(tag) ? value.filter((t) => t !== tag) : [...value, tag]);
  }
  function add() {
    const t = normalizeTag(draft);
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
  }

  const custom = value.filter((t) => !TAG_PRESETS.includes(t as (typeof TAG_PRESETS)[number]));

  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={type.label}>タグ</Text>
      <View style={styles.chips}>
        {TAG_PRESETS.map((t) => (
          <Chip key={t} label={t} tone="primary" active={value.includes(t)} onPress={() => toggle(t)} />
        ))}
        {custom.map((t) => (
          <Chip key={t} label={`#${t}`} tone="accent" active onPress={() => toggle(t)} />
        ))}
      </View>
      <View style={styles.addRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder="自由タグを追加"
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCapitalize="none"
          returnKeyType="done"
        />
        <Pressable onPress={add} style={[styles.addBtn, { borderColor: c.line2 }]} disabled={!normalizeTag(draft)}>
          <Text style={styles.addBtnText}>追加</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  addRow: { flexDirection: 'row', gap: spacing.sm },
  input: {
    flex: 1,
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  addBtn: {
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: colors.text2, fontWeight: '700' },
});
