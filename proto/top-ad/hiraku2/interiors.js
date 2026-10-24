/* ================================================================
   融合3「ひらく町」— 建物の中(中の形のモジュール)   BRIEF 9.3・9.8・9.9
   buildInterior(kind, box, ctx) → { group, stations, update(dt, t, mode), setNight(k), dispose(), ready, reveal() }
     kind: 'hospital' | 'observatory' | 'clinic' | 'office' | 'library' | 'park' | 'atelier'
     box : { w, d, h, floors, shape }  原点は建物の床の中心、+Y が上、+Z が正面(ひらく側)
           中は x∈[-w/2, w/2]、z∈[-d/2, d/2-0.04]、y∈[0, h]。正面の壁と屋根は作らない(外側の持ち物)。公園は y=0 が芝の面
     ctx : { palette, loadTexture(url) → Promise<Texture>(.image を canvas に描ける物), quality: 'high' | 'low', layout?: { 道具の id: { x, z, ry } }, limbs?: false で腕と腿を描かない }
           palette.poche があれば、切り口の塗りの色(なければ '#16233E')
     ready: 画面の画像がそろったら解ける Promise。そろった時点で、画面が 60ms ずつ順に点る。reveal() を呼ぶと、その時から点し直す
   描画の回数(1つの建物): 形(止まっている物と道具の物)1・画面 1・画面のにじみ(と公園の波紋)1・人の体 1・人の頭 1・腕と腿 1 = 6。影を落とすのは形と人の体(影 +2。合わせて 8)
   画面は、建物ごとに1枚の画像(アトラス)にまとめて貼る。実際の画面は ctx.loadTexture で読み、その画像を写す
   形は、外側の町と同じ世界: 生成りの壁・テラコッタ・セージ・砂。人は world.js と同じ形と色(PERSON)、顔は描かない
   磨き込み(BRIEF 10.2): 切った壁・床・天井の切り口は、断面図のように藍(palette.poche)で平らに塗る。
     室内の光は描画を増やさずに素材の中で作る(床と壁の境・隅の陰、奥ほどわずかに暗く、天井の灯りの暖かいにじみ)。
     床の接地の陰は、柔らかい縁の四角を床に重ねる。人は座る・かがむ・話す・歩くの姿勢を持つ
   ================================================================ */
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../shared/vendor/three-0.160.0/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = v => clamp(v, 0, 1);
const lerp = (a, b, t) => a + (b - a) * t;
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- 箱の最初の値(BRIEF 9.9)。外側の BOXES が来れば、そちらが渡される ---------- */
export const DEFAULT_BOXES = {
  hospital: { w: 3.2, d: 2.2, h: 2.9, floors: 3 },
  observatory: { w: 1.0, d: 1.0, h: 4.2, floors: 3, shape: 'tower' },
  clinic: { w: 2.0, d: 1.4, h: 1.1, floors: 1 },
  office: { w: 1.8, d: 1.8, h: 3.0, floors: 3 },
  library: { w: 2.4, d: 1.8, h: 1.9, floors: 1 },
  atelier: { w: 1.6, d: 1.4, h: 1.3, floors: 1 },
  park: { w: 4.0, d: 3.0, h: 0, floors: 0 }
};

/* ---------- 色: 外側の町(融合1)の C から、中の色を作る ----------
   ctx.palette は2つの形を受ける。町の C の形(wall・slab・terra …)なら、それを元に作り直す。
   hiraku/buildings.js の PALETTE の形(wallIn・scrubs・casual …)なら、人の服・肌と、植物・紙・コルクをそれに合わせる
   (外を歩く人と、中の人が同じ色になる) */
const BASE = {
  wall: '#F6F1E7', wall2: '#E8DCC8', trim: '#FBF7EE', slab: '#DCCFBC', terra: '#C47A5A', terraLight: '#D39470', sage: '#B9C9A6', sand: '#EAD7B5', peach: '#F0D3B5',
  glass: '#8EA8BB', glassDark: '#62768A', door: '#5C6B7C', wood: '#A47A5C', bench: '#A98366', navy: '#16233E', brand: '#A98F63', lampPole: '#727D8C', lampHead: '#FFF4DA', water: '#93C2D1',
  leaf: ['#8DB074', '#9BBD80', '#7FA66B', '#A6C78B'],
  people: ['#4E9C96', '#2E3E5C', '#F3F2EE', '#9AA3AD', '#D8C7A8', '#7E9CC4', '#5D7F70', '#F3F2EE'], skin: ['#F0D2BC', '#E4BE9F', '#C99D7F']
};
const mix = (a, b, t) => '#' + new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString();
const enc = x => x <= .0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - .055;   // 光の量 → 画面の色の値(にじみの枠は値のまま足すため)
function makePalette(p) {
  const outer = !!(p && p.wallIn);
  const P = Object.assign({}, BASE, outer ? {} : p || {});
  const pe = P.people || BASE.people;
  const R = Object.assign({}, P, {
    // 中の色は、外の色から作る(外の色が変わっても、同じ世界のまま)
    inWall: mix(P.wall, P.wall2, .3), inWall2: mix(P.wall2, P.sand, .25), wainscot: mix(P.wall2, P.terra, .1), cut: mix(P.slab, '#7D6A55', .3), cutLine: mix(P.slab, '#5A4A3B', .55),
    vinyl: mix(P.slab, '#EEE9DF', .3), floorWood: mix(P.wood, '#EAD6B8', .5), parquet: mix(P.wood, '#E0C49C', .35), carpet: mix(P.glassDark, P.slab, .6), stone: mix(P.sand, '#EFE7DA', .45),
    desk: mix(P.trim, P.slab, .15), deskWood: mix(P.wood, '#E4C9A2', .4), woodDark: mix(P.wood, '#5A4434', .25),
    metal: mix(P.lampPole, '#FFFFFF', .35), metalDark: P.lampPole, dark: mix(P.navy, '#4A4F55', .5), frame: '#2B3036', screenOff: '#1B2025',
    paper: '#FBF9F3', cork: mix(P.sand, P.wood, .5), sofa: mix(P.sand, P.wood, .32), cushion: mix(P.sand, '#FFFFFF', .25), chair: mix(P.glassDark, '#9AA3AD', .4), chair2: mix(P.wood, P.sand, .3),
    sheet: '#F7F5F0', blanket: mix(pe[0], '#FFFFFF', .55), teal: pe[0], tealSoft: mix(pe[0], '#FFFFFF', .5), pot: mix(P.sand, P.terra, .2),
    scrub: pe[0], scrubNavy: pe[1], coat: pe[2], office: pe[3], casual: [pe[4], pe[5], pe[6], P.terraLight, mix(pe[5], pe[4], .5)],
    notes: ['#F2D46B', '#F0AFA5', '#A4CDEA', '#BFE2B0'], books: [P.terra, mix(P.sage, '#5D7F70', .5), '#E6C76E', mix(pe[5], '#2E5A8A', .3), P.navy, mix(P.wood, '#6E4B36', .3), mix(P.terra, P.sand, .4), '#F3EFE6', pe[0], '#8E5A6B', mix(P.glassDark, '#3E5C7A', .3)],
    hair: '#3A302A'
  });
  R.poche = (p && p.poche) || '#16233E';      // 切り口の線(断面図の poché)
  R.cutLight = (p && p.cutLight) || mix(P.slab, '#FFFFFF', .38);   // 切り口の残り(壁の厚みの淡い面)
  if (outer) {
    const one = v => Array.isArray(v) ? v[0] : v;
    if (p.scrubs) { R.scrub = R.teal = p.scrubs[0]; R.scrubNavy = p.scrubs[1] || R.scrubNavy; R.tealSoft = mix(R.teal, '#FFFFFF', .5); R.blanket = mix(R.teal, '#FFFFFF', .55); }
    if (p.coat) R.coat = p.coat;
    if (p.office) R.office = one(p.office);
    if (Array.isArray(p.casual) && p.casual.length) R.casual = p.casual.slice();
    if (Array.isArray(p.skin) && p.skin.length) R.skin = p.skin.slice();
    if (Array.isArray(p.plant) && p.plant.length) R.leaf = [0, 1, 2, 3].map(i => p.plant[i % p.plant.length]);
    for (const key of ['pot', 'paper', 'cork']) if (p[key]) R[key] = p[key];
    if (p.screen) R.screenOff = p.screen;
  }
  return R;
}

/* ---------- 実際の画面(建物をひらいたときに読む)。切り取りは [x, y, 幅, 高さ] を 0〜1 で ---------- */
const IMG = {
  keiji: ['../../../images/products/thumbs/keiji.webp', [.17, .32, .66, .68]],
  nidodema: ['../../../images/products/thumbs/nidodema.webp', [0, 0, 1, 1]],
  yawagaeshi: ['../shared/shots/yawagaeshi.webp', [0, 0, 1, .62]],
  compass: ['../shared/shots/compass-result.webp', [0, .36, 1, .32]],
  tanaoroshi: ['../../../images/products/thumbs/tanaoroshi.webp', [0, .08, 1, .84]],
  iikae: ['../../../images/products/thumbs/iikae.webp', [.1, .12, .8, .7]],
  moyamoya: ['../../../images/products/thumbs/moyamoya.webp', [.08, .14, .84, .84]],
  karte: ['../../../images/products/thumbs/karte.webp', [.28, .06, .44, .86]],
  'daily-app': ['../../../images/products/thumbs/careerlog.webp', [0, 0, 1, .8]],
  'growth-76a805': ['../../../images/products/thumbs/growth.webp', [0, 0, 1, 1]],
  'clinic-flow-3d': ['../../../images/products/thumbs/clinic-flow-3d.webp', [0, 0, 1, 1]],
  turnaround12: ['../../../images/products/thumbs/turnaround12.webp', [.18, .18, .64, .78]],
  'pmi-quest': ['../../../images/products/thumbs/pmi-quest.webp', [.2, .14, .6, .6]],
  rehaboard: ['../../../images/products/thumbs/rehaboard.webp', [0, 0, 1, 1]],
  medboard: ['../../../images/products/thumbs/medboard.webp', [0, 0, 1, 1]],
  'hire-board': ['../../../images/products/thumbs/hireboard.webp', [0, 0, 1, 1]],
  'interview-kit': ['../../../images/products/thumbs/interview-kit.webp', [0, 0, 1, 1]],
  'consult-simulator': ['../../../images/products/thumbs/consult-simulator.webp', [.06, .02, .88, .96]],
  'round-note': ['../../../images/products/thumbs/round-note.webp', [.3, .04, .4, .92]],
  'manager-starter': ['../../../images/products/thumbs/manager-starter.webp', [.55, .06, .4, .6]],
  medops: ['../../../images/products/thumbs/medops.webp', [.04, .1, .55, .7]],
  'reha-checklist': ['../../../images/products/thumbs/reha-checklist.webp', [.04, .04, .6, .72]],
  'him-quiz': ['../../../images/products/thumbs/him-quiz.webp', [.25, .02, .5, .96]],
  'study-board': ['../../../images/products/thumbs/studyboard.webp', [0, 0, 1, 1]],
  'english-trainer': ['../../../images/products/thumbs/english-trainer.webp', [.26, .02, .48, .96]],
  'gokigen-gacha': ['../shared/shots/gacha.webp', [0, 0, 1, .7]],
  'ittan-horyu': ['../../../images/products/thumbs/ittan-horyu.webp', [.33, .02, .34, .96]],
  madoakari: ['../../../images/products/thumbs/madoakari.webp', [.3, .17, .42, .55]],
  futatsume: ['../../../images/products/thumbs/futatsume.webp', [.08, .1, .84, .86]]
};
/* 名前(PRODUCTS の名前のまま。アトリエは運営者のページ) */
const LABEL = {
  keiji: '掲示じたく', nidodema: '二度手間さがし', yawagaeshi: 'やわ返', rehaboard: 'RehaBoard', medboard: 'MedBoard', 'hire-board': 'HireBoard', 'interview-kit': '面接官の手帖',
  'consult-simulator': 'ConsultSim', 'round-note': '本部長の巡回手帖', 'manager-starter': '医療管理職スターター', medops: '医療管理実務ライブラリ', 'reha-checklist': 'Reha Checklist',
  'clinic-flow-3d': 'クリニックタウン3D', turnaround12: 'ターンアラウンド12', 'pmi-quest': 'クリニックPMIクエスト', compass: 'BRIDGE Compass', tanaoroshi: '経験の棚卸し',
  iikae: '現場のことば 言いかえ帳', moyamoya: '職場モヤモヤ診断', karte: '現場のカルテ', 'daily-app': 'キャリアログ', 'growth-76a805': 'Growth OS', 'him-quiz': 'HIM Quiz',
  'study-board': 'StudyBoard', 'english-trainer': 'Daily English', 'gokigen-gacha': 'ごきげん回復ガチャ', 'ittan-horyu': 'いったん保留', madoakari: '窓あかり', futatsume: 'ふたつめの波',
  about: '運営者について', community: '話をする', note: 'note'
};
export const STATION_IDS = {
  hospital: ['keiji', 'nidodema', 'yawagaeshi'],
  observatory: ['compass', 'tanaoroshi', 'iikae', 'moyamoya', 'karte', 'daily-app', 'growth-76a805'],
  clinic: ['clinic-flow-3d', 'turnaround12', 'pmi-quest'],
  office: ['rehaboard', 'medboard', 'hire-board', 'interview-kit', 'consult-simulator', 'round-note', 'manager-starter', 'medops', 'reha-checklist'],
  library: ['him-quiz', 'study-board', 'english-trainer'],
  park: ['gokigen-gacha', 'ittan-horyu', 'madoakari', 'futatsume'],
  atelier: ['about', 'community', 'note']
};

/* ================================================================
   形をまとめる(素材ごとに1つ。色は頂点に、夜に灯る所は aGlow に)
   ================================================================ */
const ni = g => (g.index ? g.toNonIndexed() : g);
const G = {
  box: ni(new THREE.BoxGeometry(1, 1, 1)).translate(0, .5, 0),
  cyl: ni(new THREE.CylinderGeometry(.5, .5, 1, 14, 1)).translate(0, .5, 0),
  cyl6: ni(new THREE.CylinderGeometry(.5, .5, 1, 6, 1)).translate(0, .5, 0),
  cone: ni(new THREE.ConeGeometry(.5, 1, 12, 1)).translate(0, .5, 0),
  sph: ni(new THREE.IcosahedronGeometry(.5, 1)),
  ball: ni(new THREE.SphereGeometry(.5, 10, 7)),
  plane: ni(new THREE.PlaneGeometry(1, 1))
};
const RBC = new Map();
function rbGeo(w, h, d, r) {
  const k = [w, h, d, r].map(v => v.toFixed(3)).join('|');
  if (!RBC.has(k)) RBC.set(k, ni(new RoundedBoxGeometry(w, h, d, 1, Math.min(r, Math.min(w, h, d) / 2 - .002))).translate(0, h / 2, 0));
  return RBC.get(k);
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function mtx(x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) { _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); return _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)); }
const COLS = new Map();
const col = h => { if (!COLS.has(h)) COLS.set(h, new THREE.Color(h)); return COLS.get(h); };

class Batch {
  constructor() { this.list = []; this.n = 0; }
  // c: 色(形に頂点の色があれば、それに掛ける)。glow: 夜に灯る強さ。flat: 1 なら光を受けない平らな色(切り口の塗り)
  add(geo, m, c, glow = 0, flat = 0) { const g = geo.clone().applyMatrix4(m); this.list.push([g, typeof c === 'string' ? col(c) : c, glow, flat]); this.n += g.attributes.position.count; }
  geometry(uv) {
    if (!this.n) return null;
    const P = new Float32Array(this.n * 3), N = new Float32Array(this.n * 3), K = new Float32Array(this.n * 3), L = new Float32Array(this.n), F = new Float32Array(this.n), U = uv ? new Float32Array(this.n * 2) : null;
    let o = 0;
    for (const [g, c, glow, flat] of this.list) {
      const k = g.attributes.position.count, vc = g.attributes.color, gk = g.attributes.glowK;
      P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3);
      if (U && g.attributes.uv) U.set(g.attributes.uv.array, o * 2);
      for (let i = 0; i < k; i++) {
        const j = (o + i) * 3, a = vc ? vc.getX(i) : 1, b = vc ? vc.getY(i) : 1, d = vc ? vc.getZ(i) : 1;
        K[j] = c.r * a; K[j + 1] = c.g * b; K[j + 2] = c.b * d; L[o + i] = glow * (gk ? gk.getX(i) : 1); F[o + i] = flat;
      }
      o += k; g.dispose();
    }
    this.list.length = 0;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(K, 3)); geo.setAttribute('aGlow', new THREE.BufferAttribute(L, 1)); geo.setAttribute('aFlat', new THREE.BufferAttribute(F, 1));
    if (U) geo.setAttribute('uv', new THREE.BufferAttribute(U, 2));
    geo.computeBoundingSphere();
    return geo;
  }
}
/* 箱(中心の x・z と底の y)・最小最大の箱・円柱・球 */
function bx(b, x, y, z, w, h, d, c, ry = 0, glow = 0) { b.add(G.box, mtx(x, y, z, w, h, d, ry), c, glow); }
function bb(b, x0, x1, y0, y1, z0, z1, c, glow = 0) { bx(b, (x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, c, 0, glow); }
function cy(b, x, y, z, r, h, c, seg6, glow = 0) { b.add(seg6 ? G.cyl6 : G.cyl, mtx(x, y, z, r * 2, h, r * 2), c, glow); }
function sp(b, x, y, z, r, c, sy = 1, glow = 0) { b.add(G.sph, mtx(x, y, z, r * 2, r * 2 * sy, r * 2), c, glow); }
/* 切り口の塗り: 藍の線は光を受けない平らな色(flat 1)。淡い面(cutLight)は光を受けるが、部屋の陰はつけない(flat .5。夜は暗くなる) */
function pb(b, x0, x1, y0, y1, z0, z1, c) { b.add(G.box, mtx((x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0), c, 0, c === CUR?.P?.cutLight ? .5 : 1); }
/* 床の接地の陰: 中ほどは暗く(k)、縁(幅 s)で床の色に溶ける四角。床と同じ素材なので、床の光の具合とそろう */
const SOFT = new Map();
function softGeo(w, d, s, k, round) {
  const key = [w, d, s, k, round ? 1 : 0].map(v => (+v).toFixed(3)).join('|');
  if (SOFT.has(key)) return SOFT.get(key);
  const pos = [], cl = [], a = w / 2, b = d / 2, n = round ? 12 : 4;
  const ring = (rx, rz) => Array.from({ length: n }, (_, i) => { const t = round ? i / n * TAU : [Math.PI * 1.25, Math.PI * 1.75, Math.PI * .25, Math.PI * .75][i]; return round ? [Math.cos(t) * rx, Math.sin(t) * rz] : [Math.sign(Math.cos(t)) * rx, Math.sign(Math.sin(t)) * rz]; });
  const inn = ring(a, b), out = ring(a + s, b + s);
  const tri = (p, q, r, cp, cq, cr) => {
    if ((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]) > 0) { [q, r] = [r, q]; [cq, cr] = [cr, cq]; }   // 上を向く面にそろえる
    for (const [v, c] of [[p, cp], [q, cq], [r, cr]]) { pos.push(v[0], 0, v[1]); cl.push(c, c, c); }
  };
  for (let i = 1; i < n - 1; i++) tri(inn[0], inn[i], inn[i + 1], k, k, k);
  for (let i = 0; i < n; i++) { const j = (i + 1) % n; tri(inn[i], out[i], out[j], k, 1, 1); tri(inn[i], out[j], inn[j], k, 1, k); }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => i % 3 === 1 ? 1 : 0), 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  SOFT.set(key, g); return g;
}
/* 画面の光が落ちる所: 色は面のまま(昼は見えない)。光る強さだけが中ほど 1 → 縁 0 */
const SPILL = new Map();
function spillGeo(w, d, s) {
  const key = [w, d, s].map(v => v.toFixed(3)).join('|');
  if (SPILL.has(key)) return SPILL.get(key);
  const g = softGeo(w, d, s, 1, true).clone(), cl = g.attributes.color.array, gk = new Float32Array(cl.length / 3);
  for (let i = 0; i < gk.length; i++) gk[i] = cl[i * 3] < 1.5 ? 1 : 0;   // softGeo は中が k(=1)・縁が 1 なので、位置で分ける
  const pos = g.attributes.position.array, a = w / 2, b = d / 2;
  for (let i = 0; i < gk.length; i++) { const x = pos[i * 3] / a, z = pos[i * 3 + 2] / b; gk[i] = Math.hypot(x, z) <= 1.001 ? 1 : 0; cl[i * 3] = cl[i * 3 + 1] = cl[i * 3 + 2] = 1; }
  g.setAttribute('glowK', new THREE.BufferAttribute(gk, 1));
  SPILL.set(key, g); return g;
}
let CUR = null;                            // 組み立て中の建物(床の色を引くため)
function floorAt(E, x, z, y) {
  for (const r of E.rugs) if (Math.abs(r.y - y) < .03 && x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return r.c;
  const i = E.fh ? clamp(Math.floor((y + .02) / E.fh), 0, E.floors - 1) : 0;
  return E.fc[i] || E.fc[0] || '#D9CFBF';
}
/* (x, z) に w × d の陰。y は床の仕上げの上の高さ */
function contact(E, x, y, z, w, d, o = {}) {
  if (!E || E.noContact) return;
  const c = o.c || floorAt(E, x, z, y);
  E.S.add(softGeo(w, d, o.s ?? .05, o.k ?? .74, o.round), mtx(x, y + .0015, z, 1, 1, 1, o.ry || 0), c);
}
/* 敷物を置き、その上の陰が敷物の色になるように覚える */
function rug(E, x0, x1, z0, z1, y, c) { bb(E.S, x0, x1, y, y + .005, z0, z1, c); E.rugs.push({ x0, x1, z0, z1, y: y + .005, c }); return y + .005; }
/* 向きのある物: (x, y, z) を原点に ry だけ回し、s 倍した座標で部品を置く */
function grp(b, x, y, z, ry = 0, s = 1) {
  const cs = Math.cos(ry) * s, sn = Math.sin(ry) * s;
  const P = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
  return {
    box(lx, ly, lz, w, h, d, c, rx = 0, rz = 0, glow = 0) { const [wx, wz] = P(lx, lz); b.add(G.box, mtx(wx, y + ly * s, wz, w * s, h * s, d * s, ry, rx, rz), c, glow); return this; },
    rbox(lx, ly, lz, w, h, d, r, c) { const [wx, wz] = P(lx, lz); b.add(rbGeo(w * s, h * s, d * s, r * s), mtx(wx, y + ly * s, wz, 1, 1, 1, ry), c); return this; },
    cyl(lx, ly, lz, r, h, c, seg6, rx = 0, rz = 0, glow = 0) { const [wx, wz] = P(lx, lz); b.add(seg6 ? G.cyl6 : G.cyl, mtx(wx, y + ly * s, wz, r * 2 * s, h * s, r * 2 * s, ry, rx, rz), c, glow); return this; },
    sph(lx, ly, lz, r, c, sy = 1, glow = 0) { const [wx, wz] = P(lx, lz); b.add(G.sph, mtx(wx, y + ly * s, wz, r * 2 * s, r * 2 * sy * s, r * 2 * s, ry), c, glow); return this; },
    cone(lx, ly, lz, r, h, c, glow = 0) { const [wx, wz] = P(lx, lz); b.add(G.cone, mtx(wx, y + ly * s, wz, r * 2 * s, h * s, r * 2 * s, ry), c, glow); return this; },
    // 床に立つ物の接地の陰(物の足もとの大きさ w × d)
    foot(lx, lz, w, d, k = .72, sft = .05) { const [wx, wz] = P(lx, lz); contact(CUR, wx, y, wz, w * s, d * s, { ry, k, s: sft }); return this; }
  };
}

/* ---------- 素材: 頂点の色 × 室内の光 + 夜に灯る所(aGlow × uGlow)。切り口(aFlat)は光を受けない ----------
   室内の光(描画を増やさない。建物の中の座標で、画素ごとに):
     床は壁ぎわと隅ほど暗く / 壁と家具と人は床に近いほど暗く(接地) / 奥ほどわずかに暗く
     天井の灯り: 床に暖かいにじみ(灯りの列の下)、壁の上のほうに暖かい明るさ */
const SELF_DAY = [.12, .11, .1], SELF_NIGHT = [.2, .16, .1], PSELF_DAY = [.13, .12, .11], PSELF_NIGHT = [.26, .21, .15];
const LAMP_DAY = .24, LAMP_NIGHT = .62;
function makeUniforms() {
  return {
    uSelf: { value: new THREE.Vector3(...SELF_DAY) }, uGlow: { value: 0 },
    uRoom: { value: new THREE.Vector4(1, -1, 1, 1) },       // 側面の壁の内側(±x)・奥の壁の内側 z・前の z・階の高さ
    uRoom2: { value: new THREE.Vector4(2, 0, 0, 0) },       // 形(0 箱・1 塔・2 なし)・塔の半径・灯りの間隔・灯りの列の z
    uRoom3: { value: new THREE.Vector4(0, 0, 0, 0) },       // 灯りの列の x のずれ
    uLamp: { value: new THREE.Vector4(1, .84, .62, LAMP_DAY) },
    uPpl: { value: Array.from({ length: NPPL }, () => new THREE.Vector4(0, -9, 0, 0)) }   // 人の足もと(xyz)と陰の半径(w)。床の上に、人と一緒に動く接地の陰
  };
}
const NPPL = 32;
const PPL_GLSL = `
float pplShade() {
  float s = 0.0;
  for (int i = 0; i < ${NPPL}; i++) {
    vec4 p = uPpl[i];
    if (p.w <= 0.0) continue;
    vec3 d = vLoc - p.xyz;
    if (abs(d.y) > .05) continue;
    s = max(s, 1.0 - smoothstep(.3, 1.0, length(d.xz) / p.w));
  }
  return s;
}`;
const ROOM_GLSL = `
float roomShade(out float pool) {
  pool = 0.0;
  if (uRoom2.x > 1.5) return 1.0;
  vec3 n = normalize(vNrm);
  float fh = max(uRoom.w, .3);
  float hy = vLoc.y - floor((vLoc.y + .006) / fh) * fh;
  float up = step(.6, n.y), vert = 1.0 - step(.6, abs(n.y));
  float dB = 9.0, dS = 9.0;
  if (uRoom2.x < .5) { dB = vLoc.z - uRoom.y; dS = uRoom.x - abs(vLoc.x); }
  else if (vLoc.z < .05) { dB = uRoom2.y - length(vLoc.xz); }
  float nearW = 1.0 - smoothstep(0.0, .28, min(dB, dS));
  float base = 1.0 - smoothstep(0.0, .14, hy);
  float edge = abs(n.z) > .5 ? dS : dB;
  float corner = 1.0 - smoothstep(0.0, .2, edge);
  float depth = clamp((uRoom.z - vLoc.z) / max(uRoom.z - uRoom.y, .3), 0.0, 1.0);
  float shade = 1.0 - .3 * nearW * up - (.28 * base + .16 * corner) * vert - .1 * depth;
  float sp = uRoom2.z;
  float dx = sp > .01 ? mod(vLoc.x - uRoom3.x + sp * 50.5, sp) - sp * .5 : vLoc.x;
  float dz = vLoc.z - uRoom2.w;
  pool = exp(-(dx * dx + dz * dz) / .34) * (.5 + .5 * up) * (1.0 - .6 * smoothstep(fh * .55, fh, hy)) + smoothstep(fh * .5, fh * .98, hy) * vert * .5;
  return shade;
}`;
function inMat(u, o = {}) {
  const vc = o.vc !== false, glow = !!o.glow, flat = !!o.flat, ppl = !!o.ppl;
  const m = new THREE.MeshStandardMaterial({ vertexColors: vc, roughness: .86, metalness: 0 });
  m.onBeforeCompile = sh => {
    for (const k of ['uSelf', 'uGlow', 'uRoom', 'uRoom2', 'uRoom3', 'uLamp']) sh.uniforms[k] = u[k];
    if (ppl) sh.uniforms.uPpl = u.uPpl;
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vLoc;\nvarying vec3 vNrm;' + (glow ? '\nattribute float aGlow;\nvarying float vGlow;' : '') + (flat ? '\nattribute float aFlat;\nvarying float vFlat;' : ''))
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvec4 lp = vec4(transformed, 1.0);\nvec3 ln = objectNormal;\n#ifdef USE_INSTANCING\nlp = instanceMatrix * lp;\nln = mat3(instanceMatrix) * ln;\n#endif\nvLoc = lp.xyz;\nvNrm = ln;' + (glow ? '\nvGlow = aGlow;' : '') + (flat ? '\nvFlat = aFlat;' : ''));
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSelf;\nuniform float uGlow;\nuniform vec4 uRoom;\nuniform vec4 uRoom2;\nuniform vec4 uRoom3;\nuniform vec4 uLamp;\nvarying vec3 vLoc;\nvarying vec3 vNrm;' + (glow ? '\nvarying float vGlow;' : '') + (flat ? '\nvarying float vFlat;' : '') + (ppl ? '\nuniform vec4 uPpl[' + NPPL + '];' : '') + ROOM_GLSL + (ppl ? PPL_GLSL : ''))
      .replace('#include <color_fragment>', '#include <color_fragment>\nfloat pool = 0.0;\nfloat shade = roomShade(pool);' + (ppl ? '\nshade *= 1.0 - .32 * pplShade() * step(.6, normalize(vNrm).y);' : '') + (flat ? '\nfloat cutK = step(.25, vFlat);\nshade = mix(shade, 1.0, cutK);\npool *= 1.0 - cutK;' : '') + '\ndiffuseColor.rgb *= shade;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * (uSelf + uLamp.rgb * (uLamp.a * pool))' + (glow ? ' + (mix(vec3(1.0, .8, .56), diffuseColor.rgb, .45) * max(vGlow, 0.0) + vec3(.62, .74, 1.0) * max(-vGlow, 0.0)) * uGlow' : '') + ';');
    if (flat) sh.fragmentShader = sh.fragmentShader.replace('#include <opaque_fragment>', 'outgoingLight = mix(outgoingLight, diffuseColor.rgb, step(.75, vFlat));\n#include <opaque_fragment>');
  };
  m.customProgramCacheKey = () => 'hiraku-in2-' + (vc ? 'v' : 'i') + (glow ? 'g' : '') + (flat ? 'f' : '') + (ppl ? 'p' : '');
  return m;
}

/* ================================================================
   人(外の町 hiraku/world.js の personGeos と同じ形: 肩のある体と、上と後ろが髪の頭。顔は描かない)
   体の原点は足もと、頭は中心。背の高さ .457(外側の PERSON_H .44 の人と同じ)
   ================================================================ */
const BODY_GEO = new THREE.LatheGeometry([[0, 0], [.055, 0], [.06, .1], [.064, .2], [.075, .25], [.082, .3], [.07, .34], [.04, .355], [0, .36]].map(([x, y]) => new THREE.Vector2(x, y)), 9);
const HEAD_GEO = (() => {
  const g = new THREE.SphereGeometry(.052, 9, 7), n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const y = g.attributes.position.getY(i), z = g.attributes.position.getZ(i); c.set(y > -.004 || (z < -.01 && y > -.03) ? [.32, .27, .24] : [1, 1, 1], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
})();
/* 立つ人: 頭の中心 +.405。座る人: 体を縦 .7 にして +.06 から、頭 +.356。寝る人: 体を横にして、頭は枕の上 */
export const PERSON = { headY: .405, sitY: .06, sitScale: .7, sitHeadY: .356, height: .457 };
/* 姿勢: [体の縦の縮み, 前への傾き(rad), 頭の俯き(+ で下を向く)]。座る姿勢は椅子の高さ(sitY)から */
const POSE = {
  stand: [1, 0, 0], talk: [1, .035, .05], walk: [1, .06, .04], climb: [1, .13, .1], bend: [.96, .5, .4], crouch: [.56, .32, .3], reach: [1, -.06, -.3],
  sit: [.7, -.05, .06], listen: [.7, .02, .1], type: [.7, .15, .22], write: [.7, .2, .42], read: [.7, .1, .5], look: [.7, -.06, -.16], lie: [1, 0, 0]
};
const SEATED = new Set(['sit', 'listen', 'type', 'write', 'read', 'look']);
/* 腕と脚の1節(長さ 1・太さ 1 の柱。インスタンスごとに太さと長さを掛ける)。上の端を関節に置き、下へのびる
   腕は二の腕と前腕(ひじで曲がる)、座る人は腿とすね(ひざで曲がる)。町の人にも同じ形を使えるように export する */
export const LIMB_GEO = (() => { const g = new THREE.CylinderGeometry(1, .9, 1, 5, 1, true); g.translate(0, -.5, 0); return g; })();
export const LIMB = { shoulder: [.082, .3], upper: .085, fore: .08, armR: .016, foreR: .014, hip: [.036, .075], thigh: .12, legR: .021, shinR: .018 };

/* ================================================================
   画面のアトラス(建物ごとに1枚)
   ================================================================ */
function atlasCanvas(size, bg) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); g.fillStyle = bg; g.fillRect(0, 0, size, size);
  return { c, g };
}

/* ================================================================
   本体
   ================================================================ */
export function buildInterior(kind, box, ctx = {}) {
  const def = DEFAULT_BOXES[kind]; if (!def) throw new Error('unknown interior: ' + kind);
  box = Object.assign({}, def, box || {});
  const P = makePalette(ctx.palette), low = ctx.quality === 'low';
  const u = makeUniforms();
  const E = {
    kind, box, P, low, r: rng(kind.length * 131 + 7),
    S: new Batch(), H: new Batch(), SC: new Batch(), HL: new Batch(), people: [], stations: [], rings: [], extra: {}, rugs: [], fc: [], movers: [],
    noContact: kind === 'park',            // 公園の芝には床の陰を置かない(日の影に任せる)
    limbs: ctx.limbs !== false,
    floors: Math.max(1, box.floors | 0), fh: box.floors ? box.h / Math.max(1, box.floors | 0) : 0,
    // 最初の箱に対する比で置く。家具の大きさは k 倍(小さい箱では縮める)
    sx: box.w / def.w, sz: box.d / def.d,
    k: clamp(Math.min(box.w / def.w, box.d / def.d, box.h && def.h ? box.h / def.h : 1), .6, 1.12),
    layout: ctx.layout || {}
  };
  E.X = x => x * E.sx; E.Z = z => z * E.sz;
  E.fy = i => i * E.fh;                                  // その階の床の高さ(床の仕上げの下)
  E.zf = box.d / 2 - .04; E.zb = -box.d / 2;
  // 切り口の藍の線の太さ: 建物の幅に比べて細く(小さい建物ほど寄って見えるので、幅に比例)
  E.N = box.shape === 'tower' ? .028 : clamp(box.w * .018, .028, .058);
  // 天井の灯りの列(床のにじみと、吊るした灯りで同じ位置を使う)
  // 下の階は、上の床にさえぎられて手前しか見えない。階が重なる建物は、灯りの列を手前に寄せる(吊るした灯りが見え、にじみも見える所に落ちる)
  { const nL = Math.max(1, Math.round(box.w / 1.15)), sp = box.w / nL, mid = (-box.d / 2 + .049 + E.zf) / 2 - .05; E.lamps = { n: nL, sp, off: nL % 2 ? 0 : sp / 2, xs: Array.from({ length: nL }, (_, i) => (i - (nL - 1) / 2) * sp), z: E.floors > 1 ? Math.max(mid, E.zf - .32) : mid, zp: E.zf - .13 }; }
  CUR = E;
  try { BUILD[kind](E); heldAll(E); } finally { CUR = null; }
  // 室内の光の物差し(素材の中で使う)
  if (kind === 'park') u.uRoom2.value.set(2, 0, 0, 0);
  else if (box.shape === 'tower') { const R = box.w / 2 - .04; u.uRoom.value.set(R, -R, R, E.fh); u.uRoom2.value.set(1, R, 0, -.08); }
  else {
    const hx = box.w / 2 - .049, zb = -box.d / 2 + .049, zf = E.zf;
    u.uRoom.value.set(hx, zb, zf, E.fh); u.uRoom2.value.set(0, 0, E.lamps.sp, E.lamps.z); u.uRoom3.value.set(E.lamps.off, 0, 0, 0);
  }

  const group = new THREE.Group(); group.name = 'interior-' + kind;
  const staticMat = inMat(u, { glow: true, flat: true, ppl: true });
  // 道具の物(持ち上がる)も、止まっている形と同じ1つの形にまとめる(描画を1回減らす)。物の頂点の範囲は hOff から
  const hOff = E.S.n, hN = E.H.n;
  for (const it of E.H.list) E.S.list.push(it); E.S.n += hN; E.H.list.length = 0;
  const sGeo = E.S.geometry();
  const sMesh = new THREE.Mesh(sGeo, staticMat); sMesh.castShadow = true; sMesh.receiveShadow = true; group.add(sMesh);
  const hGeo = hN ? sGeo : null;
  // 画面(アトラス)
  const nS = E.stations.length, cols = nS <= 4 ? 2 : nS <= 9 ? 3 : 4, slot = low ? 256 : 512, asz = cols * slot, A = atlasCanvas(asz, P.screenOff);
  const atlas = new THREE.CanvasTexture(A.c); atlas.colorSpace = THREE.SRGBColorSpace; atlas.anisotropy = 4;
  const scGeo = E.SC.geometry(true);
  const scMat = new THREE.MeshBasicMaterial({ map: atlas, vertexColors: true, toneMapped: false });
  const scMesh = scGeo ? new THREE.Mesh(scGeo, scMat) : null; if (scMesh) group.add(scMesh);
  // 画面の UV をアトラスの区画に合わせる(物の縦横比で、区画の中に収める)
  E.stations.forEach((s, i) => {
    const col0 = i % cols, row = Math.floor(i / cols), a = s.sw / s.sh, m = slot * .03;
    const dw = a >= 1 ? slot - 2 * m : (slot - 2 * m) * a, dh = a >= 1 ? (slot - 2 * m) / a : slot - 2 * m;
    const x0 = col0 * slot + (slot - dw) / 2, y0 = row * slot + (slot - dh) / 2;
    s.rect = [x0, y0, dw, dh];
    const U = scGeo.attributes.uv;
    for (let v = s.sc[0]; v < s.sc[1]; v++) {
      const uu = U.getX(v), vv = U.getY(v);
      U.setXY(v, (x0 + uu * dw) / asz, 1 - (y0 + (1 - vv) * dh) / asz);
    }
  });
  if (scGeo) scGeo.attributes.uv.needsUpdate = true;
  // 人
  const ppl = buildPeople(E, u);
  if (ppl) { group.add(ppl.body, ppl.head); if (ppl.limbs) group.add(ppl.limbs); }
  // 画面のまわりの、わずかなにじみ(足し算の光)。公園の池の波紋も同じ形に入れる
  const RING = (() => { const g = new THREE.RingGeometry(.9, 1, 40); g.rotateX(-Math.PI / 2); return ni(g); })();
  for (const rr of E.rings) { rr.v = [E.HL.n, 0]; E.HL.add(RING, mtx(0, 0, 0, 1, 1, 1), '#FFFFFF'); rr.v[1] = E.HL.n; }
  const hlGeo = E.HL.geometry();
  // 色だけを足し、透明度は変えない(空に重なる所で、キャンバスに黒い跡を残さない)
  const hlMat = new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor });
  // 足す量は画面の色の値のまま(色空間の変換をしない)。変換すると小さい値が急に明るくなり、にじみの外の縁が線に見え、内の縁は白く飛ぶ
  hlMat.onBeforeCompile = sh => { sh.fragmentShader = sh.fragmentShader.replace('#include <colorspace_fragment>', ''); };
  const hlMesh = hlGeo ? new THREE.Mesh(hlGeo, hlMat) : null; if (hlMesh) { hlMesh.renderOrder = 2; hlMesh.frustumCulled = false; group.add(hlMesh); }
  const hlBase = hlGeo ? hlGeo.attributes.position.array.slice() : null, hlCol = hlGeo ? hlGeo.attributes.color.array.slice() : null;
  let nightK = 0;

  /* ---- 道具の物: 持ち上げと明るさ(頂点を書き換える。物はどれも小さいので軽い) ---- */
  const hBase = hGeo ? sGeo.attributes.position.array.slice(hOff * 3, (hOff + hN) * 3) : null, hCol = hGeo ? sGeo.attributes.color.array.slice(hOff * 3, (hOff + hN) * 3) : null;
  // 書き換えた範囲だけを送る
  const touch = (attr, v0, v1) => { attr.addUpdateRange(v0 * attr.itemSize, (v1 - v0) * attr.itemSize); attr.needsUpdate = true; };
  const scBase = scGeo ? scGeo.attributes.position.array.slice() : null;
  const stations = E.stations.map((s, i) => {
    const anchor = new THREE.Vector3(...s.anchor);
    const st = {
      id: s.id, label: LABEL[s.id] || s.id, anchor, radius: s.radius, index: i,
      setActive(on) { s.active = !!on; }, setHover(on) { s.hover = !!on; }
    };
    s.api = st; s.index = i; s.lift = 0; s.on = 0; s.flick = 0; s.offset = [0, 0, 0]; s.anchor0 = s.anchor.slice();
    return st;
  });
  function writeStation(s) {
    const k = s.lift, [lx, ly, lz] = s.liftVec, [ox, oy, oz] = s.offset;
    const dx = lx * k + ox, dy = ly * k + oy, dz = lz * k + oz;
    if (hGeo && s.h[1] > s.h[0]) {
      const Pp = sGeo.attributes.position.array, Cc = sGeo.attributes.color.array, br = 1 + .14 * k;
      for (let v = s.h[0]; v < s.h[1]; v++) { const o = (v + hOff) * 3, b = v * 3; Pp[o] = hBase[b] + dx; Pp[o + 1] = hBase[b + 1] + dy; Pp[o + 2] = hBase[b + 2] + dz; Cc[o] = hCol[b] * br; Cc[o + 1] = hCol[b + 1] * br; Cc[o + 2] = hCol[b + 2] * br; }
      touch(sGeo.attributes.position, s.h[0] + hOff, s.h[1] + hOff); touch(sGeo.attributes.color, s.h[0] + hOff, s.h[1] + hOff);
    }
    if (scGeo) {
      const Pp = scGeo.attributes.position.array, Cc = scGeo.attributes.color.array, b = clamp01(s.on) * (.93 + .07 * Math.max(k, s.hoverK || 0) - s.flick);
      for (let v = s.sc[0]; v < s.sc[1]; v++) { Pp[v * 3] = scBase[v * 3] + dx; Pp[v * 3 + 1] = scBase[v * 3 + 1] + dy + .0005; Pp[v * 3 + 2] = scBase[v * 3 + 2] + dz; const bb2 = .06 + b * .94; Cc[v * 3] = bb2; Cc[v * 3 + 1] = bb2; Cc[v * 3 + 2] = bb2; }
      scGeo.attributes.position.needsUpdate = true; scGeo.attributes.color.needsUpdate = true;
    }
    if (hlGeo && s.hl) {
      // 画面は昼もわずかに、夜はもう少し光る。ふれた物は、紙や板でも柔らかく光る
      const glowK = clamp01(s.on) * (s.glass ? lerp(0, .15, nightK) : 0) * (1 - s.flick * 2) + .5 * k + .32 * (s.hoverK || 0);
      const Pp = hlGeo.attributes.position.array, Cc = hlGeo.attributes.color.array;
      for (let v = s.hl[0]; v < s.hl[1]; v++) { Pp[v * 3] = hlBase[v * 3] + dx; Pp[v * 3 + 1] = hlBase[v * 3 + 1] + dy; Pp[v * 3 + 2] = hlBase[v * 3 + 2] + dz; Cc[v * 3] = hlCol[v * 3] * glowK; Cc[v * 3 + 1] = hlCol[v * 3 + 1] * glowK; Cc[v * 3 + 2] = hlCol[v * 3 + 2] * glowK; }
      hlGeo.attributes.position.needsUpdate = true; hlGeo.attributes.color.needsUpdate = true;
    }
    s.api.anchor.set(s.anchor0[0] + dx, s.anchor0[1] + dy, s.anchor0[2] + dz);
  }
  E.stations.forEach(writeStation);
  /* 公園のガチャ: 6秒おきに、取り出し口からカプセルが転がり出て、止まり、芝に沈む */
  const cap = E.extra.capRange && hGeo ? { range: E.extra.capRange, s: E.stations.find(s => s.id === 'gokigen-gacha') } : null;
  function moveCapsule(t) {
    const { range: [a0, a1], s } = cap, b = s.base, q = b.s, c = (t % 6) / 6, fx = Math.sin(b.ry), fz = Math.cos(b.ry);
    const ox = b.x + (.09 * Math.cos(b.ry) + .15 * fx) * q, oz = b.z + (-.09 * Math.sin(b.ry) + .15 * fz) * q;
    let d = 0, yy = .1;
    if (c < .08) { const e = c / .08; d = e * .04; yy = .1 - e * e * .065; }
    else if (c < .5) { const e = (c - .08) / .42; d = .04 + (1 - Math.pow(1 - e, 3)) * .34; yy = .035; }
    else if (c < .88) { d = .38; yy = .035; }
    else { d = .38; yy = .035 - (c - .88) / .12 * .1; }
    d *= q; yy *= q;
    const Pp = sGeo.attributes.position.array;
    for (let v = a0; v < a1; v++) { const o = (v + hOff) * 3, q2 = v * 3; Pp[o] = hBase[q2] + ox + fx * d; Pp[o + 1] = hBase[q2 + 1] + b.y + yy; Pp[o + 2] = hBase[q2 + 2] + oz + fz * d; }
    touch(sGeo.attributes.position, a0 + hOff, a1 + hOff);
  }

  /* ---- 実際の画面を読み、アトラスに写す。全部そろったら一度だけ送る ---- */
  let disposed = false, revealAt = 0;
  const load = ctx.loadTexture || (url => new Promise((res, rej) => { const im = new Image(); im.onload = () => { const t = new THREE.Texture(im); res(t); }; im.onerror = rej; im.src = url; }));
  const jobs = E.stations.map(s => {
    if (s.canvas) { drawCanvasSlot(A.g, s, P); if (s.glass) sheen(A.g, s); return Promise.resolve(); }
    const spec = IMG[s.id]; if (!spec) return Promise.resolve();
    const url = new URL(spec[0], import.meta.url).href;
    return Promise.resolve().then(() => load(url)).then(tex => { if (!disposed && tex && tex.image) { drawImageSlot(A.g, s, tex.image, spec[1]); if (s.glass) sheen(A.g, s); } }).catch(() => { /* 読めないときは消えた画面のまま */ });
  });
  const ready = Promise.all(jobs).then(() => { if (disposed) return; atlas.needsUpdate = true; if (!revealAt) revealAt = performance.now(); });

  /* ---- 動き ---- */
  let lastMode = null;
  function update(dt, t, mode = 'day') {
    if (mode !== lastMode) { lastMode = mode; if (ppl) ppl.setMode(mode); }
    if (ppl) ppl.update(t);
    const now = performance.now();
    for (const s of E.stations) {
      const want = s.active ? 1 : s.hover ? .55 : 0;
      const prevLift = s.lift, prevOn = s.on, prevFlick = s.flick, prevOff = s.offset.join();
      s.lift += (want - s.lift) * (1 - Math.pow(.0004, dt));
      s.hoverK = s.hover ? 1 : 0;
      if (revealAt) s.on = clamp01((now - revealAt - s.index * 60) / 260);
      s.flick = s.flicker ? (Math.sin(t * 2.3 + s.index) * .5 + .5) * Math.max(0, Math.sin(t * .7 + s.index * 1.7)) * s.flicker : 0;
      if (s.move) s.move(s, t);
      if (Math.abs(s.lift - prevLift) > 1e-4 || s.on !== prevOn || Math.abs(s.flick - prevFlick) > 1e-3 || s.offset.join() !== prevOff) writeStation(s);
    }
    if (E.rings.length && hlGeo) {
      const Pp = hlGeo.attributes.position.array, Cc = hlGeo.attributes.color.array;
      for (const rr of E.rings) {
        const k = (t * .28 + rr.ph) % 1, sc = rr.r0 + k * rr.r1, c = enc((1 - k) * (1 - k) * .6);
        for (let v = rr.v[0]; v < rr.v[1]; v++) { Pp[v * 3] = rr.x + hlBase[v * 3] * sc; Pp[v * 3 + 1] = rr.y; Pp[v * 3 + 2] = rr.z + hlBase[v * 3 + 2] * sc; Cc[v * 3] = Cc[v * 3 + 1] = Cc[v * 3 + 2] = c; }
      }
      hlGeo.attributes.position.needsUpdate = true; hlGeo.attributes.color.needsUpdate = true;
    }
    if (cap) moveCapsule(t);
    // 歩く人が持つ物(人の位置と向きに合わせて置き直す)
    if (hGeo) for (const m of E.movers) {
      const p = m.p, a = p.wry ?? p.ry, c = Math.cos(a), sn = Math.sin(a), bx2 = p.wx ?? p.x, bz2 = p.wz ?? p.z, by2 = p.wb || 0, Pp = sGeo.attributes.position.array;
      for (let v = m.v[0]; v < m.v[1]; v++) { const o = (v + hOff) * 3, b = v * 3, lx = hBase[b], lz = hBase[b + 2]; Pp[o] = bx2 + lx * c + lz * sn; Pp[o + 1] = hBase[b + 1] + by2; Pp[o + 2] = bz2 - lx * sn + lz * c; }
      touch(sGeo.attributes.position, m.v[0] + hOff, m.v[1] + hOff);
    }
  }
  function setNight(k) {
    k = clamp01(k);
    u.uSelf.value.set(...SELF_DAY.map((v, i) => lerp(v, SELF_NIGHT[i], k)));
    u.uGlow.value = lerp(0, 2.3, k);
    u.uLamp.value.w = lerp(LAMP_DAY, LAMP_NIGHT, k);
    if (ppl) ppl.uniforms.uSelf.value.set(...PSELF_DAY.map((v, i) => lerp(v, PSELF_NIGHT[i], k)));
    if (Math.abs(nightK - k) > 1e-3) { nightK = k; E.stations.forEach(writeStation); }
  }
  setNight(0);
  update(0, 0, 'day');

  return {
    group, stations, update, setNight,
    /* ひらく動きに合わせて、画面を順に点す(60ms ずつ)。呼ばなければ、画面が読めた時点で点る */
    reveal() { revealAt = performance.now(); for (const s of E.stations) s.on = 0; },
    ready,
    dispose() {
      disposed = true;
      for (const m of [sMesh, scMesh, hlMesh]) if (m) m.geometry.dispose();
      staticMat.dispose(); scMat.dispose(); hlMat.dispose(); atlas.dispose();
      if (ppl) ppl.dispose();
      group.removeFromParent();
    }
  };
}

/* 画像を区画に写す(切り取り → 物の縦横比で覆う) */
function drawImageSlot(g, s, img, crop) {
  const [x0, y0, dw, dh] = s.rect, iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  let [cx, cyy, cw, ch] = crop || [0, 0, 1, 1];
  cx *= iw; cyy *= ih; cw *= iw; ch *= ih;
  const want = dw / dh, have = cw / ch;
  if (have > want) { const nw = ch * want; cx += (cw - nw) / 2; cw = nw; } else { const nh = cw / want; ch = nh; }
  g.drawImage(img, cx, cyy, cw, ch, x0, y0, dw, dh);
}
/* ガラスの画面: 左上からのごく淡い映り込みと、縁のわずかな暗さ(画面がガラスの奥に光って見える) */
function sheen(g, s) {
  const [x0, y0, w, h] = s.rect;
  const gr = g.createLinearGradient(x0, y0, x0 + w * .55, y0 + h);
  gr.addColorStop(0, 'rgba(255,255,255,.16)'); gr.addColorStop(.42, 'rgba(255,255,255,.04)'); gr.addColorStop(.43, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(x0, y0, w, h);
  g.strokeStyle = 'rgba(10,14,20,.28)'; g.lineWidth = Math.max(2, w * .012); g.strokeRect(x0 + g.lineWidth / 2, y0 + g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth);
}
/* 運営者の部屋の3つは、絵で描く(実際の製品の画面ではないため) */
function drawCanvasSlot(g, s, P) {
  const [x0, y0, w, h] = s.rect;
  g.save(); g.translate(x0, y0);
  const f = (sz, wt = 700) => `${wt} ${Math.round(sz)}px "BIZ UDPGothic","Hiragino Sans","Noto Sans JP",sans-serif`;
  if (s.canvas === 'about') {
    g.fillStyle = '#FBF8F1'; g.fillRect(0, 0, w, h);
    g.lineWidth = w * .022; g.lineCap = 'round';
    const lx = w * .1, ly = h * .16, ls = w * .36 / 240;
    g.strokeStyle = P.navy; g.beginPath(); g.moveTo(lx + 8 * ls, ly + 74 * ls); g.bezierCurveTo(lx + 62 * ls, ly + 16 * ls, lx + 118 * ls, ly + 24 * ls, lx + 176 * ls, ly + 84 * ls); g.stroke();
    g.strokeStyle = P.brand; g.beginPath(); g.moveTo(lx + 58 * ls, ly + 94 * ls); g.bezierCurveTo(lx + 118 * ls, ly + 60 * ls, lx + 158 * ls, ly + 22 * ls, lx + 232 * ls, ly + 12 * ls); g.stroke();
    g.fillStyle = '#15191C'; g.font = f(h * .11); g.fillText('運営者について', w * .1, h * .6);
    g.font = f(h * .075, 400); g.fillStyle = '#454C52'; g.fillText('理学療法士 橋本渉', w * .1, h * .76);
    g.fillRect(w * .1, h * .84, w * .62, h * .015); g.fillRect(w * .1, h * .89, w * .48, h * .015);
  } else if (s.canvas === 'community') {
    g.fillStyle = '#F4EEE3'; g.fillRect(0, 0, w, h);
    const bub = (x, y, bw, bh, c) => { g.fillStyle = c; g.beginPath(); g.roundRect(x, y, bw, bh, bh * .3); g.fill(); g.beginPath(); g.moveTo(x + bw * .2, y + bh); g.lineTo(x + bw * .16, y + bh * 1.35); g.lineTo(x + bw * .36, y + bh); g.fill(); };
    bub(w * .08, h * .12, w * .5, h * .24, P.sage); bub(w * .42, h * .44, w * .5, h * .24, P.sand);
    g.fillStyle = '#15191C'; g.font = f(h * .13); g.fillText('話をする', w * .08, h * .9);
  } else if (s.canvas === 'note') {
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#E9E4DA'; g.fillRect(0, 0, w, h * .12);
    g.fillStyle = '#15191C'; g.font = f(h * .1); g.fillText('書いていること', w * .1, h * .3);
    g.fillStyle = '#9AA0A6';
    for (let i = 0; i < 6; i++) g.fillRect(w * .1, h * (.42 + i * .085), w * (i % 3 === 2 ? .5 : .8), h * .025);
  }
  g.restore();
}

/* ================================================================
   人のインスタンス
   kind: stand / talk / walk / climb / bend / crouch / reach / sit / listen / type / write / read / look / lie。night: true なら夜もいる
   write・read は stand: true で立ったまま。talk は partner と向き合い、話す番と聞く番を交代する
   hold: 'book' | 'chart' | 'cup' | 'card' で、手に持つ物(手の位置に置く。歩く人の物は、人と一緒に動く)
   ================================================================ */
function person(E, x, y, z, ry, o = {}) {
  const P = E.P;
  const p = Object.assign({ x, y, z, ry, kind: 'stand', cloth: P.casual[Math.floor(E.r() * P.casual.length)], skin: P.skin[Math.floor(E.r() * P.skin.length)], ph: E.r() * TAU, night: false, day: true, fy: y }, o);
  const scrub = [P.scrub, P.scrubNavy, P.tealSoft, P.blanket].includes(p.cloth);
  p.sleeve = p.sleeve || (scrub ? 'short' : [P.coat, P.office].includes(p.cloth) ? 'long' : E.r() < .5 ? 'short' : 'long');
  p.pants = p.pants || (scrub ? p.cloth : p.cloth === P.coat ? '#5B6470' : mix(p.cloth, '#363B44', .55));
  E.people.push(p);
  return p;
}
/* p を (x, z) の方へ k だけ向ける */
function turnTo(p, x, z, k = 1) { const want = Math.atan2(x - p.x, z - p.z); let d = want - p.ry; d = Math.atan2(Math.sin(d), Math.cos(d)); p.ry += d * k; return p; }
/* 2人を向き合わせて話させる */
function talk(a, b) {
  a.kind = SEATED.has(a.kind) && !a.stand ? 'listen' : 'talk'; b.kind = SEATED.has(b.kind) && !b.stand ? 'listen' : 'talk';
  a.ry = Math.atan2(b.x - a.x, b.z - a.z); b.ry = Math.atan2(a.x - b.x, a.z - b.z);
  a.partner = b; b.partner = a; b.ph = a.ph + Math.PI;
}
/* 姿勢を時刻 t で求める(描くときと、手に持つ物を置くときで同じ計算を使う)
   腕: [前への上げ, 外への開き, ひじの曲げ] を右・左 */
function poseOf(p, t, o = {}) {
  let x = p.x, y = p.y, z = p.z, ry = p.ry, bob = 0, roll = 0, yawO = 0, hy = 0;
  const seated = SEATED.has(p.kind) && !p.stand, ph = p.ph;
  let [sy, lean, hp] = POSE[p.kind] || POSE.stand;
  if (!seated && SEATED.has(p.kind)) { sy = 1; lean *= .45; }            // 立ったまま書く・読む
  if (p.lean != null) lean = p.lean;
  if (p.hp != null) hp = p.hp;
  let R = [.1, .13, .15], Lh = [.1, .13, .15];
  switch (p.kind) {
    case 'walk': {
      const amp = (p.x1 - p.x0) / 2, mid = (p.x0 + p.x1) / 2, om = (p.v || .3) / Math.max(.25, amp), ss = Math.sin(t * om + ph), vel = Math.cos(t * om + ph), mv = Math.min(1, Math.abs(vel) * 3);
      if (p.axis === 'z') z = mid + amp * ss; else x = mid + amp * ss;
      const want = p.axis === 'z' ? (vel >= 0 ? 0 : Math.PI) : (vel >= 0 ? Math.PI / 2 : -Math.PI / 2);
      if (o.turn) { let d = want - (p.cur ?? want); d = Math.atan2(Math.sin(d), Math.cos(d)); p.cur = (p.cur ?? want) + d * .2; ry = p.cur; } else ry = p.cur ?? want;
      bob = Math.abs(Math.sin(t * 7 + ph)) * .018 * mv; roll = Math.sin(t * 7 + ph) * .035 * mv; lean *= mv; hy = (1 - mv) * Math.sin(t * .5 + ph) * .5;
      const sw = Math.sin(t * 7 + ph) * .42 * mv;
      if (p.carry) { R = [.28, -.2, 1.2]; Lh = [.28, -.2, 1.2]; } else { R = [sw + .06, .1, .3 + Math.max(0, sw) * .5]; Lh = [-sw + .06, .1, .3 + Math.max(0, -sw) * .5]; }
      break;
    }
    case 'climb': { const k = ((t * (p.v || .06) + ph / TAU) % 1), pt = p.path(k); x = pt[0]; y = pt[1]; z = pt[2]; ry = pt[3]; bob = Math.abs(Math.sin(t * 7)) * .015; roll = Math.sin(t * 7) * .03; const sw = Math.sin(t * 7) * .3; R = [sw + .1, .1, .35]; Lh = [-sw + .1, .1, .35]; break; }
    case 'stand': roll = Math.sin(t * .5 + ph) * .022; yawO = Math.sin(t * .23 + ph) * .1; hy = Math.sin(t * .17 + ph * 2) * .45; R = [.08 + Math.sin(t * .5 + ph) * .04, .13, .18]; Lh = [.08 - Math.sin(t * .5 + ph) * .04, .13, .18]; if (p.hands) { R = Lh = [.3, -.28, 1.15]; } break;
    case 'talk': case 'listen': {
      const speak = Math.sin(t * .75 + ph) > 0;   // 話す番と聞く番。話す人は片手で身ぶりをする
      lean += speak ? .06 : 0; hp += speak ? Math.sin(t * 5.2 + ph) * .06 : (Math.sin(t * 1.3 + ph) * .5 + .5) * .08;
      roll = Math.sin(t * .6 + ph) * .016; yawO = speak ? Math.sin(t * 1.7 + ph) * .06 : 0; bob = seated ? Math.sin(t * 1.4 + ph) * .002 : 0;
      const g = speak ? (Math.sin(t * 2.6 + ph) * .5 + .5) : 0;
      if (seated) { R = speak ? [.45 + g * .3, .22, 1.0 + g * .45] : [.38, -.12, .85]; Lh = [.38, -.12, .85]; }
      else { R = speak ? [.3 + g * .35, .26, .85 + g * .6] : [.12, .13, .25]; Lh = p.hold ? [.3, -.15, 1.1] : [.1, .13, .2]; }
      break;
    }
    case 'sit': case 'look': bob = Math.sin(t * 1.4 + ph) * .002; hy = p.kind === 'look' ? Math.sin(t * .3 + ph) * .12 : Math.sin(t * .2 + ph) * .35; R = Lh = [.38, -.12, .85]; if (p.hold === 'cup') R = [.42, -.1, 1.35]; break;
    case 'type': hp += Math.sin(t * 9 + ph) * .025; lean += Math.sin(t * 2.3 + ph) * .012; R = [.5, -.12, 1.0 + Math.sin(t * 9 + ph) * .06]; Lh = [.5, -.12, 1.0 + Math.sin(t * 9 + ph + 1.7) * .06]; break;
    case 'write': hp += Math.sin(t * 1.3 + ph) * .08; yawO = Math.sin(t * .9 + ph) * .05; R = [.55, -.15, 1.05 + Math.sin(t * 3 + ph) * .06]; Lh = [.45, -.05, .9]; break;
    case 'read': { const q = (t * .15 + ph / TAU) % 1; hp -= q > .9 ? Math.sin((q - .9) / .1 * Math.PI) * .55 : 0; R = Lh = [.34, -.3, 1.45]; break; }
    case 'bend': lean += Math.sin(t * .8 + ph) * .05; hp += Math.sin(t * .8 + ph) * .05; R = [.3 + Math.sin(t * 1.6 + ph) * .08, .05, .6]; Lh = [.22, .05, .5]; break;
    case 'crouch': bob = Math.sin(t * 1.1 + ph) * .004; hy = Math.sin(t * .4 + ph) * .2; R = [.62, .05, .55]; Lh = [.5, .1, .5]; break;
    case 'reach': bob = (Math.sin(t * .9 + ph) * .5 + .5) * .012; R = [2.55 + Math.sin(t * .9 + ph) * .1, .12, .15]; Lh = [.1, .12, .2]; break;
  }
  hy += p.hy0 || 0;
  return { x, y, z, ry, bob, roll, yawO, hy, sy, lean, hp, seated, R, L: Lh };
}
const _qB = new THREE.Quaternion(), _qA = new THREE.Quaternion(), _qT = new THREE.Quaternion(), _eB = new THREE.Euler(), _v1 = new THREE.Vector3(), _v2 = new THREE.Vector3();
const AXX = new THREE.Vector3(1, 0, 0), AXZ = new THREE.Vector3(0, 0, 1);
/* 手の位置(体の座標 → 建物の中の座標)。side: 1 右、-1 左 */
function handOf(p, side, t = 0) {
  const q = poseOf(p, t), [a, sp2, e] = side > 0 ? q.R : q.L;
  _eB.set(q.lean, q.ry + q.yawO, q.roll, 'YXZ'); _qB.setFromEuler(_eB);
  const base = new THREE.Vector3(q.x, q.y + (q.seated ? PERSON.sitY : 0) + q.bob, q.z);
  const sh = _v1.set(side * LIMB.shoulder[0], q.sy * LIMB.shoulder[1], 0).applyQuaternion(_qB).add(base);
  _qA.setFromAxisAngle(AXX, -a).multiply(_qT.setFromAxisAngle(AXZ, side * sp2)).premultiply(_qB);
  const el = sh.clone().add(_v2.set(0, -LIMB.upper, 0).applyQuaternion(_qA));
  _qA.multiply(_qT.setFromAxisAngle(AXX, -e));
  return el.add(_v2.set(0, -LIMB.fore, 0).applyQuaternion(_qA));
}
/* 手に持つ物。両手の間(本・カード)か、左手(カルテ・カップ)に置き、人の向きに合わせる */
function held(E, p) {
  if (!p.hold) return;
  const P = E.P, both = p.kind === 'read' || p.carry, q = poseOf(p, 0);
  const hR = handOf(p, 1), hL = handOf(p, -1), at = both ? hR.clone().add(hL).multiplyScalar(.5) : hL;
  const moving = p.kind === 'walk';
  // 歩く人の物は、人の足もとを原点・人の向きを 0 とした座標で作り、毎フレーム人に合わせて置き直す
  let lx = 0, lz = 0;
  if (moving) { const dx = at.x - q.x, dz = at.z - q.z, c = Math.cos(q.ry), s2 = Math.sin(q.ry); lx = dx * c - dz * s2; lz = dx * s2 + dz * c; }
  const B = moving ? E.H : E.S, v0 = B.n, g = moving ? grp(B, 0, at.y - q.bob, 0, 0) : grp(B, at.x, at.y, at.z, q.ry + q.yawO);
  if (p.hold === 'book') g.box(lx - .026, .012, lz, .05, .005, .064, P.paper, 0, .22).box(lx + .026, .012, lz, .05, .005, .064, P.paper, 0, -.22).box(lx, .006, lz, .1, .006, .068, P.books[(p.li ?? 3) % P.books.length]);
  else if (p.hold === 'card') g.box(lx, .01, lz, .05, .004, .07, P.paper, -.6);
  else if (p.hold === 'chart') g.box(lx, -.04, lz + .01, .055, .075, .006, P.woodDark, -.25).box(lx, -.036, lz + .014, .048, .062, .003, P.paper, -.25);
  else if (p.hold === 'clip') g.box(lx, .0, lz, .07, .006, .09, P.woodDark, -.5).box(lx, .004, lz, .062, .004, .078, P.paper, -.5);
  else if (p.hold === 'cup') g.cyl(lx, -.006, lz, .013, .024, P.trim).cyl(lx, .017, lz, .011, .002, '#6B4A35');
  if (moving) E.movers.push({ p, v: [v0, B.n] });
}
/* 手に持つ物を、すべての人に(話す組の向きが決まったあとで)置く */
function heldAll(E) { for (const p of E.people) held(E, p); }
function buildPeople(E, u0) {
  const L = E.people; if (!L.length) return null;
  const feet = u0.uPpl.value;
  const uniforms = Object.assign({}, u0, { uSelf: { value: new THREE.Vector3(...PSELF_DAY) } });
  const bodyMat = inMat(uniforms, { vc: false }), headMat = inMat(uniforms, {});
  // 腕は二の腕と前腕を2本ずつ、座る人は腿とすねも2本ずつ。人ごとに、インスタンスの場所を割り当てる
  let nl = 0; for (const p of L) { p.li = nl; p.ln = !E.limbs ? 0 : SEATED.has(p.kind) && !p.stand ? 8 : 4; nl += p.ln; }
  const body = new THREE.InstancedMesh(BODY_GEO, bodyMat, L.length), head = new THREE.InstancedMesh(HEAD_GEO, headMat, L.length), limbs = nl ? new THREE.InstancedMesh(LIMB_GEO, bodyMat, nl) : null;
  body.castShadow = true; body.receiveShadow = true; head.receiveShadow = true; if (limbs) limbs.receiveShadow = true;
  const c = new THREE.Color();
  L.forEach((p, i) => {
    body.setColorAt(i, c.set(p.cloth)); head.setColorAt(i, c.set(p.skin));
    // 袖: 二の腕は服、前腕は半袖なら肌。脚: ズボンの色
    const cols = [p.cloth, p.sleeve === 'short' ? p.skin : p.cloth, p.cloth, p.sleeve === 'short' ? p.skin : p.cloth, p.pants, p.pants, p.pants, p.pants];
    for (let j = 0; j < p.ln; j++) limbs.setColorAt(p.li + j, c.set(cols[j]));
  });
  const M = new THREE.Matrix4(), qB = new THREE.Quaternion(), qH = new THREE.Quaternion(), qL = new THREE.Quaternion(), qT = new THREE.Quaternion(), eB = new THREE.Euler(), eH = new THREE.Euler(), v = new THREE.Vector3(), w = new THREE.Vector3(), j1 = new THREE.Vector3(), s = new THREE.Vector3(), ZERO = new THREE.Vector3(0, 0, 0);
  // 2節の腕・脚を置く: 体の座標 (lx, ly, 0) の関節から、前へ a・外へ sp に向け、長さ l1。そこから曲げ e で長さ l2
  const chain = (j, lx, ly, a, sp2, e, l1, l2, r1, r2) => {
    if (!limbs) return;
    w.set(lx, ly, 0).applyQuaternion(qB).add(v);
    qL.setFromAxisAngle(AXX, -a).multiply(qT.setFromAxisAngle(AXZ, sp2)).premultiply(qB);
    limbs.setMatrixAt(j, M.compose(w, qL, s.set(r1, l1, r1)));
    j1.set(0, -l1, 0).applyQuaternion(qL).add(w);
    qL.multiply(qT.setFromAxisAngle(AXX, -e));
    limbs.setMatrixAt(j + 1, M.compose(j1, qL, s.set(r2, l2, r2)));
  };
  const hideLimbs = p => { for (let j = 0; j < p.ln; j++) limbs.setMatrixAt(p.li + j, M.compose(w.set(0, -10, 0), qL.identity(), ZERO)); };   // p.ln が 0 なら何もしない
  let mode = 'day';
  function place(t) {
    L.forEach((p, i) => {
      const hidden = (mode === 'night' && !p.night) || (mode !== 'night' && !p.day);
      if (hidden) { body.setMatrixAt(i, M.compose(v.set(0, -10, 0), qB.identity(), ZERO)); head.setMatrixAt(i, M.compose(v.set(0, -10, 0), qB.identity(), ZERO)); hideLimbs(p); if (i < NPPL) feet[i].w = 0; return; }
      const q = poseOf(p, t, { turn: true });
      if (p.kind === 'walk') { p.wx = q.x; p.wz = q.z; p.wry = q.ry; p.wb = q.bob; }
      // 足もとの陰(座る人・寝る人は、椅子やベッドの陰に任せる)
      if (i < NPPL && !E.noContact) feet[i].set(q.x, q.y + .012, q.z, q.seated || p.kind === 'lie' ? 0 : p.kind === 'crouch' ? .13 : .11);
      if (p.kind === 'lie') {
        // 体を倒して(顔は上)、ry の向きに頭。(x, y, z) は体の真ん中の芯
        eB.set(-Math.PI / 2, q.ry, 0, 'YXZ'); qB.setFromEuler(eB);
        const hx = -Math.sin(q.ry), hz = -Math.cos(q.ry), br = Math.sin(t * 1.1 + p.ph) * .002;
        body.setMatrixAt(i, M.compose(v.set(q.x - hx * .2, q.y + br, q.z - hz * .2), qB, s.set(1, 1, 1)));
        head.setMatrixAt(i, M.compose(v.set(q.x + hx * .205, q.y + .006, q.z + hz * .205), qB, s.set(1, 1, 1)));
        hideLimbs(p);
        return;
      }
      // 体は足もと(座る人は座面)を軸に傾ける。頭は体の上に乗り、俯き・振り向きで向きが変わる(髪の見え方で分かる)
      eB.set(q.lean, q.ry + q.yawO, q.roll, 'YXZ'); qB.setFromEuler(eB);
      v.set(q.x, q.y + (q.seated ? PERSON.sitY : 0) + q.bob, q.z);
      body.setMatrixAt(i, M.compose(v, qB, s.set(1, q.sy, 1)));
      w.set(0, q.sy * .36 + .045, 0).applyQuaternion(qB).add(v);
      eH.set(q.hp, q.hy, 0, 'YXZ'); qH.setFromEuler(eH).premultiply(qB);
      head.setMatrixAt(i, M.compose(w, qH, s.set(1, 1, 1)));
      // 腕(肩から、ひじで曲がる)と、座る人の脚(腿は座面の高さで前へ、すねは床へ)
      const shY = q.sy * LIMB.shoulder[1];
      chain(p.li, LIMB.shoulder[0], shY, q.R[0], q.R[1], q.R[2], LIMB.upper, LIMB.fore, LIMB.armR, LIMB.foreR);
      chain(p.li + 2, -LIMB.shoulder[0], shY, q.L[0], -q.L[1], q.L[2], LIMB.upper, LIMB.fore, LIMB.armR, LIMB.foreR);
      if (p.ln > 4) {
        const kneeY = q.y + PERSON.sitY + LIMB.hip[1] - LIMB.thigh * Math.sin(.1), shin = clamp(kneeY - p.fy + .004, .04, .17);
        for (const sd of [1, -1]) chain(p.li + (sd > 0 ? 4 : 6), sd * LIMB.hip[0], LIMB.hip[1], Math.PI / 2 - .1 - q.lean, sd * .04, -(Math.PI / 2 - .1), LIMB.thigh, shin, LIMB.legR, LIMB.shinR);
      }
    });
    body.instanceMatrix.needsUpdate = true; head.instanceMatrix.needsUpdate = true; if (limbs) limbs.instanceMatrix.needsUpdate = true;
  }
  place(0);
  return {
    body, head, limbs, uniforms, update: place,
    setMode(m) { mode = m; },
    dispose() { bodyMat.dispose(); headMat.dispose(); body.dispose(); head.dispose(); if (limbs) limbs.dispose(); }
  };
}

/* ================================================================
   部屋の殻: 側面と奥の壁の内側・床・階の床(天井の厚み)・切り口
   ================================================================ */
function shellRect(E, o = {}) {
  const { w, d } = E.box, S = E.S, P = E.P, wt = .045, pc = P.poche, pl = P.cutLight, N = E.N;
  const x0 = -w / 2 + .004, x1 = w / 2 - .004, zb = E.zb + .004, zf = E.zf;
  const X0 = -w / 2 - .006, X1 = w / 2 + .006, ZB = E.zb - .006;   // 外側の壁の内側の面まで(すき間を残さない)
  const ix0 = x0 + wt, ix1 = x1 - wt, izb = zb + wt;                // 部屋の内側の面
  const H = E.box.h;
  // 奥の壁と側面の壁(内側の面)
  bb(S, x0, x1, 0, H - .012, zb, zb + wt, o.wall || P.inWall);
  bb(S, x0, ix0, 0, H - .012, zb, zf - .006, o.side || P.inWall2);
  bb(S, ix1, x1, 0, H - .012, zb, zf - .006, o.side || P.inWall2);
  // 切り口: 部屋を囲む細い藍の線(幅 N)と、その外の壁の厚みの淡い面。断面図のように「細く、くっきり」
  //   上の端(屋根を外した所)・側面の壁の前の端・階の床の前の端・地面の床の前の端
  pb(S, ix0 - N, ix1 + N, H - .012, H, izb - N, izb, pc); pb(S, X0, X1, H - .0125, H - .0005, ZB, izb - N, pl);
  for (const [a0, a1, b0, b1] of [[ix0 - N, ix0, X0, ix0 - N], [ix1, ix1 + N, ix1 + N, X1]]) {
    pb(S, a0, a1, H - .012, H, izb - N, zf, pc); pb(S, b0, b1, H - .0125, H - .0005, ZB, zf, pl);
    pb(S, a0, a1, -.05, H, zf - .006, zf, pc); pb(S, b0, b1, -.05, H - .0005, zf - .0065, zf - .0005, pl);
  }
  pb(S, ix0 - N, ix1 + N, .012 - N, .012, zf - .006, zf, pc); pb(S, X0, X1, -.05, .012 - N, zf - .0065, zf - .0005, pl);
  for (let i = 0; i < E.floors; i++) {
    const y = E.fy(i);
    if (i > 0) { pb(S, ix0, ix1, y + .012 - N, y, izb, zf - .006, pc); pb(S, ix0 - N, ix1 + N, y + .012 - N, y + .012, zf - .006, zf, pc); }
    const fc = Array.isArray(o.floor) ? o.floor[i] : o.floor || P.vinyl;
    E.fc[i] = fc;
    bb(S, ix0, ix1, y, y + .012, izb, zf - .006, fc);
    // 腰壁と幅木(奥の壁)
    bb(S, ix0, ix1, y + .012, y + .2, izb, izb + .006, o.wainscot || P.wainscot);
    bb(S, ix0, ix1, y + .012, y + .035, izb, izb + .01, o.skirt || P.cutLine);
    bb(S, ix0, ix1, y + .2, y + .212, izb, izb + .01, o.band || P.cut);
    // 側面の壁の幅木
    for (const sx of [ix0, ix1]) bb(S, sx - (sx > 0 ? .008 : 0), sx + (sx > 0 ? 0 : .008), y + .012, y + .035, izb, zf - .01, o.skirt || P.cutLine);
    // 上に階がある階は、天井から吊るした灯り(床の暖かいにじみの光源)
    if (i < E.floors - 1) pendants(E, E.fy(i + 1) + .012 - N);
  }
  return { x0: ix0, x1: ix1, zb: izb, zf, wt };
}
/* 天井から吊るした灯り(灯りの列の位置。夜はかさが灯る) */
function pendants(E, yc) {
  const P = E.P, k = E.k;
  for (const x of E.lamps.xs) grp(E.S, x, yc - .125 * k, E.lamps.zp).box(0, .055 * k, 0, .004, .07 * k, .004, P.dark).cone(0, 0, 0, .05 * k, .055 * k, mix(P.trim, '#F4E3C2', .4), .9).cyl(0, -.004, 0, .03 * k, .006, '#FFF3D6', false, 0, 0, 1.6);
}
/* 奥の壁の窓(内側から見た空)。夜は暗い空に */
function backWindow(E, x, y, w, h, zb) {
  const S = E.S, P = E.P;
  bb(S, x - w / 2 - .02, x + w / 2 + .02, y - .02, y + h + .02, zb, zb + .012, P.trim);
  bb(S, x - w / 2, x + w / 2, y, y + h, zb + .006, zb + .016, mix(P.glass, '#DDEBF2', .45));
  bb(S, x - .006, x + .006, y, y + h, zb + .016, zb + .02, P.trim);
}

/* ---------- 家具 ---------- */
function chair(E, b, y, x, z, ry, c) { const k = E.k; grp(b, x, y, z, ry).foot(0, 0, .1 * k, .1 * k, .7, .045).cyl(0, 0, 0, .04 * k, .008, E.P.metalDark).box(0, 0, 0, .022 * k, .1 * k, .022 * k, E.P.metalDark).rbox(0, .098 * k, 0, .1 * k, .024 * k, .1 * k, .008, c || E.P.chair).rbox(0, .12 * k, -.046 * k, .1 * k, .11 * k, .018 * k, .008, c || E.P.chair); }
function desk(E, b, y, x, z, w, d, ry = 0, top, hgt = .19) { const k = E.k; grp(b, x, y, z, ry).foot(0, 0, w * .9, d * .8, .76, .06).box(0, hgt * k - .016, 0, w, .016, d, top || E.P.desk).box(-w / 2 + .02, 0, 0, .016, hgt * k - .016, d - .02, E.P.metal).box(w / 2 - .02, 0, 0, .016, hgt * k - .016, d - .02, E.P.metal); }
function plant(E, b, y, x, z, s = 1, i = 0) { const k = E.k * s; contact(E, x, y, z, .09 * k, .09 * k, { round: true, k: .7, s: .05 }); cy(b, x, y, z, .05 * k, .09 * k, E.P.pot); sp(b, x, y + .15 * k, z, .085 * k, E.P.leaf[i % 4], 1.15); sp(b, x + .035 * k, y + .21 * k, z - .01, .055 * k, E.P.leaf[(i + 1) % 4]); }
function lampTable(E, b, y, x, z, c) { const k = E.k; cy(b, x, y, z, .018 * k, .004, E.P.dark); bx(b, x, y, z, .006, .07 * k, .006, E.P.dark); grp(b, x, y + .07 * k, z).cone(0, 0, 0, .03 * k, .03 * k, c || '#F4EAD4', 1); }

/* にじみの枠: 画面(w × h)の縁から m 外を内側の縁に、g の幅で 0 へ消える。色 c は内側の縁の色 */
const HALO = new Map();
function haloGeo(w, h, m, g, c) {
  const key = [w, h, m, g, ...c].map(v => (+v).toFixed(3)).join('|');
  if (HALO.has(key)) return HALO.get(key);
  const a = w / 2 + m, b = h / 2 + m, pos = [], cl = [];
  const ring = d => [[-a - d, -b - d], [a + d, -b - d], [a + d, b + d], [-a - d, b + d]];
  const R = [[ring(0), 1], [ring(g * .22), .55], [ring(g * .55), .2], [ring(g), 0]];    // 内の縁から、尾を引いて柔らかく消える
  const put = (v, k) => { pos.push(v[0], v[1], 0); cl.push(c[0] * k, c[1] * k, c[2] * k); };
  for (let r = 0; r < R.length - 1; r++) {
    const [I, ki] = R[r], [O, ko] = R[r + 1];
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; put(I[i], ki); put(O[i], ko); put(O[j], ko); put(I[i], ki); put(O[j], ko); put(I[j], ki); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => i % 3 === 2 ? 1 : 0), 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(cl, 3));
  HALO.set(key, geo); return geo;
}

/* ---------- 道具の物(station) ----------
   holder(H) に物の体、SC に画面の四角。lift は持ち上がる向き、anchor は札の位置 */
function station(E, id, o) {
  const lay = E.layout[id] || {};
  const S = { id, liftVec: o.lift || [0, .03, .015], flicker: o.flicker || 0, move: o.move || null, canvas: o.canvas || null, glass: !!o.glass };
  const h0 = E.H.n;
  // scale: 物ぜんたいを何倍にするか(公園の小物を、ひらいた画面で見分けやすくする)
  const base = { x: lay.x ?? o.x, y: o.y, z: lay.z ?? o.z, ry: lay.ry ?? (o.ry || 0), s: o.scale || 1 };
  if (o.holder) o.holder(grp(E.H, base.x, base.y, base.z, base.ry, base.s), base);
  // ガラスの画面の縁: 枠のまわりに、細い明るい縁(アルミの面取りのように)。o.bezel は画面の外の枠の幅
  if (o.glass && o.rim !== false && o.screen) {
    const q0 = base.s, sw = o.screen.w * q0, sh = o.screen.h * q0, bz = (o.bezel ?? .012) * q0, lw = .0035, gr = grp(E.H, base.x, base.y, base.z, base.ry);
    const cx = o.screen.x * q0, cy2 = o.screen.y * q0, cz = o.screen.z * q0 + .0012, t2 = -(o.screen.tilt || 0), rc = mix(E.P.metal, '#FFFFFF', .35);
    const W2 = sw / 2 + bz, H2 = sh / 2 + bz, ct = Math.cos(-t2), st = Math.sin(-t2);
    // 縁の4本(画面の傾きに合わせて、画面の面の上に置く)
    for (const [ux, uy, bw, bh] of [[0, H2, 2 * W2 + lw, lw], [0, -H2, 2 * W2 + lw, lw], [-W2, 0, lw, 2 * H2], [W2, 0, lw, 2 * H2]]) {
      const yy = cy2 + uy * ct - bh / 2 * ct, zz = cz - uy * st + bh / 2 * st;
      gr.box(cx + ux, yy, zz, bw, bh, .003, rc, t2);
    }
  }
  S.h = [h0, E.H.n];
  // 夜、画面の光が机に落ちる所(昼は面の色のままで見えない)。o.spill: [x, y, z, 幅, 奥行き, 面の色](物の座標)
  if (o.spill) { const [lx2, ly2, lz2, sw2, sd2, sc2] = o.spill, cs2 = Math.cos(base.ry), sn2 = Math.sin(base.ry), q2 = base.s; E.S.add(spillGeo(sw2 * q2, sd2 * q2, .05), mtx(base.x + (lx2 * cs2 + lz2 * sn2) * q2, base.y + ly2 * q2 + .0016, base.z + (-lx2 * sn2 + lz2 * cs2) * q2, 1, 1, 1, base.ry), sc2, -.3); }
  // 画面: 物の座標(sx, sy, sz)に、幅 sw・高さ sh、向き(ry と、上向きの傾き tilt。0=正面を向く、π/2=上を向く)
  const q = base.s, sc = Object.assign({}, o.screen, { x: o.screen.x * q, y: o.screen.y * q, z: o.screen.z * q, w: o.screen.w * q, h: o.screen.h * q });
  const cs = Math.cos(base.ry), sn = Math.sin(base.ry);
  const wx = base.x + sc.x * cs + sc.z * sn, wz = base.z - sc.x * sn + sc.z * cs, wy = base.y + sc.y;
  const s0 = E.SC.n;
  E.SC.add(G.plane, mtx(wx, wy, wz, sc.w, sc.h, 1, base.ry + (sc.ry || 0), -(sc.tilt || 0)), '#FFFFFF');
  S.sc = [s0, E.SC.n];
  // にじみの枠(画面の縁の外へ、柔らかく消える)。ガラスの画面は青白く、紙や板は暖かく
  const h0l = E.HL.n, nrm = new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(-(sc.tilt || 0), base.ry + (sc.ry || 0), 0, 'YXZ'));
  // にじみは縁(枠)の外から始める(枠の上に重ねると、白い縁取りに見えるため)。o.bezel: 画面の外の枠の幅
  E.HL.add(haloGeo(sc.w, sc.h, (o.bezel ?? .012) * q, Math.min(.07, .024 + .08 * Math.max(sc.w, sc.h)), S.glass ? [.82, .9, 1] : [1, .9, .74]), mtx(wx + nrm.x * .003, wy + nrm.y * .003, wz + nrm.z * .003, 1, 1, 1, base.ry + (sc.ry || 0), -(sc.tilt || 0)), '#FFFFFF');
  S.hl = [h0l, E.HL.n];
  S.sw = sc.w; S.sh = sc.h;
  S.anchor = [wx, wy + (sc.tilt > .9 ? .05 : sc.h / 2 + .05), wz];
  S.base = base;
  S.radius = Math.max(sc.w, sc.h) * .6 + .06;
  E.stations.push(S);
  return S;
}

/* ================================================================
   建物ごとの中
   ================================================================ */
const BUILD = {
  /* ---------- 病院: 1階 受付 / 2階 ナースステーション / 3階 休憩室と病室 ---------- */
  hospital(E) {
    const P = E.P, S = E.S, k = E.k, X = E.X, Z = E.Z;
    const R = shellRect(E, { floor: [P.stone, mix(P.vinyl, P.tealSoft, .22), P.floorWood], band: P.teal, wainscot: mix(P.wainscot, P.tealSoft, .25) });
    const f = [E.fy(0) + .012, E.fy(1) + .012, E.fy(2) + .012];
    // ---- 1階 受付(手前に寄せる。下の階は上の床に隠れやすい) ----
    const cz = Z(.32);
    grp(S, X(-.75), f[0], cz).foot(0, 0, 1.3 * k, .2 * k).rbox(0, 0, 0, 1.3 * k, .25 * k, .2 * k, .02, P.trim).box(0, .25 * k, -.01, 1.34 * k, .022, .25 * k, P.deskWood).box(0, .09 * k, .102 * k, 1.3 * k, .022, .004, P.teal);
    station(E, 'nidodema', {
      x: X(-.72), y: f[0] + .272 * k, z: cz - .02, ry: -.28, glass: true, bezel: .013, spill: [-.03, 0, .07, .26, .1, P.deskWood],
      holder: g => g.box(-.03, 0, -.02, .05, .012, .05, P.dark).box(-.03, .01, -.025, .014, .06, .014, P.dark).box(-.03, .055, -.02, .3 * k, .19 * k, .018, P.frame)
        .box(-.27, 0, 0, .12, .05, .09, '#5E656D').box(-.27, .05, -.02, .1, .012, .05, P.paper).box(-.27, .052, .03, .06, .004, .03, '#C9D3DA')
        .box(.17, 0, -.01, .08, .05, .06, P.paper).box(.18, .05, -.008, .078, .03, .058, '#F1EDE4').box(.27, 0, .01, .07, .035, .06, P.paper),
      screen: { x: -.03, y: .055 + .095 * k, z: -.01, w: .27 * k, h: .165 * k }
    });
    person(E, X(-1.05), f[0], cz - .26, 0, { kind: 'type', cloth: P.office, night: false });
    talk(person(E, X(-.38), f[0], cz - .27, 0, { cloth: P.coat, night: true, hold: 'chart' }), person(E, X(-.5), f[0], cz + .3, Math.PI, { cloth: P.casual[0] }));   // 受付で話す(カルテを持つ)
    // 待合のベンチ(受付を向く)
    for (const bz of [Z(.2), Z(.66)]) grp(S, X(.88), f[0], bz).foot(0, 0, .8 * k, .13 * k).box(0, 0, 0, .8 * k, .012, .012, P.metalDark).box(-.34 * k, 0, 0, .016, .1 * k, .13 * k, P.metalDark).box(.34 * k, 0, 0, .016, .1 * k, .13 * k, P.metalDark).rbox(0, .1 * k, 0, .8 * k, .03 * k, .14 * k, .01, P.chair).rbox(0, .13 * k, -.06 * k, .8 * k, .12 * k, .025 * k, .01, P.chair);
    person(E, X(.65), f[0] + .015, Z(.2), 0, { kind: 'read', cloth: P.casual[1], fy: f[0], hold: 'book' });
    person(E, X(1.1), f[0] + .015, Z(.2), 0, { kind: 'look', cloth: P.casual[4], hy0: -.5, fy: f[0] });
    person(E, X(.8), f[0] + .015, Z(.66), 0, { kind: 'sit', cloth: P.casual[2], fy: f[0], hold: 'cup' });
    // 車いすの人
    const wc = grp(S, X(.2), f[0], Z(.72), -Math.PI / 2);
    wc.foot(0, 0, .14 * k, .12 * k).box(0, .1 * k, 0, .1 * k, .015, .1 * k, P.dark).box(0, .11 * k, -.05 * k, .1 * k, .1 * k, .012, P.dark).cyl(-.06 * k, 0, 0, .07 * k, .01, P.metalDark, false, 0, Math.PI / 2).cyl(.06 * k, 0, 0, .07 * k, .01, P.metalDark, false, 0, Math.PI / 2);
    person(E, X(.2), f[0] - .03, Z(.72), -Math.PI / 2, { kind: 'sit', cloth: P.casual[3] });
    // 1階の奥の壁: 案内の札と時計
    bb(S, X(-.95), X(-.35), f[0] + .52, f[0] + .64, R.zb, R.zb + .01, P.teal); bb(S, X(-.9), X(-.6), f[0] + .565, f[0] + .595, R.zb + .01, R.zb + .014, '#FFFFFF');
    grp(S, X(.55), f[0] + .55, R.zb + .005).cyl(0, 0, 0, .05, .012, P.trim, false, Math.PI / 2).box(0, .0, .008, .006, .035, .004, P.dark).box(.012, .0, .008, .03, .006, .004, P.dark);
    plant(E, S, f[0], X(1.45), Z(.88), 1.2, 0); plant(E, S, f[0], X(-1.45), Z(.85), 1.1, 2);
    grp(S, X(.05), f[0], Z(.72)).box(0, 0, 0, .1, .012, .06, P.dark).box(0, 0, 0, .012, .2 * k, .012, P.dark).box(0, .2 * k, 0, .14 * k, .08 * k, .012, P.teal);
    person(E, X(.5), f[0], Z(.9), Math.PI / 2, { kind: 'walk', x0: X(-.3), x1: X(1.3), v: .26, cloth: P.casual[4] });

    // ---- 2階 ナースステーション ----
    const nz = Z(.3);
    grp(S, X(.35), f[1], nz).foot(0, 0, 1.25 * k, .18 * k).rbox(0, 0, 0, 1.25 * k, .26 * k, .18 * k, .02, P.trim).box(0, .26 * k, 0, 1.3 * k, .02, .23 * k, P.tealSoft).box(0, .06 * k, .092 * k, 1.25 * k, .018, .004, P.teal);
    grp(S, X(.35), f[1] + .26 * k + .02, nz - .03).box(-.35, 0, 0, .05, .01, .04, P.dark).box(-.35, 0, -.01, .012, .05, .012, P.dark).box(-.35, .04, 0, .2 * k, .12 * k, .014, P.frame).box(.25, 0, 0, .05, .01, .04, P.dark).box(.25, 0, -.01, .012, .05, .012, P.dark).box(.25, .04, 0, .2 * k, .12 * k, .014, P.frame);
    for (const dx of [-.35, .25]) bx(S, X(.35) + dx, f[1] + .26 * k + .02 + .05, nz - .022, .17 * k, .1 * k, .004, '#BCD5DC', 0, .6);
    person(E, X(.0), f[1], nz - .22, 0, { kind: 'type', cloth: P.scrub, night: true });
    person(E, X(.75), f[1], nz - .24, -.3, { kind: 'write', stand: true, cloth: P.scrubNavy });
    // 掲示板(掲示じたく)。キャスター付きのコルクの板に、紙
    station(E, 'keiji', {
      x: X(-1.0), y: f[1], z: Z(.45), ry: .32, lift: [0, .012, .035],
      holder: g => g.box(-.24 * k, 0, 0, .014, .48 * k, .014, P.metalDark).box(.24 * k, 0, 0, .014, .48 * k, .014, P.metalDark).box(0, .02, 0, .52 * k, .012, .06, P.metalDark)
        .box(0, .18 * k, 0, .52 * k, .34 * k, .02, P.cork).box(0, .175 * k, .0, .56 * k, .015, .028, P.woodDark)
        .box(-.18 * k, .38 * k, .012, .09 * k, .11 * k, .004, P.paper).box(.17 * k, .4 * k, .012, .1 * k, .08 * k, .004, '#F6EBD2').box(.18 * k, .26 * k, .012, .09 * k, .06 * k, .004, P.paper)
        .box(-.03 * k, .48 * k, .014, .016, .016, .006, '#C9583F').box(-.18 * k, .45 * k, .014, .014, .014, .006, '#E2B23E'),
      screen: { x: -.02 * k, y: .345 * k, z: .014, w: .17 * k, h: .23 * k }
    });
    // 薬のカート
    grp(S, X(1.35), f[1], Z(.55)).foot(0, 0, .16 * k, .11 * k).rbox(0, .02, 0, .16 * k, .2 * k, .11 * k, .01, P.trim).box(0, .22 * k, 0, .17 * k, .012, .12 * k, P.tealSoft).box(0, .06 * k, .056 * k, .15 * k, .03 * k, .004, '#A4CDEA').box(0, .12 * k, .056 * k, .15 * k, .03 * k, .004, '#BFE2B0').box(0, .18 * k, .056 * k, .15 * k, .025 * k, .004, '#F2D46B');
    person(E, X(.4), f[1], Z(.82), Math.PI / 2, { kind: 'walk', x0: X(-.35), x1: X(1.2), v: .3, cloth: P.scrub, night: true, carry: true, hold: 'clip' });
    person(E, X(1.14), f[1], Z(.56), Math.PI / 2, { kind: 'bend', cloth: P.scrubNavy, lean: .34 });   // 薬のカートで支度をする
    person(E, X(.1), f[1], Z(.6), Math.PI / 2, { kind: 'walk', x0: X(-.45), x1: X(.6), v: .07, cloth: P.blanket });   // 病衣でゆっくり歩く人

    // ---- 3階 休憩室(左)と病室(右)。屋根がひらくので、ここがいちばんよく見える ----
    const y3 = f[2];
    backWindow(E, X(-.85), y3 + .32, .5 * k, .36 * k, R.zb); backWindow(E, X(.55), y3 + .32, .42 * k, .36 * k, R.zb); backWindow(E, X(1.2), y3 + .32, .42 * k, .36 * k, R.zb);
    // 仕切りの壁(低い)
    bb(S, X(.02) - .02, X(.02) + .02, y3, y3 + .55 * k, R.zb, Z(.2), P.inWall2); bb(S, X(.02) - .022, X(.02) + .022, y3 + .55 * k - .01, y3 + .55 * k, R.zb, Z(.2), P.cut);
    // 休憩室: ソファ・机・自販機・敷物・掲示
    const sz0 = R.zb + .12;
    bb(S, X(-1.4), X(-.5), y3, y3 + .005, R.zb + .06, R.zb + .66 * k, mix(P.terraLight, P.sand, .45));
    bb(S, X(-.62), X(-.38), y3 + .5, y3 + .66, R.zb, R.zb + .01, P.cork);
    for (const [px, py, pc] of [[-.58, .55, P.paper], [-.48, .57, P.notes[0]], [-.43, .53, P.paper]]) bb(S, X(px), X(px) + .05, y3 + py, y3 + py + .06, R.zb + .01, R.zb + .014, pc);
    grp(S, X(-.95), y3, sz0).foot(0, 0, .62 * k, .2 * k).rbox(0, 0, 0, .62 * k, .09 * k, .2 * k, .03, P.sofa).rbox(0, .09 * k, .01, .56 * k, .03 * k, .17 * k, .02, P.cushion).rbox(0, .09 * k, -.085 * k, .62 * k, .14 * k, .05 * k, .02, P.sofa).rbox(-.29 * k, .09 * k, 0, .05 * k, .07 * k, .2 * k, .02, P.sofa).rbox(.29 * k, .09 * k, 0, .05 * k, .07 * k, .2 * k, .02, P.sofa);
    grp(S, X(-.95), y3, sz0 + .28 * k).foot(0, 0, .3 * k, .14 * k, .8).rbox(0, .08 * k, 0, .34 * k, .018, .16 * k, .008, P.deskWood).box(-.14 * k, 0, 0, .016, .08 * k, .12 * k, P.woodDark).box(.14 * k, 0, 0, .016, .08 * k, .12 * k, P.woodDark).cyl(-.06, .1 * k, .02, .013, .022, P.paper).cyl(.05, .1 * k, -.02, .013, .022, P.terraLight);
    const sp0 = person(E, X(-1.07), y3 + .015, sz0 + .04, 0, { kind: 'read', cloth: P.scrub, night: true, fy: y3 });   // 返信を考える人(スマホを見る)
    const hm0 = handOf(sp0, 1).add(handOf(sp0, -1)).multiplyScalar(.5);     // スマホは両手の間に
    station(E, 'yawagaeshi', {
      x: hm0.x, y: hm0.y - .012, z: hm0.z + .012, ry: 0, lift: [0, .035, .02], glass: true, bezel: .0055,
      holder: g => g.rbox(0, 0, 0, .075 * k, .14 * k, .012, .006, '#2A2F35'),
      screen: { x: 0, y: .07 * k, z: .0075, w: .064 * k, h: .128 * k, tilt: .35 }
    });
    person(E, X(-.72), y3 + .015, sz0 + .04, -.25, { kind: 'sit', cloth: P.coat, fy: y3, hold: 'cup' });
    grp(S, X(-.3), y3, R.zb + .1).foot(0, 0, .2 * k, .14 * k).rbox(0, 0, 0, .2 * k, .44 * k, .14 * k, .015, P.trim).box(0, .2 * k, .072 * k, .16 * k, .2 * k, .004, '#E7EEF2', 0, 0, .9).box(0, .07 * k, .072 * k, .12 * k, .05 * k, .004, P.dark);
    talk(person(E, X(-.56), y3, Z(.28), 0, { cloth: P.scrubNavy, hold: 'chart' }), person(E, X(-.26), y3, Z(.33), 0, { cloth: P.blanket }));   // 看護師と、病衣の人
    plant(E, S, y3, X(-1.45), Z(.4), 1.2, 1);
    // 病室: 横向きのベッド2台(頭は外の壁の側。寝ている人が横から見える)。見舞いの人と看護師はベッドの奥にいて、こちらを向く
    const bz = R.zb + .36 * k, bl = .54 * k, bw2 = .28 * k, mt = .145 * k;
    for (const [bx0, flip] of [[X(.5), 0], [X(1.18), 1]]) {
      grp(S, bx0, y3, bz, flip ? Math.PI : 0).foot(0, 0, bl, bw2)
        .box(0, 0, 0, bl, .1 * k, bw2, P.metal).rbox(0, .1 * k, 0, bl - .02, .045 * k, bw2 - .02, .015, P.sheet)
        .box(-bl / 2 - .01, 0, 0, .02, .26 * k, bw2, P.metal).box(bl / 2 + .01, 0, 0, .02, .17 * k, bw2, P.metal)
        .rbox(-bl / 2 + .075 * k, mt, 0, .09 * k, .035 * k, .17 * k, .014, '#FFFFFF')
        .rbox(.075 * k, mt - .006, 0, .35 * k, .072 * k, bw2 - .03, .03, P.blanket);
      person(E, bx0 + (flip ? -.02 : .02), y3 + mt + .004, bz, flip ? -Math.PI / 2 : Math.PI / 2, { kind: 'lie', cloth: P.tealSoft, night: true });
    }
    // 2台の間のカーテン(足もとの側)と、点滴の台
    const cx3 = (X(.5) + X(1.18)) / 2;
    bb(S, cx3 - .005, cx3 + .005, y3 + .03, y3 + .64 * k, R.zb + .03, R.zb + .56 * k, mix(P.tealSoft, '#FFFFFF', .25)); bb(S, cx3 - .015, cx3 + .015, y3 + .64 * k, y3 + .66 * k, R.zb + .02, R.zb + .6 * k, P.metal);
    grp(S, X(1.18) + bl / 2 - .04, y3, R.zb + .1).box(0, 0, 0, .1, .012, .1, P.metalDark).box(0, 0, 0, .012, .56 * k, .012, P.metal).box(0, .5 * k, 0, .04 * k, .07 * k, .02, '#DDE6EA', 0, 0, .5);
    chair(E, S, y3, X(.5) + .12, R.zb + .1, 0, P.chair2);
    person(E, X(.5) + .12, y3, R.zb + .1, -.15, { kind: 'read', cloth: P.casual[0], hold: 'book' });          // 見舞いの人が本を読む
    person(E, X(1.18) - .1, y3, R.zb + .1, .5, { kind: 'bend', cloth: P.scrub, night: true, lean: .3 });   // 看護師が患者をのぞく
    person(E, X(.8), y3, Z(.72), Math.PI / 2, { kind: 'walk', x0: X(.2), x1: X(1.4), v: .14, cloth: P.casual[3] });
    lampTable(E, S, y3 + .08 * k + .02, X(-.82), sz0 + .28 * k + .05, '#F3E3C2');
  },

  /* ---------- 展望台: 塔の中の階段と小部屋。1階 カードとカルテの棚 / 2階 ノート・窓辺・日誌 / 3階 地図の机とピンボード ---------- */
  observatory(E) {
    const P = E.P, S = E.S, k = E.k, H = E.box.h, R = E.box.w / 2 - .04, fl = E.floors;
    // 奥の半分の壁(内側を向く)
    const seg = E.low ? 14 : 22;
    const wallGeo = (() => {
      const g = new THREE.CylinderGeometry(R, R, 1, seg, 1, true, Math.PI / 2, Math.PI); // 奥の半分
      g.translate(0, .5, 0); g.scale(-1, 1, 1); g.computeVertexNormals(); // 内側を表に
      return ni(g);
    })();
    S.add(wallGeo, mtx(0, 0, 0, 1, H - .012, 1), P.inWall);
    // 切り口の塗り: 壁の上の端(半分の輪)と、正面で切った壁の両端。外側の塔の内側の面(Ro)まで
    const Ro = E.box.w / 2 + .006, pc = P.poche, pl = P.cutLight, N = E.N, Rn = R + N;
    const ringG = (r0, r1) => { const g = new THREE.RingGeometry(r0, r1, seg, 1, 0, Math.PI); g.rotateX(-Math.PI / 2); return ni(g); };
    S.add(ringG(R - .002, Rn), mtx(0, H, 0, 1, 1, 1), pc, 0, 1); S.add(ringG(Rn, Ro), mtx(0, H - .0005, 0, 1, 1, 1), pl, 0, .5);
    for (const sd of [1, -1]) { const [a0, a1] = sd > 0 ? [R - .004, Rn] : [-Rn, -R + .004], [b0, b1] = sd > 0 ? [Rn, Ro] : [-Ro, -Rn]; pb(S, a0, a1, -.05, H, -.006, 0, pc); pb(S, b0, b1, -.05, H - .0005, -.0065, -.0005, pl); }
    // 床と階の床(階段の穴は、階段が上の階へ抜ける奥の左)。階の床の切り口は藍。
    //   藍は床の外の輪と側面だけにする(床の上面と重ねると、遠くから見たときに放射状にちらつく)
    for (let i = 0; i < fl; i++) {
      const y = E.fy(i), th0 = i ? 4.35 : 0, thL = i ? TAU - 1.2 : TAU;
      const floorDisc = ni(new THREE.CylinderGeometry(R, R, 1, seg * 2, 1, false, th0, thL)).translate(0, .5, 0);
      const slabSide = ni(new THREE.CylinderGeometry(Rn, Rn, 1, seg * 2, 1, true, th0, thL)).translate(0, .5, 0);
      const slabTop = (() => { const g = new THREE.RingGeometry(R, Rn, seg * 2, 1, th0 - Math.PI / 2, thL); g.rotateX(-Math.PI / 2); return ni(g); })();
      S.add(floorDisc, mtx(0, y, 0, 1, .012, 1), P.floorWood); E.fc[i] = P.floorWood;
      S.add(slabSide, i ? mtx(0, y + .012 - N, 0, 1, N, 1) : mtx(0, -.05, 0, 1, .062, 1), pc, 0, 1);
      S.add(slabTop, mtx(0, y + .012, 0, 1, 1, 1), pc, 0, 1);
      if (i) grp(S, .12, y + .012 - N - .1 * k, -.12).box(0, .055 * k, 0, .004, .045 * k, .004, P.dark).cone(0, 0, 0, .05 * k, .055 * k, mix(P.trim, '#F4E3C2', .4), .9).cyl(0, -.004, 0, .03 * k, .006, '#FFF3D6', false, 0, 0, 1.6);   // 下の階の天井の灯り
      // 窓(奥の壁に2つ)
      for (const a of [-.55, .55]) {
        const ax = Math.sin(a) * (R - .01), az = -Math.cos(a) * (R - .01);
        grp(S, ax, y + .5 * k, az, -a).box(0, 0, 0, .16 * k, .28 * k, .012, P.trim).box(0, .02, .006, .12 * k, .24 * k, .01, mix(P.glass, '#DDEBF2', .45));
      }
    }
    // らせん階段(壁に沿って、各階から上の階へ)
    const steps = E.low ? 8 : 12;
    for (let i = 0; i < fl - 1; i++) {
      const y0 = E.fy(i), rise = E.fh / steps;
      for (let s = 0; s < steps; s++) {
        const a = Math.PI * 1.08 + s / steps * 1.2, r = R - .1;
        grp(S, Math.cos(a) * r, y0 + s * rise, Math.sin(a) * r, -a + Math.PI / 2).box(0, 0, 0, .16, rise, .07, P.deskWood);
      }
      bb(S, -R + .02, -R + .03, y0, y0 + E.fh, -.05, .05, P.metalDark);
    }
    const climb = (k2) => {
      const tot = fl - 1, seg2 = Math.min(tot - 1e-6, k2 * tot), i = Math.floor(seg2), u2 = seg2 - i;
      const a = Math.PI * 1.08 + u2 * 1.2, r = R - .1;
      return [Math.cos(a) * r, E.fy(i) + u2 * E.fh + .02, Math.sin(a) * r, -a];
    };
    person(E, 0, 0, 0, 0, { kind: 'climb', path: climb, v: .035, cloth: P.casual[1] });
    const f = i => E.fy(i) + .012;
    // ---- 1階: カードの棚(言いかえ帳)とカルテの棚 ----
    station(E, 'iikae', {
      x: .18, y: f(0), z: -.28, ry: -.35, lift: [0, .02, .03], scale: 1.25,
      holder: g => g.box(0, 0, 0, .3 * k, .32 * k, .1 * k, P.deskWood).box(0, .32 * k, 0, .32 * k, .014, .11 * k, P.woodDark)
        .box(-.1 * k, .06 * k, .052 * k, .06 * k, .07 * k, .004, P.paper).box(0, .06 * k, .052 * k, .06 * k, .07 * k, .004, '#F6EBD2').box(.1 * k, .06 * k, .052 * k, .06 * k, .07 * k, .004, P.paper)
        .box(-.1 * k, .18 * k, .052 * k, .06 * k, .07 * k, .004, '#E3EEF4').box(.1 * k, .18 * k, .052 * k, .06 * k, .07 * k, .004, P.paper),
      screen: { x: 0, y: .44 * k, z: .02, w: .22 * k, h: .15 * k, tilt: .2 }
    });
    station(E, 'karte', {
      x: -.22, y: f(0), z: -.25, ry: .45, lift: [0, .02, .03], scale: 1.25,
      holder: g => g.box(0, 0, 0, .2 * k, .36 * k, .08 * k, P.trim).box(0, .36 * k, 0, .21 * k, .012, .09 * k, P.cut)
        .box(-.06 * k, .02, .042 * k, .05 * k, .3 * k, .004, '#C8D7C4').box(.0, .02, .042 * k, .05 * k, .3 * k, .004, '#E7D2C2').box(.06 * k, .02, .042 * k, .05 * k, .3 * k, .004, '#C9D6E2'),
      screen: { x: 0, y: .5 * k, z: .02, w: .13 * k, h: .18 * k, tilt: .12 }
    });
    person(E, .02, f(0), .12, Math.PI * .78, { kind: 'read', stand: true, cloth: P.casual[2], hold: 'card' });   // カードを読む
    // ---- 2階: 開いたノートの机・窓辺の椅子とタブレット・日誌の机 ----
    const y2 = f(1);
    desk(E, S, y2, .2, -.24, .28 * k, .16 * k, -.4, P.deskWood);
    station(E, 'tanaoroshi', {
      x: .2, y: y2 + .19 * k, z: -.24, ry: -.4, lift: [0, .03, .01], scale: 1.25,
      holder: g => g.box(0, 0, 0, .2 * k, .008, .13 * k, '#E9E1D2'),
      screen: { x: 0, y: .0095, z: 0, w: .19 * k, h: .12 * k, tilt: Math.PI / 2 - .18 }
    });
    chair(E, S, y2, .14, -.08, Math.PI - .4, P.chair2);
    person(E, .14, y2, -.08, Math.PI - .4, { kind: 'write', cloth: P.casual[0] });
    grp(S, -.25, y2, .09, 1.15).rbox(0, 0, 0, .2 * k, .09 * k, .18 * k, .03, P.sofa).rbox(0, .09 * k, -.07 * k, .2 * k, .12 * k, .04 * k, .02, P.sofa).rbox(-.09 * k, .09 * k, 0, .03 * k, .06 * k, .18 * k, .015, P.sofa).rbox(.09 * k, .09 * k, 0, .03 * k, .06 * k, .18 * k, .015, P.sofa);
    const mp = person(E, -.25, y2 + .015, .09, 1.15, { kind: 'read', cloth: P.casual[3], fy: y2 });
    const hm1 = handOf(mp, 1).add(handOf(mp, -1)).multiplyScalar(.5);      // タブレットは両手の間に
    station(E, 'moyamoya', {
      x: hm1.x, y: hm1.y - .01, z: hm1.z, ry: 1.15, lift: [0, .035, .02], glass: true, bezel: .006, scale: 1.2,
      holder: g => g.rbox(0, 0, 0, .13 * k, .1 * k, .01, .008, '#2A2F35'),
      screen: { x: 0, y: .05 * k, z: .0055, w: .118 * k, h: .088 * k, tilt: .55 }
    });
    station(E, 'daily-app', {
      x: .05, y: y2, z: .22, ry: -.15, glass: true, rim: false, scale: 1.25,
      holder: g => g.box(0, .16 * k, 0, .24 * k, .016, .14 * k, P.deskWood).box(0, 0, 0, .03, .16 * k, .03, P.woodDark).box(0, 0, 0, .12, .012, .1, P.woodDark).box(.07, .176 * k, -.03, .07 * k, .008, .05 * k, P.terraLight),
      screen: { x: -.03, y: .177 * k, z: .01, w: .14 * k, h: .1 * k, tilt: Math.PI / 2 - .25 }
    });
    // ---- 3階: 地図の机と、思いつきのピンボード(屋根がひらくので、上からよく見える) ----
    const y3 = f(2), ta = .62;            // 地図の机の天板は手前へ ta だけ傾ける(上から見る人に向く)
    station(E, 'compass', {
      x: 0, y: y3, z: .02, ry: 0, lift: [0, .03, .02],
      holder: g => g.box(-.15 * k, 0, 0, .025, .22 * k, .025, P.woodDark).box(.15 * k, 0, 0, .025, .22 * k, .025, P.woodDark).box(-.15 * k, 0, -.1 * k, .025, .28 * k, .025, P.woodDark).box(.15 * k, 0, -.1 * k, .025, .28 * k, .025, P.woodDark)
        .box(0, .24 * k, -.05 * k, .4 * k, .02, .28 * k, P.deskWood, ta).box(0, .16 * k, .05 * k, .36 * k, .012, .03, P.woodDark),
      screen: { x: 0, y: .24 * k + .022 * Math.cos(ta), z: -.05 * k + .022 * Math.sin(ta), w: .36 * k, h: .24 * k, tilt: Math.PI / 2 - ta }
    });
    person(E, -.33, y3, .03, Math.PI / 2, { kind: 'bend', cloth: P.casual[0], lean: .3 });        // 地図をのぞきこむ
    person(E, .31, y3, -.1, -Math.PI / 2, { kind: 'talk', cloth: P.casual[4] });                    // 向かいで話す
    person(E, .4, y3, .38, Math.PI - .55, { kind: 'bend', cloth: P.casual[1], lean: .28, night: true, day: false });   // 夜は望遠鏡をのぞく
    station(E, 'growth-76a805', {
      x: 0, y: y3 + .3 * k, z: -R + .03, ry: 0, lift: [0, .01, .03], scale: 1.25,
      holder: g => g.box(0, 0, 0, .36 * k, .26 * k, .016, P.cork).box(0, -.006, 0, .38 * k, .012, .022, P.woodDark)
        .box(-.2 * k, .2 * k, .01, .05 * k, .05 * k, .004, P.notes[0]).box(.2 * k, .18 * k, .01, .05 * k, .05 * k, .004, P.notes[1]).box(.21 * k, .05 * k, .01, .05 * k, .05 * k, .004, P.notes[2]),
      screen: { x: 0, y: .13 * k, z: .009, w: .26 * k, h: .17 * k }
    });
    // 望遠鏡(三脚と、上へ向けた筒)
    grp(S, .3, y3, .2, -.6).box(0, 0, -.06, .012, .21 * k, .012, P.dark, .29).box(-.05, 0, .03, .012, .21 * k, .012, P.dark, -.15, -.24).box(.05, 0, .03, .012, .21 * k, .012, P.dark, -.15, .24)
      .cyl(0, .2 * k, .02, .024, .22 * k, P.brand, false, -.96).cyl(0, .2 * k, .02, .011, .06, P.dark, false, Math.PI - .96);
  },

  /* ---------- クリニック: 待合・受付・診察室 ---------- */
  clinic(E) {
    const P = E.P, S = E.S, k = E.k, X = E.X, Z = E.Z;
    const R = shellRect(E, { floor: P.floorWood, wall: mix(P.inWall, P.sage, .18), side: mix(P.inWall2, P.sage, .22), band: mix(P.sage, '#6F8E69', .35), wainscot: mix(P.wainscot, P.sage, .45) });
    const y = E.fy(0) + .012;
    // 仕切り(診察室 | 受付・待合)
    bb(S, X(-.28) - .02, X(-.28) + .02, y, y + .62 * k, R.zb, Z(.12), P.inWall2); bb(S, X(-.28) - .022, X(-.28) + .022, y + .62 * k - .01, y + .62 * k, R.zb, Z(.12), P.cut);
    // 診察室: 机(12週のカレンダーが奥の壁に)・診察台・医師・患者・看護師
    desk(E, S, y, X(-.62), R.zb + .12, .4 * k, .16 * k, 0, P.desk);
    bx(S, X(-.72), y + .19 * k, R.zb + .1, .14 * k, .09 * k, .012, P.frame); bx(S, X(-.72), y + .19 * k + .015, R.zb + .107, .12 * k, .065 * k, .004, '#C9DCE6', 0, .6);
    station(E, 'turnaround12', {
      x: X(-.6), y: y + .36 * k, z: R.zb + .004, ry: 0, lift: [0, .01, .03],
      holder: g => g.box(0, 0, 0, .3 * k, .24 * k, .01, P.paper).box(0, .24 * k, 0, .31 * k, .02, .014, P.terra).box(-.13 * k, .245 * k, .009, .012, .02, .006, P.dark).box(.13 * k, .245 * k, .009, .012, .02, .006, P.dark),
      screen: { x: 0, y: .115 * k, z: .006, w: .27 * k, h: .2 * k }
    });
    chair(E, S, y, X(-.52), R.zb + .28, Math.PI, P.chair);
    person(E, X(-.52), y, R.zb + .28, Math.PI, { kind: 'write', cloth: P.coat });
    grp(S, X(-.8), y, Z(.12), 0).box(0, 0, 0, .2 * k, .14 * k, .44 * k, P.metal).rbox(0, .14 * k, 0, .2 * k, .04 * k, .44 * k, .015, mix(P.sage, '#FFFFFF', .4)).rbox(0, .18 * k, -.17 * k, .12 * k, .025 * k, .07 * k, .01, '#FFFFFF');
    const cn = person(E, X(-.5), y, Z(.3), -Math.PI / 2, { cloth: P.scrub, hold: 'chart' });
    chair(E, S, y, X(-.42), R.zb + .52, Math.PI * 1.25, P.chair2);
    talk(cn, person(E, X(-.42), y, R.zb + .52, Math.PI * 1.25, { kind: 'sit', cloth: P.casual[2] }));   // 看護師と患者
    // 受付と、引き継ぎの机(30日のチェック表)
    const ry0 = R.zb + .32;
    grp(S, X(.12), y, ry0).rbox(0, 0, 0, .52 * k, .22 * k, .16 * k, .02, P.trim).box(0, .22 * k, 0, .55 * k, .02, .2 * k, P.deskWood).box(0, .07 * k, .082 * k, .52 * k, .016, .004, mix(P.sage, '#6E8C68', .4));
    person(E, X(.0), y, ry0 - .2, 0, { kind: 'type', cloth: P.office, night: true });
    bx(S, X(.0), y + .22 * k + .02, ry0 - .02, .12 * k, .08 * k, .012, P.frame); bx(S, X(.0), y + .22 * k + .03, ry0 - .013, .1 * k, .06 * k, .004, '#C9DCE6', 0, .6);
    station(E, 'pmi-quest', {
      x: X(.27), y: y + .22 * k + .02, z: ry0 + .02, ry: -.25, lift: [0, .03, .015],
      holder: g => g.box(0, 0, 0, .13 * k, .008, .17 * k, P.woodDark).box(0, .008, -.075 * k, .05 * k, .012, .02, P.metal),
      screen: { x: 0, y: .0095, z: .008, w: .115 * k, h: .145 * k, tilt: Math.PI / 2 - .2 }
    });
    person(E, X(.5), y, ry0 + .18, -Math.PI * .7, { kind: 'write', stand: true, cloth: P.scrubNavy });   // 引き継ぎを書く
    // 待合: ベンチ(テレビを向く)・テレビ(クリニックタウン3D)
    station(E, 'clinic-flow-3d', {
      x: X(.68), y: y + .32 * k, z: R.zb + .004, ry: 0, lift: [0, .01, .03], flicker: .05, glass: true, bezel: .022,
      holder: g => g.box(0, 0, 0, .44 * k, .27 * k, .03, P.frame).box(0, -.06, -.005, .06, .06, .012, P.dark),
      screen: { x: 0, y: .135 * k, z: .016, w: .41 * k, h: .24 * k }
    });
    for (const bz of [Z(.18), Z(.48)]) grp(S, X(.68), y, bz).box(0, 0, 0, .6 * k, .012, .012, P.metalDark).box(-.26 * k, 0, 0, .016, .1 * k, .12 * k, P.metalDark).box(.26 * k, 0, 0, .016, .1 * k, .12 * k, P.metalDark).rbox(0, .1 * k, 0, .6 * k, .028 * k, .13 * k, .01, P.bench).rbox(0, .128 * k, .05 * k, .6 * k, .1 * k, .022 * k, .01, P.bench);
    person(E, X(.55), y + .015, Z(.18), Math.PI, { kind: 'look', cloth: P.casual[0], fy: y });     // テレビを見上げる
    person(E, X(.86), y + .015, Z(.18), Math.PI, { kind: 'read', cloth: P.casual[4], fy: y, hold: 'book' });
    grp(S, X(.93), y, Z(-.05)).box(0, 0, 0, .1 * k, .3 * k, .09 * k, P.trim).box(0, .3 * k, 0, .05, .06, .05, mix(P.glass, '#DDEBF2', .5));
    grp(S, X(.25), y, Z(.62)).box(0, 0, 0, .16 * k, .2 * k, .05, P.deskWood).box(-.04, .05 * k, .028, .05, .06, .004, P.notes[2]).box(.04, .05 * k, .028, .05, .06, .004, P.paper).box(0, .13 * k, .028, .05, .05, .004, P.notes[1]);
    plant(E, S, y, X(.92), Z(.6), 1.1, 1); plant(E, S, y, X(-.93), Z(.58), .9, 3);
    grp(S, X(.2), y, Z(.58)).box(0, 0, 0, .14 * k, .006, .08 * k, mix(P.sage, '#FFFFFF', .2));
  },

  /* ---------- 事務所: 1階 新任の机・バインダーの棚・プリンタ / 2階 2画面の机・1診2診の机・回る人 / 3階 会議室とカンバン・面接 ---------- */
  office(E) {
    const P = E.P, S = E.S, k = E.k, X = E.X, Z = E.Z;
    const R = shellRect(E, { floor: [mix(P.floorWood, P.carpet, .25), mix(P.carpet, P.sand, .45), mix(P.carpet, P.wall, .45)], wall: mix(P.inWall, '#E3E6E9', .2), side: mix(P.inWall2, '#DADDE0', .25) });
    const f = [0, 1, 2].map(i => E.fy(i) + .012);
    // ---- 1階 ----
    desk(E, S, f[0], X(.0), Z(.42), .4 * k, .2 * k, 0, P.desk);
    chair(E, S, f[0], X(.0), Z(.24), 0, P.chair);
    person(E, X(.0), f[0], Z(.24), 0, { kind: 'write', cloth: P.casual[1] });
    station(E, 'manager-starter', {
      x: X(.05), y: f[0] + .19 * k, z: Z(.43), ry: .1, lift: [0, .03, .012],
      holder: g => g.box(0, 0, 0, .13 * k, .006, .16 * k, P.woodDark),
      screen: { x: 0, y: .007, z: 0, w: .12 * k, h: .15 * k, tilt: Math.PI / 2 - .25 }
    });
    station(E, 'medops', {
      x: X(-.55), y: f[0], z: Z(.12), ry: .25, lift: [0, .03, .015],
      holder: g => {
        g.box(0, 0, 0, .34 * k, .34 * k, .12 * k, P.deskWood).box(0, .34 * k, 0, .35 * k, .014, .13 * k, P.woodDark);
        for (let i = 0; i < 2; i++) for (let j = 0; j < 7; j++) g.box(-.14 * k + j * .045 * k, .02 + i * .16 * k, .01, .032 * k, .13 * k, .1 * k, E.P.books[(i * 3 + j) % E.P.books.length]);
      },
      screen: { x: 0, y: .37 * k, z: .02, w: .18 * k, h: .13 * k, tilt: .45 }
    });
    station(E, 'reha-checklist', {
      x: X(.58), y: f[0], z: Z(.3), ry: -.3, lift: [0, .03, .015],
      holder: g => g.box(0, 0, 0, .22 * k, .17 * k, .14 * k, P.trim).box(.0, .17 * k, 0, .18 * k, .07 * k, .12 * k, '#D9DCDF').box(.0, .24 * k, -.01, .14 * k, .008, .09 * k, P.dark).box(-.01, .2 * k, .065 * k, .12 * k, .02, .02, P.dark)
        .box(.0, .17 * k + .002, .1 * k, .1 * k, .004, .07 * k, P.paper),
      screen: { x: .0, y: .19 * k, z: .12 * k, w: .1 * k, h: .13 * k, tilt: Math.PI / 2 - .35 }
    });
    plant(E, S, f[0], X(.74), Z(.75), 1.1, 0);
    person(E, X(-.34), f[0], Z(.3), Math.PI + .95, { kind: 'crouch', cloth: P.casual[2] });   // バインダーを下の段から探す
    // 入口のそばのコート掛け
    grp(S, X(-.72), f[0], Z(.66)).cyl(0, 0, 0, .05, .012, P.woodDark).cyl(0, 0, 0, .01, .46 * k, P.woodDark).box(-.02, .3 * k, .0, .06, .14 * k, .05, mix(P.navy, '#4A5568', .45)).box(.03, .33 * k, .01, .05, .1 * k, .04, P.terraLight);
    // ---- 2階 ----
    desk(E, S, f[1], X(-.42), Z(.36), .44 * k, .18 * k, 0, P.desk);
    station(E, 'medboard', {
      x: X(-.42), y: f[1] + .19 * k, z: Z(.38), ry: 0, lift: [0, .025, .012], flicker: .04, glass: true, bezel: .007, spill: [0, 0, .065, .36, .1, P.desk],
      holder: g => g.box(-.11 * k, 0, 0, .04, .008, .04, P.dark).box(-.11 * k, 0, -.005, .012, .05, .012, P.dark).box(-.11 * k, .045, 0, .2 * k, .13 * k, .014, P.frame)
        .box(.11 * k, 0, 0, .04, .008, .04, P.dark).box(.11 * k, 0, -.005, .012, .05, .012, P.dark).box(.11 * k, .045, 0, .2 * k, .13 * k, .014, P.frame),
      screen: { x: 0, y: .045 + .065 * k, z: .008, w: .4 * k, h: .118 * k }
    });
    chair(E, S, f[1], X(-.42), Z(.18), 0, P.chair);
    person(E, X(-.42), f[1], Z(.18), 0, { kind: 'type', cloth: P.office, night: true });
    desk(E, S, f[1], X(.45), Z(.4), .36 * k, .18 * k, 0, P.desk);
    station(E, 'consult-simulator', {
      x: X(.45), y: f[1] + .19 * k, z: Z(.42), ry: -.12, lift: [0, .025, .012], flicker: .03, glass: true, bezel: .01, spill: [0, 0, .065, .24, .1, P.desk],
      holder: g => g.box(0, 0, 0, .05, .008, .04, P.dark).box(0, 0, -.005, .012, .05, .012, P.dark).box(0, .045, 0, .27 * k, .16 * k, .014, P.frame),
      screen: { x: 0, y: .045 + .08 * k, z: .008, w: .25 * k, h: .145 * k }
    });
    chair(E, S, f[1], X(.45), Z(.22), 0, P.chair);
    person(E, X(.45), f[1], Z(.22), 0, { kind: 'type', cloth: P.casual[4] });
    // 手帖を持って階を回る人(本部長の巡回手帖)。手帖は人といっしょに動く
    const rn = person(E, X(0), f[1], Z(.75), Math.PI / 2, { kind: 'walk', x0: X(-.7), x1: X(.7), v: .2, cloth: mix(P.navy, '#4A5568', .3), carry: true });
    station(E, 'round-note', {
      x: X(0), y: f[1] + .2, z: Z(.75) + .07, ry: 0, lift: [0, .04, .02],
      holder: g => g.box(0, 0, 0, .085 * k, .11 * k, .01, P.terra),
      screen: { x: 0, y: .055 * k, z: .006, w: .072 * k, h: .096 * k, tilt: .3 },
      move: (s) => { s.offset[0] = (rn.wx ?? rn.x) - X(0); }
    });
    plant(E, S, f[1], X(.74), Z(.72), 1.05, 3);
    // ---- 3階: 会議室のホワイトボード・カンバンの壁・面接の机 ----
    const y3 = f[2];
    station(E, 'rehaboard', {
      x: X(-.4), y: y3 + .28 * k, z: R.zb + .004, ry: 0, lift: [0, .01, .03],
      holder: g => g.box(0, 0, 0, .56 * k, .36 * k, .012, '#FFFFFF').box(0, -.012, .006, .58 * k, .014, .03, P.metal).box(.25 * k, -.006, .02, .04, .012, .01, '#2E6FD0').box(.2 * k, -.006, .02, .04, .012, .01, '#C9583F'),
      screen: { x: 0, y: .18 * k, z: .008, w: .5 * k, h: .31 * k }
    });
    rbTable(E, S, y3, X(-.4), Z(.05), k);
    const pr = person(E, X(-.06), y3, R.zb + .16, 0, { kind: 'talk', cloth: P.coat });          // ボードの前で話す人
    turnTo(person(E, X(-.62), y3, Z(.05), Math.PI / 2, { kind: 'listen', cloth: P.office }), pr.x, pr.z, .55);
    turnTo(person(E, X(-.18), y3, Z(.05), -Math.PI / 2, { kind: 'listen', cloth: P.casual[0] }), pr.x, pr.z, .55);
    turnTo(pr, X(-.4), Z(.05));
    station(E, 'hire-board', {
      x: X(.45), y: y3 + .26 * k, z: R.zb + .004, ry: 0, lift: [0, .01, .03],
      holder: g => {
        g.box(0, 0, 0, .52 * k, .4 * k, .01, mix(P.inWall, '#FFFFFF', .5));
        for (let i = 0; i < 8; i++) g.box((-.22 + (i % 4) * .147) * k, (.33 + Math.floor(i / 4) * .045) * k, .006, .05 * k, .035 * k, .004, P.notes[i % 4]);
      },
      screen: { x: 0, y: .15 * k, z: .008, w: .46 * k, h: .27 * k }
    });
    // 面接の机と2脚の椅子(手前)
    grp(S, X(.42), y3, Z(.42)).rbox(0, .17 * k, 0, .3 * k, .016, .18 * k, .01, P.deskWood).box(0, 0, 0, .03, .17 * k, .03, P.woodDark).box(0, 0, 0, .14, .01, .1, P.woodDark);
    chair(E, S, y3, X(.22), Z(.42), Math.PI / 2, P.chair2); chair(E, S, y3, X(.62), Z(.42), -Math.PI / 2, P.chair2);
    person(E, X(.22), y3, Z(.42), Math.PI / 2, { kind: 'write', cloth: P.office });
    person(E, X(.62), y3, Z(.42), -Math.PI / 2, { kind: 'listen', cloth: P.casual[3] });     // 面接で話す人
    station(E, 'interview-kit', {
      x: X(.36), y: y3 + .186 * k, z: Z(.43), ry: .3, lift: [0, .03, .012],
      holder: g => g.box(0, 0, 0, .13 * k, .006, .1 * k, P.woodDark),
      screen: { x: 0, y: .007, z: 0, w: .12 * k, h: .09 * k, tilt: Math.PI / 2 - .3 }
    });
    plant(E, S, y3, X(.8), Z(.75), 1.15, 2);
  },

  /* ---------- 図書館: 吹き抜けの本棚と閲覧の机 ---------- */
  library(E) {
    const P = E.P, S = E.S, k = E.k, X = E.X, Z = E.Z, H = E.box.h;
    const R = shellRect(E, { floor: P.parquet, wall: mix(P.inWall, P.sand, .2), side: mix(P.inWall2, P.sand, .25), skirt: P.woodDark });
    const y = E.fy(0) + .012, rr = rng(57);
    // 奥の壁いっぱいの本棚(2段の高さ。上はギャラリー)
    const shelfH = Math.min(H - .25, 1.45), cols = Math.max(3, Math.round((R.x1 - R.x0) / .3)), cw = (R.x1 - R.x0) / cols, rows = 6, sd = .17 * k;
    // 背板(薄い)・仕切り・棚板。本は背板の手前に、背を見せて並べる
    bb(S, R.x0, R.x1, y, y + shelfH, R.zb, R.zb + .012, mix(P.wood, P.sand, .35));
    for (let c = 0; c <= cols; c++) bb(S, R.x0 + c * cw - (c === cols ? .014 : 0), R.x0 + c * cw + (c === cols ? 0 : .014), y, y + shelfH, R.zb + .012, R.zb + sd, P.wood);
    bb(S, R.x0, R.x1, y + shelfH - .014, y + shelfH, R.zb + .012, R.zb + sd, P.wood);
    for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
      const sp2 = (shelfH - .06) / rows, sy = y + .04 + r * sp2, x0 = R.x0 + c * cw + .018;
      let x = x0;
      while (x < x0 + cw - .036) {
        const bw = .02 + rr() * .018, bh = Math.min(sp2 - .022, sp2 * (.6 + rr() * .32)), bc = P.books[Math.floor(rr() * P.books.length)];
        if (rr() < .07) { bx(S, x + .045, sy, R.zb + .1 * k, .09, .02, .12 * k, bc); x += .1; continue; }    // ときどき横に寝かせた本
        bx(S, x + bw / 2, sy, R.zb + .03 + .065 * k, bw, bh, .12 * k, bc); x += bw + .002;
      }
      bb(S, R.x0 + c * cw, R.x0 + (c + 1) * cw, sy - .012, sy, R.zb + .012, R.zb + sd, P.wood);
    }
    // 本棚の上の高窓と時計
    for (const wx of [X(-.6), X(.6)]) backWindow(E, wx, y + shelfH + .08, .5 * k, Math.min(.2, H - shelfH - .2), R.zb);
    grp(S, X(0), y + shelfH + .18, R.zb + .005).cyl(0, 0, 0, .055, .012, P.trim, false, Math.PI / 2).box(0, 0, .008, .006, .04, .004, P.dark).box(.014, 0, .008, .032, .006, .004, P.dark);
    // ギャラリーの床と手すり
    const gy = y + shelfH * .52;
    bb(S, R.x0, R.x1, gy - .03, gy, R.zb + .17 * k, R.zb + .42 * k, P.deskWood); bb(S, R.x0, R.x1, gy - .03, gy, R.zb + .42 * k - .01, R.zb + .42 * k, P.cutLine);
    bb(S, R.x0, R.x1, gy + .2 * k, gy + .212 * k, R.zb + .405 * k, R.zb + .42 * k, P.woodDark);
    for (let x = R.x0 + .1; x < R.x1; x += .16) bb(S, x - .005, x + .005, gy, gy + .2 * k, R.zb + .405 * k, R.zb + .415 * k, P.woodDark);
    for (const x of [R.x0 + .2, R.x1 - .2]) bb(S, x - .012, x + .012, y, gy, R.zb + .4 * k, R.zb + .424 * k, P.woodDark);
    person(E, X(.3), gy, R.zb + .3 * k, Math.PI / 2, { kind: 'walk', x0: X(-.8), x1: X(.9), v: .16, cloth: P.casual[2], night: true });
    // はしご
    grp(S, X(-.75), y, R.zb + .22 * k, 0).box(-.05, 0, 0, .012, gy - y, .012, P.woodDark).box(.05, 0, 0, .012, gy - y, .012, P.woodDark);
    for (let i = 1; i < 6; i++) bx(S, X(-.75), y + i * (gy - y) / 6, R.zb + .22 * k, .1, .01, .012, P.woodDark);
    // 敷物と閲覧の机(問題カード)
    bb(S, X(-.95), X(.05), y, y + .006, Z(-.05), Z(.62), mix(P.sage, '#7E9B79', .25));
    grp(S, X(-.45), y, Z(.25)).rbox(0, .18 * k, 0, .64 * k, .02, .3 * k, .01, P.deskWood).box(-.28 * k, 0, 0, .025, .18 * k, .25 * k, P.woodDark).box(.28 * k, 0, 0, .025, .18 * k, .25 * k, P.woodDark);
    station(E, 'him-quiz', {
      x: X(-.48), y: y + .2 * k, z: Z(.26), ry: .15, lift: [0, .03, .01],
      holder: g => g.box(0, 0, 0, .13 * k, .016, .09 * k, P.paper).box(.08 * k, 0, .02, .07 * k, .01, .05 * k, P.notes[2]).box(-.08 * k, 0, -.02, .07 * k, .01, .05 * k, P.notes[0]),
      screen: { x: 0, y: .0175, z: 0, w: .12 * k, h: .085 * k, tilt: Math.PI / 2 - .3 }
    });
    for (const [cx, cz, ry] of [[X(-.62), Z(.06), 0], [X(-.28), Z(.06), 0], [X(-.62), Z(.45), Math.PI], [X(-.28), Z(.45), Math.PI]]) chair(E, S, y, cx, cz, ry, P.chair2);
    person(E, X(-.62), y, Z(.06), 0, { kind: 'read', cloth: P.casual[0], hold: 'book' });
    person(E, X(-.28), y, Z(.45), Math.PI, { kind: 'write', cloth: P.casual[1] });
    lampTable(E, S, y + .2 * k, X(-.2), Z(.22), '#9DBE96');
    // 学習計画のボード(自立する板)
    station(E, 'study-board', {
      x: X(.62), y: y, z: Z(.05), ry: -.18, lift: [0, .012, .03],
      holder: g => g.box(-.2 * k, 0, 0, .014, .52 * k, .014, P.metalDark).box(.2 * k, 0, 0, .014, .52 * k, .014, P.metalDark).box(0, .01, 0, .44 * k, .012, .1, P.metalDark).box(0, .2 * k, 0, .44 * k, .3 * k, .014, '#FFFFFF'),
      screen: { x: 0, y: .35 * k, z: .009, w: .4 * k, h: .26 * k }
    });
    turnTo(person(E, X(.44), y, Z(.3), Math.PI * .9, { kind: 'reach', cloth: P.casual[3] }), X(.62), Z(.05));   // ボードに書きこむ
    // ヘッドホンの席(囲いのある机)。画面は目の高さの板に掛け、座る人の頭の上に見える
    const cx2 = X(.72), cz2 = Z(.6);
    grp(S, cx2, y, cz2).box(0, .18 * k, 0, .32 * k, .016, .16 * k, P.deskWood).box(-.16 * k, 0, 0, .014, .3 * k, .18 * k, P.woodDark).box(.16 * k, 0, 0, .014, .3 * k, .18 * k, P.woodDark).box(0, .18 * k, -.08 * k, .32 * k, .3 * k, .012, P.woodDark);
    station(E, 'english-trainer', {
      x: cx2, y: y + .33 * k, z: cz2 - .072 * k, ry: 0, lift: [0, .02, .02], glass: true, bezel: .0075, spill: [0, -.134 * k, .1, .24, .1, P.deskWood],
      holder: g => g.box(0, 0, 0, .19 * k, .125 * k, .012, P.frame),
      screen: { x: 0, y: .0625 * k, z: .007, w: .175 * k, h: .11 * k }
    });
    chair(E, S, y, cx2 - .03, cz2 + .15 * k, Math.PI, P.chair2);
    const hp = person(E, cx2 - .03, y, cz2 + .15 * k, Math.PI, { kind: 'look', cloth: P.casual[4], hp: -.08 });
    grp(S, hp.x, y + PERSON.sitHeadY + .044, hp.z).box(0, 0, 0, .118, .014, .02, P.dark).box(-.058, -.046, 0, .016, .044, .036, P.dark).box(.058, -.046, 0, .016, .044, .036, P.dark);
    plant(E, S, y, X(1.08), Z(.78), 1.2, 1); plant(E, S, y, X(-1.08), Z(.78), 1.1, 3);
    person(E, X(.12), y, R.zb + .3 * k, Math.PI * .92, { kind: 'crouch', cloth: P.casual[1], hold: 'book' });   // いちばん下の段の本を探す
  },

  /* ---------- 公園: 壁はない。小物が道具 ---------- */
  park(E) {
    const P = E.P, S = E.S, H = E.H, X = E.X, Z = E.Z, y = 0, pk = 1.3;   // 小物は人より少し大きめ(ひらいた画面で見分けやすく)
    // ガチャ(ときどきカプセルが転がる)
    let capRange = null;
    station(E, 'gokigen-gacha', {
      x: X(-1.25), y, z: Z(.1), ry: .35, lift: [0, .03, .02], scale: pk, glass: true, rim: false,
      holder: g => {
        g.rbox(0, 0, 0, .3, .34, .26, .03, P.terraLight).box(0, .34, 0, .28, .03, .24, P.trim)
          .cyl(0, .37, 0, .13, .06, mix(P.glass, '#FFFFFF', .55)).cyl(0, .43, 0, .135, .012, P.trim);
        [['#F0C434', -.06, .04], ['#5FA9A1', .05, .05], ['#E8A4A0', .0, -.06], ['#7EA0D2', .07, -.03], ['#FFFFFF', -.07, -.04], ['#F0C434', .02, .0], ['#E8A4A0', -.02, .07]].forEach(([cc, cx2, cz2]) => g.sph(cx2, .45, cz2, .036, cc));
        g.box(.09, .12, .132, .05, .05, .02, P.dark).cyl(.09, .22, .135, .025, .02, P.trim, false, Math.PI / 2);
      },
      screen: { x: -.04, y: .2, z: .132, w: .15, h: .22 }
    });
    // 転がるカプセル(道具の物の形の中で、毎フレーム頂点を動かす)
    const c0 = H.n; sp(H, 0, 0, 0, .035 * pk, '#F0C434'); capRange = [c0, H.n];
    person(E, X(-.84), y, Z(.46), -.2, { kind: 'crouch', cloth: P.casual[4] });   // 転がってくるカプセルを待つ
    // 保留の棚
    station(E, 'ittan-horyu', {
      x: X(-.25), y, z: Z(-.9), ry: .05, lift: [0, .02, .03], scale: pk,
      holder: g => {
        g.box(-.22, 0, 0, .02, .5, .2, P.deskWood).box(.22, 0, 0, .02, .5, .2, P.deskWood).box(0, .02, 0, .46, .02, .2, P.deskWood).box(0, .22, 0, .46, .02, .2, P.deskWood).box(0, .42, 0, .46, .02, .2, P.deskWood)
          .rbox(-.1, .04, 0, .12, .1, .1, .01, P.sand).rbox(.1, .04, .01, .1, .08, .1, .01, P.peach).rbox(-.06, .24, 0, .14, .09, .1, .01, P.paper).rbox(.12, .24, 0, .09, .12, .09, .01, P.sage)
          .box(-.1, .1, .052, .03, .04, .004, P.terra).box(.1, .1, .062, .03, .04, .004, P.terra).box(0, .44, 0, .3, .2, .016, P.trim);
      },
      screen: { x: 0, y: .44 + .1, z: .01, w: .12, h: .17 }
    });
    // 窓の額(夜の病院の窓)
    station(E, 'madoakari', {
      x: X(.75), y, z: Z(-.55), ry: -.3, lift: [0, .02, .03], scale: pk, glass: true,
      holder: g => g.box(0, 0, 0, .02, .34, .02, P.woodDark).box(-.06, 0, -.06, .016, .3, .016, P.woodDark).box(.06, 0, -.06, .016, .3, .016, P.woodDark)
        .box(0, .3, .0, .3, .26, .03, P.trim).box(0, .3, -.002, .32, .015, .036, P.woodDark).box(0, .43 - .0, .017, .008, .2, .004, P.trim),
      screen: { x: 0, y: .43, z: .017, w: .26, h: .22 }
    });
    // ふたつの波紋の池と、小さな札
    const px = X(1.15), pz = Z(.55);
    cy(S, px, -.01, pz, .5, .03, P.water); S.add(ni(new THREE.TorusGeometry(.5, .04, 6, 40)), mtx(px, .02, pz, 1, 1, 1, 0, -Math.PI / 2), mix(P.sand, '#FFFFFF', .2));
    for (const [dx, dz, i] of [[-.16, -.08, 0], [.15, .1, 1]]) for (let r = 0; r < 2; r++) E.rings.push({ x: px + dx, y: .025, z: pz + dz, r0: .03, r1: .32, ph: r * .5 + i * .23 });
    // 池のそばの札(板は後ろへ少し倒し、画面も同じ面に)
    const pa = .25;
    station(E, 'futatsume', {
      x: px - .6, y, z: pz + .2, ry: .5, lift: [0, .02, .03], scale: pk,
      holder: g => g.box(0, 0, 0, .025, .26, .025, P.woodDark).box(0, .26, 0, .2, .15, .02, P.trim, -pa),
      screen: { x: 0, y: .26 + .075 * Math.cos(pa) + .011 * Math.sin(pa), z: -.075 * Math.sin(pa) + .011 * Math.cos(pa), w: .17, h: .12, tilt: pa }
    });
    talk(person(E, px - .3, y, pz - .62, 0, { cloth: P.casual[0] }), person(E, px + .02, y, pz - .68, 0, { cloth: P.casual[3] }));   // 池のそばで話す
    person(E, X(-.02), y, Z(-.42), Math.PI * 1.08, { kind: 'reach', cloth: P.casual[2] });   // 保留の棚に手をのばす
    // ベンチと街灯(町の街灯と同じ色)。夜もベンチに一人いる
    grp(S, X(.12), y, Z(.78)).box(-.22, 0, 0, .03, .1, .12, P.metalDark).box(.22, 0, 0, .03, .1, .12, P.metalDark).box(0, .1, 0, .52, .028, .14, P.bench).box(0, .128, -.06, .52, .12, .022, P.bench);
    person(E, X(.0), y, Z(.8), 0, { kind: 'read', cloth: P.casual[1], night: true, hold: 'book' });
    grp(S, X(-1.62), y, Z(.75)).cyl(0, 0, 0, .05, .02, P.metalDark).cyl(0, 0, 0, .014, .78, P.lampPole).box(0, .78, 0, .07, .06, .07, P.lampHead, 0, 0, 1.2).box(0, .84, 0, .09, .012, .09, P.lampPole);
    E.extra.capRange = capRange;
  },

  /* ---------- アトリエ: 作業机の一人(理学療法士の橋本渉が、ひとりで作っています) ---------- */
  atelier(E) {
    const P = E.P, S = E.S, k = E.k, X = E.X, Z = E.Z;
    const R = shellRect(E, { floor: P.floorWood, wall: mix(P.inWall, P.peach, .25), side: mix(P.inWall2, P.peach, .3), skirt: P.woodDark });
    const y = E.fy(0) + .012;
    backWindow(E, X(.45), y + .42 * k, .4 * k, .34 * k, R.zb);
    for (const s2 of [-1, 1]) bb(S, X(.45) + s2 * .24 * k - .035, X(.45) + s2 * .24 * k + .035, y + .36 * k, y + .82 * k, R.zb + .012, R.zb + .03, mix(P.sage, '#FFFFFF', .25));
    bb(S, R.x0 + .02, X(.3), y, y + .005, R.zb + .05, R.zb + .62, mix(P.terra, P.sand, .55));
    // 壁に貼ったスケッチ
    for (const [px, py, pw, ph, pc] of [[-.72, .5, .1, .13, P.paper], [-.6, .58, .09, .07, P.notes[2]], [-.6, .47, .08, .08, P.paper], [.0, .55, .1, .12, P.paper], [.1, .5, .07, .07, P.notes[0]]]) bb(S, X(px), X(px) + pw * k, y + py * k, y + (py + ph) * k, R.zb + .004, R.zb + .009, pc);
    // 立ち灯り(机と窓の間)
    grp(S, X(.13), y, R.zb + .13).cyl(0, 0, 0, .04, .008, P.dark).box(0, 0, 0, .008, .42 * k, .008, P.dark).cone(0, .42 * k, 0, .05 * k, .05 * k, '#F4E7CC', 1);
    // 机の上の棚(びん)と、ポット
    grp(S, X(-.3), y + .62 * k, R.zb + .03).box(0, 0, 0, .5 * k, .014, .06, P.woodDark);
    for (let i = 0; i < 5; i++) cy(S, X(-.3) - .18 * k + i * .09 * k, y + .634 * k, R.zb + .045, .018, .05, [P.terraLight, P.sage, P.sand, P.glass, P.peach][i]);
    // 作業机と、運営者(座って打つ)
    grp(S, X(-.3), y, R.zb + .13).rbox(0, .19 * k, 0, .6 * k, .02, .2 * k, .008, P.deskWood).box(-.27 * k, 0, 0, .025, .19 * k, .17 * k, P.woodDark).box(.27 * k, 0, 0, .025, .19 * k, .17 * k, P.woodDark);
    // ノートパソコン: 蓋は奥へ la だけ倒す。画面は蓋の面に合わせる
    const la = .2;
    station(E, 'note', {
      x: X(-.12), y: y + .21 * k, z: R.zb + .15, ry: -.35, lift: [0, .025, .012], canvas: 'note', glass: true, bezel: .0075, spill: [0, 0, .08, .2, .1, P.deskWood],
      holder: g => g.box(0, 0, .03, .17 * k, .008, .11 * k, '#C9CDD1').box(0, .006, -.025, .17 * k, .11 * k, .008, '#C9CDD1', -la),
      screen: { x: 0, y: .006 + .055 * k * Math.cos(la) + .0055 * Math.sin(la), z: -.025 - .055 * k * Math.sin(la) + .0055 * Math.cos(la), w: .15 * k, h: .095 * k, tilt: la }
    });
    chair(E, S, y, X(-.42), R.zb + .32, Math.PI * .88, P.chair2);
    person(E, X(-.42), y, R.zb + .32, Math.PI * .88, { kind: 'type', cloth: mix(P.navy, '#5D6B85', .4), night: true });
    lampTable(E, S, y + .21 * k, X(-.62), R.zb + .1, '#F3E3C2');
    bx(S, X(-.55), y + .21 * k, R.zb + .1, .05, .03, .04, P.terraLight);
    // 運営者について(壁の額)
    station(E, 'about', {
      x: X(-.32), y: y + .42 * k, z: R.zb + .004, ry: 0, lift: [0, .01, .03], canvas: 'about',
      holder: g => g.box(0, 0, 0, .3 * k, .2 * k, .014, P.woodDark),
      screen: { x: 0, y: .1 * k, z: .008, w: .27 * k, h: .17 * k }
    });
    // 話をする(窓辺の小さな机と、空いている椅子)
    grp(S, X(.42), y, Z(.12)).cyl(0, 0, 0, .025, .17 * k, P.woodDark).cyl(0, 0, 0, .07, .01, P.woodDark);
    station(E, 'community', {
      x: X(.42), y: y + .17 * k, z: Z(.12), ry: -.2, lift: [0, .025, .01], canvas: 'community',
      holder: g => g.cyl(0, 0, 0, .14 * k, .016, P.deskWood).cyl(-.08 * k, .016, .04, .016, .025, P.paper).cyl(.09 * k, .016, -.03, .016, .025, P.terraLight),
      screen: { x: .0, y: .0175, z: .02, w: .13 * k, h: .09 * k, tilt: Math.PI / 2 - .3 }
    });
    chair(E, S, y, X(.25), Z(.12), Math.PI / 2, P.chair2); chair(E, S, y, X(.6), Z(.12), -Math.PI / 2, P.chair2);
    // 窓の下の低い本棚(前があいていて、本の背が見える)・植物
    const shx = R.x1 - .17 * k, shw = .3 * k, shh = .3 * k;
    grp(S, shx, y, R.zb + .01).box(0, 0, .065 * k, shw, .012, .13 * k, P.woodDark).box(0, shh, .065 * k, shw + .01, .014, .135 * k, P.woodDark)
      .box(-shw / 2, 0, .065 * k, .014, shh, .13 * k, P.woodDark).box(shw / 2, 0, .065 * k, .014, shh, .13 * k, P.woodDark).box(0, 0, .006, shw, shh, .01, P.deskWood).box(0, shh / 2, .065 * k, shw, .012, .13 * k, P.woodDark);
    for (let r = 0; r < 2; r++) { let bx0 = shx - shw / 2 + .016; for (let i = 0; bx0 < shx + shw / 2 - .04; i++) { const bw = .022 + ((i * 7 + r * 3) % 5) * .004, bh = (shh / 2 - .03) * (.7 + ((i * 5 + r) % 4) * .08); bx(S, bx0 + bw / 2, y + .012 + r * shh / 2, R.zb + .075 * k, bw, bh, .1 * k, P.books[(i * 3 + r * 5) % P.books.length]); bx0 += bw + .003; } }
    cy(S, shx - .06, y + shh + .014, R.zb + .07, .028, .07, P.terraLight); sp(S, shx - .06, y + shh + .1, R.zb + .07, .045, P.leaf[1], 1.1);
    plant(E, S, y, R.x1 - .1, Z(.6), 1.25, 0); plant(E, S, y, R.x0 + .1, Z(.55), 1, 2);
  }
};
function rbTable(E, S, y, x, z, k) { grp(S, x, y, z).foot(0, 0, .36 * k, .2 * k, .76, .06).rbox(0, .17 * k, 0, .4 * k, .016, .22 * k, .01, E.P.desk).box(0, 0, 0, .03, .17 * k, .03, E.P.metalDark).box(0, 0, 0, .18, .01, .12, E.P.metalDark); }
