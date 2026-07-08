/* クリニックタウン3D — 院内シミュレーション
 * 患者エージェントが 受付→待合→診察→(処置/リハ)→会計 を巡回する。
 * スタッフ数・設備数・増築レベルは game.js の settings に連動する。
 * settings.floorLv: 1=標準(20x14) / 2=増築(26x16, 診察4・機器12・椅子20)
 */

'use strict';

const CLINIC = (() => {

  /* ================= フロアプラン(レベル別) ================= */

  function layoutLv1() {
    return {
      W: 20, H: 14,
      DOOR: { x: 9, y: 13 },
      CORRIDOR: [4, 5],
      ZONES: [
        { key: 'exam1', label: '診察室1', x0: 1, y0: 0, x1: 4, y1: 3, tint: '#DCEDF6', need: (s) => true },
        { key: 'exam2', label: '診察室2', x0: 6, y0: 0, x1: 9, y1: 3, tint: '#DCEDF6', need: (s) => s.doctors >= 2 },
        { key: 'exam3', label: '診察室3', x0: 11, y0: 0, x1: 14, y1: 3, tint: '#DCEDF6', need: (s) => s.doctors >= 3 },
        { key: 'treat', label: '処置室', x0: 16, y0: 0, x1: 19, y1: 3, tint: '#FAE7E5', need: (s) => true },
        { key: 'reha', label: 'リハ室', x0: 13, y0: 6, x1: 19, y1: 10, tint: '#DFF2EA', need: (s) => s.machines > 0 },
        { key: 'wait', label: '待合', x0: 0, y0: 7, x1: 6, y1: 11, tint: '#FBF0DC', need: (s) => true },
        { key: 'recep', label: '受付', x0: 7, y0: 7, x1: 10, y1: 9, tint: '#EAF1F6', need: (s) => true },
        { key: 'cash', label: '会計', x0: 13, y0: 11, x1: 16, y1: 13, tint: '#EDEAF6', need: (s) => true }
      ],
      CHAIRS: [
        { x: 1, y: 8 }, { x: 2, y: 8 }, { x: 3, y: 8 }, { x: 4, y: 8 },
        { x: 1, y: 10 }, { x: 2, y: 10 }, { x: 3, y: 10 }, { x: 4, y: 10 },
        { x: 5, y: 8 }, { x: 5, y: 10 }, { x: 6, y: 8 }, { x: 6, y: 10 }
      ],
      STANDS: [{ x: 0, y: 9 }, { x: 6, y: 9 }, { x: 0, y: 8 }, { x: 0, y: 10 }, { x: 2, y: 9 }, { x: 4, y: 9 }, { x: 0, y: 11 }, { x: 6, y: 7 }],
      BEDS: [
        { bed: { x: 16, y: 1 }, spot: { x: 16, y: 2 } },
        { bed: { x: 18, y: 1 }, spot: { x: 18, y: 2 } },
        { bed: { x: 16, y: 3 }, spot: { x: 17, y: 3 } }
      ],
      MACHINES: [
        { m: { x: 14, y: 6 }, spot: { x: 14, y: 7 } }, { m: { x: 16, y: 6 }, spot: { x: 16, y: 7 } },
        { m: { x: 18, y: 6 }, spot: { x: 18, y: 7 } }, { m: { x: 14, y: 8 }, spot: { x: 14, y: 9 } },
        { m: { x: 16, y: 8 }, spot: { x: 16, y: 9 } }, { m: { x: 18, y: 8 }, spot: { x: 18, y: 9 } }
      ],
      EXAM: [
        { desk: { x: 2, y: 2, w: 2, d: 1 }, doctor: { x: 2.5, y: 1.3 }, spot: { x: 3, y: 3 } },
        { desk: { x: 7, y: 2, w: 2, d: 1 }, doctor: { x: 7.5, y: 1.3 }, spot: { x: 8, y: 3 } },
        { desk: { x: 12, y: 2, w: 2, d: 1 }, doctor: { x: 12.5, y: 1.3 }, spot: { x: 13, y: 3 } }
      ],
      RECEP: {
        counter: { x: 7, y: 8, w: 4, d: 1 },
        staff: [{ x: 8, y: 7.45 }, { x: 9.5, y: 7.45 }],
        service: [{ x: 8, y: 9 }, { x: 9, y: 9 }],
        queue: [{ x: 9, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 11 }, { x: 9, y: 11 }, { x: 8, y: 11 }, { x: 8, y: 10 }, { x: 10, y: 12 }, { x: 8, y: 12 }]
      },
      CASH: {
        counter: { x: 14, y: 12, w: 2, d: 1 },
        staff: { x: 14.5, y: 11.45 },
        kiosk: { x: 17, y: 12 },
        service: [{ x: 14, y: 13 }, { x: 17, y: 13 }],
        queue: [{ x: 13, y: 13 }, { x: 12, y: 13 }, { x: 12, y: 12 }, { x: 12, y: 11 }, { x: 11, y: 13 }]
      },
      NURSE_ROW: (n) => ({ x: 17 + (n % 2), y: 0.4 + Math.floor(n / 2) * 0.0 }),
      PT_ROW: (n) => ({ x: 13 + n * 1.1, y: 10.4 }),
      DECO: {
        cafe: { x: 1, y: 7, w: 2, label: '☕ カフェ' },
        kids: { x: 5, y: 11, w: 2, label: '🧸 キッズ' },
        signage: { x: 0, y: 7, w: 1, label: '📺' },
        bus: { x: 0, y: 13, w: 2, label: '🚌 送迎バス' }
      },
      MAX: { doctors: 3, chairs: 12, beds: 3, machines: 6, receptionists: 2, nurses: 3, pts: 6 }
    };
  }

  function layoutLv2() {
    return {
      W: 26, H: 16,
      DOOR: { x: 12, y: 15 },
      CORRIDOR: [4, 5],
      ZONES: [
        { key: 'exam1', label: '診察室1', x0: 1, y0: 0, x1: 4, y1: 3, tint: '#DCEDF6', need: (s) => true },
        { key: 'exam2', label: '診察室2', x0: 6, y0: 0, x1: 9, y1: 3, tint: '#DCEDF6', need: (s) => s.doctors >= 2 },
        { key: 'exam3', label: '診察室3', x0: 11, y0: 0, x1: 14, y1: 3, tint: '#DCEDF6', need: (s) => s.doctors >= 3 },
        { key: 'exam4', label: '診察室4', x0: 16, y0: 0, x1: 19, y1: 3, tint: '#DCEDF6', need: (s) => s.doctors >= 4 },
        { key: 'treat', label: '処置室', x0: 21, y0: 0, x1: 25, y1: 3, tint: '#FAE7E5', need: (s) => true },
        { key: 'reha', label: 'リハ室(100㎡)', x0: 15, y0: 6, x1: 25, y1: 11, tint: '#DFF2EA', need: (s) => true },
        { key: 'wait', label: '待合', x0: 0, y0: 7, x1: 7, y1: 12, tint: '#FBF0DC', need: (s) => true },
        { key: 'recep', label: '受付', x0: 8, y0: 7, x1: 12, y1: 9, tint: '#EAF1F6', need: (s) => true },
        { key: 'cash', label: '会計', x0: 9, y0: 12, x1: 14, y1: 15, tint: '#EDEAF6', need: (s) => true }
      ],
      CHAIRS: [
        { x: 1, y: 8 }, { x: 2, y: 8 }, { x: 3, y: 8 }, { x: 4, y: 8 }, { x: 5, y: 8 }, { x: 6, y: 8 },
        { x: 1, y: 10 }, { x: 2, y: 10 }, { x: 3, y: 10 }, { x: 4, y: 10 }, { x: 5, y: 10 }, { x: 6, y: 10 },
        { x: 1, y: 12 }, { x: 2, y: 12 }, { x: 3, y: 12 }, { x: 4, y: 12 }, { x: 5, y: 12 }, { x: 6, y: 12 },
        { x: 7, y: 9 }, { x: 7, y: 11 }
      ],
      STANDS: [{ x: 0, y: 9 }, { x: 0, y: 11 }, { x: 7, y: 7 }, { x: 0, y: 7 }, { x: 2, y: 9 }, { x: 4, y: 9 }, { x: 2, y: 11 }, { x: 4, y: 11 }, { x: 0, y: 13 }, { x: 6, y: 9 }],
      BEDS: [
        { bed: { x: 21, y: 1 }, spot: { x: 21, y: 2 } },
        { bed: { x: 23, y: 1 }, spot: { x: 23, y: 2 } },
        { bed: { x: 25, y: 1 }, spot: { x: 25, y: 2 } },
        { bed: { x: 22, y: 3 }, spot: { x: 21, y: 3 } }
      ],
      MACHINES: [
        { m: { x: 16, y: 6 }, spot: { x: 16, y: 7 } }, { m: { x: 18, y: 6 }, spot: { x: 18, y: 7 } },
        { m: { x: 20, y: 6 }, spot: { x: 20, y: 7 } }, { m: { x: 22, y: 6 }, spot: { x: 22, y: 7 } },
        { m: { x: 24, y: 6 }, spot: { x: 24, y: 7 } }, { m: { x: 16, y: 8 }, spot: { x: 16, y: 9 } },
        { m: { x: 18, y: 8 }, spot: { x: 18, y: 9 } }, { m: { x: 20, y: 8 }, spot: { x: 20, y: 9 } },
        { m: { x: 22, y: 8 }, spot: { x: 22, y: 9 } }, { m: { x: 24, y: 8 }, spot: { x: 24, y: 9 } },
        { m: { x: 16, y: 10 }, spot: { x: 16, y: 11 } }, { m: { x: 18, y: 10 }, spot: { x: 18, y: 11 } }
      ],
      EXAM: [
        { desk: { x: 2, y: 2, w: 2, d: 1 }, doctor: { x: 2.5, y: 1.3 }, spot: { x: 3, y: 3 } },
        { desk: { x: 7, y: 2, w: 2, d: 1 }, doctor: { x: 7.5, y: 1.3 }, spot: { x: 8, y: 3 } },
        { desk: { x: 12, y: 2, w: 2, d: 1 }, doctor: { x: 12.5, y: 1.3 }, spot: { x: 13, y: 3 } },
        { desk: { x: 17, y: 2, w: 2, d: 1 }, doctor: { x: 17.5, y: 1.3 }, spot: { x: 18, y: 3 } }
      ],
      RECEP: {
        counter: { x: 8, y: 8, w: 4, d: 1 },
        staff: [{ x: 8.5, y: 7.45 }, { x: 10, y: 7.45 }, { x: 11.2, y: 7.45 }],
        service: [{ x: 9, y: 9 }, { x: 10, y: 9 }, { x: 11, y: 9 }],
        queue: [{ x: 12, y: 10 }, { x: 11, y: 10 }, { x: 10, y: 10 }, { x: 9, y: 10 }, { x: 12, y: 11 }, { x: 11, y: 11 }, { x: 10, y: 11 }, { x: 13, y: 10 }]
      },
      CASH: {
        counter: { x: 10, y: 13, w: 3, d: 1 },
        staff: { x: 11, y: 12.45 },
        kiosk: { x: 14, y: 13 },
        service: [{ x: 10, y: 14 }, { x: 14, y: 14 }],
        queue: [{ x: 9, y: 14 }, { x: 8, y: 14 }, { x: 8, y: 13 }, { x: 9, y: 13 }, { x: 8, y: 15 }]
      },
      NURSE_ROW: (n) => ({ x: 22 + (n % 3) * 1.2, y: 0.4 }),
      PT_ROW: (n) => ({ x: 15 + (n % 10) * 1.05, y: 10.5 + Math.floor(n / 10) * 0.0 }),
      DECO: {
        cafe: { x: 1, y: 7, w: 2, label: '☕ カフェ' },
        kids: { x: 5, y: 11, w: 2, label: '🧸 キッズ' },
        signage: { x: 0, y: 12, w: 1, label: '📺' },
        bus: { x: 0, y: 15, w: 2, label: '🚌 送迎バス' }
      },
      MAX: { doctors: 4, chairs: 20, beds: 4, machines: 12, receptionists: 3, nurses: 4, pts: 12 }
    };
  }

  function layoutLv3() {
    return {
      W: 32, H: 20,
      DOOR: { x: 15, y: 19 },
      CORRIDOR: [4, 5],
      ZONES: [
        { key: 'exam1', label: '診察室1', x0: 1, y0: 0, x1: 4, y1: 3, tint: '#DCEDF6', need: (s) => true },
        { key: 'exam2', label: '診察室2', x0: 6, y0: 0, x1: 9, y1: 3, tint: '#DCEDF6', need: (s) => s.doctors >= 2 },
        { key: 'exam3', label: '診察室3', x0: 11, y0: 0, x1: 14, y1: 3, tint: '#DCEDF6', need: (s) => s.doctors >= 3 },
        { key: 'exam4', label: '診察室4', x0: 16, y0: 0, x1: 19, y1: 3, tint: '#DCEDF6', need: (s) => s.doctors >= 4 },
        { key: 'exam5', label: '診察室5', x0: 21, y0: 0, x1: 24, y1: 3, tint: '#DCEDF6', need: (s) => s.doctors >= 5 },
        { key: 'exam6', label: '診察室6', x0: 26, y0: 0, x1: 29, y1: 3, tint: '#DCEDF6', need: (s) => s.doctors >= 6 },
        { key: 'reha', label: 'リハ室(150㎡)', x0: 17, y0: 7, x1: 31, y1: 13, tint: '#DFF2EA', need: (s) => true },
        { key: 'treat', label: '処置室', x0: 26, y0: 15, x1: 31, y1: 18, tint: '#FAE7E5', need: (s) => true },
        { key: 'wait', label: '待合', x0: 0, y0: 7, x1: 8, y1: 14, tint: '#FBF0DC', need: (s) => true },
        { key: 'recep', label: '受付', x0: 10, y0: 7, x1: 15, y1: 9, tint: '#EAF1F6', need: (s) => true },
        { key: 'cash', label: '会計', x0: 9, y0: 15, x1: 16, y1: 18, tint: '#EDEAF6', need: (s) => true }
      ],
      CHAIRS: [
        { x: 1, y: 8 }, { x: 2, y: 8 }, { x: 3, y: 8 }, { x: 4, y: 8 }, { x: 5, y: 8 }, { x: 6, y: 8 }, { x: 7, y: 8 },
        { x: 1, y: 10 }, { x: 2, y: 10 }, { x: 3, y: 10 }, { x: 4, y: 10 }, { x: 5, y: 10 }, { x: 6, y: 10 }, { x: 7, y: 10 },
        { x: 1, y: 12 }, { x: 2, y: 12 }, { x: 3, y: 12 }, { x: 4, y: 12 }, { x: 5, y: 12 }, { x: 6, y: 12 }, { x: 7, y: 12 },
        { x: 1, y: 14 }, { x: 2, y: 14 }, { x: 3, y: 14 }, { x: 4, y: 14 }, { x: 5, y: 14 }, { x: 6, y: 14 }, { x: 7, y: 14 }
      ],
      STANDS: [
        { x: 0, y: 8 }, { x: 0, y: 9 }, { x: 0, y: 10 }, { x: 0, y: 11 }, { x: 0, y: 12 }, { x: 0, y: 13 },
        { x: 8, y: 8 }, { x: 8, y: 10 }, { x: 8, y: 12 }, { x: 2, y: 13 }, { x: 4, y: 13 }, { x: 6, y: 13 }
      ],
      BEDS: [
        { bed: { x: 27, y: 15 }, spot: { x: 27, y: 16 } },
        { bed: { x: 29, y: 15 }, spot: { x: 29, y: 16 } },
        { bed: { x: 31, y: 15 }, spot: { x: 31, y: 16 } },
        { bed: { x: 27, y: 17 }, spot: { x: 27, y: 18 } },
        { bed: { x: 29, y: 17 }, spot: { x: 29, y: 18 } },
        { bed: { x: 31, y: 17 }, spot: { x: 31, y: 18 } }
      ],
      MACHINES: [
        { m: { x: 17, y: 7 }, spot: { x: 17, y: 8 } }, { m: { x: 19, y: 7 }, spot: { x: 19, y: 8 } },
        { m: { x: 21, y: 7 }, spot: { x: 21, y: 8 } }, { m: { x: 23, y: 7 }, spot: { x: 23, y: 8 } },
        { m: { x: 25, y: 7 }, spot: { x: 25, y: 8 } }, { m: { x: 27, y: 7 }, spot: { x: 27, y: 8 } },
        { m: { x: 29, y: 7 }, spot: { x: 29, y: 8 } }, { m: { x: 31, y: 7 }, spot: { x: 31, y: 8 } },
        { m: { x: 17, y: 9 }, spot: { x: 17, y: 10 } }, { m: { x: 19, y: 9 }, spot: { x: 19, y: 10 } },
        { m: { x: 21, y: 9 }, spot: { x: 21, y: 10 } }, { m: { x: 23, y: 9 }, spot: { x: 23, y: 10 } },
        { m: { x: 25, y: 9 }, spot: { x: 25, y: 10 } }, { m: { x: 27, y: 9 }, spot: { x: 27, y: 10 } },
        { m: { x: 29, y: 9 }, spot: { x: 29, y: 10 } }, { m: { x: 31, y: 9 }, spot: { x: 31, y: 10 } },
        { m: { x: 17, y: 11 }, spot: { x: 17, y: 12 } }, { m: { x: 19, y: 11 }, spot: { x: 19, y: 12 } }
      ],
      EXAM: [
        { desk: { x: 2, y: 2, w: 2, d: 1 }, doctor: { x: 2.5, y: 1.3 }, spot: { x: 3, y: 3 } },
        { desk: { x: 7, y: 2, w: 2, d: 1 }, doctor: { x: 7.5, y: 1.3 }, spot: { x: 8, y: 3 } },
        { desk: { x: 12, y: 2, w: 2, d: 1 }, doctor: { x: 12.5, y: 1.3 }, spot: { x: 13, y: 3 } },
        { desk: { x: 17, y: 2, w: 2, d: 1 }, doctor: { x: 17.5, y: 1.3 }, spot: { x: 18, y: 3 } },
        { desk: { x: 22, y: 2, w: 2, d: 1 }, doctor: { x: 22.5, y: 1.3 }, spot: { x: 23, y: 3 } },
        { desk: { x: 27, y: 2, w: 2, d: 1 }, doctor: { x: 27.5, y: 1.3 }, spot: { x: 28, y: 3 } }
      ],
      RECEP: {
        counter: { x: 10, y: 8, w: 5, d: 1 },
        staff: [{ x: 10.5, y: 7.45 }, { x: 11.7, y: 7.45 }, { x: 12.9, y: 7.45 }, { x: 14.1, y: 7.45 }],
        service: [{ x: 11, y: 9 }, { x: 12, y: 9 }, { x: 13, y: 9 }, { x: 14, y: 9 }],
        queue: [{ x: 15, y: 10 }, { x: 14, y: 10 }, { x: 13, y: 10 }, { x: 12, y: 10 }, { x: 11, y: 10 }, { x: 15, y: 11 }, { x: 14, y: 11 }, { x: 13, y: 11 }]
      },
      CASH: {
        counter: { x: 11, y: 16, w: 4, d: 1 },
        staff: { x: 12.5, y: 15.45 },
        kiosk: { x: 16, y: 16 },
        service: [{ x: 11, y: 17 }, { x: 16, y: 17 }],
        queue: [{ x: 10, y: 17 }, { x: 9, y: 17 }, { x: 9, y: 16 }, { x: 10, y: 18 }, { x: 9, y: 18 }]
      },
      NURSE_ROW: (n) => ({ x: 26.5 + (n % 3) * 1.5, y: 14.4 }),
      PT_ROW: (n) => ({ x: 17 + (n % 14) * 1.02, y: 13.4 }),
      PT_VIS: 14,
      DECO: {
        cafe: { x: 1, y: 7, w: 2, label: '☕ カフェ' },
        kids: { x: 5, y: 15, w: 2, label: '🧸 キッズ' },
        signage: { x: 0, y: 7, w: 1, label: '📺' },
        bus: { x: 0, y: 19, w: 2, label: '🚌 送迎バス' }
      },
      MAX: { doctors: 6, chairs: 28, beds: 6, machines: 18, receptionists: 4, nurses: 6, pts: 20 }
    };
  }

  const LAYOUTS = { 1: layoutLv1, 2: layoutLv2, 3: layoutLv3 };

  const PHASE_COLORS = {
    walk: '#9AA7B0', recepQ: '#C98A2D', recep: '#C98A2D',
    waitExam: '#3E7CA6', exam: '#2C5F82',
    treat: '#C4574E', waitTreat: '#3E7CA6',
    reha: '#4FA98C', waitReha: '#3E7CA6',
    cashQ: '#C98A2D', cash: '#8C7BC4'
  };

  /* ================= シミュレーション ================= */

  class ClinicSim {
    constructor(settings, hooks) {
      this.s = settings;
      this.hooks = hooks;
      this.L = LAYOUTS[settings.floorLv || 1]();
      this.reset();
      this.applySettings();
    }

    reset() {
      this.patients = [];
      this.idSeq = 1;
      this.recQueue = []; this.examQueue = []; this.treatQueue = []; this.rehaQueue = []; this.cashQueue = [];
      this.recBusy = [null, null, null, null];
      this.cashBusy = [null, null];
      this.doctors = [{ patient: null }, { patient: null }, { patient: null }, { patient: null }, { patient: null }, { patient: null }];
      this.bedUsed = [null, null, null, null, null, null];
      this.machineUsed = new Array(18).fill(null);
      this.seatUsed = new Array(28).fill(null);
      this.standUsed = new Array(12).fill(null);
      this.heat = new Float32Array(this.L.W * this.L.H);
      this.floats = [];
      this.t = 0;
      this.rehaToday = 0; // PT1人1日24単位(=12回)の上限管理
    }

    applySettings() {
      const s = this.s;
      const lv = s.floorLv || 1;
      if (!this._lv || this._lv !== lv) {
        this.L = LAYOUTS[lv]();
        this._lv = lv;
        this.reset(); // 改装: 院内を一度クリア
        if (this.hooks.onRelayout) this.hooks.onRelayout(this.L);
      }
      const L = this.L;
      this.blocked = new Set();
      const add = (x, y) => this.blocked.add(`${x},${y}`);
      L.EXAM.forEach((e, i) => { if (i < s.doctors) for (let dx = 0; dx < e.desk.w; dx++) add(e.desk.x + dx, e.desk.y); });
      L.BEDS.forEach((b, i) => { if (i < s.beds) add(b.bed.x, b.bed.y); });
      L.MACHINES.forEach((m, i) => { if (i < s.machines) add(m.m.x, m.m.y); });
      for (let dx = 0; dx < L.RECEP.counter.w; dx++) add(L.RECEP.counter.x + dx, L.RECEP.counter.y);
      for (let dx = 0; dx < L.CASH.counter.w; dx++) add(L.CASH.counter.x + dx, L.CASH.counter.y);
      if (s.kiosk) add(L.CASH.kiosk.x, L.CASH.kiosk.y);
    }

    usableBeds() { return Math.min(this.s.beds, this.s.nurses); }
    usableMachines() { return Math.min(this.s.machines, this.s.pts * 2 + (this.s.rehaAides || 0)); }
    rehaCap() { return this.s.pts * 12 + (this.s.rehaAides || 0) * 4; } // 助手が準備を担い回転UP

    /* ---------- 患者投入 ---------- */

    // 待合の飽和度(椅子+立ちスペースに対する待機人数)
    waitingLoad() {
      const cap = Math.min(this.s.chairs, this.L.CHAIRS.length) + this.L.STANDS.length;
      const n = this.recQueue.length + this.examQueue.length + this.treatQueue.length + this.rehaQueue.length;
      return { n, cap };
    }

    // type: 'first' | 'revisit' | 'rehab' | 'checkup' / opts.refer: 紹介・リハ必要性高
    spawn(type, opts) {
      if (this.patients.length >= 90) return false;
      // 混雑離脱(balking): 待合が飽和していると、入口で引き返す患者が出る
      const wl = this.waitingLoad();
      if (wl.n >= wl.cap) {
        if (this.hooks.onBalk) this.hooks.onBalk(type, opts);
        return false;
      }
      const L = this.L;
      const p = {
        id: this.idSeq++, type,
        x: L.DOOR.x, y: L.DOOR.y, path: [], onArrive: null,
        phase: 'recepQ',
        arrivedAt: this.t, waitTotal: 0,
        busyUntil: 0, seat: -1, stand: -1,
        items: [], didReha: false, refer: !!(opts && opts.refer),
        seg: (opts && opts.seg) || 'senior'
      };
      this.patients.push(p);
      this.recQueue.push(p);
      this.routeQueue(this.recQueue, L.RECEP.service.slice(0, this.recepWindows()), L.RECEP.queue);
      return true;
    }

    recepWindows() { return Math.min(this.s.receptionists, this.L.RECEP.service.length); }

    /* ---------- 内部ヘルパー ---------- */

    walkTo(p, spot, onArrive) {
      p.path = astarGrid(this.L.W, this.L.H, this.blocked, p, spot);
      p.onArrive = onArrive || null;
    }

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
      const L = this.L;
      p.phase = phase;
      const nChairs = Math.min(this.s.chairs, L.CHAIRS.length);
      for (let i = 0; i < nChairs; i++) {
        if (!this.seatUsed[i]) { this.seatUsed[i] = p; p.seat = i; this.walkTo(p, L.CHAIRS[i]); return; }
      }
      for (let i = 0; i < L.STANDS.length; i++) {
        if (!this.standUsed[i]) { this.standUsed[i] = p; p.stand = i; this.walkTo(p, L.STANDS[i]); return; }
      }
      this.walkTo(p, { x: 3, y: L.H - 3 });
    }

    standingCount() { return this.standUsed.filter(Boolean).length; }

    toCashier(p) {
      p.phase = 'cashQ';
      this.cashQueue.push(p);
      this.routeQueue(this.cashQueue, this.cashServices(), this.L.CASH.queue);
    }

    cashServices() {
      return this.s.kiosk ? this.L.CASH.service : this.L.CASH.service.slice(0, 1);
    }

    afterExam(p) {
      const s = this.s;
      const r = Math.random();
      const rehaOk = s.rehaLevel > 0 && this.usableMachines() > 0;
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
      // 客層でリハ必要性が変わる(高齢者・スポーツは高い)
      const segMul = { senior: 1.2, sports: 1.45, worker: 0.75 }[p.seg] || 1;
      if (r < s.pTreat && this.usableBeds() > 0) {
        this.treatQueue.push(p);
        this.seatInWaiting(p, 'waitTreat');
      } else if (rehaOk && r < s.pTreat + s.pReha * segMul) {
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
      const L = this.L;

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
        if (hx >= 0 && hy >= 0 && hx < L.W && hy < L.H) this.heat[hx + hy * L.W] += (p.path.length ? 1 : 0.12) * dt;
        if (p.phase === 'recepQ' || p.phase === 'waitExam' || p.phase === 'waitTreat' || p.phase === 'waitReha' || p.phase === 'cashQ') p.waitTotal += dt;
      }

      // 受付
      const nWin = this.recepWindows();
      for (let w = 0; w < nWin; w++) {
        const cur = this.recBusy[w];
        if (cur && this.t >= cur.busyUntil) {
          this.recBusy[w] = null;
          this.recQueue.splice(this.recQueue.indexOf(cur), 1);
          this.routeQueue(this.recQueue, L.RECEP.service.slice(0, nWin), L.RECEP.queue);
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
          if (p && this.atSpot(p, L.RECEP.service[w]) && !this.recBusy.includes(p)) {
            this.recBusy[w] = p;
            p.phase = 'recep';
            // Web問診・事前受付を導入すると受付が大幅短縮(イベントで疲労時は低下)
            p.busyUntil = this.t + (s.webIntake ? triRand(0.35, 1.0) : triRand(0.6, 1.8)) * (s.evRecepSlow ? 1.4 : 1);
          }
        }
      }

      // 診察
      for (let d = 0; d < L.EXAM.length; d++) {
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
            this.walkTo(p, L.EXAM[d].spot, (pp) => {
              const mean = pp.type === 'checkup' ? 3 : (s.examMean + (s.evExamDelta || 0)) * (pp.type === 'first' ? 1.25 : 0.85);
              let extra = 0;
              // 診察室内の注射(関節注・トリガー/ブロック)。実施方針に従う
              if (pp.type !== 'checkup') {
                if (Math.random() < (s.pInj || 0)) { pp.items.push('inj'); extra += 0.9; }
                if (Math.random() < (s.pTrig || 0)) { pp.items.push('trig'); extra += 0.8; }
              }
              pp.busyUntil = this.t + Math.max(1.5, triRand(mean * 0.55, mean * 1.6)) + extra;
            });
          }
        }
      }

      // 処置
      for (let i = 0; i < Math.min(this.usableBeds(), L.BEDS.length); i++) {
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
            this.walkTo(p, L.BEDS[i].spot, (pp) => { pp.busyUntil = this.t + triRand(4, 9); });
          }
        }
      }

      // リハ: PT単位上限(1人1日24単位=12回、助手で+4単位/人)に達したら次回振替
      if (this.rehaToday >= this.rehaCap() && this.rehaQueue.length) {
        const waiting = this.rehaQueue.filter((q) => q.phase === 'waitReha');
        for (const p of waiting) {
          this.rehaQueue.splice(this.rehaQueue.indexOf(p), 1);
          this.freeSeat(p);
          this.toCashier(p);
        }
      }
      // リハ
      for (let i = 0; i < Math.min(this.usableMachines(), L.MACHINES.length); i++) {
        const cur = this.machineUsed[i];
        if (cur && this.t >= cur.busyUntil) {
          this.machineUsed[i] = null;
          cur.items.push('reha');
          cur.didReha = true;
          this.toCashier(cur);
        }
        if (!this.machineUsed[i] && this.rehaToday < this.rehaCap()) {
          const idx = this.rehaQueue.findIndex((q) => q.phase === 'waitReha');
          if (idx >= 0) {
            const p = this.rehaQueue.splice(idx, 1)[0];
            this.machineUsed[i] = p;
            this.rehaToday++;
            this.freeSeat(p);
            p.phase = 'reha';
            p.busyUntil = Infinity;
            this.walkTo(p, L.MACHINES[i].spot, (pp) => { pp.busyUntil = this.t + triRand(11, 18); });
          }
        }
      }

      // 会計
      const cashSvcs = this.cashServices();
      for (let w = 0; w < cashSvcs.length; w++) {
        const cur = this.cashBusy[w];
        if (cur && this.t >= cur.busyUntil) {
          this.cashBusy[w] = null;
          this.cashQueue.splice(this.cashQueue.indexOf(cur), 1);
          this.routeQueue(this.cashQueue, cashSvcs, L.CASH.queue);
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
      this.walkTo(p, this.L.DOOR, (pp) => {
        this.patients.splice(this.patients.indexOf(pp), 1);
      });
      const stay = this.t - p.arrivedAt;
      // 退院時の感情(体験の見える化): 待ちが短ければ笑顔、長ければ不満
      if (p.waitTotal <= 18) this.floats.push({ x: p.x, y: p.y - 0.6, text: '😊', t: 0 });
      else if (p.waitTotal > 45) this.floats.push({ x: p.x, y: p.y - 0.6, text: '💢', t: 0 });
      const report = { type: p.type, items: p.items, didReha: p.didReha, wait: p.waitTotal, stay, viaKiosk, seg: p.seg };
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
      const L = this.L;
      const ctx = iso.ctx;
      iso.begin();

      for (let y = 0; y < L.H; y++) {
        for (let x = 0; x < L.W; x++) {
          const z = L.ZONES.find((zz) => zz.need(s) && x >= zz.x0 && x <= zz.x1 && y >= zz.y0 && y <= zz.y1);
          let fill = z ? z.tint : '#F7FAFC';
          if ((x === L.DOOR.x || x === L.DOOR.x + 1) && y === L.DOOR.y) fill = '#C9D8E2';
          if (L.CORRIDOR.includes(y)) fill = '#F1F6F9';
          iso.diamond(x, y, 0, fill, 'rgba(62,124,166,0.10)');
        }
      }

      if (view.heat) {
        let max = 1;
        for (let i = 0; i < this.heat.length; i++) max = Math.max(max, this.heat[i]);
        for (let y = 0; y < L.H; y++) for (let x = 0; x < L.W; x++) {
          const v = this.heat[x + y * L.W];
          if (v <= 0.01) continue;
          const a = Math.min(0.72, Math.sqrt(v / max) * 0.8);
          iso.diamond(x, y, 0, `rgba(214,69,48,${a.toFixed(3)})`);
        }
      }

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

      const items = [];
      const boxItem = (x, y, w, d, h, c) => items.push({ depth: x + w / 2 + y + d / 2, draw: () => iso.box(x, y, w, d, h, c) });
      L.EXAM.forEach((e, i) => { if (i < s.doctors) boxItem(e.desk.x, e.desk.y, e.desk.w, e.desk.d, 0.55, '#C9A272'); });
      L.BEDS.forEach((b, i) => { if (i < s.beds) boxItem(b.bed.x, b.bed.y, 1, 1, 0.45, '#F2F6F8'); });
      L.MACHINES.forEach((m, i) => { if (i < s.machines) boxItem(m.m.x, m.m.y, 1, 1, 0.5, i < this.usableMachines() ? '#7FB8A2' : '#B9C6C0'); });
      for (let i = 0; i < Math.min(s.chairs, L.CHAIRS.length); i++) boxItem(L.CHAIRS[i].x, L.CHAIRS[i].y, 1, 1, 0.32, '#E4B968');
      boxItem(L.RECEP.counter.x, L.RECEP.counter.y, L.RECEP.counter.w, L.RECEP.counter.d, 0.7, '#6E9CBE');
      boxItem(L.CASH.counter.x, L.CASH.counter.y, L.CASH.counter.w, L.CASH.counter.d, 0.7, '#9C8FCB');
      if (s.kiosk) boxItem(L.CASH.kiosk.x, L.CASH.kiosk.y, 1, 1, 0.9, '#8FA8B8');

      // プレミアム施設(見た目のみ・導線には干渉しない)
      const deco = this.deco || {};
      const DECO_COLOR = { cafe: '#B98A5A', kids: '#F0A9A0', signage: '#8FA8B8', bus: '#7FB08A' };
      const DECO_H = { cafe: 0.65, kids: 0.35, signage: 1.0, bus: 0.8 };
      for (const key of Object.keys(L.DECO || {})) {
        if (!deco[key]) continue;
        const d = L.DECO[key];
        boxItem(d.x, d.y, d.w, 1, DECO_H[key], DECO_COLOR[key]);
      }

      for (let w = 0; w < this.recepWindows(); w++) {
        const sp = L.RECEP.staff[w];
        items.push({ depth: sp.x + sp.y, draw: () => iso.figure(sp.x, sp.y, '#FFFFFF', { coat: true, dot: this.recBusy[w] ? '#3E7CA6' : '#4FA98C' }) });
      }
      items.push({ depth: L.CASH.staff.x + L.CASH.staff.y, draw: () => iso.figure(L.CASH.staff.x, L.CASH.staff.y, '#FFFFFF', { coat: true, dot: this.cashBusy[0] ? '#3E7CA6' : '#4FA98C' }) });
      for (let d = 0; d < Math.min(s.doctors, L.EXAM.length); d++) {
        const sp = L.EXAM[d].doctor;
        items.push({ depth: sp.x + sp.y, draw: () => iso.figure(sp.x, sp.y, '#FFFFFF', { coat: true, dot: this.doctors[d].patient ? '#3E7CA6' : '#4FA98C' }) });
      }
      for (let n = 0; n < Math.min(s.nurses, 6); n++) {
        const sp = L.NURSE_ROW(n);
        items.push({ depth: sp.x + sp.y, draw: () => iso.figure(sp.x, sp.y, '#F4C8D4', { dot: this.bedUsed[n] ? '#3E7CA6' : '#4FA98C' }) });
      }
      for (let n = 0; n < Math.min(s.pts, this.L.PT_VIS || 12); n++) {
        const sp = L.PT_ROW(n);
        if (sp.x > L.W - 1) break;
        items.push({ depth: sp.x + sp.y, draw: () => iso.figure(sp.x, sp.y, '#BFE0D2', { dot: '#4FA98C' }) });
      }

      for (const p of this.patients) {
        const color = PHASE_COLORS[p.phase] || '#9AA7B0';
        items.push({ depth: p.x + p.y + 0.01, draw: () => iso.figure(p.x, p.y, color, { walking: p.path.length > 0 }) });
      }
      items.sort((a, b) => a.depth - b.depth);
      items.forEach((it) => it.draw());

      // 感情バブル: 30分以上待っている患者はもやもや、55分以上で怒り
      ctx.textAlign = 'center';
      for (const p of this.patients) {
        const waiting = p.phase === 'recepQ' || p.phase === 'waitExam' || p.phase === 'waitTreat' || p.phase === 'waitReha' || p.phase === 'cashQ';
        if (!waiting || p.waitTotal <= 30) continue;
        const pt = iso.p(p.x + 0.5, p.y + 0.3, 1.1);
        ctx.font = `${Math.max(10, iso.tw * 0.26)}px sans-serif`;
        ctx.globalAlpha = 0.92;
        ctx.fillText(p.waitTotal > 55 ? '💢' : '😮‍💨', pt.x, pt.y + Math.sin(iso.time / 320 + p.id) * 2);
        ctx.globalAlpha = 1;
      }

      for (const z of L.ZONES) {
        if (!z.need(s)) continue;
        iso.label((z.x0 + z.x1 + 1) / 2, (z.y0 + z.y1 + 1) / 2, z.label);
      }
      iso.label(L.DOOR.x + 1, L.DOOR.y + 0.5, '入口/出口');
      for (const key of Object.keys(L.DECO || {})) {
        if (!deco[key]) continue;
        const d = L.DECO[key];
        iso.label(d.x + d.w / 2, d.y + 0.5, d.label);
      }

      for (let i = this.floats.length - 1; i >= 0; i--) {
        const f = this.floats[i];
        f.t += 0.016;
        if (f.t >= 1) { this.floats.splice(i, 1); continue; }
        iso.floatText(f.x, f.y, f.text, '#3A8A70', f.t);
      }
    }
  }

  return { ClinicSim, PHASE_COLORS, LAYOUTS };
})();
