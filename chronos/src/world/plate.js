// CHRONOS — the foundation: base plate, hub, glass annulus, under-plate structure and the gear train that starts it all
import * as THREE from 'three';
import { makeGear, makeAnnulus, pitchRadius } from '../geometry.js';
import { MATS } from '../materials.js';
import { Inst } from '../inst.js';
import { TAU, E, span, mulberry32 } from '../util.js';
import { BEATS as B, R } from '../timeline.js';

// A planar gear train (axes vertical). Meshing is exact: positions, ratios and tooth phases are solved.
export class GearTrain {
  constructor() { this.gears = []; }
  // phi: world XZ direction angle from parent to this gear. returns index
  add(parentIndex, phi, teeth, module, opts = {}) {
    const g = { teeth, module, rp: pitchRadius(teeth, module), parent: parentIndex, phase: 0, omega: 1, pos: new THREE.Vector3(), y: opts.y ?? 0, thickness: opts.thickness ?? module * 4, mat: opts.mat || 'steel', engage: opts.engage ?? 0, depth: 0, spokes: opts.spokes ?? 0, hole: opts.hole ?? module * 1.2, axle: opts.axle !== false };
    if (parentIndex < 0) { g.pos.set(opts.x || 0, 0, opts.z || 0); g.omega = 1; g.phase = opts.phase || 0; }
    else {
      const p = this.gears[parentIndex];
      const dist = p.rp + g.rp;
      g.pos.set(p.pos.x + Math.cos(phi) * dist, 0, p.pos.z + Math.sin(phi) * dist);
      g.omega = -p.omega * p.teeth / teeth;
      g.depth = p.depth + 1;
      // tooth phase: local angle = -phi (mesh is rotated -90deg about X). parent's nearest tooth to -phi:
      const target = -phi;
      const pitchP = TAU / p.teeth;
      const delta = (((target - p.phase) % pitchP) + pitchP * 1.5) % pitchP - pitchP / 2;
      const pitchC = TAU / teeth;
      g.phase = (-phi - Math.PI - pitchC / 2) + delta * (p.teeth / teeth);
      g.y = opts.y ?? p.y;
    }
    this.gears.push(g);
    return this.gears.length - 1;
  }
  overlaps(pos, ra, except = -1) {
    for (let i = 0; i < this.gears.length; i++) { if (i === except) continue; if (this.gears[i].compoundOf === except) continue; const g = this.gears[i]; const d = Math.hypot(g.pos.x - pos.x, g.pos.z - pos.z); if (d < ra + g.rp + g.module * 1.2) return true; }
    return false;
  }
}

export class Plate {
  constructor(scene, ctx) {
    this.scene = scene; this.group = new THREE.Group(); scene.add(this.group);
    const rng = mulberry32(7);
    // ---- plate structure: bands (so the final clock can step them into tiers) ----
    const bands = [[R.hub, R.glassOut], [R.glassOut, 136], [136, 145], [145, 185], [185, 195], [195, 235], [235, 245], [245, 296]];
    this.bandMeshes = [];
    for (let i = 1; i < bands.length; i++) {
      const [a, b] = bands[i];
      const m = new THREE.Mesh(makeAnnulus(a, b, 10, 96), MATS.plate);
      m.rotation.x = -Math.PI / 2; m.position.y = -5; this.group.add(m); this.bandMeshes.push({ mesh: m, band: i, rIn: a, rOut: b });
    }
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(R.hub, R.hub + 2, 12, 64), MATS.titaniumDark); hub.position.y = -6; this.group.add(hub);
    const hubTop = new THREE.Mesh(new THREE.CylinderGeometry(R.hub - 6, R.hub - 6, 1.5, 64), MATS.gearDark); hubTop.position.y = 0.6; this.group.add(hubTop);
    this.glass = new THREE.Mesh(makeAnnulus(R.hub, R.glassOut, 1.6, 96), MATS.glassClear); this.glass.rotation.x = -Math.PI / 2; this.glass.position.y = -0.8; this.glass.renderOrder = 5; this.group.add(this.glass);
    const ribGeo = new THREE.BoxGeometry(R.glassOut - R.hub, 1.2, 1.4);
    const ribs = new Inst(ribGeo, MATS.titanium, 24); for (let i = 0; i < 24; i++) { const a = (i / 24) * TAU; ribs.set(i, Math.cos(a) * (R.hub + R.glassOut) / 2, -1.2, Math.sin(a) * (R.hub + R.glassOut) / 2, 0, -a, 0, 1); } ribs.commit(); this.group.add(ribs.mesh);
    // under-plate: movement plate, pillars, girders, conduits
    const under = new THREE.Mesh(makeAnnulus(R.hub - 10, R.outer + 8, 4, 96), MATS.titaniumDark); under.rotation.x = -Math.PI / 2; under.position.y = -R.underY - 2; this.group.add(under);
    const pillarGeo = new THREE.CylinderGeometry(1.1, 1.3, R.underY - 10, 10);
    const nP = 420; const pillars = new Inst(pillarGeo, MATS.titaniumDark, nP);
    for (let i = 0; i < nP; i++) { const a = rng() * TAU, r = R.glassOut + 4 + rng() * (R.outer - R.glassOut - 8); pillars.set(i, Math.cos(a) * r, -(R.underY + 10) / 2, Math.sin(a) * r, 0, 0, 0, 1); }
    pillars.commit(); this.group.add(pillars.mesh);
    const girderGeo = new THREE.BoxGeometry(R.outer - R.hub, 6, 3);
    const girders = new Inst(girderGeo, MATS.titaniumDark, 12);
    for (let i = 0; i < 12; i++) { const a = (i / 12) * TAU + TAU / 24; girders.set(i, Math.cos(a) * (R.outer + R.hub) / 2, -13.5, Math.sin(a) * (R.outer + R.hub) / 2, 0, -a, 0, 1); }
    girders.commit(); this.group.add(girders.mesh);
    this.conduits = new Inst(new THREE.BoxGeometry(1, 0.5, 0.5), MATS.glowCyan, 360, { color: true });
    let ci = 0;
    for (const rr of [140, 200, 260]) { for (let i = 0; i < 120; i++) { const a = (i / 120) * TAU, len = (TAU * rr) / 120 * 0.78; this.conduits.set(ci, Math.cos(a) * rr, -11, Math.sin(a) * rr, 0, -a - Math.PI / 2, 0, len, 1, 1); this.conduits.setColor(ci, 0.2, 0.6, 0.8); ci++; } }
    this.conduits.commit(true); this.group.add(this.conduits.mesh);

    // ---- gear train ----
    this.train = new GearTrain();
    const T = this.train;
    const a0 = R.g0Angle;
    const g0x = Math.cos(a0) * R.g0Radius, g0z = Math.sin(a0) * R.g0Radius;
    const idx = [];
    idx.push(T.add(-1, 0, 12, 0.36, { x: g0x, z: g0z, y: -R.gearY, thickness: 1.2, mat: 'orange', engage: 0, spokes: 0, phase: 0.3 }));
    const steps = [[18, 0.36], [28, 0.36], [22, 0.52], [36, 0.52], [30, 0.75], [48, 0.75], [38, 1.05], [60, 1.05], [46, 1.4], [72, 1.4], [54, 1.8], [66, 1.8], [44, 2.2], [58, 2.2], [40, 2.2], [52, 2.2]];
    let dir = a0, parent = idx[0], k = 0;
    for (const [teeth, module] of steps) {
      const p = T.gears[parent];
      let gi;
      if (Math.abs(module - p.module) > 1e-6) {
        gi = T.add(-1, 0, teeth, module, { x: p.pos.x, z: p.pos.z, y: p.y - (p.thickness + module * 4) / 2 - 0.3, thickness: module * 4, mat: k % 3 === 0 ? 'orange' : 'steel', engage: p.engage, spokes: teeth > 40 ? 5 : 0, axle: false });
        const g = T.gears[gi]; g.omega = p.omega; g.phase = p.phase; g.depth = p.depth; g.compoundOf = parent;
      } else {
        dir += (k % 2 === 0 ? 0.38 : 0.1) * (1 + 0.1 * Math.sin(k));
        // keep every gear inside the plate: turn the chain until the new gear fits between the hub and the rim
        const rpNew = pitchRadius(teeth, module), limit = R.outer - 6 - rpNew - module;
        let tries = 0;
        while (tries < 24) {
          const px = p.pos.x + Math.cos(dir) * (p.rp + rpNew), pz = p.pos.z + Math.sin(dir) * (p.rp + rpNew);
          const rad = Math.hypot(px, pz);
          if (rad < limit && rad > R.hub + rpNew + 4 && !T.overlaps(new THREE.Vector3(px, 0, pz), rpNew + module, parent)) break;
          dir += 0.26; tries++;
        }
        if (tries >= 24) { k++; continue; } // nowhere to put it: skip
        gi = T.add(parent, dir, teeth, module, { thickness: module * 4, mat: k % 4 === 1 ? 'dark' : 'steel', engage: 0, spokes: teeth > 44 ? (teeth > 70 ? 6 : 5) : 0 });
        T.gears[gi].engage = T.gears[parent].engage + 1;
      }
      idx.push(gi); parent = gi; k++;
    }
    const branchRng = mulberry32(31);
    for (let i = 2; i < idx.length; i += 2) {
      const pi = idx[i]; const p = T.gears[pi];
      for (let tries = 0; tries < 6; tries++) {
        const phi = branchRng() * TAU; const teeth = Math.round(10 + branchRng() * 26); const module = p.module;
        const rp = pitchRadius(teeth, module); const pos = new THREE.Vector3(p.pos.x + Math.cos(phi) * (p.rp + rp), 0, p.pos.z + Math.sin(phi) * (p.rp + rp));
        const rad = Math.hypot(pos.x, pos.z);
        if (rad < R.hub + rp + 4 || rad > R.outer - rp - 4) continue;
        if (T.overlaps(pos, rp + module * 1.2)) continue;
        const gi = T.add(pi, phi, teeth, module, { thickness: module * 3.2, mat: branchRng() < 0.3 ? 'orange' : 'steel', spokes: teeth > 30 ? 4 : 0 });
        T.gears[gi].engage = p.engage + 1 + Math.floor(branchRng() * 2);
        if (branchRng() < 0.5) break;
      }
    }
    this.gearMeshes = [];
    const mats = { steel: MATS.gearSteel, dark: MATS.gearDark, orange: MATS.orangeMetal };
    this.axles = new Inst(new THREE.CylinderGeometry(1, 1, 1, 10), MATS.titaniumDark, T.gears.length);
    this.caps = new Inst(new THREE.CylinderGeometry(1, 1, 0.5, 10), MATS.glowCyan, T.gears.length, { color: true });
    T.gears.forEach((g, i) => {
      const geo = makeGear(g.teeth, g.module, g.thickness, { hole: g.hole, spokes: g.spokes, rim: 0.2 });
      const mesh = new THREE.Mesh(geo, mats[g.mat] || MATS.gearSteel);
      mesh.rotation.x = -Math.PI / 2; mesh.position.set(g.pos.x, g.y, g.pos.z);
      this.group.add(mesh); this.gearMeshes.push(mesh);
      g.mesh = mesh; g.engageTime = g.engage === 0 && g.compoundOf === undefined && i === 0 ? B.gearAppear - 0.3 : B.gearEngage + g.engage * 0.11 + (g.compoundOf !== undefined ? 0.02 : 0);
      if (g.axle) { const ar = Math.max(0.22, g.rp * 0.085); const top = g.y + g.thickness / 2 + 0.4; this.axles.set(i, g.pos.x, (top - R.underY) / 2, g.pos.z, 0, 0, 0, ar, top + R.underY, ar); this.caps.setColor(i, 0.22, 0.6, 0.8); }
      else { this.axles.hide(i); }
      this.caps.hide(i);
    });
    this.axles.commit(); this.caps.commit(true); this.group.add(this.axles.mesh); this.group.add(this.caps.mesh);
    this.g0 = T.gears[idx[0]];
    this.g0Pos = new THREE.Vector3(g0x, -R.gearY, g0z);
    this.chainDir = dir;
    this.g0Light = new THREE.PointLight(0xff7a2a, 0, 60, 2); this.g0Light.position.copy(this.g0Pos).add(new THREE.Vector3(0, 2.5, 0)); this.group.add(this.g0Light);
    this.pulseLight = new THREE.PointLight(0xff7a2a, 0, 260, 2); this.pulseLight.position.set(0, -20, 0); this.group.add(this.pulseLight);
    this.tier = 0;
  }

  // root rotation Θ(t): two escapement ticks, then smooth acceleration to running speed
  theta(t) {
    const tick = (t0) => span(t, t0, t0 + 0.09, E.snap) * 0.35;
    let th = tick(B.gearAppear + 0.15) + tick(B.gearAppear + 0.42);
    const run0 = B.gearEngage - 0.05;
    if (t > run0) { const u = t - run0; const w = 2.4; th += w * (u - 0.35 * (1 - Math.exp(-u / 0.35))); }
    return th;
  }

  update(t) {
    const th = this.theta(t);
    for (const g of this.train.gears) {
      const eng = span(t, g.engageTime, g.engageTime + 0.16, E.outCubic);
      const thEng = this.theta(g.engageTime);
      const rot = g.phase + g.omega * (eng >= 1 ? th : (t < g.engageTime ? thEng : thEng + (th - thEng) * eng));
      const lift = (1 - eng) * (g.thickness * 1.4 + 1.5);
      g.mesh.rotation.z = rot;
      g.mesh.position.y = g.y - lift;
      if (g !== this.g0) { const sc = Math.max(0.001, span(t, g.engageTime - 0.12, g.engageTime + 0.1, E.outCubic)); g.mesh.scale.setScalar(sc); g.mesh.visible = sc > 0.002; }
      if (g === this.g0) { const ap = span(t, B.gearAppear, B.gearAppear + 0.4, E.outCubic); g.mesh.scale.setScalar(0.001 + 0.999 * ap); g.mesh.visible = t >= B.gearAppear - 0.01; }
      if (g.axle) { const i = this.train.gears.indexOf(g); const vis = (g === this.g0 ? span(t, B.gearAppear, B.gearAppear + 0.4, E.outCubic) : eng); const cr = g.hole * 0.95 * vis; this.caps.set(i, g.pos.x, g.y + g.thickness / 2 + 0.3, g.pos.z, 0, 0, 0, cr, vis, cr); }
    }
    this.caps.commit();
    this.g0Light.intensity = 70 * span(t, B.gearAppear, B.gearAppear + 0.6, E.outCubic) * (1 - span(t, 3.4, 4.2));
    const pulse = t >= B.pulseOrange ? Math.exp(-(t - B.pulseOrange) / 0.6) * span(t, B.pulseOrange, B.pulseOrange + 0.08) : 0;
    this.pulseLight.intensity = 90000 * pulse;
    MATS.orangeMetal.emissiveIntensity = 1.0 + 3.0 * pulse;
    const tier = span(t, B.tiers, B.tiers + 1.0, E.inOutCubic);
    for (const b of this.bandMeshes) { const lift = b.band === 1 ? 7 : b.band <= 3 ? 4.5 : b.band <= 5 ? 2.5 : 0; b.mesh.position.y = -5 + lift * tier; }
    this.tier = tier;
  }
  bandLift(r) { return (r < 136 ? 7 : r < 185 ? 4.5 : r < 235 ? 2.5 : 0) * this.tier; }
}
