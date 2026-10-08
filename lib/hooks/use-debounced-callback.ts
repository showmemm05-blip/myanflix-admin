"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Returns a trailing-debounced version of `callback`: a burst of calls runs
 * it once, `delayMs` after the last call in the burst. Used for refetches
 * fired by live socket events, where one approval emits several events in a
 * row and each one used to re-run the same request.
 *
 * - Stable identity (as long as `delayMs`/`maxWaitMs` do not change), so it
 *   is safe in effect dependency arrays — the socket effects that register
 *   listeners do not tear down and re-subscribe because of it.
 * - Always calls the LATEST `callback`, not the one from the first render.
 * - `maxWaitMs` caps how long a steady stream of calls can postpone the run
 *   (defaults to 4x the delay), so the figures never go stale indefinitely.
 * - A pending run is cancelled on unmount.
 */
export function useDebouncedCallback<A extends unknown[]>(
  callback: (...args: A) => void,
  delayMs: number,
  maxWaitMs: number = delayMs * 4,
): (...args: A) => void {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstCallAtRef = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
      firstCallAtRef.current = null;
    },
    [],
  );

  return useCallback(
    (...args: A) => {
      const now = Date.now();
      if (firstCallAtRef.current === null) firstCallAtRef.current = now;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      const waitedMs = now - firstCallAtRef.current;
      const wait = Math.max(0, Math.min(delayMs, maxWaitMs - waitedMs));
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        firstCallAtRef.current = null;
        callbackRef.current(...args);
      }, wait);
    },
    [delayMs, maxWaitMs],
  );
}
