# BRIDGE Webサイト 情報設計書(IA v2.0)

> 「読むサイト」から「歩くサイト」へ。
> UI・UX・情報設計そのものが「人は自ら選び、納得して進むことで最も幸福になれる」という思想を表現する。

---

## 1. サイトマップ

```
/                       Home           … 世界観だけを伝える(3〜5画面)
├── philosophy/         Philosophy     … 思想の全文(Why / MVV / リハとは / Thinking / Principles / Manifesto)
├── projects/           Projects       … 活動一覧(PMI / AI / 教育 / 研究 / アプリ開発 / 発信)+ Roadmap
├── products/           Products       … プロダクトカタログ(カテゴリ別・全17点)
│   ├── rehaboard/ 等   個別プロダクト … 既存の独立ページ群(そのまま活用)
├── stories/            Stories        … 選択肢が増える瞬間(患者/医療者/組織/キャリア/AI)
├── journal/            Journal        … BRIDGE Journal(note記事+タグ探索+実験室)
├── research/           Research       … 研究の姿勢 / 関心領域 / 業績
├── about/              About          … 名前の由来 / 歩み / Founder / 概要
├── community/          Community      … 参加の仕方(読む/話す/使う/作る)
└── legal/              Privacy 等     … 既存のまま
```

## 2. 情報設計(IA)の原則

1. **Homeは玄関、説明はしない** — Homeの役割は「BRIDGEとは何か」の一言と、探索の地図を渡すことだけ。
2. **1ページ=1つの問い** — Philosophy「なぜ?」/ Projects「いま何を?」/ Products「何が使える?」/ Stories「何が変わる?」/ Journal「途中はどうなってる?」/ Research「確かめたのか?」/ About「誰が?」/ Community「どう関わる?」
3. **深さは3階層まで** — Home → セクションページ → 個別ページ。それ以上掘らせない。
4. **どのページからでも次へ歩ける** — 全ページ末尾に「Where to next(次はどこへ歩きますか)」の3分岐。行き止まりを作らない。
5. **押し付けない** — CTAは常に複数(読む/話す/使う/作る)。「何もしなくても十分」を明文化。

## 3. ナビゲーション設計

### デスクトップ(>920px)
- 固定ヘッダー(スクロールで背景ブラー+ボーダー)
- 左:ロゴ(→Home) / 右:Philosophy · Projects · Products · Stories · Journal · Research · About(テキストリンク、現在地はアンダーライン)+ Community(ボタン)+ テーマ切替
- Mega Menuは現段階では不採用(ページ数8ではフラットの方が認知負荷が低い)。ページが15を超えたら「思想/活動/道具/つながる」の4グループでMega Menu化する。

### モバイル(≤920px)
- ロゴ+ハンバーガー+テーマ切替のみ
- ハンバーガー → フルスクリーン「探索の地図」:全ページ+各1行の説明を縦に列挙(順に立ち上がるアニメーション)。説明付きにすることで、メニュー自体が「選べる地図」になる。

### フッター
- 全ページ共通のサイトマップ(思想/活動/つくったもの/つながる の4列)。ページの最後に、もう一度地図を渡す。

## 4. 各ページの役割

| ページ | 役割 | 想定滞在 | 主な次の一歩 |
|---|---|---|---|
| Home | 世界観の提示と探索の起点 | 30秒〜2分 | Philosophy / Products |
| Philosophy | 思想の全文。共感の醸成 | 5〜10分 | Projects / Stories / Community |
| Projects | 思想が動いている証拠 | 2〜3分 | Products / Research / Journal |
| Products | 道具に触れる入口 | 2〜5分 | 個別プロダクト / Starter Kits |
| Stories | 感情が動く場所 | 3〜5分 | Philosophy / Community |
| Journal | 過程の公開。継続的な再訪先 | 回遊 | note / Products |
| Research | 信頼の担保 | 1〜3分 | Projects / Journal |
| About | 名前の由来と人 | 1〜3分 | Philosophy / Community |
| Community | 関係の始まり(非販売) | 1〜2分 | メール / X / note |

## 5. ワイヤーフレーム(概略)

```
[Home]                     [Philosophy]              [一覧系(Projects/Products/…)]
┌──────────────┐    ┌──────────────┐   ┌──────────────┐
│ Nav(固定)      │    │ Nav            │   │ Nav            │
│ Hero           │    │ PageHero+目次  │   │ PageHero       │
│  変化を、       │    │ Why(4行→転調) │   │ (1行の問い)    │
│  自分の力に。   │    │ MVV 3カード    │   │ 一覧(データ駆動)│
│ BRIDGEとは(3行)│    │ リハとは+図解  │   │  …行/カード…   │
│ 探索マップ(6枚)│    │ Thinking 6段   │   │ 補足セクション  │
│ 代表プロダクト3 │    │ Principles 5行 │   │ Where to next  │
│ Manifesto 3行  │    │ Manifesto(夜) │   │ Footer(地図)   │
│ CTA            │    │ Where to next  │   └──────────────┘
│ Footer(地図)   │    │ Footer         │
└──────────────┘    └──────────────┘
```

## 6. UIコンポーネント一覧(shared/bridge.css)

| コンポーネント | クラス | 用途 |
|---|---|---|
| 固定ヘッダー | `.site-nav` | 全ページ。JSが描画 |
| 探索ドロワー | `.nav-drawer` | モバイル・フルスクリーンメニュー |
| ページヒーロー | `.page-hero` | 下層ページ共通(パンくず+h1+リード) |
| 見出し | `.eyebrow` `.sec-h` `.stmt` | ラベル/見出し/明朝ステートメント |
| カード | `.card` `.card-tag/-t/-p/-link` | 汎用カード |
| 行リスト | `.rows` `.row` | 一覧(Projects等) |
| チップ/タグ | `.chip` `.tag` | ステータス表示/フィルタUI |
| ボタン | `.btn.primary` `.btn.ghost` | CTA |
| 分岐ナビ | `.walk` `.walk-card` | ページ末尾の「次はどこへ」 |
| フッター | `.site-footer` | サイトマップ。JSが描画 |
| Reveal | `[data-reveal]` | スクロール表示(IntersectionObserver) |
| テーマ | `[data-theme]` | ライト/ダーク(localStorage永続) |

## 7. ページ遷移図

```
                 ┌─────────── Home ───────────┐
                 ↓        ↓        ↓          ↓
           Philosophy  Projects  Products   (探索マップ経由で全ページへ)
                 │        │        │
                 │        │        └→ 個別プロダクト(rehaboard/ 等)
                 ↓        ↓
              Stories  Research/Journal
                 │        │
                 └────┬───┘
                      ↓
                 Community ←──(全ページの walk / nav CTA から)
                      ↓
              メール / X / note(外部)

※ 全ページ末尾の「Where to next」3分岐+フッター地図により、任意のページ間を行き来できる(行き止まりなし)。
```

## 8. モバイルUX

- ハンバーガー→フルスクリーン地図(説明付きリンク)。タップ領域は44px以上。
- 一覧はすべて1カラムに畳む。行リストは番号を隠し要点のみ。
- 固定ヘッダーは12px+blurで薄く。スクロール量の多いPhilosophyのみsticky目次を追加。
- アニメーションは`prefers-reduced-motion`で全停止。

## 9. デスクトップUX

- フラットな7リンク+CTAボタン。現在地アンダーライン。
- ホバーで下線が左から伸びる/カードが浮く——「進める」ことを触覚的に示す。
- 本文の最大幅は660px(可読行長)。ステートメントは明朝・最大1180px。
- ライト/ダークは同一トークン(`--bg`等)の差し替えのみで完全対応。

## 10. 拡張性(100件以上に耐える設計)

- **プロダクト** … `products/index.html`の`PRODUCTS`配列に1オブジェクト追加するだけ。カテゴリは`CATS`配列で管理し、カテゴリごとのセクションは自動生成。カテゴリ追加も1行。
- **活動** … `projects/index.html`の`ACTIVITIES`配列。同上。
- **記事** … `journal/index.html`は`notes/feed.json`(noteのRSSから自動生成)を読み込み、タイトル・本文からタグを自動付与。記事が増えても手作業ゼロ。タグは`TAGS`配列で追加。
- **物語** … `stories/index.html`の`STORIES`配列。
- **ナビ/フッター** … `shared/bridge.js`の`NAV`配列が唯一の情報源。ページ追加時はここに1行足せば全ページのヘッダー・ドロワー・フッターに反映される。
- **将来のMega Menu化** … ページ数が15を超えたら、`NAV`にグループキーを足してヘッダーをグループ型に切り替える(構造は既にデータ駆動なので、描画関数の変更のみ)。
- **個別記事をサイト内に持つ場合** … `journal/posts/xxxx.html`を追加し、`feed.json`相当のローカルインデックス(`journal/index.json`)を併設する設計を推奨。

---

### 変更履歴
- v2.0 (2026-07-11): 1ページLP構成 → マルチページのブランドサイトへ全面再設計。

## 11. 写しの運用(プロダクト詳細ページ)

- LPが実物について述べる事実(画面名・項目名・色分け・数値・件数)は、同じページ上で照合できる形で示す。原則として、無加工の実物の写し1枚と、その撮影日を記す。
- 写しは体験の代替ではなく、照合の錨である。デモへの導線(憲法第28条の「触れる瞬間」)を写しで置き換えない。
- 写し自体はテーマに追従しない。枠・キャプション・余白は両テーマで等価に設計する(第22条後段)。
- 実物が変わったら写しを撮り直す。すぐ撮り直せないなら、古い撮影日のまま掲げる——日付が古さを自己申告する。
