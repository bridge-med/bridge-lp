/* ================================================================
   BRIDGE Compass — データ(UIから分離したマスター)
   質問・経験資産・役割・橋・職種別の言いかえ・既存コンテンツへの導線を
   ここに集める。質問や橋を増やすときは、このファイルだけを直す。
   engine.js(判定)と app.js(画面)はこのデータを読むだけ。
   ブラウザでは window.COMPASS_DATA、Node(テスト)では module.exports。
   ================================================================ */
(function (root) {
  'use strict';

  /* ---- 経験資産(12種)。回答内での相対的な特徴量であり、能力の絶対値ではない
     word  : 理由文での呼び名(「〜の経験」が不自然なものだけ。動詞で終える)
     tag   : 結果の「あなたが持っているもの」に出す短い名前
     ren   : 見出しの前半(連用形)  term: 見出しの後半(連体形)
       例) coordination × improvement →「人をつなぎ、仕組みを変える力」 ---- */
  const ASSETS = {
    problemFinding: { label: '課題発見',     tag: '課題発見',   ren: '問題に気づき',         term: '問題に気づく' },
    hypothesis:     { label: '仮説構築',     word: '仮説を立てる', tag: '仮説',       ren: '仮説を立て',           term: '仮説を立てる' },
    analysis:       { label: '分析',         tag: '分析',       ren: '数字から読み取り',     term: '数字から読み取る' },
    empathy:        { label: '対人理解',     word: '人の気持ちをくみ取る', tag: '対人理解',   ren: '人の気持ちをくみ取り', term: '人の気持ちをくみ取る' },
    coordination:   { label: '調整・交渉',   tag: '調整',       ren: '人と人をつなぎ',       term: '人と人をつなぐ' },
    education:      { label: '教育',         tag: '教育',       ren: '人を育て',             term: '人を育てる' },
    management:     { label: 'マネジメント', tag: 'マネジメント', ren: 'チームを動かし',     term: 'チームを動かす' },
    improvement:    { label: '業務改善',     tag: '改善',       ren: '仕組みを変え',         term: '仕組みを変える' },
    creation:       { label: '企画・創造',   tag: '企画',       ren: '新しいものを考え',     term: '新しいものを考える' },
    customer:       { label: '顧客理解',     tag: '顧客理解',   ren: '相手の求めるものをつかみ', term: '相手の求めるものをつかむ' },
    project:        { label: 'プロジェクト推進', tag: '推進',   ren: '物事を前に進め',       term: '物事を前に進める' },
    expertise:      { label: '専門性',       word: '専門知識を使う', tag: '専門性',     ren: '専門知識を深め',       term: '専門知識で解く' },
  };

  /* ---- 職種。結果を決めるためではなく、言いかえ(TRANSLATIONS)を選ぶためだけに使う ---- */
  const PROFESSIONS = [
    { id: 'pt',    label: '理学療法士(PT)' },
    { id: 'ot',    label: '作業療法士(OT)' },
    { id: 'st',    label: '言語聴覚士(ST)' },
    { id: 'judo',  label: '柔道整復師' },
    { id: 'nurse', label: '看護師' },
    { id: 'other', label: 'その他の医療専門職' },
  ];

  /* ---- 質問
     type    : single(ワンタップで次へ)/ multi(max まで)/ text(任意の自由記述)
     chapter : 1=これまで 2=あなたの強み 3=これから
     score   : 選択肢ごとの経験資産への加点(Q1〜Q4)
     avoid   : Q5。加点ではなく「今後あまりやりたくない」として別に持つ
     interest: Q6/Q8。役割への関心(補正)
     value   : Q7。弱い補正
     text の回答は判定に使わない。結果画面で本人の言葉として出すだけ ---- */
  const STRENGTHS = [
    { id: 'teach',   label: '人に教える',             score: { education: 3 } },
    { id: 'listen',  label: '人の話を聞いてまとめる', score: { coordination: 3, empathy: 1 } },
    { id: 'data',    label: '数字やデータを見る',     score: { analysis: 3 } },
    { id: 'cause',   label: '問題の原因を考える',     score: { problemFinding: 2, hypothesis: 2 } },
    { id: 'improve', label: '仕組みを改善する',       score: { improvement: 3 } },
    { id: 'create',  label: '新しいものを考える',     score: { creation: 3 } },
    { id: 'deep',    label: '専門分野を深く掘る',     score: { expertise: 3 } },
  ];

  const QUESTIONS = [
    { id: 'q1', chapter: 1, type: 'single', text: '仕事で困ったことが起きたとき、一番近いのは?', options: [
      { id: 'a', label: '専門知識を使って解決する',     score: { expertise: 3, problemFinding: 1 } },
      { id: 'b', label: '詳しい人を探して相談する',     score: { coordination: 1, expertise: 1 } },
      { id: 'c', label: '周囲を巻き込んで解決する',     score: { coordination: 3, project: 1 } },
      { id: 'd', label: 'やり方・仕組みそのものを変える', score: { improvement: 3, problemFinding: 2, creation: 1 } },
      { id: 'e', label: 'まず自分で引き取って進める',   score: { project: 2 } },
    ] },
    { id: 'q2', chapter: 1, type: 'single', text: '周りから一番頼られるのは?', options: [
      { id: 'a', label: '専門知識・技術',           score: { expertise: 3 } },
      { id: 'b', label: '患者・利用者との関わり',   score: { empathy: 3, customer: 1 } },
      { id: 'c', label: '人に教えること',           score: { education: 3 } },
      { id: 'd', label: '人やチームの調整',         score: { coordination: 3, management: 2 } },
      { id: 'e', label: '仕事を効率よく進めること', score: { improvement: 3, project: 1 } },
      { id: 'f', label: '新しいアイデア',           score: { creation: 3 } },
    ] },
    { id: 'q3', chapter: 1, type: 'single', text: '一番「やってよかった」と思える瞬間は?', options: [
      { id: 'a', label: '患者・利用者が良くなった', score: { empathy: 2, expertise: 2 } },
      { id: 'b', label: '難しい問題を解けた',       score: { problemFinding: 2, hypothesis: 2, analysis: 1 } },
      { id: 'c', label: '誰かが成長した',           score: { education: 3, empathy: 1 } },
      { id: 'd', label: 'チームがうまく動いた',     score: { management: 3, coordination: 2 } },
      { id: 'e', label: '仕組みが良くなった',       score: { improvement: 3, analysis: 1 } },
      { id: 'f', label: '新しいものを生み出した',   score: { creation: 3, project: 1 } },
    ] },
    { id: 'q4', chapter: 2, type: 'multi', max: 2, min: 1,
      text: '「得意だし、嫌いじゃない」と思うものを、最大2つ選んでください',
      options: STRENGTHS },
    { id: 'q5', chapter: 2, type: 'multi', max: 2, min: 1, none: 'none', role: 'avoid',
      text: '逆に、「できるけれど、今後はあまりやりたくない」と感じるものは?',
      hint: '最大2つ。Q4と同じものを選んでもかまいません。',
      options: STRENGTHS.map(s => ({ id: s.id, label: s.label, avoid: Object.keys(s.score) }))
        .concat([{ id: 'none', label: '特にない' }]) },
    { id: 'q6', chapter: 3, type: 'single', text: '今の仕事に、一つだけ新しい役割を足せるなら?', options: [
      { id: 'a', label: 'もっと専門的な仕事',         interest: { specialist: 1 } },
      { id: 'b', label: '人を育てる仕事',             interest: { educator: 1 } },
      { id: 'c', label: 'チームを動かす仕事',         interest: { manager: 1 } },
      { id: 'd', label: '経営に関わる仕事',           interest: { business: 1 } },
      { id: 'e', label: '新しい企画を作る仕事',       interest: { product: 1 } },
      { id: 'f', label: 'AI・テクノロジーを使う仕事', interest: { technology: 1 } },
      { id: 'g', label: '医療の制度・仕組みに関わる仕事', interest: { policy: 1 } },
    ] },
    { id: 'q7', chapter: 3, type: 'multi', max: 2, min: 1,
      text: 'これから特に欲しいものを、2つ選んでください', options: [
      { id: 'income',    label: '収入',         value: { business: 1, manager: 0.5 } },
      { id: 'expertise', label: '専門性',       value: { specialist: 1, research: 0.5 } },
      { id: 'stability', label: '安定',         value: { specialist: 0.5, operations: 0.5, policy: 0.5 } },
      { id: 'autonomy',  label: '裁量',         value: { business: 1, product: 0.5 } },
      { id: 'growth',    label: '成長',         value: { projectManager: 0.5, product: 0.5, educator: 0.5 } },
      { id: 'worklife',  label: '働きやすさ',   value: { operations: 1 } },
      { id: 'impact',    label: '社会への影響', value: { policy: 1, research: 0.5 } },
      { id: 'novelty',   label: '新しい経験',   value: { product: 1, technology: 0.5 } },
    ] },
    { id: 'q8', chapter: 3, type: 'single', text: '1日だけ、別の仕事を完全に体験できるなら?', options: [
      { id: 'a', label: '専門家として難しいケースに挑む',     interest: { specialist: 1, research: 0.3 } },
      { id: 'b', label: '教育プログラムを作る',               interest: { educator: 1 } },
      { id: 'c', label: '組織を任される',                     interest: { manager: 1 } },
      { id: 'd', label: 'クリニックを経営する',               interest: { business: 1, operations: 0.3 } },
      { id: 'e', label: '医療系企業のプロジェクトに入る',     interest: { projectManager: 1, business: 0.3 } },
      { id: 'f', label: '新しいサービスをゼロから作る',       interest: { product: 1, business: 0.3 } },
      { id: 'g', label: 'AI・テクノロジーで医療の課題を解く', interest: { technology: 1 } },
      { id: 'h', label: '医療政策・制度を作る側に入る',       interest: { policy: 1, research: 0.3 } },
    ] },
    { id: 'q9', chapter: 3, type: 'text', max: 300,
      text: '今までの仕事で、「これは自分だからできたかもしれない」と思うことはありますか?',
      placeholder: '小さなことでも大丈夫です' },
    { id: 'q10', chapter: 3, type: 'text', max: 300,
      text: 'もし失敗しないとしたら、一度やってみたいことは?',
      placeholder: '仕事でも、それ以外でも。' },
  ];

  const CHAPTERS = {
    1: { en: 'CHAPTER 01', jp: 'これまで' },
    2: { en: 'CHAPTER 02', jp: 'あなたの強み' },
    3: { en: 'CHAPTER 03', jp: 'これから' },
  };

  /* ---- 役割(経験資産 → 役割)。weights は合計1。経験資産から直接「職業」を出さないための中間層 ---- */
  const ROLES = {
    specialist:     { label: '専門性を深める',             weights: { expertise: 0.6, hypothesis: 0.2, problemFinding: 0.2 } },
    educator:       { label: '人を育てる',                 weights: { education: 0.6, empathy: 0.25, coordination: 0.15 } },
    manager:        { label: 'チームを動かす',             weights: { management: 0.5, coordination: 0.3, empathy: 0.1, improvement: 0.1 } },
    projectManager: { label: '人と仕事をつなぎ、前に進める', weights: { project: 0.45, coordination: 0.35, problemFinding: 0.2 } },
    operations:     { label: '仕組みを改善する',           weights: { improvement: 0.55, analysis: 0.25, problemFinding: 0.2 } },
    business:       { label: '事業・経営を動かす',         weights: { customer: 0.3, analysis: 0.25, management: 0.25, creation: 0.2 } },
    product:        { label: '新しいサービスを作る',       weights: { creation: 0.45, customer: 0.3, problemFinding: 0.15, empathy: 0.1 } },
    technology:     { label: 'テクノロジーで課題を解く',   weights: { analysis: 0.3, improvement: 0.2, creation: 0.2, hypothesis: 0.15, problemFinding: 0.15 } },
    research:       { label: '問いを立て、検証する',       weights: { hypothesis: 0.4, analysis: 0.35, problemFinding: 0.25 } },
    policy:         { label: '制度・社会の仕組みに関わる', weights: { problemFinding: 0.25, coordination: 0.25, analysis: 0.25, improvement: 0.25 } },
  };

  /* ---- 橋(役割 → 橋)。roles は合計1
     about : この橋で実際にしていること(1文)
     links : 既存のBRIDGEコンテンツ。無いものは空のまま(「この橋について知る」で about を開く)。
             パスは compass/ から見た相対パス。存在確認は scripts/check-site.mjs と tests が行う ---- */
  const BRIDGES = [
    { id: 'clinical', name: '臨床スペシャリスト', en: 'Clinical Specialist',
      roles: { specialist: 1 },
      about: '認定・専門資格や難しい症例への関わりを通じて、専門性そのものを仕事の中心に置く道です。',
      links: [] },
    { id: 'education', name: '教育 / 人材育成', en: 'Education',
      roles: { educator: 0.85, specialist: 0.15 },
      about: '新人教育の仕組みづくり、養成校、研修の企画など、人が育つ過程そのものを仕事にする道です。',
      links: [] },
    { id: 'management', name: 'マネジメント', en: 'Management',
      roles: { manager: 0.8, operations: 0.2 },
      about: '部門やチームを任され、人・数字・業務の流れをまとめて動かす道です。',
      links: [
        { href: '../manager-starter/index.html', t: '医療管理職スターター', d: '初めて管理職になった人のチェックリスト' },
      ] },
    { id: 'pm', name: 'プロジェクトマネジメント', en: 'Project Management',
      roles: { projectManager: 0.8, operations: 0.2 },
      about: '立場の違う人たちの間に立ち、期限のある仕事を最後まで前に進める道です。',
      links: [
        { href: '../pmi-quest/index.html', t: 'クリニックPMIクエスト', d: '承継直後の30日を、10問で体験する' },
      ] },
    { id: 'bizops', name: '医療経営 / BizOps', en: 'Healthcare BizOps',
      roles: { operations: 0.6, business: 0.4 },
      about: '病院・クリニックの運営を、数字と業務の両面から整えていく道です。',
      links: [
        { href: '../clinic-flow-3d/index.html', t: 'クリニックタウン3D', d: 'クリニック経営を、1日ずつ動かして学ぶ' },
        { href: '../nidodema/index.html', t: '二度手間さがし', d: '部署の手作業を、減らせるものと守るものに分ける' },
      ] },
    { id: 'dx', name: '医療DX / ヘルステック', en: 'Healthcare DX',
      roles: { technology: 0.75, operations: 0.25 },
      about: '現場の手間や情報の流れを、システムやデータで変えていく道です。',
      links: [
        { href: '../nidodema/index.html', t: '二度手間さがし', d: '仕組みを変える前に、手作業を数えてみる' },
        { href: '../consult-simulator/index.html', t: 'ConsultSim', d: '診察の組み方で、待ち時間がどう変わるかを試す' },
      ] },
    { id: 'bizdev', name: '事業開発', en: 'Business Development',
      roles: { business: 0.6, product: 0.2, projectManager: 0.2 },
      about: '医療の外にいる企業と医療の現場をつなぎ、新しい取り組みを事業として形にする道です。',
      links: [
        { href: '../turnaround12/index.html', t: 'ターンアラウンド12', d: '赤字クリニックを、12週で立て直す' },
      ] },
    { id: 'product', name: 'プロダクト / サービス開発', en: 'Product',
      roles: { product: 0.75, technology: 0.25 },
      about: '現場の困りごとを起点に、使われるサービスやアプリを企画し、育てていく道です。',
      links: [] },
    { id: 'research', name: '研究 / アカデミア', en: 'Research',
      roles: { research: 0.8, specialist: 0.2 },
      about: '臨床の疑問を問いの形にし、データで確かめ、ほかの人が使える知見にする道です。',
      links: [] },
    { id: 'policy', name: '行政 / 医療政策', en: 'Policy',
      roles: { policy: 0.85, research: 0.15 },
      about: '制度や地域の仕組みの側から、医療・介護の現場を支える道です。',
      links: [] },
    { id: 'community', name: '地域医療 / 地域事業', en: 'Community Health',
      roles: { projectManager: 0.35, policy: 0.3, business: 0.35 },
      about: '病院の外の、暮らしの場に近いところで、人と資源をつないで事業にしていく道です。',
      links: [] },
    { id: 'startup', name: '起業', en: 'Startup',
      roles: { business: 0.45, product: 0.45, manager: 0.1 },
      about: '自分の手で、小さく事業を始めてみる道です。副業から試す人もいます。',
      links: [] },
  ];

  /* ---- 職種別の言いかえ。「普段やっている○○は、別の言葉にすると△△です」
     assets に近いものほど、その人の上位の経験資産と合わせて選ばれる ---- */
  const TRANSLATIONS = {
    pt: [
      { from: '患者評価',             to: '課題発見・仮説検証',         assets: ['problemFinding', 'hypothesis'] },
      { from: 'ゴール設定',           to: '目標設計・計画策定',         assets: ['project', 'hypothesis'] },
      { from: '多職種カンファレンス', to: 'ステークホルダー調整',       assets: ['coordination'] },
      { from: '退院支援',             to: 'プロジェクト推進・合意形成', assets: ['project', 'coordination'] },
      { from: '後輩指導',             to: '人材育成・フィードバック',   assets: ['education'] },
      { from: '業務改善',             to: 'オペレーション改善',         assets: ['improvement', 'analysis'] },
    ],
    ot: [
      { from: '生活歴・価値観の把握', to: 'ユーザーリサーチ',           assets: ['empathy', 'customer'] },
      { from: '作業分析',             to: 'プロセス分解',               assets: ['analysis', 'problemFinding'] },
      { from: '環境調整',             to: '使う人に合わせた環境・仕組みの設計',   assets: ['improvement', 'creation'] },
      { from: '復職支援',             to: '関係者調整・プロジェクト推進', assets: ['coordination', 'project'] },
    ],
    st: [
      { from: 'コミュニケーション評価', to: '伝わらない原因の分析',     assets: ['problemFinding', 'analysis'] },
      { from: '失語症支援',           to: '相手に合わせた情報設計',     assets: ['empathy', 'creation'] },
      { from: '家族指導',             to: '複雑な情報の翻訳・教育',     assets: ['education', 'empathy'] },
      { from: '多職種連携',           to: 'ステークホルダー調整',       assets: ['coordination'] },
    ],
    judo: [
      { from: '問診',                 to: '顧客ニーズ探索',             assets: ['customer', 'empathy'] },
      { from: '継続通院支援',         to: '顧客関係・リテンション',     assets: ['customer', 'empathy'] },
      { from: '自費施術',             to: '顧客価値・サービス設計',     assets: ['creation', 'customer'] },
      { from: '院運営',               to: 'オペレーション・事業運営',   assets: ['management', 'improvement'] },
      { from: '集客',                 to: 'マーケティング・顧客獲得',   assets: ['customer', 'analysis'] },
    ],
    nurse: [
      { from: '看護計画',             to: '目標設計・計画策定',         assets: ['project', 'hypothesis'] },
      { from: '観察とアセスメント',   to: '課題発見・仮説検証',         assets: ['problemFinding', 'hypothesis'] },
      { from: '申し送り',             to: '要点を絞った情報の引き継ぎ', assets: ['coordination', 'improvement'] },
      { from: '患者・家族への説明',   to: '複雑な情報の翻訳',           assets: ['empathy', 'education'] },
      { from: 'リーダー業務(その日の業務の割り振り)', to: 'チーム運営・業務の配分',         assets: ['management', 'improvement'] },
      { from: 'プリセプター・新人指導',             to: '人材育成・フィードバック',   assets: ['education'] },
    ],
    other: [
      { from: '患者・利用者への説明', to: '複雑な情報の翻訳',           assets: ['empathy', 'education'] },
      { from: '多職種との連携',       to: 'ステークホルダー調整',       assets: ['coordination'] },
      { from: '後輩指導',             to: '人材育成・フィードバック',   assets: ['education'] },
      { from: '日々の業務の工夫',     to: 'オペレーション改善',         assets: ['improvement', 'problemFinding'] },
    ],
  };

  /* ---- 結果の3つの橋の見出し(順序が意味を持つ) ---- */
  const SLOTS = [
    { id: 'experience', label: 'すでに持っている経験から見える橋' },
    { id: 'interest',   label: '一度、渡ってみてもよさそうな橋' },
    { id: 'hidden',     label: 'まだ気づいていないかもしれない橋' },
  ];

  const DATA = { ASSETS, PROFESSIONS, QUESTIONS, CHAPTERS, ROLES, BRIDGES, TRANSLATIONS, SLOTS };
  if (typeof module === 'object' && module.exports) module.exports = DATA;
  else root.COMPASS_DATA = DATA;
})(typeof window !== 'undefined' ? window : globalThis);
