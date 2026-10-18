// CHRONOS — procedural mechanical geometry (gears, arc bars, rings)
import * as THREE from 'three';
import { TAU } from './util.js';

export const pitchRadius = (teeth, module) => (teeth * module) / 2;

// Spur gear outline. Teeth are trapezoids with slightly curved flanks (involute approximation).
export function gearShape(teeth, module, opts = {}) {
  const { addendum = 1.0, dedendum = 1.25, tipRatio = 0.42, rootRatio = 0.58, hole = 0, spokes = 0, rim = 0.22, hub = 0.28, hubFloor = 0 } = opts;
  const rp = pitchRadius(teeth, module);
  const ra = rp + addendum * module;      // tip radius
  const rr = rp - dedendum * module;      // root radius
  const shape = new THREE.Shape();
  const pitch = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a0 = i * pitch;
    const halfRoot = (pitch * rootRatio) / 2;
    const halfTip = (pitch * tipRatio) / 2;
    const pts = [
      [rr, a0 - pitch / 2 + 0],           // root start (between teeth)
      [rr, a0 - halfRoot],
      [rp, a0 - (halfRoot + halfTip) / 2],  // flank at pitch circle
      [ra, a0 - halfTip],
      [ra, a0 + halfTip],
      [rp, a0 + (halfRoot + halfTip) / 2],
      [rr, a0 + halfRoot],
    ];
    for (const [r, a] of pts) {
      const x = Math.cos(a) * r, y = Math.sin(a) * r;
      if (i === 0 && r === rr && a === a0 - pitch / 2) shape.moveTo(x, y); else shape.lineTo(x, y);
    }
  }
  shape.closePath();
  const holeR = Math.max(hole, 0);
  if (spokes > 0 && rr > 6 * module) {
    // cut-outs between spokes: annular sectors between hub and rim
    const rIn = Math.max(holeR + Math.max(hub * rr, module * 2.2), module * 1.2);
    const rOut = rr * (1 - rim);
    if (rOut > rIn + module) {
      const spokeW = Math.max(module * 1.4, rOut * 0.13); // spoke half-width in length units
      for (let s = 0; s < spokes; s++) {
        const c = (s + 0.5) * (TAU / spokes);
        const gapIn = Math.asin(Math.min(0.9, spokeW / rIn));
        const gapOut = Math.asin(Math.min(0.9, spokeW / rOut));
        const aIn0 = c - TAU / spokes / 2 + gapIn, aIn1 = c + TAU / spokes / 2 - gapIn;
        const aOut0 = c - TAU / spokes / 2 + gapOut, aOut1 = c + TAU / spokes / 2 - gapOut;
        if (aIn1 <= aIn0 || aOut1 <= aOut0) continue;
        const cut = new THREE.Path();
        const n = Math.max(4, Math.ceil((aOut1 - aOut0) / 0.15));
        for (let k = 0; k <= n; k++) { const a = aOut0 + ((aOut1 - aOut0) * k) / n; const x = Math.cos(a) * rOut, y = Math.sin(a) * rOut; if (k === 0) cut.moveTo(x, y); else cut.lineTo(x, y); }
        const m = Math.max(3, Math.ceil((aIn1 - aIn0) / 0.2));
        for (let k = m; k >= 0; k--) { const a = aIn0 + ((aIn1 - aIn0) * k) / m; cut.lineTo(Math.cos(a) * rIn, Math.sin(a) * rIn); }
        cut.closePath();
        shape.holes.push(cut);
      }
    }
  }
  if (holeR > 0) {
    const h = new THREE.Path();
    h.absarc(0, 0, holeR, 0, TAU, true);
    shape.holes.push(h);
  }
  return { shape, rp, ra, rr };
}

// Gear mesh geometry: axis = +Z, centered at origin, thickness along Z.
export function makeGear(teeth, module, thickness, opts = {}) {
  const { shape, rp, ra, rr } = gearShape(teeth, module, opts);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 8 });
  geo.translate(0, 0, -thickness / 2);
  geo.computeVertexNormals();
  geo.userData = { teeth, module, rp, ra, rr, thickness };
  return geo;
}

// Low-poly gear disc for instancing (4 outline points per tooth): cheap collars that still read as gears
export function makeGearLite(teeth, rOut, thickness, { tooth = 0.14, hole = 0.25 } = {}) {
  const shape = new THREE.Shape(); const rIn = rOut * (1 - tooth); const pitch = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const a = i * pitch;
    const pts = [[rIn, a - pitch * 0.5], [rIn, a - pitch * 0.22], [rOut, a - pitch * 0.16], [rOut, a + pitch * 0.16], [rIn, a + pitch * 0.22]];
    for (const [r, ang] of pts) { const x = Math.cos(ang) * r, y = Math.sin(ang) * r; if (i === 0 && r === rIn && ang === a - pitch * 0.5) shape.moveTo(x, y); else shape.lineTo(x, y); }
  }
  shape.closePath();
  if (hole > 0) { const h = new THREE.Path(); h.absarc(0, 0, rOut * hole, 0, TAU, true); shape.holes.push(h); }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 6 });
  geo.translate(0, 0, -thickness / 2); geo.computeVertexNormals();
  return geo;
}

// Annulus with thickness (axis +Z), optional angular sector.
export function makeAnnulus(rIn, rOut, thickness, segments = 64, a0 = 0, a1 = TAU) {
  const full = Math.abs(a1 - a0) >= TAU - 1e-6;
  const shape = new THREE.Shape();
  if (full) {
    shape.absarc(0, 0, rOut, 0, TAU, false);
    const hole = new THREE.Path(); hole.absarc(0, 0, rIn, 0, TAU, true); shape.holes.push(hole);
  } else {
    shape.absarc(0, 0, rOut, a0, a1, false);
    shape.absarc(0, 0, rIn, a1, a0, true);
    shape.closePath();
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: segments });
  geo.translate(0, 0, -thickness / 2);
  geo.computeVertexNormals();
  return geo;
}

// Rectangular-section bar swept along an arc in the XY plane (axis +Z).
// radius = centerline radius, width = radial thickness, depth = Z thickness. a0->a1 may be clockwise.
export function makeArcBar(radius, width, depth, a0, a1, segments) {
  const sweep = a1 - a0;
  const n = segments || Math.max(2, Math.ceil(Math.abs(sweep) / (Math.PI / 24)));
  const ri = radius - width / 2, ro = radius + width / 2, hz = depth / 2;
  const pos = [], nor = [], idx = [];
  const push = (p, nrm) => { pos.push(p[0], p[1], p[2]); nor.push(nrm[0], nrm[1], nrm[2]); return pos.length / 3 - 1; };
  const quad = (a, b, c, d) => { idx.push(a, b, c, a, c, d); };
  const ccw = sweep >= 0;
  // 4 strips: outer, inner, top (+z), bottom (-z)
  const strips = [
    { r: [ro, ro], z: [-hz, hz], nrm: (c, s) => [c, s, 0] },
    { r: [ri, ri], z: [hz, -hz], nrm: (c, s) => [-c, -s, 0] },
    { r: [ri, ro], z: [hz, hz], nrm: () => [0, 0, 1] },
    { r: [ro, ri], z: [-hz, -hz], nrm: () => [0, 0, -1] },
  ];
  for (const st of strips) {
    const base = pos.length / 3;
    for (let k = 0; k <= n; k++) {
      const a = a0 + (sweep * k) / n, c = Math.cos(a), s = Math.sin(a);
      const nrm = st.nrm(c, s);
      push([c * st.r[0], s * st.r[0], st.z[0]], nrm);
      push([c * st.r[1], s * st.r[1], st.z[1]], nrm);
    }
    for (let k = 0; k < n; k++) {
      const i0 = base + k * 2;
      if (ccw) quad(i0, i0 + 2, i0 + 3, i0 + 1); else quad(i0, i0 + 1, i0 + 3, i0 + 2);
    }
  }
  // end caps
  for (const [a, sign] of [[a0, -1], [a1, 1]]) {
    const c = Math.cos(a), s = Math.sin(a);
    const t = [-s * sign * (ccw ? 1 : -1), c * sign * (ccw ? 1 : -1), 0];
    const i0 = push([c * ri, s * ri, -hz], t), i1 = push([c * ro, s * ro, -hz], t), i2 = push([c * ro, s * ro, hz], t), i3 = push([c * ri, s * ri, hz], t);
    if ((sign > 0) === ccw) quad(i0, i1, i2, i3); else quad(i0, i3, i2, i1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(idx);
  return geo;
}

// Low-poly ring (torus) with few tube segments — cheap for instancing.
export function makeRing(radius, tube, radialSegments = 48, tubularSegments = 6) {
  return new THREE.TorusGeometry(radius, tube, tubularSegments, radialSegments);
}

// Unit box with the origin at the bottom center (for towers / bars that grow from a base)
export function makeBoxBottom(w = 1, h = 1, d = 1) {
  const g = new THREE.BoxGeometry(w, h, d);
  g.translate(0, h / 2, 0);
  return g;
}

// Tapered bar (hands): width tapers from w0 at base to w1 at tip, length along +X, thickness t
export function makeHand(length, w0, w1, t, tailLength = 0) {
  const shape = new THREE.Shape();
  shape.moveTo(-tailLength, -w0 / 2);
  shape.lineTo(length, -w1 / 2);
  shape.lineTo(length + w1 * 0.6, 0);
  shape.lineTo(length, w1 / 2);
  shape.lineTo(-tailLength, w0 / 2);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: t, bevelEnabled: false });
  geo.translate(0, 0, -t / 2);
  geo.rotateX(-Math.PI / 2); // lie flat: length along +X, thickness along Y
  geo.computeVertexNormals();
  return geo;
}

// Merge a list of geometries (same attribute set) into one — used for static decorations
export function mergeGeometries(list) {
  let pos = [], nor = [], idx = [], off = 0;
  for (const g of list) {
    const p = g.getAttribute('position'), n = g.getAttribute('normal');
    for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); nor.push(n.getX(i), n.getY(i), n.getZ(i)); }
    if (g.index) { for (let i = 0; i < g.index.count; i++) idx.push(g.index.getX(i) + off); }
    else { for (let i = 0; i < p.count; i++) idx.push(i + off); }
    off += p.count;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  geo.setIndex(idx);
  return geo;
}

export function transformed(geo, matrix) { const g = geo.clone(); g.applyMatrix4(matrix); return g; }
