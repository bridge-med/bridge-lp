import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SearchBar } from '../../components/SearchBar';
import { Sheet } from '../../components/Sheet';
import { TagFilter } from '../../components/TagFilter';
import { TagInput } from '../../components/TagInput';
import { Button, Card, Chip, EmptyState, Fab, Field } from '../../components/ui';
import { memos } from '../../lib/data';
import { formatDateJa } from '../../lib/date';
import { usePro } from '../../lib/entitlement';
import { useCollection } from '../../lib/store';
import { collectTags, matchesQuery } from '../../lib/tags';
import { colors, spacing, type } from '../../lib/theme';
import type { Memo } from '../../lib/types';

export default function MemoScreen() {
  const all = useCollection(memos);
  const isPro = usePro();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [editing, setEditing] = useState<Memo | null>(null);
  const [open, setOpen] = useState(false);

  const allTags = useMemo(() => collectTags(all), [all]);

  const sorted = useMemo(
    () =>
      all
        .filter((m) => matchesQuery(query, [m.title, m.body, ...(m.tags ?? [])]))
        .filter((m) => !tagFilter || (m.tags ?? []).includes(tagFilter))
        .sort((a, b) => {
          if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
          return b.updatedAt < a.updatedAt ? -1 : 1;
        }),
    [all, query, tagFilter],
  );

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}
        keyboardShouldPersistTaps="handled"
      >
        <SearchBar value={query} onChangeText={setQuery} placeholder="メモを検索" />
        {isPro ? <TagFilter tags={allTags} selected={tagFilter} onSelect={setTagFilter} /> : null}

        {sorted.length === 0 ? (
          <EmptyState
            icon="📝"
            title={query || tagFilter ? '該当するメモがありません' : 'メモはまだありません'}
            hint={query || tagFilter ? undefined : '思いついたことを、形式を気にせずさっと書き留めましょう。'}
          />
        ) : (
          sorted.map((m) => (
            <Pressable
              key={m.id}
              onPress={() => {
                setEditing(m);
                setOpen(true);
              }}
            >
              <Card style={styles.card}>
                <View style={styles.cardHead}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {m.pinned ? '📌 ' : ''}
                    {m.title || '無題のメモ'}
                  </Text>
                </View>
                {m.body ? (
                  <Text style={[type.body, { color: colors.text2 }]} numberOfLines={4}>
                    {m.body}
                  </Text>
                ) : null}
                {(m.tags ?? []).length > 0 ? (
                  <View style={styles.tagRow}>
                    {(m.tags ?? []).map((t) => (
                      <Chip key={t} label={`#${t}`} tone="neutral" />
                    ))}
                  </View>
                ) : null}
                <Text style={[type.muted, { marginTop: spacing.xs }]}>{formatDateJa(m.updatedAt.slice(0, 10))} 更新</Text>
              </Card>
            </Pressable>
          ))
        )}
      </ScrollView>

      <View style={{ position: 'absolute', right: 0, bottom: insets.bottom }}>
        <Fab
          onPress={() => {
            setEditing(null);
            setOpen(true);
          }}
        />
      </View>

      <MemoFormSheet visible={open} memo={editing} isPro={isPro} onClose={() => setOpen(false)} />
    </View>
  );
}

function MemoFormSheet({ visible, memo, isPro, onClose }: { visible: boolean; memo: Memo | null; isPro: boolean; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [tags, setTags] = useState<string[]>([]);
  const [seed, setSeed] = useState<string | null>(null);

  const key = (visible ? 'open' : 'closed') + ':' + (memo?.id ?? 'new');
  if (key !== seed && visible) {
    setSeed(key);
    setTitle(memo?.title ?? '');
    setBody(memo?.body ?? '');
    setPinned(memo?.pinned ?? false);
    setTags(memo?.tags ?? []);
  }

  function save() {
    if (!title.trim() && !body.trim()) {
      onClose();
      return;
    }
    void memos.upsert({
      id: memo?.id,
      title: title.trim(),
      body: body.trim(),
      pinned,
      tags,
    } as Partial<Memo>);
    onClose();
  }
  function del() {
    if (memo) void memos.remove(memo.id);
    onClose();
  }
  function goPaywall() {
    onClose();
    router.push('/paywall');
  }

  return (
    <Sheet visible={visible} title={memo ? 'メモを編集' : '新しいメモ'} onClose={onClose}>
      <Field label="タイトル（任意）" placeholder="メモのタイトル" value={title} onChangeText={setTitle} />
      <Field label="本文" placeholder="内容を入力" value={body} onChangeText={setBody} multiline autoFocus={!memo} />
      <TagInput value={tags} onChange={setTags} enabled={isPro} onLocked={goPaywall} />
      <Pressable onPress={() => setPinned((p) => !p)} style={styles.pinToggle}>
        <View style={[styles.pinBox, pinned && styles.pinBoxOn]}>{pinned ? <Text style={styles.pinMark}>✓</Text> : null}</View>
        <Text style={type.body}>上部に固定する</Text>
      </Pressable>
      <Button label={memo ? '保存' : '追加'} onPress={save} />
      {memo ? <Button label="削除" variant="danger" onPress={del} /> : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  card: { gap: spacing.xs },
  cardHead: { flexDirection: 'row', alignItems: 'center' },
  cardTitle: { ...type.h2, fontSize: 16, flex: 1 },
  tagRow: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap', marginTop: spacing.xs },
  pinToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xs },
  pinBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.line2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBoxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  pinMark: { color: colors.white, fontWeight: '700' },
});
