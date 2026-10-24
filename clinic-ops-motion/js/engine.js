/* ================================================================
   engine — カメラ・投影・被写界深度・平面・仕上げ
   座標: x 右 / y 下 / z 奥。論理解像度 1920×1080 で考え、描くときに S 倍する。
   ================================================================ */
(function (root) {
  'use strict';
  const F = root.FILM;
  const { clamp } = F.M;

  const W = 1920, H = 1080, NEAR = 24, MAXCOC = 72;
  const mk = (w, h) => {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(w));
    c.height = Math.max(1, Math.ceil(h));
    return c;
  };

  /* ---- カメラ: 注視点のまわりを回る台(ヨー・ピッチ・距離)+ロール・焦点距離・ピント・絞り ---- */
  function camera(r) {
    const cyw = Math.cos(r.yaw), syw = Math.sin(r.yaw);
    const cp = Math.cos(r.pitch), sp = Math.sin(r.pitch);
    const fw = [syw * cp, sp, cyw * cp];
    let rt = [cyw, 0, -syw];
    let dn = [fw[1] * rt[2] - fw[2] * rt[1], fw[2] * rt[0] - fw[0] * rt[2], fw[0] * rt[1] - fw[1] * rt[0]];
    if (r.roll) {
      const c = Math.cos(r.roll), s = Math.sin(r.roll);
      const r2 = [rt[0] * c + dn[0] * s, rt[1] * c + dn[1] * s, rt[2] * c + dn[2] * s];
      const d2 = [dn[0] * c - rt[0] * s, dn[1] * c - rt[1] * s, dn[2] * c - rt[2] * s];
      rt = r2; dn = d2;
    }
    return {
      px: r.tx - fw[0] * r.dist, py: r.ty - fw[1] * r.dist, pz: r.tz - fw[2] * r.dist,
      fw, rt, dn, f: r.f, cx: W / 2 + (r.shiftX || 0), cy: H / 2 + (r.shiftY || 0),
      focus: r.focus, ap: r.aperture,
    };
  }

  /* 投影。手前すぎる点は false。out に x,y(論理px)・s(拡大率)・z(奥行き)を書く */
  function project(cam, x, y, z, out) {
    const dx = x - cam.px, dy = y - cam.py, dz = z - cam.pz;
    const zc = dx * cam.fw[0] + dy * cam.fw[1] + dz * cam.fw[2];
    if (zc < NEAR) { out.ok = false; return false; }
    const xc = dx * cam.rt[0] + dy * cam.rt[1] + dz * cam.rt[2];
    const yc = dx * cam.dn[0] + dy * cam.dn[1] + dz * cam.dn[2];
    const s = cam.f / zc;
    out.x = cam.cx + xc * s; out.y = cam.cy + yc * s; out.s = s; out.z = zc; out.ok = true;
    return true;
  }
  /* 錯乱円(ぼけの半径・論理px)。薄いレンズの近似 */
  const coc = (cam, z, k = 1) => Math.min(MAXCOC, (cam.ap * k * Math.abs(z - cam.focus)) / Math.max(z, 1));

  /* ---- スプライト: 一度だけ描いて、ぼけの段を必要になってから作る ---- */
  const SS = 2;                                // スプライトの解像度(論理pxの何倍で持つか)
  let FILTER = true;                           // canvas の filter が効くか(効かない環境は縮小拡大でぼかす)
  const setBlurMode = ok => { FILTER = ok; };
  const BL = [0, 1.25, 2.5, 5, 10, 20, 40];    // ぼけの段(スプライトの論理px)
  class Sprite {
    constructor(w, h, draw, ss = SS) {
      this.w = w; this.h = h; this.ss = ss;
      const c = mk(w * ss, h * ss), g = c.getContext('2d');
      g.scale(ss, ss);
      draw(g, w, h);
      this.L = [{ c, pad: 0, sc: ss }];
    }
    level(i) {
      if (this.L[i]) return this.L[i];
      const r = BL[i], sc = clamp(5 / r, 0.12, this.ss), pad = Math.ceil(r * 2.6);
      const c = mk((this.w + pad * 2) * sc, (this.h + pad * 2) * sc), g = c.getContext('2d');
      if (FILTER) {
        g.filter = `blur(${r * sc}px)`;
        g.drawImage(this.L[0].c, pad * sc, pad * sc, this.w * sc, this.h * sc);
      } else {
        /* 縮めてから広げる(二段)。ガウスに近いやわらかさになる */
        const k = Math.max(1, r * sc * 0.85), t1 = mk(c.width / k, c.height / k), g1 = t1.getContext('2d');
        g1.imageSmoothingQuality = 'high';
        g1.drawImage(this.L[0].c, (pad * sc) / k, (pad * sc) / k, (this.w * sc) / k, (this.h * sc) / k);
        g.imageSmoothingQuality = 'high';
        g.drawImage(t1, 0, 0, c.width, c.height);
      }
      return (this.L[i] = { c, pad, sc });
    }
  }
  /* (x,y) を基準点(ax,ay は 0..1)として、拡大 s・ぼけ blur(画面の論理px)・不透明度 a で置く */
  function drawSprite(ctx, sp, x, y, s, blur, a, ax = 0.5, ay = 0.5) {
    if (a <= 0.003 || s <= 0) return;
    const b = blur / s;
    let i = 0;
    while (i < BL.length - 1 && BL[i + 1] <= b) i++;
    const j = Math.min(i + 1, BL.length - 1);
    const w = j > i ? clamp((b - BL[i]) / (BL[j] - BL[i])) : 0;
    put(ctx, sp, i, x, y, s, a * (1 - w), ax, ay);
    if (w > 0.002) put(ctx, sp, j, x, y, s, a * w, ax, ay);
  }
  function put(ctx, sp, i, x, y, s, a, ax, ay) {
    if (a <= 0.003) return;
    const L = sp.level(i);
    ctx.globalAlpha = a;
    ctx.drawImage(L.c, x - (sp.w * ax + L.pad) * s, y - (sp.h * ay + L.pad) * s, (sp.w + L.pad * 2) * s, (sp.h + L.pad * 2) * s);
  }

  /* 光の点。ピントが合うと芯のある点、外れると縁の明るい円(ボケ) */
  let DOT = null, DISC = null;
  function stamps() {
    if (DOT) return;
    DOT = mk(64, 64);
    let g = DOT.getContext('2d');
    let gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.18, 'rgba(255,255,255,.85)');
    gr.addColorStop(0.45, 'rgba(255,255,255,.22)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    DISC = mk(128, 128);
    g = DISC.getContext('2d');
    gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,.42)');
    gr.addColorStop(0.62, 'rgba(255,255,255,.5)');
    gr.addColorStop(0.86, 'rgba(255,255,255,.78)');
    gr.addColorStop(0.93, 'rgba(255,255,255,.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  }
  /* 白の点を色で染めた版を持つ(lighter で足すので色は乗算済みの白でよい) */
  const tinted = new Map();
  function tint(src, color) {
    const key = src === DOT ? 'd' : 'k';
    const k = key + color.join(',');
    if (tinted.has(k)) return tinted.get(k);
    const c = mk(src.width, src.height), g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = `rgb(${color[0]},${color[1]},${color[2]})`;
    g.fillRect(0, 0, c.width, c.height);
    tinted.set(k, c);
    return c;
  }
  /* 半径 r(論理px)の光の点。blur が r を超えるとボケの円になり、面積に応じて暗くなる */
  function light(ctx, x, y, r, blur, a, color) {
    if (a <= 0.004) return;
    const R = Math.max(r, blur);
    if (blur < r * 1.4) {
      ctx.globalAlpha = a;
      const d = R * 3.2;
      ctx.drawImage(tint(DOT, color), x - d / 2, y - d / 2, d, d);
    } else {
      const e = clamp((r * r * 2.2) / (R * R), 0.035, 1);
      ctx.globalAlpha = a * e;
      ctx.drawImage(tint(DISC, color), x - R, y - R, R * 2, R * 2);
    }
  }

  /* ---- 平面: 局所座標(u,v)で描き、カメラで投影する。線と面は頂点ごと、文字はアフィンで近似 ---- */
  class Plane {
    constructor() { this.o = [0, 0, 0]; this.u = [1, 0, 0]; this.v = [0, 1, 0]; this.q = { x: 0, y: 0, s: 0, z: 0, ok: false }; }
    set(o, u, v) { this.o = o; this.u = u; this.v = v; return this; }
    world(a, b, out) {
      out[0] = this.o[0] + this.u[0] * a + this.v[0] * b;
      out[1] = this.o[1] + this.u[1] * a + this.v[1] * b;
      out[2] = this.o[2] + this.u[2] * a + this.v[2] * b;
      return out;
    }
    pt(cam, a, b, out = this.q) {
      return project(cam,
        this.o[0] + this.u[0] * a + this.v[0] * b,
        this.o[1] + this.u[1] * a + this.v[1] * b,
        this.o[2] + this.u[2] * a + this.v[2] * b, out);
    }
    /* (a,b) を原点とする局所の座標系を画面へ写すアフィン行列。k は差分の幅 */
    affine(cam, a, b, k = 24) {
      const p0 = {}, px = {}, py = {};
      if (!this.pt(cam, a, b, p0) || !this.pt(cam, a + k, b, px) || !this.pt(cam, a, b + k, py)) return null;
      return [(px.x - p0.x) / k, (px.y - p0.y) / k, (py.x - p0.x) / k, (py.y - p0.y) / k, p0.x, p0.y, p0.s, p0.z];
    }
  }

  /* ---- 仕上げ: 光のにじみ・周辺減光・粒子 ---- */
  class Post {
    constructor() {
      this.b1 = mk(4, 4); this.b2 = mk(4, 4); this.b3 = mk(4, 4);
      this.grainC = null;
    }
    resize(w, h) {
      const s1 = 6, s2 = 12;
      this.b1.width = Math.ceil(w / s1); this.b1.height = Math.ceil(h / s1);
      this.b2.width = Math.ceil(w / s1); this.b2.height = Math.ceil(h / s1);
      this.b3.width = Math.ceil(w / s2); this.b3.height = Math.ceil(h / s2);
    }
    /* 明るいところだけをにじませて足す(暗い場の光の演出) */
    bloom(ctx, canvas, k) {
      if (k <= 0.002) return;
      const { b1, b2, b3 } = this;
      const g1 = b1.getContext('2d'), g2 = b2.getContext('2d'), g3 = b3.getContext('2d');
      g1.globalCompositeOperation = 'copy';
      if (FILTER) g1.filter = 'brightness(1.15) contrast(2.4)';   // 明るいところだけ残す
      g1.drawImage(canvas, 0, 0, b1.width, b1.height);
      g1.filter = 'none';
      g2.globalCompositeOperation = 'copy';
      if (FILTER) g2.filter = 'blur(3px)';
      g2.drawImage(b1, 0, 0);
      g2.filter = 'none';
      g3.globalCompositeOperation = 'copy';
      if (FILTER) g3.filter = 'blur(5px)';
      g3.drawImage(b1, 0, 0, b3.width, b3.height);
      g3.filter = 'none';
      if (!FILTER) k *= 0.35;                                       // 閾値なしで足すぶん弱く
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.5 * k;
      ctx.drawImage(b2, 0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 0.42 * k;
      ctx.drawImage(b3, 0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
    vignette(ctx, canvas, color, a) {
      if (a <= 0.002) return;
      const w = canvas.width, h = canvas.height;
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const g = ctx.createRadialGradient(w / 2, h * 0.48, h * 0.32, w / 2, h * 0.5, Math.hypot(w, h) * 0.56);
      g.addColorStop(0, F.M.rgba(color, 0));
      g.addColorStop(1, F.M.rgba(color, a));
      ctx.fillStyle = g;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
    /* 粒子。フレーム番号から決まる位置でずらすので、同じ時刻は同じ絵になる */
    grain(ctx, canvas, frame, a) {
      if (a <= 0.002) return;
      if (!this.grainC) {
        const n = 256, c = mk(n, n), g = c.getContext('2d'), im = g.createImageData(n, n), r = F.M.rng(7);
        for (let i = 0; i < n * n; i++) {
          const v = 128 + (r() + r() + r() - 1.5) * 120;
          im.data[i * 4] = im.data[i * 4 + 1] = im.data[i * 4 + 2] = v;
          im.data[i * 4 + 3] = 255;
        }
        g.putImageData(im, 0, 0);
        this.grainC = c;
      }
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.globalCompositeOperation = 'overlay';
      ctx.globalAlpha = a;
      const n = 256, ox = Math.floor(F.M.hash(frame, 11) * n), oy = Math.floor(F.M.hash(frame, 12) * n);
      for (let y = -oy; y < canvas.height; y += n) for (let x = -ox; x < canvas.width; x += n) ctx.drawImage(this.grainC, x, y);
      ctx.restore();
    }
  }

  F.E = { W, H, NEAR, MAXCOC, mk, camera, project, coc, Sprite, drawSprite, stamps, light, tint, Plane, Post, BL, setBlurMode };
})(window);
