// 台本 — 職場モヤモヤ診断 ショート動画
// T(秒)が唯一のタイムライン情報源。record.js と mix.sh の両方がここを読む。
// 各ナレーションは次のセグメント開始までに収まる長さであること(make-short.shが実測して警告)。

module.exports = {
  name: 'moyamoya_short',
  page: '/moyamoya/index.html',

  // 画面サイズ(CSSピクセル)。録画は--force-device-scale-factor=2で実2倍(1080x1920)
  viewport: { width: 540, height: 960 },

  // セグメント開始時刻(秒)
  T: {
    seg0: 0.2,   // トップ画面(フックは0秒から表示)
    seg1: 7.8,   // 説明→診断開始
    seg2: 14.8,  // 設問タップ(前半4問ホールド・後半6問速送り)
    seg3: 21.8,  // 結果表示(ヒーローで静止→軽くスクロール)
    seg4: 26.6,  // エンドカード
    end: 31.5,
  },

  // ナレーション(Style-Bert-VITS2で音声化される)
  lines: [
    '頑張っているのに、なんだかしんどい。そのしんどさ、うまく言葉にできますか。',
    '職場モヤモヤ診断。10問、約3分で、しんどさの正体を言葉にします。',
    'よくある場面を、選んでいくだけ。登録はいりません。',
    '正体が分かれば、次の一歩は、自分で選べます。',
    '気になったら、職場モヤモヤ診断で検索してみてください。',
  ],

  // 画面下部テロップ(空文字は非表示。\nで改行)
  captions: [
    '頑張ってるのに、\nなんだかしんどい',
    '職場モヤモヤ診断 — 10問・約3分',
    '選ぶだけ・登録不要',
    'モヤモヤの正体が、言葉になる',
    '',
  ],
  heroCap: 0, // このindexのテロップは大きく中央上に出す(冒頭フック)

  // エンドカード
  endCard: {
    title: '職場モヤモヤ診断',
    sub: '登録不要・無料・約3分',
    search: '職場モヤモヤ診断', // 検索窓風CTA(無音視聴でも検索語が残るように)
    badge: 'BRIDGE',
  },

  // 画面操作。until(秒)=タイムライン絶対時刻まで待つ / cap(n)=テロップ切替
  async run(page, { until, cap, T }) {
    await page.waitForSelector('[data-action="start"]');

    await cap(0); // 1フレーム目からフックを出す
    await until(3.6);
    await page.mouse.wheel(0, 220);
    await until(T.seg1 - 0.4);

    await cap(1);
    await page.tap('[data-action="start"]');
    await page.waitForSelector('[data-action="begin"]');
    await until(13.2);
    await page.tap('[data-action="begin"]');
    await page.waitForSelector('.choice');

    await until(T.seg2); await cap(2);
    // 前半4問は読める長さでホールド、残り6問は速送り(遷移アニメはrecord.jsが無効化済み)。
    // Playwrightのtap()はactionabilityチェックで1タップ数百msかかり速送りが崩れるため、
    // DOMイベント直接発火で進める(pointerdownでリップル、clickでアプリが反応する)
    const quickTap = (idx) => page.evaluate((i) => {
      const els = document.querySelectorAll('.choice');
      const el = els[i % els.length];
      const r = el.getBoundingClientRect();
      const x = r.left + r.width / 2, y = r.top + r.height / 2;
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }));
      el.click();
    }, idx);
    for (let q = 0; q < 10; q++) {
      const tapAt = q < 4
        ? T.seg2 + 0.5 + q * 1.2
        : T.seg2 + 0.5 + 3 * 1.2 + (q - 3) * 0.35;
      await until(tapAt);
      await quickTap(q);
    }
    await page.waitForSelector('.result-hero', { timeout: 5000 });

    // 結果=オチ。テロップを消してヒーローを静止で見せてから、軽くだけスクロール
    await cap(-1);
    await until(T.seg3 + 1.5);
    await cap(3);
    await until(T.seg3 + 1.7);
    for (let i = 0; i < 2; i++) {
      await page.mouse.wheel(0, 260);
      await until(T.seg3 + 2.0 + i * 1.1);
    }
  },
};
