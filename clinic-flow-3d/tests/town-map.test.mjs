/* タウンマップの座標突合テスト
 * 実行: node clinic-flow-3d/tests/town-map.test.mjs
 * 間合いのルール(docs/roadmap.md 判断メモ・v39 #14)のうち機械で見られる部分:
 * 足元(占有タイル)の重なりは、道路・建物・住宅・木・部門・分院・在宅地区の
 * どの組合せでも不可。座標はtown.jsの実配列から読む(このファイルに写さない)。 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const TOWN = require(join(ROOT, 'app', 'town.js'));

const occ = new Map();
const conflicts = [];
function claim(x, y, w, d, who) {
  for (let yy = y; yy < y + d; yy++) for (let xx = x; xx < x + w; xx++) {
    const k = `${xx},${yy}`;
    if (occ.has(k)) conflicts.push(`${k}: ${occ.get(k)} × ${who}`);
    else occ.set(k, who);
  }
}

// 道路を最初に敷く(建物が道路に乗るのも違反として検出される)
TOWN.ROADS.forEach((k) => occ.set(k, 'road'));
for (const b of TOWN.BUILDINGS) claim(b.x, b.y, b.w, b.d, b.id || b.label);
// マンションの描画footprintは 2x1(town.jsの描画コードと同じ)
for (const [i, h] of TOWN.HOUSES.entries()) claim(h.x, h.y, h.mansion ? 2 : 1, 1, `house[${i}]`);
for (const [i, t] of TOWN.TREES.entries()) claim(t.x, t.y, 1, 1, `tree[${i}]`);
claim(TOWN.BILLBOARD.x, TOWN.BILLBOARD.y, 1, 1, 'billboard');
for (const [id, s] of Object.entries(TOWN.DEPT_SPOTS)) claim(s.x, s.y, s.w, s.d, `dept:${id}`);
for (const [id, s] of Object.entries(TOWN.BRANCH_SPOTS)) claim(s.x, s.y, s.w, s.d, `branch:${id}`);
for (const [i, s] of TOWN.HOMECARE_SITES.entries()) claim(s.x, s.y, 1, 1, `hc[${i}]`);

let bad = conflicts.length;
if (bad) for (const c of conflicts) console.log(`  NG - 重複: ${c}`);
else console.log('  ok - 全配列(道路・建物・住宅・木・部門・分院・在宅地区・看板)で足元の重複ゼロ');

// 盤面の外に出ていないこと
for (const [k, who] of occ) {
  const [x, y] = k.split(',').map(Number);
  if (x < 0 || x >= TOWN.W || y < 0 || y >= TOWN.H) { console.log(`  NG - 盤外: ${who} at ${k}`); bad++; }
}
if (!bad) console.log('  ok - 盤外(30x20の外)への配置なし');

console.log(bad ? `\n${bad}件の違反` : '\n合格');
process.exit(bad ? 1 : 0);
