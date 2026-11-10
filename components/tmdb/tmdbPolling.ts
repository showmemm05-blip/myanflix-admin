/**
 * The rules of reading TMDB lookup states for a list of movies (2026-11-06,
 * docs/movie-details-tmdb-2026-11-06/PLAN.md §6): one read after the rows
 * load, again every 4 seconds while any row is "Finding details…", and after
 * 3 minutes the page stops asking and offers Try again.
 *
 * lib/hooks/use-tmdb-states.ts does the timing; the decisions are here, pure
 * and with type imports only, so Node's test runner loads the file as it is
 * (tmdbPolling.test.ts). So are the two changes a list makes to its rows
 * when one was read again or left it (`rowReplaced`, `rowRemoved`).
 */
import type { TmdbLookupStatus, TmdbMovieState } from "@/types/tmdb";

/** How often the states are read again while a row is still being looked up. */
export const TMDB_POLL_INTERVAL_MS = 4_000;

/** After this long the page stops asking by itself and shows Try again. */
export const TMDB_POLL_LIMIT_MS = 3 * 60_000;

/**
 * How long a lookup the page itself just started is shown as "Finding
 * details…" while the server still answers NONE. The lookup after an upload
 * is started by the server a moment after the upload's own answer, so the
 * first read can arrive before the row is claimed; past this window the
 * server's NONE is believed (the lookup never started — TMDB is off, or the
 * row is an episode).
 */
export const TMDB_PENDING_GRACE_MS = 15_000;

/** The row shown for a lookup the page started before the server has said anything about that movie. */
export function pendingPlaceholder(movieId: string): TmdbMovieState {
  return {
    movieId,
    status: "PENDING",
    error: null,
    tmdbId: null,
    match: null,
    fetchedAt: null,
    sourceName: null,
    search: { query: "", year: null },
    images: { poster: "none", cover: "none" },
    autoFields: [],
  };
}

export interface MergedTmdbStates {
  /** What the page shows: one entry per asked movie the server (or a fresh mark) knows about. */
  states: Map<string, TmdbMovieState>;
  /** The movies still being looked up — what the next read asks for. Empty = nothing left to wait for. */
  pendingIds: string[];
  /** Marks the server has now answered for (or that ran out): the hook forgets them. */
  settledMarks: string[];
}

/**
 * Folds one read into what the page already shows.
 *
 * - `ids` are the movies on the page now; anything else is dropped, so a
 *   row that left the list does not keep the poll alive.
 * - `incoming` may be a part of them (a poll asks only for the rows still
 *   pending); the others keep their previous state.
 * - `marks` are lookups the page started itself (movie id → when): such a
 *   row stays "Finding details…" over a server NONE for the grace window.
 */
export function mergeTmdbStates(
  previous: ReadonlyMap<string, TmdbMovieState>,
  incoming: readonly TmdbMovieState[],
  marks: ReadonlyMap<string, number>,
  ids: readonly string[],
  now: number,
): MergedTmdbStates {
  const asked = new Set(ids);
  const states = new Map<string, TmdbMovieState>();
  for (const id of ids) {
    const known = previous.get(id);
    if (known) states.set(id, known);
  }

  const answered = new Set<string>();
  const settledMarks: string[] = [];
  for (const state of incoming) {
    if (!asked.has(state.movieId)) continue;
    answered.add(state.movieId);
    const markedAt = marks.get(state.movieId);
    if (markedAt === undefined) {
      states.set(state.movieId, state);
    } else if (state.status === "NONE" && now - markedAt < TMDB_PENDING_GRACE_MS) {
      // Not claimed yet: keep saying what the page knows it started.
      states.set(state.movieId, { ...state, status: "PENDING", error: null });
    } else {
      states.set(state.movieId, state);
      settledMarks.push(state.movieId);
    }
  }

  for (const [movieId, markedAt] of marks) {
    if (answered.has(movieId)) continue;
    if (asked.has(movieId) && now - markedAt < TMDB_PENDING_GRACE_MS) continue;
    // Off the page, or the server said nothing about it in time: forget the
    // mark, and the "Finding details…" it was holding up.
    settledMarks.push(movieId);
    if (states.get(movieId)?.status === "PENDING") states.delete(movieId);
  }

  return { states, pendingIds: pendingIdsOf(states), settledMarks };
}

/** The movies a list is still waiting for. */
export function pendingIdsOf(states: ReadonlyMap<string, TmdbMovieState>): string[] {
  const pending: string[] = [];
  for (const [movieId, state] of states) {
    if (state.status === "PENDING") pending.push(movieId);
  }
  return pending;
}

/**
 * The statuses the server's own lookup starts from when an upload finishes:
 * never looked up, or an earlier lookup that came to nothing (the backend's
 * CLAIMABLE_AFTER_UPLOAD). A row in one of them can still be looked up
 * without anyone on this page asking for it.
 */
function awaitsUploadLookup(status: TmdbLookupStatus): boolean {
  return status === "NONE" || status === "FAILED" || status === "NOT_FOUND";
}

/**
 * The lookups that ended between two reads: rows that were "Finding
 * details…" and now carry something else — a result, or the NONE of a
 * lookup that never started. A page reloads those titles, because their
 * details may have changed on the server while it was looking at them.
 *
 * With `watchUnstarted` (a page that keeps reading a title whose upload is
 * still running) a row the server could still look up by itself — never
 * looked up, failed, not found — that now carries another status counts
 * too: its lookup started and ended between two reads. The same status
 * again is no end of anything, or the page would reload every 4 seconds.
 */
export function settledBetween(
  previous: ReadonlyMap<string, TmdbMovieState>,
  next: ReadonlyMap<string, TmdbMovieState>,
  watchUnstarted = false,
): TmdbMovieState[] {
  const settled: TmdbMovieState[] = [];
  for (const [movieId, before] of previous) {
    const after = next.get(movieId);
    if (!after || after.status === "PENDING") continue;
    if (before.status === "PENDING") settled.push(after);
    else if (watchUnstarted && awaitsUploadLookup(before.status) && after.status !== before.status) settled.push(after);
  }
  return settled;
}

/**
 * Whether a list row is older than the details TMDB filled in for it: its
 * state says MATCHED since `fetchedAt`, and the row was last written before
 * that. The fill stores the details and that time in one write, so a row
 * read after it is never behind.
 *
 * `settledBetween` only reports a lookup the page watched end. A row can
 * also turn "Details from TMDB" without that — someone else picked its
 * match, or the list was read a moment before the fill and the states a
 * moment after — and then the row on screen still lacks the poster the
 * movie has by now. A page reads such a row again.
 */
export function rowBehindItsDetails(
  rowUpdatedAt: string | null | undefined,
  state: Pick<TmdbMovieState, "status" | "fetchedAt"> | null | undefined,
): boolean {
  if (!rowUpdatedAt || state?.status !== "MATCHED" || !state.fetchedAt) return false;
  // An unreadable date compares false: the row is left alone.
  return Date.parse(state.fetchedAt) > Date.parse(rowUpdatedAt);
}

/**
 * A list with one row swapped for its fresh copy: the same rows in the same
 * order. A row that is not in the list is not added — it left the list a
 * moment before, and its copy must not put it back.
 *
 * A page applies it to the rows as they are when the change is made
 * (`setRows((rows) => rowReplaced(rows, fresh))`), never to the rows it drew
 * some time ago: two rows read again at the same moment then each keep
 * their fresh copy, and the second answer cannot write the first row's old
 * copy back.
 */
export function rowReplaced<Row extends { id: string }>(rows: readonly Row[], updated: Row): Row[] {
  return rows.map((row) => (row.id === updated.id ? updated : row));
}

/**
 * A list without one row; every other row stays as it is in `rows`. Applied
 * the same way as `rowReplaced`, so a row that was read again while another
 * was being published or deleted keeps its fresh copy.
 */
export function rowRemoved<Row extends { id: string }>(rows: readonly Row[], id: string): Row[] {
  return rows.filter((row) => row.id !== id);
}

/** True once a stretch of polling has run its 3 minutes. */
export function pollingExpired(startedAt: number, now: number): boolean {
  return now - startedAt >= TMDB_POLL_LIMIT_MS;
}

/**
 * Whether a read of the states that failed is worth asking again in 4
 * seconds. `status` is the HTTP status of the answer, 0 when none arrived;
 * `code` the backend's own code, when the answer carried one.
 *
 * A refusal will be the same next time: no permission, a bad request, the
 * session gone, a server that says TMDB is not connected. Everything else
 * passes — the server was not reached, or something in front of it answered
 * in its place while it restarts (a proxy's 502 / 504, a 500, a 429).
 */
export function stateReadWorthRetrying(status: number, code?: string | null): boolean {
  if (code === "TMDB_NOT_CONFIGURED") return false;
  return status === 0 || status === 408 || status === 429 || status >= 500;
}

/** The rows a page asks about again in 4 seconds, by why. */
export interface TmdbNextRead {
  /** Still "Finding details…". Asked again for 3 minutes, then the page offers Try again. */
  pending: string[];
  /** The read failed before the server had said anything about them. Asked again for the same 3 minutes. */
  unanswered: string[];
  /** Not being looked up (never, or the last lookup failed or found nothing), on a page that watches for a lookup to start by itself. Asked again for as long as the page is open. */
  unstarted: string[];
}

/**
 * What the next read asks for, after a read that ended as `failed` says.
 *
 * - A row that is "Finding details…" is always asked about again.
 * - After a failed read, so is a row the server has not answered about yet:
 *   otherwise one lost first read would leave the page without its TMDB
 *   parts until it is opened again.
 * - With `watchUnstarted`, so is a row that was never looked up, or whose
 *   last lookup failed or found nothing: the upload of that title is still
 *   running, and the server looks it up by itself the moment it finishes.
 */
export function nextReadOf(
  states: ReadonlyMap<string, TmdbMovieState>,
  ids: readonly string[],
  options: { failed: boolean; watchUnstarted: boolean },
): TmdbNextRead {
  const next: TmdbNextRead = { pending: [], unanswered: [], unstarted: [] };
  for (const movieId of ids) {
    const state = states.get(movieId);
    if (!state) {
      if (options.failed) next.unanswered.push(movieId);
    } else if (state.status === "PENDING") {
      next.pending.push(movieId);
    } else if (options.watchUnstarted && awaitsUploadLookup(state.status)) {
      next.unstarted.push(movieId);
    }
  }
  return next;
}

/**
 * What a page takes from the movies' states, from what the server said
 * about its TMDB key (GET /tmdb/status):
 *
 * - `none`: nothing is asked. The member may not read the states, or the
 *   server has not answered about its key yet — a server without one must
 *   never flash a badge or a button that could only be refused.
 * - `folders`: the server has no key. The states are read all the same (the
 *   server answers them without one, every status NONE), but only for the
 *   folder each upload came from: no badge, no button, no Details column.
 *   The title was cut out of that folder name when the movie was born, so
 *   staff must be able to see it while details are typed by hand.
 * - `all`: connected, or not known (the status read failed): everything.
 */
export type TmdbStatesUse = "none" | "folders" | "all";

export function tmdbStatesUse(canSee: boolean, connectionAnswered: boolean, notConnected: boolean): TmdbStatesUse {
  if (!canSee || !connectionAnswered) return "none";
  return notConnected ? "folders" : "all";
}

/** The folder each upload came from, by movie id — whatever the row's lookup status says. */
export function folderNamesOf(states: ReadonlyMap<string, TmdbMovieState>): Map<string, string> {
  const folders = new Map<string, string>();
  for (const [movieId, state] of states) {
    if (state.sourceName) folders.set(movieId, state.sourceName);
  }
  return folders;
}

/** The movie ids a page asks about, as one stable string: unique, sorted, so the same rows in another order are the same question. */
export function idsKeyOf(movieIds: readonly string[]): string {
  return [...new Set(movieIds)].sort().join(",");
}
