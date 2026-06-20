// Reusable UI primitives — "Editorial Ledger" styling.

import { Feather } from '@expo/vector-icons';
import React, { type ComponentProps } from 'react';
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
import { colors, fonts, radius, shadow, spacing, type } from '../lib/theme';
import { useColors } from './ThemeProvider';

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionTitle}>
      <Text style={styles.sectionLabel}>{children}</Text>
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
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        variant === 'primary' && styles.btnPrimary,
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

export function Field({ label, ...props }: { label?: string } & TextInputProps) {
  return (
    <View style={{ gap: spacing.xs }}>
      {label ? <Text style={type.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        style={[styles.input, props.multiline && styles.inputMultiline, props.style]}
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
  const c = useColors();
  const tones = {
    neutral: { bg: c.surface2, fg: c.text2, border: c.line2 },
    primary: { bg: c.primaryWeak, fg: c.primary, border: c.primaryWeak },
    accent: { bg: c.accentWeak, fg: c.good, border: c.accentWeak },
    warn: { bg: c.warnWeak, fg: c.warn, border: c.warnWeak },
    danger: { bg: c.dangerWeak, fg: c.danger, border: c.dangerWeak },
  }[tone];
  const content = (
    <View
      style={[
        styles.chip,
        { backgroundColor: active ? tones.bg : 'transparent', borderColor: active ? c.primary : tones.border },
      ]}
    >
      <Text style={[styles.chipLabel, { color: active ? tones.fg : c.text2 }]}>{label}</Text>
    </View>
  );
  if (!onPress) return <View>{content}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

export function EmptyState({
  icon = 'feather',
  title,
  hint,
}: {
  icon?: ComponentProps<typeof Feather>['name'];
  title: string;
  hint?: string;
}) {
  return (
    <View style={styles.empty}>
      <Feather name={icon} size={26} color={colors.line2} />
      <Text style={styles.emptyTitle}>{title}</Text>
      {hint ? <Text style={[type.muted, { textAlign: 'center' }]}>{hint}</Text> : null}
    </View>
  );
}

export function Fab({ onPress, icon = 'plus' }: { onPress: () => void; icon?: ComponentProps<typeof Feather>['name'] }) {
  const c = useColors();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.fab, { backgroundColor: c.primary }, pressed && styles.fabPressed]}>
      <Feather name={icon} size={24} color="#fff" />
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
  },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  sectionLabel: { ...type.label },
  btn: { borderRadius: radius.lg, paddingVertical: 15, paddingHorizontal: spacing.lg, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: colors.primary },
  btnGhost: { backgroundColor: 'transparent', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line2 },
  btnDanger: { backgroundColor: colors.dangerWeak },
  btnDisabled: { opacity: 0.4 },
  btnLabel: { color: colors.white, fontSize: 15.5, fontFamily: fonts.gothicBold },
  pressed: { opacity: 0.6 },
  input: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line2,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: fonts.gothic,
    color: colors.text,
  },
  inputMultiline: { minHeight: 96, textAlignVertical: 'top', lineHeight: 22 },
  chip: { borderRadius: radius.pill, paddingHorizontal: 13, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth },
  chipLabel: { fontSize: 13, fontFamily: fonts.gothicMed },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xl * 2, paddingHorizontal: spacing.xl },
  emptyTitle: { ...type.h2, color: colors.text2 },
  fab: {
    position: 'absolute',
    right: spacing.lg,
    bottom: spacing.xl,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.card,
    shadowOpacity: 0.18,
    elevation: 5,
  },
  fabPressed: { opacity: 0.9, transform: [{ scale: 0.96 }] },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
