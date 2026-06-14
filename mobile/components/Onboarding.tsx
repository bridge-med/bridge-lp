// First-run onboarding: 3 paged slides shown until the user finishes.

import { useRef, useState } from 'react';
import {
  Dimensions,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { prefs } from '../lib/prefs';
import { radius, spacing, type } from '../lib/theme';
import { useColors } from './ThemeProvider';

const SLIDES = [
  { icon: '✓', title: 'やることを、すぐに', body: '思いついたタスクを1タップで追加。期限・優先度・タグで自然に整理されます。' },
  { icon: '✎', title: 'メモも日記も一緒に', body: '走り書きのメモも、今日の気分と一言の日記も、同じ場所に。すべて端末内に保存されます。' },
  { icon: '📊', title: '続けるほど見えてくる', body: 'ふりかえりで連続日数や気分の傾向を可視化。AI整理も使えて、毎日の記録が力になります。' },
];

export function Onboarding({ visible }: { visible: boolean }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { width } = Dimensions.get('window');
  const ref = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  }

  function next() {
    if (index < SLIDES.length - 1) {
      ref.current?.scrollTo({ x: width * (index + 1), animated: true });
    } else {
      void prefs.set({ onboardingDone: true });
    }
  }

  return (
    <Modal visible={visible} animationType="fade">
      <View style={[styles.container, { backgroundColor: c.surface }]}>
        <Pressable
          onPress={() => void prefs.set({ onboardingDone: true })}
          style={[styles.skip, { top: insets.top + spacing.sm }]}
          hitSlop={12}
        >
          <Text style={[type.muted, { fontWeight: '600' }]}>スキップ</Text>
        </Pressable>

        <ScrollView
          ref={ref}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={16}
        >
          {SLIDES.map((s) => (
            <View key={s.title} style={[styles.slide, { width }]}>
              <View style={[styles.iconWrap, { backgroundColor: c.primaryWeak }]}>
                <Text style={[styles.icon, { color: c.primary }]}>{s.icon}</Text>
              </View>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={[type.body, { color: c.text2, textAlign: 'center' }]}>{s.body}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg }]}>
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, { backgroundColor: i === index ? c.primary : c.line2 }, i === index && styles.dotActive]}
              />
            ))}
          </View>
          <Pressable onPress={next} style={[styles.btn, { backgroundColor: c.primary }]}>
            <Text style={styles.btnText}>{index < SLIDES.length - 1 ? '次へ' : 'はじめる'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  skip: { position: 'absolute', right: spacing.lg, zIndex: 2 },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.xl, gap: spacing.lg },
  iconWrap: { width: 96, height: 96, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  icon: { fontSize: 44, fontWeight: '700' },
  title: { fontSize: 24, fontWeight: '800', textAlign: 'center' },
  footer: { paddingHorizontal: spacing.lg, gap: spacing.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 22 },
  btn: { borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
