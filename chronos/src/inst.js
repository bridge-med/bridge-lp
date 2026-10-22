// CHRONOS — small helper around InstancedMesh with custom per-instance attributes
import * as THREE from 'three';

const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), EU = new THREE.Euler();

export class Inst {
  constructor(geometry, material, count, { color = false, attrs = {}, frustumCulled = false } = {}) {
    this.mesh = new THREE.InstancedMesh(geometry, material, count);
    this.mesh.frustumCulled = frustumCulled;
    this.count = count;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    if (color) { this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(count * 3).fill(1), 3); this.mesh.instanceColor.setUsage(THREE.DynamicDrawUsage); }
    this.attrs = {};
    for (const [name, size] of Object.entries(attrs)) {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(count * size), size);
      a.setUsage(THREE.DynamicDrawUsage);
      this.mesh.geometry = this.mesh.geometry; // same geometry object; attributes attach to it
      geometry.setAttribute(name, a);
      this.attrs[name] = a;
    }
  }
  set(i, px, py, pz, ex, ey, ez, sx, sy = sx, sz = sx) {
    P.set(px, py, pz); EU.set(ex, ey, ez); Q.setFromEuler(EU); S.set(sx, sy, sz);
    M.compose(P, Q, S); this.mesh.setMatrixAt(i, M);
  }
  setPQS(i, p, q, s) { M.compose(p, q, s); this.mesh.setMatrixAt(i, M); }
  setMatrix(i, m) { this.mesh.setMatrixAt(i, m); }
  hide(i) { M.makeScale(0, 0, 0); this.mesh.setMatrixAt(i, M); }
  setColor(i, r, g, b) { this.mesh.instanceColor.setXYZ(i, r, g, b); }
  commit(color = false) { this.mesh.instanceMatrix.needsUpdate = true; if (color && this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; }
  commitAttr(name) { this.attrs[name].needsUpdate = true; }
}

export const hidden = new THREE.Matrix4().makeScale(0, 0, 0);
