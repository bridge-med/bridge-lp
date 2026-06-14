// Pure-JS calendar date picker (no native deps; works in Expo Go + web).

import { Feather } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDateJa, parseKey, todayKey } from '../lib/date';
import { colors, fonts, radius, spacing, type } from '../lib/theme';
import { useColors } from './ThemeProvider';

const WD = ['日', '月', '火', '水', '木', '金', '土'];

function key(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function CalendarModal({
  visible,
  value,
  onClose,
  onSelect,
}: {
  visible: boolean;
  value: string | null;
  onClose: () => void;
  onSelect: (v: string) => void;
}) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const base = value ? parseKey(value) : new Date();
  const [cursor, setCursor] = useState({ y: base.getFullYear(), m: base.getMonth() });

  const first = new Date(cursor.y, cursor.m, 1);
  const startPad = first.getDay();
  const daysInMonth = new Date(cursor.y, cursor.m + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < startPad; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.y, cursor.m, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const move = (delta: number) => {
    const m = cursor.m + delta;
    setCursor({ y: cursor.y + Math.floor(m / 12), m: ((m % 12) + 12) % 12 });
  };

  const today = todayKey();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.wrap, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Pressable onPress={() => move(-1)} hitSlop={12}>
              <Feather name="chevron-left" size={22} color={colors.text} />
            </Pressable>
            <Text style={styles.month}>
              {cursor.y}年{cursor.m + 1}月
            </Text>
            <Pressable onPress={() => move(1)} hitSlop={12}>
              <Feather name="chevron-right" size={22} color={colors.text} />
            </Pressable>
          </View>

          <View style={styles.weekRow}>
            {WD.map((w, i) => (
              <Text key={w} style={[styles.wd, i === 0 && { color: c.primary }]}>
                {w}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {cells.map((d, i) => {
              if (!d) return <View key={i} style={styles.cell} />;
              const k = key(d);
              const selected = k === value;
              const isToday = k === today;
              return (
                <Pressable
                  key={i}
                  style={styles.cell}
                  onPress={() => {
                    onSelect(k);
                    onClose();
                  }}
                >
                  <View style={[styles.day, selected && { backgroundColor: c.primary }]}>
                    <Text style={[styles.dayText, isToday && !selected && { color: c.primary }, selected && { color: '#fff' }]}>
                      {d.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.quick}>
            <Pressable onPress={() => { onSelect(today); onClose(); }}>
              <Text style={[styles.quickLink, { color: c.primary }]}>今日</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                const y = new Date();
                y.setDate(y.getDate() - 1);
                onSelect(key(y));
                onClose();
              }}
            >
              <Text style={[styles.quickLink, { color: c.primary }]}>昨日</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export function DateField({
  label,
  value,
  onChange,
  placeholder = '日付を選ぶ',
}: {
  label?: string;
  value: string | null;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <Text style={type.label}>{label}</Text> : null}
      <Pressable onPress={() => setOpen(true)} style={styles.field}>
        <Text style={[type.body, !value && { color: colors.muted }]}>{value ? formatDateJa(value) : placeholder}</Text>
        <Feather name="calendar" size={17} color={colors.muted} />
      </Pressable>
      <CalendarModal visible={open} value={value} onClose={() => setOpen(false)} onSelect={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(35,38,46,0.35)' },
  wrap: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: spacing.md },
  sheet: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  month: { fontFamily: fonts.minchoSemi, fontSize: 20, color: colors.text },
  weekRow: { flexDirection: 'row' },
  wd: { flex: 1, textAlign: 'center', fontFamily: fonts.gothicMed, fontSize: 11, color: colors.muted, paddingBottom: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  day: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontFamily: fonts.gothic, fontSize: 15, color: colors.text },
  quick: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xl, marginTop: spacing.md, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  quickLink: { fontFamily: fonts.gothicMed, fontSize: 14 },
  field: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line2,
    borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 12,
  },
});
