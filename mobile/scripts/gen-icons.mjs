// Build-time asset generator for BRIDGE Worklog icons & splash.
// Run: node scripts/gen-icons.mjs   (requires @resvg/resvg-js, dev-only)
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';

const BLUE_TOP = '#2b78b3';
const BLUE_BOTTOM = '#1f5e8c';

// Four ascending rounded bars — reads as "records building into growth".
function bars(fill, opacityStep = false) {
  const xs = [231, 389, 547, 705];
  const w = 88;
  const heights = [180, 268, 356, 440];
  const baseline = 712;
  const r = 40;
  return xs
    .map((x, i) => {
      const h = heights[i];
      const y = baseline - h;
      const op = opacityStep ? (0.82 + i * 0.06).toFixed(2) : '1';
      return `<rect x="${x}" y="${y}" width="${w}" height="${h + r}" rx="${r}" fill="${fill}" fill-opacity="${op}"/>`;
    })
    .join('');
}

const gradientDef = `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
  <stop offset="0" stop-color="${BLUE_TOP}"/><stop offset="1" stop-color="${BLUE_BOTTOM}"/></linearGradient></defs>`;

// Full app icon: gradient field + white bars (OS rounds the corners).
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
${gradientDef}<rect width="1024" height="1024" fill="url(#g)"/>${bars('#ffffff', true)}</svg>`;

// Mark only, scaled to a safe zone, on transparent — for adaptive fg / splash / mono.
function markOnly(fill, scale) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<g transform="translate(512 512) scale(${scale}) translate(-512 -500)">${bars(fill, false)}</g></svg>`;
}

const bgSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
${gradientDef}<rect width="1024" height="1024" fill="url(#g)"/></svg>`;

function png(svg, width) {
  return new Resvg(svg, { fitTo: { mode: 'width', value: width } }).render().asPng();
}

const out = {
  'assets/icon.png': png(iconSvg, 1024),
  'assets/favicon.png': png(iconSvg, 96),
  'assets/splash-icon.png': png(markOnly('#ffffff', 0.5), 1024),
  'assets/android-icon-background.png': png(bgSvg, 1024),
  'assets/android-icon-foreground.png': png(markOnly('#ffffff', 0.62), 1024),
  'assets/android-icon-monochrome.png': png(markOnly('#000000', 0.62), 1024),
};

for (const [path, buf] of Object.entries(out)) {
  writeFileSync(path, buf);
  console.log('wrote', path, buf.length, 'bytes');
}
