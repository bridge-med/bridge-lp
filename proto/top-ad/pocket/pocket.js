/* 案A「白衣のポケット」— 平置きの面を触れるようにする
   - 面の単位 --u を幅から決める(PC は 1440×900 の面を画面に収める。スマホは 390 幅)
   - 最初の一度だけ、散らばった物がそろう(動きを減らす設定では、そろった姿から)
   - つかんで動かす(マウスはドラッグ、指は長押し)。矢印キーでも動く
   - 「ちらかす/整える」
   - BRIDGE の道具は、押すと手に取れる(持ち上がって大きくなり、開く)。札に一行と入口 */
(function () {
  'use strict';
  var R = document.documentElement;
  var board = document.getElementById('board');
  if (!board) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- 面の単位 ---------- */
  var U = 1, mq = matchMedia('(max-width: 759px)');
  function measure() {
    var cw = document.documentElement.clientWidth;
    var u = mq.matches ? cw / 390 : Math.min(cw, window.innerHeight * 1.6) / 1440;
    var ratio = u / U;
    U = u;
    board.style.setProperty('--u', u + 'px');
    return ratio;
  }
  measure();

  /* ---------- 時計(いまの時刻。分の単位でだけ動く) ---------- */
  function clock() {
    var d = new Date(), h = d.getHours() % 12, m = d.getMinutes();
    var w = board.querySelector('.watch');
    if (w) { w.style.setProperty('--wh', (h + m / 60) * 30 + 'deg'); w.style.setProperty('--wm', m * 6 + 'deg'); }
  }
  clock(); setInterval(clock, 30000);

  /* ---------- 物の状態 ---------- */
  var objs = Array.prototype.slice.call(board.querySelectorAll('.obj.tool, .obj.item, h1.obj'));
  var S = new Map();
  objs.forEach(function (el) { S.set(el, { dx: 0, dy: 0, r: 0 }); });
  var zTop = 10;
  function apply(el) {
    var s = S.get(el);
    el.style.transform = (s.dx || s.dy || s.r) ? 'translate(' + s.dx + 'px,' + s.dy + 'px) rotate(' + s.r + 'deg)' : '';
  }
  var messy = false;
  var messBtn = document.getElementById('mess');
  function setMessy(v) { messy = v; if (messBtn) messBtn.textContent = v ? '整える' : 'ちらかす'; }

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function scatter(strength, instant) {
    var bw = board.clientWidth, bh = board.clientHeight;
    objs.forEach(function (el, i) {
      var s = S.get(el);
      var w = el.offsetWidth, h = el.offsetHeight, x = el.offsetLeft, y = el.offsetTop;
      var dx = rnd(-1, 1) * strength * U * 90, dy = rnd(-1, 1) * strength * U * 70;
      /* 面の外へ出し過ぎない */
      dx = Math.max(-x - w * 0.25, Math.min(bw - x - w * 0.75, dx));
      dy = Math.max(-y - h * 0.1, Math.min(bh - y - h * 0.6, dy));
      s.dx = dx; s.dy = dy; s.r = rnd(-1, 1) * (el.classList.contains('tablet') ? 14 : 30) * strength;
      el.style.transitionDelay = instant ? '0ms' : (i * 22) + 'ms';
      if (instant) el.style.transition = 'none';
      apply(el);
    });
  }
  function tidy(stagger) {
    objs.forEach(function (el, i) {
      var s = S.get(el); s.dx = 0; s.dy = 0; s.r = 0;
      el.style.transition = '';
      el.style.transitionDelay = stagger ? (i * 38) + 'ms' : '0ms';
      el.style.zIndex = '';
      apply(el);
    });
    setTimeout(function () { objs.forEach(function (el) { el.style.transitionDelay = ''; }); }, 1400);
    setMessy(false);
  }
  if (messBtn) messBtn.addEventListener('click', function () {
    if (messy) tidy(true);
    else { scatter(reduce ? 0.6 : 1, reduce); setMessy(true); }
  });

  /* ---------- 最初の一度だけ: 散らばった物が、そろう ---------- */
  if (R.classList.contains('intro') && !reduce) {
    scatter(1.25, true);
    var waits = [document.fonts ? document.fonts.ready : null];
    Array.prototype.forEach.call(board.querySelectorAll('.phone-screen img, .tab-screen .ts-a'), function (im) { if (im.decode) waits.push(im.decode().catch(function () {})); });
    var go = function () {
      if (go.done) return; go.done = true;
      R.classList.add('ready');
      objs.forEach(function (el) { el.style.transition = ''; });
      setTimeout(function () { tidy(true); }, 140);
      setTimeout(function () { R.classList.remove('intro', 'ready'); }, 2300);
    };
    Promise.all(waits.filter(Boolean)).then(function () { requestAnimationFrame(function () { requestAnimationFrame(go); }); });
    setTimeout(go, 1200);
  } else {
    R.classList.remove('intro');
  }

  /* ---------- つかんで動かす ---------- */
  var suppressClick = null;
  var touchDragging = false;
  document.addEventListener('touchmove', function (e) { if (touchDragging) e.preventDefault(); }, { passive: false });

  objs.forEach(function (el) {
    el.addEventListener('pointerdown', function (e) {
      if (current) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      var s = S.get(el);
      var start = { x: e.clientX, y: e.clientY, dx: s.dx, dy: s.dy };
      var dragging = false, timer = null, id = e.pointerId, touch = e.pointerType !== 'mouse';
      function begin() {
        dragging = true;
        if (touch) touchDragging = true;
        el.classList.add('dragging');
        el.style.zIndex = String(++zTop);
        try { el.setPointerCapture(id); } catch (err) {}
      }
      if (touch) timer = setTimeout(begin, 380);
      function move(ev) {
        if (ev.pointerId !== id) return;
        var mx = ev.clientX - start.x, my = ev.clientY - start.y;
        if (!dragging) {
          if (touch) { if (Math.abs(mx) + Math.abs(my) > 10) end(); return; }
          if (Math.abs(mx) + Math.abs(my) < 6) return;
          begin();
        }
        s.dx = start.dx + mx; s.dy = start.dy + my;
        apply(el);
      }
      function end(ev) {
        if (ev && ev.pointerId !== id) return;
        clearTimeout(timer);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('pointercancel', end);
        if (dragging) {
          el.classList.remove('dragging');
          touchDragging = false;
          suppressClick = el;
          setTimeout(function () { if (suppressClick === el) suppressClick = null; }, 60);
          setMessy(true);
        }
      }
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', end);
      window.addEventListener('pointercancel', end);
    });
    /* リンクや画像の「ドラッグして運ぶ」を止める(つかんで動かすのと取り合う) */
    el.addEventListener('dragstart', function (e) { e.preventDefault(); });
    Array.prototype.forEach.call(el.querySelectorAll('img'), function (im) { im.setAttribute('draggable', 'false'); });
    if (el.tagName === 'A') el.setAttribute('draggable', 'false');
    /* 長押しで出る文脈メニューを止める(動かすための長押し) */
    el.addEventListener('contextmenu', function (e) { if (e.pointerType !== 'mouse') e.preventDefault(); });
  });

  /* ---------- BRIDGE の道具: 手に取る ---------- */
  var TOOLS = {
    compass: { cat: 'キャリア・経験を整理する', name: 'BRIDGE Compass', desc: '10の質問で、これまでの経験を別の言葉に翻訳する', meta: '10の質問・約3分・登録不要',
      note: '画面は、実際の結果画面です(理学療法士で、調整やチームに関わる答えを選んだ一例)。画面を上下に動かせます。', go: '質問に答える' },
    town: { cat: '医療経営を学ぶ', name: 'クリニックタウン3D', desc: 'クリニック経営を、1日ずつ動かして学ぶ', meta: 'ブラウザで遊べる経営ゲーム・いまの版は v99.3',
      note: '画面は、実際のゲーム画面です(院内を歩いて見る視察の画面と、整形外科で始めた1日目の経営の画面)。', go: 'ゲームを始める', alt: '経営の画面を見る', altBack: '視察の画面にもどす' },
    keiji: { cat: '明日の業務を楽にする', name: '掲示じたく', desc: '院内掲示を、選んで埋めるだけ', meta: '受付・事務の方に・A4の掲示とHP・SNS用の文面',
      note: '紙は、掲示じたくの「臨時休診」の型でつくった例です。日付と院名は空欄のままです。', go: '掲示をつくる' },
    iikae: { cat: 'キャリア・経験を整理する', name: '現場のことば 言いかえ帳', desc: '現場のことばを、履歴書で通じる言葉に', meta: '54の現場のことば・登録不要',
      note: 'カードの言葉は、言いかえ帳に載っている対訳です。', go: '言いかえ帳を開く', alt: 'カードをめくる' },
    tana: { cat: 'キャリア・経験を整理する', name: '経験の棚卸し', desc: '18の質問で、職務経歴書のたねをつくる', meta: '18の質問・約15分・登録不要',
      note: 'ノートの問いは、経験の棚卸しの実際の質問です(18問のうち、はじめの3問)。', go: '質問に答える' }
  };
  var pick = document.getElementById('pick'), scrim = document.getElementById('scrim');
  var pkNo = document.getElementById('pkNo'), pkName = document.getElementById('pkName'), pkDesc = document.getElementById('pkDesc');
  var pkMeta = document.getElementById('pkMeta'), pkNote = document.getElementById('pkNote'), pkGo = document.getElementById('pkGo');
  var pkGoText = document.getElementById('pkGoText'), pkAlt = document.getElementById('pkAlt'), pkBack = document.getElementById('pkBack');
  var current = null, closing = false;
  var tools = Array.prototype.slice.call(board.querySelectorAll('a.obj.tool'));

  tools.forEach(function (el) {
    el.setAttribute('role', 'button');
    el.addEventListener('click', function (e) {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return; /* 新しいタブで開くのは止めない */
      e.preventDefault();
      if (suppressClick === el) return;
      if (current === el) { act(el); return; }
      if (!current) open(el);
    });
    el.addEventListener('keydown', function (e) {
      if (current) return;
      if (e.key === ' ') { e.preventDefault(); open(el); return; }
      var step = (e.shiftKey ? 32 : 8) * U, s = S.get(el), moved = true;
      if (e.key === 'ArrowLeft') s.dx -= step; else if (e.key === 'ArrowRight') s.dx += step;
      else if (e.key === 'ArrowUp') s.dy -= step; else if (e.key === 'ArrowDown') s.dy += step;
      else moved = false;
      if (moved) { e.preventDefault(); el.style.zIndex = String(++zTop); apply(el); setMessy(true); }
    });
  });

  /* 手に取ったあとの、物ごとの小さな動き */
  function act(el) {
    var id = el.dataset.id;
    if (id === 'town') toggleTown(el);
    else if (id === 'iikae') cycleCards(el);
  }
  function toggleTown(el) {
    el.classList.toggle('alt');
    pkAlt.textContent = el.classList.contains('alt') ? TOOLS.town.altBack : TOOLS.town.alt;
  }
  function cycleCards(el) {
    var lift = el.querySelector('.lift');
    var cards = Array.prototype.slice.call(lift.querySelectorAll('.card'));
    var top = lift.querySelector('.card.k1');
    lift.insertBefore(top, cards[0]);
    var order = Array.prototype.slice.call(lift.querySelectorAll('.card')).reverse(); /* 上から k1, k2, ... */
    order.forEach(function (c, i) { c.classList.remove('k1', 'k2', 'k3', 'k4'); c.classList.add('k' + (i + 1)); });
  }

  function targetFor(el, w0, h0) {
    var vw = document.documentElement.clientWidth, vh = window.innerHeight, sp = vw < 760;
    var panelH = sp ? Math.min(vh * 0.52, pick.offsetHeight || vh * 0.42) : 0;
    var area = sp ? { x: 18, y: 18, w: vw - 36, h: vh - panelH - 36 } : { x: 56, y: 40, w: vw - 56 - (Math.min(380, vw - 80) + 40) - 64, h: vh - 80 };
    var id = el.dataset.id;
    var gw = 1, gh = 1, ox = 0;           /* 開いたときに広がる分 */
    if (id === 'tana') { gw = 2; ox = 1; } /* 表紙が左へ開く */
    if (id === 'iikae') { gw = 1.12; gh = 3.5; }
    var maxS = id === 'town' ? 2.2 : (id === 'iikae' ? 2.6 : 3.4);
    var s = Math.min(area.w / (w0 * gw), area.h / (h0 * gh), maxS);
    var tw = w0 * s, th = h0 * s;
    var x = area.x + (area.w - tw * gw) / 2 + ox * tw;
    var y = area.y + (area.h - th * gh) / 2;
    return { x: x, y: y, s: s };
  }

  var lastFocus = null;
  function open(el) {
    var id = el.dataset.id, info = TOOLS[id];
    if (!info) return;
    current = el; lastFocus = el;
    /* 札の中身 */
    pkNo.textContent = info.cat;
    pkName.textContent = info.name;
    pkDesc.textContent = info.desc;
    pkMeta.textContent = info.meta;
    pkNote.textContent = info.note;
    pkGo.href = el.getAttribute('href');
    pkGoText.textContent = info.go;
    if (info.alt) { pkAlt.hidden = false; pkAlt.textContent = (id === 'town' && el.classList.contains('alt')) ? info.altBack : info.alt; } else pkAlt.hidden = true;
    scrim.hidden = false; pick.hidden = false;

    /* 傾きを戻して、ずらした位置のまま持ち上げる */
    var s = S.get(el); s.r = 0; apply(el);
    var br = board.getBoundingClientRect();
    var x0 = br.left + el.offsetLeft + s.dx, y0 = br.top + el.offsetTop + s.dy;
    var t = targetFor(el, el.offsetWidth, el.offsetHeight);
    el.classList.add('lifted');
    el.setAttribute('aria-hidden', 'true');
    el.style.zIndex = '60';
    var lift = el.querySelector('.lift');
    lift.style.transform = 'translate(' + (t.x - x0) + 'px,' + (t.y - y0) + 'px) scale(' + t.s + ')';
    var sbw = window.innerWidth - document.documentElement.clientWidth;
    R.style.overflow = 'hidden';
    if (sbw > 0) R.style.paddingRight = sbw + 'px';
    requestAnimationFrame(function () { scrim.classList.add('on'); pick.classList.add('on'); });
    setTimeout(function () {
      if (current !== el) return;
      el.classList.add('open');
      if (id === 'compass' && !reduce) {
        var sc = el.querySelector('.phone-screen');
        setTimeout(function () { if (current === el) sc.scrollTo({ top: sc.scrollHeight * 0.18, behavior: 'smooth' }); }, 500);
      }
    }, reduce ? 0 : 420);
    pkGo.focus({ preventScroll: true });
  }

  function close() {
    if (!current || closing) return;
    var el = current; closing = true;
    el.classList.remove('open');
    var sc = el.querySelector('.phone-screen'); if (sc) sc.scrollTop = 0;
    var lift = el.querySelector('.lift');
    lift.style.transform = '';
    scrim.classList.remove('on'); pick.classList.remove('on');
    el.removeAttribute('aria-hidden');
    setTimeout(function () {
      el.classList.remove('lifted');
      el.style.zIndex = '';
      scrim.hidden = true; pick.hidden = true;
      R.style.overflow = ''; R.style.paddingRight = '';
      current = null; closing = false;
    }, reduce ? 0 : 520);
    if (lastFocus) lastFocus.focus({ preventScroll: true });
  }
  scrim.addEventListener('click', close);
  pkBack.addEventListener('click', close);
  pkAlt.addEventListener('click', function () { if (current) act(current); });
  document.addEventListener('keydown', function (e) {
    if (!current) return;
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') {
      var f = [pkGo, pkAlt, pkBack].filter(function (x) { return !x.hidden; });
      var i = f.indexOf(document.activeElement);
      e.preventDefault();
      var n = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : (i === f.length - 1 ? 0 : i + 1);
      f[n].focus();
    }
  });

  /* ---------- 大きさが変わったら、ずらした分も同じ比で ---------- */
  var rt = null;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () {
      var wasSp = U && board.style.getPropertyValue('--u');
      var ratio = measure();
      if (current) close();
      objs.forEach(function (el) { var s = S.get(el); s.dx *= ratio; s.dy *= ratio; el.style.transition = 'none'; apply(el); });
      requestAnimationFrame(function () { objs.forEach(function (el) { el.style.transition = ''; }); });
    }, 120);
  });
  mq.addEventListener && mq.addEventListener('change', function () { tidy(false); });
})();
