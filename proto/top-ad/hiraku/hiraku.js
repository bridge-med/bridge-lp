/* ================================================================
   融合3「ひらく町」— ページの動き(three.js は読まない)
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
  const tagB = $('#tagB'), tagS = $('#tagS'), hint = $('#hint'), say = $('#say');
  const panel = $('#panel'), pTitle = $('#pTitle'), pRole = $('#pRole'), pLine = $('#pLine'), pTools = $('#pTools'), pStill = $('#pStill');
  const hits = new Map($$('.hit').map(a => [a.dataset.id, a]));
  const reduceQ = matchMedia('(prefers-reduced-motion: reduce)');
  const reduce = () => reduceQ.matches || Q.get('still') === '1';
  const phone = () => innerWidth < 900;
  const save = !!(navigator.connection && navigator.connection.saveData);
  const TODS = ['day', 'dusk', 'night'];
  let ctl = null, openId = null, opener = null, touched = false, paused = false;
  let tagFor = null, tagTimer = 0, hoverId = null;

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
  let tagPos = {};
  function stillLayout() {
    if (ctl) return;
    const hr = heroRect(), br = still.getBoundingClientRect(); if (!br.width) return;
    for (const [id, a] of hits) {
      const [x0, y0, x1, y1] = a.dataset.box.split(',').map(Number), [tx, ty] = a.dataset.tag.split(',').map(Number);
      const L = br.left - hr.left, T = br.top - hr.top;
      placeHit(a, L + (x0 + x1) / 200 * br.width, T + (y0 + y1) / 200 * br.height, (x1 - x0) / 100 * br.width, (y1 - y0) / 100 * br.height);
      tagPos[id] = [L + tx / 100 * br.width, T + ty / 100 * br.height];
    }
    if (tagFor) showTag(tagFor, true);
  }
  addEventListener('resize', () => { stillLayout(); if (ctl) ctl.resize(); });
  stillLayout();
  poster.addEventListener('load', stillLayout);

  /* ---------- 名前の札 ---------- */
  function showTag(id, on, sub) {
    clearTimeout(tagTimer);
    if (!on || !id) { tagB.classList.remove('on'); tagFor = null; return; }
    const b = BY_ID[id], p = tagPos[id]; if (!b || !p) return;
    tagFor = id;
    tagB.innerHTML = '';
    tagB.append(b.name); if (sub) { const s = document.createElement('small'); s.textContent = b.role; tagB.append(s); }
    tagB.style.left = p[0].toFixed(1) + 'px'; tagB.style.top = p[1].toFixed(1) + 'px';
    tagB.classList.add('on');
  }
  let sTagFor = null, sPos = {};
  function showSTag(sid) {
    if (!sid || !sPos[sid]) { tagS.classList.remove('on'); sTagFor = null; return; }
    sTagFor = sid; tagS.textContent = sPos[sid].label;
    tagS.style.left = sPos[sid].x.toFixed(1) + 'px'; tagS.style.top = (sPos[sid].y - 8).toFixed(1) + 'px'; tagS.classList.add('on');
  }

  /* ---------- 誘い: 数秒おきに、建物のひとつがふっと明るくなり、短い名前の札が一瞬出て消える。最初にふれたら止める ---------- */
  const ORDER = ['observatory', 'clinic', 'library', 'office', 'atelier', 'park', 'hospital'];
  let invT = 0, invI = 0;
  function startInvite() {
    if (reduce() || touched || paused) return;
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
    if (touched) return; touched = true; stopInvite();
    hint.classList.add('gone'); setTimeout(() => { hint.hidden = true; }, 700);
  }
  startInvite();

  /* ---------- 建物にふれる → ひらく ---------- */
  for (const [id, a] of hits) {
    a.setAttribute('role', 'button'); a.setAttribute('aria-haspopup', 'dialog');
    a.addEventListener('click', e => { e.preventDefault(); firstTouch(); openB(id, a); });
    a.addEventListener('keydown', e => { if (e.key === ' ') { e.preventDefault(); a.click(); } });
    a.addEventListener('focus', () => { if (openId) return; hoverId = id; showTag(id, true, true); if (ctl) ctl.hover(id); });
    a.addEventListener('blur', () => { if (hoverId === id) { hoverId = null; if (!openId) showTag(null); if (ctl) ctl.hover(null); } });
    a.addEventListener('mouseenter', () => { if (ctl || openId) return; showTag(id, true, true); });
    a.addEventListener('mouseleave', () => { if (ctl || openId) return; showTag(null); });
  }
  function fillPanel(id) {
    const b = BY_ID[id];
    panel.style.setProperty('--mk', b.mark);
    pRole.textContent = b.role; pTitle.textContent = b.name; pLine.textContent = b.line;
    pTools.innerHTML = '';
    for (const tid of b.tools) {
      const t = TOOLS[tid], li = document.createElement('li'), a = document.createElement('a');
      a.className = 'ptool'; a.href = t.href; a.dataset.sid = tid;
      if (t.ext) { a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      const nb = document.createElement('b'); nb.textContent = t.name;
      if (t.status) { const c = document.createElement('span'); c.className = 'chip'; c.textContent = t.status; nb.append(c); }
      const tt = document.createElement('span'); tt.className = 't'; tt.textContent = t.t;
      a.append(nb, tt);
      if (t.note || t.ext) { const n = document.createElement('span'); n.className = 'n'; n.textContent = [t.ext ? '別のサイト' : '', t.note].filter(Boolean).join('・'); a.append(n); }
      const go = document.createElement('span'); go.className = 'go'; go.innerHTML = '開く<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
      a.append(go);
      a.addEventListener('mouseenter', () => rowHover(tid, true)); a.addEventListener('mouseleave', () => rowHover(tid, false));
      a.addEventListener('focus', () => rowHover(tid, true)); a.addEventListener('blur', () => rowHover(tid, false));
      li.append(a); pTools.append(li);
    }
    // 動かないとき: その建物の断面の止めた画像
    const showStill = !ctl;
    pStill.hidden = !showStill;
    if (showStill) { const im = pStill.querySelector('img'); im.src = 'img/cut-' + id + '.webp'; im.alt = b.name + 'の中。' + b.line + 'の道具が置かれている'; im.onerror = () => { im.onerror = null; im.src = 'img/b-' + id + '.webp'; }; }
    markRow(b.tools[0]);
  }
  function markRow(sid) { for (const a of $$('.ptool', pTools)) a.classList.toggle('on', a.dataset.sid === sid); }
  function rowHover(sid, on) {
    if (on) { markRow(sid); if (ctl) ctl.stationHover(sid); requestAnimationFrame(() => showSTag(sid)); }
    else { if (ctl) ctl.stationHover(null); showSTag(null); }
  }
  function openB(id, from) {
    if (openId === id) return;
    const wasOpen = !!openId;
    openId = id; opener = from || hits.get(id);
    showTag(null); hoverId = null;
    fillPanel(id);
    R.classList.add('opened');
    if (ctl) ctl.open(id);
    const show = () => {
      panel.hidden = false; panel.classList.remove('full');
      requestAnimationFrame(() => { pTitle.focus({ preventScroll: true }); });
    };
    if (wasOpen || !ctl || reduce()) show(); else setTimeout(show, 260);
    say.textContent = BY_ID[id].name + 'がひらきました';
  }
  function closeB(back = true) {
    if (!openId) return;
    const id = openId; openId = null;
    panel.hidden = true; R.classList.remove('opened'); showSTag(null);
    if (ctl) ctl.close();
    if (back && opener) { const o = opener; requestAnimationFrame(() => o.focus({ preventScroll: true })); }
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
  function hasWebGL() { try { const c = document.createElement('canvas'); return !!(window.WebGL2RenderingContext && c.getContext('webgl2')); } catch (e) { return false; } }
  function upgrade() {
    if (reduce() || save || !hasWebGL() || Q.get('static') === '1') return;
    const t0 = performance.now();
    const mod = Q.get('stub') === '1' ? import('./interiors-stub.js') : import('./interiors.js').then(m => { if (typeof m.buildInterior !== 'function') throw new Error('no buildInterior'); return m; }).catch(() => import('./interiors-stub.js'));
    import('./live.js').then(L => {
      ctl = L.live({
        canvas, box: still, tod: TODS.indexOf(R.dataset.tod), mod, reduce,
        safe() {
          const w = canvas.clientWidth, h = canvas.clientHeight;
          if (phone()) return { l: 10, t: 64, r: w - 10, b: h - Math.round(innerHeight * .45) - 6 };
          const pw = Math.min(400, innerWidth * .34) + 48;
          return { l: 40, t: 90, r: w - pw - 16, b: h - 36 };
        },
        onHover(id) { hoverId = id; if (openId) return; if (id) { firstTouchSoft(); showTag(id, true, true); } else showTag(null); },
        onPress() { firstTouch(); },
        onPick(id) { firstTouch(); if (id === openId) return; openB(id, hits.get(id)); },
        onEmpty() { if (openId) closeB(false); },
        onStation(sid, how) { if (!openId) return; if (sid) { markRow(sid); showSTag(sid); } else showSTag(null); if (how === 'tap' && sid) { const a = $(`.ptool[data-sid="${CSS.escape(sid)}"]`, pTools); if (a) a.scrollIntoView({ block: 'nearest', behavior: reduce() ? 'auto' : 'smooth' }); } },
        onLayout(L2) {
          const hr = heroRect(), cr = canvas.getBoundingClientRect(), ox = cr.left - hr.left, oy = cr.top - hr.top;
          for (const [id, a] of hits) { const p = L2.b[id]; if (!p) continue; tagPos[id] = [ox + p.tag[0], oy + p.tag[1]]; placeHit(a, ox + p.c[0], oy + p.c[1], 64, 64); }
          if (tagFor) { const p = tagPos[tagFor]; tagB.style.left = p[0].toFixed(1) + 'px'; tagB.style.top = p[1].toFixed(1) + 'px'; }
          sPos = {}; for (const s of L2.st) sPos[s.id] = { x: ox + s.x, y: oy + s.y - 14, label: s.label };
          if (sTagFor) showSTag(sTagFor);
        },
        onOpened() {},
        onClosed() {}
      });
      window.__ctl = ctl; window.__t3 = Math.round(performance.now() - t0);
      if (paused) ctl.setPaused(true);
      requestAnimationFrame(() => R.classList.add('live'));
    }).catch(err => console.warn(err));
  }
  function firstTouchSoft() { /* 乗せただけでは誘いを止めない(PC の誘いは、乗せている間だけ休む) */ }
  const idle = f => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 1500 }) : setTimeout(f, 300));
  if (document.readyState === 'complete') idle(upgrade); else addEventListener('load', () => idle(upgrade));

  /* 下の案内から直接 #g-hospital などで来たとき: そのまま(リンクの一覧が答え) */
}
