# トップのヒーロー素材 — 発注仕様と差し替え手順

トップ(`index.html`)の最初の画面に置く立体の素材。いまは `images/hero/` の4枚(`scripts/render-hero.mjs` で描いた CPU パストレースの事前レンダ)が入っている。
同じファイル名で置き換えれば、コードを触らずに差し替わる。外部(画像生成・3D)で作るときの仕様と、そのまま貼れるプロンプト。

## 1. ファイル(この名前で置く)

| ファイル | 用途 | 寸法 | 形式 |
|---|---|---|---|
| `images/hero/hero-pc-light.webp` | PC・ライト | 2400×1500(16:10) | WebP・**背景透過(alpha)**・目安 400KB 以下 |
| `images/hero/hero-pc-dark.webp` | PC・ダーク | 2400×1500 | 同上 |
| `images/hero/hero-sp-light.webp` | スマホ・ライト | 1200×1800(2:3) | 同上 |
| `images/hero/hero-sp-dark.webp` | スマホ・ダーク | 1200×1800 | 同上 |

守ること(4枚に共通):
- **PC とスマホは別構図**(§2)。スマホは PC の切り抜きではない
- **同じ端末のライトとダークは、同じ造形・同じカメラ・同じ位置で、照明だけを変える**(スクロールで昼→夜に転じるとき、ライトの画像にダークの画像を重ねてクロスフェードするため。1px でもずれると二重に見える)
- 背景は画像に**焼かない**。ページの背景色(ライト #FBFAF7 / ダーク #0F1A1E)と床の光溜まりは CSS が描く。影と床への映り込みは alpha 付きで焼いてよい
- 文字・ロゴを入れない。見出しとボタンは HTML
- 透過が出せない生成ツールの場合は §5 の代替方式

## 2. 構図(CSS の cover 表示で切れる範囲を含めて決めている)

**PC(2400×1500)** — `background-position: 100% 100%`(右下基準)・`background-size: cover`
- 16:10(1440×900 等)では画像の全域が見える。16:9 ではさらに上端が 10% 切れる(下は切れない)。4:3 など縦長では左端が切れる(右は切れない)。**したがって主役は右下に寄せ、上端 12% と左端 25% には主役を置かない**
- 主役=正式ロゴの「交差する二本の線」を、厚い青緑のガラスの板として立体化したもの。二本のまま、交差するが接続しない(憲法第24条)
- 立体の占める範囲: x 38〜95%、y 10〜92%(足元が下端から 8% で床に接地)。交差点は x 82%・y 38% 付近。一本目(アーチ)の左脚は画像の下辺から抜ける(左辺からではない)
- 左 35%(x 0〜35%)は空ける。見出しは x 9〜50% に入り、y 28〜56% を占める。この矩形に立体を重ねない
- 画角: 目の高さよりわずかに上から、やや見下ろす(俯瞰 8〜12°)。広角にしない(45〜50mm 相当)

**スマホ(1200×1800)** — `background-position: 50% 0%`(上中央基準)・`background-size: cover`
- 390×844 では高さが合い、**横は中央 69%(x 15.4〜84.6%)だけが見える**。375×667 では中央 84%。**主役は中央 70%(x 15〜85%)に収める**(これが唯一の横方向の条件)
- 立体の占める範囲: y 10〜58%(上 10% は空け、足元は y 58% で床に接地)。交差点は x 62%・y 27% 付近
- 下 42%(y 58〜100%)は空ける。見出し・一文・ボタンが入り、y 44〜56% に生成りへのグラデーションの境界がかかる

## 3. 素材・光

- 素材: 厚み 8〜12cm 相当の青緑のガラス。薄い面はほぼ白(#F0FAF7 付近)、厚み方向と二本の重なりは深い青緑(#0F4C47 付近)。屈折・内部反射・厚みによる色の濃淡。表面はきれいな鏡面、傷・気泡なし。稜線に細い白いハイライト
- 光(ライト): 背面左上からの大きな柔らかい主光(逆光で板が光る)、右後方の低い位置からの細いリム(稜線を立てる)、正面からの弱い起こし。映り込む環境は白〜生成りの明るいスタジオ(暗い地平の境が一本だけ、板の面に映る)
- 光(ダーク): 深い青緑のスタジオ(#0F1A1E)。同じ位置の主光をミントに、リムを強めに。板の縁がわずかに発光して見える
- 床: 描かない。接地の柔らかい影と、薄い艶の映り込み(脚が下に映る)だけを alpha に残す。主光がガラスを通って落ちる影の中は、ミントに明るむ(光溜まり)
- 余計なもの(岩・水面・都市・植物・人物)は**入れない**。主役と光の質だけ
- 白飛びさせない。最も明るい面にも階調を残す(#FFFFFF のベタ面を作らない)

## 4. 画像生成のプロンプト(そのまま貼れる)

**PC・ライト**
```
Product-photography style 3D render, transparent PNG with alpha (no background), 2400x1500.
Subject: two thick ribbons of teal glass, each about 10 cm thick, sweeping through space and crossing each other once without touching, like a stylized "X" made of two arcs. Thin faces look almost white (#F0FAF7); thick edges and the overlap are deep teal (#0F4C47). Refraction, internal reflections, thickness-based color depth, polished flawless surface, thin white highlights along the edges. No blown-out white areas: even the brightest faces keep gradation.
Composition: subject occupies x 38-95% and y 10-92% of the frame; the crossing point sits at about x 82%, y 38%. The left 35% of the frame stays empty. Feet touch the floor near the bottom edge; the left leg of the arch exits through the bottom edge, not the left edge. Camera slightly above eye level, 10-degree downward tilt, 45-50mm lens.
Lighting: large soft key light behind the subject, upper left (backlight, so the glass glows); a thin cool rim light low on the back right; a weak fill from the front. Bright ivory studio (#FBFAF7) reflected in the glass, with a single darker horizon line.
Floor: not drawn; keep only a soft contact shadow, a faint glossy reflection of the feet, and a mint-tinted pool of light where the key light passes through the glass, all in the alpha channel.
No text, no logo, no rocks, no water, no buildings, no people. Clean, calm, minimal, high-end.
```

**PC・ダーク**: 上のプロンプトの Lighting を次に置き換える(造形・カメラ・位置は同一)
```
Lighting: dark teal studio (#0F1A1E). Same light positions: a large soft mint key light behind the subject upper left, a stronger thin rim light low on the back right, a weak front fill. The glass edges glow faintly. Floor: not drawn; keep a faint glossy mint reflection of the feet and a soft mint pool of light in the alpha channel.
```

**スマホ・ライト**: PC・ライトの Composition を次に置き換える
```
Composition: 1200x1800 portrait. Subject within y 10-58% of the frame and within the central 70% of the width (x 15-85%); the crossing point at about x 62%, y 27%; feet touch the floor at y 58%. The bottom 42% of the frame stays empty. Camera slightly above eye level, 45-50mm lens.
```

**スマホ・ダーク**: スマホ・ライトの構図 + PC・ダークの照明

## 5. 透過が出せない場合(代替方式)

生成ツールが alpha を出せないときは、**背景込み**で納品してもよい。そのときは次を守り、CSS も合わせる。
- ライトは #FBFAF7、ダークは #0F1A1E の単色の上に描く(ページの背景色と同じ)。床の光溜まりは画像に含めてよい
- 光の帯(`.hb-sweep`)は画像の alpha をマスクに使っているので、別に**白黒のマスク画像**(板の形が白・それ以外が黒。同じ寸法・同じ位置)を `images/hero/hero-pc-mask.png` / `hero-sp-mask.png` として添える
- CSS の変更点: `.hb-sweep` の `mask` をマスク画像に差し替える(2行)。昼→夜のクロスフェードは背景ごと切り替わるが、背景色が同じなので見た目は変わらない
- 品質は透過方式より安定する(縁の半透明の処理が要らない)。透過で縁がギザつく場合は、この方式を選ぶ

## 6. 差し替えの手順

1. 4枚を `images/hero/` に同じ名前で置く(WebP・alpha 付き。PNG からの変換は `cwebp -q 82 -alpha_q 100 in.png -o out.webp` か、`scripts/` にある Playwright の変換でもよい)
2. `node scripts/check-site.mjs` を通す
3. トップを 1440×900・1440×810・390×844・375×667 で、ライトとダーク、動きを減らす設定で実際に表示して確認する。切り抜きの基準は `index.html` の `.hb` の `--hero-pos`(PC 右下・スマホ上中央)
4. 見出しの位置(PC x 9〜50%・y 28〜56% / スマホ y 51〜64%)に立体が重なっていないこと。重なるなら素材側で位置を直す(CSS でずらすと 4 枚の位置関係が崩れる)

## 7. いまの素材の作り方(再生成)

```
node scripts/render-hero.mjs --layout pc --theme light --w 2400 --h 1500 --spp 128 --out hero-pc-light.png
node scripts/render-hero.mjs --layout sp --theme light --w 1200 --h 1800 --spp 128 --out hero-sp-light.png
```
(`--theme dark` でダーク。4 コアで PC 1 枚 30 分前後。出力は alpha 付き PNG、WebP への変換は上記)

現状の到達点: designer の採点は素材 6.5 / 構図 6.5(AD 画像との距離)。届いていないのは、透過に映る環境の写実(実在のスタジオや風景の映り込み)。ここを超えるのは外部の素材に任せる想定。
