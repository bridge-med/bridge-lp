# UGC動画パイプライン

プロダクトの操作画面を自動録画し、ナレーション・テロップ・BGM付きの
縦型ショート動画(1080x1920 mp4)を全自動で生成するツール。
サイト本体からは独立した開発用ツールであり、公開ページには含まれない。

## 仕組み

```
台本(scenario) → ナレーション音声化(Open JTalk)
              → 画面の自動操作+録画(Playwright、テロップ・タップ表示を注入)
              → 合成(ffmpeg) → shorts/xxx.mp4
```

## セットアップ(セッションごとに1回)

```sh
bash tools/ugc-video/setup.sh
```

apt(open-jtalk・ffmpeg・日本語フォント)、npm(playwright)、
PyPIから女声Meiモデルの抽出を行う。ネットワークはapt/PyPIのみ必要。

## 生成

```sh
bash tools/ugc-video/make-short.sh
```

`work/` 以下に中間ファイル、完成品は `work/moyamoya_short.mp4`。

## 構成ファイル

- `scenario.js` — 台本。ナレーション文・テロップ・タイムライン(秒)・画面操作
- `record.js` — Playwright録画ランナー(テロップ・タップリップル・エンドカード注入)
- `make-bgm.py` — アンビエントBGMを波形合成で生成
- `mix.sh` — 録画webm+音声をffmpegで合成
- `setup.sh` / `make-short.sh` — セットアップと一括実行

タイムラインは `scenario.js` の `T` が唯一の情報源。
ナレーション各文の長さが各スロットに収まるよう、変更時は
`ffprobe` で実測して確認すること(make-short.shが警告を出す)。

## 音声の品質について(既知の制約)

現状の声はOpen JTalk+Mei(HMM方式)。聞き取れるが機械感が強い。
上位互換の候補は VOICEVOX(ニューラル・無料・商用可)だが、
配布がGitHub Releasesのため、リモート環境のGitHubアクセス制限
(セッションのリポジトリスコープ)に阻まれる。ネットワークポリシーが
開いたセッションで `setup.sh` のVOICEVOX節を有効化する予定。

## ライセンス表記(動画を公開する場合に必須)

- ナレーション音声(Mei): MMDAgent "Mei" — CC BY 3.0。
  表記例「音声: MMDAgent (Mei) / Nagoya Institute of Technology」
- VOICEVOX導入後はキャラクター規約に従う(例「VOICEVOX:四国めたん」)
