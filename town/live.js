/* ================================================================
   「ひらく町」磨き込み — 立体を動かす(ふれる → ひらく)と、止めた画像を撮る(capture)
   手触り(BRIEF 9.6・10.2): 線形の補間を使わない。カメラと回転は臨界減衰のばね。
   ・押した瞬間(100ms 以内): 建物が少し沈んで明るくなる(足もとの輪はページの側)
   ・寄る・戻る・渡る: 弧を描く(少し上がり、少し引いてから降りる)。行き先が遠いほど長く
   ・ひらく: 屋根が真上に持ち上がってから後ろへ抜け、前の壁が扉のように倒れて小さく弾む
   ・閉じる: 壁が戻り、屋根が降り、カメラが弧を描いて戻り、建物が小さく落ち着く
   ・品質の段: 高(画素比2・影2048)/中(画素比1.5・影1024)/低(画素比1・影なし)。重いときは一段下げる(目立たないよう、次に飛ぶときか、6 秒後に)
   v3: 広場は町を見渡す高さへ上がる(見晴らし)。戻ってきたときは、飛ばずにその建物・その道具の状態から始める(restore)。
       ひらいている間、指の横の速いはじきは前後の建物へ(回さない)。マウスの横ドラッグは、これまでどおり少し回して戻る
   ================================================================ */
import { THREE, makeScene, makeLights, applyTod, aimCamera, capFrame, makeRenderer, fit, ELEV, U, LAYOUT, IDS, CAP_W, CAP_H, placePeople, placeVehicles, placeSky, placeSmall, angDiff, plazaFrame, PALETTE } from './world.js';
import * as WORLD from './world.js';   // makeSceneAsync(段ごとに休みを入れて作る入口)があれば、それを使う
import { closePaths, walkLit } from './world.js';   // v7 閉じ: 灯る道
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
  // 展望台は、塔の中だけを照らす(最上階は中の形が自分の灯りを持つ。遠くまで届くと、夕方と夜に隣の病院の壁が明るく浮く)
  if (b.shape === 'tower') return { p: new THREE.Vector3(0, h * .42, 0), dist: 1.5, k: .3 };
  return { p: new THREE.Vector3(0, h * .62, (b.d || 1) * .08), dist: Math.max(2.2, Math.max(b.w, h) * 1.3), k: clamp((b.w * (b.h || .6)) / 9.3, .22, 1) };
}

/* 建物の島の上での置き方(島のグループの中の座標) */
function placeOf(S, id) {
  if (id === 'plaza') { const { cx, cz, y } = plazaFrame(); return { p: new THREE.Vector3(cx, y || 0, cz), yaw: deg(90 - 45), face: 45, y0: 0 }; }
  const b = S.B[id]; return { p: b.grp.position.clone(), yaw: b.grp.rotation.y, face: b.face, y0: b.ex.y0 };
}

/* ================================================================
   v6: 到着の画(ひらいた病院ぜんたい)。立体(live の K1)と止めた画像(capture の arrive=1)が同じ式を使う(札と画のずれを出さない)
   designer の目安(393×724 の帯が出ている状態): 各階 82〜86px、外形(塔屋の設備の上から正面の地面の線まで)375〜405px、外形の横は安全な範囲の中、
   正面の地面の線は帯が出ているときの高さ(hv)の 77%、上の2行の下端(sf.t)から塔屋の上まで 24px 以上。PC は外形の高さを hv の 62% にして安全な範囲の真ん中に
   ================================================================ */
const AY = new THREE.Vector3(0, 1, 0), AONE = new THREE.Vector3(1, 1, 1);
function arriveFrame(S, W, H, sf, small, hv, r1, el, F, cam) {
  const pl = placeOf(S, 'hospital'), bx = BOXES.hospital, ex = S.B.hospital.ex, fh = bx.h / (bx.floors || 3);
  const X0 = bx.w / 2 + E + WALL + .04, Z0 = bx.d / 2 + E + WALL + .03;
  const pts = rect3(-X0, -Z0, X0, Z0, -ex.y0, bx.h + .14);
  for (const x of [-1.55, .31]) for (const z of [-.93, .33]) pts.push(new THREE.Vector3(x, ex.top, z));   // 塔屋と設備の上(buildings.js の病院のセットバック)
  aimCamera(cam, new THREE.Vector3(), el);
  const m = new THREE.Matrix4().makeRotationY(r1).multiply(new THREE.Matrix4().compose(pl.p, new THREE.Quaternion().setFromAxisAngle(AY, pl.yaw), AONE)), inv = cam.matrixWorldInverse;
  let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
  for (const p of pts) { const v = p.clone().applyMatrix4(m).applyMatrix4(inv); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
  const g = new THREE.Vector3(0, -ex.y0, Z0).applyMatrix4(m).applyMatrix4(inv), vF = F.clone().applyAxisAngle(AY, r1).applyMatrix4(inv), sw = sf.r - sf.l;
  let ppu, sy;
  if (small) {
    ppu = Math.min(84 * hv / 724 / (fh * Math.cos(el)), sw / (x1 - x0));
    let gy = hv * .77;
    if (gy - (y1 - g.y) * ppu < sf.t + 24) gy = Math.min(sf.t + 24 + (y1 - g.y) * ppu, Math.max(gy, sf.b - 20));   // 背の低い画面: 塔屋が上の2行に近づきすぎるときは、まず地面の線を下の入口の上まで下げる
    if (gy - (y1 - g.y) * ppu < sf.t + 24) ppu = (gy - sf.t - 24) / (y1 - g.y);   // それでも近づきすぎるときは、小さく
    sy = gy - (vF.y - g.y) * ppu;
  } else {
    ppu = Math.min(.62 * hv / (y1 - y0), sw * .8 / (x1 - x0));
    sy = (sf.t + sf.b) / 2 + ((y0 + y1) / 2 - vF.y) * ppu;
  }
  return { r: r1, el, ppu, F, sx: (sf.l + sf.r) / 2 + (vF.x - (x0 + x1) / 2) * ppu, sy };
}
/* 外枠の太い切り口(案B の frameCut を移す): 左右の壁と屋根の板の前の切り口、地面の線を、階の床の切り口と同じ藍で太く(光に左右されない図面の線)。
   前の壁の厚みの中に置くので、壁があるうちは隠れる */
function makeFrameCut(anchor) {
  const b = BOXES.hospital, X = b.w / 2 + E, Z = b.d / 2 + E, h = b.h, out = X + WALL, sw = .115;
  const mat = new THREE.MeshBasicMaterial({ color: PALETTE.poche, toneMapped: false, transparent: true, opacity: 0 });   // 藍は描画コードの一か所(PALETTE)から
  const g = new THREE.Group(); g.visible = false;
  const add = (w, hh, d, x, y, z) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), mat); m.position.set(x, y, z); g.add(m); };
  const zc = Z + .074;
  add(sw + .035, h + .1, .006, -out - .035 + (sw + .035) / 2, (h + .1) / 2, zc);
  add(sw + .035, h + .1, .006, out + .035 - (sw + .035) / 2, (h + .1) / 2, zc);
  add(2 * out, .085, .006, 0, .012, zc);                                    // 地面の線(1階の床の切り口の下)
  add(2 * out + .1, .12, .004, 0, h + .044, (2 * (Z + WALL) + .1) / 2 + .002);   // 屋根の板の前の面
  anchor.add(g);
  return { g, mat };
}
/* 病院の正面の広場(正面から約2.7の奥行き。el 11° で立つ人の頭が 1階の床の線に掛かる範囲)。島の座標 → 病院の座標(rotation.y = yaw の逆) */
function frontZone(S) {
  const pl = placeOf(S, 'hospital'), b = BOXES.hospital, c = Math.cos(pl.yaw), sn = Math.sin(pl.yaw), px = pl.p.x, pz = pl.p.z, X1 = b.w / 2 + WALL + .35, Z0 = b.d / 2 + WALL - .1, Z1 = Z0 + 2.7;
  return (x, z) => { const dx = x - px, dz = z - pz, lx = dx * c - dz * sn, lz = dx * sn + dz * c; return lx > -X1 && lx < X1 && lz > Z0 && lz < Z1; };
}
/* 階の印(右の外枠の、各階の上の方。3F・2F・1F の順)と、正面の地面の線の真ん中(病院の座標) */
function markLocals(S) {
  const b = BOXES.hospital, ex = S.B.hospital.ex, fh = b.h / (b.floors || 3), out = b.w / 2 + E + WALL, z = b.d / 2 + E + .08;
  return { fl: [2, 1, 0].map(f => [out - .04, fh * f + fh * .84, z]), g: [0, -ex.y0, b.d / 2 + E + WALL] };
}
/* 道具の札の置き場(v6 見直し 第1回): その階の天井の前の切り口の線(両端を画面へ写す)の上で、横は物が画面に映る位置 sx。
   斜めの視点では奥の物ほど右へ寄るので、前の面の同じ x を写すと三角が物の左を指す。W・H は画面の大きさ(100 なら枠の %) */
function bandAt(group, fi, sx, cam, W, H) {
  const b = BOXES.hospital, fh = b.h / (b.floors || 3), y = fh * (fi + 1) - .035, z = b.d / 2 + WALL + .01;
  const a = group.localToWorld(new THREE.Vector3(-b.w / 2, y, z)).project(cam), c = group.localToWorld(new THREE.Vector3(b.w / 2, y, z)).project(cam);
  const ax = (a.x + 1) / 2 * W, ay = (1 - a.y) / 2 * H, cx = (c.x + 1) / 2 * W, cy = (1 - c.y) / 2 * H;
  return [sx, ay + (cy - ay) * (sx - ax) / (cx - ax)];
}
/* v6(見直し 第1回): 着いた病院を、一個の物として町から切り出す(world.js の HKAIR と FWIN が読む)。主棟と塔屋の箱、主棟の座標でのカメラの向きと画面の 8px(ch は画面の高さ CSS px)、
   夜の月の光(右手前の上から。nk = 夜の度合い × 寄った度合い)。立体の舞台と止めた画像(capture の arrive=1)が同じものを使う */
const MOON_L = new THREE.Vector3(.9, .25, .35).normalize(), MOON_I = .26, _md = new THREE.Vector3();   // 夜の右の側面(窓を除く)が L* 約50(案B と同じくらい。部屋より暗く)
const AIR_LIT = .6;   // 着いたとき、病院の前の広場を照らす灯り(入口・弧のそばの藍と砂)を弱める割合
function mainAir(S, cam, ch, nk) {
  const b = BOXES.hospital, B = S.B.hospital;
  B.anchor.updateWorldMatrix(true, false); U.uMainInv.value.copy(B.anchor.matrixWorld).invert();
  U.uMainB.value.set(b.w / 2 + E + WALL + .09, b.d / 2 + E + WALL + .12);   // 主棟(角の付け柱・水切り・屋根の縁まで)。右の翼と車寄せは外
  cam.updateMatrixWorld(); cam.getWorldDirection(_md).transformDirection(U.uMainInv.value);
  U.uMainD.value.set(_md.x, _md.y, _md.z, 8 * (cam.top - cam.bottom) / ch);
  U.uMainY.value.set(-B.ex.y0 - .01, b.h + .4, b.h, B.ex.top);
  U.uMainP.value.set(-1.63, .39, -1.01, .41);   // 塔屋(buildings.js のセットバックした最上階と設備)
  _md.copy(MOON_L).transformDirection(B.anchor.matrixWorld).transformDirection(cam.matrixWorldInverse);
  U.uMoon.value.set(_md.x, _md.y, _md.z, MOON_I * nk);
}

/* ================================================================
   止めた画像を撮る(?capture=poster&tod=day|dusk|night / portrait&id= / cutaway&id=)
   ================================================================ */
export async function capture(Q) {
  const tq = Q.get('tod') || 'day';   // 時刻は名前(day・dusk・night)か、その間の数(0 = 昼、1 = 夕、2 = 夜)
  const mode = Q.get('capture'), tod = isFinite(+tq) ? +tq : ({ day: 0, dusk: 1, night: 2 }[tq] ?? 0), W = +(Q.get('w') || CAP_W), H = +(Q.get('h') || CAP_H);
  document.documentElement.classList.add('capture');
  let canvas = document.getElementById('cap'); if (!canvas) { canvas = document.createElement('canvas'); canvas.id = 'cap'; document.body.appendChild(canvas); }
  canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
  const renderer = makeRenderer(canvas, +(Q.get('dpr') || 1), W, H, true);
  // section: 一棟だけを、正面のほぼ水平から(建築の立面・断面図の見え方)。前の壁を外し、屋根は残す。地と空は描かない(ページの紙の上に置く)
  const sect = mode === 'section' ? (Q.get('id') || 'hospital') : null;
  const only = mode === 'portrait' ? Q.get('id') : sect, qt = Q.get('q') === 'mid' ? 'mid' : 'high';   // 品質の段(最初の画像は、スマホが描く中の段でも撮る)
  const S = makeScene({ only, quality: qt }), L = makeLights(S.scene, qt === 'mid' ? 1024 : (+(Q.get('shadow')) || 2048));
  applyTod(L, renderer, tod);
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 300);
  const t = +(Q.get('t') || 0);
  placePeople(S.dyn, t, null); placeVehicles(S.dyn, t, 0, null); placeSky(S.dyn, t, tod > 1.5 ? 1 : 0); placeSmall(S.dyn, t, true);
  if (S.dyn.clouds && Q.get('clouds') === '0') S.dyn.clouds.mesh.visible = false;
  if (S.dyn.haze && Q.get('haze') === '0') for (const m of S.dyn.haze.meshes) m.visible = false;   // 島の下のもや(終幕の遠景では、絵の四角で切れないように外す)
  setStatic(S);
  // 中の形: 公園はいつも(町の景色の一部)。断面(cutaway)のときは、その建物をひらいた姿にする
  const MOD = await import('./interiors.js').catch(() => null);
  const loader = new THREE.TextureLoader();
  const cctx = { palette: PALETTE, quality: 'high', loadTexture: url => loader.loadAsync(url).then(tx => { tx.colorSpace = THREE.SRGBColorSpace; return tx; }) };
  const mstr = tod < .5 ? 'day' : tod < 1.5 ? 'dusk' : 'night', glow = U.uNight.value;
  const built = [];
  if (MOD && S.B.park) { const it = MOD.buildInterior('park', BOXES.park, cctx); it.group.position.y = .05; S.B.park.anchor.add(it.group); built.push(it); }
  const cut = mode === 'cutaway' ? Q.get('id') : sect, closed = Q.get('closed') === '1';   // closed: 同じ構図で、閉じたまま(下の節の帯で、ひらく前の絵)
  if (MOD && cut && !closed && cut !== 'park' && cut !== 'plaza') { const it = MOD.buildInterior(cut, BOXES[cut], cctx); S.B[cut].anchor.add(it.group); built.push(it); }
  for (const it of built) { await it.ready; it.setNight(glow); if (it.reveal) it.reveal(); }
  if (built.length) await new Promise(r => setTimeout(r, 1400));
  for (const it of built) it.update(.016, t, mstr);
  if (cut) {
    const b = S.B[cut], bx = BOXES[cut], pl = placeOf(S, cut), tb = new THREE.Matrix4().compose(pl.p, new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), pl.yaw), new THREE.Vector3(1, 1, 1)), tbi = tb.clone().invert();
    const open5 = Q.get('open5') === '1';   // 案A(v5 第2回): ひらいた病院ぜんたいの止めた画像。屋根は残し、前の壁は外し(倒れて広場の下へ沈んだ後)、広場の弧は消す
    if (!closed) U.uOpenA.value = LAYOUT[cut].bid, U.uRoofA.value = 0;
    if (open5) { U.uRoofA.value = 1; U.uArcFade.value = 1; }
    if (sect || open5) { U.uPM.value[1].copy(tb).multiply(new THREE.Matrix4().makeTranslation(0, -200, 0)).multiply(tbi); U.uRoofA.value = 1; }   // 断面: 前の壁は外し(倒さない)、屋根は残す
    else if (closed) { /* 壁も屋根もそのまま */ } else if (bx.shape === 'tower') U.uPM.value[1].copy(tb).multiply(new THREE.Matrix4().makeRotationY(Math.PI)).multiply(tbi);
    else if (bx.shape !== 'open') { const z = bx.d / 2 + E + WALL, end = Math.PI / 2 + Math.asin(clamp((b.ex.y0 + .01) / bx.h, 0, .4)); U.uPM.value[1].copy(tb).multiply(new THREE.Matrix4().makeTranslation(0, 0, z)).multiply(new THREE.Matrix4().makeRotationX(end)).multiply(new THREE.Matrix4().makeTranslation(0, 0, -z)).multiply(tbi); }
    if (!closed && !sect && !open5) U.uPM.value[2].copy(tb).multiply(new THREE.Matrix4().makeTranslation(0, 40, 0)).multiply(tbi);
    const arrive = Q.get('arrive') === '1' && cut === 'hospital';   // v6: 立体の到着の画(live の K1)とまったく同じ視点・枠で撮る(動きを減らす設定・WebGL なし・低性能の端末の「完成された断面画像」)
    if (arrive) {
      const cw = +(Q.get('cw') || 393), ch = +(Q.get('ch') || 724), sm = cw < 921, sf = sm ? { l: 16, t: 134, r: cw - 16, b: ch - 86 } : { l: 40, t: 150, r: cw - 40, b: ch - 92 };   // 上は 393×724 の「病院の中」と一文の下端(hiraku.js の scrubSafe)
      U.uRoofA.value = 1; U.uArcFade.value = 1; U.uPM.value[2].identity(); U.uPM.value[1].copy(tb).multiply(new THREE.Matrix4().makeTranslation(0, -200, 0)).multiply(tbi);   // 屋根は残し、前の壁は外す(沈んだ後)、広場の弧は消す
      U.uFocus.value = LAYOUT.hospital.bid; U.uDim.value = .2; U.uAir.value = 1;
      const F = pl.p.clone().add(new THREE.Vector3(0, (bx.h - b.ex.y0) / 2, 0)), r1 = deg(pl.face - 45) + deg(+(Q.get('turn') ?? -16)), el1 = deg(+(Q.get('el') ?? 11));
      const K = arriveFrame(S, cw, ch, sf, sm, ch, r1, el1, F, camera);
      S.world.rotation.y = r1; S.world.updateMatrixWorld(true);
      aimCamera(camera, new THREE.Vector3(), el1);
      const v = F.clone().applyAxisAngle(AY, r1).applyMatrix4(camera.matrixWorldInverse), cx = v.x - (K.sx - cw / 2) / K.ppu, cy0 = v.y + (K.sy - ch / 2) / K.ppu;
      camera.left = cx - cw / 2 / K.ppu; camera.right = cx + cw / 2 / K.ppu; camera.top = cy0 + ch / 2 / K.ppu; camera.bottom = cy0 - ch / 2 / K.ppu; camera.updateProjectionMatrix();
      mainAir(S, camera, ch, clamp01((tod - 1.2) / .8));   // 一個の物として切り出す・夜の月の光(立体の舞台と同じ)
      L.pH.intensity *= (1 - 1.4 * U.uDim.value) * (1 - AIR_LIT); L.pI.intensity *= 1 - AIR_LIT; L.pS.intensity *= 1 - AIR_LIT;   // 広場を照らす灯りも、立体の舞台と同じだけ弱める
      const fc = makeFrameCut(b.anchor); fc.g.visible = true; fc.mat.opacity = 1;   // 外枠の太い切り口
      placePeople(S.dyn, t, null, frontZone(S));   // 正面の広場に人を立たせない(立体の舞台と同じ)
    } else {
      // その建物を正面に向けて(島を回す)、少し低い角度から寄る。断面は、ほぼ水平(el の度)から
      const spin = sect ? deg(45) - pl.yaw : deg(pl.face - 45) + deg(+(Q.get('turn') || 0)), el = sect ? deg(+(Q.get('el') ?? 8)) : Q.get('el') ? deg(+Q.get('el')) : cut === 'park' ? deg(17) : deg(26);
      if (Q.get('dim')) { U.uFocus.value = LAYOUT[cut].bid; U.uDim.value = +Q.get('dim'); }   // 案A: まわりの建物を、ひらいたときと同じだけ暗く
      S.world.rotation.y = spin; S.world.updateMatrixWorld(true);
      if (sect) {   // 断面は主棟だけ: 横の壁の外側で切る(右の別棟と、左の車寄せを外す)。島のグループの回転だけを掛けた、世界の座標の面
        const X1 = bx.w / 2 + E + WALL - .002, ax = new THREE.Vector3(1, 0, 0).applyAxisAngle(new THREE.Vector3(0, 1, 0), spin + pl.yaw);
        renderer.clippingPlanes = [new THREE.Plane(ax.clone().negate(), X1), new THREE.Plane(ax.clone(), X1)];
      }
      aimCamera(camera, new THREE.Vector3(), el);
      const bd = boundsOf(cut, b && b.ex), m = new THREE.Matrix4().makeRotationY(spin).multiply(tb), pts = (sect ? bd.pts.filter(p => p.z <= bx.d / 2 + E + WALL + 1e-3) : Q.get('box') === '1' ? rect3(-(bx.w / 2 + E + WALL), -(bx.d / 2 + E + WALL), bx.w / 2 + E + WALL, bx.d / 2 + E + WALL, -b.ex.y0, bx.h) : bd.pts).map(p => p.clone().applyMatrix4(m));   // box=1: 建物の箱だけ(倒れた壁を含めない。案A の立体の「ひらいた病院ぜんたい」と同じ収め方)
      const mg = +(Q.get('m') ?? .06), fr = k => +(Q.get(k) ?? NaN);   // 案A: 収める範囲を、ページの安全な範囲(上の見出し・下の入口を避ける)に合わせる(fx0・fx1・fy0・fy1)
      fit(camera, pts, W, H, { x0: W * (isNaN(fr('fx0')) ? mg : fr('fx0')), x1: W * (isNaN(fr('fx1')) ? 1 - mg : fr('fx1')), y0: H * (isNaN(fr('fy0')) ? mg : fr('fy0')), y1: H * (isNaN(fr('fy1')) ? 1 - mg : fr('fy1')) });
    }
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
  // 道具の画面の位置(枠の %。左上 x0,y0 と右下 x1,y1): 断面の絵の札と引き出し線は、この値で置く(手で合わせない)
  const st = {}, band = {}, bx = cut ? BOXES[cut] : null;
  if (cut && built.length) {
    const it = built[built.length - 1], pc = (vx, vy) => [+((vx + 1) / 2 * 100).toFixed(2), +((1 - vy) / 2 * 100).toFixed(2)];
    it.group.updateWorldMatrix(true, true);
    for (const s of it.stations || []) {
      let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const q of s.quad || []) { const v = new THREE.Vector3(...q).applyMatrix4(it.group.matrixWorld).project(camera); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
      if (x0 <= x1) st[s.id] = [...pc(x0, y1), ...pc(x1, y0)];
      const FIX = { yawagaeshi: 2, nidodema: 1, keiji: 0 };   // 札の置き場(その階の天井の切り口。物の真上)。枠の %。階と道具の対応は BRIEF 14.2
      if (cut === 'hospital' && FIX[s.id] !== undefined) { const v = s.anchor.clone().applyMatrix4(it.group.matrixWorld).project(camera); band[s.id] = bandAt(it.group, FIX[s.id], (v.x + 1) / 2 * 100, camera, 100, 100).map(q => +q.toFixed(2)); }
    }
  }
  let marks = null;   // v6: 階の印(3F・2F・1F)と正面の地面の線(枠の %)。ページが止めた画像の上に置く
  if (cut === 'hospital' && Q.get('arrive') === '1') {
    const L2 = markLocals(S), b2 = S.B.hospital, pc2 = l => { const v = new THREE.Vector3(...l); b2.anchor.localToWorld(v); v.project(camera); return [+((v.x + 1) / 2 * 100).toFixed(2), +((1 - v.y) / 2 * 100).toFixed(2)]; };
    marks = { fl: L2.fl.map(pc2), gy: pc2(L2.g)[1] };
  }
  window.__done = { pins, st, band, marks, calls: renderer.info.render.calls, tris: renderer.info.render.triangles };
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
  const small = Math.min(innerWidth, innerHeight) < 700 || innerWidth < 921;
  let W = o.canvas.clientWidth, H = o.canvas.clientHeight;
  /* 品質の段(高・中・低)。最初はページが端末の手がかりで選ぶ。動かしてみて重ければ、ここで一段ずつ下げる */
  const DPR = { high: 2, mid: 1.5, low: 1 }, SHADOW = { high: 2048, mid: 1024, low: 512 };   // 低の段も影は切らずに細かさだけ下げる(影を切ると、町と病院の中の描き方をすべて作り直すので、その1こまで長く止まる。v6)
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
  let arriveId = null;   // ひらいた建物に、カメラが着くのを待っている
  let hover = null, liftId = null, invite = null, preRot = 0, dragOff = new Spring(0, 9, 1), openCam = null, curStation = null, findSid = null, findC = null, turnTok = 0;
  /* 案A: スクロールの進み(ページが渡す p。0 = 最初の町、1 = 1階の受付)。ばね sp でなめらかに追い、カメラと病院のひらき方は sp.x だけで決める(戻すと逆に再生) */
  const SCRUB_ID = 'hospital', sp = new Spring(0, 8.5, 1), gate = new Spring(0, 5, 1);   // gate: 中の形が届くまで壁を閉じておく(届いたら、いまの進みまでなめらかに)
  let scrub = null;
  /* 後で一度だけ動かす段取り(時計の時刻で) */
  const later = [];
  function after(ms, f) { later.push({ at: clock() + ms, f }); later.sort((a, b) => a.at - b.at); }
  /* 行き先までの遠さ(回す角度・拡大の比・画面の上の移動)から、飛ぶ長さを決める。ばねの速さをそろえ、着いたら元に戻す */
  function farness() {
    const z0 = Math.exp(camZ.x), dz = Math.abs(camZ.t - camZ.x), dxy = Math.hypot(camX.t - camX.x, camY.t - camY.x) * z0 / Math.max(1, Math.min(W, H));
    return Math.abs(rot.t - rot.x) + dz * .5 + dxy * .6 + Math.abs(elev.t - elev.x) * .5;
  }
  function flight(arc = 1, zoomArc = 1) {
    if (pendTier) applyTier();   // 品質の段を下げるのは、動きの切り替わりに合わせて(止まっている絵が急に粗くならないように)
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
    if (findC && nearK.x > .001) { const fd = -nv.copy(findC).applyAxisAngle(Y, rot.x).applyMatrix4(camera.matrixWorldInverse).z; camera.near = .1 + Math.max(0, fd - (scrub ? .45 : .3)) * clamp01(nearK.x); }
    camera.updateProjectionMatrix();
  }
  function resize() {
    const w = o.canvas.clientWidth, h = o.canvas.clientHeight, nb = baseFrame();
    // iOS はブラウザの帯の出入りでも resize を出す。絵の大きさと最初の画面の枠が同じなら、何も作り直さない(着いた病院が跳ばないように)
    if (base && w === W && h === H && Math.abs(nb.x - base.x) < 1e-6 && Math.abs(nb.y - base.y) < 1e-6 && Math.abs(nb.ppu - base.ppu) < 1e-6) return;
    if (w !== W || h !== H) { W = w; H = h; renderer.setSize(W, H, false); }
    base = nb;
    if (scrub) scrub.kf = null;   // 案A: 寄る道筋を、新しい大きさで作り直す(次のこまで)
    else if (!A.id) { camX.set(base.x); camY.set(base.y); camZ.set(Math.log(base.ppu)); }
    else retarget();
    dirty = true; kick();
  }
  new ResizeObserver(resize).observe(o.canvas);

  /* ---- 寄る先(建物を正面に向け、安全な範囲 = パネルやシートを避けた所に収める) ---- */
  const tmpCam = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 300);
  /* ひらいたときの寄る先(建物を正面に向け、安全な範囲 = パネルやシートを避けた所に収める) */
  function frameFor(id) {
    if (id === 'plaza') return overlook();
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
  /* 広場の見晴らし: 広場の上へ上がり、2本の弧を手前(画面の下の真ん中)に、町の建物すべてを安全な範囲に収める。上には名前の札の余白。
     角度・収める点・札の位置は町の側(world.js の plazaOverlook(S): rot・elev は度、pts・tags は島の座標)。なければ、建物の枠から */
  let ovData;
  function ovInfo() { if (ovData === undefined) { try { ovData = WORLD.plazaOverlook ? WORLD.plazaOverlook(S) : null; } catch (e) { ovData = null; } } return ovData; }
  function overlook() {
    const OV = ovInfo() || WORLD.OVERLOOK || {}, r = nearestRot(rot.x, deg(OV.rot || 0)), el = deg(OV.elev || 40);
    const sf = o.safe(), top = 46, sw = sf.r - sf.l - 12, shh = sf.b - sf.t - top - 6;
    aimCamera(tmpCam, origin, el);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    const grow = v => { v.applyMatrix4(tmpCam.matrixWorldInverse); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }, mr = new THREE.Matrix4().makeRotationY(r);
    if (OV.pts && OV.pts.length) for (const p of OV.pts) grow(p.clone().applyMatrix4(mr));
    else for (const id of IDS) {
      const pl = placeOf(S, id), m = mr.clone().multiply(new THREE.Matrix4().compose(pl.p, new THREE.Quaternion().setFromAxisAngle(Y, pl.yaw), one));
      for (const p of boundsOf(id, id === 'plaza' ? null : S.B[id].ex).pts) grow(p.clone().applyMatrix4(m));
    }
    const ppu = Math.min(sw * .92 / (x1 - x0), shh * .94 / (y1 - y0), base.ppu * 3);   // 少し余白を残す(島の縁が見えて、見晴らしらしく)
    const scx = (sf.l + sf.r) / 2, scy = sf.t + top + shh / 2;
    return { rot: r, elev: el, x: (x0 + x1) / 2 - (scx - W / 2) / ppu, y: (y0 + y1) / 2 + (scy - H / 2) / ppu, ppu };
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
    // 画面が、見える範囲の 3〜4 割を占めるまで(スマホ 390 でシートの上 390×464 に対し、横長で約 35%・縦長で約 30%)。縦長は高さで、横長は幅で頭打ち。
    // PC は画面が大きいので 22〜25%(まわりの机と人が見えて、部屋のままに)
    const ppu = Math.min(Math.sqrt((small ? .45 : .3) * sw * shh / (w * h)), sw * .88 / w, shh * .86 / h, base.ppu * 110);
    lastFind = { sid, w: w * ppu, h: h * ppu };
    const bx = (x0 + x1) / 2, by = (y0 + y1) / 2, scx = (sf.l + sf.r) / 2, scy = (sf.t + sf.b) / 2;
    return { rot: r, elev: el, x: bx - (scx - W / 2) / ppu, y: by + (scy - H / 2) / ppu, ppu };
  }
  let lastFind = null;   // 確かめるため: 最後に寄った画面の、画面の上の大きさ(px)
  function retarget() {
    if (!A.id) { rot.t = preRot; camX.t = base.x; camY.t = base.y; camZ.t = Math.log(base.ppu); elev.t = ELEV; return; }
    openCam = (findSid && findFrame(findSid)) || frameFor(A.id);
    rot.t = openCam.rot + dragOff.x; elev.t = openCam.elev; camX.t = openCam.x; camY.t = openCam.y; camZ.t = Math.log(openCam.ppu);
  }

  /* ================= 案A: 町から病院の中へ(スクロールで寄る) =================
     キーの姿 K: 島の回転 r・見下ろす角 el・拡大 ppu・見つめる点 F(島の座標)と、F を置く画面の位置 sx, sy。
     キーの間は r・el・log(ppu)・F・画面の位置を補間し、F がその位置に来るようにカメラの中心を決める(病院が画面の上をまっすぐ動き、振れない)。
     K0 = 最初の町(いまの姿)、K1 = ひらいた病院ぜんたい。カメラは K1 で止まり、そのあとは階ごとに札と灯りだけが 3階 → 2階 → 1階 と降りる。
     ひらき方: 屋根は残す(ヘリポートで病院と分かり、3階だけ背が高く見えない)。前の壁は町と同じ手つきで倒れ、倒れきったら広場の面の下へ沈む(uGroundCut)。広場の弧は寄るにつれて点描で消す(1階に掛けない) */
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const ease = t => (t = clamp01(t)) < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;   // 出だしと着きがやわらかい(臨界減衰のばね sp を、さらに通す)
  // 進み p の区切り(調整はここだけ。舞台は 1.5 画面ぶん: 寄る・ひらく 約0.65 + ぜんたいと階 約0.85)。floors: 階ごとに [その階の札と灯りになる p, 次の階へ]
  // v6(designer の配分。見直し 第1回で 1.8 → 1.5 画面に): 寄る .036–.43(約0.65画面。長さは前のまま)・町を空気へ溶かす .072–.41・弧を消す .06–.24・前の壁が倒れる .25–.37・中の灯り .27–.42・
  //   壁が沈む .36–.42・外枠と階の印 .38–.43(カメラが止まるこまでに、沈みきって出きる)・上の一文 .45–.49(hiraku.js)・3F .565 / 2F .7 / 1F .835–1(着いてから 3F まで・階の間は 0.2画面、1F から終わりまで 0.25画面)
  const SQ = { move: [.036, .43], dim: [.072, .41], air: [.072, .41], arcs: [.06, .24], wall: [.25, .37], sink: [.36, .42], light: [.27, .42], frame: [.38, .43], floors: [[.565, .7], [.7, .835], [.835, 9]] };
  /* v7 閉じ(designer の設計。1F に着いた所 .835 から s 画面。1 画面 = 進み 1/1.5): 1F のまま(+0〜.15)→ 引いて上がる(+.15〜.55。引くのが先 .15〜.50、上がるのは .22〜.55。turn −16°→0°・el 11°→42° の見晴らし)。
     町を空気へ溶かす式・色を抜く式・消した街灯と右の翼は逆に戻す(+.15〜.38。外枠の切り口は .15〜.30 で消す)・広場の弧が戻る(+.30〜.45)・正面の広場の人が戻る(+.30)。病院はひらいたまま・中の灯りもそのまま。
     道が灯る(+.83〜.86)。言葉と出口・島の下のもやは hiraku.js。舞台の終わりは +.97(QMAX) */
  const CQ = s => .835 + s / 1.5, QMAX = CQ(.97);
  const CL = { zoom: [CQ(.15), CQ(.50)], rise: [CQ(.22), CQ(.55)], air: [CQ(.15), CQ(.38)], frame: [CQ(.15), CQ(.30)], arcs: [CQ(.30), CQ(.45)], people: CQ(.30), lit: [CQ(.83), CQ(.86)] };
  const FLOOR_OF = [['yawagaeshi', 2], ['nidodema', 1], ['keiji', 0]];   // 降りる順: 3階 休憩室(やわ返)→ 2階 ナースステーション(二度手間さがし)→ 1階 受付と待合(掲示じたく)。BRIEF 14.2
  const FI = { yawagaeshi: 2, nidodema: 1, keiji: 0 };
  // 中の灯りの高さ(階の数。0 = 1階)。着いた直後は建物の中ほど、そこから p に合わせて 3F → 2F → 1F へ続けて降り、各階の真ん中で少し留まる(段にしない)
  const LF = [[.47, 1.24], [.585, 2], [.65, 2], [.72, 1], [.78, 1], [.855, 0]];
  const lightF = x => { if (x <= LF[0][0]) return LF[0][1]; for (let i = 1; i < LF.length; i++) if (x <= LF[i][0]) return LF[i - 1][1] + (LF[i][1] - LF[i - 1][1]) * smooth(LF[i - 1][0], LF[i][0], x); return LF[LF.length - 1][1]; };
  const QS = new URLSearchParams(location.search), EL1 = deg(+(QS.get('el1') ?? 11)), TURN1 = deg(+(QS.get('turn') ?? -16)), KEEP_WALL = QS.get('wall') === 'keep';   // ぜんたいを見る角度は 14°(屋根を残したまま、3階の奥のソファの人と道具が天井の板に隠れない角度。20°では隠れる)。el1・turn(横の面を見せる回し。既定 0): 見比べるため / wall=keep: 倒れた壁を沈めない(前の版の見え方と比べるため)
  function scrubKeys() {
    const sf = o.scrubSafe ? o.scrubSafe() : { l: 16, t: 110, r: W - 16, b: H - 86 };
    const pl = placeOf(S, SCRUB_ID), bx = BOXES[SCRUB_ID], ex = S.B[SCRUB_ID].ex;
    const F = pl.p.clone().add(new THREE.Vector3(0, (bx.h - ex.y0) / 2, 0));   // 建物の箱の真ん中(島の座標)
    // K0: いまの町。F が画面のどこにあるか
    const r0 = scrub.r0; aimCamera(tmpCam, origin, ELEV);
    const v0 = F.clone().applyAxisAngle(Y, r0).applyMatrix4(tmpCam.matrixWorldInverse);
    const K0 = { r: r0, el: ELEV, ppu: base.ppu, F, sx: W / 2 + (v0.x - base.x) * base.ppu, sy: H / 2 - (v0.y - base.y) * base.ppu };
    // K1: ひらいた病院ぜんたい(案B と同じ視点 turn −16°・el 11°。arriveKey)
    const r1 = nearestRot(r0, deg(pl.face - 45)) + TURN1;
    return [K0, arriveKey(r1, EL1, sf, F), closeKey(r1)];
  }
  /* v7 閉じ: 交差の広場の見晴らし(広場をひらいたときと同じ角度 el 42°・正面 rot 0)。町の建物と広場を、上の言葉と下の出口の間(closeSafe)に収める。
     上には3つの札の余白。見つめる点 F は見晴らしの点の真ん中(島の座標) */
  function closeKey(r1) {
    const OV = ovInfo() || WORLD.OVERLOOK || {}, r = nearestRot(r1, deg(OV.rot || 0)), el = deg(OV.elev || 42);
    const sf = o.closeSafe ? o.closeSafe() : { l: 8, t: 140, r: W - 8, b: H - 220 }, top = small ? 30 : 40;
    aimCamera(tmpCam, origin, el);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    let pts = OV.pts && OV.pts.length ? OV.pts : [new THREE.Vector3()];
    if (!small && WORLD.samplePoints) pts = pts.concat(WORLD.samplePoints().slice(0, 96));   // PC: 最初の画面と同じく、島の縁まで右の範囲に収める(スマホは建物と広場だけ。島の左右の縁は画面の外へ)
    for (const p of pts) { const v = p.clone().applyAxisAngle(Y, r).applyMatrix4(tmpCam.matrixWorldInverse); x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y); }
    const F = OV.target ? OV.target.clone() : new THREE.Vector3(), vF = F.clone().applyAxisAngle(Y, r).applyMatrix4(tmpCam.matrixWorldInverse);
    const sw = sf.r - sf.l, shh = Math.max(40, sf.b - sf.t - top), ppu = Math.min(sw * .96 / (x1 - x0), shh / (y1 - y0));
    return { r, el, ppu, F, sx: (sf.l + sf.r) / 2 + (vF.x - (x0 + x1) / 2) * ppu, sy: sf.t + top + shh / 2 + ((y0 + y1) / 2 - vF.y) * ppu };
  }
  /* 到着の画(v6・designer の目安。393×724 の帯が出ている状態で): 各階 82〜86px、外形(塔屋の設備の上から正面の地面の線まで)375〜405px、
     外形の横は安全な範囲の中、正面の地面の線は帯が出ているときの高さの 77%(724 で y 557)、上の2行の下端(安全な範囲の上)から塔屋の上まで 24px 以上。
     PC は外形の高さを画面の 62% にして、安全な範囲の真ん中に。大きさ・位置は、帯が出ているときの高さ(svh)で決める(帯が畳まれても動かない) */
  function arriveKey(r1, el, sf, F) { return arriveFrame(S, W, H, sf, small, o.svh ? Math.min(H, o.svh()) : H, r1, el, F, tmpCam); }
  function scrubCam(x) {
    const K = scrub.kf, cl = x > CL.zoom[0], a = K[cl ? 1 : 0], b = K[cl ? 2 : 1];
    // v6 の寄る道筋は1つの進み t。v7 の閉じは、引く(拡大・見つめる点・画面の位置 t)が先、上がる(角度・回し te)が少し遅れて(引いてから上がる)
    const t = cl ? ease((x - CL.zoom[0]) / (CL.zoom[1] - CL.zoom[0])) : x >= SQ.move[1] ? 1 : x > SQ.move[0] ? ease((x - SQ.move[0]) / (SQ.move[1] - SQ.move[0])) : 0;
    const te = cl ? ease((x - CL.rise[0]) / (CL.rise[1] - CL.rise[0])) : t;
    const ppu = Math.exp(Math.log(a.ppu) + (Math.log(b.ppu) - Math.log(a.ppu)) * t), r = a.r + (b.r - a.r) * te, el = a.el + (b.el - a.el) * te;
    const F = a.F.clone().lerp(b.F, t), sx = a.sx + (b.sx - a.sx) * t, sy = a.sy + (b.sy - a.sy) * t;
    aimCamera(tmpCam, origin, el);
    const v = F.applyAxisAngle(Y, r).applyMatrix4(tmpCam.matrixWorldInverse);
    return { r, el, lz: Math.log(ppu), x: v.x - (sx - W / 2) / ppu, y: v.y + (sy - H / 2) / ppu };
  }
  const occDir = new THREE.Vector3(), occInv = new THREE.Matrix4(), occD = new THREE.Vector3(), occP = new THREE.Vector3();
  function hiddenInside(wp) {   // 確かめるため: 世界の点 wp が、建物の階の天井・床(上の階との間の板)と横の壁に隠れるか(カメラへ向かう線が、その階の前の面を天井より下で抜けるか)
    const bx = BOXES[SCRUB_ID], anc = S.B[SCRUB_ID].anchor, fh = bx.h / (bx.floors || 3); anc.updateWorldMatrix(true, false); occInv.copy(anc.matrixWorld).invert();
    camera.getWorldDirection(occDir); occD.copy(occDir).negate().transformDirection(occInv);   // 建物の座標の、カメラへ向かう向き
    occP.copy(wp).applyMatrix4(occInv);
    const fi = Math.max(0, Math.min((bx.floors || 3) - 1, Math.floor((occP.y + .02) / fh))), zf = bx.d / 2 + WALL;
    if (occD.z <= 1e-4) return true;
    const t = (zf - occP.z) / occD.z, ye = occP.y + t * occD.y, xe = occP.x + t * occD.x;
    const nf = bx.floors || 3, ceil = fi === nf - 1 ? bx.h + .06 : fh * (fi + 1);   // 上の階の床の板の下の面 / いちばん上は屋根の板の下の面
    return ye > ceil || Math.abs(xe) > bx.w / 2 + WALL;
  }
  function groundY() {   // 病院の正面の広場の面の高さ(世界の y)。倒れた壁は、これより下を描かない
    const bx = BOXES[SCRUB_ID], ex = S.B[SCRUB_ID].ex; S.world.updateMatrixWorld(true);
    return S.B[SCRUB_ID].anchor.localToWorld(new THREE.Vector3(0, -ex.y0 + .006, bx.d / 2 + .6)).y;
  }
  /* 外枠の太い切り口と、正面の広場に人を立たせない範囲(どちらも capture と同じ作り) */
  let frameG = null, frameMat = null, hideF = null, pathM = null, pathMat = null;
  const PATH_A = .78;   // v7 閉じ: 灯る道の濃さ(夕・夜。昼は 1 = 明るい地面の上でも道の線として読めるように)
  function frameCut() {
    if (!frameG) { const f = makeFrameCut(S.B[SCRUB_ID].anchor); frameG = f.g; frameMat = f.mat; }
    if (!pathM) {   // v7: 灯る道(外枠の切り口と同じ描き方。描き方を増やさない。用意も外枠と一緒に)
      pathMat = new THREE.MeshBasicMaterial({ color: PALETTE.poche, toneMapped: false, transparent: true, opacity: 0 });   // 色は時刻で walkLit が決める(はじめの色は PALETTE から)
      try { pathM = closePaths(pathMat); pathM.visible = false; S.world.add(pathM); } catch (e) { pathM = null; }
    }
  }
  function beginScrub() {
    const wasOpen = !!A.id;
    for (const s of [A, Bk]) if (s.id && s.id !== 'park') { const it = interiors[s.id]; if (it) { for (const st of it.stations) { st.setActive(false); st.setHover(false); } it.group.visible = false; } }
    const r0 = wasOpen ? preRot : rot.x;
    A = slot(); Bk = slot();
    A.id = SCRUB_ID; A.kind = 'hinge'; A.t0 = clock(); A.roofT0 = -1; A.sink = 0;
    A.end = Math.PI / 2 + Math.asin(clamp((S.B[SCRUB_ID].ex.y0 + .01) / BOXES[SCRUB_ID].h, 0, .4));
    U.uOpenA.value = LAYOUT[SCRUB_ID].bid; U.uFocus.value = LAYOUT[SCRUB_ID].bid;
    findSid = null; findC = null; nearK.set(0); openCam = null; arriveId = null; hover = null; liftId = null; invite = null; flash = null; inertia = 0;
    dragOff.set(0); fly.set(1); lift.set(0); hiAmt.set(0); curStation = null;
    for (const s of [rot, camX, camY, camZ, elev]) s.w = 7.5;
    elev.w = 7;
    const it = interiorOf(SCRUB_ID);
    if (it) it.group.visible = true; else loadMod();
    gate.set(it ? 1 : 0);
    scrub = { r0, kf: null, sid: null, fi: -1, lit: false, t: 0 };
    U.uGroundCut.value = groundY();
    frameCut(); frameG.visible = true; if (!hideF) hideF = frontZone(S);
  }
  function endScrub() {
    const it = interiors[SCRUB_ID];
    if (it) { for (const s of it.stations) { s.setActive(false); s.setHover(false); } it.group.visible = false; }
    const r0 = scrub.r0; scrub = null;
    A = slot(); U.uOpenA.value = -1; U.uFocus.value = -1; U.uGroundCut.value = -1e4; U.uArcFade.value = 0; U.uAir.value = 0; U.uMoon.value.w = 0;
    if (frameG) { frameG.visible = false; frameMat.opacity = 0; }
    if (pathM) { pathM.visible = false; pathMat.opacity = 0; }
    dim.set(0); inLight.set(0); gate.set(0); sp.set(0); curStation = null; findC = null; nearK.set(0);
    preRot = r0; rot.set(r0); elev.set(ELEV); camX.set(base.x); camY.set(base.y); camZ.set(Math.log(base.ppu));
    dirty = true; kick();
    o.onScrubEnd && o.onScrubEnd();
  }
  function applyScrub() {
    if (!scrub.kf) scrub.kf = scrubKeys();
    const x = sp.x, c = scrubCam(x);
    rot.set(c.r); elev.set(c.el); camZ.set(c.lz); camX.set(c.x); camY.set(c.y);
    const it = interiors[SCRUB_ID];
    gate.t = it ? 1 : 0;
    const g = gate.x, wallK = smooth(SQ.wall[0], SQ.wall[1], x) * g, sinkK = smooth(SQ.sink[0], SQ.sink[1], x) * g;
    const back = smooth(CL.air[0], CL.air[1], x);   // v7 閉じ: 溶かす・色を抜く・消した物を、逆に戻す(0 = v6 のまま)
    dim.set(.2 * smooth(SQ.dim[0], SQ.dim[1], x) * (1 - back));   // 色を抜くのは .2 まで(暗くはしない)
    U.uAir.value = smooth(SQ.air[0], SQ.air[1], x) * (1 - back);   // 主棟のほかを、その時刻の空気の色へ(world.js の HKAIR。主棟の箱と月の光は、カメラを決めたあとに mainAir で)
    if (frameG) frameG.visible = x < CL.frame[1];   // v7: 消えきったら描かない(閉じの描く回数を増やさない)
    if (frameMat) frameMat.opacity = smooth(SQ.frame[0], SQ.frame[1], x) * g * (1 - smooth(CL.frame[0], CL.frame[1], x));   // 外枠の太い切り口(案B の frameCut)は、壁が沈むのに合わせて。閉じでは町の絵に戻す
    U.uArcFade.value = smooth(SQ.arcs[0], SQ.arcs[1], x) * (1 - smooth(CL.arcs[0], CL.arcs[1], x));   // v7: 広場の弧は、閉じで戻る
    if (pathM) { const k = smooth(CL.lit[0], CL.lit[1], x); pathM.visible = k > .002; if (pathM.visible) { pathMat.opacity = k * (1 - (1 - PATH_A) * clamp01(tod.x)); walkLit(tod.x, pathMat.color); } }
    A.roof.set(0); A.wall.set(A.end * wallK); A.sink = KEEP_WALL ? 0 : sinkK * (S.B[SCRUB_ID].ex.y0 + .24);   // 屋根は残す。壁は倒れきってから、広場の面の下へ
    if (KEEP_WALL) U.uGroundCut.value = -1e4;
    inLight.set(smooth(SQ.light[0], SQ.light[1], x) * g);
    let fi = -1;
    if (g > .5) for (let i = 0; i < 3; i++) if (x >= SQ.floors[i][0] && x < SQ.floors[i][1]) fi = i;
    scrub.fi = fi < 0 ? -1 : FLOOR_OF[fi][1];
    if (it) {
      if (!scrub.lit && wallK > .3) { scrub.lit = true; if (it.reveal) it.reveal(); }   // 壁が倒れ始めたら、画面が順に点る
      else if (scrub.lit && wallK < .02) scrub.lit = false;
      const sid = fi < 0 ? null : FLOOR_OF[fi][0];
      if (sid !== scrub.sid) { scrub.sid = sid; for (const s of it.stations) s.setActive(s.id === sid); curStation = sid; }
    }
    if (scrub.t === 0 && x < 1e-3 && !sp.moving) endScrub();
  }

  /* ---- 中の形(初めてひらいたときに作る)。画面のテクスチャも、そのとき読む ---- */
  const texLoader = new THREE.TextureLoader(), texCache = new Map(), imgOf = new Map();   // imgOf: 読み終えた画面の画像(移る瞬間に、ページがそのまま使う)
  const ctx = {
    palette: PALETTE, quality: 'high',   // 寄ったときに何の画面か読めるよう、スマホでも画面の画像は細かく
    loadTexture(url) {
      if (!texCache.has(url)) texCache.set(url, texLoader.loadAsync(url).then(tx => { tx.colorSpace = THREE.SRGBColorSpace; tx.anisotropy = 4; imgOf.set(url, tx.image); dirty = true; kick(); return tx; }));
      return texCache.get(url);
    }
  };
  /* 中の形のモジュール(圧縮で約30KB)は、立体に替わったあと手が空いたときに読む(最初の画面の読み込みと競合しないように)。
     先に建物を押されたら、そのときに読む(寄る動きの間に届く)。届いたら、公園の小物は芝から立ち上がり、ひらいている建物の中を組んで画面を点す */
  let MOD = null, modP = null, grow = 0;
  function loadMod() {
    if (!modP) modP = Promise.resolve().then(() => typeof o.mod === 'function' ? o.mod() : o.mod).then(m => { MOD = m || null; modReady(); return MOD; }).catch(() => null);
    return modP;
  }
  function modReady() {
    if (!MOD) return;
    const pk = interiorOf('park'); if (pk) { pk.group.scale.y = .001; grow = clock() || 1e-3; }   // 手動の時計(撮るとき)は 0 から始まるので、0 にしない(0 だと伸びずに潰れたまま)
    if (!scrub && !A.id) setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(prewarm, { timeout: 300 }) : prewarm()), 700);   // 案A: 病院の中を先に作って、シェーダーを用意しておく(スクロールして壁がひらく1こまで止まらないように)。公園が芝から伸び終わったらすぐに(早くスクロールを始めた人に当たる間を短く。v6)
    const id = A.id;
    if (scrub) { const it = interiorOf(SCRUB_ID); if (it) it.group.visible = true; scrub.kf = null; }   // 案A: 中の形が届いたら、壁をひらく(進みはスクロールが決める)
    else if (id && id !== 'plaza') {
      const it = interiorOf(id);
      if (it && it.stations.length) {
        it.group.visible = true;
        after(Math.max(0, A.t0 + 1200 - clock()), () => {   // 壁が倒れきってから
          if (A.id !== id) return;
          if (it.reveal) it.reveal();
          after(it.stations.length * 60 + 320, () => { if (A.id === id) setActive(findSid || it.stations[0].id); });
          if (findSid) retarget();
        });
      }
    }
    dirty = true; kick();
  }
  /* 公園だけは最初から中を組む(池・カプセルの機械・保留の棚・窓の額が、町の景色として見えるように)。
     公園の画面の画像(約85KB)も、このとき読む。後にすると、止めた画像と入れ替えた直後に、小さな黒い画面が町に出るため */

  /* 病院の中を、中の形が届いて公園が芝から伸び終わったら(約0.7秒後)、先に作る(見えないまま)。描く形の準備(シェーダー)も、ここで済ませる。
     スクロールの途中で初めて作ると、その1こまで主スレッドが止まり、カメラが引っかかるため。
     v6 の病院の中は、公園と違う描き方を5つ使う(病院の式の3つ・外枠の2つ)。v5 の病院は公園の描き方を使い回していたので、この用意が要らなかった */
  let warm = null;
  function prewarm() {
    if (warm || !MOD || scrub || A.id || interiors[SCRUB_ID] !== undefined) return;
    const it = interiorOf(SCRUB_ID); if (!it) return;
    warm = clock() || 1;
    it.group.visible = true;   // 準備の対象に入れる(このこまでは描かない)
    frameCut(); frameG.visible = true;   // 外枠の太い切り口の描き方も先に用意する(寄り始めの1こまで作ると、そこで長く止まる)
    let pr = null;
    try { pr = renderer.compileAsync ? renderer.compileAsync(S.scene, camera) : (renderer.compile(S.scene, camera), null); } catch (e) { /* そのまま(最初に描くときに用意される) */ }
    if (!scrub && A.id !== SCRUB_ID) it.group.visible = false;
    if (!scrub) frameG.visible = false;
    // 描き方を初めて使うときの確かめ(仕上がりを待つ)も、手が空いているうちに済ませる(寄り始めの1こまで待つと、そこで長く止まる)。
    // 待ちが出た描き方が2つになったら、次の手の空いたときへ回す(まとめて待つと、1つの長い止まりになる)。待ちの多くが描く側の仕事の溜まりなら、一度待てば残りは待たずに済む。済んだら1画素だけ描く(描く形の用意)
    let todo = null;
    const firstUse = () => {
      if (scrub || A.id) return;
      if (!todo) todo = (renderer.info.programs || []).slice();
      let slow = 0;
      while (todo.length) {
        const pg = todo.shift(), t = performance.now();
        try { if (pg.getUniforms) pg.getUniforms(); } catch (e) { /* 描くときに確かめる */ }   // 確かめ済みの描き方は、すぐ返る
        if (performance.now() - t > 8 && ++slow >= 2) break;
      }
      if (todo.length) return idle();
      it.group.visible = true; frameG.visible = true;
      try { renderer.setScissorTest(true); renderer.setScissor(0, 0, 1, 1); renderer.render(S.scene, camera); } catch (e) { /* 次に描くときに確かめる */ }
      renderer.setScissorTest(false);
      it.group.visible = false; frameG.visible = false; dirty = true; kick();
    };
    const idle = () => (window.requestIdleCallback ? requestIdleCallback(firstUse, { timeout: 500 }) : setTimeout(firstUse, 200));
    if (pr && pr.then) pr.then(idle, idle); else idle();
  }
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
  function open(id, opt = {}) {
    lastInput = clock();
    if (A.id === id) return;
    if (!MOD) loadMod();
    if (!A.id) preRot = rot.x;
    const transfer = !!A.id;
    if (A.id) { closeSlot(A); Bk = A; }   // 前の建物は、渡る途中で閉じる
    A = slot(); A.id = id; A.t0 = clock(); arriveId = id;
    A.kind = id === 'plaza' || id === 'park' ? 'none' : BOXES[id].shape === 'tower' ? 'spin' : 'hinge';
    if (A.kind === 'hinge') { const b = S.B[id]; A.end = Math.PI / 2 + Math.asin(clamp((b.ex.y0 + .01) / BOXES[id].h, 0, .4)); }
    if (A.kind === 'spin') A.end = Math.PI;
    dragOff.set(0); findSid = null; nearK.t = 0;
    U.uOpenA.value = LAYOUT[id].bid; U.uFocus.value = LAYOUT[id].bid; dim.t = id === 'plaza' ? 0 : .34;   // 見晴らしでは、まわりの建物を暗くしない(どれも行き先)
    pressFx(id);                       // 押した手応え(沈んで明るく)。乗せたときの浮き(.07)は戻す。中の形は浮かないので、外と中がずれないように
    hover = null; o.onHover(null);
    interiorOf(id);
    const it = interiors[id];
    if (it) it.group.visible = true;
    const reduce = (o.reduce && o.reduce()) || !!opt.instant;   // instant: 戻ってきたとき(飛ばずに、ひらいた姿から)
    retarget();
    // 町ぜんたいからは少し上がって降りる。ひらいたまま移るときは、町の上空を渡る(高く・大きく引く)
    const T = reduce ? 0 : transfer ? flight(1.3, 1.2) : flight(1.1, .55);
    const arrive = Math.round(T * .55);
    const at = ms => reduce ? 0 : ms + arrive;
    A.steps = [
      ...(reduce ? [] : [{ t: at(-120), f: () => { A.roofT0 = clock(); } }]),
      { t: at(0), f: () => { A.wall.t = A.end; } },
      { t: at(190), f: () => { inLight.t = id === 'plaza' ? 0 : 1; } },   // 広場には中がない
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
  function find(sid, opt = {}) {
    if (!A.id) return;
    sid = sid || null; if (sid === findSid) return;
    findSid = sid; lastInput = clock();
    if (sid) { findC = null; setActive(sid); }
    retarget(); nearK.t = sid && findC ? 1 : 0; easeTurn(1200);
    const still = () => { for (const s of [rot, camX, camY, camZ, elev, nearK]) s.set(s.t); };
    if ((o.reduce && o.reduce()) || opt.instant) still();
    else if (sid) after(450, () => { if (findSid === sid) retarget(); });   // 物が持ち上がりきった位置で、もう一度合わせる
    kick();
  }
  /* 戻ってきたとき(URL のハッシュ): 飛ばずに、その建物がひらき、その道具に寄った姿から始める。中の形を読み、物が持ち上がりきってから整える */
  async function restore(id, sid) {
    await loadMod();
    open(id, { instant: true });
    if (sid) find(sid, { instant: true });
    await new Promise(r => after(520, () => { if (A.id === id) { retarget(); nearK.t = findSid && findC ? 1 : 0; for (const s of [rot, camX, camY, camZ, elev, nearK, dim]) s.set(s.t); } r(); }));
    dirty = true; kick();
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
    out.makeTranslation(0, 0, z).multiply(tmpM.makeRotationX(s.wall.x)).multiply(new THREE.Matrix4().makeTranslation(0, 0, -z));
    if (s.sink) out.premultiply(tmpM.makeTranslation(0, -s.sink, 0));   // 案A: 倒れきった壁を、広場の面の下へ(面より下は描かない)
    return out;
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
    for (const s of it.stations) {
      v3.copy(s.anchor); it.group.localToWorld(v3); v3.project(camera);
      const o2 = { id: s.id, label: s.label, x: (v3.x + 1) / 2 * W + r.left * 0, y: (1 - v3.y) / 2 * H, rad: Math.max(22, (s.radius || .2) * ppu) };
      if (scrub && FI[s.id] !== undefined) { o2.band = bandAt(it.group, FI[s.id], o2.x, camera, W, H); o2.fi = FI[s.id]; }   // 案A: 札は、物の真上の、その階の天井(上の階との間の藍の帯)の前の切り口に置く
      out.push(o2);
    }
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
    if (scrub) return;   // 案A: 病院へ寄っている間は、町にふれない(道具の札がリンク)
    lastInput = clock();
    down = { x: e.clientX, y: e.clientY, t: clock(), ts: e.timeStamp, moved: 0, id: e.pointerId, lastX: e.clientX, lastT: clock(), base: rot.x, touch: e.pointerType !== 'mouse' };
    rotV = 0;
    const id = pick(e);
    if (id && id !== A.id && !(A.id && pickStation(e))) { pressFx(id); o.onPress && o.onPress(id); }
    kick();
  });
  o.canvas.addEventListener('pointermove', e => {
    if (down && e.pointerId === down.id) {
      const dx = e.clientX - down.lastX, now = clock(); down.lastX = e.clientX; down.moved += Math.abs(dx) + Math.abs(e.clientY - down.y) * 0;
      if (down.moved > 6) {
        if (!down.t6) down.t6 = e.timeStamp;   // 動き始めた時刻(はじきの速さは、ここから測る)
        if (!o.canvas.hasPointerCapture(e.pointerId)) o.canvas.setPointerCapture(e.pointerId);
        if (pendTier) applyTier();
        const d = dx * .0072;
        if (A.id) { if (!down.touch) { dragOff.t = clamp(dragOff.t + d, -deg(25), deg(25)); dragOff.x = dragOff.t; dragOff.v = 0; } }   // ひらいている間、指の横の動きは回さない(はじきで前後へ)
        else { rot.x += d; rot.t = rot.x; rot.v = 0; rotV = d / Math.max(.008, (now - down.lastT) / 1000); }
        down.lastT = now; lastInput = now; dirty = true; kick();
      }
      return;
    }
    if (scrub) { o.canvas.style.cursor = ''; return; }
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
    if (scrub) { down = null; return; }
    const tap = down.moved < 7;
    if (o.canvas.hasPointerCapture(e.pointerId)) o.canvas.releasePointerCapture(e.pointerId);
    if (!tap && !A.id && Math.abs(rotV) > .05) { inertia = clamp(rotV, -4, 4); }
    if (A.id && !tap) { dragOff.t = 0; }
    const d0 = down; down = null;
    if (!tap) {
      // ひらいている間の、指の横の速く短いはじき → 前後の建物へ(縦はページのスクロールのまま)
      const fx = e.clientX - d0.x, fy = e.clientY - d0.y;
      if (A.id && d0.touch && Math.abs(fx) > 40 && Math.abs(fx) > Math.abs(fy) * 1.4 && e.timeStamp - (d0.t6 || d0.ts) < 400) o.onFlick && o.onFlick(fx < 0 ? 1 : -1);
      kick(); return;
    }
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
  const springs = [rot, camX, camY, camZ, elev, dim, lift, hiAmt, tod, inLight, dragOff, nearK, fly, sp, gate];
  /* 重さの計測: 動いている間のフレームの間隔(中央値)。42ms(24fps)を超えたら一段下げる。下げたらページに知らせる(次の訪問はその段から) */
  const ft = [];
  let pendTier = null, pendAt = 0;   // 下げると決めた段。次に飛ぶとき・回すとき(なければ 6 秒後)に下げる
  let seenInput = 0, inputFrame = 0;   // 指が動いたのを見た、いちばん新しいこま
  const slowT = [];   // 低の段でも舞台が重いとき(中央 60ms 超): ページに知らせて、舞台を止めた画像に替える(低性能の端末でも、寄る・ひらくを止めた画像で見せる)
  function measure(gap) {
    if (manual || frameN < 8) return;
    if (gap > 400) { if (!(scrub && sp.moving)) return; gap = 400; }   // 舞台を動かしている間は、とても遅いこまも遅いこまとして数える(裏のタブなどの長い空きは数えない)
    if (tier === 'low') {
      if (!scrub || !sp.moving || !o.onSlow) return;
      slowT.push(gap); if (slowT.length < 24) return;
      const m = slowT.sort((a, b) => a - b)[slowT.length >> 1]; slowT.length = 0;
      if (m > 60) o.onSlow();
      return;
    }
    ft.push(gap);
    if (ft.length < 36) return;
    const m = ft.sort((a, b) => a - b)[ft.length >> 1]; ft.length = 0;
    if (m > 42 && !pendTier) { pendTier = tier === 'high' ? 'mid' : 'low'; pendAt = clock(); }
  }
  /* こまの記録(?perf=1 の表示と計測): 描いたこまの間隔と、そのこまの手番の時間。直近 240 こま */
  const PS = { gap: [], js: [], n: 0 };
  function pstat(gap, js) { PS.n++; PS.gap.push(gap); PS.js.push(js); if (PS.gap.length > 240) { PS.gap.shift(); PS.js.shift(); } }
  const qtl = (a, f) => { if (!a.length) return 0; const s = a.slice().sort((x, y) => x - y); return Math.round(s[Math.min(s.length - 1, Math.floor(s.length * f))] * 10) / 10; };
  function applyTier() { const q = pendTier; pendTier = null; if (q && q !== tier) setTier(q); }
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
    const f0 = performance.now();   // このこまの手番の時間(JS と描く命令。?perf=1 の表示と計測に)
    const gap = now - last, dt = Math.min(.05, gap / 1000); last = now; frameN++;
    if (running && visible && !document.hidden) measure(gap);
    if (!paused) t += dt;
    // 慣性(ひらいていないときのドラッグ)
    if (!down && !A.id && Math.abs(inertia) > .002) { rot.x += inertia * dt; rot.t = rot.x; inertia *= Math.pow(.05, dt); }
    if (A.id && !scrub) rot.t = (openCam ? openCam.rot : rot.t) + dragOff.x;
    // 段取り
    if (lastInput !== seenInput) { seenInput = lastInput; inputFrame = frameN; }   // 指が動いたこま(1こまが長い端末では、こまの間が 1.2 秒を超えるので、時間だけでは止まったと分からない)
    if (pendTier && now - lastInput > 1200 && frameN - inputFrame >= 3 && (scrub || now - pendAt > 6000)) applyTier();   // この道では、指が止まって 1.2 秒かつ 3 こまたってから下げる(描く大きさを替える1こまは長く止まるので、指が動いている間に替えない。v6)。舞台ではすぐ、ほかは決めて 6 秒後。舞台のばねが落ち着くのは待たない(とても遅い端末では落ち着く前に次のスクロールが来て、いつまでも下がらず、止めた画像にも替わらないため)。飛ぶ・回す始めにも下げる(flight・pointermove)
    while (later.length && later[0].at <= now) later.shift().f();
    if (grow) { const k = clamp01((now - grow) / 650), pk = interiors.park; if (pk) pk.group.scale.y = Math.max(.001, 1 - Math.pow(1 - k, 3)); if (k >= 1) grow = 0; }
    for (const s of [A, Bk]) if (s.id && s.steps.length) { const el = now - s.t0; while (s.steps.length && s.steps[0].t <= el) s.steps.shift().f(); }
    // ばね
    for (const s of springs) s.step(dt);
    if (scrub) applyScrub();   // 案A: スクロールの進みから、カメラ・屋根・前の壁・中の灯りを決める(ばねの値を上書き)
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
    if (scrub && scrub.hi && sp.x > CL.lit[0]) { hiId = scrub.hi; amt = .2; }   // v7 閉じ: 下の出口に乗せた・Tab で来た行き先の建物が、ふっと明るく(誘いと同じ光)
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
      const id = A.id || Bk.id; if (id !== 'plaza') { const pl = placeOf(S, id), il = inLightOf(id); if (scrub) { const bx = BOXES[id]; il.p.y = bx.h / (bx.floors || 3) * (lightF(sp.x) + .62); }   // v6: 中の灯りは p に合わせて 3F から 1F へ続けて降りる(各階の真ん中で少し留まる)
        L.pIn.position.copy(il.p).applyAxisAngle(Y, pl.yaw).add(pl.p); L.pIn.distance = il.dist; inK = il.k; }
    }
    L.pIn.intensity = Math.max(0, inLight.x) * (1.4 + U.uNight.value * 2) * inK;
    const airK = 1 - AIR_LIT * U.uAir.value;   // v6: 着いた病院の前の広場を照らす灯り(入口と、弧のそばの藍と砂)は、寄るのに合わせて弱める(広場の床を部屋より明るくしない)
    L.pH.intensity = (L.pH.userData.base || 0) * ((A.id || Bk.id) === 'plaza' ? 1 : 1 - 1.4 * U.uDim.value) * airK;   // 建物をひらいている間は、広場の灯りを半分に(寄ったとき白く飛ばない)
    L.pI.intensity = L.pS.intensity = 5.5 * U.uArc.value * airK;
    // 町の暮らし(止めているあいだに時刻を変えたときも、空・雲・もやの色だけは合わせる)
    if (paused && tod.moving) placeSky(S.dyn, t, U.uNight.value);
    if (!paused) {
      const blockedAng = A.id && A.kind === 'hinge' && A.id !== 'hospital' ? deg(LAYOUT[A.id].a) : null;
      const blocked = A.id && A.kind === 'hinge' ? footprint(A) : null;
      placePeople(S.dyn, t, blocked, scrub && sp.x > .14 && sp.x < CL.people ? hideF : null); placeVehicles(S.dyn, t, dt, blockedAng); placeSky(S.dyn, t, U.uNight.value); placeSmall(S.dyn, t, !(A.id === 'atelier'));   // v7: 閉じで、正面の広場の人が戻る(CL.people)
    }
    for (const id in interiors) { const it = interiors[id]; if (it && it.group.visible) it.update(dt, t, tod.x < .5 ? 'day' : tod.x < 1.5 ? 'dusk' : 'night'); }
    S.world.rotation.y = rot.x;
    setCamera();
    if (scrub) mainAir(S, camera, H, clamp01((tod.x - 1.2) / .8) * U.uAir.value);   // 着いた病院を切り出す箱と、夜の月の光(寄るのに合わせて)
    if (arriveId && (A.id !== arriveId || ![rot, camX, camY, camZ, elev, fly].some(s => s.moving))) { const id = arriveId; arriveId = null; if (A.id === id) o.onArrive && o.onArrive(id); }
    const active = springs.some(s => s.moving) || [A, Bk].some(s => s.id && (s.wall.moving || s.roof.moving || s.steps.length || s.roofT0 >= 0)) || later.length || grow || down || Math.abs(inertia) > .002 || invite;
    const idle = !active && now - lastInput > 1600;
    // 操作していないときは 30fps
    if (manual && !force) return;
    if (!idle || frameN % 2 === 0 || dirty || force) {
      // 舞台を動かしている間は、影の描き直しを1こまおきに(島の回りと人の動きは1こまでは見分けられない)。止まったら毎こまに戻す
      renderer.shadowMap.autoUpdate = !(scrub && sp.moving && (sp.x < SQ.move[1] || (sp.x > CL.zoom[0] && sp.x < CL.rise[1]))) || (frameN & 1) === 0;   // v7: 閉じで島が回る間も同じ   // 着いた後(階を替える間)は毎こま(持ち上がる道具の画面が、古い影で1こまおきに黒くならないように)
      renderer.render(S.scene, camera); dirty = false;
      layout();
      o.onFrame && o.onFrame(renderer.info.render);
      pstat(gap, performance.now() - f0);
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

  /* v6: 階の印(右の外枠の、各階の上の方)と、正面の地面の線の真ん中の画面の位置(ページの下の帯の置き場) */
  function scrubMarks() {
    const L = markLocals(S), sc = l => { const pl = placeOf(S, SCRUB_ID), v = new THREE.Vector3(...l).applyAxisAngle(Y, pl.yaw).add(pl.p).applyAxisAngle(Y, rot.x).project(camera); return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; };
    return { fl: L.fl.map(sc), gy: sc(L.g)[1], fk: frameMat ? frameMat.opacity : 0 };
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
    out.scrub = scrub ? { p: sp.x, sid: scrub.sid, fi: scrub.fi, ...scrubMarks() } : null;
    if (scrub && sp.x > CL.zoom[0] && ovInfo() && ovInfo().tags) {   // v7 閉じ: 3つの行き先の札(見晴らしの札と同じ置き場)と、広場の真ん中(砂の点)
      out.cl = {}; S.world.updateMatrixWorld();
      for (const id of ['observatory', 'plaza', 'atelier']) { const tg = ovData.tags[id]; if (!tg) continue; const v = S.world.localToWorld(tg.clone()).project(camera); out.cl[id] = [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; }
      const PF = plazaFrame(), [hx, hz] = PF.map([120, 100]), v = S.world.localToWorld(new THREE.Vector3(hx, PF.y + .06, hz)).project(camera); out.cl.here = [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H];   // 現在地: 広場の床の手前(弧の交わる所に重ねない。道が分かれる階段の上)
    }   // 案A: ページの言葉と札は、カメラと同じ(なめらかにした)進みで出し入れする。v6: 階の印の位置・正面の地面の線の高さ・外枠の濃さも
    if (A.id === 'plaza' && ovInfo() && ovInfo().tags) {   // 見晴らしの名前の札(町の側が決めた、建物のいちばん上の少し上)
      out.ov = {}; S.world.updateMatrixWorld();
      for (const id in ovData.tags) { const v = S.world.localToWorld(ovData.tags[id].clone()).project(camera); out.ov[id] = [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]; }
    }
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
  setTimeout(() => (window.requestIdleCallback ? requestIdleCallback(() => loadMod(), { timeout: 1500 }) : loadMod()), 700);   // 止めた画像からの入れ替わり(0.5 秒)が済んでから
  return {
    open, close, setActive, stationHover, find, restore, info, renderer,
    get findId() { return findSid; },
    hover(id) { setHover(id); },
    press(id) { pressFx(id); },
    invite: doInvite,
    setTod(m) { tod.t = m; kick(); },
    /* 案A: スクロールの進み(0..1)。jump: いまの進みへ、ばねを通さずに(立体に替わった瞬間など) */
    scrubTo(p, jump) {
      p = clamp(+p || 0, 0, QMAX);   // v7: 進みは v6 の単位のまま、閉じの分だけ 1 を越える(QMAX)
      if (!scrub) { if (p <= 0) return; beginScrub(); }
      scrub.t = p; sp.t = p; if (jump) sp.set(p);
      lastInput = clock(); dirty = true; kick();
    },
    get scrubbing() { return !!scrub; },
    /* v7 閉じ: 下の出口に乗せた行き先の建物を明るく(null で戻す)・言葉の大きさが変わったら見晴らしの枠を作り直す */
    glow(id) { if (scrub) { scrub.hi = id || null; dirty = true; kick(); } },
    relayout() { if (scrub) scrub.kf = null; dirty = true; kick(); },
    get keys() { return scrub && scrub.kf ? scrub.kf.map(k => ({ r: k.r, el: k.el, ppu: k.ppu, sx: k.sx, sy: k.sy })) : null; },   // 確かめるため: 寄る道筋のキーの姿
    /* 確かめるため: 病院の中で、いま見えている人の頭(画面の座標。中の形の place が書く p.hpos) */
    peopleOnScreen() {
      const it = interiors[SCRUB_ID]; if (!it || !it.people) return [];
      const r = o.canvas.getBoundingClientRect(), out = [], v = new THREE.Vector3(), w = new THREE.Vector3();
      for (const p of it.people) { if (!p.vis || !p.hpos) continue; v.set(p.hpos[0], p.hpos[1], p.hpos[2]); it.group.localToWorld(v); w.copy(v); v.project(camera); out.push({ x: r.left + (v.x + 1) / 2 * W, y: r.top + (1 - v.y) / 2 * H, f: p.fy, kind: p.kind, seen: !hiddenInside(w) }); }
      return out;
    },
    /* 確かめるため: 建物の中の点(この中の形の座標)が、建物の中の物(上の階の床・天井・壁・家具)に隠れずに見えるか */
    stationLocal(sid) { const it = interiors[SCRUB_ID], st = it && it.stations.find(x => x.id === sid); return st ? [st.anchor.x, st.anchor.y, st.anchor.z] : null; },
    seenInside(l) { const it = interiors[SCRUB_ID]; if (!it) return null; const v = new THREE.Vector3(...l); it.group.localToWorld(v); return !hiddenInside(v); },
    setPaused(p) { paused = p; kick(); },
    get openId() { return A.id; },
    stations() { const it = A.id && interiors[A.id]; return it ? it.stations.map(s => ({ id: s.id, label: s.label })) : []; },
    resize, kick,
    /* 手動の時計で ms だけ進めて、1枚描く(撮るとき) */
    advance(ms) { const n = Math.max(1, Math.round(ms / (1000 / 60))); for (let i = 0; i < n; i++) { vnow += ms / n; frame(vnow, i === n - 1); } },
    get manual() { return manual; },
    get tier() { return tier; },
    /* 計測(?perf=1): 直近のこまの間隔と手番の時間(中央・95%)、50ms を超えた数、品質の段、画素比、描く回数・三角形・影の描き直し */
    perfStats() { const ri = renderer.info.render; return { n: PS.n, gapMed: qtl(PS.gap, .5), gapP95: qtl(PS.gap, .95), over50: PS.gap.filter(g => g > 50).length, jsMed: qtl(PS.js, .5), jsP95: qtl(PS.js, .95), tier, dpr: renderer.getPixelRatio(), px: Math.round(W * H * renderer.getPixelRatio() ** 2), calls: ri.calls, tris: ri.triangles, scrub: !!scrub }; },
    perfReset() { PS.gap.length = 0; PS.js.length = 0; PS.n = 0; },
    get programs() { return (renderer.info.programs || []).length; },   // 計測: 作った描き方(シェーダー)の数(途中で増えると、その1こまで止まる)
    get compileMs() { return compileMs; },
    get findSize() { return lastFind; },
    /* 移る瞬間のため: その道具の画面(中の物の板)が、いまページのどこに見えているか(ページの座標の四角)と、読み終えた画像 */
    screenRect(sid) {
      const it = A.id && interiors[A.id], st = it && it.stations.find(s => s.id === sid), q = st && screenQuad(it, st); if (!q) return null;
      const r = o.canvas.getBoundingClientRect(); let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
      for (const p of q.pts) { const v = S.world.localToWorld(p.clone()).project(camera), x = r.left + (v.x + 1) / 2 * W, y = r.top + (1 - v.y) / 2 * H; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
      return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
    },
    imageOf(url) { return imgOf.get(new URL(url, document.baseURI).href) || imgOf.get(url) || null; },   // 中の形は画像を絶対の URL で読む(import.meta.url から)。ページの相対の URL でも引けるように
    /* 撮る・確かめるため: 建物の中の点(その建物の座標)が、いま画面のどこにあるか */
    pickAt(x, y) { return pick({ clientX: x, clientY: y, pointerType: 'touch' }); },   // 確かめるため: 画面のその点で選ばれる建物
    screenOf(id, l) { const pl = placeOf(S, id), v = new THREE.Vector3(...l).applyAxisAngle(Y, pl.yaw).add(pl.p).applyAxisAngle(Y, rot.x).project(camera), r = o.canvas.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * W, r.top + (1 - v.y) / 2 * H]; }
  };
}
