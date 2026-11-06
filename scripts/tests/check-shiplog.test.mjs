import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkShiplogText, parseTime } from '../check-shiplog.mjs';

const row = (o = {}) => JSON.stringify({ date: '2026-11-06', tier: 'light', scope: 'x', checks: { machine: 'pass', qa: 'n/a', editor: 'n/a', designer: 'n/a', pm: 'n/a' }, verdict: 'shipped', notes: '', ...o });
const msgs = (...rows) => checkShiplogText(rows.join('\n') + '\n').map(v => v.message);

test('v2 の正しい行は違反なし', () => assert.deepEqual(msgs(row()), []));
test('v1 の行(CUTOVER より前)は検査しない', () => assert.deepEqual(msgs('{"date":"2026-10-01","verdict":"ship","checks":{"qa":"合格(sonnet)"}}'), []));
test('壊れた JSON・語彙の外・知らない項目は落ちる', () => {
  assert.match(msgs('{bad')[0], /JSON/);
  assert.ok(msgs(row({ tier: 'heavy' })).some(m => /tier/.test(m)));
  assert.ok(msgs(row({ checks: { machine: 'pass', qa: '合格', editor: 'n/a', designer: 'n/a', pm: 'n/a' } })).some(m => /checks\.qa/.test(m)));
  assert.ok(msgs(row({ extra: 1 })).some(m => /知らない項目 extra/.test(m)));
});
test('held は held_for が要り、held 以外に held_for は付けない', () => {
  assert.ok(msgs(row({ verdict: 'held' })).some(m => /held_for/.test(m)));
  assert.deepEqual(msgs(row({ verdict: 'held', held_for: 'owner' })), []);
  assert.ok(msgs(row({ verdict: 'shipped', held_for: 'owner' })).some(m => /held_for は held/.test(m)));
});
test('wip は notes が要る。ship は空でない文字列', () => {
  assert.ok(msgs(row({ verdict: 'wip' })).some(m => /wip/.test(m)));
  assert.deepEqual(msgs(row({ verdict: 'wip', notes: 'pm 未実施', ship: '2026-11-06-x' })), []);
  assert.ok(msgs(row({ ship: '' })).some(m => /ship/.test(m)));
});
test('時刻: オフセット無しや不正な時刻は落ちる', () => {
  assert.ok(msgs(row({ started_at: '2026-11-06T09:00:00' })).some(m => /started_at/.test(m)));
  assert.ok(msgs(row({ finished_at: '2026-13-40T09:00:00Z' })).some(m => /finished_at/.test(m)));
  assert.ok(msgs(row({ started_at: 'きのう' })).some(m => /started_at/.test(m)));
  assert.ok(Number.isNaN(parseTime('2026-11-06 09:00')));
});
test('時刻: 終了が開始より前なら落ちる(同じオフセット)', () => {
  assert.ok(msgs(row({ started_at: '2026-11-06T10:00:00+09:00', finished_at: '2026-11-06T09:30:00+09:00' })).some(m => /より前/.test(m)));
});
test('時刻: オフセットが違っても時刻として比べる', () => {
  // 10:00+09:00 = 01:00Z。文字列では "01:30Z" < "10:00+09:00" だが、時刻では後。合格でなければならない
  assert.deepEqual(msgs(row({ started_at: '2026-11-06T10:00:00+09:00', finished_at: '2026-11-06T01:30:00Z' })), []);
  // 00:30Z は 09:30+09:00 で、10:00+09:00 より前。落ちなければならない
  assert.ok(msgs(row({ started_at: '2026-11-06T10:00:00+09:00', finished_at: '2026-11-06T00:30:00Z' })).some(m => /より前/.test(m)));
  // 同時刻は合格
  assert.deepEqual(msgs(row({ started_at: '2026-11-06T10:00:00+09:00', finished_at: '2026-11-06T01:00:00Z' })), []);
});
test('行番号は JSONL の物理行', () => {
  const v = checkShiplogText([row(), row({ tier: 'x' })].join('\n') + '\n');
  assert.equal(v[0].line, 2);
});
