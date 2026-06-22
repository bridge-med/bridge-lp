/* =========================================================================
 * やわ返 — replyService.js
 * 返信生成の「サービス層」。画面(app.js)はこの層だけを呼ぶ。
 *
 *   generateReplies(request): Promise<ReplyGenerateResult>
 *   regenerate(request, label, mode): Promise<ReplySuggestion>   // もっと丁寧に / もっと短く
 *
 * プロバイダ切り替え式（APIキーはフロントに置かない）：
 *     スマホアプリ → 自前API(Cloudflare Worker) → Gemini API
 *   provider が 'remote' かつ endpoint が設定されていれば自前APIを叩く。
 *   未設定／失敗時は必ずモック生成にフォールバックするので、体験は止まらない。
 *
 * ▼ 連携を有効にする手順
 *   1) yawagaeshi/worker を Cloudflare にデプロイ（worker/README 参照）
 *   2) 下の REPLY_ENDPOINT に Worker の URL を設定し、REPLY_PROVIDER='remote'
 *      （コードを触らずに端末だけで切り替える場合は localStorage:
 *         localStorage['yawagaeshi:endpoint'] = 'https://....workers.dev'
 *         localStorage['yawagaeshi:provider'] = 'remote'   ）
 * ========================================================================= */
(function (global) {
  'use strict';

  // 'mock'（既定・外部API不要） | 'remote'（自前API経由で Gemini）
  var REPLY_PROVIDER = 'mock';

  // 自前API(Cloudflare Worker)のURL。デプロイ後にここへ貼る。例:
  //   'https://yawagaeshi-api.example.workers.dev'
  var REPLY_ENDPOINT = '';

  // 利用回数制限の土台（将来：無料3回/日 など）。今は無制限。
  var DAILY_LIMIT = 0; // 0 = 制限なし

  // 実行時オーバーライド（localStorage）。コードを触らず切り替えられる。
  function provider() {
    try { return global.localStorage.getItem('yawagaeshi:provider') || REPLY_PROVIDER; }
    catch (e) { return REPLY_PROVIDER; }
  }
  function endpoint() {
    try { return global.localStorage.getItem('yawagaeshi:endpoint') || REPLY_ENDPOINT; }
    catch (e) { return REPLY_ENDPOINT; }
  }
  function useRemote() { return provider() === 'remote' && !!endpoint(); }

  // 将来 AI API に投げる想定のプロンプト雛形（mock では未使用）。
  var SYSTEM_PROMPT =
    'あなたは日本語のコミュニケーションに強い返信文作成アシスタントです。\n' +
    '目的：ユーザーが送信前に一呼吸置き、角が立たない返信文を作れるようにしてください。\n' +
    '条件：日本語で出力する／相手を責めない／不自然な敬語にしない／回りくどすぎない／' +
    'ユーザーの意図は変えない／必要以上に謝らない／返信案を3つ出す／それぞれトーンを変える／出力はJSON形式にする。';

  function buildUserPrompt(req) {
    return [
      '相手から来た文：\n' + (req.originalMessage || '(なし)'),
      'ユーザーが伝えたいこと：\n' + (req.userIntent || ''),
      '相手との関係：' + (req.relationship || '指定なし'),
      '使用チャネル：' + (req.channel || '指定なし'),
      '希望トーン：' + ((req.tones || []).join('、') || '指定なし'),
      '希望の長さ：' + (req.length || '普通')
    ].join('\n');
  }

  // =========================================================================
  // 公開API
  // =========================================================================
  /**
   * 返信案3つ＋送信前チェックを生成する。
   * @param {object} request ReplyRequest
   * @returns {Promise<{suggestions:Array, riskCheck:object}>}
   */
  function generateReplies(request) {
    if (useRemote()) return callRemote(request);
    // モック：体感のため、わずかな遅延を入れて「生成中」を見せる
    return delay(420).then(function () {
      return {
        suggestions: generateMockReplies(request),
        riskCheck: assessRisk(request)
      };
    });
  }

  /**
   * 1案だけ作り直す（「もっと丁寧に」「もっと短く」）。
   * 内部ではトーン/長さを足したリクエストで再生成し、同じラベルの案を返す。
   * @param {object} request
   * @param {string} label "やわらかめ"|"ちょうどいい"|"短め"
   * @param {string} mode  "polite"|"short"
   * @returns {Promise<{label,text,note}>}
   */
  function regenerate(request, label, mode) {
    var tweaked = cloneRequest(request);
    if (mode === 'polite') {
      tweaked.tones = uniq((tweaked.tones || []).concat(['丁寧に', 'やわらかく']));
      tweaked.length = '丁寧に長め';
    } else { // short
      tweaked.tones = uniq((tweaked.tones || []).concat(['短く']));
      tweaked.length = '短め';
    }
    // generateReplies 経由なので remote 有効時は自動で Gemini を使う
    return generateReplies(tweaked).then(function (res) {
      var list = res.suggestions || [];
      var picked = find(list, function (s) { return s.label === label; }) || list[mode === 'short' ? 2 : 0] || list[0];
      return {
        label: label,
        text: (picked && picked.text) || '',
        note: mode === 'polite' ? 'もう少し丁寧に整えました。' : '今回は少し短めに整えました。'
      };
    });
  }

  // =========================================================================
  // 自前API(Cloudflare Worker)呼び出し。失敗時はモックにフォールバック。
  // =========================================================================
  function callRemote(request) {
    function fallback() {
      return { suggestions: generateMockReplies(request), riskCheck: assessRisk(request) };
    }
    return fetch(endpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ request: request })
    })
      .then(function (r) { if (!r.ok) throw new Error('bad status ' + r.status); return r.json(); })
      .then(function (data) {
        // 期待形でなければモックで補う
        if (!data || !Array.isArray(data.suggestions) || !data.suggestions.length) return fallback();
        return data;
      })
      .catch(function () {
        // ネットワーク不通・API未設定・プロバイダ障害でも体験を止めない
        return fallback();
      });
  }

  // =========================================================================
  // フェーズ1：モック生成
  // 入力（関係・チャネル・トーン・長さ・伝えたいこと）から3案を出し分ける。
  // 完全な高精度ではなく、「一連の体験が成立する」ことを優先。
  // =========================================================================
  function generateMockReplies(req) {
    var rel = req.relationship || 'その他';
    var ch = req.channel || 'その他';
    var tones = req.tones || [];
    var len = req.length || '普通';
    var orig = (req.originalMessage || '').trim();

    // 敬語レベル（keigo）は関係・チャネルで決める
    var formal = rel === '取引先' || rel === '上司' || ch === 'メール';
    // あいさつ口調は「チャネル」基準：メール/取引先のみメール挨拶、
    // Slack/LINE/DM など社内チャットは「おつかれさまです。」が自然。
    var emailStyle = ch === 'メール' || rel === '取引先';
    var casual = (rel === '友人' || rel === '家族') && ch !== 'メール';
    var neutral = has(tones, '感情を抜く');

    var kind = primaryKind(tones);              // 'apology'|'decline'|'remind'|'plain'
    var body = composeBody(req.userIntent, kind);
    var lenBias = len === '短め' ? -1 : (len === '丁寧に長め' ? 1 : 0);

    var base = { soft: false, formal: formal, emailStyle: emailStyle, casual: casual, neutral: neutral, kind: kind, body: body, orig: orig, ch: ch };
    // 3つの案：やわらかめ / ちょうどいい / 短め
    var soft = buildVariant(assign({}, base, { rich: 2 + lenBias, soft: true }));
    var mid = buildVariant(assign({}, base, { rich: 1 + lenBias }));
    var shortV = buildVariant(assign({}, base, { rich: 0, terse: true }));

    return [
      { label: 'やわらかめ', text: soft, note: noteFor('soft', kind) },
      { label: 'ちょうどいい', text: mid, note: noteFor('mid', kind) },
      { label: '短め', text: shortV, note: noteFor('short', kind) }
    ];
  }

  // ---- 文の組み立て --------------------------------------------------------
  function buildVariant(o) {
    var rich = clamp(o.rich, 0, 3);
    var lines = [];

    // あいさつ
    if (!o.terse && rich >= 2) {
      var g = greeting(o.emailStyle, o.casual);
      if (g) lines.push(g);
    }
    // 相手の文への受け止め（お礼など）
    if (o.orig && rich >= 1 && !o.casual) {
      var ack = acknowledge(o.kind, o.neutral);
      if (ack) lines.push(ack);
    }

    // 本文（クッション言葉＋伝えたいこと）
    var bodyLine = '';
    if (rich >= 1 && !o.neutral) {
      var cu = cushion(o.kind, o.soft, o.casual);
      if (cu) bodyLine += cu;
    }
    bodyLine += o.body;
    lines.push(bodyLine);

    // 丁寧に長め向けの一文
    if (rich >= 3) {
      var ex = extraLine(o.kind);
      if (ex) lines.push(ex);
    }

    // 結び
    lines.push(closing(o.kind, rich, o.casual, o.neutral));

    return lines.join('\n');
  }

  // メール/取引先のみメール挨拶。社内チャット(Slack/LINE/DM)は「おつかれさまです。」。
  function greeting(emailStyle, casual) {
    if (casual) return '';
    return emailStyle ? 'お世話になっております。' : 'おつかれさまです。';
  }

  function acknowledge(kind, neutral) {
    if (neutral) return '';
    if (kind === 'decline') return 'ご提案いただきありがとうございます。';
    if (kind === 'remind') return '';
    if (kind === 'apology') return 'ご連絡ありがとうございます。';
    return 'ご連絡ありがとうございます。';
  }

  function cushion(kind, soft, casual) {
    if (casual) {
      if (kind === 'apology') return 'ごめんね、';
      if (kind === 'decline') return 'ごめん、';
      if (kind === 'remind') return 'お手すきのときでいいんだけど、';
      return '';
    }
    if (kind === 'apology') return 'この度はご迷惑をおかけし、申し訳ありません。';
    if (kind === 'decline') return soft ? '大変申し訳ないのですが、' : '申し訳ありませんが、';
    if (kind === 'remind') return soft ? 'お忙しいところ恐れ入りますが、' : '恐れ入りますが、';
    return soft ? '恐れ入りますが、' : '';
  }

  function extraLine(kind) {
    if (kind === 'decline') return 'またの機会がございましたら、ぜひよろしくお願いいたします。';
    if (kind === 'apology') return '今後このようなことがないよう、十分に注意いたします。';
    if (kind === 'remind') return 'お手数をおかけしますが、何卒よろしくお願いいたします。';
    return 'ご不明な点がございましたら、お気軽にお知らせください。';
  }

  function closing(kind, rich, casual, neutral) {
    if (casual) {
      if (kind === 'apology') return 'ごめんね、よろしく！';
      if (kind === 'decline') return 'ごめん、また誘ってね！';
      return rich >= 1 ? 'よろしくね！' : 'よろしく！';
    }
    if (neutral) return rich >= 1 ? 'よろしくお願いいたします。' : 'よろしくお願いします。';
    if (kind === 'apology') return rich >= 2 ? '重ねてお詫び申し上げます。' : '申し訳ありませんでした。';
    if (kind === 'decline') return rich >= 2 ? '何卒ご理解いただけますと幸いです。' : 'よろしくお願いいたします。';
    if (kind === 'remind') return rich >= 1 ? 'ご確認のほど、よろしくお願いいたします。' : 'ご確認をお願いします。';
    return rich >= 1 ? 'どうぞよろしくお願いいたします。' : 'よろしくお願いします。';
  }

  // 「伝えたいこと」を本文へ整える。
  // メタ表現（〜と伝えたい 等）を取り除き、文末を整える。
  function composeBody(intent, kind) {
    var s = (intent || '').replace(/\s+/g, ' ').trim();
    if (!s) {
      if (kind === 'apology') return '先ほどの件、こちらの不手際でご迷惑をおかけしました。';
      if (kind === 'decline') return '今回は見送らせていただきます。';
      if (kind === 'remind') return '先日の件、その後いかがでしょうか。';
      return 'ご連絡いたします。';
    }
    // 末尾の「返信する行為」を表すメタ表現だけを除去する（例：「〜と伝えたい」）。
    // 「確認したい」「知りたい」などは“内容そのもの”なので残し、politeTail でていねい化する。
    s = s.replace(/(、|。)?\s*(という旨を?|旨を?|ことを|と|を)?\s*(伝えたい|伝えたいです|返したい|返信したい|言いたい|話したい|連絡したい|謝りたい|詫びたい|お詫びしたい)(です|と思います|と思う)?\s*[。.!！]?$/u, '');
    s = s.replace(/[。.\s]+$/u, '');
    if (!s) return 'ご連絡いたします。';
    // 文末の言い切り（辞書形）を、ていねいな「ます/です」調へ寄せる（安全な範囲のみ）
    s = politeTail(s);
    // 文末を整える（句点で終わるように）
    return s + '。';
  }

  // よくある言い切りだけを控えめにていねい化する。該当しなければそのまま。
  function politeTail(s) {
    // 否定形(〜ない)・すでにていねいな形は、誤変換を避けてそのまま返す。
    if (/(ない|ません|です|ます|ください|でしょうか)$/u.test(s)) return s;
    var rules = [
      [/できる$/u, 'できます'],
      [/可能$/u, '可能です'],
      [/する$/u, 'します'],
      [/いる$/u, 'います'],
      [/なる$/u, 'なります'],
      [/思う$/u, 'と思います'],
      [/だ$/u, 'です']
    ];
    for (var i = 0; i < rules.length; i++) {
      if (rules[i][0].test(s)) return s.replace(rules[i][0], rules[i][1]);
    }
    // い形容詞の言い切り（難しい・厳しい 等）は「です」を添える。
    // 注: 辞書形の動詞は「う段」で終わるため、ここに来る「〜い」はほぼ形容詞。
    if (/[ぁ-んァ-ヶ一-龠]い$/u.test(s)) return s + 'です';
    return s;
  }

  function noteFor(level, kind) {
    if (level === 'soft') {
      if (kind === 'decline') return 'お礼とお詫びを添えて、角を立てずに。';
      if (kind === 'apology') return 'まず謝意を、やわらかい言葉で。';
      if (kind === 'remind') return 'やわらかく、急かしすぎない催促。';
      return 'クッション言葉を添えて、やわらかい印象に。';
    }
    if (level === 'short') return '要点だけ、すっきり短く。';
    return 'ていねいさと簡潔さのバランス。';
  }

  // =========================================================================
  // 送信前チェック（冷たさ・圧・長さを 1〜3 で見積もる）
  // =========================================================================
  function assessRisk(req) {
    var tones = req.tones || [];
    var len = req.length || '普通';

    var coldness = 1, pressure = 1;
    if (has(tones, '短く')) coldness += 1;
    if (has(tones, 'きっぱり')) { coldness += 1; pressure += 1; }
    if (has(tones, '感情を抜く')) coldness += 1;
    if (has(tones, 'やわらかく')) coldness -= 1;
    if (has(tones, '丁寧に')) coldness -= 1;
    if (has(tones, '謝る')) { coldness -= 1; pressure -= 1; }
    if (has(tones, '催促')) pressure += 1;
    if (has(tones, '断る')) pressure += 1;

    var length = len === '短め' ? 1 : (len === '丁寧に長め' ? 3 : 2);

    coldness = clamp(coldness, 1, 3);
    pressure = clamp(pressure, 1, 3);

    return { coldness: coldness, pressure: pressure, length: length, comment: riskComment(coldness, pressure, length) };
  }

  function riskComment(cold, press, len) {
    if (press >= 3) return '少し圧が強いかもしれません。一言そえると、印象がやわらぎます。';
    if (cold >= 3) return '少し冷たく見えるかもしれません。あいさつや気づかいを足すと安心です。';
    if (press >= 2) return '少し急かす印象があるかもしれません。送信前にもう一度確認しましょう。';
    if (len >= 3) return 'やや長めです。要点が伝わるか、ざっと読み返してみましょう。';
    if (cold <= 1 && press <= 1) return 'やわらかく整っています。そのまま送れそうです。';
    return '落ち着いた印象に整っています。送信前に、もう一度だけ確認しましょう。';
  }

  // ---- 小物 ---------------------------------------------------------------
  function primaryKind(tones) {
    if (has(tones, '謝る')) return 'apology';
    if (has(tones, '断る')) return 'decline';
    if (has(tones, '催促')) return 'remind';
    return 'plain';
  }
  function has(arr, v) { return (arr || []).indexOf(v) >= 0; }
  function uniq(arr) { var o = []; arr.forEach(function (x) { if (o.indexOf(x) < 0) o.push(x); }); return o; }
  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function find(arr, fn) { for (var i = 0; i < arr.length; i++) if (fn(arr[i])) return arr[i]; return null; }
  function assign(target) {
    for (var i = 1; i < arguments.length; i++) {
      var s = arguments[i]; if (!s) continue;
      for (var k in s) if (Object.prototype.hasOwnProperty.call(s, k)) target[k] = s[k];
    }
    return target;
  }
  function cloneRequest(r) {
    return {
      originalMessage: r.originalMessage, userIntent: r.userIntent, relationship: r.relationship,
      channel: r.channel, tones: (r.tones || []).slice(), length: r.length
    };
  }
  function delay(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }

  // ---- 公開 ---------------------------------------------------------------
  global.ReplyService = {
    get provider() { return provider(); },
    get endpoint() { return endpoint(); },
    get usingRemote() { return useRemote(); },
    dailyLimit: DAILY_LIMIT,
    generateReplies: generateReplies,
    regenerate: regenerate,
    assessRisk: assessRisk,
    // テスト/将来用に内部関数も公開
    _generateMockReplies: generateMockReplies,
    _buildUserPrompt: buildUserPrompt
  };
})(window);
