# トップのヒーロー素材 — 発注仕様と差し替え手順

トップ(`index.html`)の最初の画面に置く立体の素材。いまは `scripts/` ではなく `images/hero/` の4枚(CPU パストレースで描いた事前レンダ)が入っている。
同じファイル名で置き換えれば、コードを触らずに差し替わる。外部(ChatGPT 等の画像生成・3D)で作るときの仕様と、そのままのプロンプト。

## 1. ファイル(この名前で置く)

| ファイル | 用途 | 寸法 | 形式 |
|---|---|---|---|
| `images/hero/hero-pc-light.webp` | PC・ライト | 2400×1500(16:10) | WebP・**背景透過(alpha)**・目安 300KB 以下 |
| `images/hero/hero-pc-dark.webp` | PC・ダーク | 2400×1500 | 同上 |
| `images/hero/hero-sp-light.webp` | スマホ・ライト | 1200×1800(2:3) | 同上 |
| `images/hero/hero-sp-dark.webp` | スマホ・ダーク | 1200×1800 | 同上 |

- 背景は画像に**焼かない**(ページの背景色と、床の光溜まりは CSS が描く。ライト/ダークの切り替えもページ側)。影と床への映り込みは alpha 付きで焼いてよい
- 生成ツールが透過を出せない場合: 単色(#FBFAF7 ライト / #0F1A1E ダーク)の上に描いて、切り抜き(背景除去)してから納品。影は切り抜きで消えるので、その場合は「影なし」で構わない
- 文字は入れない(見出しとボタンは HTML)。ロゴも入れない
- 4枚とも**同じ造形・同じ画角**で、照明だけライト/ダークを変える。PC とスマホは**別の構図**(スマホは PC の中央切り抜きにしない)

## 2. 構図

**PC(2400×1500)**
- 主役=正式ロゴの「交差する二本の線」を、厚い青緑のガラスの板として立体化したもの。二本のまま、交差するが接続しない(憲法第24条)
- 立体は画像の**右 60%**(x 40〜98%)に置く。左 40% は空ける(見出しが入る)。見出しは左端から x 5〜45% を占め、立体の左の脚に少し重なってよい
- 足元は下端から 6〜10% の位置で床に接地。上端は少し切れてよい(大きさが出る)
- 交差点は x 70%・y 35% 付近
- 画角: 目の高さよりわずかに上から、やや見下ろす(俯瞰 8〜12°)。広角にしない(35〜50mm 相当)

**スマホ(1200×1800)**
- 立体は画像の**上 62%**(y 5〜62%)に、左右は中央 70%(x 15〜85%)に収める。下 38% は空ける(見出し・一文・ボタンが入る。生成りのスクリムがかかる)
- 交差点は x 60%・y 38% 付近。足元は y 58〜62%
- 表示時は左右が切れる(幅 390px の画面では中央 46% 幅だけが見える)ので、**主役は中央 50% 幅に**入れる

## 3. 素材・光

- 素材: 厚み 8〜12cm 相当の青緑のガラス(深いところ #0F4C47、薄いところ #A8E6D3 に抜ける)。屈折・内部反射・厚みによる色の濃淡(縁と重なりが濃い)。表面はきれいな鏡面、傷・気泡なし
- 光: 左上からの大きな柔らかい主光、右後方からの細い逆光(縁を立てる)、正面下からの弱い起こし。ライトは白〜生成り(#FBFAF7)の場、ダークは深い青緑の場(#0F1A1E)
- 床: 白〜生成りの艶消し(ライト)/ 深い青緑の艶あり(ダーク)。接地の柔らかい影と、薄い映り込み。**床そのものは描かず**、影と映り込みだけを alpha に残す(透過で出せないときは床ごと単色で描いて切り抜き)
- 余計なもの(岩・水面・都市・植物・人物)は**入れない**。主役と光の質だけ

## 4. 画像生成のプロンプト(そのまま貼れる)

**PC・ライト**
```
Product-photography style 3D render, transparent PNG with alpha (no background).
Subject: two thick ribbons of deep teal glass (colors between #0F4C47 and #A8E6D3), each 10cm thick, sweeping through space and crossing each other once without touching, like a stylized "X" made of two arcs. Glass shows refraction, internal reflections, and thickness-based color depth (edges and overlaps darker teal, thin faces pale mint). Flawless polished surface.
Composition: 2400x1500, subject occupies the right 60% of the frame, left 40% empty. Feet touch the floor near the bottom edge; the top of the arch may be slightly cropped. Crossing point at about 70% from the left, 35% from the top. Camera slightly above eye level, 10-degree downward tilt, 45mm lens.
Lighting: large soft key light from upper left, thin cool rim light from the back right, faint fill from the front. Bright ivory studio (#FBFAF7) reflected in the glass.
Floor: not drawn; keep only a soft contact shadow and a faint glossy reflection under the feet, in the alpha channel.
No text, no logo, no rocks, no water, no buildings, no people. Clean, calm, minimal, high-end.
```

**PC・ダーク**: 上のプロンプトの照明を次に置き換える
```
Lighting: dark teal studio (#0F1A1E) with a large soft mint key light from upper left and a thin bright rim light from the back right; the glass glows faintly along its edges. Floor: not drawn; keep a faint glossy mint reflection under the feet in the alpha channel.
```

**スマホ・ライト**: 上の PC・ライトの構図を次に置き換える
```
Composition: 1200x1800 portrait, subject within the top 62% of the frame and within the central 70% of the width; bottom 38% empty. Crossing point at about 60% from the left, 38% from the top. Feet touch the floor at about 60% from the top. Camera slightly above eye level, 45mm lens.
```

**スマホ・ダーク**: スマホ・ライトの構図 + PC・ダークの照明

## 5. 差し替えの手順

1. 4枚を `images/hero/` に同じ名前で置く(WebP・alpha 付き。PNG しか出ないときは `cwebp -q 84 -alpha_q 90 in.png -o out.webp`)
2. `node scripts/check-site.mjs` を通す
3. トップを 1440px と 390px、ライトとダーク、動きを減らす設定で実際に表示して確認する(`index.html` の `.hb` の `--hero-pos` で、画像のどこを基準に切り抜くかを調整できる。PC は右下基準、スマホは上中央基準)
4. 光の帯(`.hb-sweep`)は画像の alpha をマスクに使うので、透過の形が正しければ自動で追従する

## 6. いまの素材について

`images/hero/` の4枚は、このリポジトリの `scripts/render-hero.mjs` で描いた(素の Node・依存なし・CPU パストレース。同じ二本の線の形を hero-bridge.js v2 と共有)。写実の参照画像(添付 AD)の完成度には届いていない箇所: 環境の映り込みの複雑さ(現実の空・建物の反射がない)、床の質感、光の柔らかさ。ここを超えるのは外部の素材に任せる想定。
