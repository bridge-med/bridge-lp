// ================================================================
// showreel sound — 15 秒の音をコードで合成して showreel/sound.wav に書く(依存なし)
// usage: node showreel/sound.mjs [--out showreel/sound.wav]
// 128 BPM・4/4・8 小節 = 15.000 秒。譜面はストーリーボード §5(5.1 地の拍・5.2 キュー表)
// どの音も画と同じ格子の正確な時刻に置く(サンプル位置 = round(t × 48000))
// v2(改訂仕様 2026-09-26): 数えるための音(リールのクリック・無音・「29」の着地・櫛・116 の当たり)は置かない。地の拍は切らずに続く
// 仕上げ: 残響 → 低域モノ → -14 LUFS・真のピーク -1 dBTP 未満(天井に触れるのは最後の着地だけ)→ 最後の 50 ms を閉じる
// ================================================================
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1]] : null).filter(Boolean));
const OUT = argv.out || path.join(HERE, 'sound.wav');

const SR = 48000, DUR = 15, N = SR * DUR;
const BPM = 128, BEAT = 60 / BPM, BAR = BEAT * 4;
const G = (bar, beat = 0) => (bar - 1) * BAR + beat * BEAT;   // 画と同じ式(小節は 1 始まり、拍は 0 始まり)
const at = t => Math.round(t * SR);                           // 秒 → サンプル位置
const ms = x => Math.max(1, Math.round(x * SR / 1000));       // ミリ秒 → サンプル数
const hz = m => 440 * Math.pow(2, (m - 69) / 12);
const dB = x => Math.pow(10, x / 20);
const TAU = 2 * Math.PI;

const TARGET_LUFS = -14, TP_MAX = -1.1;                       // 積分ラウドネスと真のピークの上限(dBTP)
const BED_ROOM = 1;                                           // 13.125 より前の天井を何 dB 下げるか(最後の着地だけが天井に触れる)
const PUSH = 2;                                               // 最後の着地をほかより持ち上げる量(dB)。頭の山はマスターのリミッタが受ける

/* ---- バス(ステレオ) ---- */
const bus = () => [new Float32Array(N), new Float32Array(N)];
const DRY = bus(), DUCKED = bus(), ROOM = bus(), HALL = bus();   // DUCKED はキックと着地で沈める(サイドチェイン)
const duck = new Float32Array(N).fill(1);

function put(target, i, l, r) {
  if (i < 0 || i >= N) return;
  target[0][i] += l; target[1][i] += r;
}

/* 決定的な乱数(毎回同じ音にするため) */
const mkRnd = s => () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 * 2 - 1; };
const rnd = mkRnd(1234567);

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

const panLR = p => [Math.cos((p + 1) * Math.PI / 4), Math.sin((p + 1) * Math.PI / 4)];
const edge = (k, len, a, r) => Math.max(0, Math.min(1, k / a, (len - 1 - k) / r));   // 頭と尻の短い傾斜(プツ音を出さない)
const blep = (p, dt) => p < dt ? (p /= dt, p + p - p * p - 1) : p > 1 - dt ? (p = (p - 1) / dt, p * p + p + p + 1) : 0;
const expoInOut = u => u <= 0 ? 0 : u >= 1 ? 1 : u < 0.5 ? Math.pow(2, 20 * u - 10) / 2 : (2 - Math.pow(2, -20 * u + 10)) / 2;

/* 楽器は小さな作業用バッファに描き、ピークを 1 にそろえてから強さ amp で置く(キュー表の「強さ」= ピーク。着地だけは例外、譜面に注記) */
const scratch = len => [new Float32Array(len), new Float32Array(len)];
function norm(b) {
  let p = 0; for (const c of b) for (let k = 0; k < c.length; k++) p = Math.max(p, Math.abs(c[k]));
  if (p) for (const c of b) for (let k = 0; k < c.length; k++) c[k] /= p;
  return b;
}
function mixInto(dst, src, w) { for (let ch = 0; ch < 2; ch++) for (let k = 0; k < dst[ch].length; k++) dst[ch][k] += src[ch][k] * w; }
function emit(i0, b, amp, { bus = DRY, room = 0, hall = 0 } = {}) {
  norm(b);
  for (let k = 0; k < b[0].length; k++) {
    const l = b[0][k] * amp, r = b[1][k] * amp;
    put(bus, i0 + k, l, r);
    if (room) put(ROOM, i0 + k, l * room, r * room);
    if (hall) put(HALL, i0 + k, l * hall, r * hall);
  }
}
/* サイドチェイン: 打つ 4 ms 前から沈め(頭の山にサブを重ねない)、rel(1/s)で戻る */
function sidechain(i0, depth, rel) {
  const att = ms(4), len = Math.round(6 / rel * SR);
  for (let k = -att; k < len; k++) {
    const i = i0 + k; if (i < 0 || i >= N) continue;
    const g = 1 - depth * (k < 0 ? 1 + k / att : Math.exp(-k / SR * rel));
    if (g < duck[i]) duck[i] = g;
  }
}

/* ================================================================
   音色(作業用バッファを返す。ピークはあとでそろえる)
   ================================================================ */
/* キックの胴: 尾は 44 Hz、頭はごく短いノイズ */
function kickWave(len) {
  const b = scratch(len), hp = biquad();
  let ph = 0;
  for (let k = 0; k < len; k++) {
    const tt = k / SR;
    ph += TAU * (44 + 100 * Math.exp(-tt * 30) + 70 * Math.exp(-tt * 260)) / SR;
    let v = Math.sin(ph) * Math.exp(-tt * 9) + hp(rnd(), 'hp', 2200, 0.7) * Math.exp(-tt * 900) * 0.3;
    b[0][k] = b[1][k] = Math.tanh(v * 1.1) * edge(k, len, ms(0.3), ms(30));
  }
  return b;
}
/* 低い胴鳴り(サイン、音程は上から落ちる)。dur で −40 dB まで下がる */
function boomWave(len, midi, dur, drive = 1.5, soft = 1) {   // soft: 立ち上がり(ms)。キックと重ねるときは長くして山を積まない
  const b = scratch(len), f0 = hz(midi), dec = Math.log(100) / dur;
  let ph = 0;
  for (let k = 0; k < len; k++) {
    const tt = k / SR, e = Math.exp(-tt * dec), d = 1 + (drive - 1) * e;   // 頭ほど強く歪ませる(3 倍音 = A、5 倍音 = F♯ が小さな再生機でも聞こえる)
    ph += TAU * f0 * (1 + 2 * Math.exp(-tt * 28)) / SR;
    b[0][k] = b[1][k] = Math.tanh(d * Math.sin(ph)) / Math.tanh(d) * e * Math.sin(Math.PI / 2 * edge(k, len, ms(soft), ms(20)));
  }
  return b;
}
/* 割れる音: 左右で別のノイズ、低域通過の中心が 9 kHz から落ちる */
function crackWave(len, body = 8, bodyW = 0.55) {   // 頭(90/s で消える)と胴(body/s)
  const b = scratch(len), fl = biquad(), fr = biquad(), hl = biquad(), hr = biquad();
  for (let k = 0; k < len; k++) {
    const tt = k / SR, fc = 700 + 8500 * Math.exp(-tt * 9);
    const e = (bodyW * Math.exp(-tt * body) + 0.8 * Math.exp(-tt * 90)) * edge(k, len, ms(0.2), ms(20));
    b[0][k] = hl(fl(rnd(), 'lp', fc, 0.8), 'hp', 180) * e;
    b[1][k] = hr(fr(rnd(), 'lp', fc, 0.8), 'hp', 180) * e;
  }
  return b;
}
/* 金属の明るい当たり: D の倍音列に少しだけ外れた部分音を混ぜる */
function metalWave(len) {
  const b = scratch(len), hp = biquad();
  const parts = [[2349.3, 1, 22, -0.3], [3520, 0.75, 28, 0.3], [4104, 0.5, 34, -0.15], [5274, 0.45, 40, 0.2], [6853, 0.3, 55, 0]];
  const gp = parts.map(([, , , p]) => panLR(p));
  for (let k = 0; k < len; k++) {
    const tt = k / SR, e0 = edge(k, len, ms(0.2), ms(20));
    let l = 0, r = 0;
    parts.forEach(([f, w, d], j) => { const v = Math.sin(TAU * f * tt) * w * Math.exp(-tt * d); l += v * gp[j][0]; r += v * gp[j][1]; });
    const c = hp(rnd(), 'hp', 4000, 0.7) * Math.exp(-tt * 1500) * 1.2;
    b[0][k] = (l + c) * e0; b[1][k] = (r + c) * e0;
  }
  return b;
}
/* 乾いたカチ: 高域のノイズを 1 ms ほど */
function clickWave(len, hpF = 3200) {
  const b = scratch(len), hp = biquad();
  for (let k = 0; k < len; k++) {
    const v = hp(rnd(), 'hp', hpF, 0.7) * Math.exp(-k / SR * 1500) * edge(k, len, ms(0.15), ms(3));
    b[0][k] = b[1][k] = v;
  }
  return b;
}

/* ================================================================
   楽器(時刻・強さ・定位を受け取り、バスに置く)
   ================================================================ */
function kick(t, amp = 0.85) {
  const i0 = at(t);
  emit(i0, kickWave(at(0.46)), amp, { room: 0.02 });
  sidechain(i0, 0.62 * amp / 0.85, 8);
}
function hat(t, amp, pan = 0.2, dec = 55) {
  const len = at(0.12), b = scratch(len), f1 = biquad(), f2 = biquad(), [gl, gr] = panLR(pan);
  for (let k = 0; k < len; k++) {
    const v = (f1(rnd(), 'hp', 7200, 0.7) * 0.7 + f2(rnd(), 'bp', 10500, 0.9) * 0.5) * Math.exp(-k / SR * dec) * edge(k, len, ms(0.2), ms(4));
    b[0][k] = v * gl; b[1][k] = v * gr;
  }
  emit(at(t), b, amp, { room: 0.1 });
}
/* ティック: 短いサイン。f1 を与えると 20 ms で音程が動く(下がる/上がる) */
function tick(t, amp, f0, pan = 0, { f1 = f0, dur = 0.04, dec = 150, room = 0.2 } = {}) {
  const len = at(dur), b = scratch(len), [gl, gr] = panLR(pan);
  let ph = 0;
  for (let k = 0; k < len; k++) {
    const tt = k / SR;
    ph += TAU * f0 * Math.pow(f1 / f0, Math.min(1, tt / 0.02)) / SR;
    const v = Math.sin(ph) * Math.exp(-tt * dec) * edge(k, len, ms(0.2), ms(5));
    b[0][k] = v * gl; b[1][k] = v * gr;
  }
  emit(at(t), b, amp, { room });
}
/* クリック: 乾いたカチ + f を与えれば音程のある短い響き */
function click(t, amp, { f = 0, pan = 0, room = 0.12, hall = 0, tone = 0.65, dec = 60, len = 0.12, hpF = 3200 } = {}) {
  const n = at(f ? len : 0.02), b = clickWave(n, hpF), [gl, gr] = panLR(pan);
  for (let k = 0; k < n; k++) {
    const tt = k / SR;
    const ton = f ? (Math.sin(TAU * f * tt) + 0.25 * Math.sin(2 * TAU * f * tt) * Math.exp(-tt * 80)) * Math.exp(-tt * dec) * edge(k, n, ms(0.3), ms(5)) : 0;
    const v = b[0][k] * 1.8 * (f ? 1 - tone : 1) + ton * tone;
    b[0][k] = v * gl; b[1][k] = v * gr;
  }
  emit(at(t), b, amp, { room, hall });
}
/* マレット: 基音 + 4 倍付近の部分音(速く消える)。t60 で −60 dB */
function mallet(t, midi, amp, t60 = 0.9, pan = 0, { room = 0.3, hall = 0.2 } = {}) {
  const f = hz(midi), dec = Math.log(1000) / t60, len = at(t60 + 0.05), b = scratch(len), bp = biquad(), [gl, gr] = panLR(pan);
  for (let k = 0; k < len; k++) {
    const tt = k / SR, ed = edge(k, len, ms(1.5), ms(20)), e = Math.exp(-tt * dec) * ed;
    let v = Math.sin(TAU * f * tt) + 0.22 * Math.sin(TAU * f * 3.98 * tt) * Math.exp(-tt * dec * 2.2) + 0.05 * Math.sin(TAU * f * 9.1 * tt) * Math.exp(-tt * dec * 5);
    v = v * e + bp(rnd(), 'bp', f * 2, 1.5) * Math.exp(-tt * 400) * 0.25 * ed;   // 打った瞬間のノイズ
    b[0][k] = v * gl; b[1][k] = v * gr;
  }
  emit(at(t), b, amp, { room, hall });
}
/* FM の鐘(余韻): 1:1 の暖かい変調 + 1:3.5 の金属の当たり。t60 で −60 dB */
function bells(t, notes, amp, t60, { room = 0.15, hall = 0.45 } = {}) {
  const i0 = at(t), dec = Math.log(1000) / t60, len = Math.min(N - i0, at(t60 + 0.05)), b = scratch(len);
  notes.forEach(([midi, w, pan]) => {
    const f = hz(midi), [gl, gr] = panLR(pan);
    for (let k = 0; k < len; k++) {
      const tt = k / SR, p = TAU * f * tt;
      const v = Math.sin(p + 0.9 * Math.exp(-tt * 2.5) * Math.sin(p) + 1.1 * Math.exp(-tt * 14) * Math.sin(3.5 * p)) * Math.exp(-tt * dec) * edge(k, len, ms(2), ms(30)) * w;
      b[0][k] += v * gl; b[1][k] += v * gr;
    }
  });
  emit(i0, b, amp, { room, hall });
}
/* 頭で重なった山だけを、ゲインで(歪ませずに)胴のピーク × ratio まで押さえる。胴 = 30 ms より後 */
function tame(b, ratio, from = ms(30)) {
  const len = b[0].length, W = ms(1.5);
  let body = 0; for (const c of b) for (let k = from; k < len; k++) body = Math.max(body, Math.abs(c[k]));
  const lim = body * ratio, need = new Float32Array(len), m = new Float32Array(len);
  for (let k = 0; k < len; k++) { const p = Math.max(Math.abs(b[0][k]), Math.abs(b[1][k])); need[k] = p > lim ? lim / p : 1; }
  for (let k = 0; k < len; k++) { let v = 1; for (let j = Math.max(0, k - W); j <= Math.min(len - 1, k + W); j++) v = Math.min(v, need[j]); m[k] = v; }
  for (let k = 0; k < len; k++) {
    let a = 0, c = 0; for (let j = Math.max(0, k - W); j <= Math.min(len - 1, k + W); j++) { a += m[j]; c++; }
    b[0][k] *= a / c; b[1][k] *= a / c;                        // 平均は必ず need[k] 以下
  }
  return b;
}
/* 着地: 部品 [音色, 重み(負なら逆相)] を足し、頭の山を tame で押さえてから、全体を強さ amp にそろえる */
function impact(t, amp, parts, { dur = 1, room = 0.1, hall = 0.3, duckDepth = 0.8, ratio = 0 } = {}) {
  const i0 = at(t), len = Math.min(N - i0, at(dur)), b = scratch(len);
  for (const [wave, w] of parts) mixInto(b, norm(wave(len)), w);
  if (ratio) tame(b, ratio);
  emit(i0, b, amp, { room, hall });
  sidechain(i0, duckDepth, 5);
}
/* 風切り: 帯域通過ノイズの中心を掃引し、左右にも流す(上げ: f0 < f1、下げ: f0 > f1) */
function whoosh(t0, dur, amp, f0, f1, p0 = 0, p1 = 0, peakAt = 0.5, { q = 1.1, room = 0.25 } = {}) {
  const i0 = at(t0), len = at(t0 + dur) - i0, b = scratch(len);
  const fl = biquad(), fr = biquad(), gl2 = biquad(), gr2 = biquad();
  for (let k = 0; k < len; k++) {
    const u = k / len;
    let e = u < peakAt ? u / peakAt : (1 - u) / (1 - peakAt);
    e = e * e * (3 - 2 * e) * edge(k, len, ms(1), ms(2));
    const fc = f0 * Math.pow(f1 / f0, u), comp = Math.pow(1500 / fc, 0.3);
    const [gl, gr] = panLR(p0 + (p1 - p0) * u);
    b[0][k] = gl2(fl(rnd(), 'bp', fc, q), 'lp', fc * 2.5, 0.7) * e * comp * gl;
    b[1][k] = gr2(fr(rnd(), 'bp', fc * 1.03, q), 'lp', fc * 2.5, 0.7) * e * comp * gr;
  }
  emit(i0, b, amp, { room });
}
/* 立ち上がり: 帯が上がるノイズ(+ tone があれば、その和音ののこぎり波をフィルタで開ける)。t1 のサンプルちょうどで終わる */
function riser(t0, t1, amp, { lo = 500, hi = 8000, tone = [], toneW = 0.35, shape = 2.2, room = 0.25, hall = 0 } = {}) {
  const i0 = at(t0), len = at(t1) - i0, b = scratch(len);
  const fl = biquad(), fr = biquad(), hl = biquad(), hr = biquad(), tl = biquad(), tr = biquad();
  const vs = tone.flatMap(m => [-5, 5].map(d => ({ f: hz(m) * Math.pow(2, d / 1200), ph: Math.abs(rnd()) })));
  for (let k = 0; k < len; k++) {
    const u = k / len, e = Math.pow(u, shape) * edge(k, len, 1, ms(0.8)), fc = lo * Math.pow(hi / lo, u);
    let l = hl(fl(rnd(), 'bp', fc, 0.8), 'hp', 200), r = hr(fr(rnd(), 'bp', fc * 1.02, 0.8), 'hp', 200);
    if (vs.length) {
      let sl = 0, sr = 0;
      vs.forEach((v, j) => { const dt = v.f / SR; v.ph = (v.ph + dt) % 1; const s = 2 * v.ph - 1 - blep(v.ph, dt); if (j % 2) sl += s; else sr += s; });
      const tc = 200 + 3500 * u * u;
      l += tl(sl, 'lp', tc, 0.8) * toneW / vs.length * 2; r += tr(sr, 'lp', tc, 0.8) * toneW / vs.length * 2;
    }
    b[0][k] = l * e; b[1][k] = r * e;
  }
  emit(i0, b, amp, { room, hall });
}
/* 逆回しの膨らみ: 短い鐘の和音を長い残響に通し、逆再生して t1 で終わるように置く */
function swell(t0, t1, amp, notes, { pan = 0, room = 0.1 } = {}) {
  const i0 = at(t0), len = at(t1) - i0, src = scratch(len);
  for (let k = 0; k < Math.min(len, at(0.4)); k++) {
    const tt = k / SR;
    let v = 0; for (const m of notes) v += Math.sin(TAU * hz(m) * tt);
    src[0][k] = src[1][k] = v * Math.exp(-tt * 9) * edge(k, len, ms(1), 1);
  }
  const wet = reverb(src, { room: 0.9, damp: 0.3, size: 1.3, hp: 250 });
  const b = scratch(len), [gl, gr] = panLR(pan);
  for (let k = 0; k < len; k++) {
    const j = len - 1 - k, u = k / len, e = u * u * edge(k, len, 1, ms(1.5));
    b[0][k] = (src[0][j] * 0.4 + wet[0][j] * 30) * e * gl * 1.41;
    b[1][k] = (src[1][j] * 0.4 + wet[1][j] * 30) * e * gr * 1.41;
  }
  emit(i0, b, amp, { room });
}
/* 空気: 高域のノイズがふくらんで(cubicOut)、ゆっくり引く */
function air(t0, dur, amp, { rise = 0.45, lo = 2200, hi = 9000, room = 0, hall = 0.35, decay = 3.5 } = {}) {
  const i0 = at(t0), len = at(t0 + dur) - i0, R = at(rise), b = scratch(len);
  const hl = biquad(), hr = biquad(), ll = biquad(), lr = biquad();
  for (let k = 0; k < len; k++) {
    const u = Math.min(1, k / R), e = (k < R ? 1 - Math.pow(1 - u, 3) : Math.exp(-(k - R) / SR * decay)) * edge(k, len, 1, ms(40));
    b[0][k] = ll(hl(rnd(), 'hp', lo, 0.7), 'lp', hi, 0.7) * e;
    b[1][k] = lr(hr(rnd(), 'hp', lo, 0.7), 'lp', hi, 0.7) * e;
  }
  emit(i0, b, amp, { room, hall });
}
/* 音程の曲がり: t0→t1 で m0 → m1(expoInOut・画の曲がりと同じ)、t2 まで保って rel で消える */
function glide(t0, t1, t2, m0, m1, amp, { rel = 0.3, hall = 0.3 } = {}) {
  const i0 = at(t0), len = at(t2 + rel) - i0, b = scratch(len), A = ms(40), R = at(rel), hold = at(t2) - i0;
  let ph = 0;
  for (let k = 0; k < len; k++) {
    const u = (k / SR) / (t1 - t0), f = hz(m0 + (m1 - m0) * expoInOut(u));
    ph = (ph + TAU * f / SR) % TAU;
    const e = Math.sin(Math.PI / 2 * Math.min(1, k / A)) * (k < hold ? 1 : 0.5 + 0.5 * Math.cos(Math.PI * Math.min(1, (k - hold) / R)));
    b[0][k] = b[1][k] = (Math.sin(ph) + 0.12 * Math.sin(2 * ph)) * e;
  }
  emit(i0, b, amp, { hall });
}
/* 持続する和音(のこぎり波の束を 4 極の低域通過)。キックと着地で沈む */
function pad(t0, t1, notes, amp, cutoff, { att = 0.25, rel = 0.4, room = 0.25, hall = 0 } = {}) {
  const i0 = at(t0), len = Math.min(N - i0, at(t1) - i0), b = scratch(len), A = at(att), R = at(rel);
  const vs = notes.flatMap(m => [-7, 0, 7].map(d => ({ f: hz(m) * Math.pow(2, d / 1200), ph: Math.abs(rnd()) })));
  const l1 = biquad(), l2 = biquad(), r1 = biquad(), r2 = biquad();
  for (let k = 0; k < len; k++) {
    const u = k / len, e = Math.sin(Math.PI / 2 * Math.max(0, Math.min(1, k / A, (len - 1 - k) / R)));
    let l = 0, r = 0;
    vs.forEach((v, j) => { const dt = v.f / SR; v.ph = (v.ph + dt) % 1; const s = 2 * v.ph - 1 - blep(v.ph, dt); if (j % 2) l += s; else r += s; });
    const fc = cutoff * (0.85 + 0.3 * Math.sin(u * Math.PI));
    b[0][k] = l2(l1(l, 'lp', fc, 0.6), 'lp', fc, 0.6) * e * e;
    b[1][k] = r2(r1(r, 'lp', fc, 0.6), 'lp', fc, 0.6) * e * e;
  }
  emit(i0, b, amp, { bus: DUCKED, room, hall });
}
/* サブの持続音(モノ): 区間 [t0, t1, MIDI]。つながった区間は 15 ms で音程を移し、切れ目は 20 ms で閉じる */
function subLine(segs, amp) {
  const tf = new Float64Array(N);
  for (const [t0, t1, m] of segs) tf.fill(hz(m), at(t0), Math.min(N, at(t1)));
  const kf = 1 - Math.exp(-1 / ms(15)), step = 1 / ms(20);
  let ph = 0, f = 0, g = 0;
  for (let n = 0; n < N; n++) {
    if (tf[n]) f = f ? f + (tf[n] - f) * kf : tf[n];
    g = tf[n] ? Math.min(1, g + step) : Math.max(0, g - step);
    if (!g) { f = 0; ph = 0; continue; }
    ph = (ph + TAU * f / SR) % TAU;
    const v = Math.tanh(1.4 * Math.sin(ph)) / Math.tanh(1.4) * amp * Math.sin(Math.PI / 2 * g);
    DUCKED[0][n] += v; DUCKED[1][n] += v;
  }
}

/* ---- 残響(Freeverb の簡略版) ---- */
function reverb(inp, { room = 0.84, damp = 0.3, size = 1, pre = 0, hp = 200 } = {}) {
  const len = inp[0].length, out = [new Float32Array(len), new Float32Array(len)];
  const combs = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617], aps = [556, 441, 341, 225];
  for (let ch = 0; ch < 2; ch++) {
    const spread = ch ? 23 : 0, x = inp[ch], y = out[ch];
    const f = biquad();
    const cb = combs.map(c => ({ buf: new Float32Array(Math.round((c + spread) * size * SR / 44100)), i: 0, lp: 0 }));
    const ab = aps.map(c => ({ buf: new Float32Array(Math.round((c + spread) * SR / 44100)), i: 0 }));
    for (let n = 0; n < len; n++) {
      const j = n - pre, xin = j >= 0 ? x[j] : 0;
      const v = f(xin, 'hp', hp, 0.7) * 0.015; let s = 0;
      for (const c of cb) { const o = c.buf[c.i]; c.lp = o * (1 - damp) + c.lp * damp; c.buf[c.i] = v + c.lp * room; c.i = (c.i + 1) % c.buf.length; s += o; }
      for (const a of ab) { const o = a.buf[a.i]; a.buf[a.i] = s + o * 0.5; s = o - s; a.i = (a.i + 1) % a.buf.length; }
      y[n] = s;
    }
  }
  return out;
}

/* ================================================================
   譜面(ストーリーボード §5。時刻はすべて G(小節, 拍) の正確な値)
   ================================================================ */
const D1 = 26, BB1 = 34, C2 = 36, D2 = 38;
function score() {
  /* ===== 5.1 地の拍 ===== */
  // 小節 1: D2+A2 の持続音(LP 500 Hz)が 0 → 0.04。2 小節の頭のキックの下で引く
  pad(0, G(2) + 0.25, [38, 45], 0.04, 500, { att: 1.6, rel: 0.25, room: 0.2 });
  // キック(0.85): 2–6 小節は切らずに 4 つ打ち(8.906 にもキック)。10.781 が地の最後のキック
  const kicks = [];
  for (let bar = 2; bar <= 6; bar++) for (let bt = 0; bt < 4; bt++) kicks.push(G(bar, bt));
  kicks.forEach(t => kick(t, 0.85));
  // ハイハット: 裏の 8 分(0.10)。3 小節は 4.688 から裏以外の 16 分にゴースト(0.05)。5 小節は 16 分(0.12)を 8.438 まで
  for (const bar of [2, 3, 4]) for (let bt = 0; bt < 4; bt++) hat(G(bar, bt + 0.5), 0.10, 0.2);
  for (let bt = 2; bt < 4; bt++) for (const q of [0, 0.25, 0.75]) hat(G(3, bt + q), 0.05, -0.15, 90);
  for (let s = 0; s < 8; s++) hat(G(5, s / 4), 0.12 * [0.7, 0.8, 1, 0.8][s % 4], s % 2 ? -0.15 : 0.15, 70);
  for (let s = 0; s < 3; s++) hat(G(6, s + 0.5), 0.10, 0.2);
  // サブ(D → D → B♭ → C → D → B♭ → C)。5 小節の C は 9.375 まで切らない。8 小節は着地が低域を持つ
  subLine([[G(2), G(4), D2], [G(4), G(5), BB1], [G(5), G(6), C2], [G(6), G(7), D2], [G(7), G(7, 2), BB1], [G(7, 2), G(8), C2]], 0.2);
  // 小節 7: B♭maj9 → Csus2(LP 900 Hz・0.08)。小節 8: Dadd9(D3 A3 E4・0.06)が 14.95 までに消える
  pad(G(7), G(7, 2) + 0.08, [46, 53, 57, 60, 62], 0.08, 900, { att: 0.35, rel: 0.16, room: 0.2, hall: 0.25 });
  pad(G(7, 2) - 0.08, G(8) + 0.15, [48, 55, 60, 62], 0.08, 900, { att: 0.16, rel: 0.15, room: 0.2, hall: 0.25 });
  pad(G(8), 14.95, [50, 57, 64], 0.06, 1100, { att: 0.4, rel: 1.15, room: 0.1, hall: 0.3 });

  /* ===== 5.2 キュー表 ===== */
  const scr = x => 0.6 * (x - 960) / 960;                     // 画面の x → 定位(控えめ)
  // --- 小節 1 · WHO
  impact(0, 0.60, [[len => boomWave(len, D1, 0.35), 1]], { dur: 0.37, room: 0, hall: 0, duckDepth: 0 });   // 最初の点: サブの一打 D1
  click(0, 0.45, { room: 0 });                                                                            // 乾いたクリック
  whoosh(G(1, 0.5), 0.55 - G(1, 0.5), 0.25, 800, 5000, 0, 0.6, 0.7);       // ペン先が走る(中央 → 右)
  tick(G(1, 1), 0.18, 2400, scr(1385));                                     // 療の下(2 拍目)
  click(G(1, 1.5), 0.25, { pan: scr(600) });                                // 名前が落ちる
  tick(G(1, 2.5), 0.10, 1800, scr(1470));                                   // ペンがまた動き出す
  whoosh(G(1, 3), BEAT, 0.45, 300, 6000, 0.6, -0.6, 0.5);                  // カメラのウィップ(右 → 左、山は 1.641)
  // --- 小節 2 · FOUR FIELDS(駅 01–03 は D5 F5 A5、04 NOW は砂色の点に D6 のマレット)
  [[G(2), 74, 200], [G(2, 1), 77, 616], [G(2, 2), 81, 1032]].forEach(([t, m, x]) => click(t, 0.30, { f: hz(m), pan: scr(x), room: 0.25 }));
  mallet(G(2, 3), 86, 0.35, 0.9, scr(1448));
  swell(G(2, 3.5), G(3), 0.20, [86, 81]);                                  // 押し込みへ
  // --- 小節 3 · THE FORK
  whoosh(G(3), BEAT, 0.40, 300, 4000, 0.3, -0.1, 0.5);                     // 押し込み(山は 3.984)
  tick(G(3), 0.12, 520, 0, { f1: 380, dur: 0.08, dec: 70, room: 0.1 });    // 低く、くぐもったティック(ラベルが沈む)
  click(G(3, 0.75), 0.20, { pan: scr(560) });                              // 退院支援・見出し
  click(G(3, 1), 0.28); click(G(3, 1) + 0.03, 0.24, { pan: -0.6 }); click(G(3, 1) + 0.06, 0.24, { pan: 0.6 });   // 三本の道(中・左・右)
  riser(G(3, 3), G(4), 0.40, { tone: [D2 + 12, 45 + 12], lo: 400, hi: 6000 });
  whoosh(G(3, 3.5), BEAT, 0.50, 300, 5000, 0.6, -0.6, 0.5);                // カード 1 へのウィップ(山は 5.625)
  impact(G(4), 0.50, [[len => boomWave(len, D1, 0.6, 1.5, 20), -1]], { dur: 0.65, room: 0.08, hall: 0.12, duckDepth: 0.6 });   // 低い着地 + キック(胴はキックの頭のあとにふくらむ。逆相で山を積まない)
  // --- 小節 4 · カード 1–4(拍)。印刷が終わる瞬間にティック、縦の線が終わる瞬間に柔らかいティック
  for (let bt = 0; bt < 4; bt++) whoosh(G(4, bt), 0.1875, 0.30, 500, 5000, 0.6, -0.6, 0.5);
  const prints = [[G(4, 0.5), G(4, 0.5) + 0.12890625]];                    // カード 1 だけは画の印刷終わり 5.859・縦の終わり 5.988
  for (let bt = 1; bt < 4; bt++) prints.push([G(4, bt) + 0.1875, G(4, bt) + 0.328125]);
  for (const [tp, tv] of prints) { tick(tp, 0.20, 2600, scr(1448)); tick(tv, 0.08, 1300, scr(1448) * 0.5, { dec: 90, dur: 0.06 }); }
  // --- 小節 5 · カード 5–8(裏拍のモンタージュ)
  for (let h = 0; h < 4; h++) { const c = G(5, h / 2); whoosh(c, 0.1171875, 0.22, 600, 5000, 0.6, -0.6, 0.5); tick(c + 0.1171875, 0.18, 2600, scr(1448)); }
  // 8.438 → 8.789: 引きの風切り(下げ)。8.789–9.141 は息(新しい音は出さない。地の拍は続く)
  whoosh(G(5, 2), 0.3515625, 0.40, 5000, 300, 0, 0, 0.5);
  whoosh(G(5, 3.5), BEAT, 0.45, 300, 5000, 0.6, -0.6, 0.5);               // ダイブ 9.141–9.609(山は 6 小節の頭 9.375、右 → 左)
  // --- 小節 6 · 型(評価 / 理解 / 設計 / 実践 / 再評価)。語が線から上がる瞬間に 1 語 1 音、駅と同じ声で 0.24。
  // D5 / A4 / E5 / A4 / D5: 最後は最初と同じ高さ(上がり続けない = 数えない。循環を音で閉じる)。着地の打撃は置かない
  [[74, 400], [69, 680], [76, 960], [69, 1240], [74, 1520]].forEach(([m, x], i) => click(G(6, 0.5 + i / 2), 0.24, { f: hz(m), pan: scr(x), room: 0.25 }));
  swell(G(6, 3.5), G(7), 0.30, [74, 77, 81]);                              // 原則(スリット)への入り
  // --- 小節 7 · THE BREATH, THE BEND(キックなし。サブと和音だけ)
  air(G(7), 1.4, 0.20, { rise: 0.46875 });                                  // スリットが開く空気
  mallet(G(7), 74, 0.15, 1.6, 0, { room: 0.3, hall: 0.4 });                // D5
  riser(G(7, 2), G(8), 0.50, { tone: [50, 62], lo: 300, hi: 7000, shape: 2.4, hall: 0.1 });   // 13.125 のサンプルちょうどで終わる
  tick(G(7, 3), 0.10, 2400, 0, { f1: 1200 });                              // 原則が線に沈む
  glide(G(7, 3), G(7, 3.75), G(8), 69, 74, 0.12);                          // 曲がりに合わせて 4 度上がる(A4 → D5)
  tick(G(7, 3.5), 0.12, 3520, scr(650));                                    // 砂色の線の始点
  // --- 小節 8 · SIGN-OFF(唯一の山)
  // サブ D1 1.4 s(歪みの倍音 A2・F♯3 が小さな再生機でも聞こえる)+ 明るい金属 0.5 + 割れ 0.6 + 長い残響。頭で重なる山は胴の高さまで押さえ、残りはマスターのリミッタが受ける
  impact(G(8), 1.00 * dB(PUSH), [[len => boomWave(len, D1, 1.4, 3), 1], [metalWave, 0.5], [len => crackWave(len, 8, 0.2), 0.6], [len => clickWave(len, 2500), 0.3]],
    { dur: 1.45, room: 0.1, hall: 1.2, ratio: 1 });
  bells(G(8), [[62, 1, -0.3], [69, 0.8, 0.3], [76, 0.6, 0]], 0.35, 14.95 - G(8));   // 余韻 D4 / A4 / E5、14.95 で −60 dB
  air(G(8, 0.5), 0.6, 0.08, { rise: 0.234375, hall: 0.2 });                // 字間が詰まる
  tick(G(8, 1), 0.08, 2349.3, 0);                                           // 肩書きの帯。これより後に新しい音はない
}
score();

/* ================================================================
   ミックスと仕上げ
   ================================================================ */
const room = reverb(ROOM, { room: 0.84, damp: 0.35, size: 1, pre: ms(8), hp: 220 });
const hall = reverb(HALL, { room: 0.86, damp: 0.25, size: 1.45, pre: ms(22), hp: 240 });
const ROOM_RET = 0.9, HALL_RET = 0.9;
let L = new Float32Array(N), R = new Float32Array(N);
{
  const hl = biquad(), hr = biquad(), s1 = biquad(), s2 = biquad();
  for (let n = 0; n < N; n++) {
    let l = DRY[0][n] + DUCKED[0][n] * duck[n] + room[0][n] * ROOM_RET + hall[0][n] * HALL_RET;
    let r = DRY[1][n] + DUCKED[1][n] * duck[n] + room[1][n] * ROOM_RET + hall[1][n] * HALL_RET;
    l = hl(l, 'hp', 20); r = hr(r, 'hp', 20);                  // 直流と超低域を落とす
    const m = (l + r) / 2, s = s2(s1((l - r) / 2, 'hp', 120), 'hp', 120);   // 120 Hz より下はモノ
    L[n] = m + s; R[n] = m - s;
  }
}

/* ---- ラウドネス(ITU-R BS.1770: K 特性・400 ms ブロック・ゲート) ---- */
function kweight(x) {
  const y = new Float64Array(x.length);
  const S = [[1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585],
    [1, -2, 1, -1.99004745483398, 0.99007225036621]];
  let src = x;
  for (const [b0, b1, b2, a1, a2] of S) {
    let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (let n = 0; n < src.length; n++) {
      const v = b0 * src[n] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = src[n]; y2 = y1; y1 = v; y[n] = v;
    }
    src = Float64Array.from(y);
  }
  return src;
}
function loudness(l, r) {
  const kl = kweight(l), kr = kweight(r), cs = new Float64Array(N + 1);
  for (let n = 0; n < N; n++) cs[n + 1] = cs[n] + kl[n] * kl[n] + kr[n] * kr[n];
  const step = SR / 10, win = 4 * step, zs = [];
  for (let s = 0; s + win <= N; s += step) zs.push((cs[s + win] - cs[s]) / win);
  const lu = z => -0.691 + 10 * Math.log10(z);
  const a = zs.filter(z => lu(z) > -70), rel = lu(a.reduce((p, z) => p + z, 0) / a.length) - 10;
  const g = a.filter(z => lu(z) > rel);
  return lu(g.reduce((p, z) => p + z, 0) / g.length);
}

/* ---- 真のピーク(4 倍オーバーサンプル)と先読みリミッタ ---- */
const TPH = (() => {   // 位相 1/4・2/4・3/4 の補間係数(Kaiser 窓の sinc、片側 12 タップ)
  const I0 = x => { let s = 1, t = 1; for (let k = 1; k < 30; k++) { t *= (x / 2 / k) ** 2; s += t; } return s; };
  return [0.25, 0.5, 0.75].map(p => {
    const h = [];
    for (let j = -11; j <= 12; j++) { const x = j - p, w = I0(8 * Math.sqrt(Math.max(0, 1 - (x / 12.5) ** 2))) / I0(8); h.push((x ? Math.sin(Math.PI * x) / (Math.PI * x) : 1) * w); }
    return h;
  });
})();
function truePeakEnv(x) {   // e[n] = x[n] から x[n+1] までの間(両端を含む)の最大の絶対値
  const e = new Float32Array(N);
  for (let n = 0; n < N; n++) {
    let m = Math.abs(x[n]);
    if (n + 1 < N) m = Math.max(m, Math.abs(x[n + 1]));
    for (const h of TPH) { let s = 0; for (let j = 0; j < 24; j++) { const i = n - 11 + j; if (i >= 0 && i < N) s += x[i] * h[j]; } m = Math.max(m, Math.abs(s)); }
    e[n] = m;
  }
  return e;
}
const HIT = at(G(8)) - ms(3);
function limit(l, r, ceil) {
  const el = truePeakEnv(l), er = truePeakEnv(r), need = new Float32Array(N), LA = ms(1.5), relK = 1 - Math.exp(-1 / ms(80));
  for (let n = 0; n < N; n++) {
    const c = n < HIT ? ceil * dB(-BED_ROOM) : ceil;           // 最後の着地より前は天井を BED_ROOM dB 下げる
    const p = Math.max(el[n], er[n], n ? el[n - 1] : 0, n ? er[n - 1] : 0); need[n] = p > c ? c / p : 1;
  }
  const m = new Float32Array(N);                               // 過去 LA サンプルの最小
  for (let n = 0; n < N; n++) { let v = 1; for (let k = Math.max(0, n - LA); k <= n; k++) v = Math.min(v, need[k]); m[n] = v; }
  const out = [new Float32Array(N), new Float32Array(N)];
  let g = 1, maxGR = 0;
  for (let n = 0; n < N; n++) {
    let a = 0, c = 0; for (let k = n; k <= Math.min(N - 1, n + LA); k++) { a += m[k]; c++; }
    a /= c;                                                    // 先の LA サンプルの平均(必ず need[n] 以下)
    g = a < g ? a : g + (a - g) * relK;
    maxGR = Math.max(maxGR, -20 * Math.log10(g));
    out[0][n] = l[n] * g; out[1][n] = r[n] * g;
  }
  return { out, maxGR };
}
const peakOf = (l, r) => { let p = 0; const el = truePeakEnv(l), er = truePeakEnv(r); for (let n = 0; n < N; n++) p = Math.max(p, el[n], er[n]); return p; };
function dcBlock(x) {   // 5 Hz の 1 次 HPF(リミッタの非対称な利きで出る直流を落とす)
  const y = new Float32Array(N), a = 1 - TAU * 5 / SR;
  let px = 0, py = 0;
  for (let n = 0; n < N; n++) { py = x[n] - px + a * py; px = x[n]; y[n] = py; }
  return y;
}

let gain = dB(TARGET_LUFS - loudness(L, R)), ceil = dB(TP_MAX - 0.05), res, lufs, tp;
for (let it = 0; it < 8; it++) {
  const gl = L.map(v => v * gain), gr = R.map(v => v * gain);
  res = limit(gl, gr, ceil); res.out = res.out.map(dcBlock);
  lufs = loudness(res.out[0], res.out[1]); tp = 20 * Math.log10(peakOf(res.out[0], res.out[1]));
  if (Math.abs(lufs - TARGET_LUFS) < 0.03 && tp <= TP_MAX) break;
  gain *= dB(TARGET_LUFS - lufs);
  if (tp > TP_MAX) ceil *= dB(TP_MAX - tp - 0.02);
}
[L, R] = res.out;

/* 最後の 50 ms(14.95–15.00)を閉じる(プツ音を出さない) */
for (let n = at(14.95); n < N; n++) { const u = (N - 1 - n) / (N - 1 - at(14.95)); L[n] *= u * u; R[n] *= u * u; }

/* ---- WAV(16bit・48kHz・ステレオ)。TPDF ディザは最後の 50 ms では止める ---- */
const dith = mkRnd(48000);
const data = Buffer.alloc(N * 4);
for (let n = 0; n < N; n++) {
  const d = n < at(14.95) ? 1 : 0;
  data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[n] * 32767 + d * (dith() + dith()) / 2))), n * 4);
  data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[n] * 32767 + d * (dith() + dith()) / 2))), n * 4 + 2);
}
const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8); hdr.write('fmt ', 12);
hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22); hdr.writeUInt32LE(SR, 24);
hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34); hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
writeFileSync(OUT, Buffer.concat([hdr, data]));
console.log('wrote', OUT, `${lufs.toFixed(2)} LUFS · true peak ${tp.toFixed(2)} dBTP · gain ${(20 * Math.log10(gain)).toFixed(1)} dB · limiter ${res.maxGR.toFixed(1)} dB`);
