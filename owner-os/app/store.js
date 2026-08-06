/* =========================================================================
 * OWNER OS — store.js
 * データモデル・ローカル永続化・派生集計(停滞検知・朝の区分・週次レビュー)。
 * UI(app.js)はこの層だけを通じてデータを読み書きする。
 *
 * 型(参考・JSDocで表現):
 *   User       : { id, name, role, createdAt, updatedAt }
 *   Project    : { id, name, description, status('active'|'done'), dueDate?, createdAt, updatedAt }
 *   Person     : { id, name, role, organization?, email?, notes?, createdAt }
 *   Task       : { id, title, description, projectId, classification, priority,
 *                  status('active'|'hold'|'done'), finalOwnerId, executorId,
 *                  ballHolderId, nextActorId, ball, dueDate?, nextCheckDate?,
 *                  completionCriteria?, holdReason?, waitingSince?, lastActivityAt,
 *                  tags[], createdAt, updatedAt, completedAt? }
 *   Activity   : { id, taskId, type, content, createdAt }
 *   Reflection : { id, rawInput, fact, interpretation, emotion, actualIssue,
 *                  nextAction, prevention, createdAt }
 *
 * 注:
 * - 日付は "YYYY-MM-DD" のローカル日付文字列で持つ。日時は ISO 文字列。
 * - ball は「いまボールを誰が持つ状態か」。ballHolderId は具体的な人。
 *   ball が 'me' のとき ballHolderId は 'me'(利用者自身を表す固定ID)。
 * - executorId / ballHolderId 等が 'me' の場合は利用者本人を指す。
 * ========================================================================= */
(function (global) {
  'use strict';

  var STORAGE_KEY = 'owner-os:v1';
  var ME = 'me'; // 利用者本人を表す固定ID

  /* ---- 分類(4分類+未分類) ---- */
  var CLASSIFICATIONS = {
    decide:   { label: '自分で決める', short: '決める', hint: '責任者として自分が判断する' },
    ask:      { label: '誰かに聞く',   short: '聞く',   hint: '分かる人に確認してから進める' },
    delegate: { label: '誰かに任せる', short: '任せる', hint: '実行に適した人へ渡す' },
    hold:     { label: '今はやらない', short: '保留',   hint: '意図的に保留し、再確認日を決める' },
    none:     { label: '未分類',       short: '未分類', hint: 'まだ扱いを決めていない' }
  };

  /* ---- 分類を促す補助質問 ---- */
  var CLASSIFY_QUESTIONS = {
    decide: [
      'この判断は、あなたにしかできませんか',
      'あなたが責任者として決めるべき内容ですか',
      '他者に確認せず決められますか'
    ],
    ask: [
      '誰が最も早く正確に答えられますか',
      '何が分かれば次へ進めますか',
      '質問内容を一文で表せますか'
    ],
    delegate: [
      '実行に最も適した人は誰ですか',
      '完了条件は明確ですか',
      'いつまでに必要ですか'
    ],
    hold: [
      'なぜ今やらないのですか',
      '再確認する日はいつですか',
      '放置ではなく、意図的な保留になっていますか'
    ]
  };

  /* ---- ボール状態 ---- */
  var BALLS = {
    me:               { label: '自分',     kind: 'me' },
    owner:            { label: '担当者',   kind: 'other' },
    waiting_answer:   { label: '回答待ち', kind: 'wait' },
    waiting_approval: { label: '承認待ち', kind: 'wait' },
    waiting_external: { label: '外部待ち', kind: 'wait' },
    hold:             { label: '保留',     kind: 'hold' },
    done:             { label: '完了',     kind: 'done' }
  };

  var PRIORITIES = {
    high: { label: '高', rank: 0 },
    mid:  { label: '中', rank: 1 },
    low:  { label: '低', rank: 2 }
  };

  /* 停滞判定のしきい値(日) */
  var WAIT_LONG_DAYS = 4;   // 回答待ちが長い
  var INACTIVE_DAYS = 3;    // 動いていない

  // ---- 内部状態 ------------------------------------------------------------
  var state = {
    user: null,
    projects: [],
    people: [],
    tasks: [],
    activities: [],
    reflections: [],
    settings: { aiProvider: 'mock' }
  };
  var listeners = [];

  // ---- ユーティリティ ------------------------------------------------------
  function uid(prefix) {
    return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  function dateStr(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function todayStr() { return dateStr(new Date()); }

  function daysFromToday(n) {
    var d = new Date();
    d.setDate(d.getDate() + n);
    return dateStr(d);
  }

  /** "YYYY-MM-DD" → "M/D(曜)" */
  function dueLabel(due) {
    if (!due) return '未設定';
    var p = due.split('-');
    var d = new Date(+p[0], +p[1] - 1, +p[2]);
    var youbi = ['日', '月', '火', '水', '木', '金', '土'][d.getDay()];
    return (+p[1]) + '/' + (+p[2]) + '(' + youbi + ')';
  }

  /** ISO日時 → 経過日数(ローカル日付基準) */
  function daysSince(iso) {
    if (!iso) return 0;
    var d = new Date(iso);
    var a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var now = new Date();
    var b = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((b - a) / 86400000);
  }

  /** "YYYY-MM-DD" 同士の差(a - b、日) */
  function diffDays(a, b) {
    var pa = a.split('-'), pb = b.split('-');
    var da = new Date(+pa[0], +pa[1] - 1, +pa[2]);
    var db = new Date(+pb[0], +pb[1] - 1, +pb[2]);
    return Math.round((da - db) / 86400000);
  }

  // ---- 永続化 --------------------------------------------------------------
  function load() {
    try {
      var raw = global.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        var parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.tasks)) {
          state.user = parsed.user || null;
          state.projects = parsed.projects || [];
          state.people = parsed.people || [];
          state.tasks = parsed.tasks || [];
          state.activities = parsed.activities || [];
          state.reflections = parsed.reflections || [];
          state.settings = parsed.settings || { aiProvider: 'mock' };
          return true;
        }
      }
    } catch (e) { /* 壊れていたら初期化にフォールバック */ }
    return false;
  }

  function save() {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (e) { /* 保存失敗時も動作は継続する */ }
    listeners.forEach(function (fn) { fn(); });
  }

  function subscribe(fn) { listeners.push(fn); }

  // ---- 参照 ---------------------------------------------------------------
  function personName(id) {
    if (!id) return null;
    if (id === ME) return state.user ? state.user.name : '自分';
    var p = state.people.find(function (x) { return x.id === id; });
    return p ? p.name : null;
  }

  function person(id) {
    if (id === ME) return state.user ? { id: ME, name: state.user.name, role: state.user.role || '' } : null;
    return state.people.find(function (x) { return x.id === id; }) || null;
  }

  function project(id) {
    return state.projects.find(function (x) { return x.id === id; }) || null;
  }

  function task(id) {
    return state.tasks.find(function (x) { return x.id === id; }) || null;
  }

  function taskActivities(taskId) {
    return state.activities
      .filter(function (a) { return a.taskId === taskId; })
      .sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
  }

  // ---- 変更 ---------------------------------------------------------------
  function logActivity(taskId, type, content) {
    state.activities.push({
      id: uid('act'), taskId: taskId, type: type, content: content,
      createdAt: new Date().toISOString()
    });
  }

  function touch(t) {
    t.updatedAt = new Date().toISOString();
    t.lastActivityAt = t.updatedAt;
  }

  function addTask(fields) {
    var now = new Date().toISOString();
    var t = {
      id: uid('task'),
      title: fields.title || '',
      description: fields.description || '',
      projectId: fields.projectId || null,
      classification: fields.classification || 'none',
      priority: fields.priority || 'mid',
      status: 'active',
      finalOwnerId: ME,
      executorId: fields.executorId || null,
      ballHolderId: ME,
      nextActorId: ME,
      ball: 'me',
      dueDate: fields.dueDate || null,
      nextCheckDate: fields.nextCheckDate || null,
      completionCriteria: fields.completionCriteria || '',
      holdReason: '',
      waitingSince: null,
      tags: fields.tags || [],
      lastActivityAt: now,
      createdAt: now,
      updatedAt: now,
      completedAt: null
    };
    state.tasks.push(t);
    logActivity(t.id, 'create', 'タスクを登録');
    save();
    return t;
  }

  function updateTask(id, fields, activityNote) {
    var t = task(id);
    if (!t) return null;
    Object.keys(fields).forEach(function (k) { t[k] = fields[k]; });
    touch(t);
    if (activityNote) logActivity(id, 'update', activityNote);
    save();
    return t;
  }

  /** 分類の確定。分類に応じてボール・状態も整える */
  function classifyTask(id, classification) {
    var t = task(id);
    if (!t) return null;
    t.classification = classification;
    if (classification === 'hold') {
      t.status = 'hold';
      t.ball = 'hold';
      t.ballHolderId = ME;
      t.nextActorId = ME;
    } else if (t.status === 'hold') {
      t.status = 'active';
      if (t.ball === 'hold') { t.ball = 'me'; t.ballHolderId = ME; }
    }
    touch(t);
    logActivity(id, 'classify', '「' + CLASSIFICATIONS[classification].label + '」に分類');
    save();
    return t;
  }

  /** ボールを渡す。waitingSince の管理もここで行う */
  function passBall(id, ball, holderId, note) {
    var t = task(id);
    if (!t) return null;
    var prev = t.ball;
    t.ball = ball;
    t.ballHolderId = ball === 'me' ? ME : (holderId || t.executorId || null);
    if (BALLS[ball] && BALLS[ball].kind === 'wait') {
      if (!(BALLS[prev] && BALLS[prev].kind === 'wait')) t.waitingSince = new Date().toISOString();
      t.nextActorId = t.ballHolderId;
    } else {
      t.waitingSince = null;
      t.nextActorId = ball === 'me' ? ME : t.ballHolderId;
    }
    if (ball === 'done') {
      t.status = 'done';
      t.completedAt = new Date().toISOString();
      t.nextActorId = null;
    } else if (ball === 'hold') {
      t.status = 'hold';
    } else if (t.status !== 'active') {
      t.status = 'active';
      t.completedAt = null;
    }
    touch(t);
    logActivity(id, 'ball', 'ボール: ' + (BALLS[prev] ? BALLS[prev].label : prev) + ' → ' + BALLS[ball].label +
      (t.ballHolderId && t.ballHolderId !== ME && personName(t.ballHolderId) ? '(' + personName(t.ballHolderId) + ')' : ''));
    save();
    return t;
  }

  function completeTask(id) { return passBall(id, 'done', null); }

  function deleteTask(id) {
    state.tasks = state.tasks.filter(function (t) { return t.id !== id; });
    state.activities = state.activities.filter(function (a) { return a.taskId !== id; });
    save();
  }

  function addProject(fields) {
    var now = new Date().toISOString();
    var p = {
      id: uid('prj'), name: fields.name, description: fields.description || '',
      status: 'active', dueDate: fields.dueDate || null, createdAt: now, updatedAt: now
    };
    state.projects.push(p);
    save();
    return p;
  }

  function addPerson(fields) {
    var p = {
      id: uid('psn'), name: fields.name, role: fields.role || '',
      organization: fields.organization || '', email: fields.email || '',
      notes: fields.notes || '', createdAt: new Date().toISOString()
    };
    state.people.push(p);
    save();
    return p;
  }

  function addReflection(r) {
    var rec = {
      id: uid('ref'), rawInput: r.rawInput || '',
      fact: r.fact || '', interpretation: r.interpretation || '', emotion: r.emotion || '',
      actualIssue: r.actualIssue || '', nextAction: r.nextAction || '', prevention: r.prevention || '',
      createdAt: new Date().toISOString()
    };
    state.reflections.push(rec);
    save();
    return rec;
  }

  function setUser(name, role) {
    var now = new Date().toISOString();
    if (state.user) {
      state.user.name = name;
      state.user.role = role || state.user.role || '';
      state.user.updatedAt = now;
    } else {
      state.user = { id: uid('usr'), name: name, role: role || '', createdAt: now, updatedAt: now };
    }
    save();
  }

  function setSettings(fields) {
    Object.keys(fields).forEach(function (k) { state.settings[k] = fields[k]; });
    save();
  }

  function resetAll() {
    try { global.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* noop */ }
    state.user = null;
    state.projects = [];
    state.people = [];
    state.tasks = [];
    state.activities = [];
    state.reflections = [];
    state.settings = { aiProvider: 'mock' };
    listeners.forEach(function (fn) { fn(); });
  }

  // ---- 判定(1タスク単位) ---------------------------------------------------
  function isOpen(t) { return t.status !== 'done'; }
  function isActive(t) { return t.status === 'active'; }
  function isWaiting(t) { return isOpen(t) && BALLS[t.ball] && BALLS[t.ball].kind === 'wait'; }
  function isOverdue(t) { return isActive(t) && !!t.dueDate && t.dueDate < todayStr(); }
  function isDueToday(t) { return isActive(t) && t.dueDate === todayStr(); }
  function isWaitingLong(t) { return isWaiting(t) && daysSince(t.waitingSince || t.lastActivityAt) >= WAIT_LONG_DAYS; }
  function isInactive(t) { return isActive(t) && daysSince(t.lastActivityAt) >= INACTIVE_DAYS; }
  function noExecutor(t) {
    return isActive(t) && !t.executorId &&
      (t.classification === 'ask' || t.classification === 'delegate' || t.classification === 'none');
  }
  function noNextCheck(t) { return isOpen(t) && !t.nextCheckDate; }
  function noCriteria(t) { return isActive(t) && !t.completionCriteria; }
  function checkDue(t) { return isOpen(t) && !!t.nextCheckDate && t.nextCheckDate <= todayStr(); }
  /** 催促対象: 待ち状態で、次回確認日が来ている(または未設定で待ちが長い) */
  function needsReminder(t) {
    if (!isWaiting(t)) return false;
    if (t.nextCheckDate) return t.nextCheckDate <= todayStr();
    return isWaitingLong(t);
  }

  // ---- 朝のダッシュボード ----------------------------------------------------
  /**
   * 今日の4区分。
   *  decide : 今日、あなたが決めること(自分ボール×「自分で決める」+未分類の判断待ち)
   *  hand   : 今日、誰かに振ること(聞く/任せるなのに自分がボールを持っている、担当未設定含む)
   *  remind : 今日、催促すること(待ち×確認日到来)
   *  blocked: 放置すると止まること(期限超過・待ちが長い・保留の再確認日到来)
   */
  function morning() {
    var open = state.tasks.filter(isOpen);
    var decide = open.filter(function (t) {
      if (t.status !== 'active' || t.ball !== 'me') return false;
      return t.classification === 'decide' || t.classification === 'none';
    });
    var hand = open.filter(function (t) {
      if (t.status !== 'active') return false;
      var wantsOthers = t.classification === 'ask' || t.classification === 'delegate';
      return wantsOthers && (t.ball === 'me' || !t.executorId);
    });
    var remind = open.filter(needsReminder);
    var blocked = open.filter(function (t) {
      if (isOverdue(t) || isWaitingLong(t)) return true;
      if (t.status === 'hold' && t.nextCheckDate && t.nextCheckDate <= todayStr()) return true;
      return isInactive(t) && t.priority === 'high';
    });
    // 重複除去はしない(同じタスクが「決める」と「止まる」に出るのは意図どおり)
    return { decide: sortTasks(decide), hand: sortTasks(hand), remind: sortTasks(remind), blocked: sortTasks(blocked) };
  }

  /** 注意シグナル(件数つき) */
  function alerts() {
    var open = state.tasks.filter(isOpen);
    return {
      overdue:     open.filter(isOverdue),
      waitingLong: open.filter(isWaitingLong),
      noExecutor:  open.filter(noExecutor),
      checkDue:    open.filter(checkDue),
      noNextCheck: open.filter(noNextCheck),
      noCriteria:  open.filter(noCriteria),
      inactive:    open.filter(isInactive)
    };
  }

  /** プロジェクトの停滞警告 */
  function projectWarnings(projectId) {
    var ts = state.tasks.filter(function (t) { return t.projectId === projectId && isOpen(t); });
    var warns = [];
    var n;
    n = ts.filter(noExecutor).length;
    if (n) warns.push({ key: 'noExecutor', label: '担当者が決まっていないタスクが' + n + '件', count: n });
    n = ts.filter(function (t) { return isActive(t) && !t.dueDate; }).length;
    if (n) warns.push({ key: 'noDue', label: '期限がないタスクが' + n + '件', count: n });
    n = ts.filter(noCriteria).length;
    if (n) warns.push({ key: 'noCriteria', label: '完了条件が決まっていないタスクが' + n + '件', count: n });
    n = ts.filter(isWaitingLong).length;
    if (n) warns.push({ key: 'waitingLong', label: '回答待ちのまま' + WAIT_LONG_DAYS + '日以上のタスクが' + n + '件', count: n });
    n = ts.filter(noNextCheck).length;
    if (n) warns.push({ key: 'noNextCheck', label: '次回確認日がないタスクが' + n + '件', count: n });
    n = ts.filter(function (t) { return t.status === 'hold' && t.priority === 'high'; }).length;
    if (n) warns.push({ key: 'holdHigh', label: '優先度の高いタスクが保留のまま(' + n + '件)', count: n });
    n = ts.filter(function (t) { return t.ball === 'me'; }).length;
    if (n >= 3) warns.push({ key: 'meHeavy', label: '自分がボールを持っているタスクが' + n + '件', count: n });
    // 同じ人への集中
    var byPerson = {};
    ts.forEach(function (t) {
      if (t.ballHolderId && t.ballHolderId !== ME) {
        byPerson[t.ballHolderId] = (byPerson[t.ballHolderId] || 0) + 1;
      }
    });
    Object.keys(byPerson).forEach(function (pid) {
      if (byPerson[pid] >= 3) {
        warns.push({ key: 'concentrate:' + pid, label: personName(pid) + 'さんにタスクが' + byPerson[pid] + '件集中', count: byPerson[pid] });
      }
    });
    return warns;
  }

  /** ボール別のタスク集計(ボード表示用) */
  function ballBoard(projectId) {
    var ts = state.tasks.filter(function (t) {
      return isOpen(t) && (!projectId || t.projectId === projectId);
    });
    var groups = { me: [], owner: [], wait: [], hold: [] };
    ts.forEach(function (t) {
      var kind = BALLS[t.ball] ? BALLS[t.ball].kind : 'me';
      if (kind === 'wait') groups.wait.push(t);
      else if (kind === 'hold') groups.hold.push(t);
      else if (kind === 'other') groups.owner.push(t);
      else groups.me.push(t);
    });
    Object.keys(groups).forEach(function (k) { groups[k] = sortTasks(groups[k]); });
    return groups;
  }

  /** 週次レビュー(直近7日) */
  function weeklyReview() {
    var since = new Date();
    since.setDate(since.getDate() - 7);
    var sinceIso = since.toISOString();
    var acts = state.activities.filter(function (a) { return a.createdAt >= sinceIso; });
    var open = state.tasks.filter(isOpen);

    var decided = acts.filter(function (a) {
      return a.type === 'classify' || (a.type === 'update' && a.content && a.content.indexOf('決定') >= 0);
    }).length;
    var completed = state.tasks.filter(function (t) { return t.completedAt && t.completedAt >= sinceIso; });
    var delegated = acts.filter(function (a) { return a.type === 'ball' && /→ (担当者|回答待ち|承認待ち|外部待ち)/.test(a.content); }).length;
    var reminded = acts.filter(function (a) { return a.type === 'remind'; }).length;
    var myBall = open.filter(function (t) { return t.ball === 'me'; });
    var stuck = open.filter(function (t) { return isWaitingLong(t) || isInactive(t) || isOverdue(t); });

    // 自分にボールが集中している領域(プロジェクト別)
    var myByProject = {};
    myBall.forEach(function (t) {
      var key = t.projectId || 'none';
      myByProject[key] = (myByProject[key] || 0) + 1;
    });

    // 改善提案(ルールベース。行動傾向の振り返り材料)
    var tips = [];
    if (myBall.length > delegated) {
      tips.push('自分がボールを持つタスク(' + myBall.length + '件)が委任(' + delegated + '件)を上回っています。「誰かに任せる」候補がないか、自分ボールの一覧を見直してみてください。');
    }
    var noCheckCount = open.filter(noNextCheck).length;
    if (noCheckCount) {
      tips.push('次回確認日がないタスクが' + noCheckCount + '件あります。ボールを渡すときに確認日をセットにすると、催促忘れがなくなります。');
    }
    var remindDue = open.filter(needsReminder).length;
    if (remindDue) {
      tips.push('催促のタイミングが来ているタスクが' + remindDue + '件あります。「いつ頃になりそうですか」の一行から始められます。');
    }
    if (!tips.length) {
      tips.push('大きな停滞はありません。この調子で、ボールを渡す・確認日を決める、を続けてください。');
    }

    return {
      decided: decided,
      completed: completed,
      delegated: delegated,
      reminded: reminded,
      myBall: sortTasks(myBall),
      stuck: sortTasks(stuck),
      myByProject: myByProject,
      tips: tips
    };
  }

  /** 並び順: 期限超過 → 期限近い → 優先度 */
  function sortTasks(list) {
    var today = todayStr();
    return list.slice().sort(function (a, b) {
      var ao = a.dueDate && a.dueDate < today ? 0 : 1;
      var bo = b.dueDate && b.dueDate < today ? 0 : 1;
      if (ao !== bo) return ao - bo;
      var ad = a.dueDate || '9999-99-99';
      var bd = b.dueDate || '9999-99-99';
      if (ad !== bd) return ad < bd ? -1 : 1;
      return (PRIORITIES[a.priority] || PRIORITIES.mid).rank - (PRIORITIES[b.priority] || PRIORITIES.mid).rank;
    });
  }

  // ---- ダミーデータ ----------------------------------------------------------
  /**
   * 初回起動時の投入データ。「医療法人統合プロジェクト」。
   * 日付は今日を基準に相対で作るため、いつ起動しても
   * 期限超過・確認日到来・長期停滞などの状態が確認できる。
   */
  function seed(userName, userRole) {
    var now = new Date().toISOString();
    function iso(daysAgo) {
      var d = new Date();
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString();
    }
    state.user = { id: uid('usr'), name: userName || '自分', role: userRole || 'プロジェクト責任者', createdAt: now, updatedAt: now };

    var prj = {
      id: 'prj_pmi', name: '医療法人統合プロジェクト',
      description: '2法人の統合に伴う、行政手続き・契約・患者情報・人員配置・システム移行の整理。',
      status: 'active', dueDate: daysFromToday(45), createdAt: iso(20), updatedAt: now
    };
    state.projects = [prj];

    var people = [
      { id: 'p_iji',    name: '佐藤',  role: '医事担当' },
      { id: 'p_gyosei', name: '鈴木',  role: '行政手続き担当' },
      { id: 'p_houmu',  name: '山田',  role: '法務担当' },
      { id: 'p_kango',  name: '高橋',  role: '看護責任者' },
      { id: 'p_sys',    name: '田中',  role: 'システム担当' },
      { id: 'p_consul', name: '伊藤',  role: '外部コンサルタント', organization: '外部' },
      { id: 'p_keiei',  name: '渡辺',  role: '経営責任者' },
      { id: 'p_jimu',   name: '中村',  role: '事務長' }
    ];
    state.people = people.map(function (p) {
      return {
        id: p.id, name: p.name, role: p.role, organization: p.organization || '',
        email: '', notes: '', createdAt: now
      };
    });

    function t(o) {
      var base = {
        id: uid('task'), description: '', projectId: prj.id, classification: 'none',
        priority: 'mid', status: 'active', finalOwnerId: ME, executorId: null,
        ballHolderId: ME, nextActorId: ME, ball: 'me', dueDate: null, nextCheckDate: null,
        completionCriteria: '', holdReason: '', waitingSince: null, tags: [],
        lastActivityAt: now, createdAt: iso(10), updatedAt: now, completedAt: null
      };
      Object.keys(o).forEach(function (k) { base[k] = o[k]; });
      return base;
    }

    state.tasks = [
      // 自分ボール・今日期限(決めること)
      t({ id: 'tk_todokede', title: '行政届出一覧の確認', classification: 'decide', priority: 'high',
          description: '統合に伴い必要な届出の全体像を確定させる。保健所・厚生局・自治体それぞれの窓口を整理。',
          dueDate: todayStr(), nextCheckDate: todayStr(),
          completionCriteria: '届出の一覧に、提出先・期限・担当者が入っている状態' }),
      // 委任済み・期限超過(催促・停滞)
      t({ id: 'tk_keiyaku', title: '契約書巻き直しの実施体制決定', classification: 'delegate', priority: 'high',
          description: '賃貸借・リース・保守などの契約先一覧を作り、巻き直しの進め方を決める。',
          executorId: 'p_houmu', ballHolderId: 'p_houmu', nextActorId: 'p_houmu', ball: 'owner',
          dueDate: daysFromToday(-2), nextCheckDate: todayStr(),
          completionCriteria: '契約先一覧と巻き直し方針が承認されている状態',
          lastActivityAt: iso(2) }),
      // 回答待ち・確認日到来
      t({ id: 'tk_kanja', title: '患者情報移行範囲の確認', classification: 'ask', priority: 'mid',
          description: '統合先へ移行する患者情報の範囲と同意の取り方を医事に確認。',
          executorId: 'p_iji', ballHolderId: 'p_iji', nextActorId: 'p_iji', ball: 'waiting_answer',
          dueDate: daysFromToday(3), nextCheckDate: todayStr(),
          completionCriteria: '移行範囲と同意手順が文書で決まっている状態',
          waitingSince: iso(3), lastActivityAt: iso(3) }),
      // 回答待ちが長い+期限超過(最重要の停滞)
      t({ id: 'tk_mayaku', title: '麻薬関連手続きの確認', classification: 'ask', priority: 'high',
          description: '統合後の麻薬関係について確認が必要。免許・届出・譲渡または廃棄の扱い。',
          executorId: 'p_gyosei', ballHolderId: 'p_gyosei', nextActorId: 'p_gyosei', ball: 'waiting_answer',
          dueDate: daysFromToday(-1), nextCheckDate: daysFromToday(-1),
          completionCriteria: '必要な手続き・届出・書類・期限が明確になっていること',
          waitingSince: iso(5), lastActivityAt: iso(5) }),
      // 自分ボール・説明準備(決める)
      t({ id: 'tk_ishi', title: '医師への統合説明', classification: 'decide', priority: 'high',
          description: '統合の経緯・診療体制の変更点・雇用条件を医師向けに説明する内容を確定する。',
          dueDate: daysFromToday(5), nextCheckDate: daysFromToday(2),
          completionCriteria: '説明資料が経営責任者の承認を得ている状態',
          lastActivityAt: iso(1) }),
      // 任せるべきなのに担当者未設定(振ること)
      t({ id: 'tk_kango', title: '看護師配置の調整', classification: 'delegate', priority: 'mid',
          description: '統合後の外来・訪問の看護師配置案を作る。まず現状の勤務表を集める。',
          dueDate: daysFromToday(4),
          lastActivityAt: iso(1) }),
      // 未分類・完了条件なし(登録しただけのタスク)
      t({ id: 'tk_kiki', title: '医療機器移設手続きの確認', priority: 'mid',
          description: 'エックス線装置などの移設に伴う届出を確認する。',
          lastActivityAt: iso(4), createdAt: iso(4) }),
      // 承認待ち(外部待ちの例)
      t({ id: 'tk_receipt', title: 'レセプト運用の確認', classification: 'ask', priority: 'mid',
          description: '統合月のレセプト請求をどちらの機関コードで行うか、支払基金に確認。',
          executorId: 'p_iji', ballHolderId: 'p_iji', nextActorId: 'p_iji', ball: 'waiting_external',
          dueDate: daysFromToday(7), nextCheckDate: daysFromToday(2),
          completionCriteria: '統合月の請求方法が文書で確認できている状態',
          waitingSince: iso(2), lastActivityAt: iso(2) }),
      // 保留(意図的な保留・再確認日つき)
      t({ id: 'tk_route', title: '統合後の診療ルート調整', classification: 'hold', priority: 'low',
          status: 'hold', ball: 'hold',
          description: '外来と訪問の患者導線の見直し。統合後の体制が固まってから着手する。',
          nextCheckDate: daysFromToday(10),
          holdReason: '統合後の人員体制が確定してから判断する',
          lastActivityAt: iso(6), createdAt: iso(12) }),
      // 完了済み(週次レビュー用)
      t({ id: 'tk_kickoff', title: '統合キックオフの開催', classification: 'decide', priority: 'mid',
          status: 'done', ball: 'done', nextActorId: null,
          description: '両法人の主要メンバーで統合スケジュールの共有会を実施。',
          dueDate: daysFromToday(-3),
          completionCriteria: '主要メンバー全員がスケジュールを把握している状態',
          completedAt: iso(2), lastActivityAt: iso(2), createdAt: iso(15) })
    ];

    // 活動ログ(週次レビューが空にならない程度)
    state.activities = [
      { id: uid('act'), taskId: 'tk_kickoff', type: 'ball', content: 'ボール: 自分 → 完了', createdAt: iso(2) },
      { id: uid('act'), taskId: 'tk_keiyaku', type: 'ball', content: 'ボール: 自分 → 担当者(山田)', createdAt: iso(4) },
      { id: uid('act'), taskId: 'tk_mayaku', type: 'ball', content: 'ボール: 自分 → 回答待ち(鈴木)', createdAt: iso(5) },
      { id: uid('act'), taskId: 'tk_kanja', type: 'ball', content: 'ボール: 自分 → 回答待ち(佐藤)', createdAt: iso(3) },
      { id: uid('act'), taskId: 'tk_receipt', type: 'ball', content: 'ボール: 自分 → 外部待ち(佐藤)', createdAt: iso(2) },
      { id: uid('act'), taskId: 'tk_todokede', type: 'classify', content: '「自分で決める」に分類', createdAt: iso(6) },
      { id: uid('act'), taskId: 'tk_ishi', type: 'classify', content: '「自分で決める」に分類', createdAt: iso(5) },
      { id: uid('act'), taskId: 'tk_route', type: 'classify', content: '「今はやらない」に分類', createdAt: iso(6) }
    ];
    state.reflections = [];
    state.settings = { aiProvider: 'mock' };
    save();
  }

  // ---- 公開API ---------------------------------------------------------------
  global.Store = {
    ME: ME,
    CLASSIFICATIONS: CLASSIFICATIONS,
    CLASSIFY_QUESTIONS: CLASSIFY_QUESTIONS,
    BALLS: BALLS,
    PRIORITIES: PRIORITIES,
    WAIT_LONG_DAYS: WAIT_LONG_DAYS,
    INACTIVE_DAYS: INACTIVE_DAYS,

    load: load,
    save: save,
    subscribe: subscribe,
    seed: seed,
    resetAll: resetAll,

    state: function () { return state; },
    user: function () { return state.user; },
    setUser: setUser,
    settings: function () { return state.settings; },
    setSettings: setSettings,

    projects: function () { return state.projects.slice(); },
    project: project,
    addProject: addProject,
    people: function () { return state.people.slice(); },
    person: person,
    personName: personName,
    addPerson: addPerson,

    tasks: function () { return state.tasks.slice(); },
    task: task,
    addTask: addTask,
    updateTask: updateTask,
    classifyTask: classifyTask,
    passBall: passBall,
    completeTask: completeTask,
    deleteTask: deleteTask,
    taskActivities: taskActivities,
    logActivity: function (taskId, type, content) { logActivity(taskId, type, content); save(); },

    reflections: function () { return state.reflections.slice(); },
    addReflection: addReflection,

    // 判定・集計
    isOpen: isOpen,
    isWaiting: isWaiting,
    isOverdue: isOverdue,
    isDueToday: isDueToday,
    isWaitingLong: isWaitingLong,
    isInactive: isInactive,
    noExecutor: noExecutor,
    needsReminder: needsReminder,
    checkDue: checkDue,
    morning: morning,
    alerts: alerts,
    projectWarnings: projectWarnings,
    ballBoard: ballBoard,
    weeklyReview: weeklyReview,
    sortTasks: sortTasks,

    // 日付ユーティリティ
    todayStr: todayStr,
    daysFromToday: daysFromToday,
    dueLabel: dueLabel,
    daysSince: daysSince,
    diffDays: diffDays
  };
})(typeof window !== 'undefined' ? window : globalThis);
