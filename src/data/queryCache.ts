type AnyData = unknown[];

interface CacheEntry {
  data: AnyData;
  timestamp: number;
  promise: Promise<AnyData> | null;
  subscribers: Set<(data: AnyData) => void>;
}

const cache = new Map<string, CacheEntry>();

const STALE_TIME = 60_000;

function now(): number {
  return Date.now();
}

export function readCache<T extends AnyData>(key: string): { data: T; stale: boolean } | null {
  const entry = cache.get(key);
  if (!entry) return null;
  return { data: entry.data as T, stale: now() - entry.timestamp > STALE_TIME };
}

export function writeCache(key: string, data: AnyData): void {
  const existing = cache.get(key);
  if (existing) {
    existing.data = data;
    existing.timestamp = now();
    existing.subscribers.forEach((fn) => fn(data));
  } else {
    cache.set(key, { data, timestamp: now(), promise: null, subscribers: new Set() });
  }
}

export function invalidate(key: string): void {
  const entry = cache.get(key);
  if (!entry) return;
  entry.timestamp = 0;
}

export function invalidatePattern(pattern: string): void {
  for (const key of cache.keys()) {
    if (key.startsWith(pattern)) {
      invalidate(key);
    }
  }
}

export function clearCache(): void {
  cache.clear();
}

export function subscribe(key: string, fn: (data: AnyData) => void): () => void {
  let entry = cache.get(key);
  if (!entry) {
    entry = { data: [], timestamp: 0, promise: null, subscribers: new Set() };
    cache.set(key, entry);
  }
  entry.subscribers.add(fn);
  return () => {
    const e = cache.get(key);
    if (e) e.subscribers.delete(fn);
  };
}

export async function query<T extends AnyData>(
  key: string,
  fetcher: () => Promise<T>,
  opts?: { force?: boolean }
): Promise<T> {
  const entry = (() => {
    let e = cache.get(key);
    if (!e) {
      e = { data: [], timestamp: 0, promise: null, subscribers: new Set() };
      cache.set(key, e);
    }
    return e;
  })();

  const isFresh = entry.timestamp > 0 && now() - entry.timestamp < STALE_TIME;

  if (entry.promise) {
    return entry.promise as Promise<T>;
  }

  if (isFresh && !opts?.force) {
    return entry.data as T;
  }

  entry.promise = fetcher()
    .then((result) => {
      writeCache(key, result as AnyData);
      entry.promise = null;
      return result;
    })
    .catch((err) => {
      entry.promise = null;
      throw err;
    });

  return entry.promise as Promise<T>;
}

export function getCachedData<T extends AnyData>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || entry.timestamp === 0) return null;
  return entry.data as T;
}
