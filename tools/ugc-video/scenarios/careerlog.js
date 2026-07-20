// 台本 — キャリアログ(リリース済みiOSアプリのWeb書き出し) ショート動画 v3
// 社長方針(2026-07-20): ナレーション=VOICEVOXずんだもん(既定声)・BGMなし・語りテロップは標準語のまま
// (editorの二層構造提案: 音=軽い/字=静か)。ナレーション5文はeditor確定稿(勧誘形の締め)。
//
// 注意(誠実の条項):
// - アプリのキャリア変換は本番ではAIバックエンド(Supabase)を呼ぶ。録画環境は外部
//   ネットワーク遮断のため、setup()でAPIをスタブし、入力ログに忠実な控えめの
//   下書きテキストを返している。スタブ文は公開前にeditor照合を通すこと。
// - エンドカードの検索語はApp Storeの正式名確認待ち(仮: キャリアログ)。

const STUB_CAREER_TEXT = [
  '【職務経歴書風(下書き)】',
  '',
  '■ 歩行介助の見直し(多職種連携)',
  '歩行が不安定な患者さんの介助方法を、担当の看護師と',
  '一緒に見直した。職種をこえて手順をそろえ、安全な介助を',
  '現場で共有できる形にした。',
  '',
  '・強み: 現場の気づきを、職種をこえた改善につなげる',
  '・書ける観点: 連携 / 安全管理 / 言語化',
  '',
  '※ログをもとにした下書きです。仕上げはあなたの言葉で。',
].join('\n');

const LOG_TEXT = '歩行が不安定な患者さんの介助方法を、担当の看護師と一緒に見直した';

module.exports = {
  name: 'careerlog_short',
  page: '/bridge-lp/daily-app/',
  serverRoot: '..', // Expo書き出しのbaseUrl(/bridge-lp/daily-app)に合わせ、リポジトリの親をdocrootにする
  bgm: false,       // TikTok等の投稿時にアプリ内音源を付けるため焼き込まない

  viewport: { width: 540, height: 960 },
  voice: { engine: 'voicevox', speaker: 3 }, // ずんだもん(ノーマル)

  // セグメント開始時刻(秒)
  T: {
    seg0: 0.2,   // ホーム+フック
    seg1: 6.8,   // ログを書く(入力)
    seg2: 14.2,  // タグ・保存
    seg3: 20.4,  // キャリア変換(オチ)
    seg4: 26.3,  // エンドカード
    end: 31.5,
  },

  // 声=VOICEVOX ずんだもん(社長方針 2026-07-20)。テロップは標準語のまま二層で担う。
  lines: [
    '毎日ちゃんと働いているのに、その一日は言葉に残らないのだ。',
    'キャリアログ。今日やったことを一行書くだけで、職務経歴書や面接の材料になるのだ。',
    'タグを付けて保存すれば、日々の記録が静かに積み上がっていくのだ。',
    'ためたログは、職務経歴書風にそのまま変換できるのだ。',
    '気になったら、キャリアログで検索してみてほしいのだ。',
  ],

  // 語りテロップ(cap0はフック=大・中央上、以降は下部で画に同期)
  captions: [
    '毎日働いているのに、\nその一日は言葉に残らない',
    'キャリアログ — 今日を一行、書くだけ',
    'タグを付けて、保存',
    '書いた記録が、積み上がる',
    '溜めたログを —',
    '職務経歴書風に、そのまま変換',
    '',
  ],
  heroCap: 0,

  endCard: {
    title: 'キャリアログ',
    sub: '働いた記録を、キャリアの言葉に・iPhoneアプリ',
    search: 'キャリアログ', // App Store検索(正式名の社長確認待ち)
    badge: 'BRIDGE',
    credit: 'VOICEVOX:ずんだもん',
  },

  // キャリア変換のAIバックエンドをスタブ(録画環境は外部遮断のため)
  async setup(ctx) {
    await ctx.route(/supabase\.co\/functions\/v1\/ai/, (route) => {
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ text: STUB_CAREER_TEXT }),
      });
    });
  },

  async run(page, { until, cap, T }) {
    const base = 'http://127.0.0.1:8123/bridge-lp/daily-app';
    await page.getByText('今日の仕事ログを書く').first().waitFor();

    await cap(0); // 1フレーム目からフック

    // ログを書く
    await until(T.seg1 - 0.4);
    await page.getByText('今日の仕事ログを書く').first().tap();
    await page.locator('textarea').first().waitFor();
    await cap(1);
    await until(T.seg1 + 1.0);
    await page.locator('textarea').first().pressSequentially(LOG_TEXT, { delay: 90 });

    // タグ→保存→ホームの反応
    await until(T.seg1 + 5.2);
    const tag = page.getByText('現場調整').first();
    await tag.scrollIntoViewIfNeeded();
    await until(T.seg1 + 6.0);
    await tag.tap({ force: true });
    await until(T.seg2); await cap(2);
    const save = page.getByText('保存する').last();
    await save.scrollIntoViewIfNeeded();
    await until(T.seg2 + 0.9);
    await save.tap();

    // 記録タブ(タブ押下はWeb書き出しで反応しないため直接遷移)
    await until(T.seg2 + 2.7);
    await page.goto(base + '/timeline', { waitUntil: 'domcontentloaded' });
    await page.getByText('記録').first().waitFor();
    await cap(3);

    // キャリア変換 = オチ
    await until(T.seg3);
    await page.goto(base + '/career', { waitUntil: 'domcontentloaded' });
    await page.getByText('職務経歴書風').first().waitFor();
    await cap(4);
    await until(T.seg3 + 2.1);
    await page.getByText('歩行が不安定な患者さん').first().tap({ force: true });
    await until(T.seg3 + 2.8);
    const gen = page.getByText('生成する（2コイン）');
    await gen.scrollIntoViewIfNeeded();
    await gen.tap();
    await until(T.seg3 + 3.6);
    await cap(5);
    await until(T.seg3 + 4.2);
    await page.mouse.wheel(0, 260);
  },
};
