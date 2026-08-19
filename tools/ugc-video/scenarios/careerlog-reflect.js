// 台本 — キャリアログ / ふりかえり編(週次) ショート v1
// 型は全体紹介編(careerlog.js)に準拠。声=ずんだもん・テロップ標準語・BGMなし。
// 核: 金曜の5分で1週間が整理される。1on1や週報がラクになる。
// ナレーション・テロップ・下書き文はeditor稿(2026-07-20)。
//
// 誠実の注記:
// - 台本が「金曜の五分」を語るため、録画中のアプリ内時計を+4日(実収録日の月曜→金曜)に
//   進め、月曜はじまりの「今週」に平日5日ぶんのログが実在する状態で撮る。
//   デモログ自体が架空である旨は careerlog-common.js の注記どおり。
// - ふりかえりのAI生成はスタブ(下書き文はeditor稿を項目に割り付け)。公開前にeditor照合。

const common = require('./careerlog-common.js');

// 週(月〜金)に映る5件へ、下書きが言及する項目(移乗・カンファ・歩行訓練)を入れる並び
const TITLES_B = [
  common.TITLES[5], // 土: 文献をひとつ読んだ
  common.TITLES[3], // 日: ご家族への説明資料
  common.TITLES[0], // 月: 新人さんの移乗介助の言語化
  common.TITLES[1], // 火: 退院前カンファ
  common.TITLES[2], // 水: 歩行訓練の順番見直し
  common.TITLES[4], // 木: 転倒レポートの集計共有
  common.TITLES[6], // 金: 歩行介助の見直し
];

// editor稿の週次下書きを、アプリの項目(did/impressive/...)に割り付けたもの
const STUB_B_CONTENT = {
  did: '新人さんの移乗介助に付き添い、コツを言語化。退院前カンファで生活動線の情報を整理・共有。歩行訓練の順番を見直し、待ち時間を短縮。',
  impressive: '自分の工夫が、チームや患者さんの時間を軽くしたこと。',
  issues: '共有はできたが、記録として残す形は決めきれていない。',
  improved: '待ち時間や説明の伝わり方を、相手の立場から見直す視点が増えた。',
  next: '言語化した手順を、チームのメモに1枚だけ残す。',
  strengths: '職種をこえて相談しながら、形にする連携力。',
  achievements: '歩行訓練の運用見直し / 移乗介助のコツの言語化(教育)',
};

module.exports = {
  name: 'careerlog_reflect_short',
  page: '/bridge-lp/daily-app/',
  serverRoot: '..',
  bgm: false,
  viewport: { width: 540, height: 960 },
  voice: { engine: 'voicevox', speaker: 3 }, // ずんだもん(ノーマル)
  T: { seg0: 0.2, seg1: 6.8, seg2: 14.2, seg3: 20.4, seg4: 26.5, end: 31.7 }, // 実測尺(ずんだもん)に合わせ調整

  lines: [
    '週報を書こうとして、先週の自分が何をしたか思い出せず、手が止まるのだ。',
    'キャリアログには一週間の記録がたまっている。ふりかえりで今週を選ぶだけなのだ。',
    'やったこと、よかったこと、課題、そして次の一手までまとまるのだ。',
    '金曜の五分で、週報も1on1も、下ごしらえが終わっているのだ。',
    '気になったら、キャリアログで検索してみてほしいのだ。',
  ],

  captions: [
    '先週、何やったっけ\n週報の前で、手が止まる',
    '連続7日、記録がたまっている',
    '一週間のログを、ふりかえり',
    '「今週」を選ぶだけ',
    'やったこと・よかったこと・課題・次の一手',
    '金曜の5分で、1週間が整う',
    '',
  ],
  heroCap: 0,

  endCard: {
    title: 'キャリアログ',
    sub: '週の記録が、金曜の5分で1本にまとまる・iPhoneアプリ',
    search: 'キャリアログ',
    badge: 'BRIDGE',
    credit: 'VOICEVOX:ずんだもん',
  },

  // 金曜想定のデモ週ログ注入+ふりかえりAIのスタブ。
  // 称号(連続系・初ふりかえり)は付与済み・XPは低めにして、生成直後の祝福モーダル連鎖で
  // 結果の4項目が隠れないようにする(結果を見せるのがこの回の主役のため)
  async setup(ctx) {
    await common.seedStorage(ctx, {
      clockOffsetDays: 4,
      titles: TITLES_B,
      progress: {
        xp: 120,
        reflectionsCount: 1,
        badges: ['first_log', 'streak_3', 'streak_7', 'first_reflection'],
      },
    });
    await ctx.route(/supabase\.co\/functions\/v1\/ai/, (route) => {
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ content: STUB_B_CONTENT }),
      });
    });
  },

  async run(page, { until, cap, T }) {
    const base = 'http://127.0.0.1:8123/bridge-lp/daily-app';
    await page.getByText('今日の仕事ログを書く').first().waitFor();
    await cap(0);

    // フック後半: ホームの連続日数を指す
    await until(3.6);
    await cap(1);

    // 一週間のログ一覧
    await until(T.seg1);
    await page.goto(base + '/timeline', { waitUntil: 'domcontentloaded' });
    await page.getByText('新人さんの移乗介助').first().waitFor();
    await cap(2);
    await until(T.seg1 + 2.2);
    await page.mouse.wheel(0, 240);

    // ふりかえり → 「今週」を選ぶ
    await until(T.seg1 + 3.8);
    await page.goto(base + '/reflection', { waitUntil: 'domcontentloaded' });
    await page.getByText('今週（2コイン）').first().waitFor();
    await cap(3);
    await until(T.seg1 + 5.6);
    await page.getByText('今週（2コイン）').first().tap({ force: true });

    // 生成結果の4項目をゆっくり見せる(相棒の成長モーダルが出たら軽く見せて閉じる)
    await page.getByText('今週やったこと').first().waitFor();
    await until(T.seg2 - 0.6);
    const yay = page.getByText('やったね').first();
    if (await yay.isVisible().catch(() => false)) await yay.tap({ force: true });
    await until(T.seg2 + 0.6);
    await cap(4);
    await until(T.seg2 + 2.2);
    await page.mouse.wheel(0, 300);
    await until(T.seg2 + 4.2);
    await page.mouse.wheel(0, 300);

    await until(T.seg3);
    await cap(5);
    await until(T.seg3 + 1.6);
    await page.mouse.wheel(0, 300);
  },
};
