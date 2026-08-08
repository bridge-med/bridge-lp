// Study courses (English / Korean). Each bundles its dataset, decks, and the
// BCP-47 language tag used for text-to-speech. The course screen is generic over
// this config so both languages share one UI.

import koRaw from '../assets/vocab-ko.json';
import { DECKS as EN_DECKS, VOCAB as EN_VOCAB, type DeckDef, type VocabWord } from './vocab';

export type CourseId = 'en' | 'ko';

export interface Course {
  id: CourseId;
  title: string;
  wordmark: string;
  tts: string; // BCP-47 tag for expo-speech
  intro: string;
  words: VocabWord[];
  decks: DeckDef[];
  romaji: boolean; // show romanization line (Korean)
}

const KO_VOCAB = koRaw as VocabWord[];

const KO_DECKS: DeckDef[] = [
  { id: 'ko-b', title: '初級', subtitle: 'あいさつ・基礎の単語', match: (e) => e.l === '초급' },
  { id: 'ko-i', title: '中級', subtitle: 'もう一歩の単語', match: (e) => e.l === '중급' },
];

export const COURSES: Record<CourseId, Course> = {
  en: {
    id: 'en',
    title: '英単語コース',
    wordmark: 'ENGLISH',
    tts: 'en-US',
    intro: '中学〜高校・TOEICまで。毎日少しずつ、相棒と一緒に。発音は🔊で聞けます。',
    words: EN_VOCAB,
    decks: EN_DECKS,
    romaji: false,
  },
  ko: {
    id: 'ko',
    title: '韓国語コース',
    wordmark: 'KOREAN',
    tts: 'ko-KR',
    intro: 'あいさつ・基礎の韓国語を厳選。ハングルと発音(🔊)、ローマ字つき。',
    words: KO_VOCAB,
    decks: KO_DECKS,
    romaji: true,
  },
};

export function deckWordsFor(course: Course, deckId: string): VocabWord[] {
  const def = course.decks.find((d) => d.id === deckId);
  return def ? course.words.filter(def.match) : [];
}
