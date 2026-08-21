/* ================================================================
   LIFE//OS — engine
   入力 → 5つの状態 → ミッション → DAY SCORE → インサイト。
   すべて端末内のルールベース計算。外部APIは使わない。
   ================================================================ */
(function (global) {
  'use strict';

  var S = global.LifeStore;

  /* ---------------- パラメータ定義 ---------------- */

  var PARAMS = [
    { id: 'energy', label: 'ENERGY', jp: '活力',   varName: '--c-energy' },
    { id: 'focus',  label: 'FOCUS',  jp: '集中',   varName: '--c-focus' },
    { id: 'mood',   label: 'MOOD',   jp: '気分',   varName: '--c-mood' },
    { id: 'body',   label: 'BODY',   jp: 'からだ', varName: '--c-body' },
    { id: 'social', label: 'SOCIAL', jp: '社交',   varName: '--c-social' }
  ];

  /* ---------------- 出来事の種類 ---------------- */

  var EVENT_TYPES = [
    { id: 'work',     label: 'WORK',     jp: '仕事' },
    { id: 'exercise', label: 'EXERCISE', jp: '運動' },
    { id: 'meal',     label: 'MEAL',     jp: '食事' },
    { id: 'sleep',    label: 'SLEEP',    jp: '睡眠' },
    { id: 'drink',    label: 'DRINK',    jp: '酒', countable: true },
    { id: 'sauna',    label: 'SAUNA',    jp: 'サウナ' },
    { id: 'outing',   label: 'OUTING',   jp: '外出' },
    { id: 'meet',     label: 'MEETING',  jp: '人と会った' },
    { id: 'other',    label: 'OTHER',    jp: 'その他' }
  ];

  function eventType(id) {
    for (var i = 0; i < EVENT_TYPES.length; i++) if (EVENT_TYPES[i].id === id) return EVENT_TYPES[i];
    return EVENT_TYPES[EVENT_TYPES.length - 1];
  }

  /* ---------------- 質問 ---------------- */

  var SCALE_5 = function (a, b, c, d, e) {
    return [
      { v: 1, t: a }, { v: 2, t: b }, { v: 3, t: c }, { v: 4, t: d }, { v: 5, t: e }
    ];
  };

  var QUESTIONS = [
    {
      id: 'sleep', kind: 'slider',
      title: '昨日はどれくらい眠れましたか',
      min: 3, max: 10, step: 0.5, def: 7,
      unit: '時間',
      note: function (v) {
        if (v < 5) return '不足しています。今日の判断は重くなります';
        if (v < 6.5) return 'やや不足しています';
        if (v <= 8.5) return '足りています';
        return '長めです。だるさが出ることがあります';
      }
    },
    {
      id: 'condition', kind: 'scale',
      title: '今日の体調は',
      options: SCALE_5('悪い', 'やや悪い', '普通', '良い', 'かなり良い'),
      def: 3
    },
    {
      id: 'sharpness', kind: 'scale',
      title: '頭は冴えていますか',
      options: SCALE_5('鈍い', 'やや鈍い', '普通', '冴えている', 'かなり冴えている'),
      def: 3
    },
    {
      id: 'social', kind: 'scale',
      title: '人と話したい気分ですか',
      options: SCALE_5('話したくない', 'あまり', '普通', '話したい', 'かなり話したい'),
      def: 3
    },
    {
      id: 'stress', kind: 'scale',
      title: 'ストレスはどのくらいありますか',
      options: SCALE_5('ほぼない', '少ない', '普通', '多い', 'かなり多い'),
      def: 3
    }
  ];

  /* ---------------- 計算の下ごしらえ ---------------- */

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function round(v) { return Math.round(v); }

  /** 睡眠時間 → 0..1。7.5時間を頂点に、不足側を急に、過多側をゆるく落とす */
  function sleepScore(h) {
    if (h == null) return 0.5;
    return clamp(h < 7.5 ? 1 - (7.5 - h) / 4.5 : 1 - (h - 7.5) / 6, 0, 1);
  }

  function scale01(v) { return clamp(((v || 3) - 1) / 4, 0, 1); }

  /** 前日の飲酒量・夜更かし・当日の運動などの補正材料を集める */
  function contextFor(k) {
    var st = S.get();
    var prevKey = S.shiftKey(k, -1);
    var prev = st.days[prevKey];
    var cur = st.days[k];

    var alcoholUnits = 0, lateNight = 0;
    if (prev && prev.events) {
      prev.events.forEach(function (e) {
        if (e.type === 'drink') alcoholUnits += (e.qty || 1);
      });
      var last = 0;
      prev.events.forEach(function (e) { last = Math.max(last, S.sortMinutes(e.time)); });
      // 01:00 以降のログ（04:00起点なので 1500 分以降）を夜更かしとみなす
      if (last >= 1500) lateNight = 1;
    }

    var exercised = 0, met = 0;
    if (cur && cur.events) {
      cur.events.forEach(function (e) {
        if (e.type === 'exercise' || e.type === 'sauna') exercised = 1;
        if (e.type === 'meet') met = 1;
      });
    }

    return {
      alcohol: clamp(alcoholUnits / 3, 0, 1),
      alcoholUnits: alcoholUnits,
      lateNight: lateNight,
      exercised: exercised,
      met: met
    };
  }

  /* ---------------- 状態の算出 ---------------- */

  function computeStatus(input, ctx) {
    ctx = ctx || { alcohol: 0, lateNight: 0, exercised: 0, met: 0 };

    var sl = sleepScore(input.sleep);
    var cond = scale01(input.condition);
    var sharp = scale01(input.sharpness);
    var soc = scale01(input.social);
    var calm = 1 - scale01(input.stress);

    var energy = 100 * (0.40 * sl + 0.30 * cond + 0.18 * calm + 0.12 * sharp)
      - 11 * ctx.alcohol - 6 * ctx.lateNight;
    var focus = 100 * (0.44 * sharp + 0.26 * sl + 0.18 * calm + 0.12 * cond)
      - 6 * ctx.alcohol - 7 * ctx.lateNight;
    var mood = 100 * (0.34 * calm + 0.26 * cond + 0.22 * soc + 0.18 * sl)
      + 6 * ctx.exercised;
    var body = 100 * (0.46 * cond + 0.28 * sl + 0.16 * calm + 0.10 * sharp)
      - 8 * ctx.alcohol + 5 * ctx.exercised;
    var social = 100 * (0.55 * soc + 0.20 * cond + 0.15 * calm + 0.10 * sl)
      + 4 * ctx.met;

    return {
      energy: round(clamp(energy, 0, 100)),
      focus: round(clamp(focus, 0, 100)),
      mood: round(clamp(mood, 0, 100)),
      body: round(clamp(body, 0, 100)),
      social: round(clamp(social, 0, 100))
    };
  }

  /* ---------------- TODAY MISSION ---------------- */

  /* 自己啓発の言葉にしない。OSからの指示として、短く、1文で。 */
  var MISSION_RULES = [
    { group: 'recovery', prio: 100, color: 'energy', tag: 'RECOVERY',
      when: function (s) { return s.energy < 40; },
      text: '今日は回復を優先。重要なタスクは1つに絞ってください。' },

    { group: 'recovery', prio: 92, color: 'energy', tag: 'HYDRATION',
      when: function (s, c) { return c.alcoholUnits >= 2; },
      text: '前夜の飲酒あり。水分を先にとってください。' },

    { group: 'recovery', prio: 74, color: 'energy', tag: 'SLEEP DEBT',
      when: function (s, c, i) { return i.sleep < 6; },
      text: '睡眠が不足しています。就寝を30分早めてください。' },

    { group: 'work', prio: 88, color: 'focus', tag: 'DEEP WORK',
      when: function (s) { return s.focus >= 72; },
      text: '90分のDeep Workを1回入れてください。割り込みは切っておきます。' },

    { group: 'work', prio: 84, color: 'focus', tag: 'TRIAGE',
      when: function (s) { return s.focus < 45; },
      text: '判断の重い仕事は後回し。手を動かすだけの作業から片づけてください。' },

    { group: 'work', prio: 60, color: 'focus', tag: 'SINGLE TASK',
      when: function (s) { return s.focus >= 45 && s.focus < 72; },
      text: '同時進行を2件までに。切り替えの回数を減らしてください。' },

    { group: 'load', prio: 86, color: 'mood', tag: 'LOAD',
      when: function (s, c, i) { return i.stress >= 4; },
      text: '負荷が高い状態です。今日の予定を1件だけ減らしてください。' },

    { group: 'mind', prio: 80, color: 'mood', tag: 'HOLD',
      when: function (s) { return s.mood < 42; },
      text: '重い決定は今日しないでください。判断を明日に送ります。' },

    { group: 'social', prio: 78, color: 'social', tag: 'SOCIAL',
      when: function (s) { return s.social < 40; },
      text: '無理に人付き合いを増やさないでください。断って構いません。' },

    { group: 'social', prio: 58, color: 'social', tag: 'SOCIAL',
      when: function (s) { return s.social >= 76; },
      text: '返信を止めている相手に、1件だけ返してください。' },

    { group: 'body', prio: 70, color: 'body', tag: 'BODY',
      when: function (s) { return s.body >= 72; },
      text: '強度の高い運動を入れても問題ありません。' },

    { group: 'body', prio: 68, color: 'body', tag: 'BODY',
      when: function (s) { return s.body < 45; },
      text: '今日は歩く程度に留めてください。追い込まないこと。' },

    { group: 'work', prio: 96, color: 'energy', tag: 'OPTIMAL',
      when: function (s) {
        return s.energy >= 78 && s.focus >= 78 && s.mood >= 78 && s.body >= 78;
      },
      text: '全項目が高水準。先送りしていた1件に着手してください。' },

    { group: 'body', prio: 30, color: 'body', tag: 'BASELINE',
      when: function () { return true; },
      text: '15分でいいので外を歩いてください。' }
  ];

  function buildMissions(status, ctx, input) {
    var picked = [];
    var usedGroup = {};

    MISSION_RULES
      .filter(function (r) { return r.when(status, ctx, input); })
      .sort(function (a, b) { return b.prio - a.prio; })
      .forEach(function (r) {
        if (usedGroup[r.group] || picked.length >= 3) return;
        usedGroup[r.group] = true;
        picked.push({ id: r.group + ':' + r.tag, text: r.text, tag: r.tag, color: r.color, done: false });
      });

    return picked.slice(0, 3);
  }

  /* ---------------- NEXT ACTION ---------------- */

  function nextAction(status, hour) {
    if (!status) return { title: 'System Input', note: '状態を入力すると、次の一手が出ます。', mins: 1 };

    if (hour >= 22 || hour < 4) {
      return { title: 'Wind Down', note: '画面を置いて、寝る準備に入ってください。', mins: 30 };
    }
    if (status.energy < 38) {
      return { title: 'Recovery Block', note: '20分。何もしない時間を先に確保します。', mins: 20 };
    }
    if (hour < 11 && status.focus >= 62) {
      return { title: 'Deep Work Session', note: '午前の冴えを、いちばん重い1件に当てます。', mins: 90 };
    }
    if (hour >= 11 && hour < 14) {
      return { title: 'Meal & Reset', note: '食べたら5分だけ外に出てください。', mins: 45 };
    }
    if (hour >= 14 && hour < 18) {
      return status.focus >= 55
        ? { title: 'Focus Block', note: '50分。連絡は後でまとめて返します。', mins: 50 }
        : { title: 'Shallow Work', note: '返信と整理に充てる時間帯です。', mins: 40 };
    }
    if (hour >= 18 && hour < 22) {
      return status.body >= 62
        ? { title: 'Training', note: '体は動きます。強度は自分で決めてください。', mins: 45 }
        : { title: 'Off Switch', note: '今日の仕事はここまでにします。', mins: 30 };
    }
    return { title: 'Focus Block', note: '50分だけ、ひとつのことに。', mins: 50 };
  }

  /* ---------------- DAY SCORE / NIGHT REPORT ---------------- */

  function gradeOf(v) {
    if (v >= 93) return 'S';
    if (v >= 84) return 'A';
    if (v >= 70) return 'B';
    if (v >= 55) return 'C';
    if (v >= 40) return 'D';
    return 'E';
  }

  function dayScore(status, day) {
    if (!status) return null;
    var base = 0.24 * status.energy + 0.24 * status.focus + 0.20 * status.mood
      + 0.20 * status.body + 0.12 * status.social;

    var counts = {}, lastMin = 0;
    (day.events || []).forEach(function (e) {
      counts[e.type] = (counts[e.type] || 0) + (e.type === 'drink' ? (e.qty || 1) : 1);
      lastMin = Math.max(lastMin, S.sortMinutes(e.time));
    });

    var adj = 0;
    if (counts.exercise) adj += 3;
    if (counts.sauna) adj += 2;
    if (counts.work) adj += 2;
    if ((counts.meal || 0) >= 2) adj += 1;
    if ((counts.drink || 0) >= 3) adj -= 5;
    else if ((counts.drink || 0) === 2) adj -= 2;
    if (lastMin >= 1530) adj -= 4;   // 01:30 以降まで起きていた

    return round(clamp(base + adj, 0, 100));
  }

  function reportComment(status, day, score) {
    var order = PARAMS.slice().sort(function (a, b) { return status[b.id] - status[a.id]; });
    var top = order[0], low = order[order.length - 1];

    var TOP = {
      energy: '活力は高水準でした。',
      focus: '集中力は高水準でした。',
      mood: '気分は安定していました。',
      body: '身体の状態は良好でした。',
      social: '人と関わる余力がありました。'
    };
    var LOW = {
      energy: '活力の回復が追いついていません。',
      focus: '集中を保つ余力が残っていません。',
      mood: '気分の落ち込みが記録されています。',
      body: '身体の負担が残っています。',
      social: '人と関わる余力は残っていません。'
    };

    var lines = [];
    if (status[top.id] >= 65) lines.push(TOP[top.id]);
    if (status[low.id] < 60) lines.push(LOW[low.id]);
    if (!lines.length) lines.push('大きな崩れも、伸びもない一日でした。');

    var counts = {}, lastMin = 0;
    (day.events || []).forEach(function (e) {
      counts[e.type] = (counts[e.type] || 0) + (e.type === 'drink' ? (e.qty || 1) : 1);
      lastMin = Math.max(lastMin, S.sortMinutes(e.time));
    });

    if (lastMin >= 1530) lines.push('夜間の回復時間が不足しています。');
    else if ((counts.drink || 0) >= 3) lines.push('飲酒量が多めです。明日の活力に出ます。');
    else if (counts.exercise) lines.push('運動の記録があります。明日の気分に効きます。');
    else if (score >= 80) lines.push('この状態を、明日も同じ手順で作れます。');
    else if (!day.events || !day.events.length) lines.push('ログがありません。記録があると精度が上がります。');

    return lines.slice(0, 3).join('\n');
  }

  function buildReport(day) {
    if (!day || !day.status) return null;
    var score = dayScore(day.status, day);
    var grades = {};
    PARAMS.forEach(function (p) { grades[p.id] = gradeOf(day.status[p.id]); });
    return {
      score: score,
      grades: grades,
      comment: reportComment(day.status, day, score),
      endedAt: new Date().toISOString()
    };
  }

  /* ---------------- INSIGHTS ---------------- */

  var MIN_DAYS = 10;      // 分析を始める最低日数
  var MIN_GROUP = 4;      // 各グループの最低日数
  var MIN_DIFF = 3;       // これ未満の差は結論にしない

  function mean(a) {
    if (!a.length) return 0;
    var t = 0;
    for (var i = 0; i < a.length; i++) t += a[i];
    return t / a.length;
  }

  function splitCompare(days, predicate, metric) {
    var hit = [], miss = [];
    days.forEach(function (d) {
      var p = predicate(d);
      if (p === null) return;
      (p ? hit : miss).push(metric(d));
    });
    if (hit.length < MIN_GROUP || miss.length < MIN_GROUP) return null;
    return { diff: mean(hit) - mean(miss), n: hit.length, total: hit.length + miss.length };
  }

  function insights() {
    var st = S.get();
    var keys = S.recordedKeys();
    if (keys.length < MIN_DAYS) {
      return { ready: false, have: keys.length, need: MIN_DAYS, items: [] };
    }

    var days = keys.map(function (k) {
      var d = st.days[k];
      var prev = st.days[S.shiftKey(k, -1)];
      var counts = {}, lastMin = 0;
      (d.events || []).forEach(function (e) {
        counts[e.type] = (counts[e.type] || 0) + (e.type === 'drink' ? (e.qty || 1) : 1);
      });
      var prevCounts = {};
      if (prev) {
        (prev.events || []).forEach(function (e) {
          prevCounts[e.type] = (prevCounts[e.type] || 0) + (e.type === 'drink' ? (e.qty || 1) : 1);
          lastMin = Math.max(lastMin, S.sortMinutes(e.time));
        });
      }
      return {
        key: k, d: d, prev: prev, counts: counts, prevCounts: prevCounts,
        prevLastMin: lastMin, hasPrev: !!prev,
        score: dayScore(d.status, d)
      };
    });

    var defs = [
      {
        id: 'sleep-focus', icon: 'sleep', color: 'focus',
        cond: '睡眠7時間以上の日は', metric: 'FOCUS',
        predicate: function (x) { return x.d.input ? x.d.input.sleep >= 7 : null; },
        value: function (x) { return x.d.status.focus; }
      },
      {
        id: 'drink-energy', icon: 'drink', color: 'energy',
        cond: '前日に飲酒した翌日は', metric: 'ENERGY',
        predicate: function (x) { return x.hasPrev ? (x.prevCounts.drink || 0) > 0 : null; },
        value: function (x) { return x.d.status.energy; }
      },
      {
        id: 'exercise-mood', icon: 'exercise', color: 'mood',
        cond: '運動した日は', metric: 'MOOD',
        predicate: function (x) { return (x.counts.exercise || 0) > 0; },
        value: function (x) { return x.d.status.mood; }
      },
      {
        id: 'late-energy', icon: 'moon', color: 'energy',
        cond: '前夜に1時を過ぎた翌日は', metric: 'ENERGY',
        predicate: function (x) { return x.hasPrev && x.prevLastMin ? x.prevLastMin >= 1500 : null; },
        value: function (x) { return x.d.status.energy; }
      },
      {
        id: 'sleep-score', icon: 'sleep', color: 'score',
        cond: '睡眠6時間未満の日は', metric: 'DAY SCORE',
        predicate: function (x) { return x.d.input ? x.d.input.sleep < 6 : null; },
        value: function (x) { return x.score; }
      },
      {
        id: 'meet-mood', icon: 'meet', color: 'social',
        cond: '人と会った日は', metric: 'MOOD',
        predicate: function (x) { return (x.counts.meet || 0) > 0; },
        value: function (x) { return x.d.status.mood; }
      }
    ];

    var items = [];
    defs.forEach(function (def) {
      var r = splitCompare(days, def.predicate, def.value);
      if (!r) return;
      if (Math.abs(r.diff) < MIN_DIFF) return;
      items.push({
        id: def.id, icon: def.icon, color: def.color,
        cond: def.cond, metric: def.metric,
        diff: Math.round(r.diff), n: r.n, total: r.total
      });
    });

    items.sort(function (a, b) { return Math.abs(b.diff) - Math.abs(a.diff); });
    return { ready: true, have: keys.length, need: MIN_DAYS, items: items.slice(0, 4) };
  }

  /* ---------------- 履歴（チャート用の系列） ---------------- */

  function series(nDays) {
    var st = S.get();
    var keys = S.keyRange(S.today(), nDays);
    return keys.map(function (k) {
      var d = st.days[k];
      var s = d && d.status;
      return {
        key: k,
        status: s || null,
        score: s ? dayScore(s, d) : null
      };
    });
  }

  function averages(rows) {
    var acc = { energy: [], focus: [], mood: [], body: [], social: [], score: [] };
    rows.forEach(function (r) {
      if (!r.status) return;
      PARAMS.forEach(function (p) { acc[p.id].push(r.status[p.id]); });
      if (r.score != null) acc.score.push(r.score);
    });
    var out = {};
    Object.keys(acc).forEach(function (k) {
      out[k] = acc[k].length ? Math.round(mean(acc[k])) : null;
    });
    out.n = acc.energy.length;
    return out;
  }

  /* ---------------- 状態の再計算（ログを足したら状態も動く） ---------------- */

  function recompute(k) {
    var d = S.day(k);
    if (!d || !d.input) return null;
    d.status = computeStatus(d.input, contextFor(k));
    var doneMap = {};
    (d.missions || []).forEach(function (m) { doneMap[m.id] = m.done; });
    d.missions = buildMissions(d.status, contextFor(k), d.input).map(function (m) {
      m.done = !!doneMap[m.id];
      return m;
    });
    if (d.report) d.report = buildReport(d);
    S.save();
    return d.status;
  }

  function submitInput(k, input) {
    var d = S.day(k, true);
    d.input = input;
    d.inputAt = new Date().toISOString();
    var ctx = contextFor(k);
    d.status = computeStatus(input, ctx);
    d.missions = buildMissions(d.status, ctx, input);
    S.save();
    return d;
  }

  /* ---------------- デモデータ ---------------- */

  /* 明示的に選んだときだけ入る。既定では1件も入れない。 */
  function seedDemo(nDays) {
    nDays = nDays || 45;
    var st = S.get();
    var seed = 20260815;
    function rnd() {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    }
    function pick(lo, hi) { return lo + Math.round(rnd() * (hi - lo)); }

    var todayKey = S.today();
    var sleepBase = 7;

    for (var i = nDays - 1; i >= 0; i--) {
      var k = S.shiftKey(todayKey, -i);
      var dow = S.parseKey(k).getDay();
      var weekend = (dow === 0 || dow === 6);

      // 睡眠はゆるやかに揺れる。週末は少し長い
      sleepBase = clamp(sleepBase + (rnd() - 0.5) * 1.6, 4.5, 9);
      var sleep = Math.round((sleepBase + (weekend ? 0.7 : 0)) * 2) / 2;

      var input = {
        sleep: sleep,
        condition: clamp(pick(2, 5) - (sleep < 6 ? 1 : 0), 1, 5),
        sharpness: clamp(pick(2, 5) - (sleep < 6 ? 1 : 0), 1, 5),
        social: weekend ? pick(2, 5) : pick(1, 4),
        stress: weekend ? pick(1, 3) : pick(2, 5)
      };

      var d = S.emptyDay(k);
      d.startedAt = S.pad(pick(6, 8)) + ':' + S.pad(pick(0, 59));
      d.input = input;
      d.inputAt = k + 'T08:00:00';

      // 出来事
      var events = [];
      function add(type, h, m, extra) {
        var e = { id: 'demo-' + k + '-' + type + '-' + events.length, type: type, time: S.pad(h) + ':' + S.pad(m), note: '' };
        if (extra) for (var p in extra) e[p] = extra[p];
        events.push(e);
      }
      if (!weekend) {
        add('work', pick(8, 9), pick(0, 59));
        add('meal', 12, pick(0, 45));
        if (rnd() < 0.55) add('work', pick(14, 16), pick(0, 59));
      } else {
        add('outing', pick(10, 14), pick(0, 59));
      }
      if (rnd() < (weekend ? 0.5 : 0.3)) add('exercise', weekend ? pick(9, 11) : pick(18, 20), pick(0, 59));
      if (rnd() < 0.15) add('sauna', pick(15, 20), pick(0, 59));
      if (rnd() < (weekend ? 0.45 : 0.2)) {
        var qty = pick(1, 4);
        add('drink', pick(19, 22), pick(0, 59), { qty: qty });
        if (qty >= 3 && rnd() < 0.6) add('other', pick(0, 2), pick(0, 59), { note: '寝つけず' });
      }
      if (rnd() < 0.25) add('meet', pick(12, 19), pick(0, 59));
      add('meal', pick(19, 21), pick(0, 59));

      events.sort(function (a, b) { return S.sortMinutes(a.time) - S.sortMinutes(b.time); });
      d.events = events;
      st.days[k] = d;
    }

    // ここまで作った日を、前日文脈込みで再計算する
    for (var j = nDays - 1; j >= 0; j--) {
      var kk = S.shiftKey(todayKey, -j);
      var dd = st.days[kk];
      var ctx = contextFor(kk);
      dd.status = computeStatus(dd.input, ctx);
      dd.missions = buildMissions(dd.status, ctx, dd.input);
      if (j > 0) dd.report = buildReport(dd);
    }

    st.settings.demo = true;
    S.saveNow();
  }

  function clearDemo() {
    var st = S.get();
    Object.keys(st.days).forEach(function (k) {
      var d = st.days[k];
      var isDemo = (d.events || []).some(function (e) { return String(e.id).indexOf('demo-') === 0; });
      if (isDemo) delete st.days[k];
    });
    st.settings.demo = false;
    S.saveNow();
  }

  global.LifeEngine = {
    PARAMS: PARAMS,
    EVENT_TYPES: EVENT_TYPES,
    eventType: eventType,
    QUESTIONS: QUESTIONS,
    sleepScore: sleepScore,
    contextFor: contextFor,
    computeStatus: computeStatus,
    buildMissions: buildMissions,
    nextAction: nextAction,
    gradeOf: gradeOf,
    dayScore: dayScore,
    buildReport: buildReport,
    insights: insights,
    series: series,
    averages: averages,
    recompute: recompute,
    submitInput: submitInput,
    seedDemo: seedDemo,
    clearDemo: clearDemo,
    MIN_DAYS: MIN_DAYS
  };
})(window);
