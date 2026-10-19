// CHRONOS — kinetic typography: letters are mechanical bars that slide, lock, align and scan into place
import * as THREE from 'three';
import { layoutText } from '../typeface.js';
import { makeArcBar } from '../geometry.js';
import { MATS } from '../materials.js';
import { Inst } from '../inst.js';
import { E, span, sat, mulberry32, TAU, deg } from '../util.js';
import { BEATS as B } from '../timeline.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4();

export class TextBlock {
  constructor(text, { size = 1, depth = 0.45, material = MATS.bar, tracking, pins = false, seed = 1 } = {}) {
    this.group = new THREE.Group();
    const { pieces, width, height, stroke } = layoutText(text, size, tracking);
    this.width = width; this.height = height; this.stroke = stroke; this.size = size;
    const rng = mulberry32(seed);
    this.pieces = [];
    const lines = pieces.filter((p) => p.kind !== 'arc');
    const arcs = pieces.filter((p) => p.kind === 'arc');
    this.lines = new Inst(BOX, material, Math.max(1, lines.length));
    this.group.add(this.lines.mesh);
    const D = depth * size;
    lines.forEach((p, i) => {
      let cx, cy, len, angle, dp;
      if (p.kind === 'dot') { cx = p.x; cy = p.y; len = stroke; angle = 0; dp = D; }
      else {
        cx = (p.x1 + p.x2) / 2; cy = (p.y1 + p.y2) / 2; len = Math.hypot(p.x2 - p.x1, p.y2 - p.y1); angle = Math.atan2(p.y2 - p.y1, p.x2 - p.x1);
        const vert = Math.abs(Math.cos(angle)) < 0.01, horiz = Math.abs(Math.sin(angle)) < 0.01; dp = vert ? D : horiz ? D * 0.94 : D * 0.86;
      }
      this.pieces.push({ kind: 'line', index: i, cx, cy, len, angle, depth: dp, seed: rng(), seed2: rng(), seed3: rng(), charIndex: p.charIndex });
    });
    arcs.forEach((p) => {
      const geo = makeArcBar(p.r, stroke, D * 0.9, deg(p.a0), deg(p.a1));
      const mesh = new THREE.Mesh(geo, material); this.group.add(mesh);
      this.pieces.push({ kind: 'arc', mesh, cx: p.cx, cy: p.cy, len: p.r * Math.abs(deg(p.a1 - p.a0)), angle: 0, depth: D * 0.9, seed: rng(), seed2: rng(), seed3: rng(), charIndex: p.charIndex });
    });
    const sorted = [...this.pieces].sort((a, b) => a.cx - b.cx); sorted.forEach((p, k) => { p.order = k / Math.max(1, sorted.length - 1); });
    this.n = this.pieces.length;
    this.pins = null;
    if (pins) {
      const nl = lines.length;
      this.pins = new Inst(BOX, MATS.glowOrange, nl * 2, { color: true });
      this.group.add(this.pins.mesh);
      this.pinGlow = 0;
    }
    this.hideAll();
  }
  hideAll() { for (let k = 0; k < this.n; k++) this.apply(k, { v: false }); this.commit(); }
  // off: {dx,dy,dz,rx,ry,rz,s,v}
  apply(k, off) {
    const p = this.pieces[k];
    const v = off.v !== false; const s = (off.s ?? 1) * (v ? 1 : 0);
    const dx = off.dx || 0, dy = off.dy || 0, dz = off.dz || 0, rx = off.rx || 0, ry = off.ry || 0, rz = off.rz || 0;
    if (p.kind === 'line') {
      _p.set(p.cx + dx, p.cy + dy, dz); _e.set(rx, ry, p.angle + rz); _q.setFromEuler(_e); _s.set(p.len * s, this.stroke * s, p.depth * s);
      _m.compose(_p, _q, _s); this.lines.setMatrix(p.index, _m);
      if (this.pins) {
        const ps = this.stroke * 0.32 * s, inset = p.len / 2 - this.stroke * 0.5;
        for (let e = 0; e < 2; e++) {
          _s.set(ps, ps, this.stroke * 0.12 * s); _p.set((e ? inset : -inset) * s, 0, p.depth * 0.5 * s + ps * 0.05); _p.applyQuaternion(_q); _p.x += p.cx + dx; _p.y += p.cy + dy; _p.z += dz;
          _m2.compose(_p, _q, _s); this.pins.setMatrix(p.index * 2 + e, _m2);
          const g = this.pinGlow; this.pins.setColor(p.index * 2 + e, 0.25 + 4.0 * g, 0.08 + 1.6 * g, 0.02 + 0.4 * g);
        }
      }
    } else {
      p.mesh.position.set(p.cx + dx, p.cy + dy, dz); p.mesh.rotation.set(rx, ry, rz); p.mesh.scale.setScalar(Math.max(s, 1e-4)); p.mesh.visible = v;
    }
  }
  // world-space placement with explicit orientation (anamorphic text)
  applyWorld(k, pos, quat, scale, visible = true) {
    const p = this.pieces[k]; const s = visible ? scale : 0;
    if (p.kind === 'line') { _e.set(0, 0, p.angle); _q.setFromEuler(_e); _q2.copy(quat).multiply(_q); _s.set(p.len * s, this.stroke * s, p.depth * s); _m.compose(pos, _q2, _s); this.lines.setMatrix(p.index, _m); }
    else { p.mesh.position.copy(pos); p.mesh.quaternion.copy(quat); p.mesh.scale.setScalar(Math.max(s, 1e-4)); p.mesh.visible = visible; }
  }
  commit() { this.lines.commit(); if (this.pins) this.pins.commit(true); }
}

// ---- reveal styles ----
export function revealSlide(block, p, { stagger = 0.7, dist = 1.6, ease = E.outExpo, axis = true } = {}) {
  for (let k = 0; k < block.n; k++) {
    const pc = block.pieces[k];
    const pk = ease(sat(p * (1 + stagger) - pc.order * stagger));
    const ang = axis ? pc.angle + (pc.seed > 0.5 ? Math.PI : 0) : pc.seed * TAU;
    const d = (1 - pk) * dist * block.size * (0.6 + pc.seed2 * 0.8);
    block.apply(k, { dx: Math.cos(ang) * d, dy: Math.sin(ang) * d, dz: (1 - pk) * 0.25 * block.size, v: pk > 0.002 });
  }
  block.commit();
}
export function hideRotate(block, p, { stagger = 0.6 } = {}) {
  for (let k = 0; k < block.n; k++) {
    const pc = block.pieces[k];
    const pk = E.inCubic(sat(p * (1 + stagger) - (1 - pc.order) * stagger));
    const ax = pc.kind === 'line' ? Math.abs(Math.cos(pc.angle)) > 0.7 : false;
    block.apply(k, { rx: ax ? 0 : pk * Math.PI / 2, ry: ax ? pk * Math.PI / 2 : 0, dz: pk * 0.8 * block.size, s: 1 - pk * 0.9, v: pk < 0.999 });
  }
  block.commit();
}
export function revealScan(block, x, { lead = 0.07 } = {}) {
  for (let k = 0; k < block.n; k++) {
    const pc = block.pieces[k];
    const u = sat((x - pc.cx) / (lead * block.width) + 0.5);
    const pk = E.outCubic(u);
    block.apply(k, { dz: (1 - pk) * 0.6 * block.size, ry: (1 - pk) * 0.9, v: u > 0.001 });
  }
  block.commit();
}
export function revealConverge(block, p, { stagger = 0.75, spread = 2.2, ease = E.outQuint } = {}) {
  for (let k = 0; k < block.n; k++) {
    const pc = block.pieces[k];
    const pk = ease(sat(p * (1 + stagger) - (1 - Math.abs(pc.order - 0.5) * 2) * stagger));
    const a = pc.seed * TAU; const d = (1 - pk) * spread * block.size;
    block.apply(k, { dx: Math.cos(a) * d * 0.5, dy: Math.sin(a) * d * 0.35, dz: -(1 - pk) * spread * 1.8 * block.size * (0.5 + pc.seed2), rz: (1 - pk) * (pc.seed3 - 0.5) * 1.2, v: pk > 0.002 });
  }
  block.commit();
}

export class Typography {
  constructor(scene, ctx) {
    this.scene = scene; this.camera = ctx.camera;
    this.camGroup = new THREE.Group(); this.camera.add(this.camGroup);
    this.text1 = new TextBlock('TIME IS NOT FOUND.', { size: 1, depth: 0.5, seed: 3 });
    this.title = new TextBlock('CHRONOS', { size: 1, depth: 0.55, pins: true, tracking: 170, seed: 11 });
    this.tag = new TextBlock('EVERY SECOND IS ENGINEERED.', { size: 1, depth: 0.5, tracking: 150, seed: 5 });
    this.camGroup.add(this.text1.group, this.title.group, this.tag.group);
    this.text2 = new TextBlock('IT IS BUILT.', { size: 1, depth: 0.5, seed: 7 }); scene.add(this.text2.group);
    this.text2Placed = false;
    this.light = new THREE.PointLight(0xfff1e2, 0, 200, 2); this.light.position.set(14, 16, -22); this.camGroup.add(this.light);
    this.scanBar = new THREE.Mesh(BOX, MATS.glowWhite); this.scanBar.visible = false; this.camGroup.add(this.scanBar);
  }
  place(block, nx, ny, capFrac, dist) {
    const fov = (this.camera.fov * Math.PI) / 180; const hh = dist * Math.tan(fov / 2); const aspect = this.camera.aspect;
    const s = (capFrac * 2 * hh) / block.size;
    block.group.position.set(nx * hh * aspect, ny * hh, -dist); block.group.scale.setScalar(s);
    return { hh, s };
  }
  update(t, ctx) {
    let lightOn = 0;
    // ---- 1. TIME IS NOT FOUND. (camera-space, bars slide along their axes) ----
    const t1 = this.text1;
    if (t >= B.text1In - 0.02 && t <= B.text1Out + 0.6) {
      t1.group.visible = true; this.place(t1, -0.30, -0.26, 0.062, 40);
      const pin = span(t, B.text1In, B.text1In + 1.0); const pout = span(t, B.text1Out, B.text1Out + 0.5);
      if (pout <= 0) revealSlide(t1, pin, { stagger: 0.8, dist: 1.4 }); else revealSlide(t1, 1 - pout, { stagger: 0.5, dist: 2.2, ease: E.inCubic });
      lightOn = 1;
    } else t1.group.visible = false;
    // ---- 2. IT IS BUILT. (anamorphic: bars scattered in the city, aligned only from one viewpoint) ----
    const t2 = this.text2;
    if (!this.text2Placed) {
      this.text2Placed = true;
      const c = ctx.cameraAt(B.text2);
      const cam = new THREE.PerspectiveCamera(c.fov, this.camera.aspect, 0.5, 4000); cam.position.copy(c.pos); cam.up.set(0, 1, 0); cam.lookAt(c.look); if (c.roll) cam.rotateZ(c.roll); cam.updateMatrixWorld(true);
      const dist = 62, fov = (c.fov * Math.PI) / 180, hh = dist * Math.tan(fov / 2); const s = (0.105 * 2 * hh) / t2.size;
      const base = new THREE.Vector3(0.04 * hh * cam.aspect, 0.14 * hh, -dist);
      this.text2Data = t2.pieces.map((p) => {
        const local = new THREE.Vector3(base.x + p.cx * s, base.y + p.cy * s, base.z);
        const world = cam.localToWorld(local.clone());
        const f = 0.72 + 0.62 * p.seed;
        const pos = cam.position.clone().add(world.sub(cam.position).multiplyScalar(f));
        return { pos, quat: cam.quaternion.clone(), scale: s * f };
      });
    }
    if (t >= B.text2 - 0.8 && t <= B.text2 + 0.85) {
      t2.group.visible = true;
      const g = E.outBack(span(t, B.text2 - 0.75, B.text2 - 0.35)) * (1 - E.inCubic(span(t, B.text2 + 0.5, B.text2 + 0.8)));
      t2.pieces.forEach((p, k) => { const d = this.text2Data[k]; t2.applyWorld(k, d.pos, d.quat, d.scale * g, g > 0.001); });
      t2.commit();
    } else t2.group.visible = false;
    // ---- 3. CHRONOS / EVERY SECOND IS ENGINEERED. ----
    const ti = this.title, tg = this.tag;
    if (t >= B.titleIn - 0.02) {
      ti.group.visible = true; this.place(ti, 0, -0.565, 0.108, 40);
      const p = span(t, B.titleIn, B.titleIn + 1.1);
      ti.pinGlow = span(t, B.titleIn + 0.95, B.titleIn + 1.3, E.outCubic) * (0.85 + 0.15 * Math.sin(t * 5.0));
      revealConverge(ti, p);
      lightOn = Math.max(lightOn, span(t, B.titleIn, B.titleIn + 0.5));
    } else ti.group.visible = false;
    if (t >= B.tagIn - 0.02) {
      tg.group.visible = true; const { hh, s } = this.place(tg, 0, -0.765, 0.033, 40);
      const u = span(t, B.tagIn, B.tagIn + 0.75, E.inOutSine); const x = (-0.6 + 1.25 * u) * tg.width;
      revealScan(tg, x);
      const sb = this.scanBar; const on = u > 0 && u < 1;
      sb.visible = on; if (on) { sb.position.set(x * s, -0.765 * hh, -40 + 0.3); sb.scale.set(0.02 * s, tg.size * 1.9 * s, 0.05); }
      lightOn = 1;
    } else { tg.group.visible = false; this.scanBar.visible = false; }
    this.light.intensity = 900 * lightOn;
  }
}
