"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { ApiError } from "@/services/api/apiClient";
import { tmdbService } from "@/services/api/tmdbService";
import {
  TMDB_POLL_INTERVAL_MS,
  idsKeyOf,
  mergeTmdbStates,
  nextReadOf,
  pendingPlaceholder,
  pollingExpired,
  settledBetween,
  stateReadWorthRetrying,
} from "@/components/tmdb/tmdbPolling";
import { tmdbErrorCode } from "@/components/tmdb/tmdbWords";
import type { TmdbMovieState, TmdbStatus } from "@/types/tmdb";

const NO_STATES: ReadonlyMap<string, TmdbMovieState> = new Map();

/** How the last read of one stretch ended; `idsKey` + `round` say which stretch it was. */
interface ReadOutcome {
  idsKey: string;
  round: number;
  error: Error | null;
  timedOut: boolean;
}

export interface UseTmdbStatesOptions {
  /** False asks nothing — for a member who may not read the states, or while the rows themselves still load. Default true. */
  enabled?: boolean;
  /**
   * Also keep reading the rows that are not being looked up — never, or
   * the last lookup failed or found nothing — every 4 seconds for as long
   * as the page is open: for a title whose upload is still running. The
   * server starts its lookup the moment the upload finishes, which this
   * page cannot see. A result that turns up on such a row is reported
   * through `onSettled` like any lookup that ended. Default false.
   */
  watchUnstarted?: boolean;
  /**
   * Called once for each lookup that ends while the page watches it —
   * "Finding details…" turned into a result. The title's details changed on
   * the server at that moment, so the page reloads it (the Edit movie
   * dialog its form, a list its row).
   */
  onSettled?: (state: TmdbMovieState) => void;
}

export interface TmdbStates {
  /** The lookup state of each movie the server has answered for, by movie id. */
  states: ReadonlyMap<string, TmdbMovieState>;
  /** No read has finished for these rows yet. A refresh or a new lookup does not set it again, so badges never blink. */
  isLoading: boolean;
  /** The last read failed; the states on screen are the ones from before. */
  error: Error | null;
  /**
   * The read was refused with 503 TMDB_NOT_CONFIGURED. The server answers
   * the movie states without a key (they carry the folder names), so this
   * is only ever true against an older one: whether TMDB is connected is
   * what GET /tmdb/status says (`useTmdbConnection`).
   */
  notConfigured: boolean;
  /** Polling stopped after 3 minutes with a row still "Finding details…" — offer Try again (`refresh`). */
  timedOut: boolean;
  /** Read every row again now and give the poll a fresh 3 minutes. */
  refresh: () => void;
  /**
   * A lookup was just started for this movie (POST /tmdb/movies/:id/lookup
   * answered, or its upload just finished): show "Finding details…" at once
   * and poll until the server has the result.
   */
  markPending: (movieId: string) => void;
}

/**
 * The TMDB lookup states of the movies on a page (2026-11-06,
 * docs/movie-details-tmdb-2026-11-06/PLAN.md §6): ONE read
 * (`GET /tmdb/movies/state?ids=…`) after the rows load, again every 4
 * seconds while any row is being looked up — asking only for those rows —
 * and after 3 minutes it stops and reports `timedOut`, so the page shows
 * Try again instead of asking for ever. A read that fails for a passing
 * reason (the server restarting behind its proxy) does not end that: the
 * rows are asked about again, and the 3 minutes still lead to Try again.
 *
 * `movieIds` are the standalone movies on screen (episodes are never looked
 * up); the same ids in another order are the same question, so a re-render
 * that rebuilds the array does not read again.
 *
 * The rules — which rows keep the poll alive, how a lookup the page started
 * stays "Finding details…" until the server has claimed it — are the pure
 * functions of components/tmdb/tmdbPolling.ts.
 */
export function useTmdbStates(movieIds: readonly string[], options: UseTmdbStatesOptions = {}): TmdbStates {
  const enabled = options.enabled ?? true;
  const watchUnstarted = options.watchUnstarted ?? false;
  const idsKey = idsKeyOf(movieIds);

  // Always the page's latest callback, without restarting the poll for it.
  const onSettledRef = useRef(options.onSettled);
  useEffect(() => {
    onSettledRef.current = options.onSettled;
  });

  const [states, setStates] = useState<ReadonlyMap<string, TmdbMovieState>>(NO_STATES);
  const [round, setRound] = useState(0);
  const [outcome, setOutcome] = useState<ReadOutcome | null>(null);

  // The effect and `markPending` both build the next map from the latest
  // one, and neither may wait for a render to see what the other wrote.
  const statesRef = useRef<ReadonlyMap<string, TmdbMovieState>>(NO_STATES);
  /** Lookups this page started itself: movie id → when. */
  const marksRef = useRef(new Map<string, number>());

  useEffect(() => {
    if (!enabled || idsKey === "") return;
    const ids = idsKey.split(",");
    const abort = new AbortController();
    let timer: ReturnType<typeof setTimeout> | null = null;
    const startedAt = Date.now();
    // The 3 minutes of "Finding details…" count from the start of the
    // stretch — or, on a page that watches rows not looked up yet, from the
    // read that first found one being looked up.
    let pendingSince = startedAt;
    let wasPending = true;
    // Once the 3 minutes are over the stretch stays "timed out", whatever a
    // later read of the other rows says.
    let gaveUp = false;
    const finish = (error: Error | null, timedOut: boolean) => setOutcome({ idsKey, round, error, timedOut });

    const read = async (subset: readonly string[]) => {
      let failure: Error | null = null;
      let settled: TmdbMovieState[] = [];
      try {
        const incoming = await tmdbService.getMovieStates(subset, abort.signal);
        if (abort.signal.aborted) return;
        const merged = mergeTmdbStates(statesRef.current, incoming, marksRef.current, ids, Date.now());
        for (const movieId of merged.settledMarks) marksRef.current.delete(movieId);
        settled = settledBetween(statesRef.current, merged.states, watchUnstarted);
        statesRef.current = merged.states;
        setStates(merged.states);
        finish(null, false);
      } catch (err) {
        if (abort.signal.aborted) return;
        failure = err instanceof Error ? err : new Error("Failed to load TMDB states");
        finish(failure, false);
        // A refusal (no permission, a server that says TMDB is not
        // connected) will be the same in 4 seconds. Anything else — the
        // server not reached, a proxy's 502 while the API restarts — is
        // asked again, or a row would sit on "Finding details…" for good.
        if (!(err instanceof ApiError) || !stateReadWorthRetrying(err.status, err.code)) return;
      }

      const again = nextReadOf(statesRef.current, ids, { failed: failure !== null, watchUnstarted });
      const now = Date.now();
      if (again.pending.length === 0) wasPending = false;
      else if (!wasPending) {
        wasPending = true;
        pendingSince = now;
      }
      const next = [...again.unstarted];
      if (again.pending.length > 0) {
        // Out of time: the page offers Try again, also when the last word
        // was a failed read.
        gaveUp = gaveUp || pollingExpired(pendingSince, now);
        if (gaveUp) finish(failure, true);
        else next.push(...again.pending);
      }
      if (!pollingExpired(startedAt, now)) next.push(...again.unanswered);
      if (next.length > 0) timer = setTimeout(() => void read(next), TMDB_POLL_INTERVAL_MS);
      // Last, and outside the try: a page's own callback failing is neither
      // a failed read nor a reason to stop polling the other rows.
      for (const state of settled) onSettledRef.current?.(state);
    };

    void read(ids);
    return () => {
      abort.abort();
      if (timer !== null) clearTimeout(timer);
    };
  }, [enabled, idsKey, round, watchUnstarted]);

  const refresh = useCallback(() => setRound((n) => n + 1), []);

  const markPending = useCallback((movieId: string) => {
    marksRef.current.set(movieId, Date.now());
    const next = new Map(statesRef.current);
    const known = next.get(movieId);
    next.set(movieId, known ? { ...known, status: "PENDING", error: null } : pendingPlaceholder(movieId));
    statesRef.current = next;
    setStates(next);
    // A new stretch: read now, then every 4 seconds for up to 3 minutes.
    setRound((n) => n + 1);
  }, []);

  const asking = enabled && idsKey !== "";
  const current = outcome !== null && outcome.idsKey === idsKey && outcome.round === round ? outcome : null;
  const error = asking ? (current?.error ?? null) : null;

  return {
    states,
    isLoading: asking && outcome?.idsKey !== idsKey,
    error,
    notConfigured: tmdbErrorCode(error) === "TMDB_NOT_CONFIGURED",
    timedOut: asking && (current?.timedOut ?? false),
    refresh,
    markPending,
  };
}

export interface TmdbConnection {
  /** What the server said; null while the first read runs, when it failed, and when not asked. */
  status: TmdbStatus | null;
  /** A read is running — the first one or a "Check again". */
  isLoading: boolean;
  /** The read failed: the admin could not ask its own server (or this member may not). */
  error: Error | null;
  /**
   * True only when the server said so (`configured: false`). Unknown —
   * still loading, the read failed, no permission to ask — is NOT "off": the
   * TMDB buttons stay and the routes themselves explain.
   */
  notConnected: boolean;
  /** "Check again": ask TMDB now instead of trusting the server's 60-second memory. */
  check: () => void;
}

/**
 * Whether the server can use TMDB — `GET /tmdb/status` (MOVIES.VIEW). Pages
 * read it to hide the TMDB buttons and show the one quiet "TMDB is not
 * connected" line; Settings › Connections shows it in full. The first read
 * takes the server's cached answer; every `check()` after it asks afresh.
 */
export function useTmdbConnection(options: { enabled?: boolean } = {}): TmdbConnection {
  const enabled = options.enabled ?? true;
  const [checks, setChecks] = useState(0);
  const { data, isLoading, error } = useAsyncData<TmdbStatus | null>(
    () => (enabled ? tmdbService.getStatus(checks > 0) : Promise.resolve(null)),
    [enabled, checks],
  );
  const check = useCallback(() => setChecks((n) => n + 1), []);

  return {
    status: enabled && !error ? data : null,
    isLoading: enabled && isLoading,
    error: enabled ? error : null,
    notConnected: enabled && !error && data?.configured === false,
    check,
  };
}
