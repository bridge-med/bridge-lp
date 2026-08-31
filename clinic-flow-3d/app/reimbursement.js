/* クリニックタウン3D — 診療報酬エンジン(Reimbursement Engine)
 *
 * 役割: 患者属性×診療行為×施設基準×算定履歴×併算定ルールから、
 *       算定可能項目・算定不可項目・点数・理由・根拠を返す。
 * 原則:
 *  - 点数・名称・条件・根拠はKBゲームパック(data/kb-r08.js)から読む。
 *    このファイルに点数・制度名をハードコードしない
 *  - KBに無い/機械化されていないルールは needs_review としてwarningsへ。
 *    ゲーム都合で制度を補完しない
 *  - UI・3D・ゲーム状態から独立(ブラウザ=window.REIMB / Node=require両対応)
 *
 * 主API:
 *   REIMB.init(kbData)
 *   REIMB.evaluateEncounter({ patient, clinic, specialty, encounter,
 *                             procedures, facilityStandards, history, date })
 *     procedures: [{ itemId, units?, note? }]  itemIdはKBのitems.id
 *     facilityStandards: 適用中(届出済み/充足)の施設基準IDの配列
 *     history: { month: {itemId:回数}, week: {itemId:回数},
 *                monthsSince: {itemId: 最終算定からの月数(当月=0)|null},
 *                firstVisitBilled: 初診料算定済みか(同一初診) }
 *     encounter: { visitType: 'first'|'revisit'|..., conditions: {条件キー:bool} }
 *   戻り値: { billableItems, rejectedItems, totalPoints, totalYen,
 *             warnings, evidence, trace }
 */
(function (root) {
  'use strict';

  const REIMB = { YEN_PER_POINT: 10 };
  let KB = null;
  let byId = new Map();
  let fsById = new Map();

  REIMB.init = function (kb) {
    KB = kb;
    byId = new Map(kb.items.map((i) => [i.id, i]));
    fsById = new Map(kb.facilityStandards.map((f) => [f.id, f]));
    return REIMB;
  };
  REIMB.ready = () => !!KB;
  REIMB.revision = () => (KB ? KB.revision : null);
  REIMB.getItem = (id) => byId.get(id) || null;
  REIMB.getFacilityStandard = (id) => fsById.get(id) || null;
  REIMB.pointsOf = (id) => { const it = byId.get(id); return it && it.points != null ? it.points : null; };
  REIMB.itemsFor = (specialtyId) =>
    KB ? KB.items.filter((i) => (i.specialties || []).some((s) => s.specialty === specialtyId)) : [];
  REIMB.docOf = (docId) => (KB && KB.documents[docId]) || null;

  function evidenceOf(item, field) {
    const evs = item.evidence || [];
    return evs.find((e) => e.field === field) || evs[0] || null;
  }

  /* 1回の受診(encounter)の算定判定 */
  REIMB.evaluateEncounter = function (input) {
    const out = { billableItems: [], rejectedItems: [], totalPoints: 0, totalYen: 0, warnings: [], evidence: [], trace: [] };
    if (!KB) { out.warnings.push({ kind: 'engine', message: 'KB未読込のため判定不能(needs_review)' }); return out; }

    const procedures = input.procedures || [];
    const fsActive = new Set(input.facilityStandards || []);
    const history = input.history || {};
    const monthCount = (id) => (history.month && history.month[id]) || 0;
    const weekCount = (id) => (history.week && history.week[id]) || 0;
    const monthsSince = (id) => (history.monthsSince && history.monthsSince[id] !== undefined ? history.monthsSince[id] : null);
    const conditions = (input.encounter && input.encounter.conditions) || {};
    const trace = (step, detail) => out.trace.push({ step, detail });

    // ---- 前処理: 各手続きの解決とレコード化 ----
    const recs = procedures.map((p, idx) => {
      const item = byId.get(p.itemId);
      return { idx, input: p, item, units: p.units || 1, status: 'candidate', reasons: [], ruleRefs: [] };
    });

    for (const r of recs) {
      if (!r.item) {
        r.status = 'unknown';
        r.reasons.push(`KBに存在しない項目ID: ${r.input.itemId}(needs_review)`);
        out.warnings.push({ kind: 'unknown_item', itemId: r.input.itemId, message: `未知の項目 ${r.input.itemId} — KBに無いため算定判定しない` });
      }
    }
    const known = recs.filter((r) => r.item);
    const has = (id) => known.some((r) => r.input.itemId === id && r.status === 'candidate');

    // ---- 施設基準ゲート ----
    for (const r of known) {
      const need = r.item.facilityStandards || [];
      if (need.length > 0) {
        const ok = need.some((fsId) => fsActive.has(fsId));
        trace('facility', { item: r.item.id, need, ok });
        if (!ok) {
          r.status = 'rejected';
          const fs = fsById.get(need[0]);
          r.reasons.push(`必要施設基準が未適用: ${need.map((i) => (fsById.get(i) || { name: i }).name).join(' / ')}`);
          r.fsInfo = fs || null;
        }
      } else if (r.item.facilityStandardReq === 1) {
        out.warnings.push({ kind: 'needs_review', itemId: r.item.id, message: `${r.item.name}: 施設基準要だがKBにリンク未登録(needs_review)` });
      }
    }

    // ---- 回数・期間制限(構造化済みのもののみ機械判定) ----
    for (const r of known) {
      if (r.status !== 'candidate') continue;
      const lim = r.item.limit;
      if (!lim) {
        if (r.item.countLimitText) out.warnings.push({ kind: 'limit_unstructured', itemId: r.item.id, message: `${r.item.name}: 回数制限「${r.item.countLimitText}」は未機械化 — 表示のみ(needs_review)` });
        continue;
      }
      let used = 0; let label = '';
      if (lim.per === 'month') { used = monthCount(r.item.id); label = '月'; }
      else if (lim.per === 'week') { used = weekCount(r.item.id); label = '週'; }
      else if (lim.per === 'day') { used = 0; label = '日'; } // 同日内はunitsで判定
      else if (lim.per === 'visit_first') { used = history.firstVisitBilled ? 1 : 0; label = '同一初診'; }
      const adding = lim.unit === '単位' ? r.units : 1;
      trace('limit', { item: r.item.id, per: lim.per, max: lim.max, used, adding });
      if (lim.unit === '単位' && r.units > lim.max) {
        r.units = lim.max;
        r.capped = true;
        out.warnings.push({ kind: 'limit_capped', itemId: r.item.id, message: `${r.item.name}: 上限${lim.max}${lim.unit}/${label}に切り詰め` });
      } else if (lim.unit !== '単位' && used + adding > lim.max) {
        r.status = 'rejected';
        r.reasons.push(`算定回数制限: ${label}${lim.max}回まで(算定済み${used}回)。根拠: ${r.item.countLimitText || r.item.conditions || ''}`);
      }
    }

    // ---- 併算定ルール(machineヒントがあるもののみ機械判定) ----
    const findRec = (id) => known.find((r) => r.input.itemId === id && r.status === 'candidate');
    const inCat = (r, cats) => cats.some((c) => (r.item.categoryM || '').indexOf(c.replace(/\(.*\)$/, '')) === 0 || (r.item.categoryM || '') === c);

    for (const rule of KB.rules) {
      const m = rule.machine;
      const sources = m ? (Array.isArray(m.source) ? m.source : [m.source]) : [];
      if (!m) {
        // 機械化されていないルール: 該当項目が絡むときだけ注意喚起
        const src = findRec(rule.source);
        if (src) out.warnings.push({ kind: 'rule_unmachined', ruleId: rule.id, message: `${src.item.name}: ルール「${rule.condition || rule.type}」は未機械化 — 内容を確認(needs_review)`, quote: rule.quote });
        continue;
      }
      if (m.type === 'handled_externally') {
        // 受診単位の機械判定が不要なルール(患者単位の排他=名簿分離で運用、相手行為が同一受診内で
        // 併発しない設計等)。理由はKBのmachine.noteに記録済み。警告は出さない
        continue;
      }
      if (m.type === 'same_day_ng_categories') {
        const src = findRec(m.source);
        if (!src) continue;
        const blockers = known.filter((r) => r !== src && r.status === 'candidate' && inCat(r, m.targetCategories));
        // 「厚生労働大臣が定める検査」の別表該当項目(留意A001(7)キ・機械リスト化済み)も却下対象
        const kensaHits = (m.sadamaruKensaItems || []).length
          ? known.filter((r) => r !== src && r.status === 'candidate' && m.sadamaruKensaItems.includes(r.item.id))
          : [];
        // performedCategories: KB未登録の行為(ゲーム側の簡略化項目)でも実施カテゴリを申告できる
        const perfCats = (input.encounter && input.encounter.performedCategories) || [];
        const perfHit = perfCats.filter((c) => m.targetCategories.some((t) => t.indexOf(c) === 0 || c.indexOf(t) === 0));
        trace('rule', { rule: rule.id, blockers: blockers.map((b) => b.item.id), kensa: kensaHits.map((b) => b.item.id), perfHit });
        if (blockers.length || kensaHits.length || perfHit.length) {
          src.status = 'rejected';
          const names = blockers.concat(kensaHits).map((b) => b.item.name).concat(perfHit);
          src.reasons.push(`同日に${names.join('・')}を実施しているため算定不可(${rule.id})`);
          src.ruleRefs.push(rule);
        } else if (m.reviewCategories) {
          // 別表の機械リストに無い同カテゴリ項目だけは判定せず注意喚起(将来の新規登録の安全網)。
          // clearedKensaItems=別表外と一次資料で確認済みの項目(検体検査等)は安全網からも除外
          const listed = new Set(m.sadamaruKensaItems || []);
          const cleared = new Set(m.clearedKensaItems || []);
          const revHits = known.filter((r) => r !== src && r.status === 'candidate' && inCat(r, m.reviewCategories) && !listed.has(r.item.id) && !cleared.has(r.item.id));
          if (revHits.length) {
            out.warnings.push({ kind: 'needs_review', ruleId: rule.id, itemId: src.item.id,
              message: `${src.item.name}: 同日の${revHits.map((x) => x.item.name).join('・')}が「厚生労働大臣が定める検査」に該当する場合は算定不可 — 別表リスト未分類のため要確認(needs_review)` });
          }
        }
      } else if (m.type === 'same_day_ng_items') {
        const src = findRec(m.source);
        if (!src) continue;
        for (const tid of m.targetItemIds) {
          const t = findRec(tid);
          if (t) { t.status = 'rejected'; t.reasons.push(`${src.item.name}の算定日は算定不可(${rule.id})`); t.ruleRefs.push(rule); }
        }
      } else if (m.type === 'included_categories') {
        const src = sources.map(findRec).find(Boolean);
        if (!src) continue;
        for (const r of known) {
          if (r === src || r.status !== 'candidate') continue;
          const hitCat = m.targetCategories && inCat(r, m.targetCategories);
          const hitId = m.targetItemIds && m.targetItemIds.includes(r.input.itemId);
          if (hitCat || hitId) {
            r.status = 'rejected';
            r.reasons.push(`${src.item.name}に包括されるため算定不可(${rule.id})`);
            r.ruleRefs.push(rule);
          }
        }
      } else if (m.type === 'excl_window_months') {
        const activeSrc = sources.map((id) => ({ id, ms: monthsSince(id) })).find((x) => x.ms !== null && x.ms >= 0 && x.ms < m.months);
        if (!activeSrc) continue;
        for (const tid of m.targetItemIds) {
          const t = findRec(tid);
          if (t) { t.status = 'rejected'; t.reasons.push(`${(byId.get(activeSrc.id) || {}).name}の算定月から${m.months}月以内のため算定不可(${rule.id})`); t.ruleRefs.push(rule); }
        }
      } else if (m.type === 'conditional_pair') {
        const a = findRec(m.a); const b = findRec(m.b);
        if (a && b) {
          if (conditions[m.conditionKey]) {
            out.warnings.push({ kind: 'conditional_ok', ruleId: rule.id, message: `${a.item.name}と${b.item.name}の併算定: 条件「${m.conditionLabel}」を満たすため可(${rule.id})` });
          } else {
            b.status = 'rejected';
            b.reasons.push(`${a.item.name}との併算定は「${m.conditionLabel}」の場合のみ(${rule.id})`);
            b.ruleRefs.push(rule);
          }
        }
      } else if (m.type === 'same_month_group') {
        // グループ内のどれかを同月に算定済みなら、グループの別項目も算定不可
        // (例: 在医総管の人数セル横断の患者ごと月1回=rule-0020・保留#27)
        for (const gid of m.group) {
          const t = findRec(gid);
          if (!t) continue;
          const priorId = m.group.find((x) => x !== gid && monthCount(x) > 0);
          if (priorId) {
            t.status = 'rejected';
            t.reasons.push(`同一月に${(byId.get(priorId) || {}).name || priorId}を算定済みのため算定不可 — グループで月1回(${rule.id})`);
            t.ruleRefs.push(rule);
          }
        }
      } else if (m.type === 'condition_ng_item') {
        // 条件が真のとき算定不可(例: B009×特別の関係にある機関への紹介)
        const src = findRec(m.source);
        if (src && src.status === 'candidate' && conditions[m.conditionKey]) {
          src.status = 'rejected';
          src.reasons.push(`${m.conditionLabel}のため算定不可(${rule.id})`);
          src.ruleRefs.push(rule);
        }
      }
    }

    // ---- 集計 ----
    for (const r of recs) {
      const base = r.item ? {
        itemId: r.item.id, name: r.item.name, kubun: r.item.kubun, unit: r.item.unit,
        points: r.item.points, units: r.units,
        subtotal: r.item.points != null ? r.item.points * r.units : null,
        confidence: r.item.confidence,
        evidence: r.item ? evidenceOf(r.item, 'points') : null,
        facilityStandards: r.item.facilityStandards,
      } : { itemId: r.input.itemId, name: r.input.itemId, points: null, units: r.units, subtotal: null };

      if (r.status === 'candidate' && r.item && r.item.points != null) {
        out.billableItems.push(base);
        out.totalPoints += base.subtotal;
      } else if (r.status === 'candidate') {
        out.warnings.push({ kind: 'no_points', itemId: r.input.itemId, message: `${base.name}: KBに点数なし(未登録) — 算定額に含めない` });
      } else {
        out.rejectedItems.push(Object.assign(base, {
          reasons: r.reasons,
          rules: r.ruleRefs.map((x) => ({ id: x.id, quote: x.quote, doc: x.doc, page: x.page })),
          fsInfo: r.fsInfo ? { id: r.fsInfo.id, name: r.fsInfo.name, staffing: r.fsInfo.staffing, equipment: r.fsInfo.equipment, formNo: r.fsInfo.formNo } : null,
          status: r.status,
        }));
      }
    }
    out.totalYen = out.totalPoints * REIMB.YEN_PER_POINT;
    out.evidence = out.billableItems.concat(out.rejectedItems)
      .filter((x) => x.evidence)
      .map((x) => ({ itemId: x.itemId, doc: x.evidence.doc, page: x.evidence.page, quote: x.evidence.quote }));
    return out;
  };

  /* 施設基準を適用した場合の推定月間増収(simulation estimate)
     usage: [{itemId, monthlyCount, units?}] 現在の診療パターン(実績ベース) */
  REIMB.estimateFacilityStandardUplift = function (fsId, currentItems, usage) {
    if (!KB) return null;
    let delta = 0; const detail = [];
    for (const u of usage || []) {
      const item = byId.get(u.itemId);
      if (!item || item.points == null) continue;
      if (!(item.facilityStandards || []).includes(fsId)) continue;
      const cur = (currentItems || []).map((id) => byId.get(id)).find((i) => i && i.points != null);
      const curPts = cur ? cur.points : 0;
      const d = (item.points - curPts) * (u.units || 1) * (u.monthlyCount || 0);
      delta += d;
      detail.push({ from: cur ? cur.id : null, to: item.id, perUnitDelta: item.points - curPts, monthlyCount: u.monthlyCount, delta: d });
    }
    return { fsId, estMonthlyPointsDelta: delta, estMonthlyYenDelta: delta * REIMB.YEN_PER_POINT, detail, note: 'simulation estimate — 現在の診療パターンに基づく試算であり制度上の確定収益ではない' };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = REIMB;
  else root.REIMB = REIMB;
})(typeof self !== 'undefined' ? self : this);
