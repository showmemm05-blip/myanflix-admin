import { apiClient } from "./apiClient";
import type {
  TmdbField,
  TmdbMovieApplyResult,
  TmdbMovieState,
  TmdbPreview,
  TmdbSearchAnswer,
  TmdbSeriesApplyResult,
  TmdbSeriesState,
  TmdbStatus,
} from "@/types/tmdb";

/** GET /tmdb/movies/state takes 1 to 50 ids; a longer list is asked in slices of this size. */
export const TMDB_STATE_IDS_PER_REQUEST = 50;

/**
 * An apply (and a series created from TMDB) is answered in the same request:
 * one details call, up to two pictures and up to ten actor photos, saved
 * into our own storage. A few seconds normally — so it gets its own timeout
 * instead of the client's "writes are untimed" default, and a stalled one
 * surfaces as unreachable rather than a dialog that never ends.
 */
const TMDB_APPLY_TIMEOUT_MS = 60_000;

/** `year` only when there is one: the backend reads an absent year as "any year". */
function searchParams(query: string, year: number | null | undefined) {
  return year == null ? { query } : { query, year };
}

/**
 * Movie and series details from TMDB (2026-11-06,
 * docs/movie-details-tmdb-2026-11-06/PLAN.md §5.3). The backend makes every
 * TMDB call; these are its eleven `/tmdb` routes. While the server has no
 * TMDB key, `getStatus` still answers (`configured: false`) and so does
 * `getMovieStates` (our own rows: every status NONE, and the folder name of
 * each upload); every other call is refused with 503 `TMDB_NOT_CONFIGURED`.
 *
 * Permissions (the backend is the real gate): status and movie states need
 * MOVIES.VIEW; movie search and preview MOVIES.EDIT; lookup and apply
 * MOVIES.EDIT + MEDIA.UPLOAD; the series calls the same with SERIES.*, and
 * creating a series from TMDB needs SERIES.CREATE + MEDIA.UPLOAD.
 */
export const tmdbService = {
  /** Whether the server can reach TMDB. `fresh` skips the server's 60-second memory ("Check again"). */
  getStatus(fresh = false) {
    return apiClient.get<TmdbStatus>("/tmdb/status", { params: fresh ? { fresh: 1 } : {} });
  },

  /**
   * Staff search: always answers the list, never decides by itself. With a
   * year that finds nothing the backend repeats the search without it and
   * says so (`yearIgnored`).
   */
  searchMovies(query: string, year?: number | null, signal?: AbortSignal) {
    return apiClient.get<TmdbSearchAnswer>("/tmdb/search/movie", { params: searchParams(query, year), signal });
  },

  searchTv(query: string, year?: number | null, signal?: AbortSignal) {
    return apiClient.get<TmdbSearchAnswer>("/tmdb/search/tv", { params: searchParams(query, year), signal });
  },

  /**
   * Where the lookup of each movie stands, for the badges, and the folder
   * each upload came from. Episodes are never looked up, so pages ask for
   * standalone movies only. Any number of ids: they go out in slices of 50
   * and come back as one list. Answered without a TMDB key too.
   */
  async getMovieStates(movieIds: readonly string[], signal?: AbortSignal): Promise<TmdbMovieState[]> {
    const ids = [...new Set(movieIds)];
    if (ids.length === 0) return [];
    const slices: string[][] = [];
    for (let i = 0; i < ids.length; i += TMDB_STATE_IDS_PER_REQUEST) {
      slices.push(ids.slice(i, i + TMDB_STATE_IDS_PER_REQUEST));
    }
    const answers = await Promise.all(
      slices.map((slice) =>
        apiClient.get<{ items: TmdbMovieState[] }>("/tmdb/movies/state", {
          params: { ids: slice.join(",") },
          signal,
        }),
      ),
    );
    return answers.flatMap((answer) => answer.items);
  },

  /**
   * "Find details" / "Try again": starts the automatic lookup in the
   * background and answers at once (202). The result arrives through
   * `getMovieStates`. Refused with 409 `TMDB_BUSY` while one is running, 409
   * `TMDB_ALREADY_MATCHED` for a linked title (use Refill) and 400
   * `TMDB_NOT_A_MOVIE` for an episode.
   */
  lookupMovie(movieId: string) {
    return apiClient.post<{ status: "PENDING" }>(`/tmdb/movies/${movieId}/lookup`);
  },

  /** The review of one TMDB entry against this movie. Writes nothing. */
  previewMovie(movieId: string, tmdbId: number, signal?: AbortSignal) {
    return apiClient.post<TmdbPreview>(`/tmdb/movies/${movieId}/preview`, { tmdbId }, { signal });
  },

  /** Writes exactly `fields` from that TMDB entry and links the movie to it. Never touches the status. */
  applyMovie(movieId: string, tmdbId: number, fields: readonly TmdbField[]) {
    return apiClient.post<TmdbMovieApplyResult>(
      `/tmdb/movies/${movieId}/apply`,
      { tmdbId, fields },
      { timeoutMs: TMDB_APPLY_TIMEOUT_MS },
    );
  },

  getSeriesState(seriesId: string) {
    return apiClient.get<TmdbSeriesState>(`/tmdb/series/${seriesId}/state`);
  },

  /**
   * "Find on TMDB" for a new show: creates the series from that TMDB entry
   * as a draft — text, pictures, categories and cast. Refused with 409
   * `TMDB_SERIES_EXISTS` when one of our series is already linked to it; the
   * search result's `usedBy` names that series beforehand.
   */
  createSeries(tmdbId: number) {
    return apiClient.post<TmdbSeriesApplyResult>("/tmdb/series", { tmdbId }, { timeoutMs: TMDB_APPLY_TIMEOUT_MS });
  },

  /**
   * Which of our series is linked to a TMDB entry — for "You already have
   * this show · Open it" when `createSeries` was refused after all (another
   * staff member created it a moment before). The refusal itself names the
   * series, but the client's ApiError carries only the message and the code,
   * so the same search is asked once more and its `usedBy` read. Null when
   * the search no longer lists that entry.
   */
  async findSeriesUsing(tmdbId: number, query: string, year?: number | null) {
    const answer = await tmdbService.searchTv(query, year);
    return answer.results.find((result) => result.tmdbId === tmdbId)?.usedBy ?? null;
  },

  previewSeries(seriesId: string, tmdbId: number, signal?: AbortSignal) {
    return apiClient.post<TmdbPreview>(`/tmdb/series/${seriesId}/preview`, { tmdbId }, { signal });
  },

  applySeries(seriesId: string, tmdbId: number, fields: readonly TmdbField[]) {
    return apiClient.post<TmdbSeriesApplyResult>(
      `/tmdb/series/${seriesId}/apply`,
      { tmdbId, fields },
      { timeoutMs: TMDB_APPLY_TIMEOUT_MS },
    );
  },
};
