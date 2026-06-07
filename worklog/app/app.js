/* ============================================================
 * CxO Roadmap Log — UI / ルーティング / 描画
 * vanilla JS。schema.js(型) と store.js(保存) に依存。
 * ============================================================ */
(function () {
  'use strict';
  const S = CXO.schema;
  const DB = CXO.store;

  // ---------- 小さな DOM ヘルパ ----------
  function h(tag, attrs, children) {
    const e = document.createElement(tag);
    if (attrs) for (const k in attrs) {
      const v = attrs[k];
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k === 'html') e.innerHTML = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    if (children != null) (Array.isArray(children) ? children : [children]).forEach(c => {
      if (c == null || c === false) return;
      e.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
    });
    return e;
  }
  const $ = sel => document.querySelector(sel);

  // ---------- 日付/週/月ユーティリティ ----------
  const today = S.today();
  const curMonth = today.slice(0, 7);
  const curWeek = S.isoWeek(new Date());
  const inMonth = (d, m) => (d || '').slice(0, 7) === m;
  function fmtDate(d) {
    if (!d) return '';
    const p = d.split('-'); return p.length === 3 ? `${p[1]}/${p[2]}` : d;
  }
  function weekday(d) {
    try { return ['日', '月', '火', '水', '木', '金', '土'][new Date(d + 'T00:00:00').getDay()]; } catch (e) { return ''; }
  }

  // ---------- ナビ ----------
  const NAV = [
    ['', 'ホーム'], ['daily', '日次'], ['cases', '案件'], ['numbers', '数字成果'],
    ['weekly', '週次'], ['monthly', '月次'], ['skills', 'スキル'], ['export', '出力'],
  ];
  function renderNav(active) {
    return h('nav', { class: 'nav' }, NAV.map(([k, label]) =>
      h('a', { class: 'nav-chip' + (active === k ? ' active' : ''), href: '#/' + k }, label)));
  }

  // ---------- 汎用フォーム ----------
  // formDef(schema.forms.x), data(対象オブジェクト) → {node, collect}
  function buildForm(formDef, data) {
    const inputs = {};
    function control(f) {
      const id = 'f_' + f.key;
      const val = data[f.key];
      let el;
      if (f.type === 'textarea') {
        el = h('textarea', { id, rows: f.rows || 3, placeholder: f.placeholder || '' });
        el.value = val || '';
      } else if (f.type === 'select') {
        el = h('select', { id }, [''].concat(f.options || []).map(o =>
          h('option', { value: o, selected: String(val || '') === String(o) ? true : null }, o === '' ? '—' : o)));
        el.value = val || '';
      } else if (f.type === 'caseRef') {
        const opts = DB.cases.all();
        el = h('select', { id }, [h('option', { value: '' }, '— 関連案件なし —')].concat(
          opts.map(c => h('option', { value: c.id, selected: val === c.id ? true : null }, c.title))));
        el.value = val || '';
      } else if (f.type === 'checkbox') {
        el = h('input', { id, type: 'checkbox' });
        el.checked = !!val;
      } else if (f.type === 'tags') {
        el = h('input', { id, type: 'text', placeholder: f.placeholder || '' });
        el.value = Array.isArray(val) ? val.join(', ') : (val || '');
      } else {
        el = h('input', { id, type: f.type === 'number' ? 'number' : (f.type === 'date' ? 'date' : 'text'), placeholder: f.placeholder || '' });
        if (f.min != null) el.min = f.min; if (f.max != null) el.max = f.max;
        el.value = val || '';
      }
      inputs[f.key] = { el, type: f.type };
      return el;
    }

    function fieldRow(f) {
      if (f.type === 'checkbox') {
        return h('label', { class: 'field field-check' }, [control(f), h('span', null, f.label)]);
      }
      return h('label', { class: 'field' + (f.required ? ' req' : '') }, [
        h('span', { class: 'field-label' }, f.label),
        control(f),
        f.hint ? h('span', { class: 'field-hint' }, f.hint) : null,
      ]);
    }

    const sections = formDef.sections.map((s, i) => {
      const body = h('div', { class: 'card-body' }, [
        s.hint ? h('p', { class: 'sec-hint' }, s.hint) : null,
        h('div', { class: 'fields' }, s.fields.map(fieldRow)),
      ]);
      if (s.open) {
        return h('section', { class: 'card' }, [h('div', { class: 'card-head' }, s.title), body]);
      }
      const d = h('details', { class: 'card' }, [h('summary', { class: 'card-head' }, s.title), body]);
      return d;
    });

    const node = h('form', { class: 'form', onsubmit: e => e.preventDefault() }, sections);

    function collect() {
      const out = Object.assign({}, data);
      Object.keys(inputs).forEach(key => {
        const { el, type } = inputs[key];
        if (type === 'checkbox') out[key] = el.checked;
        else if (type === 'tags') out[key] = el.value.split(/[,、\n]/).map(s => s.trim()).filter(Boolean);
        else out[key] = el.value.trim();
      });
      return out;
    }
    return { node, collect };
  }

  // 必須チェック
  function validate(formDef, obj) {
    for (const s of formDef.sections) for (const f of s.fields) {
      if (f.required && !String(obj[f.key] || '').trim()) return f.label;
    }
    return null;
  }

  // 保存バー(下部固定)
  function saveBar(label, onSave, onCancel) {
    return h('div', { class: 'savebar' }, [
      h('button', { class: 'btn ghost', type: 'button', onclick: onCancel }, 'キャンセル'),
      h('button', { class: 'btn primary', type: 'button', onclick: onSave }, label || '保存'),
    ]);
  }

  // ---------- ページ枠 ----------
  function page(title, sub, body, headExtra) {
    return h('div', null, [
      h('header', { class: 'phead' }, [
        h('div', null, [h('h1', { class: 'ptitle' }, title), sub ? h('p', { class: 'psub' }, sub) : null]),
        headExtra || null,
      ]),
      body,
    ]);
  }
  const addBtn = (href, label) => h('a', { class: 'btn primary sm', href }, label);

  function empty(msg) { return h('div', { class: 'empty' }, msg); }
  function badge(text, cls) { return h('span', { class: 'badge ' + (cls || '') }, text); }
  function copyBtn(getText) {
    return h('button', { class: 'btn ghost xs', type: 'button', onclick: function () {
      const t = typeof getText === 'function' ? getText() : getText;
      navigator.clipboard && navigator.clipboard.writeText(t);
      this.textContent = 'コピー済'; setTimeout(() => { this.textContent = 'コピー'; }, 1200);
    } }, 'コピー');
  }

  // ============================================================
  // ダッシュボード
  // ============================================================
  function viewDashboard() {
    const daily = DB.dailyLogs.all(), cs = DB.cases.all(), nums = DB.numbers.all();
    const wk = DB.weekly.all(), mo = DB.monthly.all(), sk = DB.skills.all();

    const monthDaily = daily.filter(d => inMonth(d.date, curMonth));
    const monthCases = cs.filter(c => inMonth(c.date, curMonth));
    const candidates = daily.filter(d => d.status === '実績候補');
    const done = daily.filter(d => d.status === '実績化済み');
    const highCases = cs.filter(c => c.importance === '高');
    const uncalced = nums.filter(n => !String(n.monetary || '').trim());
    const weekDone = wk.some(w => w.week === curWeek);
    const monthDone = mo.some(m => m.month === curMonth);
    const progVals = sk.map(s => Number(s.progress) || 0);
    const avgProg = progVals.length ? Math.round(progVals.reduce((a, b) => a + b, 0) / progVals.length) : 0;

    const stat = (n, label, cls) => h('a', { class: 'stat ' + (cls || ''), href: '#/' + (label.indexOf('日次') >= 0 ? 'daily' : '') }, [
      h('div', { class: 'stat-n' }, String(n)), h('div', { class: 'stat-l' }, label)]);

    const stats = h('div', { class: 'stat-grid' }, [
      h('div', { class: 'stat' }, [h('div', { class: 'stat-n' }, String(monthDaily.length)), h('div', { class: 'stat-l' }, '今月の日次ログ')]),
      h('div', { class: 'stat' }, [h('div', { class: 'stat-n' }, String(monthCases.length)), h('div', { class: 'stat-l' }, '今月の案件ログ')]),
      h('div', { class: 'stat' }, [h('div', { class: 'stat-n accent' }, String(candidates.length)), h('div', { class: 'stat-l' }, '実績候補')]),
      h('div', { class: 'stat' }, [h('div', { class: 'stat-n' }, String(done.length)), h('div', { class: 'stat-l' }, '実績化済み')]),
      h('div', { class: 'stat' }, [h('div', { class: 'stat-n' }, String(nums.length)), h('div', { class: 'stat-l' }, '数字成果')]),
      h('div', { class: 'stat' }, [h('div', { class: 'stat-n' }, String(highCases.length)), h('div', { class: 'stat-l' }, '高重要度案件')]),
      h('div', { class: 'stat' }, [h('div', { class: 'stat-n warn' }, String(uncalced.length)), h('div', { class: 'stat-l' }, '未計算の数字')]),
      h('div', { class: 'stat' }, [h('div', { class: 'stat-n' }, avgProg + '%'), h('div', { class: 'stat-l' }, 'スキル平均進捗')]),
    ]);

    const reviewRow = h('div', { class: 'pill-row' }, [
      h('span', { class: 'pill ' + (weekDone ? 'ok' : 'todo') }, weekDone ? '今週レビュー済' : '今週レビュー未'),
      h('span', { class: 'pill ' + (monthDone ? 'ok' : 'todo') }, monthDone ? '今月レビュー済' : '今月レビュー未'),
    ]);

    const quick = h('div', { class: 'quick' }, [
      h('a', { class: 'btn primary', href: '#/daily/new' }, '＋ 日次ログ'),
      h('a', { class: 'btn', href: '#/cases/new' }, '＋ 案件ログ'),
      h('a', { class: 'btn', href: '#/weekly/new' }, '＋ 週次レビュー'),
      h('a', { class: 'btn', href: '#/monthly/new' }, '＋ 月次レビュー'),
    ]);

    // 次に追うべき数字
    const futures = [];
    cs.forEach(c => { if (c.futureMetrics) futures.push(c.futureMetrics); });
    nums.forEach(n => { if (n.futureMetric) futures.push(n.futureMetric); });
    const futureList = futures.length
      ? h('ul', { class: 'mini-list' }, futures.slice(0, 6).map(f => h('li', null, f)))
      : empty('案件・数字成果に「今後追う数字」を書くとここに出ます。');

    const recentCand = candidates.slice(0, 4);
    const recentNums = nums.slice(0, 3);

    return page('CxO Roadmap Log', '日々の現場仕事を、CxO候補としての実績ログに変換する。', h('div', null, [
      quick,
      stats,
      reviewRow,
      h('section', { class: 'block' }, [
        h('div', { class: 'block-head' }, ['次に追うべき数字']),
        futureList,
      ]),
      h('section', { class: 'block' }, [
        h('div', { class: 'block-head' }, ['直近の実績候補', h('a', { class: 'link', href: '#/daily' }, '一覧 →')]),
        recentCand.length ? h('div', { class: 'list' }, recentCand.map(dailyCard)) : empty('実績候補はまだありません。日次ログのステータスを「実績候補」に。'),
      ]),
      h('section', { class: 'block' }, [
        h('div', { class: 'block-head' }, ['直近の数字成果', h('a', { class: 'link', href: '#/numbers' }, '一覧 →')]),
        recentNums.length ? h('div', { class: 'cards-num' }, recentNums.map(numberCard)) : empty('数字成果はまだありません。'),
      ]),
    ]));
  }

  // ============================================================
  // 日次ログ
  // ============================================================
  function dailyCard(d) {
    return h('a', { class: 'item', href: '#/daily/edit/' + d.id }, [
      h('div', { class: 'item-meta' }, [
        h('span', { class: 'date' }, fmtDate(d.date) + '（' + weekday(d.date) + '）'),
        badge(d.status || 'メモ', 'st-' + (d.status || 'メモ')),
        d.promote ? badge('実績化予定', 'accent') : null,
      ]),
      h('div', { class: 'item-body' }, d.memo || '(メモなし)'),
      d.project ? h('div', { class: 'item-sub' }, '案件: ' + d.project) : null,
    ]);
  }

  function viewDailyList() {
    const all = DB.dailyLogs.all();
    return page('日次ログ', 'スマホで雑に入力 → あとから実績ログへ昇格。', h('div', null, [
      all.length ? h('div', { class: 'list' }, all.map(dailyCard)) : empty('まだ日次ログがありません。右下から追加。'),
    ]), addBtn('#/daily/new', '＋ 追加'));
  }

  function viewDailyForm(id) {
    const isNew = !id;
    const data = isNew ? S.factories.daily() : DB.dailyLogs.get(id);
    if (!data) return notFound();
    const { node, collect } = buildForm(S.forms.daily, data);

    const convert = !isNew ? h('div', { class: 'card' }, [
      h('div', { class: 'card-body' }, [
        h('p', { class: 'sec-hint' }, 'このメモを案件ログに引き継いで詳細化します。'),
        h('button', { class: 'btn primary block', type: 'button', onclick: () => {
          const cur = collect(); cur.id = data.id; DB.dailyLogs.upsert(cur);
          location.hash = '#/cases/new?from=' + data.id;
        } }, '実績ログに変換 →'),
      ]),
    ]) : null;

    function save() {
      const obj = collect(); const miss = validate(S.forms.daily, obj);
      if (miss) return alert(miss + ' は必須です');
      if (!isNew) obj.id = data.id;
      DB.dailyLogs.upsert(obj);
      location.hash = '#/daily';
    }
    return page(isNew ? '日次ログを追加' : '日次ログを編集', null, h('div', null, [
      node, convert,
      !isNew ? deleteRow(() => { DB.dailyLogs.remove(data.id); location.hash = '#/daily'; }) : null,
      saveBar('保存', save, () => history.back()),
    ]));
  }

  // ============================================================
  // 案件ログ
  // ============================================================
  function caseCard(c) {
    return h('a', { class: 'item', href: '#/cases/view/' + c.id }, [
      h('div', { class: 'item-meta' }, [
        h('span', { class: 'date' }, fmtDate(c.date)),
        badge(c.category || '', 'cat'),
        badge(c.state || '', 'state'),
        c.importance === '高' ? badge('重要度 高', 'high') : null,
      ]),
      h('div', { class: 'item-title' }, c.title || '(無題)'),
      (c.before || c.after) ? h('div', { class: 'ba-mini' }, [
        h('span', { class: 'ba-b' }, c.before || '—'), h('span', { class: 'ba-arrow' }, '→'),
        h('span', { class: 'ba-a' }, c.after || '—'),
        c.improvement ? h('span', { class: 'ba-up' }, c.improvement) : null,
      ]) : null,
    ]);
  }

  function viewCaseList() {
    const all = DB.cases.all();
    return page('案件ログ', '背景〜経営的意味〜キャリア転用まで、CxO実績として残す。', h('div', null, [
      all.length ? h('div', { class: 'list' }, all.map(caseCard)) : empty('まだ案件ログがありません。'),
    ]), addBtn('#/cases/new', '＋ 追加'));
  }

  function viewCaseForm(id, query) {
    const isNew = !id;
    let data = isNew ? S.factories.case() : DB.cases.get(id);
    if (!data) return notFound();

    // 日次ログからの引き継ぎ
    let fromDaily = null;
    if (isNew && query && query.from) {
      const d = DB.dailyLogs.get(query.from);
      if (d) {
        fromDaily = d.id;
        data.title = d.project || '';
        data.date = d.date || today;
        data.stakeholders = d.stakeholders || [];
        data.targetMetrics = d.relatedNumbers || '';
        data.rawMemo = [d.memo, d.cxoInsight ? ('CxO視点: ' + d.cxoInsight) : ''].filter(Boolean).join('\n');
      }
    }
    const { node, collect } = buildForm(S.forms.case, data);
    function save() {
      const obj = collect(); const miss = validate(S.forms.case, obj);
      if (miss) return alert(miss + ' は必須です');
      if (!isNew) obj.id = data.id;
      const saved = DB.cases.upsert(obj);
      if (fromDaily) {
        const d = DB.dailyLogs.get(fromDaily);
        if (d) { d.status = '実績化済み'; d.caseId = saved.id; DB.dailyLogs.upsert(d); }
      }
      location.hash = '#/cases/view/' + saved.id;
    }
    return page(isNew ? '案件ログを追加' : '案件ログを編集',
      fromDaily ? '日次ログから引き継ぎました。' : null, h('div', null, [
        node,
        !isNew ? deleteRow(() => { DB.cases.remove(data.id); location.hash = '#/cases'; }) : null,
        saveBar('保存', save, () => history.back()),
      ]));
  }

  function viewCaseDetail(id) {
    const c = DB.cases.get(id);
    if (!c) return notFound();
    function group(title, rows) {
      const filled = rows.filter(r => r[1] && String(r[1]).trim());
      if (!filled.length) return null;
      return h('section', { class: 'block' }, [
        h('div', { class: 'block-head' }, title),
        h('div', { class: 'kv' }, filled.map(([k, v]) => h('div', { class: 'kv-row' }, [
          h('div', { class: 'kv-k' }, k), h('div', { class: 'kv-v' }, String(v))]))),
      ]);
    }
    const head = h('div', null, [
      h('div', { class: 'item-meta' }, [
        h('span', { class: 'date' }, fmtDate(c.date)), badge(c.category, 'cat'),
        badge(c.state, 'state'), c.importance === '高' ? badge('重要度 高', 'high') : badge('重要度 ' + c.importance, ''),
      ]),
      (c.before || c.after) ? baBlock(c.before, c.after, c.improvement, c.monetary) : null,
      h('div', { class: 'detail-actions' }, [
        h('a', { class: 'btn sm', href: '#/cases/edit/' + c.id }, '編集'),
        c.stakeholders && c.stakeholders.length ? badge('関係者: ' + c.stakeholders.join('、'), '') : null,
      ]),
    ]);
    return page(c.title, c.oneLiner || null, h('div', null, [
      head,
      group('現状整理', [['背景', c.background], ['現状', c.current], ['課題', c.issue], ['ボトルネック', c.bottleneck], ['現場の反応', c.fieldReaction]]),
      group('数字', [['追う数字', c.targetMetrics], ['Before', c.before], ['After', c.after], ['改善幅', c.improvement], ['金額換算', c.monetary || '未計算'], ['まだ未計算の数字', c.uncalculated], ['今後追うべき数字', c.futureMetrics]]),
      group('打ち手', [['自分の関与', c.involvement], ['実施した施策', c.measures], ['関係者への働きかけ', c.stakeholderEngagement], ['オペレーション変更', c.opsChange], ['仕組み化', c.systematized]]),
      group('成果', [['実現した成果', c.achieved], ['検証中の成果', c.validating], ['定性的な変化', c.qualitative], ['定量的な変化', c.quantitative]]),
      group('経営的な意味', [['売上', c.bizRevenue], ['利益', c.bizProfit], ['生産性', c.bizProductivity], ['採用・定着', c.bizHiring], ['組織運営', c.bizOrg], ['リスク低減', c.bizRisk]]),
      group('再利用できる型', [['学び', c.learning], ['横展開', c.horizontal], ['テンプレート', c.template], ['標準フロー', c.standardFlow]]),
      group('キャリア転用', [['職務経歴書', c.resume], ['LinkedIn', c.linkedin], ['昇格面談', c.promotion], ['1行サマリー', c.oneLiner]]),
      group('下書き(AI補正)', [['雑メモ', c.rawMemo], ['AI補正後', c.aiCorrected], ['確定ログ', c.confirmed]]),
    ]));
  }

  function baBlock(before, after, imp, money) {
    return h('div', { class: 'ba' }, [
      h('div', { class: 'ba-cell b' }, [h('div', { class: 'ba-lbl' }, 'Before'), h('div', { class: 'ba-val' }, before || '—')]),
      h('div', { class: 'ba-arrow2' }, '→'),
      h('div', { class: 'ba-cell a' }, [h('div', { class: 'ba-lbl' }, 'After'), h('div', { class: 'ba-val' }, after || '—')]),
      imp ? h('div', { class: 'ba-cell up' }, [h('div', { class: 'ba-lbl' }, '改善幅'), h('div', { class: 'ba-val big' }, imp)]) : null,
      h('div', { class: 'ba-cell money' }, [h('div', { class: 'ba-lbl' }, '金額換算'),
        String(money || '').trim() ? h('div', { class: 'ba-val money-on' }, money) : h('div', { class: 'ba-val uncalc' }, '未計算')]),
    ]);
  }

  // ============================================================
  // 数字成果
  // ============================================================
  function numberCard(n) {
    const rel = n.relatedCaseId ? DB.cases.get(n.relatedCaseId) : null;
    return h('a', { class: 'card-num', href: '#/numbers/edit/' + n.id }, [
      h('div', { class: 'cn-head' }, [h('div', { class: 'cn-name' }, n.name || '(無題)'), badge(n.area || '', 'cat')]),
      baBlock(numWithUnit(n.before, n.unit), numWithUnit(n.after, n.unit), n.improvement, n.monetary),
      n.businessMeaning ? h('div', { class: 'cn-meaning' }, n.businessMeaning) : null,
      !String(n.monetary || '').trim() && n.futureMetric ? h('div', { class: 'cn-future' }, '今後計算: ' + n.futureMetric) : null,
      rel ? h('div', { class: 'cn-rel' }, '関連: ' + rel.title) : null,
    ]);
  }
  function numWithUnit(v, unit) { if (!v) return '—'; return unit ? v + ' ' + unit : v; }

  function viewNumberList() {
    const all = DB.numbers.all();
    const uncalced = all.filter(n => !String(n.monetary || '').trim());
    return page('数字成果', 'CxO候補として語れる Before/After を整理。', h('div', null, [
      uncalced.length ? h('div', { class: 'note warn' }, '未計算の数字: ' + uncalced.length + ' 件 — 金額換算すると実績の説得力が上がります。') : null,
      all.length ? h('div', { class: 'cards-num' }, all.map(numberCard)) : empty('まだ数字成果がありません。'),
    ]), addBtn('#/numbers/new', '＋ 追加'));
  }

  function viewNumberForm(id) {
    const isNew = !id;
    const data = isNew ? S.factories.number() : DB.numbers.get(id);
    if (!data) return notFound();
    const { node, collect } = buildForm(S.forms.number, data);
    function save() {
      const obj = collect(); const miss = validate(S.forms.number, obj);
      if (miss) return alert(miss + ' は必須です');
      if (!isNew) obj.id = data.id;
      DB.numbers.upsert(obj);
      location.hash = '#/numbers';
    }
    return page(isNew ? '数字成果を追加' : '数字成果を編集', null, h('div', null, [
      node,
      !isNew ? deleteRow(() => { DB.numbers.remove(data.id); location.hash = '#/numbers'; }) : null,
      saveBar('保存', save, () => history.back()),
    ]));
  }

  // ============================================================
  // 週次レビュー
  // ============================================================
  function viewWeeklyList() {
    const all = DB.weekly.all();
    return page('週次レビュー', null, h('div', null, [
      all.length ? h('div', { class: 'list' }, all.map(w => h('a', { class: 'item', href: '#/weekly/edit/' + w.id }, [
        h('div', { class: 'item-meta' }, [h('span', { class: 'date' }, w.week), w.selfRating ? badge('自己評価 ' + w.selfRating, '') : null]),
        h('div', { class: 'item-body' }, w.mainCases || '(内容なし)'),
      ]))) : empty('まだ週次レビューがありません。'),
    ]), addBtn('#/weekly/new', '＋ 追加'));
  }

  function viewWeeklyForm(id) {
    const isNew = !id;
    const data = isNew ? S.factories.weekly() : DB.weekly.get(id);
    if (!data) return notFound();
    // 今週の日次ログ参照
    const weekStr = isNew ? curWeek : data.week;
    const weekDaily = DB.dailyLogs.all().filter(d => S.isoWeek(new Date(d.date + 'T00:00:00')) === weekStr);
    const cand = weekDaily.filter(d => d.status === '実績候補');
    const refBox = h('div', { class: 'card' }, [
      h('div', { class: 'card-head' }, '今週の日次ログ（参照）'),
      h('div', { class: 'card-body' }, [
        h('p', { class: 'sec-hint' }, weekStr + ' の日次ログ ' + weekDaily.length + ' 件 / 実績候補 ' + cand.length + ' 件'),
        cand.length ? h('div', { class: 'list' }, cand.map(d => h('div', { class: 'item flat' }, [
          h('div', { class: 'item-body' }, d.memo),
          h('a', { class: 'btn ghost xs', href: '#/cases/new?from=' + d.id }, '案件ログ化 →'),
        ]))) : empty('今週の実績候補はありません。'),
      ]),
    ]);
    const { node, collect } = buildForm(S.forms.weekly, data);
    function save() {
      const obj = collect(); const miss = validate(S.forms.weekly, obj);
      if (miss) return alert(miss + ' は必須です');
      if (!isNew) obj.id = data.id;
      DB.weekly.upsert(obj);
      location.hash = '#/weekly';
    }
    return page(isNew ? '週次レビューを書く' : '週次レビューを編集', null, h('div', null, [
      refBox, node,
      !isNew ? deleteRow(() => { DB.weekly.remove(data.id); location.hash = '#/weekly'; }) : null,
      saveBar('保存', save, () => history.back()),
    ]));
  }

  // ============================================================
  // 月次レビュー
  // ============================================================
  function viewMonthlyList() {
    const all = DB.monthly.all();
    return page('月次レビュー', 'CxOロードマップ上の進捗を月単位で。', h('div', null, [
      all.length ? h('div', { class: 'list' }, all.map(m => h('a', { class: 'item', href: '#/monthly/edit/' + m.id }, [
        h('div', { class: 'item-meta' }, [h('span', { class: 'date' }, m.month)]),
        h('div', { class: 'item-body' }, m.repCases || '(内容なし)'),
        m.resumeLine ? h('div', { class: 'item-sub' }, '職務経歴書: ' + m.resumeLine) : null,
      ]))) : empty('まだ月次レビューがありません。'),
    ]), addBtn('#/monthly/new', '＋ 追加'));
  }

  function viewMonthlyForm(id) {
    const isNew = !id;
    const data = isNew ? S.factories.monthly() : DB.monthly.get(id);
    if (!data) return notFound();
    const m = isNew ? curMonth : data.month;
    const monthCases = DB.cases.all().filter(c => inMonth(c.date, m));
    const monthNums = DB.numbers.all().filter(n => inMonth(n.date, m));
    const refBox = h('div', { class: 'card' }, [
      h('div', { class: 'card-head' }, '今月の実績（参照）'),
      h('div', { class: 'card-body' }, [
        h('p', { class: 'sec-hint' }, m + '：案件 ' + monthCases.length + ' 件 / 数字成果 ' + monthNums.length + ' 件'),
      ]),
    ]);
    const { node, collect } = buildForm(S.forms.monthly, data);
    function save() {
      const obj = collect(); const miss = validate(S.forms.monthly, obj);
      if (miss) return alert(miss + ' は必須です');
      if (!isNew) obj.id = data.id;
      DB.monthly.upsert(obj);
      location.hash = '#/monthly';
    }
    return page(isNew ? '月次レビューを書く' : '月次レビューを編集', null, h('div', null, [
      refBox, node,
      !isNew ? deleteRow(() => { DB.monthly.remove(data.id); location.hash = '#/monthly'; }) : null,
      saveBar('保存', save, () => history.back()),
    ]));
  }

  // ============================================================
  // スキルマップ
  // ============================================================
  function viewSkills() {
    const all = DB.skills.all();
    const cards = all.map(s => {
      const cur = Number(s.currentLevel) || 0, tgt = Number(s.targetLevel) || 0;
      const gap = tgt - cur;
      const prog = Number(s.progress) || 0;
      return h('a', { class: 'item', href: '#/skills/edit/' + s.id }, [
        h('div', { class: 'item-meta' }, [
          h('span', { class: 'skill-name' }, s.name),
          s.currentLevel ? badge('Lv ' + s.currentLevel + (s.targetLevel ? ' → ' + s.targetLevel : ''), '') : badge('未設定', 'muted'),
          gap > 0 ? badge('ギャップ ' + gap, 'warn') : null,
        ]),
        h('div', { class: 'bar' }, [h('div', { class: 'bar-fill', style: 'width:' + prog + '%' })]),
        s.thisYearExperience ? h('div', { class: 'item-sub' }, '今年取りに行く: ' + s.thisYearExperience) : null,
      ]);
    });
    return page('スキルマップ', '現在レベルと目標レベルのギャップを、取りに行く経験で埋める。', h('div', null, [
      all.length ? h('div', { class: 'list' }, cards) : empty('スキルがありません。'),
    ]), addBtn('#/skills/new', '＋ 追加'));
  }

  function viewSkillForm(id) {
    const isNew = !id;
    const data = isNew ? S.factories.skill() : DB.skills.get(id);
    if (!data) return notFound();
    const { node, collect } = buildForm(S.forms.skill, data);
    function save() {
      const obj = collect(); const miss = validate(S.forms.skill, obj);
      if (miss) return alert(miss + ' は必須です');
      if (!isNew) obj.id = data.id;
      DB.skills.upsert(obj);
      location.hash = '#/skills';
    }
    return page(isNew ? 'スキルを追加' : 'スキルを編集', null, h('div', null, [
      node,
      !isNew ? deleteRow(() => { DB.skills.remove(data.id); location.hash = '#/skills'; }) : null,
      saveBar('保存', save, () => history.back()),
    ]));
  }

  // ============================================================
  // 出力
  // ============================================================
  function viewExport() {
    const cs = DB.cases.all();
    const nz = v => String(v || '').trim();
    const pick = (...vals) => { for (const v of vals) if (nz(v)) return nz(v); return '—'; };

    // 職務経歴書用(背景/課題/打ち手/成果/経営的意味/再現性)
    const resumeText = cs.map(c => {
      return [
        '■ ' + (c.title || '(無題)') + '（' + (c.date || '') + ' / ' + (c.category || '') + '）',
        '背景: ' + pick(c.background),
        '課題: ' + pick(c.issue),
        '打ち手: ' + pick(c.measures, c.involvement, c.opsChange),
        '成果: ' + pick(c.achieved, c.resume),
        '経営的な意味: ' + pick(c.bizProductivity, c.bizRevenue, c.bizOrg),
        '再現性: ' + pick(c.horizontal, c.standardFlow, c.learning),
      ].join('\n');
    }).join('\n\n');

    const linkedinText = cs.map(c => pick(c.linkedin, c.resume, c.oneLiner)).filter(t => t !== '—').join('\n\n');
    const promoText = cs.map(c => pick(c.promotion, c.resume, c.oneLiner)).filter(t => t !== '—').join('\n\n');

    // 1行実績リスト(スプレッドシート貼付)
    const header = ['日付', '案件名', 'カテゴリ', 'Before', 'After', '改善幅', '打ち手', '成果', '経営的な意味', '今後追う数字'].join('｜');
    const rows = cs.map(c => [
      c.date || '', c.title || '', c.category || '', c.before || '', c.after || '', c.improvement || '',
      pick(c.measures, c.involvement).replace(/\n/g, ' '),
      pick(c.achieved).replace(/\n/g, ' '),
      pick(c.bizProductivity, c.bizRevenue).replace(/\n/g, ' '),
      c.futureMetrics || '',
    ].join('｜'));
    const lineList = [header].concat(rows).join('\n');

    function outBlock(title, hint, text) {
      const ta = h('textarea', { class: 'out', rows: 8, readonly: true }, null);
      ta.value = text || '（データがありません。案件ログを追加してください）';
      return h('section', { class: 'block' }, [
        h('div', { class: 'block-head' }, [title, copyBtn(() => ta.value)]),
        hint ? h('p', { class: 'sec-hint' }, hint) : null,
        ta,
      ]);
    }

    return page('出力', '職務経歴書・LinkedIn・昇格面談・スプレッドシートへ転用。', h('div', null, [
      outBlock('職務経歴書用サマリー', '背景→課題→打ち手→成果→経営的な意味→再現性。', resumeText),
      outBlock('LinkedIn用サマリー', 'やや外向け。盛りすぎないこと。', linkedinText),
      outBlock('昇格面談用サマリー', '社内向け。実務成果として自然な表現。', promoText),
      outBlock('1行実績リスト（スプレッドシート貼付）', '区切りは ｜（全角パイプ）。', lineList),
    ]));
  }

  // ---------- 共通: 削除行 / NotFound ----------
  function deleteRow(onDelete) {
    return h('div', { class: 'del-row' }, [
      h('button', { class: 'btn danger ghost xs', type: 'button', onclick: () => { if (confirm('削除しますか？')) onDelete(); } }, '削除'),
    ]);
  }
  function notFound() { return page('見つかりません', null, empty('データが見つかりませんでした。')); }

  // ============================================================
  // ルーター
  // ============================================================
  function parseHash() {
    const raw = (location.hash || '#/').replace(/^#\/?/, '');
    const [path, qs] = raw.split('?');
    const parts = path.split('/').filter(Boolean);
    const query = {};
    if (qs) qs.split('&').forEach(kv => { const [k, v] = kv.split('='); query[decodeURIComponent(k)] = decodeURIComponent(v || ''); });
    return { parts, query };
  }

  function route() {
    const { parts, query } = parseHash();
    const [a, b, c] = parts;
    let view, active = a || '';
    switch (a) {
      case undefined: view = viewDashboard(); break;
      case 'daily':
        view = !b ? viewDailyList() : b === 'new' ? viewDailyForm(null) : b === 'edit' ? viewDailyForm(c) : viewDailyList();
        break;
      case 'cases':
        view = !b ? viewCaseList() : b === 'new' ? viewCaseForm(null, query) : b === 'edit' ? viewCaseForm(c) : b === 'view' ? viewCaseDetail(c) : viewCaseList();
        break;
      case 'numbers':
        view = !b ? viewNumberList() : b === 'new' ? viewNumberForm(null) : b === 'edit' ? viewNumberForm(c) : viewNumberList();
        break;
      case 'weekly':
        view = !b ? viewWeeklyList() : b === 'new' ? viewWeeklyForm(null) : b === 'edit' ? viewWeeklyForm(c) : viewWeeklyList();
        break;
      case 'monthly':
        view = !b ? viewMonthlyList() : b === 'new' ? viewMonthlyForm(null) : b === 'edit' ? viewMonthlyForm(c) : viewMonthlyList();
        break;
      case 'skills':
        view = !b ? viewSkills() : b === 'new' ? viewSkillForm(null) : b === 'edit' ? viewSkillForm(c) : viewSkills();
        break;
      case 'export': view = viewExport(); break;
      case 'settings': view = viewSettings(); break;
      default: view = viewDashboard(); active = '';
    }
    const root = $('#app');
    root.innerHTML = '';
    root.appendChild(renderNav(active));
    root.appendChild(h('main', { class: 'main' }, view));
    window.scrollTo(0, 0);
  }

  // ---------- 設定(バックアップ) ----------
  function viewSettings() {
    return page('設定', 'データはこの端末のブラウザ(localStorage)に保存されます。', h('div', null, [
      h('div', { class: 'block' }, [
        h('div', { class: 'block-head' }, 'バックアップ'),
        h('div', { class: 'quick' }, [
          h('button', { class: 'btn', type: 'button', onclick: () => {
            const blob = new Blob([JSON.stringify(DB.exportAll(), null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = h('a', { href: url, download: 'cxo-roadmap-log-' + today + '.json' });
            document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
          } }, 'JSONで書き出し'),
          (function () {
            const file = h('input', { type: 'file', accept: 'application/json', style: 'display:none' });
            file.addEventListener('change', () => {
              const f = file.files[0]; if (!f) return;
              const r = new FileReader();
              r.onload = () => { try { DB.importAll(JSON.parse(r.result)); alert('取り込みました'); route(); } catch (e) { alert('読み込み失敗'); } };
              r.readAsText(f);
            });
            const btn = h('button', { class: 'btn', type: 'button', onclick: () => file.click() }, 'JSONを取り込み');
            return h('span', null, [btn, file]);
          })(),
          h('button', { class: 'btn danger ghost', type: 'button', onclick: () => { if (confirm('全データを消去して初期サンプルに戻します')) { DB.resetAll(); DB.seed(); route(); } } }, '初期化'),
        ]),
      ]),
      h('div', { class: 'block' }, [
        h('div', { class: 'block-head' }, 'その他'),
        h('div', { class: 'quick' }, [h('a', { class: 'btn ghost', href: './feed.html' }, 'GitHub Issues フィードを見る')]),
      ]),
    ]));
  }

  // ---------- 起動 ----------
  DB.seed();
  window.addEventListener('hashchange', route);
  route();
})();
