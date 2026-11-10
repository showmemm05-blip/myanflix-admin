/**
 * Which badge and which button a movie's TMDB lookup status gets (2026-11-06,
 * docs/movie-details-tmdb-2026-11-06/PLAN.md §6) — one small shared piece
 * with six looks, so Ready to publish, the upload cards and the Edit dialog
 * say the same thing the same way:
 *
 *   PENDING     blue, spinner   "Finding details…"        no button
 *   MATCHED     green           "Details from TMDB"       no button
 *   NEEDS_PICK  amber           "Several matches"         Pick a match
 *   NOT_FOUND   grey            "Not found on TMDB"       Search TMDB
 *   FAILED      red             why it failed             Try again
 *   NONE        no badge                                  Find details
 *
 * Data only, no words: tmdbWords.ts turns the keys into sentences. Pure and
 * with type imports only, so Node's test runner loads it as it is
 * (tmdbStatus.test.ts).
 */
import type { StatusTone } from "@/components/shared/StatusBadge";
import type { TmdbImageSource, TmdbLookupError, TmdbLookupStatus } from "@/types/tmdb";

/** The six looks of the badge; `none` draws nothing. */
export type TmdbBadgeLook = "finding" | "matched" | "needsPick" | "notFound" | "failed" | "none";

/** The badge's words — a key of `t.tmdb.badge`. A FAILED lookup has one per reason. */
export type TmdbBadgeLabel =
  | "finding"
  | "matched"
  | "needsPick"
  | "notFound"
  | "unreachable"
  | "busy"
  | "keyRejected"
  | "interrupted"
  | "failed";

/**
 * Everything staff can start from a badge, a strip or a row menu — a key of
 * `t.tmdb.actions`:
 * - `lookup` / `retry`: one click, no dialog — the automatic lookup runs
 *   again in the background (POST /tmdb/movies/:id/lookup).
 * - `pick` / `search` / `change`: open the pick-a-match dialog.
 * - `refill`: open the review of the entry the title is linked to.
 * - `refresh`: polling gave up after 3 minutes — read the state again.
 */
export type TmdbAction = "lookup" | "retry" | "pick" | "search" | "change" | "refill" | "refresh";

export interface TmdbBadge {
  look: TmdbBadgeLook;
  /** Null for `none`: nothing is drawn. */
  label: TmdbBadgeLabel | null;
  tone: StatusTone | null;
  /** The button that goes with the status; null when there is nothing to press. */
  action: TmdbAction | null;
}

/** The red badge says why: each reason has its own words; an unknown or absent one falls back to the plain "couldn't get details". */
const FAILED_LABELS: Record<TmdbLookupError, TmdbBadgeLabel> = {
  unreachable: "unreachable",
  rate_limited: "busy",
  key_rejected: "keyRejected",
  interrupted: "interrupted",
  internal: "failed",
};

export function tmdbBadgeOf(status: TmdbLookupStatus, error: TmdbLookupError | null = null): TmdbBadge {
  switch (status) {
    case "PENDING":
      return { look: "finding", label: "finding", tone: "info", action: null };
    case "MATCHED":
      return { look: "matched", label: "matched", tone: "success", action: null };
    case "NEEDS_PICK":
      return { look: "needsPick", label: "needsPick", tone: "warning", action: "pick" };
    case "NOT_FOUND":
      return { look: "notFound", label: "notFound", tone: "neutral", action: "search" };
    case "FAILED":
      return {
        look: "failed",
        label: (error && FAILED_LABELS[error]) || "failed",
        tone: "danger",
        action: "retry",
      };
    default:
      // NONE — and any status a newer backend might add: no badge, and the
      // one thing that is always safe to offer.
      return { look: "none", label: null, tone: null, action: "lookup" };
  }
}

/** Whether pressing this starts a dialog (pick / review) rather than a background lookup or a re-read. */
export function tmdbActionOpensDialog(action: TmdbAction): action is "pick" | "search" | "change" | "refill" {
  return action === "pick" || action === "search" || action === "change" || action === "refill";
}

/**
 * Whether a picture slot of a form carries the "From TMDB" tag: the state
 * says the stored picture came from TMDB, the form really shows a stored
 * picture, and no new file has been picked. The state can be newer than the
 * movie the form was loaded from (details arrived while staff were typing,
 * so the form was not loaded again): a tag over an empty slot would say
 * TMDB gave a picture that is not there to see.
 */
export function pictureTagShown(
  source: TmdbImageSource | null | undefined,
  storedUrl: string | null | undefined,
  filePicked: boolean,
): boolean {
  return source === "tmdb" && Boolean(storedUrl) && !filePicked;
}
