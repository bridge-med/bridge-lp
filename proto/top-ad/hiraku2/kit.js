/* ================================================================
   融合3「ひらく町」— 形を作る道具(three.js 0.160 同梱)
   形には印を付けておき、あとで素材の種類ごとに1つにまとめる(world.js の bake)
     userData.part … 0 動かない / 1 前の壁(倒れる)/ 2 屋根(持ち上がって消える)
                     + 10×n で、その上に重ねる動き(5 ドームが回る / 6・7 自動ドアの左右)
     userData.fx   … [灯り, 窓]。灯り 1=暖かい窓や街灯 2=藍の灯り 3=砂の灯り 4=白い灯り(病院・事務所) 5=ランプの灯り(図書館・アトリエ)
                     窓 1=夜は暗いガラス
     userData.wid  … 窓の番号(0 以外は、夜に人に合わせて点いたり消えたりする)。4096 × 灯り方 + 番号
                     灯り方 0 ふつう(6割が、ときどき入れ替わる) 1 規則的(病院。階ごとに決まった窓) 2 まばら(事務所) 3 ほとんど点く(図書館) 4 いつも点く
     userData.bid  … 建物の番号(グループに付ける。1 病院 2 展望台 3 クリニック 4 事務所 5 図書館 6 公園 7 アトリエ 8 広場)
     userData.surf … 地面の面(道・広場の床など)。接地の陰を、高さでは付けない
   ================================================================ */
import * as THREE from 'three';
import { RoundedBoxGeometry } from '../shared/vendor/three-0.160.0/RoundedBoxGeometry.js';

export const TAU = Math.PI * 2;
export const deg = d => d * Math.PI / 180;
export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const clamp01 = v => clamp(v, 0, 1);
export const smooth01 = v => { v = clamp01(v); return v * v * (3 - 2 * v); };
export function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

/* 町の色: 上質な建築模型(生成り・石・灰青・セージ・くすんだテラコッタ)。子どもの玩具の原色にしない。行き先の色は使わない
   主役(病院の白と青緑・広場の藍と砂)だけを少し明るく、脇役は明るさと彩度を一段落とす */
export const C = {
  // 地面と島
  grass: '#AAC18E', grass2: '#A0B683', grassEdge: '#93AD79', lawn: '#B6CA9B', lawn2: '#A7BE8B',   // 第3回: 灰色に寄らないよう、彩度を一段上げた(落ち着きは保つ)
  soil1: '#957A63', soil2: '#C9AE89', soil3: '#BDB3A4', soil4: '#A88F78', rock: '#B19F8D', rockD: '#958473',
  pave: '#D9CDB7', pave2: '#CBBEA7', joint: '#C5B8A1', curb: '#D1C7B6', walk: '#E1D8C7', road: '#BFB6A5', roadEdge: '#D3CBBC', line: '#F2EDE2',
  stoneWall: '#ADA18D', stoneWall2: '#9B8F7B', coping: '#E6DFD1',
  // 病院(主役)
  white: '#FCF8EF', white2: '#EAE4D8', trim: '#FFFCF5', hospGlass: '#7A91A2', slab: '#D8D0C2', machine: '#C9C2B6', inner: '#F2ECE1',
  scrub: '#579C95', scrubD: '#467F79',
  // 展望台と広場(ブランドの2色)
  sandTower: '#DCC9A4', sandTowerD: '#CBB690', indigo: '#2B3A5C', indigoD: '#1E2A45', navy: '#16233E', brand: '#A98F63',
  inlayI: '#6D7792', inlayS: '#C4AA80', arcI: '#2F4069', arcS: '#A98F63',
  // 脇役
  sage: '#AFBD9E', terra: '#B07763', terraL: '#C49A7E', cream: '#E6DAC4', zinc: '#B9BCB4', zincD: '#A6AAA2',
  glassWall: '#ADBEC7', slate: '#69717A', blind: '#E7E1D5', officeWall: '#CDC7BC',
  stone: '#D6CBB5', stone2: '#CBBEA6', column: '#E3DACA', verdigris: '#86A898',
  brick: '#A9776A', brickD: '#8F6458', timber: '#BFA07F', roofSlate: '#68635E', frame: '#4A4440',
  // 背景の家(くすんだテラコッタ・灰青・生成り)
  houseA: '#E3D8C5', houseB: '#D9CDB9', houseC: '#CFCBC3', roofA: '#A97C6A', roofB: '#7E8994', roofC: '#CFC3AC',
  glass: '#97AEBC', glassDark: '#62768A', door: '#5C6B7C',
  trunk: '#7B695C', leaf: ['#8EAE78', '#9BB683', '#80A26A', '#A4BE8B'], conifer: ['#5D8667', '#67916E'], ochre: ['#C1A06C', '#B79365'],
  wood: '#A88468', woodL: '#C7A982', lampPole: '#6E7682', lampHead: '#FFF4DA', steel: '#8D979F',
  water: '#8FBCCB', sandPath: '#D6BE91', sandEdge: '#C2A678',
  bus: '#F4F0E8', busBand: '#579C95', tire: '#3A3F48', cloud: '#FFFFFF', poche: '#16233E',
  // 古い名前(ほかのファイルとの互換)
  rill: '#3F5785', rillEdge: '#2B3A5C', soil: '#C6AA84'
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
/* 面取りの箱(角に細い斜めの面。44 三角形)。光が角に乗って、模型の上質さが出る */
const CB = new Map();
export function chamferGeo(w, h, d, c) {
  c = Math.min(c, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
  const k = [w, h, d, c].map(v => v.toFixed(4)).join();
  if (CB.has(k)) return CB.get(k);
  const X = w / 2, Y = h / 2, Z = d / 2, pos = [], nor = [], idx = [];
  const add = (p, n) => { pos.push(...p); nor.push(...n); return pos.length / 3 - 1; };
  const quad = (a, b, cc, dd, n) => { const i = [a, b, cc, dd].map(p => add(p, n)); idx.push(i[0], i[1], i[2], i[0], i[2], i[3]); };
  const nz = (v) => { const l = Math.hypot(...v); return v.map(x => x / l); };
  for (const s of [1, -1]) {
    quad([s * X, -(Y - c), -(Z - c)], [s * X, Y - c, -(Z - c)], [s * X, Y - c, Z - c], [s * X, -(Y - c), Z - c], [s, 0, 0]);
    quad([-(X - c), s * Y, -(Z - c)], [X - c, s * Y, -(Z - c)], [X - c, s * Y, Z - c], [-(X - c), s * Y, Z - c], [0, s, 0]);
    quad([-(X - c), -(Y - c), s * Z], [X - c, -(Y - c), s * Z], [X - c, Y - c, s * Z], [-(X - c), Y - c, s * Z], [0, 0, s]);
  }
  for (const sa of [1, -1]) for (const sb of [1, -1]) {
    quad([sa * X, sb * (Y - c), -(Z - c)], [sa * (X - c), sb * Y, -(Z - c)], [sa * (X - c), sb * Y, Z - c], [sa * X, sb * (Y - c), Z - c], nz([sa, sb, 0]));
    quad([sa * X, -(Y - c), sb * (Z - c)], [sa * (X - c), -(Y - c), sb * Z], [sa * (X - c), Y - c, sb * Z], [sa * X, Y - c, sb * (Z - c)], nz([sa, 0, sb]));
    quad([-(X - c), sa * Y, sb * (Z - c)], [-(X - c), sa * (Y - c), sb * Z], [X - c, sa * (Y - c), sb * Z], [X - c, sa * Y, sb * (Z - c)], nz([0, sa, sb]));
  }
  for (const sx of [1, -1]) for (const sy of [1, -1]) for (const sz of [1, -1]) {
    const n = nz([sx, sy, sz]); const a = add([sx * X, sy * (Y - c), sz * (Z - c)], n), b = add([sx * (X - c), sy * Y, sz * (Z - c)], n), e = add([sx * (X - c), sy * (Y - c), sz * Z], n); idx.push(a, b, e);
  }
  const g = geo(pos, nor, idx); CB.set(k, g); return g;
}
export function cbox(w, h, d, mat, c = .014) { return sh(new THREE.Mesh(chamferGeo(w, h, d, c), mat)); }
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
export function geo(pos, nor, idx, col) {
  autoWind(pos, nor, idx);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
  if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return g;
}
/* 円柱の一部の殻(展望台の壁)。角度は +Z を 0 として +X の側へ。y は 0..h */
export function shellGeo(r0, r1, h, a0, a1, seg = 24, caps = true) {
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
  if (caps) for (const [t, s] of [[a0, -1], [a1, 1]]) {
    const sx = Math.sin(t), cz = Math.cos(t), nx = cz * s, nz = -sx * s, b0 = pos.length / 3;
    add(sx * r0, 0, cz * r0, nx, 0, nz); add(sx * r1, 0, cz * r1, nx, 0, nz); add(sx * r0, h, cz * r0, nx, 0, nz); add(sx * r1, h, cz * r1, nx, 0, nz);
    idx.push(b0, b0 + 1, b0 + 2, b0 + 1, b0 + 3, b0 + 2);
  }
  return geo(pos, nor, idx);
}
export function shell(r0, r1, h, a0, a1, mat, seg, caps) { return sh(new THREE.Mesh(shellGeo(r0, r1, h, a0, a1, seg, caps), mat)); }
/* 平らな帯(道・小道)。pts は [x, z] の列、幅 w、高さ y、厚み th */
export function ribbon(pts, w, y, th, mat) {
  const pos = [], nor = [], idx = [], n = pts.length;
  const side = i => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; return [-dz / l, dx / l]; };
  const add = (x, yy, z, nx, ny, nz) => { pos.push(x, yy, z); nor.push(nx, ny, nz); return pos.length / 3 - 1; };
  const top = [];
  const Y = i => typeof y === 'function' ? y(pts[i][0], pts[i][1], i) : y;
  for (let i = 0; i < n; i++) { const [sx, sz] = side(i), [x, z] = pts[i]; top.push([add(x + sx * w / 2, Y(i) + th, z + sz * w / 2, 0, 1, 0), add(x - sx * w / 2, Y(i) + th, z - sz * w / 2, 0, 1, 0)]); }
  for (let i = 0; i < n - 1; i++) { const [a, b] = top[i], [c, d] = top[i + 1]; idx.push(a, c, b, b, c, d); }
  for (const s of [1, -1]) {
    const b0 = pos.length / 3;
    for (let i = 0; i < n; i++) { const [sx, sz] = side(i), [x, z] = pts[i]; add(x + s * sx * w / 2, Y(i) - .02, z + s * sz * w / 2, s * sx, 0, s * sz); add(x + s * sx * w / 2, Y(i) + th, z + s * sz * w / 2, s * sx, 0, s * sz); }
    for (let i = 0; i < n - 1; i++) { const a = b0 + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  return sh(new THREE.Mesh(geo(pos, nor, idx), mat), false);
}
/* 窓: 灯る窓(glow 1)と灯らない窓。どちらも夜には暗いガラスになり、灯る窓だけが光る。flicker があれば、夜に人に合わせて点いたり消えたりする
   o.mode … 灯り方(上の wid の説明)。o.frame … 窓枠(色)。o.sill … 下の水切り */
const WIN = M(C.glass, { r: .3 });
let WID = 1;
export function pane(g, x, y, z, sx, sy, sz, o = {}) {
  const m = new THREE.Mesh(BOXG, o.mat || WIN); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.castShadow = false; m.receiveShadow = true;
  m.userData.fx = [o.glow ?? 1, 1]; if (o.flicker) m.userData.wid = (o.mode || 0) * 4096 + (WID++ % 4000) + 1;
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
    if (o.frame) {   // 窓の上の小さな庇と、下の水切り(影の線が、壁に奥行きを出す)
      const fm = M(o.frame, { r: .7 }), lip = .05;
      const put = (m, px, py, pz) => { m.castShadow = false; g.add(at(m, px, py, pz)); };
      if (face === 'front') { put(box(ww + .06, .025, lip, fm), u, y + wh / 2 + .02, D / 2 + lip / 2); put(box(ww + .03, .018, lip * .7, fm), u, y - wh / 2 - .012, D / 2 + lip * .35); if (o.jambs) for (const sx of [-1, 1]) put(box(.022, wh + .02, .045, fm), u + sx * (ww / 2 + .011), y, D / 2 + .022); }
      if (face === 'back') { put(box(ww + .06, .025, lip, fm), u, y + wh / 2 + .02, -D / 2 - lip / 2); if (o.jambs) for (const sx of [-1, 1]) put(box(.022, wh + .02, .045, fm), u + sx * (ww / 2 + .011), y, -D / 2 - .022); }
      if (face === 'left') { put(box(lip, .025, ww + .06, fm), -W / 2 - lip / 2, y + wh / 2 + .02, u); if (o.jambs) for (const sx of [-1, 1]) put(box(.045, wh + .02, .022, fm), -W / 2 - .022, y, u + sx * (ww / 2 + .011)); }
      if (face === 'right') { put(box(lip, .025, ww + .06, fm), W / 2 + lip / 2, y + wh / 2 + .02, u); if (o.jambs) for (const sx of [-1, 1]) put(box(.045, wh + .02, .022, fm), W / 2 + .022, y, u + sx * (ww / 2 + .011)); }
    }
  }
}

/* ================================================================
   木: 棒付きキャンディーにしない。いくつかの塊を寄せた樹冠(下ほど暗い)、層の針葉樹、細長い並木、植え込み・生け垣
   形は種類ごとに共有し、まとめるときに頂点を写す。q = 'low' のときは塊を減らし、面も粗くする
   ================================================================ */
const BLOB = new Map(), LO = new THREE.Color(.56, .62, .62), HI = new THREE.Color(1.1, 1.08, .94);   // 樹冠の下(暗く少し青い)と上(明るく暖かい)
function blobGeo(q) {
  if (BLOB.has(q)) return BLOB.get(q);
  const g = q === 'low' ? new THREE.SphereGeometry(1, 6, 4) : new THREE.SphereGeometry(1, 8, 5);   // 約 64 三角形(なめらかな法線)
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const k = smooth01((p.getY(i) + .8) / 1.6); col.set(LO.clone().lerp(HI, k).toArray(), i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  BLOB.set(q, g); return g;
}
const TIER = new Map();
function tierGeo(q) {
  if (TIER.has(q)) return TIER.get(q);
  const g = new THREE.ConeGeometry(1, 1, q === 'low' ? 6 : 9, 1, false);
  const p = g.attributes.position, col = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const k = smooth01(p.getY(i) + .5); col.set(LO.clone().lerp(HI, k * .9).toArray(), i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  TIER.set(q, g); return g;
}
const TRUNK = new THREE.CylinderGeometry(.6, 1, 1, 6, 1); TRUNK.translate(0, .5, 0);
function trunk(g, h, r) { const t = new THREE.Mesh(TRUNK, M(C.trunk, { r: .95 })); t.scale.set(r, h, r); sh(t); g.add(t); return t; }
function blob(g, mat, x, y, z, sx, sy, sz, q) { const b = sh(new THREE.Mesh(blobGeo(q), mat)); b.position.set(x, y, z); b.scale.set(sx, sy, sz); b.rotation.y = x * 7 + z * 3; g.add(b); return b; }
export function tree(r, kind, s0 = 1, q = 'high') {
  const g = new THREE.Group(), s = (.84 + r() * .36) * s0;
  if (kind === 'cone') {
    trunk(g, .26, .05);
    const col = M(C.conifer[Math.floor(r() * C.conifer.length)], { vc: true }), n = q === 'low' ? 2 : 3;
    for (let i = 0; i < n; i++) { const k = i / n, t = sh(new THREE.Mesh(tierGeo(q), col)); const rr = .36 * (1 - k * .52), hh = .5 * (1 - k * .25); t.scale.set(rr, hh, rr); t.position.set((r() - .5) * .03, .3 + k * .44 + hh / 2, (r() - .5) * .03); t.rotation.y = r() * TAU; g.add(t); }
  } else if (kind === 'column') {
    trunk(g, .3, .04);
    const col = M(C.leaf[Math.floor(r() * C.leaf.length)], { vc: true });
    blob(g, col, 0, .62, 0, .2, .42, .2, q); if (q !== 'low') blob(g, col, .04, .9, -.02, .14, .24, .14, q);
  } else if (kind === 'shrub') {
    const col = M(C.leaf[Math.floor(r() * C.leaf.length)], { vc: true });
    blob(g, col, 0, .1, 0, .2, .14, .2, q); if (q !== 'low') { blob(g, col, .15, .08, .05, .13, .1, .13, q); blob(g, col, -.12, .07, .08, .12, .09, .12, q); }
  } else {
    // 広葉樹: 幹を少し見せ、大きな塊のまわりに小さな塊を寄せる。秋の色(ochre)は控えめに
    const h = .3 + r() * .1; trunk(g, h + .18, .045);
    const pal = kind === 'ochre' ? C.ochre : C.leaf, base = pal[Math.floor(r() * pal.length)];
    const col = M(base, { vc: true }), col2 = M(new THREE.Color(base).offsetHSL(0, -.02, -.035).getStyle(), { vc: true });
    blob(g, col, 0, h + .34, 0, .32, .28, .32, q);
    const n = q === 'low' ? 1 : 2 + Math.floor(r() * 2);
    for (let i = 0; i < n; i++) { const a = i / n * TAU + r() * .8, rr = .17 + r() * .07; blob(g, i % 2 ? col2 : col, Math.cos(a) * .2, h + .22 + r() * .2, Math.sin(a) * .2, rr, rr * .86, rr, q); }
  }
  g.scale.setScalar(s); return g;
}
/* 生け垣(角の丸い低い塊)と、並木の植桝(石の枠) */
export function hedge(len, mat, h = .16, d = .2) { const m = cbox(len, h, d, mat, .03); m.position.y = h / 2; const g = new THREE.Group(); g.add(m); return g; }
export function treePit(s = .34) {
  const g = new THREE.Group(), m = M(C.curb, { r: .85 }), t = .035;
  for (const [x, z, w, d] of [[0, s / 2, s, t], [0, -s / 2, s, t], [s / 2, 0, t, s], [-s / 2, 0, t, s]]) { const b = box(w, .035, d, m); b.position.set(x, .017, z); b.castShadow = false; g.add(b); }
  const soil = box(s - t, .012, s - t, M('#8D7B66', { r: .95 })); soil.position.y = .008; soil.castShadow = false; g.add(soil);
  return tag(g, { surf: true });
}
export function lamp(glow = 1) {
  const g = new THREE.Group();
  g.add(at(cyl(.016, .024, .8, M(C.lampPole, { r: .6 }), 6), 0, .4, 0));
  g.add(at(cyl(.05, .035, .025, M(C.lampPole, { r: .6 }), 8), 0, .84, 0));
  const h = sph(.05, M(C.lampHead, { r: .6 }), 8, 6); h.position.y = .8; h.scale.y = 1.2; h.castShadow = false; h.userData.fx = [glow, 0]; g.add(h);
  return g;
}
export function bench(len = .66) {
  const g = new THREE.Group();
  g.add(at(cbox(len, .05, .2, M(C.wood), .012), 0, .19, 0), at(cbox(len, .16, .04, M(C.wood), .01), 0, .3, -.085));
  g.add(at(box(.03, .19, .17, M(C.lampPole)), -len * .42, .095, 0), at(box(.03, .19, .17, M(C.lampPole)), len * .42, .095, 0));
  return g;
}
export function bike(col = '#4E5A66') {
  const g = new THREE.Group(), fm = M(col, { r: .6 }), tm = M(C.tire, { r: .8 });
  for (const x of [-.17, .17]) { const w = sh(new THREE.Mesh(new THREE.TorusGeometry(.105, .014, 4, 12), tm)); w.position.set(x, .12, 0); g.add(w); }
  const bar = box(.34, .02, .02, fm); bar.position.set(0, .2, 0); g.add(bar);
  const d1 = box(.2, .02, .02, fm); d1.position.set(-.07, .16, 0); d1.rotation.z = deg(-40); g.add(d1);
  g.add(at(box(.02, .14, .02, fm), .14, .25, 0), at(box(.02, .02, .14, fm), .14, .32, 0), at(box(.09, .025, .05, M('#2F3338')), -.08, .27, 0));
  return g;
}
export { THREE };
