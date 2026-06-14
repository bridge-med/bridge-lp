// Reusable UI primitives shared across screens.

import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { colors, radius, shadow, spacing, type } from '../lib/theme';
import { useColors } from './ThemeProvider';

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={type.h2}>{children}</Text>
      {right}
    </View>
  );
}

type ButtonVariant = 'primary' | 'ghost' | 'danger';

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
}) {
  const c = useColors();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        variant === 'primary' && { backgroundColor: c.primary },
        variant === 'ghost' && styles.btnGhost,
        variant === 'danger' && styles.btnDanger,
        pressed && styles.pressed,
        disabled && styles.btnDisabled,
      ]}
    >
      <Text
        style={[
          styles.btnLabel,
          variant === 'ghost' && { color: colors.text2 },
          variant === 'danger' && { color: colors.danger },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Field({
  label,
  ...props
}: { label?: string } & TextInputProps) {
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <Text style={type.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, props.multiline && styles.inputMultiline]}
        {...props}
      />
    </View>
  );
}

export function Chip({
  label,
  active,
  tone = 'neutral',
  onPress,
}: {
  label: string;
  active?: boolean;
  tone?: 'neutral' | 'primary' | 'accent' | 'warn' | 'danger';
  onPress?: () => void;
}) {
  const colors = useColors();
  const toneColor = {
    neutral: { bg: colors.surface2, fg: colors.text2, border: colors.line },
    primary: { bg: colors.primaryWeak, fg: colors.primary, border: colors.primaryWeak },
    accent: { bg: colors.accentWeak, fg: colors.good, border: colors.accentWeak },
    warn: { bg: colors.warnWeak, fg: colors.warn, border: colors.warnWeak },
    danger: { bg: colors.dangerWeak, fg: colors.danger, border: colors.dangerWeak },
  }[tone];
  const content = (
    <View
      style={[
        styles.chip,
        { backgroundColor: toneColor.bg, borderColor: active ? colors.primary : toneColor.border },
        active && { borderWidth: 1.5 },
      ]}
    >
      <Text style={[styles.chipLabel, { color: toneColor.fg }]}>{label}</Text>
    </View>
  );
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

export function EmptyState({ icon, title, hint }: { icon: string; title: string; hint?: string }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyIcon}>{icon}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={[type.muted, { textAlign: 'center' }]}>{hint}</Text> : null}
    </View>
  );
}

export function Fab({ onPress, label = '＋' }: { onPress: () => void; label?: string }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.fab, { backgroundColor: c.primary }, pressed && styles.fabPressed]}>
      <Text style={styles.fabLabel}>{label}</Text>
    </Pressable>
  );
}

export function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
    padding: spacing.lg,
    ...shadow.card,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  btn: {
    borderRadius: radius.md,
    paddingVertical: 12,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: colors.primary },
  btnGhost: { backgroundColor: colors.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line2 },
  btnDanger: { backgroundColor: colors.dangerWeak },
  btnDisabled: { opacity: 0.5 },
  btnLabel: { color: colors.white, fontSize: 15, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  input: {
    backgroundColor: colors.surface2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line2,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
  },
  chipLabel: { fontSize: 13, fontWeight: '600' },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl * 2, paddingHorizontal: spacing.xl },
  emptyIcon: { fontSize: 40 },
  emptyTitle: { ...type.h2, color: colors.text2 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
    shadowOpacity: 0.25,
    elevation: 6,
  },
  fabPressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
  fabLabel: { color: colors.white, fontSize: 30, fontWeight: '300', lineHeight: 34 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
