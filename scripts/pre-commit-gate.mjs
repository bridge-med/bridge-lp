#!/usr/bin/env node
/* ================================================================
   出荷ゲート。PreToolUse hook(matcher: Bash)から呼ばれる。
   stdinのJSONからコマンドを読み、git commit を含むときだけ
   check-site.mjs を走らせる。違反があれば終了コード2でブロックし、
   違反一覧をstderrに返す(憲法第34条・第9条4号の機械化)。
   単体テスト: echo '{"tool_input":{"command":"git commit"}}' | node scripts/pre-commit-gate.mjs
   ================================================================ */
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = join(dirname(fileURLToPath(import.meta.url)), '..');

let input = '';
for await (const chunk of process.stdin) input += chunk;
let command = '';
try { command = JSON.parse(input)?.tool_input?.command ?? ''; } catch { /* JSONでなければ対象外 */ }

// git commit を含むコマンドだけが対象。広めに拾う(検査は速いので空振りしてよい)
if (!/\bgit\b[^|;&<>]*\bcommit\b/.test(command)) process.exit(0);

const result = spawnSync('node', [join(repo, 'scripts', 'check-site.mjs')], { cwd: repo, encoding: 'utf8', timeout: 60_000 });
if (result.status === 0) process.exit(0);

process.stderr.write(
  '出荷ゲート: check-site.mjs が失敗したためコミットをブロックした。\n' +
  '違反を直すか、直せない事情があれば scripts/check-site.allowlist.json に理由付きで登録すること。\n\n' +
  (result.stdout || '') + (result.stderr || '')
);
process.exit(2);
