import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { normalizeTag } from '../lib/tags';
import { colors, radius, spacing, type } from '../lib/theme';
import { useColors } from './ThemeProvider';

// Tag editor used in the add/edit forms. When `enabled` is false (free tier)
// it renders a locked row that routes to the paywall via `onLocked`.
export function TagInput({
  value,
  onChange,
  enabled,
  onLocked,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  enabled: boolean;
  onLocked: () => void;
}) {
  const c = useColors();
  const [draft, setDraft] = useState('');

  function add() {
    const t = normalizeTag(draft);
    if (t && !value.includes(t)) onChange([...value, t]);
    setDraft('');
  }

  if (!enabled) {
    return (
      <View style={{ gap: spacing.xs }}>
        <Text style={type.label}>タグ</Text>
        <Pressable onPress={onLocked} style={styles.locked}>
          <Text style={type.body}>🏷️ タグで整理する</Text>
          <Text style={[styles.proBadge, { color: c.primary }]}>PRO</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={type.label}>タグ</Text>
      {value.length > 0 ? (
        <View style={styles.chips}>
          {value.map((t) => (
            <Pressable
              key={t}
              onPress={() => onChange(value.filter((x) => x !== t))}
              style={[styles.chip, { backgroundColor: c.primaryWeak }]}
            >
              <Text style={[styles.chipText, { color: c.primary }]}>#{t}</Text>
              <Text style={[styles.chipX, { color: c.primary }]}>✕</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
      <View style={styles.addRow}>
        <TextInput
          value={draft}
          onChangeText={setDraft}
          onSubmitEditing={add}
          placeholder="タグを追加して Enter"
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCapitalize="none"
          returnKeyType="done"
        />
        <Pressable onPress={add} style={styles.addBtn} disabled={!normalizeTag(draft)}>
          <Text style={styles.addBtnText}>追加</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  locked: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
  },
  proBadge: {
    color: colors.primary,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primaryWeak,
    borderRadius: radius.pill,
    paddingLeft: 12,
    paddingRight: 10,
    paddingVertical: 6,
  },
  chipText: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  chipX: { color: colors.primary, fontSize: 11 },
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
    borderColor: colors.line2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: colors.text2, fontWeight: '700' },
});
