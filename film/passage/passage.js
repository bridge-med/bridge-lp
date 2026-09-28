/* ================================================================
   BRIDGE「PASSAGE」(仮題)— 15.000 秒・60fps・時刻 t だけで 1 枚が決まる
   白い建築を、カメラが一定の速さで、一本の直線の上を通り抜ける。
   部屋は 個人 → チーム → 組織 の順に、幅・天井の高さ・壁の厚みが変わり、向きが少しずつ広間の軸に揃う。
   道具の画面(写し)は、通る口と同じ家族の開口の奥に、使っている途中の状態で納まっている。
   最後の広間で一点 V に着くと、6m 先の格子と 30m 先の壁に交互に塗られていた藍と砂が、その一点から見たときだけロゴに揃う。
   格子の壁柱は V からの光線に沿って立ち、V に揃うまでは側面が重なって奥を隠す(交点では砂が手前の板、藍が奥の面。交差するが、接続しない)。
   動くのはカメラだけ。建築・写し・藍・砂はどれも動かない。
   規則の全文は film/passage/STORYBOARD.md。要点:
   - 色はトークンの値だけ(TOK)。面は世界に固定した光の向きで平塗り。目地は面の段を一つ下げた色
   - 陰影・影・霧・グロー・粒子なし。天井はすべて閉じる(背景のクリア色が写らない)
   - 写しは加工しない(照明を当てない・縦横比そのまま・色補正なし。撮る範囲は撮るときに選ぶ)
   - 藍はロゴの断片だけ。画面が描く砂はロゴの砂の線だけ
   - カメラ: 焦点距離固定・ロール0・ピッチ0・シフト一定。速さは一定、向きは一方向にだけ回る。止まるのは最後の一度
   ================================================================ */
(async function () {
  'use strict';
  const F = window.FilmEngine, T = window.THREE;
  const { clamp, seg } = F;
  const Q = new URLSearchParams(location.search);
  const W = +(Q.get('w') || 1920), H = +(Q.get('h') || 1080);
  const FPS = 60, DUR = 15;
  const RENDER = Q.has('render');
  const DEG = Math.PI / 180;
  const num = (k, d) => (Q.has(k) ? +Q.get(k) : d);                       // 確認用の引数(既定値は本番の値)

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

  /* ---- フォント ---- */
  await document.fonts.ready;
  await document.fonts.load('500 64px "Inter"', 'BRIDGE EXPAND CHOICES.');
  await document.fonts.load('500 64px "Noto Sans JP"', 'BRIDGE Compass経験の棚卸し現場のことば言いかえ帳掲示じたくクリニックタウン3D');

  /* ================================================================
     カメラの幾何(単位 m。x=右、y=上、z=手前。広間の軸は -z)
     ================================================================ */
  const EYE = 1.4, FOV_H = 65.5;                                            // 28mm 相当(横)
  const vfov = (w, h) => 2 * Math.atan(Math.tan(FOV_H * Math.PI / 360) * h / w) * 180 / Math.PI;
  const FOC = (W / 2) / Math.tan(FOV_H * Math.PI / 360);                    // 焦点距離(px)
  const SHIFT_Y = -0.06 * H;                                                // レンズシフト(全編一定。地平線は y=0.44H)
  const shiftProj = c => { c.updateProjectionMatrix(); c.projectionMatrix.elements[9] += 2 * SHIFT_Y / H; c.projectionMatrixInverse.copy(c.projectionMatrix).invert(); };

  /* 経路: 一本の直線。V の視線(-z)に対して 20°、右後ろから左前へ。0〜10.8 秒は 3.6 m/s 一定、
     10.8〜12.8 秒は v = 3.6·(2e − e²)(e = (12.8 − t)/2)で止まる。途中で 3.6 m/s を超えない */
  const HEAD = num('head', 20) * DEG;
  const DIR = new T.Vector2(-Math.sin(HEAD), -Math.cos(HEAD));
  const V0 = 3.6, T_CRUISE = 10.8, T_ARRIVE = 12.8, T_DEC = T_ARRIVE - T_CRUISE;
  const LEN = V0 * T_CRUISE + V0 * T_DEC * 2 / 3;                           // 43.68 m
  const sAt = t => {
    if (t <= T_CRUISE) return V0 * t;
    if (t >= T_ARRIVE) return LEN;
    const e = (T_ARRIVE - t) / T_DEC;
    return V0 * T_CRUISE + V0 * T_DEC * (2 / 3 - e * e + e * e * e / 3);
  };
  const P0 = new T.Vector2(0, 0);
  const posAt = t => P0.clone().add(DIR.clone().multiplyScalar(sAt(t)));
  const VP = posAt(T_ARRIVE);                                                // 最終の視点(平面)

  /* 部屋の座標系(frame): 角度 a(左回りが正)で回し、原点を世界の (ox, oz) に置く。
     w(x, z) で部屋の中の座標を世界へ、l(X, Z) で世界を部屋の中へ */
  function frame(aDeg, ox, oz) {
    const a = aDeg * DEG, c = Math.cos(a), s = Math.sin(a);
    return { a, ox, oz, w: (x, z) => [ox + c * x + s * z, oz - s * x + c * z], l: (X, Z) => { const dx = X - ox, dz = Z - oz; return [c * dx - s * dz, s * dx + c * dz]; } };
  }
  /* 経路が部屋の中の座標 (xl, 0) を通るように原点を決める(sEnter は、その点での経路の距離) */
  function frameOnPath(aDeg, sEnter, xl) {
    const p = P0.clone().add(DIR.clone().multiplyScalar(sEnter)), a = aDeg * DEG, c = Math.cos(a), s = Math.sin(a);
    return frame(aDeg, p.x - c * xl, p.y + s * xl);
  }
  /* 経路が部屋の中の z = zl を横切る点(経路の距離 s と、部屋の中の x) */
  function crossing(Fr, zl) {
    const c = Math.cos(Fr.a), s = Math.sin(Fr.a);
    const d = [c * DIR.x - s * DIR.y, s * DIR.x + c * DIR.y];
    const p0 = Fr.l(P0.x, P0.y), k = (zl - p0[1]) / d[1];
    return { s: k, x: p0[0] + d[0] * k };
  }

  /* ================================================================
     面の塗り
     ================================================================ */
  const scene = new T.Scene();
  scene.background = new T.Color(TOK.bg);                 // クリアは符号化を通らないので、sRGB の値のまま渡す
  const SUN = new T.Vector3(-0.55, 0, 0.83).normalize();   // 光は左手前から(世界に固定)

  /* ---- ロゴ(正式: shared/bridge.js 31–32 行)。最終フレームでのマークの置き場(px) ---- */
  const LOGO_N = [[8, 74], [62, 16], [118, 24], [176, 84]];
  const LOGO_S = [[58, 94], [118, 60], [158, 22], [232, 12]];
  const bez = (p, u) => { const a = 1 - u; return [a * a * a * p[0][0] + 3 * a * a * u * p[1][0] + 3 * a * u * u * p[2][0] + u * u * u * p[3][0], a * a * a * p[0][1] + 3 * a * a * u * p[1][1] + 3 * a * u * u * p[2][1] + u * u * u * p[3][1]]; };
  const MARK = { cx: 0.5 * W, cy: 0.392 * H, s: 0.38 * W / 240 };     // マークの中心(viewBox の 120,53)と倍率
  const vb2px = (x, y) => [MARK.cx + (x - 120) * MARK.s, MARK.cy + (y - 53) * MARK.s];
  const NSEG = 64;
  const polyOf = ctrl => { const P = []; for (let i = 0; i <= NSEG; i++) { const q = bez(ctrl, i / NSEG); P.push(new T.Vector2(q[0], q[1])); } return P; };

  /* 藍と砂の塗り(Varini の方式): 最終の視点 V からの距離の地図を作り、そこから見える面にだけ線を塗る。
     交点の砂の板は地図に入れない(交点で藍は奥の面に、砂は手前の板に乗る。奥の砂は交点の区間で止まる) */
  const mkDist = () => new T.WebGLRenderTarget(W * 2, H * 2, { type: T.FloatType, format: T.RGBAFormat, minFilter: T.NearestFilter, magFilter: T.NearestFilter, stencilBuffer: true });
  const distN = mkDist();
  const NSS = 32;                                                            // 奥の砂の二本(交点の手前と先)の分割数
  const PAINT = {
    vp: { value: new T.Matrix4() }, eye: { value: new T.Vector3() }, res: { value: new T.Vector2(W, H) },
    mark: { value: new T.Vector3(MARK.cx, MARK.cy, MARK.s) }, hw: { value: 3.0 }, on: { value: 0 },
    dmapN: { value: distN.texture }, ptsN: { value: polyOf(LOGO_N) }, inkN: { value: F.lin(TOK.navy) },
    ptsS1: { value: polyOf(LOGO_S).slice(0, NSS + 1) }, ptsS2: { value: polyOf(LOGO_S).slice(0, NSS + 1) }, inkS: { value: F.lin(TOK.dawn) },
    topMode: { value: 0 }, cTop: { value: F.lin(TOK.ink3) },
  };
  /* 目地: 面の段を一つ下げた色(--card・--bg の面は --bg-2、--bg-2 の面は --bg-3。--bg-3 の面には引かない)。
     床は 0.6×1.2 の破れ目地(長い辺を部屋の軸に沿わせる)、壁は縦 1.2・横 2.4 ごと、足元に 0.03 の巾木の帯(--bg-3)。天井は線なし。
     太さは実寸 12mm(画面で 1〜2px)。間隔が画面で 8px 未満になる所では消す */
  const ARCH_VS = 'varying vec3 wp; varying vec3 wn; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); wp = w.xyz; wn = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }';
  const ARCH_FS = `
    uniform vec3 cBg, cCard, cBg2, cBg3, sun; uniform float force; uniform float joints; uniform float topMode; uniform vec3 cTop;
    uniform float fA; uniform vec2 fO; uniform float fY;
    uniform mat4 vp; uniform vec3 eye; uniform vec2 res; uniform vec3 mark; uniform float hw; uniform float on;
    uniform sampler2D dmapN; uniform vec2 ptsN[${NSEG + 1}]; uniform vec3 inkN;
    uniform vec2 ptsS1[${NSS + 1}]; uniform vec2 ptsS2[${NSS + 1}]; uniform vec3 inkS;
    varying vec3 wp; varying vec3 wn;
    float sdSeg(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
    float lineAt(float p, float m, float off){                // 間隔 m・ずらし off の平行線(p は実寸 m)
      float fw = max(fwidth(p), 1e-6);                        // 1px あたりの実寸
      float d = abs(fract((p - off) / m - 0.5) - 0.5) * m / fw;   // 線までの距離(px)
      float wpx = clamp(0.012 / fw, 1.0, 2.0);
      return clamp(wpx * 0.5 + 0.5 - d, 0.0, 1.0) * smoothstep(8.0, 12.0, m / fw);
    }
    float lineOnce(float p, float at){                        // 一本だけの線(柱の 2.4m の基準線)
      float fw = max(fwidth(p), 1e-6);
      float wpx = clamp(0.012 / fw, 1.0, 2.0);
      return clamp(wpx * 0.5 + 0.5 - abs(p - at) / fw, 0.0, 1.0);
    }
    float cover(float dist){ float aa = min(fwidth(dist) * 0.75, 0.6); return 1.0 - smoothstep(hw - aa, hw + aa, dist); }
    float stroke(vec2 vb, vec2 P[${NSEG + 1}]){
      float dist = 1e9;
      for (int i = 0; i < ${NSEG}; i++) dist = min(dist, sdSeg(vb, P[i], P[i + 1]));
      return cover(dist);
    }
    float strokeS(vec2 vb){                                   // 奥の砂: 交点の区間を除いた二本(端は丸い)
      float dist = 1e9;
      for (int i = 0; i < ${NSS}; i++) dist = min(dist, min(sdSeg(vb, ptsS1[i], ptsS1[i + 1]), sdSeg(vb, ptsS2[i], ptsS2[i + 1])));
      return cover(dist);
    }
    float onMap(sampler2D m, vec2 uv){                       // V の距離の地図で、この面が V から見えているか
      vec2 tx = 1.0 / (2.0 * res); float d = 0.0;            // 隣の 3×3 の最大(遮る縁で塗り残しを出さない)
      for (int jj = -1; jj <= 1; jj++) for (int ii = -1; ii <= 1; ii++) d = max(d, texture2D(m, uv + vec2(float(ii), float(jj)) * tx).r);
      return distance(wp, eye) <= d * 1.003 + 0.02 ? 1.0 : 0.0;
    }
    void main(){
      vec3 n = normalize(wn); vec3 c; float lvl;
      if (force > -0.5) lvl = force; else if (n.y > 0.5) lvl = 0.0; else if (n.y < -0.5) lvl = 3.0; else lvl = dot(n, sun) > 0.0 ? 1.0 : 2.0;
      if (topMode > 0.5 && n.y > 0.5) c = cTop;
      else {
        c = lvl < 0.5 ? cBg : lvl < 1.5 ? cCard : lvl < 2.5 ? cBg2 : cBg3;
        vec3 j = lvl < 1.5 ? cBg2 : cBg3;
        if (joints > 0.5 && lvl < 2.5 && topMode < 0.5) {
          float ca = cos(fA), sa = sin(fA);
          vec2 d0 = wp.xz - fO; vec2 L = vec2(ca * d0.x - sa * d0.y, sa * d0.x + ca * d0.y);   // 部屋の中の座標
          vec3 nl = vec3(ca * n.x - sa * n.z, n.y, sa * n.x + ca * n.z);
          float k = 0.0;
          if (n.y > 0.5) {
            if (wp.y - fY < 0.01) { float col = floor(L.x / 0.6); k = max(lineAt(L.x, 0.6, 0.0), lineAt(L.y, 1.2, mod(col, 2.0) * 0.6)); }   // 床: 破れ目地
          } else if (n.y > -0.5) {
            float along = abs(nl.x) > abs(nl.z) ? L.y : L.x;
            float hy = wp.y - fY;                                                             // その面が立つ床からの高さ
            if (joints > 1.5) k = lineOnce(hy, 2.4);                                          // 柱・腰壁: 2.4m の基準線だけ
            else k = max(lineAt(along, 1.2, 0.0), hy > 1.2 ? lineAt(hy, 2.4, 0.0) : 0.0);     // 壁: 縦 1.2、横 2.4 ごと
            if (hy < 0.03) { c = cBg3; k = 0.0; }                                             // 巾木の帯
          }
          c = mix(c, j, k);
        }
      }
      if (on > 0.5) {
        vec4 cp = vp * vec4(wp, 1.0);
        if (cp.w > 0.0) {
          vec3 nd = cp.xyz / cp.w;
          if (abs(nd.x) < 1.0 && abs(nd.y) < 1.0) {
            vec2 uv = nd.xy * 0.5 + 0.5;
            vec2 px = vec2(uv.x * res.x, (1.0 - uv.y) * res.y);
            vec2 vb = (px - mark.xy) / mark.z + vec2(120.0, 53.0);
            if (vb.x > 0.0 && vb.x < 240.0 && vb.y > 4.0 && vb.y < 102.0) {   // 二本の線の外接箱の外は計算しない
              if (onMap(dmapN, uv) > 0.5) {
                if (vb.x < 184.0 && vb.y > 12.0 && vb.y < 92.0) c = mix(c, inkN, stroke(vb, ptsN));   // 藍
                if (vb.x > 52.0 && vb.y < 100.0) c = mix(c, inkS, strokeS(vb));                      // 砂(交点の区間は手前の板)
              }
            }
          }
        }
      }
      gl_FragColor = linearToOutputTexel(vec4(c, 1.0));   // 描画先(sRGB 8bit)へ符号化して書く
    }`;
  const matCache = new Map();
  function archMat(Fr, force = -1, joints = 1, fy = 0) {
    const key = `${Fr.a.toFixed(6)},${Fr.ox.toFixed(4)},${Fr.oz.toFixed(4)}|${force}|${joints}|${fy}`;
    if (matCache.has(key)) return matCache.get(key);
    const m = new T.ShaderMaterial({
      uniforms: { cBg: { value: F.lin(TOK.bg) }, cCard: { value: F.lin(TOK.card) }, cBg2: { value: F.lin(TOK.bg2) }, cBg3: { value: F.lin(TOK.bg3) }, sun: { value: SUN }, force: { value: force }, joints: { value: joints }, fA: { value: Fr.a }, fO: { value: new T.Vector2(Fr.ox, Fr.oz) }, fY: { value: fy }, ...PAINT },
      vertexShader: ARCH_VS, fragmentShader: ARCH_FS, extensions: { derivatives: true },
    });
    matCache.set(key, m); return m;
  }

  /* ================================================================
     部品(すべて部屋の座標系で書く)
     ================================================================ */
  const boxes = [];
  const sandOnly = [];                                                       // 距離の地図に入れない面(交点の砂の板)
  /* 箱: 部屋 Fr の中の範囲 [x0,x1]×[y0,y1]×[z0,z1]。kind: 'auto'(目地あり)・'plain'(目地なし)・'col'(柱: 2.4m の基準線と巾木だけ)・'floor'・'ceil'。
     fy: その箱が立つ床の高さ(目地と巾木の基準。広間の下の階は −1.2) */
  function box(Fr, x0, x1, y0, y1, z0, z1, kind = 'auto', fy = 0) {
    const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
    if (w < 1e-4 || h < 1e-4 || d < 1e-4) return null;
    const mat = kind === 'plain' ? archMat(Fr, -1, 0) : kind === 'col' ? archMat(Fr, -1, 2, fy) : kind === 'floor' ? archMat(Fr, 2, 1, fy) : kind === 'ceil' ? archMat(Fr, 2, 0) : archMat(Fr, -1, 1, fy);
    const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
    const [cx, cz] = Fr.w((x0 + x1) / 2, (z0 + z1) / 2);
    m.position.set(cx, (y0 + y1) / 2, cz); m.rotation.y = Fr.a;
    scene.add(m); boxes.push(m); return m;
  }
  /* 壁: axis 'x' は z=c の面に沿って x 方向に a0..a1、axis 'z' は x=c の面に沿って z 方向に a0..a1。
     厚み th は c から ±th/2。開口 { a, b, y0, y1 }(腰 y0 の下と、まぐさ y1 の上は壁のまま) */
  function wall(Fr, axis, c, a0, a1, h, th, openings = []) {
    const lo = Math.min(a0, a1), hi = Math.max(a0, a1);
    const piece = (p0, p1, y0, y1) => axis === 'x' ? box(Fr, p0, p1, y0, y1, c - th / 2, c + th / 2) : box(Fr, c - th / 2, c + th / 2, y0, y1, p0, p1);
    let cur = lo;
    for (const o of [...openings].sort((p, q) => Math.min(p.a, p.b) - Math.min(q.a, q.b))) {
      const a = Math.min(o.a, o.b), b = Math.max(o.a, o.b);
      if (a > cur) piece(cur, a, 0, h);
      if ((o.y0 || 0) > 0) piece(a, b, 0, o.y0);
      if (o.y1 < h) piece(a, b, o.y1, h);
      cur = b;
    }
    if (hi > cur) piece(cur, hi, 0, h);
  }
  /* 部屋: 床・天井・左右の壁(開口つき)。前後の壁は別に書く。fy は床の高さのわずかなずれ(隣の部屋の床と重ならないように) */
  function room(Fr, x0, x1, z0, z1, h, th, open = {}, fy = 0) {
    box(Fr, x0 - th, x1 + th, fy - 0.05, fy, Math.min(z0, z1) - 1.5, Math.max(z0, z1) + 1.5, 'floor');
    box(Fr, x0 - th, x1 + th, h, h + 0.45, Math.min(z0, z1), Math.max(z0, z1), 'ceil');
    wall(Fr, 'z', x0 - th / 2, z0, z1, h, th, open.left || []); wall(Fr, 'z', x1 + th / 2, z0, z1, h, th, open.right || []);
  }
  /* 左の壁に彫り込んだ斜めの区画(のこぎり状): 壁の面の zf(進む側の端)から、奥へ ang° 振った面に幅 width の写しを納める。
     返すのは、壁の開口と、写しを置く座標系(その '+z' が区画の面の向き) */
  function pocketLeft(Fr, xw, th, h, zf, width, ang, y0, y1) {
    const zb = zf + width * Math.cos(ang * DEG), dx = width * Math.sin(ang * DEG);
    return {
      opening: { a: zf, b: zb, y0, y1 },
      build() {
        const xo = xw - dx - 0.3, xi = xw - th;                             // 区画の塊の外側と、壁の外の面
        box(Fr, xo, xi, 0, y0, zf - 0.3, zb); box(Fr, xo, xi, y1, h, zf - 0.3, zb);   // 区画の腰と上
        box(Fr, xo, xw, 0, h, zb, zb + 0.6);                                  // 区画の奥の脇
        box(Fr, xo - 0.3, xo, 0, h, zf - 0.3, zb + 0.6);                     // 区画の背
      },
      plateFrame: () => { const [cx, cz] = Fr.w(xw - dx / 2, (zf + zb) / 2); return frame(Fr.a / DEG + 90 - ang, cx, cz); },
    };
  }

  /* ---- 写し: 開口の奥(壁厚の奥)に納める。照明を当てない。縦横比そのまま ----
     face: 写しが向く向き('+z' など、部屋の座標系で)。開口は [a0,a1]×[y0,y1](走る向きの座標)。
     region: 既存の公式の写しのうち見せる範囲(px、元の画像の座標) */
  const plates = [];
  const LABELS = Q.get('labels') === '1';                                    // 名前を建物の表示として刻むか(判断待ち。既定は出さない)
  async function plate(Fr, { src, name, face, wallC, th, a0, a1, y0, y1, depth = th, region = null }) {
    const tex = await F.imageTexture(src, renderer);
    const w = a1 - a0, h = y1 - y0;
    const iw = tex.image.width, ih = tex.image.height;
    if (region) { tex.repeat.set(region.w / iw, region.h / ih); tex.offset.set(region.x / iw, 1 - (region.y + region.h) / ih); }
    const aspect = region ? region.w / region.h : iw / ih;
    if (Math.abs(aspect / (w / h) - 1) > 0.02) console.warn('写しの比例が開口と違う', name, aspect.toFixed(3), (w / h).toFixed(3));
    const sgn = face[0] === '+' ? 1 : -1, ax = face[1];
    const front = wallC + sgn * th / 2, pz = front - sgn * depth;
    const pm = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: tex, toneMapped: false }));
    const along = (a0 + a1) / 2;
    const lp = ax === 'z' ? [along, pz + sgn * 0.02] : [pz + sgn * 0.02, along];   // 裏の面から 20mm 浮かす(奥行きの取り合いで縞が出ない)
    const [px, pz2] = Fr.w(lp[0], lp[1]);
    pm.position.set(px, y0 + h / 2, pz2);
    pm.rotation.y = Fr.a + (ax === 'z' ? (sgn > 0 ? 0 : Math.PI) : (sgn > 0 ? Math.PI / 2 : -Math.PI / 2));
    scene.add(pm);
    const back = wallC - sgn * th / 2;                                        // 写しの裏(壁の残りの厚み)を埋める
    if (Math.abs(back - pz) > 0.01) { if (ax === 'z') box(Fr, a0, a1, y0, y1, Math.min(pz, back), Math.max(pz, back), 'plain'); else box(Fr, Math.min(pz, back), Math.max(pz, back), y0, y1, a0, a1, 'plain'); }
    let label = null;
    if (LABELS) {                                                             // 開口の左の縦目地の位置、まぐさの室内側の面に字高 0.09m で刻む
      const tc = F.textCanvas({ text: name, font: /[ぁ-んァ-ヶ一-龠]/.test(name) ? '500 {px} "Noto Sans JP"' : '500 {px} "Inter"', px: 160, color: TOK.ink3 });
      const lh = 0.09 * tc.h / tc.asc, lw = lh * tc.w / tc.h;
      label = new T.Mesh(new T.PlaneGeometry(lw, lh), new T.MeshBasicMaterial({ map: F.canvasTexture(tc.canvas, renderer), transparent: true, toneMapped: false, depthWrite: false }));
      const left = sgn > 0 ? a0 : a1, leftDir = sgn > 0 ? 1 : -1;
      const la = left + leftDir * (lw / 2 - tc.pad / tc.h * lh);
      const ll = ax === 'z' ? [la, front + sgn * 0.004] : [front + sgn * 0.004, la];
      const [lx, lz] = Fr.w(ll[0], ll[1]);
      label.position.set(lx, y1 + 0.18, lz); label.rotation.y = pm.rotation.y;
      scene.add(label);
    }
    const P = { src, name, mesh: pm, w, h, label };
    plates.push(P); return P;
  }

  /* ================================================================
     配置(?top=1 で真上から見られる)。寸法は 0.6 の倍数。開口の上端 2.4m は全室共通(人の寸法の基準線)
     I 前室+個人 : 幅 5.4・天井 2.7・壁厚 0.6。広間の軸から +15°。敷居1 は通る口だけ
     T チーム    : 幅 9.6・天井 4.2・壁厚 0.9。+8°。梁 0.45×0.6 を 3.6m ごと。仕切りの壁で手前と奥の二つの間
     C 広間      : 幅 19.2・天井 12.0・壁厚 1.2。0°。柱 1.2 角(7.2m の格子)と、柱の線上の梁 0.6×1.2。腰壁と格子
     ================================================================ */
  const A_I = num('ai', 15), A_T = num('at', 8);
  // --- I: 前室+個人 ---
  const FI = frameOnPath(A_I, 0, num('xi', -0.02));
  const TANA = pocketLeft(FI, -2.4, 0.6, 2.7, num('tanaz', -14.0), 2.4, 35, 0.9, 2.1);   // 経験の棚卸し 2.4×1.2・窓台 0.9
  room(FI, -2.4, 3.0, 3.6, -16.2, 2.7, 0.6, { left: [TANA.opening] });                // 右の壁は Compass の開口の右に 0.6 の袖壁を残す位置
  TANA.build();
  wall(FI, 'x', 3.3, -3.0, 3.6, 2.7, 0.6);                                   // 背の壁(写らない)
  wall(FI, 'x', -8.3, -3.0, 3.6, 2.7, 0.6, [{ a: -1.5, b: -0.3, y0: 0, y1: 2.4 }, { a: 0.0, b: 2.4, y0: 0, y1: 2.4 }]);   // 左寄りに通る口、右に Compass の開口(2.4×2.4)
  // 敷居1(厚み 1.2): 通る口 1.2×2.4 だけ
  const cI = crossing(FI, -15.6);
  const d1 = [cI.x - 0.15 - 0.6, cI.x - 0.15 + 0.6];                        // 口の中央から 0.15 右を通る
  wall(FI, 'x', -15.6, -3.0, 3.6, 2.7, 1.2, [{ a: d1[0], b: d1[1], y0: 0, y1: 2.4 }]);
  // --- T: チーム ---
  const XT = num('xt', 1.8);
  const FT = frameOnPath(A_T, crossing(FI, -16.2).s, XT);
  room(FT, -4.8, 4.8, 0.3, -11.7, 4.2, 0.9, {}, -0.002);                  // 手前は敷居1 の壁が閉じる
  for (const z of [-1.8, -5.4, -9.0]) box(FT, -4.8, 4.8, 3.6, 4.2, z - 0.225, z + 0.225);   // 梁 0.45×0.6(下面だけ --bg-3)
  /* 仕切りの壁(厚み 0.9・天井まで): 左の壁から x=0 まで。部屋を手前と奥の二つの間に分ける。
     手前の面に言いかえ帳の開口 2.4×1.8(窓台 0.6)。奥の掲示じたくは、仕切りの端を過ぎるまで隠れる */
  const zTP = num('tpz', -5.4);
  wall(FT, 'x', zTP, -4.8, 0.0, 4.2, 0.9, [{ a: -2.7, b: -0.3, y0: 0.6, y1: 2.4 }]);
  const cT = crossing(FT, -11.25);
  const d2 = [cT.x - 0.2 - 0.9, cT.x - 0.2 + 0.9];                          // 敷居2 の口 1.8×2.4(中央から 0.2 右を通る)
  wall(FT, 'x', -11.25, -5.7, 5.7, 4.2, 0.9, [{ a: -4.2, b: -1.8, y0: 0.6, y1: 3.6 }, { a: d2[0], b: d2[1], y0: 0, y1: 2.4 }]);   // 奥の壁: 掲示じたく(2.4×3.0)と敷居2
  box(FT, d2[0] - 0.9, d2[0], 0, 4.2, -14.1, -11.7); box(FT, d2[1], d2[1] + 0.9, 0, 4.2, -14.1, -11.7);   // 敷居2 の見込み 2.4(左右)
  box(FT, d2[0], d2[1], 2.4, 4.2, -14.1, -11.7);                            // 敷居2 のまぐさ
  box(FT, d2[0] - 0.9, d2[1] + 0.9, -0.05, 0, -14.1, -11.7, 'floor');
  /* ---- 最終の視点 V: 広間の軸(-z)をまっすぐ見る。シフトは全編と同じ ---- */
  const VPOS = new T.Vector3(VP.x, EYE, VP.y), VYAW = 0;
  const V = new T.PerspectiveCamera(vfov(W, H), W / H, 0.1, 400);
  V.position.copy(VPOS); V.rotation.set(0, VYAW, 0, 'YXZ'); V.updateMatrixWorld(); shiftProj(V);
  const rayV = (px, py) => new T.Vector3(px / W * 2 - 1, 1 - py / H * 2, 0.5).applyMatrix4(V.projectionMatrixInverse).normalize().applyEuler(V.rotation);   // 画面の px を通る V からの向き(世界)
  const yawOfDir = (dx, dz) => Math.atan2(-dx, -dz);                       // -z を 0、左回りを正

  // --- C: 広間 ---
  /* 手前は高い床(テラス。V が立つ)。V の 4.8m 先の腰壁から向こうは、床が 1.2m 下がる(下の階)。
     下の階の床・柱の根元・奥の壁の足元は、どの視点からも腰壁に隠れる */
  const XH = num('xh', 3.6);
  const FC = frameOnPath(0, crossing(FT, -14.1).s, XH);
  const C = { x0: -9.6, x1: 9.6, h: 12.0, z1: num('hz', -42.0), low: -1.2 };
  const vpl = FC.l(VP.x, VP.y);                                              // V の位置(広間の座標)
  const PAR_D = num('pard', 4.8), PAR_H = 1.1, zPar = vpl[1] - PAR_D;       // 腰壁の手前の面
  const zEdge = zPar - 0.3;                                                 // テラスの端(腰壁の奥の面)
  box(FC, C.x0 - 1.2, C.x1 + 1.2, -0.054, -0.004, zEdge, 1.2 + 1.5, 'floor');                         // テラスの床
  box(FC, C.x0 - 1.2, C.x1 + 1.2, C.low - 0.05, C.low, C.z1 - 1.5, zEdge, 'floor', C.low);            // 下の階の床
  box(FC, C.x0 - 1.2, C.x1 + 1.2, C.h, C.h + 0.45, C.z1, 1.2, 'ceil');
  wall(FC, 'z', C.x0 - 0.6, 1.2, zEdge, C.h, 1.2); wall(FC, 'z', C.x1 + 0.6, 1.2, zEdge, C.h, 1.2);   // 左右の壁(テラスの部分)
  box(FC, C.x0 - 1.2, C.x0, C.low, C.h, C.z1, zEdge, 'plain'); box(FC, C.x1, C.x1 + 1.2, C.low, C.h, C.z1, zEdge, 'plain');   // 左右の壁(下の階の部分。目地と巾木なし)
  /* クリニックタウン3D: 左の壁から、進む側へ 35° 振って張り出すのこぎり状の壁(天井まで)。その面の開口(4.8×3.0・窓台 1.2)の奥 0.9 に納める。先端は腰壁の手前で止まる */
  const CTT = (() => {
    const ang = num('cta', 35), zBack = num('ctz', -12.6), L2 = 3.0, th = 0.9;
    const u = [Math.sin(ang * DEG), -Math.cos(ang * DEG)], nrm = [Math.cos(ang * DEG), Math.sin(ang * DEG)];   // 面に沿って前へ・室内へ / 面の向き
    const b = [C.x0 + nrm[0] * th / 2, zBack + nrm[1] * th / 2];            // 張り出しの根元(壁に接する端)の芯
    const cl = [b[0] + u[0] * L2, b[1] + u[1] * L2];                          // 張り出しの壁の中心
    const Fk = frame(FC.a / DEG + 90 - ang, ...FC.w(cl[0], cl[1]));
    wall(Fk, 'x', 0, -L2, L2, C.h, th, [{ a: -2.4, b: 2.4, y0: 1.2, y1: 4.2 }]);
    const tip = [b[0] + u[0] * 2 * L2, b[1] + u[1] * 2 * L2];                // 先端から壁へ戻る面
    box(FC, C.x0, tip[0] + 0.2, 0, C.h, tip[1] - 0.45, tip[1] + 0.45);
    return Fk;
  })();
  box(FC, C.x0 - 1.2, C.x1 + 1.2, C.low, C.h, C.z1 - 1.2, C.z1, 'plain');   // 奥の壁(目地なし。V から見て格子の正面と同じ白に溶ける)
  wall(FC, 'x', 0.6, C.x0 - 1.2, C.x1 + 1.2, C.h, 1.2, [{ a: XH - 0.7, b: XH + num('hwr', 0.7), y0: 0, y1: 2.4 }]);   // 手前の壁(敷居2 の出口。口 1.4。右の袖は、チームの部屋から格子の正面の塗りを一直線に見通す線を切る)
  /* 腰壁: V の 4.8m 先を横切る高さ 1.1m の壁(下の階の床から立ち上がる)。V から見ると上端は地平線のすぐ下(y≈0.53H)で、
     BRIDGE と EXPAND CHOICES. はこの無地の面に載る。向こうに立つ柱と壁柱は、根元が腰壁に隠れる */
  box(FC, C.x0, C.x1, C.low, PAR_H, zEdge, zPar, 'col');
  /* 柱 1.2 角を 7.2m の格子に(x = −6.6 / 0.6 / 7.8)。z = −19.8 の列は下の格子に置き換え、下の階は中央の 14.4m を柱なしにする。
     奥の壁ぎわの一間(z = −34.2 の列)は置かない(V から見て、柱の縁がマークの端に接するため)。
     (0.6, −12.6) は V の右 1.45m に立ち、V の画角の外。近づく途中では、藍と砂をこの柱が隠す */
  const COLS = [[-6.6, -5.4, 0], [7.8, -5.4, 0], [7.8, -12.6, 0], [-6.6, -27.0, C.low], [7.8, -27.0, C.low]];
  if (Q.get('hider') !== '0') COLS.push([0.6, -12.6, 0]);
  for (const [x, z, y0] of COLS) box(FC, x - 0.6, x + 0.6, y0, C.h, z - 0.6, z + 0.6, 'col', y0);
  for (const z of [-5.4, -12.6, -27.0]) box(FC, C.x0, C.x1, C.h - 1.2, C.h, z - 0.3, z + 0.3);   // 柱の線上の梁 0.6×1.2
  /* 格子(藍と砂の手前の層): 腰壁の向こう、V から 6.0m 先に、広間の幅いっぱいの壁柱(見付け 0.3・奥行き 2.4・下の階の床から高さ 5.4、上端はテラスから 4.2m)を
     約 0.75m ごとに立てる。どの壁柱も V からの光線に沿わせる。V からは正面の幅しか見えず、奥の面と同じ白で消える(格子が開く)。
     V から外れると側面が重なって奥を隠す(近づく途中では格子が閉じていて、奥の藍と砂は見えない)。上端より上には広間の高さが見える */
  const BL_D = num('bld', 6.0), BL_W = num('blw', 0.3), BL_L = num('bll', 2.4), BL_P = num('blp', 0.75), BL_H = num('blh', 4.2);
  const JIT = [0, 0.09, -0.06, 0.12, -0.1, 0.04, -0.03, 0.08, -0.07, -0.16];   // 間隔の不揃い(決まった値)
  const zBl = vpl[1] - BL_D;
  for (let i = 0; ; i++) {
    const x = C.x0 + 0.6 + i * BL_P + JIT[i % JIT.length];
    if (x > C.x1 - 0.6) break;
    const [wx, wz] = FC.w(x, zBl);
    const Fb = frame(yawOfDir(wx - VPOS.x, wz - VPOS.z) / DEG, wx, wz);
    box(Fb, -BL_W / 2, BL_W / 2, C.low, BL_H, -BL_L, 0, 'plain');
  }

  // --- 写し(順番: 個人 → 個人 → チーム → チーム(奥の間) → 組織)。どれも使っている途中の状態 ---
  const PL = 'plates/';
  await plate(FI, { src: PL + 'compass-q-dark.webp', name: 'BRIDGE Compass', face: '+z', wallC: -8.3, th: 0.6, a0: 0.0, a1: 2.4, y0: 0, y1: 2.4 });
  await plate(TANA.plateFrame(), { src: PL + 'tanaoroshi-mid-light.webp', name: '経験の棚卸し', face: '+z', wallC: -0.05, th: 0.1, a0: -1.2, a1: 1.2, y0: 0.9, y1: 2.1, depth: 0.05 });
  await plate(FT, { src: PL + 'iikae-light.webp', name: '現場のことば 言いかえ帳', face: '+z', wallC: zTP, th: 0.9, a0: -2.7, a1: -0.3, y0: 0.6, y1: 2.4 });
  await plate(FT, { src: PL + 'keiji-light.webp', name: '掲示じたく', face: '+z', wallC: -11.25, th: 0.9, a0: -4.2, a1: -1.8, y0: 0.6, y1: 3.6 });
  await plate(CTT, { src: '../../images/products/shots/clinic-flow-3d-decision.webp', name: 'クリニックタウン3D', face: '+z', wallC: 0, th: 0.9, a0: -2.4, a1: 2.4, y0: 1.2, y1: 4.2, region: { x: 456, y: 540, w: 528, h: 330 } });

  /* ---- 交点の砂の板: 交点の前後 ±70px だけ、V から見た輪郭が砂の線そのもの(両端は正式の線と同じ丸い端)になる薄い板。
     材料は --dawn の平塗り(投影の塗りではない)。V から 4.2m、光線に沿って 0.03m。距離の地図には入れない。
     奥の砂はこの区間の内側 8px で止め、丸い端で閉じる(V からは板が端を隠す) ---- */
  const SAND_D = num('sandd', 4.2), GAP = 62;
  let SAND_CX = 0, sU0 = 0, sU1 = 1;
  {
    const N = 400, sp = [], np = [];
    for (let i = 0; i <= N; i++) { sp.push(bez(LOGO_S, i / N)); np.push(bez(LOGO_N, i / N)); }
    let best = 1e9, uc = 0;
    sp.forEach((p, i) => { for (const q of np) { const d = Math.hypot(p[0] - q[0], p[1] - q[1]); if (d < best) { best = d; uc = i / N; } } });
    const cpx = SAND_CX = vb2px(...bez(LOGO_S, uc))[0];
    for (let i = 0; i <= N; i++) { const x = vb2px(...sp[i])[0]; if (x < cpx - GAP) sU0 = i / N; if (x > cpx + GAP && sU1 === 1) sU1 = i / N; }
    const seg0 = []; for (let i = 0; i <= 160; i++) { const p = bez(LOGO_S, i / 160); if (Math.abs(vb2px(...p)[0] - cpx) <= 70) seg0.push(p); }
    const nrm = (a, b) => { const tx = b[0] - a[0], ty = b[1] - a[1], l = Math.hypot(tx, ty); return [-ty / l, tx / l]; };
    const hwv = 3.0, outline = [];
    const nAt = i => nrm(seg0[Math.max(0, i - 1)], seg0[Math.min(seg0.length - 1, i + 1)]);
    const cap = (p, n, sgn) => { for (let k = 1; k < 12; k++) { const a = Math.PI * k / 12, c = Math.cos(a), sn = Math.sin(a); const tx = n[1], ty = -n[0]; outline.push([p[0] + (n[0] * c + tx * sn) * hwv * sgn, p[1] + (n[1] * c + ty * sn) * hwv * sgn]); } };
    seg0.forEach((p, i) => { const n = nAt(i); outline.push([p[0] + n[0] * hwv, p[1] + n[1] * hwv]); });
    cap(seg0[seg0.length - 1], nAt(seg0.length - 1), 1);
    for (let i = seg0.length - 1; i >= 0; i--) { const p = seg0[i], n = nAt(i); outline.push([p[0] - n[0] * hwv, p[1] - n[1] * hwv]); }
    cap(seg0[0], nAt(0), -1);
    const n = outline.length, pos = [], idx = [];
    const tri = T.ShapeUtils.triangulateShape(outline.map(([x, y]) => new T.Vector2(x, -y)), []);
    for (const dd of [SAND_D, SAND_D + 0.03]) outline.forEach(([x, y]) => { const r = rayV(...vb2px(x, y)); const p = VPOS.clone().add(r.multiplyScalar(dd / -r.z)); pos.push(p.x, p.y, p.z); });
    tri.forEach(([a, b, c]) => { idx.push(a, b, c); idx.push(a + n, c + n, b + n); });
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; idx.push(i, j, i + n, j, j + n, i + n); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    const m = new T.Mesh(g, new T.MeshBasicMaterial({ color: F.lin(TOK.dawn), toneMapped: false, side: T.DoubleSide })); scene.add(m); sandOnly.push(m);
  }
  const polyU = (ctrl, u0, u1, n) => { const P = []; for (let i = 0; i <= n; i++) { const q = bez(ctrl, u0 + (u1 - u0) * i / n); P.push(new T.Vector2(q[0], q[1])); } return P; };
  PAINT.ptsS1.value = polyU(LOGO_S, 0, sU0, NSS); PAINT.ptsS2.value = polyU(LOGO_S, sU1, 1, NSS);

  /* ---- 距離の地図を焼く(交点の砂の板は入れない。藍も砂も、V から見える建築の面に塗る) ---- */
  scene.updateMatrixWorld(true);
  const distMat = new T.ShaderMaterial({
    uniforms: { eye: { value: VPOS } },
    vertexShader: 'varying vec3 wp; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); wp = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: 'uniform vec3 eye; varying vec3 wp; void main(){ gl_FragColor = vec4(distance(wp, eye), 0.0, 0.0, 1.0); }',
    side: T.DoubleSide,
  });
  function bakeDist(rt, hide) {
    const bg = scene.background; scene.background = null; scene.overrideMaterial = distMat;
    hide.forEach(o => { o.visible = false; });
    renderer.setRenderTarget(rt); renderer.setClearColor(new T.Color(1e6, 0, 0), 1); renderer.clear(); renderer.render(scene, V);
    renderer.setRenderTarget(null); scene.overrideMaterial = null; scene.background = bg; renderer.setClearColor(new T.Color(0, 0, 0), 1);
    hide.forEach(o => { o.visible = true; });
  }
  bakeDist(distN, sandOnly);
  PAINT.vp.value.multiplyMatrices(V.projectionMatrix, V.matrixWorldInverse);
  PAINT.eye.value.copy(VPOS);
  PAINT.on.value = 1;

  /* ---- 線の上の点(世界座標): 形成の測定用。藍・砂 各 33 点。交点の区間の砂は板の上、ほかは V の距離の地図から ---- */
  const strokeWorld = [];
  {
    const px1 = new Float32Array(4);
    for (const [k, ctrl] of [['n', LOGO_N], ['s', LOGO_S]]) for (let i = 0; i <= 32; i++) {
      const [px, py] = vb2px(...bez(ctrl, i / 32)), r = rayV(px, py);
      let d;
      if (k === 's' && Math.abs(px - SAND_CX) <= GAP) d = SAND_D / -r.z;
      else { renderer.readRenderTargetPixels(distN, Math.round(px * 2), Math.round((H - py) * 2), 1, 1, px1); d = px1[0]; }
      strokeWorld.push({ k, p: VPOS.clone().add(r.multiplyScalar(d)), target: [px, py], dist: d });
    }
  }

  /* ================================================================
     カメラ: 経路は上の直線。ヨーは注視点 FIXP への方位(V からマーク中心を通る光線の上、断片の奥行きの調和平均の距離。
     マーク全体の重心が最後の 1.5 秒でほとんど動かない)。直線と、その上にない一点の組み合わせなので、ヨーは単調に 0 へ向かう
     ================================================================ */
  const FIX_D = Q.has('fixd') ? +Q.get('fixd') : strokeWorld.length / strokeWorld.reduce((a, s) => a + 1 / s.dist, 0);
  const FIXP = VPOS.clone().add(rayV(MARK.cx, MARK.cy).multiplyScalar(FIX_D));
  const wrap = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  const DBG = Q.get('dbgcam') ? Q.get('dbgcam').split(',').map(Number) : null;   // 確認用: x,z,yaw で視点を固定する
  function camAt(t) {
    if (DBG) return { pos: new T.Vector3(DBG[0], EYE, DBG[1]), yaw: DBG[2] };
    const p = posAt(t);
    const yaw = t >= T_ARRIVE ? VYAW : yawOfDir(FIXP.x - p.x, FIXP.z - p.y);
    return { pos: new T.Vector3(p.x, EYE, p.y), yaw };
  }

  const cam = new T.PerspectiveCamera(vfov(W, H), W / H, 0.15, 400);
  cam.rotation.order = 'YXZ';

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
  const T_WM = 13.1, T_TG = 13.5;                                           // 止まって 0.3 秒はマークだけ
  function setPost(t) {
    WM.visible = t >= T_WM; WM.material.opacity = seg(t, T_WM, 0.3);
    TG.visible = t >= T_TG; TG.material.opacity = seg(t, T_TG, 0.3);
  }

  function draw(t) {
    const { pos, yaw } = camAt(t);
    cam.position.copy(pos); cam.rotation.set(0, yaw, 0);
    cam.updateMatrixWorld();
    return { scene, camera: cam, shift: [0, SHIFT_Y] };
  }

  /* ---- 真上からの見取り図(?top=1) ---- */
  const TOPS = 30, TCn = VP.clone().multiplyScalar(0.5);
  const topCam = new T.OrthographicCamera(-TOPS * W / H, TOPS * W / H, TOPS, -TOPS, 0.1, 200);
  topCam.position.set(TCn.x, 100, TCn.y); topCam.up.set(0, 0, -1); topCam.lookAt(TCn.x, 0, TCn.y);
  const pathLine = new T.Line(new T.BufferGeometry().setFromPoints(Array.from({ length: 200 }, (_, i) => { const p = camAt(i / 199 * T_ARRIVE).pos; return new T.Vector3(p.x, 14, p.z); })), new T.LineBasicMaterial({ color: F.lin(TOK.dawn) }));
  const marker = new T.Mesh(new T.ConeGeometry(0.5, 1.4, 3), new T.MeshBasicMaterial({ color: F.lin(TOK.navy) }));
  function drawTop(t) {
    const { pos, yaw } = camAt(t);
    PAINT.topMode.value = 1;
    for (const b of boxes) { const p = b.geometry.parameters; if (p && p.height && b.position.y > 2.6 && p.height < 1.3) b.visible = false; }   // 天井の版・梁を外す
    if (!pathLine.parent) { scene.add(pathLine); scene.add(marker); }
    marker.position.set(pos.x, 15, pos.z); marker.rotation.set(0, yaw, 0); marker.rotateX(-Math.PI / 2);
    return { scene, camera: topCam, shift: [0, 0] };
  }

  /* ---- 測る ---- */
  const tmp = new T.Vector3();
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
    return { cx, cy, width, ang, inFront: pts.every(p => p[2] < 1) };
  }
  /* 形成のずれ: 線の上の点(藍・砂 各 33 点)を今のカメラで写し、最終の位置へ相似変換(平行移動と一様な拡大)で
     最もよく重ねたときの残差(px @1920)。全体・藍だけ・砂だけの最大と中央値。重心は「滑り込み」を見る */
  function fitResidual(camera, pick) {
    const a = [], b = [];
    for (const s of strokeWorld) { if (pick && s.k !== pick) continue; const v = s.p.clone().project(camera); if (v.z > 1 || v.z < -1) continue; a.push([(v.x + 1) / 2 * W, (1 - v.y) / 2 * H]); b.push(s.target); }
    if (a.length < 10) return { max: -1, med: -1, cx: 0, cy: 0 };
    const n = a.length; let ax = 0, ay = 0, bx = 0, by = 0;
    for (let i = 0; i < n; i++) { ax += a[i][0]; ay += a[i][1]; bx += b[i][0]; by += b[i][1]; }
    ax /= n; ay /= n; bx /= n; by /= n;
    let nu = 0, de = 0;
    for (let i = 0; i < n; i++) { const p = a[i][0] - ax, q = a[i][1] - ay; nu += p * (b[i][0] - bx) + q * (b[i][1] - by); de += p * p + q * q; }
    const sc = nu / de, rs = [];
    for (let i = 0; i < n; i++) { const x = (a[i][0] - ax) * sc + bx, y = (a[i][1] - ay) * sc + by; rs.push(Math.hypot(x - b[i][0], y - b[i][1])); }
    rs.sort((p, q) => p - q);
    return { max: rs[n - 1], med: rs[n >> 1], cx: ax, cy: ay };
  }
  function formation(camera) {
    const all = fitResidual(camera, null), nv = fitResidual(camera, 'n'), sd = fitResidual(camera, 's');
    return { max: all.max, med: all.med, cx: all.cx, cy: all.cy, nMax: nv.max, nMed: nv.med, nCx: nv.cx, sMax: sd.max, sMed: sd.med, sCx: sd.cx };
  }
  function metrics(step = 1 / 30) {
    const out = [];
    for (let t = 0; t <= DUR + 1e-9; t += step) {
      draw(t); shiftProj(cam);
      const a = camAt(t), b = camAt(Math.min(DUR, t + 1 / FPS));
      const row = { t: +t.toFixed(3), v: +(a.pos.distanceTo(b.pos) * FPS).toFixed(3), yaw: +a.yaw.toFixed(4), yawRate: +(wrap(b.yaw - a.yaw) * FPS * 180 / Math.PI).toFixed(2), plates: [] };
      const hd = new T.Vector3().subVectors(b.pos, a.pos); if (hd.length() > 1e-6) row.crab = +((wrap(yawOfDir(hd.x, hd.z) - a.yaw)) * 180 / Math.PI).toFixed(1);
      plates.forEach((P, k) => { const pr = projectPlate(P, cam); row.plates.push({ k, w: Math.round(pr.width), ang: Math.round(pr.ang), cx: Math.round(pr.cx), cy: Math.round(pr.cy), front: pr.inFront }); });
      const f = formation(cam); row.form = Object.fromEntries(Object.entries(f).map(([k, v]) => [k, Math.round(v || 0)]));
      out.push(row);
    }
    cam.updateProjectionMatrix();
    return out;
  }

  /* ---- 同時に見える写しの数(1px 以上)。写しだけに色を付けた小さな画で数える ---- */
  const idRT = new T.WebGLRenderTarget(480, Math.round(480 * H / W), { stencilBuffer: true });
  const idBlack = new T.MeshBasicMaterial({ color: 0x000000 });
  const idMats = plates.map((P, i) => new T.MeshBasicMaterial({ color: new T.Color().setHSL(i / plates.length, 1, 0.5) }));
  function visibleCounts(t) {
    draw(t); shiftProj(cam);
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
  /* ---- 藍・砂・背景のクリア色が何 px 見えているか(既定は 480px の画・ぼけなし。写しは数えない) ---- */
  const PCW = num('pcw', 480), pcRT = new T.WebGLRenderTarget(PCW, Math.round(PCW * H / W), { stencilBuffer: true });   // ?pcw=1920 で等倍で数える
  function paintCount(t) {
    draw(t); shiftProj(cam);
    plates.forEach(P => { P.mesh.visible = false; });
    const bg = scene.background; scene.background = new T.Color(1, 0, 1);
    renderer.setRenderTarget(pcRT); renderer.render(scene, cam); renderer.setRenderTarget(null); cam.updateProjectionMatrix();
    scene.background = bg; plates.forEach(P => { P.mesh.visible = true; });
    const px = new Uint8Array(pcRT.width * pcRT.height * 4);
    renderer.readRenderTargetPixels(pcRT, 0, 0, pcRT.width, pcRT.height, px);
    const tgt = [TOK.navy, TOK.dawn].map(h => { const c = F.lin(h); return [c.r * 255, c.g * 255, c.b * 255]; });
    const n = [0, 0, 0];
    for (let i = 0; i < px.length; i += 4) {
      if (px[i] > 250 && px[i + 1] < 5 && px[i + 2] > 250) { n[2]++; continue; }
      tgt.forEach((c, k) => { if (Math.abs(px[i] - c[0]) + Math.abs(px[i + 1] - c[1]) + Math.abs(px[i + 2] - c[2]) < 24) n[k]++; });
    }
    return n;
  }

  /* ---- 書き出し用の口 ---- */
  const TOP = Q.has('top');
  function renderFrame(t, samples = 16, fps = FPS) {
    setPost(t);
    R.renderFrame(t, samples, 0.5, fps, TOP ? drawTop : draw, TOP ? null : post);
  }
  if (Q.has('dbg')) window.FILM_DBG = { scene, cam, draw, T, FC, VPOS };
  window.FILM = { W, H, FPS, DUR, ready: Promise.resolve(true), renderFrame, out: canvas, camAt, plates, metrics, visibleCounts, paintCount, TOK, CRUISE: V0, PATHLEN: LEN, FIX_D: +FIX_D.toFixed(2), hallV: vpl.map(v => +v.toFixed(2)), hallS0: +crossing(FT, -14.1).s.toFixed(2), strokeDepths: strokeWorld.map(s => s.k + ':' + s.dist.toFixed(1)) };

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
