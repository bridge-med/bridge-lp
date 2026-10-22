// CHRONOS — The City That Manufactures Time. Orchestration: scene, camera choreography, lighting, post, temporal sampling.
import * as THREE from 'three';
import { Post } from './post.js';
import { CameraRig, noise1 } from './camera.js';
import { buildMaterials, MATS, SHARED } from './materials.js';
import { BEATS as B, R, DURATION, waveState } from './timeline.js';
import { Plate } from './world/plate.js';
import { City } from './world/city.js';
import { Hero } from './world/hero.js';
import { Core } from './world/sphere.js';
import { Clock } from './world/clock.js';
import { Typography } from './world/text.js';
import { E, span, lerp, smoothstep, polar, TAU, pulse, sat, bump } from './util.js';
export { DURATION, BEATS } from './timeline.js';

const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };
const V = new THREE.Vector3();

export async function createFilm({ renderer, width, height, msaa = 0 }) {
  buildMaterials();
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x050608);
  scene.fog = new THREE.FogExp2(0x050608, 0.002);
  const camera = new THREE.PerspectiveCamera(42, width / height, 0.4, 5000);
  scene.add(camera);

  // ---- lights ----
  const key = new THREE.DirectionalLight(0xdfe8ff, 2.2); key.position.set(0.55, 1.0, 0.4); scene.add(key);
  const rim = new THREE.DirectionalLight(0xffa868, 1.1); rim.position.set(-0.7, 0.35, -0.6); scene.add(rim);
  const hemi = new THREE.HemisphereLight(0x4a5a72, 0x0a0b0d, 0.9); scene.add(hemi);
  const fill = new THREE.DirectionalLight(0x8fb0d8, 0.55); fill.position.set(-0.6, 0.5, 0.7); scene.add(fill);
  const finale = new THREE.PointLight(0xffb070, 0, 1200, 2); finale.position.set(-120, 420, -60); scene.add(finale);

  const ctx = { scene, camera, renderer, width, height, cameraAt: null };
  const plate = new Plate(scene, ctx); ctx.plate = plate;
  const city = new City(scene, ctx); ctx.city = city;
  const hero = new Hero(scene, ctx); ctx.hero = hero;
  const core = new Core(scene, ctx); ctx.core = core;
  const clock = new Clock(scene, ctx); ctx.clock = clock;

  // ================= CAMERA CHOREOGRAPHY =================
  const a0 = R.g0Angle; const g0 = plate.g0Pos.clone();
  const o = new THREE.Vector3(Math.cos(a0), 0, Math.sin(a0)), sdir = new THREE.Vector3(-Math.sin(a0), 0, Math.cos(a0));
  const rel = (d1, d2, d3) => [g0.x + o.x * d1 + sdir.x * d2, g0.y + d3, g0.z + o.z * d1 + sdir.z * d2];
  const P = (r, a, y) => [Math.cos(a) * r, y, Math.sin(a) * r];
  // S1 — the first second: macro on the small gear, then the rapid pull-back through the foundation and up over the rim
  const rig1 = new CameraRig([
    { t: 0.0, pos: rel(19, 11, 5.5), look: rel(0.6, -0.6, 0.2), fov: 36 },
    { t: 1.55, pos: rel(27, 15, 8), look: rel(3.0, -1.0, 0.8), fov: 36, ease: 'inOutSine' },
    { t: 2.5, pos: P(255, a0 + 0.22, -16), look: P(120, a0 + 0.3, -22), fov: 40, ease: 'inQuad' },
    { t: 2.95, pos: P(350, a0 + 0.2, 48), look: P(60, a0 + 0.2, 20), fov: 42, ease: 'linear' },
    { t: 3.4, pos: P(480, a0 + 0.18, 150), look: [0, 30, 0], fov: 42, ease: 'linear' },
    { t: 4.0, pos: P(650, a0 + 0.16, 230), look: [0, 40, 0], fov: 42, ease: 'outSine' },
  ]);
  // S2 — the city awakens: street-level flight on an arc between the ring roads
  const th0 = a0 + 0.95, th1 = th0 + 1.8;
  const cam2 = (t) => {
    const x = sat((t - B.awaken) / (B.complexity - B.awaken));
    const th = th0 + (th1 - th0) * x;
    const pos = polar(191 + 3 * Math.sin(x * 7.0), th, 57 + 6 * Math.sin(x * 5.0));
    const look = polar(186, th + 0.30, 44 + 8 * Math.sin(x * 3.0 + 1.0));
    // last 0.7 s: drift in toward the hero collar for the match cut
    const m = span(t, B.complexity - 0.7, B.complexity, E.inCubic);
    if (m > 0) { const cp = polar(R.heroR, R.heroAngle + 0.02, 4); look.lerp(cp, m); pos.lerp(polar(176, th1 - 0.01, 30), m * 0.7); }
    return { pos, look, fov: 48 + 4 * m, roll: 0 };
  };
  // S3 — complexity: the hero tower unfolds; the camera spirals up around it and follows the streams to the sphere
  const H = polar(R.heroR, R.heroAngle, 0); const S = new THREE.Vector3(0, R.sphereY, 0);
  const hp = (x, y, z) => [H.x + x, H.y + y, H.z + z];
  const rig3 = new CameraRig([
    { t: B.complexity, pos: hp(38, 18, 30), look: hp(0, 8, 0), fov: 46 },
    { t: 10.3, pos: hp(-34, 46, 72), look: hp(0, 56, 0), fov: 46, ease: 'inOutSine' },
    { t: 11.6, pos: hp(-78, 84, -34), look: hp(0, 78, 0), fov: 44, ease: 'linear' },
    { t: 12.9, pos: [96, 128, -96], look: [50, 100, 0], fov: 44, ease: 'linear' },
    { t: 14.1, pos: [44, 118, -84], look: [8, 96, 0], fov: 44, ease: 'linear' },
    { t: B.heart, pos: [66, 97, 2], look: [0, 95, 0], fov: 44, ease: 'inOutSine' },
  ]);
  // S4 — the hidden system: through the iris, slow orbit inside the core, push-in during the silence, shove at the release
  const cam4 = (t) => {
    const enter = span(t, B.heart, B.heart + 0.55, E.inOutCubic);
    const orbit = span(t, B.heart + 0.55, B.aligned, E.inOutSine);
    const push = span(t, B.aligned, B.release, E.inOutSine);
    const shove = span(t, B.release, B.release + 0.5, E.outExpo);
    const rad = lerp(66, 40, enter) - 2 * orbit - 5 * push + 6 * shove;
    const ang = 0.55 * enter + 1.5 * orbit + 0.12 * push - 0.15 * shove;
    const y = R.sphereY + lerp(2, 5, enter) - 9 * orbit + 1.5 * push + 1.5 * shove;
    const pos = polar(rad, ang, y);
    const look = new THREE.Vector3(0, R.sphereY, 0);
    const shake = pulse(t, B.release, 0.03, 0.22) * 1.4;
    pos.x += noise1(t * 40, 1) * shake; pos.y += noise1(t * 37, 2) * shake; pos.z += noise1(t * 43, 3) * shake;
    return { pos, look, fov: 48 - 4 * push + 6 * shove, roll: noise1(t * 20, 4) * shake * 0.01 };
  };
  // S5/S6 — the transformation and the clock: dramatic pull-back to the final composition
  const rig5 = new CameraRig([
    { t: B.waveCut, pos: [330, 92, 262], look: [0, 28, 0], fov: 48 },
    { t: 21.6, pos: [405, 150, 330], look: [0, 22, 0], fov: 46, ease: 'inOutSine' },
    { t: 24.2, pos: [300, 600, 600], look: [0, 0, 20], fov: 40, ease: 'linear' },
    { t: 27.0, pos: [0, 1085, 732], look: [0, 0, 86], fov: 36, ease: 'outSine' },
    { t: DURATION, pos: [0, 1060, 715], look: [0, 0, 86], fov: 36, ease: 'inOutSine' },
  ]);
  const cameraAt = (t) => {
    if (t < B.awaken) { const r = rig1.evaluate(t); return { pos: r.pos.clone(), look: r.look.clone(), fov: r.fov, roll: r.roll }; }
    if (t < B.complexity) return cam2(t);
    if (t < B.heart) { const r = rig3.evaluate(t); return { pos: r.pos.clone(), look: r.look.clone(), fov: r.fov, roll: r.roll }; }
    if (t < B.waveCut) return cam4(t);
    const r = rig5.evaluate(t); const c = { pos: r.pos.clone(), look: r.look.clone(), fov: r.fov, roll: r.roll };
    // final lock: a tiny mechanical jolt
    const j = pulse(t, B.lock, 0.02, 0.12) * 2.5; c.pos.x += noise1(t * 50, 7) * j; c.pos.y += noise1(t * 47, 8) * j;
    return c;
  };
  ctx.cameraAt = cameraAt;
  const typo = new Typography(scene, ctx); ctx.typo = typo;

  const post = new Post(renderer, width, height, { msaa });

  // ================= PER-FRAME STATE =================
  function fogDensity(t) {
    const pts = [[0, 0.012], [1.5, 0.010], [2.6, 0.004], [4.0, 0.0012], [4.01, 0.0028], [9.0, 0.0028], [9.01, 0.0022], [15.2, 0.0022], [15.6, 0.006], [20.3, 0.006], [20.31, 0.0011], [24, 0.0008], [27, 0.00045], [30, 0.00045]];
    for (let i = 0; i < pts.length - 1; i++) if (t >= pts[i][0] && t < pts[i + 1][0]) return lerp(pts[i][1], pts[i + 1][1], sat((t - pts[i][0]) / (pts[i + 1][0] - pts[i][0])));
    return pts[pts.length - 1][1];
  }
  function update(t) {
    SHARED.uTime.value = t;
    const c = cameraAt(t);
    camera.position.copy(c.pos); camera.up.set(0, 1, 0); camera.lookAt(c.look); if (c.roll) camera.rotateZ(c.roll);
    if (camera.fov !== c.fov) { camera.fov = c.fov; camera.updateProjectionMatrix(); }
    scene.fog.density = fogDensity(t);
    // lighting by act
    const inside = bump(t, B.heart + 0.3, B.waveCut, 0.3);
    const dark = 1 - span(t, 1.3, 2.7, E.inOutSine); // the opening: only the small gear's light exists
    key.intensity = lerp(2.2, 0.5, inside) * (0.03 + 0.97 * (1 - dark));
    rim.intensity = lerp(1.1, 0.25, inside) * (0.03 + 0.97 * (1 - dark));
    hemi.intensity = lerp(0.9, 0.2, inside) * (0.05 + 0.95 * (1 - dark));
    fill.intensity = lerp(0.55, 0.1, inside) * (0.03 + 0.97 * (1 - dark));
    SHARED.uEnvIntensity.value = lerp(1.0, 0.35, inside) * (0.06 + 0.94 * (1 - dark));
    const wv = waveState(t); SHARED.uWave.value.set(0, 0, wv.r, wv.w); SHARED.uWaveI.value = (typeof window !== 'undefined' && window.__noWave) ? 0 : wv.i;
    finale.intensity = 90000 * span(t, B.pulseOrange, B.pulseOrange + 0.9, E.outCubic) + 400000 * pulse(t, B.pulseOrange, 0.05, 0.3);
    // city wake-up (windows)
    SHARED.uAwake.value = span(t, B.awaken + 0.3, B.awaken + 4.6) * 1.6;
    camera.updateMatrixWorld(true);
    plate.update(t, ctx); city.update(t, ctx); hero.update(t, ctx); core.update(t, ctx); clock.update(t, ctx); typo.update(t, ctx);
  }

  const godPos = new THREE.Vector2(0.5, 0.5);
  function postParams(t) {
    const rel = pulse(t, B.release, 0.05, 0.3);
    const inside = bump(t, B.heart + 0.3, B.waveCut, 0.3);
    V.copy(core.heartWorld).project(camera); godPos.set(V.x * 0.5 + 0.5, V.y * 0.5 + 0.5);
    const tick = pulse(t, B.tick, 0.02, 0.1);
    return {
      bloom: 0.3 + 0.12 * inside + 0.1 * rel, threshold: 1.0,
      streak: 0.07 + 0.18 * rel + 0.05 * span(t, B.chronos, B.chronos + 1),
      god: 0.22 * rel * (V.z < 1 ? 1 : 0), godPos, godDensity: 0.95, godDecay: 0.965,
      exposure: 1.0 + 0.05 * rel + 0.05 * tick,
      vignette: 0.42 + 0.1 * inside, ca: 0.7 + 3.5 * rel + 0.4 * (t < B.awaken ? span(t, 1.6, 2.6) : 0), grain: 0.018, time: t,
      fade: span(t, 0.0, 0.35), contrast: 1.04, saturation: 1.06,
    };
  }

  let W = width, Hh = height;
  function renderFrame(t, opts = {}) {
    const N = Math.max(1, opts.samples | 0 || 1); const fps = opts.fps || 30; const sh = (opts.shutter ?? 0.5) / fps;
    for (let k = 0; k < N; k++) {
      const tk = N > 1 ? t + ((k + 0.5) / N - 0.5) * sh : t;
      update(tk);
      if (N > 1) { camera.setViewOffset(W, Hh, halton(k + 1, 2) - 0.5, halton(k + 1, 3) - 0.5, W, Hh); } else camera.clearViewOffset();
      post.beginScene();
      renderer.render(scene, camera);
      if (N > 1) post.accumulate(1 / N, k === 0);
    }
    camera.clearViewOffset();
    post.compose(postParams(t), N > 1);
  }
  function setSize(w, h) { W = w; Hh = h; camera.aspect = w / h; camera.updateProjectionMatrix(); post.setSize(w, h); }

  return { renderFrame, setSize, duration: DURATION, scene, camera, ctx, dispose: () => post.dispose() };
}
