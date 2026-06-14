import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, spacing, type } from '../lib/theme';
import { useColors } from './ThemeProvider';

// A labeled pulldown that opens a searchable full-screen list of options.
export function Picker({
  label,
  value,
  options,
  placeholder = '選択してください',
  onChange,
}: {
  label?: string;
  value: string;
  options: readonly string[];
  placeholder?: string;
  onChange: (v: string) => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  const filtered = q.trim() ? options.filter((o) => o.toLowerCase().includes(q.trim().toLowerCase())) : options;

  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <Text style={type.label}>{label}</Text> : null}
      <Pressable onPress={() => setOpen(true)} style={styles.field}>
        <Text style={[type.body, !value && { color: colors.muted }]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Feather name="chevron-down" size={18} color={colors.muted} />
      </Pressable>

      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <View style={[styles.modal, { paddingTop: insets.top + spacing.sm }]}>
          <View style={styles.header}>
            <View style={styles.search}>
              <Feather name="search" size={16} color={colors.muted} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="検索"
                placeholderTextColor={colors.muted}
                style={styles.searchInput}
                autoFocus
              />
            </View>
            <Pressable onPress={() => setOpen(false)} hitSlop={10}>
              <Text style={[type.body, { color: c.primary, fontWeight: '600' }]}>閉じる</Text>
            </Pressable>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: insets.bottom + spacing.xl }}>
            {filtered.map((o) => {
              const selected = o === value;
              return (
                <Pressable
                  key={o}
                  onPress={() => {
                    onChange(o);
                    setOpen(false);
                    setQ('');
                  }}
                  style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface2 }]}
                >
                  <Text style={[type.body, selected && { color: c.primary, fontWeight: '700' }]}>{o}</Text>
                  {selected ? <Feather name="check" size={18} color={c.primary} /> : null}
                </Pressable>
              );
            })}
            {filtered.length === 0 ? <Text style={[type.muted, { padding: spacing.lg }]}>該当なし</Text> : null}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
  modal: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.surface2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, padding: 0 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: 15,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
});
