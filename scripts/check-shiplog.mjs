#!/usr/bin/env node
/* ================================================================
   shiplog(cockpit-76a805/shiplog.jsonl)の検査。
   2026-11-05 以降の行(v2)だけに固定スキーマを強制する。それより前の行は履歴で、検査しない。
   check-site.mjs から呼ばれる(単体でも走る: node scripts/check-shiplog.mjs)。
   テスト: node --test scripts/tests/check-shiplog.test.mjs

   v2 の1行:
   {"date":"YYYY-MM-DD","tier":"light|standard|critical","scope":"一言",
    "checks":{"machine":S,"qa":S,"editor":S,"designer":S,"pm":S},   S = pass|fail|n/a|skipped
    "verdict":"shipped|held|wip","held_for":"owner|review|fix|external"(held のときだけ必須),
    "ship":"同じ出荷の行を結ぶ名"(任意。wip→held→shipped を1出荷として数えるため。無ければ1行が1出荷),
    "commit":""(任意),"pr":182(任意),"started_at":"ISO"(任意),"finished_at":"ISO"(任意),
    "fixes":"YYYY-MM-DD"(任意。再発の修正なら、元の不具合を出荷した行の日付),"notes":"所見"}
   n/a は「差分の種類から対象外(段階の規則で呼ばない領分も)」、skipped は「対象だが未実施」(wip・先行コミット)。
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
const OPTIONAL = ['ship', 'commit', 'pr', 'held_for', 'started_at', 'finished_at', 'fixes'];
const DATE = /^\d{4}-\d{2}-\d{2}$/;
/* ISO 8601 の日時。オフセット(Z か ±hh:mm)を必ず持つ。比べるときは Date.parse で時刻にしてから比べる(文字列の比較はオフセットが違うと狂う) */
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
export const parseTime = (s) => (typeof s === 'string' && ISO.test(s)) ? Date.parse(s) : NaN;

/** JSONL の本文を検査し、違反を [{ line, message }] で返す。空なら合格 */
export function checkShiplogText(text) {
  const lines = text.split('\n');
  const out = [];
  const bad = (line, message) => out.push({ line, message });
  lines.forEach((raw, i) => {
    const line = i + 1;
    if (raw.trim() === '') { if (i !== lines.length - 1) bad(line, '空行(1出荷1行。末尾の改行だけ許す)'); return; }
    let r;
    try { r = JSON.parse(raw); } catch (e) { bad(line, `JSON として読めない(${e.message})`); return; }
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
    if ('ship' in r && (typeof r.ship !== 'string' || !r.ship.trim())) bad(line, 'ship は出荷を結ぶ名(空でない文字列)');
    if ('commit' in r && typeof r.commit !== 'string') bad(line, 'commit は文字列');
    if ('pr' in r && !(Number.isInteger(r.pr) && r.pr > 0)) bad(line, 'pr は PR 番号(整数)');
    for (const k of ['started_at', 'finished_at']) if (k in r && !Number.isFinite(parseTime(r[k]))) bad(line, `${k} は ISO 8601 でオフセット付き(例 2026-11-05T09:30:00+09:00)`);
    if ('started_at' in r && 'finished_at' in r) {
      const s = parseTime(r.started_at), f = parseTime(r.finished_at);
      if (Number.isFinite(s) && Number.isFinite(f) && f < s) bad(line, 'finished_at が started_at より前(時刻で比べた。オフセットを確かめる)');
    }
    if ('fixes' in r && !DATE.test(r.fixes)) bad(line, 'fixes は元の行の日付(YYYY-MM-DD)');
  });
  return out;
}

export function checkShiplog(repo) {
  return checkShiplogText(readFileSync(join(repo, 'cockpit-76a805', 'shiplog.jsonl'), 'utf8'));
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
