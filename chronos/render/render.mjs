// Render the film to an MP4 (H.264) through ffmpeg.
//   node render/render.mjs --out chronos.mp4 [--fps 30] [--w 1920 --h 1080] [--samples 3] [--shutter 0.5] [--start 0 --end 30] [--crf 16] [--frames dir]
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { openFilm, renderFrame, parseArgs } from './common.mjs';

const a = parseArgs(process.argv.slice(2), { out: 'chronos.mp4', fps: 30, w: 1920, h: 1080, samples: 3, shutter: 0.5, start: 0, end: 30, crf: 16, preset: 'slow', port: 8792, frames: '' });
const nFrames = Math.round((a.end - a.start) * a.fps);
console.log(`CHRONOS render: ${a.w}x${a.h} @${a.fps}fps, ${nFrames} frames, ${a.samples} temporal samples, shutter ${a.shutter} -> ${a.out}`);
if (a.frames) fs.mkdirSync(a.frames, { recursive: true });

const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(a.fps), '-i', 'pipe:0', '-c:v', 'libx264', '-preset', a.preset, '-crf', String(a.crf), '-pix_fmt', 'yuv420p', '-profile:v', 'high', '-level', '4.2', '-movflags', '+faststart', '-r', String(a.fps), a.out], { stdio: ['pipe', 'inherit', 'inherit'] });
ff.on('error', (e) => { console.error('ffmpeg failed to start', e); process.exit(1); });
const write = (buf) => new Promise((res, rej) => { if (!ff.stdin.write(buf)) ff.stdin.once('drain', res); else res(); ff.stdin.once('error', rej); });

const { page, close } = await openFilm({ width: a.w, height: a.h, port: a.port });
const t0 = Date.now();
for (let i = 0; i < nFrames; i++) {
  const t = a.start + i / a.fps;
  const png = await renderFrame(page, t, { samples: a.samples, shutter: a.shutter, fps: a.fps });
  await write(png);
  if (a.frames) fs.writeFileSync(path.join(a.frames, `f${String(i).padStart(5, '0')}.png`), png);
  if (i % 10 === 0 || i === nFrames - 1) {
    const el = (Date.now() - t0) / 1000, per = el / (i + 1), eta = per * (nFrames - i - 1);
    console.log(`frame ${i + 1}/${nFrames} t=${t.toFixed(2)}s  ${per.toFixed(2)}s/frame  elapsed ${(el / 60).toFixed(1)}m  eta ${(eta / 60).toFixed(1)}m`);
  }
}
ff.stdin.end();
await new Promise((res) => ff.on('close', res));
await close();
console.log(`done: ${a.out} (${(fs.statSync(a.out).size / 1e6).toFixed(1)} MB) in ${((Date.now() - t0) / 60000).toFixed(1)} min`);
