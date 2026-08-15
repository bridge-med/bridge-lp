/* ================================================================
   LIFE//OS — app
   画面の組み立て・遷移・演出。データはすべて store / engine 経由。
   ================================================================ */
(function (global) {
  'use strict';

  var S = global.LifeStore;
  var E = global.LifeEngine;
  var C = global.LifeCharts;

  var $ = function (id) { return document.getElementById(id); };

  var el = {
    boot: $('boot'), bootSub: $('boot-sub'), bootFill: $('boot-ring-fill'),
    bootPct: $('boot-pct'), bootList: $('boot-list'), bootReady: $('boot-ready'), bootSkip: $('boot-skip'),
    app: $('app'), screen: $('screen'), tabbar: $('tabbar'),
    date: $('topbar-date'), clock: $('topbar-clock'), wordmark: $('wordmark'),
    sheetHost: $('sheet-host'), overlayHost: $('overlay-host'), toast: $('toast')
  };

  var view = 'home';
  var logDayKey = null;
  var historyRange = 30;
  var activeSeries = ['energy', 'focus', 'mood', 'body', 'social', 'score'];
  var inputStep = 0;
  var inputDraft = null;
  var inputDir = 'fwd';
  var installPrompt = null;

  /* ================================================================
     小道具
     ================================================================ */

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  var toastTimer = null;
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.setAttribute('data-on', '1');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.toast.removeAttribute('data-on'); }, 2200);
  }

  var WEEK = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

  function fmtDate(key) {
    var d = S.parseKey(key);
    return d.getFullYear() + '.' + S.pad(d.getMonth() + 1) + '.' + S.pad(d.getDate()) + ' ' + WEEK[d.getDay()];
  }

  function fmtDateShort(key) {
    var d = S.parseKey(key);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日（' + '日月火水木金土'[d.getDay()] + '）';
  }

  function hourNow() {
    return new Date().getHours();
  }

  function signed(n) { return (n > 0 ? '+' : '') + n; }

  /* ================================================================
     起動シーケンス
     ================================================================ */

  var bootTimers = [];

  function clearBootTimers() {
    bootTimers.forEach(clearTimeout);
    bootTimers = [];
  }

  function runBoot() {
    var st = S.get();
    var prevKey = S.shiftKey(S.today(), -1);
    var prev = st.days[prevKey];
    var todayD = st.days[S.today()];
    var src = (todayD && todayD.status) ? todayD.status : (prev && prev.status ? prev.status : null);

    el.boot.hidden = false;
    el.bootSub.textContent = src ? 'USER PROFILE DETECTED' : 'NO PROFILE — INITIALIZING';

    var rows = E.PARAMS.map(function (p) {
      return { name: p.label, value: src ? src[p.id] : null, varName: p.varName };
    });

    el.bootList.innerHTML = rows.map(function (r, i) {
      return '<li style="animation-delay:' + (420 + i * 150) + 'ms;color:var(' + r.varName + ')">'
        + '<span class="bl-name">' + r.name + '</span>'
        + '<span class="bl-bar"><i style="--to:' + (100 - (r.value == null ? 0 : r.value)) + '%;animation-delay:' + (460 + i * 150) + 'ms"></i></span>'
        + '<span class="bl-val">' + (r.value == null ? '--' : r.value + '%') + '</span>'
        + '</li>';
    }).join('');

    var start = Date.now();
    var DUR = 2200;
    var circ = 326.7;

    function tick() {
      var t = Math.min(1, (Date.now() - start) / DUR);
      var eased = 1 - Math.pow(1 - t, 2.2);
      el.bootFill.style.strokeDashoffset = (circ * (1 - eased)).toFixed(1);
      el.bootPct.innerHTML = Math.round(eased * 100) + '<small>%</small>';
      if (t < 1) bootTimers.push(setTimeout(tick, 40));
      else {
        el.bootSub.textContent = 'SYSTEM INITIALIZING';
        el.bootReady.setAttribute('data-on', '1');
        bootTimers.push(setTimeout(endBoot, 620));
      }
    }
    tick();
  }

  function endBoot() {
    clearBootTimers();
    if (el.boot.hidden) return;
    S.setSetting('lastBootKey', S.today());
    el.boot.setAttribute('data-exit', '1');
    setTimeout(function () {
      el.boot.hidden = true;
      el.boot.removeAttribute('data-exit');
      startApp();
    }, 460);
  }

  function startApp() {
    el.app.hidden = false;
    render();
    setTimeout(checkEggs, 700);
  }

  /* ================================================================
     タブ
     ================================================================ */

  var TABS = [
    { id: 'home', icon: 'home', label: 'HOME' },
    { id: 'input', icon: 'input', label: 'INPUT' },
    { id: 'log', icon: 'log', label: 'LOG' },
    { id: 'history', icon: 'history', label: 'HISTORY' },
    { id: 'menu', icon: 'menu', label: 'MENU' }
  ];

  function renderTabs() {
    var needsInput = !(S.todayDay(true).status);
    el.tabbar.innerHTML = TABS.map(function (t) {
      var cur = t.id === view;
      return '<button class="tab" type="button" data-tab="' + t.id + '"'
        + (cur ? ' aria-current="page"' : '') + '>'
        + C.icon(t.icon)
        + '<span>' + t.label + '</span>'
        + (t.id === 'input' && needsInput ? '<i class="tab-dot"></i>' : '')
        + '</button>';
    }).join('');
  }

  function go(next) {
    if (view === next && next !== 'input') return;
    view = next;
    if (next === 'log') logDayKey = logDayKey || S.today();
    if (next === 'input') { inputStep = 0; inputDraft = null; inputDir = 'fwd'; }
    render();
    el.screen.scrollTop = 0;
    global.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* ================================================================
     描画
     ================================================================ */

  function render() {
    S.touchStart();
    el.date.textContent = fmtDate(S.today());
    el.clock.textContent = S.hhmm();
    renderTabs();

    if (view === 'home') el.screen.innerHTML = viewHome();
    else if (view === 'input') el.screen.innerHTML = viewInput();
    else if (view === 'log') el.screen.innerHTML = viewLog();
    else if (view === 'history') el.screen.innerHTML = viewHistory();
    else el.screen.innerHTML = viewMenu();

    // 再生成のたびにアニメーションを走らせる
    el.screen.style.animation = 'none';
    void el.screen.offsetWidth;
    el.screen.style.animation = '';

    C.animateRings(el.screen);
    if (view === 'history') mountHistory();
    if (view === 'input') mountInput();
  }

  /* ---------------- HOME ---------------- */

  function viewHome() {
    var k = S.today();
    var d = S.day(k, true);
    var st = d.status;
    var prev = S.day(S.shiftKey(k, -1));
    var rows = E.series(14);
    // 2日分そろうまで波形は出さない。線のない空白を置かない
    var hasTrend = rows.filter(function (r) { return r.status; }).length >= 2;

    var gauges = E.PARAMS.map(function (p) {
      var v = st ? st[p.id] : null;
      var pv = prev && prev.status ? prev.status[p.id] : null;
      var delta = (v != null && pv != null) ? v - pv : null;
      var spark = rows.map(function (r) { return r.status ? r.status[p.id] : null; });
      return '<div class="gauge">'
        + '<div class="gauge-ring">' + C.ringSVG(v, p.varName, 34)
        + '<div class="gauge-val"' + (v == null ? ' data-empty="1"' : '') + '>' + (v == null ? '--' : v) + '</div>'
        + '</div>'
        + '<div class="gauge-label">' + p.label + '</div>'
        + (hasTrend ? C.sparkSVG(spark, p.varName)
          + '<div class="gauge-delta">' + (delta == null ? '&nbsp;' : signed(delta)) + '</div>' : '')
        + '</div>';
    }).join('');

    var out = '<section class="sec">'
      + '<div class="sec-head"><h2>System Status</h2>'
      + '<span class="eyebrow">' + (st ? 'UPDATED ' + S.hhmm(d.inputAt) : 'STANDBY') + '</span></div>'
      + '<div class="status-rail">' + gauges + '</div>';

    if (!st) {
      out += '<div class="standby">'
        + '<p>今日の状態はまだ読み取れていません。<br>5つの質問に答えると、30秒で割り出します。</p>'
        + '<button class="btn primary" type="button" data-go="input">状態を入力する</button>'
        + '</div>';
    }
    out += '</section>';

    out += '<div class="home-grid"><div>';

    /* TODAY MISSION */
    out += '<section class="sec"><div class="sec-head"><h2>Today Mission</h2>'
      + (st ? '<span class="eyebrow">' + (d.missions || []).filter(function (m) { return m.done; }).length
        + ' / ' + (d.missions || []).length + '</span>' : '') + '</div><div class="panel">';
    if (!st) {
      out += '<div class="empty">状態を入力すると、今日の指示が出ます。</div>';
    } else {
      out += '<ul class="missions">' + (d.missions || []).map(function (m, i) {
        return '<li class="mission">'
          + '<span class="mission-mark" style="--mc:var(--c-' + m.color + ')"></span>'
          + '<div class="mission-body">'
          + '<div class="mission-text' + (m.done ? ' mission-done' : '') + '">' + esc(m.text) + '</div>'
          + '<span class="mission-tag">' + esc(m.tag) + '</span>'
          + '</div>'
          + '<button class="mission-check" type="button" aria-pressed="' + (m.done ? 'true' : 'false') + '"'
          + ' data-mission="' + i + '" aria-label="完了にする">' + C.icon('check') + '</button>'
          + '</li>';
      }).join('') + '</ul>';
    }
    out += '</div></section>';

    /* EVENT LOG（直近） */
    var recent = (d.events || []).slice(-5);
    out += '<section class="sec"><div class="sec-head"><h2>Event Log</h2>'
      + '<button class="btn sm" type="button" data-add-log="1">' + C.icon('plus') + ' LOG</button></div>'
      + '<div class="panel">';
    if (!recent.length && !d.startedAt) {
      out += '<div class="empty">まだ記録がありません。</div>';
    } else {
      out += '<ul class="timeline">' + timelineRows(k, recent, d) + '</ul>';
      if ((d.events || []).length > 5) {
        out += '<div style="margin-top:12px"><button class="btn ghost sm block" type="button" data-go="log">VIEW ALL '
          + '（' + (d.events || []).length + '件）</button></div>';
      }
    }
    out += '</div></section>';

    out += '</div><div>';

    /* NEXT ACTION */
    var na = E.nextAction(st, hourNow());
    var dayProgress = Math.round(Math.min(100, Math.max(0, ((new Date().getHours() * 60 + new Date().getMinutes()) - 240) / (20 * 60) * 100)));
    out += '<section class="sec"><div class="sec-head"><h2>Next Action</h2></div>'
      + '<div class="panel"><div class="next-action"><div>'
      + '<span class="eyebrow">' + (st ? na.mins + ' MIN' : 'PENDING') + '</span>'
      + '<strong>' + esc(na.title) + '</strong>'
      + '<p>' + esc(na.note) + '</p>'
      + '</div>'
      + '<div class="na-meter">' + C.ringSVG(dayProgress, '--c-score', 22) + '</div>'
      + '</div></div></section>';

    /* NIGHT REPORT / END DAY */
    out += '<section class="sec"><div class="sec-head"><h2>Night Report</h2>'
      + (d.report ? '<span class="eyebrow">CLOSED ' + S.hhmm(d.report.endedAt) + '</span>' : '') + '</div>';
    if (d.report) {
      out += reportPanel(d);
    } else if (st) {
      out += '<div class="panel">'
        + '<p class="hint" style="margin:0 0 14px">その日の入力とログから、DAY SCOREと評価を出します。'
        + (hourNow() >= 20 || hourNow() < 4 ? '' : '<br>夜になったら実行してください。') + '</p>'
        + '<button class="btn primary block" type="button" data-endday="1">END DAY</button>'
        + '</div>';
    } else {
      out += '<div class="panel"><div class="empty">入力が済むと使えます。</div></div>';
    }
    out += '</section>';

    out += '</div></div>';
    return out;
  }

  function reportPanel(d) {
    var r = d.report;
    var grades = E.PARAMS.map(function (p) {
      var v = d.status[p.id];
      return '<div class="grade-row" style="--gc:var(' + p.varName + ')">'
        + '<span class="gr-name">' + p.label + '</span>'
        + '<span class="gr-bar"><i style="width:' + v + '%"></i></span>'
        + '<span class="gr-g">' + r.grades[p.id] + '</span>'
        + '</div>';
    }).join('');

    var circ = 2 * Math.PI * 64;
    return '<div class="panel">'
      + '<div class="report-hero">'
      + '<div class="score-ring"><svg viewBox="0 0 150 150" aria-hidden="true">'
      + '<circle class="st" cx="75" cy="75" r="64"/>'
      + '<circle class="sf" cx="75" cy="75" r="64" style="stroke-dasharray:' + circ.toFixed(1) + ';stroke-dashoffset:' + circ.toFixed(1) + '"'
      + ' data-off="' + (circ * (1 - r.score / 100)).toFixed(1) + '"/>'
      + '</svg><div class="score-val"><b>' + r.score + '</b><span class="eyebrow">Day Score</span></div></div>'
      + '<div class="grades">' + grades + '</div>'
      + '</div>'
      + '<div class="report-comment">' + esc(r.comment) + '</div>'
      + '<div class="btn-row" style="margin-top:16px">'
      + '<button class="btn ghost" type="button" data-share="1">' + C.icon('share') + ' SHARE</button>'
      + '<button class="btn ghost" type="button" data-reopen="1">REOPEN</button>'
      + '</div></div>';
  }

  function timelineRows(k, events, d) {
    var out = '';
    if (d && d.startedAt) {
      out += '<li><div class="tl-row" data-system="1">'
        + '<span class="tl-time">' + d.startedAt + '</span>'
        + '<span class="tl-icon">' + C.icon('system') + '</span>'
        + '<span class="tl-label">SYSTEM START</span>'
        + '<span></span></div></li>';
    }
    out += events.map(function (ev) {
      var t = E.eventType(ev.type);
      var label = t.label + (t.countable && ev.qty > 1 ? ' ×' + ev.qty : '');
      return '<li><button class="tl-row" type="button" data-event="' + esc(ev.id) + '" data-day="' + esc(k) + '">'
        + '<span class="tl-time">' + esc(ev.time) + '</span>'
        + '<span class="tl-icon">' + C.icon(ev.type) + '</span>'
        + '<span class="tl-label">' + esc(label)
        + (ev.note ? '<span class="tl-note">' + esc(ev.note) + '</span>' : '')
        + '</span>'
        + '<span class="tl-chev">' + C.icon('chevron') + '</span>'
        + '</button></li>';
    }).join('');
    return out;
  }

  /* ---------------- INPUT ---------------- */

  function viewInput() {
    var k = S.today();
    var d = S.day(k, true);

    if (inputDraft === null) {
      inputDraft = {};
      E.QUESTIONS.forEach(function (q) {
        inputDraft[q.id] = (d.input && d.input[q.id] != null) ? d.input[q.id] : q.def;
      });
    }

    if (inputStep >= E.QUESTIONS.length) return viewCalc();

    var q = E.QUESTIONS[inputStep];
    var v = inputDraft[q.id];

    var body = '';
    if (q.kind === 'slider') {
      var pct = ((v - q.min) / (q.max - q.min)) * 100;
      body = '<div class="q-answer num">' + v.toFixed(1) + '<small>' + q.unit + '</small></div>'
        + '<div class="q-answer-note">' + esc(q.note(v)) + '</div>'
        + '<div class="slider-wrap">'
        + '<input type="range" id="q-range" min="' + q.min + '" max="' + q.max + '" step="' + q.step + '"'
        + ' value="' + v + '" style="--fill:' + pct + '%" aria-label="' + esc(q.title) + '">'
        + '<div class="slider-scale"><span>' + q.min + 'h</span><span>7h</span><span>' + q.max + 'h</span></div>'
        + '</div>';
    } else {
      var cur = q.options.filter(function (o) { return o.v === v; })[0] || q.options[2];
      body = '<div class="q-answer">' + esc(cur.t) + '</div>'
        + '<div class="q-answer-note">' + q.options.length + '段階のうち ' + v + '</div>'
        + '<div class="choices" data-cols="5">'
        + q.options.map(function (o) {
          return '<button class="choice" type="button" data-choice="' + o.v + '" aria-pressed="' + (o.v === v ? 'true' : 'false') + '">'
            + '<b>' + o.v + '</b><span>' + esc(o.t) + '</span></button>';
        }).join('')
        + '</div>';
    }

    var isLast = inputStep === E.QUESTIONS.length - 1;

    return '<div class="q-head">'
      + '<span class="q-count num">' + (inputStep + 1) + ' / ' + E.QUESTIONS.length + '</span>'
      + '<span class="q-prog"><i style="width:' + ((inputStep + 1) / E.QUESTIONS.length * 100) + '%"></i></span>'
      + '<button class="icon-btn" type="button" data-go="home" aria-label="閉じる">' + C.icon('close') + '</button>'
      + '</div>'
      + '<div class="q-body" data-dir="' + inputDir + '">'
      + '<div class="q-no">Q' + (inputStep + 1) + '</div>'
      + '<h1 class="q-title">' + esc(q.title) + '</h1>'
      + body
      + '<div class="q-nav">'
      + '<button class="btn ghost" type="button" data-step="-1"' + (inputStep === 0 ? ' disabled' : '') + '>PREV</button>'
      + '<button class="btn primary" type="button" data-step="1">' + (isLast ? 'EXECUTE' : 'NEXT') + '</button>'
      + '</div></div>';
  }

  function viewCalc() {
    var lines = [
      'READING INPUT …',
      'APPLYING SLEEP CURVE …',
      'CHECKING EVENT LOG …',
      'COMPUTING SYSTEM STATUS …',
      'BUILDING TODAY MISSION …'
    ];
    return '<div class="calc">'
      + lines.map(function (l, i) {
        return '<div class="calc-line" style="animation-delay:' + (i * 170) + 'ms">' + l + '</div>';
      }).join('')
      + '</div>';
  }

  function mountInput() {
    var range = $('q-range');
    if (!range) return;
    var q = E.QUESTIONS[inputStep];
    range.addEventListener('input', function () {
      var v = parseFloat(range.value);
      inputDraft[q.id] = v;
      range.style.setProperty('--fill', ((v - q.min) / (q.max - q.min)) * 100 + '%');
      var ans = el.screen.querySelector('.q-answer');
      var note = el.screen.querySelector('.q-answer-note');
      if (ans) ans.innerHTML = v.toFixed(1) + '<small>' + q.unit + '</small>';
      if (note) note.textContent = q.note(v);
    });
  }

  function commitInput() {
    var k = S.today();
    E.submitInput(k, {
      sleep: inputDraft.sleep,
      condition: inputDraft.condition,
      sharpness: inputDraft.sharpness,
      social: inputDraft.social,
      stress: inputDraft.stress
    });
    inputStep = E.QUESTIONS.length;
    render();
    setTimeout(function () {
      inputDraft = null;
      inputStep = 0;
      view = 'home';
      render();
      setTimeout(checkEggs, 500);
    }, 1250);
  }

  /* ---------------- LOG ---------------- */

  function viewLog() {
    var k = logDayKey || S.today();
    var d = S.day(k, false) || S.emptyDay(k);
    var isToday = k === S.today();
    var canNext = k < S.today();

    var out = '<section class="sec">'
      + '<div class="sec-head"><h2>Event Log</h2>'
      + '<button class="btn sm" type="button" data-add-log="1">' + C.icon('plus') + ' LOG</button></div>'
      + '<div class="panel-h" style="margin-bottom:14px">'
      + '<button class="icon-btn" type="button" data-logday="-1" aria-label="前の日" style="transform:rotate(180deg)">' + C.icon('chevron') + '</button>'
      + '<div style="text-align:center"><div style="font-size:15px">' + fmtDateShort(k) + '</div>'
      + '<span class="eyebrow">' + (isToday ? 'TODAY' : fmtDate(k)) + '</span></div>'
      + '<button class="icon-btn" type="button" data-logday="1" aria-label="次の日"' + (canNext ? '' : ' disabled style="opacity:.25"') + '>' + C.icon('chevron') + '</button>'
      + '</div>'
      + '<div class="panel">';

    if (!(d.events || []).length && !d.startedAt) {
      out += '<div class="empty">この日の記録はありません。</div>';
    } else {
      out += '<ul class="timeline">' + timelineRows(k, d.events || [], d) + '</ul>';
    }
    out += '</div></section>';

    if (d.status) {
      out += '<section class="sec"><div class="sec-head"><h2>Status of the day</h2></div>'
        + '<div class="status-rail">'
        + E.PARAMS.map(function (p) {
          return '<div class="gauge"><div class="gauge-ring">' + C.ringSVG(d.status[p.id], p.varName, 34)
            + '<div class="gauge-val">' + d.status[p.id] + '</div></div>'
            + '<div class="gauge-label">' + p.label + '</div></div>';
        }).join('')
        + '</div></section>';
    }

    out += '<p class="hint">ログを足すと、その日の状態も計算し直します。'
      + '前夜の飲酒や夜更かしは、翌日のENERGYとFOCUSに反映されます。</p>';

    return out;
  }

  /* ---------------- HISTORY ---------------- */

  function viewHistory() {
    var out = '<section class="sec">'
      + '<div class="sec-head"><h2>History</h2>'
      + '<div class="range-row">'
      + [7, 30, 90].map(function (n) {
        return '<button class="range-btn" type="button" data-range="' + n + '" aria-pressed="'
          + (historyRange === n ? 'true' : 'false') + '">' + n + 'D</button>';
      }).join('')
      + '</div></div>'
      + '<div class="chart-box" id="chart-box"><div class="chart-tip" id="chart-tip"></div></div>'
      + '<div class="legend" id="legend"></div>'
      + '<div id="avg-host"></div>'
      + '</section>';

    out += '<section class="sec"><div class="sec-head"><h2>Insights</h2></div>' + insightsBlock() + '</section>';
    return out;
  }

  function insightsBlock() {
    var r = E.insights();
    if (!r.ready) {
      return '<div class="panel"><div class="empty">'
        + 'あと' + (r.need - r.have) + '日分の記録で、傾向の分析を始めます。<br>'
        + '<span class="eyebrow">' + r.have + ' / ' + r.need + ' DAYS</span>'
        + '</div></div>';
    }
    if (!r.items.length) {
      return '<div class="panel"><div class="empty">'
        + '記録は' + r.have + '日分あります。<br>いまのところ、はっきりした差は出ていません。'
        + '</div></div>';
    }
    return '<div class="panel">' + r.items.map(function (it) {
      var cvar = it.color === 'score' ? '--c-score' : '--c-' + it.color;
      return '<div class="insight">'
        + '<span class="insight-ico" style="--ic:var(' + cvar + ')">' + C.icon(it.icon) + '</span>'
        + '<div class="insight-body">'
        + '<div class="insight-cond">' + esc(it.cond) + '</div>'
        + '<div class="insight-eff">' + it.metric + ' が平均 <b>' + signed(it.diff) + '</b></div>'
        + '<div class="insight-n">該当 ' + it.n + '日 / 比較 ' + it.total + '日</div>'
        + '</div></div>';
    }).join('')
      + '</div><p class="hint" style="margin-top:12px">'
      + '記録が' + E.MIN_DAYS + '日を超え、各グループが4日以上そろったものだけを出しています。'
      + '差が3未満のものは結論にしません。</p>';
  }

  var historyRows = [];

  function mountHistory() {
    var box = $('chart-box');
    if (!box) return;
    historyRows = E.series(historyRange);
    drawAndBind();

    var legend = $('legend');
    legend.innerHTML = C.SERIES.map(function (s) {
      var cvar = s.id === 'score' ? '--c-score' : '--c-' + s.id;
      return '<button class="legend-item" type="button" data-series="' + s.id + '"'
        + ' aria-pressed="' + (activeSeries.indexOf(s.id) !== -1 ? 'true' : 'false') + '"'
        + ' style="--lc:var(' + cvar + ')"><i></i>' + s.label + '</button>';
    }).join('');

    renderAvg();

    if (!mountHistory._resize) {
      mountHistory._resize = true;
      var t = null;
      global.addEventListener('resize', function () {
        if (view !== 'history') return;
        clearTimeout(t);
        t = setTimeout(function () { if ($('chart-box')) drawAndBind(); }, 160);
      });
    }
  }

  function drawAndBind() {
    var box = $('chart-box');
    if (!box) return;
    var geo = C.drawHistory(box, historyRows, activeSeries);
    var tip = $('chart-tip');
    var cross = box.querySelector('#lo-cross');
    var hit = box.querySelector('#lo-hit');
    if (!hit) return;

    function locate(clientX) {
      var svg = box.querySelector('svg');
      var r = svg.getBoundingClientRect();
      var rel = (clientX - r.left) / r.width * geo.W;
      var i = Math.round((rel - geo.padL) / (geo.plotW || 1) * (geo.n - 1));
      return Math.max(0, Math.min(geo.n - 1, i));
    }

    function show(i, clientX) {
      var row = historyRows[i];
      cross.setAttribute('x1', geo.x(i).toFixed(1));
      cross.setAttribute('x2', geo.x(i).toFixed(1));
      cross.style.opacity = '1';

      var items = C.SERIES.filter(function (s) { return activeSeries.indexOf(s.id) !== -1; })
        .map(function (s) {
          var v = C.valueOf(row, s.id);
          var cvar = s.id === 'score' ? '--c-score' : '--c-' + s.id;
          return '<dt><span class="ct-dot" style="--cc:var(' + cvar + ')"></span>'
            + '<span class="ct-name">' + s.label + '</span>'
            + '<span class="ct-val">' + (v == null ? '--' : v) + '</span></dt>';
        }).join('');

      tip.innerHTML = '<div class="ct-date">' + fmtDate(row.key) + '</div><dl>' + items + '</dl>';
      tip.setAttribute('data-on', '1');

      var bw = box.clientWidth;
      var tw = tip.offsetWidth || 150;
      var svg = box.querySelector('svg');
      var sr = svg.getBoundingClientRect();
      var px = (clientX - box.getBoundingClientRect().left);
      var left = Math.max(8, Math.min(bw - tw - 8, px - tw / 2));
      tip.style.left = left + 'px';
      tip.style.top = '10px';
      void sr;
    }

    function hide() {
      tip.removeAttribute('data-on');
      cross.style.opacity = '0';
    }

    hit.addEventListener('pointermove', function (e) { show(locate(e.clientX), e.clientX); });
    hit.addEventListener('pointerdown', function (e) { show(locate(e.clientX), e.clientX); });
    hit.addEventListener('pointerleave', hide);
    hit.addEventListener('pointercancel', hide);
    box.addEventListener('pointerleave', hide);
  }

  function renderAvg() {
    var host = $('avg-host');
    if (!host) return;
    var avg = E.averages(historyRows);
    if (!avg.n) {
      host.innerHTML = '<p class="hint" style="margin-top:14px">この期間の記録はまだありません。</p>';
      return;
    }
    var cols = C.SERIES.filter(function (s) { return activeSeries.indexOf(s.id) !== -1; });
    host.innerHTML = '<div class="avg-scroll"><table class="avg-table"><thead><tr><th>AVERAGE</th>'
      + cols.map(function (s) {
        var cvar = s.id === 'score' ? '--c-score' : '--c-' + s.id;
        return '<th><span class="th-key" style="--kc:var(' + cvar + ')"><i></i>' + (s.id === 'score' ? 'SCORE' : s.label) + '</span></th>';
      }).join('')
      + '</tr></thead><tbody><tr><td>' + avg.n + '日</td>'
      + cols.map(function (s) { return '<td>' + (avg[s.id] == null ? '--' : avg[s.id]) + '</td>'; }).join('')
      + '</tr></tbody></table></div>';
  }

  /* ---------------- MENU ---------------- */

  function viewMenu() {
    var st = S.get();
    var keys = S.recordedKeys();
    var size = S.byteSize();
    var sizeText = size > 1024 * 1024
      ? (size / 1024 / 1024).toFixed(1) + ' MB'
      : Math.max(1, Math.round(size / 1024)) + ' KB';

    var out = '<section class="sec">'
      + '<div class="sec-head"><h2>System</h2></div>'
      + '<div class="stat-strip">'
      + '<div class="stat-cell"><b class="num">' + S.streak() + '</b><span class="eyebrow">Streak Days</span></div>'
      + '<div class="stat-cell"><b class="num">' + keys.length + '</b><span class="eyebrow">Recorded</span></div>'
      + '<div class="stat-cell"><b class="num">' + sizeText.split(' ')[0] + '</b><span class="eyebrow">' + sizeText.split(' ')[1] + ' Stored</span></div>'
      + '</div></section>';

    var themeLight = st.settings.theme === 'light';

    out += '<section class="sec"><div class="sec-head"><h2>Settings</h2></div><div class="menu-list">'
      + '<div class="menu-item"><span><span class="mi-t">DAYLIGHT モード</span>'
      + '<span class="mi-s">明るい場所ではこちらが読みやすくなります</span></span>'
      + '<button class="switch" type="button" data-toggle-theme="1" aria-pressed="' + (themeLight ? 'true' : 'false') + '" aria-label="テーマを切り替える"></button></div>'

      + '<div class="menu-item"><span><span class="mi-t">デモデータ</span>'
      + '<span class="mi-s">45日分の見本を入れて、履歴と分析の動きを確認できます</span></span>'
      + '<button class="switch" type="button" data-demo="1" aria-pressed="' + (st.settings.demo ? 'true' : 'false') + '" aria-label="デモデータを切り替える"></button></div>'

      + '<button class="menu-item" type="button" data-export="1"><span><span class="mi-t">データを書き出す</span>'
      + '<span class="mi-s">JSONファイルとして保存します</span></span><span class="mi-v">JSON</span></button>'

      + '<button class="menu-item" type="button" data-import="1"><span><span class="mi-t">データを取り込む</span>'
      + '<span class="mi-s">書き出したJSONを読み込みます（現在のデータは置き換わります）</span></span><span class="mi-v">JSON</span></button>'

      + '<button class="menu-item" type="button" data-install="1"><span><span class="mi-t">ホーム画面に追加</span>'
      + '<span class="mi-s">アプリのように全画面で使えます</span></span><span class="mi-v">PWA</span></button>'

      + '<button class="menu-item" type="button" data-terminal="1"><span><span class="mi-t">TERMINAL</span>'
      + '<span class="mi-s">ロゴを5回押しても開きます</span></span><span class="mi-v">&gt;_</span></button>'

      + '<button class="menu-item" type="button" data-wipe="1"><span><span class="mi-t" style="color:var(--warn)">すべてのデータを消す</span>'
      + '<span class="mi-s">取り消せません。先に書き出しておくことをすすめます</span></span><span class="mi-v">RESET</span></button>'
      + '</div></section>';

    var unlocked = st.settings.unlocked || [];
    out += '<section class="sec"><div class="sec-head"><h2>About</h2></div>'
      + '<div class="panel"><p class="hint" style="margin:0">'
      + 'LIFE//OS は、毎日の状態を見えるようにするための個人用ダッシュボードです。'
      + 'データは端末の中だけに保存され、外部には送信しません。ログイン・通信は不要です。'
      + '</p>'
      + '<div style="margin-top:14px;display:flex;gap:18px;flex-wrap:wrap">'
      + '<span class="eyebrow">VERSION 1.0.0</span>'
      + '<span class="eyebrow">DAY CUTOFF 04:00</span>'
      + '<span class="eyebrow">UNLOCKED ' + unlocked.length + '</span>'
      + '</div></div></section>';

    return out;
  }

  /* ================================================================
     シート（ログの追加・編集）
     ================================================================ */

  var sheetState = null;

  function openLogSheet(dayK, eventId) {
    var d = S.day(dayK, true);
    var ev = eventId ? (d.events || []).filter(function (e) { return e.id === eventId; })[0] : null;

    sheetState = {
      dayKey: dayK,
      id: ev ? ev.id : null,
      type: ev ? ev.type : 'work',
      time: ev ? ev.time : (dayK === S.today() ? S.hhmm() : '12:00'),
      note: ev ? (ev.note || '') : '',
      qty: ev ? (ev.qty || 1) : 1
    };

    renderSheet();
  }

  function renderSheet() {
    if (!sheetState) return;
    var s = sheetState;
    var isDrink = s.type === 'drink';

    el.sheetHost.hidden = false;
    el.sheetHost.innerHTML = '<div class="sheet-scrim" data-close-sheet="1"></div>'
      + '<div class="sheet" role="dialog" aria-modal="true" aria-label="出来事を記録">'
      + '<div class="sheet-grab"></div>'
      + '<div class="sheet-h"><span class="eyebrow">' + (s.id ? 'EDIT EVENT' : 'NEW EVENT') + '</span>'
      + '<button class="icon-btn" type="button" data-close-sheet="1" aria-label="閉じる">' + C.icon('close') + '</button></div>'

      + '<div class="type-grid">' + E.EVENT_TYPES.map(function (t) {
        return '<button class="type-btn" type="button" data-type="' + t.id + '" aria-pressed="' + (t.id === s.type ? 'true' : 'false') + '">'
          + C.icon(t.id) + '<span>' + t.jp + '</span></button>';
      }).join('') + '</div>'

      + '<div class="field"><span class="eyebrow">Time</span>'
      + '<input class="input" type="time" id="ev-time" value="' + esc(s.time) + '"></div>'

      + (isDrink ? '<div class="field"><span class="eyebrow">杯数</span>'
        + '<div class="stepper">'
        + '<button class="step-btn" type="button" data-qty="-1" aria-label="減らす">−</button>'
        + '<b class="num">' + s.qty + '</b>'
        + '<button class="step-btn" type="button" data-qty="1" aria-label="増やす">＋</button>'
        + '<span class="hint" style="margin-left:6px">飲んだ量は、翌日のENERGYに効きます</span>'
        + '</div></div>' : '')

      + '<div class="field"><span class="eyebrow">Note（任意）</span>'
      + '<textarea class="textarea" id="ev-note" placeholder="ひとことだけ">' + esc(s.note) + '</textarea></div>'

      + '<div class="btn-row" style="margin-top:20px">'
      + (s.id ? '<button class="btn danger" type="button" data-del="1">' + C.icon('trash') + ' 削除</button>' : '')
      + '<button class="btn primary" type="button" data-save="1">' + (s.id ? '更新' : '記録する') + '</button>'
      + '</div></div>';
  }

  function closeSheet() {
    var sheet = el.sheetHost.querySelector('.sheet');
    if (!sheet) { el.sheetHost.hidden = true; return; }
    sheet.setAttribute('data-exit', '1');
    setTimeout(function () {
      el.sheetHost.hidden = true;
      el.sheetHost.innerHTML = '';
      sheetState = null;
    }, 210);
  }

  function saveSheet() {
    var s = sheetState;
    if (!s) return;
    var timeEl = $('ev-time'), noteEl = $('ev-note');
    var time = (timeEl && timeEl.value) || s.time;
    var note = (noteEl && noteEl.value.trim()) || '';

    if (s.id) {
      S.updateEvent(s.dayKey, s.id, { type: s.type, time: time, note: note, qty: s.type === 'drink' ? s.qty : undefined });
    } else {
      var ev = { type: s.type, time: time, note: note };
      if (s.type === 'drink') ev.qty = s.qty;
      S.addEvent(s.dayKey, ev);
    }
    E.recompute(s.dayKey);
    // 前日のログは翌日の状態も動かす
    E.recompute(S.shiftKey(s.dayKey, 1));
    var dk = s.dayKey;
    closeSheet();
    toast(dk === S.today() ? 'LOGGED' : 'UPDATED');
    setTimeout(render, 60);
  }

  function deleteSheetEvent() {
    var s = sheetState;
    if (!s || !s.id) return;
    S.removeEvent(s.dayKey, s.id);
    E.recompute(s.dayKey);
    E.recompute(S.shiftKey(s.dayKey, 1));
    closeSheet();
    toast('DELETED');
    setTimeout(render, 60);
  }

  /* ================================================================
     オーバーレイ（演出）
     ================================================================ */

  function showOverlay(html, cls) {
    el.overlayHost.hidden = false;
    el.overlayHost.className = 'overlay-host' + (cls ? ' ' + cls : '');
    el.overlayHost.innerHTML = html;
  }

  function closeOverlay() {
    if (el.overlayHost.hidden) return;
    el.overlayHost.setAttribute('data-exit', '1');
    setTimeout(function () {
      el.overlayHost.hidden = true;
      el.overlayHost.removeAttribute('data-exit');
      el.overlayHost.innerHTML = '';
    }, 280);
  }

  function orbitSVG(center) {
    return '<div class="ov-rings"><svg viewBox="0 0 200 200" aria-hidden="true">'
      + '<circle cx="100" cy="100" r="92"/><circle cx="100" cy="100" r="70"/>'
      + '<g class="orbit"><circle cx="100" cy="100" r="82" stroke-dasharray="24 400" stroke-width="2"/></g>'
      + '<g class="orbit orbit-2"><circle cx="100" cy="100" r="60" stroke-dasharray="14 300" stroke-width="2"/></g>'
      + '</svg><div class="ov-rings-center">' + center + '</div></div>';
  }

  /* ---------------- イースターエッグ ---------------- */

  var STREAK_MARKS = [7, 14, 30, 60, 100, 365];

  function checkEggs() {
    if (!el.overlayHost.hidden || !el.boot.hidden) return;
    var k = S.today();
    var d = S.day(k);
    var h = new Date().getHours();

    // 1. 深夜2時以降
    if (h >= 2 && h < 4 && !S.hasSeen('latenight', k)) {
      S.markSeen('latenight', k);
      showOverlay('<div class="ov">'
        + '<div class="ov-kicker">SYSTEM NOTICE</div>'
        + '<div class="ov-title">WARNING</div>'
        + '<div class="ov-big num">' + S.hhmm() + '</div>'
        + '<div class="ov-note">YOU SHOULD PROBABLY BE SLEEPING.\n明日のENERGYとFOCUSは、いま決まります。</div>'
        + '<button class="btn ghost" type="button" data-ov-close="1">I KNOW.</button>'
        + '</div>', 'ov-warn');
      return;
    }

    // 2. 全パラメータ80以上
    if (d && d.status && !S.hasSeen('optimal', k)) {
      var all = E.PARAMS.every(function (p) { return d.status[p.id] >= 80; });
      if (all) {
        S.markSeen('optimal', k);
        S.unlock('optimal-state');
        showOverlay('<div class="ov">'
          + orbitSVG('<div class="ov-big num">' + Math.round(E.PARAMS.reduce(function (a, p) { return a + d.status[p.id]; }, 0) / 5) + '</div>')
          + '<div class="ov-title">OPTIMAL STATE</div>'
          + '<div class="ov-kicker">DETECTED</div>'
          + '<div class="ov-note">5項目すべてが80を超えています。\nこの日の手順は、記録として残ります。</div>'
          + '<button class="btn ghost" type="button" data-ov-close="1">CONTINUE</button>'
          + '</div>');
        return;
      }
    }

    // 3. 連続入力の節目
    var n = S.streak();
    if (STREAK_MARKS.indexOf(n) !== -1 && !S.hasSeen('streak-' + n, 'done')) {
      S.markSeen('streak-' + n, 'done');
      S.unlock('streak-' + n);
      showOverlay('<div class="ov">'
        + '<div class="ov-kicker">SYSTEM STABILITY</div>'
        + orbitSVG('<div><div class="ov-big num">' + n + '</div><div class="ov-kicker">DAYS</div></div>')
        + '<div class="ov-title">ONLINE FOR ' + n + ' DAYS</div>'
        + '<div class="ov-note">' + n + '日続けて記録が入りました。\nKEEP GOING.</div>'
        + '<button class="btn ghost" type="button" data-ov-close="1">CONTINUE</button>'
        + '</div>');
    }
  }

  /* ---------------- ターミナル ---------------- */

  var termLines = [];

  function openTerminal() {
    termLines = [
      '> LIFE//OS TERMINAL v1.0.0',
      '  ACCESS GRANTED. WELCOME, OPERATOR.',
      "  'help' でコマンド一覧を表示します。",
      ''
    ];
    S.unlock('terminal');
    renderTerminal();
    setTimeout(function () {
      var i = $('term-input');
      if (i) i.focus();
    }, 80);
  }

  function renderTerminal() {
    showOverlay('<div class="term" role="dialog" aria-modal="true" aria-label="ターミナル">'
      + '<div class="term-bar"><span>LIFE//OS TERMINAL</span>'
      + '<button class="icon-btn" type="button" data-ov-close="1" aria-label="閉じる">' + C.icon('close') + '</button></div>'
      + '<div class="term-out" id="term-out">' + termLines.join('\n') + '</div>'
      + '<div class="term-in"><span>&gt;</span>'
      + '<input id="term-input" autocomplete="off" autocapitalize="off" spellcheck="false" aria-label="コマンド"></div>'
      + '</div>');
    var out = $('term-out');
    if (out) out.scrollTop = out.scrollHeight;
  }

  function termPrint(lines) {
    termLines = termLines.concat(lines).concat(['']);
    var out = $('term-out');
    if (out) {
      out.innerHTML = termLines.join('\n');
      out.scrollTop = out.scrollHeight;
    }
  }

  function runCommand(raw) {
    var cmd = raw.trim();
    termLines.push('<span class="t-cmd">&gt; ' + esc(cmd) + '</span>');
    if (!cmd) { termPrint([]); return; }

    var st = S.get();
    var d = S.day(S.today());
    var parts = cmd.toLowerCase().split(/\s+/);

    switch (parts[0]) {
      case 'help':
        termPrint([
          '  help        コマンド一覧',
          '  status      いまの5項目',
          '  log         今日のログ',
          '  streak      連続日数',
          '  insights    分析の結果',
          '  whoami      利用者の情報',
          '  theme       表示テーマを切り替える',
          '  seed        デモデータを入れる',
          '  export      データを書き出す',
          '  clear       画面を消す',
          '  exit        ターミナルを閉じる'
        ]);
        break;

      case 'status':
        if (!d || !d.status) { termPrint(['<span class="t-err">  NO INPUT. 先に状態を入力してください。</span>']); break; }
        termPrint(E.PARAMS.map(function (p) {
          var v = d.status[p.id];
          var bar = '';
          for (var i = 0; i < 20; i++) bar += (i < Math.round(v / 5) ? '█' : '·');
          return '  ' + (p.label + '      ').slice(0, 7) + ' ' + bar + ' ' + v;
        }).concat(['  DAY SCORE ' + (E.dayScore(d.status, d))]));
        break;

      case 'log':
        if (!d || !(d.events || []).length) { termPrint(['  NO EVENTS.']); break; }
        termPrint(d.events.map(function (e) {
          var t = E.eventType(e.type);
          return '  ' + e.time + '  ' + t.label + (e.qty > 1 ? ' ×' + e.qty : '') + (e.note ? '  // ' + e.note : '');
        }));
        break;

      case 'streak':
        termPrint(['  ONLINE FOR ' + S.streak() + ' DAYS',
          '  RECORDED ' + S.recordedKeys().length + ' DAYS']);
        break;

      case 'insights':
        var r = E.insights();
        if (!r.ready) { termPrint(['  INSUFFICIENT DATA — ' + r.have + '/' + r.need + ' DAYS']); break; }
        if (!r.items.length) { termPrint(['  NO SIGNIFICANT PATTERN.']); break; }
        termPrint(r.items.map(function (it) {
          return '  ' + it.cond + ' ' + it.metric + ' ' + signed(it.diff) + '  (n=' + it.n + ')';
        }));
        break;

      case 'whoami':
        termPrint([
          '  OPERATOR',
          '  FIRST BOOT   ' + String(st.createdAt).slice(0, 10),
          '  UNLOCKED     ' + (st.settings.unlocked.length ? st.settings.unlocked.join(', ') : 'none'),
          '  STORAGE      ' + Math.max(1, Math.round(S.byteSize() / 1024)) + ' KB (local only)'
        ]);
        break;

      case 'theme':
        toggleTheme();
        termPrint(['<span class="t-ok">  THEME → ' + S.get().settings.theme.toUpperCase() + '</span>']);
        break;

      case 'seed':
        E.seedDemo(45);
        termPrint(['<span class="t-ok">  45 DAYS OF DEMO DATA WRITTEN.</span>']);
        break;

      case 'export':
        doExport();
        termPrint(['<span class="t-ok">  EXPORTED.</span>']);
        break;

      case 'clear':
        termLines = [];
        renderTerminal();
        break;

      case 'exit':
        closeOverlay();
        render();
        break;

      case 'secret_mode':
      case 'unlock':
        if (S.unlock('operator')) {
          termPrint(['<span class="t-ok">  OPERATOR MODE UNLOCKED.</span>',
            '  ロゴを5回押すと、いつでもここに戻れます。']);
        } else {
          termPrint(['  ALREADY UNLOCKED.']);
        }
        break;

      default:
        termPrint(['<span class="t-err">  UNKNOWN COMMAND: ' + esc(parts[0]) + "</span>", "  'help' を試してください。"]);
    }
  }

  /* ---------------- コナミコマンド（内部の計算式を開く） ---------------- */

  var KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];
  var konamiPos = 0;

  function showDiagnostics() {
    S.unlock('diagnostics');
    var rows = [
      ['ENERGY', 'sleep .40 / condition .30 / calm .18 / sharp .12  − 前夜の酒 11 − 夜更かし 6'],
      ['FOCUS', 'sharp .44 / sleep .26 / calm .18 / condition .12  − 酒 6 − 夜更かし 7'],
      ['MOOD', 'calm .34 / condition .26 / social .22 / sleep .18  ＋ 運動 6'],
      ['BODY', 'condition .46 / sleep .28 / calm .16 / sharp .10  − 酒 8 ＋ 運動 5'],
      ['SOCIAL', 'social .55 / condition .20 / calm .15 / sleep .10  ＋ 面会 4'],
      ['DAY SCORE', 'E .24 / F .24 / M .20 / B .20 / S .12  ＋ログ補正']
    ];
    showOverlay('<div class="ov" style="max-width:460px">'
      + '<div class="ov-kicker">DIAGNOSTICS</div>'
      + '<div class="ov-title">CORE WEIGHTS</div>'
      + '<div style="text-align:left;margin-top:18px;font-family:var(--mono);font-size:10.5px;line-height:1.9;color:var(--ink-2)">'
      + rows.map(function (r) {
        return '<div style="padding:6px 0;border-bottom:1px solid var(--line-soft)">'
          + '<span style="color:var(--ink);letter-spacing:.14em">' + r[0] + '</span><br>' + r[1] + '</div>';
      }).join('')
      + '</div>'
      + '<div class="ov-note">この数字がすべてです。外部のAIは通していません。</div>'
      + '<button class="btn ghost" type="button" data-ov-close="1">CLOSE</button>'
      + '</div>');
  }

  /* ================================================================
     設定まわりの操作
     ================================================================ */

  function applyTheme() {
    var t = S.get().settings.theme || 'dark';
    document.documentElement.setAttribute('data-theme', t);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'light' ? '#F4F2ED' : '#0B0C0F');
  }

  function toggleTheme() {
    var cur = S.get().settings.theme || 'dark';
    S.setSetting('theme', cur === 'dark' ? 'light' : 'dark');
    applyTheme();
  }

  function doExport() {
    var blob = new Blob([S.exportJSON()], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'life-os-' + S.today() + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function doImport() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      if (!f) return;
      var reader = new FileReader();
      reader.onload = function () {
        try {
          S.importJSON(String(reader.result));
          applyTheme();
          toast('IMPORTED');
          render();
        } catch (e) {
          toast('読み込めませんでした');
        }
      };
      reader.readAsText(f);
    });
    input.click();
  }

  function confirmWipe() {
    showOverlay('<div class="ov">'
      + '<div class="ov-kicker">CONFIRM</div>'
      + '<div class="ov-title">DATA RESET</div>'
      + '<div class="ov-note">記録・設定をすべて消します。取り消せません。\n先に書き出しておくことをすすめます。</div>'
      + '<div class="btn-row" style="margin-top:24px">'
      + '<button class="btn ghost" type="button" data-ov-close="1">やめる</button>'
      + '<button class="btn danger" type="button" data-wipe-yes="1">消す</button>'
      + '</div></div>');
  }

  function doInstall() {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then(function () { installPrompt = null; });
      return;
    }
    showOverlay('<div class="ov">'
      + '<div class="ov-kicker">INSTALL</div>'
      + '<div class="ov-title">ADD TO HOME</div>'
      + '<div class="ov-note">iPhone / iPad は Safari の共有ボタンから「ホーム画面に追加」を選んでください。\n'
      + 'Android は Chrome のメニューから「アプリをインストール」を選びます。\n'
      + '追加すると、全画面でオフラインでも動きます。</div>'
      + '<button class="btn ghost" type="button" data-ov-close="1">CLOSE</button>'
      + '</div>');
  }

  function shareReport() {
    var d = S.day(S.today());
    if (!d || !d.report) return;
    var text = 'LIFE//OS — ' + fmtDate(S.today()) + '\n'
      + 'DAY SCORE ' + d.report.score + '\n'
      + E.PARAMS.map(function (p) {
        return (p.label + '      ').slice(0, 7) + ' ' + d.status[p.id] + '  ' + d.report.grades[p.id];
      }).join('\n')
      + '\n\n' + d.report.comment;

    if (navigator.share) {
      navigator.share({ text: text }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(function () { toast('COPIED'); },
        function () { toast('コピーできませんでした'); });
    } else {
      toast('コピーできませんでした');
    }
  }

  /* ================================================================
     イベント
     ================================================================ */

  var wordmarkTaps = 0, wordmarkTimer = null;

  document.addEventListener('click', function (e) {
    var t = e.target.closest ? e.target.closest('[data-tab],[data-go],[data-step],[data-choice],[data-mission],[data-add-log],[data-event],[data-logday],[data-range],[data-series],[data-toggle-theme],[data-demo],[data-export],[data-import],[data-install],[data-terminal],[data-wipe],[data-wipe-yes],[data-endday],[data-share],[data-reopen],[data-close-sheet],[data-type],[data-qty],[data-save],[data-del],[data-ov-close]') : null;
    if (!t) return;

    /* ---- ナビ ---- */
    if (t.dataset.tab) { go(t.dataset.tab); return; }
    if (t.dataset.go) { go(t.dataset.go); return; }

    /* ---- 入力 ---- */
    if (t.dataset.step) {
      var dir = +t.dataset.step;
      if (dir > 0 && inputStep === E.QUESTIONS.length - 1) { commitInput(); return; }
      inputDir = dir > 0 ? 'fwd' : 'back';
      inputStep = Math.max(0, Math.min(E.QUESTIONS.length - 1, inputStep + dir));
      render();
      return;
    }
    if (t.dataset.choice) {
      var q = E.QUESTIONS[inputStep];
      inputDraft[q.id] = +t.dataset.choice;
      render();
      // 選んだら少し待って次へ（迷いがなければ指1本で進む）
      if (inputStep < E.QUESTIONS.length - 1) {
        setTimeout(function () {
          if (view !== 'input') return;
          inputDir = 'fwd';
          inputStep++;
          render();
        }, 240);
      }
      return;
    }

    /* ---- ミッション ---- */
    if (t.dataset.mission) {
      var d = S.todayDay(true);
      var i = +t.dataset.mission;
      if (d.missions[i]) {
        d.missions[i].done = !d.missions[i].done;
        S.save();
        render();
      }
      return;
    }

    /* ---- ログ ---- */
    if (t.dataset.addLog) { openLogSheet(view === 'log' ? (logDayKey || S.today()) : S.today(), null); return; }
    if (t.dataset.event) { openLogSheet(t.dataset.day, t.dataset.event); return; }
    if (t.dataset.logday) {
      var next = S.shiftKey(logDayKey || S.today(), +t.dataset.logday);
      if (next > S.today()) return;
      logDayKey = next;
      render();
      return;
    }

    /* ---- シート ---- */
    if (t.dataset.closeSheet) { closeSheet(); return; }
    if (t.dataset.type) {
      sheetState.type = t.dataset.type;
      var timeEl = $('ev-time'), noteEl = $('ev-note');
      if (timeEl) sheetState.time = timeEl.value;
      if (noteEl) sheetState.note = noteEl.value;
      renderSheet();
      return;
    }
    if (t.dataset.qty) {
      sheetState.qty = Math.max(1, Math.min(20, sheetState.qty + (+t.dataset.qty)));
      var te = $('ev-time'), ne = $('ev-note');
      if (te) sheetState.time = te.value;
      if (ne) sheetState.note = ne.value;
      renderSheet();
      return;
    }
    if (t.dataset.save) { saveSheet(); return; }
    if (t.dataset.del) { deleteSheetEvent(); return; }

    /* ---- 履歴 ---- */
    if (t.dataset.range) {
      historyRange = +t.dataset.range;
      render();
      return;
    }
    if (t.dataset.series) {
      var id = t.dataset.series;
      var at = activeSeries.indexOf(id);
      if (at === -1) activeSeries.push(id);
      else if (activeSeries.length > 1) activeSeries.splice(at, 1);
      else return;
      t.setAttribute('aria-pressed', activeSeries.indexOf(id) !== -1 ? 'true' : 'false');
      drawAndBind();
      renderAvg();
      return;
    }

    /* ---- レポート ---- */
    if (t.dataset.endday) {
      var dd = S.todayDay(true);
      dd.report = E.buildReport(dd);
      S.save();
      render();
      toast('DAY CLOSED');
      return;
    }
    if (t.dataset.reopen) {
      var d2 = S.todayDay(true);
      d2.report = null;
      S.save();
      render();
      return;
    }
    if (t.dataset.share) { shareReport(); return; }

    /* ---- メニュー ---- */
    if (t.dataset.toggleTheme) { toggleTheme(); render(); return; }
    if (t.dataset.demo) {
      if (S.get().settings.demo) { E.clearDemo(); toast('DEMO DATA REMOVED'); }
      else { E.seedDemo(45); toast('DEMO DATA LOADED'); }
      render();
      return;
    }
    if (t.dataset.export) { doExport(); toast('EXPORTED'); return; }
    if (t.dataset.import) { doImport(); return; }
    if (t.dataset.install) { doInstall(); return; }
    if (t.dataset.terminal) { openTerminal(); return; }
    if (t.dataset.wipe) { confirmWipe(); return; }
    if (t.dataset.wipeYes) {
      S.wipe();
      applyTheme();
      closeOverlay();
      view = 'home';
      inputDraft = null;
      inputStep = 0;
      render();
      toast('SYSTEM RESET');
      return;
    }

    /* ---- オーバーレイ ---- */
    if (t.dataset.ovClose) { closeOverlay(); return; }
  });

  /* ロゴ5回でターミナル */
  el.wordmark.addEventListener('click', function () {
    wordmarkTaps++;
    clearTimeout(wordmarkTimer);
    wordmarkTimer = setTimeout(function () { wordmarkTaps = 0; }, 1400);
    if (wordmarkTaps >= 5) {
      wordmarkTaps = 0;
      openTerminal();
    }
  });

  /* ターミナル入力 */
  document.addEventListener('keydown', function (e) {
    var ti = $('term-input');
    if (ti && document.activeElement === ti) {
      if (e.key === 'Enter') {
        var v = ti.value;
        ti.value = '';
        runCommand(v);
      }
      return;
    }

    if (e.key === 'Escape') {
      if (!el.overlayHost.hidden) closeOverlay();
      else if (!el.sheetHost.hidden) closeSheet();
      return;
    }

    if (!el.boot.hidden) { endBoot(); return; }

    /* 文字入力中は以下のショートカットを拾わない */
    var ae = document.activeElement;
    if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;

    /* コナミコマンド */
    if (e.key === KONAMI[konamiPos] || (e.key && e.key.toLowerCase() === KONAMI[konamiPos])) {
      konamiPos++;
      if (konamiPos === KONAMI.length) {
        konamiPos = 0;
        showDiagnostics();
      }
    } else {
      konamiPos = (e.key === KONAMI[0]) ? 1 : 0;
    }

    if ((e.key === '`' || e.key === '~') && el.overlayHost.hidden) openTerminal();
  });

  /* 起動画面はどこを触っても飛ばせる */
  el.boot.addEventListener('click', endBoot);
  el.bootSkip.addEventListener('click', function (e) { e.stopPropagation(); endBoot(); });

  /* 時計 */
  setInterval(function () {
    if (el.clock) el.clock.textContent = S.hhmm();
  }, 20000);

  /* 日付が変わったら組み直す */
  var bootedKey = null;
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    if (bootedKey && bootedKey !== S.today()) {
      bootedKey = S.today();
      view = 'home';
      inputDraft = null;
      inputStep = 0;
      render();
      setTimeout(checkEggs, 500);
    }
  });

  global.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    installPrompt = e;
  });

  /* ================================================================
     起動
     ================================================================ */

  function init() {
    S.load();
    applyTheme();
    S.touchStart();
    bootedKey = S.today();

    var st = S.get();
    if (st.settings.lastBootKey !== S.today()) {
      runBoot();
    } else {
      el.boot.hidden = true;
      startApp();
    }

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
  }

  init();
})(window);
