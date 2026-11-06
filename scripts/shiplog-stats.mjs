#!/usr/bin/env node
/* ================================================================
   shiplog の月別集計。記録にある数値だけを出す。無いものは「記録なし」と書き、推測で埋めない。
   使い方: node scripts/shiplog-stats.mjs            (標準出力に Markdown)
           node scripts/shiplog-stats.mjs --out FILE  (FILE に書く。リポジトリ起点)
   テスト: node --test scripts/tests/shiplog-stats.test.mjs

   単位の区別:
   - 記録行 = JSONL の1行。
   - 出荷 = `ship` の名で結んだ行の組(wip→held→shipped)。名が無い行は1行で1出荷。最終判定はその出荷の最後の行の verdict。
     出荷の月は最後の行の日付の月。
   率の定義(v2 の行だけ):
   - 失敗率 = checks に fail がある行 ÷ 判定した行(verdict が wip でない行)。
   - 差し戻し率 = 差し戻しのあった出荷 ÷ 判定に至った出荷(最終判定が wip でない出荷)。
     差し戻し = その出荷のどれかの行に checks の fail があるか、held_for が fix か review の行がある。1出荷は多くても1回しか数えない。
     held_for が owner・external(社長や外部の入力待ち)と wip は差し戻しではない。
   - 再発率 = fixes を持つ出荷 ÷ 最終判定が shipped の出荷。
   - held 率 = 最終判定が held の出荷 ÷ 出荷。
   v1 の行(CUTOVER より前)は値が自由記述なので、別表の参考値にだけ出す(先頭語 pass/fail/n/a/shipped/held と notes の語で数える)。本表には混ぜない。
   ================================================================ */
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUTOVER, parseTime } from './check-shiplog.mjs';

/** 中央値。奇数件は中央の値、偶数件は中央2値の平均。空なら null */
export function median(values) {
  const s = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

const st = (v) => v == null ? 'missing' : /^pass|^ok/.test(v) ? 'pass' : /^fail/.test(v) ? 'fail' : /^n\/a/.test(v) ? 'n/a' : /^skipped/.test(v) ? 'skipped' : 'unknown';
const vd = (v) => v == null ? 'missing' : /^shipped/.test(v) ? 'shipped' : /^held/.test(v) ? 'held' : /^wip/.test(v) ? 'wip' : 'unknown';
const hasFail = (r) => Object.values(r.checks || {}).some(v => st(v) === 'fail');
const isReturnRow = (r) => hasFail(r) || (vd(r.verdict) === 'held' && (r.held_for === 'fix' || r.held_for === 'review'));

export function parseRows(text) {
  return text.split('\n').filter(l => l.trim()).map((l, i) => { try { return { line: i + 1, ...JSON.parse(l) }; } catch { return { line: i + 1, broken: true, date: '' }; } });
}

/** 月別の集計。{ v2: {月: …}, v1: {月: …} } */
export function aggregate(rows) {
  const v2 = {}, v1 = {};
  const monthOf = (d) => (d || '????-??').slice(0, 7);
  const M2 = (m) => v2[m] ??= { rows: 0, broken: 0, verdict: { shipped: 0, held: 0, wip: 0 }, judgedRows: 0, failRows: 0, tier: { light: 0, standard: 0, critical: 0 }, machineOnly: 0, agentCalls: 0, durations: [], units: 0, finalShipped: 0, finalHeld: 0, finalWip: 0, judgedUnits: 0, returnedUnits: 0, fixesUnits: 0 };
  const M1 = (m) => v1[m] ??= { rows: 0, broken: 0, shipped: 0, held: 0, other: 0, failRows: 0, returnWords: 0, recurWords: 0, machineOnly: 0, unknownCells: 0 };

  // 記録行
  for (const r of rows) {
    const m = monthOf(r.date);
    if (r.broken) { (r.date && r.date >= CUTOVER ? M2(m) : M1(m)).broken++; continue; }
    if (r.date < CUTOVER) {
      const M = M1(m); M.rows++;
      const v = vd(r.verdict); if (v === 'shipped' || v === 'held') M[v]++; else M.other++;
      if (hasFail(r)) M.failRows++;
      if (/差し戻し|不合格/.test(r.notes || '')) M.returnWords++;
      if (/再発/.test(r.notes || '')) M.recurWords++;
      const c = r.checks || {}; M.unknownCells += Object.values(c).filter(x => st(x) === 'unknown').length;
      if (['qa', 'editor', 'designer'].every(k => ['n/a', 'skipped', 'missing'].includes(st(c[k])))) M.machineOnly++;
      continue;
    }
    const M = M2(m); M.rows++;
    const v = vd(r.verdict); if (M.verdict[v] != null) M.verdict[v]++;
    if (v !== 'wip') { M.judgedRows++; if (hasFail(r)) M.failRows++; }
    if (M.tier[r.tier] != null) M.tier[r.tier]++;
    const c = r.checks || {};
    if (['qa', 'editor', 'designer'].every(k => ['n/a', 'skipped'].includes(c[k]))) M.machineOnly++;
    M.agentCalls += ['qa', 'editor', 'designer', 'pm'].filter(k => c[k] === 'pass' || c[k] === 'fail').length;
    const s = parseTime(r.started_at), f = parseTime(r.finished_at);
    if (Number.isFinite(s) && Number.isFinite(f) && f >= s) M.durations.push((f - s) / 60000);
  }
  // 出荷(v2 だけ)。ship の名で結ぶ。名が無い行は1行1出荷
  const units = new Map();
  for (const r of rows) {
    if (r.broken || r.date < CUTOVER) continue;
    const key = r.ship ? `ship:${r.ship}` : `line:${r.line}`;
    (units.get(key) ?? units.set(key, []).get(key)).push(r);
  }
  for (const list of units.values()) {
    list.sort((a, b) => a.date.localeCompare(b.date) || a.line - b.line);
    const last = list[list.length - 1];
    const M = M2(monthOf(last.date));
    M.units++;
    const fin = vd(last.verdict);
    if (fin === 'shipped') M.finalShipped++; else if (fin === 'held') M.finalHeld++; else if (fin === 'wip') M.finalWip++;
    if (fin !== 'wip') { M.judgedUnits++; if (list.some(isReturnRow)) M.returnedUnits++; }
    if (fin === 'shipped' && list.some(r => r.fixes)) M.fixesUnits++;
  }
  return { v2, v1 };
}

export function render({ v2, v1 }, today = new Date().toISOString().slice(0, 10)) {
  const pct = (a, b) => b ? `${Math.round(a / b * 100)}%(${a}/${b})` : '—';
  const L = [];
  L.push(`# shiplog の月別集計`, ``, `生成: ${today}。本表は ${CUTOVER} 以降の v2 の行だけ。それより前の行は参考値の表に分けた。トークン使用量は記録が無い。`, ``);
  L.push(`## 出荷(v2)`, ``, `| 月 | 記録行 | 行の verdict s/h/w | 出荷 | 最終判定 s/h/w | 段階 L/S/C | 失敗率 | 差し戻し率 | 再発率 | held 率 | 機械検査のみの行 | 領分の呼び出し数 | 所要時間の中央値 |`, `|---|---|---|---|---|---|---|---|---|---|---|---|---|`);
  const keys2 = Object.keys(v2).sort();
  if (!keys2.length) L.push(`| — | 0 | | 0 | | | — | — | — | — | — | 0 | 記録なし |`);
  for (const m of keys2) {
    const M = v2[m];
    const med = median(M.durations);
    L.push(`| ${m} | ${M.rows}${M.broken ? `(壊れた行 ${M.broken})` : ''} | ${M.verdict.shipped}/${M.verdict.held}/${M.verdict.wip} | ${M.units} | ${M.finalShipped}/${M.finalHeld}/${M.finalWip} | ${M.tier.light}/${M.tier.standard}/${M.tier.critical} | ${pct(M.failRows, M.judgedRows)} | ${pct(M.returnedUnits, M.judgedUnits)} | ${pct(M.fixesUnits, M.finalShipped)} | ${pct(M.finalHeld, M.units)} | ${pct(M.machineOnly, M.rows)} | ${M.agentCalls} | ${med == null ? '記録なし' : `${Math.round(med)} 分(${M.durations.length} 行)`} |`);
  }
  L.push(``, `- 出荷 = \`ship\` の名で結んだ行の組(wip→held→shipped)。名の無い行は1行で1出荷。最終判定は最後の行。出荷の月は最後の行の月`);
  L.push(`- 失敗率 = checks に fail がある行 ÷ 判定した行(wip を除く)。差し戻し率 = 差し戻しのあった出荷 ÷ 判定に至った出荷(最終判定が wip でない)。差し戻し = fail の行があるか held_for が fix/review の行がある(1出荷1回まで。owner・external の held と wip は数えない)。再発率 = fixes を持つ出荷 ÷ 最終判定 shipped の出荷。held 率 = 最終判定 held ÷ 出荷`);
  L.push(`- 機械検査のみ = qa/editor/designer がすべて n/a か skipped の行。領分の呼び出し数 = qa/editor/designer/pm が pass か fail の欄の数。所要時間は started_at/finished_at を書いた行だけ(中央値。偶数件は中央2値の平均)`);
  L.push(``, `## 参考値(v1 の行。${CUTOVER} より前。自由記述を先頭語と notes の語で読み替えたもので、本表と並べない)`, ``, `| 月 | 行 | shipped | held | その他 | fail の行 | 「差し戻し・不合格」の語 | 「再発」の語 | 機械検査のみの行 | 読めない欄 |`, `|---|---|---|---|---|---|---|---|---|---|`);
  for (const m of Object.keys(v1).sort()) { const M = v1[m]; L.push(`| ${m} | ${M.rows}${M.broken ? `(壊れた行 ${M.broken})` : ''} | ${M.shipped} | ${M.held} | ${M.other} | ${M.failRows} | ${M.returnWords} | ${M.recurWords} | ${M.machineOnly} | ${M.unknownCells} |`); }
  return L.join('\n') + '\n';
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
  const text = render(aggregate(parseRows(readFileSync(join(repo, 'cockpit-76a805', 'shiplog.jsonl'), 'utf8'))));
  const i = process.argv.indexOf('--out');
  if (i > 0 && process.argv[i + 1]) { writeFileSync(join(repo, process.argv[i + 1]), text); console.log(`wrote ${process.argv[i + 1]}`); }
  else process.stdout.write(text);
}
