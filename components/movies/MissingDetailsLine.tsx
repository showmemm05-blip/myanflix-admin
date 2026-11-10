"use client";

import { AlertTriangle, Check, ImageIcon } from "lucide-react";
import { missingBoxWords, missingLineWords, type MissingDetails } from "@/components/movies/missingDetails";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";

interface MissingDetailsLineProps {
  /**
   * What the title still lacks (missingDetails.ts). Null or undefined = not
   * known, or an episode: nothing is drawn, unless `pending`.
   */
  missing: MissingDetails | null | undefined;
  /**
   * The TMDB lookup of this title is still running — only where the TMDB
   * state is known (the Ready to publish list, the upload card). The line
   * then only says that the list appears when TMDB has finished.
   */
  pending?: boolean;
  className?: string;
}

/**
 * What a title still needs before it is published (2026-11-09, the `Missing`
 * and `MissingEdit` boards), as a row of Ready to publish and a finished
 * upload card show it: amber "Still needed: Poster · Description" with a
 * warning icon, or green "Ready" with a check, and under either a grey
 * "Good to have: Banner · Actors" when there is something to say. The colour
 * is never the only signal: every state has its icon and its words.
 *
 * It wraps by itself, so it also fits a table cell (cells do not wrap):
 * give it the cell's width, e.g. `className="max-w-52"`.
 */
export function MissingDetailsLine({ missing, pending = false, className }: MissingDetailsLineProps) {
  const { t } = useLanguage();
  const words = missingLineWords(t, missing, pending);
  if (!words) return null;

  if (words.look === "pending") {
    return <p className={cn("text-xs whitespace-normal text-muted-foreground", className)}>{words.main}</p>;
  }

  const needs = words.look === "needs";
  const Icon = needs ? AlertTriangle : Check;
  return (
    <div className={cn("flex flex-col gap-0.5 whitespace-normal [overflow-wrap:anywhere]", className)}>
      <p
        className={cn(
          "flex items-start gap-1.5 text-[13px] leading-snug font-semibold",
          needs ? "text-warning" : "text-success",
        )}
      >
        <Icon className="size-3.5 shrink-0 translate-y-0.5" aria-hidden />
        <span>{words.main}</span>
      </p>
      {words.goodToHave && <p className="text-xs text-muted-foreground">{words.goodToHave}</p>}
    </div>
  );
}

interface MissingDetailsBoxProps {
  /** What the title still lacks. Null or undefined (an episode), or nothing missing: nothing is drawn. */
  missing: MissingDetails | null | undefined;
  /**
   * Also say "The list gets shorter as you fill things in." — for a list
   * that follows what the form holds now. Pass false where it follows the
   * stored title.
   */
  shrinks?: boolean;
  /**
   * The title is published already (its stored status): the amber line then
   * says "Still needed: Poster" — "before publishing" would not be true.
   */
  published?: boolean;
  className?: string;
}

/**
 * The same at the top of the Edit movie dialog and of the "Series
 * information" card (the `MissingEdit` board): an amber box "Still needed
 * before publishing: Poster" with "Good to have: Banner. The list gets
 * shorter as you fill things in." under it. When only "good to have" things
 * are missing it is one quiet grey line and no box; when nothing is missing,
 * nothing at all.
 */
export function MissingDetailsBox({ missing, shrinks = true, published = false, className }: MissingDetailsBoxProps) {
  const { t } = useLanguage();
  const words = missingBoxWords(t, missing, shrinks, published);
  if (!words) return null;

  if (words.look === "goodOnly") {
    return <p className={cn("text-[13px] text-muted-foreground [overflow-wrap:anywhere]", className)}>{words.main}</p>;
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border border-warning/25 bg-warning/10 p-3 [overflow-wrap:anywhere]",
        className,
      )}
    >
      <p className="flex items-start gap-2 text-sm font-semibold text-warning">
        <AlertTriangle className="size-4 shrink-0 translate-y-0.5" aria-hidden />
        <span>{words.main}</span>
      </p>
      {words.second && <p className="text-[13px] text-muted-foreground">{words.second}</p>}
    </div>
  );
}

/**
 * Where a list's poster thumbnail goes when the title has no poster (the
 * `Missing` board): an amber dashed box with a picture icon, named "No
 * poster yet". The size is a list thumbnail's; `className` changes it.
 */
export function MissingPosterThumb({ className }: { className?: string }) {
  const { t } = useLanguage();
  const label = t.movies.missing.noPosterYet;
  return (
    <span
      role="img"
      aria-label={label}
      title={label}
      className={cn(
        "flex h-14 w-10 shrink-0 items-center justify-center rounded-md border border-dashed border-warning/50 bg-warning/10",
        className,
      )}
    >
      <ImageIcon className="size-4 text-warning" aria-hidden />
    </span>
  );
}
