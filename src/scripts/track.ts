/**
 * Anonymous event counts for GoatCounter (see "Visitor counts" in the README).
 * Does nothing when the counter isn't configured or is blocked by the visitor's browser.
 */
type GoatCounter = { count?: (o: { path: string; title?: string; event?: boolean }) => void };

export function track(name: string, tries = 0) {
  const gc = (window as unknown as { goatcounter?: GoatCounter }).goatcounter;
  if (gc?.count) gc.count({ path: name, title: name, event: true });
  else if (tries < 8) window.setTimeout(() => track(name, tries + 1), 500); // the counter script may still be loading
}
