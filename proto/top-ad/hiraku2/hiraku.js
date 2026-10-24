/* ================================================================
   「ひらく町」磨き込み — ページの動き(three.js は読まない)
   最初の訪問だけ、病院の足もとに柔らかい輪と「ふれてみる」の札(最初にふれたら消え、次の訪問では出さない)
   押した瞬間、その建物の足もとに輪が広がる。指が外れても、近い建物を選ぶ
   最初は止めた画像(見る人の時刻の昼・夕・夜)。読み込みが終わって手が空いたら、live.js を読んで立体と入れ替える
   ふれる → 建物がわずかに沈む → 島が回ってその建物が正面を向き、カメラが寄る → 前の壁が倒れ、屋根が抜け、中が見える
   パネル(PC は右、スマホは下からのシート)の行と、町の中の物は、乗せると互いに光る
   動きを減らす設定・WebGL なし: 止めた画像のまま。ひらくのは瞬時で、パネルにその建物の断面の止めた画像を出す
   ================================================================ */
import { BUILDINGS, BY_ID, TOOLS } from './data.js';

const Q = new URLSearchParams(location.search);
const R = document.documentElement;
if (Q.get('capture')) import('./live.js').then(m => m.capture(Q));
else boot();

function boot() {
  R.classList.add('js');
  const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const hero = $('#top'), canvas = $('#world'), still = $('#still'), poster = $('#poster');
  const tagB = $('#tagB'), tagS = $('#tagS'), hint = $('#hint'), say = $('#say'), nudge = $('#nudge'), rings = $('#rings');
  const panel = $('#panel'), pTitle = $('#pTitle'), pRole = $('#pRole'), pLine = $('#pLine'), pTools = $('#pTools'), pStill = $('#pStill');
  const hits = new Map($$('.hit').map(a => [a.dataset.id, a]));
  const reduceQ = matchMedia('(prefers-reduced-motion: reduce)');
  const reduce = () => reduceQ.matches || Q.get('still') === '1';
  const phone = () => innerWidth < 900;
  const save = !!(navigator.connection && navigator.connection.saveData);
  const TODS = ['day', 'dusk', 'night'];
  let ctl = null, openId = null, opener = null, touched = false, paused = false;
  let tagFor = null, tagTimer = 0, hoverId = null;
  const store = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 使えなくても壊れない */ } } };
  let nudgeOn = !store.get('bridge-hiraku-touched') && Q.get('nudge') !== '0';   // 最初の訪問だけ

  /* ---------- 昼・夕・夜(ボタンで 昼 → 夕 → 夜 → 昼) ---------- */
  const btnTod = $('#btnTod'), btnPause = $('#btnPause');
  const todLabel = () => ({ day: '夕方にする', dusk: '夜にする', night: '昼にする' })[R.dataset.tod];
  btnTod.setAttribute('aria-label', todLabel());
  btnTod.addEventListener('click', () => {
    const next = TODS[(TODS.indexOf(R.dataset.tod) + 1) % 3];
    if (!ctl) { const im = new Image(); im.src = poster.dataset[next]; (im.decode ? im.decode() : Promise.resolve()).catch(() => {}).then(() => { poster.src = im.src; R.dataset.tod = next; }); }
    else { R.dataset.tod = next; ctl.setTod(TODS.indexOf(next)); }
    btnTod.setAttribute('aria-label', todLabel());
    say.textContent = { day: '昼', dusk: '夕方', night: '夜' }[next] + 'になりました';
  });
  btnPause.addEventListener('click', () => {
    paused = btnPause.getAttribute('aria-pressed') !== 'true';
    btnPause.setAttribute('aria-pressed', String(paused)); btnPause.setAttribute('aria-label', paused ? '町の動きを再生する' : '町の動きを止める');
    if (ctl) ctl.setPaused(paused);
    if (paused) stopInvite(); else if (!touched) startInvite();
  });

  /* ---------- 見えないボタンと名前の札の位置(止めた画像のときは、撮ったときの位置から) ---------- */
  const heroRect = () => hero.getBoundingClientRect();
  function placeHit(a, cx, cy, w, h) { w = Math.max(44, w); h = Math.max(44, h); a.style.transform = `translate(${(cx - w / 2).toFixed(1)}px,${(cy - h / 2).toFixed(1)}px)`; a.style.width = w.toFixed(0) + 'px'; a.style.height = h.toFixed(0) + 'px'; }
  let tagPos = {}, footPos = {}, hitPos = {}, nudgePos = null;
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
    placeNudge();
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
  /* パネルの行: 本体は「中で見る」ボタン(その物に寄る)、右の「開く」は道具へのリンク。広場(考え方)は中がないので、行ぜんたいがリンク */
  const GO = '開く<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const mouseHover = matchMedia('(hover: hover) and (pointer: fine)');
  function fillPanel(id) {
    const b = BY_ID[id], inside = id !== 'plaza';
    panel.style.setProperty('--mk', b.mark);
    pRole.textContent = b.role; pTitle.textContent = b.name; pLine.textContent = b.line;
    pTools.innerHTML = ''; defSid = b.tools[0]; pinSid = hovSid = focSid = null;
    for (const tid of b.tools) {
      const t = TOOLS[tid], li = document.createElement('li'); li.className = 'prow'; li.dataset.sid = tid;
      const body = document.createElement(inside ? 'button' : 'a'); body.className = 'pfind';
      const nb = document.createElement('b'); nb.textContent = t.name;
      if (t.status) { const c = document.createElement('span'); c.className = 'chip'; c.textContent = t.status; nb.append(c); }
      const tt = document.createElement('span'); tt.className = 't'; tt.textContent = t.t;
      body.append(nb, tt);
      if (t.note || t.ext) { const n = document.createElement('span'); n.className = 'n'; n.textContent = t.note || '別のサイト'; body.append(n); }
      const go = document.createElement(inside ? 'a' : 'span'); go.className = 'go'; go.innerHTML = GO;
      const link = inside ? go : body;
      link.href = t.href; if (t.ext) { link.target = '_blank'; link.rel = 'noopener noreferrer'; }
      if (inside) {
        body.type = 'button'; body.setAttribute('aria-label', t.name + 'を中で見る'); body.setAttribute('aria-pressed', 'false');
        go.setAttribute('aria-label', t.name + 'を開く' + (t.ext ? '(別のサイト)' : ''));
        body.addEventListener('click', () => rowPick(tid));
        li.addEventListener('mouseenter', () => rowEnter(tid));
        for (const el of [body, go]) el.addEventListener('focus', () => { if (el.matches(':focus-visible')) { focSid = tid; applyFind(); } });
      }
      li.append(body, go); pTools.append(li);
    }
    // 動かないとき: その建物の断面の止めた画像
    const showStill = !ctl;
    pStill.hidden = !showStill;
    if (showStill) stillShot(null);
    markRow(defSid);
  }
  function markRow(sid) { for (const li of $$('.prow', pTools)) li.classList.toggle('on', li.dataset.sid === sid); }

  /* ---------- 道具を見つける: 行(PC は乗せる・Tab、スマホは行を押す)か中の物を押すと、その物に寄る。外すと建物ぜんたいに戻る ---------- */
  let defSid = null, pinSid = null, hovSid = null, focSid = null, hovT = 0;
  /* パネルが出た直後、止まっているマウスの下に来た行では寄らない(マウスを実際に動かしてから) */
  let mouseXY = [-1, -1], armXY = null;
  addEventListener('mousemove', e => { mouseXY = [e.clientX, e.clientY]; }, { passive: true });
  pTools.addEventListener('mousemove', e => { if (armXY && Math.hypot(e.clientX - armXY[0], e.clientY - armXY[1]) > 4) { armXY = null; const li = e.target.closest('.prow'); if (li) rowEnter(li.dataset.sid); } });
  const findNow = () => hovSid || focSid || pinSid;
  function applyFind() {
    const sid = findNow();
    markRow(sid || defSid);
    for (const li of $$('.prow', pTools)) { const bt = li.querySelector('button.pfind'); if (bt) bt.setAttribute('aria-pressed', String(li.dataset.sid === pinSid)); }
    if (ctl) { ctl.find(sid); ctl.stationHover(sid); showSTag(null); }   // 寄っているときは、画面そのものが答え(名前の札は出さない)
    else stillShot(sid);
  }
  function clearFind() { clearTimeout(hovT); pinSid = hovSid = focSid = null; }
  function rowEnter(sid) {
    if (!mouseHover.matches || armXY) return;
    markRow(sid); if (ctl) ctl.stationHover(sid);
    clearTimeout(hovT); hovT = setTimeout(() => { hovSid = sid; applyFind(); }, 110);   // 行の上を通り過ぎただけでは動かさない
  }
  pTools.addEventListener('mouseleave', () => { if (!mouseHover.matches) return; clearTimeout(hovT); hovT = setTimeout(() => { hovSid = null; applyFind(); }, 220); });
  pTools.addEventListener('focusout', e => { if (focSid && !pTools.contains(e.relatedTarget)) { focSid = null; applyFind(); } });
  function rowPick(sid) {
    const go = () => { pinSid = pinSid === sid ? null : sid; if (!pinSid && hovSid === sid) hovSid = null; applyFind(); };
    // スマホでシートを広げているときは、物が見える高さに戻してから寄る
    if (phone() && panel.classList.contains('full')) { panel.classList.remove('full'); setTimeout(go, 340); } else go();
  }
  /* 動かないとき(動きを減らす・WebGL なし): 寄る代わりに、その道具の画面をパネルに出す */
  function stillShot(sid) {
    const im = pStill.querySelector('img'), t = sid && TOOLS[sid], b = BY_ID[openId];
    im.onerror = null;
    if (t && t.thumb) { im.src = '../../../images/products/thumbs/' + t.thumb + '.webp'; im.alt = t.name + 'の画面'; }
    else if (b) { im.src = 'img/cut-' + openId + '.webp'; im.alt = b.name + 'の中。' + b.line + 'の道具が置かれている'; im.onerror = () => { im.onerror = null; im.src = 'img/b-' + openId + '.webp'; }; }
  }
  function openB(id, from) {
    if (openId === id) return;
    const wasOpen = !!openId;
    openId = id; opener = from || hits.get(id);
    showTag(null); hoverId = null; clearFind(); armXY = mouseXY.slice();
    fillPanel(id);
    R.classList.add('opened');
    if (ctl) ctl.open(id);
    const show = () => {
      panel.hidden = false; panel.classList.remove('full');
      pTitle.focus({ preventScroll: true });          // 描画が重い端末でも遅れないように、その場で移す
    };
    if (wasOpen || !ctl || reduce()) show(); else setTimeout(show, 260);
    say.textContent = BY_ID[id].name + 'がひらきました';
  }
  function closeB(back = true) {
    if (!openId) return;
    const id = openId; openId = null; clearFind();
    panel.hidden = true; R.classList.remove('opened'); showSTag(null);
    if (ctl) ctl.close();
    if (back && opener) opener.focus({ preventScroll: true });
    say.textContent = BY_ID[id].name + 'を閉じました';
  }
  $('#pClose').addEventListener('click', () => closeB());
  addEventListener('keydown', e => {
    if (e.key === 'Escape' && openId) { e.preventDefault(); closeB(); }
    if (e.key === 'Tab' && openId && !panel.hidden) {           // パネルの中を Tab で回る
      const f = $$('a,button,[tabindex="0"]', panel).filter(el => !el.hidden && el.offsetParent !== null);
      if (!f.length) return;
      const first = f[0], lastEl = f[f.length - 1];
      if (!panel.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
      else if (e.shiftKey && (document.activeElement === first || document.activeElement === pTitle)) { e.preventDefault(); lastEl.focus(); }
      else if (!e.shiftKey && document.activeElement === lastEl) { e.preventDefault(); first.focus(); }
    }
  });

  /* ---------- スマホのシート: 上に引くと広がる、下に払うと閉じる ---------- */
  const grab = $('#pGrab');
  let drag = null;
  const sheetDown = e => { if (!phone()) return; drag = { y: e.clientY, h: panel.getBoundingClientRect().height, t: performance.now() }; panel.style.transition = 'none'; e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId); };
  const sheetMove = e => { if (!drag) return; const dy = e.clientY - drag.y; panel.style.height = Math.max(120, Math.min(innerHeight * .88, drag.h - dy)) + 'px'; };
  const sheetUp = e => {
    if (!drag) return;
    const dy = e.clientY - drag.y, v = dy / Math.max(1, performance.now() - drag.t);
    panel.style.transition = ''; panel.style.height = '';
    if (dy > 70 || v > .6) closeB(); else if (dy < -40) panel.classList.add('full'); else if (dy > 30) panel.classList.remove('full');
    drag = null;
  };
  for (const el of [grab, $('.p-head')]) { el.addEventListener('pointerdown', e => { if (e.target.closest('button')) return; sheetDown(e); }); el.addEventListener('pointermove', sheetMove); el.addEventListener('pointerup', sheetUp); el.addEventListener('pointercancel', sheetUp); }

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
  function hasWebGL() { try { const c = document.createElement('canvas'); return !!(window.WebGL2RenderingContext && c.getContext('webgl2')); } catch (e) { return false; } }
  function upgrade() {
    if (reduce() || save || !hasWebGL() || Q.get('static') === '1') return;
    const t0 = performance.now(); swap.start = t0;
    const mod = Q.get('stub') === '1' ? import('./interiors-stub.js') : import('./interiors.js').then(m => { if (typeof m.buildInterior !== 'function') throw new Error('no buildInterior'); return m; }).catch(() => import('./interiors-stub.js'));
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
          const pw = Math.min(400, innerWidth * .34) + 48;
          return { l: 40, t: 90, r: w - pw - 16, b: h - 36 };
        },
        onHover(id) { hoverId = id; if (openId) return; if (id) { firstTouchSoft(); showTag(id, true, true); } else showTag(null); },
        onPress(id) { firstTouch(); ringAt(id); },
        onQuality(q) { store.set('bridge-hiraku-q', q); },
        onPick(id) { firstTouch(); if (id === openId) { if (findNow()) { clearFind(); applyFind(); } return; } openB(id, hits.get(id)); },
        onEmpty() { if (!openId) return; if (findNow()) { clearFind(); applyFind(); } else closeB(false); },   // 寄っているときは、まず建物ぜんたいに戻る
        onStation(sid, how) {
          if (!openId) return;
          if (how === 'tap' && sid) { pinSid = sid; applyFind(); const li = $(`.prow[data-sid="${CSS.escape(sid)}"]`, pTools); if (li) li.scrollIntoView({ block: 'nearest', behavior: reduce() ? 'auto' : 'smooth' }); return; }
          if (sid) { markRow(sid); if (!findNow()) showSTag(sid); } else { markRow(findNow() || defSid); showSTag(null); }
        },
        onLayout(L2) {
          const hr = heroRect(), cr = canvas.getBoundingClientRect(), ox = cr.left - hr.left, oy = cr.top - hr.top;
          for (const [id, a] of hits) { const p = L2.b[id]; if (!p) continue; tagPos[id] = [ox + p.tag[0], oy + p.tag[1]]; footPos[id] = [ox + p.foot[0], oy + p.foot[1]]; if (p.nudge) nudgePos = [ox + p.nudge[0], oy + p.nudge[1]]; placeHit(a, ox + p.c[0], oy + p.c[1], 64, 64); }
          placeNudge();
          if (tagFor) { const [x, y] = tagXY(tagPos[tagFor], 64); tagB.style.left = x.toFixed(1) + 'px'; tagB.style.top = y.toFixed(1) + 'px'; }
          sPos = {}; for (const s of L2.st) sPos[s.id] = { x: ox + s.x, y: oy + s.y - 14, label: s.label };
          if (sTagFor) showSTag(sTagFor);
        },
        onOpened() {},
        onClosed() {}
      });
      window.__ctl = ctl; window.__t3 = Math.round(performance.now() - t0); swap.live = performance.now();
      if (paused) ctl.setPaused(true);
      requestAnimationFrame(() => R.classList.add('live'));
    }).catch(err => console.warn(err));
  }
  function firstTouchSoft() { /* 乗せただけでは誘いを止めない(PC の誘いは、乗せている間だけ休む) */ }
  const idle = f => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 1500 }) : setTimeout(f, 300));
  if (document.readyState === 'complete') idle(upgrade); else addEventListener('load', () => idle(upgrade));

  /* ---------- 下の節: 帯が画面に入ると、閉じた肖像から、ひらいた中へ(前の壁が倒れる向き。1回だけ) ----------
     JS なし・動きを減らす設定では、最初からひらいた絵 */
  const pairs = $$('.pair[data-wipe]');
  if (pairs.length && !reduce() && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(es => {
      for (const en of es) {
        if (!en.isIntersecting) continue;
        const f = en.target; io.unobserve(f);
        const go = () => { f.classList.add('go'); requestAnimationFrame(() => requestAnimationFrame(() => f.classList.remove('armed'))); };
        // 閉じた絵とひらいた絵の両方が読めてから(読めないときも、待ちすぎない)
        const ims = [...f.querySelectorAll('img')].filter(im => !im.complete);
        Promise.race([Promise.all(ims.map(im => new Promise(r => { im.addEventListener('load', r, { once: true }); im.addEventListener('error', r, { once: true }); }))), new Promise(r => setTimeout(r, 2500))]).then(() => setTimeout(go, 160));
      }
    }, { threshold: .55 });
    for (const f of pairs) { f.classList.add('armed'); io.observe(f); }
  }

  /* 下の案内から直接 #g-hospital などで来たとき: そのまま(リンクの一覧が答え) */
}
