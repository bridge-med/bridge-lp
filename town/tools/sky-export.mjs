// 町の7棟の形を、焼く道具(sky-bake.py)のための OBJ に書き出す。貼り位置は町と同じ assignSkyUV(skymap.js)で付ける
// node town/tools/sky-export.mjs <出力.obj>
// 物の名前に部品の印を入れる(p1 = 前の壁・扉、p2 = 屋根・ドーム。焼く道具が、開いた状態と閉じた状態を分けるのに使う)
// 棟どうしが互いを遮らないように、x 方向に GAP ずつ離して並べる。棟ごとに足もとの地面(ground_*)を置く(遮る物としてだけ使い、焼かない)
import { register } from 'node:module';
import { writeFileSync } from 'node:fs';
const three = new URL('../vendor/three-0.160.0/three.module.min.js', import.meta.url).href;
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, n) { return s === 'three' ? { url: ${JSON.stringify(three)}, shortCircuit: true } : n(s, c); }`));
const THREE = await import('three');
const { buildExterior } = await import('../buildings.js');
const { assignSkyUV, SKY } = await import('../skymap.js');

const GAP = 40, L = [], stat = {};
let vo = 1, n = 0;
const m = new THREE.Matrix4(), nm = new THREE.Matrix3(), v = new THREE.Vector3();
Object.keys(SKY.TILES).forEach((id, bi) => {
  const ex = buildExterior(id, []), root = ex.g, ox = bi * GAP;
  const info = assignSkyUV(root, id);
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const partOf = o => { for (let p = o; p && p !== root; p = p.parent) if (p.userData.part !== undefined) return p.userData.part; return 0; };
  let tris = 0;
  root.traverse(o => {
    const lm = o.isMesh && o.geometry.attributes.aLm; if (!lm) return;
    const P = o.geometry.attributes.position, N = o.geometry.attributes.normal;
    m.multiplyMatrices(inv, o.matrixWorld); nm.getNormalMatrix(m);
    L.push(`o ${id}_m${n++}_p${partOf(o) % 10}`);
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(P, i).applyMatrix4(m); L.push(`v ${(v.x + ox).toFixed(5)} ${v.y.toFixed(5)} ${v.z.toFixed(5)}`); }
    for (let i = 0; i < P.count; i++) L.push(`vt ${lm.getX(i).toFixed(6)} ${(1 - lm.getY(i)).toFixed(6)}`);   // 町は画像を上下そのまま(flipY = false)で読むので、OBJ の v は 1 - v
    for (let i = 0; i < P.count; i++) { v.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); L.push(`vn ${v.x.toFixed(4)} ${v.y.toFixed(4)} ${v.z.toFixed(4)}`); }
    for (let t = 0; t < P.count; t += 3) { const a = vo + t, b = a + 1, c = a + 2; L.push(`f ${a}/${a}/${a} ${b}/${b}/${b} ${c}/${c}/${c}`); tris++; }
    vo += P.count;
  });
  // 足もとの地面(台の下の高さ。棟の地面の面と重ならないよう、わずかに下げる)
  const g = -ex.y0 - .002, R = 7;
  L.push(`o ground_${id}`, `v ${ox - R} ${g} ${-R}`, `v ${ox + R} ${g} ${-R}`, `v ${ox + R} ${g} ${R}`, `v ${ox - R} ${g} ${R}`, 'vt 0 0', 'vt 1 0', 'vt 1 1', 'vt 0 1', 'vn 0 1 0', 'vn 0 1 0', 'vn 0 1 0', 'vn 0 1 0');
  L.push(`f ${vo}/${vo}/${vo} ${vo + 3}/${vo + 3}/${vo + 3} ${vo + 2}/${vo + 2}/${vo + 2}`, `f ${vo}/${vo}/${vo} ${vo + 2}/${vo + 2}/${vo + 2} ${vo + 1}/${vo + 1}/${vo + 1}`);
  vo += 4;
  stat[id] = { tris, charts: info.charts, density: +info.density.toFixed(1) };
});
writeFileSync(process.argv[2], L.join('\n') + '\n');
console.log(JSON.stringify({ size: [SKY.W, SKY.H], ...stat }));
