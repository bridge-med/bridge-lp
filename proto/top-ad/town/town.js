/* ================================================================
   案B「まち」— 病院の外にも、町がある
   粘土質の小さな町(three.js 0.160・同梱)。真ん中に病院、まわりに BRIDGE の道具を建物にしたもの。
   モード:
     live    … WebGL で描く。ドラッグで回す・札を押すと寄る・昼夜・一時停止
     still   … WebGL が使えない/動きを減らす/データセーバーのとき。撮っておいた町の画像に札を重ねる
     capture … 画像を作るときだけ(?capture=island|portrait)
   ================================================================ */
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../shared/vendor/three-0.160.0/RoundedBoxGeometry.js';

const Q = new URLSearchParams(location.search);
const CAP = Q.get('capture');
const CAP_ID = Q.get('id');
const CAP_NIGHT = Q.get('time') === 'night';
const ROOT = document.documentElement;
const TAU = Math.PI * 2;
const deg = d => d * Math.PI / 180;
const lerp = (a, b, t) => a + (b - a) * t;
const clamp01 = v => Math.max(0, Math.min(1, v));
const easeIO = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = t => 1 - Math.pow(1 - t, 3);

/* ---------- 決まった並びの乱数(撮るたびに同じ町になるように) ---------- */
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* ---------- 色(昼) ---------- */
const C = {
  grass: '#A9CD8C', grassEdge: '#97BF7C', lawn: '#B8D99C',
  soil1: '#DDA57D', soil2: '#C8916E', soil3: '#B08A78', rock: '#CFB3A0',
  plaza: '#F0E7D7', road: '#CEC7BC', walk: '#F4EEE3', line: '#FFFDF7',
  warmWhite: '#F6F2EA', roofLight: '#ECE6DA',
  hospital: '#F7F4EE', hospAccent: '#5FA9A1', helipad: '#D6DADE', helipadRing: '#F2C14E',
  obsTower: '#F3D27E', obsBand: '#E0B55A', obsDome: '#2E4A6B', navy: '#16233E', sand: '#A98F63', obsBase: '#EDE3CE',
  clinic: '#A8D9CC', clinicTrim: '#F8F6F0', clinicAccent: '#4FA596',
  workshop: '#F1E4D0', workshopRoof: '#E2815F', workshopDoor: '#B9654B',
  post: '#93B6DB', postTrim: '#F8F6F0', mailbox: '#D85A4B',
  library: '#EAD8B6', libraryRoof: '#6E8CB2', column: '#FBF8F1',
  office: '#CBD6E4', officeTrim: '#F4F6F8',
  atelier: '#F3CBA7', atelierRoof: '#BC6E50', chimney: '#B27C64', wood: '#A87556',
  trunk: '#8E6A54', leaf: ['#86B472', '#99C47F', '#74A566', '#A9D08C'], conifer: ['#5F9568', '#6FA273'], autumn: ['#EBA65B', '#E9C25C', '#DD8A5E'],
  people: ['#4E9C9B', '#2F4A6D', '#F4F2EB', '#E8A4A0', '#F2C46B', '#7EA0D2', '#9FCFAE'], skin: ['#F2D3BD', '#E7C0A2', '#CDA083'],
  bus: '#FFF9EE', busBand: '#4FA596', busTrim: '#FFF8E8', glass: '#5C7690', tire: '#3B4150',
  lampPole: '#6F7C92', lampHead: '#FFF4D6', water: '#8CC6DD', cloud: '#FFFFFF', bench: '#B58462',
  stall: '#F7EEDC', awningA: '#E5806A', awningB: '#FFF8EE', gacha: '#E25C55'
};

/* ---------- 部品 ---------- */
const MATS = new Map();
function M(color, o = {}) {
  const k = color + '|' + JSON.stringify(o);
  if (!MATS.has(k)) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: o.r ?? .9, metalness: o.m ?? 0, transparent: !!o.t, opacity: o.o ?? 1 });
    if (o.e) { m.emissive = new THREE.Color(o.e); m.emissiveIntensity = o.ei ?? 1; }
    if (o.vc) m.vertexColors = true;
    MATS.set(k, m);
  }
  return MATS.get(k);
}
function shadow(m, cast = true, recv = true) { m.castShadow = cast; m.receiveShadow = recv; return m; }
function rbox(w, h, d, r, mat, seg = 3) { return shadow(new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, Math.min(r, Math.min(w, h, d) / 2 - .002)), mat)); }
function box(w, h, d, mat) { return shadow(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat)); }
function cyl(rt, rb, h, mat, seg = 24) { return shadow(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat)); }
function sph(r, mat, ws = 20, hs = 14) { return shadow(new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat)); }
function at(m, x, y, z) { m.position.set(x, y, z); return m; }
/* 三角の屋根(切妻)。底辺 w・高さ h・奥行き d。底辺の中心が原点 */
function gable(w, h, d, mat) {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: .04, bevelSize: .04, bevelSegments: 2, curveSegments: 1 });
  g.translate(0, 0, -d / 2);
  return shadow(new THREE.Mesh(g, mat));
}
/* のこぎり屋根の歯ひとつ(直角三角形)。幅 w・高さ h・奥行き d。左下が原点 */
function tooth(w, h, d, mat) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(w, 0); s.lineTo(w, h); s.lineTo(0, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: .03, bevelSize: .03, bevelSegments: 2, curveSegments: 1 });
  g.translate(0, 0, -d / 2);
  return shadow(new THREE.Mesh(g, mat));
}

/* ---------- 窓(建物ごとに、灯る窓と灯らない窓の2つのまとまり) ---------- */
const WIN_GEO = new RoundedBoxGeometry(1, 1, 1, 2, .16);
const WIN_DARK = new THREE.MeshStandardMaterial({ color: '#86A8C3', roughness: .3, metalness: .05 });
const WIN_LIT = new THREE.MeshStandardMaterial({ color: '#86A8C3', roughness: .3, metalness: .05, emissive: new THREE.Color('#FFC872'), emissiveIntensity: 0 });
class Panes {
  constructor(seed) { this.lit = []; this.dark = []; this.r = rng(seed); }
  add(x, y, z, sx, sy, sz, litChance = .55) {
    const m = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(sx, sy, sz));
    (this.r() < litChance ? this.lit : this.dark).push(m);
  }
  /* 面に格子で並べる。face: 'front'|'back'|'left'|'right'。cx,cy は面の中心、cols,rows、間隔 dx,dy、窓の大きさ ww,wh */
  grid(face, W, D, cy, cols, rows, dx, dy, ww, wh, litChance, cx = 0) {
    for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
      const u = cx + (i - (cols - 1) / 2) * dx, y = cy + (j - (rows - 1) / 2) * dy;
      if (face === 'front') this.add(u, y, D / 2 + .012, ww, wh, .05, litChance);
      if (face === 'back') this.add(u, y, -D / 2 - .012, ww, wh, .05, litChance);
      if (face === 'left') this.add(-W / 2 - .012, y, u, .05, wh, ww, litChance);
      if (face === 'right') this.add(W / 2 + .012, y, u, .05, wh, ww, litChance);
    }
  }
  build(g) {
    for (const [arr, mat] of [[this.lit, WIN_LIT], [this.dark, WIN_DARK]]) {
      if (!arr.length) continue;
      const im = new THREE.InstancedMesh(WIN_GEO, mat, arr.length);
      arr.forEach((m, i) => im.setMatrixAt(i, m));
      im.receiveShadow = true;
      g.add(im);
    }
  }
}

/* ---------- 人・木・街灯 ---------- */
const CAPSULE = new THREE.CapsuleGeometry(.075, .15, 4, 10);
const HEAD = new THREE.SphereGeometry(.068, 14, 10);
function person(r, sitting = false) {
  const g = new THREE.Group();
  const body = shadow(new THREE.Mesh(CAPSULE, M(C.people[Math.floor(r() * C.people.length)])));
  body.position.y = sitting ? .17 : .16;
  if (sitting) body.scale.set(1, .75, 1);
  const head = shadow(new THREE.Mesh(HEAD, M(C.skin[Math.floor(r() * C.skin.length)])));
  head.position.y = sitting ? .34 : .37;
  g.add(body, head);
  return g;
}
function tree(r, kind) {
  const g = new THREE.Group();
  const s = .8 + r() * .5;
  if (kind === 'cone') {
    g.add(at(cyl(.05, .07, .3, M(C.trunk), 8), 0, .15, 0));
    const col = M(C.conifer[Math.floor(r() * C.conifer.length)]);
    const c1 = shadow(new THREE.Mesh(new THREE.ConeGeometry(.38, .7, 14), col)); c1.position.y = .55;
    const c2 = shadow(new THREE.Mesh(new THREE.ConeGeometry(.28, .55, 14), col)); c2.position.y = .9;
    g.add(c1, c2);
  } else {
    g.add(at(cyl(.05, .075, .38, M(C.trunk), 8), 0, .19, 0));
    const pal = kind === 'autumn' ? C.autumn : C.leaf;
    const col = M(pal[Math.floor(r() * pal.length)]);
    const a = sph(.4, col, 18, 12); a.position.y = .62; a.scale.set(1, .92, 1);
    g.add(a);
    if (r() > .45) { const b = sph(.26, col, 14, 10); b.position.set(.2, .82, -.08); g.add(b); }
  }
  g.scale.setScalar(s);
  return g;
}
const LAMPS = [];
const CLOUD_MATS = []; let CLOUD_DAY = 1;
function lamp() {
  const g = new THREE.Group();
  g.add(at(cyl(.025, .035, .82, M(C.lampPole), 8), 0, .41, 0));
  const headMat = new THREE.MeshStandardMaterial({ color: C.lampHead, roughness: .6, emissive: new THREE.Color('#FFD08A'), emissiveIntensity: 0 });
  const h = sph(.075, headMat, 12, 10); h.position.y = .86; h.castShadow = false;
  g.add(h); LAMPS.push(headMat);
  return g;
}

/* ================================================================
   建物(手前 = ローカルの +Z)
   ================================================================ */
const B = {};
const ANIM = { needle: null, ripples: [], gachaBalls: [], flags: [] };

B.hospital = () => {
  const g = new THREE.Group(), p = new Panes(11);
  const W = 3.7, H = 3.05, D = 2.5;
  g.add(at(rbox(W, H, D, .16, M(C.hospital)), 0, H / 2 + .02, 0));
  g.add(at(rbox(W + .1, .26, D + .1, .1, M(C.hospAccent)), 0, H - .02, 0));
  g.add(at(rbox(W - .3, .12, D - .3, .05, M(C.roofLight)), 0, H + .14, 0));
  // 屋上のヘリポート(円と H)
  g.add(at(cyl(.66, .66, .06, M(C.helipad), 36), .72, H + .22, .05));
  const ring = shadow(new THREE.Mesh(new THREE.TorusGeometry(.52, .035, 8, 44), M(C.helipadRing)), false); ring.rotation.x = -Math.PI / 2; g.add(at(ring, .72, H + .26, .05));
  const hm = M('#FFFFFF');
  g.add(at(box(.06, .02, .42, hm), .72 - .15, H + .26, .05), at(box(.06, .02, .42, hm), .72 + .15, H + .26, .05), at(box(.3, .02, .06, hm), .72, H + .26, .05));
  // 屋上の機械
  g.add(at(rbox(.62, .34, .5, .06, M('#E3E0D8')), -1.05, H + .37, -.35), at(rbox(.36, .26, .36, .05, M('#D9D6CE')), -.45, H + .33, -.6));
  // 正面の玄関棟とひさし
  g.add(at(rbox(1.7, .95, 1.0, .1, M(C.warmWhite)), 0, .5, D / 2 + .35));
  g.add(at(rbox(2.15, .09, 1.3, .045, M(C.hospAccent)), 0, 1.02, D / 2 + .55));
  g.add(at(rbox(1.25, .58, .04, .02, WIN_DARK), 0, .38, D / 2 + .86));
  // 横の低い棟(2階)
  g.add(at(rbox(1.7, 1.55, 1.9, .12, M(C.hospital)), W / 2 + .7, .8, -.2));
  g.add(at(rbox(1.78, .14, 1.98, .06, M(C.hospAccent)), W / 2 + .7, 1.6, -.2));
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) p.add(W / 2 + .25 + i * .45, .55 + j * .55, -.2 + .95 + .012, .3, .3, .05, .5);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) p.add(W / 2 + 1.55 + .012, .55 + j * .55, -.85 + i * .55, .05, .3, .3, .5);
  // 窓
  p.grid('front', W, D, 1.95, 6, 3, .55, .58, .34, .34, .55);
  p.grid('back', W, D, 1.66, 6, 4, .55, .58, .34, .34, .5);
  p.grid('left', W, D, 1.66, 4, 4, .52, .58, .3, .34, .5);
  p.grid('right', W, D, 1.66, 4, 4, .52, .58, .3, .34, .5);
  p.build(g);
  return g;
};

B.observatory = () => {
  const g = new THREE.Group(), p = new Panes(23);
  g.add(at(cyl(1.0, 1.1, .32, M(C.obsBase), 36), 0, .16, 0));
  g.add(at(cyl(.43, .56, 3.55, M(C.obsTower), 32), 0, .32 + 1.775, 0));
  for (const y of [1.25, 2.45]) g.add(at(cyl(.53 - (y - 1.25) * .04, .54 - (y - 1.25) * .04, .14, M(C.obsBand), 32), 0, y, 0));
  g.add(at(rbox(.34, .56, .1, .05, M(C.obsDome)), 0, .62, .53));
  p.add(0, 1.85, .5, .16, .26, .05, .7); p.add(0, 3.05, .46, .14, .24, .05, .7);
  // 展望デッキ
  g.add(at(cyl(1.0, .85, .14, M(C.obsBase), 36), 0, 3.94, 0));
  const rail = shadow(new THREE.Mesh(new THREE.TorusGeometry(.95, .028, 8, 48), M('#FFFFFF'))); rail.rotation.x = -Math.PI / 2; g.add(at(rail, 0, 4.24, 0));
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.add(at(cyl(.016, .016, .28, M('#FFFFFF'), 6), Math.cos(a) * .95, 4.1, Math.sin(a) * .95)); }
  g.add(at(cyl(.56, .56, .48, M(C.obsTower), 32), 0, 4.25, 0));
  const glassBand = cyl(.57, .57, .2, WIN_LIT, 32); glassBand.position.y = 4.28; g.add(glassBand);
  const dome = shadow(new THREE.Mesh(new THREE.SphereGeometry(.6, 32, 18, 0, TAU, 0, Math.PI / 2), M(C.obsDome, { r: .55 }))); dome.position.y = 4.49; g.add(dome);
  // 望遠鏡
  const tel = cyl(.055, .075, .55, M(C.navy, { r: .5 }), 12); tel.rotation.z = deg(55); tel.rotation.y = deg(30); g.add(at(tel, .55, 4.25, .5));
  // 方位磁針(藍と砂。BRIDGE の二色)
  g.add(at(cyl(.022, .022, .42, M('#FFFFFF'), 8), 0, 5.26, 0));
  const needle = new THREE.Group(); needle.position.y = 5.46;
  const n1 = shadow(new THREE.Mesh(new THREE.ConeGeometry(.075, .52, 12), M(C.navy, { r: .45 }))); n1.rotation.z = -Math.PI / 2; n1.position.x = .26;
  const n2 = shadow(new THREE.Mesh(new THREE.ConeGeometry(.075, .52, 12), M(C.sand, { r: .45 }))); n2.rotation.z = Math.PI / 2; n2.position.x = -.26;
  needle.add(n1, n2, sph(.06, M('#FFFFFF'), 10, 8));
  g.add(needle); ANIM.needle = needle;
  p.build(g);
  return g;
};

B.office = () => {
  const g = new THREE.Group();
  const W = 1.95, H = 2.95, D = 1.75;
  g.add(at(rbox(W, H, D, .12, M(C.office)), 0, H / 2 + .02, 0));
  // 帯の窓(全周)。灯る階と灯らない階
  [.6, 1.22, 1.84, 2.46].forEach((y, i) => g.add(at(rbox(W + .04, .34, D + .04, .07, i % 2 ? WIN_LIT : WIN_DARK), 0, y, 0)));
  g.add(at(rbox(W + .08, .12, D + .08, .05, M(C.officeTrim)), 0, H + .02, 0));
  // 屋上の庭とアンテナ
  g.add(at(rbox(.9, .18, .7, .06, M('#CDBFA8')), -.3, H + .17, .2));
  const r = rng(7); for (let i = 0; i < 3; i++) g.add(at(sph(.18 + r() * .08, M(C.leaf[i % 4]), 12, 10), -.55 + i * .25, H + .38, .2 + (i % 2) * .12));
  g.add(at(cyl(.015, .015, .6, M(C.lampPole), 6), .65, H + .35, -.5));
  g.add(at(rbox(1.0, .07, .5, .03, M(C.officeTrim)), 0, .78, D / 2 + .25));
  return g;
};

B.workshop = () => {
  const g = new THREE.Group(), p = new Panes(31);
  const W = 2.25, H = 1.15, D = 1.6;
  g.add(at(rbox(W, H, D, .1, M(C.workshop)), 0, H / 2 + .02, 0));
  // のこぎり屋根(3つの歯)。立ち上がりは窓
  const tw = W / 3;
  for (let i = 0; i < 3; i++) {
    const t = tooth(tw, .5, D, M(C.workshopRoof)); t.position.set(-W / 2 + i * tw, H + .02, 0); g.add(t);
    const gl = rbox(.04, .36, D - .2, .02, i === 1 ? WIN_LIT : WIN_DARK); gl.position.set(-W / 2 + (i + 1) * tw - .02, H + .26, 0); g.add(gl);
  }
  g.add(at(rbox(.78, .82, .08, .05, M(C.workshopDoor)), -.35, .43, D / 2 + .02));
  p.add(.62, .62, D / 2 + .02, .46, .36, .05, .6);
  p.build(g);
  // 掲示板(掲示じたく)と紙の束
  g.add(at(cyl(.025, .025, .7, M(C.wood), 6), .45, .35, D / 2 + .5), at(cyl(.025, .025, .7, M(C.wood), 6), .95, .35, D / 2 + .5));
  g.add(at(rbox(.62, .44, .06, .03, M('#D8C3A0')), .7, .6, D / 2 + .5));
  g.add(at(box(.24, .32, .02, M('#FFFFFF')), .58, .6, D / 2 + .54), at(box(.2, .14, .02, M('#FBE8C8')), .84, .66, D / 2 + .54));
  const r = rng(5);
  for (let i = 0; i < 4; i++) g.add(at(rbox(.36, .07, .26, .02, M(i % 2 ? '#FFFFFF' : '#F4EEE2')), -.95 + r() * .04, .04 + i * .07, D / 2 + .45));
  return g;
};

B.clinic = () => {
  const g = new THREE.Group(), p = new Panes(41);
  const W = 2.25, H = 1.08, D = 1.45;
  g.add(at(rbox(W, H, D, .12, M(C.clinic)), 0, H / 2 + .02, 0));
  g.add(at(rbox(W + .22, .13, D + .2, .06, M(C.clinicTrim)), 0, H + .08, 0));
  // 縞のひさし
  for (let i = 0; i < 7; i++) {
    const s = rbox(.26, .05, .5, .02, M(i % 2 ? C.clinicTrim : C.clinicAccent));
    s.position.set(-.78 + i * .26, .93, D / 2 + .22); s.rotation.x = deg(20); g.add(s);
  }
  p.add(-.55, .55, D / 2 + .012, .62, .4, .05, .7); p.add(.15, .55, D / 2 + .012, .42, .4, .05, .7);
  g.add(at(rbox(.42, .7, .06, .04, WIN_DARK), .78, .38, D / 2 + .02));
  p.grid('left', W, D, .58, 2, 1, .55, .5, .36, .36, .6);
  p.grid('right', W, D, .58, 2, 1, .55, .5, .36, .36, .6);
  p.build(g);
  // 屋上の看板(白地に十字。緑十字の系統で、赤十字は使わない)
  g.add(at(rbox(.74, .5, .1, .06, M('#FFFFFF')), -.35, H + .45, .25));
  g.add(at(box(.08, .3, .03, M(C.clinicAccent)), -.35, H + .45, .31), at(box(.3, .08, .03, M(C.clinicAccent)), -.35, H + .45, .31));
  // ベンチと待つ人
  const bench = new THREE.Group();
  bench.add(at(rbox(.7, .06, .22, .025, M(C.bench)), 0, .2, 0), at(rbox(.7, .2, .05, .02, M(C.bench)), 0, .32, -.09));
  bench.add(at(box(.04, .2, .18, M(C.lampPole)), -.3, .1, 0), at(box(.04, .2, .18, M(C.lampPole)), .3, .1, 0));
  const r = rng(3); const s1 = person(r, true); s1.position.set(-.15, .06, .02); const s2 = person(r, true); s2.position.set(.18, .06, .02);
  bench.add(s1, s2); bench.position.set(-1.45, 0, D / 2 + .1); bench.rotation.y = deg(35); g.add(bench);
  return g;
};

B.post = () => {
  const g = new THREE.Group(), p = new Panes(53);
  const W = 1.75, H = 1.35, D = 1.5;
  g.add(at(rbox(W, H, D, .12, M(C.post)), 0, H / 2 + .02, 0));
  g.add(at(rbox(W + .12, .16, D + .12, .06, M(C.postTrim)), 0, H + .02, 0));
  // アーチの入口
  const arch = shadow(new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .1, 24, 1, false, 0, Math.PI), M(C.postTrim))); arch.rotation.z = Math.PI / 2; arch.rotation.y = Math.PI / 2;
  arch.position.set(0, .82, D / 2 + .02); g.add(arch);
  g.add(at(rbox(.6, .82, .1, .03, M(C.postTrim)), 0, .41, D / 2 + .02));
  g.add(at(rbox(.46, .74, .1, .03, M('#4E6E92')), 0, .39, D / 2 + .05));
  const clock = cyl(.17, .17, .05, M('#FFFFFF'), 24); clock.rotation.x = Math.PI / 2; clock.position.set(0, 1.18, D / 2 + .05); g.add(clock);
  const hand1 = box(.02, .11, .02, M(C.navy)); hand1.position.set(0, 1.22, D / 2 + .085); g.add(hand1);
  const hand2 = box(.08, .02, .02, M(C.navy)); hand2.position.set(.035, 1.18, D / 2 + .085); g.add(hand2);
  p.add(-.6, .85, D / 2 + .012, .3, .38, .05, .6); p.add(.6, .85, D / 2 + .012, .3, .38, .05, .6);
  p.grid('left', W, D, .85, 2, 1, .55, .5, .3, .38, .6); p.grid('right', W, D, .85, 2, 1, .55, .5, .3, .38, .6);
  p.build(g);
  // 郵便ポスト
  const mb = new THREE.Group();
  mb.add(at(cyl(.14, .14, .5, M(C.mailbox, { r: .6 }), 20), 0, .25, 0));
  const top = shadow(new THREE.Mesh(new THREE.SphereGeometry(.14, 20, 10, 0, TAU, 0, Math.PI / 2), M(C.mailbox, { r: .6 }))); top.position.y = .5; mb.add(top);
  mb.add(at(box(.16, .025, .02, M('#3A2A2A')), 0, .42, .135));
  mb.position.set(.95, 0, D / 2 + .35); g.add(mb);
  // 旗
  g.add(at(cyl(.015, .015, .75, M(C.lampPole), 6), -.7, H + .45, .45));
  const flag = shadow(new THREE.Mesh(new THREE.BoxGeometry(.32, .2, .015), M(C.sand))); flag.position.set(-.53, H + .7, .45); g.add(flag); ANIM.flags.push(flag);
  return g;
};

B.library = () => {
  const g = new THREE.Group(), p = new Panes(61);
  const W = 2.15, H = 1.3, D = 1.5;
  g.add(at(rbox(W, H, D, .1, M(C.library)), 0, H / 2 + .16, -.12));
  g.add(at(rbox(W + .32, .16, D + .7, .05, M(C.column)), 0, .08, .18));
  g.add(at(rbox(W + .1, .12, D + .55, .04, M(C.column)), 0, .2, .2));
  g.add(at(rbox(W + .22, .16, D + .4, .06, M(C.libraryRoof)), 0, H + .24, .06));
  const ped = gable(W + .1, .5, .34, M(C.libraryRoof)); ped.position.set(0, H + .3, .62); g.add(ped);
  g.add(at(cyl(.5, .55, .22, M(C.column), 28), 0, H + .4, -.25));
  const dome = shadow(new THREE.Mesh(new THREE.SphereGeometry(.5, 28, 14, 0, TAU, 0, Math.PI / 2), M('#C9A86A', { r: .6 }))); dome.position.set(0, H + .5, -.25); g.add(dome);
  g.add(at(sph(.06, M(C.libraryRoof), 10, 8), 0, H + 1.03, -.25));
  for (let i = 0; i < 4; i++) g.add(at(cyl(.085, .1, 1.05, M(C.column), 16), -.72 + i * .48, .78, .78));
  g.add(at(rbox(.42, .62, .08, .04, M('#7A5C45')), 0, .5, D / 2 - .1));
  p.grid('left', W, D, .9, 2, 1, .52, .5, .3, .42, .6, -.12); p.grid('right', W, D, .9, 2, 1, .52, .5, .3, .42, .6, -.12);
  p.grid('back', W, D, .9, 3, 1, .55, .5, .3, .42, .5);
  p.build(g); g.children[g.children.length - 1].position.z = -.12;
  return g;
};

B.park = () => {
  const g = new THREE.Group(), r = rng(71);
  g.add(at(cyl(1.85, 1.9, .06, M(C.lawn), 40), 0, .03, 0));
  // 池(ふたつめの波)と、二つの波紋
  const water = shadow(new THREE.Mesh(new THREE.CylinderGeometry(.82, .82, .04, 40), M(C.water, { r: .25, m: .05 })), false, true); water.position.set(-.38, .07, .28); g.add(water);
  const rim = shadow(new THREE.Mesh(new THREE.TorusGeometry(.84, .05, 8, 44), M('#E9E1D2')), false, true); rim.rotation.x = -Math.PI / 2; g.add(at(rim, -.38, .08, .28));
  for (const [ox, oz] of [[-.62, .12], [-.12, .48]]) for (let k = 0; k < 3; k++) {
    const m = new THREE.MeshBasicMaterial({ color: '#FFFFFF', transparent: true, opacity: .0, depthWrite: false });
    const t = new THREE.Mesh(new THREE.TorusGeometry(1, .03, 6, 36), m); t.rotation.x = -Math.PI / 2; t.position.set(-.38 + ox + .38, .1, .28 + oz - .28);
    g.add(t); ANIM.ripples.push({ mesh: t, mat: m, phase: k / 3 + (ox > -.4 ? .17 : 0) });
  }
  // 屋台(ごきげん回復ガチャ)
  const st = new THREE.Group();
  st.add(at(rbox(.9, .55, .55, .06, M(C.stall)), 0, .3, 0));
  for (let i = 0; i < 6; i++) { const s = rbox(.17, .05, .62, .02, M(i % 2 ? C.awningB : C.awningA)); s.position.set(-.425 + i * .17, .78, .08); s.rotation.x = deg(14); st.add(s); }
  for (const x of [-.42, .42]) st.add(at(cyl(.022, .022, .5, M(C.wood), 6), x, .78, .32));
  const gm = new THREE.Group();
  gm.add(at(rbox(.22, .22, .2, .04, M(C.gacha, { r: .6 })), 0, .11, 0));
  const dome = new THREE.Mesh(new THREE.SphereGeometry(.13, 18, 14), new THREE.MeshStandardMaterial({ color: '#FFFFFF', transparent: true, opacity: .38, roughness: .1 })); dome.position.y = .33; gm.add(dome);
  for (let i = 0; i < 6; i++) { const b = sph(.045, M(['#F2C14E', '#5FA9A1', '#E8A4A0', '#7EA0D2', '#FFFFFF', '#E5806A'][i]), 10, 8); b.position.set((r() - .5) * .14, .28 + r() * .07, (r() - .5) * .14); gm.add(b); ANIM.gachaBalls.push(b); }
  gm.position.set(.28, .58, .1); st.add(gm);
  st.position.set(.85, 0, -.55); st.rotation.y = deg(-20); g.add(st);
  // ベンチ・木・人
  const bench = new THREE.Group(); bench.add(at(rbox(.62, .06, .2, .025, M(C.bench)), 0, .2, 0), at(box(.04, .2, .16, M(C.lampPole)), -.25, .1, 0), at(box(.04, .2, .16, M(C.lampPole)), .25, .1, 0));
  const sit = person(r, true); sit.position.set(.08, .06, 0); bench.add(sit);
  bench.position.set(.75, 0, .9); bench.rotation.y = deg(-35); g.add(bench);
  for (const [x, z, k] of [[-1.25, -.75, 'round'], [-.2, -1.25, 'autumn'], [1.4, .25, 'round'], [-1.45, .95, 'cone']]) { const t = tree(r, k); t.position.set(x, .05, z); g.add(t); }
  const kid = person(r); kid.scale.setScalar(.8); kid.position.set(.05, .06, -.15); g.add(kid);
  return g;
};

B.atelier = () => {
  const g = new THREE.Group();
  const W = 1.35, H = .95, D = 1.15;
  g.add(at(rbox(W, H, D, .1, M(C.atelier)), 0, H / 2 + .02, 0));
  const roof = gable(W + .26, .72, D + .28, M(C.atelierRoof)); roof.position.y = H + .02; g.add(roof);
  g.add(at(rbox(.2, .5, .2, .03, M(C.chimney)), .35, H + .55, -.2));
  g.add(at(rbox(.34, .6, .06, .03, M(C.wood)), -.3, .32, D / 2 + .01));
  const win = rbox(.36, .32, .06, .04, WIN_LIT); win.position.set(.28, .55, D / 2 + .01); g.add(win);
  g.add(at(rbox(.44, .05, .1, .02, M('#FFFFFF')), .28, .37, D / 2 + .06));
  const r = rng(91);
  for (let i = 0; i < 3; i++) g.add(at(sph(.1, M(['#E8A4A0', '#F2C46B', '#FFFFFF'][i]), 10, 8), -.05 + i * .13, .42, D / 2 + .1));
  const t = tree(r, 'round'); t.scale.setScalar(.75); t.position.set(-.9, 0, .2); g.add(t);
  return g;
};

/* 町の並び。a は島の中心から見た角度(0°が右、45°が手前) */
const LOCS = [
  { id: 'hospital', a: 45, r: 0, pinY: 4.3, s: 1.0 },
  { id: 'observatory', a: 225, r: 5.0, pinY: 6.2 },
  { id: 'office', a: 268, r: 5.05, pinY: 3.9 },
  { id: 'workshop', a: 314, r: 5.0, pinY: 2.35 },
  { id: 'clinic', a: 2, r: 5.15, pinY: 2.0 },
  { id: 'park', a: 50, r: 5.35, pinY: 1.7 },
  { id: 'atelier', a: 96, r: 5.15, pinY: 2.25 },
  { id: 'post', a: 138, r: 5.0, pinY: 2.2 },
  { id: 'library', a: 182, r: 5.05, pinY: 2.55 }
];

/* ================================================================
   島
   ================================================================ */
const ROAD_R = 7.3, ISLAND_R = 9.15, BS = 1.2;
function island(g) {
  const r = rng(101);
  // 草の天面と丸い縁
  const top = shadow(new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R - .32, ISLAND_R - .32, .64, 128), M(C.grass)), false, true); top.position.y = -.32; g.add(top);
  const edge = shadow(new THREE.Mesh(new THREE.TorusGeometry(ISLAND_R - .32, .32, 18, 128), M(C.grassEdge)), true, true); edge.rotation.x = -Math.PI / 2; edge.position.y = -.32; g.add(edge);
  // 土の帯(少しすぼまる)と、その下の面のある岩
  const soil = shadow(new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R - .3, ISLAND_R - .75, 1.15, 96, 2), M(C.soil1)), false, true); soil.position.y = -1.18; g.add(soil);
  const soil2 = shadow(new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R - .75, ISLAND_R - 1.25, .55, 96), M(C.soil2)), false, true); soil2.position.y = -2.02; g.add(soil2);
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
    tmp.copy(cr).offsetHSL(0, (r() - .5) * .04, (r() - .5) * .08 + clamp01((-y - 2.4) / 7) * -.1);
    for (let k = 0; k < 3; k++) cols.set([tmp.r, tmp.g, tmp.b], (f + k) * 3);
  }
  ng.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const rock = shadow(new THREE.Mesh(ng, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, flatShading: true })), false, true); g.add(rock);
  // 広場・環状の道・歩道
  const plaza = shadow(new THREE.Mesh(new THREE.CylinderGeometry(2.85, 2.85, .07, 64), M(C.plaza)), false, true); plaza.position.y = .035; g.add(plaza);
  const ring = (r0, r1, mat, y) => { const m = shadow(new THREE.Mesh(new THREE.RingGeometry(r0, r1, 128), mat), false, true); m.rotation.x = -Math.PI / 2; m.position.y = y; g.add(m); };
  ring(ROAD_R - .5, ROAD_R + .5, M(C.road), .03);
  ring(ROAD_R - .74, ROAD_R - .5, M(C.walk), .045);
  ring(ROAD_R + .5, ROAD_R + .72, M(C.walk), .045);
  for (let i = 0; i < 36; i++) { const a = i / 36 * TAU; const d = rbox(.28, .012, .065, .02, M(C.line)); d.castShadow = false; d.position.set(Math.cos(a) * ROAD_R, .045, Math.sin(a) * ROAD_R); d.rotation.y = -a + Math.PI / 2; g.add(d); }
  // 広場から外へ抜ける小道(建物のあいだ)
  for (const a of [26, 116, 205, 291]) {
    const len = ROAD_R - .74 - 2.7, mid = 2.7 + len / 2, rad = deg(a);
    const path = rbox(.6, .05, len, .03, M(C.walk)); path.castShadow = false;
    path.position.set(Math.cos(rad) * mid, .03, Math.sin(rad) * mid); path.rotation.y = Math.atan2(Math.cos(rad), Math.sin(rad)); g.add(path);
  }
  // 建物の前の石だたみ
  for (const L of LOCS) if (L.r && L.id !== 'park') {
    const rad = deg(L.a), pad = rbox(1.0, .05, .9, .04, M(C.walk)); pad.castShadow = false;
    const off = 1.05 * (L.s || BS);
    pad.position.set(Math.cos(rad) * L.r + Math.cos(AZ) * off, .03, Math.sin(rad) * L.r + Math.sin(AZ) * off); pad.rotation.y = AZ; g.add(pad);
  }
  // 木は群れで(島の縁に寄せて、ところどころ)
  const avoid = LOCS.filter(L => L.r).map(L => L.a);
  const nearBuilding = (a, w = 16) => avoid.some(b => { const d = Math.abs(((a - b + 540) % 360) - 180); return d < w; });
  const clusters = [[8, 3], [34, 2], [72, 3], [118, 2], [160, 3], [200, 2], [246, 3], [292, 2], [336, 3]];
  for (const [ca, n] of clusters) for (let i = 0; i < n + 1; i++) {
    const a = ca + (r() - .5) * 16, rr = ISLAND_R - .85 - r() * .5;
    const kind = r() < .22 ? 'cone' : r() < .3 ? 'autumn' : 'round';
    const t = tree(r, kind); t.position.set(Math.cos(deg(a)) * rr, 0, Math.sin(deg(a)) * rr); t.rotation.y = r() * TAU; t.scale.multiplyScalar(.9 + r() * .4); g.add(t);
  }
  for (let i = 0; i < 9; i++) {
    const a = 13 + i * 40 + r() * 10; if (nearBuilding(a, 14)) continue;
    const rr = 3.35 + r() * .9;
    const t = tree(r, r() < .3 ? 'autumn' : 'round'); t.scale.multiplyScalar(.8); t.position.set(Math.cos(deg(a)) * rr, 0, Math.sin(deg(a)) * rr); g.add(t);
  }
  // 花壇
  const fl = ['#F2B5A7', '#F4D27A', '#FFFFFF', '#E99A8F', '#C9B6E4'];
  for (const a of [70, 160, 250, 340]) {
    const rad = deg(a), cx = Math.cos(rad) * 3.05, cz = Math.sin(rad) * 3.05;
    g.add(at(rbox(.9, .14, .5, .06, M('#E6DCCB')), cx, .07, cz));
    for (let k = 0; k < 7; k++) g.add(at(sph(.075, M(fl[k % fl.length]), 8, 6), cx - .32 + k * .107, .19, cz + (k % 2 ? .1 : -.08)));
  }
  for (let i = 0; i < 8; i++) { const a = deg(i * 45 + 22.5); const l = lamp(); l.position.set(Math.cos(a) * (ROAD_R + .62), .03, Math.sin(a) * (ROAD_R + .62)); g.add(l); }
  for (let i = 0; i < 4; i++) { const a = deg(i * 90); const l = lamp(); l.position.set(Math.cos(a) * 2.95, .03, Math.sin(a) * 2.95); g.add(l); }
  // 浮かぶ小石
  const rocks = [];
  for (const [x, y, z, s] of [[-8.6, -4.2, 3.4, .55], [7.4, -5.6, -2.6, .42], [-3.4, -8.0, -6.2, .32], [5.6, -3.4, 7.4, .3]]) {
    const ph = r() * TAU;
    const m = shadow(new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), new THREE.MeshStandardMaterial({ color: C.rock, roughness: .95, flatShading: true })), false, false); m.position.set(x, y, z); m.rotation.set(r() * 3, r() * 3, 0); g.add(m); rocks.push({ m, y, p: ph });
    const cap = shadow(new THREE.Mesh(new THREE.CylinderGeometry(s * .78, s * .9, s * .32, 12), M(C.grass)), false, false); cap.position.set(x, y + s * .64, z); g.add(cap); rocks.push({ m: cap, y: y + s * .64, p: ph });
  }
  return rocks;
}

/* ================================================================
   シーン
   ================================================================ */
function makeScene(onlyId) {
  const scene = new THREE.Scene();
  const world = new THREE.Group(); scene.add(world);
  const spots = {};
  const movers = { walkers: [], bus: null, clouds: [], rocks: [] };
  if (onlyId) {
    const g = B[onlyId](); world.add(g);
    const plot = shadow(new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, .3, 64), M(C.grass)), false, true); plot.position.y = -.15; world.add(plot);
    const soil = shadow(new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.45, .55, 64), M(C.soil1)), false, true); soil.position.y = -.57; world.add(soil);
    if (onlyId === 'hospital') { plot.scale.set(1.35, 1, 1.35); soil.scale.set(1.35, 1, 1.35); }
    return { scene, world, spots, movers };
  }
  movers.rocks = island(world);
  for (const L of LOCS) {
    const g = B[L.id]();
    const rad = deg(L.a);
    g.position.set(Math.cos(rad) * L.r, 0, Math.sin(rad) * L.r);
    g.rotation.y = AZ; // 正面は最初のカメラの向きにそろえる(模型の舞台のように)
    g.scale.setScalar(L.s || BS);
    world.add(g);
    const bb = new THREE.Box3().setFromObject(g), size = bb.getSize(new THREE.Vector3()), ctr = bb.getCenter(new THREE.Vector3());
    const hit = new THREE.Mesh(new THREE.BoxGeometry(size.x + .3, size.y + .3, size.z + .3), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.copy(ctr); hit.userData.id = L.id; world.add(hit);
    spots[L.id] = { L, group: g, hit, anchor: new THREE.Vector3(Math.cos(rad) * L.r, L.pinY * (L.s || BS), Math.sin(rad) * L.r), base: g.position.clone(), lift: 0 };
  }
  // 歩く人
  const r = rng(202);
  for (let i = 0; i < 22; i++) {
    const p = person(r);
    const lane = i % 3 === 0 ? ROAD_R + .61 : ROAD_R - .62;
    const w = { mesh: p, kind: 'ring', r: lane, a: r() * TAU, v: (.035 + r() * .04) * (r() < .5 ? 1 : -1), ph: r() * TAU };
    world.add(p); movers.walkers.push(w);
  }
  for (let i = 0; i < 8; i++) {
    const p = person(r);
    const w = { mesh: p, kind: 'plaza', r: 2.35 + r() * .35, a: r() * TAU, v: (.06 + r() * .06) * (r() < .5 ? 1 : -1), ph: r() * TAU };
    world.add(p); movers.walkers.push(w);
  }
  for (const [a, rr] of [[118, 3.5], [70, 6.4], [205, 3.6], [291, 3.7], [335, 6.45]]) { const p = person(r); p.position.set(Math.cos(deg(a)) * rr, .03, Math.sin(deg(a)) * rr); p.rotation.y = r() * TAU; world.add(p); }
  // バス
  const bus = new THREE.Group();
  bus.add(at(rbox(1.2, .5, .52, .13, M(C.bus, { r: .7 })), 0, .38, 0));
  bus.add(at(rbox(1.22, .11, .54, .05, M(C.busBand, { r: .7 })), 0, .2, 0));
  bus.add(at(rbox(1.22, .17, .54, .07, WIN_LIT), .03, .48, 0));
  bus.add(at(rbox(.5, .07, .36, .03, M('#E8E2D6')), -.15, .66, 0));
  for (const [x, z] of [[-.33, .24], [.33, .24], [-.33, -.24], [.33, -.24]]) { const w = cyl(.1, .1, .08, M(C.tire), 14); w.rotation.x = Math.PI / 2; w.position.set(x, .13, z); bus.add(w); }
  const hlMat = new THREE.MeshStandardMaterial({ color: '#FFF6DE', emissive: new THREE.Color('#FFE2A0'), emissiveIntensity: 0 });
  for (const z of [-.15, .15]) bus.add(at(new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), hlMat), .58, .3, z));
  LAMPS.push(hlMat);
  world.add(bus); movers.bus = { mesh: bus, a: deg(70), v: .085 };
  // 雲(町の手前と見出しの後ろを横切らないよう、町の奥の空の弧だけを流れる。弧の端で消えて、また現れる)
  const ARCS = [[172, 216], [252, 300]];
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Group();
    const cm = new THREE.MeshStandardMaterial({ color: C.cloud, roughness: 1, emissive: new THREE.Color('#FFFFFF'), emissiveIntensity: .42, transparent: true, opacity: 1 });
    for (const [x, y, z, s] of [[0, 0, 0, .78], [.72, .08, .12, .6], [-.7, .02, -.08, .56], [.22, .38, .02, .55], [-.25, .3, .2, .45]]) { const s2 = shadow(new THREE.Mesh(new THREE.SphereGeometry(s, 16, 12), cm), false, false); s2.position.set(x, y, z); c.add(s2); }
    c.scale.set(1, .72, .9).multiplyScalar(.85 + r() * .45);
    scene.add(c); CLOUD_MATS.push(cm);
    const arc = ARCS[i % 2];
    movers.clouds.push({ g: c, mat: cm, a0: deg(arc[0]), a1: deg(arc[1]), r: 10.8 + r() * 1.6, y: 3.0 + r() * 2.0, v: .012 + r() * .006, ph: (i >> 1) / 2 + r() * .15 });
  }
  return { scene, world, spots, movers };
}

/* ---------- 光(昼と夜) ---------- */
const LIGHT = {
  day: { hemiS: '#E4ECFF', hemiG: '#C2CFA4', hemi: 1.3, sun: '#FFE8C8', sunI: 3.0, fill: '#CFE0FF', fillI: .45, exp: 1.02, win: 0, lamp: 0, pt: 0, cloud: 1 },
  night: { hemiS: '#6573B4', hemiG: '#232A44', hemi: .58, sun: '#B3C4F7', sunI: .75, fill: '#7484C8', fillI: .3, exp: 1.18, win: 2.6, lamp: 3.2, pt: 5.5, cloud: .55 }
};
function makeLights(scene, big) {
  const hemi = new THREE.HemisphereLight(LIGHT.day.hemiS, LIGHT.day.hemiG, LIGHT.day.hemi); scene.add(hemi);
  const sun = new THREE.DirectionalLight(LIGHT.day.sun, LIGHT.day.sunI);
  sun.position.set(-3, 15, 13); sun.castShadow = true;
  const S = 13.5; Object.assign(sun.shadow.camera, { left: -S, right: S, top: S, bottom: -S, near: 1, far: 60 });
  sun.shadow.mapSize.set(big ? 2048 : 1024, big ? 2048 : 1024); sun.shadow.bias = -.0005; sun.shadow.normalBias = .025;
  scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(LIGHT.day.fill, LIGHT.day.fillI); fill.position.set(12, 6, -10); scene.add(fill);
  const pts = [];
  for (let i = 0; i < 4; i++) { const p = new THREE.PointLight('#FFC77A', 0, 4.2, 2); const a = deg(i * 90 + 22.5); p.position.set(Math.cos(a) * (ROAD_R + .62), 1.0, Math.sin(a) * (ROAD_R + .62)); scene.add(p); pts.push(p); }
  return { hemi, sun, fill, pts };
}
function applyLight(L, renderer, t) {
  const d = LIGHT.day, n = LIGHT.night, c = new THREE.Color();
  L.hemi.color.copy(c.set(d.hemiS)).lerp(new THREE.Color(n.hemiS), t);
  L.hemi.groundColor.copy(c.set(d.hemiG)).lerp(new THREE.Color(n.hemiG), t);
  L.hemi.intensity = lerp(d.hemi, n.hemi, t);
  L.sun.color.copy(c.set(d.sun)).lerp(new THREE.Color(n.sun), t); L.sun.intensity = lerp(d.sunI, n.sunI, t);
  L.sun.position.set(lerp(-3, 9, t), lerp(15, 15, t), lerp(13, -7, t));
  L.fill.color.copy(c.set(d.fill)).lerp(new THREE.Color(n.fill), t); L.fill.intensity = lerp(d.fillI, n.fillI, t);
  renderer.toneMappingExposure = lerp(d.exp, n.exp, t);
  WIN_LIT.emissiveIntensity = lerp(d.win, n.win, t);
  WIN_DARK.color.set('#86A8C3').lerp(new THREE.Color('#2E384C'), t);
  WIN_LIT.color.set('#86A8C3').lerp(new THREE.Color('#6B5A3E'), t);
  for (const m of LAMPS) m.emissiveIntensity = lerp(d.lamp, n.lamp, t);
  for (const p of L.pts) p.intensity = lerp(d.pt, n.pt, t);
  for (const cm of CLOUD_MATS) { cm.color.set('#FFFFFF').lerp(new THREE.Color('#7F89BE'), t); cm.emissiveIntensity = lerp(.42, .06, t); }
  CLOUD_DAY = 1 - t;
}

/* ================================================================
   画像を作るとき(?capture=island|portrait)
   ================================================================ */
async function capture() {
  ROOT.classList.add('capture');
  const W = +(Q.get('w') || 1600), H = +(Q.get('h') || 1300);
  const canvas = document.getElementById('town');
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(+(Q.get('dpr') || 1)); renderer.setSize(W, H, false); renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const { scene, world, spots, movers } = makeScene(CAP === 'portrait' ? CAP_ID : null);
  const L = makeLights(scene, true);
  applyLight(L, renderer, CAP_NIGHT ? 1 : 0);
  for (const c of movers.clouds) c.g.visible = false;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 200);
  aimCamera(camera, new THREE.Vector3(0, 0, 0));
  // 収まりを測る
  const pts = [];
  if (CAP === 'portrait') {
    const bb = new THREE.Box3().setFromObject(world);
    for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) pts.push(new THREE.Vector3(x, y, z));
  } else pts.push(...samplePoints());
  fit(camera, pts, W, H, { x0: W * .03, x1: W * .97, y0: H * .03, y1: H * .97 });
  for (const w of movers.walkers) placeWalker(w, 0);
  if (movers.bus) placeBus(movers.bus, 0);
  renderer.render(scene, camera);
  await new Promise(r => requestAnimationFrame(r));
  renderer.render(scene, camera);
  const pins = {};
  for (const id in spots) { const v = spots[id].anchor.clone().project(camera); pins[id] = [+((v.x + 1) / 2 * 100).toFixed(2), +((1 - v.y) / 2 * 100).toFixed(2)]; }
  window.__done = { pins, w: W, h: H };
}

/* ---------- カメラ(正投影・斜め上から) ---------- */
const ELEV = deg(31), AZ = deg(45), DIST = 70;
function aimCamera(cam, target) {
  cam.position.set(target.x + DIST * Math.cos(ELEV) * Math.cos(AZ), target.y + DIST * Math.sin(ELEV), target.z + DIST * Math.cos(ELEV) * Math.sin(AZ));
  cam.up.set(0, 1, 0); cam.lookAt(target); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
}
function samplePoints() {
  const pts = [];
  for (let i = 0; i < 48; i++) { const a = i / 48 * TAU; pts.push(new THREE.Vector3(Math.cos(a) * (ISLAND_R + .1), .6, Math.sin(a) * (ISLAND_R + .1)), new THREE.Vector3(Math.cos(a) * (ISLAND_R + .1), -1.2, Math.sin(a) * (ISLAND_R + .1)), new THREE.Vector3(Math.cos(a) * 5.6, 7.1, Math.sin(a) * 5.6)); }
  pts.push(new THREE.Vector3(.3, -9.9, .2), new THREE.Vector3(0, 5.2, 0));
  return pts;
}
/* 点の集まりを、画面の範囲 R(px)に収める正投影の枠を求める */
function fit(cam, pts, W, H, R) {
  cam.left = -1; cam.right = 1; cam.top = 1; cam.bottom = -1; cam.updateProjectionMatrix(); cam.updateMatrixWorld();
  const inv = cam.matrixWorldInverse; let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) { const v = p.clone().applyMatrix4(inv); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
  const s = Math.min((R.x1 - R.x0) / (x1 - x0), (R.y1 - R.y0) / (y1 - y0));
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, rx = (R.x0 + R.x1) / 2, ry = (R.y0 + R.y1) / 2;
  const f = { left: cx - rx / s, top: cy + ry / s, s };
  f.right = f.left + W / s; f.bottom = f.top - H / s;
  Object.assign(cam, { left: f.left, right: f.right, top: f.top, bottom: f.bottom }); cam.updateProjectionMatrix();
  return f;
}
function placeWalker(w, t) {
  const a = w.a + w.v * t;
  const x = Math.cos(a) * w.r, z = Math.sin(a) * w.r;
  w.mesh.position.set(x, .03 + Math.abs(Math.sin(t * 7 + w.ph)) * .025, z);
  w.mesh.rotation.y = -a + (w.v > 0 ? 0 : Math.PI);
}
function placeCloud(c, t) {
  const u = (c.ph + t * c.v) % 1, a = lerp(c.a0, c.a1, u);
  const fade = Math.min(1, u / .16, (1 - u) / .16) * CLOUD_DAY;
  c.g.position.set(Math.cos(a) * c.r, c.y + Math.sin(t * .3 + c.ph * 6) * .15, Math.sin(a) * c.r);
  c.mat.opacity = fade; c.mat.depthWrite = fade > .6; c.g.visible = fade > .02;
}
function placeBus(b, t) {
  const a = b.a + b.v * t;
  b.mesh.position.set(Math.cos(a) * (ROAD_R + .24), .03, Math.sin(a) * (ROAD_R + .24));
  b.mesh.rotation.y = -a - Math.PI / 2;
}

/* ================================================================
   ページ: live / still
   ================================================================ */
const hero = document.getElementById('hero');
const stage = document.getElementById('stage');
const pinBox = document.getElementById('pins');
const pinEls = [...document.querySelectorAll('.pin')];
const dialog = document.getElementById('card');
const btnNight = document.getElementById('btnNight');
const btnPause = document.getElementById('btnPause');
const btnL = document.getElementById('btnLeft');
const btnR = document.getElementById('btnRight');
const hint = document.getElementById('hint');
let opener = null;

function hasWebGL() { try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; } }

/* ---------- 札の重なりをなくす(画面上の位置で判定) ----------
   大事な札・手前の札から順に置き、重なるときは 上へ少しずらす → 丸いピクトグラムだけにする、の順で試す。
   見出し・ボタンなどの文字の上にも札を置かない。どの札もタップ領域は 44px 以上(CSS の .pin-in::before) */
const PRI = ['observatory', 'hospital', 'clinic', 'post', 'workshop', 'park', 'atelier', 'library', 'office'];
const KEY = ['observatory', 'hospital', 'clinic'];
const PM = new Map();
function measurePins() {
  for (const el of pinEls) {
    const inn = el.querySelector('.pin-in'), had = el.classList.contains('is-compact');
    el.classList.remove('is-compact'); const fw = inn.offsetWidth, fh = inn.offsetHeight;
    el.classList.add('is-compact'); const cw = inn.offsetWidth, ch = inn.offsetHeight;
    el.classList.toggle('is-compact', had);
    PM.set(el.dataset.id, { fw, fh, cw, ch });
  }
}
function obstaclesIn(frame) {
  const out = [];
  for (const q of ['.hd .logo', '.hd .nav', '.copy .eyebrow', '.copy h1', '.copy .lead', '.copy .ctas', '.tools', '.hint', '.sp-cta']) {
    const e = document.querySelector(q); if (!e || e.hidden) continue;
    const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) continue;
    out.push({ x0: r.left - frame.left, x1: r.right - frame.left, y0: r.top - frame.top, y1: r.bottom - frame.top });
  }
  return out;
}
/* items: { el, id, x, y, back }。base は札の下端(三角の上)の、基準点からのずれ(live は -8・still は 0) */
function declutter(items, obstacles, base) {
  items.sort((a, b) => PRI.indexOf(a.id) - PRI.indexOf(b.id));
  const pad = 3;
  const box = (it, c, dx, dy) => { const m = PM.get(it.id), w = c ? m.cw : m.fw, h = c ? m.ch : m.fh; return { x0: it.x + dx - w / 2 - pad, x1: it.x + dx + w / 2 + pad, y0: it.y + base + dy - h - pad, y1: it.y + base + dy + 6 + pad }; };
  const area = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  const cost = (r, others) => others.reduce((s, o) => s + area(r, o), 0);
  const list = items.filter(it => PM.get(it.id));
  // 1 大事な3つ(展望台・病院・クリニック)は名前つきを先に試す。ほかは丸だけで、重ならない所に置く(置けなければ重なりの最も少ない所)
  const placed = obstacles.slice();
  for (const it of list) {
    let best = null;
    if (KEY.includes(it.id)) for (const dy of [0, -12]) { const r = box(it, 0, 0, dy); if (!cost(r, placed)) { best = { c: 0, dx: 0, dy, r, k: 0 }; break; } }
    if (!best) for (const [dx, dy] of NUDGE) { const r = box(it, 1, dx, dy), k = cost(r, placed); if (!best || k < best.k) best = { c: 1, dx, dy, r, k }; if (!k) break; }
    Object.assign(it, best); placed.push(best.r);
  }
  // 2 残りも、名前つきに戻せるなら戻す(ほかの札と文字に重ならないときだけ)
  for (const it of list) {
    if (!it.c) continue;
    const others = obstacles.concat(list.filter(o => o !== it).map(o => o.r));
    for (const dy of [0, -12]) { const r = box(it, 0, 0, dy); if (!cost(r, others)) { Object.assign(it, { c: 0, dx: 0, dy, r }); break; } }
  }
  for (const it of list) {
    it.el.classList.toggle('is-compact', !!it.c);
    it.el.style.setProperty('--nx', it.dx + 'px');
    it.el.style.setProperty('--ny', it.dy + 'px');
  }
}
/* 丸だけの札を置く場所の候補(そのまま → 上下 → 左右 → 斜め → 遠め) */
const NUDGE = [[0, 0], [0, -12], [0, 12], [-20, 0], [20, 0], [0, -24], [-20, -14], [20, -14], [-20, 14], [20, 14], [-34, 0], [34, 0], [0, 26], [-34, -18], [34, -18], [-34, 18], [34, 18]];

/* ---------- 札の中身(案内の一覧のカードから写す。中身の元はひとつ) ---------- */
function fillCard(id) {
  const src = document.getElementById('b-' + id);
  const $ = s => dialog.querySelector(s);
  $('.card-cat').textContent = src.querySelector('.bld-cat').textContent;
  $('.card-h').textContent = src.querySelector('.bld-name').textContent;
  const lead = src.querySelector('.bld-lead'); $('.card-lead').textContent = lead ? lead.textContent : '';
  const meta = src.querySelector('.bld-meta'); $('.card-meta').textContent = meta ? meta.textContent : ''; $('.card-meta').hidden = !meta;
  const fig = $('.card-shot'), img = fig.querySelector('img');
  fig.dataset.kind = src.dataset.shotKind || 'none';
  if (src.dataset.shot) { img.src = src.dataset.shot; img.alt = src.dataset.shotAlt || ''; fig.hidden = false; } else { img.removeAttribute('src'); fig.hidden = true; }
  const go = src.querySelector('.bld-go'), cgo = $('.card-go');
  cgo.href = go.getAttribute('href'); cgo.querySelector('.t').textContent = go.dataset.label || go.textContent.replace('→', '').trim();
  if (go.target) { cgo.target = go.target; cgo.rel = go.rel; } else { cgo.removeAttribute('target'); cgo.removeAttribute('rel'); }
  const ul = $('.card-more ul'); ul.innerHTML = '';
  const items = [...src.querySelectorAll('.bld-list a')].filter(a => a.getAttribute('href') !== go.getAttribute('href'));
  for (const a of items) { const li = document.createElement('li'); li.appendChild(a.cloneNode(true)); ul.appendChild(li); }
  $('.card-more').hidden = !items.length;
  dialog.style.setProperty('--c', getComputedStyle(src).getPropertyValue('--c'));
}

/* ---------- live ---------- */
function live() {
  ROOT.classList.add('live');
  const canvas = document.getElementById('town');
  const big = innerWidth >= 900;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const { scene, world, spots, movers } = makeScene(null);
  const L = makeLights(scene, big);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 200);
  aimCamera(camera, new THREE.Vector3(0, 0, 0));
  const SAMPLE = samplePoints();
  const pinOf = id => pinEls.find(p => p.dataset.id === id);

  let W = 1, H = 1, base = null;
  let night = 0, nightTo = 0, nightFrom = 0, nightT0 = 0, paused = false, running = true, visible = true;
  let rot = 0, rotV = 0, t = 0, last = performance.now();
  let focus = null; // { id, k(0..1), dir(+1/-1), from, to }
  let hover = null, dirty = true;

  function region() {
    const sp = W < 900;
    if (sp) {
      const top = Math.max(H * .3, H < 740 ? 172 : 252), bottom = H - Math.max(H * .235, 192);
      return { x0: -W * .15, x1: W * 1.15, y0: top, y1: bottom };
    }
    return { x0: W * .37, x1: W * .99, y0: H * .115, y1: H * .955 };
  }
  let OBS = [];
  function resize() {
    W = stage.clientWidth; H = stage.clientHeight;
    renderer.setSize(W, H, false);
    aimCamera(camera, new THREE.Vector3(0, 0, 0));
    base = fit(camera, SAMPLE, W, H, region());
    measurePins(); OBS = obstaclesIn(stage.getBoundingClientRect());
    dirty = true;
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measurePins(); OBS = obstaclesIn(stage.getBoundingClientRect()); dirty = true; kick(); });
  new ResizeObserver(resize).observe(stage);
  resize();

  /* 寄るときの枠: 建物を手前に回し、PC は左寄り、スマホは上寄りに大きく */
  function focusFrame(id) {
    const s = spots[id], sp = W < 900;
    const a = s.L.a, rTarget = deg(a - 45);
    const p = new THREE.Vector3(Math.cos(deg(45)) * s.L.r, s.L.id === 'hospital' ? 1.9 : Math.min(s.L.pinY * .5, 2.2), Math.sin(deg(45)) * s.L.r).applyMatrix4(camera.matrixWorldInverse);
    const z = sp ? 2.0 : 1.85;
    const scale = base.s * z, fx = sp ? W * .5 : W * .36, fy = sp ? H * .2 : H * .52;
    const left = p.x - fx / scale, top = p.y + fy / scale;
    return { rot: rTarget, left, right: left + W / scale, top, bottom: top - H / scale };
  }
  function nearestRot(cur, target) { let d = ((target - cur) % TAU + TAU) % TAU; if (d > Math.PI) d -= TAU; return cur + d; }

  function openSpot(id, from) {
    hideHint();
    opener = from || pinOf(id);
    fillCard(id);
    const to = focusFrame(id); to.rot = nearestRot(rot, to.rot);
    focus = { id, k: 0, t0: performance.now(), dir: 1, from: { rot, left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom }, to };
    rotV = 0; ROOT.classList.add('focused'); pinEls.forEach(p => p.classList.toggle('is-on', p.dataset.id === id));
    dialog.showModal(); dialog.querySelector('.card-h').focus({ preventScroll: true });
    kick();
  }
  function closeSpot() {
    if (!focus) return;
    focus = { id: focus.id, k: 0, t0: performance.now(), dir: -1, from: { rot, left: camera.left, right: camera.right, top: camera.top, bottom: camera.bottom }, to: { rot, left: base.left, right: base.right, top: base.top, bottom: base.bottom } };
    ROOT.classList.remove('focused'); pinEls.forEach(p => p.classList.remove('is-on'));
    kick();
  }
  dialog.addEventListener('close', () => { closeSpot(); if (opener) opener.focus({ preventScroll: true }); });

  pinEls.forEach(p => p.addEventListener('click', () => openSpot(p.dataset.id, p)));

  /* ドラッグで回す(横の動きだけ。縦はページのスクロールに渡す) */
  let down = null;
  canvas.addEventListener('pointerdown', e => { down = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0, id: e.pointerId, lastX: e.clientX }; rotV = 0; hideHint(); });
  canvas.addEventListener('pointermove', e => {
    if (down && e.pointerId === down.id) {
      const dx = e.clientX - down.lastX; down.lastX = e.clientX; down.moved += Math.abs(dx);
      if (down.moved > 4 && !focus) { if (!canvas.hasPointerCapture(e.pointerId)) canvas.setPointerCapture(e.pointerId); rot += dx * .0075; rotV = dx * .0075 * 60; dirty = true; kick(); }
      return;
    }
    if (e.pointerType === 'mouse') pick(e);
  });
  const up = e => {
    if (!down || e.pointerId !== down.id) return;
    const tap = down.moved < 6 && performance.now() - down.t < 500;
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId);
    down = null;
    if (tap && !focus) { const id = pick(e); if (id) openSpot(id); }
  };
  canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', () => { down = null; });
  canvas.addEventListener('pointerleave', () => { if (hover) { hover = null; canvas.style.cursor = ''; pinEls.forEach(p => p.classList.remove('is-hover')); kick(); } });
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  const hits = Object.values(spots).map(s => s.hit);
  function pick(e) {
    const r = canvas.getBoundingClientRect();
    ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(hits, false)[0];
    const id = h ? h.object.userData.id : null;
    if (id !== hover) { hover = id; canvas.style.cursor = id ? 'pointer' : ''; pinEls.forEach(p => p.classList.toggle('is-hover', p.dataset.id === id)); kick(); }
    return id;
  }
  btnL.addEventListener('click', () => { hideHint(); rotV = 0; spinTo(rot - deg(45)); });
  btnR.addEventListener('click', () => { hideHint(); rotV = 0; spinTo(rot + deg(45)); });
  let spin = null;
  function spinTo(r) { spin = { from: rot, to: r, k: 0, t0: performance.now() }; kick(); }

  btnNight.addEventListener('click', () => { nightFrom = night; nightT0 = performance.now(); nightTo = nightTo ? 0 : 1; btnNight.setAttribute('aria-pressed', String(!!nightTo)); ROOT.classList.toggle('night', !!nightTo); kick(); });
  btnPause.addEventListener('click', () => { paused = !paused; btnPause.setAttribute('aria-pressed', String(paused)); btnPause.setAttribute('aria-label', paused ? '町の動きを再生する' : '町の動きを止める'); kick(); });

  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); }, { threshold: 0 }).observe(stage);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  const v3 = new THREE.Vector3(), camDir = new THREE.Vector3();
  function placePins() {
    camera.getWorldDirection(camDir); camDir.y = 0; camDir.normalize();
    const items = [];
    for (const id in spots) {
      const s = spots[id], el = pinOf(id); if (!el) continue;
      v3.copy(s.anchor); v3.y += s.lift; world.localToWorld(v3);
      const depth = v3.x * camDir.x + v3.z * camDir.z; // 大きいほど奥
      v3.project(camera);
      const x = (v3.x + 1) / 2 * W, y = (1 - v3.y) / 2 * H, back = depth > 3.2;
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      el.classList.toggle('is-back', back);
      el.style.zIndex = String(100 - Math.round(depth * 3));
      items.push({ el, id, x, y, back: back ? 1 : 0 });
    }
    if (!focus) declutter(items, OBS, -8);
  }

  function kick() { if (!running) { running = true; last = performance.now(); requestAnimationFrame(loop); } }
  function loop(now) {
    const dt = Math.min(.05, (now - last) / 1000); last = now;
    let active = false;
    if (!paused) { t += dt; active = true; }
    // 回す(慣性)
    if (!down && Math.abs(rotV) > .0005 && !focus) { rot += rotV * dt; rotV *= Math.pow(.04, dt); active = true; }
    if (spin) { spin.k = clamp01((performance.now() - spin.t0) / 700); rot = lerp(spin.from, spin.to, easeIO(spin.k)); active = true; if (spin.k >= 1) spin = null; }
    // 寄る・戻る
    if (focus) {
      focus.k = clamp01((now - focus.t0) / (focus.dir > 0 ? 950 : 800));
      const e = easeIO(focus.k), f = focus.from, to = focus.to;
      rot = lerp(f.rot, to.rot, e);
      camera.left = lerp(f.left, to.left, e); camera.right = lerp(f.right, to.right, e); camera.top = lerp(f.top, to.top, e); camera.bottom = lerp(f.bottom, to.bottom, e);
      camera.updateProjectionMatrix(); active = true;
      if (focus.k >= 1 && focus.dir < 0) focus = null;
    }
    // 昼夜
    if (Math.abs(night - nightTo) > .001) { const k = clamp01((now - nightT0) / 1300); night = lerp(nightFrom, nightTo, k); applyLight(L, renderer, easeIO(night)); active = true; }
    world.rotation.y = rot;
    // 選んだ建物・指した建物を少し持ち上げる
    for (const id in spots) {
      const s = spots[id], want = (hover === id || (focus && focus.id === id && focus.dir > 0)) ? .16 : 0;
      if (Math.abs(s.lift - want) > .001) { s.lift = lerp(s.lift, want, 1 - Math.pow(.0005, dt)); s.group.position.y = s.lift; active = true; }
    }
    if (!paused) {
      for (const w of movers.walkers) placeWalker(w, t);
      placeBus(movers.bus, t);
      for (const c of movers.clouds) placeCloud(c, t);
      for (const k of movers.rocks) k.m.position.y = k.y + Math.sin(t * .6 + k.p) * .18;
      if (ANIM.needle) ANIM.needle.rotation.y = Math.sin(t * .45) * .9 + Math.sin(t * 1.3) * .12;
      for (const rp of ANIM.ripples) { const k = (t * .32 + rp.phase) % 1; rp.mesh.scale.setScalar(.12 + k * .62); rp.mat.opacity = (1 - k) * .55; }
      for (const f of ANIM.flags) f.rotation.y = Math.sin(t * 2.2) * .25;
      for (const [i, b] of ANIM.gachaBalls.entries()) b.position.y = .28 + Math.abs(Math.sin(t * 2.5 + i)) * .04;
    }
    if (active || dirty) { renderer.render(scene, camera); placePins(); dirty = false; }
    if ((active || down) && visible && !document.hidden) requestAnimationFrame(loop); else running = false;
  }
  applyLight(L, renderer, 0);
  for (const c of movers.clouds) placeCloud(c, 0);
  running = false; kick();
  window.__town = { openSpot, closeSpot, setNight: v => { if (!!nightTo !== v) btnNight.click(); }, spots, camera };
  return true;
}

/* ---------- still(撮っておいた町の画像に札を重ねる) ---------- */
function still() {
  ROOT.classList.add('still-on');
  const box = document.getElementById('still');
  const lay = () => {
    const fr = box.getBoundingClientRect(); if (!fr.width) return;
    measurePins();
    const items = pinEls.map(p => { const [x, y] = (p.dataset.pos || '50,50').split(',').map(Number); return { el: p, id: p.dataset.id, x: x / 100 * fr.width, y: y / 100 * fr.height, back: ['observatory', 'office', 'library'].includes(p.dataset.id) ? 1 : 0 }; });
    declutter(items, obstaclesIn(fr), 0);
  };
  addEventListener('resize', lay);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(lay);
  requestAnimationFrame(lay);
  for (const p of pinEls) {
    const [x, y] = (p.dataset.pos || '50,50').split(',').map(Number);
    p.style.left = x + '%'; p.style.top = y + '%';
    p.addEventListener('click', () => { opener = p; fillCard(p.dataset.id); dialog.showModal(); dialog.querySelector('.card-h').focus({ preventScroll: true }); hideHint(); });
  }
  dialog.addEventListener('close', () => { if (opener) opener.focus({ preventScroll: true }); });
  btnNight.addEventListener('click', () => { const on = !ROOT.classList.contains('night'); ROOT.classList.toggle('night', on); btnNight.setAttribute('aria-pressed', String(on)); });
}

function hideHint() { if (hint && !hint.hidden) { hint.classList.add('is-gone'); setTimeout(() => { hint.hidden = true; }, 400); } }

/* ---------- ダイアログ共通: 外側を押すと閉じる ---------- */
if (dialog) {
  dialog.addEventListener('click', e => {
    if (e.target.closest('.card-x')) { dialog.close(); return; }
    const r = dialog.getBoundingClientRect();
    if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) dialog.close();
  });
}

/* ---------- 起動 ---------- */
if (CAP) capture();
else {
  ROOT.classList.add('js');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const save = !!(navigator.connection && navigator.connection.saveData);
  const forceStill = Q.get('still') === '1';
  let ok = false;
  if (!reduce && !save && !forceStill && hasWebGL()) { try { ok = live(); } catch (e) { console.warn(e); ROOT.classList.remove('live'); ok = false; } }
  if (!ok) still();
}
