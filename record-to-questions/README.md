# Record to Questions

画面録画を、問題集に。

学習サイトや問題演習アプリを画面録画した動画から、問題番号・問題文・選択肢(画面にあれば正解・解説)を取り出し、編集できる形に整えて Markdown / TXT / PDF で書き出す Web アプリ。

目的は「動画を PDF にすること」ではなく、**画面録画した問題演習を、再利用できる問題データに変えること**。

> 利用者自身が閲覧する権限を持つ教材を、個人の学習のために整理する道具として作っている。共有・公開の機能は持たない。

## ローカルで動かす

必要なもの: Node.js 20 以上 / ffmpeg(`ffmpeg` と `ffprobe` にパスが通っていること)

```bash
cd record-to-questions
npm install
npm run dev          # http://localhost:3000
```

- 初回の `npm run dev` / `npm run build` の前に、PDF 用フォント(BIZ UDゴシック、OFL)を `public/fonts/` に取得する(`npm run setup` と同じ)
- 初回の解析時に、OCR の日本語データ(約 2MB)を `.cache/tessdata/` に取得する。以降はそれを使う
- macOS は `brew install ffmpeg`、Ubuntu は `sudo apt install ffmpeg`

### テスト

```bash
npm test             # 単体テスト(問題分割・行の結合・フレーム選択・書き出し)
npm run sample-video # 検証用の画面録画を合成(架空の練習問題10問・スクロールと見直しを含む)
npm run test:e2e     # 合成録画を実際に解析し、10問が欠落・重複・順序崩れなく取れるかを確かめる
RTQ_VIDEO=~/Movies/rec.mov npm run test:e2e   # 手元の録画で試す(結果は tests/fixtures/out/report.md)
npm run typecheck && npm run lint
```

## 設計

### 1. 技術構成

| 層 | 採用 | 理由 |
|---|---|---|
| 画面・API | Next.js 15 (App Router) / TypeScript / React 19 | 画面と API を1つのプロジェクトで持てる |
| 見た目 | Tailwind CSS 4、shadcn/ui の作法で書いた最小の部品(`components/ui/`) | 部品は数点で足りるため、Radix 等の依存は足していない |
| 動画処理 | システムの ffmpeg を子プロセスで呼ぶ | 確実で速い。npm 依存を増やさない |
| OCR | tesseract.js(サーバー内の WebAssembly) | 無料・外部送信なし・日本語対応。`OCRProvider` で差し替え可能 |
| PDF | pdf-lib + fontkit(ブラウザ内で生成) | 日本語フォントをサブセット埋め込み。編集中のデータをサーバーに戻さない |
| 保存 | ブラウザの IndexedDB | DB 不要。`ProjectRepository` で Supabase / PostgreSQL へ移せる |

追加した依存は `tesseract.js` `pdf-lib` `@pdf-lib/fontkit`(本体)と `vitest` `playwright-core`(検証用)だけ。

### 2. ディレクトリ

```
app/
  page.tsx                 トップ(動画選択 → 解析の進み具合)
  projects/[id]/page.tsx   結果の編集(一覧 / 編集 / 元画像)
  api/process/route.ts     動画を受け取り、進み具合を NDJSON で返す
components/                VideoUploader / ProcessingStatus / QuestionList / QuestionEditor / SourcePreview / ExportMenu / ui/
lib/
  config.ts                調整用の定数(閾値はすべてここ)
  video/                   ffmpeg 呼び出し、サムネイル・フレームの書き出し
  image/deduplicateFrames.ts  フレームの選択・重複除去・固定ヘッダー/フッターの検出
  ocr/                     OCRProvider(差し替え口)、TesseractProvider、OCR 文字列の正規化
  parser/                  mergeOCRText(フレーム間の結合)、questionParser / patterns(問題への分割)
  structurer/              QuestionStructurer(OCR → 問題の差し替え口。今はルールベース)
  pipeline/processVideo.ts 動画 → 問題の一連の処理
  export/                  markdown / text / pdf
  storage/                 ProjectRepository(差し替え口)、IndexedDB 実装
types/                     question / ocr / project / pipeline
tests/                     unit / integration / fixtures(合成録画の生成)
```

### 3. 動画処理

1. 2枚/秒で幅 90px のグレースケール画像を取り出す(比較用。軽い)
2. **固定帯の検出**: 動画全体で画素が変わらない上下の帯 = ステータスバー・アプリのヘッダー・「次へ」ボタン
3. 固定帯を除いた本文部分で、隣り合う画像を比べて分類する
   - ほぼ同じ → 止まっている
   - 縦にずらすと重なる → スクロール(ずれ量も推定)
   - どうずらしても重ならない → 画面の切り替え(次の問題)
4. 残すフレーム: 最初に落ち着いた画面 / 切り替え後に落ち着いた画面 / スクロール中は画面の 55% 動くごと(読み残しを出さない)/ スクロールが止まった画面
5. 既に残した画像とほぼ同一のものを捨て、残ったものだけを原寸 PNG で書き出して OCR へ

閾値は `lib/config.ts` の `FRAME_SELECTION`。合成録画での実測(スクロール 0.002〜0.010 / 問題の切り替え 0.020〜0.040)をコメントに残してある。

### 4. OCR と問題への整理

```
フレームごとの OCR(行と位置を保持)
 → 固定帯・信頼度の極端に低い行を除く
 → 行単位で前後のフレームの重なりを探してつなぐ(OCR の読み揺れは類似度で吸収)
   ・同じ画面の見直しや戻るスクロールは「既に読んだ行」として足さない
 → 問題番号の行で区切り、問題文・選択肢・正解・解説に分ける
 → Question[](rawText に OCR の文字列をそのまま保持)
```

- 問題番号: `問1` `問 1` `第1問` `問題1` `Q1` `【問1】` `問十二`、OCR の読み誤り `間1`
- 選択肢: `1.` `1)` `(1)` `①` `ア` `a)`。番号が 1 から順に続くときだけ選択肢とみなす(本文中の「3. 年に〜」等を誤認しない)
- 問題文中の「ア〜エ」の列挙のあとに「1.〜5.」が来たら、前の列挙は問題文の一部(組み合わせ問題)
- 欠けた番号・重複した番号・選択肢を読めなかった問題は、編集画面に「確認したほうがよい点」として出す

**AI による整形**は `QuestionStructurer` を実装すれば差し込める(OCR とは独立)。してよいのは誤字・改行の修正と構造の認識だけで、問題の中身の書き換えと正解・解説の創作はしない。`rawText` は上書きしない。外部 API に送る実装は利用者データを外へ出す変更なので、v0.1 では入れていない。

### 5. 難所と対処

| 難所 | 対処 |
|---|---|
| スクロールで同じ行が何度も映る | 行単位の重なり検出。端の読み崩れた行は2行まで読み飛ばす |
| 固定ヘッダー/フッターが毎回 OCR される | 画素で固定帯を検出して除く(OCR の揺れに左右されない) |
| 固定バーに半分隠れた行がゴミ文字になる | 信頼度の極端に低い行を捨てる |
| 小さな比較画像では「別の問題」の差が小さい | 画像段階では完全に近い重複だけを捨て、見直し等の重複は文字段階で除く |
| Tesseract が日本語の文字間に空白を入れる | 日本語の文字に挟まれた空白を取る(選択肢記号「ア 」の後は残す) |
| 誤字(「判断」→「選断」等) | v0.1 は手で直す前提。元画像と並べて見比べられるようにした。精度は OCRProvider の差し替えか AI 整形で上げる |

### 6. プライバシー

- 動画と書き出したフレームは OS の一時ディレクトリに置き、成功・失敗・中断のどれでも処理の最後に削除する
- 確認用の縮小画像と問題データはブラウザの IndexedDB にだけ保存する(サーバーには残らない)
- OCR はサーバー内で完結し、画像を外部に送らない(取得するのは OCR の言語データだけ)

## 今の限界

- 1本の解析は1回のリクエストで行う。数分を超える長い録画は、リバースプロキシやホスティングのタイムアウトに注意(`maxDuration` は 900 秒)
- 縦書き・画像の中の文字・表は対象外
- 合成録画では 10問すべてを正しく分けられるが、実際のアプリの録画での精度は未検証。`RTQ_VIDEO` で手元の録画を流し、`lib/config.ts` の閾値を調整する
- `npm audit` の指摘(braces / postcss)は Next.js 15 のビルド時の依存で、利用者の入力が届く経路ではない。Next.js 16 への更新で解消する

## まだ作らないもの

ユーザー登録・課金・共有・問題集マーケット・Anki 連携・自動採点・AI 解説・学習履歴・復習・モバイルアプリ。

将来は「問題 DB → 出題 → 採点 → 間違えた問題だけ復習」や、CSV / Anki / Notion への書き出しに広げられるよう、問題データ(`types/question.ts`)と保存先(`ProjectRepository`)を分けてある。
