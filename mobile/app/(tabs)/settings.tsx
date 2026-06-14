import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '../../components/Sheet';
import { ThemePicker } from '../../components/ThemePicker';
import { useColors } from '../../components/ThemeProvider';
import { Button, Card, Field, SectionTitle } from '../../components/ui';
import { AiError, validateApiKey } from '../../lib/ai';
import { buildExport, clearAll, importBundle, journal, memos, tasks } from '../../lib/data';
import { devToggleAdFree, useAdFree } from '../../lib/entitlement';
import { toMarkdown } from '../../lib/markdown';
import { prefs, usePrefs } from '../../lib/prefs';
import { useCollection } from '../../lib/store';
import { colors, spacing, type } from '../../lib/theme';

export default function SettingsScreen() {
  const t = useCollection(tasks);
  const m = useCollection(memos);
  const j = useCollection(journal);
  const adFree = useAdFree();
  const c = useColors();
  const { geminiApiKey } = usePrefs();
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onVerifyKey() {
    setVerifying(true);
    setVerifyMsg(null);
    try {
      await validateApiKey(geminiApiKey);
      setVerifyMsg({ ok: true, text: '✓ キーは有効です。AI機能を使えます。' });
    } catch (e) {
      setVerifyMsg({ ok: false, text: e instanceof AiError ? e.message : '確認に失敗しました。' });
    } finally {
      setVerifying(false);
    }
  }

  async function onExport() {
    const json = JSON.stringify(buildExport(), null, 2);
    try {
      await Share.share({ message: json, title: 'BRIDGE Daily バックアップ' });
    } catch {
      // user cancelled — no-op
    }
  }

  async function onExportMarkdown() {
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

      <Pressable onPress={() => router.push('/paywall')} disabled={adFree}>
        <Card
          style={[
            styles.proCard,
            { backgroundColor: adFree ? colors.accentWeak : c.primaryWeak, borderColor: adFree ? colors.accentWeak : c.primaryWeak },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[styles.proTitle, { color: adFree ? colors.good : c.primary }]}>
              {adFree ? '広告オフ' : '広告を消す（買い切り）'}
            </Text>
            <Text style={[type.muted, adFree && { color: colors.good }]}>
              {adFree ? '✓ 広告は表示されません' : '機能は全部無料のまま、広告だけ非表示に'}
            </Text>
          </View>
          {!adFree ? <Text style={[styles.proArrow, { color: c.primary }]}>›</Text> : null}
        </Card>
      </Pressable>

      <View>
        <SectionTitle>テーマ</SectionTitle>
        <Card>
          <ThemePicker />
        </Card>
      </View>

      <View>
        <SectionTitle>AI（Gemini）</SectionTitle>
        <Card style={{ gap: spacing.md }}>
          <Text style={type.muted}>
            自分の Gemini APIキーを登録すると、AIでタスク整理・メモ整理・日記のふりかえりが使えます。無料枠で十分試せます。
          </Text>
          <View style={styles.steps}>
            <Text style={type.muted}>1. 下の「APIキーを取得」を開く（Googleアカウントでログイン）</Text>
            <Text style={type.muted}>2.「APIキーを作成」して、表示されたキー（AIza…）をコピー</Text>
            <Text style={type.muted}>3. 下の欄に貼り付け →「キーを確認」</Text>
          </View>
          <Pressable
            onPress={() => void Linking.openURL('https://aistudio.google.com/apikey')}
            style={[styles.linkBtn, { borderColor: c.primary }]}
          >
            <Text style={[type.body, { color: c.primary, fontWeight: '700' }]}>APIキーを取得する（Google AI Studio）↗</Text>
          </Pressable>
          <Field
            label="APIキー"
            placeholder="AIza..."
            value={geminiApiKey}
            onChangeText={(v) => {
              void prefs.set({ geminiApiKey: v.trim() });
              setVerifyMsg(null);
            }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          {verifyMsg ? (
            <Text style={[type.body, { color: verifyMsg.ok ? colors.good : colors.danger }]}>{verifyMsg.text}</Text>
          ) : (
            <Text style={type.muted}>{geminiApiKey ? '端末内のみに保存されます' : 'キー未設定'}</Text>
          )}
          <Button label={verifying ? '確認中…' : 'キーを確認'} onPress={onVerifyKey} disabled={!geminiApiKey || verifying} />
          {geminiApiKey ? (
            <Button
              label="キーを削除"
              variant="ghost"
              onPress={() => {
                void prefs.set({ geminiApiKey: '' });
                setVerifyMsg(null);
              }}
            />
          ) : null}
        </Card>
      </View>

      <View>
        <SectionTitle>バックアップ</SectionTitle>
        <Card style={{ gap: spacing.md }}>
          <Text style={type.muted}>データはこの端末内だけに保存されます。機種変更の前に書き出して保管してください。</Text>
          <Button label="バックアップを書き出す（JSON）" onPress={onExport} />
          <Button label="Markdownで書き出す" variant="ghost" onPress={onExportMarkdown} />
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
          <Pressable onPress={() => void devToggleAdFree()} hitSlop={8} style={{ marginTop: spacing.sm }}>
            <Text style={styles.devLink}>（開発用）広告オフを切り替え: {adFree ? 'ON' : 'OFF'}</Text>
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
  proCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  proTitle: { ...type.h2, fontSize: 16 },
  proArrow: { fontSize: 22, fontWeight: '800' },
  devLink: { ...type.muted, color: colors.line2 },
  steps: { gap: 4 },
  linkBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
});
