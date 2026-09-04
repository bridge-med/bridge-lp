/* 体制加算コア(app/kasan.js)のテスト — roadmap保留#23の固定
 * 実行: node clinic-flow-3d/tests/kasan.test.mjs
 * 点数の期待値はKBパック経由(REIMB.pointsOf)で読む。点数をこのファイルに書かない。 */
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const KB = require(join(ROOT, 'data', 'kb-r08.js'));
const REIMB = require(join(ROOT, 'app', 'reimbursement.js'));
const KASAN_CORE = require(join(ROOT, 'app', 'kasan.js'));

REIMB.init(KB);
// game.jsのkbPtsと同じ振る舞い: KBの点数を優先し、無ければ既定値
const kbPts = (id, fallback) => { const p = REIMB.pointsOf ? REIMB.pointsOf(id) : null; return p != null ? p : fallback; };
const pts = (id) => kbPts(id, NaN);

let n = 0, failed = 0;
function t(name, fn) {
  n++;
  try { fn(); console.log(`  ok ${n} - ${name}`); }
  catch (e) { failed++; console.log(`  NG ${n} - ${name}: ${e.message}`); }
}
function eq(label, a, b) { if (a !== b) throw new Error(`${label}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`); }
function ok(label, v) { if (!v) throw new Error(`${label}: falsy`); }

/* 1. 届出可否(純関数) */
t('明細書発行体制はいつでも整えられる(届出不要)', () => {
  ok('ok.meisai', KASAN_CORE.ok.meisai({}));
});
t('時間外対応体制加算3は未届出(0)からのみ', () => {
  ok('0から可', KASAN_CORE.ok.jikangai3({ kasanJikangai: 0 }));
  ok('1からは不可', !KASAN_CORE.ok.jikangai3({ kasanJikangai: 1 }));
  ok('2からは不可', !KASAN_CORE.ok.jikangai3({ kasanJikangai: 2 }));
});
t('時間外対応体制加算1は加算3届出済み+受付2名以上', () => {
  ok('1+受付2で可', KASAN_CORE.ok.jikangai1({ kasanJikangai: 1, receptionists: 2 }));
  ok('受付1では不可', !KASAN_CORE.ok.jikangai1({ kasanJikangai: 1, receptionists: 1 }));
  ok('未届出からの飛び級は不可', !KASAN_CORE.ok.jikangai1({ kasanJikangai: 0, receptionists: 2 }));
  ok('届出済みの重複は不可', !KASAN_CORE.ok.jikangai1({ kasanJikangai: 2, receptionists: 2 }));
});
t('機能強化加算は在宅部門+在支診(通常型)届出が前提(要件キ相当)', () => {
  ok('在支診ありで可', KASAN_CORE.ok.kyoka({ homecareZaishien: true }));
  ok('無しでは不可', !KASAN_CORE.ok.kyoka({ homecareZaishien: false }));
});
t('連携3は明細書発行体制が前提・重複届出不可', () => {
  ok('明細書ありで可', KASAN_CORE.ok.renkei({ kasanMeisai: true, kasanRenkei: false }));
  ok('明細書なしは不可', !KASAN_CORE.ok.renkei({ kasanMeisai: false, kasanRenkei: false }));
  ok('届出済みの重複は不可', !KASAN_CORE.ok.renkei({ kasanMeisai: true, kasanRenkei: true }));
});

/* 2. 初診の計上行 */
t('初診: 届出なしなら体制加算の行はない', () => {
  eq('行数', KASAN_CORE.firstVisitLines({}, kbPts).length, 0);
});
t('初診: 機能強化加算はKB点数で1行', () => {
  const lines = KASAN_CORE.firstVisitLines({ kasanKyoka: true }, kbPts);
  eq('行数', lines.length, 1);
  eq('kb', lines[0].kb, 'r08-A000-n10');
  eq('点数はKBと一致', lines[0].t, pts('r08-A000-n10'));
});
t('初診: 連携3はKB点数で1行・両方届出なら2行', () => {
  const one = KASAN_CORE.firstVisitLines({ kasanRenkei: true }, kbPts);
  eq('kb', one[0].kb, 'r08-A000-n16-3');
  eq('点数はKBと一致', one[0].t, pts('r08-A000-n16-3'));
  eq('両方で2行', KASAN_CORE.firstVisitLines({ kasanKyoka: true, kasanRenkei: true }, kbPts).length, 2);
});

/* 3. 再診の計上行 — rule-0016の運用担保(明細書×連携の排他)が本丸 */
t('再診: 明細書発行体制のみ→明細書加算1行(KB点数)', () => {
  const lines = KASAN_CORE.revisitLines({ kasanMeisai: true }, kbPts);
  eq('行数', lines.length, 1);
  eq('kb', lines[0].kb, 'r08-A001-n11');
  eq('点数はKBと一致', lines[0].t, pts('r08-A001-n11'));
});
t('再診: 連携3届出後は明細書加算を発行しない(rule-0016の運用担保)', () => {
  const lines = KASAN_CORE.revisitLines({ kasanMeisai: true, kasanRenkei: true }, kbPts);
  ok('明細書加算なし', !lines.some((k) => k.kb === 'r08-A001-n11'));
  eq('連携3は初診側なので再診行もゼロ', lines.length, 0);
});
t('再診: 時間外対応体制は段階に応じて1行(3か1・KB点数)', () => {
  const l3 = KASAN_CORE.revisitLines({ kasanJikangai: 1 }, kbPts);
  eq('kb(加算3)', l3[0].kb, 'r08-A001-n10-3');
  eq('点数はKBと一致', l3[0].t, pts('r08-A001-n10-3'));
  const l1 = KASAN_CORE.revisitLines({ kasanJikangai: 2 }, kbPts);
  eq('kb(加算1)', l1[0].kb, 'r08-A001-n10-1');
  eq('点数はKBと一致', l1[0].t, pts('r08-A001-n10-1'));
  eq('二重計上しない', l3.length, 1);
});
t('再診: 明細書+時間外1の併用は2行(排他は連携とだけ)', () => {
  const lines = KASAN_CORE.revisitLines({ kasanMeisai: true, kasanJikangai: 2 }, kbPts);
  eq('行数', lines.length, 2);
});

/* 4. KB未読込フォールバック: kbPtsの既定値で動く(ゲームを止めない) */
t('フォールバック: KBが無くても既定値で計上できる', () => {
  const fb = (_id, d) => d;
  eq('機能強化=80', KASAN_CORE.firstVisitLines({ kasanKyoka: true }, fb)[0].t, 80);
  eq('明細書=1', KASAN_CORE.revisitLines({ kasanMeisai: true }, fb)[0].t, 1);
});

console.log(`\nkasan.test: ${n - failed} passed / ${failed} failed`);
if (failed) process.exit(1);
