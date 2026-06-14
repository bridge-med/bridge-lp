import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Picker } from '../../components/Picker';
import { Sheet } from '../../components/Sheet';
import { ThemePicker } from '../../components/ThemePicker';
import { useColors } from '../../components/ThemeProvider';
import { Button, Card, Chip, Field, SectionTitle } from '../../components/ui';
import { AiError, validateApiKey } from '../../lib/ai';
import { AI_PROVIDERS, PROFESSIONS, PURPOSES, ROLES } from '../../lib/constants';
import { buildExport, careerOutputs, clearAll, importBundle, quickMemos, reflections, tasks, workLogs } from '../../lib/data';
import { devToggleAdFree, useAdFree } from '../../lib/entitlement';
import { activeAiKey, prefs, usePrefs, type Prefs } from '../../lib/prefs';
import { useCollection } from '../../lib/store';
import { colors, spacing, type } from '../../lib/theme';

const AI_KEY_FIELD = { gemini: 'geminiApiKey', openai: 'openaiApiKey', anthropic: 'anthropicApiKey' } as const;

export default function SettingsScreen() {
  const logs = useCollection(workLogs);
  const memos = useCollection(quickMemos);
  const allTasks = useCollection(tasks);
  useCollection(reflections);
  useCollection(careerOutputs);
  const adFree = useAdFree();
  const c = useColors();
  const prefsValue = usePrefs();
  const { profession, role, purpose, aiProvider } = prefsValue;
  const activeProvider = AI_PROVIDERS.find((p) => p.key === aiProvider)!;
  const activeKey = activeAiKey(prefsValue);
  const aiKeyField = AI_KEY_FIELD[aiProvider];
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verifyMsg, setVerifyMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function onVerifyKey() {
    setVerifying(true);
    setVerifyMsg(null);
    try {
      await validateApiKey({ provider: aiProvider, apiKey: activeKey });
      setVerifyMsg({ ok: true, text: '✓ キーは有効です。AI機能を使えます。' });
    } catch (e) {
      setVerifyMsg({ ok: false, text: e instanceof AiError ? e.message : '確認に失敗しました。' });
    } finally {
      setVerifying(false);
    }
  }

  async function onExport() {
    try {
      await Share.share({ message: JSON.stringify(buildExport(), null, 2), title: 'BRIDGE Worklog バックアップ' });
    } catch {
      // cancelled
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
    Alert.alert('全データを削除', '仕事ログ・メモ・タスク・振り返りをすべて削除します。取り消せません。', [
      { text: 'キャンセル', style: 'cancel' },
      { text: '削除する', style: 'destructive', onPress: () => void clearAll() },
    ]);
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}>
      <Card style={styles.statRow}>
        <Stat value={logs.length} label="ログ" />
        <Stat value={memos.length} label="メモ" />
        <Stat value={allTasks.length} label="タスク" />
      </Card>

      <Pressable onPress={() => router.push('/paywall')} disabled={adFree}>
        <Card style={[styles.proCard, { backgroundColor: adFree ? colors.accentWeak : c.primaryWeak, borderColor: adFree ? colors.accentWeak : c.primaryWeak }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.proTitle, { color: adFree ? colors.good : c.primary }]}>{adFree ? '広告オフ' : '広告を消す（買い切り）'}</Text>
            <Text style={[type.muted, adFree && { color: colors.good }]}>
              {adFree ? '✓ 広告は表示されません' : '機能は全部無料のまま、広告だけ非表示に'}
            </Text>
          </View>
          {!adFree ? <Text style={[styles.arrow, { color: c.primary }]}>›</Text> : null}
        </Card>
      </Pressable>

      <View>
        <SectionTitle>プロフィール</SectionTitle>
        <Pressable onPress={() => setProfileOpen(true)}>
          <Card style={{ gap: 4 }}>
            <Text style={type.body}>{profession || '職種を設定'}</Text>
            <Text style={type.muted}>{[role, purpose].filter(Boolean).join(' / ') || '立場・目的を設定'}</Text>
          </Card>
        </Pressable>
      </View>

      <View>
        <SectionTitle>キャリア変換</SectionTitle>
        <Pressable onPress={() => router.push('/career')}>
          <Card style={styles.linkCard}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
              <Feather name="file-text" size={18} color={c.primary} />
              <Text style={type.body}>ログから職務経歴書・自己PRを作る</Text>
            </View>
            <Feather name="chevron-right" size={20} color={c.primary} />
          </Card>
        </Pressable>
      </View>

      <View>
        <SectionTitle>テーマ</SectionTitle>
        <Card>
          <ThemePicker />
        </Card>
      </View>

      <View>
        <SectionTitle>AI</SectionTitle>
        <Card style={{ gap: spacing.md }}>
          <Text style={type.muted}>
            好きなAIプロバイダを選び、自分のAPIキーを登録すると、タスク化・メモ整理・振り返り・キャリア変換が高精度になります。
          </Text>
          <View style={styles.chips}>
            {AI_PROVIDERS.map((p) => (
              <Chip
                key={p.key}
                label={p.label}
                tone="primary"
                active={aiProvider === p.key}
                onPress={() => {
                  void prefs.set({ aiProvider: p.key });
                  setVerifyMsg(null);
                }}
              />
            ))}
          </View>
          <Pressable onPress={() => void Linking.openURL(activeProvider.keyUrl)} style={[styles.linkBtn, { borderColor: c.primary }]}>
            <Text style={[type.body, { color: c.primary, fontWeight: '700' }]}>{activeProvider.label} のAPIキーを取得 ↗</Text>
          </Pressable>
          <Field
            label={`${activeProvider.label} APIキー`}
            placeholder={activeProvider.keyHint}
            value={activeKey}
            onChangeText={(v) => {
              void prefs.set({ [aiKeyField]: v.trim() } as Partial<Prefs>);
              setVerifyMsg(null);
            }}
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
          />
          {verifyMsg ? (
            <Text style={[type.body, { color: verifyMsg.ok ? colors.good : colors.danger }]}>{verifyMsg.text}</Text>
          ) : (
            <Text style={type.muted}>{activeKey ? `モデル: ${activeProvider.model}・端末内のみに保存` : 'キー未設定でもモックで動作します'}</Text>
          )}
          <Button label={verifying ? '確認中…' : 'キーを確認'} onPress={onVerifyKey} disabled={!activeKey || verifying} />
          {activeKey ? (
            <Button label="キーを削除" variant="ghost" onPress={() => { void prefs.set({ [aiKeyField]: '' } as Partial<Prefs>); setVerifyMsg(null); }} />
          ) : null}
        </Card>
      </View>

      <View>
        <SectionTitle>バックアップ</SectionTitle>
        <Card style={{ gap: spacing.md }}>
          <Text style={type.muted}>データは端末内だけに保存されます。機種変更の前に書き出して保管してください。</Text>
          <Button label="バックアップを書き出す（JSON）" onPress={onExport} />
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
          <Text style={type.h2}>BRIDGE Worklog</Text>
          <Text style={type.muted}>
            日々の仕事ログ・メモ・タスクを残すと、職務経歴書や面接・1on1の材料になる。データは端末内（オフライン）に保持します。
          </Text>
          <Text style={[type.muted, { marginTop: spacing.xs }]}>バージョン 0.1.0 (MVP)</Text>
          <Pressable onPress={() => void devToggleAdFree()} hitSlop={8} style={{ marginTop: spacing.sm }}>
            <Text style={styles.devLink}>（開発用）広告オフを切り替え: {adFree ? 'ON' : 'OFF'}</Text>
          </Pressable>
        </Card>
      </View>

      <Sheet visible={importOpen} title="バックアップを取り込む" onClose={() => setImportOpen(false)}>
        <Text style={type.muted}>書き出した JSON を貼り付けてください。現在のデータは置き換えられます。</Text>
        <Field placeholder='{"app":"bridge-worklog", ...}' value={importText} onChangeText={setImportText} multiline />
        <Button label="取り込む" onPress={onImport} disabled={!importText.trim()} />
      </Sheet>

      <ProfileSheet visible={profileOpen} onClose={() => setProfileOpen(false)} />
    </ScrollView>
  );
}

function ProfileSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { profession, role, purpose } = usePrefs();
  return (
    <Sheet visible={visible} title="プロフィール" onClose={onClose}>
      <Picker label="職種" options={PROFESSIONS} value={profession} onChange={(v) => void prefs.set({ profession: v })} placeholder="職種を選択" />
      <Group title="現在の立場" options={ROLES} value={role} onSelect={(v) => void prefs.set({ role: v })} />
      <Group title="使う目的" options={PURPOSES} value={purpose} onSelect={(v) => void prefs.set({ purpose: v })} />
      <Button label="閉じる" onPress={onClose} />
    </Sheet>
  );
}

function Group({ title, options, value, onSelect }: { title: string; options: readonly string[]; value: string; onSelect: (v: string) => void }) {
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
  arrow: { fontSize: 22, fontWeight: '800' },
  linkCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  devLink: { ...type.muted, color: colors.line2 },
  linkBtn: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
