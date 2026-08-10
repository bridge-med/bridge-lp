/* =========================================================================
 * Growth OS — store.js
 * データモデル・ローカル永続化・集計・状態購読(pub/sub)。
 * UI(app.js)はこの層だけを通じてデータを読み書きする。
 * AI変換の「生成」は store ではなく aiService.js が担当(責務分離。やわ返と同じ構成)。
 * データは localStorage にのみ保存する。外部送信はしない。
 *
 * 型(参考・JSDocで表現):
 *   Potential    : "高"|"中"|"低"|"なし"
 *   WorklogEntry : { id, date, title, body, category, projectId, learnings, blockers,
 *                    reusableInsight, contentPotential:Potential, revenuePotential:Potential,
 *                    tags[], createdAt, updatedAt }
 *   Project      : { id, title, description, status, priority, goal, nextAction,
 *                    revenuePotential:Potential, tags[], createdAt, updatedAt }
 *   Task         : { id, title, description, status, priority, dueDate, projectId,
 *                    sourceType, sourceId, createdAt, updatedAt }
 *   Idea         : { id, title, problem, targetUser, solution, priceIdea, salesChannel,
 *                    easeScore:1-5, revenueScore:1-5, motivationScore:1-5,
 *                    requiredAssets, nextValidationAction, status, createdAt, updatedAt }
 *   ContentItem  : { id, title, type, status, sourceType:""|"worklog"|"idea"|"project",
 *                    sourceId, targetAudience, mainMessage, draft, publishUrl,
 *                    monetizationLink, createdAt, updatedAt }
 *   RevenueRecord: { id, date, source, productName, amount, memo, createdAt }
 *   AiLog        : { id, at, templateId, templateLabel, sourceType, sourceId, provider, ok }
 *   Settings     : { monthlyGoal:number, todayFocus:string }
 * ========================================================================= */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'bridge-growth-v1';

  /* ---- 語彙(唯一の情報源。増やすときはここに足す) ---- */
  const CATEGORIES = ['本業', '副業', 'AI開発', 'プロダクト', '医療経営', 'マネジメント', '学習', 'お金', '生活改善', 'その他'];
  const POTENTIALS = ['高', '中', '低', 'なし'];
  const PROJECT_STATUSES = ['構想', '進行中', '停滞', '完了', '見送り'];
  const PRIORITIES = ['高', '中', '低'];
  const IDEA_STATUSES = ['温め中', '検証中', '製作中', '販売中', '見送り'];
  const SALES_CHANNELS = ['note', 'BASE', 'BOOTH', 'Gumroad', 'X', 'TikTok', 'YouTube', 'LP', '直接営業', 'その他'];
  const CONTENT_TYPES = ['note', 'X投稿', 'LinkedIn投稿', 'ブログ', 'LP', '商品説明', 'メルマガ', 'ショート動画台本', 'YouTube台本'];
  const CONTENT_STATUSES = ['ネタ', '構成中', '下書き', '編集中', '公開済み', '販売中', '改善中'];
  const TASK_STATUSES = ['未着手', '進行中', '完了'];
  const SOURCE_KINDS = { worklog: 'Worklog', idea: 'アイデア', project: 'プロジェクト' };

  /* ---- 内部状態 ---- */
  const empty = () => ({
    v: 1,
    worklogs: [], projects: [], tasks: [], ideas: [], content: [], revenue: [], aiLogs: [],
    settings: { monthlyGoal: 30000, todayFocus: '' }
  });
  let state = empty();
  let listeners = [];

  /* ---- ユーティリティ ---- */
  const uid = (p) => (p || 'g_') + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const nowIso = () => new Date().toISOString();
  const todayStr = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD(端末ローカル)

  /* ---- 永続化 ---- */
  function load() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) return false;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.worklogs)) return false;
      const base = empty();
      for (const k of ['worklogs', 'projects', 'tasks', 'ideas', 'content', 'revenue', 'aiLogs']) {
        if (Array.isArray(parsed[k])) base[k] = parsed[k];
      }
      if (parsed.settings && typeof parsed.settings === 'object') {
        base.settings = Object.assign(base.settings, parsed.settings);
      }
      state = base;
      return true;
    } catch (e) {
      return false; // 壊れていたら初期化にフォールバック
    }
  }

  function save() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) {
      /* ストレージ不可(プライベートモード等)でも UI は動かす */
    }
  }

  /* ---- 汎用CRUD ----
     コレクション名で操作を共通化する。add/updateはタイムスタンプを自動で押す。 */
  function coll(name) {
    if (!Array.isArray(state[name])) throw new Error('unknown collection: ' + name);
    return state[name];
  }

  function add(name, data) {
    const item = Object.assign({}, data, { id: uid(), createdAt: nowIso(), updatedAt: nowIso() });
    if (name === 'revenue' || name === 'aiLogs') delete item.updatedAt;
    coll(name).unshift(item);
    save(); emit();
    return item;
  }

  function update(name, id, patch) {
    const item = get(name, id);
    if (!item) return null;
    Object.assign(item, patch);
    if (name !== 'revenue' && name !== 'aiLogs') item.updatedAt = nowIso();
    save(); emit();
    return item;
  }

  function remove(name, id) {
    state[name] = coll(name).filter((x) => x.id !== id);
    save(); emit();
  }

  function get(name, id) {
    return coll(name).find((x) => x.id === id) || null;
  }

  function all(name) {
    return coll(name).slice();
  }

  /* ---- 並び・抽出 ---- */
  const byDateDesc = (key) => (a, b) => String(b[key] || '').localeCompare(String(a[key] || ''));

  /** Worklog(日付の新しい順) */
  function worklogs(category) {
    let list = state.worklogs.slice().sort(byDateDesc('date'));
    if (category) list = list.filter((w) => w.category === category);
    return list;
  }

  /** プロジェクト(進行中→構想→停滞→完了→見送り、同順位は優先度) */
  function projects(status) {
    const so = PROJECT_STATUSES.reduce((m, s, i) => (m[s] = i, m), {});
    const po = PRIORITIES.reduce((m, s, i) => (m[s] = i, m), {});
    const order = { '進行中': 0, '構想': 1, '停滞': 2, '完了': 3, '見送り': 4 };
    let list = state.projects.slice().sort((a, b) =>
      (order[a.status] ?? 9) - (order[b.status] ?? 9) || (po[a.priority] ?? 9) - (po[b.priority] ?? 9));
    if (status) list = list.filter((p) => p.status === status);
    void so;
    return list;
  }

  /** アイデア(見送り以外を、売れそう度×作りやすさの合計降順) */
  function ideas(includeDropped) {
    let list = state.ideas.slice();
    if (!includeDropped) list = list.filter((i) => i.status !== '見送り');
    return list.sort((a, b) =>
      ((b.revenueScore || 0) + (b.easeScore || 0) + (b.motivationScore || 0)) -
      ((a.revenueScore || 0) + (a.easeScore || 0) + (a.motivationScore || 0)));
  }

  function contentItems(status) {
    let list = state.content.slice().sort(byDateDesc('updatedAt'));
    if (status) list = list.filter((c) => c.status === status);
    return list;
  }

  function revenueRecords() {
    return state.revenue.slice().sort(byDateDesc('date'));
  }

  function tasks(projectId) {
    const po = PRIORITIES.reduce((m, s, i) => (m[s] = i, m), {});
    let list = state.tasks.slice().sort((a, b) =>
      (a.status === '完了' ? 1 : 0) - (b.status === '完了' ? 1 : 0) || (po[a.priority] ?? 9) - (po[b.priority] ?? 9));
    if (projectId) list = list.filter((t) => t.projectId === projectId);
    return list;
  }

  function aiLogs() {
    return state.aiLogs.slice();
  }

  function addAiLog(entry) {
    state.aiLogs.unshift(Object.assign({ id: uid('ai_'), at: nowIso() }, entry));
    if (state.aiLogs.length > 100) state.aiLogs.length = 100; // 実行ログは直近100件だけ持つ
    save(); emit();
  }

  /* ---- 設定 ---- */
  function settings() { return Object.assign({}, state.settings); }
  function setSettings(patch) {
    Object.assign(state.settings, patch);
    save(); emit();
  }

  /* ---- 集計(ダッシュボード・右パネル用) ---- */

  /** 今週(直近7日)に作ったもの: 記録数と、公開状態にしたコンテンツ数 */
  function weeklyOutput() {
    const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const logs = state.worklogs.filter((w) => new Date(w.createdAt || w.date).getTime() >= since).length;
    const published = state.content.filter((c) =>
      (c.status === '公開済み' || c.status === '販売中') && new Date(c.updatedAt).getTime() >= since).length;
    return { logs, published };
  }

  /** 今月の売上合計と商品別内訳 */
  function monthRevenue(ym) {
    const month = ym || todayStr().slice(0, 7);
    const rows = state.revenue.filter((r) => (r.date || '').slice(0, 7) === month);
    const total = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
    const byProduct = {};
    rows.forEach((r) => {
      const k = r.productName || '(名称なし)';
      byProduct[k] = (byProduct[k] || 0) + (Number(r.amount) || 0);
    });
    const products = Object.keys(byProduct)
      .map((name) => ({ name, amount: byProduct[name] }))
      .sort((a, b) => b.amount - a.amount);
    return { month, total, products, count: rows.length };
  }

  /** 次にやるべきこと: 未完了タスク+進行中プロジェクトのnextAction(重複しない範囲で) */
  function nextActions(limit) {
    const out = [];
    tasks().forEach((t) => {
      if (t.status !== '完了') {
        const p = t.projectId ? get('projects', t.projectId) : null;
        out.push({ kind: 'task', id: t.id, text: t.title, sub: p ? p.title : '', priority: t.priority || '中', dueDate: t.dueDate || '' });
      }
    });
    projects('進行中').forEach((p) => {
      if (p.nextAction) out.push({ kind: 'project', id: p.id, text: p.nextAction, sub: p.title, priority: p.priority || '中', dueDate: '' });
    });
    const po = { '高': 0, '中': 1, '低': 2 };
    out.sort((a, b) => (po[a.priority] ?? 9) - (po[b.priority] ?? 9));
    return limit ? out.slice(0, limit) : out;
  }

  /** AIからの提案の種: コンテンツ化ポテンシャルが高いのに未変換のWorklog等 */
  function suggestions() {
    const out = [];
    const converted = new Set(state.content.map((c) => c.sourceType + ':' + c.sourceId));
    state.worklogs.forEach((w) => {
      if (w.contentPotential === '高' && !converted.has('worklog:' + w.id)) {
        out.push({ kind: 'worklog', id: w.id, text: '「' + w.title + '」はまだコンテンツにしていません。noteネタへの変換を試せます' });
      }
    });
    ideas().slice(0, 3).forEach((i) => {
      if (i.status === '温め中' && i.nextValidationAction) {
        out.push({ kind: 'idea', id: i.id, text: '「' + i.title + '」の次の検証: ' + i.nextValidationAction });
      }
    });
    projects('停滞').forEach((p) => {
      out.push({ kind: 'project', id: p.id, text: '「' + p.title + '」が停滞中です。次アクションの分解を試せます' });
    });
    return out.slice(0, 5);
  }

  /** 収益ヒント: 売れそう度の高い検証中アイデア・販売中コンテンツの改善候補 */
  function revenueHints() {
    const out = [];
    ideas().forEach((i) => {
      if ((i.revenueScore || 0) >= 4 && (i.status === '温め中' || i.status === '検証中')) {
        out.push('「' + i.title + '」は売れそう度' + i.revenueScore + '。最小版の販売を検討できます');
      }
    });
    state.content.forEach((c) => {
      if (c.status === '公開済み' && !c.monetizationLink) {
        out.push('「' + c.title + '」は公開済みですが販売導線がありません');
      }
    });
    const m = monthRevenue();
    const goal = Number(state.settings.monthlyGoal) || 0;
    if (goal > 0 && m.total < goal) {
      out.push('今月の目標まで、あと' + (goal - m.total).toLocaleString('ja-JP') + '円です');
    }
    return out.slice(0, 4);
  }

  /* ---- デモデータ(初回のみ。すべて架空の汎用サンプル。実在の業務・人物・数字は含めない) ---- */
  function seed() {
    const now = Date.now();
    const DAY = 24 * 60 * 60 * 1000;
    const d = (n) => new Date(now - n * DAY);
    const ds = (n) => d(n).toLocaleDateString('sv-SE');
    const iso = (n) => d(n).toISOString();

    state = empty();
    state.settings = { monthlyGoal: 30000, todayFocus: '500円noteの構成を1本つくる' };

    const pBridge = { id: uid(), title: 'Bridge本体', description: 'BRIDGEサイトとプロダクト群の開発・改善。', status: '進行中', priority: '高', goal: 'Growth OSを毎日開く道具として定着させる', nextAction: 'Worklogを1週間つけて運用を確かめる', revenuePotential: '中', tags: ['プロダクト'], createdAt: iso(30), updatedAt: iso(1) };
    const pNote = { id: uid(), title: 'note販売', description: '仕事の学びを有料noteにして販売する実験。', status: '進行中', priority: '高', goal: '月1本の有料noteを出す', nextAction: '500円note量産テンプレートの構成を書く', revenuePotential: '高', tags: ['副業', 'note'], createdAt: iso(21), updatedAt: iso(2) };
    const pAi = { id: uid(), title: 'AI副業', description: 'AIを使ったテンプレート・ツール販売の実験。', status: '構想', priority: '中', goal: '最初の商品を1つ出す', nextAction: '商品候補を3つに絞る', revenuePotential: '高', tags: ['AI開発', '副業'], createdAt: iso(14), updatedAt: iso(5) };
    const pKnow = { id: uid(), title: '業務ナレッジの記事化', description: '仕事で繰り返し使う手順をチェックリストと記事に変換する。', status: '進行中', priority: '中', goal: 'チェックリストを1つ商品の形にする', nextAction: '手順の項目を洗い出す', revenuePotential: '高', tags: ['医療経営'], createdAt: iso(10), updatedAt: iso(3) };
    state.projects = [pBridge, pNote, pAi, pKnow];

    const w1 = {
      id: uid(), date: ds(1), title: '院内マニュアルの目次を整理した(サンプル)',
      body: '受付・会計・電話対応の手順を目次に起こした。担当ごとにばらばらだった書式を、1つにそろえる方針を決めた。',
      category: '医療経営', projectId: pKnow.id,
      learnings: '手順書は本文より先に、目次と置き場所を決めると進む。',
      blockers: '既存の資料が複数の場所に分かれていて、集めるのに時間がかかった。',
      reusableInsight: 'マニュアル整理は「目次 → 置き場所 → 本文」の順で着手すると迷わない。',
      contentPotential: '高', revenuePotential: '中', tags: ['業務改善'],
      createdAt: iso(1), updatedAt: iso(1)
    };
    const w2 = {
      id: uid(), date: ds(2), title: 'AIで作る副業商品の候補を洗い出した(サンプル)',
      body: 'note、テンプレート、チェックリスト、小さなツールの4系統で候補を書き出した。誰のどの悩みに当てるかを先に決める必要がある。',
      category: 'AI開発', projectId: pAi.id,
      learnings: '商品の形より先に、想定する相手を1人まで絞るほうが早い。',
      blockers: '候補が多すぎて絞れていない。',
      reusableInsight: '商品案は「作りやすさ」と「売れそうか」を分けて採点すると比較できる。',
      contentPotential: '高', revenuePotential: '高', tags: ['AI', '副業'],
      createdAt: iso(2), updatedAt: iso(2)
    };
    const w3 = {
      id: uid(), date: ds(4), title: 'Growth OSの画面構成を考えた(サンプル)',
      body: '記録・プロジェクト・アイデア・コンテンツ・収益を1つの流れで扱う画面を設計した。左ナビ+右パネルの3カラム。',
      category: 'プロダクト', projectId: pBridge.id,
      learnings: '機能を足すより「毎日開く理由」を先に設計したほうがよい。',
      blockers: '',
      reusableInsight: '個人向けツールはダッシュボードに「次の1アクション」を必ず置く。',
      contentPotential: '中', revenuePotential: 'なし', tags: ['設計'],
      createdAt: iso(4), updatedAt: iso(4)
    };
    state.worklogs = [w1, w2, w3];

    const i1 = {
      id: uid(), title: '500円note量産テンプレート',
      problem: '有料noteを書きたいが、何を書けば売れるかわからない人が多い。',
      targetUser: '副業でnoteを始めたい会社員・専門職',
      solution: 'テーマ、想定読者、構成、有料部分、販売導線まで一括で作るテンプレートを販売する。',
      priceIdea: '500円〜1,980円', salesChannel: 'note',
      easeScore: 4, revenueScore: 4, motivationScore: 4,
      requiredAssets: 'テンプレート本体、サンプル記事1本',
      nextValidationAction: 'テンプレートの目次案を作り、反応を見る',
      status: '検証中', createdAt: iso(6), updatedAt: iso(2)
    };
    const i2 = {
      id: uid(), title: '新人スタッフ教育チェックリスト',
      problem: '新人に教える内容が人によってばらばらで、抜け漏れが出る。',
      targetUser: '小さな事業所で新人教育を任された管理者',
      solution: '初週・初月にやることをチェックリストにして、記入例つきで配る。',
      priceIdea: '980円〜2,980円', salesChannel: 'note',
      easeScore: 3, revenueScore: 4, motivationScore: 3,
      requiredAssets: '項目の洗い出し、記入例',
      nextValidationAction: 'チェックリストの項目を20個書き出す',
      status: '温め中', createdAt: iso(8), updatedAt: iso(3)
    };
    state.ideas = [i1, i2];

    state.content = [
      {
        id: uid(), title: '手順書づくりで最初にやる3つのこと', type: 'note', status: '構成中',
        sourceType: 'worklog', sourceId: w1.id,
        targetAudience: '小さな事業所の管理者',
        mainMessage: '手順書は、目次と置き場所から決めると迷わない。',
        draft: '', publishUrl: '', monetizationLink: '',
        createdAt: iso(1), updatedAt: iso(1)
      },
      {
        id: uid(), title: '商品づくりの前に決めること', type: 'X投稿', status: 'ネタ',
        sourceType: 'worklog', sourceId: w2.id,
        targetAudience: 'AI副業に興味がある会社員・専門職',
        mainMessage: '作りやすさと売れそうかは、分けて採点する。',
        draft: '', publishUrl: '', monetizationLink: '',
        createdAt: iso(2), updatedAt: iso(2)
      }
    ];

    state.revenue = [
      { id: uid(), date: ds(3), source: 'note', productName: 'サンプル: 有料note', amount: 500, memo: 'デモ用の記録です', createdAt: iso(3) },
      { id: uid(), date: ds(9), source: 'BOOTH', productName: 'サンプル: テンプレート', amount: 1000, memo: 'デモ用の記録です', createdAt: iso(9) }
    ];

    state.tasks = [
      { id: uid(), title: '500円noteテンプレートの目次案を書く', description: '', status: '未着手', priority: '高', dueDate: ds(-2), projectId: pNote.id, sourceType: 'idea', sourceId: i1.id, createdAt: iso(2), updatedAt: iso(2) },
      { id: uid(), title: '教育チェックリストの項目を20個書き出す', description: '', status: '未着手', priority: '中', dueDate: '', projectId: pKnow.id, sourceType: 'idea', sourceId: i2.id, createdAt: iso(3), updatedAt: iso(3) },
      { id: uid(), title: 'Worklogを今日から1週間つける', description: '', status: '進行中', priority: '高', dueDate: '', projectId: pBridge.id, sourceType: '', sourceId: '', createdAt: iso(4), updatedAt: iso(1) }
    ];

    save();
  }

  /* ---- エクスポート / インポート ---- */
  function exportJson() {
    return JSON.stringify(state, null, 2);
  }
  function importJson(text) {
    const parsed = JSON.parse(text); // 失敗は呼び出し側でcatchする
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.worklogs)) {
      throw new Error('Growth OSのエクスポート形式ではありません');
    }
    state = Object.assign(empty(), parsed);
    save(); emit();
  }

  /* ---- 購読 ---- */
  function subscribe(fn) {
    listeners.push(fn);
    return () => { listeners = listeners.filter((l) => l !== fn); };
  }
  function emit() {
    listeners.forEach((fn) => { try { fn(); } catch (e) {} });
  }

  /* ---- 初期化 ---- */
  function init() {
    if (!load()) seed();
  }
  function resetAll() {
    seed(); emit();
  }

  /* ---- 公開API ---- */
  global.GrowthStore = {
    CATEGORIES, POTENTIALS, PROJECT_STATUSES, PRIORITIES, IDEA_STATUSES,
    SALES_CHANNELS, CONTENT_TYPES, CONTENT_STATUSES, TASK_STATUSES, SOURCE_KINDS,
    init, subscribe, resetAll,
    add, update, remove, get, all,
    worklogs, projects, ideas, contentItems, revenueRecords, tasks,
    aiLogs, addAiLog,
    settings, setSettings,
    weeklyOutput, monthRevenue, nextActions, suggestions, revenueHints,
    exportJson, importJson,
    todayStr
  };
})(window);
