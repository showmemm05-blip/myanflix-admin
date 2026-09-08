"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Search, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAsyncData } from "@/lib/hooks/use-async-data";
import { useLanguage } from "@/lib/context/language-context";
import { actorService } from "@/services/api/actorService";
import type { Actor, ActorRef } from "@/types/actor";
import { cn } from "@/lib/utils";

/**
 * One generous page, fetched once — a catalog this size filters instantly in
 * the browser, with no request per keystroke.
 *
 * 100 is the ceiling, not a preference: PaginationQueryDto caps `limit` at
 * 100 platform-wide and the global ValidationPipe rejects anything above it
 * with a 400, which the picker could only render as "we couldn't load the
 * actors". Past this many actors the component switches to server-side
 * search on its own (see searchOnServer), so this is a threshold rather than
 * a limit on what is reachable.
 */
const FIRST_PAGE_LIMIT = 100;
const SEARCH_DEBOUNCE_MS = 300;

function toRef(actor: Actor): ActorRef {
  return { id: actor.id, name: actor.name, imageUrl: actor.imageUrl };
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

interface ActorPickerProps {
  /** The film's cast, as actor ids. */
  value: string[];
  onChange: (actorIds: string[]) => void;
  disabled?: boolean;
}

/**
 * Picks the cast of a film. Reads the actor list but gates on nothing of its
 * own: anyone allowed to edit a movie is allowed to see who is in it.
 */
export function ActorPicker({ value, onChange, disabled = false }: ActorPickerProps) {
  const { t } = useLanguage();
  const [search, setSearch] = useState("");
  const [serverTerm, setServerTerm] = useState("");
  /**
   * Flips once we learn the catalog is bigger than the page we hold — from
   * then on the term goes to the server, because filtering in the browser
   * can only ever match the actors already fetched. It never flips back: a
   * narrowed search's own `total` says nothing about the full catalog.
   */
  const [searchOnServer, setSearchOnServer] = useState(false);

  /**
   * Everyone we've seen, by id. Selected actors have to render as chips even
   * when the current page doesn't contain them (a server search narrowed it,
   * or the cast reaches past the first page), so what's been loaded is kept
   * rather than re-derived from the visible page.
   */
  const [known, setKnown] = useState<Record<string, ActorRef>>({});
  // Every id already loaded or already looked up — so a second search
  // doesn't re-request the cast members it can no longer see on the page.
  const seenIdsRef = useRef(new Set<string>());

  // The cast the picker was mounted with — the ids that may need resolving
  // individually. Anything selected later came from a page we already hold.
  const initialIdsRef = useRef(value);

  useEffect(() => {
    if (!searchOnServer) return;
    const handle = setTimeout(() => setServerTerm(search.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(handle);
  }, [search, searchOnServer]);

  const { data, isLoading, error } = useAsyncData(async () => {
    const page = await actorService.getActors(
      serverTerm
        ? { limit: FIRST_PAGE_LIMIT, search: serverTerm }
        : { limit: FIRST_PAGE_LIMIT },
    );

    const loaded: Actor[] = [...page.items];
    for (const actor of page.items) seenIdsRef.current.add(actor.id);

    if (page.total > page.items.length) setSearchOnServer(true);

    // A cast member who isn't on this page still has to show up as a chip.
    const unresolved = initialIdsRef.current.filter((id) => !seenIdsRef.current.has(id));
    if (unresolved.length > 0) {
      for (const id of unresolved) seenIdsRef.current.add(id);
      const resolved = await Promise.all(
        unresolved.map((id) => actorService.getActorById(id).catch(() => null)),
      );
      for (const actor of resolved) {
        if (actor) loaded.push(actor);
      }
    }

    setKnown((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const actor of loaded) {
        if (!prev[actor.id]) {
          next[actor.id] = toRef(actor);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
    return page;
  }, [serverTerm]);

  const actors = useMemo(() => data?.items ?? [], [data]);
  const term = search.trim().toLowerCase();

  const filtered = useMemo(() => {
    if (!term) return actors;
    // Once this page IS the backend's answer for `serverTerm`, show it
    // whole — filtering it again would fight a looser match than a
    // substring. Until then (debouncing, or the request still in flight)
    // narrow the page we're holding so typing stays responsive.
    if (searchOnServer && !isLoading && serverTerm.toLowerCase() === term) return actors;
    return actors.filter((a) => a.name.toLowerCase().includes(term));
  }, [actors, term, searchOnServer, serverTerm, isLoading]);

  const selectedActors = value
    .map((id) => known[id])
    .filter((a): a is ActorRef => Boolean(a));

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  // With no search term in flight, an empty page means an empty catalog —
  // "add some actors first", not "nothing matched".
  const catalogEmpty = !!data && !serverTerm && data.total === 0;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <Label>{t.actors.picker.label}</Label>
        {value.length > 0 && (
          <span className="text-xs tabular-nums text-muted-foreground">
            {t.actors.picker.selected(value.length)}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t.actors.picker.hint}</p>

      {selectedActors.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedActors.map((actor) => (
            <button
              key={actor.id}
              type="button"
              disabled={disabled}
              onClick={() => toggle(actor.id)}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 py-0.5 pr-2 pl-0.5 text-xs text-primary transition-colors hover:bg-primary/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Avatar className="size-5">
                <AvatarImage src={actor.imageUrl ?? undefined} alt={actor.name} />
                <AvatarFallback className="text-[9px]">{initials(actor.name)}</AvatarFallback>
              </Avatar>
              <span className="max-w-32 truncate">{actor.name}</span>
              <X className="size-3 shrink-0" />
            </button>
          ))}
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          className="pl-8"
          value={search}
          disabled={disabled}
          placeholder={t.actors.picker.searchPlaceholder}
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
          <p className="p-3 text-xs text-destructive">{t.actors.page.loadError}</p>
        ) : catalogEmpty ? (
          <p className="p-3 text-xs text-muted-foreground">{t.actors.picker.empty}</p>
        ) : filtered.length === 0 ? (
          <p className="p-3 text-xs text-muted-foreground">{t.actors.picker.noMatches}</p>
        ) : (
          <ul className="flex flex-col p-1">
            {filtered.map((actor) => {
              const active = value.includes(actor.id);
              return (
                <li key={actor.id}>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => toggle(actor.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary/60 disabled:cursor-not-allowed disabled:opacity-50",
                      active && "bg-primary/10 text-primary hover:bg-primary/15",
                    )}
                  >
                    <Avatar className="size-6">
                      <AvatarImage src={actor.imageUrl ?? undefined} alt={actor.name} />
                      <AvatarFallback className="text-[10px]">{initials(actor.name)}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate">{actor.name}</span>
                    {active && <Check className="size-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
