/* ================= 🚶 3D視察モード =================
 * Three.js でクリニックを実寸3D化し、一人称で歩いて視察する。
 * シム(clinic)の状態をそのまま毎フレーム反映するので、
 * 経営画面で起きていることが「現場」として見える。
 * 操作: WASD/矢印=移動, ドラッグ=見回す, タップ=声かけ/采配,
 *       スマホは左下ジョイスティック。Esc/✕で退出。
 */
(function () {
  'use strict';

  const SEG_HAIR3 = { senior: 0xE3DED2, worker: 0x4A3B2E, sports: 0xB5651D };
  const PHASE_COL3 = {
    walk: 0x9AA7B0, recepQ: 0xC98A2D, recep: 0xC98A2D,
    waitExam: 0x3E7CA6, exam: 0x2C5F82,
    treat: 0xC4574E, waitTreat: 0x3E7CA6,
    reha: 0x4FA98C, waitReha: 0x3E7CA6,
    cashQ: 0xC98A2D, cash: 0x8C7BC4
  };

  class Walk3D {
    constructor(clinic, hooks) {
      if (!window.THREE) throw new Error('THREE not loaded');
      this.clinic = clinic;
      this.hooks = hooks || {};
      this.active = false;
      this.built = false;
      this.patMeshes = new Map(); // patient id -> group
      this.mats = new Map();
      this.geos = null;
      this.emojiTex = new Map();
      this.keys = {};
      this.yaw = 0; // 入口から院内(-z方向)を向く
      this.pitch = -0.05;
      this.stick = { on: false, dx: 0, dy: 0 };
      this.staticSig = '';
      this.colliders = [];
      this._raf = null;
      this._lastTs = 0;
    }

    /* ---------- 素材 ---------- */
    mat(hex) {
      if (!this.mats.has(hex)) this.mats.set(hex, new THREE.MeshLambertMaterial({ color: hex }));
      return this.mats.get(hex);
    }

    ensureGeos() {
      if (this.geos) return;
      this.geos = {
        legs: new THREE.CylinderGeometry(0.13, 0.15, 0.5, 8),
        torso: new THREE.CylinderGeometry(0.2, 0.23, 0.62, 10),
        head: new THREE.SphereGeometry(0.17, 12, 10),
        hair: new THREE.SphereGeometry(0.178, 12, 8),
        dot: new THREE.SphereGeometry(0.055, 8, 6),
        box: new THREE.BoxGeometry(1, 1, 1)
      };
    }

    labelSprite(text, opts) {
      const o = opts || {};
      const cv = document.createElement('canvas');
      const ctx = cv.getContext('2d');
      ctx.font = '700 30px sans-serif';
      const w = Math.min(480, Math.max(120, ctx.measureText(text).width + 46));
      cv.width = w; cv.height = 64;
      const c2 = cv.getContext('2d');
      c2.fillStyle = o.bg || 'rgba(255,255,255,0.93)';
      c2.strokeStyle = o.border || 'rgba(91,103,112,0.35)';
      c2.lineWidth = 3;
      const r = 18;
      c2.beginPath();
      c2.moveTo(r, 2); c2.lineTo(w - r, 2); c2.arcTo(w - 2, 2, w - 2, r, r);
      c2.lineTo(w - 2, 64 - r); c2.arcTo(w - 2, 62, w - r, 62, r);
      c2.lineTo(r, 62); c2.arcTo(2, 62, 2, 64 - r, r);
      c2.lineTo(2, r); c2.arcTo(2, 2, r, 2, r);
      c2.closePath(); c2.fill(); c2.stroke();
      c2.fillStyle = o.color || '#40525E';
      c2.font = '700 30px sans-serif';
      c2.textAlign = 'center'; c2.textBaseline = 'middle';
      c2.fillText(text, w / 2, 34);
      const tex = new THREE.CanvasTexture(cv);
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
      const scale = o.scale || 1;
      sp.scale.set((w / 64) * 0.55 * scale, 0.55 * scale, 1);
      return sp;
    }

    emojiSprite(emoji) {
      if (!this.emojiTex.has(emoji)) {
        const cv = document.createElement('canvas');
        cv.width = 64; cv.height = 64;
        const c = cv.getContext('2d');
        c.font = '46px sans-serif';
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(emoji, 32, 36);
        this.emojiTex.set(emoji, new THREE.CanvasTexture(cv));
      }
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.emojiTex.get(emoji), transparent: true }));
      sp.scale.set(0.5, 0.5, 1);
      return sp;
    }

    makeFigure(bodyHex, o) {
      o = o || {};
      this.ensureGeos();
      const g = new THREE.Group();
      const legs = new THREE.Mesh(this.geos.legs, this.mat(o.pants || 0x6B7A85));
      legs.position.y = 0.25;
      const torso = new THREE.Mesh(this.geos.torso, this.mat(bodyHex));
      torso.position.y = 0.81;
      const head = new THREE.Mesh(this.geos.head, this.mat(0xF2C9A0));
      head.position.y = 1.32;
      g.add(legs, torso, head);
      if (o.hair !== undefined) {
        const hair = new THREE.Mesh(this.geos.hair, this.mat(o.hair));
        hair.position.y = 1.37;
        hair.scale.set(1, 0.72, 1);
        g.add(hair);
      }
      if (o.dot !== undefined) {
        const dot = new THREE.Mesh(this.geos.dot, this.mat(o.dot));
        dot.position.set(0, 1.02, 0.2);
        g.add(dot);
      }
      g.userData.torso = torso;
      return g;
    }

    addBox(parent, x0, z0, w, d, h, hex, opts) {
      const m = new THREE.Mesh(this.geos ? this.geos.box : new THREE.BoxGeometry(1, 1, 1), this.mat(hex));
      m.scale.set(w, h, d);
      m.position.set(x0 + w / 2, h / 2, z0 + d / 2);
      parent.add(m);
      if (!opts || !opts.noCollide) this.colliders.push({ x0: x0 - 0.22, z0: z0 - 0.22, x1: x0 + w + 0.22, z1: z0 + d + 0.22 });
      return m;
    }

    /* ---------- シーン構築 ---------- */

    buildRenderer() {
      const ov = document.createElement('div');
      ov.className = 'walk-ov';
      ov.innerHTML = `
        <div class="walk-hud-top">
          <div class="walk-info" id="walkInfo"></div>
          <button class="walk-exit" id="walkExit">✕ 視察を終える</button>
        </div>
        <div class="walk-hint">🕹 移動: 左スティック/WASD ・ 見回す: ドラッグ ・ 患者/受付をタップで声かけ・采配</div>
        <div class="walk-stick" id="walkStick"><div class="walk-knob" id="walkKnob"></div></div>`;
      this.ov = ov;
      document.body.appendChild(ov);
      this.renderer = new THREE.WebGLRenderer({ antialias: true });
      this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
      this.renderer.domElement.className = 'walk-canvas';
      ov.insertBefore(this.renderer.domElement, ov.firstChild);
      this.camera = new THREE.PerspectiveCamera(72, 1, 0.1, 140);
      this.camera.rotation.order = 'YXZ';
      this.scene = new THREE.Scene();
      this.scene.background = new THREE.Color(0xDCEAF2);
      this.scene.fog = new THREE.Fog(0xDCEAF2, 34, 90);
      const hemi = new THREE.HemisphereLight(0xFFFFFF, 0xCFC4B2, 0.95);
      const dir = new THREE.DirectionalLight(0xFFF4E0, 0.5);
      dir.position.set(12, 20, 8);
      this.scene.add(hemi, dir);
      this.staticGroup = new THREE.Group();
      this.staffGroup = new THREE.Group();
      this.patGroup = new THREE.Group();
      this.scene.add(this.staticGroup, this.staffGroup, this.patGroup);
      this.ray = new THREE.Raycaster();
      this.bindControls();
    }

    stateSig() {
      const s = this.clinic.s;
      const deco = (this.hooks.getDeco && this.hooks.getDeco()) || {};
      return [s.floorLv, s.doctors, s.nurses, s.pts, s.receptionists, s.chairs, s.beds, s.machines,
        s.kiosk, s.cashHelper, s.rehaLevel, Object.keys(deco).filter((k) => deco[k]).join('.')].join('|');
    }

    buildStatic() {
      const L = this.clinic.L;
      const s = this.clinic.s;
      const deco = (this.hooks.getDeco && this.hooks.getDeco()) || {};
      this.ensureGeos();
      // clear
      while (this.staticGroup.children.length) this.staticGroup.remove(this.staticGroup.children[0]);
      while (this.staffGroup.children.length) this.staffGroup.remove(this.staffGroup.children[0]);
      this.colliders = [];
      this.staffTappable = [];
      const G3 = this.staticGroup;

      // 地面(外周)と床
      const ground = new THREE.Mesh(new THREE.PlaneGeometry(240, 240), this.mat(0xC5D4BE));
      ground.rotation.x = -Math.PI / 2;
      ground.position.set(L.W / 2, -0.02, L.H / 2);
      G3.add(ground);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(L.W, L.H), this.mat(0xF3F0E8));
      floor.rotation.x = -Math.PI / 2;
      floor.position.set(L.W / 2, 0, L.H / 2);
      G3.add(floor);
      const grid = new THREE.GridHelper(Math.max(L.W, L.H), Math.max(L.W, L.H), 0xD8D2C4, 0xE7E2D6);
      grid.position.set(Math.max(L.W, L.H) / 2, 0.005, Math.max(L.W, L.H) / 2);
      G3.add(grid);

      // ゾーン床タイル+ラベル
      for (const z of L.ZONES) {
        if (!z.need(s)) continue;
        const w = z.x1 - z.x0 + 1, d = z.y1 - z.y0 + 1;
        const p = new THREE.Mesh(new THREE.PlaneGeometry(w, d), this.mat(parseInt(z.tint.slice(1), 16)));
        p.rotation.x = -Math.PI / 2;
        p.position.set(z.x0 + w / 2, 0.01, z.y0 + d / 2);
        G3.add(p);
        const lb = this.labelSprite(z.label, { scale: 1.15 });
        lb.position.set(z.x0 + w / 2, 2.5, z.y0 + d / 2);
        G3.add(lb);
      }

      // 外周壁(南面はドアで開口)
      const wallHex = 0xEDE8DC, t = 0.18, wh = 2.5;
      this.addBox(G3, -t, -t, L.W + t * 2, t, wh, wallHex, { noCollide: true }); // 北
      this.addBox(G3, -t, -t, t, L.H + t * 2, wh, wallHex, { noCollide: true }); // 西
      this.addBox(G3, L.W, -t, t, L.H + t * 2, wh, wallHex, { noCollide: true }); // 東
      const doorX = L.DOOR.x;
      this.addBox(G3, -t, L.H, doorX - 1 + t, t, wh, wallHex, { noCollide: true });
      this.addBox(G3, doorX + 2, L.H, L.W - doorX - 2 + t, t, wh, wallHex, { noCollide: true });
      const mat = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.6), this.mat(0xB9CCD8));
      mat.rotation.x = -Math.PI / 2;
      mat.position.set(doorX + 0.5, 0.015, L.H - 0.8);
      G3.add(mat);
      const doorLb = this.labelSprite('入口/出口', { scale: 0.9 });
      doorLb.position.set(doorX + 0.5, 2.2, L.H - 0.6);
      G3.add(doorLb);

      // 待合椅子(座面+背もたれ)
      const nChairs = Math.min(s.chairs, L.CHAIRS.length);
      for (let i = 0; i < nChairs; i++) {
        const c = L.CHAIRS[i];
        this.addBox(G3, c.x + 0.22, c.y + 0.22, 0.56, 0.56, 0.42, 0xE4B968, { noCollide: true });
        this.addBox(G3, c.x + 0.22, c.y + 0.66, 0.56, 0.12, 0.85, 0xD3A54F, { noCollide: true });
      }

      // 受付・会計カウンター
      const rc = L.RECEP.counter;
      this.addBox(G3, rc.x, rc.y, rc.w, rc.d, 1.05, 0x3E7CA6);
      const cc = L.CASH.counter;
      this.addBox(G3, cc.x, cc.y, cc.w, cc.d, 1.05, 0x8C7BC4);
      if (s.kiosk) this.addBox(G3, L.CASH.kiosk.x + 0.25, L.CASH.kiosk.y + 0.25, 0.5, 0.5, 1.35, 0x5FA8D3);

      // 診察デスク
      for (let i = 0; i < Math.min(s.doctors, L.EXAM.length); i++) {
        const d = L.EXAM[i].desk;
        this.addBox(G3, d.x, d.y, d.w, d.d, 0.78, 0xC9D8E4);
      }
      // 処置ベッド
      for (let i = 0; i < Math.min(s.beds, L.BEDS.length); i++) {
        const b = L.BEDS[i].bed;
        this.addBox(G3, b.x, b.y, 1, 1.7, 0.55, 0xFFFFFF);
        this.addBox(G3, b.x + 0.06, b.y + 0.1, 0.88, 0.8, 0.62, 0xBFD9CE, { noCollide: true });
      }
      // リハ機器(稼働可能台数で色分け)
      const usable = this.clinic.usableMachines();
      for (let i = 0; i < Math.min(s.machines, L.MACHINES.length); i++) {
        const m = L.MACHINES[i].m;
        this.addBox(G3, m.x + 0.12, m.y + 0.12, 0.76, 0.76, 1.15, i < usable ? 0x7FB8A2 : 0xB9C6C0);
      }
      // プレミアム施設
      if (L.DECO) {
        const names = { cafe: '☕ カフェ', kids: '🧸 キッズ', signage: '📺 サイネージ', bus: '🚌 送迎バス' };
        Object.keys(L.DECO).forEach((k) => {
          if (!deco[k]) return;
          const d = L.DECO[k];
          this.addBox(G3, d.x, d.y, d.w || 1, 1, 0.9, 0xD8C8E8);
          const lb = this.labelSprite(names[k] || d.label, { scale: 0.85 });
          lb.position.set(d.x + (d.w || 1) / 2, 1.7, d.y + 0.5);
          G3.add(lb);
        });
      }

      /* --- スタッフ --- */
      const addStaff = (pos, bodyHex, o, tapKind) => {
        const f = this.makeFigure(bodyHex, o);
        f.position.set(pos.x + 0.5, 0, pos.y + 0.5);
        if (o && o.face !== undefined) f.rotation.y = o.face;
        this.staffGroup.add(f);
        if (tapKind) { f.userData.tap = { kind: 'staff', staffKind: tapKind }; this.staffTappable.push(f); }
        return f;
      };
      const nWin = this.clinic.recepWindows();
      for (let w = 0; w < nWin; w++) addStaff(L.RECEP.staff[w], 0xFFFFFF, { hair: 0x4A3B2E, dot: 0xC98A2D, face: Math.PI }, 'recep');
      addStaff(L.CASH.staff, 0xFFFFFF, { hair: 0x3A342C, dot: 0x8C7BC4, face: Math.PI }, 'cash');
      if (s.cashHelper) addStaff({ x: L.CASH.kiosk.x, y: L.CASH.kiosk.y - 0.55 }, 0xFFFFFF, { hair: 0x4A3B2E, dot: 0xC98A2D, face: Math.PI }, 'cash');
      for (let i = 0; i < Math.min(s.doctors, L.EXAM.length); i++) addStaff(L.EXAM[i].doctor, 0xFFFFFF, { hair: 0x30302E, dot: 0x2C5F82 });
      for (let n = 0; n < Math.min(s.nurses, 6); n++) addStaff(L.NURSE_ROW(n), 0xFFFFFF, { hair: 0x4A3B2E, dot: 0xC4574E });
      const ptVis = Math.min(s.pts, L.PT_VIS || 10);
      for (let n = 0; n < ptVis; n++) addStaff(L.PT_ROW(n), 0xFFFFFF, { hair: 0x3A342C, dot: 0x4FA98C });

      this.staticSig = this.stateSig();
    }

    /* ---------- 患者同期 ---------- */
    syncPatients() {
      const seen = new Set();
      for (const p of this.clinic.patients) {
        seen.add(p.id);
        let g = this.patMeshes.get(p.id);
        if (!g) {
          g = this.makeFigure(PHASE_COL3[p.phase] || 0x9AA7B0, { hair: SEG_HAIR3[p.seg] });
          g.userData.tap = { kind: 'patient', pid: p.id };
          g.userData.phase = p.phase;
          this.patMeshes.set(p.id, g);
          this.patGroup.add(g);
        }
        if (g.userData.phase !== p.phase) {
          g.userData.torso.material = this.mat(PHASE_COL3[p.phase] || 0x9AA7B0);
          g.userData.phase = p.phase;
        }
        const walking = p.path.length > 0;
        const bob = walking ? Math.sin(performance.now() * 0.012 + p.id * 3) * 0.05 : 0;
        g.position.set(p.x + 0.5, Math.max(0, bob), p.y + 0.5);
        if (walking && p.path.length) {
          const tgt = p.path[0];
          g.rotation.y = Math.atan2((tgt.x + 0.5) - (p.x + 0.5), (tgt.y + 0.5) - (p.y + 0.5));
        }
        // 感情バブル
        const waiting = p.phase === 'recepQ' || p.phase === 'waitExam' || p.phase === 'waitTreat' || p.phase === 'waitReha' || p.phase === 'cashQ';
        const want = waiting && p.waitTotal > 55 ? '💢' : waiting && p.waitTotal > 30 ? '😮‍💨' : null;
        if (want !== g.userData.emo) {
          if (g.userData.emoSp) { g.remove(g.userData.emoSp); g.userData.emoSp = null; }
          if (want) {
            const sp = this.emojiSprite(want);
            sp.position.y = 1.85;
            g.add(sp);
            g.userData.emoSp = sp;
          }
          g.userData.emo = want;
        }
      }
      for (const [id, g] of this.patMeshes) {
        if (!seen.has(id)) { this.patGroup.remove(g); this.patMeshes.delete(id); }
      }
    }

    /* ---------- 操作 ---------- */
    bindControls() {
      const cv = this.renderer.domElement;
      let look = null;
      cv.addEventListener('pointerdown', (e) => {
        look = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now() };
        cv.setPointerCapture(e.pointerId);
      });
      cv.addEventListener('pointermove', (e) => {
        if (!look || e.pointerId !== look.id) return;
        this.yaw -= (e.clientX - look.x) * 0.0052;
        this.pitch = Math.max(-1.25, Math.min(1.25, this.pitch - (e.clientY - look.y) * 0.0045));
        look.x = e.clientX; look.y = e.clientY;
      });
      cv.addEventListener('pointerup', (e) => {
        if (!look || e.pointerId !== look.id) return;
        const moved = Math.hypot(e.clientX - look.sx, e.clientY - look.sy);
        const dt = performance.now() - look.t;
        if (moved < 9 && dt < 400) this.tapAt(e.clientX, e.clientY);
        look = null;
      });
      this._onKey = (e) => {
        if (!this.active) return;
        const k = e.key.toLowerCase();
        if (e.type === 'keydown' && k === 'escape') { this.exit(); return; }
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) {
          this.keys[k] = e.type === 'keydown';
          e.preventDefault();
        }
      };
      window.addEventListener('keydown', this._onKey);
      window.addEventListener('keyup', this._onKey);

      // ジョイスティック
      const stick = this.ov.querySelector('#walkStick');
      const knob = this.ov.querySelector('#walkKnob');
      const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx * 34}px, ${dy * 34}px)`; };
      let sid = null;
      stick.addEventListener('pointerdown', (e) => {
        sid = e.pointerId;
        stick.setPointerCapture(sid);
        this.stick.on = true;
        e.stopPropagation();
      });
      stick.addEventListener('pointermove', (e) => {
        if (e.pointerId !== sid || !this.stick.on) return;
        const r = stick.getBoundingClientRect();
        let dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
        let dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
        const len = Math.hypot(dx, dy);
        if (len > 1) { dx /= len; dy /= len; }
        this.stick.dx = dx; this.stick.dy = dy;
        setKnob(dx, dy);
      });
      const endStick = (e) => {
        if (e.pointerId !== sid) return;
        this.stick.on = false; this.stick.dx = 0; this.stick.dy = 0;
        setKnob(0, 0);
        sid = null;
      };
      stick.addEventListener('pointerup', endStick);
      stick.addEventListener('pointercancel', endStick);

      this.ov.querySelector('#walkExit').addEventListener('click', () => this.exit());
      this._onResize = () => { if (this.active) this.resize(); };
      window.addEventListener('resize', this._onResize);
    }

    tapAt(cx, cy) {
      const r = this.renderer.domElement.getBoundingClientRect();
      const nd = new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
      this.ray.setFromCamera(nd, this.camera);
      const objs = [...this.patGroup.children, ...(this.staffTappable || [])];
      const hits = this.ray.intersectObjects(objs, true);
      if (!hits.length) return;
      let node = hits[0].object;
      while (node && !node.userData.tap) node = node.parent;
      if (!node) return;
      const dist = node.position.distanceTo(this.camera.position);
      if (dist > 4.5) { if (this.hooks.onTooFar) this.hooks.onTooFar(); return; }
      const tap = node.userData.tap;
      if (tap.kind === 'patient') {
        const p = this.clinic.patients.find((q) => q.id === tap.pid);
        if (p && this.hooks.onPatientTap) this.hooks.onPatientTap(p);
      } else if (tap.kind === 'staff' && this.hooks.onStaffTap) {
        this.hooks.onStaffTap(tap.staffKind);
      }
    }

    /* ---------- 移動+衝突 ---------- */
    move(dt) {
      let fx = 0, fz = 0;
      if (this.keys['w'] || this.keys['arrowup']) fz += 1;
      if (this.keys['s'] || this.keys['arrowdown']) fz -= 1;
      if (this.keys['a'] || this.keys['arrowleft']) fx -= 1;
      if (this.keys['d'] || this.keys['arrowright']) fx += 1;
      fz += -this.stick.dy;
      fx += this.stick.dx;
      const len = Math.hypot(fx, fz);
      if (len < 0.01) return;
      fx /= Math.max(1, len); fz /= Math.max(1, len);
      const sp = 3.1 * dt;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      let nx = this.camera.position.x + (-sin * fz + cos * fx) * sp;
      let nz = this.camera.position.z + (-cos * fz - sin * fx) * sp;
      const L = this.clinic.L;
      nx = Math.max(0.35, Math.min(L.W - 0.35, nx));
      nz = Math.max(0.35, Math.min(L.H - 0.35, nz));
      for (const c of this.colliders) {
        if (nx > c.x0 && nx < c.x1 && nz > c.z0 && nz < c.z1) {
          const pl = nx - c.x0, pr = c.x1 - nx, pt = nz - c.z0, pb = c.z1 - nz;
          const m = Math.min(pl, pr, pt, pb);
          if (m === pl) nx = c.x0; else if (m === pr) nx = c.x1;
          else if (m === pt) nz = c.z0; else nz = c.z1;
        }
      }
      this.camera.position.x = nx;
      this.camera.position.z = nz;
    }

    /* ---------- ループ ---------- */
    frame(ts) {
      if (!this.active) return;
      const dt = Math.min(0.06, (ts - this._lastTs) / 1000 || 0.016);
      this._lastTs = ts;
      if (++this._fn % 45 === 0 && this.stateSig() !== this.staticSig) this.buildStatic();
      this.move(dt);
      this.camera.rotation.y = this.yaw;
      this.camera.rotation.x = this.pitch;
      this.syncPatients();
      if (this._fn % 12 === 0 && this.hooks.getHud) {
        const h = this.hooks.getHud();
        const el = this.ov.querySelector('#walkInfo');
        if (el) el.innerHTML = `<b>${h.line1}</b><br>${h.line2}`;
      }
      this.renderer.render(this.scene, this.camera);
      this._raf = requestAnimationFrame((t) => this.frame(t));
    }

    resize() {
      const w = window.innerWidth, h = window.innerHeight;
      this.renderer.setSize(w, h);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    }

    enter() {
      if (this.active) return true;
      try {
        if (!this.renderer) this.buildRenderer();
      } catch (e) { return false; }
      const L = this.clinic.L;
      this.buildStatic();
      this.camera.position.set(L.DOOR.x - 0.9, 1.5, L.H - 1.4); // 入口脇(患者動線を避ける)
      this.yaw = 0;
      this.pitch = -0.04;
      this.active = true;
      this._fn = 0;
      this.ov.style.display = 'block';
      this._bodyOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      this.resize();
      this._lastTs = performance.now();
      if (this.hooks.onEnter) this.hooks.onEnter();
      this._raf = requestAnimationFrame((t) => this.frame(t));
      return true;
    }

    exit() {
      if (!this.active) return;
      this.active = false;
      if (this._raf) cancelAnimationFrame(this._raf);
      this.ov.style.display = 'none';
      document.body.style.overflow = this._bodyOverflow || '';
      this.keys = {};
      this.stick.dx = 0; this.stick.dy = 0; this.stick.on = false;
      if (this.hooks.onExit) this.hooks.onExit();
    }
  }

  window.Walk3D = Walk3D;
})();
