/* クリニックタウン3D — 在医総管の単一建物人数セル選択(ZAISOKAN core)
 *
 * 役割: 在宅時医学総合管理料(在支診等・機能強化型以外・月2回以上=C002の2ロ)の
 *       単一建物診療患者数からKBセル(itemId)を選ぶ純関数。
 * 根拠(rule-0018・留意C002(4)(11)):
 *  - 人数=当該建築物に居住する者のうち当該保険医療機関が在医総管・施設総管を
 *    算定する者の人数(特別の関係を含む)
 *  - みなし1人の例外: ①同一患家の同居する同一世帯の複数患者は患者ごとに
 *    「1人の場合」 ②当該建築物で在宅医学管理を行う患者数が建築物の戸数の10%以下
 *    ③戸数20戸未満で在宅医学管理を行う患者2人以下(②③は在医総管のみの限定。
 *    施設総管には掛からない。②③の母数「在宅医学管理を行う患者数」を
 *    単一建物診療患者数と同数とみなして畳み込むのはゲーム上の解釈=rule-0018)
 * 原則:
 *  - 点数はここに持たない(itemIdを返すだけ。点数はKB/エンジンが持つ)
 *  - UI・3D・ゲーム状態から独立(ブラウザ=window.ZAISOKAN / Node=require両対応)
 */
(function (root) {
  'use strict';

  const ZAISOKAN = {};

  /* 人数→セルitemId(告示C002の2ロの区分そのまま) */
  ZAISOKAN.cellForCount = function (n) {
    if (n <= 1) return 'r08-C002-2-ro-1';
    if (n <= 9) return 'r08-C002-2-ro-2';
    if (n <= 19) return 'r08-C002-2-ro-3';
    if (n <= 49) return 'r08-C002-2-ro-4';
    return 'r08-C002-2-ro-5';
  };

  /* みなし1人の例外を畳み込んだ実効人数。
   * opts = { count: 建物内で当月在医総管を算定する患者数,
   *          units: 建築物の戸数(戸建て=1と不明=nullは例外②③を適用しない。
   *                 1戸に例外③を当てると原典より高い1人セルに寄るため安全側で外す),
   *          sameHousehold: 同一患家の同居する同一世帯か(戸建ての家族診療) } */
  ZAISOKAN.effectiveCount = function (opts) {
    const n = opts.count;
    if (opts.sameHousehold) return 1;                       // 例外①: 患者ごとに1人の場合
    const units = opts.units;
    if (units != null && units > 1) {
      if (n <= units * 0.10) return 1;                      // 例外②: 戸数の10%以下
      if (units < 20 && n <= 2) return 1;                   // 例外③: 20戸未満で2人以下
    }
    return n;
  };

  ZAISOKAN.selectCell = function (opts) {
    const eff = ZAISOKAN.effectiveCount(opts);
    return { itemId: ZAISOKAN.cellForCount(eff), effectiveCount: eff, rawCount: opts.count };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = ZAISOKAN;
  else root.ZAISOKAN = ZAISOKAN;
})(typeof self !== 'undefined' ? self : this);
