#!/usr/bin/env node
/* ================================================================
   マスター点検CLI。取込本体は build_db.mjs(lib/edt.mjs)が担う。

   使い方:
     node medical-kb/scripts/parse_masters.mjs --inspect --file <csv>
        … 任意のCSV(Shift_JIS)の先頭行を列番号付きでダンプ。
          仕様書と列マッピングを突き合わせるときに使う
     node medical-kb/scripts/parse_masters.mjs [--rev r08]
        … 検証済みレイアウトで医科マスター・電子点数表を読み、件数と
          サンプルを表示(取込前の目視確認用)

   安全装置: scripts/config/master-layout.json が verified: false の間、
   読込(loadLayout)は例外で停止する。仕様書照合なしに外さないこと。
   ================================================================ */
import { readSjisCsv } from './lib/util.mjs';
import { ensureExtracted, loadIkaMaster, loadEdtTables } from './lib/edt.mjs';

const args = process.argv.slice(2);
const argVal = n => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : null; };
const rev = argVal('--rev') || 'r08';

if (args.includes('--inspect')) {
  const file = argVal('--file');
  if (!file) { console.error('--inspect には --file <csv> が必要'); process.exit(1); }
  const rows = readSjisCsv(file);
  console.log(`読込: ${rows.length}行`);
  for (const r of rows.slice(0, 2)) {
    console.log('---- 行 ----');
    r.forEach((v, i) => { if (v !== '' && v !== '"0"' && v !== '0') console.log(`  [${String(i).padStart(3)}] ${v}`); });
  }
  process.exit(0);
}

ensureExtracted(rev);
const m = loadIkaMaster(rev);
console.log(`医科診療行為マスター (${m.source_file}): ${m.rows.length}件`);
for (const r of m.rows.slice(0, 3)) {
  console.log(`  ${r.code} ${r.short_name} 点数=${r.points_raw}(識別${r.points_kbn}) 入外=${r.inout_kbn}`);
}
const edt = loadEdtTables(rev);
console.log(`電子点数表: 補助=${edt.hojo.length} 包括=${edt.hokatsu.length} 背反=${edt.haihan.length} 入院=${edt.nyuin.length} 算定回数=${edt.santei_kaisu.length}`);
