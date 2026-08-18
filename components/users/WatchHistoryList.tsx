"use client";

import Image from "next/image";
import { format } from "date-fns";
import { Clapperboard } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { EmptyState } from "@/components/shared/EmptyState";
import { useLanguage } from "@/lib/context/language-context";
import type { WatchHistoryEntry } from "@/types/user";

export function WatchHistoryList({ entries }: { entries: WatchHistoryEntry[] }) {
  const { t } = useLanguage();

  if (!entries.length) {
    return (
      <EmptyState
        icon={Clapperboard}
        title={t.users.watchHistory.emptyTitle}
        description={t.users.watchHistory.emptyDescription}
      />
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {entries.map((entry) => (
        <li key={entry.id} className="flex items-center gap-3">
          <div className="relative h-16 w-11 shrink-0 overflow-hidden rounded-md bg-muted">
            {entry.posterUrl && (
              <Image src={entry.posterUrl} alt={entry.movieTitle} fill className="object-cover" sizes="44px" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{entry.movieTitle}</p>
            <p className="text-xs text-muted-foreground">
              {t.users.watchHistory.watchedOn(format(new Date(entry.watchedAt), "d MMM yyyy"))}
            </p>
            <Progress value={entry.progressPercent} className="mt-1.5 h-1.5" />
          </div>
          <span className="shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
            {entry.progressPercent}%
          </span>
        </li>
      ))}
    </ul>
  );
}
