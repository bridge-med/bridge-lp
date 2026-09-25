/* ================================================================
   宛先しらべ — 画面(DOM と読み込みだけ。判定は engine.js)
   入力は1つの欄: URL 1本なら取り込み済みの記事を開き、それ以外は本文としてこの端末の中で数える。
   貼った本文はどこにも送らず、保存もしない(localStorage にも入れない)。記事の URL だけを ?n={key} で履歴に積む。
   文言の型は editor 照合(2026-09-25): 「届きそう」「刺さる」「答え合わせ」「相対スキ」は画面に出さない。
   ================================================================ */
(function () {
  'use strict';
  const E = window.ATESAKI_ENGINE;
  const S = E.SEGS;

  const SERIES_START = '2026-06-22';   // 「医療職のキャリア拡張」を掲げた記事の日。いまの連載の始まり
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

  const state = { archive: null, likes: null, evidence: null, cal: null, byKey: new Map(), range: 'series', current: null };
  const today = new Date().toLocaleDateString('sv-SE');
  const reduced = () => window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dayDiff = (a, b) => Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000);
  const jpDate = d => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || ''); return m ? `${+m[1]}年${+m[2]}月${+m[3]}日` : ''; };
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
      state.cal = E.calibrate(a.items, l.likes || {}, today);
      state.ignore = new Set(a.boilerplate || []);
      $('atUpdated').textContent = `記事の一覧は${jpDate(a.generated)}時点の${a.count}本`;
      return true;
    } catch (e) {
      $('atUpdated').textContent = '記事の一覧を読めませんでした。本文を貼ると数えられます';
      return false;
    }
  }
  async function loadEvidence() {
    if (state.evidence) return state.evidence;
    try {
      const ev = await getJson('data/evidence.json');
      state.evidence = new Map(ev.items.map(d => [d.key, d]));
    } catch (e) {
      state.evidence = new Map();
    }
    return state.evidence;
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
      if (!state.archive) { say('記事の一覧を読めませんでした。本文を貼ると、いま数えられます。', '本文を貼る'); return; }
      if (state.byKey.has(p.key)) { say(''); showKey(p.key, true); return; }
      if (p.user && p.user !== state.archive.user) {
        say(`いま読めるのは ${state.archive.user} の記事です。ほかの記事は、本文を貼ると数えられます(辞書は ${state.archive.user} の記事に合わせて作っています)。`, '本文を貼る');
        return;
      }
      say(`この記事は、次の取り込み(${INGEST_TIMES})で入ります。今すぐ見るときは、本文を貼って数えられます。`, '本文を貼る');
      return;
    }
    say('');
    showPaste(v);
  });

  /* ---- 取り込み済みの記事 ---- */
  async function showKey(key, push) {
    const it = state.byKey.get(key);
    if (!it) return;
    const ev = await loadEvidence();
    const d = ev.get(key) || { share: { who: {}, topic: {} }, raw: {}, words: {}, evidence: {} };
    const likes = state.likes.likes[key];
    render({
      source: 'archive', key, title: it.title, url: it.url, date: it.date, likes, paid: it.paid, story: it.story, chars: it.chars,
      reader: it.reader, main: it.main, top: it.top, generalLead: it.generalLead, focus: it.focus,
      titleRead: it.titleRead, gap: it.gap, share: d.share, raw: d.raw, words: d.words, evidence: d.evidence,
      settling: dayDiff(it.date, today) < E.SETTLE_DAYS, segs: E.segsOf(it),
    });
    if (push) history.pushState({ n: key }, '', '?n=' + encodeURIComponent(key));
  }

  /* ---- 貼った本文。1行目が短く、句点で終わらなければタイトルとして読む ---- */
  function showPaste(v) {
    const lines = v.split(/\r?\n/);
    let title = '';
    let text = v;
    const head = lines[0].trim();
    if (lines.length >= 2 && head.length <= 60 && !/[。.]$/.test(head)) { title = head; text = lines.slice(1).join('\n'); }
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
    if (!vm.gap.who && !vm.gap.topic) return '<p>タイトルと本文の宛先は、そろっています。</p>';
    const side = (who, topic) => [vm.gap.who ? shortOf(who) : '', vm.gap.topic ? shortOf(topic) : ''].filter(Boolean).map(bold).join('・');
    return `<p>タイトルは${side(t.who, t.topic)}に、本文は${side(vm.main.who, vm.main.topic)}に向いた言葉が多い記事です。</p>`;
  }
  function contrastLine(vm) {
    if (vm.story || !state.archive || !state.archive.baseline) return '';
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
    let heading;
    let quiet = false;
    const notes = [];
    if (vm.story) { heading = '物語の回は、言葉の数では宛先を出しません'; quiet = true; notes.push('<p>登場人物の職種の言葉は、読み手の職種とは限らないためです。内訳は下で見られます。</p>'); }
    else if (r.found) { heading = r.text; if (r.note === 'mixedTopic') notes.push('<p>関心の言葉は、いくつかに分かれています。</p>'); }
    else { heading = '特定の職種や関心に寄った言葉は、少なめでした'; quiet = true; }

    const meta = vm.source === 'archive'
      ? `<a class="t" href="${esc(vm.url)}" target="_blank" rel="noopener">${esc(vm.title)} <span aria-hidden="true">↗</span></a>` +
        `<span class="m">${esc(vm.date)}${vm.likes != null ? ' · スキ ' + vm.likes : ''}${vm.settling ? '(公開から7日未満で、スキは集計中)' : ''}</span>`
      : `<p class="t">${esc(vm.title || '貼った本文')}</p>` +
        `<span class="m">${vm.chars}字 · この端末の中だけで数えました${vm.fromFirstLine ? ' · 1行目をタイトルとして読みました' : ''}</span>`;

    const lines = notes.concat([gapLine(vm), contrastLine(vm), vm.paid ? '<p>有料記事は、無料で読める部分だけを数えています。</p>' : '']).filter(Boolean);

    const quotes = [];
    for (const id of [vm.main && vm.main.who, vm.main && vm.main.topic]) {
      for (const q of ((vm.evidence || {})[id] || []).slice(0, 1)) {
        quotes.push(`<li><span class="w">${esc(S[id].short)}の言葉${q.where === 'title' ? '(タイトル)' : ''}</span>${quoteHtml(q)}</li>`);
      }
    }

    result.innerHTML =
      '<div class="sec-inner at-col">' +
        `<div class="at-meta">${meta}</div>` +
        '<p class="at-k">この記事の言葉が向いているのは</p>' +
        `<h2 class="at-reader${quiet ? ' is-quiet' : ''}" id="atReader" tabindex="-1">${esc(heading)}</h2>` +
        (lines.length ? `<div class="at-lines">${lines.join('')}</div>` : '') +
        (quotes.length ? `<h3 class="at-sub">そう読んだ文</h3><ul class="at-quotes">${quotes.join('')}</ul>` : '') +
        '<h3 class="at-sub">分からないこと</h3>' +
        '<p class="at-p">実際に読んだ人の職種と人数。スキを押した人の職種。この道具が見るのは、記事の言葉だけです。ビュー数とスキは、note のダッシュボードで見られます。</p>' +
        '<p class="at-small">数えているのは言葉の種類と数で、文章のよしあしは対象外です。スキの傾向は、下の「これまでの記事の宛先」にまとめています。</p>' +
        '<details class="at-more"><summary>内訳を見る <span class="ar" aria-hidden="true">→</span></summary><div class="at-more-body">' +
          '<h3 class="at-sub">誰に(本文の職種の言葉の割合)</h3>' + barsHtml(E.WHO_IDS, (vm.share || {}).who || {}, vm.words || {}) +
          ((vm.words || {}).general ? `<p class="at-small">職種を名指ししない言葉: ${esc(vm.words.general.map(x => `${x.term}×${x.count}`).join('・'))}</p>` : '') +
          '<h3 class="at-sub">何に(本文の関心の言葉の割合)</h3>' + barsHtml(E.TOPIC_IDS, (vm.share || {}).topic || {}, vm.words || {}) +
          '<p class="at-small">割合は、その軸の言葉が出てきた文を数えたものです。タイトルは割合に入れず、本文と並べて見ています。複数の記事に同じ形で出る行(シリーズの案内・告知)は数えていません。</p>' +
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
    const head = `スキ: ${b.n}本中${b.above}本が、同じ時期の記事より多い`;
    if (b.verdict === 'more') return head + '(多め)';
    if (b.verdict === 'less') return head + '(少なめ)';
    return head + '(差は見分けられません)';
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
  function renderMap() {
    if (!state.archive) return;
    const all = state.archive.items;
    const stories = all.filter(it => it.story).length;
    const pool = all.filter(it => !it.story && (state.range === 'all' || it.date >= SERIES_START));
    const counts = {};
    for (const it of pool) for (const id of E.segsOf(it)) counts[id] = (counts[id] || 0) + 1;

    const range = $('atRange');
    range.innerHTML = [['series', `いまの連載(${SERIES_LABEL})`], ['all', '全期間']].map(([k, t]) =>
      `<button type="button" class="tag${state.range === k ? ' active' : ''}" data-range="${k}" aria-pressed="${state.range === k}">${esc(t)}</button>`).join('');

    $('atMapNote').textContent = `${pool.length}本の記事を数えています。物語の${stories}本は入れていません。1本の記事が、2つの宛先に入ることがあります。`;
    $('atBarsWho').innerHTML = mapRows(WHO_ORDER, counts, false);
    $('atBarsTopic').innerHTML = mapRows(TOPIC_ORDER, counts, true);
    const c = state.cal;
    const likesAt = state.likes.updated ? jpDate(state.likes.updated) : '';
    $('atMapLikes').textContent =
      `スキの行は、範囲の切り替えに関係なく全期間で見ています。公開から7日以上の記事(物語・有料を除く${c.counted}本)のスキを、前後45日に出した記事のスキの中央値と比べたものです。` +
      `比べられる記事が${E.MIN_N}本に満たない関心は、まだ判定できません。スキは、誰が押したかを表しません。曜日・投稿の時刻・note のおすすめなども重なっていて、言葉がスキを増やしたとは言えません。` +
      (likesAt ? `スキの数は${likesAt}時点です(公開から${LIKES_DAYS}日を過ぎた記事は、それより前に数えた値)。` : '');
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
    const calRows = TOPIC_ORDER.map(id => {
      const b = state.cal ? state.cal.bySeg[id] : null;
      if (!b || !b.n) return '';
      return `<dt>${esc(S[id].short)}</dt><dd>${b.n}本 · 中央値 ${b.median} · 半分の記事は ${b.q1}〜${b.q3}</dd>`;
    }).join('');
    $('atLexiconBody').innerHTML =
      '<p class="at-small">語のあとの数字は重みです(3 = その読み手を名指しする語、2 = その読み手の場面や道具、1 = 寄るがほかでも使う語)。1つの文では、一番重い語を1回だけ数えます。辞書は atesaki-76a805/app/lexicon.js にあります。</p>' +
      '<h3 class="at-sub">誰に</h3><ul class="at-lex">' + WHO_ORDER.map(seg).join('') + '</ul>' +
      '<h3 class="at-sub">何に</h3><ul class="at-lex">' + TOPIC_ORDER.map(seg).join('') + '</ul>' +
      (calRows ? '<h3 class="at-sub">スキの数字(同じ時期の記事の中央値を1としたとき)</h3><dl class="at-dl">' + calRows + '</dl>' : '');
  }

  /* ---- 履歴(戻るで入力に戻れる・?n={key} で開き直せる) ---- */
  window.addEventListener('popstate', () => {
    const key = new URLSearchParams(location.search).get('n');
    if (key && state.byKey.has(key)) showKey(key, false);
    else backToInput();
  });

  (async function init() {
    const ok = await loadArchive();
    if (ok) {
      renderRecent();
      renderMap();
      renderLexicon();
      const key = new URLSearchParams(location.search).get('n');
      if (key && state.byKey.has(key)) showKey(key, false);
    }
  })();
})();
