/* 副業の帳簿 — 画面・保存・出力
 * データは localStorage にのみ保存する。外部送信はしない。
 * 集計・CSV・バリデーションの実体は calc.js(KeiriCalc)。ここはDOMと保存だけ。
 */

'use strict';

(function () {
  const C = window.KeiriCalc;
  const STORAGE_KEY = 'bridge-keiri-v1';

  /* ---------- 保存と復元 ---------- */

  const emptyDb = () => ({ fixed: [], sales: [], expenses: [] });

  function normalizeDb(data) {
    if (!data || typeof data !== 'object') return null;
    const db = emptyDb();
    if (!Array.isArray(data.fixed) || !Array.isArray(data.sales) || !Array.isArray(data.expenses)) return null;
    db.fixed = data.fixed.filter((f) => f && f.id && typeof f.name === 'string' && Number.isFinite(f.amount));
    db.sales = data.sales.filter((s) => s && s.id && typeof s.date === 'string' && Number.isFinite(s.amount));
    db.expenses = data.expenses.filter((e) => e && e.id && typeof e.date === 'string' && Number.isFinite(e.amount));
    return db;
  }

  let db = emptyDb();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) db = normalizeDb(JSON.parse(raw)) || emptyDb();
  } catch (e) { /* 壊れた保存データは無視して空で始める */ }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    } catch (e) {
      toast('保存できませんでした。ブラウザの設定を確認してください');
    }
  }

  const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  /* ---------- 書式 ---------- */

  const todayStr = () => new Date().toLocaleDateString('sv-SE');
  const currentYm = () => todayStr().slice(0, 7);

  function yen(n) {
    const r = Math.round(n);
    const abs = Math.abs(r).toLocaleString('ja-JP');
    return (r < 0 ? '−¥' : '¥') + abs;
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  const ymLabel = (ym) => Number(ym.slice(0, 4)) + '年' + Number(ym.slice(5, 7)) + '月';

  /* ---------- toast ---------- */

  const toastEl = document.getElementById('toast');
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  /* ---------- タブ・ビュー切替 ---------- */

  const views = {
    home: document.getElementById('view-home'),
    sales: document.getElementById('view-sales'),
    fixed: document.getElementById('view-fixed'),
    exp: document.getElementById('view-exp'),
    out: document.getElementById('view-out'),
  };
  const tabs = Array.from(document.querySelectorAll('.tab'));

  function show(name) {
    Object.keys(views).forEach((k) => views[k].classList.remove('on'));
    views[name].classList.add('on');
    tabs.forEach((t) => {
      if (t.dataset.view === name) t.setAttribute('aria-current', 'page');
      else t.removeAttribute('aria-current');
    });
    window.scrollTo(0, 0);
  }
  tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.view)));

  /* ---------- テーマ ---------- */

  document.getElementById('themeBtn').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('bridge-theme', next); } catch (e) {}
  });

  /* ---------- ホーム ---------- */

  function statTile(label, value, note) {
    return '<div class="stat"><div class="l">' + esc(label) + '</div><div class="v">' + esc(value) + '</div>' +
      (note ? '<div class="n">' + esc(note) + '</div>' : '') + '</div>';
  }

  function renderHome() {
    const ym = currentYm();
    const year = Number(ym.slice(0, 4));
    const m = C.monthSummary(db, ym);

    document.getElementById('home-month').textContent = ymLabel(ym) + 'の収支';

    // 損益分岐までの残額
    const be = document.getElementById('home-breakeven');
    const beNote = document.getElementById('home-breakeven-note');
    if (m.fixedMonthly <= 0) {
      be.textContent = '¥0';
      beNote.textContent = '固定費の登録がありません。固定費タブから登録すると回収の進み具合が出ます。';
    } else if (m.breakeven <= 0) {
      be.textContent = '¥0';
      beNote.textContent = '今月の固定費は回収済みです。';
    } else {
      be.textContent = yen(m.breakeven);
      beNote.textContent = 'あと' + yen(m.breakeven) + 'の売上で今月の固定費を回収できます。';
    }

    // 回収率(固定費0円ならゼロ除算せず「—」)
    document.getElementById('home-recovery').textContent =
      m.recovery === null ? '—' : Math.round(m.recovery) + '%';

    // 今月の数字
    const profitState = m.profit > 0 ? '黒字' : m.profit < 0 ? '赤字' : '収支ゼロ';
    document.getElementById('home-stats').innerHTML =
      statTile('今月の売上', yen(m.salesTotal), '手数料 ' + yen(m.feeTotal)) +
      statTile('今月の固定費(月割)', yen(m.fixedMonthly), '契約中の支払額') +
      statTile('今月の経費', yen(m.expTotal), '単発の支出') +
      statTile('今月の利益', yen(m.profit), profitState);

    // 年間累計
    const y = C.yearSummary(db, year, ym);
    const yState = y.profitTotal > 0 ? '黒字' : y.profitTotal < 0 ? '赤字' : '収支ゼロ';
    document.getElementById('home-year').innerHTML =
      statTile(year + '年の累計収支', yen(y.profitTotal), yState) +
      statTile(year + '年の売上/費用', yen(y.salesTotal) + ' / ' + yen(y.costTotal), '費用=手数料+固定費+経費');

    // 月別推移
    document.getElementById('home-trend').innerHTML = y.months.map((r) =>
      '<tr><th scope="row">' + esc(ymLabel(r.ym)) + '</th><td>' + yen(r.salesTotal) + '</td><td>' + yen(r.fixedMonthly) +
      '</td><td>' + yen(r.expTotal) + '</td><td>' + yen(r.profit) + (r.profit < 0 ? '(赤字)' : '') + '</td></tr>'
    ).join('');

    // 商品別利益
    const products = C.productProfit(db, year);
    document.getElementById('home-products').innerHTML = products.length
      ? products.map((p) =>
          '<tr><th scope="row">' + esc(p.name) + '</th><td>' + p.count + '</td><td>' + yen(p.amount) +
          '</td><td>' + yen(p.fee) + '</td><td>' + yen(p.profit) + '</td></tr>').join('')
      : '<tr><td colspan="5" class="empty-note">今年の売上はまだありません</td></tr>';

    // サービス別コスト
    const services = C.serviceCosts(db);
    document.getElementById('home-services').innerHTML = services.length
      ? services.map((s) =>
          '<tr><th scope="row">' + esc(s.name) + '<br><span style="color:var(--ink-3);font-size:11px">' + esc(s.category) + '</span></th>' +
          '<td>' + yen(s.monthly) + '</td><td>' + s.ratio + '%</td><td>' + yen(s.monthlyDeductible) + '</td></tr>').join('')
      : '<tr><td colspan="4" class="empty-note">契約中の固定費はまだ登録されていません</td></tr>';
  }

  /* ---------- 一覧の共通描画(月ごとにまとめる) ---------- */

  function renderGrouped(container, items, rowHtml) {
    if (!items.length) {
      container.innerHTML = '<p class="empty-note">まだ記録がありません</p>';
      return;
    }
    const byMonth = new Map();
    items.slice().sort((a, b) => b.date.localeCompare(a.date)).forEach((it) => {
      const key = it.date.slice(0, 7);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(it);
    });
    container.innerHTML = Array.from(byMonth.entries()).map(([ym, list]) =>
      '<div class="month-head">' + esc(ymLabel(ym)) + '</div><div class="rows">' + list.map(rowHtml).join('') + '</div>'
    ).join('');
  }

  /* ---------- 売上 ---------- */

  const saleForm = {
    form: document.getElementById('form-sale'),
    title: document.getElementById('sale-form-title'),
    date: document.getElementById('s-date'),
    name: document.getElementById('s-name'),
    channel: document.getElementById('s-channel'),
    amount: document.getElementById('s-amount'),
    fee: document.getElementById('s-fee'),
    memo: document.getElementById('s-memo'),
    errors: document.getElementById('sale-errors'),
    submit: document.getElementById('sale-submit'),
    cancel: document.getElementById('sale-cancel'),
    del: document.getElementById('sale-delete'),
    preview: document.getElementById('s-profit-preview'),
    editingId: null,
  };

  function saleFormValues() {
    return {
      date: saleForm.date.value,
      name: saleForm.name.value.trim(),
      channel: saleForm.channel.value.trim(),
      amount: saleForm.amount.value,
      fee: saleForm.fee.value,
      memo: saleForm.memo.value.trim(),
    };
  }

  function resetSaleForm() {
    saleForm.editingId = null;
    saleForm.form.reset();
    saleForm.date.value = todayStr();
    saleForm.fee.value = '0';
    saleForm.title.textContent = '売上を追加';
    saleForm.submit.textContent = '追加する';
    saleForm.cancel.hidden = true;
    saleForm.del.hidden = true;
    saleForm.errors.hidden = true;
    updateSalePreview();
  }

  function updateSalePreview() {
    const a = Number(saleForm.amount.value);
    const f = Number(saleForm.fee.value || 0);
    saleForm.preview.textContent = Number.isFinite(a) && saleForm.amount.value !== '' ? yen(a - f) : '—';
  }
  saleForm.amount.addEventListener('input', updateSalePreview);
  saleForm.fee.addEventListener('input', updateSalePreview);

  saleForm.form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const v = saleFormValues();
    const errors = C.validateSale(v);
    if (errors.length) {
      saleForm.errors.innerHTML = errors.map((e) => '・' + esc(e)).join('<br>');
      saleForm.errors.hidden = false;
      return;
    }
    const rec = {
      id: saleForm.editingId || uid('s'),
      date: v.date, name: v.name, channel: v.channel,
      amount: Number(v.amount), fee: Number(v.fee || 0), memo: v.memo,
    };
    if (saleForm.editingId) {
      const i = db.sales.findIndex((s) => s.id === saleForm.editingId);
      if (i >= 0) db.sales[i] = rec;
      toast('売上を更新しました');
    } else {
      db.sales.push(rec);
      toast('売上を追加しました');
    }
    save();
    resetSaleForm();
    renderAll();
  });

  saleForm.cancel.addEventListener('click', resetSaleForm);
  saleForm.del.addEventListener('click', () => {
    if (!saleForm.editingId) return;
    if (!confirm('この売上を削除します。よろしいですか。')) return;
    db.sales = db.sales.filter((s) => s.id !== saleForm.editingId);
    save();
    resetSaleForm();
    renderAll();
    toast('売上を削除しました');
  });

  function editSale(id) {
    const s = db.sales.find((x) => x.id === id);
    if (!s) return;
    saleForm.editingId = id;
    saleForm.date.value = s.date;
    saleForm.name.value = s.name;
    saleForm.channel.value = s.channel || '';
    saleForm.amount.value = s.amount;
    saleForm.fee.value = s.fee || 0;
    saleForm.memo.value = s.memo || '';
    saleForm.title.textContent = '売上を編集中';
    saleForm.submit.textContent = '更新する';
    saleForm.cancel.hidden = false;
    saleForm.del.hidden = false;
    saleForm.errors.hidden = true;
    updateSalePreview();
    saleForm.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderSales() {
    renderGrouped(document.getElementById('sales-list'), db.sales, (s) =>
      '<button type="button" class="row-item" data-id="' + esc(s.id) + '">' +
        '<span class="t">' + esc(s.name) + '</span>' +
        '<span class="m">' + esc(s.date) + (s.channel ? ' · ' + esc(s.channel) : '') + (s.memo ? ' · ' + esc(s.memo) : '') + '</span>' +
        '<span class="amt">' + yen(s.amount - (s.fee || 0)) + '<span class="sub2">売上' + yen(s.amount) + ' 手数料' + yen(s.fee || 0) + '</span></span>' +
      '</button>');
  }
  document.getElementById('sales-list').addEventListener('click', (ev) => {
    const btn = ev.target.closest('.row-item');
    if (btn) editSale(btn.dataset.id);
  });

  /* ---------- 固定費 ---------- */

  const fixedForm = {
    form: document.getElementById('form-fixed'),
    title: document.getElementById('fixed-form-title'),
    name: document.getElementById('f-name'),
    amount: document.getElementById('f-amount'),
    payDay: document.getElementById('f-payday'),
    renewal: document.getElementById('f-renewal'),
    category: document.getElementById('f-category'),
    account: document.getElementById('f-account'),
    ratio: document.getElementById('f-ratio'),
    errors: document.getElementById('fixed-errors'),
    submit: document.getElementById('fixed-submit'),
    cancel: document.getElementById('fixed-cancel'),
    del: document.getElementById('fixed-delete'),
    monthlyPreview: document.getElementById('f-monthly-preview'),
    deductPreview: document.getElementById('f-deduct-preview'),
    editingId: null,
  };

  const fixedCycle = () => document.querySelector('input[name="f-cycle"]:checked').value;
  const fixedStatus = () => document.querySelector('input[name="f-status"]:checked').value;
  const setRadio = (name, value) => {
    const el = document.querySelector('input[name="' + name + '"][value="' + value + '"]');
    if (el) el.checked = true;
  };

  function fixedFormValues() {
    return {
      name: fixedForm.name.value.trim(),
      amount: fixedForm.amount.value,
      cycle: fixedCycle(),
      payDay: fixedForm.payDay.value,
      renewal: fixedForm.renewal.value,
      category: fixedForm.category.value,
      account: fixedForm.account.value,
      ratio: fixedForm.ratio.value,
      status: fixedStatus(),
    };
  }

  function updateFixedPreview() {
    const a = Number(fixedForm.amount.value);
    const r = Number(fixedForm.ratio.value);
    if (!Number.isFinite(a) || fixedForm.amount.value === '') {
      fixedForm.monthlyPreview.textContent = '—';
      fixedForm.deductPreview.textContent = '—';
      return;
    }
    const monthly = fixedCycle() === 'yearly' ? a / 12 : a;
    fixedForm.monthlyPreview.textContent = yen(monthly);
    fixedForm.deductPreview.textContent = Number.isFinite(r) ? yen(monthly * (r / 100)) : '—';
  }
  ['input', 'change'].forEach((evt) => fixedForm.form.addEventListener(evt, updateFixedPreview));

  function resetFixedForm() {
    fixedForm.editingId = null;
    fixedForm.form.reset();
    fixedForm.ratio.value = '100';
    setRadio('f-cycle', 'monthly');
    setRadio('f-status', 'active');
    fixedForm.title.textContent = '固定費を追加';
    fixedForm.submit.textContent = '追加する';
    fixedForm.cancel.hidden = true;
    fixedForm.del.hidden = true;
    fixedForm.errors.hidden = true;
    updateFixedPreview();
  }

  fixedForm.form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const v = fixedFormValues();
    const errors = C.validateFixed(v);
    if (errors.length) {
      fixedForm.errors.innerHTML = errors.map((e) => '・' + esc(e)).join('<br>');
      fixedForm.errors.hidden = false;
      return;
    }
    const rec = {
      id: fixedForm.editingId || uid('f'),
      name: v.name, amount: Number(v.amount), cycle: v.cycle,
      payDay: v.payDay === '' ? null : Number(v.payDay),
      renewal: v.renewal || null,
      category: v.category, account: v.account,
      ratio: Number(v.ratio), status: v.status,
    };
    if (fixedForm.editingId) {
      const i = db.fixed.findIndex((f) => f.id === fixedForm.editingId);
      if (i >= 0) db.fixed[i] = rec;
      toast('固定費を更新しました');
    } else {
      db.fixed.push(rec);
      toast('固定費を追加しました');
    }
    save();
    resetFixedForm();
    renderAll();
  });

  fixedForm.cancel.addEventListener('click', resetFixedForm);
  fixedForm.del.addEventListener('click', () => {
    if (!fixedForm.editingId) return;
    if (!confirm('この固定費を削除します。記録として残す場合は「解約済み」を選びます。削除しますか。')) return;
    db.fixed = db.fixed.filter((f) => f.id !== fixedForm.editingId);
    save();
    resetFixedForm();
    renderAll();
    toast('固定費を削除しました');
  });

  function editFixed(id) {
    const f = db.fixed.find((x) => x.id === id);
    if (!f) return;
    fixedForm.editingId = id;
    fixedForm.name.value = f.name;
    fixedForm.amount.value = f.amount;
    setRadio('f-cycle', f.cycle || 'monthly');
    fixedForm.payDay.value = f.payDay == null ? '' : f.payDay;
    fixedForm.renewal.value = f.renewal || '';
    fixedForm.category.value = f.category || 'その他';
    fixedForm.account.value = f.account || '通信費';
    fixedForm.ratio.value = f.ratio;
    setRadio('f-status', f.status || 'active');
    fixedForm.title.textContent = '固定費を編集中';
    fixedForm.submit.textContent = '更新する';
    fixedForm.cancel.hidden = false;
    fixedForm.del.hidden = false;
    fixedForm.errors.hidden = true;
    updateFixedPreview();
    fixedForm.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function fixedRowHtml(f) {
    const monthly = C.monthlyAmount(f);
    const meta = [
      f.cycle === 'yearly' ? '年額' + yen(f.amount) : '月額',
      f.category,
      f.payDay ? '毎月' + f.payDay + '日' : null,
      f.renewal ? '更新 ' + f.renewal : null,
      f.status === 'ended' ? '解約済み' : null,
    ].filter(Boolean).join(' · ');
    return '<button type="button" class="row-item' + (f.status === 'ended' ? ' is-ended' : '') + '" data-id="' + esc(f.id) + '">' +
      '<span class="t">' + esc(f.name) + '</span>' +
      '<span class="m">' + esc(meta) + '</span>' +
      '<span class="amt">' + yen(monthly) + '/月<span class="sub2">割合' + f.ratio + '% 算入' + yen(monthly * (f.ratio / 100)) + '/月</span></span>' +
    '</button>';
  }

  function renderFixed() {
    const container = document.getElementById('fixed-list');
    const active = db.fixed.filter((f) => f.status === 'active');
    const ended = db.fixed.filter((f) => f.status !== 'active');
    if (!db.fixed.length) {
      container.innerHTML = '<p class="empty-note">まだ登録がありません</p>';
    } else {
      container.innerHTML =
        (active.length ? '<div class="month-head">契約中 · ' + active.length + '件</div><div class="rows">' +
          active.slice().sort((a, b) => C.monthlyAmount(b) - C.monthlyAmount(a)).map(fixedRowHtml).join('') + '</div>' : '') +
        (ended.length ? '<div class="month-head">解約済み · ' + ended.length + '件</div><div class="rows">' +
          ended.map(fixedRowHtml).join('') + '</div>' : '');
    }
    const monthly = active.reduce((t, f) => t + C.monthlyAmount(f), 0);
    const deduct = active.reduce((t, f) => t + C.monthlyAmount(f) * (f.ratio / 100), 0);
    document.getElementById('fixed-summary').textContent = active.length
      ? '契約中' + active.length + '件 · 月額換算' + yen(monthly) + '(支払額) · 経費算入額' + yen(deduct) + '/月'
      : 'サブスクや年会費など、毎月・毎年かかる費用を登録します。';
  }
  document.getElementById('fixed-list').addEventListener('click', (ev) => {
    const btn = ev.target.closest('.row-item');
    if (btn) editFixed(btn.dataset.id);
  });

  /* ---------- 経費 ---------- */

  const expForm = {
    form: document.getElementById('form-exp'),
    title: document.getElementById('exp-form-title'),
    date: document.getElementById('e-date'),
    payee: document.getElementById('e-payee'),
    amount: document.getElementById('e-amount'),
    account: document.getElementById('e-account'),
    ratio: document.getElementById('e-ratio'),
    purpose: document.getElementById('e-purpose'),
    receipt: document.getElementById('e-receipt'),
    memo: document.getElementById('e-memo'),
    errors: document.getElementById('exp-errors'),
    submit: document.getElementById('exp-submit'),
    cancel: document.getElementById('exp-cancel'),
    del: document.getElementById('exp-delete'),
    preview: document.getElementById('e-deduct-preview'),
    editingId: null,
  };

  function expFormValues() {
    return {
      date: expForm.date.value,
      payee: expForm.payee.value.trim(),
      amount: expForm.amount.value,
      account: expForm.account.value,
      ratio: expForm.ratio.value,
      purpose: expForm.purpose.value.trim(),
      receipt: expForm.receipt.checked,
      memo: expForm.memo.value.trim(),
    };
  }

  function updateExpPreview() {
    const a = Number(expForm.amount.value);
    const r = Number(expForm.ratio.value);
    expForm.preview.textContent =
      Number.isFinite(a) && expForm.amount.value !== '' && Number.isFinite(r) ? yen(C.deductible(a, r)) : '—';
  }
  expForm.amount.addEventListener('input', updateExpPreview);
  expForm.ratio.addEventListener('input', updateExpPreview);

  function resetExpForm() {
    expForm.editingId = null;
    expForm.form.reset();
    expForm.date.value = todayStr();
    expForm.ratio.value = '100';
    expForm.title.textContent = '経費を追加';
    expForm.submit.textContent = '追加する';
    expForm.cancel.hidden = true;
    expForm.del.hidden = true;
    expForm.errors.hidden = true;
    updateExpPreview();
  }

  expForm.form.addEventListener('submit', (ev) => {
    ev.preventDefault();
    const v = expFormValues();
    const errors = C.validateExpense(v);
    if (errors.length) {
      expForm.errors.innerHTML = errors.map((e) => '・' + esc(e)).join('<br>');
      expForm.errors.hidden = false;
      return;
    }
    const rec = {
      id: expForm.editingId || uid('e'),
      date: v.date, payee: v.payee, amount: Number(v.amount),
      account: v.account, ratio: Number(v.ratio),
      purpose: v.purpose, receipt: v.receipt, memo: v.memo,
    };
    if (expForm.editingId) {
      const i = db.expenses.findIndex((x) => x.id === expForm.editingId);
      if (i >= 0) db.expenses[i] = rec;
      toast('経費を更新しました');
    } else {
      db.expenses.push(rec);
      toast('経費を追加しました');
    }
    save();
    resetExpForm();
    renderAll();
  });

  expForm.cancel.addEventListener('click', resetExpForm);
  expForm.del.addEventListener('click', () => {
    if (!expForm.editingId) return;
    if (!confirm('この経費を削除します。よろしいですか。')) return;
    db.expenses = db.expenses.filter((x) => x.id !== expForm.editingId);
    save();
    resetExpForm();
    renderAll();
    toast('経費を削除しました');
  });

  function editExp(id) {
    const e = db.expenses.find((x) => x.id === id);
    if (!e) return;
    expForm.editingId = id;
    expForm.date.value = e.date;
    expForm.payee.value = e.payee;
    expForm.amount.value = e.amount;
    expForm.account.value = e.account || '雑費';
    expForm.ratio.value = e.ratio;
    expForm.purpose.value = e.purpose || '';
    expForm.receipt.checked = !!e.receipt;
    expForm.memo.value = e.memo || '';
    expForm.title.textContent = '経費を編集中';
    expForm.submit.textContent = '更新する';
    expForm.cancel.hidden = false;
    expForm.del.hidden = false;
    expForm.errors.hidden = true;
    updateExpPreview();
    expForm.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderExpenses() {
    renderGrouped(document.getElementById('exp-list'), db.expenses, (e) =>
      '<button type="button" class="row-item" data-id="' + esc(e.id) + '">' +
        '<span class="t">' + esc(e.payee) + '</span>' +
        '<span class="m">' + esc(e.date) + ' · ' + esc(e.account) + (e.purpose ? ' · ' + esc(e.purpose) : '') +
          ' · 証憑' + (e.receipt ? 'あり' : 'なし') + '</span>' +
        '<span class="amt">' + yen(e.amount) + '<span class="sub2">割合' + e.ratio + '% 算入' + yen(C.deductible(e.amount, e.ratio)) + '</span></span>' +
      '</button>');
  }
  document.getElementById('exp-list').addEventListener('click', (ev) => {
    const btn = ev.target.closest('.row-item');
    if (btn) editExp(btn.dataset.id);
  });

  /* ---------- 入力補完(過去の入力から候補を出す) ---------- */

  function renderDatalists() {
    const fill = (id, values) => {
      document.getElementById(id).innerHTML =
        Array.from(new Set(values.filter(Boolean))).map((v) => '<option value="' + esc(v) + '"></option>').join('');
    };
    fill('dl-products', db.sales.map((s) => s.name));
    fill('dl-channels', db.sales.map((s) => s.channel));
    fill('dl-payees', db.expenses.map((e) => e.payee));
  }

  /* ---------- 出力 ---------- */

  function download(filename, text, mime) {
    const blob = new Blob([text], { type: mime || 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function yearOptions(selectEl, withAll) {
    const years = new Set([new Date().getFullYear()]);
    db.sales.concat(db.expenses).forEach((r) => {
      const y = Number(String(r.date).slice(0, 4));
      if (y) years.add(y);
    });
    const list = Array.from(years).sort((a, b) => b - a);
    const cur = selectEl.value;
    selectEl.innerHTML =
      (withAll ? '<option value="">全期間</option>' : '') +
      list.map((y) => '<option value="' + y + '">' + y + '年</option>').join('');
    if (cur && Array.from(selectEl.options).some((o) => o.value === cur)) selectEl.value = cur;
  }

  function renderOut() {
    const monthInput = document.getElementById('out-month');
    if (!monthInput.value) monthInput.value = currentYm();
    yearOptions(document.getElementById('out-year-1'), false);
    yearOptions(document.getElementById('out-year-2'), false);
    yearOptions(document.getElementById('out-year-3'), true);
  }

  document.getElementById('out-monthly-btn').addEventListener('click', () => {
    const ym = document.getElementById('out-month').value;
    if (!/^\d{4}-\d{2}$/.test(ym)) { toast('対象月を選んでください'); return; }
    download('副業帳簿_月次_' + ym + '.csv', C.buildMonthlyCsv(db, ym));
    toast('月次CSVを書き出しました');
  });
  document.getElementById('out-yearly-btn').addEventListener('click', () => {
    const y = Number(document.getElementById('out-year-1').value);
    download('副業帳簿_年次_' + y + '.csv', C.buildYearlyCsv(db, y, currentYm()));
    toast('年次CSVを書き出しました');
  });
  document.getElementById('out-tax-btn').addEventListener('click', () => {
    const y = Number(document.getElementById('out-year-2').value);
    download('副業帳簿_確定申告用経費一覧_' + y + '.csv', C.buildTaxCsv(db, y));
    toast('確定申告用CSVを書き出しました');
  });
  document.getElementById('out-sales-btn').addEventListener('click', () => {
    const v = document.getElementById('out-year-3').value;
    const y = v ? Number(v) : null;
    download('副業帳簿_売上一覧_' + (y || '全期間') + '.csv', C.buildSalesCsv(db, y));
    toast('売上一覧CSVを書き出しました');
  });

  /* ---------- バックアップ ---------- */

  document.getElementById('backup-export-btn').addEventListener('click', () => {
    const payload = { app: 'bridge-keiri', version: 1, exportedAt: todayStr(), data: db };
    download('副業帳簿_バックアップ_' + todayStr() + '.json', JSON.stringify(payload, null, 2), 'application/json');
    toast('バックアップを書き出しました');
  });

  const backupFile = document.getElementById('backup-file');
  document.getElementById('backup-import-btn').addEventListener('click', () => backupFile.click());
  backupFile.addEventListener('change', () => {
    const file = backupFile.files && backupFile.files[0];
    backupFile.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      let incoming = null;
      try {
        const parsed = JSON.parse(String(reader.result));
        incoming = normalizeDb(parsed && parsed.app === 'bridge-keiri' ? parsed.data : parsed);
      } catch (e) { /* 下のnullチェックで弾く */ }
      if (!incoming) {
        toast('読み込めませんでした。この帳簿のバックアップJSONを選んでください');
        return;
      }
      const n = incoming.fixed.length + incoming.sales.length + incoming.expenses.length;
      if (!confirm('バックアップ(' + n + '件)で現在のデータを置き換えます。今のデータは消えます。よろしいですか。')) return;
      db = incoming;
      save();
      renderAll();
      toast('バックアップを読み込みました');
    };
    reader.readAsText(file);
  });

  /* ---------- 全体描画・初期化 ---------- */

  function renderAll() {
    renderHome();
    renderSales();
    renderFixed();
    renderExpenses();
    renderDatalists();
    renderOut();
  }

  resetSaleForm();
  resetFixedForm();
  resetExpForm();
  renderAll();
  show('home');
})();
