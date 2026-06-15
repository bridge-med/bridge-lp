// First-run onboarding: capture profession / role / purpose, then start.

import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { PROFESSIONS, PURPOSES, ROLES } from '../lib/constants';
import { prefs } from '../lib/prefs';
import { colors, fonts, radius, spacing, type } from '../lib/theme';
import { Chip } from './ui';
import { Picker } from './Picker';
import { useColors } from './ThemeProvider';

export function Onboarding({ visible }: { visible: boolean }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const [profession, setProfession] = useState('');
  const [role, setRole] = useState('');
  const [purpose, setPurpose] = useState('');

  function finish() {
    void prefs.set({ profession, role, purpose, onboardingDone: true });
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={[styles.container, { backgroundColor: c.bg, paddingTop: insets.top + spacing.lg }]}>
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + 100, gap: spacing.xl }}>
          <View style={{ gap: spacing.sm, marginBottom: spacing.md }}>
            <Text style={styles.badge}>BRIDGE WORKLOG</Text>
            <Text style={styles.title}>日々の仕事が、{'\n'}いつか経歴になる。</Text>
            <Text style={[type.body, { color: c.text2, marginTop: 4 }]}>
              毎日の仕事ログ・メモ・気づきを残すだけ。あとで職務経歴書・面接・1on1の材料に変わります。まず、あなたのことを少しだけ。
            </Text>
          </View>

          <Picker label="職種" options={PROFESSIONS} value={profession} onChange={setProfession} placeholder="職種を選択" />
          <Group title="現在の立場" options={ROLES} value={role} onSelect={setRole} />
          <Group title="使う目的" options={PURPOSES} value={purpose} onSelect={setPurpose} />
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.lg, backgroundColor: c.bg, borderTopColor: c.line }]}>
          <Pressable onPress={finish} style={[styles.btn, { backgroundColor: c.primary }]}>
            <Text style={styles.btnText}>はじめる</Text>
          </Pressable>
          <Pressable onPress={finish} hitSlop={8} style={{ alignItems: 'center', paddingTop: spacing.sm }}>
            <Text style={type.muted}>あとで設定する</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function Group({
  title,
  options,
  value,
  onSelect,
}: {
  title: string;
  options: readonly string[];
  value: string;
  onSelect: (v: string) => void;
}) {
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={type.label}>{title}</Text>
      <View style={styles.chips}>
        {options.map((o) => (
          <Chip key={o} label={o} tone="primary" active={value === o} onPress={() => onSelect(value === o ? '' : o)} />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  badge: { ...type.label, letterSpacing: 3 },
  title: { fontFamily: fonts.maru, fontSize: 28, lineHeight: 40, color: colors.text },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  footer: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  btn: { borderRadius: radius.md, paddingVertical: 16, alignItems: 'center' },
  btnText: { color: '#fff', fontSize: 16, fontFamily: fonts.gothicBold },
});
