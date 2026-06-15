import { Feather } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlockHeader } from '../components/BlockHeader';
import { Sheet } from '../components/Sheet';
import { useColors } from '../components/ThemeProvider';
import { Button, EmptyState } from '../components/ui';
import { credits, LANG_COST, useCoins } from '../lib/credits';
import { langCards, workLogs } from '../lib/data';
import { formatDateJa } from '../lib/date';
import { generateLangCard } from '../lib/lang';
import { useCollection } from '../lib/store';
import { colors, fonts, radius, spacing, type } from '../lib/theme';
import type { LangCard, LangCode, WorkLog } from '../lib/types';

const LANGS: { code: LangCode; label: string; flag: string }[] = [
  { code: 'en', label: '英語', flag: 'EN' },
  { code: 'ko', label: '韓国語', flag: 'KO' },
];

function logToText(l: WorkLog): string {
  return [l.title, l.did, l.devised, l.decision, l.learning, l.nextAction]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join('。');
}

export default function LangScreen() {
  const c = useColors();
  const coins = useCoins();
  const params = useLocalSearchParams<{ logId?: string }>();
  const logs = useCollection(workLogs);
  const cards = useCollection(langCards);
  const [lang, setLang] = useState<LangCode>('en');
  const [pickOpen, setPickOpen] = useState(!!params.logId);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const sortedLogs = useMemo(() => [...logs].sort((a, b) => (a.date < b.date ? 1 : -1)), [logs]);
  const sortedCards = useMemo(() => [...cards].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)), [cards]);

  async function convert(source: WorkLog) {
    const text = logToText(source);
    if (!text) {
      Alert.alert('内容が空です', 'このログには変換できる文章がありません。');
      return;
    }
    if (!(await credits.spend(LANG_COST))) {
      Alert.alert('コインが足りません', `語学変換には ${LANG_COST} コイン必要です。`, [
        { text: '閉じる', style: 'cancel' },
        { text: 'コインを見る', onPress: () => router.push('/coins') },
      ]);
      return;
    }
    setBusy(true);
    try {
      const { translation, vocab } = await generateLangCard(text, lang);
      const saved = await langCards.upsert({
        lang,
        sourceText: text,
        translation,
        vocab,
        sourceLogId: source.id,
      } as Partial<LangCard>);
      setPickOpen(false);
      setExpanded(saved.id);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <BlockHeader
          wordmark="LANGUAGE"
          title="ことのは"
          onBack
          pad={24}
          right={
            <View style={styles.coinPill}>
              <View style={styles.coin} />
              <Text style={styles.coinText}>{coins}</Text>
            </View>
          }
        />

        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <Text style={type.muted}>
            書いた仕事ログを、英語・韓国語の学習カードに変換。仕事の言葉がそのまま教材になります（1回 {LANG_COST} コイン）。
          </Text>

          {/* language toggle */}
          <View style={styles.langRow}>
            {LANGS.map((l) => {
              const on = l.code === lang;
              return (
                <Pressable key={l.code} onPress={() => setLang(l.code)} style={[styles.langChip, on ? { backgroundColor: c.primary } : { backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line }]}>
                  <Text style={[styles.langFlag, { color: on ? '#fff' : c.primary }]}>{l.flag}</Text>
                  <Text style={[styles.langLabel, { color: on ? '#fff' : colors.text }]}>{l.label}</Text>
                </Pressable>
              );
            })}
          </View>

          <Button label="ログを選んで変換する" onPress={() => setPickOpen(true)} />
          <Pressable onPress={() => router.push('/words')} style={styles.wordsLink}>
            <Feather name="book-open" size={16} color={c.primary} />
            <Text style={[type.bodyMed, { color: c.primary }]}>単語帳・暗記モードへ</Text>
            <Feather name="chevron-right" size={18} color={c.primary} />
          </Pressable>

          {sortedCards.length === 0 ? (
            <EmptyState icon="globe" title="まだ学習カードがありません" hint="仕事ログを英語・韓国語に変換すると、ここに貯まります。" />
          ) : (
            sortedCards.map((card) => (
              <Pressable key={card.id} onPress={() => setExpanded(expanded === card.id ? null : card.id)} style={styles.card}>
                <View style={styles.cardHead}>
                  <View style={[styles.tag, { backgroundColor: c.primaryWeak }]}>
                    <Text style={[styles.tagText, { color: c.primary }]}>{card.lang === 'en' ? 'EN' : 'KO'}</Text>
                  </View>
                  <Text style={[type.muted, { flex: 1 }]} numberOfLines={1}>{card.sourceText}</Text>
                </View>
                {expanded === card.id ? (
                  <View style={{ marginTop: spacing.sm, gap: spacing.md }}>
                    <View>
                      <Text style={styles.fieldLabel}>原文</Text>
                      <Text style={type.body}>{card.sourceText}</Text>
                    </View>
                    <View>
                      <Text style={styles.fieldLabel}>{card.lang === 'en' ? '英語' : '韓国語'}（プレビュー）</Text>
                      <Text style={[type.body, { color: c.primary }]}>{card.translation}</Text>
                    </View>
                    {card.vocab.length > 0 ? (
                      <View>
                        <Text style={styles.fieldLabel}>単語帳</Text>
                        {card.vocab.map((v, i) => (
                          <View key={i} style={styles.vocabRow}>
                            <Text style={styles.vocabTerm}>{v.term}</Text>
                            <View style={{ flex: 1 }}>
                              <Text style={styles.vocabTrans}>{v.translation}</Text>
                              {v.reading ? <Text style={type.muted}>{v.reading}</Text> : null}
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : null}
                    <Button label="削除" variant="danger" onPress={() => void langCards.remove(card.id)} />
                  </View>
                ) : (
                  <Text style={[type.body, { marginTop: 4, color: c.primary }]} numberOfLines={1}>{card.translation}</Text>
                )}
              </Pressable>
            ))
          )}
        </View>
      </ScrollView>

      <Sheet visible={pickOpen} title={`${lang === 'en' ? '英語' : '韓国語'}に変換するログ`} onClose={() => setPickOpen(false)}>
        <Text style={type.muted}>変換するログを選んでください（{LANG_COST}コイン）。</Text>
        {busy ? (
          <Text style={[type.muted, { textAlign: 'center', paddingVertical: spacing.md }]}>変換しています…</Text>
        ) : sortedLogs.length === 0 ? (
          <Text style={[type.muted, { paddingVertical: spacing.md }]}>まずホームから仕事ログを書きましょう。</Text>
        ) : (
          sortedLogs.slice(0, 20).map((l) => (
            <Pressable key={l.id} onPress={() => void convert(l)} style={styles.pickRow}>
              <View style={{ flex: 1 }}>
                <Text style={type.title} numberOfLines={1}>{l.title || '無題のログ'}</Text>
                <Text style={type.muted}>{formatDateJa(l.date)}</Text>
              </View>
              <Feather name="chevron-right" size={20} color={colors.line2} />
            </Pressable>
          ))
        )}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  coinPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,253,248,0.2)', borderRadius: radius.pill, paddingHorizontal: 12, height: 30 },
  coin: { width: 13, height: 13, borderRadius: 7, backgroundColor: colors.gold },
  coinText: { fontFamily: fonts.maru, fontSize: 13, color: colors.onAccent },
  langRow: { flexDirection: 'row', gap: spacing.md },
  langChip: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm, height: 48, borderRadius: radius.lg },
  langFlag: { fontFamily: fonts.gothicBold, fontSize: 12, letterSpacing: 1 },
  langLabel: { fontFamily: fonts.maru, fontSize: 15 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: spacing.md },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tag: { paddingHorizontal: 8, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  tagText: { fontFamily: fonts.gothicBold, fontSize: 10, letterSpacing: 1 },
  fieldLabel: { ...type.label, marginBottom: 4 },
  vocabRow: { flexDirection: 'row', gap: spacing.md, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  vocabTerm: { fontFamily: fonts.maru, fontSize: 15, color: colors.text, width: 110 },
  vocabTrans: { fontFamily: fonts.gothicMed, fontSize: 15, color: colors.text },
  pickRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  wordsLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'center', paddingVertical: spacing.sm },
});
