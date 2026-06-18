// Text-to-speech helper. expo-speech uses the OS/browser voices, so quality
// depends on what's installed. We explicitly pick the best-matching voice for
// the target language (preferring "Enhanced" quality and an exact region match),
// which avoids the device falling back to a wrong-language engine — the usual
// cause of bad-sounding Korean on some platforms.

import * as Speech from 'expo-speech';

// language prefix (e.g. "ko", "en") -> chosen voice identifier
let bestVoice: Record<string, string> = {};
let voicesLoaded = false;
let loadingPromise: Promise<void> | null = null;

async function ensureVoices(): Promise<void> {
  if (voicesLoaded) return;
  if (loadingPromise) return loadingPromise;
  loadingPromise = (async () => {
    try {
      const voices = await Speech.getAvailableVoicesAsync();
      const scored: Record<string, number> = {};
      for (const v of voices) {
        const lang = (v.language || '').toLowerCase(); // e.g. "ko-kr"
        const prefix = lang.split('-')[0];
        if (!prefix) continue;
        let score = v.quality === Speech.VoiceQuality.Enhanced ? 10 : 5;
        // Prefer the canonical region for each language.
        if (lang === 'ko-kr' || lang === 'en-us') score += 2;
        if (!(prefix in scored) || score > scored[prefix]) {
          scored[prefix] = score;
          bestVoice[prefix] = v.identifier;
        }
      }
    } catch {
      bestVoice = {};
    }
    voicesLoaded = true;
  })();
  return loadingPromise;
}

// Warm the voice list early so the first tap is responsive.
void ensureVoices();

/** Speak `text` in the given BCP-47 language (e.g. "ko-KR", "en-US"). */
export function speak(text: string, language: string): void {
  if (!text) return;
  const prefix = language.split('-')[0].toLowerCase();
  void ensureVoices().then(() => {
    try {
      Speech.stop();
      const voice = bestVoice[prefix];
      Speech.speak(text, { language, rate: 0.85, ...(voice ? { voice } : {}) });
    } catch {
      // TTS unavailable on this platform — ignore.
    }
  });
}

/** Whether a voice for the language is available (false ≈ likely poor quality). */
export async function hasVoiceFor(language: string): Promise<boolean> {
  await ensureVoices();
  return !!bestVoice[language.split('-')[0].toLowerCase()];
}
