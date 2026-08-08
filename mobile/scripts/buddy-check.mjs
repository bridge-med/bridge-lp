import { render } from './mock.mjs';
// Mirror of BuddySprite drawing to eyeball the growth stages.
const BODY='#6FA86A',LEAF_A='#7DB877',LEAF_B='#8AC183',TIP='#9BCB92',EYE='#2C3A28',
  POT='#E8654E',POT_RIM='#EF7A5E',spark='#E8654E',gold='#E0A640';

function buddy(stage){
  const cx=50, cy=74, bodyR=14+Math.min(stage,5)*1.6, bodyCy=cy-16; const p=[];
  p.push(`<ellipse cx="${cx}" cy="${cy+36}" rx="26" ry="6" fill="rgba(59,48,38,0.07)"/>`);
  if(stage>=2)p.push(`<path d="M ${cx} ${bodyCy-8} Q ${cx-26} ${bodyCy-24} ${cx-30} ${bodyCy-2} Q ${cx-12} ${bodyCy} ${cx} ${bodyCy-8} Z" fill="${LEAF_A}"/>`);
  if(stage>=3)p.push(`<path d="M ${cx} ${bodyCy-10} Q ${cx+24} ${bodyCy-26} ${cx+30} ${bodyCy-4} Q ${cx+12} ${bodyCy-2} ${cx} ${bodyCy-10} Z" fill="${LEAF_B}"/>`);
  if(stage>=4)p.push(`<path d="M ${cx-6} ${bodyCy-12} Q ${cx-30} ${bodyCy-40} ${cx-16} ${bodyCy-46} Q ${cx-6} ${bodyCy-30} ${cx-6} ${bodyCy-12} Z" fill="${LEAF_B}"/>`);
  if(stage<=4)p.push(`<path d="M ${cx} ${bodyCy-12} q -4 -16 6 -22 q 4 10 -6 22 Z" fill="${TIP}"/>`);
  if(stage===5){p.push(`<path d="M ${cx} ${bodyCy-36} q -7 8 0 18 q 7 -10 0 -18 Z" fill="${spark}"/>`);p.push(`<rect x="${cx-1.5}" y="${bodyCy-20}" width="3" height="12" rx="1.5" fill="${LEAF_A}"/>`);}
  if(stage===6){p.push(`<rect x="${cx-1.5}" y="${bodyCy-22}" width="3" height="14" rx="1.5" fill="${LEAF_A}"/>`);[0,72,144,216,288].forEach(a=>{const r=a*Math.PI/180,px=cx+Math.cos(r)*7,py=bodyCy-30+Math.sin(r)*7;p.push(`<ellipse cx="${px}" cy="${py}" rx="5" ry="7" fill="${spark}" transform="rotate(${a} ${px} ${py})"/>`);});p.push(`<circle cx="${cx}" cy="${bodyCy-30}" r="4" fill="${gold}"/>`);}
  if(stage>=7){p.push(`<path d="M ${cx} ${bodyCy-12} Q ${cx+26} ${bodyCy-30} ${cx+30} ${bodyCy-6} Q ${cx+12} ${bodyCy-4} ${cx} ${bodyCy-12} Z" fill="${LEAF_B}"/>`);p.push(`<circle cx="${cx-10}" cy="${bodyCy-30}" r="5" fill="${gold}"/><circle cx="${cx+8}" cy="${bodyCy-34}" r="5" fill="${spark}"/><circle cx="${cx+2}" cy="${bodyCy-26}" r="4.5" fill="${gold}"/>`);}
  p.push(`<circle cx="${cx}" cy="${bodyCy}" r="${bodyR}" fill="${BODY}"/>`);
  p.push(`<circle cx="${cx-bodyR*0.62}" cy="${bodyCy+3}" r="3" fill="rgba(232,101,78,0.35)"/><circle cx="${cx+bodyR*0.62}" cy="${bodyCy+3}" r="3" fill="rgba(232,101,78,0.35)"/>`);
  p.push(`<circle cx="${cx-6}" cy="${bodyCy}" r="2.4" fill="${EYE}"/><circle cx="${cx+6}" cy="${bodyCy}" r="2.4" fill="${EYE}"/>`);
  p.push(`<path d="M ${cx-5} ${bodyCy+7} Q ${cx} ${bodyCy+12} ${cx+5} ${bodyCy+7}" stroke="${EYE}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`);
  p.push(`<path d="M ${cx-22} ${cy+4} L ${cx+22} ${cy+4} L ${cx+17} ${cy+30} Q ${cx+15} ${cy+35} ${cx+10} ${cy+35} L ${cx-10} ${cy+35} Q ${cx-15} ${cy+35} ${cx-17} ${cy+30} Z" fill="${POT}"/>`);
  p.push(`<rect x="${cx-25}" y="${cy-2}" width="50" height="9" rx="4.5" fill="${POT_RIM}"/>`);
  return p.join('');
}
const cols=[];
const labels=['たね','め','ふたば','わかば','つぼみ','はな','みのり'];
for(let s=1;s<=7;s++){const ox=(s-1)*110;
  cols.push(`<g transform="translate(${ox},10) scale(1.0)">${buddy(s)}</g>`);
  cols.push(`<text x="${ox+50}" y="135" text-anchor="middle" font-family="Zen Maru Gothic" font-weight="700" font-size="13" fill="#3B3026">Lv${[1,3,7,13,21,31,43][s-1]} ${labels[s-1]}</text>`);
}
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="770" height="150" viewBox="0 0 770 150"><rect width="770" height="150" fill="#FBF3E8"/>${cols.join('')}</svg>`;
render(svg,'/tmp/buddy_stages.png',770);
