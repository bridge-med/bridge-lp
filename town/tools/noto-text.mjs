// ヘッダー・メニュー・フッターの和文(Noto Sans JP)の text= を作る。node town/tools/noto-text.mjs → 出た字を encodeURIComponent して index.html の Noto Sans JP の <link> の text= に入れる
// 字は bridge.js の NAV・CTA・FOOTER・PRIVACY と、index.html の .hd .mdlg .foot に書いた字(scripts/check-site.mjs の6項 f と同じ集め方)
import { readFileSync } from 'node:fs'; import vm from 'node:vm';
import { fileURLToPath } from 'node:url'; const repo = fileURLToPath(new URL('../../', import.meta.url));
const html = readFileSync(repo + '/index.html', 'utf8');
const stub = () => ({ style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } }, setAttribute() {}, getAttribute() { return null; }, addEventListener() {}, appendChild() {}, querySelectorAll() { return []; }, querySelector() { return null; } });
const document = { documentElement: stub(), body: { dataset: { root: './', page: 'home' }, appendChild() {}, classList: { toggle() {} } }, head: { appendChild() {} }, currentScript: null, querySelector: () => null, querySelectorAll: () => [], getElementById: () => stub(), createElement: stub, addEventListener() {} };
const win = { document, addEventListener() {}, scrollY: 0, matchMedia: () => ({ matches: false, addEventListener() {} }), localStorage: { getItem: () => null, setItem() {} }, location: { pathname: '/index.html' }, navigator: {}, IntersectionObserver: class { observe() {} }, MutationObserver: class { observe() {} }, URL, JSON, Date };
win.window = win; vm.runInNewContext(readFileSync(repo + '/shared/bridge.js', 'utf8'), win);
const B = win.BRIDGE, strs = [];
for (const n of B.NAV.concat([B.CTA])) strs.push(n.en, n.label, n.d);
for (const c of B.FOOTER) { strs.push(c.h); for (const l of c.links) strs.push(l.en); }
strs.push(B.PRIVACY.en, ' ↗');
for (const re of [/<header class="hd"[\s\S]*?<\/header>/, /<dialog class="mdlg"[\s\S]*?<\/dialog>/, /<footer class="foot"[\s\S]*?<\/footer>/]) {
  const m = html.match(re); strs.push(m[0].replace(/<!--[\s\S]*?-->/g, '').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&'));
}
const set = [...new Set([...strs.join('')].filter(c => !/\s/.test(c)))].sort((a, b) => a.codePointAt(0) - b.codePointAt(0));
console.log(set.join('')); console.log(encodeURIComponent(set.join('')));
