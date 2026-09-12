/* UI: 線画アイコン(v94 便AN-1・社長決裁 2026-09-12「ゲームに憲法とは別のデザイン系を認める」)。
 * 絵文字はやめて、1系統の線画 SVG(24 viewBox・線幅1.75・currentColor)だけを使う。
 * 1) ICONS.svg(name) — 新しい描画はこれで直接書く
 * 2) ICONS.sweep(root) — 既に描画された文字列の中の絵文字を同じ SVG に置き換える(対応表にない絵文字は除去)。
 *    game.js の innerHTML は数百箇所あるため、源流の置換(index.html・nav・dashboard・SHOP/ITEMS)と並行して、
 *    描画後の DOM を MutationObserver で掃く。textContent の変更も拾う。 */
(function (root) {
  'use strict';
  const P = {
    coin: '<circle cx="12" cy="12" r="8.5"/><path d="M9 8.5l3 4 3-4M12 12.5V17M9.5 14h5M9.5 16h5"/>',
    book: '<path d="M4 5h6a2 2 0 0 1 2 2v13a2 2 0 0 0-2-2H4zM20 5h-6a2 2 0 0 0-2 2v13a2 2 0 0 1 2-2h6z"/>',
    clinic: '<path d="M4 20V9l8-5 8 5v11"/><path d="M12 11v6M9 14h6"/>',
    alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    clipboard: '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3h6v1M8 10h8M8 14h6"/>',
    build: '<path d="M3 20h18M5 20V9h6v11M11 13h8v7"/><path d="M8 12v.5M8 16v.5M15 16v.5"/>',
    grad: '<path d="M3 9l9-4 9 4-9 4z"/><path d="M7 11v4c0 1.5 2.2 3 5 3s5-1.5 5-3v-4M21 9v5"/>',
    handshake: '<path d="M3 11l3-4h4l2 2 2-2h4l3 4"/><path d="M12 9l-3 3a1.5 1.5 0 0 0 2 2l1-1 3 3M8 15l2 2M10 13l2 2"/>',
    building: '<rect x="4" y="3" width="16" height="18" rx="1.5"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3"/>',
    trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 3M16 6h3a3 3 0 0 1-3 3M12 13v4M9 20h6M10 17h4v3"/>',
    hall: '<path d="M4 20h16M5 20V10M9 20V10M15 20V10M19 20V10M3 10h18L12 4z"/>',
    skip: '<path d="M5 6l7 6-7 6zM13 6l7 6-7 6z"/>',
    money: '<rect x="3" y="6" width="18" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 9v.5M18 14.5v.5"/>',
    target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/><circle cx="12" cy="12" r="1"/>',
    chart: '<path d="M4 20h16"/><path d="M7 16v-5M12 16V6M17 16v-8"/>',
    receipt: '<path d="M6 3h12v18l-2-1.5-2 1.5-2-1.5-2 1.5-2-1.5L6 21z"/><path d="M9 8h6M9 12h6M9 16h4"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
    chat: '<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 4z"/>',
    person: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.7l5.9-.9z"/>',
    lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    city: '<path d="M3 21V9h6v12M9 21V4h7v17M16 21v-9h5v9"/><path d="M12 8h1M12 12h1M5 13h1M18 15h1"/>',
    walk: '<circle cx="13" cy="4.5" r="1.5"/><path d="M10 21l2-6 2.5 2 1 4M8 13l2.5-5 3 1 2.5 3M9.5 11.5L7 15"/>',
    branch: '<path d="M6 4v16M6 8c0 4 12 2 12 8v4"/><circle cx="18" cy="6" r="1.5"/>',
    magnet: '<path d="M6 4v8a6 6 0 0 0 12 0V4"/><path d="M6 4h4v8a2 2 0 0 0 4 0V4h4"/>',
    map: '<path d="M3 7l6-2 6 2 6-2v12l-6 2-6-2-6 2z"/><path d="M9 5v12M15 7v12"/>',
    stetho: '<path d="M6 4v6a5 5 0 0 0 10 0V4"/><path d="M11 15v2a4 4 0 0 0 8 0v-3"/><circle cx="19" cy="12" r="2"/>',
    bank: '<path d="M3 10h18L12 4zM5 10v8M9 10v8M15 10v8M19 10v8M3 21h18"/>',
    scroll: '<path d="M6 4h12v14a2 2 0 0 1-2 2H6zM6 20a2 2 0 0 1-2-2V6"/><path d="M9 9h6M9 13h6"/>',
    phone: '<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>',
    med: '<path d="M12 3l7 3v5.5c0 4.5-3 8-7 9.5-4-1.5-7-5-7-9.5V6z"/><path d="M9 12l2 2 4-4"/>',
    megaphone: '<path d="M4 10v4h3l8 4V6l-8 4z"/><path d="M18 9a4 4 0 0 1 0 6M7 14v4"/>',
    compass: '<circle cx="12" cy="12" r="8.5"/><path d="M15 9l-2 5-4 1 2-5z"/>',
    medal: '<circle cx="12" cy="14" r="5"/><path d="M9 4l3 5 3-5M8 4h3M13 4h3"/>',
    cafe: '<path d="M5 8h11v6a4 4 0 0 1-4 4H9a4 4 0 0 1-4-4z"/><path d="M16 10h2a2 2 0 0 1 0 4h-2M7 4v2M11 4v2"/>',
    kids: '<circle cx="12" cy="7" r="3"/><path d="M6 20a6 6 0 0 1 12 0"/><path d="M9 13l3 2 3-2"/>',
    bus: '<rect x="4" y="5" width="16" height="12" rx="2"/><path d="M4 11h16M8 17v2M16 17v2M8 14h.5M15.5 14h.5"/>',
    tv: '<rect x="3" y="5" width="18" height="12" rx="2"/><path d="M8 21h8M12 17v4"/>',
    gift: '<rect x="4" y="9" width="16" height="11" rx="1.5"/><path d="M4 13h16M12 9v11M12 9c-2-4-6-3-5 0M12 9c2-4 6-3 5 0"/>',
    run: '<circle cx="14" cy="4.5" r="1.5"/><path d="M6 21l4-6 3 2 1 4M9 13l3-5 4 2 3 3M12 8l-3 1-3 3"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/>',
    bone: '<path d="M7 7a2 2 0 1 1 3 2l4 4a2 2 0 1 1 3 2 2 2 0 1 1-2 3l-4-4a2 2 0 1 1-2-3 2 2 0 1 1-2-4z"/>',
    repeat: '<path d="M4 10a6 6 0 0 1 10-4l2 2M20 14a6 6 0 0 1-10 4l-2-2"/><path d="M16 4v4h-4M8 20v-4h4"/>',
    pause: '<path d="M9 6v12M15 6v12"/>',
    help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17v.5"/>',
    belloff: '<path d="M6 16h12l-1.5-2V10a4.5 4.5 0 0 0-6-4.2M8.5 8.5A4.4 4.4 0 0 0 7.5 10v4L6 16M10 19a2 2 0 0 0 4 0M4 4l16 16"/>',
    bell: '<path d="M6 16h12l-1.5-2V10a4.5 4.5 0 0 0-9 0v4z"/><path d="M10 19a2 2 0 0 0 4 0"/>',
    staff: '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M15 19c0-2.4 1.6-4.2 4-4.5"/>',
    trend: '<path d="M4 17l5-5 4 3 7-7"/><path d="M15 8h5v5"/>',
    car: '<path d="M5 15l1.5-5h11L19 15"/><rect x="3" y="15" width="18" height="4" rx="1.5"/><path d="M6 19v1.5M18 19v1.5M7 17h.5M16.5 17h.5"/>',
    note: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h6M9 16h6"/>',
    bolt: '<path d="M13 3L5 14h6l-1 7 9-12h-6z"/>',
    eye: '<path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6z"/><circle cx="12" cy="12" r="2.5"/>',
    home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-6h4v6"/>',
    syringe: '<path d="M4 20l4-4M6 18l8-8 4 4-8 8zM14 10l3-3M16 5l3 3M12 12l2 2"/>',
    pin: '<path d="M12 21s-6-5.5-6-11a6 6 0 0 1 12 0c0 5.5-6 11-6 11z"/><circle cx="12" cy="10" r="2"/>',
    toolbox: '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M9 8V6a3 3 0 0 1 6 0v2M3 13h18M10 13v2M14 13v2"/>',
    doctor: '<circle cx="12" cy="7" r="3.5"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/><path d="M12 14v4M10 16h4"/>',
    sound: '<path d="M4 10v4h3l5 4V6l-5 4z"/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11"/>',
    reset: '<path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3"/><path d="M18 3v4h-4M6 21v-4h4"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
    cloud: '<path d="M7 18a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 9a4.5 4.5 0 0 1 0 9z"/>',
    rain: '<path d="M7 15a4 4 0 0 1-.5-8A5.5 5.5 0 0 1 17 6a4.5 4.5 0 0 1 0 9z"/><path d="M8 18l-1 3M12 18l-1 3M16 18l-1 3"/>',
    scissors: '<circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><path d="M8 7.5L20 18M8 16.5L20 6"/>',
    pill: '<rect x="3" y="9" width="18" height="7" rx="3.5" transform="rotate(-45 12 12.5)"/><path d="M8.5 8.5l7 7"/>',
    clover: '<path d="M12 12c-3-1-5-3-3.5-5S12 8 12 12zm0 0c3-1 5-3 3.5-5S12 8 12 12zm0 0c-3 1-5 3-3.5 5S12 16 12 12zm0 0c3 1 5 3 3.5 5S12 16 12 12z"/><path d="M12 12v8"/>',
    radar: '<circle cx="12" cy="12" r="2"/><path d="M8 8a5.7 5.7 0 0 0 0 8M16 8a5.7 5.7 0 0 1 0 8M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3 2"/>',
    crown: '<path d="M4 18h16l1-10-5 4-4-6-4 6-5-4z"/>',
    bandage: '<rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)"/><path d="M10 11v.5M13 13v.5M11 13v.5M13 11v.5"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
    flag: '<path d="M6 21V4h11l-2 4 2 4H6"/>',
    key: '<circle cx="8" cy="12" r="3.5"/><path d="M11.5 12H21M18 12v3M15 12v2"/>',
    rocket: '<path d="M12 3c3 2 4 6 4 9l-4 5-4-5c0-3 1-7 4-9z"/><circle cx="12" cy="10" r="1.5"/><path d="M8 14l-3 3 4 0M16 14l3 3-4 0"/>',
    truck: '<rect x="3" y="7" width="11" height="9"/><path d="M14 10h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.5"/><circle cx="17" cy="18" r="1.5"/>',
    circle: '<circle cx="12" cy="12" r="7"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    chev: '<path d="M9 6l6 6-6 6"/>',
    minus: '<path d="M6 12h12"/>',
    plus: '<path d="M12 6v12M6 12h12"/>',
  };
  // 絵文字→アイコン(対応表にない絵文字は除去)
  const MAP = {
    '🪙': 'coin', '📖': 'book', '🏥': 'clinic', '⚠': 'alert', '⚠️': 'alert', '✅': 'check', '❌': 'x', '⭕': 'circle', '📋': 'clipboard', '🏗': 'build', '🎓': 'grad', '🤝': 'handshake',
    '🏢': 'building', '🏆': 'trophy', '🏛': 'hall', '⏩': 'skip', '💰': 'money', '💴': 'money', '💵': 'money', '🎯': 'target', '📊': 'chart', '🧾': 'receipt', '📅': 'calendar', '🗓': 'calendar', '💬': 'chat',
    '🧑': 'person', '👤': 'person', '👨': 'person', '👩': 'person', '🌟': 'star', '⭐': 'star', '★': 'star', '✨': 'star', '🔒': 'lock', '🔓': 'lock', '🏙': 'city', '🚶': 'walk', '🔀': 'branch', '🧲': 'magnet', '🗺': 'map',
    '🩺': 'stetho', '🏦': 'bank', '📜': 'scroll', '🙏': 'handshake', '📱': 'phone', '⚕': 'med', '⚕️': 'med', '📣': 'megaphone', '📢': 'megaphone', '🧭': 'compass', '🏅': 'medal', '🥇': 'medal', '🥈': 'medal', '🥉': 'medal',
    '☕': 'cafe', '🧸': 'kids', '🚌': 'bus', '📺': 'tv', '🎁': 'gift', '🏃': 'run', '🔍': 'search', '🔎': 'search', '🦴': 'bone', '🦵': 'bone', '🔁': 'repeat', '🔄': 'reset', '⏸': 'pause', '❓': 'help',
    '🔕': 'belloff', '🔔': 'bell', '👥': 'staff', '👨‍👩‍👧': 'staff', '📚': 'book', '📈': 'trend', '📉': 'trend', '🚗': 'car', '🚑': 'car', '📝': 'note', '⚡': 'bolt', '👁': 'eye', '👁️': 'eye', '🏠': 'home', '💉': 'syringe',
    '📌': 'pin', '📍': 'pin', '🧰': 'toolbox', '🧑‍⚕️': 'doctor', '👨‍⚕️': 'doctor', '👩‍⚕️': 'doctor', '🔊': 'sound', '⚙': 'gear', '⚙️': 'gear', '☀': 'sun', '☀️': 'sun', '🌤': 'sun', '⛅': 'cloud', '☁': 'cloud', '☁️': 'cloud', '🌧': 'rain', '☔': 'rain', '🌦': 'rain', '❄': 'cloud',
    '💇': 'scissors', '💊': 'pill', '🍀': 'clover', '📡': 'radar', '⏰': 'clock', '⏱': 'clock', '🕐': 'clock', '👑': 'crown', '🩹': 'bandage', '❤': 'heart', '❤️': 'heart', '💙': 'heart', '🚩': 'flag', '🔑': 'key', '🚀': 'rocket', '🚚': 'truck',
    '➡': 'arrow', '➡️': 'arrow', '☆': 'star', '★': 'star:fill',
  };
  function svg(name, cls) {
    if (name && name.indexOf(':') > 0) { const a = name.split(':'); name = a[0]; cls = cls ? cls + ' ' + a[1] : a[1]; }
    const p = P[name];
    if (!p) return '';
    return `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><g fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${p}</g></svg>`;
  }
  function el(name) {
    const t = document.createElement('template');
    t.innerHTML = svg(name);
    return t.content.firstChild;
  }
  // 絵文字の検出: 記号・絵文字ブロック+異体字セレクタ+ZWJ の連結
  const RE = /(?:[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{2300}-\u{23FF}\u{FE0F}\u{200D}\u{20E3}★☆]|\u{1F3FB}|\u{1F3FC}|\u{1F3FD}|\u{1F3FE}|\u{1F3FF})+/gu;
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'CANVAS', 'SVG', 'svg']);
  let sweeping = false;
  function iconFor(seq) {
    if (MAP[seq] !== undefined) return MAP[seq];
    const base = seq.replace(/️/g, '');
    if (MAP[base] !== undefined) return MAP[base];
    // 連結(ZWJ)は先頭の絵文字で判断
    const first = Array.from(base)[0];
    if (MAP[first] !== undefined) return MAP[first];
    if (MAP[first + '️'] !== undefined) return MAP[first + '️'];
    return null;
  }
  function sweepText(node) {
    const s = node.nodeValue;
    if (!s || !RE.test(s)) { RE.lastIndex = 0; return; }
    RE.lastIndex = 0;
    const frag = document.createDocumentFragment();
    let last = 0; let m;
    while ((m = RE.exec(s))) {
      if (m.index > last) frag.appendChild(document.createTextNode(s.slice(last, m.index)));
      const name = iconFor(m[0]);
      if (name) frag.appendChild(el(name));
      last = m.index + m[0].length;
      // 絵文字の後ろの半角空白は詰める(アイコン+文字の間隔は CSS で)
      if (s[last] === ' ') last += 1;
    }
    if (last < s.length) frag.appendChild(document.createTextNode(s.slice(last)));
    node.parentNode.replaceChild(frag, node);
  }
  function sweep(rootEl) {
    if (sweeping) return;
    sweeping = true;
    try {
      const w = document.createTreeWalker(rootEl || document.body, NodeFilter.SHOW_TEXT, {
        acceptNode(n) { const p = n.parentNode; return p && !SKIP.has(p.nodeName) && RE.test(n.nodeValue) ? (RE.lastIndex = 0, NodeFilter.FILTER_ACCEPT) : (RE.lastIndex = 0, NodeFilter.FILTER_REJECT); }
      });
      const nodes = [];
      while (w.nextNode()) nodes.push(w.currentNode);
      nodes.forEach(sweepText);
    } finally { sweeping = false; }
  }
  function start() {
    sweep(document.body);
    const mo = new MutationObserver((muts) => {
      if (sweeping) return;
      for (const m of muts) {
        if (m.type === 'characterData') { if (m.target.parentNode && !SKIP.has(m.target.parentNode.nodeName)) sweepText(m.target); }
        else for (const n of m.addedNodes) { if (n.nodeType === 3) { if (n.parentNode && !SKIP.has(n.parentNode.nodeName)) sweepText(n); } else if (n.nodeType === 1 && !SKIP.has(n.nodeName)) sweep(n); }
      }
    });
    mo.observe(document.body, { childList: true, subtree: true, characterData: true });
    return mo;
  }
  root.ICONS = { svg, el, sweep, start, MAP, names: Object.keys(P) };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})(window);
