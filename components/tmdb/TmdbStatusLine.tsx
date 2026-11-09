"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TmdbBadge } from "@/components/tmdb/TmdbBadge";
import { tmdbBadgeOf, type TmdbAction } from "@/components/tmdb/tmdbStatus";
import { tmdbActionLabel, tmdbMatchLabel, tmdbStatusNote } from "@/components/tmdb/tmdbWords";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import type { TmdbMovieState } from "@/types/tmdb";

interface TmdbStatusLineProps {
  /** The movie's lookup state; undefined while it is not known (not read yet, an episode) — then nothing is drawn. */
  state: TmdbMovieState | undefined;
  /**
   * Also write the sentence beside the badge — "Inception (2010)", "More
   * than one movie has this name." — and push the button to the far end, as
   * on an upload card. The table's narrow Details column leaves it out.
   */
  withNote?: boolean;
  /** May start a lookup or open the dialog (MOVIES.EDIT). Without it the badge shows and the buttons do not. */
  canAct: boolean;
  /** Also offer "Find details" for a title never looked up. The table keeps that one in its row menu instead. */
  offerLookup?: boolean;
  /** A lookup request for this movie is on its way: the button waits. */
  busy?: boolean;
  /** The list stopped polling after 3 minutes (use-tmdb-states `timedOut`): a row still "Finding details…" gets Try again. */
  timedOut?: boolean;
  onAction: (action: TmdbAction) => void;
  className?: string;
}

/**
 * One movie's TMDB status as a row of a list shows it (2026-11-06, the
 * `Ready` and `Upload` boards): the badge and, beside it, the one button
 * that goes with the status — Pick a match, Search TMDB or Try again. The
 * page decides what a press does (`onAction`): `lookup` / `retry` start the
 * background lookup, `pick` / `search` open the dialog, `refresh` reads the
 * states again.
 */
export function TmdbStatusLine({
  state,
  withNote = false,
  canAct,
  offerLookup = false,
  busy = false,
  timedOut = false,
  onAction,
  className,
}: TmdbStatusLineProps) {
  const { t } = useLanguage();
  if (!state) return null;

  const badge = tmdbBadgeOf(state.status, state.error);
  const stuck = badge.look === "finding" && timedOut;
  let action: TmdbAction | null = stuck ? "refresh" : badge.action;
  if (badge.look === "none" && !offerLookup) action = null;
  // Reading the states again changes nothing, so anyone who sees the row may ask.
  if (!canAct && action !== "refresh") action = null;
  if (badge.look === "none" && action === null) return null;

  const note = stuck
    ? t.tmdb.notes.timedOut
    : badge.look === "matched"
      ? tmdbMatchLabel(t, state.match)
      : tmdbStatusNote(t, state.status, state.error);

  return (
    <div className={cn("flex flex-wrap items-center gap-x-2.5 gap-y-1.5 whitespace-normal", className)}>
      <TmdbBadge status={state.status} error={state.error} match={state.match} />
      {withNote && note && <span className="text-[13px] leading-snug text-muted-foreground">{note}</span>}
      {action && (
        <Button
          variant="outline"
          size="sm"
          className={cn(withNote && "ml-auto")}
          disabled={busy}
          onClick={() => onAction(action)}
        >
          {busy && <Loader2 className="size-3.5 animate-spin" />}
          {tmdbActionLabel(t, action)}
        </Button>
      )}
    </div>
  );
}
