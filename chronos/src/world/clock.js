// CHRONOS — the clock: hands that slide out of the boss and sweep into position, hour indices rising from the dial, the orange pulse, one tick
import * as THREE from 'three';
import { makeHand, makeRing } from '../geometry.js';
import { MATS, makeGlow, makeAdditive } from '../materials.js';
import { Inst } from '../inst.js';
import { TAU, E, span, lerp, pulse, sat } from '../util.js';
import { BEATS as B, R } from '../timeline.js';

const BOX = new THREE.BoxGeometry(1, 1, 1);
// clock angle: phi clockwise from 12 (radians) -> world angle
const worldAngle = (phi) => -Math.PI / 2 + phi;

export class Clock {
  constructor(scene, ctx) {
    this.group = new THREE.Group(); scene.add(this.group);
    const hourMat = MATS.aluminum, minMat = MATS.aluminum;
    this.hour = new THREE.Mesh(makeHand(150, 15, 7, 3.2, 32), hourMat); this.hour.position.y = 22;
    this.minute = new THREE.Mesh(makeHand(238, 11, 4.5, 2.6, 38), minMat); this.minute.position.y = 25.2;
    this.secondMat = makeGlow(0xffffff); this.secondMat.color.setRGB(0.6, 1.5, 1.9);
    this.second = new THREE.Mesh(makeHand(262, 1.8, 1.2, 1.0, 72), this.secondMat); this.second.position.y = 28;
    this.secondWeight = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 1.2, 24), this.secondMat); this.secondWeight.position.set(-60, 28, 0);
    // glow stripes along the hour / minute hands
    this.hourGlow = new THREE.Mesh(BOX, makeGlow(0xffffff)); this.hourGlow.material.color.setRGB(2.4, 0.9, 0.25);
    this.minGlow = new THREE.Mesh(BOX, makeGlow(0xffffff)); this.minGlow.material.color.setRGB(2.4, 0.9, 0.25);
    this.hourGroup = new THREE.Group(); this.hourGroup.add(this.hour, this.hourGlow); this.hourGlow.position.set(68, 23.9, 0); this.hourGlow.scale.set(120, 0.4, 2.2);
    this.minGroup = new THREE.Group(); this.minGroup.add(this.minute, this.minGlow); this.minGlow.position.set(110, 26.7, 0); this.minGlow.scale.set(200, 0.35, 1.5);
    this.secGroup = new THREE.Group(); this.secGroup.add(this.second, this.secondWeight);
    this.group.add(this.hourGroup, this.minGroup, this.secGroup);
    // central boss and jewel
    this.boss = new THREE.Mesh(new THREE.CylinderGeometry(13, 14.5, 4, 48), MATS.titanium); this.boss.position.y = 21; this.group.add(this.boss);
    this.cap = new THREE.Mesh(new THREE.CylinderGeometry(3.5, 3.5, 1.2, 24), makeGlow(0xffffff)); this.cap.material.color.setRGB(2.5, 0.9, 0.2); this.cap.position.y = 29.2; this.group.add(this.cap);
    // hour indices
    this.indices = new Inst(BOX, MATS.aluminum, 12); this.indexGlow = new Inst(BOX, MATS.glowWhite, 12, { color: true }); this.group.add(this.indices.mesh, this.indexGlow.mesh);
    // minute track ring at the chapter ring radius
    this.chapter = new THREE.Mesh(makeRing(R.trackR, 0.6, 160, 6), MATS.titanium); this.chapter.rotation.x = Math.PI / 2; this.chapter.position.y = 4.4; this.chapter.visible = false; this.group.add(this.chapter);
    // orange pulse ring on the dial
    this.pulseMat = makeAdditive(0xffffff, 0); this.pulseMat.color.setRGB(1.0, 0.5, 0.15);
    this.pulseRing = new THREE.Mesh(new THREE.RingGeometry(0.85, 1.0, 128), this.pulseMat); this.pulseRing.rotation.x = -Math.PI / 2; this.pulseRing.position.y = 1.2; this.pulseRing.visible = false; this.group.add(this.pulseRing);
    this.group.visible = false;
  }

  update(t, ctx) {
    const on = t >= B.indices - 0.2;
    this.group.visible = on; if (!on) return;
    const plate = ctx.plate;
    // ---- hands: slide out, then sweep to 10:10:30; the second hand ticks once at B.tick ----
    const outH = span(t, B.hands, B.hands + 0.9, E.outExpo), outM = span(t, B.hands + 0.25, B.hands + 1.15, E.outExpo), outS = span(t, B.hands + 0.5, B.hands + 1.3, E.outExpo);
    const sweep = span(t, B.hands + 0.4, B.lock - 0.1, E.inOutQuint);
    const phiH = (10 + 10.5 / 60) * (TAU / 12), phiM = 10.5 * (TAU / 60), phiS0 = 30 * (TAU / 60);
    const tick = span(t, B.tick, B.tick + 0.09, E.snap) * (TAU / 60);
    const aH = worldAngle(lerp(0, phiH, sweep)), aM = worldAngle(lerp(0, phiM, sweep)), aS = worldAngle(lerp(0, phiS0, sweep) + tick);
    this.hourGroup.rotation.y = -aH; this.hourGroup.scale.set(Math.max(0.001, outH), 1, 1);
    this.minGroup.rotation.y = -aM; this.minGroup.scale.set(Math.max(0.001, outM), 1, 1);
    this.secGroup.rotation.y = -aS; this.secGroup.scale.set(Math.max(0.001, outS), 1, 1);
    const bossUp = span(t, B.sphereDown + 1.2, B.sphereDown + 2.0, E.outBack);
    const bu = Math.max(0.001, bossUp); this.boss.scale.set(bu, bu, bu); this.cap.scale.setScalar(Math.max(0.001, bossUp));
    const orangePulse = t >= B.pulseOrange ? Math.exp(-(t - B.pulseOrange) / 0.5) : 0;
    this.cap.material.color.setRGB(2.5 + 8 * orangePulse, 0.9 + 3 * orangePulse, 0.2 + 0.6 * orangePulse);
    this.hourGlow.material.color.setRGB(2.4 + 6 * orangePulse, 0.9 + 2.4 * orangePulse, 0.25 + 0.6 * orangePulse);
    this.minGlow.material.color.copy(this.hourGlow.material.color);
    // ---- indices rise from the dial ----
    const flash = t >= B.lock ? Math.exp(-(t - B.lock) / 0.3) : 0;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * TAU; const p = span(t, B.indices + k * 0.09, B.indices + k * 0.09 + 0.7, E.outBack);
      const lift = plate.bandLift(272);
      const y = lerp(-6, 2.4 + lift, p);
      this.indices.set(k, Math.cos(a) * 272, y, Math.sin(a) * 272, 0, -a, 0, 18, 3, 4);
      this.indexGlow.set(k, Math.cos(a) * 272, y + 1.6, Math.sin(a) * 272, 0, -a, 0, 16.5, 0.35, 1.6);
      const b = 1.6 * p + 4 * flash + 2.5 * orangePulse * Math.exp(-Math.abs(((k * 30) - ((t - B.pulseOrange) * 600)) % 360) / 60);
      this.indexGlow.setColor(k, b, b, b * 1.05);
    }
    this.indices.commit(); this.indexGlow.commit(true);
    // ---- chapter ring appears when the track has descended ----
    const ch = span(t, 24.3, 25.0, E.outCubic); this.chapter.visible = ch > 0; this.chapter.scale.set(1, 1, Math.max(0.001, ch)); this.chapter.position.y = 4.4 + plate.bandLift(R.trackR);
    // ---- orange pulse travelling across the dial ----
    const pr = span(t, B.pulseOrange, B.pulseOrange + 0.9, E.outQuad);
    this.pulseRing.visible = pr > 0 && pr < 1; this.pulseRing.scale.setScalar(20 + 310 * pr); this.pulseMat.opacity = (1 - pr) * 0.55;
  }
}
