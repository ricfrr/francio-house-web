# Francio House — francio.house

> From the street, it's just a white house. Inside: a painted jungle, and live music.

The website for Francio House. Visitors arrive on an ordinary street in front of a plain white
house, walk up the outside stairs and go through the door. The door opens onto the actual website:
the next concert, posters pinned to the wall, and an archive of every night that has happened here.

- **Static site** built with [Astro](https://astro.build). No server, no database, no CMS.
- **Events are Markdown files.** Add a poster and a small text file, push, and the site rebuilds.
- **The street scene** is a small [three.js](https://threejs.org) scene built from code (no 3D models
  to download). It only loads for first-time visitors.
- **Bilingual:** Italian at `francio.house/`, English at `francio.house/en/`, with an IT/EN switch on every page.
- **Hosted on GitHub Pages** at `francio.house`, deployed by GitHub Actions.

---

## Contents

1. [Run it locally](#run-it-locally)
2. [Add a concert](#add-a-concert)
   - [Italian and English](#italian-and-english)
3. [Edit, hide or remove a concert](#edit-hide-or-remove-a-concert)
4. [Posters and photos](#posters-and-photos)
5. [How dates work](#how-dates-work)
6. [Site settings](#site-settings)
7. [Deploying to GitHub Pages and francio.house](#deploying-to-github-pages-and-franciohouse)
8. [How the site is put together](#how-the-site-is-put-together)
9. [The intro: who sees it and when](#the-intro-who-sees-it-and-when)

---

## Run it locally

You need [Node.js](https://nodejs.org) 20.3 or newer (22 recommended).

```bash
npm install
```

```bash
npm run dev
```

Open http://localhost:4321. The page reloads as you edit files.

| Command | What it does |
| --- | --- |
| `npm run dev` | Local preview with live reload. Draft events are visible here. |
| `npm run build` | Checks every event file for mistakes, then builds the site into `dist/`. |
| `npm run preview` | Serves the built `dist/` folder, exactly as it will be online. |
| `npm run new-event -- "Artist" 2026-12-31 poster.jpg` | Creates a new event file (as a draft) and copies the poster. |

Useful URLs while testing:

- `/en/`: the English version.
- `/?intro`: always show the street intro, even if you've been inside before.
- `/?inside`: skip the intro.

---

## Add a concert

Every event is **one Markdown file** in `src/content/events/`, plus its **poster** in
`src/content/events/posters/`.

### The quick way

```bash
npm run new-event -- "Marea Alta" 2026-10-24 ~/Downloads/marea-alta-poster.jpg
```

This copies the poster into `posters/` and creates `src/content/events/2026-10-24-marea-alta.md`
from the template, marked as a draft. Open the file, fill it in, change `draft: true` to
`draft: false`, and push.

### By hand (also works from github.com)

1. Upload the poster to `src/content/events/posters/`, e.g. `marea-alta.jpg`.
2. Create `src/content/events/2026-10-24-marea-alta.md`. The file name becomes the page address:
   `francio.house/events/2026-10-24-marea-alta/`.
3. Paste and fill in:

```markdown
---
title: Notturno Tropicale
artist: Marea Alta
lineup: [Gufo Blu (DJ set)]
genre: dream-pop · tropicália
date: 2026-10-24
time: "21:00"
doors: "20:30"
end: "00:30"
poster: ./posters/marea-alta.jpg
posterAlt: Strisce psichedeliche ondulate con la scritta Marea Alta che si scioglie al centro.
summary: Un quartetto della costa con un debole per i dischi brasiliani e le drum machine rotte.
entry: Ingresso libero · il cappello gira per la band
rsvp: https://docs.google.com/forms/d/e/.../viewform
links:
  spotify: https://open.spotify.com/artist/...
  instagram: https://www.instagram.com/...
  bandcamp: https://....bandcamp.com/
en:
  posterAlt: Wavy psychedelic stripes with the words Marea Alta melting across the middle.
  summary: A four-piece from the coast with a weakness for Brazilian records and broken drum machines.
  entry: Free entry · hat goes round for the band
---

Il testo lungo in italiano, in Markdown normale.

<!-- en -->

The longer description in English.
```

4. Commit and push to `main`. The site is live again about a minute later.

The full template with comments is in [`scripts/event-template.md`](scripts/event-template.md).

### Italian and English

Italian is the main language: the normal fields (`title`, `summary`, `posterAlt`, `entry`, …) and the text
are in Italian. For the English page (`/en/events/…`):

- put the English versions of any field under `en:` — `title`, `summary`, `posterAlt`, `entry`,
  `genre`, `rsvp`, `lineup`;
- write the English description **after a line containing only `<!-- en -->`**;
- recordings can have an English label with `labelEn`.

Everything is optional: whatever has no English version is simply shown in Italian on the English page.
Names, dates, links, posters and photos are shared by both languages.

Interface texts (menus, buttons, "the house" section, the captions on the street…) are all in
[`src/i18n/ui.ts`](src/i18n/ui.ts), Italian first and English below.

### All the fields

| Field | Required | Notes |
| --- | --- | --- |
| `title` | yes | Name of the night (Italian). Can be the same as `artist`. |
| `artist` | yes | The headliner; shown biggest. |
| `lineup` | | Other names on the bill: `[Name One, Name Two]`. |
| `genre` | | One short line. |
| `date` | yes | `YYYY-MM-DD`. |
| `time` | | When the music starts, **in quotes**: `"21:00"`. Default `"21:00"`. |
| `doors` | | `"20:30"`. |
| `end` | | `"00:30"`. Times before the start time count as after midnight. Without it, an event is considered over 4 hours after it starts. |
| `poster` | yes | `./posters/file-name.jpg`. No spaces in file names. |
| `posterAlt` | | One sentence describing the poster, for screen readers. Strongly recommended. |
| `color` | | Accent colour like `"#ff3d7f"`. If left out, it's picked from the poster automatically. |
| `summary` | yes | One or two sentences. Used on cards and in link previews (WhatsApp, Instagram…). |
| `entry` | | Default: "Ingresso libero · le offerte vanno agli artisti" / "Free entry · donations go to the artists". |
| `rsvp` | | A link (e.g. the Google Form for that night) shows a **Prenota / RSVP** button. Plain text ("Su prenotazione") is shown as-is. |
| `links` | | Any of `spotify`, `instagram`, `website`, `bandcamp`, `soundcloud`, `youtube`, `applemusic`, `tickets`. Other names work too and are shown as written. |
| `recordings` | | For past events: a list of `label` (+ optional `labelEn`) + `url`. Shows a "listen" badge in the archive. |
| `photos` | | For past events: a list of image paths, e.g. `./photos/marea-alta-1.jpg`. |
| `en` | | English versions of `title`, `summary`, `posterAlt`, `entry`, `genre`, `rsvp`, `lineup`. |
| `draft` | | `true` hides the event on the live site (it still shows in `npm run dev`). |

If something is wrong (a missing poster, a date in the wrong format), `npm run build` stops and
says which file and which field. GitHub Actions does the same check, so a broken file can't break
the live site: the previous version simply stays online.

---

## Edit, hide or remove a concert

- **Edit:** change the Markdown file and push.
- **Hide temporarily:** set `draft: true`.
- **Remove:** delete the `.md` file (and its poster, if nothing else uses it).
- **Postponed?** Change `date` / `time`. If you rename the file, the page address changes too.
- **After the night:** nothing to do. The event moves into the archive on its own (see below).
  Add `photos` and `recordings` whenever you have them.

For archived events, keep the description and summary short in both languages. Leave out times,
prices, food and booking details already on the poster; keep the structured fields for the event record.
A couple of sentences about the artist, a curiosity or a record are enough. Link to releases, reviews
or videos when you have a source, rather than adding a full biography or technical background.

---

## Posters and photos

- Any format works. Portrait, square, landscape, A3, Instagram 4:5. The layout adapts to each poster.
- JPG or PNG, ideally **at least 1200px wide**. Bigger is fine: images are resized and converted to
  WebP automatically at build time, and only the size each screen needs is downloaded.
- To replace a poster, overwrite the file with a new one **with the same name**, or upload a new
  file and update `poster:`.
- Photos from a night go in `src/content/events/photos/` and are listed under `photos:`.
- The pictures of the house in "the house" section live in `src/assets/house/`
  (see `src/components/HouseRoom.astro`).

---

## How dates work

- All dates and times are read in the **Europe/Rome** time zone (change it in `src/site.config.ts`).
- At build time, events that haven't ended yet go into **Next** (the first one) and **Coming up**
  (the rest). Events that have ended go into **the archive**, newest first.
- The deploy workflow **rebuilds the site every night** (03:30 UTC), so finished events move to the
  archive without anyone pushing anything.
- The page also re-checks dates in the visitor's browser, so a concert that ended a few hours ago
  never shows as "next", even before the nightly rebuild.
- "in 7 days", "tomorrow" and "tonight" labels are computed live in the browser.

> GitHub pauses scheduled workflows in repositories with no activity for 60 days. If the archive
> stops updating by itself, push anything or run the workflow by hand (Actions → Deploy → Run workflow).

---

## Site settings

`src/site.config.ts` holds the things that aren't events:

- contact email and Instagram: empty for now, so they're hidden everywhere; fill them in and they appear
  (footer, "Play here" box, empty-calendar message),
- time zone and default event length.

All interface texts, in both languages, are in `src/i18n/ui.ts`: the "where" note shown on every
event, the "the house" section, how a night works, the captions on the street, buttons and menus.

---

## Visitor counts (GoatCounter)

The site can count visits **without tracking people**: [GoatCounter](https://www.goatcounter.com) sets no cookies and stores no
personal data, so it doesn't need a cookie banner (it's still polite to mention it in a privacy note).

1. Create a free site at goatcounter.com. Its code is the part before `.goatcounter.com` (e.g. `francio`).
2. Put it in `src/site.config.ts` → `analytics.goatcounter`, commit and push. While it's empty, nothing is loaded.

You'll see visits per page, where visitors came from, country, device and browser. On top of that, these clicks are counted
as events (names in the dashboard): `intro-enter` (doorbell), `intro-skip`, `step-outside`, `lang-switch`,
`rsvp-<event>` (booking button), `calendar-<event>`, `artist-link-<site>`. To count another button, add `data-track="name"` to it.

### A nicer, local dashboard

GoatCounter's own page is functional but plain, so there's a dashboard of our own that reads the same numbers: visits per day,
top pages (with the artist's name), where people come from, the intro funnel (doorbell vs skip), booking and calendar clicks per night,
countries, devices, browsers, Italian vs English. It runs **only on your computer**.

```bash
npm run stats
```

Open http://localhost:4400. The first time it needs a read-only key: on goatcounter.com click your name (top right) → API →
"Create new token", tick **Read statistics**, then put it in a file called `.env.local` in the project folder (git ignores it, so it's never published):

```
GOATCOUNTER_TOKEN=paste-the-token-here
```

`npm run stats -- --demo` shows the dashboard with made-up data. Visitors' text (referrers, paths) is always shown as plain text, never as HTML.

---

## Deploying to GitHub Pages and francio.house

The workflow in `.github/workflows/deploy.yml` builds and publishes the site on every push to
`main`, every night, and on demand.

### One-time setup

1. **Push this repository to GitHub.**
2. **Settings → Pages → Build and deployment → Source:** choose **GitHub Actions**.
3. **Settings → Pages → Custom domain:** enter `francio.house` and save.
   (The file `public/CNAME` already contains the domain, so it survives every deploy.)
4. **At your domain registrar**, add these DNS records for `francio.house`:

   | Type | Name | Value |
   | --- | --- | --- |
   | A | `@` | `185.199.108.153` |
   | A | `@` | `185.199.109.153` |
   | A | `@` | `185.199.110.153` |
   | A | `@` | `185.199.111.153` |
   | AAAA | `@` | `2606:50c0:8000::153` |
   | AAAA | `@` | `2606:50c0:8001::153` |
   | AAAA | `@` | `2606:50c0:8002::153` |
   | AAAA | `@` | `2606:50c0:8003::153` |
   | CNAME | `www` | `<your-github-username>.github.io` |

   Remove any other A/AAAA records on `@` (e.g. the registrar's parking page).
5. Wait for DNS to propagate (minutes to a few hours). Then, back in **Settings → Pages**, tick
   **Enforce HTTPS** once it becomes available.
6. Recommended: **verify the domain** for your account (GitHub → Settings → Pages → Add a domain)
   so nobody else can claim it.

After that, every push to `main` deploys automatically. Watch progress in the **Actions** tab.

---

## How the site is put together

```
src/
  content/events/          ← one .md per event, + posters/ and photos/
  content.config.ts        ← the list of event fields and their rules
  site.config.ts           ← contacts, time zone, defaults
  i18n/ui.ts               ← every interface text, Italian + English
  views/Home.astro         ← the home page: street, next, coming up, archive, the house
  views/EventPage.astro    ← one page per event
  pages/                   ← the addresses: / and /en/, /events/… and /en/events/…
  components/
    Outside.astro          ← the street: captions, doorbell, fallback drawing
    intro/street.ts        ← the three.js scene (house, stairs, door, camera path)
    intro/controller.ts    ← scroll ↔ camera, doorbell autoplay, skip, step outside
    NextEvent.astro        ← the living room: magenta + mint walls, featured concert
    Upcoming.astro         ← the pink wall: posters pinned with tape
    Archive.astro          ← the blue room: the house archive collage
    HouseRoom.astro        ← the owl wall: about, how a night works, contacts
    Footer.astro           ← the terrazzo floor
    decor/                 ← painted animals, leaves, fringe curtain, string lights, drips
  lib/                     ← dates/time zones, event loading, poster colours, generated decor
  scripts/inside.ts        ← small behaviours: tilt, owl eyes, reveals, date checks
```

Design notes:

- **Rooms.** Each section is a room of the real house, with colours taken from the photos: the
  magenta/mint living room, the pink crocodile wall, the UV-blue concert room, the sky-blue owl
  wall and the terrazzo floor.
- **Posters stay themselves.** Every poster is shown whole, in its own proportions, taped to the
  wall with a "gallery label" underneath. Each event gets an accent colour from its own poster,
  so very different artwork still sits together.
- **The door is a real window onto the site.** In the 3D scene the inside of the house is drawn
  fully transparent, so when the door opens you're looking at the actual website behind the canvas.
  When the camera passes the doorway, the canvas is removed and you're simply on the page.

Performance:

- The inside of the house is plain HTML/CSS with about 4 KB of JavaScript.
- three.js (≈150 KB gzipped) is loaded **only** when the street intro is shown, and released when
  you go inside.
- The street scene paints all its textures in code (no image files) and adapts to the device: if the
  frame rate drops it lowers the resolution step by step (and hides the grass, then the shadows).
  Shadows are only redrawn when the sun or the door moves.
- Images are responsive WebP, lazy-loaded below the fold.
- Fonts are self-hosted (no requests to Google).

---

## The intro: who sees it and when

| Visitor | What happens |
| --- | --- |
| First visit | The street. Scroll to walk up the stairs, or press **Enter the house** on the doorbell. **Skip intro** (top right, or Esc) goes straight in. |
| Has been inside before | Starts inside. **Step outside** (top right / footer) replays the street. |
| Follows a link to a section (`/#archive`) or an event page | Starts inside. |
| Prefers reduced motion | The same 3D house as a still picture; entering is a simple fade. All decorative animation is off. |
| No WebGL / old device | Starts inside. |
| JavaScript disabled | The full site, no intro. |

---

## Content

The events are the real nights at the house (posters and details from the original flyers).
The photos in "the house" section are real photos of Francio House.
The contact email and Instagram in `src/site.config.ts` are empty until they exist; once filled in they show up automatically.
