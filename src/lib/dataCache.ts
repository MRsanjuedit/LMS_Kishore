type CacheEnvelope<T> = {
  timestamp: number;
  data: T;
};

export async function getCachedOrFetch<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  if (typeof window === 'undefined') {
    return fetcher();
  }

  try {
    const raw = sessionStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as CacheEnvelope<T>;
      if (Date.now() - parsed.timestamp < ttlMs) {
        return parsed.data;
      }
    }
  } catch {
    // ignore cache parse failures and fetch fresh data
  }

  const freshData = await fetcher();

  try {
    const envelope: CacheEnvelope<T> = { timestamp: Date.now(), data: freshData };
    sessionStorage.setItem(key, JSON.stringify(envelope));
  } catch {
    // ignore storage failures
  }

  return freshData;
}

export function invalidateCacheKey(key: string) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(key);
  } catch {
    // ignore storage failures
  }
}
