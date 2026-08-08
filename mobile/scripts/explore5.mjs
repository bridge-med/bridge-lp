import { render, screen } from './mock.mjs';
const G = 'Zen Kaku Gothic New', M = 'Shippori Mincho';

// ---------- HUB (matches implementation) ----------
{
  const paper='#F4F1E9', ink='#23262E', sub='#8C8678', line='#E4DFD2', acc='#34506E', weak='#E1E5E8';
  const t=[];
  t.push(`<text x="24" y="78" font-family="${G}" font-weight="700" font-size="11" letter-spacing="3" fill="${sub}">CAREER</text>`);
  t.push(`<text x="24" y="120" font-family="${M}" font-weight="800" font-size="34" fill="${ink}">キャリア</text>`);
  t.push(`<text x="24" y="146" font-family="${G}" font-size="13" fill="${sub}">使うものだけ選んで、育てていく</text>`);
  const sections=[
    ['キャリア資産',[['成果・実績','数字で語れる実績'],['スキル','保有スキルとレベル'],['目標・キャリアプラン','取りに行く経験'],['キャリア変換','職務経歴書・自己PR…']]],
    ['自己理解',[['強み','強みと根拠'],['弱み・課題','向き合い方'],['自己分析','Will/Can/Must・SWOT'],['価値観','大事にしたいこと'],['モチベーション曲線','時期ごとの浮き沈み']]],
  ];
  let y=180;
  for(const [title,items] of sections){
    t.push(`<text x="24" y="${y}" font-family="${G}" font-weight="700" font-size="11" letter-spacing="2" fill="${sub}">${title}</text>`);
    y+=14;
    for(const [label,desc] of items){
      t.push(`<rect x="24" y="${y}" width="40" height="40" rx="12" fill="${weak}"/>`);
      t.push(`<circle cx="44" cy="${y+20}" r="6" fill="none" stroke="${acc}" stroke-width="1.6"/>`);
      t.push(`<text x="76" y="${y+18}" font-family="${G}" font-weight="700" font-size="16" fill="${ink}">${label}</text>`);
      t.push(`<text x="76" y="${y+36}" font-family="${G}" font-size="12" fill="${sub}">${desc}</text>`);
      t.push(`<text x="366" y="${y+24}" text-anchor="end" font-family="${G}" font-size="18" fill="${line}">›</text>`);
      t.push(`<line x1="24" y1="${y+54}" x2="366" y2="${y+54}" stroke="${line}"/>`);
      y+=64;
    }
    y+=16;
  }
  t.push(`<line x1="0" y1="788" x2="390" y2="788" stroke="${line}"/>`);
  ['ホーム','記録','タスク','キャリア','設定'].forEach((tab,i)=>{const x=39+i*78;const on=i===3;
    t.push(`<text x="${x}" y="826" text-anchor="middle" font-family="${G}" font-weight="${on?700:400}" font-size="10.5" fill="${on?acc:sub}">${tab}</text>`);});
  render(screen(t.join(''), paper), '/tmp/HUB.png');
}

// ---------- ALT A : "Midnight" — dark, premium, vivid accent ----------
{
  const bg='#14161C', card='#1E212A', ink='#F3F1EA', sub='#8A8E9A', acc='#E0B15A', mint='#67C9B5', line='#2A2E38';
  const t=[];
  t.push(`<text x="24" y="76" font-family="${G}" font-weight="500" font-size="13" fill="${sub}">2026.6.14 日</text>`);
  t.push(`<text x="24" y="120" font-family="${M}" font-weight="800" font-size="40" fill="${ink}">きょうを刻む</text>`);
  // accent ring stat
  t.push(`<circle cx="320" cy="100" r="34" fill="none" stroke="${line}" stroke-width="6"/>`);
  t.push(`<path d="M320 66 a34 34 0 0 1 24 58" fill="none" stroke="${acc}" stroke-width="6" stroke-linecap="round"/>`);
  t.push(`<text x="320" y="106" text-anchor="middle" font-family="${G}" font-weight="700" font-size="18" fill="${ink}">5</text>`);
  // big action
  t.push(`<rect x="24" y="156" width="342" height="96" rx="22" fill="${card}"/>`);
  t.push(`<rect x="44" y="180" width="48" height="48" rx="14" fill="${acc}"/>`);
  t.push(`<text x="108" y="198" font-family="${G}" font-weight="700" font-size="17" fill="${ink}">仕事ログを書く</text>`);
  t.push(`<text x="108" y="222" font-family="${G}" font-size="12" fill="${sub}">30秒で、今日を資産に</text>`);
  // chips row
  const chips=['強み','成果','スキル','目標'];
  let cx=24;
  chips.forEach((ch,i)=>{const w=ch.length*16+28; const on=i===0;
    t.push(`<rect x="${cx}" y="272" width="${w}" height="34" rx="17" fill="${on?mint:'none'}" stroke="${on?mint:line}"/>`);
    t.push(`<text x="${cx+w/2}" y="294" text-anchor="middle" font-family="${G}" font-weight="600" font-size="13" fill="${on?'#11302B':sub}">${ch}</text>`);
    cx+=w+10;});
  // list
  t.push(`<text x="24" y="346" font-family="${G}" font-weight="700" font-size="12" letter-spacing="2" fill="${sub}">最近</text>`);
  const items=[['退院前カンファの段取りを改善','課題発見・調整',acc],['新人OTの初期評価に同席','教育',mint]];
  let y=372;
  for(const [title,tag,dot] of items){
    t.push(`<rect x="24" y="${y}" width="342" height="74" rx="16" fill="${card}"/>`);
    t.push(`<circle cx="48" cy="${y+37}" r="5" fill="${dot}"/>`);
    t.push(`<text x="68" y="${y+32}" font-family="${G}" font-weight="700" font-size="15" fill="${ink}">${title}</text>`);
    t.push(`<text x="68" y="${y+52}" font-family="${G}" font-size="12" fill="${sub}">${tag}</text>`);
    y+=86;
  }
  t.push(`<rect x="0" y="784" width="390" height="60" fill="#0F1116"/>`);
  ['ホーム','記録','タスク','キャリア','設定'].forEach((tab,i)=>{const x=39+i*78;const on=i===0;
    t.push(`<text x="${x}" y="820" text-anchor="middle" font-family="${G}" font-weight="${on?700:400}" font-size="10.5" fill="${on?acc:sub}">${tab}</text>`);});
  render(screen(t.join(''), bg), '/tmp/ALT_A.png');
}

// ---------- ALT B : "Bold Block" — confident colour field + white type ----------
{
  const bg='#F2EEE6', ink='#1B1A17', block='#1F4D3D', accent='#E8552E', sub='#7C7768', card='#FFFFFF', line='#E4DFD2';
  const t=[];
  // colour header block
  t.push(`<rect x="0" y="0" width="390" height="300" fill="${block}"/>`);
  t.push(`<text x="28" y="92" font-family="${G}" font-weight="700" font-size="12" letter-spacing="3" fill="#A9C6BA">BRIDGE WORKLOG</text>`);
  t.push(`<text x="28" y="152" font-family="${M}" font-weight="800" font-size="52" fill="#F4F1E9">6.14</text>`);
  t.push(`<text x="28" y="186" font-family="${G}" font-weight="500" font-size="15" fill="#CFE0D8">日曜日 — きょうを記録する</text>`);
  // overlap card
  t.push(`<rect x="24" y="236" width="342" height="120" rx="20" fill="${card}"/>`);
  t.push(`<rect x="44" y="262" width="54" height="54" rx="16" fill="${accent}"/>`);
  t.push(`<text x="64" y="296" font-family="${G}" font-weight="800" font-size="30" fill="#fff">＋</text>`);
  t.push(`<text x="118" y="284" font-family="${G}" font-weight="700" font-size="18" fill="${ink}">仕事ログを書く</text>`);
  t.push(`<text x="118" y="308" font-family="${G}" font-size="13" fill="${sub}">今日の出来事・判断・学び</text>`);
  // two stats big
  t.push(`<text x="28" y="412" font-family="${M}" font-weight="800" font-size="52" fill="${ink}">3</text>`);
  t.push(`<text x="92" y="412" font-family="${G}" font-size="13" fill="${sub}">未完了</text>`);
  t.push(`<text x="210" y="412" font-family="${M}" font-weight="800" font-size="52" fill="${accent}">5</text>`);
  t.push(`<text x="274" y="412" font-family="${G}" font-size="13" fill="${sub}">今週</text>`);
  t.push(`<line x1="28" y1="440" x2="362" y2="440" stroke="${line}"/>`);
  t.push(`<text x="28" y="480" font-family="${G}" font-weight="700" font-size="12" letter-spacing="2" fill="${sub}">最近のログ</text>`);
  const items=[['退院前カンファの段取りを改善','6.13'],['新人OTの初期評価に同席','6.12']];
  let y=512;
  for(const [title,d] of items){
    t.push(`<text x="28" y="${y}" font-family="${G}" font-weight="700" font-size="16" fill="${ink}">${title}</text>`);
    t.push(`<text x="362" y="${y}" text-anchor="end" font-family="${M}" font-size="15" fill="${sub}">${d}</text>`);
    t.push(`<line x1="28" y1="${y+22}" x2="362" y2="${y+22}" stroke="${line}"/>`);
    y+=52;
  }
  ['ホーム','記録','タスク','キャリア','設定'].forEach((tab,i)=>{const x=39+i*78;const on=i===0;
    t.push(`<text x="${x}" y="824" text-anchor="middle" font-family="${G}" font-weight="${on?700:400}" font-size="10.5" fill="${on?block:sub}">${tab}</text>`);});
  render(screen(t.join(''), bg), '/tmp/ALT_B.png');
}
