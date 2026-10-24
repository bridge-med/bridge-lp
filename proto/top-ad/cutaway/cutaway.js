/* ================================================================
   融合2「病院の断面」— いつもの病院に、まだ行ったことのない階がある
   病院のビルを正面から切った断面(ドールハウス)。three.js 0.160(同梱)
   切り口(断面)は C のフロアガイドの暗い板の色、左の柱は階の札の列、各階の奥の壁は C の階の色。
   右のガラスのエレベーターのかごが、行先階ボタンでその階まで昇る。
   モード:
     live    … ページの読み込みの後に WebGL へ差し替える(start を index.html から呼ぶ)
     capture … 止めた画像を作るときだけ(?capture=poster|floor)
   形は素材ごとに結合し(頂点の色)、人・窓はインスタンスで描く
   ================================================================ */
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../shared/vendor/three-0.160.0/RoundedBoxGeometry.js';

const Q = new URLSearchParams(location.search);
const CAP = Q.get('capture');
const deg = d => d * Math.PI / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const clamp01 = v => clamp(v, 0, 1);
const easeIO = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- 寸法 ---------- */
const FH = 2.3, ST = .28, CLEAR = FH - ST;                 // 階高・スラブ厚・天井まで
const X0 = -4.5, X1 = 4.5, COLW = 1.0, RW = .22, BWT = .22; // 建物の左右・左の札の柱・右の壁・奥の壁
const XI0 = X0 + COLW, XI1 = X1 - RW;                       // 室内の左右
const ZB = -1.9, ZF = 1.9, ZI0 = ZB + BWT;                  // 奥・切り口・奥の壁の面
const yOf = lv => (lv - 1) * FH;                            // その階のスラブの下端
const floorY = lv => yOf(lv) + ST + .015;                   // その階の床の面
const SX0 = X1, SX1 = X1 + 1.7, SZ0 = -.85, SZ1 = .85;      // エレベーターのガラスの塔
const SHAFT_TOP = yOf(8) + ST + 2.5;
const CAR_X = (SX0 + SX1) / 2;
const PX0 = -7.8, PX1 = 9.2, PZ0 = -3.3, PZ1 = 6.9;         // 台(切った地面)
const TOWER_TOP = yOf(8) + FH + ST;                         // 屋上の塔屋の上端
const BUS_STOP = -5.6;                                      // バス停(左)
const CAR_START = 3;                                        // かごは最初 3 階にいる

/* ---------- 階(C の階の色) ---------- */
const KEY = ['', '1', '2', '3', '4', '5', '6', '7', 'R'];
const LV = { '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, 'R': 8 };
const FCOL = ['', '#16233E', '#F2C11C', '#00737E', '#6A45B2', '#087A4F', '#C24813', '#2356C4', '#8ACFEA'];
const FINK = [false, false, true, false, false, false, false, false, true];
const FPIC = ['', 'info', 'play', 'study', 'manage', 'work', 'learn', 'career', 'roof'];

/* ---------- 色 ---------- */
const C = {
  ext: '#EEEBE5', extD: '#E3DFD7', cut: '#22272B', base: '#3A4147', wallIn: '#F4F2ED', ceil: '#F7F6F2',
  wood: '#CFB48C', woodD: '#B0956D', woodL: '#DCC7A6', steel: '#8D979F', steelL: '#C6CCD1', steelD: '#5E676F',
  dark: '#384047', screen: '#1A2026', white: '#F7F6F2', paper: '#FBFAF6', gray: '#BEC2C5', grayD: '#7D858C', ink: '#15191C',
  cork: '#C8A879', chair: '#59636C', chairL: '#9AA6B1', sofa: '#A99F94', cushion: '#C9BFB2',
  leaf: ['#7DA078', '#8BAD84', '#6D946E', '#97B78D'], trunk: '#8A7562', pot: '#D9D3C8',
  pave: '#DCD7CD', paveL: '#E7E3DA', curb: '#C9C4BA', grass: '#A9BF96', hedge: '#86A67E', asphalt: '#7F858C', line: '#F3F0E9',
  soil: ['#CDB794', '#B9A180', '#A38C72', '#8E7B67'],
  cloth: ['#F3F1EB', '#2E3C56', '#3F8087', '#8FB1D1', '#D7C7AC', '#5A646E', '#B7C5D5', '#C79B87', '#6F8A6A', '#E7E2D8'],
  skin: ['#EECFB8', '#E0BB9B', '#CBA282'], hair: ['#2A2522', '#3D332C', '#594A3D', '#1E1C1B', '#8A8278', '#4A3F37']
};
const tint = (hex, k, base = '#ECEAE4') => '#' + new THREE.Color(base).lerp(new THREE.Color(hex), k).getHexString();

/* ---------- ピクトグラム(C と同じ 48 の格子) ---------- */
const PIC = {
  info: ['M19 10.5a5 5 0 1 0 10 0a5 5 0 1 0 -10 0z', 'M16.5 19h12v19.5h4.5V44h-17v-5.5H21v-14h-4.5z'],
  career: ['M21.5 4h5v38h-5z', 'M14 40.5h20V45H14z', 'M8 8.5h26.5l6.5 6-6.5 6H8z', 'M40 24.5H13.5l-6.5 6 6.5 6H40z'],
  learn: [{ d: 'M24 5 43 20.5V44H5V20.5zM19.5 28.5v13l11-6.5zM10.5 25h7v6h-7zM30.5 25h7v6h-7z', eo: 1 }],
  work: [{ d: 'M17 4.5h14a2 2 0 0 1 2 2V8h5a2 2 0 0 1 2 2v32a2 2 0 0 1-2 2H10a2 2 0 0 1-2-2V10a2 2 0 0 1 2-2h5V6.5a2 2 0 0 1 2-2zM19 8.5v3h10v-3zM13.5 19.5v4.5H18v-4.5zM22 20v3.5h12V20zM13.5 28v4.5H18V28zM22 28.5V32h12v-3.5zM13.5 36.5V41H18v-4.5zM22 37v3.5h8V37z', eo: 1 }],
  manage: ['M7 27h8v13H7zM20 18h8v22h-8zM33 8h8v32h-8zM4 41.5h40V46H4z'],
  study: ['M5 10.5c6.5-.2 12.5 1.3 17 4.6V41c-4.5-3.1-10.5-4.6-17-4.4zM43 10.5c-6.5-.2-12.5 1.3-17 4.6V41c4.5-3.1 10.5-4.6 17-4.4z'],
  play: ['M14 4.5h4v10h-4zM22 3h4v11.5h-4zM30 4.5h4v10h-4z', { d: 'M7 18h28v6.5h1.5a7.5 7.5 0 0 1 0 15H33.6A11 11 0 0 1 24 45h-6A11 11 0 0 1 7 34zM35 29v6h1.5a3 3 0 0 0 0-6z', eo: 1 }],
  roof: ['M10 31a14 14 0 0 1 28 0z', 'M22 6.5h4v8h-4zM8.3 12.4l2.9-2.8 5.6 5.7-2.8 2.8zM33.9 15.3l5.6-5.7 2.9 2.8-5.6 5.7zM3 21.5h8v4H3zM37 21.5h8v4h-8z', 'M3 34h42v4.5H3zM9 41h30v4H9z']
};
function drawPic(g, id, x, y, size, color) {
  g.save(); g.translate(x, y); g.scale(size / 48, size / 48); g.fillStyle = color;
  for (const p of PIC[id]) { const d = typeof p === 'string' ? p : p.d; g.fill(new Path2D(d), p.eo ? 'evenodd' : 'nonzero'); }
  g.restore();
}

/* ================================================================
   形をまとめる(素材ごとに1つの形へ結合する。色は頂点に持たせる)
   ================================================================ */
const ni = g => (g.index ? g.toNonIndexed() : g);
const G = {
  box: ni(new THREE.BoxGeometry(1, 1, 1)).translate(0, .5, 0),
  cyl: ni(new THREE.CylinderGeometry(.5, .5, 1, 20, 1)).translate(0, .5, 0),
  cyl8: ni(new THREE.CylinderGeometry(.5, .5, 1, 8, 1)).translate(0, .5, 0),
  cone: ni(new THREE.ConeGeometry(.5, 1, 16, 1)).translate(0, .5, 0),
  sph: ni(new THREE.IcosahedronGeometry(.5, 2)),
  ball: ni(new THREE.SphereGeometry(.5, 12, 8))
};
const RBC = new Map();
function rbGeo(w, h, d, r) {
  const k = [w, h, d, r].map(v => v.toFixed(3)).join('|');
  if (!RBC.has(k)) RBC.set(k, ni(new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) / 2 - .002))).translate(0, h / 2, 0));
  return RBC.get(k);
}
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3();
function mtx(x, y, z, sx, sy, sz, ry = 0, rx = 0, rz = 0) { _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); return _m.compose(_p.set(x, y, z), _q, _s.set(sx, sy, sz)); }
const COLS = new Map();
const col = h => { if (!COLS.has(h)) COLS.set(h, new THREE.Color(h)); return COLS.get(h); };

class Batch {
  constructor() { this.list = []; this.n = 0; }
  add(geo, m, c) { const g = geo.clone().applyMatrix4(m); this.list.push([g, typeof c === 'string' ? col(c) : c]); this.n += g.attributes.position.count; }
  mesh(mat, cast = true, recv = true) {
    if (!this.n) return null;
    const P = new Float32Array(this.n * 3), N = new Float32Array(this.n * 3), K = new Float32Array(this.n * 3);
    let o = 0;
    for (const [g, c] of this.list) {
      const k = g.attributes.position.count;
      P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3);
      for (let i = 0; i < k; i++) { const j = (o + i) * 3; K[j] = c.r; K[j + 1] = c.g; K[j + 2] = c.b; }
      o += k; g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(P, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(K, 3));
    geo.computeBoundingSphere();
    const m = new THREE.Mesh(geo, mat); m.castShadow = cast; m.receiveShadow = recv;
    return m;
  }
}
/* 箱(中心の x・z と底の y)、最小・最大で指定する箱、円柱、球 */
function bx(b, x, y, z, w, h, d, c, ry = 0) { b.add(G.box, mtx(x, y, z, w, h, d, ry), c); }
function bb(b, x0, x1, y0, y1, z0, z1, c) { bx(b, (x0 + x1) / 2, y0, (z0 + z1) / 2, x1 - x0, y1 - y0, z1 - z0, c); }
function cy(b, x, y, z, r, h, c, seg) { b.add(seg === 8 ? G.cyl8 : G.cyl, mtx(x, y, z, r * 2, h, r * 2), c); }
function sp(b, x, y, z, r, c, sy = 1) { b.add(G.sph, mtx(x, y, z, r * 2, r * 2 * sy, r * 2), c); }
/* 向きのある家具: (x, y, z) を原点に ry だけ回した座標で部品を置く */
function grp(b, x, y, z, ry = 0) {
  const cs = Math.cos(ry), sn = Math.sin(ry);
  const P = (lx, lz) => [x + lx * cs + lz * sn, z - lx * sn + lz * cs];
  return {
    box(lx, ly, lz, w, h, d, c, rx = 0, rz = 0) { const [wx, wz] = P(lx, lz); b.add(G.box, mtx(wx, y + ly, wz, w, h, d, ry, rx, rz), c); return this; },
    rbox(lx, ly, lz, w, h, d, r, c) { const [wx, wz] = P(lx, lz); b.add(rbGeo(w, h, d, r), mtx(wx, y + ly, wz, 1, 1, 1, ry), c); return this; },
    cyl(lx, ly, lz, r, h, c, seg, rx = 0, rz = 0) { const [wx, wz] = P(lx, lz); b.add(seg === 8 ? G.cyl8 : G.cyl, mtx(wx, y + ly, wz, r * 2, h, r * 2, ry, rx, rz), c); return this; },
    sph(lx, ly, lz, r, c, sy = 1) { const [wx, wz] = P(lx, lz); b.add(G.sph, mtx(wx, y + ly, wz, r * 2, r * 2 * sy, r * 2, ry), c); return this; }
  };
}

/* ---------- 素材 ----------
   litMat: 頂点の色 × 自分の明るさ(uSelf)を足す。室内が日の影でも暗く沈まないように、夜は灯りの色で明るくする */
function litMat(o = {}) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: o.vc !== false, roughness: o.r ?? .86, metalness: o.m ?? 0 });
  const u = { uSelf: { value: new THREE.Vector3().fromArray(o.self || [0, 0, 0]) }, uTint: { value: new THREE.Vector3(1, 1, 1) } };
  m.onBeforeCompile = sh => {
    sh.uniforms.uSelf = u.uSelf; sh.uniforms.uTint = u.uTint;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSelf;\nuniform vec3 uTint;')
      .replace('#include <color_fragment>', '#include <color_fragment>\n\tdiffuseColor.rgb *= uTint;')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += diffuseColor.rgb * uSelf;');
  };
  m.userData.u = u;
  return m;
}

/* ================================================================
   人(立つ・座る)。体・頭・髪をそれぞれインスタンスで描く
   ================================================================ */
function lathe(pts) { return new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 12); }
function mergeGeos(list) {
  let n = 0; const parts = list.map(([g, m]) => { const c = ni(g.clone()).applyMatrix4(m || new THREE.Matrix4()); n += c.attributes.position.count; return c; });
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3); let o = 0;
  for (const c of parts) { P.set(c.attributes.position.array, o * 3); N.set(c.attributes.normal.array, o * 3); o += c.attributes.position.count; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); g.computeBoundingSphere();
  return g;
}
const STAND_GEO = lathe([[0, 0], [.07, 0], [.084, .04], [.084, .4], [.116, .47], [.11, .56], [.126, .7], [.132, .78], [.118, .83], [.06, .86], [.034, .9], [0, .9]]);
const SIT_GEO = mergeGeos([
  [lathe([[0, 0], [.116, 0], [.122, .04], [.11, .12], [.126, .27], [.132, .36], [.118, .41], [.06, .44], [.034, .48], [0, .48]])],
  [new THREE.BoxGeometry(.21, .11, .3), new THREE.Matrix4().makeTranslation(0, .05, .14)],
  [new THREE.BoxGeometry(.16, .34, .1), new THREE.Matrix4().makeTranslation(0, -.15, .27)]
]);
const HEAD_GEO = new THREE.SphereGeometry(.104, 14, 10);
const HAIR_GEO = new THREE.SphereGeometry(.112, 14, 7, 0, Math.PI * 2, 0, Math.PI * .56);
const HEAD_STAND = .99, HEAD_SIT = .57, SEAT = .34;
const UP = new THREE.Vector3(0, 1, 0), ONE = new THREE.Vector3(1, 1, 1);

/* 人を1人足す。lv=0 は外。walk: { x0, x1, v } で x の向きに行き来する */
function person(P, r, lv, x, z, ry, o = {}) {
  const p = {
    lv, x, z, ry, sit: !!o.sit, seat: o.seat ?? SEAT, y: o.y ?? (lv ? floorY(lv) : .06),
    cloth: o.cloth || C.cloth[Math.floor(r() * C.cloth.length)], skin: C.skin[Math.floor(r() * C.skin.length)], hair: o.hair || C.hair[Math.floor(r() * C.hair.length)],
    walk: o.walk ? { x0: o.walk[0], x1: o.walk[1], v: o.walk[2] || .5, ph: r() * Math.PI * 2, zf: o.walkZ ? 1 : 0 } : null, cur: ry
  };
  P.push(p);
  return p;
}

/* ================================================================
   建物の殻(階ごと): スラブ・左の札の柱・右の壁・奥の壁・切り口・窓
   ================================================================ */
function shellLevel(B, lv) {
  const s = B.shell, w = B.win, y0 = yOf(lv);
  const roof = lv === 8;
  // スラブ(切り口は暗い板の色)
  if (!roof) bb(s, XI0, XI1, y0, y0 + ST, ZB, ZF, C.cut);
  else bb(s, X0, X1, y0, y0 + ST, ZB, ZF, C.cut);
  // 左の柱(屋上では塔屋)
  bb(s, X0, XI0, y0 + (roof ? ST : 0), y0 + FH, ZB, ZF, C.ext);
  bb(s, X0, XI0, y0 + (roof ? ST : 0), y0 + FH, ZF, ZF + .012, C.cut);      // 柱の切り口
  if (!roof) {
    // 右の壁と、その切り口
    bb(s, XI1, X1, y0, y0 + FH, ZB, ZF, C.ext);
    bb(s, XI1, X1, y0, y0 + FH, ZF, ZF + .012, C.cut);
    // 奥の壁(外は白、内は階の色)
    bb(s, X0, X1, y0, y0 + FH, ZB, ZI0, C.ext);
    bb(B.lv[lv], XI0, XI1, y0 + ST, y0 + FH, ZI0, ZI0 + .012, FCOL[lv]);
    bb(B.lv[lv], XI0, XI1, y0 + ST, y0 + ST + .07, ZI0 + .012, ZI0 + .03, tint(FCOL[lv], .45, '#2A2F33')); // 幅木
    // 左の柱の内側の面と、床
    bb(B.lv[lv], XI0, XI0 + .012, y0 + ST, y0 + FH, ZI0, ZF, C.wallIn);
    bb(B.lv[lv], XI0, XI1, y0 + ST, y0 + ST + .015, ZI0, ZF, tint(FCOL[lv], lv === 1 ? .1 : .13, '#E8DFD1'));
    // 左の壁の扉(階段へ)と、非常口の灯り
    bb(B.lv[lv], XI0 + .012, XI0 + .03, y0 + ST, y0 + ST + 1.3, -.95, -.15, C.woodD);
    bb(B.lv[lv], XI0 + .03, XI0 + .04, y0 + ST + .62, y0 + ST + .66, -.32, -.24, C.steelL);
    bb(B.glow, XI0 + .012, XI0 + .04, y0 + ST + 1.42, y0 + ST + 1.56, -.7, -.4, '#39B36B');
    // 外の窓(右の壁の手前・左の壁・奥の壁)
    const wy = y0 + ST + .5, wh = 1.0;
    win(w, s, X1 + .006, wy, 1.32, .05, wh, .62);
    for (const z of [-.95, .95]) win(w, s, X0 - .006, wy, z, .05, wh, .7);
    for (const x of [-3, -1.2, .6, 2.4]) win(w, s, x, wy, ZB - .006, .9, wh, .05);
  } else {
    // 屋上: 右と奥の手すり壁、手前はガラスの手すり
    bb(s, XI1, X1, y0 + ST, y0 + ST + .52, ZB, ZF, C.ext);
    bb(s, XI1, X1, y0 + ST, y0 + ST + .52, ZF, ZF + .012, C.cut);
    bb(s, XI0, XI1, y0 + ST, y0 + ST + .52, ZB, ZI0, C.ext);
    bb(s, X0 - .02, XI0 + .02, y0 + FH, TOWER_TOP, ZB - .02, ZF + .02, C.ext);   // 塔屋の屋根
    bb(s, X0 - .02, XI0 + .02, y0 + FH, TOWER_TOP, ZF + .02, ZF + .032, C.cut);
    for (const z of [-.95, .95]) win(w, s, X0 - .006, y0 + ST + .55, z, .05, .9, .55);
    // 塔屋の扉(屋上へ出る)
    bb(s, XI0, XI0 + .03, y0 + ST, y0 + ST + 1.32, -.2, .55, C.steelD);
    bb(s, XI0 + .03, XI0 + .045, y0 + ST + .05, y0 + ST + 1.24, -.13, .48, C.steelL);
  }
}
/* 外の窓: ガラス(夜は灯る)と枠 */
function win(w, s, x, y, z, sx, h, sz) {
  bx(w, x, y, z, sx, h, sz, '#FFFFFF');
  bx(s, x, y - .05, z, sx * .9 + (sx > .5 ? .1 : 0), h + .1, sz * .9 + (sz > .5 ? .1 : 0), C.extD);
}
/* その階だけを撮るとき、上のスラブで箱を閉じる */
function capSlab(B, lv) {
  const y = yOf(lv + 1);
  bb(B.shell, XI0, XI1, y, y + ST, ZB, ZF, C.cut);
  bb(B.shell, X0, X1, y + ST, y + ST + .015, ZB, ZF - .02, '#DCD6CC');
  bb(B.shell, X0, XI0, y, y + ST, ZB, ZF, C.ext); bb(B.shell, X0, XI0, y, y + ST, ZF, ZF + .012, C.cut);
  bb(B.shell, XI1, X1, y, y + ST, ZB, ZF, C.ext); bb(B.shell, XI1, X1, y, y + ST, ZF, ZF + .012, C.cut);
  bb(B.shell, X0, X1, y, y + ST, ZB, ZI0, C.ext);
}

/* ================================================================
   家具
   ================================================================ */
function chair(b, y, x, z, ry, c = C.chair) { grp(b, x, y, z, ry).box(0, 0, 0, .07, .27, .07, C.steelD).box(0, .26, 0, .36, .07, .36, c).box(0, .31, -.16, .36, .38, .055, c); }
function stool(b, y, x, z, c = C.wood) { grp(b, x, y, z).cyl(0, 0, 0, .035, .42, C.steelD, 8).cyl(0, .42, 0, .15, .05, c); }
function plant(b, y, x, z, s = 1, k = 0) {
  cy(b, x, y, z, .17 * s, .34 * s, C.pot);
  sp(b, x, y + .58 * s, z, .3 * s, C.leaf[k % 4], 1.15);
  sp(b, x + .12 * s, y + .78 * s, z - .05 * s, .2 * s, C.leaf[(k + 1) % 4]);
}
function monitor(b, g2, y, x, z, ry, w = .44, h = .28, face = '#A9C6E0', bars) {
  const g = grp(b, x, y, z, ry);
  g.box(0, 0, -.02, .16, .02, .12, C.dark).box(0, .02, -.04, .035, .14, .03, C.dark).box(0, .14, 0, w + .04, h + .04, .03, C.screen);
  const f = grp(g2, x, y, z, ry); f.box(0, .16, .017, w, h, .006, face);
  if (bars) bars.forEach(([bx2, bh, bc]) => f.box(-w / 2 + .06 + bx2 * (w - .1), .19, .022, .05, bh * (h - .07), .004, bc));
}
function table(b, y, x, z, w, d, h = .5, top = C.white, ry = 0) {
  grp(b, x, y, z, ry).box(0, h - .05, 0, w, .05, d, top).box(-w / 2 + .06, 0, 0, .05, h - .05, d - .1, C.steelL).box(w / 2 - .06, 0, 0, .05, h - .05, d - .1, C.steelL);
}
function roundTable(b, y, x, z, r = .32, h = .5, top = C.white) { grp(b, x, y, z).cyl(0, 0, 0, .14, .02, C.steelD).cyl(0, 0, 0, .03, h, C.steelD, 8).cyl(0, h - .04, 0, r, .04, top); }

/* ================================================================
   各階の中(床の面を y=0 とした座標。室内は x: -3.5〜4.28、z: -1.68(奥の壁)〜1.9(切り口))
   ================================================================ */
const INTERIOR = {
  /* 1F 総合案内: 受付カウンター・待合のベンチ・小さなフロアガイド */
  1(B, P, r) {
    const b = B.lv[1], g2 = B.glow, y = floorY(1);
    // 受付の後ろの木の壁と、白い i の札
    bb(b, -1.45, 2.05, y, y + CLEAR, ZI0 + .012, ZI0 + .05, C.woodL);
    for (let i = 0; i < 18; i++) bb(b, -1.4 + i * .195, -1.4 + i * .195 + .1, y, y + CLEAR, ZI0 + .05, ZI0 + .075, C.wood);
    bb(g2, -2.9, -1.95, y + .78, y + 1.2, ZI0 + .012, ZI0 + .03, '#F4F2EC');
    grp(g2, -2.425, y + .8, ZI0 + .034).box(0, 0, 0, .07, .22, .01, FCOL[1]).box(0, .27, 0, .08, .08, .01, FCOL[1]);
    grp(B.lamp, .3, y + 1.55, -1.4).box(-1.2, 0, 0, .5, .04, .12, '#FFF1D2').box(0, 0, 0, .5, .04, .12, '#FFF1D2').box(1.2, 0, 0, .5, .04, .12, '#FFF1D2');
    grp(b, .25, y, -.72).box(0, 0, 0, 3.1, .6, .5, C.white).box(0, .6, .02, 3.2, .05, .6, C.wood).box(0, .02, .26, 3.1, .07, .01, tint(FCOL[1], .55));
    monitor(b, g2, y + .65, -.55, -.86, 0, .36, .22, '#B9D2E6');
    monitor(b, g2, y + .65, 1.0, -.86, 0, .36, .22, '#B9D2E6');
    person(P, r, 1, -.55, -1.32, 0, { cloth: C.cloth[0] });
    person(P, r, 1, 1.0, -1.3, 0, { cloth: C.cloth[1] });
    person(P, r, 1, -.15, -.05, Math.PI, { cloth: C.cloth[4] });
    person(P, r, 1, .55, .1, Math.PI * .85, { cloth: C.cloth[7] });
    // 待合のベンチ(右を向く)
    for (const [bxp, n] of [[-3.05, 4], [-2.15, 4]]) {
      const g = grp(b, bxp, y, -.1, Math.PI / 2);
      g.box(0, 0, 0, 1.9, .05, .1, C.steelD).box(-.8, 0, 0, .06, .26, .3, C.steelD).box(.8, 0, 0, .06, .26, .3, C.steelD);
      for (let i = 0; i < n; i++) g.rbox(-.72 + i * .48, .26, 0, .42, .08, .38, .03, '#8FA3B6').rbox(-.72 + i * .48, .32, -.17, .42, .36, .06, .03, '#8FA3B6');
    }
    person(P, r, 1, -3.05, -.82, Math.PI / 2, { sit: true });
    person(P, r, 1, -3.05, .62, Math.PI / 2, { sit: true });
    person(P, r, 1, -2.15, -.34, Math.PI / 2, { sit: true });
    person(P, r, 1, -2.15, .14, Math.PI / 2, { sit: true, cloth: C.cloth[9] });
    // 小さなフロアガイド(C の札)
    const fg = grp(b, 3.25, y, -1.3);
    fg.box(0, 0, 0, .5, .05, .26, C.dark).box(0, .05, 0, .05, .3, .05, C.dark).box(0, .32, 0, .62, 1.0, .05, C.cut);
    for (let i = 0; i < 8; i++) fg.box(-.17, .4 + i * .112, .03, .2, .085, .01, FCOL[i + 1]).box(.1, .43 + i * .112, .03, .3, .025, .01, '#9AA3AA');
    plant(b, y, 4.0, -1.35, 1.1, 0);
    plant(b, y, -3.2, 1.35, .9, 2);
    person(P, r, 1, 2.6, .75, Math.PI / 2, { walk: [1.9, 3.7, .45], cloth: C.cloth[2] });
  },
  /* 2F 試す・作品: ソファ・ガチャ・窓あかりの絵・カフェ */
  2(B, P, r) {
    const b = B.lv[2], g2 = B.glow, y = floorY(2);
    const so = grp(b, -2.55, y, -1.22);
    so.rbox(0, 0, 0, 1.9, .3, .66, .06, C.sofa).rbox(0, .28, .02, 1.7, .1, .56, .05, C.cushion).rbox(0, .3, -.27, 1.9, .5, .16, .06, C.sofa).rbox(-.9, .3, 0, .16, .26, .66, .05, C.sofa).rbox(.9, .3, 0, .16, .26, .66, .05, C.sofa);
    person(P, r, 2, -3.0, -1.1, 0, { sit: true });
    person(P, r, 2, -2.2, -1.1, 0, { sit: true });
    grp(b, -2.55, y, -.18).rbox(0, .24, 0, 1.1, .06, .52, .02, C.wood).box(-.45, 0, 0, .06, .24, .4, C.woodD).box(.45, 0, 0, .06, .24, .4, C.woodD).cyl(-.2, .3, .05, .045, .08, C.white, 8).cyl(.15, .3, -.08, .045, .08, C.white, 8);
    // ガチャ
    const ga = grp(b, -.15, y, -1.3);
    ga.box(0, 0, 0, .5, .55, .44, '#D9654F').box(0, .12, .225, .3, .12, .02, C.white).box(0, .55, 0, .44, .06, .4, C.white).sph(0, .82, 0, .26, '#F5F2EA', .95);
    [['#F2C11C', -.08, .74, .08], ['#2356C4', .08, .76, .1], ['#087A4F', 0, .74, -.06], ['#C24813', .12, .8, -.02], ['#8ACFEA', -.12, .82, .0]].forEach(([c2, a, b2, d]) => ga.sph(a, b2, d, .055, c2));
    person(P, r, 2, -.1, -.72, Math.PI, { cloth: C.cloth[3] });
    // 窓あかりの絵(夜の病院)
    grp(b, 1.55, y, ZI0 + .03).box(0, .5, 0, 1.36, .66, .04, C.woodD);
    const pic = grp(g2, 1.55, y, ZI0 + .055);
    pic.box(0, .54, 0, 1.24, .58, .01, '#253252');
    for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) if ((i * 7 + j * 3) % 5 !== 1) pic.box(-.3 + i * .2, .64 + j * .12, .006, .09, .06, .004, '#F4C56A');
    pic.box(-.44, .54, .006, .28, .18, .004, '#3B4A6E');
    // カフェのカウンター
    grp(b, 3.45, y, -1.25).box(0, 0, 0, 1.4, .62, .46, C.white).box(0, .62, 0, 1.48, .05, .52, C.wood).box(.38, .67, -.05, .26, .3, .26, C.dark).box(-.3, .67, 0, .2, .02, .2, C.steelL);
    person(P, r, 2, 3.3, -.62, Math.PI, { cloth: C.cloth[6] });
    roundTable(b, y, 1.4, .55, .3, .5, C.white);
    stool(b, y, 1.0, .62); stool(b, y, 1.8, .5);
    person(P, r, 2, 1.0, .62, Math.PI / 2, { sit: true, seat: .47 });
    plant(b, y, -3.25, 1.3, 1.0, 1);
    plant(b, y, 4.0, 1.25, .8, 3);
    person(P, r, 2, -.6, .95, Math.PI / 2, { walk: [-1.4, .6, .4] });
  },
  /* 3F 学習: 本棚・大きな机・読書の椅子 */
  3(B, P, r) {
    const b = B.lv[3], g2 = B.glow, y = floorY(3), rr = rng(33);
    const sx0 = -3.42, sx1 = .9, sz = -1.5;
    bb(b, sx0, sx1, y, y + 1.26, sz - .17, sz + .17, C.woodL);
    const books = ['#E9E2D3', '#2E3C56', '#5F8FB0', '#C2735A', '#5E7F5A', '#E2C48F', '#3F6F7C', '#B9A68A', '#F4F1EA', '#8D5F4F', '#00737E', '#D9A441'];
    for (let sh = 0; sh < 4; sh++) {
      const yb = y + .05 + sh * .3;
      bb(b, sx0, sx1, yb - .03, yb, sz - .15, sz + .17, C.wood);
      let x = sx0 + .05;
      while (x < sx1 - .08) { const wv = .045 + rr() * .045, hv = .2 + rr() * .06; if (rr() > .05) bx(b, x + wv / 2, yb, sz + .07, wv, hv, .2, books[Math.floor(rr() * books.length)]); x += wv + .004; }
    }
    for (const px of [sx0, sx1]) bb(b, px - .02, px + .02, y, y + 1.26, sz - .17, sz + .17, C.wood);
    // 大きな机と灯り
    table(b, y, 2.55, -.35, 2.5, .86, .5, C.woodL);
    for (const lx of [1.75, 3.35]) { grp(b, lx, y + .5, -.62).cyl(0, 0, 0, .06, .015, C.dark).box(0, 0, 0, .02, .34, .02, C.dark).box(.06, .32, 0, .16, .02, .03, C.dark); grp(B.lamp, lx + .14, y + .79, -.62).cyl(0, 0, 0, .06, .05, '#FFF3D6'); }
    for (const [cx, cz, ry] of [[1.85, -1.0, 0], [3.25, -1.0, 0], [1.85, .3, Math.PI], [3.25, .3, Math.PI]]) chair(b, y, cx, cz, ry, '#6A7883');
    person(P, r, 3, 1.85, -1.0, 0, { sit: true });
    person(P, r, 3, 3.25, -1.0, 0, { sit: true, cloth: C.cloth[0] });
    person(P, r, 3, 1.85, .3, Math.PI, { sit: true });
    for (const [px, pz] of [[1.95, -.42], [3.15, -.4], [2.0, -.22]]) bx(b, px, y + .5, pz, .26, .02, .18, C.paper);
    // 読書の椅子
    const ac = grp(b, -2.75, y, .75, Math.PI / 2);
    ac.rbox(0, 0, 0, .7, .32, .66, .08, '#5D7D86').rbox(0, .3, -.27, .7, .48, .14, .06, '#5D7D86').rbox(-.33, .3, 0, .12, .2, .66, .05, '#5D7D86').rbox(.33, .3, 0, .12, .2, .66, .05, '#5D7D86');
    person(P, r, 3, -2.75, .75, Math.PI / 2, { sit: true, seat: .32 });
    person(P, r, 3, -.6, -.95, Math.PI, { cloth: C.cloth[2] });
    person(P, r, 3, -2.2, -1.0, Math.PI * 1.1);
    plant(b, y, 4.05, 1.3, .9, 2);
    person(P, r, 3, -.4, .95, Math.PI / 2, { walk: [-1.6, .9, .35] });
    void g2;
  },
  /* 4F 経営・管理: 机と画面(数字のグラフ)・カンバンの板・打ち合わせ */
  4(B, P, r) {
    const b = B.lv[4], g2 = B.glow, y = floorY(4);
    const bars = [[[0, .4, '#7C5CC4'], [.25, .65, '#7C5CC4'], [.5, .5, '#2E9C76'], [.75, .85, '#E08A4E']], [[0, .7, '#2E9C76'], [.25, .45, '#2E9C76'], [.5, .9, '#7C5CC4'], [.75, .6, '#7C5CC4']], [[0, .55, '#E08A4E'], [.25, .8, '#7C5CC4'], [.5, .35, '#2E9C76'], [.75, .7, '#2E9C76']]];
    [-2.55, -1.3, -.05].forEach((dx, i) => {
      table(b, y, dx, -1.18, 1.1, .56, .5, C.white);
      monitor(b, g2, y + .5, dx, -1.28, 0, .5, .3, '#EEF1F6', bars[i]);
      chair(b, y, dx, -.52, Math.PI, '#4C5A66');
    });
    person(P, r, 4, -2.55, -.52, Math.PI, { sit: true });
    person(P, r, 4, -1.3, -.52, Math.PI, { sit: true, cloth: C.cloth[0] });
    person(P, r, 4, -.05, -.52, Math.PI, { sit: true });
    // カンバン
    grp(b, 2.65, y, ZI0 + .03).box(0, .42, 0, 2.5, .82, .04, C.white).box(0, .4, 0, 2.56, .03, .07, C.grayD);
    const kb = grp(b, 2.65, y, ZI0 + .055), notes = ['#F2D46B', '#F0AFA5', '#A4CDEA', '#BFE2B0'];
    for (let c2 = 0; c2 < 4; c2++) { kb.box(-1.08 + c2 * .6 + .2, 1.14, 0, .44, .03, .005, C.grayD); for (let k = 0; k < 4 - (c2 % 3); k++) kb.box(-1.08 + c2 * .6 + .2 + (k % 2) * .2 - .1, .97 - Math.floor(k / 2) * .19 - (k % 2) * .03, 0, .16, .14, .01, notes[(c2 + k) % 4]); }
    person(P, r, 4, 2.2, -1.05, Math.PI, { cloth: C.cloth[1] });
    person(P, r, 4, 3.4, -.8, Math.PI * .8, { cloth: C.cloth[9] });
    roundTable(b, y, 2.5, .62, .42, .5, C.white);
    chair(b, y, 2.0, .62, Math.PI / 2); chair(b, y, 3.0, .62, -Math.PI / 2);
    person(P, r, 4, 2.0, .62, Math.PI / 2, { sit: true, cloth: C.cloth[6] });
    person(P, r, 4, 3.0, .62, -Math.PI / 2, { sit: true });
    bx(b, 2.45, y + .5, .55, .3, .02, .22, C.paper);
    bb(b, -3.48, -3.0, y, y + 1.1, .2, 1.0, C.gray); bb(b, -3.0, -2.99, y + .05, y + 1.05, .24, .96, '#AEB3B7');
    person(P, r, 4, -1.6, .95, -Math.PI / 2, { walk: [-2.6, .8, .42], cloth: C.cloth[5] });
  },
  /* 5F 業務: ナースステーション・掲示板・薬のカート・車いす */
  5(B, P, r) {
    const b = B.lv[5], g2 = B.glow, y = floorY(5);
    grp(b, 1.2, y, -.35).box(0, 0, 0, 3.1, .66, .3, C.white).box(0, .66, 0, 3.18, .04, .36, '#9CB8A9');
    table(b, y, 1.2, -.86, 3.0, .46, .48, C.white);
    monitor(b, g2, y + .48, .4, -.92, Math.PI, .4, .25, '#BFD7CB');
    monitor(b, g2, y + .48, 1.9, -.92, Math.PI, .4, .25, '#BFD7CB');
    chair(b, y, .4, -1.36, 0); chair(b, y, 1.9, -1.36, 0);
    person(P, r, 5, .4, -1.36, 0, { sit: true, cloth: C.cloth[2] });
    person(P, r, 5, 1.9, -1.36, 0, { sit: true, cloth: C.cloth[1] });
    person(P, r, 5, 2.85, -1.2, -Math.PI * .2, { cloth: C.cloth[0] });
    // 掲示板(掲示じたく)
    grp(b, -2.4, y, ZI0 + .03).box(0, .44, 0, 1.8, .78, .04, C.cork).box(0, .42, 0, 1.86, .03, .07, C.woodD);
    const nb = grp(b, -2.4, y, ZI0 + .055);
    [[-.6, .82, .32, .42], [-.15, .86, .3, .36], [.3, .8, .34, .44], [-.42, .52, .36, .26], [.12, .5, .3, .24], [.56, .55, .26, .3]].forEach(([px, py, pw, ph], i) => { nb.box(px, py - ph / 2 + .18, 0, pw, ph, .008, C.paper); nb.box(px, py + .2, .006, .03, .03, .01, i % 2 ? '#C62A21' : '#F2C11C'); nb.box(px, py + .08, .006, pw * .6, .03, .006, i % 3 ? '#087A4F' : '#2356C4'); });
    person(P, r, 5, -2.0, -1.12, Math.PI, { cloth: C.cloth[3] });
    // 薬のカート
    const cart = grp(b, 3.55, y, .3);
    cart.box(0, .08, 0, .56, .62, .42, C.white).box(0, .7, 0, .62, .03, .46, '#9CB8A9');
    for (let i = 0; i < 3; i++) cart.box(0, .16 + i * .18, .215, .5, .12, .01, ['#A4CDEA', '#BFE2B0', '#F2D46B'][i]);
    for (const [wx, wz] of [[-.22, -.16], [.22, -.16], [-.22, .16], [.22, .16]]) cart.cyl(wx, 0, wz, .04, .08, C.dark, 8);
    person(P, r, 5, 3.0, .35, Math.PI / 2, { cloth: C.cloth[2] });
    // 車いす
    const wc = grp(b, -.6, y, .95, Math.PI / 2);
    wc.box(0, .3, 0, .38, .05, .38, C.dark).box(0, .32, -.18, .38, .36, .04, C.dark).cyl(-.21, .02, 0, .26, .03, C.steelD, 20, 0, Math.PI / 2).cyl(.21, .02, 0, .26, .03, C.steelD, 20, 0, Math.PI / 2);
    person(P, r, 5, -.6, .95, Math.PI / 2, { sit: true, seat: .35, cloth: C.cloth[6] });
    person(P, r, 5, -1.12, .95, Math.PI / 2, { cloth: C.cloth[0] });
    bx(b, 4.0, y, -1.38, .46, .36, .38, C.gray); bx(b, 4.0, y + .36, -1.38, .4, .03, .3, C.paper);
    person(P, r, 5, .9, 1.2, -Math.PI / 2, { walk: [-2.9, 2.2, .5], cloth: C.cloth[1] });
  },
  /* 6F 経営を学ぶ: 大きなスクリーン(小さな町)・演台・並んだ椅子・建物の模型 */
  6(B, P, r) {
    const b = B.lv[6], g2 = B.glow, y = floorY(6);
    grp(b, -.9, y, ZI0 + .03).box(0, .38, 0, 3.5, .86, .05, C.screen);
    const sc = grp(g2, -.9, y, ZI0 + .058);
    sc.box(0, .42, 0, 3.36, .76, .006, '#DCEAF0');
    sc.box(0, .42, .004, 3.36, .2, .004, '#C2D9C3');
    const blocks = [[-1.3, .25, .22, '#F7F4EE'], [-.95, .3, .3, '#E7B79B'], [-.55, .22, .2, '#F7F4EE'], [-.15, .36, .26, '#A9CDE3'], [.3, .26, .22, '#F7F4EE'], [.7, .32, .3, '#E7B79B'], [1.15, .24, .2, '#C7E0C1'], [-1.55, .2, .15, '#E7B79B']];
    blocks.forEach(([bx2, bw, bh, bc]) => sc.box(bx2, .58, .008, bw, bh, .004, bc));
    sc.box(.25, .9, .008, .55, .07, .004, '#C24813');
    grp(b, 1.55, y, -1.05).box(0, 0, 0, .44, .78, .36, C.woodD).box(0, .78, -.02, .5, .05, .44, C.wood);
    person(P, r, 6, 2.05, -1.12, -Math.PI * .22, { cloth: C.cloth[0] });
    for (const z of [-.05, .72]) for (const x of [-2.7, -1.85, -1.0, -.15]) chair(b, y, x, z, Math.PI, '#5A6670');
    [[-2.7, -.05], [-1.85, -.05], [-.15, -.05], [-2.7, .72], [-1.0, .72], [-.15, .72]].forEach(([x, z], i) => person(P, r, 6, x, z, Math.PI, { sit: true, cloth: [C.cloth[1], C.cloth[4], C.cloth[2], C.cloth[6], C.cloth[0], C.cloth[5]][i] }));
    // 小さな建物の模型
    table(b, y, 3.5, .35, .9, .6, .5, C.white);
    const md = grp(b, 3.5, y + .5, .35);
    md.box(0, 0, 0, .56, .03, .4, '#D8D2C6').box(-.08, .03, 0, .26, .22, .2, C.white).box(.16, .03, .02, .16, .14, .16, '#E7B79B').box(-.08, .25, 0, .28, .02, .22, '#C24813');
    person(P, r, 6, 3.5, .95, Math.PI, { cloth: C.cloth[3] });
    plant(b, y, 4.05, -1.32, .9, 0);
  },
  /* 7F キャリア: 案内端末(Compass)・窓の外を見る人・道しるべ・相談のテーブル */
  7(B, P, r) {
    const b = B.lv[7], g2 = B.glow, y = floorY(7);
    // 窓(外の景色)
    grp(b, 1.75, y, ZI0 + .03).box(0, .36, 0, 2.9, .9, .05, C.white);
    grp(B.sky, 1.75, y, ZI0 + .058).box(-.72, .42, 0, 1.36, .78, .006, '#FFFFFF').box(.72, .42, 0, 1.36, .78, .006, '#FFFFFF');
    person(P, r, 7, 1.45, -1.15, Math.PI, { cloth: C.cloth[4] });
    // 案内端末
    const ki = grp(b, -2.7, y, -1.1, .55);
    ki.box(0, 0, 0, .44, .04, .36, C.dark).box(0, .04, -.04, .08, .5, .08, C.dark).box(0, .5, 0, .5, .8, .06, C.screen);
    const ks = grp(g2, -2.7, y, -1.1, .55);
    ks.box(0, .54, .032, .44, .72, .006, '#2356C4').box(0, .92, .038, .26, .26, .004, '#F5F7FB').box(0, .66, .038, .32, .05, .004, '#BFD0F3').box(0, .6, .038, .26, .04, .004, '#BFD0F3');
    person(P, r, 7, -2.2, -.62, Math.PI * 1.32, { cloth: C.cloth[7] });
    // 道しるべ
    const sg = grp(b, -.9, y, .55);
    sg.cyl(0, 0, 0, .16, .03, C.dark).box(0, 0, 0, .06, 1.25, .06, C.dark).box(.22, 1.0, 0, .52, .15, .04, '#2356C4').box(-.2, .8, 0, .48, .15, .04, C.white).box(.18, .6, 0, .44, .15, .04, '#8ACFEA');
    // 相談のテーブル
    roundTable(b, y, 3.3, .5, .38, .5, C.white);
    chair(b, y, 2.85, .5, Math.PI / 2, '#3E5C91'); chair(b, y, 3.75, .5, -Math.PI / 2, '#3E5C91');
    person(P, r, 7, 2.85, .5, Math.PI / 2, { sit: true, cloth: C.cloth[0] });
    person(P, r, 7, 3.75, .5, -Math.PI / 2, { sit: true, cloth: C.cloth[9] });
    bx(b, 3.2, y + .5, .45, .26, .02, .2, C.paper);
    bb(b, -1.5, -.25, y, y + .62, -1.66, -1.3, C.woodL);
    for (let i = 0; i < 5; i++) bx(b, -1.38 + i * .26, y + .62, -1.48, .17, .22, .03, ['#2356C4', '#F1EEE6', '#8ACFEA', '#F1EEE6', '#2356C4'][i]);
    plant(b, y, 4.05, 1.25, 1.0, 1);
    person(P, r, 7, .6, 1.05, Math.PI / 2, { walk: [-.2, 2.2, .38], cloth: C.cloth[2] });
  },
  /* RF 屋上: デッキ・空色の日よけ・植え込み・望遠鏡・BRIDGE の看板 */
  8(B, P, r) {
    const b = B.lv[8], y = yOf(8) + ST;
    for (let i = 0; i < 14; i++) { const z0 = ZI0 + i * (ZF - .06 - ZI0) / 14, z1 = z0 + (ZF - .06 - ZI0) / 14 - .012; bb(b, XI0, XI1, y, y + .04, z0, z1, i % 2 ? C.woodL : '#D6C09C'); }
    const yd = y + .04;
    // ガラスの手すり(手前)
    for (let x = XI0 + .1; x <= XI1 + .01; x += 1.2) bx(b, x, yd, ZF - .04, .04, .78, .04, C.steelL);
    bb(b, XI0, XI1, yd + .74, yd + .78, ZF - .07, ZF - .01, C.steelL);
    bb(B.glass, XI0, XI1, yd, yd + .74, ZF - .045, ZF - .035, '#FFFFFF');
    // 日よけ(空色)
    const pg = grp(b, -2.45, yd, -.75);
    for (const [px, pz] of [[-.9, -.7], [.9, -.7], [-.9, .6], [.9, .6]]) pg.box(px, 0, pz, .07, 1.6, .07, C.white);
    pg.box(0, 1.6, -.05, 2.0, .05, 1.5, '#8ACFEA').box(0, 1.55, -.05, 2.0, .05, .07, C.white);
    for (let i = 0; i < 6; i++) pg.box(-.85 + i * .34, 1.66, -.05, .05, .02, 1.5, '#6FBBDC');
    grp(b, -2.45, yd, -1.15).box(0, .3, 0, 1.5, .06, .4, C.wood).box(-.62, 0, 0, .06, .3, .34, C.steelD).box(.62, 0, 0, .06, .3, .34, C.steelD).box(0, .36, -.18, 1.5, .3, .05, C.wood);
    person(P, r, 8, -2.85, -1.15, 0, { sit: true, y: yd });
    person(P, r, 8, -2.1, -1.15, 0, { sit: true, y: yd, cloth: C.cloth[3] });
    // 植え込み
    for (const [px, k] of [[.35, 0], [1.55, 1], [2.75, 2]]) {
      bx(b, px, yd, -1.32, .9, .34, .46, C.pot);
      sp(b, px - .18, yd + .52, -1.32, .26, C.leaf[k]); sp(b, px + .18, yd + .48, -1.3, .22, C.leaf[(k + 1) % 4]);
      if (k === 1) { cy(b, px, yd + .34, -1.32, .03, .5, C.trunk, 8); sp(b, px, yd + 1.0, -1.32, .34, C.leaf[3], 1.1); }
    }
    // 望遠鏡と、遠くを見る人
    const ts = grp(b, 3.1, yd, 1.1, -.35);
    ts.cyl(0, 0, 0, .12, .04, C.dark).box(0, 0, 0, .06, .7, .06, C.dark).box(0, .72, .02, .16, .14, .3, C.steelD).cyl(-.05, .76, .2, .045, .06, C.dark, 8, Math.PI / 2).cyl(.05, .76, .2, .045, .06, C.dark, 8, Math.PI / 2);
    person(P, r, 8, 3.0, .7, -.35, { y: yd, cloth: C.cloth[7] });
    person(P, r, 8, .7, 1.25, 0, { y: yd, cloth: C.cloth[0] });
    person(P, r, 8, 1.15, 1.3, -.2, { y: yd, cloth: C.cloth[6] });
    // BRIDGE の看板(支柱と裏板)
    for (const px of [-.15, 3.45]) bx(b, px, yd, ZB + .3, .07, 2.1, .07, C.steelD);
    bx(b, 1.65, yd + 1.165, ZB + .355, 4.08, .83, .06, C.cut);
  }
};

/* ================================================================
   台(切った地面)と町: 舗装・歩道・道路・木・街灯・バス停
   ================================================================ */
function ground(B, P, r) {
  const g = B.ground;
  let yt = 0;
  for (const [h, c] of [[.18, C.grass], [.4, C.soil[0]], [.44, C.soil[1]], [.5, C.soil[2]]]) { bb(g, PX0, PX1, yt - h, yt, PZ0, PZ1, c); yt -= h; }
  bb(g, PX0, PX1, yt - .05, yt, PZ0, PZ1, C.soil[3]);
  // 病院の敷地・歩道・道路
  bb(g, -5.9, 7.4, 0, .03, -2.75, 3.5, C.pave);
  bb(g, PX0, PX1, 0, .06, 3.5, 4.22, C.paveL);
  bb(g, PX0, PX1, .06, .075, 4.12, 4.22, C.curb);
  bb(g, PX0, PX1, 0, .02, 4.22, 6.05, C.asphalt);
  bb(g, PX0, PX1, 0, .06, 6.05, PZ1, C.paveL);
  for (let x = PX0 + .5; x < PX1 - .4; x += 1.2) if (x < -1.1 || x > 1.6) bx(g, x + .25, .02, 5.13, .55, .006, .07, C.line);
  for (let x = -.95; x <= 1.4; x += .36) bx(g, x, .02, 5.13, .2, .006, 1.55, C.line);
  // 植え込み
  for (const [x0, x1] of [[PX0 + .5, -4.2], [-3.6, -1.3], [1.9, 4.6], [5.2, PX1 - .5]]) grp(g, (x0 + x1) / 2, .06, 6.5).rbox(0, 0, 0, x1 - x0, .3, .42, .12, C.hedge);
  // 木
  const T = (x, z, s, k) => { cy(g, x, .03, z, .06 * s, .75 * s, C.trunk, 8); sp(g, x, .95 * s, z, .52 * s, C.leaf[k % 4], 1.1); sp(g, x + .2 * s, 1.25 * s, z - .05 * s, .34 * s, C.leaf[(k + 1) % 4]); };
  T(-6.75, -2.35, 1.15, 0); T(-6.35, -.45, .9, 1); T(-7.0, 1.25, 1.0, 2); T(-5.55, 2.85, .7, 3);
  T(8.35, -2.45, 1.1, 1); T(7.95, -.75, .85, 2); T(8.55, 1.35, .95, 0);
  T(-3.2, -3.0, 1.25, 3); T(2.6, -3.05, 1.3, 0);
  // 街灯(台の両端)
  for (const x of [-7.2, 8.6]) { const lg = grp(g, x, .06, 3.66); lg.cyl(0, 0, 0, .035, 1.85, C.steelD, 8).box(x < 0 ? .12 : -.12, 1.82, 0, .3, .04, .06, C.steelD); grp(B.lamp, x + (x < 0 ? .25 : -.25), 1.76, 3.66).box(0, 0, 0, .16, .05, .1, '#FFF4D8'); }
  // バス停(左)
  const bs = grp(g, BUS_STOP, .06, 3.75);
  bs.box(-.72, 0, -.12, .05, 1.2, .05, C.steelD).box(.72, 0, -.12, .05, 1.2, .05, C.steelD).box(0, 1.2, 0, 1.6, .05, .5, C.white).box(0, .3, -.18, 1.3, .06, .3, C.wood);
  bb(B.glass, BUS_STOP - .7, BUS_STOP + .7, .36, 1.15, 3.6, 3.63, '#FFFFFF');
  grp(g, BUS_STOP + 1.0, .06, 3.95).box(0, 0, 0, .05, 1.3, .05, C.steelD).box(0, 1.15, 0, .32, .32, .04, '#3D7F86');
  person(P, r, 0, BUS_STOP - .3, 3.6, 0, { sit: true, y: .06 });
  person(P, r, 0, BUS_STOP + .35, 3.92, .3, { y: .06 });
  // 外を歩く人
  person(P, r, 0, -2, 3.86, Math.PI / 2, { y: .06, walk: [-6.8, 5.6, .55] });
  person(P, r, 0, 2, 3.96, -Math.PI / 2, { y: .06, walk: [-4.5, 6.2, .42] });
  person(P, r, 0, -1, 6.38, Math.PI / 2, { y: .06, walk: [-6.0, 7.5, .38] });
  person(P, r, 0, -4.7, 2.6, 0, { y: .03, cloth: C.cloth[4] });
  person(P, r, 0, -4.35, 2.75, -.6, { y: .03, cloth: C.cloth[8] });
  person(P, r, 0, 3.4, 2.7, Math.PI / 2, { y: .03, walk: [1.2, 5.9, .32], cloth: C.cloth[0] });
  // 敷地のベンチと植え込み
  grp(g, 2.6, .03, 2.95).box(0, .26, 0, 1.2, .06, .34, C.wood).box(-.5, 0, 0, .06, .26, .3, C.steelD).box(.5, 0, 0, .06, .26, .3, C.steelD);
  person(P, r, 0, 2.3, 2.95, 0, { sit: true, y: .03, cloth: C.cloth[6] });
  for (const [x, z] of [[-5.2, 1.0], [6.7, 2.4]]) { cy(g, x, .03, z, .32, .3, C.pot); sp(g, x, .55, z, .36, C.leaf[2], .8); }
}

/* ================================================================
   エレベーター: ガラスの塔・かご・綱
   ================================================================ */
function shaft(B) {
  const s = B.shell;
  bb(s, SX0, SX1, 0, ST, SZ0, SZ1, C.base);
  for (const [x, z] of [[SX0 + .04, SZ0 + .04], [SX0 + .04, SZ1 - .04], [SX1 - .04, SZ0 + .04], [SX1 - .04, SZ1 - .04]]) bx(s, x, ST, z, .08, SHAFT_TOP - ST, .08, C.steelD);
  for (let lv = 1; lv <= 8; lv++) {
    const y = yOf(lv) + ST - .05;
    bb(s, SX0, SX1, y, y + .05, SZ1 - .05, SZ1, C.steelD);
    bb(s, SX1 - .05, SX1, y, y + .05, SZ0, SZ1, C.steelD);
    bb(s, SX0, SX1, y, y + .05, SZ0, SZ0 + .05, C.steelD);
    // 乗り場の扉(右の壁の外側)
    const fy = floorY(lv);
    bb(s, X1, X1 + .03, fy, fy + 1.4, -.55, .55, C.steelD);
    bb(s, X1 + .03, X1 + .04, fy + .02, fy + 1.32, -.48, -.01, C.steelL);
    bb(s, X1 + .03, X1 + .04, fy + .02, fy + 1.32, .01, .48, C.steelL);
    bb(s, SX0, SX0 + .24, fy - .02, fy, -.55, .55, C.steelL);
  }
  bb(s, SX0 - .02, SX1 + .04, SHAFT_TOP, SHAFT_TOP + .55, SZ0 - .04, SZ1 + .04, C.ext);
  bb(s, SX0 - .02, SX1 + .04, SHAFT_TOP + .55, SHAFT_TOP + .62, SZ0 - .06, SZ1 + .06, C.steelL);
  bb(B.glass, SX0 + .04, SX1 - .02, ST, SHAFT_TOP, SZ0 + .02, SZ1 - .02, '#FFFFFF');
}
function makeCar(mats, r) {
  const g = new THREE.Group(), b = new Batch(), lit = new Batch();
  const w = 1.42, d = 1.46, h = 2.0;
  bx(b, 0, -.12, 0, w, .12, d, C.steelD);
  bx(b, 0, h, 0, w, .12, d, C.steelD);
  for (const [x, z] of [[-w / 2 + .03, -d / 2 + .03], [-w / 2 + .03, d / 2 - .03], [w / 2 - .03, -d / 2 + .03], [w / 2 - .03, d / 2 - .03]]) bx(b, x, 0, z, .06, h, .06, C.steelL);
  bx(b, -w / 2 + .05, 0, 0, .04, h, d - .1, C.woodL);
  bx(b, 0, 0, -d / 2 + .05, w - .1, h, .04, C.woodL);
  bx(b, -w / 2 + .12, .9, 0, .03, .04, d - .3, C.steelD);
  bx(b, 0, 0, 0, w - .06, .015, d - .06, '#8E8678');
  bx(lit, 0, h - .05, 0, 1.2, .05, 1.2, '#FFF3D8');
  bx(lit, w / 2 - .02, h - .32, 0, .02, .16, .42, '#FFB21A');
  // 乗っている人(手前を向く)
  const add = (geo, m, c) => b.add(geo.index ? geo.toNonIndexed() : geo, m, c);
  const cloth = C.cloth[3], skin = C.skin[0], hair = C.hair[1];
  add(STAND_GEO, new THREE.Matrix4().makeTranslation(.15, 0, .18), cloth);
  add(HEAD_GEO, new THREE.Matrix4().makeTranslation(.15, HEAD_STAND, .18), skin);
  add(HAIR_GEO, new THREE.Matrix4().makeTranslation(.15, HEAD_STAND + .014, .168), hair);
  g.add(b.mesh(mats.car), lit.mesh(mats.glow, false, false));
  void r;
  return g;
}

/* ================================================================
   札(階の番号とピクトグラム)と、屋上の看板。canvas に描いて貼る
   ================================================================ */
async function fontsReady() {
  try { await Promise.race([Promise.all([document.fonts.load('600 160px "Barlow Condensed"'), document.fonts.load('600 80px "Barlow"')]), new Promise(r => setTimeout(r, 2500))]); } catch (e) { /* 書体がなくても描く */ }
}
function tileTexture() {
  const TW = 256, TH = 558, cv = document.createElement('canvas'); cv.width = TW * 8; cv.height = TH;
  const g = cv.getContext('2d');
  for (let lv = 1; lv <= 8; lv++) {
    const x = (lv - 1) * TW, ink = FINK[lv] ? '#15191C' : '#FFFFFF';
    g.fillStyle = FCOL[lv]; g.fillRect(x, 0, TW, TH);
    g.fillStyle = ink; g.textBaseline = 'alphabetic';
    const num = KEY[lv];
    g.font = '600 200px "Barlow Condensed", "Arial Narrow", sans-serif'; const nw = g.measureText(num).width;
    g.font = '600 112px "Barlow Condensed", "Arial Narrow", sans-serif'; const fw = g.measureText('F').width;
    const sx = x + (TW - nw - fw - 2) / 2;
    g.font = '600 200px "Barlow Condensed", "Arial Narrow", sans-serif'; g.fillText(num, sx, 252);
    g.font = '600 112px "Barlow Condensed", "Arial Narrow", sans-serif'; g.fillText('F', sx + nw + 2, 252);
    drawPic(g, FPIC[lv], x + (TW - 122) / 2, 336, 122, ink);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function signTexture() {
  const cv = document.createElement('canvas'); cv.width = 1024; cv.height = 192;
  const g = cv.getContext('2d');
  g.fillStyle = '#1D2226'; g.fillRect(0, 0, 1024, 192);
  g.save(); g.translate(70, 34); g.scale(.98, .98); g.lineWidth = 9; g.strokeStyle = '#FFFFFF'; g.lineCap = 'butt';
  g.beginPath(); g.moveTo(8, 74); g.bezierCurveTo(62, 16, 118, 24, 176, 84); g.stroke();
  g.beginPath(); g.moveTo(58, 94); g.bezierCurveTo(118, 60, 158, 22, 232, 12); g.stroke();
  g.restore();
  g.fillStyle = '#FFFFFF'; g.font = '600 104px "Barlow", "Helvetica Neue", Arial, sans-serif'; g.textBaseline = 'middle';
  let x = 368; for (const ch of 'BRIDGE') { g.fillText(ch, x, 100); x += g.measureText(ch).width + 34; }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
function tileMesh(levels, tex) {
  const parts = [];
  for (const lv of levels) {
    const g = new THREE.PlaneGeometry(COLW - .12, CLEAR - .1);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, ((lv - 1) + uv.getX(i)) / 8);
    g.translate((X0 + XI0) / 2, yOf(lv) + ST + CLEAR / 2, ZF + .02);
    parts.push([lv, g]);
  }
  let n = 0; const ix = [];
  for (const [, g] of parts) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), UV = new Float32Array(n * 2), K = new Float32Array(n * 3).fill(1); const range = {};
  let o = 0;
  for (const [lv, g] of parts) {
    const k = g.attributes.position.count;
    P.set(g.attributes.position.array, o * 3); UV.set(g.attributes.uv.array, o * 2);
    for (let i = 0; i < g.index.count; i++) ix.push(g.index.array[i] + o);
    range[lv] = [o, k]; o += k;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.BufferAttribute(UV, 2)); geo.setAttribute('color', new THREE.BufferAttribute(K, 3)); geo.setIndex(ix);
  const mat = new THREE.MeshBasicMaterial({ map: tex, vertexColors: true, toneMapped: false });
  const m = new THREE.Mesh(geo, mat); m.userData.range = range;
  return m;
}

/* ================================================================
   場面をつくる。only=0 は全体、1〜8 はその階だけ(ロビーの絵を撮るとき)
   ================================================================ */
async function makeScene(only = 0) {
  await fontsReady();
  const r = rng(2026);
  const scene = new THREE.Scene();
  const world = new THREE.Group(); scene.add(world);
  const B = { shell: new Batch(), ground: new Batch(), glow: new Batch(), lamp: new Batch(), win: new Batch(), glass: new Batch(), sky: new Batch(), lv: [] };
  for (let lv = 1; lv <= 8; lv++) B.lv[lv] = new Batch();
  const P = [];
  const levels = only ? [only] : [1, 2, 3, 4, 5, 6, 7, 8];
  for (const lv of levels) { shellLevel(B, lv); INTERIOR[lv](B, P, r); }
  if (only && only < 8) capSlab(B, only);
  if (!only) { ground(B, P, r); shaft(B); }

  const mats = {
    shell: litMat({ r: .9, self: [.04, .04, .04] }), ground: litMat({ r: .95 }), car: litMat({ r: .6, self: [.25, .25, .25] }),
    glow: litMat({ r: .5, self: [.95, .95, .95] }), lamp: litMat({ r: .5, self: [0, 0, 0] }), win: litMat({ r: .25, m: .1 }),
    sky: litMat({ r: .3, self: [.9, .9, .9] }),
    glass: new THREE.MeshStandardMaterial({ color: '#BFDCEB', roughness: .06, metalness: .15, transparent: true, opacity: .34, depthWrite: false }),
    lv: [], people: litMat({ vc: false, r: .8, self: [.26, .26, .26] })
  };
  for (let lv = 1; lv <= 8; lv++) mats.lv[lv] = litMat({ r: .84, self: [.3, .3, .3] });
  const add = (m, cast, recv) => { if (m) world.add(m); return m; };
  add(B.shell.mesh(mats.shell));
  const levelMesh = [];
  for (const lv of levels) levelMesh[lv] = add(B.lv[lv].mesh(mats.lv[lv]));
  if (!only) add(B.ground.mesh(mats.ground));
  add(B.glow.mesh(mats.glow, false, true));
  add(B.lamp.mesh(mats.lamp, false, false));
  const winMesh = add(B.win.mesh(mats.win, false, true));
  add(B.sky.mesh(mats.sky, false, false));
  const glassMesh = B.glass.mesh(mats.glass, false, false); if (glassMesh) { glassMesh.renderOrder = 2; world.add(glassMesh); }
  void winMesh;

  // 札と看板
  const tiles = tileMesh(levels, tileTexture()); world.add(tiles);
  let sign = null;
  if (levels.includes(8)) {
    sign = new THREE.Mesh(new THREE.PlaneGeometry(4.0, .75), new THREE.MeshBasicMaterial({ map: signTexture(), toneMapped: false }));
    sign.position.set(1.65, yOf(8) + ST + .04 + 1.58, ZB + .392); world.add(sign);
  }

  // 人(インスタンス)
  const people = buildPeople(P, mats.people); world.add(people.group);

  // かご・綱・バス
  let car = null, cable = null, bus = null;
  if (!only) {
    car = makeCar(mats, r); car.position.set(CAR_X, floorY(CAR_START), 0); world.add(car);
    const cb = new Batch(); bx(cb, -.25, -1, 0, .025, 1, .025, C.steelD); bx(cb, .25, -1, 0, .025, 1, .025, C.steelD);
    cable = cb.mesh(mats.shell, false, false); cable.position.set(CAR_X, SHAFT_TOP, 0); world.add(cable);
    bus = makeBus(mats); world.add(bus.g);
  }

  // 触れる範囲(階ごと)
  const hits = [];
  for (const lv of levels) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(SX1 - X0 + .2, FH, ZF - ZB + .2), new THREE.MeshBasicMaterial({ visible: false }));
    h.position.set((X0 + SX1) / 2, yOf(lv) + FH / 2 + (lv === 8 ? .2 : 0), 0); h.userData.lv = lv; world.add(h); hits.push(h);
  }
  return { scene, world, mats, people, car, cable, bus, tiles, sign, hits, levelMesh, P };
}

function buildPeople(P, mat) {
  const stand = P.filter(p => !p.sit), sit = P.filter(p => p.sit);
  const group = new THREE.Group();
  const mk = (geo, n) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); m.castShadow = true; m.receiveShadow = true; m.count = n; group.add(m); return m; };
  const bodyS = mk(STAND_GEO, stand.length), bodyC = mk(SIT_GEO, sit.length), heads = mk(HEAD_GEO, P.length), hairs = mk(HAIR_GEO, P.length);
  P.forEach((p, i) => { p.hi = i; });
  stand.forEach((p, i) => { p.bi = i; p.body = bodyS; });
  sit.forEach((p, i) => { p.bi = i; p.body = bodyC; });
  const tc = new THREE.Color();
  const setCols = (k = null) => {
    for (const p of P) {
      const t = k ? k(p) : 1;
      p.body.setColorAt(p.bi, tc.set(p.cloth).multiplyScalar(t));
      heads.setColorAt(p.hi, tc.set(p.skin).multiplyScalar(t));
      hairs.setColorAt(p.hi, tc.set(p.hair).multiplyScalar(t));
    }
    for (const m of [bodyS, bodyC, heads, hairs]) if (m.instanceColor) m.instanceColor.needsUpdate = true;
  };
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), off = new THREE.Vector3();
  const place = (p, x, y, z, ry) => {
    q.setFromAxisAngle(UP, ry);
    p.body.setMatrixAt(p.bi, M.compose(v.set(x, y + (p.sit ? p.seat : 0), z), q, ONE));
    const hy = y + (p.sit ? p.seat + HEAD_SIT : HEAD_STAND);
    heads.setMatrixAt(p.hi, M.compose(v.set(x, hy, z), q, ONE));
    off.set(0, .014, -.012).applyQuaternion(q);
    hairs.setMatrixAt(p.hi, M.compose(v.set(x + off.x, hy + off.y, z + off.z), q, ONE));
  };
  const walkers = P.filter(p => p.walk);
  const update = (t, all = false) => {
    for (const p of all ? P : walkers) {
      if (!p.walk) { place(p, p.x, p.y, p.z, p.ry); continue; }
      const w = p.walk, mid = (w.x0 + w.x1) / 2, amp = (w.x1 - w.x0) / 2, om = w.v / Math.max(.5, amp);
      const s = Math.sin(t * om + w.ph), x = mid + amp * s, vel = Math.cos(t * om + w.ph);
      const want = vel >= 0 ? Math.PI / 2 : -Math.PI / 2;
      let d = want - p.cur; d = Math.atan2(Math.sin(d), Math.cos(d)); p.cur += d * .18;
      const bob = Math.abs(Math.sin(t * 7.5 + w.ph)) * .022 * Math.min(1, Math.abs(vel) * 3);
      place(p, x, p.y + bob, p.z, p.cur);
    }
    for (const m of [bodyS, bodyC, heads, hairs]) m.instanceMatrix.needsUpdate = true;
  };
  setCols(); update(0, true);
  return { group, update, setCols, P };
}

function makeBus(mats) {
  const g = new THREE.Group(), b = new Batch(), lit = new Batch();
  b.add(rbGeo(2.5, .82, .86, .14), mtx(0, .14, 0, 1, 1, 1), '#F4F1EA');
  b.add(rbGeo(2.52, .14, .88, .05), mtx(0, .26, 0, 1, 1, 1), '#3D7F86');
  b.add(rbGeo(2.36, .27, .88, .06), mtx(.02, .55, 0, 1, 1, 1), '#3A4753');
  b.add(rbGeo(.9, .06, .6, .03), mtx(.2, .96, 0, 1, 1, 1), '#DAD5CB');
  for (const [x, z] of [[-.78, .4], [.78, .4], [-.78, -.4], [.78, -.4]]) b.add(G.cyl, mtx(x, .16, z, .32, .12, .32, 0, Math.PI / 2), '#2E3238');
  for (const z of [-.28, .28]) bx(lit, -1.255, .3, z, .02, .07, .14, '#FFF2D0');
  bx(lit, -1.255, .7, 0, .02, .1, .5, '#FFD27A');
  g.add(b.mesh(mats.car), lit.mesh(mats.lamp, false, false));
  return { g, x: BUS_STOP + .2, state: 'stop', t: 0 };
}

/* ---------- 光(昼と夜) ---------- */
const LIGHT = {
  day: { hemiS: '#EEF1F8', hemiG: '#E0CFB6', hemi: 1.0, sun: '#FFE6C4', sunI: 2.7, fill: '#C9D8F5', fillI: .42, exp: 1.04, self: [.2, .185, .16], shell: .03, car: .25, glow: .9, lamp: 0, win: [0, 0, 0], winC: '#86A2B8', sky: '#93C4E2', skyI: .45 },
  night: { hemiS: '#5664A3', hemiG: '#1D2340', hemi: .5, sun: '#AFC1F4', sunI: .55, fill: '#6F80C2', fillI: .28, exp: 1.08, self: [.95, .78, .55], shell: .03, car: .7, glow: 1.25, lamp: 2.6, win: [1.15, 1.0, .85], winC: '#FFDFAA', sky: '#24325C', skyI: .5 }
};
function makeLights(scene, big) {
  const hemi = new THREE.HemisphereLight(LIGHT.day.hemiS, LIGHT.day.hemiG, LIGHT.day.hemi); scene.add(hemi);
  const sun = new THREE.DirectionalLight(LIGHT.day.sun, LIGHT.day.sunI);
  sun.position.set(13, 21, 21); sun.target.position.set(0, 7, 0); sun.castShadow = true;
  const S = 15; Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 80 });
  sun.shadow.mapSize.set(big ? 2048 : 1024, big ? 2048 : 1024); sun.shadow.bias = -.0004; sun.shadow.normalBias = .03;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(LIGHT.day.fill, LIGHT.day.fillI); fill.position.set(-14, 8, 10); scene.add(fill);
  return { hemi, sun, fill };
}
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function applyLight(L, S, renderer, t) {
  const d = LIGHT.day, n = LIGHT.night, mix = (a, b) => _c1.set(a).lerp(_c2.set(b), t);
  L.hemi.color.copy(mix(d.hemiS, n.hemiS)); L.hemi.groundColor.copy(mix(d.hemiG, n.hemiG)); L.hemi.intensity = lerp(d.hemi, n.hemi, t);
  L.sun.color.copy(mix(d.sun, n.sun)); L.sun.intensity = lerp(d.sunI, n.sunI, t);
  L.fill.color.copy(mix(d.fill, n.fill)); L.fill.intensity = lerp(d.fillI, n.fillI, t);
  renderer.toneMappingExposure = lerp(d.exp, n.exp, t);
  const self = d.self.map((v, i) => lerp(v, n.self[i], t));
  for (let lv = 1; lv <= 8; lv++) if (S.mats.lv[lv]) S.mats.lv[lv].userData.u.uSelf.value.set(...self).multiplyScalar(S.boost ? S.boost[lv] : 1);
  S.mats.people.userData.u.uSelf.value.set(...self).multiplyScalar(.85);
  S.mats.shell.userData.u.uSelf.value.setScalar(lerp(d.shell, n.shell, t));
  S.mats.car.userData.u.uSelf.value.setScalar(lerp(d.car, n.car, t));
  S.mats.glow.userData.u.uSelf.value.setScalar(lerp(d.glow, n.glow, t));
  S.mats.lamp.userData.u.uSelf.value.setScalar(lerp(d.lamp, n.lamp, t));
  S.mats.win.userData.u.uSelf.value.set(...d.win.map((v, i) => lerp(v, n.win[i], t)));
  S.mats.win.userData.u.uTint.value.set(...mix(d.winC, n.winC).toArray());
  S.mats.sky.userData.u.uTint.value.set(...mix(d.sky, n.sky).toArray());
  S.mats.sky.userData.u.uSelf.value.setScalar(lerp(d.skyI, n.skyI, t));
}

/* ---------- カメラ(正投影・少し右から、少し上から) ---------- */
const ELEV = deg(+(CAP && Q.get('elev')) || 11), AZ = deg(+(CAP && Q.get('az')) || 22), DIST = 90, AIM = new THREE.Vector3(0, 8, 0);
function aim(cam) {
  cam.position.set(AIM.x + DIST * Math.cos(ELEV) * Math.sin(AZ), AIM.y + DIST * Math.sin(ELEV), AIM.z + DIST * Math.cos(ELEV) * Math.cos(AZ));
  cam.up.set(0, 1, 0); cam.lookAt(AIM); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
}
/* 全体の収まり: 建物(塔屋・看板・ガラスの塔)と、台の手前の縁 */
function samplePoints() {
  const pts = [];
  for (const x of [X0, SX1 + .05]) for (const z of [ZB, ZF]) for (const y of [0, SHAFT_TOP + .62]) pts.push(new THREE.Vector3(x, y, z));
  for (const x of [PX0, PX1]) for (const z of [PZ0, PZ1]) for (const y of [0, -1.57]) pts.push(new THREE.Vector3(x, y, z));
  return pts;
}
/* 点の集まりを、画面の範囲 R(px)に収める正投影の枠 */
function fit(cam, pts, W, H, R, apply = true) {
  cam.updateMatrixWorld();
  const inv = cam.matrixWorldInverse; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const v = new THREE.Vector3();
  for (const p of pts) { v.copy(p).applyMatrix4(inv); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
  const s = Math.min((R.x1 - R.x0) / (x1 - x0), (R.y1 - R.y0) / (y1 - y0));
  const cx = (x0 + x1) / 2, cyv = (y0 + y1) / 2, rx = (R.x0 + R.x1) / 2, ry = (R.y0 + R.y1) / 2;
  const f = { left: cx - rx / s, top: cyv + ry / s, s, cx, cy: cyv, rx, ry };
  f.right = f.left + W / s; f.bottom = f.top - H / s;
  if (apply) { Object.assign(cam, { left: f.left, right: f.right, top: f.top, bottom: f.bottom }); cam.updateProjectionMatrix(); }
  return f;
}
/* 止めた画像と WebGL で、建物の位置をそろえる(画面の割合で決める) */
const REGION = { x0: .03, x1: .97, y0: .025, y1: .985 };
const regionOf = (W, H) => ({ x0: W * REGION.x0, x1: W * REGION.x1, y0: H * REGION.y0, y1: H * REGION.y1 });
/* その階の収まりの点(室内と札の柱。ガラスの塔の内側まで) */
function levelPoints(lv, withShaft = true) {
  const pts = [], y0 = yOf(lv), y1 = lv === 8 ? yOf(8) + ST + 2.2 : yOf(lv) + FH + ST * .5;
  for (const x of [X0 + .1, withShaft ? SX1 - .1 : X1]) for (const z of [ZB, ZF]) for (const y of [y0 + .02, y1]) pts.push(new THREE.Vector3(x, y, z));
  return pts;
}

/* ================================================================
   画像を作るとき(?capture=poster|floor&w=&h=&dpr=&time=night&lv=)
   ================================================================ */
async function capture() {
  document.documentElement.classList.add('capture');
  const W = +(Q.get('w') || 900), H = +(Q.get('h') || 1070), lv = LV[Q.get('lv') || ''] || 0;
  const canvas = document.getElementById('cut');
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(window.devicePixelRatio || 1); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const S = await makeScene(CAP === 'floor' ? lv : 0);
  const L = makeLights(S.scene, true);
  applyLight(L, S, renderer, Q.get('time') === 'night' ? 1 : 0);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 400); aim(cam);
  if (CAP === 'floor') {
    const bb3 = new THREE.Box3(), pts = [];
    S.world.traverse(o => { if (o.isMesh && o.visible && o.material.visible !== false && !o.isInstancedMesh) bb3.expandByObject(o); });
    for (const x of [bb3.min.x, bb3.max.x]) for (const y of [bb3.min.y, bb3.max.y]) for (const z of [bb3.min.z, bb3.max.z]) pts.push(new THREE.Vector3(x, y, z));
    fit(cam, pts, W, H, { x0: W * .01, x1: W * .99, y0: H * .02, y1: H * .98 });
  }
  else fit(cam, samplePoints(), W, H, regionOf(W, H));
  if (S.bus) placeBus(S.bus, 0);
  if (S.cable) S.cable.scale.y = SHAFT_TOP - (S.car.position.y + 2.12);
  renderer.render(S.scene, cam);
  await new Promise(r => requestAnimationFrame(r));
  renderer.render(S.scene, cam);
  window.__done = { w: W, h: H, info: { calls: renderer.info.render.calls, tris: renderer.info.render.triangles } };
}

function placeBus(bus, dt) {
  // 右から来て、バス停で止まり、左へ出ていく。台の外では見えない
  const SPEED = 1.5, STOP = BUS_STOP + .2;
  if (bus.state === 'in') { bus.x -= SPEED * dt * clamp01((bus.x - STOP) / 1.2 + .25); if (bus.x <= STOP + .01) { bus.x = STOP; bus.state = 'stop'; bus.t = 0; } }
  else if (bus.state === 'stop') { bus.t += dt; if (bus.t > 3.2) { bus.state = 'out'; bus.t = 0; } }
  else if (bus.state === 'out') { bus.t += dt; bus.x -= SPEED * dt * clamp01(bus.t * .8 + .1); if (bus.x < PX0 - 1.6) { bus.state = 'wait'; bus.t = 0; } }
  else if (bus.state === 'wait') { bus.t += dt; if (bus.t > 5) { bus.state = 'in'; bus.x = PX1 + 1.6; } }
  const g = bus.g; g.position.set(bus.x, .02, 4.68);
  const half = 1.25, out = Math.max(0, bus.x + half - PX1, PX0 - (bus.x - half));
  const k = clamp01(1 - out / 2.5);
  g.visible = bus.state !== 'wait' && k > .02; g.scale.set(1, 1, 1);
  g.position.x = bus.x;
  // 台の端で切れるように、端を越えた分は縮めて隠す
  if (k < 1) { const vis = 2 * half - out; g.scale.x = Math.max(.01, vis / (2 * half)); g.position.x = bus.x + (bus.x > 0 ? -out / 2 : out / 2); }
}

/* ================================================================
   live(index.html から呼ぶ)
   opt: { box, canvas, focusRegion(), onCar(key, dir), onArrive(key), onHover(key|null), onPick(key), reduced }
   ================================================================ */
export async function start(opt) {
  const { box, canvas } = opt;
  const stage = canvas.parentElement;
  const sp = innerWidth < 920;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, sp ? 1.5 : 2)); renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const S = await makeScene(0);
  S.boost = [1, 1, 1, 1, 1, 1, 1, 1, 1];
  const L = makeLights(S.scene, !sp);
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 400); aim(cam);
  const SAMPLE = samplePoints();
  let W = 1, H = 1, base = null, dirty = true, running = false, visible = true, paused = false;
  let t = 0, last = performance.now(), rot = 0, rotV = 0, idleAt = performance.now() + 4500;
  let night = 0, nightTo = 0, nightFrom = 0, nightT0 = 0;
  let view = null;           // カメラの移り: { k, t0, dur, from, to }
  let focusLv = 0;           // 寄っている階
  let hoverLv = 0;
  let ride = null;           // かごの移動: { from, to, t0, dur }
  let carLv = CAR_START, carDir = 0, lastLook = 0;

  function frame() { return { left: cam.left, right: cam.right, top: cam.top, bottom: cam.bottom }; }
  /* キャンバスは最初の画面いっぱい。全体の姿は、止めた画像の箱(box)の中にぴったり重ねる */
  function overviewRegion() {
    const c = canvas.getBoundingClientRect(), b = box.getBoundingClientRect();
    const x = b.left - c.left, y = b.top - c.top;
    return { x0: x + b.width * REGION.x0, x1: x + b.width * REGION.x1, y0: y + b.height * REGION.y0, y1: y + b.height * REGION.y1 };
  }
  function resize() {
    W = stage.clientWidth; H = stage.clientHeight; if (!W || !H) return;
    renderer.setSize(W, H, false);
    base = fit(cam, SAMPLE, W, H, overviewRegion(), !focusLv && !view);
    if (focusLv && !view) { Object.assign(cam, focusFrame(focusLv)); cam.updateProjectionMatrix(); }
    dirty = true; kick();
  }
  const ro = new ResizeObserver(resize); ro.observe(stage); ro.observe(box);

  /* 寄るときの枠: その階の室内が、画面の見えている範囲に大きく収まる */
  function focusFrame(lv) {
    const R = opt.focusRegion ? opt.focusRegion() : { x0: W * .05, x1: W * .95, y0: H * .2, y1: H * .8 };
    const f = fit(cam, levelPoints(lv), W, H, R, false);
    // 寄りすぎない(全体のおよそ 2.1 倍まで)。上下の階が少し見えるくらいがいちばん分かりやすい
    const s = Math.min(f.s, base ? base.s * (sp ? 2.0 : 2.15) : f.s);
    const left = f.cx - f.rx / s, top = f.cy + f.ry / s;
    return { left, right: left + W / s, top, bottom: top - H / s };
  }
  function moveView(to, dur) { view = { k: 0, t0: performance.now(), dur, from: frame(), to }; kick(); }

  /* かごをその階へ */
  function rideTo(lv, user) {
    const from = S.car.position.y, to = floorY(lv), n = Math.abs(LV_OF(from) - lv);
    if (Math.abs(from - to) < .001) { ride = null; if (user) arrive(lv); return 0; }
    const dur = opt.reduced ? 0 : Math.min(2300, 520 + n * 230);
    ride = { from, to, t0: performance.now(), dur, lv, user };
    carDir = to > from ? 1 : -1; opt.onCar && opt.onCar(KEY[LV_OF(from)], carDir);
    kick();
    return dur;
  }
  function LV_OF(y) { return clamp(Math.round((y - ST - .015) / FH) + 1, 1, 8); }
  function arrive(lv) {
    carLv = lv; carDir = 0; opt.onCar && opt.onCar(KEY[lv], 0);
    if (focusLv === lv) { flash = { lv, t0: performance.now() }; opt.onArrive && opt.onArrive(KEY[lv]); }
  }
  let flash = null, wake = 0;

  /* 階を選ぶ(行先階ボタン・建物を押す) */
  function go(key) {
    const lv = LV[key]; if (!lv) return;
    focusLv = lv; rotV = 0; spinBack = Math.abs(rot) > 1e-4 ? { from: rot, t0: performance.now(), to: 0 } : null;
    const dur = rideTo(lv, true);
    moveView(focusFrame(lv), Math.max(900, dur + 200));
    setLevelLook();
  }
  let spinBack = null;
  function overview() {
    if (!focusLv) return;
    focusLv = 0; moveView({ left: base.left, right: base.right, top: base.top, bottom: base.bottom }, 850); setLevelLook();
    idleAt = performance.now() + 6000;
  }
  /* 寄っている階を明るく、ほかを少し沈める */
  const look = { cur: [1, 1, 1, 1, 1, 1, 1, 1, 1], want: [1, 1, 1, 1, 1, 1, 1, 1, 1] };
  function setLevelLook() {
    for (let lv = 1; lv <= 8; lv++) look.want[lv] = focusLv ? (lv === focusLv ? 1.18 : .4) : (hoverLv ? (lv === hoverLv ? 1.12 : .86) : 1);
    kick();
  }
  function applyLook() {
    const tr = S.tiles.geometry.attributes.color, range = S.tiles.userData.range;
    for (let lv = 1; lv <= 8; lv++) {
      const k = look.cur[lv];
      const m = S.mats.lv[lv]; m.userData.u.uTint.value.setScalar(Math.min(1, k));
      S.boost[lv] = k > 1 ? 1 + (k - 1) * 3.2 : k < 1 ? .45 + .55 * k : 1;
      if (flash && flash.lv === lv) { const e = clamp01((performance.now() - flash.t0) / 900); S.boost[lv] *= 1 + Math.sin(e * Math.PI) * .9; }
      if (wake) { const e = clamp01((performance.now() - wake - (lv - 1) * 120) / 460); S.boost[lv] *= 1 + Math.sin(e * Math.PI) * 1.2; }
      const [o, n] = range[lv] || [0, 0]; const tk = clamp(.25 + .75 * Math.min(1, k), 0, 1);
      for (let i = 0; i < n; i++) tr.setXYZ(o + i, tk, tk, tk);
    }
    tr.needsUpdate = true;
    S.people.setCols(p => (p.lv ? Math.min(1, look.cur[p.lv]) : (focusLv ? .55 : 1)));
    applyLight(L, S, renderer, easeIO(night));
  }

  /* ドラッグで少し回す(横だけ。縦はページのスクロールへ) */
  const world = S.world;
  let down = null;
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function pick(e) {
    const rc = canvas.getBoundingClientRect();
    ndc.set((e.clientX - rc.left) / rc.width * 2 - 1, -(e.clientY - rc.top) / rc.height * 2 + 1);
    ray.setFromCamera(ndc, cam);
    const h = ray.intersectObjects(S.hits, false)[0];
    return h ? h.object.userData.lv : 0;
  }
  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, id: e.pointerId, lastX: e.clientX }; rotV = 0; spinBack = null; });
  canvas.addEventListener('pointermove', e => {
    if (down && e.pointerId === down.id) {
      const dx = e.clientX - down.lastX; down.lastX = e.clientX; down.moved += Math.abs(dx);
      if (down.moved > 5 && !focusLv) {
        if (!canvas.hasPointerCapture(e.pointerId)) canvas.setPointerCapture(e.pointerId);
        const lim = .3, over = Math.abs(rot) > lim ? .3 : 1;
        rot = clamp(rot + dx * .0036 * over, -.44, .44); rotV = dx * .0036 * 60; dirty = true; kick(); opt.onDrag && opt.onDrag();
      }
      return;
    }
    if (e.pointerType === 'mouse' && !focusLv) { const lv = pick(e); if (lv !== hoverLv) { hoverLv = lv; canvas.style.cursor = lv ? 'pointer' : ''; setLevelLook(); opt.onHover && opt.onHover(lv ? KEY[lv] : null); } }
  });
  const up = e => {
    if (!down || e.pointerId !== down.id) return;
    const tap = down.moved < 7 && performance.now() - down.t < 600;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    down = null;
    if (tap) { const lv = pick(e); if (lv && opt.onPick) opt.onPick(KEY[lv]); }
    if (Math.abs(rot) > .3) spinBack = { from: rot, t0: performance.now(), to: Math.sign(rot) * .3 };
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', () => { down = null; });
  canvas.addEventListener('pointerleave', () => { if (hoverLv && !focusLv) { hoverLv = 0; canvas.style.cursor = ''; setLevelLook(); opt.onHover && opt.onHover(null); } });

  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); }, { threshold: 0 }).observe(stage);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  function kick() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); } }
  let skipFrame = false;
  function loop(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    let active = false;
    if (!paused && !opt.reduced) { t += dt; active = true; }
    // ひとりでに動くかご(だれも操作していないとき)
    if (!paused && !opt.reduced && !focusLv && !hoverLv && !ride && now > idleAt) {
      const r2 = Math.random(), next = r2 < .3 ? 1 : 1 + Math.floor(Math.random() * 8);
      if (next !== carLv) rideTo(next, false);
      idleAt = now + 5200 + Math.random() * 3500;
    }
    if (ride) {
      const k = ride.dur ? clamp01((now - ride.t0) / ride.dur) : 1, e = easeIO(k);
      S.car.position.y = lerp(ride.from, ride.to, e);
      const lvNow = LV_OF(S.car.position.y);
      if (lvNow !== carLv && k < 1) { carLv = lvNow; opt.onCar && opt.onCar(KEY[lvNow], carDir); }
      if (k >= 1) { const r3 = ride; ride = null; arrive(r3.lv); }
      active = true;
    }
    S.cable.scale.y = SHAFT_TOP - (S.car.position.y + 2.12);
    if (view) {
      view.k = clamp01((now - view.t0) / view.dur); const e = easeIO(view.k), f = view.from, to = view.to;
      cam.left = lerp(f.left, to.left, e); cam.right = lerp(f.right, to.right, e); cam.top = lerp(f.top, to.top, e); cam.bottom = lerp(f.bottom, to.bottom, e);
      cam.updateProjectionMatrix(); active = true;
      if (view.k >= 1) view = null;
    }
    if (spinBack) {
      const k = clamp01((now - spinBack.t0) / 700), to = spinBack.to ?? 0;
      rot = lerp(spinBack.from, to, easeIO(k)); active = true; if (k >= 1) spinBack = null;
    }
    if (!down && Math.abs(rotV) > .0005 && !spinBack) { rot = clamp(rot + rotV * dt, -.44, .44); rotV *= Math.pow(.03, dt); active = true; if (Math.abs(rot) > .3 && Math.abs(rotV) < .05) { spinBack = { from: rot, t0: now, to: Math.sign(rot) * .3 }; rotV = 0; } }
    if (Math.abs(world.rotation.y - rot) > 1e-5) { world.rotation.y = rot; active = true; }
    // 明るさの移り
    let lookMoving = false; const lookT = lastLook; lastLook = now;
    for (let lv = 1; lv <= 8; lv++) { const d = look.want[lv] - look.cur[lv]; if (Math.abs(d) > .002) { look.cur[lv] += d * (1 - Math.pow(.0005, Math.max(dt, (now - (lookT || now)) / 1000))); lookMoving = true; } else look.cur[lv] = look.want[lv]; }
    if (flash) { if (now - flash.t0 > 900) flash = null; lookMoving = true; }
    if (wake && now > wake) { lookMoving = true; if (now - wake > 8 * 120 + 500) { wake = 0; applyLook(); } }
    if (Math.abs(night - nightTo) > .001) { const k = clamp01((now - nightT0) / 1200); night = lerp(nightFrom, nightTo, k); lookMoving = true; }
    if (lookMoving) { applyLook(); active = true; }
    if (!paused && !opt.reduced) { S.people.update(t); placeBus(S.bus, dt); }
    // 何も操作していないときは、30fps に落として電池を守る
    const calm = !view && !ride && !spinBack && !lookMoving && !down;
    skipFrame = calm ? !skipFrame : false;
    if ((active || dirty) && !skipFrame) { renderer.render(S.scene, cam); dirty = false; }
    if ((active || down) && visible && !document.hidden) requestAnimationFrame(loop); else running = false;
  }

  applyLight(L, S, renderer, 0);
  resize();
  renderer.render(S.scene, cam);
  running = false; kick();
  opt.onCar && opt.onCar(KEY[carLv], 0);
  // 差し替わったあと、1階から屋上へ順に灯りがともる(建物が生きていて、触れることの合図)
  if (!opt.reduced) { wake = performance.now() + 650; kick(); }
  idleAt = performance.now() + 4200;

  const api = {
    go, overview,
    hover(key) { if (focusLv) return; hoverLv = key ? LV[key] : 0; setLevelLook(); },
    setNight(on) { nightFrom = night; nightT0 = performance.now(); nightTo = on ? 1 : 0; if (opt.reduced) { night = nightTo; applyLook(); dirty = true; } kick(); },
    setPaused(p) { paused = !!p; kick(); },
    skip() { if (view) { view.t0 = -1e9; } if (ride) { ride.t0 = -1e9; } kick(); },
    info() { renderer.render(S.scene, cam); const i = renderer.info; return { calls: i.render.calls, triangles: i.render.triangles, geometries: i.memory.geometries, textures: i.memory.textures, programs: i.programs ? i.programs.length : null, dpr: renderer.getPixelRatio(), size: [W, H] }; },
    get focus() { return focusLv ? KEY[focusLv] : null; }
  };
  window.__cut = api;
  return api;
}

if (CAP) capture();
