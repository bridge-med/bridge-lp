// Build-time asset generator for BRIDGE Worklog — "Warm Companion" brand.
// Run: node scripts/gen-icons.mjs   (requires @resvg/resvg-js, dev-only)
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';

// Palette (matches lib/theme.ts)
const AMBER_TOP = '#EF9A5C';
const AMBER_BOT = '#E27D34';
const CREAM = '#FBF3E8';

// The companion drawn in a 100x115 box (mirrors components/BuddySprite, stage 4).
function buddy({ mono = false } = {}) {
  const cx = 50, cy = 74, bodyR = 20.4, bodyCy = cy - 16;
  const C = mono
    ? { body: '#000', leafA: '#000', leafB: '#000', tip: '#000', pot: '#000', rim: '#000', eye: '#000', cheek: 'none', mouth: '#000' }
    : { body: '#6FA86A', leafA: '#7DB877', leafB: '#8AC183', tip: '#9BCB92', pot: '#E8654E', rim: '#EF7A5E', eye: '#2C3A28', cheek: 'rgba(44,58,40,0)', mouth: '#2C3A28' };
  const p = [];
  if (!mono) p.push(`<ellipse cx="${cx}" cy="${cy + 36}" rx="26" ry="6" fill="rgba(59,48,38,0.08)"/>`);
  // leaves
  p.push(`<path d="M ${cx} ${bodyCy - 8} Q ${cx - 26} ${bodyCy - 24} ${cx - 30} ${bodyCy - 2} Q ${cx - 12} ${bodyCy} ${cx} ${bodyCy - 8} Z" fill="${C.leafA}"/>`);
  p.push(`<path d="M ${cx} ${bodyCy - 10} Q ${cx + 24} ${bodyCy - 26} ${cx + 30} ${bodyCy - 4} Q ${cx + 12} ${bodyCy - 2} ${cx} ${bodyCy - 10} Z" fill="${C.leafB}"/>`);
  p.push(`<path d="M ${cx - 6} ${bodyCy - 12} Q ${cx - 30} ${bodyCy - 40} ${cx - 16} ${bodyCy - 46} Q ${cx - 6} ${bodyCy - 30} ${cx - 6} ${bodyCy - 12} Z" fill="${C.leafB}"/>`);
  p.push(`<path d="M ${cx} ${bodyCy - 12} q -4 -16 6 -22 q 4 10 -6 22 Z" fill="${C.tip}"/>`);
  // body + face
  p.push(`<circle cx="${cx}" cy="${bodyCy}" r="${bodyR}" fill="${C.body}"/>`);
  if (!mono) {
    p.push(`<circle cx="${cx - bodyR * 0.62}" cy="${bodyCy + 3}" r="3.2" fill="rgba(232,101,78,0.35)"/>`);
    p.push(`<circle cx="${cx + bodyR * 0.62}" cy="${bodyCy + 3}" r="3.2" fill="rgba(232,101,78,0.35)"/>`);
  }
  p.push(`<circle cx="${cx - 6.5}" cy="${bodyCy}" r="2.6" fill="${C.eye}"/>`);
  p.push(`<circle cx="${cx + 6.5}" cy="${bodyCy}" r="2.6" fill="${C.eye}"/>`);
  p.push(`<path d="M ${cx - 5} ${bodyCy + 7} Q ${cx} ${bodyCy + 12} ${cx + 5} ${bodyCy + 7}" stroke="${C.mouth}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`);
  // pot
  p.push(`<path d="M ${cx - 22} ${cy + 4} L ${cx + 22} ${cy + 4} L ${cx + 17} ${cy + 30} Q ${cx + 15} ${cy + 35} ${cx + 10} ${cy + 35} L ${cx - 10} ${cy + 35} Q ${cx - 15} ${cy + 35} ${cx - 17} ${cy + 30} Z" fill="${C.pot}"/>`);
  p.push(`<rect x="${cx - 25}" y="${cy - 2}" width="50" height="9" rx="4.5" fill="${C.rim}"/>`);
  return p.join('');
}

// Place the 100x115 buddy centered in a 1024 canvas at a given target width.
function placed(targetW, opts) {
  const s = targetW / 100;
  const h = 115 * s;
  const tx = (1024 - targetW) / 2;
  const ty = (1024 - h) / 2;
  return `<g transform="translate(${tx} ${ty}) scale(${s})">${buddy(opts)}</g>`;
}

const amberField = `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="${AMBER_TOP}"/><stop offset="1" stop-color="${AMBER_BOT}"/></linearGradient></defs>
  <rect width="1024" height="1024" fill="url(#g)"/>`;

// Full app icon: amber field + cream disc + buddy (OS rounds the corners).
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
${amberField}
<circle cx="512" cy="512" r="372" fill="${CREAM}"/>
${placed(560, {})}</svg>`;

// Splash + adaptive foreground: buddy on transparent.
const splashSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${placed(520, {})}</svg>`;
const adaptiveFg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${placed(520, {})}</svg>`;
const monoFg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${placed(520, { mono: true })}</svg>`;

// Android adaptive background: amber field.
const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${amberField}</svg>`;

function png(svg, width) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
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
