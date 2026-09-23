/* ================================================================
   BRIDGE Compass — 画面
   1画面1問。単一選択はワンタップで次へ、複数選択と自由記述は「次へ」。
   戻る: 画面の ← とブラウザの戻る(history)の両方。
   回答は sessionStorage にだけ置く(タブを閉じると消える)。外部へは送らない。
   判定は engine.js、文言のマスターは data.js。
   ================================================================ */
(function () {
  'use strict';
  const D = window.COMPASS_DATA;
  const E = window.COMPASS_ENGINE;
  const main = document.getElementById('compass');
  const toastEl = document.getElementById('cpToast');
  if (!D || !E || !main) return;

  const STORE = 'bridge-compass';
  const REDUCED = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /* 単一選択(職種・Q1〜)で、選んだ印が見えてから次へ進むまでの間。動きを減らす設定では待たない */
  const SELECT_DELAY = REDUCED ? 0 : 260;
  const STEPS = ['intro', 'profession'].concat(D.QUESTIONS.map(q => q.id), ['result']);
  const Q = Object.fromEntries(D.QUESTIONS.map(q => [q.id, q]));

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  const $ = (sel, root) => (root || document).querySelector(sel);

  /* ---- 状態 ---- */
  let state = { step: 'intro', answers: {} };
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORE) || 'null');
    if (saved && STEPS.includes(saved.step) && saved.answers) state = saved;
  } catch (e) {}
  const save = () => { try { sessionStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} };

  /* 結果に進めるだけの回答が揃っているか(直接 result に戻ってきたとき用) */
  const complete = a => !!a.profession && D.QUESTIONS.every(q => q.type === 'text' || (Array.isArray(a[q.id]) ? a[q.id].length : a[q.id]));

  /* ---- 線(交差・分岐・軌跡)。橋の絵は描かない ---- */
  function rand(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
  function fanSvg(opts) {
    const o = Object.assign({ w: 400, h: 300, n: 12, seed: 7, ox: -20, oy: 0.72, spread: [0.08, 0.98], sand: 5 }, opts);
    const r = rand(o.seed);
    let paths = '';
    for (let i = 0; i < o.n; i++) {
      const t = i / (o.n - 1);
      const ey = o.h * (o.spread[0] + (o.spread[1] - o.spread[0]) * t);
      const oy = o.h * o.oy + (r() - 0.5) * 18;
      const c1x = o.w * (0.25 + r() * 0.15), c1y = oy + (r() - 0.5) * 40;
      const c2x = o.w * (0.55 + r() * 0.15), c2y = ey + (r() - 0.5) * 60;
      const cls = i === o.sand ? 'ln-s' : 'ln-n';
      const op = i === o.sand ? 1 : (0.22 + r() * 0.4).toFixed(2);
      paths += '<path class="' + cls + '" pathLength="1" style="--d:' + (i * 0.07).toFixed(2) + 's;opacity:' + op + '" d="M' + o.ox + ' ' + oy.toFixed(1) +
        ' C' + c1x.toFixed(1) + ' ' + c1y.toFixed(1) + ',' + c2x.toFixed(1) + ' ' + c2y.toFixed(1) + ',' + (o.w + 20) + ' ' + ey.toFixed(1) + '"/>';
    }
    return '<svg viewBox="0 0 ' + o.w + ' ' + o.h + '" preserveAspectRatio="xMidYMax slice" focusable="false">' + paths + '</svg>';
  }
  /* 翻訳中: 左から集まった線が一点で交わり、三方向へ分かれる */
  function convergeSvg() {
    const r = rand(11);
    let p = '';
    for (let i = 0; i < 9; i++) {
      const sy = 30 + i * 30 + (r() - 0.5) * 10;
      p += '<path class="ln-n" pathLength="1" style="--d:' + (i * 0.05).toFixed(2) + 's;opacity:' + (0.25 + r() * 0.35).toFixed(2) + '" d="M-10 ' + sy.toFixed(1) + ' C 90 ' + sy.toFixed(1) + ', 140 150, 200 150"/>';
    }
    [60, 150, 240].forEach((ey, i) => {
      p += '<path class="' + (i === 1 ? 'ln-s' : 'ln-n') + ' ln-out" pathLength="1" style="--d:' + (0.5 + i * 0.1).toFixed(2) + 's" d="M200 150 C 260 150, 300 ' + ey + ', 410 ' + ey + '"/>';
    });
    return '<svg viewBox="0 0 400 300" preserveAspectRatio="xMidYMid meet" focusable="false">' + p + '<circle class="ln-dot" cx="200" cy="150" r="3.2"/></svg>';
  }
  /* ---- 共通部品 ---- */
  function head(step) {
    const q = Q[step];
    const ch = q ? q.chapter : 0;
    const inCh = q ? D.QUESTIONS.filter(x => x.chapter === ch) : [];
    const pos = q ? inCh.indexOf(q) + 1 : 0;
    const segs = [1, 2, 3].map(c => {
      const fill = c < ch ? 1 : c === ch ? pos / inCh.length : 0;
      return '<span class="cp-seg"><span style="transform:scaleX(' + fill.toFixed(3) + ')"></span></span>';
    }).join('');
    const label = q ? D.CHAPTERS[ch] : null;
    return '<div class="cp-head">' +
      '<button class="cp-back" type="button" data-act="back" aria-label="前の画面に戻る">' +
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg></button>' +
      '<div class="cp-chapter">' + (label ? '<span class="en">' + label.en + '</span><span class="jp">' + label.jp + '</span>' : '') + '</div>' +
      (label ? '<div class="cp-progress" role="img" aria-label="' + label.en.replace('CHAPTER ', '第') + '章「' + label.jp + '」">' + segs + '</div>' : '') +
      '</div>';
  }
  const mark = multi => '<span class="cp-mark' + (multi ? ' sq' : '') + '" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.5 8.5l3 3 6-7"/></svg></span>';
  function option(o, selected, multi) {
    return '<button type="button" class="cp-opt' + (selected ? ' on' : '') + '" data-opt="' + esc(o.id) + '" ' +
      (multi ? 'role="checkbox" aria-checked="' + selected + '"' : 'role="radio" aria-checked="' + selected + '"') + '>' +
      mark(multi) + '<span class="t">' + esc(o.label) + '</span></button>';
  }

  /* ---- 画面ごとの描画 ---- */
  function renderProfession() {
    const cur = state.answers.profession;
    return '<section class="cp-screen cp-q cp-prof" data-step="profession">' + head('profession') +
      '<h2 class="cp-q-h cp-prof-h" tabindex="-1">まず、<br>今のあなたを教えてください</h2>' +
      '<div class="cp-opts" role="radiogroup" aria-label="職種">' + D.PROFESSIONS.map(p => option(p, cur === p.id, false)).join('') + '</div>' +
      '<p class="cp-prof-note">職種は、経験を言いかえるときの手がかりにだけ使います。</p>' +
      '</section>'; // 職種はタップ=決定。戻ってきたときも「次へ」は出さず、同じ職種をもう一度タップすれば進む
  }
  function renderQuestion(q) {
    const a = state.answers[q.id];
    let body = '';
    if (q.type === 'single') {
      body = '<div class="cp-opts" role="radiogroup" aria-label="選択肢">' + q.options.map(o => option(o, a === o.id, false)).join('') + '</div>' + (a ? nextBar(true) : '');
    } else if (q.type === 'multi') {
      const sel = Array.isArray(a) ? a : [];
      body = '<div class="cp-opts" role="group" aria-label="選択肢(最大' + q.max + 'つ)">' + q.options.map(o => option(o, sel.includes(o.id), true)).join('') + '</div>' +
        '<p class="cp-limit" aria-live="polite"></p>' + nextBar(sel.length >= (q.min || 1));
    } else {
      const v = typeof a === 'string' ? a : '';
      body = '<div class="cp-text">' +
        '<textarea id="cpText" maxlength="' + q.max + '" rows="6" placeholder="' + esc(q.placeholder) + '" aria-describedby="cpTextNote cpCount">' + esc(v) + '</textarea>' +
        '<div class="cp-text-meta"><span id="cpTextNote">任意です。書いたことは結果の画面に引用するだけで、橋の選び方と共有文には使いません。</span><span id="cpCount" class="cp-count">' + v.length + ' / ' + q.max + '</span></div>' +
        '</div>' +
        '<div class="cp-next-bar"><button type="button" class="btn primary cp-next" data-act="next">次へ <span aria-hidden="true">→</span></button>' +
        '<button type="button" class="cp-skip" data-act="skip">スキップして次へ</button></div>';
    }
    return '<section class="cp-screen cp-q' + (q.type === 'text' ? ' is-text' : '') + '" data-step="' + q.id + '">' + head(q.id) +
      '<h2 class="cp-q-h" tabindex="-1">' + esc(q.text) + '</h2>' +
      (q.hint ? '<p class="cp-q-hint">' + esc(q.hint) + '</p>' : '') + body + '</section>';
  }
  const nextBar = enabled => '<div class="cp-next-bar"><button type="button" class="btn primary cp-next" data-act="next"' + (enabled ? '' : ' disabled') + '>次へ <span aria-hidden="true">→</span></button></div>';

  function renderTranslating() {
    return '<section class="cp-screen cp-translating" data-step="translating">' +
      '<div class="cp-lines cp-conv" aria-hidden="true">' + convergeSvg() + '</div>' +
      '<p class="cp-trans-t" tabindex="-1">あなたの経験を、<br>別の言葉に翻訳しています。</p>' +
      '</section>';
  }

  /* 結果の地図: これまでの線が「現在地」に集まり、3方向へ分かれる。
     Q10 に答えた人には、点線の4本目(本人が見つけた橋)を足す。
     行の高さ(ROW)と SVG の座標を揃え、橋の名前は HTML で読めるように置く */
  const ROW = 64, MAP_W = 128, OX = 30;
  function heroMap(r) {
    const n = r.bridges.length + (r.wish ? 1 : 0);
    const h = n * ROW, oy = ROW * 1.5;
    const endY = i => ROW * i + ROW / 2;
    let past = '', lines = '', ends = '', travel = '';
    [oy - 34, oy - 12, oy + 16, oy + 38].forEach((y, i) => {
      past += '<path class="ln-n ln-past" pathLength="1" style="--d:' + (i * 0.06).toFixed(2) + 's" d="M0 ' + y + ' C 12 ' + y + ', 18 ' + oy + ', ' + OX + ' ' + oy + '"/>';
    });
    r.bridges.forEach((b, i) => {
      const y = endY(i), d = 'M' + OX + ' ' + oy + ' C ' + (OX + 44) + ' ' + oy + ', ' + (OX + 46) + ' ' + y + ', ' + (MAP_W - 8) + ' ' + y;
      lines += '<path class="ln-main" pathLength="1" style="--d:' + (0.35 + i * 0.16).toFixed(2) + 's" d="' + d + '"/>';
      ends += '<circle class="ln-end" style="--d:' + (1.1 + i * 0.16).toFixed(2) + 's" cx="' + (MAP_W - 8) + '" cy="' + y + '" r="4.5"/>';
      /* 現在地から橋の先へ、ときどき小さな光が流れる。動き出すまでは見えない(opacity 0) */
      const begin = (2.4 + i * 1.2).toFixed(1) + 's';
      if (!REDUCED) travel += '<circle class="ln-travel" r="2.2" opacity="0">' +
        '<animateMotion dur="4.8s" begin="' + begin + '" repeatCount="indefinite" keyPoints="0;1;1" keyTimes="0;0.5;1" calcMode="linear" path="' + d + '"/>' +
        '<animate attributeName="opacity" dur="4.8s" begin="' + begin + '" repeatCount="indefinite" values="0;.8;.8;0;0" keyTimes="0;0.06;0.44;0.5;1"/></circle>';
    });
    if (r.wish) {
      const y = endY(3);
      lines += '<path class="ln-self" d="M' + OX + ' ' + oy + ' C ' + (OX + 40) + ' ' + oy + ', ' + (OX + 40) + ' ' + y + ', ' + (MAP_W - 8) + ' ' + y + '"/>';
      ends += '<circle class="ln-self-end" cx="' + (MAP_W - 8) + '" cy="' + y + '" r="4.5"/>';
    }
    const svg = '<svg class="cp-map-svg" width="' + MAP_W + '" height="' + h + '" viewBox="0 0 ' + MAP_W + ' ' + h + '" aria-hidden="true" focusable="false">' +
      past + lines + ends + travel + '<circle class="ln-origin" cx="' + OX + '" cy="' + oy + '" r="5"/><circle class="ln-origin-ring" cx="' + OX + '" cy="' + oy + '" r="5"/></svg>';
    const items = r.bridges.map((b, i) =>
      '<li style="--i:' + i + '"><a href="#cpB' + (i + 1) + '"><span class="n">0' + (i + 1) + '</span><span class="t">' + esc(b.bridge.name) + '</span></a></li>').join('') +
      (r.wish ? '<li class="self" style="--i:3"><a href="#cpSelf"><span class="n">04</span><span class="t">あなた自身が見つけた橋</span></a></li>' : '');
    return '<div class="cp-map">' + svg +
      '<span class="cp-map-here" style="top:' + (oy + 12) + 'px" aria-hidden="true">現在地</span>' +
      '<ol class="cp-map-list" aria-label="あなたから見える橋">' + items + '</ol></div>';
  }

  function renderResult() {
    const r = E.buildResult(state.answers);
    const quoteBlock = t => '<blockquote class="cp-quote"><p>' + esc(t).replace(/\n/g, '<br>') + '</p></blockquote>';
    const bridges = r.bridges.map((b, i) => {
      const br = b.bridge;
      const links = br.links.length
        ? '<ul class="cp-links">' + br.links.map(l => '<li><a href="' + esc(l.href) + '"><span class="t">' + esc(l.t) + '</span><span class="d">' + esc(l.d) + '</span><span class="ar" aria-hidden="true">→</span></a></li>').join('') + '</ul>'
        : '';
      return '<li class="cp-bridge" id="cpB' + (i + 1) + '" data-reveal>' +
        '<div class="cp-bridge-num en">0' + (i + 1) + '</div>' +
        '<div class="cp-bridge-body">' +
          '<p class="cp-bridge-slot">' + esc(b.slot.label) + '</p>' +
          '<h3 class="cp-bridge-name">' + esc(br.name) + '</h3>' +
          '<p class="cp-bridge-reason">' + esc(b.reason) + '</p>' +
          '<p class="cp-basis"><span class="k">つながっている経験</span>' + b.basis.assets.map(t => '<span class="cp-tag sm">' + esc(t) + '</span>').join('') + '</p>' +
          '<details class="cp-more"><summary>' + (br.links.length ? 'この橋をのぞいてみる' : 'この橋について知る') + '<span class="ar" aria-hidden="true">→</span></summary>' +
            '<p>' + esc(br.about) + '</p>' + links + '</details>' +
        '</div></li>';
    }).join('');
    const lines = r.headlineLines;

    return '<section class="cp-screen cp-result" data-step="result">' +
      /* 01 最初の1画面: 言いかえた見出し・持っているもの・3つの橋だけ。理由は下で */
      '<header class="cp-r-hero">' +
        '<p class="eyebrow">YOUR BRIDGE MAP</p>' +
        '<p class="cp-r-lead">あなたの経験を、別の言葉にすると</p>' +
        '<h1 class="cp-r-h" tabindex="-1">' + lines.map(l => '<span>' + esc(l) + '</span>').join('<br>') + '</h1>' +
        '<ul class="cp-r-tags" aria-label="あなたが持っているもの">' + r.tags.map(t => '<li>' + esc(t) + '</li>').join('') + '</ul>' +
        heroMap(r) +
        (r.openInterests.length ? '<p class="cp-r-open"><span class="k">気になっている方向</span>' + r.openInterests.map(t => '<span>' + esc(t) + '</span>').join('') + '</p>' : '') +
        '<a class="cp-r-cue" href="#cpBr">なぜこの橋が見えたか <span aria-hidden="true">↓</span></a>' +
      '</header>' +

      /* 02 言いかえ */
      '<section class="cp-r-sec" id="cpTr" aria-labelledby="cpTrH">' +
        '<h2 class="cp-r-sub" id="cpTrH">いつもの仕事を、外の言葉で言うと</h2>' +
        (r.translations.length ? '<ul class="cp-tr">' + r.translations.map(t =>
          '<li><span class="from">普段やっている<b>' + esc(t.from) + '</b>は、</span><span class="to">別の言葉にすると<b>' + esc(t.to) + '</b>です。</span></li>').join('') + '</ul>' : '') +
        (r.overlaps.length ? '<p class="cp-note">' + r.overlaps.map(l => '「' + esc(l) + '」').join('') + 'は、得意だと答えつつ、今後はあまりやりたくないとも答えています。できることと、これから増やしたいことは、別で構いません。</p>' : '') +
      '</section>' +

      /* 03 3つの橋の詳細 */
      '<section class="cp-r-sec" aria-labelledby="cpBr">' +
        '<h2 class="cp-r-sub" id="cpBr">3つの橋が見えた理由</h2>' +
        '<ol class="cp-bridges">' + bridges + '</ol>' +
      '</section>' +

      /* 04 Q9: 選択肢では拾いきれない、本人の経験 */
      (r.made ? '<section class="cp-r-sec" aria-labelledby="cpMade"><h2 class="cp-r-sub" id="cpMade">あなたが、これまで作ってきたもの</h2>' +
        '<p class="cp-r-note">質問の選択肢では拾いきれない、あなた自身の経験です。</p>' + quoteBlock(r.made) + '</section>' : '') +

      /* 05 Q10: Compass が見つけた橋とは別の、本人が見つけた橋 */
      (r.wish ? '<section class="cp-r-sec cp-self" id="cpSelf" aria-labelledby="cpWish">' +
        '<p class="cp-self-k"><span class="en">04</span>BRIDGE MAPの、もう1本の線</p>' +
        '<h2 class="cp-r-sub" id="cpWish">あなた自身が見つけた橋</h2>' +
        '<blockquote class="cp-self-q"><p>' + esc(r.wish).replace(/\n/g, '<br>') + '</p></blockquote>' +
        '<p class="cp-self-m">これは、あなた自身が見つけた橋です。</p>' +
        '<p class="cp-r-note">Compassが示した3つの橋と一緒に、あなたの<span class="nowrap">BRIDGE MAP</span>に残しておきます。<br>まだ名前のない可能性も、ここから探していけます。</p>' +
      '</section>' : '') +

      /* 06 メッセージ */
      '<section class="cp-r-close">' +
        '<p>これは、あなたの仕事を決めるための結果ではありません。</p>' +
        '<p>これまでの経験を違う角度から見て、<br class="br-pc">まだ使っていない可能性を見つけるための地図です。</p>' +
        '<p class="last">橋は、渡ってみてから決めてもいい。</p>' +
      '</section>' +

      /* 07 次の一歩 */
      '<aside class="walk cp-walk" aria-labelledby="cpWalk"><div class="walk-inner">' +
        '<p class="eyebrow">Where to next</p>' +
        '<h2 class="walk-h" id="cpWalk">次は、どこへ歩きますか</h2>' +
        '<div class="walk-grid">' +
          '<a class="walk-card" href="../tanaoroshi/index.html"><span class="en">Tanaoroshi</span><span class="t">経験の棚卸し</span><p class="p">18の質問で、職務経歴書のたねをつくります。</p></a>' +
          '<a class="walk-card" href="../stories/index.html"><span class="en">Stories</span><span class="t">物語を読む</span><p class="p">現場で実際にあったことを、一人称で。</p></a>' +
          '<a class="walk-card" href="../products/index.html"><span class="en">Products</span><span class="t">ほかの道具を見る</span><p class="p">用途から選べる、BRIDGEの道具の一覧です。</p></a>' +
        '</div>' +
        '<p class="walk-note">地図を眺めただけで閉じても、それで十分です。</p>' +
      '</div></aside>' +

      /* 08 シェア */
      '<div class="cp-r-act">' +
        '<button type="button" class="btn primary" data-act="share">結果をシェア <span aria-hidden="true">↗</span></button>' +
        '<button type="button" class="btn ghost" data-act="restart">はじめからやり直す</button>' +
        '<p class="cp-share-note">共有する文章には、橋の名前だけが入ります。自由記述の答えは入りません。</p>' +
      '</div>' +
      '</section>';
  }

  /* ---- 遷移 ---- */
  let current = null;
  let busy = false;
  let depth = 0; // この画面内で積んだ history の数

  function screenHtml(step) {
    if (step === 'profession') return renderProfession();
    if (step === 'result') return renderResult();
    if (step === 'translating') return renderTranslating();
    return renderQuestion(Q[step]);
  }

  function show(step, dir) {
    const intro = document.getElementById('cpIntro');
    document.body.classList.toggle('cp-flow', step !== 'intro' && step !== 'result');
    document.body.classList.toggle('cp-at-result', step === 'result');
    const old = current || intro;
    const next = () => {
      let el;
      if (step === 'intro') {
        el = intro;
        if (current && current !== intro) current.remove();
        intro.hidden = false;
        intro.classList.remove('leave', 'leave-back'); // 導入は作り直さず使い回すので、退場時のクラスを外す(残ると透明のまま)
      } else {
        const wrap = document.createElement('div');
        wrap.innerHTML = screenHtml(step);
        el = wrap.firstElementChild;
        if (current && current !== intro) current.remove();
        intro.hidden = true;
        main.appendChild(el);
      }
      current = el;
      window.scrollTo(0, 0);
      if (!REDUCED) {
        el.classList.add(dir < 0 ? 'enter-back' : 'enter');
        requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('enter', 'enter-back')));
      }
      bind(el, step);
      if (window.BRIDGE) { window.BRIDGE.applyBudoux(el); window.BRIDGE.observeReveal(); }
      const h = el.querySelector('[tabindex="-1"]');
      if (h && step !== 'intro') h.focus({ preventScroll: true });
    };
    if (old && !REDUCED && old.isConnected && !old.hidden) {
      old.classList.add(dir < 0 ? 'leave-back' : 'leave');
      setTimeout(next, 180);
    } else next();
  }

  function go(step, opts) {
    const o = Object.assign({ dir: 1, push: true }, opts);
    state.step = step;
    save();
    if (o.push) { history.pushState({ cp: step }, ''); depth++; }
    else history.replaceState({ cp: step }, '');
    show(step, o.dir);
  }

  function back() {
    if (busy) return;
    if (depth > 0) { history.back(); return; }
    const i = STEPS.indexOf(state.step);
    go(STEPS[Math.max(0, i - 1)], { dir: -1, push: false });
  }

  window.addEventListener('popstate', e => {
    const step = (e.state && e.state.cp) || 'intro';
    const dir = STEPS.indexOf(step) < STEPS.indexOf(state.step) ? -1 : 1;
    depth = Math.max(0, depth - 1);
    if (step === 'result' && !complete(state.answers)) return;
    state.step = step;
    save();
    show(step, dir);
  });

  function advance() {
    const i = STEPS.indexOf(state.step);
    const nextStep = STEPS[i + 1];
    if (nextStep === 'result') return finish();
    go(nextStep);
  }

  /* 回答を終えたら、短い間だけ翻訳中の画面を置いて結果へ。実際には何も送っていない */
  function finish() {
    busy = true;
    show('translating', 1);
    setTimeout(() => {
      busy = false;
      if (current && current.dataset.step === 'translating') go('result'); // 途中で戻るを押したら結果へは進まない
    }, REDUCED ? 700 : 1900);
  }

  /* ---- 画面ごとの操作 ---- */
  function bind(el, step) {
    el.addEventListener('click', ev => {
      /* 結果内のページ内リンク。hash を変えると history に積まれて戻る操作と干渉するので、スクロールだけにする */
      const jump = ev.target.closest('a[href^="#"]');
      if (jump) {
        const to = el.querySelector(jump.getAttribute('href'));
        if (to) {
          ev.preventDefault();
          to.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
          if (!to.hasAttribute('tabindex')) to.setAttribute('tabindex', '-1');
          to.classList.add('cp-jump-target'); // 画面遷移の自動フォーカスと違い、着地点は枠で示す
          to.focus({ preventScroll: true });
        }
        return;
      }
      const btn = ev.target.closest('button');
      if (!btn || busy) return;
      const act = btn.dataset.act;
      if (act === 'back') return back();
      if (act === 'next') return advance();
      if (act === 'skip') { state.answers[step] = ''; save(); return advance(); }
      if (act === 'share') return share();
      if (act === 'restart') { state = { step: 'intro', answers: {} }; save(); return go('profession'); }
      const id = btn.dataset.opt;
      if (id) choose(el, step, id);
    });
    const ta = el.querySelector('#cpText');
    if (ta) {
      const count = el.querySelector('#cpCount');
      ta.addEventListener('input', () => {
        state.answers[step] = ta.value;
        count.textContent = ta.value.length + ' / ' + ta.maxLength;
        save();
      });
    }
  }

  function choose(el, step, id) {
    const q = Q[step];
    if (step === 'profession' || q.type === 'single') {
      state.answers[step] = id;
      save();
      el.querySelectorAll('.cp-opt').forEach(b => {
        const on = b.dataset.opt === id;
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', String(on));
      });
      busy = true;
      setTimeout(() => { busy = false; advance(); }, SELECT_DELAY);
      return;
    }
    // 複数選択
    let sel = Array.isArray(state.answers[step]) ? state.answers[step].slice() : [];
    const limit = el.querySelector('.cp-limit');
    limit.textContent = '';
    if (sel.includes(id)) sel = sel.filter(x => x !== id);
    else if (q.none && id === q.none) sel = [id];
    else {
      sel = sel.filter(x => x !== q.none);
      if (sel.length >= q.max) {
        limit.textContent = '選べるのは' + q.max + 'つまでです。外してから選び直せます。';
        return;
      }
      sel.push(id);
    }
    state.answers[step] = sel;
    save();
    el.querySelectorAll('.cp-opt').forEach(b => {
      const on = sel.includes(b.dataset.opt);
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    });
    el.querySelector('.cp-next').disabled = sel.length < (q.min || 1);
  }

  /* ---- 共有。Web Share API が無ければコピー ---- */
  function share() {
    const r = E.buildResult(state.answers);
    const text = E.shareText(r);
    const url = location.origin + location.pathname;
    if (navigator.share) {
      navigator.share({ title: 'BRIDGE Compass', text: text, url: url }).catch(() => {});
      return;
    }
    const full = text + '\n' + url;
    const done = () => toast('共有する文章をコピーしました');
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(full).then(done, () => fallbackCopy(full, done));
    } else fallbackCopy(full, done);
  }
  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('コピーできませんでした。お手数ですが手動で選択してください'); }
    ta.remove();
  }
  let toastTimer = null;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('on'), 2600);
  }

  /* ---- 起動 ---- */
  const introLines = $('.cp-intro-lines');
  if (introLines) introLines.innerHTML = fanSvg({ n: 7, seed: 5, sand: 4 });
  const start = document.getElementById('cpStart');
  start.disabled = false;
  start.addEventListener('click', () => go('profession'));

  if (state.step === 'translating' || (state.step === 'result' && !complete(state.answers))) state.step = complete(state.answers) ? 'result' : 'intro';
  history.replaceState({ cp: state.step }, '');
  if (state.step !== 'intro') show(state.step, 1);
  else { current = document.getElementById('cpIntro'); document.body.classList.remove('cp-flow'); }
})();
