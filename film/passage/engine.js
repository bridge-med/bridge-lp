/* ================================================================
   engine.js — 時刻 t だけで 1 枚が決まる three.js の描画器
   - 同じ t なら何度描いても同じ絵(書き出しと確認用の静止画が一致する)
   - 動きのぼけ: シャッターの開いている間のサブフレームを「線形光」で平均する
     (PR131「一本の線」の蓄積器と同じ考え方。sRGB のまま平均すると暗部が濁る)
   - アンチエイリアス: サブフレームごとにサブピクセルずらす(Halton 列)+ 4x MSAA
   - 色はここでは決めない(場面の側がトークンの値だけを渡す)
   依存: three.js r128(clinic-flow-3d/vendor/three.min.js。UMD・global THREE)
   ================================================================ */
(function () {
  'use strict';
  const T = window.THREE;

  /* ---- 数と緩急 ---- */
  const clamp = (x, a = 0, b = 1) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, u) => a + (b - a) * u;
  const smooth = u => u * u * (3 - 2 * u);
  /* cubic-bezier を表で引く(両端で厳密に 0 と 1) */
  function bezier(x1, y1, x2, y2) {
    const bx = s => 3 * (1 - s) * (1 - s) * s * x1 + 3 * (1 - s) * s * s * x2 + s * s * s;
    const by = s => 3 * (1 - s) * (1 - s) * s * y1 + 3 * (1 - s) * s * s * y2 + s * s * s;
    const N = 2048, lut = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      const u = i / N; let lo = 0, hi = 1;
      for (let k = 0; k < 40; k++) { const m = (lo + hi) / 2; if (bx(m) < u) lo = m; else hi = m; }
      lut[i] = by((lo + hi) / 2);
    }
    return u => { if (u <= 0) return 0; if (u >= 1) return 1; const f = u * N, i = Math.floor(f); return lut[i] + (lut[i + 1] - lut[i]) * (f - i); };
  }
  const EASE = {
    lin: u => u,
    /* サイトの --ease = cubic-bezier(.16,1,.3,1)。減速はすべてこれ */
    site: bezier(0.16, 1, 0.3, 1),
    /* 加速(--ease の時間反転)。止まっている物が動き出すとき */
    siteIn: (() => { const f = bezier(0.16, 1, 0.3, 1); return u => 1 - f(1 - u); })(),
    inOut: bezier(0.65, 0, 0.35, 1),
    sineInOut: u => (1 - Math.cos(Math.PI * u)) / 2,
  };
  const seg = (t, a, d, e = EASE.lin) => e(clamp((t - a) / d));

  /* ---- 時刻つきキーフレームのエルミート補間(C1。速度が連続する)。keys: [{t, v:[...]}]。
       端の速度: 最初は隣から、最後の鍵に stop:true があれば 0 ---- */
  function hermite(keys) {
    const n = keys.length, dim = keys[0].v.length;
    const m = keys.map((k, i) => {
      if (i === n - 1 && k.stop) return new Array(dim).fill(0);
      if (k.hold) return new Array(dim).fill(0);
      const a = keys[Math.max(0, i - 1)], b = keys[Math.min(n - 1, i + 1)];
      return k.v.map((_, d) => (b.v[d] - a.v[d]) / (b.t - a.t));
    });
    return t => {
      if (t <= keys[0].t) { const k = keys[0]; return k.v.map((v, d) => v + m[0][d] * (t - k.t)); }
      if (t >= keys[n - 1].t) return keys[n - 1].v.slice();
      let i = 0; while (t > keys[i + 1].t) i++;
      const a = keys[i], b = keys[i + 1], h = b.t - a.t, u = (t - a.t) / h;
      const h00 = 2 * u * u * u - 3 * u * u + 1, h10 = u * u * u - 2 * u * u + u, h01 = -2 * u * u * u + 3 * u * u, h11 = u * u * u - u * u;
      return a.v.map((_, d) => h00 * a.v[d] + h10 * h * m[i][d] + h01 * b.v[d] + h11 * h * m[i + 1][d]);
    };
  }

  /* ---- 色: sRGB の hex → 線形の THREE.Color ---- */
  const lin = hex => new T.Color(hex).convertSRGBToLinear();

  /* ---- 文字の板(Canvas 2D で描いて貼る。フォントは読み込み済みであること) ---- */
  function textCanvas({ text, font, px, color, tracking = 0, pad = 0.25 }) {
    const c = document.createElement('canvas');
    const x = c.getContext('2d');
    x.font = `${font.replace('{px}', px + 'px')}`;
    x.textRendering = 'geometricPrecision';
    const glyphs = [...text];
    const trackPx = tracking * px;
    let w = 0;
    const adv = glyphs.map(g => { const a = x.measureText(g).width; w += a + trackPx; return a; });
    w -= trackPx;
    const m = x.measureText(text);
    const asc = Math.ceil(m.actualBoundingBoxAscent || px * 0.9), desc = Math.ceil(m.actualBoundingBoxDescent || px * 0.25);
    const P = Math.ceil(px * pad);
    c.width = Math.ceil(w) + P * 2; c.height = asc + desc + P * 2;
    x.font = `${font.replace('{px}', px + 'px')}`;
    x.textRendering = 'geometricPrecision';
    x.fillStyle = color; x.textBaseline = 'alphabetic';
    let cx = P;
    glyphs.forEach((g, i) => { x.fillText(g, cx, P + asc); cx += adv[i] + trackPx; });
    return { canvas: c, w: c.width, h: c.height, inkW: w, asc, desc, pad: P };
  }
  /* passThrough: 蓄積の外で画面へ直接重ねる層(sRGB の値をそのまま出す)に使う */
  function canvasTexture(canvas, renderer, passThrough = false) {
    const tx = new T.CanvasTexture(canvas);
    tx.encoding = passThrough ? T.LinearEncoding : T.sRGBEncoding;
    tx.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tx.minFilter = T.LinearMipmapLinearFilter;
    tx.generateMipmaps = true;
    return tx;
  }
  async function imageTexture(url, renderer) {
    const tx = await new T.TextureLoader().loadAsync(url);
    tx.encoding = T.sRGBEncoding;
    tx.anisotropy = renderer.capabilities.getMaxAnisotropy();
    tx.minFilter = T.LinearMipmapLinearFilter;
    tx.generateMipmaps = true;
    return tx;
  }

  /* ---- 低食い違い列(サブフレームのずらし) ---- */
  const halton = (i, b) => { let f = 1, r = 0; while (i > 0) { f /= b; r += f * (i % b); i = Math.floor(i / b); } return r; };

  /* ---- 描画器 ---- */
  function createRenderer({ canvas, W, H, msaa = 0, sceneType = 'u8', accType = 'float' }) {
    const renderer = new T.WebGLRenderer({ canvas, antialias: false, alpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.setSize(W, H, false);
    renderer.outputEncoding = T.LinearEncoding;   // 最後の一枚で自前に sRGB へ
    renderer.toneMapping = T.NoToneMapping;
    renderer.sortObjects = true;
    const gl = renderer.getContext();
    const isGL2 = renderer.capabilities.isWebGL2;
    const floatOK = isGL2 && !!gl.getExtension('EXT_color_buffer_float');
    const TYPE = accType === 'float' && floatOK ? T.FloatType : T.HalfFloatType;
    /* 場面は 8bit の sRGB で受ける(SwiftShader では浮動小数の的が重い)。蓄積の段で線形へ戻して足す */
    const sceneOpts = { type: sceneType === 'half' ? T.HalfFloatType : T.UnsignedByteType, format: T.RGBAFormat, encoding: sceneType === 'half' ? T.LinearEncoding : T.sRGBEncoding };
    const sceneRT = isGL2 && msaa > 0
      ? new T.WebGLMultisampleRenderTarget(W, H, { ...sceneOpts, samples: msaa })
      : new T.WebGLRenderTarget(W, H, sceneOpts);
    const sceneIsSRGB = sceneOpts.encoding === T.sRGBEncoding;
    const accA = new T.WebGLRenderTarget(W, H, { type: TYPE, format: T.RGBAFormat, depthBuffer: false, minFilter: T.NearestFilter, magFilter: T.NearestFilter });
    const accB = accA.clone();

    const quadCam = new T.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quadGeo = new T.PlaneGeometry(2, 2);
    const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
    /* 蓄積: acc_new = acc_old + frame * w(ブレンドに頼らない往復。Float でもブレンド拡張が要らない) */
    const accMat = new T.ShaderMaterial({
      uniforms: { prev: { value: null }, cur: { value: null }, w: { value: 1 }, first: { value: 1 }, srgb: { value: sceneIsSRGB ? 1 : 0 } },
      vertexShader: VS,
      fragmentShader: 'uniform sampler2D prev; uniform sampler2D cur; uniform float w; uniform float first; uniform float srgb; varying vec2 vUv;' +
        'vec3 dec(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(vec3(0.04045), c)); }' +
        'void main(){ vec3 p = first > 0.5 ? vec3(0.0) : texture2D(prev, vUv).rgb; vec3 c = texture2D(cur, vUv).rgb; if (srgb > 0.5) c = dec(c); gl_FragColor = vec4(p + c * w, 1.0); }',
      depthTest: false, depthWrite: false,
    });
    /* 出力: 線形 → sRGB(区分関数)。量子化の縞を避けるため ±0.5/255 のディザ。模様は固定(静止区間で地が沸かない) */
    const outMat = new T.ShaderMaterial({
      uniforms: { src: { value: null } },
      vertexShader: VS,
      fragmentShader: 'uniform sampler2D src; varying vec2 vUv;' +
        'float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }' +
        'vec3 enc(vec3 c){ c = clamp(c, 0.0, 1.0); return mix(c * 12.92, 1.055 * pow(c, vec3(1.0/2.4)) - 0.055, step(vec3(0.0031308), c)); }' +
        'void main(){ vec3 c = enc(texture2D(src, vUv).rgb); c += (h(gl_FragCoord.xy) - 0.5) / 255.0; gl_FragColor = vec4(c, 1.0); }',
      depthTest: false, depthWrite: false,
    });
    const accScene = new T.Scene(); accScene.add(new T.Mesh(quadGeo, accMat));
    const outScene = new T.Scene(); outScene.add(new T.Mesh(quadGeo, outMat));

    /* ずらし(ジッタ)とレンズシフトは、投影行列の非対称化で足す(setViewOffset は1つしか持てないため)。
       sx, sy は「絵が右へ・下へ動く」向きの px */
    function offsetProjection(camera, sx, sy) {
      camera.updateProjectionMatrix();
      const e = camera.projectionMatrix.elements;
      if (camera.isPerspectiveCamera) { e[8] -= 2 * sx / W; e[9] += 2 * sy / H; }
      else { e[12] += 2 * sx / W; e[13] -= 2 * sy / H; }
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    }

    /* draw(ts) は { scene, camera, shift:[px,py] } を返す。
       post は蓄積の後に整数画素で重ねる層(文字など。ぼけ・ずらしの外で常に鋭く)。{ scene, camera } */
    function renderFrame(t, samples, shutter, fps, draw, post = null) {
      const n = Math.max(1, samples | 0);
      let src = accA, dst = accB;
      for (let i = 0; i < n; i++) {
        const u = n === 1 ? 0 : (i + 0.5) / n - 0.5;             // 中心のシャッター
        const ts = t + u * shutter / fps;
        const jx = n === 1 ? 0 : halton(i + 1, 2) - 0.5, jy = n === 1 ? 0 : halton(i + 1, 3) - 0.5;
        const { scene, camera, shift } = draw(ts);
        offsetProjection(camera, jx + (shift ? shift[0] : 0), jy + (shift ? shift[1] : 0));
        renderer.setRenderTarget(sceneRT);
        renderer.render(scene, camera);
        camera.updateProjectionMatrix();
        accMat.uniforms.prev.value = src.texture;
        accMat.uniforms.cur.value = sceneRT.texture;
        accMat.uniforms.w.value = 1 / n;
        accMat.uniforms.first.value = i === 0 ? 1 : 0;
        renderer.setRenderTarget(dst);
        renderer.render(accScene, quadCam);
        const tmp = src; src = dst; dst = tmp;
      }
      outMat.uniforms.src.value = src.texture;
      renderer.setRenderTarget(null);
      renderer.render(outScene, quadCam);
      if (post) {
        renderer.autoClear = false;
        renderer.render(post.scene, post.camera);
        renderer.autoClear = true;
      }
    }
    return { renderer, renderFrame, floatOK, isGL2 };
  }

  window.FilmEngine = { clamp, lerp, smooth, bezier, EASE, seg, hermite, lin, textCanvas, canvasTexture, imageTexture, createRenderer, halton };
})();
