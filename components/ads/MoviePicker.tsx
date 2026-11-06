"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, Film, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { movieTimeText } from "@/components/ads/adWords";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { movieService } from "@/services/api/movieService";
import { AD_LIMITS, type AdTargetMovie } from "@/types/ad";
import { cn } from "@/lib/utils";

const RESULT_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 300;

/** A search result: what the ad keeps of a movie, plus its year and length for the list's second line. */
interface PickerMovie extends AdTargetMovie {
  year: number | null;
  /** Minutes, as the movie stores it; null when not set. */
  minutes: number | null;
}

/**
 * One page of movies — the newest first when the box is empty, the
 * backend's own title search when it is not. The staff list already leaves
 * episodes out of GET /movies, which is right: an ad for "All movies"
 * covers them, and a single episode is not something to pick here.
 */
async function searchMovies(term: string): Promise<PickerMovie[]> {
  const page = await movieService.getMovies({ page: 1, limit: RESULT_LIMIT, ...(term ? { search: term } : {}) });
  return page.items.map((movie) => ({
    id: movie.id,
    title: movie.title,
    imageUrl: movie.posterUrl,
    isVisible: movie.status === "PUBLISHED",
    missing: false,
    year: movie.releaseYear > 0 ? movie.releaseYear : null,
    minutes: movie.duration > 0 ? movie.duration : null,
  }));
}

/** Only what the ad keeps — the year and length are for the list, not the form. */
const targetOf = ({ id, title, imageUrl, isVisible, missing }: PickerMovie): AdTargetMovie => ({
  id,
  title,
  imageUrl,
  isVisible,
  missing,
});

function Thumb({ url, className }: { url: string | null; className?: string }) {
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded bg-muted",
        className ?? "h-12 w-8",
      )}
    >
      {url ? (
        <Image src={url} alt="" fill sizes="32px" className="object-cover" unoptimized />
      ) : (
        <Film className="size-4 text-muted-foreground" />
      )}
    </div>
  );
}

interface MoviePickerProps {
  /** The chosen movies, as the ad carries them (title, poster, published, deleted). */
  value: AdTargetMovie[];
  onChange: (movies: AdTargetMovie[]) => void;
  disabled?: boolean;
  invalid?: boolean;
}

/**
 * Picks the movies an ad shows in (the `Wiz4Movies` board): a search box
 * over the newest titles, how many are chosen, a list to tick (poster,
 * name, "Movie · 2025 · 1 h 52 min"), and the choice as a row of chips
 * under it (tap one to drop it). The chips are drawn from `value` itself —
 * the ad's own target list already carries each movie's title and poster,
 * so nothing is looked up; a deleted one shows red until it is removed.
 */
export function MoviePicker({ value, onChange, disabled, invalid }: MoviePickerProps) {
  const { t } = useLanguage();
  const p = t.adsUi.wizard.picker;
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => setTerm(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search]);

  const { data, isLoading, error } = useAsyncData(() => searchMovies(term), [term]);
  const results = data ?? [];
  const chosen = new Set(value.map((movie) => movie.id));
  const full = value.length >= AD_LIMITS.movies;

  const toggle = (movie: AdTargetMovie) => {
    onChange(chosen.has(movie.id) ? value.filter((m) => m.id !== movie.id) : [...value, movie]);
  };

  const chipTitle = (movie: AdTargetMovie) => (movie.missing || !movie.title ? p.deleted : movie.title);
  const metaOf = (movie: PickerMovie) =>
    movie.year === null
      ? null
      : movie.minutes === null
        ? p.metaYear(movie.year)
        : p.meta(movie.year, movieTimeText(t, movie.minutes * 60));

  return (
    <div
      className={cn(
        "flex flex-col gap-2.5 rounded-xl border p-3",
        invalid ? "border-destructive/60" : "border-[var(--border-strong)]",
      )}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={p.search}
          className="pl-8"
          disabled={disabled}
          aria-label={p.search}
        />
      </div>
      {value.length === 0 && <p className={cn("text-sm", invalid ? "text-destructive" : "text-muted-foreground")}>{p.noneChosen}</p>}
      <p className="text-xs text-muted-foreground">{p.hint(value.length, AD_LIMITS.movies)}</p>

      <div className="max-h-64 overflow-y-auto">
        {isLoading && !data ? (
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-md" />
            ))}
          </div>
        ) : error ? (
          <p className="px-1 py-3 text-sm text-destructive">{p.loadError}</p>
        ) : results.length === 0 ? (
          <p className="px-1 py-3 text-sm text-muted-foreground">{p.noResults}</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {results.map((movie) => {
              const active = chosen.has(movie.id);
              const meta = metaOf(movie);
              return (
                <li key={movie.id}>
                  <button
                    type="button"
                    // At the limit only un-ticking is left.
                    disabled={disabled || (full && !active)}
                    aria-pressed={active}
                    onClick={() => toggle(targetOf(movie))}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-md p-1.5 text-left transition-colors hover:bg-foreground/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
                      active && "bg-primary/10 hover:bg-primary/15",
                    )}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        "flex size-5 shrink-0 items-center justify-center rounded-md border",
                        active ? "border-primary bg-primary text-primary-foreground" : "border-[var(--border-stronger)]",
                      )}
                    >
                      {active && <Check className="size-3.5" />}
                    </span>
                    <Thumb url={movie.imageUrl} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">{movie.title}</span>
                      {meta && <span className="truncate text-xs text-muted-foreground">{meta}</span>}
                    </span>
                    {!movie.isVisible && (
                      <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px] text-warning">
                        {p.notPublished}
                      </Badge>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {value.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">{p.chosen}</span>
          {value.map((movie) => (
            <button
              key={movie.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(movie)}
              aria-label={p.remove(chipTitle(movie))}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border py-0.5 pr-2 pl-0.5 text-xs transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                movie.missing
                  ? "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                  : "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20",
              )}
            >
              <Thumb url={movie.imageUrl} className="size-5 rounded-full" />
              <span className="max-w-40 truncate">{chipTitle(movie)}</span>
              {!movie.missing && !movie.isVisible && (
                <span className="text-[10px] text-warning">{p.notPublished}</span>
              )}
              <X className="size-3 shrink-0" aria-hidden />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
