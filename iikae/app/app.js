/* 現場のことば 言いかえ帳 — 一覧・絞り込み・ブックマーク・出力
 * ブックマークは localStorage にのみ保存する。外部送信はしない。AIも使わない。
 */

'use strict';

(function () {
  const STORAGE_KEY = 'kotoba_v1';

  const views = {
    intro: document.getElementById('view-intro'),
    list: document.getElementById('view-list'),
    saved: document.getElementById('view-saved'),
  };
  const toastEl = document.getElementById('toast');

  // ブックマークは現場語(genba)をキーに持つ(全件で一意)
  let saved = [];
  let filterCat = 'all';
  let filterRole = 'all';
  let openKey = null;

  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ saved })); } catch (e) {}
  }
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.saved)) {
        saved = data.saved.filter((k) => ENTRIES.some((e) => e.genba === k));
      }
    } catch (e) { /* 壊れた保存データは無視 */ }
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

  /* ---------- ① 入口 ---------- */

  document.getElementById('intro-start').addEventListener('click', () => {
    renderList();
    show('list');
  });

  /* ---------- ② 一覧 ---------- */

  const catOf = (id) => CATEGORIES.find((c) => c.id === id);
  const roleOf = (id) => ROLES.find((r) => r.id === id);

  function matches(e) {
    if (filterCat !== 'all' && e.cat !== filterCat) return false;
    if (filterRole !== 'all' && e.roles && !e.roles.includes(filterRole)) return false;
    return true;
  }

  function renderChips() {
    const catEl = document.getElementById('chips-cat');
    catEl.innerHTML =
      CATEGORIES.map((c) =>
        '<button type="button" class="chip' + (filterCat === c.id ? ' on' : '') + '" data-cat="' + c.id + '" aria-pressed="' + (filterCat === c.id) + '">' + esc(c.name) + '</button>'
      ).join('');
    const roleEl = document.getElementById('chips-role');
    roleEl.innerHTML =
      '<button type="button" class="chip' + (filterRole === 'all' ? ' on' : '') + '" data-role="all">すべての職種</button>' +
      ROLES.map((r) =>
        '<button type="button" class="chip' + (filterRole === r.id ? ' on' : '') + '" data-role="' + r.id + '">' + esc(r.name) + '</button>'
      ).join('');
    catEl.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
      filterCat = filterCat === b.dataset.cat ? 'all' : b.dataset.cat; // もう一度押すと絞り込み解除
      openKey = null; renderList();
    }));
    roleEl.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
      filterRole = b.dataset.role; openKey = null; renderList();
    }));
  }

  function starSvg(onFlag) {
    return '<svg viewBox="0 0 24 24" fill="' + (onFlag ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.6l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8-4.2-4.1 5.8-.8z"/></svg>';
  }

  function renderList() {
    renderChips();
    const listEl = document.getElementById('word-list');
    const items = ENTRIES.filter(matches);
    document.getElementById('list-count').textContent = items.length + '件';

    listEl.innerHTML = items.map((e) => {
      const isSaved = saved.includes(e.genba);
      const isOpen = openKey === e.genba;
      const cat = catOf(e.cat);
      return (
        '<div class="word-row' + (isOpen ? ' open' : '') + '" data-key="' + esc(e.genba) + '">' +
          '<div class="word-main">' +
            '<button type="button" class="word-toggle" aria-expanded="' + isOpen + '">' +
              '<span class="genba">' + esc(e.genba) + '</span>' +
              '<span class="arrow" aria-hidden="true">→</span>' +
              '<span class="kotoba">' + esc(e.kotoba) + '</span>' +
            '</button>' +
            '<button type="button" class="word-star' + (isSaved ? ' on' : '') + '" aria-pressed="' + isSaved + '" aria-label="' + (isSaved ? '星を外す' : 'この言葉に星をつけてあつめる') + '">' + starSvg(isSaved) + '</button>' +
          '</div>' +
          (isOpen
            ? '<div class="word-detail">' +
                '<div class="d"><span class="k">文例</span>' + esc(e.rei) + '</div>' +
                '<div class="d"><span class="k">成り立つ条件</span>' + esc(e.joken) + '</div>' +
                '<div class="d meta"><span class="k">場面</span>' + esc(cat.name) +
                  (e.roles ? '<span class="k k2">職種</span>' + e.roles.map((r) => esc(roleOf(r).name)).join('・') : '') +
                '</div>' +
              '</div>'
            : '') +
        '</div>'
      );
    }).join('') || '<div class="word-empty">この絞り込みでは、まだ言葉がありません。</div>';

    listEl.querySelectorAll('.word-toggle').forEach((b) => b.addEventListener('click', () => {
      const key = b.closest('.word-row').dataset.key;
      openKey = openKey === key ? null : key;
      renderList();
    }));
    listEl.querySelectorAll('.word-star').forEach((b) => b.addEventListener('click', () => {
      const key = b.closest('.word-row').dataset.key;
      if (saved.includes(key)) {
        saved = saved.filter((k) => k !== key);
      } else {
        saved.push(key);
        toast('あつめた言葉に入れました');
      }
      persist();
      renderList();
    }));

    const n = saved.length;
    const savedBtn = document.getElementById('to-saved');
    savedBtn.textContent = n ? 'あつめた言葉を見る(' + n + ') →' : 'あつめた言葉を見る →';
    savedBtn.hidden = false;
  }

  document.getElementById('to-saved').addEventListener('click', () => { renderSaved(); show('saved'); });
  document.getElementById('list-back').addEventListener('click', () => show('intro'));

  /* ---------- ③ あつめた言葉 ---------- */

  function savedEntries() {
    return ENTRIES.filter((e) => saved.includes(e.genba));
  }

  function renderSaved() {
    const listEl = document.getElementById('saved-list');
    const items = savedEntries();
    if (!items.length) {
      listEl.innerHTML = '<div class="word-empty">まだ、あつめた言葉はありません。<br>一覧で気になる言いかえを見つけたら、星をつけてください。ここにまとまっていきます。</div>';
    } else {
      listEl.innerHTML = CATEGORIES.map((c) => {
        const group = items.filter((e) => e.cat === c.id);
        if (!group.length) return '';
        return group.map((e, i) => (
          '<div class="mat-row">' +
            (i === 0 ? '<div class="cat">' + esc(c.name) + '</div>' : '') +
            '<div class="pair"><span class="genba">' + esc(e.genba) + '</span><span class="arrow" aria-hidden="true">→</span><span class="kotoba">' + esc(e.kotoba) + '</span></div>' +
            '<div class="a"><span class="k">文例</span>' + esc(e.rei) + '</div>' +
            '<div class="ops"><button type="button" data-del="' + esc(e.genba) + '">外す</button></div>' +
          '</div>'
        )).join('');
      }).join('');
    }
    document.getElementById('saved-copy').disabled = !items.length;
    document.getElementById('saved-save').disabled = !items.length;

    listEl.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', () => {
      saved = saved.filter((k) => k !== b.dataset.del);
      persist();
      renderSaved();
    }));
  }

  function formatSaved() {
    const items = savedEntries();
    const parts = [
      DOC_TITLE + ' — あつめた言葉',
      '（そのまま貼らず、自分がやった場面をひとつ添えてから使ってください）',
      '',
    ];
    items.forEach((e, i) => {
      parts.push((i + 1) + '. ' + e.kotoba);
      parts.push('   文例: ' + e.rei + '。');
      parts.push('   （もとの現場のことば: ' + e.genba + '）');
      parts.push('   ※成り立つ条件: ' + e.joken);
      parts.push('');
    });
    return parts.join('\n').trim();
  }

  document.getElementById('saved-copy').addEventListener('click', () => {
    const text = formatSaved();
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

  document.getElementById('saved-save').addEventListener('click', () => {
    const blob = new Blob([formatSaved() + '\n'], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = DOC_TITLE + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    toast('テキストで保存しました');
  });

  document.getElementById('saved-back').addEventListener('click', () => { renderList(); show('list'); });

  /* ---------- テーマ切替 ---------- */

  document.getElementById('themeBtn').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('bridge-theme', next); } catch (e) {}
  });

  /* ---------- 起動 ---------- */

  load();
  show('intro');
})();
