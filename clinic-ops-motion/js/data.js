/* ================================================================
   data — 架空のサンプルクリニック(整形外科+リハビリテーション科の外来)
   数値はすべて架空。待ち時間・稼働率・来院数は、この一日の簡単な模擬から計算する
   (同じ数字が場面をまたいで食い違わないように)。
   ================================================================ */
(function (root) {
  'use strict';
  const F = root.FILM;
  const { rng } = F.M;

  const T0 = 8.5 * 60, T1 = 18.5 * 60;          // 時間軸 08:30–18:30(分)
  const NOW = 14 * 60 + 20;                      // 映像の「いま」14:20
  const SESS = [[540, 750], [900, 1110]];        // 診察 9:00–12:30 / 15:00–18:30
  const REHAB = [[540, 750], [810, 1110]];       // リハ室 9:00–12:30 / 13:30–18:30
  const LANES = [
    { id: 'rec', jp: '受付', cap: 3 },
    { id: 'c1', jp: '診察1', cap: 1 },
    { id: 'c2', jp: '診察2', cap: 1 },
    { id: 'xr', jp: 'X線', cap: 1 },
    { id: 'rh', jp: 'リハ室', cap: 5 },
    { id: 'pay', jp: '会計', cap: 2 },
  ];
  const LANE = Object.fromEntries(LANES.map((l, i) => [l.id, i]));

  const startIn = (t, spans) => {
    for (const [a, b] of spans) { if (t < a) return a; if (t < b) return t; }
    return t;
  };
  const gauss = r => (r() + r() + r() + r() - 2) / 0.58;

  /* 来院の予定を作る */
  function arrivals() {
    const r = rng(20261022), P = [];
    const add = (t, kind) => P.push({ arr: Math.round(t), kind, newPt: kind === 'consult' && r() < 0.11, xray: kind === 'consult' && r() < 0.22, rehab: kind === 'rehabOnly' || (kind === 'consult' && r() < 0.36), units: r() < 0.6 ? 1 : 2 });
    for (let i = 0; i < 68; i++) add(Math.min(705, Math.max(518, 592 + gauss(r) * 44)), 'consult');   // 午前: 9:50 前後に集中
    for (let i = 0; i < 50; i++) add(Math.min(1065, Math.max(885, 975 + gauss(r) * 44)), 'consult');  // 午後
    const ro = [550, 562, 585, 600, 628, 648, 671, 690, 702, 718, 815, 832, 851, 873, 905, 924, 945, 968, 984, 1002, 1015, 1030, 1041, 1052, 1063, 1074, 1080, 1088];
    for (const t of ro) add(t + Math.round((r() - 0.5) * 6), 'rehabOnly');
    P.sort((a, b) => a.arr - b.arr);
    P.forEach((p, i) => (p.id = i));
    return P;
  }

  /* 一日の流れを順に割り当てる(先着順・空いた人に回す) */
  function simulate(P) {
    const r = rng(77), blocks = [];
    const free = { rec: [0, 0, 0], doc: [0, 0], xr: [0], pt: [0, 0, 0, 0, 0], pay: [0, 0] };
    const pick = arr => { let k = 0; for (let i = 1; i < arr.length; i++) if (arr[i] < arr[k]) k = i; return k; };
    const block = (p, lane, a, b, sub = 0) => { const bl = { p: p.id, lane, a, b, sub }; blocks.push(bl); (p.steps || (p.steps = [])).push(bl); return bl; };

    for (const p of P) {                                         // 受付
      const k = pick(free.rec), a = Math.max(p.arr, free.rec[k]), b = a + 2 + Math.round(r() * 2);
      free.rec[k] = b; block(p, LANE.rec, a, b, k); p.recEnd = b;
    }
    for (const p of [...P].filter(p => p.kind === 'consult').sort((x, y) => x.recEnd - y.recEnd)) {   // 診察
      const k = pick(free.doc), a = startIn(Math.max(p.recEnd, free.doc[k]), SESS);
      const b = a + (p.newPt ? 8 + Math.round(r() * 4) : 2 + Math.round(r() * 3));
      free.doc[k] = b; block(p, k === 0 ? LANE.c1 : LANE.c2, a, b); p.wait = a - p.recEnd; p.consultAt = a; p.last = b;
    }
    for (const p of [...P].filter(p => p.xray).sort((x, y) => x.last - y.last)) {                     // X線
      const a = Math.max(p.last + 2, free.xr[0]), b = a + 5 + Math.round(r() * 2);
      free.xr[0] = b; block(p, LANE.xr, a, b); p.last = b;
    }
    for (const p of P) if (p.kind === 'rehabOnly') p.last = p.recEnd;
    for (const p of [...P].filter(p => p.rehab).sort((x, y) => x.last - y.last)) {                    // リハ
      const k = pick(free.pt), a = startIn(Math.max(p.last + 3, free.pt[k]), REHAB), b = a + p.units * 20;
      free.pt[k] = b; block(p, LANE.rh, a, b, k); p.last = b;
    }
    for (const p of [...P].sort((x, y) => x.last - y.last)) {                                          // 会計
      const k = pick(free.pay), a = Math.max(p.last + 1 + Math.round(r() * 3), free.pay[k]), b = a + 2 + Math.round(r() * 2);
      free.pay[k] = b; block(p, LANE.pay, a, b, k); p.last = b; p.out = b;
    }
    for (const p of P) p.steps.sort((x, y) => x.a - y.a);
    return blocks;
  }

  /* 待ち時間(受付から診察まで)の 15 分ごとの平均。午前と午後で線を分ける */
  function waitCurve(P) {
    const bins = [];
    for (let t = T0; t < T1; t += 15) {
      const ps = P.filter(p => p.wait != null && p.recEnd >= t && p.recEnd < t + 15);
      bins.push({ t: t + 7.5, w: ps.length ? ps.reduce((s, p) => s + p.wait, 0) / ps.length : null });
    }
    for (let i = 0; i < bins.length; i++) {                      // 隣と均す(読みやすさのため)
      if (bins[i].w == null) continue;
      const nb = [bins[i - 1], bins[i], bins[i + 1]].filter(b => b && b.w != null);
      bins[i].s = nb.reduce((s, b) => s + b.w, 0) / nb.length;
    }
    return bins;
  }
  function hourAvg(P, h) {
    const ps = P.filter(p => p.wait != null && p.recEnd >= h * 60 && p.recEnd < h * 60 + 60);
    return ps.length ? ps.reduce((s, p) => s + p.wait, 0) / ps.length : 0;
  }
  /* 部屋の使用率。lane の a..b 分の窓で、能力(人数×分)に対する使用分 */
  function util(blocks, lane, a, b) {
    const cap = LANES[lane].cap * (b - a);
    let busy = 0;
    for (const bl of blocks) if (bl.lane === lane) busy += Math.max(0, Math.min(b, bl.b) - Math.max(a, bl.a));
    return busy / cap;
  }

  const P = arrivals();
  const blocks = simulate(P);
  const curve = waitCurve(P);

  /* 30 分ごとの熱の表(レーン × 時間) */
  const heat = [];
  for (let l = 0; l < LANES.length; l++) {
    const row = [];
    for (let t = T0; t < T1; t += 30) row.push(util(blocks, l, t, t + 30));
    heat.push(row);
  }

  /* 営業時間の中だけで数える使用分 */
  const openMin = (spans, to) => spans.reduce((s, [a, b]) => s + Math.max(0, Math.min(b, to) - a), 0);
  const busyIn = (lane, spans, to) => blocks.filter(b => b.lane === lane).reduce((s, b) =>
    s + spans.reduce((u, [x, y]) => u + Math.max(0, Math.min(b.b, y, to) - Math.max(b.a, x)), 0), 0);
  const DAYSPAN = [[T0, T1]];
  const load = {
    doctor: (busyIn(LANE.c1, SESS, NOW) + busyIn(LANE.c2, SESS, NOW)) / (openMin(SESS, NOW) * 2),
    pt: busyIn(LANE.rh, REHAB, NOW) / (openMin(REHAB, NOW) * LANES[LANE.rh].cap),
    front: (busyIn(LANE.rec, DAYSPAN, NOW) + busyIn(LANE.pay, DAYSPAN, NOW)) / (openMin(DAYSPAN, NOW) * 3),
  };
  const waited = P.filter(p => p.consultAt != null && p.consultAt <= NOW);
  const occDay = (busyIn(LANE.c1, SESS, T1) + busyIn(LANE.c2, SESS, T1) + busyIn(LANE.rh, REHAB, T1)) /
    (openMin(SESS, T1) * 2 + openMin(REHAB, T1) * LANES[LANE.rh].cap);

  /* 映像の時計は 14:20 から次の来院まで進む。次に入れられるリハの枠は、その時刻より後で
     20 分空く理学療法士がいる最初の 10 分刻み(時計と枠が食い違わないように) */
  const NEXT = P.find(p => p.arr > NOW).arr;
  let nextSlot = null;
  for (let m = Math.ceil((NEXT + 1) / 10) * 10; m < 1110 && nextSlot == null; m += 10) {
    if (startIn(m, REHAB) !== m) continue;
    const busy = blocks.filter(b => b.lane === LANE.rh && b.a < m + 20 && b.b > m).length;
    if (busy < LANES[LANE.rh].cap) nextSlot = m;
  }

  const stats = {
    total: P.length,                                              // 本日の予定(人)
    arrived: P.filter(p => p.arr <= NOW).length,                  // 14:20 までの来院
    waitAvg: Math.round(waited.reduce((s, p) => s + p.wait, 0) / waited.length),
    peak: Math.round(hourAvg(P, 10)),                             // 10 時台の平均待ち
    rehabGap: Math.round(util(blocks, LANE.rh, 840, 930) * 100),   // リハ室 14:00–15:30
    occ: Math.round(occDay * 100),                                // 診察室とリハ室の一日の稼働(予定を含む)
    load,
    nextSlot,
    unitPrice: 5860,                                              // 架空の値(模擬では計算しない)
  };

  /* 来週の予約(月〜土)と、先の週の混み具合の見込み。どちらも架空 */
  const week = [
    { d: '月', booked: 147, cap: 150 }, { d: '火', booked: 121, cap: 150 }, { d: '水', booked: 108, cap: 150 },
    { d: '木', booked: 129, cap: 150 }, { d: '金', booked: 138, cap: 150 }, { d: '土', booked: 88, cap: 90 },
  ];
  const forecast = (week_, dow) => {                             // 週と曜日だけで決まる(描くたびに変わらない)
    if (dow === 6) return 0;                                     // 日曜は休診
    const base = [0.93, 0.8, 0.72, 0.84, 0.88, 0.95][dow];
    return Math.min(1, Math.max(0.35, base + (F.M.hash(week_ * 8 + dow, 4242) - 0.5) * 0.16 - week_ * 0.004));
  };

  F.D = { T0, T1, NOW, NEXT, SESS, REHAB, LANES, LANE, P, blocks, curve, heat, stats, week, forecast };
})(window);
