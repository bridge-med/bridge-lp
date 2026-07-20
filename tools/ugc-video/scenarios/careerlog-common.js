// キャリアログ動画の共通部品 — デモデータ注入とAIバックエンドのスタブ
//
// 誠実の注記: デモデータは「対人援助職の地味な日常」の架空例(数値成果の誇張なし)。
// AI生成のスタブ文は入力ログに忠実な控えめの下書きで、公開前にeditor照合を通す。

// 直近7日ぶんの日付(今日を含む)を作る
function lastDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

const TITLES = [
  { title: '新人さんの移乗介助に付き添って、コツを一緒に言語化した', tags: ['教育'] },
  { title: '退院前カンファで生活動線の情報を整理して共有した', tags: ['チーム連携'] },
  { title: '歩行訓練の順番を入れ替えて待ち時間を減らした', tags: ['業務改善'] },
  { title: 'ご家族への説明を、写真つきの資料に作り直した', tags: ['現場調整'] },
  { title: '転倒レポートの集計を科内ミーティングで共有した', tags: ['数字分析'] },
  { title: '気になっていた症例の文献をひとつ読んだ', tags: ['学び'] },
  { title: '歩行が不安定な患者さんの介助方法を、担当の看護師と一緒に見直した', tags: ['現場調整'] },
];

function buildSeed() {
  const days = lastDays(7);
  const logs = TITLES.map((t, i) => ({
    id: 'demo-' + i,
    date: days[i],
    title: t.title,
    did: '', problem: '', devised: '', decision: '', people: '', result: '',
    learning: '', nextAction: '', memo: '', tags: t.tags,
    createdAt: days[i] + 'T09:00:00.000Z',
    updatedAt: days[i] + 'T09:00:00.000Z',
  }));
  return {
    'bridge-daily:work_logs': JSON.stringify(logs),
    'bridge-daily:coins': '8',
    'bridge-daily:progress': JSON.stringify({
      xp: 160, streak: 7, bestStreak: 7, lastDay: days[6], lastBonusDay: days[6],
      logsCount: 7, reflectionsCount: 0, badges: ['first_log'], capDay: null, capCounts: {},
    }),
  };
}

// 変換形式ごとの控えめな下書き(入力ログの範囲を出ない)
const CAREER_TEXTS = {
  '職務経歴書風': [
    '【職務経歴書風(下書き)】',
    '',
    '■ 多職種と連携した介助・訓練の改善',
    '歩行訓練の運用や介助手順を、看護師・新人と協働で見直し、',
    '現場で共有できる形に整えた。',
    '',
    '■ 情報の言語化・共有',
    'カンファでの生活動線の整理、転倒レポートの集計共有など、',
    '現場の情報を関係者に伝わる形にした。',
    '',
    '※ログをもとにした下書きです。仕上げはあなたの言葉で。',
  ].join('\n'),
  '面接回答風': [
    '【面接回答風(下書き)】',
    '',
    'Q. 現場で工夫したことを教えてください',
    '',
    '「歩行訓練の順番を入れ替えて待ち時間を減らしたり、',
    '介助の手順を看護師と一緒に見直したり、',
    '小さな改善を現場と共有しながら進めてきました。',
    '一人で完結させず、職種をこえて形にするのが持ち味です。」',
    '',
    '※ログをもとにした下書きです。仕上げはあなたの言葉で。',
  ].join('\n'),
  '1on1資料風': [
    '【1on1資料風(下書き)】',
    '',
    '・今週の取り組み: 移乗介助の言語化(新人教育)、',
    '  歩行訓練の運用見直し、転倒レポートの共有',
    '・相談したいこと: 改善の進め方と優先順位',
    '',
    '※ログをもとにした下書きです。',
  ].join('\n'),
};

const REFLECTION_CONTENT = {
  did: '介助手順の見直し、歩行訓練の運用改善、カンファでの情報整理など、現場の小さな改善を記録した。',
  impressive: '新人さんと一緒に移乗介助のコツを言語化できたこと。',
  issues: '改善が個人の工夫にとどまり、仕組みとして残す一歩が課題。',
  improved: '待ち時間や説明資料など、相手の立場から見直す視点が増えた。',
  next: '介助手順の見直しを、科内で共有できる手順メモにまとめる。',
  strengths: '職種をこえて相談しながら形にする連携力。',
  achievements: '歩行訓練の運用見直し / 移乗介助の言語化(教育)',
};

module.exports = {
  buildSeed,
  // localStorageへデモデータを注入(アプリ読込前に実行される)
  async seedStorage(ctx) {
    const seed = buildSeed();
    await ctx.addInitScript((data) => {
      for (const [k, v] of Object.entries(data)) localStorage.setItem(k, v);
    }, seed);
  },
  // AIバックエンド(Supabase)のスタブ。kindとlabelに応じて下書きを返す
  async stubBackend(ctx) {
    await ctx.route(/supabase\.co\/functions\/v1\/ai/, (route) => {
      let body = {};
      try { body = route.request().postDataJSON() || {}; } catch (e) { /* noop */ }
      let payload;
      if (body.kind === 'reflection') {
        payload = { content: REFLECTION_CONTENT };
      } else {
        const label = (body.input && body.input.label) || '';
        payload = { text: CAREER_TEXTS[label] || CAREER_TEXTS['職務経歴書風'] };
      }
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(payload) });
    });
  },
};
