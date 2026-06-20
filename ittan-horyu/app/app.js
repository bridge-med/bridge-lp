/* =========================================================================
 * いったん保留 — app.js
 * 画面描画 / ルーティング / 下部ナビ / 相棒キャラ「ホリュ」。
 * データ操作はすべて window.Store 経由（store.js）。
 * ========================================================================= */
(function (global) {
  'use strict';

  var Store = global.Store;
  var screenEl = document.getElementById('screen');
  var tabbarEl = document.getElementById('tabbar');
  var toastEl = document.getElementById('toast');
  var confettiEl = document.getElementById('confetti');

  // ---- ルーター状態 --------------------------------------------------------
  var route = { name: 'home', params: {} };
  var listFilter = 'all';            // 保留中リストのフィルター
  var monthOffset = 0;               // 月次画面の表示月オフセット(0=今月)
  // 追加フォームの一時状態
  var draft = { name: '', price: '', category: 'ガジェット', reason: '欲しい', coolingPeriod: '3d', memo: '' };

  // =========================================================================
  // ヘルパー
  // =========================================================================
  function el(html) {
    var t = document.createElement('template');
    t.innerHTML = html.trim();
    return t.content.firstChild;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function yen(n) { return Number(n || 0).toLocaleString('ja-JP'); }

  function fmtDate(iso) {
    var d = new Date(iso);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日';
  }
  function fmtDateTime(iso) {
    var d = new Date(iso);
    var h = d.getHours();
    return fmtDate(iso) + ' ' + h + ':' + ('0' + d.getMinutes()).slice(-2);
  }
  function categoryIcon(cat) { return Store.CATEGORY_ICONS[cat] || '🎁'; }

  /** 残り時間を人にやさしい文言にする（端数は切り上げ：「残3日」になるように） */
  function remainingText(ms) {
    if (ms <= 0) return '判断できます';
    if (ms >= 86400000) return '残り' + Math.ceil(ms / 86400000) + '日';
    if (ms >= 3600000) return '残り' + Math.ceil(ms / 3600000) + '時間';
    if (ms >= 60000) return '残り' + Math.ceil(ms / 60000) + '分';
    return 'まもなく';
  }

  var STATUS_LABEL = { holding: '保留中', ready: '判断待ち', purchased: '買った', skipped: '見送り済み' };

  function statusBadge(d) {
    return '<span class="badge ' + d.status + '">' + STATUS_LABEL[d.status] + '</span>';
  }

  /** 相棒キャラ「ホリュ」のSVG（face: 'smile'|'wink'|'think'|'cheer'） */
  function mascot(size, face, sway) {
    size = size || 52;
    face = face || 'smile';
    var eyes;
    if (face === 'wink') {
      eyes = '<circle class="eye" cx="40" cy="52" r="4.5"/><path class="eye" d="M55 52 q5 -5 10 0" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" style="stroke:var(--ink)"/>';
    } else if (face === 'think') {
      eyes = '<circle class="eye" cx="40" cy="52" r="4"/><circle class="eye" cx="60" cy="52" r="4"/><circle cx="50" cy="62" r="2.4" class="eye" opacity=".5"/>';
    } else if (face === 'cheer') {
      eyes = '<path class="eye" d="M34 54 q6 -8 12 0" stroke="var(--ink)" stroke-width="3.4" fill="none" stroke-linecap="round"/><path class="eye" d="M54 54 q6 -8 12 0" stroke="var(--ink)" stroke-width="3.4" fill="none" stroke-linecap="round"/>';
    } else {
      eyes = '<circle class="eye" cx="40" cy="52" r="4.6"/><circle class="eye" cx="60" cy="52" r="4.6"/>';
    }
    return '' +
      '<svg class="mascot' + (sway ? ' sway' : '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 100 100" aria-hidden="true">' +
        '<ellipse class="body" cx="50" cy="56" rx="40" ry="38"/>' +
        '<ellipse class="belly" cx="50" cy="70" rx="24" ry="20"/>' +
        '<circle class="cheek" cx="28" cy="62" r="7"/>' +
        '<circle class="cheek" cx="72" cy="62" r="7"/>' +
        eyes +
        (face === 'cheer'
          ? '<ellipse cx="50" cy="68" rx="7" ry="8" fill="var(--ink)"/>'
          : '<path d="M44 66 q6 6 12 0" stroke="var(--ink)" stroke-width="2.6" fill="none" stroke-linecap="round"/>') +
        '<path d="M16 30 q8 -14 22 -6" stroke="var(--orange-deep)" stroke-width="4" fill="none" stroke-linecap="round" opacity=".6"/>' +
      '</svg>';
  }

  function buddyBubble(text, face) {
    return '<div class="buddy"><div class="avatar">' + mascot(52, face || 'smile', true) +
      '</div><div class="speech">' + esc(text) + '</div></div>';
  }

  // 一言アドバイスのバリエーション（ホーム用）
  var HOME_TIPS = [
    '少し時間をおくことで、本当に大切なものが見えてくるよ。',
    '欲しい気持ちはそのままに、少しだけ時間を置こう。',
    '勢いの買い物も、いったん保留。未来の自分が助かるかも。',
    '今日も、ひと呼吸おけたね。えらい。'
  ];

  // =========================================================================
  // 画面: ホーム
  // =========================================================================
  function viewHome() {
    var now = Date.now();
    var items = Store.all(now);
    var holding = items.filter(function (i) { return i.status === 'holding' || i.status === 'ready'; });
    var readyItems = holding.filter(function (i) { return i.status === 'ready'; });
    var sum = Store.monthlySummary();
    var tip = readyItems.length
      ? readyItems.length + '件、そろそろ見直しどき。いっしょに考えよう。'
      : HOME_TIPS[new Date().getDate() % HOME_TIPS.length];

    // 注目アイテム：判断待ちを優先、なければ残り時間が一番短いもの
    var feature = readyItems[0] || holding.slice().sort(function (a, b) { return a.remainingMs - b.remainingMs; })[0];

    var wrap = el('<div class="fade-in"></div>');
    wrap.innerHTML =
      '<header class="appbar">' +
        '<div><div class="title">いったん保留</div><div class="sub">買う前に、少しだけ寝かせる。</div></div>' +
        '<div class="logo-dot">🫧</div>' +
      '</header>' +
      '<section class="stats">' +
        '<div class="stat hold"><div class="k">いま保留中</div><div class="v">' + holding.length + '<small>件</small></div>' +
          '<div class="u">' + (readyItems.length ? readyItems.length + '件 判断待ち' : 'じっくり寝かせ中') + '</div></div>' +
        '<div class="stat saved"><div class="k">今月 見送れた</div><div class="v"><small>¥</small>' + yen(sum.savedThisMonth) + '</div>' +
          '<div class="u">守れた金額</div></div>' +
      '</section>' +
      '<div style="margin-top:14px">' + buddyBubble(tip, readyItems.length ? 'think' : 'smile') + '</div>' +
      '<h2 class="section">注目アイテム<span class="hint">そろそろ見直してみよう</span></h2>' +
      (feature ? featureCard(feature) : emptyFeature());

    // 直近の保留
    var others = holding.filter(function (i) { return !feature || i.id !== feature.id; }).slice(0, 4);
    if (others.length) {
      wrap.innerHTML += '<h2 class="section">ほかの保留中</h2>' +
        others.map(function (i) { return itemCard(i); }).join('');
    }
    return wrap;
  }

  function featureCard(d) {
    var cd = d.isReady ? 'ready' : 'holding';
    return '<button class="item feature" data-go="detail" data-id="' + d.id + '">' +
      '<div class="thumb">' + categoryIcon(d.category) + '</div>' +
      '<div class="body"><div class="name">' + esc(d.name) + '</div>' +
        '<div class="meta"><span>' + esc(d.category) + '</span><span>追加 ' + fmtDate(d.createdAt) + '</span></div>' +
        '<div class="meta"><span class="countdown ' + cd + '">' + remainingText(d.remainingMs) + '</span>' + statusBadge(d) + '</div>' +
      '</div>' +
      '<div class="right"><div class="price">¥' + yen(d.price) + '</div></div>' +
    '</button>';
  }

  function emptyFeature() {
    return '<div class="card center" style="padding:26px 16px">' + mascot(56, 'smile') +
      '<p class="muted" style="margin-top:8px;font-size:13.5px;line-height:1.6">保留中のものはまだないよ。<br>欲しくなったら「＋」から登録してね。</p></div>';
  }

  function itemCard(d) {
    var cd = d.isReady ? 'ready' : (d.status === 'holding' ? 'holding' : '');
    var right = (d.status === 'holding' || d.status === 'ready')
      ? '<div class="countdown ' + cd + '" style="font-size:12px">' + remainingText(d.remainingMs) + '</div>'
      : statusBadge(d);
    return '<button class="item" data-go="detail" data-id="' + d.id + '">' +
      '<div class="thumb">' + categoryIcon(d.category) + '</div>' +
      '<div class="body"><div class="name">' + esc(d.name) + '</div>' +
        '<div class="meta"><span>' + esc(d.category) + '</span><span>' + fmtDate(d.createdAt) + '追加</span></div></div>' +
      '<div class="right"><div class="price">¥' + yen(d.price) + '</div>' + right + '</div>' +
    '</button>';
  }

  // =========================================================================
  // 画面: 保留中リスト
  // =========================================================================
  var FILTERS = [
    { key: 'all', label: 'すべて' },
    { key: '24h', label: '24時間' },
    { key: '3d', label: '3日' },
    { key: '7d', label: '7日' },
    { key: 'ready', label: '判断待ち' }
  ];

  function viewList() {
    var now = Date.now();
    var all = Store.all(now).filter(function (i) { return i.status === 'holding' || i.status === 'ready'; });

    var filtered = all.filter(function (i) {
      if (listFilter === 'all') return true;
      if (listFilter === 'ready') return i.status === 'ready';
      return i.coolingPeriod === listFilter;
    });
    // 判断待ち→残り時間順
    filtered.sort(function (a, b) {
      if (a.isReady !== b.isReady) return a.isReady ? -1 : 1;
      return a.remainingMs - b.remainingMs;
    });

    var wrap = el('<div class="fade-in"></div>');
    wrap.innerHTML =
      '<header class="appbar"><div><div class="title">保留中</div>' +
        '<div class="sub">' + all.length + '件を寝かせています</div></div>' +
        '<div class="logo-dot">🛏️</div></header>' +
      '<div class="filters">' + FILTERS.map(function (f) {
        return '<button class="chip ' + (listFilter === f.key ? 'active' : '') + '" data-filter="' + f.key + '">' + f.label + '</button>';
      }).join('') + '</div>';

    if (!filtered.length) {
      wrap.innerHTML += '<div class="empty">' + mascot(64, 'smile') +
        '<p style="margin-top:10px">ここには何もないみたい。<br>' +
        (listFilter === 'all' ? '「＋」から欲しいものを保留できるよ。' : 'フィルターを変えてみてね。') + '</p></div>';
      return wrap;
    }

    var listWrap = el('<div></div>');
    filtered.forEach(function (d) { listWrap.appendChild(listRow(d)); });
    wrap.appendChild(listWrap);
    return wrap;
  }

  function listRow(d) {
    var cd = d.isReady ? 'ready' : 'holding';
    return el('<button class="item" data-go="detail" data-id="' + d.id + '">' +
      '<div class="thumb">' + categoryIcon(d.category) + '</div>' +
      '<div class="body"><div class="name">' + esc(d.name) + '</div>' +
        '<div class="meta"><span>' + esc(d.category) + '</span><span>' + Store.periodLabel(d.coolingPeriod) + 'コース</span></div>' +
        '<div class="meta"><span>追加 ' + fmtDate(d.createdAt) + '</span><span>判断日 ' + fmtDate(d.reviewAt) + '</span></div>' +
      '</div>' +
      '<div class="right"><div class="price">¥' + yen(d.price) + '</div>' +
        '<div style="margin-top:6px">' + (d.isReady ? '<span class="badge ready">判断待ち</span>' : '<span class="countdown ' + cd + '" style="font-size:12px">' + remainingText(d.remainingMs) + '</span>') + '</div>' +
      '</div></button>');
  }

  // =========================================================================
  // 画面: 追加
  // =========================================================================
  function viewAdd() {
    var wrap = el('<div class="fade-in"></div>');
    wrap.innerHTML =
      '<header class="appbar"><div><div class="title">いったん保留する</div>' +
        '<div class="sub">欲しい気持ちを、ここに置いておこう。</div></div>' +
        '<div class="logo-dot">✍️</div></header>' +

      '<div class="field"><label for="f-name">アイテム名</label>' +
        '<input id="f-name" class="input" type="text" placeholder="例：ワイヤレスイヤホン" value="' + esc(draft.name) + '" maxlength="60"></div>' +

      '<div class="field"><label for="f-price">価格</label>' +
        '<div class="price-input"><input id="f-price" class="input" type="number" inputmode="numeric" placeholder="0" value="' + esc(draft.price) + '" min="0"></div></div>' +

      '<div class="field"><label>カテゴリー</label><div class="seg" id="seg-cat">' +
        Store.CATEGORIES.map(function (c) {
          return '<button type="button" data-cat="' + c + '" class="' + (draft.category === c ? 'active' : '') + '"><span class="ico">' + categoryIcon(c) + '</span>' + c + '</button>';
        }).join('') + '</div></div>' +

      '<div class="field"><label>なぜ欲しい？</label><div class="seg" id="seg-reason">' +
        Store.REASONS.map(function (r) {
          var ico = r === '必要' ? '✅' : r === '欲しい' ? '💛' : '⚡';
          return '<button type="button" data-reason="' + r + '" class="' + (draft.reason === r ? 'active' : '') + '"><span class="ico">' + ico + '</span>' + r + '</button>';
        }).join('') + '</div></div>' +

      '<div class="field"><label>クールダウン期間</label><div class="seg green" id="seg-period">' +
        Store.PERIODS.map(function (p) {
          return '<button type="button" data-period="' + p.key + '" class="' + (draft.coolingPeriod === p.key ? 'active' : '') + '">' + p.label + '</button>';
        }).join('') + '</div></div>' +

      '<div class="field"><label for="f-memo">メモ（任意）</label>' +
        '<textarea id="f-memo" class="textarea" placeholder="どこで見つけた？なぜ気になった？">' + esc(draft.memo) + '</textarea></div>' +

      '<button class="btn btn-primary" id="submit-add">🫧 保留する</button>' +
      '<p class="center faint" style="margin-top:12px;font-size:12px">登録すると、選んだ期間だけ寝かせます。</p>';

    // 入力の保持
    wrap.querySelector('#f-name').addEventListener('input', function (e) { draft.name = e.target.value; });
    wrap.querySelector('#f-price').addEventListener('input', function (e) { draft.price = e.target.value; });
    wrap.querySelector('#f-memo').addEventListener('input', function (e) { draft.memo = e.target.value; });
    segHandler(wrap.querySelector('#seg-cat'), 'cat', function (v) { draft.category = v; });
    segHandler(wrap.querySelector('#seg-reason'), 'reason', function (v) { draft.reason = v; });
    segHandler(wrap.querySelector('#seg-period'), 'period', function (v) { draft.coolingPeriod = v; });

    wrap.querySelector('#submit-add').addEventListener('click', function () {
      var name = (draft.name || '').trim();
      var price = Number(draft.price);
      if (!name) { toast('アイテム名を入れてね'); wrap.querySelector('#f-name').focus(); return; }
      if (!(price > 0)) { toast('価格を入れてね'); wrap.querySelector('#f-price').focus(); return; }
      Store.addItem(draft);
      draft = { name: '', price: '', category: 'ガジェット', reason: '欲しい', coolingPeriod: '3d', memo: '' };
      toast('保留しました。' + (price ? 'ひとまず¥' + yen(price) + 'は寝かせ中。' : ''));
      navigate('list');
    });

    return wrap;
  }

  function segHandler(container, attr, set) {
    if (!container) return;
    container.addEventListener('click', function (e) {
      var btn = e.target.closest('button[data-' + attr + ']');
      if (!btn) return;
      container.querySelectorAll('button').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      set(btn.getAttribute('data-' + attr));
    });
  }

  // =========================================================================
  // 画面: ふりかえり・判断（アイテム詳細）
  // =========================================================================
  var REVIEW_QS = [
    ['💭', 'まだ欲しい？今の気持ちはどうだろう。'],
    ['🔁', '何回くらい使いそう？'],
    ['👀', '似たものを、もう持っていない？'],
    ['💰', '今月の予算的に、無理はない？'],
    ['⚖️', 'これは「必要」？「欲しい」？それとも「勢い」？']
  ];

  function viewDetail(params) {
    var d = Store.find(params.id);
    var wrap = el('<div class="fade-in"></div>');
    if (!d) {
      wrap.innerHTML = '<div class="empty">' + mascot(64) + '<p style="margin-top:10px">このアイテムは見つからなかったよ。</p></div>' +
        '<button class="btn btn-ghost" data-go="list">保留中にもどる</button>';
      return wrap;
    }

    var decided = d.status === 'purchased' || d.status === 'skipped';
    var buddyFace, buddyMsg;
    if (d.status === 'skipped') { buddyFace = 'cheer'; buddyMsg = '今回は見送れたね。未来の自分が少し助かるかも。'; }
    else if (d.status === 'purchased') { buddyFace = 'smile'; buddyMsg = 'ちゃんと考えて選べたね。大切に使ってあげて。'; }
    else if (d.isReady) { buddyFace = 'cheer'; buddyMsg = Store.periodLabel(d.coolingPeriod) + '待てたの、えらい。いま、どう感じる？'; }
    else { buddyFace = 'think'; buddyMsg = 'まだ少し寝かせてみよう。判断は ' + fmtDate(d.reviewAt) + ' から。'; }

    wrap.innerHTML =
      '<div class="detail-top"><button class="back" data-back="1">‹ もどる</button></div>' +
      '<div class="detail-hero">' +
        '<div class="thumb-lg">' + categoryIcon(d.category) + '</div>' +
        '<div class="name">' + esc(d.name) + '</div>' +
        '<div class="price">¥' + yen(d.price) + '</div>' +
        '<div class="sub">' + statusBadge(d) + '　' + esc(d.category) + '・' + esc(d.reason) + '</div>' +
      '</div>' +
      '<div style="margin:16px 0">' + buddyBubble(buddyMsg, buddyFace) + '</div>' +
      '<div class="card">' +
        kv('追加日', fmtDateTime(d.createdAt)) +
        kv('クールダウン', Store.periodLabel(d.coolingPeriod)) +
        kv('判断予定日', fmtDateTime(d.reviewAt)) +
        kv(decided ? '状態' : '残り', decided ? STATUS_LABEL[d.status] + (d.raw.decidedAt ? '（' + fmtDate(d.raw.decidedAt) + '）' : '') : remainingText(d.remainingMs)) +
        (d.memo ? kv('メモ', esc(d.memo)) : '') +
      '</div>';

    if (!decided) {
      wrap.innerHTML +=
        '<h2 class="section">買う前に、ひと呼吸</h2>' +
        '<div class="card"><ul class="qlist">' +
          REVIEW_QS.map(function (q) { return '<li><span class="q-ico">' + q[0] + '</span><span>' + q[1] + '</span></li>'; }).join('') +
        '</ul></div>' +
        '<div class="btn-row" style="margin-top:18px">' +
          '<button class="btn btn-buy" data-decide="buy">買う</button>' +
          '<button class="btn btn-skip" data-decide="skip">見送る</button>' +
        '</div>' +
        (d.isReady ? '' : '<p class="center faint" style="margin-top:12px;font-size:12px">まだクールダウン中。もちろん今決めてもOK。</p>');
    } else {
      wrap.innerHTML +=
        '<button class="btn btn-ghost" style="margin-top:18px" data-back="1">一覧にもどる</button>' +
        '<div class="center"><button class="tiny-link" data-remove="' + d.id + '">この記録を削除する</button></div>';
    }

    // ハンドラ
    wrap.querySelectorAll('[data-decide]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var decision = btn.getAttribute('data-decide');
        Store.decide(d.id, decision);
        if (decision === 'skip') {
          celebrate();
          toast('見送れたね。¥' + yen(d.price) + ' を守れたよ。');
        } else {
          toast('買うを記録したよ。大切に。');
        }
        setTimeout(function () { navigate('home'); }, 350);
      });
    });
    var rm = wrap.querySelector('[data-remove]');
    if (rm) rm.addEventListener('click', function () {
      if (confirm('この記録を削除しますか？')) { Store.removeItem(d.id); toast('削除しました'); navigate('list'); }
    });

    return wrap;
  }

  function kv(k, v) { return '<div class="kv"><span class="k">' + k + '</span><span class="v">' + v + '</span></div>'; }

  // =========================================================================
  // 画面: 今月のふりかえり（月次集計）
  // =========================================================================
  function viewMonthly() {
    var ref = new Date();
    ref = new Date(ref.getFullYear(), ref.getMonth() + monthOffset, 1);
    var sum = Store.monthlySummary(ref);
    var label = ref.getFullYear() + '年' + (ref.getMonth() + 1) + '月';

    // カテゴリー別（0は除外し、降順）
    var cats = Store.CATEGORIES.map(function (c) { return { c: c, v: sum.byCategory[c] || 0 }; })
      .filter(function (x) { return x.v > 0; })
      .sort(function (a, b) { return b.v - a.v; });
    var maxCat = cats.reduce(function (m, x) { return Math.max(m, x.v); }, 0);

    var diffText;
    if (monthOffset !== 0) diffText = '';
    else if (sum.diff > 0) diffText = '先月より ¥' + yen(sum.diff) + ' 多く見送れた👏';
    else if (sum.diff < 0) diffText = '先月より ¥' + yen(-sum.diff) + ' 少なめ。マイペースでいこう。';
    else diffText = '先月と同じペース。';

    var buddyMsg = sum.savedThisMonth > 0
      ? 'この月は ¥' + yen(sum.savedThisMonth) + ' 見送れたね。積み重ね、すごい。'
      : 'まだこの月の見送りはなし。焦らず、寝かせていこう。';

    var wrap = el('<div class="fade-in"></div>');
    wrap.innerHTML =
      '<header class="appbar"><div><div class="title">ふりかえり</div>' +
        '<div class="sub">見送りの積み重ねを見てみよう。</div></div>' +
        '<div class="logo-dot">📊</div></header>' +

      '<div class="month-nav">' +
        '<button data-month="-1">‹</button>' +
        '<div class="label">' + label + '</div>' +
        '<button data-month="1" ' + (monthOffset >= 0 ? 'disabled' : '') + '>›</button>' +
      '</div>' +

      '<div class="card saved-hero" style="text-align:center;background:linear-gradient(135deg,var(--green-soft),#D6EEDE);border:none;margin-top:6px">' +
        '<div class="muted" style="font-size:13px;font-weight:700">この月、見送れた金額</div>' +
        '<div style="font-size:40px;font-weight:900;margin:6px 0 2px">¥' + yen(sum.savedThisMonth) + '</div>' +
        (diffText ? '<div class="muted" style="font-size:12.5px">' + diffText + '</div>' : '') +
      '</div>' +

      '<div class="kpi-grid" style="margin-top:14px">' +
        '<div class="kpi"><div class="v" style="color:var(--green)">' + sum.skippedCount + '</div><div class="k">見送り</div></div>' +
        '<div class="kpi"><div class="v">' + sum.purchasedCount + '</div><div class="k">買った</div></div>' +
        '<div class="kpi"><div class="v" style="color:var(--orange-deep)">' + sum.holdingCount + '</div><div class="k">保留中</div></div>' +
      '</div>' +

      '<div style="margin-top:16px">' + buddyBubble(buddyMsg, sum.savedThisMonth > 0 ? 'cheer' : 'smile') + '</div>' +

      '<h2 class="section">カテゴリー別の見送り<span class="hint">どこを我慢できた？</span></h2>' +
      (cats.length
        ? '<div class="card"><div class="bars">' + cats.map(function (x) {
            return '<div class="bar-row"><span class="lbl">' + categoryIcon(x.c) + ' ' + esc(x.c) + '</span>' +
              '<div class="bar-track"><div class="bar-fill" style="width:' + Math.max(4, Math.round(x.v / maxCat * 100)) + '%"></div></div>' +
              '<span class="amt">¥' + yen(x.v) + '</span></div>';
          }).join('') + '</div></div>'
        : '<div class="card center muted" style="padding:24px;font-size:13.5px">この月の見送りはまだないよ。</div>') +

      '<h2 class="section">データ<span class="hint">サンプルの片付け・初期化</span></h2>' +
      '<div class="card">' +
        '<div class="btn-row">' +
          '<button class="btn btn-ghost" id="data-clear">🧹 全部消して空にする</button>' +
          '<button class="btn btn-ghost" id="data-reset">↩️ サンプルに戻す</button>' +
        '</div>' +
        '<p class="center faint" style="margin-top:10px;font-size:12px">この端末のデータだけが変わります。元には戻せません。</p>' +
      '</div>';

    wrap.querySelectorAll('[data-month]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (b.disabled) return;
        monthOffset += Number(b.getAttribute('data-month'));
        if (monthOffset > 0) monthOffset = 0;
        render();
      });
    });
    wrap.querySelector('#data-clear').addEventListener('click', function () {
      if (confirm('保留中・履歴をすべて削除して空にします。よろしいですか？')) {
        Store.clearAll();
        toast('まっさらにしたよ。「＋」から始めよう。');
        navigate('home');
      }
    });
    wrap.querySelector('#data-reset').addEventListener('click', function () {
      if (confirm('いまのデータを消して、サンプルデータに戻します。よろしいですか？')) {
        Store.resetAll();
        toast('サンプルに戻したよ。');
        render();
      }
    });
    return wrap;
  }

  // =========================================================================
  // 下部ナビ
  // =========================================================================
  var TABS = [
    { name: 'home', label: 'ホーム', ic: '🏠' },
    { name: 'list', label: '保留中', ic: '🫧' },
    { name: 'add', label: '追加', ic: '＋', add: true },
    { name: 'monthly', label: 'ふりかえり', ic: '📊' }
  ];

  function renderTabs() {
    var active = route.name === 'detail' ? 'list' : route.name;
    tabbarEl.innerHTML = TABS.map(function (t) {
      return '<button class="tab' + (t.add ? ' add' : '') + (active === t.name ? ' active' : '') + '" data-tab="' + t.name + '">' +
        '<span class="ic">' + t.ic + '</span><span>' + t.label + '</span></button>';
    }).join('');
  }

  // =========================================================================
  // ルーティング / 描画
  // =========================================================================
  function navigate(name, params) {
    route = { name: name, params: params || {} };
    render();
    screenEl.scrollTop = 0;
  }

  function render() {
    var view;
    switch (route.name) {
      case 'list': view = viewList(); break;
      case 'add': view = viewAdd(); break;
      case 'detail': view = viewDetail(route.params); break;
      case 'monthly': view = viewMonthly(); break;
      default: view = viewHome();
    }
    screenEl.innerHTML = '';
    screenEl.appendChild(view);
    renderTabs();
  }

  // 画面内のクリック委譲（data-go / data-back / data-filter）
  screenEl.addEventListener('click', function (e) {
    var go = e.target.closest('[data-go]');
    if (go) {
      var name = go.getAttribute('data-go');
      navigate(name, { id: go.getAttribute('data-id') });
      return;
    }
    if (e.target.closest('[data-back]')) { navigate('list'); return; }
    var fil = e.target.closest('[data-filter]');
    if (fil) { listFilter = fil.getAttribute('data-filter'); render(); return; }
  });

  // タブ
  tabbarEl.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tab]');
    if (!t) return;
    var name = t.getAttribute('data-tab');
    if (name === 'monthly') monthOffset = 0;
    navigate(name);
  });

  // データ変更で再描画（他タブ等での更新にも追従）
  Store.subscribe(function () {
    // 詳細画面で対象が判断済みになった場合などはそのまま再描画
    render();
  });

  // =========================================================================
  // トースト & 紙吹雪
  // =========================================================================
  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2600);
  }

  function celebrate() {
    var colors = ['#FF9A52', '#F2792B', '#7FC9A0', '#FFD479', '#FF7E7E'];
    var frag = document.createDocumentFragment();
    for (var i = 0; i < 60; i++) {
      var p = document.createElement('i');
      p.style.left = Math.random() * 100 + '%';
      p.style.background = colors[i % colors.length];
      p.style.setProperty('--d', (1.1 + Math.random() * 1.3) + 's');
      p.style.animationDelay = (Math.random() * 0.25) + 's';
      p.style.transform = 'rotate(' + (Math.random() * 360) + 'deg)';
      frag.appendChild(p);
    }
    confettiEl.innerHTML = '';
    confettiEl.appendChild(frag);
    setTimeout(function () { confettiEl.innerHTML = ''; }, 2600);
  }

  // =========================================================================
  // 起動
  // =========================================================================
  Store.init();
  render();

  // PWA: Service Worker（任意・存在すれば登録）
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})(window);
