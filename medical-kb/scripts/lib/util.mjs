/* medical-kb 共通ユーティリティ。依存パッケージなし(Node 22+) */
import { readFileSync, writeFileSync, mkdirSync, existsSync, createReadStream } from 'node:fs';
import { dirname, join } from 'node:path';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const KB_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function loadJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

export function saveJson(path, data) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export function sha256File(path) {
  const h = createHash('sha256');
  h.update(readFileSync(path));
  return h.digest('hex');
}

/* ダウンロードは curl に委譲する。
   理由: この環境群では外向きHTTPSがプロキシ(HTTPS_PROXY)経由であり、
   curl は HTTPS_PROXY と CA バンドル環境変数を素直に読むため。
   Node組み込みfetchはNode 22時点で環境変数プロキシを読まない。 */
export function download(url, destPath, { timeoutSec = 120 } = {}) {
  mkdirSync(dirname(destPath), { recursive: true });
  execFileSync('curl', [
    '-sS', '--fail', '--location',
    '--retry', '3', '--retry-delay', '2',
    '--max-time', String(timeoutSec),
    '-A', 'bridge-medical-kb/0.1 (research; contact via repo)',
    '-o', destPath,
    url,
  ], { stdio: ['ignore', 'inherit', 'inherit'] });
  return sha256File(destPath);
}

export function nowIso() {
  return new Date().toISOString();
}

/* Shift_JISのCSVを行×列に読む(全マスターはShift_JIS配布) */
export function readSjisCsv(path) {
  const buf = readFileSync(path);
  const text = new TextDecoder('shift_jis').decode(buf);
  return text.split(/\r?\n/).filter(l => l.length > 0).map(parseCsvLine);
}

function parseCsvLine(line) {
  const out = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ',') { out.push(cur); cur = ''; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
