// 台本 — 職場モヤモヤ診断 ショート動画
// T(秒)が唯一のタイムライン情報源。record.js と mix.sh の両方がここを読む。
// 各ナレーションは次のセグメント開始までに収まる長さであること(make-short.shが実測して警告)。

module.exports = {
  name: 'moyamoya_short',
  page: '/moyamoya/index.html',

  // 画面サイズ(CSSピクセル)。最終出力はこの2倍(1080x1920)に拡大される
  viewport: { width: 540, height: 960 },

  // セグメント開始時刻(秒)
  T: {
    seg0: 0.6,   // トップ画面
    seg1: 7.3,   // 説明→診断開始
    seg2: 14.9,  // 設問タップ
    seg3: 20.0,  // 結果表示
    seg4: 24.6,  // エンドカード
    end: 29.5,
  },

  // ナレーション(Open JTalkで音声化される)
  lines: [
    '頑張っているのに、なんだかしんどい。そんなふうに感じること、ありませんか。',
    '職場モヤモヤ診断。10問、約3分で、しんどさの正体を言葉にします。',
    'よくある場面を、選んでいくだけ。登録はいりません。',
    '最後に、あなたのモヤモヤのタイプが分かります。',
    '気になったら、ブリッジで検索してみてください。',
  ],

  // 画面下部テロップ(空文字は非表示)
  captions: [
    '頑張ってるのに、なんだかしんどい',
    '職場モヤモヤ診断 — 10問・約3分',
    'よくある場面を、選んでいくだけ',
    'モヤモヤの正体が、言葉になる',
    '',
  ],

  // エンドカード
  endCard: {
    title: '職場モヤモヤ診断',
    sub: '登録不要・無料・約3分',
    badge: 'BRIDGE',
  },

  // 画面操作。until(秒)=タイムライン絶対時刻まで待つ / cap(n)=テロップ切替
  async run(page, { until, cap, T }) {
    await page.waitForSelector('[data-action="start"]');

    await until(T.seg0); await cap(0);
    await until(3.4);
    await page.mouse.wheel(0, 220);
    await until(T.seg1 - 0.4);

    await cap(1);
    await page.tap('[data-action="start"]');
    await page.waitForSelector('[data-action="begin"]');
    await until(11.6);
    await page.tap('[data-action="begin"]');
    await page.waitForSelector('.choice');

    await until(T.seg2); await cap(2);
    for (let q = 0; q < 10; q++) {
      const choices = page.locator('.choice');
      const n = await choices.count();
      await choices.nth(q % n).tap();
      await until(T.seg2 + 0.7 + (q + 1) * 0.55);
    }
    await page.waitForSelector('.result-hero', { timeout: 5000 });

    await until(T.seg3); await cap(3);
    await until(T.seg3 + 1.2);
    for (let i = 0; i < 6; i++) {
      await page.mouse.wheel(0, 130);
      await page.waitForTimeout(220);
    }
  },
};
