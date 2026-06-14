import { render, screen } from './mock.mjs';
const G = 'Zen Kaku Gothic New', M = 'Shippori Mincho';
const paper='#F4F1E9', ink='#23262E', sub='#8C8678', line='#E4DFD2', acc='#34506E', spark='#C75B39', onAcc='#F5F2EA', surf='#FCFBF7';

// HOME — Bold Block
{
  const t=[];
  const BH=212;
  t.push(`<rect x="0" y="0" width="390" height="${BH}" fill="${acc}"/>`);
  t.push(`<text x="24" y="86" font-family="${G}" font-weight="700" font-size="11" letter-spacing="3" fill="rgba(245,242,234,0.62)">BRIDGE WORKLOG</text>`);
  t.push(`<text x="24" y="146" font-family="${M}" font-weight="800" font-size="50" fill="${onAcc}">6.14</text>`);
  t.push(`<text x="24" y="180" font-family="${G}" font-weight="500" font-size="14" fill="rgba(245,242,234,0.85)">日曜日 — 理学療法士のきょう</text>`);
  // coin pill
  t.push(`<rect x="300" y="58" width="66" height="30" rx="15" fill="rgba(245,242,234,0.16)"/>`);
  t.push(`<circle cx="318" cy="73" r="6" fill="none" stroke="${onAcc}" stroke-width="1.4"/>`);
  t.push(`<text x="332" y="78" font-family="${G}" font-weight="700" font-size="13" fill="${onAcc}">5</text>`);
  // overlap card
  t.push(`<rect x="24" y="${BH-26}" width="342" height="92" rx="16" fill="${surf}" stroke="${line}"/>`);
  t.push(`<rect x="44" y="${BH+0}" width="46" height="46" rx="14" fill="${spark}"/>`);
  t.push(`<text x="106" y="${BH+12}" font-family="${G}" font-weight="700" font-size="17" fill="${ink}">仕事ログを書く</text>`);
  t.push(`<text x="106" y="${BH+34}" font-family="${G}" font-size="12" fill="${sub}">今日の出来事・判断・学び</text>`);
  t.push(`<text x="346" y="${BH+18}" text-anchor="end" font-family="${G}" font-size="18" fill="${acc}">→</text>`);
  // tiles
  let y=BH+90;
  t.push(`<rect x="24" y="${y}" width="165" height="50" rx="12" fill="none" stroke="${line}"/>`);
  t.push(`<text x="44" y="${y+31}" font-family="${G}" font-weight="500" font-size="14" fill="${ink}">クイックメモ</text>`);
  t.push(`<rect x="201" y="${y}" width="165" height="50" rx="12" fill="none" stroke="${line}"/>`);
  t.push(`<text x="221" y="${y+31}" font-family="${G}" font-weight="500" font-size="14" fill="${ink}">今週をふりかえる</text>`);
  // stats
  y+=92;
  t.push(`<text x="24" y="${y}" font-family="${M}" font-weight="800" font-size="40" fill="${ink}">3</text>`);
  t.push(`<text x="24" y="${y+20}" font-family="${G}" font-size="12" fill="${sub}">未完了</text>`);
  t.push(`<text x="154" y="${y}" font-family="${M}" font-weight="800" font-size="40" fill="${spark}">5</text>`);
  t.push(`<text x="154" y="${y+20}" font-family="${G}" font-size="12" fill="${sub}">今週ログ</text>`);
  t.push(`<text x="284" y="${y}" font-family="${M}" font-weight="800" font-size="40" fill="${ink}">›</text>`);
  t.push(`<text x="284" y="${y+20}" font-family="${G}" font-size="12" fill="${sub}">キャリア</text>`);
  y+=44;
  t.push(`<line x1="24" y1="${y}" x2="366" y2="${y}" stroke="${line}"/>`);
  y+=34;
  t.push(`<text x="24" y="${y}" font-family="${G}" font-weight="700" font-size="11" letter-spacing="2" fill="${sub}">最近のログ</text>`);
  const items=[['退院前カンファの段取りを改善','課題発見・現場調整','6.13'],['新人OTの初期評価に同席','教育','6.12']];
  y+=28;
  for(const [title,tag,d] of items){
    t.push(`<text x="24" y="${y}" font-family="${G}" font-weight="700" font-size="16" fill="${ink}">${title}</text>`);
    t.push(`<text x="366" y="${y}" text-anchor="end" font-family="${M}" font-size="15" fill="${sub}">${d}</text>`);
    t.push(`<text x="24" y="${y+20}" font-family="${G}" font-size="12" fill="${sub}">${tag}</text>`);
    t.push(`<line x1="24" y1="${y+38}" x2="366" y2="${y+38}" stroke="${line}"/>`);
    y+=60;
  }
  t.push(`<line x1="0" y1="788" x2="390" y2="788" stroke="${line}"/>`);
  ['ホーム','記録','タスク','キャリア','設定'].forEach((tab,i)=>{const x=39+i*78;const on=i===0;
    t.push(`<text x="${x}" y="826" text-anchor="middle" font-family="${G}" font-weight="${on?700:400}" font-size="10.5" fill="${on?acc:sub}">${tab}</text>`);});
  render(screen(t.join(''), paper), '/tmp/HOME_BB.png');
}

// COINS
{
  const t=[];
  t.push(`<text x="24" y="60" font-family="${G}" font-size="22" fill="${ink}">‹</text>`);
  t.push(`<text x="195" y="60" text-anchor="middle" font-family="${G}" font-weight="700" font-size="16" fill="${ink}">コイン</text>`);
  t.push(`<circle cx="158" cy="118" r="11" fill="none" stroke="${acc}" stroke-width="2"/>`);
  t.push(`<text x="178" y="140" font-family="${M}" font-weight="800" font-size="56" fill="${ink}">5</text>`);
  t.push(`<text x="232" y="140" font-family="${G}" font-size="14" fill="${sub}">コイン</text>`);
  t.push(`<text x="195" y="172" text-anchor="middle" font-family="${G}" font-size="13" fill="${sub}">生成1回につき 1コイン（キー登録なら無料）</text>`);
  t.push(`<text x="24" y="212" font-family="${G}" font-weight="700" font-size="11" letter-spacing="2" fill="${sub}">コインを買う</text>`);
  const packs=[['10','コイン','¥240','24円/回',false],['30','コイン','¥600','20円/回',true],['100','コイン','¥1,600','16円/回',false]];
  let y=228;
  for(const [n,unit,price,per,best] of packs){
    t.push(`<rect x="24" y="${y}" width="342" height="80" rx="12" fill="${surf}" stroke="${best?acc:line}" stroke-width="${best?1.4:1}"/>`);
    t.push(`<text x="44" y="${y+42}" font-family="${M}" font-weight="600" font-size="26" fill="${ink}">${n}</text>`);
    t.push(`<text x="${44+n.length*16+6}" y="${y+42}" font-family="${G}" font-size="12" fill="${sub}">${unit}</text>`);
    if(best) t.push(`<rect x="${44+n.length*16+44}" y="${y+24}" width="56" height="20" rx="10" fill="none" stroke="${acc}"/><text x="${44+n.length*16+72}" y="${y+38}" text-anchor="middle" font-family="${G}" font-weight="700" font-size="10" fill="${acc}">おすすめ</text>`);
    t.push(`<text x="44" y="${y+62}" font-family="${G}" font-size="12" fill="${sub}">${per}</text>`);
    t.push(`<text x="300" y="${y+34}" text-anchor="end" font-family="${M}" font-weight="600" font-size="18" fill="${ink}">${price}</text>`);
    t.push(`<rect x="306" y="${y+44}" width="40" height="26" rx="8" fill="${ink}"/><text x="326" y="${y+61}" text-anchor="middle" font-family="${G}" font-weight="700" font-size="12" fill="#fff">購入</text>`);
    y+=92;
  }
  y+=8;
  t.push(`<rect x="24" y="${y}" width="342" height="112" rx="12" fill="${surf}" stroke="${line}"/>`);
  t.push(`<text x="44" y="${y+28}" font-family="${G}" font-weight="700" font-size="11" letter-spacing="2" fill="${sub}">使い方は2通り</text>`);
  t.push(`<text x="44" y="${y+56}" font-family="${G}" font-size="14" fill="${ink}">① コインで使う（かんたん・キー不要）</text>`);
  t.push(`<text x="44" y="${y+82}" font-family="${G}" font-size="14" fill="${ink}">② 自分のAPIキー登録（無料・上級者）</text>`);
  render(screen(t.join(''), paper), '/tmp/COINS.png');
}
