import { useState, useEffect, useCallback, useRef } from 'react';
import { query, readCache, subscribe, invalidate } from '../data/queryCache';

interface UseQueryResult<T> {
  data: T;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useCachedQuery<T extends unknown[]>(
  key: string | null,
  fetcher: (() => Promise<T>) | null,
  deps: unknown[] = []
): UseQueryResult<T> {
  const [data, setData] = useState<T>((key ? readCache<T>(key)?.data : null) ?? ([] as unknown as T));
  const [loading, setLoading] = useState<boolean>(!key || !readCache(key));
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const mountedRef = useRef(true);

  const refresh = useCallback(() => {
    setRefreshKey((k) => k + 1);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!key || !fetcher) {
      setLoading(false);
      return;
    }

    const cached = readCache<T>(key);
    if (cached) {
      setData(cached.data);
      setLoading(cached.stale);
    } else {
      setLoading(true);
    }

    const unsub = subscribe(key, (newData) => {
      if (mountedRef.current) {
        setData(newData as T);
        setLoading(false);
      }
    });

    const shouldForce = refreshKey > 0;
    query<T>(key, fetcher, { force: shouldForce })
      .then((result) => {
        if (mountedRef.current) {
          setData(result);
          setError(null);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load data');
          setLoading(false);
        }
      });

    return () => {
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, refreshKey, ...deps]);

  return { data, loading, error, refresh };
}

export { invalidate };

export function useCachedQueryInvalidation(): (key: string) => void {
  return useCallback((key: string) => invalidate(key), []);
}
