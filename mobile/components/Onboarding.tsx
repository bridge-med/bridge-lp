// First-run onboarding: 3 intro slides, then a short setup
// (呼ばれたい名前 / 職種 / 相棒の名前 / リマインダー).

import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PROFESSIONS } from '../lib/constants';
import { isNotifSupported, requestPermission, scheduleDaily } from '../lib/notifications';
import { prefs } from '../lib/prefs';
import { colors, fonts, radius, spacing, type } from '../lib/theme';
import { Field } from './ui';
import { Picker } from './Picker';
import { useColors } from './ThemeProvider';

const SLIDES = [
  { emoji: '📝', title: '毎日の仕事ログを、\n未来のキャリア資産に。', body: 'やったこと・工夫・学びを、1日3分で残せます。' },
  { emoji: '🌱', title: 'ログを書くと、\n相棒が育ちます。', body: '小さな記録が、XP・称号・連続記録になります。' },
  { emoji: '💼', title: '必要なときに、職務経歴書・\n面接・1on1の材料へ。', body: 'AIはアプリ内で完結。データは端末内に保存されます。' },
];

export function Onboarding({ visible }: { visible: boolean }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(0); // 0..2 slides, 3 setup
  const [userName, setUserName] = useState('');
  const [profession, setProfession] = useState('');
  const [buddyName, setBuddyName] = useState('');
  const [reminder, setReminder] = useState(true);

  async function finish() {
    await prefs.set({
      userName: userName.trim().slice(0, 12),
      profession,
      buddyName: buddyName.trim().slice(0, 12),
      reminderEnabled: reminder && isNotifSupported(),
      onboardingDone: true,
    });
    if (reminder && isNotifSupported()) {
      const ok = await requestPermission();
      if (ok) await scheduleDaily(21, 0);
      else await prefs.set({ reminderEnabled: false });
    }
  }

  const isSetup = step === 3;

  return (
    <Modal visible={visible} animationType="slide">
      <View style={[styles.container, { backgroundColor: c.bg, paddingTop: insets.top }]}>
        {!isSetup ? (
          <View style={styles.slide}>
            <Text style={styles.badge}>しごとログ</Text>
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg }}>
              <View style={[styles.emojiWrap, { backgroundColor: c.primaryWeak }]}>
                <Text style={styles.emoji}>{SLIDES[step].emoji}</Text>
              </View>
              <Text style={styles.title}>{SLIDES[step].title}</Text>
              <Text style={[type.body, { color: c.text2, textAlign: 'center', paddingHorizontal: spacing.lg }]}>{SLIDES[step].body}</Text>
            </View>
            <View style={styles.dots}>
              {SLIDES.map((_, i) => (
                <View key={i} style={[styles.dot, { backgroundColor: i === step ? c.primary : colors.line2 }]} />
              ))}
            </View>
            <Pressable onPress={() => setStep(step + 1)} style={[styles.btn, { backgroundColor: c.primary }]}>
              <Text style={styles.btnText}>{step < 2 ? '次へ' : 'はじめる'}</Text>
            </Pressable>
            <Pressable onPress={() => void finish()} hitSlop={8} style={{ alignItems: 'center', paddingTop: spacing.sm, paddingBottom: insets.bottom + spacing.sm }}>
              <Text style={type.muted}>スキップ</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 100, gap: spacing.lg }}>
              <View style={{ gap: spacing.xs }}>
                <Text style={styles.badge}>はじめる前に、少しだけ</Text>
                <Text style={styles.setupTitle}>あなたと相棒のこと</Text>
              </View>
              <Field label="呼ばれたい名前" placeholder="例）ひろ" value={userName} onChangeText={setUserName} />
              <Picker label="職種" options={PROFESSIONS} value={profession} onChange={setProfession} placeholder="職種を選択" />
              <Field label="相棒の名前" placeholder="例）もりもり" value={buddyName} onChangeText={setBuddyName} />
              <View style={[styles.reminderRow, { borderColor: colors.line }]}>
                <View style={{ flex: 1 }}>
                  <Text style={type.title}>毎日のリマインダー</Text>
                  <Text style={[type.muted, { color: colors.text2 }]}>
                    {isNotifSupported() ? '夜21時に「書こう」と相棒がそっと通知（後で変更可）' : 'プレビューでは使えません。実機アプリで有効です。'}
                  </Text>
                </View>
                <Switch value={reminder} onValueChange={setReminder} disabled={!isNotifSupported()} trackColor={{ true: c.primary, false: colors.line2 }} thumbColor="#fff" />
              </View>
            </ScrollView>
            <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg, backgroundColor: c.bg, borderTopColor: c.line }]}>
              <Pressable onPress={() => void finish()} style={[styles.btn, { backgroundColor: c.primary }]}>
                <Text style={styles.btnText}>はじめる</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  slide: { flex: 1, paddingHorizontal: spacing.lg },
  badge: { fontFamily: fonts.gothicBold, fontSize: 11, letterSpacing: 2, color: colors.primary, paddingTop: spacing.md },
  emojiWrap: { width: 132, height: 132, borderRadius: 66, alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 64 },
  title: { fontFamily: fonts.maruBlack, fontSize: 26, color: colors.text, textAlign: 'center', lineHeight: 38 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginBottom: spacing.lg },
  dot: { width: 8, height: 8, borderRadius: 4 },
  btn: { height: 54, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  btnText: { fontFamily: fonts.maru, fontSize: 16, color: '#fff' },
  setupTitle: { fontFamily: fonts.maruBlack, fontSize: 24, color: colors.text },
  reminderRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg, padding: spacing.md },
  footer: { padding: spacing.lg, borderTopWidth: StyleSheet.hairlineWidth },
});
