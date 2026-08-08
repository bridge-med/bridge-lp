import { render, screen } from './mock.mjs';

const G = 'Zen Kaku Gothic New';
const M = 'Shippori Mincho';

function home(p, out) {
  const { paper, ink, sub, line, faint, acc, accSoft } = p;
  const GX = 92; // gutter rule x
  const CX = 116; // content x
  const t = [];
  // gutter rule
  t.push(`<line x1="${GX}" y1="40" x2="${GX}" y2="792" stroke="${faint}"/>`);
  // wordmark
  t.push(`<text x="${CX}" y="74" font-family="${G}" font-weight="700" font-size="10.5" letter-spacing="4" fill="${sub}">BRIDGE WORKLOG</text>`);
  // hero date — weekday in gutter (clay mincho), date big mincho
  t.push(`<text x="${GX - 18}" y="128" text-anchor="end" font-family="${M}" font-weight="600" font-size="30" fill="${acc}">日</text>`);
  t.push(`<text x="${CX}" y="138" font-family="${M}" font-weight="800" font-size="46" fill="${ink}">6月14日</text>`);
  t.push(`<text x="${CX}" y="168" font-family="${G}" font-weight="400" font-size="13" fill="${sub}">きょうのことを、書き留める</text>`);
  t.push(`<line x1="${CX}" y1="196" x2="362" y2="196" stroke="${line}"/>`);
  // numbered actions
  const row = (y, n, title, desc, primary) => {
    t.push(`<text x="${GX - 16}" y="${y + 2}" text-anchor="end" font-family="${M}" font-weight="400" font-size="14" fill="${sub}">${n}</text>`);
    t.push(`<text x="${CX}" y="${y}" font-family="${G}" font-weight="700" font-size="17" fill="${ink}">${title}</text>`);
    t.push(`<text x="${CX}" y="${y + 21}" font-family="${G}" font-weight="400" font-size="12" fill="${sub}">${desc}</text>`);
    t.push(`<text x="362" y="${y + 2}" text-anchor="end" font-family="${G}" font-weight="400" font-size="17" fill="${primary ? acc : sub}">→</text>`);
    t.push(`<line x1="${CX}" y1="${y + 38}" x2="362" y2="${y + 38}" stroke="${line}"/>`);
  };
  row(244, '02', '仕事ログを書く', '今日の出来事・判断・学びを残す', true);
  row(312, '03', 'クイックメモ', '1行の気づきをすばやく', false);
  row(380, '04', '今週をふりかえる', '5件のログからまとめる', false);
  // stats
  t.push(`<text x="${CX}" y="452" font-family="${G}" font-weight="700" font-size="10.5" letter-spacing="3" fill="${sub}">いま</text>`);
  t.push(`<text x="${CX}" y="502" font-family="${M}" font-weight="600" font-size="42" fill="${ink}">3</text>`);
  t.push(`<text x="${CX + 40}" y="502" font-family="${G}" font-weight="400" font-size="12" fill="${sub}">未完了</text>`);
  t.push(`<text x="248" y="502" font-family="${M}" font-weight="600" font-size="42" fill="${ink}">5</text>`);
  t.push(`<text x="288" y="502" font-family="${G}" font-weight="400" font-size="12" fill="${sub}">今週ログ</text>`);
  t.push(`<line x1="${CX}" y1="532" x2="362" y2="532" stroke="${line}"/>`);
  // recent
  t.push(`<text x="${CX}" y="572" font-family="${G}" font-weight="700" font-size="10.5" letter-spacing="3" fill="${sub}">最近のログ</text>`);
  const items = [['6.13', '退院前カンファの段取りを改善', '課題発見・現場調整'], ['6.12', '新人OTの初期評価に同席', '教育']];
  let y = 612;
  for (const [d, title, tag] of items) {
    t.push(`<text x="${GX - 16}" y="${y}" text-anchor="end" font-family="${M}" font-weight="400" font-size="16" fill="${acc}">${d}</text>`);
    t.push(`<text x="${CX}" y="${y}" font-family="${G}" font-weight="700" font-size="15" fill="${ink}">${title}</text>`);
    t.push(`<text x="${CX}" y="${y + 20}" font-family="${G}" font-weight="400" font-size="11.5" fill="${sub}">${tag}</text>`);
    t.push(`<line x1="${CX}" y1="${y + 40}" x2="362" y2="${y + 40}" stroke="${line}"/>`);
    y += 72;
  }
  // tabs
  t.push(`<line x1="0" y1="788" x2="390" y2="788" stroke="${line}"/>`);
  ['ホーム', '記録', 'タスク', 'ふり返り', '設定'].forEach((tab, i) => {
    const x = 39 + i * 78, on = i === 0;
    if (on) t.push(`<circle cx="${x}" cy="810" r="2.5" fill="${acc}"/>`);
    t.push(`<text x="${x}" y="826" text-anchor="middle" font-family="${G}" font-weight="${on ? 700 : 400}" font-size="10.5" fill="${on ? acc : sub}">${tab}</text>`);
  });
  render(screen(t.join(''), paper), out);
}

home(
  { paper: '#F4F1E9', ink: '#23272F', sub: '#8C8678', line: '#E4DFD2', faint: '#ECE7DB', acc: '#B0573C', accSoft: '#EFE2D7' },
  '/tmp/D1.png',
);
home(
  { paper: '#F3F2EE', ink: '#1E2530', sub: '#85878C', line: '#E3E2DC', faint: '#EAE9E3', acc: '#34506E', accSoft: '#E1E7EC' },
  '/tmp/D2.png',
);
