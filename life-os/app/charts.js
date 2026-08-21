/* ================================================================
   LIFE//OS — charts & icons
   図はすべて手描きのSVG。外部チャートライブラリは使わない。
   系列色は CSS 変数から読む（トークン外の色をここで作らない）。
   ================================================================ */
(function (global) {
  'use strict';

  /* ---------------- アイコン（24×24 / stroke） ---------------- */

  var ICONS = {
    home:    '<path d="M4 11.2 12 4l8 7.2"/><path d="M6.4 9.8V20h11.2V9.8"/>',
    input:   '<path d="M4 7h16"/><path d="M4 12h11"/><path d="M4 17h7"/><circle cx="18.5" cy="16.5" r="2.5"/>',
    log:     '<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M8 9.5h8M8 14.5h5"/>',
    history: '<path d="M4 18V6"/><path d="M4 18h16"/><path d="m7 15 4-5 3.2 3L20 7.5"/>',
    menu:    '<path d="M4 7h16M4 12h16M4 17h16"/>',

    work:    '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7"/>',
    exercise:'<path d="M4 9.5v5M20 9.5v5M7.5 6.5v11M16.5 6.5v11"/><path d="M7.5 12h9"/>',
    meal:    '<path d="M7 3v8a2 2 0 0 0 4 0V3"/><path d="M9 11v10"/><path d="M17 3c-1.6 1.4-2 3-2 5s.6 3 2 3v10"/>',
    sleep:   '<path d="M20 14.5A8 8 0 0 1 9.5 4a8.2 8.2 0 1 0 10.5 10.5Z"/>',
    moon:    '<path d="M20 14.5A8 8 0 0 1 9.5 4a8.2 8.2 0 1 0 10.5 10.5Z"/>',
    drink:   '<path d="M4.5 4h15l-7.5 8.5L4.5 4Z"/><path d="M12 12.5V19"/><path d="M8.5 19h7"/>',
    sauna:   '<path d="M8 4c-1.2 1.6 1.2 2.9 0 4.5"/><path d="M12 3.5c-1.4 1.9 1.4 3.4 0 5.3"/><path d="M16 4c-1.2 1.6 1.2 2.9 0 4.5"/><rect x="4" y="12" width="16" height="8" rx="2"/>',
    outing:  '<path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z"/><circle cx="12" cy="10" r="2.4"/>',
    meet:    '<circle cx="9" cy="8.5" r="3"/><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0"/><path d="M16 6.2a3 3 0 0 1 0 5.6"/><path d="M17.5 14.6a5.5 5.5 0 0 1 3 4.9"/>',
    other:   '<circle cx="12" cy="12" r="8"/><path d="M12 8v4.5l3 1.8"/>',
    system:  '<circle cx="12" cy="12" r="8"/><path d="M12 4v3M12 17v3M4 12h3M17 12h3"/>',

    check:   '<path d="m4.5 12.5 5 5 10-11"/>',
    chevron: '<path d="m9 5 7 7-7 7"/>',
    close:   '<path d="m6 6 12 12M18 6 6 18"/>',
    plus:    '<path d="M12 5v14M5 12h14"/>',
    trash:   '<path d="M4 7h16"/><path d="M9.5 7V5h5v2"/><path d="M6.5 7l1 13h9l1-13"/>',
    share:   '<path d="M12 15V4"/><path d="m8 7.5 4-3.5 4 3.5"/><path d="M5 13v6.5h14V13"/>',
    spark:   '<path d="M4 17.5 9 11l3.5 3.5L20 6"/>',
    download:'<path d="M12 4v11"/><path d="m8 11.5 4 3.5 4-3.5"/><path d="M5 19h14"/>',
    upload:  '<path d="M12 15V4"/><path d="m8 7.5 4-3.5 4 3.5"/><path d="M5 19h14"/>',
    terminal:'<path d="m6 8 4 4-4 4"/><path d="M13 16h5"/><rect x="3" y="4" width="18" height="16" rx="2.5"/>'
  };

  function icon(name) {
    var body = ICONS[name] || ICONS.other;
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + body + '</svg>';
  }

  /* ---------------- 色トークンの読み出し ---------------- */

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  function paramColor(id) {
    return cssVar(id === 'score' ? '--c-score' : '--c-' + id);
  }

  /* ---------------- 円形ゲージ ---------------- */

  function ringSVG(value, colorVar, r) {
    r = r || 34;
    var circ = 2 * Math.PI * r;
    var pct = value == null ? 0 : Math.max(0, Math.min(100, value)) / 100;
    var off = circ * (1 - pct);
    var vb = (r + 6) * 2;
    return '<svg viewBox="0 0 ' + vb + ' ' + vb + '" aria-hidden="true">'
      + '<circle class="gauge-track" cx="' + (vb / 2) + '" cy="' + (vb / 2) + '" r="' + r + '"/>'
      + '<circle class="gauge-fill" cx="' + (vb / 2) + '" cy="' + (vb / 2) + '" r="' + r + '"'
      + ' style="--circ:' + circ.toFixed(1) + ';--gc:var(' + colorVar + ');stroke-dashoffset:' + circ.toFixed(1) + '"'
      + ' data-off="' + off.toFixed(1) + '"/>'
      + '</svg>';
  }

  /** 描画後に呼ぶと、0 から実値まで伸びる */
  function animateRings(root) {
    var fills = (root || document).querySelectorAll('.gauge-fill[data-off], .sf[data-off]');
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        for (var i = 0; i < fills.length; i++) {
          fills[i].style.strokeDashoffset = fills[i].getAttribute('data-off');
        }
      });
    });
  }

  /* ---------------- スパークライン ---------------- */

  function sparkSVG(values, colorVar) {
    var w = 60, h = 18, pad = 2;
    var pts = [];
    var real = values.filter(function (v) { return v != null; });
    if (real.length < 2) {
      return '<svg class="gauge-spark" viewBox="0 0 ' + w + ' ' + h + '" aria-hidden="true">'
        + '<line x1="0" y1="' + (h / 2) + '" x2="' + w + '" y2="' + (h / 2) + '" stroke="var(--track)" stroke-width="1"/></svg>';
    }
    var lo = Math.min.apply(null, real), hi = Math.max.apply(null, real);
    if (hi - lo < 8) { var mid = (hi + lo) / 2; lo = mid - 4; hi = mid + 4; }
    var n = values.length;
    var last = null;
    for (var i = 0; i < n; i++) {
      if (values[i] == null) continue;
      var x = n === 1 ? w / 2 : (i / (n - 1)) * w;
      var y = pad + (1 - (values[i] - lo) / (hi - lo)) * (h - pad * 2);
      pts.push([x, y]);
      last = [x, y];
    }
    var d = pts.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
    return '<svg class="gauge-spark" viewBox="0 0 ' + w + ' ' + h + '" preserveAspectRatio="none" aria-hidden="true">'
      + '<path d="' + d + '" fill="none" stroke="var(' + colorVar + ')" stroke-width="1.4"'
      + ' stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>'
      + (last ? '<circle cx="' + last[0].toFixed(1) + '" cy="' + last[1].toFixed(1) + '" r="1.6" fill="var(' + colorVar + ')"/>' : '')
      + '</svg>';
  }

  /* ---------------- 履歴チャート（折れ線） ---------------- */

  var SERIES = [
    { id: 'energy', label: 'ENERGY' },
    { id: 'focus',  label: 'FOCUS' },
    { id: 'mood',   label: 'MOOD' },
    { id: 'body',   label: 'BODY' },
    { id: 'social', label: 'SOCIAL' },
    { id: 'score',  label: 'DAY SCORE' }
  ];

  function valueOf(row, id) {
    if (id === 'score') return row.score;
    return row.status ? row.status[id] : null;
  }

  function fmtTick(key) {
    var p = key.split('-');
    return (+p[1]) + '/' + (+p[2]);
  }

  /**
   * rows   : [{ key, status, score }]（古い順）
   * active : 表示中の系列ID配列
   */
  function drawHistory(box, rows, active) {
    var W = Math.max(260, box.clientWidth - 24);
    // 横に伸びすぎると折れ線が平らに見える。幅に応じて高さも上げる
    var H = W < 420 ? 190 : (W < 760 ? 240 : Math.min(340, Math.round(W * 0.30)));
    var padL = 26, padR = 12, padT = 10, padB = 20;
    var plotW = W - padL - padR;
    var plotH = H - padT - padB;

    var n = rows.length;
    var x = function (i) { return padL + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW); };
    var y = function (v) { return padT + (1 - v / 100) * plotH; };

    var svg = ['<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H + '" role="img" aria-label="状態の推移">'];

    // グリッド（1px・実線・控えめ）
    [0, 25, 50, 75, 100].forEach(function (v) {
      svg.push('<line class="grid-line" x1="' + padL + '" y1="' + y(v).toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y(v).toFixed(1) + '"/>');
      svg.push('<text class="axis-text" x="' + (padL - 6) + '" y="' + (y(v) + 3).toFixed(1) + '" text-anchor="end">' + v + '</text>');
    });

    // x軸のラベルは4点だけ（詰め込まない）
    var ticks = n <= 1 ? [0] : [0, Math.floor((n - 1) / 3), Math.floor((n - 1) * 2 / 3), n - 1];
    ticks.filter(function (v, i, a) { return a.indexOf(v) === i; }).forEach(function (i) {
      var anchor = i === 0 ? 'start' : (i === n - 1 ? 'end' : 'middle');
      svg.push('<text class="axis-text" x="' + x(i).toFixed(1) + '" y="' + (H - 5) + '" text-anchor="' + anchor + '">' + fmtTick(rows[i].key) + '</text>');
    });

    // 系列。欠測はつながない（線を分割する）
    SERIES.forEach(function (s) {
      if (active.indexOf(s.id) === -1) return;
      var col = 'var(' + (s.id === 'score' ? '--c-score' : '--c-' + s.id) + ')';
      var segs = [], cur = [];
      for (var i = 0; i < n; i++) {
        var v = valueOf(rows[i], s.id);
        if (v == null) { if (cur.length) segs.push(cur); cur = []; continue; }
        cur.push([x(i), y(v)]);
      }
      if (cur.length) segs.push(cur);

      segs.forEach(function (seg) {
        if (seg.length === 1) {
          svg.push('<circle cx="' + seg[0][0].toFixed(1) + '" cy="' + seg[0][1].toFixed(1) + '" r="2.4" fill="' + col + '"/>');
          return;
        }
        var d = seg.map(function (p, i) { return (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); }).join(' ');
        svg.push('<path class="series-line" d="' + d + '" stroke="' + col + '"/>');
      });

      // 端点マーカー（面と重なっても読めるよう、面色の2pxリングを付ける）
      var lastSeg = segs[segs.length - 1];
      if (lastSeg && lastSeg.length) {
        var p = lastSeg[lastSeg.length - 1];
        svg.push('<circle class="series-end" cx="' + p[0].toFixed(1) + '" cy="' + p[1].toFixed(1) + '" r="3.4" fill="' + col + '"/>');
      }
    });

    var hasData = rows.some(function (r) { return r.status; });
    if (!hasData) {
      svg.push('<text class="axis-text" x="' + (padL + plotW / 2).toFixed(1) + '" y="'
        + (padT + plotH / 2).toFixed(1) + '" text-anchor="middle">NO DATA IN RANGE</text>');
    }

    // 交差線とヒット面
    svg.push('<line class="crosshair" id="lo-cross" x1="0" y1="' + padT + '" x2="0" y2="' + (padT + plotH) + '" style="opacity:0"/>');
    svg.push('<rect id="lo-hit" x="' + padL + '" y="' + padT + '" width="' + plotW + '" height="' + plotH + '" fill="transparent"/>');
    svg.push('</svg>');

    box.querySelectorAll('svg').forEach(function (el) { el.remove(); });
    box.insertAdjacentHTML('afterbegin', svg.join(''));

    return { x: x, y: y, W: W, H: H, padL: padL, plotW: plotW, n: n };
  }

  global.LifeCharts = {
    ICONS: ICONS,
    icon: icon,
    cssVar: cssVar,
    paramColor: paramColor,
    ringSVG: ringSVG,
    animateRings: animateRings,
    sparkSVG: sparkSVG,
    SERIES: SERIES,
    valueOf: valueOf,
    drawHistory: drawHistory,
    fmtTick: fmtTick
  };
})(window);
