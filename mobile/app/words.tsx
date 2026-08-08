import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlockHeader } from '../components/BlockHeader';
import { useColors } from '../components/ThemeProvider';
import { Button, EmptyState } from '../components/ui';
import { DICT, dictTranslation } from '../lib/dict';
import { speak as ttsSpeak } from '../lib/speech';
import { MAX_BOX, studyDeck, useWordbank, wordbank, wordOfTheDay, type SavedWord } from '../lib/wordbank';
import { colors, fonts, radius, spacing, type } from '../lib/theme';
import type { LangCode } from '../lib/types';

function speak(text: string, lang: LangCode) {
  ttsSpeak(text, lang === 'ko' ? 'ko-KR' : 'en-US');
}

function SpeakBtn({ text, lang, c }: { text: string; lang: LangCode; c: ReturnType<typeof useColors> }) {
  return (
    <Pressable onPress={() => speak(text, lang)} hitSlop={8} style={[styles.speak, { backgroundColor: c.primaryWeak }]}>
      <Feather name="volume-2" size={16} color={c.primary} />
    </Pressable>
  );
}

export default function WordsScreen() {
  const c = useColors();
  const words = useWordbank();
  const [lang, setLang] = useState<LangCode>('en');
  const [study, setStudy] = useState(false);

  const mastered = words.filter((w) => w.box >= MAX_BOX).length;
  const sorted = useMemo(() => [...words].sort((a, b) => (a.addedAt < b.addedAt ? 1 : -1)), [words]);
  const wotd = wordOfTheDay();
  const wotdSaved = words.some((w) => w.term === wotd);
  const tr = (term: string) => dictTranslation(DICT[term], lang);

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <BlockHeader wordmark="VOCAB" title="たんごちょう" onBack pad={24} />

        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          {/* stats + language */}
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{words.length}</Text>
              <Text style={type.muted}>ことば</Text>
            </View>
            <View style={styles.statDiv} />
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: c.primary }]}>{mastered}</Text>
              <Text style={type.muted}>おぼえた</Text>
            </View>
            <View style={styles.langToggle}>
              {(['en', 'ko'] as LangCode[]).map((l) => (
                <Pressable key={l} onPress={() => setLang(l)} style={[styles.langChip, lang === l && { backgroundColor: c.primary }]}>
                  <Text style={[styles.langText, { color: lang === l ? '#fff' : colors.text2 }]}>{l === 'en' ? 'EN' : 'KO'}</Text>
                </Pressable>
              ))}
            </View>
          </View>

          {/* word of the day */}
          <View style={[styles.wotd, { backgroundColor: c.primaryWeak }]}>
            <View style={{ flex: 1 }}>
              <Text style={[type.label, { color: c.primary }]}>きょうの単語</Text>
              <Text style={styles.wotdTerm}>{wotd}</Text>
              <Text style={type.body}>
                {tr(wotd).translation}
                {tr(wotd).reading ? <Text style={type.muted}>　{tr(wotd).reading}</Text> : null}
              </Text>
            </View>
            <SpeakBtn text={tr(wotd).translation} lang={lang} c={c} />
            <Pressable
              onPress={() => void wordbank.add(wotd)}
              disabled={wotdSaved}
              style={[styles.wotdBtn, { backgroundColor: wotdSaved ? colors.surface2 : c.primary }]}
            >
              <Feather name={wotdSaved ? 'check' : 'plus'} size={18} color={wotdSaved ? colors.muted : '#fff'} />
            </Pressable>
          </View>

          <Button label="暗記モードをはじめる" onPress={() => setStudy(true)} disabled={words.length === 0} />

          <Pressable onPress={() => router.push('/vocab')} style={[styles.courseLink, { backgroundColor: c.primaryWeak }]}>
            <Feather name="award" size={18} color={c.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[type.title, { color: c.primary }]}>英単語コース</Text>
              <Text style={type.muted}>中学〜高校・TOEIC、約7,500語をレベル別に</Text>
            </View>
            <Feather name="chevron-right" size={20} color={c.primary} />
          </Pressable>

          {sorted.length === 0 ? (
            <EmptyState icon="book-open" title="まだ単語がありません" hint="ログ・メモ・タスクに出てきた言葉が、自動でここに貯まります。" />
          ) : (
            sorted.map((w) => (
              <View key={w.term} style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.term}>{w.term}</Text>
                  <Text style={type.muted}>
                    {tr(w.term).translation}
                    {tr(w.term).reading ? `　${tr(w.term).reading}` : ''}
                  </Text>
                </View>
                <SpeakBtn text={tr(w.term).translation} lang={lang} c={c} />
                <Boxes box={w.box} c={c} />
                <Pressable onPress={() => void wordbank.remove(w.term)} hitSlop={8} style={{ marginLeft: spacing.sm }}>
                  <Feather name="x" size={16} color={colors.line2} />
                </Pressable>
              </View>
            ))
          )}
        </View>
      </ScrollView>

      <FlashcardModal visible={study} lang={lang} onClose={() => setStudy(false)} />
    </View>
  );
}

function Boxes({ box, c }: { box: number; c: ReturnType<typeof useColors> }) {
  return (
    <View style={{ flexDirection: 'row', gap: 3 }}>
      {Array.from({ length: MAX_BOX }).map((_, i) => (
        <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: i < box ? c.primary : colors.line2 }} />
      ))}
    </View>
  );
}

function FlashcardModal({ visible, lang, onClose }: { visible: boolean; lang: LangCode; onClose: () => void }) {
  const c = useColors();
  const words = useWordbank();
  const [deck, setDeck] = useState<SavedWord[]>([]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [seed, setSeed] = useState(false);
  const [done, setDone] = useState(0);

  // build the deck once when opening
  if (visible && !seed) {
    setSeed(true);
    setDeck(studyDeck(words));
    setI(0);
    setFlipped(false);
    setDone(0);
  }
  if (!visible && seed) setSeed(false);

  const card = deck[i];
  const tr = card ? dictTranslation(DICT[card.term], lang) : null;

  function answer(known: boolean) {
    if (card) void wordbank.review(card.term, known);
    setDone((d) => d + 1);
    setFlipped(false);
    setI((n) => n + 1);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHead}>
            <Text style={type.label}>暗記モード</Text>
            <Pressable onPress={onClose} hitSlop={10}><Feather name="x" size={22} color={colors.muted} /></Pressable>
          </View>

          {card ? (
            <>
              <Text style={[type.muted, { textAlign: 'center' }]}>{i + 1} / {deck.length}</Text>
              <Pressable style={styles.flash} onPress={() => setFlipped((f) => !f)}>
                {!flipped ? (
                  <>
                    <Text style={styles.flashTerm}>{card.term}</Text>
                    <Text style={type.muted}>タップで答え</Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.flashAnswer, { color: c.primary }]}>{tr!.translation}</Text>
                    {tr!.reading ? <Text style={type.body}>{tr!.reading}</Text> : null}
                    <SpeakBtn text={tr!.translation} lang={lang} c={c} />
                    <Text style={[type.muted, { marginTop: spacing.sm }]}>{card.term}</Text>
                  </>
                )}
              </Pressable>
              <View style={styles.flashBtns}>
                <Pressable style={[styles.fbtn, { backgroundColor: colors.surface2 }]} onPress={() => answer(false)}>
                  <Text style={[styles.fbtnText, { color: colors.text2 }]}>もう一度</Text>
                </Pressable>
                <Pressable style={[styles.fbtn, { backgroundColor: c.primary }]} onPress={() => answer(true)}>
                  <Text style={[styles.fbtnText, { color: '#fff' }]}>おぼえた</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <View style={{ alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.sm }}>
              <Feather name="check-circle" size={40} color={c.primary} />
              <Text style={type.h2}>おつかれさま！</Text>
              <Text style={type.muted}>{done} 語を復習しました</Text>
              <View style={{ height: spacing.md }} />
              <Button label="とじる" onPress={onClose} />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, paddingVertical: spacing.md },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statDiv: { width: StyleSheet.hairlineWidth, height: 30, backgroundColor: colors.line },
  statNum: { fontFamily: fonts.maruBlack, fontSize: 26, color: colors.text },
  langToggle: { flexDirection: 'row', gap: 4, paddingHorizontal: spacing.md },
  langChip: { paddingHorizontal: 12, height: 30, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface2 },
  langText: { fontFamily: fonts.gothicBold, fontSize: 11, letterSpacing: 1 },
  courseLink: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, padding: spacing.md },
  speak: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  wotd: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderRadius: radius.lg, padding: spacing.md },
  wotdTerm: { fontFamily: fonts.maru, fontSize: 22, color: colors.text, marginVertical: 2 },
  wotdBtn: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: spacing.md },
  term: { fontFamily: fonts.maru, fontSize: 16, color: colors.text },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(59,48,38,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl + 6, borderTopRightRadius: radius.xl + 6, padding: spacing.lg, paddingBottom: spacing.xl, minHeight: 380 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  flash: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, marginVertical: spacing.md, minHeight: 180, gap: spacing.sm },
  flashTerm: { fontFamily: fonts.maruBlack, fontSize: 34, color: colors.text },
  flashAnswer: { fontFamily: fonts.maru, fontSize: 28 },
  flashBtns: { flexDirection: 'row', gap: spacing.md },
  fbtn: { flex: 1, height: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  fbtnText: { fontFamily: fonts.maru, fontSize: 16 },
});
