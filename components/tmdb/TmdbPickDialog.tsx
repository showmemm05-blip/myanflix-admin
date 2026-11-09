"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TmdbPickStep } from "@/components/tmdb/TmdbPickStep";
import { useLanguage } from "@/lib/context/language-context";
import type { TmdbSearchResult } from "@/types/tmdb";

interface TmdbPickDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  kind: "movie" | "series";
  /** What the search starts with — the name typed in the form that opened it. */
  initialQuery: string;
  /**
   * The candidate staff chose. The page closes the dialog and carries on —
   * for a new series, to the "Create this series from TMDB?" confirm. A
   * candidate one of our titles is already linked to arrives with `usedBy`
   * set, so the page can say "You already have this show" instead.
   */
  onPicked: (result: TmdbSearchResult) => void;
}

/**
 * "Pick a match" on its own (2026-11-06, the `SeriesCreate` board): the
 * same list as step 1 of the two-step dialog, for the one place where
 * picking is all there is — "Find on TMDB" in the Create Series dialog,
 * where there is no series yet to review details against. It opens over the
 * form that asked and hands the chosen candidate back.
 */
export function TmdbPickDialog({ open, onOpenChange, kind, initialQuery, onPicked }: TmdbPickDialogProps) {
  const { t } = useLanguage();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        {open && (
          <>
            <DialogHeader>
              <DialogTitle>{t.tmdb.pick.title}</DialogTitle>
              <DialogDescription>
                {kind === "movie" ? t.tmdb.pick.chooseMovie : t.tmdb.pick.chooseSeries}
              </DialogDescription>
            </DialogHeader>
            <TmdbPickStep
              kind={kind}
              initialSearch={{ query: initialQuery, year: null }}
              onCancel={() => onOpenChange(false)}
              onContinue={onPicked}
            />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
