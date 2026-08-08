// Build-time vocabulary dataset generator (dev-only, run manually).
//   node scripts/build-vocab.mjs
//
// Assembles a ~5,000-word English study deck for Japanese learners from openly
// licensed sources, so we never copy a commercial word list:
//   - CEFR-J Vocabulary Profile 1.5  -> learner level (A1..B2) + part of speech
//     (Open Language Profiles, CC BY-SA 4.0)
//   - octanove C1/C2 profile         -> advanced level extension (CC BY-SA 4.0)
//   - EJDict-hand (kujirahand)       -> Japanese gloss (Public Domain)
//   - hermitdave FrequencyWords (en) -> frequency ordering (CC BY-SA 4.0)
// "TOEIC / business" tagging is our own curated domain set (not copied).
//
// Output: assets/vocab.json (compact array) + assets/vocab.meta.json + NOTICE.

import { writeFileSync } from 'node:fs';

const SRC = {
  cefrj: 'https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/cefrj-vocabulary-profile-1.5.csv',
  octanove: 'https://raw.githubusercontent.com/openlanguageprofiles/olp-en-cefrj/master/octanove-vocabulary-profile-c1c2-1.0.csv',
  freq: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt',
  ejdictBase: 'https://raw.githubusercontent.com/kujirahand/EJDict/master/src/',
};

// Words we tag as TOEIC / business focus (curated by theme, single lemmas only).
const BUSINESS = new Set(
  `office meeting schedule appointment deadline agenda memo presentation conference seminar workshop
   colleague supervisor manager director executive employee employer staff department team
   recruit resume interview applicant candidate qualification experience promotion resign retire
   salary wage income bonus benefit pension insurance commute overtime shift leave vacation
   invoice receipt refund purchase order shipment ship deliver delivery warehouse inventory stock
   supplier vendor client customer contract agreement negotiate proposal quotation estimate
   budget expense revenue profit loss finance account audit balance statement payment transaction
   bank loan interest tax fee charge discount coupon warranty complaint exchange retail wholesale
   manufacture product goods merchandise brand advertise advertisement marketing promotion survey
   questionnaire feedback strategy goal objective achievement performance evaluation productivity
   efficiency project task assignment launch release deadline merger acquisition shareholder investor
   logistics distribution freight customs export import currency procurement compliance regulation
   policy clause renew expire subscription membership headquarters branch corporate enterprise
   commercial industry sector competitor profit deadline overtime warehouse fluctuate fiscal
   reimburse itinerary boarding luggage baggage flight reservation accommodation hospitality
   maintenance facility equipment warranty defect malfunction inspection installation`
    .split(/\s+/).filter(Boolean),
);

const POS = {
  noun: '名', verb: '動', adjective: '形', adverb: '副', preposition: '前',
  pronoun: '代', conjunction: '接', determiner: '限', interjection: '間',
  number: '数', 'modal verb': '助動', 'auxiliary verb': '助動',
};

async function get(url) {
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(url);
      if (r.ok) return await r.text();
      if (r.status === 404) throw new Error('404 ' + url);
    } catch (e) {
      if (a === 3) throw e;
      await new Promise((res) => setTimeout(res, 1000 * (a + 1)));
    }
  }
  throw new Error('fetch failed ' + url);
}

// Minimal CSV row splitter (handles simple quoted fields).
function csvRows(text) {
  return text.trim().split(/\r?\n/).map((line) => {
    const out = [];
    let cur = '', q = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (q) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out;
  });
}

function cleanGloss(raw) {
  let g = raw
    .replace(/〈[^〉]*〉/g, '')
    .replace(/《[^》]*》/g, '')
    .replace(/[『』]/g, '') // GENE95 emphasis markers -> plain
    .replace(/\(\d+\)/g, '') // enumeration markers
    .replace(/^=.*/, '') // redirect entries -> drop
    .trim();
  if (!g) return '';
  const senses = g.split(' / ').map((s) => s.trim()).filter(Boolean);
  let out = senses.slice(0, 2).join('、');
  if (out.length > 34) out = senses[0];
  if (out.length > 40) out = out.slice(0, 39) + '…';
  return out.trim();
}

const SINGLE = /^[a-z][a-z'-]*$/;
// Ultra-basic function words whose dictionary glosses are noisy / unhelpful as
// study cards (and which every learner already knows).
const STOP = new Set('a an the i to of and'.split(' '));

async function main() {
  console.log('fetching sources…');
  const [cefrjTxt, octanoveTxt, freqTxt] = await Promise.all([
    get(SRC.cefrj), get(SRC.octanove), get(SRC.freq),
  ]);
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const ejTexts = await Promise.all(letters.map((l) => get(SRC.ejdictBase + l + '.txt')));

  // EJDict: word(lower) -> gloss (first occurrence wins)
  const gloss = new Map();
  for (const txt of ejTexts) {
    for (const line of txt.split(/\r?\n/)) {
      const tab = line.indexOf('\t');
      if (tab < 0) continue;
      const w = line.slice(0, tab).trim().toLowerCase();
      if (!w || gloss.has(w)) continue;
      gloss.set(w, line.slice(tab + 1).trim());
    }
  }

  // Frequency rank: word -> 1-based rank
  const rank = new Map();
  freqTxt.split(/\r?\n/).forEach((line, i) => {
    const w = line.split(' ')[0]?.trim().toLowerCase();
    if (w && !rank.has(w)) rank.set(w, i + 1);
  });

  // CEFR level per headword (lowest level wins if duplicated)
  const ORDER = { A1: 1, A2: 2, B1: 3, B2: 4, C1: 5, C2: 6 };
  const level = new Map(); // word -> { cefr, pos }
  const ingest = (rows) => {
    for (let i = 1; i < rows.length; i++) {
      const [headword, pos, cefr] = rows[i];
      if (!headword || !cefr) continue;
      const w = headword.trim().toLowerCase();
      if (!SINGLE.test(w)) continue;
      const prev = level.get(w);
      if (!prev || ORDER[cefr] < ORDER[prev.cefr]) level.set(w, { cefr, pos: (pos || '').trim() });
    }
  };
  ingest(csvRows(cefrjTxt));
  ingest(csvRows(octanoveTxt));

  // Assemble entries
  const entries = [];
  for (const [w, { cefr, pos }] of level) {
    if (STOP.has(w)) continue;
    const g = cleanGloss(gloss.get(w) || '');
    if (!g) continue;
    entries.push({
      w,
      j: g,
      p: POS[pos] || '',
      l: cefr,
      r: rank.get(w) ?? 99999,
      b: BUSINESS.has(w) ? 1 : undefined,
    });
  }
  // Order by frequency (common first) -> pedagogically sensible deck order
  entries.sort((a, b) => a.r - b.r || a.w.localeCompare(b.w));

  const byLevel = {};
  let biz = 0;
  for (const e of entries) {
    byLevel[e.l] = (byLevel[e.l] || 0) + 1;
    if (e.b) biz++;
  }

  writeFileSync('assets/vocab.json', JSON.stringify(entries));
  const meta = {
    total: entries.length,
    byLevel,
    business: biz,
    generatedAt: new Date().toISOString().slice(0, 10),
  };
  writeFileSync('assets/vocab.meta.json', JSON.stringify(meta, null, 2));
  writeFileSync(
    'assets/vocab.NOTICE.md',
    `# Vocabulary dataset — sources & licenses

\`vocab.json\` is a derived dataset (English study deck for Japanese learners),
generated by \`scripts/build-vocab.mjs\` from the following openly licensed sources.
As required by CC BY-SA, this derived dataset is shared under **CC BY-SA 4.0**.

- **CEFR-J Vocabulary Profile 1.5** — learner level & part of speech.
  Open Language Profiles / CEFR-J. License: CC BY-SA 4.0.
- **octanove C1/C2 Vocabulary Profile 1.0** — advanced level extension. CC BY-SA 4.0.
- **EJDict-hand** (kujirahand) — Japanese glosses. Public Domain.
- **FrequencyWords** (hermitdave, en 2018) — frequency ordering. CC BY-SA 4.0.

"TOEIC / business" tagging is an original curation by this project, not copied
from any commercial word list.
`,
  );
  console.log('wrote assets/vocab.json —', entries.length, 'words');
  console.log('by level:', byLevel, '| business:', biz);
}

main().catch((e) => { console.error(e); process.exit(1); });
