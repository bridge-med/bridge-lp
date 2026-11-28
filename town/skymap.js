/* ================================================================
   空の見え方(焼いた環境遮蔽)の貼り位置 — 試作(病院だけ)
   建物の形に、焼き込み用の座標 aLm を付ける。町の読み込み(world.js)と、焼く道具(tools/sky-export.mjs)が同じ関数を使うので、
   焼いた画像と町の形の貼り位置は必ず一致する(buildExterior の形が変わったら、焼き直す)。
   決め方: 三角形ごとに、向き(±x・±y・±z のいちばん近いもの)で物の中の区画に分け、区画をその向きから平らに写して、
   正方形の画像に棚詰めする。凸の部品は向きごとに重ならない。木や屋根の小物のような凹の部品は少し重なってよい(暗がりは柔らかいので目立たない)
   画像の大きさ: SIZE 四方。区画のあいだは PAD 画素あける(焼く側のにじみ出し MARGIN より広く)
   ================================================================ */
import * as THREE from 'three';

export const SKY = { SIZE: 1024, PAD: 4, MIN: 3 };
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _c = new THREE.Vector3(), _n = new THREE.Vector3(), _m = new THREE.Matrix4();

/* root の下の、町でまとめる形(world.js の collect と同じ対象)を集める */
function meshesOf(root) {
  const out = [];
  const keep = o => { for (let p = o; p && p !== root; p = p.parent) if (p.userData.keep) return true; return false; };
  root.traverse(o => { if (o.isMesh && !o.isInstancedMesh && !keep(o)) out.push(o); });
  return out;
}

/* 形ごとに区画を作る。返すのは区画の一覧(どの形の、どの三角形が、どの向きで、どの大きさか) */
function charts(meshes, inv) {
  const list = [];
  for (const o of meshes) {
    if (o.geometry.index) o.geometry = o.geometry.toNonIndexed();   // 区画の境で頂点を分ける(共有の形は、ここで形ごとの写しになる)
    else o.geometry = o.geometry.clone();
    const P = o.geometry.attributes.position, nt = P.count / 3;
    _m.multiplyMatrices(inv, o.matrixWorld);
    const W = new Float32Array(P.count * 3);
    for (let i = 0; i < P.count; i++) { _a.fromBufferAttribute(P, i).applyMatrix4(_m); W[i * 3] = _a.x; W[i * 3 + 1] = _a.y; W[i * 3 + 2] = _a.z; }
    const by = new Map();
    for (let t = 0; t < nt; t++) {
      _a.fromArray(W, t * 9); _b.fromArray(W, t * 9 + 3); _c.fromArray(W, t * 9 + 6);
      _n.subVectors(_b, _a).cross(_c.clone().sub(_a));
      const ax = Math.abs(_n.x) >= Math.abs(_n.y) && Math.abs(_n.x) >= Math.abs(_n.z) ? 0 : Math.abs(_n.y) >= Math.abs(_n.z) ? 1 : 2;
      const key = ax * 2 + (_n.getComponent(ax) < 0 ? 1 : 0);
      if (!by.has(key)) by.set(key, []); by.get(key).push(t);
    }
    for (const [key, tris] of by) {
      const ax = key >> 1, u = ax === 0 ? 2 : 0, v = ax === 1 ? 2 : 1;
      let u0 = Infinity, v0 = Infinity, u1 = -Infinity, v1 = -Infinity;
      for (const t of tris) for (let k = 0; k < 3; k++) { const p = (t * 3 + k) * 3, pu = W[p + u], pv = W[p + v]; u0 = Math.min(u0, pu); u1 = Math.max(u1, pu); v0 = Math.min(v0, pv); v1 = Math.max(v1, pv); }
      list.push({ o, W, tris, u, v, u0, v0, w: u1 - u0, h: v1 - v0 });
    }
  }
  return list;
}

/* 棚詰め。密度 d(画素 / 町の単位)で収まれば区画の位置を書き、収まらなければ false */
function pack(list, d) {
  const S = SKY.SIZE, P = SKY.PAD;
  const sz = c => [Math.max(SKY.MIN, Math.ceil(c.w * d)), Math.max(SKY.MIN, Math.ceil(c.h * d))];
  const order = list.map((c, i) => i).sort((i, j) => sz(list[j])[1] - sz(list[i])[1] || i - j);
  let x = P, y = P, row = 0;
  for (const i of order) {
    const c = list[i], [w, h] = sz(c);
    if (x + w + P > S) { x = P; y += row + P; row = 0; }
    if (y + h + P > S) return false;
    c.px = x; c.py = y; c.pw = w; c.ph = h; x += w + P; row = Math.max(row, h);
  }
  return true;
}

/* root の下の形に aLm を付ける。区画の数と密度を返す(焼く道具が記録に使う) */
export function assignSkyUV(root) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const list = charts(meshesOf(root), inv);
  let area = 0; for (const c of list) area += (c.w + .02) * (c.h + .02);
  let d = Math.sqrt(SKY.SIZE * SKY.SIZE * .7 / Math.max(area, 1e-6));
  while (!pack(list, d)) d *= .94;
  const S = SKY.SIZE, byMesh = new Map();
  for (const c of list) {
    if (!byMesh.has(c.o)) byMesh.set(c.o, new Float32Array(c.o.geometry.attributes.position.count * 2));
    const uv = byMesh.get(c.o), su = c.w > 0 ? (c.pw - 1) / c.w : 0, sv = c.h > 0 ? (c.ph - 1) / c.h : 0;
    for (const t of c.tris) for (let k = 0; k < 3; k++) {
      const i = t * 3 + k, p = i * 3;
      uv[i * 2] = (c.px + .5 + (c.W[p + c.u] - c.u0) * su) / S;
      uv[i * 2 + 1] = (c.py + .5 + (c.W[p + c.v] - c.v0) * sv) / S;
    }
  }
  for (const [o, uv] of byMesh) o.geometry.setAttribute('aLm', new THREE.BufferAttribute(uv, 2));
  return { charts: list.length, density: d };
}
