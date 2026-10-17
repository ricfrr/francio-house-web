import { site } from '../site.config';
import { ui, type Lang } from '../i18n/ui';

/** Offset of `tz` from UTC at `date`, in minutes. */
function tzOffset(date: Date, tz: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return (asUtc - date.getTime()) / 60000;
}

/** "2026-10-24" + "21:00" in the site's time zone -> the real instant. */
export function zoned(day: string, clock: string, tz: string = site.timezone): Date {
  const [y, m, d] = day.split('-').map(Number);
  const [hh, mm] = clock.split(':').map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let ts = guess - tzOffset(new Date(guess), tz) * 60000;
  const corrected = guess - tzOffset(new Date(ts), tz) * 60000;
  if (corrected !== ts) ts = corrected;
  return new Date(ts);
}

const fmt = (lang: Lang, opts: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(ui[lang].locale, { timeZone: site.timezone, ...opts });

export const formatWeekday = (d: Date, lang: Lang) => fmt(lang, { weekday: 'short' }).format(d).replace('.', '');
export const formatDayMonth = (d: Date, lang: Lang) => fmt(lang, { day: 'numeric', month: 'short' }).format(d).replace('.', '');
export const formatLong = (d: Date, lang: Lang) =>
  fmt(lang, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(d);
export const formatYear = (d: Date) => fmt('it', { year: 'numeric' }).format(d);
export const formatShort = (d: Date) => fmt('it', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(d);
