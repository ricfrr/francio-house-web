import type { Street, StreetFrame } from './street';

const STORAGE_KEY = 'fh:inside';
/** Past this point the camera is through the door and the screen shows only the site. */
const FINISH_AT = 0.985;

const html = document.documentElement;
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function initOutside() {
  const outside = document.querySelector<HTMLElement>('[data-outside]');
  const spacer = document.querySelector<HTMLElement>('[data-spacer]');
  let canvas = document.querySelector<HTMLCanvasElement>('[data-street-canvas]');
  const house = document.getElementById('interior');
  if (!outside || !spacer || !canvas || !house) return;

  (window as unknown as { __fhStreet: boolean }).__fhStreet = true; // see the safety net in Base.astro
  const ui = outside.querySelector<HTMLElement>('.outside__ui')!;
  const bell = outside.querySelector<HTMLButtonElement>('[data-enter]')!;
  const captions = [...outside.querySelectorAll<HTMLElement>('[data-from]')];
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  let street: Street | null = null;
  let loading: Promise<Street | null> | null = null;
  let autoplay = 0;
  let progress = 0;

  const isOutside = () => html.dataset.mode === 'outside';
  /** Reduced motion: the same 3D house, as a still picture; going in is a fade. */
  const still = () => reducedMotion.matches;

  function scrollProgress() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? Math.min(1, window.scrollY / max) : 0;
  }

  function paint(p: number) {
    progress = p;
    for (const c of captions) {
      const on = p >= Number(c.dataset.from) && p < Number(c.dataset.to);
      c.classList.toggle('is-on', on);
    }
    ui.style.setProperty('--ui', String(1 - smooth(0.74, 0.84, p)));
    // the room behind the door grows as we get closer
    html.style.setProperty('--approach', (0.86 + 0.14 * smooth(0.72, 0.985, p)).toFixed(4));
    if (p >= FINISH_AT && isOutside()) finish();
  }

  function onFrame(f: StreetFrame) {
    if (!isOutside()) return;
    // Keep the loading house visible until the street has actually rendered.
    if (!outside!.classList.contains('is-3d')) outside!.classList.add('is-3d');
    if (!still()) paint(f.progress);
  }

  async function ensureStreet(): Promise<Street | null> {
    if (street) return street;
    loading ??= import('./street')
      .then(({ createStreet }) => {
        // the visitor may have skipped inside while the scene was downloading
        if (!isOutside()) return null;
        const s = createStreet(canvas!);
        s.onFrame(onFrame);
        s.setTarget(still() ? 0 : scrollProgress(), true);
        s.start();
        street = s;
        return s;
      })
      .catch((err) => {
        // no WebGL (or the scene failed to load): skip the street and open the door
        console.warn('Street scene unavailable, going straight inside.', err);
        finish();
        return null;
      })
      .finally(() => {
        loading = null;
      });
    return loading;
  }

  function onScroll() {
    if (!isOutside() || autoplay) return;
    const p = scrollProgress();
    if (still()) {
      // no camera move: the street simply fades away
      outside!.style.opacity = String(1 - smooth(0.1, 0.95, p));
      if (p >= 0.97) finish();
    } else {
      street?.setTarget(p);
    }
  }

  function leave() {
    if (!isOutside()) return;
    outside!.classList.add('is-leaving');
    window.setTimeout(finish, still() ? 50 : 480);
  }

  function enter() {
    if (!isOutside()) return;
    if (!street || still()) return leave();
    if (autoplay) return;
    html.classList.add('is-autoplay');
    const from = progress;
    const duration = Math.max(1800, (1 - from) * 6400);
    const t0 = performance.now();
    const s = street;
    const step = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      s.setTarget(from + (1 - from) * easeInOut(t));
      autoplay = t < 1 ? requestAnimationFrame(step) : -1; // -1: done, waiting for the camera to catch up
    };
    autoplay = requestAnimationFrame(step);
  }

  function finish() {
    if (!isOutside()) return;
    if (autoplay > 0) cancelAnimationFrame(autoplay);
    autoplay = 0;
    try {
      localStorage.setItem(STORAGE_KEY, '1');
    } catch {
      /* private mode */
    }
    html.dataset.mode = 'inside';
    html.classList.remove('is-autoplay');
    html.style.removeProperty('--approach');
    outside!.classList.remove('is-leaving', 'is-3d');
    outside!.style.removeProperty('opacity');
    house!.inert = false;
    window.scrollTo({ top: 0, behavior: 'instant' });
    const url = new URL(location.href);
    if (url.searchParams.has('intro')) {
      url.searchParams.delete('intro');
      history.replaceState(null, '', url);
    }
    if (street) {
      street.dispose();
      street = null;
      // dispose() throws the WebGL context away to free GPU memory, and a canvas can't get
      // a new one afterwards: give the next trip outside a fresh canvas.
      const fresh = canvas!.cloneNode(false) as HTMLCanvasElement;
      canvas!.replaceWith(fresh);
      canvas = fresh;
    }
    document.getElementById('next')?.focus({ preventScroll: true });
    document.dispatchEvent(new CustomEvent('house:inside'));
  }

  function goOutside() {
    if (isOutside()) return;
    html.dataset.mode = 'outside';
    house!.inert = true;
    window.scrollTo({ top: 0, behavior: 'instant' });
    paint(0);
    ensureStreet().then((s) => s?.setTarget(0, true));
    outside!.querySelector<HTMLButtonElement>('[data-skip]')?.focus({ preventScroll: true });
  }

  // ---- wire up ----
  html.dataset.motion = reducedMotion.matches ? 'reduced' : 'full';
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  if (isOutside()) {
    house.inert = true;
    window.scrollTo(0, 0);
    paint(0);
    ensureStreet();
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  bell.addEventListener('click', enter);
  outside.querySelector('[data-skip]')?.addEventListener('click', leave);
  document.addEventListener('click', (e) => {
    if ((e.target as Element | null)?.closest('[data-go-outside]')) goOutside();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isOutside()) leave();
  });
  window.addEventListener(
    'pointermove',
    (e) => {
      if (!street || still() || e.pointerType !== 'mouse') return;
      street.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    },
    { passive: true },
  );
}
