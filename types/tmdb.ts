import type { Movie } from "@/types/movie";
import type { Series } from "@/types/series";

/**
 * Movie and series details from TMDB (2026-11-06,
 * docs/movie-details-tmdb-2026-11-06/PLAN.md §5.3) — the shapes of the
 * backend's `/tmdb` routes, read through services/api/tmdbService.ts.
 *
 * Every TMDB call is made by the backend; the browser never talks to TMDB
 * and never sees the key. The one thing that does come straight from TMDB's
 * servers is a candidate's small preview picture (`posterPreviewUrl`, and the
 * proposed poster / banner of a review), shown to staff only.
 */

/**
 * One detail a fill can write. A movie has all thirteen; a series has no
 * runtime, director or age rating column, so its previews and reports never
 * name those three. `poster` and `cover` are the two pictures (`posterUrl` /
 * `coverUrl` on the title), `country` is the TYPE word.
 */
export const TMDB_MOVIE_FIELDS = [
  "title",
  "description",
  "releaseYear",
  "duration",
  "genre",
  "language",
  "country",
  "director",
  "ageRating",
  "poster",
  "cover",
  "categories",
  "cast",
] as const;

export type TmdbField = (typeof TMDB_MOVIE_FIELDS)[number];

export const TMDB_SERIES_FIELDS: readonly TmdbField[] = TMDB_MOVIE_FIELDS.filter(
  (field) => field !== "duration" && field !== "director" && field !== "ageRating",
);

/** Whether the backend can reach TMDB — GET /tmdb/status, cached 60 s on the server. */
export type TmdbConnectionState = "off" | "connected" | "key_rejected" | "unreachable" | "rate_limited";

export interface TmdbStatus {
  /** False = no TMDB_API_KEY on the server: the feature is off and every other /tmdb route answers 503, except the movie states (they still carry the folder names). */
  configured: boolean;
  /** "off" when not configured. */
  state: TmdbConnectionState;
  /** When the server last asked TMDB; null before the first check and while off. */
  checkedAt: string | null;
}

/** One candidate of a staff search. */
export interface TmdbSearchResult {
  tmdbId: number;
  title: string;
  /** Only when it differs from `title`. */
  originalTitle: string | null;
  year: number | null;
  /** At most 300 characters; "" when TMDB has no story. */
  overview: string;
  /** A small poster on TMDB's own image server — admin only, never shown to viewers. */
  posterPreviewUrl: string | null;
  /** TMDB's language code ("ko"), not a display word. */
  originalLanguage: string | null;
  /** One of our titles already linked to this entry. */
  usedBy: { id: string; title: string } | null;
}

export interface TmdbSearchAnswer {
  query: string;
  year: number | null;
  /** True when the year gave no rows and the search was repeated without it. */
  yearIgnored: boolean;
  results: TmdbSearchResult[];
}

/** Where a movie's automatic lookup stands. `NONE` = never looked up (and every episode). */
export type TmdbLookupStatus = "NONE" | "PENDING" | "MATCHED" | "NEEDS_PICK" | "NOT_FOUND" | "FAILED";

/** Why the last lookup FAILED. */
export type TmdbLookupError = "unreachable" | "rate_limited" | "key_rejected" | "interrupted" | "internal";

/** The TMDB entry a title is linked to, for display: "Inception (2010)". */
export interface TmdbMatch {
  title: string;
  year: number | null;
}

/** Whether a stored picture came from TMDB, was uploaded by staff, or is missing. */
export type TmdbImageSource = "tmdb" | "own" | "none";

export interface TmdbMovieState {
  movieId: string;
  status: TmdbLookupStatus;
  error: TmdbLookupError | null;
  tmdbId: number | null;
  match: TmdbMatch | null;
  fetchedAt: string | null;
  /** The raw folder name of the upload — staff only. */
  sourceName: string | null;
  /** What the pick-a-match dialog starts with: the cleaned name and the year read from it. */
  search: { query: string; year: number | null };
  images: { poster: TmdbImageSource; cover: TmdbImageSource };
  /** Fields that still hold their automatic value (for the "From TMDB" tags). */
  autoFields: TmdbField[];
}

/** A series has no lookup status: its lookups are always started by staff and answered in the same request. */
export interface TmdbSeriesState {
  seriesId: string;
  tmdbId: number | null;
  match: TmdbMatch | null;
  fetchedAt: string | null;
  /** The series title; the year is always null. */
  search: { query: string; year: number | null };
  images: { poster: TmdbImageSource; cover: TmdbImageSource };
  autoFields: TmdbField[];
}

/**
 * How one detail stands before an apply: `empty` = nothing there now,
 * `auto` = still the automatic value, `hand` = changed by staff, `same` =
 * already equal to TMDB's, `none` = TMDB has no value.
 */
export type TmdbPreviewLineState = "empty" | "auto" | "hand" | "same" | "none";

/** A display value: lists are names; a picture is our URL now and a TMDB preview URL proposed. */
export type TmdbPreviewValue = string | number | string[] | null;

export interface TmdbPreviewLine {
  field: TmdbField;
  current: TmdbPreviewValue;
  proposed: TmdbPreviewValue;
  state: TmdbPreviewLineState;
  /** True only for `empty` and `auto`: what a fill would write without being asked. */
  defaultOn: boolean;
}

/** What an apply would do with one person of the cast. */
export type TmdbCastAction = "reuse" | "create" | "skip_same_name" | "skip_no_permission";

export interface TmdbPreviewCastMember {
  name: string;
  tmdbPersonId: number;
  action: TmdbCastAction;
  /** The actor that would be attached; null for a person to create or to skip. */
  actorId: string | null;
  /** Whether TMDB has a photo of this person. */
  hasPhoto: boolean;
}

/** The review of one TMDB entry against one of our titles. Writes nothing and downloads no picture. */
export interface TmdbPreview {
  tmdbId: number;
  match: TmdbMatch;
  fields: TmdbPreviewLine[];
  cast: TmdbPreviewCastMember[];
  categories: {
    /** Existing categories the apply would connect. */
    add: { id: string; name: string }[];
    /** TMDB genres with no category of ours — categories are never created. */
    unmatched: string[];
  };
}

export type TmdbSkipReason = "hand" | "no_value" | "image_failed";

/** What an apply (or a series created from TMDB) really did. */
export interface TmdbFillReport {
  filled: TmdbField[];
  /**
   * Can name a field the Apply did not send: `no_value` there means it was
   * taken back (it held the previous match's value and this entry has none
   * for it), `hand` that staff typed into it meanwhile, so it stays.
   */
  skipped: { field: TmdbField; reason: TmdbSkipReason }[];
  actors: {
    reused: number;
    created: number;
    skipped: { name: string; reason: "same_name" | "no_permission" }[];
  };
  categories: { added: string[]; unmatched: string[] };
}

export interface TmdbMovieApplyResult {
  movie: Movie;
  report: TmdbFillReport;
}

export interface TmdbSeriesApplyResult {
  series: Series;
  report: TmdbFillReport;
}

/**
 * The backend's coded refusals of the /tmdb routes (`ApiError.code`):
 * 503 not configured, 502 unreachable / key rejected, 503 rate limited,
 * 404 TMDB has no such id, 409 busy / already matched / series exists,
 * 400 an episode. components/tmdb/tmdbWords.ts turns them into sentences.
 */
export const TMDB_ERROR_CODES = [
  "TMDB_NOT_CONFIGURED",
  "TMDB_UNREACHABLE",
  "TMDB_KEY_REJECTED",
  "TMDB_RATE_LIMITED",
  "TMDB_TITLE_NOT_FOUND",
  "TMDB_BUSY",
  "TMDB_ALREADY_MATCHED",
  "TMDB_SERIES_EXISTS",
  "TMDB_NOT_A_MOVIE",
] as const;

export type TmdbErrorCode = (typeof TMDB_ERROR_CODES)[number];
