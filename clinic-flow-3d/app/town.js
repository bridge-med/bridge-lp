/* クリニックタウン3D — タウンマップ
 * 商圏の街。住民が道を歩き、認知した家から患者がクリニックへ向かう。
 * 建物クリックで営業アクション(game.js が処理)。
 */

'use strict';

const TOWN = (() => {
  const W = 30, H = 20;

  // 道路(タイル集合)
  const ROADS = new Set();
  const addRoad = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) ROADS.add(`${x},${y}`); };
  addRoad(0, 8, 29, 9);    // メインストリート
  addRoad(11, 0, 12, 8);   // 駅前通り
  addRoad(0, 14, 29, 14);  // 住宅街の通り
  addRoad(4, 9, 4, 14);    // 西の連絡路
  addRoad(19, 9, 19, 14);  // 東の連絡路
  addRoad(25, 2, 25, 8);   // 東の新市街通り
  addRoad(0, 16, 29, 16);  // 南の住宅街の通り
  addRoad(11, 14, 11, 16); // 南の連絡路

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
    { id: 'pharmacy', label: '薬局', x: 1, y: 10, w: 2, d: 2, h: 1.1, wall: '#FFFFFF', roof: '#7FB8A2', action: true },
    { id: 'houkatsu', label: '地域包括支援センター', x: 22, y: 0, w: 3, d: 2, h: 1.4, wall: '#F3F6EF', roof: '#7FB8A2', action: true },
    { id: 'shop1', label: '', x: 6, y: 6, w: 2, d: 1, h: 1.1, wall: '#F6EFE2', roof: '#A9927B' },
    { id: 'shop2', label: '', x: 3, y: 6, w: 2, d: 1, h: 1.2, wall: '#EFE7DC', roof: '#8B9DA8' },
    { id: 'shop3', label: '', x: 14, y: 6, w: 2, d: 1, h: 1.1, wall: '#F2EBDE', roof: '#B08A5A' },
    { id: 'shop4', label: '', x: 0, y: 6, w: 2, d: 1, h: 1.0, wall: '#F6EFE2', roof: '#7B8A94' },
    { id: 'shoutengai', label: '商店街組合', x: 9, y: 6, w: 2, d: 1, h: 1.15, wall: '#FBF4E4', roof: '#C98A2D', action: true },
    { id: 'school', label: '高校', x: 26, y: 0, w: 4, d: 3, h: 2.2, wall: '#F0EDE6', roof: '#8B9DA8', action: true },
    { id: 'sports', label: 'スポーツクラブ', x: 26, y: 5, w: 3, d: 3, h: 1.8, wall: '#E8F0EC', roof: '#4FA98C', action: true },
    { id: 'rouken', label: '老健施設', x: 26, y: 11, w: 4, d: 3, h: 1.9, wall: '#FBF7EE', roof: '#B08A5A', action: true }
  ];

  // 住宅(認知が広がる対象)。weight = 世帯数の重み
  const HOUSES = [
    { x: 1, y: 15, weight: 1 }, { x: 3, y: 15, weight: 1 }, { x: 5, y: 15, weight: 1 },
    { x: 7, y: 15, weight: 1 }, { x: 9, y: 15, weight: 1 }, { x: 24, y: 15, weight: 1 },
    { x: 13, y: 15, weight: 1 }, { x: 18, y: 15, weight: 1 }, { x: 20, y: 15, weight: 1 },
    { x: 22, y: 15, weight: 1 },
    { x: 15, y: 15, weight: 6, mansion: true },   // マンション(足元2x1)
    { x: 19, y: 3, weight: 1 }, { x: 21, y: 3, weight: 1 },
    // (6,5)はshop1(6,6)と辺で接し屋根が融合して見えた(保留#17)。(19,1)へ移設(v46) —
    // 北の住宅ペア(19,3)(21,3)の縦2タイルピッチに合流し全周1タイル以上空く(機械探索で確認)。
    // 空いた(6,5)は埋めない(余白の原則)
    { x: 6, y: 3, weight: 1 }, { x: 19, y: 1, weight: 1 }, { x: 14, y: 3, weight: 1 },
    // 南の新しい住宅街
    { x: 1, y: 17, weight: 1 }, { x: 3, y: 17, weight: 1 }, { x: 8, y: 17, weight: 1 },
    { x: 10, y: 17, weight: 1 }, { x: 13, y: 17, weight: 1 }, { x: 15, y: 17, weight: 1 },
    { x: 17, y: 17, weight: 1 }, { x: 21, y: 17, weight: 1 },
    { x: 27, y: 17, weight: 6, mansion: true }    // 東のマンション
  ];
  // 認知が広がる順(固定シャッフル)
  const AWARE_ORDER = [10, 3, 7, 0, 24, 13, 5, 18, 11, 1, 21, 8, 15, 16, 2, 9, 23, 14, 4, 19, 12, 6, 22, 17, 20];
  const TOTAL_HOUSEHOLDS = HOUSES.reduce((a, h) => a + h.weight, 0); // 35

  const TREES = [
    { x: 5, y: 1 }, { x: 13, y: 1 }, { x: 24, y: 2 }, { x: 17, y: 7 },
    { x: 2, y: 12 }, { x: 10, y: 12 }, { x: 14, y: 11 }, { x: 17, y: 12 },
    { x: 16, y: 17 }, { x: 23, y: 5 }, { x: 24, y: 12 }, { x: 29, y: 18 },
    { x: 5, y: 19 }, { x: 12, y: 18 }, { x: 18, y: 19 }, { x: 24, y: 4 }, { x: 22, y: 19 }
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
    minami: { x: 5, y: 17, w: 2, d: 2, h: 1.3, label: '南町クリニック' },
    tonari: { x: 24, y: 17, w: 2, d: 2, h: 1.5, label: '隣駅クリニック' }
  };

  // 診療科部門の建設地(部門id → 位置)。在宅(homecare)は本院発なので建物を持たない
  const DEPT_SPOTS = {
    internal: { x: 15, y: 10, w: 2, d: 2, h: 1.3, label: '内科クリニック' },
    ophthalmology: { x: 16, y: 3, w: 2, d: 2, h: 1.3, label: '眼科クリニック' },
    dialysis: { x: 23, y: 6, w: 2, d: 2, h: 1.4, label: '透析クリニック' },
    psychiatry: { x: 9, y: 3, w: 2, d: 2, h: 1.3, label: 'メンタルクリニック' }
  };

  // 在宅患者の地区(戸建ての集まり)。訪問診療部門があるときだけ患者数に応じて描く。
  // mansion付きの地区は既存の環境建物(マンション)を訪問先として使う=同一建物。
  // 戸建てをその座標に描き足さない(v50。屋根融合の禁止=間合いルール)。unitsは戸数(ゲーム上の仮定)
  const HOMECARE_SITES = [
    { x: 6, y: 4 }, { x: 21, y: 4 }, { x: 27, y: 3 }, { x: 1, y: 5 },
    { x: 2, y: 7 }, { x: 13, y: 10 }, { x: 24, y: 10 }, { x: 8, y: 13 },
    { x: 16, y: 13 }, { x: 9, y: 18 }, { x: 18, y: 18 }, { x: 27, y: 19 },
    { x: 15, y: 15, mansion: true, units: 24 }, { x: 27, y: 17, mansion: true, units: 24 }
  ];

  class TownSim {
    constructor(hooks) {
      this.hooks = hooks; // { onPatientArrive(walker) }
      this.walkers = [];  // {x,y,path,color,kind,type,refer}
      this.ambientTimer = 0;
      this.rivalTimer = 3;
      this.branchBuildings = [];
      this.deptBuildings = [];
    }

    setBranches(siteIds) {
      this.branchBuildings = (siteIds || []).filter((id) => BRANCH_SPOTS[id]).map((id) => {
        const sp = BRANCH_SPOTS[id];
        return { id: 'br_' + id, label: sp.label, x: sp.x, y: sp.y, w: sp.w, d: sp.d, h: sp.h, wall: '#FFFFFF', roof: '#4FA98C', mine: true, action: true };
      });
    }

    setDepts(deptIds) {
      this.deptBuildings = (deptIds || []).filter((id) => DEPT_SPOTS[id]).map((id) => {
        const sp = DEPT_SPOTS[id];
        return { id: 'dept_' + id, label: sp.label, x: sp.x, y: sp.y, w: sp.w, d: sp.d, h: sp.h, wall: '#FFFFFF', roof: '#4FA98C', mine: true, action: true };
      });
    }

    // 在宅: 地区ごとの患者数と今日のルート(地区indexの列)。nullで非表示
    setHomecare(state) {
      this.homecare = state;
      this._hcPath = null; // ルート線は日替わり。キャッシュを破棄
    }

    // 患者トリップ: source: 'house' | 'station' | 'hospital' | 'caremane'
    requestVisit(type, source, refer, seg) {
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
        kind: 'patient', type, refer: !!refer, seg
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
      return this.branchBuildings.find(withDoor) || (this.deptBuildings || []).find(withDoor) || BUILDINGS.find((b) => (b.action || b.mine) && withDoor(b)) || null;
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

      // 在宅の訪問ルート: 自院から出て患者宅の地区を回り自院へ戻る閉じた線。
      // 進んだ分は実線・残りは点線(進み具合はstate.hcProgress 0..1)
      if (this.homecare && this.homecare.route && this.homecare.route.length) {
        if (!this._hcPath) {
          const stops = [CLINIC_ENTRANCE,
            ...this.homecare.route.map((i) => nearestRoad(HOMECARE_SITES[i].x, HOMECARE_SITES[i].y)),
            CLINIC_ENTRANCE];
          const path = [];
          for (let i = 0; i < stops.length - 1; i++) {
            path.push(stops[i], ...astarGrid(W, H, NOT_ROAD, stops[i], stops[i + 1]));
          }
          this._hcPath = path;
        }
        const hp = this._hcPath;
        const cut = Math.max(1, Math.floor(hp.length * Math.min(1, state.hcProgress || 0)));
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#2C5F82';
        const seg = (from, to, dash) => {
          if (to - from < 1) return;
          ctx.setLineDash(dash);
          ctx.beginPath();
          for (let i = from; i <= to; i++) {
            const p = iso.p(hp[i].x + 0.5, hp[i].y + 0.5, 0.02);
            if (i === from) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
          }
          ctx.stroke();
        };
        seg(0, cut, []);
        seg(cut, hp.length - 1, [4, 4]);
        // 道路から患者宅へのスパー(線が家に届いて、街と診療が交差する)
        for (const ci of this.homecare.route) {
          const s = HOMECARE_SITES[ci];
          const road = nearestRoad(s.x, s.y);
          const idx = hp.findIndex((t) => t.x === road.x && t.y === road.y);
          ctx.setLineDash(idx >= 0 && idx <= cut ? [] : [4, 4]);
          const a = iso.p(road.x + 0.5, road.y + 0.5, 0.02);
          const b = iso.p(s.x + 0.5, s.y + 0.5, 0.02);
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        }
        ctx.setLineDash([]);
      }

      const items = [];

      // 在宅患者の地区(患者がいる所だけ小さな家として描く。個別メッシュ化しない)。
      // 屋根は常に紫(紹介由来の患者の色)。「今日回る」は建物の色ではなく藍のリングと線で言う
      if (this.homecare && this.homecare.clusters) {
        HOMECARE_SITES.forEach((s, i) => {
          const n = this.homecare.clusters[i] || 0;
          if (!n) return;
          const onRoute = (this.homecare.route || []).includes(i);
          items.push({
            depth: s.x + s.y,
            draw: () => {
              // マンション地区は既存の環境建物をそのまま訪問先にする(描き足すと屋根が融合する)。
              // 患者の所在はルートのリングだけで言う
              if (!s.mansion) iso.building(s.x, s.y, 1, 1, 0.8, '#FBF7EE', '#8C7BC4');
              if (onRoute) {
                const c = iso.p(s.x + 0.5, s.y + 0.5, 0);
                ctx.strokeStyle = 'rgba(44,95,130,0.9)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.ellipse(c.x, c.y, iso.tw * 0.42, iso.tw * 0.21, 0, 0, Math.PI * 2);
                ctx.stroke();
              }
            }
          });
        });
      }

      // 建物(本院・施設・分院)
      for (const b of [...BUILDINGS, ...this.branchBuildings, ...(this.deptBuildings || [])]) {
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
        const w = h.mansion ? 2 : 1, d = 1, hh = h.mansion ? 2.4 : 0.9;
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
      for (const b of [...BUILDINGS, ...this.branchBuildings, ...(this.deptBuildings || [])]) {
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

  return { W, H, TownSim, TOTAL_HOUSEHOLDS, CLINIC_ENTRANCE, ROADS, BUILDINGS, HOUSES, TREES, BILLBOARD, HOMECARE_SITES, DEPT_SPOTS, BRANCH_SPOTS };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = TOWN;
