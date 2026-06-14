// Generic CRUD screen for a ModuleConfig. List + add/edit sheet, or a single
// editable record (singleton). Renders fields by type.

import { Feather } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { formatDateJa, parseKey } from '../lib/date';
import { moduleCollection, type FieldDef, type ModuleConfig } from '../lib/modules';
import { useCollection } from '../lib/store';
import { colors, fonts, radius, spacing, type } from '../lib/theme';
import type { GenericRecord } from '../lib/types';
import { BlockHeader } from './BlockHeader';
import { DateField } from './DatePicker';
import { Ledger } from './Ledger';
import { Sheet } from './Sheet';
import { TagPicker } from './TagPicker';
import { useColors } from './ThemeProvider';
import { Button, Chip, EmptyState, Field } from './ui';

const SINGLE_ID = 'singleton';

export function ModuleScreen({ config }: { config: ModuleConfig }) {
  const c = useColors();
  const insets = useSafeAreaInsets();
  const col = moduleCollection(config.key);
  const items = useCollection(col);
  const [editing, setEditing] = useState<GenericRecord | null>(null);
  const [open, setOpen] = useState(false);

  const sorted = useMemo(() => {
    const arr = [...items];
    if (config.dateField) {
      arr.sort((a, b) => String(b[config.dateField!] ?? '').localeCompare(String(a[config.dateField!] ?? '')) || (b.createdAt < a.createdAt ? -1 : 1));
    } else {
      arr.sort((a, b) => (b.createdAt < a.createdAt ? -1 : 1));
    }
    return arr;
  }, [items, config.dateField]);

  function openNew() {
    setEditing(null);
    setOpen(true);
  }

  // Singleton: one record edited in place.
  if (config.singleton) {
    const rec = items[0] ?? null;
    return (
      <View style={styles.container}>
        <BlockHeader wordmark="ASSET" title={config.title} onBack pad={24} />
        <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: insets.bottom + spacing.xl }}>
          <Text style={type.muted}>{config.desc}</Text>
          <View style={{ height: spacing.lg }} />
          {config.fields.map((f) => (
            <View key={f.key} style={styles.field}>
              <Text style={[type.label, { color: c.primary }]}>{f.label}</Text>
              <Text style={[type.body, { marginTop: 4 }]}>{display(f, rec?.[f.key]) || '—'}</Text>
            </View>
          ))}
          <View style={{ marginTop: spacing.xl }}>
            <Button label="編集する" onPress={() => { setEditing(rec); setOpen(true); }} />
          </View>
        </ScrollView>
        <ModuleSheet config={config} record={editing} singletonId={SINGLE_ID} visible={open} onClose={() => setOpen(false)} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BlockHeader wordmark="ASSET" title={config.title} onBack pad={24} />
      <ScrollView contentContainerStyle={{ paddingTop: spacing.lg, paddingBottom: 120 }}>
        <View style={{ paddingHorizontal: spacing.lg }}>
          <Text style={type.muted}>{config.desc}</Text>
        </View>
        <View style={{ height: spacing.md }} />
        {sorted.length === 0 ? (
          <Ledger>
            <EmptyState icon={config.icon} title="まだありません" hint="右下の＋から追加できます。" />
          </Ledger>
        ) : (
          sorted.map((r, i) => {
            const dateVal = config.dateField ? (r[config.dateField] as string) : '';
            const gutter = dateVal
              ? <Text style={[styles.gdate, { color: c.primary }]}>{`${parseKey(dateVal).getMonth() + 1}.${parseKey(dateVal).getDate()}`}</Text>
              : <Text style={styles.index}>{String(i + 1).padStart(2, '0')}</Text>;
            const primaryVal = display(config.fields.find((f) => f.key === config.primary)!, r[config.primary]);
            const subField = config.subtitle ? config.fields.find((f) => f.key === config.subtitle) : undefined;
            const subVal = subField ? display(subField, r[config.subtitle!]) : '';
            const ratingField = config.fields.find((f) => f.type === 'rating');
            return (
              <Ledger key={r.id} gutter={gutter} onPress={() => { setEditing(r); setOpen(true); }}>
                <Text style={type.title} numberOfLines={2}>{primaryVal || '（無題）'}</Text>
                {ratingField ? <Dots value={Number(r[ratingField.key] ?? 0)} c={c} /> : null}
                {subVal ? <Text style={[type.muted, { marginTop: 3 }]} numberOfLines={1}>{subVal}</Text> : null}
              </Ledger>
            );
          })
        )}
      </ScrollView>
      <Pressable
        onPress={openNew}
        style={({ pressed }) => [styles.fab, { backgroundColor: c.primary, bottom: insets.bottom + spacing.lg }, pressed && { opacity: 0.9 }]}
      >
        <Feather name="plus" size={24} color="#fff" />
      </Pressable>
      <ModuleSheet config={config} record={editing} visible={open} onClose={() => setOpen(false)} />
    </View>
  );
}

function Dots({ value, c }: { value: number; c: ReturnType<typeof useColors> }) {
  return (
    <View style={{ flexDirection: 'row', gap: 5, marginTop: 6 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <View key={n} style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: n <= value ? c.primary : colors.line2 }} />
      ))}
    </View>
  );
}

function display(f: FieldDef, v: unknown): string {
  if (v == null || v === '') return '';
  if (f.type === 'date') return formatDateJa(String(v));
  if (f.type === 'tags') return Array.isArray(v) ? (v as string[]).join(' ・ ') : '';
  if (f.type === 'rating') return '★'.repeat(Number(v));
  return String(v);
}

function ModuleSheet({
  config,
  record,
  visible,
  onClose,
  singletonId,
}: {
  config: ModuleConfig;
  record: GenericRecord | null;
  visible: boolean;
  onClose: () => void;
  singletonId?: string;
}) {
  const c = useColors();
  const col = moduleCollection(config.key);
  const [vals, setVals] = useState<Record<string, unknown>>({});
  const [seed, setSeed] = useState<string | null>(null);

  const key = (visible ? 'o' : 'c') + ':' + (record?.id ?? 'new');
  if (key !== seed && visible) {
    setSeed(key);
    const init: Record<string, unknown> = {};
    for (const f of config.fields) init[f.key] = record?.[f.key] ?? (f.type === 'tags' ? [] : f.type === 'rating' ? 0 : '');
    setVals(init);
  }

  const set = (k: string, v: unknown) => setVals((s) => ({ ...s, [k]: v }));

  function save() {
    col.upsert({ id: record?.id ?? singletonId, ...vals } as Partial<GenericRecord>);
    onClose();
  }
  function del() {
    if (record) col.remove(record.id);
    onClose();
  }

  return (
    <Sheet visible={visible} title={record ? config.title : config.title} onClose={onClose}>
      {config.fields.map((f) => (
        <FieldInput key={f.key} field={f} value={vals[f.key]} onChange={(v) => set(f.key, v)} c={c} />
      ))}
      <Button label="保存する" onPress={save} />
      {record && !config.singleton ? <Button label="削除" variant="danger" onPress={del} /> : null}
    </Sheet>
  );
}

function FieldInput({
  field,
  value,
  onChange,
  c,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  c: ReturnType<typeof useColors>;
}) {
  if (field.type === 'tags') return <TagPicker value={(value as string[]) ?? []} onChange={onChange} />;
  if (field.type === 'date') return <DateField label={field.label} value={(value as string) || null} onChange={onChange} />;
  if (field.type === 'select') {
    return (
      <View style={{ gap: spacing.xs }}>
        <Text style={type.label}>{field.label}</Text>
        <View style={styles.chips}>
          {(field.options ?? []).map((o) => (
            <Chip key={o} label={o} tone="primary" active={value === o} onPress={() => onChange(value === o ? '' : o)} />
          ))}
        </View>
      </View>
    );
  }
  if (field.type === 'rating') {
    const n = Number(value ?? 0);
    return (
      <View style={{ gap: spacing.xs }}>
        <Text style={type.label}>{field.label}</Text>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Pressable key={i} onPress={() => onChange(i === n ? 0 : i)} hitSlop={6}>
              <View style={[styles.dot, { borderColor: c.primary }, i <= n && { backgroundColor: c.primary }]} />
            </Pressable>
          ))}
        </View>
      </View>
    );
  }
  return (
    <Field
      label={field.label}
      value={(value as string) ?? ''}
      onChangeText={onChange}
      placeholder={field.placeholder}
      multiline={field.type === 'multiline'}
      keyboardType={field.type === 'number' ? 'numeric' : 'default'}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  field: { paddingTop: spacing.lg },
  index: { fontFamily: fonts.minchoReg, fontSize: 14, color: colors.muted },
  gdate: { fontFamily: fonts.minchoReg, fontSize: 16 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  dot: { width: 26, height: 26, borderRadius: 13, borderWidth: 1.5 },
  fab: {
    position: 'absolute', right: spacing.lg, width: 58, height: 58, borderRadius: 29,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#3A3320', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 4, elevation: 5,
  },
});
