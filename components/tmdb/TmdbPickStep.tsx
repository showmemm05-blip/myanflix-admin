"use client";

import { useId, useState, type FormEvent, type KeyboardEvent } from "react";
import { AlertTriangle, ArrowRight, Loader2, RotateCw, Search, SearchX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { TmdbResultSummary } from "@/components/tmdb/TmdbResultSummary";
import { tmdbErrorMessage } from "@/components/tmdb/tmdbWords";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import { tmdbService } from "@/services/api/tmdbService";
import type { TmdbSearchAnswer, TmdbSearchResult } from "@/types/tmdb";

/** The backend's own limits for a staff search: a name of 1 to 200 characters, a year from 1888 to 2100. */
const QUERY_MAX_LENGTH = 200;
const YEAR_MIN = 1888;
const YEAR_MAX = 2100;

/** "" = any year (null); a whole number in range = that year; anything else cannot be searched. */
function parseYear(text: string): number | null | "invalid" {
  const trimmed = text.trim();
  if (trimmed === "") return null;
  if (!/^\d{4}$/.test(trimmed)) return "invalid";
  const year = Number(trimmed);
  return year >= YEAR_MIN && year <= YEAR_MAX ? year : "invalid";
}

interface SearchTerms {
  query: string;
  year: number | null;
}

interface TmdbPickStepProps {
  /** Movies are searched among TMDB's films, series among its TV shows. */
  kind: "movie" | "series";
  /** The upload's raw folder name (movies only), shown above the search so staff see what the name was read from. */
  sourceName?: string | null;
  /** What the search starts with: the cleaned name and the year read from the folder name — both editable. */
  initialSearch: SearchTerms;
  /** The TMDB entry the title is linked to now (Change match): tagged in the list. */
  currentTmdbId?: number | null;
  onCancel: () => void;
  onContinue: (result: TmdbSearchResult) => void;
}

/**
 * Step 1, "Pick a match" (2026-11-06, the `Pick` board): the folder name, a
 * name box and a year box, Search, and the candidates as one radio group.
 * Whenever staff search themselves they always get the list and choose —
 * the "one clear match" rule only decides the automatic lookup.
 *
 * The first search runs by itself with the name the title already has, so
 * the list is there when the dialog opens. A year that finds nothing is
 * dropped by the backend, which says so ("No year match, showing all
 * years"). TMDB being unreachable, busy or not connected shows the reason
 * with Try again; nothing here ever writes to the title.
 *
 * Body and footer only: the dialog around it owns the heading, so the two
 * steps can swap without the dialog losing its name.
 */
export function TmdbPickStep({
  kind,
  sourceName = null,
  initialSearch,
  currentTmdbId = null,
  onCancel,
  onContinue,
}: TmdbPickStepProps) {
  const { t } = useLanguage();
  const p = t.tmdb.pick;
  const ids = useId();

  const [query, setQuery] = useState(initialSearch.query);
  const [year, setYear] = useState(initialSearch.year === null ? "" : String(initialSearch.year));
  const [problem, setProblem] = useState<"name" | "year" | null>(null);
  // A new object on every Search press, so the same words can be searched again.
  const [submitted, setSubmitted] = useState<SearchTerms | null>(() => {
    const first = initialSearch.query.trim().slice(0, QUERY_MAX_LENGTH);
    return first ? { query: first, year: initialSearch.year } : null;
  });
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const {
    data: answer,
    isLoading,
    error,
    refetch,
  } = useAsyncData<TmdbSearchAnswer | null>(() => {
    if (!submitted) return Promise.resolve(null);
    return kind === "movie"
      ? tmdbService.searchMovies(submitted.query, submitted.year)
      : tmdbService.searchTv(submitted.query, submitted.year);
  }, [kind, submitted]);

  const searching = isLoading && submitted !== null;
  const results = !searching && !error && answer ? answer.results : [];
  // A selection only counts while it is in the list on screen.
  const selected = results.find((result) => result.tmdbId === selectedId) ?? null;

  const handleSearch = (event: FormEvent) => {
    event.preventDefault();
    const name = query.trim().slice(0, QUERY_MAX_LENGTH);
    if (!name) {
      setProblem("name");
      return;
    }
    const parsedYear = parseYear(year);
    if (parsedYear === "invalid") {
      setProblem("year");
      return;
    }
    setProblem(null);
    setSelectedId(null);
    setSubmitted({ query: name, year: parsedYear });
  };

  // A radio group moves with the arrow keys: the next candidate is focused
  // and chosen, round the ends.
  const handleKeys = (event: KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowDown" || event.key === "ArrowRight"
        ? 1
        : event.key === "ArrowUp" || event.key === "ArrowLeft"
          ? -1
          : 0;
    if (step === 0 || results.length === 0) return;
    event.preventDefault();
    const radios = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="radio"]'));
    const from = radios.findIndex((radio) => radio === document.activeElement);
    const next = (Math.max(from, 0) + step + results.length) % results.length;
    radios[next]?.focus();
    setSelectedId(results[next].tmdbId);
  };

  return (
    <>
      <div className="flex max-h-[65vh] flex-col gap-4 overflow-y-auto pr-1">
        {sourceName && (
          <p className="text-[13px] text-muted-foreground [overflow-wrap:anywhere]">
            {p.folderName} <span className="font-semibold text-foreground">{sourceName}</span>
          </p>
        )}

        <form onSubmit={handleSearch} className="flex flex-col gap-1.5" noValidate>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex min-w-48 flex-1 flex-col gap-1.5">
              <Label htmlFor={`${ids}-name`}>{kind === "movie" ? p.movieName : p.seriesName}</Label>
              <Input
                id={`${ids}-name`}
                value={query}
                maxLength={QUERY_MAX_LENGTH}
                autoComplete="off"
                aria-invalid={problem === "name" || undefined}
                aria-describedby={problem === "name" ? `${ids}-problem` : undefined}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="flex w-24 flex-col gap-1.5">
              <Label htmlFor={`${ids}-year`}>{p.year}</Label>
              <Input
                id={`${ids}-year`}
                value={year}
                inputMode="numeric"
                maxLength={4}
                autoComplete="off"
                aria-invalid={problem === "year" || undefined}
                aria-describedby={problem === "year" ? `${ids}-problem` : undefined}
                onChange={(event) => setYear(event.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary" disabled={searching}>
              {searching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
              {p.search}
            </Button>
          </div>
          {problem && (
            <p id={`${ids}-problem`} className="text-sm text-destructive">
              {problem === "name" ? p.nameRequired : p.yearInvalid}
            </p>
          )}
        </form>

        {searching ? (
          <div className="flex flex-col gap-2" role="status">
            <span className="sr-only">{p.searching}</span>
            {[0, 1, 2].map((row) => (
              <Skeleton key={row} className="h-[124px] rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-start gap-2 rounded-lg border border-destructive/25 bg-destructive/10 p-3">
            <p className="flex items-start gap-2 text-sm text-destructive">
              <AlertTriangle className="size-4 shrink-0 translate-y-0.5" aria-hidden />
              {tmdbErrorMessage(error, t)}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={refetch}>
              <RotateCw className="size-3.5" />
              {t.tmdb.actions.retry}
            </Button>
          </div>
        ) : !answer ? (
          <p className="text-sm text-muted-foreground">{p.startHint}</p>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-6 py-10 text-center">
            <SearchX className="size-6 text-muted-foreground" aria-hidden />
            <p className="text-sm font-medium">{p.nothingFoundTitle}</p>
            <p className="max-w-sm text-sm text-muted-foreground">{p.nothingFoundHint}</p>
          </div>
        ) : (
          <>
            {answer.yearIgnored && (
              <p className="rounded-lg border border-info/25 bg-info/10 px-3 py-2 text-[13px] text-info">
                {p.yearIgnored}
              </p>
            )}
            <div role="radiogroup" aria-label={p.results} className="flex flex-col gap-2" onKeyDown={handleKeys}>
              {results.map((result, index) => {
                const checked = result.tmdbId === selected?.tmdbId;
                return (
                  <button
                    key={result.tmdbId}
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    // One stop for the whole group: the chosen candidate, or the first while none is.
                    tabIndex={checked || (selected === null && index === 0) ? 0 : -1}
                    onClick={() => setSelectedId(result.tmdbId)}
                    className={cn(
                      "flex rounded-xl border-2 p-3 text-left transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      checked
                        ? "border-primary bg-primary/[0.08]"
                        : "border-border hover:border-[var(--border-stronger)] hover:bg-foreground/[0.03]",
                    )}
                  >
                    <TmdbResultSummary result={result} currentTmdbId={currentTmdbId} />
                  </button>
                );
              })}
            </div>
            <p className="text-[13px] text-muted-foreground">{p.cantSeeIt}</p>
          </>
        )}
      </div>

      <DialogFooter className="sm:justify-between">
        <Button type="button" variant="outline" onClick={onCancel}>
          {t.common.cancel}
        </Button>
        <Button type="button" disabled={!selected} onClick={() => selected && onContinue(selected)}>
          {p.continue}
          <ArrowRight className="size-4" />
        </Button>
      </DialogFooter>
    </>
  );
}
