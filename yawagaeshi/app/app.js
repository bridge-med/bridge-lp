/* =========================================================================
 * やわ返 — app.js
 * 画面描画 / ルーティング / 下部ナビ / 相棒キャラ「やわちゃん」。
 * データ操作は window.Store、返信生成は window.ReplyService 経由（責務分離）。
 * ========================================================================= */
(function (global) {
  'use strict';

  var Store = global.Store;
  var Service = global.ReplyService;
  var screenEl = document.getElementById('screen');
  var tabbarEl = document.getElementById('tabbar');
  var toastEl = document.getElementById('toast');

  // ---- ルーター/一時状態 ---------------------------------------------------
  var route = { name: 'home', params: {} };
  // 入力〜トーン選択の下書き（ReplyRequest 相当）
  var draft = newDraft();
  var currentId = null;        // 返信案/チェック画面で見ている履歴ID
  var historyQuery = '';       // 履歴検索
  var historyFilter = 'all';   // 'all' | 'fav'
  var generating = false;      // 生成中フラグ

  function newDraft() {
    return { originalMessage: '', userIntent: '', relationship: '', channel: 'メール', tones: [], length: '普通' };
  }

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
  function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }

  function fmtDateTime(iso) {
    var d = new Date(iso);
    var now = new Date();
    var sameDay = d.toDateString() === now.toDateString();
    var hm = d.getHours() + ':' + ('0' + d.getMinutes()).slice(-2);
    if (sameDay) return '今日 ' + hm;
    return (d.getMonth() + 1) + '月' + d.getDate() + '日 ' + hm;
  }

  function relIcon(r) { return Store.REL_ICONS[r] || '✉️'; }
  function chIcon(c) { return Store.CHANNEL_ICONS[c] || '🗨️'; }
  function toneIcon(t) { return Store.TONE_ICONS[t] || '🌿'; }

  /** 相棒キャラ「やわちゃん」：ふわっとした雲/クッション。face で表情変化 */
  function mascot(size, face, sway) {
    size = size || 56;
    face = face || 'smile';
    var eyes;
    if (face === 'wink') {
      eyes = '<circle class="eye" cx="40" cy="52" r="4.6"/><path class="eye-line" d="M55 53 q5 -5 10 0"/>';
    } else if (face === 'think') {
      eyes = '<circle class="eye" cx="40" cy="53" r="4"/><circle class="eye" cx="60" cy="53" r="4"/>';
    } else if (face === 'cheer') {
      eyes = '<path class="eye-line" d="M34 55 q6 -8 12 0"/><path class="eye-line" d="M54 55 q6 -8 12 0"/>';
    } else if (face === 'worry') {
      eyes = '<circle class="eye" cx="40" cy="54" r="4.4"/><circle class="eye" cx="60" cy="54" r="4.4"/><path class="eye-line" d="M33 44 q6 3 12 1"/><path class="eye-line" d="M55 45 q6 -2 12 1"/>';
    } else {
      eyes = '<circle class="eye" cx="40" cy="52" r="4.6"/><circle class="eye" cx="60" cy="52" r="4.6"/>';
    }
    var mouth = face === 'cheer'
      ? '<path class="eye-line" d="M43 64 q7 8 14 0"/>'
      : (face === 'worry'
        ? '<path class="eye-line" d="M44 68 q6 -4 12 0"/>'
        : '<path class="eye-line" d="M44 65 q6 5 12 0"/>');
    // ふわふわの雲/クッション型ボディ
    return '' +
      '<svg class="mascot' + (sway ? ' sway' : '') + '" width="' + size + '" height="' + size + '" viewBox="0 0 100 100" aria-hidden="true">' +
        '<path class="body" d="M27 74 Q12 74 12 60 Q12 49 23 47 Q23 31 40 31 Q49 21 62 27 Q78 27 80 43 Q92 46 90 60 Q90 74 75 74 Z"/>' +
        '<ellipse class="belly" cx="51" cy="62" rx="26" ry="17"/>' +
        '<circle class="cheek" cx="31" cy="60" r="6"/>' +
        '<circle class="cheek" cx="71" cy="60" r="6"/>' +
        eyes + mouth +
      '</svg>';
  }

  function buddyBubble(text, face) {
    return '<div class="buddy"><div class="avatar">' + mascot(54, face || 'smile', true) +
      '</div><div class="speech">' + esc(text) + '</div></div>';
  }

  // クリップボードにコピー（Clipboard API ＋ フォールバック）
  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function () { return true; }).catch(fallbackCopy);
    }
    return Promise.resolve(fallbackCopy());
    function fallbackCopy() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        var ok = document.execCommand('copy');
        document.body.removeChild(ta);
        return ok;
      } catch (e) { return false; }
    }
  }

  // 共有シート（Web Share API があれば起動、なければコピーで代替）
  function shareText(text) {
    if (navigator.share) {
      navigator.share({ text: text }).catch(function () {});
    } else {
      copyText(text).then(function (ok) {
        toast(ok ? 'コピーしました。貼り付けて送ってね。' : 'コピーできませんでした');
      });
    }
  }

  // =========================================================================
  // 画面: ホーム
  // =========================================================================
  var HOME_TIPS = [
    '少し整えるだけで、伝わり方は変わるよ。',
    '送る前に、ひと呼吸。落ち着いていこう。',
    '相手を責めずに、必要なことは伝えましょう。',
    '迷ったら、まず貼ってみよう。いっしょに整えよう。'
  ];

  var QUICK = [
    { key: 'soft', emoji: '☁️', title: 'やわらかく返す', sub: '角を立てずに', tones: ['やわらかく', '丁寧に'] },
    { key: 'decline', emoji: '🙏', title: '断り文をつくる', sub: '丁寧にお断り', tones: ['断る', '丁寧に'] },
    { key: 'remind', emoji: '⏰', title: '催促文をつくる', sub: 'やさしく確認', tones: ['催促', 'やわらかく'] },
    { key: 'apology', emoji: '🍵', title: '謝罪文を整える', sub: '誠実にお詫び', tones: ['謝る', '丁寧に'] }
  ];

  function viewHome() {
    var hist = Store.history();
    var recent = hist.slice(0, 3);
    var tip = HOME_TIPS[new Date().getDate() % HOME_TIPS.length];

    var wrap = el('<div class="fade-in"></div>');
    wrap.innerHTML =
      '<header class="appbar">' +
        '<div><div class="title">やわ返</div><div class="sub">送る前に、ひと呼吸。</div></div>' +
        '<div class="logo-dot">' + mascot(30, 'smile') + '</div>' +
      '</header>' +
      '<div class="buddy-wrap">' + buddyBubble(tip, 'smile') + '</div>' +

      '<h2 class="section">なにを返す？<span class="hint">タップではじめる</span></h2>' +
      '<div class="quick-grid">' +
        QUICK.map(function (q) {
          return '<button class="quick" data-quick="' + q.key + '">' +
            '<span class="q-emoji">' + q.emoji + '</span>' +
            '<span class="q-title">' + q.title + '</span>' +
            '<span class="q-sub">' + q.sub + '</span>' +
          '</button>';
        }).join('') +
      '</div>' +

      '<h2 class="section">最近の下書き' + (recent.length ? '<span class="hint" data-tab-jump="history">すべて見る</span>' : '') + '</h2>' +
      (recent.length
        ? recent.map(historyRow).join('')
        : '<div class="card center muted soft-empty">' + mascot(52, 'smile') +
          '<p>まだ下書きはないよ。<br>上のボタンから始めてみよう。</p></div>');

    wrap.querySelectorAll('[data-quick]').forEach(function (b) {
      b.addEventListener('click', function () {
        var q = QUICK.filter(function (x) { return x.key === b.getAttribute('data-quick'); })[0];
        draft = newDraft();
        draft.tones = q.tones.slice();
        navigate('input');
      });
    });
    return wrap;
  }

  // 履歴の1行（ホーム・履歴で共用）
  function historyRow(h) {
    var title = Store.deriveTitle(h);
    var fav = (h.suggestions || []).some(function (s) { return s.isFavorite; });
    return '<button class="hist" data-open="' + h.id + '">' +
      '<div class="hist-ico">' + chIcon(h.channel) + '</div>' +
      '<div class="hist-body">' +
        '<div class="hist-title">' + esc(title) + (fav ? ' <span class="star-mini">★</span>' : '') + '</div>' +
        '<div class="hist-ex">' + esc(Store.excerptOf(h) || '（本文なし）') + '</div>' +
        '<div class="hist-meta">' +
          '<span>' + chIcon(h.channel) + ' ' + esc(h.channel) + '</span>' +
          (h.relationship ? '<span>' + relIcon(h.relationship) + ' ' + esc(h.relationship) + '</span>' : '') +
          '<span>' + fmtDateTime(h.createdAt) + '</span>' +
        '</div>' +
        ((h.tones || []).length ? '<div class="hist-tones">' + h.tones.map(function (t) { return '<i class="tone-chip">' + toneIcon(t) + esc(t) + '</i>'; }).join('') + '</div>' : '') +
      '</div>' +
    '</button>';
  }

  // =========================================================================
  // 画面: 入力
  // =========================================================================
  function viewInput() {
    var wrap = el('<div class="fade-in"></div>');
    wrap.innerHTML =
      '<header class="appbar"><div><div class="title">返信を入力</div>' +
        '<div class="sub">困っている文を、ここに貼ってね。</div></div>' +
        '<div class="logo-dot">' + mascot(30, 'think') + '</div></header>' +

      '<div class="field"><label for="f-orig">相手から来た文 <span class="opt">任意</span>' +
        '<button type="button" class="paste-btn" id="paste-orig">📋 貼り付け</button></label>' +
        '<textarea id="f-orig" class="textarea" placeholder="例：まだですか？">' + esc(draft.originalMessage) + '</textarea></div>' +

      '<div class="field"><label for="f-intent">返したい内容 <span class="req">必須</span></label>' +
        '<textarea id="f-intent" class="textarea tall" placeholder="例：本日中は難しく、明日午前なら対応できると伝えたい">' + esc(draft.userIntent) + '</textarea></div>' +

      '<div class="field"><label>相手との関係</label><div class="seg wrap" id="seg-rel">' +
        Store.RELATIONSHIPS.map(function (r) {
          return '<button type="button" data-rel="' + r + '" class="' + (draft.relationship === r ? 'active' : '') + '"><span class="ico">' + relIcon(r) + '</span>' + r + '</button>';
        }).join('') + '</div></div>' +

      '<div class="field"><label>利用するチャネル</label><div class="seg wrap blue" id="seg-ch">' +
        Store.CHANNELS.map(function (c) {
          return '<button type="button" data-ch="' + c + '" class="' + (draft.channel === c ? 'active' : '') + '"><span class="ico">' + chIcon(c) + '</span>' + c + '</button>';
        }).join('') + '</div></div>' +

      '<button class="btn btn-primary" id="to-tone">トーンを選ぶ</button>' +
      privacyNote();

    wrap.querySelector('#f-orig').addEventListener('input', function (e) { draft.originalMessage = e.target.value; });
    wrap.querySelector('#f-intent').addEventListener('input', function (e) { draft.userIntent = e.target.value; });
    segHandler(wrap.querySelector('#seg-rel'), 'rel', function (v) { draft.relationship = v; });
    segHandler(wrap.querySelector('#seg-ch'), 'ch', function (v) { draft.channel = v; });

    wrap.querySelector('#paste-orig').addEventListener('click', function () {
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(function (t) {
          if (t) { draft.originalMessage = t; wrap.querySelector('#f-orig').value = t; toast('貼り付けました'); }
          else toast('クリップボードは空でした');
        }).catch(function () { toast('貼り付けできませんでした。手動で入力してね'); });
      } else { toast('この環境では自動貼り付けに未対応です'); }
    });

    wrap.querySelector('#to-tone').addEventListener('click', function () {
      draft.userIntent = (draft.userIntent || '').trim();
      if (!draft.userIntent) { toast('「返したい内容」を入れてね'); wrap.querySelector('#f-intent').focus(); return; }
      navigate('tone');
    });

    return wrap;
  }

  function privacyNote() {
    return '<div class="privacy"><span class="pico">🔒</span><div>' +
      '個人情報や機密情報は入力しないでください。<br>' +
      '生成された文章は、送信前に必ずご自身で確認してください。<br>' +
      '医療・法律・人事・契約など重要な判断は、専門家や責任者にご確認ください。' +
      '</div></div>';
  }

  // =========================================================================
  // 画面: トーン選択
  // =========================================================================
  function viewTone() {
    var wrap = el('<div class="fade-in"></div>');
    wrap.innerHTML =
      '<div class="detail-top"><button class="back" data-back="input">‹ 入力にもどる</button></div>' +
      '<header class="appbar"><div><div class="title">トーンを選ぶ</div>' +
        '<div class="sub">どんなニュアンスで届けたい？</div></div>' +
        '<div class="logo-dot">' + mascot(30, 'wink') + '</div></header>' +

      '<h2 class="section">トーン<span class="hint">複数えらべます</span></h2>' +
      '<div class="tone-grid" id="tone-grid">' +
        Store.TONES.map(function (t) {
          return '<button type="button" class="tone' + (draft.tones.indexOf(t) >= 0 ? ' on' : '') + '" data-tone="' + t + '">' +
            '<span class="t-ico">' + toneIcon(t) + '</span>' + t + '</button>';
        }).join('') +
      '</div>' +

      '<h2 class="section">文章の長さ</h2>' +
      '<div class="seg green" id="seg-len">' +
        Store.LENGTHS.map(function (l) {
          return '<button type="button" data-len="' + l + '" class="' + (draft.length === l ? 'active' : '') + '">' + l + '</button>';
        }).join('') + '</div>' +

      '<div class="preview" id="preview"></div>' +
      '<button class="btn btn-primary" id="gen">✍️ 返信案を作成</button>';

    var grid = wrap.querySelector('#tone-grid');
    grid.addEventListener('click', function (e) {
      var b = e.target.closest('[data-tone]');
      if (!b) return;
      var t = b.getAttribute('data-tone');
      var i = draft.tones.indexOf(t);
      if (i >= 0) { draft.tones.splice(i, 1); b.classList.remove('on'); }
      else { draft.tones.push(t); b.classList.add('on'); }
      renderPreview(wrap);
    });
    segHandler(wrap.querySelector('#seg-len'), 'len', function (v) { draft.length = v; renderPreview(wrap); });

    wrap.querySelector('#gen').addEventListener('click', function () { runGenerate(); });

    renderPreview(wrap);
    return wrap;
  }

  function renderPreview(wrap) {
    var p = wrap.querySelector('#preview');
    if (!p) return;
    var bits = [];
    if (draft.relationship) bits.push(relIcon(draft.relationship) + ' ' + draft.relationship);
    bits.push(chIcon(draft.channel) + ' ' + draft.channel);
    bits.push(draft.length);
    var tones = draft.tones.length ? draft.tones.map(function (t) { return toneIcon(t) + t; }).join(' ・ ') : '（トーン未選択）';
    p.innerHTML = '<div class="pv-label">いまの設定</div>' +
      '<div class="pv-line">' + esc(bits.join(' / ')) + '</div>' +
      '<div class="pv-tones">' + esc(tones) + '</div>';
  }

  // 生成を実行 → 履歴に保存 → 返信案画面へ
  function runGenerate() {
    if (generating) return;
    generating = true;
    route = { name: 'result', params: {} };
    currentId = null;
    render(); // ローディング表示

    var req = cloneDraft();
    Service.generateReplies(req).then(function (result) {
      currentId = Store.addGeneration(req, result);
      generating = false;
      render();
      screenEl.scrollTop = 0;
    }).catch(function () {
      generating = false;
      toast('生成に失敗しました。もう一度お試しください');
      navigate('tone');
    });
  }

  function cloneDraft() {
    return {
      originalMessage: draft.originalMessage, userIntent: draft.userIntent,
      relationship: draft.relationship, channel: draft.channel,
      tones: draft.tones.slice(), length: draft.length
    };
  }

  // =========================================================================
  // 画面: 返信案
  // =========================================================================
  function viewResult() {
    if (generating || !currentId) return viewGenerating();
    var h = Store.getHistory(currentId);
    if (!h) { navigate('home'); return el('<div></div>'); }

    var wrap = el('<div class="fade-in"></div>');
    wrap.innerHTML =
      '<div class="detail-top"><button class="back" data-back="tone">‹ もどる</button></div>' +
      '<header class="appbar"><div><div class="title">返信案</div>' +
        '<div class="sub">' + esc(settingLine(h)) + '</div></div>' +
        '<div class="logo-dot">' + mascot(30, 'cheer') + '</div></header>' +
      '<div class="buddy-wrap">' + buddyBubble('伝えたいことはそのままで、やさしく整えよう。', 'cheer') + '</div>' +
      h.suggestions.map(function (s) { return suggestionCard(h, s); }).join('') +
      '<p class="center faint mini-note">気に入った案を選ぶと、送信前チェックに進めます。</p>';

    bindSuggestionCards(wrap, h);
    return wrap;
  }

  function viewGenerating() {
    var wrap = el('<div class="fade-in"></div>');
    wrap.innerHTML =
      '<header class="appbar"><div><div class="title">返信案</div>' +
        '<div class="sub">いま、やさしく整えています…</div></div></header>' +
      '<div class="loading">' + mascot(76, 'think', true) +
        '<div class="dots"><i></i><i></i><i></i></div>' +
        '<p class="muted">ことばを選んでいます。少しだけ待ってね。</p></div>';
    return wrap;
  }

  var LABEL_CLASS = { 'やわらかめ': 'soft', 'ちょうどいい': 'mid', '短め': 'short' };

  function suggestionCard(h, s) {
    return '<div class="sug" data-sid="' + s.id + '">' +
      '<div class="sug-head">' +
        '<span class="sug-label ' + (LABEL_CLASS[s.label] || '') + '">' + esc(s.label) + '</span>' +
        '<button class="fav-btn' + (s.isFavorite ? ' on' : '') + '" data-fav="' + s.id + '" aria-label="お気に入り">' + (s.isFavorite ? '★' : '☆') + '</button>' +
      '</div>' +
      '<div class="sug-text">' + nl2br(s.text) + '</div>' +
      (s.note ? '<div class="sug-note">' + esc(s.note) + '</div>' : '') +
      '<div class="sug-actions">' +
        '<button class="mini" data-copy="' + s.id + '">📋 コピー</button>' +
        '<button class="mini" data-refine="polite" data-sid2="' + s.id + '">＋丁寧に</button>' +
        '<button class="mini" data-refine="short" data-sid2="' + s.id + '">＋短く</button>' +
      '</div>' +
      '<button class="btn btn-pick" data-pick="' + s.id + '">この案で確認する →</button>' +
    '</div>';
  }

  function bindSuggestionCards(wrap, h) {
    wrap.querySelectorAll('[data-copy]').forEach(function (b) {
      b.addEventListener('click', function () {
        var s = sug(h, b.getAttribute('data-copy'));
        copyText(s.text).then(function (ok) { toast(ok ? 'コピーしました' : 'コピーできませんでした'); });
      });
    });
    wrap.querySelectorAll('[data-fav]').forEach(function (b) {
      b.addEventListener('click', function () {
        var now = Store.toggleFavorite(h.id, b.getAttribute('data-fav'));
        toast(now ? 'お気に入りに追加しました ★' : 'お気に入りを外しました');
      });
    });
    wrap.querySelectorAll('[data-refine]').forEach(function (b) {
      b.addEventListener('click', function () {
        var sid = b.getAttribute('data-sid2');
        var s = sug(h, sid);
        var mode = b.getAttribute('data-refine');
        b.disabled = true; b.textContent = '…';
        Service.regenerate(reqFromHistory(h), s.label, mode).then(function (res) {
          Store.updateSuggestion(h.id, sid, { text: res.text, note: res.note });
          toast(mode === 'polite' ? 'もう少し丁寧にしました' : '短く整えました');
        });
      });
    });
    wrap.querySelectorAll('[data-pick]').forEach(function (b) {
      b.addEventListener('click', function () {
        var s = sug(h, b.getAttribute('data-pick'));
        Store.setSelected(h.id, s.text);
        navigate('check');
      });
    });
  }

  function sug(h, id) {
    return (h.suggestions || []).filter(function (s) { return s.id === id; })[0];
  }
  function reqFromHistory(h) {
    return {
      originalMessage: h.originalMessage, userIntent: h.userIntent, relationship: h.relationship,
      channel: h.channel, tones: (h.tones || []).slice(), length: h.length
    };
  }
  function settingLine(h) {
    var bits = [];
    if (h.relationship) bits.push(h.relationship);
    bits.push(h.channel, h.length);
    return bits.join(' / ');
  }

  // =========================================================================
  // 画面: 送信前チェック
  // =========================================================================
  function viewCheck() {
    var h = currentId ? Store.getHistory(currentId) : null;
    if (!h) { navigate('home'); return el('<div></div>'); }
    var text = h.selectedText || (h.suggestions[0] && h.suggestions[0].text) || '';
    var risk = h.riskCheck || Service.assessRisk(reqFromHistory(h));

    var wrap = el('<div class="fade-in"></div>');
    wrap.innerHTML =
      '<div class="detail-top"><button class="back" data-back="result">‹ 返信案にもどる</button></div>' +
      '<header class="appbar"><div><div class="title">送信前チェック</div>' +
        '<div class="sub">送信前に、もう一度だけ確認しましょう。</div></div>' +
        '<div class="logo-dot">' + mascot(30, 'worry') + '</div></header>' +

      '<h2 class="section">この文章の印象</h2>' +
      '<div class="card risk">' +
        riskRow('冷たさ', risk.coldness, 'cold') +
        riskRow('圧', risk.pressure, 'press') +
        riskRow('長さ', risk.length, 'len') +
      '</div>' +
      '<div class="buddy-wrap">' + buddyBubble(risk.comment, riskFace(risk)) + '</div>' +

      '<h2 class="section">整えた最終メッセージ</h2>' +
      '<div class="final card">' + nl2br(text) + '</div>' +

      '<div class="btn-row">' +
        '<button class="btn btn-ghost" id="copy-final">📋 コピー</button>' +
        '<button class="btn btn-primary" id="send-final">送信する</button>' +
      '</div>' +
      '<p class="center faint mini-note">「送信する」は共有シートを開きます（送信先アプリはお使いの環境に依存します）。</p>' +
      privacyNote();

    wrap.querySelector('#copy-final').addEventListener('click', function () {
      copyText(text).then(function (ok) { toast(ok ? 'コピーしました' : 'コピーできませんでした'); });
    });
    wrap.querySelector('#send-final').addEventListener('click', function () { shareText(text); });
    return wrap;
  }

  function riskRow(label, val, kind) {
    var v = Math.max(1, Math.min(3, val || 1));
    var dots = '';
    for (var i = 1; i <= 3; i++) dots += '<i class="seg-dot ' + (i <= v ? 'fill ' + kind : '') + '"></i>';
    var word = ['', '低い', 'ふつう', '高い'][v];
    return '<div class="risk-row"><span class="r-label">' + label + '</span>' +
      '<span class="r-meter">' + dots + '</span>' +
      '<span class="r-word ' + kind + (v >= 3 ? ' warn' : '') + '">' + word + '</span></div>';
  }
  function riskFace(r) {
    if (r.pressure >= 3 || r.coldness >= 3) return 'worry';
    if (r.coldness <= 1 && r.pressure <= 1) return 'smile';
    return 'think';
  }

  // =========================================================================
  // 画面: 履歴
  // =========================================================================
  function viewHistory() {
    var list = historyFilter === 'fav' ? null : Store.searchHistory(historyQuery);
    var favs = Store.favorites();

    var wrap = el('<div class="fade-in"></div>');
    wrap.innerHTML =
      '<header class="appbar"><div><div class="title">履歴</div>' +
        '<div class="sub">過去に整えた返信を見返せます。</div></div>' +
        '<div class="logo-dot">' + mascot(30, 'smile') + '</div></header>' +

      '<div class="search"><span class="s-ico">🔍</span>' +
        '<input id="hist-q" class="s-input" type="search" placeholder="本文・相手・チャネルで検索" value="' + esc(historyQuery) + '"></div>' +

      '<div class="filters">' +
        '<button class="chip ' + (historyFilter === 'all' ? 'active' : '') + '" data-hfil="all">すべて</button>' +
        '<button class="chip ' + (historyFilter === 'fav' ? 'active' : '') + '" data-hfil="fav">★ お気に入り' + (favs.length ? '（' + favs.length + '）' : '') + '</button>' +
      '</div>';

    if (historyFilter === 'fav') {
      var shownFavs = filterFavorites(favs, historyQuery);
      wrap.innerHTML += shownFavs.length
        ? shownFavs.map(favRow).join('')
        : emptyBox(historyQuery ? '見つかりませんでした。' : 'お気に入りはまだありません。', historyQuery ? 'ほかのことばで探してみてね。' : '返信案の ☆ をタップすると、ここに集まります。');
    } else {
      wrap.innerHTML += list.length
        ? list.map(historyRow).join('')
        : emptyBox(historyQuery ? '見つかりませんでした。' : '履歴はまだありません。', historyQuery ? 'ほかのことばで探してみてね。' : '返信案をつくると、ここに残ります。');
    }

    var q = wrap.querySelector('#hist-q');
    if (q) q.addEventListener('input', function (e) {
      historyQuery = e.target.value;
      // 入力中の再描画はフォーカスを保つため、リスト部分のみ更新せず軽く再描画
      rerenderHistoryList(wrap);
    });
    wrap.querySelectorAll('[data-hfil]').forEach(function (b) {
      b.addEventListener('click', function () { historyFilter = b.getAttribute('data-hfil'); render(); });
    });
    return wrap;
  }

  // 検索のたび全再描画するとフォーカスが外れるので、リスト部分だけ差し替える
  function rerenderHistoryList(wrap) {
    // 既存のリスト要素（.hist と .empty）を取り除いて作り直し
    wrap.querySelectorAll('.hist, .empty-box').forEach(function (n) { n.remove(); });
    var html;
    if (historyFilter === 'fav') {
      var favs = filterFavorites(Store.favorites(), historyQuery);
      html = favs.length
        ? favs.map(favRow).join('')
        : emptyBox(historyQuery ? '見つかりませんでした。' : 'お気に入りはまだありません。', historyQuery ? 'ほかのことばで探してみてね。' : '返信案の ☆ をタップすると、ここに集まります。');
    } else {
      var list = Store.searchHistory(historyQuery);
      html = list.length
        ? list.map(historyRow).join('')
        : emptyBox(historyQuery ? '見つかりませんでした。' : '履歴はまだありません。', historyQuery ? 'ほかのことばで探してみてね。' : '返信案をつくると、ここに残ります。');
    }
    var frag = document.createElement('div');
    frag.innerHTML = html;
    while (frag.firstChild) wrap.appendChild(frag.firstChild);
  }

  function filterFavorites(favs, query) {
    var q = (query || '').trim().toLowerCase();
    if (!q) return favs;
    return favs.filter(function (f) {
      var hay = [f.suggestion.label, f.suggestion.text, f.channel, f.relationship, (f.tones || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function favRow(f) {
    var s = f.suggestion;
    return '<button class="hist fav" data-open="' + f.historyId + '">' +
      '<div class="hist-ico star">★</div>' +
      '<div class="hist-body">' +
        '<div class="hist-title">' + esc(s.label) + '<span class="tone-chip mini">' + chIcon(f.channel) + esc(f.channel) + '</span></div>' +
        '<div class="hist-ex two">' + esc((s.text || '').replace(/\s+/g, ' ').slice(0, 60)) + '…</div>' +
        '<div class="hist-meta"><span>' + fmtDateTime(f.createdAt) + '</span></div>' +
      '</div></button>';
  }

  function emptyBox(title, sub) {
    return '<div class="empty empty-box">' + mascot(60, 'smile') +
      '<p style="margin-top:10px"><b>' + esc(title) + '</b><br>' + esc(sub) + '</p></div>';
  }

  // =========================================================================
  // フォーム共通：セグメント選択
  // =========================================================================
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
  // 下部ナビ
  // =========================================================================
  var TABS = [
    { name: 'home', label: 'ホーム', ic: '🏠' },
    { name: 'input', label: '入力', ic: '✍️' },
    { name: 'result', label: '作成', ic: '✨', center: true },
    { name: 'history', label: '履歴', ic: '🕘' }
  ];

  function renderTabs() {
    var map = { tone: 'input', check: 'result' };
    var active = map[route.name] || route.name;
    tabbarEl.innerHTML = TABS.map(function (t) {
      return '<button class="tab' + (t.center ? ' add' : '') + (active === t.name ? ' active' : '') + '" data-tab="' + t.name + '">' +
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
      case 'input': view = viewInput(); break;
      case 'tone': view = viewTone(); break;
      case 'result': view = viewResult(); break;
      case 'check': view = viewCheck(); break;
      case 'history': view = viewHistory(); break;
      default: view = viewHome();
    }
    screenEl.innerHTML = '';
    screenEl.appendChild(view);
    renderTabs();
  }

  // 画面内クリック委譲（data-open / data-back / data-tab-jump）
  screenEl.addEventListener('click', function (e) {
    var open = e.target.closest('[data-open]');
    if (open) {
      currentId = open.getAttribute('data-open');
      navigate('result');
      return;
    }
    var back = e.target.closest('[data-back]');
    if (back) { navigate(back.getAttribute('data-back')); return; }
    var jump = e.target.closest('[data-tab-jump]');
    if (jump) { navigate(jump.getAttribute('data-tab-jump')); return; }
  });

  // タブ
  tabbarEl.addEventListener('click', function (e) {
    var t = e.target.closest('[data-tab]');
    if (!t) return;
    var name = t.getAttribute('data-tab');
    if (name === 'result') {
      // 「作成」：直近の結果があればそれを、なければ入力から
      if (currentId && Store.getHistory(currentId)) { navigate('result'); }
      else if ((draft.userIntent || '').trim()) { navigate('tone'); }
      else { toast('まずは「入力」から始めよう'); navigate('input'); }
      return;
    }
    if (name === 'history') { historyFilter = 'all'; }
    navigate(name);
  });

  // データ変更で再描画（お気に入り/regenerate 等に追従）
  Store.subscribe(function () {
    // 入力画面など、フォーム編集中の不要な再描画は避ける
    if (route.name === 'input' || route.name === 'tone' || route.name === 'history') return;
    render();
  });

  // =========================================================================
  // トースト
  // =========================================================================
  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2400);
  }

  // =========================================================================
  // 起動
  // =========================================================================
  Store.init();
  render();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(function () {});
  }
})(window);
