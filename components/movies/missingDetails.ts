/**
 * What a title still lacks before it is published (2026-11-09,
 * docs/movie-details-tmdb-2026-11-06/DECISIONS.md, last section; the
 * `Missing`, `MissingWarn` and `MissingEdit` boards) — one rule, so Ready to
 * publish, the upload card, the Edit movie dialog and the series pages say
 * the same thing the same way:
 *
 *   must have      poster · description (English or Burmese) · category
 *   good to have   banner · actors · director · age rating
 *
 *   a series       the same three; good to have is only banner · actors
 *                  (a series has no director and no age rating)
 *   an episode     nothing at all: it uses the show's pictures
 *
 * Something in "must have" missing: an amber "Still needed: …" line, and
 * Publish asks first. Publishing is never blocked (the owner's choice A);
 * "good to have" only ever adds a grey line.
 *
 * The rules and the words built from a translations object, no drawing:
 * MissingDetailsLine.tsx draws. Pure and with type imports only, so Node's
 * test runner loads it as it is (missingDetails.test.ts).
 */
import type { TranslationShape } from "@/lib/i18n/translations";
import type { Movie, MovieStatus } from "@/types/movie";
import type { Series } from "@/types/series";
import type { TmdbLookupStatus } from "@/types/tmdb";

/** In the order they are always listed. */
export const MUST_HAVE_KEYS = ["poster", "description", "categories"] as const;
/** In the order they are always listed. `cover` is the banner, `cast` the actors. */
export const GOOD_TO_HAVE_KEYS = ["cover", "cast", "director", "ageRating"] as const;
/** A series has no director and no age rating column. */
export const SERIES_GOOD_TO_HAVE_KEYS = ["cover", "cast"] as const;

export type MustHaveKey = (typeof MUST_HAVE_KEYS)[number];
export type GoodToHaveKey = (typeof GOOD_TO_HAVE_KEYS)[number];
/** One checked detail — a key of `t.movies.missing.items`, and the name the same detail has as a `TmdbField`. */
export type MissingKey = MustHaveKey | GoodToHaveKey;

/** What is missing, each list in its fixed order. Two empty lists = nothing missing (and every episode). */
export interface MissingDetails {
  mustHave: MustHaveKey[];
  goodToHave: GoodToHaveKey[];
}

/** Which rule applies. An episode is a movie row with `seriesId` set. */
export type MissingKind = "movie" | "series" | "episode";

/** The fields the movie rule reads: a list row and a single movie both fit. */
export type MissingMovieInput = Pick<
  Movie,
  | "posterUrl"
  | "coverUrl"
  | "description"
  | "descriptionMm"
  | "categories"
  | "actors"
  | "director"
  | "ageRating"
  | "seriesId"
>;

/** The fields the series rule reads: a list row and the manage page's series both fit. */
export type MissingSeriesInput = Pick<
  Series,
  "posterUrl" | "coverUrl" | "description" | "descriptionMm" | "categories" | "actors"
>;

/**
 * What an edit form holds right now — which is what its Save stores. The
 * Edit movie dialog and the "Series information" card both build it from
 * their own state as it is.
 */
export interface MissingFormInput {
  /** The stored poster's address the form still shows: null when the title has none, or when the form cleared it. */
  posterUrl: string | null | undefined;
  /** The poster file picked and not saved yet (the form's `File | null`): a picked file counts as a poster. */
  posterFile?: object | null;
  /** The stored banner's address, like `posterUrl`. */
  coverUrl: string | null | undefined;
  /** The banner file picked and not saved yet. */
  coverFile?: object | null;
  /** The English box. */
  description: string | null | undefined;
  /** The Burmese box: text in either one is a description. */
  descriptionMm: string | null | undefined;
  categoryIds: readonly string[];
  actorIds: readonly string[];
  /** Movies only — a series form has none and leaves it out. */
  director?: string | null;
  /** Movies only; null or "" = not set. */
  ageRating?: string | null;
}

function hasText(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "";
}

/** `?.`: an answer cached from before a list existed leaves it out. */
function hasEntries(list: readonly unknown[] | null | undefined): boolean {
  return (list?.length ?? 0) > 0;
}

/** Each detail, present or not, to the two lists of the kind's rule. */
function listsOf(kind: MissingKind, present: Record<MissingKey, boolean>): MissingDetails {
  if (kind === "episode") return { mustHave: [], goodToHave: [] };
  const goodToHave: readonly GoodToHaveKey[] = kind === "series" ? SERIES_GOOD_TO_HAVE_KEYS : GOOD_TO_HAVE_KEYS;
  return {
    mustHave: MUST_HAVE_KEYS.filter((key) => !present[key]),
    goodToHave: goodToHave.filter((key) => !present[key]),
  };
}

/** "episode" for a movie row that belongs to a series: no line, no box and no question for it. */
export function missingKindOfMovie(movie: Pick<Movie, "seriesId">): "movie" | "episode" {
  return movie.seriesId ? "episode" : "movie";
}

/** What a movie as stored still lacks. An episode lacks nothing: two empty lists. */
export function missingMovieDetails(movie: MissingMovieInput): MissingDetails {
  return listsOf(missingKindOfMovie(movie), {
    poster: hasText(movie.posterUrl),
    description: hasText(movie.description) || hasText(movie.descriptionMm),
    categories: hasEntries(movie.categories),
    cover: hasText(movie.coverUrl),
    cast: hasEntries(movie.actors),
    director: hasText(movie.director),
    ageRating: hasText(movie.ageRating),
  });
}

/**
 * The same for the places that draw: null for an episode, so that the line
 * and the box draw nothing instead of a green "Ready".
 */
export function missingMovieDetailsOrNull(movie: MissingMovieInput): MissingDetails | null {
  return missingKindOfMovie(movie) === "episode" ? null : missingMovieDetails(movie);
}

/** What a series as stored still lacks. Director and age rating are never asked of a series. */
export function missingSeriesDetails(series: MissingSeriesInput): MissingDetails {
  return listsOf("series", {
    poster: hasText(series.posterUrl),
    description: hasText(series.description) || hasText(series.descriptionMm),
    categories: hasEntries(series.categories),
    cover: hasText(series.coverUrl),
    cast: hasEntries(series.actors),
    director: true,
    ageRating: true,
  });
}

/**
 * The same rule over what an edit form holds now: the list gets shorter as
 * staff type and pick files. A picked picture file counts as present, a
 * cleared one (no stored address left, no file) as missing.
 */
export function missingFormDetails(kind: MissingKind, form: MissingFormInput): MissingDetails {
  return listsOf(kind, {
    poster: Boolean(form.posterFile) || hasText(form.posterUrl),
    description: hasText(form.description) || hasText(form.descriptionMm),
    categories: hasEntries(form.categoryIds),
    cover: Boolean(form.coverFile) || hasText(form.coverUrl),
    cast: hasEntries(form.actorIds),
    director: hasText(form.director),
    ageRating: hasText(form.ageRating),
  });
}

/**
 * What one Save of the Edit movie dialog sends, as far as the rule reads it.
 * A field left out is not sent: the stored value stays.
 */
export interface MissingSaveInput {
  /** The typed text when it was changed; "" = the box was emptied. */
  description?: string;
  descriptionMm?: string;
  director?: string;
  /** null = set back to "not set". */
  ageRating?: string | null;
  /** The whole list as this save sends it — already rebuilt on the server's copy (`rebaseIds`). */
  categoryIds?: readonly string[];
  actorIds?: readonly string[];
  /** The picture files picked for this save. */
  posterFile?: object | null;
  coverFile?: object | null;
}

/**
 * What a movie will lack once a save has gone through, when the form is
 * behind the server: details from TMDB arrived while it held unsaved
 * changes, so it does not show them. The save sends only what staff
 * changed, and everything else stays as it is stored — so the rule is read
 * over `fresh` (the movie as the server has it now) with the save's own
 * changes on top, not over the form.
 */
export function missingAfterSave(fresh: MissingMovieInput, changed: MissingSaveInput): MissingDetails {
  return missingFormDetails(missingKindOfMovie(fresh), {
    posterUrl: fresh.posterUrl,
    posterFile: changed.posterFile,
    coverUrl: fresh.coverUrl,
    coverFile: changed.coverFile,
    description: changed.description ?? fresh.description,
    descriptionMm: changed.descriptionMm ?? fresh.descriptionMm,
    categoryIds: changed.categoryIds ?? (fresh.categories ?? []).map((c) => c.id),
    actorIds: changed.actorIds ?? (fresh.actors ?? []).map((a) => a.id),
    director: changed.director ?? fresh.director,
    ageRating: changed.ageRating !== undefined ? changed.ageRating : fresh.ageRating,
  });
}

/** Whether Publish asks first: only when something in "must have" is missing. */
export function publishQuestionNeeded(missing: MissingDetails | null | undefined): boolean {
  return (missing?.mustHave.length ?? 0) > 0;
}

/** Something is missing in either list — what "Get from TMDB" is offered for. */
export function anythingMissing(missing: MissingDetails | null | undefined): boolean {
  return publishQuestionNeeded(missing) || (missing?.goodToHave.length ?? 0) > 0;
}

/** The same two lists — for a memoized card to keep the value it already has. */
export function sameMissingDetails(
  a: MissingDetails | null | undefined,
  b: MissingDetails | null | undefined,
): boolean {
  if (!a || !b) return (a ?? null) === (b ?? null);
  return a.mustHave.join() === b.mustHave.join() && a.goodToHave.join() === b.goodToHave.join();
}

/**
 * Which answer about a movie is the newest, for a page that reads the same
 * movie more than once (the upload page: one read of every finished card,
 * one more when TMDB has filled a title in, and what a Save hands back).
 * The answers can land in another order than they were asked, and an older
 * one must never replace a newer one — so every read takes a number when it
 * is SENT, and an answer is taken only while nothing with a higher number
 * was.
 */
export interface AnswerOrder {
  /** The number of a read sent now — or of something known now, like the movie a Save handed back. */
  send(): number;
  /** Whether the answer numbered `seq` about `id` is still news. Taking it makes it the newest one. */
  accept(id: string, seq: number): boolean;
  /** Whether any answer about `id` was ever taken. */
  has(id: string): boolean;
}

export function createAnswerOrder(): AnswerOrder {
  let sent = 0;
  const taken = new Map<string, number>();
  return {
    send: () => ++sent,
    accept(id, seq) {
      if (seq < (taken.get(id) ?? 0)) return false;
      taken.set(id, seq);
      return true;
    },
    has: (id) => taken.has(id),
  };
}

/**
 * Whether a row of Ready to publish offers "Get from TMDB" beside its green
 * badge: the title is linked (MATCHED), staff may act, and something is
 * missing — the review of the linked entry may have it. The caller shows the
 * column only while TMDB is connected.
 */
export function getFromTmdbOffered(
  status: TmdbLookupStatus | null | undefined,
  missing: MissingDetails | null | undefined,
  canAct: boolean,
): boolean {
  return canAct && status === "MATCHED" && anythingMissing(missing);
}

/** Whether a Save of the Edit movie dialog is what publishes the title: its Status field was changed to Published. */
export function saveWillPublish(stored: MovieStatus, form: MovieStatus): boolean {
  return form === "PUBLISHED" && stored !== "PUBLISHED";
}

/**
 * The three looks of the line:
 * - `pending`: the TMDB lookup is still running — grey, and nothing else.
 * - `needs`: something in "must have" is missing — amber, warning icon.
 * - `ready`: nothing in "must have" is missing — green, check icon.
 */
export type MissingLineLook = "pending" | "needs" | "ready";

export interface MissingLineState {
  look: MissingLineLook;
  /** Empty unless `needs`. */
  mustHave: MustHaveKey[];
  /** The grey second line under `needs` and `ready`; always empty for `pending`. */
  goodToHave: GoodToHaveKey[];
}

/**
 * What the line shows. `tmdbPending` only where the TMDB state is known (the
 * Ready to publish list, the upload card): the lists would change under
 * staff's eyes when the details arrive. Null = no line: an episode, or a
 * title whose details are not read yet.
 */
export function missingLineState(
  missing: MissingDetails | null | undefined,
  tmdbPending = false,
): MissingLineState | null {
  if (tmdbPending) return { look: "pending", mustHave: [], goodToHave: [] };
  if (!missing) return null;
  return missing.mustHave.length > 0
    ? { look: "needs", mustHave: missing.mustHave, goodToHave: missing.goodToHave }
    : { look: "ready", mustHave: [], goodToHave: missing.goodToHave };
}

/** Between two names of a list: "Poster · Description". */
export const MISSING_LIST_SEPARATOR = " · ";

/** The short fixed name of one detail: "Poster", "Category", "Banner", "Actors"… */
export function missingKeyLabel(t: TranslationShape, key: MissingKey): string {
  return t.movies.missing.items[key] ?? key;
}

/** "Poster · Description · Category", in the order given. */
export function missingListText(t: TranslationShape, keys: readonly MissingKey[]): string {
  return keys.map((key) => missingKeyLabel(t, key)).join(MISSING_LIST_SEPARATOR);
}

export interface MissingLineWords {
  look: MissingLineLook;
  /** "Still needed: Poster · Description", "Ready", or "The list appears when TMDB has finished." */
  main: string;
  /** The grey second line, "Good to have: Banner · Actors"; null when there is none. */
  goodToHave: string | null;
}

/** The line's words; null = no line (see `missingLineState`). */
export function missingLineWords(
  t: TranslationShape,
  missing: MissingDetails | null | undefined,
  tmdbPending = false,
): MissingLineWords | null {
  const state = missingLineState(missing, tmdbPending);
  if (!state) return null;
  const m = t.movies.missing;
  if (state.look === "pending") return { look: "pending", main: m.appearsWhenTmdbDone, goodToHave: null };
  return {
    look: state.look,
    main: state.look === "needs" ? m.stillNeeded(missingListText(t, state.mustHave)) : m.ready,
    goodToHave: state.goodToHave.length > 0 ? m.goodToHave(missingListText(t, state.goodToHave)) : null,
  };
}

export interface MissingBoxWords {
  /** `needs` = the amber box; `goodOnly` = one quiet grey line and no box. */
  look: "needs" | "goodOnly";
  /** "Still needed before publishing: Poster" ("Still needed: Poster" for a published title) — or, for `goodOnly`, "Good to have: Banner". */
  main: string;
  /** The box's second line: "Good to have: Banner. The list gets shorter as you fill things in."; null for `goodOnly`. */
  second: string | null;
}

/**
 * The words at the top of the Edit movie dialog and of the "Series
 * information" card. Null = nothing to draw: nothing is missing, or the
 * title is an episode (pass null for it). `shrinks` adds "The list gets
 * shorter as you fill things in." — true where the list follows the form.
 * `published`: the title is live already, so "before publishing" would not
 * be true — the amber line is then the plain "Still needed: Poster".
 */
export function missingBoxWords(
  t: TranslationShape,
  missing: MissingDetails | null | undefined,
  shrinks = true,
  published = false,
): MissingBoxWords | null {
  if (!anythingMissing(missing) || !missing) return null;
  const m = t.movies.missing;
  const good = missing.goodToHave.length > 0 ? missingListText(t, missing.goodToHave) : null;
  if (missing.mustHave.length === 0) return { look: "goodOnly", main: m.goodToHave(good ?? ""), second: null };
  let second: string | null;
  if (good === null) second = shrinks ? m.listGetsShorter : null;
  else second = shrinks ? m.goodToHaveThenShorter(good) : m.goodToHave(good);
  const needed = missingListText(t, missing.mustHave);
  return { look: "needs", main: published ? m.stillNeeded(needed) : m.stillNeededBeforePublishing(needed), second };
}

/** The Publish question, named as the shared ConfirmDialog's props so it can be spread onto it. */
export interface PublishQuestionWords {
  title: string;
  description: string;
  /** "Publish anyway" */
  confirmLabel: string;
  /** "Go back" */
  cancelLabel: string;
}

/**
 * The question Publish asks when something in "must have" is missing: one
 * thing names it in the title ("Publish without a poster?"), several say
 * "Publish with details missing?". Null = no question: Publish goes straight
 * through, exactly as before.
 */
export function publishQuestionWords(
  t: TranslationShape,
  kind: "movie" | "series",
  title: string,
  missing: MissingDetails | null | undefined,
): PublishQuestionWords | null {
  if (!missing || missing.mustHave.length === 0) return null;
  const m = t.movies.missing;
  const list = missingListText(t, missing.mustHave);
  const one = missing.mustHave.length === 1;
  let description: string;
  if (kind === "series") {
    description = one ? m.questionBodySeriesOne(title, list) : m.questionBodySeriesSeveral(title, list);
  } else {
    description = one ? m.questionBodyMovieOne(title, list) : m.questionBodyMovieSeveral(title, list);
  }
  return {
    title: one ? m.questionTitleOne[missing.mustHave[0]] : m.questionTitleSeveral,
    description,
    confirmLabel: m.publishAnyway,
    cancelLabel: m.goBack,
  };
}

/**
 * The description of the "Publish this series?" dialog: the sentence it
 * always had and, when something in "must have" is missing, one more —
 * "Still needed: Poster · Category." A series gets no second dialog.
 */
export function seriesPublishDescription(
  t: TranslationShape,
  title: string,
  missing: MissingDetails | null | undefined,
): string {
  const base = t.series.publishConfirmDescription(title);
  if (!missing || missing.mustHave.length === 0) return base;
  return `${base} ${t.movies.missing.seriesPublishStillNeeded(missingListText(t, missing.mustHave))}`;
}
