#!/usr/bin/env node
// Keep authoring paths unchanged; adapt a separate Pages artifact to its actual URL.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const oldBase = 'https://bridge-med.github.io/bridge-lp';
// Pages may report HTTP while the custom-domain certificate is being issued.
// Publish canonical HTTPS URLs in either case; host validation remains strict.
const base = (process.argv[2] || '').replace(/^http:\/\//, 'https://').replace(/\/$/, '');
const destination = process.argv[3];
if (![oldBase, 'https://bridge-med.jp', 'https://www.bridge-med.jp'].includes(base) || !destination) {
  throw new Error('Usage: node scripts/prepare-pages.mjs <approved Pages base URL> <new output directory outside repository>');
}
const output = resolve(destination);
const rel = relative(repo, output);
if (!rel || (!rel.startsWith('..' + sep) && rel !== '..') || existsSync(output)) {
  throw new Error('Output must be a new directory outside the repository. Nothing was removed.');
}
const paths = execFileSync('git', ['ls-files', '-z'], { cwd: repo, encoding: 'utf8' }).split('\0').filter(Boolean);
const textExtensions = new Set(['.html', '.css', '.js', '.json', '.xml', '.txt', '.webmanifest']);
const historical = /^(?:docs|scripts|mobile|mobile-pomodoro|tools|\.claude|\.github)\/|^medical-kb\/data\/sources\/|\/(?:native|worker)\//;
let changed = 0;
for (const path of paths) {
  const target = resolve(output, path);
  mkdirSync(dirname(target), { recursive: true });
  if (base !== oldBase && textExtensions.has(extname(path)) && !historical.test(path)) {
    const source = readFileSync(resolve(repo, path), 'utf8');
    const updated = source
      .replace(/https:\/\/bridge-med\.github\.io\/bridge-lp(?=[/"'`\s<#?]|$)/g, base)
      .replace(/(["'`(=])\/bridge-lp(?=[/"'`?#])/g, '$1');
    writeFileSync(target, updated);
    if (updated !== source) changed++;
  } else {
    copyFileSync(resolve(repo, path), target);
  }
}
console.log(`Prepared ${paths.length} files for ${base}; adapted ${changed} text files. Source files unchanged.`);
