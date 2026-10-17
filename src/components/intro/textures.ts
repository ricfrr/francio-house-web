/**
 * Procedural textures for the street scene. Painted once on small canvases when the
 * scene starts (about 100 ms in total), so there are no image files to download.
 */
import * as THREE from 'three';
import { pfbm, pnoise, rng } from './noise';

let aniso = 4;
export const setAnisotropy = (n: number) => (aniso = n);

function toTexture(c: HTMLCanvasElement, srgb = true) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  t.anisotropy = aniso;
  return t;
}

/** Fills a square canvas pixel by pixel; `fn` gets u,v in [0,1) and returns r,g,b in 0-255. */
function paint(size: number, fn: (u: number, v: number) => [number, number, number]) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d')!;
  const img = x.createImageData(size, size);
  const d = img.data;
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      const [r, g, b] = fn(px / size, py / size);
      const o = (py * size + px) * 4;
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

const canvas2d = (w: number, h = w) => {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return { c, x: c.getContext('2d')! };
};

/** Painted plaster: soft mottling, fine grain, the odd damp stain. Plus a matching bump map. */
export function plaster() {
  const map = paint(512, (u, v) => {
    const low = pfbm(u * 4, v * 4, 4, 1, 3);
    const grain = pnoise(u * 128, v * 128, 128, 2);
    const stain = Math.max(0, pfbm(u * 6, v * 6, 6, 5, 3) - 0.6) * 1.7;
    const k = 0.96 + (low - 0.5) * 0.08 + (grain - 0.5) * 0.06 - stain * 0.12;
    return [248 * k, 245 * k, 236 * k - stain * 8];
  });
  const bump = paint(256, (u, v) => {
    const g = pfbm(u * 48, v * 48, 48, 9, 3) * 255;
    return [g, g, g];
  });
  return { map: toTexture(map), bump: toTexture(bump, false) };
}

/** Overlapping terracotta roof tiles. Also used as its own bump map. */
export function roofTiles() {
  const S = 512, rows = 14, cols = 8;
  const { c, x } = canvas2d(S);
  const r = rng(5);
  x.fillStyle = '#2c1a12';
  x.fillRect(0, 0, S, S);
  const th = S / rows, tw = S / cols;
  // bottom row first: each upper tile then overlaps the one below it
  for (let j = rows - 1; j >= 0; j--) {
    for (let i = -1; i <= cols; i++) {
      const px = i * tw + (j % 2) * (tw / 2), py = j * th;
      const k = 0.78 + r() * 0.42;
      const base = [148 * k, 92 * k, 66 * k];
      const g = x.createLinearGradient(px, py, px, py + th * 1.3);
      g.addColorStop(0, `rgb(${base.map((v) => (v * 0.72) | 0)})`);
      g.addColorStop(0.55, `rgb(${base.map((v) => v | 0)})`);
      g.addColorStop(1, `rgb(${base.map((v) => Math.min(255, v * 1.15) | 0)})`);
      x.fillStyle = g;
      x.beginPath();
      x.roundRect(px + 1.5, py + 1, tw - 3, th * 1.3, 7);
      x.fill();
      // a little weathering
      if (r() < 0.25) {
        x.fillStyle = `rgba(210,200,170,${0.05 + r() * 0.12})`;
        x.fillRect(px + 4 + r() * tw * 0.5, py + 3, tw * 0.3, th * 0.6);
      }
    }
  }
  return toTexture(c);
}

/** Concrete slabs with moss in the joints. */
export function paving() {
  return toTexture(
    paint(256, (u, v) => {
      const n = pfbm(u * 8, v * 8, 8, 3, 4);
      const sp = pnoise(u * 96, v * 96, 96, 4);
      let k = 0.9 + (n - 0.5) * 0.24 + (sp - 0.5) * 0.14;
      // two slabs per tile in each direction
      const fu = (u * 2) % 1, fv = (v * 2) % 1;
      const j = Math.min(fu, 1 - fu, fv, 1 - fv);
      let r = 204 * k, g = 199 * k, b = 188 * k;
      if (j < 0.014) {
        const moss = n > 0.5 ? (n - 0.5) * 2 : 0;
        r = r * 0.5 - moss * 10;
        g = g * 0.52 + moss * 14;
        b = b * 0.46 - moss * 10;
      } else if (j < 0.05) {
        const f = 0.9 + 0.1 * ((j - 0.014) / 0.036);
        r *= f; g *= f; b *= f;
      }
      return [r, g, b];
    }),
  );
}

/** Dry Marche lawn: olive, straw and green patches. */
export function lawn() {
  return toTexture(
    paint(256, (u, v) => {
      const a = pfbm(u * 6, v * 6, 6, 7, 4);
      const b = pnoise(u * 64, v * 64, 64, 8);
      const green = [104, 124, 64], mid = [134, 140, 82], dry = [166, 156, 100];
      const t = a < 0.5 ? a * 2 : (a - 0.5) * 2;
      const [c0, c1] = a < 0.5 ? [green, mid] : [mid, dry];
      const k = 0.88 + (b - 0.5) * 0.34;
      return [(c0[0] + (c1[0] - c0[0]) * t) * k, (c0[1] + (c1[1] - c0[1]) * t) * k, (c0[2] + (c1[2] - c0[2]) * t) * k];
    }),
  );
}

export function bark() {
  return toTexture(
    paint(128, (u, v) => {
      // vertical furrows: stretched noise (only u repeats, trunks don't tile in v)
      const f = pnoise(u * 8, v * 2.5, 8, 11) * 0.7 + pnoise(u * 16, v * 5, 16, 12) * 0.3;
      const k = 0.55 + f * 0.7;
      return [112 * k, 90 * k, 74 * k];
    }),
  );
}

export function wood() {
  const { c, x } = canvas2d(128, 256);
  const r = rng(21);
  x.fillStyle = '#6b4a37';
  x.fillRect(0, 0, 128, 256);
  for (let i = 0; i < 160; i++) {
    const px = r() * 128;
    x.strokeStyle = r() < 0.5 ? `rgba(40,24,14,${0.08 + r() * 0.2})` : `rgba(150,105,75,${0.06 + r() * 0.12})`;
    x.lineWidth = 0.6 + r() * 1.6;
    x.beginPath();
    x.moveTo(px, 0);
    x.bezierCurveTo(px + (r() - 0.5) * 8, 80, px + (r() - 0.5) * 8, 170, px + (r() - 0.5) * 6, 256);
    x.stroke();
  }
  return toTexture(c);
}

/** A burst of pine needles on transparent ground: used on many crossed cards for the tree crowns. */
export function needleTuft() {
  const { c, x } = canvas2d(128);
  const r = rng(33);
  const core = x.createRadialGradient(64, 64, 2, 64, 64, 30);
  core.addColorStop(0, 'rgba(24,46,22,0.95)');
  core.addColorStop(1, 'rgba(24,46,22,0)');
  x.fillStyle = core;
  x.fillRect(0, 0, 128, 128);
  x.lineCap = 'round';
  for (let i = 0; i < 110; i++) {
    const a = r() * Math.PI * 2;
    const len = 22 + r() * 40;
    const sx = 64 + Math.cos(a) * r() * 8, sy = 64 + Math.sin(a) * r() * 8;
    const bend = (r() - 0.5) * 10;
    x.strokeStyle = `hsl(${90 + r() * 30} ${38 + r() * 22}% ${14 + r() * 24}%)`;
    x.lineWidth = 1.1 + r() * 1.1;
    x.beginPath();
    x.moveTo(sx, sy);
    x.quadraticCurveTo(sx + Math.cos(a) * len * 0.5 - Math.sin(a) * bend, sy + Math.sin(a) * len * 0.5 + Math.cos(a) * bend, sx + Math.cos(a) * len, sy + Math.sin(a) * len);
    x.stroke();
  }
  return toTexture(c);
}

/** Broad leaves, for the bushes. */
export function leafTuft() {
  const { c, x } = canvas2d(128);
  const r = rng(44);
  for (let i = 0; i < 46; i++) {
    const px = 64 + (r() - 0.5) * 80, py = 64 + (r() - 0.5) * 80;
    x.save();
    x.translate(px, py);
    x.rotate(r() * Math.PI * 2);
    x.fillStyle = `hsl(${80 + r() * 40} ${36 + r() * 24}% ${16 + r() * 26}%)`;
    x.beginPath();
    x.ellipse(0, 0, 6 + r() * 6, 12 + r() * 9, 0, 0, Math.PI * 2);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,0.18)';
    x.lineWidth = 1;
    x.beginPath();
    x.moveTo(0, -10);
    x.lineTo(0, 10);
    x.stroke();
    x.restore();
  }
  return toTexture(c);
}
