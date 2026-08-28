#!/usr/bin/env node
/* ================================================================
   医科診療行為マスター(CSV/Shift_JIS) → data/kb/{rev}/items.master.json

   使い方:
     1. fetch_sources.mjs でマスターZIPを取得し、unzip して
        data/sources/{rev}/masters/ 直下にCSVを置く
     2. node medical-kb/scripts/parse_masters.mjs --inspect --file <csv>
        で列構成をダンプし、仕様説明書と突き合わせて
        scripts/config/master-layout.json を埋め、verified: true にする
     3. node medical-kb/scripts/parse_masters.mjs --file <csv> [--rev r08]

   設計上の約束:
   - master-layout.json が verified: false のままでは変換しない。
     推測の列マッピングで点数データを作らないための安全装置
   - 出力(items.master.json)は「マスター由来の生データ」であり、
     items.json(編集済みKB)とは別ファイル。build_db.mjs が突合する
   ================================================================ */
import { join } from 'node:path';
import { KB_ROOT, loadJson, saveJson, readSjisCsv, nowIso } from './lib/util.mjs';

const args = process.argv.slice(2);
const rev = argVal('--rev') || 'r08';
const file = argVal('--file');
const inspect = args.includes('--inspect');

function argVal(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

if (!file) {
  console.error('使い方: parse_masters.mjs --file <マスターCSVのパス> [--rev r08] [--inspect]');
  process.exit(1);
}

const rows = readSjisCsv(file);
console.log(`読込: ${rows.length}行`);

if (inspect) {
  for (const r of rows.slice(0, 3)) {
    console.log('---- 行 ----');
    r.forEach((v, i) => { if (v !== '') console.log(`  [${String(i).padStart(3)}] ${v}`); });
  }
  console.log('\n上の列番号を仕様説明書と照合し、scripts/config/master-layout.json を埋めること。');
  process.exit(0);
}

const layout = loadJson(join(KB_ROOT, 'scripts', 'config', 'master-layout.json'));
if (!layout.verified) {
  console.error('master-layout.json が verified: false のため変換を中止した。');
  console.error('マスターファイル仕様説明書(一次資料)と照合し、verified_against に文書名/版を記入のうえ verified: true にすること。');
  console.error('推測の列マッピングで取り込まないための安全装置であり、これを外さないこと。');
  process.exit(2);
}

const col = layout.columns;
const required = ['code', 'name_kanji', 'points'];
for (const k of required) {
  if (col[k] == null) {
    console.error(`columns.${k} が未定義。仕様書で列番号を確認して master-layout.json に記入すること。`);
    process.exit(2);
  }
}

const pick = (row, key) => (col[key] == null ? null : (row[col[key]] ?? null));

const items = rows.map(r => ({
  code: pick(r, 'code'),
  name: pick(r, 'name_kanji'),
  name_kana: pick(r, 'name_kana'),
  short_name: pick(r, 'short_name'),
  points_raw: pick(r, 'points'),
  points_kbn: pick(r, 'points_kbn'),
  unit_code: pick(r, 'unit_code'),
  unit_name: pick(r, 'unit_name'),
  age_lower: pick(r, 'age_lower'),
  age_upper: pick(r, 'age_upper'),
  hospital_clinic_kbn: pick(r, 'hospital_clinic_kbn'),
  inpatient_outpatient_kbn: pick(r, 'inpatient_outpatient_kbn'),
  notification_kbn: pick(r, 'notification_kbn'),
  effective_start: pick(r, 'effective_start'),
  effective_end: pick(r, 'effective_end'),
})).filter(x => x.code);

const out = {
  generated_at: nowIso(),
  revision: rev,
  source_file: file,
  layout_verified_against: layout.verified_against,
  note: 'マスター由来の生データ。点数の解釈(points_kbnによる金額/点数の別など)は仕様書のコード表に従うこと。',
  count: items.length,
  items,
};
const dest = join(KB_ROOT, 'data', 'kb', rev, 'items.master.json');
saveJson(dest, out);
console.log(`書出: ${dest} (${items.length}件)`);
