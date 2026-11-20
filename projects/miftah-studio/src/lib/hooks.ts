import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import type { Paginated } from './types';

type QueryValue = string | number | boolean | null | undefined;

export interface QueryState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  reload: () => void;
  setData: (value: T | null) => void;
}

/**
 * Small data-fetching helper used across pages. Keeps previous data visible
 * while refreshing so tables never collapse into a skeleton on every keystroke.
 */
export function useApiQuery<T>(
  path: string | null,
  query?: Record<string, QueryValue>,
  deps: unknown[] = []
): QueryState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(!!path);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const queryKey = JSON.stringify(query || {});
  const queryRef = useRef(query);
  queryRef.current = query;

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  const key = deps.map((d) => String(d)).join('|');

  useEffect(() => {
    if (!path) {
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    api<T>(path, { query: queryRef.current })
      .then((result) => {
        if (!alive) return;
        setData(result);
        setError(null);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err?.message || 'تعذر تحميل البيانات');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, queryKey, key, nonce]);

  return { data, loading, error, reload, setData };
}

export function useDebounced<T>(value: T, delay = 320) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* ignore */ }
  }, [key, value]);
  return [value, setValue] as const;
}

export function useInterval(callback: () => void, delay: number | null) {
  const ref = useRef(callback);
  ref.current = callback;
  useEffect(() => {
    if (delay === null) return;
    const id = window.setInterval(() => ref.current(), delay);
    return () => window.clearInterval(id);
  }, [delay]);
}

export function useIsMac() {
  const [mac, setMac] = useState(false);
  useEffect(() => {
    setMac(/Mac|iPhone|iPad/i.test(navigator.platform));
  }, []);
  return mac;
}

/** Pagination helper that pages through a paginated endpoint. */
export function usePaged<T>(path: string, query: Record<string, QueryValue>, deps: unknown[] = []) {
  return useApiQuery<Paginated<T>>(path, query, deps);
}
