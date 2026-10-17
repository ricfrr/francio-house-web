import { site } from '../site.config';
import type { HouseEvent } from './events';

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** Long lines must be folded at 75 octets in .ics files. */
const fold = (line: string) => line.match(/.{1,72}/g)!.join('\r\n ');

export function eventName(e: HouseEvent) {
  return e.title === e.artist ? `${e.title} at ${site.name}` : `${e.artist} — ${e.title} at ${site.name}`;
}

export function ics(e: HouseEvent): string {
  const url = new URL(e.url, site.url).href;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Francio House//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.slug}@francio.house`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(e.start)}`,
    `DTEND:${stamp(e.end)}`,
    `SUMMARY:${escape(eventName(e))}`,
    `DESCRIPTION:${escape(`${e.summary}\n\n${site.whereNote}\n${url}`)}`,
    `LOCATION:${escape(site.name)}`,
    `URL:${url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function googleCalendarUrl(e: HouseEvent): string {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: eventName(e),
    dates: `${stamp(e.start)}/${stamp(e.end)}`,
    details: `${e.summary}\n\n${site.whereNote}\n${new URL(e.url, site.url).href}`,
    location: site.name,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
