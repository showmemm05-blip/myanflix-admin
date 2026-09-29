"use client";

import { useEffect, useState } from "react";

/**
 * A render-safe clock. Reading `Date.now()` inside render is impure (the
 * React compiler lint rejects it), and a value read once at mount would
 * never move — so the "no bank transaction after 24 h" derivation, which is
 * computed at read time on purpose, would only flip on a refetch. Ticking
 * state every `intervalMs` re-renders the consumers just often enough for a
 * row to cross the line on screen without any server involvement.
 */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
