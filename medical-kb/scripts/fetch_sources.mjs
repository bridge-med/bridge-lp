#!/usr/bin/env node
/* ================================================================
   原典資料の取得。data/manifest/sources.{rev}.json を読み、
   data/sources/{rev}/ 以下へ「無加工で」保存する。

   使い方:
     node medical-kb/scripts/fetch_sources.mjs            # 既定: r08
     node medical-kb/scripts/fetch_sources.mjs --rev r08
     node medical-kb/scripts/fetch_sources.mjs --only r08-qa-20260323

   動作:
   - fetch: "direct" … urls[] を順に試し、最初に成功したものを保存
   - fetch: "crawl"  … ポータルHTMLを保存し、PDF/ZIPリンク一覧を
     crawl-report.{rev}.json に書き出す(自動追跡はしない。リンクの
     採否は人が判断し、マニフェストへ直URLを追記して direct で再実行)
   - 取得結果(sha256/日時/使用URL)は data/manifest/retrieval-log.json に追記
   - 既に取得済み(ファイルが存在しsha256が記録済み)の文書はスキップ
   - 原典は上書きしない。再取得したい場合はファイルを退避してから実行

   注意:
   - この環境から対象ドメインへ到達できない場合(プロキシの403等)、
     このスクリプトはネットワーク許可のある環境で実行すること
   - 取得後、各文書の実物を開いて doc_number / issued_date を照合し、
     マニフェストの verified を true に更新すること(人の作業)
   ================================================================ */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { KB_ROOT, loadJson, saveJson, download, sha256File, nowIso } from './lib/util.mjs';

const args = process.argv.slice(2);
const rev = argVal('--rev') || 'r08';
const only = argVal('--only');

function argVal(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
}

const manifestPath = join(KB_ROOT, 'data', 'manifest', `sources.${rev}.json`);
const logPath = join(KB_ROOT, 'data', 'manifest', 'retrieval-log.json');
const manifest = loadJson(manifestPath);
const log = existsSync(logPath) ? loadJson(logPath) : { entries: [] };

const results = { fetched: [], skipped: [], failed: [], crawl_targets: [] };

for (const doc of manifest.documents) {
  if (only && doc.id !== only) continue;
  const dest = join(KB_ROOT, 'data', 'sources', rev, doc.save_as);

  if (existsSync(dest) && log.entries.some(e => e.id === doc.id && e.sha256)) {
    results.skipped.push(doc.id);
    continue;
  }

  const urls = (doc.urls || []).map(u => u.url);
  if (urls.length === 0) {
    results.failed.push({ id: doc.id, reason: 'URL未特定。ポータルのクロール結果から直URLをマニフェストへ追記すること' });
    continue;
  }

  let ok = false;
  for (const url of urls) {
    try {
      const sha256 = download(url, dest);
      log.entries.push({ id: doc.id, url, dest: `data/sources/${rev}/${doc.save_as}`, sha256, retrieved_at: nowIso() });
      results.fetched.push({ id: doc.id, url });
      ok = true;
      break;
    } catch (e) {
      console.error(`  ${doc.id}: ${url} の取得に失敗 (${e.message?.split('\n')[0]})`);
    }
  }
  if (!ok) {
    results.failed.push({ id: doc.id, reason: '全URLで取得失敗' });
    continue;
  }

  if (doc.fetch === 'crawl') {
    // 保存したHTML/PDFからリンク候補を抽出してレポートへ(HTML時のみ)
    try {
      const body = readFileSync(dest, 'utf8');
      const links = [...body.matchAll(/href="([^"]+\.(?:pdf|zip|xlsx?))"/gi)]
        .map(m => m[1]);
      if (links.length) results.crawl_targets.push({ id: doc.id, links: [...new Set(links)] });
    } catch { /* バイナリはスキップ */ }
  }
}

saveJson(logPath, log);
saveJson(join(KB_ROOT, 'data', 'manifest', `crawl-report.${rev}.json`), {
  generated_at: nowIso(),
  note: 'ポータルから機械抽出したリンク候補。採否は人が判断し、マニフェストのurlsへ追記してから再実行する。',
  targets: results.crawl_targets,
});

console.log('--- fetch_sources 結果 ---');
console.log(`取得: ${results.fetched.length} / スキップ(取得済): ${results.skipped.length} / 失敗: ${results.failed.length}`);
for (const f of results.failed) console.log(`  失敗: ${f.id} — ${f.reason}`);
if (results.crawl_targets.length) console.log(`クロール候補リンクを crawl-report.${rev}.json に書き出した`);
process.exit(results.failed.length > 0 ? 1 : 0);
