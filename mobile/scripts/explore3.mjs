import { render, screen } from './mock.mjs';
const G = 'Zen Kaku Gothic New', M = 'Shippori Mincho';
const paper='#F4F1E9', ink='#23262E', sub='#8C8678', line='#E4DFD2', acc='#34506E', moss='#4F6A3F', warn='#9C6510';
const GX=76, CX=GX+18;
const t=[];
t.push(`<line x1="${GX}" y1="56" x2="${GX}" y2="800" stroke="${line}"/>`);
// hero
t.push(`<text x="${CX}" y="78" font-family="${G}" font-weight="700" font-size="11" letter-spacing="2" fill="${sub}">RECORD</text>`);
t.push(`<text x="${CX}" y="124" font-family="${M}" font-weight="800" font-size="36" fill="${ink}">記録</text>`);
// chips
const chips=[['すべて',true],['ログ',false],['メモ',false],['タスク',false]];
let cx=CX;
chips.forEach(([l,on])=>{ const w=l.length*15+26;
  t.push(`<rect x="${cx}" y="146" width="${w}" height="30" rx="15" fill="${on?'#E1E5E8':'none'}" stroke="${on?acc:line}"/>`);
  t.push(`<text x="${cx+w/2}" y="166" text-anchor="middle" font-family="${G}" font-weight="500" font-size="12.5" fill="${on?acc:sub}">${l}</text>`);
  cx+=w+8;});
// rows
const rows=[
  ['6.14','仕事ログ',acc,'退院前カンファの段取りを改善','課題発見・現場調整の工夫を記録'],
  ['6.14','クイックメモ',sub,'院長との雑談で在宅連携の話',''],
  ['6.13','タスク完了',moss,'請求の取りまとめを提出',''],
  ['6.12','振り返り',warn,'週次の振り返り','今週やったこと・強みの整理'],
  ['6.12','仕事ログ',acc,'新人OTの初期評価に同席','教育'],
];
let y=232;
for(const [d,kind,tint,title,body] of rows){
  t.push(`<text x="${GX-14}" y="${y}" text-anchor="end" font-family="${M}" font-weight="400" font-size="16" fill="${tint}">${d}</text>`);
  t.push(`<text x="${CX}" y="${y-4}" font-family="${G}" font-weight="500" font-size="11" letter-spacing="1" fill="${tint}">${kind}</text>`);
  t.push(`<text x="${CX}" y="${y+18}" font-family="${G}" font-weight="700" font-size="16" fill="${ink}">${title}</text>`);
  if(body) t.push(`<text x="${CX}" y="${y+39}" font-family="${G}" font-weight="400" font-size="12" fill="${sub}">${body}</text>`);
  const h = body?72:54;
  t.push(`<line x1="${CX}" y1="${y+h-14}" x2="362" y2="${y+h-14}" stroke="${line}"/>`);
  y+=h;
}
// fab
t.push(`<circle cx="334" cy="744" r="29" fill="${acc}"/>`);
t.push(`<text x="334" y="752" text-anchor="middle" font-family="${G}" font-size="24" fill="#fff">✎</text>`);
// tabs
t.push(`<line x1="0" y1="788" x2="390" y2="788" stroke="${line}"/>`);
['ホーム','記録','タスク','ふり返り','設定'].forEach((tab,i)=>{const x=39+i*78;const on=i===1;
  t.push(`<text x="${x}" y="826" text-anchor="middle" font-family="${G}" font-weight="${on?700:400}" font-size="10.5" fill="${on?acc:sub}">${tab}</text>`);});
render(screen(t.join(''), paper), '/tmp/TL.png');
