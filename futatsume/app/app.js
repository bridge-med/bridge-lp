/* =========================================================================
 * ふたつめの波 — app.js
 *
 * 波は一つでは何も起こせない。二つの輪が同じ場所で重なった瞬間に、
 * そこにある灯がともる。灯った灯は自分の波を出すので、連鎖する。
 *
 * 設計の決めごと:
 *   - 印を置いてから、まとめて放つ。波は必ず同時に出る。
 *     指の速さを競わせないためである(第6条 疲れた人が続けられること)。
 *     難しさは幾何だけに置く
 *   - 点数・時間制限・失敗の文言を持たない。何度でもやり直せる
 *   - 盤は正方形。縦長の画面でも等距離が等距離のままであるため
 *   - 色はCSSトークンからのみ読む(styles.css が唯一の定義源)
 *   - 全部解き終えた先は、何も課さない水面に戻る
 * ========================================================================= */
(function () {
  'use strict';

  var canvas = document.getElementById('water');
  var ctx = canvas.getContext('2d');
  var hintEl = document.getElementById('hint');
  var stageEl = document.getElementById('stage');
  var leftEl = document.getElementById('left');
  var actEl = document.getElementById('act');
  var overEl = document.getElementById('over');
  var sayEl = document.getElementById('say');

  /* ---- 決めごと。長さはすべて盤の一辺に対する比で持つ ---- */
  var SPEED = 0.24;      // 波が進む速さ(毎秒)
  var TOL = 0.045;       // 「輪の上」と見なす幅。指の置き精度に合わせて甘くする
  var MINR = 0.10;       // これより内側では判定しない(灯の真上に重ねる抜け道を塞ぐ)
  var LIGHT_R = 0.026;
  var MARK_R = 0.018;    // 置いた印の大きさ
  var FADE = 6000;       // 波が消えるまで(ms)
  var BLOOM = 900;       // ともった瞬間の砂色の輪が消えるまで(ms)
  var NEXT_MS = 1500;    // 解けてから次の面へ移るまで
  var CALM_MIN = 12000, CALM_MAX = 26000;
  var KANJI = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
               '十一', '十二', '十三', '十四', '十五'];

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---- 状態 ---- */
  var W = 0, H = 0, B = 0, bx = 0, by = 0, dpr = 1;
  var mode = 'stage';        // 'stage' | 'water'
  var phase = 'place';       // 'place'(印を置く) | 'run'(放ったあと)
  var stage = 0, lights = [], rocks = [], marks = [], ripples = [];
  var rafId = null, clearedAt = 0, nextCalm = 0;

  /* ---- 色はCSSトークンを実際に解決して読む(JSに色を書かない) ---- */
  var probe = document.createElement('span');
  probe.setAttribute('aria-hidden', 'true');
  probe.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none';
  document.body.appendChild(probe);

  var C = {};
  function readColors() {
    C.ground = token('--w-ground');
    C.line = token('--w-line');
    C.deep = token('--w-deep');
    C.choice = token('--w-choice');
  }
  function token(name) {
    probe.style.color = 'var(' + name + ')';
    var m = getComputedStyle(probe).color.match(/-?\d+(\.\d+)?/g);
    return m ? [ +m[0], +m[1], +m[2] ] : [ 0, 0, 0 ];
  }
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }

  /* ---- 盤。画面の中央に取る正方形 ---- */
  function resize() {
    var rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.max(1, Math.round(rect.width));
    H = Math.max(1, Math.round(rect.height));
    B = Math.min(W, H) * 0.86;
    bx = (W - B) / 2;
    by = (H - B) / 2;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint();
  }
  function px(u) { return bx + u * B; }
  function py(v) { return by + v * B; }

  /* ---- 面を開く ---- */
  function load(i) {
    mode = 'stage';
    phase = 'place';
    stage = i;
    var s = STAGES[i];
    lights = s.lights.map(function (p) {
      return { x: p[0], y: p[1], need: p[2] || 2, lit: false, at: 0 };
    });
    rocks = (s.rocks || []).map(function (p, k) {
      return { x: p[0], y: p[1], r: p[2], seed: (i + 1) * 7919 + k * 104729 };
    });
    marks = [];
    ripples = [];
    clearedAt = 0;
    overEl.classList.remove('show');
    stageEl.textContent = KANJI[i] || String(i + 1);
    stageEl.classList.remove('hide');
    refresh();
    kick();
  }

  /* 全部解き終えた先。灯も、数える波もない */
  function toWater() {
    mode = 'water';
    lights = []; rocks = []; marks = []; ripples = [];
    clearedAt = 0;
    stageEl.classList.add('hide');
    leftEl.innerHTML = '';
    actEl.className = 'btn act show';
    actEl.textContent = 'はじめから';
    nextCalm = performance.now() + 2600;
    kick();
  }

  /* ---- バーの丸と、下のボタン ---- */
  function refresh() {
    var n = STAGES[stage].drops;
    var html = '';
    for (var i = 0; i < n; i++) html += '<i class="' + (i < marks.length ? 'on' : '') + '"></i>';
    leftEl.innerHTML = html;

    if (phase === 'place') {
      actEl.textContent = '放つ';
      actEl.disabled = marks.length === 0;
      actEl.className = 'btn act' + (marks.length ? ' show' : '');
    } else {
      actEl.disabled = true;
      actEl.className = 'btn act';
    }
  }

  /* ---- 波を放つ。すべて同じ瞬間に出る ---- */
  function release() {
    if (phase !== 'place' || !marks.length) return;
    var now = performance.now();
    for (var i = 0; i < marks.length; i++) {
      ripples.push({ x: marks[i].x, y: marks[i].y, at: now, light: false, wob: Math.random() * 6.28 });
    }
    phase = 'run';
    refresh();
    sayEl.textContent = '波を放ちました';
    kick();
  }

  /* ---- 岩。線分が岩にかかっていれば、波はそこへ届かない ---- */
  function shadowed(ax, ay, tx, ty) {
    for (var i = 0; i < rocks.length; i++) {
      var R = rocks[i];
      var dx = tx - ax, dy = ty - ay;
      var len2 = dx * dx + dy * dy;
      var t = len2 ? ((R.x - ax) * dx + (R.y - ay) * dy) / len2 : 0;
      t = Math.max(0, Math.min(1, t));
      var ex = R.x - (ax + dx * t), ey = R.y - (ay + dy * t);
      if (Math.sqrt(ex * ex + ey * ey) < R.r) return true;
    }
    return false;
  }

  /* ---- 判定。輪の上に必要な数の波が同時に居たら、そこの灯がともる ---- */
  function judge(now) {
    if (mode !== 'stage') return;
    var lit = [];
    for (var i = 0; i < lights.length; i++) {
      var L = lights[i];
      if (L.lit) continue;
      var hits = 0;
      for (var j = 0; j < ripples.length; j++) {
        var R = ripples[j];
        var age = now - R.at;
        if (age > FADE) continue;
        var r = SPEED * (age / 1000);
        if (r < MINR) continue;
        var dx = L.x - R.x, dy = L.y - R.y;
        if (Math.abs(Math.sqrt(dx * dx + dy * dy) - r) > TOL) continue;
        if (shadowed(R.x, R.y, L.x, L.y)) continue;
        hits++;
        if (hits >= L.need) break;
      }
      if (hits >= L.need) { L.lit = true; L.at = now; lit.push(L); }
    }
    // 同じ瞬間に灯ったものは、同じ瞬間に波を出す(連鎖の要)
    for (var k = 0; k < lit.length; k++) {
      ripples.push({ x: lit[k].x, y: lit[k].y, at: now, light: true, wob: Math.random() * 6.28 });
    }
    if (lit.length) sayEl.textContent = '灯がともりました';
  }

  /* ---- 描画 ---- */
  function paint() {
    var now = performance.now();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = rgba(C.ground, 1);
    ctx.fillRect(0, 0, W, H);
    ctx.lineJoin = 'round';

    for (var j = 0; j < ripples.length; j++) {
      var R = ripples[j];
      var age = now - R.at;
      if (age > FADE) continue;
      var r = SPEED * (age / 1000);
      if (r < 0.004) continue;
      var a = (R.light ? 0.34 : 0.44) * Math.pow(1 - age / FADE, 1.4);
      if (a < 0.006) continue;
      ring(R, r, a, C.line, 1.4);
      if (r > 0.05) ring(R, r - 0.024, a * 0.4, C.deep, 1);
    }

    for (var m = 0; m < rocks.length; m++) drawRock(rocks[m]);
    for (var k = 0; k < marks.length; k++) drawMark(marks[k]);
    for (var i = 0; i < lights.length; i++) drawLight(lights[i], now);
  }

  /* 輪。岩の裏になる角度は描かない(切れ込みがそのまま「届かない」の意味になる) */
  function ring(R, r, a, color, width) {
    var gaps = [];
    for (var i = 0; i < rocks.length; i++) {
      var K = rocks[i];
      var dx = K.x - R.x, dy = K.y - R.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d <= K.r) continue;              // 岩の中で生まれた波は遮らない
      if (r < d - K.r) continue;           // まだ岩に届いていない
      gaps.push([Math.atan2(dy, dx), Math.asin(Math.min(1, K.r / d))]);
    }

    ctx.strokeStyle = rgba(color, a);
    ctx.lineWidth = width;
    var n = r < 0.12 ? 40 : 128;
    var open = false;
    ctx.beginPath();
    for (var s = 0; s <= n; s++) {
      var th = (s / n) * Math.PI * 2 - Math.PI;
      if (inGap(th, gaps)) { open = false; continue; }
      var rr = r * (1 + 0.012 * Math.sin(th * 3 + R.wob)) * B;
      var x = px(R.x) + Math.cos(th) * rr;
      var y = py(R.y) + Math.sin(th) * rr;
      if (!open) { ctx.moveTo(x, y); open = true; } else { ctx.lineTo(x, y); }
    }
    ctx.stroke();
  }

  function inGap(th, gaps) {
    for (var i = 0; i < gaps.length; i++) {
      if (Math.abs(norm(th - gaps[i][0])) < gaps[i][1]) return true;
    }
    return false;
  }
  function norm(a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  }

  /* 置いた印。まだ波ではない */
  function drawMark(M) {
    var x = px(M.x), y = py(M.y), r = MARK_R * B;
    ctx.strokeStyle = rgba(C.line, 0.55);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x - r * 0.45, y);
    ctx.lineTo(x + r * 0.45, y);
    ctx.moveTo(x, y - r * 0.45);
    ctx.lineTo(x, y + r * 0.45);
    ctx.stroke();
  }

  /* 岩。種から形が決まるので、同じ岩はいつ開いても同じ形 */
  function drawRock(K) {
    var x = px(K.x), y = py(K.y), r = K.r * B;
    var rand = seeded(K.seed);
    var n = 11, pts = [];
    for (var i = 0; i < n; i++) {
      var a = (i / n) * Math.PI * 2;
      var rr = r * (0.88 + rand() * 0.22);
      pts.push([ x + Math.cos(a) * rr, y + Math.sin(a) * rr * 0.94 ]);
    }
    ctx.beginPath();
    ctx.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
    for (var j = 0; j < n; j++) {
      var cur = pts[j], nxt = pts[(j + 1) % n];
      ctx.quadraticCurveTo(cur[0], cur[1], (cur[0] + nxt[0]) / 2, (cur[1] + nxt[1]) / 2);
    }
    ctx.closePath();
    ctx.fillStyle = rgba(C.deep, 0.88);
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.fillStyle = rgba(C.ground, 0.13);
    ctx.beginPath();
    ctx.ellipse(x - r * 0.3, y - r * 0.34, r * 0.62, r * 0.44, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function seeded(seed) {
    var t = (Math.abs(seed) % 2147483646) + 1;
    return function () {
      t = (t * 16807) % 2147483647;
      return t / 2147483647;
    };
  }

  function drawLight(L, now) {
    var x = px(L.x), y = py(L.y), r = LIGHT_R * B;
    if (!L.lit) {
      ctx.strokeStyle = rgba(C.deep, 0.30);
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      // 三重の灯は輪をもう一つ持つ。二つでは足りないことが見て分かる
      if (L.need >= 3) {
        ctx.beginPath();
        ctx.arc(x, y, r + 5, 0, Math.PI * 2);
        ctx.stroke();
      }
      return;
    }
    var p = (now - L.at) / BLOOM;
    if (p < 1) {   // ともった瞬間だけ現れる砂色(第22条)
      ctx.strokeStyle = rgba(C.choice, 0.55 * (1 - p));
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(x, y, r + (1 - Math.pow(1 - p, 2.4)) * B * 0.08, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = rgba(C.deep, 0.9);
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = rgba(C.deep, 0.18);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(x, y, r + 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  /* ---- 時間を進める ---- */
  function loop() {
    rafId = null;
    var now = performance.now();

    judge(now);
    paint();

    if (mode === 'water') {
      if (!reduceMotion.matches && now > nextCalm) {
        ripples.push({ x: 0.1 + Math.random() * 0.8, y: 0.1 + Math.random() * 0.8, at: now, light: true, wob: Math.random() * 6.28 });
        nextCalm = now + CALM_MIN + Math.random() * (CALM_MAX - CALM_MIN);
      }
      if (!document.hidden) rafId = requestAnimationFrame(loop);
      return;
    }

    var alive = false;
    for (var j = 0; j < ripples.length; j++) {
      if (now - ripples[j].at <= FADE) { alive = true; break; }
    }
    var all = lights.length > 0 && lights.every(function (L) { return L.lit; });

    if (all && !clearedAt) { clearedAt = now; Store.reach(stage + 1); }
    if (clearedAt && now - clearedAt > NEXT_MS) {
      if (stage + 1 < STAGES.length) { load(stage + 1); }
      else { finish(); return; }
    } else if (!all && phase === 'run' && !alive) {
      // 静かになった。印を消してやり直せる状態へ戻す
      phase = 'place';
      marks = [];
      ripples = [];
      refresh();
    }

    if (!document.hidden) rafId = requestAnimationFrame(loop);
  }

  /* 最後の面のあと。「ここまで」を置いてから、水面へ溶ける */
  function finish() {
    overEl.classList.add('show');
    stageEl.classList.add('hide');
    setTimeout(function () {
      overEl.classList.remove('show');
      toWater();
    }, 2400);
    kick();
  }

  function kick() { if (rafId == null && !document.hidden) rafId = requestAnimationFrame(loop); }

  /* ---- 触れる ---- */
  canvas.addEventListener('pointerdown', function (e) {
    var rect = canvas.getBoundingClientRect();
    var u = (e.clientX - rect.left - bx) / B;
    var v = (e.clientY - rect.top - by) / B;
    var now = performance.now();

    if (mode === 'water') {
      ripples.push({ x: u, y: v, at: now, light: false, wob: Math.random() * 6.28 });
      kick();
      return;
    }
    if (phase !== 'place') return;

    // 置いてある印に触れたら、取り除く(置き直せる)
    for (var i = marks.length - 1; i >= 0; i--) {
      var dx = (marks[i].x - u) * B, dy = (marks[i].y - v) * B;
      if (Math.sqrt(dx * dx + dy * dy) < MARK_R * B + 10) {
        marks.splice(i, 1);
        refresh();
        paint();
        return;
      }
    }
    if (marks.length >= STAGES[stage].drops) return;
    marks.push({ x: u, y: v });
    refresh();
    paint();
    if (!Store.hinted()) { Store.markHinted(); hintEl.classList.add('gone'); }
  });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  actEl.addEventListener('click', function () {
    if (mode === 'water') { Store.reset(); load(0); return; }
    release();
  });

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
  if (Store.reached() >= STAGES.length) toWater();
  else load(Math.min(Store.reached(), STAGES.length - 1));

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* 無くても遊べる */ });
    });
  }

  /* 検証用。人の手で解けることを機械でも確かめられるようにする */
  window.__game = {
    state: function () {
      return {
        mode: mode, phase: phase, stage: stage,
        marks: marks.length, drops: mode === 'stage' ? STAGES[stage].drops : 0,
        lit: lights.filter(function (L) { return L.lit; }).length, total: lights.length
      };
    },
    board: function () { return { bx: bx, by: by, B: B }; },
    jump: function (i) { Store.reset(); load(i); }
  };
})();
