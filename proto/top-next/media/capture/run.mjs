// 撮影: node run.mjs --shots ca,cb,town --fmt tall|wide --w <出力の幅>
// コマは FILM_WORK(既定は film/choice/work)の frames/<tag>/<id>/ に出る。書き出しは build.sh
import { serve, launch, WORK } from '../../../../film/choice/lib.mjs';
import { renderShot, FRAMES } from '../../../../film/choice/engine.mjs';
import * as SH from './shots.mjs';
const argv = {}; for (let i = 2; i < process.argv.length; i++) { const a = process.argv[i]; if (a.startsWith('--')) { argv[a.slice(2)] = process.argv[i + 1]; i++; } }
const fmt = argv.fmt || 'wide';
const W = +(argv.w || FRAMES[fmt][0]);
const only = argv.only ? argv.only.split(',').map(Number) : null;
const { server, base } = await serve();
const browsers = {};
for (const id of (argv.shots || 'ca,cb,town').split(',')) {
  const shot = SH[id.toUpperCase()];
  const t0 = Date.now();
  const k = shot.gl ? 'gl' : 'plain';
  const browser = browsers[k] || (browsers[k] = await launch(!!shot.gl));
  await renderShot(shot, { W, outDir: `${WORK}/frames/top-${fmt}/${id}`, only, base, browser, theme: 'light', fmt });
  console.log(id, fmt, 'done', ((Date.now() - t0) / 1000).toFixed(1) + 's');
}
for (const b of Object.values(browsers)) await b.close(); server.close();
