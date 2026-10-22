// CHRONOS — complexity: a skyscraper unfolds into meshing gears, the gears become transport loops, the loops become streams of data wrapping the sphere
import * as THREE from 'three';
import { makeGear, makeBoxBottom, pitchRadius } from '../geometry.js';
import { MATS } from '../materials.js';
import { Inst } from '../inst.js';
import { TAU, E, span, mulberry32, sat, lerp, polar, pulse } from '../util.js';
import { BEATS as B, R } from '../timeline.js';

const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _m = new THREE.Matrix4(), _e = new THREE.Euler(), _v = new THREE.Vector3();
const BOX = new THREE.BoxGeometry(1, 1, 1);
const rampInt = (u, tau) => (u <= 0 ? 0 : u - tau * (1 - Math.exp(-u / tau)));
const Z = new THREE.Vector3(0, 0, 1);

function digitAtlas() {
  const c = document.createElement('canvas'); c.width = 1280; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = '#000'; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = '700 104px Inter, "Inter Display", "Helvetica Neue", Helvetica, Arial, sans-serif';
  for (let i = 0; i < 10; i++) g.fillText(String(i), i * 128 + 64, 68);
  const tex = new THREE.CanvasTexture(c); tex.minFilter = THREE.LinearMipmapLinearFilter; tex.magFilter = THREE.LinearFilter; tex.generateMipmaps = true; tex.anisotropy = 4;
  return tex;
}

export class Hero {
  constructor(scene, ctx) {
    this.group = new THREE.Group(); scene.add(this.group);
    const H = polar(R.heroR, R.heroAngle, 0); this.H = H;
    const rng = mulberry32(99);
    // ---- the tower: 8 segments ----
    this.N = 8;
    const teeth = [20, 24, 28, 32, 36, 40, 44, 48], module = 0.6;
    this.gears = [];
    let y = 0, prev = null;
    const segs = []; let sy = 0;
    for (let i = 0; i < this.N; i++) {
      const rp = pitchRadius(teeth[i], module);
      if (prev) y += prev.rp + rp + 0.3;
      else y = rp + 3;
      const g = { i, teeth: teeth[i], rp, y, omega: prev ? -prev.omega * prev.teeth / teeth[i] : 1, phase: 0 };
      if (prev) {
        // in-plane chain: contact direction from prev to this gear is +90deg (straight up)
        const phi = Math.PI / 2, pitchP = TAU / prev.teeth, pitchC = TAU / g.teeth;
        const delta = (((phi - prev.phase) % pitchP) + pitchP * 1.5) % pitchP - pitchP / 2;
        g.phase = phi + Math.PI - pitchC / 2 + delta * (prev.teeth / g.teeth);
      } else g.phase = 0.2;
      const geo = makeGear(g.teeth, module, 3.0, { hole: 1.6, spokes: i >= 3 ? 5 : 0, rim: 0.2 });
      g.mesh = new THREE.Mesh(geo, i % 3 === 1 ? MATS.orangeMetal : MATS.gearSteel); g.mesh.visible = false; this.group.add(g.mesh);
      // segment box of the tower
      const w = 17 - i * 0.7, d = 17 - i * 0.7, h = 15 + (i % 2) * 2.5;
      const seg = new THREE.Mesh(makeBoxBottom(1, 1, 1), i % 2 === 0 ? MATS.titaniumSeams : MATS.glassTower);
      seg.geometry = seg.geometry.clone();
      seg.geometry.setAttribute('aSize', new THREE.InstancedBufferAttribute(new Float32Array([w, h, d]), 3));
      seg.geometry.setAttribute('aInfo', new THREE.InstancedBufferAttribute(new Float32Array([40 + i * 9, 0.95, i % 3, 0]), 4));
      seg.geometry.setAttribute('aGlow', new THREE.InstancedBufferAttribute(new Float32Array([0]), 1));
      segs.push({ mesh: seg, w, d, h, y0: sy }); sy += h;
      this.group.add(seg);
      // loop ring (torus) and vehicles
      g.ring = new THREE.Mesh(new THREE.TorusGeometry(rp + 0.9, 0.45, 6, 64), MATS.aluminum); g.ring.visible = false; this.group.add(g.ring);
      g.axis = new THREE.Vector3(rng() - 0.5, rng() - 0.5, rng() - 0.5).normalize();
      g.orbitR = 50 + i * 3.2; g.orbitTilt = rng() * TAU;
      this.gears.push(g); prev = g;
    }
    this.segs = segs; this.towerH = sy;
    this.collar = new THREE.Mesh(makeGear(24, 1.0, 2.6, { hole: 3 }), MATS.titanium); this.collar.geometry.rotateX(-Math.PI / 2); this.collar.scale.set(1.1, 1, 1.1); this.collar.position.set(H.x, 0.3, H.z); this.group.add(this.collar);
    const nVeh = teeth.reduce((a, b) => a + b, 0); this.nVeh = nVeh;
    this.vehBody = new Inst(BOX, MATS.titaniumDark, nVeh); this.vehLight = new Inst(BOX, MATS.glowCyan, nVeh, { color: true });
    this.group.add(this.vehBody.mesh, this.vehLight.mesh);
    // ---- digits ----
    this.perLoop = 48; const nD = this.N * this.perLoop; this.nD = nD;
    const dgeo = new THREE.PlaneGeometry(1.5, 2.0);
    this.digitMat = new THREE.ShaderMaterial({
      uniforms: { tAtlas: { value: digitAtlas() }, uColor: { value: new THREE.Color(0.55, 1.4, 1.8) } },
      vertexShader: /* glsl */`attribute float aDigit; attribute float aBright; varying vec2 vUv; varying float vB;
        void main(){ vec3 c = (instanceMatrix * vec4(0.0,0.0,0.0,1.0)).xyz; float sc = length(instanceMatrix[0].xyz);
          vec3 right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]); vec3 up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
          vec3 wp = c + (right * position.x + up * position.y) * sc; vUv = vec2((uv.x + aDigit) * 0.1, uv.y); vB = aBright;
          gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0); }`,
      fragmentShader: /* glsl */`uniform sampler2D tAtlas; uniform vec3 uColor; varying vec2 vUv; varying float vB;
        void main(){ float a = texture2D(tAtlas, vUv).r; if (a < 0.35) discard; gl_FragColor = vec4(uColor * vB * a, 1.0); }`,
      transparent: false, depthWrite: true, side: THREE.DoubleSide,
    });
    this.digits = new Inst(dgeo, this.digitMat, nD, { attrs: { aDigit: 1, aBright: 1 } });
    this.group.add(this.digits.mesh);
    this.digitSeed = new Float32Array(nD); for (let k = 0; k < nD; k++) this.digitSeed[k] = rng();
    this.heartWorld = new THREE.Vector3(0, R.sphereY, 0);
    this.tmpQ = new THREE.Quaternion(); this.tmpQ2 = new THREE.Quaternion();
  }

  theta(t) { return rampInt(t - (B.unfold + 0.5), 0.5) * 2.6; }

  update(t, ctx) {
    const H = this.H;
    const active = t >= B.complexity - 0.3 && t < B.transform;
    this.group.visible = t < B.transform + 0.5;
    const th = this.theta(t);
    const burst = span(t, B.release + 0.1, B.release + 1.0, E.outCubic);
    const built = span(t, 7.2, 7.9, E.outExpo) * (1 - span(t, B.transform, B.transform + 1.2, E.inOutCubic)); // the hero plot builds early so the match cut lands on it
    this.collar.rotation.y = 0.25 * rampInt(t - 4.5, 1.2); this.collar.visible = t < B.transform + 1.2;
    const S = new THREE.Vector3(0, R.sphereY, 0);
    let vi = 0;
    for (let i = 0; i < this.N; i++) {
      const g = this.gears[i], sg = this.segs[i];
      const u1 = span(t, B.unfold + i * 0.12, B.unfold + i * 0.12 + 1.0, E.inOutCubic);     // segment -> gear
      const u2 = span(t, B.loops + i * 0.1, B.loops + i * 0.1 + 0.9, E.inOutCubic);        // gear -> loop
      const u3 = span(t, B.data + i * 0.1, B.data + i * 0.1 + 1.2, E.inOutSine);           // loop -> orbit around the sphere
      const u4 = span(t, B.wrap, B.wrap + 1.0, E.inOutSine);                               // wrap tight
      // --- segment box ---
      const segY = lerp(sg.y0, g.y - sg.h / 2, u1);
      const sz = Math.max(0.0001, (1 - u1) * built);
      sg.mesh.position.set(H.x, segY, H.z); sg.mesh.rotation.set(0, u1 * Math.PI * 0.5, 0); sg.mesh.scale.set(sg.w * built, sg.h * built, sg.d * sz); sg.mesh.visible = built > 0.001 && u1 < 0.999;
      // --- gear ---
      const gz = u1 * (1 - u2);
      g.mesh.visible = u1 > 0.001 && u2 < 0.999;
      g.mesh.position.set(H.x, g.y, H.z); g.mesh.rotation.set(0, 0, g.phase + g.omega * th); g.mesh.scale.set(Math.max(0.001, u1), Math.max(0.001, u1), Math.max(0.001, gz));
      // --- loop: ring parameters morph from the gear plane to an orbit around the sphere ---
      const c0 = new THREE.Vector3(H.x, g.y, H.z);
      const c1 = S;
      const center = c0.clone().lerp(c1, u3);
      const r0 = g.rp + 0.9, r1 = lerp(g.orbitR, 47.5 + i * 0.6, u4);
      const radius = lerp(r0, r1, u3);
      _q.setFromAxisAngle(new THREE.Vector3(1, 0, 0), 0); // gear plane: axis +Z (identity)
      _q2.setFromAxisAngle(g.axis, g.orbitTilt);
      const q = this.tmpQ.copy(_q).slerp(_q2, u3);
      const ringVis = u2 > 0.001 && u3 < 0.95 && !(t > B.release);
      g.ring.visible = ringVis;
      if (ringVis) { g.ring.position.copy(center); g.ring.quaternion.copy(q); const rs = radius / (g.rp + 0.9); g.ring.scale.set(rs, rs, Math.max(0.2, 1 - u3)); const op = u2 * (1 - u3); g.ring.scale.multiplyScalar(Math.max(0.001, op)); }
      // --- vehicles on the loop (born from the gear teeth) ---
      const speed = g.omega * th + (u3 > 0 ? (i % 2 ? 1 : -1) * rampInt(t - B.data, 0.8) * (0.5 + 1.5 * u4) : 0);
      const pitch = TAU / g.teeth;
      for (let k = 0; k < g.teeth; k++) {
        const ang = g.phase + speed + k * pitch;
        const vs = u2 * (1 - u3) * (t > B.release ? 0 : 1);
        _v.set(Math.cos(ang) * radius, Math.sin(ang) * radius, 0).applyQuaternion(q).add(center);
        _e.set(0, 0, ang + Math.PI / 2); _q2.setFromEuler(_e); this.tmpQ2.copy(q).multiply(_q2);
        _s.set(2.2 * vs, 1.2 * vs, 1.1 * vs); _m.compose(_v, this.tmpQ2, _s); this.vehBody.setMatrix(vi, _m);
        _s.set(2.0 * vs, 0.5 * vs, 1.2 * vs); _m.compose(_v, this.tmpQ2, _s); this.vehLight.setMatrix(vi, _m); this.vehLight.setColor(vi, 0.4, 1.0, 1.3);
        vi++;
      }
      // --- digits: data flowing along the same path, wrapping the sphere ---
      for (let k = 0; k < this.perLoop; k++) {
        const di = i * this.perLoop + k; const sd = this.digitSeed[di];
        const extra = k >= g.teeth; // extra digits appear after the morph
        const ang = g.phase + speed + (k % g.teeth) * pitch + (extra ? pitch * 0.5 : 0) + (k >= g.teeth ? (sd - 0.5) * 0.4 : 0);
        let ds = u3 * (extra ? span(t, B.data + 0.7 + i * 0.1 + sd * 0.6, B.data + 1.2 + i * 0.1 + sd * 0.6) : 1);
        const rad = radius * (1 + burst * (2.5 + 4 * sd)) ;
        ds *= (1 - burst);
        _v.set(Math.cos(ang) * rad, Math.sin(ang) * rad, 0).applyQuaternion(q).add(center);
        const scl = (1.4 + 0.9 * sd) * ds;
        _s.set(scl, scl, scl); _q2.identity(); _m.compose(_v, _q2, _s); this.digits.setMatrix(di, _m);
        this.digits.attrs.aDigit.setX(di, Math.floor((sd * 10 + Math.floor(t * (4 + sd * 10))) % 10));
        this.digits.attrs.aBright.setX(di, (0.7 + 0.6 * Math.sin(t * 6 + sd * 40)) * (0.8 + 0.6 * u4));
      }
    }
    this.vehBody.commit(); this.vehLight.commit(true); this.digits.commit(); this.digits.commitAttr('aDigit'); this.digits.commitAttr('aBright');
    this.digits.mesh.visible = t > B.data - 0.1 && t < B.release + 1.1;
  }
}
