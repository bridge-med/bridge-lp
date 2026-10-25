/* ================================================================
   融合3「ひらく町」— 建物の外側(形・小物)と、中の形のモジュールとの約束

   ■ BOXES(中の形のモジュール interiors.js が読む。BRIEF 9.9)
     原点は建物の床の中心。+Y が上、+Z が正面(ひらく側。前の壁はここで下へ倒れる)。単位は町の単位
     中は x∈[-w/2, w/2]、z∈[-d/2, d/2 - 0.04]、y∈[0, h] に収める。展望台は shape:'tower'(w は直径。中は半径 w/2 の円柱)
     正面の壁と屋根は外側(このファイル)の持ち物。側面と奥の壁の内側・床・天井の厚みは、中のモジュールが作る
     外側の壁の厚みは WALL(壁の外の面は ±(w/2 + WALL)、奥は -(d/2 + WALL)、前の壁は d/2 〜 d/2 + WALL)
     人の背の高さは PERSON_H(中の人も、この大きさに合わせる)
     箱の外に足したもの(病院の右の翼・車寄せ・最上階のセットバックなど)は、中の約束に触れない。
     セットバックと屋上の物は屋根の部品(part 2)で、ひらくと屋根と一緒に持ち上がって消える
   ■ 断面の切り口
     前の壁が倒れると見える、外の殻(側面と奥の壁)の前の縁と、屋根を外すと見える壁の上の縁は、淡い面(PALETTE.cutLight)。
     ふつうの壁と同じように光を受ける。藍(PALETTE.poche)は、中のモジュールが部屋の縁に引く細い線だけに使う(2026-10-24 決定)
   ■ 最初の値からの変更
     2026-10-24 展望台の直径 w 1.0 → 1.2(7つの道具を3つの階に置くため)。ほかは BRIEF の最初の値のまま
   ================================================================ */
export const WALL = 0.08;
export const PERSON_H = 0.44;

export const BOXES = {
  hospital: { w: 3.2, d: 2.2, h: 2.9, floors: 3, shape: 'box' },
  observatory: { w: 1.2, d: 1.2, h: 4.2, floors: 3, shape: 'tower' },
  clinic: { w: 2.0, d: 1.4, h: 1.1, floors: 1, shape: 'box' },
  office: { w: 1.8, d: 1.8, h: 3.0, floors: 3, shape: 'box' },
  library: { w: 2.4, d: 1.8, h: 1.9, floors: 1, shape: 'box' },
  atelier: { w: 1.6, d: 1.4, h: 1.3, floors: 1, shape: 'box' },
  park: { w: 4.0, d: 3.0, h: 0, floors: 0, shape: 'open' }
};

/* 中の形にも使ってよい色(ctx.palette として渡す)。落ち着いた建築模型の色と、B の温かさ。
   cutLight は外の殻の切り口(淡い面)、poche は中の担当が部屋の縁に引く細い藍の線 */
export const PALETTE = {
  wallIn: '#F4EFE6', wallIn2: '#EAE2D4', floor: '#D9C7A8', floorStone: '#D8D2C6', ceil: '#F7F3EC',
  wood: '#C9A980', woodD: '#A88761', woodL: '#DCC5A2', steel: '#8D979F', steelL: '#C9CED2', dark: '#3A4047',
  screen: '#161B21', paper: '#FBF8F1', cork: '#C9A877', fabric: '#8C9A8A', fabric2: '#B9897A',
  glass: '#9DB4C2', plant: ['#7FA06F', '#8FB07C', '#6E9363'], pot: '#C98B6B',
  scrubs: ['#3F8B87', '#2E3C56'], coat: '#F3F1EB', office: ['#5A646E', '#2F3B4E', '#8C8F94'], casual: ['#C79B87', '#8FB1D1', '#D7C7AC', '#6F8A6A', '#B07F5F'],
  skin: ['#EECFB8', '#E0BB9B', '#CBA282'], hair: ['#2A2522', '#3D332C', '#594A3D', '#8A8278'],
  poche: '#16233E', cutLight: '#E9E1D5'
};

/* ================================================================
   建物の外側。どれも「原点 = 建物の床の中心、+Z = 正面」で作る(world.js が島の上に置き、向ける)
   返すもの: { g, y0(床の高さ = 地面からの台の高さ), fall:'hinge'|'spin'|'none', door:[x,z](人が出入りする所),
               top(いちばん高い所), emit:{ steam:[x,y,z] }, foot:[[x0,z0,x1,z1], ...](地面に接する範囲。接地の陰に使う) }
   看板は使わず、形と色と小物で何の建物か分かるようにする。行き先の色(C の階色)は塗らない
   ================================================================ */
import { THREE, C, M, at, tag, box, cbox, rbox, cyl, sph, gable, shell, pane, grid, tree, hedge, lamp, bench, bike, deg, TAU, rng } from './kit.js';

const E = .004;                 // 中の形と面が重ならないための、すき間
const PC = .006;                // 切り口の塗りの厚み
const INNER = () => M(C.inner);
const POCHE = () => M(PALETTE.cutLight, { r: .85 });   // 外の殻の切り口の淡い面
const flat = m => { m.castShadow = false; return m; };   // 切り口の面(光はふつうに受ける。影は落とさない)
/* 側面・奥の壁(動かない)と、前の壁(倒れる。内側に生成りの裏張り)。窓は呼ぶ側で足す
   側面の壁の前の縁と、側面・奥の壁の上の縁には、切り口の淡い面を貼る。閉じているときは前の壁と屋根に隠れる */
function walls(g, b, wallMat, frontMat) {
  const t = WALL, X = b.w / 2 + E, Z = b.d / 2 + E, h = b.h, hw = h - PC;
  g.add(at(box(t, hw, 2 * Z + t - PC, wallMat), -(X + t / 2), hw / 2, -t / 2 - PC / 2));
  g.add(at(box(t, hw, 2 * Z + t - PC, wallMat), X + t / 2, hw / 2, -t / 2 - PC / 2));
  g.add(at(box(2 * X, hw, t, wallMat), 0, hw / 2, -(Z + t / 2)));
  const pm = POCHE();
  for (const s of [-1, 1]) {
    g.add(at(flat(box(t, h, PC, pm)), s * (X + t / 2), h / 2, Z - PC / 2));
    g.add(at(flat(box(t, PC, 2 * Z + t, pm)), s * (X + t / 2), h - PC / 2, -t / 2));
  }
  g.add(at(flat(box(2 * X, PC, t, pm)), 0, h - PC / 2, -(Z + t / 2)));
  const fw = tag(new THREE.Group(), { part: 1 });
  fw.add(at(box(2 * (X + t), h, t, frontMat || wallMat), 0, h / 2, Z + t / 2));
  fw.add(at(box(2 * X - .02, h - .02, .006, INNER()), 0, h / 2, b.d / 2 - .003));
  g.add(fw);
  return { fw, X, Z, t, W: 2 * (X + t), D: 2 * (Z + t) };
}
const roofGroup = g => { const r = tag(new THREE.Group(), { part: 2 }); g.add(r); return r; };
function plinth(g, W, D, y0, mat, pad = .16) { g.add(at(cbox(W + pad * 2, y0 + .01, D + pad * 2, mat, .012), 0, -y0 / 2 - E + .005, 0)); }
const nc = m => { m.castShadow = false; return m; };

/* ---------- 病院(いつもの職場・主役): 白い建物。正面の車寄せ(庇と柱)、右の翼と救急口、最上階のセットバック、窓の枠と庇、屋上の設備とヘリポート。
   青緑は帯と庇の差し色に限る。赤十字は使わない ---------- */
function hospital(signs, opt = {}) {
  const solo = !!opt.solo;   // 主棟だけ(案B の断面: 右の翼・救急口・左のスロープを作らない)
  const g = new THREE.Group(), b = BOXES.hospital, y0 = .06, white = M(C.white), white2 = M(C.white2), trim = M(C.trim, { r: .7 }), band = M(C.scrub, { r: .65 });
  const s = walls(g, b, white), { fw, X, Z, t, W, D } = s, h = b.h, fh = h / b.floors, F = Z + t;
  plinth(g, W, D, y0, M(C.stone2));
  const winO = { flicker: true, mode: 1, glow: 4, frame: C.trim, jambs: true, mat: M(C.hospGlass, { r: .25 }) };
  // 角の付け柱(面取り。角に光が乗る)。前の2本は前の壁と一緒に倒れる
  for (const sx of [-1, 1]) { g.add(at(cbox(.11, h, .11, trim, .02), sx * (X + t - .035), h / 2, -(F - .035))); fw.add(at(cbox(.11, h, .11, trim, .02), sx * (X + t - .035), h / 2, F - .035 + .012)); }
  // 階の帯(石の細い水切り)。正面の上の縁だけ、青緑の細い線
  for (const y of [fh, 2 * fh]) {
    g.add(at(cbox(W + .03, .035, .03, white2, .008), 0, y, -F - .012), at(cbox(.03, .035, D - .02, white2, .008), -(X + t) - .012, y, 0), at(cbox(.03, .035, D - .02, white2, .008), X + t + .012, y, 0));
    fw.add(at(cbox(W + .03, .035, .035, white2, .008), 0, y, F + .016));
  }
  fw.add(at(box(W - .2, .03, .02, band), 0, h - .09, F + .012));
  // 側面と奥の窓(枠と庇つき)
  for (let f = 0; f < 3; f++) {
    const cy = fh * f + fh * .52;
    grid(g, 'back', W, D, cy, 6, 1, .5, 0, .3, .38, winO);
    grid(g, 'left', W, D, cy, 4, 1, .5, 0, .3, .38, winO);
    grid(g, 'right', W, D, cy, 4, 1, .5, 0, .3, .38, winO);
  }
  // 正面: 3つの柱間(左右は2つずつの窓、真ん中は縦に通る階段室のガラス)。付け柱が影の線をつくる
  for (const x of [-.5, .5]) fw.add(at(cbox(.07, h - fh - .1, .06, trim, .015), x, fh + (h - fh - .1) / 2, F + .03));
  for (let f = 1; f < 3; f++) { const cy = fh * f + fh * .52; grid(fw, 'front', W, D, cy, 2, 1, .5, 0, .32, .4, { ...winO, cx: -1.0 }); grid(fw, 'front', W, D, cy, 2, 1, .5, 0, .32, .4, { ...winO, cx: 1.0 }); }
  const stairG = pane(fw, 0, fh + (h - fh - .2) / 2 + .02, F + .012, .58, h - fh - .25, .03, { flicker: true, mode: 4, glow: 4 });
  void stairG;
  for (let i = 1; i < 6; i++) fw.add(nc(at(box(.6, .018, .03, trim), 0, fh + i * (h - fh - .2) / 6 + .02, F + .022)));
  // 1階: ロビーのガラス(縦の桟)、真ん中の自動ドア、両脇の窓
  pane(fw, 0, .42, F + .012, 1.9, .66, .03, { flicker: true, mode: 4, glow: 4, mat: M('#7D90A0', { r: .3 }) });
  for (const x of [-.95, -.55, -.25, .25, .55, .95]) fw.add(nc(at(box(.03, .66, .035, trim), x, .42, F + .022)));
  fw.add(nc(at(box(1.92, .03, .035, trim), 0, .76, F + .022)));
  for (const x of [-1.38, 1.38]) pane(fw, x, .45, F + .012, .26, .38, .03, winO);
  // 正面の車寄せ(大きな平らな庇と、細い円柱。前の壁と一緒に倒れる)
  const pc = new THREE.Group(); pc.position.set(0, 0, F);
  pc.add(at(cbox(2.1, .075, 1.0, trim, .02), 0, .86, .5));
  pc.add(nc(at(box(2.12, .03, .02, band), 0, .865, 1.005)), nc(at(box(.02, .03, 1.0, band), -1.055, .865, .5)), nc(at(box(.02, .03, 1.0, band), 1.055, .865, .5)));
  for (const x of [-.9, .9]) pc.add(at(cyl(.032, .032, .82, trim, 10), x, .41, .9));
  fw.add(pc);
  // 左: スロープと車いす(横の入口へ)
  if (!solo) {
  const ramp = new THREE.Group(); ramp.position.set(-(X + t) - .34, 0, .05);
  const rp = box(.46, .05, 1.5, M(C.curb)); rp.position.set(0, -y0 + .045, .1); rp.rotation.x = deg(-2.4); ramp.add(rp);
  ramp.add(at(box(.025, .2, 1.5, M(C.steel, { r: .5 })), -.24, .06, .1), at(box(.03, .03, 1.5, M(C.steel, { r: .5 })), -.24, .17, .1));
  const chair = new THREE.Group(); chair.position.set(.03, .02, .45); chair.rotation.y = deg(180);
  for (const sx of [-.09, .09]) { const w = sh2(new THREE.Mesh(new THREE.TorusGeometry(.085, .014, 5, 14), M(C.tire))); w.rotation.y = Math.PI / 2; w.position.set(sx, .09, -.02); chair.add(w); }
  chair.add(at(box(.17, .025, .15, M('#5C6773')), 0, .14, 0), at(box(.17, .14, .02, M('#5C6773')), 0, .22, -.07));
  ramp.add(chair);
  g.add(ramp);
  g.add(at(box(.03, .55, .5, M(C.glassDark, { r: .3 })), -(X + t) - .01, .3, .55));
  }
  // 右の翼(2階建て・少し下がる)と救急口。箱の外にあり、ひらいても動かない
  const wx0 = X + t, wx1 = X + t + 1.45, wz0 = -1.05, wz1 = .52, wh = 1.92, wcx = (wx0 + wx1) / 2, wcz = (wz0 + wz1) / 2;
  if (!solo) {
  g.add(at(cbox(wx1 - wx0 + .04, wh, wz1 - wz0, white, .02), wcx - .02, wh / 2, wcz));
  g.add(at(cbox(wx1 - wx0 + .16, .09, wz1 - wz0 + .12, M(C.slab), .02), wcx + .02, wh + .045, wcz));
  g.add(at(cbox(wx1 - wx0 + .2, .03, .05, white2, .008), wcx + .02, .96, wz1 + .02));
  g.add(at(box(wx1 - wx0 - .2, .028, .02, band), wcx, wh - .08, wz1 + .006));
  for (const x of [wcx - .38, wcx + .38]) pane(g, x, 1.45, wz1 + .012, .34, .4, .03, winO);
  for (const z of [wcz - .45, wcz + .1]) { pane(g, wx1 + .012, 1.45, z, .03, .4, .34, winO); pane(g, wx1 + .012, .5, z, .03, .38, .34, winO); }
  pane(g, wcx + .42, .5, wz1 + .012, .3, .38, .03, winO);
  // 救急口: ガラスの自動ドアと、柱で支える庇(先に青緑の細い線)。救急の車がここに着く
  pane(g, wcx - .2, .36, wz1 + .012, .56, .62, .03, { flicker: true, mode: 4, glow: 4, mat: M('#7D90A0', { r: .3 }) });
  g.add(nc(at(box(.03, .62, .035, trim), wcx - .2, .36, wz1 + .024)));
  g.add(at(cbox(1.5, .065, 1.0, trim, .018), wcx - .05, .82, wz1 + .5));
  g.add(nc(at(box(1.52, .028, .02, band), wcx - .05, .825, wz1 + 1.005)));
  for (const x of [wcx - .72, wcx + .62]) g.add(at(cyl(.028, .028, .8, trim, 8), x, .4, wz1 + .9));
  g.add(nc(at(box(1.4, .01, .95, M(C.pave2, { r: .9 })), wcx - .05, -y0 + .006, wz1 + .48)));
  // 翼の屋上: 小さな庭
  const r0 = rng(12);
  g.add(at(rbox(.8, .1, .34, .03, M(C.terraL)), wcx, wh + .14, wcz - .3));
  for (let i = 0; i < 3; i++) g.add(at(sph(.11 + r0() * .03, M(C.leaf[i], { vc: false }), 8, 6), wcx - .26 + i * .26, wh + .26, wcz - .3));
  }
  const r = rng(12); for (let i = 0; i < 3; i++) r();   // 翼の庭の分だけ乱数を進める(翼を作らないときも、主棟の屋上の庭の形を町と同じにする)
  // 屋上(屋根と一緒に持ち上がる): 屋根の板と縁、最上階のセットバック、ヘリポート、設備、屋上の庭
  const rf = roofGroup(g);
  rf.add(at(cbox(W + .1, .1, D + .1, M(C.slab), .02), 0, h + .05 + E, 0));
  rf.add(at(cbox(W + .14, .07, .06, trim, .015), 0, h + .135, F + .03), at(cbox(W + .14, .07, .06, trim, .015), 0, h + .135, -F - .03));
  rf.add(at(cbox(.06, .07, D + .1, trim, .015), -(X + t) - .03, h + .135, 0), at(cbox(.06, .07, D + .1, trim, .015), X + t + .03, h + .135, 0));
  // セットバックした最上階(帯の窓・薄い庇)
  const sbx = -.62, sbz = -.3, sbw = 1.85, sbd = 1.25, sbh = .62, sy = h + .1;
  rf.add(at(cbox(sbw, sbh, sbd, white, .02), sbx, sy + sbh / 2, sbz));
  pane(rf, sbx, sy + sbh * .52, sbz + sbd / 2 + .012, sbw - .25, .26, .03, winO);
  pane(rf, sbx - sbw / 2 - .012, sy + sbh * .52, sbz, .03, .26, sbd - .3, winO);
  pane(rf, sbx + sbw / 2 + .012, sy + sbh * .52, sbz, .03, .26, sbd - .3, winO);
  rf.add(at(cbox(sbw + .16, .05, sbd + .16, trim, .015), sbx, sy + sbh + .025, sbz));
  rf.add(nc(at(box(sbw + .17, .02, .02, band), sbx, sy + sbh + .01, sbz + sbd / 2 + .08)));
  // セットバックの屋根の上の設備(空調の箱・水槽・換気の筒)
  rf.add(at(cbox(.42, .2, .3, M(C.machine), .02), sbx - .45, sy + sbh + .15, sbz - .15), at(cbox(.3, .16, .26, M(C.machine), .02), sbx + .05, sy + sbh + .13, sbz - .2));
  rf.add(at(cyl(.12, .12, .24, M('#C3C7C9', { r: .6 }), 14), sbx + .5, sy + sbh + .17, sbz + .12));
  for (const dx of [-.15, .05]) rf.add(at(cyl(.025, .025, .14, M(C.steel, { r: .5 }), 6), sbx + dx, sy + sbh + .12, sbz + .38));
  // ヘリポート(右の屋上。円と H)
  const hx = 1.0, hz = .1;
  rf.add(at(cyl(.56, .56, .035, M('#CFD2D1', { r: .8 }), 30), hx, h + .118, hz));
  const ring = sh2(new THREE.Mesh(new THREE.TorusGeometry(.46, .022, 4, 36), M('#D7BE73', { r: .7 })), false); ring.rotation.x = -Math.PI / 2; ring.position.set(hx, h + .14, hz); rf.add(ring);
  const hm = M('#FFFFFF', { r: .7 });
  rf.add(nc(at(box(.045, .012, .3, hm), hx - .1, h + .141, hz)), nc(at(box(.045, .012, .3, hm), hx + .1, h + .141, hz)), nc(at(box(.2, .012, .045, hm), hx, h + .141, hz)));
  // 屋上の庭(前の左。下から見える)
  rf.add(at(rbox(.62, .1, .3, .03, M(C.terraL)), -1.12, h + .16, .78));
  for (let i = 0; i < 3; i++) rf.add(at(sph(.1 + r() * .03, M(C.leaf[(i + 1) % 4]), 8, 6), -1.32 + i * .2, h + .26, .78));
  const ft = [[-(X + t) - .6, -F - .1, wx1 + .05, F + .05]];
  return { g, y0, fall: 'hinge', door: [0, F + .5], side: [-(X + t) - .34, 1.0], er: [wcx - .05, wz1 + .55], top: sy + sbh + .35, foot: ft };
}

/* ---------- 展望台(キャリアの地図・準主役): 砂色の塔に藍のドーム。塔の上の灯室(夜は砂色に灯る)、手すりの輪、らせんの外階段、BRIDGE のマークの風見、根元の道しるべ ---------- */
function observatory() {
  const g = new THREE.Group(), b = BOXES.observatory, y0 = .12, h = b.h, R0 = b.w / 2 + E, R1 = R0 + WALL;
  const sand = M(C.sandTower), sandD = M(C.sandTowerD), trim = M(C.trim, { r: .7 });
  g.add(at(cyl(1.02, 1.1, y0 + .01, M(C.stone2), 36), 0, -y0 / 2 - E + .005, 0));
  g.add(at(cyl(R1 + .07, R1 + .09, .22, sandD, 32), 0, .11, 0));
  g.add(shell(R0, R1, h - PC, deg(90), deg(270), sand, 24, false));
  // 切り口(後ろの半分の殻の両端と、上の縁)
  for (const a of [deg(90), deg(270)]) { const c = flat(box(WALL, h, PC, POCHE())); c.position.set(Math.sin(a) * (R0 + WALL / 2), h / 2, Math.cos(a) * (R0 + WALL / 2)); c.rotation.y = a + Math.PI / 2; g.add(c); }
  const topRim = flat(shell(R0, R1, PC, deg(90), deg(270), POCHE(), 24, false)); topRim.position.y = h - PC; g.add(topRim);
  // 前の半分は、塔のまわりを回って奥へ(扉のように開く)
  const front = tag(new THREE.Group(), { part: 1 });
  front.add(shell(R1 + .006, R1 + .08, h, deg(-90), deg(90), sand, 24));
  front.add(shell(R0, R0 + .006, h - .02, deg(-88), deg(88), INNER(), 18));
  g.add(front);
  // 帯と細い窓(枠つき)
  for (const y of [h * .33, h * .66]) { g.add(shellBand(R1, y, deg(90), deg(270), sandD)); front.add(shellBand(R1 + .08, y, deg(-90), deg(90), sandD)); }
  for (const [a, y] of [[0, .9], [deg(35), 2.3], [deg(-30), 3.5], [deg(150), 1.6], [deg(210), 2.9], [deg(180), .9]]) {
    const back = a > deg(90) && a < deg(270), r = back ? R1 + .012 : R1 + .09, tgt = back ? g : front;
    const p = pane(tgt, Math.sin(a) * r, y, Math.cos(a) * r, .1, .3, .03, { flicker: true, mode: 3, glow: 5 }); p.rotation.y = a;
    const hood = cbox(.16, .03, .05, sandD, .008); hood.position.set(Math.sin(a) * (r + .015), y + .17, Math.cos(a) * (r + .015)); hood.rotation.y = a; hood.castShadow = false; tgt.add(hood);
  }
  front.add(at(box(.3, .55, .03, M(C.wood)), 0, .28, R1 + .09));
  front.add(at(cbox(.42, .04, .16, sandD, .01), 0, .6, R1 + .14));
  // 上(屋根と一緒に持ち上がる): 見晴らしの回廊と手すりの輪、灯室(ガラスと細い桟。夜は砂色に灯る)、回る藍のドームと望遠鏡、BRIDGE の風見
  const rf = roofGroup(g);
  rf.add(at(cyl(.98, .9, .1, M(C.stone2), 36), 0, h + .05, 0));
  rf.add(at(cyl(.99, .99, .02, trim, 36), 0, h + .105, 0));
  const rail = sh2(new THREE.Mesh(new THREE.TorusGeometry(.95, .014, 4, 48), trim)); rail.rotation.x = -Math.PI / 2; rail.position.y = h + .38; rf.add(rail);
  const rail2 = sh2(new THREE.Mesh(new THREE.TorusGeometry(.95, .008, 3, 48), trim), false); rail2.rotation.x = -Math.PI / 2; rail2.position.y = h + .25; rf.add(rail2);
  for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; rf.add(at(cyl(.009, .009, .28, trim, 4), Math.sin(a) * .95, h + .24, Math.cos(a) * .95)); }
  rf.add(at(cyl(.56, .58, .1, sandD, 30), 0, h + .15, 0));
  const lan = cyl(.5, .5, .38, M('#C9D3D8', { r: .3 }), 30); lan.position.y = h + .39; lan.userData.fx = [3, 1]; lan.castShadow = false; rf.add(lan);
  for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; rf.add(at(cbox(.035, .38, .035, M(C.sandTowerD), .008), Math.sin(a) * .505, h + .39, Math.cos(a) * .505)); }
  rf.add(at(cyl(.56, .54, .06, sandD, 30), 0, h + .61, 0));
  const dome = tag(new THREE.Group(), { part: 52 });
  dome.add(at(sh2(new THREE.Mesh(new THREE.SphereGeometry(.56, 30, 12, 0, TAU, 0, Math.PI / 2), M(C.indigo, { r: .42 }))), 0, h + .64, 0));
  dome.add(at(box(.13, .44, .02, M(C.indigoD, { r: .5 })), 0, h + .88, .49));
  const tel = cyl(.045, .065, .56, M('#E6E2DA', { r: .5 }), 10); tel.rotation.x = deg(62); tel.position.set(0, h + 1.02, .44); dome.add(tel);
  // 風見: 細い軸の上に、BRIDGE のマーク(藍と砂の2本の線。交差するが接続しない)
  dome.add(at(cyl(.012, .016, .5, M(C.indigoD, { r: .5 }), 6), 0, h + 1.42, 0));
  dome.add(at(sph(.03, M(C.brand, { r: .5 }), 8, 6), 0, h + 1.2, 0));
  const vane = new THREE.Group(); vane.position.set(0, h + 1.5, 0);
  const logoTube = (P, col) => { const cv = new THREE.CubicBezierCurve3(...P.map(([u, v]) => new THREE.Vector3((u - 120) / 240 * .5, -(v - 55) / 240 * .5, 0))); const m = sh2(new THREE.Mesh(new THREE.TubeGeometry(cv, 16, .011, 4), M(col, { r: .5 }))); vane.add(m); };
  logoTube([[8, 74], [62, 16], [118, 24], [176, 84]], C.navy); logoTube([[58, 94], [118, 60], [158, 22], [232, 12]], C.brand);
  for (const m of vane.children) m.position.z = m === vane.children[0] ? -.012 : .012;
  dome.add(vane);
  rf.add(dome);
  // らせんの外階段(奥の左に、柱のまわりを巻いて回廊まで)
  const st = new THREE.Group(); st.position.set(Math.sin(deg(215)) * 1.12, 0, Math.cos(deg(215)) * 1.12);
  st.add(at(cyl(.035, .035, h + .1, M(C.steel, { r: .5 }), 8), 0, h / 2, 0));
  const n = 30;
  for (let i = 0; i < n; i++) { const a = i / n * TAU * 2.4, y = .12 + i / (n - 1) * (h - .1), s = cbox(.28, .03, .1, M(C.stone2), .008); s.position.set(Math.sin(a) * .16, y, Math.cos(a) * .16); s.rotation.y = a + Math.PI / 2; st.add(s); }
  g.add(st);
  // 根元の道しるべ(行き先を指す3枚の板)
  const sp = new THREE.Group(); sp.position.set(1.05, 0, .75);
  sp.add(at(cyl(.03, .035, .9, M(C.wood), 6), 0, .45, 0));
  [[.78, 30, .36], [.64, -40, .3], [.5, 160, .34]].forEach(([y, a, l]) => { const p = cbox(l, .085, .025, M(C.woodL), .008); p.position.set(Math.cos(deg(a)) * l / 2, y, -Math.sin(deg(a)) * l / 2); p.rotation.y = deg(a); sp.add(p); });
  g.add(sp);
  return { g, y0, fall: 'spin', door: [0, R1 + .4], top: h + 1.75, beam: [0, h + .39, 0], foot: [[-1.1, -1.1, 1.1, 1.1]] };
}
function shellBand(r, y, a0, a1, mat) { const m = shell(r, r + .014, .06, a0, a1, mat, 24); m.position.y = y; return m; }

/* ---------- クリニック(経営を学ぶ・脇役): セージの壁、片流れの屋根、大きな待合の窓、テラコッタと生成りの縞のひさし、「診療中」の札、自転車置き場、ベンチ、自動ドア。
   夜は閉まって、扉の脇の小さな看板だけが灯る ---------- */
function clinic(signs) {
  const g = new THREE.Group(), b = BOXES.clinic, y0 = .06, sage = M(C.sage), cream = M(C.cream), trim = M(C.trim, { r: .7 });
  const s = walls(g, b, sage), { fw, X, Z, t, W, D } = s, h = b.h, F = Z + t;
  plinth(g, W, D, y0, M(C.curb));
  for (const y of [.05]) {
    g.add(at(box(W + .02, .08, .02, cream), 0, y, -F - .005), at(box(.02, .08, D, cream), -(X + t) - .005, y, 0), at(box(.02, .08, D, cream), X + t + .005, y, 0));
    fw.add(at(box(W + .02, .08, .02, cream), 0, y, F + .006));
  }
  const winO = { glow: 0, frame: C.cream };
  grid(g, 'left', W, D, .6, 2, 1, .52, 0, .34, .38, winO); grid(g, 'right', W, D, .6, 2, 1, .52, 0, .34, .38, winO);
  grid(g, 'back', W, D, .62, 3, 1, .6, 0, .32, .32, winO);
  // 前: 大きな待合の窓(縦の桟2本)・縞のひさし・自動ドア(左右に開く)・「診療中」の札
  pane(fw, -.38, .54, F + .012, 1.08, .58, .03, { glow: 0 });
  for (const x of [-.74, -.38, -.02]) fw.add(nc(at(box(.03, .6, .035, cream), x, .54, F + .022)));
  fw.add(nc(at(box(1.12, .03, .035, cream), -.38, .845, F + .022)), nc(at(box(1.12, .04, .05, cream), -.38, .235, F + .025)));
  for (let i = 0; i < 9; i++) { const st = cbox(.13, .025, .34, i % 2 ? cream : M(C.terra, { r: .8 }), .008); st.position.set(-.89 + i * .127, .96, F + .15); st.rotation.x = deg(22); fw.add(st); }
  fw.add(at(box(.66, .7, .02, M(C.white2)), .62, .37, F + .006));
  const dl = tag(at(box(.26, .58, .02, M(C.glass, { r: .25 })), .5, .31, F + .02), { part: 61 }), dr = tag(at(box(.26, .58, .02, M(C.glass, { r: .25 })), .76, .31, F + .02), { part: 71 });
  dl.userData.fx = [0, 1]; dr.userData.fx = [0, 1];
  fw.add(dl, dr);
  fw.add(at(cbox(.72, .045, .22, trim, .012), .63, .74, F + .11));
  signs.push({ bid: 3, part: 1, key: 'shinryo', w: .22, h: .11, pos: [.63, .58, F + .036] });
  // 夜に灯る小さな看板(扉の右の柱。文字なし、生成りの面)
  const sg = cbox(.06, .26, .1, cream, .01); sg.position.set(.98, .58, F + .07); sg.userData.fx = [6, 0]; fw.add(sg);
  // 外: 待合のベンチ・自転車置き場(2台と、低い柵)・鉢
  const bn = bench(.6); bn.position.set(X + t + .38, 0, .4); bn.rotation.y = deg(-90); g.add(bn);
  for (const [i, col] of [[0, '#5E6B62'], [1, '#7A6E62']]) { const bk = bike(col); bk.position.set(-(X + t) - .32, 0, .55 - i * .32); bk.rotation.y = deg(90); g.add(bk); }
  g.add(at(box(.02, .14, .8, M(C.steel, { r: .5 })), -(X + t) - .52, .1, .39), at(box(.02, .02, .8, M(C.steel, { r: .5 })), -(X + t) - .52, .17, .39));
  g.add(at(cyl(.09, .07, .16, M(C.terraL), 10), X + t + .3, .08, -.32), at(sph(.12, M(C.leaf[1]), 8, 6), X + t + .3, .25, -.32));
  // 屋根: 片流れ(前が低く、奥が高い)。両脇の三角の壁も屋根の部品
  const rf = roofGroup(g), lo = h + .05, hi = h + .5, ov = .14, L = Math.hypot(D + ov * 2, hi - lo), ang = Math.atan2(hi - lo, D + ov * 2);
  const slope = cbox(W + .18, .055, L, M(C.zinc, { r: .75 }), .015); slope.position.set(0, (lo + hi) / 2 + .03, 0); slope.rotation.x = ang; rf.add(slope);
  for (let i = 0; i < 7; i++) { const sm = box(.02, .02, L, M(C.zincD, { r: .75 })); sm.castShadow = false; sm.position.set(-W / 2 + .1 + i * (W - .2) / 6, (lo + hi) / 2 + .065, 0); sm.rotation.x = ang; rf.add(sm); }
  const tri = new THREE.Shape(); tri.moveTo(-D / 2, 0); tri.lineTo(D / 2, 0); tri.lineTo(-D / 2, hi - lo); tri.lineTo(-D / 2, 0);
  for (const sx of [-1, 1]) { const tg = new THREE.ExtrudeGeometry(tri, { depth: t, bevelEnabled: false }); const m = sh2(new THREE.Mesh(tg, sage)); m.rotation.y = -Math.PI / 2; m.position.set(sx * (X + t / 2) + t / 2, h, 0); rf.add(m); }
  rf.add(at(box(W, hi - lo + .02, t, sage), 0, h + (hi - lo) / 2, -(Z + t / 2)));
  rf.add(at(box(W - .1, .05, D - .1, M(C.slab)), 0, h + .025 + E, 0));
  return { g, y0, fall: 'hinge', door: [.63, F + .3], top: hi + .25, foot: [[-(X + t) - .6, -F, X + t + .5, F + .3]] };
}

/* ---------- 事務所(経営・管理・脇役): 明るいガラスとスレートの縦のフィン、各階の床の線、1階のロビー、屋上テラス。重さを落とす ---------- */
function office() {
  const g = new THREE.Group(), b = BOXES.office, y0 = .08, wallM = M(C.officeWall, { r: .75 }), fin = M(C.slate, { r: .55 });
  const s = walls(g, b, wallM), { fw, X, Z, t, W, D } = s, h = b.h, fh = h / b.floors, F = Z + t;
  plinth(g, W, D, y0, M(C.stone2));
  const gw = M(C.glassWall, { r: .22 }), blind = M(C.blind), ceilM = M('#EEF0F0', { r: .5 }), hintM = M('#8F9CA6', { r: .6 }), lowM = M('#A3B1BA', { r: .6 }), rr = rng(404);
  for (let f = 0; f < 3; f++) {
    const cy = fh * f + fh * .53, ph = fh * (f === 0 ? .8 : .7);
    for (const face of ['back', 'left', 'right', 'front']) {
      const tgt = face === 'front' ? fw : g, n = 3, span = (face === 'left' || face === 'right') ? D : W;
      for (let i = 0; i < n; i++) {
        const u = (i - 1) * span / 3, pw = span / 3 - .05;
        if (face === 'front' && f === 0 && i === 1) continue;
        const solid = i === 0;   // 左の柱間は石の壁にして、細い縦の窓だけ
        const p = pane(tgt, 0, cy, 0, 1, 1, 1, { flicker: true, mode: 2, glow: 4, mat: gw });
        const off = .012, py = f === 0 ? cy - .03 : cy;
        const pw2 = solid ? .09 : pw, ph2 = solid ? ph * .92 : ph;
        if (face === 'front') { p.position.set(u, py, F + off); p.scale.set(pw2, ph2, .03); }
        if (face === 'back') { p.position.set(u, py, -F - off); p.scale.set(pw2, ph2, .03); }
        if (face === 'left') { p.position.set(-(X + t) - off, py, u); p.scale.set(.03, ph2, pw2); }
        if (face === 'right') { p.position.set(X + t + off, py, u); p.scale.set(.03, ph2, pw2); }
        if (solid) continue;
        if ((i + f) % 3 === 0 && f > 0) {
          const bl = box(1, 1, 1, blind); bl.castShadow = false; const bh = ph * (.22 + ((i * 7 + f * 3) % 3) * .1), by = cy + ph / 2 - bh / 2;
          if (face === 'front') { bl.position.set(u, by, F + off + .021); bl.scale.set(pw * .96, bh, .006); }
          if (face === 'back') { bl.position.set(u, by, -F - off - .021); bl.scale.set(pw * .96, bh, .006); }
          if (face === 'left') { bl.position.set(-(X + t) - off - .021, by, u); bl.scale.set(.006, bh, pw * .96); }
          if (face === 'right') { bl.position.set(X + t + off + .021, by, u); bl.scale.set(.006, bh, pw * .96); }
          tgt.add(bl);
        }
        // 中の気配: 天井の灯りの帯(窓と同じ番号で、窓が点いているときだけ明るい)・机の線・座っている人の影。ガラスのすぐ前の薄い板。
        // 夜は暗くなる(fx の2つめ)ので、点いた窓の中にだけ影として見える。ブラインドが下りている窓には天井の帯を付けない
        const hasBlind = (i + f) % 3 === 0 && f > 0;
        const put = (du, y, w, h, mat) => {
          const mesh = box(1, 1, 1, mat), d = off + .0185, th = .003; mesh.castShadow = false; mesh.userData.fx = [0, 1];
          if (face === 'front') { mesh.position.set(u + du, y, F + d); mesh.scale.set(w, h, th); }
          if (face === 'back') { mesh.position.set(u - du, y, -F - d); mesh.scale.set(w, h, th); }
          if (face === 'left') { mesh.position.set(-(X + t) - d, y, u + du); mesh.scale.set(th, h, w); }
          if (face === 'right') { mesh.position.set(X + t + d, y, u - du); mesh.scale.set(th, h, w); }
          tgt.add(mesh); return mesh;
        };
        if (!hasBlind) { const st = put(0, py + ph2 / 2 - ph2 * .06, pw * .9, ph2 * .05, ceilM); st.userData.fx = [6, 1]; st.userData.wid = p.userData.wid; }
        const deskY = py - ph2 / 2 + ph2 * .3, low = ph2 * (.3 - .0225);
        put(0, deskY, pw * .94, ph2 * .045, hintM);
        put(0, py - ph2 / 2 + low / 2, pw * .94, low, lowM);   // 机の手前(床の近く)は暗い: 夜は灯りが窓の上の方にだけ見える
        if (rr() < .55) { const du = (rr() - .5) * pw * .6; put(du, deskY + .062, .085, .09, hintM); put(du, deskY + .135, .046, .05, hintM); }
      }
    }
    // 床の線(各階の境。白い石の細い帯)
    if (f > 0) {
      const y = fh * f;
      g.add(at(cbox(W + .05, .045, .045, wallM, .01), 0, y, -F - .02), at(cbox(.045, .045, D + .05, wallM, .01), -(X + t) - .02, y, 0), at(cbox(.045, .045, D + .05, wallM, .01), X + t + .02, y, 0));
      fw.add(at(cbox(W + .05, .045, .045, wallM, .01), 0, y, F + .02));
    }
  }
  // 縦のフィン(スレート)。正面のものは前の壁と一緒に倒れる
  for (const k of [-1.5, -.5, .5, 1.5]) {
    const u = k * W / 3 * .99;
    fw.add(at(cbox(.035, h - .04, .085, fin, .008), u, h / 2, F + .042));
    g.add(at(cbox(.035, h - .04, .085, fin, .008), u, h / 2, -F - .042));
    g.add(at(cbox(.085, h - .04, .035, fin, .008), -(X + t) - .042, h / 2, u), at(cbox(.085, h - .04, .035, fin, .008), X + t + .042, h / 2, u));
  }
  // 1階のロビー: 背の高いガラスの扉と、薄いひさし
  pane(fw, 0, .36, F + .012, .52, .66, .03, { flicker: true, mode: 4, glow: 4, mat: M('#7D90A0', { r: .3 }) });
  fw.add(nc(at(box(.025, .66, .035, M(C.trim)), 0, .36, F + .022)));
  fw.add(at(cbox(.95, .04, .36, M(C.trim, { r: .7 }), .01), 0, .76, F + .18));
  // 屋上テラス(屋根の部品): 木の床・パーゴラ・植え込み・ベンチ・小さな木・手すり
  const rf = roofGroup(g), r = rng(31);
  rf.add(at(cbox(W + .06, .1, D + .06, M('#CFCAC1'), .015), 0, h + .05 + E, 0));
  rf.add(at(cbox(W + .08, .06, .04, wallM, .01), 0, h + .13, F + .01), at(cbox(W + .08, .06, .04, wallM, .01), 0, h + .13, -F - .01), at(cbox(.04, .06, D, wallM, .01), -(X + t) - .01, h + .13, 0), at(cbox(.04, .06, D, wallM, .01), X + t + .01, h + .13, 0));
  rf.add(at(cbox(1.2, .03, 1.1, M(C.woodL), .01), .1, h + .115, .15));
  for (const [x, z] of [[-.45, -.35], [.65, -.35], [-.45, .65], [.65, .65]]) rf.add(at(box(.03, .42, .03, M(C.wood)), x, h + .31, z));
  for (const z of [-.35, .15, .65]) rf.add(at(box(1.18, .03, .035, M(C.wood)), .1, h + .53, z));
  for (const x of [-.45, -.05, .35, .65]) rf.add(at(box(.025, .025, 1.08, M(C.woodL)), x, h + .555, .15));
  rf.add(at(rbox(1.1, .12, .3, .03, M(C.terraL)), -.1, h + .17, -.62));
  for (let i = 0; i < 4; i++) rf.add(at(sph(.11 + r() * .04, M(C.leaf[i % 4]), 9, 7), -.52 + i * .28, h + .3, -.62));
  const tr = tree(r, 'round', .45); tr.position.set(-.62, h + .1, .55); rf.add(tr);
  const bn = bench(.42); bn.position.set(.15, h + .1, .35); rf.add(bn);
  for (const [x, z, w, d] of [[0, F - .03, W - .1, .015], [-(X + t) + .03, 0, .015, D - .1], [X + t - .03, 0, .015, D - .1]]) rf.add(nc(at(box(w, .015, d, M(C.steel, { r: .5 })), x, h + .3, z)));
  return { g, y0, fall: 'hinge', door: [0, F + .3], top: h + .75, foot: [[-(X + t) - .2, -F - .2, X + t + .2, F + .2]] };
}

/* ---------- 図書館(学習・脇役): 石の柱廊(4本の柱・梁・破風)と正面の階段、緑青のドーム、街灯、読書の庭 ---------- */
function library() {
  const g = new THREE.Group(), b = BOXES.library, y0 = .22, stone = M(C.stone), col = M(C.column);
  const s = walls(g, b, stone), { fw, X, Z, t, W, D } = s, h = b.h, F = Z + t;
  g.add(at(cbox(W + .5, y0 + .01, D + .4, M(C.stone2), .018), 0, -y0 / 2 - E + .005, -.05));
  for (let i = 0; i < 3; i++) g.add(at(cbox(W - .2 - i * .1, (y0 / 3) * (3 - i), .16, M(C.stone2), .01), 0, -y0 + (y0 / 3) * (3 - i) / 2, F + .2 + .16 * i + .04));
  // 縦長の窓(石の枠)
  const winO = { flicker: true, mode: 3, glow: 5, frame: C.column };
  grid(g, 'left', W, D, h * .5, 3, 1, .5, 0, .2, .8, winO); grid(g, 'right', W, D, h * .5, 3, 1, .5, 0, .2, .8, winO);
  grid(g, 'back', W, D, h * .5, 4, 1, .5, 0, .2, .8, winO);
  // 正面: 柱廊(4本の柱・梁・破風)と扉。前の壁と一緒に倒れる
  fw.add(at(box(.5, .9, .03, M(C.wood)), 0, .45, F + .012));
  fw.add(at(cbox(.62, .06, .06, col, .01), 0, .93, F + .03));
  pane(fw, -.8, h * .55, F + .012, .22, .7, .03, winO); pane(fw, .8, h * .55, F + .012, .22, .7, .03, winO);
  for (let i = 0; i < 4; i++) { const x = -.9 + i * .6; fw.add(at(cyl(.07, .085, h - .22, col, 14), x, (h - .22) / 2 + .02, F + .32)); fw.add(at(cbox(.2, .05, .2, col, .01), x, .025, F + .32)); fw.add(at(cbox(.2, .05, .2, col, .01), x, h - .2, F + .32)); }
  fw.add(at(cbox(W + .04, .16, .5, col, .015), 0, h - .1, F + .24));
  const ped = gable(W + .04, .42, .44, col); ped.position.set(0, h - .02, F + .24); fw.add(ped);
  // 屋根と緑青のドーム
  const rf = roofGroup(g);
  // 石の帯(上の縁)。壁の上を蓋のように覆う箱なので、屋根の部品にする(ひらくと屋根と一緒に抜ける。残すと、中の上の半分をふさぐ)
  rf.add(at(cbox(W + .06, .08, D + .02, col, .012), 0, h - .04, -.01));
  rf.add(at(cbox(W + .1, .12, D + .1, M(C.stone2), .02), 0, h + .06 + E, 0));
  rf.add(at(cyl(.56, .6, .3, col, 28), 0, h + .27, -.1));
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; rf.add(at(box(.04, .26, .04, M(C.stone2)), Math.sin(a) * .585, h + .27, -.1 + Math.cos(a) * .585)); }
  rf.add(at(sh2(new THREE.Mesh(new THREE.SphereGeometry(.58, 26, 12, 0, TAU, 0, Math.PI / 2), M(C.verdigris, { r: .55 }))), 0, h + .41, -.1));
  rf.add(at(cyl(.05, .07, .16, col, 10), 0, h + 1.05, -.1), at(sph(.05, M(C.brand, { r: .5 }), 8, 6), 0, h + 1.16, -.1));
  // 街灯と、読書の庭(横のベンチと木と、低い生け垣)
  for (const x of [-(X + t) - .05, X + t + .05]) { const l = lamp(5); l.position.set(x, -y0, F + .55); g.add(l); }
  const r = rng(51);
  const bn = bench(.6); bn.position.set(-(X + t) - .55, -y0, -.2); bn.rotation.y = deg(90); g.add(bn);
  const t1 = tree(r, 'round', .9); t1.position.set(-(X + t) - .8, -y0, -.85); g.add(t1);
  const t2 = tree(r, 'round', .75); t2.position.set(X + t + .55, -y0, -.6); g.add(t2);
  const hg = hedge(1.0, M(C.leaf[2], { r: .95 }), .14, .16); hg.rotation.y = deg(90); hg.position.set(-(X + t) - .95, -y0, .25); g.add(hg);
  return { g, y0, fall: 'hinge', door: [0, F + .85], top: h + 1.2, foot: [[-(W + .5) / 2 - .5, -(D + .4) / 2 - .05, (W + .5) / 2, F + .7]] };
}

/* ---------- 公園(試す・作品): 木と芝・カフェの屋台(壁はない) ----------
   池(ふたつの波紋)・カプセルの機械・保留の棚・窓の額・ベンチと街灯は、中のモジュール(interiors.js)が持つ。
   公園だけは、中を最初から組んで町の景色に置く(形で役割が分かるように)。ここでは芝と木と屋台だけ */
export const PARK = { pond: { x: 1.15, z: .55, r: .5 }, cafe: { x: 1.45, z: -1.05 } };
function park() {
  const g = new THREE.Group(), b = BOXES.park, r = rng(71);
  g.add(tag(at(cbox(b.w, .06, b.d, M(C.lawn), .03), 0, .02, 0), { surf: true }));
  // カフェの屋台(テラコッタと生成りの日よけ)
  const cf = new THREE.Group(); cf.position.set(PARK.cafe.x, 0, PARK.cafe.z); cf.rotation.y = deg(-35);
  cf.add(at(cbox(.8, .5, .5, M(C.terraL), .02), 0, .3, 0));
  cf.add(at(cbox(.84, .04, .54, M(C.cream), .01), 0, .56, 0));
  for (let i = 0; i < 6; i++) { const s = cbox(.14, .03, .5, i % 2 ? M(C.cream) : M(C.terra, { r: .8 }), .008); s.position.set(-.35 + i * .14, .82, .12); s.rotation.x = deg(18); cf.add(s); }
  for (const x of [-.39, .39]) cf.add(at(cyl(.02, .02, .4, M(C.wood), 5), x, .7, .3));
  for (let i = 0; i < 2; i++) { const tb = new THREE.Group(); tb.position.set(-.3 + i * .6, 0, .62); tb.add(at(cyl(.12, .12, .025, M(C.trim), 14), 0, .3, 0), at(cyl(.015, .015, .3, M(C.steel), 5), 0, .15, 0)); cf.add(tb); }
  g.add(cf);
  for (const [x, z, k, s] of [[-1.8, -1.2, 'round', 1], [-1.85, -.4, 'cone', .85], [1.9, -.15, 'round', .85], [-.95, -1.35, 'ochre', .75], [-1.55, 1.2, 'shrub', 1.2], [.2, -1.35, 'shrub', 1]]) { const tr = tree(r, k, s); tr.position.set(x, .04, z); g.add(tr); }
  return { g, y0: 0, fall: 'none', door: [0, 1.2], top: 1.0, foot: [] };
}

/* ---------- アトリエ(運営者): 小さな煉瓦と木の工房・大きな窓(夜は机の灯り)・煙突の湯気・自転車・BRIDGE のマークの小さな札 ---------- */
function atelier(signs) {
  const g = new THREE.Group(), b = BOXES.atelier, y0 = .06, brick = M(C.brick, { r: .95 }), timber = M(C.timber);
  const s = walls(g, b, brick, timber), { fw, X, Z, t, W, D } = s, h = b.h, F = Z + t;
  plinth(g, W, D, y0, M(C.stone2), .1);
  // 煉瓦の目地(横の細い線)
  for (let i = 1; i < 6; i++) { const y = i * h / 6; g.add(nc(at(box(.012, .012, D, M(C.brickD)), -(X + t) - .006, y, 0)), nc(at(box(.012, .012, D, M(C.brickD)), X + t + .006, y, 0)), nc(at(box(W, .012, .012, M(C.brickD)), 0, y, -F - .006))); }
  grid(g, 'left', W, D, .7, 2, 1, .5, 0, .3, .36, { glow: 0, frame: C.timber }); grid(g, 'back', W, D, .7, 2, 1, .6, 0, .32, .36, { glow: 0, frame: C.timber });
  // 前: 木の縦の板、大きな窓(枠。夜は机の灯り)、扉、BRIDGE の札
  for (let i = 0; i < 9; i++) fw.add(nc(at(box(.012, h, .012, M('#B08E6B')), -X - t + .12 + i * .18, h / 2, F + .006)));
  const fr = M(C.frame, { r: .6 });
  pane(fw, -.28, .66, F + .014, .78, .7, .03, { glow: 5, flicker: true, mode: 4 });
  fw.add(at(box(.84, .04, .04, fr), -.28, 1.03, F + .02), at(box(.84, .04, .04, fr), -.28, .29, F + .02), at(box(.04, .76, .04, fr), -.68, .66, F + .02), at(box(.04, .76, .04, fr), .12, .66, F + .02), at(box(.025, .7, .03, fr), -.28, .66, F + .022), at(box(.78, .025, .03, fr), -.28, .66, F + .022));
  fw.add(at(box(.34, .66, .03, M(C.wood)), .5, .33, F + .012));
  signs.push({ bid: 7, part: 1, key: 'bridge', w: .3, h: .14, pos: [.5, .82, F + .03] });
  // 自転車と鉢、薪の小さな山
  const bk = bike('#3F4A57'); bk.position.set(X + t + .26, 0, .2); bk.rotation.y = deg(-90); g.add(bk);
  g.add(at(cyl(.08, .06, .14, M(C.terraL), 10), -(X + t) - .2, .07, .55), at(sph(.1, M(C.leaf[0]), 8, 6), -(X + t) - .2, .21, .55));
  for (let i = 0; i < 5; i++) { const lg = cyl(.035, .035, .34, M(i % 2 ? '#9C7B5E' : '#B28E6C', { r: .95 }), 6); lg.rotation.x = Math.PI / 2; lg.position.set(-(X + t) - .14 - (i % 3) * .075, .04 + Math.floor(i / 3) * .065, -.35); g.add(lg); }
  // 屋根(切妻・スレート)と煙突
  const rf = roofGroup(g);
  const roof = gable(W + .2, .62, D + .22, M(C.roofSlate, { r: .85 })); roof.position.y = h + E; rf.add(roof);
  rf.add(at(cbox(.2, .5, .2, brick, .015), .42, h + .5, -.25));
  rf.add(at(cbox(.24, .04, .24, M(C.stone2), .01), .42, h + .76, -.25));
  return { g, y0, fall: 'hinge', door: [.5, F + .3], top: h + .9, emit: { steam: [.42, h + .78, -.25] }, foot: [[-(X + t) - .3, -F, X + t + .4, F]] };
}

const sh2 = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; return m; };

export function buildExterior(id, signs, opt) {
  return { hospital, observatory, clinic, office, library, park, atelier }[id](signs, opt || {});
}
