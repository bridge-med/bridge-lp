/* クリニックタウン3D — 院内シミュレーション
 * 患者エージェントが 受付→待合→診察→(処置/リハ)→会計 を巡回する。
 * スタッフ数・設備数は game.js の settings に連動して増減する。
 */

'use strict';

const CLINIC = (() => {
  const W = 20, H = 14;
  const DOOR = { x: 9, y: 13 };

  const ZONES = [
    { key: 'exam1', label: '診察室1', x0: 1, y0: 0, x1: 4, y1: 3, tint: '#DCEDF6', need: (s) => true },
    { key: 'exam2', label: '診察室2', x0: 6, y0: 0, x1: 9, y1: 3, tint: '#DCEDF6', need: (s) => s.doctors >= 2 },
    { key: 'exam3', label: '診察室3', x0: 11, y0: 0, x1: 14, y1: 3, tint: '#DCEDF6', need: (s) => s.doctors >= 3 },
    { key: 'treat', label: '処置室', x0: 16, y0: 0, x1: 19, y1: 3, tint: '#FAE7E5', need: (s) => true },
    { key: 'reha', label: 'リハ室', x0: 13, y0: 6, x1: 19, y1: 10, tint: '#DFF2EA', need: (s) => s.machines > 0 },
    { key: 'wait', label: '待合', x0: 0, y0: 7, x1: 6, y1: 11, tint: '#FBF0DC', need: (s) => true },
    { key: 'recep', label: '受付', x0: 7, y0: 7, x1: 10, y1: 9, tint: '#EAF1F6', need: (s) => true },
    { key: 'cash', label: '会計', x0: 13, y0: 11, x1: 16, y1: 13, tint: '#EDEAF6', need: (s) => true }
  ];

  // 座席・設備の設置順(先頭から settings の数だけ有効化)
  const CHAIR_SLOTS = [
    { x: 1, y: 8 }, { x: 2, y: 8 }, { x: 3, y: 8 }, { x: 4, y: 8 },
    { x: 1, y: 10 }, { x: 2, y: 10 }, { x: 3, y: 10 }, { x: 4, y: 10 },
    { x: 5, y: 8 }, { x: 5, y: 10 }, { x: 6, y: 8 }, { x: 6, y: 10 }
  ];
  const STAND_SPOTS = [{ x: 0, y: 9 }, { x: 6, y: 9 }, { x: 0, y: 8 }, { x: 0, y: 10 }, { x: 2, y: 9 }, { x: 4, y: 9 }, { x: 0, y: 11 }, { x: 6, y: 7 }];
  const BED_SLOTS = [{ bed: { x: 16, y: 1 }, spot: { x: 16, y: 2 } }, { bed: { x: 18, y: 1 }, spot: { x: 18, y: 2 } }, { bed: { x: 16, y: 3 }, spot: { x: 17, y: 3 } }];
  const MACHINE_SLOTS = [
    { m: { x: 14, y: 6 }, spot: { x: 14, y: 7 } }, { m: { x: 16, y: 6 }, spot: { x: 16, y: 7 } },
    { m: { x: 18, y: 6 }, spot: { x: 18, y: 7 } }, { m: { x: 14, y: 8 }, spot: { x: 14, y: 9 } },
    { m: { x: 16, y: 8 }, spot: { x: 16, y: 9 } }, { m: { x: 18, y: 8 }, spot: { x: 18, y: 9 } }
  ];
  const EXAM = [
    { desk: { x: 2, y: 2, w: 2, d: 1 }, doctor: { x: 2.5, y: 1.3 }, spot: { x: 3, y: 3 } },
    { desk: { x: 7, y: 2, w: 2, d: 1 }, doctor: { x: 7.5, y: 1.3 }, spot: { x: 8, y: 3 } },
    { desk: { x: 12, y: 2, w: 2, d: 1 }, doctor: { x: 12.5, y: 1.3 }, spot: { x: 13, y: 3 } }
  ];
  const RECEP = {
    counter: { x: 7, y: 8, w: 4, d: 1 },
    staff: [{ x: 8, y: 7.45 }, { x: 9.5, y: 7.45 }],
    service: [{ x: 8, y: 9 }, { x: 9, y: 9 }],
    queue: [{ x: 9, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 11 }, { x: 9, y: 11 }, { x: 8, y: 11 }, { x: 8, y: 10 }, { x: 10, y: 12 }, { x: 8, y: 12 }]
  };
  const CASH = {
    counter: { x: 14, y: 12, w: 2, d: 1 },
    staff: { x: 14.5, y: 11.45 },
    kiosk: { x: 17, y: 12 },
    service: [{ x: 14, y: 13 }, { x: 17, y: 13 }], // [有人, 精算機]
    queue: [{ x: 13, y: 13 }, { x: 12, y: 13 }, { x: 12, y: 12 }, { x: 12, y: 11 }, { x: 11, y: 13 }]
  };

  const PHASE_COLORS = {
    walk: '#9AA7B0', recepQ: '#C98A2D', recep: '#C98A2D',
    waitExam: '#3E7CA6', exam: '#2C5F82',
    treat: '#C4574E', waitTreat: '#3E7CA6',
    reha: '#4FA98C', waitReha: '#3E7CA6',
    cashQ: '#C98A2D', cash: '#8C7BC4'
  };

  class ClinicSim {
    constructor(settings, hooks) {
      this.s = settings;            // game.js と共有(ライブ参照)
      this.hooks = hooks;           // { onDischarge(patient, report) }
      this.reset();
      this.applySettings();
    }

    reset() {
      this.patients = [];
      this.idSeq = 1;
      this.recQueue = []; this.examQueue = []; this.treatQueue = []; this.rehaQueue = []; this.cashQueue = [];
      this.recBusy = [null, null];
      this.cashBusy = [null, null];
      this.doctors = [{ patient: null }, { patient: null }, { patient: null }];
      this.bedUsed = [null, null, null];
      this.machineUsed = [null, null, null, null, null, null];
      this.seatUsed = CHAIR_SLOTS.map(() => null);
      this.standUsed = STAND_SPOTS.map(() => null);
      this.heat = new Float32Array(W * H);
      this.floats = []; // 収益ポップ
      this.t = 0;
    }

    applySettings() {
      const s = this.s;
      this.blocked = new Set();
      const add = (x, y) => this.blocked.add(`${x},${y}`);
      EXAM.forEach((e, i) => { if (i < s.doctors) for (let dx = 0; dx < e.desk.w; dx++) add(e.desk.x + dx, e.desk.y); });
      BED_SLOTS.forEach((b, i) => { if (i < s.beds) add(b.bed.x, b.bed.y); });
      MACHINE_SLOTS.forEach((m, i) => { if (i < s.machines) add(m.m.x, m.m.y); });
      for (let dx = 0; dx < RECEP.counter.w; dx++) add(RECEP.counter.x + dx, RECEP.counter.y);
      for (let dx = 0; dx < CASH.counter.w; dx++) add(CASH.counter.x + dx, CASH.counter.y);
      if (s.kiosk) add(CASH.kiosk.x, CASH.kiosk.y);
    }

    usableBeds() { return Math.min(this.s.beds, this.s.nurses); }
    usableMachines() { return Math.min(this.s.machines, this.s.pts * 2); }

    /* ---------- 患者投入(game.js から) ---------- */

    // type: 'first' 初診 / 'revisit' 再診 / 'rehab' リハ通院 / 'checkup' 健診
    // opts.refer: 紹介患者(処置・リハにつながりやすい)
    spawn(type, opts) {
      if (this.patients.length >= 70) return false;
      const p = {
        id: this.idSeq++, type,
        x: DOOR.x, y: DOOR.y, path: [], onArrive: null,
        phase: 'recepQ',
        arrivedAt: this.t, waitTotal: 0, waitExamStart: 0,
        busyUntil: 0, seat: -1, stand: -1,
        items: [], didReha: false, refer: !!(opts && opts.refer)
      };
      this.patients.push(p);
      this.recQueue.push(p);
      this.routeQueue(this.recQueue, RECEP.service.slice(0, this.s.receptionists), RECEP.queue);
      return true;
    }

    /* ---------- 内部ヘルパー ---------- */

    walkTo(p, spot, onArrive) {
      p.path = astarGrid(W, H, this.blocked, p, spot);
      p.onArrive = onArrive || null;
    }

    // 複数窓口のある行列: 先頭 nSvc 人はサービス地点へ、残りは待機スロットへ
    routeQueue(queue, services, slots) {
      queue.forEach((p, i) => {
        const spot = i < services.length ? services[i] : slots[Math.min(i - services.length, slots.length - 1)];
        if ((Math.round(p.x) !== spot.x || Math.round(p.y) !== spot.y) && !this.samePathTarget(p, spot)) this.walkTo(p, spot);
      });
    }

    samePathTarget(p, spot) {
      const last = p.path[p.path.length - 1];
      return last && last.x === spot.x && last.y === spot.y;
    }

    atSpot(p, spot) {
      return !p.path.length && Math.abs(p.x - spot.x) < 0.15 && Math.abs(p.y - spot.y) < 0.15;
    }

    freeSeat(p) {
      if (p.seat >= 0) { this.seatUsed[p.seat] = null; p.seat = -1; }
      if (p.stand >= 0) { this.standUsed[p.stand] = null; p.stand = -1; }
    }

    seatInWaiting(p, phase) {
      p.phase = phase;
      p.waitExamStart = this.t;
      const nChairs = this.s.chairs;
      for (let i = 0; i < nChairs; i++) {
        if (!this.seatUsed[i]) { this.seatUsed[i] = p; p.seat = i; this.walkTo(p, CHAIR_SLOTS[i]); return; }
      }
      const st = this.standUsed.findIndex((v) => !v);
      if (st >= 0) { this.standUsed[st] = p; p.stand = st; this.walkTo(p, STAND_SPOTS[st]); return; }
      this.walkTo(p, { x: 3, y: 11 });
    }

    standingCount() { return this.standUsed.filter(Boolean).length; }

    toCashier(p) {
      p.phase = 'cashQ';
      p.waitExamStart = this.t;
      this.cashQueue.push(p);
      this.routeQueue(this.cashQueue, this.cashServices(), CASH.queue);
    }

    cashServices() {
      return this.s.kiosk ? CASH.service : CASH.service.slice(0, 1);
    }

    afterExam(p) {
      const s = this.s;
      const r = Math.random();
      const rehaOk = s.rehaLevel > 0 && this.usableMachines() > 0;
      // 紹介患者はリハ・処置の必要性が高い状態で来院する
      if (p.refer && rehaOk) {
        this.rehaQueue.push(p);
        this.seatInWaiting(p, 'waitReha');
        return;
      }
      if (p.refer && this.usableBeds() > 0) {
        this.treatQueue.push(p);
        this.seatInWaiting(p, 'waitTreat');
        return;
      }
      if (r < s.pTreat && this.usableBeds() > 0) {
        this.treatQueue.push(p);
        this.seatInWaiting(p, 'waitTreat');
      } else if (rehaOk && r < s.pTreat + s.pReha) {
        this.rehaQueue.push(p);
        this.seatInWaiting(p, 'waitReha');
      } else {
        this.toCashier(p);
      }
    }

    /* ---------- 1ステップ ---------- */

    tick(dt) {
      this.t += dt;
      const s = this.s;

      // 移動
      const speed = 3.4;
      for (const p of this.patients) {
        if (p.path.length) {
          const wp = p.path[0];
          const dx = wp.x - p.x, dy = wp.y - p.y;
          const dist = Math.hypot(dx, dy);
          const step = speed * dt;
          if (dist <= step) {
            p.x = wp.x; p.y = wp.y;
            p.path.shift();
            if (!p.path.length && p.onArrive) { const f = p.onArrive; p.onArrive = null; f(p); }
          } else {
            p.x += dx / dist * step;
            p.y += dy / dist * step;
          }
        }
        const hx = Math.round(p.x), hy = Math.round(p.y);
        if (hx >= 0 && hy >= 0 && hx < W && hy < H) this.heat[hx + hy * W] += (p.path.length ? 1 : 0.12) * dt;
        // 待ち時間の積算(待ち系フェーズのみ)
        if (p.phase === 'recepQ' || p.phase === 'waitExam' || p.phase === 'waitTreat' || p.phase === 'waitReha' || p.phase === 'cashQ') p.waitTotal += dt;
      }

      // 受付(窓口 = 受付スタッフ数)
      for (let w = 0; w < s.receptionists; w++) {
        const cur = this.recBusy[w];
        if (cur && this.t >= cur.busyUntil) {
          this.recBusy[w] = null;
          this.recQueue.splice(this.recQueue.indexOf(cur), 1);
          this.routeQueue(this.recQueue, RECEP.service.slice(0, s.receptionists), RECEP.queue);
          if (cur.type === 'rehab') {
            this.rehaQueue.push(cur);
            this.seatInWaiting(cur, 'waitReha');
          } else {
            this.examQueue.push(cur);
            this.seatInWaiting(cur, 'waitExam');
          }
        }
        if (!this.recBusy[w]) {
          const p = this.recQueue[w];
          if (p && this.atSpot(p, RECEP.service[w]) && !this.recBusy.includes(p)) {
            this.recBusy[w] = p;
            p.phase = 'recep';
            p.busyUntil = this.t + triRand(0.6, 1.8);
          }
        }
      }

      // 診察
      for (let d = 0; d < 3; d++) {
        const doc = this.doctors[d];
        if (doc.patient && this.t >= doc.patient.busyUntil) {
          const p = doc.patient;
          doc.patient = null;
          if (p.type === 'checkup') this.toCashier(p);
          else this.afterExam(p);
        }
        if (d < s.doctors && !doc.patient) {
          const idx = this.examQueue.findIndex((q) => q.phase === 'waitExam');
          if (idx >= 0) {
            const p = this.examQueue.splice(idx, 1)[0];
            doc.patient = p;
            this.freeSeat(p);
            p.phase = 'exam';
            p.busyUntil = Infinity;
            this.walkTo(p, EXAM[d].spot, (pp) => {
              const mean = pp.type === 'checkup' ? 3 : s.examMean * (pp.type === 'first' ? 1.25 : 0.85);
              pp.busyUntil = this.t + Math.max(1.5, triRand(mean * 0.55, mean * 1.6));
            });
          }
        }
      }

      // 処置(稼働ベッド = min(ベッド, 看護師))
      for (let i = 0; i < this.usableBeds(); i++) {
        const cur = this.bedUsed[i];
        if (cur && this.t >= cur.busyUntil) {
          this.bedUsed[i] = null;
          cur.items.push('treat');
          this.toCashier(cur);
        }
        if (!this.bedUsed[i]) {
          const idx = this.treatQueue.findIndex((q) => q.phase === 'waitTreat');
          if (idx >= 0) {
            const p = this.treatQueue.splice(idx, 1)[0];
            this.bedUsed[i] = p;
            this.freeSeat(p);
            p.phase = 'treat';
            p.busyUntil = Infinity;
            this.walkTo(p, BED_SLOTS[i].spot, (pp) => { pp.busyUntil = this.t + triRand(4, 9); });
          }
        }
      }

      // リハ(稼働機器 = min(機器, PT×2))
      for (let i = 0; i < this.usableMachines(); i++) {
        const cur = this.machineUsed[i];
        if (cur && this.t >= cur.busyUntil) {
          this.machineUsed[i] = null;
          cur.items.push('reha');
          cur.didReha = true;
          this.toCashier(cur);
        }
        if (!this.machineUsed[i]) {
          const idx = this.rehaQueue.findIndex((q) => q.phase === 'waitReha');
          if (idx >= 0) {
            const p = this.rehaQueue.splice(idx, 1)[0];
            this.machineUsed[i] = p;
            this.freeSeat(p);
            p.phase = 'reha';
            p.busyUntil = Infinity;
            this.walkTo(p, MACHINE_SLOTS[i].spot, (pp) => { pp.busyUntil = this.t + triRand(11, 18); });
          }
        }
      }

      // 会計(窓口0 = 有人、窓口1 = 自動精算機)
      const cashSvcs = this.cashServices();
      for (let w = 0; w < cashSvcs.length; w++) {
        const cur = this.cashBusy[w];
        if (cur && this.t >= cur.busyUntil) {
          this.cashBusy[w] = null;
          this.cashQueue.splice(this.cashQueue.indexOf(cur), 1);
          this.routeQueue(this.cashQueue, cashSvcs, CASH.queue);
          this.discharge(cur, w === 1);
        }
        if (!this.cashBusy[w]) {
          const p = this.cashQueue[w];
          if (p && this.atSpot(p, cashSvcs[w]) && !this.cashBusy.includes(p)) {
            this.cashBusy[w] = p;
            p.phase = 'cash';
            p.busyUntil = this.t + (w === 1 ? triRand(0.3, 0.7) : triRand(0.5, 1.4));
          }
        }
      }
    }

    discharge(p, viaKiosk) {
      p.phase = 'walk';
      this.walkTo(p, DOOR, (pp) => {
        this.patients.splice(this.patients.indexOf(pp), 1);
      });
      const stay = this.t - p.arrivedAt;
      const report = { type: p.type, items: p.items, didReha: p.didReha, wait: p.waitTotal, stay, viaKiosk };
      if (this.hooks.onDischarge) {
        const revenue = this.hooks.onDischarge(p, report);
        if (revenue > 0) this.floats.push({ x: p.x, y: p.y, text: `+¥${revenue.toLocaleString()}`, t: 0 });
      }
    }

    queueSummary() {
      return [
        ['受付待ち', this.recQueue.length],
        ['診察待ち', this.examQueue.length],
        ['処置待ち', this.treatQueue.length],
        ['リハ待ち', this.rehaQueue.length],
        ['会計待ち', this.cashQueue.length]
      ];
    }

    /* ---------- 描画 ---------- */

    draw(iso, view) {
      const s = this.s;
      const ctx = iso.ctx;
      iso.begin();

      // 床
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const z = ZONES.find((zz) => zz.need(s) && x >= zz.x0 && x <= zz.x1 && y >= zz.y0 && y <= zz.y1);
          let fill = z ? z.tint : '#F7FAFC';
          if ((x === DOOR.x || x === DOOR.x + 1) && y === DOOR.y) fill = '#C9D8E2';
          if (y === 4 || y === 5) fill = '#F1F6F9';
          iso.diamond(x, y, 0, fill, 'rgba(62,124,166,0.10)');
        }
      }

      // ヒートマップ
      if (view.heat) {
        let max = 1;
        for (let i = 0; i < this.heat.length; i++) max = Math.max(max, this.heat[i]);
        for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const v = this.heat[x + y * W];
          if (v <= 0.01) continue;
          const a = Math.min(0.72, Math.sqrt(v / max) * 0.8);
          iso.diamond(x, y, 0, `rgba(214,69,48,${a.toFixed(3)})`);
        }
      }

      // 導線ライン
      if (view.lines) {
        for (const p of this.patients) {
          if (!p.path.length) continue;
          ctx.strokeStyle = PHASE_COLORS[p.phase] || '#9AA7B0';
          ctx.globalAlpha = 0.55;
          ctx.lineWidth = 2;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          let pt = iso.p(p.x + 0.5, p.y + 0.5, 0);
          ctx.moveTo(pt.x, pt.y);
          for (const wp of p.path) { pt = iso.p(wp.x + 0.5, wp.y + 0.5, 0); ctx.lineTo(pt.x, pt.y); }
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.globalAlpha = 1;
        }
      }

      // 深度ソート描画
      const items = [];
      const boxItem = (x, y, w, d, h, c) => items.push({ depth: x + w / 2 + y + d / 2, draw: () => iso.box(x, y, w, d, h, c) });
      EXAM.forEach((e, i) => { if (i < s.doctors) boxItem(e.desk.x, e.desk.y, e.desk.w, e.desk.d, 0.55, '#C9A272'); });
      BED_SLOTS.forEach((b, i) => { if (i < s.beds) boxItem(b.bed.x, b.bed.y, 1, 1, 0.45, '#F2F6F8'); });
      MACHINE_SLOTS.forEach((m, i) => { if (i < s.machines) boxItem(m.m.x, m.m.y, 1, 1, 0.5, i < this.usableMachines() ? '#7FB8A2' : '#B9C6C0'); });
      for (let i = 0; i < s.chairs; i++) boxItem(CHAIR_SLOTS[i].x, CHAIR_SLOTS[i].y, 1, 1, 0.32, '#E4B968');
      boxItem(RECEP.counter.x, RECEP.counter.y, RECEP.counter.w, RECEP.counter.d, 0.7, '#6E9CBE');
      boxItem(CASH.counter.x, CASH.counter.y, CASH.counter.w, CASH.counter.d, 0.7, '#9C8FCB');
      if (s.kiosk) boxItem(CASH.kiosk.x, CASH.kiosk.y, 1, 1, 0.9, '#8FA8B8');

      // スタッフ
      for (let w = 0; w < s.receptionists; w++) {
        const sp = RECEP.staff[w];
        items.push({ depth: sp.x + sp.y, draw: () => iso.figure(sp.x, sp.y, '#FFFFFF', { coat: true, dot: this.recBusy[w] ? '#3E7CA6' : '#4FA98C' }) });
      }
      items.push({ depth: CASH.staff.x + CASH.staff.y, draw: () => iso.figure(CASH.staff.x, CASH.staff.y, '#FFFFFF', { coat: true, dot: this.cashBusy[0] ? '#3E7CA6' : '#4FA98C' }) });
      for (let d = 0; d < s.doctors; d++) {
        const sp = EXAM[d].doctor;
        items.push({ depth: sp.x + sp.y, draw: () => iso.figure(sp.x, sp.y, '#FFFFFF', { coat: true, dot: this.doctors[d].patient ? '#3E7CA6' : '#4FA98C' }) });
      }
      // 看護師・PT(飾りとして配置)
      for (let n = 0; n < s.nurses; n++) {
        const sp = { x: 17 + n, y: 0.4 };
        items.push({ depth: sp.x + sp.y, draw: () => iso.figure(sp.x, sp.y, '#F4C8D4', { dot: this.bedUsed[n] ? '#3E7CA6' : '#4FA98C' }) });
      }
      for (let n = 0; n < s.pts; n++) {
        const sp = { x: 13 + n * 1.4, y: 10.4 };
        if (sp.x > 19) break;
        items.push({ depth: sp.x + sp.y, draw: () => iso.figure(sp.x, sp.y, '#BFE0D2', { dot: '#4FA98C' }) });
      }

      // 患者
      for (const p of this.patients) {
        const color = PHASE_COLORS[p.phase] || '#9AA7B0';
        items.push({ depth: p.x + p.y + 0.01, draw: () => iso.figure(p.x, p.y, color, { walking: p.path.length > 0 }) });
      }
      items.sort((a, b) => a.depth - b.depth);
      items.forEach((it) => it.draw());

      // ゾーンラベル
      for (const z of ZONES) {
        if (!z.need(s)) continue;
        iso.label((z.x0 + z.x1 + 1) / 2, (z.y0 + z.y1 + 1) / 2, z.label);
      }
      iso.label(DOOR.x + 1, DOOR.y + 0.5, '入口/出口');

      // 収益ポップ
      for (let i = this.floats.length - 1; i >= 0; i--) {
        const f = this.floats[i];
        f.t += 0.016;
        if (f.t >= 1) { this.floats.splice(i, 1); continue; }
        iso.floatText(f.x, f.y, f.text, '#3A8A70', f.t);
      }
    }
  }

  return { W, H, ClinicSim, PHASE_COLORS };
})();
