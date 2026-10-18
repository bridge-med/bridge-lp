/* ================================================================
   film — THE FUTURE OF CLINIC OPERATIONS(23.0 秒・60fps・無音)
   CHAOS → CONNECTION → INTELLIGENCE → CONTROL → FUTURE を、切らずに 1 カットのカメラで撮る。
   render(ctx, canvas, t) は t だけで 1 枚が決まる(シーク・一時停止・書き出しのため)。
   ================================================================ */
(function (root) {
  'use strict';
  const F = root.FILM, M = F.M, E = F.E, D = F.D;
  const { clamp, lerp, seg, smooth, ease, rgba, hash, noise, rng } = M;
  const { W, H } = E;

  const DUR = 23, FPS = 60;
  const CH = [
    { t: 0, en: 'CHAOS' },
    { t: 4.2, en: 'CONNECTION' },
    { t: 8.8, en: 'INTELLIGENCE' },
    { t: 13.2, en: 'CONTROL' },
    { t: 17.8, en: 'FUTURE' },
  ];

  const FONT = {
    en: (w, px) => `${w} ${px}px Archivo, system-ui, sans-serif`,
    mono: (w, px) => `${w} ${px}px "Chivo Mono", ui-monospace, monospace`,
    jp: (w, px) => `${w} ${px}px "Zen Kaku Gothic New", "Hiragino Sans", "Yu Gothic", sans-serif`,
  };
  const setFont = (g, font, stretch = 'normal', track = 0) => {
    g.font = font;
    if ('fontStretch' in g) g.fontStretch = stretch;
    if ('letterSpacing' in g) g.letterSpacing = `${track}px`;
  };

  /* 文言(和文はフォントの先読みにも使う) */
  const TXT = {
    s1a: 'THE NUMBERS ARE THERE.',
    s1b: 'THE PICTURE ISN\u2019T.',
    endA: 'SEE CLEARLY.',
    endB: 'THEN DECIDE.',
    title: 'THE FUTURE OF CLINIC OPERATIONS',
    note: '数値はすべて架空のサンプルです',
    noteEn: 'SAMPLE DATA',
    opts: ['再診の枠を 15時台に広げる', 'リハの予約を 14時台に寄せる', '今週はこのまま様子を見る'],
    pick: 1,                                          // 人が選ぶのは 2 つ目(並びの先頭=おすすめ、と読まれないように)
  };

  /* ---- 一日の図の寸法(平面の局所座標。正面・距離=焦点距離のとき 1 単位=1px) ---- */
  const UPM = 2.5;                                   // 1 分 = 2.5
  const ux = m => (m - 810) * UPM;                    // 13:30 が 0。8:30 = -750 / 18:30 = 750
  const LH = 56, LT = -110, NL = D.LANES.length;
  const laneTop = i => LT + i * LH;
  const laneMid = i => LT + i * LH + LH / 2;
  const LB = LT + NL * LH;                            // レーンの下端 226
  const rowY = bl => {
    const cap = D.LANES[bl.lane].cap;
    if (cap === 1) return laneMid(bl.lane);
    const h = (LH - 14) / cap;
    return laneTop(bl.lane) + 7 + h * (bl.sub + 0.5);
  };
  const rowH = bl => { const cap = D.LANES[bl.lane].cap; return cap === 1 ? LH - 24 : (LH - 14) / cap - 2.2; };
  const WY0 = -168, WK = 3.9;                         // 待ち時間の線: 0 分 = -168、1 分 = 3.9
  const wy = m => WY0 - m * WK;
  const fmt = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor(m % 60)).padStart(2, '0')}`;

  /* ---- 状態 ---- */
  let PAL = null, NI = null, DY = null;
  let frags = [], dust = [], letters = [], endLetters = [], WD = [];
  const post = new E.Post();
  const plane = new E.Plane();
  const q = { x: 0, y: 0, s: 0, z: 0, ok: false }, q2 = { x: 0, y: 0, s: 0, z: 0, ok: false };
  let filterOK = true;

  /* canvas の filter(ぼけ)が効くかを一度だけ確かめる。効かなければ縮小拡大でぼかす */
  function probeFilter() {
    const c = E.mk(9, 9), g = c.getContext('2d');
    if (!('filter' in g)) return false;
    g.filter = 'blur(2px)';
    g.fillStyle = '#fff';
    g.fillRect(4, 4, 1, 1);
    const d = g.getImageData(0, 4, 1, 1).data;
    return d[3] > 0;
  }

  /* ================================================================
     素材: 断片(ピントの合わない数字)と、冒頭の一文の文字
     ================================================================ */
  function fragSpecs() {
    const S = D.stats, L = D.LANE;
    const nX = D.blocks.filter(b => b.lane === L.xr).length;
    const nR = D.blocks.filter(b => b.lane === L.rh).length;
    const nNew = D.P.filter(p => p.newPt).length;
    const nRe = D.P.filter(p => p.kind === 'consult').length - nNew;
    const hourly = [];
    for (let h = 8; h < 19; h++) hourly.push(D.P.filter(p => p.arr >= h * 60 && p.arr < h * 60 + 60).length);
    const spark = D.curve.map(b => (b.s == null ? null : b.s));
    const list = [
      { k: 'kv', l: '10時台の待ち', v: String(S.peak), u: '分', lane: L.c1, m: 630 },
      { k: 'kv', l: '来院', v: String(S.arrived), u: '人', lane: L.rec, m: 610 },
      { k: 'kv', l: '本日の予定', v: String(S.total), u: '人', lane: L.rec, m: 905 },
      { k: 'kv', l: 'リハ室 14:00–15:30', v: String(S.rehabGap), u: '%', lane: L.rh, m: 875 },
      { k: 'kv', l: '患者単価', v: '¥5,860', u: '', lane: L.pay, m: 770 },
      { k: 'kv', l: 'X線', v: String(nX), u: '件', lane: L.xr, m: 655 },
      { k: 'kv', l: 'リハ', v: String(nR), u: '件', lane: L.rh, m: 690 },
      { k: 'kv', l: '新患', v: String(nNew), u: '人', lane: L.c2, m: 612 },
      { k: 'kv', l: '再診', v: String(nRe), u: '人', lane: L.c1, m: 965 },
      { k: 'kv', l: '平均待ち', v: String(S.waitAvg), u: '分', lane: L.c2, m: 985 },
      { k: 'kv', l: '理学療法士', v: '5', u: '名', lane: L.rh, m: 1010 },
      { k: 'kv', l: '受付・会計', v: '3', u: '名', lane: L.pay, m: 1045 },
      { k: 'kv', l: '稼働率', v: String(S.occ), u: '%', lane: L.c2, m: 720 },
      { k: 'kv', l: '会計待ち', v: '6', u: '分', lane: L.pay, m: 700 },
      { k: 'spark', l: '待ち時間', data: spark, lane: L.c1, m: 660 },
      { k: 'spark', l: '来院 / 時間', data: hourly, lane: L.rec, m: 840 },
      { k: 'bars', l: '時間帯別の来院', data: hourly, lane: L.rec, m: 700 },
      { k: 'bars', l: 'リハ 単位', data: [3, 6, 9, 10, 9, 4, 2, 5, 8, 9, 7], lane: L.rh, m: 960 },
      { k: 'ring', v: S.occ, lane: L.c1, m: 1000 },
      { k: 'ring', v: S.rehabGap, lane: L.rh, m: 900 },
      { k: 'sched', lane: L.c2, m: 940 },
      { k: 'sched', lane: L.c1, m: 560 },
      { k: 'plan', lane: L.xr, m: 900 },
      { k: 'people', n: 9, l: '待合', lane: L.rec, m: 640 },
      { k: 'people', n: 5, l: 'リハ室', lane: L.rh, m: 1050 },
      { k: 'tag', v: '診察2', lane: L.c2, m: 1030 },
      { k: 'tag', v: '予約の変更', lane: L.rec, m: 980 },
      { k: 'tag', v: '電話 14件', lane: L.rec, m: 560 },
      { k: 'tag', v: '会計待ち', lane: L.pay, m: 640 },
      { k: 'tag', v: 'X線 待ち 2', lane: L.xr, m: 610 },
      { k: 'tag', v: '午後の空き', lane: L.rh, m: 850 },
      { k: 'tag', v: '紹介状', lane: L.c1, m: 590 },
      { k: 'kv', l: '電話', v: '14', u: '件', lane: L.rec, m: 575 },
      { k: 'kv', l: '予約の変更', v: '7', u: '件', lane: L.rec, m: 1000 },
      { k: 'kv', l: '紹介', v: '3', u: '件', lane: L.c2, m: 940 },
      { k: 'kv', l: 'X線 待ち', v: '2', u: '人', lane: L.xr, m: 620 },
      { k: 'kv', l: '会計', v: '12', u: '人/時', lane: L.pay, m: 1020 },
      { k: 'spark', l: '会計待ち', data: [2, 3, 5, 7, 6, 4, 3, 2, 4, 5, 6, 3], lane: L.pay, m: 900 },
      { k: 'bars', l: '曜日別の予約', data: D.week.map(w => w.booked), lane: L.rec, m: 1060 },
      { k: 'ring', v: Math.round(S.load.pt * 100), lane: L.rh, m: 640 },
      { k: 'people', n: 4, l: '会計待ち', lane: L.pay, m: 700 },
      { k: 'tag', v: '再診', lane: L.c1, m: 700 },
      { k: 'tag', v: '新患', lane: L.c2, m: 560 },
      { k: 'tag', v: 'リハ 2単位', lane: L.rh, m: 1040 },
      { k: 'tag', v: '予約外', lane: L.rec, m: 660 },
    ];
    /* 冒頭で順にピントが合う 3 つの事実(開いた瞬間に読める数字)。図へは降りない */
    list.unshift(
      { k: 'hero', l: '受付開始', v: '08:30', at: [1000, -250, -40], nofly: true },
      { k: 'hero', l: '本日の予定', v: String(S.total), u: '人', at: [2300, 130, 26], nofly: true },
      { k: 'hero', l: '10時台の待ち', v: String(S.peak), u: '分', at: [3000, -93, 40], nofly: true },
    );
    /* 実際の予定の帯から、時刻の断片を作る。降りる先はその帯 */
    const r = rng(5);
    const picks = [];
    while (picks.length < 40) {
      const bl = D.blocks[Math.floor(r() * D.blocks.length)];
      if (bl.lane === L.rec || bl.lane === L.pay) { if (r() < 0.6) continue; }
      if (picks.includes(bl)) continue;
      picks.push(bl);
    }
    for (const bl of picks) list.push({ k: 'time', v: fmt(bl.a), l: D.LANES[bl.lane].jp, lane: bl.lane, m: bl.a, bl });
    return list;
  }

  /* 断片を一枚の絵にする(夜の色。lighter で足すので地は透明) */
  function fragSprite(sp) {
    const C = NI, ink = C.ink, ink2 = C.ink2, ice = C.ice;
    const text = (g, s, x, y, font, col, a = 1, align = 'left', track = 0) => {
      setFont(g, font, 'normal', track); g.textAlign = align; g.textBaseline = 'alphabetic';
      g.fillStyle = rgba(col, a); g.fillText(s, x, y);
    };
    const meas = (g, s, font, track = 0) => { setFont(g, font, 'normal', track); return g.measureText(s).width; };
    const probe = E.mk(4, 4).getContext('2d');
    switch (sp.k) {
      case 'hero': {
        const wv = meas(probe, sp.v, FONT.mono(300, 64)), wu = sp.u ? meas(probe, sp.u, FONT.jp(500, 22)) : 0;
        const wl = meas(probe, sp.l, FONT.jp(500, 19));
        const w = Math.ceil(Math.max(wl, wv + wu + 8)) + 20, h = 112;
        return new E.Sprite(w, h, g => {
          text(g, sp.l, 10, 28, FONT.jp(500, 19), ink2);
          text(g, sp.v, 8, 96, FONT.mono(300, 64), ink);
          if (sp.u) text(g, sp.u, 10 + wv + 8, 96, FONT.jp(500, 22), ink2);
        });
      }
      case 'kv': {
        const wv = meas(probe, sp.v, FONT.mono(300, 40)), wu = sp.u ? meas(probe, sp.u, FONT.jp(500, 17)) : 0;
        const wl = meas(probe, sp.l, FONT.jp(500, 15));
        const w = Math.ceil(Math.max(wl, wv + wu + 6)) + 16, h = 78;
        return new E.Sprite(w, h, g => {
          text(g, sp.l, 8, 24, FONT.jp(500, 15), ink2);
          text(g, sp.v, 8, 66, FONT.mono(300, 40), ink);
          if (sp.u) text(g, sp.u, 8 + wv + 6, 66, FONT.jp(500, 17), ink2);
        });
      }
      case 'time': {
        const wv = meas(probe, sp.v, FONT.mono(400, 28)), wl = meas(probe, sp.l, FONT.jp(500, 15));
        const w = Math.ceil(wv + wl + 34), h = 44;
        return new E.Sprite(w, h, g => {
          g.fillStyle = rgba(ice, 1); g.beginPath(); g.arc(9, 23, 3.2, 0, Math.PI * 2); g.fill();
          text(g, sp.v, 20, 33, FONT.mono(400, 28), ink);
          text(g, sp.l, 26 + wv, 32, FONT.jp(500, 15), ink2);
        });
      }
      case 'spark': {
        const w = 170, h = 74;
        return new E.Sprite(w, h, g => {
          text(g, sp.l, 6, 18, FONT.jp(500, 14), ink2);
          const d = sp.data.map((v, i) => [i, v]).filter(p => p[1] != null);
          const mx = Math.max(...d.map(p => p[1])), n = sp.data.length - 1;
          g.strokeStyle = rgba(ice, 0.95); g.lineWidth = 1.6; g.lineJoin = 'round'; g.beginPath();
          let pen = false;
          sp.data.forEach((v, i) => {
            if (v == null) { pen = false; return; }
            const x = 6 + (i / n) * (w - 12), y = h - 8 - (v / mx) * (h - 34);
            if (pen) g.lineTo(x, y); else g.moveTo(x, y);
            pen = true;
          });
          g.stroke();
        });
      }
      case 'bars': {
        const w = 150, h = 72;
        return new E.Sprite(w, h, g => {
          text(g, sp.l, 6, 18, FONT.jp(500, 14), ink2);
          const mx = Math.max(...sp.data), n = sp.data.length, bw = (w - 12) / n;
          sp.data.forEach((v, i) => {
            const bh = (v / mx) * (h - 34);
            g.fillStyle = rgba(i === sp.data.indexOf(mx) ? ink : ink2, i === sp.data.indexOf(mx) ? 0.95 : 0.6);
            g.fillRect(6 + i * bw + 1, h - 6 - bh, bw - 3, bh);
          });
        });
      }
      case 'ring': {
        const w = 76, h = 76;
        return new E.Sprite(w, h, g => {
          g.lineWidth = 3; g.strokeStyle = rgba(ink2, 0.35);
          g.beginPath(); g.arc(38, 38, 28, 0, Math.PI * 2); g.stroke();
          g.strokeStyle = rgba(ice, 1); g.lineCap = 'round';
          g.beginPath(); g.arc(38, 38, 28, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * sp.v / 100); g.stroke();
          text(g, `${sp.v}%`, 38, 44, FONT.mono(400, 16), ink, 1, 'center');
        });
      }
      case 'sched': {
        const w = 160, h = 58, rr = rng(sp.m);
        return new E.Sprite(w, h, g => {
          for (let row = 0; row < 3; row++) {
            let x = 4;
            g.strokeStyle = rgba(ink2, 0.35); g.lineWidth = 1;
            g.beginPath(); g.moveTo(2, 8 + row * 18 + 14); g.lineTo(w - 2, 8 + row * 18 + 14); g.stroke();
            while (x < w - 20) {
              const bw = 10 + rr() * 26;
              if (rr() < 0.72) { g.fillStyle = rgba(row === 1 ? ice : ink2, 0.75); g.fillRect(x, 8 + row * 18, bw, 10); }
              x += bw + 3 + rr() * 8;
            }
          }
        });
      }
      case 'plan': {
        const w = 190, h = 120;
        return new E.Sprite(w, h, g => {
          g.strokeStyle = rgba(ink2, 0.8); g.lineWidth = 1.2;
          const R = [[4, 4, 70, 50, '受付'], [74, 4, 112, 50, '待合'], [4, 54, 56, 62, '診察1'], [60, 54, 56, 62, '診察2'], [116, 54, 70, 62, 'リハ室']];
          for (const [x, y, rw, rh, s] of R) { g.strokeRect(x, y, rw, rh); text(g, s, x + 7, y + 19, FONT.jp(500, 12), ink2); }
          g.strokeStyle = rgba(ice, 0.9); g.lineWidth = 1.4; g.setLineDash([3, 4]);
          g.beginPath(); g.moveTo(38, 30); g.lineTo(130, 30); g.lineTo(130, 70); g.lineTo(88, 90); g.lineTo(150, 96); g.stroke();
          g.setLineDash([]);
        });
      }
      case 'people': {
        const w = 26 + sp.n * 15 + 70, h = 50;
        return new E.Sprite(w, h, g => {
          for (let i = 0; i < sp.n; i++) person(g, 12 + i * 15, 26, 1, rgba(i < 2 ? ice : ink2, 0.9));
          text(g, `${sp.l} ${sp.n}人`, 20 + sp.n * 15, 32, FONT.jp(500, 15), ink);
        });
      }
      default: { // tag
        const wl = meas(probe, sp.v, FONT.jp(500, 16)), w = Math.ceil(wl) + 28, h = 34;
        return new E.Sprite(w, h, g => {
          g.strokeStyle = rgba(ink2, 0.6); g.lineWidth = 1;
          rr(g, 1.5, 1.5, w - 3, h - 3, 4); g.stroke();
          text(g, sp.v, 14, 23, FONT.jp(500, 16), ink);
        });
      }
    }
  }
  function rr(g, x, y, w, h, r) {
    g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
  }
  /* 人の形(頭と肩)。患者や職員を数字の先にいる人として描く */
  function person(g, x, y, k, col) {
    g.fillStyle = col;
    g.beginPath(); g.arc(x, y - 6 * k, 3.4 * k, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(x, y + 7 * k, 5.8 * k, 6 * k, 0, Math.PI, 0); g.fill();
  }

  function buildFrags() {
    const r = rng(99), specs = fragSpecs();
    const c0 = E.camera(rigTarget(0));
    frags = specs.map((sp, i) => {
      if (sp.at) {                                     // 開いた瞬間のカメラから見て、奥行き d・画面のずれ (sx, sy)
        const [d, sx, sy] = sp.at, k = d / c0.f;
        const x = c0.px + c0.fw[0] * d + c0.rt[0] * sx * k + c0.dn[0] * sy * k;
        const y = c0.py + c0.fw[1] * d + c0.rt[1] * sx * k + c0.dn[1] * sy * k;
        const z = c0.pz + c0.fw[2] * d + c0.rt[2] * sx * k + c0.dn[2] * sy * k;
        return { sp, spr: fragSprite(sp), x, y, z, vx: 0, vy: 0, vz: 0, sc: 1.45, fl: r(), af: true, nofly: true, tf: 99, df: 1, arc: 0, tx: 0, ty: 0 };
      }
      let x, y, z, guard = 0;
      /* 冒頭の一文の場所と、3 つの事実の視線の上を避ける(読ませる拍に重ねない) */
      const blocked = () => {
        if (Math.abs(x) < 1000 && Math.abs(y + 40) < 320 && z > -1650 && z < 300) return true;
        const dx = x - c0.px, dy = y - c0.py, dz = z - c0.pz;
        const d = dx * c0.fw[0] + dy * c0.fw[1] + dz * c0.fw[2];
        if (d < 50) return false;
        const sx = (dx * c0.rt[0] + dy * c0.rt[1] + dz * c0.rt[2]) * c0.f / d, sy = (dx * c0.dn[0] + dy * c0.dn[1] + dz * c0.dn[2]) * c0.f / d;
        return specs.some(h => h.at && d > h.at[0] - 1500 && d < h.at[0] + 700 && Math.hypot(sx - h.at[1], sy - h.at[2]) < 300);
      };
      do {
        const ang = r() * Math.PI * 2, near = r() < 0.7;
        const rad = near ? 170 + Math.pow(r(), 0.9) * 1250 : 1400 + r() * 1300;
        x = Math.cos(ang) * rad; y = Math.sin(ang) * rad * 0.6 - 40; z = -4300 + r() * 6000;
      } while (guard++ < 80 && blocked());
      return {
        sp, spr: fragSprite(sp), x, y, z,
        vx: (r() - 0.5) * 36, vy: (r() - 0.5) * 22, vz: (r() - 0.5) * 30,
        sc: r() < 0.25 ? 1.5 + r() * 0.8 : 0.9 + r() * 0.5, fl: r(), af: r() < 0.45,
        tf: 4.9 + r() * 0.75, df: 1.15 + r() * 0.35, arc: 0.6 + r() * 0.8,
        tx: ux(sp.m), ty: sp.bl ? rowY(sp.bl) : laneMid(sp.lane) + (r() - 0.5) * 20,
      };
    });
    dust = [];
    const rd = rng(123);
    for (let i = 0; i < 1000; i++) {
      const ang = rd() * Math.PI * 2, rad = 90 + Math.pow(rd(), 0.6) * 3000;
      const c = rd(), b = Math.pow(rd(), 3);
      dust.push({
        x: Math.cos(ang) * rad, y: Math.sin(ang) * rad * 0.64 - 40, z: -5200 + rd() * 8400,
        r: 0.8 + b * 3.4, a: 0.1 + b * 0.75,
        col: c < 0.22 ? 'ice' : 'ink', ph: rd() * 100, vx: (rd() - 0.5) * 20, vy: (rd() - 0.5) * 14,
      });
    }
  }

  /* 一文を 1 字ずつのスプライトに。位置は字詰め込みで測る */
  function buildLetters(str, font, stretch, track, col, scale) {
    const g = E.mk(4, 4).getContext('2d');
    setFont(g, font, stretch, track);
    const total = g.measureText(str).width;
    const out = [];
    for (let i = 0; i < str.length; i++) {
      const ch = str[i];
      const x0 = g.measureText(str.slice(0, i)).width;
      const wch = g.measureText(ch).width;
      if (ch === ' ') continue;
      const m = g.measureText(ch);
      const asc = Math.ceil(m.actualBoundingBoxAscent || 0) + 6, desc = Math.ceil(m.actualBoundingBoxDescent || 0) + 6;
      const pw = Math.ceil(wch) + 12, ph = asc + desc;
      const spr = new E.Sprite(pw, ph, gg => {
        setFont(gg, font, stretch, 0);
        gg.textBaseline = 'alphabetic'; gg.textAlign = 'left'; gg.fillStyle = rgba(col, 1);
        gg.fillText(ch, 6, asc);
      }, scale);
      out.push({ ch, spr, x: x0 - total / 2 + wch / 2, w: wch, asc, i });
    }
    return { list: out, width: total };
  }

  function init() {
    PAL = M.readPalette(); NI = PAL.night; DY = PAL.day;
    filterOK = probeFilter();
    E.setBlurMode(filterOK);
    E.stamps();
    buildFrags();
    letters = [
      buildLetters(TXT.s1a, FONT.en(600, 60), 'expanded', 1.5, NI.ink, 2),
      buildLetters(TXT.s1b, FONT.en(600, 60), 'expanded', 1.5, NI.ink, 2),
    ];
    WD = '月火水木金土日'.split('').map(ch => {
      const c = E.mk(300, 300), g = c.getContext('2d');
      setFont(g, FONT.jp(700, 250)); g.textAlign = 'left'; g.textBaseline = 'alphabetic';
      g.fillStyle = rgba(DY.ink2, 1); g.fillText(ch, 10, 250);
      return c;
    });
    endLetters = [
      buildLetters(TXT.endA, FONT.en(600, 92), 'expanded', 1, DY.ink, 1.5),
      buildLetters(TXT.endB, FONT.en(600, 92), 'expanded', 1, DY.ink, 1.5),
    ];
  }

  /* ================================================================
     カメラの台本。値 = 基準 + Σ(差分 × 緩急(区間の進み))。区間が重なると動きがつながる
     ================================================================ */
  const tr = (t, base, moves) => {
    let v = base;
    for (const [a, b, d, e] of moves) v += d * (e || ease.inOut)(seg(t, a, b));
    return v;
  };
  const OPT_U = -730, OPT_V = 318, OPT_DY = 44;      // 選択肢の位置(平面の局所座標。図の左下)
  function rigTarget(t) {
    const r = {
      tx: tr(t, 0, [[4.5, 6.1, -40], [14.0, 15.6, 40]]),
      ty: tr(t, -40, [[4.5, 6.1, 90], [8.8, 9.6, -112], [11.0, 11.9, 102], [14.0, 15.6, -10]]),
      tz: tr(t, -900, [[4.5, 6.1, 900]]),
      yaw: tr(t, -0.1, [[0, 1.8, 0.1, ease.out], [4.5, 6.1, -0.62], [6.3, 7.8, 0.62], [14.05, 15.6, 0.34], [15.6, 16.6, -0.34, ease.soft]]),
      pitch: tr(t, 0.05, [[0, 1.8, -0.05, ease.out], [4.5, 6.1, 0.3], [6.3, 7.8, -0.3], [14.05, 15.6, 0.15], [15.6, 16.6, -0.15, ease.soft]]),
      roll: tr(t, 0.05, [[0, 1.8, -0.05, ease.out], [4.5, 6.1, -0.05], [6.3, 7.8, 0.05]]),
      dist: tr(t, 3600, [[0, 2.6, -2740, ease.dive], [2.6, 4.2, -60, ease.soft], [4.5, 6.1, 350], [6.3, 7.8, 1610], [7.8, 8.8, -30, ease.soft],
        [8.8, 9.6, 140], [9.6, 11.2, -110, ease.soft], [13.0, 14.0, -900, ease.in], [14.0, 15.6, 2330, ease.out], [15.6, 16.6, -700, ease.soft], [16.6, 17.8, -60, ease.soft]]),
      f: tr(t, 1100, [[4.5, 6.1, 20], [6.3, 7.8, 1580], [14.0, 15.6, -300]]),
    };
    /* 選択肢へ寄る(虹彩の前) */
    const k = ease.inOut(seg(t, 13.0, 14.0)) * (1 - ease.inOut(seg(t, 14.0, 15.4)));
    r.tx += (OPT_U + 120 - r.tx) * k * 0.55; r.ty += (OPT_V + OPT_DY * TXT.pick - r.ty) * k * 0.55;
    /* 小さな手持ちの揺れ(ほぼ止まる拍では弱く) */
    const sway = 0.0045 * (1 - 0.7 * readBeat(t));
    r.yaw += noise(t * 0.35, 3) * sway; r.pitch += noise(t * 0.3, 4) * sway * 0.7;
    r.focus = t < 4.2 ? Math.min(r.dist, 1000) : r.dist;
    r.aperture = t < 4.2 ? lerp(8, 22, smooth(0.9, 2.5, t)) : 22;   // 冒頭は深いピント(数字が読める)→ 一文が来るころに背景がぼける
    return r;
  }
  /* 読ませる拍(カメラをほぼ止める区間)。1 で静止に近い */
  function readBeat(t) {
    const w = (a, b) => smooth(a, a + 0.4, t) * (1 - smooth(b - 0.4, b, t));
    return Math.max(w(2.6, 4.2), w(7.8, 8.9), w(9.7, 13.0), w(16.6, 17.8), w(20.4, 23.4));
  }

  /* FUTURE: 位置で決めるカメラ。17.8 秒の注視点のカメラから始めて、つなぎ目をなくす */
  let S5_0 = null;
  function rigFuture(t) {
    if (!S5_0) {
      const r0 = rigTarget(17.8), c0 = E.camera(r0);
      S5_0 = { x: c0.px, y: c0.py, z: c0.pz, yaw: r0.yaw, pitch: r0.pitch, f: r0.f };
    }
    const a = ease.inOut(seg(t, 17.8, 19.4)), b = ease.inOut(seg(t, 19.1, 21.1));
    const x = S5_0.x * (1 - a);
    const y = lerp(lerp(S5_0.y, -2300, a), DH / 2 - 1250, b);
    const z = lerp(lerp(S5_0.z, -1700, a), -4750, b);
    const pitch = lerp(lerp(S5_0.pitch, 0.9, a), 0.0368, b);
    const yaw = S5_0.yaw * (1 - a);
    const f = lerp(lerp(S5_0.f, 2100, a), 1900, b);
    const dist = 4000;
    const cp = Math.cos(pitch), sp = Math.sin(pitch);
    return {
      tx: x + Math.sin(yaw) * cp * dist, ty: y + sp * dist, tz: z + Math.cos(yaw) * cp * dist,
      yaw, pitch, roll: 0, dist, f, focus: dist, aperture: 0,
    };
  }
  const rig = t => (t < 17.8 ? rigTarget(t) : rigFuture(t));

  /* ================================================================
     場面ごとの量
     ================================================================ */
  const flip = t => ease.inOut(seg(t, 13.2, 14.13));           // 虹彩の開き 0→1
  const sweepY = t => lerp(-140, H + 140, ease.inOut(seg(t, 4.2, 5.05)));
  /* ピント送り: 焦点の線が通ったところから絞りを閉じる */
  const apK = (t, y) => (t < 4.2 ? 1 : t > 5.1 ? 0 : clamp((y - sweepY(t)) / 180 + 0.5));
  /* 図の上の時刻(14:20 まで進み、CONTROL で次の来院まで進む) */
  const NEXT = D.NEXT;
  const clock = t => (t < 7.3 ? D.T0 : t < 15.8 ? lerp(D.T0, D.NOW, ease.inOut(seg(t, 7.3, 8.7))) : lerp(D.NOW, NEXT, ease.inOut(seg(t, 15.9, 16.8))));

  /* ================================================================
     描画: 地
     ================================================================ */
  function background(ctx, C, alpha = 1) {
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
    const g = ctx.createRadialGradient(W / 2, H * 0.46, 40, W / 2, H * 0.5, W * 0.72);
    g.addColorStop(0, rgba(C.haze, 1));
    g.addColorStop(1, rgba(C.bg, 1));
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
  }

  /* ================================================================
     CHAOS: 断片と粒
     ================================================================ */
  function fragPos(f, t, out) {
    const tt = Math.min(t, 6.8);
    const wob = 18;
    out[0] = f.x + f.vx * tt + noise(tt * 0.4 + f.fl * 9, 1) * wob;
    out[1] = f.y + f.vy * tt + noise(tt * 0.4 + f.fl * 9, 2) * wob;
    out[2] = f.z + f.vz * tt;
    let k = 0;
    if (!f.nofly && t > f.tf) {
      k = ease.inOut(seg(t, f.tf, f.tf + f.df));
      const p0x = f.x + f.vx * f.tf + noise(f.tf * 0.4 + f.fl * 9, 1) * wob;
      const p0y = f.y + f.vy * f.tf + noise(f.tf * 0.4 + f.fl * 9, 2) * wob;
      const p0z = f.z + f.vz * f.tf;
      const mx = (p0x + f.tx) / 2, my = (p0y + f.ty) / 2 - 220 * f.arc, mz = (p0z + 0) / 2 - 380 * f.arc;
      const u = 1 - k;
      out[0] = u * u * p0x + 2 * u * k * mx + k * k * f.tx;
      out[1] = u * u * p0y + 2 * u * k * my + k * k * f.ty;
      out[2] = u * u * p0z + 2 * u * k * mz + k * k * 0;
    }
    return k;
  }
  let LITE = 1;                                       // 1=全部 / 2=粒を半分(重い端末)
  let STREAK = null;                                  // 実時間の再生だけ: 半コマ前のカメラ(粒に短い尾を引く)
  function drawDust(ctx, cam, t, front) {
    const fade = 1 - smooth(4.9, 6.4, t);
    if (fade <= 0) return;
    ctx.globalCompositeOperation = 'lighter';
    const iceC = NI.ice, inkC = NI.ink;
    for (let i = 0; i < dust.length; i += LITE) {
      const d = dust[i];
      const x = d.x + d.vx * t + noise(t * 0.3 + d.ph, 5) * 12, y = d.y + d.vy * t, z = d.z;
      if (front ? z > 0 : z <= 0) continue;
      if (!E.project(cam, x, y, z, q)) continue;
      if (q.x < -200 || q.x > W + 200 || q.y < -200 || q.y > H + 200) continue;
      const near = smooth(70, 420, q.z);              // レンズのそばの円は暗く薄くして消す(点滅を避ける)
      const tw = 0.75 + 0.25 * noise(t * 0.8 + d.ph, 6);
      const blur = E.coc(cam, q.z) * apK(t, q.y);
      const a = d.a * fade * near * tw, col = d.col === 'ice' ? iceC : inkC;
      /* 書き出しでは本物の動きのぼけ(サブフレームの平均)を使う。実時間では、速い前進のときだけ尾を引く */
      if (STREAK && blur < 6 && E.project(STREAK, x, y, z, q2)) {
        const len = Math.hypot(q.x - q2.x, q.y - q2.y);
        if (len > 3) {
          ctx.globalAlpha = Math.min(1, a * 1.4) / (1 + len / 30); ctx.strokeStyle = rgba(col, 1);
          ctx.lineWidth = Math.max(0.8, d.r * q.s * 0.9); ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(q2.x, q2.y); ctx.lineTo(q.x, q.y); ctx.stroke();
          continue;
        }
      }
      E.light(ctx, q.x, q.y, Math.max(0.6, d.r * q.s * 0.9), blur, a, col);
    }
    ctx.globalAlpha = 1;
  }

  function drawFrags(ctx, cam, t) {
    if (t > 7.4) return;
    const P = [0, 0, 0], items = [];
    for (const f of frags) {
      const k = fragPos(f, t, P);
      if (!E.project(cam, P[0], P[1], P[2], q)) continue;
      if (q.x < -400 || q.x > W + 400 || q.y < -300 || q.y > H + 300) continue;
      items.push({ f, k, x: q.x, y: q.y, s: q.s, z: q.z });
    }
    items.sort((a, b) => b.z - a.z);
    ctx.globalCompositeOperation = 'lighter';
    for (const it of items) {
      const f = it.f;
      const near = smooth(60, 380, it.z);
      const fl = 0.82 + 0.18 * noise(t * 1.1 + f.fl * 13, 7);
      const land = 1 - smooth(0.55, 1, it.k);
      const intro = f.nofly ? 1 : smooth(0, 0.5, t);
      const a = near * fl * land * intro;
      const blur = E.coc(cam, it.z) * apK(t, it.y);
      const s = it.s * f.sc * lerp(1, 0.32, it.k);
      E.drawSprite(ctx, f.spr, it.x, it.y, s, blur, a);
      /* オートフォーカスの括弧: CHAOS では焦点面を通る断片に一瞬、CONNECTION では線が通った断片に */
      let ab = 0;
      if (t < 4.2 && f.af) ab = clamp(1 - Math.abs(it.z - cam.focus) / (f.nofly ? 260 : 110)) * (f.nofly ? 1 : smooth(0.6, 1.2, t));
      else if (t >= 4.2 && f.af) ab = (1 - apK(t, it.y)) * (1 - smooth(0.05, 0.4, it.k));
      if (ab > 0.02) {
        const w = f.spr.w * s / 2 + 7, h = f.spr.h * s / 2 + 6;
        brackets(ctx, it.x - w, it.y - h, w * 2, h * 2, Math.min(12, w * 0.5), NI.ink, 0.75 * ab * near, 1.2, lerp(1.18, 1, ab));
      }
      if (it.k > 0.85 && it.k < 1) {                   // 着地の小さな光
        E.light(ctx, it.x, it.y, 3, 0, (1 - (it.k - 0.85) / 0.15) * 0.8, NI.ice);
      }
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  /* 括弧(画面座標)。k は外へ広げる倍率(ロックの動き) */
  function brackets(ctx, x, y, w, h, L, col, a, lw = 1.5, k = 1) {
    if (a <= 0.01) return;
    const cx = x + w / 2, cy = y + h / 2, hw = (w / 2) * k, hh = (h / 2) * k;
    ctx.globalAlpha = a; ctx.strokeStyle = rgba(col, 1); ctx.lineWidth = lw; ctx.lineCap = 'square';
    ctx.beginPath();
    ctx.moveTo(cx - hw, cy - hh + L); ctx.lineTo(cx - hw, cy - hh); ctx.lineTo(cx - hw + L, cy - hh);
    ctx.moveTo(cx + hw - L, cy - hh); ctx.lineTo(cx + hw, cy - hh); ctx.lineTo(cx + hw, cy - hh + L);
    ctx.moveTo(cx + hw, cy + hh - L); ctx.lineTo(cx + hw, cy + hh); ctx.lineTo(cx + hw - L, cy + hh);
    ctx.moveTo(cx - hw + L, cy + hh); ctx.lineTo(cx - hw, cy + hh); ctx.lineTo(cx - hw, cy + hh - L);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  /* 冒頭の一文: 奥からピントの面へ来る。2 行目は焦点面の奥に置き、ぼけたまま */
  function drawStatement(ctx, cam, t) {
    if (t > 4.7) return;
    const lines = [
      { L: letters[0], z: -900, y: -112, size: 62 / 60, t0: 1.15 },
      { L: letters[1], z: -470, y: 36, size: 92 / 60, t0: 2.0 },
    ];
    ctx.globalCompositeOperation = 'lighter';
    for (const ln of lines) {
      for (const lt of ln.L.list) {
        const st = ln.t0 + lt.i * 0.028;
        const k = ease.out(seg(t, st, st + 0.85));
        if (k <= 0) continue;
        const ex = ease.in(seg(t, 3.75 + hash(lt.i, 3) * 0.3, 4.6));
        const dx = (hash(lt.i, 7) - 0.5) * 900 * ex, dy = (hash(lt.i, 8) - 0.5) * 520 * ex, dz = (hash(lt.i, 9) - 0.35) * -1400 * ex;
        const x = lt.x * ln.size * 1.0 + dx, y = ln.y + dy, z = ln.z + (1 - k) * 700 + dz;
        if (!E.project(cam, x, y, z, q)) continue;
        const blur = E.coc(cam, q.z);
        E.drawSprite(ctx, lt.spr, q.x, q.y, q.s * ln.size, blur, k * (1 - ex), 0.5, lt.asc / lt.spr.h);
      }
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
  }

  /* ピント送りの線 */
  function drawSweep(ctx, t) {
    if (t < 4.2 || t > 5.1) return;
    const y = sweepY(t), a = Math.sin(Math.PI * seg(t, 4.2, 5.1));
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createLinearGradient(0, y - 26, 0, y + 26);
    g.addColorStop(0, rgba(NI.ice, 0)); g.addColorStop(0.5, rgba(NI.ice, 0.16 * a)); g.addColorStop(1, rgba(NI.ice, 0));
    ctx.fillStyle = g; ctx.fillRect(0, y - 26, W, 52);
    ctx.globalAlpha = 0.85 * a; ctx.fillStyle = rgba(NI.ink, 1); ctx.fillRect(0, y - 0.75, W, 1.5);
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  /* ================================================================
     平面への描画(ペン)。g は部品の移動と縮尺(du, dv, k)
     ================================================================ */
  const pen = {
    ctx: null, cam: null, S: 1, g: { du: 0, dv: 0, k: 1 },
    use(ctx, cam, S) { this.ctx = ctx; this.cam = cam; this.S = S; this.g = { du: 0, dv: 0, k: 1 }; return this; },
    grp(du, dv, k) { this.g = { du, dv, k }; return this; },
    X(a) { return this.g.du + this.g.k * a; },
    Y(b) { return this.g.dv + this.g.k * b; },
    p(a, b, out = q) { return plane.pt(this.cam, this.X(a), this.Y(b), out); },
    move(a, b) { if (!this.p(a, b)) return false; this.ctx.moveTo(q.x, q.y); return true; },
    line(a, b) { if (!this.p(a, b)) return false; this.ctx.lineTo(q.x, q.y); return true; },
    rect(a, b, w, h) {
      const c = this.ctx;
      if (!this.p(a, b)) return false; c.moveTo(q.x, q.y);
      if (!this.p(a + w, b)) return false; c.lineTo(q.x, q.y);
      if (!this.p(a + w, b + h)) return false; c.lineTo(q.x, q.y);
      if (!this.p(a, b + h)) return false; c.lineTo(q.x, q.y);
      c.closePath(); return true;
    },
    text(s, a, b, font, col, al = 1, align = 'left', stretch = 'normal', track = 0, base = 'alphabetic') {
      if (al <= 0.01) return;
      const m = plane.affine(this.cam, this.X(a), this.Y(b));
      if (!m) return;
      const c = this.ctx, k = this.g.k, S = this.S;
      c.setTransform(S * m[0] * k, S * m[1] * k, S * m[2] * k, S * m[3] * k, S * m[4], S * m[5]);
      setFont(c, font, stretch, track);
      c.textAlign = align; c.textBaseline = base;
      c.globalAlpha = al; c.fillStyle = rgba(col, 1);
      c.fillText(s, 0, 0);
      c.setTransform(S, 0, 0, S, 0, 0);
      c.globalAlpha = 1;
    },
    /* 括弧(平面座標)。lock: 0→1 で外から締まる */
    brackets(a, b, w, h, L, col, al, lw = 1.5, lock = 1) {
      if (al <= 0.01) return;
      const c = this.ctx, k = lerp(1.22, 1, lock);
      const cx = a + w / 2, cy = b + h / 2, hw = (w / 2) * k, hh = (h / 2) * k;
      c.globalAlpha = al * lock; c.strokeStyle = rgba(col, 1); c.lineWidth = lw; c.lineCap = 'square';
      c.beginPath();
      this.move(cx - hw, cy - hh + L); this.line(cx - hw, cy - hh); this.line(cx - hw + L, cy - hh);
      this.move(cx + hw - L, cy - hh); this.line(cx + hw, cy - hh); this.line(cx + hw, cy - hh + L);
      this.move(cx + hw, cy + hh - L); this.line(cx + hw, cy + hh); this.line(cx + hw - L, cy + hh);
      this.move(cx - hw + L, cy + hh); this.line(cx - hw, cy + hh); this.line(cx - hw, cy + hh - L);
      c.stroke(); c.globalAlpha = 1;
    },
  };

  /* ================================================================
     CONNECTION / INTELLIGENCE: 一日の図(夜も昼も同じ形。色だけ C で変える)
     ================================================================ */
  const blockAt = bl => 5.3 + ((bl.a - D.T0) / (D.T1 - D.T0)) * 1.25 + hash(bl.p * 7 + bl.lane, 2) * 0.12;

  /* 図(待ち時間の線と一日の図)の置き場所。CONTROL で「本日の流れ」の枠へ縮んで移る */
  function chartGroup(t) {
    const k = ease.inOut(seg(t, 14.3, 15.4));
    return { du: lerp(0, -302, k), dv: lerp(0, 80, k), k: lerp(1, 0.95, k) };
  }
  const curveGroup = chartGroup;

  function drawChart(ctx, cam, t, C, day) {
    const g = chartGroup(t);
    pen.grp(g.du, g.dv, g.k);
    const tau = clock(t);
    const heatK = ease.inOut(seg(t, 8.8, 9.8));
    const ink = C.ink, ink2 = C.ink2, rule = C.rule, ice = C.ice;
    const textAmber = day ? C.amberink : C.amber;

    /* レーンの罫と名前 */
    const lab = smooth(6.3, 7.2, t);
    ctx.lineWidth = 1;
    for (let i = 0; i <= NL; i++) {
      const al = (i === 0 || i === NL ? 0.55 : 0.32) * smooth(5.2 + i * 0.05, 5.9 + i * 0.05, t);
      if (al <= 0.01) continue;
      ctx.globalAlpha = al; ctx.strokeStyle = rgba(rule, 1); ctx.beginPath();
      pen.move(ux(D.T0), laneTop(i)); pen.line(ux(D.T1), laneTop(i)); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    D.LANES.forEach((L, i) => {
      pen.text(L.jp, ux(D.T0) - 22, laneMid(i) + 6, FONT.jp(500, 18), ink, lab * smooth(6.3 + i * 0.06, 6.9 + i * 0.06, t), 'right');
    });
    /* 時刻の目盛り */
    for (let h = 9; h <= 18; h++) {
      const al = smooth(6.5 + (h - 9) * 0.04, 7.1 + (h - 9) * 0.04, t);
      if (al <= 0.01) continue;
      ctx.globalAlpha = 0.5 * al; ctx.strokeStyle = rgba(rule, 1); ctx.beginPath();
      pen.move(ux(h * 60), LT - 6); pen.line(ux(h * 60), LT); ctx.stroke(); ctx.globalAlpha = 1;
      pen.text(String(h), ux(h * 60), LT - 14, FONT.mono(400, 15), ink2, al, 'center');
    }
    /* 昼休み(診察だけ。リハ室は 13:30 から) */
    const lunch = smooth(6.6, 7.3, t) * (1 - heatK * 0.5);
    if (lunch > 0.01) {
      ctx.globalAlpha = (day ? 0.05 : 0.06) * lunch; ctx.fillStyle = rgba(ink, 1); ctx.beginPath();
      pen.rect(ux(750), laneTop(1), ux(900) - ux(750), LH * 3); ctx.fill(); ctx.globalAlpha = 1;
      pen.text('昼休み', (ux(750) + ux(900)) / 2, laneMid(2) + 6, FONT.jp(500, 15), ink2, 0.9 * lunch * (1 - heatK), 'center');
    }

    /* 熱の表(INTELLIGENCE) */
    if (heatK > 0.01) {
      for (let l = 0; l < NL; l++) {
        const row = D.heat[l];
        for (let j = 0; j < row.length; j++) {
          const v = row[j];
          const reveal = smooth(8.8 + j * 0.035, 9.2 + j * 0.035, t);
          if (v <= 0.02 || reveal <= 0) continue;
          ctx.globalAlpha = (day ? 0.5 : 0.42) * v * reveal; ctx.fillStyle = rgba(ice, 1); ctx.beginPath();
          pen.rect(ux(D.T0 + j * 30) + 2.5, laneTop(l) + 5, 75 - 5, LH - 10); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    /* 予定の帯: 予定=線、済み=塗り。時刻の線が通ると塗りになる */
    const fadeB = 1 - heatK * 0.66;
    for (const bl of D.blocks) {
      const at = blockAt(bl);
      const k = ease.out(seg(t, at, at + 0.32));
      if (k <= 0) continue;
      const x0 = ux(bl.a), w = Math.max(2.2, (bl.b - bl.a) * UPM - 1.6) * k, y = rowY(bl), h = rowH(bl);
      const doneK = bl.a < tau ? 1 : 0;
      ctx.beginPath(); pen.rect(x0, y - h / 2, w, h);
      if (doneK) { ctx.globalAlpha = (day ? 0.72 : 0.72) * fadeB; ctx.fillStyle = rgba(day ? ink2 : ink2, 1); ctx.fill(); }
      else { ctx.globalAlpha = 0.5 * fadeB; ctx.strokeStyle = rgba(ink2, 1); ctx.lineWidth = 1; ctx.stroke(); }
    }
    ctx.globalAlpha = 1;

    /* 患者ごとの流れ(前の帯の終わり → 次の帯の始まり) */
    const flowK = smooth(5.6, 6.9, t) * (1 - heatK * 0.55);
    if (flowK > 0.01) {
      ctx.globalAlpha = (day ? 0.2 : 0.24) * flowK; ctx.strokeStyle = rgba(ice, 1); ctx.lineWidth = 1;
      ctx.beginPath();
      for (const p of D.P) {
        const st = p.steps;
        for (let i = 0; i < st.length - 1; i++) {
          const A = st[i], B = st[i + 1];
          const at = Math.max(blockAt(A), blockAt(B)) + 0.15;
          const k = ease.inOut(seg(t, at, at + 0.4));
          if (k <= 0) continue;
          curve(ux(A.b), rowY(A), ux(B.a), rowY(B), k);
        }
      }
      ctx.stroke(); ctx.globalAlpha = 1;
    }

    /* 「いま」の線と、流れる人の点 */
    const nowK = smooth(7.2, 7.6, t);
    if (nowK > 0.01) {
      const x = ux(tau);
      ctx.globalAlpha = nowK; ctx.strokeStyle = rgba(day ? C.amber : C.amber, 1); ctx.lineWidth = 2;
      ctx.beginPath(); pen.move(x, LT - 30); pen.line(x, LB + 10); ctx.stroke(); ctx.globalAlpha = 1;
      pen.text(fmt(tau), x + 8, LT - 34, FONT.mono(500, 17), textAmber, nowK);
      pen.text('NOW', x + 8, LT - 54, FONT.en(600, 11), textAmber, nowK * 0.95, 'left', 'normal', 1.6);
      drawPulses(ctx, t, tau, C, nowK * (1 - heatK * 0.4), day);
    }
    return { tau };
  }

  /* 2 点をつなぐ S 字(平面上)。k は描き進み */
  function curve(a0, b0, a1, b1, k = 1) {
    const dx = Math.max(16, Math.abs(a1 - a0) * 0.5);
    const n = 9, m = Math.max(1, Math.round(n * k));
    if (!pen.move(a0, b0)) return;
    for (let i = 1; i <= m; i++) {
      const s = (i / n), u = 1 - s;
      const a = u * u * u * a0 + 3 * u * u * s * (a0 + dx) + 3 * u * s * s * (a1 - dx) + s * s * s * a1;
      const b = u * u * u * b0 + 3 * u * u * s * b0 + 3 * u * s * s * b1 + s * s * s * b1;
      pen.line(a, b);
    }
  }
  function curvePt(a0, b0, a1, b1, s) {
    const dx = Math.max(16, Math.abs(a1 - a0) * 0.5), u = 1 - s;
    return [u * u * u * a0 + 3 * u * u * s * (a0 + dx) + 3 * u * s * s * (a1 - dx) + s * s * s * a1,
      u * u * u * b0 + 3 * u * u * s * b0 + 3 * u * s * s * b1 + s * s * s * b1];
  }
  /* 時刻 tau に、いま院内にいる人の点 */
  function drawPulses(ctx, t, tau, C, al, day) {
    if (al <= 0.01) return;
    ctx.globalCompositeOperation = day ? 'source-over' : 'lighter';
    for (const p of D.P) {
      if (tau < p.arr || tau > p.out) continue;
      const st = p.steps;
      let pa = null, pb = null;
      for (let i = 0; i < st.length; i++) {
        const A = st[i];
        if (tau >= A.a && tau <= A.b) { pa = ux(tau); pb = rowY(A); break; }
        const B = st[i + 1];
        if (B && tau > A.b && tau < B.a) {
          const [a, b] = curvePt(ux(A.b), rowY(A), ux(B.a), rowY(B), (tau - A.b) / (B.a - A.b));
          pa = a; pb = b; break;
        }
      }
      if (pa == null) continue;
      if (!pen.p(pa, pb)) continue;
      if (day) { ctx.globalAlpha = al; ctx.fillStyle = rgba(C.iceink, 1); ctx.beginPath(); ctx.arc(q.x, q.y, 3.2 * q.s * pen.g.k, 0, Math.PI * 2); ctx.fill(); }
      else E.light(ctx, q.x, q.y, 2.6 * q.s, 0, al, C.ink);
    }
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
  }

  /* 待ち時間の線(INTELLIGENCE で描き、CONTROL で下の段へ) */
  function drawCurve(ctx, cam, t, C, day) {
    const k = smooth(8.85, 9.9, t);
    if (k <= 0.01) return;
    const g = curveGroup(t);
    pen.grp(g.du, g.dv, g.k);
    const prog = ease.inOut(seg(t, 8.9, 10.0));
    const xMax = Math.min(ux(D.T0) + (ux(D.T1) - ux(D.T0)) * prog, ux(clock(t)));   // 測れているのは「いま」まで
    const ink2 = C.ink2, rule = C.rule, ice = C.ice;
    const textIce = day ? C.iceink : C.ice;
    /* 目盛り: 0 分と 30 分 */
    ctx.globalAlpha = 0.45 * k; ctx.strokeStyle = rgba(rule, 1); ctx.lineWidth = 1; ctx.beginPath();
    pen.move(ux(D.T0), wy(0)); pen.line(ux(D.T1), wy(0)); ctx.stroke();
    ctx.setLineDash([3, 5]); ctx.beginPath(); pen.move(ux(D.T0), wy(30)); pen.line(ux(D.T1), wy(30)); ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    pen.text('30分', ux(D.T0) - 22, wy(30) + 5, FONT.jp(500, 14), ink2, k, 'right');
    pen.text('待ち時間', ux(D.T0) - 22, wy(0) - 2, FONT.jp(500, 14), ink2, k, 'right');
    /* 線(午前と午後で分ける) */
    const pts = D.curve;
    const runs = [];
    let cur = [];
    for (const b of pts) {
      if (b.s == null) { if (cur.length) runs.push(cur); cur = []; continue; }
      cur.push([ux(b.t), wy(b.s)]);
    }
    if (cur.length) runs.push(cur);
    for (const run of runs) {
      const vis = run.filter(p => p[0] <= xMax);
      if (vis.length < 1) continue;
      if (vis.length < run.length && vis.length >= 1) {
        const i = vis.length, A = run[i - 1], B = run[i];
        const s = clamp((xMax - A[0]) / (B[0] - A[0]));
        vis.push([lerp(A[0], B[0], s), lerp(A[1], B[1], s)]);
      }
      /* 面 */
      ctx.globalAlpha = (day ? 0.12 : 0.14) * k; ctx.fillStyle = rgba(ice, 1); ctx.beginPath();
      pen.move(vis[0][0], wy(0)); for (const p of vis) pen.line(p[0], p[1]); pen.line(vis[vis.length - 1][0], wy(0)); ctx.closePath(); ctx.fill();
      /* 線 */
      ctx.globalAlpha = k; ctx.strokeStyle = rgba(day ? C.iceink : ice, 1); ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.beginPath();
      vis.forEach((p, i) => (i ? pen.line(p[0], p[1]) : pen.move(p[0], p[1]))); ctx.stroke();
      if (prog < 1 && vis.length < run.length + 1 && pen.p(vis[vis.length - 1][0], vis[vis.length - 1][1])) {
        if (day) { ctx.fillStyle = rgba(C.iceink, 1); ctx.beginPath(); ctx.arc(q.x, q.y, 4, 0, Math.PI * 2); ctx.fill(); }
        else { ctx.globalCompositeOperation = 'lighter'; E.light(ctx, q.x, q.y, 4, 0, 0.9, C.ink); ctx.globalCompositeOperation = 'source-over'; }
      }
    }
    ctx.globalAlpha = 1;
    return textIce;
  }

  /* 走査と、材料に付く括弧(ピークと空き)。答えは描かない */
  const scanU = t => lerp(ux(D.T0) - 30, ux(D.T1) + 30, ease.inOut(seg(t, 9.85, 11.05)));
  const scanAt = u => 9.85 + 1.2 * ((u - ux(D.T0) + 30) / (ux(D.T1) - ux(D.T0) + 60));
  function drawInsights(ctx, cam, t, C, day) {
    if (t < 9.8 || t > 14.8) return;
    const out = 1 - smooth(14.15, 14.6, t);
    const amber = day ? C.amberink : C.amber, ink = C.ink, ink2 = C.ink2;
    /* 走査線 */
    if (t < 11.2) {
      const g = chartGroup(t); pen.grp(g.du, g.dv, g.k);
      const u = scanU(t), a = Math.sin(Math.PI * seg(t, 9.85, 11.1));
      ctx.globalAlpha = 0.7 * a; ctx.strokeStyle = rgba(day ? C.ink : C.ink, 1); ctx.lineWidth = 1.2; ctx.beginPath();
      pen.move(u, wy(46)); pen.line(u, LB + 8); ctx.stroke(); ctx.globalAlpha = 1;
    }
    /* 1) 10 時台の待ちのピーク(線の上) */
    {
      const g = curveGroup(t); pen.grp(g.du, g.dv, g.k);
      const a0 = ux(600), a1 = ux(660), b0 = wy(46), b1 = wy(0) + 6;
      const lock = ease.out(seg(t, scanAt(a1), scanAt(a1) + 0.35));
      pen.brackets(a0 - 6, b0, a1 - a0 + 12, b1 - b0, 14, C.amber, out, 2, lock);
      const la = smooth(scanAt(a1) + 0.1, scanAt(a1) + 0.5, t) * out;
      pen.text('PEAK', a1 + 24, b0 + 16, FONT.en(600, 12), amber, la, 'left', 'normal', 2);
      pen.text('10時台の待ち時間', a1 + 24, b0 + 42, FONT.jp(500, 19), ink, la);
      pen.text(String(D.stats.peak), a1 + 24, b0 + 92, FONT.mono(300, 50), ink, la);
      const w = 32 * String(D.stats.peak).length;
      pen.text('分(平均)', a1 + 28 + w, b0 + 92, FONT.jp(500, 18), ink2, la);
    }
    /* 2) リハ室 14:00–15:30 の空き(熱の表の上) */
    {
      const g = chartGroup(t); pen.grp(g.du, g.dv, g.k);
      const a0 = ux(840), a1 = ux(930), b0 = laneTop(4) + 1, b1 = laneTop(5) - 1;
      const lock = ease.out(seg(t, scanAt(a1), scanAt(a1) + 0.35));
      pen.brackets(a0 - 4, b0 - 3, a1 - a0 + 8, b1 - b0 + 6, 12, C.amber, out, 2, lock);
      const la = smooth(scanAt(a1) + 0.1, scanAt(a1) + 0.5, t) * out;
      const lx = a0 - 4, ly = LB + 34;
      ctx.globalAlpha = la * 0.8; ctx.strokeStyle = rgba(C.amber, 1); ctx.lineWidth = 1.2; ctx.beginPath();
      pen.move(lx, b1 + 3); pen.line(lx, ly - 14); ctx.stroke(); ctx.globalAlpha = 1;
      pen.text('GAP', lx, ly + 2, FONT.en(600, 12), amber, la, 'left', 'normal', 2);
      pen.text('リハ室 14:00–15:30', lx + 52, ly + 3, FONT.jp(500, 19), ink, la);
      pen.text(`稼働 ${D.stats.rehabGap}%`, lx + 52 + 186, ly + 3, FONT.jp(500, 19), ink, la);
    }
  }

  /* 選択肢: 3 つ並び、人がひとつを選ぶ(画は材料と選択肢まで。どれが正しいかは描かない) */
  function optPos(i) { return [OPT_U, OPT_V + i * OPT_DY]; }
  const TAP = 12.8;                                  // 3 つが出揃って(11.94)から 0.8 秒あけて触れる
  function drawOptions(ctx, cam, t, C, day) {
    if (t < 11.25 || t > 14.8) return;
    const out = 1 - smooth(14.15, 14.6, t);
    pen.grp(0, 0, 1);
    const ink = C.ink, ink2 = C.ink2, amber = C.amber, amberT = day ? C.amberink : C.amber;
    const head = smooth(11.25, 11.6, t) * out;
    const x0 = OPT_U - 30, y0 = OPT_V - 58;
    pen.text('OPTIONS', x0 + 30, y0 + 12, FONT.en(600, 12), amberT, head, 'left', 'normal', 2);
    pen.text('どう動かすかを選ぶ', x0 + 132, y0 + 13, FONT.jp(500, 16), ink2, head);
    const picked = ease.out(seg(t, TAP + 0.05, TAP + 0.35));
    TXT.opts.forEach((s, i) => {
      const [a, b] = optPos(i);
      const al = smooth(11.35 + i * 0.12, 11.7 + i * 0.12, t) * out;
      if (al <= 0.01) return;
      const sel = i === TXT.pick;
      const dim = sel ? 1 : 1 - 0.45 * picked;                        // 丸(飾り)だけ薄くする
      const col = sel ? ink : M.mixc(ink, ink2, picked);              // 文字は色で引く(ink-2 は AA を満たす)
      /* 丸(選んだものだけ塗る) */
      if (pen.p(a, b - 6)) {
        const r = 8 * q.s;
        ctx.globalAlpha = al * dim; ctx.strokeStyle = rgba(sel && picked > 0 ? amber : ink2, 1); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(q.x, q.y, r, 0, Math.PI * 2); ctx.stroke();
        if (sel && picked > 0) { ctx.globalAlpha = al * picked; ctx.fillStyle = rgba(amber, 1); ctx.beginPath(); ctx.arc(q.x, q.y, r * 0.55, 0, Math.PI * 2); ctx.fill(); }
        ctx.globalAlpha = 1;
      }
      pen.text(s, a + 22, b, FONT.jp(sel && picked > 0.5 ? 700 : 500, 20), col, al);
    });
    const wBox = 470, hBox = OPT_DY * 3 + 52;
    pen.brackets(x0, y0 - 8, wBox, hBox, 14, ink2, 0.8 * head, 1.4, ease.out(seg(t, 11.25, 11.6)));
    /* 触れた跡(人が選んだことの印) */
    const [a, b] = optPos(TXT.pick);
    const tk = seg(t, TAP - 0.18, TAP + 0.55);
    if (tk > 0 && tk < 1 && pen.p(a, b - 6)) {
      const down = smooth(0, 0.22, tk) * (1 - smooth(0.32, 0.5, tk));
      ctx.globalAlpha = 0.85 * down; ctx.fillStyle = rgba(ink, 1);
      ctx.beginPath(); ctx.arc(q.x, q.y, 15 * q.s, 0, Math.PI * 2); ctx.fill();
      const rk = seg(tk, 0.25, 1);
      if (rk > 0) {
        ctx.globalAlpha = 0.7 * (1 - rk); ctx.strokeStyle = rgba(ink, 1); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(q.x, q.y, (16 + 46 * ease.out(rk)) * q.s, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

  /* ================================================================
     CONTROL: ダッシュボード(昼)。部品は角の括弧で止まる。カードの枠は描かない
     ================================================================ */
  const DW = 2400, DH = 1350;                          // 板の大きさ(中心が原点)
  function lockK(t, at) { return ease.out(seg(t, at, at + 0.45)); }

  function drawSheet(ctx, cam, t, C, al) {
    if (al <= 0.01) return;
    pen.grp(0, 0, 1);
    const standing = 1 - smooth(17.9, 18.9, t);
    const sc = pen.p(0, 0) ? q.s : 1;
    ctx.save();
    ctx.globalAlpha = al;
    if (standing > 0.01) {                             // 板が立っているあいだの影
      ctx.shadowColor = rgba(C.ink, 0.2 * standing);
      ctx.shadowBlur = 90 * sc * pen.S;
      ctx.shadowOffsetY = 40 * sc * pen.S;
    }
    ctx.fillStyle = rgba(C.panel, 1); ctx.beginPath(); pen.rect(-DW / 2, -DH / 2, DW, DH); ctx.fill();
    ctx.restore();
    ctx.globalAlpha = al * 0.9; ctx.strokeStyle = rgba(C.rule, 1); ctx.lineWidth = 1;
    ctx.beginPath(); pen.rect(-DW / 2, -DH / 2, DW, DH); ctx.stroke();
    /* 床に倒れたら、今日の板に琥珀の縁 */
    const today = smooth(18.9, 19.7, t);
    if (today > 0.01) {
      ctx.globalAlpha = today; ctx.strokeStyle = rgba(C.amber, 1); ctx.lineWidth = 2.5;
      ctx.beginPath(); pen.rect(-DW / 2 - 40, -DH / 2 - 40, DW + 80, DH + 80); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function module(x, y, w, h, en, jp, at, C) {
    const lk = lockK(_t, at);
    pen.brackets(x, y, w, h, 18, C.ink3, 0.95, 1.5, lk);
    setFont(pen.ctx, FONT.en(600, 13), 'normal', 2.2);
    const wen = pen.ctx.measureText(en).width;
    pen.text(en, x + 28, y + 44, FONT.en(600, 13), C.ink2, lk, 'left', 'normal', 2.2);
    pen.text(jp, x + 28 + wen + 18, y + 45, FONT.jp(500, 19), C.ink, lk);
    return lk;
  }
  let _t = 0;
  function drawDashboard(ctx, cam, t, C) {
    _t = t;
    const ink = C.ink, ink2 = C.ink2, ink3 = C.ink3, rule = C.rule, amber = C.amber, amberT = C.amberink, iceT = C.iceink;
    pen.grp(0, 0, 1);
    const L = -1140, R = 1140;
    /* 見出しの帯 */
    const hk = lockK(t, 14.55);
    pen.text('SAMPLE CLINIC', L, -598, FONT.en(700, 22), ink, hk, 'left', 'expanded', 3);
    pen.text('整形外科・リハビリテーション科(架空のクリニック)', L + 330, -598, FONT.jp(500, 19), ink2, hk);
    const tau = clock(t);
    pen.text('TODAY', R - 150, -598, FONT.en(600, 14), ink2, hk, 'right', 'normal', 2.4);
    pen.text(fmt(tau), R, -596, FONT.mono(400, 30), ink, hk, 'right');
    if (pen.p(R - 268, -604)) {
      const live = 0.55 + 0.45 * Math.cos(t * Math.PI * 1.2) ** 2;
      ctx.globalAlpha = hk * live; ctx.fillStyle = rgba(amber, 1); ctx.beginPath(); ctx.arc(q.x, q.y, 5 * q.s, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 0.9 * hk; ctx.strokeStyle = rgba(rule, 1); ctx.lineWidth = 1; ctx.beginPath();
    pen.move(L, -568); pen.line(R, -568); ctx.stroke(); ctx.globalAlpha = 1;

    /* KPI 4 つ */
    const S = D.stats;
    const arrived = S.arrived + (clock(t) >= D.NEXT ? 1 : 0);   // 時計が次の来院に着いたら 1 人増える
    const kpis = [
      { en: 'VISITS', jp: '来院', v: String(arrived), u: '人', sub: `本日の予定 ${S.total}人` },
      { en: 'WAIT', jp: '平均待ち時間', v: String(S.waitAvg), u: '分', sub: `10時台は ${S.peak}分`, warn: true },
      { en: 'NEXT SLOT', jp: '次に入れられる枠', v: fmt(S.nextSlot), u: '', sub: 'リハ室' },
      { en: 'PER VISIT', jp: '患者単価', v: '¥' + S.unitPrice.toLocaleString('en-US'), u: '', sub: '本日の平均' },
    ];
    const kw = (R - L - 3 * 40) / 4, KY = -540;
    kpis.forEach((k, i) => {
      const x = L + i * (kw + 40), lk = lockK(t, 14.65 + i * 0.1);
      pen.brackets(x, KY, kw, 196, 18, ink3, 0.95, 1.5, lk);
      pen.text(k.en, x + 28, KY + 40, FONT.en(600, 13), ink2, lk, 'left', 'normal', 2.2);
      pen.text(k.jp, x + 28, KY + 70, FONT.jp(500, 19), ink, lk);
      pen.text(k.v, x + 26, KY + 150, FONT.mono(300, 76), ink, lk);
      if (k.u) {
        setFont(ctx, FONT.mono(300, 76)); const w = ctx.measureText(k.v).width;
        pen.text(k.u, x + 36 + w, KY + 150, FONT.jp(500, 22), ink2, lk);
      }
      pen.text(k.sub, x + 28, KY + 178, FONT.jp(500, 16), k.warn ? amberT : ink2, lk);
    });

    /* 本日の流れ(枠と題だけ。図は drawChart が縮んで入ってくる) */
    module(L, -305, 1580, 635, 'TODAY\u2019S FLOW', '本日の流れ', 14.95, C);

    /* 稼働率の輪(レンズの距離目盛りのように) */
    const rk = module(480, -305, 660, 315, 'OCCUPANCY', '稼働率', 15.05, C);
    {
      const cx = 480 + 660 - 150, cy = -305 + 182, rad = 88;
      const prog = ease.inOut(seg(t, 15.1, 15.85)) * S.occ / 100;
      ring(ctx, cx, cy, rad, 0, 1, rule, 12, rk);
      ring(ctx, cx, cy, rad, 0, prog, iceT, 12, rk);
      ctx.globalAlpha = rk * 0.75; ctx.strokeStyle = rgba(ink3, 1); ctx.lineWidth = 1.2; ctx.beginPath();
      for (let i = 0; i < 40; i++) {
        const an = -Math.PI / 2 + (i / 40) * Math.PI * 2, r0 = rad + 16, r1 = rad + (i % 5 === 0 ? 27 : 21);
        pen.move(cx + Math.cos(an) * r0, cy + Math.sin(an) * r0); pen.line(cx + Math.cos(an) * r1, cy + Math.sin(an) * r1);
      }
      ctx.stroke(); ctx.globalAlpha = 1;
      pen.text(String(S.occ), cx - 6, cy + 21, FONT.mono(300, 60), ink, rk, 'center');
      pen.text('%', cx + 48, cy + 19, FONT.jp(500, 20), ink2, rk);
      pen.text('診察室・リハ室', 508, -305 + 250, FONT.jp(500, 16), ink2, rk);
      pen.text('本日の予定を含む', 508, -305 + 278, FONT.jp(500, 16), ink2, rk);
    }

    /* 職員の負荷(人の形と、14:20 までの使用の割合) */
    const sk = module(480, 50, 660, 280, 'STAFF LOAD', '職員の負荷', 15.15, C);
    const staff = [['医師', 2, S.load.doctor], ['理学療法士', 5, S.load.pt], ['受付・会計', 3, S.load.front]];
    staff.forEach(([n, c, v], i) => {
      const y = 50 + 112 + i * 56, bx = 508, bw = 660 - 56;
      pen.text(n, bx, y, FONT.jp(500, 18), ink, sk);
      for (let j = 0; j < c; j++) {
        if (!pen.p(bx + 140 + j * 22, y - 7)) continue;
        person(ctx, q.x, q.y, q.s * 1.15, rgba(ink2, sk));
      }
      const pv = v * ease.inOut(seg(t, 15.2 + i * 0.08, 15.9 + i * 0.08));
      pen.text(`${Math.round(v * 100)}%`, bx + bw, y, FONT.mono(400, 20), ink, sk, 'right');
      ctx.globalAlpha = sk; ctx.fillStyle = rgba(rule, 1); ctx.beginPath(); pen.rect(bx, y + 13, bw, 5); ctx.fill();
      ctx.fillStyle = rgba(v > 0.82 ? amber : C.ice, 1); ctx.beginPath(); pen.rect(bx, y + 13, bw * pv, 5); ctx.fill(); ctx.globalAlpha = 1;
    });

    /* 来週の予約(細い棒。満ちた日だけ琥珀) */
    const bk = module(L, 372, 1580, 258, 'NEXT WEEK', '来週の予約', 15.25, C);
    D.week.forEach((d, i) => {
      const colW = (1580 - 56) / 6, x = L + 28 + i * colW, base = 372 + 214, hmax = 112;
      const r = d.booked / d.cap, h = hmax * r * ease.out(seg(t, 15.3 + i * 0.05, 16.0 + i * 0.05));
      const bx = x + 64;
      ctx.globalAlpha = bk; ctx.fillStyle = rgba(rule, 1); ctx.beginPath(); pen.rect(bx, base - hmax, 14, hmax); ctx.fill();
      ctx.fillStyle = rgba(r >= 0.97 ? amber : ink2, 1); ctx.beginPath(); pen.rect(bx, base - h, 14, h); ctx.fill(); ctx.globalAlpha = 1;
      pen.text(d.d, x + 10, base, FONT.jp(500, 18), ink2, bk);
      pen.text(`${Math.round(r * 100)}%`, bx + 30, base - 4, FONT.mono(400, 18), r >= 0.97 ? amberT : ink, bk);
    });

    /* 決めたこと(人が選んだことが画面に残る) */
    const dk = module(480, 372, 660, 258, 'DECIDED', '決めたこと', 15.45, C);
    if (pen.p(510, 372 + 112)) {
      ctx.globalAlpha = dk; ctx.fillStyle = rgba(amber, 1); ctx.beginPath(); ctx.arc(q.x, q.y, 6 * q.s, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
    }
    pen.text(TXT.opts[TXT.pick], 532, 372 + 124, FONT.jp(700, 28), ink, dk);
    pen.text('来週の月曜から・院長と事務長で決定', 510, 372 + 182, FONT.jp(500, 22), ink2, dk);
  }
  function ring(ctx, cx, cy, r, a0, a1, col, lw, al) {
    if (a1 <= a0 || al <= 0.01) return;
    const sc = pen.p(cx, cy) ? q.s * pen.g.k : 1;
    ctx.globalAlpha = al; ctx.strokeStyle = rgba(col, 1); ctx.lineWidth = lw * sc; ctx.beginPath();
    const n = Math.max(2, Math.ceil((a1 - a0) * 96));
    for (let i = 0; i <= n; i++) {
      const an = -Math.PI / 2 + (a0 + (a1 - a0) * (i / n)) * Math.PI * 2;
      const x = cx + Math.cos(an) * r, y = cy + Math.sin(an) * r;
      if (i) pen.line(x, y); else pen.move(x, y);
    }
    ctx.stroke(); ctx.globalAlpha = 1;
  }

  /* ================================================================
     FUTURE: 板が床に倒れ、先の日々のタイルが地平線まで並ぶ
     ================================================================ */
  const lay = t => ease.inOut(seg(t, 17.8, 19.4)) * Math.PI / 2;
  function setMainPlane(t) {
    const al = lay(t), pv = DH / 2;
    const v = [0, Math.cos(al), -Math.sin(al)];
    plane.set([0, pv - pv * Math.cos(al), pv * Math.sin(al)], [1, 0, 0], v);
  }
  const PITCH_X = DW + 220, PITCH_Z = DH + 200;              // 先の日々のタイルの間隔(月〜日 × 週)
  function drawTiles(ctx, cam, t, C) {
    const k = smooth(18.4, 19.4, t);
    if (k <= 0.01) return;
    const tile = new E.Plane();
    const order = [];
    for (let r = -3; r < 26; r++) {
      for (let c = -3; c <= 3; c++) {
        if (r === 0 && c === 0) continue;                // 今日は本物の板
        order.push({ r, c, d: Math.hypot(c * 0.9, r) });
      }
    }
    order.sort((a, b) => b.r - a.r);
    for (const o of order) {
      const x = o.c * PITCH_X, z = DH / 2 + o.r * PITCH_Z;
      tile.set([x, DH / 2, z], [1, 0, 0], [0, 0, -1]);
      if (!tile.pt(cam, 0, 0, q) || q.z > 90000) continue;
      const fog = clamp(1 - (q.z - 9000) / 52000);
      const appear = smooth(18.5 + o.d * 0.05, 19.1 + o.d * 0.05, t);
      const a = appear * fog * k;
      if (a <= 0.01) continue;
      const dow = (o.c + 3 + 7) % 7;                     // 0=月 … 6=日(今日=木)
      const past = o.r < 0 || (o.r === 0 && o.c < 0);
      const closed = dow === 6;
      const pts = [[-DW / 2, -DH / 2], [DW / 2, -DH / 2], [DW / 2, DH / 2], [-DW / 2, DH / 2]];
      ctx.beginPath();
      let ok = true;
      pts.forEach(([u, v], i) => { if (!tile.pt(cam, u, v, q2)) ok = false; else if (i) ctx.lineTo(q2.x, q2.y); else ctx.moveTo(q2.x, q2.y); });
      if (!ok) continue;
      ctx.closePath();
      ctx.globalAlpha = a * (closed ? 0.35 : past ? 0.55 : 0.92); ctx.fillStyle = rgba(C.panel, 1); ctx.fill();
      ctx.globalAlpha = a * 0.8; ctx.strokeStyle = rgba(C.rule, 1); ctx.lineWidth = 1; ctx.stroke();
      if (closed) continue;
      /* 見込みの帯: 波が今日から先へ渡る */
      const wave = ease.out(seg(t, 19.55 + o.d * 0.075, 20.1 + o.d * 0.075));
      const ld = D.forecast(Math.max(0, o.r), dow);
      const wv = past ? 1 : wave;
      if (wv <= 0) continue;
      const bw = (DW - 400) * ld * wv, by = DH / 2 - 300, bh = 74;
      ctx.beginPath(); ok = true;
      [[-DW / 2 + 200, by], [-DW / 2 + 200 + bw, by], [-DW / 2 + 200 + bw, by + bh], [-DW / 2 + 200, by + bh]].forEach(([u, v], i) => {
        if (!tile.pt(cam, u, v, q2)) ok = false; else if (i) ctx.lineTo(q2.x, q2.y); else ctx.moveTo(q2.x, q2.y);
      });
      if (!ok) continue;
      ctx.closePath();
      const hot = ld >= 0.92 && !past;
      ctx.globalAlpha = a * (past ? 0.3 : 0.9); ctx.fillStyle = rgba(hot ? C.amber : C.ink3, 1); ctx.fill();
      /* 曜日(手前の 2 列だけ) */
      if (o.r <= 1 && o.r >= 0) planeImage(ctx, cam, tile, WD[dow], -DW / 2 + 190, -DH / 2 + 170, 300, 300, a * 0.8);
    }
    ctx.globalAlpha = 1;
  }

  /* 平面に画像を正しい遠近で貼る(横の帯に割り、帯ごとにアフィンで描く) */
  const pa = { ok: false }, pb = { ok: false }, pc = { ok: false };
  function planeImage(ctx, cam, P, img, u, v, w, h, al, strips = 10) {
    if (al <= 0.01) return;
    const S = pen.S;
    ctx.globalAlpha = al;
    for (let i = 0; i < strips; i++) {
      const v0 = v + (h * i) / strips, v1 = v + (h * (i + 1)) / strips;
      if (!P.pt(cam, u, v0, pa) || !P.pt(cam, u + w, v0, pb) || !P.pt(cam, u, v1, pc)) break;
      const sy = (img.height * i) / strips, sh = img.height / strips;
      ctx.setTransform(S * (pb.x - pa.x) / img.width, S * (pb.y - pa.y) / img.width, S * (pc.x - pa.x) / sh, S * (pc.y - pa.y) / sh, S * pa.x, S * pa.y);
      ctx.drawImage(img, 0, sy, img.width, sh, 0, 0, img.width, sh + 0.6);
    }
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.globalAlpha = 1;
  }

  /* 締めの言葉: ピントの合っていない字が合う */
  function drawEnd(ctx, t, C) {
    if (t < 20.5) return;
    const lines = [
      { L: endLetters[0], y: 236, t0: 20.55 },
      { L: endLetters[1], y: 346, t0: 20.95 },
    ];
    for (const ln of lines) {
      for (const lt of ln.L.list) {
        const st = ln.t0 + lt.i * 0.022;
        const k = ease.out(seg(t, st, st + 0.9));
        if (k <= 0) continue;
        const blur = (1 - k) * 22;
        const s = lerp(1.06, 1, k);
        E.drawSprite(ctx, lt.spr, W / 2 + lt.x * s, ln.y, s, blur, k, 0.5, lt.asc / lt.spr.h);
      }
    }
    const tk = smooth(21.55, 22.15, t);
    if (tk > 0) {
      setFont(ctx, FONT.en(600, 17), 'normal', 6);
      ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
      ctx.globalAlpha = tk; ctx.fillStyle = rgba(C.ink2, 1);
      ctx.fillText(TXT.title, W / 2 + 3, 422);
      ctx.globalAlpha = 1;
    }
  }

  /* ファインダーの層: 四隅の印と、架空の注記(全コマ。ぼけさせない) */
  function drawHUD(ctx, t, C) {
    const a = 0.32 * (1 - smooth(20.6, 21.6, t) * 0.6);
    ctx.globalAlpha = a; ctx.strokeStyle = rgba(C.ink2, 1); ctx.lineWidth = 1.5;
    const m = 40, L = 26;
    ctx.beginPath();
    ctx.moveTo(m, m + L); ctx.lineTo(m, m); ctx.lineTo(m + L, m);
    ctx.moveTo(W - m - L, m); ctx.lineTo(W - m, m); ctx.lineTo(W - m, m + L);
    ctx.moveTo(W - m, H - m - L); ctx.lineTo(W - m, H - m); ctx.lineTo(W - m - L, H - m);
    ctx.moveTo(m + L, H - m); ctx.lineTo(m, H - m); ctx.lineTo(m, H - m - L);
    ctx.stroke();
    ctx.globalAlpha = 1;
    setFont(ctx, FONT.en(600, 13), 'normal', 2.4);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = rgba(C.ink2, 1);
    ctx.fillText(TXT.noteEn, 64, H - 58);
    const w = ctx.measureText(TXT.noteEn).width;
    setFont(ctx, FONT.jp(500, 16));
    ctx.fillText(TXT.note, 64 + w + 14, H - 58);
  }

  /* 虹彩: 選んだ点から円が開き、夜が昼に一度だけ反転する */
  function irisCenter(cam, t) {
    pen.grp(0, 0, 1);
    const [a, b] = optPos(TXT.pick);
    return pen.p(a, b - 6) ? { x: q.x, y: q.y } : { x: W / 2, y: H / 2 };
  }

  /* ================================================================
     1 枚を描く
     ================================================================ */
  function drawWorld(ctx, cam, t, C, day, S) {
    pen.use(ctx, cam, S);
    if (t >= 17.8) setMainPlane(t); else plane.set([0, 0, 0], [1, 0, 0], [0, 1, 0]);
    if (!day) {
      drawDust(ctx, cam, t, false);
      if (t > 5.0) { drawChart(ctx, cam, t, C, false); drawCurve(ctx, cam, t, C, false); drawInsights(ctx, cam, t, C, false); drawOptions(ctx, cam, t, C, false); }
      drawFrags(ctx, cam, t);
      drawDust(ctx, cam, t, true);
      drawStatement(ctx, cam, t);
    } else {
      if (t > 17.9) drawTiles(ctx, cam, t, C);
      pen.use(ctx, cam, S);
      if (t >= 17.8) setMainPlane(t);
      drawSheet(ctx, cam, t, C, smooth(14.25, 14.9, t));
      drawChart(ctx, cam, t, C, true);
      drawCurve(ctx, cam, t, C, true);
      drawInsights(ctx, cam, t, C, true);
      drawOptions(ctx, cam, t, C, true);
      if (t > 14.45) drawDashboard(ctx, cam, t, C);
    }
  }

  function render(ctx, canvas, t, o = {}) {
    if (!PAL) init();
    const skip = o.skip || NONE;
    LITE = skip.has('dust') ? 2 : 1;
    STREAK = o.streaks && t < 3 ? E.camera(rig(Math.max(0, t - 0.5 / FPS))) : null;
    t = clamp(t, 0, DUR);
    const S = canvas.width / W;
    const cam = E.camera(rig(t));
    ctx.setTransform(S, 0, 0, S, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.filter = 'none';
    const fl = flip(t);
    let iris = null;
    if (fl < 1) {
      background(ctx, NI);
      drawWorld(ctx, cam, t, NI, false, S);
      /* 光は明るい点に薄く(夜だけ) */
      if (!skip.has('bloom')) post.bloom(ctx, canvas, 0.55 * (1 - fl));
      ctx.setTransform(S, 0, 0, S, 0, 0);
      post.vignette(ctx, canvas, NI.shade, 0.4 * (1 - fl));
      ctx.setTransform(S, 0, 0, S, 0, 0);
    }
    if (fl > 0) {
      pen.use(ctx, cam, S);
      if (t >= 17.8) setMainPlane(t); else plane.set([0, 0, 0], [1, 0, 0], [0, 1, 0]);
      const c = irisCenter(cam, t);
      const R = fl * 2500;
      iris = { c, R };
      ctx.save();
      if (fl < 1) { ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2); ctx.clip(); }
      background(ctx, DY);
      drawWorld(ctx, cam, t, DY, true, S);
      ctx.restore();
      ctx.setTransform(S, 0, 0, S, 0, 0);
      if (fl < 1) {
        /* 絞りの輪(目盛りつき) */
        ctx.globalAlpha = 1 - smooth(0.75, 1, fl); ctx.strokeStyle = rgba(NI.amber, 1); ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(c.x, c.y, R, 0, Math.PI * 2); ctx.stroke();
        ctx.lineWidth = 1.5; ctx.beginPath();
        for (let i = 0; i < 72; i++) {
          const an = (i / 72) * Math.PI * 2 + fl * 0.9;
          const r0 = R + 8, r1 = R + (i % 6 === 0 ? 22 : 14);
          ctx.moveTo(c.x + Math.cos(an) * r0, c.y + Math.sin(an) * r0); ctx.lineTo(c.x + Math.cos(an) * r1, c.y + Math.sin(an) * r1);
        }
        ctx.stroke(); ctx.globalAlpha = 1;
      }
      post.vignette(ctx, canvas, DY.ink, 0.06 * fl);
      ctx.setTransform(S, 0, 0, S, 0, 0);
    }
    if (fl < 1) drawSweep(ctx, t);
    if (t >= 20.5) drawEnd(ctx, t, DY);
    /* 注記は輪の内側では昼の色、外側では夜の色(どのコマでも読める) */
    if (iris && fl < 1) {
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.arc(iris.c.x, iris.c.y, iris.R, 0, Math.PI * 2, true); ctx.clip('evenodd');
      drawHUD(ctx, t, NI); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.arc(iris.c.x, iris.c.y, iris.R, 0, Math.PI * 2); ctx.clip();
      drawHUD(ctx, t, DY); ctx.restore();
      ctx.setTransform(S, 0, 0, S, 0, 0);
    } else drawHUD(ctx, t, fl >= 1 ? DY : NI);
    if (!o.noGrain && !skip.has('grain')) post.grain(ctx, canvas, Math.round(t * FPS), fl < 1 ? 0.05 : 0.035);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  const NONE = new Set();

  /* ぼけの段を先に作っておく(再生中に初めて使う段を作ると、そのコマが詰まる) */
  function warm() {
    if (!PAL) init();
    for (const L of [...letters, ...endLetters]) for (const lt of L.list) for (let i = 1; i < E.BL.length; i++) lt.spr.level(i);
    for (const f of frags) for (let i = 1; i < E.BL.length; i++) f.spr.level(i);
  }

  /* 文字の先読み: 和文はこの集合のグリフだけを読み込む */
  function glyphs() {
    const jp = new Set();
    const add = s => { for (const ch of s) jp.add(ch); };
    D.LANES.forEach(l => add(l.jp));
    add(TXT.note); TXT.opts.forEach(add);
    add('昼休み待ち時間分平均稼働職員負荷医師理学療法士受付会計本日の流れ予約来週決めたこと再診枠時台に広げる次に入れられる枠リハ室患者単価架空値人件名電話紹介状変更新患待合午後空きX線整形外科・リハビリテーション科()予定を含む診察室来院月火水木金土日単位時間帯別どう動かすかを選ぶ様子見週このまま寄せる14:20まで');
    fragSpecs().forEach(s => { if (s.l) add(String(s.l)); if (s.v != null) add(String(s.v)); });
    return [...jp].join('');
  }
  const FONTS_TO_LOAD = () => [
    [FONT.en(600, 40), TXT.s1a + TXT.s1b + TXT.endA + TXT.endB + TXT.title + 'SAMPLE CLINICTODAYVISITSWAITNEXTSLOTPERVISITOCCUPANCYSTAFFLOADWAITTIMEPEAKGAPOPTIONSNOW’'],
    [FONT.en(700, 40), 'SAMPLE CLINIC'],
    [FONT.mono(300, 40), '0123456789¥,:%'],
    [FONT.mono(400, 40), '0123456789¥,:%'],
    [FONT.mono(500, 40), '0123456789:'],
    [FONT.jp(500, 20), glyphs()],
    [FONT.jp(700, 20), glyphs()],
  ];

  /* 書き出しの粒子(動きのぼけの平均のあとに一度だけ掛ける) */
  const grain = (ctx, canvas, t) => post.grain(ctx, canvas, Math.round(t * FPS), flip(t) < 1 ? 0.05 : 0.035);

  /* 動きのぼけに要るサブフレームの数。シャッターの間に画面上で動く距離(px)から決める */
  function samplesFor(t) {
    if (!PAL) init();
    const h = 0.25 / FPS, ta = Math.max(0, t - h), tb = Math.min(DUR, t + h);
    const ca = E.camera(rig(ta)), cb = E.camera(rig(tb));
    let d = 0;
    const A = { ok: false }, B = { ok: false };
    const cmp = (pa, pb) => {
      if (E.project(ca, pa[0], pa[1], pa[2], A) && E.project(cb, pb[0], pb[1], pb[2], B)) {
        if (A.x > -100 && A.x < W + 100 && A.y > -100 && A.y < H + 100) d = Math.max(d, Math.hypot(B.x - A.x, B.y - A.y));
      }
    };
    /* 平面の上の点(図・板・床) */
    const grid = [];
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) grid.push([i * 560, j * 300]);
    const wpa = [0, 0, 0], wpb = [0, 0, 0];
    for (const [a, b] of grid) {
      if (ta >= 17.8) setMainPlane(ta); else plane.set([0, 0, 0], [1, 0, 0], [0, 1, 0]);
      plane.world(a, b, wpa);
      if (tb >= 17.8) setMainPlane(tb); else plane.set([0, 0, 0], [1, 0, 0], [0, 1, 0]);
      plane.world(a, b, wpb);
      cmp(wpa.slice(), wpb.slice());
    }
    /* 冒頭の一文と断片 */
    if (t < 7.4) {
      for (const p of [[-400, -112, -900], [400, -112, -900], [0, 36, -470]]) cmp(p, p);
      const pa = [0, 0, 0], pb = [0, 0, 0];
      for (const f of frags) { fragPos(f, ta, pa); fragPos(f, tb, pb); cmp(pa.slice(), pb.slice()); }
    }
    /* 虹彩の輪 */
    d = Math.max(d, (flip(tb) - flip(ta)) * 2500);
    return clamp(Math.ceil(d / 1.6), 1, 24);
  }

  F.film = { DUR, FPS, CH, W, H, render, init, warm, FONTS_TO_LOAD, readBeat, TXT, grain, samplesFor };
})(window);
