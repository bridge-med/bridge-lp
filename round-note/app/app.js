/* =========================================================================
 * RoundNote — app.js
 * 画面描画とイベント処理。データの読み書きは store.js の Store を経由する。
 * 画面: home(全施設ダッシュボード) / facility(施設詳細) / agenda(巡回アジェンダ)
 * ========================================================================= */
(function () {
  'use strict';

  var app = document.getElementById('app');
  var toastEl = document.getElementById('toast');
  var toastTimer = null;

  /** 画面状態(データは持たない。データは Store が正) */
  var view = {
    name: 'home',          // 'home' | 'facility' | 'agenda'
    facilityId: null,
    tab: 'task',           // 施設詳細のタブ
    addingFacility: false, // 施設追加フォームの開閉
    editingFacility: false // 施設情報の編集フォームの開閉
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

  /** ISO日時 → "M/D" */
  function shortDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso);
    return (d.getMonth() + 1) + '/' + d.getDate();
  }

  function ownerChip(it) {
    var o = Store.OWNERS[it.owner] || Store.OWNERS.site;
    return '<span class="chip chip-owner chip-' + esc(it.owner) + '">' + esc(o.label) + '</span>';
  }

  function dueChip(it) {
    if (it.done) return '';
    if (Store.isOverdue(it)) return '<span class="chip chip-due overdue">' + esc(Store.dueLabel(it.due)) + ' 超過</span>';
    if (Store.isDueSoon(it)) return '<span class="chip chip-due soon">' + esc(Store.dueLabel(it.due)) + '</span>';
    return '<span class="chip chip-due">' + esc(Store.dueLabel(it.due)) + '</span>';
  }

  // ---- 描画: ホーム ----------------------------------------------------------
  function renderHome() {
    var c = Store.counts();
    var follows = Store.followUps();
    var fs = Store.facilities();
    var h = '';

    h += '<header class="head">';
    h += '  <div class="head-eyebrow">ROUNDNOTE</div>';
    h += '  <h1 class="head-title">本部長の巡回手帖</h1>';
    h += '  <p class="head-sub">施設ごとの宿題・決定・気づきを1冊に。<br>「あれ、どうなった?」を、なくす。</p>';
    h += '</header>';

    if (!Store.hasData()) {
      h += '<section class="card empty-card">';
      h += '  <p class="empty-title">まだ何も記録されていません。</p>';
      h += '  <p class="empty-text">担当している施設を登録すると、巡回や月次レビューで出た宿題・決定事項・気づきを施設ごとに記録できます。まずはサンプルデータで動きを見るのがおすすめです。</p>';
      h += '  <button class="btn btn-secondary" data-action="seed">サンプルデータを入れてみる</button>';
      h += '</section>';
    } else {
      h += '<section class="kpi-row">';
      h += '  <div class="kpi"><div class="kpi-num">' + c.facilities + '</div><div class="kpi-label">施設</div></div>';
      h += '  <div class="kpi"><div class="kpi-num">' + c.openTasks + '</div><div class="kpi-label">未完了の宿題</div></div>';
      h += '  <div class="kpi' + (c.overdue ? ' alert' : '') + '"><div class="kpi-num">' + c.overdue + '</div><div class="kpi-label">期限超過</div></div>';
      h += '</section>';

      if (follows.length) {
        h += '<section class="sec">';
        h += '  <h2 class="sec-title"><span class="sec-ico">🔥</span>要フォロー <small>期限超過・7日以内</small></h2>';
        h += '  <div class="card list-card">';
        follows.forEach(function (it) {
          var f = Store.facility(it.facilityId);
          h += '<button class="row row-follow" data-action="open-facility" data-id="' + esc(it.facilityId) + '">';
          h += '  <div class="row-main"><div class="row-text">' + esc(it.text) + '</div>';
          h += '  <div class="row-meta"><span class="chip chip-facility">' + esc(f ? f.name : '?') + '</span>' + ownerChip(it) + dueChip(it) + '</div></div>';
          h += '  <span class="row-arrow">→</span>';
          h += '</button>';
        });
        h += '  </div>';
        h += '</section>';
      }

      h += '<section class="sec">';
      h += '  <h2 class="sec-title"><span class="sec-ico">🏥</span>施設</h2>';
      h += '  <div class="facility-grid">';
      fs.forEach(function (f) {
        var open = Store.openTasks(f.id);
        var overdue = open.filter(Store.isOverdue).length;
        var last = Store.lastActivity(f.id);
        h += '<button class="facility-card" data-action="open-facility" data-id="' + esc(f.id) + '">';
        h += '  <div class="facility-kind">' + esc(f.kind) + '</div>';
        h += '  <div class="facility-name">' + esc(f.name) + '</div>';
        h += '  <div class="facility-leader">' + (f.leader ? esc(f.leader) + ' さん' : '施設長 未登録') + '</div>';
        h += '  <div class="facility-foot">';
        h += '    <span class="chip' + (overdue ? ' chip-alert' : '') + '">宿題 ' + open.length + (overdue ? ' <b>(超過' + overdue + ')</b>' : '') + '</span>';
        h += '    <span class="facility-last">最終記録 ' + shortDate(last) + '</span>';
        h += '  </div>';
        h += '</button>';
      });
      h += '  </div>';
      h += '</section>';
    }

    // 施設追加
    h += '<section class="sec">';
    if (view.addingFacility) {
      h += '<form class="card form-card" data-form="add-facility">';
      h += '  <h3 class="form-title">施設を追加</h3>';
      h += '  <label class="field"><span class="field-label">施設名 <i>必須</i></span><input class="input" name="name" maxlength="40" placeholder="例: 青葉台整形外科クリニック" required></label>';
      h += '  <label class="field"><span class="field-label">施設長・責任者</span><input class="input" name="leader" maxlength="20" placeholder="例: 田中"></label>';
      h += '  <label class="field"><span class="field-label">種別</span><select class="input" name="kind">';
      Store.KINDS.forEach(function (k) { h += '<option value="' + esc(k) + '">' + esc(k) + '</option>'; });
      h += '  </select></label>';
      h += '  <div class="form-btns"><button type="submit" class="btn btn-primary btn-sm">追加する</button>';
      h += '  <button type="button" class="btn btn-ghost btn-sm" data-action="cancel-add-facility">やめる</button></div>';
      h += '</form>';
    } else {
      h += '<button class="btn btn-outline" data-action="show-add-facility">+ 施設を追加する</button>';
    }
    h += '</section>';

    // フッター
    h += '<footer class="foot">';
    h += '  <div class="foot-btns">';
    if (!Store.hasData()) {
      h += '<button class="link-btn" data-action="seed">サンプルデータを入れる</button>';
    } else {
      h += '<button class="link-btn danger" data-action="clear-all">全データを削除</button>';
    }
    h += '  </div>';
    h += '  <p class="foot-note">データはこの端末のブラウザにのみ保存されます(登録不要・送信なし)。</p>';
    h += '  <a class="foot-brand" href="../index.html">BRIDGE — A Small Medical Studio</a>';
    h += '</footer>';

    return h;
  }

  // ---- 描画: 施設詳細 --------------------------------------------------------
  function renderFacility() {
    var f = Store.facility(view.facilityId);
    if (!f) { view.name = 'home'; return renderHome(); }

    var h = '';
    h += '<header class="head head-sub-page">';
    h += '  <button class="link-btn back" data-action="go-home">← 施設一覧へ</button>';
    h += '  <div class="facility-kind">' + esc(f.kind) + '</div>';
    h += '  <h1 class="head-title sm">' + esc(f.name) + '</h1>';
    h += '  <p class="head-sub">' + (f.leader ? esc(f.leader) + ' さん' : '施設長 未登録') + '</p>';
    h += '  <div class="head-actions">';
    h += '    <button class="btn btn-primary" data-action="open-agenda">📋 今日の巡回アジェンダを作る</button>';
    h += '    <button class="link-btn" data-action="toggle-edit-facility">' + (view.editingFacility ? '編集を閉じる' : '施設情報を編集') + '</button>';
    h += '  </div>';
    h += '</header>';

    if (view.editingFacility) {
      h += '<form class="card form-card" data-form="edit-facility">';
      h += '  <h3 class="form-title">施設情報を編集</h3>';
      h += '  <label class="field"><span class="field-label">施設名</span><input class="input" name="name" maxlength="40" value="' + esc(f.name) + '" required></label>';
      h += '  <label class="field"><span class="field-label">施設長・責任者</span><input class="input" name="leader" maxlength="20" value="' + esc(f.leader) + '"></label>';
      h += '  <label class="field"><span class="field-label">種別</span><select class="input" name="kind">';
      Store.KINDS.forEach(function (k) {
        h += '<option value="' + esc(k) + '"' + (k === f.kind ? ' selected' : '') + '>' + esc(k) + '</option>';
      });
      h += '  </select></label>';
      h += '  <div class="form-btns"><button type="submit" class="btn btn-primary btn-sm">保存する</button>';
      h += '  <button type="button" class="link-btn danger" data-action="remove-facility">この施設を削除</button></div>';
      h += '</form>';
    }

    // タブ
    var tabs = [
      { key: 'task', label: '📌 宿題' },
      { key: 'decision', label: '🤝 決定事項' },
      { key: 'note', label: '👀 気づき' }
    ];
    h += '<nav class="tabs" role="tablist">';
    tabs.forEach(function (t) {
      var count = t.key === 'task'
        ? Store.openTasks(f.id).length
        : Store.itemsFor(f.id, t.key).length;
      h += '<button class="tab' + (view.tab === t.key ? ' on' : '') + '" role="tab" aria-selected="' + (view.tab === t.key) + '" data-action="tab" data-tab="' + t.key + '">' + t.label + '<span class="tab-count">' + count + '</span></button>';
    });
    h += '</nav>';

    // 追加フォーム(タブに応じて変化)
    h += '<form class="card form-card add-item-form" data-form="add-item">';
    if (view.tab === 'task') {
      h += '<label class="field"><span class="field-label">宿題を追加 <i>誰が・何を・いつまでに</i></span>';
      h += '<input class="input" name="text" maxlength="120" placeholder="例: リハ室の予約枠見直し案を作る" required></label>';
      h += '<div class="field-row">';
      h += '  <div class="seg" role="radiogroup" aria-label="担当">';
      h += '    <label class="seg-btn"><input type="radio" name="owner" value="site" checked><span>施設側</span></label>';
      h += '    <label class="seg-btn"><input type="radio" name="owner" value="hq"><span>本部側</span></label>';
      h += '  </div>';
      h += '  <input class="input input-date" type="date" name="due" aria-label="期限">';
      h += '</div>';
      h += '<div class="due-chips">';
      h += '  <button type="button" class="chip chip-btn" data-action="due-quick" data-days="7">1週間後</button>';
      h += '  <button type="button" class="chip chip-btn" data-action="due-quick" data-days="14">2週間後</button>';
      h += '  <button type="button" class="chip chip-btn" data-action="due-quick" data-days="30">1か月後</button>';
      h += '  <button type="button" class="chip chip-btn" data-action="due-quick" data-days="">期限なし</button>';
      h += '</div>';
    } else if (view.tab === 'decision') {
      h += '<label class="field"><span class="field-label">決定事項を追加 <i>会議・巡回で決めたこと</i></span>';
      h += '<input class="input" name="text" maxlength="120" placeholder="例: 朝礼では単位数ではなく実施率を共有する" required></label>';
    } else {
      h += '<label class="field"><span class="field-label">気づきを追加 <i>現場で見たこと・聞いたこと</i></span>';
      h += '<input class="input" name="text" maxlength="120" placeholder="例: 受付の掲示物が古いまま。次回相談" required></label>';
    }
    h += '<div class="form-btns"><button type="submit" class="btn btn-primary btn-sm">記録する</button></div>';
    h += '</form>';

    // リスト
    if (view.tab === 'task') {
      var open = Store.openTasks(f.id);
      var done = Store.itemsFor(f.id, 'task').filter(function (it) { return it.done; });
      h += renderTaskList(open, '未完了の宿題はありません。身軽です。');
      if (done.length) {
        h += '<details class="done-fold"><summary>完了した宿題 (' + done.length + ')</summary>';
        h += renderTaskList(done, '');
        h += '</details>';
      }
    } else {
      var list = Store.itemsFor(f.id, view.tab);
      if (!list.length) {
        h += '<p class="empty-text center">まだ記録がありません。</p>';
      } else {
        h += '<div class="card list-card">';
        list.forEach(function (it) {
          h += '<div class="row">';
          h += '  <div class="row-main"><div class="row-text">' + esc(it.text) + '</div>';
          h += '  <div class="row-meta"><span class="chip">' + shortDate(it.createdAt) + ' 記録</span></div></div>';
          h += '  <button class="row-del" data-action="remove-item" data-id="' + esc(it.id) + '" aria-label="削除">×</button>';
          h += '</div>';
        });
        h += '</div>';
      }
    }

    return h;
  }

  function renderTaskList(list, emptyMsg) {
    if (!list.length) return emptyMsg ? '<p class="empty-text center">' + esc(emptyMsg) + '</p>' : '';
    var h = '<div class="card list-card">';
    list.forEach(function (it) {
      h += '<div class="row' + (it.done ? ' is-done' : '') + '">';
      h += '  <button class="row-check" data-action="toggle-task" data-id="' + esc(it.id) + '" aria-label="' + (it.done ? '未完了に戻す' : '完了にする') + '">' + (it.done ? '✓' : '') + '</button>';
      h += '  <div class="row-main"><div class="row-text">' + esc(it.text) + '</div>';
      h += '  <div class="row-meta">' + ownerChip(it) + dueChip(it) + '</div></div>';
      h += '  <button class="row-del" data-action="remove-item" data-id="' + esc(it.id) + '" aria-label="削除">×</button>';
      h += '</div>';
    });
    h += '</div>';
    return h;
  }

  // ---- 描画: 巡回アジェンダ ---------------------------------------------------
  /** アジェンダの中身を組み立てる(表示とコピーの共通データ) */
  function buildAgenda(f) {
    var open = Store.openTasks(f.id);
    var decisions = Store.itemsFor(f.id, 'decision').slice(0, 5);
    var notes = Store.itemsFor(f.id, 'note').slice(0, 5);
    return { open: open, decisions: decisions, notes: notes };
  }

  function agendaText(f, a) {
    var lines = [];
    lines.push('■ 巡回アジェンダ — ' + f.name + (f.leader ? '(' + f.leader + 'さん)' : ''));
    lines.push('日付: ' + Store.dueLabel(Store.todayStr()));
    lines.push('');
    lines.push('1. 前回からの宿題の確認');
    if (a.open.length) {
      a.open.forEach(function (it) {
        var owner = (Store.OWNERS[it.owner] || Store.OWNERS.site).label;
        lines.push('  □ [' + owner + '] ' + it.text + (it.due ? '(期限 ' + Store.dueLabel(it.due) + (Store.isOverdue(it) ? '・超過' : '') + ')' : ''));
      });
    } else {
      lines.push('  ・未完了の宿題なし');
    }
    lines.push('');
    lines.push('2. 決めたことの定着確認');
    if (a.decisions.length) {
      a.decisions.forEach(function (it) { lines.push('  ・' + it.text); });
    } else {
      lines.push('  ・直近の決定事項なし');
    }
    lines.push('');
    lines.push('3. 前回の気づき・今回見ること');
    if (a.notes.length) {
      a.notes.forEach(function (it) { lines.push('  ・' + it.text); });
    } else {
      lines.push('  ・記録された気づきなし');
    }
    lines.push('');
    lines.push('4. 現場からの相談(その場で記入)');
    lines.push('');
    lines.push('— RoundNote(本部長の巡回手帖)で作成');
    return lines.join('\n');
  }

  function renderAgenda() {
    var f = Store.facility(view.facilityId);
    if (!f) { view.name = 'home'; return renderHome(); }
    var a = buildAgenda(f);

    var h = '';
    h += '<header class="head head-sub-page">';
    h += '  <button class="link-btn back" data-action="open-facility" data-id="' + esc(f.id) + '">← ' + esc(f.name) + ' へ戻る</button>';
    h += '  <div class="head-eyebrow">TODAY\'S ROUND</div>';
    h += '  <h1 class="head-title sm">今日の巡回アジェンダ</h1>';
    h += '  <p class="head-sub">' + esc(f.name) + (f.leader ? ' / ' + esc(f.leader) + ' さん' : '') + ' — ' + esc(Store.dueLabel(Store.todayStr())) + '</p>';
    h += '</header>';

    h += '<section class="card agenda-card">';
    h += '<div class="agenda-sec"><h3 class="agenda-h"><span class="agenda-num">1</span>前回からの宿題の確認</h3>';
    if (a.open.length) {
      h += '<ul class="agenda-list">';
      a.open.forEach(function (it) {
        h += '<li class="agenda-item">☐ ' + ownerChip(it) + ' ' + esc(it.text) + (it.due ? ' <small>' + esc(Store.dueLabel(it.due)) + (Store.isOverdue(it) ? '・<b class="ov">超過</b>' : '') + '</small>' : '') + '</li>';
      });
      h += '</ul>';
    } else {
      h += '<p class="agenda-empty">未完了の宿題なし。よい状態です。</p>';
    }
    h += '</div>';

    h += '<div class="agenda-sec"><h3 class="agenda-h"><span class="agenda-num">2</span>決めたことの定着確認</h3>';
    if (a.decisions.length) {
      h += '<ul class="agenda-list">';
      a.decisions.forEach(function (it) { h += '<li class="agenda-item">・' + esc(it.text) + '</li>'; });
      h += '</ul>';
    } else {
      h += '<p class="agenda-empty">直近の決定事項なし。</p>';
    }
    h += '</div>';

    h += '<div class="agenda-sec"><h3 class="agenda-h"><span class="agenda-num">3</span>前回の気づき・今回見ること</h3>';
    if (a.notes.length) {
      h += '<ul class="agenda-list">';
      a.notes.forEach(function (it) { h += '<li class="agenda-item">・' + esc(it.text) + '</li>'; });
      h += '</ul>';
    } else {
      h += '<p class="agenda-empty">記録された気づきなし。</p>';
    }
    h += '</div>';

    h += '<div class="agenda-sec"><h3 class="agenda-h"><span class="agenda-num">4</span>現場からの相談<small>(その場で記入)</small></h3>';
    h += '<p class="agenda-empty">数字は詰めるためでなく、対話のために。まず現場の話から。</p>';
    h += '</div>';
    h += '</section>';

    h += '<div class="agenda-actions">';
    h += '  <button class="btn btn-primary" data-action="copy-agenda">📄 アジェンダをコピーする</button>';
    h += '  <p class="foot-note center">コピーしたテキストは、メールやチャットでの事前共有・議事メモの下書きにそのまま使えます。</p>';
    h += '</div>';

    return h;
  }

  // ---- 描画ルート ------------------------------------------------------------
  function render() {
    var h;
    if (view.name === 'facility') h = renderFacility();
    else if (view.name === 'agenda') h = renderAgenda();
    else h = renderHome();
    app.innerHTML = '<div class="screen">' + h + '</div>';
    app.classList.remove('enter');
    void app.offsetWidth; // アニメーション再発火
    app.classList.add('enter');
    window.scrollTo(0, 0);
  }

  // ---- イベント --------------------------------------------------------------
  app.addEventListener('click', function (e) {
    var el = e.target.closest('[data-action]');
    if (!el) return;
    var action = el.dataset.action;

    if (action === 'go-home') { view.name = 'home'; view.facilityId = null; view.editingFacility = false; render(); }
    else if (action === 'open-facility') { view.name = 'facility'; view.facilityId = el.dataset.id; view.tab = 'task'; view.editingFacility = false; render(); }
    else if (action === 'open-agenda') { view.name = 'agenda'; render(); }
    else if (action === 'tab') { view.tab = el.dataset.tab; render(); }
    else if (action === 'show-add-facility') { view.addingFacility = true; render(); focusFirst(); }
    else if (action === 'cancel-add-facility') { view.addingFacility = false; render(); }
    else if (action === 'toggle-edit-facility') { view.editingFacility = !view.editingFacility; render(); }
    else if (action === 'toggle-task') { Store.toggleTask(el.dataset.id); render(); }
    else if (action === 'remove-item') {
      if (window.confirm('この記録を削除しますか?')) { Store.removeItem(el.dataset.id); render(); toast('削除しました'); }
    }
    else if (action === 'remove-facility') {
      var f = Store.facility(view.facilityId);
      if (f && window.confirm('「' + f.name + '」と、その記録をすべて削除しますか?')) {
        Store.removeFacility(f.id);
        view.name = 'home'; view.facilityId = null; view.editingFacility = false;
        render(); toast('施設を削除しました');
      }
    }
    else if (action === 'due-quick') {
      var input = el.closest('form').querySelector('input[name="due"]');
      input.value = el.dataset.days === '' ? '' : Store.daysFromToday(+el.dataset.days);
    }
    else if (action === 'copy-agenda') {
      var fa = Store.facility(view.facilityId);
      if (fa) copyText(agendaText(fa, buildAgenda(fa)), 'アジェンダをコピーしました');
    }
    else if (action === 'seed') { Store.seedSamples(); render(); toast('サンプルデータを入れました'); }
    else if (action === 'clear-all') {
      if (window.confirm('すべての施設と記録を削除しますか? この操作は取り消せません。')) {
        Store.clearAll(); view.name = 'home'; view.facilityId = null; render(); toast('全データを削除しました');
      }
    }
  });

  app.addEventListener('submit', function (e) {
    var form = e.target.closest('[data-form]');
    if (!form) return;
    e.preventDefault();
    var kind = form.dataset.form;
    var fd = new FormData(form);

    if (kind === 'add-facility') {
      var f = Store.addFacility({ name: fd.get('name'), leader: fd.get('leader'), kind: fd.get('kind') });
      if (f) { view.addingFacility = false; render(); toast('「' + f.name + '」を追加しました'); }
    } else if (kind === 'edit-facility') {
      Store.updateFacility(view.facilityId, { name: fd.get('name'), leader: fd.get('leader'), kind: fd.get('kind') });
      view.editingFacility = false;
      render(); toast('保存しました');
    } else if (kind === 'add-item') {
      var it = Store.addItem({
        facilityId: view.facilityId,
        type: view.tab,
        text: fd.get('text'),
        owner: fd.get('owner'),
        due: fd.get('due') || null
      });
      if (it) { render(); toast('記録しました'); focusFirst(); }
    }
  });

  function focusFirst() {
    var el = app.querySelector('form .input');
    if (el) el.focus();
  }

  // ---- テーマ切替 -----------------------------------------------------------

  document.getElementById('themeBtn').addEventListener('click', function () {
    var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('bridge-theme', next); } catch (e) {}
  });

  // ---- 起動 -----------------------------------------------------------------
  render();
})();
