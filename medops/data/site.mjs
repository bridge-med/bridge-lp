/* ================================================================
   サイト設定 — 唯一の情報源
   サービス名は仮称のため、ここ以外にハードコードしない。
   名称変更の手順: name/shortName を書き換えて
   `node scripts/medops/build.mjs` を実行する(全ページ再生成)。
   ================================================================ */

export const SITE = {
  /* ブランド */
  name: '医療管理実務ライブラリ',
  shortName: '実務ライブラリ',
  slug: 'medops',
  tagline: '医療現場の曖昧な実務を、動ける形に',
  description: 'クリニック統合、管理医師変更、採用、業務分担。医療管理職が迷いやすい実務を、担当者・期限・確認先まで整理したテンプレートと進め方にまとめています。',

  /* URL(GitHub Pages) */
  baseUrl: 'https://bridge-med.github.io/bridge-lp/medops/',
  parent: {
    name: 'BRIDGE',
    href: '../index.html',
    contactHref: '../community/index.html',
    note: 'https://note.com/prime_duck4944',
    x: 'https://x.com/WataruPT1013',
  },

  /* 運営者(BRIDGE本体と同一。詳細は about ページ) */
  operator: {
    label: 'BRIDGE(橋本渉)',
    background: '理学療法士。病院での臨床・部門マネジメントを経て、現在は医療機関の経営支援・クリニック統合(PMI)・業務改善・採用・行政手続き・電子カルテ移行の実務に携わる。',
  },

  /* 価格(すべて税込・仮設定。変更はここだけ) */
  pricing: {
    currency: 'JPY',
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
        id: 'personal',
        name: '個人会員(準備中)',
        price: 2980,
        unit: '月',
        yearly: 29800,
        features: ['対象テンプレートの閲覧・ダウンロード', '更新版の利用', '会員向け記事とAI入力例', 'テンプレート活用ガイド'],
        note: '価格は仮設定です。開始時に改めて告知します。',
        status: 'planned',
      },
      {
        id: 'corporate',
        name: '法人会員(準備中)',
        price: 98000,
        unit: '年',
        features: ['複数名・複数拠点での利用', 'テンプレートの法人内共有', '更新通知', '利用ガイド'],
        note: '人数・拠点数に応じた料金は個別にご案内します。',
        status: 'planned',
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
    SEARCH: 'search',
    SEARCH_EMPTY: 'search_empty',
    FILTER: 'filter',
    SORT: 'sort',
    SAMPLE_OPEN: 'sample_open',
    FREE_COPY: 'free_template_copy',
    PURCHASE_CLICK: 'purchase_click',
    RELATED_CLICK: 'related_click',
    CONTACT_CLICK: 'contact_click',
  },
};

/* サブサイト内ナビ(料金ページは意図的に載せない。
   決済が動くまでの間、導線はテンプレート詳細と「初めての方へ」からのみ) */
export const NAV = [
  { id: 'templates', label: 'テンプレート', href: 'templates/index.html' },
  { id: 'articles', label: '記事', href: 'articles/index.html' },
  { id: 'guide', label: '初めての方へ', href: 'guide/index.html' },
];

export const FOOTER_LINKS = {
  content: [
    { label: 'テンプレート一覧', href: 'templates/index.html' },
    { label: '記事一覧', href: 'articles/index.html' },
    { label: '初めての方へ', href: 'guide/index.html' },
    { label: 'よくある質問', href: 'faq/index.html' },
  ],
  about: [
    { label: '運営者について', href: 'about/index.html' },
    { label: 'BRIDGE(運営プロジェクト)', href: '../index.html' },
    { label: 'お問い合わせ', href: '../community/index.html' },
  ],
  legal: [
    { label: '利用規約', href: 'legal/terms.html' },
    { label: 'プライバシーポリシー', href: 'legal/privacy.html' },
    { label: '免責事項', href: 'legal/disclaimer.html' },
  ],
};

/* 対象者・業務フェーズ・形式(絞り込みの選択肢) */
export const ROLES = [
  { id: 'jimucho', label: '事務長・事務長補佐' },
  { id: 'honbu', label: '医療法人本部・経営支援' },
  { id: 'kango', label: '看護管理者' },
  { id: 'reha', label: 'リハビリ管理職' },
  { id: 'saiyo', label: '採用担当' },
  { id: 'incho', label: '院長・管理者' },
];

export const PHASES = [
  { id: 'research', label: '情報収集' },
  { id: 'hearing', label: '現場ヒアリング' },
  { id: 'planning', label: '計画作成' },
  { id: 'gyosei', label: '行政確認' },
  { id: 'vendor', label: 'ベンダー確認' },
  { id: 'execution', label: '実行管理' },
  { id: 'sharing', label: '院内共有' },
  { id: 'handover', label: '引き継ぎ・運用' },
];

export const FORMATS = [
  { id: 'excel', label: 'Excel' },
  { id: 'word', label: 'Word' },
  { id: 'checklist', label: 'チェックリスト' },
  { id: 'wbs', label: 'WBS' },
  { id: 'letter', label: '文例集' },
  { id: 'sheet', label: '記入シート' },
];

export const fmtPrice = (n) => n === 0 ? '無料' : n.toLocaleString('ja-JP') + '円';
