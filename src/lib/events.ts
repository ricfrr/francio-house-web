import { getCollection, type CollectionEntry } from 'astro:content';
import { site } from '../site.config';
import { ui, localePath, type Lang } from '../i18n/ui';
import { zoned } from './time';
import { inkFor, posterAccent } from './accent';

type EventData = CollectionEntry<'events'>['data'];

/** An event with its texts already in one language. */
export type HouseEvent = {
  lang: Lang;
  slug: string;
  url: string;
  icsUrl: string;
  title: string;
  artist: string;
  lineup: string[];
  genre?: string;
  summary: string;
  poster: EventData['poster'];
  posterAlt: string;
  photos: EventData['photos'];
  date: string;
  time: string;
  doors?: string;
  start: Date;
  end: Date;
  entry: string;
  rsvp?: string;
  links: Record<string, string>;
  recordings: { label: string; url: string }[];
  /** The description, rendered to HTML. */
  html: string;
  accent: string;
  ink: string;
};

/** The English description follows a line containing <!-- en --> in the event file. */
const EN_MARKER = /<!--\s*en\s*-->/i;

function endOf(data: EventData, start: Date): Date {
  if (!data.end) return new Date(start.getTime() + site.defaultDurationHours * 3600_000);
  let end = zoned(data.date, data.end);
  // "end: 01:30" means the night after.
  if (end <= start) end = new Date(end.getTime() + 24 * 3600_000);
  return end;
}

async function localize(e: CollectionEntry<'events'>, lang: Lang): Promise<HouseEvent> {
  const d = e.data;
  const en = lang === 'en' ? d.en : {};
  const start = zoned(d.date, d.time);
  const accent = d.color ?? (await posterAccent(e.filePath));
  const [itHtml = '', enHtml = ''] = (e.rendered?.html ?? '').split(EN_MARKER);
  return {
    lang,
    slug: e.id,
    url: localePath(lang, `/events/${e.id}/`),
    icsUrl: localePath(lang, `/events/${e.id}.ics`),
    title: en.title ?? d.title,
    artist: d.artist,
    lineup: en.lineup ?? d.lineup,
    genre: en.genre ?? d.genre,
    summary: en.summary ?? d.summary,
    poster: d.poster,
    posterAlt: en.posterAlt ?? d.posterAlt ?? ui[lang].event.posterAlt(d.artist),
    photos: d.photos,
    date: d.date,
    time: d.time,
    doors: d.doors,
    start,
    end: endOf(d, start),
    entry: en.entry ?? d.entry ?? ui[lang].event.entryDefault,
    rsvp: en.rsvp ?? d.rsvp,
    links: d.links,
    recordings: d.recordings.map((r) => ({ label: (lang === 'en' && r.labelEn) || r.label, url: r.url })),
    html: (lang === 'en' && enHtml.trim() ? enHtml : itHtml).trim(),
    accent,
    ink: inkFor(accent),
  };
}

const cache = new Map<Lang, Promise<HouseEvent[]>>();

/** Every published event, oldest first. Drafts show up in `npm run dev` only. */
export function getEvents(lang: Lang): Promise<HouseEvent[]> {
  // cached for the build; re-read on every request while developing
  if (import.meta.env.DEV) return load(lang);
  if (!cache.has(lang)) cache.set(lang, load(lang));
  return cache.get(lang)!;
}

async function load(lang: Lang): Promise<HouseEvent[]> {
  const entries = await getCollection('events', (e) => import.meta.env.DEV || !e.data.draft);
  const events = await Promise.all(entries.map((e) => localize(e, lang)));
  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Splits events into upcoming (soonest first) and past (most recent first).
 * This runs at build time; a small script in the browser re-checks the dates,
 * and the deploy workflow rebuilds the site every night.
 */
export async function getSplitEvents(lang: Lang, now = new Date()) {
  const events = await getEvents(lang);
  const upcoming = events.filter((e) => e.end > now);
  const past = events.filter((e) => e.end <= now).reverse();
  return { upcoming, past };
}

/** Small, stable pseudo-random number per string, for rotations and offsets. */
export function seeded(key: string, min = -1, max = 1): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  const t = ((h >>> 0) % 10000) / 10000;
  return min + t * (max - min);
}

const linkLabels: Record<string, string> = {
  spotify: 'Spotify',
  instagram: 'Instagram',
  website: 'Website',
  bandcamp: 'Bandcamp',
  soundcloud: 'SoundCloud',
  youtube: 'YouTube',
  tickets: 'Tickets',
  applemusic: 'Apple Music',
};
const linkLabelsIt: Record<string, string> = { website: 'Sito', tickets: 'Biglietti' };

/** "website" -> "Sito" / "Website"; unknown keys are shown as written. */
export function linkLabel(key: string, lang: Lang): string {
  return (lang === 'it' && linkLabelsIt[key]) || linkLabels[key] || key;
}
