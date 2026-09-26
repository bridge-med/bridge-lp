/* 宛先しらべ 毎日の取り込み(.github/workflows/refresh-atesaki.yml)の「プッシュしてよいもの」の防御のテスト
 * 実行: node --test atesaki-76a805/tests/*.test.mjs
 * ワークフローの「Commit and push (generated data only)」の段の中身をそのまま取り出し、一時フォルダに作った
 * 手元の git(master を持つ bare の remote と、actions/checkout@v4 と同じ深さ1の checkout)の上で走らせる。GitHub には通信しない。
 * 確かめること: atesaki-76a805/data/ 直下のふつうのファイルの変更・追加だけなら1コミットでプッシュする /
 * それ以外(ほかのファイル・追跡していない新しいファイル・data/ の下のフォルダ・削除・シンボリックリンク)が1つでもあれば、
 * コミットもプッシュもせずに失敗する / master が先に進んでいても取り込みのコミットだけを載せる / 同じ内容が先に入って
 * いたら何もせずに終える / master にない別の変更のコミットが手元にあればプッシュしない / data/ がぶつかったらプッシュしない /
 * ワークフローのほかの段がコミット・プッシュしない、防御の段が失敗を握りつぶさない、ジョブが master でだけ動く。 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, unlinkSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const YAML = readFileSync(join(REPO, '.github', 'workflows', 'refresh-atesaki.yml'), 'utf8');

// 段の名前から run: | のかたまりを取り出して、字下げを外す
function stepScript(name) {
  const lines = YAML.split('\n');
  const at = lines.findIndex(l => l.trim() === '- name: ' + name);
  assert.ok(at >= 0, '段が見つからない: ' + name);
  const r = lines.findIndex((l, i) => i > at && /^\s*run: \|\s*$/.test(l));
  const indent = lines[r].match(/^\s*/)[0].length;
  const body = [];
  for (const l of lines.slice(r + 1)) {
    if (l.trim() && l.match(/^\s*/)[0].length <= indent) break;
    body.push(l);
  }
  const cut = Math.min(...body.filter(l => l.trim()).map(l => l.match(/^\s*/)[0].length));
  return body.map(l => l.slice(cut)).join('\n');
}
const GUARD = 'Commit and push (generated data only)';
const SCRIPT = stepScript(GUARD);

// 使っている人の git の設定(署名など)に左右されないように切り離す
const ENV = { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_TERMINAL_PROMPT: '0' };
delete ENV.XDG_CONFIG_HOME;
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', env: ENV });
  if (r.status !== 0) throw new Error('git ' + args.join(' ') + '\n' + r.stderr);
  return r.stdout.trim();
};
const put = (dir, path, text) => { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), text); };
const commitAll = (dir, msg) => { git(dir, 'add', '-A'); git(dir, '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-q', '-m', msg); };

// remote(bare・master)と、Actions の checkout に当たる work を作る。work は actions/checkout@v4 と同じく、
// master の先端の1コミットだけを深さ1で取ってきて checkout -B master する
function repo(root) {
  ENV.HOME = root;
  const remote = join(root, 'remote.git');
  git(root, 'init', '-q', '--bare', remote);
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/master');
  const seed = join(root, 'seed');
  git(root, 'clone', '-q', remote, seed);
  git(seed, 'checkout', '-q', '-B', 'master');
  put(seed, 'atesaki-76a805/data/archive.json', '{"items":[1]}\n');
  put(seed, 'atesaki-76a805/data/likes.json', '{"likes":{}}\n');
  put(seed, 'atesaki-76a805/app/app.js', '// app\n');
  put(seed, 'scripts/atesaki-build.mjs', '// build\n');
  put(seed, 'README.md', 'readme\n');
  commitAll(seed, 'seed');
  git(seed, 'push', '-q', 'origin', 'master');
  const work = join(root, 'work');
  mkdirSync(work);
  git(work, 'init', '-q');
  git(work, 'remote', 'add', 'origin', 'file://' + remote);
  const sha = git(remote, 'rev-parse', 'master');
  git(work, 'fetch', '-q', '--depth=1', 'origin', '+' + sha + ':refs/remotes/origin/master');
  git(work, 'checkout', '-q', '-B', 'master', 'refs/remotes/origin/master');
  return { root, remote, seed, work, tip: () => git(remote, 'rev-parse', 'master') };
}

function guard(work) {
  const out = join(work, '..', 'github_output');
  writeFileSync(out, '');
  const r = spawnSync('bash', ['-c', SCRIPT], { cwd: work, encoding: 'utf8', env: { ...ENV, GITHUB_OUTPUT: out } });
  return { status: r.status, log: r.stdout + r.stderr, output: readFileSync(out, 'utf8') };
}
const inRepo = fn => () => {
  const root = mkdtempSync(join(tmpdir(), 'atesaki-guard-'));
  try { fn(repo(root)); } finally { rmSync(root, { recursive: true, force: true }); }
};
const changed = (remote, a, b) => git(remote, 'diff', '--name-only', '--no-renames', a, b).split('\n').filter(Boolean).sort();

test('ワークフローの形: 防御の段だけがコミット・プッシュし、失敗を握りつぶさず、ジョブは master でだけ動く', () => {
  assert.match(SCRIPT, /git push origin HEAD:master/);
  assert.ok(SCRIPT.indexOf('| outside') < SCRIPT.indexOf('git commit'), 'コミットの前に確かめていない');
  assert.ok(SCRIPT.lastIndexOf('| outside') < SCRIPT.indexOf('git push'), 'プッシュの前に確かめていない');
  // ジョブ refresh の直下の if(段の if ではなく)
  assert.match(YAML, /^  refresh:\n    if: github\.ref == 'refs\/heads\/master'\n/m, 'ジョブが master 以外でも動く');
  // git commit / git push が出てくるのは防御の段の中だけ
  const count = (text, re) => (text.match(re) || []).length;
  for (const re of [/git\s+commit/g, /git\s+push/g]) assert.equal(count(YAML, re), count(SCRIPT, re), 'ほかの段にも ' + re.source + ' がある');
  // 防御の段(名前から次の段まで)に、失敗を握りつぶす・動く場所を変える指定がない
  const block = YAML.slice(YAML.indexOf('- name: ' + GUARD), YAML.indexOf('- name:', YAML.indexOf('- name: ' + GUARD) + 1));
  for (const key of ['continue-on-error', 'shell:', 'working-directory', 'if:']) assert.ok(!block.includes(key), '防御の段に ' + key);
  assert.ok(!/continue-on-error/.test(YAML), 'ワークフローに continue-on-error がある');
});

test('data/ 直下の変更と追加だけなら、1コミットで master へプッシュする', inRepo(t => {
  const before = t.tip();
  put(t.work, 'atesaki-76a805/data/archive.json', '{"items":[1,2]}\n');
  put(t.work, 'atesaki-76a805/data/missing.json', '{}\n');
  const r = guard(t.work);
  assert.equal(r.status, 0, r.log);
  assert.match(r.output, /pushed=true/);
  assert.equal(git(t.remote, 'rev-parse', 'master~1'), before);
  assert.deepEqual(changed(t.remote, before, 'master'), ['atesaki-76a805/data/archive.json', 'atesaki-76a805/data/missing.json']);
}));

test('変更がなければ、コミットもプッシュもせずに終える', inRepo(t => {
  const before = t.tip();
  const r = guard(t.work);
  assert.equal(r.status, 0, r.log);
  assert.match(r.output, /pushed=false/);
  assert.equal(t.tip(), before);
}));

const refused = (name, change) => test(name, inRepo(t => {
  const before = t.tip();
  const head = git(t.work, 'rev-parse', 'HEAD');
  put(t.work, 'atesaki-76a805/data/archive.json', '{"items":[1,2]}\n');
  change(t.work);
  const r = guard(t.work);
  assert.notEqual(r.status, 0, r.log);
  assert.doesNotMatch(r.output, /pushed=true/);
  assert.equal(t.tip(), before, 'プッシュされた');
  assert.equal(git(t.work, 'rev-parse', 'HEAD'), head, 'コミットされた');
}));
refused('data/ 以外の追跡しているファイルが変わっていたら、コミットもプッシュもせずに失敗する',
  w => put(w, 'atesaki-76a805/app/app.js', '// changed\n'));
refused('data/ の外に追跡していない新しいファイルがあっても、失敗する',
  w => put(w, 'scripts/new.mjs', '// new\n'));
refused('data/ の下のフォルダのファイルは、生成データとして認めない',
  w => put(w, 'atesaki-76a805/data/sub/x.json', '{}\n'));
refused('data/ のファイルを消していたら、失敗する',
  w => unlinkSync(join(w, 'atesaki-76a805/data/likes.json')));
refused('data/ のファイルを外へ移していたら、失敗する',
  w => { unlinkSync(join(w, 'atesaki-76a805/data/likes.json')); put(w, 'likes.json', '{"likes":{}}\n'); });
refused('ワークフロー自身を書き換えていても、失敗する',
  w => put(w, '.github/workflows/refresh-atesaki.yml', 'name: x\n'));
refused('パスの途中に atesaki-76a805/data/ を含むだけのファイルは、生成データとして認めない',
  w => put(w, 'x/atesaki-76a805/data/a.json', '{}\n'));
refused('data/ 直下でも、シンボリックリンクは認めない',
  w => symlinkSync('../app/app.js', join(w, 'atesaki-76a805/data/link.json')));
refused('data/ 直下でも、入れ子のリポジトリは認めない',
  w => { mkdirSync(join(w, 'atesaki-76a805/data/sub')); git(join(w, 'atesaki-76a805/data/sub'), 'init', '-q'); put(w, 'atesaki-76a805/data/sub/x', 'x\n'); commitAll(join(w, 'atesaki-76a805/data/sub'), 'nested'); });

test('同じ内容が先に master に入っていたら、何もせずに終える', inRepo(t => {
  put(t.seed, 'atesaki-76a805/data/archive.json', '{"items":[1,2]}\n');
  commitAll(t.seed, 'same data');
  git(t.seed, 'push', '-q', 'origin', 'master');
  const same = t.tip();
  put(t.work, 'atesaki-76a805/data/archive.json', '{"items":[1,2]}\n');
  const r = guard(t.work);
  assert.equal(r.status, 0, r.log);
  assert.match(r.output, /pushed=false/);
  assert.equal(t.tip(), same);
}));

test('master が先に進んでいても、取り込みのコミットだけを載せてプッシュする', inRepo(t => {
  put(t.seed, 'README.md', 'someone else\n');
  commitAll(t.seed, 'other');
  git(t.seed, 'push', '-q', 'origin', 'master');
  const other = t.tip();
  put(t.work, 'atesaki-76a805/data/archive.json', '{"items":[1,2]}\n');
  const r = guard(t.work);
  assert.equal(r.status, 0, r.log);
  assert.equal(git(t.remote, 'rev-parse', 'master~1'), other);
  assert.deepEqual(changed(t.remote, other, 'master'), ['atesaki-76a805/data/archive.json']);
}));

test('master にない別の変更のコミットが手元にあれば、プッシュしない', inRepo(t => {
  const before = t.tip();
  put(t.work, 'atesaki-76a805/app/app.js', '// not on master\n');
  commitAll(t.work, 'local change');
  put(t.work, 'atesaki-76a805/data/archive.json', '{"items":[1,2]}\n');
  const r = guard(t.work);
  assert.notEqual(r.status, 0, r.log);
  assert.equal(t.tip(), before, 'プッシュされた');
}));

test('master の最新と data/ の同じところがぶつかったら、プッシュせずに失敗する', inRepo(t => {
  put(t.seed, 'atesaki-76a805/data/archive.json', '{"items":[1,3]}\n');
  commitAll(t.seed, 'other data');
  git(t.seed, 'push', '-q', 'origin', 'master');
  const other = t.tip();
  put(t.work, 'atesaki-76a805/data/archive.json', '{"items":[1,2]}\n');
  const r = guard(t.work);
  assert.notEqual(r.status, 0, r.log);
  assert.equal(t.tip(), other, 'プッシュされた');
}));
