import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const cache = new Map<string, string>();

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  return { s, l };
}

const hex = (n: number) => Math.round(n).toString(16).padStart(2, '0');

/**
 * Finds the poster file referenced by an event's Markdown file
 * (`poster: ./posters/x.jpg`) and returns its most characteristic colour.
 */
export async function posterAccent(markdownPath: string | undefined, fallback = '#ff3d7f'): Promise<string> {
  if (!markdownPath) return fallback;
  if (cache.has(markdownPath)) return cache.get(markdownPath)!;
  let color = fallback;
  try {
    const abs = resolve(markdownPath);
    const match = readFileSync(abs, 'utf8').match(/^poster:\s*["']?([^"'\s#]+)/m);
    if (match) {
      const file = resolve(dirname(abs), match[1]);
      const { data } = await sharp(file).resize(32, 32, { fit: 'fill' }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
      // Bucket the pixels and score each bucket by how common and how vivid it is.
      const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
      for (let i = 0; i < data.length; i += 3) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const key = ((r >> 5) << 6) | ((g >> 5) << 3) | (b >> 5);
        const e = buckets.get(key) ?? { n: 0, r: 0, g: 0, b: 0 };
        e.n++; e.r += r; e.g += g; e.b += b;
        buckets.set(key, e);
      }
      let best = -1;
      for (const e of buckets.values()) {
        const r = e.r / e.n, g = e.g / e.n, b = e.b / e.n;
        const { s, l } = rgbToHsl(r, g, b);
        const score = Math.sqrt(e.n) * Math.pow(0.15 + s, 2) * (l < 0.12 || l > 0.92 ? 0.15 : 1);
        if (score > best) { best = score; color = `#${hex(r)}${hex(g)}${hex(b)}`; }
      }
    }
  } catch {
    // keep the fallback
  }
  cache.set(markdownPath, color);
  return color;
}

/** Black or cream text, whichever reads better on `bg`. */
export function inkFor(bg: string): string {
  const n = parseInt(bg.slice(1), 16);
  const lin = (c: number) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.33 ? '#15101a' : '#fbf6ec';
}
