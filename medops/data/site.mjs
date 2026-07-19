/* ================================================================
   サイト設定 — 唯一の情報源
   サービス名は仮称のため、ここ以外にハードコードしない。
   名称変更の手順: name/shortName を書き換えて
   `node scripts/medops/build.mjs` を実行する(全ページ再生成)。

   ---- サービスの定義(2026-07-18 社長指示で再定義) ----
   医療管理実務ライブラリ = 医療機関で具体的な業務・案件が発生した
   ときに「何を・誰が・いつ・どの順番で処理するか」を確認できる
   実務ライブラリ。管理職の育成・マネジメント教育は扱わない。

   ---- manager-starter との線引き(迷ったらこれで判断) ----
   「管理職としてどう振る舞うか」 → 医療管理職スターター
   「この具体的な実務をどう処理するか」 → 本サイト
   1on1・上司報告の仕方・業務の任せ方・新任の30/90日などは
   スターターの領分。本サイトは採用・入退職・施設基準・研修記録・
   レセプト・機器管理などの案件処理だけを扱う。
   同一役割の成果物を両サイトに複製しない。
   ================================================================ */

export const SITE = {
  /* ブランド */
  name: '医療管理実務ライブラリ',
  shortName: '実務ライブラリ',
  slug: 'medops',
  tagline: '医療機関の実務を、ゼロから作らない',
  description: '採用、入退職、施設基準、研修、レセプト、医療機器管理。医療機関で繰り返し発生する業務を、すぐに使えるチェックリスト・台帳・進捗表・文例に整理しています。',

  /* URL(GitHub Pages) */
  baseUrl: 'https://bridge-med.github.io/bridge-lp/medops/',
  parent: {
    name: 'BRIDGE',
    href: '../index.html',
    contactHref: '../community/index.html',
    servicesHref: '../services/index.html',
    note: 'https://note.com/prime_duck4944',
    x: 'https://x.com/WataruPT1013',
  },
  sibling: {
    name: '医療管理職スターター',
    href: '../manager-starter/index.html',
    scope: '初めて管理職になり、1on1・上司報告・チーム運営から学びたい方はこちら',
  },

  /* 運営者(BRIDGE本体と同一。詳細は about ページ) */
  operator: {
    label: 'BRIDGE(橋本渉)',
    background: '理学療法士。病院での臨床・部門マネジメントを経て、現在は医療機関の経営支援・業務改善・採用・行政手続き・電子カルテ移行の実務に携わる。',
  },

  /* 価格(すべて税込・仮設定。変更はここだけ) */
  pricing: {
    currency: 'JPY',
    /* 代表商品: 医療機関の採用・入退職実務パック
       2026-07-19 社長決定: v2.0再構成に伴い通常価格2,980円の単一表示 */
    recruitPack: { list: 2980, launch: 2980 },
    /* 統合・閉院実務パック(公開保留中のデータで参照) */
    flagship: { list: 29800, launch: 19800 },
    plans: [
      {
        id: 'free',
        name: '無料',
        price: 0,
        unit: '',
        features: ['無料記事の閲覧', '無料テンプレートの利用', '新着・更新の告知(note・X)'],
        note: '登録は不要です。',
        status: 'available',
      },
      {
        id: 'pack',
        name: '採用・入退職実務パック(準備中)',
        price: 2980,
        unit: '買い切り',
        features: ['採用〜退職の17ファイル一式', 'マスター管理表(Excel)', '完成記入例(3職種)・失敗事例集', '更新版の利用(1年間)'],
        note: '決済は準備中です。開始時に告知します。',
        status: 'planned',
      },
      {
        id: 'personal',
        name: '個人会員(構想中)',
        price: 2980,
        unit: '月',
        features: ['対象テンプレートの閲覧・ダウンロード', '更新版の利用', '会員向け記事とAI入力例'],
        note: '内容・価格は構想段階です。',
        status: 'concept',
      },
      {
        id: 'corporate',
        name: '法人会員(構想中)',
        price: 98000,
        unit: '年〜',
        features: ['複数名・複数拠点での利用', 'テンプレートの法人内共有', '更新通知', '利用ガイド'],
        note: '人数・拠点数に応じて個別にご案内します。',
        status: 'concept',
      },
    ],
  },

  /* 計測イベント名(計測ツール接続時にこの名前で送る) */
  events: {
    VIEW_HOME: 'view_home',
    VIEW_CATEGORY: 'view_category',
    VIEW_TEMPLATE: 'view_template',
    VIEW_ARTICLE: 'view_article',
    VIEW_PRICING: 'view_pricing',
    VIEW_PRODUCT: 'product_detail_view',
    SEARCH: 'search',
    SEARCH_EMPTY: 'search_empty',
    FILTER: 'filter',
    SORT: 'sort',
    SAMPLE_OPEN: 'sample_open',
    FREE_COPY: 'free_template_copy',
    PURCHASE_CLICK: 'purchase_click',
    RELATED_CLICK: 'related_click',
    CONTACT_CLICK: 'contact_click',
    CORP_INQUIRY: 'corporate_inquiry_click',
  },
};

/* サブサイト内ナビ(料金ページは載せない。管理職スターターへの
   案内は「初めての方へ」・フッター・テンプレ一覧末尾の1行に限定する) */
export const NAV = [
  { id: 'templates', label: 'テンプレート', href: 'templates/index.html' },
  { id: 'articles', label: '実務記事', href: 'articles/index.html' },
  { id: 'pack', label: '採用・入退職パック', href: 'pack/index.html' },
  { id: 'guide', label: '初めての方へ', href: 'guide/index.html' },
];

export const FOOTER_LINKS = {
  content: [
    { label: 'テンプレート一覧', href: 'templates/index.html' },
    { label: '無料テンプレート', href: 'templates/index.html' },
    { label: '実務記事', href: 'articles/index.html' },
    { label: '採用・入退職実務パック', href: 'pack/index.html' },
    { label: '初めての方へ', href: 'guide/index.html' },
    { label: 'よくある質問', href: 'faq/index.html' },
  ],
  about: [
    { label: '運営者について', href: 'about/index.html' },
    { label: '法人・複数拠点での利用', href: 'corporate/index.html' },
    { label: 'BRIDGE(運営プロジェクト)', href: '../index.html' },
    { label: '医療管理職スターター(管理職の進め方はこちら)', href: '../manager-starter/index.html' },
    { label: 'お問い合わせ', href: '../community/index.html' },
  ],
  legal: [
    { label: '利用規約', href: 'legal/terms.html' },
    { label: 'プライバシーポリシー', href: 'legal/privacy.html' },
    { label: '免責事項', href: 'legal/disclaimer.html' },
  ],
};

/* 対象者(絞り込み) */
export const ROLES = [
  { id: 'jimucho', label: '事務長・事務長補佐' },
  { id: 'honbu', label: '医療法人本部' },
  { id: 'iryojimu', label: '医療事務' },
  { id: 'somu', label: '総務' },
  { id: 'saiyo', label: '採用担当' },
  { id: 'kango', label: '看護管理者' },
  { id: 'homon', label: '訪問看護管理者' },
  { id: 'renkei', label: '地域連携担当' },
  { id: 'incho', label: '院長・管理者' },
  { id: 'keiei', label: '経営支援担当' },
];

/* 利用場面(絞り込み) */
export const SCENES = [
  { id: 'junbi', label: '準備' },
  { id: 'kakunin', label: '確認' },
  { id: 'jikko', label: '実行' },
  { id: 'shinchoku', label: '進捗管理' },
  { id: 'kiroku', label: '記録' },
  { id: 'hokoku', label: '報告' },
  { id: 'toiawase', label: '問い合わせ' },
  { id: 'annai', label: '案内' },
  { id: 'teiki', label: '定期確認' },
  { id: 'kanryo', label: '完了確認' },
];

/* 発生頻度(絞り込み) */
export const FREQUENCY = [
  { id: 'daily', label: '毎日' },
  { id: 'weekly', label: '毎週' },
  { id: 'monthly', label: '毎月' },
  { id: 'yearly', label: '毎年' },
  { id: 'nyushoku', label: '入職時' },
  { id: 'taishoku', label: '退職時' },
  { id: 'saiyoji', label: '採用時' },
  { id: 'kaitei', label: '制度改定時' },
  { id: 'trouble', label: 'トラブル時' },
  { id: 'zuiji', label: '随時' },
];

/* テンプレート形式(絞り込み) */
export const FORMATS = [
  { id: 'checklist', label: 'チェックリスト' },
  { id: 'ledger', label: '台帳' },
  { id: 'tracker', label: '進捗管理表' },
  { id: 'hearing', label: 'ヒアリングシート' },
  { id: 'record', label: '記録表' },
  { id: 'letter', label: '文例' },
  { id: 'inquiry', label: '問い合わせ文' },
  { id: 'notice', label: '案内文' },
  { id: 'wbs', label: 'WBS' },
  { id: 'calendar', label: '管理カレンダー' },
];

export const fmtPrice = (n) => n === 0 ? '無料' : n.toLocaleString('ja-JP') + '円';
