/* ================================================================
   医療管理実務ライブラリ — ランタイム v1.0
   ページ本体は scripts/medops/build.mjs が静的生成する。
   このファイルは操作系のみ:
   テーマ / ドロワー / 絞り込み・並び替え / 検索 / コピー / 購入モック / 計測スタブ
   ================================================================ */
(function () {
  'use strict';

  /* ---- 計測スタブ(ツール接続時に window._moEvents を送信する) ---- */
  window._moEvents = window._moEvents || [];
  const track = (name, params) => { window._moEvents.push({ name, params: params || {}, t: Date.now() }); };
  window.moTrack = track;

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

  /* ---- 検索フォーム(action先は静的HTML側。ここでは計測のみ) ---- */
  document.querySelectorAll('form[data-search]').forEach((f) => {
    f.addEventListener('submit', () => {
      const q = (f.querySelector('input[name="q"]') || {}).value || '';
      if (q.trim()) track('search', { q: q.trim() });
    });
  });

  /* ---- コピー(無料テンプレ/文例) ---- */
  const copyFrom = (el) => {
    let text = '';
    if (el.matches('pre')) { text = el.textContent; }
    else {
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
    }
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
        track('free_template_copy', { id: btn.dataset.copyTarget });
        setTimeout(() => { btn.textContent = t; }, 1800);
      } catch (e) {
        btn.textContent = 'コピーできませんでした(手動で選択してください)';
      }
    });
  });

  /* ---- 購入モック(決済未実装であることを正直に伝える) ---- */
  const dialog = document.getElementById('buyDialog');
  if (dialog) {
    document.querySelectorAll('[data-buy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        track('purchase_click', { id: btn.dataset.buy });
        dialog.showModal();
      });
    });
    dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
    const closeBtn = dialog.querySelector('[data-close]');
    if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
  }

  /* ---- 一覧の絞り込み・並び替え ---- */
  const list = document.getElementById('tplList');
  if (list) {
    const cards = Array.from(list.querySelectorAll('[data-cat]'));
    const state = { cat: 'all', role: '', format: '', scene: '', freq: '', q: '' };
    const countEl = document.getElementById('fCount');
    const emptyEl = document.getElementById('fEmpty');
    const sortSel = document.getElementById('fSort');

    const apply = () => {
      let visible = 0;
      const q = state.q.toLowerCase();
      cards.forEach((c) => {
        const ok =
          (state.cat === 'all' || c.dataset.cat === state.cat) &&
          (!state.role || (c.dataset.roles || '').split(' ').includes(state.role)) &&
          (!state.format || (c.dataset.formats || '').split(' ').includes(state.format)) &&
          (!state.scene || (c.dataset.scenes || '').split(' ').includes(state.scene)) &&
          (!state.freq || (c.dataset.freq || '').split(' ').includes(state.freq)) &&
          (!q || (c.dataset.text || '').includes(q));
        c.style.display = ok ? '' : 'none';
        if (ok) visible++;
      });
      if (countEl) countEl.textContent = visible + '件';
      if (emptyEl) emptyEl.hidden = visible !== 0;
      if (q && visible === 0) track('search_empty', { q: state.q });
    };

    const sort = () => {
      const key = sortSel ? sortSel.value : 'reco';
      const val = (c) => key === 'new' ? -(+c.dataset.pub) : key === 'upd' ? -(+c.dataset.upd) : (+c.dataset.priority);
      cards.sort((a, b) => val(a) - val(b)).forEach((c) => list.appendChild(c));
      track('sort', { key });
    };

    document.querySelectorAll('.fchip[data-fkey]').forEach((chip) => {
      chip.addEventListener('click', () => {
        const key = chip.dataset.fkey;
        state[key] = chip.dataset.fval;
        document.querySelectorAll('.fchip[data-fkey="' + key + '"]').forEach((c) =>
          c.setAttribute('aria-pressed', String(c === chip)));
        track('filter', { key, value: chip.dataset.fval });
        apply();
      });
    });
    ['role', 'format', 'scene', 'freq'].forEach((key) => {
      const sel = document.getElementById('f-' + key);
      if (sel) sel.addEventListener('change', () => { state[key] = sel.value; track('filter', { key, value: sel.value }); apply(); });
    });
    const qInput = document.getElementById('fQ');
    if (qInput) qInput.addEventListener('input', () => { state.q = qInput.value.trim(); apply(); });
    if (sortSel) sortSel.addEventListener('change', sort);
    const reset = document.getElementById('fReset');
    if (reset) reset.addEventListener('click', () => {
      state.cat = 'all'; state.role = ''; state.format = ''; state.scene = ''; state.freq = ''; state.q = '';
      if (qInput) qInput.value = '';
      ['role', 'format', 'scene', 'freq'].forEach((k) => { const s = document.getElementById('f-' + k); if (s) s.value = ''; });
      document.querySelectorAll('.fchip[data-fkey]').forEach((c) =>
        c.setAttribute('aria-pressed', String(c.dataset.fval === 'all')));
      apply();
    });

    /* URLパラメータ(q=検索語, cat=カテゴリ)を初期状態に反映 */
    const params = new URLSearchParams(location.search);
    if (params.get('cat')) {
      const chip = document.querySelector('.fchip[data-fkey="cat"][data-fval="' + params.get('cat') + '"]');
      if (chip) chip.click();
    }
    if (params.get('q')) {
      state.q = params.get('q').trim();
      if (qInput) qInput.value = state.q;
      apply();
      /* 検索語があるときは記事も横断表示する */
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

  /* ---- ページ閲覧の計測 ---- */
  const pv = document.body.dataset.event;
  if (pv) track(pv, { path: location.pathname });
})();
