import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';

/**
 * Stale-while-revalidate cache shared by every screen. A screen you've visited before paints instantly from
 * cache (no skeleton, no layout jump) while a fresh copy loads silently in the background.
 */
const cache = new Map<string, unknown>();
const inflight = new Map<string, Promise<unknown>>();

export function useQuery<T>(fn: () => Promise<T>, deps: unknown[] = [], key?: string) {
  const k = key ?? fn.toString() + '|' + JSON.stringify(deps);
  const [data, setData] = useState<T | undefined>(() => cache.get(k) as T | undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!cache.has(k));
  const alive = useRef(true);

  const run = useCallback(async () => {
    if (!cache.has(k)) setLoading(true);
    setError(null);
    try {
      // De-duplicate identical requests fired at the same time (e.g. two pages asking for the same list).
      let pr = inflight.get(k) as Promise<T> | undefined;
      if (!pr) { pr = fn(); inflight.set(k, pr); pr.finally(() => inflight.delete(k)).catch(() => {}); }
      const d = await pr; cache.set(k, d);
      if (alive.current) setData(d);
    } catch (e) {
      if (alive.current && !cache.has(k)) setError(e instanceof ApiError ? e : new ApiError(0, 'UNKNOWN', String(e)));
    } finally { if (alive.current) setLoading(false); }
     
  }, [k]);

  useEffect(() => { alive.current = true; if (cache.has(k)) setData(cache.get(k) as T); run(); return () => { alive.current = false; }; }, [run, k]);
  const set = useCallback((u: T | undefined | ((d: T | undefined) => T | undefined)) => {
    setData(prev => { const n = typeof u === 'function' ? (u as (d: T | undefined) => T | undefined)(prev) : u; if (n !== undefined) cache.set(k, n); return n; });
  }, [k]);
  return { data, setData: set, error, loading, reload: run };
}

/** Wraps a mutation with a busy flag; returns [run, busy]. Errors are re-thrown for the caller. */
export function useMutation<A extends unknown[], R>(fn: (...a: A) => Promise<R>) {
  const [busy, setBusy] = useState(false);
  const run = useCallback(async (...a: A) => {
    setBusy(true);
    try { return await fn(...a); } finally { setBusy(false); }
     
  }, []);
  return [run, busy] as const;
}

/** Warm the cache before a screen opens (call on press-in) so it renders complete on its first frame. */
export function prefetch<T>(key: string, fn: () => Promise<T>) {
  if (cache.has(key) || inflight.has(key)) return;
  const pr = fn(); inflight.set(key, pr);
  pr.then(d => cache.set(key, d)).catch(() => {}).finally(() => inflight.delete(key));
}
