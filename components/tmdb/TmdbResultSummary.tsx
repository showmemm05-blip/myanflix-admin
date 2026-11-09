"use client";

import { useState } from "react";
import { Film } from "lucide-react";
import { tmdbMatchLabel } from "@/components/tmdb/tmdbWords";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import type { TmdbSearchResult } from "@/types/tmdb";

interface TmdbPosterProps {
  /** A picture on TMDB's own image server, or null when TMDB has none. */
  url: string | null;
  /** Size and shape — the picture fills it. */
  className?: string;
}

/**
 * A candidate's picture, straight from TMDB's image server. A plain `<img>`
 * on purpose: it is not ours to optimise, it is shown to staff only (the
 * admin's page policy allows any https image), and nothing from TMDB's
 * servers is ever shown to viewers — what viewers see is the copy an Apply
 * saves into our own storage. No picture, or one that fails to load, is a
 * quiet placeholder rather than a broken-image glyph.
 */
export function TmdbPoster({ url, className }: TmdbPosterProps) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  if (!url || failedUrl === url) {
    return (
      <span
        aria-hidden
        className={cn("flex shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground", className)}
      >
        <Film className="size-4" />
      </span>
    );
  }
  return (
    // The title stands right beside it, so the picture itself is decoration.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      loading="lazy"
      onError={() => setFailedUrl(url)}
      className={cn("shrink-0 rounded-md bg-muted object-cover", className)}
    />
  );
}

interface TmdbResultSummaryProps {
  result: TmdbSearchResult;
  /** The TMDB entry the title is linked to now: that candidate is tagged "The match in use now". */
  currentTmdbId?: number | null;
  className?: string;
}

/**
 * One TMDB candidate as the pick-a-match list shows it (2026-11-06, the
 * `Pick` board): small poster, name and year, the original name when it
 * differs, two lines of story, and "Already used by: …" when one of our
 * titles is linked to it. Also the card of the "Create this series from
 * TMDB?" confirm, which shows the candidate that was picked.
 */
export function TmdbResultSummary({ result, currentTmdbId = null, className }: TmdbResultSummaryProps) {
  const { t } = useLanguage();
  const p = t.tmdb.pick;
  const isCurrent = currentTmdbId !== null && result.tmdbId === currentTmdbId;
  return (
    <span className={cn("flex min-w-0 gap-3", className)}>
      <TmdbPoster url={result.posterPreviewUrl} className="h-24 w-16" />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-[15px] leading-snug font-semibold [overflow-wrap:anywhere]">
          {tmdbMatchLabel(t, result)}
        </span>
        {result.originalTitle && (
          <span className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
            {p.originalTitle(result.originalTitle)}
          </span>
        )}
        <span className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">
          {result.overview.trim() || p.noStory}
        </span>
        {isCurrent ? (
          <span className="self-start rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
            {p.currentMatch}
          </span>
        ) : (
          result.usedBy && (
            <span className="self-start rounded-full bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning [overflow-wrap:anywhere]">
              {p.usedBy(result.usedBy.title)}
            </span>
          )
        )}
      </span>
    </span>
  );
}
