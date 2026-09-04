/* 医科診療行為マスター・医科電子点数表テーブルの読込。
   列マッピングの根拠は scripts/config/master-layout.json(仕様書照合済み)。
   verified: false の場合は例外を投げる(推測レイアウトでの取込を防ぐ安全装置)。 */
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { KB_ROOT, loadJson, readSjisCsv } from './util.mjs';

const layoutPath = join(KB_ROOT, 'scripts', 'config', 'master-layout.json');

export function loadLayout() {
  const layout = loadJson(layoutPath);
  if (!layout.verified) {
    throw new Error('master-layout.json が verified: false。仕様書と照合するまでマスター取込は実行できない。');
  }
  return layout;
}

function mastersDir(rev) {
  return join(KB_ROOT, 'data', 'sources', rev, 'masters');
}

/* ZIP原典を *_x ディレクトリへ展開(存在すればスキップ)。原典は変更しない */
export function ensureExtracted(rev) {
  const dir = mastersDir(rev);
  const zips = readdirSync(dir).filter(n => n.endsWith('.zip'));
  for (const z of zips) {
    const dest = join(dir, z.replace(/\.zip$/, '_x'));
    if (!existsSync(dest)) {
      execFileSync('unzip', ['-o', '-q', join(dir, z), '-d', dest]);
    }
  }
  // 電子点数表の中のURLエンコード名(#Uxxxx)を復元
  const edtRoot = join(dir, 'ssk_ika_denshitensuhyo_R08_x');
  if (existsSync(edtRoot)) {
    for (const sub of readdirSync(edtRoot)) {
      const subdir = join(edtRoot, sub);
      for (const f of readdirSync(subdir)) {
        if (f.includes('#U')) {
          const decoded = f.replace(/#U([0-9a-f]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
          execFileSync('mv', ['-n', join(subdir, f), join(subdir, decoded)]);
        }
      }
    }
  }
}

function findCsv(rev, dirPattern, filePrefix) {
  const dir = mastersDir(rev);
  for (const d of readdirSync(dir)) {
    if (!d.includes(dirPattern)) continue;
    const p = join(dir, d);
    const stack = [p];
    while (stack.length) {
      const cur = stack.pop();
      for (const f of readdirSync(cur, { withFileTypes: true })) {
        if (f.isDirectory()) stack.push(join(cur, f.name));
        else if (f.name.startsWith(filePrefix) && f.name.endsWith('.csv')) return join(cur, f.name);
      }
    }
  }
  return null;
}

const strip = v => (v == null ? null : v.replace(/^"|"$/g, ''));

/* 医科診療行為マスター → レコード配列 */
export function loadIkaMaster(rev) {
  const layout = loadLayout();
  const csv = findCsv(rev, 'master_ika_s_x', 's_');
  if (!csv) throw new Error('医科診療行為マスターCSVが見つからない。ensureExtracted を先に実行すること。');
  const col = layout.columns;
  const pick = (row, key) => (col[key] == null ? null : strip(row[col[key]] ?? null));
  return {
    source_file: csv.split('/').pop(),
    rows: readSjisCsv(csv).filter(r => strip(r[col.master_type]) === 'S').map(r => ({
      code: pick(r, 'code'),
      short_name: pick(r, 'short_name'),
      name_kana: pick(r, 'name_kana'),
      name_official: pick(r, 'name_official'),
      data_kikaku_code: pick(r, 'data_kikaku_code'),
      points_kbn: pick(r, 'points_kbn'),
      points_raw: pick(r, 'points') !== null && pick(r, 'points') !== '' ? Number(pick(r, 'points')) : null,
      inout_kbn: pick(r, 'inout_kbn'),
      kouki_kbn: pick(r, 'kouki_kbn'),
    })),
  };
}

/* 医薬品マスター → レコード配列(薬価の突合用) */
export function loadIyakuhinMaster(rev) {
  const layout = loadLayout();
  const iy = layout.iyakuhin;
  if (!iy || !iy.verified) {
    throw new Error('master-layout.json の iyakuhin が未定義または verified: false。仕様書と照合するまで医薬品マスターは取込できない。');
  }
  const csv = findCsv(rev, 'master_iyakuhin_y_x', 'y_');
  if (!csv) throw new Error('医薬品マスターCSVが見つからない。ensureExtracted を先に実行すること。');
  const col = iy.columns;
  const pick = (row, key) => (col[key] == null ? null : strip(row[col[key]] ?? null));
  return {
    source_file: csv.split('/').pop(),
    rows: readSjisCsv(csv).filter(r => strip(r[col.master_type]) === 'Y').map(r => ({
      code: pick(r, 'code'),
      name: pick(r, 'name'),
      unit_name: pick(r, 'unit_name'),
      price_type: pick(r, 'price_type'),
      price_raw: pick(r, 'price') !== null && pick(r, 'price') !== '' ? Number(pick(r, 'price')) : null,
      kohatsu: pick(r, 'kohatsu'),
    })),
  };
}

/* 特定器材マスター → レコード配列(材料価格の突合用) */
export function loadKizaiMaster(rev) {
  const layout = loadLayout();
  const kz = layout.kizai;
  if (!kz || !kz.verified) {
    throw new Error('master-layout.json の kizai が未定義または verified: false。仕様書と照合するまで特定器材マスターは取込できない。');
  }
  const csv = findCsv(rev, 'master_kizai_t_x', 't_');
  if (!csv) throw new Error('特定器材マスターCSVが見つからない。ensureExtracted を先に実行すること。');
  const col = kz.columns;
  const pick = (row, key) => (col[key] == null ? null : strip(row[col[key]] ?? null));
  return {
    source_file: csv.split('/').pop(),
    rows: readSjisCsv(csv).filter(r => strip(r[col.master_type]) === 'T').map(r => ({
      code: pick(r, 'code'),
      name: pick(r, 'name'),
      unit_name: pick(r, 'unit_name'),
      price_type: pick(r, 'price_type'),
      price_raw: pick(r, 'price') !== null && pick(r, 'price') !== '' ? Number(pick(r, 'price')) : null,
      betsuhyo_no: pick(r, 'betsuhyo_no'),
      kubun_no: pick(r, 'kubun_no'),
      base_name: pick(r, 'base_name'),
      haishi_date: pick(r, 'haishi_date'),
    })),
  };
}

/* 電子点数表テーブル群 → {hojo, hokatsu, haihan, nyuin, santei_kaisu} */
export function loadEdtTables(rev) {
  const layout = loadLayout();
  const edtDir = join(mastersDir(rev), 'ssk_ika_denshitensuhyo_R08_x', 'tensuhyo_02');
  if (!existsSync(edtDir)) throw new Error('電子点数表テーブルの展開先が見つからない。');
  const files = readdirSync(edtDir);
  const file = prefix => {
    const f = files.find(n => n.startsWith(prefix) && n.endsWith('.csv'));
    if (!f) throw new Error(`電子点数表CSVが見つからない: ${prefix}*`);
    return join(edtDir, f);
  };
  const mapRows = (path, spec) => readSjisCsv(path).map(r => {
    const o = {};
    for (const [k, i] of Object.entries(spec.map)) o[k] = strip(r[i] ?? null);
    return o;
  });

  const haihan = [];
  for (const [prefix, type] of Object.entries(layout.edt.haihan_file_types)) {
    for (const row of mapRows(file(prefix), layout.edt.haihan)) {
      haihan.push({ haihan_type: type, ...row });
    }
  }
  return {
    hojo: mapRows(file('01'), layout.edt.hojo),
    hokatsu: mapRows(file('02'), layout.edt.hokatsu),
    haihan,
    nyuin: mapRows(file('04'), layout.edt.nyuin),
    santei_kaisu: mapRows(file('05'), layout.edt.santei_kaisu),
  };
}
