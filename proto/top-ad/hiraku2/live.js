/* ================================================================
   「ひらく町」磨き込み — 立体を動かす(ふれる → ひらく)と、止めた画像を撮る(capture)
   手触り(BRIEF 9.6・10.2): 線形の補間を使わない。カメラと回転は臨界減衰のばね。
   ・押した瞬間(100ms 以内): 建物が少し沈んで明るくなる(足もとの輪はページの側)
   ・寄る・戻る・渡る: 弧を描く(少し上がり、少し引いてから降りる)。行き先が遠いほど長く
   ・ひらく: 屋根が真上に持ち上がってから後ろへ抜け、前の壁が扉のように倒れて小さく弾む
   ・閉じる: 壁が戻り、屋根が降り、カメラが弧を描いて戻り、建物が小さく落ち着く
   ・品質の段: 高(画素比2・影2048)/中(画素比1.5・影1024)/低(画素比1・影なし)。重いときは自動で一段下げる
   ================================================================ */
import { THREE, makeScene, makeLights, applyTod, aimCamera, capFrame, makeRenderer, fit, ELEV, U, LAYOUT, IDS, CAP_W, CAP_H, placePeople, placeVehicles, placeSky, placeSmall, angDiff, plazaFrame, PALETTE } from './world.js';
import * as WORLD from './world.js';   // makeSceneAsync(段ごとに休みを入れて作る入口)があれば、それを使う
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
  if (id === 'plaza') { const F = plazaFrame(), hh = F.arcTop - F.y; return { pts: ring(2.35, 0, hh), top: hh + .1 }; }   // 広場は台地の上。弧(ロゴの立体)の上まで
  if (b.shape === 'tower') return { pts: ring(1.05, -ex.y0, ex.top), top: ex.top };
  if (b.shape === 'open') return { pts: rect(b.w / 2 + .1, b.d / 2 + .1, 0, ex.top), top: ex.top };
  const X = b.w / 2 + E + WALL, Z = b.d / 2 + E + WALL;
  const pts = rect(X, Z, -ex.y0, ex.top);
  pts.push(new THREE.Vector3(-X, 0, Z + b.h * .45), new THREE.Vector3(X, 0, Z + b.h * .45));
  return { pts, top: ex.top };
}
function rect(X, Z, y0, y1) { const o = []; for (const x of [-X, X]) for (const z of [-Z, Z]) for (const y of [y0, y1]) o.push(new THREE.Vector3(x, y, z)); return o; }
/* 押せる範囲: 箱の外の部分(病院の翼など)も、地面に接する範囲 ex.foot から足す。広場は床だけ(弧は live の中で、弧に沿った小さな箱を足す) */
function hitParts(id, ex) {
  if (id === 'plaza') return [ring(2.35, 0, .3)];
  const b = BOXES[id], lim = b.d / 2 + .2, main = boundsOf(id, ex).pts.filter(p => !(p.z > lim)), fh = Math.min(ex.top, (b.h || 1) * .7);
  return [main, ...(ex.foot || []).map(([x0, z0, x1, z1]) => rect3(x0, z0, x1, z1, -ex.y0, fh))];
}
/* 気づきの輪を出す所(建物の中の座標): 病院の屋上のヘリポート。広場の弧とも、病院の正面とも重ならない */
function nudgeAt(id, ex) { return id === 'hospital' ? (ex.heli || [1.0, BOXES.hospital.h + .12, .1]) : null; }
function rect3(x0, z0, x1, z1, y0, y1) { const o = []; for (const x of [x0, x1]) for (const z of [z0, z1]) for (const y of [y0, y1]) o.push(new THREE.Vector3(x, y, z)); return o; }
function ring(r, y0, y1) { const o = []; for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; for (const y of [y0, y1]) o.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r)); } return o; }

/* 中の灯り: 建物の中ほど(前へ出しすぎると、ひらいた前の地面が照らされすぎる)。小さな建物ほど弱く */
function inLightOf(id) {
  const b = BOXES[id], h = b.h || 1;
  return { p: new THREE.Vector3(0, h * .62, (b.d || 1) * .08), dist: Math.max(2.2, Math.max(b.w, h) * 1.3), k: clamp((b.w * (b.h || .6)) / 9.3, .22, 1) };
}

/* 建物の島の上での置き方(島のグループの中の座標) */
function placeOf(S, id) {
  if (id === 'plaza') { const { cx, cz, y } = plazaFrame(); return { p: new THREE.Vector3(cx, y || 0, cz), yaw: deg(90 - 45), face: 45, y0: 0 }; }
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
  const cut = mode === 'cutaway' ? Q.get('id') : null, closed = Q.get('closed') === '1';   // closed: 同じ構図で、閉じたまま(下の節の帯で、ひらく前の絵)
  if (MOD && cut && !closed && cut !== 'park' && cut !== 'plaza') { const it = MOD.buildInterior(cut, BOXES[cut], cctx); S.B[cut].anchor.add(it.group); built.push(it); }
  for (const it of built) { await it.ready; it.setNight(glow); if (it.reveal) it.reveal(); }
  if (built.length) await new Promise(r => setTimeout(r, 1400));
  for (const it of built) it.update(.016, t, mstr);
  if (cut) {
    const b = S.B[cut], bx = BOXES[cut], pl = placeOf(S, cut), tb = new THREE.Matrix4().compose(pl.p, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pl.yaw), new THREE.Vector3(1, 1, 1)), tbi = tb.clone().invert();
    if (!closed) U.uOpenA.value = LAYOUT[cut].bid, U.uRoofA.value = 0;
    if (closed) { /* 壁も屋根もそのまま */ } else if (bx.shape === 'tower') U.uPM.value[1].copy(tb).multiply(new THREE.Matrix4().makeRotationY(Math.PI)).multiply(tbi);
    else if (bx.shape !== 'open') { const z = bx.d / 2 + E + WALL, end = Math.PI / 2 + Math.asin(clamp((b.ex.y0 + .01) / bx.h, 0, .4)); U.uPM.value[1].copy(tb).multiply(new THREE.Matrix4().makeTranslation(0, 0, z)).multiply(new THREE.Matrix4().makeRotationX(end)).multiply(new THREE.Matrix4().makeTranslation(0, 0, -z)).multiply(tbi); }
    if (!closed) U.uPM.value[2].copy(tb).multiply(new THREE.Matrix4().makeTranslation(0, 40, 0)).multiply(tbi);
    // その建物を正面に向けて(島を回す)、少し低い角度から寄る
    const spin = deg(pl.face - 45), el = cut === 'park' ? deg(17) : deg(26);
    S.world.rotation.y = spin; S.world.updateMatrixWorld(true);
    aimCamera(camera, new THREE.Vector3(), el);
    const bd = boundsOf(cut, b && b.ex), m = new THREE.Matrix4().makeRotationY(spin).multiply(tb), pts = bd.pts.map(p => p.clone().applyMatrix4(m));
    fit(camera, pts, W, H, { x0: W * .06, x1: W * .94, y0: H * .06, y1: H * .94 });
    // 中の灯り(断面の絵でも、中が暗くならないように)
    const pIn = L.pIn, il = inLightOf(cut), c = il.p.applyMatrix4(tb); S.world.localToWorld(c);
    pIn.position.copy(c); pIn.distance = il.dist; pIn.intensity = (1.4 + glow * 2) * il.k;
    if (cut === 'park' || cut === 'plaza' || closed) pIn.intensity = 0;
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
  const pins = {}, obs = {};
  if (mode === 'poster') {   // 建物ごとの外形: まとめた形の頂点を、建物の印(aBid)ごとに画面へ写した範囲
    S.world.updateMatrixWorld(true); const v = new THREE.Vector3();
    for (const mesh of S.baked || []) {
      const P = mesh.geometry.attributes.position, Bd = mesh.geometry.attributes.aBid; if (!P || !Bd) continue;
      for (let i = 0; i < P.count; i++) {
        const bid = Math.round(Bd.getX(i)); if (bid < 1) continue;
        v.fromBufferAttribute(P, i).applyMatrix4(mesh.matrixWorld).project(camera);
        const q = obs[bid] || (obs[bid] = [1e9, 1e9, -1e9, -1e9]); q[0] = Math.min(q[0], v.x); q[1] = Math.min(q[1], v.y); q[2] = Math.max(q[2], v.x); q[3] = Math.max(q[3], v.y);
      }
    }
  }
  if (mode === 'poster') for (const id of IDS) {
    const ex = id === 'plaza' ? null : S.B[id].ex, pl = placeOf(S, id), bd = boundsOf(id, ex), m = new THREE.Matrix4().compose(pl.p, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pl.yaw), new THREE.Vector3(1, 1, 1));
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of hitParts(id, ex).flat()) { const v = p.clone().applyMatrix4(m).project(camera); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    const tp = new THREE.Vector3(0, bd.top, 0).applyMatrix4(m).project(camera);
    const pc = (vx, vy) => [+((vx + 1) / 2 * 100).toFixed(2), +((1 - vy) / 2 * 100).toFixed(2)];
    pins[id] = { tag: pc(tp.x, tp.y), box: [...pc(x0, y1), ...pc(x1, y0)] };
    const ob = obs[LAYOUT[id].bid]; if (ob) pins[id].ob = [...pc(ob[0], ob[3]), ...pc(ob[2], ob[1])];
    const na = ex && nudgeAt(id, ex); if (na) { const v = new THREE.Vector3(...na).applyMatrix4(m).project(camera); pins[id].nudge = pc(v.x, v.y); }
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
export async function live(o) {
  /* 撮るための手動の時計(?clock=manual)。ふつうは clock() */
  const manual = new URLSearchParams(location.search).get('clock') === 'manual';
  let vnow = 0;
  const clock = () => manual ? vnow : performance.now();
  const small = Math.min(innerWidth, innerHeight) < 700 || innerWidth < 900;
  let W = o.canvas.clientWidth, H = o.canvas.clientHeight;
  /* 品質の段(高・中・低)。最初はページが端末の手がかりで選ぶ。動かしてみて重ければ、ここで一段ずつ下げる */
  const DPR = { high: 2, mid: 1.5, low: 1 }, SHADOW = { high: 2048, mid: 1024, low: 0 };
  let tier = DPR[o.quality] ? o.quality : small ? 'mid' : 'high';
  const renderer = makeRenderer(o.canvas, Math.min(devicePixelRatio || 1, DPR[tier]), W, H, false);
  // 町を作るあいだ主スレッドを長く止めないよう、分けて作る入口があれば待つ(止めた画像は、そのあいだも見えている)
  const S = WORLD.makeSceneAsync ? await WORLD.makeSceneAsync({ quality: tier }) : makeScene({ quality: tier });
  const L = makeLights(S.scene, SHADOW[tier] || 1024);
  if (!SHADOW[tier]) L.sun.castShadow = false;
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 300);
  const CAPF = capFrame(camera);
  const origin = new THREE.Vector3();

  /* ---- 状態 ---- */
  const rot = new Spring(0, 7.5, 1), camX = new Spring(0, 7.5, 1), camY = new Spring(0, 7.5, 1), camZ = new Spring(0, 7.5, 1), elev = new Spring(ELEV, 7, 1);
  const dim = new Spring(0, 8, 1), lift = new Spring(0, 24, .55), hiAmt = new Spring(0, 11, 1), tod = new Spring(o.tod || 0, 4.2, 1), inLight = new Spring(0, 7, 1);
  const nearK = new Spring(0, 6, 1);   // 道具に寄るとき、手前の物(人・机・上の階の床)を切り落とす面を、画面の少し手前まで進める
  /* 飛ぶ: 0 → 1 の進み具合。途中で少し上がり(仰角)、少し引く(拡大を戻す)。hump(fly.x) が山の形 */
  const fly = new Spring(1, 6, 1); let flyAmp = { el: 0, z: 0 };
  const hump = p => Math.pow(Math.sin(Math.PI * clamp01(p)), 1.3);
  let flash = null;   // 押した建物を一瞬明るく
  const slot = () => ({ id: null, wall: new Spring(0, 11, .5), roof: new Spring(0, 6, 1), roofT0: -1, end: 0, kind: 'hinge', t0: 0, steps: [] });
  let A = slot(), Bk = slot();
  let base = null, paused = false, running = false, visible = true, t = 0, last = clock(), lastInput = 0, dirty = true, frameN = 0;
  let hover = null, liftId = null, invite = null, preRot = 0, dragOff = new Spring(0, 9, 1), openCam = null, curStation = null, findSid = null, findC = null, turnTok = 0;
  /* 後で一度だけ動かす段取り(時計の時刻で) */
  const later = [];
  function after(ms, f) { later.push({ at: clock() + ms, f }); later.sort((a, b) => a.at - b.at); }
  /* 行き先までの遠さ(回す角度・拡大の比・画面の上の移動)から、飛ぶ長さを決める。ばねの速さをそろえ、着いたら元に戻す */
  function farness() {
    const z0 = Math.exp(camZ.x), dz = Math.abs(camZ.t - camZ.x), dxy = Math.hypot(camX.t - camX.x, camY.t - camY.x) * z0 / Math.max(1, Math.min(W, H));
    return Math.abs(rot.t - rot.x) + dz * .5 + dxy * .6 + Math.abs(elev.t - elev.x) * .5;
  }
  function flight(arc = 1, zoomArc = 1) {
    const d = farness(), T = clamp(.68 + d * .3, .68, 1.7), w = 6.2 / T, tok = ++turnTok;
    for (const s of [rot, camX, camY, camZ, elev]) s.w = w;
    fly.x = 0; fly.v = 0; fly.t = 1; fly.w = w * 1.1;
    flyAmp = { el: deg(clamp(5 + d * 4, 5, 13)) * arc, z: clamp(.08 + d * .08, .08, .3) * zoomArc };
    after(T * 1000 + 300, () => { if (tok === turnTok) { rot.w = camX.w = camY.w = camZ.w = 7.5; elev.w = 7; } });
    return T * 1000;
  }
  function easeTurn() { flight(.4, 0); }
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
    const hk = hump(fly.x);
    aimCamera(camera, origin, elev.x + flyAmp.el * hk);
    const ppu = Math.exp(camZ.x) * (1 - flyAmp.z * hk);
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
  /* ひらいたときの寄る先(建物を正面に向け、安全な範囲 = パネルやシートを避けた所に収める) */
  function frameFor(id) {
    const pl = placeOf(S, id), r = nearestRot(rot.x, deg(pl.face - 45)), bldg = id !== 'plaza' && id !== 'park';
    // 広場は、弧がロゴとして読める低めの角度から。病院は少し見下ろして、手前の広場の弧を画面の下へ逃がす
    const el = id === 'park' ? deg(small ? 16 : 22) : id === 'plaza' ? deg(30) : id === 'hospital' ? deg(31) : deg(26);
    const sf = o.safe(), sw = sf.r - sf.l, shh = sf.b - sf.t;
    const q = viewBox(id, r, el, bldg);
    let ppu;
    if (bldg) ppu = Math.min(fitPpu(q, id, sw, shh), fitPpu(viewBox('hospital', r, deg(31), true), 'hospital', sw, shh) * 1.25);   // 小さな建物は、病院の 1.25 倍まで
    else { const k = id === 'plaza' ? .7 : small ? 1.12 : .94; ppu = Math.min(sw * k / q.w, shh * k / q.h, base.ppu * (id === 'park' ? 6.5 : 14)); }
    // 建物は、中の階を安全な範囲の少し上(46%)に。手前の倒れた壁と広場は下へ
    const scx = (sf.l + sf.r) / 2, scy = sf.t + shh * (bldg ? .46 : .5);
    return { rot: r, elev: el, x: q.cx - (scx - W / 2) / ppu, y: q.cy + (scy - H / 2) / ppu, ppu };
  }
  /* 建物の、カメラから見た範囲(カメラの座標)。建物は中の階(床から箱の高さまで。倒れた壁と屋上ははみ出してよい)、展望台は塔の中の階 */
  function viewBox(id, r, el, bldg) {
    const pl = placeOf(S, id), b = BOXES[id], X0 = b ? b.w / 2 + E + WALL : 0, Z0 = b ? b.d / 2 + E + WALL : 0;
    const pts = id === 'observatory' ? ring(1.05, 0, b.h) : bldg ? rect3(-X0, -Z0, X0, Z0, -S.B[id].ex.y0, b.h) : boundsOf(id, id === 'plaza' ? null : S.B[id].ex).pts;
    aimCamera(tmpCam, origin, el);
    const m = new THREE.Matrix4().makeRotationY(r).multiply(new THREE.Matrix4().compose(pl.p, new THREE.Quaternion().setFromAxisAngle(Y, pl.yaw), one));
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const p of pts) { const v = p.clone().applyMatrix4(m).applyMatrix4(tmpCam.matrixWorldInverse); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    return { w: x1 - x0, h: y1 - y0, cx: (x0 + x1) / 2, cy: (y0 + y1) / 2 };
  }
  /* ひらいた建物が主役: スマホはシートの上の見える幅の 88%、PC はパネルの左の範囲の 55%(画面の幅の約 36%)。高さが足りなければ縦で収める(展望台・事務所) */
  function fitPpu(q, id, sw, shh) {
    const tower = id === 'observatory', fw = small ? .88 : .55, fh = tower ? (small ? .98 : .9) : small ? .9 : .82;
    return Math.min(sw * fw / q.w, shh * fh / q.h, base.ppu * 14);
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
    const ppu = Math.min(Math.sqrt(.3 * sw * shh / (w * h)), sw * .8 / w, shh * .66 / h, base.ppu * 110);
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
    const transfer = !!A.id;
    if (A.id) { closeSlot(A); Bk = A; }   // 前の建物は、渡る途中で閉じる
    A = slot(); A.id = id; A.t0 = clock();
    A.kind = id === 'plaza' || id === 'park' ? 'none' : BOXES[id].shape === 'tower' ? 'spin' : 'hinge';
    if (A.kind === 'hinge') { const b = S.B[id]; A.end = Math.PI / 2 + Math.asin(clamp((b.ex.y0 + .01) / BOXES[id].h, 0, .4)); }
    if (A.kind === 'spin') A.end = Math.PI;
    dragOff.set(0); findSid = null; nearK.t = 0;
    U.uOpenA.value = LAYOUT[id].bid; U.uFocus.value = LAYOUT[id].bid; dim.t = .34;
    pressFx(id);                       // 押した手応え(沈んで明るく)。乗せたときの浮き(.07)は戻す。中の形は浮かないので、外と中がずれないように
    hover = null; o.onHover(null);
    interiorOf(id);
    const it = interiors[id];
    if (it) it.group.visible = true;
    const reduce = o.reduce && o.reduce();
    retarget();
    // 町ぜんたいからは少し上がって降りる。ひらいたまま移るときは、町の上空を渡る(高く・大きく引く)
    const T = reduce ? 0 : transfer ? flight(1.3, 1.2) : flight(1.1, .55);
    const arrive = Math.round(T * .55);
    const at = ms => reduce ? 0 : ms + arrive;
    A.steps = [
      ...(reduce ? [] : [{ t: at(-120), f: () => { A.roofT0 = clock(); } }]),
      { t: at(0), f: () => { A.wall.t = A.end; } },
      { t: at(190), f: () => { inLight.t = 1; } },
      ...stationSeq(id, at(370), reduce),
      { t: at(820), f: () => { o.onOpened && o.onOpened(id); } }
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
  function closeSlot(s) { s.wall.t = 0; s.roof.t = 0; s.roofT0 = -1; s.steps = []; s.closing = true; s.settled = false; const it = interiors[s.id]; if (it) for (const st of it.stations) { st.setActive(false); st.setHover(false); } }
  function close() {
    lastInput = clock();
    if (!A.id) return;
    closeSlot(A); Bk = A; A = slot();
    U.uOpenA.value = -1; U.uFocus.value = Bk.id ? LAYOUT[Bk.id].bid : -1; dim.t = 0; inLight.t = 0; curStation = null; dragOff.set(0); findSid = null; nearK.t = 0;
    retarget();
    if (o.reduce && o.reduce()) { Bk.wall.set(0); Bk.roof.set(0); for (const s of [rot, camX, camY, camZ, elev, dim]) s.set(s.t); }
    else flight(.8, 0);
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
  function roofLocal(s, out) {
    const u = clamp01(s.roof.x), up = 1.25 * (1 - Math.pow(1 - Math.min(1, u / .45), 3)), v = Math.max(0, (u - .45) / .55);
    return out.makeTranslation(0, up + 2.4 * v * v, -6.5 * v * v);
  }
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
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  for (const id of IDS) {
    const pl = placeOf(S, id), holder = new THREE.Object3D(); holder.position.copy(pl.p); holder.rotation.y = pl.yaw; S.world.add(holder);
    for (const part of hitParts(id, id === 'plaza' ? null : S.B[id].ex)) {
      const bb = new THREE.Box3().setFromPoints(part), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3());
      const hm = new THREE.Mesh(new THREE.BoxGeometry(Math.max(sz.x, .05), Math.max(sz.y, .05), Math.max(sz.z, .05)), hitMat);
      hm.position.copy(c); holder.add(hm); hm.userData.id = id; hits.push(hm);
    }
  }
  if (S.plazaInfo) for (const arc of [S.plazaInfo.aI, S.plazaInfo.aS]) for (let i = 0; i < (arc || []).length; i += 2) {   // 弧(島の座標)に沿って
    const [x, y, z] = arc[i]; if (y < plazaFrame().y + .12) continue;
    const hm = new THREE.Mesh(new THREE.BoxGeometry(.32, .32, .32), hitMat); hm.position.set(x, y, z); S.world.add(hm); hm.userData.id = 'plaza'; hits.push(hm);
  }
  const groundHit = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, .1, 24), new THREE.MeshBasicMaterial({ visible: false })); S.world.add(groundHit);
  let rects = {};
  function pick(e) {
    const r = o.canvas.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const h = ray.intersectObjects(hits, false)[0];
    if (h) return h.object.userData.id;
    const near = nearest(e.clientX - r.left, e.clientY - r.top, e.pointerType === 'mouse' ? 10 : A.id ? 12 : 30);   // ひらいて寄っているときは、何もない所を押して閉じたいことが多いので、許容を狭く
    if (near) return near;
    return ray.intersectObject(groundHit, false).length ? '' : null;
  }
  function nearest(x, y, tol) {
    let best = null, bd = tol;
    for (const id in rects) {
      if (id === 'plaza' || id === 'park' || id === A.id) continue;   // 広い面(広場・公園)と、ひらいている建物は、外れたときの候補にしない
      const [x0, y0, x1, y1] = rects[id], d = Math.hypot(Math.max(x0 - x, 0, x - x1), Math.max(y0 - y, 0, y - y1));
      if (d <= bd) { bd = d; best = id; }
    }
    return best;
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
    if (id && id !== A.id && !(A.id && pickStation(e))) { pressFx(id); o.onPress && o.onPress(id); }
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
  function pressFx(id) { liftId = id; lift.t = 0; lift.v = -1.35; flash = { id, t0: clock() }; hiAmt.v = 9; dirty = true; kick(); }
  function setHover(id) { hover = id; if (!A.id) { liftId = id; lift.t = id ? .07 : 0; } dirty = true; kick(); }

  /* ---- 誘い: ひとつの建物がふっと明るくなる ---- */
  function doInvite(id) { invite = { id, t0: clock() }; kick(); }

  /* ---- 見えないとき・裏のタブでは止める ---- */
  new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) kick(); }, { threshold: 0 }).observe(o.canvas);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  /* ---- 1こま ---- */
  const springs = [rot, camX, camY, camZ, elev, dim, lift, hiAmt, tod, inLight, dragOff, nearK, fly];
  /* 重さの計測: 動いている間のフレームの間隔(中央値)。42ms(24fps)を超えたら一段下げる。下げたらページに知らせる(次の訪問はその段から) */
  const ft = [];
  function measure(gap) {
    if (manual || tier === 'low' || frameN < 8 || gap > 400) return;
    ft.push(gap);
    if (ft.length < 36) return;
    const m = ft.sort((a, b) => a - b)[ft.length >> 1]; ft.length = 0;
    if (m > 42) setTier(tier === 'high' ? 'mid' : 'low');
  }
  function setTier(q) {
    tier = q;
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, DPR[q]));
    if (!SHADOW[q]) L.sun.castShadow = false;
    else if (L.sun.shadow.mapSize.x !== SHADOW[q]) { L.sun.shadow.mapSize.set(SHADOW[q], SHADOW[q]); if (L.sun.shadow.map) { L.sun.shadow.map.dispose(); L.sun.shadow.map = null; } }
    renderer.setSize(W, H, false); dirty = true; kick();
    o.onQuality && o.onQuality(q);
  }
  function kick() { if (manual) { dirty = true; return; } if (!running) { running = true; last = clock(); requestAnimationFrame(loop); } }
  function loop(now) { frame(now); }
  let ready = false;   // シェーダーの準備が済むまでは描かない(止めた画像が見えている)
  function frame(now, force) {
    if (!ready) { running = false; return; }
    const gap = now - last, dt = Math.min(.05, gap / 1000); last = now; frameN++;
    if (running && visible && !document.hidden) measure(gap);
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
      if (!s.closing && s.roofT0 >= 0) { const u = clamp01((now - s.roofT0) / 640); s.roof.set(u); if (u >= 1) s.roofT0 = -1; }   // 真上に持ち上がり、後ろへ抜ける
      else s.roof.step(dt);
      if (s.closing && !s.settled && s.roof.x < .02 && Math.abs(s.wall.x) < .05) { s.settled = true; if (!hover && !A.id) { liftId = s.id; lift.v = -.32; } }   // 屋根が降りたら、建物が小さく落ち着く
      if (s.kind === 'hinge' && !s.closing && s.wall.x > s.end) { s.wall.x = s.end; if (s.wall.v > 0) s.wall.v = -s.wall.v * .3; }
      if (s.closing && s.wall.x < 0) { s.wall.x = 0; s.wall.v = 0; }
    }
    if (Bk.id && Bk.closing && !Bk.wall.moving && !Bk.roof.moving) { const it = interiors[Bk.id]; if (it && Bk.id !== A.id && Bk.id !== 'park') it.group.visible = false; if (!A.id) { U.uFocus.value = -1; o.onClosed && o.onClosed(); } Bk = slot(); }
    // 選んだ建物の光(乗せた・誘い)
    let hiId = hover && !A.id ? hover : null, amt = hiId ? .1 : 0;
    if (flash) { const k = (now - flash.t0) / 380; if (k < 1) { hiId = flash.id; amt = .26 * (1 - k * k); } else flash = null; }
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
    if (tod.moving) { const g = applyTod(L, renderer, tod.x); for (const id in interiors) interiors[id] && interiors[id].setNight && interiors[id].setNight(g); o.onTod && o.onTod(tod.x); }   // ページの空も、同じ道筋(夕方を通る)・同じ速さで
    // 中の灯り
    if (A.id || Bk.id) {
      const id = A.id || Bk.id; if (id !== 'plaza') { const pl = placeOf(S, id), il = inLightOf(id); L.pIn.position.copy(il.p).applyAxisAngle(Y, pl.yaw).add(pl.p); L.pIn.distance = il.dist; inK = il.k; }
    }
    L.pIn.intensity = Math.max(0, inLight.x) * (1.4 + U.uNight.value * 2) * inK;
    L.pH.intensity = (L.pH.userData.base || 0) * ((A.id || Bk.id) === 'plaza' ? 1 : 1 - 1.4 * U.uDim.value);   // 建物をひらいている間は、広場の灯りを半分に(寄ったとき白く飛ばない)
    // 町の暮らし(止めているあいだに時刻を変えたときも、空・雲・もやの色だけは合わせる)
    if (paused && tod.moving) placeSky(S.dyn, t, U.uNight.value);
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
      const ex = id === 'plaza' ? null : S.B[id].ex, pl = placeOf(S, id), bd = boundsOf(id, ex);
      const m = new THREE.Matrix4().makeRotationY(rot.x).multiply(new THREE.Matrix4().compose(pl.p, new THREE.Quaternion().setFromAxisAngle(Y, pl.yaw), one));
      const tp = new THREE.Vector3(0, bd.top + (liftId === id ? lift.x : 0), 0).applyMatrix4(m).project(camera);
      const cp = new THREE.Vector3(0, bd.top * .45, 0).applyMatrix4(m).project(camera);
      const dr = id === 'plaza' ? [0, 0] : ex.door || [0, 0], fp = new THREE.Vector3(dr[0], 0, dr[1]).applyMatrix4(m).project(camera);
      let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const p of hitParts(id, ex).flat()) { const v = p.clone().applyMatrix4(m).project(camera), sx = (v.x + 1) / 2 * W, sy = (1 - v.y) / 2 * H; x0 = Math.min(x0, sx); x1 = Math.max(x1, sx); y0 = Math.min(y0, sy); y1 = Math.max(y1, sy); }
      rects[id] = [x0, y0, x1, y1];
      out.b[id] = { tag: [(tp.x + 1) / 2 * W, (1 - tp.y) / 2 * H], c: [(cp.x + 1) / 2 * W, (1 - cp.y) / 2 * H], foot: [(fp.x + 1) / 2 * W, (1 - fp.y) / 2 * H], r: rects[id] };
      const na = ex && nudgeAt(id, ex); if (na) { const v = new THREE.Vector3(...na); if (liftId === id) v.y += lift.x; v.applyMatrix4(m).project(camera); out.b[id].nudge = [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; }
    }
    if (A.id) out.st = stationsOnScreen();
    o.onLayout(out);
  }

  /* ---- 最初の1枚を描いてから、止めた画像と入れ替える ---- */
  resize();
  placePeople(S.dyn, 0, null); placeVehicles(S.dyn, 0, 0, null); placeSky(S.dyn, 0, U.uNight.value); placeSmall(S.dyn, 0, true);
  setCamera();
  // シェーダーの準備を、主スレッドを長く止めずに済ませる(KHR_parallel_shader_compile があれば並行に)。使えなければ、そのまま描く
  const tc = performance.now();
  const cmode = new URLSearchParams(location.search).get('compile');   // 計測の比べ: none(分けない)・split・async
  try {
    if (cmode === 'none') { /* 分けない(比べるため) */ }
    else if (cmode !== 'split' && renderer.compileAsync && (cmode === 'async' || renderer.extensions.has('KHR_parallel_shader_compile'))) await renderer.compileAsync(S.scene, camera);
    else { renderer.compile(S.scene, camera); await new Promise(r => requestAnimationFrame(() => r())); }   // 並行にできない端末: 準備と最初の描画を、別の手番に分ける
  } catch (e) { /* そのまま描く */ }
  const compileMs = Math.round(performance.now() - tc);
  ready = true;
  renderer.render(S.scene, camera); layout();
  const info = { calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures };
  kick();
  modP.then(() => {});
  return {
    open, close, setActive, stationHover, find, info, renderer,
    get findId() { return findSid; },
    hover(id) { setHover(id); },
    press(id) { pressFx(id); },
    invite: doInvite,
    setTod(m) { tod.t = m; kick(); },
    setPaused(p) { paused = p; kick(); },
    get openId() { return A.id; },
    stations() { const it = A.id && interiors[A.id]; return it ? it.stations.map(s => ({ id: s.id, label: s.label })) : []; },
    resize, kick,
    /* 手動の時計で ms だけ進めて、1枚描く(撮るとき) */
    advance(ms) { const n = Math.max(1, Math.round(ms / (1000 / 60))); for (let i = 0; i < n; i++) { vnow += ms / n; frame(vnow, i === n - 1); } },
    get manual() { return manual; },
    get tier() { return tier; },
    get compileMs() { return compileMs; },
    /* 撮る・確かめるため: 建物の中の点(その建物の座標)が、いま画面のどこにあるか */
    screenOf(id, l) { const pl = placeOf(S, id), v = new THREE.Vector3(...l).applyAxisAngle(Y, pl.yaw).add(pl.p).applyAxisAngle(Y, rot.x).project(camera), r = o.canvas.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * W, r.top + (1 - v.y) / 2 * H]; }
  };
}
