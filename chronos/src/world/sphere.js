// CHRONOS — the hidden system: a glass sphere above the hub holding the core — hundreds of rings, thousands of pieces, pulses of light — and the release
import * as THREE from 'three';
import { makeGear, makeRing } from '../geometry.js';
import { MATS, makeStandard, makeGlow, makeAdditive } from '../materials.js';
import { Inst } from '../inst.js';
import { TAU, E, span, mulberry32, sat, lerp, pulse, smoothstep } from '../util.js';
import { BEATS as B, R, waveState } from '../timeline.js';

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _q3 = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _m2 = new THREE.Matrix4(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _up = new THREE.Vector3(0, 1, 0);
const BOX = new THREE.BoxGeometry(1, 1, 1);
const rampInt = (u, tau) => (u <= 0 ? 0 : u - tau * (1 - Math.exp(-u / tau)));

export class Core {
  constructor(scene, ctx) {
    this.group = new THREE.Group(); scene.add(this.group);
    this.group.position.set(0, R.sphereY, 0);
    const rng = mulberry32(2024);
    const SR = R.sphereR;
    // ---- supports: shaft from the hub and three struts ----
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(5, 7, R.sphereY - SR + 6, 16), MATS.titaniumDark); shaft.position.y = -(R.sphereY - SR + 6) / 2 - SR + 6; this.group.add(shaft);
    for (let k = 0; k < 3; k++) { const a = (k / 3) * TAU + 0.5; const strut = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.8, 70, 8), MATS.titanium); strut.position.set(Math.cos(a) * 22, -SR - 10, Math.sin(a) * 22); strut.rotation.z = Math.cos(a) * 0.45; strut.rotation.x = -Math.sin(a) * 0.45; this.group.add(strut); }
    // ---- glass shell and frame ----
    this.glassMat = makeStandard({ color: 0x0b1016, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide }, { env: true });
    this.shell = new THREE.Mesh(new THREE.SphereGeometry(SR, 48, 28), this.glassMat); this.shell.renderOrder = 20; this.group.add(this.shell);
    const frame = new THREE.Group(); this.group.add(frame);
    for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(makeRing(SR + 0.5, 0.45, 72, 6), MATS.titanium); m.rotation.y = (k / 6) * Math.PI + Math.PI / 12; frame.add(m); }
    for (const lat of [-1.05, -0.52, 0.52, 1.05]) { const rr = (SR + 0.6) * Math.cos(lat); const m = new THREE.Mesh(makeRing(rr, 0.5, 96, 6), MATS.titanium); m.rotation.x = Math.PI / 2; m.position.y = (SR + 0.6) * Math.sin(lat); frame.add(m); }
    // ---- iris at +X ----
    this.blades = new Inst(BOX, MATS.bar, 8); this.bladeEdges = new Inst(BOX, MATS.glowCyan, 8, { color: true }); this.group.add(this.blades.mesh, this.bladeEdges.mesh);
    this.irisRing = new THREE.Mesh(makeRing(13.5, 1.0, 48, 8), MATS.titanium); this.irisRing.rotation.y = Math.PI / 2; this.irisRing.position.x = SR; this.group.add(this.irisRing);
    // ---- the core ----
    this.nRings = 120;
    this.rings = new Inst(makeRing(1, 0.011, 40, 5), MATS.gearSteel, this.nRings, { attrs: { aGlow: 1 } });
    this.rings.mesh.geometry = this.rings.mesh.geometry.clone(); this.rings.mesh.geometry.setAttribute('aGlow', this.rings.attrs.aGlow);
    this.ringData = [];
    for (let i = 0; i < this.nRings; i++) {
      const r = 6 + 20 * Math.pow(i / (this.nRings - 1), 0.85);
      const fam = i % 3;
      const base = new THREE.Quaternion().setFromEuler(new THREE.Euler(rng() * TAU, rng() * TAU, rng() * TAU));
      const axis = new THREE.Vector3(fam === 0 ? 1 : rng() - 0.5, fam === 1 ? 1 : rng() - 0.5, fam === 2 ? 1 : rng() - 0.5).normalize();
      const omega = (0.35 + 1.4 / Math.sqrt(r / 8)) * (rng() < 0.5 ? 1 : -1) * (0.7 + rng() * 0.6);
      const psi = (i / this.nRings) * Math.PI;
      const target = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, psi, Math.PI / 2)); // meridian: ring normal lies in the XZ plane
      this.ringData.push({ r, base, axis, omega, target, seed: rng() });
    }
    this.group.add(this.rings.mesh);
    // markers on rings (show the spin)
    this.nMark = this.nRings * 3; this.markers = new Inst(BOX, MATS.aluminum, this.nMark); this.group.add(this.markers.mesh);
    // pieces: 6 shells, Fibonacci sphere
    this.nPieces = 3000; this.pieces = new Inst(new THREE.OctahedronGeometry(0.6, 0), MATS.aluminum, this.nPieces, { attrs: { aGlow: 1 } });
    this.pieces.mesh.geometry = this.pieces.mesh.geometry.clone(); this.pieces.mesh.geometry.setAttribute('aGlow', this.pieces.attrs.aGlow);
    this.shells = []; this.pieceData = [];
    const perShell = 500;
    for (let s = 0; s < 6; s++) {
      const r = 9 + s * 3.0; const axis = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize(); const omega = (0.25 + 0.4 * rng()) * (s % 2 ? -1 : 1);
      this.shells.push({ r, axis, omega });
      for (let k = 0; k < perShell; k++) {
        const i = s * perShell + k; const y = 1 - (2 * (k + 0.5)) / perShell; const rr = Math.sqrt(1 - y * y); const phi = k * 2.399963;
        const dir = new THREE.Vector3(Math.cos(phi) * rr, y, Math.sin(phi) * rr);
        const q = new THREE.Quaternion().setFromUnitVectors(_up, dir);
        this.pieceData.push({ shell: s, dir, q, size: 0.6 + rng() * 0.7, lat: Math.asin(y), seed: rng() });
      }
    }
    this.group.add(this.pieces.mesh);
    // pulses riding the rings
    this.nPulse = 240; this.pulses = new Inst(new THREE.IcosahedronGeometry(0.45, 0), MATS.glowCyan, this.nPulse, { color: true }); this.group.add(this.pulses.mesh);
    this.pulseData = []; for (let j = 0; j < this.nPulse; j++) this.pulseData.push({ ring: j % this.nRings, a0: rng() * TAU, v: (1.5 + rng() * 2.5) * (rng() < 0.5 ? 1 : -1), orange: j % 6 === 0 });
    // beams with travelling light
    this.nBeam = 12; this.beamDirs = []; for (let k = 0; k < this.nBeam; k++) this.beamDirs.push(new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize());
    this.beams = new Inst(BOX, MATS.glowCyan, this.nBeam, { color: true }); this.beamPulse = new Inst(BOX, MATS.glowWhite, this.nBeam, { color: true }); this.group.add(this.beams.mesh, this.beamPulse.mesh);
    // the heart
    this.heartMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3.5, 1.1, 0.25) });
    this.heart = new THREE.Mesh(new THREE.SphereGeometry(3.2, 24, 16), this.heartMat); this.group.add(this.heart);
    this.heartGears = []; for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(makeGear(22 + k * 6, 0.28, 0.5, { hole: 1.0 }), k === 1 ? MATS.orangeMetal : MATS.gearSteel); m.rotation.set(k * 1.1, k * 0.7, 0); this.group.add(m); this.heartGears.push(m); }
    this.heartLight = new THREE.PointLight(0xff7a2a, 0, 400, 2); this.group.add(this.heartLight);
    this.coolLight = new THREE.PointLight(0x5ee6ff, 0, 160, 2); this.coolLight.position.set(0, 30, 0); this.group.add(this.coolLight);
    // shock shell (release) — fresnel additive
    this.shockMat = new THREE.ShaderMaterial({ uniforms: { uI: { value: 0 }, uCol: { value: new THREE.Color(1.0, 0.6, 0.3) } }, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: `varying vec3 vN; varying vec3 vV; void main(){ vN = normalize(normalMatrix * normal); vec4 mv = modelViewMatrix * vec4(position, 1.0); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uI; uniform vec3 uCol; varying vec3 vN; varying vec3 vV; void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.2); gl_FragColor = vec4(uCol * (f * 1.6 + 0.08) * uI, 1.0); }` });
    this.shock = new THREE.Mesh(new THREE.SphereGeometry(1, 48, 32), this.shockMat); this.shock.visible = false; this.group.add(this.shock);
    // ground wave ring (world space)
    this.waveMat = makeAdditive(0xffffff, 1); this.waveMat.color.setRGB(1.0, 0.75, 0.45);
    this.waveRing = new THREE.Mesh(new THREE.RingGeometry(0.92, 1.0, 160), this.waveMat); this.waveRing.rotation.x = -Math.PI / 2; this.waveRing.position.y = 0.8; this.waveRing.visible = false; scene.add(this.waveRing);
    this.heartWorld = new THREE.Vector3(0, R.sphereY, 0);
    this.spinQ = new THREE.Quaternion();
  }

  // accumulated core rotation with acceleration between accelerate and aligned
  theta(t) {
    const t0 = B.heart - 1.5; if (t < t0) return 0;
    let th = (t - t0);
    const u = sat((t - B.accelerate) / (B.aligned - B.accelerate));
    th += 1.8 * (B.aligned - B.accelerate) * u * u * u; // integral of a quadratic ramp
    if (t > B.aligned) th += 5.4 * (t - B.aligned);
    return th;
  }

  update(t, ctx) {
    const G = this.group;
    // descent into the hub during the transformation (becomes the center boss of the clock)
    const down = span(t, B.sphereDown, B.sphereDown + 1.8, E.inOutCubic);
    G.position.y = lerp(R.sphereY, 9, down); const gs = lerp(1, 11 / R.sphereR, down); G.scale.setScalar(gs);
    this.heartWorld.set(0, G.position.y, 0);
    const th = this.theta(t);
    const align = span(t, B.align, B.aligned, E.inOutQuint);
    const rel = t >= B.release ? 1 : 0;
    const relP = pulse(t, B.release, 0.04, 0.35);
    const reignite = rampInt(t - (B.release + 0.1), 0.6) * 1.6;
    const lit = span(t, B.data, B.wrap);                 // the sphere lights up as the data wraps it
    this.glassMat.opacity = 0.3 - 0.12 * span(t, B.heart, B.heart + 0.5) * (1 - down) ; this.glassMat.roughness = 0.05;
    // iris blades
    const open = span(t, B.heart - 0.25, B.heart + 0.35, E.inOutCubic) * (1 - span(t, 23.4, 24.0, E.inOutCubic));
    for (let k = 0; k < 8; k++) {
      const beta = (k / 8) * TAU;
      _m.makeTranslation(R.sphereR, 0, 0); _m2.makeRotationX(beta); _m.multiply(_m2); _m2.makeTranslation(0, 13, 0); _m.multiply(_m2);
      _m2.makeRotationZ(open * 1.35); _m.multiply(_m2); _m2.makeTranslation(0, -6.5, 0); _m.multiply(_m2);
      _m2.copy(_m); _m2.multiply(new THREE.Matrix4().makeScale(0.5, 13.5, 9.2)); this.blades.setMatrix(k, _m2);
      _m2.copy(_m); _m2.multiply(new THREE.Matrix4().makeTranslation(0.3, -6.4, 0)); _m2.multiply(new THREE.Matrix4().makeScale(0.2, 0.5, 9.0)); this.bladeEdges.setMatrix(k, _m2);
      const ib = 0.6 + 2.0 * span(t, B.heart - 0.6, B.heart - 0.2) * (1 - down); this.bladeEdges.setColor(k, 0.35 * ib, 0.9 * ib, 1.1 * ib);
    }
    this.blades.commit(); this.bladeEdges.commit(true);
    // rings
    for (let i = 0; i < this.nRings; i++) {
      const d = this.ringData[i];
      _q.setFromAxisAngle(d.axis, d.omega * th); _q.multiply(d.base);
      _q2.setFromAxisAngle(d.axis, d.omega * reignite); _q2.multiply(d.target);
      _q3.copy(_q).slerp(_q2, align);
      _p.set(0, 0, 0); _s.setScalar(d.r); _m.compose(_p, _q3, _s); this.rings.setMatrix(i, _m);
      const wg = Math.exp(-Math.pow((d.r - 4 - 60 * span(t, B.release, B.release + 0.5, E.outCubic)) / 6, 2)) * relP;
      this.rings.attrs.aGlow.setX(i, 0.08 * lit + 0.6 * wg);
      for (let k = 0; k < 3; k++) {
        const a = d.seed * TAU + (k / 3) * TAU + d.omega * th * 1.3 * (1 - align);
        _v.set(Math.cos(a) * d.r, Math.sin(a) * d.r, 0).applyQuaternion(_q3);
        _e.set(0, 0, a + Math.PI / 2); _q.setFromEuler(_e); _q2.copy(_q3).multiply(_q);
        _s.set(0.5 + d.r * 0.015, 0.9 + d.r * 0.03, 0.6 + d.r * 0.02); _m.compose(_v, _q2, _s); this.markers.setMatrix(i * 3 + k, _m);
      }
    }
    this.rings.commit(); this.rings.commitAttr('aGlow'); this.markers.commit();
    // pieces
    for (let s = 0; s < 6; s++) {
      const sh = this.shells[s];
      _q.setFromAxisAngle(sh.axis, sh.omega * th); _q.slerp(_q2.identity(), align); _q2.setFromAxisAngle(sh.axis, sh.omega * reignite); _q.multiply(_q2);
      const ps = 500;
      for (let k = 0; k < ps; k++) {
        const i = s * ps + k; const pd = this.pieceData[i];
        const wave = 1 + 0.07 * Math.sin(pd.lat * 5 - th * 2.5 + s) * (1 - align) + 0.9 * relP * (0.3 + pd.seed) * span(t, B.release, B.release + 0.35, E.outCubic);
        _v.copy(pd.dir).multiplyScalar(sh.r * wave).applyQuaternion(_q);
        _q3.copy(_q).multiply(pd.q);
        _s.setScalar(pd.size * (1 + 0.5 * relP)); _m.compose(_v, _q3, _s); this.pieces.setMatrix(i, _m);
        this.pieces.attrs.aGlow.setX(i, 0.05 * lit + 0.4 * relP * pd.seed);
      }
    }
    this.pieces.commit(); this.pieces.commitAttr('aGlow');
    // pulses
    for (let j = 0; j < this.nPulse; j++) {
      const pdt = this.pulseData[j]; const d = this.ringData[pdt.ring];
      _q.setFromAxisAngle(d.axis, d.omega * th); _q.multiply(d.base); _q2.setFromAxisAngle(d.axis, d.omega * reignite); _q2.multiply(d.target); _q3.copy(_q).slerp(_q2, align);
      const aFree = pdt.a0 + pdt.v * th; const a = lerp(aFree, Math.PI / 2, align) + pdt.v * reignite * 0.5;
      _v.set(Math.cos(a) * d.r, Math.sin(a) * d.r, 0).applyQuaternion(_q3);
      const sz = (0.7 + 0.3 * Math.sin(t * 9 + j)) * (0.5 + 0.5 * lit) * (1 + 3.5 * relP);
      _s.setScalar(sz); _q.identity(); _m.compose(_v, _q, _s); this.pulses.setMatrix(j, _m);
      const b = (0.6 + 1.4 * lit) * (1 + 1.5 * relP);
      if (pdt.orange) this.pulses.setColor(j, 2.2 * b, 0.9 * b, 0.25 * b); else this.pulses.setColor(j, 0.5 * b, 1.3 * b, 1.6 * b);
    }
    this.pulses.commit(true);
    // beams: faint lines with a bright pulse travelling outward
    for (let k = 0; k < this.nBeam; k++) {
      const dir = this.beamDirs[k]; const len = 27;
      _q.setFromUnitVectors(_up, dir);
      const vis = lit * (1 - down);
      _v.copy(dir).multiplyScalar(len / 2); _s.set(0.12, len, 0.12); _m.compose(_v, _q, _s); this.beams.setMatrix(k, _m); this.beams.setColor(k, 0.15 * vis + 2 * relP, 0.35 * vis + 2 * relP, 0.45 * vis + 2 * relP);
      const ph = ((t * (1.2 + 0.3 * (k % 4)) + k * 0.37) % 1 + 1) % 1; const u = lerp(ph, 1.0, align) ; const pl = 6 + 14 * relP;
      _v.copy(dir).multiplyScalar(4 + (len - 8) * u); _s.set(0.35 + 0.4 * relP, pl, 0.35 + 0.4 * relP); _m.compose(_v, _q, _s); this.beamPulse.setMatrix(k, _m);
      const bp = vis * (1 - align * 0.7) * 2.5 + 2 * relP; this.beamPulse.setColor(k, 0.8 * bp, 0.95 * bp, 1.0 * bp);
    }
    this.beams.commit(true); this.beamPulse.commit(true);
    // heart
    const silence = span(t, B.aligned, B.aligned + 0.2) * (1 - span(t, B.release - 0.05, B.release));
    const breathe = 1 + 0.06 * Math.sin(TAU * 1.3 * t) * (1 - silence) + 0.04 * Math.sin(TAU * 0.7 * t) * silence;
    this.heart.scale.setScalar(breathe * (1 + 1.2 * relP));
    const hi = (0.35 + 0.65 * lit) * breathe;
    this.heartMat.color.setRGB(3.5 * hi + 5 * relP, 1.1 * hi + 3.5 * relP, 0.25 * hi + 2 * relP);
    this.heartLight.intensity = 2600 * hi * (1 - 0.5 * silence) + 5000 * relP + 400 * (down > 0 ? 1 : 0);
    this.coolLight.intensity = 500 * lit * (1 - down);
    for (let k = 0; k < 3; k++) { const g = this.heartGears[k]; g.rotation.z = (k % 2 ? -1 : 1) * th * (1.5 + k * 0.4); g.rotation.x = k * 1.1 + th * 0.2 * (k === 2 ? 1 : 0); g.scale.setScalar(1 + relP * 0.8); }
    // shock shell
    const sp = span(t, B.release, B.release + 1.5, E.outCubic);
    this.shock.visible = sp > 0 && sp < 1; const sr = (4 + 700 * sp) / gs; this.shock.scale.setScalar(sr); this.shockMat.uniforms.uI.value = (1 - sp) * 0.9;
    // ground wave
    const wv = waveState(t);
    this.waveRing.visible = wv.i > 0; if (wv.i > 0) { this.waveRing.scale.setScalar(wv.r + wv.w * 0.5); this.waveMat.opacity = wv.i * 0.9; }
  }
}
