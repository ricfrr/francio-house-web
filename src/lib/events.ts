import { getCollection, type CollectionEntry } from 'astro:content';
import { site } from '../site.config';
import { zoned } from './time';
import { inkFor, posterAccent } from './accent';

type EventData = CollectionEntry<'events'>['data'];

export type HouseEvent = Omit<EventData, 'end'> & {
  slug: string;
  body: string;
  start: Date;
  end: Date;
  doorsAt?: Date;
  accent: string;
  ink: string;
  url: string;
};

function endOf(data: EventData, start: Date): Date {
  if (!data.end) return new Date(start.getTime() + site.defaultDurationHours * 3600_000);
  let end = zoned(data.date, data.end);
  // "end: 01:30" means the night after.
  if (end <= start) end = new Date(end.getTime() + 24 * 3600_000);
  return end;
}

let all: Promise<HouseEvent[]> | undefined;

/** Every published event, oldest first. Drafts show up in `npm run dev` only. */
export function getEvents(): Promise<HouseEvent[]> {
  // cached for the build; re-read on every request while developing
  if (import.meta.env.DEV) return load();
  return (all ??= load());
}

async function load(): Promise<HouseEvent[]> {
  const entries = await getCollection('events', (e) => import.meta.env.DEV || !e.data.draft);
  const events = await Promise.all(
    entries.map(async (e) => {
      const start = zoned(e.data.date, e.data.time);
      const accent = e.data.color ?? (await posterAccent(e.filePath));
      const { end: _end, ...data } = e.data;
      return {
        ...data,
        slug: e.id,
        body: e.body ?? '',
        start,
        end: endOf(e.data, start),
        doorsAt: e.data.doors ? zoned(e.data.date, e.data.doors) : undefined,
        accent,
        ink: inkFor(accent),
        url: `/events/${e.id}/`,
      } satisfies HouseEvent;
    }),
  );
  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/**
 * Splits events into upcoming (soonest first) and past (most recent first).
 * This runs at build time; a small script in the browser re-checks the dates,
 * and the deploy workflow rebuilds the site every night.
 */
export async function getSplitEvents(now = new Date()) {
  const events = await getEvents();
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

export const linkLabels: Record<string, string> = {
  spotify: 'Spotify',
  instagram: 'Instagram',
  website: 'Website',
  bandcamp: 'Bandcamp',
  soundcloud: 'SoundCloud',
  youtube: 'YouTube',
  tickets: 'Tickets',
  applemusic: 'Apple Music',
};
