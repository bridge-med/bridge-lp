import { serve, launch, FILM, WORK } from './lib.mjs';
import { renderShot } from './engine.mjs';
import * as SH from './shots2.mjs';
const argv = {}; for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { argv[a.slice(2)] = process.argv[i + 1]; i++; } }
const W = +(argv.w || 960), H = Math.round(W * 9 / 16);
const only = argv.only ? argv.only.split(',').map(Number) : null;
const list = (argv.shots || 's1').split(',');
const { server, base } = await serve(undefined, { '/__p3/': FILM + '/' });
const browsers = {};
for (const id of list) {
  const shot = SH[id.toUpperCase()];
  const t0 = Date.now();
  const k = shot.gl ? 'gl' : 'plain';
  const browser = browsers[k] || (browsers[k] = await launch(!!shot.gl));
  await renderShot(shot, { W, H, outDir: `${WORK}/frames/${argv.tag || W}/${id}`, only, base, browser });
  console.log(id, 'done', ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
for (const b of Object.values(browsers)) await b.close(); server.close();
