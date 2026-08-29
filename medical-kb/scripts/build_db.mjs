#!/usr/bin/env node
/* ================================================================
   data/kb/ 以下のJSON(正規データ) → data/db/kb.sqlite (派生物)

   使い方:
     node medical-kb/scripts/build_db.mjs [--rev r08] [--out data/db/kb.sqlite]

   - スキーマは data/schema/schema.sql が唯一の定義
   - DBは毎回作り直す(正規データはJSON側。DBを手で直さない)
   - node:sqlite (Node 22+, experimental) を使用。使えない環境では
     python3 + sqlite3 でも同じschema.sqlから構築できる(docs/update-guide.md)
   ================================================================ */
import { readFileSync, existsSync, readdirSync, rmSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { KB_ROOT, loadJson, nowIso } from './lib/util.mjs';
import { ensureExtracted, loadIkaMaster, loadEdtTables } from './lib/edt.mjs';
import { DatabaseSync } from 'node:sqlite';

const args = process.argv.slice(2);
const rev = argVal('--rev') || 'r08';
const outPath = join(KB_ROOT, argVal('--out') || 'data/db/kb.sqlite');

function argVal(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

const kbDir = join(KB_ROOT, 'data', 'kb', rev);
const commonDir = join(KB_ROOT, 'data', 'kb', 'common');

mkdirSync(dirname(outPath), { recursive: true });
if (existsSync(outPath)) rmSync(outPath);
const db = new DatabaseSync(outPath);
db.exec(readFileSync(join(KB_ROOT, 'data', 'schema', 'schema.sql'), 'utf8'));

const loadOr = (path, fallback) => (existsSync(path) ? loadJson(path) : fallback);

function insert(table, row) {
  const keys = Object.keys(row);
  const stmt = db.prepare(
    `INSERT INTO ${table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`
  );
  stmt.run(...keys.map(k => {
    const v = row[k];
    if (v === undefined || v === null) return null;
    if (typeof v === 'object') return JSON.stringify(v);
    if (typeof v === 'boolean') return v ? 1 : 0;
    return v;
  }));
}

const counts = {};
const count = (t) => { counts[t] = (counts[t] || 0) + 1; };

/* ---- revisions ---- */
const revMeta = loadOr(join(kbDir, 'revision.json'), null);
if (!revMeta) { console.error(`data/kb/${rev}/revision.json が無い`); process.exit(1); }
insert('revisions', revMeta); count('revisions');

/* ---- documents (マニフェスト + 取得ログ) ---- */
const manifest = loadOr(join(KB_ROOT, 'data', 'manifest', `sources.${rev}.json`), { documents: [] });
const rlog = loadOr(join(KB_ROOT, 'data', 'manifest', 'retrieval-log.json'), { entries: [] });
for (const d of manifest.documents) {
  const got = rlog.entries.findLast?.(e => e.id === d.id) || rlog.entries.filter(e => e.id === d.id).pop();
  insert('documents', {
    id: d.id, revision: rev, category: d.category || null, title: d.title,
    doc_type: d.doc_type || null, issuer: d.issuer || null,
    doc_number: d.doc_number || null, issued_date: d.issued_date || null,
    url: d.urls?.[0]?.url || null,
    local_path: got ? got.dest : null,
    sha256: got ? got.sha256 : null,
    retrieved_at: got ? got.retrieved_at : null,
    status: got ? 'retrieved' : (d.status || 'not_retrieved'),
    confidence: d.verified ? 'verified' : (d.doc_number_confidence || 'search-located'),
    notes: Array.isArray(d.notes) ? d.notes.join(' / ') : (d.notes || null),
  });
  count('documents');
}

/* ---- 単純テーブル群 ---- */
for (const s of loadOr(join(commonDir, 'specialties.json'), [])) { insert('specialties', s); count('specialties'); }
for (const it of loadOr(join(kbDir, 'items.json'), [])) { insert('items', { revision: rev, ...it }); count('items'); }
for (const fs_ of loadOr(join(kbDir, 'facility_standards.json'), [])) { insert('facility_standards', { revision: rev, ...fs_ }); count('facility_standards'); }
for (const r of loadOr(join(kbDir, 'billing_rules.json'), [])) { insert('billing_rules', { revision: rev, ...r }); count('billing_rules'); }
for (const l of loadOr(join(kbDir, 'item_specialty.json'), [])) { insert('item_specialty', l); count('item_specialty'); }
for (const l of loadOr(join(kbDir, 'item_facility_standard.json'), [])) { insert('item_facility_standard', l); count('item_facility_standard'); }
for (const q of loadOr(join(kbDir, 'qa_entries.json'), [])) { insert('qa_entries', { revision: rev, ...q }); count('qa_entries'); }
for (const e of loadOr(join(kbDir, 'evidence.json'), [])) { insert('evidence', e); count('evidence'); }

/* ---- シナリオ ---- */
const scenDir = join(kbDir, 'scenarios');
if (existsSync(scenDir)) {
  for (const f of readdirSync(scenDir).filter(n => n.endsWith('.json'))) {
    const s = loadJson(join(scenDir, f));
    insert('scenarios', {
      id: s.id, revision: rev, specialty_id: s.specialty_id || null,
      title: s.title, patient_json: s.patient || null,
      notes: s.notes || null, confidence: s.confidence || 'draft',
    });
    count('scenarios');
    (s.steps || []).forEach((st, i) => {
      insert('scenario_steps', { scenario_id: s.id, step_no: i + 1, day_offset: st.day_offset ?? null, action: st.action });
      count('scenario_steps');
    });
    for (const b of s.billing || []) {
      insert('scenario_billing', {
        scenario_id: s.id, step_no: b.step_no ?? null, kind: b.kind,
        item_id: b.item_id || null, label: b.label, points: b.points ?? null,
        reason: b.reason || null, status: b.status || 'unresolved',
        confidence: b.confidence || 'draft',
      });
      count('scenario_billing');
    }
  }
}

/* ---- マスター・電子点数表(原典CSVから直接投入。JSONを介さない) ---- */
const srcMasters = join(KB_ROOT, 'data', 'sources', rev, 'masters');
if (existsSync(srcMasters)) {
  ensureExtracted(rev);
  const bulk = (table, cols, rows, extra = {}) => {
    const allCols = [...Object.keys(extra), ...cols];
    const stmt = db.prepare(`INSERT INTO ${table} (${allCols.join(',')}) VALUES (${allCols.map(() => '?').join(',')})`);
    db.exec('BEGIN');
    for (const r of rows) {
      stmt.run(...Object.values(extra), ...cols.map(c => {
        const v = r[c];
        return v === undefined || v === null || v === '' ? null : v;
      }));
      count(table);
    }
    db.exec('COMMIT');
  };

  const master = loadIkaMaster(rev);
  bulk('master_items',
    ['code', 'short_name', 'name_kana', 'name_official', 'data_kikaku_code', 'points_kbn', 'points_raw', 'inout_kbn', 'kouki_kbn'],
    master.rows, { revision: rev, source_file: master.source_file });

  const edt = loadEdtTables(rev);
  bulk('edt_hojo',
    ['code', 'short_name', 'hokatsu_unit1', 'hokatsu_group1', 'hokatsu_unit2', 'hokatsu_group2', 'hokatsu_unit3', 'hokatsu_group3',
     'haihan_day', 'haihan_month', 'haihan_simul', 'haihan_week', 'nyuin_group', 'santei_kaisu_rel', 'start_date', 'end_date'],
    edt.hojo, { revision: rev });
  bulk('edt_hokatsu', ['group_no', 'code', 'short_name', 'tokurei', 'start_date', 'end_date'], edt.hokatsu, { revision: rev });
  bulk('edt_haihan', ['haihan_type', 'code1', 'name1', 'code2', 'name2', 'haihan_kbn', 'tokurei', 'start_date', 'end_date'], edt.haihan, { revision: rev });
  bulk('edt_nyuin_kasan', ['group_no', 'code', 'short_name', 'kasan_id', 'start_date', 'end_date'], edt.nyuin, { revision: rev });
  bulk('edt_santei_kaisu', ['code', 'short_name', 'unit_code', 'unit_name', 'max_count', 'tokurei', 'start_date', 'end_date'], edt.santei_kaisu, { revision: rev });
} else {
  console.log('data/sources のマスター原典が無いため master_items / edt_* はスキップ(原典取得後に再実行)');
}

db.close();
console.log(`構築完了: ${outPath} (${nowIso()})`);
for (const [t, n] of Object.entries(counts)) console.log(`  ${t}: ${n}`);
