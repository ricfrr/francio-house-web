import { site } from '../site.config';
import { ui } from '../i18n/ui';
import type { HouseEvent } from './events';

const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

const escape = (s: string) => s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');

/** Long lines must be folded at 75 bytes in .ics files (accented letters take 2). */
function fold(line: string): string {
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (bytes + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

export function eventName(e: HouseEvent) {
  return e.title === e.artist ? `${e.title} @ ${site.name}` : `${e.artist} — ${e.title} @ ${site.name}`;
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
    `DESCRIPTION:${escape(`${e.summary}\n\n${ui[e.lang].event.where}\n${url}`)}`,
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
    details: `${e.summary}\n\n${ui[e.lang].event.where}\n${new URL(e.url, site.url).href}`,
    location: site.name,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}
