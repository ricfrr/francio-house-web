#!/usr/bin/env node
/**
 * A local dashboard for the GoatCounter numbers.
 *
 *   npm run stats            real data (needs a read-only API token, see README)
 *   npm run stats -- --demo  made-up data, to see how it looks
 *
 * It runs on your computer only (http://localhost:4400). The token is read from the environment or
 * from `.env.local` (never committed) and is never sent to the browser.
 */
import http from 'node:http';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const demo = process.argv.includes('--demo');
const port = Number(process.env.PORT || 4400);

// ---------- settings ----------
const envFile = join(root, '.env.local');
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
const code = process.env.GOATCOUNTER_CODE || readFileSync(join(root, 'src/site.config.ts'), 'utf8').match(/goatcounter:\s*'([^']*)'/)?.[1];
const token = process.env.GOATCOUNTER_TOKEN;
if (!demo && (!code || !token)) {
  console.error(`
Mancano le impostazioni. Per vedere i numeri veri:
  1. apri https://${code || '<il-tuo-codice>'}.goatcounter.com → il tuo nome (in alto a destra) → API → "Create new token",
     spunta "Read statistics" e copia la chiave;
  2. crea un file chiamato .env.local in questa cartella, con una sola riga:
         GOATCOUNTER_TOKEN=incolla-qui-la-chiave
  3. lancia di nuovo npm run stats.
Per vedere solo come appare il cruscotto: npm run stats -- --demo
`);
  process.exit(1);
}

// ---------- event names, so pages show "Marea Alta" instead of a file name ----------
function eventNames() {
  const dir = join(root, 'src/content/events');
  const out = {};
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.md')) continue;
    const s = readFileSync(join(dir, f), 'utf8');
    const artist = s.match(/^artist:\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, '');
    if (artist) out[f.replace(/\.md$/, '')] = artist;
  }
  return out;
}

// ---------- GoatCounter API ----------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function gc(path, params = {}) {
  const url = new URL(`https://${code}.goatcounter.com/api/v0${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url, { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } });
    if (r.status === 429) {
      await sleep((Number(r.headers.get('x-rate-limit-reset')) || 1) * 1000 + 250);
      continue;
    }
    if (!r.ok) throw new Error(`${path} → HTTP ${r.status}${r.status === 403 ? ' (does the token have "Read statistics"?)' : r.status === 401 ? ' (wrong token)' : ''}`);
    await sleep(260); // the API allows 4 requests per second
    return r.json();
  }
  throw new Error(`${path} → rate limited`);
}

const iso = (d) => d.toISOString().replace(/\.\d+Z$/, 'Z');

async function collectReal(days) {
  const end = new Date();
  end.setMinutes(0, 0, 0);
  end.setHours(end.getHours() + 1);
  const start = new Date(end);
  start.setDate(start.getDate() - days);
  const range = { start: iso(start), end: iso(end) };
  const warnings = [];
  const safe = async (name, fn) => {
    try {
      return await fn();
    } catch (e) {
      warnings.push(e.message);
      return null;
    }
  };

  const hits = await gc('/stats/hits', { ...range, limit: 100 });
  const total = await safe('total', () => gc('/stats/total', range));
  const side = {};
  for (const page of ['toprefs', 'locations', 'systems', 'browsers', 'sizes', 'languages']) {
    side[page] = (await safe(page, () => gc(`/stats/${page}`, { ...range, limit: 12 })))?.stats ?? [];
  }
  return { hits: hits.hits ?? [], total, side, warnings, range, days };
}

// ---------- made-up data for --demo ----------
function collectDemo(days) {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const names = eventNames();
  const slugs = Object.keys(names);
  const dayKey = (i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    return d.toISOString().slice(0, 10);
  };
  const series = Array.from({ length: days }, (_, i) => {
    const wd = new Date(dayKey(i)).getDay();
    const base = 14 + (wd === 5 || wd === 6 ? 14 : 0) + (i > days - 6 ? 22 : 0);
    return Math.round(base * (0.6 + rnd()));
  });
  const stats = series.map((n, i) => ({ day: dayKey(i), daily: n, hourly: [] }));
  const mkPage = (path, title, count) => ({ path, title, count, event: false, path_id: 0, stats: [] });
  const homeIt = Math.round(series.reduce((a, b) => a + b, 0) * 0.62);
  const homeEn = Math.round(homeIt * 0.14);
  const hits = [mkPage('/', 'Francio House', homeIt), mkPage('/en/', 'Francio House', homeEn)];
  slugs.slice(-8).forEach((s, i) => {
    hits.push(mkPage(`/events/${s}/`, names[s], Math.round(homeIt * (0.28 - i * 0.025))));
    if (i < 4) hits.push(mkPage(`/en/events/${s}/`, names[s], Math.round(homeEn * (0.3 - i * 0.05))));
  });
  const ev = (path, count) => ({ path, title: path, count, event: true, path_id: 0, stats: [] });
  hits.push(ev('intro-enter', Math.round(homeIt * 0.46)), ev('intro-skip', Math.round(homeIt * 0.17)), ev('step-outside', Math.round(homeIt * 0.06)), ev('lang-switch', Math.round(homeIt * 0.09)));
  slugs.slice(-4).forEach((s, i) => {
    hits.push(ev(`rsvp-${s}`, Math.round(34 - i * 8)), ev(`calendar-${s}`, Math.round(12 - i * 2)));
  });
  hits.push(ev('artist-link-spotify', 41), ev('artist-link-instagram', 29), ev('artist-link-bandcamp', 17), ev('artist-link-youtube', 9));
  const list = (rows) => rows.map(([name, count], i) => ({ id: String(i), name, count }));
  return {
    hits,
    total: { total: series.reduce((a, b) => a + b, 0), total_events: 280, stats },
    side: {
      toprefs: list([['Instagram', 212], ['WhatsApp', 148], ['(direct)', 120], ['google.com', 61], ['facebook.com', 18]]),
      locations: list([['Italy', 520], ['Germany', 41], ['United States', 22], ['France', 14], ['Netherlands', 9]]),
      systems: list([['iOS', 330], ['Android', 180], ['macOS', 90], ['Windows', 44], ['Linux', 6]]),
      browsers: list([['Safari', 340], ['Chrome', 262], ['Firefox', 21], ['Samsung Browser', 14], ['Edge', 9]]),
      sizes: list([['Phones', 410], ['Large phones, small tablets', 120], ['Computer monitors', 110]]),
      languages: list([['Italian', 560], ['English', 70], ['German', 12], ['French', 8]]),
    },
    warnings: [],
    range: {},
    days,
    demo: true,
  };
}

// ---------- turn raw API data into what the page draws ----------
function shape(raw) {
  const names = eventNames();
  const days = raw.days;
  const label = (path) => {
    const en = path === '/en' || path.startsWith('/en/');
    const p = en ? path.replace(/^\/en/, '') || '/' : path;
    const lang = en ? 'EN' : 'IT';
    if (p === '/') return `Home · ${lang}`;
    const m = p.match(/^\/events\/([^/.]+)/);
    if (m) return `${names[m[1]] ?? m[1]} · ${lang}`;
    return path;
  };
  const pages = raw.hits.filter((h) => !h.event).map((h) => ({ path: h.path, label: label(h.path), count: h.count }));
  const events = raw.hits.filter((h) => h.event).map((h) => ({ name: h.path, count: h.count }));

  // visits per day: from the total series (includes events), minus nothing: shown as "visits"
  // (summed from the pages themselves, so clicks on buttons are not counted as visits)
  const perDay = new Map();
  const pageHits = raw.hits.filter((h) => !h.event && h.stats?.length);
  if (pageHits.length) {
    for (const h of pageHits) for (const st of h.stats) perDay.set(st.day.slice(0, 10), (perDay.get(st.day.slice(0, 10)) ?? 0) + (st.daily ?? 0));
  } else {
    for (const s of raw.total?.stats ?? []) perDay.set(s.day.slice(0, 10), s.daily ?? 0);
  }
  const daily = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = d.toISOString().slice(0, 10);
    daily.push({ day: k, count: perDay.get(k) ?? 0 });
  }

  const sumEvents = (prefix) => events.filter((e) => e.name.startsWith(prefix));
  const nameOf = (slug) => names[slug] ?? slug;
  const homeVisits = pages.filter((p) => p.path === '/' || p.path === '/en/' || p.path === '/en').reduce((a, p) => a + p.count, 0);
  const itVisits = pages.filter((p) => !(p.path === '/en' || p.path.startsWith('/en/'))).reduce((a, p) => a + p.count, 0);
  const enVisits = pages.filter((p) => p.path === '/en' || p.path.startsWith('/en/')).reduce((a, p) => a + p.count, 0);
  const get = (n) => events.find((e) => e.name === n)?.count ?? 0;

  return {
    demo: !!raw.demo,
    days,
    code,
    generatedAt: new Date().toISOString(),
    warnings: raw.warnings,
    totalVisits: pages.reduce((a, p) => a + p.count, 0),
    totalEvents: events.reduce((a, e) => a + e.count, 0),
    daily,
    pages: pages.sort((a, b) => b.count - a.count).slice(0, 14),
    homeVisits,
    itVisits,
    enVisits,
    intro: { enter: get('intro-enter'), skip: get('intro-skip'), outside: get('step-outside'), lang: get('lang-switch') },
    rsvp: sumEvents('rsvp-').map((e) => ({ label: nameOf(e.name.slice(5)), count: e.count })).sort((a, b) => b.count - a.count),
    calendar: sumEvents('calendar-').map((e) => ({ label: nameOf(e.name.slice(9)), count: e.count })).sort((a, b) => b.count - a.count),
    links: sumEvents('artist-link-').map((e) => ({ label: e.name.slice(12), count: e.count })).sort((a, b) => b.count - a.count),
    refs: raw.side.toprefs,
    countries: raw.side.locations,
    systems: raw.side.systems,
    browsers: raw.side.browsers,
    sizes: raw.side.sizes,
    languages: raw.side.languages,
  };
}

// ---------- server ----------
const cache = new Map();
async function data(days) {
  const hit = cache.get(days);
  if (hit && Date.now() - hit.at < 60_000) return hit.value;
  const value = shape(demo ? collectDemo(days) : await collectReal(days));
  cache.set(days, { at: Date.now(), value });
  return value;
}

const fonts = {
  '/fonts/bricolage.woff2': 'node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-standard-normal.woff2',
  '/fonts/mono-400.woff2': 'node_modules/@fontsource/space-mono/files/space-mono-latin-400-normal.woff2',
  '/fonts/mono-700.woff2': 'node_modules/@fontsource/space-mono/files/space-mono-latin-700-normal.woff2',
  '/fonts/marker.woff2': 'node_modules/@fontsource/permanent-marker/files/permanent-marker-latin-400-normal.woff2',
};

http
  .createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://localhost:${port}`);
    try {
      if (url.pathname === '/') {
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(readFileSync(join(root, 'scripts/stats-dashboard.html')));
      }
      if (url.pathname === '/api/data') {
        const days = [7, 30, 90].includes(Number(url.searchParams.get('days'))) ? Number(url.searchParams.get('days')) : 30;
        if (url.searchParams.has('fresh')) cache.delete(days);
        const body = JSON.stringify(await data(days));
        res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(body);
      }
      const appFile = url.pathname.slice(1);
      if (/^[\w.-]+$/.test(appFile) && existsSync(join(root, 'scripts/stats-app', appFile))) {
        const types = { svg: 'image/svg+xml', png: 'image/png', js: 'text/javascript; charset=utf-8', webmanifest: 'application/manifest+json' };
        res.writeHead(200, { 'Content-Type': types[appFile.split('.').pop()] ?? 'application/octet-stream', 'Cache-Control': 'no-cache' });
        return res.end(readFileSync(join(root, 'scripts/stats-app', appFile)));
      }
      if (fonts[url.pathname]) {
        res.writeHead(200, { 'Content-Type': 'font/woff2', 'Cache-Control': 'max-age=86400' });
        return res.end(readFileSync(join(root, fonts[url.pathname])));
      }
      res.writeHead(404).end('not found');
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  })
  .listen(port, '127.0.0.1', () => {
    console.log(`\n  Francio House stats${demo ? ' (demo data)' : ''}: http://localhost:${port}\n  Stop with Ctrl+C.\n`);
  });
