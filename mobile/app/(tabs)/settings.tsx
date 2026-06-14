import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '../../components/Sheet';
import { ThemePicker } from '../../components/ThemePicker';
import { useColors } from '../../components/ThemeProvider';
import { Button, Card, Field, SectionTitle } from '../../components/ui';
import { buildExport, clearAll, importBundle, journal, memos, tasks } from '../../lib/data';
import { devTogglePro, usePro } from '../../lib/entitlement';
import { toMarkdown } from '../../lib/markdown';
import { prefs, usePrefs } from '../../lib/prefs';
import { useCollection } from '../../lib/store';
import { colors, spacing, type } from '../../lib/theme';

export default function SettingsScreen() {
  const t = useCollection(tasks);
  const m = useCollection(memos);
  const j = useCollection(journal);
  const pro = usePro();
  const c = useColors();
  const { geminiApiKey } = usePrefs();
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

  async function onExportMarkdown() {
    if (!pro) {
      router.push('/paywall');
      return;
    }
    const md = toMarkdown({ tasks: t, memos: m, journal: j });
    try {
      await Share.share({ message: md, title: 'BRIDGE Daily (Markdown)' });
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

      <Pressable onPress={() => router.push('/paywall')}>
        <Card style={[styles.proCard, { backgroundColor: pro ? colors.accentWeak : c.primaryWeak, borderColor: pro ? colors.accentWeak : c.primaryWeak }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.proTitle, { color: pro ? colors.good : c.primary }]}>
              {pro ? 'BRIDGE Daily Pro' : 'Pro にアップグレード'}
            </Text>
            <Text style={[type.muted, pro && { color: colors.good }]}>
              {pro ? '✓ すべての機能が利用できます' : 'ふりかえり・エクスポート・テーマなどを解放'}
            </Text>
          </View>
          {!pro ? <Text style={[styles.proArrow, { color: c.primary }]}>›</Text> : null}
        </Card>
      </Pressable>

      <View>
        <SectionTitle>テーマ</SectionTitle>
        <Card>
          <ThemePicker isPro={pro} onLocked={() => router.push('/paywall')} />
        </Card>
      </View>

      <View>
        <SectionTitle>AI（Gemini）</SectionTitle>
        <Card style={{ gap: spacing.md }}>
          {pro ? (
            <>
              <Text style={type.muted}>
                自分の Gemini APIキーを登録すると、AIでタスク整理・メモ整理・日記のふりかえりが使えます（無料枠あり）。
              </Text>
              <Field
                label="APIキー"
                placeholder="AIza..."
                value={geminiApiKey}
                onChangeText={(v) => void prefs.set({ geminiApiKey: v.trim() })}
                secureTextEntry
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Pressable onPress={() => void Linking.openURL('https://aistudio.google.com/apikey')} hitSlop={6}>
                <Text style={[type.muted, { color: c.primary }]}>APIキーを取得する（Google AI Studio）↗</Text>
              </Pressable>
              <Text style={type.muted}>
                {geminiApiKey ? '✓ キー設定済み（端末内のみに保存）' : 'キー未設定'}
              </Text>
              {geminiApiKey ? <Button label="キーを削除" variant="ghost" onPress={() => void prefs.set({ geminiApiKey: '' })} /> : null}
            </>
          ) : (
            <Pressable onPress={() => router.push('/paywall')} style={styles.aiLocked}>
              <Text style={type.body}>✨ AI機能（タスク/メモ/日記の自動整理）</Text>
              <Text style={[styles.proBadge, { color: c.primary }]}>PRO</Text>
            </Pressable>
          )}
        </Card>
      </View>

      <View>
        <SectionTitle>バックアップ</SectionTitle>
        <Card style={{ gap: spacing.md }}>
          <Text style={type.muted}>
            データはこの端末内だけに保存されます。機種変更の前に書き出して保管してください。
          </Text>
          <Button label="バックアップを書き出す（JSON）" onPress={onExport} />
          <Button
            label={pro ? 'Markdownで書き出す' : 'Markdownで書き出す（Pro）'}
            variant="ghost"
            onPress={onExportMarkdown}
          />
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
          <Pressable onPress={() => void devTogglePro()} hitSlop={8} style={{ marginTop: spacing.sm }}>
            <Text style={styles.devLink}>（開発用）Pro 状態を切り替え: {pro ? 'ON' : 'OFF'}</Text>
          </Pressable>
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
  proCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, backgroundColor: colors.primaryWeak, borderColor: colors.primaryWeak },
  proCardOwned: { backgroundColor: colors.accentWeak, borderColor: colors.accentWeak },
  proTitle: { ...type.h2, fontSize: 16, color: colors.primary },
  proArrow: { color: colors.primary, fontSize: 22, fontWeight: '800' },
  devLink: { ...type.muted, color: colors.line2 },
  aiLocked: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  proBadge: { fontWeight: '800', fontSize: 12, letterSpacing: 1 },
});

