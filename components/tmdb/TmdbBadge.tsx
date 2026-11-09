"use client";

import { Loader2 } from "lucide-react";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { tmdbBadgeOf } from "@/components/tmdb/tmdbStatus";
import { tmdbBadgeLabel, tmdbMatchLabel } from "@/components/tmdb/tmdbWords";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import type { TmdbLookupError, TmdbLookupStatus, TmdbMatch } from "@/types/tmdb";

interface TmdbBadgeProps {
  status: TmdbLookupStatus;
  /** Why a FAILED lookup failed — it picks the red badge's words. */
  error?: TmdbLookupError | null;
  /** The linked entry of a MATCHED title: its name shows on hover ("Inception (2010)"). */
  match?: TmdbMatch | null;
  className?: string;
}

/**
 * The TMDB status badge (2026-11-06, the `Ready` and `Upload` boards), one
 * shared piece with six looks — tmdbStatus.ts has the table: blue with a
 * spinner while "Finding details…", green "Details from TMDB", amber
 * "Several matches", grey "Not found on TMDB", red with the reason when the
 * lookup failed, and nothing at all for a title never looked up.
 *
 * The match on hover is a convenience only: wherever there is room (the
 * strip, an upload card) the match is written out beside the badge, because
 * a phone never shows a hover.
 */
export function TmdbBadge({ status, error = null, match = null, className }: TmdbBadgeProps) {
  const { t } = useLanguage();
  const badge = tmdbBadgeOf(status, error);
  if (badge.tone === null) return null;
  const hover = badge.look === "matched" ? tmdbMatchLabel(t, match) : "";
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1.5", className)} title={hover || undefined}>
      {badge.look === "finding" && <Loader2 className="size-3.5 shrink-0 animate-spin text-info" aria-hidden />}
      <StatusBadge label={tmdbBadgeLabel(t, badge)} tone={badge.tone} className="normal-case" />
    </span>
  );
}
