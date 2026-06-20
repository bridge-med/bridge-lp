// Build-time asset generator for BRIDGE Focus — calm "focus ring" brand.
// Run: node scripts/gen-icons.mjs   (requires @resvg/resvg-js, dev-only)
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';

// Palette (matches lib/theme.ts)
const NAVY_TOP = '#243450';
const NAVY_BOT = '#141B28';
const BLUE = '#8FB2DC'; // dusty blue
const MINT = '#5FC2AE'; // mint focal point

// Polar helper (SVG: 0°=right, 90°=down, 270°=top).
function pt(cx, cy, r, deg) {
  const a = (deg * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

// An open arc (a focus/progress ring) with a gap centred at the top.
function arc(cx, cy, r, startDeg, endDeg, sweep = 1) {
  const [x0, y0] = pt(cx, cy, r, startDeg);
  const [x1, y1] = pt(cx, cy, r, endDeg);
  const delta = ((endDeg - startDeg) * sweep + 360) % 360;
  const large = delta > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${r} ${r} 0 ${large} ${sweep} ${x1} ${y1}`;
}

// The mark: an open ring + a solid focal dot, drawn around centre 512.
function mark({ ringR = 300, ringW = 44, dotR = 92, ring = BLUE, dot = MINT } = {}) {
  const C = 512;
  // gap of 60° centred at the top: draw 300° from 300° → 240° clockwise.
  const path = arc(C, C, ringR, 300, 240, 1);
  return `
    <path d="${path}" stroke="${ring}" stroke-width="${ringW}" stroke-linecap="round" fill="none"/>
    <circle cx="${C}" cy="${C}" r="${dotR}" fill="${dot}"/>`;
}

const navyField = `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="${NAVY_TOP}"/><stop offset="1" stop-color="${NAVY_BOT}"/></linearGradient></defs>
  <rect width="1024" height="1024" fill="url(#g)"/>`;

const svg = (inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${inner}</svg>`;

// Full app icon: navy field + focus mark (OS rounds the corners).
const iconSvg = svg(`${navyField}${mark()}`);
// Splash: mark on transparent (splash bg is set in app.config).
const splashSvg = svg(mark({ ringR: 300, ringW: 42, dotR: 88 }));
// Android adaptive foreground: keep inside the safe zone (~66%).
const adaptiveFg = svg(mark({ ringR: 232, ringW: 34, dotR: 70 }));
const monoFg = svg(mark({ ringR: 232, ringW: 34, dotR: 70, ring: '#000', dot: '#000' }));
const bgSvg = svg(navyField);

function png(s, width) {
  return new Resvg(s, { fitTo: { mode: 'width', value: width } }).render().asPng();
}

const out = {
  'assets/icon.png': png(iconSvg, 1024),
  'assets/favicon.png': png(iconSvg, 96),
  'assets/splash-icon.png': png(splashSvg, 1024),
  'assets/android-icon-background.png': png(bgSvg, 1024),
  'assets/android-icon-foreground.png': png(adaptiveFg, 1024),
  'assets/android-icon-monochrome.png': png(monoFg, 1024),
};

for (const [path, buf] of Object.entries(out)) {
  writeFileSync(path, buf);
  console.log('wrote', path, buf.length, 'bytes');
}
