// Shared JP -> EN/KO dictionary used by the language cards and the word bank.
// This is a curated CORE set (high-frequency work / daily / TOEIC-ish words).
// In production the AI backend extends/refines this; offline it powers a real
// preview and the flashcard study mode.
//
// Entry: term -> { en, ko, kr } (kr = Korean romanization hint)

import type { LangCode } from './types';

export interface DictEntry {
  en: string;
  ko: string;
  kr: string;
}

export const DICT: Record<string, DictEntry> = {
  // --- work / business ---
  仕事: { en: 'work', ko: '일', kr: 'il' },
  業務: { en: 'duties', ko: '업무', kr: 'eopmu' },
  会議: { en: 'meeting', ko: '회의', kr: 'hoeui' },
  打ち合わせ: { en: 'meeting', ko: '미팅', kr: 'miting' },
  資料: { en: 'materials', ko: '자료', kr: 'jaryo' },
  報告: { en: 'report', ko: '보고', kr: 'bogo' },
  連絡: { en: 'contact', ko: '연락', kr: 'yeollak' },
  相談: { en: 'consultation', ko: '상담', kr: 'sangdam' },
  確認: { en: 'confirmation', ko: '확인', kr: 'hwagin' },
  準備: { en: 'preparation', ko: '준비', kr: 'junbi' },
  段取り: { en: 'planning', ko: '계획', kr: 'gyehoek' },
  改善: { en: 'improvement', ko: '개선', kr: 'gaeseon' },
  課題: { en: 'issue', ko: '과제', kr: 'gwaje' },
  問題: { en: 'problem', ko: '문제', kr: 'munje' },
  目標: { en: 'goal', ko: '목표', kr: 'mokpyo' },
  成果: { en: 'result', ko: '성과', kr: 'seonggwa' },
  実績: { en: 'achievement', ko: '실적', kr: 'siljeok' },
  判断: { en: 'judgment', ko: '판단', kr: 'pandan' },
  工夫: { en: 'ingenuity', ko: '궁리', kr: 'gungri' },
  学び: { en: 'learning', ko: '배움', kr: 'baeum' },
  反省: { en: 'reflection', ko: '반성', kr: 'banseong' },
  共有: { en: 'sharing', ko: '공유', kr: 'gongyu' },
  対応: { en: 'handling', ko: '대응', kr: 'daeeung' },
  調整: { en: 'coordination', ko: '조정', kr: 'jojeong' },
  提案: { en: 'proposal', ko: '제안', kr: 'jean' },
  作成: { en: 'creation', ko: '작성', kr: 'jakseong' },
  記録: { en: 'record', ko: '기록', kr: 'girok' },
  締め切り: { en: 'deadline', ko: '마감', kr: 'magam' },
  予定: { en: 'schedule', ko: '예정', kr: 'yejeong' },
  計画: { en: 'plan', ko: '계획', kr: 'gyehoek' },
  決定: { en: 'decision', ko: '결정', kr: 'gyeoljeong' },
  会社: { en: 'company', ko: '회사', kr: 'hoesa' },
  顧客: { en: 'client', ko: '고객', kr: 'gogaek' },
  上司: { en: 'boss', ko: '상사', kr: 'sangsa' },
  同僚: { en: 'colleague', ko: '동료', kr: 'dongryo' },
  後輩: { en: 'junior', ko: '후배', kr: 'hubae' },
  先輩: { en: 'senior', ko: '선배', kr: 'seonbae' },
  新人: { en: 'newcomer', ko: '신입', kr: 'sinip' },
  教育: { en: 'training', ko: '교육', kr: 'gyoyuk' },
  評価: { en: 'evaluation', ko: '평가', kr: 'pyeongga' },
  経験: { en: 'experience', ko: '경험', kr: 'gyeongheom' },
  責任: { en: 'responsibility', ko: '책임', kr: 'chaegim' },
  挑戦: { en: 'challenge', ko: '도전', kr: 'dojeon' },
  成長: { en: 'growth', ko: '성장', kr: 'seongjang' },
  努力: { en: 'effort', ko: '노력', kr: 'noryeok' },
  // --- healthcare / rehab ---
  患者: { en: 'patient', ko: '환자', kr: 'hwanja' },
  入院: { en: 'admission', ko: '입원', kr: 'ibwon' },
  退院: { en: 'discharge', ko: '퇴원', kr: 'toewon' },
  治療: { en: 'treatment', ko: '치료', kr: 'chiryo' },
  診察: { en: 'examination', ko: '진찰', kr: 'jinchal' },
  看護: { en: 'nursing', ko: '간호', kr: 'ganho' },
  介護: { en: 'care', ko: '간병', kr: 'ganbyeong' },
  リハビリ: { en: 'rehabilitation', ko: '재활', kr: 'jaehwal' },
  症状: { en: 'symptom', ko: '증상', kr: 'jeungsang' },
  回復: { en: 'recovery', ko: '회복', kr: 'hoebok' },
  // --- daily life ---
  朝: { en: 'morning', ko: '아침', kr: 'achim' },
  昼: { en: 'noon', ko: '점심', kr: 'jeomsim' },
  夜: { en: 'night', ko: '밤', kr: 'bam' },
  今日: { en: 'today', ko: '오늘', kr: 'oneul' },
  明日: { en: 'tomorrow', ko: '내일', kr: 'naeil' },
  昨日: { en: 'yesterday', ko: '어제', kr: 'eoje' },
  時間: { en: 'time', ko: '시간', kr: 'sigan' },
  友達: { en: 'friend', ko: '친구', kr: 'chingu' },
  家族: { en: 'family', ko: '가족', kr: 'gajok' },
  食事: { en: 'meal', ko: '식사', kr: 'siksa' },
  電車: { en: 'train', ko: '전철', kr: 'jeoncheol' },
  買い物: { en: 'shopping', ko: '쇼핑', kr: 'syoping' },
  天気: { en: 'weather', ko: '날씨', kr: 'nalssi' },
  旅行: { en: 'travel', ko: '여행', kr: 'yeohaeng' },
  健康: { en: 'health', ko: '건강', kr: 'geongang' },
  運動: { en: 'exercise', ko: '운동', kr: 'undong' },
  勉強: { en: 'study', ko: '공부', kr: 'gongbu' },
  // --- feelings / adjectives ---
  大事: { en: 'important', ko: '중요', kr: 'jungyo' },
  大変: { en: 'tough', ko: '힘듦', kr: 'himdeum' },
  難しい: { en: 'difficult', ko: '어렵다', kr: 'eoryeopda' },
  簡単: { en: 'easy', ko: '쉽다', kr: 'swipda' },
  楽しい: { en: 'fun', ko: '즐겁다', kr: 'jeulgeopda' },
  嬉しい: { en: 'happy', ko: '기쁘다', kr: 'gippeuda' },
  不安: { en: 'anxious', ko: '불안', kr: 'buran' },
  自信: { en: 'confidence', ko: '자신감', kr: 'jasingam' },
  丁寧: { en: 'polite', ko: '정중', kr: 'jeongjung' },
  正確: { en: 'accurate', ko: '정확', kr: 'jeonghwak' },
  // --- verbs (dictionary form) ---
  始める: { en: 'to start', ko: '시작하다', kr: 'sijakada' },
  終わる: { en: 'to finish', ko: '끝나다', kr: 'kkeutnada' },
  続ける: { en: 'to continue', ko: '계속하다', kr: 'gyesokada' },
  考える: { en: 'to think', ko: '생각하다', kr: 'saenggakada' },
  決める: { en: 'to decide', ko: '정하다', kr: 'jeonghada' },
  伝える: { en: 'to convey', ko: '전하다', kr: 'jeonhada' },
  気づく: { en: 'to notice', ko: '깨닫다', kr: 'kkaedatda' },
  覚える: { en: 'to memorize', ko: '외우다', kr: 'oeuda' },
  調べる: { en: 'to look up', ko: '조사하다', kr: 'josahada' },
  手伝う: { en: 'to help', ko: '돕다', kr: 'dopda' },
  頑張る: { en: 'to do one’s best', ko: '열심히 하다', kr: 'yeolsimhi hada' },
};

const KEYS = Object.keys(DICT).sort((a, b) => b.length - a.length);

export function dictTranslation(entry: DictEntry, lang: LangCode): { translation: string; reading?: string } {
  return lang === 'en' ? { translation: entry.en } : { translation: entry.ko, reading: entry.kr };
}

/** Terms in `text` that exist in the dictionary (longest-match, de-duplicated). */
export function matchTerms(text: string, limit = 50): string[] {
  const out: string[] = [];
  for (const k of KEYS) {
    if (out.length >= limit) break;
    if (text.includes(k)) out.push(k);
  }
  return out;
}

export const ALL_TERMS = KEYS;
