/* クリニックタウン3D — 共有アイソメトリック描画エンジン
 * 院内ビューとタウンビューの両方から使う。座標系はタイル単位。
 */

'use strict';

class Iso {
  constructor(canvas, gridW, gridH, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.W = gridW;
    this.H = gridH;
    this.maxTileW = (opts && opts.maxTileW) || 64;
    this.topPad = (opts && opts.topPad) || 0.9;
    this.time = 0; // アニメーション用(ms)
    this.tw = 48; this.th = 24; this.ox = 0; this.oy = 0; this.dpr = 1;
  }

  resize() {
    const cw = this.canvas.parentElement.clientWidth;
    this.tw = Math.min(this.maxTileW, (cw - 24) * 2 / (this.W + this.H));
    this.th = this.tw / 2;
    const gh = (this.W + this.H) * this.th / 2 + this.tw * 1.7;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.style.height = `${gh}px`;
    this.canvas.width = cw * this.dpr;
    this.canvas.height = gh * this.dpr;
    this.ox = cw / 2 + (this.H - this.W) * this.tw / 4;
    this.oy = this.tw * this.topPad;
  }

  p(x, y, z) {
    return {
      x: this.ox + (x - y) * this.tw / 2,
      y: this.oy + (x + y) * this.th / 2 - (z || 0) * this.th * 1.15
    };
  }

  // 画面座標(CSSピクセル)→タイル座標
  unproject(px, py) {
    const dx = px - this.ox, dy = py - this.oy;
    const x = dy / this.th + dx / this.tw;
    const y = dy / this.th - dx / this.tw;
    return { x: Math.floor(x), y: Math.floor(y) };
  }

  begin() {
    const ctx = this.ctx;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width / this.dpr, this.canvas.height / this.dpr);
  }

  diamond(x, y, z, fill, stroke) {
    const ctx = this.ctx;
    const c = this.p(x + 0.5, y + 0.5, z || 0);
    ctx.beginPath();
    ctx.moveTo(c.x, c.y - this.th / 2);
    ctx.lineTo(c.x + this.tw / 2, c.y);
    ctx.lineTo(c.x, c.y + this.th / 2);
    ctx.lineTo(c.x - this.tw / 2, c.y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  }

  static shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
    const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
    const b = Math.min(255, Math.round((n & 255) * f));
    return `rgb(${r},${g},${b})`;
  }

  // 直方体。z0 から高さ h
  box(x, y, w, d, h, color, z0) {
    const ctx = this.ctx;
    const zb = z0 || 0;
    const zt = zb + h;
    const pT = [this.p(x, y, zt), this.p(x + w, y, zt), this.p(x + w, y + d, zt), this.p(x, y + d, zt)];
    const pR = [this.p(x + w, y, zb), this.p(x + w, y + d, zb)];
    const pL = [this.p(x, y + d, zb), this.p(x + w, y + d, zb)];
    ctx.fillStyle = Iso.shade(color, 0.78);
    ctx.beginPath();
    ctx.moveTo(pT[1].x, pT[1].y); ctx.lineTo(pT[2].x, pT[2].y);
    ctx.lineTo(pR[1].x, pR[1].y); ctx.lineTo(pR[0].x, pR[0].y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = Iso.shade(color, 0.62);
    ctx.beginPath();
    ctx.moveTo(pT[3].x, pT[3].y); ctx.lineTo(pT[2].x, pT[2].y);
    ctx.lineTo(pL[1].x, pL[1].y); ctx.lineTo(pL[0].x, pL[0].y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(pT[0].x, pT[0].y); ctx.lineTo(pT[1].x, pT[1].y);
    ctx.lineTo(pT[2].x, pT[2].y); ctx.lineTo(pT[3].x, pT[3].y);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(34,51,61,0.12)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // 屋根つき建物(タウン用)
  building(x, y, w, d, h, wallColor, roofColor) {
    this.box(x, y, w, d, h, wallColor);
    const ctx = this.ctx;
    const m = 0.12;
    const pT = [
      this.p(x - m, y - m, h), this.p(x + w + m, y - m, h),
      this.p(x + w + m, y + d + m, h), this.p(x - m, y + d + m, h)
    ];
    const peak = this.p(x + w / 2, y + d / 2, h + Math.min(w, d) * 0.5);
    // 屋根(寄棟風: 2面だけ描く)
    ctx.fillStyle = roofColor;
    ctx.beginPath();
    ctx.moveTo(pT[1].x, pT[1].y); ctx.lineTo(pT[2].x, pT[2].y); ctx.lineTo(peak.x, peak.y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = Iso.shade(roofColor, 0.8);
    ctx.beginPath();
    ctx.moveTo(pT[2].x, pT[2].y); ctx.lineTo(pT[3].x, pT[3].y); ctx.lineTo(peak.x, peak.y);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = Iso.shade(roofColor, 1.12);
    ctx.beginPath();
    ctx.moveTo(pT[0].x, pT[0].y); ctx.lineTo(pT[1].x, pT[1].y); ctx.lineTo(peak.x, peak.y);
    ctx.closePath(); ctx.fill();
  }

  figure(x, y, color, opts) {
    const o = opts || {};
    const ctx = this.ctx;
    const bob = o.walking ? Math.sin(this.time * 0.012 + x * 7 + y * 3) * this.th * 0.08 : 0;
    const c = this.p(x + 0.5, y + 0.5, 0);
    const s = (this.tw / 64) * (o.scale || 1);
    ctx.fillStyle = 'rgba(34,51,61,0.16)';
    ctx.beginPath();
    ctx.ellipse(c.x, c.y, 9 * s, 4.5 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    const by = c.y - bob;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(c.x - 6 * s, by);
    ctx.quadraticCurveTo(c.x - 7 * s, by - 20 * s, c.x, by - 22 * s);
    ctx.quadraticCurveTo(c.x + 7 * s, by - 20 * s, c.x + 6 * s, by);
    ctx.closePath();
    ctx.fill();
    if (o.coat) { ctx.strokeStyle = 'rgba(62,124,166,0.5)'; ctx.lineWidth = 1.2; ctx.stroke(); }
    ctx.fillStyle = '#F2C9A0';
    ctx.beginPath();
    ctx.arc(c.x, by - 28 * s, 6 * s, 0, Math.PI * 2);
    ctx.fill();
    if (o.dot) {
      ctx.fillStyle = o.dot;
      ctx.beginPath();
      ctx.arc(c.x, by - 40 * s, 3.2 * s, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  label(cx, cy, text, opts) {
    const o = opts || {};
    const ctx = this.ctx;
    const c = this.p(cx, cy, o.z || 0);
    const fs = Math.max(9.5, this.tw * (o.size || 0.19));
    ctx.font = `700 ${fs}px 'Noto Sans JP', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const w = ctx.measureText(text).width + 14;
    const hh = fs + 9;
    ctx.fillStyle = o.bg || 'rgba(255,255,255,0.88)';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(c.x - w / 2, c.y - hh / 2, w, hh, hh / 2);
    else ctx.rect(c.x - w / 2, c.y - hh / 2, w, hh);
    ctx.fill();
    if (o.ring) { ctx.strokeStyle = o.ring; ctx.lineWidth = 1.5; ctx.stroke(); }
    ctx.fillStyle = o.color || '#2C5F82';
    ctx.fillText(text, c.x, c.y + 1);
  }

  // 上に浮かぶテキスト(収益ポップ等)。progress: 0→1
  floatText(x, y, text, color, progress) {
    const ctx = this.ctx;
    const c = this.p(x + 0.5, y + 0.5, 0.6 + progress * 1.6);
    ctx.globalAlpha = 1 - progress * progress;
    ctx.font = `800 ${Math.max(11, this.tw * 0.22)}px 'Inter', sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.strokeText(text, c.x, c.y);
    ctx.fillStyle = color;
    ctx.fillText(text, c.x, c.y);
    ctx.globalAlpha = 1;
  }
}

/* 汎用A*(4方向)。blocked: Set("x,y") */
function astarGrid(W, H, blocked, from, to) {
  const sx = Math.round(from.x), sy = Math.round(from.y);
  const tx = Math.round(to.x), ty = Math.round(to.y);
  if (sx === tx && sy === ty) return [{ x: tx, y: ty }];
  const key = (x, y) => x + y * W;
  const open = [{ x: sx, y: sy, f: 0 }];
  const came = new Map();
  const gScore = new Map([[key(sx, sy), 0]]);
  const closed = new Set();
  let guard = 0;
  while (open.length && guard++ < 4000) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (open[i].f < open[bi].f) bi = i;
    const cur = open.splice(bi, 1)[0];
    const ck = key(cur.x, cur.y);
    if (cur.x === tx && cur.y === ty) {
      const path = [{ x: tx, y: ty }];
      let k = ck;
      while (came.has(k)) { k = came.get(k); path.unshift({ x: k % W, y: Math.floor(k / W) }); }
      path.shift();
      return path;
    }
    closed.add(ck);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cur.x + dx, ny = cur.y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const nk = key(nx, ny);
      if (closed.has(nk)) continue;
      if (blocked.has(`${nx},${ny}`) && !(nx === tx && ny === ty)) continue;
      const g = gScore.get(ck) + 1;
      if (g < (gScore.get(nk) ?? Infinity)) {
        gScore.set(nk, g);
        came.set(nk, ck);
        const f = g + Math.abs(nx - tx) + Math.abs(ny - ty);
        const ex = open.find((o) => o.x === nx && o.y === ny);
        if (ex) ex.f = f; else open.push({ x: nx, y: ny, f });
      }
    }
  }
  return [{ x: tx, y: ty }];
}

/* 中央寄り乱数 */
function triRand(lo, hi) { return lo + (Math.random() + Math.random()) / 2 * (hi - lo); }
