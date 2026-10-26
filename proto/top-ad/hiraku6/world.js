/* ================================================================
   融合3「ひらく町」— 島の町(three.js 0.160 同梱)。hiraku.js がページの読み込みのあとに import する
   最初の画面は止めた画像(昼・夕・夜)。立体はそのあとで、同じ位置にぴったり重ねて入れ替える
   目標の見た目: 子どもの玩具ではなく、上質なプレゼン用の建築模型を、柔らかい午後の光で撮った写真(BRIEF 10.2)
     主役 = 病院(台地の上・いちばん明るい白と青緑)と、ランドマーク「交差の広場」(藍と砂の2本の弧。交差するが接続しない)
     準主役 = 展望台(縦のシルエットと灯室)/ 脇役 = ほかの建物(形で違いを出し、明るさと彩度を一段落とす)/ 背景 = 家と木
   軽くするための約束(BRIEF 9.8):
     ・止まっている形は、素材の種類ごとに1つにまとめる。前の壁・屋根・ドーム・自動ドアは、まとめたまま頂点の印でシェーダーが動かす
     ・人・車・自転車・鳥・雲・湯気はインスタンス。描画は 40 回以下・三角形は 12万以下(ひらいた建物の中を足して 55 回以下)
     ・接地の陰(AO)は、まとめるときに頂点の色へ焼き込む(読み込みのときの追加の計算は数十 ms)
     ・品質の段: makeScene({ quality: 'high' | 'mid' | 'low' })。low は木を簡略にし、影を落とす物を減らす。映り込み(PMREM)は high だけ
   ================================================================ */
import { THREE, C, M, at, tag, box, cbox, rbox, cyl, sph, tree, hedge, treePit, lamp, bench, bike, ribbon, geo, deg, TAU, lerp, clamp, clamp01, smooth01, rng } from './kit.js';
import { BOXES, WALL, PALETTE, PERSON_H, PARK, buildExterior } from './buildings.js';

/* ---------- 町の並び ----------
   島の角度 a(45° が手前 = 画面の下、225° が奥、135° が左、315° が右)と、中心からの距離 r。face は建物の正面の向き(省くと外向き)
   台地(少し高い段)に病院と交差の広場がのり、そのまわりの一段低い町並みに、ほかの建物がある */
export const ISLAND_R = 9.0, ROAD_R = 7.45, ROAD_W = .56, PLATEAU_H = .46;
export const LAYOUT = {
  hospital: { bid: 1, a: 225, r: 1.45, face: 45 },
  observatory: { bid: 2, a: 253, r: 5.55 },
  clinic: { bid: 3, a: 359, r: 5.9 },
  office: { bid: 4, a: 280, r: 6.0, face: 340 },
  library: { bid: 5, a: 137, r: 5.5, face: 100 },
  park: { bid: 6, a: 323, r: 5.35 },
  atelier: { bid: 7, a: 92, r: 6.0 },
  plaza: { bid: 8, a: 45, r: 3.35 }
};
export const IDS = ['hospital', 'observatory', 'clinic', 'office', 'library', 'park', 'atelier', 'plaza'];
const BID = Object.fromEntries(IDS.map(id => [id, LAYOUT[id].bid]));
const polar = (a, r) => [Math.cos(deg(a)) * r, Math.sin(deg(a)) * r];
const yawOf = f => deg(90 - f);                 // 建物の +Z を、島の上で角度 f の向きにする
const R2 = Math.SQRT1_2;
/* 画面に合わせた座標(s = 画面の右、f = 手前)と、島の x, z の行き来 */
const SF = (s, f) => [(s + f) * R2, (f - s) * R2];
const toSF = (x, z) => [(x - z) * R2, (x + z) * R2];
export const angDiff = (a, b) => { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; };

/* ---------- 島の輪郭(完全な円でなく、ゆるい入り江と岬) ---------- */
const BUMPS = [[300, .72, 17], [326, -.42, 9], [8, -.62, 11], [45, .5, 15], [102, -.6, 12], [142, .6, 15], [172, .3, 18], [232, -.32, 20], [205, .16, 12], [268, .25, 13]];
export function islandR(a) {
  let r = ISLAND_R + .07 * Math.sin(a * 7 + .4) + .05 * Math.sin(a * 11 + 1.3);
  for (let i = 0; i < BUMPS.length; i++) { const B = BUMPS[i], d = angDiff(a, deg(B[0])) / deg(B[2]); r += B[1] * Math.exp(-d * d); }   // 毎こま呼ばれる(人の足もと)。分割代入で物を作らない
  return r;
}
/* 縁の一段低い段(手前右・公園の側)。島の角度 a で、縁から内へ LEDGE.w の幅が LEDGE.d だけ低い */
const LEDGE = { a0: 333, a1: 22, soft: 6, w: 1.0, d: .48, step: .16 };
function ledgeW(a) { let d = ((a / Math.PI * 180) % 360 + 360) % 360; const lo = LEDGE.a0, hi = LEDGE.a1 + 360; if (d < 180) d += 360; return smooth01((d - lo) / LEDGE.soft) * smooth01((hi - d) / LEDGE.soft); }
function ledgeDrop(a, r, R) { const w = ledgeW(a); if (w <= 0) return 0; return LEDGE.d * w * smooth01((r - (R - LEDGE.w)) / LEDGE.step); }
/* ---------- 台地(病院と広場がのる、少し高い段)。符号付きの距離(負 = 台地の上) ---------- */
function sdRBox(s, f, cs, cf, hs, hf, r) { const qx = Math.abs(s - cs) - hs + r, qy = Math.abs(f - cf) - hf + r, mx = qx > 0 ? qx : 0, my = qy > 0 ? qy : 0; return Math.sqrt(mx * mx + my * my) + Math.min(Math.max(qx, qy), 0) - r; }
function smin(a, b, k) { const h = clamp01(.5 + .5 * (b - a) / k); return lerp(b, a, h) - k * h * (1 - h); }
const plateauSF = (s, f) => smin(sdRBox(s, f, .6, -1.45, 3.0, 1.75, .7), sdRBox(s, f, 0, 2.55, 3.0, 2.55, 1.35), .6);
export function plateauSD(x, z) { const [s, f] = toSF(x, z); return plateauSF(s, f); }
/* 段をつなぐ所(階段と、車の坂)。s, f は台地の縁の外の端、dir は下りる向き(s, f)、w は幅、len は長さ */
const STAIRS = [
  { s: 0, f: 5.1, dir: [0, 1], w: 2.0, len: .8 },          // 広場の正面 → 一段低い町と、バス停へ
  { s: -3.0, f: 2.3, dir: [-1, 0], w: .8, len: .55 },      // 左 → アトリエ・図書館
  { s: 3.6, f: -2.0, dir: [1, 0], w: .7, len: .55 },       // 右 → 事務所・公園
  { s: -.6, f: -3.15, dir: [0, -1], w: .8, len: .55 }      // 奥 → 家並み・展望台
];
const RAMP = { a: [1.9, 3.95], b: [2.62, 5.45], w: .58 };  // 救急の車の坂(台地の右前)
const _IR = { along: 0, across: 0, inside: false };   // 作業用(groundY は毎こま人ごとに呼ばれる。新しい物を作らない)
function inRect(s, f, st) { const dx = st.dir[0], dz = st.dir[1], px = s - st.s, pf = f - st.f, along = px * dx + pf * dz, across = -px * dz + pf * dx; _IR.along = along; _IR.across = across; _IR.inside = along > -.25 && along < st.len && Math.abs(across) < st.w / 2; return _IR; }
function rampK(s, f) {
  const ax = RAMP.a[0], af = RAMP.a[1], bx = RAMP.b[0], bf = RAMP.b[1], dx = bx - ax, df = bf - af, L2 = dx * dx + df * df, u = ((s - ax) * dx + (f - af) * df) / L2;
  if (u < -.05 || u > 1.05) return -1; const px = ax + dx * u - s, pf = af + df * u - f, rw = RAMP.w / 2 + .04; if (px * px + pf * pf > rw * rw) return -1; return clamp01(u);
}
/* 地面の高さ(人・車・接地の陰に使う) */
const nearPlateau = (x, z) => { const s = (x - z) * R2, f = (x + z) * R2; return !(s < -4.2 || s > 4.8 || f < -4.4 || f > 6.6); };
export function groundY(x, z) {
  const s = (x - z) * R2, f = (x + z) * R2;
  if (s < -4.2 || s > 4.8 || f < -4.4 || f > 6.6) { const r2 = x * x + z * z; if (r2 < 60) return 0; const a = Math.atan2(z, x); return -ledgeDrop(a, Math.sqrt(r2), islandR(a)); }
  const d = plateauSF(s, f);
  if (d < -.02) return PLATEAU_H;
  for (let i = 0; i < STAIRS.length; i++) { const st = STAIRS[i], q = inRect(s, f, st); if (q.inside) return PLATEAU_H * (1 - smooth01(q.along / st.len)); }
  const rk = rampK(s, f); if (rk >= 0) return PLATEAU_H * (1 - rk);
  return d < 0 ? PLATEAU_H : 0;
}

/* ================================================================
   まとめた形の素材: 頂点の印で、前の壁・屋根・ドーム・自動ドアを動かし、夜の窓と小道の灯り、選んだ建物の光、ほかの建物の色抜けを描く
   ================================================================ */
export const U = {
  uNight: { value: 0 }, uTime: { value: 0 },
  uHi: { value: -1 }, uHiAmt: { value: 0 }, uHiColor: { value: new THREE.Color('#FFE7C2') },
  uFocus: { value: -1 }, uDim: { value: 0 },
  uAir: { value: 0 }, uMainInv: { value: new THREE.Matrix4() }, uMainB: { value: new THREE.Vector2(0, 0) },   // v6: 病院に着いたとき、主棟(uFocus の建物の uMainB の内側)のほかを、光の計算のあとでその時刻の空気(uHazeC)へ溶かす割合(建物 .45・地面 .25)。最初の画面は 0
  uOpenA: { value: -1 }, uOpenB: { value: -1 }, uRoofA: { value: 1 }, uRoofB: { value: 1 },
  uLiftBid: { value: -1 }, uLift: { value: 0 },
  uPM: { value: Array.from({ length: 8 }, () => new THREE.Matrix4()) },
  uGlowW: { value: new THREE.Color('#FFB873') }, uGlowI: { value: new THREE.Color('#9DB2FF') }, uGlowS: { value: new THREE.Color('#FFC77A') },
  uGlowC: { value: new THREE.Color('#E4ECF7') }, uGlowL: { value: new THREE.Color('#FFC27A') }, uGlowK: { value: new THREE.Color('#FFF0D2') },
  uHazeC: { value: new THREE.Color('#FFFFFF') }, uHazeK: { value: .8 },   // 岩の先が下へ行くほど溶ける、もやの色と強さ。placeSky が時間帯で変える
  uGroundCut: { value: -1e4 },   // 案A: ひらいた建物の前の壁を、この高さ(世界の y)より下は描かない(倒れた壁を広場の面の下へ沈める。町ではいつも描く)
  uArcFade: { value: 0 },        // 案A: 広場の弧(藍と砂)を点描で消す割合(0 = 描く、1 = 消す)。病院に寄ると、ひらいた病院の1階に掛からないように
  // 交差の広場の時刻ごとの表情(applyTod が決める): uArc = 弧と床の帯が灯る強さ(夜だけ)、uRim = 夕方の低い光(砂の弧の縁が金、藍の弧は影絵)
  uArc: { value: 0 }, uRim: { value: 0 }, uGlowR: { value: new THREE.Color('#FFC46E') },
  // 藍の弧の夕方の縁(空の藤色を拾う、冷たい細い縁。砂の弧の金の縁と対)と、昼に床のロゴの帯を目地の濃さへ寄せる強さ(昼は影がロゴを描くので、弧を主役に)
  uGlowV: { value: new THREE.Color('#B7AEEA') }, uDay: { value: 1 }, uJoint: { value: new THREE.Color(C.joint) }
};
const VCOMMON = `
attribute vec2 aFx; attribute float aBid; attribute float aPart; attribute float aWin;
uniform float uOpenA; uniform float uOpenB; uniform float uRoofA; uniform float uRoofB; uniform float uLiftBid; uniform float uLift;
uniform mat4 uPM[8];
varying vec2 vFx; varying float vBid; varying float vWin; varying float vCut; varying float vHkY; varying vec3 vHkW;
mat4 hkPart(out float cut) {
  cut = 1.0;
  float an = floor(aPart / 10.0 + .01), pa = aPart - an * 10.0;
  mat4 m = mat4(1.0);
  if (an > 4.5 && an < 5.5) m = uPM[5]; else if (an > 5.5 && an < 6.5) m = uPM[6]; else if (an > 6.5) m = uPM[7];
  bool A = abs(aBid - uOpenA) < .5; bool B = abs(aBid - uOpenB) < .5;
  if (pa > .5 && pa < 1.5) { if (A) { m = uPM[1] * m; cut = 2.0; } else if (B) m = uPM[3] * m; }   // 2.0: ひらいた建物の前の壁の印(地面より下を描かない。点描の消え方はしない)
  else if (pa > 1.5 && pa < 2.5) { if (A) { m = uPM[2] * m; cut = uRoofA; } else if (B) { m = uPM[4] * m; cut = uRoofB; } }
  return m;
}`;
const VBEGIN = `float hkC; mat4 hkM = hkPart(hkC); vec3 transformed = (hkM * vec4(position, 1.0)).xyz;
if (abs(aBid - uLiftBid) < .5) transformed.y += uLift;
vFx = aFx; vBid = aBid; vWin = aWin; vCut = hkC; vHkW = (modelMatrix * vec4(transformed, 1.0)).xyz; vHkY = vHkW.y;`;
const FCOMMON = `
uniform float uNight; uniform float uTime; uniform float uHi; uniform float uHiAmt; uniform vec3 uHiColor;
uniform float uGroundCut; uniform float uArcFade; uniform float uAir; uniform mat4 uMainInv; uniform vec2 uMainB;
uniform float uFocus; uniform float uDim; uniform vec3 uGlowW; uniform vec3 uGlowI; uniform vec3 uGlowS; uniform vec3 uGlowC; uniform vec3 uGlowL; uniform vec3 uGlowK; uniform vec3 uHazeC; uniform float uHazeK; uniform float uArc; uniform float uRim; uniform vec3 uGlowR; uniform vec3 uGlowV; uniform float uDay; uniform vec3 uJoint;
varying vec2 vFx; varying float vBid; varying float vWin; varying float vCut; varying float vHkY; varying vec3 vHkW;
float hkBayer(vec2 p) { vec2 q = mod(floor(p), 4.0); float i = q.x + q.y * 4.0;
  return (i < 1.0 ? 0. : i < 2.0 ? 8. : i < 3.0 ? 2. : i < 4.0 ? 10. : i < 5.0 ? 12. : i < 6.0 ? 4. : i < 7.0 ? 14. : i < 8.0 ? 6. : i < 9.0 ? 3. : i < 10.0 ? 11. : i < 11.0 ? 1. : i < 12.0 ? 9. : i < 13.0 ? 15. : i < 14.0 ? 7. : i < 15.0 ? 13. : 5.) / 16.0 + 1.0 / 32.0; }
float hkHash(float n) { return fract(sin(n) * 43758.5453123); }`;
/* 夜の窓: 建物ごとに違う灯り方(wid = 4096 × 灯り方 + 番号)
   0 ふつう(6割が、ときどき入れ替わる)/ 1 規則的(病院: 白く、決まった窓が点く)/ 2 まばら(事務所)/ 3 ほとんど点く(図書館)/ 4 いつも点く */
const FWIN = `
float hkLit = 1.0;
if (vWin > .5) {
  float wv = floor(vWin + .5), md = floor(wv / 4096.0 + .001), id = wv - md * 4096.0, h = hkHash(id * 1.731);   // 補間のわずかな誤差で、1枚の窓が三角形ごとに点いたり消えたりしないよう、整数に丸める
  if (md < .5) { float cyc = floor(uTime * (.035 + h * .06) + h * 9.0); hkLit = step(.4, hkHash(id * 3.17 + cyc * 7.13)); }
  else if (md < 1.5) { hkLit = step(.3, h); }
  else if (md < 2.5) { float cyc = floor(uTime * (.02 + h * .03) + h * 5.0); hkLit = step(.72, hkHash(id * 5.31 + cyc * 3.7)) * .34; }
  else if (md < 3.5) { hkLit = step(.12, h); }
}
float gk = vFx.x, gq = abs(gk - 10.0) < .5 ? 3.0 : abs(gk - 11.0) < .5 ? 2.0 : gk;   // 弧の縁(砂 10・藍 11)は、夜はそれぞれの弧と同じに灯る
vec3 hkG = gq < 1.5 ? uGlowW : gq < 2.5 ? uGlowI : gq < 3.5 ? uGlowS : gq < 4.5 ? uGlowC : gq < 5.5 ? uGlowL : gq < 6.5 ? uGlowK : gq < 7.5 ? uGlowI : uGlowS;
float gi = gq < 1.5 ? 1.9 : gq < 3.5 ? 1.15 : gq < 4.5 ? .95 : gq < 5.5 ? 1.6 : gq < 6.5 ? 1.3 : .42;
float hkN = (gq > 1.5 && gq < 3.5) || (gq > 6.5 && gq < 8.5) ? uArc : uNight;   // 広場の弧と床の帯は、夜だけ灯る(夕方は灯らない)
totalEmissiveRadiance += hkG * gi * step(.5, gq) * step(gq, 8.5) * hkLit * hkN;
totalEmissiveRadiance += uGlowR * (1.0 - step(.5, abs(gk - 10.0))) * uRim * 1.4;   // 夕方: 砂の弧の縁が金に光る
totalEmissiveRadiance += uGlowV * (1.0 - step(.5, abs(gk - 11.0))) * uRim * .4;   // 夕方: 藍の弧の上の縁が、空の藤色を拾う(冷たく、金より控えめ)
totalEmissiveRadiance += vec3(.007, .01, .027) * (1.0 - step(.5, abs(gk - 2.0))) * uRim;   // 夕方: 藍の弧の影絵に、藍が残る程度の空の照り返し
totalEmissiveRadiance += uHiColor * (1.0 - step(.5, abs(vBid - uHi))) * uHiAmt;
if (uAir > .001 && abs(vBid - uFocus) < .5) totalEmissiveRadiance *= 1.0 - .9 * uAir;   // v6: 着いた病院の外の灯り(塔屋の帯の窓・横の窓)は、部屋より明るくしない(いちばん明るいのは部屋)`;
/* v6: 病院に着いたとき、町を暗くせず、光の計算のあとでその時刻の空気の色へ溶かす(主役は切った主棟だけ。右の翼・車寄せ・広場・ほかの建物は溶かす側) */
const HKAIR = `
if (uAir > .001) {
  vec3 hkL = (uMainInv * vec4(vHkW, 1.0)).xyz;
  float hkMain = abs(vBid - uFocus) < .5 && abs(hkL.x) < uMainB.x && abs(hkL.z) < uMainB.y ? 0.0 : 1.0;
  gl_FragColor.rgb = mix(gl_FragColor.rgb, uHazeC, (vBid > .5 ? .45 : .25) * uAir * hkMain);
}`;
const TM = {};
function townMat(cls) {
  if (TM[cls]) return TM[cls];
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: { g: .28, s: .6, r: .92, f: .95 }[cls], metalness: 0, flatShading: cls === 'f' });
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\n' + VCOMMON)
      .replace('#include <beginnormal_vertex>', 'float hkC0; mat4 hkM0 = hkPart(hkC0); vec3 objectNormal = mat3(hkM0) * vec3(normal);')
      .replace('#include <begin_vertex>', VBEGIN);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\n' + FCOMMON)
      .replace('#include <clipping_planes_fragment>', 'if (vCut < .999 && hkBayer(gl_FragCoord.xy) >= vCut) discard;\nif (vCut > 1.5 && vHkY < uGroundCut) discard;\nif (uArcFade > .001 && (abs(vFx.x - 2.0) < .5 || abs(vFx.x - 3.0) < .5 || abs(vFx.x - 10.0) < .5 || abs(vFx.x - 11.0) < .5) && hkBayer(gl_FragCoord.xy) < uArcFade) discard;\n#include <clipping_planes_fragment>')
      .replace('#include <color_fragment>', `#include <color_fragment>
if (vFx.y > .5) diffuseColor.rgb = mix(diffuseColor.rgb, vec3(.075, .095, .15), uNight * .82);
// 夕方の藍の弧は、逆光の影絵(真っ黒にはしない。空の照り返しで、深い藍が残る。下の emissive)
if (vFx.x > 6.5 && vFx.x < 8.5) diffuseColor.rgb = mix(diffuseColor.rgb, uJoint, uDay * (vFx.x < 7.5 ? .6 : .45));   // 昼の床のロゴの帯は、目地に近い濃さ(真上からは読める)
if (uFocus > -.5 && abs(vBid - uFocus) > .5) { float k = vBid > .5 ? uDim : uDim * .55; float l = dot(diffuseColor.rgb, vec3(.3, .59, .11)); diffuseColor.rgb = mix(diffuseColor.rgb, mix(vec3(l), vec3(.93, .92, .9), .22), k); }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + FWIN)
      .replace('#include <opaque_fragment>', 'if (vFx.x > 8.5 && vFx.x < 9.5) outgoingLight = diffuseColor.rgb;\n#include <opaque_fragment>')
      .replace('#include <tonemapping_fragment>', '#include <tonemapping_fragment>\ngl_FragColor.rgb = mix(gl_FragColor.rgb, uHazeC, (1.0 - smoothstep(-7.9, -6.2, vHkY)) * uHazeK);' + HKAIR);
  };
  m.customProgramCacheKey = () => 'hk-town2-' + cls;
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
      .replace('#include <clipping_planes_fragment>', 'if (vCut < .999 && hkBayer(gl_FragCoord.xy) >= vCut) discard;\nif (vCut > 1.5 && vHkY < uGroundCut) discard;\nif (uArcFade > .001 && (abs(vFx.x - 2.0) < .5 || abs(vFx.x - 3.0) < .5 || abs(vFx.x - 10.0) < .5 || abs(vFx.x - 11.0) < .5) && hkBayer(gl_FragCoord.xy) < uArcFade) discard;\n#include <clipping_planes_fragment>');
  };
  DEPTH.customProgramCacheKey = () => 'hk-depth';
  return DEPTH;
}

/* ---------- まとめる(接地の陰を頂点の色へ焼き込む) ---------- */
const _m = new THREE.Matrix4(), _n = new THREE.Matrix3(), _v = new THREE.Vector3();
let AO_MS = 0;
function inherit(o, root, key, dflt) { for (let p = o; p && p !== root; p = p.parent) if (p.userData[key] !== undefined) return p.userData[key]; return dflt; }
function* mergeItemsGen(items, inv, ao) {
  let nv = 0, ni = 0;
  for (const { o } of items) { const g = o.geometry; nv += g.attributes.position.count; ni += g.index ? g.index.count : g.attributes.position.count; }
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), fxa = new Float32Array(nv * 2), bid = new Float32Array(nv), part = new Float32Array(nv), win = new Float32Array(nv), idx = new Uint32Array(ni), aoMask = new Uint8Array(ao ? nv : 0);
  let vo = 0, io = 0, since = 0;
  for (const it of items) {
    const o = it.o, g = o.geometry, P = g.attributes.position, N = g.attributes.normal, Cc = g.attributes.color, c = o.material.color;
    _m.multiplyMatrices(inv, o.matrixWorld); _n.getNormalMatrix(_m);
    const vc = o.material.vertexColors && Cc, useAO = ao && !it.surf && it.fx[0] < 8.5;
    if (useAO) aoMask.fill(1, vo, vo + P.count);
    for (let i = 0; i < P.count; i++) {
      const k = vo + i;
      _v.fromBufferAttribute(P, i).applyMatrix4(_m); pos[k * 3] = _v.x; pos[k * 3 + 1] = _v.y; pos[k * 3 + 2] = _v.z;
      if (N) { _v.fromBufferAttribute(N, i).applyMatrix3(_n).normalize(); nor[k * 3] = _v.x; nor[k * 3 + 1] = _v.y; nor[k * 3 + 2] = _v.z; }
      col[k * 3] = c.r * (vc ? Cc.getX(i) : 1); col[k * 3 + 1] = c.g * (vc ? Cc.getY(i) : 1); col[k * 3 + 2] = c.b * (vc ? Cc.getZ(i) : 1);
      fxa[k * 2] = it.fx[0]; fxa[k * 2 + 1] = it.fx[1]; bid[k] = it.bid; part[k] = it.part; win[k] = it.wid;
    }
    if (g.index) { const I = g.index.array; for (let j = 0; j < I.length; j++) idx[io + j] = I[j] + vo; io += I.length; }
    else { for (let j = 0; j < P.count; j++) idx[io + j] = vo + j; io += P.count; }
    vo += P.count; since += P.count;
    if (since > 4000) { since = 0; yield 'merge'; }
  }
  // 接地の陰: 地面に近いほど少し暗く(壁の下ほどわずかに暗いグラデーション)。地面から 0.55 より高い頂点は変わらないので、とばす
  if (ao) {
    let t0 = performance.now();
    for (let k = 0; k < nv; k++) {
      if (k % 12000 === 11999) { AO_MS += performance.now() - t0; yield 'ao'; t0 = performance.now(); }
      if (!aoMask[k]) continue; const y = pos[k * 3 + 1]; if (y > PLATEAU_H + .56) continue; const x = pos[k * 3], z = pos[k * 3 + 2]; if (y > .56 && !nearPlateau(x, z)) continue;
      const a = .8 + .2 * smooth01((y - groundY(x, z)) / .55); col[k * 3] *= a; col[k * 3 + 1] *= a; col[k * 3 + 2] *= a;
    }
    AO_MS += performance.now() - t0;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.setAttribute('aFx', new THREE.BufferAttribute(fxa, 2)); out.setAttribute('aBid', new THREE.BufferAttribute(bid, 1)); out.setAttribute('aPart', new THREE.BufferAttribute(part, 1)); out.setAttribute('aWin', new THREE.BufferAttribute(win, 1));
  out.setIndex(new THREE.BufferAttribute(idx, 1)); out.computeBoundingSphere();
  return out;
}
const runGen = g => { let r; do r = g.next(); while (!r.done); return r.value; };
const mergeItems = (items, inv, ao) => runGen(mergeItemsGen(items, inv, ao));
function collect(root) {
  const items = [];
  root.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.keep || inherit(o, root, 'keep', false)) return;
    items.push({ o, bid: inherit(o, root, 'bid', 0), part: inherit(o, root, 'part', 0), fx: o.userData.fx || [0, 0], wid: o.userData.wid || 0, surf: inherit(o, root, 'surf', false) });
  });
  return items;
}
function* bakeStaticGen(root, ao = true) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert(), buckets = new Map();
  for (const it of collect(root)) {
    const m = it.o.material, rough = m.roughness ?? .9;
    const cls = m.flatShading ? 'f' : rough < .45 ? 'g' : rough < .75 ? 's' : 'r';
    const key = cls + (it.o.castShadow ? 'c' : '-');
    if (!buckets.has(key)) buckets.set(key, []); buckets.get(key).push(it);
  }
  for (const its of buckets.values()) for (const { o } of its) o.parent.remove(o);
  yield 'collect';
  const out = [];
  for (const [key, its] of buckets) {
    const geom = yield* mergeItemsGen(its, inv, ao);
    const mesh = new THREE.Mesh(geom, townMat(key[0])); mesh.castShadow = key[1] === 'c'; mesh.receiveShadow = true; mesh.userData.keep = true;
    if (mesh.castShadow) mesh.customDepthMaterial = depthMat();
    root.add(mesh); out.push(mesh);
    yield 'bucket';
  }
  return out;
}
/* 動く小さなまとまりを、頂点の色の1つの形にする(バス・車・自転車) */
function bakeGeo(group) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert(), items = collect(group);
  return mergeItems(items, inv, false);
}
const vcMat = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: o.r ?? .75, metalness: 0, transparent: !!o.transparent, opacity: o.opacity ?? 1, depthWrite: o.transparent ? false : true });
const sh = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; return m; };
const surf = m => tag(sh(m, false), { surf: true });

/* ================================================================
   島: 地面(頂点の色で草のむらと接地の陰)・縁の地層(3色)・層と割れ目のある岩の塊・台地と石垣・階段と坂
   ================================================================ */
const _col = new THREE.Color();
function noise2(x, z) { return Math.sin(x * 1.3 + z * .7) * .5 + Math.sin(x * .45 - z * 1.1 + 1.7) * .35 + Math.sin(x * 2.9 + z * 2.3) * .15; }
/* 地面の接地の陰: 建物の足もと・木の下・石垣の根もとを、柔らかく暗くする */
function groundAO(x, z, occ) {
  let k = 1;
  for (const o of occ) {
    const dx = x - o.x, dz = z - o.z;
    if (Math.abs(dx) > o.reach || Math.abs(dz) > o.reach) continue;
    let d;
    if (o.r !== undefined) d = Math.sqrt(dx * dx + dz * dz) - o.r;
    else { const lx = dx * o.c + dz * o.s, lz = -dx * o.s + dz * o.c, ex = Math.abs(lx) - o.hx, ez = Math.abs(lz) - o.hz, mx = ex > 0 ? ex : 0, mz = ez > 0 ? ez : 0; d = Math.sqrt(mx * mx + mz * mz); }
    k *= 1 - o.k * Math.exp(-Math.max(0, d) / o.fall);
  }
  return k;
}
let GROUND_MS = 0;
function* groundMeshGen(occ, q) {
  let t0 = performance.now(); GROUND_MS = 0;
  const NR = q === 'low' ? 16 : 22, NS = q === 'low' ? 96 : 160, pos = [], nor = [], col = [], idx = [];   // 角度の刻みは縁の地層(skirt)と同じ。縁で頂点がそろい、低い段の境にすき間ができない
  const g1 = new THREE.Color(C.grass), g2 = new THREE.Color(C.grass2), g3 = new THREE.Color(C.lawn);
  const FR = []; for (let j = 0; j <= NR - 6; j++) FR.push(.85 * Math.pow(j / (NR - 6), .85)); FR.push(.875, .89, .905, .92, .95, 1);
  for (let j = 0; j < FR.length; j++) for (let i = 0; i < NS; i++) {
    if (i === 0 && j % 6 === 5) { GROUND_MS += performance.now() - t0; yield 'ground'; t0 = performance.now(); }
    const a = i / NS * TAU, Ra = islandR(a), rr = Ra * FR[j], x = Math.cos(a) * rr, z = Math.sin(a) * rr;
    pos.push(x, -ledgeDrop(a, rr, Ra), z); nor.push(0, 1, 0);
    const n = noise2(x * .55, z * .55);
    _col.copy(g1).lerp(n > 0 ? g3 : g2, Math.min(1, Math.abs(n) * .9));
    // 台地の石垣の根もと(一段低い側)は少し暗く、島の縁の近くはわずかに明るく乾いた草に
    const sd = plateauSD(x, z), wallAO = sd > 0 ? 1 - .2 * Math.exp(-sd / .28) : 1;
    const k = groundAO(x, z, occ) * wallAO * (1 + .04 * smooth01((rr - islandR(a) + 1.2) / 1.2));
    col.push(_col.r * k, _col.g * k, _col.b * k);
  }
  for (let j = 0; j < FR.length - 1; j++) for (let i = 0; i < NS; i++) { const a = j * NS + i, b = j * NS + (i + 1) % NS, c = a + NS, d = b + NS; idx.push(a, c, b, b, c, d); }
  const gg = geo(pos, nor, idx, col); gg.computeVertexNormals();
  GROUND_MS += performance.now() - t0;
  return surf(new THREE.Mesh(gg, M('#FFFFFF', { vc: true, r: .95 })));
}
/* 縁の地層: 草の縁 → 表土(こげ茶)→ 砂岩(黄土)→ 石(灰)→ 砂岩。層ごとに少し引っ込み、光の線ができる */
const STRATA = [
  { y: 0, d: 0, c: null }, { y: -.05, d: .035, c: 'grassEdge' }, { y: -.12, d: -.015, c: 'grassEdge' },
  { y: -.14, d: -.04, c: 'soil1' }, { y: -.34, d: -.07, c: 'soil1' },
  { y: -.36, d: -.13, c: 'soil2' }, { y: -.92, d: -.16, c: 'soil2' },
  { y: -.94, d: -.21, c: 'soil3' }, { y: -1.36, d: -.26, c: 'soil3' },
  { y: -1.38, d: -.32, c: 'soil4' }, { y: -1.72, d: -.42, c: 'soil4' }
];
function* skirtGen(rnd, q) {
  const NS = q === 'low' ? 96 : 160, rows = [];
  // 層の境目ごとの波(ひとつの段の上と下の行は同じ波を使い、層が交差しない)。層は場所で厚くなったり薄くなったりする
  const BND = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4], ph = Array.from({ length: 5 }, () => [rnd() * TAU, rnd() * TAU]), AMP = [.015, .08, .1, .09, .06];
  const jit = Array.from({ length: STRATA.length }, () => [rnd() * 9, rnd() * 9]);
  for (let k = 0; k < STRATA.length; k++) {
    const L = STRATA[k], row = [], bnd = BND[k];
    for (let i = 0; i <= NS; i++) {
      const a = i / NS * TAU, R = islandR(a), nn = k > 2 ? Math.sin(a * 9 + jit[k][0]) * .035 + Math.sin(a * 23 + jit[k][1]) * .02 : 0;
      let yy = L.y + (k > 2 ? AMP[bnd] * (Math.sin(a * 3 + ph[bnd][0]) + .6 * Math.sin(a * 7 + ph[bnd][1])) : 0); const rr = R + L.d + nn;
      const dr = LEDGE.d * ledgeW(a); if (dr > 0 && yy > -1) yy = yy - dr * (1 + yy);
      row.push([Math.cos(a) * rr, yy, Math.sin(a) * rr]);
    }
    rows.push(row);
  }
  yield 'skirt';
  const pos = [], nor = [], col = [], idx = [], tmp = new THREE.Color();
  for (let k = 0; k < rows.length - 1; k++) {
    if (k === 5) yield 'skirt';
    const cc = STRATA[k + 1].c; if (!cc) continue;
    for (let i = 0; i < NS; i++) {
      const p = [rows[k][i], rows[k][i + 1], rows[k + 1][i + 1], rows[k + 1][i]];
      tmp.set(C[cc]).offsetHSL(0, (rnd() - .5) * .02, (rnd() - .5) * .035 - (k > 6 ? .02 : 0));
      const b0 = pos.length / 3, mx = (p[0][0] + p[1][0]) / 2, mz = (p[0][2] + p[1][2]) / 2, l = Math.hypot(mx, mz);
      for (const v of p) { pos.push(...v); nor.push(mx / l, 0, mz / l); col.push(tmp.r, tmp.g, tmp.b); }
      idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
    }
  }
  yield 'skirt';
  // 崖から突き出す岩(ところどころ。層の色で)
  const rk = new THREE.IcosahedronGeometry(1, 0), RP = rk.attributes.position, nRock = q === 'low' ? 5 : 9;
  for (let n = 0; n < nRock; n++) {
    const a = n / nRock * TAU + rnd() * .3, y = -.6 - rnd() * .9, R = islandR(a) - .2 - (y < -.9 ? .1 : 0), sz = .1 + rnd() * .12;
    const m = new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * R, y, Math.sin(a) * R), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 3, rnd() * 3)), new THREE.Vector3(sz * (1.2 + rnd() * .6), sz * (.7 + rnd() * .3), sz));
    tmp.set(y > -.92 ? C.soil2 : C.soil3).offsetHSL(0, 0, -.06 + (rnd() - .5) * .05);
    for (let f = 0; f < RP.count; f += 3) {
      const b0 = pos.length / 3, vs = [0, 1, 2].map(j => new THREE.Vector3().fromBufferAttribute(RP, f + j).applyMatrix4(m));
      const nn = new THREE.Vector3().subVectors(vs[1], vs[0]).cross(new THREE.Vector3().subVectors(vs[2], vs[0])).normalize();
      for (const v of vs) { pos.push(v.x, v.y, v.z); nor.push(nn.x, nn.y, nn.z); col.push(tmp.r, tmp.g, tmp.b); }
      idx.push(b0, b0 + 1, b0 + 2);
    }
  }
  // 平らな陰影(flat)なので、法線はシェーダーが面から求める。頂点は四角ごとに別なので、色も面ごとに分かれる
  const g = geo(pos, nor, idx, col);
  return { mesh: surf(new THREE.Mesh(g, M('#FFFFFF', { flat: true, vc: true, r: .95 }))), bottom: rows[rows.length - 1] };
}
/* 岩の塊: 一つの円錐でなく、段(層)と縦の割れ目のある塊。下へ行くほど細く、少し傾く。小さな塊が2つぶら下がる */
function* rockMassGen(rnd, bottom, q) {
  const NS = bottom.length - 1, pos = [], col = [], tmp = new THREE.Color();
  const tri = (a, b, c, hint) => {   // 三角形を、外向きの手がかり hint に合わせた向きで足す
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, flip = nx * hint[0] + ny * hint[1] + nz * hint[2] < 0;
    for (const p of flip ? [a, c, b] : [a, b, c]) { pos.push(p[0], p[1], p[2]); col.push(tmp.r, tmp.g, tmp.b); }
  };
  const quad = (p, hint) => { tri(p[0], p[1], p[2], hint); tri(p[0], p[2], p[3], hint); };
  // 本体: 層の段(張り出しと引っ込み)と縦の割れ目。下は平らに閉じる(細い三角形を一点に集めない)
  const PROF = [[-1.72, 1], [-2.1, .93], [-2.2, .86], [-3.0, .79], [-3.12, .72], [-4.0, .64], [-4.12, .57], [-4.9, .48], [-5.02, .42], [-5.5, .34]];
  const cracks = Array.from({ length: 9 }, () => [rnd() * TAU, .05 + rnd() * .05, .12 + rnd() * .2]);
  const rows = [], axis = [];
  for (let k = 0; k < PROF.length; k++) {
    const [y, sc] = PROF[k], dep = clamp01((-y - 1.72) / 3.8), lean = dep * dep, row = [];
    axis.push([lean * .5, lean * .25]);
    for (let i = 0; i <= NS; i++) {
      const a = i / NS * TAU, b = bottom[i % NS];
      let rad = Math.hypot(b[0], b[2]) * sc * (1 + (.1 * Math.sin(a * 3 + 1) + .07 * Math.sin(a * 5 + 2.3) + .05 * Math.sin(a * 8 + .4)) * dep);
      for (const [ca, w, dd] of cracks) { const d = angDiff(a, ca) / w; rad -= dd * Math.exp(-d * d) * (k ? 1 : 0) * Math.min(1, sc * 2.4); }
      row.push(k === 0 ? [b[0], b[1], b[2]] : [Math.cos(a) * rad + lean * .5, y + Math.sin(a * 4 + k) * .06 * dep, Math.sin(a) * rad + lean * .25]);
    }
    rows.push(row);
  }
  yield 'rock';
  const bands = [C.rock, C.soil4, C.rock, C.soil3, C.rock, C.soil4, C.rockD];
  for (let k = 0; k < rows.length - 1; k++) for (let i = 0; i < NS; i++) {
    const p = [rows[k][i], rows[k][i + 1], rows[k + 1][i + 1], rows[k + 1][i]], a = (i + .5) / NS * TAU;
    let crack = 0; for (const [ca, w] of cracks) { const d = angDiff(a, ca) / w; crack = Math.max(crack, Math.exp(-d * d)); }
    tmp.set(bands[k % bands.length]).offsetHSL(0, (rnd() - .5) * .02, (rnd() - .5) * .04 - k * .006 - crack * .09);
    const mx = (p[0][0] + p[2][0]) / 2 - axis[k][0], mz = (p[0][2] + p[2][2]) / 2 - axis[k][1];
    quad(p, [mx, -.25 * k / rows.length * Math.hypot(mx, mz), mz]);
  }
  yield 'rock';
  // 底: 少し凹凸のある面で閉じる(下向き。カメラからは見えない)
  const last = rows[rows.length - 1], ax = axis[axis.length - 1], cy = PROF[PROF.length - 1][0] - .25, ctr = [ax[0], cy, ax[1]];
  tmp.set(C.rockD);
  for (let i = 0; i < NS; i += 4) { const j = Math.min(NS, i + 4); tri(last[i], last[j], ctr, [0, -1, 0]); for (let m = i; m < j; m++) tri(last[m], last[m + 1], last[j], [0, -1, 0]); }
  // 割れて垂れる先(3本。層の段と、少しねじれ)
  for (const [s0, f0, len, w, lean] of [[-.6, 1.05, 3.0, 1.35, -.15], [1.6, .85, 1.7, .85, .3], [.45, -1.0, 2.3, 1.0, .1]]) {   // 大きい先が1本と、小さい先が2本(左右対称の牙にしない)
    const [ox, oz] = SF(s0, f0), a0 = Math.atan2(oz, ox), r0 = Math.hypot(ox, oz);
    const cx = ax[0] + Math.cos(a0) * r0, cz = ax[1] + Math.sin(a0) * r0, y0 = PROF[PROF.length - 1][0] + .25, M2 = 8, K2 = 6, ring = [];
    for (let k = 0; k <= K2; k++) {
      const u = k / K2, r2 = [], step = k % 2 ? .9 : 1;   // 段ごとに少し張り出す
      for (let i = 0; i < M2; i++) { const a = i / M2 * TAU + k * .35, rad = Math.max(.02, w * Math.pow(1 - u, 1.15) * step * (.82 + .3 * Math.sin(a * 3 + r0 * 4))); r2.push([cx + Math.cos(a) * rad + u * lean, y0 - u * len, cz + Math.sin(a) * rad + u * lean * .5]); }
      ring.push(r2);
    }
    for (let k = 0; k < K2; k++) for (let i = 0; i < M2; i++) {
      const p = [ring[k][i], ring[k][(i + 1) % M2], ring[k + 1][(i + 1) % M2], ring[k + 1][i]], u = (k + .5) / K2;
      tmp.set(k % 2 ? C.rock : C.soil4).offsetHSL(0, 0, -u * .07 + (rnd() - .5) * .04);
      quad(p, [(p[0][0] + p[2][0]) / 2 - cx - u * lean, -.2, (p[0][2] + p[2][2]) / 2 - cz - u * lean * .5]);
    }
  }
  yield 'rock';
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  void q;
  return surf(new THREE.Mesh(g, M('#FFFFFF', { flat: true, vc: true, r: .95 })));
}
/* 台地の輪郭(星形の線を、中心から放射に探す) */
function plateauOutline(n) {
  const c = [.3, .9], out = [];
  for (let i = 0; i < n; i++) {
    const th = i / n * TAU, ds = Math.sin(th), df = Math.cos(th);
    let lo = 0, hi = 9; for (let k = 0; k < 30; k++) { const m = (lo + hi) / 2; if (plateauSF(c[0] + ds * m, c[1] + df * m) < 0) lo = m; else hi = m; }
    out.push([c[0] + ds * lo, c[1] + df * lo]);
  }
  return { c, pts: out };
}
function* plateauGen(g, occ, q) {
  const { c, pts } = plateauOutline(q === 'low' ? 120 : 200), n = pts.length, H = PLATEAU_H;
  // 上の面(芝。頂点の色でむらと、縁の近くの陰)
  const K = 8, pos = [], nor = [], col = [], idx = [], g1 = new THREE.Color(C.lawn), g2 = new THREE.Color(C.grass);
  for (let k = 0; k <= K; k++) for (let i = 0; i < n; i++) {
    const u = k / K, s = lerp(c[0], pts[i][0], u), f = lerp(c[1], pts[i][1], u), [x, z] = SF(s, f);
    pos.push(x, H, z); nor.push(0, 1, 0);
    const nn = noise2(x * .6 + 3, z * .6); _col.copy(g1).lerp(g2, clamp01(.5 + nn * .6));
    const kk = groundAO(x, z, occ) * (1 - .06 * smooth01((u - .85) / .15));
    col.push(_col.r * kk, _col.g * kk, _col.b * kk);
  }
  for (let k = 0; k < K; k++) for (let i = 0; i < n; i++) { const a = k * n + i, b = k * n + (i + 1) % n, cc = a + n, d = b + n; idx.push(a, cc, b, b, cc, d); }
  g.add(surf(new THREE.Mesh(geo(pos, nor, idx, col), M('#FFFFFF', { vc: true, r: .95 }))));
  yield 'plateau';
  // 石垣(乱積み: 長さと高さのそろわない石を2段に。背の高い石がところどころ2段をまたぐ。石ごとに少し出入りし、目地は奥の暗い帯が細く見える。
  // 根もとほど外へ(のり)。笠石。階段と坂の所はあける)
  const cut = (s, f) => { for (const st of STAIRS) { const q2 = inRect(s, f, st); if (q2.along > -.3 && q2.along < .3 && Math.abs(q2.across) < st.w / 2 + .02) return true; } return rampK(s, f) >= 0 && rampK(s, f) < .5; };
  const wp = [], wn = [], wc = [], wi = [], rnd = rng(77);
  const isOpen = pts.map((p0, i) => { const p1 = pts[(i + 1) % n]; return !cut((p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2); });
  const capPts = isOpen.map((o, i) => o ? i : null);
  const bat = y => .04 * (1 - y / H), GAP = .008, TOP = H - 1e-4;
  const wallQuad = (i, ya, yb, za, zb, e0, e1, bulge, col) => {   // 区間 i の石の面。ya, yb = 始まりの下と上、za, zb = 終わりの下と上。e0, e1 = 目地のぶん端を詰める
    const p0 = pts[i], p1 = pts[(i + 1) % n], ts0 = p1[0] - p0[0], tf0 = p1[1] - p0[1], tl = Math.hypot(ts0, tf0) || 1, ts = ts0 / tl, tf = tf0 / tl, ns = -tf, nf = ts, [nx, nz] = SF(ns, nf);
    const P = (p, e, y) => { const d = bat(y) + bulge; return SF(p[0] + ts * e + ns * d, p[1] + tf * e + nf * d); };
    const base = wp.length / 3;
    for (const [p, e, y] of [[p0, e0, ya], [p1, -e1, za], [p1, -e1, zb], [p0, e0, yb]]) { const [x, z] = P(p, e, y); wp.push(x, y, z); wn.push(nx, .15, nz); wc.push(col.r, col.g, col.b); }
    wi.push(base, base + 1, base + 2, base, base + 2, base + 3);
  };
  const stoneCol = () => new THREE.Color(C.stoneWall).lerp(_col.set(C.stoneWall2), rnd() * .7).offsetHSL(0, (rnd() - .5) * .02, (rnd() - .5) * .07 - (rnd() < .14 ? .05 : 0));
  const mortar = new THREE.Color(C.stoneWall2).offsetHSL(0, 0, -.16);
  let st0 = isOpen.indexOf(false); if (st0 < 0) st0 = 0;
  const runs = []; let cur = [];
  for (let k = 1; k <= n; k++) { const i = (st0 + k) % n; if (isOpen[i]) cur.push(i); else if (cur.length) { runs.push(cur); cur = []; } }
  if (cur.length) runs.push(cur);
  for (const run of runs) {
    const split = new Float32Array(run.length), L = run.length;
    for (let k = 0; k < L;) {      // 下の段: 大きめの石(2〜3区間)。ときどき2段をまたぐ背の高い石
      const tall = rnd() < .1, len = Math.min(L - k, tall ? 1 + (rnd() < .5 ? 1 : 0) : 2 + Math.floor(rnd() * 2));
      const top = tall ? H : H * (.4 + rnd() * .2), yt = tall ? H : top - GAP / 2, col = stoneCol(), bulge = (rnd() - .35) * .012;
      for (let j = 0; j < len; j++) { split[k + j] = top; wallQuad(run[k + j], 0, yt, 0, yt, j ? 0 : GAP / 2, j === len - 1 ? GAP / 2 : 0, bulge, col); }
      k += len;
    }
    for (let k = 0; k < L;) {      // 上の段: 1〜3区間。下の石の高さに合わせて、下の縁が段になる
      if (split[k] >= TOP) { k++; continue; }
      let len = 1 + Math.floor(rnd() * 3), j = 0; while (j < len && k + j < L && split[k + j] < TOP) j++; len = j;
      const col = stoneCol(), bulge = (rnd() - .35) * .01;
      for (let j2 = 0; j2 < len; j2++) { const yb = split[k + j2] + GAP / 2; wallQuad(run[k + j2], yb, H, yb, H, j2 ? 0 : GAP / 2, j2 === len - 1 ? GAP / 2 : 0, bulge, col); }
      k += len;
    }
    for (const i of run) wallQuad(i, 0, H, 0, H, 0, 0, -.006, mortar);   // 目地(奥の暗い帯)
  }
  const wg = geo(wp, wn, wi, wc);
  g.add(surf(new THREE.Mesh(wg, M('#FFFFFF', { vc: true, r: .9 }))));
  yield 'plateau';
  // 笠石(縁の上の細い帯)
  const cp = [], cn = [], ci = [];
  for (let i = 0; i < n; i++) {
    if (capPts[i] === null) continue;
    const p0 = pts[i], p1 = pts[(i + 1) % n], ts = p1[0] - p0[0], tf = p1[1] - p0[1], tl = Math.hypot(ts, tf) || 1, ns = -tf / tl, nf = ts / tl;
    const q0 = SF(p0[0] + ns * .03, p0[1] + nf * .03), q1 = SF(p1[0] + ns * .03, p1[1] + nf * .03), r0 = SF(p0[0] - ns * .08, p0[1] - nf * .08), r1 = SF(p1[0] - ns * .08, p1[1] - nf * .08), [nx, nz] = SF(ns, nf);
    let b = cp.length / 3; for (const [x, z] of [q0, q1, r1, r0]) { cp.push(x, H + .03, z); cn.push(0, 1, 0); } ci.push(b, b + 1, b + 2, b, b + 2, b + 3);
    b = cp.length / 3; for (const [x, z, y] of [[q0[0], q0[1], H + .03], [q1[0], q1[1], H + .03], [q1[0], q1[1], H - .01], [q0[0], q0[1], H - .01]]) { cp.push(x, y, z); cn.push(nx, 0, nz); } ci.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  g.add(surf(new THREE.Mesh(geo(cp, cn, ci), M(C.coping, { r: .85 }))));
  // 階段(石の段)
  for (const st of STAIRS) {
    const nStep = st.w > 1.5 ? 4 : 3, [dx, df] = st.dir, ang = Math.atan2(dx, df);
    for (let k = 0; k < nStep; k++) {
      const along = (k + .5) * st.len / nStep, h = H * (1 - (k + 1) / (nStep + .4)), [x, z] = SF(st.s + dx * along, st.f + df * along);
      const s1 = cbox(st.w, Math.max(.03, h), st.len / nStep + .08, M(C.coping, { r: .85 }), .01); s1.position.set(x, h / 2, z); s1.rotation.y = ang + Math.PI / 4; g.add(surf(s1));
    }
    for (const sd of [-1, 1]) {   // 階段の脇の低い石の袖
      const [x, z] = SF(st.s + dx * st.len / 2 - df * sd * (st.w / 2 + .05), st.f + df * st.len / 2 + dx * sd * (st.w / 2 + .05));
      const ch = cbox(.08, H * .55, st.len + .06, M(C.stoneWall, { r: .9 }), .012); ch.position.set(x, H * .275, z); ch.rotation.y = ang + Math.PI / 4; g.add(ch);
    }
  }
  // 救急の車の坂(傾いた板と、両脇の低い壁)
  const [ax, az] = SF(...RAMP.a), [bx, bz] = SF(...RAMP.b), L = Math.hypot(bx - ax, bz - az), slope = Math.atan2(H, L);
  const rp = cbox(RAMP.w, .05, L + .06, M(C.road, { r: .9 }), .01); rp.position.set((ax + bx) / 2, H / 2 - .015, (az + bz) / 2); rp.rotation.order = 'YXZ'; rp.rotation.y = Math.atan2(bx - ax, bz - az); rp.rotation.x = slope; rp.castShadow = false; g.add(tag(rp, { surf: true }));
  void c;
}

/* ---------- 道: 環状の道は細く、地面に近い色に(白い破線と白い歩道の輪はやめる)。小道は広場から各建物へ。救急の車の道 ---------- */
function roads(g, rnd) {
  const ring = (r0, r1, mat, y) => { const m = surf(new THREE.Mesh(new THREE.RingGeometry(r0, r1, 180), mat)); m.rotation.x = -Math.PI / 2; m.position.y = y; g.add(m); };
  ring(ROAD_R - ROAD_W / 2, ROAD_R + ROAD_W / 2, M(C.road, { r: .95 }), .012);
  ring(ROAD_R - ROAD_W / 2 - .05, ROAD_R - ROAD_W / 2, M(C.roadEdge, { r: .9 }), .016);
  ring(ROAD_R + ROAD_W / 2, ROAD_R + ROAD_W / 2 + .05, M(C.roadEdge, { r: .9 }), .016);
  void rnd;
}
/* 曲線(画面の座標の点列 → 島の点列。Catmull-Rom でなめらかに) */
function curveSF(ctrl, step = .12) {
  const P = ctrl.map(([s, f]) => new THREE.Vector3(...SF(s, f).flatMap((v, i) => i ? [0, v] : [v])));
  const cv = new THREE.CatmullRomCurve3(P, false, 'centripetal', .5), n = Math.max(4, Math.round(cv.getLength() / step));
  return cv.getSpacedPoints(n).map(v => [v.x, v.z]);
}
const PATHS = [
  // 広場(台地)から、階段を通って各建物へ。人もこの道を歩く
  { id: 'atelier', pts: [[-2.3, 2.3], [-3.05, 2.3], [-3.6, 2.5], [-4.0, 3.15]] },
  { id: 'library', pts: [[-3.05, 2.3], [-3.6, 2.0], [-4.2, 1.2], [-4.6, .7]] },
  { id: 'front', pts: [[0, 4.75], [0, 5.3], [0, 5.85], [-.6, 6.55], [-1.3, 6.95]] },
  { id: 'clinic', pts: [[0, 5.85], [1.2, 6.0], [2.6, 5.65], [3.35, 4.95]] },
  { id: 'park', pts: [[3.3, -1.7], [3.65, -2.0], [4.2, -1.6], [4.55, -.6], [4.4, .3]] },
  { id: 'office', pts: [[3.65, -2.0], [4.2, -2.3], [4.9, -2.45]] },
  { id: 'back', pts: [[-.6, -2.95], [-.6, -3.35], [-.8, -4.0], [-1.6, -4.7], [-2.4, -5.3]] },
  { id: 'obs', pts: [[-.8, -4.0], [.4, -4.5], [1.2, -4.75]] }
];
function paths(g) {
  const mat = M(C.walk, { r: .95 }), out = {};
  for (const p of PATHS) {
    const pts = curveSF(p.pts);
    g.add(tag(ribbon(pts, .3, (x, z) => groundY(x, z) + .004, .012, mat), { surf: true }));
    out[p.id] = pts;
  }
  return out;
}
/* 救急の車の道: 環状の道 → 坂 → 台地の右の車寄せの道 → 救急口(車はこの道を通る) */
function drivePts(B) {
  const er = B.hospital.ex.er, b = B.hospital, p = new THREE.Vector3(er[0], 0, er[1]).applyEuler(b.grp.rotation).add(b.grp.position);
  const [es, ef] = toSF(p.x, p.z), ring = SF(3.05, 6.75);
  const [rs, rf] = toSF(...ring);
  return curveSF([[rs + .3, rf + .1], [2.9, 6.0], [RAMP.b[0], RAMP.b[1]], [RAMP.a[0], RAMP.a[1]], [2.05, 2.2], [2.15, .8], [es, ef + .35], [es, ef]], .1);
}

/* ---------- 交差の広場(ランドマーク): 床に藍の石と砂の石の2本の帯を、ロゴの曲線で埋め込む。
   中心で2本はそれぞれ細い弧として持ち上がり、空中で交差するが接続しない(ロゴの立体版)。夜は弧と床の帯が、藍(白みのある)と砂(温かい)に灯る
   文字どおりの「橋」(水路に架けた小さな橋)はやめる ---------- */
const LOGO = { I: [[8, 74], [62, 16], [118, 24], [176, 84]], S: [[58, 94], [118, 60], [158, 22], [232, 12]] };
const LOGO_X = { u: 132.0, v: 48.48, tI: .745, tS: .4515 };   // ロゴの2本の線が交差する所(ロゴの座標。計算で確かめた値)
function bez(P, t) { const u = 1 - t; return [u * u * u * P[0][0] + 3 * u * u * t * P[1][0] + 3 * u * t * t * P[2][0] + t * t * t * P[3][0], u * u * u * P[0][1] + 3 * u * u * t * P[1][1] + 3 * u * t * t * P[2][1] + t * t * t * P[3][1]]; }
/* 2本の線: ロゴの中の「高さ」(v が小さいほど上)を、そのまま空中の高さにする(ロゴの立体版)。高さは v に比例(足もとで跳ねない)
   藍は両足が台座に沈み、砂は台座から立ち上がって右上で空中に抜ける(筆の線のように細って終わる)。砂は少し手前の面にあり、交差して見えても触れない
   床には、ロゴの2本の線そのもの(藍の石と砂の石)を埋め込む。上から見てもロゴが読める */
export const ARC = { VB: 84, LAM: 1.07, SOFF: .28, I: { t0: -.056, t1: 1.0 }, S: { t0: 0, t1: 1.0 } };
export function plazaFrame() {
  const L = LAYOUT.plaza, [cx0, cz0] = polar(L.a, L.r);
  const right = [Math.cos(deg(L.a - 90)), Math.sin(deg(L.a - 90))], down = [Math.cos(deg(L.a)), Math.sin(deg(L.a))];
  const s = 5.0 / 240, cx = cx0 + right[0] * -.42, cz = cz0 + right[1] * -.42;
  const map = ([u, v]) => { const px = (u - 120) * s, pz = (v - 55) * s; return [cx + right[0] * px + down[0] * pz, cz + right[1] * px + down[1] * pz]; };
  return { cx, cz, map, s, y: PLATEAU_H, arcTop: PLATEAU_H + PLINTH + ARC.LAM * s * (ARC.VB - 12) + .12 };
}
const PLINTH = .055;
const arcH = (v, s) => Math.max(0, ARC.LAM * s * (ARC.VB - v));
/* 筆の線の帯: 平たい断面(幅 w が広く、厚み th が薄い)。幅の向きは曲線の面の中(カメラに広い面を向ける)。wf(u) で端に向かって細る */
function brushRibbon(pts3, wmax, th, wf, mat) {
  const pos = [], nor = [], idx = [], n = pts3.length, up = new THREE.Vector3(0, 1, 0), T = new THREE.Vector3(), S = new THREE.Vector3(), N = new THREE.Vector3(), P = new THREE.Vector3();
  const fr = pts3.map((p, i) => { const a = pts3[Math.max(0, i - 1)], b = pts3[Math.min(n - 1, i + 1)]; T.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize(); S.crossVectors(T, up).normalize(); N.crossVectors(S, T).normalize(); return { p, S: S.clone(), N: N.clone(), w: wmax * wf(i / (n - 1)) }; });
  const corner = (f, a, b) => { P.set(...f.p).addScaledVector(f.N, a * f.w / 2).addScaledVector(f.S, b * th / 2); return [P.x, P.y, P.z]; };
  for (const [a1, b1, a2, b2, nk] of [[-1, 1, 1, 1, 'S'], [1, -1, -1, -1, '-S'], [1, 1, 1, -1, 'N'], [-1, -1, -1, 1, '-N']]) {
    const base = pos.length / 3;
    for (const f of fr) { const nv = nk === 'S' ? f.S : nk === '-S' ? f.S.clone().negate() : nk === 'N' ? f.N : f.N.clone().negate(); pos.push(...corner(f, a1, b1)); nor.push(nv.x, nv.y, nv.z); pos.push(...corner(f, a2, b2)); nor.push(nv.x, nv.y, nv.z); }
    for (let i = 0; i < n - 1; i++) { const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  return sh(new THREE.Mesh(geo(pos, nor, idx), mat));
}
/* 筆の線の帯の、上の縁だけの細い帯(brushRibbon と同じ断面の向き)。frac は広い面の幅のうち縁の帯の割合。面から少し浮かせて重ならないように */
function brushRim(pts3, wmax, th, wf, frac, mat) {
  const pos = [], nor = [], idx = [], n = pts3.length, up = new THREE.Vector3(0, 1, 0), T = new THREE.Vector3(), S = new THREE.Vector3(), N = new THREE.Vector3(), P = new THREE.Vector3(), E2 = .0016;
  const fr = pts3.map((p, i) => { const a = pts3[Math.max(0, i - 1)], b = pts3[Math.min(n - 1, i + 1)]; T.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]).normalize(); S.crossVectors(T, up).normalize(); N.crossVectors(S, T).normalize(); return { p, S: S.clone(), N: N.clone(), w: wmax * wf(i / (n - 1)) }; });
  const corner = (f, a, b, eN, eS) => { P.set(...f.p).addScaledVector(f.N, a * f.w / 2 + eN).addScaledVector(f.S, b * (th / 2 + eS)); return [P.x, P.y, P.z]; };
  const a0 = 1 - 2 * frac;
  // 角の継ぎ目に元の面がのぞかないよう、縁の帯は角を少し越えて重ねる(a は 1.04 まで、上の面は b を ±1.2 に)
  for (const [a1, b1, a2, b2, nk] of [[a0, 1, 1.04, 1, 'S'], [1.04, -1, a0, -1, '-S'], [1, 1.2, 1, -1.2, 'N']]) {
    const base = pos.length / 3, eN = nk === 'N' ? E2 : 0, eS = nk === 'N' ? 0 : E2;
    for (const f of fr) { const nv = nk === 'S' ? f.S : nk === '-S' ? f.S.clone().negate() : f.N; pos.push(...corner(f, a1, b1, eN, eS)); nor.push(nv.x, nv.y, nv.z); pos.push(...corner(f, a2, b2, eN, eS)); nor.push(nv.x, nv.y, nv.z); }
    for (let i = 0; i < n - 1; i++) { const a = base + i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  }
  return sh(new THREE.Mesh(geo(pos, nor, idx), mat), false);
}
/* 床に埋めた石の帯(平らで、端に向かって細る) */
function floorBrush(pts, wmax, wf, y, mat) {
  const pos = [], nor = [], idx = [], n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)], dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz) || 1, sx = -dz / l, sz = dx / l, w = wmax * wf(i / (n - 1)) / 2, [x, z] = pts[i];
    pos.push(x + sx * w, y, z + sz * w, x - sx * w, y, z - sz * w); nor.push(0, 1, 0, 0, 1, 0);
  }
  for (let i = 0; i < n - 1; i++) { const a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  return tag(sh(new THREE.Mesh(geo(pos, nor, idx), mat), false), { surf: true });
}
function* plazaGen(g, q) {
  const pg = tag(new THREE.Group(), { bid: BID.plaza }); g.add(pg);
  const { cx, cz, map, s: ks } = plazaFrame(), H = PLATEAU_H;
  // 床: 目地の色の下地と、温かい石の敷石(画面にそろえた格子。石ごとにわずかに色が違う)
  const pave = (s, f) => sdRBox(s, f, -.45, 2.25, 2.4, 2.6, 1.0);
  const [pcs, pcf] = [-.45, 2.3], n = 96, K = 4, pos = [], nor = [], col = [], idx = [], cj = new THREE.Color(C.joint);
  const outline = [];
  for (let i = 0; i < n; i++) { const th = i / n * TAU, ds = Math.sin(th), df = Math.cos(th); let lo = 0, hi = 6; for (let it = 0; it < 24; it++) { const m = (lo + hi) / 2; if (pave(pcs + ds * m, pcf + df * m) < 0) lo = m; else hi = m; } outline.push(lo); }
  for (let k = 0; k <= K; k++) for (let i = 0; i < n; i++) { const th = i / n * TAU, u = k / K, [x, z] = SF(pcs + Math.sin(th) * outline[i] * u, pcf + Math.cos(th) * outline[i] * u); pos.push(x, H + .005, z); nor.push(0, 1, 0); col.push(cj.r, cj.g, cj.b); }
  for (let k = 0; k < K; k++) for (let i = 0; i < n; i++) { const a = k * n + i, b = k * n + (i + 1) % n, c = a + n, d = b + n; idx.push(a, c, b, b, c, d); }
  pg.add(surf(new THREE.Mesh(geo(pos, nor, idx, col), M('#FFFFFF', { vc: true, r: .9 }))));
  yield 'plaza';
  // 敷石(縁の帯に収まる石だけ)。広場の縁は、明るい石の縁石でそろえる
  const CELL = .38, TILE = .355, tp = [], tn = [], tc = [], ti = [], base = new THREE.Color(C.pave), rr = rng(41);
  for (let a = -3.0; a < 2.2; a += CELL) for (let b = -.5; b < 5.0; b += CELL) {
    const c0 = [a + (CELL - TILE) / 2, b + (CELL - TILE) / 2], c1 = [c0[0] + TILE, c0[1] + TILE];
    if (![[c0[0], c0[1]], [c1[0], c0[1]], [c1[0], c1[1]], [c0[0], c1[1]]].every(([ss, ff]) => pave(ss, ff) < -.12)) continue;
    _col.copy(base).offsetHSL((rr() - .5) * .01, (rr() - .5) * .03, (rr() - .5) * .045 + (rr() < .08 ? -.03 : 0));
    const b0 = tp.length / 3;
    for (const [ss, ff] of [[c0[0], c0[1]], [c1[0], c0[1]], [c1[0], c1[1]], [c0[0], c1[1]]]) { const [x, z] = SF(ss, ff); tp.push(x, H + .009, z); tn.push(0, 1, 0); tc.push(_col.r, _col.g, _col.b); }
    ti.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
  }
  pg.add(surf(new THREE.Mesh(geo(tp, tn, ti, tc), M('#FFFFFF', { vc: true, r: .88 }))));
  const rim = []; for (let i = 0; i <= n; i++) { const th = i / n * TAU, o = outline[i % n]; rim.push(SF(pcs + Math.sin(th) * (o - .07), pcf + Math.cos(th) * (o - .07))); }
  pg.add(tag(ribbon(rim, .13, H + .004, .012, M(C.coping, { r: .85 })), { surf: true }));
  yield 'plaza';
  // 2本の線
  const N = q === 'low' ? 70 : 130, down = [Math.cos(deg(LAYOUT.plaza.a)), Math.sin(deg(LAYOUT.plaza.a))];
  const curve = (P, t0, t1, off) => { const out = []; for (let i = 0; i <= N; i++) { const t = lerp(t0, t1, i / N), [u, v] = bez(P, t), [x, z] = map([u, v]); out.push({ t, v, x: x + down[0] * off, z: z + down[1] * off }); } return out; };
  // 床のロゴは、ロゴの2本の線そのもの(t = 0..1。ずらさない。上から見ると、ロゴと同じ形で交差する)。
  // 空中の弧は、構造のために2か所だけロゴから離れる: 藍は左の足を同じ曲線のまま地面まで延ばす(t0 < 0)。
  // 砂は高さに応じて少し手前へずらす(足もとでは床の帯から立ち上がり、交差する高さで藍から ARC.SOFF 離れる。2本は交差して見えても触れない)
  const cI = curve(LOGO.I, ARC.I.t0, ARC.I.t1, 0), cIf = curve(LOGO.I, 0, 1, 0), cSf = curve(LOGO.S, ARC.S.t0, ARC.S.t1, 0);
  const hX = arcH(LOGO_X.v, ks) * .85;
  const cS = cSf.map(p => { const o = ARC.SOFF * smooth01(arcH(p.v, ks) / hX); return { t: p.t, v: p.v, x: p.x + down[0] * o, z: p.z + down[1] * o }; });
  // 床のロゴ(藍の石と砂の石。筆の線のように端で細る)。夜は柔らかく灯る
  const fwI = u => .35 + .65 * Math.pow(Math.sin(Math.PI * clamp01(u)), .5), fwS = u => .3 + .7 * Math.pow(Math.sin(Math.PI * clamp01(u * .85 + .08)), .55);
  const fI = floorBrush(cIf.map(p => [p.x, p.z]), .11, fwI, H + .012, M(C.inlayI, { r: .6 })); fI.userData.fx = [7, 0]; pg.add(fI);
  const fS = floorBrush(cSf.map(p => [p.x, p.z]), .11, fwS, H + .013, M(C.inlayS, { r: .7 })); fS.userData.fx = [8, 0]; pg.add(fS);
  // 空中の弧: 台座の上から、v に比例した高さで立ち上がる。筆の線のように細る
  const lifted = (c, off) => { const out = []; for (const p of c) { const h = arcH(p.v, ks); if (h <= 0 && out.length && out[out.length - 1][1] > H + PLINTH + .001) { out.push([p.x, H + PLINTH - .03, p.z]); break; } if (h > 0 || !out.length) out.push([p.x, H + PLINTH + h - (h <= 0 ? .03 : 0), p.z]); } return out.filter((p, i, a) => i === 0 || p[1] > H + PLINTH - .031); };
  const aI = lifted(cI), aS = lifted(cS.filter(p => arcH(p.v, ks) > 0 || p.t > .05));
  const twI = u => .5 + .5 * Math.pow(Math.sin(Math.PI * u), .6), twS = u => (u < .5 ? .55 + .45 * Math.sin(Math.PI * u) : .25 + .75 * Math.pow(Math.cos(Math.PI * (u - .5)), .8));
  const arcI = brushRibbon(aI, .15, .024, twI, M(C.arcI, { r: .72 })), arcS = brushRibbon(aS, .14, .022, twS, M(C.arcS, { r: .78 }));
  arcI.userData.fx = [2, 0]; arcS.userData.fx = [3, 0]; pg.add(arcI, arcS);
  // 砂の弧の縁(夕方だけ、低い光が金に照らす): 広い面の上の縁の帯と、上の細い面。昼と夜は弧と同じ色で、見分けられない
  const rimS = brushRim(aS, .14, .022, twS, .3, M(C.arcS, { r: .78 })); rimS.userData.fx = [10, 0]; rimS.castShadow = false; pg.add(rimS);
  // 藍の弧の上の縁(夕方だけ、空の藤色を拾う細い冷たい縁。砂の金より細く)。昼と夜は弧と同じ色
  const rimI = brushRim(aI, .15, .024, twI, .14, M(C.arcI, { r: .72 })); rimI.userData.fx = [11, 0]; rimI.castShadow = false; pg.add(rimI);
  // 台座(足が静かに沈む、小さな低い石)
  const plinth = (p, nxt) => { const m = cbox(.3, PLINTH, .22, M(C.stone2, { r: .85 }), .012); m.position.set(p[0], H + PLINTH / 2, p[2]); m.rotation.y = Math.atan2(nxt[0] - p[0], nxt[2] - p[2]); pg.add(m); };
  plinth(aI[0], aI[3]); plinth(aI[aI.length - 1], aI[aI.length - 4]); plinth(aS[0], aS[3]);
  yield 'plaza';
  // まわり: ベンチ(ロゴを向く)、細い街灯、植え込み(石の枠の低い箱)、植桝の木
  for (const [s, f, r] of [[-2.55, 1.25, 90], [-.95, 4.45, 180], [.6, 4.45, 180], [1.6, 2.6, -90]]) { const bn = bench(.6), [x, z] = SF(s, f); bn.position.set(x, H + .009, z); bn.rotation.y = deg(r) + Math.PI / 4; pg.add(bn); }
  for (const [s, f] of [[-2.7, .45], [-2.7, 4.2], [1.65, .5], [1.75, 4.25]]) { const l = lamp(1), [x, z] = SF(s, f); l.position.set(x, H, z); pg.add(l); }
  const r8 = rng(88);
  for (const [s, f, len] of [[-1.62, 4.95, .7], [1.42, 4.95, .7], [-2.75, 2.65, .9]]) {
    const [x, z] = SF(s, f), pl = new THREE.Group(); pl.position.set(x, H, z); pl.rotation.y = (len > .8 ? 0 : Math.PI / 2) - Math.PI / 4 + Math.PI / 2;
    pl.add(at(cbox(len, .12, .24, M(C.stoneWall, { r: .9 }), .015), 0, .06, 0), at(box(len - .06, .02, .18, M('#7E6E5B', { r: .95 })), 0, .115, 0));
    for (let i = 0; i < 3; i++) { const sb = tree(r8, 'shrub', .62, q); sb.position.set((i - 1) * len * .3, .11, 0); pl.add(sb); }
    pg.add(pl);
  }
  for (const [s, f] of [[-2.6, 1.95], [-2.6, 3.4]]) { const [x, z] = SF(s, f), t = tree(r8, 'round', .78, q); t.position.set(x, H, z); pg.add(t); const pit = treePit(.36); pit.position.set(x, H + .006, z); pg.add(pit); }
  const topI = aI.reduce((m, p) => p[1] > m[1] ? p : m, aI[0]), topS = aS.reduce((m, p) => p[1] > m[1] ? p : m, aS[0]);
  return { I: cI, S: cS, If: cIf, Sf: cSf, X: [topI[0], topI[2]], aI, aS, topI, topS };
}

/* ---------- 小さな家(町らしさのため。ふれない)。くすんだテラコッタ・灰青・生成りの屋根。夜は窓が少し灯る ---------- */
function house(rnd, wallCol, roofCol, kind = 0) {
  const g = new THREE.Group(), w = .78 + rnd() * .26, d = .72, h = kind === 1 ? .92 : .58 + rnd() * .08;
  g.add(at(cbox(w, h, d, M(wallCol), .015), 0, h / 2, 0));
  g.add(at(cbox(w + .06, .05, d + .06, M(C.stone2), .01), 0, .025, 0));
  const rf = gable2(w + .16, kind === 1 ? .36 : .4, d + .14, M(roofCol, { r: .85 })); rf.position.y = h; g.add(rf);
  if (rnd() < .55) g.add(at(cbox(.12, .3, .12, M(C.stone2), .01), w * .25, h + .3, -.1));
  for (const y of kind === 1 ? [.3, .66] : [.32]) for (const x of [-w * .24, w * .24]) {
    const p = box(.17, .2, .02, M(C.glass, { r: .3 })); p.position.set(x, y, d / 2 + .01); p.userData.fx = [1, 1]; p.userData.wid = 1 + Math.floor(rnd() * 3999); p.castShadow = false; g.add(p);
    g.add(nc(at(box(.21, .022, .04, M(C.trim)), x, y + .12, d / 2 + .02)));
  }
  g.add(at(box(.15, .28, .02, M(C.door)), kind === 1 ? 0 : w * .02, .14, d / 2 + .012));
  return g;
}
const nc = m => { m.castShadow = false; return m; };
function gable2(w, h, d, mat) {
  const s = new THREE.Shape(); s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(0, h); s.lineTo(-w / 2, 0);
  const gg = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: .015, bevelSize: .015, bevelSegments: 1 }); gg.translate(0, 0, -d / 2); return sh(new THREE.Mesh(gg, mat));
}
function busStop() {
  const g = new THREE.Group();
  g.add(at(cbox(.8, .04, .34, M(C.trim, { r: .7 }), .01), 0, .62, 0));
  g.add(at(box(.8, .5, .02, M(C.glass, { r: .3 })), 0, .34, -.15));
  for (const x of [-.38, .38]) g.add(at(cyl(.016, .016, .62, M(C.steel, { r: .5 }), 6), x, .31, -.14));
  g.add(at(cbox(.6, .05, .14, M(C.wood), .01), 0, .2, -.06));
  g.add(at(cyl(.014, .014, .8, M(C.steel, { r: .5 }), 6), .55, .4, .1), at(box(.16, .16, .02, M('#EDE6D6')), .55, .78, .1));
  return g;
}

/* ================================================================
   人(インスタンス): 体と頭の2つ。顔は描かない。スクラブ(青緑・藍)・白衣・事務服・普段着
   ================================================================ */
function personGeos() {
  const H = PERSON_H;
  const pts = [[0, 0], [.055, 0], [.06, .1], [.064, .2], [.075, .25], [.082, .3], [.07, .34], [.04, .355], [0, .36]].map(([x, y]) => new THREE.Vector2(x * H / .44, y * H / .44));
  const body = new THREE.LatheGeometry(pts, 8);
  const head = new THREE.SphereGeometry(.052 * H / .44, 8, 6); head.translate(0, .405 * H / .44, 0);
  const hc = new Float32Array(head.attributes.position.count * 3);
  for (let i = 0; i < head.attributes.position.count; i++) { const y = head.attributes.position.getY(i) - .405 * H / .44, z = head.attributes.position.getZ(i); const hair = y > -.004 || (z < -.01 && y > -.03); hc.set(hair ? [.32, .27, .24] : [1, 1, 1], i * 3); }
  head.setAttribute('color', new THREE.BufferAttribute(hc, 3));
  return { body, head };
}
const CLOTH = { scrubT: '#4E9993', scrubI: '#33446A', coat: '#F3F1EB', officeG: '#5A646E', officeN: '#2F3B4E', c1: '#C79B87', c2: '#8FB1D1', c3: '#D7C7AC', c4: '#6F8A6A', c5: '#B07F5F', c6: '#E8E2D6' };

/* ================================================================
   シーン(live と capture で共通)。opts = { only, quality: 'high' | 'mid' | 'low', ao }
   作る段取りはジェネレーター(段ごとに yield)。makeScene は一気に(撮影用)、makeSceneAsync は段のあいだに主スレッドを返す
   ================================================================ */
let QUALITY = 'high', LAST_S = null;   // LAST_S: いちばん新しく作った町(plazaOverlook() を引数なしで呼べるように)
function* buildScene(opts = {}) {
  const only = opts.only || null, q = QUALITY = opts.quality || 'high', T0 = performance.now();
  const scene = new THREE.Scene(), world = new THREE.Group(); scene.add(world);
  const rnd = rng(101), signs = [], B = {}, anchors = {};
  const dyn = { bus: null, cars: null, hcar: null, bikes: null, birds: null, clouds: null, steam: null, ripples: null, capsule: null, people: null, beam: null };
  // 建物(1棟ずつ)
  for (const id of IDS) {
    if (only && id !== only) continue;
    if (id === 'plaza') continue;
    const L = LAYOUT[id], ex = buildExterior(id, signs), [x, z] = only ? [0, 0] : polar(L.a, L.r), face = L.face ?? L.a;
    const grp = tag(ex.g, { bid: L.bid });
    grp.position.set(x, ex.y0 + (only ? 0 : groundY(x, z)), z); grp.rotation.y = only ? 0 : yawOf(face);
    world.add(grp);
    const anchor = new THREE.Object3D(); anchor.position.copy(grp.position); anchor.rotation.copy(grp.rotation); world.add(anchor);
    B[id] = { id, L, ex, grp, anchor, face, bid: L.bid, box: BOXES[id] };
    anchors[id] = anchor;
    yield 'b-' + id;
  }
  // 地面の接地の陰に使う、建物の足もと(向きのある長方形)と木(円)
  const occ = [];
  for (const id in B) {
    const b = B[id], c = Math.cos(b.grp.rotation.y), s = Math.sin(b.grp.rotation.y);
    for (const [x0, z0, x1, z1] of b.ex.foot || []) {
      const lx = (x0 + x1) / 2, lz = (z0 + z1) / 2, wx = lx * c + lz * s, wz = -lx * s + lz * c;
      occ.push({ x: b.grp.position.x + wx, z: b.grp.position.z + wz, c, s: -s, hx: (x1 - x0) / 2, hz: (z1 - z0) / 2, k: .3, fall: .32, reach: Math.max(x1 - x0, z1 - z0) / 2 + 1.4 });
    }
  }
  let plazaInfo = null, pathPts = {};
  const trees = [];
  if (!only) {
    // 町の小さな家(奥の左に寄せて、家並みに)
    const houses = [[-118, 6.55, C.houseA, C.roofA, 0, -40], [-131, 5.75, C.houseB, C.roofB, 1, -15], [-143, 6.35, C.houseC, C.roofC, 0, 10], [-156, 5.55, C.houseA, C.roofB, 0, 25], [-166, 6.6, C.houseB, C.roofA, 1, 5], [171, 6.65, C.houseC, C.roofA, 0, -20], [-104, 6.95, C.houseB, C.roofC, 0, -60]];
    for (const [psi, r, wc, rc, kind, fpsi] of houses) {
      const h = house(rnd, wc, rc, kind), [x, z] = SF(r * Math.sin(deg(psi)), r * Math.cos(deg(psi)));
      h.position.set(x, groundY(x, z), z); h.rotation.y = yawOf(45 - fpsi); world.add(h);
      occ.push({ x, z, c: 1, s: 0, hx: .5, hz: .5, k: .25, fall: .25, reach: 1.6 });
    }
    // 木: 建物・道・倒れる壁の範囲は避ける
    const keepOut = (x, z, pad = 0) => {
      const [s, f] = toSF(x, z);
      if (plateauSF(s, f) < .35 + pad) return true;
      const rr = Math.hypot(x, z); if (Math.abs(rr - ROAD_R) < ROAD_W / 2 + .22) return true;
      if (rr > islandR(Math.atan2(z, x)) - .3) return true;
      for (const id in B) {
        const b = B[id], bx = BOXES[id], dx = x - b.grp.position.x, dz = z - b.grp.position.z, c = Math.cos(-b.grp.rotation.y), sn = Math.sin(-b.grp.rotation.y), lx = dx * c - dz * sn, lz = dx * sn + dz * c;
        if (id === 'park') { if (Math.abs(lx) < bx.w / 2 + .1 && Math.abs(lz) < bx.d / 2 + .1) return true; continue; }
        const hw = (bx.shape === 'tower' ? 1.25 : bx.w / 2 + .5) + pad, hd = bx.shape === 'tower' ? 1.25 : bx.d / 2 + .45;
        if (Math.abs(lx) < hw && lz > -hd - .25 && lz < hd + (b.ex.fall === 'hinge' ? bx.h + .5 : .3)) return true;
        if (id === 'hospital' && lx > 1.5 && lx < 4.6 && lz > -1.5 && lz < 1.9) return true;
      }
      for (const pts of Object.values(pathPts)) for (let i = 0; i < pts.length; i += 2) if (Math.hypot(x - pts[i][0], z - pts[i][1]) < .32) return true;
      return false;
    };
    const inFall = (x, z) => { for (const id in B) { const b = B[id], bx = BOXES[id]; if (b.ex.fall !== 'hinge' || id === 'hospital') continue; const dx = x - b.grp.position.x, dz = z - b.grp.position.z, c = Math.cos(-b.grp.rotation.y), sn = Math.sin(-b.grp.rotation.y), lx = dx * c - dz * sn, lz = dx * sn + dz * c; if (Math.abs(lx) < bx.w / 2 + .3 && lz > bx.d / 2 && lz < bx.d / 2 + bx.h + .4) return true; } return false; };
    yield 'houses';
    pathPts = paths(world);
    const dp = drivePts(B); world.add(tag(ribbon(dp, .5, (x, z) => groundY(x, z) + .006, .01, M(C.road, { r: .95 })), { surf: true })); pathPts.drive = dp;
    yield 'houses+paths';
    const plant = (x, z, kind, s, pit) => { if (keepOut(x, z)) return false; const t = tree(rnd, kind, s, q); t.position.set(x, groundY(x, z), z); t.rotation.y = rnd() * TAU; world.add(t); trees.push([x, z, s]); if (pit) { const p = treePit(.32); p.position.set(x, groundY(x, z) + .004, z); world.add(p); } return true; };
    // 縁の木立: 群れと切れ目(群れごとに数・大きさ・種類を変える)。手前の弧は並木にする
    for (const [ac, hw, n] of EDGE_GROVES) {
      for (let i = 0; i < n; i++) {
        const a = deg(ac + (rnd() * 2 - 1) * hw), R = islandR(a), rr = R - .45 - rnd() * .75, k = rnd();
        plant(Math.cos(a) * rr, Math.sin(a) * rr, k < .3 ? 'cone' : k < .4 ? 'ochre' : 'round', .74 + rnd() * .38);
      }
    }
    yield 'groves';
    // 並木(手前の弧。道の外側に、植桝つき。階段の正面はあけ、端は広葉樹で終える。高さに少し変化)
    AVENUE.forEach(([ps, sc], i) => { const a = deg(45 - ps), rr = ROAD_R + ROAD_W / 2 + .42 + (i % 2 ? .06 : 0); plant(Math.cos(a) * rr, Math.sin(a) * rr, i === 0 || i === AVENUE.length - 1 ? 'round' : 'column', sc, true); });
    // 奥の木立(病院の後ろの緑の背景)と、町並みのあいだの木
    for (const [s, f, k, sc] of [[-1.6, -4.15, 'round', 1.05], [-2.4, -3.7, 'cone', 1], [1.3, -3.6, 'round', .95], [-.2, -5.9, 'cone', 1.1], [.6, -6.3, 'round', 1], [-3.3, -4.6, 'round', .9], [-4.6, -1.9, 'round', .95], [-3.9, -1.2, 'cone', .9], [3.6, -6.1, 'round', .9], [-3.0, 4.95, 'round', .9], [-5.0, 3.7, 'cone', .95], [5.6, 3.1, 'round', .85], [2.1, 6.4, 'shrub', 1.3], [-2.1, 6.3, 'shrub', 1.2], [4.2, -.3, 'shrub', 1.1], [-5.8, 1.6, 'shrub', 1.2], [5.1, -4.3, 'cone', .95]]) {
      const [x, z] = SF(s, f); plant(x, z, k, sc);
    }
    // 生け垣(台地の縁の上、広場の脇)
    for (const [s, f, len, r] of [[-2.42, 1.15, 1.1, 0], [-2.42, 3.55, .9, 0], [2.55, -1.0, .8, 0]]) { const hg = hedge(len, M(C.leaf[2], { r: .95 }), .14, .16), [x, z] = SF(s, f); hg.position.set(x, PLATEAU_H, z); hg.rotation.y = deg(r) - Math.PI / 4; world.add(hg); }
    for (const [x, z, s] of trees) occ.push({ x, z, r: .18 * s, k: .22, fall: .28, reach: 1.2 });
    // 街灯(環状の道の内側にそって、まばらに)とバス停(広場の正面の階段の先と、奥の家並み)
    const lampAt = [];
    for (const i of [0, 1, 2, 7, 8]) { const a = i * 40 + 22, rr = ROAD_R - ROAD_W / 2 - .16, [x, z] = polar(a, rr); if (inFall(x, z)) continue; const l = lamp(1); l.position.set(x, .01, z); world.add(l); lampAt.push(a); }
    lampPools(world, dyn, lampAt);
    const stops = [[-16, ROAD_R - ROAD_W / 2 - .42], [-148, ROAD_R - ROAD_W / 2 - .42]];
    for (const [ps, r] of stops) { const s = busStop(), a = 45 - ps, [x, z] = polar(a, r); s.position.set(x, .01, z); s.rotation.y = yawOf(a + 180); world.add(s); }
    dyn.stops = stops.map(([ps]) => deg(45 - ps));
    dyn.stopPos = stops.map(([ps, r]) => polar(45 - ps, r));
    yield 'trees+lamps';
    // 島
    const sk = yield* skirtGen(rnd, q); world.add(sk.mesh); yield 'skirt';
    world.add(yield* groundMeshGen(occ, q));
    world.add(yield* rockMassGen(rnd, sk.bottom, q)); yield 'rock';
    yield* plateauGen(world, occ, q); yield 'plateau';
    roads(world, rnd);
  }
  if (!only || only === 'plaza') plazaInfo = yield* plazaGen(world, q);
  yield 'plaza';

  // 文字のある小さな札(「診療中」と BRIDGE のマーク)。1枚の絵にまとめて、1回で描く
  const atlas = signAtlas();
  yield 'atlas';
  for (const s of signs) {
    const b = Object.values(B).find(v => v.bid === s.bid); if (!b) continue;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), atlas.mat); m.userData.keep = true; m.userData.sign = s;
    const uv = atlas.uv[s.key], a = m.geometry.attributes.uv;
    for (let i = 0; i < a.count; i++) a.setXY(i, uv[0] + a.getX(i) * (uv[2] - uv[0]), uv[1] + a.getY(i) * (uv[3] - uv[1]));
    m.position.set(...s.pos); b.grp.add(m); s.mesh = m; s.b = b;
  }

  // 人と乗り物
  if (!only) people(world, dyn, rnd, B, plazaInfo, pathPts);
  yield 'people';
  if (!only) vehicles(world, dyn, B);
  yield 'vehicles';
  if (!only) sky(scene, world, dyn, rnd, q);
  steamAndWater(world, dyn, B, only);
  if (B.observatory) beam(dyn, B.observatory);
  yield 'sky';

  // 低い品質: 小さな物は影を落とさない(木の影は残す)
  if (q === 'low') world.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.geometry && o.geometry.boundingSphere === null) o.geometry.computeBoundingSphere(); if (o.isMesh && !o.isInstancedMesh && o.geometry.boundingSphere && o.geometry.boundingSphere.radius * Math.max(o.scale.x, o.scale.y, o.scale.z) < .08) o.castShadow = false; });
  // 霧(奥ほどわずかに霞む。空の色に寄せる)
  scene.fog = new THREE.Fog('#E3EBEE', 82, 132);
  // まとめる(接地の陰もこの中で、区切りながら)
  AO_MS = 0;
  const tb = performance.now(), baked = yield* bakeStaticGen(world, !only && (opts.ao ?? q !== 'low')), bakeMs = performance.now() - tb;
  return (LAST_S = { scene, world, B, anchors, dyn, signs, baked, plazaInfo, stats: { bakeMs, aoMs: AO_MS + GROUND_MS, groundMs: GROUND_MS, quality: q, totalMs: performance.now() - T0 } });
}
/* 夜の街灯の光のたまり(環状の道の上に、控えめに)。柔らかい丸の模様を足し算で重ねる面を、1つにまとめて1回で描く。
   強さは U.uNight(夕方から夜に灯る)。昼は描かない(placeSky が見えなくする) */
function lampPools(world, dyn, angles) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64; const x = cv.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.3, 'rgba(255,255,255,.6)'); g.addColorStop(.65, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const pos = [], uv = [], idx = [];
  for (const ad of angles) {
    const a = deg(ad), cx = Math.cos(a) * (ROAD_R - .22), cz = Math.sin(a) * (ROAD_R - .22), tx = -Math.sin(a), tz = Math.cos(a), nx = Math.cos(a), nz = Math.sin(a), RT = .95, RN = .62, b = pos.length / 3;
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { const du = (u * 2 - 1) * RT, dv = (v * 2 - 1) * RN; pos.push(cx + tx * du + nx * dv, .03, cz + tz * du + nz * dv); uv.push(u, v); }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);   // 上を向く面(片面で1回だけ描く)
  }
  const geom = new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geom.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geom.setIndex(idx); geom.computeBoundingSphere();
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: '#FFC88A', transparent: true, opacity: .5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false });
  mat.onBeforeCompile = s => { s.uniforms.uNight = U.uNight; s.fragmentShader = 'uniform float uNight;\n' + s.fragmentShader.replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a *= uNight;'); };
  mat.customProgramCacheKey = () => 'hk-pool';
  const m = new THREE.Mesh(geom, mat); m.userData.keep = true; m.renderOrder = 1; m.visible = false; world.add(m);
  dyn.pools = { mesh: m };
}
/* 縁の木立の群れ: [島の角度の中心, 半分の幅(度), 本数]。あいだは切れ目 */
const EDGE_GROVES = [[118, 8, 4], [150, 12, 6], [181, 7, 3], [204, 9, 5], [236, 6, 3], [258, 11, 6], [288, 7, 4], [312, 5, 2], [333, 9, 4], [356, 5, 2]];
/* 手前の並木: [画面の角度 ψ, 大きさ]。正面の階段の前(ψ ≈ 0)はあける */
const AVENUE = [[-47, .9], [-37, .86], [-27, .92], [-16, .82], [11, .9], [22, .84], [33, .95], [44, .88]];
/* 一気に作る(撮るとき)。返り値の stats に、作るのにかかった時間 */
export function makeScene(opts = {}) { return runGen(buildScene(opts)); }
/* 段のあいだに主スレッドを返しながら作る(ページで、止めた画像から立体へ替わるとき)。返り値は makeScene と同じ
   opts.budget(ms)ごとに休む。stats.maxBlockMs に、いちばん長く主スレッドを止めた時間 */
const yieldMain = () => new Promise(res => { const sch = globalThis.scheduler; if (sch && typeof sch.yield === 'function') sch.yield().then(res); else { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); } });
export async function makeSceneAsync(opts = {}) {
  const g = buildScene(opts), budget = opts.budget ?? 12;
  let r, t0 = performance.now(), ts = t0, maxBlock = 0, slices = 0, worst = '';
  const steps = {};
  for (;;) {
    r = g.next(); const now = performance.now(); if (r.done) break;
    const lab = r.value || '?'; steps[lab] = Math.max(steps[lab] || 0, now - ts); ts = now;
    const dt = now - t0;
    if (dt > budget) { if (dt > maxBlock) { maxBlock = dt; worst = lab; } slices++; await yieldMain(); t0 = ts = performance.now(); }
  }
  maxBlock = Math.max(maxBlock, performance.now() - t0);
  Object.assign(r.value.stats, { maxBlockMs: maxBlock, slices, worst, steps });
  return r.value;
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

/* ---------- 人: 建物の役割と時間帯に結びつけて動く(BRIEF 10.2「町の生活感」)。目立つ出来事は約5秒に1つ、騒がしくしない ----------
   腕と腿は、中の担当(interiors.js)の LIMB_GEO・LIMB と同じ形と寸法(公園の中の人とそろえる)。interiors.js は建物をひらいたときに
   読まれるので、町を先に出すために、同じ定義をここに置く */
const LIMB_GEO = (() => { const g = new THREE.CylinderGeometry(1, .9, 1, 5, 1, true); g.translate(0, -.5, 0); return g; })();
const LIMB = { shoulder: [.082, .3], upper: .085, fore: .08, armR: .016, foreR: .014, hip: [.036, .075], thigh: .12, legR: .021, shinR: .018 };
/* 出来事の暦: CYC 秒の輪の中に、5.2 秒おきに出来事が始まる。時間帯(昼・夕・夜)ごとに並びが違う。夜は静か */
const CYC = 36.4, SLOT = 5.2;
const SCHED = [
  ['commute', 'library', 'ambulance', 'lunch', 'clinic', 'gallery', 'commute2'],
  ['bus', 'library', 'ambulance', 'clinic', 'gallery', 'bus2', null],
  ['night', null, 'ambulance', null, 'night2', null, null]
];
const EVD = { commute: 16, commute2: 16, lunch: 27, library: 21, clinic: 13, gallery: 17, bus: 24, bus2: 24, night: 15, night2: 15, ambulance: 24 };
function people(world, dyn, rnd, B, plazaInfo, pathPts) {
  const { body, head } = personGeos();
  const N = 42;
  const mk = (g, vc) => { const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ roughness: .85, vertexColors: !!vc }), N); m.castShadow = true; m.receiveShadow = false; m.frustumCulled = false; world.add(m); return m; };
  const bodyM = mk(body), headM = mk(head, true); headM.castShadow = false;
  const skins = ['#EECFB8', '#E0BB9B', '#CBA282'], col = new THREE.Color();
  const doorOf = (id, k = 0) => { const b = B[id]; if (!b) return null; const [dx, dz] = b.ex.door; const v = new THREE.Vector3(dx + k, 0, dz).applyEuler(b.grp.rotation).add(b.grp.position); v.y = 0; return v; };
  const fwd = id => new THREE.Vector3(0, 0, 1).applyEuler(B[id].grp.rotation);
  const kinds = [];
  // ふだんの人: 環状の道のわき、広場、建物の出入り、小道、立ち話(昼は多く、夜は少ない)
  const ringR = ROAD_R - ROAD_W / 2 - .12;
  for (let i = 0; i < 10; i++) kinds.push({ k: 'ring', r: ringR + (i % 2 ? .04 : -.04), dir: i % 3 ? 1 : -1, ph: rnd() * TAU, sp: .04 + rnd() * .025, o: i % 4 === 0 ? 'scrubT' : null, when: i < 4 ? [1, 1, 1] : i < 7 ? [1, 1, 0] : [1, 0, 0] });
  // 広場を歩く人: 敷石の中の楕円(病院の前と、弧の高い所の下)。弧の足・台座・ベンチ・石垣にはかからない
  for (let i = 0; i < 4; i++) { const v = rnd(); kinds.push({ k: 'plaza', e: [-.45, 2.0, 1.7 + v * .25, 1.25 + v * .22], dir: i % 2 ? 1 : -1, ph: rnd() * TAU, sp: .085 + rnd() * .04, when: i < 2 ? [1, 1, 0] : [1, 0, 0] }); }
  const doorSet = [['hospital', 'scrubT', [1, 1, 1], -.35], ['hospital', 'coat', [1, 1, 0], .4], ['clinic', 'c1', [1, 1, 0], 0], ['office', 'officeN', [1, 1, 0], 0], ['library', 'c4', [1, 1, 0], 0], ['atelier', 'c5', [1, 1, 1], 0], ['observatory', 'c2', [1, 0, 0], 0]];
  for (const [id, o, when, k] of doorSet) { const d = doorOf(id, k); if (d) kinds.push({ k: 'door', id, door: d, out: fwd(id), ph: rnd() * 30, per: 16 + rnd() * 12, o, when }); }
  for (const [id, o, when] of [['back', 'c1', [1, 1, 0]], ['park', 'c4', [1, 1, 0]], ['obs', 'c5', [1, 0, 0]], ['library', 'c2', [1, 0, 0]]]) {
    const pts = pathPts[id]; if (pts) kinds.push({ k: 'path', pts, ph: rnd() * 40, per: 22 + rnd() * 10, o, when });
  }
  const [p2x, p2z] = SF(-3.2, -5.2), [p3x, p3z] = SF(4.0, 1.9);
  for (const [x, z, when] of [[p2x, p2z, [1, 1, 0]], [p3x, p3z, [1, 0, 0]]]) for (const s of [-1, 1]) kinds.push({ k: 'chat', p: new THREE.Vector3(x + s * .13, 0, z), face: s > 0 ? -Math.PI / 2 : Math.PI / 2, ph: rnd() * TAU, when, gest: s > 0 });
  // 出来事の人(暦で出てくる)
  const toXZ = pts => pts.map(([s, f]) => SF(s, f));
  const COMMUTE = curveSF([[-1.5, 6.72], [-.9, 6.38], [-.28, 6.1], [0, 5.95], [0, 5.12], [-.06, 4.4], [.05, 3.0], [0, 1.6], [0, .32]], .08);
  const LUNCH = curveSF([[0, .32], [-.8, .7], [-1.7, 1.05], [-2.3, 1.25]], .08);
  const ev = (k, o, extra = {}) => kinds.push(Object.assign({ k: 'ev', ev: k, o }, extra));
  ev('commute', 'scrubT', { pts: COMMUTE, d: 0 }); ev('commute', 'coat', { pts: COMMUTE, d: .9 });
  ev('commute2', 'officeG', { pts: COMMUTE, d: 0 });
  ev('lunch', 'scrubI', { pts: LUNCH, seat: -.15 }); ev('lunch', 'coat', { pts: LUNCH, seat: .15, d: .5 });
  ev('library', 'c3', { seated: true });
  ev('clinic', 'c6', { pts: pathPts.clinic });
  ev('gallery', 'c2');
  // バスを待つ人: 道の内側の縁(車線にかからない所)。歩く道の終わりを、その人の待つ所にする(着いたときに跳ばない)
  const BUSC = [[.1, 4.5], [0, 5.12], [0, 5.95], [-.4, 6.25], [-1.0, 6.5]], toWait = w => ({ pts: curveSF([...BUSC, w], .08), wait: SF(...w) });
  ev('bus', 'c1', toWait([-1.32, 6.74])); ev('bus', 'officeG', Object.assign(toWait([-1.12, 6.56]), { d: .7 }));
  ev('bus2', 'c4', toWait([-1.26, 6.4]));
  ev('night', 'scrubT', { pts: COMMUTE, d: 0 }); ev('night2', 'scrubI', { pts: COMMUTE, d: 0 });
  void toXZ;
  while (kinds.length > N) kinds.pop();
  // 服の色と袖(スクラブは半袖で、前腕は肌)。座る人には腿とすねも
  const outfits = ['scrubT', 'scrubI', 'coat', 'c1', 'officeG', 'c2', 'officeN', 'c3', 'c4', 'c5', 'c6', 'c2', 'c3'];
  let nl = 0;
  kinds.forEach((k, i) => { k.li = nl; k.ln = k.k === 'ev' && (k.ev === 'lunch' || k.seated) ? 8 : 4; nl += k.ln; });
  const limbM = new THREE.InstancedMesh(LIMB_GEO, new THREE.MeshStandardMaterial({ roughness: .85 }), nl); limbM.frustumCulled = false; limbM.castShadow = false; world.add(limbM);
  const P = [];
  kinds.forEach((k, i) => {
    const o = k.o || outfits[i % outfits.length], cloth = CLOTH[o], skin = skins[i % 3], pants = o === 'scrubT' || o === 'scrubI' ? cloth : ['#4B5563', '#5B544D', '#3E4A5C', '#6B6355'][i % 4];
    const short = o === 'scrubT' || o === 'scrubI' || (o.startsWith('c') && i % 3 === 0);
    bodyM.setColorAt(i, col.set(cloth)); headM.setColorAt(i, col.set(skin));
    const cols = [cloth, short ? skin : cloth, cloth, short ? skin : cloth, pants, pants, pants, pants];
    for (let j = 0; j < k.ln; j++) limbM.setColorAt(k.li + j, col.set(cols[j]));
    P.push(Object.assign(k, { i, pos: new THREE.Vector3(), yaw: 0, s: 1 }));
  });
  for (let i = kinds.length; i < N; i++) { bodyM.setColorAt(i, col.set('#FFFFFF')); headM.setColorAt(i, col.set('#FFFFFF')); }
  bodyM.count = headM.count = kinds.length;
  dyn.people = { bodyM, headM, limbM, P, B };
}
/* 時間帯(applyTod が覚える。0 昼 / 1 夕 / 2 夜)。live.js を変えずに、人の動きを時間帯で変える */
let TODK = 0;
const whenK = w => { const i = Math.min(1, Math.floor(TODK)), k = TODK - i; return lerp(w[i], w[Math.min(2, i + 1)], k); };
const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qt = new THREE.Quaternion(), _s = new THREE.Vector3(), _mt = new THREE.Matrix4(), _p = new THREE.Vector3(), _j = new THREE.Vector3(), _w = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const AXX = new THREE.Vector3(1, 0, 0), AXZ = new THREE.Vector3(0, 0, 1), ZERO3 = new THREE.Vector3(0, 0, 0);
/* 毎こま呼ばれる関数は、新しい物を作らない(下の作業用の物を使い回す)。長く動かしても記憶域が増えず、ごみ集めで止まらないように */
const _AP = [0, 0, 0], _o3 = new THREE.Object3D(), _loc = new THREE.Vector3(), _cR = new THREE.Color();
function alongPath(pts, u) { const n = pts.length - 1, f = clamp01(u) * n, i = Math.min(n - 1, Math.floor(f)), k = f - i, a = pts[i], b = pts[i + 1]; _AP[0] = lerp(a[0], b[0], k); _AP[1] = lerp(a[1], b[1], k); _AP[2] = Math.atan2(b[0] - a[0], b[1] - a[1]); return _AP; }
/* いまの時間帯の暦で、出来事 name が動いていれば 0..1、動いていなければ -1 */
/* バスに乗る出来事は、バスの時刻表(2つの輪 = BUS_P 秒で一周、偶数の輪の ct = BUS_PH 秒に前のバス停)に合わせて、
   bus は偶数の輪、bus2 は奇数の輪(待っているあいだに、次の偶数の輪の初めにバスが来る)だけ起こす */
const EV_PAR = { bus: 0, bus2: 1 };
function evU(name, t) {
  const sch = SCHED[Math.round(clamp(TODK, 0, 2))], ct = ((t % CYC) + CYC) % CYC;
  for (let k = 0; k < sch.length; k++) if (sch[k] === name) {
    const u = (((ct - k * SLOT) % CYC) + CYC) % CYC / EVD[name]; if (u > 1) continue;
    if (name in EV_PAR) { const idx = Math.floor((t - u * EVD[name] + 1e-3) / CYC); if ((((idx % 2) + 2) % 2) !== EV_PAR[name]) continue; }
    return u;
  }
  return -1;
}
/* 出来事のその回の番号(始まった時刻)。乗った人が、バスが出たあとにまた現れないように覚えておく */
const evStart = (name, t, u) => Math.round((t - u * EVD[name]) * 10);
export function placePeople(dyn, t, blocked, hide) {   // hide(x, z): v6 の舞台で、病院の正面に人を立たせない(最初の画面では渡さない)
  const D = dyn.people; if (!D) return;
  const L = D.limbM, obsOpen = Math.abs(U.uOpenA.value - 2) < .5 || Math.abs(U.uOpenB.value - 2) < .5;
  for (let pi = 0; pi < D.P.length; pi++) {
    const p = D.P[pi];
    let x = 0, z = 0, y = 0, yaw = 0, s = 1, bob = 0, walk = false, sit = false, read = false, gest = false, yAbs = null;
    if (p.k === 'ring') {
      const a = p.ph + t * p.sp * p.dir; x = Math.cos(a) * p.r; z = Math.sin(a) * p.r; yaw = -a + (p.dir > 0 ? 0 : Math.PI); walk = true;
    } else if (p.k === 'plaza') {
      const a = p.ph + t * p.sp * p.dir, e = p.e, ps = e[0] + Math.sin(a) * e[2], pf = e[1] + Math.cos(a) * e[3], ds = Math.cos(a) * e[2] * p.dir, df = -Math.sin(a) * e[3] * p.dir;
      x = (ps + pf) * R2; z = (pf - ps) * R2; yaw = Math.atan2((ds + df) * R2, (df - ds) * R2); walk = true;
    } else if (p.k === 'door') {
      const u = ((t + p.ph) % p.per) / p.per, d = p.door, out = p.out;
      const far = 1.2, wk = u < .45 ? u / .45 : u < .55 ? 1 : u < 1 ? 1 - (u - .55) / .45 : 0;
      const sw = Math.sin(wk * 3) * .22;   // 横へのふらつき(出入りの向きに直角)
      x = d.x + out.x * far * wk - out.z * sw; z = d.z + out.z * far * wk + out.x * sw;
      yaw = Math.atan2(out.x, out.z) + (u < .5 ? 0 : Math.PI); walk = !(u > .45 && u < .55);
      s = u < .04 ? u / .04 : u > .96 ? (1 - u) / .04 : 1;
    } else if (p.k === 'path') {
      const u = ((t + p.ph) % p.per) / p.per, k = u < .46 ? u / .46 : u < .54 ? 1 : 1 - (u - .54) / .46, ap = alongPath(p.pts, smooth01(k) * .98 + .01);
      x = ap[0]; z = ap[1]; yaw = ap[2] + (u < .5 ? 0 : Math.PI); s = u < .03 ? u / .03 : u > .97 ? (1 - u) / .03 : 1; walk = !(u > .46 && u < .54);
    } else if (p.k === 'chat') {
      x = p.p.x; z = p.p.z; yaw = p.face + Math.sin(t * .9 + p.ph) * .15; bob = Math.sin(t * 2 + p.ph) * .004; gest = p.gest && Math.sin(t * .7 + p.ph) > .2;
    } else if (p.k === 'ev') {
      const u = evU(p.ev, t);
      if (u < 0) s = 0;
      else if (p.ev === 'commute' || p.ev === 'commute2' || p.ev === 'night' || p.ev === 'night2') {
        // 朝の出勤・夜勤: バス停から階段を上り、広場を通って病院の正面へ(入口の前で消える)
        const k = clamp01((u - (p.d || 0) * .06) / .92), ap = alongPath(p.pts, k); x = ap[0]; z = ap[1]; yaw = ap[2]; walk = k < 1; s = Math.min(1, k * 25, (1 - k) * 25 + (k < 1 ? 0 : 0));
      } else if (p.ev === 'lunch') {
        // 昼の休憩: 病院から出て、広場のベンチで休み、戻る
        const dd = (p.d || 0) * .03, k = u < .24 ? clamp01((u - dd) / .2) : u < .76 ? 1 : 1 - clamp01((u - .76 - dd) / .2);
        const ap = alongPath(p.pts, k); x = ap[0]; z = ap[1]; yaw = ap[2] + (u >= .76 ? Math.PI : 0); walk = k > 0 && k < 1;
        if (k >= 1) { const bf = 1.25 + p.seat; x = (-2.55 + bf) * R2; z = (bf + 2.55) * R2; yaw = deg(90) + Math.PI / 4; sit = true; walk = false; }
        s = Math.min(1, k * 20 + (u > .5 ? 1 : 0), u < .5 ? 1 : (1 - u) * 30);
      } else if (p.ev === 'clinic') {
        // 患者がクリニックの受付へ(扉の前で消える)
        const ap = alongPath(p.pts, clamp01(u / .9)); x = ap[0]; z = ap[1]; yaw = ap[2]; walk = u < .9; s = Math.min(1, u * 30, (1 - u) * 12);
      } else if (p.ev === 'library') {
        // 図書館の階段を上り、上の段に腰かけて本を読む
        const b = D.B.library, bx2 = BOXES.library, F = bx2.d / 2 + WALL + .004, y0 = b.ex.y0;
        const k = clamp01(u / .25), loc = _loc.set(.55, 0, 0);
        if (k < 1) { loc.set(.55, lerp(-y0, -.01, smooth01(k)), lerp(F + 1.1, F + .3, k)); walk = true; yaw = b.grp.rotation.y + Math.PI; }
        else { loc.set(.55, -.01, F + .3); sit = true; read = true; yaw = b.grp.rotation.y; }
        loc.applyEuler(b.grp.rotation).add(b.grp.position); x = loc.x; z = loc.z; yAbs = loc.y + (sit ? .02 : 0);
        s = Math.min(1, u * 25, (1 - u) * 20);
      } else if (p.ev === 'gallery') {
        // 展望台の回廊に人が出て、回廊を歩き、遠くを見る(ひらいている間は出ない)
        const b = D.B.observatory, h = BOXES.observatory.h, k = clamp01(u / .4), ph = deg(lerp(18, 72, smooth01(k))), R0 = .8;
        x = b.grp.position.x + Math.cos(ph) * R0; z = b.grp.position.z + Math.sin(ph) * R0; yAbs = b.grp.position.y + h + .115;
        yaw = k < 1 ? Math.atan2(-Math.sin(ph), Math.cos(ph)) : Math.atan2(Math.cos(ph), Math.sin(ph)); walk = k < 1;
        s = obsOpen ? 0 : Math.min(1, u * 25, (1 - u) * 20);
      } else if (p.ev === 'bus' || p.ev === 'bus2') {
        // 夕方: 広場から階段を下りてバス停へ。バスが前のバス停に止まったら乗る(消える)
        const k = clamp01((u - (p.d || 0) * .05) / .4), ap = alongPath(p.pts, k);
        x = ap[0]; z = ap[1]; yaw = ap[2]; walk = k < 1;
        if (k >= 1) { x = p.wait[0]; z = p.wait[1]; yaw = Math.atan2(-x, -z) + Math.PI; }
        const bus = dyn.bus, id = evStart(p.ev, t, u), boarded = k >= 1 && bus && bus.stopped !== null && bus.stopped !== undefined && Math.abs(angDiff(bus.stopped, dyn.stops[0])) < .01 && bus.wait < STOP_DWELL * .5;
        if (boarded) p.gone = id;
        s = p.gone === id ? 0 : Math.min(1, u * 25, (1 - u) * 20);
      }
    }
    // 時間帯で、外にいる人の数を変える(消えるときは、ゆっくり小さく)
    if (p.when) s *= whenK(p.when);
    if (walk) bob = Math.abs(Math.sin(t * 7 + p.i)) * .012;
    y = yAbs !== null ? yAbs : y + groundY(x, z) + (sit ? .19 : 0);
    if (blocked && blocked(x, z)) y += WALL;
    if (hide && hide(x, z)) s = 0;
    const sy = sit ? .7 : 1;
    _p.set(x, y + bob, z); _q.setFromAxisAngle(_up, yaw); _s.set(s, s * sy, s); _mt.compose(_p, _q, _s);
    D.bodyM.setMatrixAt(p.i, _mt);
    _w.set(0, (sy * .36 + .045 - .405) * s, 0); _p.add(_w); _s.set(s, s, s); _mt.compose(_p, _q, _s); D.headM.setMatrixAt(p.i, _mt);
    _p.sub(_w);
    // 腕(肩から、ひじで曲がる)。歩く人は振り、話す人は片手で身ぶり、座る人は膝の上、読む人は本を胸の前に
    const sw = walk ? Math.sin(t * 3.5 + p.i) * .38 : 0, gA = .55 + .2 * Math.sin(t * 1.3 + p.ph);
    for (let si = 0; si < 2; si++) {
      const side = si ? -1 : 1, j = p.li + (side > 0 ? 0 : 2);
      let a, sp, e;   // 肩の前への振り・横への開き・ひじの曲げ
      if (read) { a = .85; sp = .1; e = 1.25; } else if (sit) { a = .5; sp = .08; e = .75; } else if (gest && side > 0) { a = gA; sp = .15; e = 1.05; } else { const w = side * sw; a = .06 + w; sp = .1; e = .18 + Math.max(0, w) * .4; }
      if (s < .01) { _mt.compose(_w.set(0, -20, 0), _q2.identity(), ZERO3); L.setMatrixAt(j, _mt); L.setMatrixAt(j + 1, _mt); continue; }
      _j.set(side * LIMB.shoulder[0] * s, sy * LIMB.shoulder[1] * s, 0).applyQuaternion(_q).add(_p);
      _q2.copy(_q).multiply(_qt.setFromAxisAngle(AXZ, side * sp)).multiply(_qt.setFromAxisAngle(AXX, -a));
      _mt.compose(_j, _q2, _s.set(LIMB.armR * s, LIMB.upper * s, LIMB.armR * s)); L.setMatrixAt(j, _mt);
      _j.add(_w.set(0, -LIMB.upper * s, 0).applyQuaternion(_q2));
      _q2.multiply(_qt.setFromAxisAngle(AXX, -e));
      _mt.compose(_j, _q2, _s.set(LIMB.foreR * s, LIMB.fore * s, LIMB.foreR * s)); L.setMatrixAt(j + 1, _mt);
    }
    // 座る人の腿とすね(腿は座面で前へ、すねは下へ)
    if (p.ln > 4) for (let si = 0; si < 2; si++) {
      const side = si ? -1 : 1, j = p.li + (side > 0 ? 4 : 6);
      if (!sit || s < .01) { _mt.compose(_w.set(0, -20, 0), _q2.identity(), ZERO3); L.setMatrixAt(j, _mt); L.setMatrixAt(j + 1, _mt); continue; }
      _j.set(side * LIMB.hip[0] * s, LIMB.hip[1] * sy * s, 0).applyQuaternion(_q).add(_p);
      _q2.copy(_q).multiply(_qt.setFromAxisAngle(AXZ, side * .04)).multiply(_qt.setFromAxisAngle(AXX, -(Math.PI / 2 - .1)));
      _mt.compose(_j, _q2, _s.set(LIMB.legR * s, LIMB.thigh * s, LIMB.legR * s)); L.setMatrixAt(j, _mt);
      _j.add(_w.set(0, -LIMB.thigh * s, 0).applyQuaternion(_q2));
      _q2.multiply(_qt.setFromAxisAngle(AXX, Math.PI / 2 - .1));
      const shin = clamp(_j.y - (yAbs !== null ? yAbs - .14 : groundY(x, z)), .04, .2);
      _mt.compose(_j, _q2, _s.set(LIMB.shinR * s, shin, LIMB.shinR * s)); L.setMatrixAt(j + 1, _mt);
    }
  }
  D.bodyM.instanceMatrix.needsUpdate = true; D.headM.instanceMatrix.needsUpdate = true; L.instanceMatrix.needsUpdate = true;
}

/* ---------- 乗り物: 環状の道のバス(バス停で止まる)・車・自転車、救急口に着く白い車(青緑の線。赤十字は使わない) ---------- */
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
  bg.add(at(box(1.16, .05, .425, M(C.busBand, { r: .6 })), 0, .2, 0));
  bg.add(at(box(.96, .13, .43, M('#4E5D6C', { r: .3 })), -.02, .37, 0), at(box(.02, .17, .38, M('#4E5D6C', { r: .3 })), .575, .33, 0));
  for (const [x, z] of [[-.36, -.2], [.36, -.2], [-.36, .2], [.36, .2]]) { const w = cyl(.08, .08, .06, M(C.tire), 10); w.rotation.x = Math.PI / 2; w.position.set(x, .08, z); bg.add(w); }
  // 動く物は、まとめる(bakeStatic)対象から外す(keep)。外さないと、島の真ん中の台地の中に固まって、走らない
  const bus = new THREE.Mesh(bakeGeo(bg), vcMat({ r: .6 })); bus.castShadow = true; bus.receiveShadow = true; bus.userData.keep = true; world.add(bus);
  dyn.bus = { mesh: bus, a: deg(100), v: 0 };
  // 車(3台・色違い。くすんだ色)
  const cg = new THREE.InstancedMesh(bakeGeo(carGroup('#FFFFFF')), vcMat({ r: .55 }), 3); cg.castShadow = true; cg.frustumCulled = false; world.add(cg);
  ['#E6E1D7', '#9AAA98', '#C2AE8E'].forEach((c, i) => cg.setColorAt(i, new THREE.Color(c)));
  // 車線: 外の車線はバスだけ(左回り)。車と自転車は内の車線を右回り(前の物には近づきすぎず、追い越さない)。最初の位置は、ひらいた建物の倒れた壁の範囲の外
  dyn.cars = { mesh: cg, list: [{ a: deg(40), sp: .08, ph: 0, half: .33 }, { a: deg(200), sp: .08, ph: 2.1, half: .33 }, { a: deg(322), sp: .08, ph: 4.2, half: .33 }] };
  // 病院の白い車(青緑の線。赤十字は使わない)。環状の道から坂を上がって、救急口の庇の下に着く
  const hc = new THREE.Mesh(bakeGeo(carGroup('#F7F6F2', C.scrub)), vcMat({ r: .5 })); hc.castShadow = true; hc.userData.keep = true; hc.visible = false; world.add(hc);
  roadCrossings(B);
  const pts = drivePts(B);
  dyn.hcar = { mesh: hc, pts, stop: new THREE.Vector3(pts[pts.length - 1][0], 0, pts[pts.length - 1][1]) };
  // 自転車(2台・乗る人つき)
  const bk = new THREE.InstancedMesh(bakeGeo(bike('#56606A')), vcMat({ r: .6 }), 2); bk.castShadow = true; bk.frustumCulled = false; world.add(bk);
  const rider = personGeos();
  const rd = new THREE.InstancedMesh(rider.body, new THREE.MeshStandardMaterial({ roughness: .85 }), 2), rh = new THREE.InstancedMesh(rider.head, new THREE.MeshStandardMaterial({ roughness: .8, vertexColors: true }), 2);
  for (const m of [rd, rh]) { m.castShadow = true; m.frustumCulled = false; world.add(m); }
  rd.setColorAt(0, new THREE.Color(CLOTH.c2)); rd.setColorAt(1, new THREE.Color(CLOTH.scrubT)); rh.setColorAt(0, new THREE.Color('#E0BB9B')); rh.setColorAt(1, new THREE.Color('#EECFB8'));
  dyn.bikes = { mesh: bk, rd, rh, list: [{ a: deg(66), sp: .08, ph: 1.3, half: .29 }, { a: deg(262), sp: .08, ph: 3.4, half: .29 }] };
  dyn.lane = [...dyn.cars.list, ...dyn.bikes.list];   // 内の車線の物(毎こま並べ直さない)
}
const STOP_DWELL = 2.6, BUS_P = 2 * CYC, BUS_PH = 11.0;
const LANE_OUT = ROAD_R + .14, LANE_IN = ROAD_R - .14, FALL_HALF = .26;   // FALL_HALF: ひらいた建物の倒れた壁の前で待つ角度
const ROADX = {};
/* 角度 a の乗り物(長さの半分 half、rad)が、どの建物の倒れた壁の範囲(ROADX ± FALL_HALF)にもかからない位置へ、進む向き dir にずらす。
   止めた画像(ひらいた姿の絵も)と、立体の最初のこまで、乗り物が倒れた壁の上やひらいた建物の前に来ないように */
function clearOfFalls(a, half, dir) {
  for (let n = 0; n < 4; n++) {
    let moved = false;
    for (const id in ROADX) { const z = ROADX[id]; if (z === null) continue; const d = angDiff(a, z); if (Math.abs(d) < FALL_HALF + half) { a = z + dir * (FALL_HALF + half + .01); moved = true; } }
    if (!moved) break;
  }
  return a;
}
function roadCrossings(B) {
  for (const id in B) {
    const b = B[id], bx = BOXES[id]; if (b.ex.fall !== 'hinge') continue;
    const dir = new THREE.Vector3(0, 0, 1).applyEuler(b.grp.rotation), p = b.grp.position, z0 = bx.d / 2 + WALL;
    let hit = null;
    for (let t = z0; t <= z0 + bx.h + .3; t += .05) { const x = p.x + dir.x * t, z = p.z + dir.z * t; if (Math.hypot(x, z) >= ROAD_R - ROAD_W / 2 - .1) { hit = Math.atan2(z, x); break; } }
    ROADX[id] = hit;
  }
}
export function placeVehicles(dyn, t, dt, blockedAng) {
  if (!dyn.bus) return;
  if (blockedAng !== null && blockedAng !== undefined) { for (let i = 0; i < IDS.length; i++) { const id = IDS[i]; if (Math.abs(angDiff(deg(LAYOUT[id].a), blockedAng)) < 1e-4) { if (id in ROADX) blockedAng = ROADX[id]; break; } } } else blockedAng = null;
  const y0 = .012;
  // バス: 外の車線を左回り。バス停の前でゆっくり止まって、また出る。ひらいた建物の倒れた壁の手前では待つ
  // 時刻表: BUS_P 秒で一周し、偶数の輪の ct = BUS_PH 秒に前のバス停(stops[0])に着く(夕方の乗る出来事と合わせる)。速さを少しだけ変えて合わせる
  const bus = dyn.bus, R = LANE_OUT, S0 = dyn.stops[0], S1 = dyn.stops[1];
  if (bus.init === undefined) {   // 初めは時刻表の位置から(倒れた壁の範囲にかかれば、その先へ)。車と自転車も、最初の位置を範囲の外へ
    bus.init = true; const ph = ((((t - BUS_PH) / BUS_P) % 1) + 1) % 1; bus.a = clearOfFalls(S0 + .02 + TAU * ph * .985, .6 / LANE_OUT, 1);
    for (const c of dyn.lane) c.a = clearOfFalls(c.a, c.half / LANE_IN, -1);
  }
  const d0 = fwdAng(bus.a, S0), d1 = fwdAng(bus.a, S1), over = 2.1 + (d1 > .004 && d1 < d0 ? STOP_DWELL + 6.2 : 0);
  let T = Math.floor((t - BUS_PH) / BUS_P) * BUS_P + BUS_PH; while (T <= t + .5) T += BUS_P;
  let need = d0 / Math.max(.5, T - t - over); while (need > .14) { T += BUS_P; need = d0 / Math.max(.5, T - t - over); }
  const cruise = clamp(need, .075, .14);
  let want = cruise;
  const stops = dyn.stops;
  for (let i = 0; i < stops.length; i++) { const d = angDiff(stops[i], bus.a); if (d > 0 && d < .2) want = Math.min(want, cruise * clamp01(d / .2) + .004); }
  if (bus.wait > 0) { bus.wait -= dt; want = 0; } else for (let i = 0; i < stops.length; i++) if (Math.abs(angDiff(stops[i], bus.a)) < .006 && !bus.stopped) { bus.wait = STOP_DWELL; bus.stopped = stops[i]; }
  if (bus.stopped !== undefined && bus.stopped !== null && Math.abs(angDiff(bus.stopped, bus.a)) > .05) bus.stopped = null;
  if (blockedAng !== null) { const d = angDiff(blockedAng - .26, bus.a); if (d > 0 && d < .3) want = Math.min(want, .11 * clamp01((d - .02) / .28)); }
  bus.v += (want - bus.v) * clamp01(dt * 2.2); bus.a += bus.v * dt;
  placeOnRing(bus.mesh, bus.a, R, y0, 1);
  // 内の車線(右回り): 車と自転車。速さは同じ(ゆっくり少し揺らぐ)。倒れた壁の手前では待ち、前の物(車でも自転車でも)に近づくと止まる
  const cars = dyn.cars, bk = dyn.bikes, lane = dyn.lane;
  for (let ci = 0; ci < lane.length; ci++) {
    const c = lane[ci];
    let sp = c.sp * (1 + .08 * Math.sin(t * .23 + c.ph));
    if (blockedAng !== null) { const d = angDiff(c.a, blockedAng + FALL_HALF); if (d > 0 && d < .3) sp *= clamp01((d - .02) / .28); }
    let gap = Infinity, ah = 0; for (let oi = 0; oi < lane.length; oi++) { const o = lane[oi]; if (o === c) continue; const d = ((c.a - o.a) % TAU + TAU) % TAU; if (d < gap) { gap = d; ah = o.half; } }
    const gl = gap * LANE_IN - c.half - ah;   // 前の物までのすき間(町の単位)
    sp = Math.min(sp, Math.max(0, gl - .14) / (1.1 * LANE_IN));
    c.v = (c.v ?? sp) + (sp - (c.v ?? sp)) * clamp01(dt * 2);
    if (dt > 0) c.v = Math.min(c.v, Math.max(0, gl - .05) / LANE_IN / dt);   // どんなにこまが飛んでも、前の物に重ならない
    c.a -= c.v * dt;
  }
  for (let i = 0; i < cars.list.length; i++) { placeOnRing(_o3, cars.list[i].a, LANE_IN, y0, -1); _o3.updateMatrix(); cars.mesh.setMatrixAt(i, _o3.matrix); }
  cars.mesh.instanceMatrix.needsUpdate = true;
  // 病院の車: 環状の道から坂を上がり、救急口に着いて止まり、また出る(30秒でひとまわり)
  const hc = dyn.hcar, u = evU('ambulance', t), pts = hc.pts;
  let k = -1, back = false;
  if (u < 0) k = -1; else if (u < .3) k = smooth01(u / .3); else if (u < .7) k = 1; else { k = 1 - smooth01((u - .7) / .3); back = true; }
  if (k >= 0) {
    let ap = alongPath(pts, k); const px = ap[0], pz = ap[1], a = ap[2]; hc.mesh.position.set(px, groundY(px, pz) + y0, pz);
    ap = alongPath(pts, Math.min(1, k + .02)); const qx = ap[0], qz = ap[1], slope = Math.atan2(groundY(qx, qz) - groundY(px, pz), Math.hypot(qx - px, qz - pz) || 1);
    hc.mesh.rotation.set(0, a - Math.PI / 2 + (back ? Math.PI : 0), back ? -slope : slope, 'YXZ');
    hc.mesh.visible = true;
  } else hc.mesh.visible = false;
  // 自転車(内の車線の内側の寄り。動きは上の車線の計算で)
  for (let i = 0; i < bk.list.length; i++) {
    const m = _o3; placeOnRing(m, bk.list[i].a, LANE_IN - .04, y0, -1); m.updateMatrix(); bk.mesh.setMatrixAt(i, m.matrix);
    m.position.y += .14; m.updateMatrix(); bk.rd.setMatrixAt(i, m.matrix); bk.rh.setMatrixAt(i, m.matrix);
  }
  bk.mesh.instanceMatrix.needsUpdate = bk.rd.instanceMatrix.needsUpdate = bk.rh.instanceMatrix.needsUpdate = true;
}
const fwdAng = (a, b) => ((b - a) % TAU + TAU) % TAU;   // a から前へ b までの角度
function placeOnRing(o, a, r, y, dir) { o.position.set(Math.cos(a) * r, y, Math.sin(a) * r); o.rotation.set(0, -a + (dir > 0 ? Math.PI : 0), 0); }

/* ---------- 空: 流れる雲・島の下の雲海の帯(島の幅の中に収める)・ときどき鳥の群れ ---------- */
/* もやの帯: 縁の柔らかい雲の模様(キャンバスに、ぼかした丸を重ねる)を描いた横長の面。
   上の組(島のすぐ下の帯と、左右に離れた塊)と下の組(手前の広い帯)の2つにまとめ、組ごとに色を変える(夕方は上が桃色、下が藤色)。描画は2回 */
function hazeSheets(world, rnd) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const x = cv.getContext('2d');
  for (let i = 0; i < 95; i++) {
    const u = rnd(), cx = 40 + u * 432, cy = 128 + (rnd() - .5) * 110 * Math.sin(Math.PI * u), r = 30 + rnd() * 72 * Math.sin(Math.PI * u) + 16;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r); const al = .1 + rnd() * .14; g.addColorStop(0, `rgba(255,255,255,${al})`); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.beginPath(); x.arc(cx, cy, r, 0, TAU); x.fill();
  }
  // 縁を消す(上下・左右のぼかし)
  x.globalCompositeOperation = 'destination-in';
  const gh = x.createLinearGradient(0, 0, 512, 0); gh.addColorStop(0, 'rgba(0,0,0,0)'); gh.addColorStop(.18, 'rgba(0,0,0,1)'); gh.addColorStop(.82, 'rgba(0,0,0,1)'); gh.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gh; x.fillRect(0, 0, 512, 256);
  const gv = x.createLinearGradient(0, 0, 0, 256); gv.addColorStop(0, 'rgba(0,0,0,0)'); gv.addColorStop(.3, 'rgba(0,0,0,1)'); gv.addColorStop(.7, 'rgba(0,0,0,1)'); gv.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gv; x.fillRect(0, 0, 512, 256);
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  // [s, y, f, 幅, 奥行き, 模様を裏返す]
  const GROUPS = [
    [[0, -6.6, 2.0, 20, 7.5, 0], [-6.6, -6.25, 1.5, 9.5, 4.4, 1], [6.4, -6.45, 1.1, 9, 4.0, 1]],
    [[0, -7.6, 3.2, 24, 9, 0], [-3.6, -8.0, 4.4, 13, 5.2, 1], [4.4, -7.9, 4.0, 12, 5.0, 0], [-2.4, -8.6, 7.4, 17, 6.5, 0], [3.2, -8.75, 8.0, 16, 6.0, 1]]   // 下の2枚は、スマホで島と入口のあいだ(画面の下の方)まで霞ませる
  ];
  const mats = [], out = [];
  for (const grp of GROUPS) {
    const parts = grp.map(([sx, y, f, w, d, flip]) => {
      const g = new THREE.PlaneGeometry(w, d); if (flip) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, 1 - uv.getX(i), 1 - uv.getY(i)); }
      g.rotateX(-Math.PI / 2); g.rotateY(Math.PI / 4); const [px, pz] = SF(sx, f); g.translate(px, y, pz); return g;
    });
    const pos = [], uvs = [], idx = []; let base = 0;
    for (const g of parts) { pos.push(...g.attributes.position.array); uvs.push(...g.attributes.uv.array); for (const i of g.index.array) idx.push(i + base); base += g.attributes.position.count; g.dispose(); }
    const geom = new THREE.BufferGeometry(); geom.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geom.setIndex(idx); geom.computeBoundingSphere();
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, color: '#FFFFFF', opacity: .78, toneMapped: false });
    const m = new THREE.Mesh(geom, mat); m.userData.keep = true; m.renderOrder = 2; world.add(m); out.push(m); mats.push(mat);
  }
  return { mat: mats[0], mats, meshes: out };
}
/* 雲の素材: 光の当たる上面と陰の2色で塗り、縁ほど透けて空に溶ける(くっきりした綿の塊にしない)。
   光で色を計算せず、トーンマッピングもしない(ページの空の CSS の色と、同じ値で合わせられるように) */
function softCloudMat() {
  return new THREE.ShaderMaterial({
    uniforms: { uLit: { value: new THREE.Color('#FFFFFF') }, uShade: { value: new THREE.Color('#DDE6EE') }, uOp: { value: .9 }, uSun: { value: new THREE.Vector3(-.3, .8, .5) } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vAl;
void main() {
#ifdef USE_INSTANCING_COLOR
  vAl = instanceColor.r;
#else
  vAl = 1.0;
#endif
  mat3 im = mat3(instanceMatrix); vec3 n = im * (normal / vec3(dot(im[0], im[0]), dot(im[1], im[1]), dot(im[2], im[2])));
  vN = normalize(mat3(modelMatrix) * n); vV = normalize(normalMatrix * n);
  gl_Position = projectionMatrix * modelViewMatrix * instanceMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `uniform vec3 uLit; uniform vec3 uShade; uniform float uOp; uniform vec3 uSun; varying vec3 vN; varying vec3 vV; varying float vAl;
void main() {
  vec3 n = normalize(vN); float k = clamp(smoothstep(-.4, .8, dot(n, normalize(uSun))) * .65 + smoothstep(-.5, .9, n.y) * .5, 0., 1.);
  float a = smoothstep(.12, .85, abs(normalize(vV).z)) * uOp * vAl;
  gl_FragColor = vec4(mix(uShade, uLit, k), a);
  #include <colorspace_fragment>
}`,
    transparent: true, depthWrite: false, toneMapped: false
  });
}
/* 雲ともやの色と濃さ(昼・夕・夜)。ページの空(index.html の --sky-*)の下の色から上の色へ、つながる値にする
   lit / shade = 空の雲の光の当たる上面と陰。h / h2 = 島の下のもやの上の組と下の組。r = 岩の先が溶ける色(rk はその強さ)
   昼: 白(上)と、ごく淡い青みの灰(下。スマホで島と入口のあいだが「空の下の方がやわらかく霞む」と分かる濃さ)/ 夕: 上面は背景の下の桃色(#F6DCC0)より少し桃色、陰はラベンダー / 夜: 背景の下の藍(#2E2C58)に寄せて、ごく淡く */
const CLOUD = [
  { lit: '#FFFFFF', shade: '#DDE6EE', o: .92, h: '#FFFFFF', h2: '#E6EBEE', ho: 1, ho2: .9, r: '#F4F1EA', rk: .75 },
  { lit: '#FAD9C7', shade: '#C2B9D9', o: .85, h: '#F8D9C7', h2: '#EAD1D8', ho: .8, ho2: .8, r: '#F3D6C6', rk: .72 },
  { lit: '#3A4072', shade: '#272B52', o: .3, h: '#33386A', h2: '#2E2F5E', ho: .3, ho2: .3, r: '#2B2D57', rk: .45 }
];
const CLOUD_C = CLOUD.map(c => ({ ...c, lit: new THREE.Color(c.lit), shade: new THREE.Color(c.shade), h: new THREE.Color(c.h), h2: new THREE.Color(c.h2), r: new THREE.Color(c.r) }));
function sky(scene, world, dyn, rnd, q) {
  const sg = new THREE.SphereGeometry(1, 16, 10), N = 12;
  const cm = new THREE.InstancedMesh(sg, softCloudMat(), N);
  cm.frustumCulled = false; scene.add(cm);
  // 空の雲(3つの塊): 止めた画像の枠の上の空(左・右・左寄りの上)に置く。止めた画像と立体の最初のこま(どちらも t = 0)で同じ所に見え、
  // 枠の外から雲が「ふっと現れる」ことがない。そこからゆっくり右へ流れ、流れの端では淡く消えて、反対の端から淡く現れる
  const CL = [[-6.6, -8.2, 2.6, 1.0], [6.4, -8.0, 2.7, .95], [-2.8, -11.3, 2.0, .72]];   // [s, f, y, 大きさ]
  const clouds = [];
  for (let c = 0; c < 3; c++) { const base = { a: deg(196 + c * 34 + rnd() * 10), r: 11.2 + rnd() * 1.2, y: 4.1 + rnd() * 1.0, sp: .004 + rnd() * .003, puffs: [] }; for (let k = 0; k < 4; k++) base.puffs.push([(k - 1.5) * .7 + rnd() * .2, rnd() * .25, (rnd() - .5) * .5, .55 + rnd() * .45]); const [s0, f0, y0, sc] = CL[c]; Object.assign(base, { s: s0, f: f0, y: y0, sc, ph: .5 + c * .07 }); clouds.push(base); }
  for (let i = 0; i < N; i++) cm.setColorAt(i, _c1.setRGB(1, 0, 0));
  // 島の下の雲の帯: 立体の塊は使わず、柔らかい模様の面だけで(縁が円盤のように見えないように)。島と入口のあいだを、空に溶ける色でうめる
  dyn.haze = hazeSheets(world, rnd);
  dyn.clouds = { mesh: cm, list: clouds };
  void q;
  // 鳥(V の形。翼を羽ばたかせる)
  const bg = new THREE.BufferGeometry();
  bg.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .05, -.22, .03, -.05, 0, 0, -.06, 0, 0, .05, .22, .03, -.05, 0, 0, -.06], 3)); bg.computeVertexNormals();
  const bm = new THREE.InstancedMesh(bg, new THREE.MeshBasicMaterial({ color: '#4A4F5A', side: THREE.DoubleSide }), 7); bm.frustumCulled = false; scene.add(bm);
  dyn.birds = { mesh: bm, t0: 4, n: 7 };
}
const CLOUD_PER = 220, CLOUD_RANGE = 5.5;   // 雲がひと流れにかける秒と、流れる幅(画面の右へ)
export function placeSky(dyn, t, night) {
  const C2 = dyn.clouds; if (!C2) return;
  let i = 0; const o = _o3;
  for (let ci = 0; ci < C2.list.length; ci++) {
    const c = C2.list[ci], p = (((c.ph + t / CLOUD_PER) % 1) + 1) % 1, sc = c.s + (p - .5) * CLOUD_RANGE, al = smooth01(p / .12) * smooth01((1 - p) / .12);
    for (let k = 0; k < c.puffs.length; k++) {
      const pf = c.puffs[k], ps = sc + pf[0] * .8 * c.sc, pff = c.f + pf[2], s = pf[3];
      o.position.set((ps + pff) * R2, c.y + pf[1] * c.sc, (pff - ps) * R2); o.rotation.set(0, Math.PI / 4, 0); o.scale.set(s * .8 * c.sc, s * .5 * c.sc, s * .66 * c.sc); o.updateMatrix();
      C2.mesh.setMatrixAt(i, o.matrix); C2.mesh.setColorAt(i, _c1.setRGB(al, 0, 0)); i++;
    }
  }
  o.rotation.set(0, 0, 0);
  C2.mesh.instanceMatrix.needsUpdate = true; if (C2.mesh.instanceColor) C2.mesh.instanceColor.needsUpdate = true;
  // 雲の色は時間帯に合わせる(上の CLOUD。色は最初に一度だけ Color にしておく)。applyTod が覚えた時間帯と光の向きを使う(撮るときもページでも同じ)
  const tk = TODK, ci = Math.min(1, Math.floor(tk)), ck = tk - ci;
  const cu = C2.mesh.material.uniforms, A = CLOUD_C[ci], Bc = CLOUD_C[ci + 1];
  cu.uLit.value.copy(A.lit).lerp(Bc.lit, ck); cu.uShade.value.copy(A.shade).lerp(Bc.shade, ck); cu.uOp.value = lerp(A.o, Bc.o, ck); cu.uSun.value.copy(SUNDIR);
  if (dyn.haze) for (let j = 0; j < dyn.haze.mats.length; j++) { const m = dyn.haze.mats[j]; m.color.copy(j ? A.h2 : A.h).lerp(j ? Bc.h2 : Bc.h, ck); m.opacity = lerp(j ? A.ho2 : A.ho, j ? Bc.ho2 : Bc.ho, ck); }
  U.uHazeC.value.copy(A.r).lerp(Bc.r, ck); U.uHazeK.value = lerp(A.rk, Bc.rk, ck);
  if (dyn.pools) dyn.pools.mesh.visible = U.uNight.value > .02;
  // 夕方の病院の正面の光: 建物をひらいている間は弱める(live.js の広場の灯りと同じ考え方。中が白く飛ばないように)
  if (LREF && LREF.pF) LREF.pF.intensity = (LREF.pF.userData.base || 0) * Math.max(0, 1 - 1.4 * U.uDim.value);
  void night;
  // 鳥: 26 秒ごとに、島の上を横切る
  const Bd = dyn.birds, u = ((t - Bd.t0) % 26) / 26;
  for (let k = 0; k < Bd.n; k++) {
    const fly = u < .45, s = fly ? 1 : 0, lead = u / .45, off = k * .035;
    const x = lerp(-15, 15, lead - off), z = lerp(-9, 6, lead - off) + Math.sin(k * 2.1) * .6, y = 6.4 + Math.sin(lead * 6 + k) * .25 + (k % 2) * .25;
    o.position.set(x, y, z); o.rotation.set(0, Math.atan2(15 * 2, 15) - Math.PI / 2, 0); const flap = Math.sin(t * 10 + k) * .5 + .7; o.scale.set(s * 1.1, s * flap, s * 1.1); o.updateMatrix(); Bd.mesh.setMatrixAt(k, o.matrix);
  }
  Bd.mesh.instanceMatrix.needsUpdate = true;
}

/* ---------- アトリエの煙突の湯気 ---------- */
function steamAndWater(world, dyn, B, only) {
  if (B.atelier) {
    const st = new THREE.InstancedMesh(new THREE.SphereGeometry(.08, 8, 6), new THREE.MeshStandardMaterial({ color: '#FFFFFF', roughness: 1, transparent: true, opacity: .55, depthWrite: false, emissive: '#FFFFFF', emissiveIntensity: .25 }), 6);
    st.frustumCulled = false; world.add(st);
    const s = B.atelier.ex.emit.steam, src = new THREE.Vector3(...s).applyEuler(B.atelier.grp.rotation).add(B.atelier.grp.position);
    dyn.steam = { mesh: st, src, n: 6 };
  }
  void only;
}
/* ---------- 展望台の灯室の、ごく弱い回る光(夜だけ。灯台のように。目立たせすぎない)。ひらいている間は消す ---------- */
function beam(dyn, ob) {
  const L = 3.4, w1 = .5, pos = [], uv = [], idx = [];
  for (const sgn of [1, -1]) for (const vert of [0, 1]) {
    const b = pos.length / 3;
    for (const [u, v] of [[0, 0], [1, 0], [1, 1], [0, 1]]) { const ww = lerp(.06, w1, u) * (v * 2 - 1); pos.push(sgn * u * L, vert ? ww * .5 : 0, vert ? 0 : ww); uv.push(u, v); }
    idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    uniforms: { uNight: U.uNight, uTime: U.uTime, uOpenA: U.uOpenA, uOpenB: U.uOpenB, uFocus: U.uFocus, uCol: { value: new THREE.Color('#FFD7A0') } },
    vertexShader: 'uniform float uTime; varying vec2 vUv; void main(){ vUv = uv; float a = uTime * .32; vec3 p = position; p.xz = mat2(cos(a), -sin(a), sin(a), cos(a)) * p.xz; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
    fragmentShader: 'uniform float uNight; uniform float uOpenA; uniform float uOpenB; uniform float uFocus; uniform vec3 uCol; varying vec2 vUv; void main(){ if (abs(uOpenA - 2.0) < .5 || abs(uOpenB - 2.0) < .5) discard; float k = pow(1.0 - vUv.x, 1.6) * (1.0 - pow(abs(vUv.y * 2.0 - 1.0), 2.0)); float f = uFocus > -.5 ? .35 : 1.0; gl_FragColor = vec4(uCol * k * .2 * uNight * f, 0.0); }',
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, premultipliedAlpha: true, side: THREE.DoubleSide
  });
  const m = new THREE.Mesh(g, mat); m.userData.keep = true; m.frustumCulled = false; m.renderOrder = 5;
  m.position.set(...ob.ex.beam); ob.grp.add(m);
  dyn.beam = m;
}
export function placeSmall(dyn, t, steamOn) {
  const o = _o3; o.rotation.set(0, 0, 0);   // 作業用の物は、ほかの関数の向きが残っているので戻す
  if (dyn.steam) {
    const S = dyn.steam;
    for (let i = 0; i < S.n; i++) { const u = ((t * .32 + i / S.n) % 1); o.position.set(S.src.x + Math.sin(u * 5 + i) * .05 + u * .12, S.src.y + u * .7, S.src.z - u * .05); const s = steamOn ? (.4 + u * 1.3) * (1 - u) * 1.6 : 0; o.scale.setScalar(s); o.updateMatrix(); S.mesh.setMatrixAt(i, o.matrix); }
    S.mesh.instanceMatrix.needsUpdate = true;
  }
  if (dyn.beam) dyn.beam.visible = U.uNight.value > .02;
  if (dyn.ripples) {
    const R = dyn.ripples, c = _cR;
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
   温かい主光(太陽)と、少し冷たい空の補光。霧の色は空に寄せる。ガラスの映り込みの強さも時間帯で変える
   ================================================================ */
/* 昼の太陽は、手前の左(島の角度 72°・高さ 42°)。2本の弧の影が広場の床で交差し、正面のカメラから見て、ロゴとほぼ同じ形と縦横の比で床に描かれる
   (影は弧を 1 + 1.07 / tan(高さ) × cos(太陽と正面の角) 倍に縦へ伸ばした形。31° から見るとちょうど縮んで、ロゴの比に近くなる) */
const TOD = [
  { hemiS: '#D8E3F0', hemiG: '#C8B697', hemi: .96, sun: '#FFE6C6', sunI: 3.15, sunPos: [4.79, 13.96, 14.74], fill: '#D2DFF0', fillI: .42, exp: 1.04, glow: 0, pt: 0, fog: '#E2EAED', env: .7, gC: '#FFE0B8', face: 0 },
  // 夕: 低い橙の主光と長い影。陰は桃色がかった藤色。窓の灯りがともり始める(白い窓も、夕方は暖かい色で点く)
  { hemiS: '#DDBFC8', hemiG: '#8E7068', hemi: .74, sun: '#FF9C60', sunI: 2.5, sunPos: [-15, 4.6, 3.2], fill: '#A4A2DD', fillI: .52, exp: 1.0, glow: .62, pt: .45, fog: '#D9B7AF', env: .45, gC: '#FFDDB2', face: 1 },
  { hemiS: '#62709D', hemiG: '#2E2C47', hemi: .9, sun: '#B9C7F2', sunI: 1.0, sunPos: [-5, 14, 9], fill: '#7482C4', fillI: .34, exp: 1.08, glow: 1, pt: 1, fog: '#252D57', env: .35, gC: '#E4ECF7', face: 0 }   // 夜: 手前の左上から月明かり。形と屋根の色が読めるように
];
const _c1 = new THREE.Color(), _c2 = new THREE.Color(), SUNDIR = new THREE.Vector3(-.3, .8, .5);
let LREF = null;   // いちばん新しい makeLights の灯り(placeSky が、ひらいている間の弱め方に使う)
const FACE_I = 8;  // 夕方の病院の正面の光の強さ(TOD の face を掛ける)
export function makeLights(scene, mapSize) {
  const hemi = new THREE.HemisphereLight('#fff', '#888', 1); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff', 2); sun.castShadow = true; sun.shadow.mapSize.set(mapSize, mapSize);
  const sc = sun.shadow.camera; sc.left = -12; sc.right = 12; sc.top = 12; sc.bottom = -12; sc.near = 1; sc.far = 60;
  sun.shadow.bias = -.0004; sun.shadow.normalBias = .02; sun.shadow.radius = 3; scene.add(sun); scene.add(sun.target);
  const fill = new THREE.DirectionalLight('#fff', .5); fill.position.set(10, 6, -8); scene.add(fill);
  // 夜の灯り: 広場の藍と砂(2本の弧のそば)、病院の入口、ひらいた建物の中(強さは 0 から)
  const { cx, cz, map } = plazaFrame();
  const pI = new THREE.PointLight('#7F95F4', 0, 4.4, 1.6), pS = new THREE.PointLight('#F5C27E', 0, 4.4, 1.6), pH = new THREE.PointLight('#FFE6C4', 0, 4.5, 1.6), pIn = new THREE.PointLight('#FFE2B8', 0, 5, 1.4);
  const [ix, iz] = map([90, 50]), [sx, sz] = map([185, 45]), [hx, hz] = SF(0, .55);
  pI.position.set(ix, PLATEAU_H + .9, iz); pS.position.set(sx, PLATEAU_H + 1.0, sz); pH.position.set(hx, PLATEAU_H + .75, hz); pH.distance = 3.2; pIn.position.set(0, -5, 0);
  for (const p of [pI, pS, pH, pIn]) scene.add(p);
  // 夕方の病院の正面: 広場の側から、弱い暖かい光を当てる(逆光で藤色の灰に沈まないように)。影は落とさない
  const pF = new THREE.SpotLight('#FFC596', 0, 7.5, deg(36), .85, 1.2), [fx, fz] = SF(0, 2.75), [tx, tz] = SF(0, -.3);
  pF.position.set(fx, PLATEAU_H + .7, fz); pF.target.position.set(tx, PLATEAU_H + 1.7, tz); scene.add(pF, pF.target);
  void cx; void cz;
  return (LREF = { hemi, sun, fill, pI, pS, pH, pIn, pF, scene });
}
/* ガラスの軽い映り込み(PMREM。品質 high と mid。low はなし): 空のグラデーションの球を、1度だけ焼く。
   中の段(スマホ)でも高の段と同じ窓の見え方にする(段の差は影の解像度だけ) */
let ENV = null;
function envFor(renderer) {
  if (ENV !== null || QUALITY === 'low') return ENV;
  try {
    const sc = new THREE.Scene(), g = new THREE.SphereGeometry(10, 24, 12), c = [], P = g.attributes.position, top = new THREE.Color('#BFD3E6'), hor = new THREE.Color('#F4EEE4'), gnd = new THREE.Color('#A8A08F');
    for (let i = 0; i < P.count; i++) { const y = P.getY(i) / 10; _c1.copy(y > 0 ? hor : gnd).lerp(y > 0 ? top : gnd, Math.pow(Math.abs(y), .6)); c.push(_c1.r, _c1.g, _c1.b); }
    g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    sc.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
    const sunDisc = new THREE.Mesh(new THREE.SphereGeometry(1.4, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color('#FFF6E6').multiplyScalar(3) })); sunDisc.position.set(2.1, 6.2, 6.6); sc.add(sunDisc);   // 昼の太陽の向き
    const pm = new THREE.PMREMGenerator(renderer); ENV = pm.fromScene(sc, .02).texture; pm.dispose(); g.dispose();
    const m = townMat('g'); m.envMap = ENV; m.envMapIntensity = .7; m.needsUpdate = true;
  } catch (e) { ENV = false; }
  return ENV;
}
/* 時刻の色は、最初に一度だけ Color にしておく(切り替えの間、毎こま文字列から色を作らない) */
const TOD_C = TOD.map(t => ({ hemiS: new THREE.Color(t.hemiS), hemiG: new THREE.Color(t.hemiG), sun: new THREE.Color(t.sun), fill: new THREE.Color(t.fill), gC: new THREE.Color(t.gC), fog: new THREE.Color(t.fog) }));
export function applyTod(L, renderer, m, clouds) {
  const i = Math.min(1, Math.floor(m)), k = m - i, a = TOD[i], b = TOD[Math.min(2, i + 1)], ac = TOD_C[i], bc = TOD_C[Math.min(2, i + 1)];
  TODK = m;
  L.hemi.color.copy(ac.hemiS).lerp(bc.hemiS, k); L.hemi.groundColor.copy(ac.hemiG).lerp(bc.hemiG, k); L.hemi.intensity = lerp(a.hemi, b.hemi, k);
  L.sun.color.copy(ac.sun).lerp(bc.sun, k); L.sun.intensity = lerp(a.sunI, b.sunI, k);
  L.sun.position.set(lerp(a.sunPos[0], b.sunPos[0], k), lerp(a.sunPos[1], b.sunPos[1], k), lerp(a.sunPos[2], b.sunPos[2], k)); SUNDIR.copy(L.sun.position).normalize();
  L.fill.color.copy(ac.fill).lerp(bc.fill, k); L.fill.intensity = lerp(a.fillI, b.fillI, k);
  renderer.toneMappingExposure = lerp(a.exp, b.exp, k);
  const glow = lerp(a.glow, b.glow, k), pt = lerp(a.pt, b.pt, k);
  U.uNight.value = glow;
  U.uGlowC.value.copy(ac.gC).lerp(bc.gC, k);
  // 交差の広場: 弧と床の帯(とそばの藍と砂の灯り)は夜だけ灯る(夕方の終わりから)。夕方は、低い光で砂の弧の縁が金、藍の弧は影絵
  const arcK = smooth01((m - 1.2) / .7), rimK = smooth01(1 - Math.abs(m - 1) / .65);
  U.uArc.value = arcK; U.uRim.value = rimK; U.uDay.value = smooth01(1 - m / .8);
  L.pI.intensity = 5.5 * arcK; L.pS.intensity = 5.5 * arcK; L.pH.intensity = L.pH.userData.base = 1.4 * pt;
  if (L.pF) L.pF.intensity = L.pF.userData.base = FACE_I * lerp(a.face, b.face, k);
  const sc = L.scene || null; if (sc && sc.fog) sc.fog.color.copy(ac.fog).lerp(bc.fog, k);
  if (envFor(renderer)) townMat('g').envMapIntensity = lerp(a.env, b.env, k);
  fitShadow(L.sun);
  void clouds;
  return glow;
}
/* 影の範囲(太陽から見た島)を、太陽の向きに合わせて狭める。島が回っても収まるよう、回しても変わらない輪(半径・高さ)で測る。
   範囲が狭いほど、同じ解像度でも影が細かい(段の間の柔らかさの差も小さくなる)。昼は約 1.7 倍、夕方は約 2.3 倍細かい */
const SH_RINGS = [[10.4, 1.6], [10.4, -1.9], [6.7, 6.6], [3.5, 4.7]];
const _shM = new THREE.Matrix4(), _shO = new THREE.Vector3(), _shU = new THREE.Vector3(0, 1, 0);
function fitShadow(sun) {
  const sc = sun.shadow.camera, e = _shM.lookAt(sun.position, _shO, _shU).elements;
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (let ri = 0; ri < SH_RINGS.length; ri++) for (let i = 0; i < 24; i++) {
    const r = SH_RINGS[ri][0], h = SH_RINGS[ri][1], a = i / 24 * TAU, px = Math.cos(a) * r, pz = Math.sin(a) * r, x = px * e[0] + h * e[1] + pz * e[2], y = px * e[4] + h * e[5] + pz * e[6];
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  sc.left = x0 - .3; sc.right = x1 + .3; sc.bottom = y0 - .3; sc.top = y1 + .3; sc.updateProjectionMatrix();
}

/* ---------- カメラ(正投影・斜め上から) ---------- */
export const ELEV = deg(31), AZ = deg(45), DIST = 80;
export function aimCamera(cam, target, elev = ELEV) {
  cam.position.set(target.x + DIST * Math.cos(elev) * Math.cos(AZ), target.y + DIST * Math.sin(elev), target.z + DIST * Math.cos(elev) * Math.sin(AZ));
  cam.up.set(0, 1, 0); cam.lookAt(target); cam.updateMatrixWorld(); cam.updateProjectionMatrix();
}
/* 交差の広場の見晴らし(広場をひらいたとき): 広場の上へ上がり、2本の弧を手前(画面の下の真ん中)に、町の建物すべてを見渡す。
   rot = 島を回す角度(度。0 = いつもの正面で、広場が手前)、elev = 見下ろす角度(度)。live.js の overlook() が読む */
// 2026-10-25 第2回: 広場の手前の低い位置から弧越しに見る案(B)と比べた。正投影では弧が額縁にならず、低い角度ほど札が重なる(クリニック/公園)。
// 透視で弧を額縁にすると、スマホで7つの建物が収まらず、札も重なる。いまの見下ろし(A)は PC・スマホとも、7つが入り札が重ならないので、A のまま
export const OVERLOOK = { rot: 0, elev: 42 };
/* 見晴らしの目と的と、建物の名前の札を置く所(島の座標 = S.world の中。島を回しているときは S.world.matrixWorld を掛ける)。
   tags[id] は建物のいちばん上(屋根・ドーム・灯室)の少し上。pts は画面に収める点(建物の箱と、広場の床と弧)。S は makeScene の返り値(省くと、いちばん新しく作った町) */
export function plazaOverlook(S = LAST_S) {
  const OV = OVERLOOK, el = deg(OV.elev), F = plazaFrame(), tags = {}, pts = [];
  for (const id of IDS) {
    if (id === 'plaza') {
      tags.plaza = new THREE.Vector3(F.cx, F.arcTop + .25, F.cz);
      for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; pts.push(new THREE.Vector3(F.cx + Math.cos(a) * 2.35, F.y, F.cz + Math.sin(a) * 2.35)); }
      pts.push(new THREE.Vector3(F.cx, F.arcTop, F.cz)); continue;
    }
    const b = S && S.B && S.B[id]; if (!b) continue;
    const bx = BOXES[id], p = b.grp.position, top = b.ex.top, tower = bx.shape === 'tower';
    tags[id] = new THREE.Vector3(p.x, p.y + top + .3, p.z);
    const hw = tower ? bx.w / 2 + .45 : bx.w / 2 + WALL, hd = tower ? hw : bx.d / 2 + WALL, c = Math.cos(b.grp.rotation.y), sn = Math.sin(b.grp.rotation.y);
    for (const x of [-hw, hw]) for (const z of [-hd, hd]) for (const y of [-b.ex.y0, top]) pts.push(new THREE.Vector3(p.x + x * c + z * sn, p.y + y, p.z - x * sn + z * c));
  }
  const target = pts.reduce((acc, v) => acc.add(v), new THREE.Vector3()).multiplyScalar(1 / Math.max(1, pts.length));
  const eye = new THREE.Vector3(target.x + DIST * Math.cos(el) * Math.cos(AZ), target.y + DIST * Math.sin(el), target.z + DIST * Math.cos(el) * Math.sin(AZ));
  return { rot: OV.rot, elev: OV.elev, eye, target, up: new THREE.Vector3(0, 1, 0), tags, pts };
}
/* 画面に町を収めるための点: 島の輪郭(上の縁と地層の下)、展望台のてっぺん、岩の塊のいちばん下 */
export function samplePoints() {
  const pts = [];
  for (let i = 0; i < 48; i++) { const a = i / 48 * TAU, R = islandR(a) + .08; pts.push(new THREE.Vector3(Math.cos(a) * R, .6, Math.sin(a) * R), new THREE.Vector3(Math.cos(a) * (R - .3), -1.72, Math.sin(a) * (R - .3))); }
  const [ox, oz] = polar(LAYOUT.observatory.a, LAYOUT.observatory.r);
  pts.push(new THREE.Vector3(ox, 6.1, oz), new THREE.Vector3(.9, -8.3, .9));
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
/* 描く道具。トーンマッピングは ACES(白が白く、模型の写真らしく締まる)。AgX も 0.160 で使えるが、この淡い色では霞んで見えた */
export function makeRenderer(canvas, dpr, W, H, preserve) {
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!preserve });
  r.setPixelRatio(dpr); r.setSize(W, H, false); r.setClearColor(0x000000, 0);
  r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.ACESFilmicToneMapping;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  return r;
}
export { THREE, PALETTE };
