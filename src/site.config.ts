/**
 * Site-wide settings. Interface texts (Italian and English) live in `src/i18n/ui.ts`,
 * events in `src/content/events/`.
 */
export const site = {
  name: 'Francio House',
  url: 'https://francio.house',
  /** All event dates and times in the content files are read in this time zone. */
  timezone: 'Europe/Rome',
  /** When an event has no `end`, it is considered over this many hours after it starts. */
  defaultDurationHours: 4,

  // TODO: replace the placeholders below with the real contacts.
  contact: {
    email: 'ciao@francio.house',
    instagram: 'https://www.instagram.com/francio.house/',
    instagramHandle: '@francio.house',
  },
} as const;
