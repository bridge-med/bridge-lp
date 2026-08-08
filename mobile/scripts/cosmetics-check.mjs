import { render } from './mock.mjs';
const BODY='#6FA86A',LEAF_A='#7DB877',LEAF_B='#8AC183',TIP='#9BCB92',EYE='#2C3A28',spark='#E8654E',gold='#E0A640';
const POTS={pot_coral:['#E8654E','#EF7A5E'],pot_sky:['#5B83A6','#739BBD'],pot_wood:['#A9794B','#BE8C5C'],pot_mint:['#7FB8A6','#98C9BA'],pot_gold:['#E0A640','#ECBC63']};

function bg(id){const x=4,y=2,w=92,h=108,r=18;
  if(id==='bg_dawn')return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#FBE0C4"/><rect x="${x}" y="${y+h*0.55}" width="${w}" height="${h*0.45}" rx="${r}" fill="#F6C9A8"/><circle cx="50" cy="40" r="14" fill="#F6A96B"/>`;
  if(id==='bg_meadow')return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#D6ECF5"/><rect x="${x}" y="${y+h*0.6}" width="${w}" height="${h*0.4}" rx="${r}" fill="#CDE6BE"/><circle cx="74" cy="30" r="10" fill="#FBE08A"/>`;
  if(id==='bg_night')return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#3B4A6B"/><circle cx="70" cy="30" r="10" fill="#F4E7B8"/>`+[[24,24],[40,44],[80,60],[30,70],[60,20]].map(([a,b])=>`<circle cx="${a}" cy="${b}" r="1.6" fill="#FFFDF8"/>`).join('');
  if(id==='bg_bloom')return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="#FCE7EF"/>`+[[20,28,'#F2A0C0'],[78,36,'#F6C36B'],[28,64,'#A9D89B'],[76,70,'#F2A0C0']].map(([a,b,c])=>`<circle cx="${a}" cy="${b}" r="4" fill="${c}"/>`).join('');
  return '';
}
function hat(id,cx,top){
  if(id==='hat_straw')return `<ellipse cx="${cx}" cy="${top+1}" rx="20" ry="5" fill="#E0B062"/><path d="M ${cx-11} ${top+1} Q ${cx} ${top-16} ${cx+11} ${top+1} Z" fill="#EAC078"/><ellipse cx="${cx}" cy="${top-2}" rx="11" ry="3" fill="#D9A24E"/>`;
  if(id==='hat_beanie')return `<path d="M ${cx-13} ${top+2} Q ${cx} ${top-18} ${cx+13} ${top+2} Z" fill="#5B83A6"/><rect x="${cx-13}" y="${top-1}" width="26" height="5" rx="2.5" fill="#739BBD"/><circle cx="${cx}" cy="${top-17}" r="3" fill="#FFFDF8"/>`;
  if(id==='hat_ribbon')return `<path d="M ${cx} ${top} l -10 -6 l 0 12 Z" fill="${spark}"/><path d="M ${cx} ${top} l 10 -6 l 0 12 Z" fill="${spark}"/><circle cx="${cx}" cy="${top}" r="3" fill="${spark}"/>`;
  if(id==='hat_flower')return [0,72,144,216,288].map(a=>{const r=a*Math.PI/180,px=cx+Math.cos(r)*5,py=top-4+Math.sin(r)*5;return `<ellipse cx="${px}" cy="${py}" rx="3.5" ry="5" fill="#F2A0C0" transform="rotate(${a} ${px} ${py})"/>`;}).join('')+`<circle cx="${cx}" cy="${top-4}" r="3" fill="${gold}"/>`;
  if(id==='hat_crown')return `<path d="M ${cx-13} ${top+2} L ${cx-13} ${top-8} L ${cx-6} ${top-1} L ${cx} ${top-11} L ${cx+6} ${top-1} L ${cx+13} ${top-8} L ${cx+13} ${top+2} Z" fill="${gold}"/><circle cx="${cx}" cy="${top-9}" r="2" fill="${spark}"/>`;
  return '';
}
function buddy(stage,o){
  const cx=50,cy=74,bodyR=14+Math.min(stage,5)*1.6,bodyCy=cy-16,headTop=bodyCy-bodyR;const[pf,pr]=POTS[o.pot||'pot_coral'];const p=[];
  if(o.bg)p.push(bg(o.bg));
  p.push(`<ellipse cx="${cx}" cy="${cy+36}" rx="26" ry="6" fill="rgba(59,48,38,0.07)"/>`);
  if(stage>=2)p.push(`<path d="M ${cx} ${bodyCy-8} Q ${cx-26} ${bodyCy-24} ${cx-30} ${bodyCy-2} Q ${cx-12} ${bodyCy} ${cx} ${bodyCy-8} Z" fill="${LEAF_A}"/>`);
  if(stage>=3)p.push(`<path d="M ${cx} ${bodyCy-10} Q ${cx+24} ${bodyCy-26} ${cx+30} ${bodyCy-4} Q ${cx+12} ${bodyCy-2} ${cx} ${bodyCy-10} Z" fill="${LEAF_B}"/>`);
  if(stage<=4)p.push(`<path d="M ${cx} ${bodyCy-12} q -4 -16 6 -22 q 4 10 -6 22 Z" fill="${TIP}"/>`);
  p.push(`<circle cx="${cx}" cy="${bodyCy}" r="${bodyR}" fill="${BODY}"/>`);
  p.push(`<circle cx="${cx-bodyR*0.62}" cy="${bodyCy+3}" r="3" fill="rgba(232,101,78,0.35)"/><circle cx="${cx+bodyR*0.62}" cy="${bodyCy+3}" r="3" fill="rgba(232,101,78,0.35)"/>`);
  p.push(`<circle cx="${cx-6}" cy="${bodyCy}" r="2.4" fill="${EYE}"/><circle cx="${cx+6}" cy="${bodyCy}" r="2.4" fill="${EYE}"/>`);
  p.push(`<path d="M ${cx-5} ${bodyCy+7} Q ${cx} ${bodyCy+12} ${cx+5} ${bodyCy+7}" stroke="${EYE}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`);
  if(o.acc==='acc_glasses')p.push(`<g stroke="${EYE}" stroke-width="1.4" fill="none"><circle cx="${cx-6}" cy="${bodyCy}" r="4"/><circle cx="${cx+6}" cy="${bodyCy}" r="4"/><path d="M ${cx-2} ${bodyCy} L ${cx+2} ${bodyCy}"/></g>`);
  if(o.acc==='acc_scarf')p.push(`<rect x="${cx-bodyR}" y="${bodyCy+bodyR-3}" width="${bodyR*2}" height="7" rx="3.5" fill="${spark}"/><path d="M ${cx+bodyR-4} ${bodyCy+bodyR+2} l 6 12 l -7 -2 Z" fill="${spark}"/>`);
  if(o.hat)p.push(hat(o.hat,cx,headTop));
  p.push(`<path d="M ${cx-22} ${cy+4} L ${cx+22} ${cy+4} L ${cx+17} ${cy+30} Q ${cx+15} ${cy+35} ${cx+10} ${cy+35} L ${cx-10} ${cy+35} Q ${cx-15} ${cy+35} ${cx-17} ${cy+30} Z" fill="${pf}"/>`);
  p.push(`<rect x="${cx-25}" y="${cy-2}" width="50" height="9" rx="4.5" fill="${pr}"/>`);
  return p.join('');
}
const looks=[
  ['すなはま',{}],['むぎわら',{hat:'hat_straw'}],['ニット帽',{hat:'hat_beanie'}],['王冠+金鉢',{hat:'hat_crown',pot:'pot_gold'}],
  ['メガネ',{acc:'acc_glasses'}],['マフラー',{acc:'acc_scarf'}],['お花+はなばたけ',{hat:'hat_flower',bg:'bg_bloom'}],['よぞら+リボン',{bg:'bg_night',hat:'hat_ribbon'}],
];
const cols=[];const CW=130;
looks.forEach(([label,o],i)=>{const ox=(i%4)*CW, oy=Math.floor(i/4)*170;
  cols.push(`<g transform="translate(${ox+15},${oy+10})">${buddy(4,o)}</g>`);
  cols.push(`<text x="${ox+15+50}" y="${oy+150}" text-anchor="middle" font-family="Zen Maru Gothic" font-weight="700" font-size="12" fill="#3B3026">${label}</text>`);
});
const W=4*CW+30, H=2*170+10;
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#FBF3E8"/>${cols.join('')}</svg>`;
render(svg,'/tmp/cosmetics.png',W);
