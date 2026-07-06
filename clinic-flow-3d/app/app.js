/* クリニックフロー3D — 外来導線シミュレーター
 * アイソメトリック描画(canvas 2D)+ 患者エージェント + A*経路探索。
 * 1リアル秒 = 1シミュレーション分(×1速時)。
 */

'use strict';

(function () {

  /* ================= フロアプラン ================= */

  const W = 16, H = 13;          // グリッド(タイル)
  const CORRIDOR_Y = 5;          // メイン廊下
  const DOOR = { x: 7, y: 12 };  // 入口/出口

  const ZONES = [
    { key: 'exam1', label: '診察室1', x0: 1, y0: 0, x1: 4, y1: 3, tint: '#DCEDF6' },
    { key: 'exam2', label: '診察室2', x0: 6, y0: 0, x1: 9, y1: 3, tint: '#DCEDF6' },
    { key: 'treat', label: '処置室', x0: 11, y0: 0, x1: 14, y1: 3, tint: '#FAE7E5' },
    { key: 'reha', label: 'リハ室', x0: 11, y0: 6, x1: 14, y1: 8, tint: '#DFF2EA' },
    { key: 'wait', label: '待合', x0: 0, y0: 7, x1: 5, y1: 10, tint: '#FBF0DC' },
    { key: 'recep', label: '受付', x0: 6, y0: 7, x1: 9, y1: 9, tint: '#EAF1F6' },
    { key: 'cash', label: '会計', x0: 11, y0: 10, x1: 14, y1: 12, tint: '#EDEAF6' }
  ];

  // 家具: x,y=タイル, w,d=タイル数, h=高さ(タイル比), 塗り
  const FURNITURE = [
    { x: 2, y: 2, w: 2, d: 1, h: 0.55, c: '#C9A272', block: true },   // 診1デスク
    { x: 7, y: 2, w: 2, d: 1, h: 0.55, c: '#C9A272', block: true },   // 診2デスク
    { x: 12, y: 1, w: 1, d: 1, h: 0.45, c: '#F2F6F8', block: true },  // 処置ベッド1
    { x: 14, y: 1, w: 1, d: 1, h: 0.45, c: '#F2F6F8', block: true },  // 処置ベッド2
    { x: 11, y: 6, w: 1, d: 1, h: 0.5, c: '#7FB8A2', block: true },   // リハ機器
    { x: 13, y: 6, w: 1, d: 1, h: 0.5, c: '#7FB8A2', block: true },
    { x: 11, y: 8, w: 1, d: 1, h: 0.5, c: '#7FB8A2', block: true },
    { x: 6, y: 8, w: 4, d: 1, h: 0.7, c: '#6E9CBE', block: true },    // 受付カウンター
    { x: 12, y: 11, w: 2, d: 1, h: 0.7, c: '#9C8FCB', block: true },  // 会計カウンター
    // 待合の椅子(座る対象なので block しない)
    { x: 1, y: 8, w: 1, d: 1, h: 0.32, c: '#E4B968', chair: true },
    { x: 2, y: 8, w: 1, d: 1, h: 0.32, c: '#E4B968', chair: true },
    { x: 3, y: 8, w: 1, d: 1, h: 0.32, c: '#E4B968', chair: true },
    { x: 4, y: 8, w: 1, d: 1, h: 0.32, c: '#E4B968', chair: true },
    { x: 1, y: 10, w: 1, d: 1, h: 0.32, c: '#E4B968', chair: true },
    { x: 2, y: 10, w: 1, d: 1, h: 0.32, c: '#E4B968', chair: true },
    { x: 3, y: 10, w: 1, d: 1, h: 0.32, c: '#E4B968', chair: true },
    { x: 4, y: 10, w: 1, d: 1, h: 0.32, c: '#E4B968', chair: true }
  ];

  const SEATS = FURNITURE.filter((f) => f.chair).map((f) => ({ x: f.x, y: f.y }));
  const STAND_SPOTS = [{ x: 5, y: 8 }, { x: 5, y: 9 }, { x: 5, y: 10 }, { x: 0, y: 9 }, { x: 5, y: 7 }, { x: 0, y: 7 }];

  const SPOTS = {
    recepService: { x: 7, y: 9 },
    recepQueue: [{ x: 8, y: 9 }, { x: 9, y: 10 }, { x: 8, y: 10 }, { x: 8, y: 11 }, { x: 7, y: 11 }, { x: 6, y: 11 }],
    examPatient: [{ x: 3, y: 3 }, { x: 8, y: 3 }],
    examDoctor: [{ x: 2.5, y: 1.3 }, { x: 7.5, y: 1.3 }],
    treatSpots: [{ x: 12, y: 2 }, { x: 14, y: 2 }],
    rehaSpots: [{ x: 12, y: 6 }, { x: 14, y: 6 }, { x: 12, y: 8 }],
    cashService: { x: 12, y: 12 },
    cashQueue: [{ x: 13, y: 12 }, { x: 14, y: 12 }, { x: 14, y: 10 }, { x: 15, y: 10 }],
    recepStaff: { x: 7.5, y: 7.45 },
    cashStaff: { x: 12.5, y: 10.45 }
  };

  const BLOCKED = new Set();
  FURNITURE.forEach((f) => {
    if (!f.block) return;
    for (let dx = 0; dx < f.w; dx++) for (let dy = 0; dy < f.d; dy++) BLOCKED.add(`${f.x + dx},${f.y + dy}`);
  });

  /* ================= A* 経路探索 ================= */

  function astar(from, to) {
    const sx = Math.round(from.x), sy = Math.round(from.y);
    const tx = Math.round(to.x), ty = Math.round(to.y);
    if (sx === tx && sy === ty) return [{ x: tx, y: ty }];
    const key = (x, y) => x + y * W;
    const open = [{ x: sx, y: sy, g: 0, f: 0 }];
    const came = new Map();
    const gScore = new Map([[key(sx, sy), 0]]);
    const closed = new Set();
    while (open.length) {
      let bi = 0;
      for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
      const cur = open.splice(bi, 1)[0];
      const ck = key(cur.x, cur.y);
      if (cur.x === tx && cur.y === ty) {
        const path = [{ x: tx, y: ty }];
        let k = ck;
        while (came.has(k)) { k = came.get(k); path.unshift({ x: k % W, y: Math.floor(k / W) }); }
        path.shift(); // 現在地は含めない
        return path;
      }
      closed.add(ck);
      const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of dirs) {
        const nx = cur.x + dx, ny = cur.y + dy;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const nk = key(nx, ny);
        if (closed.has(nk)) continue;
        if (BLOCKED.has(`${nx},${ny}`) && !(nx === tx && ny === ty)) continue;
        const g = gScore.get(ck) + 1;
        if (g < (gScore.get(nk) ?? Infinity)) {
          gScore.set(nk, g);
          came.set(nk, ck);
          const f = g + Math.abs(nx - tx) + Math.abs(ny - ty);
          const ex = open.find((o) => o.x === nx && o.y === ny);
          if (ex) { ex.g = g; ex.f = f; } else { open.push({ x: nx, y: ny, g, f }); }
        }
      }
    }
    return [{ x: tx, y: ty }]; // 到達不能時は直行(保険)
  }

  /* ================= シミュレーション ================= */

  const params = { arrivalPerHour: 12, examMean: 6, docs: 1, pTreat: 0.2, pReha: 0.3 };
  let speed = 1;
  let showHeat = false, showLines = false;

  const rand = Math.random;
  function tri(lo, hi) { return lo + (rand() + rand()) / 2 * (hi - lo); } // 中央寄り乱数

  const PHASE_COLORS = {
    walk: '#9AA7B0', recepQ: '#C98A2D', recep: '#C98A2D',
    waitExam: '#3E7CA6', exam: '#2C5F82',
    treat: '#C4574E', waitTreat: '#3E7CA6',
    reha: '#4FA98C', waitReha: '#3E7CA6',
    cashQ: '#C98A2D', cash: '#8C7BC4'
  };

  let sim;

  function newSim() {
    return {
      t: 0,                       // シミュレーション分(9:00起点)
      nextArrival: tri(0.5, 3),
      patients: [],
      idSeq: 1,
      recQueue: [], examQueue: [], treatQueue: [], rehaQueue: [], cashQueue: [],
      recBusy: null, cashBusy: null,
      doctors: [{ patient: null }, { patient: null }],
      treatUsed: [null, null], rehaUsed: [null, null, null],
      seatUsed: SEATS.map(() => null), standUsed: STAND_SPOTS.map(() => null),
      heat: new Float32Array(W * H),
      stats: { arrived: 0, done: 0, waitSum: 0, waitN: 0, staySum: 0, stayN: 0 }
    };
  }

  function spawnPatient() {
    const p = {
      id: sim.idSeq++,
      x: DOOR.x, y: DOOR.y,
      path: [], onArrive: null,
      phase: 'walk',
      arrivedAt: sim.t, recepDoneAt: 0, examStartAt: 0,
      busyUntil: 0, seat: -1, stand: -1, slot: -1,
      hue: rand()
    };
    sim.patients.push(p);
    sim.stats.arrived++;
    sim.recQueue.push(p);
    p.phase = 'recepQ';
    sendToQueueSlot(p, sim.recQueue, SPOTS.recepQueue, SPOTS.recepService);
  }

  function walkTo(p, spot, onArrive) {
    p.path = astar(p, spot);
    p.tx = spot.x; p.ty = spot.y;
    p.onArrive = onArrive || null;
  }

  // 行列 idx=0 はサービス地点、以降は待機スロットへ
  function sendToQueueSlot(p, queue, slots, serviceSpot) {
    const idx = queue.indexOf(p);
    const spot = idx === 0 ? serviceSpot : slots[Math.min(idx - 1, slots.length - 1)];
    if (Math.round(p.x) !== spot.x || Math.round(p.y) !== spot.y || p.path.length) walkTo(p, spot);
  }

  function freeSeat(p) {
    if (p.seat >= 0) { sim.seatUsed[p.seat] = null; p.seat = -1; }
    if (p.stand >= 0) { sim.standUsed[p.stand] = null; p.stand = -1; }
  }

  function seatInWaiting(p, phase) {
    p.phase = phase;
    const si = sim.seatUsed.findIndex((v) => !v);
    if (si >= 0) { sim.seatUsed[si] = p; p.seat = si; walkTo(p, SEATS[si]); return; }
    const st = sim.standUsed.findIndex((v) => !v);
    if (st >= 0) { sim.standUsed[st] = p; p.stand = st; walkTo(p, STAND_SPOTS[st]); return; }
    walkTo(p, { x: 0, y: 11 }); // 満杯: 隅で立つ
  }

  function afterExamBranch(p) {
    const r = rand();
    if (r < params.pTreat) {
      sim.treatQueue.push(p);
      seatInWaiting(p, 'waitTreat');
    } else if (r < params.pTreat + params.pReha) {
      sim.rehaQueue.push(p);
      seatInWaiting(p, 'waitReha');
    } else {
      toCashier(p);
    }
  }

  function toCashier(p) {
    p.phase = 'cashQ';
    sim.cashQueue.push(p);
    sendToQueueSlot(p, sim.cashQueue, SPOTS.cashQueue, SPOTS.cashService);
  }

  function atSpot(p, spot) {
    return !p.path.length && Math.abs(p.x - spot.x) < 0.15 && Math.abs(p.y - spot.y) < 0.15;
  }

  function tick(dt) {
    sim.t += dt;

    // 来院
    sim.nextArrival -= dt;
    if (sim.nextArrival <= 0 && sim.patients.length < 60) {
      spawnPatient();
      sim.nextArrival = -Math.log(1 - rand()) * (60 / params.arrivalPerHour);
    }

    // 移動
    const walkSpeed = 3.4; // タイル/分
    for (const p of sim.patients) {
      if (p.path.length) {
        const wp = p.path[0];
        const dx = wp.x - p.x, dy = wp.y - p.y;
        const dist = Math.hypot(dx, dy);
        const step = walkSpeed * dt;
        if (dist <= step) {
          p.x = wp.x; p.y = wp.y;
          p.path.shift();
          if (!p.path.length && p.onArrive) { const f = p.onArrive; p.onArrive = null; f(p); }
        } else {
          p.x += dx / dist * step;
          p.y += dy / dist * step;
        }
      }
      // 導線ヒート(移動中は濃く、滞在は薄く)
      const hx = Math.round(p.x), hy = Math.round(p.y);
      if (hx >= 0 && hy >= 0 && hx < W && hy < H) sim.heat[hx + hy * W] += (p.path.length ? 1 : 0.12) * dt;
    }

    // 受付
    if (!sim.recBusy && sim.recQueue.length) {
      const p = sim.recQueue[0];
      if (atSpot(p, SPOTS.recepService)) {
        sim.recBusy = p;
        p.phase = 'recep';
        p.busyUntil = sim.t + tri(0.6, 1.8);
      }
    }
    if (sim.recBusy && sim.t >= sim.recBusy.busyUntil) {
      const p = sim.recBusy;
      sim.recBusy = null;
      sim.recQueue.shift();
      sim.recQueue.forEach((q) => sendToQueueSlot(q, sim.recQueue, SPOTS.recepQueue, SPOTS.recepService));
      p.recepDoneAt = sim.t;
      sim.examQueue.push(p);
      seatInWaiting(p, 'waitExam');
    }

    // 診察(1診/2診)
    for (let d = 0; d < 2; d++) {
      const doc = sim.doctors[d];
      if (doc.patient && sim.t >= doc.patient.busyUntil) {
        const p = doc.patient;
        doc.patient = null;
        afterExamBranch(p);
      }
      if (d < params.docs && !doc.patient) {
        const idx = sim.examQueue.findIndex((q) => q.phase === 'waitExam');
        if (idx >= 0) {
          const p = sim.examQueue.splice(idx, 1)[0];
          doc.patient = p;
          freeSeat(p);
          p.phase = 'exam';
          p.busyUntil = Infinity; // 到着してから計測開始
          walkTo(p, SPOTS.examPatient[d], (pp) => {
            pp.examStartAt = sim.t;
            sim.stats.waitSum += sim.t - pp.recepDoneAt;
            sim.stats.waitN++;
            pp.busyUntil = sim.t + Math.max(2, tri(params.examMean * 0.5, params.examMean * 1.6));
          });
        }
      }
    }

    // 処置
    for (let i = 0; i < SPOTS.treatSpots.length; i++) {
      const cur = sim.treatUsed[i];
      if (cur && sim.t >= cur.busyUntil) { sim.treatUsed[i] = null; toCashier(cur); }
      if (!sim.treatUsed[i]) {
        const idx = sim.treatQueue.findIndex((q) => q.phase === 'waitTreat');
        if (idx >= 0) {
          const p = sim.treatQueue.splice(idx, 1)[0];
          sim.treatUsed[i] = p;
          freeSeat(p);
          p.phase = 'treat';
          p.busyUntil = Infinity;
          walkTo(p, SPOTS.treatSpots[i], (pp) => { pp.busyUntil = sim.t + tri(4, 10); });
        }
      }
    }

    // リハ
    for (let i = 0; i < SPOTS.rehaSpots.length; i++) {
      const cur = sim.rehaUsed[i];
      if (cur && sim.t >= cur.busyUntil) { sim.rehaUsed[i] = null; toCashier(cur); }
      if (!sim.rehaUsed[i]) {
        const idx = sim.rehaQueue.findIndex((q) => q.phase === 'waitReha');
        if (idx >= 0) {
          const p = sim.rehaQueue.splice(idx, 1)[0];
          sim.rehaUsed[i] = p;
          freeSeat(p);
          p.phase = 'reha';
          p.busyUntil = Infinity;
          walkTo(p, SPOTS.rehaSpots[i], (pp) => { pp.busyUntil = sim.t + tri(10, 20); });
        }
      }
    }

    // 会計
    if (!sim.cashBusy && sim.cashQueue.length) {
      const p = sim.cashQueue[0];
      if (atSpot(p, SPOTS.cashService)) {
        sim.cashBusy = p;
        p.phase = 'cash';
        p.busyUntil = sim.t + tri(0.5, 1.4);
      }
    }
    if (sim.cashBusy && sim.t >= sim.cashBusy.busyUntil) {
      const p = sim.cashBusy;
      sim.cashBusy = null;
      sim.cashQueue.shift();
      sim.cashQueue.forEach((q) => sendToQueueSlot(q, sim.cashQueue, SPOTS.cashQueue, SPOTS.cashService));
      p.phase = 'walk';
      walkTo(p, DOOR, (pp) => {
        sim.stats.done++;
        sim.stats.staySum += sim.t - pp.arrivedAt;
        sim.stats.stayN++;
        sim.patients.splice(sim.patients.indexOf(pp), 1);
      });
    }
  }

  /* ================= アイソメトリック描画 ================= */

  const canvas = document.getElementById('stage');
  const ctx = canvas.getContext('2d');
  let tw = 48, th = 24, ox = 0, oy = 0, dpr = 1;

  function resize() {
    const cw = canvas.parentElement.clientWidth;
    tw = Math.min(64, (cw - 24) * 2 / (W + H));
    th = tw / 2;
    const gh = (W + H) * th / 2 + tw * 1.6;
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.style.height = `${gh}px`;
    canvas.width = cw * dpr;
    canvas.height = gh * dpr;
    ox = cw / 2 + (H - W) * tw / 4;
    oy = tw * 0.9;
  }

  function iso(x, y, z) {
    return {
      x: ox + (x - y) * tw / 2,
      y: oy + (x + y) * th / 2 - (z || 0) * th * 1.15
    };
  }

  function diamond(x, y, z, fill, stroke) {
    const c = iso(x + 0.5, y + 0.5, z || 0);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - th / 2);
    ctx.lineTo(c.x + tw / 2, c.y);
    ctx.lineTo(c.x, c.y + th / 2);
    ctx.lineTo(c.x - tw / 2, c.y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * f), g = Math.round(((n >> 8) & 255) * f), b = Math.round((n & 255) * f);
    return `rgb(${Math.min(255, r)},${Math.min(255, g)},${Math.min(255, b)})`;
  }

  // 直方体(x,y から w×d タイル、高さ h)
  function box(x, y, w, d, h, color) {
    const pTop = [iso(x, y, h), iso(x + w, y, h), iso(x + w, y + d, h), iso(x, y + d, h)];
    const pBotR = [iso(x + w, y, 0), iso(x + w, y + d, 0)];
    const pBotL = [iso(x, y + d, 0), iso(x + w, y + d, 0)];
    // 右面
    ctx.fillStyle = shade(color, 0.78);
    ctx.beginPath();
    ctx.moveTo(pTop[1].x, pTop[1].y); ctx.lineTo(pTop[2].x, pTop[2].y);
    ctx.lineTo(pBotR[1].x, pBotR[1].y); ctx.lineTo(pBotR[0].x, pBotR[0].y);
    ctx.closePath(); ctx.fill();
    // 左面
    ctx.fillStyle = shade(color, 0.62);
    ctx.beginPath();
    ctx.moveTo(pTop[3].x, pTop[3].y); ctx.lineTo(pTop[2].x, pTop[2].y);
    ctx.lineTo(pBotL[1].x, pBotL[1].y); ctx.lineTo(pBotL[0].x, pBotL[0].y);
    ctx.closePath(); ctx.fill();
    // 天面
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(pTop[0].x, pTop[0].y); ctx.lineTo(pTop[1].x, pTop[1].y);
    ctx.lineTo(pTop[2].x, pTop[2].y); ctx.lineTo(pTop[3].x, pTop[3].y);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(34,51,61,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function figure(x, y, color, opts) {
    const o = opts || {};
    const bob = o.walking ? Math.sin(perf * 0.012 + x * 7 + y * 3) * th * 0.08 : 0;
    const c = iso(x + 0.5, y + 0.5, 0);
    const s = tw / 64; // スケール
    // 影
    ctx.fillStyle = 'rgba(34,51,61,0.16)';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, 9 * s, 4.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    const by = c.y - bob;
    // 体
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(c.x - 6 * s, by);
    ctx.quadraticCurveTo(c.x - 7 * s, by - 20 * s, c.x, by - 22 * s);
    ctx.quadraticCurveTo(c.x + 7 * s, by - 20 * s, c.x + 6 * s, by);
    ctx.closePath();
    ctx.fill();
    if (o.coat) { ctx.strokeStyle = 'rgba(62,124,166,0.5)'; ctx.lineWidth = 1.2; ctx.stroke(); }
    // 頭
    ctx.fillStyle = '#F2C9A0';
    ctx.beginPath();
    ctx.arc(c.x, by - 28 * s, 6 * s, 0, Math.PI * 2);
    ctx.fill();
    // 状態ドット
    if (o.dot) {
      ctx.fillStyle = o.dot;
      ctx.beginPath();
      ctx.arc(c.x, by - 40 * s, 3.2 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function zoneOf(x, y) {
    return ZONES.find((z) => x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1);
  }

  let perf = 0;

  function draw() {
    const cw = canvas.width / dpr, ch = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cw, ch);

    // 床
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const z = zoneOf(x, y);
        let fill = z ? z.tint : '#F7FAFC';
        if ((x === DOOR.x || x === DOOR.x + 1) && y === DOOR.y) fill = '#C9D8E2';
        if (y === CORRIDOR_Y || y === CORRIDOR_Y - 1) fill = '#F1F6F9';
        diamond(x, y, 0, fill, 'rgba(62,124,166,0.10)');
      }
    }

    // ヒートマップ
    if (showHeat) {
      let max = 1;
      for (let i = 0; i < sim.heat.length; i++) max = Math.max(max, sim.heat[i]);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const v = sim.heat[x + y * W];
          if (v <= 0.01) continue;
          const a = Math.min(0.72, Math.sqrt(v / max) * 0.8);
          diamond(x, y, 0, `rgba(214,69,48,${a.toFixed(3)})`);
        }
      }
    }

    // 導線ライン
    if (showLines) {
      for (const p of sim.patients) {
        if (!p.path.length) continue;
        ctx.strokeStyle = PHASE_COLORS[p.phase] || '#9AA7B0';
        ctx.globalAlpha = 0.55;
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 4]);
        ctx.beginPath();
        let pt = iso(p.x + 0.5, p.y + 0.5, 0);
        ctx.moveTo(pt.x, pt.y);
        for (const wp of p.path) { pt = iso(wp.x + 0.5, wp.y + 0.5, 0); ctx.lineTo(pt.x, pt.y); }
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }
    }

    // 深度ソートして家具・人物を描画
    const items = [];
    for (const f of FURNITURE) {
      items.push({ depth: f.x + f.w / 2 + f.y + f.d / 2, draw: () => box(f.x, f.y, f.w, f.d, f.h, f.c) });
    }
    // スタッフ
    items.push({ depth: SPOTS.recepStaff.x + SPOTS.recepStaff.y, draw: () => figure(SPOTS.recepStaff.x, SPOTS.recepStaff.y, '#FFFFFF', { coat: true, dot: sim.recBusy ? '#3E7CA6' : '#4FA98C' }) });
    items.push({ depth: SPOTS.cashStaff.x + SPOTS.cashStaff.y, draw: () => figure(SPOTS.cashStaff.x, SPOTS.cashStaff.y, '#FFFFFF', { coat: true, dot: sim.cashBusy ? '#3E7CA6' : '#4FA98C' }) });
    for (let d = 0; d < 2; d++) {
      if (d >= params.docs && !sim.doctors[d].patient) continue;
      const sp = SPOTS.examDoctor[d];
      items.push({ depth: sp.x + sp.y, draw: () => figure(sp.x, sp.y, '#FFFFFF', { coat: true, dot: sim.doctors[d].patient ? '#3E7CA6' : '#4FA98C' }) });
    }
    // 患者
    for (const p of sim.patients) {
      const color = PHASE_COLORS[p.phase] || '#9AA7B0';
      items.push({ depth: p.x + p.y + 0.01, draw: () => figure(p.x, p.y, color, { walking: p.path.length > 0 }) });
    }
    items.sort((a, b) => a.depth - b.depth);
    items.forEach((it) => it.draw());

    // ゾーンラベル
    ctx.font = `700 ${Math.max(10, tw * 0.19)}px 'Noto Sans JP', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const z of ZONES) {
      const c = iso((z.x0 + z.x1 + 1) / 2, (z.y0 + z.y1 + 1) / 2, 0);
      const label = z.label;
      const wpx = ctx.measureText(label).width + 14;
      ctx.fillStyle = 'rgba(255,255,255,0.86)';
      ctx.beginPath();
      ctx.roundRect(c.x - wpx / 2, c.y - 11, wpx, 22, 11);
      ctx.fill();
      ctx.fillStyle = '#2C5F82';
      ctx.fillText(label, c.x, c.y + 1);
    }
    // 入口ラベル
    const dc = iso(DOOR.x + 1, DOOR.y + 0.5, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.86)';
    const dw = ctx.measureText('入口/出口').width + 14;
    ctx.beginPath();
    ctx.roundRect(dc.x - dw / 2, dc.y - 11, dw, 22, 11);
    ctx.fill();
    ctx.fillStyle = '#2C5F82';
    ctx.fillText('入口/出口', dc.x, dc.y + 1);
  }

  /* ================= HUD / UI ================= */

  const $ = (id) => document.getElementById(id);

  function fmtClock(t) {
    const m = Math.floor(t) + 9 * 60;
    return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
  }

  function updateHUD() {
    $('clock').textContent = fmtClock(sim.t);
    $('inCount').textContent = sim.patients.length;
    $('kArrived').innerHTML = `${sim.stats.arrived}<small>人</small>`;
    $('kDone').innerHTML = `${sim.stats.done}<small>人</small>`;
    $('kWait').innerHTML = sim.stats.waitN ? `${(sim.stats.waitSum / sim.stats.waitN).toFixed(0)}<small>分</small>` : '–<small>分</small>';
    $('kStay').innerHTML = sim.stats.stayN ? `${(sim.stats.staySum / sim.stats.stayN).toFixed(0)}<small>分</small>` : '–<small>分</small>';

    const queues = [
      ['受付待ち', sim.recQueue.length],
      ['診察待ち', sim.examQueue.length],
      ['処置待ち', sim.treatQueue.length],
      ['リハ待ち', sim.rehaQueue.length],
      ['会計待ち', sim.cashQueue.length]
    ];
    queues.sort((a, b) => b[1] - a[1]);
    const [name, n] = queues[0];
    $('kBottleneck').textContent = n >= 3 ? `${name}(${n}人)` : 'なし 😌';
    $('kBottleneck').classList.toggle('hot', n >= 3);

    const standing = sim.standUsed.filter(Boolean).length;
    $('panic').hidden = standing === 0;
  }

  /* ================= メインループ ================= */

  let lastTs = 0;
  function loop(ts) {
    perf = ts;
    const dtReal = Math.min(0.1, (ts - lastTs) / 1000);
    lastTs = ts;
    if (speed > 0) {
      // 1リアル秒 = speed シミュ分。負荷平準化のため0.25分刻みで進める
      let dt = dtReal * speed;
      while (dt > 0) { const step = Math.min(0.25, dt); tick(step); dt -= step; }
    }
    draw();
    updateHUD();
    requestAnimationFrame(loop);
  }

  /* ================= バインド ================= */

  document.querySelectorAll('.speed-btn').forEach((b) => {
    b.addEventListener('click', () => {
      speed = Number(b.dataset.speed);
      document.querySelectorAll('.speed-btn').forEach((x) => x.classList.toggle('on', x === b));
    });
  });
  $('heatBtn').addEventListener('click', () => {
    showHeat = !showHeat;
    $('heatBtn').classList.toggle('on', showHeat);
  });
  $('lineBtn').addEventListener('click', () => {
    showLines = !showLines;
    $('lineBtn').classList.toggle('on', showLines);
  });

  $('arrival').addEventListener('input', (e) => {
    params.arrivalPerHour = Number(e.target.value);
    $('vArrival').textContent = `${params.arrivalPerHour}人/時`;
  });
  $('exam').addEventListener('input', (e) => {
    params.examMean = Number(e.target.value);
    $('vExam').textContent = `${params.examMean}分`;
  });
  $('treat').addEventListener('input', (e) => {
    params.pTreat = Number(e.target.value) / 100;
    $('vTreat').textContent = `${e.target.value}%`;
  });
  $('reha').addEventListener('input', (e) => {
    params.pReha = Number(e.target.value) / 100;
    $('vReha').textContent = `${e.target.value}%`;
  });
  document.querySelectorAll('.seg-btn[data-docs]').forEach((b) => {
    b.addEventListener('click', () => {
      params.docs = Number(b.dataset.docs);
      document.querySelectorAll('.seg-btn[data-docs]').forEach((x) => x.classList.toggle('on', x === b));
    });
  });
  $('resetBtn').addEventListener('click', () => { sim = newSim(); });

  window.addEventListener('resize', resize);

  /* ================= 起動 ================= */

  sim = newSim();
  resize();
  requestAnimationFrame((ts) => { lastTs = ts; requestAnimationFrame(loop); });
})();
