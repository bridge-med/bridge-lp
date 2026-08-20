/* =========================================================================
 * みせびらき — app.js
 * 画面の描画とフォームの接続。data.js / store.js 以外に依存しない。
 * ========================================================================= */
(function (global) {
  'use strict';

  const D = global.MisebirakiData;
  const S = global.MisebirakiStore;

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const yen = (n) => Number(n || 0).toLocaleString('ja-JP');
  const minsLabel = (m) => (m >= 999 ? 'まとまった時間' : 'およそ' + m + '分');

  /* 追加フォームで選ばれている型。描画をまたいで保つ */
  let pendingKind = D.KINDS[0].key;
  let openProductId = null;
  /* 詳細画面で材料を開いている工程 */
  const openMaterials = new Set();

  /* ---------- 画面の切り替え ---------- */
  function show(view) {
    document.querySelectorAll('.view').forEach((el) => {
      el.classList.toggle('is-on', el.id === 'view-' + view);
    });
    /* 詳細は「商品」タブの下位画面として扱う */
    const tabFor = view === 'detail' ? 'products' : view;
    document.querySelectorAll('.tab').forEach((b) => {
      const on = b.dataset.view === tabFor;
      b.classList.toggle('is-on', on);
      if (on) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    global.scrollTo(0, 0);
  }

  /* ---------- トースト ---------- */
  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('is-on'), 2200);
  }

  async function copyText(text, btn) {
    try {
      await navigator.clipboard.writeText(text);
      toast('コピーしました');
    } catch (e) {
      /* クリップボードが使えない環境では選択して渡す */
      if (btn) btn.textContent = 'コピーできませんでした。長押しで選択してください';
    }
  }

  /* ---------- 材料の描画 ---------- */
  function materialHtml(step, idPrefix) {
    if (!step.material) return '';
    const m = step.material;
    const body = m.lines.join('\n');
    return '<div class="mat">' +
      '<div class="mat-h">' + esc(m.title) + '</div>' +
      '<div class="mat-body" id="' + idPrefix + '-mat">' + esc(body) + '</div>' +
      (m.copyable
        ? '<div class="mat-copy"><button class="btn ghost small" data-copy="' + idPrefix + '-mat">この文をコピーする</button></div>'
        : '') +
      '</div>';
  }

  /* ---------- 今夜 ---------- */
  function renderBudget() {
    const cur = S.settings.budget;
    $('budgetOpts').innerHTML = D.BUDGETS.map((b) =>
      '<button class="budget-opt' + (b.key === cur ? ' is-on' : '') + '" data-budget="' + b.key + '"' +
      (b.key === cur ? ' aria-pressed="true"' : ' aria-pressed="false"') + '>' + esc(b.label) + '</button>'
    ).join('');
  }

  function renderTonight() {
    renderBudget();
    const slot = $('tonightSlot');
    const r = S.tonight(S.settings.budget);

    if (r.empty) {
      slot.innerHTML = '<div class="blank">' +
        '<div class="blank-h">まだ何も登録されていません</div>' +
        '<p>売りたいものを1つ入れると、今夜できる1手が出ます。</p>' +
        '<button class="btn primary" data-go="products">売るものを追加する</button>' +
        '</div>';
    } else if (r.allOpen) {
      slot.innerHTML = '<div class="blank">' +
        '<div class="blank-h">全部、売れる状態になっています</div>' +
        '<p>次に売るものを足すか、今日はもう閉じてください。</p>' +
        '<button class="btn ghost" data-go="products">売るものを追加する</button>' +
        '</div>';
    } else if (r.pick) {
      const p = r.pick.product;
      const s = r.pick.step;
      const kind = D.kindByKey(p.kind);
      slot.innerHTML = '<div class="pick">' +
        '<div class="pick-for">Tonight</div>' +
        '<div class="pick-of">' + esc(p.name) + '<span class="pick-sep"> · </span>' + esc(kind.short) + '</div>' +
        '<h2 class="pick-h">' + esc(s.label) + '</h2>' +
        '<p class="pick-why">' + esc(s.why) + '</p>' +
        '<div class="pick-meta">' +
          '<span class="mins">' + esc(minsLabel(s.min)) + '</span>' +
          '<span>これが終わると、売れる状態まであと' + (r.pick.remaining - 1) + '手</span>' +
        '</div>' +
        materialHtml(s, 'tn') +
        '<div class="pick-actions">' +
          '<button class="btn primary" data-done="' + esc(p.id) + '|' + esc(s.key) + '">できた</button>' +
          '<button class="btn ghost" data-detail="' + esc(p.id) + '">この商品の全工程を見る</button>' +
        '</div>' +
        '</div>';
    } else if (r.fallback) {
      const f = r.fallback;
      slot.innerHTML = '<div class="blank">' +
        '<div class="blank-h">この時間で終わる手がありません</div>' +
        '<p>いちばん短い次の1手は「' + esc(f.step.label) + '」で、' + esc(minsLabel(f.step.min)) + 'かかります。' +
        '<br>今夜は見送って、時間の取れる日に回してください。</p>' +
        '<button class="btn ghost" data-detail="' + esc(f.product.id) + '">' + esc(f.product.name) + 'を見る</button>' +
        '</div>';
    }

    const sm = S.summary();
    $('summary').innerHTML =
      '<span>売れる状態 <b>' + sm.open + '</b> / ' + sm.total + '</span>' +
      '<span>残りの手数 <b>' + sm.steps + '</b></span>';
  }

  /* ---------- 商品の一覧 ---------- */
  function renderProducts() {
    const list = S.productsSorted();
    const el = $('productList');
    if (!list.length) {
      el.innerHTML = '<div class="blank">' +
        '<div class="blank-h">まだ何も登録されていません</div>' +
        '<p>売りたいものを1つ入れるところから始めます。</p>' +
        '</div>';
      return;
    }
    el.innerHTML = list.map((p) => {
      const pr = S.progress(p);
      const next = S.nextStep(p);
      const kind = D.kindByKey(p.kind);
      const open = !next;
      const pct = pr.total ? Math.round((pr.done / pr.total) * 100) : 0;
      return '<button class="p-card" data-detail="' + esc(p.id) + '">' +
        '<div class="p-top">' +
          '<div>' +
            '<div class="p-name">' + esc(p.name) + '</div>' +
            '<div class="p-kind">' + esc(kind.short) +
              (p.price ? ' · ' + yen(p.price) + '円 ' + esc(p.priceModel) : '') + '</div>' +
          '</div>' +
          (open
            ? '<span class="badge open">売れる</span>'
            : '<div class="tally"><span class="tally-n">' + pr.remaining + '</span><span class="tally-u">手のこり</span></div>') +
        '</div>' +
        '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
        (next ? '<div class="p-next"><span>次は</span> ' + esc(next.label) + '</div>' : '') +
        '</button>';
    }).join('');
  }

  function renderKindOpts() {
    $('kindOpts').innerHTML = D.KINDS.map((k) =>
      '<button type="button" class="kind-opt' + (k.key === pendingKind ? ' is-on' : '') + '" data-kind="' + esc(k.key) + '"' +
      ' aria-pressed="' + (k.key === pendingKind ? 'true' : 'false') + '">' +
        '<span class="kind-top"><span class="kind-name">' + esc(k.name) + '</span>' +
        '<span class="kind-steps">' + k.steps.length + '手</span></span>' +
        '<span class="kind-lead">' + esc(k.lead) + '</span>' +
      '</button>'
    ).join('');
  }

  /* ---------- 商品の詳細 ---------- */
  function renderDetail() {
    const p = S.byId(openProductId);
    if (!p) { show('products'); return; }
    const kind = D.kindByKey(p.kind);
    const steps = S.stepsOf(p);
    const next = S.nextStep(p);
    const pr = S.progress(p);

    const head = '<div class="d-head">' +
      '<h2 class="d-name">' + esc(p.name) + '</h2>' +
      '<div class="d-meta">' +
        '<span>' + esc(kind.name) + '</span>' +
        (p.price ? '<span class="yen">' + yen(p.price) + '円 ' + esc(p.priceModel) + '</span>' : '<span>' + esc(p.priceModel) + '</span>') +
        '<span>' + (next ? 'あと' + pr.remaining + '手' : '売れる状態') + '</span>' +
      '</div>' +
      (p.note ? '<p class="d-note">' + esc(p.note) + '</p>' : '') +
      '<p class="d-lead">' + esc(kind.lead) + '</p>' +
      '</div>';

    const body = steps.map((s) => {
      const st = S.stepState(p, s.key);
      const isNext = next && next.key === s.key;
      const mid = 'd-' + s.key;
      const opened = openMaterials.has(s.key);
      return '<div class="step' + (st.done ? ' is-done' : '') + '">' +
        '<div class="step-row">' +
          '<button class="step-check" data-done="' + esc(p.id) + '|' + esc(s.key) + '"' +
            ' aria-pressed="' + (st.done ? 'true' : 'false') + '"' +
            ' aria-label="' + esc(s.label) + 'を' + (st.done ? '未完了に戻す' : '完了にする') + '">' +
            '<span class="step-box"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg></span>' +
          '</button>' +
          '<div class="step-main">' +
            (isNext ? '<div class="step-now">Next</div>' : '') +
            '<div class="step-label">' + esc(s.label) + '</div>' +
            '<div class="step-why">' + esc(s.why) + '</div>' +
            '<div class="step-foot">' +
              '<span class="mins">' + esc(minsLabel(s.min)) + '</span>' +
              '<button class="step-more" data-mat="' + esc(s.key) + '" aria-expanded="' + (opened ? 'true' : 'false') + '">' +
                (opened ? '閉じる' : (s.material ? '材料を見る' : 'メモを書く')) + '</button>' +
            '</div>' +
            (opened
              ? '<div class="step-extra">' + materialHtml(s, mid) +
                '<textarea class="memo" data-memo="' + esc(s.key) + '" placeholder="この工程のメモ(任意)">' + esc(st.memo) + '</textarea>' +
                '</div>'
              : '') +
          '</div>' +
        '</div>' +
      '</div>';
    }).join('');

    const foot = '<div class="form-actions stack">' +
      '<button class="btn ghost" data-rename="' + esc(p.id) + '">名前を直す</button>' +
      '<button class="btn ghost danger" data-del="' + esc(p.id) + '">この商品を削除する</button>' +
      '</div>';

    $('detailSlot').innerHTML = head + body + foot;
  }

  /* ---------- 設定 ---------- */
  function renderSettings() {
    $('kindTable').querySelector('tbody').innerHTML = D.KINDS.map((k) =>
      '<tr><td>' + esc(k.name) + '</td><td class="n">' + k.steps.length + '手</td>' +
      '<td class="lead">' + esc(k.lead) + '</td></tr>'
    ).join('');
  }

  /* ---------- まとめて描画 ---------- */
  function renderAll() {
    renderTonight();
    renderProducts();
    renderKindOpts();
    renderSettings();
    if (openProductId) renderDetail();
  }

  /* ---------- 操作 ---------- */
  document.addEventListener('click', (e) => {
    if (!(e.target instanceof Element)) return;
    const t = e.target.closest('[data-budget],[data-done],[data-detail],[data-go],[data-kind],[data-mat],[data-copy],[data-del],[data-rename],.tab');

    if (!t) return;

    if (t.classList.contains('tab')) { show(t.dataset.view); return; }

    if (t.dataset.budget) {
      S.setBudget(t.dataset.budget);
      return; // 購読側が再描画する
    }

    if (t.dataset.done) {
      const [pid, key] = t.dataset.done.split('|');
      const cur = S.stepState(S.byId(pid) || { steps: {} }, key);
      S.setStepDone(pid, key, !cur.done);
      if (!cur.done) {
        const p = S.byId(pid);
        toast(p && S.isOpen(p) ? 'これで売れる状態になりました' : '1手すすみました');
      }
      return;
    }

    if (t.dataset.detail) {
      openProductId = t.dataset.detail;
      openMaterials.clear();
      renderDetail();
      show('detail');
      return;
    }

    if (t.dataset.go) { show(t.dataset.go); return; }

    if (t.dataset.kind) {
      pendingKind = t.dataset.kind;
      renderKindOpts();
      return;
    }

    if (t.dataset.mat) {
      const k = t.dataset.mat;
      if (openMaterials.has(k)) openMaterials.delete(k);
      else openMaterials.add(k);
      renderDetail();
      return;
    }

    if (t.dataset.copy) {
      const src = $(t.dataset.copy);
      if (src) copyText(src.textContent, t);
      return;
    }

    if (t.dataset.rename) {
      const p = S.byId(t.dataset.rename);
      if (!p) return;
      const v = global.prompt('名前を直します', p.name);
      if (v !== null && v.trim()) S.updateProduct(p.id, { name: v });
      return;
    }

    if (t.dataset.del) {
      const p = S.byId(t.dataset.del);
      if (!p) return;
      if (global.confirm('「' + p.name + '」を削除します。元に戻せません。')) {
        S.removeProduct(t.dataset.del);
        openProductId = null;
        show('products');
        toast('削除しました');
      }
      return;
    }
  });

  /* メモは離れたときに保存する(1文字ごとに書かない) */
  document.addEventListener('change', (e) => {
    const ta = e.target.closest('[data-memo]');
    if (!ta || !openProductId) return;
    S.setStepMemo(openProductId, ta.dataset.memo, ta.value);
  });

  /* ---------- 追加フォーム ---------- */
  $('addOpen').addEventListener('click', () => {
    $('addForm').hidden = false;
    $('addOpen').hidden = true;
    $('fName').focus();
  });
  $('addCancel').addEventListener('click', () => {
    $('addForm').hidden = true;
    $('addOpen').hidden = false;
    $('addForm').reset();
  });
  $('addForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('fName').value.trim();
    if (!name) return;
    const p = S.newProduct({
      name: name,
      kind: pendingKind,
      price: $('fPrice').value,
      priceModel: $('fPriceModel').value,
      note: $('fNote').value
    });
    $('addForm').reset();
    $('addForm').hidden = true;
    $('addOpen').hidden = false;
    openProductId = p.id;
    openMaterials.clear();
    renderDetail();
    show('detail');
    toast('追加しました。あと' + S.progress(p).remaining + '手です');
  });

  $('detailBack').addEventListener('click', () => { openProductId = null; show('products'); });

  /* ---------- 設定の操作 ---------- */
  $('btnExport').addEventListener('click', () => copyText(S.exportJson()));
  $('btnDemo').addEventListener('click', () => {
    if (global.confirm('入力した内容をすべて消して、デモデータに戻します。')) {
      S.seedDemo();
      openProductId = null;
      toast('デモデータに戻しました');
      show('tonight');
    }
  });

  /* ---------- テーマ ---------- */
  $('themeBtn').addEventListener('click', () => {
    const cur = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
    const nextT = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', nextT);
    try { localStorage.setItem('bridge-theme', nextT); } catch (err) { /* 保存できなくても切り替えは効く */ }
  });

  /* ---------- 起動 ---------- */
  S.init();
  $('fPriceModel').innerHTML = D.PRICE_MODELS.map((m) => '<option>' + esc(m) + '</option>').join('');
  S.subscribe(renderAll);
  renderAll();
})(window);
