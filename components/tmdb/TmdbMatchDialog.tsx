"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TmdbFillSummary } from "@/components/tmdb/TmdbFillSummary";
import { TmdbPickStep } from "@/components/tmdb/TmdbPickStep";
import { TmdbReviewStep, type TmdbApplied } from "@/components/tmdb/TmdbReviewStep";
import { useLanguage } from "@/lib/context/language-context";
import type { TmdbField, TmdbFillReport, TmdbMovieState, TmdbSeriesState } from "@/types/tmdb";

/** The title a dialog works on, and what its search starts with. */
export interface TmdbDialogTarget {
  kind: "movie" | "series";
  /** The movie's or the series' id. */
  id: string;
  /** The upload's raw folder name (movies), shown above the search; null when there is none. */
  sourceName: string | null;
  /** What the search box starts with — both parts editable. */
  search: { query: string; year: number | null };
  /** The TMDB entry the title is linked to now; null = not linked. A Refill reviews this one. */
  tmdbId: number | null;
  /** The details that still hold their automatic value: where the new entry has nothing for one, Apply takes it back. */
  autoFields: readonly TmdbField[];
}

/**
 * The dialog's target for a movie. `state` is its TMDB state when the page
 * has read it; without one the search starts from the movie's own title.
 */
export function tmdbTargetOfMovie(
  movie: { id: string; title: string },
  state: TmdbMovieState | null | undefined,
): TmdbDialogTarget {
  return {
    kind: "movie",
    id: movie.id,
    sourceName: state?.sourceName ?? null,
    search: state?.search.query ? state.search : { query: movie.title, year: null },
    tmdbId: state?.tmdbId ?? null,
    autoFields: state?.autoFields ?? [],
  };
}

/** The dialog's target for a series: the search starts from the series title. */
export function tmdbTargetOfSeries(
  series: { id: string; title: string },
  state: TmdbSeriesState | null | undefined,
): TmdbDialogTarget {
  return {
    kind: "series",
    id: series.id,
    sourceName: null,
    search: state?.search.query ? state.search : { query: series.title, year: null },
    tmdbId: state?.tmdbId ?? null,
    autoFields: state?.autoFields ?? [],
  };
}

interface Picked {
  tmdbId: number;
  posterPreviewUrl: string | null;
  origin: "picked" | "current";
}

interface TmdbMatchFlowProps {
  target: TmdbDialogTarget;
  start: "pick" | "refill";
  onClose: () => void;
  onApplied: (result: TmdbApplied) => void;
  onApplyFailed?: () => void;
  onApplyingChange: (applying: boolean) => void;
}

function TmdbMatchFlow({ target, start, onClose, onApplied, onApplyFailed, onApplyingChange }: TmdbMatchFlowProps) {
  const { t } = useLanguage();
  // A Refill opens straight on the review of the entry the title has; with
  // nothing linked there is nothing to refill, so it starts at the list.
  const refill = start === "refill" && target.tmdbId !== null;
  const [picked, setPicked] = useState<Picked | null>(
    refill && target.tmdbId !== null ? { tmdbId: target.tmdbId, posterPreviewUrl: null, origin: "current" } : null,
  );
  // The list is mounted the first time it is shown and then kept (hidden
  // during the review), so Back returns to the same words and the same
  // results instead of searching again. A Refill never mounts it unless
  // staff press Back.
  const [listOpened, setListOpened] = useState(!refill);
  // What the Apply answered, with the fields it named.
  const [applied, setApplied] = useState<{ report: TmdbFillReport; sent: TmdbField[] } | null>(null);
  const report = applied?.report ?? null;

  const step = report ? "done" : picked ? "review" : "pick";
  const heading =
    step === "done"
      ? { title: t.tmdb.done.title, description: null }
      : step === "review"
        ? { title: t.tmdb.review.title, description: t.tmdb.review.step }
        : {
            title: t.tmdb.pick.title,
            description: target.kind === "movie" ? t.tmdb.pick.stepMovie : t.tmdb.pick.stepSeries,
          };

  return (
    <>
      <DialogHeader>
        <DialogTitle>{heading.title}</DialogTitle>
        {heading.description && <DialogDescription>{heading.description}</DialogDescription>}
      </DialogHeader>

      {listOpened && !report && (
        <div className="grid gap-4" hidden={picked !== null}>
          <TmdbPickStep
            kind={target.kind}
            sourceName={target.sourceName}
            initialSearch={target.search}
            currentTmdbId={target.tmdbId}
            onCancel={onClose}
            onContinue={(result) =>
              setPicked({ tmdbId: result.tmdbId, posterPreviewUrl: result.posterPreviewUrl, origin: "picked" })
            }
          />
        </div>
      )}

      {picked && !report && (
        <TmdbReviewStep
          key={picked.tmdbId}
          kind={target.kind}
          titleId={target.id}
          tmdbId={picked.tmdbId}
          posterPreviewUrl={picked.posterPreviewUrl}
          origin={picked.origin}
          autoFields={target.autoFields}
          onBack={() => {
            setListOpened(true);
            setPicked(null);
          }}
          onApplied={(result) => {
            setApplied({ report: result.report, sent: result.sent });
            onApplied(result);
          }}
          onApplyFailed={onApplyFailed}
          onApplyingChange={onApplyingChange}
        />
      )}

      {applied && (
        <>
          <TmdbFillSummary report={applied.report} sent={applied.sent} />
          <DialogFooter>
            <Button type="button" onClick={onClose}>
              {t.tmdb.done.close}
            </Button>
          </DialogFooter>
        </>
      )}
    </>
  );
}

interface TmdbMatchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The title to fill; null while the dialog is closed. */
  target: TmdbDialogTarget | null;
  /**
   * `pick` opens on the list — Pick a match, Search TMDB, Change match, and
   * a series' Find details. `refill` opens on the review of the entry the
   * title is already linked to, with fresh data from TMDB.
   */
  start?: "pick" | "refill";
  /**
   * The details were written. The page takes the stored title from the
   * result (or reloads it) at once — the dialog stays open on the summary
   * until staff press Done.
   */
  onApplied: (result: TmdbApplied) => void;
  /** An Apply was refused or broke off: reload the form from the server so nothing half-done is shown. */
  onApplyFailed?: () => void;
}

/**
 * The two-step TMDB dialog (2026-11-06, the `Pick` and `Review` boards):
 * "Pick a match" — search and choose the right film or show — then "Review
 * details" — one switch per detail — then a short summary of what was
 * filled in. One dialog for movies and series alike; a series' review simply
 * has no length, director or age rating line.
 *
 * Nothing is written before Apply, and Apply writes only the lines left
 * switched on — and takes back what the previous match left in a detail the
 * new one has nothing for. While it runs ("Saving pictures and cast…") the
 * dialog cannot be closed: the request would carry on unseen and its result
 * would be lost.
 */
export function TmdbMatchDialog({
  open,
  onOpenChange,
  target,
  start = "pick",
  onApplied,
  onApplyFailed,
}: TmdbMatchDialogProps) {
  const [applying, setApplying] = useState(false);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && applying) return;
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-2xl" showCloseButton={!applying}>
        {open && target && (
          <TmdbMatchFlow
            key={`${target.kind}:${target.id}:${start}`}
            target={target}
            start={start}
            onClose={() => onOpenChange(false)}
            onApplied={onApplied}
            onApplyFailed={onApplyFailed}
            onApplyingChange={setApplying}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
