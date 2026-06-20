import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Sheet } from '../../components/Sheet';
import { useColors } from '../../components/ThemeProvider';
import { focusSessions, workItems } from '../../lib/data';
import { formatDateJa, formatDuration, todayKey } from '../../lib/date';
import { tapLight } from '../../lib/haptics';
import { prefs, usePrefs } from '../../lib/prefs';
import { useCollection } from '../../lib/store';
import { fonts, radius, spacing } from '../../lib/theme';
import { mmss, timer, useTimer } from '../../lib/timer';
import type { SessionKind, SessionStatus, WorkItem } from '../../lib/types';

const RING = 280;
const STROKE = 12;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

const MODES: { key: SessionKind; label: string }[] = [
  { key: 'focus', label: 'Focus' },
  { key: 'short', label: 'Short' },
  { key: 'long', label: 'Long' },
];

export default function FocusScreen() {
  const c = useColors();
  const t = useTimer();
  const p = usePrefs();
  const items = useCollection(workItems);
  const sessionsAll = useCollection(focusSessions);
  const [pickOpen, setPickOpen] = useState(false);

  // re-sync the stopped clock when durations change in Settings
  useEffect(() => {
    timer.syncDuration();
  }, [p.focusMinutes, p.shortMinutes, p.longMinutes, t.kind]);

  // keep the screen awake while running (native only)
  useEffect(() => {
    let active = false;
    let mod: typeof import('expo-keep-awake') | null = null;
    (async () => {
      if (!t.running) return;
      try {
        mod = await import('expo-keep-awake');
        await mod.activateKeepAwakeAsync('focus');
        active = true;
      } catch {
        /* web / unsupported */
      }
    })();
    return () => {
      if (active && mod) void mod.deactivateKeepAwake('focus');
    };
  }, [t.running]);

  const current = useMemo<WorkItem | null>(
    () => items.find((w) => w.id === p.currentWorkItemId) ?? null,
    [items, p.currentWorkItemId],
  );

  const today = sessionsAll.filter((s) => s.date === todayKey() && s.status !== 'aborted');
  const todaySec = today.reduce((a, s) => a + s.duration, 0);
  const todayCount = today.length;

  const progress = t.totalSec > 0 ? t.remainingSec / t.totalSec : 0;
  const dashoffset = CIRC * (1 - progress);
  const ringColor = t.kind === 'focus' ? c.primary : c.accent;

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={['top']}>
      {/* header */}
      <View style={styles.header}>
        <Text style={[styles.date, { color: c.muted }]}>{formatDateJa(todayKey())}</Text>
        <Text style={[styles.heading, { color: c.text }]}>Today Focus</Text>
      </View>
      <Pressable
        onPress={() => {
          tapLight();
          router.push('/immerse');
        }}
        hitSlop={10}
        style={styles.immerseBtn}
      >
        <Feather name="maximize" size={20} color={c.muted} />
      </Pressable>

      {/* mode segment */}
      <View style={[styles.modes, { backgroundColor: c.surface2 }]}>
        {MODES.map((m) => {
          const on = t.kind === m.key;
          return (
            <Pressable
              key={m.key}
              disabled={t.running || !!t.pending}
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
          <Circle cx={RING / 2} cy={RING / 2} r={R} stroke={c.surface2} strokeWidth={STROKE} fill="none" />
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={R}
            stroke={ringColor}
            strokeWidth={STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={dashoffset}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        </Svg>
        <View style={styles.dialCenter}>
          <Text style={[styles.phase, { color: t.kind === 'focus' ? c.primary : c.accent }]}>
            {timer.labelFor(t.kind)}
          </Text>
          <Text style={[styles.time, { color: c.text }]}>{mmss(t.remainingSec)}</Text>
          <Text style={[styles.round, { color: c.muted }]}>
            {t.kind === 'focus' ? `${todayCount + 1}本目` : 'ブレイク'}
          </Text>
        </View>
      </View>

      {/* work item */}
      <Pressable
        onPress={() => {
          tapLight();
          setPickOpen(true);
        }}
        style={[styles.work, { backgroundColor: c.surface, borderColor: c.line }]}
      >
        <Feather name="bookmark" size={16} color={current ? c.primary : c.muted} />
        <Text style={[styles.workTitle, { color: current ? c.text : c.muted }]} numberOfLines={1}>
          {current ? current.title : '作業を選択（任意）'}
        </Text>
        <Feather name="chevron-right" size={18} color={c.muted} />
      </Pressable>

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
          disabled={!!t.pending}
          onPress={() => {
            tapLight();
            const wasRunning = t.running;
            timer.toggle();
            if (!wasRunning && p.immerseOnStart) router.push('/immerse');
          }}
          style={({ pressed }) => [
            styles.start,
            { backgroundColor: t.running ? c.text2 : c.primary },
            pressed && styles.pressed,
            !!t.pending && { opacity: 0.4 },
          ]}
        >
          <Text style={styles.startLabel}>{t.running ? 'STOP' : 'START'}</Text>
        </Pressable>

        <Pressable
          disabled={!t.running}
          onPress={() => {
            tapLight();
            timer.skip();
          }}
          style={({ pressed }) => [
            styles.ctl,
            { backgroundColor: c.surface2 },
            pressed && styles.pressed,
            !t.running && { opacity: 0.4 },
          ]}
        >
          <Feather name="skip-forward" size={20} color={c.text2} />
        </Pressable>
      </View>

      {/* today summary */}
      <Text style={[styles.today, { color: c.muted }]}>
        Today <Text style={{ color: c.text, fontFamily: fonts.maru }}>{formatDuration(todaySec)}</Text>
        {'  /  '}
        <Text style={{ color: c.text, fontFamily: fonts.maru }}>{todayCount}</Text> sessions
      </Text>

      <WorkPicker
        visible={pickOpen}
        items={items}
        currentId={p.currentWorkItemId}
        onClose={() => setPickOpen(false)}
        onPick={(id) => {
          void prefs.set({ currentWorkItemId: id });
          setPickOpen(false);
        }}
      />

      {t.pending ? (
        <CompletionSheet
          workTitle={current?.title ?? null}
          durationSec={t.pending.durationSec}
          onResolve={async (status, note) => {
            const pending = timer.getSnapshot().pending;
            if (pending) {
              await focusSessions.upsert({
                workItemId: pending.workItemId,
                kind: 'focus',
                date: todayKey(),
                startTime: pending.startTime,
                endTime: pending.endTime,
                duration: pending.durationSec,
                status,
                note: note.trim(),
              });
            }
            if (status === 'continued') timer.continueFocus();
            else if (status === 'aborted') timer.abortToFocus();
            else timer.finishToBreak();
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

// ── Work picker ───────────────────────────────────────────────────────────────
function WorkPicker({
  visible,
  items,
  currentId,
  onClose,
  onPick,
}: {
  visible: boolean;
  items: WorkItem[];
  currentId: string | null;
  onClose: () => void;
  onPick: (id: string | null) => void;
}) {
  const c = useColors();
  const [text, setText] = useState('');

  const add = async () => {
    const title = text.trim();
    if (!title) return;
    const item = await workItems.upsert({ title, source: 'manual', sourceId: null, category: '' });
    setText('');
    onPick(item.id);
  };

  return (
    <Sheet visible={visible} title="作業を選ぶ" onClose={onClose}>
      <View style={styles.addRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="作業名を入力"
          placeholderTextColor={c.muted}
          returnKeyType="done"
          onSubmitEditing={() => void add()}
          style={[styles.input, { backgroundColor: c.surface, borderColor: c.line2, color: c.text }]}
        />
        <Pressable onPress={() => void add()} style={[styles.addBtn, { backgroundColor: c.primary }]}>
          <Feather name="plus" size={20} color={c.onAccent} />
        </Pressable>
      </View>

      <Pressable onPress={() => onPick(null)} style={[styles.pickRow, { borderColor: c.line }]}>
        <Feather name="slash" size={16} color={c.muted} />
        <Text style={[styles.pickTitle, { color: c.text2 }]}>作業なしで集中</Text>
        {currentId === null ? <Feather name="check" size={18} color={c.primary} /> : null}
      </Pressable>

      {items.map((w) => {
        const on = w.id === currentId;
        return (
          <Pressable key={w.id} onPress={() => onPick(w.id)} style={[styles.pickRow, { borderColor: c.line }]}>
            <Feather name="bookmark" size={16} color={on ? c.primary : c.muted} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.pickTitle, { color: c.text }]} numberOfLines={1}>
                {w.title}
              </Text>
              {w.category ? <Text style={[styles.pickCat, { color: c.muted }]}>{w.category}</Text> : null}
            </View>
            {on ? <Feather name="check" size={18} color={c.primary} /> : null}
          </Pressable>
        );
      })}
    </Sheet>
  );
}

// ── Completion sheet ──────────────────────────────────────────────────────────
function CompletionSheet({
  workTitle,
  durationSec,
  onResolve,
}: {
  workTitle: string | null;
  durationSec: number;
  onResolve: (status: SessionStatus, note: string) => void;
}) {
  const c = useColors();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const go = (status: SessionStatus) => {
    if (busy) return;
    setBusy(true);
    onResolve(status, note);
  };

  return (
    <Sheet visible title="集中おつかれさま" onClose={() => go('completed')}>
      <View style={[styles.doneCard, { backgroundColor: c.surface, borderColor: c.line }]}>
        <Text style={[styles.doneDur, { color: c.primary }]}>{formatDuration(durationSec)}</Text>
        <Text style={[styles.doneWork, { color: c.text2 }]} numberOfLines={1}>
          {workTitle ?? '作業なし'}
        </Text>
      </View>

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="ひとことメモ（任意・1〜2行）"
        placeholderTextColor={c.muted}
        multiline
        style={[styles.noteInput, { backgroundColor: c.surface, borderColor: c.line2, color: c.text }]}
      />

      <Pressable onPress={() => go('completed')} style={[styles.actBtn, { backgroundColor: c.primary }]}>
        <Text style={[styles.actLabel, { color: c.onAccent }]}>完了</Text>
      </Pressable>
      <Pressable onPress={() => go('continued')} style={[styles.actBtn, { backgroundColor: c.accent }]}>
        <Text style={[styles.actLabel, { color: c.onAccent }]}>もう1セット続ける</Text>
      </Pressable>
      <Pressable
        onPress={() => go('aborted')}
        style={[styles.actBtnGhost, { borderColor: c.line2 }]}
      >
        <Text style={[styles.actLabel, { color: c.muted }]}>中断</Text>
      </Pressable>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, alignItems: 'center', paddingHorizontal: spacing.lg },
  header: { alignItems: 'center', paddingTop: spacing.sm, gap: 2 },
  immerseBtn: { position: 'absolute', top: spacing.sm, right: 2, width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  date: { fontFamily: fonts.gothicMed, fontSize: 12, letterSpacing: 0.5 },
  heading: { fontFamily: fonts.maru, fontSize: 20, letterSpacing: 0.5 },
  modes: { flexDirection: 'row', borderRadius: radius.pill, padding: 4, marginTop: spacing.md },
  modeBtn: { paddingVertical: 8, paddingHorizontal: 22, borderRadius: radius.pill },
  modeLabel: { fontFamily: fonts.gothicBold, fontSize: 12.5, letterSpacing: 0.3 },
  dialWrap: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: RING },
  dialCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', gap: 6 },
  phase: { fontFamily: fonts.gothicBold, fontSize: 12, letterSpacing: 2 },
  time: { fontFamily: fonts.maruBlack, fontSize: 68, fontVariant: ['tabular-nums'], letterSpacing: 1 },
  round: { fontFamily: fonts.gothicMed, fontSize: 12 },
  work: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    alignSelf: 'stretch',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.lg,
  },
  workTitle: { flex: 1, fontFamily: fonts.gothicMed, fontSize: 15 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg, marginBottom: spacing.md },
  ctl: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  start: { minWidth: 168, height: 58, paddingHorizontal: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  startLabel: { color: '#fff', fontFamily: fonts.gothicBold, fontSize: 16, letterSpacing: 2 },
  pressed: { opacity: 0.7, transform: [{ scale: 0.97 }] },
  today: { fontFamily: fonts.gothicMed, fontSize: 13, marginBottom: spacing.lg },
  // picker
  addRow: { flexDirection: 'row', gap: spacing.sm },
  input: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 12, fontFamily: fonts.gothic, fontSize: 15 },
  addBtn: { width: 48, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  pickRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  pickTitle: { fontFamily: fonts.gothicMed, fontSize: 15 },
  pickCat: { fontFamily: fonts.gothic, fontSize: 11, marginTop: 1 },
  // completion
  doneCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.md, paddingVertical: spacing.lg, alignItems: 'center', gap: 4 },
  doneDur: { fontFamily: fonts.maruBlack, fontSize: 30 },
  doneWork: { fontFamily: fonts.gothicMed, fontSize: 14 },
  noteInput: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.sm, paddingHorizontal: spacing.md, paddingVertical: 12, minHeight: 64, textAlignVertical: 'top', fontFamily: fonts.gothic, fontSize: 15 },
  actBtn: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  actBtnGhost: { height: 52, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', borderWidth: StyleSheet.hairlineWidth },
  actLabel: { fontFamily: fonts.gothicBold, fontSize: 15 },
});
