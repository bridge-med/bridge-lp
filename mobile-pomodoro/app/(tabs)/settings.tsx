import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../../components/ThemeProvider';
import { clearAll } from '../../lib/data';
import { prefs, usePrefs } from '../../lib/prefs';
import { fonts, radius, spacing, type as ty, type ThemeMode } from '../../lib/theme';

const THEMES: { key: ThemeMode; label: string }[] = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'system', label: 'System' },
];

export default function SettingsScreen() {
  const c = useColors();
  const p = usePrefs();

  const onReset = () => {
    Alert.alert('記録をすべて削除', '集中記録と作業をすべて消します。元に戻せません。', [
      { text: 'やめる', style: 'cancel' },
      { text: '削除する', style: 'destructive', onPress: () => void clearAll() },
    ]);
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={[ty.h1, { color: c.text, marginBottom: spacing.lg }]}>Settings</Text>

        <Section label="Timer">
          <Stepper label="Focus duration" value={p.focusMinutes} min={1} max={90} step={5} onChange={(v) => prefs.set({ focusMinutes: v })} />
          <Stepper label="Short break" value={p.shortMinutes} min={1} max={30} step={1} onChange={(v) => prefs.set({ shortMinutes: v })} />
          <Stepper label="Long break" value={p.longMinutes} min={1} max={60} step={5} onChange={(v) => prefs.set({ longMinutes: v })} />
          <Stepper label="Long break every" value={p.longEvery} min={2} max={8} step={1} unit="本" onChange={(v) => prefs.set({ longEvery: v })} last />
        </Section>

        <Section label="Notification">
          <Toggle label="Sound" value={p.soundEnabled} onChange={(v) => prefs.set({ soundEnabled: v })} />
          <Toggle label="Vibration" value={p.vibrationEnabled} onChange={(v) => prefs.set({ vibrationEnabled: v })} last />
        </Section>

        <Section label="Theme">
          <View style={styles.segment}>
            {THEMES.map((tm) => {
              const on = p.theme === tm.key;
              return (
                <Pressable
                  key={tm.key}
                  onPress={() => prefs.set({ theme: tm.key })}
                  style={[styles.segBtn, { backgroundColor: on ? c.primary : c.surface2 }]}
                >
                  <Text style={[styles.segLabel, { color: on ? c.onAccent : c.text2 }]}>{tm.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section label="Data">
          <Pressable onPress={onReset} style={[styles.row, styles.rowLast]}>
            <Text style={[styles.rowLabel, { color: c.danger }]}>記録をすべて削除</Text>
            <Feather name="trash-2" size={18} color={c.danger} />
          </Pressable>
        </Section>

        <Text style={[styles.foot, { color: c.muted }]}>BRIDGE Focus · データは端末内にのみ保存されます</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Text style={[styles.secLabel, { color: c.muted }]}>{label}</Text>
      <View style={[styles.group, { backgroundColor: c.surface, borderColor: c.line }]}>{children}</View>
    </View>
  );
}

function Stepper({
  label,
  value,
  min,
  max,
  step,
  unit = '分',
  onChange,
  last,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  last?: boolean;
}) {
  const c = useColors();
  const set = (d: number) => onChange(Math.max(min, Math.min(max, value + d * step)));
  return (
    <View style={[styles.row, last ? styles.rowLast : { borderBottomColor: c.line }]}>
      <Text style={[styles.rowLabel, { color: c.text2 }]}>{label}</Text>
      <View style={[styles.stepper, { backgroundColor: c.surface2 }]}>
        <Pressable onPress={() => set(-1)} style={[styles.stepBtn, { backgroundColor: c.surface }]}>
          <Feather name="minus" size={16} color={c.text2} />
        </Pressable>
        <Text style={[styles.stepVal, { color: c.text }]}>
          {value}
          <Text style={[styles.stepUnit, { color: c.muted }]}>{unit}</Text>
        </Text>
        <Pressable onPress={() => set(1)} style={[styles.stepBtn, { backgroundColor: c.surface }]}>
          <Feather name="plus" size={16} color={c.text2} />
        </Pressable>
      </View>
    </View>
  );
}

function Toggle({ label, value, onChange, last }: { label: string; value: boolean; onChange: (v: boolean) => void; last?: boolean }) {
  const c = useColors();
  return (
    <Pressable onPress={() => onChange(!value)} style={[styles.row, last ? styles.rowLast : { borderBottomColor: c.line }]}>
      <Text style={[styles.rowLabel, { color: c.text2 }]}>{label}</Text>
      <View style={[styles.track, { backgroundColor: value ? c.primary : c.line2 }]}>
        <View style={[styles.knob, value && styles.knobOn]} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: spacing.lg, paddingBottom: spacing.xl * 2 },
  secLabel: { fontFamily: fonts.gothicBold, fontSize: 11, letterSpacing: 1.5, marginBottom: spacing.sm },
  group: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontFamily: fonts.gothicMed, fontSize: 14, flexShrink: 1, paddingRight: spacing.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, padding: 3, gap: 2 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepVal: { fontFamily: fonts.maru, fontSize: 15, minWidth: 52, textAlign: 'center' },
  stepUnit: { fontFamily: fonts.gothicMed, fontSize: 11 },
  track: { width: 48, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center' },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  knobOn: { transform: [{ translateX: 20 }] },
  segment: { flexDirection: 'row', gap: spacing.sm, paddingVertical: spacing.md },
  segBtn: { flex: 1, paddingVertical: 11, borderRadius: radius.sm, alignItems: 'center' },
  segLabel: { fontFamily: fonts.gothicBold, fontSize: 13 },
  foot: { fontFamily: fonts.gothic, fontSize: 11, textAlign: 'center', marginTop: spacing.sm },
});
