/* =========================================================================
 * OWNER OS — ai.js
 * 「次の一手」の下書きを用意するサービス層。
 *
 * 方針:
 * - 既定はルールベースのモック(provider: 'mock')。外部送信なし。
 * - 後から実API(Anthropic / OpenAI)へ差し替えられるよう、
 *   provider を関数テーブルで分離してある。UI は AI.suggest / AI.reflect /
 *   AI.composeRequest / AI.composeReminder だけを呼ぶ。
 * - 実APIを使う場合も、返却形(Suggestion / ReflectionDraft)は同じ。
 *
 * 型(参考):
 *   Suggestion = {
 *     classification,          // 'decide'|'ask'|'delegate'|'hold'
 *     suggestedRole,           // 推奨する担当者の役割(文字列)
 *     userRole,                // 利用者本人が担うべき役割
 *     nextStep,                // 次の一手(1行)
 *     discussionPoints: [],    // 確認すべき論点
 *     suggestedDueDays,        // 推奨期限(今日から何日後か)
 *     completionCriteria,      // 完了条件の下書き
 *     note                     // 出どころの説明(「ルールベースの下書きです」等)
 *   }
 *   ReflectionDraft = { fact, interpretation, emotion, actualIssue, nextAction, prevention }
 * ========================================================================= */
(function (global) {
  'use strict';

  /* ---------------------------------------------------------------
   * ルール辞書: タスク文面からドメインを推定する。
   * match: いずれかの語を含めば適用。先勝ち。
   * --------------------------------------------------------------- */
  var RULES = [
    {
      match: ['麻薬', '向精神薬'],
      classification: 'ask',
      suggestedRole: '麻薬管理や行政手続きに詳しい担当者',
      nextStep: '確認論点を整理して担当者へ渡し、回答期限を決める',
      userRole: '確認論点を整理し、担当者と期限を設定し、回答後に意思決定する',
      points: ['麻薬小売業者免許等の手続き要否', '拠点変更時の届出', '譲渡または廃棄の要否', '実施期限', '必要書類', '管轄行政機関'],
      dueDays: 7,
      criteria: '必要な手続き・届出・書類・期限が一覧で明確になっていること'
    },
    {
      match: ['契約', 'リース', '賃貸借'],
      classification: 'delegate',
      suggestedRole: '法務担当、または契約実務に詳しい担当者',
      nextStep: '契約先の一覧化を依頼し、巻き直し方針を決める場を設定する',
      userRole: '巻き直しの方針(承継か再契約か)を最終決定する',
      points: ['対象契約の一覧', '承継できる契約と再契約が必要な契約の区別', '相手方への通知時期', '費用や条件が変わる契約の有無'],
      dueDays: 10,
      criteria: '契約先一覧と巻き直し方針が決まり、関係者に共有されている状態'
    },
    {
      match: ['届出', '行政', '保健所', '厚生局'],
      classification: 'ask',
      suggestedRole: '行政手続きの担当者',
      nextStep: '必要な届出の洗い出しを依頼し、期限つきの一覧にする',
      userRole: '届出一覧を確認し、優先順位と担当を決める',
      points: ['必要な届出の種類', '提出先(保健所・厚生局・自治体)', '提出期限', '必要書類と添付物', '事前相談の要否'],
      dueDays: 7,
      criteria: '届出の一覧に提出先・期限・担当者が入っている状態'
    },
    {
      match: ['配置', 'シフト', '人員', '採用'],
      classification: 'delegate',
      suggestedRole: '現場の責任者(看護責任者・部門長など)',
      nextStep: '現状の勤務体制の共有を依頼し、配置案の作成を任せる',
      userRole: '配置案を承認し、調整が必要な点だけ判断する',
      points: ['現状の人員と勤務形態', '統合後に必要な体制', '異動や勤務条件の変更有無', '本人への説明時期'],
      dueDays: 10,
      criteria: '配置案が現場責任者との合意つきでまとまっている状態'
    },
    {
      match: ['説明', '周知', '共有会', '面談'],
      classification: 'decide',
      suggestedRole: '(実施は自分。資料確認は関係者に依頼)',
      nextStep: '説明する内容の骨子を自分で決め、資料化は必要に応じて任せる',
      userRole: '何をどこまで伝えるかを決める(これは委任できない判断)',
      points: ['伝える相手と順番', '伝える内容と伝えない内容', '想定される質問への回答', '説明の時期と場'],
      dueDays: 5,
      criteria: '説明内容が固まり、関係者の確認を得ている状態'
    },
    {
      match: ['移行', 'データ', 'カルテ', 'システム'],
      classification: 'ask',
      suggestedRole: 'システム担当、またはベンダー窓口',
      nextStep: '移行範囲と制約を確認し、スケジュールの叩き台を依頼する',
      userRole: '移行範囲と切替時期を最終決定する',
      points: ['移行対象データの範囲', '移行できないデータの扱い', '切替時期と停止時間', '費用', '同意取得の要否'],
      dueDays: 7,
      criteria: '移行範囲・時期・制約が文書で確認できている状態'
    },
    {
      match: ['レセプト', '請求', '算定'],
      classification: 'ask',
      suggestedRole: '医事担当',
      nextStep: '支払基金・国保連への確認事項を整理して依頼する',
      userRole: '確認結果をもとに運用方針を決める',
      points: ['請求に使う機関コード', '切替月の請求方法', '返戻時の対応', '施設基準の引き継ぎ'],
      dueDays: 7,
      criteria: '切替月の請求方法が文書で確認できている状態'
    },
    {
      match: ['機器', '設備', '移設'],
      classification: 'ask',
      suggestedRole: '行政手続き担当、またはメーカー窓口',
      nextStep: '移設に伴う届出と工事要否の確認を依頼する',
      userRole: '移設スケジュールを決め、診療への影響を判断する',
      points: ['届出が必要な機器の一覧', '移設工事の要否と時期', '停止期間中の診療への影響', '費用'],
      dueDays: 10,
      criteria: '機器ごとの届出要否と移設時期が一覧になっている状態'
    }
  ];

  /* 分類だけを推定する軽いルール(辞書に当たらなかったとき) */
  function guessClassification(text) {
    if (/確認|聞く|問い合わせ|教えて|不明/.test(text)) return 'ask';
    if (/依頼|任せ|作成|対応|調整|手配/.test(text)) return 'delegate';
    if (/決める|決定|判断|方針|承認/.test(text)) return 'decide';
    if (/いつか|そのうち|後で|保留/.test(text)) return 'hold';
    return 'ask';
  }

  var GENERIC = {
    decide: {
      suggestedRole: '(判断は自分。材料集めは担当者に依頼できます)',
      nextStep: '判断に必要な材料と、いつまでに決めるかを書き出す',
      userRole: '選択肢を比較し、期限までに決めて関係者へ伝える',
      points: ['何を決めれば次に進めるか', '判断に足りない材料は何か', '決めたことを誰に伝えるか'],
      dueDays: 3,
      criteria: '決定内容が関係者に伝わっている状態'
    },
    ask: {
      suggestedRole: 'この内容に最も詳しい担当者',
      nextStep: '「何が分かれば進めるか」を一文にして、期限つきで質問する',
      userRole: '質問を短くまとめ、回答期限を決め、回答後に判断する',
      points: ['何が分かれば次へ進めるか', '誰が最も早く正確に答えられるか', 'いつまでに回答が必要か'],
      dueDays: 5,
      criteria: '質問への回答が得られ、次の判断ができる状態'
    },
    delegate: {
      suggestedRole: '実行に最も適した担当者',
      nextStep: '完了条件と期限を決めて、担当者へ依頼する',
      userRole: '完了条件と期限を示し、途中の確認日を決めて見守る',
      points: ['完了条件は何か', 'いつまでに必要か', '途中で確認するタイミング'],
      dueDays: 7,
      criteria: '成果物が完了条件を満たしている状態'
    },
    hold: {
      suggestedRole: '(今は動かさない)',
      nextStep: '保留の理由と、再確認する日を決めて記録する',
      userRole: '意図的な保留であることを明確にし、再確認日に見直す',
      points: ['なぜ今やらないのか', 'いつになれば判断できるのか', '放置と保留の区別がついているか'],
      dueDays: 14,
      criteria: '再確認日に状況を見て、進める・やめるを判断できる状態'
    }
  };

  var MOCK_NOTE = 'この下書きはルールベースで作っています。内容は必ず自分で確かめてから使ってください。';

  /* ---------------------------------------------------------------
   * provider: mock
   * --------------------------------------------------------------- */
  function mockSuggest(taskLike) {
    var text = (taskLike.title || '') + ' ' + (taskLike.description || '');
    var rule = null;
    for (var i = 0; i < RULES.length; i++) {
      if (RULES[i].match.some(function (w) { return text.indexOf(w) >= 0; })) { rule = RULES[i]; break; }
    }
    var cls = rule ? rule.classification : guessClassification(text);
    var base = rule || GENERIC[cls];
    return Promise.resolve({
      classification: cls,
      suggestedRole: base.suggestedRole,
      userRole: base.userRole,
      nextStep: base.nextStep,
      discussionPoints: base.points.slice(),
      suggestedDueDays: base.dueDays,
      completionCriteria: base.criteria,
      note: MOCK_NOTE
    });
  }

  /* 感情と行動の分解(ルールベースの下書き) */
  function mockReflect(raw) {
    var text = String(raw || '').trim();

    var emotions = [];
    var EMO = [
      [/不安|心配|こわい|怖い/, '不安'],
      [/悔し|くやし/, '悔しさ'],
      [/萎縮|自信がな|自己否定|だめ|ダメ/, '自信のなさ'],
      [/焦り|あせり|間に合わない/, '焦り'],
      [/腹立|イライラ|苛立|むかつ/, '苛立ち'],
      [/疲れ|しんどい|つらい|辛い/, '疲れ'],
      [/申し訳|すまない|罪悪感/, '申し訳なさ'],
      [/恥ずかし/, '恥ずかしさ']
    ];
    EMO.forEach(function (e) { if (e[0].test(text)) emotions.push(e[1]); });

    // 「〜と言われた」「〜と指摘された」は事実の核になりやすい
    var factMatch = text.match(/「?([^「」。]+)」?と(言われた|指摘された|聞かれた|注意された)/);
    var fact = factMatch
      ? '「' + factMatch[1] + '」と' + factMatch[2] + '。'
      : '(何があったかを、評価を入れずに一文で書いてみてください)';

    var interpretation = /期待に応え|できていない|足りない|向いていない|失望/.test(text)
      ? '「期待に応えられていない」という意味づけが混じっているかもしれません。事実と、そこに付けた意味は、分けて見られます。'
      : '(出来事に対して、自分がどんな意味づけをしたかを書いてみてください)';

    // 課題の推定
    var issue, action, prevention;
    if (/遅|後回し|放置|溜め/.test(text)) {
      issue = '着手や判断のタイミングが遅れている可能性があります。能力ではなく、初動の仕組みの問題として扱えます。';
      action = '止まっているタスクを1件だけ選び、今日中に「決める・聞く・任せる・保留」のどれかに分類する。';
      prevention = 'タスクを受けたら24時間以内に4分類だけ済ませる、を運用ルールにする。';
    } else if (/任せ|委任|抱え|自分でやった方/.test(text)) {
      issue = '実行を抱え込み、委任の初動が遅れている可能性があります。';
      action = '自分がボールを持っているタスクから、他の人に渡せるものを1件選んで依頼する。';
      prevention = '「自分で決める」以外のタスクは、担当者と期限を決めるまでを自分の仕事と定義する。';
    } else if (/オーナーシップ|当事者意識|主体性/.test(text)) {
      issue = '求められているのは「全部自分でやること」ではなく、担当と期限を決めてプロジェクトを前に進めることかもしれません。';
      action = '担当者か期限が決まっていないタスクを洗い出し、今日2件だけ設定する。';
      prevention = '週1回、担当者未設定・期限なしのタスクがないかを確認する時間を決める。';
    } else {
      issue = '(感情を除いたとき、実際に困っている行動上の問題を一つ挙げてみてください)';
      action = '(明日までにできる、最も小さい一歩を書いてみてください)';
      prevention = '(同じ状況を減らすための、仕組みの工夫を一つ書いてみてください)';
    }

    return Promise.resolve({
      fact: fact,
      interpretation: interpretation,
      emotion: emotions.length ? emotions.join('、') : '(いま感じていることに名前をつけてみてください)',
      actualIssue: issue,
      nextAction: action,
      prevention: prevention,
      note: MOCK_NOTE
    });
  }

  /* ---------------------------------------------------------------
   * 依頼文・質問文・催促文(テンプレート。providerに依らず共通)
   * --------------------------------------------------------------- */
  var TONES = {
    polite:  { label: '丁寧' },
    short:   { label: '簡潔' },
    chat:    { label: '社内チャット向け' },
    mail:    { label: 'メール向け' },
    boss:    { label: '上司向け' },
    expert:  { label: '専門家向け' }
  };

  /**
   * 依頼文の下書き。
   * o: { personName, title, background, points[], criteria, due, askOnly(質問文か), userName }
   */
  function composeRequest(o, tone) {
    var name = o.personName ? o.personName + 'さん' : 'ご担当者さま';
    var due = o.due ? formatDue(o.due) : '';
    var points = (o.points || []).filter(Boolean);
    var pointLines = points.map(function (p) { return '・' + p; }).join('\n');
    var criteria = o.criteria || '';
    var title = o.title || '';
    var bg = o.background || '';
    var verb = o.askOnly ? 'ご確認' : 'ご対応';

    switch (tone) {
      case 'short':
        return [
          name,
          '「' + title + '」の' + verb + 'をお願いします。',
          bg ? '背景: ' + bg : null,
          points.length ? '確認事項:\n' + pointLines : null,
          criteria ? '完了条件: ' + criteria : null,
          due ? '期限: ' + due : null,
          '回答はこのメッセージへの返信でお願いします。'
        ].filter(Boolean).join('\n');
      case 'chat':
        return [
          name + '、お疲れさまです。',
          '「' + title + '」について、' + verb + 'をお願いしたいです。',
          bg ? '背景としては、' + bg : null,
          points.length ? '確認したいのは以下です。\n' + pointLines : null,
          criteria ? 'ゴールは「' + criteria + '」の状態です。' : null,
          due ? due + 'までにお願いできると助かります。難しければ一言ください。' : '目安の時期だけでも先に教えてもらえると助かります。'
        ].filter(Boolean).join('\n');
      case 'mail':
        return [
          name,
          '',
          'お世話になっております。' + (o.userName ? o.userName + 'です。' : ''),
          '「' + title + '」について、' + verb + 'のお願いです。',
          '',
          bg ? '【背景】\n' + bg + '\n' : null,
          points.length ? '【ご確認いただきたい事項】\n' + pointLines + '\n' : null,
          criteria ? '【完了条件】\n' + criteria + '\n' : null,
          due ? '【期限】\n' + due + '(難しい場合は、見込みの時期をお知らせください)\n' : null,
          'ご不明点があればお知らせください。',
          'どうぞよろしくお願いいたします。'
        ].filter(function (x) { return x !== null; }).join('\n');
      case 'boss':
        return [
          name,
          '「' + title + '」について、ご相談です。',
          bg ? '状況: ' + bg : null,
          points.length ? '確認・ご判断いただきたい点:\n' + pointLines : null,
          criteria ? 'ここまで確認できれば次に進められます: ' + criteria : null,
          due ? '進行の都合上、' + due + 'までにご回答いただけると助かります。' : null,
          'お時間いただける枠があれば教えてください。'
        ].filter(Boolean).join('\n');
      case 'expert':
        return [
          name,
          'いつもお世話になっております。専門的なご知見をお借りしたく、ご連絡しました。',
          '「' + title + '」について、' + verb + 'をお願いできますでしょうか。',
          bg ? '前提: ' + bg : null,
          points.length ? '論点:\n' + pointLines : null,
          criteria ? '当方で判断するために、「' + criteria + '」の状態まで確認できれば十分です。' : null,
          due ? '恐れ入りますが、' + due + 'までにご回答をお願いいたします。難しい場合は、いつ頃になりそうかだけでもご教示ください。' : null,
          '不足している情報があればご指摘ください。'
        ].filter(Boolean).join('\n');
      case 'polite':
      default:
        return [
          name,
          'お世話になっております。',
          '「' + title + '」について、' + verb + 'をお願いいたします。',
          bg ? '背景: ' + bg : null,
          points.length ? 'ご確認いただきたい事項:\n' + pointLines : null,
          criteria ? '完了条件: ' + criteria : null,
          due ? due + 'までにご回答をお願いいたします。難しい場合は、いつ頃になりそうかだけでもお知らせください。' : null,
          'ご不明点があれば、お気軽にお知らせください。'
        ].filter(Boolean).join('\n');
    }
  }

  /**
   * キャリアログ(iOSアプリ)へ貼り付けるための週次記録の下書き。
   * o: { from, to(表示用日付), decided, delegated, reminded,
   *      completedTitles[], projects[] }
   * 事実の行だけを機械が書き、意味づけは本人の欄として空けておく。
   */
  function composeCareerLog(o) {
    var lines = ['【マネジメントの記録】' + o.from + '〜' + o.to];
    lines.push('意思決定・分類: ' + o.decided + '件 / 委任・依頼: ' + o.delegated + '件 / 催促: ' + o.reminded + '件');
    if (o.completedTitles && o.completedTitles.length) {
      lines.push('完了: ' + o.completedTitles.map(function (t) { return '「' + t + '」'; }).join(''));
    }
    if (o.projects && o.projects.length) {
      lines.push('動かしたプロジェクト: ' + o.projects.join('、'));
    }
    lines.push('');
    lines.push('気づき(自分の言葉で):');
    lines.push('');
    return lines.join('\n');
  }

  /** 催促文の下書き。o: { personName, title, due, userName } */
  function composeReminder(o, tone) {
    var name = o.personName ? o.personName + 'さん' : 'ご担当者さま';
    var due = o.due ? formatDue(o.due) : '';
    if (tone === 'chat' || tone === 'short') {
      return [
        name + '、お疲れさまです。',
        '先日お願いした「' + o.title + '」、現時点での状況を教えてもらえますか。',
        due ? due + 'までに必要なため、途中経過でも大丈夫です。' : '途中経過でも大丈夫です。',
        '難しくなっていれば、その旨だけでもお知らせいただけると助かります。'
      ].join('\n');
    }
    return [
      name,
      'お世話になっております。' + (o.userName ? o.userName + 'です。' : ''),
      '先日お願いした「' + o.title + '」について、いまの状況をお聞かせいただけますでしょうか。',
      due ? due + 'までに必要なため、現時点での状況をご共有いただけますと助かります。' : '現時点での状況をご共有いただけますと助かります。',
      '進めるうえで困りごとがあれば、あわせてお知らせください。',
      'よろしくお願いいたします。'
    ].join('\n');
  }

  function formatDue(due) {
    var p = String(due).split('-');
    if (p.length !== 3) return String(due);
    return (+p[1]) + '月' + (+p[2]) + '日';
  }

  /* ---------------------------------------------------------------
   * provider: remote(実API接続の置き場所)
   * 実装する場合はここに fetch を書く。UI側の変更は不要。
   * 例(Anthropic):
   *   POST https://api.anthropic.com/v1/messages
   *   headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }
   *   body: { model: 'claude-sonnet-5', max_tokens: 1024,
   *           messages: [{ role: 'user', content: prompt }] }
   * 返却JSONを Suggestion / ReflectionDraft の形に整えて resolve する。
   * 注意: ブラウザから直接呼ぶとAPIキーが露出するため、
   *       実運用では中継サーバーを挟むこと(context.md 10章)。
   * --------------------------------------------------------------- */
  function remoteNotReady() {
    return Promise.reject(new Error('外部APIは未接続です。設定は「mock」のままにしてください。'));
  }

  var providers = {
    mock: { suggest: mockSuggest, reflect: mockReflect },
    anthropic: { suggest: remoteNotReady, reflect: remoteNotReady },
    openai: { suggest: remoteNotReady, reflect: remoteNotReady }
  };

  function currentProvider() {
    var name = 'mock';
    try {
      if (global.Store && global.Store.settings) name = global.Store.settings().aiProvider || 'mock';
    } catch (e) { /* Storeがない環境(テスト等)ではmock固定 */ }
    return providers[name] || providers.mock;
  }

  global.AI = {
    TONES: TONES,
    suggest: function (taskLike) {
      return currentProvider().suggest(taskLike).catch(function () { return mockSuggest(taskLike); });
    },
    reflect: function (raw) {
      return currentProvider().reflect(raw).catch(function () { return mockReflect(raw); });
    },
    composeRequest: composeRequest,
    composeReminder: composeReminder,
    composeCareerLog: composeCareerLog,
    _mock: { suggest: mockSuggest, reflect: mockReflect } // テスト用
  };
})(typeof window !== 'undefined' ? window : globalThis);
