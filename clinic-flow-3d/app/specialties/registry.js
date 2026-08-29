/* クリニックタウン3D — 診療科モジュールレジストリ
 * 診療科固有ロジック(患者像・診療フロー・設備・人員・行為→KB項目の対応・経営パラメータ)を
 * モジュールとして登録する。ゲーム本体は SPECIALTIES 経由でのみ診療科差分に触れる。
 *
 * モジュール規約(specialty-module.md参照):
 *   id/name/status('full'|'basic')/patientProfiles/workflows/equipment/staffing/
 *   procedures/reimbursementMappings/managementParameters
 * reimbursementMappings の値は KBゲームパックの items.id のみ(制度情報をここに書かない)。
 * managementParameters は「ゲーム上の仮定」(人件費・需要・確率等)であり制度情報と分離する。 */
(function (root) {
  'use strict';
  const SPECIALTIES = {
    _mods: {},
    register(mod) { this._mods[mod.id] = mod; },
    get(id) { return this._mods[id] || null; },
    list() { return Object.values(this._mods); },
    playable() { return this.list().filter((m) => m.status === 'full' || m.status === 'basic'); },
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = SPECIALTIES;
  else root.SPECIALTIES = SPECIALTIES;
})(typeof self !== 'undefined' ? self : this);
