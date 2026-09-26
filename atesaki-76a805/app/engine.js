/* ================================================================
   宛先しらべ — 判定(純関数のみ。DOM にも通信にも触れない)
   記事の言葉を辞書(lexicon.js)で数え、「誰に(職種)」「何に(関心)」の2軸で、記事の言葉の宛先を一文にする。
   数えているのは言葉だけで、実際に誰が読んだか・誰に届いたかは測っていない。画面もその範囲で言う(第15条)。
   どの数字も「どの文のどの語から来たか」を持ち回り、結果の理由を記事の文で見せられるようにする(第8条)。
   ブラウザ(app.js)と取り込み(scripts/atesaki-build.mjs)が同じこのファイルを使う。

   数え方(変えるときはテストと 174 本での確かめを見ながら):
     文で数える   読み手の値 = その読み手に触れた文の数(1文につき、その読み手の一番強い語の重みを1回だけ)。
                  語の回数を足すと、例を並べた箇条書きが主題より強く出るため(2026-09-25 174 本で確認)
     本文とタイトル 宛先の一文は本文だけで決める(本文の先頭 LEAD_CHARS 字の文は ×LEAD_W)。
                  タイトルは別に読み(重み TITLE_MIN 以上の語だけ)、本文に裏付け(MIN_RAW 以上)があればタイトルの枠を主役にする。
                  裏付けが弱いときだけ「タイトルと本文のずれ」とする(2026-09-25 独立の読み手30本との照合で、
                  本文の値だけで決めるとずれの表示が10件中0件しか読み手と合わなかったため)
     名指し       職種の語のすぐ後に「の方」「の皆さん」が続く文(読み手への呼びかけ)は、その職種を ×ADDRESS_W
     職種の列挙   1文に LIST_WHO 以上の職業(LIST_IDS)が並ぶ文は、各職種には ×LIST_KEEP だけ入れ、「職種を問わず医療職」に入れる
     読み手に出す 値が MIN_RAW 以上、かつ軸の中の割合が MIN_SHARE 以上。2人目は1人目の SECOND_RATIO 以上のときだけ
     職種を問わず 医療職の総称が一番多い職種の GENERAL_RATIO 倍以上、または3職種以上に同じくらい触れている
     医療職以外   関心の1位が「体と健康の仕組み」で、タイトルに職種の語がない記事(臨床知識の解説)
     物語         連載小説などは宛先を出さない(登場人物の職種の言葉が、読み手の職種とは限らないため)
     定型文       BOILER_MIN 本以上の記事に同じ形で出る行(曜日シリーズの案内・販売の告知)は数えない。ただし辞書の語と
                  句読点だけの行(「マネジメント。」)は、本文の箇条書きがたまたまそろったものなので定型文にしない
   スキから見た目安(calibrate):
     相対スキ    (その記事のスキ + 1) ÷ (前後 WINDOW 日に出した記事のスキの中央値 + 1)。フォロワーの増減を相殺する
     母数        物語・有料記事・公開から SETTLE_DAYS 日未満の記事・note で開けなくなっている記事(missing)は入れない
                  (missing の記事は、スキを読み直せないまま前の値が残っているため)
     話題の偏り  前後の窓に、その読み手ではない記事が MIN_OTHER 本以上ない記事は、その読み手の集計に入れない
                  (同じ話題を続けて書いた時期は、窓がその話題で埋まり、差が打ち消されるため)
     判定の下限  同じ読み手の記事が MIN_N 本未満なら「まだ判定できない」。99 本から無作為に選んで試すと、
                  差がないのに多め/少なめが出る率は 10 本で 23%・30 本で 5%(2026-09-25 反論役の試算)
     多め/少なめ  中央値が MORE 倍以上(LESS 倍以下)で、かつ CONSISTENT 以上の記事が同じ向きのときだけ
   ================================================================ */
(function (root) {
  'use strict';
  const L = (typeof module === 'object' && module.exports) ? require('./lexicon.js') : root.ATESAKI_LEXICON;
  const { WHO, GENERAL, TOPIC, AXES, STORY } = L;

  // 判定の版。数え方(このファイルの定数・処理)を変えたら上げる。辞書の変更は FINGERPRINT が自動で拾う
  const ENGINE_REV = 11;

  const LEAD_CHARS = 300;
  const LEAD_W = 1.5;
  const ADDRESS_W = 3;
  const LIST_WHO = 3;
  const LIST_KEEP = 0.3;
  const MIN_RAW = 5;
  const MIN_SHARE = 0.18;
  const SECOND_RATIO = 0.5;
  const GENERAL_MIN = 4;
  const GENERAL_RATIO = 0.8;
  const SPREAD_TOP_SHARE = 0.4;
  const FOCUS_SHARE = 0.45;
  const TITLE_MIN = 2;
  const BOILER_MIN = 5;
  const QUOTE_MIN = 20;
  const QUOTE_MAX = 88;
  const QUOTES_PER_SEG = 2;
  const SHARE_TITLE_MAX = 80;

  const WINDOW = 45;
  const WINDOW_WIDE = 90;
  const MIN_NEIGHBORS = 4;
  const MIN_OTHER = 4;
  const SETTLE_DAYS = 7;
  const MIN_N = 30;
  const MORE = 1.2;
  const LESS = 0.83;
  const CONSISTENT = 2 / 3;
  const CONTRAST = 0.15;
  const CONTRAST_BASE = 0.08;

  /* ---- 読み手の一覧(軸つき)。general は職種の軸の特別な読み手 ---- */
  const SEGS = {};
  for (const [id, s] of Object.entries(WHO)) SEGS[id] = Object.assign({ id, axis: 'who' }, s);
  SEGS.general = Object.assign({ id: 'general', axis: 'who', general: true }, GENERAL);
  for (const [id, s] of Object.entries(TOPIC)) SEGS[id] = Object.assign({ id, axis: 'topic' }, s);
  const SEG_IDS = Object.keys(SEGS);
  const WHO_IDS = Object.keys(WHO);
  const LIST_IDS = ['nurse', 'rehab', 'clerk', 'care', 'otherMed']; // 列挙の判定に使う職業(学生・経営側・一般の読み手は数えない)
  const TOPIC_IDS = Object.keys(TOPIC);

  /* ---- 文字の正規化。全角英数を半角に(ＡＩ → AI)、改行を \n に ---- */
  function normalize(s) {
    return String(s == null ? '' : s).normalize('NFKC').replace(/\r\n?/g, '\n');
  }

  /* ---- 辞書の指紋。辞書か ENGINE_REV か定数が変わると変わる。焼いたデータと食い違えばテストが落ちる ---- */
  function fnv1a(str) {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return ('0000000' + h.toString(16)).slice(-8);
  }
  const FINGERPRINT = 'r' + ENGINE_REV + '-' + fnv1a(
    JSON.stringify(SEG_IDS.map(id => [id, SEGS[id].terms, SEGS[id].phrase, SEGS[id].label, SEGS[id].short])) + JSON.stringify(STORY.tags) + STORY.title.map(String).join() +
    JSON.stringify([LEAD_CHARS, LEAD_W, ADDRESS_W, LIST_WHO, LIST_KEEP, MIN_RAW, MIN_SHARE, SECOND_RATIO, GENERAL_MIN, GENERAL_RATIO, SPREAD_TOP_SHARE, FOCUS_SHARE, TITLE_MIN, BOILER_MIN, QUOTE_MIN, QUOTE_MAX]));

  /* ---- 語の索引。同じ語が複数の読み手に効くことがある(「新卒採用」= チーム と 学生・新人(弱く)) ---- */
  const TERM_MAP = new Map();
  for (const id of SEG_IDS) {
    for (const [term, w] of SEGS[id].terms) {
      const key = normalize(term).toLowerCase();
      if (!TERM_MAP.has(key)) TERM_MAP.set(key, { term, ascii: /^[\x21-\x7e]+$/.test(term), segs: [] });
      TERM_MAP.get(key).segs.push([id, w]);
    }
  }
  const escRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // 長い語から試す(「看護師」を「看護」より先に)。英字の語の境目は scan で確かめる
  const TERM_RE = new RegExp([...TERM_MAP.values()]
    .sort((a, b) => b.term.length - a.term.length)
    .map(t => escRe(normalize(t.term)))
    .join('|'), 'gi');

  /* ---- note の本文 HTML → 素の文字。段落・見出し・改行を \n にする ---- */
  const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  function htmlToText(html) {
    return String(html || '')
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|h[1-6]|li|blockquote|figure|figcaption|pre|div|tr|table|ul|ol)>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
        if (e[0] === '#') {
          const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
          return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : m;
        }
        const v = ENTITIES[e.toLowerCase()];
        return v != null ? v : m;
      })
      .replace(/[ \t　]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /* ---- 文に分ける(。?! と改行)。本文の中の位置を持ち回る ---- */
  function splitSentences(text) {
    const out = [];
    let start = 0;
    const push = end => {
      const raw = text.slice(start, end);
      const t = raw.trim();
      if (t) out.push({ text: t, start: start + (raw.length - raw.trimStart().length) });
    };
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      if (c === '\n') { push(i); start = i + 1; }
      else if (c === '。' || c === '?' || c === '!') {
        let j = i + 1;
        while (j < text.length && '」』)'.includes(text[j])) j++; // 閉じ括弧まで含める
        push(j); start = j; i = j - 1;
      }
    }
    push(text.length);
    return out;
  }

  /* ---- 語を拾う。[{key, index, length}] ---- */
  /* 英字の語は、前が英数字でなく、後ろが英字でないときだけ(PT が PTA・STEP に当たらず、「PT5年目」には当たる)。
     後ろ読み(?<!)は古い Safari で構文エラーになるので使わず、ここで確かめる */
  const ALNUM = /[A-Za-z0-9]/;
  const ALPHA = /[A-Za-z]/;
  function scan(text) {
    const hits = [];
    TERM_RE.lastIndex = 0;
    let m;
    while ((m = TERM_RE.exec(text))) {
      const key = m[0].toLowerCase();
      const t = TERM_MAP.get(key);
      if (t && t.ascii && ((m.index > 0 && ALNUM.test(text[m.index - 1])) || ALPHA.test(text[m.index + m[0].length] || ''))) {
        TERM_RE.lastIndex = m.index + 1;
        continue;
      }
      hits.push({ key, index: m.index, length: m[0].length });
    }
    return hits;
  }

  /* ---- 物語(連載小説など)か ---- */
  function isStory(title, tags) {
    if (STORY.title.some(re => re.test(title || ''))) return true;
    const set = new Set((tags || []).map(t => normalize(t).trim()));
    return STORY.tags.some(t => set.has(t));
  }

  /* ---- 1文を読む。読み手ごとに、その文で一番強い語の重みと印の位置 ---- */
  // 名指しの呼びかけ(「院長・事務長の方」「リハ職の皆さん」「経営されている方」)。その読み手の語の直後に続く形
  const ADDRESS_RE = /^(?:の)?(?:方|方々|皆さん|みなさん|皆様)(?:へ|に|は|も|、|。|$)/;
  function readSentence(text) {
    const best = {};
    const marks = {};
    const addr = {};
    for (const h of scan(text)) {
      const t = TERM_MAP.get(h.key);
      if (!t) continue;
      const called = ADDRESS_RE.test(text.slice(h.index + h.length, h.index + h.length + 6));
      for (const [id, w] of t.segs) {
        if (!(best[id] >= w)) best[id] = w;
        if (called) addr[id] = true;
        (marks[id] = marks[id] || []).push([h.index, h.index + h.length]);
      }
    }
    // 職種の列挙: 3つ以上の職種が並ぶ文は、職種を問わない書き方として数える
    const whoHit = LIST_IDS.filter(id => best[id]);
    if (whoHit.length >= LIST_WHO) {
      best.general = Math.max(best.general || 0, ...whoHit.map(id => best[id]));
      for (const id of whoHit) best[id] *= LIST_KEEP;
    }
    for (const id of Object.keys(addr)) if (SEGS[id].axis === 'who') best[id] *= ADDRESS_W;
    return { best, marks };
  }

  /* ---- 1つの軸の上位。値が MIN_RAW 以上・割合が MIN_SHARE 以上、2人目は1人目の SECOND_RATIO 以上 ---- */
  function topOf(raw, ids, minRaw) {
    const sum = ids.reduce((a, id) => a + raw[id], 0);
    const share = Object.fromEntries(ids.map(id => [id, sum ? Math.round(raw[id] / sum * 1000) / 1000 : 0]));
    const ranked = ids.filter(id => raw[id] >= minRaw && share[id] >= MIN_SHARE).sort((a, b) => raw[b] - raw[a]);
    return { share, top: ranked.slice(0, 2).filter((id, i) => i === 0 || raw[id] >= raw[ranked[0]] * SECOND_RATIO) };
  }

  /* ---- タイトルを読む。短いので、弱い語(TITLE_MIN 未満)では決めない。
     「医療職」などの総称があれば、職種の名前があっても総称を呼びかけとみなす(「PT出身の僕が、医療職の〜」) ---- */
  // 末尾のシリーズ名(「– キャリア探求シリーズ」「…シリーズ(番外編)」)は記事の約束ではないので、読みにも根拠にも使わない
  const SERIES_RE = /\s*[–—―─-]\s*[^–—―─-]*シリーズ\s*(?:[(（][^)）]*[)）])?\s*$/;
  const titleCore = t => String(t || '').replace(SERIES_RE, '');
  function readTitle(title) {
    if (!title) return { who: null, topic: null };
    const { best } = readSentence(titleCore(title));
    const pick = ids => ids.filter(id => best[id] >= TITLE_MIN).sort((a, b) => best[b] - best[a])[0] || null;
    const who = best.general >= TITLE_MIN ? 'general' : pick(WHO_IDS);
    return { who, topic: pick(TOPIC_IDS) };
  }

  /* ---- 定型文を外す。複数の記事に同じ形で出る行(シリーズの案内・販売の告知など)は、記事の宛先ではない ---- */
  function stripLines(text, ignore) {
    if (!ignore || !ignore.size) return text;
    return text.split('\n').filter(l => !ignore.has(l.trim())).join('\n');
  }
  /* 記事の本文の集まりから定型文の一覧を作る。BOILER_MIN 本以上に同じ形で出て、辞書の語を含む行だけ。
     辞書の語と句読点だけの行(「マネジメント。」)は、箇条書きの本文がたまたまそろったものなので外す */
  function onlyTerms(line) {
    let rest = line;
    for (const h of scan(line).sort((a, b) => b.index - a.index)) rest = rest.slice(0, h.index) + rest.slice(h.index + h.length);
    return !/[^\s\p{P}\p{S}]/u.test(rest);
  }
  function boilerplateOf(texts) {
    const cnt = new Map();
    for (const t of texts) {
      for (const l of new Set(normalize(t).split('\n').map(x => x.trim()).filter(Boolean))) cnt.set(l, (cnt.get(l) || 0) + 1);
    }
    return [...cnt].filter(([l, n]) => n >= BOILER_MIN && scan(l).length && !onlyTerms(l)).map(([l]) => l).sort();
  }

  /* ---- 本体。{ title, text, tags } → 結果。opts.ignore: 定型文の行(Set) ---- */
  function analyze(input, opts) {
    const title = normalize(input.title || '').trim().replace(/\s+/g, ' ');
    const text = stripLines(normalize(input.text || '').trim(), opts && opts.ignore);
    const tags = (input.tags || []).map(t => normalize(t).trim()).filter(Boolean);

    const sentences = [];
    if (titleCore(title)) sentences.push({ text: titleCore(title), start: -1, where: 'title', w: 0 });
    for (const s of splitSentences(text)) sentences.push(Object.assign(s, { where: 'body', w: s.start < LEAD_CHARS ? LEAD_W : 1 }));

    // 本文の値(宛先の一文はこれで決める)と、語の内訳
    const raw = Object.fromEntries(SEG_IDS.map(id => [id, 0]));
    const termCount = Object.fromEntries(SEG_IDS.map(id => [id, {}]));
    for (const s of sentences) {
      const r = readSentence(s.text);
      s.read = r;
      if (s.where !== 'body') continue;
      for (const [id, w] of Object.entries(r.best)) raw[id] += w * s.w;
      for (const [id, ms] of Object.entries(r.marks)) {
        for (const [a, b] of ms) {
          const term = TERM_MAP.get(s.text.slice(a, b).toLowerCase()).term;
          termCount[id][term] = (termCount[id][term] || 0) + 1;
        }
      }
    }
    for (const id of SEG_IDS) raw[id] = Math.round(raw[id] * 100) / 100;

    const who = topOf(raw, WHO_IDS, MIN_RAW);
    const topic = topOf(raw, TOPIC_IDS, MIN_RAW);
    const share = { who: who.share, topic: topic.share };
    const top = { who: who.top, topic: topic.top };
    const titleRead = readTitle(title);

    // 職種を問わず医療職: 総称が一番多い職種と並ぶか上回る / 3職種以上に同じくらい触れている
    const topWhoRaw = top.who.length ? raw[top.who[0]] : 0;
    const touched = WHO_IDS.filter(id => raw[id] >= MIN_RAW);
    const spread = touched.length >= 3 && (share.who[top.who[0]] || 0) < SPREAD_TOP_SHARE;
    let generalLead = raw.general >= GENERAL_MIN && (raw.general >= topWhoRaw * GENERAL_RATIO || spread);
    // 「医療職、とくに◯◯」と言えるのは、職種の中で1つがはっきり多いとき
    let focus = generalLead && !spread && top.who.length && share.who[top.who[0]] >= FOCUS_SHARE ? top.who[0] : null;
    // 体の仕組みの解説で、タイトルが職種を呼んでいない記事は、医療職以外に宛てたものと読む
    // タイトルが示す枠に本文の裏付けがあれば、それを主役にする(書き手がタイトルで決めた枠を、本文の例で上書きしない)。
    // 裏付けが弱い(MIN_RAW 未満)ときだけ、タイトルと本文のずれとして返す(gapOf)
    if (titleRead.topic && raw[titleRead.topic] >= MIN_RAW && top.topic[0] !== titleRead.topic) {
      top.topic = [titleRead.topic].concat(top.topic.filter(id => id !== titleRead.topic)).slice(0, 2);
    }
    if (titleRead.who === 'general' && raw.general >= GENERAL_MIN && !generalLead) {
      generalLead = true;
      focus = top.who.length && share.who[top.who[0]] >= FOCUS_SHARE ? top.who[0] : null;
    } else if (titleRead.who && titleRead.who !== 'general' && raw[titleRead.who] >= MIN_RAW && top.who[0] !== titleRead.who && !generalLead) {
      top.who = [titleRead.who].concat(top.who.filter(id => id !== titleRead.who)).slice(0, 2);
    }
    let publicRule = false;
    if (top.topic[0] === 'body' && !titleRead.who) {
      top.who = ['public'];
      generalLead = false;
      focus = null;
      publicRule = true;
    }

    const story = isStory(title, tags);
    const mainWho = generalLead ? 'general' : (top.who[0] || null);
    const mainTopic = top.topic[0] || null;

    // 根拠の文。値が MIN_RAW 以上の読み手(と総称)について2文まで。タイトルも候補に入れる
    const quoteIds = SEG_IDS.filter(id => raw[id] >= MIN_RAW || (id === 'general' && generalLead));
    const evidence = {};
    for (const id of quoteIds) evidence[id] = quotesFor(id, sentences);
    const words = {};
    for (const id of quoteIds) {
      words[id] = Object.entries(termCount[id]).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([term, count]) => ({ term, count }));
    }

    const result = {
      fingerprint: FINGERPRINT,
      title, chars: text.length, story,
      raw, share, top, generalLead, spread, focus, publicRule,
      main: { who: mainWho, topic: mainTopic },
      titleRead,
      gap: gapOf(titleRead, mainWho, top, raw),
      words, evidence,
    };
    result.reader = readerOf(result);
    return result;
  }

  /* タイトルと本文の宛先のずれ。タイトルの読み手・関心に、本文の裏付けが弱いときだけずれとする */
  function gapOf(t, mainWho, top, raw) {
    const support = id => id === 'general' ? raw.general >= GENERAL_MIN : raw[id] >= MIN_RAW;
    const whoGap = !!(t.who && mainWho && t.who !== mainWho && !support(t.who));
    const topicGap = !!(t.topic && top.topic.length && !top.topic.includes(t.topic) && !support(t.topic));
    return { who: whoGap, topic: topicGap };
  }

  /* 読み手 id について、その読み手の語が入った文を選び、長ければ語のまわりだけ切り出して印の位置を付ける。
     短すぎる行(箇条書きの「副業」だけ等)は、ほかに文がないときだけ使う */
  function quotesFor(id, sentences) {
    const cand = [];
    for (const s of sentences) {
      const r = s.read;
      if (!r || !r.best[id] || !r.marks[id]) continue;
      const distinct = new Set(r.marks[id].map(([a, b]) => s.text.slice(a, b))).size;
      const bonus = s.where === 'title' ? 1.5 : s.start < LEAD_CHARS ? 1.2 : 1;
      cand.push({ s, marks: r.marks[id], short: s.text.length < QUOTE_MIN, score: r.best[id] * bonus + distinct * 0.5 });
    }
    cand.sort((a, b) => (a.short - b.short) || (b.score - a.score) || (a.s.start - b.s.start));
    return cand.slice(0, QUOTES_PER_SEG).map(c => clip(c.s.text, c.marks, c.s.where));
  }

  function clip(text, marks, where) {
    const sorted = marks.slice().sort((a, b) => a[0] - b[0]);
    if (text.length <= QUOTE_MAX) return { text, marks: sorted, where };
    const first = sorted[0][0];
    let from = Math.max(0, first - Math.floor(QUOTE_MAX / 4));
    let to = Math.min(text.length, from + QUOTE_MAX);
    from = Math.max(0, to - QUOTE_MAX);
    const low = i => { const c = text.charCodeAt(i); return c >= 0xDC00 && c <= 0xDFFF; };
    if (from > 0 && low(from)) from++;   // 絵文字などを半分に切らない
    if (to < text.length && low(to)) to--;
    const pre = from > 0 ? '…' : '';
    const post = to < text.length ? '…' : '';
    const kept = sorted.filter(m => m[0] >= from && m[1] <= to).map(m => [m[0] - from + pre.length, m[1] - from + pre.length]);
    return { text: pre + text.slice(from, to) + post, marks: kept, where };
  }

  /* ---- 宛先の一文。主役は職種1つ・関心1つ。数字は出さず、言葉だけにする ----
     note: 一文に添える短い注記の種類(画面の文言は app.js が持つ) */
  function readerOf(r) {
    if (r.story) return { text: '', found: false, note: 'story' };
    let who = '';
    if (r.generalLead) who = r.focus ? '医療職、とくに' + SEGS[r.focus].phrase : GENERAL.phrase;
    else if (r.top.who.length) who = SEGS[r.top.who[0]].phrase;
    const topic = r.main.topic ? SEGS[r.main.topic].phrase : '';
    if (who && topic) return { text: who + 'で、' + topic + 'が気になっている人', found: true, note: '' };
    if (topic) return { text: topic + 'が気になっている人', found: true, note: '' };
    if (who) return { text: who, found: true, note: 'mixedTopic' };
    return { text: '', found: false, note: 'few' };
  }

  /* ---- note の URL から記事の key を取り出す(note.com/{user}/n/{key}・独自ドメイン・key だけ) ---- */
  function parseNoteUrl(input) {
    const s = String(input || '').trim();
    if (!s) return null;
    const m = s.match(/\/n\/(n[0-9a-f]{12})(?![0-9a-z])/i) || s.match(/^(n[0-9a-f]{12})$/i);
    if (!m) return null;
    const user = (s.match(/note\.com\/([A-Za-z0-9_]+)\/n\//i) || [])[1] || null;
    return { key: m[1].toLowerCase(), user };
  }
  /* 欄の中身が URL 1本だけか(それ以外は本文として数える) */
  function looksLikeUrl(input) {
    const s = String(input || '').trim().replace(/^[<「『(]+|[>」』)]+$/g, '');
    if (!s) return false;
    if (!/\s/.test(s) && (/^https?:\/\//i.test(s) || /^(?:www\.)?note\.com\//i.test(s) || /^n[0-9a-f]{12}$/i.test(s))) return true;
    // note の共有文(題+URL)も URL として扱う。見分けるのは URL の位置: 共有文では URL が端(先頭か末尾。
    // 末尾の #タグ・@handle は端とみなす)にあり、下書きでは文の間に挟まる。句読点では見分けない
    // (「…儲かる?」「…420万円。それでも…」のような題が落ちるため。2026-09-26 コード照合)
    const m = s.match(/https?:\/\/[!-~]*\/n\/n[0-9a-f]{12}[!-~]*/i);   // URL の後ろは ASCII だけ(くっついた日本語を飲み込まない)
    if (!m) return false;
    const tail = s.slice(m.index + m[0].length);
    const atEnd = /^(?:\s+[#@]\S+)*\s*$/.test(tail);
    if (m.index !== 0 && !atEnd) return false;
    const rest = atEnd ? s.slice(0, m.index) : tail;
    // 「題|著者名」の形は、縦棒より後ろ(著者名・@handle・#note)を外して、題の部分で数える
    const lines = rest.split(/\r?\n/).map(l => l.split(/[｜|]/)[0].trim()).filter(Boolean);
    return lines.length <= 2 && lines.join('').length <= SHARE_TITLE_MAX;
  }

  /* ================================================================
     スキから見た目安。記事の一覧とスキから、読み手ごとの「相対スキ」の中央値を出す
     items: [{ key, date:'YYYY-MM-DD', story, paid, main:{who,topic}, top:{who,topic}, generalLead }]
     likes: { key: 数 }、asOf: 'YYYY-MM-DD'
     ================================================================ */
  const dayNum = d => Math.floor(Date.parse(d + 'T00:00:00Z') / 86400000);
  function median(xs) {
    if (!xs.length) return null;
    const a = xs.slice().sort((x, y) => x - y);
    const m = a.length >> 1;
    return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
  }
  function quantile(xs, q) {
    if (!xs.length) return null;
    const a = xs.slice().sort((x, y) => x - y);
    const pos = (a.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return a[lo] + (a[hi] - a[lo]) * (pos - lo);
  }
  // 記事が「その読み手の記事」に数えられるのは、宛先の上位(職種は総称を含む)に入ったとき
  function segsOf(it) {
    return [].concat(it.generalLead ? ['general'] : [], (it.top && it.top.who) || [], (it.top && it.top.topic) || []);
  }
  const countable = (it, likes, today) => !it.story && !it.paid && !it.missing && likes[it.key] != null && today - dayNum(it.date) >= SETTLE_DAYS;
  function relativeLikes(items, likes, asOf) {
    const today = dayNum(asOf);
    const settled = items.filter(it => countable(it, likes, today));
    const rel = {};
    const near = {};
    for (const it of settled) {
      const d = dayNum(it.date);
      let nb = settled.filter(o => o !== it && Math.abs(dayNum(o.date) - d) <= WINDOW);
      if (nb.length < MIN_NEIGHBORS) nb = settled.filter(o => o !== it && Math.abs(dayNum(o.date) - d) <= WINDOW_WIDE);
      if (nb.length < MIN_NEIGHBORS) continue;
      const med = median(nb.map(o => likes[o.key]));
      rel[it.key] = Math.round((likes[it.key] + 1) / (med + 1) * 100) / 100;
      near[it.key] = nb;
    }
    return { rel, near };
  }
  // 三分法: 本数が足りなければ「まだ判定できない」
  function verdictOf(n, med, above, below) {
    if (below == null) below = n - above;
    if (n < MIN_N || med == null) return 'unknown';
    if (med >= MORE && above / n >= CONSISTENT) return 'more';
    if (med <= LESS && below / n >= CONSISTENT) return 'less';
    return 'same';
  }
  function calibrate(items, likes, asOf) {
    const { rel, near } = relativeLikes(items, likes, asOf);
    const today = dayNum(asOf);
    const r2 = x => x == null ? null : Math.round(x * 100) / 100;
    const bySeg = {};
    for (const id of SEG_IDS) {
      const mine = items.filter(it => !it.story && segsOf(it).includes(id));
      // 窓がその読み手の記事で埋まっている記事は、比べる相手がいないので入れない
      const usable = mine.filter(it => rel[it.key] != null && near[it.key].filter(o => !segsOf(o).includes(id)).length >= MIN_OTHER);
      const xs = usable.map(it => rel[it.key]);
      const med = median(xs);
      const above = xs.filter(x => x > 1).length;
      const below = xs.filter(x => x < 1).length;
      bySeg[id] = {
        n: xs.length, above, below, total: mine.length,
        median: r2(med), q1: r2(quantile(xs, 0.25)), q3: r2(quantile(xs, 0.75)),
        verdict: verdictOf(xs.length, med, above, below),
      };
    }
    return {
      asOf,
      counted: Object.keys(rel).length,
      stories: items.filter(it => it.story).length,
      paid: items.filter(it => it.paid && !it.story).length,
      missing: items.filter(it => it.missing && !it.story).length,
      settling: items.filter(it => !it.story && today - dayNum(it.date) < SETTLE_DAYS).length,
      rel, bySeg,
    };
  }

  /* ================================================================
     いつもとの差。自分の記事(物語を除く)の平均の割合と比べ、差が CONTRAST 以上の読み手だけを返す。
     リハ職の言葉はほぼ毎回多いので、宛先の一文は毎回似る。差のほうが、その記事の特徴を言える
     baseline: { who: {id: 平均の割合}, topic: {...} }(取り込みで焼く)
     ================================================================ */
  function baselineOf(shares) {
    const out = {};
    for (const axis of AXES) {
      const ids = Object.keys(axis.segments);
      out[axis.id] = Object.fromEntries(ids.map(id => [id, shares.length ? Math.round(shares.reduce((a, s) => a + ((s[axis.id] || {})[id] || 0), 0) / shares.length * 1000) / 1000 : 0]));
    }
    return out;
  }
  function contrast(share, baseline) {
    const more = [];
    const less = [];
    for (const axis of AXES) {
      for (const id of Object.keys(axis.segments)) {
        const now = (share[axis.id] || {})[id] || 0;
        const base = (baseline[axis.id] || {})[id] || 0;
        const d = now - base;
        if (d >= CONTRAST) more.push({ id, axis: axis.id, now, base });
        else if (d <= -CONTRAST && base >= CONTRAST_BASE) less.push({ id, axis: axis.id, now, base });
      }
    }
    const by = (a, b) => Math.abs(b.now - b.base) - Math.abs(a.now - a.base);
    return { more: more.sort(by), less: less.sort(by) };
  }

  const ENGINE = {
    ENGINE_REV, FINGERPRINT, SEGS, SEG_IDS, WHO_IDS, TOPIC_IDS,
    MIN_RAW, MIN_N, SETTLE_DAYS, MORE, LESS, WINDOW, SHARE_TITLE_MAX,
    normalize, htmlToText, splitSentences, scan, analyze, stripLines, boilerplateOf, readerOf, readTitle, parseNoteUrl, looksLikeUrl, isStory,
    relativeLikes, calibrate, verdictOf, median, quantile, segsOf, baselineOf, contrast,
  };
  if (typeof module === 'object' && module.exports) module.exports = ENGINE;
  else root.ATESAKI_ENGINE = ENGINE;
})(typeof window !== 'undefined' ? window : globalThis);
