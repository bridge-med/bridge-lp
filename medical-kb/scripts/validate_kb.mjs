#!/usr/bin/env node
/* ================================================================
   KBの品質チェック(タスク定義13の機械化できる部分)。

   使い方: node medical-kb/scripts/validate_kb.mjs [--rev r08]

   検査内容:
   E1 点数の根拠: points を持つ item は「取得済み(verified)資料への
      evidence」が無ければエラー。推測点数の混入をここで止める
   E2 確度の整合: points を持つのに confidence が verified 以外はエラー
   E3 併算定ルールの根拠: billing_rules は source_document 必須
   E4 リンク整合: item⇔施設基準⇔診療科⇔シナリオのID参照が全て解決するか
   E5 年度混入: effective_from が改定施行日より前のレコードを警告
      (令和6年度情報の誤混入検出の代理指標)
   E6 enum: confidence / relevance / rule_type の値が定義内か
   E7 マスター突合: items.master.json がある場合、code一致の点数が
      itemsの点数と食い違えばエラー(告示転記ミスの検出補助)

   機械化できない検査(留意事項の取りこぼし・解釈の妥当性)は
   docs/update-guide.md の人手レビュー手順に定める。
   結果: data/validation-report.json + 終了コード(0=合格)
   ================================================================ */
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { KB_ROOT, loadJson, saveJson, nowIso } from './lib/util.mjs';

const args = process.argv.slice(2);
const rev = (args.indexOf('--rev') >= 0 ? args[args.indexOf('--rev') + 1] : null) || 'r08';

const kbDir = join(KB_ROOT, 'data', 'kb', rev);
const loadOr = (p, f) => (existsSync(p) ? loadJson(p) : f);

const revMeta = loadOr(join(kbDir, 'revision.json'), {});
const items = loadOr(join(kbDir, 'items.json'), []);
const fss = loadOr(join(kbDir, 'facility_standards.json'), []);
const rules = loadOr(join(kbDir, 'billing_rules.json'), []);
const itemFs = loadOr(join(kbDir, 'item_facility_standard.json'), []);
const itemSp = loadOr(join(kbDir, 'item_specialty.json'), []);
const qa = loadOr(join(kbDir, 'qa_entries.json'), []);
const evidence = loadOr(join(kbDir, 'evidence.json'), []);
const specialties = loadOr(join(KB_ROOT, 'data', 'kb', 'common', 'specialties.json'), []);
const manifest = loadOr(join(KB_ROOT, 'data', 'manifest', `sources.${rev}.json`), { documents: [] });
let master = null;
let kizai = null;
let iyakuhin = null;
try {
  const { ensureExtracted, loadIkaMaster, loadKizaiMaster, loadIyakuhinMaster } = await import('./lib/edt.mjs');
  ensureExtracted(rev);
  master = loadIkaMaster(rev);
  kizai = loadKizaiMaster(rev);
  iyakuhin = loadIyakuhinMaster(rev);
} catch { /* 原典未取得・レイアウト未検証時はE7をスキップ */ }

const errors = [];
const warns = [];

const CONF = new Set(['verified', 'search-located', 'draft', 'unknown']);
const RELEVANCE = new Set(['primary', 'secondary', 'possible']);
const RULE_TYPES = new Set(['mutually_exclusive', 'same_day_ng', 'same_month_ng', 'same_week_ng', 'simultaneous_ng', 'included', 'major_only', 'conditional']);

const docById = new Map(manifest.documents.map(d => [d.id, d]));
const itemIds = new Set(items.map(i => i.id));
const fsIds = new Set(fss.map(f => f.id));
const spIds = new Set(specialties.map(s => s.id));
const evByEntity = new Map();
for (const e of evidence) {
  const k = `${e.entity_type}:${e.entity_id}`;
  if (!evByEntity.has(k)) evByEntity.set(k, []);
  evByEntity.get(k).push(e);
}

/* E1/E2: 点数の根拠と確度 */
for (const it of items) {
  if (it.points != null) {
    const evs = evByEntity.get(`item:${it.id}`) || [];
    const backed = evs.some(e => {
      const d = docById.get(e.document_id);
      return d && d.verified === true;
    });
    if (!backed) errors.push(`E1 ${it.id}: 点数(${it.points})に検証済み一次資料へのevidenceが無い`);
    if (it.confidence !== 'verified') errors.push(`E2 ${it.id}: 点数があるのに confidence=${it.confidence}`);
  }
  if (!CONF.has(it.confidence)) errors.push(`E6 ${it.id}: confidence値が不正 (${it.confidence})`);
  if (revMeta.effective_from && it.effective_from && it.effective_from < revMeta.effective_from) {
    warns.push(`E5 ${it.id}: effective_from(${it.effective_from})が施行日(${revMeta.effective_from})より前。旧年度情報の混入でないか確認`);
  }
}

/* E3: 併算定ルールの根拠 */
for (const r of rules) {
  if (!r.source_document) errors.push(`E3 ${r.id}: source_document が無い(根拠なしの併算定ルールは登録不可)`);
  else if (!docById.has(r.source_document)) errors.push(`E3 ${r.id}: source_document=${r.source_document} がマニフェストに無い`);
  if (!RULE_TYPES.has(r.rule_type)) errors.push(`E6 ${r.id}: rule_type値が不正 (${r.rule_type})`);
}

/* E4: 参照整合 */
for (const l of itemFs) {
  if (!itemIds.has(l.item_id)) errors.push(`E4 item_facility_standard: item_id=${l.item_id} が items に無い`);
  if (!fsIds.has(l.fs_id)) errors.push(`E4 item_facility_standard: fs_id=${l.fs_id} が facility_standards に無い`);
}
for (const l of itemSp) {
  if (!itemIds.has(l.item_id)) errors.push(`E4 item_specialty: item_id=${l.item_id} が items に無い`);
  if (!spIds.has(l.specialty_id)) errors.push(`E4 item_specialty: specialty_id=${l.specialty_id} が specialties に無い`);
  if (!RELEVANCE.has(l.relevance)) errors.push(`E6 item_specialty ${l.item_id}: relevance値が不正 (${l.relevance})`);
}
for (const q of qa) {
  if (q.document_id && !docById.has(q.document_id)) errors.push(`E4 qa ${q.id}: document_id=${q.document_id} がマニフェストに無い`);
}
const scenDir = join(kbDir, 'scenarios');
if (existsSync(scenDir)) {
  const { readdirSync } = await import('node:fs');
  for (const f of readdirSync(scenDir).filter(n => n.endsWith('.json'))) {
    const s = loadJson(join(scenDir, f));
    for (const b of s.billing || []) {
      if (b.status === 'resolved' && b.kind === 'facility_req') {
        // none_required: 一次資料で「施設基準の定めなし」を確認した否定的解決。根拠はreasonに記す
        if (!b.none_required && !fsIds.has(b.fs_id)) errors.push(`E4 scenario ${s.id}: resolved なのに fs_id=${b.fs_id} が facility_standards に無い`);
      } else if (b.status === 'resolved' && !itemIds.has(b.item_id)) {
        errors.push(`E4 scenario ${s.id}: resolved なのに item_id=${b.item_id} が items に無い`);
      }
      if (b.points != null && b.status !== 'resolved') {
        errors.push(`E1 scenario ${s.id}: 未解決の算定候補「${b.label}」に点数が入っている(根拠なし点数の混入)`);
      }
      if (b.points != null && b.status === 'resolved') {
        const it = items.find(x => x.id === b.item_id);
        if (it && it.points != null && Number(it.points) !== Number(b.points)) {
          errors.push(`E1 scenario ${s.id}: 「${b.label}」の点数(${b.points})がitems(${it.points})と不一致`);
        }
      }
    }
  }
}

/* E7: マスター突合(点数識別3=点数の項目のみ数値比較)。
   特定保険医療材料({rev}-t{特定器材コード})は特定器材マスターの材料価格と
   「材料価格を10円で除して得た点数」(J400等)で突合する */
if (master?.rows?.length) {
  const byCode = new Map(master.rows.map(m => [m.code, m]));
  const byKizai = new Map((kizai?.rows || []).map(m => [m.code, m]));
  const byDrug = new Map((iyakuhin?.rows || []).map(m => [m.code, m]));
  for (const it of items) {
    // 薬剤({rev}-y{医薬品コード}[-数量接尾語]): 単価×使用量とG100/L200算式で点数を検算
    const isDrug = /^r\d\d-y\d{9}(-|$)/.test(it.id);
    if (isDrug) {
      const dm = it.code ? byDrug.get(it.code) : null;
      if (!dm) { warns.push(`E7 ${it.id}: code=${it.code} が医薬品マスターに存在しない`); continue; }
      if (it.yakka_yen != null && it.yakka_units != null && dm.price_type === '1') {
        const expectYen = Math.round(Number(dm.price_raw) * Number(it.yakka_units) * 100) / 100;
        if (Math.abs(expectYen - Number(it.yakka_yen)) > 0.005) {
          errors.push(`E7 ${it.id}: 薬価が単価×使用量と不一致 (kb=${it.yakka_yen} / マスター${dm.price_raw}×${it.yakka_units}=${expectYen})`);
        }
        const y = Number(it.yakka_yen);
        // G100: 15円以下=1点 / L200・D500・J300型: 15円以下=算定しない(登録自体が誤り)
        let expectPts = null;
        if (y <= 15) expectPts = it.yakka_formula === 'G100' ? 1 : NaN;
        else expectPts = Math.ceil((y - 15) / 10) + 1;
        if (Number.isNaN(expectPts)) errors.push(`E7 ${it.id}: ${it.yakka_formula}は薬価15円以下を算定しない(登録誤り)`);
        else if (it.points != null && Number(it.points) !== expectPts) {
          errors.push(`E7 ${it.id}: 薬剤点数が算式と不一致 (kb=${it.points} / ${it.yakka_formula}算式=${expectPts}点)`);
        }
      } else if (it.yakka_yen == null || it.yakka_units == null) {
        warns.push(`E7 ${it.id}: yakka_yen/yakka_unitsが未設定のため薬剤点数の検算をスキップ`);
      }
      continue;
    }
    const isMat = /^r\d\d-t\d{9}$/.test(it.id);
    if (isMat) {
      const km = it.code ? byKizai.get(it.code) : null;
      if (!km) { warns.push(`E7 ${it.id}: code=${it.code} が特定器材マスターに存在しない`); continue; }
      if (km.price_type === '1' && Number.isFinite(Number(km.price_raw))) {
        // 材料留意I-1-(2): 材料価格を10円で除し、端数が生じた場合は四捨五入して得た点数
        const expect = Math.round(Number(km.price_raw) / 10);
        if (it.points != null && Number(it.points) !== expect) {
          errors.push(`E7 ${it.id}: 材料点数が材料価格と不一致 (kb=${it.points} / 価格${km.price_raw}円→${expect}点)`);
        }
      } else if (km.price_type !== '1') {
        // 金額種別2(購入価格)・5(%加算)・9(乗算割合)は点数が価格から機械的に決まらないため
        // 突合をスキップする(登録時はevidenceで個別に根拠を示すこと)
        warns.push(`E7 ${it.id}: 金額種別${km.price_type}(${km.price_raw})のため材料価格突合をスキップ`);
      }
      continue;
    }
    if (it.code && it.points != null && byCode.has(it.code)) {
      const m = byCode.get(it.code);
      const mp = Number(m.points_raw);
      if (m.points_kbn === '3' && Number.isFinite(mp) && mp !== Number(it.points)) {
        errors.push(`E7 ${it.id}: 点数がマスターと不一致 (kb=${it.points} / master=${mp})`);
      }
    } else if (it.code && !byCode.has(it.code)) {
      warns.push(`E7 ${it.id}: code=${it.code} が医科診療行為マスターに存在しない`);
    }
  }
}

const report = {
  generated_at: nowIso(),
  revision: rev,
  counts: { items: items.length, facility_standards: fss.length, billing_rules: rules.length, qa_entries: qa.length, evidence: evidence.length },
  errors,
  warns,
};
saveJson(join(KB_ROOT, 'data', 'validation-report.json'), report);

console.log(`--- validate_kb (${rev}) ---`);
console.log(`items:${items.length} fs:${fss.length} rules:${rules.length} qa:${qa.length} evidence:${evidence.length}`);
for (const w of warns) console.log(`警告: ${w}`);
for (const e of errors) console.log(`エラー: ${e}`);
console.log(errors.length === 0 ? '合格' : `不合格 (エラー${errors.length}件)`);
process.exit(errors.length === 0 ? 0 : 1);
