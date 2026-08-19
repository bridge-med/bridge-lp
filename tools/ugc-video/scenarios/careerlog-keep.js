// 台本 — キャリアログ / 続く仕組み編(さっとメモ) ショート v1
// 型は全体紹介編(careerlog.js)に準拠。声=ずんだもん・テロップ標準語・BGMなし。
// 核: ちゃんと書けない日は1行でいい。続けられる仕組み(相棒・連続記録)が支える。
// ナレーション・テロップはeditor稿(2026-07-20)。
//
// 誠実の注記:
// - さっとメモ・相棒・連続日数・XP・そだちはローカル完結のため、AIスタブは不要。
// - デモログは「昨日までの7日ぶん」を注入し、録画中の保存で連続日数が実際に
//   7日→8日へ伸びる(画に出す数字は実挙動)。

const common = require('./careerlog-common.js');

const MEMO_TEXT = '歩行訓練の待ち時間、まだ少し長い気がする';

module.exports = {
  name: 'careerlog_keep_short',
  page: '/bridge-lp/daily-app/',
  serverRoot: '..',
  bgm: false,
  viewport: { width: 540, height: 960 },
  voice: { engine: 'voicevox', speaker: 3 }, // ずんだもん(ノーマル)
  T: { seg0: 0.2, seg1: 6.8, seg2: 14.2, seg3: 21.4, seg4: 27.6, end: 32.8 }, // 実測尺(ずんだもん)に合わせ調整

  lines: [
    '日記も、記録アプリも、気づけばいつも三日坊主で終わるのだ。',
    'キャリアログは、ちゃんと書けない日も、さっとメモに一行だけでいいのだ。',
    '保存すると相棒がねぎらってくれて、連続日数とXPが静かに積み上がるのだ。',
    'その積み重ねで相棒が育ち、そだち画面のレベルとバッジが増えていくのだ。',
    '気になったら、キャリアログで検索してみてほしいのだ。',
  ],

  captions: [
    '日記も、記録も\nいつも三日坊主で終わる',
    '書けない日は、さっとメモ',
    '一行だけ、書いて保存',
    '相棒がねぎらい、連続日数が伸びる',
    '続けるほど、相棒が育つ',
    '完璧じゃなくていい',
    '',
  ],
  heroCap: 0,

  endCard: {
    title: 'キャリアログ',
    sub: '書けない日は1行でいい・続く仕組みが支える・iPhoneアプリ',
    search: 'キャリアログ',
    badge: 'BRIDGE',
    credit: 'VOICEVOX:ずんだもん',
  },

  // 昨日までの7日ぶんを注入(今日の保存で連続日数が伸びる状態にする)。
  // 連続系の称号は付与済みにして、保存時の祝福は「相棒の成長」1枚だけにする
  // (保存でXPがLv.7に達し、相棒が「め」→「ふたば」に育つ画を実挙動で撮る)
  async setup(ctx) {
    await common.seedStorage(ctx, {
      endOffsetDays: 1,
      progress: { badges: ['first_log', 'streak_3', 'streak_7'] },
    });
  },

  async run(page, { until, cap, T }) {
    await page.getByText('今日の仕事ログを書く').first().waitFor();
    await cap(0);

    // さっとメモを開いて一行だけ書く
    await until(T.seg1 - 0.6);
    await page.getByText('さっとメモ', { exact: true }).first().tap({ force: true });
    await page.locator('textarea').first().waitFor();
    await cap(1);
    await until(T.seg1 + 1.2);
    await page.locator('textarea').first().pressSequentially(MEMO_TEXT, { delay: 90 });
    await until(T.seg1 + 4.6);
    await cap(2);

    // 保存 → 相棒の反応(成長・レベルアップ)をひと呼吸見せて閉じ、連続8日を見せる
    await until(T.seg2);
    const save = page.getByText(/^(残す|保存する|保存)$/).last();
    await save.scrollIntoViewIfNeeded();
    await save.tap({ force: true });
    await until(T.seg2 + 1.0);
    await cap(3);
    await until(T.seg2 + 3.6);
    const yay = page.getByText('やったね').first();
    if (await yay.isVisible().catch(() => false)) await yay.tap({ force: true });

    // そだち画面(相棒・レベル・称号)
    await until(T.seg3);
    await page.goto('http://127.0.0.1:8123/bridge-lp/daily-app/hub', { waitUntil: 'domcontentloaded' });
    await page.getByText('そだち').first().waitFor();
    await cap(4);
    await until(T.seg3 + 2.4);
    await page.mouse.wheel(0, 220);
    await until(T.seg3 + 4.2);
    await cap(5);
  },
};
