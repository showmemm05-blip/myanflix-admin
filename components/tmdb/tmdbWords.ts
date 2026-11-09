/**
 * Small helpers that turn TMDB data into the words the admin shows
 * (2026-11-06, docs/movie-details-tmdb-2026-11-06) — so the badge, the
 * strip, the dialog and the pages say the same thing the same way. The copy
 * is `t.tmdb` in lib/i18n/translations.ts; the rules are in tmdbStatus.ts and
 * tmdbReview.ts.
 */
import { format } from "date-fns";
import { ApiError } from "@/services/api/apiClient";
import type { TranslationShape } from "@/lib/i18n/translations";
import { tmdbBadgeOf, type TmdbAction, type TmdbBadge } from "@/components/tmdb/tmdbStatus";
import {
  TMDB_ERROR_CODES,
  type TmdbErrorCode,
  type TmdbField,
  type TmdbLookupError,
  type TmdbLookupStatus,
  type TmdbMatch,
} from "@/types/tmdb";

/** "Inception (2010)"; just the name when TMDB knows no year; "" for no match. */
export function tmdbMatchLabel(t: TranslationShape, match: TmdbMatch | null | undefined): string {
  if (!match) return "";
  return match.year === null ? match.title : t.tmdb.matchWithYear(match.title, match.year);
}

/** "fetched 6 Nov 2026" — the day the details were last read from TMDB; "" when never or unreadable. */
export function tmdbFetchedText(t: TranslationShape, fetchedAt: string | null | undefined): string {
  if (!fetchedAt) return "";
  const date = new Date(fetchedAt);
  return Number.isNaN(date.getTime()) ? "" : t.tmdb.fetchedOn(format(date, "d MMM yyyy"));
}

/** "Inception (2010) · fetched 6 Nov 2026" — the strip's line for a linked title; whichever half is known. */
export function tmdbLinkedLine(
  t: TranslationShape,
  match: TmdbMatch | null | undefined,
  fetchedAt: string | null | undefined,
): string {
  return [tmdbMatchLabel(t, match), tmdbFetchedText(t, fetchedAt)].filter(Boolean).join(" · ");
}

/** The badge's words; "" for the status that draws no badge. */
export function tmdbBadgeLabel(t: TranslationShape, badge: TmdbBadge): string {
  return badge.label ? t.tmdb.badge[badge.label] : "";
}

/** "Pick a match", "Search TMDB", "Try again"… */
export function tmdbActionLabel(t: TranslationShape, action: TmdbAction): string {
  return t.tmdb.actions[action];
}

/**
 * The sentence that goes with a lookup status on an upload card and in the
 * strip: what is happening, or what to do next. A matched title has none —
 * its line is the match itself (`tmdbLinkedLine`).
 */
export function tmdbStatusNote(
  t: TranslationShape,
  status: TmdbLookupStatus,
  error: TmdbLookupError | null = null,
): string {
  const notes = t.tmdb.notes;
  const badge = tmdbBadgeOf(status, error);
  switch (badge.look) {
    case "finding":
      return notes.finding;
    case "needsPick":
      return notes.needsPick;
    case "notFound":
      return notes.notFound;
    case "failed": {
      // The red badge's own key names the reason, and the notes use the same keys.
      const reason = badge.label;
      return reason === "unreachable" || reason === "busy" || reason === "keyRejected" || reason === "interrupted"
        ? notes[reason]
        : notes.failed;
    }
    case "none":
      return notes.none;
    default:
      return "";
  }
}

/** The name of one detail in the review and its summary: "Name", "Banner", "Actors"… */
export function tmdbFieldLabel(t: TranslationShape, field: TmdbField): string {
  return t.tmdb.review.fields[field] ?? field;
}

function isTmdbErrorCode(code: string | undefined): code is TmdbErrorCode {
  return (TMDB_ERROR_CODES as readonly string[]).includes(code ?? "");
}

/** The backend's coded refusal of a /tmdb route, when the error is one. */
export function tmdbErrorCode(err: unknown): TmdbErrorCode | null {
  return err instanceof ApiError && isTmdbErrorCode(err.code) ? err.code : null;
}

/**
 * The words for a refused /tmdb request: a known `code` in the admin's
 * language, otherwise the server's own sentence (the client's "couldn't
 * reach the server" is already bilingual), otherwise the plain fallback.
 */
export function tmdbErrorMessage(err: unknown, t: TranslationShape): string {
  const code = tmdbErrorCode(err);
  if (code) return t.tmdb.errors[code];
  return err instanceof ApiError && err.message ? err.message : t.common.somethingWentWrong;
}
