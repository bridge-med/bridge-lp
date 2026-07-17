/* 経験の棚卸し — 画面遷移・保存・出力整形
 * 答えは localStorage にのみ保存する。外部送信はしない。AIも使わない。
 * 出力は「決まった型に流し込むだけ」— 型は data.js の INTERVIEW と下の format 群。
 */

'use strict';

(function () {
  const STORAGE_KEY = 'tanaoroshi_v1';
  const TOTAL = QUESTIONS.length;

  const views = {
    intro: document.getElementById('view-intro'),
    role: document.getElementById('view-role'),
    quest: document.getElementById('view-quest'),
    materials: document.getElementById('view-materials'),
    output: document.getElementById('view-output'),
  };
  const toastEl = document.getElementById('toast');

  // answers: 質問indexキーの { scene, action, change, later }
  let state = { role: null, idx: 0, answers: {} };
  let outputTab = 'resume'; // 'resume' | 'interview'

  /* ---------- 保存と復元 ---------- */

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ role: state.role, idx: state.idx, answers: state.answers }));
    } catch (e) { /* プライベートモード等では保存しない */ }
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data && typeof data === 'object' && data.answers && typeof data.answers === 'object') {
        state.role = ROLES.some((r) => r.id === data.role) ? data.role : null;
        state.idx = Number.isInteger(data.idx) && data.idx >= 0 && data.idx < TOTAL ? data.idx : 0;
        state.answers = data.answers;
      }
    } catch (e) { /* 壊れた保存データは無視して最初から */ }
  }

  function hasAnyInput() {
    return Object.keys(state.answers).some((k) => {
      const a = state.answers[k];
      return a && (a.scene || a.action || a.change || a.later);
    });
  }

  function answeredEntries() {
    // 実文がある回答だけ(下書き印のみは含めない)。質問順。
    const list = [];
    for (let i = 0; i < TOTAL; i++) {
      const a = state.answers[i];
      if (a && (a.scene || a.action || a.change)) list.push({ i, q: QUESTIONS[i], a });
    }
    return list;
  }

  /* ---------- 画面切替 ---------- */

  function show(name) {
    Object.keys(views).forEach((k) => views[k].classList.remove('on'));
    // 再表示時にもアニメーションが走るよう reflow を挟む
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

  /* ---------- ① 入口 ---------- */

  function renderIntro() {
    const started = hasAnyInput() || state.role;
    document.getElementById('intro-continue').hidden = !started;
    document.getElementById('intro-start').hidden = !!started;
    document.getElementById('intro-restart').hidden = !started;
    show('intro');
  }

  document.getElementById('intro-start').addEventListener('click', () => {
    state.role ? startQuest() : show('role');
  });
  document.getElementById('intro-continue').addEventListener('click', () => {
    state.role ? startQuest() : show('role');
  });
  document.getElementById('intro-restart').addEventListener('click', () => {
    if (!confirm('答えをすべて消して、最初からやり直します。よろしいですか。')) return;
    state = { role: null, idx: 0, answers: {} };
    try { localStorage.removeItem(STORAGE_KEY); } catch (e) {}
    show('role');
  });

  /* ---------- ② 職種選択 ---------- */

  function renderRoles() {
    const list = document.getElementById('role-list');
    list.innerHTML = ROLES.map((r) =>
      '<button type="button" class="role-item" data-role="' + r.id + '">' +
        '<span>' + esc(r.name) + '</span><span class="arrow" aria-hidden="true">→</span>' +
      '</button>'
    ).join('');
    list.querySelectorAll('.role-item').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.role = btn.dataset.role;
        save();
        startQuest();
      });
    });
  }

  document.getElementById('role-back').addEventListener('click', () => renderIntro());

  /* ---------- ③ 質問 ---------- */

  function startQuest() {
    // 途中再開:未回答・未着手の最初の質問へ(全問見終わっていたら材料一覧へ)
    if (!(state.idx >= 0 && state.idx < TOTAL)) state.idx = 0;
    renderQuest();
    show('quest');
  }

  function currentFields() {
    return {
      scene: document.getElementById('f-scene').value.trim(),
      action: document.getElementById('f-action').value.trim(),
      change: document.getElementById('f-change').value.trim(),
    };
  }

  function storeCurrent(extra) {
    const f = currentFields();
    const prev = state.answers[state.idx] || {};
    const later = extra && 'later' in extra ? extra.later : prev.later;
    if (f.scene || f.action || f.change || later) {
      state.answers[state.idx] = { scene: f.scene, action: f.action, change: f.change, later: !!later };
    } else {
      delete state.answers[state.idx];
    }
    save();
  }

  function renderQuest() {
    const q = QUESTIONS[state.idx];
    const cat = CATEGORIES.find((c) => c.id === q.cat);

    // 現在地:6カテゴリのドット。残数は数えない
    const answeredCats = new Set(
      Object.keys(state.answers)
        .filter((k) => { const a = state.answers[k]; return a && (a.scene || a.action || a.change); })
        .map((k) => QUESTIONS[k].cat)
    );
    document.getElementById('waypoints').innerHTML = CATEGORIES.map((c) =>
      '<span class="wp' + (c.id === q.cat ? ' here' : answeredCats.has(c.id) ? ' visited' : '') + '"></span>'
    ).join('');

    document.getElementById('quest-cat').innerHTML =
      esc(cat.en) + '<span class="jp">' + esc(cat.name) + '</span>';
    document.getElementById('quest-q').textContent = q.question;

    // ヒント:選択職種の1行。「その他」は4職種の例をそのまま並べる
    const hintEl = document.getElementById('quest-hint');
    if (state.role && q.hint[state.role]) {
      hintEl.innerHTML = esc(q.hint[state.role]);
    } else {
      hintEl.innerHTML = ['nurse', 'reha', 'clerk', 'care'].map((r) => esc(q.hint[r])).join('<br>');
    }

    const a = state.answers[state.idx] || {};
    document.getElementById('f-scene').value = a.scene || '';
    document.getElementById('f-action').value = a.action || '';
    document.getElementById('f-change').value = a.change || '';

    document.getElementById('quest-prev').disabled = state.idx === 0;
    document.getElementById('quest-next').textContent = state.idx === TOTAL - 1 ? '材料を見る' : '次へ';
    document.getElementById('quest-later').classList.toggle('marked', !!a.later);
    document.getElementById('quest-later').textContent = a.later ? 'あとで書く にしてあります' : 'あとで書く';
    document.getElementById('quest-to-materials').hidden = !hasAnyInput();
  }

  document.getElementById('quest-prev').addEventListener('click', () => {
    storeCurrent();
    if (state.idx > 0) { state.idx--; save(); renderQuest(); show('quest'); }
  });
  document.getElementById('quest-next').addEventListener('click', () => {
    storeCurrent();
    if (state.idx < TOTAL - 1) {
      state.idx++;
      save();
      renderQuest();
      show('quest');
    } else {
      renderMaterials();
      show('materials');
    }
  });
  document.getElementById('quest-later').addEventListener('click', () => {
    const prev = state.answers[state.idx] || {};
    storeCurrent({ later: !prev.later });
    if (state.idx < TOTAL - 1) { state.idx++; save(); renderQuest(); show('quest'); }
    else { renderMaterials(); show('materials'); }
  });
  document.getElementById('quest-to-materials').addEventListener('click', () => {
    storeCurrent();
    renderMaterials();
    show('materials');
  });
  document.getElementById('quest-back').addEventListener('click', () => {
    storeCurrent();
    renderIntro();
  });

  // 入力のたびに静かに保存(端末内のみ)。閉じる直前は待たずに保存する
  ['f-scene', 'f-action', 'f-change'].forEach((id) => {
    let t = null;
    document.getElementById(id).addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => storeCurrent(), 400);
    });
  });
  const flushIfQuest = () => { if (views.quest.classList.contains('on')) storeCurrent(); };
  window.addEventListener('pagehide', flushIfQuest);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushIfQuest();
  });

  /* ---------- ④ 材料一覧 ---------- */

  const FIELD_LABEL = { scene: '場面', action: 'やったこと', change: 'そのあとの変化' };

  function renderMaterials() {
    const listEl = document.getElementById('mat-list');
    const entries = [];
    for (let i = 0; i < TOTAL; i++) {
      const a = state.answers[i];
      if (a && (a.scene || a.action || a.change || a.later)) entries.push({ i, q: QUESTIONS[i], a });
    }

    if (!entries.length) {
      listEl.innerHTML = '<div class="mat-empty">まだ材料はありません。質問に一つ答えると、ここに残ります。</div>';
    } else {
      listEl.innerHTML = CATEGORIES.map((c) => {
        const items = entries.filter((e) => e.q.cat === c.id);
        if (!items.length) return '';
        return items.map((e, k) => {
          const body = ['scene', 'action', 'change']
            .filter((f) => e.a[f])
            .map((f) => '<span class="k">' + FIELD_LABEL[f] + '</span>' + esc(e.a[f]))
            .join('<br>');
          const draft = e.a.later && !(e.a.scene || e.a.action || e.a.change);
          return (
            '<div class="mat-row">' +
              (k === 0 ? '<div class="cat">' + esc(c.name) + '(' + items.length + '件)</div>' : '') +
              '<div class="q">' + esc(e.q.question) + (draft ? '<span class="draft">下書き</span>' : '') + '</div>' +
              (body ? '<div class="a">' + body + '</div>' : '<div class="a"><span class="k">まだ書いていません</span></div>') +
              '<div class="ops">' +
                '<button type="button" data-edit="' + e.i + '">書き直す</button>' +
                '<button type="button" data-del="' + e.i + '">消す</button>' +
              '</div>' +
            '</div>'
          );
        }).join('');
      }).join('');
    }

    document.getElementById('mat-output').disabled = !answeredEntries().length;

    listEl.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        state.idx = Number(btn.dataset.edit);
        save();
        renderQuest();
        show('quest');
      });
    });
    listEl.querySelectorAll('[data-del]').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!confirm('この材料を消します。よろしいですか。')) return;
        delete state.answers[btn.dataset.del];
        save();
        renderMaterials();
      });
    });
  }

  document.getElementById('mat-back-quest').addEventListener('click', () => {
    startQuest();
  });
  document.getElementById('mat-output').addEventListener('click', () => {
    renderOutput();
    show('output');
  });
  document.getElementById('mat-back-top').addEventListener('click', () => renderIntro());

  /* ---------- ⑤ 出力 ---------- */

  // 語尾の重複を避けるため、末尾の句読点だけ落とす(中身の言葉は触らない)
  function clean(s) {
    return String(s || '').trim().replace(/[。、\s]+$/, '');
  }

  /* A. 職務経歴書のたね:・{場面}、{やったこと}。{変化}。 */
  function formatResume() {
    const entries = answeredEntries();
    const parts = [];
    CATEGORIES.forEach((c) => {
      const items = entries.filter((e) => e.q.cat === c.id);
      if (!items.length) return;
      parts.push('【' + c.name + '】');
      items.forEach((e) => {
        const head = [clean(e.a.scene), clean(e.a.action)].filter(Boolean).join('、');
        const tail = clean(e.a.change);
        parts.push('・' + head + '。' + (tail ? tail + '。' : ''));
      });
      parts.push('');
    });
    return parts.join('\n').trim();
  }

  /* B. 面接の想定問答:カテゴリの固定質問+同じ組み立て+話し方のヒント */
  function formatInterview() {
    const entries = answeredEntries();
    const parts = [];
    CATEGORIES.forEach((c) => {
      const items = entries.filter((e) => e.q.cat === c.id);
      if (!items.length) return;
      const iv = INTERVIEW[c.id];
      parts.push('■ 想定質問(' + c.name + ')');
      parts.push(iv.q);
      parts.push('');
      items.forEach((e, k) => {
        const head = [clean(e.a.scene), clean(e.a.action)].filter(Boolean).join('、');
        const tail = clean(e.a.change);
        parts.push((items.length > 1 ? '回答例' + (k + 1) : '回答例') + ':');
        parts.push(head + '。' + (tail ? 'その結果、' + tail + '。' : ''));
        parts.push('');
      });
      parts.push('話し方のヒント:');
      parts.push('最初に「' + iv.opener + '」と置き、最後は「この経験を次の職場でも活かしたいです」のように自分の言葉で結ぶと締まります。');
      parts.push('');
      parts.push('');
    });
    return parts.join('\n').trim();
  }

  function renderOutput() {
    document.getElementById('out-tab-resume').classList.toggle('on', outputTab === 'resume');
    document.getElementById('out-tab-interview').classList.toggle('on', outputTab === 'interview');
    document.getElementById('out-text').textContent =
      outputTab === 'resume' ? formatResume() : formatInterview();
  }

  document.getElementById('out-tab-resume').addEventListener('click', () => { outputTab = 'resume'; renderOutput(); });
  document.getElementById('out-tab-interview').addEventListener('click', () => { outputTab = 'interview'; renderOutput(); });

  document.getElementById('out-copy').addEventListener('click', () => {
    const text = document.getElementById('out-text').textContent;
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

  document.getElementById('out-save').addEventListener('click', () => {
    const both = '経験の棚卸し\n\n◆ 職務経歴書のたね\n\n' + formatResume() +
      '\n\n\n◆ 面接の想定問答\n\n' + formatInterview() + '\n';
    const blob = new Blob([both], { type: 'text/plain;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = '経験の棚卸し.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
    toast('テキストで保存しました');
  });

  document.getElementById('out-back').addEventListener('click', () => {
    renderMaterials();
    show('materials');
  });

  /* ---------- テーマ切替 ---------- */

  document.getElementById('themeBtn').addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('bridge-theme', next); } catch (e) {}
  });

  /* ---------- 起動 ---------- */

  load();
  renderRoles();
  renderIntro();
})();
