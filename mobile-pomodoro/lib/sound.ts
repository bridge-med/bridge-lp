// Timer chimes. A small set of built-in tones (synthesized WAVs bundled in
// assets/sounds). Played in-app via expo-audio when an interval ends — works on
// native and web. Players are created lazily and cached.

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';

// Static requires so Metro bundles the assets (and resolves them under a
// subpath web deploy).
const SOURCES = {
  bell: require('../assets/sounds/bell.wav'),
  chime: require('../assets/sounds/chime.wav'),
  marimba: require('../assets/sounds/marimba.wav'),
  digital: require('../assets/sounds/digital.wav'),
  soft: require('../assets/sounds/soft.wav'),
} as const;

export type SoundName = keyof typeof SOURCES;

export const SOUND_OPTIONS: { key: SoundName; label: string }[] = [
  { key: 'bell', label: 'ベル' },
  { key: 'chime', label: 'チャイム' },
  { key: 'marimba', label: 'マリンバ' },
  { key: 'soft', label: 'やわらか' },
  { key: 'digital', label: 'デジタル' },
];

let audioModeSet = false;
const players: Partial<Record<SoundName, AudioPlayer>> = {};

function getPlayer(name: SoundName): AudioPlayer | null {
  try {
    if (!audioModeSet) {
      // Don't get silenced by the iOS ring/silent switch for an intentional alert.
      void setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
      audioModeSet = true;
    }
    players[name] ??= createAudioPlayer(SOURCES[name]);
    return players[name] ?? null;
  } catch {
    return null;
  }
}

/** Play a chime from the start. Safe no-op if audio is unavailable. */
export function playSound(name: SoundName): void {
  const p = getPlayer(name);
  if (!p) return;
  try {
    p.seekTo(0);
    p.play();
  } catch {
    // ignore playback errors
  }
}
