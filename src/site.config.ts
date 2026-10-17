/**
 * Site-wide settings. Everything a non-developer might want to change lives here
 * or in `src/content/events/`.
 */
export const site = {
  name: 'Francio House',
  url: 'https://francio.house',
  description:
    'A white house on an ordinary street. Inside: a painted jungle, intimate concerts and creative nights.',

  /** All event dates and times in the content files are read in this time zone. */
  timezone: 'Europe/Rome',
  /** Locale used to format dates ("Sat 24 Oct"). */
  locale: 'en-GB',
  /** When an event has no `end`, it is considered over this many hours after it starts. */
  defaultDurationHours: 4,

  // TODO: replace the placeholders below with the real contacts.
  contact: {
    email: 'ciao@francio.house',
    instagram: 'https://www.instagram.com/francio.house/',
    instagramHandle: '@francio.house',
  },
  /** Shown on every event. The house is private: the address goes out with the RSVP. */
  whereNote: 'A private house in town. The address is sent when you RSVP.',
} as const;
