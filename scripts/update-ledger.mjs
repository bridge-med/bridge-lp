#!/usr/bin/env node
/* ================================================================
   cockpit-76a805/ledger.json の lastCommit をgit履歴から焼き込む。
   静的サイトでビルドがないため、出荷(コミット)のたびに現場が実行する。
   使い方: node scripts/update-ledger.mjs
   ================================================================ */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');

// 浅いクローン(git clone --depth)では git log が途中で切れ、全製品の lastCommit が
// 最古のコミットの日付に書き換わる(2026-10-11 に 22 製品が巻き戻った)。走らせずに止める。
const isShallow = () => {
  try {
    return execFileSync('git', ['rev-parse', '--is-shallow-repository'], { cwd: repo, encoding: 'utf8' }).trim() === 'true';
  } catch {
    return true; // git が引けないなら焼き込まない
  }
};
if (isShallow()) {
  console.error('update-ledger: 浅いクローン(shallow)のため lastCommit を焼き込みません。`git fetch --unshallow` の後に実行してください。ledger.json は変更していません。');
  process.exit(2);
}
const ledgerPath = join(repo, 'cockpit-76a805', 'ledger.json');
const ledger = JSON.parse(readFileSync(ledgerPath, 'utf8'));

const lastCommitDate = (paths) => {
  if (!paths.length) return '';
  try {
    return execFileSync('git', ['log', '-1', '--format=%as', '--', ...paths], { cwd: repo, encoding: 'utf8' }).trim();
  } catch {
    return '';
  }
};

for (const p of ledger.products) {
  p.lastCommit = lastCommitDate(p.dirs || []);
}
ledger.updated = lastCommitDate(['.']);

writeFileSync(ledgerPath, JSON.stringify(ledger, null, 2) + '\n', 'utf8');
console.log(`updated ${ledger.products.length} products (ledger.updated=${ledger.updated})`);
