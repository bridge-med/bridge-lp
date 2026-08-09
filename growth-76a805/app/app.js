/* Growth OS — app.js
 * 画面の描画とフォームの接続。データの読み書きは GrowthStore、
 * AI変換は GrowthAI だけを通じて行う(直書きのAI呼び出しはしない)。
 */

'use strict';

(function () {
  const S = window.GrowthStore;
  const AI = window.GrowthAI;

  /* ---------- 小物 ---------- */
  const $ = (sel) => document.querySelector(sel);
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const yen = (n) => {
    const r = Math.round(Number(n) || 0);
    return (r < 0 ? '−¥' : '¥') + Math.abs(r).toLocaleString('ja-JP');
  };
  const fmtDate = (d) => {
    if (!d) return '';
    const m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? Number(m[2]) + '/' + Number(m[3]) : String(d);
  };
  const fmtDateTime = (iso) => {
    const dt = new Date(iso);
    if (isNaN(dt)) return '';
    return (dt.getMonth() + 1) + '/' + dt.getDate() + ' ' + String(dt.getHours()).padStart(2, '0') + ':' + String(dt.getMinutes()).padStart(2, '0');
  };
  const splitTags = (v) => String(v || '').split(/[,、]/).map((t) => t.trim()).filter(Boolean);

  let toastTimer = null;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  function copyText(text, doneMsg) {
    const done = () => toast(doneMsg || 'コピーしました');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => toast('コピーできませんでした'));
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); done(); } catch (e) { toast('コピーできませんでした'); }
      ta.remove();
    }
  }

  /* ---------- テーマ ---------- */
  $('#themeBtn').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('bridge-theme', next); } catch (e) {}
  });

  /* ---------- ルーティング(ハッシュ) ---------- */
  const VIEWS = ['dashboard', 'worklog', 'projects', 'ideas', 'content', 'revenue', 'convert', 'settings'];
  function currentView() {
    const h = (location.hash || '').replace('#', '');
    return VIEWS.indexOf(h) >= 0 ? h : 'dashboard';
  }
  function applyRoute() {
    const v = currentView();
    VIEWS.forEach((name) => {
      const sec = $('#view-' + name);
      if (sec) sec.classList.toggle('active', name === v);
    });
    document.querySelectorAll('#navList a').forEach((a) => {
      const active = a.dataset.view === v;
      a.classList.toggle('active', active);
      if (active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    if (v === 'convert') renderConvertSetup();
    window.scrollTo(0, 0);
  }
  window.addEventListener('hashchange', applyRoute);

  /* ---------- select群の初期化 ---------- */
  function fillSelect(sel, values, withEmpty) {
    const el = typeof sel === 'string' ? $(sel) : sel;
    el.innerHTML = (withEmpty ? '<option value="">' + esc(withEmpty) + '</option>' : '') +
      values.map((v) => '<option value="' + esc(v) + '">' + esc(v) + '</option>').join('');
  }
  function fillProjectSelect(sel, withEmpty) {
    const el = $(sel);
    const cur = el.value;
    el.innerHTML = '<option value="">' + esc(withEmpty || 'なし') + '</option>' +
      S.projects().map((p) => '<option value="' + esc(p.id) + '">' + esc(p.title) + '</option>').join('');
    el.value = cur;
  }

  fillSelect('#l-category', S.CATEGORIES);
  fillSelect('#l-content-pot', S.POTENTIALS); $('#l-content-pot').value = 'なし';
  fillSelect('#l-revenue-pot', S.POTENTIALS); $('#l-revenue-pot').value = 'なし';
  fillSelect('#p-status', S.PROJECT_STATUSES);
  fillSelect('#p-priority', S.PRIORITIES); $('#p-priority').value = '中';
  fillSelect('#p-revenue-pot', S.POTENTIALS); $('#p-revenue-pot').value = 'なし';
  fillSelect('#i-channel', S.SALES_CHANNELS);
  fillSelect('#i-status', S.IDEA_STATUSES);
  fillSelect('#c-type', S.CONTENT_TYPES);
  fillSelect('#c-status', S.CONTENT_STATUSES);
  fillSelect('#r-source', S.SALES_CHANNELS);

  /* ---------- 共通: 編集状態 ---------- */
  const editing = { log: null, project: null, idea: null, content: null };

  function openFold(id) {
    const d = $(id);
    if (d && !d.open) d.open = true;
  }

  /* =========================================================
   * Dashboard
   * ========================================================= */
  function renderDashboard() {
    const today = new Date();
    $('#d-date').textContent = today.getFullYear() + '年' + (today.getMonth() + 1) + '月' + today.getDate() + '日';

    const focus = $('#d-focus');
    if (document.activeElement !== focus) focus.value = S.settings().todayFocus || '';

    // 統計タイル
    const wk = S.weeklyOutput();
    const m = S.monthRevenue();
    const goal = Number(S.settings().monthlyGoal) || 0;
    const openTasks = S.tasks().filter((t) => t.status !== '完了').length;
    $('#d-stats').innerHTML =
      statTile('今週の記録', wk.logs + '件', 'Worklog(直近7日)') +
      statTile('今週の公開', wk.published + '件', '公開・販売にしたコンテンツ') +
      statTile('今月の売上', yen(m.total), goal ? '目標 ' + yen(goal) : '目標未設定') +
      statTile('未完了タスク', openTasks + '件', '');

    // 進行中プロジェクト
    const actives = S.projects().filter((p) => p.status === '進行中' || p.status === '停滞').slice(0, 5);
    $('#d-projects').innerHTML = actives.length ? '<div class="rows">' + actives.map((p) =>
      '<div class="rowitem">' +
        '<div class="t"><button data-jump="projects">' + esc(p.title) + '</button>' +
          '<div class="meta"><span class="tag status">' + esc(p.status) + '</span><span>優先度 ' + esc(p.priority || '中') + '</span></div></div>' +
        '<div class="side">' + esc(p.nextAction ? '次: ' + shorten(p.nextAction, 18) : '') + '</div>' +
      '</div>').join('') + '</div>' : empty('進行中のプロジェクトはありません');

    // 次にやるべきこと
    const next = S.nextActions(6);
    $('#d-next').innerHTML = next.length ? '<div class="rows">' + next.map((n) =>
      '<div class="rowitem"><div class="t">' + esc(n.text) +
        '<div class="meta">' + (n.sub ? '<span>' + esc(n.sub) + '</span>' : '') +
        '<span class="tag">優先度 ' + esc(n.priority) + '</span>' +
        (n.dueDate ? '<span>期限 ' + esc(fmtDate(n.dueDate)) + '</span>' : '') + '</div></div></div>').join('') + '</div>'
      : empty('未完了のタスクはありません');

    // 最近のWorklog
    const logs = S.worklogs().slice(0, 5);
    $('#d-logs').innerHTML = logs.length ? '<div class="rows">' + logs.map((w) =>
      '<div class="rowitem">' +
        '<div class="t"><button data-jump="worklog">' + esc(w.title) + '</button>' +
        '<div class="meta"><span class="tag">' + esc(w.category || 'その他') + '</span>' + potentialTags(w) + '</div></div>' +
        '<div class="side">' + esc(fmtDate(w.date)) + '</div>' +
      '</div>').join('') + '</div>' : empty('まだ記録がありません');

    // 収益化アイデア
    const ideas = S.ideas().slice(0, 4);
    $('#d-ideas').innerHTML = ideas.length ? '<div class="rows">' + ideas.map((i) =>
      '<div class="rowitem">' +
        '<div class="t"><button data-jump="ideas">' + esc(i.title) + '</button>' +
        '<div class="meta"><span class="tag status">' + esc(i.status) + '</span><span>売れそう度 ' + esc(i.revenueScore || '-') + ' / 作りやすさ ' + esc(i.easeScore || '-') + '</span></div></div>' +
      '</div>').join('') + '</div>' : empty('アイデアはまだありません');

    // 作成中コンテンツ
    const making = S.contentItems().filter((c) => c.status !== '公開済み' && c.status !== '販売中').slice(0, 5);
    $('#d-content').innerHTML = making.length ? '<div class="rows">' + making.map((c) =>
      '<div class="rowitem">' +
        '<div class="t"><button data-jump="content">' + esc(c.title) + '</button>' +
        '<div class="meta"><span class="tag">' + esc(c.type) + '</span><span class="tag status">' + esc(c.status) + '</span></div></div>' +
      '</div>').join('') + '</div>' : empty('作成中のコンテンツはありません');

    // 今月の収益
    $('#d-revenue').innerHTML =
      '<div class="rows">' +
        '<div class="rowitem"><div class="t">実績</div><div class="side">' + yen(m.total) + '</div></div>' +
        (goal ? '<div class="rowitem"><div class="t">目標まで</div><div class="side">' + (m.total >= goal ? '達成しています' : yen(goal - m.total)) + '</div></div>' : '') +
        m.products.slice(0, 3).map((p) =>
          '<div class="rowitem"><div class="t">' + esc(p.name) + '</div><div class="side">' + yen(p.amount) + '</div></div>').join('') +
      '</div>';
  }

  const statTile = (l, v, s) =>
    '<div class="stat"><div class="l l-jp">' + esc(l) + '</div><div class="v">' + esc(v) + '</div>' + (s ? '<div class="s">' + esc(s) + '</div>' : '') + '</div>';
  const empty = (msg) => '<p class="empty">' + esc(msg) + '</p>';
  const shorten = (s, n) => { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; };
  const potentialTags = (w) =>
    (w.contentPotential && w.contentPotential !== 'なし' ? '<span class="tag' + (w.contentPotential === '高' ? ' hot' : '') + '">コンテンツ化 ' + esc(w.contentPotential) + '</span>' : '') +
    (w.revenuePotential && w.revenuePotential !== 'なし' ? '<span class="tag' + (w.revenuePotential === '高' ? ' hot' : '') + '">収益化 ' + esc(w.revenuePotential) + '</span>' : '');

  $('#d-focus').addEventListener('change', () => {
    S.setSettings({ todayFocus: $('#d-focus').value.trim() });
    toast('今日のFocusを保存しました');
  });

  document.addEventListener('click', (e) => {
    const jump = e.target.closest('[data-jump]');
    if (jump) location.hash = jump.dataset.jump;
  });

  /* =========================================================
   * Worklog
   * ========================================================= */
  let logFilter = '';

  function renderWorklog() {
    fillProjectSelect('#l-project');

    // カテゴリフィルタ(存在するカテゴリだけ)
    const used = Array.from(new Set(S.worklogs().map((w) => w.category).filter(Boolean)));
    $('#log-filter').innerHTML =
      '<button class="chip' + (!logFilter ? ' sel' : '') + '" data-cat="">すべて</button>' +
      used.map((c) => '<button class="chip' + (logFilter === c ? ' sel' : '') + '" data-cat="' + esc(c) + '">' + esc(c) + '</button>').join('');

    const logs = S.worklogs(logFilter || undefined);
    $('#log-list').innerHTML = logs.length ? '<div class="rows">' + logs.map((w) => {
      const proj = w.projectId ? S.get('projects', w.projectId) : null;
      return '<div class="rowitem">' +
        '<div class="t">' + esc(w.title) +
          '<div class="meta"><span class="tag">' + esc(w.category || 'その他') + '</span>' +
            (proj ? '<span>' + esc(proj.title) + '</span>' : '') +
            potentialTags(w) +
            (w.tags || []).map((t) => '<span class="tag status">' + esc(t) + '</span>').join('') +
          '</div>' +
          (w.body ? '<div class="excerpt">' + esc(shorten(w.body, 90)) + '</div>' : '') +
          (w.reusableInsight ? '<div class="excerpt">知見: ' + esc(shorten(w.reusableInsight, 70)) + '</div>' : '') +
          '<div class="row-actions">' +
            '<button data-log-edit="' + esc(w.id) + '">編集</button>' +
            '<button data-log-convert="' + esc(w.id) + '">AI変換</button>' +
          '</div>' +
        '</div>' +
        '<div class="side">' + esc(fmtDate(w.date)) + '</div>' +
      '</div>';
    }).join('') + '</div>' : empty('この条件の記録はありません');
  }

  $('#log-filter').addEventListener('click', (e) => {
    const b = e.target.closest('[data-cat]');
    if (!b) return;
    logFilter = b.dataset.cat;
    renderWorklog();
  });

  $('#log-list').addEventListener('click', (e) => {
    const edit = e.target.closest('[data-log-edit]');
    if (edit) return startEditLog(edit.dataset.logEdit);
    const conv = e.target.closest('[data-log-convert]');
    if (conv) return jumpToConvert('worklog', conv.dataset.logConvert);
  });

  function startEditLog(id) {
    const w = S.get('worklogs', id);
    if (!w) return;
    editing.log = id;
    openFold('#fold-log');
    $('#l-date').value = w.date || S.todayStr();
    $('#l-title').value = w.title || '';
    $('#l-body').value = w.body || '';
    $('#l-category').value = w.category || 'その他';
    fillProjectSelect('#l-project');
    $('#l-project').value = w.projectId || '';
    $('#l-learnings').value = w.learnings || '';
    $('#l-blockers').value = w.blockers || '';
    $('#l-insight').value = w.reusableInsight || '';
    $('#l-content-pot').value = w.contentPotential || 'なし';
    $('#l-revenue-pot').value = w.revenuePotential || 'なし';
    $('#l-tags').value = (w.tags || []).join(', ');
    $('#log-submit').textContent = '更新する';
    $('#log-cancel').hidden = false;
    $('#log-delete').hidden = false;
    $('#fold-log').scrollIntoView({ block: 'start' });
  }

  function resetLogForm() {
    editing.log = null;
    $('#form-log').reset();
    $('#l-date').value = S.todayStr();
    $('#l-content-pot').value = 'なし';
    $('#l-revenue-pot').value = 'なし';
    $('#log-submit').textContent = '記録する';
    $('#log-cancel').hidden = true;
    $('#log-delete').hidden = true;
  }

  $('#form-log').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('#l-title').value.trim();
    if (!title) { toast('タイトルを入れてください'); return; }
    const data = {
      date: $('#l-date').value || S.todayStr(),
      title,
      body: $('#l-body').value.trim(),
      category: $('#l-category').value,
      projectId: $('#l-project').value,
      learnings: $('#l-learnings').value.trim(),
      blockers: $('#l-blockers').value.trim(),
      reusableInsight: $('#l-insight').value.trim(),
      contentPotential: $('#l-content-pot').value,
      revenuePotential: $('#l-revenue-pot').value,
      tags: splitTags($('#l-tags').value)
    };
    if (editing.log) { S.update('worklogs', editing.log, data); toast('記録を更新しました'); }
    else { S.add('worklogs', data); toast('記録しました'); }
    resetLogForm();
    $('#fold-log').open = false;
  });
  $('#log-cancel').addEventListener('click', resetLogForm);
  $('#log-delete').addEventListener('click', () => {
    if (editing.log && confirm('この記録を削除します。よろしいですか。')) {
      S.remove('worklogs', editing.log);
      resetLogForm();
      toast('削除しました');
    }
  });

  /* =========================================================
   * Projects
   * ========================================================= */
  function renderProjects() {
    const list = S.projects();
    $('#project-list').innerHTML = list.length ? '<div class="project-grid">' + list.map((p) => {
      const tasks = S.tasks(p.id);
      const done = p.status === '完了' || p.status === '見送り';
      return '<article class="project-card' + (done ? ' is-done' : '') + '">' +
        '<div class="head"><span class="name">' + esc(p.title) + '</span>' +
          '<span class="meta"><span class="tag status">' + esc(p.status) + '</span></span></div>' +
        (p.description ? '<p class="desc">' + esc(p.description) + '</p>' : '') +
        '<div class="kv"><span class="k">Goal</span>' + esc(p.goal || '—') + '</div>' +
        '<div class="kv"><span class="k">Next</span>' + esc(p.nextAction || '—') + '</div>' +
        '<div class="meta chip-row" style="margin:0">' +
          '<span class="tag">優先度 ' + esc(p.priority || '中') + '</span>' +
          (p.revenuePotential && p.revenuePotential !== 'なし' ? '<span class="tag' + (p.revenuePotential === '高' ? ' hot' : '') + '">収益化 ' + esc(p.revenuePotential) + '</span>' : '') +
          (p.tags || []).map((t) => '<span class="tag status">' + esc(t) + '</span>').join('') +
        '</div>' +
        '<div class="tasks">' +
          tasks.map((t) =>
            '<div class="task-line' + (t.status === '完了' ? ' done' : '') + '">' +
              '<input type="checkbox" id="tk-' + esc(t.id) + '" data-task-toggle="' + esc(t.id) + '"' + (t.status === '完了' ? ' checked' : '') + '>' +
              '<label for="tk-' + esc(t.id) + '">' + esc(t.title) + (t.dueDate ? ' <span class="tag status">' + esc(fmtDate(t.dueDate)) + '</span>' : '') + '</label>' +
            '</div>').join('') +
          '<div class="task-add">' +
            '<input type="text" placeholder="タスクを足す" data-task-input="' + esc(p.id) + '" aria-label="' + esc(p.title) + 'にタスクを追加">' +
            '<button type="button" data-task-add="' + esc(p.id) + '">追加</button>' +
          '</div>' +
        '</div>' +
        '<div class="row-actions">' +
          '<button data-project-edit="' + esc(p.id) + '">編集</button>' +
          '<button data-project-convert="' + esc(p.id) + '">次アクションをAIで出す</button>' +
        '</div>' +
      '</article>';
    }).join('') + '</div>' : empty('プロジェクトはまだありません');
  }

  $('#project-list').addEventListener('click', (e) => {
    const toggle = e.target.closest('[data-task-toggle]');
    if (toggle) {
      const t = S.get('tasks', toggle.dataset.taskToggle);
      if (t) S.update('tasks', t.id, { status: toggle.checked ? '完了' : '未着手' });
      return;
    }
    const addBtn = e.target.closest('[data-task-add]');
    if (addBtn) {
      const input = document.querySelector('[data-task-input="' + addBtn.dataset.taskAdd + '"]');
      const title = input && input.value.trim();
      if (!title) return;
      S.add('tasks', { title, description: '', status: '未着手', priority: '中', dueDate: '', projectId: addBtn.dataset.taskAdd, sourceType: '', sourceId: '' });
      toast('タスクを追加しました');
      return;
    }
    const edit = e.target.closest('[data-project-edit]');
    if (edit) return startEditProject(edit.dataset.projectEdit);
    const conv = e.target.closest('[data-project-convert]');
    if (conv) return jumpToConvert('project', conv.dataset.projectConvert, 'next-action');
  });

  $('#project-list').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('[data-task-input]')) {
      e.preventDefault();
      const btn = document.querySelector('[data-task-add="' + e.target.dataset.taskInput + '"]');
      if (btn) btn.click();
    }
  });

  function startEditProject(id) {
    const p = S.get('projects', id);
    if (!p) return;
    editing.project = id;
    openFold('#fold-project');
    $('#p-title').value = p.title || '';
    $('#p-desc').value = p.description || '';
    $('#p-status').value = p.status || '構想';
    $('#p-priority').value = p.priority || '中';
    $('#p-goal').value = p.goal || '';
    $('#p-next').value = p.nextAction || '';
    $('#p-revenue-pot').value = p.revenuePotential || 'なし';
    $('#p-tags').value = (p.tags || []).join(', ');
    $('#project-submit').textContent = '更新する';
    $('#project-cancel').hidden = false;
    $('#project-delete').hidden = false;
    $('#fold-project').scrollIntoView({ block: 'start' });
  }

  function resetProjectForm() {
    editing.project = null;
    $('#form-project').reset();
    $('#p-priority').value = '中';
    $('#p-revenue-pot').value = 'なし';
    $('#project-submit').textContent = '追加する';
    $('#project-cancel').hidden = true;
    $('#project-delete').hidden = true;
  }

  $('#form-project').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('#p-title').value.trim();
    if (!title) { toast('タイトルを入れてください'); return; }
    const data = {
      title,
      description: $('#p-desc').value.trim(),
      status: $('#p-status').value,
      priority: $('#p-priority').value,
      goal: $('#p-goal').value.trim(),
      nextAction: $('#p-next').value.trim(),
      revenuePotential: $('#p-revenue-pot').value,
      tags: splitTags($('#p-tags').value)
    };
    if (editing.project) { S.update('projects', editing.project, data); toast('プロジェクトを更新しました'); }
    else { S.add('projects', data); toast('プロジェクトを追加しました'); }
    resetProjectForm();
    $('#fold-project').open = false;
  });
  $('#project-cancel').addEventListener('click', resetProjectForm);
  $('#project-delete').addEventListener('click', () => {
    if (editing.project && confirm('このプロジェクトを削除します。タスクの紐付けも外れます。よろしいですか。')) {
      S.remove('projects', editing.project);
      resetProjectForm();
      toast('削除しました');
    }
  });

  /* =========================================================
   * Ideas
   * ========================================================= */
  function renderIdeas() {
    const list = S.ideas(true);
    $('#idea-list').innerHTML = list.length ? '<div class="panel"><div class="tbl-wrap"><table aria-label="収益化アイデア一覧">' +
      '<thead><tr><th class="jp">アイデア</th><th class="jp">状態</th><th class="jp num">作</th><th class="jp num">売</th><th class="jp num">続</th><th class="jp">チャネル</th><th class="jp">次の検証</th><th></th></tr></thead><tbody>' +
      list.map((i) =>
        '<tr>' +
          '<td><b>' + esc(i.title) + '</b>' + (i.problem ? '<div class="excerpt" style="font-size:11.5px;color:var(--ink-3)">' + esc(shorten(i.problem, 60)) + '</div>' : '') + '</td>' +
          '<td><span class="tag status">' + esc(i.status) + '</span></td>' +
          '<td class="num">' + esc(i.easeScore || '-') + '</td>' +
          '<td class="num">' + esc(i.revenueScore || '-') + '</td>' +
          '<td class="num">' + esc(i.motivationScore || '-') + '</td>' +
          '<td>' + esc(i.salesChannel || '-') + '</td>' +
          '<td style="max-width:200px">' + esc(shorten(i.nextValidationAction || '—', 40)) + '</td>' +
          '<td><div class="row-actions" style="margin:0">' +
            '<button data-idea-edit="' + esc(i.id) + '">編集</button>' +
            '<button data-idea-convert="' + esc(i.id) + '">AI変換</button>' +
          '</div></td>' +
        '</tr>').join('') +
      '</tbody></table></div>' +
      '<p class="panel-note" style="margin:10px 0 0">作=作りやすさ / 売=売れそう度 / 続=続けられそうか(いずれも1〜5)</p></div>'
      : empty('アイデアはまだありません');
  }

  $('#idea-list').addEventListener('click', (e) => {
    const edit = e.target.closest('[data-idea-edit]');
    if (edit) return startEditIdea(edit.dataset.ideaEdit);
    const conv = e.target.closest('[data-idea-convert]');
    if (conv) return jumpToConvert('idea', conv.dataset.ideaConvert);
  });

  function startEditIdea(id) {
    const i = S.get('ideas', id);
    if (!i) return;
    editing.idea = id;
    openFold('#fold-idea');
    $('#i-title').value = i.title || '';
    $('#i-problem').value = i.problem || '';
    $('#i-target').value = i.targetUser || '';
    $('#i-solution').value = i.solution || '';
    $('#i-price').value = i.priceIdea || '';
    $('#i-channel').value = i.salesChannel || 'note';
    $('#i-ease').value = i.easeScore || 3;
    $('#i-revenue').value = i.revenueScore || 3;
    $('#i-motivation').value = i.motivationScore || 3;
    $('#i-status').value = i.status || '温め中';
    $('#i-assets').value = i.requiredAssets || '';
    $('#i-next').value = i.nextValidationAction || '';
    $('#idea-submit').textContent = '更新する';
    $('#idea-cancel').hidden = false;
    $('#idea-delete').hidden = false;
    $('#fold-idea').scrollIntoView({ block: 'start' });
  }

  function resetIdeaForm() {
    editing.idea = null;
    $('#form-idea').reset();
    $('#i-ease').value = 3; $('#i-revenue').value = 3; $('#i-motivation').value = 3;
    $('#idea-submit').textContent = '追加する';
    $('#idea-cancel').hidden = true;
    $('#idea-delete').hidden = true;
  }

  const clampScore = (v) => Math.max(1, Math.min(5, Number(v) || 3));

  $('#form-idea').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('#i-title').value.trim();
    if (!title) { toast('アイデア名を入れてください'); return; }
    const data = {
      title,
      problem: $('#i-problem').value.trim(),
      targetUser: $('#i-target').value.trim(),
      solution: $('#i-solution').value.trim(),
      priceIdea: $('#i-price').value.trim(),
      salesChannel: $('#i-channel').value,
      easeScore: clampScore($('#i-ease').value),
      revenueScore: clampScore($('#i-revenue').value),
      motivationScore: clampScore($('#i-motivation').value),
      requiredAssets: $('#i-assets').value.trim(),
      nextValidationAction: $('#i-next').value.trim(),
      status: $('#i-status').value
    };
    if (editing.idea) { S.update('ideas', editing.idea, data); toast('アイデアを更新しました'); }
    else { S.add('ideas', data); toast('アイデアを追加しました'); }
    resetIdeaForm();
    $('#fold-idea').open = false;
  });
  $('#idea-cancel').addEventListener('click', resetIdeaForm);
  $('#idea-delete').addEventListener('click', () => {
    if (editing.idea && confirm('このアイデアを削除します。よろしいですか。')) {
      S.remove('ideas', editing.idea);
      resetIdeaForm();
      toast('削除しました');
    }
  });

  /* =========================================================
   * Content Pipeline
   * ========================================================= */
  function sourceLabel(c) {
    if (!c.sourceType || !c.sourceId) return '';
    const coll = c.sourceType === 'worklog' ? 'worklogs' : c.sourceType === 'idea' ? 'ideas' : 'projects';
    const src = S.get(coll, c.sourceId);
    return src ? (S.SOURCE_KINDS[c.sourceType] || '') + ': ' + src.title : '';
  }

  function renderContent() {
    const board = $('#content-board');
    const all = S.contentItems();
    if (!all.length) { board.innerHTML = empty('コンテンツはまだありません。WorklogのAI変換からも作れます'); return; }
    board.innerHTML = S.CONTENT_STATUSES.map((st) => {
      const items = all.filter((c) => c.status === st);
      if (!items.length) return '';
      return '<section class="pipe-sec">' +
        '<div class="pipe-head"><h3>' + esc(st) + '</h3><span class="n">' + items.length + '</span></div>' +
        '<div class="rows">' + items.map((c) => {
          const src = sourceLabel(c);
          return '<div class="rowitem">' +
            '<div class="t">' + esc(c.title) +
              '<div class="meta"><span class="tag">' + esc(c.type) + '</span>' +
                (src ? '<span>' + esc(src) + '</span>' : '') +
                (c.publishUrl ? '<a href="' + esc(c.publishUrl) + '" target="_blank" rel="noopener noreferrer" style="font-size:10.5px">公開先 ↗</a>' : '') +
                (c.monetizationLink ? '<a href="' + esc(c.monetizationLink) + '" target="_blank" rel="noopener noreferrer" style="font-size:10.5px">販売 ↗</a>' : '') +
              '</div>' +
              (c.mainMessage ? '<div class="excerpt">' + esc(shorten(c.mainMessage, 70)) + '</div>' : '') +
              '<div class="row-actions">' +
                '<button data-content-edit="' + esc(c.id) + '">編集</button>' +
                (c.draft ? '<button data-content-copy="' + esc(c.id) + '">下書きをコピー</button>' : '') +
              '</div>' +
            '</div>' +
            '<div class="side">' + esc(fmtDate((c.updatedAt || '').slice(0, 10))) + '</div>' +
          '</div>';
        }).join('') + '</div>' +
      '</section>';
    }).join('');
  }

  function fillContentSourceSelect() {
    const kind = $('#c-source-kind').value;
    const sel = $('#c-source-id');
    if (!kind) { sel.innerHTML = '<option value="">—</option>'; return; }
    const coll = kind === 'worklog' ? S.worklogs() : kind === 'idea' ? S.ideas(true) : S.projects();
    sel.innerHTML = '<option value="">選んでください</option>' +
      coll.map((x) => '<option value="' + esc(x.id) + '">' + esc(shorten(x.title, 30)) + '</option>').join('');
  }
  $('#c-source-kind').addEventListener('change', fillContentSourceSelect);

  $('#content-board').addEventListener('click', (e) => {
    const edit = e.target.closest('[data-content-edit]');
    if (edit) return startEditContent(edit.dataset.contentEdit);
    const copy = e.target.closest('[data-content-copy]');
    if (copy) {
      const c = S.get('content', copy.dataset.contentCopy);
      if (c && c.draft) copyText(c.draft, '下書きをコピーしました');
    }
  });

  function startEditContent(id) {
    const c = S.get('content', id);
    if (!c) return;
    editing.content = id;
    openFold('#fold-content');
    $('#c-title').value = c.title || '';
    $('#c-type').value = c.type || 'note';
    $('#c-status').value = c.status || 'ネタ';
    $('#c-source-kind').value = c.sourceType || '';
    fillContentSourceSelect();
    $('#c-source-id').value = c.sourceId || '';
    $('#c-audience').value = c.targetAudience || '';
    $('#c-message').value = c.mainMessage || '';
    $('#c-draft').value = c.draft || '';
    $('#c-url').value = c.publishUrl || '';
    $('#c-monetize').value = c.monetizationLink || '';
    $('#content-submit').textContent = '更新する';
    $('#content-cancel').hidden = false;
    $('#content-delete').hidden = false;
    $('#fold-content').scrollIntoView({ block: 'start' });
  }

  function resetContentForm() {
    editing.content = null;
    $('#form-content').reset();
    fillContentSourceSelect();
    $('#content-submit').textContent = '追加する';
    $('#content-cancel').hidden = true;
    $('#content-delete').hidden = true;
  }

  $('#form-content').addEventListener('submit', (e) => {
    e.preventDefault();
    const title = $('#c-title').value.trim();
    if (!title) { toast('タイトルを入れてください'); return; }
    const data = {
      title,
      type: $('#c-type').value,
      status: $('#c-status').value,
      sourceType: $('#c-source-kind').value,
      sourceId: $('#c-source-id').value,
      targetAudience: $('#c-audience').value.trim(),
      mainMessage: $('#c-message').value.trim(),
      draft: $('#c-draft').value,
      publishUrl: $('#c-url').value.trim(),
      monetizationLink: $('#c-monetize').value.trim()
    };
    if (editing.content) { S.update('content', editing.content, data); toast('コンテンツを更新しました'); }
    else { S.add('content', data); toast('コンテンツを追加しました'); }
    resetContentForm();
    $('#fold-content').open = false;
  });
  $('#content-cancel').addEventListener('click', resetContentForm);
  $('#content-delete').addEventListener('click', () => {
    if (editing.content && confirm('このコンテンツを削除します。よろしいですか。')) {
      S.remove('content', editing.content);
      resetContentForm();
      toast('削除しました');
    }
  });

  /* =========================================================
   * Revenue
   * ========================================================= */
  function renderRevenue() {
    const m = S.monthRevenue();
    const goal = Number(S.settings().monthlyGoal) || 0;
    const published = S.contentItems().filter((c) => c.status === '公開済み' || c.status === '販売中').length;
    const paidCandidates = S.contentItems().filter((c) => c.status === '公開済み' && !c.monetizationLink).length;
    const validating = S.ideas().filter((i) => i.status === '検証中').length;

    $('#r-stats').innerHTML =
      statTile('月間売上目標', goal ? yen(goal) : '未設定', '設定から変更できます') +
      statTile('今月の実績', yen(m.total), m.count + '件の記録') +
      statTile('達成率', goal ? Math.round((m.total / goal) * 100) + '%' : '—', '') +
      statTile('公開コンテンツ', published + '本', '') +
      statTile('有料化候補', paidCandidates + '本', '公開済みで販売導線なし') +
      statTile('検証中アイデア', validating + '件', '');

    $('#r-products').innerHTML = m.products.length ? '<div class="tbl-wrap"><table aria-label="商品別売上">' +
      '<thead><tr><th class="jp">商品</th><th class="jp num">売上</th></tr></thead><tbody>' +
      m.products.map((p) => '<tr><td>' + esc(p.name) + '</td><td class="num">' + yen(p.amount) + '</td></tr>').join('') +
      '</tbody></table></div>' : empty('今月の売上記録はまだありません');

    const hints = S.revenueHints();
    const learnings = S.worklogs().filter((w) => {
      const month = S.todayStr().slice(0, 7);
      return (w.date || '').slice(0, 7) === month && (w.learnings || w.reusableInsight);
    }).slice(0, 3);
    $('#r-improve').innerHTML =
      (hints.length ? '<div class="rows">' + hints.map((h) => '<div class="rowitem"><div class="t" style="font-weight:400;font-size:12.5px">' + esc(h) + '</div></div>').join('') + '</div>' : empty('改善候補はいまのところありません')) +
      (learnings.length ? '<div class="panel-head" style="margin-top:14px"><h3>今月の学び</h3></div><div class="rows">' +
        learnings.map((w) => '<div class="rowitem"><div class="t" style="font-weight:400;font-size:12.5px">' + esc(shorten(w.learnings || w.reusableInsight, 80)) + '<div class="meta"><span>' + esc(w.title) + '</span></div></div></div>').join('') + '</div>' : '');

    const rows = S.revenueRecords();
    $('#r-list').innerHTML = rows.length ? '<div class="tbl-wrap"><table aria-label="売上の記録">' +
      '<thead><tr><th class="jp">日付</th><th class="jp">商品</th><th class="jp">チャネル</th><th class="jp num">金額</th><th class="jp">メモ</th><th></th></tr></thead><tbody>' +
      rows.map((r) =>
        '<tr><td>' + esc(r.date) + '</td><td>' + esc(r.productName) + '</td><td>' + esc(r.source || '-') + '</td>' +
        '<td class="num">' + yen(r.amount) + '</td><td>' + esc(r.memo || '') + '</td>' +
        '<td><div class="row-actions" style="margin:0"><button data-revenue-del="' + esc(r.id) + '">削除</button></div></td></tr>').join('') +
      '</tbody></table></div>' : empty('売上の記録はまだありません');
  }

  $('#r-list').addEventListener('click', (e) => {
    const del = e.target.closest('[data-revenue-del]');
    if (del && confirm('この売上記録を削除します。よろしいですか。')) {
      S.remove('revenue', del.dataset.revenueDel);
      toast('削除しました');
    }
  });

  $('#form-revenue').addEventListener('submit', (e) => {
    e.preventDefault();
    const product = $('#r-product').value.trim();
    const amount = Number($('#r-amount').value);
    if (!product || !Number.isFinite(amount)) { toast('商品名と金額を入れてください'); return; }
    S.add('revenue', {
      date: $('#r-date').value || S.todayStr(),
      source: $('#r-source').value,
      productName: product,
      amount,
      memo: $('#r-memo').value.trim()
    });
    $('#form-revenue').reset();
    $('#r-date').value = S.todayStr();
    toast('売上を記録しました');
  });

  /* =========================================================
   * AI Convert
   * ========================================================= */
  const cv = { kind: 'worklog', recordId: '', templateId: '' };
  let cvBusy = false;
  let lastResult = null; // { result, source, kind, recordId }

  function jumpToConvert(kind, recordId, templateId) {
    cv.kind = kind;
    cv.recordId = recordId || '';
    cv.templateId = templateId || '';
    location.hash = 'convert';
    renderConvertSetup();
  }

  function cvRecords(kind) {
    if (kind === 'worklog') return S.worklogs();
    if (kind === 'idea') return S.ideas(true);
    if (kind === 'project') return S.projects();
    return [];
  }

  function renderConvertSetup() {
    $('#cv-kind').value = cv.kind;
    const recSel = $('#cv-record');
    if (cv.kind === 'week') {
      recSel.innerHTML = '<option value="">直近7日のWorklogをまとめて使います</option>';
      recSel.disabled = true;
    } else {
      recSel.disabled = false;
      const records = cvRecords(cv.kind);
      recSel.innerHTML = records.length
        ? records.map((r) => '<option value="' + esc(r.id) + '">' + esc(shorten(r.title, 36)) + '</option>').join('')
        : '<option value="">素材がまだありません</option>';
      if (cv.recordId && records.some((r) => r.id === cv.recordId)) recSel.value = cv.recordId;
      cv.recordId = recSel.value;
    }
    const tpls = AI.templatesFor(cv.kind);
    if (!tpls.some((t) => t.id === cv.templateId)) cv.templateId = tpls.length ? tpls[0].id : '';
    $('#cv-templates').innerHTML = tpls.map((t) =>
      '<button type="button" class="chip' + (t.id === cv.templateId ? ' sel' : '') + '" data-tpl="' + esc(t.id) + '" title="' + esc(t.note) + '">' + esc(t.label) + '</button>').join('');
    $('#cv-provider-note').textContent = AI.usingRemote ? '生成方式: 自前API(失敗時はテンプレートで補完)' : '生成方式: テンプレート(AI未接続でも動きます)';
  }

  $('#cv-kind').addEventListener('change', () => {
    cv.kind = $('#cv-kind').value;
    cv.recordId = '';
    renderConvertSetup();
  });
  $('#cv-record').addEventListener('change', () => { cv.recordId = $('#cv-record').value; });
  $('#cv-templates').addEventListener('click', (e) => {
    const b = e.target.closest('[data-tpl]');
    if (!b) return;
    cv.templateId = b.dataset.tpl;
    renderConvertSetup();
  });

  function buildSource() {
    if (cv.kind === 'week') {
      const since = Date.now() - 7 * 24 * 60 * 60 * 1000;
      return {
        kind: 'week',
        worklogs: S.worklogs().filter((w) => new Date(w.date).getTime() >= since)
      };
    }
    const coll = cv.kind === 'worklog' ? 'worklogs' : cv.kind === 'idea' ? 'ideas' : 'projects';
    const rec = S.get(coll, cv.recordId);
    return rec ? Object.assign({ kind: cv.kind }, rec) : null;
  }

  $('#cv-run').addEventListener('click', () => {
    if (cvBusy) return;
    const source = buildSource();
    if (!source) { toast('素材を選んでください'); return; }
    if (!cv.templateId) { toast('変換メニューを選んでください'); return; }
    cvBusy = true;
    $('#cv-result').innerHTML = '<div class="panel cv-loading">変換しています…</div>';
    AI.convert(cv.templateId, source)
      .then((result) => {
        lastResult = { result, source, kind: cv.kind, recordId: cv.kind === 'week' ? '' : cv.recordId };
        S.addAiLog({
          templateId: result.templateId, templateLabel: result.label,
          sourceType: cv.kind, sourceId: lastResult.recordId,
          sourceTitle: source.title || '直近7日のWorklog',
          provider: result.provider, ok: true
        });
        renderConvertResult();
      })
      .catch(() => {
        $('#cv-result').innerHTML = '<div class="panel cv-loading">変換できませんでした。もう一度試してください。</div>';
      })
      .finally(() => { cvBusy = false; });
  });

  const SAVE_TYPE_MAP = {
    'learning': 'note', 'note-idea': 'note', 'note-draft': 'note', 'weekly-review': 'note',
    'x-post': 'X投稿', 'lp-outline': 'LP', 'product-design': '商品説明', 'revenue-plan': '商品説明'
  };

  function renderConvertResult() {
    if (!lastResult) { $('#cv-result').innerHTML = ''; return; }
    const r = lastResult.result;
    const srcTitle = lastResult.source.title || '直近7日のWorklog';
    const actions = ['<button type="button" class="btn quiet" id="cv-copy">結果をコピー</button>'];
    if (SAVE_TYPE_MAP[r.templateId]) actions.push('<button type="button" class="btn primary" id="cv-save-content">コンテンツの下書きとして保存</button>');
    if (r.templateId === 'tasks') actions.push('<button type="button" class="btn primary" id="cv-save-tasks">タスクとして取り込む</button>');
    if (r.templateId === 'projectize') actions.push('<button type="button" class="btn primary" id="cv-save-project">プロジェクトとして追加</button>');
    if (r.templateId === 'next-action' && lastResult.kind === 'project') actions.push('<button type="button" class="btn primary" id="cv-save-next">次アクションに反映</button>');

    $('#cv-result').innerHTML =
      '<div class="cv-result-card">' +
        '<div class="cv-head">' +
          '<span class="cv-title">' + esc(r.label) + '</span>' +
          '<span class="cv-source-pick">素材: ' + esc(shorten(srcTitle, 40)) + ' / ' + (r.provider === 'remote' ? '自前API' : 'テンプレート生成') + '</span>' +
        '</div>' +
        r.sections.map((s) => '<div class="cv-sec"><div class="h">' + esc(s.h) + '</div><div class="b">' + esc(s.body) + '</div></div>').join('') +
        '<div class="form-actions">' + actions.join('') + '</div>' +
      '</div>';

    const on = (id, fn) => { const el = $(id); if (el) el.addEventListener('click', fn); };
    on('#cv-copy', () => copyText(r.text, '結果をコピーしました'));
    on('#cv-save-content', () => {
      S.add('content', {
        title: shorten(srcTitle, 24) + ' — ' + r.label,
        type: SAVE_TYPE_MAP[r.templateId] || 'note',
        status: '下書き',
        sourceType: lastResult.kind === 'week' ? '' : lastResult.kind,
        sourceId: lastResult.recordId,
        targetAudience: pickSection(r, ['想定読者', '誰向けか']),
        mainMessage: pickSection(r, ['1行まとめ', '見出しコピー', 'タイトル案']),
        draft: r.text, publishUrl: '', monetizationLink: ''
      });
      toast('Content Pipelineに下書きを保存しました');
    });
    on('#cv-save-tasks', () => {
      const body = (r.sections[0] && r.sections[0].body) || '';
      const lines = body.split('\n').map((l) => l.replace(/^[・\-\s]+/, '').trim()).filter(Boolean);
      const projectId = lastResult.kind === 'project' ? lastResult.recordId : (lastResult.source.projectId || '');
      lines.forEach((title) => S.add('tasks', {
        title, description: '', status: '未着手', priority: '中', dueDate: '',
        projectId, sourceType: lastResult.kind === 'week' ? '' : lastResult.kind, sourceId: lastResult.recordId
      }));
      toast(lines.length + '件のタスクを取り込みました');
    });
    on('#cv-save-project', () => {
      S.add('projects', {
        title: pickSection(r, ['プロジェクト名']) || shorten(srcTitle, 24),
        description: pickSection(r, ['目的']),
        status: '構想', priority: '中',
        goal: pickSection(r, ['ゴール']),
        nextAction: pickSection(r, ['次の1アクション']),
        revenuePotential: lastResult.source.revenuePotential || 'なし',
        tags: []
      });
      toast('プロジェクトとして追加しました');
    });
    on('#cv-save-next', () => {
      const next = pickSection(r, ['次の1アクション']);
      if (next && lastResult.recordId) {
        S.update('projects', lastResult.recordId, { nextAction: next });
        toast('次アクションを反映しました');
      }
    });
  }

  function pickSection(result, names) {
    for (const n of names) {
      const s = result.sections.find((x) => x.h === n);
      if (s && s.body) return s.body.split('\n')[0].replace(/^[・\-\s]+/, '').trim();
    }
    return '';
  }

  function renderConvertLog() {
    const logs = S.aiLogs().slice(0, 12);
    $('#cv-log').innerHTML = logs.length ? '<div class="rows">' + logs.map((l) =>
      '<div class="rowitem">' +
        '<div class="t" style="font-weight:400;font-size:12.5px">' + esc(l.templateLabel || l.templateId) +
          '<div class="meta"><span>' + esc(shorten(l.sourceTitle || '', 30)) + '</span><span class="tag status">' + (l.provider === 'remote' ? '自前API' : 'テンプレート') + '</span></div></div>' +
        '<div class="side">' + esc(fmtDateTime(l.at)) + '</div>' +
      '</div>').join('') + '</div>' : empty('まだ実行していません');
  }

  /* =========================================================
   * Settings
   * ========================================================= */
  function renderSettings() {
    if (document.activeElement !== $('#s-goal')) $('#s-goal').value = S.settings().monthlyGoal || '';
    try {
      $('#s-provider').value = localStorage.getItem('growth:provider') || 'mock';
      $('#s-endpoint').value = localStorage.getItem('growth:endpoint') || '';
    } catch (e) {}
  }

  $('#form-settings').addEventListener('submit', (e) => {
    e.preventDefault();
    S.setSettings({ monthlyGoal: Number($('#s-goal').value) || 0 });
    toast('目標を保存しました');
  });

  $('#form-ai').addEventListener('submit', (e) => {
    e.preventDefault();
    try {
      localStorage.setItem('growth:provider', $('#s-provider').value);
      localStorage.setItem('growth:endpoint', $('#s-endpoint').value.trim());
      toast('AI接続の設定を保存しました');
      renderConvertSetup();
    } catch (err) {
      toast('保存できませんでした');
    }
  });

  $('#s-export').addEventListener('click', () => {
    const blob = new Blob([S.exportJson()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'growth-os-' + S.todayStr() + '.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });
  $('#s-import').addEventListener('click', () => $('#s-import-file').click());
  $('#s-import-file').addEventListener('change', () => {
    const file = $('#s-import-file').files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        S.importJson(String(reader.result));
        toast('インポートしました');
      } catch (e) {
        toast('読み込めませんでした。Growth OSでエクスポートしたJSONか確認してください');
      }
      $('#s-import-file').value = '';
    };
    reader.readAsText(file);
  });
  $('#s-reset').addEventListener('click', () => {
    if (confirm('いまのデータをすべて消して、デモデータに戻します。よろしいですか。')) {
      S.resetAll();
      toast('デモデータに戻しました');
    }
  });

  /* =========================================================
   * 右サイドパネル
   * ========================================================= */
  function renderSidePanel() {
    const focus = S.settings().todayFocus;
    $('#side-focus').innerHTML = focus
      ? '<p class="side-focus-text">' + esc(focus) + '</p>'
      : '<p class="side-empty">Dashboardで今日のFocusを1つ決められます</p>';

    const next = S.nextActions(5);
    $('#side-next').innerHTML = next.length ? next.map((n) =>
      '<div class="side-item">' + esc(n.text) + (n.sub ? '<span class="s">' + esc(n.sub) + '</span>' : '') + '</div>').join('')
      : '<p class="side-empty">未完了のタスクはありません</p>';

    const sugg = S.suggestions();
    $('#side-ai').innerHTML = sugg.length ? sugg.map((s) =>
      '<div class="side-item"><button data-sugg-kind="' + esc(s.kind) + '" data-sugg-id="' + esc(s.id) + '">' + esc(s.text) + '</button></div>').join('')
      : '<p class="side-empty">いまのところ提案はありません</p>';

    const hints = S.revenueHints();
    $('#side-revenue').innerHTML = hints.length ? hints.map((h) =>
      '<div class="side-item">' + esc(h) + '</div>').join('')
      : '<p class="side-empty">収益のヒントはまだありません</p>';

    const recent = S.worklogs().slice(0, 4);
    $('#side-recent').innerHTML = recent.length ? recent.map((w) =>
      '<div class="side-item">' + esc(shorten(w.title, 26)) + '<span class="s">' + esc(fmtDate(w.date)) + ' · ' + esc(w.category || '') + '</span></div>').join('')
      : '<p class="side-empty">まだ記録がありません</p>';
  }

  $('#side-ai').addEventListener('click', (e) => {
    const b = e.target.closest('[data-sugg-kind]');
    if (b) jumpToConvert(b.dataset.suggKind, b.dataset.suggId);
  });

  /* =========================================================
   * 全体描画・初期化
   * ========================================================= */
  function renderAll() {
    renderDashboard();
    renderWorklog();
    renderProjects();
    renderIdeas();
    renderContent();
    renderRevenue();
    renderConvertLog();
    renderSettings();
    renderSidePanel();
    fillContentSourceSelect();
  }

  S.init();
  $('#l-date').value = S.todayStr();
  $('#r-date').value = S.todayStr();
  S.subscribe(renderAll);
  renderAll();
  renderConvertSetup();
  applyRoute();
})();
