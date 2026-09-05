/* 経営の分岐点 — 分類10: 拠点統合・新規開設・組織変化・経営方針 */
(function (root) {
  'use strict';
  const yen = (n) => '¥' + Math.round(n).toLocaleString('ja-JP');
  const CASES = [
    {
      id: 'OR-01', cat: 10, title: '分院の受付と医事を本院に統合する案', tier: 3, spec: ['any'], who: 'advisor', cool: 365, once: true,
      needs: { branches: 1 },
      say: '分院の受付と医事を本院に寄せると、固定費が月¥150,000ほど減ります。ただ、職員の異動と業務の移し替えが要ります。',
      bg: (c) => `分院${c.branches}か所。統合すると継続費が¥5,000/日減る見込み。移行の3か月は現場に負担。資金 ${yen(c.money)}。`,
      ask: '統合を進めるか',
      facts: (c) => [{ label: '分院', val: `${c.branches}か所` }, { label: '資金', val: yen(c.money) }, { label: '余力', val: `${c.slack}` }],
      choices: [
        { id: 'go', label: '統合を決める', note: '移行費¥300,000。7日後に職員への説明が要る。うまく行けば固定費が下がる',
          req: { money: 300000 },
          fx: { money: -300000, flag: 'or_merge', next: { id: 'OR-01b', days: 7 } },
          reflect: '決めた。ここから先は説明・移行・混乱の3つの判断が続く' },
        { id: 'link', label: '統合はせず、仕組みだけ共通化する', note: '¥100,000。固定費は減らない。混乱も無い',
          req: { money: 100000 },
          fx: { money: -100000, slack: 1, trust: 0 },
          reflect: '効果の小さい方を選んだ。負担を避けた分、固定費は残る' },
        { id: 'no', label: '見送る', note: '費用なし。分院の固定費は続く',
          fx: {},
          reflect: '見送りも判断。次に検討する条件を書いておく' }
      ],
      lesson: '統合の効果は数字で見える。負担は数字に出にくい。両方を並べて決める', point: '拠点統合の是非'
    },
    {
      id: 'OR-01b', cat: 10, title: '統合を職員にどう説明するか', tier: 3, spec: ['any'], who: 'branch', chainOnly: true, cool: 999,
      say: '統合の話、分院の職員はもう噂で聞いています。早く正式に説明しないと、不安が先に広がります。',
      bg: (c) => `統合決定から7日。分院の受付・医事は異動か配置転換になる。職員の余力は${c.slack}。`,
      ask: '説明の形',
      choices: [
        { id: 'meeting', label: '全職員への説明会を開く', note: '費用なし。半日診療を止める(新患×0.5が1日)。全員が同じ情報を持つ',
          fx: { newMul: { mul: 0.5, days: 1, label: '説明会で半日休診' }, slack: 1, next: { id: 'OR-01c', days: 20 } },
          reflect: '同じ場で同じ話をした。半日の診療で払った' },
        { id: 'oneonone', label: '異動対象者に個別面談する', note: '費用なし。7日間、診察1人あたり+0.5分。本人の不安には届く。他の職員には届かない',
          fx: { examDelta: { d: 0.5, days: 7, label: '個別面談' }, slack: 0, next: { id: 'OR-01c', days: 20 } },
          chance: { p: 0.3, label: '面談の無かった職員から不満', hit: { slack: -1 }, miss: { slack: 1 } },
          reflect: '当事者に厚く、周囲に薄い説明になった' },
        { id: 'memo', label: '文書で通知する', note: '費用なし。早いが冷たい。退職者が出る可能性',
          fx: { slack: -1, next: { id: 'OR-01c', days: 20 } },
          chance: { p: 0.45, label: '分院の受付が退職を申し出る', hit: { slack: -1, trust: -1 }, miss: {} },
          reflect: '速さを取った。人は文書で動かない' }
      ],
      lesson: '組織変化の最初の費用は、説明に使う時間', point: '組織変化の説明'
    },
    {
      id: 'OR-01c', cat: 10, title: '業務移行の進め方', tier: 3, spec: ['any'], who: 'billing', chainOnly: true, cool: 999,
      say: '分院のレセプトを本院で見る準備ができました。一気に切り替えるか、1か月かけて移すか、決めてください。',
      bg: (c) => `統合の移行期。医事は本院で一括。切替の間は請求の遅れが出るかもしれない。1日平均${c.patients7}人。`,
      ask: '移行の速度',
      choices: [
        { id: 'fast', label: '一気に切り替える', note: '費用なし。14日間、新患×0.9・余力−2。固定費の削減は早く始まる',
          fx: { newMul: { mul: 0.9, days: 14, label: '移行の混乱' }, slack: -2, dailyCost: { yen: -5000, days: null, label: '統合による固定費削減' }, next: { id: 'OR-01d', days: 14 } },
          reflect: '速く終わらせた。混乱を14日に押し込んだ' },
        { id: 'phased', label: '1か月かけて段階的に移す', note: '費用なし。30日間、余力−1。削減は30日後から',
          fx: { slack: -1, delayed: [{ days: 30, label: '移行完了、固定費が下がる', fx: { dailyCost: { yen: -5000, days: null, label: '統合による固定費削減' }, slack: 1 } }], next: { id: 'OR-01d', days: 30 } },
          reflect: '時間で混乱を薄めた。削減は遅れた' },
        { id: 'support', label: '外部の支援を入れて移す', note: '¥200,000。混乱は小さい。削減の開始は14日後',
          req: { money: 200000 },
          fx: { money: -200000, slack: 0, delayed: [{ days: 14, label: '移行完了、固定費が下がる', fx: { dailyCost: { yen: -5000, days: null, label: '統合による固定費削減' } } }], next: { id: 'OR-01d', days: 14 } },
          reflect: '金で混乱を買い取った。回収には40日かかる' }
      ],
      lesson: '移行は速度と負担の交換。削減の開始日が違う', point: '業務移行の速度'
    },
    {
      id: 'OR-01d', cat: 10, title: '統合後の混乱をどう収めるか', tier: 3, spec: ['any'], who: 'front', chainOnly: true, cool: 999,
      say: '統合は終わりましたが、分院からの問い合わせが本院に集まって、どちらの患者さんの話か混ざることがあります。',
      bg: (c) => `統合後。問い合わせの窓口が1つになった。受付${c.staff.receptionists}人。職員の余力は${c.slack}。`,
      ask: '混乱の収め方',
      choices: [
        { id: 'lead', label: '現場責任者を置いて手当を付ける', note: '¥3,000/日がずっと続く。判断が早くなり、混乱は収まる',
          fx: { dailyCost: { yen: 3000, days: null, label: '現場責任者手当' }, slack: 2 },
          reflect: '人に権限を渡した。固定費削減の一部を人に戻した' },
        { id: 'round', label: '院長が2週間、両拠点を回る', note: '費用なし。14日間、診察1人あたり+1分。院長が見ることで収まる',
          fx: { examDelta: { d: 1.0, days: 14, label: '院長の巡回' }, slack: 1, delayed: [{ days: 14, label: '運用が落ち着く', fx: { slack: 1 } }] },
          reflect: '院長の時間で収めた。統合の全費用に、この時間を足して考える' },
        { id: 'wait', label: '慣れるのを待つ', note: '費用なし。収まることもある。患者の取り違えが起きれば大きい',
          fx: {},
          chance: { p: 0.4, label: '問い合わせの取り違えで苦情', hit: { rep: -2, trust: -1 }, miss: { slack: 1 } },
          reflect: '待った。混乱は時間で薄まるが、事故は時間を待たない' }
      ],
      lesson: '統合の成否は決定ではなく、その後の3つの判断で決まる', point: '統合後の運用'
    },
    {
      id: 'OR-02', cat: 10, title: '自費診療を伸ばすか、保険診療に集中するか', tier: 2, spec: ['any'], who: 'advisor', cool: 180, once: true,
      cond: (c) => c.day >= 30,
      say: '自費のメニューを増やせば単価は上がります。ただ、いま来ている患者さんの層とは少しずれます。方針を決めておきたいです。',
      bg: (c) => `直近30日の売上 ${yen(c.monthRevenue)}。評判${Math.round(c.rep)}・認知${Math.round(c.aw * 100)}%。高齢の常連が多い。`,
      ask: '診療の軸',
      choices: [
        { id: 'jihi', label: '自費を伸ばす', note: '¥100,000で案内を整える。認知+2%。常連との距離が開く可能性',
          req: { money: 100000 },
          fx: { money: -100000, aw: 0.02, flag: 'or_jihi' },
          chance: { p: 0.3, label: '常連から「雰囲気が変わった」の声', hit: { rep: -1, trust: -1 }, miss: {} },
          reflect: '単価を選んだ。層のずれをどう埋めるかが次の課題' },
        { id: 'hoken', label: '保険診療に集中する', note: '費用なし。地域の信頼+1。単価は上がらない',
          fx: { trust: 1, flag: 'or_hoken' },
          reflect: '量と信頼を選んだ。単価は制度が決める' },
        { id: 'both', label: '両方を少しずつ', note: '費用なし。余力−1。どちらの効果も薄い',
          fx: { slack: -1 },
          reflect: '決めないことの費用は、余力で払う' }
      ],
      lesson: '経営方針は「何をしないか」を決めること。両方は方針ではない', point: '診療の軸の選択'
    },
    {
      id: 'OR-03', cat: 10, title: '何のための医院か、言葉にするか', tier: 1, spec: ['any'], who: 'doctor', cool: 365, once: true,
      cond: (c) => c.day >= 10,
      say: '職員から「この医院は何を大事にするんですか」と聞かれた。答えはあるが、言葉にしていない。',
      bg: (c) => `開院から${c.day}日。職員${c.staffTotal}人。理念は院長の頭の中にある。判断のたびに院長に確認が来る。`,
      ask: '理念の言語化',
      choices: [
        { id: 'together', label: '職員と一緒に言葉にする', note: '費用なし。2週間、余力−1。14日後に信頼+1、余力+2。皆の言葉になる',
          fx: { slack: -1, flag: 'or_mission', delayed: [{ days: 14, label: '理念が言葉になる', fx: { slack: 2, trust: 1 } }] },
          when: [{ if: (c) => c.load >= 0.85, fx: { slack: -1 }, why: '混んでいる時期は、話し合う時間が診療に食われる' }],
          reflect: '時間をかけて言葉にした。判断の物差しが院長の外に出た' },
        { id: 'top', label: '院長が書いて掲げる', note: '費用なし。早い。掲げた言葉と日々の判断がずれると、言葉が軽くなる',
          fx: { flag: 'or_mission', rep: 0.5 },
          chance: { p: 0.35, label: '「言葉だけ」と職員が感じる', hit: { slack: -1 }, miss: { trust: 1 } },
          reflect: '速く掲げた。言葉を守るのは、これからの判断' },
        { id: 'later', label: '今は診療に集中する', note: '費用なし。判断は院長に集まり続ける',
          fx: {},
          when: [{ if: (c) => c.staffTotal >= 5, fx: { slack: -1 }, why: '人数が増えるほど、物差しの無い判断は院長に集まる' }],
          reflect: '先送りした。人数が増える前に戻ってくる問い' }
      ],
      lesson: '理念は飾りではなく、院長がいない場所での判断の物差し', point: '理念の言語化'
    },
    {
      id: 'OR-04', cat: 10, title: '院長が休んでいない', tier: 1, spec: ['any'], who: 'nurse', cool: 180,
      cond: (c) => c.day >= 12,
      say: '院長、開院からまとまった休みが無いですよね。倒れたら全部止まります。休む形を決めてもらえませんか。',
      bg: (c) => `医師${c.staff.doctors}人。1日平均${c.patients7}人。院長が休む日は診療が止まる。代診を頼める先は本部にある。`,
      ask: '院長の休み方',
      choices: [
        { id: 'halfday', label: '週に半日、休診にする', note: '費用なし。新患×0.95が1年。院長は続く。売上は少し減る',
          fx: { newMul: { mul: 0.95, days: 365, label: '週半日の休診' }, slack: 1 },
          when: [{ if: (c) => c.load >= 0.85, fx: { rep: -0.5 }, why: '混んでいる医院で枠を減らすと、待つ人が増える' }],
          reflect: '枠を減らして人を守った。減らした分は数字に見える' },
        { id: 'locum', label: '月2回、代診医を入れて休む', note: '¥7,000/日相当がずっと。院長は月2回休める。先生が変わる日がある',
          fx: { dailyCost: { yen: 7000, days: null, label: '月2回の代診医(日割り)' }, slack: 1, rep: -0.5 },
          reflect: '金で休みを買った。代診の日を患者にどう伝えるかが次' },
        { id: 'none', label: '今は休まない', note: '費用なし。続く限りは回る。倒れれば5日止まる',
          fx: {},
          when: [{ if: (c) => c.staff.doctors >= 2, fx: { slack: 1 }, why: '医師が2人いれば、院長が休む日も診療は止まらない' }],
          chance: { p: (c) => (c.load >= 0.85 ? 0.4 : 0.2), label: '院長が体調を崩して5日休診', hit: { newMul: { mul: 0.5, days: 5, label: '院長の急な休診' }, rep: -1, slack: -1 }, miss: {} },
          reflect: '賭けた。院長の体は医院で最も替えのきかない設備' }
      ],
      lesson: '院長の休みは福利厚生ではなく、事業継続の設計', point: '院長の休みと代診体制'
    },
    {
      id: 'OR-05', cat: 10, title: '10年後、どんな医院でいたいか', tier: 1, spec: ['any'], who: 'advisor', cool: 365, once: true,
      cond: (c) => c.day >= 15,
      say: '10年後の姿を決めておきませんか。一人の医院として深めるか、地域の拠点になるか、複数の拠点を持つか。',
      bg: (c) => `開院${c.day}日目。1日平均${c.patients7}人、評判${Math.round(c.rep)}。分院${c.branches}か所、部門${c.depts.length}つ。`,
      ask: '10年後の方向',
      choices: [
        { id: 'solo', label: '一人の医院として深める', note: '費用なし。地域の信頼+1。採用や投資の判断が絞られる',
          fx: { trust: 1, flag: 'or_vision_solo' },
          reflect: '深さを選んだ。広げない判断が、この後の投資を絞る' },
        { id: 'hub', label: '地域の拠点になる', note: '費用なし。連携と受け入れを増やす方針。余力−1、認知+1%、病院との関係+1',
          fx: { slack: -1, aw: 0.01, flag: 'or_vision_hub', rel: { hospital: 1 } },
          reflect: '広く受ける方針。人を増やす判断がこの後に続く' },
        { id: 'multi', label: '複数の拠点を持つ', note: '費用なし。分院や部門を前提に人を育てる。今の現場には遠い話に聞こえる',
          fx: { flag: 'or_vision_multi' },
          when: [
            { if: (c) => c.branches > 0 || c.depts.length > 0, fx: { slack: 1 }, why: '既に拠点があれば、方針が現場の実感と重なる' },
            { if: (c) => c.branches === 0 && c.depts.length === 0, fx: { slack: -1 }, why: '拠点が無い段階では、遠い話が現場の不安になる' }
          ],
          reflect: '広がりを選んだ。人を育てる時間が、この方針の費用' },
        { id: 'ask', label: '職員に聞いてから決める', note: '費用なし。14日後に決まる。職員の声が入る。院長の迷いに見えることも',
          fx: { delayed: [{ days: 14, label: '職員の声を聞いて方向が決まる', fx: { trust: 1 } }] },
          chance: { p: 0.3, label: '「院長が決めないのか」と受け取られる', hit: { slack: -1 }, miss: { slack: 1 } },
          reflect: '聞いてから決めた。聞くことと決めることは、両方院長の仕事' }
      ],
      lesson: '10年後の姿を決めると、今日の判断の半分が自動で決まる', point: '長期の方向づけ'
    },
    {
      id: 'OR-06', cat: 10, title: '院長に確認が集まりすぎている', tier: 1, spec: ['any'], who: 'nurse', cool: 200,
      cond: (c) => c.staffTotal >= 4,
      say: '¥3,000の消耗品も予約の変更も、全部院長に聞いています。診察が止まるので、任せる範囲を決めたいです。',
      bg: (c) => `職員${c.staffTotal}人。確認のたびに診察が中断。診察1人あたり${c.examMean}分。職員の余力は${c.slack}。`,
      ask: '任せる範囲',
      choices: [
        { id: 'rules', label: '金額と範囲を決めて任せる', note: '費用なし。¥10,000までの購入と予約変更は現場で。診察−0.3分。判断ミスが出ることも',
          fx: { examDelta: { d: -0.3, days: 180, label: '確認の減少' }, slack: 1, flag: 'or_delegate' },
          when: [{ if: (c) => !!c.flags.or_mission, fx: { slack: 1 }, why: '理念が言葉になっていると、任された人が同じ物差しで判断できる' }],
          chance: { p: 0.25, label: '任せた範囲で判断ミス、¥30,000の損', hit: { money: -30000 }, miss: { trust: 1 } },
          reflect: '任せた。ミスの費用は、任せることの授業料' },
        { id: 'lead', label: '主任を置いて確認先を分ける', note: '¥2,000/日がずっと。院長の代わりに主任が受ける。主任の負担は増える',
          fx: { dailyCost: { yen: 2000, days: null, label: '主任手当' }, slack: 1, examDelta: { d: -0.2, days: 180, label: '確認先の分散' } },
          reflect: '人を立てた。院長の負担が主任に移った分を見る' },
        { id: 'keep', label: '院長が全部見る', note: '費用なし。判断は揺れない。人が増えるほど診察が止まる',
          fx: { examDelta: { d: 0.3, days: 60, label: '確認による中断' }, slack: -1 },
          when: [{ if: (c) => c.staffTotal >= 6, fx: { slack: -1 }, why: '職員が6人を超えると、確認の列が診察室の前にできる' }],
          reflect: '握り続けた。手放さない安心の費用は、診察の時間' }
      ],
      lesson: '権限委譲は信頼の話に見えて、院長の時間の使い方の話', point: '職員への権限委譲'
    },
    {
      id: 'OR-07', cat: 10, title: '朝礼か、月1回の会議か、連絡ノートか', tier: 2, spec: ['any'], who: 'front', cool: 200, once: true,
      cond: (c) => c.day >= 20 && c.staffTotal >= 4,
      say: '伝達漏れが続いています。皆で集まる時間をどう作るか、決めてもらえませんか。毎日か、月に1回か。',
      bg: (c) => `職員${c.staffTotal}人。今は口頭とメモ。1日平均${c.patients7}人。開院前の10分が唯一の全員の時間。`,
      ask: '会議の形',
      choices: [
        { id: 'daily', label: '毎朝10分の朝礼', note: '費用なし。開始が10分遅れ、診察+0.2分が1年。伝達漏れは減る',
          fx: { examDelta: { d: 0.2, days: 365, label: '朝礼' }, slack: 1 },
          when: [{ if: (c) => c.staffTotal >= 6, fx: { slack: 1 }, why: '人数が多いほど、毎朝の共有の効果が大きい' }],
          reflect: '毎日の10分を選んだ。短い時間の積み重ねが医院の文化になる' },
        { id: 'monthly', label: '月1回、診療後に1時間', note: '費用なし。月1回、余力−1。深い話ができる。日々の漏れは残る',
          fx: { slack: -1, delayed: [{ days: 30, label: '月例会議で課題が整理される', fx: { slack: 1, trust: 1 } }] },
          chance: { p: 0.3, label: '日々の伝達漏れは続く', hit: { rep: -0.5 }, miss: {} },
          reflect: '深さを選んだ。日々の漏れは別の手当てが要る' },
        { id: 'note', label: '連絡ノートで回す', note: '費用なし。集まらない。読まない人がいる',
          fx: {},
          chance: { p: 0.4, label: '読まれず、伝達漏れで患者に迷惑', hit: { rep: -1, slack: -1 }, miss: { slack: 1 } },
          reflect: '書いた。読まれるかは、書く側では決められない' }
      ],
      lesson: '会議は時間の費用。毎日の短い時間と月1の深い時間は、性質が違う', point: '会議体の設計'
    },
    {
      id: 'OR-08', cat: 10, title: '新しい診療科を足すか', tier: 2, spec: ['any'], who: 'advisor', cool: 365, once: true,
      cond: (c) => c.day >= 25,
      say: (c) => `${c.specialty === 'orthopedics' ? '内科' : '整形外科'}の非常勤医を週1日入れる話があります。患者層は広がりますが、動線と受付が変わります。`,
      bg: (c) => `本院は${c.specialty === 'orthopedics' ? '整形外科' : '内科'}。非常勤医は¥16,000/日相当(週1日分の日割り)。1日平均${c.patients7}人、混み具合${Math.round(c.load * 100)}%。`,
      ask: '診療科の追加',
      choices: [
        { id: 'add', label: '週1日、新しい科を入れる', note: '¥16,000/日相当がずっと。認知+3%。60日後に新患が増える。混んでいると動線が詰まる',
          fx: { dailyCost: { yen: 16000, days: null, label: '非常勤医(週1日の日割り)' }, aw: 0.03, flag: 'or_new_dept', delayed: [{ days: 60, label: '新しい科の患者が定着する', fx: { newMul: { mul: 1.1, days: 90, label: '新しい科の新患' } } }] },
          when: [{ if: (c) => c.load >= 0.85, fx: { slack: -1, rep: -0.5 }, why: '混んでいる時期に科を増やすと、待合と受付が詰まる' }],
          reflect: '幅を広げた。受付と待合の設計が追いつくかが次' },
        { id: 'deepen', label: '今の科で専門外来の時間帯を作る', note: '費用なし。週1回の専門枠。評判+1、余力−1。新患の層は変わらない',
          fx: { rep: 1, slack: -1, flag: 'or_deepen' },
          reflect: '深さを選んだ。広げなかった分、今の患者に厚くなる' },
        { id: 'no', label: '見送る', note: '費用なし。動線は変わらない。患者層も変わらない',
          fx: {},
          when: [{ if: (c) => c.load < 0.5, fx: { rep: -0.5 }, why: '患者が少ない時期に何も変えないと、空いた時間だけが残る' }],
          reflect: '見送った。空いている時間があるなら、その費用も見る' }
      ],
      lesson: '科を足すのは患者層を足すこと。受付と動線が先に変わる', point: '診療科の追加'
    },
    {
      id: 'OR-09', cat: 10, title: '法人にするかと銀行に聞かれた', tier: 2, spec: ['any'], who: 'bank', cool: 365, once: true,
      cond: (c) => c.day >= 30,
      say: 'この街では、分院や部門を持つなら法人の形が要る決まりです。手続きと顧問の費用が増えますが、融資の枠は広がります。',
      bg: (c) => `架空の経営上の条件。法人化は¥500,000と顧問¥3,000/日。個人のままでも診療は続く。分院${c.branches}か所、部門${c.depts.length}つ。`,
      ask: '経営の形',
      choices: [
        { id: 'corp', label: '法人にする', note: '¥500,000と¥3,000/日。拠点を増やす前提が整う。当面の利益は減る',
          req: { money: 500000 },
          fx: { money: -500000, dailyCost: { yen: 3000, days: null, label: '法人の顧問費(架空の条件)' }, flag: 'or_corp' },
          when: [
            { if: (c) => c.branches > 0 || c.depts.length > 0, fx: { slack: 1 }, why: '既に拠点があれば、手続きの効果がすぐ現場に出る' },
            { if: (c) => !!c.flags.or_vision_solo, fx: { slack: -1 }, why: '一人の医院として深める方針と、法人の形は噛み合わない' }
          ],
          reflect: '形を変えた。形は目的ではなく、次の拠点のための器' },
        { id: 'solo', label: '個人のまま続ける', note: '費用なし。固定費は増えない。拠点を増やす道は狭い',
          fx: { flag: 'or_solo' },
          when: [{ if: (c) => !!c.flags.or_vision_multi, fx: { slack: -1 }, why: '複数拠点の方針を掲げたのに形を変えないと、職員が方針を疑う' }],
          reflect: '軽さを選んだ。広げるときにもう一度この問いが来る' },
        { id: 'estimate', label: '顧問に試算だけ頼む', note: '¥50,000。30日後に数字が出る。決めるのは後',
          req: { money: 50000 },
          fx: { money: -50000, delayed: [{ days: 30, label: '法人化の試算が届き、判断の材料が揃う', fx: { slack: 1 } }] },
          reflect: '判断を買う前に、材料を買った' }
      ],
      lesson: '経営の形は方針の後に決める。形から入ると器だけ残る', point: '法人化(架空の経営条件)'
    },
    {
      id: 'OR-10', cat: 10, title: '在宅の部門を立ち上げてほしい', tier: 2, spec: ['any'], who: 'caremane', cool: 365, once: true,
      needs: { noDepts: ['homecare'] },
      cond: (c) => c.day >= 25,
      say: '通えなくなった利用者が増えています。訪問診療の部門を作っていただけませんか。受けてくれる先が足りません。',
      bg: (c) => `在宅部門は無い。準備は¥1,000,000と看護師1人、車¥3,000/日。ケアマネジャーとの関係Lv${(c.relations && c.relations.caremane) || 0}。`,
      ask: '在宅部門の準備',
      choices: [
        { id: 'start', label: '立ち上げの準備を始める', note: '¥1,000,000と看護師+1、車¥3,000/日。60日間は余力−2。地域の信頼+1',
          req: { money: 1000000 },
          fx: { money: -1000000, staff: { nurses: 1 }, dailyCost: { yen: 3000, days: null, label: '訪問用の車' }, slack: -2, trust: 1, rel: { caremane: 1 }, flag: 'or_homecare_prep', delayed: [{ days: 60, label: '在宅の体制が整う', fx: { slack: 2 } }] },
          when: [{ if: (c) => c.staff.doctors < 2, fx: { slack: -1, rep: -0.5 }, why: '医師が1人だと、訪問の間は外来が止まる' }],
          reflect: '大きく踏み出した。医師の時間をどう分けるかが、この先の日々' },
        { id: 'small', label: '院長が月に数件だけ往診する', note: '費用なし。90日間、診察+0.5分。信頼+1。部門にはならない',
          fx: { examDelta: { d: 0.5, days: 90, label: '院長の往診' }, trust: 1, rel: { caremane: 1 } },
          when: [{ if: (c) => c.load >= 0.85, fx: { rep: -0.5 }, why: '混んでいる外来を空けて往診に出ると、待つ人が増える' }],
          reflect: '小さく応えた。応えた分だけ、外来の時間が減る' },
        { id: 'refer', label: '他の在宅の医院を紹介する', note: '費用なし。関係は保てる。この地域の受け皿は増えない',
          fx: {},
          chance: { p: 0.3, label: '紹介先も満杯で、ケアマネジャーが困る', hit: { rel: { caremane: -1 }, trust: -1 }, miss: {} },
          reflect: '断って紹介した。受け皿が地域に無いなら、断りは戻ってくる' }
      ],
      lesson: '部門の立ち上げは、医師の時間を二つに割る判断', point: '在宅部門の立ち上げ'
    },
    {
      id: 'OR-11', cat: 10, title: '近くの医院から患者を引き継いでほしいと言われた', tier: 2, spec: ['any'], who: 'doctor', cool: 365, once: true,
      cond: (c) => c.day >= 30,
      say: '近くの医院の院長が高齢で閉めるそうだ。患者とカルテ、職員1人を引き継いでほしいと言われた。',
      bg: (c) => `相手は1日30人ほどの医院。引き継ぐ費用は¥800,000(架空の条件)。1日平均${c.patients7}人、混み具合${Math.round(c.load * 100)}%。`,
      ask: '承継の受け方',
      facts: (c) => [{ label: '資金', val: yen(c.money) }, { label: '混み具合', val: `${Math.round(c.load * 100)}%` }, { label: '職員', val: `${c.staffTotal}人` }],
      choices: [
        { id: 'full', label: '患者と職員を引き継ぐ', note: '¥800,000。90日間、新患×1.15。余力−2。受付+1(日給が続く)。30日後に職員の相談',
          req: { money: 800000 },
          fx: { money: -800000, newMul: { mul: 1.15, days: 90, label: '引き継いだ患者' }, staff: { receptionists: 1 }, slack: -2, flag: 'or_succession', next: { id: 'OR-11b', days: 30 } },
          when: [{ if: (c) => c.load >= 0.85, fx: { rep: -1 }, why: '既に混んでいる医院に患者が流れ込むと、待ち時間が跳ねる' }],
          reflect: '引き受けた。患者の数だけでなく、前の医院のやり方も一緒に来る' },
        { id: 'patients', label: '患者の紹介だけ受ける', note: '費用なし。30日間、新患×1.05。職員とカルテは引き継がない。信頼+1',
          fx: { newMul: { mul: 1.05, days: 30, label: '閉院した医院からの紹介' }, trust: 1 },
          when: [{ if: (c) => c.load >= 0.85, fx: { slack: -1 }, why: '混んでいる時期は、紹介だけでも現場の負担になる' }],
          reflect: '軽く受けた。来る人は来る。来ない人は別の医院へ' },
        { id: 'decline', label: '断る', note: '費用なし。患者は地域に散る。信頼−1',
          fx: { trust: -1 },
          reflect: '断った。地域の患者がどこへ行ったかは、後で見える' }
      ],
      lesson: '承継は患者を買うことではない。やり方と人を一緒に受け取ること', point: '事業承継の受け手'
    },
    {
      id: 'OR-11b', cat: 10, title: '引き継いだ職員が前のやり方を変えない', tier: 2, spec: ['any'], who: 'staff', chainOnly: true, cool: 999,
      say: '前の医院では、こうしていました。ここのやり方は速すぎて、患者さんが置いていかれている気がします。',
      bg: (c) => `承継から30日。引き継いだ受付は前の医院で20年。本院の受付との間に手順のずれ。職員の余力は${c.slack}。`,
      ask: '二つのやり方の扱い',
      choices: [
        { id: 'adopt', label: '前の医院の良い手順を一部取り入れる', note: '費用なし。14日間、余力−1。引き継いだ患者の評判+1。手順は少し遅くなる',
          fx: { slack: -1, rep: 1, examDelta: { d: 0.2, days: 30, label: '手順の統合' }, delayed: [{ days: 14, label: '手順が一つになる', fx: { slack: 2, trust: 1 } }] },
          reflect: '混ぜた。速さの一部を、引き継いだ人の納得と交換した' },
        { id: 'ours', label: '本院の手順に合わせてもらう', note: '費用なし。速い。引き継いだ職員が辞めることがある。その患者も離れる',
          fx: { slack: 1 },
          when: [{ if: (c) => !!c.flags.or_mission, fx: { slack: 1 }, why: '理念が言葉になっていると、合わせてもらう理由を説明できる' }],
          chance: { p: 0.4, label: '引き継いだ職員が退職、常連の一部が離れる', hit: { staff: { receptionists: -1 }, newMul: { mul: 0.95, days: 60, label: '引き継いだ常連の離脱' }, trust: -1 }, miss: {} },
          reflect: '揃えた。人が残るかは、揃え方の説明で決まった' },
        { id: 'separate', label: '引き継いだ患者の担当を分ける', note: '費用なし。二つの医院が一つの建物にある形。余力−1が続く',
          fx: { slack: -1, rep: 0.5 },
          chance: { p: 0.3, label: '職員の間に壁ができる', hit: { slack: -1, trust: -1 }, miss: {} },
          reflect: '分けた。一つの医院になる日を、先に延ばした' }
      ],
      lesson: '承継で受け取るのは患者ではなく文化。混ぜるか、揃えるか、分けるか', point: '承継後の文化の統合'
    },
    {
      id: 'OR-12', cat: 10, title: '二人目の医師を後継者として育てるか', tier: 2, spec: ['any'], who: 'doctor', cool: 365, once: true,
      needs: { minStaff: { doctors: 2 } },
      cond: (c) => c.day >= 30,
      say: '二人目の医師は診療がしっかりしている。経営の場に入れて後継として育てるか、診療に専念してもらうか。',
      bg: (c) => `医師${c.staff.doctors}人。院長は経営を一人で見ている。10年後の方針は${c.flags.or_vision_solo ? '一人の医院' : c.flags.or_vision_multi ? '複数拠点' : '未定'}。`,
      ask: '後継者の育て方',
      choices: [
        { id: 'groom', label: '経営の場に入れる', note: '費用なし。月2回の経営会議に参加。90日後に信頼+1。診察は+0.2分',
          fx: { examDelta: { d: 0.2, days: 90, label: '経営会議への参加' }, flag: 'or_successor', delayed: [{ days: 90, label: '後継候補が経営の判断を担い始める', fx: { trust: 1, slack: 1 } }] },
          when: [{ if: (c) => !!c.flags.or_vision_multi, fx: { slack: 1 }, why: '複数拠点の方針があると、育てる目的が現場にも伝わる' }],
          chance: { p: 0.25, label: '本人は診療に専念したいと言う', hit: { slack: -1 }, miss: {} },
          reflect: '育てる場に入れた。本人の望みと院長の望みが合うかは別' },
        { id: 'clinical', label: '診療に専念してもらう', note: '費用なし。診療は安定。経営は院長一人のまま',
          fx: { rep: 0.5 },
          when: [{ if: (c) => c.day >= 90, fx: { slack: -1 }, why: '開院から時間が経つほど、経営を一人で抱える重さが職員にも見える' }],
          reflect: '今の安定を選んだ。院長がいない日の医院を、まだ誰も知らない' },
        { id: 'outside', label: '週1日、外部の経営講座に出す', note: '¥3,000/日を90日(週1日分の日割り)。診察+0.4分。外の目が入る',
          fx: { dailyCost: { yen: 3000, days: 90, label: '経営講座(週1日の日割り)' }, examDelta: { d: 0.4, days: 90, label: '週1日の不在' }, flag: 'or_successor' },
          reflect: '外で学ばせた。持ち帰る言葉が、院内に合うかを見る' }
      ],
      lesson: '後継者は突然生まれない。経営を見せる時間を、診療の時間から切り出す', point: '後継者の育成'
    },
    {
      id: 'OR-13', cat: 10, title: '分院を出す話が来た', tier: 3, spec: ['any'], who: 'advisor', cool: 365, once: true,
      cond: (c) => c.day >= 45 && c.money >= 1000000,
      say: '駅の反対側に空きテナントがあります。分院を出す条件は揃いつつあります。開設費と、任せる医師が要ります。',
      bg: (c) => `開設は¥3,000,000、家賃¥20,000/日。分院長になる医師が要る。直近30日の利益 ${yen(c.monthProfit)}。資金 ${yen(c.money)}。`,
      ask: '分院開設',
      facts: (c) => [{ label: '資金', val: yen(c.money) }, { label: '手元で持てる日数', val: `${c.runway}日` }, { label: '直近30日の利益', val: yen(c.monthProfit) }],
      choices: [
        { id: 'open', label: '開設を決める', note: '¥3,000,000と家賃¥20,000/日。14日後に分院長の人選。軌道に乗るまで赤字',
          req: { money: 3000000 },
          fx: { money: -3000000, dailyCost: { yen: 20000, days: null, label: '分院の家賃(架空の条件)' }, slack: -1, flag: 'or_branch_open', next: { id: 'OR-13b', days: 14 } },
          when: [
            { if: (c) => c.monthProfit < 0, fx: { slack: -1, trust: -1 }, why: '本院が赤字のまま分院を出すと、職員も地域も「大丈夫か」と見る' },
            { if: (c) => !!c.flags.or_corp, fx: { slack: 1 }, why: '法人の形を先に整えていれば、手続きの負担が小さい' }
          ],
          reflect: '出すと決めた。ここからは人選・赤字・撤退の判断が続く' },
        { id: 'wait', label: '半年待って本院を固める', note: '費用なし。テナントは他に取られる可能性。本院の余力+1',
          fx: { slack: 1 },
          chance: { p: 0.5, label: 'テナントが他の医院に取られる', hit: { aw: -0.01 }, miss: {} },
          reflect: '待った。場所は待ってくれないが、本院の土台は残る' },
        { id: 'share', label: '他院と共同で借りる', note: '¥1,000,000と家賃¥10,000/日。週の半分だけ使う。決定権は半分。関係+1',
          req: { money: 1000000 },
          fx: { money: -1000000, dailyCost: { yen: 10000, days: null, label: '共同分院の家賃(架空の条件)' }, rel: { hospital: 1 }, trust: 1, flag: 'or_branch_shared' },
          reflect: '半分にした。費用も決定権も半分。それでよいかは方針次第' }
      ],
      lesson: '分院は場所の話ではなく、任せられる人がいるかの話', point: '分院開設の是非'
    },
    {
      id: 'OR-13b', cat: 10, title: '分院長を誰に任せるか', tier: 3, spec: ['any'], who: 'doctor', chainOnly: true, cool: 999,
      say: '分院長を決めなければならない。院内の医師を出すか、外から招くか、私が両方を回るか。',
      bg: (c) => `開設決定から14日。医師${c.staff.doctors}人。外から招くと採用費¥500,000。院長が兼務すると本院の診察が薄くなる。`,
      ask: '分院長の人選',
      choices: [
        { id: 'inside', label: '院内の医師を分院長にする', note: '費用なし。本院の医師が1人減り、診察+1分。育てた人が分院を担う',
          req: { staff: { doctors: 2 } },
          fx: { staff: { doctors: -1 }, examDelta: { d: 1.0, days: 60, label: '本院の医師が1人減る' }, slack: -1, next: { id: 'OR-13c', days: 60 } },
          when: [{ if: (c) => !!c.flags.or_successor, fx: { trust: 1, slack: 1 }, why: '後継候補として育てた医師なら、任せる根拠が院内にある' }],
          reflect: '中から出した。本院が薄くなる分は、育てた人への投資' },
        { id: 'hire', label: '外から医師を招く', note: '¥500,000。日給¥80,000が続く。医院のやり方を知らない人が分院を作る',
          req: { money: 500000 },
          fx: { money: -500000, staff: { doctors: 1 }, next: { id: 'OR-13c', days: 60 } },
          chance: { p: 0.35, label: '分院の方針が本院とずれる', hit: { trust: -1, slack: -1 }, miss: { trust: 1 } },
          reflect: '外から迎えた。同じ看板で違う医院にならないかを見る' },
        { id: 'self', label: '院長が両方を回る', note: '費用なし。90日間、本院の診察+1.5分。院長の休みは消える',
          fx: { examDelta: { d: 1.5, days: 90, label: '院長の兼務' }, slack: -1, next: { id: 'OR-13c', days: 60 } },
          chance: { p: (c) => (c.load >= 0.85 ? 0.5 : 0.3), label: '院長が体調を崩し、両方が3日止まる', hit: { newMul: { mul: 0.5, days: 3, label: '院長の急な休診' }, rep: -1 }, miss: {} },
          reflect: '自分で埋めた。最も替えのきかない資源を、二か所に配った' }
      ],
      lesson: '分院長の人選は、育てた人がいるかの答え合わせ', point: '分院長の人選'
    },
    {
      id: 'OR-13c', cat: 10, title: '分院の赤字が続いている', tier: 3, spec: ['any'], who: 'billing', chainOnly: true, cool: 999,
      say: '分院の開設から2か月。1日10人前後で、家賃と人件費を賄えていません。続けるか、判断の時期です。',
      bg: (c) => `分院は1日¥60,000ほどの赤字(架空の試算)。本院の直近30日の利益 ${yen(c.monthProfit)}。資金 ${yen(c.money)}、持てる日数${c.runway}日。`,
      ask: '分院の継続',
      facts: (c) => [{ label: '資金', val: yen(c.money) }, { label: '手元で持てる日数', val: `${c.runway}日` }, { label: '直近30日の利益', val: yen(c.monthProfit) }],
      choices: [
        { id: 'continue', label: '半年は続けると決める', note: '費用なし。赤字¥60,000/日相当を180日見込む。認知+2%。定着すれば黒字に転じる',
          fx: { dailyCost: { yen: 60000, days: 180, label: '分院の赤字(架空の試算)' }, aw: 0.02, flag: 'or_branch_hold' },
          when: [{ if: (c) => c.runway < 60, fx: { slack: -1 }, why: '手元資金が薄いと、半年の赤字は職員の給与への不安になる' }],
          chance: { p: (c) => (c.rep >= 70 ? 0.6 : 0.4), label: '半年で分院が黒字に転じる', hit: { delayed: [{ days: 180, label: '分院が黒字化する', fx: { money: 1500000, trust: 1 } }] }, miss: { delayed: [{ days: 180, label: '分院の赤字が続く', fx: { slack: -1 } }] } },
          reflect: '待つと決めた。待てる資金があったから、待てた' },
        { id: 'shrink', label: '診療日を半分にして赤字を止める', note: '費用なし。赤字は¥30,000/日相当に。認知は伸びない。半端な分院と見られることも',
          fx: { dailyCost: { yen: 30000, days: 180, label: '分院の赤字(縮小後)' }, slack: 1 },
          chance: { p: 0.35, label: '「いつ開いているか分からない」と評判が落ちる', hit: { rep: -1 }, miss: {} },
          reflect: '半分にした。傷は浅くなり、育つ力も半分になった' },
        { id: 'close', label: '撤退する', note: '¥500,000の撤去費。家賃は止まる。分院の患者は本院へ。信頼−1',
          req: { money: 500000 },
          fx: { money: -500000, dailyCost: { yen: -20000, days: null, label: '分院の家賃が止まる' }, trust: -1, rep: -1, newMul: { mul: 1.05, days: 30, label: '分院の患者が本院へ' }, unflag: 'or_branch_open' },
          when: [{ if: (c) => !!c.flags.or_vision_multi, fx: { trust: -1 }, why: '複数拠点を掲げて撤退すると、方針そのものが疑われる' }],
          reflect: '止めた。撤退の費用は金より、掲げた方針の重さ' }
      ],
      lesson: '撤退の判断は、開設の日に決めておく数字で行う', point: '分院の赤字と撤退'
    },
    {
      id: 'OR-14', cat: 10, title: '分院と本院で職員を入れ替えたい', tier: 3, spec: ['any'], who: 'branch', cool: 200,
      needs: { branches: 1 },
      say: '分院の看護師を本院で1か月研修させたいです。代わりに本院から1人来てもらえますか。やり方の差が大きいんです。',
      bg: (c) => `分院${c.branches}か所。本院の看護師${c.staff.nurses}人。拠点ごとに手順が違い、応援に行くと戸惑う。職員の余力は${c.slack}。`,
      ask: '拠点間の人事交流',
      choices: [
        { id: 'swap', label: '1か月、1人ずつ入れ替える', note: '費用なし。30日間、余力−1。30日後に手順が揃い、余力+2、信頼+1',
          req: { staff: { nurses: 2 } },
          fx: { slack: -1, flag: 'or_exchange', delayed: [{ days: 30, label: '拠点間の手順が揃う', fx: { slack: 2, trust: 1 } }] },
          when: [{ if: (c) => c.load >= 0.85, fx: { slack: -1 }, why: '混んでいる時期に慣れない人を受け入れると、教える側が疲れる' }],
          reflect: '人を動かして手順を揃えた。慣れない30日が費用' },
        { id: 'manual', label: '手順書を統一して交流はしない', note: '¥50,000で手順書。人は動かない。書いた手順が現場に合わないことがある',
          req: { money: 50000 },
          fx: { money: -50000 },
          chance: { p: 0.4, label: '手順書が現場に合わず使われない', hit: { slack: -1 }, miss: { slack: 1 } },
          reflect: '紙で揃えた。紙は人の代わりに現場を見てはくれない' },
        { id: 'allow', label: '応援に行く人に手当を付ける', note: '¥2,000/日がずっと。応援の不満は減る。手順の差は残る',
          fx: { dailyCost: { yen: 2000, days: null, label: '拠点間の応援手当' }, slack: 1 },
          reflect: '不満を金で薄めた。差そのものは残っている' }
      ],
      lesson: '拠点が増えると手順が分かれる。揃えるのは紙ではなく人の移動', point: '拠点間の人事交流'
    }
  ];
  if (typeof module !== 'undefined' && module.exports) module.exports = CASES;
  else root.DECISIONS.register(CASES);
})(typeof self !== 'undefined' ? self : this);
