/**
 * Every piece of interface text, in Italian (the main language) and English.
 * Event texts live in the event files themselves (see README).
 */

export const langs = ['it', 'en'] as const;
export type Lang = (typeof langs)[number];
export const defaultLang: Lang = 'it';

/** "/events/x/" -> "/en/events/x/" for English, unchanged for Italian. */
export function localePath(lang: Lang, path: string): string {
  if (lang === defaultLang) return path;
  return `/${lang}${path.startsWith('/') ? path : `/${path}`}`;
}

/** The same page in the other language. */
export function switchPath(pathname: string, to: Lang): string {
  const bare = pathname.replace(/^\/en(?=\/|$)/, '') || '/';
  return localePath(to, bare);
}

const it = {
  locale: 'it-IT',
  ogLocale: 'it_IT',
  meta: {
    title: 'Francio House — concerti in una casa',
    description:
      'Una casa bianca in una strada qualunque. Dentro: una giungla dipinta, concerti intimi e serate creative.',
    h1: 'Francio House — concerti e serate creative in una casa privata',
    skipToNext: 'Vai al prossimo concerto',
  },
  lang: { other: 'en' as Lang, switchLabel: 'Read in English', short: 'EN' },
  nav: {
    home: 'Francio House, home',
    rooms: 'Stanze',
    next: 'Prossimo',
    upcoming: 'In arrivo',
    archive: 'Archivio',
    house: 'La casa',
    outside: 'Esci fuori',
    footer: 'Piè di pagina',
  },
  outside: {
    region: 'Fuori dalla casa',
    loading: 'Prepariamo la casa…',
    skip: 'Salta intro',
    enter: 'Entra in casa',
    hint: 'oppure scorri per salire',
    captions: [
      'Dalla strada, è solo una casa bianca.',
      'Muri bianchi. Tapparelle a metà. Niente da vedere.',
      'Diciotto gradini sul lato.',
      "Ascolta. C'è qualcosa dall'altra parte.",
      'Entra.',
    ],
  },
  next: {
    heading: 'Il prossimo in casa',
    tag: 'prossimo in casa ↘',
    doors: 'Porta',
    music: 'Musica',
    entry: 'Ingresso',
    where: 'Dove',
    rsvp: 'Prenota',
    details: 'Tutti i dettagli',
    calendar: 'Aggiungi al calendario',
    emptyTag: 'shhh…',
    emptyTitle: 'La casa riposa.',
    emptyText:
      "Nessun concerto in calendario per ora. Nuove date in arrivo — intanto fai un giro nell'archivio.",
    follow: 'Segui',
    archive: "L'archivio",
  },
  event: {
    where: "Casine di Ostra (AN), in una casa privata. L'indirizzo esatto arriva quando prenoti.",
    entryDefault: 'Su prenotazione',
    posterAlt: (artist: string) => `Manifesto di ${artist}`,
    photoAlt: (artist: string, date: string) => `Foto della serata di ${artist}, ${date}`,
    online: (artist: string) => `${artist} online`,
    back: 'torna dentro',
    past: "dall'archivio",
    upcoming: 'in arrivo',
    with: 'con',
    listen: 'Riascolta',
    photos: 'Dalla serata',
    more: 'Altre serate',
    earlier: 'prima',
    later: 'dopo',
    gcal: 'Google Calendar',
  },
  upcoming: {
    kicker: 'Stanza 2 · il muro rosa',
    title: ['in', 'arrivo'],
    intro:
      'I manifesti finiscono su questo muro appena una data è confermata. Ogni serata è piccola: se qualcosa ti incuriosisce, prenota presto.',
    swipe: '← scorri il muro →',
    empty: 'Ancora niente appeso — nuove date a breve.',
    more: 'dettagli →',
  },
  archive: {
    kicker: 'Stanza 3 · la stanza blu',
    title: ["l'archivio", 'della casa'],
    intro:
      'Tutte le serate passate di qui: i manifesti, qualche foto mossa e le registrazioni, quando qualcuno si è ricordato di premere rec.',
    count: (n: number, year: string) => `${n} serate dal ${year}.`,
    filter: 'Mostra anno',
    all: 'Tutti',
    listen: 'ascolta',
  },
  house: {
    kicker: 'Stanza 4 · il muro dei gufi',
    title: ['la', 'casa'],
    lede:
      'Francio House è una casa, non un locale. Dalla strada sembra uguale a tutte le altre del quartiere: muri bianchi, una scala, una porta. Dentro, i muri sono pieni di pappagalli, gufi e coccodrilli — e qualche volta al mese il salotto diventa un palco per quaranta persone.',
    how: 'Come funziona una serata',
    steps: [
      ['Prenota', "Si entra solo su prenotazione: trovi il modulo per prenotare nella pagina di ogni serata. L'indirizzo esatto arriva prima della serata."],
      ['Arriva', 'Di solito si comincia verso le 19, a Casine di Ostra. Sali la scala sul lato della casa.'],
      ['Ingresso', "Di solito 10 €, con snack e drink compresi. Il prezzo di ogni serata è sul suo manifesto."],
      ['Ascolta', "Durante i concerti si sta vicini e in silenzio: è un salotto, non un club."],
      ['Shh', 'Quando si va via, scendi le scale piano: i vicini sono amici.'],
    ],
    play: 'Suona qui',
    playText:
      'Ospitiamo artisti locali e in tour, di qualsiasi genere che stia in un salotto — acustico, elettronico, rumoroso, sottovoce. Mandaci un link e due righe su di te.',
    photosLabel: 'Foto della casa',
    photos: [
      { caption: 'il salotto', alt: "Salotto con una parete fucsia, una verde menta, quadri di pappagalli, un acquario e una lampada ad arco d'ottone." },
      { caption: 'i gufi, in giardino', alt: 'Una casetta in giardino dipinta con due enormi gufi, pini marittimi e un ponticello.' },
      { caption: 'serata di proiezioni', alt: 'Una performer con una parrucca rosa davanti a una proiezione, sotto una tenda di frange colorate.' },
      { caption: 'il coccodrillo', alt: 'Un muro rosa dipinto con un coccodrillo verde, un tucano e una banana.' },
    ],
  },
  footer: {
    line: 'Dalla strada, è solo una casa bianca.',
    outside: 'Torna fuori',
    small: 'una casa privata, siate gentili con i vicini',
  },
  lost: {
    title: ['porta', 'sbagliata'],
    text: 'Questa stanza non esiste — o la festa si è spostata altrove.',
    back: 'Torna dentro',
  },
};

export type Dict = typeof it;

const en: Dict = {
  locale: 'en-GB',
  ogLocale: 'en_GB',
  meta: {
    title: 'Francio House — concerts in a house',
    description:
      'A white house on an ordinary street. Inside: a painted jungle, intimate concerts and creative nights.',
    h1: 'Francio House — concerts and creative nights in a private house',
    skipToNext: 'Skip to the next concert',
  },
  lang: { other: 'it', switchLabel: 'Leggi in italiano', short: 'IT' },
  nav: {
    home: 'Francio House, home',
    rooms: 'Rooms',
    next: 'Next',
    upcoming: 'Upcoming',
    archive: 'Archive',
    house: 'The house',
    outside: 'Step outside',
    footer: 'Footer',
  },
  outside: {
    region: 'Outside the house',
    loading: 'Getting the house ready…',
    skip: 'Skip intro',
    enter: 'Enter the house',
    hint: 'or scroll to walk up',
    captions: [
      "From the street, it's just a white house.",
      'White walls. Shutters half down. Nothing to see.',
      'Eighteen steps up the side.',
      'Listen. Something on the other side.',
      'Come in.',
    ],
  },
  next: {
    heading: 'Next at the house',
    tag: 'next at the house ↘',
    doors: 'Doors',
    music: 'Music',
    entry: 'Entry',
    where: 'Where',
    rsvp: 'RSVP',
    details: 'Full details',
    calendar: 'Add to calendar',
    emptyTag: 'shhh…',
    emptyTitle: 'The house is resting.',
    emptyText:
      'No concerts on the calendar right now. New dates are coming — meanwhile, have a look around the archive.',
    follow: 'Follow',
    archive: 'The archive',
  },
  event: {
    where: 'Casine di Ostra (AN), in a private house. The exact address is sent when you book.',
    entryDefault: 'Booking required',
    posterAlt: (artist) => `Poster for ${artist}`,
    photoAlt: (artist, date) => `Photo from ${artist}, ${date}`,
    online: (artist) => `${artist} online`,
    back: 'back inside',
    past: 'from the archive',
    upcoming: 'coming up',
    with: 'with',
    listen: 'Listen back',
    photos: 'From the night',
    more: 'More nights',
    earlier: 'earlier',
    later: 'later',
    gcal: 'Google Calendar',
  },
  upcoming: {
    kicker: 'Room 2 · the pink wall',
    title: ['coming', 'up'],
    intro:
      'Posters go up on this wall as soon as a date is confirmed. Every night is small, so if something catches your eye, RSVP early.',
    swipe: '← swipe the wall →',
    empty: 'Nothing pinned yet — new dates soon.',
    more: 'details →',
  },
  archive: {
    kicker: 'Room 3 · the blue room',
    title: ['the house', 'archive'],
    intro:
      'Every night that happened here: the posters, a few blurry photos, and recordings when someone remembered to press record.',
    count: (n, year) => `${n} nights since ${year}.`,
    filter: 'Show year',
    all: 'All',
    listen: 'listen',
  },
  house: {
    kicker: 'Room 4 · the owl wall',
    title: ['the', 'house'],
    lede:
      'Francio House is a home, not a venue. From the street it looks like every other house on the block: white walls, a staircase, a door. Inside, the walls are covered in parrots, owls and crocodiles — and a few times a month the living room becomes a stage for forty people.',
    how: 'How a night works',
    steps: [
      ['Book', 'Entry is by booking only: each night’s page has its booking form. The exact address arrives before the night.'],
      ['Arrive', 'Things usually start around 7 pm, in Casine di Ostra. Walk up the stairs at the side of the house.'],
      ['Entry', 'Usually €10, snacks and drinks included. Each night’s price is on its poster.'],
      ['Listen', 'During the concerts we sit close and stay quiet: it’s a living room, not a club.'],
      ['Shh', 'When you leave, go down the stairs quietly — the neighbours are friends.'],
    ],
    play: 'Play here',
    playText:
      'We host touring and local artists of any genre that fits in a living room — acoustic, electronic, loud, very quiet. Send us a link and a few lines about you.',
    photosLabel: 'Photos of the house',
    photos: [
      { caption: 'the living room', alt: 'Living room with a hot pink wall, a mint green wall, parrot paintings, an aquarium and a brass arc lamp.' },
      { caption: 'the owls, in the garden', alt: 'A garden shed painted with two huge owls, stone pines and a little bridge.' },
      { caption: 'projection night', alt: 'A performer in a pink wig in front of a projection, under a colourful fringe curtain.' },
      { caption: 'the crocodile', alt: 'A pink wall painted with a green crocodile, a toucan and a banana.' },
    ],
  },
  footer: {
    line: "From the street, it's just a white house.",
    outside: 'Step back outside',
    small: 'a private home, please be kind to the neighbours',
  },
  lost: {
    title: ['wrong', 'door'],
    text: "This room doesn't exist — or the party moved somewhere else.",
    back: 'Back inside',
  },
};

export const ui: Record<Lang, Dict> = { it, en };
