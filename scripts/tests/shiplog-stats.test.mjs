import { test } from 'node:test';
import assert from 'node:assert/strict';
import { median, aggregate, parseRows, render } from '../shiplog-stats.mjs';

test('中央値: 奇数は中央、偶数は中央2値の平均、空は null', () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([]), null);
  assert.equal(median([NaN, 5]), 5);
});

const R = (o) => JSON.stringify({ date: '2026-11-06', tier: 'light', scope: 'x', checks: { machine: 'pass', qa: 'n/a', editor: 'n/a', designer: 'n/a', pm: 'n/a' }, verdict: 'shipped', notes: '', ...o });
const agg = (...rows) => aggregate(parseRows(rows.join('\n') + '\n'));

test('fail と held_for:fix が同じ行にあっても差し戻しは1回', () => {
  const { v2 } = agg(R({ verdict: 'held', held_for: 'fix', checks: { machine: 'pass', qa: 'fail', editor: 'n/a', designer: 'n/a', pm: 'n/a' } }));
  assert.equal(v2['2026-11'].returnedUnits, 1);
  assert.equal(v2['2026-11'].judgedUnits, 1);
});
test('held_for:owner と external、wip は差し戻しに数えない', () => {
  const { v2 } = agg(R({ verdict: 'held', held_for: 'owner' }), R({ verdict: 'held', held_for: 'external' }), R({ verdict: 'wip', notes: 'pm 未実施' }));
  const M = v2['2026-11'];
  assert.equal(M.returnedUnits, 0);
  assert.equal(M.judgedUnits, 2, 'wip は判定に至っていない');
  assert.equal(M.units, 3);
  assert.equal(M.finalHeld, 2);
  assert.equal(M.finalWip, 1);
});
test('ship の名で結んだ wip→held→shipped は1出荷。記録行は3', () => {
  const { v2 } = agg(
    R({ date: '2026-11-05', ship: 'a', verdict: 'wip', notes: 'pm 未実施', checks: { machine: 'pass', qa: 'skipped', editor: 'n/a', designer: 'n/a', pm: 'skipped' } }),
    R({ date: '2026-11-05', ship: 'a', verdict: 'held', held_for: 'fix', checks: { machine: 'pass', qa: 'fail', editor: 'n/a', designer: 'n/a', pm: 'n/a' } }),
    R({ date: '2026-11-06', ship: 'a', verdict: 'shipped', fixes: '2026-10-01', checks: { machine: 'pass', qa: 'pass', editor: 'n/a', designer: 'n/a', pm: 'pass' } }),
  );
  const M = v2['2026-11'];
  assert.equal(M.rows, 3);
  assert.equal(M.units, 1);
  assert.equal(M.finalShipped, 1);
  assert.equal(M.returnedUnits, 1, 'fail と held_for:fix の2行があっても1出荷で1回');
  assert.equal(M.judgedRows, 2, 'wip の行は判定した行に入らない');
  assert.equal(M.failRows, 1);
  assert.equal(M.fixesUnits, 1);
});
test('出荷の月は最後の行の月', () => {
  const { v2 } = agg(R({ date: '2026-11-30', ship: 'b', verdict: 'wip', notes: 'x' }), R({ date: '2026-12-01', ship: 'b', verdict: 'shipped' }));
  assert.equal(v2['2026-11'].units, 0);
  assert.equal(v2['2026-12'].units, 1);
  assert.equal(v2['2026-11'].rows, 1);
});
test('v1 の行は本表に入らず参考値の表に入る', () => {
  const { v2, v1 } = agg('{"date":"2026-10-03","checks":{"qa":"fail","editor":"n/a","designer":"n/a","machine":"pass"},"verdict":"held","notes":"差し戻し"}', R());
  assert.equal(v1['2026-10'].rows, 1);
  assert.equal(v1['2026-10'].failRows, 1);
  assert.equal(v1['2026-10'].returnWords, 1);
  assert.equal(v2['2026-10'], undefined);
  assert.equal(v2['2026-11'].rows, 1);
});
test('所要時間はオフセットを考えた時刻で、記録のある行だけ', () => {
  const { v2 } = agg(R({ started_at: '2026-11-06T10:00:00+09:00', finished_at: '2026-11-06T01:30:00Z' }), R());
  assert.deepEqual(v2['2026-11'].durations, [30]);
  assert.match(render(agg(R()), '2026-11-06'), /記録なし/);
});
test('壊れた行は数えるが率に入れない', () => {
  const { v2 } = agg('{bad', R());
  assert.equal(v2['2026-11'].broken, 0, '日付が読めない壊れた行は v1 側に落ちる');
  const { v1 } = agg('{bad');
  assert.equal(v1['????-??'].broken, 1);
});
