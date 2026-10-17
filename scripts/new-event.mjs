#!/usr/bin/env node
// Creates a new event file from the template.
//   npm run new-event -- "Artist Name" 2026-12-31 [path/to/poster.jpg]
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { extname, join } from 'node:path';

const [artist, date, posterFile] = process.argv.slice(2);
if (!artist || !/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) {
  console.error('Usage: npm run new-event -- "Artist Name" YYYY-MM-DD [path/to/poster.jpg]');
  process.exit(1);
}

const slug = artist
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');
const dir = 'src/content/events';
const file = join(dir, `${date}-${slug}.md`);
if (existsSync(file)) {
  console.error(`${file} already exists.`);
  process.exit(1);
}

let posterName = `${slug}.jpg`;
if (posterFile) {
  posterName = `${slug}${extname(posterFile).toLowerCase()}`;
  copyFileSync(posterFile, join(dir, 'posters', posterName));
  console.log(`Copied poster to ${join(dir, 'posters', posterName)}`);
}

const body = readFileSync(new URL('./event-template.md', import.meta.url), 'utf8')
  .replace(/^# Copy this file.*\n# and fill it in.*\n\n/m, '')
  .replace('title: Name of the night', `title: ${artist}`)
  .replace('artist: Artist Name', `artist: ${artist}`)
  .replace('date: 2026-12-31', `date: ${date}`)
  .replace('./posters/artist-name.jpg', `./posters/${posterName}`)
  .replace('draft: false', 'draft: true');

writeFileSync(file, body);
console.log(`Created ${file}`);
console.log('It starts as a draft: fill it in, then set "draft: false" to publish.');
if (!posterFile) console.log(`Remember to add the poster as ${join(dir, 'posters', posterName)}`);
