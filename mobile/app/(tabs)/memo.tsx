import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Sheet } from '../../components/Sheet';
import { Button, Card, EmptyState, Fab, Field } from '../../components/ui';
import { memos } from '../../lib/data';
import { formatDateJa } from '../../lib/date';
import { useCollection } from '../../lib/store';
import { colors, spacing, type } from '../../lib/theme';
import type { Memo } from '../../lib/types';

export default function MemoScreen() {
  const all = useCollection(memos);
  const insets = useSafeAreaInsets();
  const [editing, setEditing] = useState<Memo | null>(null);
  const [open, setOpen] = useState(false);

  const sorted = useMemo(
    () =>
      [...all].sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.updatedAt < a.updatedAt ? -1 : 1;
      }),
    [all],
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}>
        {sorted.length === 0 ? (
          <EmptyState icon="📝" title="メモはまだありません" hint="思いついたことを、形式を気にせずさっと書き留めましょう。" />
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
                <Text style={[type.muted, { marginTop: spacing.sm }]}>
                  {formatDateJa(m.updatedAt.slice(0, 10))} 更新
                </Text>
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

      <MemoFormSheet visible={open} memo={editing} onClose={() => setOpen(false)} />
    </View>
  );
}

function MemoFormSheet({ visible, memo, onClose }: { visible: boolean; memo: Memo | null; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [pinned, setPinned] = useState(false);
  const [seed, setSeed] = useState<string | null>(null);

  const key = (visible ? 'open' : 'closed') + ':' + (memo?.id ?? 'new');
  if (key !== seed && visible) {
    setSeed(key);
    setTitle(memo?.title ?? '');
    setBody(memo?.body ?? '');
    setPinned(memo?.pinned ?? false);
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
    } as Partial<Memo>);
    onClose();
  }
  function del() {
    if (memo) void memos.remove(memo.id);
    onClose();
  }

  return (
    <Sheet visible={visible} title={memo ? 'メモを編集' : '新しいメモ'} onClose={onClose}>
      <Field label="タイトル（任意）" placeholder="メモのタイトル" value={title} onChangeText={setTitle} />
      <Field
        label="本文"
        placeholder="内容を入力"
        value={body}
        onChangeText={setBody}
        multiline
        autoFocus={!memo}
      />
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
