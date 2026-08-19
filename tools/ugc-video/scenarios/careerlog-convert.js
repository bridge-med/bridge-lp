// 台本 — キャリアログ / キャリア変換編(変換先いろいろ) ショート v1
// 型は全体紹介編(careerlog.js)に準拠。声=ずんだもん・テロップ標準語・BGMなし。
// 核: 同じ記録が、行き先に合わせて言葉を変えて出てくる。「書いた過去は、使い回せる」
// ナレーション・テロップ・スタブ文はeditor稿(2026-07-20)。

const common = require('./careerlog-common.js');

const STUB_A_RESUME = [
  '【職務経歴書風(下書き)】',
  '',
  '■ 新人指導 / 介助技術の言語化',
  '新人スタッフの移乗介助に付き添い、うまくいくコツを一緒に言葉にして共有した。',
  '感覚的な手技を、後輩が再現できる手順に落とし込んだ。',
  '',
  '・強み: 経験を、人に渡せる形に翻訳する',
  '・書ける観点: 育成 / 技術の標準化 / 言語化',
  '',
  '※ログをもとにした下書きです。仕上げはあなたの言葉で。',
].join('\n');

const STUB_A_INTERVIEW = [
  '【面接回答風(下書き)】',
  '',
  'Q. チームでの工夫を教えてください。',
  'A. 新人の移乗介助に付き添った際、うまくいく感覚を二人で言葉にしながら、',
  '後輩が再現できる手順に整理しました。個人の技術を、チームで共有できる',
  '形に変えることを意識しています。',
  '',
  '※話し言葉の下書きです。あなたの声で調整してください。',
].join('\n');

const STUB_A_1ON1 = [
  '【1on1資料風(下書き)】',
  '',
  '■ 力を入れたこと',
  '・新人指導: 移乗介助のコツを言語化し、手順として共有',
  '・相談したいこと: 育成の工夫を、評価にどうつなげるか',
  '',
  '※上長との1on1のたたき台です。',
].join('\n');

module.exports = {
  name: 'careerlog_convert_short',
  page: '/bridge-lp/daily-app/',
  serverRoot: '..',
  bgm: false,
  viewport: { width: 540, height: 960 },
  voice: { engine: 'voicevox', speaker: 3 }, // ずんだもん(ノーマル)
  T: { seg0: 0.2, seg1: 6.8, seg2: 14.2, seg3: 21.2, seg4: 27.4, end: 32.6 }, // 実測尺(ずんだもん)に合わせ調整

  lines: [
    '一週間ちゃんと働いたのに、職務経歴書の欄は、真っ白なままなのだ。',
    'ためた記録をキャリア変換にかければ、まず職務経歴書風の下書きになるのだ。',
    '同じ記録を面接回答風に切り替えると、そのまま話し言葉の答えに変わるのだ。',
    '1on1資料にも自己PRにも、行き先に合わせて仕立て直せるのだ。',
    '気になったら、キャリアログで検索してみてほしいのだ。',
  ],

  captions: [
    '一週間ぶん、働いた\n職務経歴書の欄は、まだ真っ白',
    'ためた記録を、キャリア変換',
    'まず、職務経歴書風の下書き',
    '同じ記録が、面接回答風に',
    '1on1資料風にも、仕立て直せる',
    '書いた過去は、使い回せる',
    '',
  ],
  heroCap: 0,

  endCard: {
    title: 'キャリアログ',
    sub: '同じ記録を、行き先に合わせた言葉に・iPhoneアプリ',
    search: 'キャリアログ',
    badge: 'BRIDGE',
    credit: 'VOICEVOX:ずんだもん',
  },

  // デモ週ログ注入+AIスタブ(生成回数で下書きを切替。editor稿)
  async setup(ctx) {
    await common.seedStorage(ctx);
    let n = 0;
    const bodies = [STUB_A_RESUME, STUB_A_INTERVIEW, STUB_A_1ON1];
    await ctx.route(/supabase\.co\/functions\/v1\/ai/, (route) => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ text: bodies[Math.min(n++, bodies.length - 1)] }),
      });
    });
  },

  async run(page, { until, cap, T }) {
    const base = 'http://127.0.0.1:8123/bridge-lp/daily-app';
    await page.getByText('今日の仕事ログを書く').first().waitFor();
    await cap(0);

    // フック後半で「たまった記録」を見せる
    await until(3.6);
    await page.goto(base + '/timeline', { waitUntil: 'domcontentloaded' });
    await page.getByText('新人さんの移乗介助').first().waitFor();

    // キャリア変換 → 職務経歴書風
    await until(T.seg1);
    await page.goto(base + '/career', { waitUntil: 'domcontentloaded' });
    await page.getByText('職務経歴書風').first().waitFor();
    await cap(1);
    await until(T.seg1 + 1.6);
    await page.getByText('新人さんの移乗介助').first().tap({ force: true });
    await until(T.seg1 + 2.2);
    await page.getByText('生成する（2コイン）').tap();
    await until(T.seg1 + 3.2);
    await cap(2);
    await page.mouse.wheel(0, 340);

    // 面接回答風に切替 → 再生成
    await until(T.seg2);
    await page.mouse.wheel(0, -340);
    await until(T.seg2 + 0.5);
    await page.getByText('面接回答風').first().tap({ force: true });
    await until(T.seg2 + 1.2);
    await page.getByText('新人さんの移乗介助').first().tap({ force: true });
    await until(T.seg2 + 1.8);
    await page.getByText('生成する（2コイン）').tap();
    await until(T.seg2 + 2.8);
    await cap(3);
    await page.mouse.wheel(0, 340);

    // 1on1資料風もちらり
    await until(T.seg3);
    await page.mouse.wheel(0, -340);
    await until(T.seg3 + 0.5);
    await page.getByText('1on1資料風').first().tap({ force: true });
    await until(T.seg3 + 1.2);
    await page.getByText('新人さんの移乗介助').first().tap({ force: true });
    await until(T.seg3 + 1.8);
    await page.getByText('生成する（2コイン）').tap();
    await until(T.seg3 + 2.8);
    await cap(4);
    await page.mouse.wheel(0, 340);
    await until(T.seg3 + 4.6);
    await cap(5);
  },
};
