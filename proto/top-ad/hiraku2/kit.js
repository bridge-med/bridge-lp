/* ================================================================
   融合3「ひらく町」— 形を作る道具(three.js 0.160 同梱)
   形には印を付けておき、あとで素材の種類ごとに1つにまとめる(world.js の bake)
     userData.part … 0 動かない / 1 前の壁(倒れる)/ 2 屋根(持ち上がって消える)
                     + 10×n で、その上に重ねる動き(5 ドームが回る / 6・7 自動ドアの左右)
     userData.fx   … [灯り, 窓]。灯り 1=暖かい窓や街灯 2=藍の灯り 3=砂の灯り。窓 1=夜は暗いガラス
     userData.wid  … 窓の番号(0 以外は、夜に人に合わせて点いたり消えたりする)
     userData.bid  … 建物の番号(グループに付ける。1 病院 2 展望台 3 クリニック 4 事務所 5 図書館 6 公園 7 アトリエ 8 広場)
   ================================================================ */
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../shared/vendor/three-0.160.0/RoundedBoxGeometry.js';

export const TAU = Math.PI * 2;
export const deg = d => d * Math.PI / 180;
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const clamp01 = v => clamp(v, 0, 1);
export function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* 町の色(落ち着いた建築模型の色と、B の温かさ。行き先の色は使わない) */
export const C = {
  grass: '#AFC58E', grassEdge: '#9DB57E', lawn: '#B8CD98', lawn2: '#A9C08A',
  soil1: '#D6A884', soil2: '#C49372', rock: '#C3A491',
  pave: '#ECE3D2', pave2: '#E3D8C3', curb: '#D6CBB6', walk: '#F1E9DB', road: '#A7A099', roadEdge: '#BDB5AB', line: '#F2EDE2',
  white: '#F4F1EA', white2: '#E9E4DA', trim: '#FBF8F1', slab: '#D9CFBF', machine: '#D3CABD', inner: '#F2ECE1',
  scrub: '#5A9E97', scrubD: '#467F79',
  sandTower: '#E2CFAA', sandTowerD: '#D2BC93', indigo: '#2B3A5C', indigoD: '#1E2A45',
  sage: '#B7C7A3', terra: '#C4735A', terraL: '#D39470', cream: '#F3EAD8',
  glassWall: '#9FB3BE', slate: '#5B636B', blind: '#EFE9DD',
  stone: '#E2D7C2', stone2: '#D5C8AF', column: '#F1EADC', verdigris: '#7FA898',
  brick: '#B8735A', brickD: '#9E5F49', timber: '#C6A07A', roofSlate: '#615C58', frame: '#4A4440',
  houseA: '#F0E4CF', houseB: '#E8D7BC', roofA: '#C47A5A', roofB: '#B9704F',
  glass: '#94ACBB', glassDark: '#62768A', door: '#5C6B7C',
  trunk: '#8A7262', leaf: ['#8DB074', '#9BBD80', '#7FA66B', '#A6C78B'], conifer: ['#5F9068', '#6E9C72'], ochre: ['#D3A35C', '#C99459'],
  wood: '#A98366', woodL: '#C9A980', lampPole: '#6E7682', lampHead: '#FFF4DA', steel: '#8D979F',
  water: '#8FBCCB', rill: '#3F5785', rillEdge: '#2B3A5C', sandPath: '#D6BE91', sandEdge: '#C2A678',
  bus: '#F6F2EA', busBand: '#5A9E97', tire: '#3A3F48', cloud: '#FFFFFF', navy: '#16233E', brand: '#A98F63'
};

/* ---------- 素材(焼き込む前。色と粗さだけを持つ) ---------- */
const MATS = new Map();
export function M(color, o = {}) {
  const k = color + '|' + (o.r ?? .9) + '|' + (o.flat ? 1 : 0) + '|' + (o.vc ? 1 : 0);
  if (!MATS.has(k)) MATS.set(k, new THREE.MeshStandardMaterial({ color, roughness: o.r ?? .9, metalness: 0, flatShading: !!o.flat, vertexColors: !!o.vc }));
  return MATS.get(k);
}
export const sh = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; return m; };
export const at = (m, x, y, z) => { m.position.set(x, y, z); return m; };
export const tag = (o, d) => { Object.assign(o.userData, d); return o; };
const RB = new Map();
export function rbox(w, h, d, r, mat) { const k = [w, h, d, r].join(); if (!RB.has(k)) RB.set(k, new RoundedBoxGeometry(w, h, d, 2, Math.min(r, Math.min(w, h, d) / 2 - .002))); return sh(new THREE.Mesh(RB.get(k), mat)); }
const BOXG = new THREE.BoxGeometry(1, 1, 1);
export function box(w, h, d, mat) { const m = sh(new THREE.Mesh(BOXG, mat)); m.scale.set(w, h, d); return m; }
export function cyl(rt, rb, h, mat, seg = 20) { return sh(new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat)); }
export function sph(r, mat, ws = 12, hs = 9) { return sh(new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), mat)); }
export function gable(w, h, d, mat) {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: .025, bevelSize: .025, bevelSegments: 1, curveSegments: 1 });
  g.translate(0, 0, -d / 2); return sh(new THREE.Mesh(g, mat));
}
/* 三角形の向きを、頂点の法線に合わせてそろえる(自分で作った形の裏表を間違えないため) */
export function autoWind(pos, nor, idx) {
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
    const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    if (nx * nor[a] + ny * nor[a + 1] + nz * nor[a + 2] < 0) { const t = idx[i + 1]; idx[i + 1] = idx[i + 2]; idx[i + 2] = t; }
  }
}
export function geo(pos, nor, idx) {
  autoWind(pos, nor, idx);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
  return g;
}
/* 円柱の一部の殻(展望台の壁)。角度は +Z を 0 として +X の側へ。y は 0..h */
export function shellGeo(r0, r1, h, a0, a1, seg = 24) {
  const pos = [], nor = [], idx = [];
  const add = (x, y, z, nx, ny, nz) => { pos.push(x, y, z); nor.push(nx, ny, nz); return pos.length / 3 - 1; };
  const ang = i => a0 + (a1 - a0) * i / seg;
  for (const [r, s] of [[r1, 1], [r0, -1]]) {
    const b0 = pos.length / 3;
    for (let i = 0; i <= seg; i++) { const t = ang(i), sx = Math.sin(t), cz = Math.cos(t); add(sx * r, 0, cz * r, sx * s, 0, cz * s); add(sx * r, h, cz * r, sx * s, 0, cz * s); }
    for (let i = 0; i < seg; i++) { const a = b0 + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  for (const [y, s] of [[h, 1], [0, -1]]) {
    const b0 = pos.length / 3;
    for (let i = 0; i <= seg; i++) { const t = ang(i), sx = Math.sin(t), cz = Math.cos(t); add(sx * r0, y, cz * r0, 0, s, 0); add(sx * r1, y, cz * r1, 0, s, 0); }
    for (let i = 0; i < seg; i++) { const a = b0 + i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  for (const [t, s] of [[a0, -1], [a1, 1]]) {
    const sx = Math.sin(t), cz = Math.cos(t), nx = cz * s, nz = -sx * s, b0 = pos.length / 3;
    add(sx * r0, 0, cz * r0, nx, 0, nz); add(sx * r1, 0, cz * r1, nx, 0, nz); add(sx * r0, h, cz * r0, nx, 0, nz); add(sx * r1, h, cz * r1, nx, 0, nz);
    idx.push(b0, b0 + 1, b0 + 2, b0 + 1, b0 + 3, b0 + 2);
  }
  return geo(pos, nor, idx);
}
export function shell(r0, r1, h, a0, a1, mat, seg) { return sh(new THREE.Mesh(shellGeo(r0, r1, h, a0, a1, seg), mat)); }
/* 平らな帯(道・小道)。pts は [x, z] の列、幅 w、高さ y、厚み th */
export function ribbon(pts, w, y, th, mat) {
  const pos = [], nor = [], idx = [], n = pts.length;
  const side = i => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; return [-dz / l, dx / l]; };
  const add = (x, yy, z, nx, ny, nz) => { pos.push(x, yy, z); nor.push(nx, ny, nz); return pos.length / 3 - 1; };
  const top = [], bot = [];
  for (let i = 0; i < n; i++) { const [sx, sz] = side(i), [x, z] = pts[i]; top.push([add(x + sx * w / 2, y + th, z + sz * w / 2, 0, 1, 0), add(x - sx * w / 2, y + th, z - sz * w / 2, 0, 1, 0)]); }
  for (let i = 0; i < n - 1; i++) { const [a, b] = top[i], [c, d] = top[i + 1]; idx.push(a, c, b, b, c, d); }
  for (const s of [1, -1]) {
    const b0 = pos.length / 3;
    for (let i = 0; i < n; i++) { const [sx, sz] = side(i), [x, z] = pts[i]; add(x + s * sx * w / 2, y, z + s * sz * w / 2, s * sx, 0, s * sz); add(x + s * sx * w / 2, y + th, z + s * sz * w / 2, s * sx, 0, s * sz); }
    for (let i = 0; i < n - 1; i++) { const a = b0 + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  void bot;
  return sh(new THREE.Mesh(geo(pos, nor, idx), mat), false);
}
/* 窓: 灯る窓(glow 1)と灯らない窓。どちらも夜には暗いガラスになり、灯る窓だけが光る。wid があれば、夜に人に合わせて点いたり消えたりする */
const WIN = M(C.glass, { r: .3 });
let WID = 1;
export function pane(g, x, y, z, sx, sy, sz, o = {}) {
  const m = new THREE.Mesh(BOXG, o.mat || WIN); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = false; m.receiveShadow = true;
  m.userData.fx = [o.glow ?? 1, 1]; if (o.flicker) m.userData.wid = WID++;
  g.add(m); return m;
}
export function grid(g, face, W, D, cy, cols, rows, dx, dy, ww, wh, o = {}) {
  const off = .012;
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const u = (o.cx || 0) + (i - (cols - 1) / 2) * dx, y = cy + (j - (rows - 1) / 2) * dy;
    if (face === 'front') pane(g, u, y, D / 2 + off, ww, wh, .03, o);
    if (face === 'back') pane(g, u, y, -D / 2 - off, ww, wh, .03, o);
    if (face === 'left') pane(g, -W / 2 - off, y, u, .03, wh, ww, o);
    if (face === 'right') pane(g, W / 2 + off, y, u, .03, wh, ww, o);
  }
}
export function tree(r, kind, s0 = 1) {
  const g = new THREE.Group(), s = (.82 + r() * .4) * s0;
  if (kind === 'cone') {
    g.add(at(cyl(.045, .065, .3, M(C.trunk), 6), 0, .15, 0));
    const col = M(C.conifer[Math.floor(r() * C.conifer.length)]);
    const c1 = sh(new THREE.Mesh(new THREE.ConeGeometry(.36, .66, 9), col)); c1.position.y = .55;
    const c2 = sh(new THREE.Mesh(new THREE.ConeGeometry(.26, .52, 9), col)); c2.position.y = .88;
    g.add(c1, c2);
  } else {
    g.add(at(cyl(.045, .07, .36, M(C.trunk), 6), 0, .18, 0));
    const pal = kind === 'ochre' ? C.ochre : C.leaf, col = M(pal[Math.floor(r() * pal.length)]);
    const a = sph(.38, col, 10, 8); a.position.y = .6; a.scale.set(1, .9, 1); g.add(a);
    if (r() > .45) { const b = sph(.25, col, 9, 7); b.position.set(.2, .78, -.08); g.add(b); }
  }
  g.scale.setScalar(s); return g;
}
export function lamp(glow = 1) {
  const g = new THREE.Group();
  g.add(at(cyl(.022, .03, .8, M(C.lampPole), 6), 0, .4, 0));
  const h = sph(.07, M(C.lampHead, { r: .6 }), 9, 7); h.position.y = .84; h.castShadow = false; h.userData.fx = [glow, 0]; g.add(h);
  return g;
}
export function bench(len = .66) {
  const g = new THREE.Group();
  g.add(at(rbox(len, .055, .2, .02, M(C.wood)), 0, .19, 0), at(rbox(len, .18, .045, .018, M(C.wood)), 0, .3, -.085));
  g.add(at(box(.035, .19, .17, M(C.lampPole)), -len * .42, .095, 0), at(box(.035, .19, .17, M(C.lampPole)), len * .42, .095, 0));
  return g;
}
export function bike(col = '#4E5A66') {
  const g = new THREE.Group(), fm = M(col, { r: .6 }), tm = M(C.tire, { r: .8 });
  for (const x of [-.17, .17]) { const w = sh(new THREE.Mesh(new THREE.TorusGeometry(.105, .016, 5, 14), tm)); w.position.set(x, .12, 0); g.add(w); }
  const bar = box(.34, .02, .02, fm); bar.position.set(0, .2, 0); g.add(bar);
  const d1 = box(.2, .02, .02, fm); d1.position.set(-.07, .16, 0); d1.rotation.z = deg(-40); g.add(d1);
  g.add(at(box(.02, .14, .02, fm), .14, .25, 0), at(box(.02, .02, .14, fm), .14, .32, 0), at(box(.09, .025, .05, M('#2F3338')), -.08, .27, 0));
  return g;
}
export { THREE };
