import { render, screen } from './mock.mjs';
const G = 'Zen Kaku Gothic New', GM = 'Zen Maru Gothic', M = 'Shippori Mincho';

// ---- WARM "BUDDY + REWARD" palette ----
const paper = '#FBF3E8';   // warm cream
const ink   = '#3B3026';   // warm dark brown
const sub    = '#9A8A74';  // muted clay
const line   = '#ECDFC C'.replace(' ','') || '#ECDFCC';
const lineC  = '#EADDC9';
const amber  = '#E8833C';  // primary warm accent
const amberW = '#FBE6D2';  // amber wash
const leaf   = '#6FA86A';  // growth green
const leafW  = '#E2EFDC';
const coral  = '#E8654E';  // spark / celebrate
const cream  = '#FFFDF8';  // surface
const gold    = '#E0A640'; // coin / reward

// rounded "sprout buddy" — a friendly companion that grows with your logs
function sprout(cx, cy, s = 1, happy = true) {
  const p = [];
  // soft ground shadow
  p.push(`<ellipse cx="${cx}" cy="${cy + 36 * s}" rx="${42 * s}" ry="${9 * s}" fill="rgba(59,48,38,0.06)"/>`);
  // pot
  p.push(`<path d="M ${cx - 30 * s} ${cy + 6 * s} L ${cx + 30 * s} ${cy + 6 * s} L ${cx + 24 * s} ${cy + 34 * s} Q ${cx + 22 * s} ${cy + 40 * s} ${cx + 16 * s} ${cy + 40 * s} L ${cx - 16 * s} ${cy + 40 * s} Q ${cx - 22 * s} ${cy + 40 * s} ${cx - 24 * s} ${cy + 34 * s} Z" fill="${coral}"/>`);
  p.push(`<rect x="${cx - 34 * s}" y="${cy - 2 * s}" width="${68 * s}" height="${12 * s}" rx="${6 * s}" fill="#EF7A5E"/>`);
  // body (the buddy) — rounded blob
  p.push(`<circle cx="${cx}" cy="${cy - 18 * s}" r="${26 * s}" fill="${leaf}"/>`);
  // leaves
  p.push(`<path d="M ${cx} ${cy - 30 * s} Q ${cx - 34 * s} ${cy - 50 * s} ${cx - 40 * s} ${cy - 24 * s} Q ${cx - 18 * s} ${cy - 22 * s} ${cx} ${cy - 30 * s} Z" fill="#7DB877"/>`);
  p.push(`<path d="M ${cx} ${cy - 34 * s} Q ${cx + 30 * s} ${cy - 58 * s} ${cx + 40 * s} ${cy - 30 * s} Q ${cx + 18 * s} ${cy - 26 * s} ${cx} ${cy - 34 * s} Z" fill="#8AC183"/>`);
  // sprout tip
  p.push(`<path d="M ${cx} ${cy - 40 * s} q ${-4 * s} ${-16 * s} ${6 * s} ${-22 * s} q ${4 * s} ${10 * s} ${-6 * s} ${22 * s} Z" fill="#9BCB92"/>`);
  // face
  p.push(`<circle cx="${cx - 9 * s}" cy="${cy - 18 * s}" r="${2.6 * s}" fill="#2C3A28"/>`);
  p.push(`<circle cx="${cx + 9 * s}" cy="${cy - 18 * s}" r="${2.6 * s}" fill="#2C3A28"/>`);
  if (happy) p.push(`<path d="M ${cx - 6 * s} ${cy - 10 * s} Q ${cx} ${cy - 5 * s} ${cx + 6 * s} ${cy - 10 * s}" stroke="#2C3A28" stroke-width="${1.8 * s}" fill="none" stroke-linecap="round"/>`);
  // cheeks
  p.push(`<circle cx="${cx - 16 * s}" cy="${cy - 12 * s}" r="${3 * s}" fill="rgba(232,101,78,0.35)"/>`);
  p.push(`<circle cx="${cx + 16 * s}" cy="${cy - 12 * s}" r="${3 * s}" fill="rgba(232,101,78,0.35)"/>`);
  return p.join('');
}
function flame(x, y, s = 1) {
  return `<path d="M ${x} ${y} q ${-6 * s} ${-6 * s} ${-2 * s} ${-13 * s} q ${5 * s} ${4 * s} ${4 * s} ${-2 * s} q ${4 * s} ${4 * s} ${4 * s} ${10 * s} q 0 ${7 * s} ${-6 * s} ${7 * s} q ${-6 * s} 0 ${-4 * s} ${-9 * s} Z" fill="${amber}"/>`;
}
function tab(t, names, active) {
  return names.map((nm, i) => { const x = 39 + i * 78; const on = i === active;
    return `<text x="${x}" y="824" text-anchor="middle" font-family="${GM}" font-weight="${on ? 700 : 400}" font-size="10.5" fill="${on ? amber : sub}">${nm}</text>`;
  }).join('') + `<line x1="0" y1="788" x2="390" y2="788" stroke="${lineC}"/>` +
  `<rect x="${39 + active * 78 - 16}" y="780" width="32" height="3" rx="1.5" fill="${amber}"/>`;
}

// ============ CONCEPT A — Companion home ============
{
  const t = [];
  // soft rounded warm header
  t.push(`<path d="M0 0 H390 V196 Q390 224 362 224 H28 Q0 224 0 196 Z" fill="${amberW}"/>`);
  t.push(`<text x="24" y="64" font-family="${G}" font-weight="700" font-size="11" letter-spacing="2" fill="${amber}">BRIDGE WORKLOG</text>`);
  // coin reward pill
  t.push(`<rect x="286" y="48" width="80" height="32" rx="16" fill="${cream}" stroke="${lineC}"/>`);
  t.push(`<circle cx="306" cy="64" r="7" fill="${gold}"/><text x="306" y="68" text-anchor="middle" font-family="${GM}" font-weight="700" font-size="9" fill="#fff">¢</text>`);
  t.push(`<text x="320" y="69" font-family="${GM}" font-weight="700" font-size="14" fill="${ink}">3</text>`);
  // greeting + buddy
  t.push(`<text x="24" y="104" font-family="${GM}" font-weight="700" font-size="24" fill="${ink}">おかえりなさい</text>`);
  t.push(`<text x="24" y="132" font-family="${G}" font-size="13" fill="${sub}">6月14日 日曜 — きょうもおつかれさま</text>`);
  t.push(sprout(322, 150, 1.0));
  // speech bubble (milestone tease)
  t.push(`<rect x="24" y="150" width="226" height="50" rx="14" fill="${cream}" stroke="${lineC}"/>`);
  t.push(`<path d="M250 176 l12 6 l-12 6 Z" fill="${cream}"/>`);
  t.push(`<text x="40" y="172" font-family="${GM}" font-weight="700" font-size="13" fill="${leaf}">あと2回で「継続の芽」</text>`);
  t.push(`<text x="40" y="190" font-family="${G}" font-size="11" fill="${sub}">ログを書くと、ぼくが育つよ</text>`);

  let y = 256;
  // streak strip
  t.push(`<rect x="24" y="${y}" width="342" height="58" rx="18" fill="${cream}" stroke="${lineC}"/>`);
  t.push(flame(54, 308, 1.4));
  t.push(`<text x="78" y="${y + 26}" font-family="${GM}" font-weight="700" font-size="16" fill="${ink}">7日連続</text>`);
  t.push(`<text x="78" y="${y + 45}" font-family="${G}" font-size="11" fill="${sub}">いい流れ！今日でつなげよう</text>`);
  // mini week dots
  ['月','火','水','木','金','土','日'].forEach((d,i)=>{const x=232+i*19;const done=i<6;
    t.push(`<circle cx="${x}" cy="${y+22}" r="7" fill="${done?amber:'none'}" stroke="${done?amber:lineC}"/>`);
    if(done) t.push(`<text x="${x}" y="${y+26}" text-anchor="middle" font-family="${G}" font-size="8" fill="#fff">✓</text>`);
    t.push(`<text x="${x}" y="${y+44}" text-anchor="middle" font-family="${G}" font-size="8" fill="${sub}">${d}</text>`);
  });

  // BIG CTA
  y += 76;
  t.push(`<rect x="24" y="${y}" width="342" height="92" rx="22" fill="${amber}"/>`);
  t.push(`<circle cx="66" cy="${y + 46}" r="24" fill="rgba(255,255,255,0.22)"/>`);
  t.push(`<text x="66" y="${y + 54}" text-anchor="middle" font-family="${GM}" font-weight="700" font-size="26" fill="#fff">＋</text>`);
  t.push(`<text x="104" y="${y + 40}" font-family="${GM}" font-weight="700" font-size="19" fill="#fff">きょうのログを書く</text>`);
  t.push(`<text x="104" y="${y + 64}" font-family="${G}" font-size="12" fill="rgba(255,255,255,0.9)">出来事・判断・学びを、ひとつだけでも</text>`);
  t.push(`<text x="344" y="${y + 52}" text-anchor="end" font-family="${G}" font-size="22" fill="#fff">→</text>`);

  // quick tiles
  y += 110;
  const tiles=[['さっとメモ',leafW,leaf],['ふりかえり',amberW,amber]];
  tiles.forEach(([lab,bg,fg],i)=>{const x=24+i*176;
    t.push(`<rect x="${x}" y="${y}" width="166" height="64" rx="18" fill="${bg}"/>`);
    t.push(`<circle cx="${x+30}" cy="${y+32}" r="13" fill="${cream}"/>`);
    t.push(`<text x="${x+30}" y="${y+37}" text-anchor="middle" font-family="${GM}" font-weight="700" font-size="14" fill="${fg}">${i?'↻':'✎'}</text>`);
    t.push(`<text x="${x+52}" y="${y+38}" font-family="${GM}" font-weight="700" font-size="14" fill="${ink}">${lab}</text>`);
  });

  // recent
  y += 90;
  t.push(`<text x="24" y="${y}" font-family="${GM}" font-weight="700" font-size="13" fill="${ink}">最近のログ</text>`);
  t.push(`<text x="366" y="${y}" text-anchor="end" font-family="${G}" font-size="12" fill="${amber}">すべて →</text>`);
  y += 18;
  const items=[['退院前カンファの段取りを改善','課題発見','6.13',leaf],['新人OTの初期評価に同席','教育','6.12',amber]];
  for(const [title,tag,d,clr] of items){
    t.push(`<rect x="24" y="${y}" width="342" height="62" rx="16" fill="${cream}" stroke="${lineC}"/>`);
    t.push(`<rect x="24" y="${y}" width="5" height="62" rx="2.5" fill="${clr}"/>`);
    t.push(`<text x="42" y="${y+27}" font-family="${GM}" font-weight="700" font-size="15" fill="${ink}">${title}</text>`);
    t.push(`<rect x="42" y="${y+36}" width="${tag.length*12+18}" height="20" rx="10" fill="${clr==leaf?leafW:amberW}"/>`);
    t.push(`<text x="${42+ (tag.length*12+18)/2}" y="${y+50}" text-anchor="middle" font-family="${G}" font-size="11" fill="${clr}">${tag}</text>`);
    t.push(`<text x="348" y="${y+50}" text-anchor="end" font-family="${M}" font-size="15" fill="${sub}">${d}</text>`);
    y += 72;
  }

  t.push(tab(t, ['ホーム','記録','タスク','そだち','設定'], 0));
  render(screen(t.join(''), paper), '/tmp/A_HOME.png');
}

// ============ CONCEPT B — Reward / milestone dashboard ============
{
  const t = [];
  t.push(`<text x="24" y="68" font-family="${GM}" font-weight="700" font-size="22" fill="${ink}">そだち</text>`);
  t.push(`<text x="24" y="92" font-family="${G}" font-size="12" fill="${sub}">あなたの記録が、相棒とキャリアを育てる</text>`);
  t.push(`<rect x="286" y="50" width="80" height="32" rx="16" fill="${amberW}"/>`);
  t.push(`<circle cx="306" cy="66" r="7" fill="${gold}"/><text x="320" y="71" font-family="${GM}" font-weight="700" font-size="14" fill="${ink}">3</text>`);

  // hero card — buddy + level + progress ring
  let y = 110;
  t.push(`<rect x="24" y="${y}" width="342" height="200" rx="26" fill="${leafW}"/>`);
  t.push(sprout(110, y + 96, 1.5));
  // level + ring
  const rx=292, ry=y+96, R=44;
  t.push(`<circle cx="${rx}" cy="${ry}" r="${R}" fill="none" stroke="rgba(59,48,38,0.10)" stroke-width="9"/>`);
  // 70% arc
  const frac=0.7, a0=-Math.PI/2, a1=a0+frac*2*Math.PI;
  const x0=rx+R*Math.cos(a0), y0=ry+R*Math.sin(a0), x1=rx+R*Math.cos(a1), y1=ry+R*Math.sin(a1);
  t.push(`<path d="M ${x0.toFixed(1)} ${y0.toFixed(1)} A ${R} ${R} 0 ${frac>0.5?1:0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" stroke="${amber}" stroke-width="9" fill="none" stroke-linecap="round"/>`);
  t.push(`<text x="${rx}" y="${ry-2}" text-anchor="middle" font-family="${GM}" font-weight="700" font-size="26" fill="${ink}">Lv.4</text>`);
  t.push(`<text x="${rx}" y="${ry+18}" text-anchor="middle" font-family="${G}" font-size="11" fill="${sub}">あと2ログ</text>`);
  t.push(`<text x="180" y="${y+44}" font-family="${GM}" font-weight="700" font-size="17" fill="${ink}">継続の芽</text>`);
  t.push(`<text x="180" y="${y+66}" font-family="${G}" font-size="12" fill="${sub}">次は「ふたば」へ</text>`);
  t.push(`<rect x="180" y="${y+150}" width="120" height="2" rx="1" fill="none"/>`);

  // badges row
  y += 222;
  t.push(`<text x="24" y="${y}" font-family="${GM}" font-weight="700" font-size="14" fill="${ink}">獲得した称号</text>`);
  y += 16;
  const badges=[['初めの一歩',amber,true],['3日連続',leaf,true],['週次ふりかえり',gold,true],['??',sub,false]];
  badges.forEach(([lab,clr,got],i)=>{const x=24+i*86;
    t.push(`<rect x="${x}" y="${y}" width="78" height="92" rx="18" fill="${got?cream:'#F3EBDD'}" stroke="${lineC}"/>`);
    t.push(`<circle cx="${x+39}" cy="${y+34}" r="20" fill="${got?clr:'#E6DAC6'}"/>`);
    t.push(`<text x="${x+39}" y="${y+41}" text-anchor="middle" font-family="${GM}" font-weight="700" font-size="18" fill="#fff">${got?'★':'?'}</text>`);
    t.push(`<text x="${x+39}" y="${y+72}" text-anchor="middle" font-family="${G}" font-size="9.5" fill="${got?ink:sub}">${lab}</text>`);
  });

  // next reward
  y += 116;
  t.push(`<rect x="24" y="${y}" width="342" height="74" rx="20" fill="${amberW}"/>`);
  t.push(`<circle cx="62" cy="${y+37}" r="20" fill="${gold}"/><text x="62" y="${y+43}" text-anchor="middle" font-family="${GM}" font-weight="700" font-size="16" fill="#fff">＋1</text>`);
  t.push(`<text x="96" y="${y+32}" font-family="${GM}" font-weight="700" font-size="15" fill="${ink}">次の節目でコイン1枚プレゼント</text>`);
  t.push(`<text x="96" y="${y+54}" font-family="${G}" font-size="12" fill="${sub}">10ログ達成まで、あと2つ</text>`);

  t.push(tab(t, ['ホーム','記録','タスク','そだち','設定'], 3));
  render(screen(t.join(''), paper), '/tmp/B_GROW.png');
}

// ============ CONCEPT C — Celebration moment (after writing a log) ============
{
  const t = [];
  t.push(`<rect width="390" height="844" fill="${ink}" opacity="0.0"/>`);
  // confetti
  const conf=[[60,120,coral],[110,90,amber],[180,70,leaf],[250,95,gold],[320,130,coral],[90,180,amber],[300,200,leaf],[40,240,gold],[350,260,amber],[150,150,coral]];
  conf.forEach(([x,y,c],i)=>{ if(i%2) t.push(`<rect x="${x}" y="${y}" width="9" height="9" rx="2" transform="rotate(${i*36} ${x} ${y})" fill="${c}"/>`); else t.push(`<circle cx="${x}" cy="${y}" r="5" fill="${c}"/>`);});
  // card
  t.push(`<rect x="40" y="220" width="310" height="404" rx="30" fill="${cream}" stroke="${lineC}"/>`);
  t.push(sprout(195, 330, 1.7));
  // sparkle
  t.push(`<text x="250" y="290" font-family="${GM}" font-weight="700" font-size="22" fill="${gold}">✦</text>`);
  t.push(`<text x="138" y="300" font-family="${GM}" font-weight="700" font-size="16" fill="${amber}">✦</text>`);
  t.push(`<text x="195" y="420" text-anchor="middle" font-family="${GM}" font-weight="700" font-size="24" fill="${ink}">7日連続、達成！</text>`);
  t.push(`<text x="195" y="450" text-anchor="middle" font-family="${G}" font-size="13" fill="${sub}">きょうも記録できました。えらい。</text>`);
  // reward chips
  t.push(`<rect x="78" y="480" width="110" height="40" rx="20" fill="${amberW}"/>`);
  t.push(`<circle cx="104" cy="500" r="9" fill="${gold}"/><text x="120" y="505" font-family="${GM}" font-weight="700" font-size="14" fill="${ink}">+1 コイン</text>`);
  t.push(`<rect x="200" y="480" width="112" height="40" rx="20" fill="${leafW}"/>`);
  t.push(`<text x="256" y="505" text-anchor="middle" font-family="${GM}" font-weight="700" font-size="13" fill="${leaf}">称号「継続の芽」</text>`);
  // button
  t.push(`<rect x="78" y="556" width="234" height="50" rx="25" fill="${amber}"/>`);
  t.push(`<text x="195" y="587" text-anchor="middle" font-family="${GM}" font-weight="700" font-size="16" fill="#fff">やったね！</text>`);
  render(screen(t.join(''), paper), '/tmp/C_CELEBRATE.png');
}
