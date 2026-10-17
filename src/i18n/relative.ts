/** "tonight", "in 3 days"… Kept apart from ui.ts so the browser script stays small. */
export const relativeWords = {
  it: {
    now: 'in corso',
    tonight: 'stasera',
    tomorrow: 'domani',
    days: (n: number) => `tra ${n} giorni`,
    weeks: (n: number) => `tra ${n} settimane`,
    months: (n: number) => `tra ${n} mesi`,
  },
  en: {
    now: 'happening now',
    tonight: 'tonight',
    tomorrow: 'tomorrow',
    days: (n: number) => `in ${n} days`,
    weeks: (n: number) => `in ${n} weeks`,
    months: (n: number) => `in ${n} months`,
  },
};
