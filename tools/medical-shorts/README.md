# 医療雑学ショート動画パイプライン(Blender + VOICEVOX + ffmpeg)

縦型 9:16・45〜60 秒の 3D 解説動画を、台本から完成 mp4 まで人の手を入れずに作る開発用ツール。
サイト本体からは独立していて、公開ページには含まれない(ナビ・サイトマップ・一覧に載せない)。
`tools/ugc-video`(ナレーション音声化 `tts.sh`・BGM `make-bgm.py`)を再利用している。

第 3 弾「蚊に刺されると、なぜかゆい?」が初の実装。第 1〜2 弾(正座のしびれ・ガムの消化)はこのリポジトリに実装が見つからなかったので、存在を仮定せず、ここにあるもの(ugc-video・showreel/film の描画の作法)から組んだ(2026-11-07)。

## 仕組み

```
script.json(台本) → timeline.py(tts.sh で音声化 → 実測の長さから時間割 timing.json。45〜60 秒に自動で収める)
                 → episodes/<ep>/scene.py(bpy でシーンを手続き的に生成。timing.json の区間に合わせてキーを打つ。
                                         ラベルの画面座標 anchors.json と幾何の検証値 qa_scene.json も書く)
                 → render.py(Cycles CPU、1 コマの時間上限つき、途中再開可)
                 → subs.py(字幕・題・対象物に付いていく札を ASS に)
                 → mux.sh(コマ + 音声 + BGM + 字幕 → 1080x1920 H.264/AAC)
                 → qa.py(自動品質チェック → out/qa.json・qa-report.md)
```

一括: `bash tools/medical-shorts/make.sh tools/medical-shorts/episodes/mosquito`(各段は失敗したら 1 回だけやり直す)。

## セットアップ(セッションごとに 1 回)

```sh
bash tools/medical-shorts/setup.sh      # apt(ffmpeg・Noto CJK・Open JTalk・GL)、pip(bpy・Pillow)
```

- **Blender** は `bpy`(PyPI の Blender モジュール、5.2 LTS)で入る。`blender` 本体は不要。描画は Cycles(CPU)。EEVEE は Xvfb 下で動くが CPU では Cycles より遅い
- **VOICEVOX** は `VOICEVOX_URL`(既定 `http://127.0.0.1:50021`)で届く VOICEVOX 互換エンジンを使う。配布が GitHub Releases と Docker Hub だけなので、どちらも遮断・制限される環境では **公式エンジンを公開している HTTP エンドポイント**(Hugging Face Spaces 等)の URL を `VOICEVOX_URL` に指す。届かなければ `tts.sh` が Open JTalk(Mei)に落ちる。話者は `VOICEVOX_SPEAKER`(既定 2 = 四国めたん)
- 2026-11-07 の実測: GitHub 403・Docker Hub は匿名 pull の回数制限(2 回で打ち切り)・Hugging Face は到達可。`VOICEVOX_URL=https://meowsky49887-voicevox-engine.hf.space` で合成した

## エピソードの作り方

`episodes/<名前>/` に 2 つ置く。

- `script.json` — 文ごとに `text`(ナレーション)・`sub`(字幕。2 行・1 行 18 字まで)・`min`(区間の最短秒)・`cue`(シーンの合図の名)・`labels`(画面に出す札)・`title`(上に出す題)。`fps`・`target_seconds`・`gap_after_line`・`end_hold`・`speaker` も
- `scene.py` — bpy のシーン。`timing.json` の `segments[].cue` を読んで、区間の開始・終了にキーを打つ。カメラのカット位置・口器の深さなどを `qa_scene.json` に書く(`qa.py` が読む)

時間割は音声が先。各区間 = max(音声の長さ + `gap_after_line`, `min`)。合計が目標を超えたら話速を上げて作り直す(最大 2 回)。

## 描画の予算

4 コア CPU の実測(1 コマ、Cycles 16 サンプル・denoise・時間上限 5 秒・persistent data):
720x1280 で 6〜9 秒。1344 コマ(24fps・56 秒)で約 2.5〜3 時間。1080x1920 では 25〜40 秒/コマで現実的でない。
`render.py --res 720x1280 --timelimit 5` で描き、`mux.sh` が lanczos で 1080x1920 に拡大する。
環境変数 `SHORTS_RES` / `SHORTS_TIMELIMIT` / `SHORTS_SAMPLES` で変えられる。

## 品質チェック(qa.py)

自動: 尺・解像度・fps・音声・コマの欠け・黒画面・平坦なコマ・カット以外の跳び・区間ごとの視覚的変化・字幕と音声の同期・各文の音の有無・ラウドネス・口器と皮膚の位置関係・蚊の部品数・字幕の可読性・字幕とナレーションの一致・cue の 1:1。
未検証(人が見る): 蚊の見た目の説得力・医学的な表現の妥当性・読みの誤り・脚の接地などの幾何。

## 再利用できるもの(次のエピソード向け)

- `timeline.py` / `subs.py` / `render.py` / `mux.sh` / `qa.py` / `make.sh` はエピソードに依存しない
- `scene.py` の部品: `material`(赤みの減衰つき)、`slab`(層の箱+膨らみのシェイプキー)、`poly_curve`(血管・神経・脚)、`cylinder_between`、`sphere`、`cam_key`(見る先を指定してキー、`cut=True` でハードカット)、`fcurves`(Blender 5 の階層アクション対応)、`project`(ラベルの錨の画面座標)、Follow Path による信号の玉
- 親子付けの注意: `parent` を付けると「作ったときの世界座標」が保たれる(親の逆行列)。支点の子は世界座標で作る

## ライセンス表記(公開時)

- VOICEVOX 使用時: 「VOICEVOX:四国めたん」(キャラクター規約に従う)
- Open JTalk(Mei)使用時: 「音声: MMDAgent (Mei) / Nagoya Institute of Technology」(CC BY 3.0)
- フォント: Noto Sans CJK(SIL OFL)
