import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

/** YAML turns an unquoted `2026-10-24` into a Date (UTC midnight); keep it as a plain day. */
const day = z
  .union([z.string(), z.date()])
  .transform((v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v.trim()))
  .pipe(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD, e.g. 2026-10-24'));

const clock = z
  .union([z.string(), z.number()])
  .transform((v) => String(v).trim())
  .pipe(z.string().regex(/^\d{1,2}[:.]\d{2}$/, 'Use the format HH:MM in quotes, e.g. "21:00"'))
  .transform((v) => v.replace('.', ':').padStart(5, '0'));

const events = defineCollection({
  // Every Markdown file in src/content/events is one event. The file name becomes the URL.
  loader: glob({ pattern: '*.md', base: './src/content/events' }),
  schema: ({ image }) =>
    z.object({
      /** Name of the night, e.g. "Notturno Tropicale". */
      title: z.string(),
      /** Headliner. Shown biggest. */
      artist: z.string(),
      /** Other names on the bill. */
      lineup: z.array(z.string()).default([]),
      genre: z.string().optional(),

      date: day,
      /** When the music starts. */
      time: clock.default('21:00'),
      doors: clock.optional(),
      /** When it ends (can be after midnight). Defaults to a few hours after `time`. */
      end: clock.optional(),

      /** One or two sentences, used on cards and when sharing the link. */
      summary: z.string(),
      poster: image(),
      posterAlt: z.string().optional(),
      /** Accent colour for the event. If left out, it is picked from the poster. */
      color: z
        .string()
        .regex(/^#[0-9a-fA-F]{6}$/, 'Use a hex colour like "#ff3d7f"')
        .optional(),

      entry: z.string().default('Free entry · donations go to the artists'),
      /** A link (Instagram DM, form, email…) or a sentence. */
      rsvp: z.string().optional(),

      /** Any of: spotify, instagram, website, bandcamp, soundcloud, youtube, tickets — or your own label. */
      links: z.record(z.string(), z.string().url()).default({}),
      /** Past events: recordings, videos, live sets. */
      recordings: z.array(z.object({ label: z.string(), url: z.string().url() })).default([]),
      /** Photos from the night, stored next to the posters. */
      photos: z.array(image()).default([]),

      /** Set to true to hide an event without deleting it. */
      draft: z.boolean().default(false),
    }),
});

export const collections = { events };
