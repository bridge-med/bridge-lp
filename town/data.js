/* ================================================================
   トップ「ひらく町」— 町の建物と、中にある道具(products/index.html の PRODUCTS と同じ名前・一行。scripts/check-site.mjs の6項が照合する)
   for(誰向け)・facts(利用条件)・cta(ボタンの動詞)・kind(行き先の種類 app/intro/dist)も PRODUCTS の写し。ここで文言を作らない
   shot: 町の中の画面が products の縮小画像と違う物(縦長の画面)。移る瞬間に、町の中の画面と同じ画像を広げるため(interiors.js の IMG と同じ)
   land: 移る瞬間に広げる、着く画面の写し(町の中の画面が着く画面と違うとき)。false は写しを広げず、紙の地に名前だけ(着く画面の写しがない)
   ================================================================ */
const P = '';   // 行き先はページ(ルートの index.html)からの相対
export const TOOLS = {
  /* 明日の業務を楽にする */
  keiji: { name: '掲示じたく', t: '院内掲示を、選んで埋めるだけ', href: P + 'keiji/index.html', thumb: 'keiji', land: 'town/shots/keiji.webp', for: '受付・事務の方に', facts: ['無料', '登録不要', '端末内保存'], cta: '掲示をつくる', kind: 'app' },
  nidodema: { name: '二度手間さがし', t: '部署の手作業を、減らせるものと守るものに分ける', href: P + 'nidodema/index.html', thumb: 'nidodema', land: false, for: '転記やFAXの手間が多い部署に', facts: ['無料', '登録不要', '端末内保存'], cta: 'チェックを始める', kind: 'app' },
  yawagaeshi: { name: 'やわ返', t: '角の立たない返信案を、3つつくる', href: P + 'yawagaeshi/index.html', thumb: 'yawagaeshi', shot: 'town/shots/yawagaeshi.webp', for: '返信の言い方に迷う人に', facts: ['無料', '登録不要', '端末内保存', 'ホーム画面に追加できる'], cta: '返信案をつくる', kind: 'app' },
  /* 経営・管理の実務に使う */
  rehaboard: { name: 'RehaBoard', t: 'リハ部門の運営を、1画面に', href: P + 'rehaboard/index.html', thumb: 'rehaboard', note: '紹介とデモ', for: 'リハ部門の責任者・主任に', facts: ['デモは無料', '本体は買い切り ¥1,980', '登録不要', '端末内保存'], cta: '紹介とデモを見る', kind: 'intro' },
  medboard: { name: 'MedBoard', t: '外来の患者フローを、2施設で見比べる', href: P + 'medboard/index.html', thumb: 'medboard', note: '紹介とデモ', for: '外来クリニックの院長・事務長に', facts: ['デモは無料', '登録不要', '端末内保存'], cta: '紹介とデモを見る', kind: 'intro' },
  'hire-board': { name: 'HireBoard', t: '医療機関の採用を、カンバンで追う', href: P + 'hire-board/index.html', thumb: 'hireboard', note: '紹介とデモ', for: '医療機関の採用担当・事務長に', facts: ['デモは無料', '登録不要', '端末内保存'], cta: '紹介とデモを見る', kind: 'intro' },
  'interview-kit': { name: '面接官の手帖', t: '面接の質問を用意し、事実と印象を分けて記録する', href: P + 'interview-kit/index.html', thumb: 'interview-kit', for: '医療機関の面接官に', facts: ['無料', '登録不要', '端末内保存'], cta: '紹介を見る', kind: 'intro' },
  'consult-simulator': { name: 'ConsultSim', t: '1診と2診で、待ち時間がどう変わるかを試す', href: P + 'consult-simulator/index.html', thumb: 'consult-simulator', note: '紹介とデモ', for: '診察体制を決める院長・事務長に', facts: ['デモは無料', '登録不要'], cta: '紹介とデモを見る', kind: 'intro' },
  'round-note': { name: '本部長の巡回手帖', t: '複数施設の巡回を、1冊の手帖に', href: P + 'round-note/index.html', thumb: 'round-note', for: '複数施設を統括する本部長・エリアマネージャーに', facts: ['無料', '登録不要', '端末内保存'], cta: '手帖を開く', kind: 'app' },
  'manager-starter': { name: '医療管理職スターター', t: '初めて管理職になった人の、チェックリストと記入式シート', href: P + 'manager-starter/index.html', thumb: 'manager-starter', for: '医療専門職から初めて管理職になった人に', facts: ['無料のチェックリストとセルフチェック', '登録不要'], cta: 'チェックリストを見る', kind: 'app' },
  medops: { name: '医療管理実務ライブラリ', t: '医療管理の実務手順と、無料テンプレート', href: P + 'medops/index.html', thumb: 'medops', for: '新任の事務長・医療管理職に', facts: ['テンプレートは無料', '登録不要'], cta: '記事とテンプレートを見る', kind: 'app' },
  'reha-checklist': { name: 'Reha Checklist', t: 'リハ部門KPIのチェックリスト(PDF・スプレッドシート)', href: 'https://bridge-med.github.io/reha-checklist-lp/', ext: true, thumb: 'reha-checklist', note: '配布ページ(別のサイト)・メールアドレスの登録が必要', for: '整形外科クリニックの院長・事務長・リハ責任者に', facts: ['無料', 'メールアドレスの登録が必要', 'PDF+スプレッドシート'], cta: '配布ページへ', kind: 'dist' },
  /* 医療経営を学ぶ */
  'clinic-flow-3d': { name: 'クリニックタウン3D', t: 'クリニック経営を、1日ずつ動かして学ぶ', href: P + 'clinic-flow-3d/index.html', thumb: 'clinic-flow-3d', for: '経営を体験してみたい医療職に', facts: ['無料', '登録不要', '端末内保存', 'ホーム画面に追加できる'], cta: 'ゲームを始める', kind: 'app' },
  turnaround12: { name: 'ターンアラウンド12', t: '赤字クリニックを、12週で立て直す', href: P + 'turnaround12/index.html', thumb: 'turnaround12', for: '立て直しの判断を体験してみたい人に', facts: ['無料', '登録不要', '端末内保存', '1プレイ約5分'], cta: 'ゲームを始める', kind: 'app' },
  'pmi-quest': { name: 'クリニックPMIクエスト', t: '承継直後の30日を、10問で診断する', href: P + 'pmi-quest/index.html', thumb: 'pmi-quest', for: '承継・統合に関わる人に', facts: ['無料', '登録不要', '端末内保存', '10問・約3分'], cta: '診断ゲームを始める', kind: 'app' },
  /* キャリア・経験を整理する */
  compass: { name: 'BRIDGE Compass', t: '10の質問で、これまでの経験を別の言葉に翻訳する', href: P + 'compass/index.html', thumb: 'compass', note: '10の質問・約3分・登録不要', for: '看護師・リハビリ職などの医療専門職に', facts: ['無料', '登録不要', '回答は送信しない', '10問・約3分'], cta: '質問に答える', kind: 'app' },
  tanaoroshi: { name: '経験の棚卸し', t: '18の質問で、職務経歴書のたねをつくる', href: P + 'tanaoroshi/index.html', thumb: 'tanaoroshi', for: '職務経歴書や面接を控えた医療職に', facts: ['無料', '登録不要', '端末内保存', '約15分'], cta: '質問に答える', kind: 'app' },
  iikae: { name: '現場のことば 言いかえ帳', t: '現場のことばを、履歴書で通じる言葉に', href: P + 'iikae/index.html', thumb: 'iikae', for: '現場の言葉を履歴書に書けずにいる医療職に', facts: ['無料', '登録不要', '端末内保存'], cta: '言いかえ帳を開く', kind: 'app' },
  moyamoya: { name: '職場モヤモヤ診断', t: '職場の「なんとなくしんどい」を、10問で言葉に', href: P + 'moyamoya/index.html', thumb: 'moyamoya', for: '職場のしんどさを言葉にしたい人に', facts: ['無料', '登録不要', '端末内保存', '10問・約3分'], cta: '診断を始める', kind: 'app' },
  karte: { name: '現場のカルテ', t: '職場のしんどさを、カルテの形で読む', href: P + 'karte/index.html', thumb: 'karte', for: '職場のしんどさを、読み物として眺めたい人に', facts: ['登録不要', '入力の保存なし', '読みもの'], cta: '読んでみる', kind: 'app' },
  'daily-app': { name: 'キャリアログ', t: '日々の仕事と学びを記録して、キャリアの言葉に', href: P + 'daily-app/index.html', thumb: 'careerlog', status: '更新休止', for: '日々の仕事を記録して、面接や1on1に使いたい人に', facts: ['登録不要', 'Web版(スマホ向けアプリのプレビュー)', '記録は端末内', '文章の整形だけ外部サーバー'], cta: 'Web版を開く', kind: 'app' },
  'growth-76a805': { name: 'Growth OS', t: '仕事の記録を、企画や発信のたねに', href: P + 'growth-76a805/index.html', thumb: 'growth', for: '仕事の記録を企画や発信につなげたい人に', facts: ['無料', '登録不要', '端末内保存'], cta: '記録を始める', kind: 'app' },
  /* 学習を続ける */
  'him-quiz': { name: 'HIM Quiz', t: '診療情報管理士の模擬試験、全12章・360問', href: P + 'him-quiz/index.html', thumb: 'him-quiz', for: '診療情報管理士の独学者に', facts: ['無料', 'ログイン不要', '端末内保存', 'スマホ対応'], cta: '紹介を見る', kind: 'intro' },
  'study-board': { name: 'StudyBoard', t: '複数科目の学習を、1枚のボードで続ける', href: P + 'study-board/index.html', thumb: 'studyboard', for: '複数科目を並行して学ぶ社会人に', facts: ['無料', 'ログイン不要', '端末内保存'], cta: '紹介を見る', kind: 'intro' },
  'english-trainer': { name: 'Daily English', t: '瞬間英作文を、通勤の合間に', href: P + 'english-trainer/index.html', thumb: 'english-trainer', for: '医療経営の英語まで学びたい人に', facts: ['無料', 'ログイン不要', '端末内保存', 'スマホ最適化'], cta: '紹介を見る', kind: 'intro' },
  /* 気軽に試す・作品を楽しむ */
  'gokigen-gacha': { name: 'ごきげん回復ガチャ', t: '疲れた日の回復行動を、ひとつだけ', href: P + 'gokigen-gacha/index.html', thumb: 'gokigen-gacha', shot: 'town/shots/gacha.webp', for: '疲れた日、やる気が出ない日の自分に', facts: ['無料', '登録不要', '端末内保存'], cta: 'ガチャを回す', kind: 'app' },
  'ittan-horyu': { name: 'いったん保留', t: '買う前に、少しだけ寝かせる', href: P + 'ittan-horyu/index.html', thumb: 'ittan-horyu', for: '衝動買いを減らしたい人に', facts: ['無料', '登録不要', '端末内保存', 'ホーム画面に追加できる'], cta: '保留してみる', kind: 'app' },
  madoakari: { name: '窓あかり', t: '小さな病院の一日を、ただ眺める', href: P + 'madoakari/index.html', thumb: 'madoakari', for: '夜中も続く病院の仕事を、眺めてみたい人に', facts: ['無料', '登録不要', 'ホーム画面に追加できる'], cta: '眺める', kind: 'app' },
  futatsume: { name: 'ふたつめの波', t: '二つの波が重なる、水面のパズル', href: P + 'futatsume/index.html', thumb: 'futatsume', for: '点数も時間制限もないパズルで、一息つきたい人に', facts: ['無料', '登録不要', '端末内保存', 'ホーム画面に追加できる'], cta: '遊ぶ', kind: 'app' },
  /* アトリエ(運営者)と広場(考え方)。道具ではない。アトリエの3つめは、物の id は note のまま、行き先を手記(journal)に(情報設計の提案。一行は NAV の journal の一言) */
  about: { name: '運営者について', t: '名前の由来と、これまでの歩み', href: P + 'about/index.html#founder' },
  community: { name: '話をする', t: '共感も、異論も、相談も', href: P + 'community/index.html' },
  note: { name: '手記', t: '完成していない考えも、そのまま公開しています', href: P + 'journal/index.html' },
  philosophy: { name: '考え方', t: 'BRIDGE が何を大切にしているか', href: P + 'philosophy/index.html' }
};

/* 前後の順(島を一周する順。ひらいたまま、前・次で移る) */
export const RING = ['hospital', 'plaza', 'observatory', 'office', 'clinic', 'park', 'atelier', 'library'];

/* 町の建物(順番は、案内と Tab の順)。role は短い呼び名、line はひらいたときの一行。use は Products の用途(products/index.html#work など。一覧で比べる入口) */
export const BUILDINGS = [
  { id: 'hospital', use: 'work', name: '病院', role: 'いつもの職場', line: '明日の業務を楽にする', tools: ['keiji', 'nidodema', 'yawagaeshi'] },
  { id: 'observatory', use: 'career', name: '展望台', role: 'キャリアの地図', line: 'キャリア・経験を整理する', tools: ['compass', 'tanaoroshi', 'iikae', 'moyamoya', 'karte', 'daily-app', 'growth-76a805'] },
  { id: 'clinic', use: 'learn', name: 'クリニック', role: '経営を学ぶ', line: '医療経営を学ぶ', tools: ['clinic-flow-3d', 'turnaround12', 'pmi-quest'] },
  { id: 'office', use: 'manage', name: '事務所', role: '経営・管理', line: '経営・管理の実務に使う', tools: ['rehaboard', 'medboard', 'hire-board', 'interview-kit', 'consult-simulator', 'round-note', 'manager-starter', 'medops', 'reha-checklist'] },
  { id: 'library', use: 'study', name: '図書館', role: '学習', line: '学習を続ける', tools: ['him-quiz', 'study-board', 'english-trainer'] },
  { id: 'park', use: 'play', name: '公園', role: '試す・作品', line: '気軽に試す・作品を楽しむ', tools: ['gokigen-gacha', 'ittan-horyu', 'madoakari', 'futatsume'] },
  { id: 'atelier', name: 'アトリエ', role: '運営者', line: '理学療法士の私(橋本渉)が、ひとりで運営しています', tools: ['about', 'community', 'note'] },
  { id: 'plaza', name: '広場', role: '考え方', line: '正解を与えるのではなく、選択肢を増やす', tools: ['philosophy'] }
];
export const BY_ID = Object.fromEntries(BUILDINGS.map(b => [b.id, b]));

