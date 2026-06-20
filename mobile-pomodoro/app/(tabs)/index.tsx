import { Feather } from '@expo/vector-icons';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { useColors } from '../../components/ThemeProvider';
import { useCollection } from '../../lib/store';
import { sessions } from '../../lib/data';
import { todayKey } from '../../lib/date';
import { tapLight } from '../../lib/haptics';
import { ACCENTS, fonts, radius, spacing } from '../../lib/theme';
import { mmss, timer, useTimer } from '../../lib/timer';
import { usePrefs } from '../../lib/prefs';
import type { SessionKind } from '../../lib/types';

const RING = 264; // diameter
const STROKE = 14;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

const MODES: { key: SessionKind; label: string }[] = [
  { key: 'focus', label: '集中' },
  { key: 'short', label: '小休憩' },
  { key: 'long', label: '長休憩' },
];

// Each mode borrows a hue from the warm accent family.
const MODE_ACCENT: Record<SessionKind, keyof typeof ACCENTS> = {
  focus: 'shu', // coral
  short: 'koke', // leaf
  long: 'kon', // sky
};

export default function TimerScreen() {
  const c = useColors();
  const t = useTimer();
  usePrefs(); // re-render when durations change while stopped
  const all = useCollection(sessions);
  const today = all.filter((s) => s.date === todayKey()).length;

  // Keep the device awake while a timer is running (native only; no-op on web).
  useEffect(() => {
    let active = false;
    let mod: typeof import('expo-keep-awake') | null = null;
    (async () => {
      if (!t.running) return;
      try {
        mod = await import('expo-keep-awake');
        await mod.activateKeepAwakeAsync('pomodoro');
        active = true;
      } catch {
        // module unavailable (e.g. web) — ignore
      }
    })();
    return () => {
      if (active && mod) void mod.deactivateKeepAwake('pomodoro');
    };
  }, [t.running]);

  const accent = ACCENTS[MODE_ACCENT[t.kind]];
  const progress = t.totalSec > 0 ? t.remainingSec / t.totalSec : 0;
  const dashoffset = CIRC * (1 - progress);

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.brand}>
          BRIDGE<Text style={{ color: accent.primary }}> Pomodoro</Text>
        </Text>
      </View>

      {/* mode switch */}
      <View style={[styles.modes, { backgroundColor: c.surface2 }]}>
        {MODES.map((m) => {
          const on = t.kind === m.key;
          return (
            <Pressable
              key={m.key}
              onPress={() => {
                tapLight();
                timer.setKind(m.key);
              }}
              style={[styles.modeBtn, on && { backgroundColor: c.surface }]}
            >
              <Text style={[styles.modeLabel, { color: on ? c.text : c.muted }]}>{m.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* dial */}
      <View style={styles.dialWrap}>
        <Svg width={RING} height={RING}>
          <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={c.line} strokeWidth={STROKE} fill="none" />
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            stroke={accent.primary}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={dashoffset}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </Svg>
        <View style={styles.dialCenter}>
          <Text style={[styles.phase, { color: accent.primary }]}>{timer.labelFor(t.kind)}</Text>
          <Text style={[styles.time, { color: c.text }]}>{mmss(t.remainingSec)}</Text>
          <Text style={[styles.round, { color: c.muted }]}>
            {t.kind === 'focus' ? `${t.completedFocus + 1} 本目` : 'ブレイク'}
          </Text>
        </View>
      </View>

      {/* controls */}
      <View style={styles.controls}>
        <Pressable
          onPress={() => {
            tapLight();
            timer.reset();
          }}
          style={({ pressed }) => [styles.ctl, { backgroundColor: c.surface2 }, pressed && styles.pressed]}
        >
          <Feather name="rotate-ccw" size={20} color={c.text2} />
        </Pressable>

        <Pressable
          onPress={() => {
            tapLight();
            timer.toggle();
          }}
          style={({ pressed }) => [
            styles.start,
            { backgroundColor: t.running ? c.text : accent.primary },
            pressed && styles.pressed,
          ]}
        >
          <Text style={styles.startLabel}>{t.running ? 'ストップ' : 'スタート'}</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            tapLight();
            timer.skip();
          }}
          style={({ pressed }) => [styles.ctl, { backgroundColor: c.surface2 }, pressed && styles.pressed]}
        >
          <Feather name="skip-forward" size={20} color={c.text2} />
        </Pressable>
      </View>

      <Text style={[styles.today, { color: c.muted }]}>
        今日の集中 <Text style={{ color: c.text, fontFamily: fonts.maru }}>{today}</Text> 本
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, alignItems: 'center' },
  header: { paddingTop: spacing.md, paddingBottom: spacing.sm },
  brand: { fontFamily: fonts.gothicBold, fontSize: 14, letterSpacing: 2 },
  modes: { flexDirection: 'row', borderRadius: radius.pill, padding: 4, marginTop: spacing.sm },
  modeBtn: { paddingVertical: 9, paddingHorizontal: 20, borderRadius: radius.pill },
  modeLabel: { fontFamily: fonts.gothicBold, fontSize: 13 },
  dialWrap: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  dialCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', gap: 4 },
  phase: { fontFamily: fonts.gothicBold, fontSize: 13, letterSpacing: 1 },
  time: { fontFamily: fonts.maruBlack, fontSize: 64, fontVariant: ['tabular-nums'], letterSpacing: 1 },
  round: { fontFamily: fonts.gothicMed, fontSize: 12, letterSpacing: 1 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.lg },
  ctl: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  start: {
    minWidth: 156,
    height: 58,
    paddingHorizontal: 30,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  startLabel: { color: '#fff', fontFamily: fonts.gothicBold, fontSize: 16, letterSpacing: 1 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  today: { fontFamily: fonts.gothicMed, fontSize: 13, marginBottom: spacing.xl },
});
