/* 段取りメーカー — app
 * すべて端末内で完結する。外部送信なし。保存はlocalStorageのみ。
 */
(function () {
  'use strict';

  var KEY = 'bridge-dandori-v1';
  var state = null; // { type, dday, tasks: [{ id, ph, name, note, off, due, memo, done, custom, man }] }
  var pendingType = null;

  /* ---------- ユーティリティ ---------- */

  var $ = function (id) { return document.getElementById(id); };

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {}
  }
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var s = JSON.parse(raw);
      if (!s || !s.type || !s.dday || !Array.isArray(s.tasks)) return null;
      return s;
    } catch (e) { return null; }
  }
  function clearSaved() {
    try { localStorage.removeItem(KEY); } catch (e) {}
  }

  function typeOf(id) {
    for (var i = 0; i < DANDORI_TYPES.length; i++) {
      if (DANDORI_TYPES[i].id === id) return DANDORI_TYPES[i];
    }
    return null;
  }

  /* 日付は「YYYY-MM-DD」の文字列で持つ。タイムゾーンのずれを避けるため正午で計算する */
  function toDate(iso) { return new Date(iso + 'T12:00:00'); }
  function toIso(d) {
    var m = String(d.getMonth() + 1), day = String(d.getDate());
    return d.getFullYear() + '-' + (m.length < 2 ? '0' + m : m) + '-' + (day.length < 2 ? '0' + day : day);
  }
  function addDays(iso, n) {
    var d = toDate(iso);
    d.setDate(d.getDate() + n);
    return toIso(d);
  }
  /* 土日は直前の平日へ前倒し */
  function pullWeekday(iso) {
    var d = toDate(iso);
    while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() - 1);
    return toIso(d);
  }
  function fmt(iso) {
    var p = iso.split('-');
    return p[0] + '/' + p[1] + '/' + p[2];
  }
  function daysBetween(a, b) {
    return Math.round((toDate(b) - toDate(a)) / 86400000);
  }

  function toast(msg) {
    var el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
  }

  /* ---------- ビュー切替 ---------- */

  function show(id) {
    var views = document.querySelectorAll('.view');
    for (var i = 0; i < views.length; i++) views[i].classList.remove('on');
    $(id).classList.add('on');
    window.scrollTo(0, 0);
  }

  /* ---------- 生成 ---------- */

  function generate(typeId, dday) {
    var t = typeOf(typeId);
    var tasks = [];
    for (var i = 0; i < t.tasks.length; i++) {
      var src = t.tasks[i];
      tasks.push({
        id: 't' + i,
        ph: src.ph,
        name: src.name,
        note: src.note || '',
        off: src.off,
        due: pullWeekday(addDays(dday, src.off)),
        memo: '',
        done: false,
        custom: false,
        man: false,
      });
    }
    state = { v: 1, type: typeId, dday: dday, seq: t.tasks.length, tasks: tasks };
    save();
  }

  /* 本番日の変更:表全体をずらす。手で直した期限は日数差だけ平行移動する */
  function shiftDday(newDday) {
    var delta = daysBetween(state.dday, newDday);
    if (!delta) { state.dday = newDday; save(); return; }
    for (var i = 0; i < state.tasks.length; i++) {
      var task = state.tasks[i];
      if (!task.man && task.off !== null && task.off !== undefined) {
        task.due = pullWeekday(addDays(newDday, task.off));
      } else {
        task.due = addDays(task.due, delta);
      }
    }
    state.dday = newDday;
    save();
  }

  /* ---------- 段取り表の描画 ---------- */

  function renderPlan() {
    var t = typeOf(state.type);
    $('plan-title').textContent = t.name + 'の段取り表';
    $('plan-dday-label').textContent = t.dlabel;
    $('plan-dday-input').value = state.dday;
    renderCount();

    var body = $('plan-body');
    body.innerHTML = '';
    for (var p = 0; p < t.phases.length; p++) {
      body.appendChild(renderPhase(t, t.phases[p], p));
    }
  }

  function renderCount() {
    var done = 0;
    for (var i = 0; i < state.tasks.length; i++) if (state.tasks[i].done) done++;
    $('plan-count').textContent = state.tasks.length + '項目中 ' + done + '件完了';
  }

  function renderPhase(t, phase, index) {
    var sec = document.createElement('section');
    sec.className = 'phase';
    var head = document.createElement('h3');
    head.className = 'phase-h';
    head.innerHTML = '<span class="n">' + String(index + 1).padStart(2, '0') + '</span>' + phase.title;
    sec.appendChild(head);

    var list = document.createElement('div');
    list.className = 'phase-list';
    for (var i = 0; i < state.tasks.length; i++) {
      if (state.tasks[i].ph === phase.id) list.appendChild(renderRow(state.tasks[i]));
    }
    sec.appendChild(list);

    var add = document.createElement('button');
    add.type = 'button';
    add.className = 'add-row';
    add.textContent = '+ 行を足す';
    add.addEventListener('click', function () {
      var task = {
        id: 'c' + (state.seq++),
        ph: phase.id,
        name: '',
        note: '',
        off: null,
        due: state.dday,
        memo: '',
        done: false,
        custom: true,
        man: true,
      };
      state.tasks.push(task);
      save();
      var row = renderRow(task);
      list.appendChild(row);
      renderCount();
      var input = row.querySelector('.name-input');
      if (input) input.focus();
    });
    sec.appendChild(add);
    return sec;
  }

  function renderRow(task) {
    var row = document.createElement('div');
    row.className = 'task-row' + (task.done ? ' done' : '');
    row.setAttribute('data-id', task.id);

    /* チェック */
    var tick = document.createElement('button');
    tick.type = 'button';
    tick.className = 'tick';
    tick.setAttribute('aria-label', '完了にする');
    tick.setAttribute('aria-pressed', task.done ? 'true' : 'false');
    tick.innerHTML = '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 7.5 L5.5 10.5 L11.5 3.5"/></svg>';
    tick.addEventListener('click', function () {
      task.done = !task.done;
      row.classList.toggle('done', task.done);
      tick.setAttribute('aria-pressed', task.done ? 'true' : 'false');
      save();
      renderCount();
    });
    row.appendChild(tick);

    /* 本文 */
    var main = document.createElement('div');
    main.className = 'task-main';
    if (task.custom) {
      var nameInput = document.createElement('input');
      nameInput.type = 'text';
      nameInput.className = 'name-input';
      nameInput.placeholder = '自院のタスクを書く';
      nameInput.value = task.name;
      nameInput.addEventListener('input', function () { task.name = nameInput.value; save(); });
      main.appendChild(nameInput);
    } else {
      var name = document.createElement('div');
      name.className = 'task-name';
      name.textContent = task.name;
      main.appendChild(name);
      if (task.note) {
        var note = document.createElement('div');
        note.className = 'task-note';
        note.textContent = task.note;
        main.appendChild(note);
      }
    }
    var memo = document.createElement('input');
    memo.type = 'text';
    memo.className = 'memo';
    memo.placeholder = 'メモ(担当・確認結果など)';
    memo.value = task.memo;
    memo.classList.toggle('has-note', !!task.memo);
    memo.addEventListener('input', function () {
      task.memo = memo.value;
      memo.classList.toggle('has-note', !!task.memo);
      save();
    });
    main.appendChild(memo);
    row.appendChild(main);

    /* 期限と削除 */
    var side = document.createElement('div');
    side.className = 'task-side';
    var due = document.createElement('input');
    due.type = 'date';
    due.className = 'due';
    due.value = task.due;
    due.setAttribute('aria-label', '期限');
    due.addEventListener('change', function () {
      if (!due.value) { due.value = task.due; return; }
      task.due = due.value;
      task.man = true;
      save();
    });
    side.appendChild(due);
    var del = document.createElement('button');
    del.type = 'button';
    del.className = 'del';
    del.setAttribute('aria-label', 'この行を削除');
    del.innerHTML = '<svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="M2 2 L10 10 M10 2 L2 10"/></svg>';
    del.addEventListener('click', function () {
      for (var i = 0; i < state.tasks.length; i++) {
        if (state.tasks[i].id === task.id) { state.tasks.splice(i, 1); break; }
      }
      save();
      row.remove();
      renderCount();
      toast('行を削除しました');
    });
    side.appendChild(del);
    row.appendChild(side);

    return row;
  }

  /* ---------- 書き出し ---------- */

  function exportCsv() {
    var t = typeOf(state.type);
    var lines = [['フェーズ', '期限', 'タスク', '確認先・補足', 'メモ', '完了']];
    for (var p = 0; p < t.phases.length; p++) {
      for (var i = 0; i < state.tasks.length; i++) {
        var task = state.tasks[i];
        if (task.ph !== t.phases[p].id) continue;
        lines.push([t.phases[p].title, fmt(task.due), task.name, task.note, task.memo, task.done ? '済' : '']);
      }
    }
    var csv = '\ufeff' + lines.map(function (cols) {
      return cols.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(',');
    }).join('\r\n');
    var blob = new Blob([csv], { type: 'text/csv' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'dandori-' + state.type + '-' + state.dday + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    toast('CSVを書き出しました');
  }

  function printPlan() {
    var t = typeOf(state.type);
    $('print-title').textContent = t.name + 'の段取り表';
    $('print-meta').textContent = t.dlabel + ' ' + fmt(state.dday) + ' — 段取りメーカー(BRIDGE)で作成。期限は目安。届出の要否・期限は所管窓口へ確認';
    window.print();
  }

  /* ---------- 画面の組み立て ---------- */

  function renderTypeList() {
    var list = $('type-list');
    list.innerHTML = '';
    DANDORI_TYPES.forEach(function (t) {
      var btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'role-item type-item';
      btn.innerHTML = '<span class="type-main"><span class="type-name">' + t.name + '</span><span class="type-desc">' + t.desc + '</span></span><span class="arrow">→</span>';
      btn.addEventListener('click', function () {
        pendingType = t.id;
        $('date-h2').textContent = t.dlabel + 'はいつですか';
        $('dday-label').textContent = t.dlabel;
        $('date-hint').textContent = t.dateHint;
        $('dday-input').value = '';
        $('date-go').disabled = true;
        show('view-date');
      });
      list.appendChild(btn);
    });
  }

  function startPlan() {
    renderPlan();
    show('view-plan');
  }

  function init() {
    /* テーマ切替 */
    $('themeBtn').addEventListener('click', function () {
      var cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', cur);
      try { localStorage.setItem('bridge-theme', cur); } catch (e) {}
    });

    renderTypeList();

    var saved = load();
    if (saved) {
      state = saved;
      $('intro-start').hidden = true;
      $('intro-continue').hidden = false;
      $('intro-restart').hidden = false;
    }

    $('intro-start').addEventListener('click', function () { show('view-type'); });
    $('intro-continue').addEventListener('click', function () { startPlan(); });
    $('intro-restart').addEventListener('click', function () {
      if (!confirm('いまの段取り表を、チェックとメモごと消して、新しくつくり直しますか。')) return;
      clearSaved();
      state = null;
      $('intro-start').hidden = false;
      $('intro-continue').hidden = true;
      $('intro-restart').hidden = true;
      show('view-type');
    });

    $('type-back').addEventListener('click', function () { show('view-intro'); });
    $('date-back').addEventListener('click', function () { show('view-type'); });

    $('dday-input').addEventListener('change', function () {
      $('date-go').disabled = !$('dday-input').value;
    });
    $('date-go').addEventListener('click', function () {
      var v = $('dday-input').value;
      if (!v) return;
      generate(pendingType, v);
      startPlan();
    });

    $('plan-dday-input').addEventListener('change', function () {
      var v = $('plan-dday-input').value;
      if (!v) { $('plan-dday-input').value = state.dday; return; }
      shiftDday(v);
      renderPlan();
      toast('表全体の期限を動かしました');
    });

    $('plan-print').addEventListener('click', printPlan);
    $('plan-csv').addEventListener('click', exportCsv);
    $('plan-reset').addEventListener('click', function () {
      if (!confirm('いまの段取り表を、チェックとメモごと消して、新しくつくり直しますか。')) return;
      clearSaved();
      state = null;
      $('intro-start').hidden = false;
      $('intro-continue').hidden = true;
      $('intro-restart').hidden = true;
      show('view-type');
    });

    show('view-intro');
  }

  init();
})();
