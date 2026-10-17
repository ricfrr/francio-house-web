/**
 * Build-time generators for the hand-painted decor: leaves, paint drips,
 * fringe curtains and terrazzo. Deterministic, so the HTML is stable between builds.
 */

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

const f = (n: number) => Math.round(n * 10) / 10;

// ---------------- leaves (viewBox 0 0 200 240, stem at bottom centre) ----------------

/** Split-leaf monstera: rounded "fingers" radiating from the midrib. Each part is its own path. */
export function monstera(): { blade: string[]; veins: string } {
  const parts: string[] = [];
  const veins: string[] = [];
  const top = 18, bottom = 196, cx = 100;
  const n = 7;
  for (const side of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const y = top + 14 + t * (bottom - top - 40);
      // blade half-width follows a rounded heart outline
      const half = 84 * Math.sin(Math.PI * (0.12 + t * 0.8)) + 8;
      const ang = (-0.5 + t * 1.05) * (Math.PI / 2); // up-outward at the top, down-outward at the bottom
      const dx = Math.cos(ang) * side, dy = Math.sin(ang);
      const nx = -dy, ny = dx;
      const L = half / Math.max(0.6, Math.cos(ang));
      const w = 27 - t * 5;
      const ex = cx + dx * L, ey = y + dy * L;
      const p1 = [cx + nx * w * 0.5, y + ny * w * 0.5];
      const p2 = [cx - nx * w * 0.5, y - ny * w * 0.5];
      const t1 = [ex + nx * w * 0.42 - dx * 8, ey + ny * w * 0.42 - dy * 8];
      const t2 = [ex - nx * w * 0.42 - dx * 8, ey - ny * w * 0.42 - dy * 8];
      parts.push(
        `M${f(p1[0])} ${f(p1[1])}L${f(t1[0])} ${f(t1[1])}Q${f(ex + dx * 10)} ${f(ey + dy * 10)} ${f(t2[0])} ${f(t2[1])}L${f(p2[0])} ${f(p2[1])}Z`,
      );
      veins.push(`M${cx} ${f(y)}L${f(ex - dx * 14)} ${f(ey - dy * 14)}`);
    }
  }
  // midrib body + tip + stem
  parts.push(`M${cx - 13} ${top + 20}Q${cx} ${top - 14} ${cx + 13} ${top + 20}L${cx + 11} ${bottom - 10}Q${cx} ${bottom + 8} ${cx - 11} ${bottom - 10}Z`);
  parts.push(`M${cx - 4} ${bottom - 12}L${cx + 4} ${bottom - 12}L${cx + 3} 240L${cx - 3} 240Z`);
  veins.push(`M${cx} ${top + 4}L${cx} 238`);
  return { blade: parts, veins: veins.join('') };
}

/** Palm frond: a curved rachis with many thin leaflets. */
export function palm(): { blade: string[]; veins: string } {
  const parts: string[] = [];
  const P0 = [100, 240], P1 = [70, 120], P2 = [150, 20];
  const at = (t: number) => {
    const a = (1 - t) * (1 - t), b = 2 * (1 - t) * t, c = t * t;
    return [a * P0[0] + b * P1[0] + c * P2[0], a * P0[1] + b * P1[1] + c * P2[1]];
  };
  const tan = (t: number) => {
    const x = 2 * (1 - t) * (P1[0] - P0[0]) + 2 * t * (P2[0] - P1[0]);
    const y = 2 * (1 - t) * (P1[1] - P0[1]) + 2 * t * (P2[1] - P1[1]);
    const l = Math.hypot(x, y);
    return [x / l, y / l];
  };
  for (let i = 0; i < 22; i++) {
    const t = 0.12 + (i / 22) * 0.86;
    const [px, py] = at(t);
    const [tx, ty] = tan(t);
    const len = 20 + 70 * Math.sin(Math.PI * Math.min(1, t * 1.05));
    for (const side of [-1, 1]) {
      const nx = -ty * side, ny = tx * side;
      // sweep leaflets towards the tip
      const dx = nx * 0.8 + tx * 0.6, dy = ny * 0.8 + ty * 0.6;
      const ex = px + dx * len, ey = py + dy * len + len * 0.25;
      const w = 5;
      parts.push(
        `M${f(px)} ${f(py)}Q${f(px + dx * len * 0.5 + nx * w * side)} ${f(py + dy * len * 0.5 + ny * w * side - 6)} ${f(ex)} ${f(ey)}Q${f(px + dx * len * 0.5 - nx * w * side)} ${f(py + dy * len * 0.5 - ny * w * side + 4)} ${f(px + tx * 6)} ${f(py + ty * 6)}Z`,
      );
    }
  }
  const veins = `M${P0[0]} ${P0[1]}Q${P1[0]} ${P1[1]} ${P2[0]} ${P2[1]}`;
  return { blade: parts, veins };
}

/** Heart-shaped pothos leaf, like the ones on the aquarium. */
export function heart(): { blade: string[]; veins: string } {
  const blade =
    'M100 236C98 220 96 206 94 196C60 186 22 150 20 104C18 60 52 30 80 40C92 44 98 54 100 64C102 54 108 44 120 40C150 30 182 62 180 106C178 152 140 186 106 196C104 206 102 220 100 236Z';
  const veins =
    'M100 196L100 70M100 160C80 150 60 130 48 104M100 160C120 150 140 130 152 104M100 120C88 110 76 96 70 78M100 120C112 110 124 96 130 78';
  return { blade: [blade], veins };
}

// ---------------- paint drips along the top of a room ----------------

export function drips(seed: number, width = 1200, height = 90): string {
  const r = rng(seed);
  let d = `M0 0L${width} 0L${width} 10`;
  let x = width;
  while (x > 0) {
    const gap = 18 + r() * 70;
    x -= gap;
    if (x <= 8) break;
    const long = r() < 0.35;
    const len = long ? 30 + r() * (height - 40) : 8 + r() * 20;
    const w = long ? 7 + r() * 9 : 10 + r() * 20;
    const base = 8 + r() * 6;
    // a drip: neck, then a rounded bulb at the end
    d += `L${f(x + w)} ${f(base)}C${f(x + w * 0.7)} ${f(base + len * 0.6)} ${f(x + w * 0.9)} ${f(base + len)} ${f(x + w / 2)} ${f(base + len)}C${f(x + w * 0.1)} ${f(base + len)} ${f(x + w * 0.3)} ${f(base + len * 0.6)} ${f(x)} ${f(base)}`;
  }
  d += `L0 10Z`;
  return d;
}

// ---------------- fringe curtain (tinsel strips, like the party curtain) ----------------

export type Strip = { x: number; len: number; color: string };

export function fringe(seed: number, colors: string[], width = 1200, height = 200): { groups: Strip[][] } {
  const r = rng(seed);
  const groups: Strip[][] = [];
  const per = width / colors.length;
  colors.forEach((color, gi) => {
    const strips: Strip[] = [];
    for (let x = gi * per; x < (gi + 1) * per; x += 4 + r() * 2) {
      const edge = Math.min(x - gi * per, (gi + 1) * per - x) / per; // shorter at the edges of each panel
      strips.push({ x: f(x), len: f(height * (0.55 + Math.min(0.45, edge * 1.4)) - r() * 36), color });
    }
    groups.push(strips);
  });
  return { groups };
}

// ---------------- terrazzo tile (as a data URI) ----------------

export function terrazzo(seed: number, size = 360): string {
  const r = rng(seed);
  const colors = ['#b5643d', '#8b8178', '#2b2522', '#f7efe2', '#d79a86', '#c9b8a3', '#6f5a4c', '#e3c9a5'];
  let chips = '';
  for (let i = 0; i < 260; i++) {
    const cx = r() * size, cy = r() * size;
    const rad = 1.5 + Math.pow(r(), 2.4) * 16;
    const pts = 5 + Math.floor(r() * 3);
    let d = '';
    for (let k = 0; k < pts; k++) {
      const a = (k / pts) * Math.PI * 2 + r() * 0.6;
      const rr = rad * (0.6 + r() * 0.5);
      d += `${k ? 'L' : 'M'}${f(cx + Math.cos(a) * rr)} ${f(cy + Math.sin(a) * rr)}`;
    }
    chips += `<path d='${d}Z' fill='${colors[Math.floor(r() * colors.length)]}' opacity='${f(0.55 + r() * 0.45)}'/>`;
  }
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'><rect width='${size}' height='${size}' fill='#ece0d0'/>${chips}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
