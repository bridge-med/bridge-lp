/* ================================================================
   「ひらく町」v3 — ページの動き(three.js は読まない)
   最初の訪問だけ、病院の足もとに柔らかい輪と「ふれてみる」の札(最初にふれたら消え、次の訪問では出さない)
   押した瞬間、その建物の足もとに輪が広がる。指が外れても、近い建物を選ぶ
   最初は止めた画像(見る人の時刻の昼・夕・夜。その端末が描く品質の段で撮ったもの)。読み込みが終わって手が空いたら、live.js を読んで立体と入れ替える
   ふれる → 建物がわずかに沈む → 島が回ってその建物が正面を向き、カメラが寄る → 前の壁が倒れ、屋根が抜け、中が見える
   道具の行(または中の物)にふれる → その物に寄り(見つける)、行が「道具の入口」にひらく(写し・誰向け・利用条件・行き先の種類・ボタン)
   入口のボタン → すぐに移り始め、その間に写しが画面いっぱいへ広がる。戻ると、その建物・その道具の状態から(URL のハッシュ #town/建物/道具)
   パネルの上の「‹ 前 | 建物の名前 | 次 ›」で、町ぜんたいに戻らずに隣の建物へ(名前にふれると一覧。スマホは上の帯と町の横のはじき、PC は ←/→ も)
   広場をひらくと、町を見渡す高さへ上がり、建物の上に小さな名前の札が並ぶ(ふれると、その建物へ渡る)
   動きを減らす設定・WebGL なし: 止めた画像のまま。ひらくのは瞬時で、パネルにその建物の断面の止めた画像を出す
   ?perf=1: 開閉のフレーム時間・入力から最初の描画までの時間・開閉を繰り返したときの記憶域を測る道具(window.__perf)
   ================================================================ */
import { BY_ID, TOOLS, RING } from './data.js';

const Q = new URLSearchParams(location.search);
const R = document.documentElement;
if (Q.get('capture') === 'inside') import('./sect.js').then(m => m.capture(Q));   // 案B の断面の止めた画像
else if (Q.get('capture')) import('./live.js').then(m => m.capture(Q));
else boot();

function boot() {
  R.classList.add('js');
  const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const el = (tag, cls) => { const e = document.createElement(tag); if (cls) e.className = cls; return e; };
  const hero = $('#top'), canvas = $('#world'), still = $('#still'), poster = $('#poster');
  const tagB = $('#tagB'), tagS = $('#tagS'), hint = $('#hint'), say = $('#say'), nudge = $('#nudge'), rings = $('#rings'), oTags = $('#oTags');
  const panel = $('#panel'), pTitle = $('#pTitle'), pName = $('#pName'), pNameT = $('#pNameT'), pRole = $('#pRole'), pLine = $('#pLine'), pTools = $('#pTools'), pStill = $('#pStill');
  const pBody = $('.p-body', panel), pList = $('#pList'), pMain = $('#pMain'), pPlaza = $('#pPlaza'), pzList = $('#pzList'), pPrev = $('#pPrev'), pNext = $('#pNext'), pMore = $('#pMore');
  const hits = new Map($$('.hit').map(a => [a.dataset.id, a]));
  const reduceQ = matchMedia('(prefers-reduced-motion: reduce)');
  const reduce = () => reduceQ.matches || Q.get('still') === '1';
  const phone = () => innerWidth < 921;   // 本番の bridge.css と同じく、920px まではドロワー(スマホの形)
  const save = !!(navigator.connection && navigator.connection.saveData);
  const TODS = ['day', 'dusk', 'night'];
  const ICO = {
    arrow: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    ext: '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
    chev: '<svg class="ico chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M6.5 9.5l5.5 5.5 5.5-5.5"/></svg>'
  };
  let ctl = null, openId = null, opener = null, touched = false, paused = false;
  let tagFor = null, tagTimer = 0, hoverId = null;
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 使えなくても壊れない */ } } };
  let nudgeOn = !store.get('bridge-hiraku-touched') && Q.get('nudge') !== '0';   // 最初の訪問だけ
  const PERF = Q.get('perf') === '1' ? perfTools() : null;

  /* ---------- 昼・夕・夜(ボタンで 昼 → 夕 → 夜 → 昼) ----------
     立体が動いているときは、ページの空(3枚の層)の濃さを立体の時刻(0 昼・1 夕・2 夜)から決める。夜 → 昼も夕方を通り、立体と同じ速さで移る */
  const skyL = [$('.sky .s-day'), $('.sky .s-dusk'), $('.sky .s-night')], mist = $('.mist');
  const MIST = [[242, 238, 230], [246, 220, 192], [46, 44, 88]];   // 空の下の色(--sky-d3・--sky-e3・--sky-n3)
  function skyMix(x) {
    x = Math.max(0, Math.min(2, x));
    // 下の層は不透明のまま、上の層を重ねて移る(半透明どうしを重ねると、紙の色が透けて白っぽくなるため)
    const op = [1, Math.min(1, x), Math.max(0, x - 1)];
    skyL.forEach((el, i) => { if (el) el.style.opacity = op[i].toFixed(3); });
    if (mist) { const i = x < 1 ? 0 : 1, k = x - i, c = MIST[i].map((v, j) => Math.round(v + (MIST[i + 1][j] - v) * k)); mist.style.setProperty('--mist', c.join(' ')); }
  }
  const btnTod = $('#btnTod'), btnPause = $('#btnPause');
  const posterSrc = t => poster.dataset[t].replace('.webp', (poster.dataset.tier || '') + '.webp');   // 品質の段(-mid か、なし)は、読み込みの前に小さなスクリプトが決めた
  const posterSet = t => posterSrc(t).replace('.webp', '-1000.webp') + ' 1000w, ' + posterSrc(t) + ' 1600w';   // 幅の違う2枚(スマホは 1000)
  const todLabel = () => ({ day: '夕方にする', dusk: '夜にする', night: '昼にする' })[R.dataset.tod];
  btnTod.setAttribute('aria-label', todLabel());
  btnTod.addEventListener('click', () => {
    const next = TODS[(TODS.indexOf(R.dataset.tod) + 1) % 3];
    if (!ctl) { const im = new Image(); im.sizes = poster.sizes; im.srcset = posterSet(next); im.src = posterSrc(next); (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => { poster.srcset = im.srcset; poster.src = im.src; R.dataset.tod = next; }); }
    else { R.dataset.tod = next; ctl.setTod(TODS.indexOf(next)); }
    btnTod.setAttribute('aria-label', todLabel());
    say.textContent = { day: '昼', dusk: '夕方', night: '夜' }[next] + 'になりました';
  });
  btnPause.addEventListener('click', () => {
    paused = btnPause.getAttribute('aria-pressed') !== 'true'; R.classList.toggle('paused', paused);   // 気づきの輪(CSS)も止める
    btnPause.setAttribute('aria-pressed', String(paused)); btnPause.setAttribute('aria-label', paused ? '町の動きを再生する' : '町の動きを止める');
    if (ctl) ctl.setPaused(paused);
    if (paused) stopInvite(); else if (!touched) startInvite();
  });

  /* ---------- 見えないボタンと名前の札の位置(止めた画像のときは、撮ったときの位置から) ---------- */
  const heroRect = () => hero.getBoundingClientRect();
  function placeHit(a, cx, cy, w, h) { w = Math.max(44, w); h = Math.max(44, h); a.style.transform = `translate(${(cx - w / 2).toFixed(1)}px,${(cy - h / 2).toFixed(1)}px)`; a.style.width = w.toFixed(0) + 'px'; a.style.height = h.toFixed(0) + 'px'; }
  let tagPos = {}, footPos = {}, hitPos = {}, nudgePos = null, ovPos = {};
  function stillLayout() {
    if (ctl) return;
    const hr = heroRect(), br = still.getBoundingClientRect(); if (!br.width) return;
    for (const [id, a] of hits) {
      const [x0, y0, x1, y1] = a.dataset.box.split(',').map(Number), [tx, ty] = a.dataset.tag.split(',').map(Number);
      const L = br.left - hr.left, T = br.top - hr.top, cx = L + (x0 + x1) / 200 * br.width, cy = T + (y0 + y1) / 200 * br.height;
      placeHit(a, cx, cy, (x1 - x0) / 100 * br.width, (y1 - y0) / 100 * br.height);
      tagPos[id] = [L + tx / 100 * br.width, T + ty / 100 * br.height];
      footPos[id] = [cx, T + (y1 - (y1 - y0) * .08) / 100 * br.height];
      if (a.dataset.nudge) { const [nx, ny] = a.dataset.nudge.split(',').map(Number); nudgePos = [L + nx / 100 * br.width, T + ny / 100 * br.height]; }
      hitPos[id] = [L + x0 / 100 * br.width, T + y0 / 100 * br.height, L + x1 / 100 * br.width, T + y1 / 100 * br.height];
    }
    if (tagFor) showTag(tagFor, true);
    placeNudge(); placeOv();
  }
  addEventListener('resize', () => { stillLayout(); if (ctl) ctl.resize(); });
  hero.addEventListener('click', e => {
    if (ctl || openId || e.target.closest('a,button,.panel')) return;
    const hr = heroRect(), x = e.clientX - hr.left, y = e.clientY - hr.top, tol = e.pointerType === 'mouse' ? 10 : 30;
    let best = null, bd = tol;
    for (const id in hitPos) { if (id === 'plaza' || id === 'park') continue; const [x0, y0, x1, y1] = hitPos[id], d = Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1)); if (d <= bd) { bd = d; best = id; } }
    if (best) hits.get(best).click();
  });
  stillLayout();
  poster.addEventListener('load', stillLayout);

  /* ---------- ふれられることの気づき(最初の訪問だけ)と、押したときの輪 ---------- */
  function placeNudge() {
    const p = nudgePos || footPos.hospital;
    if (!nudgeOn || !p) return;
    nudge.style.transform = `translate(${p[0].toFixed(1)}px,${p[1].toFixed(1)}px)`;
    nudge.hidden = false;
  }
  function endNudge() {
    if (!nudgeOn) return; nudgeOn = false; store.set('bridge-hiraku-touched', '1');
    nudge.classList.add('gone'); setTimeout(() => { nudge.hidden = true; }, 600);
  }
  function ringAt(id) {
    const p = footPos[id]; if (!p || reduce()) return;
    const r = document.createElement('i'); r.className = 'pring'; r.style.left = p[0].toFixed(1) + 'px'; r.style.top = p[1].toFixed(1) + 'px';
    r.addEventListener('animationend', () => r.remove()); rings.append(r);
    setTimeout(() => r.remove(), 650);   // 描画が重く、動きが進まない端末でも、ひらいたあとに残らないように
  }

  /* ---------- 名前の札(上の帯=ヘッダーに重ねない。左右も画面の中に) ---------- */
  const hd = $('.hd');
  function tagXY(p, half = 64) {
    const top = hd ? hd.getBoundingClientRect().bottom - heroRect().top : 56, w = hero.clientWidth;
    return [Math.min(Math.max(p[0], half + 8), w - half - 8), Math.max(p[1], top + 48)];
  }
  function showTag(id, on, sub) {
    clearTimeout(tagTimer);
    if (!on || !id) { tagB.classList.remove('on'); tagFor = null; return; }
    const b = BY_ID[id], p = tagPos[id]; if (!b || !p) return;
    tagFor = id;
    tagB.innerHTML = '';
    tagB.append(b.name); if (sub) { const s = document.createElement('small'); s.textContent = b.role; tagB.append(s); }
    const [x, y] = tagXY(p, sub ? 80 : 48);
    tagB.style.left = x.toFixed(1) + 'px'; tagB.style.top = y.toFixed(1) + 'px';
    tagB.classList.add('on');
  }
  let sTagFor = null, sPos = {};
  function showSTag(sid) {
    if (!sid || !sPos[sid]) { tagS.classList.remove('on'); sTagFor = null; return; }
    sTagFor = sid; tagS.textContent = sPos[sid].label;
    const [x, y] = tagXY([sPos[sid].x, sPos[sid].y - 8], 70);
    tagS.style.left = x.toFixed(1) + 'px'; tagS.style.top = y.toFixed(1) + 'px'; tagS.classList.add('on');
  }

  /* ---------- 誘い: 数秒おきに、建物のひとつがふっと明るくなり、短い名前の札が一瞬出て消える。最初にふれたら止める ---------- */
  const ORDER = ['observatory', 'clinic', 'library', 'office', 'atelier', 'park', 'hospital'];
  let invT = 0, invI = 0;
  function startInvite() {
    if (reduce() || touched || paused || nudgeOn) return;   // 最初の訪問で「ふれてみる」が出ている間は、名前の札を出さない
    stopInvite();
    const step = () => {
      if (touched || openId || paused) return;
      const id = ORDER[invI++ % ORDER.length];
      if (ctl) ctl.invite(id);
      showTag(id, true); tagTimer = setTimeout(() => { if (tagFor === id && !hoverId) showTag(null); }, 1500);
      invT = setTimeout(step, 4200);
    };
    invT = setTimeout(step, 2600);
  }
  function stopInvite() { clearTimeout(invT); }
  function firstTouch() {
    endNudge();
    if (touched) return; touched = true; stopInvite();
    hint.classList.add('gone'); setTimeout(() => { hint.hidden = true; }, 700);
  }
  startInvite();

  /* ---------- 建物にふれる → ひらく ---------- */
  for (const [id, a] of hits) {
    a.setAttribute('role', 'button'); a.setAttribute('aria-haspopup', 'dialog');
    a.addEventListener('click', e => { e.preventDefault(); firstTouch(); if (openId !== id) { ringAt(id); if (ctl) ctl.press(id); } openB(id, a); });
    a.addEventListener('keydown', e => { if (e.key === ' ') { e.preventDefault(); a.click(); } });
    a.addEventListener('focus', () => { if (openId) return; hoverId = id; showTag(id, true, true); if (ctl) ctl.hover(id); });
    a.addEventListener('blur', () => { if (hoverId === id) { hoverId = null; if (!openId) showTag(null); if (ctl) ctl.hover(null); } });
    a.addEventListener('mouseenter', () => { if (ctl || openId) return; showTag(id, true, true); });
    a.addEventListener('mouseleave', () => { if (ctl || openId) return; showTag(null); });
  }

  /* ---------- パネルの中身 ----------
     道具の行: ふれると、その物に寄り、行が道具の入口にひらく(もう一度ふれると閉じて、建物ぜんたいに戻る)。
     入口の文言は data.js(products/index.html の PRODUCTS の写し)のまま。行き先の種類だけは kind と cta から決める */
  const mouseHover = matchMedia('(hover: hover) and (pointer: fine)');
  const THUMB = s => '../../../images/products/thumbs/' + s + '.webp';
  /* 行き先の種類の札は、ボタンの言葉(本体の動詞・「紹介とデモを見る」・「紹介を見る」)で分からない、別のサイトだけ(文字を減らす) */
  const kindOf = t => t.ext ? '別のサイト・新しいタブで開きます' : '';
  function toolRow(tid) {
    const t = TOOLS[tid], li = el('li', 'prow'); li.dataset.sid = tid;
    const head = el('button', 'pfind'), ent = el('div', 'pent');
    head.type = 'button'; ent.id = 'pe-' + tid; ent.hidden = true;
    const nb = el('b'); nb.textContent = t.name;
    if (t.status) { const c = el('span', 'chip'); c.textContent = t.status; nb.append(c); }
    const tt = el('span', 't'); tt.textContent = t.t;
    head.append(nb, tt); head.insertAdjacentHTML('beforeend', ICO.chev);
    head.setAttribute('aria-expanded', 'false'); head.setAttribute('aria-controls', ent.id);
    head.addEventListener('click', () => rowPick(tid));
    li.addEventListener('mouseenter', () => rowEnter(tid));
    li.addEventListener('focusin', e => { if (e.target.matches(':focus-visible')) { focSid = tid; applyFind(); } });
    li.append(head, ent);
    return li;
  }
  /* 道具の入口(初めてひらいたときに作る)。立体が見えているときは、写しは町の中の画面ひとつ(入口には出さず、軽く: 誰向け・利用条件・ボタン)。
     止めた画像のとき(WebGL なし・動きを減らす設定)は、入口に写しを出す(そのとき読む) */
  const landImg = {};   // 着く画面の写し(移る瞬間に広げる。入口をひらいたときに読む)
  function fillEntrance(ent, tid) {
    if (ent.childElementCount) return;
    const t = TOOLS[tid];
    if (t.land && !landImg[t.land]) { const im = new Image(); im.decoding = 'async'; im.src = t.land; landImg[t.land] = im; }
    if (t.thumb && !ctl) { const f = el('figure', 'pshot'), im = new Image(); im.width = 880; im.height = 550; im.decoding = 'async'; im.alt = t.name + 'の実際の画面'; im.src = THUMB(t.thumb); f.append(im); ent.append(f); ent.classList.add('shot'); }
    if (t.for || t.facts) {
      const info = el('div', 'pinfo');
      if (t.for) { const p = el('p', 'pfor'); p.textContent = t.for; info.append(p); }
      if (t.facts) { const ul = el('ul', 'pfacts'); ul.setAttribute('aria-label', '利用の条件'); for (const f of t.facts) { const li = el('li'); li.textContent = f; ul.append(li); } info.append(ul); }
      ent.append(info);
    }
    const act = el('div', 'pact'), k = kindOf(t);
    if (k) { const s = el('span', 'pkind'); s.textContent = k; act.append(s); }
    const a = el('a', 'pcta'); a.href = t.href; a.textContent = t.cta || '開く';
    if (t.ext) { a.target = '_blank'; a.rel = 'noopener noreferrer'; const s = el('span', 'sr'); s.textContent = '(別のサイト・新しいタブで開きます)'; a.append(s); }
    a.insertAdjacentHTML('beforeend', t.ext ? ICO.ext : ICO.arrow);
    a.addEventListener('click', e => leap(e, ent.querySelector('.pshot img'), t, tid));
    act.append(a); ent.append(act);
  }
  /* 建物の一覧(名前にふれたとき・広場の「行き先を選ぶ」): 小さな肖像・名前・一行。選ぶと、町の上空を渡って移る */
  function listRows(ol, ids) {
    ol.innerHTML = '';
    for (const id of ids) {
      const b = BY_ID[id], li = el('li'), bt = el('button', 'lrow');
      bt.type = 'button';
      const im = new Image(); im.width = 480; im.height = 420; im.alt = ''; im.decoding = 'async'; im.src = 'img/b-' + id + '.webp';
      const tx = el('span'), nb = el('b'), sm = el('small'); nb.textContent = b.name; sm.textContent = b.line; tx.append(nb, sm);
      bt.append(im, tx);
      if (id === openId) bt.setAttribute('aria-current', 'true');
      bt.addEventListener('click', () => { if (id === openId) { listOpen(false); pName.focus(); return; } firstTouch(); openB(id, hits.get(id)); });
      li.append(bt); ol.append(li);
    }
  }
  function fillPanel(id) {
    const b = BY_ID[id], plaza = id === 'plaza', i = RING.indexOf(id);
    const pv = BY_ID[RING[(i + RING.length - 1) % RING.length]], nx = BY_ID[RING[(i + 1) % RING.length]];
    panel.classList.toggle('is-plaza', plaza);   // 広場の一文は明朝
    pRole.textContent = b.role; pNameT.textContent = b.name; pLine.textContent = b.line;
    pPrev.setAttribute('aria-label', '前の建物(' + pv.name + ')へ'); pPrev.title = pv.name;
    pNext.setAttribute('aria-label', '次の建物(' + nx.name + ')へ'); pNext.title = nx.name;
    pTools.innerHTML = ''; defSid = plaza ? null : b.tools[0]; pinSid = hovSid = focSid = null;
    pPlaza.hidden = !plaza; pTools.hidden = plaza;
    pMore.hidden = !b.use;   // 用途のある6棟: この用途を一覧で比べる(n点)→ products/index.html#用途
    if (b.use) { const a = $('a', pMore); a.href = '../../../products/index.html#' + b.use; a.firstChild.textContent = 'この用途を一覧で比べる(' + b.tools.length + '点)'; }
    if (plaza) listRows(pzList, RING.filter(x => x !== 'plaza'));
    else for (const tid of b.tools) pTools.append(toolRow(tid));
    // 動かないとき: その建物の断面の止めた画像
    pStill.hidden = !!ctl || plaza;
    if (!pStill.hidden) stillShot();
    pBody.scrollTop = 0;
    markRow(defSid);
  }
  function markRow(sid) { for (const li of $$('.prow', pTools)) li.classList.toggle('on', li.dataset.sid === sid); }

  /* ---------- 道具を見つける: 行(PC は乗せる・Tab、スマホは行を押す)か中の物を押すと、その物に寄る。外すと建物ぜんたいに戻る ---------- */
  let defSid = null, pinSid = null, hovSid = null, focSid = null, hovT = 0;
  /* パネルが出た直後、止まっているマウスの下に来た行では寄らない(マウスを実際に動かしてから) */
  let mouseXY = [-1, -1], armXY = null;
  addEventListener('mousemove', e => { mouseXY = [e.clientX, e.clientY]; }, { passive: true });
  pTools.addEventListener('mousemove', e => { if (armXY && Math.hypot(e.clientX - armXY[0], e.clientY - armXY[1]) > 4) { armXY = null; const li = e.target.closest('.prow'); if (li) rowEnter(li.dataset.sid); } });
  const findNow = () => pinSid || hovSid || focSid;   // 入口をひらいている間は、乗せても・Tab で移っても、ひらいた道具のまま
  function applyFind() {
    const sid = findNow();
    markRow(sid || defSid);
    for (const li of $$('.prow', pTools)) {   // 選んだ(押した)行だけが入口にひらく。乗せただけでは、ひらかない(寄るだけ)
      const on = li.dataset.sid === pinSid, ent = li.querySelector('.pent');
      if (on) fillEntrance(ent, li.dataset.sid);
      ent.hidden = !on; li.classList.toggle('open', on); li.querySelector('.pfind').setAttribute('aria-expanded', String(on));
    }
    if (ctl) { ctl.find(sid); ctl.stationHover(sid); showSTag(null); }   // 寄っているときは、画面そのものが答え(名前の札は出さない)
    writeHash();
  }
  function clearFind() { clearTimeout(hovT); pinSid = hovSid = focSid = null; }
  function rowEnter(sid) {
    if (!mouseHover.matches || armXY || pinSid) return;
    markRow(sid); if (ctl) ctl.stationHover(sid);
    clearTimeout(hovT); hovT = setTimeout(() => { hovSid = sid; applyFind(); }, 110);   // 行の上を通り過ぎただけでは動かさない
  }
  pTools.addEventListener('mouseleave', () => { if (!mouseHover.matches) return; clearTimeout(hovT); hovT = setTimeout(() => { hovSid = null; applyFind(); }, 220); });
  pTools.addEventListener('focusout', e => { if (focSid && !pTools.contains(e.relatedTarget)) { focSid = null; applyFind(); } });
  function rowPick(sid) {
    const go = () => { pinSid = pinSid === sid ? null : sid; if (!pinSid && hovSid === sid) hovSid = null; applyFind(); if (pinSid) revealRow(sid); else panel.style.height = ''; };   // 閉じたら、伸ばしたシートを戻す
    // スマホでシートを広げているときは、物が見える高さに戻してから寄る
    if (phone() && panel.classList.contains('full')) { panel.classList.remove('full'); setTimeout(go, 340); } else go();
  }
  /* ひらいた入口が、パネル(シート)の見える範囲に入るように */
  function revealRow(sid) {
    const li = sid && $(`.prow[data-sid="${CSS.escape(sid)}"]`, pTools); if (!li || panel.hidden) return;
    const need = () => {   // 動かす量: 行の名前(上)が隠れていれば上を、下が切れていれば下をそろえる。見える範囲より高い入口は上をそろえる
      const bb = pBody.getBoundingClientRect(), r = li.getBoundingClientRect(), pad = 6;
      if (r.top < bb.top + pad || r.height > bb.height - pad * 2) return r.top - bb.top - pad;
      return r.bottom > bb.bottom - pad ? r.bottom - bb.bottom + pad : 0;
    };
    const now = reduce() || Q.get('clock') === 'manual';   // 撮るとき(手動の時計)は、描かないとなめらかなスクロールが進まないので瞬時に
    if (phone()) {   // 入口(名前からボタンまで)がシートの見える範囲より高いときは、シートを要るだけ伸ばす(画面の 88% まで)
      const over = li.getBoundingClientRect().height - (pBody.getBoundingClientRect().height - 12);
      if (over > 0 && !panel.classList.contains('full')) {
        panel.style.height = Math.min(innerHeight * .88, panel.getBoundingClientRect().height + over) + 'px';
        setTimeout(() => { const d = need(); if (Math.abs(d) > 1) pBody.scrollBy({ top: d }); }, now ? 0 : 340);
        return;
      }
    }
    const dy = need();
    if (Math.abs(dy) < 1) return;
    pBody.scrollBy({ top: dy, behavior: now ? 'auto' : 'smooth' });
    if (!now) setTimeout(() => { const d2 = need(); if (Math.abs(d2) > 2) pBody.scrollBy({ top: d2 }); }, 500);   // なめらかに動かなかったときは、そのまま合わせる
  }
  /* 動かないとき(動きを減らす・WebGL なし): パネルの上に、その建物の断面の止めた画像 */
  function stillShot() {
    const im = pStill.querySelector('img'), b = BY_ID[openId];
    im.onerror = () => { im.onerror = null; im.src = 'img/b-' + openId + '.webp'; };
    im.src = 'img/cut-' + openId + (phone() ? '-800' : '') + '.webp'; im.alt = b.name + 'の中を描いた絵';   // 道具は、下の一覧が言う
  }

  /* ---------- 状態を URL のハッシュに残す(#town/建物/道具)。戻るボタンで町に戻ったとき、その状態から始める ---------- */
  function writeHash() {
    const h = openId ? '#town/' + openId + (pinSid ? '/' + pinSid : '') : '';
    if (h === location.hash || (!h && !location.hash.startsWith('#town/'))) return;   // ほかの印(#main など)は消さない
    try { history.replaceState(history.state, '', location.pathname + location.search + h); } catch (e) { /* 使えなくても壊れない */ }
  }

  /* ---------- ひらく・閉じる・隣へ ---------- */
  function openB(id, from, opt = {}) {
    if (openId === id) return;
    const wasOpen = !!openId;
    openId = id; opener = from || hits.get(id);
    showTag(null); hoverId = null; clearFind(); armXY = mouseXY.slice();
    listOpen(false, true); ovTags(false);
    fillPanel(id);
    R.classList.add('opened');
    if (ctl) ctl.open(id);
    if (id === 'plaza' && (!ctl || reduce())) ovTags(true);   // 動いているときは、見晴らしに着いてから(onOpened)
    // パネルは押したその場で出し、町に寄る動きの間に現れる(0.26 秒後。CSS の時計なので、描画が重い端末でも、こまの数によらない)
    const enter = !(wasOpen || !ctl || reduce() || opt.now);
    panel.classList.remove('enter', 'full'); panel.style.height = ''; panel.hidden = false;
    if (enter) { void panel.offsetWidth; panel.classList.add('enter'); }
    if (opt.focus !== false) pTitle.focus({ preventScroll: true });
    if (!save) idle(() => { if (openId !== id) return; for (const tid of BY_ID[id].tools) { const t = TOOLS[tid]; if (t.thumb) { const im = new Image(); im.decoding = 'async'; im.fetchPriority = 'low'; im.src = THUMB(t.thumb); } } });   // 入口の写しを先に読んでおく(押したときに枠が空にならないように)
    writeHash();
    if (PERF) PERF.mark('open', id);
    say.textContent = BY_ID[id].name + 'がひらきました';
  }
  function closeB(back = true) {
    if (!openId) return;
    const id = openId; openId = null; clearFind(); listOpen(false, true); ovTags(false);
    panel.hidden = true; panel.classList.remove('enter'); panel.style.height = ''; R.classList.remove('opened'); showSTag(null);
    if (ctl) ctl.close();
    writeHash();
    if (PERF) PERF.mark('close', id);
    if (back && opener) opener.focus({ preventScroll: true });
    say.textContent = BY_ID[id].name + 'を閉じました';
  }
  /* 前・次: 島を一周する順(病院 → 広場 → 展望台 → 事務所 → クリニック → 公園 → アトリエ → 図書館 → 病院)。ひらいたまま、町の上空を渡る */
  function step(d) {
    if (!openId) return;
    const i = RING.indexOf(openId), id = RING[(i + d + RING.length) % RING.length];
    const keep = document.activeElement === pPrev || document.activeElement === pNext;   // 続けて押せるように、押したボタンにフォーカスを残す
    firstTouch(); openB(id, hits.get(id), { focus: !keep });
  }
  pPrev.addEventListener('click', () => step(-1));
  pNext.addEventListener('click', () => step(1));
  let listFull = false;
  function listOpen(on, quiet) {
    if (on === !pList.hidden) return;
    pList.hidden = !on; pMain.hidden = on; pName.setAttribute('aria-expanded', String(on));
    if (on) {
      listRows($('ol', pList), RING);
      if (phone() && !panel.classList.contains('full')) { panel.classList.add('full'); listFull = true; }   // スマホは、8つが見える高さに広げる
      pBody.scrollTop = 0;
      const cur = $('[aria-current="true"]', pList); if (cur && !quiet) cur.focus({ preventScroll: true });
    } else if (listFull) { listFull = false; if (phone()) panel.classList.remove('full'); }
  }
  pName.addEventListener('click', () => listOpen(pList.hidden));
  $('#pClose').addEventListener('click', () => closeB());

  /* ---------- 広場の見晴らし: 建物の上の名前の札(ふれると、その建物へ渡る)。キーボードと読み上げは、パネルの「行き先を選ぶ」で ---------- */
  function ovTags(on) {
    oTags.classList.remove('on'); oTags.hidden = !on;
    if (!on) return;
    if (!oTags.childElementCount) for (const id of RING) {
      if (id === 'plaza') continue;
      const b = el('button', 'otag'); b.type = 'button'; b.tabIndex = -1; b.dataset.id = id; b.textContent = BY_ID[id].name;
      b.addEventListener('click', e => { e.stopPropagation(); if (openId === 'plaza') { ringAt(id); if (ctl) ctl.press(id); openB(id, hits.get(id)); } });
      oTags.append(b);
    }
    placeOv(); requestAnimationFrame(() => oTags.classList.add('on'));
  }
  function placeOv() {
    if (oTags.hidden) return;
    const hr = heroRect(), pr = panel.hidden ? null : panel.getBoundingClientRect();
    const yMax = pr && phone() ? pr.top - hr.top - 6 : hero.clientHeight - 8, xMax = pr && !phone() ? pr.left - hr.left - 8 : hero.clientWidth;   // シート・パネルの下に隠れる札は出さない
    const placed = [];
    for (const b of [...oTags.children].sort((a, c) => ((ovPos[c.dataset.id] || tagPos[c.dataset.id] || [0, 0])[1]) - ((ovPos[a.dataset.id] || tagPos[a.dataset.id] || [0, 0])[1]))) {   // 下(手前)の札から
      const p = ovPos[b.dataset.id] || tagPos[b.dataset.id]; if (!p) { b.classList.add('off'); continue; }
      let [x, y] = tagXY(p, 36);
      const w = b.offsetWidth || 64, h = b.offsetHeight || 28;
      for (let i = 0; i < 4; i++) {   // 近い札(押せる範囲が重なる)とは、上へずらして間を空ける
        const hit = placed.find(q => Math.abs(q.x - x) < (q.w + w) / 2 + 10 && Math.abs(q.y - y) < h + 20);
        if (!hit) break; y = hit.y - (h + 20);
      }
      placed.push({ x, y, w });
      b.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,calc(-100% - 8px))`;
      b.classList.toggle('off', y > yMax || x > xMax);
    }
  }

  /* ---------- 移る瞬間: ボタンを押したら、すぐに移り始める(待たせない)。その間に、町の中のその画面が広がって道具になる(280ms) ----------
     元は、立体が見えているときは町の中の画面(同じ画像)、止めた画像のときは入口の写し。終わりは紙の地の真ん中に写し(PC は大きく、スマホは幅いっぱい)と、
     その下に道具の名前を小さく。移るのに 800ms 以上かかったら、名前の下に細い線が流れる。読み込みが速ければ途中で切れてよい。
     動きを減らす設定では動かさない。別のサイトは新しいタブで開くので、広げない。戻ったとき(bfcache): 写しが元の画面へ縮んで戻る */
  let leapEl = null, leapT = 0, waitT = 0;
  function leap(e, shotImg, t, sid, own) {
    if (t.ext || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (ctl) ctl.setPaused(true);   // 移る間は町を描かない(次のページの読み込みに手を譲る)
    if (reduce() || !document.body.animate) return;
    if (leapEl) unleap(false);
    // 広げるのは、着く画面と同じ写しだけ。紹介のページへ行く物(kind=intro)と、着く画面の写しがない物(land: false)は、紙の地に名前だけ
    let im = null, from = null;
    const bare = t.kind === 'intro' || t.land === false, land = t.land && landImg[t.land];
    if (own && own.naturalWidth) { const bx = own.getBoundingClientRect(); from = { x: bx.left, y: bx.top, w: bx.width, h: bx.height }; im = own; }   // 第3幕: 押した画面そのものから
    else if (!bare && ctl) { im = land && land.naturalWidth ? land : ctl.imageOf(t.shot || (t.thumb && THUMB(t.thumb))); from = im && ctl.screenRect(sid); }
    else if (!bare && shotImg && shotImg.naturalWidth) {   // 止めた画像のとき: 入口の写しの枠から(object-fit: contain の中身)
      const bx = shotImg.getBoundingClientRect(), k0 = Math.min(bx.width / shotImg.naturalWidth, bx.height / shotImg.naturalHeight);
      from = { x: bx.left + (bx.width - shotImg.naturalWidth * k0) / 2, y: bx.top + (bx.height - shotImg.naturalHeight * k0) / 2, w: shotImg.naturalWidth * k0, h: shotImg.naturalHeight * k0 };
      im = land && land.naturalWidth ? land : shotImg;
    }
    const lp = el('div', 'leap'), bg = el('i', 'lp-bg'), cap = el('p', 'lp-name'), vw = R.clientWidth, vh = innerHeight;
    if (im && !(from && from.w > 2 && from.w < vw * 2 && from.x + from.w > 0 && from.y + from.h > 0 && from.x < vw && from.y < vh)) {   // 画面の外(カメラが動いている途中など): 入口の位置から
      const r = (e.currentTarget.closest('.prow') || e.currentTarget).getBoundingClientRect(); from = { x: r.left + 12, y: r.top + 8, w: Math.max(40, r.width - 24), h: Math.max(30, r.height - 16) };
    }
    lp.setAttribute('aria-hidden', 'true'); cap.textContent = t.name; cap.append(el('i', 'lp-line')); lp.append(bg);
    const nw = im && (im.naturalWidth || im.width), nh = im && (im.naturalHeight || im.height);
    if (nw && from && from.w > 2) {
      let s1 = Math.min((phone() ? vw : Math.min(vw * .7, 1120)) / nw, vh * (phone() ? .62 : .66) / nh);
      if (own) s1 = Math.min(Math.max(s1, from.w / nw), (vw - 20) / nw, (vh - 64) / nh);   // 第3幕: 押した画面より小さくしない(広がって道具になる)
      const w1 = nw * s1, h1 = nh * s1, x1 = (vw - w1) / 2, y1 = Math.max(10, (vh - h1 - 44) / 2);
      const cv = el('canvas', 'lp-im'), kd = own ? Math.min(2, devicePixelRatio || 1) : 1; cv.width = Math.round(nw * kd); cv.height = Math.round(nh * kd); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);   // 読み終えた画像を、そのまま写す(読み直さない・加工しない)
      Object.assign(cv.style, { left: x1.toFixed(1) + 'px', top: y1.toFixed(1) + 'px', width: w1.toFixed(1) + 'px', height: h1.toFixed(1) + 'px' });
      const k = Math.min(from.w / w1, from.h / h1), tf = `translate(${(from.x + (from.w - w1 * k) / 2 - x1).toFixed(1)}px,${(from.y + (from.h - h1 * k) / 2 - y1).toFixed(1)}px) scale(${k.toFixed(4)})`;   // 元の枠に収まる大きさから(着く画面の写しが縦長でも)
      lp.dataset.from = tf; lp.append(cv); cap.style.top = (y1 + h1 + 14).toFixed(1) + 'px';
      cv.animate([{ transform: tf }, { transform: 'none' }], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'both' });
    } else cap.style.top = (vh / 2 - 12).toFixed(1) + 'px';   // 写しのない行き先(アトリエ): 紙の地に名前だけ
    lp.append(cap); document.body.append(lp);
    bg.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 280, easing: 'cubic-bezier(.3,.6,.3,1)', fill: 'both' });
    cap.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, delay: 200, fill: 'both' });
    leapEl = lp; clearTimeout(leapT); clearTimeout(waitT);
    waitT = setTimeout(() => lp.classList.add('wait'), 800);   // 待っていることが分かる細い線
    leapT = setTimeout(() => unleap(true), Q.get('clock') === 'manual' ? 60000 : 8000);   // 移れなかったとき(止めた・失敗した)は、元に戻す(撮るときは、こまを撮り終えるまで待つ)
  }
  function unleap(anim) {
    clearTimeout(leapT); clearTimeout(waitT);
    const lp = leapEl; leapEl = null;
    if (ctl) ctl.setPaused(paused);
    if (!lp) return;
    if (!anim || reduce()) { lp.remove(); return; }
    const D = 240, cv = $('.lp-im', lp);
    if (cv) cv.animate([{ transform: 'none' }, { transform: lp.dataset.from }], { duration: D, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'both' });
    for (const x of [$('.lp-bg', lp), $('.lp-name', lp)]) x.animate([{ opacity: 1 }, { opacity: 0 }], { duration: D, fill: 'both' });
    setTimeout(() => lp.remove(), D + 40);
  }
  addEventListener('pageshow', e => { if (e.persisted) unleap(true); });

  /* ---------- キーボード: Esc で閉じる(一覧がひらいていれば一覧を)、←/→ で隣の建物へ、Tab はパネルの中を回る ---------- */
  addEventListener('keydown', e => {
    if (menu.open) return;   // メニュー(モーダル)の中のキー操作は、メニューに任せる
    if (e.key === 'Escape' && openId) { e.preventDefault(); if (!pList.hidden) { listOpen(false); pName.focus(); } else closeB(); return; }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && openId && !panel.hidden && !e.altKey && !e.ctrlKey && !e.metaKey && !e.shiftKey && !menu.open) { e.preventDefault(); step(e.key === 'ArrowLeft' ? -1 : 1); return; }
    if (e.key === 'Tab' && openId && !panel.hidden) {           // パネルの中を Tab で回る
      const f = $$('a,button,[tabindex="0"]', panel).filter(el => !el.hidden && el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], lastEl = f[f.length - 1];
      if (!panel.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- スマホのシート: 上の帯(つまみ・前後・名前)を縦に引くと広がる・下に払うと閉じる。横にはじくと前後の建物へ ----------
     ふれただけ(動かさない)なら、ボタンはそのまま押せる。動かし始めた向き(縦か横か)で決め、混ぜない */
  const grab = $('#pGrab'), head = $('.p-head', panel);
  let drag = null, swallow = 0;
  function bandDown(e) {
    if (!phone() || (e.pointerType === 'mouse' && e.button !== 0)) return;
    drag = { x: e.clientX, y: e.clientY, h: panel.getBoundingClientRect().height, t: performance.now(), mode: null, id: e.pointerId, el: e.currentTarget };
  }
  function bandMove(e) {
    if (!drag || e.pointerId !== drag.id) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.mode) {
      if (Math.hypot(dx, dy) < 9) return;
      drag.mode = Math.abs(dx) > Math.abs(dy) * 1.3 ? 'h' : 'v';
      try { drag.el.setPointerCapture(e.pointerId); } catch (er) { /* 取れなくても動く */ }
      if (drag.mode === 'v') panel.style.transition = 'none'; else head.style.transition = 'none';
    }
    if (drag.mode === 'v') panel.style.height = Math.max(120, Math.min(innerHeight * .88, drag.h - dy)) + 'px';
    else head.style.transform = `translateX(${(Math.sign(dx) * Math.min(26, Math.abs(dx) * .22)).toFixed(1)}px)`;   // 少しだけ付いてくる(移る手応え)
  }
  function bandEnd(e, cancel) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    panel.style.transition = ''; panel.style.height = ''; head.style.transition = ''; head.style.transform = '';
    if (!d.mode || cancel) return;   // ふれただけ: ボタンは click で動く
    swallow = performance.now();
    const dx = e.clientX - d.x, dy = e.clientY - d.y, ms = Math.max(1, performance.now() - d.t);
    if (d.mode === 'v') { if (dy > 70 || dy / ms > .6) closeB(); else if (dy < -40) panel.classList.add('full'); else if (dy > 30) panel.classList.remove('full'); }
    else if (Math.abs(dx) > 48 || Math.abs(dx) / ms > .45) step(dx < 0 ? 1 : -1);
  }
  for (const x of [grab, head]) {
    x.addEventListener('pointerdown', bandDown); x.addEventListener('pointermove', bandMove);
    x.addEventListener('pointerup', e => bandEnd(e)); x.addEventListener('pointercancel', e => bandEnd(e, true));
  }
  panel.addEventListener('click', e => { if (performance.now() - swallow < 350 && head.contains(e.target)) { e.preventDefault(); e.stopPropagation(); } }, true);   // 引いたあとの click は押したことにしない

  /* ---------- 見出しの帯: 最初の画面を過ぎたら、小さく上に固定(下の節からもヘッダーに届く)。ひらいている間は、いまのまま ---------- */
  if ('IntersectionObserver' in window) new IntersectionObserver(([en]) => { R.classList.toggle('past', !en.isIntersecting); if (!en.isIntersecting && openId) closeB(false); }, { rootMargin: '-72px 0px 0px 0px' }).observe(hero);   // ひらいたまま町が画面から出たら閉じる(ハッシュも消える)

  /* ---------- メニュー(スマホ) ---------- */
  const menu = $('#menu'), menuBtn = $('#menuBtn');
  menuBtn.addEventListener('click', () => { if (menu.showModal) menu.showModal(); else menu.setAttribute('open', ''); });
  $$('[data-close]', menu).forEach(el => el.addEventListener('click', () => menu.close()));
  menu.addEventListener('click', e => { if (e.target === menu) menu.close(); });
  menu.addEventListener('close', () => menuBtn.focus());

  /* ---------- 立体と入れ替える(読み込みのあと、手が空いたときに) ---------- */
  /* 計測: 長いタスク(50ms 超)。止めた画像から立体へ替わる前後(読み込み開始から、替わって 2 秒後まで)で、スクロールやタップが止まる長さ */
  const swap = { start: 0, live: 0 }, lts = [];
  try { new PerformanceObserver(l => { for (const e of l.getEntries()) lts.push([Math.round(e.startTime), Math.round(e.duration)]); }).observe({ type: 'longtask', buffered: true }); } catch (e) { /* 使えない環境では測らない */ }
  window.__lt = () => {
    const end = swap.live ? swap.live + 2000 : performance.now(), inSwap = lts.filter(([s0, d]) => s0 + d > swap.start && s0 < end);
    const sum = a => a.reduce((t, [, d]) => t + d, 0);
    return { count: lts.length, total: sum(lts), max: Math.max(0, ...lts.map(([, d]) => d)), swapStart: Math.round(swap.start), swapLive: Math.round(swap.live), swapCount: inSwap.length, swapTotal: sum(inSwap), swapMax: Math.max(0, ...inSwap.map(([, d]) => d)) };
  };
  /* 止めた画像がそのまま残るとき: sizes を実際の幅にして、画素の細かい端末では大きい方(1600w)を選ばせる。立体に替わる人は小さい画像のまま */
  function stillSharp() { if (save) return; const w = Math.round(still.getBoundingClientRect().width); if (w > 0) poster.sizes = w + 'px'; }
  function hasWebGL() { try { const c = document.createElement('canvas'); return !!(window.WebGL2RenderingContext && c.getContext('webgl2')); } catch (e) { return false; } }
  function upgrade() {
    if (reduce() || save || !hasWebGL() || Q.get('static') === '1') { stillSharp(); return; }
    const t0 = performance.now(); swap.start = t0;
    const mod = () => Q.get('stub') === '1' ? import('./interiors-stub.js') : import('./interiors.js').then(m => { if (typeof m.buildInterior !== 'function') throw new Error('no buildInterior'); return m; }).catch(() => import('./interiors-stub.js'));   // 立体の側が、手が空いたとき(か、最初に押されたとき)に読む
    import('./live.js').then(async L => {
      const mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 8, saved = store.get('bridge-hiraku-q');
      let quality = Q.get('q') || saved || (phone() ? 'mid' : 'high');
      if (!Q.get('q') && quality === 'high' && (mem <= 4 || cores <= 4)) quality = 'mid';
      if (!Q.get('q') && (mem <= 2 || cores <= 2)) quality = 'low';
      ctl = await L.live({
        canvas, box: still, tod: TODS.indexOf(R.dataset.tod), mod, reduce, quality,
        safe() {
          const w = canvas.clientWidth, h = canvas.clientHeight;
          if (phone()) return { l: 10, t: 64, r: w - 10, b: h - Math.round(innerHeight * .45) - 6 };
          const pw = Math.min(400, Math.max(340, innerWidth * .34)) + 48;
          return { l: 40, t: 90, r: w - pw - 16, b: h - 36 };
        },
        onHover(id) { hoverId = id; if (openId) return; if (id) showTag(id, true, true); else showTag(null); },   // 乗せただけでは誘いを止めない
        onPress(id) { firstTouch(); ringAt(id); },
        onQuality(q) { store.set('bridge-hiraku-q', q); },
        onTod(x) { R.classList.add('skylive'); skyMix(x); },
        onPick(id) { firstTouch(); if (id === openId) { if (findNow()) { clearFind(); applyFind(); } return; } openB(id, hits.get(id)); },
        onEmpty() { if (!openId) return; if (findNow()) { clearFind(); applyFind(); } else closeB(false); },   // 寄っているときは、まず建物ぜんたいに戻る
        onStation(sid, how) {
          if (!openId) return;
          if (how === 'tap' && sid) { pinSid = sid; applyFind(); revealRow(sid); return; }
          if (pinSid) return;   // 入口をひらいている間は、中の物に乗せても印を動かさない
          if (sid) { markRow(sid); if (!findNow()) showSTag(sid); } else { markRow(findNow() || defSid); showSTag(null); }
        },
        onFlick(d) { if (openId) step(d); },   // 町の上の横のはじき(指)
        onLayout(L2) {
          const hr = heroRect(), cr = canvas.getBoundingClientRect(), ox = cr.left - hr.left, oy = cr.top - hr.top;
          for (const [id, a] of hits) { const p = L2.b[id]; if (!p) continue; tagPos[id] = [ox + p.tag[0], oy + p.tag[1]]; footPos[id] = [ox + p.foot[0], oy + p.foot[1]]; if (p.nudge) nudgePos = [ox + p.nudge[0], oy + p.nudge[1]]; placeHit(a, ox + p.c[0], oy + p.c[1], 64, 64); }
          placeNudge(); placeOv();
          if (tagFor) { const [x, y] = tagXY(tagPos[tagFor], 64); tagB.style.left = x.toFixed(1) + 'px'; tagB.style.top = y.toFixed(1) + 'px'; }
          ovPos = {}; if (L2.ov) for (const id in L2.ov) ovPos[id] = [ox + L2.ov[id][0], oy + L2.ov[id][1]];   // 見晴らしの札の位置(町の側から)
          sPos = {}; for (const s of L2.st) sPos[s.id] = { x: ox + s.x, y: oy + s.y - 14, label: s.label };
          if (sTagFor) showSTag(sTagFor);
        },
        onOpened() {},
        onArrive(id) { if (id === 'plaza' && openId === 'plaza') ovTags(true); },   // カメラが見晴らしに着いてから、名前の札(遅い端末でも、カメラより先に出さない)
        onClosed() {},
        onFrame() { if (PERF) PERF.frame(); }
      });
      window.__ctl = ctl; window.__t3 = Math.round(performance.now() - t0); swap.live = performance.now();
      if (paused) ctl.setPaused(true);
      // 止めた画像のうちにひらいていた建物(戻ってきたときのハッシュも)は、飛ばずに、その姿から立体にする
      for (const f of $$('.pent .pshot', pTools)) { f.parentNode.classList.remove('shot'); f.remove(); }   // 写しの元は、町の中の画面ひとつに
      if (openId) { pStill.hidden = true; await ctl.restore(openId, openId === 'plaza' ? null : pinSid); if (openId) { applyFind(); if (openId === 'plaza') ovTags(true); revealRow(pinSid); } }
      requestAnimationFrame(() => { R.classList.add('live'); dispatchEvent(new Event('hiraku:live')); });
    }).catch(err => { console.warn(err); stillSharp(); });
  }
  const idle = f => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 1500 }) : setTimeout(f, 300));
  if (document.readyState === 'complete') idle(upgrade); else addEventListener('load', () => idle(upgrade));

  /* ---------- 案B: 最初の画面のすぐ後の、病院の断面(二つめの描画。町の空の続き) ----------
     最初は止めた画像(見る人の時刻)。町が立体に替わって手が空いたとき(か、区画が近づいたとき)に、断面の立体を作って替える。
     区画が画面に入ると、正面の壁が地面へ沈み(進み具合はスクロールの位置)、中の灯りが上がる。札は壁が沈みきってから。
     町の最初の画面がスクロールで上へ抜ける間、町の病院を少し明るくし、名前の札を出す(目が、同じ病院を追って下へ) */
  const inStage = $('#inStage'), inCanvas = $('#inWorld'), inStill = $('#inStill'), inTags = $('#inTags');
  const ifls = $$('.ifl', inTags), itags = $$('.itag', inTags);
  let sect = null, sectP = null, sectVis = false;
  /* 止めた画像の札の位置(撮るときに書き出した値。枠の %) */
  const IN_POS = { st: { yawagaeshi: [40.25, 29.36], keiji: [35.4, 46.44], nidodema: [40.73, 60.26] }, fl: [[19.57, 33.43], [19.57, 48.4], [19.57, 63.38]] };
  function inStillSrc() { const b = inStill.dataset[R.dataset.tod] || inStill.dataset.day; inStill.srcset = b + '-800.webp 800w, ' + b + '-1200.webp 1200w'; inStill.src = b + '-800.webp'; }
  inStillSrc();
  function placeIn(px) {   // px: { st: {sid: [x, y]}, fl: [[x, y]] } 枠の中の px
    for (const a of itags) { const p = px.st[a.dataset.sid]; if (!p) continue; a.style.left = p[0].toFixed(1) + 'px'; a.style.top = p[1].toFixed(1) + 'px'; }
    ifls.forEach((f, i) => { const p = px.fl[i]; if (!p) return; f.style.left = p[0].toFixed(1) + 'px'; f.style.top = p[1].toFixed(1) + 'px'; });
  }
  function stillIn() {   // 止めた画像のときの札(枠の % から)
    if (sect) return;
    const w = inStage.clientWidth, h = inStage.clientHeight, cv = ([x, y]) => [x / 100 * w, y / 100 * h];
    placeIn({ st: Object.fromEntries(Object.entries(IN_POS.st).map(([k, v]) => [k, cv(v)])), fl: IN_POS.fl.map(cv) });
  }
  stillIn(); addEventListener('resize', stillIn);
  function inReveal() {   // 区画の上の端が、画面の高さの 90% から 35% まで来る間に、壁が沈む
    const r = inStage.getBoundingClientRect(), vh = innerHeight;
    return Math.max(0, Math.min(1, (vh * .9 - r.top) / (vh * .55)));
  }
  function sectBoot() {
    if (sectP || reduce() || save || !hasWebGL() || Q.get('static') === '1') return;
    const mem = navigator.deviceMemory || 8, cores = navigator.hardwareConcurrency || 8, quality = Q.get('q') || (phone() || mem <= 4 || cores <= 4 ? 'mid' : 'high');
    inTags.classList.add('wait');
    sectP = import('./sect.js').then(M => M.section({
      canvas: inCanvas, tod: TODS.indexOf(R.dataset.tod), quality, reduce,
      onLayout(L) { placeIn(L); inTags.classList.toggle('wait', L.k < .82); },
      onReady() { requestAnimationFrame(() => R.classList.add('inlive')); }
    })).then(api => { sect = api; sect.setVisible(sectVis); sect.setReveal(inReveal()); window.__sect = api; })
      .catch(err => { console.warn(err); inTags.classList.remove('wait'); stillIn(); });
  }
  addEventListener('hiraku:live', () => setTimeout(() => idle(sectBoot), 1600));   // 町の立体が替わって、町の側の後の読み込み(公園の中)が済んでから
  addEventListener('scroll', () => idle(sectBoot), { passive: true, once: true });   // 町が立体になる前にスクロールし始めたら、そのときに(最初の画面の読み込みとは競わせない)
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([en]) => { sectVis = en.isIntersecting; if (sect) sect.setVisible(sectVis); }, { rootMargin: '80px 0px 80px 0px' }).observe(inStage);   // 見える間だけ描く
  }
  /* スクロール: 壁の沈み具合と、町の病院の目印 */
  let inQ = 0, hospMark = false;
  const inUpd = () => {
    inQ = 0;
    if (sect) sect.setReveal(inReveal());
    const hr = hero.getBoundingClientRect(), k = -hr.top / Math.max(1, hr.height);
    const on = k > .16 && k < .95 && !openId;
    if (on !== hospMark) {
      hospMark = on;
      if (on) { stopInvite(); if (ctl) ctl.hover('hospital'); showTag('hospital', true); }
      else { if (ctl) ctl.hover(null); if (tagFor === 'hospital') showTag(null); if (!touched) startInvite(); }
    }
  };
  addEventListener('scroll', () => { if (!inQ) inQ = requestAnimationFrame(inUpd); }, { passive: true });
  inUpd();
  /* 昼・夕・夜を変えたとき: 断面も同じ時刻へ(止めた画像は、その時刻の絵に)。町が止めた画像のときは、絵を読み終えてから時刻が替わる */
  new MutationObserver(() => { inStillSrc(); if (sect) sect.setTod(TODS.indexOf(R.dataset.tod)); }).observe(R, { attributes: true, attributeFilter: ['data-tod'] });

  /* 戻ってきたとき(#town/建物/道具): その建物をひらき、その道具の入口をひらいた状態から(止めた画像のうちは瞬時に。立体は替わるときに飛ばずに合わせる)。
     同じページの中の #town/… のリンクと、アドレスの書き換え(hashchange)にも応える */
  function hashState() {
    const m = /^#town\/([a-z]+)(?:\/([a-z0-9-]+))?$/.exec(location.hash); if (!m || !BY_ID[m[1]]) return null;
    return { id: m[1], sid: m[1] !== 'plaza' && m[2] && BY_ID[m[1]].tools.includes(m[2]) ? m[2] : null };
  }
  function fromHash(boot) {
    const st = hashState();
    if (!st) { if (!boot && !location.hash && openId) closeB(false); return; }   // #main などは、そのまま(ページの中を移るだけ)
    firstTouch();
    if (st.id !== openId) openB(st.id, null, boot ? { now: true } : {});
    if (st.sid !== pinSid) { clearFind(); pinSid = st.sid; applyFind(); if (st.sid) revealRow(st.sid); }
  }
  fromHash(true);
  addEventListener('hashchange', () => fromHash(false));

  /* ---------- 計測の道具(?perf=1): 開閉のフレーム時間・入力から最初の描画まで・開閉を繰り返したときの記憶域 ----------
     立体が1枚描くたびに時刻を記録する(onFrame)。入力は、指・キーを押した時刻(event.timeStamp)から、次の1枚を描き終えるまで(画面に出るのは次の垂直同期) */
  function perfTools() {
    const P = { frames: [], inputs: [], marks: [], pend: null };
    const note = e => { if (P.pend == null) P.pend = e.timeStamp; };
    addEventListener('pointerdown', note, true); addEventListener('keydown', note, true);
    P.frame = () => { const now = performance.now(); P.frames.push(now); if (P.frames.length > 30000) P.frames.splice(0, 15000); if (P.pend != null) { P.inputs.push(Math.round(now - P.pend)); P.pend = null; } };
    P.mark = (k, id) => P.marks.push({ k, id, t: performance.now() });
    const stat = a => { const s = a.slice().sort((x, y) => x - y), q = f => s.length ? Math.round(s[Math.min(s.length - 1, Math.floor(s.length * f))] * 10) / 10 : 0; return { n: s.length, med: q(.5), p95: q(.95), max: q(1), over50: s.filter(v => v > 50).length }; };
    const gaps = (t0, t1) => { const f = P.frames.filter(t => t >= t0 && t <= t1), g = []; for (let i = 1; i < f.length; i++) g.push(f[i] - f[i - 1]); return g; };
    P.report = (win = 1600) => ({ tier: ctl && ctl.tier, open: stat(P.marks.filter(m => m.k === 'open').flatMap(m => gaps(m.t, m.t + win))), close: stat(P.marks.filter(m => m.k === 'close').flatMap(m => gaps(m.t, m.t + win))), input: stat(P.inputs), each: P.marks.map(m => ({ k: m.k, id: m.id, ...stat(gaps(m.t, m.t + win)) })) });
    P.mem = () => { const r = ctl && ctl.renderer, m = performance.memory; return { heapMB: m ? Math.round(m.usedJSHeapSize / 104857.6) / 10 : null, geo: r ? r.info.memory.geometries : null, tex: r ? r.info.memory.textures : null, prog: r && r.info.programs ? r.info.programs.length : null }; };
    P.cycle = async (n = 24, gap = [1800, 1300]) => {   // 建物を順に開いて閉じる(n 回)。8 回ごとに記憶域を記録
      const wait = ms => new Promise(r => setTimeout(r, ms)), out = [{ i: 0, ...P.mem() }];
      for (let i = 0; i < n; i++) { openB(RING[i % RING.length], null, { focus: false }); await wait(gap[0]); closeB(false); await wait(gap[1]); if ((i + 1) % 8 === 0) out.push({ i: i + 1, ...P.mem() }); }
      return out;
    };
    window.__perf = P;
    return P;
  }
}
