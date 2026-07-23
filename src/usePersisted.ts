import { useCallback, useState } from 'react';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) return JSON.parse(raw) as T;
  } catch {}
  return fallback;
}

function write<T>(key: string, val: T): void {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
}

// Drop-in replacement for useState that persists the value to localStorage.
// The setter accepts both values and updater functions, exactly like useState.
export function usePersisted<T>(
  key: string,
  initial: T | (() => T),
): [T, (action: T | ((prev: T) => T)) => void] {
  const [val, setVal] = useState<T>(() => {
    const fallback = typeof initial === 'function' ? (initial as () => T)() : initial;
    return read(key, fallback);
  });

  const set = useCallback((action: T | ((prev: T) => T)) => {
    setVal(prev => {
      const next = typeof action === 'function' ? (action as (p: T) => T)(prev) : action;
      write(key, next);
      return next;
    });
  }, [key]);

  return [val, set];
}

// Persisted variant of usePathMap — same return signature.
export function usePersistedPathMap<T>(
  key: string,
): [Record<string, T>, (path: string, val: T) => void, (path: string) => void] {
  const [map, setMap] = usePersisted<Record<string, T>>(key, {});
  const set   = useCallback((path: string, v: T) => setMap(prev => ({ ...prev, [path]: v })), [setMap]);
  const clear = useCallback((path: string) => setMap(prev => { const n = { ...prev }; delete n[path]; return n; }), [setMap]);
  return [map, set, clear];
}
