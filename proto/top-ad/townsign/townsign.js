/* ================================================================
   融合1「町の案内板」— ページの動き(three.js は読まない)
   最初は止めた画像と、そこに立つ目印(行き先の色のタイル)と町の案内図。読み込みが終わって手が空いたら、town3d.js を読んで立体と入れ替える
   入るとき: 町が建物に寄る → 行き先の色が建物から広がる → その行き先のロビーに着く(動きを減らす設定では、すぐに着く)
   ================================================================ */
const Q = new URLSearchParams(location.search);
const R = document.documentElement;
if (Q.get('capture')) import('./town3d.js').then(m => m.capture(Q));
else boot();

function boot() {
  R.classList.add('js');
  const $ = (s, el = document) => el.querySelector(s), $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const DEST = {
    hospital: { n: 1, name: '業務', c: 'var(--c-work)' }, observatory: { n: 2, name: 'キャリア', c: 'var(--c-career)' },
    clinic: { n: 3, name: '経営を学ぶ', c: 'var(--c-learn)' }, office: { n: 4, name: '経営・管理', c: 'var(--c-manage)' },
    library: { n: 5, name: '学習', c: 'var(--c-study)' }, park: { n: 6, name: '試す・作品', c: 'var(--c-play)', on: 'var(--ink)' },
    atelier: { n: 7, name: '運営者', c: 'var(--c-info)' }
  };
  const ids = Object.keys(DEST);
  const box = $('#still'), canvas = $('#town'), hero = $('#top'), stage = $('#stage');
  const marks = new Map($$('.mk').map(p => [p.dataset.id, p]));
  const rows = new Map($$('.row').map(r => [r.dataset.id, r]));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const save = !!(navigator.connection && navigator.connection.saveData);
  const motion = () => !reduce.matches && Q.get('still') !== '1';
  const arrive = $('#arrive'), hint = $('#hint');
  let ctl = null, busy = false, skip = null, hurried = false;

  /* ---------- 目印の重なりをなくす(画面上の位置で判定) ----------
     目印は押せる範囲(44px)どうしが重ならないように、柱を伸ばして上へ、または少し横へずらす(柱はタイルの下に残る範囲で)。
     見出し・入口・操作ボタンの上にも置かない。名前の札が枠の右にはみ出すときは、左へ伸ばす */
  const PRI = ['hospital', 'observatory', 'clinic', 'office', 'library', 'park', 'atelier'];
  const NUDGE = [[0, 0], [0, -12], [-10, 0], [10, 0], [0, -24], [-10, -12], [10, -12], [0, 8], [-14, 6], [14, 6], [0, -36], [-14, -24], [14, -24], [0, -48]];
  const PM = new Map();
  let T = 36, POLE = 22, LIM = 1e9;
  function measure() {
    for (const [id, el] of marks) PM.set(id, { lbw: el.querySelector('.mkl').offsetWidth });
    const cs = getComputedStyle(marks.values().next().value);
    T = parseFloat(cs.getPropertyValue('--t')) || 36; POLE = parseFloat(cs.getPropertyValue('--pole')) || 22;
  }
  /* 見出しは、文字のある行だけをよける(行の右の空いた所には目印を置ける) */
  function textRects(el) {
    const out = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), rg = document.createRange();
    for (let n = w.nextNode(); n; n = w.nextNode()) { if (!n.nodeValue.trim()) continue; rg.selectNodeContents(n); out.push(...rg.getClientRects()); }
    return out;
  }
  function obstacles() {
    const br = box.getBoundingClientRect(), out = [];
    LIM = Math.min(document.documentElement.clientWidth, stage.getBoundingClientRect().right) - br.left - 6;
    for (const q of ['.hd .logo', '.hd .nav', '.info', '.cta-wrap', '.tools', '.hint', '.dir']) {
      const e = $(q); if (!e) continue;
      const cs = getComputedStyle(e); if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) continue;
      for (const r of q === '.info' ? textRects(e) : [e.getBoundingClientRect()]) {
        if (!r.width || !r.height) continue;
        out.push({ x0: r.left - br.left - 4, x1: r.right - br.left + 4, y0: r.top - br.top, y1: r.bottom - br.top });
      }
    }
    return out;
  }
  let OBS = [];
  function declutter(items) {
    items.sort((a, b) => PRI.indexOf(a.id) - PRI.indexOf(b.id));
    const h = 22 + 2;
    const rect = (it, dx, dy) => { const cx = it.x + dx, cy = it.y - (POLE - dy) - T / 2; return { x0: cx - h, x1: cx + h, y0: cy - h, y1: cy + h }; };
    const area = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
    const cost = (r, list) => list.reduce((s, o) => s + area(r, o), 0);
    const placed = OBS.slice();
    for (const it of items) {
      let best = null;
      for (const [dx, dy] of NUDGE) {
        if (POLE - dy < 8) continue;
        const r = rect(it, dx, dy), k = cost(r, placed);
        if (!best || k < best.k) best = { dx, dy, r, k };
        if (!k) break;
      }
      Object.assign(it, best); placed.push(best.r);
    }
    for (const it of items) {
      const el = marks.get(it.id);
      el.style.setProperty('--nx', it.dx + 'px'); el.style.setProperty('--ny', it.dy + 'px');
      el.classList.toggle('flip', it.x + it.dx + T / 2 + PM.get(it.id).lbw > LIM);
    }
  }
  /* 止めた画像のとき: 撮ったときの位置(枠の % )から */
  function stillLayout() {
    if (ctl) return;
    const br = box.getBoundingClientRect(); if (!br.width) return;
    measure(); OBS = obstacles();
    const items = [];
    for (const [id, el] of marks) {
      const [x, y] = (el.dataset.pos || '50,50').split(',').map(Number), px = x / 100 * br.width, py = y / 100 * br.height;
      el.style.transform = `translate3d(${px.toFixed(1)}px,${py.toFixed(1)}px,0)`; el.style.zIndex = String(Math.round(py));
      items.push({ id, x: px, y: py });
    }
    declutter(items);
  }
  addEventListener('resize', () => { if (ctl) { measure(); OBS = obstacles(); } else stillLayout(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { measure(); OBS = obstacles(); stillLayout(); });
  stillLayout();

  /* ---------- 立体のとき: 毎フレームの位置から(canvas の座標 → 枠の座標) ---------- */
  let offX = 0, offY = 0;
  function liveOffsets() { const cr = canvas.getBoundingClientRect(), br = box.getBoundingClientRect(); offX = cr.left - br.left; offY = cr.top - br.top; }
  function onPins(items, focused) {
    for (const it of items) {
      it.x += offX; it.y += offY;
      const el = marks.get(it.id);
      el.style.transform = `translate3d(${it.x.toFixed(1)}px,${it.y.toFixed(1)}px,0)`;
      el.style.zIndex = String(100 - Math.round(it.depth * 3));
    }
    if (!focused) declutter(items);
  }

  /* ---------- 案内図の行・目印・建物: 光らせる(目印は名前を横に伸ばす) ---------- */
  let hiId = null;
  function hi(id) {
    if (hiId === id) return; hiId = id;
    for (const [k, r] of rows) r.classList.toggle('lit', k === id);
    for (const [k, p] of marks) p.classList.toggle('is-hi', k === id);
    if (ctl && !busy) ctl.highlight(id);
  }
  /* マウスで行をなぞっただけでは町を回さない(少し止まったら、建物をこちらへ向ける) */
  let dwell = 0;
  for (const [id, r] of rows) {
    r.addEventListener('mouseenter', () => { hi(id); clearTimeout(dwell); if (ctl && fine.matches && !busy) dwell = setTimeout(() => { if (hiId === id && !busy) ctl.face(id); }, 220); });
    r.addEventListener('focus', () => { hi(id); if (ctl && !busy) ctl.face(id); });
    r.addEventListener('mouseleave', () => { clearTimeout(dwell); if (!busy) hi(null); });
    r.addEventListener('blur', () => { if (!busy) hi(null); });
  }
  /* 目印: 乗せた・フォーカスした・押したときに名前を出す(押したまま町が寄るあいだも出しておく) */
  for (const [id, p] of marks) {
    p.addEventListener('mouseenter', () => hi(id));
    p.addEventListener('focus', () => hi(id));
    p.addEventListener('pointerdown', () => hi(id));
    p.addEventListener('mouseleave', () => { if (!busy) hi(null); });
    p.addEventListener('blur', () => { if (!busy) hi(null); });
  }

  /* ---------- 入る ---------- */
  const iris = $('.iris'), irisN = $('[data-in]'), irisName = $('[data-iname]');
  const wait = ms => hurried ? Promise.resolve('skip') : new Promise(res => { const t = setTimeout(res, ms); skip = () => { clearTimeout(t); res('skip'); }; });
  /* Esc か、色の面を押したら: 寄る途中でも広がる途中でも、すぐに着く */
  function hurry() { hurried = true; if (ctl) ctl.hurry(); if (skip) skip(); }
  function done() {
    iris.classList.remove('run', 'on', 'out'); skip = null;
    R.classList.remove('focused'); if (ctl) ctl.reset();
    busy = false; hi(null);
  }
  function land(id) {
    const d = DEST[id], sec = document.getElementById('l' + d.n); if (!sec) return;
    const sb = R.style.scrollBehavior; R.style.scrollBehavior = 'auto';
    scrollTo(0, sec.getBoundingClientRect().top + pageYOffset);
    R.style.scrollBehavior = sb;
    const h = sec.querySelector('h2'); if (h) h.focus({ preventScroll: true });
    try { history.replaceState(null, '', '#l' + d.n); } catch (e) {}
    arrive.textContent = d.n + ' ' + d.name + 'に着きました';
    markRide(id);
  }
  async function go(id, from) {
    if (busy || !DEST[id]) return;
    hideHint(); hi(id);
    const d = DEST[id];
    if (!motion()) { land(id); hi(null); return; }
    busy = true; hurried = false;
    let origin = null;
    const heroOn = hero.getBoundingClientRect().bottom > innerHeight * .35;
    if (ctl && heroOn) { R.classList.add('focused'); origin = await ctl.zoomTo(id); }
    if (hurried) { land(id); done(); return; }
    if (!origin && from) { const r = from.getBoundingClientRect(); origin = { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }
    if (!origin) origin = { x: innerWidth / 2, y: innerHeight / 2 };
    iris.style.setProperty('--c', d.c); iris.style.setProperty('--on', d.on || '#fff');
    iris.style.setProperty('--x', origin.x + 'px'); iris.style.setProperty('--y', origin.y + 'px');
    irisN.textContent = d.n; irisName.textContent = d.name;
    iris.classList.remove('out', 'on'); iris.classList.add('run'); void iris.offsetWidth; iris.classList.add('on');
    let s = await wait(560);
    land(id);
    if (s !== 'skip') s = await wait(160);
    iris.classList.add('out');
    await wait(s === 'skip' ? 0 : 340);
    done();
  }
  iris.addEventListener('click', () => { if (busy) hurry(); });
  addEventListener('keydown', e => { if (e.key === 'Escape' && busy) hurry(); });
  for (const [id, r] of rows) r.addEventListener('click', e => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; e.preventDefault(); go(id, r); });
  for (const [id, p] of marks) p.addEventListener('click', e => { e.preventDefault(); go(id, p.querySelector('.tg')); });

  /* ---------- 町を離れたあとの、ほかの行き先(右端/画面下) ---------- */
  const ride = $('.ride'), rideLinks = $$('.ride a[data-id]');
  function markRide(id) { rideLinks.forEach(a => { const on = a.dataset.id === id; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); }); }
  let ticking = false;
  function rideCheck() { ticking = false; const show = pageYOffset > hero.offsetHeight * .6; ride.classList.toggle('show', show); document.body.classList.toggle('has-ride', show); }
  addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(rideCheck); } }, { passive: true });
  rideCheck();
  rideLinks.forEach(a => a.addEventListener('click', e => { e.preventDefault(); go(a.dataset.id, a); }));
  function toTown(e) {
    e.preventDefault();
    const smooth = motion();
    scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
    const t = $('#dirTitle'); setTimeout(() => t.focus({ preventScroll: true }), smooth ? 500 : 0);
    try { history.replaceState(null, '', location.pathname + location.search); } catch (er) {}
  }
  $('.ride a.town').addEventListener('click', toTown);
  $$('.back').forEach(a => a.addEventListener('click', toTown));
  if ('IntersectionObserver' in window) {
    const spy = new IntersectionObserver(es => { if (busy) return; es.forEach(e => { if (e.isIntersecting) markRide(e.target.dataset.id); }); }, { rootMargin: '-45% 0px -54% 0px' });
    $$('.lobby').forEach(l => spy.observe(l));
  }

  /* ---------- 町の操作 ---------- */
  const btnNight = $('#btnNight'), btnPause = $('#btnPause');
  btnNight.addEventListener('click', () => {
    const on = !R.classList.contains('night'); R.classList.toggle('night', on); btnNight.setAttribute('aria-pressed', String(on));
    btnNight.setAttribute('aria-label', on ? '昼にする' : '夜にする'); if (ctl) ctl.setNight(on); hideHint();
  });
  btnPause.addEventListener('click', () => {
    const p = btnPause.getAttribute('aria-pressed') !== 'true'; btnPause.setAttribute('aria-pressed', String(p));
    btnPause.setAttribute('aria-label', p ? '町の動きを再生する' : '町の動きを止める'); if (ctl) ctl.setPaused(p);
  });
  $('#btnLeft').addEventListener('click', () => { hideHint(); if (ctl) ctl.rotateBy(-45); });
  $('#btnRight').addEventListener('click', () => { hideHint(); if (ctl) ctl.rotateBy(45); });
  function hideHint() { if (hint && !hint.classList.contains('is-gone')) { hint.classList.add('is-gone'); setTimeout(() => { hint.hidden = true; }, 400); } }

  /* ---------- 画面を映すもの: 切り替え(案内端末・スクリーン・ディスプレイ)と、大きく見る(C と同じ) ---------- */
  const lb = $('.lb'), lbImg = lb.querySelector('img'), lbRn = lb.querySelector('.lb-t .rn'), lbName = lb.querySelector('[data-lbname]'), lbGo = lb.querySelector('[data-lbgo]');
  let opener = null;
  function openLB(o, from) {
    opener = from; lbImg.src = o.img; lbImg.alt = o.alt || '';
    lb.classList.toggle('tall', /shots\/(compass-result|tanaoroshi|iikae|moyamoya|keiji|yawagaeshi|gacha|futatsume)\.webp$/.test(o.img));
    lbRn.textContent = o.rn; lbName.textContent = o.name; lbGo.href = o.href;
    if (/^https?:/.test(o.href)) { lbGo.target = '_blank'; lbGo.rel = 'noopener noreferrer'; } else { lbGo.removeAttribute('target'); lbGo.removeAttribute('rel'); }
    if (lb.showModal) lb.showModal(); else lb.setAttribute('open', '');
    lb.querySelector('[data-lbclose]').focus();
  }
  lb.querySelector('[data-lbclose]').addEventListener('click', () => lb.close());
  lb.addEventListener('click', e => { if (e.target === lb) lb.close(); });
  lb.addEventListener('close', () => { if (opener) opener.focus(); });
  const dataOf = el => ({ img: el.getAttribute('data-img'), alt: el.getAttribute('data-alt'), rn: el.getAttribute('data-rn'), name: el.getAttribute('data-name'), href: el.getAttribute('data-href') });
  $$('.zoom[data-img]').forEach(z => { z.disabled = false; z.addEventListener('click', () => openLB(dataOf(z), z)); });
  $$('[data-chan]').forEach(fig => {
    const lob = fig.closest('.lobby'), img = fig.querySelector('img'), rn = fig.querySelector('.now .rn'), nm = fig.querySelector('.now .nm'), zb = fig.querySelector('.zoom');
    const chans = $$('.chans li', fig).map(dataOf), links = $$('[data-ch]', lob);
    let at = 0;
    const mark = () => links.forEach(l => l.classList.toggle('cur', +l.getAttribute('data-ch') === at));
    function show(i) {
      i = (i + chans.length) % chans.length; if (i === at) { mark(); return; }
      at = i; const c = chans[at]; img.classList.add('out');
      const pre = new Image(); pre.src = c.img;
      const swap = () => { img.src = c.img; img.alt = c.alt; img.classList.remove('out'); };
      if (!motion()) swap(); else (pre.decode ? pre.decode().then(swap, swap) : setTimeout(swap, 120));
      rn.textContent = c.rn; nm.textContent = c.name; mark();
    }
    links.forEach(l => { const i = +l.getAttribute('data-ch'); l.addEventListener('mouseenter', () => show(i)); l.addEventListener('focus', () => show(i)); });
    $$('[data-step]', fig).forEach(b => b.addEventListener('click', () => show(at + (+b.getAttribute('data-step')))));
    zb.disabled = false; zb.addEventListener('click', () => openLB(chans[at], zb));
  });

  /* 直接 #l3 などで開いたとき */
  const m = /^#l([1-7])$/.exec(location.hash);
  if (m) { const id = ids[+m[1] - 1]; requestAnimationFrame(() => land(id)); }

  /* ---------- 立体と入れ替える(読み込みのあと、手が空いたときに) ---------- */
  function hasWebGL() { try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; } }
  function upgrade() {
    /* 立体にしないときは、夜の止めた画像を先に読んでおく(立体のときは要らない) */
    if (!motion() || save || !hasWebGL()) { R.classList.add('warm'); return; }
    import('./town3d.js').then(mod => {
      liveOffsets(); measure(); OBS = obstacles();
      ctl = mod.live({
        canvas, box,
        onPins,
        onHover: id => hi(id),
        onPick: id => go(id, marks.get(id).querySelector('.tg'))
      });
      window.__town = ctl;
      requestAnimationFrame(() => R.classList.add('live'));
      addEventListener('resize', liveOffsets);
    }).catch(err => { console.warn(err); });
  }
  const idle = f => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 1500 }) : setTimeout(f, 300));
  if (document.readyState === 'complete') idle(upgrade); else addEventListener('load', () => idle(upgrade));
}
