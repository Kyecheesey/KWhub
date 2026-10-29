// Tiny stale-while-revalidate cache for client pages.
// Pages seed their state from the cache instantly (no loading flash on
// repeat visits) and refresh from the network in the background.
const mem = new Map<string, unknown>();

// API errors come back as { error: "..." }; never cache or apply those, or a
// page that expects a list crashes on every visit until the tab is closed.
function isErrorPayload(v: unknown): boolean {
  return !!v && typeof v === "object" && !Array.isArray(v) && "error" in v;
}

export function getCached<T>(key: string): T | null {
  if (mem.has(key)) return mem.get(key) as T;
  try {
    const raw = sessionStorage.getItem(`kw:${key}`);
    if (raw != null) {
      const val = JSON.parse(raw) as T;
      if (isErrorPayload(val)) {
        sessionStorage.removeItem(`kw:${key}`);
        return null;
      }
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
  // Failed responses (server error, expired session redirecting to /login)
  // are skipped, keeping whatever is on screen; one retry covers blips.
  const attempt = (retries: number): Promise<void> =>
    fetch(url)
      .then(async (r) => {
        const data = r.ok ? await r.json().catch(() => null) : null;
        if (data == null || isErrorPayload(data)) throw new Error(`${url} failed (${r.status})`);
        setCached(url, data);
        apply(data as T);
      })
      .catch((err) => {
        if (retries > 0) return new Promise<void>((res) => setTimeout(res, 2000)).then(() => attempt(retries - 1));
        console.warn(err);
      });
  return attempt(1);
}

export function setCached(key: string, value: unknown) {
  if (isErrorPayload(value)) return;
  mem.set(key, value);
  try {
    sessionStorage.setItem(`kw:${key}`, JSON.stringify(value));
  } catch {
    // quota/unavailable — memory cache still works
  }
}
