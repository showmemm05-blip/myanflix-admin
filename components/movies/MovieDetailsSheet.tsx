import Image from "next/image";
import { format } from "date-fns";
import { Clock, Globe, Star, Wallet } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, type StatusTone } from "@/components/shared/StatusBadge";
import { formatDuration } from "@/components/movies/columns";
import { formatKyat } from "@/lib/currency";
import type { Movie, MovieStatus } from "@/types/movie";

const STATUS_TONE: Record<MovieStatus, StatusTone> = {
  PUBLISHED: "success",
  PROCESSING: "info",
  DRAFT: "neutral",
  ARCHIVED: "warning",
};

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
                <SheetDescription>
                  {movie.releaseYear} &middot; {formatDuration(movie.duration)}
                </SheetDescription>
              </SheetHeader>

              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge label={movie.status} tone={STATUS_TONE[movie.status]} />
                <Badge variant="outline">{movie.isPremium ? "Premium" : "Free"}</Badge>
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
                <div className="glass-card rounded-lg border-white/[0.08] p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Wallet className="size-3.5" />
                    Price
                  </div>
                  <p className="mt-1 text-lg font-semibold">
                    {movie.isPremium ? formatKyat(movie.price) : "Free"}
                  </p>
                </div>
                <div className="glass-card rounded-lg border-white/[0.08] p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Globe className="size-3.5" />
                    Language
                  </div>
                  <p className="mt-1 text-lg font-semibold">{movie.language}</p>
                </div>
                <div className="glass-card col-span-2 rounded-lg border-white/[0.08] p-3">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Star className="size-3.5" />
                    Rating
                  </div>
                  <p className="mt-1 text-lg font-semibold">
                    {movie.rating > 0 ? movie.rating.toFixed(1) : "—"}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="size-3.5" />
                Last updated {format(new Date(movie.updatedAt), "MMM d, yyyy 'at' h:mm a")}
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
