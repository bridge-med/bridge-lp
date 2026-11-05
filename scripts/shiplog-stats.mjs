#!/usr/bin/env node
/* ================================================================
   shiplog の月別集計。失敗率・差し戻し率・再発率・held 率・段階別の件数・所要時間を出す。
   記録にある数値だけを出す。無いものは「記録なし」と書き、推測で埋めない。
   使い方: node scripts/shiplog-stats.mjs            (標準出力に Markdown)
           node scripts/shiplog-stats.mjs --out FILE  (FILE に書く)
   v1 の行(2026-11-05 より前)は値が自由記述なので、先頭語(pass/fail/n/a/held/shipped)で読み替える。
   その読み替えで決まらない欄は「不明」に数え、表の下に件数を出す。
   ================================================================ */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUTOVER } from './check-shiplog.mjs';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const rows = readFileSync(join(repo, 'cockpit-76a805', 'shiplog.jsonl'), 'utf8').split('\n').filter(l => l.trim())
  .map((l, i) => { try { return { line: i + 1, ...JSON.parse(l) }; } catch { return { line: i + 1, broken: true }; } });

const st = (v) => v == null ? 'missing' : /^pass|^ok/.test(v) ? 'pass' : /^fail/.test(v) ? 'fail' : /^n\/a/.test(v) ? 'n/a' : /^skipped/.test(v) ? 'skipped' : 'unknown';
const vd = (v) => v == null ? 'missing' : /^shipped/.test(v) ? 'shipped' : /^held/.test(v) ? 'held' : /^wip/.test(v) ? 'wip' : 'unknown';

const months = {};
for (const r of rows) {
  const m = (r.date || '????-??').slice(0, 7);
  const M = months[m] ??= { rows: 0, broken: 0, v2: 0, shipped: 0, held: 0, wip: 0, verdictUnknown: 0, anyFail: 0, pmFail: 0, heldFix: 0, legacyReturn: 0, fixes: 0, legacyRecur: 0, tier: { light: 0, standard: 0, critical: 0 }, cellUnknown: 0, durations: [], agentCalls: 0, machineOnly: 0 };
  M.rows++;
  if (r.broken) { M.broken++; continue; }
  const v2 = r.date >= CUTOVER;
  if (v2) M.v2++;
  const v = vd(r.verdict);
  if (v === 'shipped' || v === 'held' || v === 'wip') M[v]++; else M.verdictUnknown++;
  const c = r.checks || {};
  const vals = Object.fromEntries(Object.entries(c).map(([k, x]) => [k, st(x)]));
  M.cellUnknown += Object.values(vals).filter(x => x === 'unknown').length;
  if (Object.values(vals).includes('fail')) M.anyFail++;
  if (vals.pm === 'fail' || st(r.pm) === 'fail') M.pmFail++;
  if (v === 'held' && (r.held_for === 'fix' || r.held_for === 'review')) M.heldFix++;
  if (!v2 && /差し戻し|不合格/.test(r.notes || '')) M.legacyReturn++;
  if (r.fixes) M.fixes++;
  if (!v2 && /再発/.test(r.notes || '')) M.legacyRecur++;
  if (v2 && M.tier[r.tier] != null) M.tier[r.tier]++;
  if (['qa', 'editor', 'designer'].every(k => vals[k] === 'n/a' || vals[k] === 'skipped' || vals[k] === 'missing')) M.machineOnly++;
  M.agentCalls += ['qa', 'editor', 'designer', 'pm'].filter(k => vals[k] === 'pass' || vals[k] === 'fail').length;
  if (r.started_at && r.finished_at) { const d = (Date.parse(r.finished_at) - Date.parse(r.started_at)) / 60000; if (Number.isFinite(d) && d >= 0) M.durations.push(d); }
}

const pct = (a, b) => b ? `${Math.round(a / b * 100)}%(${a}/${b})` : '—';
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const lines = [];
lines.push(`# shiplog の月別集計`, ``, `生成: ${new Date().toISOString().slice(0, 10)}。${CUTOVER} より前の行は v1(自由記述)で、先頭語で読み替えた参考値。トークン使用量は記録が無い。`, ``);
lines.push(`| 月 | 行 | shipped | held | wip | 段階 L/S/C | 失敗率(checks に fail) | 差し戻し率 | 再発率 | 機械検査のみ | 領分の呼び出し数 | 所要時間の中央値 |`);
lines.push(`|---|---|---|---|---|---|---|---|---|---|---|---|`);
for (const [m, M] of Object.entries(months).sort()) {
  const judged = M.shipped + M.held + M.wip;
  const ret = M.v2 === M.rows ? pct(M.anyFail + M.heldFix, judged) : `${pct(M.anyFail, judged)} / 語で ${M.legacyReturn} 行`;
  const rec = M.v2 === M.rows ? pct(M.fixes, M.shipped) : `fixes ${M.fixes} / 語で ${M.legacyRecur} 行`;
  const dur = M.durations.length ? `${Math.round(median(M.durations))} 分(${M.durations.length} 行)` : '記録なし';
  lines.push(`| ${m} | ${M.rows}${M.broken ? `(壊れた行 ${M.broken})` : ''} | ${M.shipped} | ${M.held} | ${M.wip} | ${M.v2 ? `${M.tier.light}/${M.tier.standard}/${M.tier.critical}` : '—'} | ${pct(M.anyFail, judged)} | ${ret} | ${rec} | ${pct(M.machineOnly, M.rows)} | ${M.agentCalls} | ${dur} |`);
}
const unknownCells = Object.values(months).reduce((a, M) => a + M.cellUnknown, 0);
const unknownVerdicts = Object.values(months).reduce((a, M) => a + M.verdictUnknown, 0);
lines.push(``, `- 読み替えで決まらなかった欄: ${unknownCells}、verdict が無い/読めない行: ${unknownVerdicts}(v1 の行。集計からは外れている)`);
lines.push(`- 差し戻し率(v2)= checks に fail がある行 + held_for が fix/review の行 ÷ 判定した行。再発率(v2)= fixes を持つ行 ÷ shipped。v1 は notes の語(差し戻し・不合格・再発)の件数を参考に出す`);
lines.push(`- 所要時間は started_at/finished_at を書いた行だけ。領分の呼び出し数は qa/editor/designer/pm が pass か fail の欄の数`);
const text = lines.join('\n') + '\n';
const outIdx = process.argv.indexOf('--out');
if (outIdx > 0 && process.argv[outIdx + 1]) { writeFileSync(join(repo, process.argv[outIdx + 1]), text); console.log(`wrote ${process.argv[outIdx + 1]}`); }
else process.stdout.write(text);
