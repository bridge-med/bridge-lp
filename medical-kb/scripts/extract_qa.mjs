#!/usr/bin/env node
/* ================================================================
   疑義解釈事務連絡PDF → data/kb/{rev}/qa_entries.json の機械抽出。

   使い方: node medical-kb/scripts/extract_qa.mjs [--rev r08]

   - 対象: マニフェストの category D のうち title が「疑義解釈資料の送付について」
     で始まる文書(訂正事務連絡は対象外)
   - pdftotext -layout の出力を「問N …（答）…」の定型で分割する
   - question / answer は原文の機械抽出(改行・表の崩れがあり得る)。
     このため confidence は 'draft' とし、目視照合済みにしたものだけ
     手動で 'verified' へ昇格させる運用とする
   - 【…】の項目見出しと別添見出しを section に、問の開始ページを page に記録
   - 問文中の区分番号(「Ａ０００」等)を related_items に機械抽出する
   - 再実行すると全面再生成される(手動編集は confidence昇格のみを想定し、
     昇格済みIDのconfidenceは維持する)
   ================================================================ */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { KB_ROOT, loadJson, saveJson, nowIso } from './lib/util.mjs';

const args = process.argv.slice(2);
const rev = (args.indexOf('--rev') >= 0 ? args[args.indexOf('--rev') + 1] : null) || 'r08';

const manifest = loadJson(join(KB_ROOT, 'data', 'manifest', `sources.${rev}.json`));
const outPath = join(KB_ROOT, 'data', 'kb', rev, 'qa_entries.json');
const prev = existsSync(outPath) ? loadJson(outPath) : [];
const prevConf = new Map(prev.map(q => [q.id, q.confidence]));

const targets = manifest.documents.filter(d =>
  d.category === 'D' && /^疑義解釈資料の送付について/.test(d.title) && !/訂正/.test(d.title));

const zen2han = s => s.replace(/[０-９Ａ-Ｚ]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
const KUBUN_RE = /「?([ＡＢＣＤＥＦＧＨＩＪＫＬＭＮ][０-９]{3}(?:－[０-９]{1,2})*)」?/g;

const entries = [];
for (const doc of targets) {
  const pdf = join(KB_ROOT, 'data', 'sources', rev, doc.save_as);
  if (!existsSync(pdf)) { console.error(`スキップ(未取得): ${doc.id}`); continue; }
  const text = execFileSync('pdftotext', ['-layout', pdf, '-'], { maxBuffer: 64 * 1024 * 1024 }).toString('utf8');
  const pages = text.split('\f');
  const batch = (doc.title.match(/（(その[0-9０-９]+)）/) || [])[1] || null;

  let section = null;   // 【…】見出し
  let chapter = null;   // 「…関係」「別添N」見出し
  let cur = null;       // { q_no, page, lines: [] }
  let seq = 0;
  const flush = () => {
    if (!cur) return;
    const body = cur.lines.join('\n');
    const ansIdx = body.search(/（答）|\(答\)/);
    const rawQ = ansIdx >= 0 ? body.slice(0, ansIdx) : body;
    const rawA = ansIdx >= 0 ? body.slice(ansIdx).replace(/^（答）|^\(答\)/, '') : null;
    const norm = s => s == null ? null : s.replace(/[ \t]+/g, ' ').replace(/\n+/g, '\n').trim();
    seq += 1;
    const id = `${doc.id}-q${String(seq).padStart(3, '0')}`;
    const related = [...new Set([...rawQ.matchAll(KUBUN_RE)].map(m => zen2han(m[1]).replace(/－/g, '-')))];
    entries.push({
      id,
      document_id: doc.id,
      batch_label: batch,
      q_no: cur.q_no,
      section: [chapter, section].filter(Boolean).join(' / ') || null,
      question: norm(rawQ.replace(/^問\s*[0-9０-９]+\s*/, '')),
      answer: norm(rawA),
      related_items: related.length ? related : null,
      page: `p.${cur.page}`,
      confidence: prevConf.get(id) === 'verified' ? 'verified' : 'draft',
    });
    cur = null;
  };

  pages.forEach((pageText, pi) => {
    for (const line of pageText.split('\n')) {
      const t = line.trim();
      const mSec = t.match(/^【(.+?)】/);
      const mChap = t.match(/^(別添[0-9０-９]+|.{1,30}関係)$/);
      const mQ = t.match(/^問\s*([0-9０-９]+)/);
      if (mQ) {
        flush();
        cur = { q_no: `問${zen2han(mQ[1])}`, page: pi + 1, lines: [t] };
      } else if (mSec) {
        flush();
        section = mSec[1];
      } else if (mChap && !cur) {
        chapter = mChap[1];
        section = null;
      } else if (cur) {
        cur.lines.push(line);
      }
    }
  });
  flush();
}

saveJson(outPath, entries);
const byDoc = {};
for (const e of entries) byDoc[e.document_id] = (byDoc[e.document_id] || 0) + 1;
console.log(`qa_entries: ${entries.length}件 → ${outPath} (${nowIso()})`);
for (const [d, n] of Object.entries(byDoc)) console.log(`  ${d}: ${n}問`);
