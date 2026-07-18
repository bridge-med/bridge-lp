# UGC動画パイプライン

プロダクトの操作画面を自動録画し、ナレーション・テロップ・BGM付きの
縦型ショート動画(1080x1920 mp4)を全自動で生成するツール。
サイト本体からは独立した開発用ツールであり、公開ページには含まれない。

## 仕組み

```
台本(scenario) → ナレーション音声化(tts.sh がエンジンを自動選択)
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
- `tts.sh` — ナレーション音声化。エンジンを自動選択(下記)
- `tts-sbv2.py` — Style-Bert-VITS2 での合成(モデル導入済みのとき)
- `make-bgm.py` — アンビエントBGMを波形合成で生成
- `mix.sh` — 録画webm+音声をffmpegで合成
- `setup.sh` / `make-short.sh` — セットアップと一括実行

タイムラインは `scenario.js` の `T` が唯一の情報源。
ナレーション各文の長さが各スロットに収まるよう、変更時は
`ffprobe` で実測して確認すること(make-short.shが警告を出す)。

## 音声エンジン

`tts.sh` が使えるものを上から順に自動選択する(`UGC_TTS=` で固定可)。

1. **voicevox** — VOICEVOX互換エンジン(AivisSpeech等も可)が
   `VOICEVOX_URL`(既定 `http://127.0.0.1:50021`)で応答するとき。
   話者は `VOICEVOX_SPEAKER`(既定 2=四国めたん ノーマル)
2. **sbv2** — Style-Bert-VITS2。`voices/sbv2/` にモデル一式があるとき
3. **openjtalk** — フォールバック。Open JTalk+Mei(HMM方式・機械感が強い)

話速は `UGC_TTS_RATE`(既定1.0)。エンジンを替えると各文の長さが変わるので、
`make-short.sh` の実測警告を見て `scenario.js` の `T` を調整すること。

### ニューラル音声の導入経路(2026-07-18時点の実測)

リモートセッションでは両経路とも遮断されていることを確認済み:

- **Hugging Face**(Style-Bert-VITS2のBERT・モデル取得先)— egressポリシーが
  huggingface.co / cdn-lfs へのCONNECT自体を拒否(403)
- **GitHub Releases**(VOICEVOXの唯一の配布元)— セッションのリポジトリ
  スコープ外は403。`add_repo` もクロスオーナー追加非対応(v1制限)のため不可

導入するには次のいずれかが必要:
環境のネットワークポリシーで huggingface.co を許可して `setup.sh` を再実行
(Style-Bert-VITS2節が有効化される)、またはローカルなど制限のない環境で
VOICEVOXエンジンを起動して `make-short.sh` を実行する。
setup.sh のStyle-Bert-VITS2節はHF遮断下で書いた未検証コードのため、
初回実行時にリポジトリID等を要確認。

## ライセンス表記(動画を公開する場合に必須)

- ナレーション音声(Mei): MMDAgent "Mei" — CC BY 3.0。
  表記例「音声: MMDAgent (Mei) / Nagoya Institute of Technology」
- VOICEVOX使用時はキャラクター規約に従う(例「VOICEVOX:四国めたん」)
- Style-Bert-VITS2使用時: ライブラリはAGPL-3.0(生成音声自体には及ばない)。
  JVNV系モデルはJVNVコーパス(CC BY-SA 4.0)由来のため表記を確認すること
