"use client";

import { CircleCheck, CircleMinus, CircleX, Clock, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMoney } from "@/components/lottery/claims/claimFormat";
import { useLanguage } from "@/lib/context/language-context";
import { cn } from "@/lib/utils";
import type { LotteryClaimsSummary } from "@/types/lottery";

const TILE_COUNT = 4;

/** Two tiles a row on a phone, all four on a wide screen. */
const GRID = "grid grid-cols-2 gap-3 xl:grid-cols-4";

interface Tile {
  key: string;
  icon: LucideIcon;
  iconClass: string;
  label: string;
  value: string;
  unit: string;
  sub: string;
}

interface ClaimsSummaryTilesProps {
  summary: LotteryClaimsSummary | null;
  isLoading: boolean;
  error: Error | null;
  onRetry: () => void;
}

/**
 * The board's four tiles over the list: Waiting (claims + kyat to pay) ·
 * Paid today (Myanmar day) · Not yet requested (winners, tickets, kyat) ·
 * Rejected. They follow the Draw select, so the figures match the rows
 * below. Expired prizes ride in the Not-yet-requested tile's line when
 * there are any — the board has no fifth tile.
 */
export function ClaimsSummaryTiles({ summary, isLoading, error, onRetry }: ClaimsSummaryTilesProps) {
  const { t } = useLanguage();
  const s = t.lottery.claims.tiles;

  if (isLoading && !summary) {
    return (
      <div className={GRID}>
        {Array.from({ length: TILE_COUNT }).map((_, i) => (
          <Skeleton key={i} className="h-[112px] rounded-xl bg-secondary/60" />
        ))}
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-warning/25 bg-warning/10 px-4 py-3 text-sm">
        <span>{error ? s.loadError : "…"}</span>
        <Button size="sm" variant="outline" onClick={onRetry}>
          {t.common.retry}
        </Button>
      </div>
    );
  }

  const waiting = summary.waiting.claims;
  const paid = summary.paidToday.claims;
  const notRequested = summary.notRequested.customers;
  const rejected = summary.rejected.claims;
  const expiredLine =
    summary.expired.tickets > 0 ? ` · ${s.expiredSub(summary.expired.tickets, formatMoney(summary.expired.ks))}` : "";

  const tiles: Tile[] = [
    {
      key: "waiting",
      icon: Clock,
      iconClass: "text-warning",
      label: s.waiting,
      value: waiting.toLocaleString("en-US"),
      unit: s.claimUnit(waiting),
      sub: waiting > 0 ? s.waitingSub(formatMoney(summary.waiting.ks)) : s.waitingEmpty,
    },
    {
      key: "paidToday",
      icon: CircleCheck,
      iconClass: "text-success",
      label: s.paidToday,
      value: paid.toLocaleString("en-US"),
      unit: s.claimUnit(paid),
      sub: paid > 0 ? s.paidTodaySub(formatMoney(summary.paidToday.ks)) : s.paidTodayEmpty,
    },
    {
      key: "notRequested",
      icon: CircleMinus,
      iconClass: "text-muted-foreground",
      label: s.notRequested,
      value: notRequested.toLocaleString("en-US"),
      unit: s.winnerUnit(notRequested),
      sub:
        (notRequested > 0
          ? s.notRequestedSub(formatMoney(summary.notRequested.ks), summary.notRequested.tickets)
          : s.notRequestedEmpty) + expiredLine,
    },
    {
      key: "rejected",
      icon: CircleX,
      iconClass: "text-destructive",
      label: s.rejected,
      value: rejected.toLocaleString("en-US"),
      unit: s.claimUnit(rejected),
      sub: rejected > 0 ? s.rejectedSub(formatMoney(summary.rejected.ks)) : s.rejectedEmpty,
    },
  ];

  return (
    <div className={cn(GRID, "transition-opacity", isLoading && "opacity-60")} aria-busy={isLoading || undefined}>
      {tiles.map((tile) => {
        const Icon = tile.icon;
        return (
          <Card key={tile.key} className="glass-card py-0">
            <CardContent className="flex h-full flex-col gap-2 p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Icon className={cn("size-3.5 shrink-0", tile.iconClass)} aria-hidden="true" />
                <span className="truncate">{tile.label}</span>
              </p>
              <p className="flex items-baseline gap-1.5 font-heading text-2xl font-bold tracking-tight tabular-nums">
                {tile.value}
                <span className="text-xs font-medium text-muted-foreground">{tile.unit}</span>
              </p>
              <p className="mt-auto truncate text-xs text-muted-foreground" title={tile.sub}>
                {tile.sub}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
