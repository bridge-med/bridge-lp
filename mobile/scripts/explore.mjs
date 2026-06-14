import { render, screen } from './mock.mjs';

const GOTHIC = 'Zen Kaku Gothic New';
const MINCHO = 'Shippori Mincho';

// ---------- Direction A — "Almanac" : warm paper, ink, clay accent, mincho hero
{
  const paper = '#F4F1E9', ink = '#22262E', sub = '#8A8578', line = '#E4DFD3', clay = '#B0573C', surface='#FCFBF7';
  const t = [];
  t.push(`<text x="28" y="78" font-family="${GOTHIC}" font-weight="700" font-size="11" letter-spacing="3" fill="${sub}">BRIDGE WORKLOG</text>`);
  t.push(`<text x="26" y="150" font-family="${MINCHO}" font-weight="800" font-size="64" fill="${ink}">6</text>`);
  t.push(`<text x="70" y="150" font-family="${MINCHO}" font-weight="400" font-size="30" fill="${ink}">月</text>`);
  t.push(`<text x="104" y="150" font-family="${MINCHO}" font-weight="800" font-size="64" fill="${ink}">14</text>`);
  t.push(`<text x="180" y="150" font-family="${MINCHO}" font-weight="400" font-size="30" fill="${ink}">日</text>`);
  t.push(`<text x="232" y="150" font-family="${MINCHO}" font-weight="400" font-size="22" fill="${clay}">日</text>`);
  t.push(`<text x="28" y="184" font-family="${GOTHIC}" font-weight="500" font-size="14" fill="${sub}">きょうのことを、書き留める。</text>`);
  t.push(`<line x1="28" y1="212" x2="362" y2="212" stroke="${line}"/>`);
  // stats as editorial numerals
  t.push(`<text x="28" y="266" font-family="${MINCHO}" font-weight="600" font-size="40" fill="${ink}">3</text>`);
  t.push(`<text x="64" y="266" font-family="${GOTHIC}" font-weight="500" font-size="12" fill="${sub}">未完了</text>`);
  t.push(`<text x="150" y="266" font-family="${MINCHO}" font-weight="600" font-size="40" fill="${ink}">5</text>`);
  t.push(`<text x="186" y="266" font-family="${GOTHIC}" font-weight="500" font-size="12" fill="${sub}">今週</text>`);
  t.push(`<text x="362" y="266" text-anchor="end" font-family="${GOTHIC}" font-weight="500" font-size="12" fill="${clay}">振り返り →</text>`);
  t.push(`<line x1="28" y1="292" x2="362" y2="292" stroke="${line}"/>`);
  // two actions
  t.push(`<rect x="28" y="316" width="160" height="92" rx="14" fill="${surface}" stroke="${line}"/>`);
  t.push(`<circle cx="52" cy="344" r="13" fill="none" stroke="${clay}" stroke-width="1.5"/>`);
  t.push(`<text x="48" y="396" font-family="${GOTHIC}" font-weight="700" font-size="15" fill="${ink}">クイックメモ</text>`.replace('x="48"','x="44"'));
  t.push(`<text x="44" y="375" font-family="${GOTHIC}" font-weight="700" font-size="15" fill="${ink}">クイックメモ</text>`);
  t.push(`<rect x="202" y="316" width="160" height="92" rx="14" fill="${ink}"/>`);
  t.push(`<text x="218" y="375" font-family="${GOTHIC}" font-weight="700" font-size="15" fill="#fff">仕事ログ</text>`);
  t.push(`<text x="218" y="396" font-family="${GOTHIC}" font-weight="400" font-size="11" fill="#C9CAD0">今日の記録 +</text>`);
  // recent
  t.push(`<text x="28" y="452" font-family="${GOTHIC}" font-weight="700" font-size="11" letter-spacing="2" fill="${sub}">最近のログ</text>`);
  const items = [['6.13','金','退院前カンファの段取りを改善','課題発見・調整'],['6.12','木','新人OTの初期評価に同席','教育']];
  let y=486;
  for (const [d,wd,title,tag] of items){
    t.push(`<text x="28" y="${y}" font-family="${MINCHO}" font-weight="600" font-size="22" fill="${clay}">${d}</text>`);
    t.push(`<text x="92" y="${y}" font-family="${GOTHIC}" font-weight="700" font-size="15" fill="${ink}">${title}</text>`);
    t.push(`<text x="92" y="${y+22}" font-family="${GOTHIC}" font-weight="400" font-size="12" fill="${sub}">${tag}</text>`);
    t.push(`<line x1="28" y1="${y+44}" x2="362" y2="${y+44}" stroke="${line}"/>`);
    y+=78;
  }
  // tab bar
  t.push(`<line x1="0" y1="780" x2="390" y2="780" stroke="${line}"/>`);
  const tabs=['ホーム','記録','タスク','顧み','設定'];
  tabs.forEach((tab,i)=>{ const x=39+i*78; const on=i===0;
    t.push(`<text x="${x}" y="812" text-anchor="middle" font-family="${GOTHIC}" font-weight="${on?700:400}" font-size="11" fill="${on?clay:sub}">${tab}</text>`);
  });
  render(screen(t.join(''), paper), '/tmp/A.png');
}

// ---------- Direction B — "Clinical Calm" : cool white, petrol accent, soft rounded
{
  const bg='#F7F9FA', ink='#1B2733', sub='#7C8896', line='#E8EDF0', teal='#0E6E63', surface='#FFFFFF';
  const t=[];
  t.push(`<text x="24" y="74" font-family="${GOTHIC}" font-weight="500" font-size="14" fill="${sub}">こんにちは</text>`);
  t.push(`<text x="24" y="108" font-family="${GOTHIC}" font-weight="700" font-size="26" fill="${ink}">きょうを記録しよう</text>`);
  t.push(`<text x="24" y="134" font-family="${GOTHIC}" font-weight="400" font-size="13" fill="${sub}">6月14日(日)・理学療法士</text>`);
  // bars mark
  for(let i=0;i<4;i++) t.push(`<rect x="${320+i*14}" y="${96-i*12}" width="8" height="${28+i*12}" rx="4" fill="${teal}" fill-opacity="${0.35+i*0.2}"/>`);
  // big card actions
  t.push(`<rect x="24" y="164" width="${390-48}" height="96" rx="20" fill="${surface}" stroke="${line}"/>`);
  t.push(`<rect x="40" y="188" width="48" height="48" rx="14" fill="${teal}"/>`);
  t.push(`<text x="104" y="204" font-family="${GOTHIC}" font-weight="700" font-size="16" fill="${ink}">仕事ログを書く</text>`);
  t.push(`<text x="104" y="228" font-family="${GOTHIC}" font-weight="400" font-size="12" fill="${sub}">30秒〜2分。空欄でもOK</text>`);
  t.push(`<text x="${390-40}" y="220" text-anchor="end" font-family="${GOTHIC}" font-weight="700" font-size="20" fill="${teal}">›</text>`);
  // two small stat cards
  const sc=(x,n,l)=>`<rect x="${x}" y="276" width="159" height="86" rx="18" fill="${surface}" stroke="${line}"/>
    <text x="${x+20}" y="324" font-family="${GOTHIC}" font-weight="700" font-size="30" fill="${ink}">${n}</text>
    <text x="${x+20}" y="346" font-family="${GOTHIC}" font-weight="400" font-size="12" fill="${sub}">${l}</text>`;
  t.push(sc(24,'3','未完了タスク')); t.push(sc(207,'5','今週のログ'));
  // reflection banner
  t.push(`<rect x="24" y="378" width="${390-48}" height="64" rx="18" fill="#E7F1EF"/>`);
  t.push(`<text x="44" y="408" font-family="${GOTHIC}" font-weight="700" font-size="15" fill="${teal}">今週をふりかえる</text>`);
  t.push(`<text x="44" y="428" font-family="${GOTHIC}" font-weight="400" font-size="12" fill="#5E8A84">1週間のログから自動でまとめ</text>`);
  // recent
  t.push(`<text x="24" y="478" font-family="${GOTHIC}" font-weight="700" font-size="13" fill="${ink}">最近の仕事ログ</text>`);
  const items=[['退院前カンファの段取りを改善','6月13日'],['新人OTの初期評価に同席','6月12日']];
  let y=496;
  for(const [title,d] of items){
    t.push(`<rect x="24" y="${y}" width="${390-48}" height="68" rx="16" fill="${surface}" stroke="${line}"/>`);
    t.push(`<text x="42" y="${y+30}" font-family="${GOTHIC}" font-weight="700" font-size="14" fill="${ink}">${title}</text>`);
    t.push(`<text x="42" y="${y+50}" font-family="${GOTHIC}" font-weight="400" font-size="12" fill="${sub}">${d}</text>`);
    y+=80;
  }
  t.push(`<rect x="0" y="780" width="390" height="64" fill="${surface}"/><line x1="0" y1="780" x2="390" y2="780" stroke="${line}"/>`);
  const tabs=['ホーム','記録','タスク','顧み','設定'];
  tabs.forEach((tab,i)=>{const x=39+i*78;const on=i===0;
    t.push(`<circle cx="${x}" cy="802" r="3" fill="${on?teal:'none'}"/>`);
    t.push(`<text x="${x}" y="822" text-anchor="middle" font-family="${GOTHIC}" font-weight="${on?700:400}" font-size="11" fill="${on?teal:sub}">${tab}</text>`);});
  render(screen(t.join(''), bg), '/tmp/B.png');
}

// ---------- Direction C — "Mono Grid" : ink on white, single accent, mincho numerals, grid
{
  const bg='#FFFFFF', ink='#14171C', sub='#9A9DA4', line='#ECEDEF', accent='#3B4DT'.replace('T',''), surface='#FAFAFA';
  const acc='#33415C';
  const t=[];
  // margin rules
  t.push(`<line x1="64" y1="0" x2="64" y2="844" stroke="${line}"/>`);
  t.push(`<text x="24" y="80" font-family="${MINCHO}" font-weight="400" font-size="13" fill="${sub}" transform="rotate(0)">01</text>`);
  t.push(`<text x="84" y="76" font-family="${GOTHIC}" font-weight="700" font-size="11" letter-spacing="3" fill="${sub}">TODAY</text>`);
  t.push(`<text x="82" y="132" font-family="${MINCHO}" font-weight="800" font-size="44" fill="${ink}">6月14日</text>`);
  t.push(`<text x="84" y="160" font-family="${GOTHIC}" font-weight="400" font-size="13" fill="${sub}">日曜日 ・ きょうを記録する</text>`);
  t.push(`<line x1="0" y1="188" x2="390" y2="188" stroke="${line}"/>`);
  // list-style actions w/ numerals
  const row=(y,n,jp,en,dark)=>`
    <text x="24" y="${y+4}" font-family="${MINCHO}" font-weight="400" font-size="13" fill="${sub}">${n}</text>
    <text x="84" y="${y}" font-family="${GOTHIC}" font-weight="700" font-size="17" fill="${ink}">${jp}</text>
    <text x="84" y="${y+22}" font-family="${GOTHIC}" font-weight="400" font-size="12" fill="${sub}">${en}</text>
    <text x="366" y="${y+2}" text-anchor="end" font-family="${GOTHIC}" font-weight="400" font-size="18" fill="${dark?acc:sub}">→</text>
    <line x1="0" y1="${y+40}" x2="390" y2="${y+40}" stroke="${line}"/>`;
  t.push(row(232,'02','仕事ログを書く','今日の出来事・判断・学びを残す',true));
  t.push(row(304,'03','クイックメモ','1行の気づきをすばやく',false));
  t.push(row(376,'04','今週をふりかえる','5件のログからまとめる',false));
  // stats inline
  t.push(`<text x="84" y="452" font-family="${GOTHIC}" font-weight="700" font-size="11" letter-spacing="2" fill="${sub}">いま</text>`);
  t.push(`<text x="84" y="500" font-family="${MINCHO}" font-weight="600" font-size="40" fill="${ink}">3</text>`);
  t.push(`<text x="120" y="500" font-family="${GOTHIC}" font-weight="400" font-size="12" fill="${sub}">未完了</text>`);
  t.push(`<text x="210" y="500" font-family="${MINCHO}" font-weight="600" font-size="40" fill="${ink}">5</text>`);
  t.push(`<text x="246" y="500" font-family="${GOTHIC}" font-weight="400" font-size="12" fill="${sub}">今週ログ</text>`);
  t.push(`<line x1="0" y1="528" x2="390" y2="528" stroke="${line}"/>`);
  t.push(`<text x="84" y="566" font-family="${GOTHIC}" font-weight="700" font-size="11" letter-spacing="2" fill="${sub}">最近</text>`);
  const items=[['6.13','退院前カンファの段取りを改善'],['6.12','新人OTの初期評価に同席']];
  let y=600;
  for(const [d,title] of items){
    t.push(`<text x="24" y="${y}" font-family="${MINCHO}" font-weight="400" font-size="15" fill="${sub}">${d}</text>`);
    t.push(`<text x="84" y="${y}" font-family="${GOTHIC}" font-weight="500" font-size="15" fill="${ink}">${title}</text>`);
    t.push(`<line x1="0" y1="${y+26}" x2="390" y2="${y+26}" stroke="${line}"/>`);
    y+=52;
  }
  t.push(`<line x1="0" y1="780" x2="390" y2="780" stroke="${line}"/>`);
  const tabs=['ホーム','記録','タスク','顧み','設定'];
  tabs.forEach((tab,i)=>{const x=39+i*78;const on=i===0;
    t.push(`<text x="${x}" y="812" text-anchor="middle" font-family="${GOTHIC}" font-weight="${on?700:400}" font-size="11" fill="${on?acc:sub}">${tab}</text>`);});
  render(screen(t.join(''), bg), '/tmp/C.png');
}
