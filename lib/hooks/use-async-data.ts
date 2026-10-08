"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Fetches data through an async API call and exposes loading/error state so
 * pages can render skeletons and error states consistently.
 *
 * `isLoading` is true while ANY fetch runs, including a refetch (callers use
 * that for "Refreshing" buttons). `isInitialLoading` is true only while there
 * is nothing to show yet, and `isRefreshing` only while a refetch runs with
 * the previous data still on screen — use those to show a skeleton just once
 * instead of blanking the page on every background refresh.
 */
export function useAsyncData<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const fetcherRef = useRef(fetcher);
  useEffect(() => {
    fetcherRef.current = fetcher;
  });

  useEffect(() => {
    let cancelled = false;
    // Resetting loading/error state before an async fetch is React's
    // documented data-fetching pattern (see react.dev "You Might Not Need
    // an Effect" > Fetching data) — not the derived-state anti-pattern this
    // rule otherwise guards against.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsLoading(true);
    setError(null);

    fetcherRef.current()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err : new Error("Failed to load data"));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadKey]);

  // Stable identity: callers put `refetch` in effect dependency arrays (the
  // books conversion poller does), and a fresh arrow every render would tear
  // that effect down and rebuild it on each commit — restarting the interval
  // forever so it never actually fires.
  const refetch = useCallback(() => setReloadKey((k) => k + 1), []);

  return {
    data,
    isLoading,
    isInitialLoading: isLoading && data === null,
    isRefreshing: isLoading && data !== null,
    error,
    refetch,
  };
}
