#!/usr/bin/env node
/* ================================================================
   shiplog(cockpit-76a805/shiplog.jsonl)の検査。
   2026-11-05 以降の行(v2)だけに固定スキーマを強制する。それより前の行は履歴で、検査しない。
   check-site.mjs から呼ばれる(単体でも走る: node scripts/check-shiplog.mjs)。

   v2 の1行:
   {"date":"YYYY-MM-DD","tier":"light|standard|critical","scope":"一言",
    "checks":{"machine":S,"qa":S,"editor":S,"designer":S,"pm":S},   S = pass|fail|n/a|skipped
    "verdict":"shipped|held|wip","held_for":"owner|review|fix|external"(held のときだけ必須),
    "commit":""(任意),"pr":182(任意),"started_at":"ISO"(任意),"finished_at":"ISO"(任意),
    "fixes":"YYYY-MM-DD"(任意。再発の修正なら、元の不具合を出荷した行の日付),"notes":"所見"}
   n/a は「差分の種類から対象外」、skipped は「対象だが未実施」(wip・先行コミット)。
   ================================================================ */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CUTOVER = '2026-11-05';
export const STATUS = ['pass', 'fail', 'n/a', 'skipped'];
export const TIERS = ['light', 'standard', 'critical'];
export const VERDICTS = ['shipped', 'held', 'wip'];
export const HELD_FOR = ['owner', 'review', 'fix', 'external'];
const CHECK_KEYS = ['machine', 'qa', 'editor', 'designer', 'pm'];
const REQUIRED = ['date', 'tier', 'scope', 'checks', 'verdict', 'notes'];
const OPTIONAL = ['commit', 'pr', 'held_for', 'started_at', 'finished_at', 'fixes'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;

/** 違反を [{ line, message }] で返す。空なら合格 */
export function checkShiplog(repo) {
  const lines = readFileSync(join(repo, 'cockpit-76a805', 'shiplog.jsonl'), 'utf8').split('\n');
  const out = [];
  const bad = (line, message) => out.push({ line, message });
  lines.forEach((text, i) => {
    const line = i + 1;
    if (text.trim() === '') { if (i !== lines.length - 1) bad(line, '空行(1出荷1行。末尾の改行だけ許す)'); return; }
    let r;
    try { r = JSON.parse(text); } catch (e) { bad(line, `JSON として読めない(${e.message})`); return; }
    if (typeof r.date !== 'string' || !DATE.test(r.date)) { bad(line, 'date が YYYY-MM-DD でない'); return; }
    if (r.date < CUTOVER) return; // v1 の行は履歴のまま
    for (const k of REQUIRED) if (!(k in r)) bad(line, `${k} がない`);
    for (const k of Object.keys(r)) if (!REQUIRED.includes(k) && !OPTIONAL.includes(k)) bad(line, `知らない項目 ${k}(所見は notes へ)`);
    if (!TIERS.includes(r.tier)) bad(line, `tier は ${TIERS.join('|')}(${JSON.stringify(r.tier)})`);
    if (typeof r.scope !== 'string' || !r.scope.trim()) bad(line, 'scope が空');
    if (typeof r.notes !== 'string') bad(line, 'notes は文字列(無ければ "")');
    if (r.checks && typeof r.checks === 'object') {
      for (const k of CHECK_KEYS) if (!STATUS.includes(r.checks[k])) bad(line, `checks.${k} は ${STATUS.join('|')}(${JSON.stringify(r.checks[k])})`);
      for (const k of Object.keys(r.checks)) if (!CHECK_KEYS.includes(k)) bad(line, `checks に知らない欄 ${k}`);
    } else bad(line, 'checks がオブジェクトでない');
    if (!VERDICTS.includes(r.verdict)) bad(line, `verdict は ${VERDICTS.join('|')}(${JSON.stringify(r.verdict)})`);
    if (r.verdict === 'held' && !HELD_FOR.includes(r.held_for)) bad(line, `held の行は held_for(${HELD_FOR.join('|')})が要る`);
    if (r.verdict !== 'held' && 'held_for' in r) bad(line, 'held_for は held の行だけ');
    if (r.verdict === 'wip' && !(r.notes || '').trim()) bad(line, 'wip の行は notes に未実施の照合を書く');
    if ('commit' in r && typeof r.commit !== 'string') bad(line, 'commit は文字列');
    if ('pr' in r && !(Number.isInteger(r.pr) && r.pr > 0)) bad(line, 'pr は PR 番号(整数)');
    for (const k of ['started_at', 'finished_at']) if (k in r && !ISO.test(r[k])) bad(line, `${k} は ISO 8601(例 2026-11-05T09:30:00+09:00)`);
    if ('started_at' in r && 'finished_at' in r && r.finished_at < r.started_at) bad(line, 'finished_at が started_at より前');
    if ('fixes' in r && !DATE.test(r.fixes)) bad(line, 'fixes は元の行の日付(YYYY-MM-DD)');
  });
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
  const v = checkShiplog(repo);
  if (v.length) {
    console.error(`NG — shiplog の違反 ${v.length} 件`);
    for (const x of v) console.error(`  ${x.line}行目: ${x.message}`);
    process.exit(1);
  }
  console.log('OK — shiplog(v2 の行)に違反なし');
}
