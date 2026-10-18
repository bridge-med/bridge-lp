// CHRONOS — the city: towers that assemble and breathe like pistons, rotating ring streets, bridges, elevated tracks, trains, the bezel
import * as THREE from 'three';
import { makeGear, makeGearLite, makeAnnulus, makeBoxBottom } from '../geometry.js';
import { MATS } from '../materials.js';
import { Inst } from '../inst.js';
import { TAU, E, span, mulberry32, sat, lerp, smoothstep, polar } from '../util.js';
import { BEATS as B, R, waveState } from '../timeline.js';

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _e = new THREE.Euler();
const BOX = new THREE.BoxGeometry(1, 1, 1);
const BOXB = makeBoxBottom(1, 1, 1);
const rampInt = (u, tau) => (u <= 0 ? 0 : u - tau * (1 - Math.exp(-u / tau)));
const CAR_LEN = 7;

export class City {
  constructor(scene, ctx) {
    this.plate = ctx.plate;
    const rng = mulberry32(42);
    this.group = new THREE.Group(); scene.add(this.group);
    const th0 = R.s2Th0, th1 = R.s2Th1;
    const relA = (a) => { let d = (a - th0) % TAU; if (d < 0) d += TAU; return d; }; // angle ahead of the camera start (0..2pi)
    const passTime = (a) => B.awaken + ((B.complexity - B.awaken) * relA(a)) / (th1 - th0);

    // ================= TOWERS =================
    const bands = [
      { rIn: 121, rOut: 134, rows: 1, hMin: 7, hMax: 24, band: 1 },
      { rIn: 146, rOut: 177, rows: 2, hMin: 48, hMax: 150, band: 2 },
      { rIn: 207, rOut: 237, rows: 2, hMin: 32, hMax: 112, band: 3 },
      { rIn: 248, rOut: 292, rows: 2, hMin: 16, hMax: 66, band: 4 },
    ];
    const towers = []; this.towers = towers;
    const hero = { a: R.heroAngle, r: R.heroR };
    for (const bd of bands) {
      const rowDepth = (bd.rOut - bd.rIn) / bd.rows;
      for (let row = 0; row < bd.rows; row++) {
        const rMid = bd.rIn + rowDepth * (row + 0.5);
        const pitch = 17.5; const n = Math.floor((TAU * rMid) / pitch);
        for (let i = 0; i < n; i++) {
          const a = ((i + 0.5 + (row % 2) * 0.5) / n) * TAU;
          // avenues every 30 degrees
          const dAv = Math.abs(((a + TAU / 24) % (TAU / 12)) - TAU / 24); if (dAv * rMid < 9.5) continue;
          // hero plot and its neighbours
          const hx = Math.cos(a) * rMid - Math.cos(hero.a) * hero.r, hz = Math.sin(a) * rMid - Math.sin(hero.a) * hero.r; const dHero = Math.hypot(hx, hz); if ((bd.band === 2 && dHero < 64) || (bd.band === 3 && dHero < 58)) continue; // the hero stands on an open plaza
          const sky = 0.55 + 0.45 * Math.pow(Math.abs(Math.sin(a * 2.0 + bd.band)), 1.5) * (0.6 + 0.4 * Math.sin(a * 5.0 + 1.3));
          const h = bd.hMin + Math.pow(rng(), 1.3) * (bd.hMax - bd.hMin) * sky;
          const rad = Math.min(rowDepth * 0.78, 9 + rng() * 7), tan = Math.min(pitch * 0.66, 9 + rng() * 6);
          const nSeg = Math.max(2, Math.min(8, Math.round(h / 18) + (rng() < 0.4 ? 1 : 0)));
          const segs = []; let y0 = 0; let rem = h;
          for (let s = 0; s < nSeg; s++) {
            const hs = s === nSeg - 1 ? rem : Math.max(5, (h / nSeg) * (0.7 + rng() * 0.6)); rem -= hs;
            const set = 1 - 0.05 * s * rng();
            segs.push({ y0, h: Math.max(4, hs), rad: rad * set, tan: tan * set, glass: (s + (rng() < 0.5 ? 1 : 0)) % 2 === 0 });
            y0 += Math.max(4, hs);
            if (rem <= 4) break;
          }
          const t0 = passTime(a);
          const start = relA(a) > th1 - th0 + 0.6 && relA(a) < TAU - 0.4 ? Math.min(8.1, 4.1 + rng() * 2.8 + (relA(a) / TAU) * 1.4) : Math.max(B.awaken - 0.3, Math.min(8.1, t0 - 1.5 - rng() * 0.4));
          towers.push({ a, r: rMid, x: Math.cos(a) * rMid, z: Math.sin(a) * rMid, h, rad, tan, segs, band: bd.band, start, dStart: B.descend + (4 - bd.band) * 0.9 + rng() * 0.35, piston: { amp: bd.band === 2 ? 4 + rng() * 6 : bd.band === 3 ? 2 + rng() * 3 : 1 + rng() * 1.5, f: 0.12 + rng() * 0.1, ph: rng() * TAU }, collarR: Math.max(rad, tan) * 0.72, collarW: (rng() < 0.5 ? 1 : -1) * (0.15 + rng() * 0.25), seed: rng(), awakenDelay: relA(a) / (th1 - th0) });
        }
      }
    }
    // hour pylons at r=262 on the avenues
    this.pylons = [];
    for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; this.pylons.push({ a, x: Math.cos(a) * 262, z: Math.sin(a) * 262, h: 140, start: Math.max(4.2, Math.min(8.2, passTime(a) - 1.6)), dStart: 22.0 + k * 0.07 }); }

    let nGlass = 0, nMetal = 0;
    for (const tw of towers) for (const sg of tw.segs) { if (sg.glass) sg.index = nGlass++; else sg.index = nMetal++; }
    this.segGlass = new Inst(BOXB, MATS.glassTower, nGlass, { attrs: { aSize: 3, aInfo: 4, aGlow: 1 } });
    this.segMetal = new Inst(BOXB, MATS.titaniumSeams, nMetal, { attrs: { aSize: 3, aInfo: 4, aGlow: 1 } });
    // note: BOXB is shared between the two Inst; attributes were attached to the same geometry => clone geometries per Inst
    this.segGlass.mesh.geometry = BOXB.clone(); this.segMetal.mesh.geometry = BOXB.clone();
    for (const [inst, name] of [[this.segGlass, 'aSize'], [this.segMetal, 'aSize']]) { /* re-attach attrs to the cloned geometry */ for (const [an, attr] of Object.entries(inst.attrs)) inst.mesh.geometry.setAttribute(an, attr); }
    for (const tw of towers) for (const sg of tw.segs) {
      const inst = sg.glass ? this.segGlass : this.segMetal;
      inst.attrs.aSize.setXYZ(sg.index, sg.rad, sg.h, sg.tan);
      inst.attrs.aInfo.setXYZW(sg.index, tw.seed * 100 + sg.y0, tw.awakenDelay, Math.floor(tw.seed * 3), 0);
      inst.attrs.aGlow.setX(sg.index, 0);
    }
    this.segGlass.commitAttr('aSize'); this.segGlass.commitAttr('aInfo'); this.segGlass.commitAttr('aGlow');
    this.segMetal.commitAttr('aSize'); this.segMetal.commitAttr('aInfo'); this.segMetal.commitAttr('aGlow');
    this.group.add(this.segGlass.mesh, this.segMetal.mesh);
    // collars (gear discs at the base of every tower), roof spires, edge strips
    const collarGeo = makeGearLite(14, 12, 2.6, { tooth: 0.14, hole: 0.22 }); collarGeo.rotateX(-Math.PI / 2);
    this.collars = new Inst(collarGeo, MATS.titaniumDark, towers.length, { attrs: { aGlow: 1 } });
    this.spires = new Inst(new THREE.CylinderGeometry(0.35, 0.6, 1, 8).translate(0, 0.5, 0), MATS.aluminum, towers.length);
    this.strips = new Inst(BOXB, MATS.glowCyan, towers.length * 2, { color: true });
    this.beacons = new Inst(new THREE.SphereGeometry(0.6, 8, 6), MATS.glowOrange, towers.length, { color: true });
    this.roofBoxes = new Inst(BOXB, MATS.titaniumDark, towers.length * 2);
    this.crowns = new Inst(new THREE.TorusGeometry(1, 0.08, 5, 24).rotateX(Math.PI / 2), MATS.aluminum, towers.length);
    for (const tw of towers) { tw.roof = [[(rng() - 0.5) * 0.5, (rng() - 0.5) * 0.5, 2 + rng() * 2.5, 1.5 + rng() * 2], [(rng() - 0.5) * 0.5, (rng() - 0.5) * 0.5, 1.5 + rng() * 2, 0.8 + rng() * 1.5]]; tw.crown = rng() < 0.45; }
    this.group.add(this.collars.mesh, this.spires.mesh, this.strips.mesh, this.beacons.mesh, this.roofBoxes.mesh, this.crowns.mesh);
    // hour pylons
    this.pylonBody = new Inst(BOXB, MATS.titaniumSeams, 12, { attrs: { aSize: 3, aInfo: 4, aGlow: 1 } });
    this.pylonBody.mesh.geometry = BOXB.clone(); for (const [an, attr] of Object.entries(this.pylonBody.attrs)) this.pylonBody.mesh.geometry.setAttribute(an, attr);
    for (let k = 0; k < 12; k++) { this.pylonBody.attrs.aSize.setXYZ(k, 6, 140, 6); this.pylonBody.attrs.aInfo.setXYZW(k, k * 7.1, 0, 0, 0); }
    this.pylonBody.commitAttr('aSize'); this.pylonBody.commitAttr('aInfo');
    this.pylonStrips = new Inst(BOXB, MATS.glowCyan, 48, { color: true });
    this.group.add(this.pylonBody.mesh, this.pylonStrips.mesh);

    // ================= BRIDGES =================
    const bridges = []; this.bridges = bridges;
    const byBand = {}; for (const tw of towers) { (byBand[tw.band] ||= []).push(tw); }
    const pairs = [[1, 2, 140], [2, 3, 190], [3, 4, 240]];
    for (const [bi, bo, ring] of pairs) {
      const inner = byBand[bi].filter((t) => t.r < ring && ring - t.r < 24), outer = byBand[bo].filter((t) => t.r > ring && t.r - ring < 24);
      for (const ti of inner) {
        if (ti.h < 30) continue;
        let best = null, bd = 1e9;
        for (const to of outer) { const d = Math.abs(Math.atan2(Math.sin(to.a - ti.a), Math.cos(to.a - ti.a))); if (d < bd && to.h > 30) { bd = d; best = to; } }
        if (!best || bd * ring > 4.5) continue;
        const y = 18 + rng() * 6;
        if (y > Math.min(ti.h, best.h) - 6) continue;
        const a = (ti.a + best.a) / 2; const r0 = ti.r + ti.rad / 2 - 0.5, r1 = best.r - best.rad / 2 + 0.5;
        bridges.push({ a, r0, L: r1 - r0, y, start: Math.max(ti.start, best.start) + 0.7 + rng() * 0.3, dStart: Math.min(ti.dStart, best.dStart) - 0.2 });
        if (bridges.length >= 110) break;
      }
    }
    this.bridgeInst = new Inst(BOX, MATS.titanium, Math.max(1, bridges.length), { attrs: { aGlow: 1 } });
    this.bridgeInst.mesh.geometry = BOX.clone(); this.bridgeInst.mesh.geometry.setAttribute('aGlow', this.bridgeInst.attrs.aGlow);
    this.bridgeLights = new Inst(BOX, MATS.glowCyan, Math.max(1, bridges.length), { color: true });
    this.group.add(this.bridgeInst.mesh, this.bridgeLights.mesh);

    // ================= TRACKS =================
    this.nRing = 180;
    this.deck = new Inst(BOX, MATS.aluminum, this.nRing, { attrs: { aGlow: 1 } }); this.deck.mesh.geometry = BOX.clone(); this.deck.mesh.geometry.setAttribute('aGlow', this.deck.attrs.aGlow);
    this.rails = new Inst(BOX, MATS.titaniumDark, this.nRing * 2);
    this.ringPylons = new Inst(BOXB, MATS.titaniumDark, 60);
    this.nSpokePieces = 24; this.spokeDeck = new Inst(BOX, MATS.aluminum, 12 * this.nSpokePieces, { attrs: { aGlow: 1 } }); this.spokeDeck.mesh.geometry = BOX.clone(); this.spokeDeck.mesh.geometry.setAttribute('aGlow', this.spokeDeck.attrs.aGlow);
    this.spokePylons = new Inst(BOXB, MATS.titaniumDark, 12 * 11);
    this.group.add(this.deck.mesh, this.rails.mesh, this.ringPylons.mesh, this.spokeDeck.mesh, this.spokePylons.mesh);
    // trains
    this.nTrains = 24; this.trainBody = new Inst(BOX, MATS.titaniumDark, this.nTrains * 3); this.trainLight = new Inst(BOX, MATS.glowCyan, this.nTrains * 3, { color: true });
    this.trainBase = []; for (let k = 0; k < this.nTrains; k++) this.trainBase.push((k / this.nTrains) * TAU + rng() * 0.08);
    this.spokeTrainBody = new Inst(BOX, MATS.titaniumDark, 24 * 2); this.spokeTrainLight = new Inst(BOX, MATS.glowCyan, 24 * 2, { color: true });
    this.spokeTrainOff = []; for (let k = 0; k < 24; k++) this.spokeTrainOff.push(rng() * 220);
    this.group.add(this.trainBody.mesh, this.trainLight.mesh, this.spokeTrainBody.mesh, this.spokeTrainLight.mesh);

    // ================= STREETS =================
    this.ringRoads = [{ r: 140, w: 0.035 }, { r: 190, w: -0.025 }, { r: 240, w: 0.018 }];
    this.roadSlabs = new Inst(BOX, MATS.gearDark, 3 * 72); this.laneDash = new Inst(BOX, MATS.glowCyan, 3 * 144 * 2, { color: true });
    this.avenues = new Inst(BOX, MATS.gearDark, 12); this.avenueDash = new Inst(BOX, MATS.glowCyan, 12 * 20, { color: true });
    for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; const r0 = R.glassOut + 2, r1 = R.outer; this.avenues.set(k, Math.cos(a) * (r0 + r1) / 2, 0.3, Math.sin(a) * (r0 + r1) / 2, 0, -a, 0, r1 - r0, 0.6, 14); for (let j = 0; j < 20; j++) { const rr = r0 + 6 + j * 8.6; this.avenueDash.set(k * 20 + j, Math.cos(a) * rr, 0.65, Math.sin(a) * rr, 0, -a, 0, 4, 0.15, 0.35); this.avenueDash.setColor(k * 20 + j, 0.3, 0.75, 0.95); } }
    this.avenues.commit(); this.avenueDash.commit(true);
    this.group.add(this.roadSlabs.mesh, this.laneDash.mesh, this.avenues.mesh, this.avenueDash.mesh);
    // vehicles
    this.nVeh = 300; this.vehicles = new Inst(BOX, MATS.glowWhite, this.nVeh, { color: true });
    this.veh = []; for (let i = 0; i < this.nVeh; i++) { const onRing = i < 180; const ring = this.ringRoads[i % 3]; this.veh.push({ onRing, ring, base: rng() * TAU, dir: rng() < 0.5 ? 1 : -1, speed: 0.05 + rng() * 0.06, lane: (rng() < 0.5 ? 1 : -1) * ((i % 3) === 1 ? 8.5 : 3.2), av: i % 12, off: rng() * 170, v: 25 + rng() * 30, col: rng() < 0.65 ? [1.3, 1.1, 0.85] : rng() < 0.5 ? [0.4, 0.95, 1.2] : [1.3, 0.5, 0.15], appear: 4.6 + rng() * 3.5 }); }
    this.group.add(this.vehicles.mesh);

    // ================= BEZEL =================
    const bezel = new THREE.Mesh(makeAnnulus(R.bezelIn, R.bezelOut, 6, 128), MATS.titanium); bezel.rotation.x = -Math.PI / 2; bezel.position.y = 0; this.group.add(bezel);
    const bezelIn = new THREE.Mesh(makeAnnulus(R.outer, R.bezelIn, 3, 128), MATS.gearDark); bezelIn.rotation.x = -Math.PI / 2; bezelIn.position.y = -1; this.group.add(bezelIn);
    this.marks60 = new Inst(BOX, MATS.glowWhite, 60, { color: true }); this.marks12 = new Inst(BOX, MATS.glowWhite, 12, { color: true }); this.ticks = new Inst(BOX, MATS.glowWhite, 300, { color: true });
    for (let k = 0; k < 60; k++) { const a = (k / 60) * TAU; const big = k % 5 === 0; this.marks60.set(k, Math.cos(a) * 311, 3.35, Math.sin(a) * 311, 0, -a, 0, big ? 0.01 : 6, 0.6, big ? 0.01 : 1.0); }
    for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; this.marks12.set(k, Math.cos(a) * 311, 3.5, Math.sin(a) * 311, 0, -a, 0, 13, 0.9, 2.6); }
    for (let k = 0; k < 300; k++) { const a = (k / 300) * TAU; this.ticks.set(k, Math.cos(a) * 319.6, 3.2, Math.sin(a) * 319.6, 0, -a, 0, 2.4, 0.3, 0.3); }
    this.marks60.commit(); this.marks12.commit(); this.ticks.commit();
    this.group.add(this.marks60.mesh, this.marks12.mesh, this.ticks.mesh);
    this.wave = { r: -1000, w: 30, i: 0 };
  }

  waveGlow(x, z) { const w = this.wave; if (w.i <= 0) return 0; const d = Math.hypot(x, z) - w.r; return Math.exp(-(d * d) / (w.w * w.w)) * w.i; }

  update(t, ctx) {
    this.wave = waveState(t); if (typeof window !== 'undefined' && window.__noWave) this.wave = { r: -1000, w: 30, i: 0 };
    const plate = this.plate;
    const pistonEnv = span(t, 5.2, 7.2, E.inOutSine) * (1 - span(t, B.transform, B.transform + 1.4, E.inOutSine));
    const spin = rampInt(Math.min(t, 21.6) - 4.5, 1.2);
    const clockLock = span(t, B.tiers, B.tiers + 0.8, E.inOutCubic);
    // ---- towers ----
    for (let j = 0; j < this.towers.length; j++) {
      const tw = this.towers[j];
      const lift = plate.bandLift(tw.r);
      const yP = tw.piston.amp * Math.sin(TAU * tw.piston.f * t + tw.piston.ph) * pistonEnv;
      const n = tw.segs.length;
      let built = 1, visibleTop = 0;
      for (let i = 0; i < n; i++) {
        const sg = tw.segs[i];
        const p = span(t, tw.start + i * 0.1, tw.start + i * 0.1 + 0.6, E.outExpo);
        const q = span(t, tw.dStart + (n - 1 - i) * 0.08, tw.dStart + (n - 1 - i) * 0.08 + 0.75, E.inOutCubic);
        built = Math.min(built, p * (1 - q));
        const fromAbove = i % 2 === 1 && i >= 1;
        let yOff = fromAbove ? (1 - p) * 140 : -(sg.y0 + sg.h + 1.5) * (1 - p);
        yOff -= (sg.y0 + sg.h + 1.5) * q;
        const rot = (1 - p) * (Math.PI / 2) * (fromAbove ? -1 : 1);
        const inst = sg.glass ? this.segGlass : this.segMetal;
        const sc = p <= 0 && q <= 0 ? 0 : 1;
        inst.set(sg.index, tw.x, lift + yP + sg.y0 + yOff, tw.z, 0, -tw.a + rot, 0, sg.rad * sc, sg.h * sc, sg.tan * sc);
        if (p > 0.99 && q < 0.01) visibleTop = sg.y0 + sg.h;
      }
      // collar: gear disc rotating as the tower's axle
      const ca = tw.collarW * spin + (clockLock > 0 ? 0 : 0);
      const cs = tw.collarR / 12;
      this.collars.set(j, tw.x, lift + 0.2 + yP * 0.15, tw.z, 0, ca - tw.a, 0, cs, 1, cs);
      // spire & beacon
      const topY = lift + yP + visibleTop; const spireH = Math.min(14, tw.h * 0.15); const vb = built > 1e-4 ? 1 : 0;
      this.spires.set(j, tw.x, topY, tw.z, 0, 0, 0, vb, spireH * built, vb);
      {
        const top = tw.segs[tw.segs.length - 1]; const fr = top.rad * 0.9, ft = top.tan * 0.9;
        for (let e = 0; e < 2; e++) { const rb = tw.roof[e]; const lx = rb[0] * fr, lz = rb[1] * ft; const wx = tw.x + Math.cos(tw.a) * lx - Math.sin(tw.a) * lz, wz = tw.z + Math.sin(tw.a) * lx + Math.cos(tw.a) * lz; this.roofBoxes.set(j * 2 + e, wx, topY, wz, 0, -tw.a, 0, rb[2] * vb, rb[3] * built, rb[2] * 0.7 * vb); }
        const cr = tw.crown ? Math.min(fr, ft) * 0.55 * vb : 0; this.crowns.set(j, tw.x, topY + 1.2 * built, tw.z, 0, 0, 0, cr, cr, cr);
      }
      this.beacons.set(j, tw.x, topY + spireH * built, tw.z, 0, 0, 0, built);
      const awake = span(t, tw.start + 0.9, tw.start + 1.8) * built;
      const g = this.waveGlow(tw.x, tw.z);
      const bk = awake * (0.8 + 0.2 * Math.sin(t * 2.0 + tw.seed * 9));
      this.beacons.setColor(j, 3 * bk + 1.5 * g, 1.2 * bk + 1.0 * g, 0.3 * bk + 0.8 * g);
      // edge strips at the outer corners
      const sh = tw.h * 0.92 * built;
      for (let e = 0; e < 2; e++) {
        const lx = tw.rad / 2 * 0.98, lz = (e ? 1 : -1) * tw.tan / 2 * 0.98;
        const wx = tw.x + Math.cos(tw.a) * lx - Math.sin(tw.a) * lz, wz = tw.z + Math.sin(tw.a) * lx + Math.cos(tw.a) * lz;
        this.strips.set(j * 2 + e, wx, lift + yP + 1, wz, 0, -tw.a, 0, 0.35 * vb, sh, 0.35 * vb);
        const c = awake * (0.5 + 0.5 * tw.seed) + 0.6 * g;
        this.strips.setColor(j * 2 + e, 0.35 * c + g, 0.85 * c + g, 1.1 * c + g);
      }
    }
    this.segGlass.commit(); this.segMetal.commit(); this.collars.commit(); this.spires.commit(); this.strips.commit(true); this.beacons.commit(true); this.roofBoxes.commit(); this.crowns.commit();
    // ---- hour pylons ----
    for (let k = 0; k < 12; k++) {
      const py = this.pylons[k];
      const p = span(t, py.start, py.start + 0.9, E.outExpo), q = span(t, py.dStart, py.dStart + 1.1, E.inOutCubic);
      const h = py.h * p * (1 - q); const lift = plate.bandLift(262);
      this.pylonBody.set(k, py.x, lift, py.z, 0, -py.a + (1 - p) * Math.PI, 0, 6, Math.max(0.01, h), 6);
      const g = this.waveGlow(py.x, py.z); const on = span(t, py.start + 0.7, py.start + 1.4) * (1 - q);
      for (let e = 0; e < 4; e++) {
        const sx = (e & 1 ? 1 : -1) * 3.05, sz = (e & 2 ? 1 : -1) * 3.05;
        this.pylonStrips.set(k * 4 + e, py.x + Math.cos(py.a) * sx - Math.sin(py.a) * sz, lift + 0.5, py.z + Math.sin(py.a) * sx + Math.cos(py.a) * sz, 0, -py.a, 0, 0.4, Math.max(0.01, h - 1), 0.4);
        const c = on * 0.9 + 0.7 * g; this.pylonStrips.setColor(k * 4 + e, 0.35 * c, 0.9 * c, 1.1 * c);
      }
    }
    this.pylonBody.commit(); this.pylonStrips.commit(true);
    // ---- bridges ----
    for (let k = 0; k < this.bridges.length; k++) {
      const b = this.bridges[k];
      const p = span(t, b.start, b.start + 0.8, E.outBack), q = span(t, b.dStart, b.dStart + 0.7, E.inCubic);
      const th = (1 - p) * (Math.PI / 2) + q * (Math.PI / 2);
      const y = b.y + plate.bandLift(b.r0);
      _p.set(Math.cos(b.a) * b.r0, y, Math.sin(b.a) * b.r0); _e.set(0, -b.a, 0); _q.setFromEuler(_e); _s.set(1, 1, 1);
      _m.compose(_p, _q, _s); _m2.makeRotationZ(th); _m.multiply(_m2); _m2.makeTranslation(b.L / 2, 0, 0); _m.multiply(_m2);
      const vis = p > 1e-4 && q < 1 - 1e-4 ? 1 : 0;
      _m2.makeScale(b.L * vis, 1.4 * vis, 3.2 * vis); _m2.premultiply(_m); this.bridgeInst.setMatrix(k, _m2);
      _m2.makeTranslation(0, -0.85, 0); _m2.premultiply(_m); const m3 = _m2.clone(); _m2.makeScale(b.L * 0.95 * vis, 0.25 * vis, 1.2 * vis); _m2.premultiply(m3); this.bridgeLights.setMatrix(k, _m2);
      const g = this.waveGlow(Math.cos(b.a) * b.r0, Math.sin(b.a) * b.r0); const on = span(t, b.start + 0.6, b.start + 1.2) * (1 - q);
      this.bridgeLights.setColor(k, 0.3 * on + 0.8 * g, 0.8 * on + 0.8 * g, 1.0 * on + 0.8 * g);
    }
    this.bridgeInst.commit(); this.bridgeLights.commit(true);
    // ---- tracks ----
    const trackY = lerp(R.trackY, 4, span(t, 22.5, 24.5, E.inOutCubic));
    const trackR = R.trackR;
    for (let k = 0; k < this.nRing; k++) {
      const a = (k / this.nRing) * TAU + Math.PI / this.nRing;
      const p = span(t, 5.2 + k * 0.011, 5.2 + k * 0.011 + 0.35, E.outCubic);
      const r = trackR - (1 - p) * 14; const len = (TAU * trackR) / this.nRing * 0.92;
      const ang = -a - Math.PI / 2; const vis = p > 1e-4 ? 1 : 0;
      this.deck.set(k, Math.cos(a) * r, trackY, Math.sin(a) * r, 0, ang, 0, len * vis, 0.6 * vis, 4.6 * vis);
      for (let e = 0; e < 2; e++) { const rr = r + (e ? 1.7 : -1.7); this.rails.set(k * 2 + e, Math.cos(a) * rr, trackY + 0.55, Math.sin(a) * rr, 0, ang, 0, len * 1.02 * vis, 0.5 * vis, 0.5 * vis); }
    }
    for (let k = 0; k < 60; k++) { const a = (k / 60) * TAU; const p = span(t, 4.9 + k * 0.03, 4.9 + k * 0.03 + 0.5, E.outCubic); this.ringPylons.set(k, Math.cos(a) * trackR, 0, Math.sin(a) * trackR, 0, -a, 0, 2.4, Math.max(0.01, (trackY - 0.6) * p), 2.4); }
    this.deck.commit(); this.rails.commit(); this.ringPylons.commit();
    const spokeRetract = span(t, 23.0, 24.6, E.inOutCubic);
    for (let s = 0; s < 12; s++) {
      const a = (s / 12) * TAU; const r0 = 62, r1 = R.outer - 2; const len = (r1 - r0) / this.nSpokePieces;
      for (let k = 0; k < this.nSpokePieces; k++) {
        const p = span(t, 4.8 + s * 0.12 + k * 0.035, 4.8 + s * 0.12 + k * 0.035 + 0.4, E.outCubic) * (1 - spokeRetract);
        const rc = r0 + (k + 0.5) * len; const r = r0 + (rc - r0) * p; const vis = p > 0.001 ? 1 : 0;
        this.spokeDeck.set(s * this.nSpokePieces + k, Math.cos(a) * r, R.trackY, Math.sin(a) * r, 0, -a, 0, len * 0.9 * vis, 0.6 * vis, 3.2 * vis);
      }
      for (let k = 0; k < 11; k++) { const rr = r0 + 10 + k * 20; const p = span(t, 4.9 + s * 0.12 + k * 0.08, 4.9 + s * 0.12 + k * 0.08 + 0.4, E.outCubic) * (1 - spokeRetract); this.spokePylons.set(s * 11 + k, Math.cos(a) * rr, 0, Math.sin(a) * rr, 0, -a, 0, 1.8, Math.max(0.01, (R.trackY - 0.6) * p), 1.8); }
    }
    this.spokeDeck.commit(); this.spokePylons.commit();
    // ---- trains ----
    const park = span(t, 23.0, 25.0, E.inOutCubic);
    for (let k = 0; k < this.nTrains; k++) {
      const free = (tt) => this.trainBase[k] + 0.11 * rampInt(tt - 5.6, 0.8);
      let ang = free(t);
      if (park > 0) { const target = Math.round(free(23.0) / (TAU / 24)) * (TAU / 24); ang = lerp(free(t), target, park); }
      const ap = span(t, 5.6 + k * 0.05, 5.6 + k * 0.05 + 0.5, E.outBack);
      const g = this.waveGlow(Math.cos(ang) * trackR, Math.sin(ang) * trackR);
      for (let c = 0; c < 3; c++) {
        const a = ang - (c * (CAR_LEN + 0.7)) / trackR; const x = Math.cos(a) * trackR, z = Math.sin(a) * trackR; const rot = -a - Math.PI / 2;
        this.trainBody.set(k * 3 + c, x, trackY + 2.0, z, 0, rot, 0, CAR_LEN * ap, 2.4 * ap, 2.6 * ap);
        this.trainLight.set(k * 3 + c, x, trackY + 2.2, z, 0, rot, 0, CAR_LEN * 0.9 * ap, 0.5 * ap, 2.75 * ap);
        const cw = park; this.trainLight.setColor(k * 3 + c, lerp(0.4, 1.6, cw) + 0.8 * g, lerp(1.0, 1.6, cw) + 0.8 * g, lerp(1.3, 1.7, cw) + 0.8 * g);
      }
    }
    this.trainBody.commit(); this.trainLight.commit(true);
    const stGone = span(t, 23.0, 24.0, E.inCubic);
    for (let k = 0; k < 24; k++) {
      const s = k % 12; const a = (s / 12) * TAU; const dir = k < 12 ? 1 : -1;
      const ap = span(t, 6.2 + k * 0.08, 6.2 + k * 0.08 + 0.4, E.outCubic) * (1 - stGone);
      const u = ((dir * 42 * (t - 6) + this.spokeTrainOff[k]) % 220 + 220) % 220; const r = 70 + u;
      const lane = dir > 0 ? 1.0 : -1.0;
      for (let c = 0; c < 2; c++) { const rr = r - c * (CAR_LEN + 0.7) * dir; const x = Math.cos(a) * rr - Math.sin(a) * lane, z = Math.sin(a) * rr + Math.cos(a) * lane; this.spokeTrainBody.set(k * 2 + c, x, R.trackY + 1.9, z, 0, -a, 0, CAR_LEN * ap, 2.2 * ap, 2.2 * ap); this.spokeTrainLight.set(k * 2 + c, x, R.trackY + 2.1, z, 0, -a, 0, CAR_LEN * 0.9 * ap, 0.45 * ap, 2.35 * ap); this.spokeTrainLight.setColor(k * 2 + c, 1.3, 0.6, 0.2); }
    }
    this.spokeTrainBody.commit(); this.spokeTrainLight.commit(true);
    // ---- ring streets (slide along their tracks) ----
    let li = 0;
    for (let ri = 0; ri < 3; ri++) {
      const rd = this.ringRoads[ri]; const off = rd.w * spin; const lift = plate.bandLift(rd.r);
      for (let k = 0; k < 72; k++) { const a = (k / 72) * TAU + off; const len = (TAU * rd.r) / 72 * 0.96; this.roadSlabs.set(ri * 72 + k, Math.cos(a) * rd.r, lift + 0.3, Math.sin(a) * rd.r, 0, -a - Math.PI / 2, 0, len, 0.6, ri === 1 ? 22 : 9.5); }
      for (let k = 0; k < 144; k++) { const a = (k / 144) * TAU + off; for (let e = 0; e < 2; e++) { const rr = rd.r + (e ? 1 : -1) * (ri === 1 ? 8.5 : 3.2); const len = (TAU * rr) / 144 * 0.5; this.laneDash.set(li, Math.cos(a) * rr, lift + 0.65, Math.sin(a) * rr, 0, -a - Math.PI / 2, 0, len, 0.15, 0.35); const g = this.waveGlow(Math.cos(a) * rr, Math.sin(a) * rr); const on = span(t, 4.3 + (k / 144) * 2.5, 4.9 + (k / 144) * 2.5); this.laneDash.setColor(li, 0.3 * on + 0.8 * g, 0.75 * on + 0.8 * g, 0.95 * on + 0.8 * g); li++; } }
    }
    this.roadSlabs.commit(); this.laneDash.commit(true);
    // ---- vehicles ----
    const vehGone = span(t, 21.8, 23.0, E.inCubic);
    for (let i = 0; i < this.nVeh; i++) {
      const v = this.veh[i]; const ap = span(t, v.appear, v.appear + 0.3, E.outCubic) * (1 - vehGone);
      let x, z, rot;
      if (v.onRing) { const a = v.base + v.dir * v.speed * rampInt(t - 4.6, 1.0) + v.ring.w * spin; const rr = v.ring.r + v.lane; x = Math.cos(a) * rr; z = Math.sin(a) * rr; rot = -a - Math.PI / 2; }
      else { const a = (v.av / 12) * TAU; const u = ((v.v * (t - 4.6) * v.dir + v.off) % 170 + 170) % 170; const rr = R.glassOut + 4 + u; x = Math.cos(a) * rr - Math.sin(a) * v.lane; z = Math.sin(a) * rr + Math.cos(a) * v.lane; rot = -a; }
      const lift = plate.bandLift(Math.hypot(x, z));
      this.vehicles.set(i, x, lift + 1.0, z, 0, rot, 0, 2.4 * ap, 0.8 * ap, 1.2 * ap);
      const g = this.waveGlow(x, z); this.vehicles.setColor(i, v.col[0] + 0.8 * g, v.col[1] + 0.8 * g, v.col[2] + 0.8 * g);
    }
    this.vehicles.commit(true);
    // ---- bezel markings ----
    const dial = span(t, 24.5, 26.0, E.inOutCubic); const lockFlash = t >= B.lock ? Math.exp(-(t - B.lock) / 0.25) : 0;
    const base = 0.9 + 2.2 * dial + 3 * lockFlash;
    for (let k = 0; k < 60; k++) { const a = (k / 60) * TAU; const g = this.waveGlow(Math.cos(a) * 311, Math.sin(a) * 311); this.marks60.setColor(k, base + 2 * g, base + 2 * g, base * 1.05 + 2 * g); }
    for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; const g = this.waveGlow(Math.cos(a) * 311, Math.sin(a) * 311); const b = base * 1.3; this.marks12.setColor(k, b + 2 * g, b + 2 * g, b * 1.05 + 2 * g); }
    for (let k = 0; k < 300; k++) { const b = 0.35 + 0.8 * dial; this.ticks.setColor(k, b, b, b); }
    this.marks60.commit(true); this.marks12.commit(true); this.ticks.commit(true);
  }
}
