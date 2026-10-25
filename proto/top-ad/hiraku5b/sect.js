/* ================================================================
   案B「病院の断面」— 最初の画面のすぐ後に、町の病院を、島から切り出した一切れの上の断面で見せる
   ・町と同じ作り方(world.js・buildings.js・interiors.js)。world.js は町と別の実体として読む(?inside)。町と uniform を共有しない
   ・主棟だけ(右の翼・救急口・左のスロープは作らない)。屋根とヘリポートは残す。少し斜め(3/4)から、正投影
   ・建物は島の一切れ(草・地層・岩)の上に立つ。一切れの下の端は、区画の空の色へ溶ける
   ・現れる: 区画が画面に入ると、正面の壁が地面へ沈み(地面より下は描かない)、中の灯りが上がる。スクロールを戻すと逆へ
   ・中の人は時刻のシミュレーションのまま動く(it.update)。見える間だけ描く(30 こま/秒)
   ・撮る(?capture=inside&tod=day|dusk|night&w=): 透明の地の止めた絵と、道具の札・階の札の位置(枠の %)を window.__done へ
   ================================================================ */
import * as THREE from 'three';

const deg = d => d * Math.PI / 180, clamp01 = v => Math.max(0, Math.min(1, v));
const ease = v => { v = clamp01(v); return v < .5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2; };
/* 構図: az = 正面からの回し(度。負で右の側面が見える)、el = 見下ろす角度(度)。m = 枠の余白(幅・高さに対する比) */
export const VIEW = { az: -16, el: 11, m: { l: .02, r: .02, t: .025, b: .02 } };
/* 一切れの大きさ(主棟の外の面から): 左右・奥・手前(車寄せの前の広場) */
const SLAB = { l: .72, r: .3, back: .3, front: .95 };   // 左は階の札の場所(左の切り口の外)
const TOD_I = { day: 0, dusk: 1, night: 2 };
const ROOMS = [2, 1, 0];   // 階の札(3F・2F・1F の順)。左の切り口の外、その階の真ん中の高さ
const STATIONS = ['yawagaeshi', 'keiji', 'nidodema'];

/* ---------- 島の一切れ(角の丸い長方形の地層。島の縁と同じ層と色) ---------- */
const STRATA = [   // 島の縁(world.js)と同じ層と色。縦はおよそ 0.6 倍(低い角度から見ると、層の面が正面に近く、厚く見えるため)
  { y: 0, d: 0, c: null }, { y: -.04, d: .03, c: 'grassEdge' }, { y: -.09, d: -.012, c: 'grassEdge' },
  { y: -.1, d: -.03, c: 'soil1' }, { y: -.22, d: -.05, c: 'soil1' },
  { y: -.23, d: -.09, c: 'soil2' }, { y: -.55, d: -.11, c: 'soil2' },
  { y: -.56, d: -.15, c: 'soil3' }, { y: -.8, d: -.19, c: 'soil3' },
  { y: -.81, d: -.24, c: 'soil4' }, { y: -1.0, d: -.32, c: 'soil4' },
  { y: -1.03, d: -.42, c: 'rock' }, { y: -1.22, d: -.66, c: 'rock' }, { y: -1.25, d: -.74, c: 'rockD' }, { y: -1.45, d: -1.1, c: 'rockD' }
];
function rimPoints(x0, x1, z0, z1, rad, step) {   // 外向きの向きつきの縁の点 [x, z, nx, nz]。正面(+z)の左から右へ、時計回り
  const out = [], line = (ax, az, bx, bz, nx, nz) => { const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / step)); for (let i = 0; i < n; i++) { const u = i / n; out.push([ax + (bx - ax) * u, az + (bz - az) * u, nx, nz]); } };
  const arc = (cx, cz, a0, a1) => { const n = 5; for (let i = 0; i < n; i++) { const a = a0 + (a1 - a0) * i / n; out.push([cx + Math.cos(a) * rad, cz + Math.sin(a) * rad, Math.cos(a), Math.sin(a)]); } };
  line(x0 + rad, z1, x1 - rad, z1, 0, 1); arc(x1 - rad, z1 - rad, Math.PI / 2, 0);
  line(x1, z1 - rad, x1, z0 + rad, 1, 0); arc(x1 - rad, z0 + rad, 0, -Math.PI / 2);
  line(x1 - rad, z0, x0 + rad, z0, 0, -1); arc(x0 + rad, z0 + rad, -Math.PI / 2, -Math.PI);
  line(x0, z0 + rad, x0, z1 - rad, -1, 0); arc(x0 + rad, z1 - rad, Math.PI, Math.PI / 2);
  return out;
}
export function slabExtent(BOXES, WALL) {
  const b = BOXES.hospital, X = b.w / 2 + .004 + WALL, Z = b.d / 2 + .004 + WALL;
  return { X, Z, x0: -X - SLAB.l, x1: X + SLAB.r, z0: -Z - SLAB.back, z1: Z + SLAB.front };
}
/* world.js の makeScene の extra(建物と同じ作り方でまとめる)。K = kit.js */
function slice(world, ctx, K, BOXES, WALL) {
  const { C, M } = K, rnd = ctx.rnd, q = ctx.q, ex = slabExtent(BOXES, WALL);
  const rim = rimPoints(ex.x0, ex.x1, ex.z0, ex.z1, .22, .09), N = rim.length;
  let per = 0; const acc = [0]; for (let i = 1; i <= N; i++) { const a = rim[i - 1], b2 = rim[i % N]; per += Math.hypot(b2[0] - a[0], b2[1] - a[1]); acc.push(per); }
  const BND = [0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6], AMP = [.01, .04, .05, .05, .04, .045, .05];
  const ph = Array.from({ length: 7 }, () => [rnd() * 6.28, rnd() * 6.28]), jit = STRATA.map(() => [rnd() * 9, rnd() * 9]);
  const rows = STRATA.map((L, k) => rim.map((p, i) => {
    const f = acc[i] / per * 6.2832, bnd = BND[k], nn = k > 2 ? Math.sin(f * 9 + jit[k][0]) * .03 + Math.sin(f * 23 + jit[k][1]) * .018 : 0;
    const yy = L.y + (k > 2 ? AMP[bnd] * (Math.sin(f * 3 + ph[bnd][0]) + .6 * Math.sin(f * 7 + ph[bnd][1])) : 0), d = L.d + nn;
    return [p[0] + p[2] * d, yy, p[1] + p[3] * d, p[2], p[3]];
  }));
  const pos = [], nor = [], col = [], idx = [], tmp = new THREE.Color();
  for (let k = 0; k < rows.length - 1; k++) {
    const cc = STRATA[k + 1].c; if (!cc) continue;
    for (let i = 0; i < N; i++) {
      const a = rows[k][i], b2 = rows[k][(i + 1) % N], c = rows[k + 1][(i + 1) % N], d = rows[k + 1][i], nx = (a[3] + b2[3]) / 2, nz = (a[4] + b2[4]) / 2;
      tmp.set(C[cc]).offsetHSL(0, (rnd() - .5) * .02, (rnd() - .5) * .035 - (k > 6 ? .02 : 0));
      const b0 = pos.length / 3;
      for (const v of [a, b2, c, d]) { pos.push(v[0], v[1], v[2]); nor.push(nx, -.15 * (k > 10 ? 1 : 0), nz); col.push(tmp.r, tmp.g, tmp.b); }
      idx.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
    }
  }
  // 底(下向き。見えない)
  const last = rows[rows.length - 1], cy = last.reduce((s, v) => s + v[1], 0) / N - .05, b0 = pos.length / 3;
  tmp.set(C.rockD); pos.push(0, cy, (ex.z0 + ex.z1) / 2); nor.push(0, -1, 0); col.push(tmp.r, tmp.g, tmp.b);
  for (const v of last) { pos.push(v[0], v[1], v[2]); nor.push(0, -1, 0); col.push(tmp.r, tmp.g, tmp.b); }
  for (let i = 0; i < N; i++) idx.push(b0, b0 + 1 + i, b0 + 1 + (i + 1) % N);
  const skirt = new THREE.Mesh(K.geo(pos, nor, idx, col), M('#FFFFFF', { flat: true, vc: true, r: .95 })); skirt.castShadow = false; skirt.receiveShadow = true; skirt.userData.surf = true;
  world.add(skirt);
  // 上の面: 草(わずかなむら)。縁の点から真ん中へ
  const tp = [], tn = [], tc = [], ti = [], cx = (ex.x0 + ex.x1) / 2, cz = (ex.z0 + ex.z1) / 2;
  tp.push(cx, 0, cz); tn.push(0, 1, 0); tmp.set(C.grass); tc.push(tmp.r, tmp.g, tmp.b);
  for (const v of rows[0]) { tp.push(v[0], 0, v[2]); tn.push(0, 1, 0); tmp.set(rnd() < .5 ? C.grass : C.grass2).offsetHSL(0, 0, (rnd() - .5) * .03); tc.push(tmp.r, tmp.g, tmp.b); }
  for (let i = 0; i < N; i++) ti.push(0, 1 + (i + 1) % N, 1 + i);
  const top = new THREE.Mesh(K.geo(tp, tn, ti, tc), M('#FFFFFF', { vc: true, r: .95 })); top.castShadow = false; top.receiveShadow = true; top.userData.surf = true;
  world.add(top);
  // 車寄せの前の広場(石の床)と縁石。病院の正面から一切れの手前の縁まで
  const fz0 = ex.Z + .2, fz1 = ex.z1 - .18, pv = K.box(2 * ex.X - .1, .012, fz1 - fz0, M(C.pave, { r: .9 })); pv.position.set(0, .006, (fz0 + fz1) / 2); pv.castShadow = false; pv.userData.surf = true; world.add(pv);
  for (const s of [-1, 1]) { const cb = K.box(.035, .03, fz1 - fz0, M(C.curb, { r: .85 })); cb.position.set(s * (ex.X - .03), .015, (fz0 + fz1) / 2); cb.castShadow = false; world.add(cb); }
  // まわりの小物(建物の正面にかからない所): 右奥の木、右手前の街灯、左手前の植え込み(左奥は建物の陰に隠れて、葉の端だけが浮いて見えるので置かない)
  const plant = (t, x, z, ry) => { t.position.set(x, 0, z); t.rotation.y = ry; world.add(t); };
  plant(K.tree(rnd, 'column', .78, q), ex.x1 - .2, ex.z0 + .45, rnd() * 6);
  plant(K.tree(rnd, 'shrub', 1.05, q), ex.x0 + .25, ex.Z + .45, rnd() * 6);
  const lp = K.lamp(1); lp.position.set(ex.x1 - .16, 0, ex.z1 - .3); world.add(lp);
}

/* ---------- 部品をそろえる(町と別の world.js の実体) ---------- */
async function parts() {
  const [W, Bd, K, MOD] = await Promise.all([import('./world.js?inside'), import('./buildings.js'), import('./kit.js'), import('./interiors.js')]);
  return { W, BOXES: Bd.BOXES, WALL: Bd.WALL, K, MOD };
}
function sceneOpts(P, q) { return { only: 'hospital', quality: q, ao: false, exterior: { solo: true }, extra: (world, ctx) => slice(world, ctx, P.K, P.BOXES, P.WALL) }; }
/* 枠に収める点: 一切れの上の縁と下の端、建物の箱(屋上の設備まで)、右奥の木のてっぺん */
function framePts(P) {
  const ex = slabExtent(P.BOXES, P.WALL), b = P.BOXES.hospital, top = b.h + .1 + .62 + .35 + .06, pts = [];
  for (const [x, z] of [[ex.x0, ex.z0], [ex.x1, ex.z0], [ex.x0, ex.z1], [ex.x1, ex.z1]]) pts.push(new THREE.Vector3(x, 0, z), new THREE.Vector3(x * .7, -1.45, z * .7 + (ex.z0 + ex.z1) * .15));
  for (const x of [-ex.X, ex.X]) for (const z of [-ex.Z, ex.Z]) pts.push(new THREE.Vector3(x, top, z));
  pts.push(new THREE.Vector3(ex.x1 - .2, 1.24, ex.z0 + .45));
  return pts;
}
function aim(P, camera, world, W, H, mg) {
  world.rotation.y = deg(45 + VIEW.az); world.updateMatrixWorld(true);
  P.W.aimCamera(camera, new THREE.Vector3(0, 1, 0), deg(VIEW.el));
  const pts = framePts(P).map(p => world.localToWorld(p.clone()));
  return P.W.fit(camera, pts, W, H, { x0: W * mg.l, x1: W * (1 - mg.r), y0: H * mg.t, y1: H * (1 - mg.b) });
}
/* 枠の縦横比(高さ / 幅): ページの区画の大きさに使う(止めた画像と立体を同じ枠に) */
export function frameAspect(P) {
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 300), g = new THREE.Group();
  g.rotation.y = deg(45 + VIEW.az); g.updateMatrixWorld(true); P.W.aimCamera(cam, new THREE.Vector3(0, 1, 0), deg(VIEW.el));
  cam.updateMatrixWorld(); const inv = cam.matrixWorldInverse; let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of framePts(P)) { const v = g.localToWorld(p.clone()).applyMatrix4(inv); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
  const m = VIEW.m; return ((y1 - y0) / (1 - m.t - m.b)) / ((x1 - x0) / (1 - m.l - m.r));
}
/* 中の灯り(ひらいた建物と同じ置き方) */
function inLight(P, L, world) { const b = P.BOXES.hospital, p = new THREE.Vector3(0, b.h * .62 + .06, b.d * .08); world.localToWorld(p); L.pIn.position.copy(p); L.pIn.distance = Math.max(2.2, Math.max(b.w, b.h) * 1.3); }
/* 町の島に合わせた灯りのうち、一棟だけの場では場所の合わないもの(広場の弧のそば・入口)は使わない。影の範囲は一切れに合わせて狭める */
function fitLights(L) {
  L.pI.intensity = 0; L.pS.intensity = 0; L.pH.intensity = 0; L.pH.userData.base = 0;
  const sc = L.sun.shadow.camera, e = new THREE.Matrix4().lookAt(L.sun.position, new THREE.Vector3(), new THREE.Vector3(0, 1, 0)).elements;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const x of [-3, 3]) for (const y of [-2.5, 4.4]) for (const z of [-2.2, 2.6]) { const px = x * e[0] + y * e[1] + z * e[2], py = x * e[4] + y * e[5] + z * e[6]; x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py); }
  sc.left = x0; sc.right = x1; sc.bottom = y0; sc.top = y1; sc.updateProjectionMatrix();
}
const MODE = m => m < .5 ? 'day' : m < 1.5 ? 'dusk' : 'night';
/* 札の位置: 道具は物の上(画面の板の少し上)、階の札は左の切り口の角の外(その階の真ん中の高さ)。枠の中の px */
function labels(P, it, camera, world, W, H) {
  const v = new THREE.Vector3(), out = { st: {}, fl: [] }, b = P.BOXES.hospital, fh = b.h / b.floors, ex = slabExtent(P.BOXES, P.WALL);
  it.group.updateWorldMatrix(true, true);
  for (const s of it.stations) { if (!STATIONS.includes(s.id)) continue; v.copy(s.anchor); it.group.localToWorld(v); v.project(camera); out.st[s.id] = [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; }
  for (const f of ROOMS) { v.set(-ex.X, .06 + fh * (f + .5), ex.Z); world.localToWorld(v); v.project(camera); out.fl.push([(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]); }
  return out;
}

/* ================================================================
   ページの中で描く: o = { canvas, tod(0..2), quality, paused, reveal(), reduce(), onLayout({ st, fl, W, H }), onReady() }
   返す: { setReveal(p), setTod(m), setPaused(on), setVisible(on), resize(), info }
   ================================================================ */
export async function section(o) {
  const T0 = performance.now(), boot = {}, mark = k => { boot[k] = Math.round(performance.now() - T0); };   // 作る手順ごとの時刻(ms。info.boot)
  const P = await parts(), { W: Wd } = P; mark('parts');
  const q = o.quality === 'high' ? 'high' : o.quality === 'low' ? 'low' : 'mid';
  const S = Wd.makeSceneAsync ? await Wd.makeSceneAsync(sceneOpts(P, q)) : Wd.makeScene(sceneOpts(P, q)); mark('scene');
  const L = Wd.makeLights(S.scene, q === 'high' ? 2048 : 1024), U = Wd.U, LAY = Wd.LAYOUT;
  if (q === 'low') L.sun.castShadow = false;
  let CW = o.canvas.clientWidth || 360, CH = o.canvas.clientHeight || 450;
  const renderer = Wd.makeRenderer(o.canvas, Math.min(devicePixelRatio || 1, q === 'high' ? 2 : q === 'mid' ? 1.6 : 1), CW, CH, false); mark('context');
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 300);
  // 一棟だけ: 病院を「ひらいた建物」にして、前の壁の動き(沈む)を uPM[1] に。屋根は残す。前の壁は地面の高さより下を描かない
  U.uOpenA.value = LAY.hospital.bid; U.uRoofA.value = 1; U.uGroundCut.value = -.004; U.uFocus.value = -1;
  for (const M4 of U.uPM.value) M4.identity();
  U.uHazeY.value.set(-1.45, -.82); U.uHazeK.value = 0; U.uHazeA.value = 1;   // 一切れの下の端は、透明へ溶かす(ページの空の色がそのまま見える)
  // 中の形(人と道具)。画像は絶対の URL で読む
  const loader = new THREE.TextureLoader();
  const cctx = { palette: Wd.PALETTE, quality: q, loadTexture: url => loader.loadAsync(url).then(tx => { tx.colorSpace = THREE.SRGBColorSpace; return tx; }) };
  const it = P.MOD.buildInterior('hospital', P.BOXES.hospital, cctx); S.B.hospital.anchor.add(it.group); it.group.visible = true;
  let todX = o.tod || 0, todT = todX, mode = MODE(todX);
  function setTodNow(m) { const glow = Wd.applyTod(L, renderer, m); fitLights(L); it.setNight(glow); mode = MODE(m); }
  setTodNow(todX);
  inLight(P, L, S.world);
  const BH = P.BOXES.hospital.h, SINK = BH + .25;
  let rv = o.reduce && o.reduce() ? 1 : 0, rvT = rv, revealed = false, visible = true, running = false, paused = !!o.paused, ready = false, last = performance.now(), lastDraw = 0, t = 0;
  function applyReveal() {
    const k = ease(rv);
    U.uPM.value[1].makeTranslation(0, -SINK * k, 0);
    const il = clamp01((rv - .28) / .6), glow = U.uNight.value;
    L.pIn.intensity = (1.4 + glow * 2) * il;
    if (!revealed && rv > .3) { revealed = true; if (it.reveal) it.reveal(); }
  }
  function layout() { const r = labels(P, it, camera, S.world, CW, CH); r.W = CW; r.H = CH; r.k = rv; o.onLayout && o.onLayout(r); }
  function resize() {
    CW = o.canvas.clientWidth; CH = o.canvas.clientHeight; if (!CW || !CH) return;
    renderer.setSize(CW, CH, false); aim(P, camera, S.world, CW, CH, VIEW.m); inLight(P, L, S.world); if (ready) draw(true);   // シェーダーの準備の前には描かない(描くと、その場で全部を作って主スレッドが止まる)
  }
  function draw(force) {
    applyReveal(); U.uTime.value = t;
    renderer.render(S.scene, camera); layout();
    void force;
  }
  function frame(now) {
    if (!visible || document.hidden) { running = false; return; }
    const moving = Math.abs(rvT - rv) > 1e-3 || Math.abs(todT - todX) > 1e-3;
    if (paused && !moving) { running = false; return; }   // 町の動きを止めている間は、人は止めたまま。壁と時刻が移る間だけ描く
    requestAnimationFrame(frame);
    if (!moving && now - lastDraw < 31) return;   // 動いていないときは 30 こま/秒
    const gap = Math.min(.25, (now - last) / 1000), dt = Math.min(.05, gap); last = now; lastDraw = now;
    if (o.reduce && o.reduce()) rv = rvT; else { rv += (rvT - rv) * (1 - Math.exp(-gap * 7)); if (Math.abs(rvT - rv) < .002) rv = rvT; }   // スクロールに少し遅れて、なめらかに(こまの間隔によらず、同じ時間で追いつく)
    if (Math.abs(todT - todX) > 1e-3) { todX += (todT - todX) * (1 - Math.exp(-gap * 3.2)); if (Math.abs(todT - todX) < .004) todX = todT; setTodNow(todX); }
    if (!paused) { t += dt; it.update(dt, t, mode); }
    draw();
  }
  function kick() { if (ready && !running && visible && !document.hidden) { running = true; last = lastDraw = performance.now(); requestAnimationFrame(frame); } }
  document.addEventListener('visibilitychange', kick);
  new ResizeObserver(resize).observe(o.canvas);
  aim(P, camera, S.world, CW, CH, VIEW.m);
  // 画像(実際の画面)がそろってから、最初の1枚を描く。シェーダーの準備は分けて(主スレッドを長く止めない)
  await it.ready; mark('interior');
  try { if (renderer.compileAsync && renderer.extensions.has('KHR_parallel_shader_compile')) await renderer.compileAsync(S.scene, camera); else { renderer.compile(S.scene, camera); await new Promise(r => requestAnimationFrame(r)); } } catch (e) { /* そのまま描く */ }
  mark('compile');
  ready = true;
  if (o.reveal && !(o.reduce && o.reduce())) rv = rvT = clamp01(o.reveal());   // 区画がもう見えているときは、いまのスクロールの位置の姿から(止めた画像から替わるときに、壁が戻って見えないように)
  it.update(.016, 0, mode); draw(true); kick(); mark('draw');
  o.onReady && o.onReady();
  return {
    setReveal(p) { rvT = clamp01(p); if (o.reduce && o.reduce()) rvT = 1; kick(); },
    setTod(m) { todT = m; kick(); },
    setPaused(on) { paused = !!on; kick(); },
    setVisible(on) { visible = !!on; if (visible) kick(); },
    resize,
    get info() { return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, tex: renderer.info.memory.textures, programs: renderer.info.programs.length, boot }; },
    renderer
  };
}

/* ================================================================
   止めた画像を撮る(?capture=inside&tod=&w=)。高さは枠の縦横比から。ひらいた姿(壁は沈みきって、中の灯りがついた後)
   ================================================================ */
export async function capture(Q) {
  const P = await parts(), Wd = P.W, tq = Q.get('tod') || 'day', tod = TOD_I[tq] ?? (+tq || 0);
  const W = +(Q.get('w') || 1200), AR = frameAspect(P), H = Math.round(W * AR);
  document.documentElement.classList.add('capture');
  let canvas = document.getElementById('cap'); if (!canvas) { canvas = document.createElement('canvas'); canvas.id = 'cap'; document.body.appendChild(canvas); }
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const renderer = Wd.makeRenderer(canvas, 1, W, H, true);
  const S = Wd.makeScene(sceneOpts(P, 'high')), L = Wd.makeLights(S.scene, +(Q.get('shadow') || 4096)), U = Wd.U;
  U.uOpenA.value = Wd.LAYOUT.hospital.bid; U.uRoofA.value = 1; U.uGroundCut.value = -.004;
  for (const M4 of U.uPM.value) M4.identity();
  U.uPM.value[1].makeTranslation(0, -(P.BOXES.hospital.h + .25), 0);
  U.uHazeY.value.set(-1.45, -.82); U.uHazeK.value = 0; U.uHazeA.value = 1;
  const glow = Wd.applyTod(L, renderer, tod); fitLights(L);
  const loader = new THREE.TextureLoader();
  const cctx = { palette: Wd.PALETTE, quality: 'high', loadTexture: url => loader.loadAsync(url).then(tx => { tx.colorSpace = THREE.SRGBColorSpace; return tx; }) };
  const it = P.MOD.buildInterior('hospital', P.BOXES.hospital, cctx); S.B.hospital.anchor.add(it.group);
  await it.ready; it.setNight(glow); if (it.reveal) it.reveal();
  await new Promise(r => setTimeout(r, 1400));
  const t = +(Q.get('t') || 0);
  it.update(.016, t, MODE(tod));
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 300);
  aim(P, camera, S.world, W, H, VIEW.m); inLight(P, L, S.world); L.pIn.intensity = 1.4 + glow * 2;
  renderer.render(S.scene, camera); await new Promise(r => requestAnimationFrame(r)); renderer.render(S.scene, camera);
  const lb = labels(P, it, camera, S.world, W, H), pc = ([x, y]) => [+(x / W * 100).toFixed(2), +(y / H * 100).toFixed(2)];
  window.__done = { W, H, ar: +AR.toFixed(5), st: Object.fromEntries(Object.entries(lb.st).map(([k, v]) => [k, pc(v)])), fl: lb.fl.map(pc), calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
}
