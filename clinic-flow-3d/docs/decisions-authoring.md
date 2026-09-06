# 経営の分岐点 — ケースの書き方(制作メモ)

対象: `app/decisions/cases-NN-*.js`(分類ごとに1ファイル)。エンジンは `app/decisions.js`。検査は `node clinic-flow-3d/scripts/check-decisions.mjs`。

## 1ケースの形
```js
{
  id: 'ST-03',                 // 分類の接頭辞+連番。ST採用 OP業務 PY待遇 SL営業 PT患者 FN資金 LK連携 SF安全 EQ設備 OR組織
  cat: 1, tier: 1,             // tier 1=Day5〜(少ない指標で判断できる) 2=Day20〜(利害が複数) 3=Day45〜or分院・部門あり(組織・複数拠点)
  title: '短い題(句点・「!」なし)',
  spec: ['any'],               // 本院の科で絞るなら ['orthopedics'] / ['internal']
  needs: { depts:['homecare'], branches:1, hospital:true, rehaLevel:1, flag:'x', notFlag:'y', minStaff:{nurses:2} }, // 存在条件(無い施設・職種からの相談を出さない)
  who: 'nurse',                // doctor 剣持院長 / nurse 榊看護師長 / front 松岡受付 / billing 佐伯医事 / reha 湊(整形本院だけ) / advisor 白瀬(本部)
                               // family 患者の家族 / patient / caremane 田島 / hospital 岡部(市民総合病院連携室) / facility 施設の相談員 / branch 分院長(分院・部門あり)
                               // homecare 在宅部門の看護師(在宅部門あり) / dialysis(透析部門あり) / staff ある職員 / vendor / landlord / bank / pharmacy / health 保健所
  cool: 90, once: false, chainOnly: false,   // 再発までの日数。once=1回だけ。chainOnly=前の判断の next からだけ届く
  cond: (c) => c.load >= 0.7,  // 発生条件(ctx を見る)。書かなければ常時
  prio: (c) => (c.load >= 0.9 ? 2 : 0), // 状況優先度 0..3(人員不足・資金不足・紹介増に応じて上げる)
  say: '相談者の自然なセリフ(60字以内)',           // 文字列 or (c)=>文字列
  bg: (c) => `背景。判断に要る数字を入れる(80字以内)`,
  ask: '今回決めること(30字以内)',
  facts: (c) => [{ label:'資金', val:'¥…' }],   // 任意。判断に必要な数字のチップ
  choices: [ /* 3つ以上 */
    { id:'a', label:'選択肢(20字以内)', note:'費用・負担・期待される効果を判断前に書く(50字以内)',
      req:{ money:150000, staff:{nurses:2}, depts:[...], rehaLevel:1, flag:'x', notFlag:'y', slack:0, trust:1 }, // 満たさないと選べない(理由が表示される)
      fx:{ money:-150000, staff:{nurses:+1}, slack:-1, trust:+1, rep:+1, aw:+0.01, coins:+1, rel:{hospital:+1}, flag:'name',
           dailyCost:{yen:2000, days:20|null, label:'…'},   // 継続費(¥/日)。負なら削減。days:null=ずっと
           newMul:{mul:0.9, days:30, label:'…'},             // 新患の倍率(期間)
           examDelta:{d:+0.5, days:14, label:'…'},           // 診察1人あたりの分(＋で遅く)
           delayed:[{days:14, label:'…', fx:{…}}],           // 遅延効果(期日に1回)
           next:{id:'ST-03b', days:10} },                    // 連続イベント
      when:[{ if:(c)=>c.load<0.6, fx:{slack:-1}, why:'条件で結果が変わる理由(表示される)' }],  // 条件次第で変わる結果
      chance:{ p:(c)=>0.4, label:'起きること', hit:{…}, miss:{…} },  // 不確実な結果。p と両側が見込みに出る
      reflect:'実際の結果に対応した振り返り(60字以内。文字列 or (ctx,outcome)=>文字列)' }
  ],
  lesson: '学び1文(50字以内)', point: '一覧用の論点(20字以内)'
}
```

## ctx(判断時の状況)で使える値
`day money rep aw staff{doctors,nurses,receptionists,pts,rehaAides} staffTotal specialty stage depts[] branches hospital rehaLevel flags{} slack trust load(0..1=混み具合) patients7(1日平均患者) newp7 refer7 waitAvg(分) balked7(待てず帰った/日) monthProfit monthRevenue dailyCost runway(手元で持てる日数) rentDay examMean relations{hospital,caremane,rouken,...} kaitei`

## 数字の目安(既存の経済モデル)
日給: 医師¥80,000・看護師¥18,000・PT¥16,000・受付¥10,000。採用費: 看護師¥120,000〜260,000・受付¥60,000〜・PT¥150,000〜・医師¥500,000〜。
1日の売上は¥150,000〜400,000。開始資金¥2,000,000。家賃¥25,000/日(段階1)。手当は1人¥1,000〜3,000/日が現実的。

## 守ること
- 「!」を使わない。題に句点を付けない。名称は正式名称(生活習慣病管理料・運動器リハビリテーション料など)。文は短く。
- 常に真ん中が正解にならない。お金を使う選択が常に有利にならない。丁寧に話し合うだけで全部良くならない。明らかに悪い選択肢だけのクイズにしない。
- リスクと前提は note に書く(後出しの罰にしない)。結果が条件で変わるときは when.why に理由を書く。
- 一時費用(money)と継続費(dailyCost)を分ける。人数は staff で(日給は既存の費用計算に乗る)。
- 制度の数値・要件を創作しない。制度説明が要るときは「架空の経営上の条件」として成立させる。法令・医療上の違反を利益との交換として勧めない。
- 実在の名称を使わない。相談者は上の話者リストから(存在条件つきの話者は needs で絞る)。
