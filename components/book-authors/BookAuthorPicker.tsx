"use client";

import { useEffect, useState } from "react";
import { Check, Loader2, Plus, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ActorAvatar } from "@/components/actors/columns";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { useRole } from "@/lib/context/role-context";
import { bookAuthorService } from "@/services/api/bookAuthorService";
import { ApiError } from "@/services/api/apiClient";
import type { BookAuthor, BookAuthorRef } from "@/types/bookAuthor";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * One generous page, fetched once — a library this size filters instantly in
 * the browser, with no request per keystroke.
 *
 * 100 is the ceiling, not a preference: PaginationQueryDto caps `limit` at
 * 100 platform-wide and the global ValidationPipe rejects anything above it
 * with a 400. Past this many authors the component switches to server-side
 * search on its own (see searchOnServer), so this is a threshold rather than
 * a limit on what is reachable.
 */
const FIRST_PAGE_LIMIT = 100;
const SEARCH_DEBOUNCE_MS = 300;

function toRef(author: BookAuthor | BookAuthorRef): BookAuthorRef {
  return { id: author.id, name: author.name, imageUrl: author.imageUrl };
}

interface BookAuthorPickerProps {
  /** The credited author, as the ref the book already carries. */
  value: BookAuthorRef | null;
  onChange: (author: BookAuthorRef | null) => void;
  disabled?: boolean;
}

/**
 * Picks the ONE author of a book. Reads the author list but gates on nothing
 * of its own: anyone allowed to edit a book is allowed to see who wrote it.
 * Inline "add as a new author" is the exception — it creates a row, so it
 * only appears for callers holding BOOKS.CREATE.
 *
 * No initial-id resolution is needed: the caller passes the ref it already
 * has from `book.authorRef`, so the chip renders before the list loads.
 */
export function BookAuthorPicker({ value, onChange, disabled = false }: BookAuthorPickerProps) {
  const { t } = useLanguage();
  const { can } = useRole();
  const canCreate = can("BOOKS.CREATE");

  const [search, setSearch] = useState("");
  const [serverTerm, setServerTerm] = useState("");
  /**
   * Flips once we learn the library is bigger than the page we hold — from
   * then on the term goes to the server, because filtering in the browser
   * can only ever match the authors already fetched. It never flips back: a
   * narrowed search's own `total` says nothing about the full library.
   */
  const [searchOnServer, setSearchOnServer] = useState(false);
  /** Rows added inline this session, so they list without a refetch. */
  const [added, setAdded] = useState<BookAuthorRef[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!searchOnServer) return;
    const handle = setTimeout(() => setServerTerm(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search, searchOnServer]);

  const { data, isLoading, error } = useAsyncData(async () => {
    const page = await bookAuthorService.getAuthors(
      serverTerm
        ? { limit: FIRST_PAGE_LIMIT, search: serverTerm }
        : { limit: FIRST_PAGE_LIMIT },
    );
    if (page.total > page.items.length) setSearchOnServer(true);
    return page;
  }, [serverTerm]);

  // No manual memoization here: the React Compiler (enforced by eslint's
  // preserve-manual-memoization rule) derives these itself.
  const fromPage: BookAuthorRef[] = (data?.items ?? []).map(toRef);
  const pageIds = new Set(fromPage.map((a) => a.id));
  // Inline-created rows go first: they are what the admin just typed for.
  const authors: BookAuthorRef[] = [...added.filter((a) => !pageIds.has(a.id)), ...fromPage];

  const rawTerm = search.trim();
  const term = rawTerm.toLowerCase();

  // Once this page IS the backend's answer for `serverTerm`, show it whole —
  // filtering it again would fight a looser match than a substring. Until
  // then (debouncing, or the request still in flight) narrow the page we're
  // holding so typing stays responsive.
  const serverAnswered = searchOnServer && !isLoading && serverTerm.toLowerCase() === term;
  const filtered =
    !term || serverAnswered
      ? authors
      : authors.filter((a) => a.name.toLowerCase().includes(term));

  // The backend refuses a case-insensitive duplicate with a 409, so the offer
  // to add a name is only made when nothing loaded already spells it.
  const exactMatchLoaded = !!term && authors.some((a) => a.name.toLowerCase() === term);
  const offerCreate = canCreate && !!rawTerm && !exactMatchLoaded && !error;

  // With no search term in flight, an empty page means an empty library —
  // "type a name to add one", not "nothing matched".
  const catalogEmpty = !!data && !serverTerm && data.total === 0 && added.length === 0;

  const handleCreate = async () => {
    if (!rawTerm || creating) return;
    setCreating(true);
    try {
      const created = await bookAuthorService.createAuthor({ name: rawTerm });
      const ref = toRef(created);
      setAdded((prev) => [ref, ...prev.filter((a) => a.id !== ref.id)]);
      onChange(ref);
      setSearch("");
    } catch (err) {
      toast.error(t.bookAuthors.picker.createFailedToast, {
        description: err instanceof ApiError ? err.message : t.movies.pleaseTryAgain,
      });
    } finally {
      setCreating(false);
    }
  };

  const busy = disabled || creating;

  return (
    <div className="flex flex-col gap-1.5">
      <Label>{t.bookAuthors.picker.label}</Label>
      <p className="text-xs text-muted-foreground">{canCreate ? t.bookAuthors.picker.hint : t.bookAuthors.picker.hintNoCreate}</p>

      {value && (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => onChange(null)}
            aria-label={t.bookAuthors.picker.clear}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 py-0.5 pr-2 pl-0.5 text-xs text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ActorAvatar name={value.name} imageUrl={value.imageUrl} className="size-5 text-[9px]" />
            <span className="max-w-48 truncate">{value.name}</span>
            <X className="size-3 shrink-0" />
          </button>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          value={search}
          disabled={busy}
          placeholder={t.bookAuthors.picker.searchPlaceholder}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="max-h-56 overflow-y-auto rounded-lg border border-border">
        {isLoading && !data ? (
          <div className="flex flex-col gap-1.5 p-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-8 rounded-md" />
            ))}
          </div>
        ) : error ? (
          <p className="p-3 text-xs text-destructive">{t.bookAuthors.page.loadError}</p>
        ) : catalogEmpty && !offerCreate ? (
          <p className="p-3 text-xs text-muted-foreground">{canCreate ? t.bookAuthors.picker.empty : t.bookAuthors.picker.emptyNoCreate}</p>
        ) : filtered.length === 0 && !offerCreate ? (
          <p className="p-3 text-xs text-muted-foreground">{t.bookAuthors.picker.noMatches}</p>
        ) : (
          <ul className="flex flex-col p-1">
            {filtered.map((author) => {
              const active = value?.id === author.id;
              return (
                <li key={author.id}>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => onChange(active ? null : author)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-50",
                      active && "bg-primary/10 text-primary hover:bg-primary/15",
                    )}
                  >
                    <ActorAvatar
                      name={author.name}
                      imageUrl={author.imageUrl}
                      className="size-6 text-[10px]"
                    />
                    <span className="flex-1 truncate">{author.name}</span>
                    {active && <Check className="size-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
            {offerCreate && (
              <li key="__create">
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleCreate}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm text-primary transition-colors hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating ? (
                    <Loader2 className="size-4 shrink-0 animate-spin" />
                  ) : (
                    <Plus className="size-4 shrink-0" />
                  )}
                  <span className="flex-1 truncate">
                    {creating
                      ? t.bookAuthors.picker.creating
                      : t.bookAuthors.picker.create(rawTerm)}
                  </span>
                </button>
              </li>
            )}
          </ul>
        )}
      </div>
    </div>
  );
}
