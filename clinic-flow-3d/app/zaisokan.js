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

  /* 人数→区分番号(1〜5)。告示の人数区分(1/2〜9/10〜19/20〜49/50〜)そのまま */
  const bucket = (n) => (n <= 1 ? 1 : n <= 9 ? 2 : n <= 19 ? 3 : n <= 49 ? 4 : 5);

  /* 人数→セルitemId(告示C002の2ロの区分そのまま) */
  ZAISOKAN.cellForCount = function (n) {
    return `r08-C002-2-ro-${bucket(n)}`;
  };

  /* 在医総管の注7加算セル(v52・#26)。tier='jisseki1'(在宅療養実績加算1・ロ)|'jisseki2'(同2・ハ)。
   * 人数区分は在医総管本体と同じ実効人数で揃える(告示注7は本体の各区分に「更に加算」) */
  ZAISOKAN.n7CellFor = function (tier, effCount) {
    const br = tier === 'jisseki1' ? 'ro' : tier === 'jisseki2' ? 'ha' : null;
    return br ? `r08-C002-n7-${br}-${bucket(effCount)}` : null;
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

  /* 訪問診療料(C001の1)のイ/ロ選択(v51・rule-0019)。
   * 同一建物居住者=同一の建物に居住する他の患者に同一日に訪問診療を行う場合の当該患者
   * (告示注1)。判定は「その日に実際に訪問する集合」で行う: 繰越で建物内が1人になった日は
   * イ(留意(4))。sameBuildingSameDayCount=その日に訪問する同一建物内の患者数(当人を含む) */
  ZAISOKAN.visitCellFor = function (sameBuildingSameDayCount) {
    return sameBuildingSameDayCount >= 2 ? 'r08-C001-1-ro' : 'r08-C001-1-i';
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = ZAISOKAN;
  else root.ZAISOKAN = ZAISOKAN;
})(typeof self !== 'undefined' ? self : this);
