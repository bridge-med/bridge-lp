// CHRONOS — shared math, easing, deterministic randomness
import * as THREE from 'three';

export const TAU = Math.PI * 2;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
export const sat = (x) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a, b, t) => a + (b - a) * t;
export const remap = (x, a, b, c, d) => c + (d - c) * sat((x - a) / (b - a));
export const smoothstep = (e0, e1, x) => { const t = sat((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
export const smootherstep = (e0, e1, x) => { const t = sat((x - e0) / (e1 - e0)); return t * t * t * (t * (t * 6 - 15) + 10); };

// ---- easing (all map [0,1] -> [0,1]) ----
export const E = {
  linear: (t) => t,
  inQuad: (t) => t * t,
  outQuad: (t) => 1 - (1 - t) * (1 - t),
  inOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2),
  inCubic: (t) => t * t * t,
  outCubic: (t) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inQuart: (t) => t * t * t * t,
  outQuart: (t) => 1 - Math.pow(1 - t, 4),
  inOutQuart: (t) => (t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2),
  inQuint: (t) => t * t * t * t * t,
  outQuint: (t) => 1 - Math.pow(1 - t, 5),
  inOutQuint: (t) => (t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2),
  inExpo: (t) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inOutExpo: (t) => (t === 0 ? 0 : t === 1 ? 1 : t < 0.5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  inSine: (t) => 1 - Math.cos((t * Math.PI) / 2),
  outSine: (t) => Math.sin((t * Math.PI) / 2),
  inOutSine: (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  outBack: (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2),
  inBack: (t, s = 1.70158) => (s + 1) * t * t * t - s * t * t,
  inOutBack: (t, s = 1.70158 * 1.525) => (t < 0.5
    ? (Math.pow(2 * t, 2) * ((s + 1) * 2 * t - s)) / 2
    : (Math.pow(2 * t - 2, 2) * ((s + 1) * (t * 2 - 2) + s) + 2) / 2),
  outElastic: (t) => (t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (TAU / 3)) + 1),
  // mechanical snap: fast approach with a tiny overshoot settle
  snap: (t) => { if (t <= 0) return 0; if (t >= 1) return 1; const k = 1 - Math.pow(1 - t, 6); const o = Math.sin(t * Math.PI * 3) * Math.pow(1 - t, 3) * 0.12; return k + o; },
};

// progress of t inside [t0,t1], eased, clamped
export function span(t, t0, t1, ease = E.linear) {
  if (t1 <= t0) return t >= t1 ? 1 : 0;
  return ease(sat((t - t0) / (t1 - t0)));
}

// envelope: rises over `attack`, then decays exponentially with `decay` time constant
export function pulse(t, t0, attack = 0.05, decay = 0.5) {
  if (t < t0) return 0;
  const u = t - t0;
  if (u < attack) return u / attack;
  return Math.exp(-(u - attack) / decay);
}

// a bump between t0 and t1 (0 outside), with soft edges
export function bump(t, t0, t1, edge = 0.1) {
  return smoothstep(t0, t0 + edge, t) * (1 - smoothstep(t1 - edge, t1, t));
}

export function hash1(n) {
  let x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export function polar(r, a, y = 0, out = new THREE.Vector3()) {
  return out.set(Math.cos(a) * r, y, Math.sin(a) * r);
}

export function catmullRom(p0, p1, p2, p3, t, out = new THREE.Vector3()) {
  const t2 = t * t, t3 = t2 * t;
  const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return out.set(f(p0.x, p1.x, p2.x, p3.x), f(p0.y, p1.y, p2.y, p3.y), f(p0.z, p1.z, p2.z, p3.z));
}

// angle utilities
export const deg = (d) => (d * Math.PI) / 180;
export function wrapAngle(a) { a = a % TAU; if (a < 0) a += TAU; return a; }
export function angleDiff(a, b) { let d = wrapAngle(b - a); if (d > Math.PI) d -= TAU; return d; }

export const _v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
export const _q = [new THREE.Quaternion(), new THREE.Quaternion(), new THREE.Quaternion()];
export const _m = [new THREE.Matrix4(), new THREE.Matrix4()];
export const _e = new THREE.Euler();
export const _c = new THREE.Color();
