/* ================================================================
   BRIDGE「PASSAGE」(仮題)— 15.000 秒・60fps・時刻 t だけで 1 枚が決まる
   白い建築模型のような空間を、カメラが止まらずに通り抜ける。
   部屋は 個人 → チーム → 組織 の順に大きくなり、独立した壁(バッフル)に実在の道具の画面が1枚ずつはまっている。
   壁の両脇はどちらも通れる(選ばなかった道も奥へ続いて見える)。
   最後の広間でカメラが横へ滑って一点に着くと、建築のあちこちに塗られていた藍の断片が一本の弧に揃い、
   手前に固定された砂の板と交差してロゴになる(交差するが、接続しない)。
   動くのはカメラだけ。建築・写し・藍・砂はどれも動かない。
   規則の全文は film/passage/STORYBOARD.md。要点:
   - 色はトークンの値だけ(TOK)。面は世界に固定した光の向きで4段の平塗り。陰影・影・霧・グロー・粒子なし
   - 写しは加工しない(照明を当てない・縦横比そのまま・色補正なし)。読ませるのは同時に1枚
   - 藍はロゴの断片だけ。画面が描く砂はロゴの砂の板1か所だけ
   - カメラ: 焦点距離固定・ロール0・ピッチ0(鉛直線は鉛直のまま)。構図はレンズシフト
   ================================================================ */
(async function () {
  'use strict';
  const F = window.FilmEngine, T = window.THREE;
  const { clamp, EASE, seg } = F;
  const Q = new URLSearchParams(location.search);
  const W = +(Q.get('w') || 1920), H = +(Q.get('h') || 1080);
  const FPS = 60, DUR = 15;
  const RENDER = Q.has('render');
  const COPY = Q.get('copy') === '1';          // 和文の一文(判断待ち)。既定は出さない

  /* ---- トークン(shared/bridge.css のライトの値)。ここ以外で色を書かない ---- */
  const TOK = {
    bg: '#FBFAF7', bg2: '#F4EFE6', bg3: '#EAE2D3', card: '#FFFFFF',
    ink: '#1B1B1E', ink2: '#45464C', ink3: '#63646B',
    navy: '#16233E', dawn: '#A98F63',
  };

  /* ---- 画面 ---- */
  const canvas = document.getElementById('c');
  canvas.width = W; canvas.height = H;
  const R = F.createRenderer({ canvas, W, H });
  const renderer = R.renderer;

  /* ---- フォント(読み込みを確かめてから文字の板を作る) ---- */
  const FONTS = [
    ['700 64px "Noto Sans JP"', 'BRIDGE Compass経験の棚卸し掲示じたくクリニックタウン3DConsultSim'],
    ['500 64px "Inter"', 'BRIDGE Compass ConsultSim 3D EXPAND CHOICES.'],
    ['600 64px "Shippori Mincho B1"', '人は、もっと選べる'],
  ];
  await document.fonts.ready;
  for (const [f, s] of FONTS) await document.fonts.load(f, s);

  /* ================================================================
     建築(単位 m。モジュール M = 0.4。x=右、y=上、z=手前。カメラはおおむね -z へ進む)
     ================================================================ */
  const M = 0.4, EYE = 1.4;
  const scene = new T.Scene();
  scene.background = new T.Color(TOK.bg);                 // クリアは符号化を通らないので、sRGB の値のまま渡す
  const SUN = new T.Vector3(-0.55, 0, 0.83).normalize();   // 光は左手前から(世界に固定。カメラが回っても面の色は変わらない)

  /* ---- 最終の視点 V ---- */
  const FOV_H = 65.5;                                       // 28mm 相当(横)
  const vfov = (w, h) => 2 * Math.atan(Math.tan(FOV_H * Math.PI / 360) * h / w) * 180 / Math.PI;
  const VPOS = new T.Vector3(4.0, EYE, -38.4), VYAW = 0.0;   // 広間の右寄りから、まっすぐ奥を見る
  const V = new T.PerspectiveCamera(vfov(W, H), W / H, 0.1, 400);
  V.position.copy(VPOS); V.rotation.set(0, VYAW, 0, 'YXZ'); V.updateMatrixWorld(); V.updateProjectionMatrix();

  /* ---- ロゴ(正式: shared/bridge.js 31–32 行)。最終フレームでのマークの置き場(px) ---- */
  const LOGO_N = [[8, 74], [62, 16], [118, 24], [176, 84]];
  const LOGO_S = [[58, 94], [118, 60], [158, 22], [232, 12]];
  const bez = (p, u) => { const a = 1 - u; return [a * a * a * p[0][0] + 3 * a * a * u * p[1][0] + 3 * a * u * u * p[2][0] + u * u * u * p[3][0], a * a * a * p[0][1] + 3 * a * a * u * p[1][1] + 3 * a * u * u * p[2][1] + u * u * u * p[3][1]]; };
  const MARK = { cx: 0.5 * W, cy: 0.392 * H, s: 0.38 * W / 240 };     // マークの中心(viewBox の 120,53)と倍率
  const vb2px = (x, y) => [MARK.cx + (x - 120) * MARK.s, MARK.cy + (y - 53) * MARK.s];
  const NSEG = 64;
  const navyPts = []; for (let i = 0; i <= NSEG; i++) { const q = bez(LOGO_N, i / NSEG); navyPts.push(new T.Vector2(q[0], q[1])); }

  /* ---- 面の塗り: 世界に固定した光の向きで4段 + 最終の視点から見える面にだけ藍の弧(Varini の方式) ---- */
  const distRT = new T.WebGLRenderTarget(W * 2, H * 2, { type: T.FloatType, format: T.RGBAFormat, minFilter: T.NearestFilter, magFilter: T.NearestFilter });
  const PAINT = {
    vp: { value: new T.Matrix4() }, eye: { value: new T.Vector3() }, dmap: { value: distRT.texture },
    pts: { value: navyPts }, mark: { value: new T.Vector3(MARK.cx, MARK.cy, MARK.s) }, res: { value: new T.Vector2(W, H) },
    hw: { value: 3.0 }, on: { value: 0 }, ink: { value: F.lin(TOK.navy) }, topMode: { value: 0 }, cTop: { value: F.lin(TOK.ink3) },
  };
  const ARCH_VS = 'varying vec3 wp; varying vec3 wn; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); wp = w.xyz; wn = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }';
  const ARCH_FS = `
    uniform vec3 cBg, cCard, cBg2, cBg3, sun; uniform float force; uniform float topMode; uniform vec3 cTop;
    uniform mat4 vp; uniform vec3 eye; uniform sampler2D dmap; uniform vec2 pts[${NSEG + 1}]; uniform vec3 mark; uniform vec2 res; uniform float hw; uniform float on; uniform vec3 ink;
    varying vec3 wp; varying vec3 wn;
    float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
    void main(){
      vec3 n = normalize(wn); vec3 c;
      if (force > -0.5) { c = force < 0.5 ? cBg : force < 1.5 ? cCard : force < 2.5 ? cBg2 : cBg3; }
      else if (n.y > 0.5) c = topMode > 0.5 ? cTop : cBg; else if (n.y < -0.5) c = cBg3; else c = dot(n, sun) > 0.0 ? cCard : cBg2;
      if (on > 0.5) {
        vec4 cp = vp * vec4(wp, 1.0);
        if (cp.w > 0.0) {
          vec3 nd = cp.xyz / cp.w;
          if (abs(nd.x) < 1.0 && abs(nd.y) < 1.0) {
            vec2 uv = nd.xy * 0.5 + 0.5;
            vec2 tx = 1.0 / (2.0 * res); float d = 0.0;                 // 隣の 3×3 の最大(遮る縁で塗り残しを出さない)
            for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) d = max(d, texture2D(dmap, uv + vec2(float(i), float(j)) * tx).r);
            float z = distance(wp, eye);
            vec2 px = vec2(uv.x * res.x, (1.0 - uv.y) * res.y);
            vec2 vb = (px - mark.xy) / mark.z + vec2(120.0, 53.0);
            if (z <= d * 1.003 + 0.02 && vb.x > 0.0 && vb.x < 184.0 && vb.y > 26.0 && vb.y < 92.0) {   // 藍の線の外接箱の外は計算しない
              float dist = 1e9;
              for (int i = 0; i < ${NSEG}; i++) dist = min(dist, sdSeg(vb, pts[i], pts[i + 1]));
              float aa = min(fwidth(dist) * 0.75, 0.6);   // 細い面(視線に沿う側面の1画素の筋)で微分が跳ねて塗りが薄くならないよう上限を置く
              c = mix(c, ink, 1.0 - smoothstep(hw - aa, hw + aa, dist));
            }
          }
        }
      }
      gl_FragColor = linearToOutputTexel(vec4(c, 1.0));   // 描画先(sRGB 8bit)へ符号化して書く
    }`;
  function archMat(force = -1) {
    return new T.ShaderMaterial({
      uniforms: { cBg: { value: F.lin(TOK.bg) }, cCard: { value: F.lin(TOK.card) }, cBg2: { value: F.lin(TOK.bg2) }, cBg3: { value: F.lin(TOK.bg3) }, sun: { value: SUN }, force: { value: force }, ...PAINT },
      vertexShader: ARCH_VS, fragmentShader: ARCH_FS, extensions: { derivatives: true },
    });
  }
  const MAT = { auto: archMat(), bg3: archMat(3), floor: archMat(2) };   // 床は --bg-2(光に向く壁 --card との段差を ΔL* 5 以上に)

  /* 箱: 床の上の中心 (x, z)、幅 w(x)、奥行き d(z)、高さ h、下端 y0、y 軸まわりの回転 ry */
  const boxes = [];
  function box(x, z, w, d, h, y0 = 0, ry = 0, mat = MAT.auto) {
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    m.position.set(x, y0 + h / 2, z); m.rotation.y = ry;
    scene.add(m); boxes.push(m); return m;
  }
  /* x 方向の壁(z は一定)。x0..x1 の区間を、開口 [a,b] の分だけ抜いて並べる */
  function wallX(z, x0, x1, h, openings = [], th = M) {
    let cur = x0;
    for (const [a, b, lintelY] of [...openings].sort((p, q) => p[0] - q[0])) {
      if (a > cur) box((cur + a) / 2, z, a - cur, th, h);
      if (lintelY != null && lintelY < h) box((a + b) / 2, z, b - a, th, h - lintelY, lintelY);
      cur = b;
    }
    if (x1 > cur) box((cur + x1) / 2, z, x1 - cur, th, h);
  }
  function wallZ(x, z0, z1, h, th = M) { box(x, (z0 + z1) / 2, th, Math.abs(z1 - z0), h); }

  /* ---- 写し(実画面)。照明を当てない。縦横比そのまま。バッフルの開口に見込み 1M で納める ---- */
  const plates = [];
  async function plate({ src, name, x, z, y = 1.5, w = 3.2, ry = 0, bafW = null, bafH = 3.2 }) {
    const tex = await F.imageTexture(src, renderer);
    const img = tex.image; const h = w * img.height / img.width;
    const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = ry; scene.add(g);
    const BW = bafW || w + 2 * M, TH = M, BH = Math.max(bafH, y + h / 2 + M);
    const add = (bx, by, bw, bh, bd) => { const m = new T.Mesh(new T.BoxGeometry(bw, bh, bd), MAT.auto); m.position.set(bx, by, 0); g.add(m); boxes.push(m); return m; };
    const x0 = -w / 2, x1 = w / 2, y0 = y - h / 2, y1 = y + h / 2;
    add((-BW / 2 + x0) / 2, BH / 2, x0 + BW / 2, BH, TH);                  // 左の袖
    add((BW / 2 + x1) / 2, BH / 2, BW / 2 - x1, BH, TH);                   // 右の袖
    add(0, y0 / 2, w, y0, TH);                                              // 腰
    add(0, (y1 + BH) / 2, w, BH - y1, TH);                                  // 上
    const pm = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex, toneMapped: false }));
    pm.position.set(0, y, -TH / 2 + 0.02); g.add(pm);                       // 見込みの奥(2cm 手前にずらして面の重なりを避ける)
    const back = new T.Mesh(new T.PlaneGeometry(w, h), MAT.bg3); back.position.set(0, y, -TH / 2 + 0.01); back.rotation.y = Math.PI; g.add(back); boxes.push(back);
    /* 名前の札: 開口の左端に揃え、腰の面に置く(全製品で同じ規則) */
    const tc = F.textCanvas({ text: name, font: /[ぁ-んァ-ヶ一-龠]/.test(name) ? '700 {px} "Noto Sans JP"' : '500 {px} "Inter"', px: 160, color: TOK.ink2 });
    const lh = 0.12, lw = lh * tc.w / tc.h;                                // 写しの見出しより目立たない大きさ
    const lab = new T.Mesh(new T.PlaneGeometry(lw, lh), new T.MeshBasicMaterial({ map: F.canvasTexture(tc.canvas, renderer), transparent: true, toneMapped: false, depthWrite: false }));
    lab.position.set(x0 + lw / 2 - tc.pad / tc.h * lh, y0 - 0.18, TH / 2 + 0.004); g.add(lab);
    const P = { src, name, group: g, mesh: pm, w, h, label: lab };
    plates.push(P); return P;
  }

  /* ================================================================
     配置(?top=1 で真上から見られる)。小部屋ごとに写しは1枚。境の壁が次の写しを隠す。壁の開口は左右どちらも通れる
     A 個人の部屋 : A1 z 0 → -9.6(Compass)、A2 → -18.4(経験の棚卸し)。幅 9.6、壁 3.6、梁の下端 2.8
     B チームの部屋: B1 → -27.6(掲示じたく)、B2 → -35.2(ConsultSim)。幅 12.8、壁 4.8、梁の下端 4.0
     C 広間(組織) : → -64。幅 16、壁 9.6(クリニックタウン3D → 柱の列に塗られた弧 → 最後の一点)
     ================================================================ */
  box(0, -30, 60, 90, 0.02, -0.02, 0, MAT.floor);                         // 床
  // --- A ---
  wallZ(-5.0, 4, -18.4, 3.6); wallZ(5.0, 4, -18.4, 3.6);
  wallX(0, -5.2, 5.2, 3.6, [[-0.5, 1.5, 2.2]]);                            // 入口(1フレーム目は、この開口の枠越しに Compass を見る)
  for (const [z, hb] of [[-3.2, 0.4], [-4.4, 0.8], [-11.8, 0.4], [-15.6, 0.4]]) box(0, z, 10.4, M, hb, 2.8);   // 梁(間隔は不等)
  wallX(-9.6, -5.2, 5.2, 3.6, [[-4.6, -3.4, 2.6], [2.2, 3.8, 2.6]]);      // A1 の奥の壁
  wallX(-18.4, -5.2, 5.2, 3.6, [[-3.2, -1.0, 2.6], [2.6, 4.2, 2.6]]);     // 敷居。二手に分かれる(右の口も奥へ続く)
  // --- B ---
  wallZ(-6.6, -18.4, -35.2, 4.8); wallZ(6.6, -18.4, -35.2, 4.8);
  box(0, -18.4, 13.6, M, 1.2, 3.6);                                        // 敷居の上(B は A より高い)
  for (const [z, hb] of [[-21.0, 0.8], [-25.8, 0.4], [-30.4, 0.8]]) box(0, z, 13.6, M, hb, 4.0);
  wallX(-27.6, -6.8, 6.8, 4.8, [[-5.6, -4.4, 3.6], [0.2, 2.0, 3.6]]);     // B1 と B2 の境(右の口は ConsultSim が見えない幅)
  wallX(-35.2, -6.8, 6.8, 4.8, [[-1.6, 0.4, 3.6], [3.6, 4.8, 2.4]], 1.2);  // 門(狭い。脇にも抜けがある)
  // --- C: 広間 ---
  wallZ(-8.2, -35.8, -64, 9.6); wallZ(8.2, -35.8, -64, 9.6); wallX(-64, -8.4, 8.4, 9.6);
  box(0, -35.8, 16.8, M, 4.8, 4.8);                                        // 門の上の壁
  wallX(-35.8, -8.4, -6.6, 4.8); wallX(-35.8, 6.6, 8.4, 4.8);

  /* 柱の列: 最終の視点 V から見た藍の弧を、奥行きの違う柱に分けて受ける(Varini の方式。塗りは下の距離の地図で決まる)。
     区間 [u0,u1](藍の線の弧長の割合)ごとに、その区間を正面で受ける柱を V からの奥行き d に立てる */
  const FOC = (W / 2) / Math.tan(FOV_H * Math.PI / 360);                  // 焦点距離(px)
  const navyArc = (() => { const N = 400, P = []; let L = 0; for (let i = 0; i <= N; i++) { const q = bez(LOGO_N, i / N); if (i) L += Math.hypot(q[0] - P[i - 1][0], q[1] - P[i - 1][1]); P.push([q[0], q[1], L]); } return P.map(p => [p[0], p[1], p[2] / L]); })();
  const onRay = (px, py, d) => [VPOS.x + (px - W / 2) / FOC * d, EYE - (py - H / 2) / FOC * d, VPOS.z - d];
  function support(u0, u1, d, { th = 0.8, pad = 0.18, full = true, y0 = 0 } = {}) {
    let x0 = 1e9, x1 = -1e9, yMin = 1e9, yMax = -1e9;
    for (const [vx, vy, u] of navyArc) {
      if (u < u0 || u > u1) continue;
      const [px, py] = vb2px(vx, vy);
      const [X, Y] = onRay(px, py, d);
      x0 = Math.min(x0, X); x1 = Math.max(x1, X); yMin = Math.min(yMin, Y); yMax = Math.max(yMax, Y);
    }
    const hwM = 3.0 * MARK.s / FOC * d;                                    // 線幅の半分(m)
    x0 -= hwM + pad; x1 += hwM + pad;
    const top = full ? 9.6 : yMax + hwM + 0.6;
    /* くさび形の柱: 両側面を V を通る面(V からの光線)に乗せる。V からは側面の面積が 0 になり、継ぎ目に塗り残しが出ない。
       横へ滑る間は、陰の側面が断片の隣に見える */
    const sc = (d + th) / d, bx = X => VPOS.x + (X - VPOS.x) * sc;
    const P = [[x0, VPOS.z - d], [x1, VPOS.z - d], [bx(x1), VPOS.z - d - th], [bx(x0), VPOS.z - d - th]];   // 平面図の四隅(反時計回り)
    const v = (i, y) => [P[i][0], y, P[i][1]];
    const quads = [[0, 1], [1, 2], [2, 3], [3, 0]];
    const pos = [];
    const tri = (a, b2, c) => pos.push(...a, ...b2, ...c);
    for (const [i, j] of quads) { tri(v(i, y0), v(j, y0), v(j, top)); tri(v(i, y0), v(j, top), v(i, top)); }   // 側面(外向き)
    tri(v(0, top), v(1, top), v(2, top)); tri(v(0, top), v(2, top), v(3, top));                               // 天端
    tri(v(0, y0), v(2, y0), v(1, y0)); tri(v(0, y0), v(3, y0), v(2, y0));                                     // 下面
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
    const m = new T.Mesh(g, MAT.auto); scene.add(m); boxes.push(m); return m;
  }
  support(0.00, 0.23, 6.0);                                                 // 手前の柱(左の脚)。区間は隣と少し重ねる
  support(0.19, 0.46, 15.0);                                                // 奥の柱
  support(0.42, 0.64, 9.6);                                                 // 頂を受ける柱
  support(0.82, 1.00, 11.5);                                                // 右の脚の柱
  // 0.62–0.84(砂と交わるところ)は奥の壁(V から 25.6m)が受ける
  box(-3.6, -50.0, 1.2, 1.2, 9.6); box(-6.4, -44.0, 1.2, 1.2, 9.6); box(7.2, -55.0, 1.2, 1.2, 9.6);   // 塗らない柱(列の続き)

  // --- 写し(順番: 個人 → チーム → 組織)。ファイルは plates/ と images/products/shots/(既存の公式の写し) ---
  const PL = 'plates/';
  await plate({ src: PL + (Q.get('compass') === 'light' ? 'compass-q-light.webp' : 'compass-q-dark.webp'), name: 'BRIDGE Compass', x: -0.8, z: -4.8, w: 3.2, bafW: 5.2, ry: 0.26 });
  await plate({ src: PL + 'tanaoroshi-light.webp', name: '経験の棚卸し', x: 1.6, z: -14.2, w: 3.2, bafW: 5.2, ry: 0.22 });
  await plate({ src: PL + 'keiji-light.webp', name: '掲示じたく', x: -2.2, z: -23.6, w: 3.2, bafW: 5.2, bafH: 4.0, ry: 0.14 });
  await plate({ src: PL + 'consult-sim-light.webp', name: 'ConsultSim', x: 5.3, z: -31.4, w: 3.2, bafW: 4.0, bafH: 4.0, ry: -1.10 });   // 曲がり角の向こう(前の部屋から見えない)   // 曲がり角の向こう(前の部屋から見えない)
  await plate({ src: '../../images/products/shots/clinic-flow-3d-decision.webp', name: 'クリニックタウン3D', x: -6.0, z: -41.6, w: 4.8, y: 2.3, ry: 0.92, bafW: 6.0, bafH: 5.2 });

  /* ---- 砂の板: 最終の視点から見た正式の砂の線を、視線に沿って押し出した剛体。動かない ---- */
  const inv = new T.Matrix4().copy(V.projectionMatrix).invert();
  const rayPoint = (px, py, dist) => {           // 画面の px を通る V からの光線上で、カメラ空間の奥行き dist の点
    const d = new T.Vector3(px / W * 2 - 1, 1 - py / H * 2, 0.5).applyMatrix4(inv);
    d.multiplyScalar(dist / -d.z);
    return d.applyMatrix4(V.matrixWorld);
  };
  function strokeOutline(ctrl, hwv) {            // 線幅 2·hwv の丸端の線の輪郭(viewBox 単位)
    const N = 96, pts = []; for (let i = 0; i <= N; i++) pts.push(bez(ctrl, i / N));
    const nrm = i => { const a = pts[Math.max(0, i - 1)], b = pts[Math.min(N, i + 1)]; const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty); return [-ty / l, tx / l]; };
    const L = [], Rr = [];
    for (let i = 0; i <= N; i++) { const [nx, ny] = nrm(i); L.push([pts[i][0] + nx * hwv, pts[i][1] + ny * hwv]); Rr.push([pts[i][0] - nx * hwv, pts[i][1] - ny * hwv]); }
    const cap = (c, a0) => { const r = []; for (let k = 1; k < 16; k++) { const a = a0 - Math.PI * k / 16; r.push([c[0] + Math.cos(a) * hwv, c[1] + Math.sin(a) * hwv]); } return r; };
    const [nxE, nyE] = nrm(N), [nxS, nyS] = nrm(0);
    return [...L, ...cap(pts[N], Math.atan2(nyE, nxE)), ...Rr.reverse(), ...cap(pts[0], Math.atan2(-nyS, -nxS))];
  }
  function sandBlade(depth, thick) {
    const outline = strokeOutline(LOGO_S, 3.0);
    const n = outline.length;
    const tri = T.ShapeUtils.triangulateShape(outline.map(([x, y]) => new T.Vector2(x, -y)), []);
    const pos = [], idx = [];
    for (const dd of [depth, depth + thick]) outline.forEach(([x, y]) => { const [px, py] = vb2px(x, y); const p = rayPoint(px, py, dd); pos.push(p.x, p.y, p.z); });
    tri.forEach(([a, b, c]) => { idx.push(a, b, c); idx.push(a + n, c + n, b + n); });
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(i, j, i + n, j, j + n, i + n); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: F.lin(TOK.dawn), side: T.DoubleSide }));
    m.layers.set(1);                              // 深度の地図(藍の塗りの判定)には入れない
    scene.add(m);
    return m;
  }

  /* ---- 藍の塗り: 最終の視点からの距離の地図を作り、見える面にだけ弧を塗る ---- */
  scene.updateMatrixWorld(true);
  {
    const distMat = new T.ShaderMaterial({
      uniforms: { eye: { value: VPOS } },
      vertexShader: 'varying vec3 wp; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); wp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'uniform vec3 eye; varying vec3 wp; void main(){ gl_FragColor = vec4(distance(wp, eye), 0.0, 0.0, 1.0); }',
      side: T.DoubleSide,
    });
    const bg = scene.background; scene.background = null; scene.overrideMaterial = distMat;
    renderer.setRenderTarget(distRT); renderer.setClearColor(new T.Color(1e6, 0, 0), 1); renderer.clear(); renderer.render(scene, V);
    renderer.setRenderTarget(null); scene.overrideMaterial = null; scene.background = bg; renderer.setClearColor(new T.Color(0, 0, 0), 1);
    PAINT.vp.value.multiplyMatrices(V.projectionMatrix, V.matrixWorldInverse);
    PAINT.eye.value.copy(VPOS);
    PAINT.on.value = 1;
  }
  sandBlade(4.2, 0.3);

  /* ================================================================
     カメラ: 時刻つきの鍵(位置 x,z と向き yaw)をエルミート補間(速度・角速度が連続)。ピッチ・ロールは 0。
     読ませる拍では写しに正対から 20° 以内・画面幅の約半分で向き合い、角速度 60°/s 以下で次へ振る。
     最後は横へ滑りながら最終の向きへ回り、T_ARRIVE で止まる(減速は一度だけ)
     ================================================================ */
  const T_ARRIVE = 12.8;
  const KEYS = [
    [0.0, 0.4, 3.2, 0.15],        // S1 入口の壁の 3.2m 手前。開口の枠越しに Compass の問い
    [0.8, 0.5, 0.2, 0.22],        // 開口をくぐる
    [1.6, 1.5, -2.0, 0.50],       // 見たまま右へ弧を描く
    [2.25, 3.1, -5.0, 0.12],      // S2 右を回る
    [2.7, 3.1, -8.2, 0.02],
    [3.05, 3.0, -10.0, 0.10],     // 奥の壁の右の口
    [3.55, 2.4, -10.9, 0.20],     // S3 経験の棚卸しを読む(短め)
    [4.0, 0.3, -11.1, 0.40],      // S4 壁の手前を左へ(写しから 3m 以上、壁の端から 1m 以上離す)
    [4.45, -2.4, -12.6, 0.16],
    [4.8, -2.5, -15.4, 0.02],
    [5.15, -2.1, -18.4, 0.00],    // 敷居の左の口
    [5.6, -1.6, -19.6, 0.10],     // S5 掲示じたくを読む(短め)
    [6.1, -1.0, -20.6, 0.12],
    [6.6, 1.2, -22.6, -0.20],     // S6 右を回る
    [7.0, 1.4, -25.3, -0.12],
    [7.45, 1.1, -27.9, -0.42],    // 境の右の口。右を向く
    [7.95, 1.1, -29.0, -0.74],    // S7 ConsultSim を読む(横を向く。短め)
    [8.45, 0.6, -30.3, -0.58],
    [8.95, -0.2, -32.5, -0.16],   // S8 門へ振り戻す
    [9.4, -0.6, -35.0, 0.20],     // 門をくぐる
    [10.05, -1.2, -37.0, 0.72],   // S9 クリニックタウン3D を読む(長め)
    [10.65, -1.0, -37.5, 0.78],
    [11.4, 0.8, -37.9, 0.38],     // S10 横へ滑りながら回る
    [12.1, 3.0, -38.3, 0.06],
    [T_ARRIVE, VPOS.x, VPOS.z, VYAW],
  ].map(([t, x, z, yaw]) => ({ t, v: [x, z, yaw] }));
  const camCurve = F.hermite(KEYS);
  const yawOfDir = (dx, dz) => Math.atan2(-dx, -dz);          // -z を 0、左回りを正
  const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const tmp = new T.Vector3();
  function camAt(t) {
    if (t >= T_ARRIVE) return { pos: VPOS.clone(), yaw: VYAW };
    /* 最後の 1.2 秒は時間を写して止める: g(u) = u + 3u² − 5u³ + 2u⁴(g'(0)=1 で前とつながり、到着で速度も加速度も 0) */
    const T0 = T_ARRIVE - 1.2;
    if (t > T0) { const u = (t - T0) / (T_ARRIVE - T0); t = T0 + (T_ARRIVE - T0) * (u + 3 * u * u - 5 * u * u * u + 2 * u * u * u * u); }
    const [x, z, yaw] = camCurve(t);
    return { pos: new T.Vector3(x, EYE, z), yaw };
  }
  const BEATS = [{ k: 0 }, { k: 1 }, { k: 2 }, { k: 3 }, { k: 4 }];

  const cam = new T.PerspectiveCamera(vfov(W, H), W / H, 0.05, 400);
  cam.rotation.order = 'YXZ';
  cam.layers.enable(1);

  /* ================================================================
     署名(蓄積の外で重ねる層。ぼけ・ずらしの外で常に鋭い): BRIDGE と EXPAND CHOICES.
     ================================================================ */
  const post = { scene: new T.Scene(), camera: new T.OrthographicCamera(0, W, 0, -H, -1, 1) };
  function postTex(c, x, y) {   // (x,y) は左上の px(整数に丸める)
    const m = new T.Mesh(new T.PlaneGeometry(c.w, c.h), new T.MeshBasicMaterial({ map: F.canvasTexture(c.canvas, renderer, true), transparent: true, depthTest: false, depthWrite: false }));
    m.position.set(Math.round(x) + c.w / 2, -(Math.round(y) + c.h / 2), 0); post.scene.add(m); return m;
  }
  const WM_PX = Math.round(0.05 * W);
  const wm = F.textCanvas({ text: 'BRIDGE', font: '500 {px} "Inter"', px: WM_PX, color: TOK.ink, tracking: 0.34, pad: 0.3 });
  const markBottom = vb2px(0, 94)[1];
  const WM_BASE = markBottom + 1.25 * WM_PX;                                // マークと文字の間は字高の 0.5 倍以上
  const WM = postTex(wm, W / 2 - wm.inkW / 2 - wm.pad, WM_BASE - wm.asc - wm.pad);
  const tg = F.textCanvas({ text: 'EXPAND CHOICES.', font: '500 {px} "Inter"', px: Math.round(WM_PX * 8.5 / 15), color: TOK.ink3, tracking: 0.22, pad: 0.3 });
  const TG = postTex(tg, W / 2 - tg.inkW / 2 - tg.pad, WM_BASE + 0.62 * WM_PX - tg.asc - tg.pad + Math.round(0.36 * WM_PX));
  let CP = null;
  if (COPY) {
    const cp = F.textCanvas({ text: '人は、もっと選べる', font: '600 {px} "Shippori Mincho B1"', px: Math.round(0.034 * W), color: TOK.ink, tracking: 0.04, pad: 0.3 });
    CP = postTex(cp, W / 2 - cp.inkW / 2 - cp.pad, 0.80 * H);
  }
  const T_WM = 13.1, T_TG = 13.5;
  function setPost(t) {
    WM.visible = t >= T_WM; WM.material.opacity = seg(t, T_WM, 0.3);
    TG.visible = t >= T_TG; TG.material.opacity = seg(t, T_TG, 0.3);
    if (CP) { CP.visible = t > 10.3 && t < 12.2; CP.material.opacity = seg(t, 10.3, 0.3) * (1 - seg(t, 11.9, 0.3)); }
  }

  /* レンズシフト(建築写真のシフトレンズ): 走行中は床を多めに入れて、白い壁だけのコマを減らす。最終の視点では 0 */
  const SHIFT = t => -0.10 * H * (1 - EASE.sineInOut(seg(t, 10.4, 1.8)));
  function draw(t) {
    const { pos, yaw } = camAt(t);
    cam.position.copy(pos); cam.rotation.set(0, yaw, 0);
    cam.updateMatrixWorld();
    return { scene, camera: cam, shift: [0, SHIFT(t)] };
  }

  /* ---- 真上からの見取り図(?top=1) ---- */
  const topCam = new T.OrthographicCamera(-32 * W / H, 32 * W / H, 32, -32, 0.1, 200);
  topCam.position.set(0, 100, -26); topCam.up.set(0, 0, -1); topCam.lookAt(0, 0, -26); topCam.layers.enable(1);
  const pathLine = new T.Line(new T.BufferGeometry().setFromPoints(Array.from({ length: 400 }, (_, i) => { const p = camAt(i / 399 * T_ARRIVE).pos; return new T.Vector3(p.x, 11, p.z); })), new T.LineBasicMaterial({ color: F.lin(TOK.dawn) }));
  const marker = new T.Mesh(new T.ConeGeometry(0.5, 1.4, 3), new T.MeshBasicMaterial({ color: F.lin(TOK.navy) }));
  function drawTop(t) {
    const { pos, yaw } = camAt(t);
    PAINT.topMode.value = 1;
    if (!pathLine.parent) { scene.add(pathLine); scene.add(marker); }
    marker.position.set(pos.x, 12, pos.z); marker.rotation.set(-Math.PI / 2, 0, yaw, 'YXZ'); marker.rotation.set(0, yaw, 0); marker.rotateX(-Math.PI / 2);
    return { scene, camera: topCam, shift: [0, 0] };
  }

  /* ---- 測る: 読ませる拍の数値(写しの画面上の幅・正対からのずれ・動き)と、ヨーの角速度 ---- */
  function projectPlate(P, camera) {
    const w2 = P.w / 2, h2 = P.h / 2, pts = [[-w2, -h2], [w2, -h2], [w2, h2], [-w2, h2]].map(([x, y]) => {
      const v = new T.Vector3(x, y, 0).applyMatrix4(P.mesh.matrixWorld).project(camera);
      return [(v.x + 1) / 2 * W, (1 - v.y) / 2 * H, v.z];
    });
    const cx = pts.reduce((a, p) => a + p[0], 0) / 4, cy = pts.reduce((a, p) => a + p[1], 0) / 4;
    const width = Math.max(Math.hypot(pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]), Math.hypot(pts[2][0] - pts[3][0], pts[2][1] - pts[3][1]));
    P.mesh.getWorldPosition(tmp); const nrm = new T.Vector3(0, 0, 1).applyQuaternion(P.mesh.getWorldQuaternion(new T.Quaternion()));
    const toCam = camera.position.clone().sub(tmp).normalize();
    const ang = Math.acos(clamp(nrm.dot(toCam), -1, 1)) * 180 / Math.PI;
    const inFront = pts.every(p => p[2] < 1);
    return { cx, cy, width, ang, inFront };
  }
  function metrics(step = 1 / 30) {
    const out = [];
    for (let t = 0; t <= DUR + 1e-9; t += step) {
      draw(t); const a = camAt(t), b = camAt(Math.min(DUR, t + 1 / FPS));
      const row = { t: +t.toFixed(3), s: 0, v: +(a.pos.distanceTo(b.pos) * FPS).toFixed(2), yawRate: +(wrap(b.yaw - a.yaw) * FPS * 180 / Math.PI).toFixed(1), plates: [] };
      for (const B of BEATS) { const pr = projectPlate(plates[B.k], cam); row.plates.push({ k: B.k, w: Math.round(pr.width), ang: Math.round(pr.ang), cx: Math.round(pr.cx), cy: Math.round(pr.cy), front: pr.inFront }); }
      out.push(row);
    }
    return out;
  }

  /* ---- 同時に見える写しの数(1px 以上)。写しだけに色を付けた小さな画で数える ---- */
  const idRT = new T.WebGLRenderTarget(480, Math.round(480 * H / W));
  const idBlack = new T.MeshBasicMaterial({ color: 0x000000 });
  const idMats = plates.map((P, i) => new T.MeshBasicMaterial({ color: new T.Color().setHSL(i / plates.length, 1, 0.5) }));
  function visibleCounts(t) {
    const d = draw(t);
    cam.updateProjectionMatrix(); cam.projectionMatrix.elements[9] += 2 * d.shift[1] / H; cam.projectionMatrixInverse.copy(cam.projectionMatrix).invert();
    const saved = new Map();
    scene.traverse(o => { if (o.isMesh || o.isLine) { saved.set(o, o.material); const pi = plates.findIndex(P => P.mesh === o); o.material = pi >= 0 ? idMats[pi] : idBlack; } });
    const bg = scene.background; scene.background = new T.Color(0, 0, 0);
    renderer.setRenderTarget(idRT); renderer.render(scene, cam); renderer.setRenderTarget(null); cam.updateProjectionMatrix();
    scene.background = bg; saved.forEach((m, o) => { o.material = m; });
    const px = new Uint8Array(idRT.width * idRT.height * 4);
    renderer.readRenderTargetPixels(idRT, 0, 0, idRT.width, idRT.height, px);
    const counts = plates.map(() => 0);
    const cols = idMats.map(m => [Math.round(m.color.r * 255), Math.round(m.color.g * 255), Math.round(m.color.b * 255)]);
    for (let i = 0; i < px.length; i += 4) {
      if (px[i] + px[i + 1] + px[i + 2] < 30) continue;
      let best = -1, bd = 1e9; cols.forEach((c, j) => { const d = Math.abs(c[0] - px[i]) + Math.abs(c[1] - px[i + 1]) + Math.abs(c[2] - px[i + 2]); if (d < bd) { bd = d; best = j; } });
      if (bd < 60) counts[best]++;
    }
    return counts;
  }

  /* ---- 書き出し用の口 ---- */
  const TOP = Q.has('top');
  function renderFrame(t, samples = 16, fps = FPS) {
    setPost(t);
    R.renderFrame(t, samples, 0.5, fps, TOP ? drawTop : draw, TOP ? null : post);
  }
  window.FILM = { W, H, FPS, DUR, ready: Promise.resolve(true), renderFrame, out: canvas, camAt, plates, metrics, visibleCounts, TOK };

  /* ---- 確認用の再生(?render なし): ぼけなしで実時間。?t=秒 で止め絵 ---- */
  if (!RENDER) {
    const hud = document.getElementById('hud');
    if (Q.has('t')) { renderFrame(+Q.get('t'), +(Q.get('n') || 8)); hud.textContent = 't=' + Q.get('t'); }
    else {
      let t0 = performance.now();
      const loop = now => { const t = ((now - t0) / 1000) % DUR; renderFrame(t, 1); hud.textContent = t.toFixed(2); requestAnimationFrame(loop); };
      requestAnimationFrame(loop);
      canvas.addEventListener('click', () => { t0 = performance.now(); });
    }
  }
})().catch(e => { console.error(e); window.FILM_ERROR = String(e && e.stack || e); });
