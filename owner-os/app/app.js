/* =========================================================================
 * OWNER OS — app.js
 * 画面描画とイベント処理。データは store.js(Store)、文章の下書きは ai.js(AI)。
 * 画面: login / dashboard / tasks / taskNew / taskDetail / projects /
 *       projectDetail / people / reflection / review / settings / menu
 * ========================================================================= */
(function () {
  'use strict';

  var app = document.getElementById('app');
  var toastEl = document.getElementById('toast');
  var toastTimer = null;

  /** 画面状態(データは持たない。データは Store が正) */
  var view = {
    name: 'dashboard',
    taskId: null,
    projectId: null,
    filter: { scope: 'open', projectId: '' },
    wizard: null,        // タスク作成の途中状態
    compose: null,       // 依頼文・催促文の生成状態 { kind, tone, text }
    reflectDraft: null,  // リフレクションの下書き
    editingTask: false,
    addingPerson: false,
    addingProject: false
  };

  // ---- ユーティリティ ------------------------------------------------------
  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 2200);
  }

  function copyText(text, doneMsg) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(doneMsg); }, function () { legacyCopy(text, doneMsg); });
    } else {
      legacyCopy(text, doneMsg);
    }
  }

  function legacyCopy(text, doneMsg) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); toast(doneMsg); } catch (e) { toast('コピーできませんでした'); }
    document.body.removeChild(ta);
  }

  function go(name, extra) {
    view.name = name;
    view.compose = null;
    view.editingTask = false;
    if (extra) Object.keys(extra).forEach(function (k) { view[k] = extra[k]; });
    render();
    syncHash();
    window.scrollTo(0, 0);
  }

  // ---- ハッシュルーティング(画面へのURL直行を可能にする) ---------------------
  var HASH_ALIAS = { weekly: 'review', reflect: 'reflection' };
  var suppressHash = false;

  function hashFor() {
    switch (view.name) {
      case 'taskDetail':    return '#/task/' + (view.taskId || '');
      case 'taskNew':       return '#/task/new';
      case 'projectDetail': return '#/project/' + (view.projectId || '');
      case 'review':        return '#/weekly';
      default:              return '#/' + view.name;
    }
  }

  function syncHash() {
    var h = hashFor();
    if (window.location.hash !== h) {
      suppressHash = true;
      window.location.hash = h;
    }
  }

  /** '#/tasks' 等を view に反映する。不明なハッシュはダッシュボードへ */
  function applyHash(hash) {
    var parts = String(hash || '').replace(/^#\/?/, '').split('/').filter(Boolean);
    var head = HASH_ALIAS[parts[0]] || parts[0];
    if (!head) { view.name = 'dashboard'; return; }
    if (head === 'task') {
      if (parts[1] === 'new' || !parts[1]) { view.name = 'taskNew'; view.wizard = null; return; }
      if (Store.task(parts[1])) { view.name = 'taskDetail'; view.taskId = parts[1]; return; }
      view.name = 'tasks'; return;
    }
    if (head === 'project') {
      if (parts[1] && Store.project(parts[1])) { view.name = 'projectDetail'; view.projectId = parts[1]; return; }
      view.name = 'projects'; return;
    }
    var known = ['dashboard', 'tasks', 'projects', 'people', 'reflection', 'review', 'settings', 'menu'];
    view.name = known.indexOf(head) >= 0 ? head : 'dashboard';
  }

  window.addEventListener('hashchange', function () {
    if (suppressHash) { suppressHash = false; return; }
    view.compose = null;
    view.editingTask = false;
    applyHash(window.location.hash);
    render();
    window.scrollTo(0, 0);
  });

  function shortDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  // ---- 小さな部品 -----------------------------------------------------------
  function ballChip(t) {
    var b = Store.BALLS[t.ball] || Store.BALLS.me;
    var holder = t.ballHolderId && t.ballHolderId !== Store.ME ? Store.personName(t.ballHolderId) : null;
    var label = b.label + (holder ? '(' + holder + ')' : '');
    var extra = '';
    if (Store.isWaitingLong(t)) {
      extra = '<span class="chip chip-warn">' + Store.daysSince(t.waitingSince || t.lastActivityAt) + '日待ち</span>';
    }
    return '<span class="chip chip-ball ball-' + esc(b.kind) + '">' + esc(label) + '</span>' + extra;
  }

  function dueChip(t) {
    if (t.status === 'done') return '';
    if (!t.dueDate) return '<span class="chip chip-due none">期限 未設定</span>';
    if (Store.isOverdue(t)) return '<span class="chip chip-due overdue">' + esc(Store.dueLabel(t.dueDate)) + ' 超過</span>';
    if (Store.isDueToday(t)) return '<span class="chip chip-due today">今日 ' + esc(Store.dueLabel(t.dueDate)) + '</span>';
    return '<span class="chip chip-due">' + esc(Store.dueLabel(t.dueDate)) + '</span>';
  }

  function clsChip(t) {
    var c = Store.CLASSIFICATIONS[t.classification] || Store.CLASSIFICATIONS.none;
    return '<span class="chip chip-cls cls-' + esc(t.classification) + '">' + esc(c.short) + '</span>';
  }

  function prioMark(t) {
    var p = Store.PRIORITIES[t.priority] || Store.PRIORITIES.mid;
    return '<span class="prio prio-' + esc(t.priority) + '" title="優先度: ' + esc(p.label) + '"></span>';
  }

  /** タスク1行。ボールの所在を先頭に置く */
  function taskRow(t, hint) {
    var prj = Store.project(t.projectId);
    return '<button class="task-row" data-open-task="' + esc(t.id) + '">' +
      '<span class="task-row-ball">' + ballChip(t) + '</span>' +
      '<span class="task-row-main">' +
        '<span class="task-row-title">' + esc(t.title) + '</span>' +
        '<span class="task-row-sub">' +
          clsChip(t) +
          (prj ? '<span class="sub-prj">' + esc(prj.name) + '</span>' : '') +
        '</span>' +
      '</span>' +
      '<span class="task-row-side">' +
        dueChip(t) +
        (hint ? '<span class="task-row-hint">' + esc(hint) + '</span>' : '') +
      '</span>' +
    '</button>';
  }

  function emptyNote(text) {
    return '<p class="empty">' + esc(text) + '</p>';
  }

  function personOptions(selectedId) {
    var opts = '<option value="">選択してください</option>';
    opts += Store.people().map(function (p) {
      return '<option value="' + esc(p.id) + '"' + (p.id === selectedId ? ' selected' : '') + '>' +
        esc(p.name) + (p.role ? '(' + esc(p.role) + ')' : '') + '</option>';
    }).join('');
    return opts;
  }

  function projectOptions(selectedId) {
    return Store.projects().map(function (p) {
      return '<option value="' + esc(p.id) + '"' + (p.id === selectedId ? ' selected' : '') + '>' + esc(p.name) + '</option>';
    }).join('');
  }

  // ---- シェル(サイドバー+ヘッダー) -----------------------------------------
  var NAV_ITEMS = [
    { id: 'dashboard',  label: 'ダッシュボード', icon: 'M3 12l9-8 9 8M5 10v10h5v-6h4v6h5V10' },
    { id: 'tasks',      label: 'タスク',        icon: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01' },
    { id: 'projects',   label: 'プロジェクト',   icon: 'M3 7h6l2 2h10v10H3zM3 7V5h6' },
    { id: 'people',     label: '関係者',        icon: 'M16 21v-2a4 4 0 0 0-8 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.87' },
    { id: 'reflection', label: 'リフレクション', icon: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' },
    { id: 'review',     label: '週次レビュー',   icon: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z' },
    { id: 'settings',   label: '設定',          icon: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19 12a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14 3h-4l-.5 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6A7 7 0 0 0 5 12c0 .4 0 .8.1 1.2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2L10 21h4l.5-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z' }
  ];

  function icon(d) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>';
  }

  function shell(content, activeId) {
    var user = Store.user();
    var sample = Store.settings().sample;
    var side =
      '<aside class="side">' +
        '<div class="side-brand">OWNER OS' + (sample ? '<span class="chip chip-sample">サンプルデータ入り</span>' : '') + '</div>' +
        '<button class="btn btn-primary side-new" data-nav="taskNew">' + icon('M12 5v14M5 12h14') + 'タスクを登録</button>' +
        '<nav class="side-nav">' +
          NAV_ITEMS.map(function (n) {
            return '<button class="side-link' + (n.id === activeId ? ' active' : '') + '" data-nav="' + n.id + '">' +
              icon(n.icon) + esc(n.label) + '</button>';
          }).join('') +
        '</nav>' +
        '<div class="side-user">' + esc(user ? user.name : '') + (user && user.role ? '<span>' + esc(user.role) + '</span>' : '') + '</div>' +
        '<div class="side-links"><a href="../products/index.html">← BRIDGEのプロダクト一覧</a><a href="../index.html">BRIDGE</a></div>' +
      '</aside>';

    var bottom =
      '<nav class="bottom-nav">' +
        '<button class="bn' + (activeId === 'dashboard' ? ' active' : '') + '" data-nav="dashboard">' + icon(NAV_ITEMS[0].icon) + '<span>ホーム</span></button>' +
        '<button class="bn' + (activeId === 'tasks' ? ' active' : '') + '" data-nav="tasks">' + icon(NAV_ITEMS[1].icon) + '<span>タスク</span></button>' +
        '<button class="bn bn-add" data-nav="taskNew" aria-label="タスクを登録">' + icon('M12 5v14M5 12h14') + '</button>' +
        '<button class="bn' + (activeId === 'reflection' ? ' active' : '') + '" data-nav="reflection">' + icon(NAV_ITEMS[4].icon) + '<span>振り返り</span></button>' +
        '<button class="bn' + (activeId === 'menu' ? ' active' : '') + '" data-nav="menu">' + icon('M4 6h16M4 12h16M4 18h16') + '<span>メニュー</span></button>' +
      '</nav>';

    return '<div class="layout">' + side + '<main class="main">' + content + '</main>' + bottom + '</div>';
  }

  // ---- 画面: ログイン(はじめる) ---------------------------------------------
  function renderLogin() {
    app.innerHTML =
      '<div class="login">' +
        '<div class="login-box">' +
          '<p class="login-brand">OWNER OS</p>' +
          '<h1>一人で抱えないための、委任の道具</h1>' +
          '<p class="login-lead">タスクを「自分で決める・誰かに聞く・誰かに任せる・今はやらない」に分け、いま誰がボールを持っているかを見えるようにします。責任を持つことと、自分ですべてやることは違う——その前提で作られています。</p>' +
          '<form id="loginForm">' +
            '<label>お名前<input type="text" id="loginName" required maxlength="30" placeholder="例: 橋本"></label>' +
            '<label>役割(任意)<input type="text" id="loginRole" maxlength="30" placeholder="例: プロジェクト責任者"></label>' +
            '<button type="submit" class="btn btn-primary btn-wide">はじめる</button>' +
          '</form>' +
          '<p class="login-note">登録は不要です。データはこの端末のブラウザにだけ保存され、外部には送信されません。最初はサンプルデータ(医療法人統合プロジェクト)が入った状態で始まります。</p>' +
        '</div>' +
      '</div>';

    document.getElementById('loginForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('loginName').value.trim();
      var role = document.getElementById('loginRole').value.trim();
      if (!name) return;
      Store.seed(name, role || 'プロジェクト責任者');
      Store.setSettings({ sample: true });
      go('dashboard');
      toast('ようこそ。まずは今日の4区分から見てみてください');
    });
  }

  // ---- 画面: 朝のダッシュボード ----------------------------------------------
  function renderDashboard() {
    var m = Store.morning();
    var al = Store.alerts();
    var user = Store.user();

    function section(key, title, desc, list, hintFn) {
      return '<section class="dash-sec dash-' + key + '">' +
        '<header><h2>' + esc(title) + '</h2><span class="dash-count">' + list.length + '件</span></header>' +
        '<p class="dash-desc">' + esc(desc) + '</p>' +
        (list.length
          ? '<div class="task-list">' + list.slice(0, 5).map(function (t) { return taskRow(t, hintFn ? hintFn(t) : ''); }).join('') + '</div>' +
            (list.length > 5 ? '<p class="more-note">ほか' + (list.length - 5) + '件はタスク一覧へ</p>' : '')
          : emptyNote('今日はありません')) +
      '</section>';
    }

    var alertDefs = [
      { key: 'overdue',     label: '期限超過',            list: al.overdue },
      { key: 'waitingLong', label: '回答待ちが長い',       list: al.waitingLong },
      { key: 'noExecutor',  label: '担当者未設定',         list: al.noExecutor },
      { key: 'checkDue',    label: '確認日が来ている',     list: al.checkDue },
      { key: 'noNextCheck', label: '次回確認日なし',       list: al.noNextCheck },
      { key: 'noCriteria',  label: '完了条件が未定',       list: al.noCriteria },
      { key: 'inactive',    label: Store.INACTIVE_DAYS + '日以上動いていない', list: al.inactive }
    ].filter(function (a) { return a.list.length > 0; });

    var html =
      '<header class="page-head">' +
        '<div><h1>おはようございます' + (user ? '、' + esc(user.name) + 'さん' : '') + '</h1>' +
        '<p class="page-sub">今日は「作業」ではなく、「止まっているもの」から見ていきます。</p></div>' +
        '<span class="page-date">' + esc(Store.dueLabel(Store.todayStr())) + '</span>' +
      '</header>' +

      (alertDefs.length
        ? '<div class="alert-row">' + alertDefs.map(function (a) {
            return '<button class="alert-chip" data-alert="' + esc(a.key) + '">' + esc(a.label) + '<b>' + a.list.length + '</b></button>';
          }).join('') + '</div>'
        : '<div class="alert-row"><span class="alert-ok">大きな停滞はありません</span></div>') +

      '<div class="dash-grid">' +
        section('decide', '今日、自分で決めること', '判断すれば前に進むタスクです。ここだけは、渡せません。', m.decide) +
        section('hand', '今日、誰かに渡すこと', '聞く・任せる予定なのに、まだ手元にあるタスクです。', m.hand,
          function (t) { return t.executorId ? '' : '担当者未設定'; }) +
        section('remind', '今日、催促すること', '確認日が来ています。状況を聞くタイミングです。', m.remind,
          function (t) { return '確認日 ' + Store.dueLabel(t.nextCheckDate); }) +
        section('blocked', 'いま、止まっているところ', '期限超過や長い待ちなど、プロジェクトの流れを止めているものです。', m.blocked) +
      '</div>';

    app.innerHTML = shell(html, 'dashboard');
    bindCommon();
    Array.prototype.forEach.call(app.querySelectorAll('[data-alert]'), function (b) {
      b.addEventListener('click', function () {
        view.filter = { scope: 'alert:' + b.dataset.alert, projectId: '' };
        go('tasks');
      });
    });
  }

  // ---- 画面: タスク一覧 -------------------------------------------------------
  var SCOPES = [
    { id: 'open',  label: '進行中' },
    { id: 'mine',  label: '自分ボール' },
    { id: 'wait',  label: '待ち' },
    { id: 'hold',  label: '保留' },
    { id: 'done',  label: '完了' },
    { id: 'all',   label: 'すべて' }
  ];

  var ALERT_LABELS = {
    overdue: '期限超過', waitingLong: '回答待ちが長い', noExecutor: '担当者未設定',
    checkDue: '確認日が来ている', noNextCheck: '次回確認日なし', noCriteria: '完了条件が未定', inactive: '動いていない'
  };

  function filteredTasks() {
    var scope = view.filter.scope;
    var pid = view.filter.projectId;
    var ts = Store.tasks().filter(function (t) { return !pid || t.projectId === pid; });
    if (scope.indexOf('alert:') === 0) {
      var key = scope.slice(6);
      var al = Store.alerts();
      var ids = (al[key] || []).map(function (t) { return t.id; });
      return Store.sortTasks(ts.filter(function (t) { return ids.indexOf(t.id) >= 0; }));
    }
    switch (scope) {
      case 'mine': ts = ts.filter(function (t) { return Store.isOpen(t) && t.ball === 'me'; }); break;
      case 'wait': ts = ts.filter(Store.isWaiting); break;
      case 'hold': ts = ts.filter(function (t) { return t.status === 'hold'; }); break;
      case 'done': ts = ts.filter(function (t) { return t.status === 'done'; }); break;
      case 'all': break;
      case 'open':
      default: ts = ts.filter(Store.isOpen);
    }
    return Store.sortTasks(ts);
  }

  function renderTasks() {
    var ts = filteredTasks();
    var scope = view.filter.scope;
    var isAlert = scope.indexOf('alert:') === 0;

    var html =
      '<header class="page-head"><div><h1>タスク</h1>' +
      '<p class="page-sub">タスク名より先に、「いま誰が持っているか」を見てください。</p></div>' +
      '<button class="btn btn-primary" data-nav="taskNew">' + icon('M12 5v14M5 12h14') + 'タスクを登録</button></header>' +

      '<div class="filter-row">' +
        SCOPES.map(function (s) {
          return '<button class="seg' + (scope === s.id ? ' active' : '') + '" data-scope="' + s.id + '">' + esc(s.label) + '</button>';
        }).join('') +
        (isAlert ? '<span class="seg active" aria-current="true">' + esc(ALERT_LABELS[scope.slice(6)] || '') + '<i data-scope="open" class="seg-x">×</i></span>' : '') +
        '<select id="filterProject" class="filter-select" aria-label="プロジェクトで絞り込み">' +
          '<option value="">全プロジェクト</option>' + projectOptions(view.filter.projectId) +
        '</select>' +
      '</div>' +

      (ts.length
        ? '<div class="task-list">' + ts.map(function (t) { return taskRow(t); }).join('') + '</div>'
        : emptyNote('この条件のタスクはありません'));

    app.innerHTML = shell(html, 'tasks');
    bindCommon();
    Array.prototype.forEach.call(app.querySelectorAll('[data-scope]'), function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        view.filter.scope = b.dataset.scope;
        render();
      });
    });
    document.getElementById('filterProject').addEventListener('change', function () {
      view.filter.projectId = this.value;
      render();
    });
  }

  // ---- 画面: タスク作成(段階ウィザード) ---------------------------------------
  function newWizard() {
    return {
      step: 1,
      title: '', description: '', projectId: (Store.projects()[0] || {}).id || '',
      priority: 'mid', dueDate: '', tags: '', refUrl: '',
      classification: '', suggestion: null, suggestLoading: false,
      executorId: '', nextCheckDate: '', completionCriteria: '', holdReason: ''
    };
  }

  function renderTaskNew() {
    if (!view.wizard) view.wizard = newWizard();
    var w = view.wizard;
    var html = '<header class="page-head"><div><h1>タスクを登録</h1>' +
      '<p class="page-sub">まず内容だけ。処理のしかたは、次の画面で決めます。</p></div></header>' +
      '<div class="wizard">' +
        '<ol class="steps">' +
          ['内容', '4分類', '担当と期限'].map(function (s, i) {
            var n = i + 1;
            return '<li class="' + (w.step === n ? 'now' : (w.step > n ? 'done' : '')) + '"><b>' + n + '</b>' + esc(s) + '</li>';
          }).join('') +
        '</ol>' +
        (w.step === 1 ? wizardStep1(w) : w.step === 2 ? wizardStep2(w) : wizardStep3(w)) +
      '</div>';
    app.innerHTML = shell(html, 'tasks');
    bindCommon();
    bindWizard(w);
  }

  function wizardStep1(w) {
    return '<form id="wz1" class="card form">' +
      '<label>タスク名 <span class="req">必須</span>' +
        '<input type="text" id="wzTitle" required maxlength="80" value="' + esc(w.title) + '" placeholder="例: 統合後の麻薬関係について確認が必要"></label>' +
      '<label>詳細メモ<textarea id="wzDesc" rows="3" placeholder="雑なメモで大丈夫です。分かっていること・気になっていることをそのまま">' + esc(w.description) + '</textarea></label>' +
      '<div class="form-row">' +
        '<label>プロジェクト<select id="wzProject">' + projectOptions(w.projectId) + '</select></label>' +
        '<label>優先度<select id="wzPrio">' +
          Object.keys(Store.PRIORITIES).map(function (k) {
            return '<option value="' + k + '"' + (w.priority === k ? ' selected' : '') + '>' + Store.PRIORITIES[k].label + '</option>';
          }).join('') + '</select></label>' +
        '<label>期限<input type="date" id="wzDue" value="' + esc(w.dueDate) + '"></label>' +
      '</div>' +
      '<details' + (w.tags || w.refUrl ? ' open' : '') + '><summary>タグ・参考URL(任意)</summary>' +
        '<div class="form-row">' +
        '<label>タグ(カンマ区切り)<input type="text" id="wzTags" value="' + esc(w.tags) + '" placeholder="例: 行政, 期限あり"></label>' +
        '<label>参考URL<input type="url" id="wzUrl" value="' + esc(w.refUrl) + '" placeholder="https://"></label>' +
        '</div></details>' +
      '<div class="form-actions"><button type="submit" class="btn btn-primary">次へ: どう扱うかを決める</button></div>' +
    '</form>';
  }

  function wizardStep2(w) {
    var sug = w.suggestion;
    var keys = ['decide', 'ask', 'delegate', 'hold'];
    return '<div class="card">' +
      '<p class="wz-title">「' + esc(w.title) + '」</p>' +
      '<p class="wz-lead">このタスク、<b>あなたが実行する必要はありますか。</b>4つのうちどれかを選んでください。</p>' +
      (w.suggestLoading
        ? '<div class="sug-box"><p class="sug-loading">下書きを用意しています…</p></div>'
        : (sug ? suggestionBox(sug, w) : '')) +
      '<div class="cls-grid">' +
        keys.map(function (k) {
          var c = Store.CLASSIFICATIONS[k];
          var qs = Store.CLASSIFY_QUESTIONS[k];
          return '<button class="cls-card cls-' + k + (w.classification === k ? ' selected' : '') + '" data-cls="' + k + '">' +
            '<b>' + esc(c.label) + '</b>' +
            (sug && sug.classification === k ? '<span class="chip chip-sug">下書きの候補</span>' : '') +
            '<ul>' + qs.map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ul>' +
          '</button>';
        }).join('') +
      '</div>' +
      '<div class="form-actions">' +
        '<button class="btn" data-wz-back="1">戻る</button>' +
        '<button class="btn btn-primary" id="wz2Next"' + (w.classification ? '' : ' disabled') + '>次へ: 担当と期限を決める</button>' +
      '</div>' +
    '</div>';
  }

  function suggestionBox(sug, w) {
    var c = Store.CLASSIFICATIONS[sug.classification];
    return '<div class="sug-box">' +
      '<p class="sug-head">次の一手の下書き<span class="sug-note">' + esc(sug.note || '') + '</span></p>' +
      '<dl class="sug-list">' +
        '<div><dt>分類の候補</dt><dd>' + esc(c.label) + '</dd></div>' +
        '<div><dt>推奨する担当</dt><dd>' + esc(sug.suggestedRole) + '</dd></div>' +
        '<div><dt>あなたの役割</dt><dd>' + esc(sug.userRole) + '</dd></div>' +
        '<div><dt>次の一手</dt><dd>' + esc(sug.nextStep) + '</dd></div>' +
        '<div><dt>確認すべき論点</dt><dd><ul>' + sug.discussionPoints.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul></dd></div>' +
        '<div><dt>推奨期限</dt><dd>' + esc(Store.dueLabel(Store.daysFromToday(sug.suggestedDueDays))) + 'ごろ</dd></div>' +
        '<div><dt>完了条件の下書き</dt><dd>' + esc(sug.completionCriteria) + '</dd></div>' +
      '</dl>' +
      (w ? '<button class="btn btn-small" id="useSug">この下書きを使う</button>' : '') +
    '</div>';
  }

  function wizardStep3(w) {
    var needsPerson = w.classification === 'ask' || w.classification === 'delegate';
    var isHold = w.classification === 'hold';
    var c = Store.CLASSIFICATIONS[w.classification];
    return '<form id="wz3" class="card form">' +
      '<p class="wz-title">「' + esc(w.title) + '」<span class="chip chip-cls cls-' + esc(w.classification) + '">' + esc(c.label) + '</span></p>' +
      (needsPerson
        ? '<label>' + (w.classification === 'ask' ? '聞く相手' : '任せる相手') +
            '<select id="wzExecutor">' + personOptions(w.executorId) + '</select>' +
            '<span class="field-note">いない場合は空のままでも登録できます。その場合はダッシュボードの「今日、誰かに渡すこと」に並びます。関係者は後から追加できます。</span></label>'
        : '') +
      (isHold
        ? '<label>保留の理由<input type="text" id="wzHold" value="' + esc(w.holdReason) + '" placeholder="例: 統合後の体制が固まってから判断する"></label>'
        : '<label>完了条件<textarea id="wzCriteria" rows="2" placeholder="「〜の状態になっていること」の形で書くと、渡しやすくなります">' + esc(w.completionCriteria) + '</textarea></label>') +
      '<div class="form-row">' +
        (!isHold ? '<label>期限<input type="date" id="wzDue3" value="' + esc(w.dueDate) + '"></label>' : '') +
        '<label>' + (isHold ? '再確認する日' : '次回確認日') + '<input type="date" id="wzCheck" value="' + esc(w.nextCheckDate) + '">' +
        '<span class="field-note">' + (isHold ? '保留は、見直す日が決まっていて初めて「意図的な保留」になります。' : '次にこのタスクを見る日です。催促のタイミングにもなります。') + '</span></label>' +
      '</div>' +
      '<div class="form-actions">' +
        '<button type="button" class="btn" data-wz-back="2">戻る</button>' +
        '<button type="submit" class="btn btn-primary">登録する</button>' +
      '</div>' +
    '</form>';
  }

  function bindWizard(w) {
    var f1 = document.getElementById('wz1');
    if (f1) {
      f1.addEventListener('submit', function (e) {
        e.preventDefault();
        w.title = document.getElementById('wzTitle').value.trim();
        w.description = document.getElementById('wzDesc').value.trim();
        w.projectId = document.getElementById('wzProject').value;
        w.priority = document.getElementById('wzPrio').value;
        w.dueDate = document.getElementById('wzDue').value;
        w.tags = document.getElementById('wzTags') ? document.getElementById('wzTags').value : w.tags;
        w.refUrl = document.getElementById('wzUrl') ? document.getElementById('wzUrl').value : w.refUrl;
        if (!w.title) return;
        w.step = 2;
        w.suggestLoading = true;
        render();
        AI.suggest({ title: w.title, description: w.description }).then(function (sug) {
          w.suggestion = sug;
          w.suggestLoading = false;
          if (view.name === 'taskNew' && w.step === 2) render();
        });
      });
    }
    Array.prototype.forEach.call(app.querySelectorAll('[data-cls]'), function (b) {
      b.addEventListener('click', function () {
        w.classification = b.dataset.cls;
        render();
      });
    });
    var useSug = document.getElementById('useSug');
    if (useSug) {
      useSug.addEventListener('click', function () {
        var s = w.suggestion;
        w.classification = s.classification;
        w.completionCriteria = w.completionCriteria || s.completionCriteria;
        if (!w.dueDate) w.dueDate = Store.daysFromToday(s.suggestedDueDays);
        render();
        toast('下書きを反映しました。内容は自分の言葉に直してください');
      });
    }
    var next2 = document.getElementById('wz2Next');
    if (next2) {
      next2.addEventListener('click', function () {
        if (!w.classification) return;
        w.step = 3;
        render();
      });
    }
    Array.prototype.forEach.call(app.querySelectorAll('[data-wz-back]'), function (b) {
      b.addEventListener('click', function (e) {
        e.preventDefault();
        w.step = +b.dataset.wzBack;
        render();
      });
    });
    var f3 = document.getElementById('wz3');
    if (f3) {
      f3.addEventListener('submit', function (e) {
        e.preventDefault();
        var exec = document.getElementById('wzExecutor');
        var crit = document.getElementById('wzCriteria');
        var hold = document.getElementById('wzHold');
        var due3 = document.getElementById('wzDue3');
        w.executorId = exec ? exec.value : '';
        w.completionCriteria = crit ? crit.value.trim() : '';
        w.holdReason = hold ? hold.value.trim() : '';
        if (due3) w.dueDate = due3.value;
        w.nextCheckDate = document.getElementById('wzCheck').value;
        finishWizard(w);
      });
    }
  }

  function finishWizard(w) {
    var desc = w.description + (w.refUrl ? (w.description ? '\n' : '') + '参考: ' + w.refUrl : '');
    var t = Store.addTask({
      title: w.title, description: desc, projectId: w.projectId,
      priority: w.priority, dueDate: w.dueDate || null,
      nextCheckDate: w.nextCheckDate || null,
      completionCriteria: w.completionCriteria,
      executorId: w.executorId || null,
      tags: w.tags ? w.tags.split(/[,、]/).map(function (s) { return s.trim(); }).filter(Boolean) : []
    });
    Store.classifyTask(t.id, w.classification);
    if (w.holdReason) Store.updateTask(t.id, { holdReason: w.holdReason });
    var openCompose = null;
    if ((w.classification === 'ask' || w.classification === 'delegate') && w.executorId) {
      // ボールはまだ自分。依頼文を作って渡すところまで誘導する
      openCompose = w.classification === 'ask' ? 'question' : 'request';
    }
    view.wizard = null;
    go('taskDetail', { taskId: t.id });
    if (openCompose) {
      startCompose(t.id, openCompose);
      toast('登録しました。依頼文の下書きを作りました — 渡すところまで進めましょう');
    } else if (w.classification === 'decide') {
      toast('登録しました。判断の期限は、あとから変えられます');
    } else {
      toast('登録しました');
    }
  }

  // ---- 画面: タスク詳細 -------------------------------------------------------
  function renderTaskDetail() {
    var t = Store.task(view.taskId);
    if (!t) { go('tasks'); return; }
    var prj = Store.project(t.projectId);
    var c = Store.CLASSIFICATIONS[t.classification] || Store.CLASSIFICATIONS.none;
    var acts = Store.taskActivities(t.id);
    var canRemind = Store.isWaiting(t);
    var executor = t.executorId ? Store.person(t.executorId) : null;

    var facts =
      '<dl class="fact-list">' +
        '<div><dt>プロジェクト</dt><dd>' + esc(prj ? prj.name : '—') + '</dd></div>' +
        '<div><dt>分類</dt><dd>' + clsChip(t) + ' ' + esc(c.label) + '</dd></div>' +
        '<div><dt>優先度</dt><dd>' + prioMark(t) + esc((Store.PRIORITIES[t.priority] || {}).label || '中') + '</dd></div>' +
        '<div><dt>期限</dt><dd>' + dueChip(t) + '</dd></div>' +
        '<div><dt>ボールの所在</dt><dd>' + ballChip(t) + '</dd></div>' +
        '<div><dt>次に動く人</dt><dd>' + esc(t.nextActorId ? (Store.personName(t.nextActorId) || '—') : '—') + '</dd></div>' +
        '<div><dt>担当者</dt><dd>' + esc(executor ? executor.name + (executor.role ? '(' + executor.role + ')' : '') : '未設定') + '</dd></div>' +
        '<div><dt>最終責任者</dt><dd>' + esc(Store.personName(t.finalOwnerId) || '自分') + '</dd></div>' +
        '<div><dt>次回確認日</dt><dd>' + (t.nextCheckDate ? esc(Store.dueLabel(t.nextCheckDate)) + (Store.checkDue(t) ? ' <span class="chip chip-warn">確認日が来ています</span>' : '') : '未設定') + '</dd></div>' +
        '<div><dt>完了条件</dt><dd>' + (t.completionCriteria ? esc(t.completionCriteria) : '<span class="dim">未定(渡す前に決めると戻りが減ります)</span>') + '</dd></div>' +
        (t.holdReason ? '<div><dt>保留の理由</dt><dd>' + esc(t.holdReason) + '</dd></div>' : '') +
        (t.tags && t.tags.length ? '<div><dt>タグ</dt><dd>' + t.tags.map(function (g) { return '<span class="chip">' + esc(g) + '</span>'; }).join(' ') + '</dd></div>' : '') +
      '</dl>';

    var ballControls = t.status === 'done' ? '' :
      '<div class="ball-controls card">' +
        '<p class="card-title">ボールを動かす</p>' +
        '<div class="form-row">' +
          '<label>状態<select id="ballSelect">' +
            Object.keys(Store.BALLS).map(function (k) {
              return '<option value="' + k + '"' + (t.ball === k ? ' selected' : '') + '>' + Store.BALLS[k].label + '</option>';
            }).join('') + '</select></label>' +
          '<label>持つ人<select id="ballHolder">' +
            '<option value="me"' + (t.ballHolderId === 'me' ? ' selected' : '') + '>自分</option>' +
            Store.people().map(function (p) {
              return '<option value="' + esc(p.id) + '"' + (t.ballHolderId === p.id ? ' selected' : '') + '>' + esc(p.name) + '</option>';
            }).join('') + '</select></label>' +
          '<label>次回確認日<input type="date" id="ballCheck" value="' + esc(t.nextCheckDate || '') + '"></label>' +
          '<button class="btn btn-primary" id="ballApply">反映する</button>' +
        '</div>' +
      '</div>';

    var composeButtons = t.status === 'done' ? '' :
      '<div class="btn-row">' +
        '<button class="btn" data-compose="request">依頼文を作る</button>' +
        '<button class="btn" data-compose="question">質問文を作る</button>' +
        (canRemind ? '<button class="btn" data-compose="remind">催促文を作る</button>' : '') +
        '<button class="btn" id="sugBtn">次の一手の下書きを見る</button>' +
        (t.status !== 'done' ? '<button class="btn btn-done" id="doneBtn">完了にする</button>' : '') +
      '</div>';

    var html =
      '<header class="page-head detail-head">' +
        '<div>' +
          '<button class="btn btn-back" data-nav="tasks">' + icon('M15 18l-6-6 6-6') + '一覧へ</button>' +
          '<h1>' + esc(t.title) + '</h1>' +
          (t.description ? '<p class="task-desc">' + esc(t.description).replace(/\n/g, '<br>') + '</p>' : '') +
        '</div>' +
        '<div class="head-actions">' +
          '<button class="btn btn-small" id="editBtn">' + (view.editingTask ? '編集をやめる' : '編集') + '</button>' +
          '<button class="btn btn-small btn-danger" id="delBtn">削除</button>' +
        '</div>' +
      '</header>' +
      (view.editingTask ? editForm(t) : '<div class="card">' + facts + '</div>') +
      composeButtons +
      (view.compose ? composePanel(t) : '') +
      (view.suggestionFor === t.id && view.suggestion ? suggestionBox(view.suggestion, null) : '') +
      ballControls +
      '<section class="card">' +
        '<p class="card-title">動き(履歴)</p>' +
        (acts.length
          ? '<ul class="act-list">' + acts.map(function (a) {
              return '<li><span class="act-date">' + esc(shortDate(a.createdAt)) + '</span>' + esc(a.content) + '</li>';
            }).join('') + '</ul>'
          : emptyNote('まだ動きがありません')) +
      '</section>';

    app.innerHTML = shell(html, 'tasks');
    bindCommon();
    bindTaskDetail(t);
  }

  function editForm(t) {
    return '<form id="editForm" class="card form">' +
      '<label>タスク名<input type="text" id="edTitle" required value="' + esc(t.title) + '"></label>' +
      '<label>詳細メモ<textarea id="edDesc" rows="3">' + esc(t.description) + '</textarea></label>' +
      '<div class="form-row">' +
        '<label>プロジェクト<select id="edProject">' + projectOptions(t.projectId) + '</select></label>' +
        '<label>分類<select id="edCls">' +
          Object.keys(Store.CLASSIFICATIONS).map(function (k) {
            return '<option value="' + k + '"' + (t.classification === k ? ' selected' : '') + '>' + Store.CLASSIFICATIONS[k].label + '</option>';
          }).join('') + '</select></label>' +
        '<label>優先度<select id="edPrio">' +
          Object.keys(Store.PRIORITIES).map(function (k) {
            return '<option value="' + k + '"' + (t.priority === k ? ' selected' : '') + '>' + Store.PRIORITIES[k].label + '</option>';
          }).join('') + '</select></label>' +
      '</div>' +
      '<div class="form-row">' +
        '<label>担当者<select id="edExec">' + personOptions(t.executorId) + '</select></label>' +
        '<label>期限<input type="date" id="edDue" value="' + esc(t.dueDate || '') + '"></label>' +
        '<label>次回確認日<input type="date" id="edCheck" value="' + esc(t.nextCheckDate || '') + '"></label>' +
      '</div>' +
      '<label>完了条件<textarea id="edCriteria" rows="2">' + esc(t.completionCriteria || '') + '</textarea></label>' +
      '<label>保留の理由<input type="text" id="edHold" value="' + esc(t.holdReason || '') + '"></label>' +
      '<div class="form-actions"><button type="submit" class="btn btn-primary">保存する</button></div>' +
    '</form>';
  }

  function startCompose(taskId, kind) {
    view.taskId = taskId;
    view.compose = { kind: kind, tone: 'polite', text: '' };
    buildComposeText();
    render();
    // モバイルではパネルが画面外に描画されるため、明示的に連れて行く
    var el = document.getElementById('composeText');
    if (el) {
      el.scrollIntoView({ block: 'center' });
      el.focus({ preventScroll: true });
    }
  }

  function buildComposeText() {
    var t = Store.task(view.taskId);
    var cp = view.compose;
    if (!t || !cp) return;
    var user = Store.user();
    var executor = t.executorId ? Store.person(t.executorId) : null;
    var sug = (view.suggestionFor === t.id && view.suggestion) ? view.suggestion : null;
    var points = sug ? sug.discussionPoints : [];
    if (cp.kind === 'remind') {
      cp.text = AI.composeReminder({
        personName: executor ? executor.name : (t.ballHolderId !== 'me' ? Store.personName(t.ballHolderId) : ''),
        title: t.title, due: t.dueDate, userName: user ? user.name : ''
      }, cp.tone);
    } else {
      cp.text = AI.composeRequest({
        personName: executor ? executor.name : '',
        title: t.title,
        background: t.description ? t.description.split('\n')[0] : '',
        points: points,
        criteria: t.completionCriteria,
        due: t.dueDate,
        askOnly: cp.kind === 'question',
        userName: user ? user.name : ''
      }, cp.tone);
    }
  }

  function composePanel(t) {
    var cp = view.compose;
    var titles = { request: '依頼文の下書き', question: '質問文の下書き', remind: '催促文の下書き' };
    return '<div class="card compose">' +
      '<p class="card-title">' + esc(titles[cp.kind]) + '</p>' +
      '<div class="tone-row">' +
        Object.keys(AI.TONES).map(function (k) {
          return '<button class="seg' + (cp.tone === k ? ' active' : '') + '" data-tone="' + k + '">' + esc(AI.TONES[k].label) + '</button>';
        }).join('') +
      '</div>' +
      '<textarea id="composeText" rows="9" aria-label="' + esc(titles[cp.kind]) + '">' + esc(cp.text) + '</textarea>' +
      '<p class="field-note">下書きです。相手との関係に合わせて、自分の言葉に直してから送ってください。</p>' +
      '<div class="btn-row">' +
        '<button class="btn btn-primary" id="copyCompose">コピーする</button>' +
        (cp.kind === 'remind'
          ? '<button class="btn" id="sentRemind">催促した(記録して確認日を更新)</button>'
          : '<button class="btn" id="sentRequest">渡した(ボールを相手へ)</button>') +
        '<button class="btn" id="closeCompose">閉じる</button>' +
      '</div>' +
    '</div>';
  }

  function bindTaskDetail(t) {
    Array.prototype.forEach.call(app.querySelectorAll('[data-compose]'), function (b) {
      b.addEventListener('click', function () { startCompose(t.id, b.dataset.compose); });
    });
    var sugBtn = document.getElementById('sugBtn');
    if (sugBtn) {
      sugBtn.addEventListener('click', function () {
        AI.suggest({ title: t.title, description: t.description }).then(function (s) {
          view.suggestion = s;
          view.suggestionFor = t.id;
          render();
        });
      });
    }
    var doneBtn = document.getElementById('doneBtn');
    if (doneBtn) {
      doneBtn.addEventListener('click', function () {
        Store.completeTask(t.id);
        toast('完了にしました');
        render();
      });
    }
    var editBtn = document.getElementById('editBtn');
    if (editBtn) {
      editBtn.addEventListener('click', function () {
        view.editingTask = !view.editingTask;
        render();
      });
    }
    var delBtn = document.getElementById('delBtn');
    if (delBtn) {
      delBtn.addEventListener('click', function () {
        if (window.confirm('このタスクを削除しますか。元に戻せません。')) {
          Store.deleteTask(t.id);
          go('tasks');
          toast('削除しました');
        }
      });
    }
    var editFormEl = document.getElementById('editForm');
    if (editFormEl) {
      editFormEl.addEventListener('submit', function (e) {
        e.preventDefault();
        var cls = document.getElementById('edCls').value;
        Store.updateTask(t.id, {
          title: document.getElementById('edTitle').value.trim(),
          description: document.getElementById('edDesc').value.trim(),
          projectId: document.getElementById('edProject').value,
          priority: document.getElementById('edPrio').value,
          executorId: document.getElementById('edExec').value || null,
          dueDate: document.getElementById('edDue').value || null,
          nextCheckDate: document.getElementById('edCheck').value || null,
          completionCriteria: document.getElementById('edCriteria').value.trim(),
          holdReason: document.getElementById('edHold').value.trim()
        }, '内容を編集');
        if (cls !== t.classification) Store.classifyTask(t.id, cls);
        view.editingTask = false;
        render();
        toast('保存しました');
      });
    }
    var ballApply = document.getElementById('ballApply');
    if (ballApply) {
      ballApply.addEventListener('click', function () {
        var ball = document.getElementById('ballSelect').value;
        var holder = document.getElementById('ballHolder').value;
        var check = document.getElementById('ballCheck').value;
        if (check !== (t.nextCheckDate || '')) Store.updateTask(t.id, { nextCheckDate: check || null });
        Store.passBall(t.id, ball, holder === 'me' ? null : holder);
        var kind = Store.BALLS[ball].kind;
        if (kind === 'wait' && !check) {
          toast('反映しました。次回確認日も決めておくと、催促を忘れません');
        } else {
          toast('反映しました');
        }
        render();
      });
    }
    Array.prototype.forEach.call(app.querySelectorAll('[data-tone]'), function (b) {
      b.addEventListener('click', function () {
        view.compose.tone = b.dataset.tone;
        buildComposeText();
        render();
      });
    });
    var copyBtn = document.getElementById('copyCompose');
    if (copyBtn) {
      copyBtn.addEventListener('click', function () {
        copyText(document.getElementById('composeText').value, 'コピーしました');
      });
    }
    var sentReq = document.getElementById('sentRequest');
    if (sentReq) {
      sentReq.addEventListener('click', function () {
        var isAsk = view.compose.kind === 'question';
        var holder = t.executorId;
        if (!holder) { toast('先に担当者を設定してください(編集から)'); return; }
        Store.passBall(t.id, isAsk ? 'waiting_answer' : 'owner', holder);
        if (!t.nextCheckDate) {
          Store.updateTask(t.id, { nextCheckDate: Store.daysFromToday(3) });
          toast('ボールを渡しました。次回確認日を3日後に仮置きしました');
        } else {
          toast('ボールを渡しました');
        }
        view.compose = null;
        render();
      });
    }
    var sentRem = document.getElementById('sentRemind');
    if (sentRem) {
      sentRem.addEventListener('click', function () {
        Store.logActivity(t.id, 'remind', '催促した(' + Store.personName(t.ballHolderId) + ')');
        Store.updateTask(t.id, { nextCheckDate: Store.daysFromToday(2) }, null);
        view.compose = null;
        render();
        toast('記録しました。次回確認日を2日後にしました');
      });
    }
    var composeText = document.getElementById('composeText');
    if (composeText) {
      composeText.addEventListener('input', function () { view.compose.text = this.value; });
    }
  }

  // ---- 画面: プロジェクト -----------------------------------------------------
  function renderProjects() {
    var prjs = Store.projects();
    var html =
      '<header class="page-head"><div><h1>プロジェクト</h1>' +
      '<p class="page-sub">進み具合ではなく、止まっていないかを見ます。</p></div>' +
      '<button class="btn" id="addPrjBtn">' + icon('M12 5v14M5 12h14') + '追加</button></header>' +
      (view.addingProject
        ? '<form id="prjForm" class="card form">' +
            '<label>プロジェクト名<input type="text" id="prjName" required maxlength="60"></label>' +
            '<label>説明(任意)<input type="text" id="prjDesc" maxlength="200"></label>' +
            '<div class="form-row"><label>期限(任意)<input type="date" id="prjDue"></label></div>' +
            '<div class="form-actions"><button type="submit" class="btn btn-primary">追加する</button></div>' +
          '</form>'
        : '') +
      (prjs.length
        ? '<div class="prj-list">' + prjs.map(function (p) {
            var ts = Store.tasks().filter(function (t) { return t.projectId === p.id; });
            var open = ts.filter(Store.isOpen);
            var done = ts.length - open.length;
            var warns = Store.projectWarnings(p.id);
            return '<button class="prj-card" data-open-prj="' + esc(p.id) + '">' +
              '<b>' + esc(p.name) + '</b>' +
              '<span class="prj-meta">進行中' + open.length + '件 / 完了' + done + '件' + (p.dueDate ? ' ・期限 ' + esc(Store.dueLabel(p.dueDate)) : '') + '</span>' +
              (warns.length
                ? '<span class="prj-warns">' + esc(warns[0].label) + (warns.length > 1 ? ' ほか' + (warns.length - 1) + '件' : '') + '</span>'
                : '<span class="prj-ok">大きな停滞はありません</span>') +
            '</button>';
          }).join('') + '</div>'
        : emptyNote('プロジェクトがありません'));
    app.innerHTML = shell(html, 'projects');
    bindCommon();
    document.getElementById('addPrjBtn').addEventListener('click', function () {
      view.addingProject = !view.addingProject;
      render();
    });
    var f = document.getElementById('prjForm');
    if (f) {
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = document.getElementById('prjName').value.trim();
        if (!name) return;
        Store.addProject({ name: name, description: document.getElementById('prjDesc').value.trim(), dueDate: document.getElementById('prjDue').value || null });
        view.addingProject = false;
        render();
        toast('追加しました');
      });
    }
    Array.prototype.forEach.call(app.querySelectorAll('[data-open-prj]'), function (b) {
      b.addEventListener('click', function () { go('projectDetail', { projectId: b.dataset.openPrj }); });
    });
  }

  function renderProjectDetail() {
    var p = Store.project(view.projectId);
    if (!p) { go('projects'); return; }
    var warns = Store.projectWarnings(p.id);
    var board = Store.ballBoard(p.id);
    var doneList = Store.tasks().filter(function (t) { return t.projectId === p.id && t.status === 'done'; });

    function col(title, list, cls) {
      return '<div class="board-col ' + cls + '">' +
        '<p class="board-head">' + esc(title) + '<b>' + list.length + '</b></p>' +
        (list.length
          ? list.map(function (t) { return taskRow(t); }).join('')
          : '<p class="empty small">なし</p>') +
      '</div>';
    }

    var html =
      '<header class="page-head detail-head"><div>' +
        '<button class="btn btn-back" data-nav="projects">' + icon('M15 18l-6-6 6-6') + '一覧へ</button>' +
        '<h1>' + esc(p.name) + '</h1>' +
        (p.description ? '<p class="page-sub">' + esc(p.description) + '</p>' : '') +
      '</div>' +
      (p.dueDate ? '<span class="page-date">期限 ' + esc(Store.dueLabel(p.dueDate)) + '</span>' : '') +
      '</header>' +
      (warns.length
        ? '<div class="card warn-card"><p class="card-title">いま止まりやすいところ</p><ul class="warn-list">' +
            warns.map(function (w) { return '<li>' + esc(w.label) + '</li>'; }).join('') +
          '</ul><p class="field-note">どこに手を入れると流れ出すかを見るための一覧です。</p></div>'
        : '') +
      '<div class="board">' +
        col('自分がボールを持つ', board.me, 'b-me') +
        col('担当者が実行中', board.owner, 'b-owner') +
        col('回答・承認・外部待ち', board.wait, 'b-wait') +
        col('保留', board.hold, 'b-hold') +
      '</div>' +
      (doneList.length
        ? '<details class="done-fold"><summary>完了したタスク(' + doneList.length + ')</summary><div class="task-list">' +
            doneList.map(function (t) { return taskRow(t); }).join('') + '</div></details>'
        : '');

    app.innerHTML = shell(html, 'projects');
    bindCommon();
  }

  // ---- 画面: 関係者 -----------------------------------------------------------
  function renderPeople() {
    var ppl = Store.people();
    var open = Store.tasks().filter(Store.isOpen);
    var html =
      '<header class="page-head"><div><h1>関係者</h1>' +
      '<p class="page-sub">誰に何を渡しているかが見えると、渡しすぎているところと、渡せていないところに気づけます。</p></div>' +
      '<button class="btn" id="addPsnBtn">' + icon('M12 5v14M5 12h14') + '追加</button></header>' +
      (view.addingPerson
        ? '<form id="psnForm" class="card form">' +
            '<div class="form-row">' +
            '<label>名前<input type="text" id="psnName" required maxlength="30"></label>' +
            '<label>役割<input type="text" id="psnRole" maxlength="40" placeholder="例: 法務担当"></label>' +
            '<label>所属(任意)<input type="text" id="psnOrg" maxlength="40"></label>' +
            '</div>' +
            '<div class="form-actions"><button type="submit" class="btn btn-primary">追加する</button></div>' +
          '</form>'
        : '') +
      '<div class="people-list">' +
        ppl.map(function (p) {
          var holding = open.filter(function (t) { return t.ballHolderId === p.id; });
          var assigned = open.filter(function (t) { return t.executorId === p.id; });
          return '<div class="person-card">' +
            '<b>' + esc(p.name) + '</b>' +
            '<span class="person-role">' + esc(p.role || '') + (p.organization ? ' ・' + esc(p.organization) : '') + '</span>' +
            '<span class="person-stats">ボール' + holding.length + '件 / 担当' + assigned.length + '件' +
              (holding.length >= 3 ? '<span class="chip chip-warn">集中しています</span>' : '') + '</span>' +
          '</div>';
        }).join('') +
      '</div>';
    app.innerHTML = shell(html, 'people');
    bindCommon();
    document.getElementById('addPsnBtn').addEventListener('click', function () {
      view.addingPerson = !view.addingPerson;
      render();
    });
    var f = document.getElementById('psnForm');
    if (f) {
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var name = document.getElementById('psnName').value.trim();
        if (!name) return;
        Store.addPerson({ name: name, role: document.getElementById('psnRole').value.trim(), organization: document.getElementById('psnOrg').value.trim() });
        view.addingPerson = false;
        render();
        toast('追加しました');
      });
    }
  }

  // ---- 画面: リフレクション ----------------------------------------------------
  function renderReflection() {
    var refs = Store.reflections().slice().reverse();
    var d = view.reflectDraft;
    var html =
      '<header class="page-head"><div><h1>リフレクション</h1>' +
      '<p class="page-sub">指摘やモヤモヤを、感情ごと書いてください。事実と解釈を分けて、動ける形にします。診断ではありません。</p></div></header>' +
      '<form id="refForm" class="card form">' +
        '<label>いま引っかかっていること' +
          '<textarea id="refInput" rows="3" placeholder="例: オーナーシップが足りないと言われた。期待に応えられていない気がする。">' + esc(d ? d.rawInput : '') + '</textarea></label>' +
        '<div class="form-actions"><button type="submit" class="btn btn-primary">分けてみる</button></div>' +
      '</form>' +
      (d && d.result ? reflectionResult(d) : '') +
      (refs.length
        ? '<section class="card"><p class="card-title">これまでの記録</p><ul class="ref-list">' +
            refs.map(function (r) {
              return '<li><span class="act-date">' + esc(shortDate(r.createdAt)) + '</span>' +
                '<b>' + esc(r.rawInput.length > 40 ? r.rawInput.slice(0, 40) + '…' : r.rawInput) + '</b>' +
                (r.nextAction ? '<span class="ref-next">次の行動: ' + esc(r.nextAction) + '</span>' : '') + '</li>';
            }).join('') + '</ul></section>'
        : '');
    app.innerHTML = shell(html, 'reflection');
    bindCommon();
    document.getElementById('refForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var raw = document.getElementById('refInput').value.trim();
      if (!raw) return;
      view.reflectDraft = { rawInput: raw, result: null, loading: true };
      render();
      AI.reflect(raw).then(function (r) {
        view.reflectDraft = { rawInput: raw, result: r };
        render();
      });
    });
  }

  function reflectionResult(d) {
    var r = d.result;
    var rows = [
      ['事実', 'fact', r.fact],
      ['自分の解釈', 'interpretation', r.interpretation],
      ['感情', 'emotion', r.emotion],
      ['実際の課題', 'actualIssue', r.actualIssue],
      ['次の行動', 'nextAction', r.nextAction],
      ['再発防止', 'prevention', r.prevention]
    ];
    return '<div class="card ref-result">' +
      '<p class="card-title">分けた下書き<span class="sug-note">' + esc(r.note || '') + '</span></p>' +
      '<p class="field-note">下書きです。しっくりこない欄は、自分の言葉に直してから保存してください。</p>' +
      '<form id="refSaveForm">' +
        rows.map(function (row) {
          return '<label class="ref-row"><span>' + esc(row[0]) + '</span>' +
            '<textarea data-ref-field="' + row[1] + '" rows="2">' + esc(row[2]) + '</textarea></label>';
        }).join('') +
        '<div class="form-actions">' +
          '<button type="submit" class="btn btn-primary">保存する</button>' +
          '<button type="button" class="btn" id="refToTask">「次の行動」をタスクにする</button>' +
        '</div>' +
      '</form>' +
    '</div>';
  }

  function collectReflection(d) {
    var out = { rawInput: d.rawInput };
    Array.prototype.forEach.call(app.querySelectorAll('[data-ref-field]'), function (ta) {
      out[ta.dataset.refField] = ta.value.trim();
    });
    return out;
  }

  // ---- 画面: 週次レビュー ------------------------------------------------------
  function renderReview() {
    var r = Store.weeklyReview();
    function stat(label, value, note) {
      return '<div class="stat"><b>' + value + '</b><span>' + esc(label) + '</span>' + (note ? '<i>' + esc(note) + '</i>' : '') + '</div>';
    }
    var prjNames = Object.keys(r.myByProject).map(function (pid) {
      var p = pid === 'none' ? null : Store.project(pid);
      return { name: p ? p.name : 'プロジェクト未設定', count: r.myByProject[pid] };
    }).sort(function (a, b) { return b.count - a.count; });

    var html =
      '<header class="page-head"><div><h1>週次レビュー</h1>' +
      '<p class="page-sub">先週、自分の時間がどこに置かれていたかを、静かに眺めるための画面です。</p></div></header>' +
      '<div class="stat-row">' +
        stat('完了した意思決定・分類', r.decided) +
        stat('完了したタスク', r.completed.length) +
        stat('委任・依頼した回数', r.delegated) +
        stat('催促した回数', r.reminded) +
      '</div>' +
      '<div class="dash-grid">' +
        '<section class="dash-sec"><header><h2>自分がボールを持っているタスク</h2><span class="dash-count">' + r.myBall.length + '件</span></header>' +
          (r.myBall.length ? '<div class="task-list">' + r.myBall.slice(0, 6).map(function (t) { return taskRow(t); }).join('') + '</div>' : emptyNote('ありません')) +
          (prjNames.length ? '<p class="field-note">集中している領域: ' + prjNames.map(function (x) { return esc(x.name) + '(' + x.count + '件)'; }).join('、') + '</p>' : '') +
        '</section>' +
        '<section class="dash-sec"><header><h2>停滞しているタスク</h2><span class="dash-count">' + r.stuck.length + '件</span></header>' +
          (r.stuck.length ? '<div class="task-list">' + r.stuck.slice(0, 6).map(function (t) { return taskRow(t); }).join('') + '</div>' : emptyNote('ありません')) +
        '</section>' +
      '</div>' +
      '<section class="card"><p class="card-title">来週に向けて</p><ul class="tips">' +
        r.tips.map(function (tip) { return '<li>' + esc(tip) + '</li>'; }).join('') +
      '</ul></section>' +
      '<section class="card">' +
        '<p class="card-title">キャリアログに残す</p>' +
        '<p class="field-note">今週の動きを、キャリアの記録として貼り付けられる形にしました。コピーして、キャリアログ(iOSアプリ)や職務経歴のメモに追加できます。「気づき」の欄だけは、自分の言葉で。</p>' +
        '<textarea id="careerLogText" rows="8" aria-label="キャリアログに残す週次記録">' + esc(careerLogText(r)) + '</textarea>' +
        '<div class="btn-row"><button class="btn btn-primary" id="copyCareerLog">コピーする</button></div>' +
      '</section>';
    app.innerHTML = shell(html, 'review');
    bindCommon();
    document.getElementById('copyCareerLog').addEventListener('click', function () {
      copyText(document.getElementById('careerLogText').value, 'コピーしました。キャリアログに貼り付けてください');
    });
  }

  /** 週次レビューの実績を、キャリアログ向けの下書きテキストにする */
  function careerLogText(r) {
    var completedTitles = r.completed.map(function (t) { return t.title; });
    var projectNames = [];
    r.completed.forEach(function (t) {
      var p = Store.project(t.projectId);
      if (p && projectNames.indexOf(p.name) < 0) projectNames.push(p.name);
    });
    return AI.composeCareerLog({
      from: Store.dueLabel(Store.daysFromToday(-7)),
      to: Store.dueLabel(Store.todayStr()),
      decided: r.decided,
      delegated: r.delegated,
      reminded: r.reminded,
      completedTitles: completedTitles,
      projects: projectNames
    });
  }

  // ---- 画面: 設定 --------------------------------------------------------------
  function renderSettings() {
    var user = Store.user();
    var html =
      '<header class="page-head"><div><h1>設定</h1></div></header>' +
      '<form id="userForm" class="card form">' +
        '<p class="card-title">あなたの情報</p>' +
        '<div class="form-row">' +
          '<label>名前<input type="text" id="setName" value="' + esc(user ? user.name : '') + '" required maxlength="30"></label>' +
          '<label>役割<input type="text" id="setRole" value="' + esc(user ? user.role || '' : '') + '" maxlength="30"></label>' +
        '</div>' +
        '<div class="form-actions"><button type="submit" class="btn btn-primary">保存する</button></div>' +
      '</form>' +
      '<div class="card form">' +
        '<p class="card-title">文章の下書き</p>' +
        '<p class="field-note">分類の候補や依頼文の下書きは、この端末の中だけで作っています。書いた内容が外に送られることはありません。</p>' +
      '</div>' +
      '<div class="card form">' +
        '<p class="card-title">データ</p>' +
        '<p class="field-note">データはこの端末のブラウザにだけ保存されています。</p>' +
        '<div class="btn-row">' +
          '<button class="btn" id="exportBtn">JSONで書き出す</button>' +
          '<button class="btn btn-danger" id="wipeBtn">すべてのデータを削除する</button>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<p class="card-title">このツールについて</p>' +
        '<p class="about-text">OWNER OS(仮称)は、現場で手を動かす側から、任せる側になった人のための道具です。タスクを「自分で決める・誰かに聞く・誰かに任せる・今はやらない」に分け、ボールの所在と次の確認日を決めます。責任を持つことと、自分ですべて実行することは違う——抱え込む以外の選択肢を増やすために作っています。BRIDGEの型(評価・理解・設計・実践・再評価)のうち、設計と実践を支える道具です。<a href="../products/index.html">BRIDGEのプロダクト一覧へ</a></p>' +
      '</div>';
    app.innerHTML = shell(html, 'settings');
    bindCommon();
    document.getElementById('userForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = document.getElementById('setName').value.trim();
      if (!name) return;
      Store.setUser(name, document.getElementById('setRole').value.trim());
      render();
      toast('保存しました');
    });
    document.getElementById('exportBtn').addEventListener('click', function () {
      var blob = new Blob([JSON.stringify(Store.state(), null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'owner-os-' + Store.todayStr() + '.json';
      a.click();
      URL.revokeObjectURL(a.href);
    });
    document.getElementById('wipeBtn').addEventListener('click', function () {
      if (window.confirm('すべてのデータを削除して最初からやり直しますか。元に戻せません。')) {
        Store.resetAll();
        go('dashboard');
      }
    });
  }

  // ---- 画面: メニュー(モバイル用) ----------------------------------------------
  function renderMenu() {
    var html =
      '<header class="page-head"><div><h1>メニュー</h1></div></header>' +
      '<div class="menu-list">' +
        NAV_ITEMS.map(function (n) {
          return '<button class="menu-item" data-nav="' + n.id + '">' + icon(n.icon) + esc(n.label) + '</button>';
        }).join('') +
      '</div>' +
      '<div class="menu-foot"><a href="../products/index.html">← BRIDGEのプロダクト一覧</a><a href="../index.html">BRIDGE</a></div>';
    app.innerHTML = shell(html, 'menu');
    bindCommon();
  }

  // ---- 共通バインド --------------------------------------------------------------
  function bindCommon() {
    Array.prototype.forEach.call(document.querySelectorAll('[data-nav]'), function (b) {
      b.addEventListener('click', function () {
        var dest = b.dataset.nav;
        if (dest === 'taskNew') view.wizard = null;
        go(dest);
      });
    });
    Array.prototype.forEach.call(app.querySelectorAll('[data-open-task]'), function (b) {
      b.addEventListener('click', function () { go('taskDetail', { taskId: b.dataset.openTask }); });
    });
    var refSave = document.getElementById('refSaveForm');
    if (refSave) {
      refSave.addEventListener('submit', function (e) {
        e.preventDefault();
        Store.addReflection(collectReflection(view.reflectDraft));
        view.reflectDraft = null;
        render();
        toast('保存しました');
      });
      var toTask = document.getElementById('refToTask');
      if (toTask) {
        toTask.addEventListener('click', function () {
          var data = collectReflection(view.reflectDraft);
          Store.addReflection(data);
          var w = newWizard();
          w.title = data.nextAction && data.nextAction.length <= 80 ? data.nextAction : 'リフレクションからの行動';
          w.description = data.nextAction || '';
          view.wizard = w;
          view.reflectDraft = null;
          go('taskNew');
          toast('保存して、タスク登録に進みました');
        });
      }
    }
  }

  // ---- ルート ---------------------------------------------------------------------
  function render() {
    if (!Store.user()) { renderLogin(); return; }
    switch (view.name) {
      case 'dashboard':     renderDashboard(); break;
      case 'tasks':         renderTasks(); break;
      case 'taskNew':       renderTaskNew(); break;
      case 'taskDetail':    renderTaskDetail(); break;
      case 'projects':      renderProjects(); break;
      case 'projectDetail': renderProjectDetail(); break;
      case 'people':        renderPeople(); break;
      case 'reflection':    renderReflection(); break;
      case 'review':        renderReview(); break;
      case 'settings':      renderSettings(); break;
      case 'menu':          renderMenu(); break;
      default:              renderDashboard();
    }
  }

  // ---- 起動 -----------------------------------------------------------------------
  Store.load();
  if (Store.user() && window.location.hash) applyHash(window.location.hash);
  render();
  if (Store.user()) syncHash();
})();
