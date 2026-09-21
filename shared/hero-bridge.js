/* ================================================================
   Home hero — 正式ロゴの「交差する二本の線」を、ガラスのリボンとして立体に起こす。
   素の WebGL(依存なし・約10KB)。二本の線は交差するが接続しない(第24条)。

   使い方:
     <div class="hb" data-hero-bridge>
       <img class="hb-poster" src="…/hero-bridge.webp" alt="">   ← WebGL が使えない/描画前の静止画
       <canvas class="hb-canvas" aria-hidden="true"></canvas>
     </div>
     <script src="…/shared/hero-bridge.js" defer></script>

   守っていること:
   - 通常スクロールを乗っ取らない(scrollY を読むだけ)
   - 画面外・非表示タブでは描画を止める(IntersectionObserver + visibilitychange)
   - prefers-reduced-motion では静止した1枚を描くだけ(スクロール・時間・ポインタの追従なし)
   - 失敗したら何もせず静止画のまま(本文とボタンはこの script と無関係に最初から使える)
   - 色は CSS トークン(--hb-deep / --hb-mid / --hb-mint / --hb-sky)、置き方と濃さは --hb-dist/-x/-y/-scale/-alpha から読む=ライト/ダークに追従
   ================================================================ */
(function () {
  'use strict';
  const host = document.querySelector('[data-hero-bridge]');
  if (!host) return;
  const canvas = host.querySelector('canvas');
  if (!canvas) return;
  const CAPTURE = !!window.HERO_BRIDGE_CAPTURE; // 静止画の事前レンダリング用(scripts側が立てる)
  const reduced = !CAPTURE && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;

  let gl = null;
  try {
    gl = canvas.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: true, depth: true, powerPreference: 'low-power', preserveDrawingBuffer: CAPTURE });
  } catch (e) { gl = null; }
  if (!gl) return;

  /* ---------- shaders ---------- */
  const VS = [
    'attribute vec3 aPos; attribute vec3 aNrm; attribute vec2 aUv; attribute float aKind;',
    'uniform mat4 uProj; uniform mat4 uView; uniform mat4 uModel;',
    'varying vec3 vPos; varying vec3 vNrm; varying vec2 vUv; varying float vKind;',
    'void main(){',
    '  vec4 w = uModel * vec4(aPos,1.0); vPos = w.xyz;',
    '  vNrm = mat3(uModel) * aNrm; vUv = aUv; vKind = aKind;',
    '  gl_Position = uProj * uView * w;',
    '}'
  ].join('\n');
  const FS = [
    'precision mediump float;',
    'uniform vec3 uCam; uniform vec3 uDeep; uniform vec3 uMid; uniform vec3 uMint; uniform vec3 uSky; uniform float uReveal; uniform float uDark; uniform float uAlpha;',
    'varying vec3 vPos; varying vec3 vNrm; varying vec2 vUv; varying float vKind;',
    'void main(){',
    '  float edge = smoothstep(uReveal, uReveal - 0.06, vUv.x);',
    '  if (edge <= 0.001) discard;',
    '  vec3 N = normalize(vNrm); if (!gl_FrontFacing) N = -N;',
    '  vec3 V = normalize(uCam - vPos);',
    '  float ndv = max(dot(N, V), 0.0);',
    '  float fr = pow(1.0 - ndv, 3.0);',
    '  vec3 L1 = normalize(vec3(0.35, 0.9, 0.55)); vec3 H1 = normalize(L1 + V);',
    '  vec3 L2 = normalize(vec3(-0.7, 0.25, -0.3)); vec3 H2 = normalize(L2 + V);',
    '  float sp = pow(max(dot(N, H1), 0.0), 120.0) * 0.9 + pow(max(dot(N, H2), 0.0), 36.0) * 0.28;',
    '  vec3 R = reflect(-V, N); float sky = smoothstep(-0.25, 0.85, R.y);',
    '  vec3 env = mix(uDeep, uSky, sky);',
    '  float g = smoothstep(0.0, 1.0, vUv.x);',
    '  vec3 tint = mix(uDeep, uMid, g);',
    '  tint = mix(tint, uMint, pow(sky, 3.0) * 0.55);',
    '  float a = uAlpha + fr * 0.55;',
    '  vec3 col = tint * (0.62 + 0.38 * sky) + env * fr * 0.55 + uSky * sp;',
    '  if (vKind > 0.5) { a = min(1.0, a + 0.38); col = mix(col, uMint, 0.45) + uSky * sp; }',
    '  a *= edge;',
    '  gl_FragColor = vec4(col * a, a);',
    '}'
  ].join('\n');
  function compile(type, src) {
    const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) { throw new Error(gl.getShaderInfoLog(s)); }
    return s;
  }
  let prog;
  try {
    prog = gl.createProgram();
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VS));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FS));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog));
  } catch (e) { return; }
  gl.useProgram(prog);
  const A = { pos: gl.getAttribLocation(prog, 'aPos'), nrm: gl.getAttribLocation(prog, 'aNrm'), uv: gl.getAttribLocation(prog, 'aUv'), kind: gl.getAttribLocation(prog, 'aKind') };
  const U = {};
  ['uProj', 'uView', 'uModel', 'uCam', 'uDeep', 'uMid', 'uMint', 'uSky', 'uReveal', 'uDark', 'uAlpha'].forEach(n => { U[n] = gl.getUniformLocation(prog, n); });

  /* ---------- tiny vector / matrix helpers ---------- */
  const v3 = (x, y, z) => [x, y, z];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
  function perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2), nf = 1 / (near - far);
    return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
  }
  function lookAt(eye, at, up) {
    const z = norm(sub(eye, at)), x = norm(cross(up, z)), y = cross(z, x);
    return new Float32Array([x[0], y[0], z[0], 0, x[1], y[1], z[1], 0, x[2], y[2], z[2], 0, -dot(x, eye), -dot(y, eye), -dot(z, eye), 1]);
  }
  function mat(rx, ry, rz, t, s) {
    const cx = Math.cos(rx), sx = Math.sin(rx), cy = Math.cos(ry), sy = Math.sin(ry), cz = Math.cos(rz), sz = Math.sin(rz);
    // R = Ry * Rx * Rz (column-major)
    const m00 = cy * cz + sy * sx * sz, m01 = cx * sz, m02 = -sy * cz + cy * sx * sz;
    const m10 = -cy * sz + sy * sx * cz, m11 = cx * cz, m12 = sy * sz + cy * sx * cz;
    const m20 = sy * cx, m21 = -sx, m22 = cy * cx;
    return new Float32Array([m00 * s, m01 * s, m02 * s, 0, m10 * s, m11 * s, m12 * s, 0, m20 * s, m21 * s, m22 * s, 0, t[0], t[1], t[2], 1]);
  }

  /* ---------- ribbon geometry(3次ベジェの連結 → 平行移動フレーム → 厚みのある板) ---------- */
  function bezier(p0, p1, p2, p3, t) {
    const u = 1 - t;
    return add(add(mul(p0, u * u * u), mul(p1, 3 * u * u * t)), add(mul(p2, 3 * u * t * t), mul(p3, t * t * t)));
  }
  function ribbon(segs, opt) {
    const N = 180, ctrl = segs.length;
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const t = i / N, k = Math.min(ctrl - 1, Math.floor(t * ctrl)), lt = t * ctrl - k;
      const s = segs[k];
      pts.push(bezier(s[0], s[1], s[2], s[3], lt));
    }
    const pos = [], nrm = [], uv = [], kind = [], idx = [];
    let n = null;
    let prevT = null;
    const frames = [];
    for (let i = 0; i <= N; i++) {
      const tng = norm(sub(pts[Math.min(N, i + 1)], pts[Math.max(0, i - 1)]));
      if (!n) { n = norm(cross(tng, [0, 0, 1])); if (Math.hypot(n[0], n[1], n[2]) < 1e-3) n = [1, 0, 0]; }
      else { // parallel transport
        const b = cross(prevT, tng); const bl = Math.hypot(b[0], b[1], b[2]);
        if (bl > 1e-6) {
          const ax = mul(b, 1 / bl), ang = Math.acos(Math.max(-1, Math.min(1, dot(prevT, tng))));
          const c = Math.cos(ang), s = Math.sin(ang);
          n = add(add(mul(n, c), mul(cross(ax, n), s)), mul(ax, dot(ax, n) * (1 - c)));
        }
      }
      prevT = tng;
      const t = i / N;
      const tw = opt.twist0 + (opt.twist1 - opt.twist0) * t + Math.sin(t * Math.PI * opt.wave) * opt.waveAmp;
      const bn = cross(tng, n);
      const c = Math.cos(tw), s = Math.sin(tw);
      const side = norm(add(mul(n, c), mul(bn, s)));      // 幅方向
      const face = norm(cross(tng, side));                  // 面の法線
      const w = opt.w0 + (opt.w1 - opt.w0) * Math.sin(t * Math.PI) * (1 - opt.wFlat) + (opt.w1 - opt.w0) * opt.wFlat;
      frames.push({ p: pts[i], side, face, w, t });
    }
    const th = opt.th;
    // 4本のストリップ(上面・下面・側面2)。各ストリップは2頂点/断面
    const strips = [
      { off: (f) => mul(f.face, th / 2), n: (f) => f.face, k: 0, s: 1 },
      { off: (f) => mul(f.face, -th / 2), n: (f) => mul(f.face, -1), k: 0, s: -1 },
      { off: (f) => mul(f.side, f.w / 2), n: (f) => f.side, k: 1, s: 0 },
      { off: (f) => mul(f.side, -f.w / 2), n: (f) => mul(f.side, -1), k: 1, s: 0 },
    ];
    let base = 0;
    strips.forEach(st => {
      for (let i = 0; i <= N; i++) {
        const f = frames[i];
        let a, b;
        if (st.k === 0) { a = add(add(f.p, st.off(f)), mul(f.side, f.w / 2)); b = add(add(f.p, st.off(f)), mul(f.side, -f.w / 2)); }
        else { a = add(add(f.p, st.off(f)), mul(f.face, th / 2)); b = add(add(f.p, st.off(f)), mul(f.face, -th / 2)); }
        const nn = st.n(f);
        pos.push(a[0], a[1], a[2], b[0], b[1], b[2]);
        nrm.push(nn[0], nn[1], nn[2], nn[0], nn[1], nn[2]);
        uv.push(f.t, 0, f.t, 1); kind.push(st.k, st.k);
        if (i < N) {
          const o = base + i * 2;
          if (st.s >= 0) idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2);
          else idx.push(o, o + 2, o + 1, o + 1, o + 2, o + 3);
        }
      }
      base += (N + 1) * 2;
    });
    const buf = (arr, size, loc) => {
      const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr), gl.STATIC_DRAW);
      return { b, size, loc };
    };
    const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(idx), gl.STATIC_DRAW);
    return { attrs: [buf(pos, 3, A.pos), buf(nrm, 3, A.nrm), buf(uv, 2, A.uv), buf(kind, 1, A.kind)], ib, count: idx.length };
  }

  // 二本の線。ロゴ(藍: 8,74→176,84 のアーチ / 砂: 58,94→232,12 の上昇)を 3D に。交差するが接続しない
  const arch = ribbon([
    [v3(-3.2, -3.6, -0.6), v3(-2.2, -1.2, -0.5), v3(-0.8, 1.4, -0.1), v3(0.8, 1.65, 0.1)],
    [v3(0.8, 1.65, 0.1), v3(2.24, 1.875, 0.28), v3(4.4, 0.3, 0.5), v3(5.8, -2.6, 0.6)],
  ], { w0: 0.36, w1: 0.68, wFlat: 0.2, th: 0.13, twist0: -0.55, twist1: 0.3, wave: 1.0, waveAmp: 0.1 });
  const rise = ribbon([
    [v3(0.0, -3.8, 0.9), v3(0.6, -2.4, 0.7), v3(1.0, -0.9, 0.35), v3(2.0, 0.35, 0.05)],
    [v3(2.0, 0.35, 0.05), v3(2.9, 1.475, -0.22), v3(4.4, 2.9, -0.55), v3(6.0, 4.0, -0.8)],
  ], { w0: 0.28, w1: 0.52, wFlat: 0.3, th: 0.11, twist0: 0.45, twist1: -0.3, wave: 1.0, waveAmp: -0.12 });

  /* ---------- colors from CSS tokens(ライト/ダーク追従) ---------- */
  const parse = (s) => {
    s = (s || '').trim();
    let m = /^#([0-9a-f]{6})$/i.exec(s);
    if (m) { const n = parseInt(m[1], 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
    m = /^#([0-9a-f]{3})$/i.exec(s);
    if (m) return [parseInt(m[1][0] + m[1][0], 16) / 255, parseInt(m[1][1] + m[1][1], 16) / 255, parseInt(m[1][2] + m[1][2], 16) / 255];
    m = /rgba?\(([^)]+)\)/.exec(s);
    if (m) { const p = m[1].split(/[\s,\/]+/).map(Number); return [p[0] / 255, p[1] / 255, p[2] / 255]; }
    return null;
  };
  let cols = {}, lay = { dist: 9.5, x: 0.9, y: 0, scale: 1 };
  function readColors() {
    const cs = getComputedStyle(host);
    const g = (n, d) => parse(cs.getPropertyValue(n)) || d;
    const num = (n, d) => { const v = parseFloat(cs.getPropertyValue(n)); return isNaN(v) ? d : v; };
    // 置き方は CSS 側で決める(PC とスマホで構図を変えるため)
    lay = { dist: num('--hb-dist', 9.5), x: num('--hb-x', 0.9), y: num('--hb-y', 0), scale: num('--hb-scale', 1), alpha: num('--hb-alpha', 0.34) };
    cols = {
      deep: g('--hb-deep', [0.05, 0.27, 0.27]),
      mid: g('--hb-mid', [0.13, 0.48, 0.45]),
      mint: g('--hb-mint', [0.68, 0.9, 0.82]),
      sky: g('--hb-sky', [0.98, 0.98, 0.96]),
      dark: document.documentElement.getAttribute('data-theme') === 'dark' ? 1 : 0,
    };
  }
  readColors();
  new MutationObserver(() => { readColors(); dirty = true; }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------- state ---------- */
  let W = 1, H = 1, dpr = 1, dirty = true, running = false, raf = 0, visible = true;
  let t0 = performance.now(), reveal = reduced || CAPTURE ? 1 : 0;
  const ptr = { x: 0, y: 0, tx: 0, ty: 0 };
  function resize() {
    readColors();
    const r = host.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, coarse ? 1.5 : 2);
    W = Math.max(1, Math.round(r.width * dpr)); H = Math.max(1, Math.round(r.height * dpr));
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    dirty = true;
  }
  resize();
  window.addEventListener('resize', () => { resize(); schedule(); }, { passive: true });

  if (!reduced && !coarse) {
    window.addEventListener('pointermove', (e) => {
      ptr.tx = (e.clientX / window.innerWidth - 0.5) * 2;
      ptr.ty = (e.clientY / window.innerHeight - 0.5) * 2;
      schedule();
    }, { passive: true });
  }
  if (!reduced) window.addEventListener('scroll', schedule, { passive: true });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); else schedule(); });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) schedule(); else stop(); }, { threshold: 0 }).observe(host);
  }

  function scrollProgress() {
    const h = host.getBoundingClientRect().height || 1;
    return Math.max(0, Math.min(1, window.scrollY / h));
  }

  function draw(now) {
    const dt = (now - t0) / 1000;
    if (!reduced) {
      ptr.x += (ptr.tx - ptr.x) * 0.06; ptr.y += (ptr.ty - ptr.y) * 0.06;
      if (reveal < 1) reveal = Math.min(1, dt / 1.6);
    }
    const p = reduced ? 0 : scrollProgress();
    const time = reduced ? 0 : dt;

    gl.viewport(0, 0, W, H);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.enable(gl.CULL_FACE);

    const aspect = W / H;
    const fov = 0.52;
    const eye = [0.3, 0.35, lay.dist];
    gl.uniformMatrix4fv(U.uProj, false, perspective(fov, aspect, 0.5, 40));
    gl.uniformMatrix4fv(U.uView, false, lookAt(eye, [0.3, 0.1, 0], [0, 1, 0]));
    gl.uniform3fv(U.uCam, eye);
    gl.uniform3fv(U.uDeep, cols.deep); gl.uniform3fv(U.uMid, cols.mid); gl.uniform3fv(U.uMint, cols.mint); gl.uniform3fv(U.uSky, cols.sky);
    gl.uniform1f(U.uReveal, reveal); gl.uniform1f(U.uDark, cols.dark); gl.uniform1f(U.uAlpha, lay.alpha);

    const ease = 1 - Math.pow(1 - reveal, 3);
    const ry = -0.42 + ptr.x * 0.07 + p * 0.55 + (1 - ease) * 0.35;
    const rx = 0.16 + ptr.y * 0.05 - p * 0.12;
    const ty = lay.y - p * 1.1 + Math.sin(time * 0.5) * 0.04;
    const scale = lay.scale;
    const draws = [
      { g: rise, m: mat(rx, ry + 0.02, 0.03 + Math.sin(time * 0.37) * 0.015, [lay.x + 0.15, ty + 0.05 + Math.sin(time * 0.61) * 0.03, 0], scale) },
      { g: arch, m: mat(rx, ry, -0.02 + Math.sin(time * 0.29) * 0.015, [lay.x, ty, 0], scale) },
    ];
    draws.forEach(d => {
      gl.uniformMatrix4fv(U.uModel, false, d.m);
      d.g.attrs.forEach(a => { gl.bindBuffer(gl.ARRAY_BUFFER, a.b); gl.enableVertexAttribArray(a.loc); gl.vertexAttribPointer(a.loc, a.size, gl.FLOAT, false, 0, 0); });
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, d.g.ib);
      gl.cullFace(gl.FRONT); gl.drawElements(gl.TRIANGLES, d.g.count, gl.UNSIGNED_SHORT, 0);
      gl.cullFace(gl.BACK); gl.drawElements(gl.TRIANGLES, d.g.count, gl.UNSIGNED_SHORT, 0);
    });
    host.classList.add('hb-ready');
    dirty = false;
    if (CAPTURE) { window.HERO_BRIDGE_DONE = true; }
  }

  function frame(now) {
    raf = 0;
    if (!visible || document.hidden) { running = false; return; }
    draw(now);
    // 可視中は回し続ける(時間で揺れるため)。reduced と静止画の事前レンダでは1枚描いて止まる。
    // 画面外・非表示タブは stop() で止める(上の visible / document.hidden の判定)
    if (!reduced && !CAPTURE) raf = requestAnimationFrame(frame); else running = false;
  }
  function schedule() { if (!running && visible && !document.hidden) { running = true; raf = requestAnimationFrame(frame); } }
  function stop() { if (raf) cancelAnimationFrame(raf); raf = 0; running = false; }

  schedule();
})();
