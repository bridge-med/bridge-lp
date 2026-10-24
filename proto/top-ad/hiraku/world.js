/* ================================================================
   融合3「ひらく町」— 島の町(three.js 0.160 同梱)。hiraku.js がページの読み込みのあとに import する
   最初の画面は止めた画像(昼・夕・夜)。立体はそのあとで、同じ位置にぴったり重ねて入れ替える
   軽くするための約束(BRIEF 9.8):
     ・止まっている形は、素材の種類ごとに1つにまとめる。前の壁・屋根・ドーム・自動ドアは、まとめたまま頂点の印でシェーダーが動かす
     ・人・車・自転車・鳥・雲・湯気・波紋はインスタンス。描画は 40 回以下・三角形は 12万以下(ひらいた建物の中を足して 55 回以下)
     ・画素比はスマホ 1.5・PC 2 まで。影はスマホ 1024・PC 2048。画面の外と非表示のタブで止める。操作していないときは 30fps
   ================================================================ */
import { THREE, C, M, at, tag, box, rbox, cyl, sph, tree, lamp, bench, bike, ribbon, geo, deg, TAU, lerp, clamp, clamp01, rng } from './kit.js';
import { BOXES, WALL, PALETTE, PERSON_H, PARK, buildExterior } from './buildings.js';

/* ---------- 町の並び(島の中心から見た角度 a。45° が手前 = 画面の下、225° が奥)。建物は外を向く(病院だけは手前を向く) ---------- */
export const ISLAND_R = 8.8, ROAD_R = 7.55, ROAD_W = .9;
export const LAYOUT = {
  hospital: { bid: 1, a: 45, r: 0, face: 45 },
  observatory: { bid: 2, a: 250, r: 5.1 },
  clinic: { bid: 3, a: 345, r: 5.0 },
  office: { bid: 4, a: 295, r: 4.65 },
  library: { bid: 5, a: 160, r: 5.0 },
  park: { bid: 6, a: 45, r: 5.55 },
  atelier: { bid: 7, a: 105, r: 5.0 },
  plaza: { bid: 8, a: 45, r: 2.45 }
};
export const IDS = ['hospital', 'observatory', 'clinic', 'office', 'library', 'park', 'atelier', 'plaza'];
const BID = Object.fromEntries(IDS.map(id => [id, LAYOUT[id].bid]));
const polar = (a, r) => [Math.cos(deg(a)) * r, Math.sin(deg(a)) * r];
const yawOf = f => deg(90 - f);                 // 建物の +Z を、島の上で角度 f の向きにする

/* ================================================================
   まとめた形の素材: 頂点の印で、前の壁・屋根・ドーム・自動ドアを動かし、夜の窓と小道の灯り、選んだ建物の光、ほかの建物の色抜けを描く
   ================================================================ */
export const U = {
  uNight: { value: 0 }, uTime: { value: 0 },
  uHi: { value: -1 }, uHiAmt: { value: 0 }, uHiColor: { value: new THREE.Color('#FFE7C2') },
  uFocus: { value: -1 }, uDim: { value: 0 },
  uOpenA: { value: -1 }, uOpenB: { value: -1 }, uRoofA: { value: 1 }, uRoofB: { value: 1 },
  uLiftBid: { value: -1 }, uLift: { value: 0 },
  uPM: { value: Array.from({ length: 8 }, () => new THREE.Matrix4()) },
  uGlowW: { value: new THREE.Color('#FFB873') }, uGlowI: { value: new THREE.Color('#5D7BF0') }, uGlowS: { value: new THREE.Color('#F6C77E') }
};
const VCOMMON = `
attribute vec2 aFx; attribute float aBid; attribute float aPart; attribute float aWin;
uniform float uOpenA; uniform float uOpenB; uniform float uRoofA; uniform float uRoofB; uniform float uLiftBid; uniform float uLift;
uniform mat4 uPM[8];
varying vec2 vFx; varying float vBid; varying float vWin; varying float vCut;
mat4 hkPart(out float cut) {
  cut = 1.0;
  float an = floor(aPart / 10.0 + .01), pa = aPart - an * 10.0;
  mat4 m = mat4(1.0);
  if (an > 4.5 && an < 5.5) m = uPM[5]; else if (an > 5.5 && an < 6.5) m = uPM[6]; else if (an > 6.5) m = uPM[7];
  bool A = abs(aBid - uOpenA) < .5; bool B = abs(aBid - uOpenB) < .5;
  if (pa > .5 && pa < 1.5) { if (A) m = uPM[1] * m; else if (B) m = uPM[3] * m; }
  else if (pa > 1.5 && pa < 2.5) { if (A) { m = uPM[2] * m; cut = uRoofA; } else if (B) { m = uPM[4] * m; cut = uRoofB; } }
  return m;
}`;
const VBEGIN = `float hkC; mat4 hkM = hkPart(hkC); vec3 transformed = (hkM * vec4(position, 1.0)).xyz;
if (abs(aBid - uLiftBid) < .5) transformed.y += uLift;
vFx = aFx; vBid = aBid; vWin = aWin; vCut = hkC;`;
const FCOMMON = `
uniform float uNight; uniform float uTime; uniform float uHi; uniform float uHiAmt; uniform vec3 uHiColor;
uniform float uFocus; uniform float uDim; uniform vec3 uGlowW; uniform vec3 uGlowI; uniform vec3 uGlowS;
varying vec2 vFx; varying float vBid; varying float vWin; varying float vCut;
float hkBayer(vec2 p) { vec2 q = mod(floor(p), 4.0); float i = q.x + q.y * 4.0;
  return (i < 1.0 ? 0. : i < 2.0 ? 8. : i < 3.0 ? 2. : i < 4.0 ? 10. : i < 5.0 ? 12. : i < 6.0 ? 4. : i < 7.0 ? 14. : i < 8.0 ? 6. : i < 9.0 ? 3. : i < 10.0 ? 11. : i < 11.0 ? 1. : i < 12.0 ? 9. : i < 13.0 ? 15. : i < 14.0 ? 7. : i < 15.0 ? 13. : 5.) / 16.0 + 1.0 / 32.0; }
float hkHash(float n) { return fract(sin(n) * 43758.5453123); }`;
const TM = {};
function townMat(cls) {
  if (TM[cls]) return TM[cls];
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: { g: .3, s: .6, r: .92, f: .95 }[cls], metalness: 0, flatShading: cls === 'f' });
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\n' + VCOMMON)
      .replace('#include <beginnormal_vertex>', 'float hkC0; mat4 hkM0 = hkPart(hkC0); vec3 objectNormal = mat3(hkM0) * vec3(normal);')
      .replace('#include <begin_vertex>', VBEGIN);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\n' + FCOMMON)
      .replace('#include <clipping_planes_fragment>', 'if (vCut < .999 && hkBayer(gl_FragCoord.xy) >= vCut) discard;\n#include <clipping_planes_fragment>')
      .replace('#include <color_fragment>', `#include <color_fragment>
if (vFx.y > .5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.075, .095, .15), uNight * .82);
if (uFocus > -.5 && abs(vBid - uFocus) > .5) { float k = vBid > .5 ? uDim : uDim * .55; float l = dot(diffuseColor.rgb, vec3(.3, .59, .11)); diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(l), vec3(.93, .92, .9), .22), k); }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
float hkLit = 1.0;
if (vWin > .5) { float h = hkHash(vWin * 1.731); float cyc = floor(uTime * (.035 + h * .06) + h * 9.0); hkLit = step(.4, hkHash(vWin * 3.17 + cyc * 7.13)); }
vec3 hkG = vFx.x < 1.5 ? uGlowW : (vFx.x < 2.5 ? uGlowI : uGlowS);
totalEmissiveRadiance += hkG * step(.5, vFx.x) * hkLit * uNight * 2.3;
totalEmissiveRadiance += uHiColor * (1.0 - step(.5, abs(vBid - uHi))) * uHiAmt;`);
  };
  m.customProgramCacheKey = () => 'hk-town-' + cls;
  return (TM[cls] = m);
}
let DEPTH = null;
function depthMat() {
  if (DEPTH) return DEPTH;
  DEPTH = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  DEPTH.onBeforeCompile = s => {
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\n' + VCOMMON).replace('#include <begin_vertex>', VBEGIN);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\n' + FCOMMON)
      .replace('#include <clipping_planes_fragment>', 'if (vCut < .999 && hkBayer(gl_FragCoord.xy) >= vCut) discard;\n#include <clipping_planes_fragment>');
  };
  DEPTH.customProgramCacheKey = () => 'hk-depth';
  return DEPTH;
}

/* ---------- まとめる ---------- */
const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _v = new THREE.Vector3();
function inherit(o, root, key, dflt) { for (let p = o; p && p !== root; p = p.parent) if (p.userData[key] !== undefined) return p.userData[key]; return dflt; }
function mergeItems(items, inv) {
  let nv = 0, ni = 0;
  for (const { o } of items) { const g = o.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), fxa = new Float32Array(nv * 2), bid = new Float32Array(nv), part = new Float32Array(nv), win = new Float32Array(nv), idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (const it of items) {
    const o = it.o, g = o.geometry, P = g.attributes.position, N = g.attributes.normal, Cc = g.attributes.color, c = o.material.color;
    _m.multiplyMatrices(inv, o.matrixWorld); _n.getNormalMatrix(_m);
    const vc = o.material.vertexColors && Cc;
    for (let i = 0; i < P.count; i++) {
      const k = vo + i;
      _v.fromBufferAttribute(P, i).applyMatrix4(_m); pos[k * 3] = _v.x; pos[k * 3 + 1] = _v.y; pos[k * 3 + 2] = _v.z;
      if (N) { _v.fromBufferAttribute(N, i).applyMatrix3(_n).normalize(); nor[k * 3] = _v.x; nor[k * 3 + 1] = _v.y; nor[k * 3 + 2] = _v.z; }
      col[k * 3] = c.r * (vc ? Cc.getX(i) : 1); col[k * 3 + 1] = c.g * (vc ? Cc.getY(i) : 1); col[k * 3 + 2] = c.b * (vc ? Cc.getZ(i) : 1);
      fxa[k * 2] = it.fx[0]; fxa[k * 2 + 1] = it.fx[1]; bid[k] = it.bid; part[k] = it.part; win[k] = it.wid;
    }
    if (g.index) { const I = g.index.array; for (let j = 0; j < I.length; j++) idx[io + j] = I[j] + vo; io += I.length; }
    else { for (let j = 0; j < P.count; j++) idx[io + j] = vo + j; io += P.count; }
    vo += P.count;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setAttribute('aFx', new THREE.BufferAttribute(fxa, 2)); out.setAttribute('aBid', new THREE.BufferAttribute(bid, 1)); out.setAttribute('aPart', new THREE.BufferAttribute(part, 1)); out.setAttribute('aWin', new THREE.BufferAttribute(win, 1));
  out.setIndex(new THREE.BufferAttribute(idx, 1)); out.computeBoundingSphere();
  return out;
}
function collect(root) {
  const items = [];
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep || inherit(o, root, 'keep', false)) return;
    items.push({ o, bid: inherit(o, root, 'bid', 0), part: inherit(o, root, 'part', 0), fx: o.userData.fx || [0, 0], wid: o.userData.wid || 0 });
  });
  return items;
}
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
    if (mesh.castShadow) mesh.customDepthMaterial = depthMat();
    root.add(mesh); out.push(mesh);
  }
  return out;
}
/* 動く小さなまとまりを、頂点の色の1つの形にする(バス・車・自転車) */
function bakeGeo(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), items = collect(group);
  return mergeItems(items, inv);
}
const vcMat = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: o.r ?? .75, metalness: 0, transparent: !!o.transparent, opacity: o.opacity ?? 1, depthWrite: o.transparent ? false : true });

/* ================================================================
   島
   ================================================================ */
function island(g, rnd) {
  const top = sh(new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R - .3, ISLAND_R - .3, .6, 96), M(C.grass)), false); top.position.y = -.3; g.add(top);
  const edge = sh(new THREE.Mesh(new THREE.TorusGeometry(ISLAND_R - .3, .3, 10, 96), M(C.grassEdge))); edge.rotation.x = -Math.PI / 2; edge.position.y = -.3; g.add(edge);
  const soil = sh(new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R - .28, ISLAND_R - .72, 1.1, 72, 1), M(C.soil1)), false); soil.position.y = -1.13; g.add(soil);
  const soil2 = sh(new THREE.Mesh(new THREE.CylinderGeometry(ISLAND_R - .72, ISLAND_R - 1.2, .5, 72), M(C.soil2)), false); soil2.position.y = -1.93; g.add(soil2);
  const cone = new THREE.ConeGeometry(ISLAND_R - 1.85, 5.8, 14, 7, true);
  cone.rotateX(Math.PI); cone.translate(0, -2.15 - 2.9, 0);
  const cp = cone.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), y = cp.getY(i), z = cp.getZ(i), rad = Math.hypot(x, z);
    if (y > -2.2) continue;
    const a = Math.atan2(z, x), depth = clamp01((-y - 2.2) / 5.8);
    const k = 1 + Math.sin(a * 3 + y * .8) * .13 * depth + Math.sin(a * 7 - y * 1.7) * .08 + (depth > .45 ? Math.sin(a * 2 + 1) * .18 * depth : 0);
    cp.setX(i, x * k + Math.sin(y * .6) * .5 * depth); cp.setZ(i, z * k + Math.cos(y * .5) * .35 * depth); cp.setY(i, y + (rad > .1 ? Math.sin(a * 5 + y) * .3 : 0));
  }
  const ng = cone.toNonIndexed(); ng.computeVertexNormals();
  const cols = new Float32Array(ng.attributes.position.count * 3), cr = new THREE.Color(C.rock), tmp = new THREE.Color();
  for (let f = 0; f < ng.attributes.position.count; f += 3) {
    const y = (ng.attributes.position.getY(f) + ng.attributes.position.getY(f + 1) + ng.attributes.position.getY(f + 2)) / 3;
    tmp.copy(cr).offsetHSL(0, (rnd() - .5) * .03, (rnd() - .5) * .07 + clamp01((-y - 2.3) / 7) * -.09);
    for (let k = 0; k < 3; k++) cols.set([tmp.r, tmp.g, tmp.b], (f + k) * 3);
  }
  ng.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  g.add(sh(new THREE.Mesh(ng, M('#FFFFFF', { flat: true, vc: true, r: .95 })), false));
  // 環状の道(車道と、内と外の歩道)、白い破線
  const ring = (r0, r1, mat, y) => { const m = sh(new THREE.Mesh(new THREE.RingGeometry(r0, r1, 120), mat), false); m.rotation.x = -Math.PI / 2; m.position.y = y; g.add(m); return m; };
  ring(ROAD_R - ROAD_W / 2, ROAD_R + ROAD_W / 2, M(C.road), .02);
  ring(ROAD_R - ROAD_W / 2 - .26, ROAD_R - ROAD_W / 2, M(C.walk), .035);
  ring(ROAD_R + ROAD_W / 2, ROAD_R + ROAD_W / 2 + .22, M(C.walk), .035);
  for (let i = 0; i < 48; i++) { const a = i / 48 * TAU, d = box(.24, .008, .05, M(C.line)); d.castShadow = false; d.position.set(Math.cos(a) * ROAD_R, .026, Math.sin(a) * ROAD_R); d.rotation.y = -a + Math.PI / 2; g.add(d); }
}
const sh = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; return m; };

/* 小道(島の中の歩く道)。中心の広場から、建物の間を通って環状の歩道へ */
function paths(g) {
  const w = M(C.walk);
  for (const a of [15, 75, 135, 205, 272, 322]) {
    const r0 = a === 15 || a === 75 ? 3.9 : 2.2, r1 = ROAD_R - ROAD_W / 2 - .2, len = r1 - r0, mid = r0 + len / 2, [x, z] = polar(a, mid);
    const p = rbox(.55, .04, len, .02, w); p.castShadow = false; p.position.set(x, .02, z); p.rotation.y = Math.atan2(Math.cos(deg(a)), Math.sin(deg(a))); g.add(p);
  }
  // 病院の救急の車寄せへの道(車が入る)
  const [ex, ez] = polar(322, 5.1), er = rbox(.82, .03, 4.2, .02, M(C.road)); er.castShadow = false; er.position.set(ex, .015, ez); er.rotation.y = Math.atan2(Math.cos(deg(322)), Math.sin(deg(322))); g.add(er);
}

/* ---------- 広場とブランドの印: 藍の水の小道と、砂の小道が交差する(砂の小道は小さな橋で渡り、つながらない)。夜は藍と砂に灯る ---------- */
const LOGO = { I: [[8, 74], [62, 16], [118, 24], [176, 84]], S: [[58, 94], [118, 60], [158, 22], [232, 12]] };
function bez(P, t) { const u = 1 - t; return [u * u * u * P[0][0] + 3 * u * u * t * P[1][0] + 3 * u * t * t * P[2][0] + t * t * t * P[3][0], u * u * u * P[0][1] + 3 * u * u * t * P[1][1] + 3 * u * t * t * P[2][1] + t * t * t * P[3][1]]; }
export function plazaFrame() {
  const L = LAYOUT.plaza, [cx, cz] = polar(L.a, L.r);
  const right = [Math.cos(deg(L.a - 90)), Math.sin(deg(L.a - 90))], down = [Math.cos(deg(L.a)), Math.sin(deg(L.a))];
  const s = 4.7 / 240;
  const map = ([u, v]) => { const px = (u - 120) * s, pz = (v - 55) * s; return [cx + right[0] * px + down[0] * pz, cz + right[1] * px + down[1] * pz]; };
  return { cx, cz, map, s };
}
function plaza(g) {
  const pg = tag(new THREE.Group(), { bid: BID.plaza }); g.add(pg);
  const { cx, cz, map } = plazaFrame();
  const disc = sh(new THREE.Mesh(new THREE.CylinderGeometry(2.45, 2.5, .05, 72), M(C.pave)), false); disc.position.set(cx, .025, cz); pg.add(disc);
  const rim = sh(new THREE.Mesh(new THREE.TorusGeometry(2.47, .05, 6, 72), M(C.curb)), false); rim.rotation.x = -Math.PI / 2; rim.position.set(cx, .05, cz); pg.add(rim);
  // 2本の線(ロゴの曲線)を島の上に写す
  const N = 64, I = [], S = [];
  for (let i = 0; i <= N; i++) { I.push(map(bez(LOGO.I, i / N))); S.push(map(bez(LOGO.S, i / N))); }
  // 交わる所(砂の小道が、藍の水の小道を橋で渡る)
  let best = { d: 1e9, i: 0, j: 0 };
  for (let i = 0; i <= N; i++) for (let j = 0; j <= N; j++) { const d = Math.hypot(I[i][0] - S[j][0], I[i][1] - S[j][1]); if (d < best.d) best = { d, i, j }; }
  const X = S[best.j];
  // 藍: 水の小道(縁は藍の石、水面は藍がかった水)
  pg.add(ribbon(I, .46, .045, .014, M(C.rillEdge, { r: .7 })));
  pg.add(ribbon(I, .28, .05, .014, M(C.rill, { r: .25 })));
  // 砂: 歩く小道。交わる所で持ち上がって、小さな橋になる
  const S3 = S.map(([x, z]) => { const d = Math.hypot(x - X[0], z - X[1]); const k = d < .42 ? Math.cos(d / .42 * Math.PI / 2) ** 2 : 0; return [x, z, .05 + k * .2]; });
  pg.add(ribbon3(S3, .42, .024, M(C.sandPath)));
  pg.add(ribbon3(S3.map(([x, z, y]) => [x, z, y - .006]), .5, .018, M(C.sandEdge)));
  // 橋の手すり
  const jA = Math.max(0, best.j - 4), jB = Math.min(N, best.j + 4), dir = [S[jB][0] - S[jA][0], S[jB][1] - S[jA][1]], dl = Math.hypot(dir[0], dir[1]), nx = -dir[1] / dl, nz = dir[0] / dl;
  for (const s of [1, -1]) { const rail = box(dl * .9, .035, .025, M(C.trim)); rail.position.set(X[0] + nx * .24 * s, .38, X[1] + nz * .24 * s); rail.rotation.y = -Math.atan2(dir[1], dir[0]); pg.add(rail); for (const k of [-.4, 0, .4]) { const post = box(.025, .14, .025, M(C.trim)); post.position.set(X[0] + nx * .24 * s + dir[0] / dl * dl * k * .9, .31 - Math.abs(k) * .12, X[1] + nz * .24 * s + dir[1] / dl * dl * k * .9); pg.add(post); } }
  // 灯り: 藍の水の小道には藍の灯り、砂の小道には砂の灯り(夜に灯る)
  for (let i = 3; i < N; i += 6) { const [x, z] = I[i]; const l = cyl(.035, .035, .03, M('#DDE3F2', { r: .5 }), 8); l.position.set(x, .066, z); l.userData.fx = [2, 0]; l.castShadow = false; pg.add(l); }
  for (let j = 4; j < N; j += 6) { if (Math.abs(j - best.j) < 4) continue; const [x, z] = S[j]; const b = cyl(.028, .032, .14, M('#F3E6CC', { r: .5 }), 8); b.position.set(x + nx * .26, .12, z + nz * .26); b.userData.fx = [3, 0]; b.castShadow = false; pg.add(b); }
  // まわりのベンチ
  for (const a of [150, 210, 270, 330]) { const bn = bench(.6), r = 2.2; bn.position.set(cx + Math.cos(deg(a + 45)) * r, .05, cz + Math.sin(deg(a + 45)) * r); bn.rotation.y = -deg(a + 45) - Math.PI / 2; pg.add(bn); }
  return { I, S, X };
}
function ribbon3(pts, w, th, mat) {
  const pos = [], nor = [], idx = [], n = pts.length, add = (x, y, z, a, b, c) => { pos.push(x, y, z); nor.push(a, b, c); return pos.length / 3 - 1; };
  const side = i => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)]; const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1; return [-dz / l, dx / l]; };
  const T = [];
  for (let i = 0; i < n; i++) { const [sx, sz] = side(i), [x, z, y] = pts[i]; T.push([add(x + sx * w / 2, y + th, z + sz * w / 2, 0, 1, 0), add(x - sx * w / 2, y + th, z - sz * w / 2, 0, 1, 0)]); }
  for (let i = 0; i < n - 1; i++) { const [a, b] = T[i], [c, d] = T[i + 1]; idx.push(a, c, b, b, c, d); }
  for (const s of [1, -1]) { const b0 = pos.length / 3; for (let i = 0; i < n; i++) { const [sx, sz] = side(i), [x, z, y] = pts[i]; add(x + s * sx * w / 2, y - .02, z + s * sz * w / 2, s * sx, 0, s * sz); add(x + s * sx * w / 2, y + th, z + s * sz * w / 2, s * sx, 0, s * sz); } for (let i = 0; i < n - 1; i++) { const a = b0 + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); } }
  return sh(new THREE.Mesh(geo(pos, nor, idx), mat), false);
}

/* ---------- 小さな家(町らしさのため。ふれない) と、木・街灯・バス停 ---------- */
function house(rnd, wallCol, roofCol) {
  const g = new THREE.Group(), w = .9 + rnd() * .3, d = .8, h = .62;
  g.add(at(rbox(w, h, d, .03, M(wallCol)), 0, h / 2, 0));
  const rf = gable2(w + .14, .42, d + .14, M(roofCol, { r: .85 })); rf.position.y = h; g.add(rf);
  const win = M(C.glass, { r: .3 });
  for (const x of [-w * .25, w * .25]) { const p = box(.18, .2, .02, win); p.position.set(x, .38, d / 2 + .01); p.userData.fx = [1, 1]; p.userData.wid = 900 + Math.floor(rnd() * 99); p.castShadow = false; g.add(p); }
  g.add(at(box(.16, .3, .02, M(C.door)), 0, .15, d / 2 + .012));
  return g;
}
function gable2(w, h, d, mat) {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0);
  const gg = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false }); gg.translate(0, 0, -d / 2); return sh(new THREE.Mesh(gg, mat));
}
function busStop() {
  const g = new THREE.Group();
  g.add(at(rbox(.8, .04, .34, .015, M(C.trim)), 0, .62, 0));
  g.add(at(box(.8, .5, .02, M(C.glass, { r: .3 })), 0, .34, -.15));
  for (const x of [-.38, .38]) g.add(at(cyl(.016, .016, .62, M(C.steel, { r: .5 }), 6), x, .31, -.14));
  g.add(at(box(.6, .05, .14, M(C.wood)), 0, .2, -.06));
  g.add(at(cyl(.014, .014, .8, M(C.steel, { r: .5 }), 6), .55, .4, .1), at(box(.16, .16, .02, M('#EDE6D6')), .55, .78, .1));
  return g;
}

/* ================================================================
   人(インスタンス): 体と頭の2つ。顔は描かない。スクラブ(青緑・藍)・白衣・事務服・普段着
   ================================================================ */
function personGeos() {
  const H = PERSON_H;
  const pts = [[0, 0], [.055, 0], [.06, .1], [.064, .2], [.075, .25], [.082, .3], [.07, .34], [.04, .355], [0, .36]].map(([x, y]) => new THREE.Vector2(x * H / .44, y * H / .44));
  const body = new THREE.LatheGeometry(pts, 9);
  const head = new THREE.SphereGeometry(.052 * H / .44, 9, 7); head.translate(0, .405 * H / .44, 0);
  // 髪(頭の上の半分を暗くする。顔は描かない)
  const hc = new Float32Array(head.attributes.position.count * 3);
  for (let i = 0; i < head.attributes.position.count; i++) { const y = head.attributes.position.getY(i) - .405 * H / .44, z = head.attributes.position.getZ(i); const hair = y > -.004 || (z < -.01 && y > -.03); hc.set(hair ? [.32, .27, .24] : [1, 1, 1], i * 3); }
  head.setAttribute('color', new THREE.BufferAttribute(hc, 3));
  return { body, head };
}
const CLOTH = { scrubT: '#4E9993', scrubI: '#33446A', coat: '#F3F1EB', officeG: '#5A646E', officeN: '#2F3B4E', c1: '#C79B87', c2: '#8FB1D1', c3: '#D7C7AC', c4: '#6F8A6A', c5: '#B07F5F', c6: '#E8E2D6' };

/* ================================================================
   シーン(live と capture で共通)
   ================================================================ */
export function makeScene(opts = {}) {
  const only = opts.only || null;
  const scene = new THREE.Scene(), world = new THREE.Group(); scene.add(world);
  const rnd = rng(101), signs = [], B = {}, anchors = {};
  const dyn = { bus: null, cars: null, hcar: null, bikes: null, birds: null, clouds: null, steam: null, ripples: null, capsule: null, people: null };
  if (!only) { island(world, rnd); paths(world); }
  // 建物
  for (const id of IDS) {
    if (only && id !== only) continue;
    if (id === 'plaza') continue;
    const L = LAYOUT[id], ex = buildExterior(id, signs), [x, z] = only ? [0, 0] : polar(L.a, L.r), face = L.face ?? L.a;
    const grp = tag(ex.g, { bid: L.bid });
    grp.position.set(x, ex.y0, z); grp.rotation.y = only ? 0 : yawOf(face);
    world.add(grp);
    const anchor = new THREE.Object3D(); anchor.position.copy(grp.position); anchor.rotation.copy(grp.rotation); world.add(anchor);
    B[id] = { id, L, ex, grp, anchor, face, bid: L.bid, box: BOXES[id] };
    anchors[id] = anchor;
  }
  let plazaInfo = null;
  if (!only || only === 'plaza') plazaInfo = plaza(world);
  if (!only) {
    // 町の小さな家・木・街灯・バス停
    const houses = [[205, 5.7, C.houseA, C.roofA], [228, 6.6, C.houseB, C.roofB], [130, 6.7, C.houseA, C.roofB], [20, 6.5, C.houseB, C.roofA]];
    for (const [a, r, wc, rc] of houses) { const h = house(rnd, wc, rc), [x, z] = polar(a, r); h.position.set(x, 0, z); h.rotation.y = yawOf(a); world.add(h); }
    const avoid = [...Object.values(LAYOUT).map(L => L.a)];
    for (let i = 0; i < 46; i++) {
      const a = i / 46 * 360 + rnd() * 4, rr = ISLAND_R - .55 - rnd() * .25;
      if (i % 4 === 3) continue;
      const k = rnd() < .2 ? 'cone' : rnd() < .16 ? 'ochre' : 'round';
      const t = tree(rnd, k, .8 + rnd() * .3), [x, z] = polar(a, rr); t.position.set(x, 0, z); t.rotation.y = rnd() * TAU; world.add(t);
    }
    for (const [a, r, k] of [[190, 3.4, 'round'], [240, 3.2, 'cone'], [275, 3.6, 'round'], [110, 3.0, 'round'], [345, 3.2, 'ochre'], [175, 6.6, 'round'], [262, 6.9, 'round'], [312, 6.4, 'cone'], [60, 7.0, 'round'], [5, 6.6, 'round'], [150, 3.6, 'cone']]) { const t = tree(rnd, k, .9), [x, z] = polar(a, r); t.position.set(x, 0, z); world.add(t); }
    void avoid;
    for (let i = 0; i < 10; i++) { const a = i * 36 + 18, l = lamp(1), [x, z] = polar(a, ROAD_R - ROAD_W / 2 - .13); l.position.set(x, .03, z); world.add(l); }
    for (const [a, r] of [[80, ROAD_R - ROAD_W / 2 - .45], [230, ROAD_R - ROAD_W / 2 - .45]]) { const s = busStop(), [x, z] = polar(a, r); s.position.set(x, .03, z); s.rotation.y = yawOf(a + 180); world.add(s); }
    dyn.stops = [deg(80), deg(230)];
  }

  // 文字のある小さな札(「診療中」と BRIDGE のマーク)。1枚の絵にまとめて、1回で描く
  const atlas = signAtlas();
  for (const s of signs) {
    const b = Object.values(B).find(v => v.bid === s.bid); if (!b) continue;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), atlas.mat); m.userData.keep = true; m.userData.sign = s;
    const uv = atlas.uv[s.key], a = m.geometry.attributes.uv;
    for (let i = 0; i < a.count; i++) a.setXY(i, uv[0] + a.getX(i) * (uv[2] - uv[0]), uv[1] + a.getY(i) * (uv[3] - uv[1]));
    m.position.set(...s.pos); b.grp.add(m); s.mesh = m; s.b = b;
  }

  // 人と乗り物
  if (!only) people(world, dyn, rnd, B, plazaInfo);
  if (!only) vehicles(world, dyn, B);
  if (!only) sky(scene, world, dyn, rnd);
  steamAndWater(world, dyn, B, only);

  // まとめる
  const baked = bakeStatic(world);
  return { scene, world, B, anchors, dyn, signs, baked, plazaInfo };
}

function signAtlas() {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
  const x = cv.getContext('2d');
  // 「診療中」(白地に墨の字、細い縁)
  x.fillStyle = '#FBF8F1'; x.fillRect(0, 0, 256, 128); x.strokeStyle = '#3A4047'; x.lineWidth = 6; x.strokeRect(6, 6, 244, 116);
  x.fillStyle = '#22272B'; x.font = '700 60px "BIZ UDPGothic", "Hiragino Sans", sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('診療中', 128, 68);
  // BRIDGE のマーク(藍の地に、白と砂の二本の線)
  x.fillStyle = '#16233E'; x.fillRect(256, 0, 256, 128);
  x.save(); x.translate(256 + 22, 10); x.scale(.88, .88);
  x.lineWidth = 9; x.lineCap = 'round';
  x.strokeStyle = '#F4EFE6'; x.beginPath(); x.moveTo(8, 74); x.bezierCurveTo(62, 16, 118, 24, 176, 84); x.stroke();
  x.strokeStyle = '#C8AD7E'; x.beginPath(); x.moveTo(58, 94); x.bezierCurveTo(118, 60, 158, 22, 232, 12); x.stroke();
  x.restore();
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: .7, metalness: 0 });
  return { mat, uv: { shinryo: [0, 0, .5, 1], bridge: [.5, 0, 1, 1] } };
}

/* ---------- 人 ---------- */
function people(world, dyn, rnd, B, plazaInfo) {
  const { body, head } = personGeos();
  const N = 42;
  const bodyM = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ roughness: .85 }), N);
  const headM = new THREE.InstancedMesh(head, new THREE.MeshStandardMaterial({ roughness: .8, vertexColors: true }), N);
  for (const m of [bodyM, headM]) { m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false; world.add(m); }
  const skins = ['#EECFB8', '#E0BB9B', '#CBA282'], col = new THREE.Color();
  const P = [];
  const doorOf = id => { const b = B[id]; if (!b) return null; const [dx, dz] = b.ex.door; const v = new THREE.Vector3(dx, 0, dz).applyEuler(b.grp.rotation).add(b.grp.position); v.y = 0; return v; };
  // 歩く道: 内の歩道の輪(右回り・左回り)、広場のまわり
  const ringR = ROAD_R - ROAD_W / 2 - .13;
  const kinds = [];
  for (let i = 0; i < 16; i++) kinds.push({ k: 'ring', r: ringR + (i % 2 ? .05 : -.05), dir: i % 3 ? 1 : -1, ph: rnd() * TAU, sp: .045 + rnd() * .025 });
  const { cx, cz } = plazaFrame();
  for (let i = 0; i < 6; i++) kinds.push({ k: 'plaza', c: [cx, cz], r: 1.55 + rnd() * .35, dir: i % 2 ? 1 : -1, ph: rnd() * TAU, sp: .09 + rnd() * .05 });
  // 建物に出入りする人(扉の前で消え、扉から現れる)
  for (const id of ['hospital', 'clinic', 'office', 'library', 'atelier', 'hospital', 'observatory']) { const d = doorOf(id); if (d) kinds.push({ k: 'door', id, door: d, ph: rnd() * 30, per: 18 + rnd() * 12 }); }
  // 立ち話(2人ずつ)とベンチ
  const pairs = [[cx + 1.2, cz - 1.3], [polar(15, 6.4)[0], polar(15, 6.4)[1]], [polar(200, 4.4)[0], polar(200, 4.4)[1]]];
  for (const [x, z] of pairs) for (const s of [-1, 1]) kinds.push({ k: 'chat', p: new THREE.Vector3(x + s * .13, 0, z), face: s > 0 ? -Math.PI / 2 : Math.PI / 2, ph: rnd() * TAU });
  // 図書館の階段を上る人
  if (B.library) kinds.push({ k: 'stairs', id: 'library', ph: rnd() * 10 });
  // 病院の外で車いすを押す人・ベンチの人
  kinds.push({ k: 'sit', p: new THREE.Vector3(...plazaSeat(cx, cz, 150)), face: 0 });
  kinds.push({ k: 'sit', p: new THREE.Vector3(...plazaSeat(cx, cz, 270)), face: 0 });
  while (kinds.length > N) kinds.pop();
  // 服の色
  const outfits = ['scrubT', 'scrubI', 'coat', 'scrubT', 'officeG', 'c1', 'c2', 'officeN', 'c3', 'c4', 'scrubI', 'c5', 'coat', 'c6', 'c2', 'c3'];
  kinds.forEach((k, i) => {
    let o = outfits[i % outfits.length];
    if (k.k === 'door' && k.id === 'hospital') o = i % 2 ? 'scrubT' : 'coat';
    if (k.k === 'door' && k.id === 'office') o = 'officeN';
    bodyM.setColorAt(i, col.set(CLOTH[o])); headM.setColorAt(i, col.set(skins[i % 3]));
    P.push(Object.assign(k, { i, pos: new THREE.Vector3(), yaw: 0, s: 1 }));
  });
  for (let i = kinds.length; i < N; i++) { bodyM.setColorAt(i, col.set('#FFFFFF')); headM.setColorAt(i, col.set('#FFFFFF')); }
  bodyM.count = headM.count = kinds.length;
  dyn.people = { bodyM, headM, P, B };
}
function plazaSeat(cx, cz, a) { const r = 2.2; return [cx + Math.cos(deg(a + 45)) * r, .12, cz + Math.sin(deg(a + 45)) * r]; }
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _s = new THREE.Vector3(), _mt = new THREE.Matrix4(), _p = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
export function placePeople(dyn, t, blocked) {
  const D = dyn.people; if (!D) return;
  for (const p of D.P) {
    let x = 0, z = 0, y = 0, yaw = 0, s = 1, bob = 0;
    if (p.k === 'ring') {
      const a = p.ph + t * p.sp * p.dir; x = Math.cos(a) * p.r; z = Math.sin(a) * p.r; yaw = -a + (p.dir > 0 ? 0 : Math.PI); bob = Math.abs(Math.sin(t * 7 + p.i)) * .012;
    } else if (p.k === 'plaza') {
      const a = p.ph + t * p.sp * p.dir; x = p.c[0] + Math.cos(a) * p.r; z = p.c[1] + Math.sin(a) * p.r; yaw = -a + (p.dir > 0 ? 0 : Math.PI); bob = Math.abs(Math.sin(t * 7 + p.i)) * .012;
    } else if (p.k === 'door') {
      // 扉から出て、少し歩いて、戻って入る(扉の前で消える)
      const u = ((t + p.ph) % p.per) / p.per, d = p.door, out = new THREE.Vector3(d.x, 0, d.z).normalize();
      const far = 1.5, walk = u < .45 ? u / .45 : u < .55 ? 1 : u < 1 ? 1 - (u - .55) / .45 : 0;
      const side = new THREE.Vector3(-out.z, 0, out.x);
      x = d.x + out.x * far * walk + side.x * Math.sin(walk * 3) * .25; z = d.z + out.z * far * walk + side.z * Math.sin(walk * 3) * .25;
      yaw = Math.atan2(out.x, out.z) + (u < .5 ? 0 : Math.PI);
      s = u < .04 ? u / .04 : u > .96 ? (1 - u) / .04 : 1; bob = Math.abs(Math.sin(t * 7 + p.i)) * .012;
    } else if (p.k === 'chat') {
      x = p.p.x; z = p.p.z; yaw = p.face + Math.sin(t * .9 + p.ph) * .15; bob = Math.sin(t * 2 + p.ph) * .004;
    } else if (p.k === 'sit') {
      x = p.p.x; z = p.p.z; y = .05; s = .82;
    } else if (p.k === 'stairs') {
      const b = D.B[p.k === 'stairs' ? p.id : 'library']; const u = ((t + p.ph) % 14) / 14;
      const v = new THREE.Vector3(0, 0, 0); const zf = BOXES.library.d / 2 + WALL + 1.1, zt = BOXES.library.d / 2 + WALL + .3;
      const k = u < .6 ? u / .6 : 1; v.set(.35, -.22 + k * .22, lerp(zf, zt, k)).applyEuler(b.grp.rotation).add(b.grp.position);
      x = v.x; z = v.z; y = v.y + .02 - b.ex.y0 + .22; yaw = b.grp.rotation.y + Math.PI; s = u > .9 ? (1 - u) / .1 : u < .05 ? u / .05 : 1; bob = Math.abs(Math.sin(t * 7)) * .01;
    }
    if (blocked && blocked(x, z)) { y += WALL; }
    _p.set(x, y + bob, z); _q.setFromAxisAngle(_up, yaw); _s.set(s, s, s); _mt.compose(_p, _q, _s);
    D.bodyM.setMatrixAt(p.i, _mt); D.headM.setMatrixAt(p.i, _mt);
  }
  D.bodyM.instanceMatrix.needsUpdate = true; D.headM.instanceMatrix.needsUpdate = true;
}

/* ---------- 乗り物: 環状道路のバス(バス停で止まる)・車・自転車、病院の車寄せに出入りする白い車(青緑の線) ---------- */
function carGroup(body, stripe) {
  const g = new THREE.Group();
  g.add(at(rbox(.62, .18, .3, .05, M(body, { r: .5 })), 0, .14, 0));
  g.add(at(rbox(.36, .14, .27, .05, M(body, { r: .5 })), -.04, .28, 0));
  const gl = M('#4E5D6C', { r: .3 }); g.add(at(box(.3, .1, .275, gl), -.04, .28, 0), at(box(.02, .09, .25, gl), .14, .28, 0));
  if (stripe) g.add(at(box(.63, .035, .305, M(stripe, { r: .6 })), 0, .15, 0));
  for (const [x, z] of [[-.2, -.15], [.2, -.15], [-.2, .15], [.2, .15]]) { const w = cyl(.065, .065, .05, M(C.tire), 10); w.rotation.x = Math.PI / 2; w.position.set(x, .065, z); g.add(w); }
  return g;
}
function vehicles(world, dyn, B) {
  // バス
  const bg = new THREE.Group();
  bg.add(at(rbox(1.15, .38, .42, .07, M(C.bus, { r: .5 })), 0, .27, 0));
  bg.add(at(box(1.16, .06, .425, M(C.busBand, { r: .6 })), 0, .2, 0));
  bg.add(at(box(.96, .13, .43, M('#4E5D6C', { r: .3 })), -.02, .37, 0), at(box(.02, .17, .38, M('#4E5D6C', { r: .3 })), .575, .33, 0));
  for (const [x, z] of [[-.36, -.2], [.36, -.2], [-.36, .2], [.36, .2]]) { const w = cyl(.08, .08, .06, M(C.tire), 10); w.rotation.x = Math.PI / 2; w.position.set(x, .08, z); bg.add(w); }
  const bus = new THREE.Mesh(bakeGeo(bg), vcMat({ r: .6 })); bus.castShadow = true; bus.receiveShadow = true; world.add(bus);
  dyn.bus = { mesh: bus, a: deg(100), v: 0 };
  // 車(3台・色違い)
  const cg = new THREE.InstancedMesh(bakeGeo(carGroup('#FFFFFF')), vcMat({ r: .55 }), 3); cg.castShadow = true; cg.frustumCulled = false; world.add(cg);
  ['#E9E4DA', '#9DAE9A', '#C9B28C'].forEach((c, i) => cg.setColorAt(i, new THREE.Color(c)));
  dyn.cars = { mesh: cg, list: [{ a: deg(10), sp: .085, lane: -1 }, { a: deg(190), sp: .07, lane: 1 }, { a: deg(300), sp: .09, lane: -1 }] };
  // 病院の白い車(青緑の線。赤十字は使わない)
  const hc = new THREE.Mesh(bakeGeo(carGroup('#F7F6F2', C.scrub)), vcMat({ r: .5 })); hc.castShadow = true; world.add(hc);
  const b = B.hospital, erL = new THREE.Vector3(b.ex.er[0], 0, b.ex.er[1]).applyEuler(b.grp.rotation).add(b.grp.position);
  dyn.hcar = { mesh: hc, stop: erL };
  // 自転車(2台・乗る人つき)
  const bk = new THREE.InstancedMesh(bakeGeo(bike('#56606A')), vcMat({ r: .6 }), 2); bk.castShadow = true; bk.frustumCulled = false; world.add(bk);
  const rider = personGeos();
  const rd = new THREE.InstancedMesh(rider.body, new THREE.MeshStandardMaterial({ roughness: .85 }), 2), rh = new THREE.InstancedMesh(rider.head, new THREE.MeshStandardMaterial({ roughness: .8, vertexColors: true }), 2);
  for (const m of [rd, rh]) { m.castShadow = true; m.frustumCulled = false; world.add(m); }
  rd.setColorAt(0, new THREE.Color(CLOTH.c2)); rd.setColorAt(1, new THREE.Color(CLOTH.scrubT)); rh.setColorAt(0, new THREE.Color('#E0BB9B')); rh.setColorAt(1, new THREE.Color('#EECFB8'));
  dyn.bikes = { mesh: bk, rd, rh, list: [{ a: deg(60), sp: .055 }, { a: deg(250), sp: -.05 }] };
}
const STOP_DWELL = 2.6;
export function placeVehicles(dyn, t, dt, blockedAng) {
  if (!dyn.bus) return;
  const y0 = .02;
  // バス: 外の車線を左回り。バス停の前でゆっくり止まって、また出る。ひらいた建物の倒れた壁の手前では待つ
  const bus = dyn.bus, R = ROAD_R + .2;
  let want = .11;
  for (const s of dyn.stops) { const d = angDiff(s, bus.a); if (d > 0 && d < .2) want = Math.min(want, .11 * clamp01(d / .2) + .004); }
  if (bus.wait > 0) { bus.wait -= dt; want = 0; } else for (const s of dyn.stops) if (Math.abs(angDiff(s, bus.a)) < .006 && !bus.stopped) { bus.wait = STOP_DWELL; bus.stopped = s; }
  if (bus.stopped !== undefined && bus.stopped !== null && Math.abs(angDiff(bus.stopped, bus.a)) > .05) bus.stopped = null;
  if (blockedAng !== null) { const d = angDiff(blockedAng - .26, bus.a); if (d > 0 && d < .3) want = Math.min(want, .11 * clamp01((d - .02) / .28)); }
  bus.v += (want - bus.v) * clamp01(dt * 2.2); bus.a += bus.v * dt;
  placeOnRing(bus.mesh, bus.a, R, y0, 1);
  // 車
  const cars = dyn.cars;
  cars.list.forEach((c, i) => {
    let sp = c.sp;
    if (blockedAng !== null) { const d = c.lane < 0 ? angDiff(blockedAng - .26, c.a) : angDiff(c.a, blockedAng + .26); if (d > 0 && d < .3) sp *= clamp01((d - .02) / .28); }
    c.v = (c.v ?? sp) + (sp - (c.v ?? sp)) * clamp01(dt * 2); c.a += c.v * dt * (c.lane < 0 ? 1 : -1);
    const m = new THREE.Object3D(); placeOnRing(m, c.a, ROAD_R + (c.lane < 0 ? .2 : -.2), y0, c.lane < 0 ? 1 : -1); m.updateMatrix(); cars.mesh.setMatrixAt(i, m.matrix);
  });
  cars.mesh.instanceMatrix.needsUpdate = true;
  // 病院の車: 環状道路から車寄せへ入り、止まり、また出る(28秒でひとまわり)
  const hc = dyn.hcar, u = (t % 28) / 28, stop = hc.stop, ent = new THREE.Vector3(...[Math.cos(deg(322)) * (ROAD_R - .1), 0, Math.sin(deg(322)) * (ROAD_R - .1)]);
  let p, yaw;
  if (u < .3) { const k = smooth(u / .3); p = ent.clone().lerp(stop, k); yaw = Math.atan2(stop.x - ent.x, stop.z - ent.z) - Math.PI / 2; }
  else if (u < .55) { p = stop.clone(); yaw = Math.atan2(stop.x - ent.x, stop.z - ent.z) - Math.PI / 2; }
  else if (u < .85) { const k = smooth((u - .55) / .3); p = stop.clone().lerp(ent, k); yaw = Math.atan2(ent.x - stop.x, ent.z - stop.z) - Math.PI / 2; }
  else { p = ent.clone(); p.y = -3; yaw = 0; }
  hc.mesh.position.set(p.x, (p.y || 0) + y0, p.z); hc.mesh.rotation.set(0, yaw, 0);
  hc.mesh.visible = u < .85;
  // 自転車(内の歩道のそと側)
  const bk = dyn.bikes;
  bk.list.forEach((b, i) => {
    b.a += b.sp * dt;
    const m = new THREE.Object3D(); placeOnRing(m, b.a, ROAD_R - ROAD_W / 2 + .1, y0, Math.sign(b.sp)); m.updateMatrix(); bk.mesh.setMatrixAt(i, m.matrix);
    m.position.y += .14; m.updateMatrix(); bk.rd.setMatrixAt(i, m.matrix); bk.rh.setMatrixAt(i, m.matrix);
  });
  bk.mesh.instanceMatrix.needsUpdate = bk.rd.instanceMatrix.needsUpdate = bk.rh.instanceMatrix.needsUpdate = true;
}
function placeOnRing(o, a, r, y, dir) { o.position.set(Math.cos(a) * r, y, Math.sin(a) * r); o.rotation.set(0, -a + (dir > 0 ? Math.PI : 0), 0); }
export const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };
const smooth = k => k * k * (3 - 2 * k);

/* ---------- 空: 雲と、ときどき鳥の群れ ---------- */
function sky(scene, world, dyn, rnd) {
  const sg = new THREE.SphereGeometry(1, 12, 9), N = 12;
  const cm = new THREE.InstancedMesh(sg, new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 1, emissive: '#FFFFFF', emissiveIntensity: .42 }), N);
  cm.frustumCulled = false; scene.add(cm);
  const clouds = [];
  for (let c = 0; c < 3; c++) { const base = { a: deg(196 + c * 34 + rnd() * 10), r: 10.8 + rnd() * 1.2, y: 3.9 + rnd() * 1.0, sp: .004 + rnd() * .003, puffs: [] }; for (let k = 0; k < 4; k++) base.puffs.push([(k - 1.5) * .7 + rnd() * .2, rnd() * .25, (rnd() - .5) * .5, .55 + rnd() * .45]); clouds.push(base); }
  dyn.clouds = { mesh: cm, list: clouds };
  // 鳥(V の形。翼を羽ばたかせる)
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .05, -.22, .03, -.05, 0, 0, -.06, 0, 0, .05, .22, .03, -.05, 0, 0, -.06], 3)); bg.computeVertexNormals();
  const bm = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ color: '#4A4F5A', side: THREE.DoubleSide }), 7); bm.frustumCulled = false; scene.add(bm);
  dyn.birds = { mesh: bm, t0: 4, n: 7 };
}
export function placeSky(dyn, t, night) {
  const C2 = dyn.clouds; if (!C2) return;
  let i = 0; const o = new THREE.Object3D();
  for (const c of C2.list) { const a = deg(190) + ((c.a - deg(190) + t * c.sp) % deg(110)), cx = Math.cos(a) * c.r, cz = Math.sin(a) * c.r; for (const [px, py, pz, s] of c.puffs) { o.position.set(cx + px * .8, c.y + py, cz + pz); o.scale.set(s * .8, s * .5, s * .66); o.updateMatrix(); C2.mesh.setMatrixAt(i++, o.matrix); } }
  C2.mesh.instanceMatrix.needsUpdate = true;
  C2.mesh.material.emissiveIntensity = lerp(.42, .03, night); C2.mesh.material.color.set(night > .5 ? '#7E87B8' : '#FFFFFF');
  // 鳥: 26 秒ごとに、島の上を横切る
  const Bd = dyn.birds, u = ((t - Bd.t0) % 26) / 26;
  for (let k = 0; k < Bd.n; k++) {
    const fly = u < .45, s = fly ? 1 : 0, lead = u / .45, off = k * .035;
    const x = lerp(-15, 15, lead - off) , z = lerp(-9, 6, lead - off) + Math.sin(k * 2.1) * .6, y = 6.2 + Math.sin(lead * 6 + k) * .25 + (k % 2) * .25;
    o.position.set(x, y, z); o.rotation.set(0, Math.atan2(15 * 2, 15) - Math.PI / 2, 0); const flap = Math.sin(t * 10 + k) * .5 + .7; o.scale.set(s * 1.1, s * flap, s * 1.1); o.updateMatrix(); Bd.mesh.setMatrixAt(k, o.matrix);
  }
  Bd.mesh.instanceMatrix.needsUpdate = true;
}

/* ---------- アトリエの煙突の湯気・公園の噴水とふたつの波紋・ガチャのカプセル ---------- */
function steamAndWater(world, dyn, B, only) {
  if (B.atelier) {
    const st = new THREE.InstancedMesh(new THREE.SphereGeometry(.08, 8, 6), new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 1, transparent: true, opacity: .55, depthWrite: false, emissive: '#FFFFFF', emissiveIntensity: .25 }), 6);
    st.frustumCulled = false; world.add(st);
    const s = B.atelier.ex.emit.steam, src = new THREE.Vector3(...s).applyEuler(B.atelier.grp.rotation).add(B.atelier.grp.position);
    dyn.steam = { mesh: st, src, n: 6 };
  }
  void only;
}
export function placeSmall(dyn, t, steamOn) {
  const o = new THREE.Object3D();
  if (dyn.steam) {
    const S = dyn.steam;
    for (let i = 0; i < S.n; i++) { const u = ((t * .32 + i / S.n) % 1); o.position.set(S.src.x + Math.sin(u * 5 + i) * .05 + u * .12, S.src.y + u * .7, S.src.z - u * .05); const s = steamOn ? (.4 + u * 1.3) * (1 - u) * 1.6 : 0; o.scale.setScalar(s); o.updateMatrix(); S.mesh.setMatrixAt(i, o.matrix); }
    S.mesh.instanceMatrix.needsUpdate = true;
  }
  if (dyn.ripples) {
    const R = dyn.ripples, c = new THREE.Color();
    for (let i = 0; i < 2; i++) { const u = (t * .28 + i * .5) % 1; o.position.set(R.c.x + (i ? .18 : -.18), R.c.y, R.c.z + (i ? .08 : -.08)); o.scale.setScalar(.06 + u * .42); o.updateMatrix(); R.mesh.setMatrixAt(i, o.matrix); R.mesh.setColorAt(i, c.setScalar(1 - u * .9)); }
    R.mesh.instanceMatrix.needsUpdate = true; if (R.mesh.instanceColor) R.mesh.instanceColor.needsUpdate = true;
  }
  if (dyn.capsule) {
    const K = dyn.capsule, u = (t % 17) / 17;
    if (u < .22) { const k = u / .22, e = 1 - (1 - k) * (1 - k); K.mesh.position.copy(K.g0).lerp(K.g1, e); K.mesh.position.y += Math.abs(Math.sin(k * 9)) * .03 * (1 - k); K.mesh.rotation.z = -k * 12; K.mesh.visible = true; }
    else if (u < .5) { K.mesh.position.copy(K.g1); K.mesh.visible = true; } else K.mesh.visible = false;
  }
}

/* ================================================================
   光(昼・夕・夜)。m は 0 昼 / 1 夕 / 2 夜 のあいだをなめらかに動く
   ================================================================ */
const TOD = [
  { hemiS: '#EDF3F8', hemiG: '#CDBB9F', hemi: 1.18, sun: '#FFF3E2', sunI: 2.45, sunPos: [-2.5, 15, 12.5], fill: '#DCE7F4', fillI: .6, exp: 1.07, glow: 0, pt: 0 },
  { hemiS: '#F3D3C0', hemiG: '#9A7F70', hemi: .82, sun: '#FFAE7A', sunI: 2.0, sunPos: [-15, 5.5, 3], fill: '#B4AEDF', fillI: .5, exp: .98, glow: .55, pt: .35 },
  { hemiS: '#64729F', hemiG: '#302D48', hemi: .86, sun: '#B9C7F2', sunI: 1.0, sunPos: [-5, 14, 9], fill: '#7684C6', fillI: .34, exp: 1.06, glow: 1, pt: 1 }   // 夜: 手前の左上から月明かり。形と屋根の色が読めるように
];
const _c1 = new THREE.Color(), _c2 = new THREE.Color();
export function makeLights(scene, mapSize) {
  const hemi = new THREE.HemisphereLight('#fff', '#888', 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff', 2); sun.castShadow = true; sun.shadow.mapSize.set(mapSize, mapSize);
  const sc = sun.shadow.camera; sc.left = -11.5; sc.right = 11.5; sc.top = 11.5; sc.bottom = -11.5; sc.near = 1; sc.far = 60;
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .02; scene.add(sun); scene.add(sun.target);
  const fill = new THREE.DirectionalLight('#fff', .5); fill.position.set(10, 6, -8); scene.add(fill);
  // 夜の灯り: 広場の藍と砂、病院の入口、ひらいた建物の中(強さは 0 から)
  const { cx, cz, map } = plazaFrame();
  const pI = new THREE.PointLight('#6F86F2', 0, 4.2, 1.6), pS = new THREE.PointLight('#F5C27E', 0, 4.2, 1.6), pH = new THREE.PointLight('#FFC88A', 0, 4.5, 1.6), pIn = new THREE.PointLight('#FFE2B8', 0, 5, 1.4);
  const [ix, iz] = map([60, 40]), [sx, sz] = map([190, 40]);
  pI.position.set(ix, .9, iz); pS.position.set(sx, .9, sz); pH.position.set(cx * .4, 1.4, cz * .4); pIn.position.set(0, -5, 0);
  for (const p of [pI, pS, pH, pIn]) scene.add(p);
  return { hemi, sun, fill, pI, pS, pH, pIn };
}
export function applyTod(L, renderer, m, clouds) {
  const i = Math.min(1, Math.floor(m)), k = m - i, a = TOD[i], b = TOD[Math.min(2, i + 1)];
  L.hemi.color.copy(_c1.set(a.hemiS)).lerp(_c2.set(b.hemiS), k); L.hemi.groundColor.copy(_c1.set(a.hemiG)).lerp(_c2.set(b.hemiG), k); L.hemi.intensity = lerp(a.hemi, b.hemi, k);
  L.sun.color.copy(_c1.set(a.sun)).lerp(_c2.set(b.sun), k); L.sun.intensity = lerp(a.sunI, b.sunI, k);
  L.sun.position.set(lerp(a.sunPos[0], b.sunPos[0], k), lerp(a.sunPos[1], b.sunPos[1], k), lerp(a.sunPos[2], b.sunPos[2], k));
  L.fill.color.copy(_c1.set(a.fill)).lerp(_c2.set(b.fill), k); L.fill.intensity = lerp(a.fillI, b.fillI, k);
  renderer.toneMappingExposure = lerp(a.exp, b.exp, k);
  const glow = lerp(a.glow, b.glow, k), pt = lerp(a.pt, b.pt, k);
  U.uNight.value = glow;
  L.pI.intensity = 7 * pt; L.pS.intensity = 7 * pt; L.pH.intensity = L.pH.userData.base = 5 * pt;
  void clouds;
  return glow;
}

/* ---------- カメラ(正投影・斜め上から) ---------- */
export const ELEV = deg(31), AZ = deg(45), DIST = 80;
export function aimCamera(cam, target, elev = ELEV) {
  cam.position.set(target.x + DIST * Math.cos(elev) * Math.cos(AZ), target.y + DIST * Math.sin(elev), target.z + DIST * Math.cos(elev) * Math.sin(AZ));
  cam.up.set(0, 1, 0); cam.lookAt(target); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
}
export function samplePoints() {
  const pts = [];
  for (let i = 0; i < 48; i++) { const a = i / 48 * TAU; pts.push(new THREE.Vector3(Math.cos(a) * (ISLAND_R + .1), .6, Math.sin(a) * (ISLAND_R + .1)), new THREE.Vector3(Math.cos(a) * (ISLAND_R + .1), -1.1, Math.sin(a) * (ISLAND_R + .1))); }
  const [ox, oz] = polar(LAYOUT.observatory.a, LAYOUT.observatory.r);
  pts.push(new THREE.Vector3(ox, 6.2, oz), new THREE.Vector3(.3, -7.9, .2));
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
export const CAP_W = 1600, CAP_H = 1440;
export function capFrame(cam) { aimCamera(cam, new THREE.Vector3()); return fit(cam, samplePoints(), CAP_W, CAP_H, { x0: CAP_W * .02, x1: CAP_W * .98, y0: CAP_H * .03, y1: CAP_H * .97 }); }
export function makeRenderer(canvas, dpr, W, H, preserve) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!preserve });
  r.setPixelRatio(dpr); r.setSize(W, H, false); r.setClearColor(0x000000, 0);
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  return r;
}
export { THREE, PALETTE };
