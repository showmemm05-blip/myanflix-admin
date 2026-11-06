"use client";

import { Info, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DrawSelect } from "@/components/lottery/analytics/DrawSelect";
import { useLanguage } from "@/lib/context/language-context";
import {
  LOTTERY_CLAIM_LIST_STATUSES,
  type LotteryAdminDraw,
  type LotteryClaimListStatus,
} from "@/types/lottery";

interface ClaimsFiltersProps {
  status: LotteryClaimListStatus;
  onStatusChange: (status: LotteryClaimListStatus) => void;
  /** A draw id, or "" for every draw. */
  drawId: string;
  onDrawChange: (drawId: string) => void;
  /** The draws to offer; null while loading or refused. */
  draws: LotteryAdminDraw[] | null;
  drawsError: boolean;
  search: string;
  onSearchChange: (value: string) => void;
}

/**
 * The board's filter row: the status tabs (Waiting · Paid · Rejected · Not
 * requested · All), the Draw select and the search box — all SERVER filters,
 * because the list is paged. It sits outside the table so it stays in reach
 * when a tab is empty.
 */
export function ClaimsFilters({
  status,
  onStatusChange,
  drawId,
  onDrawChange,
  draws,
  drawsError,
  search,
  onSearchChange,
}: ClaimsFiltersProps) {
  const { t } = useLanguage();
  const c = t.lottery.claims;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/40 p-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={status} onValueChange={(v) => v && onStatusChange(v as LotteryClaimListStatus)}>
          <TabsList className="h-8">
            {LOTTERY_CLAIM_LIST_STATUSES.map((s) => (
              <TabsTrigger key={s} value={s} className="px-2 text-xs">
                {c.tabs[s]}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {c.filters.draw}
            </span>
            <DrawSelect draws={draws} value={drawId} onChange={onDrawChange} />
          </div>
          <div className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label={c.filters.search}
              placeholder={c.filters.searchPlaceholder}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-secondary/50 pl-9"
            />
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <Info className="size-3.5 shrink-0" aria-hidden="true" />
          {c.oneAtATime}
        </span>
        {drawsError && <span className="text-warning">{c.filters.drawsLoadError}</span>}
      </div>
    </div>
  );
}
