"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { BookOpen, Film, Search, Tv, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { movieService } from "@/services/api/movieService";
import { seriesService } from "@/services/api/seriesService";
import { bookService } from "@/services/api/bookService";
import type { HomePromoTitleTarget } from "@/types/home-promo";
import { cn } from "@/lib/utils";

/** What the picker shows for one title — the same few fields for all three types. */
export interface PickedTitle {
  id: string;
  title: string | null;
  imageUrl: string | null;
  /** Year or author — a second line so two titles with one name can be told apart. */
  subtitle?: string | null;
  /** False when the apps would not show it (not published / deleted). */
  isVisible: boolean;
  missing?: boolean;
}

const RESULT_LIMIT = 20;
const SEARCH_DEBOUNCE_MS = 300;

const TYPE_ICONS = { MOVIE: Film, SERIES: Tv, BOOK: BookOpen } as const;

/**
 * One page of titles of the chosen type — the newest first when the box is
 * empty, the backend's own title search when it is not. The staff lists
 * already leave episodes out of GET /movies, which is right: an episode is
 * linked through its series.
 */
async function searchTitles(type: HomePromoTitleTarget, term: string): Promise<PickedTitle[]> {
  const query = { page: 1, limit: RESULT_LIMIT, ...(term ? { search: term } : {}) };
  if (type === "MOVIE") {
    const page = await movieService.getMovies(query);
    return page.items.map((movie) => ({
      id: movie.id,
      title: movie.title,
      imageUrl: movie.posterUrl,
      subtitle: movie.releaseYear ? String(movie.releaseYear) : null,
      isVisible: movie.status === "PUBLISHED",
    }));
  }
  if (type === "SERIES") {
    const page = await seriesService.getSeries(query);
    return page.items.map((series) => ({
      id: series.id,
      title: series.title,
      imageUrl: series.posterUrl ?? series.coverUrl,
      subtitle: series.releaseYear ? String(series.releaseYear) : null,
      isVisible: series.status === "PUBLISHED",
    }));
  }
  const page = await bookService.getBooks(query);
  return page.items.map((book) => ({
    id: book.id,
    title: book.title,
    imageUrl: book.coverUrl,
    subtitle: book.author || null,
    // A book is readable once ANY of its languages is published.
    isVisible: book.editions.some((edition) => edition.status === "PUBLISHED"),
  }));
}

function Thumb({ type, url }: { type: HomePromoTitleTarget; url: string | null }) {
  const Icon = TYPE_ICONS[type];
  return (
    <div className="relative flex h-12 w-8 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
      {url ? (
        <Image src={url} alt="" fill sizes="32px" className="object-cover" unoptimized />
      ) : (
        <Icon className="size-4 text-muted-foreground" />
      )}
    </div>
  );
}

interface TitleTargetPickerProps {
  type: HomePromoTitleTarget;
  /** The chosen title, or null. */
  value: PickedTitle | null;
  onChange: (title: PickedTitle | null) => void;
  disabled?: boolean;
  invalid?: boolean;
}

/**
 * Chooses the movie, series or book a promo opens. Shows the choice as one
 * row with a Change button; while nothing is chosen, a search box over the
 * newest titles of that type.
 */
export function TitleTargetPicker({ type, value, onChange, disabled, invalid }: TitleTargetPickerProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [term, setTerm] = useState("");

  useEffect(() => {
    const handle = setTimeout(() => setTerm(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search]);

  const open = !value;
  const { data, isLoading, error } = useAsyncData(
    () => (open ? searchTitles(type, term) : Promise.resolve([] as PickedTitle[])),
    [type, term, open],
  );

  if (value) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-[var(--border-strong)] p-2">
        <Thumb type={type} url={value.imageUrl} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {value.missing || !value.title ? t.homePromos.picker.deletedTitle : value.title}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
            {value.subtitle && <span>{value.subtitle}</span>}
            {!value.isVisible && !value.missing && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-warning">
                {t.homePromos.picker.notPublished}
              </Badge>
            )}
          </div>
        </div>
        {!disabled && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch("");
              setTerm("");
              onChange(null);
            }}
          >
            <X className="size-3.5" />
            {t.homePromos.picker.change}
          </Button>
        )}
      </div>
    );
  }

  const results = data ?? [];
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border p-2",
        invalid ? "border-destructive/60" : "border-[var(--border-strong)]",
      )}
    >
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t.homePromos.picker.searchPlaceholder[type]}
          className="pl-8"
          disabled={disabled}
          aria-label={t.homePromos.picker.searchPlaceholder[type]}
        />
      </div>
      <div className="max-h-56 overflow-y-auto">
        {isLoading ? (
          <div className="flex flex-col gap-1.5">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-md" />
            ))}
          </div>
        ) : error ? (
          <p className="px-1 py-3 text-sm text-destructive">{t.homePromos.picker.loadError}</p>
        ) : results.length === 0 ? (
          <p className="px-1 py-3 text-sm text-muted-foreground">{t.homePromos.picker.noResults}</p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {results.map((title) => (
              <li key={title.id}>
                <button
                  type="button"
                  disabled={disabled}
                  onClick={() => onChange(title)}
                  className="flex w-full items-center gap-3 rounded-md p-1.5 text-left transition-colors hover:bg-foreground/[0.05] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                >
                  <Thumb type={type} url={title.imageUrl} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{title.title}</p>
                    {title.subtitle && (
                      <p className="truncate text-xs text-muted-foreground">{title.subtitle}</p>
                    )}
                  </div>
                  {!title.isVisible && (
                    <Badge variant="outline" className="h-5 shrink-0 px-1.5 text-[10px] text-warning">
                      {t.homePromos.picker.notPublished}
                    </Badge>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
