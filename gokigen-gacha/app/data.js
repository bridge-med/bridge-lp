/* =========================================================================
 * ごきげん回復ガチャ — data.js
 * 回復カード・状態カテゴリ・ぽての台詞などの静的データ。
 * カードを追加するときは GACHA_CARDS に1件足すだけでよい。
 * ========================================================================= */
(function (global) {
  'use strict';

  var APP = {
    name: 'ごきげん回復ガチャ',
    subcopy: 'ぴったりの回復を、ひとつだけ。',
    url: 'https://bridge-med.github.io/bridge-lp/gokigen-gacha/',
    contact: 'h.w19961013@gmail.com',
    // データの扱いの説明(設定画面で表示)
    dataNote: '履歴・お気に入り・図鑑・設定は、すべてこの端末の中だけに保存されます。開発者のサーバーには送信されません。アカウント登録も不要です。',
    disclaimer: 'このアプリは医学的な診断や治療を目的としたものではありません。日常の疲れや気分の重さを、少し整えるためのセルフケアアプリです。つらさが続くときは、無理せず信頼できる人や専門の窓口に相談してください。'
  };

  /* ---- よく使う4状態(状態選択の上段に大きく出す) --------------------------- */
  var PRIMARY_STATES = ['tired', 'heavyhead', 'unmotivated', 'irritated'];

  /* ---- 初回オンボーディング(3画面・スキップ可) --------------------------- */
  var ONBOARDING = [
    { emoji: '🎁', title: 'ようこそ、ごきげん回復ガチャへ', body: '疲れた日の、あなたの味方です。' },
    { emoji: '🔎', title: '使い方は、かんたん', body: '', steps: ['気分を選ぶ', 'ガチャを引く', '少しやってみる'] },
    { emoji: '🍀', title: 'がんばらなくていいよ', body: '全部やらなくても大丈夫。\nできない日があってもOKです。' }
  ];

  /* ---- カテゴリ(=回復タイプの系統) ------------------------------------ */
  // statLabel はカード結果画面の「回復タイプ +1」表示、
  // effectLabel はショートカット等の小さな効きタグ、tone は色分けに使う。
  var CATEGORIES = [
    { id: 'body',   label: '体を戻す',             emoji: '🌱', statLabel: '体力',       effectLabel: '体をゆるめる',     tone: 'sage'   },
    { id: 'head',   label: '頭を軽くする',         emoji: '☁️', statLabel: '思考の余白', effectLabel: '頭をかるくする',   tone: 'blue'   },
    { id: 'mood',   label: '気分を上げる',         emoji: '🧡', statLabel: 'ごきげん',   effectLabel: '気分をほぐす',     tone: 'peach'  },
    { id: 'social', label: '人間関係から少し離れる', emoji: '🚪', statLabel: 'ひとり時間', effectLabel: 'そっと離れる',     tone: 'lav'    },
    { id: 'life',   label: '生活を整える',         emoji: '🏠', statLabel: '生活',       effectLabel: '生活をととのえる', tone: 'green'  },
    { id: 'guilt',  label: '罪悪感を軽くする',     emoji: '🍵', statLabel: 'やさしさ',   effectLabel: '自分にやさしく',   tone: 'butter' },
    { id: 'rest',   label: '何もしないを許す',     emoji: '🍀', statLabel: 'ゆるし',     effectLabel: '休んでいい',       tone: 'cream'  }
  ];

  /* ---- 状態カテゴリ(状態選択画面の「今の自分を選ぶ棚」) ------------------- */
  var STATES = [
    { id: 'sleepy',      label: '眠い',           emoji: '🌙', tone: 'blue',   desc: '体がまだ起きていない' },
    { id: 'tired',       label: '疲れた',         emoji: '🔋', tone: 'sage',   desc: '体も気持ちもくたくた' },
    { id: 'heavyhead',   label: '頭が重い',       emoji: '🌫️', tone: 'cream',  desc: '考えがまとまらない' },
    { id: 'irritated',   label: 'イライラする',   emoji: '💢', tone: 'peach',  desc: '余裕がすこし足りない' },
    { id: 'unmotivated', label: '何もしたくない', emoji: '🦥', tone: 'butter', desc: '動き出す気力がない' },
    { id: 'nosocial',    label: '人と話したくない', emoji: '🚪', tone: 'lav',   desc: 'ひとりで静かにいたい' },
    { id: 'guilty',      label: '罪悪感だけある', emoji: '💧', tone: 'blue',   desc: 'できていないことが気になる' },
    { id: 'lonely',      label: 'なんとなく寂しい', emoji: '🫧', tone: 'lav',   desc: '理由はないけどぽっかりする' },
    { id: 'infofatigue', label: '情報疲れ',       emoji: '📱', tone: 'blue',   desc: '見すぎて頭がいっぱい' },
    { id: 'busy',        label: '予定が多すぎる', emoji: '📅', tone: 'cream',  desc: '余白がなくなっている' }
  ];

  /* ---- ぽての台詞 -------------------------------------------------------- */
  var POTE = {
    name: 'ぽて',
    home: [
      '今日も、少し戻れたら十分です',
      '回復は小さくて大丈夫です',
      'まずは1枚、カードを引いてみますか?',
      '無理に晴れなくて大丈夫です',
      '世界は5分くらい待ってくれます',
      '小さく戻していきましょう',
      '今日の目標は「少し戻る」でいいです'
    ],
    // 時間帯別のホーム一言(通常時はここから選ぶ)
    timeOfDay: {
      morning: [
        '起きただけでも、まずは一歩です',
        '朝は小さく始めましょう',
        'まだ省エネでも大丈夫です'
      ],
      noon: [
        'ここで一回、少し戻しておきましょう',
        '午後の前に、ひと呼吸です',
        '小さく整える時間です'
      ],
      evening: [
        '今日の残りは、省エネでも大丈夫です',
        'ここまで来ただけで十分です',
        '閉じる準備を少しずつ始めましょう'
      ],
      night: [
        '今日は閉じる準備をしていきましょう',
        '巻き返すより、休む準備でも大丈夫です',
        '明日の自分にやさしく引き継ぎましょう'
      ]
    },
    // 今日すでに1回以上実行しているとき
    doneToday: [
      'もう1回戻れています。かなりえらいです',
      '今日の回復は、ちゃんと記録されています',
      '今日はもう戻れています。あとはおまけです'
    ],
    // 数日ぶりに開いたとき
    comeback: [
      'また来てくれてうれしいです。今日からで大丈夫です',
      '間が空いても大丈夫です。1枚だけ引いてみましょう'
    ],
    // 連続日数の下に添える、煽らない一言
    streakNote: {
      zero: 'また今日からで大丈夫です',
      one: '1回戻れたら十分です',
      more: '連続はおまけです。続いていたら少しうれしい、くらいで'
    },
    // カプセルが尽きたとき(責めずに、行動か明日へ誘導する)
    capsuleEmpty: [
      '今日のカプセルはおしまいです。1枚やってみると、1個もどってきます',
      'カプセルは明日の朝、また補充されます。引いた分をゆっくりやりましょう',
      '探すのは今日はここまで。もう出ているカードで十分です'
    ],
    capsuleNote: '「やってみた」で1個もどります',
    select: [
      'いちばん近い気分で大丈夫です',
      'なんとなくで大丈夫です',
      '迷ったら「選ばずに回す」もありです'
    ],
    selectNote: '選べないときは、なんとなくで大丈夫です。',
    // 引き直しを重ねたときに、そっと添える一言
    redrawNote: '探しすぎなくて大丈夫です。今出ているカードで十分です。',
    spinning: [
      '今できそうなものを探しています',
      '小さく戻る準備中です',
      '無理なくできるものを選んでいます'
    ],
    // 実行完了の見出し(「回復完了」のような断定はしない)
    doneHeading: [
      '少し戻れました',
      '自分を雑に扱わなかった',
      '今日はこれだけでも十分です'
    ],
    praise: [
      'えらいです。かなりえらいです',
      'ちゃんと戻る行動ができました',
      '今日はこれだけでも十分です',
      '小さい回復ができました',
      '自分を雑に扱わなかったのがえらいです'
    ],
    todayWord: [
      'できたことを、なかったことにしなくて大丈夫です。',
      '少し戻るだけでも、ちゃんと前進です。',
      '今日は省エネでも、ちゃんと運転中です。',
      '休む判断も、立派な調整です。',
      '小さい一歩は、ちゃんと一歩です。',
      '明日の自分が、少し楽になりました。'
    ],
    dex: '焦らず、少しずつ集めていきましょう。',
    myRecovery: 'ここには、あなたが少し戻れた記録が集まります。',
    emptyMyRecovery: 'まだ記録はありません。まずは1枚、引いてみましょう。',
    emptyFavorites: 'お気に入りはまだありません。合いそうなカードが出たら、そっと保存してみてください。',
    emptyRecent: 'ここに、最近やった回復が並びます。',
    emptySuited: 'カードを何度か引くと、あなたによく合う回復が見えてきます。'
  };

  /* ---- 回復カード(60枚) ------------------------------------------------ */
  // difficulty: 1=★☆☆ ほぼ何もしない / 2=★★☆ 少しだけ動く / 3=★★★ ちょっと整える
  var CARDS = [
    /* ============ 体を戻す ============ */
    { id: 'c01', title: '水を飲む', category: 'body', emoji: '💧', durationMinutes: 1, difficulty: 1,
      suitedStates: ['sleepy', 'tired', 'heavyhead', 'unmotivated'],
      mainMessage: 'まずは体に水分を戻しましょう。',
      action: 'コップ1杯の水を飲んでください。一口でも大丈夫です。',
      poteMessage: '水分は、いちばん小さい回復です。',
      tags: ['水分', '1分', '定番'] },
    { id: 'c02', title: '白湯か温かい飲み物を飲む', category: 'body', emoji: '☕', durationMinutes: 3, difficulty: 1,
      suitedStates: ['sleepy', 'tired', 'heavyhead'],
      mainMessage: '今は気合いより、あたたかさが必要そうです。',
      action: '白湯、コーヒー、味噌汁、スープなど、温かいものを一口飲んでください。全部飲まなくても大丈夫です。',
      poteMessage: 'まずは内側から、ちょっと戻しましょう。',
      tags: ['あたたかい', '飲み物'] },
    { id: 'c03', title: '3分だけ横になる', category: 'body', emoji: '🛏️', durationMinutes: 3, difficulty: 1,
      suitedStates: ['tired', 'unmotivated', 'busy'],
      mainMessage: '立て直す前に、一度体を預けましょう。',
      action: 'タイマーを3分にして、目を閉じて横になってください。',
      poteMessage: '3分休むのは、逃げではなく補給です。',
      tags: ['休憩', '横になる'] },
    { id: 'c04', title: '肩をゆっくり回す', category: 'body', emoji: '🙆', durationMinutes: 2, difficulty: 2,
      suitedStates: ['tired', 'heavyhead', 'irritated'],
      mainMessage: '固まった体を少しだけ動かしましょう。',
      action: '肩を前に5回、後ろに5回、ゆっくり回してください。',
      poteMessage: '肩が少しゆるむと、気持ちも少しゆるみます。',
      tags: ['ストレッチ', 'デスクワーク'] },
    { id: 'c05', title: '外の空気を吸う', category: 'body', emoji: '🍃', durationMinutes: 3, difficulty: 2,
      suitedStates: ['heavyhead', 'irritated', 'infofatigue'],
      mainMessage: '部屋の外に、気分の逃げ道を作りましょう。',
      action: '窓を開けるか、玄関の外に出て、外の空気を3回吸ってください。',
      poteMessage: '外気、意外と効きます。',
      tags: ['空気', '換気'] },
    { id: 'c06', title: '目を閉じる', category: 'body', emoji: '😌', durationMinutes: 1, difficulty: 1,
      suitedStates: ['sleepy', 'infofatigue', 'heavyhead'],
      mainMessage: '情報を一度遮断しましょう。',
      action: '30秒だけ目を閉じてください。何も考えなくて大丈夫です。',
      poteMessage: '目を閉じるだけでも、脳には休憩です。',
      tags: ['目', '30秒'] },
    { id: 'c07', title: '首の後ろを温める', category: 'body', emoji: '♨️', durationMinutes: 3, difficulty: 2,
      suitedStates: ['tired', 'heavyhead', 'irritated'],
      mainMessage: '緊張を少しゆるめましょう。',
      action: '温かいタオルや手のひらで、首の後ろを少し温めてください。',
      poteMessage: '首がゆるむと、世界もちょっとやわらかくなります。',
      tags: ['あたためる', '首'] },
    { id: 'c08', title: '深呼吸を3回する', category: 'body', emoji: '🌬️', durationMinutes: 1, difficulty: 1,
      suitedStates: ['irritated', 'busy', 'heavyhead'],
      mainMessage: '呼吸だけ、先に整えましょう。',
      action: 'ゆっくり吸って、ゆっくり吐く。これを3回だけやってください。',
      poteMessage: '3回で十分です。多すぎると面倒です。',
      tags: ['呼吸', '1分'] },

    /* ============ 頭を軽くする ============ */
    { id: 'c09', title: '紙かメモに全部吐き出す', category: 'head', emoji: '📝', durationMinutes: 5, difficulty: 2,
      suitedStates: ['heavyhead', 'busy', 'guilty'],
      mainMessage: '頭の中だけで抱えるのをやめましょう。',
      action: '今気になっていることを、順番もきれいさも気にせず書き出してください。',
      poteMessage: '頭の外に出すだけで、少し軽くなります。',
      tags: ['書き出す', 'メモ'] },
    { id: 'c10', title: '今日やらないことを1つ決める', category: 'head', emoji: '🙅', durationMinutes: 2, difficulty: 1,
      suitedStates: ['busy', 'heavyhead', 'unmotivated'],
      mainMessage: 'やることを増やすより、減らす方が効く日もあります。',
      action: '今日やらなくていいことを1つ決めてください。',
      poteMessage: 'やらない勇気、かなり上級です。',
      tags: ['やらないこと', '引き算'] },
    { id: 'c11', title: '通知を10分だけ切る', category: 'head', emoji: '🔕', durationMinutes: 10, difficulty: 1,
      suitedStates: ['infofatigue', 'irritated', 'nosocial'],
      mainMessage: '世界との接続を少しだけ弱めましょう。',
      action: 'スマホの通知を10分だけオフにしてください。',
      poteMessage: '世界は10分くらい待ってくれます。',
      tags: ['通知', 'デジタル'] },
    { id: 'c12', title: 'タブを3つ閉じる', category: 'head', emoji: '🗂️', durationMinutes: 2, difficulty: 1,
      suitedStates: ['infofatigue', 'heavyhead', 'busy'],
      mainMessage: '開きっぱなしのものを少し減らしましょう。',
      action: 'スマホかPCで、今いらないタブを3つ閉じてください。',
      poteMessage: 'タブが減ると、脳の窓も少し閉まります。',
      tags: ['タブ', 'デジタル'] },
    { id: 'c13', title: '返信を1件だけ返す', category: 'head', emoji: '💬', durationMinutes: 3, difficulty: 2,
      suitedStates: ['guilty', 'busy', 'nosocial'],
      mainMessage: '全部返そうとしなくて大丈夫です。',
      action: '一番軽く返せる返信を1件だけ返してください。',
      poteMessage: '1件返したら、今日は勝ち寄りです。',
      tags: ['返信', '1件だけ'] },
    { id: 'c14', title: '机の上を1か所だけ空ける', category: 'head', emoji: '🧹', durationMinutes: 5, difficulty: 2,
      suitedStates: ['heavyhead', 'busy', 'unmotivated'],
      mainMessage: '視界に余白を作りましょう。',
      action: '机の上の一角だけ、物をどかしてください。',
      poteMessage: '全部片付けなくていいです。一角で十分です。',
      tags: ['机', '余白'] },
    { id: 'c15', title: '5分だけタイマーをかける', category: 'head', emoji: '⏲️', durationMinutes: 5, difficulty: 2,
      suitedStates: ['unmotivated', 'guilty', 'busy'],
      mainMessage: '終わらせるのではなく、始めるための5分です。',
      action: '5分タイマーをかけて、気になる作業を少しだけ触ってください。',
      poteMessage: '5分触れたら、もうゼロではありません。',
      tags: ['タイマー', '始める'] },
    { id: 'c16', title: '脳内会議を一旦終了する', category: 'head', emoji: '🧠', durationMinutes: 2, difficulty: 1,
      suitedStates: ['heavyhead', 'busy', 'irritated'],
      mainMessage: '考え続けても進まないことを、少し横に置きましょう。',
      action: '「これは明日考える」とメモして、今は閉じてください。',
      poteMessage: '会議は閉会です。おつかれさまでした。',
      tags: ['考えすぎ', '明日'] },

    /* ============ 気分を上げる ============ */
    { id: 'c17', title: '好きな飲み物を買う', category: 'mood', emoji: '🧃', durationMinutes: 5, difficulty: 2,
      suitedStates: ['unmotivated', 'tired', 'lonely'],
      mainMessage: '小さい楽しみを1つ入れましょう。',
      action: 'コンビニ、自販機、家の中。好きな飲み物を1つ選んでください。',
      poteMessage: '飲み物ひとつで、今日は少し変えられます。',
      tags: ['飲み物', 'ごほうび'] },
    { id: 'c18', title: '1曲だけ聴く', category: 'mood', emoji: '🎵', durationMinutes: 5, difficulty: 1,
      suitedStates: ['irritated', 'lonely', 'unmotivated'],
      mainMessage: '気分を言葉ではなく音で動かしましょう。',
      action: '好きな曲を1曲だけ聴いてください。',
      poteMessage: '1曲分だけ、別世界に行ってきましょう。',
      tags: ['音楽', '1曲'] },
    { id: 'c19', title: '小さいご褒美を決める', category: 'mood', emoji: '🍬', durationMinutes: 2, difficulty: 1,
      suitedStates: ['tired', 'unmotivated', 'guilty'],
      mainMessage: '今日の終わりに楽しみを置きましょう。',
      action: 'お菓子、動画、風呂、ゲームなど、小さいご褒美を1つ決めてください。',
      poteMessage: 'ご褒美がある日は、ちょっと進みやすいです。',
      tags: ['ごほうび', '楽しみ'] },
    { id: 'c20', title: 'かわいいものを見る', category: 'mood', emoji: '🐶', durationMinutes: 1, difficulty: 1,
      suitedStates: ['lonely', 'irritated', 'tired'],
      mainMessage: '理屈ではなく、かわいいで回復しましょう。',
      action: '動物、キャラクター、好きな写真など、かわいいものを30秒見てください。',
      poteMessage: 'かわいいは、合法の回復です。',
      tags: ['かわいい', '30秒'] },
    { id: 'c21', title: '外を少し歩く', category: 'mood', emoji: '🚶', durationMinutes: 3, difficulty: 2,
      suitedStates: ['heavyhead', 'unmotivated', 'irritated'],
      mainMessage: '気分を足で動かしましょう。',
      action: '家の周り、廊下、近所を3分だけ歩いてください。',
      poteMessage: '歩くと、気分も少しだけ移動します。',
      tags: ['歩く', '散歩'] },
    { id: 'c22', title: '好きな香りを使う', category: 'mood', emoji: '🌸', durationMinutes: 2, difficulty: 1,
      suitedStates: ['irritated', 'tired', 'lonely'],
      mainMessage: '気分を香りで切り替えましょう。',
      action: 'ハンドクリーム、柔軟剤、お茶、コーヒーなど、好きな香りを少し感じてください。',
      poteMessage: '鼻から回復する日もあります。',
      tags: ['香り', '切り替え'] },
    { id: 'c23', title: '明るい場所に移動する', category: 'mood', emoji: '☀️', durationMinutes: 2, difficulty: 2,
      suitedStates: ['sleepy', 'unmotivated', 'lonely'],
      mainMessage: '光を少し足しましょう。',
      action: '窓際、明るい部屋、外など、少し明るい場所に移動してください。',
      poteMessage: '光、意外と味方です。',
      tags: ['光', '移動'] },
    { id: 'c24', title: '今日の楽しみを1つ作る', category: 'mood', emoji: '🎁', durationMinutes: 2, difficulty: 1,
      suitedStates: ['unmotivated', 'busy', 'lonely'],
      mainMessage: '予定の中に、自分のための点を置きましょう。',
      action: '今日中にできる小さい楽しみを1つ決めてください。',
      poteMessage: '楽しみは、小さくても予定に入れていいです。',
      tags: ['楽しみ', '予定'] },

    /* ============ 人間関係から少し離れる ============ */
    { id: 'c25', title: '返信を短くする', category: 'social', emoji: '✉️', durationMinutes: 2, difficulty: 1,
      suitedStates: ['nosocial', 'tired', 'busy'],
      mainMessage: '丁寧すぎて疲れているかもしれません。',
      action: '次の返信は、短くても伝わる形にしてください。',
      poteMessage: '短い返信でも、ちゃんと返信です。',
      tags: ['返信', '省エネ'] },
    { id: 'c26', title: '大事な話を明日に回す', category: 'social', emoji: '📮', durationMinutes: 1, difficulty: 1,
      suitedStates: ['nosocial', 'tired', 'irritated'],
      mainMessage: '疲れている日の大事な話は、重くなりがちです。',
      action: '急ぎでなければ、大事な話は明日に回してください。',
      poteMessage: '明日の自分に渡しても大丈夫です。',
      tags: ['明日', '先送り'] },
    { id: 'c27', title: '既読前に深呼吸する', category: 'social', emoji: '😮‍💨', durationMinutes: 1, difficulty: 1,
      suitedStates: ['nosocial', 'irritated', 'infofatigue'],
      mainMessage: '読む前に、一呼吸置きましょう。',
      action: 'メッセージを開く前に、深呼吸を1回してください。',
      poteMessage: 'すぐ反応しなくても大丈夫です。',
      tags: ['メッセージ', '呼吸'] },
    { id: 'c28', title: 'ひとり時間を10分確保する', category: 'social', emoji: '🚪', durationMinutes: 10, difficulty: 2,
      suitedStates: ['nosocial', 'infofatigue', 'irritated'],
      mainMessage: '誰とも話さない時間を作りましょう。',
      action: '10分だけ、会話や返信から離れてください。',
      poteMessage: 'ひとり時間は、充電器みたいなものです。',
      tags: ['ひとり', '10分'] },
    { id: 'c29', title: '説明しすぎない', category: 'social', emoji: '🤫', durationMinutes: 1, difficulty: 1,
      suitedStates: ['nosocial', 'tired', 'busy'],
      mainMessage: '全部わかってもらおうとしなくていい日もあります。',
      action: '次の説明は、必要なことだけに絞ってください。',
      poteMessage: '省エネ説明でいきましょう。',
      tags: ['説明', '省エネ'] },
    { id: 'c30', title: '断る文を1つ下書きする', category: 'social', emoji: '✍️', durationMinutes: 3, difficulty: 2,
      suitedStates: ['nosocial', 'busy', 'guilty'],
      mainMessage: '断るのが苦手な日は、まず下書きだけで十分です。',
      action: '「今日は難しいです」「明日確認します」など、短い断り文を作ってください。',
      poteMessage: '下書きできたら半分勝ちです。',
      tags: ['断る', '下書き'] },
    { id: 'c31', title: 'SNSを10分閉じる', category: 'social', emoji: '📵', durationMinutes: 10, difficulty: 1,
      suitedStates: ['infofatigue', 'lonely', 'nosocial'],
      mainMessage: '他人の情報から少し離れましょう。',
      action: 'SNSアプリを10分だけ閉じてください。',
      poteMessage: '人の生活は、またあとで見れば大丈夫です。',
      tags: ['SNS', 'デジタル'] },
    { id: 'c32', title: '自分の予定を優先する', category: 'social', emoji: '⭐', durationMinutes: 2, difficulty: 2,
      suitedStates: ['busy', 'nosocial', 'guilty'],
      mainMessage: '人に合わせすぎているかもしれません。',
      action: '今日、自分の予定を1つだけ優先してください。',
      poteMessage: '自分を予定に入れていいです。',
      tags: ['自分優先', '予定'] },

    /* ============ 生活を整える ============ */
    { id: 'c33', title: 'ゴミを1つ捨てる', category: 'life', emoji: '🗑️', durationMinutes: 1, difficulty: 2,
      suitedStates: ['unmotivated', 'guilty', 'heavyhead'],
      mainMessage: '片付けではなく、1つだけ減らしましょう。',
      action: '目に入ったゴミを1つ捨ててください。',
      poteMessage: '1つ捨てたら、世界が少し広くなります。',
      tags: ['捨てる', '1つだけ'] },
    { id: 'c34', title: '洗濯物を1枚だけ畳む', category: 'life', emoji: '👕', durationMinutes: 2, difficulty: 2,
      suitedStates: ['guilty', 'unmotivated', 'busy'],
      mainMessage: '全部やる必要はありません。',
      action: '洗濯物を1枚だけ畳んでください。',
      poteMessage: '1枚でも、ちゃんと前進です。',
      tags: ['洗濯', '1枚だけ'] },
    { id: 'c35', title: '洗面台を少しだけ拭く', category: 'life', emoji: '🪞', durationMinutes: 3, difficulty: 3,
      suitedStates: ['guilty', 'unmotivated', 'irritated'],
      mainMessage: '小さい場所を1つだけ整えましょう。',
      action: '洗面台の一部だけ、ティッシュなどで拭いてください。',
      poteMessage: '一部だけきれい、かなり良いです。',
      tags: ['掃除', '洗面台'] },
    { id: 'c36', title: '明日の服を決める', category: 'life', emoji: '👔', durationMinutes: 3, difficulty: 2,
      suitedStates: ['busy', 'tired', 'guilty'],
      mainMessage: '明日の自分を少し助けましょう。',
      action: '明日着る服をなんとなく決めておいてください。',
      poteMessage: '未来の自分が少し助かります。',
      tags: ['明日', '服'] },
    { id: 'c37', title: '充電器につなぐ', category: 'life', emoji: '🔌', durationMinutes: 1, difficulty: 1,
      suitedStates: ['tired', 'busy', 'infofatigue'],
      mainMessage: 'スマホも自分も、充電が必要です。',
      action: 'スマホやイヤホンを充電してください。',
      poteMessage: '充電は正義です。',
      tags: ['充電', '準備'] },
    { id: 'c38', title: 'カバンの中を1つだけ出す', category: 'life', emoji: '🎒', durationMinutes: 2, difficulty: 2,
      suitedStates: ['busy', 'guilty', 'heavyhead'],
      mainMessage: '全部整理しなくて大丈夫です。',
      action: 'カバンの中から不要なものを1つだけ出してください。',
      poteMessage: '1つ減ると、少し軽くなります。',
      tags: ['カバン', '1つだけ'] },
    { id: 'c39', title: '食器を1つだけ洗う', category: 'life', emoji: '🍽️', durationMinutes: 3, difficulty: 2,
      suitedStates: ['guilty', 'unmotivated', 'tired'],
      mainMessage: '全部洗おうとすると重いので、1つだけにしましょう。',
      action: 'コップや皿を1つだけ洗ってください。',
      poteMessage: '1つ洗った人は、かなりえらいです。',
      tags: ['食器', '1つだけ'] },
    { id: 'c40', title: '床のものを1つ拾う', category: 'life', emoji: '🧺', durationMinutes: 1, difficulty: 2,
      suitedStates: ['heavyhead', 'guilty', 'unmotivated'],
      mainMessage: '足元のノイズを少し減らしましょう。',
      action: '床にあるものを1つだけ拾って、置き場に戻してください。',
      poteMessage: '床が少し見えると、気分も少し見えます。',
      tags: ['床', '1つだけ'] },

    /* ============ 罪悪感を軽くする ============ */
    { id: 'c41', title: '今日できたことを1つ書く', category: 'guilt', emoji: '🌱', durationMinutes: 2, difficulty: 1,
      suitedStates: ['guilty', 'unmotivated', 'lonely'],
      mainMessage: 'できていないことより、できたことを1つ拾いましょう。',
      action: '今日できたことを1つだけメモしてください。',
      poteMessage: 'できたこと、ちゃんとありました。',
      tags: ['できたこと', 'メモ'] },
    { id: 'c42', title: 'やれなかったことを明日に置く', category: 'guilt', emoji: '📦', durationMinutes: 2, difficulty: 1,
      suitedStates: ['guilty', 'busy', 'tired'],
      mainMessage: '今日できなかったことを、責めずに移動しましょう。',
      action: 'やれなかったことを1つ、明日のメモに移してください。',
      poteMessage: '持ち越しは失敗ではなく、整理です。',
      tags: ['明日', '持ち越し'] },
    { id: 'c43', title: '「今日はここまで」と言う', category: 'guilt', emoji: '🌙', durationMinutes: 1, difficulty: 1,
      suitedStates: ['guilty', 'tired', 'busy'],
      mainMessage: '終わりを決めるのも回復です。',
      action: '声に出すか、心の中で「今日はここまで」と言ってください。',
      poteMessage: '閉店ガラガラです。おつかれさまでした。',
      tags: ['区切り', '終わり'] },
    { id: 'c44', title: '完璧を1つ手放す', category: 'guilt', emoji: '🎈', durationMinutes: 2, difficulty: 1,
      suitedStates: ['guilty', 'busy', 'irritated'],
      mainMessage: 'ちゃんとやるより、終えることが大事な日もあります。',
      action: '今日だけ70点でいいものを1つ決めてください。',
      poteMessage: '70点営業、かなり助かります。',
      tags: ['70点', '手放す'] },
    { id: 'c45', title: '自分に短く謝る', category: 'guilt', emoji: '🤝', durationMinutes: 1, difficulty: 1,
      suitedStates: ['guilty', 'tired', 'lonely'],
      mainMessage: '責め続けるより、一度謝って終わりにしましょう。',
      action: '「今日ちょっと無理させたね」と自分に言ってください。',
      poteMessage: '自分への謝罪、意外と大事です。',
      tags: ['自分', 'ねぎらい'] },
    { id: 'c46', title: '明日の自分に一言残す', category: 'guilt', emoji: '💌', durationMinutes: 2, difficulty: 1,
      suitedStates: ['guilty', 'busy', 'heavyhead'],
      mainMessage: '未来の自分に、やさしく引き継ぎましょう。',
      action: '明日の自分へ短いメモを1つ残してください。',
      poteMessage: '引き継ぎがやさしい人は、いい人です。',
      tags: ['明日', 'メモ'] },
    { id: 'c47', title: 'できなかった理由を1つだけ認める', category: 'guilt', emoji: '🍵', durationMinutes: 2, difficulty: 1,
      suitedStates: ['guilty', 'unmotivated', 'tired'],
      mainMessage: 'できなかったのには、理由があるはずです。',
      action: '「疲れていた」「予定が多かった」など、理由を1つ認めてください。',
      poteMessage: '理由がある日は、責めなくていいです。',
      tags: ['理由', '認める'] },
    { id: 'c48', title: '今日の最低ラインを決め直す', category: 'guilt', emoji: '🪜', durationMinutes: 2, difficulty: 1,
      suitedStates: ['busy', 'guilty', 'tired'],
      mainMessage: '途中で目標を下げても大丈夫です。',
      action: '今日の最低ラインを「これだけできればOK」に決め直してください。',
      poteMessage: 'ライン調整は、生きる知恵です。',
      tags: ['最低ライン', '調整'] },

    /* ============ 何もしないを許す ============ */
    { id: 'c49', title: '5分だけ何もしない', category: 'rest', emoji: '☁️', durationMinutes: 5, difficulty: 1,
      suitedStates: ['unmotivated', 'infofatigue', 'tired'],
      mainMessage: '何もしない時間を、ちゃんと予定にしましょう。',
      action: '5分だけ、何も進めずに過ごしてください。',
      poteMessage: '何もしないを、堂々とやりましょう。',
      tags: ['何もしない', '5分'] },
    { id: 'c50', title: '布団に入る準備だけする', category: 'rest', emoji: '🛌', durationMinutes: 5, difficulty: 2,
      suitedStates: ['sleepy', 'tired', 'unmotivated'],
      mainMessage: '寝るところまで行かなくても、準備だけで十分です。',
      action: '布団やベッドに入れる状態を作ってください。',
      poteMessage: '寝る準備は、かなり大きい回復です。',
      tags: ['布団', '準備'] },
    { id: 'c51', title: 'スマホを伏せる', category: 'rest', emoji: '📱', durationMinutes: 1, difficulty: 1,
      suitedStates: ['infofatigue', 'irritated', 'heavyhead'],
      mainMessage: '画面から少し距離を取りましょう。',
      action: 'スマホを伏せて、1分だけ画面を見ないでください。',
      poteMessage: '世界は1分くらい待ってくれます。',
      tags: ['スマホ', '1分'] },
    { id: 'c52', title: '予定を1つ減らす', category: 'rest', emoji: '🗓️', durationMinutes: 2, difficulty: 1,
      suitedStates: ['busy', 'tired', 'guilty'],
      mainMessage: '増やすより減らす方が必要な日です。',
      action: '今日の予定やタスクを1つ減らせないか確認してください。',
      poteMessage: '減らすのも立派な調整です。',
      tags: ['予定', '引き算'] },
    { id: 'c53', title: '何もしない自分を許す', category: 'rest', emoji: '🍀', durationMinutes: 1, difficulty: 1,
      suitedStates: ['unmotivated', 'guilty', 'lonely'],
      mainMessage: '動けない日にも、意味はあります。',
      action: '「今日は回復中」と自分に言ってください。',
      poteMessage: '回復中の札、出しておきましょう。',
      tags: ['回復中', '許す'] },
    { id: 'c54', title: '早めに寝る宣言をする', category: 'rest', emoji: '💤', durationMinutes: 1, difficulty: 1,
      suitedStates: ['sleepy', 'tired', 'guilty'],
      mainMessage: '今日は巻き返すより、閉じる方が良さそうです。',
      action: '寝る時間を少し早めに決めてください。',
      poteMessage: '早仕舞い、かなり良い判断です。',
      tags: ['睡眠', '宣言'] },
    { id: 'c55', title: '大きな判断を明日に回す', category: 'rest', emoji: '⏳', durationMinutes: 1, difficulty: 1,
      suitedStates: ['heavyhead', 'busy', 'tired'],
      mainMessage: '疲れている日の判断は、少し重くなりがちです。',
      action: '急ぎでない大きな判断を明日に回してください。',
      poteMessage: '判断にも体力がいります。',
      tags: ['判断', '明日'] },
    { id: 'c56', title: '今日は省エネモードにする', category: 'rest', emoji: '🔋', durationMinutes: 1, difficulty: 1,
      suitedStates: ['tired', 'unmotivated', 'busy'],
      mainMessage: '全部通常運転じゃなくて大丈夫です。',
      action: '今日の自分を省エネモードとして扱ってください。',
      poteMessage: '省エネでも、ちゃんと運転中です。',
      tags: ['省エネ', 'モード'] },

    /* ============ 追加カード ============ */
    { id: 'c57', title: '好きな動画を1本だけ見る', category: 'mood', emoji: '🎬', durationMinutes: 10, difficulty: 1,
      suitedStates: ['unmotivated', 'lonely', 'tired'],
      mainMessage: '少しだけ楽しみに逃げましょう。',
      action: '短い動画を1本だけ見てください。連続再生には注意です。',
      poteMessage: '1本だけなら、回復寄りです。',
      tags: ['動画', '1本だけ'] },
    { id: 'c58', title: 'コンビニを目的なく歩く', category: 'mood', emoji: '🏪', durationMinutes: 10, difficulty: 2,
      suitedStates: ['lonely', 'unmotivated', 'heavyhead'],
      mainMessage: '小さな外出で気分を変えましょう。',
      action: '近くのコンビニや店内を少し歩いてください。',
      poteMessage: '目的がなくても、歩いたらえらいです。',
      tags: ['コンビニ', '外出'] },
    { id: 'c59', title: '温かいシャワーを浴びる', category: 'body', emoji: '🚿', durationMinutes: 10, difficulty: 3,
      suitedStates: ['tired', 'heavyhead', 'guilty'],
      mainMessage: '考えるより先に、体を流しましょう。',
      action: '短くてもいいので、温かいシャワーを浴びてください。',
      poteMessage: 'シャワーはリセットボタンに近いです。',
      tags: ['シャワー', 'リセット'] },
    { id: 'c60', title: '好きなものを一口食べる', category: 'mood', emoji: '🍫', durationMinutes: 2, difficulty: 1,
      suitedStates: ['tired', 'lonely', 'unmotivated'],
      mainMessage: '小さく自分を甘やかしましょう。',
      action: 'チョコ、飴、果物、何でもいいので好きなものを一口食べてください。',
      poteMessage: '一口のごきげん、採用です。',
      tags: ['食べる', '一口'] }
  ];

  /* ---- 派生データ -------------------------------------------------------- */
  var categoryById = {};
  CATEGORIES.forEach(function (c) { categoryById[c.id] = c; });

  var stateById = {};
  STATES.forEach(function (s) { stateById[s.id] = s; });

  // recoveryType(「体力 +1」など)と shareText を各カードに付与する。
  CARDS.forEach(function (card) {
    var cat = categoryById[card.category];
    card.recoveryType = (cat ? cat.statLabel : '回復') + ' +1';
    card.shareText = 'ごきげん回復ガチャで出た今日のカードは『' + card.title + '』でした。\n\n' +
      card.mainMessage + '\n今日は少し戻れたら十分です。';
  });

  global.GACHA_DATA = {
    APP: APP,
    CATEGORIES: CATEGORIES,
    STATES: STATES,
    PRIMARY_STATES: PRIMARY_STATES,
    ONBOARDING: ONBOARDING,
    POTE: POTE,
    CARDS: CARDS,
    categoryById: categoryById,
    stateById: stateById
  };
})(window);
