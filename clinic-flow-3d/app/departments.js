/* クリニックタウン3D — 診療科部門エンジン(Layer 2.5: 患者パネル型日次シム)
 *
 * 役割: 内科・眼科・透析・在宅などの「部門」を、慢性患者の名簿(パネル)を持つ
 *       日次シミュレーションとして回す共通基盤。
 * 原則:
 *  - 収益は全て REIMB.evaluateEncounter 経由。このファイルと各診療科モジュールに
 *    点数・制度名をハードコードしない(表示名・点数・根拠はKBから)
 *  - 患者ごとに算定履歴(月/週回数・最終算定月・初診済み)を持ち、
 *    月1回制限・週3回制限・6月排他などが患者単位で本物どおり効く
 *  - 経営上の仮定(需要・費用・確率)は各モジュールの managementParameters に
 *    分離して明示する(制度上の事実と混ぜない)
 *  - UI・DOM・ゲーム大域に依存しない(Node/ブラウザ両対応。テスト可能)
 *
 * 患者レコード(セーブ対象・短縮キー):
 *   { id, pr: プロファイルid, en: 登録日, nv: 次回来訪日, sv: 重症度0-2,
 *     mc: {itemId:月内算定回数}, wc: {itemId:週内算定回数},
 *     lb: {itemId:最終算定月(6月窓の追跡対象のみ)}, fb: 初診料算定済みか }
 */
(function (root) {
  'use strict';

  const DEPT = {};
  let REIMB_ = null;
  let trackMonthly = new Set();   // 月n回制限を持つ項目(mcで追跡)
  let trackWeekly = new Set();    // 週n回制限を持つ項目(wcで追跡)
  let trackMsSince = new Set();   // 排他窓(excl_window_months)の起点項目(lbで追跡)

  /* KBパックから「どの項目の履歴を患者に持たせるか」を導出する。
     項目を列挙で書かない(KBの構造から機械的に決める)。 */
  DEPT.init = function (reimb, kb) {
    REIMB_ = reimb;
    trackMonthly = new Set(); trackWeekly = new Set(); trackMsSince = new Set();
    for (const it of kb.items) {
      if (!it.limit) continue;
      if (it.limit.per === 'month' && it.limit.unit !== '単位') trackMonthly.add(it.id);
      if (it.limit.per === 'week') trackWeekly.add(it.id);
    }
    for (const r of kb.rules) {
      if (r.machine && r.machine.type === 'excl_window_months') {
        const src = Array.isArray(r.machine.source) ? r.machine.source : [r.machine.source];
        src.forEach((id) => trackMsSince.add(id));
      }
    }
    return DEPT;
  };
  DEPT.ready = () => !!REIMB_;

  /* 30日=1月・7日=1週(ゲーム内暦。整形本院の月次と同じ区切り) */
  DEPT.monthIdx = (day) => Math.floor((day - 1) / 30);
  DEPT.weekIdx = (day) => Math.floor((day - 1) / 7);

  DEPT.create = function (mod, day) {
    const d = {
      id: mod.id, openedDay: day,
      staff: Object.assign({}, (mod.deptDefaults && mod.deptDefaults.staff) || {}),
      equip: Object.assign({}, (mod.deptDefaults && mod.deptDefaults.equip) || {}),
      policy: Object.assign({}, (mod.deptDefaults && mod.deptDefaults.policy) || {}),
      fs: [],                 // 届出済み(適用中)の施設基準ID
      pt: [],                 // 患者パネル
      seq: 0,
      mi: DEPT.monthIdx(day), wi: DEPT.weekIdx(day),
      last: null, profit7: [],
    };
    if (mod.deptInit) mod.deptInit(d, day);
    return d;
  };

  DEPT.addPatient = function (dept, profileId, day, extra) {
    dept.seq++;
    const p = Object.assign({
      id: dept.id.slice(0, 2) + dept.seq, pr: profileId, en: day, nv: day,
      sv: 0, mc: {}, wc: {}, lb: {}, fb: false,
    }, extra || {});
    dept.pt.push(p);
    return p;
  };

  function rollover(dept, day) {
    const mi = DEPT.monthIdx(day), wi = DEPT.weekIdx(day);
    if (mi !== dept.mi) { for (const p of dept.pt) p.mc = {}; dept.mi = mi; }
    if (wi !== dept.wi) { for (const p of dept.pt) p.wc = {}; dept.wi = wi; }
  }

  function msMap(p, curMonth) {
    const m = {};
    for (const id of Object.keys(p.lb)) m[id] = curMonth - p.lb[id];
    return m;
  }

  /* 1回の受診/セッションをエンジンで算定し、患者の履歴を進める。
     report: { type, kbActs: [{id, units?}], conditions?, performedCategories? }
     戻り値: { ev(エンジン出力), lines(レセプト行: KB行のみ) } */
  DEPT.evalVisit = function (mod, dept, p, report, day) {
    const curMonth = DEPT.monthIdx(day);
    const ev = REIMB_.evaluateEncounter({
      patient: { profile: p.pr, severity: p.sv },
      specialty: mod.id,
      encounter: {
        visitType: report.type,
        conditions: report.conditions || {},
        performedCategories: report.performedCategories || [],
      },
      procedures: mod.buildProcedures(report),
      // 一般名処方加算の施設基準(掲示+ウェブ掲載)は届出不要(0305-8 第36の4)。
      // 一般名処方をONにしている部門は掲示等を整えている扱い(ゲーム上の仮定)
      facilityStandards: (dept.fs || []).concat(dept.policy && dept.policy.ippanmei ? ['r08-fs-f400-n6'] : []),
      history: { month: p.mc, week: p.wc, monthsSince: msMap(p, curMonth), firstVisitBilled: !!p.fb },
    });
    const lines = [];
    for (const b of ev.billableItems) {
      if (trackMonthly.has(b.itemId)) p.mc[b.itemId] = (p.mc[b.itemId] || 0) + 1;
      if (trackWeekly.has(b.itemId)) p.wc[b.itemId] = (p.wc[b.itemId] || 0) + 1;
      if (trackMsSince.has(b.itemId)) p.lb[b.itemId] = curMonth;
      if (b.itemId === 'r08-A000') p.fb = true;
      lines.push(b.units > 1
        ? { n: `${b.name} ${b.points}点×${b.units}`, t: b.subtotal, kb: b.itemId }
        : { n: b.name, t: b.subtotal, kb: b.itemId });
    }
    return { ev, lines };
  };

  /* 施設基準: モジュールの fsDefs([{fsId, check(dept)->{ok, missing[]}, note}])を評価。
     届出済みでも要件を割れば適用から外れる(要件割れは events に積む)。 */
  DEPT.fsStatus = function (mod, dept) {
    const out = [];
    for (const def of (mod.fsDefs || [])) {
      const chk = def.check(dept);
      const notified = dept.fs.includes(def.fsId);
      out.push({ fsId: def.fsId, ok: chk.ok, missing: chk.missing || [], notified, note: def.note || null });
    }
    return out;
  };
  DEPT.fsEnforce = function (mod, dept) {
    const broken = [];
    for (const st of DEPT.fsStatus(mod, dept)) {
      if (st.notified && !st.ok) {
        dept.fs = dept.fs.filter((id) => id !== st.fsId);
        broken.push(st);
      }
    }
    return broken;
  };

  /* 日次実行。ctx: { day, spec, rep, aw, rand } (randは0-1乱数関数。テストでは固定可)
     モジュールの runDay が診療内容を決め、共通側で集計・要件割れ・履歴を処理する。 */
  DEPT.runDay = function (mod, dept, ctx) {
    rollover(dept, ctx.day);
    const broken = DEPT.fsEnforce(mod, dept);
    const agg = {
      day: ctx.day, revenue: 0, cost: 0, profit: 0, visits: 0, points: 0,
      byItem: {}, approx: [], sample: null, warnings: [], events: [],
      info: {},
    };
    for (const b of broken) {
      const fs = REIMB_.getFacilityStandard(b.fsId);
      agg.events.push({ kind: 'fs_broken', fsId: b.fsId, message: `${fs ? fs.name : b.fsId}: 要件割れのため適用から外れました(${b.missing.join('・')})` });
    }
    const api = {
      evalVisit: (p, report) => {
        const r = DEPT.evalVisit(mod, dept, p, report, ctx.day);
        agg.points += r.ev.totalPoints;
        agg.revenue += r.ev.totalYen;
        for (const b of r.ev.billableItems) {
          const e = agg.byItem[b.itemId] || (agg.byItem[b.itemId] = { n: 0, name: b.name, pts: 0 });
          e.n += 1; e.pts += b.subtotal;
        }
        for (const w of r.ev.warnings) {
          const key = w.kind + ':' + (w.itemId || w.ruleId || '');
          if (!agg.warnings.some((x) => x._k === key) && agg.warnings.length < 8) agg.warnings.push({ _k: key, kind: w.kind, message: w.message });
        }
        return r;
      },
      /* KB未登録の行為の概算計上(明示ラベル付き。点数tは概算) */
      approx: (label, t) => {
        agg.revenue += t * 10;
        const e = agg.approx.find((x) => x.n === label);
        if (e) { e.count++; e.yen += t * 10; } else agg.approx.push({ n: label, count: 1, yen: t * 10, t });
        return { n: `${label}(概算)`, t };
      },
      addPatient: (profileId, extra) => DEPT.addPatient(dept, profileId, ctx.day, extra),
      /* 代表レセプト: priorityが高いもの(例: 月次管理料の来院)を優先して1件保持 */
      setSample: (label, lines, evOut, priority) => {
        const pr = priority || 1;
        if (!agg.sample || (agg.sample.pr || 1) < pr) {
          agg.sample = { pr, label, lines, kb: evOut ? { rejected: evOut.rejectedItems, warnings: evOut.warnings } : null };
        }
      },
      countVisit: () => { agg.visits++; },
      frac: (x) => { const n = Math.floor(x); return n + (ctx.rand() < (x - n) ? 1 : 0); },
      month: DEPT.monthIdx(ctx.day),
    };
    mod.runDay(dept, ctx, api, agg);
    // 休診日など会計が無い日は、直近の代表レセプトを持ち越す(「まだ会計がありません」にしない)
    if (!agg.sample && dept.last && dept.last.sample) agg.sample = dept.last.sample;
    agg.cost = Math.round(agg.cost);
    agg.revenue = Math.round(agg.revenue);
    agg.profit = agg.revenue - agg.cost;
    for (const w of agg.warnings) delete w._k;
    dept.last = agg;
    dept.profit7.push(agg.profit);
    if (dept.profit7.length > 7) dept.profit7.shift();
    return agg;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = DEPT;
  else root.DEPT = DEPT;
})(typeof self !== 'undefined' ? self : this);
