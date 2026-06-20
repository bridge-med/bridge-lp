import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, Switch, Text, View } from 'react-native';
import { BlockHeader } from '../../components/BlockHeader';
import { Picker } from '../../components/Picker';
import { Sheet } from '../../components/Sheet';
import { ThemePicker } from '../../components/ThemePicker';
import { useColors } from '../../components/ThemeProvider';
import { Button, Card, Chip, Field, SectionTitle } from '../../components/ui';
import { PROFESSIONS, PURPOSES, ROLES } from '../../lib/constants';
import { useCoins } from '../../lib/credits';
import { buildExport, careerOutputs, clearAll, importBundle, quickMemos, reflections, tasks, workLogs } from '../../lib/data';
import { cancelDaily, isNotifSupported, requestPermission, scheduleDaily } from '../../lib/notifications';
import { prefs, usePrefs } from '../../lib/prefs';
import { useCollection } from '../../lib/store';
import { colors, spacing, type } from '../../lib/theme';

const REMINDER_TIMES: [number, number][] = [
  [8, 0],
  [12, 0],
  [18, 0],
  [21, 0],
  [22, 30],
];
const fmtTime = (h: number, m: number) => `${h}:${String(m).padStart(2, '0')}`;

export default function SettingsScreen() {
  const logs = useCollection(workLogs);
  const memos = useCollection(quickMemos);
  const allTasks = useCollection(tasks);
  useCollection(reflections);
  useCollection(careerOutputs);
  const coins = useCoins();
  const c = useColors();
  const { profession, role, purpose, reminderEnabled, reminderHour, reminderMinute } = usePrefs();
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [profileOpen, setProfileOpen] = useState(false);

  async function toggleReminder(on: boolean) {
    if (on) {
      const ok = await requestPermission();
      if (!ok) {
        Alert.alert('通知が許可されていません', '端末の設定から通知を許可すると、毎日のリマインダーを受け取れます。');
        return;
      }
      await scheduleDaily(reminderHour, reminderMinute);
      await prefs.set({ reminderEnabled: true });
    } else {
      await cancelDaily();
      await prefs.set({ reminderEnabled: false });
    }
  }
  async function setReminderTime(h: number, m: number) {
    await prefs.set({ reminderHour: h, reminderMinute: m });
    if (reminderEnabled) await scheduleDaily(h, m);
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
    <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: spacing.xl }}>
      <BlockHeader wordmark="SETTINGS" title="設定" pad={24} />
      <View style={{ paddingHorizontal: spacing.lg, gap: spacing.lg, paddingTop: spacing.lg }}>
      <Card style={styles.statRow}>
        <Stat value={logs.length} label="ログ" />
        <Stat value={memos.length} label="メモ" />
        <Stat value={allTasks.length} label="タスク" />
      </Card>

      <Pressable onPress={() => router.push('/coins')}>
        <Card style={styles.proCard}>
          <Feather name="circle" size={22} color={c.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.proTitle}>コイン {coins}</Text>
            <Text style={type.muted}>AIによる生成にコインを使います</Text>
          </View>
          <Text style={[styles.arrow, { color: c.primary }]}>›</Text>
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
        <Card style={[styles.safe, { backgroundColor: c.accentWeak }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <Feather name="shield" size={18} color={c.good} />
            <Text style={[type.title, { color: c.good }]}>安心して使えます</Text>
          </View>
          <Text style={[type.body, { color: colors.text2, marginTop: spacing.xs }]}>
            アカウント不要 / 広告なし / 端末内保存。オフラインでも利用できます。AIは任意で、自分のAPIキーを使えます。
          </Text>
        </Card>
      </View>

      <View>
        <SectionTitle>毎日のリマインダー</SectionTitle>
        <Card style={{ gap: spacing.md }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ flex: 1 }}>
              <Text style={type.title}>記録のリマインド</Text>
              <Text style={type.muted}>
                {isNotifSupported() ? '毎日この時間に「書こう」と相棒がそっと通知します。' : 'プレビュー（web）では通知は使えません。実機アプリで有効です。'}
              </Text>
            </View>
            <Switch
              value={reminderEnabled}
              onValueChange={(v) => void toggleReminder(v)}
              disabled={!isNotifSupported()}
              trackColor={{ true: c.primary, false: colors.line2 }}
              thumbColor="#fff"
            />
          </View>
          {reminderEnabled ? (
            <View style={{ gap: spacing.sm }}>
              <Text style={type.label}>時間</Text>
              <View style={styles.chips}>
                {REMINDER_TIMES.map(([h, m]) => (
                  <Chip
                    key={fmtTime(h, m)}
                    label={fmtTime(h, m)}
                    tone="primary"
                    active={reminderHour === h && reminderMinute === m}
                    onPress={() => void setReminderTime(h, m)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </Card>
      </View>

      <View>
        <SectionTitle>テーマ</SectionTitle>
        <Card>
          <ThemePicker />
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
          <Text style={[type.muted, { marginTop: spacing.xs }]}>バージョン 1.0.0</Text>
          <Text style={[type.muted, { marginTop: spacing.xs, fontSize: 11 }]}>
            英単語データは公開コーパスをもとに生成（CEFR-J / octanove・CC BY-SA 4.0、EJDict-hand・Public Domain、FrequencyWords・CC BY-SA 4.0）。生成データは CC BY-SA 4.0 で配布します。
          </Text>
        </Card>
      </View>
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
  safe: { gap: 2, borderWidth: 0 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
