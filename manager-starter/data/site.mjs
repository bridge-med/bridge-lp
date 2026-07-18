/* ================================================================
   サイト設定 — 唯一の情報源
   サービス名は仮称のため、ここ以外にハードコードしない。
   名称変更の手順: name/en を書き換えて
   `node scripts/manager-starter/build.mjs` を実行する(全ページ再生成)。

   ---- medops との棲み分け(2026-07-18 PM承認) ----
   医療管理実務ライブラリ(medops/) = 施設運営・行政・バックオフィス実務
   (統合・管理医師変更・施設基準・事務長業務)。
   医療管理職スターター(本サイト) = チーム運営・対人マネジメント
   (新任管理職・1on1・会議・業務分担・上司報告・採用教育)。
   同一役割の成果物を両サイトに複製しない。重なる領域は成果物の
   役割を分けて設計する(例: medopsの1on1シート=定例の型、
   本サイトの初回1on1質問シート=着任後の顔合わせ専用)。
   統合するかどうかの将来判断は台帳の未決事項として社長へ。
   ================================================================ */

export const SITE = {
  /* ブランド */
  name: '医療管理職スターター',
  en: 'Medical Manager Starter',
  slug: 'manager-starter',
  /* 中心メッセージ。見出しでは句点を使わず2行で表示する(憲法第19条5号) */
  taglineLines: ['臨床は分かる', 'でも、管理職の仕事は誰にも教わっていない'],
  tagline: '臨床は分かる。でも、管理職の仕事は誰にも教わっていない。',
  description: '看護師・リハビリ職・医療事務など、医療専門職から初めて管理職になった人のための実務サービスです。1on1、会議、業務分担、上司報告を、すぐ使えるシートと進め方に整理しています。',

  /* URL(GitHub Pages) */
  baseUrl: 'https://bridge-med.github.io/bridge-lp/manager-starter/',
  parent: {
    name: 'BRIDGE',
    href: '../index.html',
    contactHref: '../community/index.html',
    servicesHref: '../services/index.html',
    note: 'https://note.com/prime_duck4944',
    x: 'https://x.com/WataruPT1013',
  },
  sibling: {
    name: '医療管理実務ライブラリ',
    href: '../medops/index.html',
    scope: '統合・行政手続き・施設基準など、施設運営の実務はこちら',
  },

  /* 運営者(BRIDGE本体と同一。詳細は about ページ) */
  operator: {
    label: 'BRIDGE(橋本渉)',
    background: '理学療法士。病院で約40名規模のリハビリ部門のマネジメントを経験し、現在は医療機関の経営支援・業務改善・採用支援に携わる。管理職の仕事は、自身も臨床しか知らない状態から現場で身につけた。',
  },

  /* 価格(すべて税込・仮設定。変更はここだけ) */
  pricing: {
    currency: 'JPY',
    pack: { list: 14800, launch: 9800 },
    plans: [
      {
        id: 'free',
        name: '無料',
        price: 0,
        unit: '',
        features: ['無料記事の閲覧', '無料テンプレートの利用', 'セルフチェック(現在地チェック)'],
        note: '登録は不要です。',
        status: 'available',
      },
      {
        id: 'pack',
        name: 'スターターパック(準備中)',
        price: 9800,
        listPrice: 14800,
        unit: '買い切り',
        features: ['20の実務テンプレート', '使い方ガイド', 'AI活用プロンプト集', '更新版の利用(1年間)'],
        note: '価格は仮設定です。販売開始時に改めて告知します。',
        status: 'planned',
      },
      {
        id: 'member',
        name: '個人会員(構想中)',
        price: 2980,
        unit: '月',
        features: ['全テンプレートの利用', '会員限定記事', '月次振り返りの型', '新着資料の利用'],
        note: '内容・価格は構想段階です。',
        status: 'concept',
      },
      {
        id: 'corporate',
        name: '法人プラン(構想中)',
        price: 98000,
        unit: '年〜',
        features: ['複数名・複数拠点での利用', '法人内共有', '管理職研修での利用', '導入ガイド'],
        note: '人数・拠点数に応じて個別にご案内します。',
        status: 'concept',
      },
    ],
  },

  /* 計測イベント名(計測ツール接続時にこの名前で送る) */
  events: {
    PAGE_VIEW: 'page_view',
    HERO_CTA: 'hero_primary_cta_click',
    DIAG_START: 'diagnosis_start',
    DIAG_ANSWER: 'diagnosis_answer',
    DIAG_COMPLETE: 'diagnosis_complete',
    DIAG_RESULT: 'diagnosis_result_view',
    FREE_TPL_VIEW: 'free_template_view',
    FREE_TPL_COPY: 'free_template_download_click',
    TPL_DETAIL: 'template_detail_view',
    PRODUCT_VIEW: 'product_detail_view',
    PRODUCT_CTA: 'product_purchase_click',
    PRICING_VIEW: 'pricing_view',
    PROFESSION_VIEW: 'profession_page_view',
    ARTICLE_VIEW: 'article_view',
    RELATED_CLICK: 'related_content_click',
    SEARCH: 'search',
    SEARCH_ZERO: 'search_zero_results',
    FILTER: 'filter_use',
    CORP_INQUIRY: 'corporate_inquiry_click',
  },
};

/* サブサイト内ナビ(料金ページは前例どおり載せない) */
export const NAV = [
  { id: 'templates', label: 'テンプレート', href: 'templates/index.html' },
  { id: 'articles', label: '記事', href: 'articles/index.html' },
  { id: 'diagnosis', label: '現在地チェック', href: 'check/index.html' },
  { id: 'pack', label: 'スターターパック', href: 'pack/index.html' },
];

export const FOOTER_LINKS = {
  content: [
    { label: 'テンプレート一覧', href: 'templates/index.html' },
    { label: '記事一覧', href: 'articles/index.html' },
    { label: '現在地チェック', href: 'check/index.html' },
    { label: 'スターターパック', href: 'pack/index.html' },
    { label: '初めての方へ', href: 'guide/index.html' },
    { label: 'よくある質問', href: 'faq/index.html' },
  ],
  about: [
    { label: '運営者について', href: 'about/index.html' },
    { label: '法人・教育担当の方へ', href: 'corporate/index.html' },
    { label: 'BRIDGE(運営プロジェクト)', href: '../index.html' },
    { label: '医療管理実務ライブラリ(施設運営の実務)', href: '../medops/index.html' },
    { label: 'お問い合わせ', href: '../community/index.html' },
  ],
  legal: [
    { label: '利用規約', href: 'legal/terms.html' },
    { label: 'プライバシーポリシー', href: 'legal/privacy.html' },
    { label: '免責事項', href: 'legal/disclaimer.html' },
  ],
};

/* 対象職種(絞り込み・職種別ページ) */
export const PROFESSIONS = [
  { id: 'reha', label: 'リハビリ職', slug: 'rehabilitation' },
  { id: 'nurse', label: '看護師', slug: 'nurse' },
  { id: 'homon', label: '訪問看護', slug: 'homecare-nurse' },
  { id: 'jimu', label: '医療事務', slug: 'medical-clerk' },
  { id: 'all', label: '全職種共通', slug: '' },
];

/* 管理職歴(絞り込み) */
export const EXPERIENCE = [
  { id: 'before', label: '就任前' },
  { id: 'month1', label: '就任1か月以内' },
  { id: 'month3', label: '3か月以内' },
  { id: 'year1', label: '1年以内' },
  { id: 'over', label: '1年以上' },
];

export const FORMATS = [
  { id: 'checklist', label: 'チェックリスト' },
  { id: 'question', label: '質問シート' },
  { id: 'record', label: '記録シート' },
  { id: 'sheet', label: '記入シート' },
  { id: 'guide', label: 'ガイド' },
  { id: 'prompt', label: 'AIプロンプト' },
  { id: 'excel', label: 'Excel' },
  { id: 'word', label: 'Word' },
];

export const fmtPrice = (n) => n === 0 ? '無料' : n.toLocaleString('ja-JP') + '円';
