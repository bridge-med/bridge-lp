/* ================================================================
   融合3「ひらく町」— 町の建物と、中にある道具(products/index.html の PRODUCTS と同じ名前・一行)
   行き先の色(mark)は、ひらいたあとの UI の小さな印にだけ使う(立体には塗らない)
   ================================================================ */
const P = '../../../';
export const TOOLS = {
  /* 明日の業務を楽にする */
  keiji: { name: '掲示じたく', t: '院内掲示を、選んで埋めるだけ', href: P + 'keiji/index.html', thumb: 'keiji' },
  nidodema: { name: '二度手間さがし', t: '部署の手作業を、減らせるものと守るものに分ける', href: P + 'nidodema/index.html', thumb: 'nidodema' },
  yawagaeshi: { name: 'やわ返', t: '角の立たない返信案を、3つつくる', href: P + 'yawagaeshi/index.html', thumb: 'yawagaeshi' },
  /* 経営・管理の実務に使う */
  rehaboard: { name: 'RehaBoard', t: 'リハ部門の運営を、1画面に', href: P + 'rehaboard/index.html', thumb: 'rehaboard', note: '紹介とデモ' },
  medboard: { name: 'MedBoard', t: '外来の患者フローを、2施設で見比べる', href: P + 'medboard/index.html', thumb: 'medboard', note: '紹介とデモ' },
  'hire-board': { name: 'HireBoard', t: '医療機関の採用を、カンバンで追う', href: P + 'hire-board/index.html', thumb: 'hireboard', note: '紹介とデモ' },
  'interview-kit': { name: '面接官の手帖', t: '面接の質問を用意し、事実と印象を分けて記録する', href: P + 'interview-kit/index.html', thumb: 'interview-kit' },
  'consult-simulator': { name: 'ConsultSim', t: '1診と2診で、待ち時間がどう変わるかを試す', href: P + 'consult-simulator/index.html', thumb: 'consult-simulator', note: '紹介とデモ' },
  'round-note': { name: '本部長の巡回手帖', t: '複数施設の巡回を、1冊の手帖に', href: P + 'round-note/index.html', thumb: 'round-note' },
  'manager-starter': { name: '医療管理職スターター', t: '初めて管理職になった人の、チェックリストと記入式シート', href: P + 'manager-starter/index.html', thumb: 'manager-starter' },
  medops: { name: '医療管理実務ライブラリ', t: '医療管理の実務手順と、無料テンプレート', href: P + 'medops/index.html', thumb: 'medops' },
  'reha-checklist': { name: 'Reha Checklist', t: 'リハ部門KPIのチェックリスト(PDF・スプレッドシート)', href: 'https://bridge-med.github.io/reha-checklist-lp/', ext: true, thumb: 'reha-checklist', note: '配布ページ(別のサイト)・メールアドレスの登録が必要' },
  /* 医療経営を学ぶ */
  'clinic-flow-3d': { name: 'クリニックタウン3D', t: 'クリニック経営を、1日ずつ動かして学ぶ', href: P + 'clinic-flow-3d/index.html', thumb: 'clinic-flow-3d' },
  turnaround12: { name: 'ターンアラウンド12', t: '赤字クリニックを、12週で立て直す', href: P + 'turnaround12/index.html', thumb: 'turnaround12' },
  'pmi-quest': { name: 'クリニックPMIクエスト', t: '承継直後の30日を、10問で診断する', href: P + 'pmi-quest/index.html', thumb: 'pmi-quest' },
  /* キャリア・経験を整理する */
  compass: { name: 'BRIDGE Compass', t: '10の質問で、これまでの経験を別の言葉に翻訳する', href: P + 'compass/index.html', thumb: 'compass', note: '10の質問・約3分・登録不要' },
  tanaoroshi: { name: '経験の棚卸し', t: '18の質問で、職務経歴書のたねをつくる', href: P + 'tanaoroshi/index.html', thumb: 'tanaoroshi' },
  iikae: { name: '現場のことば 言いかえ帳', t: '現場のことばを、履歴書で通じる言葉に', href: P + 'iikae/index.html', thumb: 'iikae' },
  moyamoya: { name: '職場モヤモヤ診断', t: '職場の「なんとなくしんどい」を、10問で言葉に', href: P + 'moyamoya/index.html', thumb: 'moyamoya' },
  karte: { name: '現場のカルテ', t: '職場のしんどさを、カルテの形で読む', href: P + 'karte/index.html', thumb: 'karte' },
  'daily-app': { name: 'キャリアログ', t: '日々の仕事と学びを記録して、キャリアの言葉に', href: P + 'daily-app/index.html', thumb: 'careerlog', status: '更新休止' },
  'growth-76a805': { name: 'Growth OS', t: '仕事の記録を、企画や発信のたねに', href: P + 'growth-76a805/index.html', thumb: 'growth' },
  /* 学習を続ける */
  'him-quiz': { name: 'HIM Quiz', t: '診療情報管理士の模擬試験、全12章・360問', href: P + 'him-quiz/index.html', thumb: 'him-quiz' },
  'study-board': { name: 'StudyBoard', t: '複数科目の学習を、1枚のボードで続ける', href: P + 'study-board/index.html', thumb: 'studyboard' },
  'english-trainer': { name: 'Daily English', t: '瞬間英作文を、通勤の合間に', href: P + 'english-trainer/index.html', thumb: 'english-trainer' },
  /* 気軽に試す・作品を楽しむ */
  'gokigen-gacha': { name: 'ごきげん回復ガチャ', t: '疲れた日の回復行動を、ひとつだけ', href: P + 'gokigen-gacha/index.html', thumb: 'gokigen-gacha' },
  'ittan-horyu': { name: 'いったん保留', t: '買う前に、少しだけ寝かせる', href: P + 'ittan-horyu/index.html', thumb: 'ittan-horyu' },
  madoakari: { name: '窓あかり', t: '小さな病院の一日を、ただ眺める', href: P + 'madoakari/index.html', thumb: 'madoakari' },
  futatsume: { name: 'ふたつめの波', t: '二つの波が重なる、水面のパズル', href: P + 'futatsume/index.html', thumb: 'futatsume' },
  /* アトリエ(運営者)と広場(考え方)。道具ではない */
  about: { name: '運営者について', t: '名前の由来と、これまでの歩み', href: P + 'about/index.html' },
  community: { name: '話をする', t: '共感も、異論も、相談も', href: P + 'community/index.html' },
  note: { name: 'note', t: '書いていること', href: 'https://note.com/prime_duck4944', ext: true, note: '別のサイト' },
  philosophy: { name: '考え方', t: 'BRIDGE が何を大切にしているか', href: P + 'philosophy/index.html' }
};

/* 町の建物(順番は、案内と Tab の順)。role は短い呼び名、line はひらいたときの一行 */
export const BUILDINGS = [
  { id: 'hospital', name: '病院', role: 'いつもの職場', mark: '#087A4F', line: '明日の業務を楽にする', tools: ['keiji', 'nidodema', 'yawagaeshi'] },
  { id: 'observatory', name: '展望台', role: 'キャリアの地図', mark: '#2356C4', line: 'キャリア・経験を整理する', tools: ['compass', 'tanaoroshi', 'iikae', 'moyamoya', 'karte', 'daily-app', 'growth-76a805'] },
  { id: 'clinic', name: 'クリニック', role: '経営を学ぶ', mark: '#C24813', line: '医療経営を学ぶ', tools: ['clinic-flow-3d', 'turnaround12', 'pmi-quest'] },
  { id: 'office', name: '事務所', role: '経営・管理', mark: '#6A45B2', line: '経営・管理の実務に使う', tools: ['rehaboard', 'medboard', 'hire-board', 'interview-kit', 'consult-simulator', 'round-note', 'manager-starter', 'medops', 'reha-checklist'] },
  { id: 'library', name: '図書館', role: '学習', mark: '#00737E', line: '学習を続ける', tools: ['him-quiz', 'study-board', 'english-trainer'] },
  { id: 'park', name: '公園', role: '試す・作品', mark: '#B8920F', line: '気軽に試す・作品を楽しむ', tools: ['gokigen-gacha', 'ittan-horyu', 'madoakari', 'futatsume'] },
  { id: 'atelier', name: 'アトリエ', role: '運営者', mark: '#16233E', line: '理学療法士の橋本渉が、ひとりで運営しています', tools: ['about', 'community', 'note'] },
  { id: 'plaza', name: '広場', role: '考え方', mark: '#A98F63', line: '正解を与えるのではなく、選択肢を増やす', tools: ['philosophy'] }
];
export const BY_ID = Object.fromEntries(BUILDINGS.map(b => [b.id, b]));
