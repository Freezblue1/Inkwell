import { useEffect, useMemo, useRef, useState } from 'react';

/** Returns a debounced copy of a value. */
export function useDebouncedValue<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return v;
}

/** Stable debounced callback; pending calls flush on unmount. */
export function useDebouncedCallback<A extends unknown[]>(fn: (...args: A) => void, delay = 500) {
  const fnRef = useRef(fn);
  fnRef.current = fn;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastArgs = useRef<A | null>(null);

  const debounced = useMemo(() => {
    const call = (...args: A) => {
      lastArgs.current = args;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => {
        timer.current = null;
        fnRef.current(...args);
      }, delay);
    };
    call.flush = () => {
      if (timer.current && lastArgs.current) {
        clearTimeout(timer.current);
        timer.current = null;
        fnRef.current(...lastArgs.current);
      }
    };
    return call;
  }, [delay]);

  useEffect(() => () => debounced.flush(), [debounced]);
  return debounced;
}
