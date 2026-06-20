import { Feather } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useColors } from '../../components/ThemeProvider';
import { buildExport, clearAll } from '../../lib/data';
import { cancelDaily, isNotifSupported, requestPermission, scheduleDaily } from '../../lib/notifications';
import { prefs, usePrefs } from '../../lib/prefs';
import { ACCENTS, type AccentKey, fonts, radius, spacing, type } from '../../lib/theme';

export default function SettingsScreen() {
  const c = useColors();
  const p = usePrefs();

  const onExport = async () => {
    try {
      await Share.share({ message: JSON.stringify(buildExport(), null, 2) });
    } catch {
      // user cancelled — ignore
    }
  };

  const onReset = () => {
    Alert.alert('記録をすべて削除', 'これまでの集中記録を消します。元に戻せません。', [
      { text: 'やめる', style: 'cancel' },
      { text: '削除する', style: 'destructive', onPress: () => void clearAll() },
    ]);
  };

  const toggleReminder = async (next: boolean) => {
    if (next) {
      const ok = await requestPermission();
      if (!ok) {
        Alert.alert('通知が許可されていません', '端末の設定から通知を有効にしてください。');
        return;
      }
      await prefs.set({ reminderEnabled: true });
      await scheduleDaily(p.reminderHour, p.reminderMinute);
    } else {
      await prefs.set({ reminderEnabled: false });
      await cancelDaily();
    }
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={[type.h1, { marginBottom: spacing.lg }]}>設定</Text>

        <Section label="時間（分）">
          <Stepper label="集中" value={p.focusMinutes} min={1} max={90} step={5} onChange={(v) => prefs.set({ focusMinutes: v })} />
          <Stepper label="小休憩" value={p.shortMinutes} min={1} max={30} step={1} onChange={(v) => prefs.set({ shortMinutes: v })} />
          <Stepper label="長休憩" value={p.longMinutes} min={1} max={60} step={5} onChange={(v) => prefs.set({ longMinutes: v })} />
          <Stepper
            label="長休憩までの本数"
            value={p.longEvery}
            min={2}
            max={8}
            step={1}
            unit="本"
            onChange={(v) => prefs.set({ longEvery: v })}
            last
          />
        </Section>

        <Section label="動作">
          <Toggle label="休憩を自動で開始" value={p.autoStartBreaks} onChange={(v) => prefs.set({ autoStartBreaks: v })} />
          <Toggle label="集中を自動で開始" value={p.autoStartFocus} onChange={(v) => prefs.set({ autoStartFocus: v })} />
          <Toggle label="終了時に音・通知" value={p.soundEnabled} onChange={(v) => prefs.set({ soundEnabled: v })} />
          <Toggle label="計測中は画面を消さない" value={p.keepAwake} onChange={(v) => prefs.set({ keepAwake: v })} last />
        </Section>

        <Section label="テーマ">
          <View style={styles.accentRow}>
            {(Object.keys(ACCENTS) as AccentKey[]).map((k) => {
              const a = ACCENTS[k];
              const on = p.accent === k;
              return (
                <Pressable key={k} onPress={() => prefs.set({ accent: k })} style={styles.accentItem}>
                  <View
                    style={[
                      styles.swatch,
                      { backgroundColor: a.primary, borderColor: on ? c.text : 'transparent' },
                    ]}
                  >
                    {on ? <Feather name="check" size={16} color="#fff" /> : null}
                  </View>
                  <Text style={[styles.accentLabel, { color: on ? c.text : c.muted }]}>{a.label}</Text>
                </Pressable>
              );
            })}
          </View>
        </Section>

        {isNotifSupported() ? (
          <Section label="リマインダー">
            <Toggle
              label={`毎日 ${pad(p.reminderHour)}:${pad(p.reminderMinute)} に通知`}
              value={p.reminderEnabled}
              onChange={(v) => void toggleReminder(v)}
            />
            <View style={styles.timeRow}>
              <Stepper label="時" value={p.reminderHour} min={0} max={23} step={1} unit="" compact
                onChange={(v) => {
                  void prefs.set({ reminderHour: v });
                  if (p.reminderEnabled) void scheduleDaily(v, p.reminderMinute);
                }}
              />
              <Stepper label="分" value={p.reminderMinute} min={0} max={55} step={5} unit="" compact last
                onChange={(v) => {
                  void prefs.set({ reminderMinute: v });
                  if (p.reminderEnabled) void scheduleDaily(p.reminderHour, v);
                }}
              />
            </View>
          </Section>
        ) : null}

        <Section label="データ">
          <Pressable onPress={onExport} style={[styles.row, { borderBottomColor: c.line }]}>
            <Text style={[styles.rowLabel, { color: c.text2 }]}>バックアップを書き出す</Text>
            <Feather name="share" size={18} color={c.muted} />
          </Pressable>
          <Pressable onPress={onReset} style={[styles.row, styles.rowLast]}>
            <Text style={[styles.rowLabel, { color: c.danger }]}>記録をすべて削除</Text>
            <Feather name="trash-2" size={18} color={c.danger} />
          </Pressable>
        </Section>

        <Text style={[styles.foot, { color: c.muted }]}>BRIDGE Pomodoro · データは端末内にのみ保存されます</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  const c = useColors();
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Text style={[type.label, { marginBottom: spacing.sm }]}>{label}</Text>
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
  compact,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (v: number) => void;
  last?: boolean;
  compact?: boolean;
}) {
  const c = useColors();
  const set = (d: number) => onChange(Math.max(min, Math.min(max, value + d * step)));
  return (
    <View style={[styles.row, last ? styles.rowLast : { borderBottomColor: c.line }, compact && { flex: 1 }]}>
      <Text style={[styles.rowLabel, { color: c.text2 }]}>{label}</Text>
      <View style={[styles.stepper, { backgroundColor: c.surface2 }]}>
        <Pressable onPress={() => set(-1)} style={[styles.stepBtn, { backgroundColor: c.surface }]}>
          <Feather name="minus" size={16} color={c.text2} />
        </Pressable>
        <Text style={[styles.stepVal, { color: c.text }]}>
          {value}
          {unit ? <Text style={[styles.stepUnit, { color: c.muted }]}>{unit}</Text> : null}
        </Text>
        <Pressable onPress={() => set(1)} style={[styles.stepBtn, { backgroundColor: c.surface }]}>
          <Feather name="plus" size={16} color={c.text2} />
        </Pressable>
      </View>
    </View>
  );
}

function Toggle({
  label,
  value,
  onChange,
  last,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
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
  group: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingHorizontal: spacing.lg },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLast: { borderBottomWidth: 0 },
  rowLabel: { fontFamily: fonts.gothicMed, fontSize: 14, flexShrink: 1, paddingRight: spacing.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.pill, padding: 3, gap: 2 },
  stepBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  stepVal: { fontFamily: fonts.maru, fontSize: 15, minWidth: 52, textAlign: 'center' },
  stepUnit: { fontFamily: fonts.gothicMed, fontSize: 11 },
  track: { width: 48, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center' },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff' },
  knobOn: { transform: [{ translateX: 20 }] },
  accentRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.md },
  accentItem: { alignItems: 'center', gap: 6 },
  swatch: { width: 40, height: 40, borderRadius: 20, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  accentLabel: { fontFamily: fonts.gothicMed, fontSize: 11 },
  timeRow: { flexDirection: 'row', gap: spacing.md, paddingTop: spacing.sm },
  foot: { fontFamily: fonts.gothic, fontSize: 11, textAlign: 'center', marginTop: spacing.sm },
});
