/**
 * Usage counters are off: there is no backend yet. Set COUNTER_URL to enable them, and
 * update the "sem analytics" copy in index.html and README.md at the same time.
 * Expected response: {"count": number} for GET `${COUNTER_URL}/<tool>`.
 */
const COUNTER_URL: string | null = null;

/** Below this a number hurts more than it helps. */
const MIN_SHOWN = 10;

export async function showUses(): Promise<void> {
  if (COUNTER_URL === null) return;
  for (const el of document.querySelectorAll<HTMLElement>('[data-uses]')) {
    try {
      const res = await fetch(`${COUNTER_URL}/${el.dataset.uses}`);
      const { count } = (await res.json()) as { count: number };
      if (Number.isFinite(count) && count >= MIN_SHOWN) {
        el.textContent = `${count.toLocaleString('pt-PT')} pessoas já usaram`;
        el.hidden = false;
      }
    } catch {
      // stays hidden
    }
  }
}

/** Call once per completed use (the 3MF download). A no-op while COUNTER_URL is null. */
export function countUse(tool: string): void {
  if (COUNTER_URL === null) return;
  void fetch(`${COUNTER_URL}/${tool}`, { method: 'POST', keepalive: true }).catch(() => undefined);
}
