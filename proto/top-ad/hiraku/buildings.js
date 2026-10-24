/* ================================================================
   融合3「ひらく町」— 建物の外側(形・小物)と、中の形のモジュールとの約束

   ■ BOXES(中の形のモジュール interiors.js が読む。BRIEF 9.9)
     原点は建物の床の中心。+Y が上、+Z が正面(ひらく側。前の壁はここで下へ倒れる)。単位は町の単位
     中は x∈[-w/2, w/2]、z∈[-d/2, d/2 - 0.04]、y∈[0, h] に収める。展望台は shape:'tower'(w は直径。中は半径 w/2 の円柱)
     正面の壁と屋根は外側(このファイル)の持ち物。側面と奥の壁の内側・床・天井の厚みは、中のモジュールが作る
     外側の壁の厚みは WALL(壁の外の面は ±(w/2 + WALL)、奥は -(d/2 + WALL)、前の壁は d/2 〜 d/2 + WALL)
     人の背の高さは PERSON_H(中の人も、この大きさに合わせる)
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

/* 中の形にも使ってよい色(ctx.palette として渡す)。落ち着いた建築模型の色と、B の温かさ */
export const PALETTE = {
  wallIn: '#F4EFE6', wallIn2: '#EAE2D4', floor: '#D9C7A8', floorStone: '#D8D2C6', ceil: '#F7F3EC',
  wood: '#C9A980', woodD: '#A88761', woodL: '#DCC5A2', steel: '#8D979F', steelL: '#C9CED2', dark: '#3A4047',
  screen: '#161B21', paper: '#FBF8F1', cork: '#C9A877', fabric: '#8C9A8A', fabric2: '#B9897A',
  glass: '#9DB4C2', plant: ['#7FA06F', '#8FB07C', '#6E9363'], pot: '#C98B6B',
  scrubs: ['#3F8B87', '#2E3C56'], coat: '#F3F1EB', office: ['#5A646E', '#2F3B4E', '#8C8F94'], casual: ['#C79B87', '#8FB1D1', '#D7C7AC', '#6F8A6A', '#B07F5F'],
  skin: ['#EECFB8', '#E0BB9B', '#CBA282'], hair: ['#2A2522', '#3D332C', '#594A3D', '#8A8278']
};

/* ================================================================
   建物の外側。どれも「原点 = 建物の床の中心、+Z = 正面」で作る(world.js が島の上に置き、外を向ける)
   返すもの: { g, y0(床の高さ = 地面からの台の高さ), fall:'hinge'|'spin'|'none', door:[x,z](人が出入りする所),
               top(いちばん高い所), emit:{ steam:[x,y,z] } }
   看板は使わず、形と色と小物で何の建物か分かるようにする。行き先の色(C の階色)は塗らない
   ================================================================ */
import { THREE, C, M, at, tag, box, rbox, cyl, sph, gable, shell, pane, grid, tree, lamp, bench, bike, deg, TAU, rng } from './kit.js';

const E = .004;                 // 中の形と面が重ならないための、すき間
const INNER = () => M(C.inner);
/* 側面・奥の壁(動かない)と、前の壁(倒れる。内側に生成りの裏張り)。窓は呼ぶ側で足す */
function walls(g, b, wallMat, frontMat) {
  const t = WALL, X = b.w / 2 + E, Z = b.d / 2 + E, h = b.h;
  g.add(at(box(t, h, 2 * Z + t, wallMat), -(X + t / 2), h / 2, -t / 2));
  g.add(at(box(t, h, 2 * Z + t, wallMat), X + t / 2, h / 2, -t / 2));
  g.add(at(box(2 * X, h, t, wallMat), 0, h / 2, -(Z + t / 2)));
  const fw = tag(new THREE.Group(), { part: 1 });
  fw.add(at(box(2 * (X + t), h, t, frontMat || wallMat), 0, h / 2, Z + t / 2));
  fw.add(at(box(2 * X - .02, h - .02, .006, INNER()), 0, h / 2, b.d / 2 - .003));
  g.add(fw);
  return { fw, X, Z, t, W: 2 * (X + t), D: 2 * (Z + t) };
}
const roofGroup = g => { const r = tag(new THREE.Group(), { part: 2 }); g.add(r); return r; };
function plinth(g, W, D, y0, mat, pad = .16) { g.add(at(box(W + pad * 2, y0, D + pad * 2, mat), 0, -y0 / 2 - E, 0)); }

/* ---------- 病院(いつもの職場): 白い建物・スクラブの青緑の帯・入口のひさし・スロープと車いす・救急の車寄せ・屋上のヘリポートと庭 ---------- */
function hospital() {
  const g = new THREE.Group(), b = BOXES.hospital, y0 = .06, white = M(C.white), band = M(C.scrub, { r: .7 });
  const s = walls(g, b, white), { fw, X, Z, t, W, D } = s, h = b.h, fh = h / b.floors;
  plinth(g, W, D, y0, M(C.curb));
  // 階の帯(青緑)と、窓
  for (const y of [fh, h - .1]) {
    g.add(at(box(W + .02, .07, .02, band), 0, y, -(Z + t) - .005), at(box(.02, .07, D - .02, band), -(X + t) - .005, y, 0), at(box(.02, .07, D - .02, band), X + t + .005, y, 0));
    fw.add(at(box(W + .02, .07, .02, band), 0, y, Z + t + .006));
  }
  for (let f = 0; f < 3; f++) {
    const cy = fh * f + fh * .52;
    grid(g, 'back', W, D, cy, 6, 1, .5, 0, .3, .36, { flicker: true });
    grid(g, 'left', W, D, cy, 4, 1, .5, 0, .3, .36, { flicker: true });
    grid(g, 'right', W, D, cy, 4, 1, .5, 0, .3, .36, { flicker: true });
    if (f > 0) grid(fw, 'front', W, D, cy, 6, 1, .5, 0, .3, .36, { flicker: true });
    else for (const x of [-1.25, -.75, .75, 1.25]) pane(fw, x, cy, Z + t + .012, .3, .36, .03, { flicker: true });
  }
  // 入口(ガラスの扉)と、ひさし(前の壁と一緒に倒れる)、扉の脇の縦の帯
  fw.add(at(box(.86, .58, .03, M(C.glassDark, { r: .3 })), 0, .3, Z + t + .012));
  fw.add(at(rbox(1.5, .055, .5, .02, M(C.trim)), 0, .72, Z + t + .25));
  fw.add(at(box(1.5, .025, .02, band), 0, .7, Z + t + .5));
  fw.add(at(box(.12, 1.7, .02, band), -.62, 1.55, Z + t + .008));
  // スロープと車いす(左の横の入口へ)
  const ramp = new THREE.Group(); ramp.position.set(-(X + t) - .34, 0, .05);
  const rp = box(.46, .05, 1.5, M(C.curb)); rp.position.set(0, -y0 + .045, .1); rp.rotation.x = deg(-2.4); ramp.add(rp);
  ramp.add(at(box(.025, .2, 1.5, M(C.steel, { r: .5 })), -.24, .06, .1), at(box(.03, .03, 1.5, M(C.steel, { r: .5 })), -.24, .17, .1));
  const chair = new THREE.Group(); chair.position.set(.03, .02, .45); chair.rotation.y = deg(180);
  for (const sx of [-.09, .09]) { const w = sh2(new THREE.Mesh(new THREE.TorusGeometry(.085, .014, 5, 14), M(C.tire))); w.rotation.y = Math.PI / 2; w.position.set(sx, .09, -.02); chair.add(w); }
  chair.add(at(box(.17, .025, .15, M('#5C6773')), 0, .14, 0), at(box(.17, .14, .02, M('#5C6773')), 0, .22, -.07));
  ramp.add(chair);
  g.add(ramp);
  g.add(at(box(.03, .55, .5, M(C.glassDark, { r: .3 })), -(X + t) - .01, .3, .55));
  // 救急の車寄せ(右の低い棟と、柱の上のひさし)
  const er = new THREE.Group(); er.position.set(X + t, 0, .2);
  er.add(at(rbox(1.0, .95, 1.5, .04, white), .5, .475, 0));
  er.add(at(box(1.02, .07, 1.52, band), .5, .9, 0));
  er.add(at(rbox(1.08, .06, 1.58, .02, M(C.slab)), .5, .97, 0));
  er.add(at(box(.03, .55, .7, M(C.glassDark, { r: .3 })), 1.01, .3, .1));
  er.add(at(rbox(1.3, .05, 1.2, .02, M(C.trim)), 1.6, .78, .1));
  for (const z of [-.42, .62]) er.add(at(cyl(.025, .025, .78, M(C.steel, { r: .5 }), 8), 2.2, .39, z));
  er.add(at(box(1.0, .012, .9, M('#E8E0D0')), 1.6, -y0 + .012, .1));
  g.add(er);
  // 屋上: ヘリポートと庭(屋根と一緒に持ち上がる)
  const rf = roofGroup(g);
  rf.add(at(rbox(W + .08, .1, D + .08, .03, M(C.slab)), 0, h + .05 + E, 0));
  rf.add(at(box(W + .1, .06, .05, M(C.trim)), 0, h + .13, Z + t + .02), at(box(W + .1, .06, .05, M(C.trim)), 0, h + .13, -(Z + t) - .02));
  rf.add(at(box(.05, .06, D + .1, M(C.trim)), -(X + t) - .02, h + .13, 0), at(box(.05, .06, D + .1, M(C.trim)), X + t + .02, h + .13, 0));
  rf.add(at(cyl(.62, .62, .04, M('#CFD3D5'), 28), .62, h + .13, .1));
  const ring = sh2(new THREE.Mesh(new THREE.TorusGeometry(.5, .028, 5, 32), M('#E2C462', { r: .7 })), false); ring.rotation.x = -Math.PI / 2; ring.position.set(.62, h + .155, .1); rf.add(ring);
  const hm = M('#FFFFFF');
  rf.add(at(box(.05, .015, .34, hm), .5, h + .158, .1), at(box(.05, .015, .34, hm), .74, h + .158, .1), at(box(.24, .015, .05, hm), .62, h + .158, .1));
  const r = rng(12);
  rf.add(at(rbox(1.0, .12, .55, .03, M(C.terraL)), -.85, h + .16, -.45));
  for (let i = 0; i < 3; i++) rf.add(at(sph(.15 + r() * .05, M(C.leaf[i]), 9, 7), -1.2 + i * .33, h + .3, -.45));
  const tr = tree(r, 'round', .55); tr.position.set(-.85, h + .1, .35); rf.add(tr);
  rf.add(at(rbox(.42, .26, .34, .03, M(C.machine)), .1, h + .23, -.7));
  return { g, y0, fall: 'hinge', door: [0, Z + t + .35], side: [-(X + t) - .34, 1.0], er: [X + t + 1.6, .3], top: h + .5 };
}

/* ---------- 展望台(キャリアの地図): 砂色の塔に藍のドーム(ブランドの2色)・回るドームと遠くを向く望遠鏡・らせんの外階段・根元の道しるべ ---------- */
function observatory() {
  const g = new THREE.Group(), b = BOXES.observatory, y0 = .12, h = b.h, R0 = b.w / 2 + E, R1 = R0 + WALL;
  const sand = M(C.sandTower), sandD = M(C.sandTowerD);
  g.add(at(cyl(1.05, 1.12, y0, M(C.stone2), 32), 0, -y0 / 2 - E, 0));
  g.add(shell(R0, R1, h, deg(90), deg(270), sand, 22));
  // 前の半分は、塔のまわりを回って奥へ(扉のように開く)
  const front = tag(new THREE.Group(), { part: 1 });
  front.add(shell(R1 + .006, R1 + .08, h, deg(-90), deg(90), sand, 22));
  front.add(shell(R0, R0 + .006, h - .02, deg(-88), deg(88), INNER(), 18));
  g.add(front);
  // 帯と細い窓
  for (const y of [h * .33, h * .66]) { g.add(shellBand(R1, y, deg(90), deg(270), sandD)); front.add(shellBand(R1 + .08, y, deg(-90), deg(90), sandD)); }
  for (const [a, y] of [[0, .9], [deg(35), 2.3], [deg(-30), 3.5], [deg(150), 1.6], [deg(210), 2.9], [deg(180), .9]]) {
    const r = a > deg(90) && a < deg(270) ? R1 + .012 : R1 + .09, p = pane(a > deg(90) && a < deg(270) ? g : front, Math.sin(a) * r, y, Math.cos(a) * r, .1, .3, .03, { flicker: true });
    p.rotation.y = a;
  }
  front.add(at(box(.3, .55, .03, M(C.wood)), 0, .28, R1 + .09));
  // 上: 見晴らしの回廊と手すり、窓の帯の太鼓、回る藍のドームと望遠鏡(屋根と一緒に持ち上がる)
  const rf = roofGroup(g);
  rf.add(at(cyl(.98, .9, .1, M(C.stone2), 32), 0, h + .05, 0));
  const rail = sh2(new THREE.Mesh(new THREE.TorusGeometry(.95, .018, 5, 40), M('#FFFFFF'))); rail.rotation.x = -Math.PI / 2; rail.position.y = h + .36; rf.add(rail);
  for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; rf.add(at(cyl(.012, .012, .26, M('#FFFFFF'), 4), Math.sin(a) * .95, h + .23, Math.cos(a) * .95)); }
  rf.add(at(cyl(.6, .6, .32, sand, 28), 0, h + .26, 0));
  const band = cyl(.61, .61, .14, M(C.glass, { r: .3 }), 28); band.position.y = h + .28; band.userData.fx = [1, 1]; rf.add(band);
  const dome = tag(new THREE.Group(), { part: 52 });
  dome.add(at(sh2(new THREE.Mesh(new THREE.SphereGeometry(.64, 26, 12, 0, TAU, 0, Math.PI / 2), M(C.indigo, { r: .45 }))), 0, h + .42, 0));
  dome.add(at(box(.14, .5, .02, M(C.indigoD, { r: .5 })), 0, h + .7, .56));
  const tel = cyl(.05, .07, .62, M('#E8E4DC', { r: .5 }), 10); tel.rotation.x = deg(62); tel.position.set(0, h + .88, .5); dome.add(tel);
  dome.add(at(cyl(.016, .016, .34, M('#FFFFFF'), 5), 0, h + 1.2, 0));
  rf.add(dome);
  // らせんの外階段(奥の左に、柱のまわりを巻いて回廊まで)
  const st = new THREE.Group(); st.position.set(Math.sin(deg(215)) * 1.12, 0, Math.cos(deg(215)) * 1.12);
  st.add(at(cyl(.035, .035, h + .1, M(C.steel, { r: .5 }), 8), 0, h / 2, 0));
  const n = 26;
  for (let i = 0; i < n; i++) { const a = i / n * TAU * 2.2, y = .12 + i / (n - 1) * (h - .1), s = box(.28, .03, .1, M(C.stone2)); s.position.set(Math.sin(a) * .16, y, Math.cos(a) * .16); s.rotation.y = a + Math.PI / 2; st.add(s); }
  g.add(st);
  // 根元の道しるべ(行き先を指す3枚の板)
  const sp = new THREE.Group(); sp.position.set(1.05, 0, .75);
  sp.add(at(cyl(.03, .035, .9, M(C.wood), 6), 0, .45, 0));
  [[.78, 30, .36], [.64, -40, .3], [.5, 160, .34]].forEach(([y, a, l]) => { const p = box(l, .085, .025, M(C.woodL)); p.position.set(Math.cos(deg(a)) * l / 2, y, -Math.sin(deg(a)) * l / 2); p.rotation.y = deg(a); sp.add(p); });
  g.add(sp);
  return { g, y0, fall: 'spin', door: [0, R1 + .4], top: h + 1.4 };
}
function shellBand(r, y, a0, a1, mat) { const m = shell(r, r + .012, .06, a0, a1, mat, 22); m.position.y = y; return m; }

/* ---------- クリニック(経営を学ぶ): セージの壁・テラコッタと生成りの縞のひさし・「診療中」の札・待合のベンチ・自転車・自動ドア ---------- */
function clinic(signs) {
  const g = new THREE.Group(), b = BOXES.clinic, y0 = .06, sage = M(C.sage), cream = M(C.cream);
  const s = walls(g, b, sage), { fw, X, Z, t, W, D } = s, h = b.h;
  plinth(g, W, D, y0, M(C.curb));
  for (const y of [.05, h - .05]) {
    g.add(at(box(W + .02, .08, .02, cream), 0, y, -(Z + t) - .005), at(box(.02, .08, D, cream), -(X + t) - .005, y, 0), at(box(.02, .08, D, cream), X + t + .005, y, 0));
    fw.add(at(box(W + .02, .08, .02, cream), 0, y, Z + t + .006));
  }
  grid(g, 'left', W, D, .58, 2, 1, .52, 0, .36, .36, { flicker: true }); grid(g, 'right', W, D, .58, 2, 1, .52, 0, .36, .36, { flicker: true });
  grid(g, 'back', W, D, .6, 3, 1, .6, 0, .34, .32, { flicker: true });
  // 前: 大きな窓2つ・縞のひさし・自動ドア(左右に開く)・「診療中」の札
  pane(fw, -.62, .56, Z + t + .012, .5, .42, .03, { flicker: true }); pane(fw, -.05, .56, Z + t + .012, .5, .42, .03, { flicker: true });
  for (let i = 0; i < 9; i++) { const st = rbox(.13, .03, .36, .01, i % 2 ? cream : M(C.terra, { r: .8 })); st.position.set(-.86 + i * .127, .86, Z + t + .15); st.rotation.x = deg(22); fw.add(st); }
  fw.add(at(box(.66, .7, .02, M(C.white2)), .62, .37, Z + t + .006));
  const dl = tag(at(box(.26, .58, .02, M(C.glass, { r: .25 })), .5, .31, Z + t + .02), { part: 61 }), dr = tag(at(box(.26, .58, .02, M(C.glass, { r: .25 })), .76, .31, Z + t + .02), { part: 71 });
  dl.userData.fx = [1, 1]; dr.userData.fx = [1, 1];
  fw.add(dl, dr);
  fw.add(at(box(.7, .05, .2, M(C.trim)), .63, .74, Z + t + .1));
  signs.push({ bid: 3, part: 1, key: 'shinryo', w: .22, h: .11, pos: [.63, .58, Z + t + .036] });
  // 外: 待合のベンチ・自転車・鉢
  const bn = bench(.6); bn.position.set(X + t + .38, 0, .55); bn.rotation.y = deg(-90); g.add(bn);
  const bk = bike('#5E6B62'); bk.position.set(-(X + t) - .3, 0, .45); bk.rotation.y = deg(90); g.add(bk);
  g.add(at(cyl(.09, .07, .16, M(C.terraL), 10), X + t + .3, .08, -.15), at(sph(.12, M(C.leaf[1]), 8, 6), X + t + .3, .25, -.15));
  // 屋根(平らな屋根と縁)
  const rf = roofGroup(g);
  rf.add(at(rbox(W + .16, .08, D + .16, .03, cream), 0, h + .04 + E, 0));
  rf.add(at(rbox(.5, .14, .4, .03, M(C.machine)), -.4, h + .15, -.25));
  return { g, y0, fall: 'hinge', door: [.63, Z + t + .3], top: h + .3 };
}

/* ---------- 事務所(経営・管理): ガラスの外壁とスレートの枠・ブラインド・屋上の小さな庭 ---------- */
function office() {
  const g = new THREE.Group(), b = BOXES.office, y0 = .08, slate = M(C.slate, { r: .6 });
  const s = walls(g, b, slate), { fw, X, Z, t, W, D } = s, h = b.h, fh = h / b.floors;
  plinth(g, W, D, y0, M(C.stone2));
  const gw = M(C.glassWall, { r: .25 }), blind = M(C.blind);
  for (let f = 0; f < 3; f++) {
    const cy = fh * f + fh * .55, ph = fh * .74;
    for (const face of ['back', 'left', 'right', 'front']) {
      const tgt = face === 'front' ? fw : g, n = 3, span = (face === 'left' || face === 'right') ? D : W;
      for (let i = 0; i < n; i++) {
        const u = (i - 1) * span / 3, pw = span / 3 - .07;
        if (face === 'front' && f === 0 && i === 1) continue;
        const p = pane(tgt, 0, cy, 0, 1, 1, 1, { flicker: true, mat: gw });
        const off = .012;
        if (face === 'front') { p.position.set(u, cy, Z + t + off); p.scale.set(pw, ph, .03); }
        if (face === 'back') { p.position.set(u, cy, -(Z + t) - off); p.scale.set(pw, ph, .03); }
        if (face === 'left') { p.position.set(-(X + t) - off, cy, u); p.scale.set(.03, ph, pw); }
        if (face === 'right') { p.position.set(X + t + off, cy, u); p.scale.set(.03, ph, pw); }
        // ブラインド(窓の上の方を、明るい帯で)
        if ((i + f) % 2 === 0) {
          const bl = box(1, 1, 1, blind); bl.castShadow = false; const bh = ph * (.25 + ((i * 7 + f * 3) % 4) * .1), by = cy + ph / 2 - bh / 2;
          if (face === 'front') { bl.position.set(u, by, Z + t + off + .012); bl.scale.set(pw * .96, bh, .006); }
          if (face === 'back') { bl.position.set(u, by, -(Z + t) - off - .012); bl.scale.set(pw * .96, bh, .006); }
          if (face === 'left') { bl.position.set(-(X + t) - off - .012, by, u); bl.scale.set(.006, bh, pw * .96); }
          if (face === 'right') { bl.position.set(X + t + off + .012, by, u); bl.scale.set(.006, bh, pw * .96); }
          tgt.add(bl);
        }
      }
    }
  }
  // 入口(ガラスの扉と、薄いひさし)
  fw.add(at(box(.5, .62, .03, M(C.glassDark, { r: .3 })), 0, .33, Z + t + .012));
  fw.add(at(rbox(.9, .04, .34, .015, M(C.trim)), 0, .74, Z + t + .17));
  // 屋上の小さな庭
  const rf = roofGroup(g), r = rng(31);
  rf.add(at(rbox(W + .06, .1, D + .06, .03, M('#C9C4BC')), 0, h + .05 + E, 0));
  rf.add(at(box(W + .06, .08, .04, slate), 0, h + .14, Z + t + .01), at(box(W + .06, .08, .04, slate), 0, h + .14, -(Z + t) - .01), at(box(.04, .08, D, slate), -(X + t) - .01, h + .14, 0), at(box(.04, .08, D, slate), X + t + .01, h + .14, 0));
  rf.add(at(rbox(1.1, .12, .42, .03, M(C.terraL)), -.2, h + .17, -.4));
  for (let i = 0; i < 4; i++) rf.add(at(sph(.13 + r() * .05, M(C.leaf[i % 4]), 9, 7), -.62 + i * .28, h + .32, -.4));
  const tr = tree(r, 'round', .5); tr.position.set(.55, h + .1, .45); rf.add(tr);
  const bn = bench(.45); bn.position.set(-.3, h + .1, .4); rf.add(bn);
  return { g, y0, fall: 'hinge', door: [0, Z + t + .3], top: h + .55 };
}

/* ---------- 図書館(学習): 石の柱と緑青のドーム・正面の階段・街灯・読書の庭 ---------- */
function library() {
  const g = new THREE.Group(), b = BOXES.library, y0 = .22, stone = M(C.stone), col = M(C.column);
  const s = walls(g, b, stone), { fw, X, Z, t, W, D } = s, h = b.h;
  g.add(at(rbox(W + .5, y0, D + .4, .02, M(C.stone2)), 0, -y0 / 2 - E, -.05));
  for (let i = 0; i < 3; i++) g.add(at(box(W - .2 - i * .1, (y0 / 3) * (3 - i), .16, M(C.stone2)), 0, -y0 + (y0 / 3) * (3 - i) / 2, Z + t + .2 + .16 * i + .04));
  // 縦長の窓
  grid(g, 'left', W, D, h * .5, 3, 1, .5, 0, .2, .8, { flicker: true }); grid(g, 'right', W, D, h * .5, 3, 1, .5, 0, .2, .8, { flicker: true });
  grid(g, 'back', W, D, h * .5, 4, 1, .5, 0, .2, .8, { flicker: true });
  // 正面: 柱廊(4本の柱・梁・破風)と扉。前の壁と一緒に倒れる
  fw.add(at(box(.5, .9, .03, M(C.wood)), 0, .45, Z + t + .012));
  pane(fw, -.8, h * .55, Z + t + .012, .22, .7, .03, { flicker: true }); pane(fw, .8, h * .55, Z + t + .012, .22, .7, .03, { flicker: true });
  for (let i = 0; i < 4; i++) fw.add(at(cyl(.075, .09, h - .2, col, 14), -.9 + i * .6, (h - .2) / 2, Z + t + .32));
  fw.add(at(box(W + .04, .16, .5, col), 0, h - .12, Z + t + .24));
  const ped = gable(W + .04, .42, .44, col); ped.position.set(0, h - .04, Z + t + .24); fw.add(ped);
  // 屋根と緑青のドーム
  const rf = roofGroup(g);
  rf.add(at(rbox(W + .1, .12, D + .1, .03, M(C.stone2)), 0, h + .06 + E, 0));
  rf.add(at(cyl(.56, .6, .3, col, 28), 0, h + .27, -.1));
  rf.add(at(sh2(new THREE.Mesh(new THREE.SphereGeometry(.58, 26, 12, 0, TAU, 0, Math.PI / 2), M(C.verdigris, { r: .55 }))), 0, h + .41, -.1));
  rf.add(at(cyl(.05, .07, .16, col, 10), 0, h + 1.05, -.1), at(sph(.05, M(C.brand, { r: .5 }), 8, 6), 0, h + 1.16, -.1));
  // 街灯と、読書の庭(横のベンチと木)
  for (const x of [-(X + t) - .05, X + t + .05]) { const l = lamp(1); l.position.set(x, 0, Z + t + .55); g.add(l); }
  const r = rng(51);
  const bn = bench(.6); bn.position.set(-(X + t) - .55, 0, -.2); bn.rotation.y = deg(90); g.add(bn);
  const t1 = tree(r, 'round', .9); t1.position.set(-(X + t) - .75, 0, -.85); g.add(t1);
  const t2 = tree(r, 'round', .75); t2.position.set(X + t + .55, 0, -.6); g.add(t2);
  return { g, y0, fall: 'hinge', door: [0, Z + t + .85], top: h + 1.2 };
}

/* ---------- 公園(試す・作品): 木と芝・カフェの屋台(壁はない) ----------
   池(ふたつの波紋)・カプセルの機械・保留の棚・窓の額・ベンチと街灯は、中のモジュール(interiors.js)が持つ。
   公園だけは、中を最初から組んで町の景色に置く(形で役割が分かるように)。ここでは芝と木と屋台だけ */
export const PARK = { pond: { x: 1.15, z: .55, r: .5 }, cafe: { x: 1.45, z: -1.05 } };
function park() {
  const g = new THREE.Group(), b = BOXES.park, r = rng(71);
  g.add(at(rbox(b.w, .06, b.d, .5, M(C.lawn)), 0, .02, 0));
  // カフェの屋台(テラコッタと生成りの日よけ)
  const cf = new THREE.Group(); cf.position.set(PARK.cafe.x, 0, PARK.cafe.z); cf.rotation.y = deg(-35);
  cf.add(at(rbox(.8, .5, .5, .04, M(C.terraL)), 0, .3, 0));
  cf.add(at(box(.82, .04, .52, M(C.cream)), 0, .56, 0));
  for (let i = 0; i < 6; i++) { const s = rbox(.14, .03, .5, .01, i % 2 ? M(C.cream) : M(C.terra, { r: .8 })); s.position.set(-.35 + i * .14, .82, .12); s.rotation.x = deg(18); cf.add(s); }
  for (const x of [-.39, .39]) cf.add(at(cyl(.02, .02, .4, M(C.wood), 5), x, .7, .3));
  for (let i = 0; i < 2; i++) { const tb = new THREE.Group(); tb.position.set(-.3 + i * .6, 0, .62); tb.add(at(cyl(.12, .12, .025, M(C.trim), 14), 0, .3, 0), at(cyl(.015, .015, .3, M(C.steel), 5), 0, .15, 0)); cf.add(tb); }
  g.add(cf);
  for (const [x, z, k, s] of [[-1.8, -1.2, 'round', 1], [-1.85, -.4, 'cone', .85], [1.9, -.15, 'round', .85], [-.95, -1.35, 'ochre', .75]]) { const tr = tree(r, k, s); tr.position.set(x, .04, z); g.add(tr); }
  return { g, y0: 0, fall: 'none', door: [0, 1.2], top: 1.0 };
}

/* ---------- アトリエ(運営者): 小さな煉瓦と木の工房・大きな窓・煙突の湯気・自転車・BRIDGE のマークの小さな札 ---------- */
function atelier(signs) {
  const g = new THREE.Group(), b = BOXES.atelier, y0 = .06, brick = M(C.brick, { r: .95 }), timber = M(C.timber);
  const s = walls(g, b, brick, timber), { fw, X, Z, t, W, D } = s, h = b.h;
  plinth(g, W, D, y0, M(C.stone2), .1);
  // 煉瓦の目地(横の細い線)
  for (let i = 1; i < 6; i++) { const y = i * h / 6; g.add(at(box(.012, .012, D, M(C.brickD)), -(X + t) - .006, y, 0), at(box(.012, .012, D, M(C.brickD)), X + t + .006, y, 0), at(box(W, .012, .012, M(C.brickD)), 0, y, -(Z + t) - .006)); }
  grid(g, 'left', W, D, .7, 2, 1, .5, 0, .3, .36, { flicker: true }); grid(g, 'back', W, D, .7, 2, 1, .6, 0, .32, .36, { flicker: true });
  // 前: 木の縦の板、大きな窓(枠)、扉、BRIDGE の札
  for (let i = 0; i < 9; i++) fw.add(at(box(.012, h, .012, M('#B38D66')), -X - t + .12 + i * .18, h / 2, Z + t + .006));
  const fr = M(C.frame, { r: .6 });
  pane(fw, -.28, .66, Z + t + .014, .78, .7, .03, { glow: 1 });
  fw.add(at(box(.84, .04, .04, fr), -.28, 1.03, Z + t + .02), at(box(.84, .04, .04, fr), -.28, .29, Z + t + .02), at(box(.04, .76, .04, fr), -.68, .66, Z + t + .02), at(box(.04, .76, .04, fr), .12, .66, Z + t + .02), at(box(.025, .7, .03, fr), -.28, .66, Z + t + .022), at(box(.78, .025, .03, fr), -.28, .66, Z + t + .022));
  fw.add(at(box(.34, .66, .03, M(C.wood)), .5, .33, Z + t + .012));
  signs.push({ bid: 7, part: 1, key: 'bridge', w: .3, h: .14, pos: [.5, .82, Z + t + .03] });
  // 自転車と鉢
  const bk = bike('#3F4A57'); bk.position.set(X + t + .26, 0, .2); bk.rotation.y = deg(-90); g.add(bk);
  g.add(at(cyl(.08, .06, .14, M(C.terraL), 10), -(X + t) - .2, .07, .55), at(sph(.1, M(C.leaf[0]), 8, 6), -(X + t) - .2, .21, .55));
  // 屋根(切妻・スレート)と煙突
  const rf = roofGroup(g);
  const roof = gable(W + .2, .62, D + .22, M(C.roofSlate, { r: .85 })); roof.position.y = h + E; rf.add(roof);
  rf.add(at(rbox(.2, .5, .2, .02, brick), .42, h + .5, -.25));
  return { g, y0, fall: 'hinge', door: [.5, Z + t + .3], top: h + .9, emit: { steam: [.42, h + .78, -.25] } };
}

const sh2 = (m, cast = true) => { m.castShadow = cast; m.receiveShadow = true; return m; };

export function buildExterior(id, signs) {
  return { hospital, observatory, clinic, office, library, park, atelier }[id](signs);
}
