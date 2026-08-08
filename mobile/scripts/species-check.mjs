import { render } from './mock.mjs';
const BODY='#6FA86A',LEAF_A='#7DB877',LEAF_B='#8AC183',EYE='#2C3A28',POT='#E8654E',POT_RIM='#EF7A5E';
function ring(n,r){const o=[];for(let i=0;i<n;i++){const a=i/n*360,rad=a*Math.PI/180;o.push([Math.cos(rad)*r,Math.sin(rad)*r,a]);}return o;}
function petals(id){
  if(id==='species_sunflower')return ring(12,9).map(([x,y,a])=>`<ellipse cx="${x}" cy="${y}" rx="3" ry="6" fill="#F2B73B" transform="rotate(${a} ${x} ${y})"/>`).join('')+`<circle r="5.5" fill="#7A4B25"/>`;
  if(id==='species_cosmos')return ring(8,9).map(([x,y,a])=>`<ellipse cx="${x}" cy="${y}" rx="4" ry="6.5" fill="#EE92B6" transform="rotate(${a} ${x} ${y})"/>`).join('')+`<circle r="4" fill="#F2C84B"/>`;
  if(id==='species_sakura')return ring(5,8).map(([x,y,a])=>`<ellipse cx="${x}" cy="${y}" rx="4.5" ry="6" fill="#F8C5D6" transform="rotate(${a} ${x} ${y})"/>`).join('')+`<circle r="3" fill="#E58AAE"/>`;
  if(id==='species_rose')return `<circle r="9" fill="#C0344B"/><circle r="6" fill="#D8556B"/><circle r="3" fill="#E8859A"/><path d="M -9 2 q -8 4 -12 -2 q 6 -2 12 -2 Z" fill="#6FA86A"/>`;
  if(id==='species_tulip')return `<path d="M -7 4 Q -8 -10 0 -10 Q 8 -10 7 4 Z" fill="#E0563F"/><path d="M -7 4 Q -3 -8 0 4 Z" fill="#EC6E58"/><path d="M 7 4 Q 3 -8 0 4 Z" fill="#EC6E58"/>`;
  if(id==='species_lavender')return [0,1,2,3,4].map(i=>`<ellipse cx="${i%2?3:-3}" cy="${-4-i*5}" rx="3.5" ry="4" fill="#9E7BC0"/>`).join('')+`<ellipse cx="0" cy="-30" rx="3" ry="4" fill="#B295D4"/>`;
  if(id==='species_hydrangea')return [[-6,-2],[6,-2],[0,-8],[-6,6],[6,6],[0,2],[0,12]].map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="4" fill="${i%2?'#8FA8DD':'#A98FD0'}"/>`).join('');
  return '';
}
function buddy(species,stage){
  const cx=50,cy=74,bodyR=14+Math.min(stage,5)*1.6,bodyCy=cy-16,headTop=bodyCy-bodyR;const p=[];
  p.push(`<ellipse cx="${cx}" cy="${cy+36}" rx="26" ry="6" fill="rgba(59,48,38,0.07)"/>`);
  if(stage>=2)p.push(`<path d="M ${cx} ${bodyCy-8} Q ${cx-26} ${bodyCy-24} ${cx-30} ${bodyCy-2} Q ${cx-12} ${bodyCy} ${cx} ${bodyCy-8} Z" fill="${LEAF_A}"/>`);
  if(stage>=3)p.push(`<path d="M ${cx} ${bodyCy-10} Q ${cx+24} ${bodyCy-26} ${cx+30} ${bodyCy-4} Q ${cx+12} ${bodyCy-2} ${cx} ${bodyCy-10} Z" fill="${LEAF_B}"/>`);
  // species flower
  const sc=0.78+Math.min(stage,7)*0.045, fy=headTop-11-Math.min(stage,7);
  p.push(`<rect x="${cx-1.6}" y="${fy}" width="3.2" height="${headTop-fy+4}" rx="1.6" fill="#5E9357"/>`);
  p.push(`<g transform="translate(${cx} ${fy}) scale(${sc})">${petals(species)}</g>`);
  p.push(`<circle cx="${cx}" cy="${bodyCy}" r="${bodyR}" fill="${BODY}"/>`);
  p.push(`<circle cx="${cx-bodyR*0.62}" cy="${bodyCy+3}" r="3" fill="rgba(232,101,78,0.35)"/><circle cx="${cx+bodyR*0.62}" cy="${bodyCy+3}" r="3" fill="rgba(232,101,78,0.35)"/>`);
  p.push(`<circle cx="${cx-6}" cy="${bodyCy}" r="2.4" fill="${EYE}"/><circle cx="${cx+6}" cy="${bodyCy}" r="2.4" fill="${EYE}"/>`);
  p.push(`<path d="M ${cx-5} ${bodyCy+7} Q ${cx} ${bodyCy+12} ${cx+5} ${bodyCy+7}" stroke="${EYE}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`);
  p.push(`<path d="M ${cx-22} ${cy+4} L ${cx+22} ${cy+4} L ${cx+17} ${cy+30} Q ${cx+15} ${cy+35} ${cx+10} ${cy+35} L ${cx-10} ${cy+35} Q ${cx-15} ${cy+35} ${cx-17} ${cy+30} Z" fill="${POT}"/>`);
  p.push(`<rect x="${cx-25}" y="${cy-2}" width="50" height="9" rx="4.5" fill="${POT_RIM}"/>`);
  return p.join('');
}
const sp=[['向日葵','species_sunflower'],['チューリップ','species_tulip'],['コスモス','species_cosmos'],['紫陽花','species_hydrangea'],['ラベンダー','species_lavender'],['桜','species_sakura'],['薔薇','species_rose']];
const cols=[];const CW=130;
sp.forEach(([label,id],i)=>{const ox=(i%4)*CW, oy=Math.floor(i/4)*175;
  cols.push(`<g transform="translate(${ox+15},${oy+18})">${buddy(id,6)}</g>`);
  cols.push(`<text x="${ox+15+50}" y="${oy+158}" text-anchor="middle" font-family="Zen Maru Gothic" font-weight="700" font-size="13" fill="#3B3026">${label}</text>`);
});
const W=4*CW+30,H=2*175+20;
render(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><rect width="${W}" height="${H}" fill="#FBF3E8"/>${cols.join('')}</svg>`,'/tmp/species.png',W);
