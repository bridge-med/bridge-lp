// 「名前になる」の写し(実物の iikae/ を撮る。時刻は reel.js)。capture.mjs が読む。4 本の take:
// pair13: あつめた言葉の頁の上部(罫・行・言いかえ)を 13 倍で。10.3〜12.7 秒の行を読む寄り(z 8.5〜9.5)を等倍で写すため。list9: 何も開いていない一覧 → 行を開く → 星 1 つ(9 倍。星だけの寄り z 7.6〜9.9 のため)。
// saved6: あつめた言葉(1 行)→ コピー(6 倍)。name13: 同じ流れの道具の名前(13 倍)。clip は撮る範囲(ページの CSS px)。
// saved6 と name13 は同じ入力を同じ仮想時刻に入れた、同じ状態の撮り直し(解像度と範囲だけが違う)。
// あつめた言葉へは、一致カット(7.5)の 0.2 秒前に移る。切った時には道具自身の立ち上がり(0.45 秒)がほぼ終わっていて、行の位置が一覧と揃う。
// 高さ 468: 撮れるのはビューポートの内だけ。知らせ「コピーしました」が釦の列の右(395〜440)に出て、注意の一文(441.9〜)より上に収まる高さ。
const row = k => `.word-row[data-key="${k}"]`;
const I = 'いつもと違うのに気づいた';
const savedPrep = [
  { swipe: 1, dist: 300, realWait: 800 },          // 高さ 468 では入口の「ことばを探す」が画面の下にあるので、少し送ってから押す
  { tap: '#intro-start' }, { wait: 1.0 },
  { swipe: 1, dist: 300, realWait: 800 },          // 高さ 468 では星が画面の下にあるので、少し送ってから押す
  { tap: row(I) + ' .word-star' }, { wait: 3.0 },
  { swipe: 8, realWait: 600 },
];
const savedEvents = [{ t: 7.3, tap: '#to-saved' }, { t: 8.4375, tap: '#saved-copy' }];
export default {
  takes: [
    {
      name: 'list9', dpr: 9, vh: 900, clip: { x: 300, y: 417, width: 900, height: 463 }, out: [3.7, 450 / 60],   // フレーム 222〜449
      prep: [{ tap: '#intro-start' }, { wait: 1.0 }],
      events: [
        { t: 4.453125, tap: row(I) + ' .word-toggle' },     // 拍 9.5: 寄り切る瞬間に行を開く
        { t: 6.09375, tap: row(I) + ' .word-star' },        // 拍 13: 星だけの寄りの中で押す
      ],
      cam: [{ t: 0, x: 720, y: 450, z: 1 }],
    },
    {
      name: 'saved6', dpr: 6, vh: 468, clipboard: true, clip: { x: 240, y: 0, width: 960, height: 468 }, out: [450 / 60, 760 / 60],   // フレーム 450〜759
      prep: savedPrep, events: savedEvents, cam: [{ t: 0, x: 720, y: 450, z: 1 }],
    },
    {
      name: 'name13', dpr: 13, vh: 468, clipboard: true, clip: { x: 340, y: 0, width: 480, height: 300 }, out: [546 / 60, 642 / 60],   // フレーム 546〜641
      prep: savedPrep, events: savedEvents, cam: [{ t: 0, x: 720, y: 450, z: 1 }],
    },
    {
      name: 'pair13', dpr: 13, vh: 468, clipboard: true, clip: { x: 340, y: 0, width: 700, height: 300 }, out: [618 / 60, 760 / 60],   // フレーム 618〜759(使うのは 632〜759)。saved6・name13 と同じ入力を同じ仮想時刻に入れる
      prep: savedPrep, events: savedEvents, cam: [{ t: 0, x: 720, y: 450, z: 1 }],
    },
  ],
};
