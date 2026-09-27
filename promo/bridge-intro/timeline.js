// 映像と音が共有する唯一の時刻表。すべて「拍」で書く(96BPM・54拍=33.75秒)。
// index.html は window.TL として読み、make_audio.py と fetch_fonts.py は先頭の代入を外して JSON として読む。
window.TL = {
  "bpm": 96,
  "beats": 54,
  "fps": 30,
  "width": 1920,
  "height": 1080,

  "sections": { "daily": 5, "compass": 15, "montage": 24, "idea": 42, "breath": 47.25, "end": 47.5 },

  "montage": [
    { "beat": 24,   "dur": 2,   "name": "掲示じたく",         "t": "院内掲示を、選んで埋めるだけ",           "img": "keiji.webp" },
    { "beat": 26,   "dur": 2,   "name": "RehaBoard",          "t": "リハ部門の運営を、1画面に",              "img": "rehaboard.webp" },
    { "beat": 28,   "dur": 2,   "name": "クリニックタウン3D", "t": "クリニック経営を、1日ずつ動かして学ぶ", "img": "clinic-flow-3d.webp" },
    { "beat": 30,   "dur": 2,   "name": "窓あかり",           "t": "小さな病院の一日を、ただ眺める",         "img": "madoakari.webp" },
    { "beat": 32,   "dur": 0.5, "name": "やわ返",             "img": "yawagaeshi.webp" },
    { "beat": 32.5, "dur": 0.5, "name": "二度手間さがし",     "img": "nidodema.webp" },
    { "beat": 33,   "dur": 0.5, "name": "MedBoard",           "img": "medboard.webp" },
    { "beat": 33.5, "dur": 0.5, "name": "HireBoard",          "img": "hireboard.webp" },
    { "beat": 34,   "dur": 0.5, "name": "面接官の手帖",       "img": "interview-kit.webp" },
    { "beat": 34.5, "dur": 0.5, "name": "ターンアラウンド12", "img": "turnaround12.webp" },
    { "beat": 35,   "dur": 0.5, "name": "経験の棚卸し",       "img": "tanaoroshi.webp" },
    { "beat": 35.5, "dur": 0.5, "name": "職場モヤモヤ診断",   "img": "moyamoya.webp" },
    { "beat": 36,   "dur": 0.5, "name": "キャリアログ",       "img": "careerlog.webp" },
    { "beat": 36.5, "dur": 0.5, "name": "HIM Quiz",           "img": "him-quiz.webp" },
    { "beat": 37,   "dur": 0.5, "name": "Daily English",      "img": "english-trainer.webp" },
    { "beat": 37.5, "dur": 0.5, "name": "ごきげん回復ガチャ", "img": "gokigen-gacha.webp" },
    { "beat": 38,   "dur": 0.5, "name": "ふたつめの波",       "img": "futatsume.webp" }
  ],

  "chords": [
    { "beat": 0,    "notes": ["D3", "A3", "C#4", "E4", "F#4"] },
    { "beat": 4,    "notes": ["B2", "F#3", "A3", "D4"] },
    { "beat": 8,    "notes": ["G2", "D3", "F#3", "B3"] },
    { "beat": 12,   "notes": ["A2", "E3", "A3", "C#4"] },
    { "beat": 16,   "notes": ["D3", "A3", "C#4", "F#4"] },
    { "beat": 20,   "notes": ["B2", "F#3", "A3", "D4"] },
    { "beat": 24,   "notes": ["G2", "D3", "F#3", "B3"] },
    { "beat": 28,   "notes": ["A2", "E3", "G3", "C#4"] },
    { "beat": 32,   "notes": ["D3", "A3", "C#4", "F#4"] },
    { "beat": 36,   "notes": ["B2", "F#3", "A3", "D4"] },
    { "beat": 40,   "notes": ["G2", "D3", "F#3", "A3", "B3"] },
    { "beat": 44,   "notes": ["A2", "E3", "A3", "B3", "D4"] },
    { "beat": 47.5, "notes": ["D3", "A3", "E4", "F#4", "A4"] }
  ],

  "plucks": [
    { "beat": 0,     "note": "D5" },
    { "beat": 0.6,   "note": "A5" },
    { "beat": 2.5,   "note": "F#5" },
    { "beat": 5,     "note": "D5" },
    { "beat": 6,     "note": "E5" },
    { "beat": 7,     "note": "F#5" },
    { "beat": 7.5,   "note": "A5" },
    { "beat": 8.5,   "note": "B5" },
    { "beat": 10,    "note": "A4" },
    { "beat": 10.75, "note": "D5" },
    { "beat": 15.2,  "note": "F#5" },
    { "beat": 16.8,  "note": "A5" },
    { "beat": 18.2,  "note": "F#5" },
    { "beat": 19.8,  "note": "E6" },
    { "beat": 24,    "note": "D5" },
    { "beat": 26,    "note": "F#5" },
    { "beat": 28,    "note": "A5" },
    { "beat": 30,    "note": "B5" },
    { "beat": 32,    "note": "D5" },
    { "beat": 32.5,  "note": "E5" },
    { "beat": 33,    "note": "F#5" },
    { "beat": 33.5,  "note": "A5" },
    { "beat": 34,    "note": "B5" },
    { "beat": 34.5,  "note": "D6" },
    { "beat": 35,    "note": "B5" },
    { "beat": 35.5,  "note": "A5" },
    { "beat": 36,    "note": "F#5" },
    { "beat": 36.5,  "note": "A5" },
    { "beat": 37,    "note": "B5" },
    { "beat": 37.5,  "note": "D6" },
    { "beat": 38,    "note": "E6" },
    { "beat": 38.6,  "note": "A4" },
    { "beat": 42.9,  "note": "D5" },
    { "beat": 43.1,  "note": "F#5" },
    { "beat": 43.9,  "note": "A5" },
    { "beat": 47.5,  "note": "D4" },
    { "beat": 47.75, "note": "A4" },
    { "beat": 48,    "note": "D5" },
    { "beat": 48.25, "note": "E5" },
    { "beat": 48.5,  "note": "F#5" },
    { "beat": 49,    "note": "A5" }
  ],

  "kick": [
    { "from": 15, "to": 24, "every": 2 },
    { "from": 24, "to": 38.5, "every": 1 },
    { "from": 43, "to": 47, "every": 2 }
  ],
  "hat":   { "from": 24, "to": 38.5, "every": 1, "offset": 0.5 },
  "swell": { "from": 39.5, "to": 42 },
  "silence": { "from": 47.25, "to": 47.5 },

  // 声(make_voice.py が読み上げ、make_audio.py が拍に置く)。text=画面と同じ文、say=読み方を変えたいときだけ。
  // 声は4行だけ(第17条・編集長照合 2026-09-26)。具体と道具の場面は画面と音楽が受け持つ
  // beat は読み上げの長さが決まる前の仮置き。make_voice.py の一覧で重なりを見て、場面ごと組み直す
  "voice": {
    "model": "gemini-3.8-flash-tts",
    "name": "Sulafat",
    "style": "落ち着いた低めの声で、ゆっくり、静かに。温かいが売り込まない。抑揚をつけすぎず、語尾は下げて言い切る。文と文の間に十分な間をとる。「たぶん」を強調しない。ドキュメンタリーのナレーションのように",
    "lines": [
      { "id": "daily",   "beat": 10,   "text": "毎日やっていること、たぶん今の職場の外でも使えます。" },
      { "id": "made",    "beat": 38.6, "text": "作ったものを、直しながら置いています。" },
      { "id": "idea",    "beat": 42,   "text": "正解を与えるのではなく、選択肢を増やす。" },
      { "id": "mission", "beat": 49,   "text": "人が、自ら選び、納得して生きられる社会をつくる。", "say": "人が、みずから選び、納得して生きられる社会をつくる。" }
    ]
  },

  "texts": [
    "BRIDGE",
    "患者さんへの対応", "申し送り", "多職種カンファレンス", "記録", "後輩指導",
    "毎日やっていること、", "たぶん今の職場の外でも使えます",
    "BRIDGE Compass", "病院の外で通じる言葉に置き換えてみる道具",
    "退院支援", "プロジェクト推進・合意形成", "多職種カンファレンス", "ステークホルダー調整",
    "作ったものを、直しながら置いています",
    "正解を与えるのではなく、", "選択肢を増やす",
    "人が、自ら選び、納得して生きられる社会をつくる", "bridge-med.github.io/bridge-lp", "声は合成音声です"
  ]
};
