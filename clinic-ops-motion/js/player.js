/* ================================================================
   player — 再生ページ。自動再生・一時停止・最初から・シーク・全画面・場面へ移動
   ?render=1: 書き出し用(showreel/render.mjs が window.REEL を読む。1920×1080 固定・操作なし)
   ?t=秒: その時刻で止めて開く(確認用)
   ================================================================ */
(function () {
  'use strict';
  const F = window.FILM, film = F.film, M = F.M;
  const Q = new URLSearchParams(location.search);
  const RENDER = Q.has('render');
  const DUR = film.DUR, FPS = film.FPS;

  const $ = id => document.getElementById(id);
  const stage = $('stage'), frame = $('frame'), canvas = $('film'), veil = $('veil'), big = $('big'), bigLabel = $('bigLabel');
  const home = $('home'), state = $('state'), live = $('live'), playBtn = $('play'), restartBtn = $('restart'), seek = $('seek');
  const timeEl = $('time'), fsBtn = $('fs'), chapters = $('chapters'), ticks = $('ticks'), controls = $('controls');
  /* 書き出しではサブフレームごとに画素を読むので、読み出しの速い canvas にする */
  const ctx = canvas.getContext('2d', RENDER ? { alpha: false, willReadFrequently: true } : { alpha: false });
  if (!RENDER) state.textContent = '読み込み中です';

  /* ---- フォントがそろってから素材を作る(書き出しでは欠けたら止める) ---- */
  const ready = (async () => {
    if (document.fonts) {
      await document.fonts.ready;
      const list = film.FONTS_TO_LOAD();
      const load = Promise.all(list.map(([f, s]) => document.fonts.load(f, s).catch(() => null)));
      if (RENDER) {
        await load;
        const missing = list.filter(([f, s]) => !document.fonts.check(f, s)).map(([f]) => f);
        if (missing.length) throw new Error('フォントが揃っていない: ' + missing.join(', '));
      } else {
        await Promise.race([load, new Promise(r => setTimeout(r, 5000))]);   // 回線が遅くても 5 秒で始める(代わりの書体で描く)
      }
    }
    film.init();
    if (!RENDER) film.warm();                          // ぼけの段を先に作る(再生中の詰まりを防ぐ)
  })();

  /* ================================================================
     書き出し(?render=1): 1920×1080。動きのぼけはサブフレームを浮動小数で平均する
     ================================================================ */
  if (RENDER) {
    document.body.classList.add('render');
    canvas.width = film.W; canvas.height = film.H;
    const W = film.W, H = film.H;
    const out = document.createElement('canvas'); out.width = W; out.height = H;
    const octx = out.getContext('2d');
    let acc = null;
    const renderFrame = (t, maxSamples = 16) => {
      const n = Math.max(1, Math.min(maxSamples, film.samplesFor(t)));
      if (n === 1) {
        film.render(ctx, canvas, t);
        window.REEL.out = canvas;
        return 1;
      }
      if (!acc) acc = new Float32Array(W * H * 4);
      acc.fill(0);
      const shutter = 0.5 / FPS;                      // 180° シャッター
      for (let i = 0; i < n; i++) {
        film.render(ctx, canvas, t + shutter * ((i + 0.5) / n - 0.5), { noGrain: true });
        const d = ctx.getImageData(0, 0, W, H).data;
        for (let j = 0; j < d.length; j++) acc[j] += d[j];
      }
      const im = octx.createImageData(W, H), o = im.data, inv = 1 / n;
      for (let j = 0; j < o.length; j++) o[j] = acc[j] * inv + 0.5;
      octx.putImageData(im, 0, 0);
      film.grain(octx, out, t);
      window.REEL.out = out;
      return n;
    };
    window.REEL = { W, H, FPS, DUR, canvas, ready, renderFrame, out: canvas };
    ready.then(() => { const t = Q.has('t') ? +Q.get('t') : 0; film.render(ctx, canvas, t); });
    return;
  }

  /* ================================================================
     再生
     ================================================================ */
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  let t = Q.has('t') ? M.clamp(+Q.get('t') || 0, 0, DUR) : 0;
  let playing = false, ended = false, dirty = true, last = 0, scrubbing = false, wasPlaying = false;
  let rq = 1;                                         // 解像度の倍率(重い端末で下げる)
  let lvl = 0;                                        // 画質の段: 0=全部 / 1=粒子なし / 2=光のにじみもなし / 3=粒を半分
  const LEVELS = [{ rq: 1, skip: [] }, { rq: 0.8, skip: ['grain'] }, { rq: 0.65, skip: ['grain', 'bloom'] }, { rq: 0.55, skip: ['grain', 'bloom', 'dust'] }];
  let skip = new Set();
  const stats = { frames: 0, dropped: 0, dts: [], draws: [] };   // 再生中の間隔と描画の時間(README の計測用)
  window.__FILM_STATS = stats;

  /* 場面の印 */
  film.CH.forEach((c, i) => {
    const at = `${(c.t / DUR) * 100}%`;
    const li = document.createElement('li'); li.style.setProperty('--at', at); ticks.appendChild(li);
    const cl = document.createElement('li');
    const b = document.createElement('button'); b.type = 'button'; b.textContent = c.en; b.dataset.i = i;
    b.setAttribute('aria-label', `${c.en} の場面へ(${c.t.toFixed(1)}秒)`);
    b.addEventListener('click', () => { goTo(c.t); if (!playing) play(); });
    cl.appendChild(b); chapters.appendChild(cl);
  });

  /* キャンバスの大きさ(表示の大きさ × 画素比。上限 2560) */
  function fit() {
    const r = frame.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2) * rq;
    const w = Math.max(320, Math.min(2560, Math.round(r.width * dpr)));
    const h = Math.round(w * 9 / 16);
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; dirty = true; }
  }
  if ('ResizeObserver' in window) new ResizeObserver(fit).observe(frame); else window.addEventListener('resize', fit);

  const fmt = s => {
    const m = Math.floor(s / 60), r = s - m * 60;
    return `${String(m).padStart(2, '0')}:${r.toFixed(1).padStart(4, '0')}`;
  };
  $('dur').textContent = ` / ${fmt(DUR)}`;
  let lastUi = -1;
  function ui(force) {
    const k = Math.round(t * 10);
    if (!force && k === lastUi) return;
    lastUi = k;
    if (!scrubbing) seek.value = t.toFixed(2);
    seek.style.setProperty('--p', `${(t / DUR) * 100}%`);
    const sec = playing ? Math.floor(t) : Math.round(t * 10) / 10;
    if (seek.dataset.v !== String(sec)) { seek.dataset.v = String(sec); seek.setAttribute('aria-valuetext', `${sec}秒 / ${DUR}秒`); }
    timeEl.textContent = fmt(t);
    let cur = 0;
    film.CH.forEach((c, i) => { if (t >= c.t) cur = i; });
    chapters.querySelectorAll('button').forEach(b => b.setAttribute('aria-current', String(+b.dataset.i === cur)));
  }
  function say(s) { live.textContent = s; }

  function setPlayIcon() {
    playBtn.setAttribute('aria-label', playing ? '一時停止' : '再生');
    playBtn.classList.toggle('is-playing', playing);
  }
  function play() {
    if (ended || t >= DUR) { t = 0; ended = false; }
    playing = true; veil.hidden = true; home.hidden = true;
    last = performance.now(); dirty = true; setPlayIcon(); say('再生しています'); idleSoon();
  }
  function pause(msg = '一時停止しました') {
    playing = false; setPlayIcon(); say(msg); idleSoon();
  }
  function toggle() { if (playing) pause(); else play(); }
  function goTo(s) {
    t = M.clamp(s, 0, DUR); dirty = true;
    if (t < DUR) { ended = false; veil.hidden = true; home.hidden = true; }
    ui(true);
  }
  function finish() {
    playing = false; ended = true; t = DUR; setPlayIcon(); ui(true);
    bigLabel.textContent = 'もう一度見る'; home.hidden = false; veil.hidden = false;
    say('最後まで再生しました。もう一度見ることができます'); idleSoon();
  }

  /* ---- 1 コマごと ---- */
  function loop(now) {
    if (playing) {
      const dt = Math.min(0.1, (now - last) / 1000);
      if (dt > 0) {
        stats.frames++; stats.dts.push(dt);
        if (stats.dts.length > 2000) stats.dts.shift();
        if (dt > 1.5 / 60) stats.dropped += Math.round(dt * 60) - 1;
        t += dt;
        if (t >= DUR) finish();
        dirty = true;
      }
    }
    last = now;
    if (dirty) {
      const t0 = performance.now();
      film.render(ctx, canvas, t, { skip, streaks: playing });
      dirty = false;
      const ms = performance.now() - t0;
      if (playing) { stats.draws.push(ms); if (stats.draws.length > 2000) stats.draws.shift(); }
      adapt(ms);
      ui();
    }
    requestAnimationFrame(loop);
  }
  /* 重い端末では段を下げる(描画 1 回が 20ms を超え続けたら)。軽くなったら戻す */
  let slow = 0, fast = 0;
  function setLevel(n) {
    lvl = n; rq = LEVELS[n].rq; skip = new Set(LEVELS[n].skip); slow = 0; fast = 0; fit();
    stats.level = n;
  }
  function adapt(ms) {
    if (!playing) return;
    if (ms > 20) { slow++; fast = 0; } else if (ms < 8) { fast++; slow = 0; } else { slow = Math.max(0, slow - 1); fast = 0; }
    if (slow > 12 && lvl < LEVELS.length - 1) setLevel(lvl + 1);
    if (fast > 300 && lvl > 0) setLevel(lvl - 1);
  }

  /* ---- 操作 ---- */
  playBtn.addEventListener('click', toggle);
  restartBtn.addEventListener('click', () => { goTo(0); play(); });
  big.addEventListener('click', () => { if (ended) goTo(0); play(); });
  seek.addEventListener('pointerdown', () => { scrubbing = true; wasPlaying = playing; if (playing) pause(''); });
  seek.addEventListener('input', () => goTo(+seek.value));
  const endScrub = () => { if (!scrubbing) return; scrubbing = false; if (wasPlaying && t < DUR) play(); };
  seek.addEventListener('pointerup', endScrub);
  seek.addEventListener('change', endScrub);
  /* 全画面で帯が隠れているとき、指で触れた最初の1回は帯を出すだけにする(思わず止めない) */
  let revealOnly = false;
  stage.addEventListener('pointerdown', e => {
    revealOnly = e.target === canvas && e.pointerType !== 'mouse' && stage.classList.contains('idle');
    if (revealOnly) e.stopPropagation();             // 帯を押せる状態に戻すのは、このタップが終わってから
  }, true);
  canvas.addEventListener('click', () => {
    frame.focus({ preventScroll: true });             // 映像を押したあとも F などの操作が効く
    if (revealOnly) { revealOnly = false; idleSoon(); return; }
    toggle();
  });

  /* 再生のキーが効くのは、フォーカスが映像と操作の中にあるとき・全画面のとき・どこにもフォーカスがなく映像が半分以上見えているとき。
     下の「作品について」を読んでいるときは、Space や矢印でページを送れる */
  const keysForFilm = () => {
    const a = document.activeElement;
    if (fsEl()) return true;
    if (a && a !== document.body && a !== document.documentElement) return stage.contains(a);
    const r = frame.getBoundingClientRect();
    return Math.min(r.bottom, innerHeight) - Math.max(r.top, 0) >= r.height * 0.5;
  };
  document.addEventListener('keydown', e => {
    if (fsEl()) idleSoon();                            // 全画面で隠れた操作の帯を呼び戻す(Tab で届くように)
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (!keysForFilm()) return;
    const tag = (e.target && e.target.tagName) || '';
    const onButton = tag === 'BUTTON' || tag === 'A';
    switch (e.key) {
      case ' ':
        if (onButton) return;                            // ボタンの上の Space はそのボタンに任せる
        e.preventDefault(); toggle(); break;
      case 'ArrowLeft': case 'ArrowRight':                       // スライダーの上でも同じ幅で動かす
        e.preventDefault(); goTo(t + (e.key === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 1 / FPS : 1)); break;
      case 'Home': e.preventDefault(); goTo(0); break;
      case 'End': e.preventDefault(); goTo(DUR); finish(); break;
      case 'f': case 'F':                                // 1 文字の操作は、再生の操作にフォーカスがあるときだけ(WCAG 2.1.4)
        if (!fsBtn.hidden && (stage.contains(document.activeElement) || fsEl())) { e.preventDefault(); toggleFs(); }
        break;
      default:
    }
  });

  /* ---- 全画面(使えない端末ではボタンを出さない) ---- */
  const fsEnabled = document.fullscreenEnabled || document.webkitFullscreenEnabled;
  const fsEl = () => document.fullscreenElement || document.webkitFullscreenElement;
  if (fsEnabled) fsBtn.hidden = false;
  function toggleFs() {
    if (fsEl()) (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    else (stage.requestFullscreen || stage.webkitRequestFullscreen).call(stage);
  }
  fsBtn.addEventListener('click', toggleFs);
  const onFs = () => {
    const on = !!fsEl();
    fsBtn.setAttribute('aria-label', on ? '全画面を終える' : '全画面で見る');
    setTimeout(fit, 60);
    idleSoon();
  };
  document.addEventListener('fullscreenchange', onFs);
  document.addEventListener('webkitfullscreenchange', onFs);
  /* 全画面では、触れずに 2.5 秒たつと操作の帯を隠す(止めているときも。架空の注記を帯の下に隠したままにしない)。
     キーボードで帯の中にいるあいだは隠さない */
  let idleT = 0;
  const keyboardInControls = () => {
    const a = document.activeElement;
    if (!a || !controls.contains(a)) return false;
    try { return a.matches(':focus-visible'); } catch { return true; }
  };
  function idleSoon() {
    stage.classList.remove('idle');
    clearTimeout(idleT);
    idleT = setTimeout(() => { if (fsEl() && !keyboardInControls()) stage.classList.add('idle'); }, 2500);
  }
  ['pointermove', 'pointerdown', 'keydown', 'focusin'].forEach(ev => stage.addEventListener(ev, idleSoon));

  /* ---- 開始 ---- */
  setPlayIcon();
  ready.then(() => {
    state.textContent = '';
    fit();
    requestAnimationFrame(now => { last = now; requestAnimationFrame(loop); });
    if (Q.has('t')) { ui(true); say('一時停止しています'); return; }
    if (reduce) {                                     // 動きを減らす設定では自動再生しない(最後の 1 コマを見せる)
      t = DUR; ui(true); bigLabel.textContent = '再生する'; veil.hidden = false;
      say('動きを減らす設定のため、自動では再生しません。再生ボタンで始まります');
      return;
    }
    play();
  }).catch(err => {
    state.textContent = '映像を準備できませんでした。ページを読み込み直してください';
    say(state.textContent);
    console.error(err);
  });
})();
