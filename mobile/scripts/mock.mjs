// Design-exploration renderer: SVG -> PNG using the app's JP fonts (resvg).
// Lets me iterate on visuals before writing RN code. Dev-only.
import { Resvg } from '@resvg/resvg-js';
import { writeFileSync } from 'node:fs';

const F = (fam, w, file) => `node_modules/@expo-google-fonts/${fam}/${w}/${file}.ttf`;
const fontFiles = [
  F('shippori-mincho', '400Regular', 'ShipporiMincho_400Regular'),
  F('shippori-mincho', '600SemiBold', 'ShipporiMincho_600SemiBold'),
  F('shippori-mincho', '800ExtraBold', 'ShipporiMincho_800ExtraBold'),
  F('zen-kaku-gothic-new', '400Regular', 'ZenKakuGothicNew_400Regular'),
  F('zen-kaku-gothic-new', '500Medium', 'ZenKakuGothicNew_500Medium'),
  F('zen-kaku-gothic-new', '700Bold', 'ZenKakuGothicNew_700Bold'),
  F('zen-maru-gothic', '400Regular', 'ZenMaruGothic_400Regular'),
  F('zen-maru-gothic', '700Bold', 'ZenMaruGothic_700Bold'),
];

export function render(svg, out, width = 390) {
  const r = new Resvg(svg, {
    fitTo: { mode: 'width', value: width * 2 },
    font: { fontFiles, loadSystemFonts: true, defaultFontFamily: 'Zen Kaku Gothic New' },
  });
  writeFileSync(out, r.render().asPng());
  console.log('wrote', out);
}

export const W = 390;
export const H = 844;
export function screen(inner, bg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <rect width="${W}" height="${H}" fill="${bg}"/>${inner}</svg>`;
}
