"use client";

import Image from "next/image";
import { format } from "date-fns";
import { Clock, Crown, Globe, Star } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/shared/StatusBadge";
import {
  ACCESS_TYPE_TONE,
  formatDuration,
  getAccessTypeLabel,
  getStatusLabel,
  STATUS_TONE,
} from "@/components/movies/columns";
import { useLanguage } from "@/lib/context/language-context";
import type { Movie } from "@/types/movie";

const FALLBACK_COVER = "https://picsum.photos/seed/myanflix-cover/1280/720";

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
                  {movie.releaseYear} &middot; {formatDuration(movie.duration)}
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

              <p className="text-sm text-muted-foreground">{movie.description}</p>

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
                <div className="glass-card col-span-2 rounded-lg p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Star className="size-3.5" />
                    {t.movies.detailsSheet.rating}
                  </div>
                  <p className="mt-1 text-lg font-semibold tabular-nums">
                    {movie.rating > 0 ? movie.rating.toFixed(1) : "—"}
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
