"use client";

import { format } from "date-fns";
import { Loader2, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useTmdbConnection } from "@/lib/hooks/use-tmdb-states";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import type { TmdbConnectionState } from "@/types/tmdb";

/** The dot and the state's name share a colour: green works, red needs fixing, amber passes by itself, grey is off. */
const STATE_COLORS: Record<TmdbConnectionState, { dot: string; name: string }> = {
  connected: { dot: "bg-success", name: "text-success" },
  off: { dot: "bg-muted-foreground", name: "text-foreground" },
  key_rejected: { dot: "bg-destructive", name: "text-destructive" },
  unreachable: { dot: "bg-destructive", name: "text-destructive" },
  rate_limited: { dot: "bg-warning", name: "text-warning" },
};

const UNKNOWN_COLORS = { dot: "bg-muted-foreground", name: "text-foreground" };

/**
 * Settings › Connections › TMDB (2026-11-06, the `Connect` board): the one
 * place that says whether TMDB is working — a dot and a name (Connected,
 * Not connected, Key not accepted, Can't reach TMDB, TMDB is busy), one
 * sentence on what to do, when the server last checked, and Check again,
 * which asks TMDB afresh instead of trusting the server's 60-second memory.
 *
 * The key itself is never shown and cannot be typed here: the owner adds
 * TMDB_API_KEY to the server's settings file. Until then the card reads
 * "Not connected" and everything else works as before.
 *
 * Under the status: the reminder that the free TMDB plan is for projects
 * that do not earn money, and TMDB's own credit sentence, which their terms
 * want shown word for word. For staff who can see movies (the status route
 * asks MOVIES.VIEW); a failed read shows "Couldn't check" with the same
 * button.
 */
export function TmdbConnectionCard({ className }: { className?: string }) {
  const { t } = useLanguage();
  const c = t.tmdb.connection;
  const { status, isLoading, error, check } = useTmdbConnection();

  // A state a newer server might add reads as "couldn't check" rather than as a wrong name.
  const known = status ? (c.states[status.state] ?? null) : null;
  const view = known ?? c.unknown;
  const colors = status && known ? STATE_COLORS[status.state] : UNKNOWN_COLORS;
  const checkedAt = status?.checkedAt ? new Date(status.checkedAt) : null;
  const firstLoad = isLoading && !status && !error;

  return (
    <Card className={cn("glass-card max-w-2xl", className)}>
      <CardHeader>
        <CardTitle>{c.cardTitle}</CardTitle>
        <CardDescription>{c.cardDescription}</CardDescription>
        <CardAction>
          <Button variant="secondary" size="sm" disabled={isLoading} onClick={check}>
            {isLoading ? <Loader2 className="size-3.5 animate-spin" /> : <RotateCw className="size-3.5" />}
            {isLoading ? c.checking : c.checkAgain}
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {firstLoad ? (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-full max-w-md" />
          </div>
        ) : (
          <div className="flex flex-col gap-1.5" aria-live="polite">
            <p className="flex items-center gap-2.5">
              <span className={cn("size-2.5 shrink-0 rounded-full", colors.dot)} aria-hidden />
              <span className={cn("text-sm font-semibold", colors.name)}>{view.name}</span>
            </p>
            <p className="text-sm leading-relaxed text-muted-foreground">{view.text}</p>
            {checkedAt && !Number.isNaN(checkedAt.getTime()) && (
              <p className="text-xs tabular-nums text-muted-foreground">
                {c.lastChecked(format(checkedAt, "d MMM yyyy, HH:mm"))}
              </p>
            )}
          </div>
        )}

        <div className="flex flex-col gap-1 rounded-lg border border-warning/25 bg-warning/10 p-3">
          <p className="text-sm font-semibold text-warning">{c.earningTitle}</p>
          <p className="text-sm leading-relaxed">{c.earningText}</p>
        </div>

        <p className="text-sm leading-relaxed text-muted-foreground">{c.nothingBreaks}</p>

        <Separator />

        {/* TMDB's sentence, as their terms word it: English in both admin languages. */}
        <p lang="en" className="text-xs leading-relaxed text-muted-foreground">
          {c.credit}
        </p>
      </CardContent>
    </Card>
  );
}
