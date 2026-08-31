/* クリニックタウン3D — 体制加算の計上・届出ゲーティング(KASAN core)
 *
 * 役割: 届出型の体制加算(明細書発行体制等・時間外対応体制・機能強化・
 *       電子的診療情報連携)について、
 *       (1) 届出可否の判定(純関数) と (2) 受診1件あたりの計上行 を一元化する。
 * 背景: v48まで計上経路がgame.jsの通常営業とautoDay(委任営業)に複製されており、
 *       片方だけ直す事故の温床だった(roadmap保留#23)。ここに一本化する。
 * 原則:
 *  - 点数はkbPts(KB同期関数)経由で読む。この既定値はKB未読込時のフォールバック
 *  - 明細書発行体制等加算と電子的診療情報連携体制整備加算の排他(A000注16・
 *    A001注19=rule-0016)の運用担保はここが持つ: 連携の届出後は明細書加算を
 *    一律に取り下げる(ゲームは患者ごとの月管理を持たないための安全側)
 *  - UI・3D・ゲーム状態から独立(ブラウザ=window.KASAN_CORE / Node=require両対応)
 */
(function (root) {
  'use strict';

  const KASAN_CORE = {};

  /* 届出可否(純関数)。ctx = { kasanMeisai, kasanRenkei, kasanJikangai,
   *   receptionists, homecareZaishien } — game.js側でsettings/Gから組む */
  KASAN_CORE.ok = {
    // 基準を満たせば届出不要(電子請求+無料発行+掲示)= いつでも整えられる
    meisai: () => true,
    // 時間外対応体制は3→1の二段(下段から)
    jikangai3: (ctx) => ctx.kasanJikangai === 0,
    jikangai1: (ctx) => ctx.kasanJikangai === 1 && ctx.receptionists >= 2,
    // 機能強化加算: 在宅部門+在支診(通常型)の届出=制度の要件キに相当
    kyoka: (ctx) => !!ctx.homecareZaishien,
    // 連携3: 明細書発行体制が前提。届出済みなら重ねて届出しない
    renkei: (ctx) => !!ctx.kasanMeisai && !ctx.kasanRenkei,
  };

  /* 初診1件に付く体制加算の行 [{ n, t, kb }] (v48) */
  KASAN_CORE.firstVisitLines = function (settings, kbPts) {
    const out = [];
    if (settings.kasanKyoka) out.push({ n: '機能強化加算', kb: 'r08-A000-n10', t: kbPts('r08-A000-n10', 80) });
    if (settings.kasanRenkei) out.push({ n: '電子的診療情報連携体制整備加算3', kb: 'r08-A000-n16-3', t: kbPts('r08-A000-n16-3', 4) });
    return out;
  };

  /* 再診1件に付く体制加算の行 [{ n, t, kb }]。
   * 連携の届出後は明細書加算を発行しない(rule-0016の運用担保) */
  KASAN_CORE.revisitLines = function (settings, kbPts) {
    const out = [];
    if (settings.kasanMeisai && !settings.kasanRenkei) out.push({ n: '明細書発行体制等加算', kb: 'r08-A001-n11', t: kbPts('r08-A001-n11', 1) });
    if (settings.kasanJikangai === 2) out.push({ n: '時間外対応体制加算1', kb: 'r08-A001-n10-1', t: kbPts('r08-A001-n10-1', 7) });
    else if (settings.kasanJikangai === 1) out.push({ n: '時間外対応体制加算3', kb: 'r08-A001-n10-3', t: kbPts('r08-A001-n10-3', 4) });
    return out;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = KASAN_CORE;
  else root.KASAN_CORE = KASAN_CORE;
})(typeof self !== 'undefined' ? self : this);
