/* クリニックタウン3D — タウンマップ
 * 商圏の街。住民が道を歩き、認知した家から患者がクリニックへ向かう。
 * 建物クリックで営業アクション(game.js が処理)。
 */

'use strict';

const TOWN = (() => {
  const W = 24, H = 18;

  // 道路(タイル集合)
  const ROADS = new Set();
  const addRoad = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) ROADS.add(`${x},${y}`); };
  addRoad(0, 8, 23, 9);    // メインストリート
  addRoad(11, 0, 12, 8);   // 駅前通り
  addRoad(0, 14, 23, 14);  // 住宅街の通り
  addRoad(4, 9, 4, 14);    // 西の連絡路
  addRoad(19, 9, 19, 14);  // 東の連絡路

  const CLINIC_ENTRANCE = { x: 8, y: 9 };
  const RIVAL_ENTRANCE = { x: 20, y: 8 };
  const STATION_EXIT = { x: 11, y: 3 };
  const HOSPITAL_EXIT = { x: 4, y: 8 };

  // 建物
  const BUILDINGS = [
    { id: 'clinic', label: 'あなたのクリニック', x: 6, y: 10, w: 4, d: 3, h: 1.5, wall: '#FFFFFF', roof: '#4FA98C', mine: true },
    { id: 'rival', label: 'ライバル整形外科', x: 18, y: 5, w: 4, d: 3, h: 1.6, wall: '#F4EFE7', roof: '#B08A5A', action: true },
    { id: 'hospital', label: '市民総合病院', x: 0, y: 0, w: 5, d: 5, h: 3.2, wall: '#EDF3F7', roof: '#8FA8B8', action: true },
    { id: 'station', label: '駅', x: 8, y: 0, w: 3, d: 3, h: 2.0, wall: '#E7E2D8', roof: '#7B8A94', action: true },
    { id: 'company', label: '運送会社', x: 15, y: 0, w: 3, d: 3, h: 2.6, wall: '#E3E9EE', roof: '#6E7F8C', action: true },
    { id: 'caremane', label: 'ケアマネ事業所', x: 21, y: 11, w: 2, d: 2, h: 1.2, wall: '#FBF4E4', roof: '#C98A2D', action: true },
    { id: 'pharmacy', label: '薬局', x: 1, y: 10, w: 2, d: 2, h: 1.1, wall: '#FFFFFF', roof: '#7FB8A2' },
    { id: 'shop1', label: '', x: 6, y: 6, w: 2, d: 1, h: 1.1, wall: '#F6EFE2', roof: '#A9927B' },
    { id: 'shop2', label: '', x: 3, y: 6, w: 2, d: 1, h: 1.2, wall: '#EFE7DC', roof: '#8B9DA8' },
    { id: 'shop3', label: '', x: 14, y: 6, w: 2, d: 1, h: 1.1, wall: '#F2EBDE', roof: '#B08A5A' },
    { id: 'shop4', label: '', x: 0, y: 6, w: 2, d: 1, h: 1.0, wall: '#F6EFE2', roof: '#7B8A94' }
  ];

  // 住宅(認知が広がる対象)。weight = 世帯数の重み
  const HOUSES = [
    { x: 1, y: 15, weight: 1 }, { x: 3, y: 15, weight: 1 }, { x: 5, y: 15, weight: 1 },
    { x: 7, y: 15, weight: 1 }, { x: 9, y: 15, weight: 1 }, { x: 11, y: 15, weight: 1 },
    { x: 13, y: 15, weight: 1 }, { x: 18, y: 15, weight: 1 }, { x: 20, y: 15, weight: 1 },
    { x: 22, y: 15, weight: 1 },
    { x: 15, y: 15, weight: 6, mansion: true },   // マンション
    { x: 21, y: 5, weight: 1 }, { x: 21, y: 3, weight: 1 },
    { x: 6, y: 3, weight: 1 }, { x: 6, y: 5, weight: 1 }, { x: 14, y: 3, weight: 1 }
  ];
  // 認知が広がる順(固定シャッフル)
  const AWARE_ORDER = [10, 3, 7, 0, 13, 5, 11, 1, 8, 15, 2, 9, 14, 4, 12, 6];
  const TOTAL_HOUSEHOLDS = HOUSES.reduce((a, h) => a + h.weight, 0); // 21

  const TREES = [
    { x: 5, y: 1 }, { x: 13, y: 1 }, { x: 22, y: 1 }, { x: 9, y: 6 }, { x: 17, y: 7 },
    { x: 2, y: 12 }, { x: 10, y: 12 }, { x: 14, y: 11 }, { x: 17, y: 12 }, { x: 0, y: 16 },
    { x: 16, y: 17 }, { x: 23, y: 16 }, { x: 6, y: 17 }, { x: 23, y: 5 }
  ];

  const BILLBOARD = { x: 13, y: 4 }; // 駅前看板(購入後に出現)

  // 徒歩用: 道路以外を塞ぐ
  const NOT_ROAD = new Set();
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!ROADS.has(`${x},${y}`)) NOT_ROAD.add(`${x},${y}`);

  function nearestRoad(x, y) {
    let best = null, bd = Infinity;
    ROADS.forEach((k) => {
      const [rx, ry] = k.split(',').map(Number);
      const d = Math.abs(rx - x) + Math.abs(ry - y);
      if (d < bd) { bd = d; best = { x: rx, y: ry }; }
    });
    return best;
  }

  // 分院の建設地(siteId → 位置)
  const BRANCH_SPOTS = {
    kita: { x: 12, y: 11, w: 2, d: 2, h: 1.3, label: '北口クリニック' },
    minami: { x: 2, y: 16, w: 2, d: 2, h: 1.3, label: '南町クリニック' },
    tonari: { x: 20, y: 16, w: 2, d: 2, h: 1.5, label: '隣駅クリニック' }
  };

  class TownSim {
    constructor(hooks) {
      this.hooks = hooks; // { onPatientArrive(walker) }
      this.walkers = [];  // {x,y,path,color,kind,type,refer}
      this.ambientTimer = 0;
      this.rivalTimer = 3;
      this.branchBuildings = [];
    }

    setBranches(siteIds) {
      this.branchBuildings = (siteIds || []).filter((id) => BRANCH_SPOTS[id]).map((id) => {
        const sp = BRANCH_SPOTS[id];
        return { id: 'br_' + id, label: sp.label, x: sp.x, y: sp.y, w: sp.w, d: sp.d, h: sp.h, wall: '#FFFFFF', roof: '#4FA98C', mine: true, action: true };
      });
    }

    // 患者トリップ: source: 'house' | 'station' | 'hospital' | 'caremane'
    requestVisit(type, source, refer) {
      let from;
      if (source === 'station') from = STATION_EXIT;
      else if (source === 'hospital') from = HOSPITAL_EXIT;
      else if (source === 'caremane') from = nearestRoad(21, 11);
      else {
        const h = HOUSES[AWARE_ORDER[Math.floor(Math.random() * Math.min(AWARE_ORDER.length, Math.max(1, this._awareHouseCount())))]];
        from = nearestRoad(h.x, h.y);
      }
      const colorByType = { first: '#3E7CA6', revisit: '#6E9CBE', rehab: '#4FA98C', checkup: '#C98A2D' };
      this.walkers.push({
        x: from.x, y: from.y,
        path: astarGrid(W, H, NOT_ROAD, from, CLINIC_ENTRANCE),
        color: refer ? '#8C7BC4' : (colorByType[type] || '#3E7CA6'),
        kind: 'patient', type, refer: !!refer
      });
    }

    setAwareness(rate) { this.awareRate = rate; } // 0..1(gameから)

    _awareHouseCount() {
      // awareRate に応じて何軒目まで認知済みか
      let acc = 0, n = 0;
      const target = (this.awareRate || 0) * TOTAL_HOUSEHOLDS;
      for (const i of AWARE_ORDER) {
        if (acc >= target) break;
        acc += HOUSES[i].weight;
        n++;
      }
      return n;
    }

    isAware(houseIdx) {
      const n = this._awareHouseCount();
      return AWARE_ORDER.indexOf(houseIdx) < n;
    }

    tick(dt) {
      // 患者・住民の徒歩
      const speed = 6.5; // タイル/分(街スケール)
      for (let i = this.walkers.length - 1; i >= 0; i--) {
        const wk = this.walkers[i];
        if (!wk.path.length) {
          if (wk.kind === 'patient' && this.hooks.onPatientArrive) this.hooks.onPatientArrive(wk);
          this.walkers.splice(i, 1);
          continue;
        }
        const wp = wk.path[0];
        const dx = wp.x - wk.x, dy = wp.y - wk.y;
        const dist = Math.hypot(dx, dy);
        const step = speed * dt;
        if (dist <= step) { wk.x = wp.x; wk.y = wp.y; wk.path.shift(); }
        else { wk.x += dx / dist * step; wk.y += dy / dist * step; }
      }

      // 環境の通行人
      this.ambientTimer -= dt;
      if (this.ambientTimer <= 0 && this.walkers.length < 26) {
        this.ambientTimer = triRand(0.5, 2.2);
        const keys = [...ROADS];
        const a = keys[Math.floor(Math.random() * keys.length)].split(',').map(Number);
        const b = keys[Math.floor(Math.random() * keys.length)].split(',').map(Number);
        this.walkers.push({
          x: a[0], y: a[1],
          path: astarGrid(W, H, NOT_ROAD, { x: a[0], y: a[1] }, { x: b[0], y: b[1] }),
          color: '#C3CDD4', kind: 'ambient'
        });
      }

      // ライバルへの人流(雰囲気)
      this.rivalTimer -= dt;
      if (this.rivalTimer <= 0) {
        this.rivalTimer = triRand(3, 8);
        const h = HOUSES[Math.floor(Math.random() * HOUSES.length)];
        const from = nearestRoad(h.x, h.y);
        this.walkers.push({
          x: from.x, y: from.y,
          path: astarGrid(W, H, NOT_ROAD, from, RIVAL_ENTRANCE),
          color: '#C8B79E', kind: 'rival'
        });
      }
    }

    buildingAt(tile) {
      const withDoor = (b) => tile.x >= b.x - 1 && tile.x <= b.x + b.w && tile.y >= b.y - 1 && tile.y <= b.y + b.d;
      return this.branchBuildings.find(withDoor) || BUILDINGS.find((b) => (b.action || b.mine) && withDoor(b)) || null;
    }

    draw(iso, state) {
      // state: { billboard, hospitalTie, caremaneTie, companyTie, listing, tutorialTarget }
      iso.begin();
      const ctx = iso.ctx;

      // 地面
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          const isRoad = ROADS.has(`${x},${y}`);
          iso.diamond(x, y, 0, isRoad ? '#DCE3E8' : '#E9F1E6', 'rgba(90,120,100,0.08)');
        }
      }
      // 横断歩道風マーク(クリニック前)
      ctx.fillStyle = 'rgba(255,255,255,0.65)';
      for (let i = 0; i < 3; i++) {
        const c = iso.p(CLINIC_ENTRANCE.x + 0.2 + i * 0.3, CLINIC_ENTRANCE.y + 0.35, 0);
        ctx.beginPath();
        ctx.ellipse(c.x, c.y, iso.tw * 0.05, iso.tw * 0.028, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      const items = [];

      // 建物(本院・施設・分院)
      for (const b of [...BUILDINGS, ...this.branchBuildings]) {
        items.push({
          depth: b.x + b.w / 2 + b.y + b.d / 2,
          draw: () => {
            iso.building(b.x, b.y, b.w, b.d, b.h, b.wall, b.roof);
            if (b.mine) {
              // 自院マーク(十字)
              const c = iso.p(b.x + b.w / 2, b.y + b.d / 2, b.h + Math.min(b.w, b.d) * 0.5 + 0.35);
              ctx.fillStyle = '#4FA98C';
              const s = iso.tw * 0.09;
              ctx.fillRect(c.x - s * 0.32, c.y - s, s * 0.64, s * 2);
              ctx.fillRect(c.x - s, c.y - s * 0.32, s * 2, s * 0.64);
            }
          }
        });
      }

      // 住宅
      HOUSES.forEach((h, i) => {
        const aware = this.isAware(i);
        const w = h.mansion ? 2 : 1, d = h.mansion ? 2 : 1, hh = h.mansion ? 2.4 : 0.9;
        items.push({
          depth: h.x + w / 2 + h.y + d / 2,
          draw: () => {
            iso.building(h.x, h.y, w, d, hh, aware ? '#FFFFFF' : '#EFEBE3', aware ? '#6FAE93' : '#C9C2B4');
            if (aware) {
              const c = iso.p(h.x + w / 2, h.y + d / 2, hh + Math.min(w, d) * 0.5 + 0.3);
              ctx.fillStyle = '#3A8A70';
              ctx.font = `800 ${Math.max(9, iso.tw * 0.17)}px 'Inter',sans-serif`;
              ctx.textAlign = 'center';
              ctx.fillText('✓', c.x, c.y);
            }
          }
        });
      });

      // 木
      for (const t of TREES) {
        items.push({
          depth: t.x + t.y,
          draw: () => {
            iso.box(t.x + 0.38, t.y + 0.38, 0.24, 0.24, 0.5, '#A98B6B');
            iso.box(t.x + 0.15, t.y + 0.15, 0.7, 0.7, 0.55, '#7FB88F');
          }
        });
      }

      // 駅前看板(購入後)
      if (state.billboard) {
        items.push({
          depth: BILLBOARD.x + BILLBOARD.y,
          draw: () => {
            iso.box(BILLBOARD.x + 0.42, BILLBOARD.y + 0.42, 0.16, 0.16, 1.1, '#8A9AA6');
            iso.box(BILLBOARD.x - 0.15, BILLBOARD.y + 0.1, 1.3, 0.14, 0.75, '#4FA98C');
            const c = iso.p(BILLBOARD.x + 0.5, BILLBOARD.y + 0.2, 1.35);
            ctx.fillStyle = '#fff';
            ctx.font = `800 ${Math.max(8, iso.tw * 0.14)}px 'Noto Sans JP',sans-serif`;
            ctx.textAlign = 'center';
            ctx.fillText('🏥 広告', c.x, c.y);
          }
        });
      }

      // 歩行者
      for (const wk of this.walkers) {
        items.push({
          depth: wk.x + wk.y + 0.01,
          draw: () => iso.figure(wk.x, wk.y, wk.color, { walking: true, scale: 0.8 })
        });
      }

      items.sort((a, b) => a.depth - b.depth);
      items.forEach((it) => it.draw());

      // ラベル(主要施設のみ)
      for (const b of [...BUILDINGS, ...this.branchBuildings]) {
        if (!b.label) continue;
        const tie = (b.id === 'hospital' && state.hospitalTie) || (b.id === 'caremane' && state.caremaneTie) || (b.id === 'company' && state.companyTie);
        iso.label(b.x + b.w / 2, b.y + b.d / 2 + 0.4, (tie ? '🤝 ' : '') + b.label, {
          z: 0,
          size: 0.16,
          ring: b.mine ? '#4FA98C' : (b.action ? 'rgba(62,124,166,0.45)' : null),
          color: b.mine ? '#3A8A70' : '#2C5F82'
        });
      }

      // リスティング広告の電波(演出)
      if (state.listing > 0) {
        const c = iso.p(8, 11.5, 2.4);
        const r = (this.awareRate || 0);
        ctx.strokeStyle = `rgba(62,124,166,${0.25 + 0.2 * Math.sin(iso.time * 0.004)})`;
        ctx.lineWidth = 1.5;
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.arc(c.x, c.y, i * 9 + (iso.time * 0.02 % 9), -Math.PI * 0.85, -Math.PI * 0.15);
          ctx.stroke();
        }
      }
    }
  }

  return { W, H, TownSim, TOTAL_HOUSEHOLDS, CLINIC_ENTRANCE };
})();
