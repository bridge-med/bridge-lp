// ================================================================
// showreel sound — 15 秒の音をコードで合成して showreel/sound.wav に書く(依存なし)
// usage: node showreel/sound.mjs [--out showreel/sound.wav]
// 128 BPM・4/4・8 小節 = 15.000 秒。画の切り替えと同じ拍の表(CUES)で鳴らす
// ================================================================
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1]] : null).filter(Boolean));
const OUT = argv.out || path.join(HERE, 'sound.wav');

const SR = 48000, DUR = 15, N = SR * DUR;
const BPM = 128, BEAT = 60 / BPM, BAR = BEAT * 4;
const b = (bar, beat = 0) => (bar - 1) * BAR + beat * BEAT;   // 小節(1 始まり)と拍(0 始まり)→ 秒

/* ---- バス(ステレオ) ---- */
const bus = () => [new Float32Array(N), new Float32Array(N)];
const DRY = bus(), VERB = bus(), DUCKED = bus();   // DUCKED はキックで沈める(サイドチェイン)
const duck = new Float32Array(N).fill(1);

/* 決定的な乱数(毎回同じ音にするため) */
let seed = 1234567;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };

/* ---- 双二次フィルタ(RBJ)。係数は毎サンプル変えてよい ---- */
function biquad() {
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return (x, type, f, q = 0.707) => {
    const w = 2 * Math.PI * Math.min(f, SR * 0.45) / SR, c = Math.cos(w), s = Math.sin(w), a = s / (2 * q);
    let b0, b1, b2, a0 = 1 + a, a1 = -2 * c, a2 = 1 - a;
    if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = (1 - c) / 2; }
    else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = (1 + c) / 2; }
    else { b0 = a; b1 = 0; b2 = -a; } // bp(ピーク 0dB)
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}

function put(target, i, l, r) { if (i >= 0 && i < N) { target[0][i] += l; target[1][i] += r; } }
const panLR = p => [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)];

/* ---- 楽器 ---- */
function kick(t, amp = 1, send = 0.04) {
  const i0 = Math.round(t * SR), len = Math.round(0.42 * SR);
  let ph = 0;
  for (let k = 0; k < len; k++) {
    const tt = k / SR;
    const f = 44 + 120 * Math.exp(-tt * 38);
    ph += 2 * Math.PI * f / SR;
    const env = Math.exp(-tt * 7.5) * Math.min(1, tt * 2000);
    let v = Math.sin(ph) * env;
    v += rnd() * Math.exp(-tt * 380) * 0.25;               // 頭の当たり
    v = Math.tanh(v * 1.6) * amp * 0.8;
    put(DRY, i0 + k, v, v); put(VERB, i0 + k, v * send, v * send);
  }
  for (let k = 0; k < Math.round(0.32 * SR); k++) {          // サイドチェイン
    const i = i0 + k; if (i < N) duck[i] = Math.min(duck[i], 1 - 0.7 * amp * Math.exp(-k / SR * 9));
  }
}
function hat(t, amp = 0.25, open = false, pan = 0.25) {
  const i0 = Math.round(t * SR), len = Math.round((open ? 0.22 : 0.05) * SR), f = biquad(), f2 = biquad();
  const [gl, gr] = panLR(pan);
  for (let k = 0; k < len; k++) {
    const tt = k / SR, env = Math.exp(-tt * (open ? 16 : 70));
    const v = f2(f(rnd(), 'hp', 7500, 0.8), 'bp', 10500, 0.6) * env * amp;
    put(DRY, i0 + k, v * gl, v * gr); put(VERB, i0 + k, v * gl * .15, v * gr * .15);
  }
}
function tick(t, amp = 0.2, freq = 2600, pan = 0) {
  const i0 = Math.round(t * SR), len = Math.round(0.03 * SR), [gl, gr] = panLR(pan);
  for (let k = 0; k < len; k++) {
    const tt = k / SR, v = Math.sin(2 * Math.PI * freq * tt) * Math.exp(-tt * 180) * amp;
    put(DRY, i0 + k, v * gl, v * gr); put(VERB, i0 + k, v * gl * .3, v * gr * .3);
  }
}
/* 風切り: 帯域通過ノイズの中心を掃引し、左右にも流す */
function whoosh(t0, dur, amp = 0.5, f0 = 400, f1 = 5000, p0 = -0.6, p1 = 0.6, peakAt = 0.75) {
  const i0 = Math.round(t0 * SR), len = Math.round(dur * SR), fl = biquad(), fr = biquad();
  for (let k = 0; k < len; k++) {
    const u = k / len;
    const env = u < peakAt ? Math.pow(u / peakAt, 2.2) : Math.pow(1 - (u - peakAt) / (1 - peakAt), 1.6);
    const fc = f0 * Math.pow(f1 / f0, u);
    const [gl, gr] = panLR(p0 + (p1 - p0) * u);
    const l = fl(rnd(), 'bp', fc, 1.4) * env * amp * 2.2, r = fr(rnd(), 'bp', fc * 1.03, 1.4) * env * amp * 2.2;
    put(DRY, i0 + k, l * gl, r * gr); put(VERB, i0 + k, l * gl * .35, r * gr * .35);
  }
}
/* 立ち上がり: ノイズと上昇する鋸波。切り替えの直前で止める */
function riser(t0, dur, amp = 0.35) {
  const i0 = Math.round(t0 * SR), len = Math.round(dur * SR), f = biquad(), g = biquad();
  let ph1 = 0, ph2 = 0;
  for (let k = 0; k < len; k++) {
    const u = k / len, env = Math.pow(u, 2.5) * amp;
    const fq = 110 * Math.pow(4, u);
    ph1 += fq / SR; ph2 += fq * 1.006 / SR;
    const saw = ((ph1 % 1) * 2 - 1 + (ph2 % 1) * 2 - 1) * 0.3;
    const v = g(f(rnd() * 0.6 + saw, 'hp', 300 + 3000 * u, 0.7), 'lp', 1500 + 9000 * u, 0.9) * env;
    put(DRY, i0 + k, v, v); put(VERB, i0 + k, v * .3, v * .3);
  }
}
/* 着地: 低い胴鳴り+ノイズの芯+長い残響 */
function impact(t, amp = 1, send = 0.5) {
  const i0 = Math.round(t * SR), len = Math.round(2.6 * SR), f = biquad();
  let ph = 0;
  for (let k = 0; k < len; k++) {
    const tt = k / SR;
    ph += 2 * Math.PI * (34 + 70 * Math.exp(-tt * 12)) / SR;
    const body = Math.sin(ph) * Math.exp(-tt * 1.6) * Math.min(1, tt * 1500);
    const crack = f(rnd(), 'lp', 2400 * Math.exp(-tt * 6) + 200, 0.7) * Math.exp(-tt * 9) * 0.9;
    const v = Math.tanh((body + crack) * 1.4) * amp * 0.85;
    put(DRY, i0 + k, v, v); put(VERB, i0 + k, v * send, v * send);
  }
  for (let k = 0; k < Math.round(0.6 * SR); k++) { const i = i0 + k; if (i < N) duck[i] = Math.min(duck[i], 1 - 0.8 * Math.exp(-k / SR * 5)); }
}
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
/* 鐘に近いはじく音(FM)。和音の動機に使う */
function pluck(t, midi, amp = 0.18, pan = 0, decay = 3.2, send = 0.45) {
  const i0 = Math.round(t * SR), len = Math.round(Math.min(2.8, 8 / decay) * SR), f = hz(midi), [gl, gr] = panLR(pan);
  for (let k = 0; k < len; k++) {
    const tt = k / SR, env = Math.exp(-tt * decay) * Math.min(1, tt * 800);
    const mod = Math.sin(2 * Math.PI * f * 2 * tt) * 1.4 * Math.exp(-tt * 6);
    const v = (Math.sin(2 * Math.PI * f * tt + mod) + 0.25 * Math.sin(2 * Math.PI * f * 3 * tt) * Math.exp(-tt * 9)) * env * amp;
    put(DRY, i0 + k, v * gl, v * gr); put(VERB, i0 + k, v * gl * send, v * gr * send);
  }
}
/* 持続する和音(鋸波の束を低域通過)。キックで沈む */
function pad(t0, dur, notes, amp = 0.06, cutoff = 1400) {
  const i0 = Math.round(t0 * SR), len = Math.round(dur * SR);
  const vs = notes.flatMap(m => [-7, 0, 7].map(d => ({ f: hz(m) * Math.pow(2, d / 1200), ph: Math.abs(rnd()) })));
  const fl = biquad(), fr = biquad();
  for (let k = 0; k < len; k++) {
    const u = k / len, tt = k / SR;
    const env = Math.min(1, tt / 0.25) * Math.min(1, (len - k) / SR / 0.4);
    let l = 0, r = 0;
    vs.forEach((v, j) => { v.ph += v.f / SR; const s = (v.ph % 1) * 2 - 1; if (j % 2) l += s; else r += s; });
    const fc = cutoff * (0.8 + 0.4 * Math.sin(u * Math.PI));
    l = fl(l, 'lp', fc, 0.9) * env * amp; r = fr(r, 'lp', fc, 0.9) * env * amp;
    put(DUCKED, i0 + k, l, r); put(VERB, i0 + k, l * .25, r * .25);
  }
}
function sub(t0, dur, midi, amp = 0.35) {
  const i0 = Math.round(t0 * SR), len = Math.round(dur * SR), f = hz(midi);
  for (let k = 0; k < len; k++) {
    const tt = k / SR, env = Math.min(1, tt / 0.02) * Math.min(1, (len - k) / SR / 0.05);
    const v = Math.tanh(Math.sin(2 * Math.PI * f * tt) * 1.3) * env * amp;
    put(DUCKED, i0 + k, v, v);
  }
}

/* ---- 残響(Freeverb の簡略版) ---- */
function reverb(inp, room = 0.86, damp = 0.35, wet = 1) {
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], aps = [556, 441, 341, 225];
  const out = bus();
  for (let ch = 0; ch < 2; ch++) {
    const spread = ch ? 23 : 0, x = inp[ch], y = out[ch];
    const cb = combs.map(c => ({ buf: new Float32Array(Math.round((c + spread) * SR / 44100)), i: 0, lp: 0 }));
    const ab = aps.map(c => ({ buf: new Float32Array(Math.round((c + spread) * SR / 44100)), i: 0 }));
    for (let n = 0; n < N; n++) {
      const v = x[n] * 0.015; let s = 0;
      for (const c of cb) { const o = c.buf[c.i]; c.lp = o * (1 - damp) + c.lp * damp; c.buf[c.i] = v + c.lp * room; c.i = (c.i + 1) % c.buf.length; s += o; }
      for (const a of ab) { const o = a.buf[a.i]; a.buf[a.i] = s + o * 0.5; s = o - s; a.i = (a.i + 1) % a.buf.length; }
      y[n] = s * wet;
    }
  }
  return out;
}

/* ================================================================
   譜面(画の拍と合わせる)
   ================================================================ */
function score() {
  // 仮の譜面: ストーリーボード確定後に CUES で置き換える
  for (let bar = 2; bar <= 7; bar++) for (let bt = 0; bt < 4; bt++) kick(b(bar, bt), 0.9);
  for (let bar = 2; bar <= 7; bar++) for (let bt = 0; bt < 4; bt++) hat(b(bar, bt + .5), 0.18);
  impact(b(8), 1);
}
score();

/* ---- ミックス: サイドチェイン → 残響 → 軽いコンプ → 上限 ---- */
const wetBus = reverb(VERB);
const L = new Float32Array(N), R = new Float32Array(N);
for (let n = 0; n < N; n++) {
  L[n] = DRY[0][n] + DUCKED[0][n] * duck[n] + wetBus[0][n];
  R[n] = DRY[1][n] + DUCKED[1][n] * duck[n] + wetBus[1][n];
}
let peak = 0; for (let n = 0; n < N; n++) peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
const g = peak > 0 ? 0.89 / peak : 1;                        // -1 dBFS
for (let n = 0; n < N; n++) {
  const fade = Math.min(1, (N - n) / (SR * 0.05));           // 最後の 50ms を閉じる(プツ音を出さない)
  L[n] = Math.tanh(L[n] * g * 1.1) / Math.tanh(1.1) * fade; R[n] = Math.tanh(R[n] * g * 1.1) / Math.tanh(1.1) * fade;
}

/* ---- WAV(16bit・48kHz・ステレオ) ---- */
const data = Buffer.alloc(N * 4);
for (let n = 0; n < N; n++) {
  data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[n] * 32767))), n * 4);
  data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[n] * 32767))), n * 4 + 2);
}
const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12);
hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(SR, 24);
hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
writeFileSync(OUT, Buffer.concat([hdr, data]));
console.log('wrote', OUT, `peak gain ${g.toFixed(2)}`);
