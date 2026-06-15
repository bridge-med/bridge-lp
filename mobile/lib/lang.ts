// Language learning: turn a Japanese work log into a study card (translation +
// vocabulary) for English or Korean. The real translation runs server-side
// (developer key) in production; this module ships a glossary-based PREVIEW so
// the feature is demonstrable offline. `generateLangCard` is the swap point.

import type { LangCode, VocabItem } from './types';

// term -> [English, Korean, Korean romanization]
const GLOSSARY: Record<string, [string, string, string]> = {
  // work / general
  仕事: ['work', '일', 'il'],
  業務: ['duties', '업무', 'eopmu'],
  会議: ['meeting', '회의', 'hoeui'],
  打ち合わせ: ['meeting', '미팅', 'miting'],
  資料: ['materials', '자료', 'jaryo'],
  報告: ['report', '보고', 'bogo'],
  連絡: ['contact', '연락', 'yeollak'],
  相談: ['consultation', '상담', 'sangdam'],
  確認: ['confirmation', '확인', 'hwagin'],
  準備: ['preparation', '준비', 'junbi'],
  段取り: ['planning', '준비/계획', 'gyehoek'],
  改善: ['improvement', '개선', 'gaeseon'],
  課題: ['issue', '과제', 'gwaje'],
  目標: ['goal', '목표', 'mokpyo'],
  成果: ['result', '성과', 'seonggwa'],
  実績: ['achievement', '실적', 'siljeok'],
  判断: ['judgment', '판단', 'pandan'],
  工夫: ['ingenuity', '궁리', 'gungri'],
  学び: ['learning', '배움', 'baeum'],
  反省: ['reflection', '반성', 'banseong'],
  共有: ['sharing', '공유', 'gongyu'],
  対応: ['handling', '대응', 'daeeung'],
  調整: ['coordination', '조정', 'jojeong'],
  提案: ['proposal', '제안', 'jean'],
  作成: ['creation', '작성', 'jakseong'],
  記録: ['record', '기록', 'girok'],
  締め切り: ['deadline', '마감', 'magam'],
  顧客: ['client', '고객', 'gogaek'],
  上司: ['boss', '상사', 'sangsa'],
  同僚: ['colleague', '동료', 'dongryo'],
  後輩: ['junior', '후배', 'hubae'],
  先輩: ['senior', '선배', 'seonbae'],
  新人: ['newcomer', '신입', 'sinip'],
  教育: ['training', '교육', 'gyoyuk'],
  評価: ['evaluation', '평가', 'pyeongga'],
  // healthcare / rehab (the user's domain)
  患者: ['patient', '환자', 'hwanja'],
  入院: ['admission', '입원', 'ibwon'],
  退院: ['discharge', '퇴원', 'toewon'],
  治療: ['treatment', '치료', 'chiryo'],
  診察: ['examination', '진찰', 'jinchal'],
  看護: ['nursing', '간호', 'ganho'],
  介護: ['care', '간병', 'ganbyeong'],
  リハビリ: ['rehabilitation', '재활', 'jaehwal'],
  評価表: ['assessment sheet', '평가표', 'pyeonggapyo'],
  初期評価: ['initial assessment', '초기 평가', 'chogi pyeongga'],
  カンファ: ['conference', '컨퍼런스', 'keonpeoreonseu'],
  症状: ['symptom', '증상', 'jeungsang'],
  回復: ['recovery', '회복', 'hoebok'],
  // verbs / states
  改善した: ['improved', '개선했다', 'gaeseonhaetda'],
  対応した: ['handled', '대응했다', 'daeeunghaetda'],
  気づいた: ['noticed', '깨달았다', 'kkaedaratada'],
  難しい: ['difficult', '어렵다', 'eoryeopda'],
  大事: ['important', '중요', 'jungyo'],
};

function dictValue(entry: [string, string, string], lang: LangCode): { translation: string; reading?: string } {
  return lang === 'en' ? { translation: entry[0] } : { translation: entry[1], reading: entry[2] };
}

/** Extract known vocabulary (longest-match, de-duplicated) from the text. */
export function extractVocab(text: string, lang: LangCode, limit = 10): VocabItem[] {
  const keys = Object.keys(GLOSSARY).sort((a, b) => b.length - a.length);
  const out: VocabItem[] = [];
  const seen = new Set<string>();
  for (const k of keys) {
    if (out.length >= limit) break;
    if (seen.has(k)) continue;
    if (text.includes(k)) {
      const v = dictValue(GLOSSARY[k], lang);
      out.push({ term: k, translation: v.translation, reading: v.reading });
      seen.add(k);
    }
  }
  return out;
}

/** PREVIEW translation: code-switch known terms into the target language. The
 *  production version returns a full, fluent translation from the AI backend. */
export function localLangCard(text: string, lang: LangCode): { translation: string; vocab: VocabItem[] } {
  const vocab = extractVocab(text, lang);
  let translation = text;
  for (const v of vocab) translation = translation.split(v.term).join(v.translation);
  return { translation, vocab };
}

export interface LangCreds {
  apiKey: string;
}

/** Generate a study card. With backend creds → real translation; else preview. */
export async function generateLangCard(
  text: string,
  lang: LangCode,
  _creds: LangCreds | null = null,
): Promise<{ translation: string; vocab: VocabItem[] }> {
  // TODO: when a backend proxy exists, call it here for a fluent translation.
  return localLangCard(text, lang);
}
