// ================================================================
// hero pre-render — 正式ロゴの「交差する二本の線」を厚いガラスの板として、CPU パストレースで描く
// usage: node scripts/render-hero.mjs --layout pc|sp --theme light|dark --w 2400 --h 1500 --spp 32 --out file.png
// 依存なし(worker_threads + zlib)。hero-bridge.js と同じベジェ/フレーム/カメラ定義を使う
// ================================================================
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import os from 'node:os';

const argv = Object.fromEntries(process.argv.slice(2).map((a, i, arr) => a.startsWith('--') ? [a.slice(2), arr[i + 1]] : null).filter(Boolean));
const OPT = {
  layout: argv.layout || 'pc', theme: argv.theme || 'light',
  w: +(argv.w || 1200), h: +(argv.h || 750), spp: +(argv.spp || 16), out: argv.out || 'hero.png',
  threads: +(argv.threads || os.cpus().length),
  t: argv.t == null ? 1 : +argv.t,          // 登場演出のカメラ: 0=開始の構図 → 1=定位置(easeOutCubic)
  bg: argv.bg || '',                          // 指定すると背景を焼いた不透明 PNG(動画のフレーム用)
};

/* ---------- vec ---------- */
const v3 = (x, y, z) => [x, y, z];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const vmul = (a, b) => [a[0] * b[0], a[1] * b[1], a[2] * b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const len = a => Math.hypot(a[0], a[1], a[2]);
const norm = a => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

/* ---------- ribbon geometry(hero-bridge.js と同じ) ---------- */
function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return add(add(mul(p0, u * u * u), mul(p1, 3 * u * u * t)), add(mul(p2, 3 * u * t * t), mul(p3, t * t * t)));
}
function ribbonFrames(segs, opt, N) {
  const ctrl = segs.length, pts = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N, k = Math.min(ctrl - 1, Math.floor(t * ctrl)), lt = t * ctrl - k;
    const s = segs[k]; pts.push(bezier(s[0], s[1], s[2], s[3], lt));
  }
  const frames = []; let n = null, prevT = null;
  for (let i = 0; i <= N; i++) {
    const tng = norm(sub(pts[Math.min(N, i + 1)], pts[Math.max(0, i - 1)]));
    if (!n) { n = norm(cross(tng, [0, 0, 1])); if (len(n) < 1e-3) n = [1, 0, 0]; }
    else {
      const b = cross(prevT, tng); const bl = len(b);
      if (bl > 1e-6) {
        const ax = mul(b, 1 / bl), ang = Math.acos(Math.max(-1, Math.min(1, dot(prevT, tng))));
        const c = Math.cos(ang), s = Math.sin(ang);
        n = add(add(mul(n, c), mul(cross(ax, n), s)), mul(ax, dot(ax, n) * (1 - c)));
      }
    }
    prevT = tng;
    const t = i / N;
    const tw = opt.twist0 + (opt.twist1 - opt.twist0) * t + Math.sin(t * Math.PI * opt.wave) * opt.waveAmp;
    const bn = cross(tng, n);
    const c = Math.cos(tw), s = Math.sin(tw);
    const side = norm(add(mul(n, c), mul(bn, s)));
    const face = norm(cross(tng, side));
    const w = opt.w0 + (opt.w1 - opt.w0) * Math.sin(t * Math.PI) * (1 - opt.wFlat) + (opt.w1 - opt.w0) * opt.wFlat;
    frames.push({ p: pts[i], side, face, w, t, tng });
  }
  return frames;
}
// 4面の帯 + 両端のふた → 閉じた三角形メッシュ(位置・法線・t)
function ribbonMesh(segs, opt, xform, N = 420) {
  const frames = ribbonFrames(segs, opt, N);
  const th = opt.th;
  const tris = []; // {p:[a,b,c], n:[na,nb,nc], t:[ta,tb,tc]}
  const X = p => xform.p(p), XN = n => xform.n(n);
  const corner = (f, sSide, sFace) => add(add(f.p, mul(f.side, sSide * f.w / 2)), mul(f.face, sFace * th / 2));
  let K = 0;
  const push = (a, b, c, na, nb, nc, ta, tb, tc) => tris.push({ p: [X(a), X(b), X(c)], n: [XN(na), XN(nb), XN(nc)], t: [ta, tb, tc], k: K });
  for (let i = 0; i < N; i++) {
    const f0 = frames[i], f1 = frames[i + 1];
    // 面ごとに滑らかな法線(帯の面・側面)。角は硬いまま(ガラスの縁が立つ)
    const faces = [
      { s: [1, 1], e: [-1, 1], n: f => f.face, k: 0 },          // 上面: side + → side -
      { s: [-1, -1], e: [1, -1], n: f => mul(f.face, -1), k: 0 }, // 下面
      { s: [1, -1], e: [1, 1], n: f => f.side, k: 1 },           // 側面 +
      { s: [-1, 1], e: [-1, -1], n: f => mul(f.side, -1), k: 1 }, // 側面 -
    ];
    faces.forEach(fc => {
      K = fc.k;
      const a0 = corner(f0, fc.s[0], fc.s[1]), b0 = corner(f0, fc.e[0], fc.e[1]);
      const a1 = corner(f1, fc.s[0], fc.s[1]), b1 = corner(f1, fc.e[0], fc.e[1]);
      const n0 = fc.n(f0), n1 = fc.n(f1);
      push(a0, a1, b0, n0, n1, n0, f0.t, f1.t, f0.t);
      push(b0, a1, b1, n0, n1, n1, f0.t, f1.t, f1.t);
    });
  }
  // ふた
  K = 1;
  [[frames[0], -1], [frames[N], 1]].forEach(([f, sgn]) => {
    const n = mul(f.tng, sgn);
    const c = [corner(f, 1, 1), corner(f, -1, 1), corner(f, -1, -1), corner(f, 1, -1)];
    if (sgn > 0) { push(c[0], c[1], c[2], n, n, n, f.t, f.t, f.t); push(c[0], c[2], c[3], n, n, n, f.t, f.t, f.t); }
    else { push(c[0], c[2], c[1], n, n, n, f.t, f.t, f.t); push(c[0], c[3], c[2], n, n, n, f.t, f.t, f.t); }
  });
  return tris;
}
function rotMat(rx, ry, rz) {
  const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
  return [
    [cy * cz + sy * sx * sz, -cy * sz + sy * sx * cz, sy * cx],
    [cx * sz, cx * cz, -sx],
    [-sy * cz + cy * sx * sz, sy * sz + cy * sx * cz, cy * cx],
  ];
}
function xformOf(rx, ry, rz, t, s) {
  const R = rotMat(rx, ry, rz);
  const ap = p => [R[0][0] * p[0] + R[1][0] * p[1] + R[2][0] * p[2], R[0][1] * p[0] + R[1][1] * p[1] + R[2][1] * p[2], R[0][2] * p[0] + R[1][2] * p[1] + R[2][2] * p[2]];
  return { p: p => add(mul(ap(p), s), t), n: n => norm(ap(n)) };
}

/* ---------- scene ---------- */
function buildScene(layout, theme, t = 1) {
  const END = layout === 'sp'
    ? { x: 1.0, y: 0.3, scale: 0.9, floor: -2.9, eye: [1.6, 0.0, 23], at: [2.6, -2.0, 0], fov: 0.55, ry: -0.62, rx: 0.10 }
    : { x: 4.85, y: -0.1, scale: 0.92, floor: -2.6, eye: [0.2, 0.9, 14.0], at: [2.2, 0.1, 0], fov: 0.55, ry: -0.62, rx: 0.10 };
  // 登場の構図: 少し斜め(手前へ回り込む)・やや遠く・低い位置から、定位置へ収まる
  const START = layout === 'sp'
    ? { ...END, ry: -0.98, rx: 0.16, x: 1.5, y: -0.1, scale: 0.86, eye: [2.4, -0.4, 25.5] }
    : { ...END, ry: -0.98, rx: 0.16, x: 5.6, y: -0.5, scale: 0.88, eye: [1.2, 0.4, 16.0] };
  const k = 1 - Math.pow(1 - clamp01(t), 3);
  const L = { ...END };
  for (const key of ['x', 'y', 'scale', 'ry', 'rx']) L[key] = START[key] + (END[key] - START[key]) * k;
  L.eye = lerp(START.eye, END.eye, k);
  const rz1 = 0.03, rz2 = -0.02;
  const t1 = [L.x + 0.15, L.y + 0.05, 0], t2 = [L.x, L.y, 0];
  const rise = ribbonMesh([
    [v3(-0.9, -4.2, 1.1), v3(0.3, -2.6, 0.85), v3(1.3, -0.9, 0.4), v3(2.9, 0.6, 0.05)],
    [v3(2.9, 0.6, 0.05), v3(4.2, 1.85, -0.25), v3(5.4, 3.1, -0.6), v3(6.8, 4.2, -0.9)],
  ], { w0: 0.38, w1: 0.78, wFlat: 0.35, th: 0.38, twist0: 0.5, twist1: -0.45, wave: 1.0, waveAmp: -0.12 },
    xformOf(L.rx, L.ry + 0.02, rz1, t1, L.scale));
  const arch = ribbonMesh([
    [v3(-4.4, -4.0, -0.9), v3(-3.4, -1.0, -0.7), v3(-1.4, 1.9, -0.2), v3(0.6, 2.2, 0.15)],
    [v3(0.6, 2.2, 0.15), v3(2.5, 2.45, 0.45), v3(4.9, 0.4, 0.75), v3(6.6, -3.0, 0.9)],
  ], { w0: 0.5, w1: 1.05, wFlat: 0.25, th: 0.44, twist0: -0.5, twist1: 0.5, wave: 1.0, waveAmp: 0.1 },
    xformOf(L.rx, L.ry, rz2, t2, L.scale));
  const tris = [...arch.map(t => ({ ...t, m: 0 })), ...rise.map(t => ({ ...t, m: 1 }))];
  const dark = theme === 'dark';
  const S = {
    L, tris, floorY: L.floor,
    // 材質: 透過率(単位長あたり)。厚いほど濃い青緑に沈む
    glass: [
      { T1: [0.17, 0.62, 0.56], ior: 1.5 },   // arch: 薄い面はほぼ白、厚み方向と重なりで深い青緑に
      { T1: [0.21, 0.66, 0.60], ior: 1.5 },   // rise
    ],
    floorAlbedo: dark ? [0.055, 0.12, 0.115] : [0.955, 0.945, 0.92],
    floorGloss: dark ? 0.36 : 0.32,
    lights: dark ? [
      { c: [-6, 8.5, -6], r: 4.0, e: [0.85, 1.0, 0.95], pow: 6.5 },
      { c: [7, 1.2, -5], r: 1.2, e: [0.72, 1.0, 0.92], pow: 20 },
      { c: [4, 2.5, 10], r: 2.4, e: [0.9, 1.0, 0.97], pow: 1.6 },
    ] : [
      { c: [-6, 8.5, -6], r: 4.0, e: [1.0, 0.99, 0.96], pow: 8 },
      { c: [7, 1.2, -5], r: 1.2, e: [0.85, 1.0, 0.94], pow: 22 },
      { c: [4, 2.5, 10], r: 2.4, e: [1.0, 1.0, 1.0], pow: 2.2 },
    ],
    // 反射・屈折が見る環境: 手続き的なスタジオ。明るい空/暗い地平の境と、背面左上・真上・背面右に柔らかい発光パネル(窓相当)
    env: dark
      ? (d) => { const sky = smooth(-0.01, 0.06, d[1]); let c = lerp([0.03, 0.08, 0.075], lerp([0.22, 0.32, 0.30], [0.08, 0.15, 0.14], smooth(0.1, 0.9, d[1])), sky);
          c = add(c, mul([0.85, 1.0, 0.95], 1.1 * Math.pow(Math.max(0, dot(d, norm([-0.5, 0.5, -0.7]))), 4)));
          c = add(c, mul([0.9, 1.0, 0.97], 0.6 * Math.pow(Math.max(0, dot(d, norm([0.0, 1.0, 0.2]))), 3)));
          c = add(c, mul([0.6, 1.0, 0.88], 1.6 * Math.pow(Math.max(0, dot(d, norm([0.6, 0.15, -0.8]))), 14))); return c; }
      : (d) => { const sky = smooth(-0.01, 0.06, d[1]); let c = lerp([0.60, 0.65, 0.65], lerp([0.98, 0.97, 0.94], [0.80, 0.84, 0.84], smooth(0.1, 0.9, d[1])), sky);
          c = add(c, mul([1.0, 0.99, 0.97], 1.1 * Math.pow(Math.max(0, dot(d, norm([-0.5, 0.5, -0.7]))), 4)));
          c = add(c, mul([1.0, 1.0, 0.98], 0.7 * Math.pow(Math.max(0, dot(d, norm([0.0, 1.0, 0.2]))), 3)));
          c = add(c, mul([0.75, 1.0, 0.9], 1.6 * Math.pow(Math.max(0, dot(d, norm([0.6, 0.15, -0.8]))), 14))); return c; },
    causticGain: dark ? 0.4 : 0.8,
    causticTint: dark ? [0.35, 0.75, 0.66] : [0.62, 0.95, 0.86],
    shadowTint: dark ? [0.1, 0.3, 0.28] : [0.35, 0.62, 0.58],
    envAvg: dark ? [0.04, 0.11, 0.10] : [0.95, 0.965, 0.955],
    edgeGlow: dark ? [0.55, 0.95, 0.85] : [0.6, 0.98, 0.9],
    envCam: dark ? (d) => lerp([0.02, 0.07, 0.068], [0.04, 0.12, 0.11], smooth(-0.3, 0.9, d[1])) : (d) => lerp([0.955, 0.965, 0.95], [0.995, 0.99, 0.98], smooth(-0.3, 0.9, d[1])),
    fogColor: dark ? [0.035, 0.10, 0.095] : [0.955, 0.965, 0.95],
  };
  S.lights.forEach(l => { l.n = norm(sub([0.5, -1, 0], l.c)); l.e = mul(l.e, l.pow); });
  return S;
}

/* ---------- BVH ---------- */
function buildBVH(tris) {
  const boxes = tris.map(t => { const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]; t.p.forEach(p => { for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], p[k]); mx[k] = Math.max(mx[k], p[k]); } }); return { mn, mx, c: mul(add(mn, mx), 0.5) }; });
  const nodes = [];
  function build(ids) {
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
    ids.forEach(i => { for (let k = 0; k < 3; k++) { mn[k] = Math.min(mn[k], boxes[i].mn[k]); mx[k] = Math.max(mx[k], boxes[i].mx[k]); } });
    const node = { mn, mx, ids: null, l: -1, r: -1 }; const id = nodes.length; nodes.push(node);
    if (ids.length <= 4) { node.ids = ids; return id; }
    const ext = sub(mx, mn); const ax = ext[0] > ext[1] ? (ext[0] > ext[2] ? 0 : 2) : (ext[1] > ext[2] ? 1 : 2);
    ids.sort((a, b) => boxes[a].c[ax] - boxes[b].c[ax]);
    const h = ids.length >> 1;
    node.l = build(ids.slice(0, h)); node.r = build(ids.slice(h));
    return id;
  }
  build(tris.map((_, i) => i));
  return nodes;
}
function hitBox(n, o, inv, tmax) {
  let t0 = 0, t1 = tmax;
  for (let k = 0; k < 3; k++) {
    let a = (n.mn[k] - o[k]) * inv[k], b = (n.mx[k] - o[k]) * inv[k];
    if (a > b) { const tmp = a; a = b; b = tmp; }
    if (a > t0) t0 = a; if (b < t1) t1 = b;
    if (t0 > t1) return false;
  }
  return true;
}
function hitTri(tr, o, d, tmax) {
  const e1 = sub(tr.p[1], tr.p[0]), e2 = sub(tr.p[2], tr.p[0]);
  const pv = cross(d, e2); const det = dot(e1, pv);
  if (Math.abs(det) < 1e-9) return null;
  const inv = 1 / det; const tv = sub(o, tr.p[0]);
  const u = dot(tv, pv) * inv; if (u < 0 || u > 1) return null;
  const qv = cross(tv, e1); const v = dot(d, qv) * inv; if (v < 0 || u + v > 1) return null;
  const t = dot(e2, qv) * inv; if (t < 1e-4 || t > tmax) return null;
  return { t, u, v };
}
function intersect(S, o, d, tmax) {
  const inv = [1 / d[0], 1 / d[1], 1 / d[2]];
  let best = null; const stack = [0];
  while (stack.length) {
    const n = S.bvh[stack.pop()];
    if (!hitBox(n, o, inv, best ? best.t : tmax)) continue;
    if (n.ids) {
      for (const i of n.ids) { const h = hitTri(S.tris[i], o, d, best ? best.t : tmax); if (h) best = { t: h.t, u: h.u, v: h.v, i }; }
    } else { stack.push(n.l, n.r); }
  }
  if (!best) return null;
  const tr = S.tris[best.i]; const w = 1 - best.u - best.v;
  const N = norm(add(add(mul(tr.n[0], w), mul(tr.n[1], best.u)), mul(tr.n[2], best.v)));
  const Ng = norm(cross(sub(tr.p[1], tr.p[0]), sub(tr.p[2], tr.p[0])));
  return { t: best.t, N, Ng, m: tr.m, k: tr.k, tt: tr.t[0] * w + tr.t[1] * best.u + tr.t[2] * best.v };
}

/* ---------- sampling helpers ---------- */
let seed = 12345;
const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return ((seed >>> 0) % 1000000) / 1000000; };
function onb(n) { const a = Math.abs(n[0]) > 0.9 ? [0, 1, 0] : [1, 0, 0]; const t = norm(cross(a, n)); const b = cross(n, t); return [t, b]; }
function cosineDir(n) { const r1 = rnd(), r2 = rnd(); const r = Math.sqrt(r1), ph = 2 * Math.PI * r2; const [t, b] = onb(n); return norm(add(add(mul(t, r * Math.cos(ph)), mul(b, r * Math.sin(ph))), mul(n, Math.sqrt(1 - r1)))); }
function diskPoint(l) { const r = l.r * Math.sqrt(rnd()), ph = 2 * Math.PI * rnd(); const [t, b] = onb(l.n); return add(add(l.c, mul(t, r * Math.cos(ph))), mul(b, r * Math.sin(ph))); }
function hitDisk(l, o, d, tmax) { const dn = dot(d, l.n); if (Math.abs(dn) < 1e-6) return null; const t = dot(sub(l.c, o), l.n) / dn; if (t < 1e-4 || t > tmax) return null; const p = add(o, mul(d, t)); return len(sub(p, l.c)) <= l.r ? t : null; }
function fresnel(cosI, eta) { // eta = n1/n2
  const sinT2 = eta * eta * (1 - cosI * cosI); if (sinT2 > 1) return 1;
  const cosT = Math.sqrt(1 - sinT2);
  const rs = (eta * cosI - cosT) / (eta * cosI + cosT), rp = (cosI - eta * cosT) / (cosI + eta * cosT);
  return (rs * rs + rp * rp) / 2;
}

/* ---------- shading ---------- */
// 影の光線: ガラスを通る光は色づいて弱まる(柔らかい色影)
function shadowTransmit(S, o, d, dist) {
  let T = [1, 1, 1], t0 = 0, n = 0;
  let oo = o;
  while (n++ < 6) {
    const h = intersect(S, oo, d, dist - t0);
    if (!h) break;
    const g = S.glass[h.m];
    T = vmul(T, [Math.pow(g.T1[0], 0.35) * 0.72, Math.pow(g.T1[1], 0.35) * 0.72, Math.pow(g.T1[2], 0.35) * 0.72]);
    t0 += h.t; oo = add(oo, mul(d, h.t + 1e-3));
  }
  return T;
}
function directLight(S, p, n) {
  let c = [0, 0, 0];
  for (const l of S.lights) {
    const q = diskPoint(l); const wi = sub(q, p); const dist = len(wi); const d = mul(wi, 1 / dist);
    const cosS = dot(n, d); if (cosS <= 0) continue;
    const cosL = -dot(d, l.n); if (cosL <= 0) continue;
    const T = shadowTransmit(S, p, d, dist);
    const area = Math.PI * l.r * l.r;
    const k = cosS * cosL * area / (dist * dist) / Math.PI;
    c = add(c, vmul(mul(l.e, k), T));
  }
  return c;
}
function lum(c) { return c[0] * 0.3 + c[1] * 0.59 + c[2] * 0.11; }
function directLightNoShadow(S, p, n) {
  let c = [0, 0, 0];
  for (const l of S.lights) {
    const q = diskPoint(l); const wi = sub(q, p); const dist = len(wi); const d = mul(wi, 1 / dist);
    const cosS = dot(n, d); if (cosS <= 0) continue; const cosL = -dot(d, l.n); if (cosL <= 0) continue;
    c = add(c, mul(l.e, cosS * cosL * Math.PI * l.r * l.r / (dist * dist) / Math.PI));
  }
  return c;
}
// 返り値: col(premultiplied)・a(被覆)。床は「影と映り込みだけを焼く」シャドウキャッチャー(背景と床の色は CSS に任せる)
function trace(S, o, d) {
  let thr = [1, 1, 1], col = [0, 0, 0], specular = true, alpha = 0, transmitted = false;
  for (let b = 0; b < 12; b++) {
    const h = intersect(S, o, d, 1e9);
    let tF = null;
    if (d[1] < -1e-6) { const t = (S.floorY - o[1]) / d[1]; if (t > 1e-4 && (!h || t < h.t)) tF = t; }
    let tL = null, lHit = null;
    if (b > 0) for (const l of S.lights) { const t = hitDisk(l, o, d, (h ? h.t : 1e9)); if (t != null && (tF == null || t < tF) && (tL == null || t < tL)) { tL = t; lHit = l; } }
    if (tL != null) { if (specular) col = add(col, vmul(thr, mul(lHit.e, 0.06))); break; }
    if (tF != null) {
      const p = add(o, mul(d, tF)); const n = [0, 1, 0];
      if (b === 0) {
        // 影と艶の映り込みを、確率ではなく毎サンプル評価する(床の粒状ノイズを抑える)
        const up = add(p, [0, 1e-3, 0]);
        // 艶: 少しぼけた反射がガラスに当たるところだけ色と被覆を持つ
        const r = [d[0], -d[1], d[2]]; const jit = mul(norm([rnd() - 0.5, rnd() - 0.5, rnd() - 0.5]), 0.06);
        const rd = norm(add(r, jit)); const hh = intersect(S, up, rd, 1e9);
        let refl = [0, 0, 0], reflA = 0;
        if (hh) { const sub2 = trace(S, up, rd); refl = mul(sub2.col, 0.9); reflA = 1; }
        // 影: 直接光の遮蔽(光源ごとに 2 点)と、環境光の遮蔽(4 方向)
        let Lw = [0, 0, 0], L0 = [0, 0, 0];
        for (let k = 0; k < 2; k++) { Lw = add(Lw, directLight(S, p, n)); L0 = add(L0, directLightNoShadow(S, p, n)); }
        const lD0 = lum(L0) / 2, lD = lum(Lw) / 2; const occD = lD0 > 1e-6 ? 1 - Math.min(1, lD / lD0) : 0;
        let occE = 0;
        for (let k = 0; k < 4; k++) { const ed = cosineDir(n); const eh = intersect(S, up, ed, 1e9); if (eh) { const g = S.glass[eh.m]; occE += (1 - lum([Math.pow(g.T1[0], 0.3), Math.pow(g.T1[1], 0.3), Math.pow(g.T1[2], 0.3)]) * 0.85) * Math.exp(-eh.t / 1.6); } }
        occE /= 4;
        const lE = lum(S.envAvg);
        const occ = (occD * lD0 + occE * lE) / (lD0 + lE);
        const sa = Math.min(1, occ * 1.7);
        const caus = occD > 0.05 ? Math.min(1, lD / Math.max(1e-6, lD0)) * occD : 0;
        const shadowCol = add(mul(S.shadowTint, sa * 0.22), mul(S.causticTint, caus * S.causticGain));
        // 合成: 影(a=sa, 色 shadowCol)の上に艶の映り込み(a=g*reflA, 色 refl*g)
        const g = S.floorGloss;
        const a = sa + g * reflA * (1 - sa);
        return { col: add(mul(shadowCol, 1 - g * reflA), mul(refl, g)), a };
      }
      // 二次光線が床に当たった: 床の色をおおまかに返す
      const Lf = add(directLight(S, p, n), S.envAvg);
      col = add(col, vmul(thr, vmul(S.floorAlbedo, Lf)));
      break;
    }
    if (!h) { col = add(col, vmul(thr, b === 0 ? S.envCam(d) : S.env(d))); break; }
    if (b === 0) alpha = 1;
    const p = add(o, mul(d, h.t)); const g = S.glass[h.m];
    let N = h.N; const inside = dot(d, N) > 0; if (inside) N = mul(N, -1);
    const eta = inside ? g.ior : 1 / g.ior;
    const cosI = -dot(N, d);
    const F = fresnel(cosI, eta);
    if (inside) { thr = vmul(thr, [Math.pow(g.T1[0], h.t), Math.pow(g.T1[1], h.t), Math.pow(g.T1[2], h.t)]); }
    else if (h.k === 1) { col = add(col, vmul(thr, mul(S.edgeGlow, 0.07))); } // 縁のわずかな発光(素材の端に光が溜まる)
    if (rnd() < F) { d = norm(add(d, mul(N, 2 * cosI))); o = add(p, mul(N, 1e-3)); }
    else {
      const sinT2 = eta * eta * (1 - cosI * cosI); const cosT = Math.sqrt(Math.max(0, 1 - sinT2));
      d = norm(add(mul(d, eta), mul(N, eta * cosI - cosT))); o = add(p, mul(N, -1e-3));
      if (inside) transmitted = true;
    }
    specular = true;
    if (b > 3) { const q = Math.max(thr[0], thr[1], thr[2]); if (rnd() > q) break; thr = mul(thr, 1 / q); }
  }
  return { col, a: alpha };
}

/* ---------- camera ---------- */
function camera(S, w, h) {
  const f = 1 / Math.tan(S.L.fov / 2), aspect = w / h;
  const z = norm(sub(S.L.eye, S.L.at)), x = norm(cross([0, 1, 0], z)), y = cross(z, x);
  return (px, py) => {
    const sx = (px / w * 2 - 1) * aspect / f, sy = (1 - py / h * 2) / f;
    return { o: S.L.eye, d: norm(add(add(mul(x, sx), mul(y, sy)), mul(z, -1))) };
  };
}
function tonemap(c) {
  return c.map(v => { v = Math.max(0, v) * 0.96; v = v < 0.7 ? v : 0.7 + 0.3 * (1 - Math.exp(-(v - 0.7) / 0.3)); return Math.pow(Math.min(1, v), 1 / 2.2); });
}

/* ---------- worker ---------- */
if (!isMainThread) {
  const { layout, theme, w, h, spp, rows, wid, t } = workerData;
  seed = 7919 * (wid + 1);
  const S = buildScene(layout, theme, t); S.bvh = buildBVH(S.tris);
  const cam = camera(S, w, h);
  const out = new Float32Array(rows.length * w * 4);
  rows.forEach((py, ri) => {
    for (let px = 0; px < w; px++) {
      let acc = [0, 0, 0], accA = 0;
      for (let s = 0; s < spp; s++) {
        const tent = () => { const u = rnd() * 2; return (u < 1 ? Math.sqrt(u) - 1 : 1 - Math.sqrt(2 - u)) + 0.5; };
        const r = cam(px + tent(), py + tent());
        let { col, a } = trace(S, r.o, r.d);
        const m = Math.max(col[0], col[1], col[2]); if (m > 3.0) col = mul(col, 3.0 / m);
        acc = add(acc, col); accA += a;
      }
      acc = mul(acc, 1 / spp); accA /= spp;
      const o = (ri * w + px) * 4; out[o] = acc[0]; out[o + 1] = acc[1]; out[o + 2] = acc[2]; out[o + 3] = accA;
    }
    parentPort.postMessage({ progress: 1 });
  });
  parentPort.postMessage({ done: true, rows, out }, [out.buffer]);
} else {
  const { w, h, spp, threads } = OPT;
  const t0 = Date.now();
  const img = new Float32Array(w * h * 4);
  const rowSets = Array.from({ length: threads }, () => []);
  for (let y = 0; y < h; y++) rowSets[y % threads].push(y);
  let finished = 0, prog = 0;
  await Promise.all(rowSets.map((rows, wid) => new Promise((res, rej) => {
    const wk = new Worker(new URL(import.meta.url), { workerData: { ...OPT, rows, wid } });
    wk.on('message', m => {
      if (m.progress) { prog++; if (prog % Math.max(1, Math.floor(h / 20)) === 0) process.stderr.write(`\r${Math.round(prog / h * 100)}% ${((Date.now() - t0) / 1000).toFixed(0)}s`); }
      if (m.done) { m.rows.forEach((py, ri) => { img.set(m.out.subarray(ri * w * 4, (ri + 1) * w * 4), py * w * 4); }); finished++; res(); }
    });
    wk.on('error', rej);
  })));
  // PNG
  const bgc = OPT.bg ? OPT.bg.match(/[0-9a-f]{2}/gi).map(h => parseInt(h, 16)) : null;
  const ch = bgc ? 3 : 4;
  const raw = Buffer.alloc((w * ch + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (w * ch + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4; const a = Math.min(1, img[i + 3]);
      // premultiplied → straight alpha(PNG)。色は被覆ぶんで割り戻す
      const c = a > 1e-4 ? tonemap([img[i] / a, img[i + 1] / a, img[i + 2] / a]) : [0, 0, 0];
      const o = y * (w * ch + 1) + 1 + x * ch;
      if (bgc) { for (let k = 0; k < 3; k++) raw[o + k] = Math.round(c[k] * 255 * a + bgc[k] * (1 - a)); }
      else { raw[o] = Math.round(c[0] * 255); raw[o + 1] = Math.round(c[1] * 255); raw[o + 2] = Math.round(c[2] * 255); raw[o + 3] = Math.round(a * 255); }
    }
  }
  const crc = (() => { const T = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c; } return b => { let c = -1; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }; })();
  const chunk = (type, data) => { const l = Buffer.alloc(4); l.writeUInt32BE(data.length); const td = Buffer.concat([Buffer.from(type), data]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = bgc ? 2 : 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
  writeFileSync(OPT.out, png);
  process.stderr.write(`\n${OPT.out} ${w}x${h} spp=${spp} ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);
}
