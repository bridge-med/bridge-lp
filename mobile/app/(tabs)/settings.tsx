import { useState } from 'react';
import { Alert, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '../../components/Sheet';
import { Button, Card, Field, SectionTitle } from '../../components/ui';
import { buildExport, clearAll, importBundle, journal, memos, tasks } from '../../lib/data';
import { useCollection } from '../../lib/store';
import { colors, spacing, type } from '../../lib/theme';

export default function SettingsScreen() {
  const t = useCollection(tasks);
  const m = useCollection(memos);
  const j = useCollection(journal);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');

  async function onExport() {
    const json = JSON.stringify(buildExport(), null, 2);
    try {
      await Share.share({ message: json, title: 'BRIDGE Daily バックアップ' });
    } catch {
      // user cancelled — no-op
    }
  }

  async function onImport() {
    try {
      await importBundle(importText);
      setImportOpen(false);
      setImportText('');
      Alert.alert('取り込み完了', 'バックアップを読み込みました。');
    } catch (e) {
      Alert.alert('取り込み失敗', e instanceof Error ? e.message : '不明なエラー');
    }
  }

  function onClear() {
    Alert.alert('全データを削除', 'タスク・メモ・日記をすべて削除します。この操作は取り消せません。', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: '削除する',
        style: 'destructive',
        onPress: () => {
          void clearAll();
        },
      },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <Card style={styles.statRow}>
        <Stat value={t.length} label="タスク" />
        <Stat value={m.length} label="メモ" />
        <Stat value={j.length} label="日記" />
      </Card>

      <View>
        <SectionTitle>バックアップ</SectionTitle>
        <Card style={{ gap: spacing.md }}>
          <Text style={type.muted}>
            データはこの端末内だけに保存されます。機種変更の前に書き出して保管してください。
          </Text>
          <Button label="バックアップを書き出す（共有）" onPress={onExport} />
          <Button label="バックアップを取り込む" variant="ghost" onPress={() => setImportOpen(true)} />
        </Card>
      </View>

      <View>
        <SectionTitle>データ管理</SectionTitle>
        <Card>
          <Button label="全データを削除" variant="danger" onPress={onClear} />
        </Card>
      </View>

      <View>
        <SectionTitle>このアプリについて</SectionTitle>
        <Card style={{ gap: spacing.sm }}>
          <Text style={type.h2}>BRIDGE Daily</Text>
          <Text style={type.muted}>
            タスク・メモ・日記を1つにまとめた、スキマ時間のための個人用アプリ。BRIDGE の現場ツール群の思想を踏襲し、
            データは端末内（オフライン）に保持します。
          </Text>
          <Text style={[type.muted, { marginTop: spacing.xs }]}>バージョン 1.0.0</Text>
        </Card>
      </View>

      <Sheet visible={importOpen} title="バックアップを取り込む" onClose={() => setImportOpen(false)}>
        <Text style={type.muted}>書き出した JSON を貼り付けてください。現在のデータは置き換えられます。</Text>
        <Field placeholder='{"app":"bridge-daily", ...}' value={importText} onChangeText={setImportText} multiline />
        <Button label="取り込む" onPress={onImport} disabled={!importText.trim()} />
      </Sheet>
    </ScrollView>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={type.muted}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  statRow: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: spacing.lg },
  stat: { alignItems: 'center', gap: 2 },
  statValue: { fontSize: 26, fontWeight: '700', color: colors.text },
});
