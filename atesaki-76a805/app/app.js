/* ================================================================
   宛先しらべ — 画面(DOM と読み込みだけ。判定は engine.js)
   入力は1つの欄: URL 1本なら取り込み済みの記事を開き、それ以外は本文としてこの端末の中で数える。
   貼った本文はどこにも送らず、保存もしない(localStorage にも入れない)。取り込み済みの記事だけを ?n={key} で履歴に積む
   (貼った本文の結果は履歴に積まない。本文を URL に入れないため)。
   文言の型は editor 照合(2026-09-25): 「届きそう」「刺さる」「答え合わせ」「相対スキ」は画面に出さない。
   ================================================================ */
(function () {
  'use strict';
  const E = window.ATESAKI_ENGINE;
  const S = E.SEGS;

  const SERIES_START = '2026-06-22';   // 「医療職のキャリア拡張」を掲げた記事の日。呼び名は社長の確認待ち
  const SERIES_LABEL = '6月22日から';
  const INGEST_TIMES = '毎日7時40分と19時40分ごろ';
  const LIKES_DAYS = 60;
  const WHO_ORDER = ['general'].concat(E.WHO_IDS);
  const TOPIC_ORDER = E.TOPIC_IDS;

  const $ = id => document.getElementById(id);
  const form = $('atForm');
  const input = $('atIn');
  const msg = $('atMsg');
  const result = $('atResult');
  const map = $('atMap');

  const state = { archive: null, likes: null, evidenceP: null, cal: null, byKey: new Map(), range: 'series', current: null, seq: 0, ready: null };
  const today = new Date().toLocaleDateString('sv-SE');
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dayDiff = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
  const shortOf = id => (S[id] ? S[id].short : '');
  const bold = s => '<b>' + esc(s) + '</b>';

  /* ---- 読み込み ---- */
  async function getJson(path) {
    const res = await fetch(path, { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status + ' ' + path);
    return res.json();
  }
  async function loadArchive() {
    try {
      const [a, l] = await Promise.all([getJson('data/archive.json'), getJson('data/likes.json')]);
      state.archive = a;
      state.likes = l;
      state.byKey = new Map(a.items.map(it => [it.key, it]));
      // 「公開から7日以上」はスキを数えた日で判定する(育ちきらないスキを母数に入れないため)
      state.cal = E.calibrate(a.items, l.likes || {}, l.updated || today);
      state.ignore = new Set(a.boilerplate || []);
      $('atUpdated').textContent = `記事の一覧は${a.generated}時点の${a.count}本`;
      return true;
    } catch (e) {
      $('atUpdated').textContent = '記事の一覧を読めませんでした。本文を貼ると数えられます';
      return false;
    }
  }
  // 読み込みは1回だけ(読み込み中に別の記事を開いても二重に取りに行かない)。
  // 失敗したときは今回だけ根拠なしで描き、次に開いたときに取り直す
  function loadEvidence() {
    state.evidenceP = state.evidenceP || getJson('data/evidence.json')
      .then(ev => new Map(ev.items.map(d => [d.key, d])))
      .catch(() => { state.evidenceP = null; return new Map(); });
    return state.evidenceP;
  }

  /* ---- 最近の記事 ---- */
  function renderRecent() {
    const list = $('atRecentList');
    const items = state.archive.items.slice(0, 5);
    list.innerHTML = items.map(it => {
      const likes = state.likes.likes[it.key];
      return `<li><a href="?n=${esc(it.key)}" data-key="${esc(it.key)}"><span class="t">${esc(it.title)}</span>` +
        `<span class="m">${esc(it.date)}${likes != null ? ' · スキ ' + likes : ''}</span><span class="ar" aria-hidden="true">→</span></a></li>`;
    }).join('');
    list.addEventListener('click', e => {
      const a = e.target.closest('a[data-key]');
      if (!a || e.metaKey || e.ctrlKey || e.shiftKey) return;
      e.preventDefault();
      showKey(a.dataset.key, true);
    });
    $('atRecent').hidden = !items.length;
  }

  /* ---- 欄の下の一文。次にできることを添える ---- */
  function say(text, action) {
    msg.innerHTML = esc(text) + (action ? ` <button type="button" class="at-msg-act">${esc(action)}</button>` : '');
    const b = msg.querySelector('.at-msg-act');
    if (b) b.addEventListener('click', () => { input.value = ''; say(''); input.focus(); });
  }

  /* ---- 送信 ---- */
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const v = input.value.trim();
    if (!v) { say('記事のURLか、下書きの本文を入れてください。'); input.focus(); return; }
    if (E.looksLikeUrl(v)) {
      const p = E.parseNoteUrl(v);
      if (!p) { say('記事のURLは「…/n/」のあとに記事の番号が続く形です。記事のページを開いて、アドレスをそのまま貼ってください。'); return; }
      const ok = await state.ready;   // 一覧の読み込み中なら待つ
      if (!ok) { say('記事の一覧を読めませんでした。本文を貼ると、いま数えられます。', '本文を貼る'); return; }
      if (state.byKey.has(p.key)) { say(''); showKey(p.key, true); return; }
      const me = state.archive.user;
      if (p.user && p.user !== me) {
        say(`取り込んであるのは ${me} の記事です。ほかの人の記事は、本文を貼ると数えられます(辞書は、取り込んだ記事に合わせて作っています)。`, '本文を貼る');
      } else if (p.user === me) {
        say(`この記事は、取り込み済みの一覧の外にあります。公開したばかりの記事なら、次の取り込み(${INGEST_TIMES})で入ります。今すぐ見るときは、本文を貼って数えられます。`, '本文を貼る');
      } else {
        say(`この記事は、取り込み済みの一覧の外にあります。取り込んでいるのは ${me} の note の記事だけです。本文を貼ると数えられます。`, '本文を貼る');
      }
      return;
    }
    say('');
    showPaste(v);
  });

  /* ---- 取り込み済みの記事 ---- */
  async function showKey(key, push) {
    const it = state.byKey.get(key);
    if (!it) return;
    const seq = ++state.seq;
    const ev = await loadEvidence();
    if (seq !== state.seq) return;   // 読み込み中に別の記事が押されたら、後のほうだけを描く
    const d = ev.get(key) || { share: { who: {}, topic: {} }, raw: {}, words: {}, evidence: {} };
    const likes = state.likes.likes[key];
    render({
      source: 'archive', key, title: it.title, url: it.url, date: it.date, likes, paid: it.paid, story: it.story, chars: it.chars, missing: it.missing,
      reader: E.readerOf(it), main: it.main, top: it.top, generalLead: it.generalLead, focus: it.focus,
      titleRead: it.titleRead, gap: it.gap, share: d.share, raw: d.raw, words: d.words, evidence: d.evidence,
      // 比べに入るかはスキを数えた日で決まるので、断り書きも同じ日で判定する
      // missing の記事はスキを読み直さず比べにも入らないので、「次に数え直したときに比べに入ります」を出さない
      settling: !it.missing && dayDiff(it.date, state.likes.updated || today) < E.SETTLE_DAYS, segs: E.segsOf(it),
    });
    if (push && new URLSearchParams(location.search).get('n') !== key) history.pushState({ n: key }, '', '?n=' + encodeURIComponent(key));
  }

  /* ---- 貼った本文。1行目が短く、句点で終わらなければタイトルとして読む ---- */
  function showPaste(v) {
    const lines = v.split(/\r?\n/);
    let title = '';
    let text = v;
    const head = lines[0].trim();
    if (lines.length >= 2 && head.length <= 60 && !/[。.]$/.test(head)) { title = head; text = lines.slice(1).join('\n'); }
    state.seq++;   // 読み込み中の記事があっても、貼った本文の結果を上書きさせない
    const r = E.analyze({ title, text }, { ignore: state.ignore });
    render({
      source: 'paste', title, fromFirstLine: !!title, chars: r.chars, story: r.story,
      reader: r.reader, main: r.main, top: r.top, generalLead: r.generalLead, focus: r.focus,
      titleRead: r.titleRead, gap: r.gap, share: r.share, raw: r.raw, words: r.words,
      evidence: pickEvidence(r), segs: E.segsOf(r),
    });
    if (new URLSearchParams(location.search).has('n')) history.pushState({}, '', location.pathname);
  }
  function pickEvidence(r) {
    const out = {};
    if (r.story) return out;
    for (const id of [r.main.who, r.main.topic]) if (id && r.evidence[id] && r.evidence[id].length) out[id] = r.evidence[id].slice(0, 1);
    return out;
  }

  /* ---- 結果 ---- */
  function quoteHtml(q) {
    let html = '';
    let at = 0;
    for (const [a, b] of q.marks) {
      if (a < at) continue;
      html += esc(q.text.slice(at, a)) + bold(q.text.slice(a, b));
      at = b;
    }
    return html + esc(q.text.slice(at));
  }
  function gapLine(vm) {
    const t = vm.titleRead || {};
    if (vm.story || (!t.who && !t.topic)) return '';
    // 本文から宛先を読み取れなかったときは、題が向いている先だけを言う(「そろっている」とは言わない)
    if (!(vm.reader || {}).found) {
      const named = [t.who, t.topic].filter(Boolean).map(id => bold(shortOf(id))).join('・');
      return `<p>タイトルは${named}に向いています。宛先を読み取れるだけの言葉があるのは、いまはタイトルだけです。</p>`;
    }
    if (!vm.gap.who && !vm.gap.topic) return '<p>タイトルと本文の宛先は、そろっています。</p>';
    const side = (who, topic) => [vm.gap.who ? shortOf(who) : '', vm.gap.topic ? shortOf(topic) : ''].filter(Boolean).map(bold).join('・');
    return `<p>タイトルは${side(t.who, t.topic)}に、本文は${side(vm.main.who, vm.main.topic)}に向いた言葉が多い記事です。</p>`;
  }
  function contrastLine(vm) {
    // 宛先を一文にできなかった記事では、割合の差も語らない(言葉がほとんどないところから割合を言わない)
    if (vm.story || !(vm.reader || {}).found || !state.archive || !state.archive.baseline) return '';
    const d = E.contrast(vm.share || {}, state.archive.baseline);
    const more = d.more.slice(0, 2).map(x => bold(shortOf(x.id)));
    const less = d.less.slice(0, 2).map(x => bold(shortOf(x.id)));
    if (!more.length && !less.length) return '<p>言葉の割合は、いつもの記事に近いものでした。</p>';
    const parts = [];
    if (more.length) parts.push(more.join('と') + 'の言葉が多め');
    if (less.length) parts.push(less.join('と') + 'の言葉が少なめ');
    return `<p>いつもの記事と比べて、${parts.join('、')}です。</p>`;
  }
  function barsHtml(ids, share, words) {
    const rows = ids.filter(id => (share[id] || 0) > 0);
    if (!rows.length) return '<p class="at-small">この軸の言葉は出てきませんでした。</p>';
    const max = Math.max(...rows.map(id => share[id]));
    return '<ul class="at-bars">' + rows.map(id => {
      const w = (words[id] || []).map(x => `${x.term}×${x.count}`).join('・');
      return `<li><span class="r"><span class="l">${esc(S[id].label)}</span><span class="v">${Math.round(share[id] * 100)}%</span></span>` +
        `<span class="bar" style="width:${Math.max(2, Math.round(share[id] / max * 100))}%" aria-hidden="true"></span>` +
        (w ? `<span class="s">${esc(w)}</span>` : '') + '</li>';
    }).join('') + '</ul>';
  }

  function render(vm) {
    state.current = vm;
    const r = vm.reader || {};
    // 枠(kicker)と見出しで1つの文になるようにする。宛先を出さないときは枠も変える
    let kicker = 'この記事の言葉が向いているのは';
    let heading;
    let quiet = false;
    const notes = [];
    if (vm.story) {
      kicker = '物語の回として読みました';
      heading = '宛先の一文の代わりに、内訳を出します';
      quiet = true;
      notes.push('<p>登場人物の職種の言葉は、読み手の職種と重なるとは限らないためです。</p>');
    } else if (r.found) {
      heading = r.text;
      if (r.note === 'mixedTopic') notes.push('<p>関心の言葉は、いくつかに分かれています。</p>');
    } else {
      kicker = 'この記事では';
      heading = '特定の職種や関心に寄った言葉は、少なめでした';
      quiet = true;
    }

    const meta = vm.source === 'archive'
      ? `<a class="t" href="${esc(vm.url)}" target="_blank" rel="noopener">${esc(vm.title)} <span aria-hidden="true">↗</span></a>` +
        `<span class="m">${esc(vm.date)}${vm.likes != null ? ' · スキ ' + vm.likes : ''}${vm.settling ? '(スキを数えた日には公開から7日未満でした。7日以上たってから、次にスキを数え直したときに比べに入ります)' : ''}</span>`
      : `<p class="t">${esc(vm.title || '貼った本文')}</p>` +
        `<span class="m">${vm.chars}字 · この端末の中だけで数えました${vm.fromFirstLine ? ' · 1行目をタイトルとして読みました' : ''}</span>`;

    const contrast = contrastLine(vm);
    // 取り込みで記事ページが見つからなかった記事(missing)。データは前に読んだときのまま残している
    const missing = vm.missing ? `<p>この記事は、${esc(vm.missing.since)}の取り込みから note で開けなくなっています。数えた結果とスキは、その前に読んだときのものです。</p>` : '';
    const lines = notes.concat([gapLine(vm), contrast, vm.paid ? '<p>有料記事は、無料で読める部分だけを数えています。</p>' : '', missing]).filter(Boolean);

    const quotes = [];
    for (const id of [vm.main && vm.main.who, vm.main && vm.main.topic]) {
      for (const q of ((vm.evidence || {})[id] || []).slice(0, 1)) {
        quotes.push(`<li><span class="w">${esc(S[id].short)}の言葉${q.where === 'title' ? '(タイトル)' : ''}</span>${quoteHtml(q)}</li>`);
      }
    }

    result.innerHTML =
      '<div class="sec-inner at-col">' +
        `<div class="at-meta">${meta}</div>` +
        `<p class="at-k">${esc(kicker)}</p>` +
        `<h2 class="at-reader${quiet ? ' is-quiet' : ''}" id="atReader" tabindex="-1">${esc(heading)}</h2>` +
        (lines.length ? `<div class="at-lines">${lines.join('')}</div>` : '') +
        (quotes.length ? `<h3 class="at-sub">そう読んだ文</h3><ul class="at-quotes">${quotes.join('')}</ul>` : '') +
        '<h3 class="at-sub">分からないこと</h3>' +
        '<p class="at-p">実際に読んだ人の職種と人数。スキを押した人の職種。宛先の一文は、記事の言葉だけから出しています。読まれた数(ビュー)は、note のダッシュボードで見られます。</p>' +
        '<p class="at-small">数えているのは言葉の種類と数で、文章のよしあしは対象外です。スキの傾向は、下の「これまでの記事の宛先」にまとめています。</p>' +
        `<details class="at-more"${vm.story ? ' open' : ''}><summary>内訳を見る <span class="ar" aria-hidden="true">→</span></summary><div class="at-more-body">` +
          '<h3 class="at-sub">誰に(本文の職種の言葉の割合)</h3>' + barsHtml(E.WHO_IDS, (vm.share || {}).who || {}, vm.words || {}) +
          ((vm.words || {}).general ? `<p class="at-small">職種を名指ししない言葉: ${esc(vm.words.general.map(x => `${x.term}×${x.count}`).join('・'))}</p>` : '') +
          '<h3 class="at-sub">何に(本文の関心の言葉の割合)</h3>' + barsHtml(E.TOPIC_IDS, (vm.share || {}).topic || {}, vm.words || {}) +
          '<p class="at-small">割合は、その軸の言葉が出てきた文を、語の重みをかけて数えたものです。タイトルは割合とは別に読み、本文と並べています。複数の記事に同じ形で出る行(シリーズの案内・告知)は、数える前に外しています。' + (contrast ? '「いつもの記事」は、物語を除くこれまでの記事の平均です。' : '') + '</p>' +
        '</div></details>' +
        '<div class="at-again"><button class="btn ghost" type="button" id="atAgain">別の記事を数える</button></div>' +
      '</div>';
    result.hidden = false;
    $('atAgain').addEventListener('click', () => {
      if (new URLSearchParams(location.search).has('n')) history.pushState({}, '', location.pathname);
      backToInput();
    });
    if (window.BRIDGE && window.BRIDGE.applyBudoux) window.BRIDGE.applyBudoux(result);
    renderMap();
    result.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    $('atReader').focus({ preventScroll: true });
  }

  function backToInput() {
    state.seq++;   // 読み込み中の記事があっても、戻ったあとで描かせない
    state.current = null;
    result.hidden = true;
    result.innerHTML = '';
    renderMap();
    window.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
    input.focus({ preventScroll: true });
  }

  /* ---- これまでの記事の宛先 ---- */
  function calLine(id) {
    const b = state.cal.bySeg[id];
    // 比べられる記事が MIN_N 本に満たない関心は、行ごとには書かない(一覧の下の一文で断る)
    if (!b || b.n < E.MIN_N) return '';
    const head = `全期間のスキ: ${b.n}本中${b.above}本が、同じ時期の記事の中央値より多い`;
    if (b.verdict === 'more') return head + '(多め)';
    if (b.verdict === 'less') return head + '(少なめ)';
    return head + '(ふだんの幅の中)';
  }
  function mapRows(ids, counts, withCal) {
    const max = Math.max(1, ...ids.map(id => counts[id] || 0));
    const here = new Set(state.current && !state.current.story ? state.current.segs : []);
    return ids.map(id => {
      const n = counts[id] || 0;
      const chip = here.has(id) ? '<span class="chip run">この記事</span>' : '';
      const s = withCal ? calLine(id) : '';
      return `<li class="${n ? '' : 'is-empty'}"><span class="r"><span class="l">${esc(S[id].label)}${chip}</span><span class="v">${n}本</span></span>` +
        `<span class="bar${n ? '' : ' zero'}" style="width:${n ? Math.max(2, Math.round(n / max * 100)) : 0}%" aria-hidden="true"></span>` +
        (s ? `<span class="s">${esc(s)}</span>` : '') + '</li>';
    }).join('');
  }
  // 範囲の切り替えボタンは一度だけ作り、押したときは状態だけを書き換える(作り直すとフォーカスが消える)
  function renderRange() {
    const range = $('atRange');
    if (!range.children.length) {
      range.innerHTML = [['series', SERIES_LABEL], ['all', '全期間']].map(([k, t]) =>
        `<button type="button" class="tag" data-range="${k}">${esc(t)}</button>`).join('');
    }
    for (const b of range.querySelectorAll('[data-range]')) {
      const on = b.dataset.range === state.range;
      b.classList.toggle('active', on);
      b.setAttribute('aria-pressed', String(on));
    }
  }
  function renderMap() {
    if (!state.archive) return;
    const inRange = it => state.range === 'all' || it.date >= SERIES_START;
    const all = state.archive.items.filter(inRange);
    const stories = all.filter(it => it.story).length;
    const pool = all.filter(it => !it.story);
    const counts = {};
    for (const it of pool) for (const id of E.segsOf(it)) counts[id] = (counts[id] || 0) + 1;

    renderRange();
    $('atMapNote').textContent = `${stories ? `物語の${stories}本を除いた、` : ''}${pool.length}本の記事を数えています。1本の記事が、複数の宛先に入ることがあります。`;
    $('atBarsWho').innerHTML = mapRows(WHO_ORDER, counts, false);
    $('atBarsTopic').innerHTML = mapRows(TOPIC_ORDER, counts, true);
    $('atMapLikes').textContent =
      `スキの行は全期間で数え、比べられる記事が${E.MIN_N}本以上ある関心にだけ出しています。` +
      'スキから分かるのは押された数までです。曜日や投稿の時刻、note のおすすめも重なるので、言葉がスキを動かしたとまでは言えません。数え方は「数えている言葉とスキの数字」にあります。';
    map.hidden = false;
    if (window.BRIDGE && window.BRIDGE.applyBudoux) window.BRIDGE.applyBudoux(map);
  }
  $('atRange').addEventListener('click', e => {
    const b = e.target.closest('[data-range]');
    if (!b) return;
    state.range = b.dataset.range;
    renderMap();
  });

  /* ---- 数えている言葉(第8条: 判断材料を隠さない)と、スキの数字 ---- */
  function renderLexicon() {
    const seg = id => `<li><b>${esc(S[id].label)}</b><span>${esc(S[id].terms.map(([t, w]) => `${t} ${w}`).join('・'))}</span></li>`;
    // 判定の本数(MIN_N)に満たない関心は、中央値を出さない(1本の7倍が「スキが多い」と読まれないように)
    const calRows = TOPIC_ORDER.map(id => {
      const b = state.cal ? state.cal.bySeg[id] : null;
      if (!b || !b.n) return '';
      const v = b.n < E.MIN_N ? `${b.n}本(判定は${E.MIN_N}本から)` : `${b.n}本 · 中央値 ${b.median}倍 · 真ん中の半分は ${b.q1}〜${b.q3}倍`;
      return `<dt>${esc(S[id].short)}</dt><dd>${esc(v)}</dd>`;
    }).join('');
    const c = state.cal;
    const likesAt = state.likes && state.likes.updated;
    $('atLexiconBody').innerHTML =
      '<p class="at-small">語のあとの数字は重みです(3 = その読み手を名指しする語、2 = その読み手の場面や道具、1 = 寄るがほかでも使う語、1未満 = 手がかりとして弱い語。2.5 や 1.5 はその間)。1つの文では、読み手ごとに一番重い語を1回だけ数えます。辞書は atesaki-76a805/app/lexicon.js にあります。</p>' +
      '<h3 class="at-sub">誰に</h3><ul class="at-lex">' + WHO_ORDER.map(seg).join('') + '</ul>' +
      '<h3 class="at-sub">何に</h3><ul class="at-lex">' + TOPIC_ORDER.map(seg).join('') + '</ul>' +
      '<h3 class="at-sub">スキの数字</h3>' +
      `<p class="at-small">記事ごとに、スキが「前後45日(記事が少ない時期は90日)に出した記事のスキの中央値」の何倍かを出しています。スキが0の記事も比べられるように、割る前にどちらにも1を足しています。数えるのは、スキを数えた日に公開から7日以上たっていた記事(物語・有料${c.missing ? 'と、note で開けなくなっている記事' : ''}を除く${c.counted}本)です。` +
      `関心ごとにこの倍率の中央値を見て、${E.MORE}倍以上なら「多め」、${E.LESS}倍以下なら「少なめ」とします(どちらも、3分の2以上の記事が同じ向きのとき)。それ以外は「ふだんの幅の中」です。多め・少なめを出すのは、比べられる記事が${E.MIN_N}本以上ある関心だけです。` +
      (likesAt ? `スキの数は${esc(likesAt)}時点です(公開から${LIKES_DAYS}日を過ぎた記事${c.missing ? 'と、note で開けなくなっている記事' : ''}は、それより前に数えた値)。` : '') + '</p>' +
      (calRows ? '<dl class="at-dl">' + calRows + '</dl>' : '');
  }

  /* ---- 履歴(戻るで入力に戻れる・?n={key} で開き直せる) ---- */
  window.addEventListener('popstate', () => {
    const key = new URLSearchParams(location.search).get('n');
    if (key && state.byKey.has(key)) showKey(key, false);
    else backToInput();
  });

  (async function init() {
    state.ready = loadArchive();
    const ok = await state.ready;
    if (ok) {
      renderRecent();
      renderMap();
      renderLexicon();
      const key = new URLSearchParams(location.search).get('n');
      if (key && state.byKey.has(key)) showKey(key, false);
      else if (key) say('この記事は、取り込み済みの一覧の外にあります。本文を貼ると数えられます。', '本文を貼る');
    }
  })();
})();
