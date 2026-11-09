/**
 * What the Edit movie dialog sends on Save: only the fields staff changed
 * (2026-11-06, docs/movie-details-tmdb-2026-11-06/PLAN.md §6).
 *
 * The dialog used to echo the whole record back. Details can now change on
 * the server while it is open — a TMDB fill adds a cast, a poster, a
 * description — and a finished upload moves the status on its own, so an
 * echo would wipe the cast TMDB just added and could push a finished upload
 * back to UPLOADING. Sending the difference also keeps a field staff never
 * touched "untouched" for the next fill: the backend only treats a value as
 * staff's own once it stops being the automatic one.
 *
 * `loaded` is the movie as the dialog loaded it (GET /movies/:id); `form` is
 * what the form holds now, already parsed. A field the form does not show
 * for this title — the type and rating of an episode, the episode numbers of
 * a movie — is left out of `form` and is never sent. Nothing changed = an
 * empty object: the dialog closes without a request.
 *
 * Pure and with type imports only, so Node's test runner loads the file as
 * it is (changed-fields.test.ts).
 */
import type { AgeRating } from "@/lib/constants/movie-options";
import type { AccessType, Movie, MovieStatus, MovieUploadFormValues } from "@/types/movie";

/** The body of PUT /movies/:id — services/api/movieService.ts `updateMovie`. */
export type MovieUpdatePayload = Partial<MovieUploadFormValues> & {
  status?: MovieStatus;
  seasonNumber?: number;
  episodeNumber?: number;
};

/** The Edit movie form at the moment Save is pressed. Every entry is optional: absent = the form does not edit that field. */
export interface MovieFormSnapshot {
  title?: string;
  description?: string;
  descriptionMm?: string;
  genre?: string;
  language?: string;
  /** The TYPE word; null = "Not set". */
  country?: string | null;
  director?: string;
  ageRating?: AgeRating | null;
  releaseYear?: number;
  /** Whole minutes; anything below 1 is "not entered" and is never sent (0 is the API's unknown sentinel and the DTO rejects it). */
  duration?: number;
  /** 0–10; 0 = not rated. */
  rating?: number;
  accessType?: AccessType;
  status?: MovieStatus;
  categoryIds?: readonly string[];
  actorIds?: readonly string[];
  /** Only when a new picture was uploaded for this save: the URL the upload answered. */
  posterUrl?: string;
  coverUrl?: string;
  thumbnailUrl?: string;
  seasonNumber?: number;
  episodeNumber?: number;
}

/** Same ids, whatever the order — a cast or category list is a set. */
function sameIds(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false;
  const seen = new Set(a);
  return b.every((id) => seen.has(id));
}

/**
 * A text field counts as changed when it differs after trimming both sides,
 * so a stray space is not an edit; what is sent is the trimmed text.
 */
function changedText(typed: string | undefined, stored: string | null | undefined): string | undefined {
  if (typed === undefined) return undefined;
  const next = typed.trim();
  return next === (stored ?? "").trim() ? undefined : next;
}

/** A whole number the API would accept in this slot, different from the stored one. */
function changedInt(typed: number | undefined, stored: number | null | undefined, min: number): number | undefined {
  if (typed === undefined || !Number.isInteger(typed) || typed < min) return undefined;
  return typed === stored ? undefined : typed;
}

/** The fields of `form` that differ from `loaded`, shaped as the update body. */
export function buildMovieUpdate(loaded: Movie, form: MovieFormSnapshot): MovieUpdatePayload {
  const payload: MovieUpdatePayload = {};

  const title = changedText(form.title, loaded.title);
  // An emptied title is not a change to send: the API requires one.
  if (title) payload.title = title;

  // "" is a value for both descriptions: a title may have only one of them,
  // and the backend stores an empty Burmese text as null.
  const description = changedText(form.description, loaded.description);
  if (description !== undefined) payload.description = description;
  const descriptionMm = changedText(form.descriptionMm, loaded.descriptionMm);
  if (descriptionMm !== undefined) payload.descriptionMm = descriptionMm;

  // Genre and language cannot be cleared (the API wants one character at
  // least), so an empty pick is never sent — a title born without them stays
  // as it is until staff choose a word.
  const genre = changedText(form.genre, loaded.genre);
  if (genre) payload.genre = genre;
  const language = changedText(form.language, loaded.language);
  if (language) payload.language = language;

  // "" clears these two; null on the form is "Not set".
  if (form.country !== undefined) {
    const country = changedText(form.country ?? "", loaded.country);
    if (country !== undefined) payload.country = country;
  }
  const director = changedText(form.director, loaded.director);
  if (director !== undefined) payload.director = director;

  // null clears the age rating back to "not set".
  if (form.ageRating !== undefined && (form.ageRating ?? null) !== (loaded.ageRating ?? null)) {
    payload.ageRating = form.ageRating;
  }

  const releaseYear = changedInt(form.releaseYear, loaded.releaseYear, 1);
  if (releaseYear !== undefined) payload.releaseYear = releaseYear;
  const duration = changedInt(form.duration, loaded.duration, 1);
  if (duration !== undefined) payload.duration = duration;

  if (form.rating !== undefined && Number.isFinite(form.rating) && form.rating !== loaded.rating) {
    payload.rating = form.rating;
  }
  if (form.accessType !== undefined && form.accessType !== loaded.accessType) {
    payload.accessType = form.accessType;
  }
  if (form.status !== undefined && form.status !== loaded.status) {
    payload.status = form.status;
  }

  // The API `set`s these lists, so they go out whole — but only when staff
  // really added or removed someone.
  if (form.categoryIds && !sameIds(form.categoryIds, loaded.categories.map((c) => c.id))) {
    payload.categoryIds = [...form.categoryIds];
  }
  if (form.actorIds && !sameIds(form.actorIds, loaded.actors.map((a) => a.id))) {
    payload.actorIds = [...form.actorIds];
  }

  if (form.posterUrl && form.posterUrl !== loaded.posterUrl) payload.posterUrl = form.posterUrl;
  if (form.coverUrl && form.coverUrl !== loaded.coverUrl) payload.coverUrl = form.coverUrl;
  if (form.thumbnailUrl && form.thumbnailUrl !== loaded.thumbnailUrl) payload.thumbnailUrl = form.thumbnailUrl;

  const seasonNumber = changedInt(form.seasonNumber, loaded.seasonNumber, 1);
  if (seasonNumber !== undefined) payload.seasonNumber = seasonNumber;
  const episodeNumber = changedInt(form.episodeNumber, loaded.episodeNumber, 1);
  if (episodeNumber !== undefined) payload.episodeNumber = episodeNumber;

  return payload;
}

/**
 * A cast or category list to send, rebuilt on the list as the server holds
 * it at the moment of the save. The API `set`s these lists whole, and the
 * form's copy can be behind: opened while the folder still uploads, it has
 * no cast at all, and the ten actors TMDB adds when the upload finishes
 * would be wiped by a save that only meant to add one.
 *
 * So only staff's own edit is applied — `fresh − (loaded − form) + (form −
 * loaded)`: whoever they removed leaves, whoever they added joins, and
 * everyone who arrived on the server meanwhile stays. `fresh` order first.
 */
export function rebaseIds(
  loaded: readonly string[],
  form: readonly string[],
  fresh: readonly string[],
): string[] {
  const kept = new Set(form);
  const known = new Set(loaded);
  const rebased = fresh.filter((id) => !known.has(id) || kept.has(id));
  const present = new Set(rebased);
  for (const id of form) {
    if (!known.has(id) && !present.has(id)) rebased.push(id);
  }
  return rebased;
}

/** False = nothing to save: close the dialog without a request. */
export function hasChanges(payload: MovieUpdatePayload): boolean {
  return Object.keys(payload).length > 0;
}
