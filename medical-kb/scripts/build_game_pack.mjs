#!/usr/bin/env node
/* ================================================================
   KBゲームパック生成: data/kb/{rev}/*.json → clinic-flow-3d/data/kb-{rev}.js

   使い方: node medical-kb/scripts/build_game_pack.mjs [--rev r08]

   - Clinic Town 3D(静的サイト・ビルドなし)が<script>タグで読める形の
     JSファイルを生成する(window.KB_R08 / module.exports 両対応)
   - 点数・名称・条件・施設基準・併算定ルール・根拠は全てKBから転記する。
     このスクリプトに点数を書かないこと(検証: 生成物に手書き数値なし)
   - machine_hints: 文章ルール(billing_rules)のうちエンジンで機械判定する
     ものへの変換表。ルールIDに紐づけ、内容の根拠はKBの原文(quote)にある。
     ここにない/変換できないルールはエンジンが needs_review として扱う
   - 構造化上限(limits)は items.count_limit の文言から機械化できるものだけを
     変換する(曖昧なものは入れない=エンジンは判定せずwarningを出す)
   ================================================================ */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { KB_ROOT, loadJson, nowIso } from './lib/util.mjs';

const args = process.argv.slice(2);
const rev = (args.indexOf('--rev') >= 0 ? args[args.indexOf('--rev') + 1] : null) || 'r08';

const kb = p => loadJson(join(KB_ROOT, 'data', 'kb', rev, p));
const revision = kb('revision.json');
const items = kb('items.json');
const rules = kb('billing_rules.json');
const fss = kb('facility_standards.json');
const itemFs = kb('item_facility_standard.json');
const itemSp = kb('item_specialty.json');
const evidence = kb('evidence.json');
const specialties = loadJson(join(KB_ROOT, 'data', 'kb', 'common', 'specialties.json'));
const manifest = loadJson(join(KB_ROOT, 'data', 'manifest', `sources.${rev}.json`));

/* ---- 構造化上限: count_limit文言 → {per, max, unit} ----
   変換はitem idごとに明示する(文言の根拠は各itemのevidence)。
   ここに無いitemのcount_limitはエンジンでは判定しない(表示のみ)。 */
const LIMITS = {
  'r08-A000':        { per: 'visit_first', max: 1 },            // 初診時1回(算定回数テーブル)
  'r08-B001-3-1-lipid': { per: 'month', max: 1 },               // 月1回(告示注1)
  'r08-B001-3-1-ht': { per: 'month', max: 1 },
  'r08-B001-3-1-dm': { per: 'month', max: 1 },
  'r08-B001-3-3':    { per: 'month', max: 1 },
  'r08-B001-15':     { per: 'month', max: 1 },                  // 月1回(告示注1)
  'r08-C002-2-ro-1': { per: 'month', max: 1 },                  // 月1回(告示)
  'r08-C007':        { per: 'month', max: 1 },
  'r08-F400-n4':     { per: 'month', max: 1 },                  // 月1回(告示F400注4)
  'r08-H002-1':      { per: 'day', max: 6, unit: '単位' },       // 1日6単位(算定回数テーブル)
  'r08-H002-2':      { per: 'day', max: 6, unit: '単位' },
  'r08-H002-3':      { per: 'day', max: 6, unit: '単位' },
  'r08-J038-1-ro':   { per: 'month', max: 14 },                 // 月14回(告示J038注8)
  'r08-C001-1-i':    { per: 'week', max: 3 },                   // 週3回(告示C001注1)
  'r08-I002-1-ro-1-1': { per: 'visit_first', max: 1 },          // 初診時1回(算定回数テーブル)
  'r08-I002-1-ro-2': { per: 'visit_first', max: 1 },
  'r08-I002-1-ha-1-1': { per: 'week', max: 1 },                 // 1・2合わせて週1回(告示I002注1。退院4週の週2特例は安全側で未使用)
  'r08-I002-1-ha-2-1': { per: 'week', max: 1 },
  'r08-I004-2-i':    { per: 'visit_first', max: 1 },            // 初診時1回(算定回数テーブル)
  'r08-I004-2-ro':   { per: 'week', max: 1 },                   // 週1回(告示I004注4。初診4週の週2特例は安全側で未使用)
  'r08-L104':        { per: 'day', max: 1 },                    // 1日1回(算定回数テーブル: 日・上限1)
  'r08-J119-2':      { per: 'day', max: 1 },                    // 1日につき(算定回数テーブル: 日・上限1)
  'r08-H003-2-1-i':  { per: 'month', max: 1 },                  // 月1回(告示H003-2注1・算定回数テーブル)
  'r08-H003-2-1-ro': { per: 'month', max: 1 },
};

/* ---- 機械判定ヒント: 文章ルール → エンジン述語 ----
   type: same_day_ng_categories = sourceItemは、targetCategoriesの行為と同日に算定不可
         same_day_ng_items      = sourceItemの算定日はtargetItemIdsを算定不可(方向はdirection)
         included_categories    = sourceItemを算定する患者では、targetCategoriesの行為が包括(算定不可)
         excl_window_months     = sourceItemの算定月から起算してN月以内はtargetItemIds算定不可
   ここに変換の無いルール(conditional等)はエンジンがwarning(needs_review)を返す。 */
const MACHINE_HINTS = {
  'r08-rule-0001': { type: 'same_day_ng_categories', source: 'r08-A001-n8',
    targetCategories: ['リハビリテーション', '処置', '手術', '麻酔', '放射線治療', '精神科専門療法'],
    // 「別に厚生労働大臣が定める検査」は別表がKB未登録のため機械判定しない(needs_review警告のみ)
    reviewCategories: ['検査'] },
  'r08-rule-0002': { type: 'included_categories', source: ['r08-B001-3-1-lipid', 'r08-B001-3-1-ht', 'r08-B001-3-1-dm'],
    targetCategories: ['検査', '注射', '病理診断'], targetItemIds: ['r08-A001-n8'] },
  'r08-rule-0004': { type: 'excl_window_months', source: ['r08-B001-3-1-lipid', 'r08-B001-3-1-ht', 'r08-B001-3-1-dm'],
    months: 6, targetItemIds: ['r08-B001-3-3'] },
  'r08-rule-0005': { type: 'conditional_pair', a: 'r08-D261-2', b: 'r08-D263-1',
    conditionKey: 'refraction_first_or_glasses', conditionLabel: '屈折異常の疑いで初めての検査、又は眼鏡処方箋の交付' },
  'r08-rule-0006': { type: 'included_categories', source: 'r08-J038-1-ro', targetCategories: ['薬剤(透析包括)'] },
  'r08-rule-0007': { type: 'included_categories', source: 'r08-B001-15', targetCategories: ['検査(透析包括)'] },
  'r08-rule-0008': { type: 'same_day_ng_items', source: 'r08-C001-1-i',
    targetItemIds: ['r08-A001', 'r08-A002', 'r08-C000'], direction: 'source_blocks_targets' },
};

/* 表示用クリーニング:
   - conditions等からKB内部の作業メモ「(…未登録…)」「(コード…)」を除去(ゲーム画面に内部メモを出さない)
   - 引用(quote)はNFKC正規化(PDF由来の全角英数を読める形に。内容は変えない) */
const cleanText = (s) => s ? s
  .replace(/[（(][^（()）]*未登録[^（()）]*[）)]/g, '')
  .replace(/\s{2,}/g, ' ').replace(/。\s*。/g, '。').trim() : s;
const normQuote = (s) => (s ? s.normalize('NFKC') : s);

const evByEntity = {};
for (const e of evidence) {
  const k = e.entity_id;
  (evByEntity[k] = evByEntity[k] || []).push({ field: e.field, doc: e.document_id, page: e.page, quote: normQuote(e.quote), note: e.note });
}
const docTitles = {};
for (const d of manifest.documents) docTitles[d.id] = { title: d.title, url: d.urls?.[0]?.url || null, number: d.doc_number || null };

const fsLinks = {};
for (const l of itemFs) (fsLinks[l.item_id] = fsLinks[l.item_id] || []).push(l.fs_id);
const spLinks = {};
for (const l of itemSp) (spLinks[l.item_id] = spLinks[l.item_id] || []).push({ specialty: l.specialty_id, relevance: l.relevance });

const pack = {
  generated_at: nowIso(),
  generator: 'medical-kb/scripts/build_game_pack.mjs',
  note: '生成物。手で編集しない。点数・条件・根拠は medical-kb/data/kb の正規データ由来',
  revision,
  documents: docTitles,
  specialties,
  items: items.map(it => ({
    id: it.id, code: it.code, kubun: it.kubun_no, name: it.name, shortName: it.short_name,
    categoryL: it.category_l, categoryM: it.category_m,
    points: it.points, unit: it.unit,
    conditions: cleanText(it.conditions) || null, exclusions: cleanText(it.exclusions) || null,
    countLimitText: it.count_limit || null, periodLimitText: it.period_limit || null,
    limit: LIMITS[it.id] || null,
    inpatient: it.inpatient ?? null, outpatient: it.outpatient ?? null,
    visitType: it.visit_type || null,
    facilityStandardReq: it.facility_standard_req ?? null,
    notificationReq: it.notification_req ?? null,
    facilityStandards: fsLinks[it.id] || [],
    specialties: spLinks[it.id] || [],
    confidence: it.confidence,
    evidence: evByEntity[it.id] || [],
  })),
  facilityStandards: fss.map(f => ({
    id: f.id, name: f.name, shortName: f.short_name, ryoType: f.ryo_type,
    notificationReq: f.notification_req ?? null,
    staffing: f.staffing_req || null, equipment: f.equipment_req || null,
    record: f.record_req || null, system: f.system_req || null,
    transitional: f.transitional || null, formNo: f.form_no || null,
    sourceNotice: f.source_notice || null, sourcePage: f.source_page || null,
    confidence: f.confidence,
    evidence: evByEntity[f.id] || [],
  })),
  rules: rules.map(r => ({
    id: r.id, source: r.source_item, target: r.target_item, type: r.rule_type,
    condition: r.condition || null, period: r.period || null,
    bidirectional: r.bidirectional ?? 1,
    doc: r.source_document, page: r.source_page || null, quote: normQuote(r.quote) || null,
    confidence: r.confidence,
    // billing_rules.json側のmachine(handled_externally・定める検査リスト等)をヒント表にマージ。
    // 同キーはJSON側が優先(KBが唯一の情報源・ヒント表は型の既定値)
    machine: (MACHINE_HINTS[r.id] || r.machine) ? Object.assign({}, MACHINE_HINTS[r.id] || {}, r.machine || {}) : null,
  })),
};

/* 検証: このスクリプト由来の数値がpackのpointsに混入していないこと(全pointsがitems.jsonと一致) */
const src = new Map(items.map(i => [i.id, i.points]));
for (const it of pack.items) {
  if (it.points !== src.get(it.id)) throw new Error(`points不一致: ${it.id}`);
}

const js = `/* クリニックタウン3D — 診療報酬KBゲームパック(生成物)
 * 生成: ${pack.generated_at} / 生成元: medical-kb/data/kb/${rev}/
 * 再生成: node medical-kb/scripts/build_game_pack.mjs --rev ${rev}
 * このファイルを手で編集しないこと。点数・条件・根拠の一次データはmedical-kbにある。 */
(function (root, data) {
  if (typeof module !== 'undefined' && module.exports) module.exports = data;
  else root.KB_${rev.toUpperCase()} = data;
})(typeof self !== 'undefined' ? self : this, ${JSON.stringify(pack, null, 1)});
`;
const out = join(KB_ROOT, '..', 'clinic-flow-3d', 'data', `kb-${rev}.js`);
writeFileSync(out, js);
console.log(`生成: ${out} (items ${pack.items.length} / fs ${pack.facilityStandards.length} / rules ${pack.rules.length})`);
