/* 掲示じたく — 画面遷移・保存・出力
 * 入力は localStorage にのみ保存する。外部送信はしない。AIも使わない。
 * 文面の型は data.js の KEIJI_TYPES。ここは型を描画して埋めるだけ。
 */

'use strict';

(function () {
  const STORAGE_KEY = 'keiji_v1';

  const views = {
    select: document.getElementById('view-select'),
    form: document.getElementById('view-form'),
    output: document.getElementById('view-output'),
  };
  const toastEl = document.getElementById('toast');

  /* state.data は型idごとの入力値。common(施設名など)は型をまたいで使い回す */
  let state = { typeId: null, common: { facility: '', signer: '', issueDate: '' }, data: {} };
  let outputTab = 'poster';

  /* ---------- 保存と復元 ---------- */

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* プライベートモード等では保存しない */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const s = JSON.parse(raw);
      if (s && typeof s === 'object') {
        if (s.common && typeof s.common === 'object') state.common = Object.assign(state.common, s.common);
        if (s.data && typeof s.data === 'object') state.data = s.data;
        if (KEIJI_TYPES.some((t) => t.id === s.typeId)) state.typeId = s.typeId;
      }
    } catch (e) { /* 壊れた保存データは無視して最初から */ }
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

  function currentType() { return KEIJI_TYPES.find((t) => t.id === state.typeId) || null; }
  function fieldsOf(typeId) { return state.data[typeId] || (state.data[typeId] = {}); }

  /* ---------- ① 種類を選ぶ ---------- */

  function renderSelect() {
    const grid = document.getElementById('type-grid');
    grid.innerHTML = '';
    KEIJI_TYPES.forEach((t) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'type-card';
      btn.innerHTML = '<span class="type-name">' + esc(t.name) + '</span><span class="type-desc">' + esc(t.desc) + '</span>';
      btn.addEventListener('click', () => {
        state.typeId = t.id;
        save();
        renderForm();
        show('form');
      });
      grid.appendChild(btn);
    });
  }

  /* ---------- ② 埋める ---------- */

  function fieldControl(f, value) {
    const id = 'f-' + f.key;
    if (f.type === 'select') {
      const hasCustom = !!f.custom;
      const opts = f.options.map((o) => '<option value="' + esc(o) + '"' + (value === o ? ' selected' : '') + '>' + esc(o) + '</option>').join('');
      const isCustom = hasCustom && value && !f.options.includes(value);
      return '<select id="' + id + '" data-key="' + f.key + '"' + (hasCustom ? ' data-custom="1"' : '') + '>'
        + opts
        + (hasCustom ? '<option value="__custom__"' + (isCustom ? ' selected' : '') + '>' + esc(f.custom) + '</option>' : '')
        + '</select>'
        + (hasCustom ? '<input type="text" id="' + id + '-custom" class="custom-input" data-custom-for="' + f.key + '" placeholder="' + esc(f.customPlaceholder || '') + '" value="' + (isCustom ? esc(value) : '') + '"' + (isCustom ? '' : ' hidden') + '>' : '');
    }
    if (f.type === 'textarea') {
      return '<textarea id="' + id + '" data-key="' + f.key + '" rows="3" placeholder="' + esc(f.placeholder || '') + '"' + (f.required ? ' required' : '') + '>' + esc(value || '') + '</textarea>';
    }
    return '<input type="' + (f.type === 'date' ? 'date' : 'text') + '" id="' + id + '" data-key="' + f.key + '" value="' + esc(value || '') + '" placeholder="' + esc(f.placeholder || '') + '"' + (f.required ? ' required' : '') + '>';
  }

  function fieldRow(f, value) {
    return '<div class="field" data-field="' + f.key + '">'
      + '<label for="f-' + f.key + '">' + esc(f.label) + (f.required ? '<span class="req">必須</span>' : '') + '</label>'
      + fieldControl(f, value)
      + (f.hint ? '<p class="hint">' + esc(f.hint) + '</p>' : '')
      + '</div>';
  }

  function renderForm() {
    const t = currentType();
    if (!t) return;
    document.getElementById('form-title').textContent = t.name;
    const data = fieldsOf(t.id);
    const formEl = document.getElementById('form-fields');

    const common = [
      { key: '_facility', label: '医院・施設の名前', type: 'text', required: true, placeholder: '例: ブリッジ内科クリニック' },
      { key: '_signer', label: '差出の肩書や名前', type: 'text', placeholder: '例: 院長', hint: '空欄なら、施設名だけが載ります' },
      { key: '_issueDate', label: '掲示する日', type: 'date', hint: '掲示の右上に載る日付です。空欄なら載りません' },
    ];
    formEl.innerHTML =
      t.fields.map((f) => fieldRow(f, data[f.key])).join('')
      + '<div class="field-sep">差出について</div>'
      + common.map((f) => fieldRow(f, state.common[f.key.slice(1)])).join('');

    applyShowIf(t);

    formEl.querySelectorAll('input, select, textarea').forEach((el) => {
      el.addEventListener('input', () => onFieldInput(t, el));
      el.addEventListener('change', () => onFieldInput(t, el));
    });
  }

  function onFieldInput(t, el) {
    if (el.dataset.customFor) {
      fieldsOf(t.id)[el.dataset.customFor] = el.value.trim();
      save();
      return;
    }
    const key = el.dataset.key;
    if (!key) return;
    if (key.startsWith('_')) {
      state.common[key.slice(1)] = el.value.trim();
      save();
      return;
    }
    if (el.tagName === 'SELECT' && el.dataset.custom) {
      const customInput = document.getElementById('f-' + key + '-custom');
      if (el.value === '__custom__') {
        customInput.hidden = false;
        customInput.focus();
        fieldsOf(t.id)[key] = customInput.value.trim();
      } else {
        customInput.hidden = true;
        fieldsOf(t.id)[key] = el.value;
      }
    } else {
      fieldsOf(t.id)[key] = el.value.trim();
    }
    applyShowIf(t);
    save();
  }

  /* showIf: {until:'終了日が決まっている'} のような条件で行を出し入れする */
  function applyShowIf(t) {
    const data = fieldsOf(t.id);
    t.fields.forEach((f) => {
      if (!f.showIf) return;
      const row = document.querySelector('[data-field="' + f.key + '"]');
      if (!row) return;
      const on = Object.keys(f.showIf).every((k) => (data[k] || t.fields.find((x) => x.key === k).options[0]) === f.showIf[k]);
      row.hidden = !on;
    });
  }

  /* ---------- ③ できあがり ---------- */

  function buildResult() {
    const t = currentType();
    if (!t) return null;
    return t.build(fieldsOf(t.id));
  }

  function renderBlocks(blocks) {
    return blocks.map((b) => {
      if (b.t === 'big') return '<p class="poster-big">' + esc(b.text) + '</p>';
      if (b.t === 'pre') {
        return '<div class="poster-pre">' + (b.label ? '<span class="poster-pre-label">' + esc(b.label) + '</span>' : '')
          + esc(b.text).split('\n').map((l) => '<span class="poster-pre-line">' + l + '</span>').join('') + '</div>';
      }
      if (b.t === 'kv') {
        return '<dl class="poster-kv">' + b.items.map((i) => '<div><dt>' + esc(i.k) + '</dt><dd>' + esc(i.v || '〇〇') + '</dd></div>').join('') + '</dl>';
      }
      return '<p>' + esc(b.text) + '</p>';
    }).join('');
  }

  function renderOutput() {
    const r = buildResult();
    if (!r) return;
    const issue = keijiFormatIssueDate(state.common.issueDate);
    document.getElementById('poster').innerHTML =
      '<div class="poster-head">' + (issue ? '<span>' + esc(issue) + '</span>' : '') + '</div>'
      + '<h2 class="poster-title">' + esc(r.title) + '</h2>'
      + '<div class="poster-body">' + renderBlocks(r.blocks) + '</div>'
      + '<div class="poster-foot"><span>' + esc(state.common.facility || '〇〇クリニック')
      + (state.common.signer ? '</span><span class="poster-signer">' + esc(state.common.signer) : '') + '</span></div>';
    document.getElementById('web-text').textContent = r.web;
    setTab(outputTab);
  }

  /* 掲示のテキスト版(メール等に貼る用) */
  function posterAsText() {
    const r = buildResult();
    if (!r) return '';
    const issue = keijiFormatIssueDate(state.common.issueDate);
    const lines = [];
    if (issue) lines.push(issue, '');
    lines.push(r.title, '');
    r.blocks.forEach((b) => {
      if (b.t === 'kv') b.items.forEach((i) => lines.push(i.k + ': ' + (i.v || '')));
      else if (b.t === 'pre') { if (b.label) lines.push('【' + b.label + '】'); lines.push(b.text); }
      else lines.push(b.text);
      lines.push('');
    });
    lines.push(state.common.facility + (state.common.signer ? ' ' + state.common.signer : ''));
    return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function setTab(name) {
    outputTab = name;
    document.querySelectorAll('.tab-btn').forEach((b) => {
      const on = b.dataset.tab === name;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    document.getElementById('pane-poster').hidden = name !== 'poster';
    document.getElementById('pane-web').hidden = name !== 'web';
  }

  function copyText(text, doneMsg) {
    const finish = () => toast(doneMsg);
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(finish, () => fallbackCopy(text, finish));
    } else {
      fallbackCopy(text, finish);
    }
  }

  function fallbackCopy(text, done) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { toast('コピーできませんでした。長押しで選択してください'); }
    document.body.removeChild(ta);
  }

  /* ---------- 起動 ---------- */

  function init() {
    load();
    renderSelect();

    document.getElementById('form-el').addEventListener('submit', (e) => {
      e.preventDefault();
      renderOutput();
      show('output');
    });
    document.getElementById('form-back').addEventListener('click', () => show('select'));
    document.getElementById('out-edit').addEventListener('click', () => { renderForm(); show('form'); });
    document.getElementById('out-restart').addEventListener('click', () => show('select'));

    document.querySelectorAll('.tab-btn').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tab)));
    document.getElementById('btn-print').addEventListener('click', () => window.print());
    document.getElementById('btn-copy-poster').addEventListener('click', () => copyText(posterAsText(), '掲示の文面をコピーしました'));
    document.getElementById('btn-copy-web').addEventListener('click', () => {
      const r = buildResult();
      if (r) copyText(r.web, 'ホームページ用の文面をコピーしました');
    });

    /* テーマ切替(bridge-theme は BRIDGE 全体で共通のキー) */
    document.getElementById('themeBtn').addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', cur);
      try { localStorage.setItem('bridge-theme', cur); } catch (e) { /* 保存できなくても切替は効かせる */ }
    });

    show('select');
  }

  init();
})();
