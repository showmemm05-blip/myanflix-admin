"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fetches data through an async function (a mock service call today, a real
 * API call later) and exposes loading/error state so pages can render
 * skeletons and error states consistently.
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

  return { data, isLoading, error, refetch: () => setReloadKey((k) => k + 1) };
}
