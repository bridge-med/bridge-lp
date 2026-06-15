import { Feather } from '@expo/vector-icons';
import * as Speech from 'expo-speech';
import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BlockHeader } from '../components/BlockHeader';
import { useColors } from '../components/ThemeProvider';
import { Button } from '../components/ui';
import { progress } from '../lib/progress';
import { colors, fonts, radius, spacing, type } from '../lib/theme';
import { DECKS, VOCAB, type VocabWord } from '../lib/vocab';
import { buildSession, deckStats, MAX_BOX, useVocabDeck, vocabDeck } from '../lib/vocabdeck';

const SESSION_SIZE = 20;

function speak(word: string) {
  try {
    Speech.stop();
    Speech.speak(word, { language: 'en-US', rate: 0.9 });
  } catch {
    // TTS unavailable on this platform — ignore.
  }
}

export default function VocabScreen() {
  const c = useColors();
  const data = useVocabDeck();
  const [deckId, setDeckId] = useState<string | null>(null);

  const totalMastered = useMemo(
    () => Object.values(data).filter((p) => p.box >= MAX_BOX).length,
    [data],
  );

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.xl }}>
        <BlockHeader wordmark="ENGLISH" title="英単語コース" onBack pad={24} />

        <View style={{ padding: spacing.lg, gap: spacing.md }}>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Text style={styles.statNum}>{VOCAB.length.toLocaleString()}</Text>
              <Text style={type.muted}>収録語</Text>
            </View>
            <View style={styles.statDiv} />
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: c.primary }]}>{totalMastered.toLocaleString()}</Text>
              <Text style={type.muted}>おぼえた</Text>
            </View>
          </View>

          <Text style={type.muted}>
            中学〜高校・TOEICまで。毎日少しずつ、相棒と一緒に。発音は🔊で聞けます。
          </Text>

          {DECKS.map((d) => {
            const s = deckStats(d.id, data);
            const pct = s.total ? s.mastered / s.total : 0;
            return (
              <Pressable key={d.id} onPress={() => setDeckId(d.id)} style={styles.deck}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <Text style={styles.deckTitle}>{d.title}</Text>
                    {s.due > 0 ? (
                      <View style={[styles.dueBadge, { backgroundColor: c.primary }]}>
                        <Text style={styles.dueText}>{s.due > 99 ? '99+' : s.due}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={type.muted}>{d.subtitle}</Text>
                  <View style={styles.barTrack}>
                    <View style={[styles.barFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: c.primary }]} />
                  </View>
                  <Text style={[type.muted, { fontSize: 11 }]}>
                    {s.mastered} / {s.total} 語マスター
                  </Text>
                </View>
                <Feather name="chevron-right" size={20} color={colors.line2} />
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      <SessionModal deckId={deckId} onClose={() => setDeckId(null)} />
    </View>
  );
}

function SessionModal({ deckId, onClose }: { deckId: string | null; onClose: () => void }) {
  const c = useColors();
  const data = useVocabDeck();
  const [deck, setDeck] = useState<VocabWord[]>([]);
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [known, setKnown] = useState(0);

  const visible = deckId != null;
  // Seed the session once when opening (snapshot the due queue).
  if (visible && !seeded) {
    setSeeded(true);
    setDeck(buildSession(deckId, data, SESSION_SIZE));
    setI(0);
    setFlipped(false);
    setKnown(0);
  }
  if (!visible && seeded) setSeeded(false);

  const card = deck[i];

  function answer(isKnown: boolean) {
    if (card) {
      void vocabDeck.review(card.w, isKnown);
      if (isKnown) setKnown((n) => n + 1);
      if (i + 1 >= deck.length) void progress.recordActivity('study'); // session complete
    }
    setFlipped(false);
    setI((n) => n + 1);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <View style={styles.modalHead}>
            <Text style={type.label}>{deckId ? DECKS.find((d) => d.id === deckId)?.title : ''}</Text>
            <Pressable onPress={onClose} hitSlop={10}>
              <Feather name="x" size={22} color={colors.muted} />
            </Pressable>
          </View>

          {card ? (
            <>
              <Text style={[type.muted, { textAlign: 'center' }]}>
                {i + 1} / {deck.length}
              </Text>
              <Pressable style={styles.flash} onPress={() => setFlipped((f) => !f)}>
                {!flipped ? (
                  <>
                    <View style={styles.badges}>
                      <Text style={[styles.lv, { color: c.primary }]}>{card.l}</Text>
                      {card.p ? <Text style={styles.pos}>{card.p}</Text> : null}
                      {card.b ? <Text style={[styles.pos, { color: c.good }]}>TOEIC</Text> : null}
                    </View>
                    <Text style={styles.flashTerm}>{card.w}</Text>
                    <Pressable
                      onPress={() => speak(card.w)}
                      hitSlop={12}
                      style={[styles.speak, { backgroundColor: c.primaryWeak }]}
                    >
                      <Feather name="volume-2" size={20} color={c.primary} />
                    </Pressable>
                    <Text style={type.muted}>タップで意味</Text>
                  </>
                ) : (
                  <>
                    <Text style={[styles.flashAnswer, { color: c.primary }]}>{card.j}</Text>
                    <Text style={[type.muted, { marginTop: spacing.sm }]}>{card.w}</Text>
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
              <Feather name={deck.length ? 'check-circle' : 'coffee'} size={40} color={c.primary} />
              <Text style={type.h2}>{deck.length ? 'おつかれさま！' : '今日の分は完了'}</Text>
              <Text style={type.muted}>
                {deck.length ? `${deck.length} 語中 ${known} 語おぼえた` : 'このデッキの復習は今は無いよ。また後で。'}
              </Text>
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
  deck: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, padding: spacing.md },
  deckTitle: { fontFamily: fonts.maru, fontSize: 17, color: colors.text },
  dueBadge: { minWidth: 22, height: 20, borderRadius: 10, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  dueText: { fontFamily: fonts.gothicBold, fontSize: 11, color: '#fff' },
  barTrack: { height: 6, borderRadius: 3, backgroundColor: colors.line, marginTop: 8, overflow: 'hidden' },
  barFill: { height: 6, borderRadius: 3 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(59,48,38,0.45)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.bg, borderTopLeftRadius: radius.xl + 6, borderTopRightRadius: radius.xl + 6, padding: spacing.lg, paddingBottom: spacing.xl, minHeight: 420 },
  modalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  flash: { backgroundColor: colors.surface, borderRadius: radius.xl, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xl, marginVertical: spacing.md, minHeight: 220, gap: spacing.sm },
  badges: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  lv: { fontFamily: fonts.gothicBold, fontSize: 12, letterSpacing: 1 },
  pos: { fontFamily: fonts.gothic, fontSize: 12, color: colors.muted },
  flashTerm: { fontFamily: fonts.maruBlack, fontSize: 38, color: colors.text },
  speak: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  flashAnswer: { fontFamily: fonts.maru, fontSize: 24, textAlign: 'center', paddingHorizontal: spacing.md },
  flashBtns: { flexDirection: 'row', gap: spacing.md },
  fbtn: { flex: 1, height: 52, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  fbtnText: { fontFamily: fonts.maru, fontSize: 16 },
});
