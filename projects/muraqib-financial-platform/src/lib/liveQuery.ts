import { useEffect, useRef, useState } from 'react';

type Listener = () => void;
const listeners = new Set<Listener>();

export function notifyDbChange() {
  for (const l of Array.from(listeners)) l();
}

export function useLiveQuery<T>(querier: () => T | Promise<T>, deps?: any[]): T | undefined;
export function useLiveQuery<T>(querier: () => T | Promise<T>, deps: any[] | undefined, defaultValue: T): T;
export function useLiveQuery<T>(
  querier: () => T | Promise<T>,
  deps: any[] = [],
  defaultValue?: T,
): T | undefined {
  const [value, setValue] = useState<T | undefined>(defaultValue);
  const runId = useRef(0);
  const querierRef = useRef(querier);
  querierRef.current = querier;

  const run = async () => {
    const id = ++runId.current;
    try {
      const result = await querierRef.current();
      if (id === runId.current) setValue(result as T);
    } catch (e) {
      console.error('useLiveQuery error', e);
    }
  };

  useEffect(() => { run(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, deps);
  useEffect(() => {
    const l = () => { run(); };
    listeners.add(l);
    return () => { listeners.delete(l); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return (value === undefined ? defaultValue : value) as T | undefined;
}
