// CHRONOS — keyframed cinematic camera: Catmull-Rom position/look paths, per-segment easing, hard cuts
import * as THREE from 'three';
import { E, lerp, sat } from './util.js';

const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
const m0 = new THREE.Vector3(), m1 = new THREE.Vector3(), chord = new THREE.Vector3();

// tangent (as displacement per unit of the local segment) at key i, from neighbouring keys, clamped to the segment chord
function tangent(run, i, field, segChord, out) {
  const prev = run[Math.max(0, i - 1)], next = run[Math.min(run.length - 1, i + 1)];
  if (prev === next) return out.set(0, 0, 0);
  const dt = next.t - prev.t;
  out.copy(next[field]).sub(prev[field]).divideScalar(dt);
  return out;
}
// cubic Hermite on segment i -> i+1 of a run, with tangents scaled by segment duration and limited to the chord length
function hermite(run, i, u, field, out) {
  const a = run[i], b = run[i + 1]; const h = b.t - a.t;
  chord.copy(b[field]).sub(a[field]); const cl = chord.length();
  tangent(run, i, field, cl, m0).multiplyScalar(h); tangent(run, i + 1, field, cl, m1).multiplyScalar(h);
  if (m0.length() > cl) m0.setLength(cl); if (m1.length() > cl) m1.setLength(cl);
  const u2 = u * u, u3 = u2 * u;
  const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
  out.copy(a[field]).multiplyScalar(h00).addScaledVector(m0, h10).addScaledVector(b[field], h01).addScaledVector(m1, h11);
  return out;
}

export class CameraRig {
  // keys: [{ t, pos:[x,y,z], look:[x,y,z], fov, roll, ease, cut }]
  constructor(keys) {
    this.runs = [];
    let run = null;
    for (const k of keys) {
      const key = { t: k.t, pos: new THREE.Vector3(...k.pos), look: new THREE.Vector3(...k.look), fov: k.fov ?? 45, roll: k.roll ?? 0, ease: typeof k.ease === 'string' ? E[k.ease] : (k.ease || E.linear), cut: !!k.cut };
      if (!run || key.cut) { run = []; this.runs.push(run); }
      run.push(key);
    }
    this.pos = new THREE.Vector3(); this.look = new THREE.Vector3(); this.fov = 45; this.roll = 0;
  }

  evaluate(t) {
    let run = this.runs[0];
    for (const r of this.runs) if (r[0].t <= t) run = r;
    if (t < run[0].t) { this._set(run[0]); return this; }
    const last = run[run.length - 1];
    if (t >= last.t || run.length === 1) { this._set(last); return this; }
    let i = 0; while (i < run.length - 2 && t >= run[i + 1].t) i++;
    const a = run[i], b = run[i + 1];
    const u = b.ease(sat((t - a.t) / (b.t - a.t)));
    hermite(run, i, u, 'pos', this.pos);
    hermite(run, i, u, 'look', this.look);
    this.fov = lerp(a.fov, b.fov, u); this.roll = lerp(a.roll, b.roll, u);
    return this;
  }

  _set(k) { this.pos.copy(k.pos); this.look.copy(k.look); this.fov = k.fov; this.roll = k.roll; }

  apply(camera, offset = null) {
    camera.position.copy(this.pos); if (offset) camera.position.add(offset);
    camera.up.copy(up);
    camera.lookAt(this.look);
    if (this.roll) camera.rotateZ(this.roll);
    if (camera.fov !== this.fov) { camera.fov = this.fov; camera.updateProjectionMatrix(); }
  }
}

// smooth pseudo-random 1D noise for subtle camera life
export function noise1(t, seed = 0) {
  const i = Math.floor(t), f = t - i;
  const h = (n) => { const x = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453; return x - Math.floor(x); };
  const u = f * f * (3 - 2 * f);
  return (h(i) * (1 - u) + h(i + 1) * u) * 2 - 1;
}
