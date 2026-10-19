import { locale, t } from './i18n';

/**
 * Anonymous usage counter on GoatCounter (no cookies), called directly, without its count.js.
 * The site settings there keep every "Data collection" option off and "Allow adding visitor counts"
 * on, so only the path and its total are stored. If that changes, update common.privacy and
 * home.proof1p in i18n/*.json at the same time.
 */
export const COUNTER_URL: string | null = 'https://olipix-tools.goatcounter.com';

/** Below this a number hurts more than it helps. */
const MIN_SHOWN = 10;

const usePath = (tool: string): string => `/use/${tool}`;

export const countUrl = (base: string, tool: string): string => `${base}/count?p=${encodeURIComponent(usePath(tool))}&rnd=${Date.now()}`;

export const totalUrl = (base: string, tool: string): string => `${base}/counter/${encodeURIComponent(usePath(tool))}.json`;

/** GoatCounter returns the total as display text, e.g. "1,234". */
export function parseCount(raw: unknown): number {
  const digits = typeof raw === 'string' ? raw.replace(/\D/g, '') : typeof raw === 'number' ? String(raw) : '';
  return digits === '' ? 0 : Number(digits);
}

export async function showUses(base: string | null = COUNTER_URL): Promise<void> {
  if (base === null) return;
  for (const el of document.querySelectorAll<HTMLElement>('[data-uses]')) {
    try {
      const res = await fetch(totalUrl(base, el.dataset.uses ?? ''));
      if (!res.ok) continue;
      const count = parseCount(((await res.json()) as { count?: unknown }).count);
      if (count >= MIN_SHOWN) {
        el.textContent = t('counter.uses', { n: count.toLocaleString(locale()) });
        el.hidden = false;
      }
    } catch {
      // stays hidden
    }
  }
}

/** Call once per completed use. Counts each tool once per browser, so the total is people, not clicks. */
export function countUse(tool: string, base: string | null = COUNTER_URL): void {
  if (base === null) return;
  const mark = `counted.${tool}`;
  try {
    if (localStorage.getItem(mark)) return;
    localStorage.setItem(mark, '1');
  } catch {
    // storage unavailable: count anyway, at worst more than once for this visitor
  }
  void fetch(countUrl(base, tool), { mode: 'no-cors', keepalive: true, credentials: 'omit' }).catch(() => undefined);
}
