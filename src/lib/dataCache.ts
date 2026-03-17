type CacheEnvelope<T> = {
  timestamp: number;
  data: T;
};

function readEnvelope<T>(key: string): CacheEnvelope<T> | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (raw) return JSON.parse(raw) as CacheEnvelope<T>;
  } catch {}
  return null;
}

function writeEnvelope<T>(key: string, data: T): void {
  try {
    sessionStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data }));
  } catch {}
}

/**
 * Await-based cache: if fresh data is in cache return it instantly,
 * otherwise fetch from network (and cache the result).
 */
export async function getCachedOrFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  if (typeof window === 'undefined') {
    return fetcher();
  }

  const envelope = readEnvelope<T>(key);
  if (envelope && Date.now() - envelope.timestamp < ttlMs) {
    return envelope.data;
  }

  const freshData = await fetcher();
  writeEnvelope(key, freshData);
  return freshData;
}

/**
 * Stale-while-revalidate: returns cached data IMMEDIATELY (even if stale),
 * and silently kicks off a background refresh when the cache is expired.
 * Returns null when no cache entry exists yet.
 *
 * Usage:
 *   const cached = getSWRData(key, ttl, fetcher, (fresh) => setState(fresh));
 *   if (cached !== null) setState(cached);          // show instantly
 *   else { const data = await fetcher(); setState(data); } // first load
 */
export function getSWRData<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>,
  onUpdate: (data: T) => void
): T | null {
  if (typeof window === 'undefined') return null;

  const envelope = readEnvelope<T>(key);
  if (!envelope) return null;

  if (Date.now() - envelope.timestamp >= ttlMs) {
    // Stale – refresh in background without blocking the caller
    void fetcher()
      .then((fresh) => { writeEnvelope(key, fresh); onUpdate(fresh); })
      .catch(() => {});
  }

  return envelope.data;
}

export function invalidateCacheKey(key: string) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(key);
  } catch {}
}
