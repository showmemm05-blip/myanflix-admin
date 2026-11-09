"use client";

import Image from "next/image";
import { format } from "date-fns";
import { Clapperboard, Clock, Crown, Film, Globe, ShieldCheck, Star } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { mediaTypeName } from "@/components/shared/MediaTypeSelect";
import {
  ACCESS_TYPE_TONE,
  getAccessTypeLabel,
  getStatusLabel,
  STATUS_TONE,
} from "@/components/movies/columns";
import { tmdbMatchLabel } from "@/components/tmdb/tmdbWords";
import { AGE_RATING_LABELS } from "@/lib/constants/movie-options";
import { formatDuration } from "@/lib/format";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { tmdbService } from "@/services/api/tmdbService";
import type { Movie } from "@/types/movie";

/** Local "no image" placeholder (public/placeholder-poster.svg) — never a third-party image host. */
const FALLBACK_COVER = "/placeholder-poster.svg";

export function MovieDetailsSheet({
  movie,
  open,
  onOpenChange,
}: {
  movie: Movie | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { t } = useLanguage();
  const { can } = useRole();
  // null when the runtime was never measured — the separator goes with it.
  const runtime = movie ? formatDuration(movie.duration) : null;

  // Which TMDB entry the details came from, for the one line under the
  // descriptions. Asked only while the sheet is open, only for a standalone
  // movie (episodes are never looked up) and only by staff who may read it;
  // a refusal — TMDB not connected, an older server — simply shows no line.
  const tmdbMovieId = open && movie && movie.seriesId === null && can("MOVIES.VIEW") ? movie.id : null;
  const { data: tmdbStates } = useAsyncData(
    () => (tmdbMovieId ? tmdbService.getMovieStates([tmdbMovieId]) : Promise.resolve([])),
    [tmdbMovieId],
  );
  // The answer of the movie on screen only: the previous movie's answer is
  // still held for a moment after another row is opened.
  const tmdbState = tmdbStates?.find((state) => state.movieId === tmdbMovieId) ?? null;
  const tmdbMatch = tmdbState?.tmdbId != null ? tmdbMatchLabel(t, tmdbState.match) : "";

  const descriptionEn = movie?.description?.trim() ?? "";
  // `?.`: a backend from before the Burmese description leaves the field out.
  const descriptionMm = movie?.descriptionMm?.trim() ?? "";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full overflow-y-auto scrollbar-thin sm:max-w-md">
        {movie && (
          <>
            <div className="relative h-52 w-full shrink-0 bg-muted">
              <Image
                src={movie.coverUrl ?? FALLBACK_COVER}
                alt={movie.title}
                fill
                className="object-cover"
                sizes="480px"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-popover via-popover/20 to-transparent" />
            </div>
            <div className="flex flex-col gap-4 px-4 pb-4">
              <SheetHeader className="p-0">
                <SheetTitle className="text-lg">{movie.title}</SheetTitle>
                <SheetDescription className="tabular-nums">
                  {movie.releaseYear}
                  {runtime && <> &middot; {runtime}</>}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={getStatusLabel(t, movie.status)} tone={STATUS_TONE[movie.status]} />
                <StatusBadge
                  label={getAccessTypeLabel(t, movie.accessType)}
                  tone={ACCESS_TYPE_TONE[movie.accessType]}
                />
                <Badge variant="secondary" className="font-normal">
                  {movie.genre}
                </Badge>
                {movie.categories.map((c) => (
                  <Badge key={c.id} variant="secondary" className="font-normal">
                    {c.name}
                  </Badge>
                ))}
              </div>

              {/* Both texts, each under its language: viewers get the one of
                  their app language, staff need to see which exist. */}
              {descriptionEn || descriptionMm ? (
                <div className="flex flex-col gap-3">
                  {descriptionEn && (
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-muted-foreground">{t.tmdbPages.detailsSheet.descriptionEnglish}</p>
                      <p lang="en" className="text-sm whitespace-pre-line [overflow-wrap:anywhere]">
                        {descriptionEn}
                      </p>
                    </div>
                  )}
                  {descriptionMm && (
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-muted-foreground">{t.tmdbPages.detailsSheet.descriptionBurmese}</p>
                      <p lang="my" className="text-sm leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]">
                        {descriptionMm}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t.tmdbPages.detailsSheet.noDescription}</p>
              )}

              {tmdbMatch && (
                <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
                  {t.tmdbPages.detailsSheet.detailsFromTmdb(tmdbMatch)}
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="glass-card rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Crown className="size-3.5" />
                    {t.movies.detailsSheet.access}
                  </div>
                  <p className="mt-1 text-lg font-semibold">
                    {getAccessTypeLabel(t, movie.accessType)}
                  </p>
                </div>
                <div className="glass-card rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Globe className="size-3.5" />
                    {t.movies.detailsSheet.language}
                  </div>
                  <p className="mt-1 text-lg font-semibold">{movie.language}</p>
                </div>
                <div className="glass-card rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Film className="size-3.5" />
                    {t.movies.mediaType.detailsLabel}
                  </div>
                  <p className="mt-1 text-lg font-semibold">
                    {movie.country ? mediaTypeName(t, movie.country) : "—"}
                  </p>
                </div>
                <div className="glass-card rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Star className="size-3.5" />
                    {t.movies.detailsSheet.rating}
                  </div>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {movie.rating > 0 ? movie.rating.toFixed(1) : "—"}
                  </p>
                </div>
                <div className="glass-card rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clapperboard className="size-3.5" />
                    {t.tmdbPages.detailsSheet.director}
                  </div>
                  <p className="mt-1 text-lg font-semibold [overflow-wrap:anywhere]">{movie.director || "—"}</p>
                </div>
                <div className="glass-card rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <ShieldCheck className="size-3.5" />
                    {t.tmdbPages.detailsSheet.ageRating}
                  </div>
                  <p className="mt-1 text-lg font-semibold">
                    {movie.ageRating ? (AGE_RATING_LABELS[movie.ageRating] ?? movie.ageRating) : "—"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5" />
                {t.movies.detailsSheet.lastUpdated(format(new Date(movie.updatedAt), "d MMM yyyy, HH:mm:ss"))}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
