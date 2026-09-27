# BRIDGE 紹介動画

発信(X・note など)で使う紹介動画の作り方一式。サイトのページではない(ナビ・一覧から結線しない)。

すべての出来事を `timeline.js` の「拍」で書く。映像(`index.html`)も音(`make_audio.py`)も同じ拍の番号を読むので、ずれない。

## 作り方

```
python3 fetch_fonts.py   # 動画に出る文字だけの部分フォントを fonts/ に取る(文言を変えたら再実行)
python3 make_voice.py    # 台本を Gemini 3.8 Flash TTS で読み上げて voice/ に置く(要 GEMINI_API_KEY)
python3 make_audio.py    # 音楽を計算で作り、声を拍に置いて audio.wav に
python3 render.py        # 画面なしの Chrome で 1 コマずつ描き、video.mp4 に
ffmpeg -i video.mp4 -i audio.wav -c:v copy -c:a aac -b:a 192k -shortest bridge-intro.mp4
```

- 声の聞き比べ: `python3 make_voice.py --samples Sulafat,Schedar,Charon,Vindemiatrix`
- 一部のコマだけ確かめる: `python3 render.py --frames 470 --png-dir check`
- 依存: numpy, playwright(同梱の Chromium を使う), imageio-ffmpeg
- `index.html` をブラウザで直接開くと、その場で再生する(フォントは fetch_fonts.py の後)

## 決めごと

- 色は `shared/bridge.css` のトークンの値だけ。文字は炭、藍は線、砂は分岐点の点とロゴの一本だけ(憲法第22条)
- 数字(回数・版・個数)で語らない。道具は名前と実画面で見せる(2026-09-26 社長指示)
- 実画面は `images/products/thumbs/` をそのまま読む(無加工・縦横比そのまま)
- 声は合成音声。台本に一人称を出さない(本人の声のように聞こえるのを避ける・第13条)
