// CHRONOS — the single source of truth for timing (seconds) and world dimensions
import { E, sat } from './util.js';
export const DURATION = 30;

export const BEATS = {
  gearAppear: 0.35, gearEngage: 0.95, pullback: 1.55,
  text1In: 2.4, text1Out: 3.48,
  awaken: 4.0, text2: 8.2,
  complexity: 9.0, unfold: 9.1, loops: 11.0, data: 12.6, wrap: 14.2,
  heart: 15.2, accelerate: 17.2, align: 18.7, aligned: 19.05, release: 19.8, waveCut: 20.3,
  transform: 21.0, descend: 21.3, indices: 23.6, sphereDown: 24.0, hands: 24.4, tiers: 25.5, lock: 26.6,
  chronos: 27.0, tick: 27.6, pulseOrange: 27.75, titleIn: 28.0, tagIn: 29.0,
};

export const R = {
  hub: 50, glassOut: 118, outer: 296, bezelIn: 300, bezelOut: 322,
  underY: 40, gearY: 24, g0Angle: 3.6, g0Radius: 80,
  sphereY: 95, sphereR: 46, trackR: 190, trackY: 40,
  heroR: 150, heroAngle: 0,
  s2Th0: 3.6 + 0.95, s2Th1: 3.6 + 0.95 + 1.8,
};

// the energy wave released by the core: radius, width, intensity on the city plane
export function waveState(t) {
  const t0 = BEATS.release + 0.12;
  if (t < t0) return { r: -1000, w: 30, i: 0 };
  const u = t - t0;
  return { r: 46 + 360 * E.outQuad(sat(u / 1.75)), w: 26 + 22 * sat(u / 1.75), i: 1 - sat((u - 0.3) / 1.9) };
}
