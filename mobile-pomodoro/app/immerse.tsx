// Immersive focus — the "don't touch your phone" view.
// Full-screen, dimmed, with a softly breathing ring and a low-contrast clock.
// Tap to briefly reveal pause / exit; controls fade away on their own. When the
// interval completes we drop back so the Focus screen can show the wrap-up sheet.

import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { workItems } from '../lib/data';
import { prefs, usePrefs } from '../lib/prefs';
import { useCollection } from '../lib/store';
import { fonts } from '../lib/theme';
import { mmss, timer, useTimer } from '../lib/timer';

const RING = 300;
const STROKE = 3;
const R = (RING - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const NATIVE = Platform.OS !== 'web';

const INK = 'rgba(236,239,244,0.92)';
const INK_DIM = 'rgba(236,239,244,0.42)';
const RINGC = 'rgba(150,180,215,0.9)';

export default function ImmerseScreen() {
  const t = useTimer();
  const p = usePrefs();
  const insets = useSafeAreaInsets();
  const items = useCollection(workItems);
  const current = items.find((w) => w.id === p.currentWorkItemId) ?? null;

  const breath = useRef(new Animated.Value(0)).current;
  const ctl = useRef(new Animated.Value(1)).current;
  const [showControls, setShowControls] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // breathing loop (~8s in/out)
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breath, { toValue: 1, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
        Animated.timing(breath, { toValue: 0, duration: 4000, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [breath]);

  // keep the screen awake in here too (native only)
  useEffect(() => {
    let active = false;
    let mod: typeof import('expo-keep-awake') | null = null;
    (async () => {
      try {
        mod = await import('expo-keep-awake');
        await mod.activateKeepAwakeAsync('immerse');
        active = true;
      } catch {
        /* web / unsupported */
      }
    })();
    return () => {
      if (active && mod) void mod.deactivateKeepAwake('immerse');
    };
  }, []);

  // when the interval ends, return so the wrap-up sheet appears on Focus
  useEffect(() => {
    if (t.pending) router.back();
  }, [t.pending]);

  const reveal = () => {
    setShowControls(true);
    Animated.timing(ctl, { toValue: 1, duration: 180, useNativeDriver: NATIVE }).start();
    if (hideTimer.current) clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => {
      Animated.timing(ctl, { toValue: 0, duration: 600, useNativeDriver: NATIVE }).start(({ finished }) => {
        if (finished) setShowControls(false);
      });
    }, 3500);
  };

  useEffect(() => {
    reveal();
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const haloOpacity = breath.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.5] });
  const progress = t.totalSec > 0 ? t.remainingSec / t.totalSec : 0;
  const dashoffset = CIRC * (1 - progress);

  return (
    <View style={styles.root}>
      <StatusBar style="light" hidden />
      <Pressable style={styles.fill} onPress={reveal}>
        <View style={styles.center}>
          {current ? (
            <Text style={styles.work} numberOfLines={1}>
              {current.title}
            </Text>
          ) : null}

          <Animated.View style={{ transform: [{ scale }], alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={[styles.halo, { opacity: haloOpacity }]} />
            <Svg width={RING} height={RING}>
              <Circle cx={RING / 2} cy={RING / 2} r={R} stroke="rgba(255,255,255,0.06)" strokeWidth={STROKE} fill="none" />
              <Circle
                cx={RING / 2}
                cy={RING / 2}
                r={R}
                stroke={RINGC}
                strokeWidth={STROKE}
                fill="none"
                strokeLinecap="round"
                strokeDasharray={CIRC}
                strokeDashoffset={dashoffset}
                transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
              />
            </Svg>
            <View style={styles.dialCenter}>
              <Text style={styles.time}>{mmss(t.remainingSec)}</Text>
            </View>
          </Animated.View>

          <Text style={styles.hint}>{t.running ? '集中中' : '一時停止中'}</Text>
        </View>

        {showControls ? (
          <Animated.View style={[styles.controls, { opacity: ctl, paddingBottom: insets.bottom + 28 }]}>
            <Pressable
              onPress={() => {
                timer.toggle();
                reveal();
              }}
              style={styles.ctlBtn}
            >
              <Feather name={t.running ? 'pause' : 'play'} size={26} color={INK} />
            </Pressable>
            <Pressable onPress={() => router.back()} style={styles.ctlBtn}>
              <Feather name="minimize-2" size={22} color={INK} />
            </Pressable>
          </Animated.View>
        ) : null}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0C0F14' },
  fill: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 36 },
  work: { fontFamily: fonts.gothicMed, fontSize: 14, color: INK_DIM, letterSpacing: 1, paddingHorizontal: 40 },
  halo: { position: 'absolute', width: RING - 30, height: RING - 30, borderRadius: RING, backgroundColor: 'rgba(120,160,205,0.35)' },
  dialCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  time: { fontFamily: fonts.maruBlack, fontSize: 72, color: INK, fontVariant: ['tabular-nums'], letterSpacing: 1 },
  hint: { fontFamily: fonts.gothicMed, fontSize: 12, color: INK_DIM, letterSpacing: 3 },
  controls: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', justifyContent: 'center', gap: 20 },
  ctlBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
});
