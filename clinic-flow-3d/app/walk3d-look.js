/* 3D視察の「見た目」(v96 便AN-3・社長指示 2026-09-12「視察の3Dももっとリアリティ出してね」)。
 * walk3d.js(シーンの論理・操作・シム同期)から、光・材質・手続きテクスチャ・什器・人物の形を分けて持つ。
 * 外部モデルは持ち込まない。Canvas で描くテクスチャと箱/円柱/球の組合せだけ(静的サイト・同梱 three r128)。
 * 目標は写実でなく「クリニックとして読める密度」: 光と影 > 材質 > 天井と壁 > 什器 > 人物 > サイン。 */
(function (root) {
  'use strict';
  const T = root.THREE;
  if (!T) return;

  /* ---------- 手続きテクスチャ(Canvas) ---------- */
  const texCache = new Map();
  function canvasTex(key, w, h, draw, repeat) {
    if (texCache.has(key)) return texCache.get(key);
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    draw(cv.getContext('2d'), w, h);
    const tex = new T.CanvasTexture(cv);
    tex.wrapS = tex.wrapT = T.RepeatWrapping;
    tex.encoding = T.sRGBEncoding;
    tex.anisotropy = 4;
    if (repeat) tex.repeat.set(repeat[0], repeat[1]);
    texCache.set(key, tex);
    return tex;
  }
  function noise(c, w, h, alpha, n) {
    for (let i = 0; i < n; i++) {
      const v = Math.random() < 0.5 ? 0 : 255;
      c.fillStyle = `rgba(${v},${v},${v},${alpha})`;
      c.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
  }
  const TEX = {
    // 長尺ビニル床(60cm 目地・淡いグレージュ)
    floor: () => canvasTex('floor', 256, 256, (c, w, h) => {
      c.fillStyle = '#EDEAE3'; c.fillRect(0, 0, w, h);
      noise(c, w, h, 0.02, 700);
      c.strokeStyle = 'rgba(0,0,0,0.06)'; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, 0.5); c.lineTo(w, 0.5); c.moveTo(0.5, 0); c.lineTo(0.5, h); c.stroke(); // 継ぎ目(1枚=1.82m)
    }, [1, 1]),
    // ゾーンの床(色つきの長尺)
    floorTint: (hex) => canvasTex('floorTint' + hex, 256, 256, (c, w, h) => {
      c.fillStyle = hex; c.fillRect(0, 0, w, h);
      noise(c, w, h, 0.05, 700);
      c.strokeStyle = 'rgba(90,100,110,0.16)'; c.lineWidth = 2;
      for (let i = 0; i <= 2; i++) { c.beginPath(); c.moveTo(0, i * 128); c.lineTo(w, i * 128); c.stroke(); }
      for (let i = 0; i <= 4; i++) { c.beginPath(); c.moveTo(i * 64, 0); c.lineTo(i * 64, h); c.stroke(); }
    }, [1, 1]),
    // 壁(塗装・わずかな粒)
    wall: () => canvasTex('wall', 128, 128, (c, w, h) => { c.fillStyle = '#F2F1EC'; c.fillRect(0, 0, w, h); noise(c, w, h, 0.03, 300); }, [1, 1]),
    // 木目の床(待合・リハ): 板幅 0.15m × 長さ 1.8m(1枚=1.8m 角)
    woodFloor: () => canvasTex('woodFloor', 256, 256, (c, w, h) => {
      c.fillStyle = '#C8A87C'; c.fillRect(0, 0, w, h);
      const pw = Math.round(256 * 0.15 / 1.8);
      for (let x = 0; x < w; x += pw) {
        const shade = (Math.random() - 0.5) * 18;
        c.fillStyle = `rgb(${200 + shade},${168 + shade},${124 + shade})`; c.fillRect(x, 0, pw, h);
        c.strokeStyle = 'rgba(0,0,0,0.08)'; c.lineWidth = 1; c.beginPath(); c.moveTo(x + 0.5, 0); c.lineTo(x + 0.5, h); c.stroke();
        const off = Math.floor(Math.random() * h); c.beginPath(); c.moveTo(x, off + 0.5); c.lineTo(x + pw, off + 0.5); c.stroke();
      }
      noise(c, w, h, 0.03, 300);
    }, [1, 1]),
    // ブロブ影(人物の足元)
    blob: () => canvasTex('blob', 64, 64, (c, w, h) => { const g = c.createRadialGradient(32, 32, 4, 32, 32, 30); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }),
    // 天井(システム天井 60cm 角)
    ceiling: () => canvasTex('ceiling', 256, 256, (c, w, h) => {
      c.fillStyle = '#F7F8F8'; c.fillRect(0, 0, w, h);
      c.strokeStyle = '#DFE3E4'; c.lineWidth = 2;
      for (let i = 0; i <= 2; i++) { c.beginPath(); c.moveTo(0, i * 128); c.lineTo(w, i * 128); c.moveTo(i * 128, 0); c.lineTo(i * 128, h); c.stroke(); }
    }, [1, 1]),
    // 木(カウンター・デスク)
    wood: () => canvasTex('wood', 256, 128, (c, w, h) => {
      c.fillStyle = '#B99A6B'; c.fillRect(0, 0, w, h);
      for (let y = 0; y < h; y += 3) { c.strokeStyle = `rgba(110,75,40,${0.06 + Math.random() * 0.1})`; c.lineWidth = 1 + Math.random(); c.beginPath(); c.moveTo(0, y + Math.sin(y * 0.3) * 2); c.bezierCurveTo(w * 0.3, y + Math.random() * 3, w * 0.6, y - Math.random() * 3, w, y + Math.sin(y * 0.2) * 2); c.stroke(); }
    }, [1, 1]),
    // 布(椅子)
    fabric: (hex) => canvasTex('fabric' + hex, 128, 128, (c, w, h) => { c.fillStyle = hex; c.fillRect(0, 0, w, h); noise(c, w, h, 0.03, 500); }, [1, 1]),
    // アスファルト(街)・芝・歩道
    asphalt: () => canvasTex('asphalt', 128, 128, (c, w, h) => { c.fillStyle = '#8F979D'; c.fillRect(0, 0, w, h); noise(c, w, h, 0.08, 700); }, [1, 1]),
    grass: () => canvasTex('grass', 128, 128, (c, w, h) => { c.fillStyle = '#9DB88F'; c.fillRect(0, 0, w, h); for (let i = 0; i < 900; i++) { c.fillStyle = Math.random() < 0.5 ? 'rgba(70,110,60,0.25)' : 'rgba(190,215,160,0.25)'; c.fillRect(Math.random() * w, Math.random() * h, 1, 2 + Math.random() * 3); } }, [1, 1]),
    sidewalk: () => canvasTex('sidewalk', 128, 128, (c, w, h) => { c.fillStyle = '#D5D3CC'; c.fillRect(0, 0, w, h); noise(c, w, h, 0.05, 300); c.strokeStyle = 'rgba(110,110,105,0.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 64); c.lineTo(w, 64); c.moveTo(64, 0); c.lineTo(64, h); c.stroke(); }, [1, 1]),
    // 建物の外壁(窓は行ごと)
    facade: (hex) => canvasTex('facade' + hex, 128, 128, (c, w, h) => {
      c.fillStyle = hex; c.fillRect(0, 0, w, h); noise(c, w, h, 0.04, 200);
      for (let y = 14; y < 110; y += 30) for (let x = 12; x < 116; x += 28) {
        c.fillStyle = 'rgba(150,175,195,0.75)'; c.fillRect(x, y, 16, 18);
        c.fillStyle = 'rgba(255,255,255,0.35)'; c.fillRect(x + 2, y + 2, 5, 6);
        c.strokeStyle = 'rgba(60,70,80,0.35)'; c.lineWidth = 1; c.strokeRect(x, y, 16, 18);
      }
    }, [1, 1]),
    // 建物の外壁: 1枚=1階(3m×3m)。窓2つと階の帯。repeat を (幅/3, 階数) にして貼る
    facadeFloor: (hex) => canvasTex('facadeFloor' + hex, 256, 256, (c, w, h) => {
      c.fillStyle = hex; c.fillRect(0, 0, w, h); noise(c, w, h, 0.035, 500);
      for (const x of [40, 152]) {
        c.fillStyle = '#7F9DB4'; c.fillRect(x, 68, 64, 116);
        const g = c.createLinearGradient(x, 68, x + 64, 184); g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(0.5, 'rgba(255,255,255,0.05)'); g.addColorStop(1, 'rgba(40,60,80,0.25)');
        c.fillStyle = g; c.fillRect(x, 68, 64, 116);
        c.strokeStyle = '#4A5560'; c.lineWidth = 3; c.strokeRect(x, 68, 64, 116);
        c.beginPath(); c.moveTo(x + 32, 68); c.lineTo(x + 32, 184); c.stroke(); // 中桟
        c.fillStyle = 'rgba(0,0,0,0.18)'; c.fillRect(x - 4, 184, 72, 6); // 窓台
      }
      c.fillStyle = 'rgba(0,0,0,0.10)'; c.fillRect(0, 248, w, 8); // 階の帯
    }, [1, 1]),
    // 住宅の外壁(1面=1枚): 窓1つと玄関
    houseWall: (hex, door) => canvasTex('houseWall' + hex + (door ? 'd' : ''), 128, 128, (c, w, h) => {
      c.fillStyle = hex; c.fillRect(0, 0, w, h); noise(c, w, h, 0.05, 250);
      c.fillStyle = 'rgba(120,150,175,0.85)'; c.fillRect(door ? 14 : 48, 40, 32, 36);
      c.strokeStyle = 'rgba(60,70,80,0.45)'; c.lineWidth = 2; c.strokeRect(door ? 14 : 48, 40, 32, 36);
      if (door) { c.fillStyle = '#6E5A44'; c.fillRect(78, 52, 30, 76); c.fillStyle = 'rgba(255,255,255,0.5)'; c.fillRect(98, 88, 4, 4); }
    }, [1, 1]),
    // 空: 上→地平のグラデ(天球の内側に貼る)
    sky: (top, horizon) => canvasTex('sky' + top + horizon, 4, 256, (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, top); g.addColorStop(0.5, top); g.addColorStop(0.88, horizon); g.addColorStop(1, horizon);
      c.fillStyle = g; c.fillRect(0, 0, w, h);
    }),
    // 壁付けサイン(白地に濃紺の文字)
    sign: (text, opts) => canvasTex('sign|' + text, 512, 128, (c, w, h) => {
      const o = opts || {};
      c.fillStyle = o.bg || '#2C5F82'; c.fillRect(0, 0, w, h);
      c.fillStyle = o.color || '#FFFFFF'; c.font = `700 ${o.size || 64}px 'Zen Kaku Gothic New','Noto Sans JP',sans-serif`;
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2 + 7, h / 2 + 2, w - 40);
    }),
  };

  /* ---------- 材質(色ごとにキャッシュ) ---------- */
  const matCache = new Map();
  function mat(key, props) {
    if (matCache.has(key)) return matCache.get(key);
    const m = new T.MeshStandardMaterial(Object.assign({ roughness: 0.85, metalness: 0.0 }, props));
    matCache.set(key, m);
    return m;
  }
  const MAT = {
    floor: () => mat('floor', { map: TEX.floor(), roughness: 0.75 }),
    woodFloor: () => mat('woodFloor', { map: TEX.woodFloor(), roughness: 0.8 }),
    blob: () => mat('blob', { map: TEX.blob(), transparent: true, opacity: 0.28, depthWrite: false }),
    floorTint: (hex) => mat('floorTint' + hex, { map: TEX.floorTint(hex), roughness: 0.55 }),
    wall: () => mat('wall', { map: TEX.wall(), roughness: 0.92 }),
    wallIn: () => mat('wallIn', { color: 0xF7F5F0, roughness: 0.92 }),
    ceiling: () => mat('ceiling', { map: TEX.ceiling(), roughness: 0.95 }),
    baseboard: () => mat('baseboard', { color: 0xD9D4C8, roughness: 0.7 }),
    wainscot: () => mat('wainscot', { color: 0xDCE4E8, roughness: 0.85 }),
    lightPanel: () => mat('lightPanel', { color: 0xFFFFFF, emissive: 0xFFFDF5, emissiveIntensity: 0.9, roughness: 0.4 }),
    wood: () => mat('wood', { color: 0xB99A6B, roughness: 0.8 }), // 箱の UV は面ごとに伸びるので木目は貼らない(色だけ)
    top: () => mat('top', { color: 0xF6F4EF, roughness: 0.35 }),
    metal: () => mat('metal', { color: 0xC9CED2, roughness: 0.35, metalness: 0.6 }),
    darkMetal: () => mat('darkMetal', { color: 0x3A4248, roughness: 0.45, metalness: 0.5 }),
    bedFrame: () => mat('bedFrame', { color: 0xE8EAEA, roughness: 0.4, metalness: 0.5 }),
    plastic: (hex) => mat('plastic' + hex, { color: hex, roughness: 0.6 }),
    fabric: (hex) => mat('fabric' + hex, { map: TEX.fabric('#' + hex.toString(16).padStart(6, '0')), roughness: 0.95 }),
    glass: () => mat('glass', { color: 0xDDE9EE, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false }),
    sheet: () => mat('sheet', { color: 0xCFE0E6, roughness: 0.9 }),
    white: () => mat('white', { color: 0xFFFFFF, roughness: 0.8 }),
    screen: () => mat('screen', { color: 0x1E2A33, emissive: 0x2A4A63, emissiveIntensity: 0.6, roughness: 0.3 }),
    leaf: () => mat('leaf', { color: 0x5F9A6A, roughness: 0.9 }),
    leafDark: () => mat('leafDark', { color: 0x4A7F55, roughness: 0.9 }),
    trunk: () => mat('trunk', { color: 0x7A5A3C, roughness: 0.95 }),
    asphalt: () => mat('asphalt', { map: TEX.asphalt(), roughness: 0.95 }),
    grass: () => mat('grass', { map: TEX.grass(), roughness: 1 }),
    sidewalk: () => mat('sidewalk', { map: TEX.sidewalk(), roughness: 0.9 }),
    facade: (hex) => mat('facade' + hex, { map: TEX.facade('#' + hex.toString(16).padStart(6, '0')), roughness: 0.8 }),
    roof: (hex) => mat('roof' + hex, { color: hex, roughness: 0.9 }),
    facadeFloor: (hex, rx, ry) => {
      const key = 'facadeFloor' + hex + '|' + rx.toFixed(1) + '|' + ry;
      if (matCache.has(key)) return matCache.get(key);
      const tex = TEX.facadeFloor('#' + hex.toString(16).padStart(6, '0')).clone(); tex.needsUpdate = true; tex.repeat.set(rx, ry);
      return mat(key, { map: tex, roughness: 0.85 });
    },
    houseWall: (hex, door) => mat('houseWall' + hex + (door ? 'd' : ''), { map: TEX.houseWall('#' + hex.toString(16).padStart(6, '0'), door), roughness: 0.9 }),
    roadLine: () => mat('roadLine', { color: 0xEDEDE6, roughness: 0.9 }),
    lampHead: () => mat('lampHead', { color: 0xFFF6DC, emissive: 0xFFE9B8, emissiveIntensity: 0.5, roughness: 0.4 }),
    sky: (top, horizon) => { const key = 'sky' + top + horizon; if (matCache.has(key)) return matCache.get(key); const m = new T.MeshBasicMaterial({ map: TEX.sky(top, horizon), side: T.BackSide, fog: false, depthWrite: false }); matCache.set(key, m); return m; },
    skin: () => mat('skin', { color: 0xF1C9A5, roughness: 0.7 }),
    hair: (hex) => mat('hair' + hex, { color: hex, roughness: 0.8 }),
    cloth: (hex) => mat('cloth' + hex, { color: hex, roughness: 0.9 }),
    sign: (text, o) => mat('sign|' + text, { map: TEX.sign(text, o), roughness: 0.6 }),
    line: () => mat('line', { color: 0xF2F2EE, roughness: 0.8 }),
    curtain: () => mat('curtain', { color: 0xCFE0D8, roughness: 0.95, side: T.DoubleSide }),
  };

  const GEO = {
    box: new T.BoxGeometry(1, 1, 1),
    cyl: new T.CylinderGeometry(0.5, 0.5, 1, 14),
    cylLow: new T.CylinderGeometry(0.5, 0.5, 1, 8),
    sphere: new T.SphereGeometry(0.5, 14, 12),
    sphereLow: new T.SphereGeometry(0.5, 9, 8),
    plane: new T.PlaneGeometry(1, 1),
    cone: new T.ConeGeometry(0.5, 1, 9),
    dome: new T.SphereGeometry(1, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.55),
  };

  /* ---------- 箱の部品 ---------- */
  function box(parent, x, y, z, w, h, d, m, o) {
    const mesh = new T.Mesh(GEO.box, m);
    mesh.scale.set(w, h, d);
    mesh.position.set(x + w / 2, y + h / 2, z + d / 2);
    mesh.castShadow = !(o && o.noCast); mesh.receiveShadow = !(o && o.noReceive);
    parent.add(mesh);
    return mesh;
  }
  function cyl(parent, x, y, z, r, h, m, low) {
    const mesh = new T.Mesh(low ? GEO.cylLow : GEO.cyl, m);
    mesh.scale.set(r * 2, h, r * 2);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true; mesh.receiveShadow = true;
    parent.add(mesh);
    return mesh;
  }

  /* ---------- 什器(箱の組合せ。1什器あたり 12 メッシュ以下) ---------- */
  const PROPS = {
    // 待合椅子(連結ベンチ型: 座面・背・脚2本・肘)
    chair: (parent, x, z, hex) => {
      const g = new T.Group(); g.position.set(x, 0, z); parent.add(g);
      const fab = MAT.fabric(hex || 0x6E8794);
      box(g, 0.12, 0.40, 0.14, 0.76, 0.10, 0.62, fab);          // 座面
      box(g, 0.12, 0.50, 0.66, 0.76, 0.46, 0.10, fab);          // 背
      box(g, 0.16, 0.0, 0.20, 0.06, 0.40, 0.50, MAT.darkMetal(), { noCast: true }); // 脚
      box(g, 0.78, 0.0, 0.20, 0.06, 0.40, 0.50, MAT.darkMetal(), { noCast: true });
      return g;
    },
    // 受付/会計カウンター(下段の腰壁+白天板+上段の受付台+モニター)
    counter: (parent, x, z, w, d, accentHex) => {
      const g = new T.Group(); g.position.set(x, 0, z); parent.add(g);
      box(g, 0, 0, 0, w, 0.95, d, MAT.wood());
      box(g, -0.04, 0.95, -0.04, w + 0.08, 0.06, d + 0.08, MAT.top());
      box(g, 0, 0.98, d - 0.03, w, 0.05, 0.05, MAT.plastic(accentHex || 0x2C5F82)); // 患者側の縁(意味色・細く)
      box(g, 0.35, 1.01, 0.15, 0.42, 0.30, 0.03, MAT.screen(), { noCast: true }); // モニター
      box(g, 0.53, 1.01, 0.18, 0.06, 0.12, 0.08, MAT.darkMetal(), { noCast: true });
      return g;
    },
    // 診察デスク(天板+脚+モニター+椅子)
    desk: (parent, x, z, w, d) => {
      const g = new T.Group(); g.position.set(x, 0, z); parent.add(g);
      box(g, 0, 0.70, 0, w, 0.05, d, MAT.wood());
      box(g, 0.04, 0, 0.04, 0.05, 0.70, d - 0.08, MAT.darkMetal(), { noCast: true });
      box(g, w - 0.09, 0, 0.04, 0.05, 0.70, d - 0.08, MAT.darkMetal(), { noCast: true });
      box(g, w * 0.55, 0.75, 0.12, 0.44, 0.30, 0.03, MAT.screen(), { noCast: true });
      box(g, w * 0.55 + 0.19, 0.75, 0.16, 0.06, 0.10, 0.10, MAT.darkMetal(), { noCast: true });
      box(g, w * 0.2, 0.75, 0.35, 0.34, 0.02, 0.14, MAT.plastic(0xE8E8E4), { noCast: true }); // キーボード
      return g;
    },
    // 処置ベッド(脚+マット+シーツ+枕+カーテンレール)
    bed: (parent, x, z, w, d) => {
      const g = new T.Group(); g.position.set(x, 0, z); parent.add(g);
      box(g, 0.08, 0, 0.08, w - 0.16, 0.45, d - 0.16, MAT.bedFrame(), { noCast: true });
      box(g, 0, 0.45, 0, w, 0.16, d, MAT.white());
      box(g, 0.05, 0.61, 0.05, w - 0.10, 0.03, d - 0.10, MAT.sheet(), { noCast: true });
      box(g, 0.15, 0.63, 0.10, w - 0.30, 0.10, 0.34, MAT.white(), { noCast: true }); // 枕
      cyl(g, 0.05, 0, d + 0.02, 0.02, 2.2, MAT.metal(), true); // レール支柱
      box(g, 0.05, 2.15, -0.02, w + 0.4, 0.03, 0.03, MAT.metal(), { noCast: true });
      return g;
    },
    // カーテン(ベッドの脇・半透明の布)
    curtain: (parent, x, z, len, h) => {
      const m = new T.Mesh(GEO.plane, MAT.curtain());
      m.scale.set(len, h, 1);
      m.position.set(x + len / 2, 0.4 + h / 2, z);
      m.receiveShadow = true;
      parent.add(m);
      return m;
    },
    // リハ機器: 0=平行棒 1=エルゴメーター 2=牽引台(位置で種類を回す)
    machine: (parent, x, z, kind, active) => {
      const g = new T.Group(); g.position.set(x, 0, z); parent.add(g);
      const acc = MAT.plastic(active ? 0x3E7CA6 : 0xB9C6C0);
      if (kind === 0) { // 平行棒
        for (const dx of [0.1, 0.9]) { cyl(g, dx, 0, 0.1, 0.03, 0.85, MAT.metal(), true); cyl(g, dx, 0, 0.9, 0.03, 0.85, MAT.metal(), true); box(g, dx - 0.02, 0.85, 0.08, 0.04, 0.04, 0.86, MAT.metal(), { noCast: true }); }
        box(g, 0.05, 0, 0.05, 0.9, 0.03, 0.9, MAT.plastic(0xD8D2C4), { noCast: true });
      } else if (kind === 1) { // エルゴメーター
        box(g, 0.2, 0, 0.1, 0.6, 0.08, 0.8, MAT.darkMetal(), { noCast: true });
        box(g, 0.42, 0.08, 0.35, 0.16, 0.55, 0.3, acc);
        box(g, 0.35, 0.62, 0.15, 0.3, 0.06, 0.25, MAT.plastic(0x2B2B2B), { noCast: true }); // サドル
        box(g, 0.25, 0.75, 0.55, 0.5, 0.04, 0.06, MAT.metal(), { noCast: true }); // ハンドル
        cyl(g, 0.5, 0.05, 0.75, 0.2, 0.06, MAT.darkMetal(), true).rotation.x = Math.PI / 2;
      } else { // 牽引台
        box(g, 0.1, 0, 0.1, 0.8, 0.45, 0.8, MAT.metal(), { noCast: true });
        box(g, 0.05, 0.45, 0.05, 0.9, 0.12, 0.9, MAT.sheet());
        box(g, 0.3, 0.57, 0.0, 0.4, 0.5, 0.1, acc);
      }
      return g;
    },
    // 観葉植物
    plant: (parent, x, z) => {
      const g = new T.Group(); g.position.set(x, 0, z); parent.add(g);
      cyl(g, 0.5, 0, 0.5, 0.18, 0.32, MAT.plastic(0xE7E2D8), true);
      cyl(g, 0.5, 0.3, 0.5, 0.03, 0.6, MAT.trunk(), true);
      const s1 = new T.Mesh(GEO.sphereLow, MAT.leaf()); s1.scale.set(0.7, 0.55, 0.7); s1.position.set(0.5, 1.0, 0.5); s1.castShadow = true; g.add(s1);
      const s2 = new T.Mesh(GEO.sphereLow, MAT.leafDark()); s2.scale.set(0.5, 0.45, 0.5); s2.position.set(0.62, 1.25, 0.42); s2.castShadow = true; g.add(s2);
      return g;
    },
    // 壁付けサイン(部屋の名札)
    sign: (parent, x, y, z, text, w, rotY) => {
      const m = new T.Mesh(GEO.plane, MAT.sign(text));
      const width = w || 1.4; m.scale.set(width, width / 4, 1);
      m.position.set(x, y, z); m.rotation.y = rotY || 0;
      parent.add(m);
      return m;
    },
    // 自動ドア(ガラス2枚+枠)
    door: (parent, x, z, w) => {
      const g = new T.Group(); g.position.set(x, 0, z); parent.add(g);
      box(g, -0.08, 0, -0.06, 0.08, 2.3, 0.12, MAT.darkMetal(), { noCast: true });
      box(g, w, 0, -0.06, 0.08, 2.3, 0.12, MAT.darkMetal(), { noCast: true });
      box(g, -0.08, 2.3, -0.06, w + 0.16, 0.12, 0.12, MAT.darkMetal(), { noCast: true });
      const gl = new T.Mesh(GEO.box, MAT.glass()); gl.scale.set(w, 2.3, 0.02); gl.position.set(w / 2, 1.15, 0); g.add(gl);
      box(g, w / 2 - 0.015, 0.2, -0.02, 0.03, 1.9, 0.04, MAT.darkMetal(), { noCast: true });
      return g;
    },
    // 窓(外壁に埋める: 枠+ガラス)
    window: (parent, x, y, z, w, h, along) => {
      const g = new T.Group(); g.position.set(x, y, z); parent.add(g);
      const gl = new T.Mesh(GEO.box, MAT.glass());
      if (along === 'x') { gl.scale.set(w, h, 0.03); gl.position.set(w / 2, h / 2, 0); } else { gl.scale.set(0.03, h, w); gl.position.set(0, h / 2, w / 2); }
      g.add(gl);
      const fr = MAT.darkMetal();
      if (along === 'x') { box(g, 0, -0.04, -0.03, w, 0.04, 0.06, fr, { noCast: true }); box(g, 0, h, -0.03, w, 0.04, 0.06, fr, { noCast: true }); box(g, w / 2 - 0.02, 0, -0.03, 0.04, h, 0.06, fr, { noCast: true }); }
      else { box(g, -0.03, -0.04, 0, 0.06, 0.04, w, fr, { noCast: true }); box(g, -0.03, h, 0, 0.06, 0.04, w, fr, { noCast: true }); box(g, -0.03, 0, w / 2 - 0.02, 0.06, h, 0.04, fr, { noCast: true }); }
      return g;
    },
    // 天井の照明パネル(発光)
    lightPanel: (parent, x, z, w, d, y) => {
      const m = new T.Mesh(GEO.box, MAT.lightPanel());
      m.scale.set(w, 0.03, d); m.position.set(x + w / 2, y, z + d / 2);
      parent.add(m);
      return m;
    },
    // 足元のブロブ影(人物用。実影は使わない)
    blob: (parent, r) => { const m = new T.Mesh(GEO.plane, MAT.blob()); m.rotation.x = -Math.PI / 2; m.position.y = 0.012; const d = (r || 0.25) * 2; m.scale.set(d, d, 1); m.renderOrder = 1; parent.add(m); return m; },
    // 間仕切り壁(x0,z0)→(x1,z1) 直線・厚 0.12・高 H。opening={at(中心の距離),w} で開口、glass=true で y1.4〜2.1 をガラス帯に
    wallSeg: (parent, x0, z0, x1, z1, H, o) => {
      o = o || {}; const th = 0.12; const along = Math.abs(x1 - x0) >= Math.abs(z1 - z0) ? 'x' : 'z';
      const len = along === 'x' ? Math.abs(x1 - x0) : Math.abs(z1 - z0);
      const sx = Math.min(x0, x1), sz = Math.min(z0, z1);
      const seg = (from, to, y0, y1, m) => {
        if (to - from <= 0.001 || y1 - y0 <= 0.001) return;
        if (along === 'x') box(parent, sx + from, y0, sz - th / 2, to - from, y1 - y0, th, m);
        else box(parent, sx - th / 2, y0, sz + from, th, y1 - y0, to - from, m);
      };
      const wallM = MAT.wall();
      const parts = o.opening ? [[0, o.opening.at - o.opening.w / 2], [o.opening.at + o.opening.w / 2, len]] : [[0, len]];
      for (const [a, b] of parts) {
        if (o.glass) { seg(a, b, 0, 1.4, wallM); seg(a, b, 2.1, H, wallM); const gl = new T.Mesh(GEO.box, MAT.glass()); if (along === 'x') { gl.scale.set(b - a, 0.7, 0.02); gl.position.set(sx + (a + b) / 2, 1.75, sz); } else { gl.scale.set(0.02, 0.7, b - a); gl.position.set(sx, 1.75, sz + (a + b) / 2); } parent.add(gl); seg(a, b, 1.38, 1.42, MAT.metal()); seg(a, b, 2.08, 2.12, MAT.metal()); }
        else seg(a, b, 0, H, wallM);
        seg(a, b, 0, 0.09, MAT.baseboard());
      }
      if (o.opening) seg(o.opening.at - o.opening.w / 2, o.opening.at + o.opening.w / 2, 2.1, H, wallM); // 開口の上
      return { along, len, sx, sz };
    },
    // ゴミ箱・掲示板・番号表示
    /* ---------- 街の部品 ---------- */
    // 建物: 階層ファサード(面ごとに repeat を合わせる)+屋根スラブ+入口のくぼみと庇+上端の看板
    building: (parent, x, z, w, d, floors, hex, roofHex, o) => {
      o = o || {};
      const H = floors * 3;
      const side = MAT.facadeFloor(hex, d / 3, floors), front = MAT.facadeFloor(hex, w / 3, floors), roof = MAT.roof(roofHex);
      const body = new T.Mesh(GEO.box, [side, side, roof, roof, front, front]);
      body.scale.set(w, H, d); body.position.set(x + w / 2, H / 2, z + d / 2);
      body.castShadow = true; body.receiveShadow = true; parent.add(body);
      box(parent, x - 0.15, H, z - 0.15, w + 0.3, 0.3, d + 0.3, roof); // 屋根スラブ
      if (floors >= 2) box(parent, x + w * 0.62, H + 0.3, z + d * 0.2, Math.min(2, w * 0.3), 1.1, Math.min(1.6, d * 0.4), MAT.plastic(0xC9CBCB)); // 屋上の機械室
      // 入口(南面の中央): 枠+ガラス2枚(中桟)+庇
      const ex = x + w / 2, ew = Math.min(2.2, w * 0.5);
      box(parent, ex - ew / 2, 0, z + d - 0.02, ew, 2.5, 0.18, MAT.plastic(0x8D959B), { noCast: true }); // 枠
      box(parent, ex - ew / 2 + 0.1, 0.05, z + d + 0.1, ew - 0.2, 2.3, 0.05, MAT.plastic(0x5C7C92), { noCast: true }); // ガラスの奥行き(暗めの青灰)
      box(parent, ex - 0.03, 0.05, z + d + 0.15, 0.06, 2.3, 0.02, MAT.white(), { noCast: true }); // 中桟
      box(parent, ex - ew / 2 - 0.3, 2.55, z + d, ew + 0.6, 0.1, 0.8, MAT.plastic(0x5A6670)); // 庇
      if (o.label) PROPS.sign(parent, ex, H - 0.7, z + d + 0.02, o.label, Math.min(w - 0.6, 0.62 * o.label.length + 1.2));
      return body;
    },
    // 戸建て: 壁4面(南に玄関)+切妻屋根
    house: (parent, x, z, w, d, hex, roofHex) => {
      const wall = MAT.houseWall(hex), door = MAT.houseWall(hex, true);
      const body = new T.Mesh(GEO.box, [wall, wall, wall, wall, door, wall]);
      body.scale.set(w, 2.7, d); body.position.set(x + w / 2, 1.35, z + d / 2);
      body.castShadow = true; body.receiveShadow = true; parent.add(body);
      const rm = MAT.roof(roofHex), pitch = 0.62, len = Math.hypot(w / 2 + 0.25, 1.05);
      for (const sgn of [-1, 1]) {
        const m = new T.Mesh(GEO.box, rm); m.scale.set(len, 0.14, d + 0.5);
        m.position.set(x + w / 2 + sgn * (w / 4 + 0.05), 2.7 + 0.5, z + d / 2); m.rotation.z = -sgn * pitch;
        m.castShadow = true; m.receiveShadow = true; parent.add(m);
      }
      const gable = new T.Mesh(GEO.box, MAT.plastic(hex)); gable.scale.set(w * 0.98, 1.0, d * 0.98); gable.position.set(x + w / 2, 2.7 + 0.5, z + d / 2); gable.castShadow = true; parent.add(gable);
      return body;
    },
    // 樹木: 幹+葉2〜3段(段ごとに色を変える)
    tree: (parent, x, z, size) => {
      const k = size || 1;
      cyl(parent, x, 0, z, 0.14 * k, 1.4 * k, MAT.trunk(), true);
      const tiers = k > 1.15 ? 3 : 2;
      for (let i = 0; i < tiers; i++) {
        const r = (1.25 - i * 0.32) * k, y = (1.2 + i * 0.75) * k;
        const m = new T.Mesh(GEO.sphereLow, i % 2 ? MAT.leaf() : MAT.leafDark());
        m.scale.set(r * 2, r * 1.5, r * 2); m.position.set(x, y + r * 0.6, z);
        m.castShadow = true; m.receiveShadow = true; parent.add(m);
      }
    },
    // 街灯: 柱4m+腕+灯具
    lamp: (parent, x, z, rotY) => {
      const g = new T.Group(); g.position.set(x, 0, z); g.rotation.y = rotY || 0;
      cyl(g, 0, 0, 0, 0.06, 4.0, MAT.darkMetal(), true);
      box(g, -0.04, 3.85, -0.04, 0.08, 0.08, 0.9, MAT.darkMetal());
      box(g, -0.14, 3.72, 0.55, 0.28, 0.14, 0.42, MAT.lampHead(), { noCast: true });
      parent.add(g);
      return g;
    },
    // 天球(内側にグラデ)。街でも院内の窓越しにも見える
    skyDome: (scene, cx, cz) => {
      const m = new T.Mesh(GEO.dome, MAT.sky('#8FB6D8', '#DCE8EE'));
      m.scale.set(120, 120, 120); m.position.set(cx || 0, -2, cz || 0); m.renderOrder = -1;
      scene.add(m);
      return m;
    },
    bin: (parent, x, z) => cyl(parent, x + 0.5, 0, z + 0.5, 0.16, 0.55, MAT.plastic(0x8C949B), true),
    board: (parent, x, y, z, rotY) => { const m = new T.Mesh(GEO.plane, MAT.plastic(0xE9E0C8)); m.scale.set(1.2, 0.8, 1); m.position.set(x, y, z); m.rotation.y = rotY || 0; parent.add(m); return m; },
  };

  /* ---------- 人物(身長 1.65m: 頭 0.24・胴 0.62・脚 0.78。腕と脚は振れる) ---------- */
  const FIG = {
    head: new T.SphereGeometry(0.12, 14, 12),
    hair: new T.SphereGeometry(0.128, 14, 10),
    torso: new T.CylinderGeometry(0.17, 0.2, 0.60, 12),
    hip: new T.CylinderGeometry(0.19, 0.17, 0.14, 10),
    leg: new T.CylinderGeometry(0.065, 0.075, 0.74, 8),
    arm: new T.CylinderGeometry(0.045, 0.05, 0.56, 8),
    shoe: new T.BoxGeometry(0.14, 0.06, 0.24),
    tag: new T.BoxGeometry(0.09, 0.05, 0.01),
  };
  function figure(o) {
    o = o || {};
    const g = new T.Group();
    const cloth = MAT.cloth(o.body !== undefined ? o.body : 0xF3F3F1);
    const pants = MAT.cloth(o.pants !== undefined ? o.pants : 0x53606A);
    const legL = new T.Mesh(FIG.leg, pants); legL.position.set(-0.085, 0.37, 0);
    const legR = new T.Mesh(FIG.leg, pants); legR.position.set(0.085, 0.37, 0);
    const shoeL = new T.Mesh(FIG.shoe, MAT.plastic(0x2B2F33)); shoeL.position.set(-0.085, 0.03, 0.03);
    const shoeR = new T.Mesh(FIG.shoe, MAT.plastic(0x2B2F33)); shoeR.position.set(0.085, 0.03, 0.03);
    const hip = new T.Mesh(FIG.hip, pants); hip.position.y = 0.78;
    const torso = new T.Mesh(FIG.torso, cloth); torso.position.y = 1.13;
    const armL = new T.Mesh(FIG.arm, cloth); armL.position.set(-0.24, 1.12, 0);
    const armR = new T.Mesh(FIG.arm, cloth); armR.position.set(0.24, 1.12, 0);
    const head = new T.Mesh(FIG.head, MAT.skin()); head.position.y = 1.53;
    [legL, legR, hip, torso, armL, armR, head].forEach((m) => { m.castShadow = true; });
    g.add(legL, legR, shoeL, shoeR, hip, torso, armL, armR, head);
    if (o.hair !== undefined) { const hair = new T.Mesh(FIG.hair, MAT.hair(o.hair)); hair.position.y = 1.565; hair.scale.set(1, 0.75, 1); hair.castShadow = true; g.add(hair); }
    if (o.dot !== undefined) { const tag = new T.Mesh(FIG.tag, MAT.plastic(o.dot)); tag.position.set(0.08, 1.28, 0.19); g.add(tag); g.userData.tag = tag; } // 名札(段階・役割の色)
    g.userData.torso = torso; g.userData.limbs = { legL, legR, armL, armR };
    return g;
  }
  // 歩行(脚と腕の振り)。walking=false で直立に戻す
  function animateFigure(g, t, walking) {
    const L = g.userData.limbs; if (!L) return;
    const a = walking ? Math.sin(t) * 0.55 : 0;
    L.legL.rotation.x = a; L.legR.rotation.x = -a;
    L.armL.rotation.x = -a * 0.8; L.armR.rotation.x = a * 0.8;
  }
  // 着席(脚を前へ)
  function sitFigure(g, sitting) {
    const L = g.userData.limbs; if (!L) return;
    L.legL.rotation.x = sitting ? -Math.PI / 2 : 0; L.legR.rotation.x = sitting ? -Math.PI / 2 : 0;
    L.legL.position.y = sitting ? 0.62 : 0.37; L.legR.position.y = sitting ? 0.62 : 0.37;
    L.legL.position.z = sitting ? 0.2 : 0; L.legR.position.z = sitting ? 0.2 : 0;
  }

  /* ---------- 光(時間帯と天気) ---------- */
  function setupRenderer(renderer) {
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.physicallyCorrectLights = false;
  }
  function lightRig(scene) {
    const hemi = new T.HemisphereLight(0xEAF2F8, 0x8C877C, 0.55);
    const sun = new T.DirectionalLight(0xFFF3DF, 0.9);
    sun.position.set(14, 18, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.bias = -0.0008;
    sun.shadow.normalBias = 0.02;
    const cam = sun.shadow.camera; cam.near = 1; cam.far = 60; cam.left = -14; cam.right = 14; cam.top = 14; cam.bottom = -14; cam.updateProjectionMatrix();
    const amb = new T.AmbientLight(0xFFFFFF, 0.18);
    scene.add(hemi, sun, sun.target, amb); // target をシーンに入れないと向きが効かない
    return { hemi, sun, amb };
  }
  // 天気と時刻(0〜1=朝〜夕)で空・太陽・露出を決める
  const SKY = { sunny: 0xDCE8EE, cloudy: 0xC7D1D8, rain: 0xA9B7C2, heat: 0xEFE6D0, ice: 0xE6ECF2 };
  const SKY_TOP = { sunny: 0x8FB6D8, cloudy: 0x9CACB8, rain: 0x7E8C99, heat: 0xB6C2CC, ice: 0xB9C8D4 };
  const hexStr = (n) => '#' + n.toString(16).padStart(6, '0');
  function applyLight(rig, scene, renderer, kind, hour, indoor) {
    const sky = SKY[kind] || SKY.sunny;
    scene.background.setHex(sky); scene.fog.color.setHex(sky);
    if (rig.dome) rig.dome.material = MAT.sky(hexStr(SKY_TOP[kind] || SKY_TOP.sunny), hexStr(sky));
    const cloudy = kind === 'cloudy' || kind === 'rain' || kind === 'ice';
    const h = hour == null ? 0.4 : hour; // 0=朝 0.5=昼 1=夕
    // 仰角 40°(朝)→62°(昼)→15°(夕)。真上からだと影が什器の真下に隠れて読めない
    const elev = h < 0.5 ? 0.70 + h * 0.7 : 1.05 - (h - 0.5) * 1.6;
    const az = Math.PI * (0.2 + h * 0.6); // 東→南→西
    const R = 20, c = rig.center || { x: 10, z: 7 };
    rig.sun.position.set(c.x + Math.cos(elev) * Math.cos(az) * R, Math.sin(elev) * R, c.z + Math.cos(elev) * Math.sin(az) * R);
    // 院内は天井照明が主光源=天気で暗くしない(影が読める強さを保つ)。街は天気に従う
    rig.sun.intensity = indoor ? 0.95 : (cloudy ? 0.35 : 0.9);
    rig.sun.color.setHex(indoor ? 0xFFF6E8 : h > 0.8 ? 0xFFD9B0 : cloudy ? 0xE8EEF2 : 0xFFF3DF);
    rig.hemi.intensity = indoor ? 0.5 : cloudy ? 0.7 : 0.55;
    rig.amb.intensity = indoor ? 0.22 : 0.18;
    renderer.toneMappingExposure = cloudy ? 0.95 : 1.0;
    rig.sun.target.position.set(c.x, 0, c.z); rig.sun.target.updateMatrixWorld();
  }

  // 影の範囲をシーン(幅 w・奥行 d・中心)に合わせる。建て直しのたびに呼ぶ
  function fitShadow(rig, w, d, cx, cz) {
    const cam = rig.sun.shadow.camera; const r = Math.max(w, d) / 2 + 2;
    cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r; cam.updateProjectionMatrix();
    rig.center = { x: cx, z: cz };
    rig.sun.target.position.set(cx, 0, cz); rig.sun.target.updateMatrixWorld();
  }
  root.WALK_LOOK = { fitShadow, TEX, MAT, GEO, box, cyl, PROPS, figure, animateFigure, sitFigure, setupRenderer, lightRig, applyLight };
})(window);
