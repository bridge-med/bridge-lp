/* =========================================================================
 * 砂庭 — app.js
 * 一坪の枯山水。なぞると砂紋ができ、長く押すと石を置く。
 *
 * 設計の決めごと:
 *   - 点数・時間制限・通知・次を促す文言を出さない
 *   - 色はCSSトークンからのみ読む(styles.css が唯一の定義源)
 *   - 石は残り、紋は消える。消えたことを咎める文言は出さない
 *   - 座標は正規化して持つ(x,y は 0〜1。回転・リサイズで庭が壊れない)
 * ========================================================================= */
(function () {
  'use strict';

  var canvas = document.getElementById('garden');
  var ctx = canvas.getContext('2d');
  var hintEl = document.getElementById('hint');
  var sayEl = document.getElementById('say');
  var smoothBtn = document.getElementById('smooth');

  /* ---- 手ざわりの定数 ---- */
  var RAKE = [-11, -5.5, 0, 5.5, 11]; // 熊手の歯。中心からの距離(CSS px)
  var LINE_ALPHA = 0.20;
  var FADE_START = 180000;  // 3分。ここから紋が薄れはじめる
  var FADE_END = 360000;    // 6分。ここで砂に還る
  var MAX_STROKES = 140;
  var MIN_STEP = 3;         // これ以下の動きは点として拾わない(CSS px)
  var HOLD_MS = 450;        // 長押しと見なす時間
  var HOLD_SLOP = 8;        // 長押し判定を許すぶれ幅(CSS px)
  var STONE_R = 0.055;      // 石の半径。画面短辺に対する比
  var RIPPLE_MS = 900;

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---- 状態 ---- */
  var W = 0, H = 0, S = 0, dpr = 1;
  var strokes = [];   // { pts: [{x,y}], at }
  var ripples = [];   // { x, y, at }
  var current = null; // 描いている最中の紋
  var pointerId = null;
  var down = null;    // { x, y, t, stone }
  var holdTimer = null;
  var holding = false; // 長押しが成立した(このポインタでは紋を描かない)
  var rafId = null;
  var lastPaint = 0;

  /* ---- 色。CSSトークンを実際に解決して読む(JSに色を書かない) ---- */
  var probe = document.createElement('span');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none';
  document.body.appendChild(probe);

  var C = {};
  function readColors() {
    C.ground = token('--garden-ground');
    C.line = token('--garden-line');
    C.stone = token('--garden-stone');
    C.choice = token('--garden-choice');
  }
  function token(name) {
    probe.style.color = 'var(' + name + ')';
    var m = getComputedStyle(probe).color.match(/-?\d+(\.\d+)?/g);
    return m ? [ +m[0], +m[1], +m[2] ] : [ 0, 0, 0 ];
  }
  function rgba(c, a) {
    return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  }

  /* ---- 画面寸法 ---- */
  function resize() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    S = Math.min(W, H);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint();
  }

  /* ---- 描画 ------------------------------------------------------------ */
  function fade(age) {
    if (age <= FADE_START) return 1;
    if (age >= FADE_END) return 0;
    return 1 - (age - FADE_START) / (FADE_END - FADE_START);
  }

  function paint() {
    var now = Date.now();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = rgba(C.ground, 1);
    ctx.fillRect(0, 0, W, H);

    var stones = Store.stones();
    for (var i = 0; i < stones.length; i++) drawStoneRings(stones[i]);

    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.lineWidth = 1;
    for (var j = 0; j < strokes.length; j++) {
      var f = fade(now - strokes[j].at);
      if (f > 0) drawStroke(strokes[j], f);
    }
    if (current) drawStroke(current, 1);

    for (var k = 0; k < stones.length; k++) drawStone(stones[k]);
    for (var m = 0; m < ripples.length; m++) drawRipple(ripples[m], now);
  }

  /* 砂紋。熊手の歯の数だけ、線の法線方向へずらして引く */
  function drawStroke(stroke, f) {
    var pts = stroke.pts;
    if (pts.length < 2) return;
    ctx.strokeStyle = rgba(C.line, LINE_ALPHA * f);
    for (var o = 0; o < RAKE.length; o++) {
      var d = RAKE[o];
      ctx.beginPath();
      for (var i = 0; i < pts.length; i++) {
        var n = normalAt(pts, i);
        var x = pts[i].x * W + n[0] * d;
        var y = pts[i].y * H + n[1] * d;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }

  /* 点iにおける進行方向の法線(単位ベクトル) */
  function normalAt(pts, i) {
    var a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    var tx = (b.x - a.x) * W, ty = (b.y - a.y) * H;
    var len = Math.sqrt(tx * tx + ty * ty);
    if (!len) return [0, 0];
    return [ -ty / len, tx / len ];
  }

  /* 石のまわりの波紋。石と一緒に残る */
  function drawStoneRings(s) {
    var x = s.x * W, y = s.y * H, r = s.r * S;
    var rings = [ [10, 0.10], [19, 0.07], [29, 0.05] ];
    ctx.lineWidth = 1;
    for (var i = 0; i < rings.length; i++) {
      ctx.strokeStyle = rgba(C.line, rings[i][1]);
      ctx.beginPath();
      ctx.arc(x, y, r + rings[i][0], 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  /* 石。種から形が決まるので、同じ石はいつ開いても同じ形 */
  function drawStone(s) {
    var x = s.x * W, y = s.y * H, r = s.r * S;
    var rand = seeded(s.seed);
    var n = 11, pts = [];
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var rr = r * (0.86 + rand() * 0.26);
      pts.push([ x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.9 ]);
    }
    ctx.beginPath();
    ctx.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
    for (var j = 0; j < n; j++) {
      var cur = pts[j], nxt = pts[(j + 1) % n];
      ctx.quadraticCurveTo(cur[0], cur[1], (cur[0] + nxt[0]) / 2, (cur[1] + nxt[1]) / 2);
    }
    ctx.closePath();
    ctx.fillStyle = rgba(C.stone, 0.88);
    ctx.fill();

    // 光の当たる面。地の色をごく薄く重ねるだけにする
    ctx.save();
    ctx.clip();
    ctx.fillStyle = rgba(C.ground, 0.13);
    ctx.beginPath();
    ctx.ellipse(x - r * 0.3, y - r * 0.34, r * 0.62, r * 0.44, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* 石を置いた瞬間だけ現れる砂色の波紋(第22条) */
  function drawRipple(rp, now) {
    var t = (now - rp.at) / RIPPLE_MS;
    if (t >= 1) return;
    var e = 1 - Math.pow(1 - t, 3);
    ctx.lineWidth = 1;
    ctx.strokeStyle = rgba(C.choice, 0.45 * (1 - t));
    ctx.beginPath();
    ctx.arc(rp.x * W, rp.y * H, STONE_R * S + e * 74, 0, Math.PI * 2);
    ctx.stroke();
  }

  /* 種から決まる擬似乱数(同じ種なら同じ形) */
  function seeded(seed) {
    var t = (seed % 2147483646) + 1;
    return function () {
      t = (t * 16807) % 2147483647;
      return t / 2147483647;
    };
  }

  /* ---- 描き直しの間隔 ---------------------------------------------------
   * 指を動かしている間はrAFのまま。それ以外は薄れていくだけなので粗くてよい。
   * 動くものが何も無くなったらループを止める(電池を食わせない)。 */
  function alive() {
    if (current || ripples.length) return true;
    var now = Date.now();
    for (var i = 0; i < strokes.length; i++) if (now - strokes[i].at < FADE_END) return true;
    return false;
  }

  function loop(ts) {
    rafId = null;
    var interval = current ? 0 : 400;
    if (ts - lastPaint >= interval) {
      lastPaint = ts;
      sweep();
      paint();
    }
    if (alive() && !document.hidden) rafId = requestAnimationFrame(loop);
  }

  function kick() {
    if (rafId == null && !document.hidden) rafId = requestAnimationFrame(loop);
  }

  /* 砂に還ったものを捨てる */
  function sweep() {
    var now = Date.now();
    var keptStrokes = [];
    for (var i = 0; i < strokes.length; i++) {
      if (now - strokes[i].at < FADE_END) keptStrokes.push(strokes[i]);
    }
    strokes = keptStrokes;
    var keptRipples = [];
    for (var j = 0; j < ripples.length; j++) {
      if (now - ripples[j].at < RIPPLE_MS) keptRipples.push(ripples[j]);
    }
    ripples = keptRipples;
  }

  /* ---- 触れる ----------------------------------------------------------- */
  function pos(e) {
    var rect = canvas.getBoundingClientRect();
    return { x: (e.clientX - rect.left) / W, y: (e.clientY - rect.top) / H };
  }

  function stoneAt(p) {
    var stones = Store.stones();
    for (var i = stones.length - 1; i >= 0; i--) {
      var dx = (stones[i].x - p.x) * W, dy = (stones[i].y - p.y) * H;
      if (Math.sqrt(dx * dx + dy * dy) <= stones[i].r * S + 6) return stones[i];
    }
    return null;
  }

  function onDown(e) {
    if (pointerId !== null) return;
    pointerId = e.pointerId;
    canvas.setPointerCapture(pointerId);
    var p = pos(e);
    down = { x: p.x, y: p.y, stone: stoneAt(p) };
    holding = false;
    current = { pts: [ p ], at: Date.now() };
    holdTimer = setTimeout(onHold, HOLD_MS);
    kick();
  }

  function onMove(e) {
    if (e.pointerId !== pointerId || holding) return;
    var p = pos(e);
    if (holdTimer) {
      var mx = (p.x - down.x) * W, my = (p.y - down.y) * H;
      if (Math.sqrt(mx * mx + my * my) > HOLD_SLOP) {
        clearTimeout(holdTimer);
        holdTimer = null;
      }
    }
    var last = current.pts[current.pts.length - 1];
    var dx = (p.x - last.x) * W, dy = (p.y - last.y) * H;
    if (Math.sqrt(dx * dx + dy * dy) < MIN_STEP) return;
    current.pts.push(p);
    kick();
  }

  function onUp(e) {
    if (e.pointerId !== pointerId) return;
    if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
    if (current && current.pts.length >= 2) {
      strokes.push(current);
      if (strokes.length > MAX_STROKES) strokes.shift();
      dismissHint();
    }
    current = null;
    try { canvas.releasePointerCapture(pointerId); } catch (err) { /* 解放済み */ }
    pointerId = null;
    down = null;
    holding = false;
    kick();
  }

  /* 長押し。石を置くか、置いてある石を持ち上げる */
  function onHold() {
    holdTimer = null;
    holding = true;
    current = null;
    if (down.stone) {
      Store.removeStone(down.stone);
      say('石を持ち上げました');
    } else {
      var rand = Math.random();
      Store.addStone({
        x: down.x,
        y: down.y,
        r: STONE_R * (0.82 + rand * 0.4),
        seed: Math.floor(Math.random() * 2000000) + 1
      });
      if (!reduceMotion.matches) ripples.push({ x: down.x, y: down.y, at: Date.now() });
      say('石を置きました');
    }
    dismissHint();
    kick();
    paint();
  }

  /* ---- 画面の外側 ------------------------------------------------------- */
  function say(text) { sayEl.textContent = text; }

  function dismissHint() {
    if (Store.hinted()) return;
    Store.markHinted();
    hintEl.classList.add('gone');
  }

  smoothBtn.addEventListener('click', function () {
    strokes = [];
    current = null;
    say('砂をならしました');
    paint();
  });

  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', resize);
  document.addEventListener('visibilitychange', function () { if (!document.hidden) kick(); });
  if (window.matchMedia) {
    var dark = window.matchMedia('(prefers-color-scheme: dark)');
    var onScheme = function () { readColors(); paint(); };
    if (dark.addEventListener) dark.addEventListener('change', onScheme);
    else if (dark.addListener) dark.addListener(onScheme);
  }

  if (Store.hinted()) hintEl.classList.add('hidden');

  readColors();
  resize();

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* 無くても庭は使える */ });
    });
  }
})();
