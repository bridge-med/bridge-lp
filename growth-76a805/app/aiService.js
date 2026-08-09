/* =========================================================================
 * Growth OS — aiService.js
 * AI変換の「サービス層」。画面(app.js)はこの層だけを呼ぶ。
 *
 *   templatesFor(kind): Template[]            // kind: "worklog"|"idea"|"project"|"week"
 *   convert(templateId, source): Promise<ConvertResult>
 *
 * プロバイダ切り替え式(APIキーはフロントに置かない。やわ返 replyService.js と同じ設計):
 *     画面 → 本サービス → 自前API(Cloudflare Worker) → LLM
 *   provider が 'remote' かつ endpoint が設定されていれば自前APIを叩く。
 *   未設定/失敗時は必ずテンプレート生成(mock)にフォールバックするので、体験は止まらない。
 *
 * ▼ 連携を有効にする手順(コードを触らず端末だけで切り替える場合)
 *     localStorage['growth:endpoint'] = 'https://....workers.dev'
 *     localStorage['growth:provider'] = 'remote'
 *   Workerへは POST { templateId, system, prompt, source } を送り、
 *   { sections: [{h, body}] } が返ることを期待する。形式が違えばmockで補う。
 *
 * 型(参考):
 *   Template      : { id, label, kinds[], note, output[] }   // outputは見出しの並び
 *   ConvertResult : { templateId, label, provider, sections:[{h, body}], text }
 * ========================================================================= */
(function (global) {
  'use strict';

  // 'mock'(既定・外部API不要) | 'remote'(自前API経由でLLM)
  const AI_PROVIDER = 'mock';
  const AI_ENDPOINT = '';

  function provider() {
    try { return global.localStorage.getItem('growth:provider') || AI_PROVIDER; }
    catch (e) { return AI_PROVIDER; }
  }
  function endpoint() {
    try { return global.localStorage.getItem('growth:endpoint') || AI_ENDPOINT; }
    catch (e) { return AI_ENDPOINT; }
  }
  function useRemote() { return provider() === 'remote' && !!endpoint(); }

  /* ---- プロンプトの基本方針(remote時にWorkerへ渡す。mockでは未使用) ---- */
  const SYSTEM_PROMPT =
    'あなたはGrowth OSのアシスタントです。ユーザーの仕事・思考・経験を、あとで使える形に変換します。\n' +
    '方針: 抽象論で終わらせない / 次にやる1アクションまで落とす / 売れる可能性と作りやすさを分けて考える / ' +
    'ユーザーの経験をコンテンツの素材として扱う / きれいごとより現実的な実行案を優先する / ' +
    '出力は指定された見出しごとのJSON({sections:[{h,body}]})で返す / 日本語で書く。';

  /* ---- 変換テンプレート(唯一の情報源。メニューもここから描画する) ----
     kinds: このテンプレートを適用できる素材の種類。weekは素材を選ばない週次振り返り。 */
  const TEMPLATES = [
    { id: 'learning',       label: '学びを抽出する',        kinds: ['worklog'],                    note: '今日の記録を、再利用できる知見に整理します',
      output: ['今日やったこと', '詰まったこと', '得た学び', '次に活かすこと', '再利用できる知見', '1行まとめ'] },
    { id: 'note-idea',      label: 'note構成にする',        kinds: ['worklog', 'idea'],            note: '想定読者と目次、有料部分の切り口まで出します',
      output: ['想定読者', '読者の悩み', 'タイトル案', '導入文', '目次', '有料部分の切り口', '価格案', '売るための一言'] },
    { id: 'note-draft',     label: '500円noteの下書きにする', kinds: ['worklog', 'idea'],          note: '最小の有料noteとして出せる下書きを作ります',
      output: ['タイトル案', '導入文', '無料部分', '有料部分の構成', '締めの一文', '価格案'] },
    { id: 'x-post',         label: 'X投稿にする',           kinds: ['worklog', 'idea'],            note: 'そのまま投稿できる形に切り出します',
      output: ['投稿案1', '投稿案2', '投稿案3'] },
    { id: 'lp-outline',     label: 'LP構成にする',          kinds: ['worklog', 'idea'],            note: '販売ページの構成案に変換します',
      output: ['見出しコピー', '誰の何を解決するか', '提供内容', '価格と提供形式', 'よくある不安への答え', '申し込み導線'] },
    { id: 'product-design', label: '商品設計にする',        kinds: ['idea', 'worklog'],            note: '最小販売版と作る順番まで具体化します',
      output: ['商品名', '誰向けか', '解決する悩み', '商品内容', '価格案', '最小販売版', '作る順番', '初回販売導線'] },
    { id: 'tasks',          label: 'タスクに分解する',      kinds: ['worklog', 'idea', 'project'], note: '止まらない粒度の作業に分けます',
      output: ['タスク'] },
    { id: 'projectize',     label: 'プロジェクト化する',    kinds: ['worklog', 'idea'],            note: 'ゴールと次アクションを持つプロジェクトにします',
      output: ['プロジェクト名', '目的', 'ゴール', '最初の1週間でやること', '次の1アクション'] },
    { id: 'revenue-plan',   label: '収益化プランにする',    kinds: ['worklog', 'idea', 'project'], note: '売り方と検証の順番を整理します',
      output: ['収益化の切り口', '想定商品', '価格帯', '販売チャネル', '最初の検証', '売れなかったときの次の手'] },
    { id: 'next-action',    label: '次アクションを出す',    kinds: ['project'],                    note: '止まっている理由を外し、今週動ける形にします',
      output: ['現状', 'ゴール', '止まっている理由', '次の1アクション', '30分でできること', '今週やること', '捨てていいこと'] },
    { id: 'weekly-review',  label: '1週間の振り返りにする', kinds: ['week'],                       note: '直近7日の記録から来週のFocusを出します',
      output: ['今週進んだこと', '今週の詰まり', '再利用できる学び', 'コンテンツ化候補', '収益化候補', '来週のFocus', '来週の3タスク'] }
  ];

  function templates() { return TEMPLATES.slice(); }
  function templatesFor(kind) { return TEMPLATES.filter((t) => t.kinds.indexOf(kind) >= 0); }
  function getTemplate(id) { return TEMPLATES.find((t) => t.id === id) || null; }

  /* ---- 公開API: 変換の実行 ---- */
  function convert(templateId, source) {
    const tpl = getTemplate(templateId);
    if (!tpl) return Promise.reject(new Error('unknown template: ' + templateId));
    if (useRemote()) return callRemote(tpl, source);
    // mock: 体感のため、わずかな遅延を入れて「変換中」を見せる
    return delay(380).then(() => finish(tpl, mockSections(tpl, source), 'mock'));
  }

  function finish(tpl, sections, prov) {
    return {
      templateId: tpl.id,
      label: tpl.label,
      provider: prov,
      sections,
      text: sections.map((s) => '## ' + s.h + '\n' + s.body).join('\n\n')
    };
  }

  /* ---- remote(自前API)。失敗時はmockにフォールバック ---- */
  function buildPrompt(tpl, source) {
    return [
      '次の素材を「' + tpl.label + '」に変換してください。',
      '出力する見出し: ' + tpl.output.join(' / '),
      '素材(' + (source.kind || '') + '):',
      JSON.stringify(source, null, 2)
    ].join('\n');
  }

  function callRemote(tpl, source) {
    return fetch(endpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateId: tpl.id, system: SYSTEM_PROMPT, prompt: buildPrompt(tpl, source), source })
    })
      .then((r) => { if (!r.ok) throw new Error('bad status ' + r.status); return r.json(); })
      .then((data) => {
        if (!data || !Array.isArray(data.sections) || !data.sections.length) {
          return finish(tpl, mockSections(tpl, source), 'mock');
        }
        return finish(tpl, data.sections, 'remote');
      })
      .catch(() => finish(tpl, mockSections(tpl, source), 'mock')); // 不通でも体験を止めない
  }

  /* =========================================================================
   * mock生成: 素材の項目からテンプレート出力を組み立てる。
   * 高精度ではなく「一連の流れが成立し、そのまま直せば使える下書き」を優先。
   * ========================================================================= */
  function mockSections(tpl, source) {
    const s = source || {};
    switch (tpl.id) {
      case 'learning':       return mockLearning(s);
      case 'note-idea':      return mockNoteIdea(s);
      case 'note-draft':     return mockNoteDraft(s);
      case 'x-post':         return mockXPost(s);
      case 'lp-outline':     return mockLp(s);
      case 'product-design': return mockProduct(s);
      case 'tasks':          return mockTasks(s);
      case 'projectize':     return mockProjectize(s);
      case 'revenue-plan':   return mockRevenuePlan(s);
      case 'next-action':    return mockNextAction(s);
      case 'weekly-review':  return mockWeeklyReview(s);
      default: return [{ h: '結果', body: '(このテンプレートの生成は未実装です)' }];
    }
  }

  /* ---- 素材の読み口(worklog/idea/projectの項目差を吸収する) ---- */
  const t = (v, fallback) => (v && String(v).trim()) || fallback || '';
  const title = (s) => t(s.title, '(無題)');
  const gist = (s) => t(s.body) || t(s.solution) || t(s.description) || t(s.mainMessage) || title(s);
  const insight = (s) => t(s.reusableInsight) || t(s.learnings) || t(s.solution) || gist(s);
  const audience = (s) => t(s.targetUser) || t(s.targetAudience) || audienceFromCategory(s.category);
  const problem = (s) => t(s.problem) || t(s.blockers) || '「' + title(s) + '」で扱う場面を前に、何から手を付けるか決めきれないこと';
  const price = (s) => t(s.priceIdea, '500円〜1,980円');
  const channel = (s) => t(s.salesChannel, 'note');

  function audienceFromCategory(cat) {
    if (cat === '医療経営') return '医療機関の事務長・経営企画・管理職';
    if (cat === 'AI開発' || cat === '副業') return 'AIや副業に関心のある専門職・会社員';
    if (cat === 'マネジメント') return '初めて部下を持った現場の管理職';
    if (cat === '学習') return '働きながら学び直しをしている社会人';
    return '同じ仕事の進め方で悩んでいる実務者';
  }

  /* ---- 各テンプレートの生成 ---- */
  function mockLearning(s) {
    return [
      { h: '今日やったこと', body: gist(s) },
      { h: '詰まったこと', body: t(s.blockers, '（つまずきの記録なし。思い出したら書き足す）') },
      { h: '得た学び', body: t(s.learnings, insight(s)) },
      { h: '次に活かすこと', body: '次に同じ場面が来たら、まず「' + shortInsight(s) + '」から始める。' },
      { h: '再利用できる知見', body: insight(s) },
      { h: '1行まとめ', body: title(s) + ' — ' + shortInsight(s) }
    ];
  }

  function shortInsight(s) {
    const x = insight(s).replace(/\s+/g, ' ');
    return x.length > 40 ? x.slice(0, 40) + '…' : x;
  }

  function mockNoteIdea(s) {
    const aud = audience(s);
    return [
      { h: '想定読者', body: aud },
      { h: '読者の悩み', body: problem(s) },
      { h: 'タイトル案', body: '・' + title(s) + 'で分かったこと\n・「' + shortInsight(s) + '」を先に知りたかった\n・' + aud.split('・')[0] + 'のための' + title(s) },
      { h: '導入文', body: '先日、' + gist(s).slice(0, 60) + '——という場面がありました。この記事では、そのとき実際にやったことと、あとから使える形にした手順を書きます。' },
      { h: '目次', body: '1. 前提と状況\n2. 実際にやったこと\n3. 詰まったところと対処\n4. 再利用できる形にした手順(有料)\n5. まとめと次の一歩' },
      { h: '有料部分の切り口', body: '「' + insight(s) + '」を、読者が自分の職場でそのまま試せるチェックリストまたは手順書の形で渡す。' },
      { h: '価格案', body: price(s) },
      { h: '売るための一言', body: '同じ場面で調べ直す時間を考えると、先にこの手順を持っておくほうが早いです。' }
    ];
  }

  function mockNoteDraft(s) {
    return [
      { h: 'タイトル案', body: '【実務メモ】' + title(s) + ' — 現場でやったことを手順にしました' },
      { h: '導入文', body: 'この記事は、実際の業務でやったことの記録です。' + gist(s).slice(0, 50) + '——同じ状況の方が、調べ直さずに済むように書きました。' },
      { h: '無料部分', body: '・どんな状況だったか\n・何が難しかったか(' + t(s.blockers, '判断材料が揃っていなかったこと') + ')\n・結論だけ先に: ' + shortInsight(s) },
      { h: '有料部分の構成', body: '1. 実際の手順(やった順)\n2. 使った一覧・チェック項目\n3. 失敗しやすいポイント\n4. そのまま流用できるテンプレート' },
      { h: '締めの一文', body: 'ここまで読んでいただき、ありがとうございました。同じ場面の方の時間が少しでも浮けば幸いです。' },
      { h: '価格案', body: '500円(まず最小で出して、反応を見て改訂する)' }
    ];
  }

  function mockXPost(s) {
    const ins = shortInsight(s);
    return [
      { h: '投稿案1', body: title(s) + '。\nやってみて分かったのは、' + ins + '、ということ。\n同じ場面の人の参考になれば。' },
      { h: '投稿案2', body: '今日の学び。\n' + ins + '\n先にこれを知っていたら、たぶん半分の時間で済んだ。' },
      { h: '投稿案3', body: problem(s).slice(0, 40) + '——という悩み、実は手順にできます。\n近いうちにnoteにまとめる予定。' }
    ];
  }

  function mockLp(s) {
    return [
      { h: '見出しコピー', body: title(s) + 'を、調べ直さずに進められる形で' },
      { h: '誰の何を解決するか', body: audience(s) + 'の「' + problem(s) + '」を解決する。' },
      { h: '提供内容', body: insight(s) + '——これを、そのまま使える手順書・チェックリストにして渡す。' },
      { h: '価格と提供形式', body: price(s) + ' / PDFまたはnote限定公開' },
      { h: 'よくある不安への答え', body: '・自分の職場に合うか → 汎用の型+置き換え欄で調整できる形にする\n・買って終わりにならないか → 最初の1アクションを冒頭に置く' },
      { h: '申し込み導線', body: channel(s) + 'で販売。まず無料部分(記事・投稿)から流入させる。' }
    ];
  }

  function mockProduct(s) {
    return [
      { h: '商品名', body: title(s) },
      { h: '誰向けか', body: audience(s) },
      { h: '解決する悩み', body: problem(s) },
      { h: '商品内容', body: gist(s) },
      { h: '価格案', body: price(s) },
      { h: '最小販売版', body: '本体から一番使う1章だけを切り出し、' + channel(s) + 'で先に出す。作り込みは反応を見てから。' },
      { h: '作る順番', body: '1. 目次と全体像\n2. 一番価値のある1章(最小販売版)\n3. 販売文(LP・記事)\n4. 残りの章\n5. 購入者の反応で改訂' },
      { h: '初回販売導線', body: '無料の記事・投稿で悩みに触れる → 最小販売版へ誘導 → 購入者の声を次の販売文に使う。' }
    ];
  }

  function mockTasks(s) {
    const base = title(s);
    const next = t(s.nextValidationAction) || t(s.nextAction);
    const lines = [];
    if (next) lines.push(next);
    lines.push(
      base + 'の目的と完成条件を3行で書く',
      '素材(記録・資料・数字)を1か所に集める',
      '最初の下書き・たたき台を30分で作る',
      'たたき台を見て、削るもの・足りないものを決める',
      '公開または誰かに見せる形まで仕上げる'
    );
    return [{ h: 'タスク', body: lines.map((l) => '・' + l).join('\n') }];
  }

  function mockProjectize(s) {
    return [
      { h: 'プロジェクト名', body: title(s) },
      { h: '目的', body: problem(s) + 'を、' + insight(s).slice(0, 40) + 'という形で解決する。' },
      { h: 'ゴール', body: '最小版を1つ完成させ、' + channel(s) + 'で公開する。' },
      { h: '最初の1週間でやること', body: '・完成条件を決める\n・素材を集める\n・たたき台を1つ作る' },
      { h: '次の1アクション', body: t(s.nextValidationAction) || '完成条件を3行で書く(30分)' }
    ];
  }

  function mockRevenuePlan(s) {
    return [
      { h: '収益化の切り口', body: insight(s) + '——これを「調べ直す時間の節約」として売る。' },
      { h: '想定商品', body: '手順書・チェックリスト・テンプレートのいずれか。素材は「' + title(s) + '」。' },
      { h: '価格帯', body: price(s) + '(最小版は500円から)' },
      { h: '販売チャネル', body: channel(s) + '(無料の記事・投稿から誘導する)' },
      { h: '最初の検証', body: '売る前に、目次だけを公開して反応を見る。保存・返信が付けば本文を作る。' },
      { h: '売れなかったときの次の手', body: '価格ではなく「誰の悩みか」を先に疑う。想定読者を1段具体化して販売文だけ書き直す。' }
    ];
  }

  function mockNextAction(s) {
    return [
      { h: '現状', body: t(s.description) || gist(s) },
      { h: 'ゴール', body: t(s.goal, 'まだ言葉になっていません。まず完成条件を3行で書くところからです。') },
      { h: '止まっている理由', body: s.status === '停滞' ? '次の一手が大きすぎる可能性があります。30分で終わる粒度まで割ります。' : '記録の上では止まっていません。次の一手を小さく保てるか確認する。' },
      { h: '次の1アクション', body: t(s.nextAction, '完成条件を3行で書く') },
      { h: '30分でできること', body: '素材(過去の記録・資料)を1か所に集めて、目次だけ作る。' },
      { h: '今週やること', body: '・' + t(s.nextAction, '完成条件を書く') + '\n・たたき台を1つ作る\n・誰かに見せる、または公開する' },
      { h: '捨てていいこと', body: '完璧な下調べと、今週使わない資料づくり。' }
    ];
  }

  /** 週次振り返り: sourceは {kind:'week', worklogs[], content[], ideas[]} を受け取る */
  function mockWeeklyReview(s) {
    const logs = s.worklogs || [];
    const titles = logs.map((w) => '・' + w.title).join('\n') || '・(この1週間の記録はありません)';
    const blockers = logs.map((w) => t(w.blockers)).filter(Boolean).map((b) => '・' + b).join('\n') || '・大きな詰まりの記録はありません';
    const insights = logs.map((w) => t(w.reusableInsight) || t(w.learnings)).filter(Boolean).map((b) => '・' + b).join('\n') || '・(学びの記録がまだありません)';
    const contentCand = logs.filter((w) => w.contentPotential === '高' || w.contentPotential === '中').map((w) => '・' + w.title).join('\n') || '・(候補なし。contentPotentialを付けると拾えます)';
    const revenueCand = logs.filter((w) => w.revenuePotential === '高' || w.revenuePotential === '中').map((w) => '・' + w.title).join('\n') || '・(候補なし)';
    const top = logs[0];
    return [
      { h: '今週進んだこと', body: titles },
      { h: '今週の詰まり', body: blockers },
      { h: '再利用できる学び', body: insights },
      { h: 'コンテンツ化候補', body: contentCand },
      { h: '収益化候補', body: revenueCand },
      { h: '来週のFocus', body: top ? '「' + top.title + '」の流れを止めないこと。1本、形にして出すところまで。' : 'まず記録を1本つけるところから。' },
      { h: '来週の3タスク', body: '・記録の中で一番反応が読めるものを1つ選ぶ\n・それを30分でたたき台にする\n・公開または誰かに見せる' }
    ];
  }

  /* ---- 小物 ---- */
  function delay(ms) { return new Promise((res) => setTimeout(res, ms)); }

  /* ---- 公開 ---- */
  global.GrowthAI = {
    get provider() { return provider(); },
    get endpoint() { return endpoint(); },
    get usingRemote() { return useRemote(); },
    templates, templatesFor, getTemplate,
    convert,
    // テスト/将来用に内部も公開
    _buildPrompt: buildPrompt,
    _mockSections: mockSections,
    SYSTEM_PROMPT
  };
})(window);
