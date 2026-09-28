/* ================================================================
   「名前になる」の描く層とカメラ(reel.html が読む)。時刻 t だけで 1 枚が決まる
   0〜2.34      夜の帯。「体交してただけ」が一字ずつ組み上がり、大きいまま 0.586 まで保つ → 打点で字は退き、下線は弧になる → 光が渡り言いかえが立つ
   2.34〜3.28   一段下へ送って、もう一組(いつもと違うのに気づいた)。組はゆっくり上へ流れ続ける(止まらない)
   3.28〜3.98   弧が光ごと左端へ巻き戻り、縦に立って拭いの縁になる。字は一行に組まれて実物の行に重なる(一致カット)
   3.98〜7.5    実物(list9): 行へ寄り、寄り切りで行を開く → 成り立つ条件を通りながら「なら」 → 星だけの寄りで押す → 引いて知らせ → 行へ押し込む
   7.5          一致カット: 一覧の「いつもと違う」の行と、あつめた言葉の同じ行を、同じ画面の位置のまま入れ替える
   7.5〜10.66   実物(saved6 → name13): コピーの釦へ寄って押す → 上へ振って道具の名前だけ → 引いて名前・見出し・罫・行を一つの画に
   10.66〜12.656 実物(pair13): 行の頭「いつもと違うのに気づいた」へ飛び込み、罫を画面の同じ高さに留めたまま矢印の向きへ一振りして、言いかえに着く。
                言いかえを大きいまま見せ、引きながら矢印を枠に入れる。罫は一定の速さで降り続け、切り替えで finale の線になる
   12.656〜     v3 の finale(罫が藍の線になり、弧に曲がって砂の線と交わり、ロゴと BRIDGE)。ロゴに光や字間の動きは足さない
   実物の画は capture.mjs が撮り、compose.py がカメラ(camPage)どおりに縦横同じ倍率で切り出す。画素は変えない。写しの上には何も描かない
   ================================================================ */
const NIGHT = '#131A2A', NT1 = '#EFECE4', NT2 = '#8E93A3', NAVY_D = '#D8DEEB', GLINT = '#FFFFFF';
const JP = (w, s) => `${w} ${s}px "Noto Sans JP"`;
const MIN = (s) => `600 ${s}px "Shippori Mincho B1"`;
let MEAS3 = null;

const FS = 12.65625, FSHIFT = 12.65625 - FS;           // finale は前の裁定の拍 27(ロゴの保持は約 1.0 秒)
const CUTS = [0, 7.5, FS, 15.0001];
let FRAME_T = null;
function segOf(t) { for (let i = 0; i < CUTS.length - 1; i++) if (t < CUTS[i + 1]) return [CUTS[i], CUTS[i + 1]]; return [CUTS[CUTS.length - 2], 15.0001]; }
function clampSeg(t) { if (FRAME_T == null) return t; const [a, b] = segOf(FRAME_T + 1e-9); return Math.min(Math.max(t, a), b - 1e-7); }
function sim(t, a, d, k0, k1, ease) {
  const e = seg(t, a, d, ease);
  if (Math.abs(k0.z - k1.z) < 1e-9) return { x: lerp(k0.x, k1.x, e), y: lerp(k0.y, k1.y, e), z: k0.z };
  const z = Math.pow(k0.z, 1 - e) * Math.pow(k1.z, e);
  const px = (k1.x * k1.z - k0.x * k0.z) / (k1.z - k0.z), py = (k1.y * k1.z - k0.y * k0.z) / (k1.z - k0.z);
  return { x: px - (px - k0.x) * k0.z / z, y: py - (py - k0.y) * k0.z / z, z };
}
const mix = (c0, c1, u) => { const p = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); const a = p(c0), b = p(c1); return `rgb(${a.map((v, i) => Math.round(lerp(v, b[i], u))).join(',')})`; };
const whipEase = u => u < 0.5 ? E.cubicIn(u * 2) / 2 : 0.5 + E.expoOut((u - 0.5) * 2) / 2;
// 叩き: t0 から up 秒で ×k(expoOut)、down 秒で ×1 へ(sineInOut)
function punch(t, t0, k, up, down) { if (t < t0) return 1; if (t < t0 + up) return Math.pow(k, E.expoOut((t - t0) / up)); return Math.pow(k, 1 - E.sineInOut(clamp((t - t0 - up) / down))); }

/* ---- 字を置く(1 字ずつ。per(i) で dx・dy・a(不透明度)・hide) ---- */
function glyphs(str, font, x, y, color, opt = {}) {
  ctx.save();
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.textRendering = 'geometricPrecision';
  const a0 = ctx.globalAlpha * (opt.alpha != null ? opt.alpha : 1);
  let cx = x; const chars = [...str];
  chars.forEach((ch, i) => {
    const d = opt.per ? opt.per(i) : null, w = ctx.measureText(ch).width;
    if (d && d.hide) { cx += w; return; }
    const dx = d ? d.dx || 0 : 0, dy = d ? d.dy || 0 : 0;
    ctx.globalAlpha = a0 * (d && d.a != null ? clamp(d.a) : 1);
    if (ctx.globalAlpha > 0.001) ctx.fillText(ch, cx + dx, y + dy);
    if (opt.id) mv(opt.id + i, cx + dx, y + dy);
    cx += w;
  });
  ctx.restore();
}
const charXs = (str, font, x0) => { ctx.save(); ctx.font = font; let x = x0; const xs = [...str].map(ch => { const w = ctx.measureText(ch).width, c = x + w / 2; x += w; return c; }); ctx.restore(); return xs; };

/* ================================================================ 藍の弧と光 */
const ARC = LOGO_N.map(([x, y]) => [163 + (x - 8) * (1529 / 168), 540 + (y - 79) * (80 / 51)]);   // 横は名前の墨の両端(約 163〜1691)と同じ幅。寄っても弧と光のにじみが x 96〜1824 に収まる(designer 必須 1)
const ARCL = (() => { const pts = [], L = [0]; for (let i = 0; i <= 1000; i++) { const p = bez(ARC, i / 1000); if (i) L.push(L[i - 1] + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1])); pts.push(p); } return { pts, L, len: L[1000] }; })();
function arcAt(s) {                                        // 弧長の割合 s(0〜1)の点
  const d = clamp(s) * ARCL.len; let lo = 0, hi = 1000; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (ARCL.L[m] < d) lo = m; else hi = m; }
  const k = (d - ARCL.L[lo]) / ((ARCL.L[hi] - ARCL.L[lo]) || 1), a = ARCL.pts[lo], b = ARCL.pts[hi]; return [lerp(a[0], b[0], k), lerp(a[1], b[1], k)];
}
function sAtX(x) { let lo = 0, hi = 1; for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (arcAt(m)[0] < x) lo = m; else hi = m; } return (lo + hi) / 2; }
function arcPath(P, s0, s1) {                             // P(u) の点列を弧長 s0〜s1 で結ぶ(P は弧の上の点を返す関数)
  const n = Math.max(2, Math.ceil((s1 - s0) * 160));
  ctx.beginPath(); for (let i = 0; i <= n; i++) { const q = P(lerp(s0, s1, i / n)); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); }
}
// 下線(大きな字の下の直線)から弧へ。m = 0 で直線、1 で弧
const ULINE = [[160, 640], [160 + 1232 / 3, 640], [160 + 2464 / 3, 640], [1392, 640]];
function byLength(P) {                                    // 曲線 P を弧長で引く関数にする
  const n = 240, pts = [], L = [0];
  for (let i = 0; i <= n; i++) { const p = bez(P, i / n); if (i) L.push(L[i - 1] + Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1])); pts.push(p); }
  return s => { const d = clamp(s) * L[n]; let lo = 0, hi = n; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] < d) lo = m; else hi = m; } const k = (d - L[lo]) / ((L[hi] - L[lo]) || 1); return [lerp(pts[lo][0], pts[hi][0], k), lerp(pts[lo][1], pts[hi][1], k)]; };
}
function lineAt(m) { if (m >= 1) return arcAt; return byLength(ARC.map((p, i) => [lerp(ULINE[i][0], p[0], m), lerp(ULINE[i][1], p[1], m)])); }
function strokeLine(P, s0, s1, color, lw) { if (s1 - s0 < 1e-4) return; ctx.save(); ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.lineCap = 'round'; arcPath(P, s0, s1); ctx.stroke(); ctx.restore(); }
function glint(P, head, tail, lw, peak = 1) {             // 光: head から後ろ tail(弧長の割合)へ薄れる明るい線と、頭の点
  const K = 10;
  for (let k = 0; k < K; k++) {
    const a = head - tail * (k + 1) / K, b = head - tail * k / K; if (b <= 0) continue;
    ctx.save(); ctx.globalAlpha *= peak * Math.pow(1 - k / K, 1.6); ctx.strokeStyle = GLINT; ctx.lineWidth = lw * 1.25; ctx.lineCap = 'round';
    arcPath(P, Math.max(0, a), Math.min(1, b)); ctx.stroke(); ctx.restore();
  }
  const q = P(clamp(head));
  ctx.save(); ctx.globalAlpha *= peak * 0.22; ctx.fillStyle = GLINT; ctx.beginPath(); ctx.arc(q[0], q[1], lw * 4.2, 0, Math.PI * 2); ctx.fill(); ctx.restore();   // 目で追える大きさの光
  ctx.save(); ctx.globalAlpha *= peak; ctx.fillStyle = GLINT; ctx.beginPath(); ctx.arc(q[0], q[1], lw * 2.3, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  mv('gl', q[0], q[1]);
}

/* ================================================================ 夜の帯の組と時刻 */
const PAIRS = [
  ['体交してただけ', '状態に合わせた体位管理と褥瘡予防'],
  ['いつもと違うのに気づいた', 'わずかな変化への気づきと早期報告'],
];
const DY = 700;                                           // 組を縦に積む間隔(ワールド)。前の組の名前と次のことばが組に見えない広さ(組の中の間 160 の 2 倍余り)
const HIT0 = 0.5859375;                                   // 大きいことばを保ってから退く打点(拍 1.25)
const UL0 = 0.05, UL1 = 0.35;                             // 下線を引く(大きいことばの下で)
const PASS0 = 0.9375, PASS1 = 1.171875;                   // 一組目: 光が渡る(名前は光を追って立つ)
const DRIFT0 = 1.640625, DRIFT1 = 2.2265625;              // 一組目を読ませる間に、光がもう一度ゆっくり渡る(止まりの規則・直し 10)
const SW = [2.34375];                                     // 送り(拍 5)。一組目を長く読ませ、二組目で実物へ
const LAST = 1;                                           // 実物の行へ組まれる組
const TILT = 0.25;                                        // 一段下へ送る時間
const DRAW0 = 0.10, DRAW = [0.22], RISE = [0.22];   // 新しい組の弧を引く光と、名前が立つ速さ
const RET0 = 3.28125, RET1 = 3.45703125;                  // 弧が左端へ巻き戻る
const FOLD0 = 3.45703125, FOLD1 = 3.75;                   // 字が一行に組まれる(弧が巻き戻り終えてから。字が弧を横切らない)
const WIPE0 = 3.75, WIPE1 = 4.1015625, WX0 = 20;          // 拭い(0.35 秒。実物は拍 8 の 3.75 から出る。縁が画面の中央を通るのは 3.93)
const EDGE = x0 => [[x0, -40], [x0 + 70, 330], [x0 + 70, 750], [x0, 1120]];
const wipeX = t => t < WIPE0 ? WX0 : lerp(WX0, 2000, E.cubicInOut(clamp((t - WIPE0) / (WIPE1 - WIPE0))));
const DRIFT_V = 90;                                       // 名前が立ったあとの上への流れ(ワールド px/秒)。止まりの規則(直し 10)を寄りではなく縦の流れで満たす(designer)
const vScroll = t => SW.reduce((v, s) => v + DY * E.cubicInOut(clamp((t - s) / TILT)), 0) + DRIFT_V * clamp(t - PASS1, 0, FOLD0 - PASS1);
const pairAt = t => SW.filter(s => t >= s).length;
const arcOf = p => s => { const q = arcAt(s); return [q[0], q[1] + p * DY]; };
let CHAR_T = null;                                        // 組ごとの、名前の字が立ち始める時刻
function buildCharTimes() {
  const inv = { cubicOut: s => 1 - Math.cbrt(1 - clamp(s)), sine: s => Math.acos(1 - 2 * clamp(s)) / Math.PI };
  CHAR_T = PAIRS.map(([, name], p) => charXs(name, MIN(96), 160).map(xc => {
    const s = sAtX(xc);
    if (p === 0) return PASS0 + (PASS1 - PASS0) * inv.sine(s) - 0.02;
    return SW[p - 1] + DRAW0 + DRAW[p - 1] * inv.cubicOut(s);
  }));
}
// 組の濃さ: 次の送りで 30% へ(送りの前半で落とす)。組み替えのあいだに、残っている前の組は消える
function pairAlpha(p, t) {
  let a = 1;
  if (p < SW.length && t >= SW[p]) a = lerp(1, 0.3, E.cubicOut(clamp((t - SW[p]) / (TILT * 0.6))));
  if (p < LAST && t >= RET0) a *= 1 - clamp((t - RET0) / (RET1 - RET0));
  return a;
}

/* ---- 夜のカメラ: 二段の寄り + 横の流し + 縦の送り + 2.0 から組み替えまで ×1.06 の寄り ---- */
function cam1(t) { const s1 = 1 + 0.04 * clamp(t / 1.06), s2 = t < 1.06 ? 1 : 1 + 0.08 * E.sineInOut(clamp((t - 1.06) / (SW[0] - 1.06))); return { s1, s2 }; }   // 描いた字の墨を x 96〜1824 に収める(designer 必須 3)
function nightMat(t) {
  t = Math.min(t, FOLD0);                                 // 組み替えのあいだは FOLD0 で止める(字はそこから画面の座標で動く)
  const { s1, s2 } = cam1(Math.min(t, SW[0]));
  const S2 = t >= SW[0] ? 1 + (s2 - 1) * (1 - E.expoOut(clamp((t - SW[0]) / 0.25))) : s2;
  const pan = 0;
  const a = S2 * s1, e = S2 * (160 - s1 * 160 + pan) + 928 - S2 * 928, f = S2 * (600 - s1 * 600) + 670 - S2 * 670;
  let k = 1 + 0.03 * E.sineInOut(clamp((t - SW[0]) / (FOLD0 - SW[0])));
  SW.forEach(s => { if (t >= s) k *= 1 + 0.01 * E.expoOut(clamp((t - s) / 0.35)); });
  const V = vScroll(t), A = k * a;
  return { a: A, b: 0, c: 0, d: A, e: k * (e - 960) + 960, f: k * (f - a * V - 540) + 540, th: 0, sc: A };
}
function setNight(t) {
  const M = nightMat(t); ctx.setTransform(M.a, M.b, M.c, M.d, M.e, M.f);
  [[0, 0], [W, 0], [0, H], [W, H]].forEach((p, i) => mv('c1' + i, (p[0] - M.e) / M.a, (p[1] - M.f) / M.d));
  return M;
}

/* ---- 現場のことば ---- */
function drawGenba(p, t) {
  if (p === 0) {
    const r = E.cubicOut(clamp((t - HIT0) / 0.32));          // expoOut だと打点直後の 1 コマの速さが大きく、ぼけで字が崩れる
    const size = 176 * Math.pow(80 / 176, r), base = lerp(600, 380, r), col = mix(NT1, NT2, r);
    glyphs(PAIRS[0][0], JP(700, size), 160, base, col, { id: 'g', per: i => { const s = i * 0.025 - 0.08; if (t < s) return { hide: true }; const e = E.cubicOut(clamp((t - s) / 0.18)); return { dy: 28 * (1 - e) * (1 - r), a: e }; } });
    return;
  }
  if (t < SW[p - 1]) return;
  glyphs(PAIRS[p][0], JP(700, 80), 160, 380 + p * DY, NT2, { id: 'g' + p + '_', alpha: E.cubicOut(clamp((t - SW[p - 1]) / 0.12)) });
}
/* ---- 名前。見えない床の下から、光を追って一字ずつ立つ ---- */
function drawName(p, t) {
  const R = p === 0 ? 0.30 : RISE[p - 1], floor = 724 + p * DY;
  ctx.save(); ctx.beginPath(); ctx.rect(-4000, -40000, 12000, floor + 40000); ctx.clip();
  glyphs(PAIRS[p][1], MIN(96), 160, 700 + p * DY, NT1, { id: 'n' + p + '_', per: i => { const s = CHAR_T[p][i]; if (t < s) return { hide: true }; return { dy: 120 * (1 - E.expoOut(clamp((t - s) / R))) }; } });
  ctx.restore();
}
/* ---- 弧と光 ---- */
function drawArcOf(p, t) {
  let P, s1;
  if (p === 0) {
    if (t < UL0) return;
    P = lineAt(E.expoOut(clamp((t - HIT0) / 0.30)));
    s1 = E.cubicOut(clamp((t - UL0) / (UL1 - UL0)));
  } else {
    const t0 = SW[p - 1] + DRAW0; if (t < t0) return;
    P = arcOf(p); s1 = E.cubicOut(clamp((t - t0) / DRAW[p - 1]));
  }
  if (p === LAST && t >= RET0) s1 = 1 - E.cubicIn(clamp((t - RET0) / (RET1 - RET0)));
  if (p === LAST && t >= RET1) return;
  strokeLine(P, 0, s1, NAVY_D, 6); mv('arc' + p, ...P(s1));
  const drawing = p === 0 ? t < UL1 : t < SW[p - 1] + DRAW0 + DRAW[p - 1];
  if (drawing) glint(P, s1, 0.10, 6);                                      // 線を引く光(名前はこの光を追って立つ)
  else if (p === LAST && t >= RET0) glint(P, s1, 0.06, 6);                 // 巻き戻る先の光
  if (p === 0 && t >= PASS0 && t < PASS1 + 0.12) { const h = E.sineInOut(clamp((t - PASS0) / (PASS1 - PASS0))), fade = t > PASS1 ? 1 - (t - PASS1) / 0.12 : 1; glint(P, h, 0.12, 6, fade); }
  if (p === 0 && t >= DRIFT0 && t < DRIFT1 + 0.12) { const h = E.sineInOut(clamp((t - DRIFT0) / (DRIFT1 - DRIFT0))), fade = t > DRIFT1 ? 1 - (t - DRIFT1) / 0.12 : 1, endK = 1 - E.sineInOut(clamp((h - 0.93) / 0.07)); glint(P, h, 0.18, 6, 0.55 * fade * endK); }   // 2 度目の光は弧の右端の手前で消える(寄り ×1.08 のさなかに光のにじみが x 1824 を越えないように)
  if (p > 0) { const t1 = SW[p - 1] + DRAW0 + DRAW[p - 1]; if (t >= t1 && t < t1 + 0.12) { ctx.save(); ctx.globalAlpha *= 1 - (t - t1) / 0.12; glint(P, 1, 0.10, 6); ctx.restore(); } }
}
function drawPair(p, t) {
  const a = pairAlpha(p, t); if (a <= 0.001) return;
  ctx.save(); ctx.globalAlpha *= a;
  drawGenba(p, t); drawName(p, t); drawArcOf(p, t);
  ctx.restore();
}
function sceneNight(t) { setNight(t); for (let p = 0; p < PAIRS.length; p++) if (p === 0 || t >= SW[p - 1]) drawPair(p, t); }

/* ================================================================ ページ座標のカメラ。中心 (x,y) と倍率 z。画面 = (p − (x,y))·z + (960,540) */
function zoomAbout(c, P, k) { const z = c.z * k, S = [(P[0] - c.x) * c.z + 960, (P[1] - c.y) * c.z + 540]; return { x: P[0] + (960 - S[0]) / z, y: P[1] + (540 - S[1]) / z, z }; }
function placeAt(P, S, z) { return { x: P[0] + (960 - S[0]) / z, y: P[1] + (540 - S[1]) / z, z }; }
const toScreen = (c, px, py) => [(px - c.x) * c.z + 960, (py - c.y) * c.z + 540];

/* 一覧(list9。ビューポート 1440×900)。何も開いていない行 → 「いつもと違う」を開く → 星 */
const L0 = { x: 622, y: 644, z: 4.0 };                    // 閉じた行(字は 56px)。枠 x 382〜862・y 509〜779(7 行目「入浴拒否…」の字 780.6 に届かない)
const ROWC = [622, 680];
const L1A = { x: 665.5, y: 688, z: 3.65 }, L1 = { x: 665.5, y: 725, z: 3.65 };   // 開いた行と文例・条件・場面。文例の行(416〜915)が横に切れずに入る幅。上から下へ 1 拍 約 90px で流して読ませる(止めない)。枠 y 540〜836 → 577〜873
const JOKC = [665.5, 752];
const C1S = { x: 1042.3, y: 680.6, z: 7.6 };              // 星だけの寄り(星は画面 (669, 540)・約 145px)。枠 x 916〜1168.6・y 609.5〜751.7。文例の行末 915 と字のない帯
const STAR1 = [1004, 680.6];
const STARW = { x: 720, y: 700, z: 3.0 };                 // 行・金の星・知らせが一つの画に入る。枠 x 400〜1040・y 520〜880(どの行も枠の中で切れない)
const MATCH = [416, 666.6];                               // 一致カットの不動点(いつもと違うの字の左上。あつめた言葉では y 227.62)
const DELTA = 666.6 - 227.62;                             // 一覧の行と、あつめた言葉の同じ行の縦の差(同じ書体・同じ左端 416)
const OPEN = 4.453125, PAN0 = 4.5, AT_J = 4.921875, NARA_T = 5.390625, GO_STAR = 5.625, AT_STAR = 5.859375;
const TAP1 = 6.09375, BACK0 = 6.4453125, BACK1 = 6.796875, CUT1 = 7.5, PUSH_END = 7.96875;
const TAPS = [TAP1];
const pushM = t => zoomAbout(STARW, MATCH, 1 + 0.35 * clamp((t - BACK1) / (PUSH_END - BACK1)));   // 行へ押し込む(1 拍 約 0.2)。一致カットをまたいで続く
function pageCamList(t) {
  if (t < OPEN) return zoomAbout(L0, ROWC, 1 + 0.12 * clamp((t - WIPE0) / (OPEN - WIPE0)));             // 着いたら止めずに寄り、開く瞬間に寄り切る
  const L0e = zoomAbout(L0, ROWC, 1.12);
  if (t < AT_J) return zoomAbout(sim(t, PAN0, AT_J - PAN0, L0e, L1A, E.sineInOut), ROWC, punch(t, OPEN, 1.035, 3 / 60, 0.25));
  const J = tt => sim(tt, AT_J, GO_STAR - AT_J, L1A, L1, E.lin);
  if (t < GO_STAR) return zoomAbout(J(t), JOKC, punch(t, NARA_T, 1.02, 0.1, 0.2));                 // 条件の行を通りながら「なら」(叩きは小さく。文例の行を切らない)
  if (t < AT_STAR) return sim(t, GO_STAR, AT_STAR - GO_STAR, L1, C1S, whipEase);                 // 星だけの寄りへ振る
  const star = tt => zoomAbout(zoomAbout(C1S, STAR1, 1 + 0.08 * clamp((tt - AT_STAR) / (TAP1 - AT_STAR))), STAR1, punch(tt, TAP1, 1.2, 4 / 60, 0.3));   // 押す: ×1.2(4 フレーム)→ 0.3 秒で戻る
  if (t < BACK0) return star(t);
  if (t < BACK1) return sim(t, BACK0, BACK1 - BACK0, star(BACK0), STARW, E.cubicInOut);          // 引きながら知らせが画に入る
  return pushM(t);
}
/* あつめた言葉(saved6 → name13。ビューポート 1440×468: 撮れるのはビューポートの内だけ。知らせは釦の列の右(395〜440)に出て、注意の一文(441.9〜)より上に収まる) */
const COPYF = { x: 720, y: 441 - 540 / 3.0, z: 3.0 };     // 見出し・行・文例・外す・釦・知らせが切れずに入る。枠 x 400〜1040・y 81〜441
const COPYC = [412, 441], COPY_T = 8.4375,   /* 寄りの不動点は釦の左端と枠の下辺(釦と知らせを切らない) */ WHIP0 = 9.140625, NAME_T = 9.375, NAME_END = 10.3125, G0_AT = 10.6640625;
const NAMEP = [586.9, 42.25], NAME_S = [1900, 403];      // 「帳」の墨の右端を画面 (1900, 403) に留めて寄る(designer 必須 2)。名前の墨 412.7〜586.9、見出しの墨 114.25〜、IIKAE 597.9〜(実測)
const nameCam = z => ({ x: NAMEP[0] + (960 - NAME_S[0]) / z, y: NAMEP[1] + (540 - NAME_S[1]) / z, z });
const NM = nameCam(9.56), N1 = nameCam(10.78);            // z 9.56(枠 y 0.1〜113.1・名前は画面 234〜1900)→ 10.78(y 4.9〜105・名前は 22〜1900)
const G0 = { x: 620, y: 135, z: 4.0 };                    // 名前・見出し・罫・行が一つの画に入る(直し 7)。枠 x 380〜860・y 0〜270
const NAME_CLIP = { x: 340, y: 0, w: 480, h: 300 };       // name13 の撮る範囲
/* ---- 罫の下で言いかえる(拍 22.75〜27) ----
   拍 22.75 G0(直し 7: 名前・見出し・罫・行が一つの画に)→ 23.5 行の頭へ飛び込む →「いつもと違うのに気づいた」(133px。右へ流れ続ける)
   → 24.5〜25 矢印の向きへ一振り。両端で罫を同じ画面 y 438.5 に置くので不動点が罫の上に来て、罫は留まり字だけが入れ替わる
   → 25「わずかな変化への気づきと早期報告」(115px)。あとは kotCam */
const PAIR_CLIP = { x: 340, y: 0, w: 700, h: 300 };       // pair13 の撮る範囲
const PAIR13 = true;                                      // pair13(13 倍)で撮った画を使う。false にすると saved6(6 倍)の拡大で代える(確かめ用の粗い通し)
const RULE_C = 187.5;                                     // 罫の墨の中心(撮った画の実測 187.0〜188.0)
const KW = [609.7, 261.5];                                // 言いかえの墨の左端 × 言いかえ(墨 〜248.5)と文例(墨 265.0〜)の間。引きと押し込みの不動点
const AT_GEN = 11.015625, SWING0 = 11.484375, AT_KOT = 11.71875, T_H = 12.3046875;   // 拍 23.5 / 24.5 / 25 / 26.25(行の頭を 0.47 秒、言いかえを大きいまま 0.59 秒見せ、最後の 3/4 拍で引きながら finale へ)
const Y_R = 438.5;                                        // 行を読むあいだの罫の画面 y(一振りの両端で同じ)。見出しの墨(〜139.33)と文例の墨(265.0〜)にどちらも 2 頁px の余白
const GEN_Z = 9.5, GEN_X = 496, GEN_V = 17;               // 行の頭: 枠 x 395〜597(着地)→ 403〜605(振りの前)・y 141.3〜255.0。右へ 17 頁px/秒(画面 2.7px/コマ。見せる時間を 2 倍にしたので、流れの量は同じ)
const KOT_Z = 8.5, KOT_M = 38;                            // 言いかえを左の余白 38px で(枠の下 263.0)
const onRule = (x, R, z) => ({ x, y: RULE_C + (540 - R) / z, z });   // 頁 x を画面の中心に、罫を画面 y R に置く
const genCam = t => onRule(GEN_X + GEN_V * (t - AT_GEN), Y_R, GEN_Z);
const KOT = onRule(KW[0] + (960 - KOT_M) / KOT_Z, Y_R, KOT_Z);
const DIVE_E = u => 0.1 * u + 0.9 * whipEase(clamp((u - 0.2) / 0.8));     // 引きで G0 に着いたら 0.07 秒だけじわりと寄り(直し 7 の一つの画)、0.28 秒で飛び込む(同じ頁へ戻って止まる画にしない)
/* 言いかえに着いてから(拍 25〜27): 罫は画面 y 438.5 から一定の速さ(2.75px/コマ)で降り続け、そのまま finale の線になって地平線 620 に着く。止まらない・跳ね返らない(動きの中の切り替え)
   拍 25〜26.25 は言いかえを大きいまま(z 8.5 → 8.67 へゆっくり寄る。115→117px)、拍 26.25〜27 は引きながら矢印を枠に入れて(editor: 言いかえだけを最後の画にしない)、切り替えで finale へ動きのまま渡す。
   finale の出だし(sceneH)は ×HAND_K0・HAND_DY0 から HAND_T 秒で ×1・0 へ。線の太さ(写しの罫 = z px)・位置・速さ・倍率の変わり方を、切り替えの前後でそろえる */
const PUSH_H = 1.02, Z_C = 6.5, YR_C = 593;               // 保持の寄り/切り替えのときの倍率(罫は画面で 6.5px)と罫の画面 y(文例の墨 265.0 を枠に入れない下限 589.3 の内)
const VR = (YR_C - Y_R) / (FS - AT_KOT);                  // 罫の降りる速さ(画面 164.8px/秒)
const HAND_K0 = Z_C / 6, HAND_DY0 = YR_C - 540 - 80 * HAND_K0, HAND_T = -(80 * (HAND_K0 - 1) + HAND_DY0) * 2 / VR;   // finale の出だし: ×1.083・−33.7px → 0.328 秒で ×1・0(quadOut)
const ZH = KOT_Z * PUSH_H, ZH_V = KOT_Z * (PUSH_H - 1) / (T_H - AT_KOT), ZC_V = -6 * (HAND_K0 - 1) * 2 / HAND_T;   // 引きの始めと終わりの倍率の速さ(保持の寄り/finale の縮み)
const KOT_X = KW[0] + (960 - KOT_M) / KOT_Z;              // 言いかえの中心(着いたときのカメラ x)
const L_ARROW = 583;                                      // 引きの終わりの枠の左辺(矢印の墨 約 588〜596.2 は入り、「た」〜575.7・「葉」〜574 は入らない)
const softMax0 = (v, e) => 0.5 * (v + Math.sqrt(v * v + e * e));
function kotCam(t) {
  let z;
  if (t < T_H) z = KOT_Z * (1 + (PUSH_H - 1) * (t - AT_KOT) / (T_H - AT_KOT));
  else {                                                  // 引き: 倍率を 3 次エルミートで(始めは保持の寄りの速さ、終わりは finale の縮みの速さ)
    const D = FS - T_H, s = clamp((t - T_H) / D), s2 = s * s, s3 = s2 * s;
    z = (2 * s3 - 3 * s2 + 1) * ZH + (s3 - 2 * s2 + s) * D * ZH_V + (-2 * s3 + 3 * s2) * Z_C + (s3 - s2) * D * ZC_V;
  }
  const yr = Y_R + VR * (t - AT_KOT);                     // 罫の画面 y
  const L = L_ARROW + softMax0(KOT_X - 960 / z - L_ARROW, 4);   // 言いかえを真ん中に保ち、枠の左辺が矢印の手前まで広がったら、そこで留める
  return { x: L + 960 / z, y: RULE_C - (yr - 540) / z, z };
}
function pageCamSaved(t) {
  if (t < PUSH_END) { const c = pushM(t); return { x: c.x, y: c.y - DELTA, z: c.z }; }
  const d = pushM(PUSH_END), D1 = { x: d.x, y: d.y - DELTA, z: d.z };
  const CF = k => zoomAbout(COPYF, COPYC, k);
  if (t < 8.203125) return sim(t, PUSH_END, 8.203125 - PUSH_END, D1, COPYF, E.cubicInOut);
  if (t < WHIP0) return zoomAbout(CF(1 + 0.25 * clamp((t - 8.203125) / (WHIP0 - 8.203125))), COPYC, punch(t, COPY_T, 1.06, 4 / 60, 0.25));   // 釦へ寄り続けて押す
  if (t < NAME_T) return sim(t, WHIP0, NAME_T - WHIP0, CF(1.25), NM, whipEase);
  if (t < NAME_END) return nameCam(lerp(9.56, 10.78, clamp((t - NAME_T) / (NAME_END - NAME_T))));   // 名前だけ 0.94 秒(E.lin。左の角は 1 拍 約 110px 動く)
  if (t < G0_AT) return sim(t, NAME_END, G0_AT - NAME_END, N1, G0, E.expoInOut);                 // 引いて、名前・見出し・罫・行を一つの画に(変えない)
  if (t < AT_GEN) return sim(t, G0_AT, AT_GEN - G0_AT, G0, genCam(t), DIVE_E);                   // じわりと寄って → 行の頭へ飛び込む(着いた先はもう右へ流れている)
  if (t < SWING0) return genCam(t);                                                              // いつもと違うのに気づいた
  if (t < AT_KOT) return sim(t, SWING0, AT_KOT - SWING0, genCam(t), KOT, whipEase);              // 一振り: 不動点は罫の上。罫は留まり、字だけが流れて入れ替わる
  return kotCam(t);                                                                              // 言いかえ → 引いて罫を降ろす → 押し込んで罫を持ち上げ、finale へ
}
function camPage(t) { return t < CUT1 ? pageCamList(t) : pageCamSaved(t); }
function TAKE_OF(n) {
  const t = n / 60; if (t < CUT1) return 'list9';
  // 枠(前後のサブフレームも)がその撮り直しの範囲に収まるか
  const fits = C => [t - 0.5 / 60, t, t + 0.5 / 60].every(ts => { const c = camPage(Math.min(ts, FS - 1e-6)); return c.x - 960 / c.z >= C.x && c.y - 540 / c.z >= C.y && c.x + 960 / c.z <= C.x + C.w && c.y + 540 / c.z <= C.y + C.h; });
  if (t >= WHIP0 && t <= G0_AT && fits(NAME_CLIP)) return 'name13';   // 振りの途中から名前のあいだ
  if (PAIR13 && t >= NAME_END && fits(PAIR_CLIP)) return 'pair13';    // 名前のあと(引きの速い所で name13 から替わる)は pair13(13 倍)
  return 'saved6';
}

/* ================================================================ 組み替え(4.04〜4.34)と拭い(4.34〜4.57) */
let TARGETS = null, SOURCES = null;
function buildTargets() {
  const asc = (font, ch) => { ctx.save(); ctx.font = font; const m = ctx.measureText(ch); ctx.restore(); return m.fontBoundingBoxAscent; };
  const g = MEAS3.closed, base = (list, font) => list.map(q => ({ ch: q.ch, x: q.x, y: q.y + asc(font, q.ch) }));
  TARGETS = { genba: base(g.genba.glyphs, JP(700, 14)), name: base(g.kotoba.glyphs, JP(400, 13.5)) };
  const a = g.arrow.glyphs[0]; TARGETS.arrow = { x: a.x, y: a.y + asc('400 13px "Inter"', '→') };
  if (TARGETS.genba.map(q => q.ch).join('') !== PAIRS[LAST][0] || TARGETS.name.map(q => q.ch).join('') !== PAIRS[LAST][1]) throw new Error('実測の字と組が合わない');
}
function buildSources() {
  const M = nightMat(FOLD0), toS = (x, y) => [M.a * x + M.c * y + M.e, M.b * x + M.d * y + M.f];
  const S = { genba: [], name: [] };
  ctx.save();
  let x = 160; ctx.font = JP(700, 80);
  for (const ch of PAIRS[LAST][0]) { const p = toS(x, 380 + LAST * DY); S.genba.push({ x: p[0], y: p[1], size: 80 * M.sc, th: M.th }); x += ctx.measureText(ch).width; }
  x = 160; ctx.font = MIN(96);
  for (const ch of PAIRS[LAST][1]) { const p = toS(x, 700 + LAST * DY); S.name.push({ x: p[0], y: p[1], size: 96 * M.sc, th: M.th }); x += ctx.measureText(ch).width; }
  ctx.restore(); SOURCES = S;
}
function scene3(t) {
  // 弧の巻き戻り(RET1 まで)は夜のカメラのまま描く
  if (t < RET1) { setNight(t); drawArcOf(LAST, t); }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const c = camPage(t), u = E.cubicInOut(clamp((t - FOLD0) / (FOLD1 - FOLD0)));
  const draw1 = (key, str, font, sizeT, colS, colT) => {
    [...str].forEach((ch, i) => {
      const s = SOURCES[key][i], d = TARGETS[key][i], p = toScreen(c, d.x, d.y);
      const size = s.size * Math.pow(sizeT * c.z / s.size, u), x = lerp(s.x, p[0], u), y = lerp(s.y, p[1], u);
      ctx.save(); ctx.translate(x, y); ctx.rotate(s.th * (1 - u));
      ctx.font = font(size.toFixed(3)); ctx.fillStyle = mix(colS, colT, u); ctx.textRendering = 'geometricPrecision';
      ctx.fillText(ch, 0, 0); ctx.restore(); mv(`r:${key}:${i}`, x, y);
    });
  };
  draw1('genba', PAIRS[LAST][0], s => JP(700, s), 14, NT2, NT1);
  draw1('name', PAIRS[LAST][1], s => MIN(s), 13.5, NT1, NT1);
  const a = TARGETS.arrow, p = toScreen(c, a.x, a.y);
  ctx.save(); ctx.font = `400 ${(13 * c.z).toFixed(3)}px "Inter"`; ctx.fillStyle = NT2; ctx.globalAlpha = clamp((t - (FOLD1 - 0.14)) / 0.13); ctx.fillText('→', p[0], p[1]); ctx.restore();
  // 縦の線: 巻き戻った点が左端へ動き、真ん中から上下へ伸びて縁になる。拭いのあいだは縁の線(写しの縁から 8px 夜の側)
  if (t >= RET1) {
    const M = nightMat(FOLD0), A0 = [ARC[0][0], ARC[0][1] + LAST * DY], P0 = [M.a * A0[0] + M.c * A0[1] + M.e, M.b * A0[0] + M.d * A0[1] + M.f];
    const g = E.cubicOut(clamp((t - RET1) / (WIPE0 - RET1))), mvx = E.cubicInOut(clamp((t - RET1) / (WIPE0 - RET1)));
    const x0 = t < WIPE0 ? lerp(P0[0] - 70 * 0.75, WX0, mvx) : wipeX(t), yc = lerp(P0[1], 540, mvx);
    const V = EDGE(x0).map(q => [q[0] + 8 * clamp((t - RET1) / (WIPE0 - RET1)), q[1] - 540 + yc]);
    const s0 = 0.5 - 0.5 * Math.max(g, 0.004), s1 = 0.5 + 0.5 * Math.max(g, 0.004);
    ctx.save(); ctx.strokeStyle = NAVY_D; ctx.lineWidth = 6; ctx.lineCap = 'round';
    const n = 80; ctx.beginPath(); for (let i = 0; i <= n; i++) { const q = bez(V, lerp(s0, s1, i / n)); if (i) ctx.lineTo(q[0], q[1]); else ctx.moveTo(q[0], q[1]); } ctx.stroke(); ctx.restore();
    if (t < WIPE0) { const q = bez(V, 0.5); ctx.save(); ctx.globalAlpha = 1 - g; ctx.fillStyle = GLINT; ctx.beginPath(); ctx.arc(q[0], q[1], 8, 0, Math.PI * 2); ctx.fill(); ctx.restore(); }
    mv('e0', ...bez(V, s0)); mv('e1', ...bez(V, s1)); mv('em', ...bez(V, 0.5));
  }
}

/* ================================================================ 終わり: v3 の finale を 2 拍早めて。地平線が y 632→620 に着く・PULL1 以降 ×1.00→×0.91・字間を 0.30em へ・光が藍の線を渡る */
function sceneH(t, P) {
  const tv = t + FSHIFT;
  const k = tv < PULL1 ? 1 : 1 - 0.07 * clamp((tv - PULL1) / (15 + FSHIFT - PULL1));                // v3 の遠ざかり ×1.00→×0.93(前の裁定・直し 8)。光・字間の動きは足さない
  const hk = (u => (1 - u) * (1 - u))(clamp((t - FS) / HAND_T));                                   // 1 → 0(quadOut の残り)。写しの引きの速さのまま、線は 593 から地平線 620 へ降りて着き、全体は ×1.083 から ×1 へ
  const K = k * (1 + (HAND_K0 - 1) * hk), dy = HAND_DY0 * hk;
  const base = [K, 0, 0, K, 960 - 960 * K, 540 - 540 * K + dy];
  const _st = ctx.setTransform.bind(ctx);
  ctx.setTransform = function (a, b, c, d, e, f) { if (arguments.length === 6 && a === 1 && b === 0 && c === 0 && d === 1 && e === 0 && f === 0) return _st(...base); return _st.apply(null, arguments); };
  const hand = E.sineInOut(clamp((t - FS) / 0.2));                                                  // 罫(薄い灰・画面で 6px)から藍へ 12 コマで受け渡す。砂の線が出る 12.89 には藍
  const P2 = hand < 1 ? { ...P, line: mix('#E4E3E0', P.line, hand) } : P;
  try { finale(tv, P2); } finally { ctx.setTransform = _st; }
  if (t > 14.8) { _st(1, 0, 0, 1, 0, 0); ctx.fillStyle = LIGHT.bg; ctx.globalAlpha = E.sineInOut(clamp((t - 14.8) / 0.2)) * 0.85; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }   // 最後の 0.2 秒で地へ溶かす(音の減衰と一緒に)
}

/* ================================================================ 1 枚 */
function draw(t) {
  t = clampSeg(t); TT = t;
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.filter = 'none'; ctx.globalAlpha = 1;
  if (t < FS) { ctx.fillStyle = t < WIPE1 ? NIGHT : '#FBFAF7'; ctx.fillRect(0, 0, W, H); }
  else { ctx.fillStyle = LIGHT.bg; ctx.fillRect(0, 0, W, H); }
  if (t < FOLD0) sceneNight(t);
  else if (t < WIPE1) scene3(t);
  else if (t < FS) { const c = camPage(t); [[0, 0], [W, 0], [0, H], [W, H], [960, 540]].forEach((p, i) => mv('pc' + i, (p[0] - 960) / c.z + c.x, (p[1] - 540) / c.z + c.y)); }
  else sceneH(t, LIGHT);
  ctx.setTransform(1, 0, 0, 1, 0, 0);
}
function speedPx(t) {
  const dt = 1 / (2 * FPS), a = new Map(), m = new Map(), b = new Map();
  PROBING = a; draw(t - dt); PROBING = m; draw(t); PROBING = b; draw(t + dt); PROBING = null;
  let v = 0;
  for (const [key, p] of m) { const pa = a.get(key), pb = b.get(key); if (pa && pb) v = Math.max(v, Math.hypot(pb[0] - pa[0], pb[1] - pa[1])); else if (pa || pb) { const q = pa || pb; v = Math.max(v, 2 * Math.hypot(q[0] - p[0], q[1] - p[1])); } }
  return v;
}
LINE_ONLY.push([PASS0, PASS1 + 0.12, 60], [DRIFT0, DRIFT1 + 0.12, 60], [SW[0], FOLD0, 60], [FOLD0, WIPE1, 80]);
function SAMPLE_STEP(t) { return t >= FS ? 1.5 : 1.0; }

const TEXTS = {
  [JP(700, 40)]: PAIRS.map(p => p[0]).join(''),
  [MIN(40)]: PAIRS.map(p => p[1]).join(''),
  ['400 40px "Inter"']: '→', ['500 40px "Inter"']: 'BRIDGE',
};
const ready = (async () => {
  MEAS3 = await (await fetch('meas3.json')).json();   // 一覧(何も開いていない・1440×900)の実測
  await document.fonts.ready;
  await Promise.all(Object.entries(TEXTS).map(([f, s]) => document.fonts.load(f, s)));
  const missing = Object.entries(TEXTS).filter(([f, s]) => !document.fonts.check(f, s)).map(([f]) => f);
  if (missing.length) throw new Error('フォントが揃っていない: ' + missing.join(', '));
  layoutCache.clear(); buildTargets(); buildSources(); buildCharTimes();
})();
const _renderFrame = renderFrame;
window.REEL = {
  W, H, FPS, DUR, canvas, draw, speedPx, samplesFor, ready, out: canvas, camPage, wipeX, segOf, WIPE0, WIPE1, FS, CUT1, NAME_T, TAKE_OF, NAME_CLIP,
  renderFrame: (t, n) => { FRAME_T = t; try { return _renderFrame(t, n); } finally { FRAME_T = null; } },
};
if (!location.search.includes('render')) {
  ready.then(() => { const q = new URLSearchParams(location.search); if (q.has('t')) { draw(+q.get('t')); return; } let s0 = performance.now(); const loop = now => { draw(((now - s0) / 1000) % DUR); requestAnimationFrame(loop); }; requestAnimationFrame(loop); });
}
