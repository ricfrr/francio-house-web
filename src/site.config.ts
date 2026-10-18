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

  /**
   * Visitor counts, without tracking people: GoatCounter sets no cookies and stores no personal data.
   * Create a free site at goatcounter.com and put its code here (the part before ".goatcounter.com").
   * Leave it empty and nothing is loaded.
   */
  analytics: {
    goatcounter: '' as string,
  },

  /**
   * Contacts. Leave a field empty ('') and it is simply not shown anywhere.
   * Fill them in when they exist, e.g.
   *   email: 'ciao@francio.house',
   *   instagram: 'https://www.instagram.com/francio.house/',
   *   instagramHandle: '@francio.house',
   */
  contact: {
    email: '' as string,
    instagram: '' as string,
    instagramHandle: '' as string,
  },
} as const;
