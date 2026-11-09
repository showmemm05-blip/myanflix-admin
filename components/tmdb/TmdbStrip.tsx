"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TmdbBadge } from "@/components/tmdb/TmdbBadge";
import { tmdbBadgeOf, type TmdbAction } from "@/components/tmdb/tmdbStatus";
import { tmdbActionLabel, tmdbLinkedLine, tmdbStatusNote } from "@/components/tmdb/tmdbWords";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import type { TmdbLookupError, TmdbLookupStatus, TmdbMovieState, TmdbSeriesState } from "@/types/tmdb";

interface TmdbStripProps {
  /** The title's TMDB state; null while it loads. A movie's carries a lookup status and the folder name, a series' only says linked or not. */
  state: TmdbMovieState | TmdbSeriesState | null;
  /** The server has no TMDB key: the strip says so and shows no buttons — only the folder name, when the state has one. */
  notConnected?: boolean;
  /** The form has unsaved changes: the buttons are greyed, with "Save your changes first" under them. */
  unsaved?: boolean;
  /** May use the TMDB actions (MOVIES.EDIT / SERIES.EDIT). Without it the strip only reports. */
  canAct: boolean;
  /** A lookup request is on its way: the buttons wait. */
  busy?: boolean;
  /** Polling stopped after 3 minutes with the lookup still running: "Finding details…" gets Try again. */
  timedOut?: boolean;
  onAction: (action: TmdbAction) => void;
  className?: string;
}

function isMovieState(state: TmdbMovieState | TmdbSeriesState): state is TmdbMovieState {
  return "movieId" in state;
}

/**
 * The TMDB strip at the top of the Edit movie dialog and of the "Series
 * information" card (2026-11-06, the `EditMovie` and `SeriesInfo` boards):
 * the folder the upload came from, the status badge, and for a linked title
 * "Inception (2010) · fetched 6 Nov 2026" with Refill and Change match.
 * Every other status brings its own button — Find details, Pick a match,
 * Search TMDB, Try again.
 *
 * A series has no lookup of its own, so its strip has two states: not
 * linked (Find details, which opens the list straight away) and linked.
 *
 * The strip only reports and asks: `onAction` is the page's, which starts
 * the lookup or opens the dialog. While the form has unsaved changes the
 * buttons are greyed — a fill would be reviewed against what is stored, not
 * against what is typed.
 */
export function TmdbStrip({
  state,
  notConnected = false,
  unsaved = false,
  canAct,
  busy = false,
  timedOut = false,
  onAction,
  className,
}: TmdbStripProps) {
  const { t } = useLanguage();
  const box = cn("flex flex-col gap-2 rounded-lg border border-border bg-secondary/20 p-3", className);

  if (notConnected) {
    // The folder name is shown all the same: the title was cut out of it
    // when the movie was born, and with no lookup to correct a bad cut it
    // is how staff check the name and the year they are about to publish.
    const folder = state && isMovieState(state) ? state.sourceName : null;
    return (
      <section aria-label={t.tmdb.strip.label} className={box}>
        {folder && <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{t.tmdb.folder(folder)}</p>}
        <p className="text-[13px] leading-snug text-muted-foreground">{t.tmdb.strip.notConnected}</p>
      </section>
    );
  }

  if (!state) {
    return (
      <section aria-label={t.tmdb.strip.label} className={box}>
        <p className="flex items-center gap-2 text-[13px] text-muted-foreground" role="status">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {t.tmdb.strip.checking}
        </p>
      </section>
    );
  }

  const movie = isMovieState(state) ? state : null;
  // A series is "matched" once it carries a TMDB id, and "never looked up" until then.
  const status: TmdbLookupStatus = movie ? movie.status : state.tmdbId !== null ? "MATCHED" : "NONE";
  const error: TmdbLookupError | null = movie ? movie.error : null;
  const badge = tmdbBadgeOf(status, error);
  const stuck = badge.look === "finding" && timedOut;

  // What each button does; a label can differ from its action (a series'
  // "Find details" opens the list, because nothing looks a series up by itself).
  const buttons: { action: TmdbAction; label: string }[] = [];
  if (badge.look === "matched") {
    buttons.push({ action: "refill", label: tmdbActionLabel(t, "refill") });
    buttons.push({ action: "change", label: tmdbActionLabel(t, "change") });
  } else if (stuck) {
    buttons.push({ action: "refresh", label: tmdbActionLabel(t, "refresh") });
  } else if (badge.look === "none" && !movie) {
    buttons.push({ action: "pick", label: tmdbActionLabel(t, "lookup") });
  } else if (badge.action) {
    buttons.push({ action: badge.action, label: tmdbActionLabel(t, badge.action) });
  }
  // Reading the state again changes nothing, so it needs no permission.
  const shown = canAct ? buttons : buttons.filter((button) => button.action === "refresh");
  const blocked = unsaved && shown.some((button) => button.action !== "refresh");

  const line = stuck
    ? t.tmdb.notes.timedOut
    : badge.look === "matched"
      ? tmdbLinkedLine(t, state.match, state.fetchedAt)
      : tmdbStatusNote(t, status, error);

  return (
    <section aria-label={t.tmdb.strip.label} className={box}>
      {movie?.sourceName && (
        <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{t.tmdb.folder(movie.sourceName)}</p>
      )}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-2">
        <TmdbBadge status={status} error={error} match={state.match} />
        {line && <span className="min-w-0 text-[13px] leading-snug text-muted-foreground">{line}</span>}
        {shown.length > 0 && (
          <span className="ml-auto flex flex-wrap items-center gap-2">
            {shown.map((button) => (
              <Button
                key={button.action}
                type="button"
                variant="secondary"
                size="sm"
                disabled={busy || (unsaved && button.action !== "refresh")}
                onClick={() => onAction(button.action)}
              >
                {busy && (button.action === "lookup" || button.action === "retry") && (
                  <Loader2 className="size-3.5 animate-spin" />
                )}
                {button.label}
              </Button>
            ))}
          </span>
        )}
      </div>
      {blocked && <p className="text-xs text-muted-foreground sm:text-right">{t.tmdb.strip.saveFirst}</p>}
    </section>
  );
}
