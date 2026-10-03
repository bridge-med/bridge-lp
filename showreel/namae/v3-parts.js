/* 15 秒の映像「名前になる」の描画の道具。showreel/reel.html(v3「一本の線」、6fa6adc)から、easing・弧・ロゴの finale などの道具を写したもの。reel.js が使う */
const clamp = (x, a = 0, b = 1) => x < a ? a : x > b ? b : x;
const lerp = (a, b, u) => a + (b - a) * u;
const E = {
  lin: u => u,
  quadIn: u => u * u,
  cubicIn: u => u * u * u,
  cubicOut: u => 1 - Math.pow(1 - u, 3),
  cubicInOut: u => u < .5 ? 4 * u * u * u : 1 - Math.pow(2 - 2 * u, 3) / 2,
  expoOut: u => (1 - Math.pow(2, -10 * u)) / (1 - Math.pow(2, -10)),
  expoIn: u => (Math.pow(2, 10 * u) - 1) / (Math.pow(2, 10) - 1),
  sineIn: u => 1 - Math.cos(Math.PI * u / 2),
  sineInOut: u => (1 - Math.cos(Math.PI * u)) / 2,
  backOut: u => 1 + 2.4 * Math.pow(u - 1, 3) + 1.4 * Math.pow(u - 1, 2),
};
E.expoInOut = u => u < .5 ? E.expoIn(2 * u) / 2 : (1 + E.expoOut(2 * u - 1)) / 2;
/* サイトの --ease = cubic-bezier(.16,1,.3,1)。文字の出入りはすべてこれ */
E.ease = (() => {
  const bx = s => 3 * (1 - s) * (1 - s) * s * .16 + 3 * (1 - s) * s * s * .3 + s * s * s;
  const by = s => 3 * (1 - s) * (1 - s) * s * 1 + 3 * (1 - s) * s * s * 1 + s * s * s;
  const N = 2048, lut = new Float32Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const u = i / N; let lo = 0, hi = 1;
    for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (bx(m) < u) lo = m; else hi = m; }
    lut[i] = by((lo + hi) / 2);
  }
  return u => { if (u <= 0) return 0; if (u >= 1) return 1; const f = u * N, i = Math.floor(f); return lut[i] + (lut[i + 1] - lut[i]) * (f - i); };
})();
/* 区間 [a, a+d] の進み */
const seg = (t, a, d, e = E.lin) => e(clamp((t - a) / d));

const LIGHT = { bg: '#FBFAF7', line: '#16233E', t1: '#1B1B1E', t2: '#45464C', sand: '#A98F63' };

/* ---- 書体 ---- */
const F = {
  jp: (w, s) => `${w} ${s}px "Noto Sans JP"`,
  min: (w, s) => `${w} ${s}px "Shippori Mincho B1"`,
  en: (w, s) => `${w} ${s}px "Inter"`,
};
const hasCJK = s => /[　-鿿＀-￯]/.test(s);

/* ================================================================
   動きのぼけ用の目印: 動くものは mv() で画面上の位置を残す
   ================================================================ */
let PROBING = null;
function mv(id, x, y) {
  if (!PROBING) return;
  const m = ctx.getTransform();
  PROBING.set(id, [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f]);
}

/* ================================================================
   文字の組み(1 度だけ測って使い回す)
   ================================================================ */
const layoutCache = new Map();
function layout(str, font, ls = 0) {
  const key = str + '|' + font + '|' + ls;
  let r = layoutCache.get(key);
  if (r) return r;
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = font; ctx.letterSpacing = '0px';
  const g = []; let x = 0, asc = 0, desc = 0;
  for (const ch of str) {
    const m = ctx.measureText(ch);
    g.push({ ch, x, w: m.width });
    asc = Math.max(asc, m.actualBoundingBoxAscent); desc = Math.max(desc, m.actualBoundingBoxDescent);
    x += m.width + ls;
  }
  ctx.restore();
  r = { g, width: x - ls, asc, desc, font };
  layoutCache.set(key, r);
  return r;
}
/* 1 文字ずつ描く。fn(i, glyph) → {dx, dy, a} */
function drawGlyphs(L, x, y, color, fn, idp) {
  ctx.font = L.font; ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.letterSpacing = '0px';
  for (let i = 0; i < L.g.length; i++) {
    const gl = L.g[i];
    const m = fn ? fn(i, gl) : null;
    const a = m && m.a != null ? m.a : 1;
    const dx = m && m.dx || 0, dy = m && m.dy || 0;
    if (a <= 0) { if (idp && (dy || dx)) mv(idp + i, x + gl.x + dx, y + dy); continue; }
    if (a < 1) { ctx.save(); ctx.globalAlpha *= a; }
    ctx.fillText(gl.ch, x + gl.x + dx, y + dy);
    if (a < 1) ctx.restore();
    if (idp && m && (m.dy || m.dx)) mv(idp + i, x + gl.x + dx, y + dy);
  }
}
function clipRect(x, y, w, h) { ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip(); }

/* 線から出る: 線の上(dir=-1)か下(dir=+1)を境に切り、隠れた位置から ease で出す。
   starts[i] は各文字の出始め */
function lineText(str, font, x, y, color, lineY, halfW, dir, starts, dur, idp, out = null) {
  const L = layout(str, font);
  const D = dir < 0 ? (lineY - halfW) - (y - L.asc) : (y + L.desc) - (lineY + halfW);
  ctx.save();
  if (dir < 0) clipRect(x - 400, lineY - halfW - 4000, L.width + 800, 4000);
  else clipRect(x - 400, lineY + halfW, L.width + 800, 4000);
  drawGlyphs(L, x, y, color, (i) => {
    let d;
    if (out) d = D * seg(out.t, out.t0, out.d, E.cubicIn);
    else { const s = starts(i); if (TT < s) return { a: 0, dy: dir < 0 ? D : -D }; d = D * (1 - seg(TT, s, dur, E.ease)); }
    return { dy: dir < 0 ? d : -d };        // 上へ出る字は下に隠れている / 下へ出る字は上に隠れている
  }, idp);
  ctx.restore();
}
/* ================================================================
   線(折れ線+角の丸め r=16)。弧長で部分描画する
   ================================================================ */
function buildPath(V, r = 16) {
  const pts = [], L = [], segs = [];
  let s = 0;
  const push = (x, y) => { if (pts.length) { const p = pts[pts.length - 1]; s += Math.hypot(x - p[0], y - p[1]); } pts.push([x, y]); L.push(s); };
  push(V[0][0], V[0][1]);
  let tPrev = 0;
  for (let i = 1; i < V.length; i++) {
    const A = V[i - 1], P = V[i];
    const d1 = [P[0] - A[0], P[1] - A[1]], l1 = Math.hypot(d1[0], d1[1]); d1[0] /= l1; d1[1] /= l1;
    segs.push({ ax: A[0], ay: A[1], dx: d1[0], dy: d1[1], len: l1, sA: s - tPrev });
    if (i === V.length - 1) { push(P[0], P[1]); break; }
    const B = V[i + 1];
    const d2 = [B[0] - P[0], B[1] - P[1]], l2 = Math.hypot(d2[0], d2[1]); d2[0] /= l2; d2[1] /= l2;
    const th = Math.acos(clamp(d1[0] * d2[0] + d1[1] * d2[1], -1, 1));
    if (th < 1e-4) { push(P[0], P[1]); tPrev = 0; continue; }
    const tl = r * Math.tan(th / 2);
    const T1 = [P[0] - d1[0] * tl, P[1] - d1[1] * tl];
    const side = Math.sign(d1[0] * d2[1] - d1[1] * d2[0]);
    const C = [T1[0] - d1[1] * r * side, T1[1] + d1[0] * r * side];
    push(T1[0], T1[1]);
    const a0 = Math.atan2(T1[1] - C[1], T1[0] - C[0]);
    const n = Math.max(4, Math.ceil(th / (Math.PI / 32)));
    for (let k = 1; k <= n; k++) { const a = a0 + side * th * k / n; push(C[0] + Math.cos(a) * r, C[1] + Math.sin(a) * r); }
    tPrev = tl;
  }
  return { pts, L, len: s, segs };
}
function pointAt(p, s) {
  s = clamp(s, 0, p.len);
  let lo = 0, hi = p.L.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (p.L[m] < s) lo = m; else hi = m; }
  const k = (s - p.L[lo]) / ((p.L[hi] - p.L[lo]) || 1), a = p.pts[lo], b = p.pts[hi];
  return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
}
/* 元の辺 k の上の点 (x,y) の弧長 */

const LOGO_N = [[8, 74], [62, 16], [118, 24], [176, 84]];
const LOGO_S = [[58, 94], [118, 60], [158, 22], [232, 12]];
const bez = (p, u) => { const v = 1 - u; return [v*v*v*p[0][0] + 3*v*v*u*p[1][0] + 3*v*u*u*p[2][0] + u*u*u*p[3][0], v*v*v*p[0][1] + 3*v*v*u*p[1][1] + 3*v*u*u*p[2][1] + u*u*u*p[3][1]]; };
const SAND = (() => { const pts = [], L = [0]; for (let i = 0; i <= 2000; i++) { const p = bez(LOGO_S, i / 2000); if (i) L.push(L[i - 1] + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1])); pts.push(p); } return { pts, L, len: L[2000] }; })();
const SAND_CROSS = 86.91;                        // 交点までの弧長(vb)
/* 交点 vb (132.02, 48.48) を解き直して弧長を合わせる */
(() => {
  let best = 1e9, bi = 0;
  for (let i = 0; i <= 2000; i++) { const p = SAND.pts[i]; for (let j = 0; j <= 400; j++) { const q = bez(LOGO_N, j / 400); const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < best) { best = d; bi = i; } } }
  SAND.cross = SAND.L[bi];
})();
/* 交差は着地のあと約 4 フレーム止めて見せる(13.1875 まで)。引き戻しの最初の 0.06 秒は quadIn で速さを合わせ、
   止まった状態から 1 フレームで最高速にならないようにする(砂の線が淡くならない) */
const PULL0 = 13.1875, PULL1 = 13.7109375, BEND0 = 12.7734375;
function pullEase(t) {
  const u = clamp((t - PULL0) / (PULL1 - PULL0)), r = 0.06 / (PULL1 - PULL0);
  const w = (u < r ? u * u / (2 * r) : u - r / 2) / (1 - r / 2);
  return E.expoOut(w);
}
function markSpace(t) {                           // 画面 = O + s·vb
  if (t < PULL0) return { ox: 360, oy: 265, s: 5 };
  const e = pullEase(t);
  const s = lerp(5, 1.30909, e);
  return { ox: 487.2 - 25.443 * s, oy: 540.0 - 55.0 * s, s };   // 引き戻しの不動点 画面 (487.2, 540)。ロックアップの縦の中心が 540
}
function sandLen(t) {
  if (t < 12.890625) return 0;
  if (t < 13.125) return SAND.cross * Math.pow((t - 12.890625) / 0.234375, 3);
  return SAND.cross + (SAND.len - SAND.cross) * seg(t, 13.125, 0.66943359375, E.expoOut);
}
const markStroke = t => t < PULL0 ? 6 : lerp(6, 7.855, pullEase(t));

function finale(t, P) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const M = markSpace(t), lw = markStroke(t);
  const toS = p => [M.ox + p[0] * M.s, M.oy + p[1] * M.s];
  // 藍: 地平線の 4 点が公式の曲線へ
  let N;
  if (t < 13.0078125) {
    const e = seg(t, BEND0, 13.0078125 - BEND0, E.sineInOut);   // 原則が沈み終わってから、目で追える速さで持ち上がる
    const A = [[-20, 620], [633.3, 620], [1286.7, 620], [1940, 620]];
    const T = LOGO_N.map(p => [360 + p[0] * 5, 265 + p[1] * 5]);
    N = A.map((a, i) => [lerp(a[0], T[i][0], e), lerp(a[1], T[i][1], e)]);
  } else N = LOGO_N.map(toS);
  ctx.strokeStyle = P.line; ctx.lineWidth = lw;
  ctx.beginPath(); ctx.moveTo(N[0][0], N[0][1]); ctx.bezierCurveTo(N[1][0], N[1][1], N[2][0], N[2][1], N[3][0], N[3][1]); ctx.stroke();
  N.forEach((p, i) => mv('n' + i, p[0], p[1]));
  // 砂: 自分の始点から。交点を 13.125 ちょうどに通る(藍の上に描く)
  const sl = sandLen(t);
  if (sl > 0) {
    ctx.strokeStyle = P.sand; ctx.beginPath();
    let last = null;
    for (let i = 0; i < SAND.pts.length; i++) {
      if (SAND.L[i] > sl) break;
      const q = toS(SAND.pts[i]); if (!last) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]); last = i;
    }
    // 端をちょうど弧長 sl に
    let lo = 0, hi = SAND.L.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (SAND.L[m] < sl) lo = m; else hi = m; }
    const k = (sl - SAND.L[lo]) / ((SAND.L[hi] - SAND.L[lo]) || 1), e = toS([lerp(SAND.pts[lo][0], SAND.pts[hi][0], k), lerp(SAND.pts[lo][1], SAND.pts[hi][1], k)]);
    if (last == null) { const s0 = toS(SAND.pts[0]); ctx.moveTo(s0[0], s0[1]); }
    ctx.lineTo(e[0], e[1]); ctx.stroke();
    mv('sand', e[0], e[1]);
  }
  mv('mk0', toS([0, 0])[0], toS([0, 0])[1]); mv('mk1', toS([240, 110])[0], toS([240, 110])[1]);
  signoff(t, P);
}
function signoff(t, P) {
  if (t < 13.359375) return;
  // BRIDGE: 字間 0.80em → 0.34em(左端を固定)。名前の席は置かず、ロゴの交差と余白で終える(第24条の2)
  const fw = F.en(500, 112), Lw = layout('BRIDGE', fw, 112 * 0.34);
  const lsNow = lerp(0.80, 0.34, seg(t, 13.359375, 0.60, E.ease));
  const aW = seg(t, 13.359375, 0.234375, E.cubicOut);
  ctx.save(); ctx.globalAlpha = aW; ctx.textRendering = 'geometricPrecision';
  drawGlyphs(Lw, 867, 581, P.t1, i => ({ dx: i * (lsNow - 0.34) * 112 }));
  if (lsNow > 0.341) mv('wm', 867 + 5 * (lsNow - 0.34) * 112, 581);
  ctx.restore();
}


let LINE_STREAK = 60;
const LINE_ONLY = [[8.4375, 9.609375, 60], [12.65625, 13.1875, 60], [13.1875, 13.7109375, 24]];   // 引き戻し(縮むだけで繰り返しの模様がない)は 24px まで
const shutterFor = (v, t) => {
  if (v <= 0) return 0;
  const w = LINE_ONLY.find(([a, b]) => t >= a && t < b);
  return w ? Math.min(0.5, (w[2] === 60 ? LINE_STREAK : w[2]) / v) : 0.5;
};
const samplesFor = (v, t) => clamp(Math.ceil(v * shutterFor(v, t) / (typeof SAMPLE_STEP === 'function' ? SAMPLE_STEP(t) : 1.5)), 1, 64);   // 別案: 案ごとにサンプル間隔を替えられる(既定は v3 と同じ 1.5px)

let GL = null;
function initGL() {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const gl = c.getContext('webgl2', { preserveDrawingBuffer: true, antialias: false, premultipliedAlpha: false, alpha: false });
  if (!gl.getExtension('EXT_color_buffer_float')) throw new Error('EXT_color_buffer_float がない');
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s)); return s; };
  const prog = (vs, fs) => { const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p); return p; };
  const VS = flip => `#version 300 es
    in vec2 p; out vec2 uv; void main(){ uv = vec2(p.x * .5 + .5, ${flip ? '.5 - p.y * .5' : 'p.y * .5 + .5'}); gl_Position = vec4(p, 0., 1.); }`;
  const acc = prog(VS(false), `#version 300 es
    precision highp float; in vec2 uv; out vec4 o; uniform sampler2D prev, src; uniform float w;
    void main(){ o = texture(prev, uv) + texture(src, uv) * w; }`);
  const res = prog(VS(true), `#version 300 es
    precision highp float; in vec2 uv; out vec4 o; uniform sampler2D acc;
    vec3 enc(vec3 c){ c = clamp(c, 0., 1.); return mix(c * 12.92, 1.055 * pow(c, vec3(1. / 2.4)) - .055, step(.0031308, c)); }
    void main(){ o = vec4(enc(texture(acc, uv).rgb), 1.); }`);
  const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  for (const p of [acc, res]) { const l = gl.getAttribLocation(p, 'p'); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, 2, gl.FLOAT, false, 0, 0); }
  const tex = (ifmt, fmt, type) => {
    const t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (ifmt) gl.texImage2D(gl.TEXTURE_2D, 0, ifmt, W, H, 0, fmt, type, null);
    return t;
  };
  const accT = [tex(gl.RGBA32F, gl.RGBA, gl.FLOAT), tex(gl.RGBA32F, gl.RGBA, gl.FLOAT)];
  const fbo = accT.map(t => { const f = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, f); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0); return f; });
  const srcT = tex(null);
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false);
  gl.viewport(0, 0, W, H);
  return { c, gl, acc, res, accT, fbo, srcT };
}
function renderFrame(t, maxSamples = 64) {
  const v = speedPx(t), n = Math.min(maxSamples, samplesFor(v, t));
  if (n <= 1) { draw(t); window.REEL.out = canvas; window.REEL.lastN = 1; return 1; }
  if (!GL) GL = initGL();
  const { gl, acc, res, accT, fbo, srcT } = GL;
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[0]); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
  let cur = 0;
  gl.useProgram(acc);
  gl.uniform1i(gl.getUniformLocation(acc, 'prev'), 0); gl.uniform1i(gl.getUniformLocation(acc, 'src'), 1); gl.uniform1f(gl.getUniformLocation(acc, 'w'), 1 / n);
  const shutter = shutterFor(v, t) / FPS;
  for (let i = 0; i < n; i++) {
    draw(t + shutter * ((i + .5) / n - .5));
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, srcT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.SRGB8_ALPHA8, gl.RGBA, gl.UNSIGNED_BYTE, canvas);   // 線形光で読む
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, accT[cur]);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo[1 - cur]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    cur = 1 - cur;
  }
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.useProgram(res); gl.uniform1i(gl.getUniformLocation(res, 'acc'), 0);
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, accT[cur]);
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  window.REEL.out = GL.c; window.REEL.lastN = n;
  return n;
}

