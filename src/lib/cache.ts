// Tiny stale-while-revalidate cache for client pages.
// Pages seed their state from the cache instantly (no loading flash on
// repeat visits) and refresh from the network in the background.
const mem = new Map<string, unknown>();

export function getCached<T>(key: string): T | null {
  if (mem.has(key)) return mem.get(key) as T;
  try {
    const raw = sessionStorage.getItem(`kw:${key}`);
    if (raw != null) {
      const val = JSON.parse(raw) as T;
      mem.set(key, val);
      return val;
    }
  } catch {
    // sessionStorage unavailable (SSR, private mode) — memory-only
  }
  return null;
}

/**
 * Stale-while-revalidate JSON fetch: applies cached data immediately (if any),
 * then fetches fresh data, re-applies it, and updates the cache.
 */
export function swrJson<T>(url: string, apply: (data: T) => void): Promise<void> {
  const cached = getCached<T>(url);
  if (cached != null) apply(cached);
  return fetch(url)
    .then((r) => r.json())
    .then((data: T) => {
      setCached(url, data);
      apply(data);
    });
}

export function setCached(key: string, value: unknown) {
  mem.set(key, value);
  try {
    sessionStorage.setItem(`kw:${key}`, JSON.stringify(value));
  } catch {
    // quota/unavailable — memory cache still works
  }
}
