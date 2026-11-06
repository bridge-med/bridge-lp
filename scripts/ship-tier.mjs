#!/usr/bin/env node
/* ================================================================
   出荷の段階(Light / Standard / Critical)を、変更したファイルの一覧から機械的に決める。
   現場が決めるのは「上げる」だけで、下げられない(ship スキル §0)。
   使い方: node scripts/ship-tier.mjs                 (作業ツリーの変更 = git status。未追跡も含む)
           node scripts/ship-tier.mjs --base <ref>    (<ref> との差分。CI では PR の base)
           --json を付けると JSON だけを出す
   テスト: node --test scripts/tests/ship-tier.test.mjs
   ================================================================ */
import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const git = (...a) => execFileSync('git', a, { cwd: repo, encoding: 'utf8' });

/* Critical: 公開の骨格・規範・配信・出荷ゲートの hook・秘密。着手前 pm → 全領分 → pm 総合判定 → 社長 */
export const CRITICAL = [
  [/^CONSTITUTION\.md$/, '憲法'],
  [/^docs\/(design-system|ia|context)\.md$/, '一次文書'],
  [/^shared\//, 'ブランドの面の共通基盤'],
  [/^index\.html$|^town\//, 'トップ(町)'],
  [/^products\/index\.html$|^projects\/index\.html$/, 'PRODUCTS/ACTIVITIES 配列'],
  [/^sitemap\.xml$|^robots\.txt$|^404\.html$/, 'サイトの骨格'],
  [/^legal\/|^services\/|^starter-kits\//, '法務・売上導線'],
  [/(^|\/)sw\.js$/, 'Service Worker(配信)'],
  [/^\.github\/workflows\/deploy\.yml$/, '公開の経路'],
  [/^\.claude\/settings\.json$|^scripts\/pre-commit-gate\.mjs$/, '出荷ゲートの hook(外せば機械検査が止まる)'],
  [/(^|\/)\.env(\.|$)|secret|credential|token|passw|api-?key/i, '認証・秘密の取り扱い(名前で判定)'],
];
/* workflow の差分(+行)に書き込みの権限・秘密・トークンが出てきたら Critical(名前では見えないので中身で判定)。read だけの permissions は上げない */
export const WORKFLOW_SENSITIVE = /^\+.*(secrets\.|GITHUB_TOKEN|GH_TOKEN|pull_request_target|\bid-token:\s*write|\b[a-z-]+:\s*write\b)/m;
/* Standard のうち公開物に触れないもの: 品質ゲート・CI・自動化。qa はゲートが落ちることを実地で確かめる */
export const GATE = [
  [/^scripts\/(check-site|check-shiplog|ship-tier|shiplog-stats)\.mjs$|^scripts\/check-site\.allowlist\.json$/, '品質ゲート'],
  [/^\.github\/workflows\//, 'CI・自動化'],
  [/^\.github\/scripts\//, '自動化のスクリプト'],
];
/* Light: 公開物にもゲートにも触れない内部の変更。機械検査 + 自己レビュー */
export const LIGHT = [
  [/^cockpit-76a805\//, '運営の記録'],
  [/^docs\//, '内部文書'],
  [/^\.claude\/|^CLAUDE\.md$/, 'ハーネスの規程'],
  [/^scripts\//, 'スクリプト(ゲート以外)'],
  [/^\.github\//, 'GitHub の設定(workflow 以外)'],
  [/^notes\/|^daily\/.*\.(json|md)$|^worklog\/.*\.(json|md)$/, 'フィードのデータ'],
  [/(^|\/)tests?\/|\.test\.mjs$/, 'テスト'],
  [/(^|\/)README(\.md)?$|\.(md|txt|jsonl|ya?ml)$|^\.gitignore$|^\.nojekyll$/, '文書・設定'],
];
const PUBLIC_EXT = /\.(html|css|js|mjs|json|svg|png|jpe?g|webp|gif|mp4|webm|woff2?)$/i;
const INTERNAL_DIR = /^(cockpit-76a805|docs|\.claude|scripts|\.github|notes)\//;

function diffText(base, path, status) {
  try {
    if (base) return git('diff', '-U0', `${base}...HEAD`, '--', path);
    if (status === 'A' && existsSync(join(repo, path))) return readFileSync(join(repo, path), 'utf8').replace(/^/gm, '+');
    return git('diff', '-U0', 'HEAD', '--', path);
  } catch { return ''; }
}

export function changedFiles(base) {
  const list = base
    ? git('diff', '--name-status', '-M', `${base}...HEAD`).split('\n').filter(Boolean).map(l => { const [s, a, b] = l.split('\t'); return { status: s[0], path: b || a }; })
    : git('status', '--porcelain', '--untracked-files=all').split('\n').filter(Boolean).map(l => {
        const s = l.slice(0, 2), p = l.slice(3).split(' -> ').pop();
        return { status: s === '??' ? 'A' : s.includes('D') ? 'D' : s.includes('A') ? 'A' : 'M', path: p };
      });
  for (const f of list) if (/^\.github\/workflows\//.test(f.path)) f.text = diffText(base, f.path, f.status);
  return list;
}

/** files: [{ status: 'A'|'M'|'D', path, text? }]。text は workflow の差分(+行)で、権限・秘密の判定に使う */
export function decide(files) {
  const reasons = { critical: [], standard: [], light: [] };
  for (const { status, path, text } of files) {
    if (path.startsWith('proto/')) { reasons.standard.push(`${path}: 試作(公開されるが結線なし)`); continue; }
    const c = CRITICAL.find(([re]) => re.test(path));
    if (c) { reasons.critical.push(`${path}: ${c[1]}`); continue; }
    if (/^\.github\/workflows\//.test(path) && text && WORKFLOW_SENSITIVE.test(text)) { reasons.critical.push(`${path}: workflow の権限・秘密に触れる`); continue; }
    if (/\.html$/.test(path) && (status === 'A' || status === 'D')) { reasons.critical.push(`${path}: ページの${status === 'A' ? '追加' : '削除'}`); continue; }
    const g = GATE.find(([re]) => re.test(path));
    if (g) { reasons.standard.push(`${path}: ${g[1]}`); continue; }
    const l = LIGHT.find(([re]) => re.test(path));
    if (l && !(PUBLIC_EXT.test(path) && !INTERNAL_DIR.test(path) && !/(^|\/)tests?\//.test(path))) { reasons.light.push(`${path}: ${l[1]}`); continue; }
    reasons.standard.push(`${path}: 公開物の変更`);
  }
  const tier = reasons.critical.length ? 'critical' : reasons.standard.length ? 'standard' : 'light';
  const gateOnly = tier === 'standard' && reasons.standard.every(r => /品質ゲート|CI・自動化|自動化のスクリプト/.test(r));
  const hints = [];
  if (tier === 'light') hints.push('機械検査(check-site)+自己レビュー。editor/designer/qa/pm は呼ばない。第34条の項目のうち当たるもの(主に第4章)は現場が自分で照合する。動くもの(scripts・workflows)は現場が実地で動かして notes に書く');
  if (tier === 'standard') {
    hints.push(gateOnly ? 'qa を呼ぶ(品質ゲート・CI の変更。違反を仕込んでゲートが落ちることを実地で確かめる)' : 'qa を呼ぶ(公開物に触れた)');
    if (!gateOnly && files.some(f => /\.(css|html)$/.test(f.path))) hints.push('見た目の差分があれば designer(CSS・<style>・レイアウト)');
    if (!gateOnly && files.some(f => /\.html$/.test(f.path))) hints.push('文言の差分があれば editor');
    hints.push('pm は、どこかの領分が要修正・条件つきを返したときと、完成の定義が変わったときだけ。それ以外は現場が第34条の項目を自分で照合して notes に書く');
  }
  if (tier === 'critical') hints.push('現行どおり全段: 着手前 pm → editor/designer/qa → pm 総合判定 → Artifact → 社長');
  return { tier, reasons, hints, files: files.length };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const i = process.argv.indexOf('--base');
  const base = i > 0 ? process.argv[i + 1] : null;
  const json = process.argv.includes('--json');
  let files;
  try { files = changedFiles(base); } catch (e) { console.error('git が引けない: ' + e.message); process.exit(2); }
  const d = decide(files);
  if (json) { console.log(JSON.stringify(d)); process.exit(0); }
  console.log(`段階: ${d.tier.toUpperCase()}(変更 ${d.files} ファイル${base ? `・${base} との差分` : '・作業ツリー'})`);
  for (const k of ['critical', 'standard', 'light']) if (d.reasons[k].length) { console.log(`- ${k}: ${d.reasons[k].length} 件`); for (const r of d.reasons[k].slice(0, 12)) console.log(`    ${r}`); if (d.reasons[k].length > 12) console.log(`    …他 ${d.reasons[k].length - 12} 件`); }
  console.log('進め方:'); for (const h of d.hints) console.log(`  - ${h}`);
  console.log('段階は上げてよいが下げない。shiplog の tier に書く');
}
