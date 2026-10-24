/* ================================================================
   融合1「町の案内板」— 町の立体(B の町を、C の階色で建て直したもの)
   three.js 0.160(同梱)。townsign.js がページの読み込みのあとに import する(最初の画面は止めた画像)
   軽くするための約束:
     ・止まっている形は、素材の種類ごとに1つにまとめる(色は頂点の色に焼き込む)。窓の灯り・街灯・選んだ建物の光はシェーダーで足す
     ・人はインスタンス(体と頭の2回)。バス・方位磁針・浮かぶ小石はそれぞれ1つにまとめる
     ・画素比はスマホ 1.5・PC 2 まで。影は 1024。画面の外と非表示のタブでは止める
   モード:
     live    … ページの中で描く(townsign.js から)
     capture … 止めた画像と建物の肖像を作るときだけ(?capture=island|portrait)
   ================================================================ */
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../shared/vendor/three-0.160.0/RoundedBoxGeometry.js';

const TAU = Math.PI * 2;
const deg = d => d * Math.PI / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => Math.max(0, Math.min(1, v));
const easeIO = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- 行き先の色(C の階色を、立体の光の中で同じに見えるよう少しだけ明るくしたもの) ---------- */
export const ACC = { work: '#2F8F69', career: '#3E6FD0', learn: '#CF5F2E', manage: '#7D5CC0', study: '#1F8791', play: '#F0C434', info: '#2B3B5E' };

/* 町の並び。a は島の中心から見た角度(45°が手前・225°が奥)。病院(いまの職場)が真ん中、ほかは 60° おきの六角形
   pinY は目印の柱が立つ高さ(屋根の上・ドームの上)。目印のタイルは、そこから細い柱で上に立つ */
export const LOCS = [
  { id: 'hospital', bid: 1, a: 45, r: 0, pinY: 3.3, s: 1.0, acc: ACC.work },
  { id: 'observatory', bid: 2, a: 225, r: 5.0, pinY: 5.55, acc: ACC.career },
  { id: 'clinic', bid: 3, a: 345, r: 5.15, pinY: 1.25, acc: ACC.learn },
  { id: 'office', bid: 4, a: 285, r: 5.05, pinY: 3.1, acc: ACC.manage },
  { id: 'library', bid: 5, a: 165, r: 5.05, pinY: 2.35, acc: ACC.study },
  { id: 'park', bid: 6, a: 45, r: 5.4, pinY: .15, acc: ACC.play },
  { id: 'atelier', bid: 7, a: 105, r: 5.15, pinY: 1.72, acc: ACC.info }
];

/* ---------- 全体の色(B の温かさ: 生成りの壁、テラコッタ・セージ・砂。行き先の色は帯と目印だけ) ---------- */
const C = {
  grass: '#AEC78F', grassEdge: '#9CB77F', lawn: '#B9D09A',
  soil1: '#D8A985', soil2: '#C69474', rock: '#C6A895',
  plaza: '#EFE5D3', road: '#D3C9BA', walk: '#F5EDE0', line: '#FFFDF7',
  wall: '#F6F1E7', wall2: '#E8DCC8', trim: '#FBF7EE', slab: '#DCCFBC', machine: '#D9D0C2',
  terra: '#C47A5A', terraLight: '#D39470', sage: '#B9C9A6', sand: '#EAD7B5', peach: '#F0D3B5',
  glass: '#8EA8BB', glassDark: '#62768A', door: '#5C6B7C',
  trunk: '#8A7262', leaf: ['#8DB074', '#9BBD80', '#7FA66B', '#A6C78B'], conifer: ['#5F9068', '#6E9C72'], ochre: ['#D3A35C', '#C99459'],
  people: ['#4E9C96', '#2E3E5C', '#F3F2EE', '#9AA3AD', '#D8C7A8', '#7E9CC4', '#5D7F70', '#F3F2EE'], skin: ['#F0D2BC', '#E4BE9F', '#C99D7F'],
  bus: '#F7F6F2', busBand: '#56677B', tire: '#3A3F48', lampPole: '#727D8C', lampHead: '#FFF4DA',
  water: '#93C2D1', cloud: '#FFFFFF', bench: '#A98366', wood: '#A47A5C', navy: '#16233E', brand: '#A98F63', helipad: '#D3D7DA', helimark: '#E2C462'
};

/* ---------- 部品(焼き込む前の素材。色と粗さだけを持つ) ---------- */
const MATS = new Map();
function M(color, o = {}) {
  const k = color + '|' + (o.r ?? .9) + '|' + (o.flat ? 1 : 0) + '|' + (o.vc ? 1 : 0);
  if (!MATS.has(k)) MATS.set(k, new THREE.MeshStandardMaterial({ color, roughness: o.r ?? .9, metalness: 0, flatShading: !!o.flat, vertexColors: !!o.vc }));
  return MATS.get(k);
}
const sh = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; return m; };
const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
const fx = (m, glow, win) => { m.userData.fx = [glow, win]; return m; };
const RB = new Map();
function rbox(w, h, d, r, mat) { const k = [w, h, d, r].join(); if (!RB.has(k)) RB.set(k, new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) / 2 - .002))); return sh(new THREE.Mesh(RB.get(k), mat)); }
const BOXG = new THREE.BoxGeometry(1, 1, 1);
function box(w, h, d, mat) { const m = sh(new THREE.Mesh(BOXG, mat)); m.scale.set(w, h, d); return m; }
function cyl(rt, rb, h, mat, seg = 24) { return sh(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat)); }
function sph(r, mat, ws = 14, hs = 10) { return sh(new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat)); }
function gable(w, h, d, mat) {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: .03, bevelSize: .03, bevelSegments: 1, curveSegments: 1 });
  g.translate(0, 0, -d / 2); return sh(new THREE.Mesh(g, mat));
}
/* 窓: 灯る窓(glow 1)と灯らない窓。どちらも夜には暗くなり、灯る窓だけが光る */
const WIN = M(C.glass, { r: .3 });
function pane(g, rnd, x, y, z, sx, sy, sz, litChance = .55) { const m = new THREE.Mesh(BOXG, WIN); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = false; m.receiveShadow = true; fx(m, rnd() < litChance ? 1 : 0, 1); g.add(m); }
function grid(g, rnd, face, W, D, cy, cols, rows, dx, dy, ww, wh, lit, cx = 0) {
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const u = cx + (i - (cols - 1) / 2) * dx, y = cy + (j - (rows - 1) / 2) * dy;
    if (face === 'front') pane(g, rnd, u, y, D / 2 + .012, ww, wh, .04, lit);
    if (face === 'back') pane(g, rnd, u, y, -D / 2 - .012, ww, wh, .04, lit);
    if (face === 'left') pane(g, rnd, -W / 2 - .012, y, u, .04, wh, ww, lit);
    if (face === 'right') pane(g, rnd, W / 2 + .012, y, u, .04, wh, ww, lit);
  }
}
function tree(r, kind) {
  const g = new THREE.Group(), s = .8 + r() * .45;
  if (kind === 'cone') {
    g.add(at(cyl(.05, .07, .3, M(C.trunk), 6), 0, .15, 0));
    const col = M(C.conifer[Math.floor(r() * C.conifer.length)]);
    const c1 = sh(new THREE.Mesh(new THREE.ConeGeometry(.38, .7, 10), col)); c1.position.y = .55;
    const c2 = sh(new THREE.Mesh(new THREE.ConeGeometry(.28, .55, 10), col)); c2.position.y = .9;
    g.add(c1, c2);
  } else {
    g.add(at(cyl(.05, .075, .38, M(C.trunk), 6), 0, .19, 0));
    const pal = kind === 'ochre' ? C.ochre : C.leaf, col = M(pal[Math.floor(r() * pal.length)]);
    const a = sph(.4, col, 12, 9); a.position.y = .62; a.scale.set(1, .92, 1); g.add(a);
    if (r() > .5) { const b = sph(.26, col, 10, 8); b.position.set(.2, .82, -.08); g.add(b); }
  }
  g.scale.setScalar(s); return g;
}
function lamp() {
  const g = new THREE.Group();
  g.add(at(cyl(.025, .035, .82, M(C.lampPole), 6), 0, .41, 0));
  const h = fx(sph(.075, M(C.lampHead, { r: .6 }), 10, 8), 1, 0); h.position.y = .86; h.castShadow = false; g.add(h);
  return g;
}
function bench(len = .7) {
  const g = new THREE.Group();
  g.add(at(rbox(len, .06, .22, .025, M(C.bench)), 0, .2, 0), at(rbox(len, .2, .05, .02, M(C.bench)), 0, .32, -.09));
  g.add(at(box(.04, .2, .18, M(C.lampPole)), -len * .43, .1, 0), at(box(.04, .2, .18, M(C.lampPole)), len * .43, .1, 0));
  return g;
}

/* ================================================================
   建物(手前 = ローカルの +Z)。行き先の色は、帯・ひさし・屋根・扉などの「アクセント」にだけ使う
   ================================================================ */
const SEATS = []; // 建物のそばに座る人(world 座標はあとで求める): { group, x, y, z }
const B = {};

B.hospital = () => {
  const g = new THREE.Group(), r = rng(11), A = M(ACC.work, { r: .7 });
  const W = 3.7, H = 3.05, D = 2.5;
  g.add(at(rbox(W, H, D, .08, M(C.wall)), 0, H / 2 + .02, 0));
  g.add(at(rbox(W + .1, .22, D + .1, .05, A), 0, H - .03, 0));
  g.add(at(rbox(W - .3, .12, D - .3, .04, M(C.slab)), 0, H + .14, 0));
  g.add(at(cyl(.66, .66, .06, M(C.helipad), 32), .72, H + .22, .05));
  const ring = sh(new THREE.Mesh(new THREE.TorusGeometry(.52, .035, 6, 36), M(C.helimark, { r: .7 })), false); ring.rotation.x = -Math.PI / 2; g.add(at(ring, .72, H + .26, .05));
  const hm = M('#FFFFFF');
  g.add(at(box(.06, .02, .42, hm), .57, H + .26, .05), at(box(.06, .02, .42, hm), .87, H + .26, .05), at(box(.3, .02, .06, hm), .72, H + .26, .05));
  g.add(at(rbox(.62, .34, .5, .04, M(C.machine)), -1.05, H + .37, -.35), at(rbox(.36, .26, .36, .04, M(C.machine)), -.45, H + .33, -.6));
  // 横の低い棟(2階)
  g.add(at(rbox(1.7, 1.55, 1.9, .08, M(C.sand)), W / 2 + .7, .8, -.2));
  g.add(at(rbox(1.78, .1, 1.98, .04, M(C.terra, { r: .85 })), W / 2 + .7, 1.6, -.2));
  g.add(at(rbox(1.74, .08, 1.94, .03, A), W / 2 + .7, 1.46, -.2));
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) pane(g, r, W / 2 + .25 + i * .45, .55 + j * .55, .75 + .012, .3, .3, .04, .5);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) pane(g, r, W / 2 + 1.55 + .012, .55 + j * .55, -.85 + i * .55, .04, .3, .3, .5);
  // 玄関棟とひさし(行き先の色)
  g.add(at(rbox(1.7, .95, 1.0, .07, M(C.trim)), 0, .5, D / 2 + .35));
  g.add(at(rbox(2.15, .09, 1.3, .04, A), 0, 1.02, D / 2 + .55));
  g.add(at(rbox(1.25, .58, .04, .02, M(C.glassDark, { r: .3 })), 0, .38, D / 2 + .86));
  // 玄関の脇の縦のサイン(白地に、いつもの職場の色の帯)
  g.add(at(rbox(.34, 1.25, .1, .03, M(C.trim)), -W / 2 + .32, 2.2, D / 2 + .07));
  g.add(at(box(.24, .7, .02, A), -W / 2 + .32, 2.32, D / 2 + .13));
  grid(g, r, 'front', W, D, 1.95, 6, 3, .55, .58, .34, .34, .55);
  grid(g, r, 'back', W, D, 1.66, 6, 4, .55, .58, .34, .34, .5);
  grid(g, r, 'left', W, D, 1.66, 4, 4, .52, .58, .3, .34, .5);
  grid(g, r, 'right', W, D, 1.66, 4, 4, .52, .58, .3, .34, .5);
  return g;
};

B.observatory = () => {
  const g = new THREE.Group(), r = rng(23), A = M(ACC.career, { r: .6 });
  g.add(at(cyl(1.0, 1.1, .32, M(C.terra, { r: .85 }), 32), 0, .16, 0));
  g.add(at(cyl(.43, .56, 3.55, M(C.sand), 28), 0, .32 + 1.775, 0));
  for (const y of [1.25, 2.45]) g.add(at(cyl(.53 - (y - 1.25) * .04, .54 - (y - 1.25) * .04, .14, A, 28), 0, y, 0));
  g.add(at(rbox(.34, .56, .1, .04, A), 0, .62, .53));
  pane(g, r, 0, 1.85, .5, .16, .26, .04, .7); pane(g, r, 0, 3.05, .46, .14, .24, .04, .7);
  g.add(at(cyl(1.0, .85, .14, M(C.terra, { r: .85 }), 32), 0, 3.94, 0));
  const rail = sh(new THREE.Mesh(new THREE.TorusGeometry(.95, .028, 6, 40), M('#FFFFFF'))); rail.rotation.x = -Math.PI / 2; g.add(at(rail, 0, 4.24, 0));
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.add(at(cyl(.016, .016, .28, M('#FFFFFF'), 5), Math.cos(a) * .95, 4.1, Math.sin(a) * .95)); }
  g.add(at(cyl(.56, .56, .48, M(C.wall), 28), 0, 4.25, 0));
  const band = fx(cyl(.57, .57, .2, WIN, 28), 1, 1); band.position.y = 4.28; g.add(band);
  const dome = sh(new THREE.Mesh(new THREE.SphereGeometry(.6, 28, 14, 0, TAU, 0, Math.PI / 2), M(ACC.career, { r: .45 }))); dome.position.y = 4.49; g.add(dome);
  const tel = cyl(.055, .075, .55, M(C.navy, { r: .5 }), 10); tel.rotation.z = deg(55); tel.rotation.y = deg(30); g.add(at(tel, .55, 4.25, .5));
  g.add(at(cyl(.022, .022, .42, M('#FFFFFF'), 6), 0, 5.26, 0));
  return g;
};
/* 方位磁針(藍と砂。BRIDGE の二色)。回るので、別に1つにまとめる */
function needleGroup() {
  const n = new THREE.Group();
  const n1 = sh(new THREE.Mesh(new THREE.ConeGeometry(.075, .52, 10), M(C.navy, { r: .45 }))); n1.rotation.z = -Math.PI / 2; n1.position.x = .26;
  const n2 = sh(new THREE.Mesh(new THREE.ConeGeometry(.075, .52, 10), M(C.brand, { r: .45 }))); n2.rotation.z = Math.PI / 2; n2.position.x = -.26;
  n.add(n1, n2, sph(.06, M('#FFFFFF'), 8, 6));
  return n;
}

B.clinic = () => {
  const g = new THREE.Group(), r = rng(41), A = M(ACC.learn, { r: .7 });
  const W = 2.25, H = 1.08, D = 1.45;
  g.add(at(rbox(W, H, D, .08, M(C.sage)), 0, H / 2 + .02, 0));
  g.add(at(rbox(W + .2, .13, D + .2, .05, M(C.trim)), 0, H + .08, 0));
  g.add(at(rbox(W + .02, .1, D + .02, .03, A), 0, H - .06, 0));
  for (let i = 0; i < 7; i++) { const s = rbox(.26, .05, .5, .02, i % 2 ? M(C.trim) : A); s.position.set(-.78 + i * .26, .93, D / 2 + .22); s.rotation.x = deg(20); g.add(s); }
  pane(g, r, -.55, .55, D / 2 + .012, .62, .4, .04, .7); pane(g, r, .15, .55, D / 2 + .012, .42, .4, .04, .7);
  g.add(at(rbox(.42, .7, .06, .03, M(C.door, { r: .4 })), .78, .38, D / 2 + .02));
  grid(g, r, 'left', W, D, .58, 2, 1, .55, .5, .36, .36, .6);
  grid(g, r, 'right', W, D, .58, 2, 1, .55, .5, .36, .36, .6);
  // 屋上の看板(白地に、学ぶの色の丸)
  g.add(at(rbox(.74, .5, .1, .04, M('#FFFFFF')), -.35, H + .45, .25));
  const dot = cyl(.15, .15, .03, A, 20); dot.rotation.x = Math.PI / 2; g.add(at(dot, -.35, H + .45, .31));
  const b = bench(); b.position.set(-1.45, 0, D / 2 + .1); b.rotation.y = deg(35); g.add(b);
  SEATS.push({ group: b, x: -.15, z: .02 }, { group: b, x: .18, z: .02 });
  return g;
};

B.office = () => {
  const g = new THREE.Group(), r = rng(53), A = M(ACC.manage, { r: .6 });
  const W = 1.95, H = 2.95, D = 1.75;
  g.add(at(rbox(W, H, D, .07, M('#E5D6BF')), 0, H / 2 + .02, 0));
  [.6, 1.22, 1.84, 2.46].forEach((y, i) => { const m = fx(rbox(W + .04, .32, D + .04, .05, M(C.glassDark, { r: .3 })), i % 2 ? 1 : 0, 1); m.position.set(0, y, 0); g.add(m); });
  g.add(at(rbox(W + .08, .14, D + .08, .04, M(C.slab)), 0, H + .03, 0));
  g.add(at(rbox(W + .06, .08, D + .06, .03, A), 0, H - .1, 0));
  g.add(at(rbox(.14, H - .5, .14, .04, A), W / 2 - .05, (H - .5) / 2 + .25, D / 2 - .05));
  g.add(at(rbox(.9, .18, .7, .05, M(C.terraLight)), -.3, H + .19, .2));
  for (let i = 0; i < 3; i++) g.add(at(sph(.18 + r() * .08, M(C.leaf[i % 4]), 10, 8), -.55 + i * .25, H + .4, .2 + (i % 2) * .12));
  g.add(at(cyl(.015, .015, .6, M(C.lampPole), 5), .65, H + .37, -.5));
  g.add(at(rbox(1.0, .07, .5, .03, A), 0, .78, D / 2 + .25));
  g.add(at(rbox(.6, .6, .06, .03, M(C.glassDark, { r: .3 })), 0, .32, D / 2 + .03));
  return g;
};

B.library = () => {
  const g = new THREE.Group(), r = rng(61), A = M(ACC.study, { r: .6 });
  const W = 2.15, H = 1.3, D = 1.5;
  const body = rbox(W, H, D, .07, M(C.sand)); body.position.set(0, H / 2 + .16, -.12); g.add(body);
  g.add(at(rbox(W + .32, .16, D + .7, .04, M(C.trim)), 0, .08, .18));
  g.add(at(rbox(W + .1, .12, D + .55, .03, M(C.trim)), 0, .2, .2));
  g.add(at(rbox(W + .22, .16, D + .4, .05, M(C.terra, { r: .85 })), 0, H + .24, .06));
  g.add(at(rbox(W + .18, .07, D + .36, .03, A), 0, H + .13, .06));
  const ped = gable(W + .1, .5, .34, M(C.trim)); ped.position.set(0, H + .3, .62); g.add(ped);
  g.add(at(cyl(.5, .55, .22, M(C.trim), 24), 0, H + .4, -.25));
  const dome = sh(new THREE.Mesh(new THREE.SphereGeometry(.5, 24, 12, 0, TAU, 0, Math.PI / 2), M('#3E98A0', { r: .5 }))); dome.position.set(0, H + .5, -.25); g.add(dome);
  g.add(at(sph(.06, A, 8, 6), 0, H + 1.03, -.25));
  for (let i = 0; i < 4; i++) g.add(at(cyl(.085, .1, 1.05, M('#FFFFFF'), 14), -.72 + i * .48, .78, .78));
  g.add(at(rbox(.42, .62, .08, .03, M(C.wood)), 0, .5, D / 2 - .1));
  const wg = new THREE.Group(); wg.position.z = -.12;
  grid(wg, r, 'left', W, D, .9, 2, 1, .52, .5, .3, .42, .6); grid(wg, r, 'right', W, D, .9, 2, 1, .52, .5, .3, .42, .6); grid(wg, r, 'back', W, D, .9, 3, 1, .55, .5, .3, .42, .5);
  g.add(wg);
  return g;
};

const RIPPLE_SRC = [];
B.park = () => {
  const g = new THREE.Group(), r = rng(71), A = M(ACC.play, { r: .7 });
  g.add(at(sh(new THREE.Mesh(new THREE.CylinderGeometry(1.85, 1.9, .06, 36), M(C.lawn)), false), 0, .03, 0));
  const water = sh(new THREE.Mesh(new THREE.CylinderGeometry(.82, .82, .04, 36), M(C.water, { r: .3 })), false); water.position.set(-.38, .07, .28); g.add(water);
  const rim = sh(new THREE.Mesh(new THREE.TorusGeometry(.84, .05, 6, 36), M('#E9DDC8')), false); rim.rotation.x = -Math.PI / 2; g.add(at(rim, -.38, .08, .28));
  RIPPLE_SRC.push({ group: g, x: -.62, z: .12 }, { group: g, x: -.12, z: .48 });
  // 屋台(ごきげん回復ガチャ)。日よけとガチャは、試すの色
  const st = new THREE.Group();
  st.add(at(rbox(.9, .55, .55, .05, M(C.terraLight)), 0, .3, 0));
  for (let i = 0; i < 6; i++) { const s = rbox(.17, .05, .62, .02, i % 2 ? M(C.trim) : A); s.position.set(-.425 + i * .17, .78, .08); s.rotation.x = deg(14); st.add(s); }
  for (const x of [-.42, .42]) st.add(at(cyl(.022, .022, .5, M(C.wood), 5), x, .78, .32));
  const gm = new THREE.Group();
  gm.add(at(rbox(.22, .22, .2, .04, A), 0, .11, 0));
  gm.add(at(sph(.13, M('#F4F6F7', { r: .25 }), 12, 10), 0, .33, 0));
  for (let i = 0; i < 5; i++) gm.add(at(sph(.045, M(['#F0C434', '#5FA9A1', '#E8A4A0', '#7EA0D2', '#FFFFFF'][i]), 8, 6), (r() - .5) * .14, .28 + r() * .07, (r() - .5) * .14 + .1));
  gm.position.set(.28, .58, .1); st.add(gm);
  st.position.set(.85, 0, -.55); st.rotation.y = deg(-20); g.add(st);
  const b = bench(.62); b.position.set(.75, 0, .9); b.rotation.y = deg(-35); g.add(b);
  SEATS.push({ group: b, x: .08, z: 0 });
  for (const [x, z, k] of [[-1.25, -.75, 'round'], [-.2, -1.25, 'ochre'], [1.4, .25, 'round'], [-1.45, .95, 'cone']]) { const t = tree(r, k); t.position.set(x, .05, z); g.add(t); }
  return g;
};

B.atelier = () => {
  const g = new THREE.Group(), r = rng(91), A = M(ACC.info, { r: .65 });
  const W = 1.35, H = .95, D = 1.15;
  g.add(at(rbox(W, H, D, .07, M(C.peach)), 0, H / 2 + .02, 0));
  const roof = gable(W + .26, .72, D + .28, M(C.terra, { r: .85 })); roof.position.y = H + .02; g.add(roof);
  g.add(at(rbox(.2, .5, .2, .03, M('#A9705A')), .35, H + .55, -.2));
  g.add(at(rbox(.34, .6, .06, .03, A), -.3, .32, D / 2 + .01));
  g.add(at(rbox(.42, .12, .04, .02, A), -.3, .74, D / 2 + .02));
  pane(g, () => 0, .28, .55, D / 2 + .012, .36, .32, .04, 1);
  g.add(at(rbox(.44, .05, .1, .02, M('#FFFFFF')), .28, .37, D / 2 + .06));
  for (let i = 0; i < 3; i++) g.add(at(sph(.08, M(['#E8A4A0', '#F2C46B', '#FFFFFF'][i]), 8, 6), .14 + i * .13, .42, D / 2 + .1));
  // 外のイーゼルと画布(アトリエのしるし)
  const ez = new THREE.Group();
  for (const s of [-1, 1]) { const leg = cyl(.018, .018, .78, M(C.wood), 5); leg.rotation.z = s * deg(10); leg.position.set(s * .1, .38, 0); ez.add(leg); }
  const back = cyl(.018, .018, .72, M(C.wood), 5); back.rotation.x = deg(-18); back.position.set(0, .35, -.12); ez.add(back);
  ez.add(at(rbox(.36, .3, .03, .01, M('#FFFFFF')), 0, .55, .04));
  ez.add(at(box(.24, .06, .01, M(ACC.career)), -.02, .58, .06), at(box(.14, .05, .01, M(C.brand)), .05, .5, .06));
  ez.position.set(.72, 0, .75); ez.rotation.y = deg(-25); g.add(ez);
  const t = tree(r, 'round'); t.scale.setScalar(.75); t.position.set(-.9, 0, .2); g.add(t);
  return g;
};

/* ================================================================
   島
   ================================================================ */
export const ROAD_R = 7.3, ISLAND_R = 9.15, BS = 1.2;
function island(g) {
  const r = rng(101);
  const top = sh(new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R - .32, ISLAND_R - .32, .64, 96), M(C.grass)), false); top.position.y = -.32; g.add(top);
  const edge = sh(new THREE.Mesh(new THREE.TorusGeometry(ISLAND_R - .32, .32, 12, 96), M(C.grassEdge))); edge.rotation.x = -Math.PI / 2; edge.position.y = -.32; g.add(edge);
  const soil = sh(new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R - .3, ISLAND_R - .75, 1.15, 72, 1), M(C.soil1)), false); soil.position.y = -1.18; g.add(soil);
  const soil2 = sh(new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R - .75, ISLAND_R - 1.25, .55, 72), M(C.soil2)), false); soil2.position.y = -2.02; g.add(soil2);
  // 下に垂れる岩(面のある円錐を少しゆがめる)
  const cone = new THREE.ConeGeometry(ISLAND_R - 1.9, 7.6, 14, 7, true);
  cone.rotateX(Math.PI); cone.translate(0, -2.25 - 3.8, 0);
  const cp = cone.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i), rad = Math.hypot(x, z);
    if (y > -2.3) continue;
    const a = Math.atan2(z, x), depth = clamp01((-y - 2.3) / 7.6);
    const k = 1 + Math.sin(a * 3 + y * .8) * .13 * depth + Math.sin(a * 7 - y * 1.7) * .08 + (depth > .45 ? Math.sin(a * 2 + 1) * .18 * depth : 0);
    cp.setX(i, x * k + Math.sin(y * .6) * .5 * depth); cp.setZ(i, z * k + Math.cos(y * .5) * .35 * depth); cp.setY(i, y + (rad > .1 ? Math.sin(a * 5 + y) * .3 : 0));
  }
  const ng = cone.toNonIndexed(); ng.computeVertexNormals();
  const cols = new Float32Array(ng.attributes.position.count * 3), cr = new THREE.Color(C.rock), tmp = new THREE.Color();
  for (let f = 0; f < ng.attributes.position.count; f += 3) {
    const y = (ng.attributes.position.getY(f) + ng.attributes.position.getY(f + 1) + ng.attributes.position.getY(f + 2)) / 3;
    tmp.copy(cr).offsetHSL(0, (r() - .5) * .03, (r() - .5) * .07 + clamp01((-y - 2.4) / 7) * -.09);
    for (let k = 0; k < 3; k++) cols.set([tmp.r, tmp.g, tmp.b], (f + k) * 3);
  }
  ng.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.add(sh(new THREE.Mesh(ng, M('#FFFFFF', { flat: true, vc: true, r: .95 })), false));
  // 広場・環状の道・歩道・小道
  const plaza = sh(new THREE.Mesh(new THREE.CylinderGeometry(2.85, 2.85, .07, 64), M(C.plaza)), false); plaza.position.y = .035; g.add(plaza);
  const ring = (r0, r1, mat, y) => { const m = sh(new THREE.Mesh(new THREE.RingGeometry(r0, r1, 96), mat), false); m.rotation.x = -Math.PI / 2; m.position.y = y; g.add(m); };
  ring(ROAD_R - .5, ROAD_R + .5, M(C.road), .03);
  ring(ROAD_R - .74, ROAD_R - .5, M(C.walk), .045);
  ring(ROAD_R + .5, ROAD_R + .72, M(C.walk), .045);
  for (let i = 0; i < 36; i++) { const a = i / 36 * TAU; const d = box(.28, .012, .065, M(C.line)); d.castShadow = false; d.position.set(Math.cos(a) * ROAD_R, .045, Math.sin(a) * ROAD_R); d.rotation.y = -a + Math.PI / 2; g.add(d); }
  for (const a of [15, 75, 135, 195, 255, 315]) {
    const len = ROAD_R - .74 - 2.7, mid = 2.7 + len / 2, rad = deg(a);
    const path = rbox(.6, .05, len, .03, M(C.walk)); path.castShadow = false;
    path.position.set(Math.cos(rad) * mid, .03, Math.sin(rad) * mid); path.rotation.y = Math.atan2(Math.cos(rad), Math.sin(rad)); g.add(path);
  }
  for (const L of LOCS) if (L.r && L.id !== 'park') {
    const rad = deg(L.a), pad = rbox(1.0, .05, .9, .04, M(C.walk)); pad.castShadow = false;
    const off = 1.05 * (L.s || BS);
    pad.position.set(Math.cos(rad) * L.r + Math.cos(AZ) * off, .03, Math.sin(rad) * L.r + Math.sin(AZ) * off); pad.rotation.y = AZ; g.add(pad);
  }
  // 木は島の縁に寄せた群れで(建物のある角度はあける)
  const avoid = LOCS.filter(L => L.r).map(L => L.a);
  const near = (a, w) => avoid.some(b => Math.abs(((a - b + 540) % 360) - 180) < w);
  for (let i = 0; i < 30; i++) {
    const a = i / 30 * 360 + r() * 5, rr = ISLAND_R - .85 - r() * .5;
    if (i % 3 === 2) continue;
    const kind = r() < .22 ? 'cone' : r() < .14 ? 'ochre' : 'round';
    const t = tree(r, kind); t.position.set(Math.cos(deg(a)) * rr, 0, Math.sin(deg(a)) * rr); t.rotation.y = r() * TAU; t.scale.multiplyScalar(.9 + r() * .35); g.add(t);
  }
  for (let i = 0; i < 6; i++) {
    const a = 45 + i * 60; if (near(a, 12)) continue;
    const rr = 3.4 + r() * .6;
    const t = tree(r, 'round'); t.scale.multiplyScalar(.8); t.position.set(Math.cos(deg(a)) * rr, 0, Math.sin(deg(a)) * rr); g.add(t);
  }
  for (const a of [15, 135, 255]) {
    const rad = deg(a), cx = Math.cos(rad) * 3.1, cz = Math.sin(rad) * 3.1;
    const bed = rbox(.9, .14, .5, .05, M('#E6D6BD')); bed.position.set(cx, .07, cz); bed.rotation.y = -rad; g.add(bed);
    const fl = ['#F2B5A7', '#F4D27A', '#FFFFFF', '#C9B6E4'];
    for (let k = 0; k < 6; k++) { const u = -.3 + k * .12; g.add(at(sph(.07, M(fl[k % 4]), 6, 5), cx - Math.sin(rad) * u, .19, cz + Math.cos(rad) * u)); }
  }
  for (let i = 0; i < 8; i++) { const a = deg(i * 45 + 22.5); const l = lamp(); l.position.set(Math.cos(a) * (ROAD_R + .62), .03, Math.sin(a) * (ROAD_R + .62)); g.add(l); }
  for (let i = 0; i < 4; i++) { const a = deg(i * 90 + 15); const l = lamp(); l.position.set(Math.cos(a) * 2.95, .03, Math.sin(a) * 2.95); g.add(l); }
}
function pebbles() {
  const g = new THREE.Group(), r = rng(7);
  for (const [x, y, z, s] of [[-8.6, -4.2, 3.4, .55], [7.4, -5.6, -2.6, .42], [-3.4, -8.0, -6.2, .32], [5.6, -3.4, 7.4, .3]]) {
    const m = sh(new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), M(C.rock, { flat: true, r: .95 })), false); m.position.set(x, y, z); m.rotation.set(r() * 3, r() * 3, 0); g.add(m);
    const cap = sh(new THREE.Mesh(new THREE.CylinderGeometry(s * .78, s * .9, s * .32, 10), M(C.grass)), false); cap.position.set(x, y + s * .64, z); g.add(cap);
  }
  return g;
}

/* ================================================================
   焼き込み: 止まっている形を、素材の種類ごとに1つのメッシュにまとめる
   頂点に: 色(素材の色)・aFx(灯り, 窓)・aBid(建物の番号。選んだ建物を光らせる)
   ================================================================ */
export const SH = { uNight: { value: 0 }, uHi: { value: -1 }, uHiColor: { value: new THREE.Color() }, uHiAmt: { value: 0 } };
const TM = {};
function townMat(cls) {
  if (TM[cls]) return TM[cls];
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: { g: .3, s: .6, r: .92, f: .95 }[cls], metalness: 0, flatShading: cls === 'f' });
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, SH);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aFx;\nattribute float aBid;\nvarying vec2 vFx;\nvarying float vBid;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFx = aFx; vBid = aBid;');
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uNight; uniform float uHi; uniform vec3 uHiColor; uniform float uHiAmt;\nvarying vec2 vFx;\nvarying float vBid;')
      .replace('#include <color_fragment>', '#include <color_fragment>\nif (vFx.y > .5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.09,.11,.16), uNight * .82);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(1.0,.68,.34) * vFx.x * uNight * 2.6;\nfloat hiOn = 1.0 - step(.5, abs(vBid - uHi));\ntotalEmissiveRadiance += uHiColor * hiOn * uHiAmt;');
  };
  m.customProgramCacheKey = () => 'town-' + cls;
  return (TM[cls] = m);
}
const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _v = new THREE.Vector3();
function mergeItems(items, inv) {
  let nv = 0, ni = 0;
  for (const { o } of items) { const g = o.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), fxa = new Float32Array(nv * 2), bid = new Float32Array(nv), idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (const it of items) {
    const o = it.o, g = o.geometry, P = g.attributes.position, N = g.attributes.normal, Cc = g.attributes.color, c = o.material.color;
    _m.multiplyMatrices(inv, o.matrixWorld); _n.getNormalMatrix(_m);
    const f = o.userData.fx || [0, 0], vc = o.material.vertexColors && Cc;
    for (let i = 0; i < P.count; i++) {
      const k = vo + i;
      _v.fromBufferAttribute(P, i).applyMatrix4(_m); pos[k * 3] = _v.x; pos[k * 3 + 1] = _v.y; pos[k * 3 + 2] = _v.z;
      if (N) { _v.fromBufferAttribute(N, i).applyMatrix3(_n).normalize(); nor[k * 3] = _v.x; nor[k * 3 + 1] = _v.y; nor[k * 3 + 2] = _v.z; }
      col[k * 3] = c.r * (vc ? Cc.getX(i) : 1); col[k * 3 + 1] = c.g * (vc ? Cc.getY(i) : 1); col[k * 3 + 2] = c.b * (vc ? Cc.getZ(i) : 1);
      fxa[k * 2] = f[0]; fxa[k * 2 + 1] = f[1]; bid[k] = it.bid;
    }
    if (g.index) { const I = g.index.array; for (let j = 0; j < I.length; j++) idx[io + j] = I[j] + vo; io += I.length; }
    else { for (let j = 0; j < P.count; j++) idx[io + j] = vo + j; io += P.count; }
    vo += P.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); geo.setAttribute('aFx', new THREE.BufferAttribute(fxa, 2)); geo.setAttribute('aBid', new THREE.BufferAttribute(bid, 1));
  geo.setIndex(new THREE.BufferAttribute(idx, 1)); geo.computeBoundingSphere();
  return geo;
}
function collect(root) {
  const items = [];
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep || o.material.visible === false) return;
    let bid = 0; for (let p = o; p && p !== root; p = p.parent) if (p.userData.bid) { bid = p.userData.bid; break; }
    items.push({ o, bid });
  });
  return items;
}
/* 静かな形をまとめる(素材の粗さ × 影を落とすか で分ける) */
function bakeStatic(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), buckets = new Map();
  for (const it of collect(root)) {
    const m = it.o.material, rough = m.roughness ?? .9;
    const cls = m.flatShading ? 'f' : rough < .45 ? 'g' : rough < .75 ? 's' : 'r';
    const key = cls + (it.o.castShadow ? 'c' : '-');
    if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(it);
  }
  for (const its of buckets.values()) for (const { o } of its) o.parent.remove(o);
  const out = [];
  for (const [key, its] of buckets) {
    const mesh = new THREE.Mesh(mergeItems(its, inv), townMat(key[0])); mesh.castShadow = key[1] === 'c'; mesh.receiveShadow = true; mesh.userData.keep = true;
    root.add(mesh); out.push(mesh);
  }
  return out;
}
/* 動く小さなまとまりを1つにする(バス・磁針・小石) */
function bakeGroup(group, cls = 'r', cast = true) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), items = collect(group);
  for (const { o } of items) o.parent.remove(o);
  const mesh = new THREE.Mesh(mergeItems(items, inv), townMat(cls)); mesh.castShadow = cast; mesh.receiveShadow = true; mesh.userData.keep = true;
  return mesh;
}

/* ---------- カメラ(正投影・斜め上から) ---------- */
export const ELEV = deg(31), AZ = deg(45), DIST = 70;
export function aimCamera(cam, target) {
  cam.position.set(target.x + DIST * Math.cos(ELEV) * Math.cos(AZ), target.y + DIST * Math.sin(ELEV), target.z + DIST * Math.cos(ELEV) * Math.sin(AZ));
  cam.up.set(0, 1, 0); cam.lookAt(target); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
}
export function samplePoints() {
  const pts = [];
  for (let i = 0; i < 48; i++) { const a = i / 48 * TAU; pts.push(new THREE.Vector3(Math.cos(a) * (ISLAND_R + .1), .6, Math.sin(a) * (ISLAND_R + .1)), new THREE.Vector3(Math.cos(a) * (ISLAND_R + .1), -1.2, Math.sin(a) * (ISLAND_R + .1)), new THREE.Vector3(Math.cos(a) * 5.6, 7.1, Math.sin(a) * 5.6)); }
  pts.push(new THREE.Vector3(.3, -9.9, .2), new THREE.Vector3(0, 5.2, 0));
  return pts;
}
export function fit(cam, pts, W, H, R) {
  cam.left = -1; cam.right = 1; cam.top = 1; cam.bottom = -1; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  const inv = cam.matrixWorldInverse; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { const v = p.clone().applyMatrix4(inv); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
  const s = Math.min((R.x1 - R.x0) / (x1 - x0), (R.y1 - R.y0) / (y1 - y0));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (R.x0 + R.x1) / 2, ry = (R.y0 + R.y1) / 2;
  const f = { left: cx - rx / s, top: cy + ry / s, s }; f.right = f.left + W / s; f.bottom = f.top - H / s;
  Object.assign(cam, { left: f.left, right: f.right, top: f.top, bottom: f.bottom }); cam.updateProjectionMatrix();
  return f;
}
/* 止めた画像の枠(1600×1440・余白 3%)。ページの中の立体は、この枠が画面の画像の位置にぴったり重なるように撮る */
export const CAP_W = 1600, CAP_H = 1440;
function capFrame(cam) { aimCamera(cam, new THREE.Vector3()); return fit(cam, samplePoints(), CAP_W, CAP_H, { x0: CAP_W * .03, x1: CAP_W * .97, y0: CAP_H * .03, y1: CAP_H * .97 }); }

/* ================================================================
   シーン
   ================================================================ */
function makeScene(onlyId) {
  const scene = new THREE.Scene(), world = new THREE.Group(); scene.add(world);
  SEATS.length = 0; RIPPLE_SRC.length = 0;
  const spots = {}, dyn = { walkers: [], seats: [], bus: null, clouds: [], ripples: [], needle: null, pebbles: null, people: null };
  if (onlyId) {
    const L = LOCS.find(l => l.id === onlyId), g = B[onlyId](); g.userData.bid = L.bid; world.add(g);
    const big = onlyId === 'hospital' ? 1.35 : onlyId === 'park' ? 1.15 : 1;
    const plot = sh(new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, .3, 48), M(C.grass)), false); plot.position.y = -.15; plot.scale.set(big, 1, big); world.add(plot);
    const soil = sh(new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.45, .55, 48), M(C.soil1)), false); soil.position.y = -.57; soil.scale.set(big, 1, big); world.add(soil);
    if (onlyId === 'observatory') { const n = needleGroup(); n.position.y = 5.46; world.add(n); }
    addPeople(world, dyn, rng(5), true);
    bakeStatic(world);
    return { scene, world, spots, dyn };
  }
  island(world);
  for (const L of LOCS) {
    const g = B[L.id](), rad = deg(L.a);
    g.position.set(Math.cos(rad) * L.r, 0, Math.sin(rad) * L.r); g.rotation.y = AZ; g.scale.setScalar(L.s || BS); g.userData.bid = L.bid;
    world.add(g); g.updateMatrixWorld(true);
    const bb = new THREE.Box3().setFromObject(g), size = bb.getSize(new THREE.Vector3()), ctr = bb.getCenter(new THREE.Vector3());
    const hit = new THREE.Mesh(new THREE.BoxGeometry(size.x + .3, size.y + .3, size.z + .3), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(ctr); hit.userData = { id: L.id, keep: true }; world.add(hit);
    spots[L.id] = { L, hit, anchor: new THREE.Vector3(Math.cos(rad) * L.r, L.pinY * (L.s || BS), Math.sin(rad) * L.r), ground: new THREE.Vector3(Math.cos(rad) * L.r, .06, Math.sin(rad) * L.r), radius: Math.max(size.x, size.z) * .62 };
  }
  // 方位磁針(展望台のてっぺん)
  const obs = LOCS.find(l => l.id === 'observatory'), needle = bakeGroup(needleGroup(), 's');
  needle.position.set(Math.cos(deg(obs.a)) * obs.r, 5.46 * BS, Math.sin(deg(obs.a)) * obs.r); needle.scale.setScalar(BS); world.add(needle); dyn.needle = needle;
  // 浮かぶ小石(ひとまとまりで、ゆっくり上下)
  const pb = bakeGroup(pebbles(), 'f', false); world.add(pb); dyn.pebbles = pb;
  addPeople(world, dyn, rng(202), false);
  // バス(白に灰の帯。夜は窓と前照灯が灯る)
  const bus = new THREE.Group();
  bus.add(at(rbox(1.2, .5, .52, .12, M(C.bus, { r: .7 })), 0, .38, 0));
  bus.add(at(rbox(1.22, .11, .54, .05, M(C.busBand, { r: .7 })), 0, .2, 0));
  bus.add(fx(at(rbox(1.22, .17, .54, .07, WIN), .03, .48, 0), 1, 1));
  bus.add(at(rbox(.5, .07, .36, .03, M('#E3DFD6')), -.15, .66, 0));
  for (const [x, z] of [[-.33, .24], [.33, .24], [-.33, -.24], [.33, -.24]]) { const w = cyl(.1, .1, .08, M(C.tire), 12); w.rotation.x = Math.PI / 2; w.position.set(x, .13, z); bus.add(w); }
  for (const z of [-.15, .15]) bus.add(fx(at(sph(.045, M('#FFF6DE', { r: .5 }), 8, 6), .58, .3, z), 1, 0));
  const busMesh = bakeGroup(bus, 'r', true); world.add(busMesh); dyn.bus = { mesh: busMesh, a: deg(70), v: .085 };
  // 池の波紋(ふたつめの波)
  const park = world.children.find(c => c.userData.bid === 6);
  for (const s of RIPPLE_SRC) for (let k = 0; k < 2; k++) {
    const m = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, depthWrite: false });
    const t = new THREE.Mesh(new THREE.TorusGeometry(1, .03, 4, 32), m); t.rotation.x = -Math.PI / 2; t.position.set(s.x, .1, s.z); t.userData.keep = true;
    park.add(t); dyn.ripples.push({ mesh: t, mat: m, phase: k / 2 + (s.x > -.4 ? .25 : 0) });
  }
  bakeStatic(world);
  // 選んだ建物の足もとの光の輪
  const haloMat = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: 0, depthWrite: false });
  const halo = new THREE.Mesh(new THREE.RingGeometry(.86, 1, 48), haloMat); halo.rotation.x = -Math.PI / 2; halo.userData.keep = true; halo.visible = false; world.add(halo);
  dyn.halo = { mesh: halo, mat: haloMat };
  // 雲(町の奥の空の弧だけを流れる)
  const ARCS = [[172, 216], [252, 300]], r = rng(303);
  for (let i = 0; i < 4; i++) {
    const cm = new THREE.MeshStandardMaterial({ color: C.cloud, roughness: 1, emissive: new THREE.Color('#FFFFFF'), emissiveIntensity: .42, transparent: true, opacity: 1 });
    const parts = [];
    for (const [x, y, z, s] of [[0, 0, 0, .78], [.72, .08, .12, .6], [-.7, .02, -.08, .56], [.22, .38, .02, .55], [-.25, .3, .2, .45]]) { const g = new THREE.SphereGeometry(s, 14, 10); g.translate(x, y, z); parts.push(g); }
    const cg = mergeGeos(parts), c = new THREE.Mesh(cg, cm); c.scale.set(1, .72, .9).multiplyScalar(.85 + r() * .45);
    scene.add(c);
    const arc = ARCS[i % 2];
    dyn.clouds.push({ g: c, mat: cm, a0: deg(arc[0]), a1: deg(arc[1]), r: 10.8 + r() * 1.6, y: 3.0 + r() * 2.0, v: .012 + r() * .006, ph: (i >> 1) / 2 + r() * .15 });
  }
  return { scene, world, spots, dyn };
}
function mergeGeos(geos) {
  let nv = 0, ni = 0; for (const g of geos) { nv += g.attributes.position.count; ni += g.index.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni); let vo = 0, io = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, vo * 3); nor.set(g.attributes.normal.array, vo * 3); const I = g.index.array; for (let j = 0; j < I.length; j++) idx[io + j] = I[j] + vo; io += I.length; vo += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setIndex(new THREE.BufferAttribute(idx, 1)); out.computeBoundingSphere();
  return out;
}

/* ---------- 人(インスタンス: 体と頭) ---------- */
const CAPSULE = new THREE.CapsuleGeometry(.075, .15, 3, 8), HEAD = new THREE.SphereGeometry(.068, 10, 8);
function addPeople(world, dyn, r, portrait) {
  const list = [];
  if (!portrait) {
    for (let i = 0; i < 22; i++) list.push({ kind: 'ring', r: i % 3 === 0 ? ROAD_R + .61 : ROAD_R - .62, a: r() * TAU, v: (.035 + r() * .04) * (r() < .5 ? 1 : -1), ph: r() * TAU });
    for (let i = 0; i < 8; i++) list.push({ kind: 'plaza', r: 2.35 + r() * .35, a: r() * TAU, v: (.06 + r() * .06) * (r() < .5 ? 1 : -1), ph: r() * TAU });
    for (const [a, rr] of [[118, 3.5], [70, 6.4], [205, 3.6], [291, 3.7], [335, 6.45]]) list.push({ kind: 'stand', x: Math.cos(deg(a)) * rr, z: Math.sin(deg(a)) * rr, rot: r() * TAU });
  }
  world.updateMatrixWorld(true);
  const winv = new THREE.Matrix4().copy(world.matrixWorld).invert();
  for (const s of SEATS) { s.group.updateMatrixWorld(true); const p = new THREE.Vector3(s.x, .06, s.z).applyMatrix4(s.group.matrixWorld).applyMatrix4(winv); list.push({ kind: 'sit', x: p.x, y: p.y, z: p.z, rot: 0 }); }
  if (!list.length) return;
  const bodyMat = new THREE.MeshStandardMaterial({ roughness: .9 }), headMat = new THREE.MeshStandardMaterial({ roughness: .9 });
  const body = new THREE.InstancedMesh(CAPSULE, bodyMat, list.length), head = new THREE.InstancedMesh(HEAD, headMat, list.length);
  body.castShadow = head.castShadow = true; body.receiveShadow = head.receiveShadow = true; body.userData.keep = head.userData.keep = true;
  const col = new THREE.Color();
  list.forEach((p, i) => { body.setColorAt(i, col.set(C.people[Math.floor(r() * C.people.length)])); head.setColorAt(i, col.set(C.skin[Math.floor(r() * C.skin.length)])); });
  world.add(body, head);
  dyn.people = { body, head, list };
  placePeople(dyn, 0);
}
const _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler(), _M = new THREE.Matrix4();
function placePeople(dyn, t) {
  const P = dyn.people; if (!P) return;
  P.list.forEach((w, i) => {
    let x, y = .03, z, rot = 0, sit = false;
    if (w.kind === 'ring' || w.kind === 'plaza') { const a = w.a + w.v * t; x = Math.cos(a) * w.r; z = Math.sin(a) * w.r; y = .03 + Math.abs(Math.sin(t * 7 + w.ph)) * .025; rot = -a + (w.v > 0 ? 0 : Math.PI); }
    else if (w.kind === 'stand') { x = w.x; z = w.z; rot = w.rot; }
    else { x = w.x; y = w.y; z = w.z; sit = true; }
    _q.setFromEuler(_e.set(0, rot, 0));
    _s.set(1, sit ? .75 : 1, 1); _p.set(x, y + (sit ? .17 : .16), z); P.body.setMatrixAt(i, _M.compose(_p, _q, _s));
    _s.set(1, 1, 1); _p.set(x, y + (sit ? .34 : .37), z); P.head.setMatrixAt(i, _M.compose(_p, _q, _s));
  });
  P.body.instanceMatrix.needsUpdate = true; P.head.instanceMatrix.needsUpdate = true;
}
function placeBus(b, t) { const a = b.a + b.v * t; b.mesh.position.set(Math.cos(a) * (ROAD_R + .24), .03, Math.sin(a) * (ROAD_R + .24)); b.mesh.rotation.y = -a - Math.PI / 2; }
let CLOUD_DAY = 1;
function placeCloud(c, t) {
  const u = (c.ph + t * c.v) % 1, a = lerp(c.a0, c.a1, u), fade = Math.min(1, u / .16, (1 - u) / .16) * CLOUD_DAY;
  c.g.position.set(Math.cos(a) * c.r, c.y + Math.sin(t * .3 + c.ph * 6) * .15, Math.sin(a) * c.r);
  c.mat.opacity = fade; c.mat.depthWrite = fade > .6; c.g.visible = fade > .02;
}

/* ---------- 光(昼と夜) ---------- */
const LIGHT = {
  day: { hemiS: '#E8EEFA', hemiG: '#C8CDB4', hemi: 1.3, sun: '#FFEAD0', sunI: 2.9, fill: '#D4E2FA', fillI: .45, exp: 1.02, pt: 0 },
  night: { hemiS: '#6573B4', hemiG: '#232A44', hemi: .58, sun: '#B3C4F7', sunI: .75, fill: '#7484C8', fillI: .3, exp: 1.18, pt: 5.2 }
};
function makeLights(scene, size) {
  const hemi = new THREE.HemisphereLight(LIGHT.day.hemiS, LIGHT.day.hemiG, LIGHT.day.hemi); scene.add(hemi);
  const sun = new THREE.DirectionalLight(LIGHT.day.sun, LIGHT.day.sunI); sun.position.set(-3, 15, 13); sun.castShadow = true;
  const S = 13.2; Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 60 });
  sun.shadow.mapSize.set(size, size); sun.shadow.bias = -.0005; sun.shadow.normalBias = .03; scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(LIGHT.day.fill, LIGHT.day.fillI); fill.position.set(12, 6, -10); scene.add(fill);
  const pts = [];
  for (let i = 0; i < 3; i++) { const p = new THREE.PointLight('#FFC77A', 0, 4.6, 2); const a = deg(i * 120 + 22.5); p.position.set(Math.cos(a) * (ROAD_R + .62), 1.0, Math.sin(a) * (ROAD_R + .62)); scene.add(p); pts.push(p); }
  return { hemi, sun, fill, pts };
}
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function applyLight(L, renderer, t, clouds) {
  const d = LIGHT.day, n = LIGHT.night;
  L.hemi.color.copy(_c1.set(d.hemiS)).lerp(_c2.set(n.hemiS), t); L.hemi.groundColor.copy(_c1.set(d.hemiG)).lerp(_c2.set(n.hemiG), t); L.hemi.intensity = lerp(d.hemi, n.hemi, t);
  L.sun.color.copy(_c1.set(d.sun)).lerp(_c2.set(n.sun), t); L.sun.intensity = lerp(d.sunI, n.sunI, t); L.sun.position.set(lerp(-3, 9, t), 15, lerp(13, -7, t));
  L.fill.color.copy(_c1.set(d.fill)).lerp(_c2.set(n.fill), t); L.fill.intensity = lerp(d.fillI, n.fillI, t);
  renderer.toneMappingExposure = lerp(d.exp, n.exp, t);
  for (const p of L.pts) p.intensity = lerp(d.pt, n.pt, t);
  SH.uNight.value = t; CLOUD_DAY = 1 - t;
  for (const c of clouds || []) { c.mat.color.set('#FFFFFF').lerp(_c2.set('#7F89BE'), t); c.mat.emissiveIntensity = lerp(.42, .06, t); }
}
function makeRenderer(canvas, dpr, W, H, preserve) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!preserve });
  r.setPixelRatio(dpr); r.setSize(W, H, false); r.setClearColor(0x000000, 0);
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  return r;
}

/* ================================================================
   画像を作るとき(?capture=island|portrait&id=...&time=night)
   ================================================================ */
export async function capture(Q) {
  const mode = Q.get('capture'), night = Q.get('time') === 'night', W = +(Q.get('w') || CAP_W), H = +(Q.get('h') || CAP_H);
  document.documentElement.classList.add('capture');
  let canvas = document.getElementById('cap'); if (!canvas) { canvas = document.createElement('canvas'); canvas.id = 'cap'; document.body.appendChild(canvas); }
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const renderer = makeRenderer(canvas, +(Q.get('dpr') || 1), W, H, true);
  const S = makeScene(mode === 'portrait' ? Q.get('id') : null), L = makeLights(S.scene, 2048);
  applyLight(L, renderer, night ? 1 : 0, S.dyn.clouds);
  for (const c of S.dyn.clouds) c.g.visible = false;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 200);
  if (mode === 'portrait') {
    aimCamera(camera, new THREE.Vector3());
    const bb = new THREE.Box3().setFromObject(S.world), pts = [];
    for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) pts.push(new THREE.Vector3(x, y, z));
    fit(camera, pts, W, H, { x0: W * .04, x1: W * .96, y0: H * .04, y1: H * .96 });
  } else capFrame(camera);
  if (S.dyn.bus) placeBus(S.dyn.bus, 0);
  renderer.render(S.scene, camera);
  await new Promise(r => requestAnimationFrame(r));
  renderer.render(S.scene, camera);
  const pins = {};
  for (const id in S.spots) { const v = S.spots[id].anchor.clone().project(camera); pins[id] = [+((v.x + 1) / 2 * 100).toFixed(2), +((1 - v.y) / 2 * 100).toFixed(2)]; }
  window.__done = { pins, calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
}

/* ================================================================
   ページの中で描く
   o = { canvas, box, onPins(items, focused), onHover(id|null), onPick(id), onFrame(info) }。立体の座標は canvas の左上から
   ================================================================ */
export function live(o) {
  const small = innerWidth < 900;
  let W = o.canvas.clientWidth, H = o.canvas.clientHeight;
  const renderer = makeRenderer(o.canvas, Math.min(devicePixelRatio || 1, small ? 1.5 : 2), W, H, false);
  const S = makeScene(null), L = makeLights(S.scene, 1024);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 200);
  const CAPF = capFrame(camera);
  aimCamera(camera, new THREE.Vector3());

  let base = null, night = 0, nightTo = 0, nightFrom = 0, nightT0 = 0, paused = false, running = false, visible = true;
  let rot = 0, rotV = 0, t = 0, last = performance.now(), spin = null, focus = null, hover = null, hiId = null, hiAmt = 0, dirty = true;

  /* 止めた画像の枠に、立体の島がぴったり重なる正投影の枠 */
  function baseFrame() {
    const sr = o.canvas.getBoundingClientRect(), br = o.box.getBoundingClientRect();
    const k = (CAPF.right - CAPF.left) / br.width, left = CAPF.left - (br.left - sr.left) * k, top = CAPF.top + (br.top - sr.top) * k;
    return { left, right: left + W * k, top, bottom: top - H * k, ppu: 1 / k, bx: br.left - sr.left, by: br.top - sr.top, bw: br.width, bh: br.height };
  }
  function setFrame(f) { camera.left = f.left; camera.right = f.right; camera.top = f.top; camera.bottom = f.bottom; camera.updateProjectionMatrix(); }
  function resize() {
    W = o.canvas.clientWidth; H = o.canvas.clientHeight; renderer.setSize(W, H, false);
    base = baseFrame(); if (!focus) setFrame(base); dirty = true; kick();
  }
  new ResizeObserver(resize).observe(o.canvas); resize();

  function nearestRot(cur, target) { let d = ((target - cur) % TAU + TAU) % TAU; if (d > Math.PI) d -= TAU; return cur + d; }
  function focusFrame(id) {
    const sp = S.spots[id], sm = W < 900, L0 = sp.L;
    const p = new THREE.Vector3(Math.cos(deg(45)) * L0.r, L0.id === 'hospital' ? 1.9 : Math.min(L0.pinY * .5, 2.3), Math.sin(deg(45)) * L0.r).applyMatrix4(camera.matrixWorldInverse);
    const z = sm ? 2.1 : 2.0, ppu = base.ppu * z, fx = base.bx + base.bw * .5, fy = base.by + base.bh * (sm ? .42 : .45);
    const left = p.x - fx / ppu, top = p.y + fy / ppu;
    return { rot: nearestRot(rot, deg(L0.a - 45)), left, right: left + W / ppu, top, bottom: top - H / ppu, fx, fy };
  }
  let rush = false;
  const anim = (dur, fn) => new Promise(res => { const t0 = performance.now(); const step = now => { const k = rush ? 1 : clamp01((now - t0) / dur); fn(easeIO(k)); dirty = true; if (k < 1) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); kick(); });
  /* 建物に寄る(寄り終わったら、画面の上での建物の位置を返す)。hurry() で寄り終わりへ飛ぶ */
  async function zoomTo(id) {
    const to = focusFrame(id), from = { rot, left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom };
    focus = { id }; rotV = 0; spin = null; rush = false; highlight(id);
    await anim(820, e => { rot = lerp(from.rot, to.rot, e); setFrame({ left: lerp(from.left, to.left, e), right: lerp(from.right, to.right, e), top: lerp(from.top, to.top, e), bottom: lerp(from.bottom, to.bottom, e) }); });
    const sr = o.canvas.getBoundingClientRect();
    return { x: sr.left + to.fx, y: sr.top + to.fy };
  }
  /* 町の普段の姿に戻す(ロビーに着いたあと、見えないところで) */
  function reset() { focus = null; rush = false; highlight(null); setFrame(base); dirty = true; kick(); }
  function hurry() { rush = true; kick(); }
  function face(id) { const sp = S.spots[id]; if (!sp || !sp.L.r || focus) return; spin = { from: rot, to: nearestRot(rot, deg(sp.L.a - 45)), t0: performance.now(), dur: 700 }; kick(); }
  function highlight(id) {
    hiId = id; const sp = id && S.spots[id];
    if (sp) { SH.uHi.value = sp.L.bid; SH.uHiColor.value.set(sp.L.acc); S.dyn.halo.mat.color.set(sp.L.acc); S.dyn.halo.mesh.position.set(sp.ground.x, .07, sp.ground.z); S.dyn.halo.mesh.scale.setScalar(sp.radius); S.dyn.halo.mesh.visible = true; }
    kick();
  }
  function setNight(on) { nightFrom = night; nightT0 = performance.now(); nightTo = on ? 1 : 0; kick(); }
  function setPaused(p) { paused = p; kick(); }
  function rotateBy(d) { spin = { from: rot, to: rot + deg(d), t0: performance.now(), dur: 700 }; kick(); }

  /* ドラッグで回す(横の動きだけ。縦はページのスクロールに渡す) */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hits = Object.values(S.spots).map(s => s.hit);
  function pick(e) {
    const r = o.canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera); const h = ray.intersectObjects(hits, false)[0]; return h ? h.object.userData.id : null;
  }
  let down = null;
  o.canvas.addEventListener('pointerdown', e => { if (focus) return; down = { x: e.clientX, t: performance.now(), moved: 0, id: e.pointerId, lastX: e.clientX }; rotV = 0; spin = null; });
  o.canvas.addEventListener('pointermove', e => {
    if (down && e.pointerId === down.id) {
      const dx = e.clientX - down.lastX; down.lastX = e.clientX; down.moved += Math.abs(dx);
      if (down.moved > 4) { if (!o.canvas.hasPointerCapture(e.pointerId)) o.canvas.setPointerCapture(e.pointerId); rot += dx * .0075; rotV = dx * .0075 * 60; dirty = true; kick(); }
      return;
    }
    if (e.pointerType === 'mouse' && !focus) { const id = pick(e); if (id !== hover) { hover = id; o.canvas.style.cursor = id ? 'pointer' : ''; o.onHover(id); } }
  });
  const up = e => {
    if (!down || e.pointerId !== down.id) return;
    const tap = down.moved < 6 && performance.now() - down.t < 500;
    if (o.canvas.hasPointerCapture(e.pointerId)) o.canvas.releasePointerCapture(e.pointerId);
    down = null; if (tap && !focus) { const id = pick(e); if (id) o.onPick(id); }
  };
  o.canvas.addEventListener('pointerup', up); o.canvas.addEventListener('pointercancel', () => { down = null; });
  o.canvas.addEventListener('pointerleave', () => { if (hover) { hover = null; o.canvas.style.cursor = ''; o.onHover(null); } });

  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); }, { threshold: 0 }).observe(o.canvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  const v3 = new THREE.Vector3(), camDir = new THREE.Vector3();
  function pins() {
    camera.getWorldDirection(camDir); camDir.y = 0; camDir.normalize();
    const items = [];
    for (const id in S.spots) {
      const s = S.spots[id]; v3.copy(s.anchor); S.world.localToWorld(v3);
      const depth = v3.x * camDir.x + v3.z * camDir.z; v3.project(camera);
      items.push({ id, x: (v3.x + 1) / 2 * W, y: (1 - v3.y) / 2 * H, depth });
    }
    o.onPins(items, !!focus);
  }
  function kick() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); } }
  function loop(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    let active = false;
    if (!paused) { t += dt; active = true; }
    if (!down && Math.abs(rotV) > .0005 && !focus && !spin) { rot += rotV * dt; rotV *= Math.pow(.04, dt); active = true; }
    if (spin) { const k = clamp01((now - spin.t0) / spin.dur); rot = lerp(spin.from, spin.to, easeIO(k)); active = true; if (k >= 1) spin = null; }
    if (Math.abs(night - nightTo) > .001) { night = lerp(nightFrom, nightTo, clamp01((now - nightT0) / 1300)); applyLight(L, renderer, easeIO(night), S.dyn.clouds); active = true; }
    const want = hiId ? .32 : 0;
    if (Math.abs(hiAmt - want) > .002) { hiAmt = lerp(hiAmt, want, 1 - Math.pow(.002, dt)); SH.uHiAmt.value = hiAmt; S.dyn.halo.mat.opacity = hiAmt * 2.4; if (hiAmt < .004 && !hiId) { S.dyn.halo.mesh.visible = false; SH.uHi.value = -1; } active = true; }
    S.world.rotation.y = rot;
    if (!paused) {
      placePeople(S.dyn, t); placeBus(S.dyn.bus, t);
      for (const c of S.dyn.clouds) placeCloud(c, t);
      S.dyn.pebbles.position.y = Math.sin(t * .6) * .18;
      S.dyn.needle.rotation.y = Math.sin(t * .45) * .9 + Math.sin(t * 1.3) * .12;
      for (const rp of S.dyn.ripples) { const k = (t * .32 + rp.phase) % 1; rp.mesh.scale.setScalar(.12 + k * .62); rp.mat.opacity = (1 - k) * .55; }
      if (hiId) S.dyn.halo.mesh.scale.setScalar(S.spots[hiId].radius * (1 + Math.sin(t * 3) * .04));
    }
    if (active || dirty) { renderer.render(S.scene, camera); pins(); dirty = false; o.onFrame && o.onFrame(renderer.info.render); }
    if ((active || down) && visible && !document.hidden) requestAnimationFrame(loop); else running = false;
  }
  applyLight(L, renderer, 0, S.dyn.clouds);
  for (const c of S.dyn.clouds) placeCloud(c, 0);
  placeBus(S.dyn.bus, 0);
  /* 最初の1枚を描いてから、止めた画像と入れ替える */
  renderer.render(S.scene, camera); pins();
  const info = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, programs: renderer.info.programs ? renderer.info.programs.length : 0 };
  kick();
  return { zoomTo, hurry, reset, face, highlight, setNight, setPaused, rotateBy, info, renderer, get frame() { return base; } };
}
