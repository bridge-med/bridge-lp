// Render still frames for review.
//   node render/stills.mjs --times 0.5,2,4 --w 960 --h 540 --out /tmp/stills [--samples 1] [--sheet sheet.png --cols 4]
//   node render/stills.mjs --every 1 --from 0 --to 30 ...
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { openFilm, renderFrame, parseArgs } from './common.mjs';

const a = parseArgs(process.argv.slice(2), { w: 960, h: 540, out: 'stills', samples: 1, shutter: 0.5, cols: 4, port: 8791 });
let times = [];
if (a.times !== undefined) times = String(a.times).split(',').map(Number);
else { const every = a.every ?? 1, from = a.from ?? 0, to = a.to ?? 30; for (let t = from; t <= to + 1e-9; t += every) times.push(+t.toFixed(3)); }
fs.mkdirSync(a.out, { recursive: true });
const { page, close } = await openFilm({ width: a.w, height: a.h, port: a.port });
const t0 = Date.now(); const files = [];
for (let i = 0; i < times.length; i++) {
  const t = times[i]; const s = Date.now();
  const png = await renderFrame(page, t, { samples: a.samples, shutter: a.shutter });
  const f = path.join(a.out, `t${t.toFixed(2).padStart(6, '0')}.png`); fs.writeFileSync(f, png); files.push(f);
  console.log(`t=${t.toFixed(2)} ${((Date.now() - s) / 1000).toFixed(2)}s`);
}
await close();
console.log(`done ${times.length} stills in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
if (a.sheet) {
  const cols = a.cols, rows = Math.ceil(files.length / cols);
  const list = path.join(a.out, 'list.txt'); fs.writeFileSync(list, files.map((f) => `file '${path.resolve(f)}'`).join('\n'));
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list, '-filter_complex', `scale=${a.w}:${a.h},tile=${cols}x${rows}:padding=4:color=#202020`, '-frames:v', '1', a.sheet], { encoding: 'utf8' });
  if (r.status !== 0) console.error(r.stderr); else console.log('sheet:', a.sheet);
}
