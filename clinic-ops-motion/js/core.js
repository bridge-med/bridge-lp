/* ================================================================
   THE FUTURE OF CLINIC OPERATIONS — core
   数・緩急・乱数・色。描画はすべて時刻 t の関数にする(シークと書き出しのため)。
   ================================================================ */
(function (root) {
  'use strict';
  const F = (root.FILM = root.FILM || {});

  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, t) => a + (b - a) * t;
  const seg = (t, a, b) => clamp((t - a) / (b - a));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const fract = x => x - Math.floor(x);

  /* CSS と同じ cubic-bezier。x を t に解いて y を返す */
  function bezier(x1, y1, x2, y2) {
    const cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx;
    const cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    const sx = t => ((ax * t + bx) * t + cx) * t;
    const sy = t => ((ay * t + by) * t + cy) * t;
    const dx = t => (3 * ax * t + 2 * bx) * t + cx;
    return x => {
      if (x <= 0) return 0;
      if (x >= 1) return 1;
      let t = x;
      for (let i = 0; i < 8; i++) {
        const e = sx(t) - x;
        if (Math.abs(e) < 1e-6) return sy(t);
        const d = dx(t);
        if (Math.abs(d) < 1e-6) break;
        t -= e / d;
      }
      let lo = 0, hi = 1; t = x;
      for (let i = 0; i < 30; i++) { if (sx(t) < x) lo = t; else hi = t; t = (lo + hi) / 2; }
      return sy(t);
    };
  }

  /* 作品の緩急。カメラと要素はこの数本だけで動かす */
  const ease = {
    linear: t => t,
    inOut: bezier(0.65, 0, 0.35, 1),     // 標準の移動
    out: bezier(0.16, 1, 0.3, 1),        // 着地(速く入って長く減速)
    in: bezier(0.7, 0, 0.84, 0),         // 加速して離れる
    soft: bezier(0.45, 0, 0.55, 1),      // カメラの漂い
    outSoft: bezier(0.33, 1, 0.68, 1),
    focus: bezier(0.8, 0, 0.12, 1),      // ピント送り: ためてから合う
    dive: bezier(0.25, 0.9, 0.3, 1),     // 冒頭の前進(速く入って長く減速)
  };

  /* 決定的な乱数(mulberry32)とハッシュ */
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function hash(i, s = 0) {
    let h = (Math.imul(i | 0, 374761393) + Math.imul(s | 0, 668265263)) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  }
  /* なめらかな1次元のノイズ(-1..1) */
  function noise(x, s = 0) {
    const i = Math.floor(x), f = x - i, u = f * f * (3 - 2 * f);
    return lerp(hash(i, s), hash(i + 1, s), u) * 2 - 1;
  }

  /* 色。値は index.html の :root にだけ置き、ここで読む */
  function hex(h) {
    h = h.trim().replace('#', '');
    if (h.length === 3) h = h.split('').map(c => c + c).join('');
    const n = parseInt(h, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgba = (c, a = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a < 0 ? 0 : a > 1 ? 1 : a})`;
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  const TOKENS = {
    night: ['bg', 'haze', 'ink', 'ink-2', 'ink-3', 'rule', 'ice', 'amber', 'shade'],
    day: ['bg', 'haze', 'panel', 'ink', 'ink-2', 'ink-3', 'rule', 'ice', 'ice-ink', 'amber', 'amber-ink'],
  };
  function readPalette() {
    const cs = getComputedStyle(document.documentElement);
    const pal = {};
    for (const [mode, names] of Object.entries(TOKENS)) {
      const p = (pal[mode] = { mode });
      for (const n of names) {
        const v = cs.getPropertyValue(`--${mode === 'night' ? 'n' : 'd'}-${n}`);
        p[n.replace('-', '')] = hex(v || '#888');
      }
    }
    return pal;
  }

  F.M = { clamp, lerp, seg, smooth, fract, bezier, ease, rng, hash, noise, hex, rgba, mixc, readPalette };
})(window);
