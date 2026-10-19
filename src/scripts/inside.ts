/**
 * Small behaviours for the inside of the house. Everything here is optional:
 * the site works and reads fine without it.
 */

import { relativeWords } from '../i18n/relative';

const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

// ---------------- dates: keep next, upcoming and archive in sync between builds ----------------

function relative(start: Date, end: Date, now: Date): string | null {
  const w = document.documentElement.lang === 'en' ? relativeWords.en : relativeWords.it;
  if (now >= start && now < end) return w.now;
  const day = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((day(start) - day(now)) / 86_400_000);
  if (days < 0) return null;
  if (days === 0) return w.tonight;
  if (days === 1) return w.tomorrow;
  if (days < 14) return w.days(days);
  if (days < 60) return w.weeks(Math.round(days / 7));
  return w.months(Math.round(days / 30));
}

export function refreshDates(now = new Date()) {
  document.querySelectorAll<HTMLElement>('[data-ends]').forEach((el) => {
    el.classList.toggle('is-over', new Date(el.dataset.ends!) <= now);
  });

  // the hero shows the first candidate that hasn't ended yet
  const slots = [...document.querySelectorAll<HTMLElement>('[data-slot]')];
  const live = slots.find((s) => !s.classList.contains('is-over'));
  if (slots.length) {
    slots.forEach((s) => (s.hidden = s !== live));
    const empty = document.querySelector<HTMLElement>('[data-slot-empty]');
    if (empty) empty.hidden = !!live;
  }

  // A promoted hero must not also remain on the upcoming wall.
  const cards = [...document.querySelectorAll<HTMLElement>('[data-wall] [data-event]')];
  cards.forEach((card) => {
    card.hidden = card.classList.contains('is-over') || card.dataset.event === live?.dataset.event;
  });
  const wallEmpty = !cards.some((card) => !card.hidden);
  const upcomingEmpty = document.querySelector<HTMLElement>('[data-upcoming-empty]');
  if (upcomingEmpty) upcomingEmpty.hidden = !wallEmpty;
  const wallHint = document.querySelector<HTMLElement>('[data-wall-hint]');
  if (wallHint) wallHint.hidden = wallEmpty;

  refreshArchive(now);

  document.querySelectorAll<HTMLElement>('[data-rel]').forEach((el) => {
    const text = relative(new Date(el.dataset.rel!), new Date(el.dataset.relEnd ?? el.dataset.rel!), now);
    if (text) el.textContent = text;
  });
}

function refreshArchive(now: Date) {
  const archive = document.getElementById('archive');
  if (!archive) return;

  archive.querySelectorAll<HTMLElement>('[data-archive-end]').forEach((item) => {
    item.hidden = new Date(item.dataset.archiveEnd!) > now;
  });
  const past = [...archive.querySelectorAll<HTMLElement>('[data-archive-event]')].filter((item) => !item.hidden);
  const summary = archive.querySelector<HTMLElement>('[data-archive-summary]');
  if (summary) summary.hidden = !past.length;
  const count = archive.querySelector<HTMLElement>('[data-archive-count]');
  if (count) count.textContent = String(past.length);
  const firstYear = archive.querySelector<HTMLElement>('[data-archive-first-year]');
  if (firstYear) firstYear.textContent = past.at(-1)?.closest<HTMLElement>('[data-year]')?.dataset.year ?? '';

  const years = [...archive.querySelectorAll<HTMLElement>('[data-year]')];
  const pastYears = new Set(years.filter((year) => year.querySelector('[data-archive-event]:not([hidden])')).map((year) => year.dataset.year!));
  const filters = archive.querySelector<HTMLElement>('[data-filters]');
  if (filters) {
    filters.hidden = pastYears.size < 2;
    filters.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((button) => {
      button.hidden = button.dataset.filter !== 'all' && !pastYears.has(button.dataset.filter!);
    });
  }
  const selected = filters?.querySelector<HTMLElement>('[aria-pressed="true"]')?.dataset.filter ?? 'all';
  years.forEach((year) => {
    year.hidden = !pastYears.has(year.dataset.year!) || (selected !== 'all' && selected !== year.dataset.year);
  });
}

// ---------------- top bar ----------------

function topbar() {
  const bar = document.querySelector<HTMLElement>('[data-topbar]');
  if (!bar) return;
  const update = () => bar.classList.toggle('is-scrolled', window.scrollY > 40 && document.documentElement.dataset.mode !== 'outside');
  update();
  window.addEventListener('scroll', update, { passive: true });
  document.addEventListener('house:inside', update);

  // highlight the room you're in
  const links = new Map<string, HTMLAnchorElement>();
  bar.querySelectorAll<HTMLAnchorElement>('.rooms a').forEach((a) => links.set(a.hash.slice(1), a));
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        links.forEach((a, id) => a.setAttribute('aria-current', String(id === e.target.id)));
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );
  links.forEach((_, id) => {
    const el = document.getElementById(id);
    if (el) io.observe(el);
  });
}

// ---------------- reveal on scroll ----------------

function reveals() {
  const els = document.querySelectorAll<HTMLElement>('[data-reveal], [data-jaw]');
  if (!('IntersectionObserver' in window) || reduceMotion.matches) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      }
    },
    { rootMargin: '0px 0px -8% 0px' },
  );
  els.forEach((el) => io.observe(el));
}

// ---------------- posters that lean towards the pointer ----------------

function tilt() {
  document.querySelectorAll<HTMLElement>('[data-tilt]').forEach((el) => {
    let frame = 0;
    el.addEventListener('pointermove', (e) => {
      if (!finePointer.matches || reduceMotion.matches) return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width;
        const y = (e.clientY - r.top) / r.height;
        el.style.setProperty('--ty', `${(x - 0.5) * 14}deg`);
        el.style.setProperty('--tx', `${(0.5 - y) * 12}deg`);
        el.style.setProperty('--sx', `${x * 100}%`);
        el.style.setProperty('--sy', `${y * 100}%`);
        el.style.setProperty('--shine', '1');
        el.classList.add('is-tilting');
      });
    });
    el.addEventListener('pointerleave', () => {
      cancelAnimationFrame(frame);
      el.style.setProperty('--tx', '0deg');
      el.style.setProperty('--ty', '0deg');
      el.style.setProperty('--shine', '0');
      el.classList.remove('is-tilting');
    });
  });
}

// ---------------- the owl watches you ----------------

function owls() {
  const owls = [...document.querySelectorAll<SVGElement>('[data-owl]')];
  if (!owls.length || reduceMotion.matches) return;
  const look = (x: number, y: number) => {
    for (const owl of owls) {
      const r = owl.getBoundingClientRect();
      if (r.bottom < -200 || r.top > innerHeight + 200) continue;
      const dx = x - (r.left + r.width / 2);
      const dy = y - (r.top + r.height * 0.45);
      const len = Math.max(1, Math.hypot(dx, dy));
      const k = Math.min(1, len / 400);
      owl.style.setProperty('--px', ((dx / len) * k).toFixed(3));
      owl.style.setProperty('--py', ((dy / len) * k).toFixed(3));
    }
  };
  if (finePointer.matches) {
    window.addEventListener('pointermove', (e) => look(e.clientX, e.clientY), { passive: true });
  } else {
    // on touch screens it glances around on its own
    window.setInterval(() => look(Math.random() * innerWidth, Math.random() * innerHeight), 2200);
  }
}

// ---------------- parallax: painted animals drift a little slower than the wall ----------------

function parallax() {
  const els = [...document.querySelectorAll<HTMLElement | SVGElement>('[data-parallax]')];
  if (!els.length || reduceMotion.matches) return;
  let ticking = false;
  const update = () => {
    ticking = false;
    if (document.documentElement.dataset.mode === 'outside') return;
    for (const el of els) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -100 || r.top > innerHeight + 100) continue;
      const centre = r.top + r.height / 2 - innerHeight / 2;
      const k = Number(el.dataset.parallax) || 0.1;
      el.style.translate = `0 ${(-centre * k).toFixed(1)}px`;
    }
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true },
  );
  update();
}

// ---------------- anonymous click counts (only does something when GoatCounter is configured) ----------------

type GoatCounter = { count?: (o: { path: string; title?: string; event?: boolean }) => void };

function tracking() {
  document.addEventListener(
    'click',
    (e) => {
      const el = (e.target as Element | null)?.closest<HTMLElement>('[data-track]');
      const name = el?.dataset.track;
      if (!name) return;
      (window as unknown as { goatcounter?: GoatCounter }).goatcounter?.count?.({ path: name, title: name, event: true });
    },
    { capture: true },
  );
}

// ---------------- archive filters ----------------

function filters() {
  const group = document.querySelector<HTMLElement>('[data-filters]');
  if (!group) return;
  group.addEventListener('click', (e) => {
    const btn = (e.target as Element).closest<HTMLButtonElement>('[data-filter]');
    if (!btn) return;
    group.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    refreshDates();
  });
}

export function initInside() {
  refreshDates();
  // keep things honest if the page stays open across midnight
  window.setInterval(() => refreshDates(), 60_000);
  topbar();
  reveals();
  tilt();
  owls();
  parallax();
  filters();
  tracking();
}
