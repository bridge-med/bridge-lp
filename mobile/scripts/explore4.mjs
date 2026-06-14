import { render, screen } from './mock.mjs';
const G = 'Zen Kaku Gothic New', M = 'Shippori Mincho';
const paper='#F4F1E9', ink='#23262E', sub='#8C8678', line='#E4DFD2', faint='#CFC9BA', acc='#34506E';
const LX=24, RX=366;
const t=[];
// top bar
t.push(`<text x="${LX}" y="64" font-family="${G}" font-size="22" fill="${ink}">‹</text>`);
t.push(`<text x="${LX+30}" y="60" font-family="${G}" font-weight="700" font-size="11" letter-spacing="2" fill="${sub}">NEW LOG</text>`);
// hero
t.push(`<text x="${LX}" y="116" font-family="${M}" font-weight="600" font-size="26" fill="${acc}">日</text>`);
t.push(`<text x="${LX+42}" y="122" font-family="${M}" font-weight="800" font-size="40" fill="${ink}">6月14日</text>`);
t.push(`<text x="${RX}" y="116" text-anchor="end" font-family="${G}" font-size="12" fill="${acc}">今日にする</text>`);
// title input
t.push(`<text x="${LX}" y="168" font-family="${G}" font-weight="700" font-size="22" fill="${ink}">退院前カンファの段取りを改善</text>`);
t.push(`<line x1="${LX}" y1="190" x2="${RX}" y2="190" stroke="${line}"/>`);
// notes
const notes=[
  ['今日やったこと','多職種カンファの議題テンプレを作り、事前共有の流れに変えた',true],
  ['困ったこと','情報が当日に集まり、議論が表面的になりがちだった',true],
  ['工夫したこと','前日までに各職種が記入するシートを用意',true],
  ['自分の判断','—',false],
  ['誰と関わったか','病棟師長・MSW・リハ科',true],
  ['結果','—',false],
];
let y=224;
for(const [label,val,filled] of notes){
  t.push(`<text x="${LX}" y="${y}" font-family="${G}" font-weight="700" font-size="11" letter-spacing="1" fill="${filled?acc:sub}">${label}</text>`);
  t.push(`<text x="${LX}" y="${y+26}" font-family="${G}" font-size="16" fill="${filled?ink:faint}">${val}</text>`);
  t.push(`<line x1="${LX}" y1="${y+40}" x2="${RX}" y2="${y+40}" stroke="${line}"/>`);
  y+=64;
}
// tags
t.push(`<text x="${LX}" y="${y+12}" font-family="${G}" font-weight="700" font-size="11" letter-spacing="1" fill="${sub}">タグ</text>`);
const tg=['課題発見','業務改善','チーム連携'];
let tx=LX, ty=y+26;
tg.forEach(tag=>{const w=tag.length*15+24;
  t.push(`<rect x="${tx}" y="${ty}" width="${w}" height="30" rx="15" fill="#E1E5E8" stroke="${acc}"/>`);
  t.push(`<text x="${tx+w/2}" y="${ty+20}" text-anchor="middle" font-family="${G}" font-size="12.5" fill="${acc}">${tag}</text>`);
  tx+=w+8;});
// save
const sy=ty+58;
t.push(`<rect x="${LX}" y="${sy}" width="${RX-LX}" height="52" rx="12" fill="${ink}"/>`);
t.push(`<text x="195" y="${sy+33}" text-anchor="middle" font-family="${G}" font-weight="700" font-size="15" fill="#fff">保存する</text>`);
render(screen(t.join(''), paper), '/tmp/LE.png');
