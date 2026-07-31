/* 二度手間さがし — 画面遷移・保存・出力整形
 * チェックは localStorage にのみ保存する。外部送信はしない。AIも使わない。
 * 時間は利用者の入力(頻度×1回あたり)から計算した目安であり、測定値ではない。
 */

'use strict';

(function () {
  const STORAGE_KEY = 'nidodema_v1';

  const views = {
    intro: document.getElementById('view-intro'),
    dept: document.getElementById('view-dept'),
    check: document.getElementById('view-check'),
    result: document.getElementById('view-result'),
  };
  const toastEl = document.getElementById('toast');

  // sel: 項目idキーの { f: FREQ id, m: MINS id } / custom: { label, cls, f, m } の配列
  let state = { dept: null, sel: {}, custom: [] };

  /* ---------- 保存と復元 ---------- */

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* プライベートモード等では保存しない */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return;
      const dept = DEPTS.some((x) => x.id === d.dept) ? d.dept : null;
      const sel = {};
      if (dept && d.sel && typeof d.sel === 'object') {
        TASKS[dept].forEach((t) => {
          const s = d.sel[t.id];
          if (s && FREQ.some((f) => f.id === s.f) && MINS.some((m) => m.id === s.m)) sel[t.id] = { f: s.f, m: s.m };
        });
      }
      const custom = Array.isArray(d.custom)
        ? d.custom.filter((c) => c && typeof c.label === 'string' && c.label.trim() && CLASSES[c.cls] &&
            FREQ.some((f) => f.id === c.f) && MINS.some((m) => m.id === c.m))
            .map((c) => ({ label: c.label.trim().slice(0, 80), cls: c.cls, f: c.f, m: c.m }))
        : [];
      state = { dept, sel, custom };
    } catch (e) { /* 壊れた保存データは無視して最初から */ }
  }

  function hasAnyInput() {
    return Object.keys(state.sel).length > 0 || state.custom.length > 0;
  }

  /* ---------- 共通 ---------- */

  function show(name) {
    Object.keys(views).forEach((k) => views[k].classList.remove('on'));
    void views[name].offsetWidth;
    views[name].classList.add('on');
    window.scrollTo(0, 0);
  }

  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), 2200);
  }

  const freqOf = (id) => FREQ.find((f) => f.id === id);
  const minsOf = (id) => MINS.find((m) => m.id === id);

  /* 月あたり分数 → 「月およそ◯時間/◯分」。0.5時間単位に丸めた目安 */
  function fmtMonthly(mins) {
    if (mins < 60) return '月およそ' + mins + '分';
    const h = Math.round(mins / 30) / 2;
    return '月およそ' + (Number.isInteger(h) ? h : h.toFixed(1)) + '時間';
  }

  function monthlyMins(s) {
    return freqOf(s.f).n * minsOf(s.m).n;
  }

  /* ---------- ① 入口 ---------- */

  function renderIntro() {
    const started = hasAnyInput() || state.dept;
    document.getElementById('intro-start').hidden = !!started;
    document.getElementById('intro-continue').hidden = !started;
    document.getElementById('intro-restart').hidden = !started;
    show('intro');
  }

  document.getElementById('intro-start').addEventListener('click', () => {
    state.dept ? enterCheck() : show('dept');
  });
  document.getElementById('intro-continue').addEventListener('click', () => {
    state.dept ? enterCheck() : show('dept');
  });
  document.getElementById('intro-restart').addEventListener('click', () => {
    if (!confirm('チェックをすべて消して、最初からやり直します。よろしいですか。')) return;
    state = { dept: null, sel: {}, custom: [] };
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    show('dept');
  });

  /* ---------- ② 部署選択 ---------- */

  function renderDepts() {
    const list = document.getElementById('dept-list');
    list.innerHTML = DEPTS.map((d) =>
      '<button type="button" class="dept-item" data-dept="' + d.id + '">' +
        '<span>' + esc(d.name) + '</span><span class="arrow" aria-hidden="true">→</span>' +
      '</button>'
    ).join('');
    list.querySelectorAll('.dept-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        const next = btn.dataset.dept;
        if (state.dept && state.dept !== next && hasAnyInput()) {
          if (!confirm('部署を変えると、いまのチェックは消えます。よろしいですか。')) return;
          state.sel = {};
          state.custom = [];
        }
        state.dept = next;
        save();
        enterCheck();
      });
    });
  }

  document.getElementById('dept-back').addEventListener('click', () => renderIntro());

  /* ---------- ③ 手作業チェック ---------- */

  function chipRow(kind, list, chosen, taskId) {
    return '<div class="chips" role="group" aria-label="' + (kind === 'f' ? '頻度' : '1回あたりの時間') + '">' +
      '<span class="chips-k">' + (kind === 'f' ? '頻度' : '1回') + '</span>' +
      list.map((o) =>
        '<button type="button" class="chip' + (o.id === chosen ? ' on' : '') + '" data-task="' + taskId + '" data-' + kind + '="' + o.id + '">' + o.label + '</button>'
      ).join('') +
      '</div>';
  }

  function taskRow(t, s, removable) {
    const on = !!s;
    return '<div class="task' + (on ? ' on' : '') + '">' +
      '<button type="button" class="task-head" data-toggle="' + t.id + '" aria-expanded="' + on + '">' +
        '<span class="task-box" aria-hidden="true"></span>' +
        '<span class="task-label">' + esc(t.label) + '</span>' +
        (on ? '<span class="task-est">' + fmtMonthly(monthlyMins(s)) + '</span>' : '') +
      '</button>' +
      (on
        ? '<div class="task-detail">' +
            chipRow('f', FREQ, s.f, t.id) +
            chipRow('m', MINS, s.m, t.id) +
            (removable ? '<div class="task-ops"><button type="button" class="task-del" data-del="' + t.id + '">この項目を消す</button></div>' : '') +
          '</div>'
        : '') +
      '</div>';
  }

  function renderCheck() {
    document.getElementById('check-dept').textContent = DEPTS.find((d) => d.id === state.dept).name;

    const listEl = document.getElementById('task-list');
    listEl.innerHTML =
      TASKS[state.dept].map((t) => taskRow(t, state.sel[t.id], false)).join('') +
      state.custom.map((c, i) => taskRow({ id: 'c' + i, label: c.label }, { f: c.f, m: c.m }, true)).join('');

    // 行のタップで選択/解除。選択時は目安の初期値(週に数回×15分)を置く
    listEl.querySelectorAll('[data-toggle]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.toggle;
        if (id.startsWith('c')) return; // 自由追加の行は消すボタンでのみ外す
        if (state.sel[id]) delete state.sel[id];
        else state.sel[id] = { f: 'wfew', m: 'm15' };
        save();
        renderCheck();
      });
    });
    listEl.querySelectorAll('.chip').forEach((chip) => {
      chip.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const id = chip.dataset.task;
        const target = id.startsWith('c') ? state.custom[Number(id.slice(1))] : state.sel[id];
        if (!target) return;
        if (chip.dataset.f) target.f = chip.dataset.f;
        if (chip.dataset.m) target.m = chip.dataset.m;
        save();
        renderCheck();
      });
    });
    listEl.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.custom.splice(Number(btn.dataset.del.slice(1)), 1);
        save();
        renderCheck();
      });
    });

    const count = Object.keys(state.sel).length + state.custom.length;
    const next = document.getElementById('check-result');
    next.disabled = !count;
    next.textContent = count ? '結果を見る(' + count + '件)' : '結果を見る';
  }

  function enterCheck() {
    renderCheck();
    show('check');
  }

  /* 自由追加:1欄+分類の3択 */
  let customCls = null;

  function renderCustomCls() {
    document.querySelectorAll('#custom-cls .chip').forEach((c) => {
      c.classList.toggle('on', c.dataset.cls === customCls);
    });
  }

  document.querySelectorAll('#custom-cls .chip').forEach((c) => {
    c.addEventListener('click', () => {
      customCls = c.dataset.cls === customCls ? null : c.dataset.cls;
      renderCustomCls();
    });
  });

  document.getElementById('custom-add').addEventListener('click', () => {
    const input = document.getElementById('custom-label');
    const label = input.value.trim().slice(0, 80);
    if (!label) { toast('手作業をひとことで書いてください'); input.focus(); return; }
    if (!customCls) { toast('三つの分けかたから、近いものを選んでください'); return; }
    state.custom.push({ label, cls: customCls, f: 'wfew', m: 'm15' });
    input.value = '';
    customCls = null;
    renderCustomCls();
    save();
    renderCheck();
  });

  document.getElementById('check-dept-change').addEventListener('click', () => show('dept'));
  document.getElementById('check-back').addEventListener('click', () => renderIntro());
  document.getElementById('check-result').addEventListener('click', () => {
    renderResult();
    show('result');
  });

  /* ---------- ④ 結果 ---------- */

  function entriesByCls() {
    const groups = { a: [], b: [], c: [] };
    TASKS[state.dept].forEach((t) => {
      const s = state.sel[t.id];
      if (s) groups[t.cls].push({ label: t.label, step: t.step, mins: monthlyMins(s), f: s.f, m: s.m });
    });
    state.custom.forEach((c) => {
      groups[c.cls].push({ label: c.label, step: CUSTOM_STEP[c.cls], mins: monthlyMins(c), f: c.f, m: c.m, custom: true });
    });
    groups.a.sort((x, y) => y.mins - x.mins);
    groups.b.sort((x, y) => y.mins - x.mins);
    return groups;
  }

  function renderResult() {
    const g = entriesByCls();
    const reducible = [...g.a, ...g.b].reduce((sum, e) => sum + e.mins, 0);

    document.getElementById('result-stmt').textContent = reducible
      ? '見直せそうな手作業が、' + fmtMonthly(reducible) + 'ぶん見つかりました。'
      : 'チェックが付いたのは、人がやるべき仕事だけでした。';

    const wrap = document.getElementById('result-groups');
    wrap.innerHTML = ['a', 'b', 'c'].map((k) => {
      const items = g[k];
      if (!items.length) return '';
      const cls = CLASSES[k];
      const sub = k === 'c' ? '' :
        '<span class="grp-sum">合計 ' + fmtMonthly(items.reduce((s, e) => s + e.mins, 0)) + '</span>';
      return '<section class="grp grp-' + k + '">' +
        '<div class="grp-head"><h3>' + esc(cls.name) + '</h3>' + sub + '</div>' +
        '<p class="grp-desc">' + esc(cls.desc) + '</p>' +
        items.map((e) =>
          '<div class="res-row">' +
            '<div class="res-label">' + esc(e.label) +
              (e.custom ? '<span class="res-mine">自分で足した項目</span>' : '') + '</div>' +
            '<div class="res-est">' + esc(freqOf(e.f).label) + ' × ' + esc(minsOf(e.m).label) + ' → ' + fmtMonthly(e.mins) +
              (k === 'c' ? '。ここは削らずに残します' : '') + '</div>' +
            '<div class="res-step"><span class="k">' + (k === 'c' ? '守りかた' : '最初の一歩') + '</span>' + esc(e.step) + '</div>' +
          '</div>'
        ).join('') +
      '</section>';
    }).join('');
  }

  function buildCopyText() {
    const g = entriesByCls();
    const dept = DEPTS.find((d) => d.id === state.dept).name;
    const parts = [dept + 'の手作業の棚卸し(二度手間さがし)', ''];
    [['a', ''], ['b', ''], ['c', '(削らずに残す)']].forEach(([k, suffix]) => {
      const items = g[k];
      if (!items.length) return;
      const sum = k === 'c' ? '' : ' — 合計 ' + fmtMonthly(items.reduce((s, e) => s + e.mins, 0));
      parts.push('■ ' + CLASSES[k].name + suffix + sum);
      if (k === 'c') parts.push('  ' + CLASSES.c.desc);
      items.forEach((e) => {
        parts.push('・' + e.label + '(' + freqOf(e.f).label + ' × ' + minsOf(e.m).label + ' → ' + fmtMonthly(e.mins) + ')');
        parts.push('  ' + (k === 'c' ? '守りかた' : '最初の一歩') + ':' + e.step);
      });
      parts.push('');
    });
    parts.push('※時間は入力にもとづく目安です。');
    return parts.join('\n');
  }

  document.getElementById('result-copy').addEventListener('click', () => {
    const text = buildCopyText();
    const done = () => toast('コピーしました');
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
    } else {
      fallbackCopy(text, done);
    }
  });

  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('コピーできませんでした'); }
    document.body.removeChild(ta);
  }

  document.getElementById('result-back').addEventListener('click', () => enterCheck());
  document.getElementById('result-top').addEventListener('click', () => renderIntro());

  /* ---------- テーマ切替 ---------- */

  document.getElementById('themeBtn').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('bridge-theme', next); } catch (e) {}
  });

  /* ---------- 起動 ---------- */

  load();
  renderDepts();
  renderIntro();
})();
