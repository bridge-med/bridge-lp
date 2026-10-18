// CHRONOS — a geometric stroke typeface built from mechanical bars and arcs.
// Coordinates: 1000-unit em, baseline y=0, cap height 1000. Strokes are centerlines; STROKE is the bar width.
// arc angles in degrees, counter-clockwise; a1 < a0 means clockwise sweep.
export const STROKE = 180;
const h = STROKE / 2; // 90

const L = (x1, y1, x2, y2) => ({ kind: 'line', x1, y1, x2, y2 });
const A = (cx, cy, r, a0, a1) => ({ kind: 'arc', cx, cy, r, a0, a1 });
const DOT = (x, y) => ({ kind: 'dot', x, y });

export const GLYPHS = {
  'I': { w: 180, strokes: [L(90, 0, 90, 1000)] },
  'T': { w: 700, strokes: [L(0, 910, 700, 910), L(350, 0, 350, 820)] },
  'E': { w: 620, strokes: [L(90, 0, 90, 1000), L(180, 910, 620, 910), L(180, 500, 560, 500), L(180, 90, 620, 90)] },
  'F': { w: 600, strokes: [L(90, 0, 90, 1000), L(180, 910, 600, 910), L(180, 520, 520, 520)] },
  'L': { w: 580, strokes: [L(90, 0, 90, 1000), L(180, 90, 580, 90)] },
  'H': { w: 760, strokes: [L(90, 0, 90, 1000), L(670, 0, 670, 1000), L(180, 500, 580, 500)] },
  'M': { w: 920, strokes: [L(90, 0, 90, 1000), L(830, 0, 830, 1000), L(90, 1000, 460, 160), L(460, 160, 830, 1000)] },
  'N': { w: 780, strokes: [L(90, 0, 90, 1000), L(690, 0, 690, 1000), L(90, 1000, 690, 0)] },
  'V': { w: 800, strokes: [L(90, 1000, 400, 0), L(400, 0, 710, 1000)] },
  'Y': { w: 800, strokes: [L(90, 1000, 400, 470), L(400, 470, 710, 1000), L(400, 0, 400, 470)] },
  'O': { w: 1000, strokes: [A(500, 500, 410, 0, 360)] },
  'C': { w: 960, strokes: [A(500, 500, 410, 38, 322)] },
  'G': { w: 1000, strokes: [A(500, 500, 410, 42, 360), L(910, 500, 560, 500)] },
  'S': { w: 840, strokes: [A(500, 750, 250, 22, 270), A(500, 250, 250, 90, -158)] },
  'U': { w: 800, strokes: [L(90, 1000, 90, 400), L(710, 1000, 710, 400), A(400, 400, 310, 180, 360)] },
  'D': { w: 900, strokes: [L(90, 0, 90, 1000), L(180, 910, 400, 910), L(180, 90, 400, 90), A(400, 500, 410, -90, 90)] },
  'B': { w: 705, strokes: [L(90, 0, 90, 1000), L(180, 910, 380, 910), A(380, 715, 195, 90, -90), L(180, 520, 400, 520), A(400, 305, 215, 90, -90), L(180, 90, 400, 90)] },
  'R': { w: 760, strokes: [L(90, 0, 90, 1000), L(180, 910, 380, 910), A(380, 715, 195, 90, -90), L(180, 520, 380, 520), L(440, 520, 690, 0)] },
  'P': { w: 705, strokes: [L(90, 0, 90, 1000), L(180, 910, 380, 910), A(380, 715, 195, 90, -90), L(180, 520, 380, 520)] },
  'A': { w: 900, strokes: [L(90, 0, 450, 1000), L(450, 1000, 810, 0), L(240, 330, 660, 330)] },
  'K': { w: 760, strokes: [L(90, 0, 90, 1000), L(160, 500, 690, 1000), L(160, 500, 690, 0)] },
  'W': { w: 1240, strokes: [L(90, 1000, 340, 0), L(340, 0, 620, 1000), L(620, 1000, 900, 0), L(900, 0, 1150, 1000)] },
  'X': { w: 800, strokes: [L(90, 1000, 710, 0), L(90, 0, 710, 1000)] },
  'Z': { w: 760, strokes: [L(0, 910, 760, 910), L(690, 910, 70, 90), L(0, 90, 760, 90)] },
  '.': { w: 180, strokes: [DOT(90, 90)] },
  ' ': { w: 420, strokes: [] },
};

export const TRACKING = 110;

// Lays out text; returns pieces in units of `size` (cap height), centered on (0,0).
// Each piece: {kind, charIndex, glyphChar, ...coords in world units}
export function layoutText(text, size = 1, tracking = TRACKING) {
  const s = size / 1000;
  let x = 0; const pieces = []; let charIndex = 0;
  for (const ch of text) {
    const g = GLYPHS[ch];
    if (!g) { x += 500; continue; }
    for (const st of g.strokes) {
      if (st.kind === 'line') pieces.push({ kind: 'line', charIndex, ch, x1: (x + st.x1) * s, y1: st.y1 * s, x2: (x + st.x2) * s, y2: st.y2 * s });
      else if (st.kind === 'arc') pieces.push({ kind: 'arc', charIndex, ch, cx: (x + st.cx) * s, cy: st.cy * s, r: st.r * s, a0: st.a0, a1: st.a1 });
      else pieces.push({ kind: 'dot', charIndex, ch, x: (x + st.x) * s, y: st.y * s });
    }
    x += g.w + tracking;
    charIndex++;
  }
  const width = (x - tracking) * s;
  for (const p of pieces) {
    if (p.kind === 'line') { p.x1 -= width / 2; p.x2 -= width / 2; p.y1 -= size / 2; p.y2 -= size / 2; }
    else if (p.kind === 'arc') { p.cx -= width / 2; p.cy -= size / 2; }
    else { p.x -= width / 2; p.y -= size / 2; }
  }
  return { pieces, width, height: size, stroke: STROKE * s };
}
