// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { countUrl, countUse, parseCount, showUses, totalUrl } from '../src/counter';

const BASE = 'https://example.goatcounter.com';

// The test runtime's own localStorage is unusable without a file, so each test gets an empty one.
beforeEach(() => {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) });
});
afterEach(() => vi.unstubAllGlobals());

describe('counter', () => {
  it('builds the count and total URLs for a tool', () => {
    expect(countUrl(BASE, 'tune')).toMatch(/^https:\/\/example\.goatcounter\.com\/count\?p=%2Fuse%2Ftune&rnd=\d+$/);
    expect(totalUrl(BASE, 'price')).toBe('https://example.goatcounter.com/counter/%2Fuse%2Fprice.json');
  });

  it('reads the formatted total', () => {
    expect(parseCount('1,234')).toBe(1234);
    expect(parseCount('987')).toBe(987);
    expect(parseCount(42)).toBe(42);
    expect(parseCount(undefined)).toBe(0);
  });

  it('counts each tool once per browser, without cookies', () => {
    const fetch = vi.fn(() => Promise.resolve(new Response()));
    vi.stubGlobal('fetch', fetch);
    countUse('tune', BASE);
    countUse('tune', BASE);
    countUse('price', BASE);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0]).toEqual([expect.stringContaining('p=%2Fuse%2Ftune'), expect.objectContaining({ credentials: 'omit' })]);
  });

  it('does nothing while switched off', () => {
    const fetch = vi.fn();
    vi.stubGlobal('fetch', fetch);
    countUse('tune', null);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('shows the total only from 10 up', async () => {
    document.body.innerHTML = '<span data-uses="tune" hidden></span><span data-uses="price" hidden></span>';
    vi.stubGlobal('fetch', vi.fn((url: string) => Promise.resolve(Response.json({ count: url.includes('tune') ? '1,234' : '9' }))));
    await showUses(BASE);
    const [tune, price] = document.querySelectorAll<HTMLElement>('[data-uses]');
    expect(tune!.hidden).toBe(false);
    expect(tune!.textContent).toBe(`${(1234).toLocaleString('pt-PT')} pessoas já usaram`);
    expect(price!.hidden).toBe(true);
  });

  it('stays hidden when the total is missing', async () => {
    document.body.innerHTML = '<span data-uses="tune" hidden></span>';
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(null, { status: 404 }))));
    await showUses(BASE);
    expect(document.querySelector<HTMLElement>('[data-uses]')!.hidden).toBe(true);
  });
});
