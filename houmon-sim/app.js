/* 訪問診療 収益シミュレータ(仮称) — 骨格版
 * 計算はすべて端末内。POINTS(points.js)の版と verified はUIに常時反映する。 */
(function () {
  'use strict';
  const STORE_KEY = 'houmon-sim-v1';
  const L = POINTS.labels;

  const defaultGroup = () => ({ type: 'zaitaku', band: 0, freq: 2, patients: 10 });
  const defaultScenario = () => ({
    kubun: 'kyoka',
    groups: [
      { type: 'zaitaku', band: 0, freq: 2, patients: 20 },
      { type: 'shisetsu', band: 2, freq: 2, patients: 30 }
    ],
    doctors: 2, visitsPerDay: 12, daysPerMonth: 20
  });

  let state = load() || { a: defaultScenario(), b: null };

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) { return null; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* 保存できなくても動く */ }
  }

  /* ---- 計算 ---- */
  function visitFee(g) {
    return (g.type === 'zaitaku' && g.band === 0) ? POINTS.visit.single : POINTS.visit.multi;
  }
  function calc(sc) {
    let soukan = 0, visits = 0, visitPts = 0, patients = 0;
    for (const g of sc.groups) {
      const n = Math.max(0, Number(g.patients) || 0);
      const monthly = POINTS.soukan[g.type]['freq' + g.freq][sc.kubun][g.band];
      soukan += monthly * n;
      visitPts += visitFee(g) * g.freq * n;
      visits += g.freq * n;
      patients += n;
    }
    const totalPts = soukan + visitPts;
    const capacity = (Number(sc.doctors) || 0) * (Number(sc.visitsPerDay) || 0) * (Number(sc.daysPerMonth) || 0);
    return {
      patients, visits, capacity,
      rate: capacity > 0 ? visits / capacity : null,
      soukanYen: soukan * 10, visitYen: visitPts * 10, totalYen: totalPts * 10,
      perDoctorYen: (Number(sc.doctors) || 0) > 0 ? totalPts * 10 / Number(sc.doctors) : null
    };
  }
  const yen = v => v == null ? '—' : Math.round(v).toLocaleString('ja-JP') + '円';

  /* ---- 描画 ---- */
  const boards = document.getElementById('boards');

  function el(tag, attrs, ...children) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (k === 'class') node.className = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v);
    }
    for (const c of children) node.append(c);
    return node;
  }
  function select(value, options, onchange, aria) {
    const s = el('select', { 'aria-label': aria, onchange: e => onchange(e.target.value) });
    for (const [val, label] of options) {
      const o = el('option', { value: val }, label);
      if (String(val) === String(value)) o.selected = true;
      s.append(o);
    }
    return s;
  }
  function numInput(value, onchange, aria, min) {
    return el('input', {
      type: 'number', value, min: min == null ? 0 : min, inputmode: 'numeric', 'aria-label': aria,
      onchange: e => onchange(Number(e.target.value))
    });
  }
  function field(labelText, control) {
    const d = el('div', {});
    d.append(el('label', {}, labelText), control);
    return d;
  }

  function renderBoard(key) {
    const sc = state[key];
    const board = el('div', { class: 'board ' + key });
    const title = key === 'a' ? '体制A' : '体制B';
    const h = el('h2', {}, el('span', { class: 'tag' }, title), key === 'a' ? 'いまの体制' : '比べたい体制');
    board.append(h);

    board.append(field('在支診の区分', select(sc.kubun,
      Object.entries(L.kubun), v => { sc.kubun = v; update(); }, title + ' 在支診の区分')));

    const groupsWrap = el('div', { class: 'groups' });
    groupsWrap.append(el('label', {}, '患者構成'));
    sc.groups.forEach((g, i) => {
      const row = el('div', { class: 'group' });
      row.append(
        field('種別', select(g.type, Object.entries(L.type), v => { g.type = v; update(); }, `${title} 構成${i + 1} 種別`)),
        field('単一建物の人数帯', select(g.band, L.band.map((b, idx) => [idx, b]), v => { g.band = Number(v); update(); }, `${title} 構成${i + 1} 人数帯`)),
        field('訪問頻度', select(g.freq, [[2, L.freq[2]], [1, L.freq[1]]], v => { g.freq = Number(v); update(); }, `${title} 構成${i + 1} 訪問頻度`)),
        field('患者数', numInput(g.patients, v => { g.patients = v; update(); }, `${title} 構成${i + 1} 患者数`)),
        el('button', { class: 'del', 'aria-label': `${title} 構成${i + 1} を削除`, onclick: () => { sc.groups.splice(i, 1); update(); } }, '×')
      );
      groupsWrap.append(row);
    });
    groupsWrap.append(el('button', { class: 'add', onclick: () => { sc.groups.push(defaultGroup()); update(); } }, '+ 構成を足す'));
    board.append(groupsWrap);

    const cap = el('div', { class: 'cap' });
    cap.append(
      field('医師数', numInput(sc.doctors, v => { sc.doctors = v; update(); }, title + ' 医師数', 0)),
      field('1日の訪問件数/医師', numInput(sc.visitsPerDay, v => { sc.visitsPerDay = v; update(); }, title + ' 1日の訪問件数', 0)),
      field('月の稼働日数', numInput(sc.daysPerMonth, v => { sc.daysPerMonth = v; update(); }, title + ' 月の稼働日数', 0))
    );
    board.append(cap);

    const r = calc(sc);
    const res = el('div', { class: 'result' });
    res.append(el('div', { class: 'total' }, yen(r.totalYen), el('small', {}, '/月(概算)')));
    res.append(kv('内訳: 総管', yen(r.soukanYen)));
    res.append(kv('内訳: 訪問診療料', yen(r.visitYen)));
    res.append(kv('医師1人あたり', yen(r.perDoctorYen)));
    res.append(kv('患者数 / 月間訪問回数', `${r.patients}人 / ${r.visits}回`));
    const rateText = r.rate == null ? '—'
      : Math.round(r.rate * 100) + '%' + (r.rate > 1 ? '(供給を超えています)' : '');
    res.append(kv('訪問キャパの使用率', rateText, r.rate != null && r.rate > 1));
    board.append(res);

    if (key === 'a' && !state.b) {
      board.append(el('button', { class: 'copyb', onclick: () => { state.b = JSON.parse(JSON.stringify(state.a)); update(); } }, 'この体制をBへ複製して比べる'));
    }
    if (key === 'b') {
      board.append(el('button', { class: 'copyb', onclick: () => { state.b = null; update(); } }, 'Bを消す'));
    }
    return board;
  }
  function kv(label, value, warn) {
    const d = el('div', { class: 'kv' + (warn ? ' warn' : '') });
    d.append(el('span', {}, label), el('b', {}, value));
    return d;
  }

  function renderDiff() {
    const box = document.getElementById('diff');
    if (!state.b) { box.hidden = true; return; }
    const a = calc(state.a), b = calc(state.b);
    const d = b.totalYen - a.totalYen;
    const sign = d > 0 ? '+' : d < 0 ? '−' : '±';
    document.getElementById('diffText').innerHTML = '';
    const p = document.getElementById('diffText');
    p.append('体制Bは体制Aに対して 月 ');
    p.append(el('b', {}, sign + Math.abs(Math.round(d)).toLocaleString('ja-JP') + '円'));
    p.append(' の概算差です。医師1人あたりでは ');
    const pd = (b.perDoctorYen != null && a.perDoctorYen != null) ? b.perDoctorYen - a.perDoctorYen : null;
    p.append(el('b', {}, pd == null ? '—' : (pd > 0 ? '+' : pd < 0 ? '−' : '±') + Math.abs(Math.round(pd)).toLocaleString('ja-JP') + '円'));
    p.append(' の差になります。');
    box.hidden = false;
  }

  function renderBanner() {
    const banner = document.getElementById('unverified');
    document.getElementById('verLabel').textContent = `(点数マスタ: ${POINTS.version})`;
    banner.hidden = POINTS.verified === true;
    // 版の表示は警告帯と別に、免責の並びへ恒久で出す(検証後も消えない)
    document.getElementById('verFoot').textContent =
      POINTS.version + (POINTS.verified === true ? '(検証済み)' : '(未検証)');
  }

  function update() {
    save();
    boards.innerHTML = '';
    boards.append(renderBoard('a'));
    if (state.b) boards.append(renderBoard('b'));
    renderDiff();
  }

  renderBanner();
  update();
})();
