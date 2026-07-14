#!/usr/bin/env node
/* ================================================================
   cockpit/ledger.json の lastCommit をgit履歴から焼き込む。
   静的サイトでビルドがないため、出荷(コミット)のたびに現場が実行する。
   使い方: node scripts/update-ledger.mjs
   ================================================================ */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');
const ledgerPath = join(repo, 'cockpit', 'ledger.json');
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
