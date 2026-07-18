/* ================================================================
   医療管理職スターター — ランタイム v1.0
   ページ本体は scripts/manager-starter/build.mjs が静的生成する。
   このファイルは操作系のみ:
   テーマ / ドロワー / 絞り込み / 検索 / コピー / 問い合わせダイアログ /
   現在地チェック(セルフチェック) / 計測スタブ
   ================================================================ */
(function () {
  'use strict';

  /* ---- 計測スタブ(ツール接続時に window._msEvents を送信する) ---- */
  window._msEvents = window._msEvents || [];
  const track = (name, params) => { window._msEvents.push({ name, params: params || {}, t: Date.now() }); };

  /* ---- テーマ(BRIDGE本体と同じキーで永続化) ---- */
  const themeBtn = document.getElementById('moTheme');
  if (themeBtn) themeBtn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('bridge-theme', next); } catch (e) {}
  });

  /* ---- モバイルドロワー ---- */
  const burger = document.getElementById('moBurger');
  if (burger) burger.addEventListener('click', () => {
    const open = document.body.classList.toggle('menu-open');
    burger.setAttribute('aria-expanded', String(open));
    burger.setAttribute('aria-label', open ? 'メニューを閉じる' : 'メニューを開く');
  });

  /* ---- 検索フォーム(計測のみ。遷移は静的form) ---- */
  document.querySelectorAll('form[data-search]').forEach((f) => {
    f.addEventListener('submit', () => {
      const q = (f.querySelector('input[name="q"]') || {}).value || '';
      if (q.trim()) track('search', { q: q.trim() });
    });
  });

  /* ---- コピー(無料テンプレ) ---- */
  const copyFrom = (el) => {
    let text = '';
    if (el.matches('pre')) return el.textContent.trim();
    el.querySelectorAll('.cl-group').forEach((g) => {
      const h = g.querySelector('.h');
      if (h) text += '■ ' + h.textContent.trim() + '\n';
      g.querySelectorAll('.cl li').forEach((li) => {
        const note = li.querySelector('.note');
        const main = li.textContent.replace(note ? note.textContent : '', '').trim();
        text += '□ ' + main + (note ? '(' + note.textContent.trim() + ')' : '') + '\n';
      });
      text += '\n';
    });
    return text.trim();
  };
  document.querySelectorAll('[data-copy-target]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const src = document.getElementById(btn.dataset.copyTarget);
      if (!src) return;
      try {
        await navigator.clipboard.writeText(copyFrom(src));
        const t = btn.textContent;
        btn.textContent = 'コピーしました';
        track('free_template_download_click', { id: btn.dataset.copyTarget });
        setTimeout(() => { btn.textContent = t; }, 1800);
      } catch (e) {
        btn.textContent = 'コピーできませんでした(手動で選択してください)';
      }
    });
  });

  /* ---- 問い合わせダイアログ(パック。決済未実装を正直に伝える) ---- */
  const dialog = document.getElementById('buyDialog');
  if (dialog) {
    document.querySelectorAll('[data-buy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        track('product_purchase_click', { id: btn.dataset.buy });
        dialog.showModal();
      });
    });
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    const closeBtn = dialog.querySelector('[data-close]');
    if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  }

  /* ---- テンプレート一覧の絞り込み ---- */
  const list = document.getElementById('tplList');
  if (list) {
    const cards = Array.from(list.querySelectorAll('[data-cat]'));
    const state = { cat: 'all', prof: '', exp: '', format: '', q: '' };
    const countEl = document.getElementById('fCount');
    const emptyEl = document.getElementById('fEmpty');
    const sortSel = document.getElementById('fSort');

    const apply = () => {
      let visible = 0;
      const q = state.q.toLowerCase();
      cards.forEach((c) => {
        const profs = (c.dataset.profs || '').split(' ');
        const ok =
          (state.cat === 'all' || c.dataset.cat === state.cat) &&
          (!state.prof || profs.includes(state.prof) || profs.includes('all')) &&
          (!state.exp || (c.dataset.exp || '').split(' ').includes(state.exp)) &&
          (!state.format || (c.dataset.formats || '').split(' ').includes(state.format)) &&
          (!q || (c.dataset.text || '').includes(q));
        c.style.display = ok ? '' : 'none';
        if (ok) visible++;
      });
      if (countEl) countEl.textContent = visible + '件';
      if (emptyEl) emptyEl.hidden = visible !== 0;
      if (q && visible === 0) track('search_zero_results', { q: state.q });
    };
    const sort = () => {
      const key = sortSel ? sortSel.value : 'reco';
      const val = (c) => key === 'new' ? -(+c.dataset.pub) : key === 'upd' ? -(+c.dataset.upd) : (+c.dataset.priority);
      cards.sort((a, b) => val(a) - val(b)).forEach((c) => list.appendChild(c));
    };
    document.querySelectorAll('.fchip[data-fkey]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const key = chip.dataset.fkey;
        state[key] = chip.dataset.fval;
        document.querySelectorAll('.fchip[data-fkey="' + key + '"]').forEach((c) =>
          c.setAttribute('aria-pressed', String(c === chip)));
        track('filter_use', { key, value: chip.dataset.fval });
        apply();
      });
    });
    ['prof', 'exp', 'format'].forEach((key) => {
      const sel = document.getElementById('f-' + key);
      if (sel) sel.addEventListener('change', () => { state[key] = sel.value; track('filter_use', { key, value: sel.value }); apply(); });
    });
    const qInput = document.getElementById('fQ');
    if (qInput) qInput.addEventListener('input', () => { state.q = qInput.value.trim(); apply(); });
    if (sortSel) sortSel.addEventListener('change', sort);
    const reset = document.getElementById('fReset');
    if (reset) reset.addEventListener('click', () => {
      state.cat = 'all'; state.prof = ''; state.exp = ''; state.format = ''; state.q = '';
      if (qInput) qInput.value = '';
      ['prof', 'exp', 'format'].forEach((k) => { const s = document.getElementById('f-' + k); if (s) s.value = ''; });
      document.querySelectorAll('.fchip[data-fkey]').forEach((c) =>
        c.setAttribute('aria-pressed', String(c.dataset.fval === 'all')));
      apply();
    });

    const params = new URLSearchParams(location.search);
    if (params.get('cat')) {
      const chip = document.querySelector('.fchip[data-fkey="cat"][data-fval="' + params.get('cat') + '"]');
      if (chip) chip.click();
    }
    if (params.get('q')) {
      state.q = params.get('q').trim();
      if (qInput) qInput.value = state.q;
      apply();
      const artBox = document.getElementById('artResults');
      if (artBox && state.q) {
        import('../data/articles.mjs').then(({ publishedArticles }) => {
          const q = state.q.toLowerCase();
          const hits = publishedArticles().filter((a) =>
            (a.title + ' ' + a.description + ' ' + (a.tags || []).join(' ')).toLowerCase().includes(q));
          if (!hits.length) return;
          artBox.hidden = false;
          artBox.querySelector('.grid').innerHTML = hits.map((a) =>
            '<a class="art-card" href="../articles/' + a.slug + '/index.html">' +
            '<span class="t">' + a.title + '</span><span class="d">' + a.description + '</span></a>').join('');
        }).catch(() => {});
      }
    } else {
      apply();
    }
  }

  /* ---- 記事一覧のカテゴリ絞り込み ---- */
  const artList = document.getElementById('artList');
  if (artList) {
    const cards = Array.from(artList.querySelectorAll('[data-cat]'));
    document.querySelectorAll('.fchip[data-acat]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const v = chip.dataset.acat;
        document.querySelectorAll('.fchip[data-acat]').forEach((c) => c.setAttribute('aria-pressed', String(c === chip)));
        let n = 0;
        cards.forEach((c) => { const ok = v === 'all' || c.dataset.cat === v; c.style.display = ok ? '' : 'none'; if (ok) n++; });
        const empty = document.getElementById('aEmpty');
        if (empty) empty.hidden = n !== 0;
      });
    });
  }

  /* ---- 現在地チェック(セルフチェック) ----
     端末内で完結。保存も送信もしない。 ---- */
  const diagRoot = document.getElementById('diagApp');
  if (diagRoot) {
    import('../data/diagnosis.mjs').then(({ DIAG }) => {
      const answers = new Array(DIAG.questions.length).fill(null);
      let idx = 0;
      let started = false;

      const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const areaName = (id) => (DIAG.areas.find((a) => a.id === id) || {}).name || '';

      const renderQuestion = () => {
        if (!started) { started = true; track('diagnosis_start', {}); }
        const q = DIAG.questions[idx];
        diagRoot.innerHTML =
          '<div class="diag-box">' +
          '<div class="diag-progress"><span>' + (idx + 1) + ' / ' + DIAG.questions.length + '</span>' +
          '<div class="bar" role="progressbar" aria-valuemin="1" aria-valuemax="' + DIAG.questions.length + '" aria-valuenow="' + (idx + 1) + '" aria-label="進捗"><span style="width:' + Math.round(((idx + 1) / DIAG.questions.length) * 100) + '%"></span></div></div>' +
          '<div class="diag-area">領域: ' + esc(areaName(q.area)) + '</div>' +
          '<div class="diag-q" id="diagQ">' + esc(q.q) + '</div>' +
          '<div class="diag-opts" role="group" aria-labelledby="diagQ">' +
          DIAG.options.map((o) =>
            '<button class="diag-opt" data-v="' + o.value + '" aria-pressed="' + String(answers[idx] === o.value) + '">' + esc(o.label) + '</button>').join('') +
          '</div>' +
          '<div class="diag-nav">' +
          (idx > 0 ? '<button class="diag-back" id="diagBack">前の質問へ戻る</button>' : '<span></span>') +
          '</div></div>' +
          '<p class="diag-note">' + esc(DIAG.notice) + '</p>';

        diagRoot.querySelectorAll('.diag-opt').forEach((btn) => {
          btn.addEventListener('click', () => {
            answers[idx] = Number(btn.dataset.v);
            track('diagnosis_answer', { q: q.id, v: btn.dataset.v });
            if (idx < DIAG.questions.length - 1) { idx++; renderQuestion(); }
            else { renderResult(); }
          });
        });
        const back = document.getElementById('diagBack');
        if (back) back.addEventListener('click', () => { idx--; renderQuestion(); });
        diagRoot.querySelector('.diag-opt').focus();
      };

      const renderResult = () => {
        track('diagnosis_complete', {});
        /* 領域ごとの得点(各領域 満点6) */
        const scores = DIAG.areas.map((a) => {
          const qs = DIAG.questions.map((q, i) => ({ q, i })).filter((x) => x.q.area === a.id);
          const got = qs.reduce((s, x) => s + (answers[x.i] || 0), 0);
          return { area: a, got, max: qs.length * 2 };
        });
        const lowest = scores.reduce((min, s) => (s.got < min.got ? s : min), scores[0]);
        const highest = scores.reduce((max, s) => (s.got > max.got ? s : max), scores[0]);
        const result = DIAG.results.find((r) => r.areaId === lowest.area.id) || DIAG.results[0];
        track('diagnosis_result_view', { area: lowest.area.id });

        const root = diagRoot.dataset.root || '../';
        const recTpl = (result.recommendedTemplateIds || []).map((id) => {
          const el = document.querySelector('#diagRec [data-tpl="' + id + '"]');
          return el ? el.outerHTML : '';
        }).join('');
        const recArt = (result.recommendedArticleIds || []).map((id) => {
          const el = document.querySelector('#diagRec [data-art="' + id + '"]');
          return el ? el.outerHTML : '';
        }).join('');

        diagRoot.innerHTML =
          '<div class="diag-result">' +
          '<p class="eyebrow">Result</p>' +
          '<h2 class="rt">' + esc(result.title) + '</h2>' +
          '<p style="font-size:13.5px;line-height:2;color:var(--ink-2)">' + esc(result.description) + '</p>' +
          '<div class="diag-scores" aria-label="領域ごとの結果">' +
          scores.map((s) =>
            '<div class="diag-score' + (s.area.id === lowest.area.id ? ' low' : '') + '">' +
            '<span>' + esc(s.area.name) + (s.area.id === lowest.area.id ? '(いまここ)' : s.area.id === highest.area.id && highest.got > lowest.got ? '(強み)' : '') + '</span>' +
            '<div class="bar"><span style="width:' + Math.round((s.got / s.max) * 100) + '%"></span></div>' +
            '<span class="v">' + s.got + '/' + s.max + '</span></div>').join('') +
          '</div>' +
          '<div class="diag-week"><div class="h">今週やること(3つだけ)</div><ol>' +
          result.thisWeek.map((w) => '<li>' + esc(w) + '</li>').join('') + '</ol></div>' +
          '<p style="font-size:12px;color:var(--ink-3);line-height:1.9">結果は目安です。どの段階でも、他の領域の道具を先に使って構いません。' + esc(DIAG.notice) + '</p>' +
          '<div style="margin:18px 0"><button class="diag-restart" id="diagRestart">最初からやり直す</button></div>' +
          '<div class="related" style="border-top:1px solid var(--line-soft)"><div class="h">この結果におすすめの資料</div><div class="grid c2">' + recTpl + recArt + '</div></div>' +
          '<p style="margin-top:18px"><a class="btn ghost small" href="' + root + 'pack/index.html">管理の型をまとめて整えるなら: スターターパック</a></p>' +
          '</div>';
        const restart = document.getElementById('diagRestart');
        if (restart) restart.addEventListener('click', () => { answers.fill(null); idx = 0; renderQuestion(); });
        const rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        diagRoot.scrollIntoView({ behavior: rm ? 'auto' : 'smooth', block: 'start' });
      };

      const startBtn = document.getElementById('diagStart');
      if (startBtn) startBtn.addEventListener('click', renderQuestion);
    }).catch(() => {
      diagRoot.innerHTML = '<p style="font-size:13px;color:var(--ink-3)">チェックの読み込みに失敗しました。ページを再読み込みしてください。</p>';
    });
  }

  /* ---- ページ閲覧の計測 ---- */
  const pv = document.body.dataset.event;
  if (pv) track(pv, { path: location.pathname });
})();
