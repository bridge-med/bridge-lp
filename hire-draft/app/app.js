/* 求人票の下ごしらえ — 入力・組み立て・表現の注意・出力
 * 入力は localStorage にのみ自動保存する。外部送信はしない。AIも使わない。
 * 下書きは、選ばれた内容だけから組み立てる。空欄の項目は出力に入れない(ダミー文を残さない)。
 */

'use strict';

(function () {
  const STORAGE_KEY = 'hiredraft_v1';

  const views = {
    intro: document.getElementById('view-intro'),
    form: document.getElementById('view-form'),
    preview: document.getElementById('view-preview'),
  };
  const toastEl = document.getElementById('toast');

  const blankState = () => ({
    role: null, emp: null, facType: null, why: null, exp: null, flow: null, smoke: null,
    tasks: [], welcomes: [], ins: [], perks: [],
    text: {},
  });
  let state = blankState();

  let persistTimer = null;
  function persist() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) {}
    }, 250);
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d || typeof d !== 'object') return;
      const s = blankState();
      ['role', 'emp', 'facType', 'why', 'exp', 'flow', 'smoke'].forEach((k) => { if (typeof d[k] === 'string') s[k] = d[k]; });
      ['tasks', 'welcomes', 'ins', 'perks'].forEach((k) => { if (Array.isArray(d[k])) s[k] = d[k].filter((v) => typeof v === 'string'); });
      if (d.text && typeof d.text === 'object') {
        Object.keys(d.text).forEach((k) => { if (typeof d.text[k] === 'string') s.text[k] = d.text[k]; });
      }
      state = s;
    } catch (e) { /* 壊れた保存データは無視 */ }
  }
  function hasContent() {
    return Boolean(state.role || state.emp || state.tasks.length ||
      Object.keys(state.text).some((k) => (state.text[k] || '').trim()));
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
  function show(name) {
    Object.keys(views).forEach((k) => views[k].classList.remove('on'));
    void views[name].offsetWidth;
    views[name].classList.add('on');
    window.scrollTo(0, 0);
  }

  const roleOf = (id) => ROLES.find((r) => r.id === id) || null;
  const empOf = (id) => EMP_TYPES.find((e) => e.id === id) || null;
  const pick = (list, id) => list.find((o) => o.id === id) || null;
  const txt = (k) => (state.text[k] || '').trim();

  /* ---------- 表現の注意 ---------- */

  function checkNg(s) {
    const hits = [];
    NG_PATTERNS.forEach((p) => {
      if (p.re.test(s) && !hits.some((h) => h.msg === p.msg)) hits.push({ type: p.type, msg: p.msg });
    });
    return hits;
  }

  const NG_FIELD_LABELS = {
    facName: '施設名', dept: '診療科・サービス内容', access: 'アクセス',
    taskNote: '仕事内容の補足', licNote: '資格の補足', payNote: '給与の補足',
    hours: '勤務時間', holidays: '休日', trial: '試用期間',
    staff: 'スタッフ構成', karte: 'カルテ・システム', overtime: '残業の実際',
    voice: '自院のことば', apply: '応募・問い合わせの方法',
  };

  function renderInlineNg(key) {
    const box = document.querySelector('.ng-notes[data-ng-for="' + key + '"]');
    if (!box) return;
    const hits = checkNg(txt(key));
    box.innerHTML = hits.map((h) => '<p class="ng-note">' + esc(h.msg) + '</p>').join('');
  }

  /* ---------- ② 入力: 描画 ---------- */

  function renderChipGroup(elId, options, selected, onPick) {
    const el = document.getElementById(elId);
    el.innerHTML = options.map((o) =>
      '<button type="button" class="chip' + (selected === o.id ? ' on' : '') + '" data-id="' + o.id + '" aria-pressed="' + (selected === o.id) + '">' + esc(o.name) + '</button>'
    ).join('');
    el.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
      onPick(b.dataset.id === selected ? null : b.dataset.id);
      const nb = document.querySelector('#' + elId + ' .chip[data-id="' + b.dataset.id + '"]');
      if (nb) nb.focus();
    }));
  }

  function renderCheckList(elId, items, stateKey) {
    const el = document.getElementById(elId);
    el.innerHTML = items.map((it) => {
      const on = state[stateKey].includes(it.id);
      return '<label class="check-item"><input type="checkbox" value="' + it.id + '"' + (on ? ' checked' : '') + '><span>' + esc(it.t || it.name) + '</span></label>';
    }).join('');
    el.querySelectorAll('input').forEach((c) => c.addEventListener('change', () => {
      if (c.checked) {
        if (!state[stateKey].includes(c.value)) state[stateKey].push(c.value);
      } else {
        state[stateKey] = state[stateKey].filter((v) => v !== c.value);
      }
      persist();
    }));
  }

  function renderRoleParts() {
    const role = roleOf(state.role);
    document.getElementById('task-role-note').textContent =
      role ? '' : '職種を選ぶと、その職種でよくある仕事が候補として並びます。';
    renderCheckList('list-tasks', role ? role.tasks : [], 'tasks');
    renderCheckList('list-welcomes', role ? role.welcomes : [], 'welcomes');
    document.getElementById('f-license').textContent =
      role ? role.license : '職種を選ぶと、ここに入ります';
    if (!role) {
      document.getElementById('list-tasks').innerHTML = '<p class="f-help">まず「01 募集する職種」を選んでください。</p>';
      document.getElementById('list-welcomes').innerHTML = '<p class="f-help">まず「01 募集する職種」を選んでください。</p>';
    }
  }

  function renderEmpParts() {
    const emp = empOf(state.emp) || EMP_TYPES[0];
    document.getElementById('pay-unit').textContent = emp.payUnit;
    document.getElementById('pay-affix1').textContent = emp.payAffix;
    document.getElementById('pay-affix2').textContent = emp.payAffix;
    document.getElementById('ins-note').hidden = state.emp !== 'part';
  }

  function renderForm() {
    renderChipGroup('chips-role', ROLES, state.role, (id) => { state.role = id; persist(); renderForm(); });
    renderChipGroup('chips-emp', EMP_TYPES, state.emp, (id) => { state.emp = id; persist(); renderForm(); });
    renderChipGroup('chips-factype', FACILITY_TYPES, state.facType, (id) => { state.facType = id; persist(); renderForm(); });
    renderChipGroup('chips-why', WHY_OPTIONS, state.why, (id) => { state.why = id; persist(); renderForm(); });
    renderChipGroup('chips-exp', EXP_OPTIONS, state.exp, (id) => { state.exp = id; persist(); renderForm(); });
    renderChipGroup('chips-flow', FLOW_OPTIONS, state.flow, (id) => { state.flow = id; persist(); renderForm(); });
    renderChipGroup('chips-smoke', SMOKE_OPTIONS, state.smoke, (id) => { state.smoke = id; persist(); renderForm(); });
    renderRoleParts();
    renderEmpParts();
    renderCheckList('list-ins', INSURANCES, 'ins');
    renderCheckList('list-perks', PERKS, 'perks');
    // 職種が決まるまでは組み立てられない(未選択のまま道具が言葉を足さないため)
    document.getElementById('to-preview').disabled = !state.role;
    document.getElementById('build-hint').hidden = Boolean(state.role);
  }

  // テキスト入力(data-k)は一度だけ結線し、値の反映は syncTextInputs で行う
  function bindTextInputs() {
    document.querySelectorAll('[data-k]').forEach((el) => {
      el.addEventListener('input', () => {
        state.text[el.dataset.k] = el.value;
        persist();
        renderInlineNg(el.dataset.k);
      });
    });
  }
  function syncTextInputs() {
    document.querySelectorAll('[data-k]').forEach((el) => {
      el.value = state.text[el.dataset.k] || '';
      renderInlineNg(el.dataset.k);
    });
  }

  /* ---------- ③ 下書きの組み立て ---------- */

  function buildDraft() {
    const role = roleOf(state.role);
    const emp = empOf(state.emp);
    const roleName = role ? role.name : 'スタッフ';
    const empName = emp ? emp.name : '';
    const facName = txt('facName');

    const title = '【募集】' + roleName + (empName ? '(' + empName + ')' : '') + (facName ? '|' + facName : '');

    const sections = [];

    // 募集について
    {
      const lines = [];
      const ft = pick(FACILITY_TYPES, state.facType);
      const inner = [ft ? ft.name : '', txt('dept')].filter(Boolean).join('・');
      const paren = (inner || txt('access'))
        ? '(' + inner + (inner && txt('access') ? '、' : '') + txt('access') + ')'
        : '';
      const head = facName ? facName + paren + 'で、' : (paren ? paren.slice(1, -1) + 'の施設で、' : '');
      lines.push({ type: 'p', v: head + roleName + (empName ? '(' + empName + ')' : '') + 'を募集します。' });
      const why = pick(WHY_OPTIONS, state.why);
      if (why) lines.push({ type: 'p', v: why.text });
      sections.push({ h: '募集について', lines });
    }

    // 仕事内容
    if (role && (state.tasks.length || txt('taskNote'))) {
      const lines = [];
      role.tasks.filter((t) => state.tasks.includes(t.id)).forEach((t) => lines.push({ type: 'li', v: t.t }));
      if (txt('taskNote')) lines.push({ type: 'p', v: txt('taskNote') });
      sections.push({ h: '仕事内容', lines });
    }

    // 応募の条件
    if (role || state.exp || state.welcomes.length) {
      const lines = [];
      if (role) {
        lines.push({ type: 'kv', k: '資格', v: role.license + (txt('licNote') ? '(' + txt('licNote') + ')' : '') });
      }
      const exp = pick(EXP_OPTIONS, state.exp);
      if (exp) lines.push({ type: 'kv', k: '経験', v: exp.text });
      if (role) {
        const w = role.welcomes.filter((x) => state.welcomes.includes(x.id));
        if (w.length) {
          lines.push({ type: 'kv', k: '歓迎', v: '' });
          w.forEach((x) => lines.push({ type: 'li', v: x.t }));
        }
      }
      if (lines.length) sections.push({ h: '応募の条件', lines });
    }

    // 労働条件
    {
      const lines = [];
      const min = txt('payMin');
      const max = txt('payMax');
      // 給与の単位(月給/時給)は雇用形態から決まるため、未選択なら行ごと入れない
      if (emp && (min || max)) {
        let v = emp.payUnit + ' ' + (min ? min + emp.payAffix : '') + '〜' + (max ? max + emp.payAffix : '');
        if (txt('payNote')) v += '。' + txt('payNote');
        lines.push({ type: 'kv', k: '給与', v });
      }
      if (txt('hours')) lines.push({ type: 'kv', k: '勤務時間', v: txt('hours') });
      if (txt('holidays')) lines.push({ type: 'kv', k: '休日', v: txt('holidays') });
      if (state.ins.length) {
        // 労災保険は法定で全職場が加入するため自動で加える
        let v = INSURANCES.filter((i) => state.ins.includes(i.id)).map((i) => i.name).concat('労災保険').join('・');
        if (state.emp === 'part') v += '(勤務時間により加入の条件が変わります)';
        lines.push({ type: 'kv', k: '加入保険', v });
      }
      const sm = pick(SMOKE_OPTIONS, state.smoke);
      if (sm) lines.push({ type: 'kv', k: '受動喫煙への対応', v: sm.text });
      if (txt('trial')) lines.push({ type: 'kv', k: '試用期間', v: txt('trial') });
      if (lines.length) sections.push({ h: '労働条件', lines });
    }

    // 職場の様子
    {
      const lines = [];
      if (txt('staff')) lines.push({ type: 'kv', k: 'スタッフ構成', v: txt('staff') });
      if (txt('karte')) lines.push({ type: 'kv', k: 'カルテ・システム', v: txt('karte') });
      if (txt('overtime')) lines.push({ type: 'kv', k: '残業の実際', v: txt('overtime') });
      PERKS.filter((p) => state.perks.includes(p.id)).forEach((p) => lines.push({ type: 'li', v: p.t }));
      if (txt('voice')) lines.push({ type: 'p', v: txt('voice') });
      if (lines.length) sections.push({ h: '職場の様子', lines });
    }

    // 選考と応募方法
    {
      const lines = [];
      const flow = pick(FLOW_OPTIONS, state.flow);
      if (flow) lines.push({ type: 'p', v: flow.text });
      if (txt('apply')) lines.push({ type: 'kv', k: '応募方法', v: txt('apply') });
      if (lines.length) sections.push({ h: '選考と応募方法', lines });
    }

    return { title, sections };
  }

  function missingItems() {
    const m = [];
    if (!state.role) m.push('募集する職種');
    if (!state.emp) m.push('雇用形態');
    if (!txt('facName')) m.push('施設名');
    if (!state.why) m.push('募集の背景');
    if (!state.tasks.length) m.push('仕事内容');
    if (!txt('payMin') && !txt('payMax')) m.push('給与');
    if (!txt('hours')) m.push('勤務時間');
    if (!txt('holidays')) m.push('休日');
    if (!state.ins.length) m.push('加入保険');
    if (!state.smoke) m.push('受動喫煙への対応');
    if (!state.flow) m.push('選考の流れ');
    if (!txt('apply')) m.push('応募・問い合わせの方法');
    return m;
  }

  function ngFindings() {
    const out = [];
    Object.keys(NG_FIELD_LABELS).forEach((k) => {
      const v = txt(k);
      if (!v) return;
      checkNg(v).forEach((h) => out.push({ field: NG_FIELD_LABELS[k], msg: h.msg }));
    });
    return out;
  }

  function renderPreview() {
    const { title, sections } = buildDraft();

    const missing = missingItems();
    const missBlock = document.getElementById('missing-block');
    missBlock.hidden = !missing.length;
    document.getElementById('missing-list').innerHTML = missing.map((m) => '<li>' + esc(m) + '</li>').join('');

    const ngs = ngFindings();
    const ngBlock = document.getElementById('ng-block');
    ngBlock.hidden = !ngs.length;
    document.getElementById('ng-list').innerHTML = ngs.map((n) => '<li>' + esc(n.field) + ' — ' + esc(n.msg) + '</li>').join('');
    document.getElementById('ng-disclaimer').textContent = NG_DISCLAIMER;

    const doc = document.getElementById('draft-doc');
    doc.innerHTML = '<p class="d-title">' + esc(title) + '</p>' + sections.map((s) => {
      let body = '';
      let listOpen = false;
      s.lines.forEach((l) => {
        if (l.type === 'li') {
          if (!listOpen) { body += '<ul class="d-list">'; listOpen = true; }
          body += '<li>' + esc(l.v) + '</li>';
          return;
        }
        if (listOpen) { body += '</ul>'; listOpen = false; }
        if (l.type === 'kv') {
          body += '<p class="d-kv"><span class="k">' + esc(l.k) + '</span>' + esc(l.v) + '</p>';
        } else {
          body += '<p class="d-p">' + esc(l.v) + '</p>';
        }
      });
      if (listOpen) body += '</ul>';
      return '<div class="d-sec"><p class="d-h">' + esc(s.h) + '</p>' + body + '</div>';
    }).join('');
  }

  function formatDraft() {
    const { title, sections } = buildDraft();
    const parts = [title, ''];
    sections.forEach((s) => {
      parts.push('■ ' + s.h);
      s.lines.forEach((l) => {
        if (l.type === 'li') parts.push('・' + l.v);
        else if (l.type === 'kv') parts.push(l.k + (l.v ? ': ' + l.v : ':'));
        else parts.push(l.v);
      });
      parts.push('');
    });
    parts.push('---');
    parts.push('(' + DOC_TITLE + 'で作成した下書きです。公開する前に、掲載先の基準と実際の条件を確認してください)');
    return parts.join('\n').trim();
  }

  /* ---------- 画面の行き来 ---------- */

  document.getElementById('intro-start').addEventListener('click', () => {
    renderForm();
    syncTextInputs();
    show('form');
  });
  document.getElementById('form-back').addEventListener('click', () => {
    renderResumeNote();
    show('intro');
  });
  document.getElementById('to-preview').addEventListener('click', () => {
    renderPreview();
    show('preview');
  });
  document.getElementById('preview-back').addEventListener('click', () => {
    renderForm();
    syncTextInputs();
    show('form');
  });

  /* ---------- 出力 ---------- */

  document.getElementById('draft-copy').addEventListener('click', () => {
    const text = formatDraft();
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

  document.getElementById('draft-save').addEventListener('click', () => {
    const blob = new Blob([formatDraft() + '\n'], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '求人票の下書き.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    toast('テキストで保存しました');
  });

  /* ---------- テーマ切替 ---------- */

  document.getElementById('themeBtn').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('bridge-theme', next); } catch (e) {}
  });

  /* ---------- 起動 ---------- */

  function renderResumeNote() {
    document.getElementById('resume-note').hidden = !hasContent();
    if (hasContent()) document.getElementById('intro-start').textContent = '続きから再開する';
  }

  load();
  bindTextInputs();
  renderResumeNote();
  show('intro');
})();
