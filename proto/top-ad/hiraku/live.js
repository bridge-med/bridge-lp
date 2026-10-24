/* ================================================================
   融合3「ひらく町」— 立体を動かす(ふれる → ひらく)と、止めた画像を撮る(capture)
   手触り(BRIEF 9.6): 線形の補間を使わない。カメラと回転は臨界減衰のばね、壁は小さく弾むばね、屋根はゆっくり抜ける。
   ドラッグには慣性。どの操作も 100ms 以内に何かが応える(押した建物がわずかに沈む)
   ================================================================ */
import { THREE, makeScene, makeLights, applyTod, aimCamera, capFrame, makeRenderer, fit, ELEV, U, LAYOUT, IDS, CAP_W, CAP_H, placePeople, placeVehicles, placeSky, placeSmall, angDiff, plazaFrame, PALETTE } from './world.js';
import { BOXES, WALL } from './buildings.js';

const TAU = Math.PI * 2, deg = d => d * Math.PI / 180, clamp = (v, a, b) => Math.max(a, Math.min(b, v)), clamp01 = v => clamp(v, 0, 1);
const E = .004;

/* ---------- ばね(半陰的オイラーを細かく刻む)。z = 1 で臨界減衰、z < 1 で弾む ---------- */
class Spring {
  constructor(x, w, z = 1) { this.x = x; this.v = 0; this.t = x; this.w = w; this.z = z; }
  step(dt) { const n = Math.max(1, Math.ceil(dt / .004)), h = dt / n, k = this.w * this.w, c = 2 * this.z * this.w; for (let i = 0; i < n; i++) { const a = -k * (this.x - this.t) - c * this.v; this.v += a * h; this.x += this.v * h; } }
  get moving() { return Math.abs(this.x - this.t) > 1e-4 || Math.abs(this.v) > 1e-3; }
  set(x) { this.x = this.t = x; this.v = 0; }
}

/* ---------- 建物の枠(寄るときに画面に収める範囲)と、名前の札の位置 ---------- */
function boundsOf(id, ex) {
  const b = BOXES[id];
  if (id === 'plaza') return { pts: ring(2.35, 0, .3), top: .5 };
  if (b.shape === 'tower') return { pts: ring(1.05, -ex.y0, ex.top), top: ex.top };
  if (b.shape === 'open') return { pts: rect(b.w / 2 + .1, b.d / 2 + .1, 0, ex.top), top: ex.top };
  const X = b.w / 2 + E + WALL, Z = b.d / 2 + E + WALL;
  const pts = rect(X, Z, -ex.y0, ex.top);
  pts.push(new THREE.Vector3(-X, 0, Z + b.h * .45), new THREE.Vector3(X, 0, Z + b.h * .45));
  return { pts, top: ex.top };
}
function rect(X, Z, y0, y1) { const o = []; for (const x of [-X, X]) for (const z of [-Z, Z]) for (const y of [y0, y1]) o.push(new THREE.Vector3(x, y, z)); return o; }
function ring(r, y0, y1) { const o = []; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; for (const y of [y0, y1]) o.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); } return o; }

/* 中の灯り: 建物の中ほど(前へ出しすぎると、ひらいた前の地面が照らされすぎる)。小さな建物ほど弱く */
function inLightOf(id) {
  const b = BOXES[id], h = b.h || 1;
  return { p: new THREE.Vector3(0, h * .62, (b.d || 1) * .08), dist: Math.max(2.2, Math.max(b.w, h) * 1.3), k: clamp((b.w * (b.h || .6)) / 9.3, .22, 1) };
}

/* 建物の島の上での置き方(島のグループの中の座標) */
function placeOf(S, id) {
  if (id === 'plaza') { const { cx, cz } = plazaFrame(); return { p: new THREE.Vector3(cx, 0, cz), yaw: deg(90 - 45), face: 45, y0: 0 }; }
  const b = S.B[id]; return { p: b.grp.position.clone(), yaw: b.grp.rotation.y, face: b.face, y0: b.ex.y0 };
}

/* ================================================================
   止めた画像を撮る(?capture=poster&tod=day|dusk|night / portrait&id= / cutaway&id=)
   ================================================================ */
export async function capture(Q) {
  const mode = Q.get('capture'), tod = { day: 0, dusk: 1, night: 2 }[Q.get('tod') || 'day'] ?? 0, W = +(Q.get('w') || CAP_W), H = +(Q.get('h') || CAP_H);
  document.documentElement.classList.add('capture');
  let canvas = document.getElementById('cap'); if (!canvas) { canvas = document.createElement('canvas'); canvas.id = 'cap'; document.body.appendChild(canvas); }
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const renderer = makeRenderer(canvas, +(Q.get('dpr') || 1), W, H, true);
  const only = mode === 'portrait' ? Q.get('id') : null;
  const S = makeScene({ only }), L = makeLights(S.scene, 2048);
  applyTod(L, renderer, tod);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 300);
  const t = +(Q.get('t') || 0);
  placePeople(S.dyn, t, null); placeVehicles(S.dyn, t, 0, null); placeSky(S.dyn, t, tod > 1.5 ? 1 : 0); placeSmall(S.dyn, t, true);
  if (S.dyn.clouds && Q.get('clouds') === '0') S.dyn.clouds.mesh.visible = false;
  setStatic(S);
  // 中の形: 公園はいつも(町の景色の一部)。断面(cutaway)のときは、その建物をひらいた姿にする
  const MOD = await import('./interiors.js').catch(() => null);
  const loader = new THREE.TextureLoader();
  const cctx = { palette: PALETTE, quality: 'high', loadTexture: url => loader.loadAsync(url).then(tx => { tx.colorSpace = THREE.SRGBColorSpace; return tx; }) };
  const mstr = tod < .5 ? 'day' : tod < 1.5 ? 'dusk' : 'night', glow = U.uNight.value;
  const built = [];
  if (MOD && S.B.park) { const it = MOD.buildInterior('park', BOXES.park, cctx); it.group.position.y = .05; S.B.park.anchor.add(it.group); built.push(it); }
  const cut = mode === 'cutaway' ? Q.get('id') : null;
  if (MOD && cut && cut !== 'park' && cut !== 'plaza') { const it = MOD.buildInterior(cut, BOXES[cut], cctx); S.B[cut].anchor.add(it.group); built.push(it); }
  for (const it of built) { await it.ready; it.setNight(glow); if (it.reveal) it.reveal(); }
  if (built.length) await new Promise(r => setTimeout(r, 1400));
  for (const it of built) it.update(.016, t, mstr);
  if (cut) {
    const b = S.B[cut], bx = BOXES[cut], pl = placeOf(S, cut), tb = new THREE.Matrix4().compose(pl.p, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pl.yaw), new THREE.Vector3(1, 1, 1)), tbi = tb.clone().invert();
    U.uOpenA.value = LAYOUT[cut].bid; U.uRoofA.value = 0;
    if (bx.shape === 'tower') U.uPM.value[1].copy(tb).multiply(new THREE.Matrix4().makeRotationY(Math.PI)).multiply(tbi);
    else if (bx.shape !== 'open') { const z = bx.d / 2 + E + WALL, end = Math.PI / 2 + Math.asin(clamp((b.ex.y0 + .01) / bx.h, 0, .4)); U.uPM.value[1].copy(tb).multiply(new THREE.Matrix4().makeTranslation(0, 0, z)).multiply(new THREE.Matrix4().makeRotationX(end)).multiply(new THREE.Matrix4().makeTranslation(0, 0, -z)).multiply(tbi); }
    U.uPM.value[2].copy(tb).multiply(new THREE.Matrix4().makeTranslation(0, 40, 0)).multiply(tbi);
    // その建物を正面に向けて(島を回す)、少し低い角度から寄る
    const spin = deg(pl.face - 45), el = cut === 'park' ? deg(17) : deg(26);
    S.world.rotation.y = spin; S.world.updateMatrixWorld(true);
    aimCamera(camera, new THREE.Vector3(), el);
    const bd = boundsOf(cut, b.ex), m = new THREE.Matrix4().makeRotationY(spin).multiply(tb), pts = bd.pts.map(p => p.clone().applyMatrix4(m));
    fit(camera, pts, W, H, { x0: W * .06, x1: W * .94, y0: H * .06, y1: H * .94 });
    // 中の灯り(断面の絵でも、中が暗くならないように)
    const pIn = L.pIn, il = inLightOf(cut), c = il.p.applyMatrix4(tb); S.world.localToWorld(c);
    pIn.position.copy(c); pIn.distance = il.dist; pIn.intensity = (1.4 + glow * 2) * il.k;
    if (cut === 'park' || cut === 'plaza') pIn.intensity = 0;
  } else if (mode === 'portrait') {
    aimCamera(camera, new THREE.Vector3());
    const bb = new THREE.Box3().setFromObject(S.world), pts = [];
    for (const x of [bb.min.x, bb.max.x]) for (const y of [bb.min.y, bb.max.y]) for (const z of [bb.min.z, bb.max.z]) pts.push(new THREE.Vector3(x, y, z));
    fit(camera, pts, W, H, { x0: W * .05, x1: W * .95, y0: H * .05, y1: H * .95 });
  } else capFrame(camera);
  renderer.render(S.scene, camera);
  await new Promise(r => requestAnimationFrame(r));
  renderer.render(S.scene, camera);
  // 建物ごとの位置(枠の %): 名前の札(上)と、押せる範囲
  const pins = {};
  if (mode === 'poster') for (const id of IDS) {
    const pl = placeOf(S, id), bd = boundsOf(id, id === 'plaza' ? { y0: 0, top: .5 } : S.B[id].ex), m = new THREE.Matrix4().compose(pl.p, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pl.yaw), new THREE.Vector3(1, 1, 1));
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of bd.pts) { if (p.z > (BOXES[id] ? BOXES[id].d / 2 + .2 : 9) && id !== 'plaza') continue; const v = p.clone().applyMatrix4(m).project(camera); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    const tp = new THREE.Vector3(0, bd.top, 0).applyMatrix4(m).project(camera);
    const pc = (vx, vy) => [+((vx + 1) / 2 * 100).toFixed(2), +((1 - vy) / 2 * 100).toFixed(2)];
    pins[id] = { tag: pc(tp.x, tp.y), box: [...pc(x0, y1), ...pc(x1, y0)] };
  }
  window.__done = { pins, calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
}
function setStatic(S) {
  for (const M of U.uPM.value) M.identity();
  for (const s of S.signs) if (s.mesh) { s.mesh.matrixAutoUpdate = true; }
}

/* ================================================================
   ページの中で描く
   o = { canvas, box, safe(): {l,t,r,b}, onHover(id|null), onPick(id), onEmpty(), onPress(id), onStation(sid|null, how), onLayout(L), onOpened(id), onClosed(), tod, mod(Promise<module>) }
   ================================================================ */
export function live(o) {
  /* 撮るための手動の時計(?clock=manual)。ふつうは clock() */
  const manual = new URLSearchParams(location.search).get('clock') === 'manual';
  let vnow = 0;
  const clock = () => manual ? vnow : performance.now();
  const small = Math.min(innerWidth, innerHeight) < 700 || innerWidth < 900;
  let W = o.canvas.clientWidth, H = o.canvas.clientHeight;
  const renderer = makeRenderer(o.canvas, Math.min(devicePixelRatio || 1, small ? 1.5 : 2), W, H, false);
  const S = makeScene(), L = makeLights(S.scene, small ? 1024 : 2048);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 300);
  const CAPF = capFrame(camera);
  const origin = new THREE.Vector3();

  /* ---- 状態 ---- */
  const rot = new Spring(0, 7.5, 1), camX = new Spring(0, 7.5, 1), camY = new Spring(0, 7.5, 1), camZ = new Spring(0, 7.5, 1), elev = new Spring(ELEV, 7, 1);
  const dim = new Spring(0, 8, 1), lift = new Spring(0, 24, .55), hiAmt = new Spring(0, 11, 1), tod = new Spring(o.tod || 0, 4.2, 1), inLight = new Spring(0, 7, 1);
  const nearK = new Spring(0, 6, 1);   // 道具に寄るとき、手前の物(人・机・上の階の床)を切り落とす面を、画面の少し手前まで進める
  const slot = () => ({ id: null, wall: new Spring(0, 11, .5), roof: new Spring(0, 6, 1), roofT0: -1, end: 0, kind: 'hinge', t0: 0, steps: [] });
  let A = slot(), Bk = slot();
  let base = null, paused = false, running = false, visible = true, t = 0, last = clock(), lastInput = 0, dirty = true, frameN = 0;
  let hover = null, liftId = null, invite = null, preRot = 0, dragOff = new Spring(0, 9, 1), openCam = null, curStation = null, findSid = null, findC = null, turnTok = 0;
  /* 後で一度だけ動かす段取り(時計の時刻で) */
  const later = [];
  function after(ms, f) { later.push({ at: clock() + ms, f }); later.sort((a, b) => a.at - b.at); }
  /* 遠い建物ほど、島をゆっくり回す(回す角度に応じて、ばねを柔らかく) */
  const turnW = a => a > .87 ? clamp(7.5 * Math.pow(.87 / a, .9), 3, 7.5) : 7.5;
  function easeTurn(ms) { const tok = ++turnTok; rot.w = turnW(Math.abs(rot.t - rot.x)); after(ms, () => { if (tok === turnTok) rot.w = 7.5; }); }
  const interiors = {};
  let inK = 1;
  tod.set(o.tod || 0);
  applyTod(L, renderer, tod.x);

  /* ---- 枠: 止めた画像の枠に、立体の島がぴったり重なる ---- */
  function baseFrame() {
    const sr = o.canvas.getBoundingClientRect(), br = o.box.getBoundingClientRect();
    const k = (CAPF.right - CAPF.left) / br.width, left = CAPF.left - (br.left - sr.left) * k, top = CAPF.top + (br.top - sr.top) * k;
    return { x: left + W * k / 2, y: top - H * k / 2, ppu: 1 / k };
  }
  const nv = new THREE.Vector3();
  function setCamera() {
    aimCamera(camera, origin, elev.x);
    const ppu = Math.exp(camZ.x);
    camera.left = camX.x - W / 2 / ppu; camera.right = camX.x + W / 2 / ppu; camera.top = camY.x + H / 2 / ppu; camera.bottom = camY.x - H / 2 / ppu;
    camera.near = .1;
    if (findC && nearK.x > .001) { const fd = -nv.copy(findC).applyAxisAngle(Y, rot.x).applyMatrix4(camera.matrixWorldInverse).z; camera.near = .1 + Math.max(0, fd - .3) * clamp01(nearK.x); }
    camera.updateProjectionMatrix();
  }
  function resize() {
    W = o.canvas.clientWidth; H = o.canvas.clientHeight; renderer.setSize(W, H, false);
    base = baseFrame();
    if (!A.id) { camX.set(base.x); camY.set(base.y); camZ.set(Math.log(base.ppu)); }
    else retarget();
    dirty = true; kick();
  }
  new ResizeObserver(resize).observe(o.canvas);

  /* ---- 寄る先(建物を正面に向け、安全な範囲 = パネルやシートを避けた所に収める) ---- */
  const tmpCam = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 300);
  function frameFor(id) {
    const pl = placeOf(S, id), bd = boundsOf(id, id === 'plaza' ? { y0: 0, top: .5 } : S.B[id].ex);
    const r = nearestRot(rot.x, deg(pl.face - 45));
    const el = id === 'park' ? deg(small ? 16 : 22) : id === 'plaza' ? deg(54) : deg(26);
    aimCamera(tmpCam, origin, el);
    const m = new THREE.Matrix4().makeRotationY(r).multiply(new THREE.Matrix4().compose(pl.p, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pl.yaw), new THREE.Vector3(1, 1, 1)));
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of bd.pts) { const v = p.clone().applyMatrix4(m).applyMatrix4(tmpCam.matrixWorldInverse); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    const sf = o.safe(), sw = sf.r - sf.l, shh = sf.b - sf.t;
    const k = id === 'plaza' ? .84 : id === 'park' ? (small ? 1.12 : .94) : small ? .78 : .76;
    let ppu = Math.min(sw * k / (x1 - x0), shh * k / (y1 - y0));
    ppu = Math.min(ppu, base.ppu * (id === 'park' ? 6.5 : small ? 4.2 : 3.8));
    const bx = (x0 + x1) / 2, by = (y0 + y1) / 2, scx = (sf.l + sf.r) / 2, scy = (sf.t + sf.b) / 2;
    return { rot: r, elev: el, x: bx - (scx - W / 2) / ppu, y: by + (scy - H / 2) / ppu, ppu };
  }
  function nearestRot(cur, target) { let d = ((target - cur) % TAU + TAU) % TAU; if (d > Math.PI) d -= TAU; return cur + d; }
  /* 道具を見つける: その物の画面(中の形の、物ごとの板)が、見える範囲の約3割を占めるまで寄る */
  function screenQuad(it, st) {
    const sc = it.group.children.find(m => m.isMesh && !m.isInstancedMesh && m.material && m.material.map);
    const P = sc && sc.geometry.attributes.position, i0 = st.index * 6;
    if (!P || i0 + 6 > P.count) return null;
    S.world.updateMatrixWorld(true);
    const toIsland = new THREE.Matrix4().copy(S.world.matrixWorld).invert().multiply(sc.matrixWorld);
    const vs = []; for (let i = 0; i < 6; i++) vs.push(new THREE.Vector3().fromBufferAttribute(P, i0 + i).applyMatrix4(toIsland));
    const pts = vs.filter((v, i) => vs.findIndex(q => q.distanceToSquared(v) < 1e-10) === i);
    const n = new THREE.Vector3().subVectors(vs[1], vs[0]).cross(new THREE.Vector3().subVectors(vs[2], vs[0])).normalize();
    const c = pts.reduce((a, v) => a.add(v), new THREE.Vector3()).multiplyScalar(1 / pts.length);
    return { pts, n, c };
  }
  function findFrame(sid) {
    const it = A.id && interiors[A.id], st = it && it.stations.find(s => s.id === sid);
    const q = st && screenQuad(it, st); if (!q) return null;
    const bf = frameFor(A.id);
    // 画面がこちらを向くまで島を回す。立てた画面はほぼ正面から、上を向いた画面は上から見る。
    // 手前の物(人・机・壁・上の階の床)は、カメラの手前の面で切り落とす(setCamera の near)ので、見下ろさなくてよい
    findC = q.c;
    aimCamera(tmpCam, origin, bf.elev);
    const phC = Math.atan2(tmpCam.position.x - origin.x, tmpCam.position.z - origin.z), hz = Math.hypot(q.n.x, q.n.z);
    let r = bf.rot;
    if (hz > .3) { let d = phC - Math.atan2(q.n.x, q.n.z) - bf.rot; d = Math.atan2(Math.sin(d), Math.cos(d)); r = bf.rot + d; }
    const el = clamp(Math.asin(clamp(q.n.y, -1, 1)) + deg(5), deg(9), deg(60));
    aimCamera(tmpCam, origin, el);
    const m = new THREE.Matrix4().makeRotationY(r);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of q.pts) { const v = p.clone().applyMatrix4(m).applyMatrix4(tmpCam.matrixWorldInverse); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    const sf = o.safe(), sw = sf.r - sf.l, shh = sf.b - sf.t, w = Math.max(1e-3, x1 - x0), h = Math.max(1e-3, y1 - y0);
    const ppu = Math.min(Math.sqrt(.3 * sw * shh / (w * h)), sw * .8 / w, shh * .66 / h, base.ppu * 40);
    const bx = (x0 + x1) / 2, by = (y0 + y1) / 2, scx = (sf.l + sf.r) / 2, scy = (sf.t + sf.b) / 2;
    return { rot: r, elev: el, x: bx - (scx - W / 2) / ppu, y: by + (scy - H / 2) / ppu, ppu };
  }
  function retarget() {
    if (!A.id) { rot.t = preRot; camX.t = base.x; camY.t = base.y; camZ.t = Math.log(base.ppu); elev.t = ELEV; return; }
    openCam = (findSid && findFrame(findSid)) || frameFor(A.id);
    rot.t = openCam.rot + dragOff.x; elev.t = openCam.elev; camX.t = openCam.x; camY.t = openCam.y; camZ.t = Math.log(openCam.ppu);
  }

  /* ---- 中の形(初めてひらいたときに作る)。画面のテクスチャも、そのとき読む ---- */
  const texLoader = new THREE.TextureLoader(), texCache = new Map();
  const ctx = {
    palette: PALETTE, quality: 'high',   // 寄ったときに何の画面か読めるよう、スマホでも画面の画像は細かく
    loadTexture(url) {
      if (!texCache.has(url)) texCache.set(url, texLoader.loadAsync(url).then(tx => { tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; dirty = true; kick(); return tx; }));
      return texCache.get(url);
    }
  };
  let MOD = null;
  const modP = (o.mod || Promise.reject()).then(m => (MOD = m)).catch(() => null);
  /* 公園だけは最初から中を組む(池・カプセルの機械・保留の棚・窓の額が、町の景色として見えるように)。
     公園の画面の画像(約85KB)も、このとき読む。後にすると、止めた画像と入れ替えた直後に、小さな黒い画面が町に出るため */
  modP.then(() => { if (MOD) { interiorOf('park'); dirty = true; kick(); } });
  function interiorOf(id) {
    if (interiors[id] || !MOD || id === 'plaza') return interiors[id] || null;
    const b = S.B[id];
    try {
      const it = MOD.buildInterior(id, BOXES[id], ctx);
      if (id === 'park') it.group.position.y = .05;
      b.anchor.add(it.group); it.group.visible = true;
      it.setNight && it.setNight(U.uNight.value);
      interiors[id] = it;
    } catch (e) { console.warn('interior', id, e); interiors[id] = null; }
    return interiors[id];
  }

  /* ---- ひらく・閉じる ---- */
  function open(id) {
    lastInput = clock();
    if (A.id === id) return;
    if (!A.id) preRot = rot.x;
    if (A.id) { closeSlot(A); Bk = A; }
    A = slot(); A.id = id; A.t0 = clock();
    A.kind = id === 'plaza' || id === 'park' ? 'none' : BOXES[id].shape === 'tower' ? 'spin' : 'hinge';
    if (A.kind === 'hinge') { const b = S.B[id]; A.end = Math.PI / 2 + Math.asin(clamp((b.ex.y0 + .01) / BOXES[id].h, 0, .4)); }
    if (A.kind === 'spin') A.end = Math.PI;
    dragOff.set(0); findSid = null; nearK.t = 0;
    U.uOpenA.value = LAYOUT[id].bid; U.uFocus.value = LAYOUT[id].bid; dim.t = .34;
    liftId = id; lift.t = 0;           // 乗せたときの浮き(.07)は戻す。中の形は浮かないので、外と中がずれないように
    lift.v = -.85;                     // 押した手応え
    hover = null; o.onHover(null);
    interiorOf(id);
    const it = interiors[id];
    if (it) it.group.visible = true;
    const reduce = o.reduce && o.reduce();
    openCam = frameFor(id); rot.t = openCam.rot;
    const turn = Math.abs(rot.t - rot.x), wait = reduce || turn <= .87 ? 0 : Math.round((turn - .87) / turnW(turn) * 900);
    easeTurn(wait + 1100);
    if (wait) { camX.t = base.x; camY.t = base.y; camZ.t = Math.log(base.ppu); elev.t = ELEV; after(wait, () => { if (A.id === id) retarget(); }); }   // 回る間は町ぜんたいを見せる
    else retarget();
    const at = ms => reduce ? 0 : ms + wait;
    A.steps = [
      ...(reduce ? [] : [{ t: at(230), f: () => { A.roofT0 = clock(); } }]),
      { t: at(330), f: () => { A.wall.t = A.end; } },
      { t: at(520), f: () => { inLight.t = 1; } },
      ...stationSeq(id, at(700), reduce),
      { t: at(1150), f: () => { o.onOpened && o.onOpened(id); } }
    ];
    if (reduce) { A.wall.set(A.end); A.roof.set(1); for (const s of [rot, camX, camY, camZ, elev, dim]) s.set(s.t); }
    kick();
  }
  function stationSeq(id, t0, reduce) {
    const it = interiors[id]; if (!it || !it.stations.length) return [];
    return [
      { t: t0, f: () => { if (it.reveal) it.reveal(); else it.stations.forEach(s => s.setActive(false)); } },
      { t: t0 + (reduce ? 0 : it.stations.length * 60 + 320), f: () => setActive(findSid || it.stations[0].id) }
    ];
  }
  function closeSlot(s) { s.wall.t = 0; s.roof.t = 0; s.roofT0 = -1; s.steps = []; s.closing = true; const it = interiors[s.id]; if (it) for (const st of it.stations) { st.setActive(false); st.setHover(false); } }
  function close() {
    lastInput = clock();
    if (!A.id) return;
    closeSlot(A); Bk = A; A = slot();
    U.uOpenA.value = -1; U.uFocus.value = Bk.id ? LAYOUT[Bk.id].bid : -1; dim.t = 0; inLight.t = 0; curStation = null; dragOff.set(0); findSid = null; nearK.t = 0;
    retarget(); easeTurn(1400);
    if (o.reduce && o.reduce()) { Bk.wall.set(0); Bk.roof.set(0); for (const s of [rot, camX, camY, camZ, elev, dim]) s.set(s.t); }
    kick();
  }
  function setActive(sid) {
    const it = A.id && interiors[A.id]; if (!it) return;
    for (const s of it.stations) s.setActive(s.id === sid);
    curStation = sid; dirty = true; kick();
  }
  function find(sid) {
    if (!A.id) return;
    sid = sid || null; if (sid === findSid) return;
    findSid = sid; lastInput = clock();
    if (sid) { findC = null; setActive(sid); }
    retarget(); nearK.t = sid && findC ? 1 : 0; easeTurn(1200);
    if (o.reduce && o.reduce()) for (const s of [rot, camX, camY, camZ, elev, nearK]) s.set(s.t);
    else if (sid) after(450, () => { if (findSid === sid) retarget(); });   // 物が持ち上がりきった位置で、もう一度合わせる
    kick();
  }
  function stationHover(sid) {
    const it = A.id && interiors[A.id]; if (!it) return;
    for (const s of it.stations) s.setHover(s.id === sid);
    if (sid) setActive(sid);
    dirty = true; kick();
  }

  /* ---- 行列: 前の壁(倒れる/回る)・屋根(持ち上がって消える)・ドーム・自動ドア ---- */
  const tb = new THREE.Matrix4(), tbi = new THREE.Matrix4(), lm = new THREE.Matrix4(), tmpM = new THREE.Matrix4(), qy = new THREE.Quaternion(), Y = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1);
  function bldM(id) { const pl = placeOf(S, id); qy.setFromAxisAngle(Y, pl.yaw); tb.compose(pl.p, qy, one); tbi.copy(tb).invert(); }
  function wallLocal(s, out) {
    const b = BOXES[s.id];
    if (s.kind === 'spin') return out.makeRotationY(s.wall.x);
    if (s.kind !== 'hinge') return out.identity();
    const z = b.d / 2 + E + WALL;
    return out.makeTranslation(0, 0, z).multiply(tmpM.makeRotationX(s.wall.x)).multiply(new THREE.Matrix4().makeTranslation(0, 0, -z));
  }
  function roofLocal(s, out) { return out.makeTranslation(0, s.roof.x * 7, 0); }
  function slotMats(s, iF, iR, idU, cutU) {
    if (!s.id || s.kind === 'none') { U[idU].value = s.id && s.kind === 'none' ? -1 : -1; U[cutU].value = 1; U.uPM.value[iF].identity(); U.uPM.value[iR].identity(); return; }
    bldM(s.id);
    U.uPM.value[iF].copy(tb).multiply(wallLocal(s, lm)).multiply(tbi);
    U.uPM.value[iR].copy(tb).multiply(roofLocal(s, lm)).multiply(tbi);
    U[idU].value = LAYOUT[s.id].bid; U[cutU].value = !s.closing && s.roof.x > .999 ? 0 : 1;
  }
  function signMats() {
    for (const sg of S.signs) {
      if (!sg.mesh) continue;
      const m = sg.mesh; m.matrixAutoUpdate = false;
      const local = new THREE.Matrix4().makeTranslation(...sg.pos);
      let L2 = new THREE.Matrix4();
      const s = A.id === sg.b.id ? A : Bk.id === sg.b.id ? Bk : null;
      if (s) wallLocal(s, L2);
      if (liftId === sg.b.id) L2 = new THREE.Matrix4().makeTranslation(0, lift.x, 0).multiply(L2);
      m.matrix.copy(L2).multiply(local);
    }
  }

  /* ---- 選ぶ(レイキャスト)。建物ごとに見えない箱を置く ---- */
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), hits = [];
  for (const id of IDS) {
    const pl = placeOf(S, id), bd = boundsOf(id, id === 'plaza' ? { y0: 0, top: .5 } : S.B[id].ex);
    const bb = new THREE.Box3(); for (const p of bd.pts) if (!(p.z > (BOXES[id] ? BOXES[id].d / 2 + .2 : 9) && id !== 'plaza')) bb.expandByPoint(p);
    const sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
    const hm = new THREE.Mesh(new THREE.BoxGeometry(sz.x, sz.y, sz.z), new THREE.MeshBasicMaterial({ visible: false }));
    hm.position.copy(c); const holder = new THREE.Object3D(); holder.position.copy(pl.p); holder.rotation.y = pl.yaw; holder.add(hm); S.world.add(holder);
    hm.userData.id = id; hits.push(hm);
  }
  const groundHit = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, .1, 24), new THREE.MeshBasicMaterial({ visible: false })); S.world.add(groundHit);
  function pick(e) {
    const r = o.canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(hits, false)[0];
    if (h) return h.object.userData.id;
    return ray.intersectObject(groundHit, false).length ? '' : null;
  }
  /* 中の物(ひらいているとき): 画面の上の距離で選ぶ */
  const v3 = new THREE.Vector3();
  function stationsOnScreen() {
    const it = A.id && interiors[A.id]; if (!it || A.wall.x < A.end * .6 && A.kind !== 'none') return [];
    const out = [], r = o.canvas.getBoundingClientRect(), ppu = Math.exp(camZ.x);
    for (const s of it.stations) { v3.copy(s.anchor); it.group.localToWorld(v3); v3.project(camera); out.push({ id: s.id, label: s.label, x: (v3.x + 1) / 2 * W + r.left * 0, y: (1 - v3.y) / 2 * H, rad: Math.max(22, (s.radius || .2) * ppu) }); }
    return out;
  }
  function pickStation(e) {
    const r = o.canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let best = null; for (const s of stationsOnScreen()) { const d = Math.hypot(s.x - x, s.y - y); if (d < s.rad && (!best || d < best.d)) best = { id: s.id, d }; }
    return best ? best.id : null;
  }

  /* ---- 指・マウス ---- */
  let down = null, rotV = 0;
  o.canvas.addEventListener('pointerdown', e => {
    lastInput = clock();
    down = { x: e.clientX, y: e.clientY, t: clock(), moved: 0, id: e.pointerId, lastX: e.clientX, lastT: clock(), base: rot.x };
    rotV = 0;
    const id = pick(e);
    if (id && id !== A.id && !(A.id && pickStation(e))) { liftId = id; lift.v = -.85; o.onPress && o.onPress(id); }
    kick();
  });
  o.canvas.addEventListener('pointermove', e => {
    if (down && e.pointerId === down.id) {
      const dx = e.clientX - down.lastX, now = clock(); down.lastX = e.clientX; down.moved += Math.abs(dx) + Math.abs(e.clientY - down.y) * 0;
      if (down.moved > 6) {
        if (!o.canvas.hasPointerCapture(e.pointerId)) o.canvas.setPointerCapture(e.pointerId);
        const d = dx * .0072;
        if (A.id) { dragOff.t = clamp(dragOff.t + d, -deg(25), deg(25)); dragOff.x = dragOff.t; dragOff.v = 0; }
        else { rot.x += d; rot.t = rot.x; rot.v = 0; rotV = d / Math.max(.008, (now - down.lastT) / 1000); }
        down.lastT = now; lastInput = now; dirty = true; kick();
      }
      return;
    }
    if (e.pointerType === 'mouse' && performance.now() - touchT > 1500 && !(touchXY && Math.hypot(e.clientX - touchXY[0], e.clientY - touchXY[1]) < 3)) {   // 指でふれたあとの、互換のためのマウスの動き(同じ位置)は見ない
      if (A.id) { const sid = pickStation(e); if (sid !== curHover) { curHover = sid; stationHover(sid); o.onStation(sid, 'hover'); } o.canvas.style.cursor = sid ? 'pointer' : (pick(e) ? 'pointer' : ''); return; }
      const id = pick(e) || null;
      if (id !== hover) { setHover(id); o.onHover(id); }
      o.canvas.style.cursor = id ? 'pointer' : '';
    }
  });
  let curHover = null, touchT = -1e9, touchXY = null;
  const up = e => {
    if (e.pointerType !== 'mouse') { touchT = performance.now(); touchXY = [e.clientX, e.clientY]; }
    if (!down || e.pointerId !== down.id) return;
    const tap = down.moved < 7;
    if (o.canvas.hasPointerCapture(e.pointerId)) o.canvas.releasePointerCapture(e.pointerId);
    if (!tap && !A.id && Math.abs(rotV) > .05) { inertia = clamp(rotV, -4, 4); }
    if (A.id && !tap) { dragOff.t = 0; }
    down = null;
    if (!tap) { kick(); return; }
    if (A.id) {
      const sid = pickStation(e);
      if (sid) { stationHover(sid); o.onStation(sid, 'tap'); return; }
    }
    const id = pick(e);
    if (id) o.onPick(id); else o.onEmpty();
  };
  let inertia = 0;
  o.canvas.addEventListener('pointerup', up);
  o.canvas.addEventListener('pointercancel', () => { down = null; if (A.id) dragOff.t = 0; });
  o.canvas.addEventListener('pointerleave', () => { if (hover) { setHover(null); o.onHover(null); } if (A.id && curHover) { curHover = null; stationHover(null); o.onStation(null, 'hover'); } });
  function setHover(id) { hover = id; if (!A.id) { liftId = id; lift.t = id ? .07 : 0; } dirty = true; kick(); }

  /* ---- 誘い: ひとつの建物がふっと明るくなる ---- */
  function doInvite(id) { invite = { id, t0: clock() }; kick(); }

  /* ---- 見えないとき・裏のタブでは止める ---- */
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); }, { threshold: 0 }).observe(o.canvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  /* ---- 1こま ---- */
  const springs = [rot, camX, camY, camZ, elev, dim, lift, hiAmt, tod, inLight, dragOff, nearK];
  function kick() { if (manual) { dirty = true; return; } if (!running) { running = true; last = clock(); requestAnimationFrame(loop); } }
  function loop(now) { frame(now); }
  function frame(now, force) {
    const dt = Math.min(.05, (now - last) / 1000); last = now; frameN++;
    if (!paused) t += dt;
    // 慣性(ひらいていないときのドラッグ)
    if (!down && !A.id && Math.abs(inertia) > .002) { rot.x += inertia * dt; rot.t = rot.x; inertia *= Math.pow(.05, dt); }
    if (A.id) rot.t = (openCam ? openCam.rot : rot.t) + dragOff.x;
    // 段取り
    while (later.length && later[0].at <= now) later.shift().f();
    for (const s of [A, Bk]) if (s.id && s.steps.length) { const el = now - s.t0; while (s.steps.length && s.steps[0].t <= el) s.steps.shift().f(); }
    // ばね
    for (const s of springs) s.step(dt);
    for (const s of [A, Bk]) if (s.id) {
      s.wall.step(dt);
      if (!s.closing && s.roofT0 >= 0) { const u = clamp01((now - s.roofT0) / 480); s.roof.set(u * u); if (u >= 1) s.roofT0 = -1; }   // 持ち上がり、加速して上へ抜ける
      else s.roof.step(dt);
      if (s.kind === 'hinge' && !s.closing && s.wall.x > s.end) { s.wall.x = s.end; if (s.wall.v > 0) s.wall.v = -s.wall.v * .3; }
      if (s.closing && s.wall.x < 0) { s.wall.x = 0; s.wall.v = 0; }
    }
    if (Bk.id && Bk.closing && !Bk.wall.moving && !Bk.roof.moving) { const it = interiors[Bk.id]; if (it && Bk.id !== A.id && Bk.id !== 'park') it.group.visible = false; if (!A.id) { U.uFocus.value = -1; o.onClosed && o.onClosed(); } Bk = slot(); }
    // 選んだ建物の光(乗せた・誘い)
    let hiId = hover && !A.id ? hover : null, amt = hiId ? .1 : 0;
    if (!hiId && invite && !A.id) { const k = (now - invite.t0) / 1700; if (k < 1) { hiId = invite.id; amt = Math.sin(Math.PI * Math.min(1, k * 1.15)) * .26; } else invite = null; }
    hiAmt.t = amt; if (hiId) U.uHi.value = LAYOUT[hiId].bid; else if (hiAmt.x < .004) U.uHi.value = -1;
    U.uHiAmt.value = Math.max(0, hiAmt.x);
    U.uDim.value = clamp01(dim.x);
    U.uLiftBid.value = liftId ? LAYOUT[liftId].bid : -1; U.uLift.value = lift.x;
    if (!A.id && !hover && !lift.moving && Math.abs(lift.x) < .002) liftId = null;
    // 行列
    slotMats(A, 1, 2, 'uOpenA', 'uRoofA'); slotMats(Bk, 3, 4, 'uOpenB', 'uRoofB');
    const ob = S.B.observatory; if (ob) { bldM('observatory'); U.uPM.value[5].copy(tb).multiply(lm.makeRotationY(t * .12)).multiply(tbi); }
    const cl = S.B.clinic; if (cl) { bldM('clinic'); const k = clinicDoor(t); U.uPM.value[6].copy(tb).multiply(lm.makeTranslation(-k * .2, 0, 0)).multiply(tbi); U.uPM.value[7].copy(tb).multiply(lm.makeTranslation(k * .2, 0, 0)).multiply(tbi); }
    signMats();
    U.uTime.value = t;
    // 昼・夕・夜
    if (tod.moving) { const g = applyTod(L, renderer, tod.x); for (const id in interiors) interiors[id] && interiors[id].setNight && interiors[id].setNight(g); }
    // 中の灯り
    if (A.id || Bk.id) {
      const id = A.id || Bk.id; if (id !== 'plaza') { const pl = placeOf(S, id), il = inLightOf(id); L.pIn.position.copy(il.p).applyAxisAngle(Y, pl.yaw).add(pl.p); L.pIn.distance = il.dist; inK = il.k; }
    }
    L.pIn.intensity = Math.max(0, inLight.x) * (1.4 + U.uNight.value * 2) * inK;
    L.pH.intensity = (L.pH.userData.base || 0) * ((A.id || Bk.id) === 'plaza' ? 1 : 1 - 1.4 * U.uDim.value);   // 建物をひらいている間は、広場の灯りを半分に(寄ったとき白く飛ばない)
    // 町の暮らし
    if (!paused) {
      const blockedAng = A.id && A.kind === 'hinge' && A.id !== 'hospital' ? deg(LAYOUT[A.id].a) : null;
      const blocked = A.id && A.kind === 'hinge' ? footprint(A) : null;
      placePeople(S.dyn, t, blocked); placeVehicles(S.dyn, t, dt, blockedAng); placeSky(S.dyn, t, U.uNight.value); placeSmall(S.dyn, t, !(A.id === 'atelier'));
    }
    for (const id in interiors) { const it = interiors[id]; if (it && it.group.visible) it.update(dt, t, tod.x < .5 ? 'day' : tod.x < 1.5 ? 'dusk' : 'night'); }
    S.world.rotation.y = rot.x;
    setCamera();
    const active = springs.some(s => s.moving) || [A, Bk].some(s => s.id && (s.wall.moving || s.roof.moving || s.steps.length || s.roofT0 >= 0)) || later.length || down || Math.abs(inertia) > .002 || invite;
    const idle = !active && now - lastInput > 1600;
    // 操作していないときは 30fps
    if (manual && !force) return;
    if (!idle || frameN % 2 === 0 || dirty || force) {
      renderer.render(S.scene, camera); dirty = false;
      layout();
      o.onFrame && o.onFrame(renderer.info.render);
    }
    if (manual) return;
    if ((active || !paused || dirty) && visible && !document.hidden) requestAnimationFrame(loop); else running = false;
  }
  function clinicDoor(tt) { const u = (tt % 11) / 11; return u < .1 ? u / .1 : u < .45 ? 1 : u < .55 ? 1 - (u - .45) / .1 : 0; }
  function footprint(s) {
    const b = BOXES[s.id], pl = placeOf(S, s.id), z0 = b.d / 2 + WALL, z1 = z0 + b.h * Math.min(1, s.wall.x / (Math.PI / 2)), X = b.w / 2 + WALL;
    const c = Math.cos(-pl.yaw), sn = Math.sin(-pl.yaw);
    return (x, z) => { const dx = x - pl.p.x, dz = z - pl.p.z, lx = dx * c - dz * sn, lz = dx * sn + dz * c; return lx > -X && lx < X && lz > z0 && lz < z1; };
  }

  /* ---- 画面の上の位置を、ページへ(見えないボタン・名前の札) ---- */
  function layout() {
    const out = { b: {}, st: [] };
    for (const id of IDS) {
      const pl = placeOf(S, id), bd = boundsOf(id, id === 'plaza' ? { y0: 0, top: .5 } : S.B[id].ex);
      const m = new THREE.Matrix4().makeRotationY(rot.x).multiply(new THREE.Matrix4().compose(pl.p, new THREE.Quaternion().setFromAxisAngle(Y, pl.yaw), one));
      const tp = new THREE.Vector3(0, bd.top + (liftId === id ? lift.x : 0), 0).applyMatrix4(m).project(camera);
      const cp = new THREE.Vector3(0, bd.top * .45, 0).applyMatrix4(m).project(camera);
      out.b[id] = { tag: [(tp.x + 1) / 2 * W, (1 - tp.y) / 2 * H], c: [(cp.x + 1) / 2 * W, (1 - cp.y) / 2 * H] };
    }
    if (A.id) out.st = stationsOnScreen();
    o.onLayout(out);
  }

  /* ---- 最初の1枚を描いてから、止めた画像と入れ替える ---- */
  resize();
  placePeople(S.dyn, 0, null); placeVehicles(S.dyn, 0, 0, null); placeSky(S.dyn, 0, U.uNight.value); placeSmall(S.dyn, 0, true);
  setCamera(); renderer.render(S.scene, camera); layout();
  const info = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
  kick();
  modP.then(() => {});
  return {
    open, close, setActive, stationHover, find, info, renderer,
    get findId() { return findSid; },
    hover(id) { setHover(id); },
    press(id) { liftId = id; lift.v = -.85; kick(); },
    invite: doInvite,
    setTod(m) { tod.t = m; kick(); },
    setPaused(p) { paused = p; kick(); },
    get openId() { return A.id; },
    stations() { const it = A.id && interiors[A.id]; return it ? it.stations.map(s => ({ id: s.id, label: s.label })) : []; },
    resize, kick,
    /* 手動の時計で ms だけ進めて、1枚描く(撮るとき) */
    advance(ms) { const n = Math.max(1, Math.round(ms / (1000 / 60))); for (let i = 0; i < n; i++) { vnow += ms / n; frame(vnow, i === n - 1); } },
    get manual() { return manual; }
  };
}
