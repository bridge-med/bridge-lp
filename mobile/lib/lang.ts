// Language learning: turn a Japanese work log into a study card (translation +
// vocabulary) for English or Korean. The real translation runs server-side
// (developer key) in production; this module ships a glossary-based PREVIEW so
// the feature is demonstrable offline. `generateLangCard` is the swap point.

import { DICT, dictTranslation, matchTerms } from './dict';
import type { LangCode, VocabItem } from './types';

/** Extract known vocabulary (longest-match, de-duplicated) from the text. */
export function extractVocab(text: string, lang: LangCode, limit = 10): VocabItem[] {
  return matchTerms(text, limit).map((term) => {
    const v = dictTranslation(DICT[term], lang);
    return { term, translation: v.translation, reading: v.reading };
  });
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
